// ថ្នាក់ ៖ **rules RTDB ដែល Postgres អនុវត្ត (`private.zoe_eval` លើ `firebase-database.rules.json` ដដែល) ឃ្លាតពី RTDB ពិត ➜ server
// មួយទទួលអ្វីដែលមួយទៀតបដិសេធ ➜ fence ស្តារ/លុបទាំងអស់ · ledger អវិជ្ជមាន · registry ដំណើរការខុសលើ backend Supabase ដោយស្ងាត់។**
//
// ⛔ oracle = RTDB emulator ពិត (មិនមែនការសរសេរ verdict ដោយដៃ)។ ការអនុវត្ត ៣ ផ្នែក លើ backend ទាំង ២ **ក្នុងពេលតែមួយ** ៖
//   ក. probe semantics ជាមួយ rules គំរូ ៖ `.validate` របស់ ancestor · descendant ដែលមិនប្រែ · null/ប្រភេទក្នុងការប្រៀប · `.write`
//      មិនចុះជ្រៅ · ការលុប · array ➜ object
//   ខ. ការសរសេរពិតរបស់ App (`revenue-fuzz-test` + `FUZZ_CAPTURE`) ជាមួយ rules ពិត ➜ verdict ដូចគ្នា **រាល់ការសរសេរ**
//   គ. ការសរសេរដដែលដែលបំប្លែងដោយចៃដន្យ (ប្រភេទ · លេខអវិជ្ជមាន · វាលបាត់/បន្ថែម · token ស្តារ/clearClaim ខុស · trashReason ·
//      lockerRevision · op) ➜ verdict ដូចគ្នា
//   ➜ ចុងលំដាប់នីមួយៗ ៖ ទិន្នន័យពេញ (canonical) ដូចគ្នា។ ការបដិសេធត្រូវចាក់ជា owner លើ **ទាំង ២** ➜ ស្ថានភាពនៅស្មើ។
// ⛔ ជាន់អប្បបរមា ៖ ការសរសេរ user ≥ ១៥០ · probe បំប្លែង ≥ ១០០ ដែល **ទាំង ២ បដិសេធ** ≥ ៣០ (ការវាស់មិនទទេ) · root ៩។
//
//   java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
//   npm ci --prefix supabase
//   M=$(ZOE_MEASURE_ONLY=1 bash audit-tools/run-all.sh | tail -1); (cd "$M" && node audit-tools/emu/supabase-rules-parity-test.js)
'use strict';
process.exitCode = 1;

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const { emuNamespace } = require('./ns.js');
const { createPgHarness } = require('../supabase-pg.js');

const ROOT = process.env.SBPARITY_APP_DIR ? path.resolve(process.env.SBPARITY_APP_DIR) : path.join(__dirname, '..', '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : ROOT;
const STRICT = process.env.SBPARITY_STRICT === '1' || process.env.SUPABASE_STRICT === '1' || process.env.CRUD_FLOW_STRICT === '1';
const RUNS = parseInt(process.env.SBPARITY_RUNS || '6', 10);
const OPS = parseInt(process.env.SBPARITY_OPS || '40', 10);
const SEED = parseInt(process.env.SBPARITY_SEED || '20261001', 10);
const MIN_USER_WRITES = 150;
const REQUIRED_ROOTS = ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod', '(root)', 'zoew_daily_revenue_cod_dod',
    'zoew_monthly_revenue_cod_dod', 'zoew_daily_pickup_cod_dod', 'zoew_daily_collected_cod_dod', 'zoew_barcode_registry',
    'zoew_restore_finalizations'];
const AUTH = 'auth_variable_override=' + encodeURIComponent(JSON.stringify({ uid: 'admin-uid' }));
const DEPS_DIRS = [process.env.SUPABASE_DEPS_DIR, path.join(ROOT, 'supabase', 'node_modules'), path.join(REPO, 'supabase', 'node_modules')].filter(Boolean);

let pass = 0, fail = 0;
const check = (c, label, detail) => {
    if (c) { pass++; console.log('  ok    ' + label); } else { fail++; console.log('  FAIL  ' + label + (detail ? '\n        ' + String(detail).slice(0, 1400) : '')); }
};

function req(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const r = http.request({ host: '127.0.0.1', port: 9000, method, path: urlPath, timeout: 15000,
            headers: Object.assign({ Authorization: 'Bearer owner' }, payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) },
        (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
        r.on('timeout', () => r.destroy(new Error('emulator timed out')));
        r.on('error', reject);
        if (payload) r.write(payload);
        r.end();
    });
}
const emuDenied = (r) => r.status >= 400 || /Permission denied/i.test(r.body);
const rootOf = (p) => String(p || '').split('/').filter(Boolean)[0] || '(root)';
const segs = (p) => String(p || '').split('/').filter(Boolean);
const isInc = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && (typeof v.__increment === 'number'
    || (v['.sv'] && typeof v['.sv'] === 'object' && typeof v['.sv'].increment === 'number'));
const incOf = (v) => (typeof v.__increment === 'number' ? v.__increment : v['.sv'].increment);
const withServerValues = (v) => {
    if (Array.isArray(v)) return v.map(withServerValues);
    if (v && typeof v === 'object') {
        if (typeof v.__increment === 'number') return { '.sv': { increment: v.__increment } };
        const out = {};
        for (const k of Object.keys(v)) out[k] = withServerValues(v[k]);
        return out;
    }
    return v;
};
function canon(v) {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'object') return v;
    const out = {};
    const keys = Array.isArray(v) ? v.map((_, i) => String(i)) : Object.keys(v);
    for (const k of keys.sort()) {
        const c = canon(v[k]);
        if (c !== null) out[k] = c;
    }
    return Object.keys(out).length ? out : null;
}
const dataOf = (s) => { const c = JSON.parse(JSON.stringify(s || {})); delete c._dateKey; return c; };
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

let H = null;
let pg = null;
let tenant = null;
let member = null;
let opN = 0;
const opId = () => 'par' + process.pid + 'x' + (++opN).toString(36).padStart(12, '0');

const ENGINE_MUTANTS = [
    ['មិនរត់ .validate របស់ ancestor', "        if node ? 'v' then\n            post := private.zoe_snap_val(jsonb_build_object('$s', 1, 'p', to_jsonb(p_path[1:i])), p_ctx);",
        "        if node ? 'v' and i = depth then\n            post := private.zoe_snap_val(jsonb_build_object('$s', 1, 'p', to_jsonb(p_path[1:i])), p_ctx);"],
    ['null ក្នុងការប្រៀប <= ជា 0 (coercion)', "            return 'false'::jsonb;\n        end if;\n        if op = '+' and left_type = 'string'",
        "            return to_jsonb(coalesce((left_value #>> '{}')::numeric, 0) <= coalesce((right_value #>> '{}')::numeric, 0));\n        end if;\n        if op = '+' and left_type = 'string'"],
    ['.validate រត់លើកូនដែលមិនប្រែរបស់ ancestor', "        if i = depth and (node ? 'c' or node ? 'x') then",
        "        if i >= 2 and (node ? 'c' or node ? 'x') then"]
];

async function pgSetupTenant(transform) {
    if (pg) { try { await pg.end(); } catch (e) {} pg = null; }
    const { c } = await H.freshDb('default-grants');
    const migDir = path.join(ROOT, 'supabase', 'migrations');
    let sql = fs.readdirSync(migDir).filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort()
        .map((f) => fs.readFileSync(path.join(migDir, f), 'utf8')).join('\n;\n');
    if (transform) {
        if (sql.split(transform[1]).length !== 2) throw new Error('engine mutant anchor must appear once: ' + transform[0]);
        sql = sql.replace(transform[1], transform[2]);
    }
    await c.query(sql);
    const t = await c.query("insert into public.tenants (name, branch_code, expires_at) values ('parity', '100001', now() + interval '30 days') returning id");
    const uid = await H.makeAuthUser(c, 'parity@u.zoe.test');
    await c.query("insert into public.tenant_members (user_id, tenant_id, username, role) values ($1, $2, 'parity', 'owner')", [uid, t.rows[0].id]);
    pg = c;
    tenant = t.rows[0].id;
    member = { role: 'authenticated', sub: uid };
}

async function pgSetRules(rulesJson, compileRules, rulesSql) {
    await pg.query(rulesSql(compileRules(rulesJson)));
}

function toPgOps(method, p, v) {
    const base = segs(p);
    if (method === 'PATCH') {
        const ops = [];
        for (const key of Object.keys(v || {})) {
            const full = base.concat(segs(key));
            if (full.length < 1 || (full.length === 1 && isInc(v[key]))) return null;
            ops.push(isInc(v[key]) ? { k: 'inc', p: full, d: incOf(v[key]) } : { k: 'set', p: full, v: v[key] === undefined ? null : v[key] });
        }
        return ops;
    }
    if (base.length < 1 || (base.length === 1 && isInc(v))) return null;
    if (isInc(v)) return [{ k: 'inc', p: base, d: incOf(v) }];
    return [{ k: 'set', p: base, v: v === undefined ? null : v }];
}

async function pgUser(method, p, v) {
    const ops = toPgOps(method, p, v);
    if (!ops) return { unsupported: true };
    if (!ops.length) return { ok: true };
    const r = await H.as(pg, member, 'select public.zoe_write($1, $2::jsonb) as r', [opId(), JSON.stringify(ops)]);
    if (r.error) return { denied: true, why: r.error.message + (r.error.detail ? ' @' + r.error.detail : '') };
    return { ok: true };
}

async function pgOwnerOps(ops, replace) {
    for (let i = 0; i < Math.max(ops.length, replace ? 1 : 0); i += 400) {
        const chunk = ops.slice(i, i + 400);
        const r = await H.as(pg, { role: 'service_role' }, 'select public.zoe_admin_write($1, $2, $3::jsonb, $4) as r',
            [tenant, opId(), JSON.stringify(chunk.length ? chunk : [{ k: 'set', p: ['zoew_barcode_registry', '__parity_noop__'], v: null }]), replace && i === 0]);
        if (r.error) throw new Error('owner write on Postgres failed: ' + r.error.message + ' ' + JSON.stringify(chunk.map((o) => o.p)).slice(0, 600));
    }
}

async function pgOwnerSnapshot(tree) {
    const ops = [];
    for (const root of Object.keys(tree || {})) {
        const node = tree[root];
        if (node === null || typeof node !== 'object') continue;
        const keys = Array.isArray(node) ? node.map((_, i) => String(i)) : Object.keys(node);
        for (const key of keys) if (node[key] !== null && node[key] !== undefined) ops.push({ k: 'set', p: [root, key], v: node[key] });
    }
    await pgOwnerOps(ops, true);
}

async function pgOwner(method, p, v) {
    const base = segs(p);
    if (method === 'SNAP' || (base.length === 0 && method !== 'PATCH')) return pgOwnerSnapshot(v);
    if (base.length === 1 && method !== 'PATCH') {
        const existing = await pg.query('select key from public.zoe_docs where tenant_id = $1 and root = $2 and value is not null', [tenant, base[0]]);
        const next = new Map(existing.rows.map((r) => [r.key, null]));
        if (v && typeof v === 'object') {
            const keys = Array.isArray(v) ? v.map((_, i) => String(i)) : Object.keys(v);
            for (const key of keys) next.set(key, v[key] === undefined ? null : v[key]);
        }
        const ops = [...next.entries()].map(([key, val]) => ({ k: 'set', p: [base[0], key], v: val }));
        return ops.length ? pgOwnerOps(ops, false) : undefined;
    }
    const ops = toPgOps(method, p, v);
    if (!ops) throw new Error('owner op unsupported on Postgres: ' + method + ' ' + p);
    if (ops.length) await pgOwnerOps(ops, false);
}

async function pgTree() {
    const rows = (await pg.query('select root, key, value from public.zoe_docs where tenant_id = $1 and value is not null', [tenant])).rows;
    const tree = {};
    for (const r of rows) (tree[r.root] = tree[r.root] || {})[r.key] = r.value;
    return canon(tree);
}

function firstDiff(a, b, where) {
    if (JSON.stringify(a) === JSON.stringify(b)) return null;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return where + ' ៖ emu=' + JSON.stringify(a) + ' pg=' + JSON.stringify(b);
    for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) {
        const d = firstDiff(a[k], b[k], where + '/' + k);
        if (d) return d;
    }
    return where;
}

function makeScenario(tag) {
    const ns = 'ns=' + emuNamespace('sb-parity-' + tag);
    const at = (p, asUser) => p + (p.includes('?') ? '&' : '?') + ns + (asUser ? '&' + AUTH : '');
    return {
        async loadRules(rules) {
            const r = await req('PUT', at('/.settings/rules.json'), rules);
            if (r.status !== 200) throw new Error('load rules មិនបាន ៖ ' + r.status + ' ' + r.body.slice(0, 120));
        },
        async owner(method, p, v) {
            if (method === 'SNAP') return req('PUT', at('/.json'), dataOf(v));
            return req(method === 'PATCH' ? 'PATCH' : 'PUT', at('/' + (p || '') + '.json'), withServerValues(v));
        },
        async user(method, p, v) {
            return req(method === 'PATCH' ? 'PATCH' : 'PUT', at('/' + (p || '') + '.json', true), withServerValues(v));
        },
        async tree() {
            const r = await req('GET', at('/.json'));
            return canon(JSON.parse(r.body));
        },
        async drop() { await req('PUT', at('/.json'), null); }
    };
}

const stats = { user: 0, denied: 0, mismatches: [], stateDiffs: [], unsupported: [], roots: new Set(), probes: 0, probesDeniedBoth: 0, probesAcceptedBoth: 0 };

async function both(sc, who, method, p, v, label) {
    if (who === 'owner') {
        await sc.owner(method, p, v);
        await pgOwner(method, p, v);
        return;
    }
    const e = await sc.user(method, p, v);
    const g = await pgUser(method, p, v);
    if (g.unsupported) {
        stats.unsupported.push(method + ' ' + (p || '/'));
        await pgOwner(method, p, v);
        return { emuDenied: emuDenied(e), pgDenied: null };
    }
    const ed = emuDenied(e);
    const gd = !!g.denied;
    if (ed !== gd) {
        stats.mismatches.push({ label, method, path: p || '/', emu: ed ? 'deny ' + e.body.slice(0, 60).replace(/\s+/g, ' ') : 'allow', pg: gd ? 'deny ' + g.why : 'allow',
            value: JSON.stringify(v).slice(0, 300) });
        const t = await sc.tree();
        await pgOwnerSnapshot(t);
    } else if (ed) {
        await sc.owner(method, p, v);
        await pgOwner(method, p, v);
    }
    return { emuDenied: ed, pgDenied: gd };
}

async function compareState(sc, label) {
    const a = await sc.tree();
    const b = await pgTree();
    const d = firstDiff(a, b, '');
    if (d) {
        stats.stateDiffs.push(label + ' ៖ ' + d);
        await pgOwnerSnapshot(a);
    }
}

const PROBE_RULES = { rules: { '.read': true,
    anc: { '$k': { '.write': 'auth != null', '.validate': "newData.hasChildren(['a','b'])", a: { '.validate': 'newData.isNumber()' }, b: { '.validate': 'newData.isNumber()' }, '$other': { '.validate': false } } },
    desc: { '$k': { '.write': 'auth != null', x: { '.validate': 'newData.isNumber()' }, y: { '.validate': 'newData.isNumber()' } } },
    cmp: { '$k': { '.write': 'auth != null', '.validate': "newData.child('v').val() <= 5" } },
    cmp2: { '$k': { '.write': 'auth != null', '.validate': "newData.child('v').val() === null" } },
    cmp3: { '$k': { '.write': 'auth != null', '.validate': "newData.child('v').val() !== 'x'" } },
    cmp4: { '$k': { '.write': 'auth != null', '.validate': "newData.child('v').val() > -1" } },
    cmp5: { '$k': { '.write': 'auth != null', '.validate': "newData.child('s').val() < 'm'" } },
    len: { '$k': { '.write': 'auth != null', '.validate': "newData.child('s').isString() && newData.child('s').val().length >= 3 && newData.child('s').val().length <= 4" } },
    mod: { '$k': { '.write': 'auth != null', '.validate': "newData.child('n').isNumber() && newData.child('n').val() % 1 === 0 && newData.child('n').val() >= 1" } },
    arr: { '$k': { '.write': 'auth != null', '.validate': 'newData.hasChildren()', '$i': { '.validate': "newData.hasChildren(['c'])" } } },
    wr: { '$k': { '.write': "newData.child('ok').val() === true", deep: { '.write': 'true' } } },
    nul: { '$k': { '.write': 'auth != null', '.validate': "newData.child('a').exists() || !newData.exists()" } },
    fence: { '$k': { '.write': "auth != null && (!data.exists() || root.child('keys').child($k).val() === newData.child('t').val() || newData.parent().parent().child('keys').child($k).val() === newData.child('t').val())" } },
    keys: { '$k': { '.write': 'auth != null', '.validate': 'newData.isString()' } },
    par: { '$k': { '.write': 'auth != null', 'c': { '.validate': "newData.parent().child('d').exists()" } } },
    err: { '$k': { '.write': "auth != null && (root.child('keys').child(newData.child('ref').val()).exists() || newData.child('ref').val() === null)" } }
} };
const PROBE_STEPS = [
    ['user', 'PUT', 'anc/k1', { a: 1, b: 2 }], ['user', 'PATCH', 'anc/k1', { a: 5 }], ['user', 'PUT', 'anc/k2/a', 1], ['user', 'PATCH', '', { 'anc/k3/a': 1 }],
    ['user', 'PUT', 'anc/k1/z', 3], ['user', 'PUT', 'anc/k1/a', null], ['user', 'PATCH', 'anc/k1', { a: 7, b: 8 }],
    ['owner', 'PUT', 'desc/k1', { x: 1, y: 'bad' }], ['user', 'PATCH', 'desc/k1', { x: 2 }], ['user', 'PUT', 'desc/k1', { x: 3, y: 'bad' }], ['user', 'PATCH', '', { 'desc/k1/x': 4 }],
    ['user', 'PUT', 'desc/k1/y', 'still-bad'], ['user', 'PUT', 'desc/k2', { x: 1, extra: { deep: [1, 2] } }],
    ['user', 'PUT', 'cmp/k1', { w: 1 }], ['user', 'PUT', 'cmp/k2', { v: 3 }], ['user', 'PUT', 'cmp/k3', { v: '3' }], ['user', 'PUT', 'cmp/k4', { v: true }], ['user', 'PUT', 'cmp/k5', { v: 5 }], ['user', 'PUT', 'cmp/k6', { v: 5.0001 }],
    ['user', 'PUT', 'cmp2/k1', { w: 1 }], ['user', 'PUT', 'cmp2/k2', { v: 0 }], ['user', 'PUT', 'cmp3/k1', { w: 1 }], ['user', 'PUT', 'cmp3/k2', { v: 'x' }],
    ['user', 'PUT', 'cmp4/k1', { w: 1 }], ['user', 'PUT', 'cmp4/k2', { v: -1 }], ['user', 'PUT', 'cmp4/k3', { v: -0.5 }],
    ['user', 'PUT', 'cmp5/k1', { s: 'abc' }], ['user', 'PUT', 'cmp5/k2', { s: 'zz' }], ['user', 'PUT', 'cmp5/k3', { s: 'M' }], ['user', 'PUT', 'cmp5/k4', { s: 3 }],
    ['user', 'PUT', 'len/k1', { s: 'ab' }], ['user', 'PUT', 'len/k2', { s: 'abcd' }], ['user', 'PUT', 'len/k3', { s: 'ក្រហម' }], ['user', 'PUT', 'len/k4', { s: '😀a' }], ['user', 'PUT', 'len/k5', { s: 12345 }],
    ['user', 'PUT', 'mod/k1', { n: 3 }], ['user', 'PUT', 'mod/k2', { n: 2.5 }], ['user', 'PUT', 'mod/k3', { n: 0 }], ['user', 'PUT', 'mod/k4', { n: 9007199254740991 }],
    ['user', 'PUT', 'arr/k1', [{ c: 1 }, { c: 2 }]], ['user', 'PUT', 'arr/k2', [{ c: 1 }, null, { c: 3 }]], ['user', 'PUT', 'arr/k3', [{ c: 1 }, {}]], ['user', 'PUT', 'arr/k4', [{ c: 1 }, { d: 1 }]],
    ['user', 'PUT', 'arr/k5', []], ['user', 'PATCH', 'arr/k1', { '1': { c: 9 } }], ['user', 'PATCH', 'arr/k1', { '5': { d: 1 } }],
    ['user', 'PUT', 'wr/k1/deep', 5], ['user', 'PUT', 'wr/k2', { deep: 5 }], ['user', 'PATCH', 'wr/k2', { deep: 6 }], ['user', 'PUT', 'wr/k3', { ok: true, deep: 1 }],
    ['owner', 'PUT', 'nul/k1', { a: 1 }], ['user', 'PUT', 'nul/k1', null], ['owner', 'PUT', 'nul/k2', { a: 1, b: 2 }], ['user', 'PUT', 'nul/k2/a', null], ['user', 'PUT', 'nul/k2/b', null],
    ['owner', 'PUT', 'nul/k3', { a: 1 }], ['user', 'PUT', 'nul/k3/a', null],
    ['user', 'PUT', 'fence/f1', { t: 'x' }], ['user', 'PUT', 'fence/f1', { t: 'y' }], ['user', 'PATCH', '', { 'keys/f1': 'y', 'fence/f1': { t: 'y' } }],
    ['user', 'PUT', 'fence/f1', { t: 'y', more: 1 }], ['user', 'PATCH', '', { 'keys/f1': 'z', 'fence/f1/t': 'z' }], ['user', 'PUT', 'fence/f1', { t: 'q' }],
    ['user', 'PUT', 'par/p1', { c: 1 }], ['user', 'PUT', 'par/p1', { c: 1, d: 1 }], ['user', 'PUT', 'par/p1/c', 2], ['user', 'PUT', 'par/p1/d', null],
    ['user', 'PUT', 'err/e1', { w: 1 }], ['user', 'PUT', 'err/e2', { ref: 'f1' }], ['user', 'PUT', 'err/e3', { ref: 'nope' }], ['user', 'PUT', 'err/e4', { ref: 5 }]
];

const MUTATORS = [
    ['number ➜ string', (v) => (typeof v === 'number' ? String(v) : undefined)],
    ['number ➜ អវិជ្ជមាន', (v) => (typeof v === 'number' ? -Math.abs(v) - 1 : undefined)],
    ['boolean ➜ number', (v) => (typeof v === 'boolean' ? 1 : undefined)],
    ['string ➜ number', (v) => (typeof v === 'string' ? 7 : undefined)],
    ['leaf ➜ object', (v) => (typeof v !== 'object' || v === null ? { nested: v === null ? 1 : v } : undefined)],
    ['leaf ➜ ទសភាគ', (v) => (typeof v === 'number' ? v + 0.5 : undefined)]
];
const FIELD_MUTATORS = [
    ['វាលមិនស្គាល់', (o) => { o.zzUnknown = 1; }],
    ['លុបវាល id', (o) => { if ('id' in o) { delete o.id; return true; } return false; }],
    ['clearClaim ខ្វះ token', (o) => { o.clearClaim = { claimedAt: 1 }; }],
    ['clearClaim ត្រឹមត្រូវ', (o) => { o.clearClaim = { token: 'tk' + Math.floor(o.cod || 1), claimedAt: 1790000000000 }; }],
    ['restoreClaim ខុស', (o) => { o.restoreClaimId = 'nosuch'; o.restoreClaimToken = 'bad'; }],
    ['restoreClaim (trash)', (o) => { o.restoreClaim = { token: 'x', claimedAt: Date.now(), targetId: String(o.id || 'x') }; }],
    ['trashReason ខុស', (o) => { o.trashReason = 'lost'; }],
    ['trashReason ត្រូវ', (o) => { o.trashReason = 'remove'; o.deletedAt = 1790000000000; }],
    ['lockerRevision 0', (o) => { o.lockerRevision = 0; }],
    ['lockerRevision 1.5', (o) => { o.lockerRevision = 1.5; }],
    ['lockerRevision 3', (o) => { o.lockerRevision = 3; }],
    ['op ខ្លី', (o) => { o.op = 'abc'; }],
    ['op ត្រូវ', (o) => { o.op = 'op-12345678'; }],
    ['token finalization ខុស', (o) => { o.token = 'wrong-token'; o.finalizedAt = 1; }],
    ['targetId ផ្សេង', (o) => { o.targetId = 'other-target'; }],
    ['barcodes/0 វាលហាម', (o) => { if (o.barcodes && o.barcodes[0]) { o.barcodes[0].hacker = true; return true; } return false; }],
    ['barcodes/0 cod អវិជ្ជមាន', (o) => { if (o.barcodes && o.barcodes[0]) { o.barcodes[0].cod = -3; return true; } return false; }],
    ['barcodes ជា string', (o) => { if ('barcodes' in o) { o.barcodes = 'x'; return true; } return false; }],
    ['pickedUpBarcodes ទទេ string', (o) => { o.pickedUpBarcodes = { K1: '' }; }],
    ['pickedUpPhones 0', (o) => { o.pickedUpPhones = { p1: 0 }; }]
];

function leaves(v, at, out) {
    if (v === null || typeof v !== 'object') { out.push(at); return out; }
    const keys = Array.isArray(v) ? v.map((_, i) => i) : Object.keys(v);
    for (const k of keys) leaves(v[k], at.concat([k]), out);
    return out;
}
function mutate(entry, rand) {
    const v = JSON.parse(JSON.stringify(entry.v === undefined ? null : entry.v));
    if (v && typeof v === 'object' && !isInc(v) && rand() < 0.55) {
        const targets = [v];
        if (entry.m === 'PATCH') for (const k of Object.keys(v)) if (v[k] && typeof v[k] === 'object' && !isInc(v[k])) targets.push(v[k]);
        const obj = targets[Math.floor(rand() * targets.length)];
        const [name, fn] = FIELD_MUTATORS[Math.floor(rand() * FIELD_MUTATORS.length)];
        if (!Array.isArray(obj) && fn(obj) !== false) return { v, name };
    }
    if (v === null) return { v: { zzUnknown: 1 }, name: 'null ➜ object' };
    if (isInc(v)) return { v: { __increment: -1e9 }, name: 'increment ធំអវិជ្ជមាន' };
    const ls = leaves(v, [], []);
    if (!ls.length) return null;
    for (let tries = 0; tries < 8; tries++) {
        const pth = ls[Math.floor(rand() * ls.length)];
        const [name, fn] = MUTATORS[Math.floor(rand() * MUTATORS.length)];
        let holder = { root: v };
        let key = 'root';
        for (const k of pth) { holder = holder[key]; key = k; }
        if (holder && typeof holder === 'object' && isInc(holder)) continue;
        const next = fn(holder[key]);
        if (next === undefined) continue;
        holder[key] = next;
        return { v: holder.root !== undefined && pth.length === 0 ? next : v, name };
    }
    return null;
}

function capture() {
    const file = path.join(os.tmpdir(), 'sb-parity-' + process.pid + '.json');
    return new Promise((resolve) => {
        execFile(process.execPath, [path.join(__dirname, '..', 'revenue-fuzz-test.js')], {
            cwd: ROOT,
            env: Object.assign({}, process.env, { FUZZ_APP_DIR: ROOT, FUZZ_CAPTURE: file, FUZZ_RUNS: String(RUNS), FUZZ_OPS: String(OPS), FUZZ_RUN0: '0' }),
            encoding: 'utf8', timeout: 300000, maxBuffer: 8 * 1024 * 1024
        }, (error, stdout) => {
            let data = null;
            try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { data = null; }
            try { fs.unlinkSync(file); } catch (e) {}
            resolve({ ok: !error, tail: String(stdout || '').trim().split('\n').slice(-3).join(' | '), data });
        });
    });
}

(async () => {
    console.log('supabase-rules-parity — rules RTDB លើ Postgres (backend Supabase) ធៀបនឹង RTDB emulator ពិត\n');
    const reach = await req('GET', '/.json?ns=' + emuNamespace('sb-parity-probe')).catch(() => null);
    const rulesMod = path.join(ROOT, 'supabase', 'scripts', 'rtdb-rules.mjs');
    H = createPgHarness({ depsDirs: DEPS_DIRS, shimDir: path.join(__dirname, '..', 'supabase-shim'),
        wantMajor: parseInt((fs.readFileSync(path.join(ROOT, 'supabase', 'config.toml'), 'utf8').match(/^major_version\s*=\s*(\d+)\s*$/m) || [])[1] || '0', 10) });
    const missing = !reach || reach.status >= 500 ? 'គ្មាន RTDB emulator នៅ 127.0.0.1:9000' : (H.unavailableReason() || (!fs.existsSync(rulesMod) ? 'គ្មាន supabase/scripts/rtdb-rules.mjs' : null));
    if (missing) {
        if (STRICT) {
            console.log('  FAIL  ' + missing + ' — STRICT ➜ ការ SKIP រាប់ជាការធ្លាក់');
            process.exit(1);
        }
        console.log('SKIP — ' + missing);
        process.exitCode = 0;
        return;
    }
    const { compileRules, rulesSql } = await import(pathToFileURL(rulesMod).href);
    const realRules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8'));
    await H.start();
    try {
        await pgSetupTenant();

        console.log('── ក. probe semantics (rules គំរូ) ──');
        await pgSetRules(PROBE_RULES, compileRules, rulesSql);
        const sc = makeScenario('probe');
        await sc.loadRules(PROBE_RULES);
        await pgOwnerSnapshot({});
        let probeDenied = 0, probeAllowed = 0;
        const before = stats.mismatches.length;
        for (let i = 0; i < PROBE_STEPS.length; i++) {
            const [who, m, p, v] = PROBE_STEPS[i];
            const r = await both(sc, who, m, p, v, 'probe#' + i);
            if (r) { if (r.emuDenied) probeDenied++; else probeAllowed++; }
            await compareState(sc, 'probe#' + i + ' ' + who + ' ' + m + ' ' + (p || '/'));
        }
        await sc.drop();
        const probeMis = stats.mismatches.slice(before);
        console.log('    probe ៖ ' + PROBE_STEPS.length + ' ជំហាន · RTDB បដិសេធ ' + probeDenied + ' · ទទួល ' + probeAllowed);
        check(probeMis.length === 0, 'probe semantics ៖ verdict Postgres = RTDB គ្រប់ជំហាន (' + PROBE_STEPS.length + ')',
            probeMis.slice(0, 8).map((d) => JSON.stringify(d)).join('\n        '));
        check(probeDenied >= 20 && probeAllowed >= 20, 'probe មិនទទេ ៖ បដិសេធ ≥ ២០ និងទទួល ≥ ២០', 'deny=' + probeDenied + ' allow=' + probeAllowed);
        check(stats.stateDiffs.length === 0, 'probe ៖ ទិន្នន័យចុងក្រោយ Postgres = RTDB (array/null/ការលុប)', stats.stateDiffs.join('\n        '));

        for (const mutant of ENGINE_MUTANTS) {
            await pgSetupTenant(mutant);
            await pgSetRules(PROBE_RULES, compileRules, rulesSql);
            const ms = makeScenario('mutant');
            await ms.loadRules(PROBE_RULES);
            const misStart = stats.mismatches.length;
            const diffStart = stats.stateDiffs.length;
            for (let i = 0; i < PROBE_STEPS.length; i++) {
                const [who, m, p, v] = PROBE_STEPS[i];
                await both(ms, who, m, p, v, 'mutant#' + i);
                await compareState(ms, 'mutant#' + i);
            }
            await ms.drop();
            const caught = (stats.mismatches.length - misStart) + (stats.stateDiffs.length - diffStart);
            stats.mismatches.length = misStart;
            stats.stateDiffs.length = diffStart;
            check(caught > 0, 'ការវាស់រសើប ៖ engine Postgres ខូច «' + mutant[0] + '» ➜ probe ឃើញភាពខុសគ្នា (' + caught + ')');
        }
        await pgSetupTenant();
        if (process.env.SBPARITY_PROBE_ONLY === '1') {
            console.log('\nSBPARITY_PROBE_ONLY=1 ៖ រំលងផ្នែក ខ–គ (ការ debug តែប៉ុណ្ណោះ · មិនមែនភស្តុតាង)');
            fail++;
            return;
        }
        console.log('\n── ខ–គ. ការសរសេរពិតរបស់ App + ការបំប្លែង (rules ពិត) ──');
        await pgSetRules(realRules, compileRules, rulesSql);
        const cap = await capture();
        check(cap.ok && Array.isArray(cap.data) && cap.data.length === RUNS, 'revenue-fuzz (App ពិត) capture ' + RUNS + ' លំដាប់', cap.tail);
        if (!cap.ok || !Array.isArray(cap.data)) throw new Error('capture failed');
        const rand = rng(SEED);
        const mutNames = new Set();
        const misBefore = stats.mismatches.length;
        const diffBefore = stats.stateDiffs.length;
        for (const run of cap.data) {
            const s = makeScenario('real-' + run.run);
            await s.loadRules(realRules);
            await s.owner('SNAP', '', run.seed);
            await pgOwnerSnapshot(dataOf(run.seed));
            const live = await both(s, 'user', 'PUT', 'zoew_daily_revenue_cod_dod/2000-01-01/codDollar', -1, 'live');
            if (!live || !live.emuDenied || !live.pgDenied) throw new Error('rules មិនរស់ ៖ ledger អវិជ្ជមានត្រូវទទួល');
            for (let i = 0; i < run.log.length; i++) {
                const entry = run.log[i];
                if (!entry || entry.bad) throw new Error('capture ខូច ៖ ' + JSON.stringify(entry));
                if (entry.owner) {
                    await both(s, 'owner', entry.m, entry.p, entry.v);
                    continue;
                }
                if (rand() < 0.6) {
                    const mut = mutate(entry, rand);
                    if (mut) {
                        stats.probes++;
                        mutNames.add(mut.name);
                        const r = await both(s, 'user', entry.m, entry.p, mut.v, 'run' + run.run + '#' + i + ' ' + mut.name);
                        if (r && r.emuDenied && r.pgDenied) stats.probesDeniedBoth++;
                        if (r && !r.emuDenied && r.pgDenied === false) stats.probesAcceptedBoth++;
                    }
                }
                stats.user++;
                stats.roots.add(rootOf(entry.p));
                const r = await both(s, 'user', entry.m, entry.p, entry.v, 'run' + run.run + '#' + i);
                if (r && r.emuDenied) stats.denied++;
            }
            await compareState(s, 'run ' + run.run);
            await s.drop();
        }
        const realMis = stats.mismatches.slice(misBefore);
        console.log('    ការសរសេរ user ' + stats.user + ' (RTDB បដិសេធ ' + stats.denied + ') · probe បំប្លែង ' + stats.probes + ' (បដិសេធទាំង ២ ' + stats.probesDeniedBoth
            + ' · ទទួលទាំង ២ ' + stats.probesAcceptedBoth + ') · ប្រភេទបំប្លែង ' + mutNames.size + ' · root ' + JSON.stringify([...stats.roots].sort()));
        check(stats.unsupported.length === 0, 'ការសរសេររបស់ App ទាំងអស់បង្ហាញជា op Postgres បាន (path ≥ ១ ជាន់)', stats.unsupported.slice(0, 5).join(' · '));
        check(stats.user >= MIN_USER_WRITES, 'ជាន់អប្បបរមា ៖ ការសរសេររបស់ App ≥ ' + MIN_USER_WRITES, 'user=' + stats.user);
        const missingRoots = REQUIRED_ROOTS.filter((r) => !stats.roots.has(r));
        check(missingRoots.length === 0, 'គ្រប root ដែលផ្លូវអាជីវកម្មសរសេរ (' + REQUIRED_ROOTS.length + ')', 'ខ្វះ ' + missingRoots.join(' · '));
        check(stats.probes >= 100 && stats.probesDeniedBoth >= 30 && stats.probesAcceptedBoth >= 10,
            'probe បំប្លែង ≥ ១០០ · បដិសេធទាំង ២ ≥ ៣០ · ទទួលទាំង ២ ≥ ១០ (ការវាស់មិនទទេទាំង ២ ទិស)',
            'probes=' + stats.probes + ' deniedBoth=' + stats.probesDeniedBoth + ' acceptedBoth=' + stats.probesAcceptedBoth);
        check(realMis.length === 0, '⛔ verdict Postgres = RTDB លើរាល់ការសរសេរពិត + បំប្លែង (' + (stats.user + stats.probes) + ')',
            realMis.slice(0, 8).map((d) => JSON.stringify(d)).join('\n        '));
        check(stats.stateDiffs.length === diffBefore, '⛔ ទិន្នន័យចុងលំដាប់នីមួយៗ Postgres = RTDB (' + cap.data.length + ' លំដាប់)',
            stats.stateDiffs.slice(diffBefore).join('\n        '));
    } finally {
        try { if (pg) await pg.end(); } catch (e) {}
        H.stop();
    }
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log('  FAIL  ' + (e && e.stack || e)); if (H) H.stop(); process.exit(1); });
