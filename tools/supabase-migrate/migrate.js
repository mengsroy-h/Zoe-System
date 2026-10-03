'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const supabase = require('../../firebase-backup/supabase.js');
const crypt = require('../../firebase-backup/crypt.js');

const EXIT = { OK: 0, FAIL: 1, USAGE: 2 };
const DEFAULT_RULES = path.join(__dirname, '..', '..', 'firebase-database.rules.json');
const MAX_KEY_BYTES = 768;
const MAX_DEPTH = 32;
const MAX_DOC_BYTES = 1048576;
const MAX_BATCH_OPS = 400;
const MAX_BATCH_BYTES = 2 * 1024 * 1024;
const MIN_NORMAL_DOUBLE = 2.2250738585072014e-308;
const MAX_LISTED_PROBLEMS = 200;
const KEY_FORBIDDEN = /[.#$/[\]\u0000-\u001f\u007f]/;
const BROKEN_UNICODE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const INPUT_FILE_RE = /\.json(\.gz)?(\.enc)?$/i;

class UsageError extends Error {}

function say(line) {
    process.stdout.write((line === undefined ? '' : String(line)) + '\n');
}
function warn(line) {
    process.stderr.write(String(line) + '\n');
}

function usage() {
    return [
        'Usage: node tools/supabase-migrate/migrate.js <input> [options]',
        '',
        '<input>   Firebase export (.json / .json.gz), a firebase-backup dump (.json.gz or .json.gz.enc)',
        '          or a Supabase shop archive from firebase-backup (file, or the tenant folder for the newest file)',
        '',
        '  --tenant <uuid>        target shop (tenant id)',
        '  --branch <code>        target shop by its ZTO branch code (as shown in ZoeKeyGen)',
        '  --url <url>            Supabase project URL (or env ZOE_SUPABASE_URL)',
        '  --secret-key <key>     sb_secret_... (prefer env ZOE_SUPABASE_SECRET_KEY: command lines are visible to other programs)',
        '  --apply                write (default is a dry run that writes nothing)',
        '  --replace              make the shop equal to the input: overwrite different records, delete records not in the input',
        '  --skip-invalid         leave out records that fail the checks (listed) instead of refusing',
        '  --rules <file>         rules file (default: firebase-database.rules.json of this repository)',
        '  --batch-ops <n>        records per write, 1-' + MAX_BATCH_OPS + ' (default 200)',
        '  --batch-bytes <n>      bytes per write, 65536-' + MAX_BATCH_BYTES + ' (default 1048576)',
        '  --timeout-ms <n>       ceiling per request (default 30000)',
        '  --retries <n>          retries per request on timeouts, 408/425/429/5xx (default 3)',
        '  --retry-delay-ms <n>   first retry delay, doubles each time (default 500)',
        '',
        'Encrypted input (.enc) needs env ZOE_BACKUP_PASSPHRASE.'
    ].join('\n');
}

function parseArgs(argv) {
    const opts = {
        input: null, tenant: null, branch: null, url: null, key: null, rules: null, apply: false, replace: false, skipInvalid: false, help: false,
        batchOps: 200, batchBytes: 1048576, timeoutMs: 30000, retries: 3, retryDelayMs: 500
    };
    const flags = { '--apply': 'apply', '--replace': 'replace', '--skip-invalid': 'skipInvalid', '--help': 'help', '-h': 'help' };
    const strings = { '--tenant': 'tenant', '--branch': 'branch', '--url': 'url', '--secret-key': 'key', '--rules': 'rules' };
    const ints = {
        '--batch-ops': ['batchOps', 1, MAX_BATCH_OPS],
        '--batch-bytes': ['batchBytes', 65536, MAX_BATCH_BYTES],
        '--timeout-ms': ['timeoutMs', 500, 600000],
        '--retries': ['retries', 0, 6],
        '--retry-delay-ms': ['retryDelayMs', 10, 60000]
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (Object.prototype.hasOwnProperty.call(flags, arg)) {
            opts[flags[arg]] = true;
        } else if (Object.prototype.hasOwnProperty.call(strings, arg) || Object.prototype.hasOwnProperty.call(ints, arg)) {
            const value = argv[i + 1];
            if (value === undefined) throw new UsageError('Missing value for ' + arg + '.');
            i += 1;
            if (strings[arg]) {
                opts[strings[arg]] = value;
            } else {
                const spec = ints[arg];
                const n = Number(value);
                if (!Number.isInteger(n) || n < spec[1] || n > spec[2]) throw new UsageError(arg + ' must be a whole number from ' + spec[1] + ' to ' + spec[2] + '.');
                opts[spec[0]] = n;
            }
        } else if (arg.startsWith('-')) {
            throw new UsageError('Unknown option ' + arg.split('=')[0] + '.');
        } else if (!opts.input) {
            opts.input = arg;
        } else {
            throw new UsageError('Only one input file is allowed (extra argument number ' + (i + 1) + ').');
        }
    }
    if (opts.tenant !== null && !supabase.TENANT_ID_RE.test(opts.tenant)) throw new UsageError('--tenant must be a tenant id (UUID).');
    if (opts.branch !== null && !/^[A-Za-z0-9_-]{1,32}$/.test(opts.branch)) throw new UsageError('--branch must be a branch code (letters, digits, _ or -).');
    return opts;
}

function putOwn(target, key, value) {
    Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}
function hasOwn(target, key) {
    return !!target && Object.prototype.hasOwnProperty.call(target, key);
}
function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function canonValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') {
        const out = Object.create(null);
        let n = 0;
        const keys = Array.isArray(value) ? value.map((x, i) => String(i)) : Object.keys(value);
        for (const k of keys) {
            const child = canonValue(Array.isArray(value) ? value[Number(k)] : value[k]);
            if (child !== null) {
                putOwn(out, k, child);
                n += 1;
            }
        }
        return n ? out : null;
    }
    if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < MIN_NORMAL_DOUBLE) return 0;
    return value;
}

function stableJson(value) {
    return JSON.stringify(value, (k, x) => {
        if (!x || typeof x !== 'object' || Array.isArray(x)) return x;
        const sorted = Object.create(null);
        for (const key of Object.keys(x).sort()) putOwn(sorted, key, x[key]);
        return sorted;
    });
}

function numericText(n) {
    const s = String(n);
    const m = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(s);
    if (!m) return s;
    const digits = m[2] + (m[3] || '');
    const exp = Number(m[4]) - (m[3] || '').length;
    if (exp >= 0) return m[1] + digits + '0'.repeat(exp);
    const point = digits.length + exp;
    return m[1] + (point > 0 ? digits.slice(0, point) + '.' + digits.slice(point) : '0.' + '0'.repeat(-point) + digits);
}

function jsonbTextBytes(value) {
    if (value === null || value === undefined) return 4;
    if (typeof value === 'string') return Buffer.byteLength(JSON.stringify(value));
    if (typeof value === 'boolean') return value ? 4 : 5;
    if (typeof value === 'number') return numericText(value).length;
    if (Array.isArray(value)) {
        let n = 2 + Math.max(0, value.length - 1) * 2;
        for (const item of value) n += jsonbTextBytes(item);
        return n;
    }
    const keys = Object.keys(value);
    let n = 2 + Math.max(0, keys.length - 1) * 2;
    for (const k of keys) n += Buffer.byteLength(JSON.stringify(k)) + 2 + jsonbTextBytes(value[k]);
    return n;
}

function keyProblem(key) {
    if (!key) return 'empty key';
    if (Buffer.byteLength(key) > MAX_KEY_BYTES) return 'key longer than ' + MAX_KEY_BYTES + ' bytes';
    if (KEY_FORBIDDEN.test(key)) return 'key contains . # $ / [ ] or a control character';
    if (BROKEN_UNICODE.test(key)) return 'key contains broken Unicode';
    return null;
}
function valueProblem(value) {
    if (typeof value === 'string') {
        if (value.indexOf('\u0000') !== -1) return 'text contains a NUL character (Postgres rejects it)';
        if (BROKEN_UNICODE.test(value)) return 'text contains broken Unicode';
    }
    if (typeof value === 'number' && !Number.isFinite(value)) return 'number is out of range';
    return null;
}

function ruleChild(node, key) {
    if (!isObject(node)) return null;
    if (hasOwn(node, key) && !key.startsWith('.') && !key.startsWith('$')) return { node: node[key], declared: true };
    const wild = Object.keys(node).find((k) => k.startsWith('$') && k !== '$other');
    if (wild) return { node: node[wild], declared: true };
    if (hasOwn(node, '$other')) return { node: node.$other, declared: false };
    return null;
}
function expectsObject(node) {
    if (!isObject(node)) return false;
    if (Object.keys(node).some((k) => !k.startsWith('.') && k !== '$other')) return true;
    return /(^|[^!\w.])newData\.hasChildren\(/.test(String(node['.validate'] || ''));
}
function rejectsUnknown(node) {
    const other = isObject(node) ? node.$other : null;
    return !!other && (other['.validate'] === false || other['.validate'] === 'false');
}

function walkValue(value, node, at, depth, problems) {
    if (depth > MAX_DEPTH) {
        problems.push({ level: 'error', path: at, reason: 'nested deeper than ' + MAX_DEPTH + ' levels below the record' });
        return;
    }
    if (!isObject(value)) {
        const bad = valueProblem(value);
        if (bad) problems.push({ level: 'error', path: at, reason: bad });
        if (expectsObject(node)) problems.push({ level: 'error', path: at, reason: 'not an object (ZoeW skips it; the rules expect an object here)' });
        return;
    }
    for (const k of Object.keys(value)) {
        const childPath = at + '/' + k;
        const bad = keyProblem(k);
        if (bad) {
            problems.push({ level: 'error', path: childPath, reason: bad });
            continue;
        }
        const rule = node ? ruleChild(node, k) : null;
        if (node && (!rule || (!rule.declared && rejectsUnknown(node)))) {
            problems.push({ level: 'warn', path: childPath, reason: 'field is not allowed by the rules (ZoeW can read the record but cannot save it back unchanged)' });
        }
        walkValue(value[k], rule && rule.declared ? rule.node : null, childPath, depth + 1, problems);
    }
}

function validateTree(data, rules) {
    const problems = [];
    const docs = [];
    if (!isObject(data)) {
        problems.push({ level: 'error', path: '/', reason: 'input is not a JSON object (empty export?)' });
        return { docs, problems };
    }
    for (const root of Object.keys(data)) {
        const rootValue = canonValue(data[root]);
        if (rootValue === null) continue;
        const badRoot = keyProblem(root);
        const rootRule = badRoot ? null : ruleChild(rules, root);
        if (badRoot || !rootRule || !rootRule.declared) {
            problems.push({ level: 'error', path: root, reason: badRoot || 'unknown root (not in the rules; ZoeW never reads it - wrong file?)' });
            continue;
        }
        if (!isObject(rootValue)) {
            problems.push({ level: 'error', path: root, reason: 'root value is not an object' });
            continue;
        }
        for (const key of Object.keys(rootValue)) {
            const docPath = root + '/' + key;
            const value = rootValue[key];
            const before = problems.length;
            const badKey = keyProblem(key);
            const rule = badKey ? null : ruleChild(rootRule.node, key);
            if (badKey) problems.push({ level: 'error', path: docPath, reason: badKey });
            else if (!rule || (!rule.declared && rejectsUnknown(rootRule.node))) problems.push({ level: 'error', path: docPath, reason: 'record is not allowed by the rules' });
            else walkValue(value, rule.declared ? rule.node : null, docPath, 0, problems);
            const bytes = jsonbTextBytes(value);
            if (bytes > MAX_DOC_BYTES) problems.push({ level: 'error', path: docPath, reason: 'record is larger than 1 MiB' });
            docs.push({ root, key, value, bytes, invalid: problems.slice(before).some((p) => p.level === 'error') });
        }
    }
    return { docs, problems };
}

function pickInputFile(target) {
    const stat = fs.statSync(target);
    if (!stat.isDirectory()) return target;
    const files = fs.readdirSync(target).filter((f) => INPUT_FILE_RE.test(f) && fs.statSync(path.join(target, f)).isFile()).sort();
    if (!files.length) throw new Error('Folder has no .json, .json.gz or .json.gz.enc file: ' + target);
    return path.join(target, files[files.length - 1]);
}

function readInput(input, env) {
    const resolved = path.resolve(input);
    if (!fs.existsSync(resolved)) throw new Error('Input not found: ' + resolved);
    const file = pickInputFile(resolved);
    let buf = fs.readFileSync(file);
    if (buf.length >= crypt.MAGIC.length && buf.subarray(0, crypt.MAGIC.length).equals(crypt.MAGIC)) {
        if (!env.ZOE_BACKUP_PASSPHRASE) throw new Error('Input is encrypted: set ZOE_BACKUP_PASSPHRASE first.');
        buf = crypt.decryptBuffer(buf, env.ZOE_BACKUP_PASSPHRASE);
    }
    if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
    let parsed;
    try {
        parsed = JSON.parse(buf.toString('utf8').replace(/^﻿/, ''));
    } catch (e) {
        throw new Error('Input is not valid JSON: ' + file);
    }
    if (supabase.isArchive(parsed)) return { file, kind: 'supabase-archive', data: parsed.data, manifest: parsed.manifest };
    if (isObject(parsed) && parsed.format === supabase.FORMAT) throw new Error('Unsupported archive version ' + JSON.stringify(parsed.version) + ' (expected ' + supabase.FORMAT_VERSION + ').');
    return { file, kind: 'firebase-export', data: parsed, manifest: null };
}

function loadRules(file) {
    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        throw new Error('Rules file not found or not valid JSON: ' + file + ' (use --rules <file>).');
    }
    if (!isObject(raw) || !isObject(raw.rules)) throw new Error('Rules file has no "rules" object: ' + file);
    return raw.rules;
}

function sizeText(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function treeOf(docs) {
    const tree = Object.create(null);
    for (const d of docs) {
        if (!hasOwn(tree, d.root)) putOwn(tree, d.root, Object.create(null));
        putOwn(tree[d.root], d.key, d.value);
    }
    return tree;
}

function diffTrees(want, have) {
    const sets = [];
    const differing = [];
    const same = [];
    const extra = [];
    for (const root of Object.keys(want).sort()) {
        for (const key of Object.keys(want[root]).sort()) {
            const current = hasOwn(have, root) && hasOwn(have[root], key) ? have[root][key] : undefined;
            if (current === undefined) sets.push({ root, key, value: want[root][key] });
            else if (stableJson(current) === stableJson(want[root][key])) same.push({ root, key });
            else {
                sets.push({ root, key, value: want[root][key] });
                differing.push({ root, key });
            }
        }
    }
    for (const root of Object.keys(have).sort()) {
        for (const key of Object.keys(have[root]).sort()) {
            if (!(hasOwn(want, root) && hasOwn(want[root], key))) extra.push({ root, key });
        }
    }
    return { sets, differing, same, extra };
}

function makeBatches(ops, maxOps, maxBytes) {
    const batches = [];
    let current = [];
    let bytes = 2;
    for (const op of ops) {
        const size = jsonbTextBytes({ k: op.k, p: op.p, v: op.v });
        if (current.length && (current.length >= maxOps || bytes + size + 2 > maxBytes)) {
            batches.push(current);
            current = [];
            bytes = 2;
        }
        bytes += size + (current.length ? 2 : 0);
        current.push(op);
    }
    if (current.length) batches.push(current);
    return batches;
}

function batchOpId(tenantId, index, ops) {
    return 'mig_' + crypto.createHash('sha256').update(tenantId + '\n' + stableJson(ops)).digest('base64url').slice(0, 43);
}

function verifyTenant(want, have) {
    const roots = [];
    let equal = true;
    for (const root of [...new Set(Object.keys(want).concat(Object.keys(have)))].sort()) {
        const w = hasOwn(want, root) ? want[root] : Object.create(null);
        const h = hasOwn(have, root) ? have[root] : Object.create(null);
        const missing = Object.keys(w).filter((k) => !hasOwn(h, k));
        const extra = Object.keys(h).filter((k) => !hasOwn(w, k));
        const different = Object.keys(w).filter((k) => hasOwn(h, k) && stableJson(w[k]) !== stableJson(h[k]));
        const ok = !missing.length && !extra.length && !different.length;
        if (!ok) equal = false;
        roots.push({ root, expected: Object.keys(w).length, found: Object.keys(h).length, missing, extra, different, ok });
    }
    return { equal, roots };
}

function foreignWrites(startSeq, endSeq, results, changes) {
    const ours = new Map();
    for (const r of results) {
        for (const op of r.ops) ours.set(op.p[0] + '/' + op.p[1], r.seq);
    }
    const ourSeqs = new Set(results.map((r) => r.seq).filter((s) => s > startSeq && s <= endSeq));
    const unexplained = new Set();
    for (const c of changes) {
        if (ours.get(c.root + '/' + c.key) !== c.seq) unexplained.add(c.seq);
    }
    const gaps = Math.max(0, endSeq - startSeq - ourSeqs.size);
    return Math.max(gaps, unexplained.size);
}

function tenantLine(t) {
    return t.id + '  branch ' + String(t.branch_code).padEnd(12) + String(t.docs).padStart(8) + ' record(s)  ' + JSON.stringify(t.name)
        + (t.revoked ? ' (revoked)' : '');
}

function pickTenant(tenants, opts) {
    const byId = opts.tenant ? tenants.find((t) => String(t.id).toLowerCase() === opts.tenant.toLowerCase()) : null;
    const byBranch = opts.branch ? tenants.find((t) => t.branch_code === opts.branch) : null;
    if (opts.tenant && !byId) throw new Error('Tenant ' + opts.tenant + ' not found in this Supabase project.');
    if (opts.branch && !byBranch) throw new Error('No shop with branch ' + opts.branch + ' found in this Supabase project.');
    if (byId && byBranch && byId.id !== byBranch.id) throw new Error('--tenant and --branch point to different shops.');
    return byId || byBranch;
}

function printProblems(problems) {
    const errors = problems.filter((p) => p.level === 'error');
    const warnings = problems.filter((p) => p.level === 'warn');
    say('Checks : ' + errors.length + ' error(s) · ' + warnings.length + ' warning(s)');
    for (const p of errors.concat(warnings).slice(0, MAX_LISTED_PROBLEMS)) {
        say('  [' + (p.level === 'error' ? 'ERROR' : 'WARN') + '] ' + p.path + ': ' + p.reason);
    }
    if (problems.length > MAX_LISTED_PROBLEMS) say('  ... and ' + (problems.length - MAX_LISTED_PROBLEMS) + ' more');
    return errors.length;
}

async function run(argv, env) {
    const opts = parseArgs(argv);
    if (opts.help || !opts.input) {
        say(usage());
        return opts.help ? EXIT.OK : EXIT.USAGE;
    }
    const input = readInput(opts.input, env);
    const rules = loadRules(opts.rules ? path.resolve(opts.rules) : DEFAULT_RULES);
    if (input.kind === 'supabase-archive') {
        const t = input.manifest.tenant || {};
        say('Input  : ' + input.file + ' (Supabase archive of tenant ' + t.id + ' ' + JSON.stringify(t.name || '') + ' branch ' + (t.branch_code || '-')
            + ', seq ' + input.manifest.seq + ', exported ' + input.manifest.exported_at + ')');
    } else {
        say('Input  : ' + input.file + ' (Firebase export)');
    }

    const problems = validateTree(input.data, rules);
    const byRoot = new Map();
    for (const d of problems.docs) {
        const r = byRoot.get(d.root) || { docs: 0, bytes: 0 };
        r.docs += 1;
        r.bytes += d.bytes;
        byRoot.set(d.root, r);
    }
    let totalDocs = 0, totalBytes = 0;
    for (const root of [...byRoot.keys()].sort()) {
        const r = byRoot.get(root);
        totalDocs += r.docs;
        totalBytes += r.bytes;
        say('  ' + root.padEnd(34) + String(r.docs).padStart(7) + ' records  ' + sizeText(r.bytes));
    }
    say('  ' + 'total'.padEnd(34) + String(totalDocs).padStart(7) + ' records  ' + sizeText(totalBytes));
    const errorCount = printProblems(problems.problems);
    const kept = problems.docs.filter((d) => !d.invalid);
    if (errorCount && opts.skipInvalid) say('Skip   : ' + (problems.docs.length - kept.length) + ' record(s) and every unknown root are left out (--skip-invalid).');
    const blocked = errorCount > 0 && !opts.skipInvalid;
    const want = treeOf(kept);

    const url = opts.url || env.ZOE_SUPABASE_URL || '';
    const rawKey = opts.key || env.ZOE_SUPABASE_SECRET_KEY || '';
    if (opts.apply && blocked) {
        say('REFUSED: ' + errorCount + ' error(s) above. Fix the source, or add --skip-invalid to leave those records out.');
        return EXIT.FAIL;
    }
    const wantsShop = !!(opts.tenant || opts.branch);
    if (opts.apply && (!url || !rawKey || !wantsShop)) {
        throw new UsageError('--apply needs --tenant or --branch, a Supabase url (--url or ZOE_SUPABASE_URL) and a secret key (ZOE_SUPABASE_SECRET_KEY).');
    }
    if (!url || !rawKey) {
        say('Target : not checked (needs a Supabase url and secret key).');
        say('DRY-RUN: nothing was written. Add --apply to write.');
        return blocked ? EXIT.FAIL : EXIT.OK;
    }

    const client = supabase.createClient({ url, key: rawKey, timeoutMs: opts.timeoutMs, retryCount: opts.retries, retryDelayMs: opts.retryDelayMs });
    const target = { url: client.url, key: rawKey };
    const tenants = await supabase.listTenants(client);
    if (!wantsShop) {
        say('Shops  : ' + tenants.length + ' in ' + target.url + ' (pick one with --tenant <id> or --branch <code>)');
        for (const t of tenants) say('  ' + tenantLine(t));
        say('DRY-RUN: nothing was written. Add --apply to write.');
        return blocked ? EXIT.FAIL : EXIT.OK;
    }
    const meta = pickTenant(tenants, opts);
    say('Target : ' + target.url + ' tenant ' + meta.id + ' ' + JSON.stringify(meta.name) + ' branch ' + meta.branch_code
        + (meta.revoked ? ' (revoked)' : '') + ', ' + meta.docs + ' record(s), seq ' + meta.seq);
    if (input.kind === 'supabase-archive' && input.manifest.tenant && input.manifest.tenant.id !== meta.id) {
        say('Note   : the archive comes from another tenant (' + input.manifest.tenant.id + ').');
    }
    const current = await supabase.exportTenant(client, meta.id);
    const plan = diffTrees(want, current.data);
    say('Plan   : write ' + plan.sets.length + ' record(s) (' + plan.differing.length + ' different) · '
        + (opts.replace ? 'delete ' + plan.extra.length : 'keep ' + plan.extra.length + ' not in input') + ' · unchanged ' + plan.same.length);

    let refusal = null;
    if (plan.extra.length && !opts.replace) {
        refusal = 'tenant already has ' + plan.extra.length + ' record(s) that are not in the input (first: ' + plan.extra.slice(0, 3).map((d) => d.root + '/' + d.key).join(', ')
            + '). Use an empty shop, or --replace to make the shop equal to the input.';
    }
    if (!refusal && plan.differing.length && !opts.replace) {
        refusal = 'tenant has different values for ' + plan.differing.length + ' record(s) (first: ' + plan.differing.slice(0, 3).map((d) => d.root + '/' + d.key).join(', ')
            + '). Use --replace to overwrite them with the input.';
    }
    if (!opts.apply) {
        if (refusal) say('REFUSED (on --apply): ' + refusal);
        say('DRY-RUN: nothing was written. Add --apply to write.');
        return blocked || refusal ? EXIT.FAIL : EXIT.OK;
    }
    if (refusal) {
        say('REFUSED: ' + refusal);
        return EXIT.FAIL;
    }

    const ops = plan.sets.map((d) => ({ k: 'set', p: [d.root, d.key], v: d.value }))
        .concat(opts.replace ? plan.extra.map((d) => ({ k: 'set', p: [d.root, d.key], v: null })) : []);
    const results = [];
    if (!ops.length) {
        say('Nothing to write: tenant already equals the input.');
    } else {
        const batches = makeBatches(ops, opts.batchOps, opts.batchBytes);
        say('Writes : ' + batches.length + ' batch(es), ' + ops.length + ' record(s)');
        for (let i = 0; i < batches.length; i += 1) {
            const res = await client.rpc('zoe_admin_write', {
                p_tenant: meta.id,
                p_op_id: batchOpId(meta.id, i, batches[i]),
                p_ops: batches[i],
                p_replace: false
            });
            if (!res || res.ok !== true || !Number.isFinite(Number(res.seq))) {
                throw new Error('zoe_admin_write did not confirm batch ' + (i + 1) + ' of ' + batches.length + '.');
            }
            results.push({ seq: Number(res.seq), ops: batches[i] });
            say('  write ' + (i + 1) + '/' + batches.length + ' ok (seq ' + res.seq + (res.replayed ? ', replayed' : '') + ')');
        }
    }

    const after = await supabase.exportTenant(client, meta.id);
    const changes = current.seq < after.seq ? (await supabase.exportTenant(client, meta.id, { since: current.seq })).changes : [];
    const verdict = verifyTenant(want, after.data);
    for (const r of verdict.roots) {
        say('Verify : ' + r.root.padEnd(34) + ' expected ' + String(r.expected).padStart(6) + '  found ' + String(r.found).padStart(6) + '  '
            + (r.ok ? 'ok' : 'MISMATCH (missing ' + r.missing.length + ', extra ' + r.extra.length + ', different ' + r.different.length + ')'));
    }
    const foreign = foreignWrites(current.seq, after.seq, results, changes);
    let code = EXIT.OK;
    if (verdict.equal) {
        say('VERIFIED: tenant ' + meta.id + ' equals the input (' + kept.length + ' record(s), seq ' + after.seq + ').');
    } else {
        const first = [];
        for (const r of verdict.roots) for (const k of r.missing.concat(r.extra, r.different)) if (first.length < 5) first.push(r.root + '/' + k);
        say('VERIFY FAILED: the shop does not equal the input (first: ' + first.join(', ') + ').');
        code = EXIT.FAIL;
    }
    if (foreign > 0) {
        say('CHANGED BY OTHERS: ' + foreign + ' write(s) from other devices landed during the import. Close ZoeW on every device of this shop and run the import again.');
        code = EXIT.FAIL;
    }
    return code;
}

if (require.main === module) {
    run(process.argv.slice(2), process.env).then((code) => {
        process.exitCode = code;
    }, (e) => {
        if (e instanceof UsageError) {
            warn('ERROR: ' + e.message);
            warn('');
            warn(usage());
            process.exitCode = EXIT.USAGE;
            return;
        }
        warn('ERROR: ' + (e && e.message ? e.message : String(e)));
        process.exitCode = EXIT.FAIL;
    });
}

module.exports = {
    batchOpId,
    canonValue,
    diffTrees,
    foreignWrites,
    jsonbTextBytes,
    makeBatches,
    parseArgs,
    run,
    stableJson,
    validateTree,
    verifyTenant
};
