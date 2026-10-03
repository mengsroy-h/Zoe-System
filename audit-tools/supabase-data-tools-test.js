// ថ្នាក់ ៖ **ទិន្នន័យហាង Supabase ចេញ/ចូលតាមឧបករណ៍ក្រៅ App (backup · ផ្ទេរពី Firebase) ➜ backup ដែលស្តារមិនបាន · ទិន្នន័យហាងមួយចូលហាងមួយទៀត ·
// secret key លេចធ្លាយ · ការផ្ទេរដែលអនុវត្ត ២ ដង ឬបាត់ record ដោយស្ងាត់ = លុយ និងប្រវត្តិរបស់អតិថិជនខុស។**
//
//   npm ci --prefix supabase
//   node audit-tools/supabase-data-tools-test.js
//
// ⛔ វាស់ឧបករណ៍ពិត (child process) ទល់ Postgres ពិត + migration ពិតទាំងអស់ តាមម៉ាស៊ីនមេ PostgREST ក្លែង (`supabase-fake-server.js`) ៖
//   ក. RPC `zoe_admin_tenants` · `zoe_admin_export` ៖ service_role តែប៉ុណ្ណោះ · ទំព័រមានព្រំដែន (ជួរ · byte) · keyset (seq, root, key) ដែលមិនរំលង
//      និងមិនស្ទួនពេលហាងកំពុងសរសេរ · tombstone · មិនឆ្លង tenant
//   ខ. ខ្សែ CI ពេញ ៖ `ci-config.js` (ZOE_BACKUP_TARGETS) ➜ `backup.js` ➜ `crypt.js seal` ➜ ជំហានស្កេន plaintext ពិតរបស់ `backup.yml` ➜
//      `migrate.js` នាំ `.enc` ចូលហាងទី ២ ➜ backup ម្តងទៀត ➜ ទិន្នន័យដូចគ្នាបេះបិទ
//   គ. CLI ផ្ទេរ ៖ dry-run មិនសរសេរ · op id កំណត់ទុក (ចម្លើយបាត់ ➜ op id ដដែល · មិនអនុវត្ត ២ ដង) · ពិដាន/ព្យួរ · 401 មិន retry ·
//      ហាងមានទិន្នន័យ ➜ បដិសេធ · --replace · ការសរសេរពីឧបករណ៍ផ្សេងចំពេលផ្ទេរ ➜ exit ≠ 0 · record ដែល App អានមិនបាន ➜ រាយការណ៍
//   ឃ. secret key មិនលេចក្នុង stdout/stderr/ឯកសារ
//   ង. mutation លើ migration ពិត និងលើ tool ពិត (ច្បាប់ចម្លងក្នុងថតបណ្តោះអាសន្ន) ➜ សេណារីយ៉ូត្រូវក្រហម
// ⛔ គ្មាន Postgres/pg ➜ SKIP (`SUPABASE_STRICT=1` ➜ FAIL)។
'use strict';

process.exitCode = 1;

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const cp = require('child_process');

const ROOT = process.env.SBDATA_APP_DIR ? path.resolve(process.env.SBDATA_APP_DIR) : path.join(__dirname, '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : path.join(__dirname, '..');
const STRICT = process.env.SUPABASE_STRICT === '1';
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const DEPS_DIRS = [process.env.SUPABASE_DEPS_DIR, path.join(ROOT, 'supabase', 'node_modules'), path.join(REPO, 'supabase', 'node_modules')].filter(Boolean);
const TOOL_FILES = ['firebase-backup/backup.js', 'firebase-backup/ci-config.js', 'firebase-backup/crypt.js', 'firebase-backup/supabase.js',
    'tools/supabase-migrate/migrate.js', 'firebase-database.rules.json'];
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'backup.yml');
const PASSPHRASE = 'zoe-data-tools-passphrase-' + crypto.randomBytes(6).toString('hex');
const SECRET = 'sb_secret_' + crypto.randomBytes(24).toString('base64url');
const HIST = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const REG = 'zoew_barcode_registry';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const PICKUP = 'zoew_daily_pickup_cod_dod';
const SETTINGS = 'zoew_settings';

let pass = 0, fail = 0;
const skipped = [];
const STARTED = Date.now();
function section(title) { console.log('\n── ' + title + ' (' + ((Date.now() - STARTED) / 1000).toFixed(1) + ' វិ.) ──'); }
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail).slice(0, 900) : '')); }
}
function finish() {
    console.log('\n  (សរុប ' + ((Date.now() - STARTED) / 1000).toFixed(1) + ' វិ.)');
    if (skipped.length) console.log('SKIP ' + skipped.join(' · ') + ' (រត់ ៖ npm ci --prefix supabase)');
    console.log('\n' + (fail === 0 ? (skipped.length ? 'PARTIAL PASS (' + pass + '; SKIP ' + skipped.length + ')' : '✅ ជោគជ័យទាំងអស់ ' + pass)
        : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
    process.exitCode = fail === 0 ? 0 : 1;
}

console.log('=== supabase-data-tools ៖ backup ហាង Supabase · CLI ផ្ទេរ Firebase ➜ Supabase · RPC export (Postgres ពិត) ===');

const migrationFiles = fs.existsSync(MIGRATIONS_DIR) ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort() : [];
const migrationSql = migrationFiles.map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).join('\n;\n');
const configText = fs.existsSync(path.join(ROOT, 'supabase', 'config.toml')) ? fs.readFileSync(path.join(ROOT, 'supabase', 'config.toml'), 'utf8') : '';
const wantMajor = parseInt((configText.match(/^major_version\s*=\s*(\d+)\s*$/m) || [])[1] || '0', 10);

section('០. ឯកសារពិត');
ok('migration ពិតមាន zoe_admin_write (ផ្លូវសរសេររបស់ CLI)', /create function public\.zoe_admin_write\(/.test(migrationSql));
ok('migration ពិតមាន RPC export · បញ្ជីហាង (zoe_admin_export · zoe_admin_tenants)',
    /create function public\.zoe_admin_export\(/.test(migrationSql) && /create function public\.zoe_admin_tenants\(/.test(migrationSql));
for (const rel of TOOL_FILES) ok('ឧបករណ៍ពិត ៖ ' + rel, fs.existsSync(path.join(ROOT, rel)));
ok('workflow .github/workflows/backup.yml', fs.existsSync(WORKFLOW));
ok('supabase/config.toml ៖ [db] major_version (' + wantMajor + ')', wantMajor >= 15);

const { createPgHarness } = require('./supabase-pg.js');
const H = createPgHarness({ depsDirs: DEPS_DIRS, shimDir: path.join(__dirname, 'supabase-shim'), wantMajor });

if (fail > 0) {
    finish();
} else if (H.unavailableReason()) {
    if (STRICT) { ok('SUPABASE_STRICT=1 ៖ ' + H.unavailableReason(), false); finish(); }
    else { console.log('SKIP — ' + H.unavailableReason() + ' (រត់ ៖ npm ci --prefix supabase)'); process.exitCode = 0; }
} else {
    main().catch((e) => {
        ok('ការវាស់មិនគាំង', false, String(e && e.stack || e));
        finish();
    }).finally(() => H.stop());
}

// ── ជំនួយ ─────────────────────────────────────────────────────────────────────────────

function own(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true }); return o; }
function canon(v) {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v) || typeof v === 'object') {
        const o = Object.create(null);
        const keys = Array.isArray(v) ? v.map((_, i) => String(i)) : Object.keys(v);
        for (const k of keys) {
            const c = canon(Array.isArray(v) ? v[Number(k)] : v[k]);
            if (c !== null) own(o, k, c);
        }
        return Object.keys(o).length ? o : null;
    }
    return v;
}
function stable(v) {
    return JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
        ? Object.keys(x).sort().reduce((o, kk) => own(o, kk, x[kk]), Object.create(null)) : x));
}
function sameTree(a, b) { return stable(canon(a) || {}) === stable(canon(b) || {}); }
function treeDiff(a, b) {
    const x = canon(a) || {}, y = canon(b) || {};
    const at = (t, r, k) => (Object.prototype.hasOwnProperty.call(t, r) && Object.prototype.hasOwnProperty.call(t[r], k) ? t[r][k] : undefined);
    const keysOf = (t, r) => (Object.prototype.hasOwnProperty.call(t, r) ? Object.keys(t[r]) : []);
    const out = [];
    for (const r of new Set(Object.keys(x).concat(Object.keys(y)))) {
        for (const k of new Set(keysOf(x, r).concat(keysOf(y, r)))) {
            if (stable(at(x, r, k)) !== stable(at(y, r, k))) out.push(r + '/' + k);
        }
    }
    return out.slice(0, 12);
}
function docCount(tree) {
    let n = 0;
    for (const r of Object.keys(canon(tree) || {})) n += Object.keys(canon(tree)[r]).length;
    return n;
}

function cleanEnv(extra) {
    const env = {};
    for (const [k, v] of Object.entries(process.env)) {
        if (/^ZOE_(SUPABASE|BACKUP)_/.test(k)) continue;
        env[k] = v;
    }
    return Object.assign(env, extra || {});
}
const outputs = [];
function runNode(script, args, opts) {
    const o = opts || {};
    return new Promise((resolve) => {
        const t0 = Date.now();
        let out = '', err = '', timedOut = false;
        let child;
        try {
            child = cp.spawn(process.execPath, [script].concat(args || []), { cwd: o.cwd || os.tmpdir(), env: cleanEnv(o.env), stdio: ['ignore', 'pipe', 'pipe'] });
        } catch (e) {
            resolve({ code: null, out: '', err: String(e), all: String(e), ms: 0, timedOut });
            return;
        }
        child.stdout.setEncoding('utf8'); child.stdout.on('data', (d) => { out += d; });
        child.stderr.setEncoding('utf8'); child.stderr.on('data', (d) => { err += d; });
        const timer = setTimeout(() => { timedOut = true; try { child.kill('SIGKILL'); } catch (e) {} }, o.timeoutMs || 120000);
        child.on('error', (e) => { err += String(e); });
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            const r = { code, signal, out, err, all: out + '\n' + err, ms: Date.now() - t0, timedOut };
            outputs.push(r.all);
            resolve(r);
        });
    });
}
function runBash(script, env, timeoutMs) {
    return new Promise((resolve) => {
        const child = cp.spawn('bash', ['-c', script], { env: Object.assign(cleanEnv(), env), stdio: ['ignore', 'pipe', 'pipe'] });
        let all = '';
        child.stdout.on('data', (d) => { all += d; });
        child.stderr.on('data', (d) => { all += d; });
        const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (e) {} }, timeoutMs || 30000);
        child.on('close', (code) => { clearTimeout(timer); resolve({ code, all }); });
        child.on('error', () => { clearTimeout(timer); resolve({ code: null, all }); });
    });
}
function walkFiles(dir) {
    const out = [];
    (function visit(d) {
        let entries = [];
        try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
        for (const e of entries) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) visit(full);
            else if (e.isFile()) out.push(full);
        }
    })(dir);
    return out.sort();
}
function readArchive(file, passphrase) {
    let buf = fs.readFileSync(file);
    if (/\.enc$/.test(file)) buf = require(path.join(ROOT, 'firebase-backup', 'crypt.js')).decryptBuffer(buf, passphrase);
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
    return JSON.parse(buf.toString('utf8'));
}
function tmpDir(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function keyHash(key) { return crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 16); }
const item = (id, over) => Object.assign({ id, phone: '012345678', cod: 10, dod: 2, price: 12, count: 1, isClosed: false, createdAt: 1790000000000,
    scanDate: '2026-10-01', time: '09:00:00 (2026-10-01)', barcodes: [{ code: 'ZT' + id, cod: 10, dod: 2, isClosed: false, createdAt: 1790000000000 }] }, over || {});
let opCounter = 0;
const newOp = () => 'dt' + process.pid + 'x' + (++opCounter).toString(36).padStart(12, '0');

// ── Postgres ៖ ហាង · សមាជិក · ទិន្នន័យ ─────────────────────────────────────────────────────

function dbApi(c) {
    const ADMIN = { role: 'authenticated', sub: null };
    const SERVICE = { role: 'service_role' };
    let branchSeq = 0;
    const api = {
        c, ADMIN, SERVICE,
        async init() {
            ADMIN.sub = await H.makeAuthUser(c, 'boss' + process.pid + '@u.zoe.test');
            await c.query('insert into public.platform_admins (user_id) values ($1)', [ADMIN.sub]);
        },
        async tenant(name, withMember) {
            const branch = 'dt' + process.pid.toString(36) + 'b' + (++branchSeq);
            const t = await H.as(c, ADMIN, 'select * from public.admin_create_tenant($1, $2, $3)', ['ហាង ' + name, branch, new Date(Date.now() + 30 * 86400000).toISOString()]);
            if (!t.rows) throw new Error('admin_create_tenant ' + JSON.stringify(t.error));
            const out = { id: t.rows[0].id, name: 'ហាង ' + name, branch, who: null, username: null };
            if (withMember) {
                const inv = await H.as(c, ADMIN, "select * from public.admin_issue_invite($1, 'owner', 1, 24)", [out.id]);
                const hash = (await c.query('select private.invite_code_hash($1) as h', [inv.rows[0].code])).rows[0].h;
                const username = 'u' + process.pid.toString(36) + 'n' + branchSeq;
                const uid = await H.makeAuthUser(c, username + '@u.zoe.test');
                const reg = await H.as(c, SERVICE, 'select * from public.finish_registration($1, $2, $3)', [uid, hash, username]);
                if (!reg.rows) throw new Error('finish_registration ' + JSON.stringify(reg.error));
                out.who = { role: 'authenticated', sub: uid };
                out.username = username;
            }
            return out;
        },
        async write(who, ops, client) {
            const r = await H.as(client || c, who, 'select public.zoe_write($1, $2::jsonb) as r', [newOp(), JSON.stringify(ops)]);
            if (!r.rows || !r.rows[0].r.ok) throw new Error('zoe_write ' + JSON.stringify(r.error || r.rows));
            return r.rows[0].r;
        },
        async admin(tenant, ops, client) {
            const r = await H.as(client || c, SERVICE, 'select public.zoe_admin_write($1, $2, $3::jsonb, false) as r', [tenant, newOp(), JSON.stringify(ops)]);
            if (!r.rows || !r.rows[0].r.ok) throw new Error('zoe_admin_write ' + JSON.stringify(r.error || r.rows));
            return r.rows[0].r;
        },
        async tree(tenant, client) {
            const rows = (await (client || c).query('select root, key, value from public.zoe_docs where tenant_id = $1 and value is not null', [tenant])).rows;
            const t = Object.create(null);
            for (const r of rows) {
                if (!Object.prototype.hasOwnProperty.call(t, r.root)) own(t, r.root, Object.create(null));
                own(t[r.root], r.key, r.value);
            }
            return t;
        },
        async seq(tenant) {
            const r = (await c.query('select seq from public.zoe_tenant_state where tenant_id = $1', [tenant])).rows;
            return r.length ? Number(r[0].seq) : 0;
        },
        async opsCount(tenant) {
            return (await c.query('select count(*)::int as n from public.zoe_ops where tenant_id = $1', [tenant])).rows[0].n;
        },
        async exportPage(who, tenant, cursor, threshold, limit, maxBytes) {
            const cur = cursor || { seq: 0, root: '', key: '' };
            return H.as(c, who, 'select public.zoe_admin_export($1, $2, $3, $4, $5, $6, $7) as r',
                [tenant, cur.seq, cur.root, cur.key, threshold === undefined ? null : threshold, limit, maxBytes]);
        }
    };
    return api;
}

async function seedShop(D, shop, opts) {
    const o = opts || {};
    const regKeys = o.registry || 0;
    for (let i = 0; i < regKeys; i += 100) {
        const ops = [];
        for (let j = i; j < Math.min(regKeys, i + 100); j++) ops.push({ k: 'set', p: [REG, 'K' + String(j).padStart(5, '0')], v: true });
        await D.admin(shop.id, ops);
    }
    const items = [];
    for (let i = 0; i < (o.items || 0); i++) items.push({ k: 'set', p: [HIST, 'item' + String(i).padStart(3, '0')], v: item('item' + i, { phone: '0123' + String(i).padStart(5, '0') }) });
    for (let i = 0; i < items.length; i += 10) {
        if (shop.who) await D.write(shop.who, items.slice(i, i + 10));
        else await D.admin(shop.id, items.slice(i, i + 10));
    }
    const fixed = [
        { k: 'set', p: [DAILY, '2026-10-01'], v: { codDollar: 10.1, dodDollar: 2.5, totalCount: 3 } },
        { k: 'set', p: [MONTHLY, '2026-10'], v: { codDollar: 10.1, dodDollar: 2.5, totalCount: 3 } },
        { k: 'set', p: [PICKUP, '2026-10-01'], v: { packagesPickedUp: 1, pickedUpBarcodes: { ZTitem1: '012345678' }, pickedUpPhones: { '012345678': 1 } } },
        { k: 'set', p: [SETTINGS, 'exchange_rate'], v: 4100 },
        { k: 'set', p: [TRASH, 'trash1'], v: Object.assign(item('trash1'), { deletedAt: 1790000001000, trashReason: 'delete', isFromDeletion: true }) }
    ];
    await D.admin(shop.id, fixed);
    for (let i = 0; i < (o.big || 0); i++) {
        const barcodes = [];
        for (let j = 0; j < 260; j++) barcodes.push({ code: 'ZTBIG' + i + 'x' + j + 'y'.repeat(60), cod: 1.25, dod: 0, isClosed: j % 2 === 0, createdAt: 1790000000000 + j });
        await D.admin(shop.id, [{ k: 'set', p: [HIST, 'big' + i], v: item('big' + i, { barcodes, count: 260 }) }]);
    }
    if (o.tombstones) {
        const ops = [];
        for (let j = 0; j < o.tombstones; j++) ops.push({ k: 'set', p: [REG, 'K' + String(j).padStart(5, '0')], v: null });
        await D.admin(shop.id, ops);
    }
}

// ── ក. RPC export ───────────────────────────────────────────────────────────────────────

async function rpcScenario(rec, D) {
    const A = await D.tenant('ក (ប្រភព RPC)', true);
    const C = await D.tenant('គ (ហាងផ្សេង)', true);
    await seedShop(D, A, { registry: 2105, items: 30, big: 4, tombstones: 5 });
    await D.admin(C.id, [{ k: 'set', p: [REG, 'C_ONLY_1'], v: true }, { k: 'set', p: [HIST, 'C_item'], v: item('C_item') }]);
    const ANON = { role: 'anon' };

    for (const [tag, who] of [['anon', ANON], ['authenticated (សមាជិក A)', A.who], ['admin (authenticated)', D.ADMIN]]) {
        rec(tag + ' ៖ zoe_admin_export ➜ permission denied', H.denied(await D.exportPage(who, A.id, null, null, 10, 65536)));
        rec(tag + ' ៖ zoe_admin_tenants ➜ permission denied', H.denied(await H.as(D.c, who, 'select public.zoe_admin_tenants(null, 10)')));
    }

    const truth = await D.tree(A.id);
    const walk = async (limit, maxBytes, between) => {
        const t = {};
        let cursor = null, threshold, pages = 0, rowsSeen = 0, firstPageTombstones = -1, tombstones = 0, order = true, last = null;
        const pageInfo = [];
        for (;;) {
            const r = await D.exportPage(D.SERVICE, A.id, cursor, threshold, limit, maxBytes);
            if (!r.rows) return { error: r.error };
            const page = r.rows[0].r;
            pages++;
            if (pages === 1) firstPageTombstones = page.rows.filter((x) => x.v === null).length;
            if (threshold === undefined) threshold = page.tombstones_after;
            let bytes = 0;
            for (const row of page.rows) {
                const pos = [Number(row.s), row.r, row.k];
                if (last && !(pos[0] > last[0] || (pos[0] === last[0] && (Buffer.compare(Buffer.from(pos[1]), Buffer.from(last[1])) > 0
                    || (pos[1] === last[1] && Buffer.compare(Buffer.from(pos[2]), Buffer.from(last[2])) > 0))))) order = false;
                last = pos;
                if (row.v === null) { tombstones++; if (t[row.r]) delete t[row.r][row.k]; }
                else (t[row.r] = t[row.r] || {})[row.k] = row.v;
                bytes += row.v === null ? 0 : Buffer.byteLength(JSON.stringify(row.v));
            }
            rowsSeen += page.rows.length;
            pageInfo.push({ n: page.rows.length, bytes, more: page.more });
            if (between) await between(pages, page);
            if (!page.more) break;
            cursor = page.next;
            if (pages > 5000) break;
        }
        return { tree: t, pages, rowsSeen, firstPageTombstones, tombstones, order, pageInfo, threshold };
    };

    const full = await walk(500, 2097152);
    rec('export ពេញ (៥០០ ជួរ/ទំព័រ) ➜ ស្មើទិន្នន័យពិតរបស់ហាង A (' + docCount(truth) + ' doc)', !full.error && sameTree(full.tree, truth),
        full.error || treeDiff(full.tree, truth));
    rec('export ៖ ជួរតាមលំដាប់ (seq, root, key) កើនដាច់ខាត ➜ គ្មានស្ទួន', !full.error && full.order);
    rec('export ៖ គ្រប់ទំព័រ ≤ ៥០០ ជួរ · ច្រើនទំព័រ (' + (full.pages || 0) + ')', !full.error && full.pages >= 5 && full.pageInfo.every((p) => p.n <= 500), full.pageInfo);
    rec('export ៖ គ្មាន tombstone ចាស់ (doc ដែលលុបមុនការ export) ក្នុងទំព័រណាមួយ', !full.error && full.firstPageTombstones === 0 && full.tombstones === 0,
        [full.firstPageTombstones, full.tombstones]);
    rec('export មិនឆ្លង tenant ៖ គ្មាន doc របស់ហាង គ', !full.error && !JSON.stringify(full.tree).includes('C_ONLY_1') && !JSON.stringify(full.tree).includes('C_item'));

    const clamp = await D.exportPage(D.SERVICE, A.id, null, null, 100000, 999999999);
    rec('ពិដាន ៖ p_limit 100000 ➜ ២០០០ ជួរ · more', !!clamp.rows && clamp.rows[0].r.rows.length === 2000 && clamp.rows[0].r.more === true,
        clamp.error || (clamp.rows && clamp.rows[0].r.rows.length));
    const small = await walk(500, 1000);
    const multi = (small.pageInfo || []).filter((p) => p.n > 1);
    rec('ពិដាន byte ៖ p_max_bytes តូច ➜ ទំព័រច្រើនជួរ ≤ 65536 byte · doc ធំម្នាក់ឯងក៏ឆ្លងបាន · ស្មើទិន្នន័យពិត',
        !small.error && multi.every((p) => p.bytes <= 65536) && small.pageInfo.some((p) => p.n === 1 && p.bytes > 30000) && sameTree(small.tree, truth),
        small.error || (small.pageInfo || []).filter((p) => p.bytes > 65536));

    const reg1 = 'K' + String(10).padStart(5, '0');
    const unreadItem = 'item029';
    const goneItem = 'item028';
    const readItem = 'item000';
    let sawReadItem = false;
    const live = await walk(20, 2097152, async (n, page) => {
        if (n === 1) {
            await D.write(A.who, [{ k: 'set', p: [REG, reg1], v: null }]);
            await D.write(A.who, [{ k: 'set', p: [HIST, unreadItem, 'phone'], v: '099999999' }]);
            await D.write(A.who, [{ k: 'set', p: [HIST, 'itemNEW'], v: item('itemNEW') }]);
            await D.write(A.who, [{ k: 'set', p: [HIST, goneItem], v: null }]);
        }
        if (!sawReadItem && page.more && page.rows.some((x) => x.r === HIST && x.k === readItem)) {
            sawReadItem = true;
            await D.write(A.who, [{ k: 'set', p: [HIST, readItem, 'phone'], v: '088888888' }]);
        }
    });
    const after = await D.tree(A.id);
    rec('keyset ពេលហាងកំពុងសរសេរ ៖ លុប doc ដែលអានរួច · កែ doc មិនទាន់អាន · បន្ថែមថ្មី · លុប doc មិនទាន់អាន · កែ doc ដែលអានរួច ➜ ស្មើស្ថានភាពចុងក្រោយ',
        !live.error && sawReadItem && sameTree(live.tree, after) && !(live.tree[REG] || {})[reg1] && (live.tree[HIST] || {}).itemNEW
        && (live.tree[HIST] || {})[readItem] && live.tree[HIST][readItem].phone === '088888888', live.error || treeDiff(live.tree, after));
    rec('keyset ៖ ជួរកើនដាច់ខាតពេលមានការសរសេរ (គ្មានស្ទួន)', !live.error && live.order);

    const missing = await D.exportPage(D.SERVICE, '00000000-0000-4000-8000-000000000000', null, null, 10, 65536);
    rec('tenant មិនមាន ➜ tenant-not-found', H.raised(missing, 'tenant-not-found'), missing.error);
    const nul = await H.as(D.c, D.SERVICE, "select public.zoe_admin_export(null, 0, '', '', null, 10, 65536)");
    rec('tenant null ➜ tenant-not-found', H.raised(nul, 'tenant-not-found'), nul.error);

    const seen = [];
    let after1 = null, guard = 0, keysOk = true;
    for (;;) {
        const r = await H.as(D.c, D.SERVICE, 'select public.zoe_admin_tenants($1, 1) as r', [after1]);
        if (!r.rows) { seen.push('ERR'); break; }
        const page = r.rows[0].r;
        for (const t of page.tenants) {
            seen.push(t);
            if (JSON.stringify(Object.keys(t).sort()) !== JSON.stringify(['branch_code', 'docs', 'expires_at', 'id', 'name', 'revoked', 'seq'])) keysOk = false;
        }
        if (!page.more || ++guard > 500) break;
        after1 = page.next;
    }
    const allTenants = (await D.c.query('select id from public.tenants order by id')).rows.map((r) => r.id);
    const rowA = seen.find((t) => t && t.id === A.id);
    const docsA = (await D.c.query('select count(*)::int as n from public.zoe_docs where tenant_id = $1 and value is not null', [A.id])).rows[0].n;
    rec('zoe_admin_tenants ទំព័រ ១ ជួរ ➜ ឃើញហាងទាំងអស់ម្តងគត់ (' + allTenants.length + ')',
        JSON.stringify(seen.map((t) => t && t.id)) === JSON.stringify(allTenants), seen.length);
    rec('zoe_admin_tenants ៖ seq · docs (មិនរាប់ tombstone) ស្មើ DB · គ្មានវាលផ្សេង', keysOk && !!rowA && Number(rowA.seq) === await D.seq(A.id)
        && Number(rowA.docs) === docsA && rowA.branch_code === A.branch, rowA);
    const meta = (await D.c.query(`select p.provolatile, p.prosecdef, coalesce(p.proconfig, '{}') as cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'zoe_admin_export'`)).rows[0];
    rec('zoe_admin_export ៖ STABLE (snapshot តែមួយក្នុងមួយទំព័រ) · SECURITY DEFINER · search_path ទទេ',
        !!meta && meta.provolatile === 's' && meta.prosecdef === true && meta.cfg.some((x) => /^search_path=("")?$/.test(x)), meta);
}

// ── ខ. ខ្សែ CI ពេញ ៖ ci-config ➜ backup ➜ seal ➜ ស្កេន ➜ import ➜ backup ម្តងទៀត ────────────────────

function workflowLeakStep() {
    const wf = fs.existsSync(WORKFLOW) ? fs.readFileSync(WORKFLOW, 'utf8') : '';
    const at = wf.indexOf('- name: ផ្ទៀងផ្ទាត់ថាគ្មាន plaintext សល់');
    if (at === -1) return null;
    const runAt = wf.indexOf('run: |', at);
    const next = wf.indexOf('\n      - ', runAt);
    if (runAt === -1) return null;
    return wf.slice(runAt + 'run: |'.length, next === -1 ? undefined : next).split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n');
}

async function backupChain(rec, ctx, toolRoot) {
    const D = ctx.D;
    const rt = tmpDir('zoe-sbdata-rt-');
    try {
        const runDir = path.join(rt, 'zoe-backup');
        const targets = [{ type: 'supabase', name: 'sb-main', url: ctx.fake.url, secretKey: SECRET }];
        const cfg = await runNode(path.join(toolRoot, 'firebase-backup', 'ci-config.js'), [runDir], { env: { ZOE_BACKUP_TARGETS: JSON.stringify(targets) } });
        rec('ci-config ៖ target Supabase ➜ exit 0', cfg.code === 0, cfg.all.slice(-400));
        const config = fs.existsSync(path.join(runDir, 'config.json')) ? JSON.parse(fs.readFileSync(path.join(runDir, 'config.json'), 'utf8')) : null;
        const entry = config && (config.businesses || []).find((b) => b.name === 'sb-main');
        const keyFile = entry && entry.secretKeyPath ? path.join(runDir, entry.secretKeyPath) : '';
        rec('ci-config ៖ សោចុះ secrets/ (mode 0600) · config គ្មាន secret', !!entry && entry.type === 'supabase' && fs.existsSync(keyFile)
            && fs.readFileSync(keyFile, 'utf8').trim() === SECRET && (fs.statSync(keyFile).mode & 0o777) === 0o600
            && path.relative(path.join(runDir, 'secrets'), keyFile).indexOf('..') !== 0
            && !fs.readFileSync(path.join(runDir, 'config.json'), 'utf8').includes(SECRET), entry);

        let exportPages = 0;
        const A = ctx.shops.A;
        const run = ++ctx.chainRuns;
        const goneKey = 'K' + String(100 + run).padStart(5, '0');
        const liveItem = 'itemLIVE' + run;
        ctx.fake.setRpcHook(async (h) => {
            if (h.fn !== 'zoe_admin_export' || h.phase !== 'after' || !h.body || h.body.p_tenant !== A.id) return null;
            exportPages++;
            if (exportPages === 1) {
                await D.write(A.who, [{ k: 'set', p: [REG, goneKey], v: null }], ctx.side);
                await D.write(A.who, [{ k: 'set', p: [HIST, 'item029', 'phone'], v: '07777777' + run }], ctx.side);
                await D.write(A.who, [{ k: 'set', p: [HIST, liveItem], v: item(liveItem) }], ctx.side);
            }
            return null;
        });
        const b1 = await runNode(path.join(toolRoot, 'firebase-backup', 'backup.js'), [path.join(runDir, 'config.json')]);
        ctx.fake.setRpcHook(null);
        const truthA = await D.tree(A.id);
        rec('backup.js ៖ target Supabase ➜ exit 0', b1.code === 0, b1.all.slice(-600));
        const tenantDirs = fs.existsSync(path.join(runDir, 'backups', 'sb-main')) ? fs.readdirSync(path.join(runDir, 'backups', 'sb-main')).sort() : [];
        const allIds = (await D.c.query('select id from public.tenants order by id')).rows.map((r) => r.id).sort();
        rec('ថតមួយក្នុងមួយ target · ឯកសារមួយក្នុងមួយហាង (' + allIds.length + ' ហាង)', JSON.stringify(tenantDirs) === JSON.stringify(allIds)
            && tenantDirs.every((d) => fs.readdirSync(path.join(runDir, 'backups', 'sb-main', d)).filter((f) => /\.json\.gz$/.test(f)).length === 1), tenantDirs);
        const fileA = walkFiles(path.join(runDir, 'backups', 'sb-main', A.id)).find((f) => /\.json\.gz$/.test(f));
        const archive = fileA ? readArchive(fileA) : null;
        rec('archive ៖ format zoe-supabase-tenant v1 · manifest (tenant · ឈ្មោះ · សាខា · seq · exported_at)', !!archive && archive.format === 'zoe-supabase-tenant'
            && archive.version === 1 && archive.manifest && archive.manifest.tenant && archive.manifest.tenant.id === A.id
            && archive.manifest.tenant.branch_code === A.branch && archive.manifest.tenant.name === A.name
            && Number(archive.manifest.seq) === await D.seq(A.id) && !Number.isNaN(Date.parse(archive.manifest.exported_at)), archive && archive.manifest);
        rec('archive ៖ data (រូបរាង RTDB {root: {key: value}}) ស្មើស្ថានភាពចុងក្រោយរបស់ហាង A ពេលកំពុងសរសេរ (' + docCount(truthA) + ' doc · ' + exportPages + ' ទំព័រ)',
            !!archive && exportPages >= 2 && sameTree(archive.data, truthA) && !((archive.data[REG] || {})[goneKey]) && !!(archive.data[HIST] || {})[liveItem],
            archive ? treeDiff(archive.data, truthA) : 'គ្មាន archive');
        const hashes = (await D.c.query('select code_hash from public.tenant_invites union all select code_hash from public.member_reset_codes')).rows.map((r) => r.code_hash);
        const text = archive ? JSON.stringify(archive) : '';
        rec('archive គ្មាន hash កូដ · username · ពាក្យសម្ងាត់ · secret', !!archive && hashes.every((h) => !text.includes(h)) && !text.includes(A.username)
            && !/encrypted_password|code_hash|password/.test(text) && !text.includes(SECRET));
        rec('archive ៖ data ជារូបរាង canonical (គ្មាន null · គ្មាន object ទទេ · គ្មាន array)', !!archive && stable(archive.data) === stable(canon(archive.data)));

        const wrong = await runNode(path.join(toolRoot, 'firebase-backup', 'ci-config.js'), [path.join(rt, 'bad')],
            { env: { ZOE_BACKUP_TARGETS: JSON.stringify([{ type: 'supabase', name: 'pub', url: ctx.fake.url, secretKey: 'sb_publishable_' + 'x'.repeat(32) }]) } });
        const badUrl = await runNode(path.join(toolRoot, 'firebase-backup', 'ci-config.js'), [path.join(rt, 'bad2')],
            { env: { ZOE_BACKUP_TARGETS: JSON.stringify([{ type: 'supabase', name: 'plain', url: 'http://example.com', secretKey: SECRET }]) } });
        rec('ci-config ៖ publishable key ➜ បដិសេធ (backup ត្រូវការ secret key)', wrong.code !== 0 && !wrong.all.includes('sb_publishable_xxxx'), wrong.all.slice(-300));
        rec('ci-config ៖ URL http ក្រៅ loopback ➜ បដិសេធ (secret មិនធ្វើដំណើរលើ HTTP)', badUrl.code !== 0 && !badUrl.all.includes(SECRET), badUrl.all.slice(-300));

        const seal = await runNode(path.join(toolRoot, 'firebase-backup', 'crypt.js'), ['seal', path.join(runDir, 'backups')], { env: { ZOE_BACKUP_PASSPHRASE: PASSPHRASE } });
        const left = walkFiles(path.join(runDir, 'backups')).filter((f) => !/\.enc$/.test(f) && path.basename(f) !== '.zoe-backup.lock');
        rec('crypt.js seal ៖ គ្រប់ archive ហាង ➜ .enc · គ្មាន plaintext សល់', seal.code === 0 && left.length === 0
            && walkFiles(path.join(runDir, 'backups')).filter((f) => /\.enc$/.test(f)).length === allIds.length, { left, out: seal.all.slice(-300) });
        const step = workflowLeakStep();
        const summary = path.join(rt, 'summary.md');
        const scan = step ? await runBash(step, { RUNNER_TEMP: rt, GITHUB_STEP_SUMMARY: summary, RETENTION_DAYS: '30' }) : { code: null, all: 'រកជំហានមិនឃើញ' };
        rec('ជំហាន «ផ្ទៀងផ្ទាត់ថាគ្មាន plaintext សល់» ពិតរបស់ backup.yml ៖ archive Supabase ឆ្លង', scan.code === 0, scan.all.slice(-300));
        const stray = path.join(runDir, 'backups', 'sb-main', A.id, 'stray.json.gz');
        fs.writeFileSync(stray, zlib.gzipSync('{}'));
        const scanBad = step ? await runBash(step, { RUNNER_TEMP: rt, GITHUB_STEP_SUMMARY: summary, RETENTION_DAYS: '30' }) : { code: 0 };
        fs.unlinkSync(stray);
        rec('ទិសផ្ទុយ ៖ .json.gz សល់ក្នុងថតហាង ➜ ជំហានស្កេនធ្លាក់មុន upload', scanBad.code !== 0);

        const encA = walkFiles(path.join(runDir, 'backups', 'sb-main', A.id)).find((f) => /\.enc$/.test(f));
        const B = await D.tenant('ខ (គោលដៅស្តារ)', false);
        const imp = await runNode(path.join(toolRoot, 'tools', 'supabase-migrate', 'migrate.js'), [encA, '--tenant', B.id, '--apply'],
            { env: { ZOE_SUPABASE_URL: ctx.fake.url, ZOE_SUPABASE_SECRET_KEY: SECRET, ZOE_BACKUP_PASSPHRASE: PASSPHRASE } });
        const treeB = await D.tree(B.id);
        rec('migrate.js ៖ .enc របស់ហាង A ➜ ហាង B (--apply) ➜ exit 0 · VERIFIED', imp.code === 0 && /VERIFIED/.test(imp.out), imp.all.slice(-600));
        rec('ហាង B ស្មើ archive របស់ហាង A បេះបិទ', !!archive && sameTree(treeB, archive.data), archive ? treeDiff(treeB, archive.data) : null);

        const again = await runNode(path.join(toolRoot, 'tools', 'supabase-migrate', 'migrate.js'), [encA, '--tenant', B.id, '--apply'],
            { env: { ZOE_SUPABASE_URL: ctx.fake.url, ZOE_SUPABASE_SECRET_KEY: SECRET, ZOE_BACKUP_PASSPHRASE: PASSPHRASE } });
        const writesAgain = ctx.fake.requests.filter((q) => /zoe_admin_write$/.test(q.path) && q.body && q.body.p_tenant === B.id).length;
        rec('រត់ម្តងទៀត (idempotent) ៖ exit 0 · គ្មានការសរសេរថ្មី · seq ដដែល', again.code === 0 && /Nothing to write/.test(again.out)
            && writesAgain === ctx.fake.requests.filter((q) => /zoe_admin_write$/.test(q.path) && q.body && q.body.p_tenant === B.id).length, again.all.slice(-300));

        const runDir2 = path.join(rt, 'zoe-backup2');
        await runNode(path.join(toolRoot, 'firebase-backup', 'ci-config.js'), [runDir2], { env: { ZOE_BACKUP_TARGETS: JSON.stringify(targets) } });
        const b2 = await runNode(path.join(toolRoot, 'firebase-backup', 'backup.js'), [path.join(runDir2, 'config.json')]);
        const fileB = walkFiles(path.join(runDir2, 'backups', 'sb-main', B.id)).find((f) => /\.json\.gz$/.test(f));
        const archiveB = fileB ? readArchive(fileB) : null;
        rec('backup ម្តងទៀត ៖ archive ហាង B (export ➜ seal ➜ open ➜ import ➜ export) ស្មើ archive ហាង A', b2.code === 0 && !!archiveB && !!archive
            && sameTree(archiveB.data, archive.data), archiveB && archive ? treeDiff(archiveB.data, archive.data) : b2.all.slice(-300));

        const leaks = walkFiles(rt).filter((f) => f !== keyFile && !/[/\\]secrets[/\\]/.test(f)).filter((f) => {
            let buf = fs.readFileSync(f);
            try { if (/\.json\.gz$/.test(f)) buf = zlib.gunzipSync(buf); } catch (e) {}
            return buf.includes(SECRET);
        });
        rec('secret key មិនលេចក្នុងឯកសារណាមួយក្រៅ secrets/ (config · archive · .enc · summary)', leaks.length === 0, leaks);
        return { archive, A, B };
    } finally {
        ctx.fake.setRpcHook(null);
        fs.rmSync(rt, { recursive: true, force: true });
    }
}

async function backupFailures(rec, ctx, toolRoot) {
    const rt = tmpDir('zoe-sbdata-fail-');
    try {
        const runDir = path.join(rt, 'zoe-backup');
        const wrongKey = 'sb_secret_' + crypto.randomBytes(20).toString('hex');
        const targets = [{ type: 'supabase', name: 'sb-wrong', url: ctx.fake.url, secretKey: wrongKey },
            { type: 'supabase', name: 'sb-good', url: ctx.fake.url, secretKey: SECRET }];
        await runNode(path.join(toolRoot, 'firebase-backup', 'ci-config.js'), [runDir], { env: { ZOE_BACKUP_TARGETS: JSON.stringify(targets) } });
        const cfgPath = path.join(runDir, 'config.json');
        if (fs.existsSync(cfgPath)) {
            const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            cfg.requestTimeoutMs = 1500;
            cfg.retryCount = 1;
            cfg.retryDelayMs = 100;
            fs.writeFileSync(cfgPath, JSON.stringify(cfg));
        }
        const C = ctx.shops.C;
        ctx.fake.setRpcHook(async (h) => (h.fn === 'zoe_admin_export' && h.phase === 'before' && h.body && h.body.p_tenant === C.id ? 'hang' : null));
        const t0 = Date.now();
        const r = await runNode(path.join(toolRoot, 'firebase-backup', 'backup.js'), [cfgPath], { timeoutMs: 90000 });
        ctx.fake.setRpcHook(null);
        const good = path.join(runDir, 'backups', 'sb-good');
        const goodIds = fs.existsSync(good) ? fs.readdirSync(good) : [];
        rec('target មួយធ្លាក់ (secret key ខុស ➜ 401) មិនបញ្ឈប់ target ផ្សេង · ហាងព្យួរ ➜ ធ្លាក់តែហាងនោះ · exit ≠ 0',
            r.code !== 0 && /sb-wrong/.test(r.err) && goodIds.includes(ctx.shops.A.id) && !goodIds.includes(C.id), { code: r.code, goodIds, tail: r.all.slice(-500) });
        rec('ហាងដែល export ព្យួរ ➜ ពិដានបញ្ចប់ (requestTimeoutMs × ២ + ពេលសល់ < ៣០ វិ.)', !r.timedOut && Date.now() - t0 < 30000, Date.now() - t0);
        const wrongCalls = ctx.fake.requests.filter((q) => q.keyHash === keyHash(wrongKey)).length;
        rec('secret key ខុស (401) ➜ សំណើតែ ១ (មិន retry ឥតប្រយោជន៍) · មិនបោះពុម្ពសោ', wrongCalls === 1 && !r.all.includes(wrongKey), wrongCalls);
    } finally {
        ctx.fake.setRpcHook(null);
        fs.rmSync(rt, { recursive: true, force: true });
    }
}

// ── គ. CLI ផ្ទេរ ───────────────────────────────────────────────────────────────────────────

function firebaseExport(tag) {
    const fb = {};
    fb[HIST] = {};
    for (let i = 0; i < 12; i++) {
        fb[HIST][tag + 'h' + i] = item(tag + 'h' + i, { barcodes: [{ code: 'ZTA' + i, cod: 5.5, dod: 0, isClosed: false, createdAt: 1790000000000 },
            { code: 'ZTB' + i, cod: 0, dod: 1.25, isClosed: true, closedAt: 1790000500000, createdAt: 1790000000000 }], cod: 5.5, dod: 1.25, price: 6.75, count: 2 });
    }
    fb[TRASH] = { [tag + 't1']: Object.assign(item(tag + 't1'), { deletedAt: 1790000001000, trashReason: 'remove', isFromDeletion: false }) };
    fb[REG] = {};
    for (let i = 0; i < 230; i++) fb[REG][tag + 'R' + i] = true;
    fb[DAILY] = { '2026-09-30': { codDollar: 120.75, dodDollar: 9.5, totalCount: 14 } };
    fb[MONTHLY] = { '2026-09': { codDollar: 120.75, dodDollar: 9.5, totalCount: 14 } };
    fb[PICKUP] = { '2026-09-30': { packagesPickedUp: 2, pickedUpBarcodes: { ZTB0: '012345678', ZTB1: '012345679' }, pickedUpPhones: { '012345678': 1, '012345679': 1 } } };
    fb[SETTINGS] = { exchange_rate: 4050 };
    return fb;
}

function writesFor(ctx, tenant, since) {
    return ctx.fake.requests.slice(since || 0).filter((q) => q.path === '/rest/v1/rpc/zoe_admin_write' && q.body && q.body.p_tenant === tenant);
}

async function cliScenarios(rec, ctx, toolRoot, only) {
    const D = ctx.D;
    const cli = path.join(toolRoot, 'tools', 'supabase-migrate', 'migrate.js');
    const dir = tmpDir('zoe-sbdata-cli-');
    const want = (name) => !only || only === name;
    const env = { ZOE_SUPABASE_URL: ctx.fake.url, ZOE_SUPABASE_SECRET_KEY: SECRET };
    try {
        const fb = firebaseExport('f');
        const fbJson = path.join(dir, 'firebase-export.json');
        fs.writeFileSync(fbJson, JSON.stringify(fb, null, 2));
        const fbGz = path.join(dir, 'firebase-dump.json.gz');
        fs.writeFileSync(fbGz, zlib.gzipSync(JSON.stringify(fb)));
        const fbEnc = path.join(dir, 'firebase-dump.json.gz.enc');
        if (fs.existsSync(path.join(toolRoot, 'firebase-backup', 'crypt.js'))) {
            fs.writeFileSync(fbEnc, require(path.join(toolRoot, 'firebase-backup', 'crypt.js')).encryptBuffer(zlib.gzipSync(JSON.stringify(fb)), PASSPHRASE));
        }

        if (want('dry')) {
            const T = await D.tenant('dry-run', false);
            const mark = ctx.fake.requests.length;
            const r = await runNode(cli, [fbJson, '--tenant', T.id], { env });
            rec('dry-run (លំនាំដើម) ៖ exit 0 · DRY-RUN · រាយ root · គ្មាន zoe_admin_write · seq 0', r.code === 0 && /DRY-RUN/.test(r.out)
                && r.out.includes(REG) && r.out.includes(HIST) && writesFor(ctx, T.id, mark).length === 0 && await D.seq(T.id) === 0, r.all.slice(-500));
            const off = await runNode(cli, [fbJson], { env: {} });
            rec('dry-run គ្មាន credential ៖ ដើរក្រៅបណ្តាញ · exit 0', off.code === 0 && /DRY-RUN/.test(off.out), off.all.slice(-300));
        }

        if (want('formats')) {
            for (const [label, file, extra] of [['.json', fbJson, {}], ['.json.gz', fbGz, {}], ['.json.gz.enc (firebase-backup)', fbEnc, { ZOE_BACKUP_PASSPHRASE: PASSPHRASE }]]) {
                const T = await D.tenant('fb ' + label, false);
                const r = await runNode(cli, [file, '--tenant', T.id, '--apply', '--batch-ops', '50'], { env: Object.assign({}, env, extra) });
                const t = await D.tree(T.id);
                rec('Firebase ' + label + ' ➜ --apply ➜ exit 0 · VERIFIED · ហាងស្មើ export (array ➜ object តាម index)', r.code === 0 && /VERIFIED/.test(r.out) && sameTree(t, fb),
                    r.code === 0 ? treeDiff(t, fb) : r.all.slice(-500));
                if (label === '.json.gz') {
                    const special = path.join(dir, 'firebase-special-keys.json');
                    fs.writeFileSync(special, '{"' + REG + '": {"__proto__": true, "constructor": true, "toString": true}, "' + SETTINGS + '": {"exchange_rate": 4100}}');
                    const S = await D.tenant('កូនសោពិសេស', false);
                    const rs = await runNode(cli, [special, '--tenant', S.id, '--apply'], { env });
                    const keys = Object.keys((await D.tree(S.id))[REG] || {}).sort();
                    rec('កូនសោ __proto__ · constructor · toString (RTDB អនុញ្ញាត) ➜ នាំចូលត្រឹមត្រូវ (គ្មាន prototype pollution)', rs.code === 0 && /VERIFIED/.test(rs.out)
                        && JSON.stringify(keys) === JSON.stringify(['__proto__', 'constructor', 'toString']), { keys, tail: rs.all.slice(-300) });
                }
                if (label === '.json') {
                    const ws = writesFor(ctx, T.id);
                    const docs = docCount(fb);
                    rec('ការសរសេរជាបាច់ ៖ --batch-ops 50 ➜ ' + Math.ceil(docs / 50) + ' ដង · ≤ 50 op · p_replace false ជានិច្ច · op id ត្រឹមត្រូវ',
                        ws.length === Math.ceil(docs / 50) && ws.every((q) => Array.isArray(q.body.p_ops) && q.body.p_ops.length <= 50 && q.body.p_replace === false
                            && /^[A-Za-z0-9_-]{16,64}$/.test(q.body.p_op_id)), ws.map((q) => [q.body.p_ops && q.body.p_ops.length, q.body.p_replace]));
                }
            }
        }

        if (want('lost')) {
            const T = await D.tenant('ចម្លើយបាត់', false);
            let dropped = 0;
            ctx.fake.setRpcHook(async (h) => (h.fn === 'zoe_admin_write' && h.phase === 'after' && h.body && h.body.p_tenant === T.id && dropped++ === 0 ? 'drop' : null));
            const r = await runNode(cli, [fbJson, '--tenant', T.id, '--apply', '--batch-ops', '100', '--retry-delay-ms', '50'], { env });
            ctx.fake.setRpcHook(null);
            const ws = writesFor(ctx, T.id);
            const batches = Math.ceil(docCount(fb) / 100);
            rec('ចម្លើយបាត់ក្រោយ commit ➜ retry ដោយ op id ដដែល (' + (ws.length >= 2 ? ws[0].body.p_op_id === ws[1].body.p_op_id : '-') + ')',
                ws.length === batches + 1 && ws[0].body.p_op_id === ws[1].body.p_op_id, ws.map((q) => q.body.p_op_id));
            rec('ចម្លើយបាត់ ➜ មិនអនុវត្ត ២ ដង (zoe_ops = ' + batches + ' បាច់) · ហាងស្មើ export · exit 0', r.code === 0 && await D.opsCount(T.id) === batches
                && sameTree(await D.tree(T.id), fb), r.all.slice(-400));
            const fb2 = JSON.parse(JSON.stringify(fb));
            fb2[HIST].fh0.phone = '011111111';
            const fb2File = path.join(dir, 'firebase-export-2.json');
            fs.writeFileSync(fb2File, JSON.stringify(fb2));
            const r2 = await runNode(cli, [fb2File, '--tenant', T.id, '--apply', '--replace', '--batch-ops', '100', '--retry-delay-ms', '50'], { env });
            rec('op id ដេរីវេពីខ្លឹមសារ ៖ ការនាំចូលលើកទី ២ ដែលប្រែ doc ១ មិនត្រូវ replay លទ្ធផលចាស់ ➜ VERIFIED', r2.code === 0 && /VERIFIED/.test(r2.out)
                && sameTree(await D.tree(T.id), fb2), r2.all.slice(-400));
        }

        if (want('hang')) {
            const T = await D.tenant('ព្យួរម្តង', false);
            let hung = 0;
            ctx.fake.setRpcHook(async (h) => (h.fn === 'zoe_admin_write' && h.phase === 'before' && h.body && h.body.p_tenant === T.id && hung++ === 0 ? 'hang' : null));
            const t0 = Date.now();
            const r = await runNode(cli, [fbJson, '--tenant', T.id, '--apply', '--timeout-ms', '1500', '--retries', '2', '--retry-delay-ms', '50'], { env, timeoutMs: 30000 });
            ctx.fake.setRpcHook(null);
            rec('សំណើព្យួរម្តង ➜ ពិដាន ១.៥ វិ. បញ្ចប់ ➜ retry ➜ exit 0 · ហាងស្មើ export', r.code === 0 && Date.now() - t0 >= 1500 && sameTree(await D.tree(T.id), fb),
                { ms: Date.now() - t0, tail: r.all.slice(-300) });
            const T2 = await D.tenant('ព្យួរជានិច្ច', false);
            ctx.fake.setRpcHook(async (h) => (h.fn === 'zoe_admin_write' && h.phase === 'before' && h.body && h.body.p_tenant === T2.id ? 'hang' : null));
            const t1 = Date.now();
            const r2 = await runNode(cli, [fbJson, '--tenant', T2.id, '--apply', '--timeout-ms', '800', '--retries', '1', '--retry-delay-ms', '50'], { env, timeoutMs: 30000 });
            ctx.fake.setRpcHook(null);
            rec('ព្យួរជានិច្ច ➜ exit ≠ 0 ក្នុងពិដាន (< ១៥ វិ.) · សារ timed out', !r2.timedOut && r2.code !== 0 && r2.code !== null && Date.now() - t1 < 15000 && /timed out/i.test(r2.all),
                { ms: Date.now() - t1, tail: r2.all.slice(-300) });
            const T3 = await D.tenant('503', false);
            let busy = 0;
            ctx.fake.setRpcHook(async (h) => (h.fn === 'zoe_admin_write' && h.phase === 'before' && h.body && h.body.p_tenant === T3.id && busy++ === 0
                ? { status: 503, body: { message: 'upstream busy' } } : null));
            const r3 = await runNode(cli, [fbJson, '--tenant', T3.id, '--apply', '--retry-delay-ms', '50'], { env });
            ctx.fake.setRpcHook(null);
            rec('503 ម្តង ➜ retry ➜ exit 0', r3.code === 0 && sameTree(await D.tree(T3.id), fb), r3.all.slice(-300));
        }

        if (want('auth')) {
            const T = await D.tenant('សោខុស', false);
            const wrongKey = 'sb_secret_' + crypto.randomBytes(20).toString('hex');
            const r = await runNode(cli, [fbJson, '--tenant', T.id, '--apply', '--retry-delay-ms', '50'], { env: { ZOE_SUPABASE_URL: ctx.fake.url, ZOE_SUPABASE_SECRET_KEY: wrongKey } });
            const calls = ctx.fake.requests.filter((q) => q.keyHash === keyHash(wrongKey)).length;
            rec('secret key ខុស (401) ➜ exit ≠ 0 · មិន retry (សំណើ ' + calls + ') · មិនបោះពុម្ពសោ', r.code !== 0 && calls === 1 && await D.seq(T.id) === 0 && !r.all.includes(wrongKey), r.all.slice(-300));
            const pubKey = 'sb_publishable_' + crypto.randomBytes(16).toString('hex');
            const pub = await runNode(cli, [fbJson, '--tenant', T.id, '--apply'], { env: { ZOE_SUPABASE_URL: ctx.fake.url, ZOE_SUPABASE_SECRET_KEY: pubKey } });
            rec('publishable key ➜ បដិសេធមុនបណ្តាញ (សំណើ ០) · មិនបោះពុម្ពសោ', pub.code !== 0 && ctx.fake.requests.filter((q) => q.keyHash === keyHash(pubKey)).length === 0
                && !pub.all.includes(pubKey), pub.all.slice(-300));
            const arg = await runNode(cli, [fbJson, '--tenant', T.id, '--url', ctx.fake.url, '--secret-key', SECRET], { env: {} });
            rec('--secret-key លើបន្ទាត់បញ្ជា ៖ ដំណើរការ ហើយមិនបោះពុម្ពវា', arg.code === 0 && !arg.all.includes(SECRET), arg.all.slice(-300));
            const unknown = await runNode(cli, [fbJson, '--tenant', '00000000-0000-4000-8000-0000000000aa', '--apply'], { env });
            rec('tenant មិនមាន ➜ exit ≠ 0 · គ្មានការសរសេរ', unknown.code !== 0 && /not found/i.test(unknown.all), unknown.all.slice(-300));
        }

        if (want('refuse')) {
            const T = await D.tenant('មានទិន្នន័យ', false);
            await D.admin(T.id, [{ k: 'set', p: [REG, 'OTHER_SHOP_KEY'], v: true }, { k: 'set', p: [HIST, 'other1'], v: item('other1') }]);
            const before = await D.seq(T.id);
            const mark = ctx.fake.requests.length;
            const r = await runNode(cli, [fbJson, '--tenant', T.id, '--apply'], { env });
            rec('ហាងមានទិន្នន័យដែលមិននៅក្នុង input ➜ REFUSED · exit ≠ 0 · គ្មានការសរសេរ', r.code !== 0 && /REFUSED/.test(r.all)
                && writesFor(ctx, T.id, mark).length === 0 && await D.seq(T.id) === before, r.all.slice(-400));
            const mark2 = ctx.fake.requests.length;
            const rep = await runNode(cli, [fbJson, '--tenant', T.id, '--apply', '--replace'], { env });
            const t = await D.tree(T.id);
            rec('--replace ៖ ហាងស្មើ input បេះបិទ (doc ចាស់ OTHER_SHOP_KEY · other1 ត្រូវលុប) · exit 0 · VERIFIED', rep.code === 0 && /VERIFIED/.test(rep.out)
                && sameTree(t, fb) && !(t[REG] || {}).OTHER_SHOP_KEY, rep.code === 0 ? treeDiff(t, fb) : rep.all.slice(-400));
            rec('--replace មិនប្រើ p_replace (លុបហាងទាំងមូល) ៖ គ្រប់សំណើ p_replace false', writesFor(ctx, T.id, mark2).length > 0
                && writesFor(ctx, T.id, mark2).every((q) => q.body.p_replace === false));
        }

        if (want('foreign')) {
            const T = await D.tenant('ឧបករណ៍ផ្សេងសរសេរ', true);
            let fired = 0;
            ctx.fake.setRpcHook(async (h) => {
                if (h.fn !== 'zoe_admin_write' || h.phase !== 'after' || !h.body || h.body.p_tenant !== T.id || fired++ > 0) return null;
                await D.write(T.who, [{ k: 'set', p: [REG, 'DEVICE_WROTE'], v: true }], ctx.side);
                return null;
            });
            const r = await runNode(cli, [fbJson, '--tenant', T.id, '--apply', '--batch-ops', '100'], { env });
            ctx.fake.setRpcHook(null);
            rec('ឧបករណ៍ផ្សេងសរសេរចំពេលផ្ទេរ ➜ exit ≠ 0 · CHANGED BY OTHERS · មិនរាយ VERIFIED', r.code !== 0 && /CHANGED BY OTHERS/.test(r.all) && !/VERIFIED/.test(r.out), r.all.slice(-400));
        }

        if (want('invalid')) {
            const bad = firebaseExport('x');
            bad[HIST].brokenPrimitive = 'oops';
            bad.zoew_unknown_root = { a: { b: 1 } };
            bad[DAILY]['2026-09-29'] = 5;
            bad[TRASH].xt1.hacker = 1;
            const badFile = path.join(dir, 'firebase-bad.json');
            fs.writeFileSync(badFile, JSON.stringify(bad));
            const T = await D.tenant('record ខូច', false);
            const dry = await runNode(cli, [badFile, '--tenant', T.id], { env });
            rec('record ដែល App អានមិនបាន ៖ primitive ក្រោម $itemId · root មិនស្គាល់ · primitive ក្រោម $date ➜ [ERROR] ៣ · វាលមិនស្គាល់ ➜ [WARN] · exit ≠ 0',
                dry.code !== 0 && /\[ERROR\][^\n]*brokenPrimitive/.test(dry.all) && /\[ERROR\][^\n]*zoew_unknown_root/.test(dry.all)
                && /\[ERROR\][^\n]*2026-09-29/.test(dry.all) && /\[WARN\][^\n]*xt1/.test(dry.all), dry.all.slice(-700));
            const mark = ctx.fake.requests.length;
            const ap = await runNode(cli, [badFile, '--tenant', T.id, '--apply'], { env });
            rec('--apply ដោយមាន [ERROR] ➜ បដិសេធ · គ្មានការសរសេរ', ap.code !== 0 && writesFor(ctx, T.id, mark).length === 0 && await D.seq(T.id) === 0, ap.all.slice(-300));
            const sk = await runNode(cli, [badFile, '--tenant', T.id, '--apply', '--skip-invalid'], { env });
            const t = await D.tree(T.id);
            rec('--skip-invalid ៖ នាំចូលតែ record ល្អ · ទុក record ខូចចោល (រាយ) · exit 0', sk.code === 0 && /VERIFIED/.test(sk.out) && !(t[HIST] || {}).brokenPrimitive
                && !t.zoew_unknown_root && !(t[DAILY] || {})['2026-09-29'] && !!(t[TRASH] || {}).xt1 && !!(t[HIST] || {}).xh0, sk.all.slice(-400));
            const hist = Object.values(t[HIST] || {});
            rec('ក្រោយនាំចូល ៖ គ្រប់ record ក្រោម history ជា object (rawSnapshotToItemList អានបានទាំងអស់)', hist.length === 12 && hist.every((v) => v && typeof v === 'object' && !Array.isArray(v)));
        }
    } finally {
        ctx.fake.setRpcHook(null);
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// ── ង. mutation ─────────────────────────────────────────────────────────────────────────

const SQL_MUTATIONS = [
    ['export មិនត្រង tenant', 'where z.tenant_id = p_tenant and z.seq >= after_seq', 'where z.seq >= after_seq'],
    ['export មិនផ្ញើ tombstone ក្រោយចាប់ផ្តើម', 'and (z.value is not null or z.seq > threshold)', 'and z.value is not null'],
    ['export ផ្ញើ tombstone ចាស់ទាំងអស់', 'and (z.value is not null or z.seq > threshold)', 'and true'],
    ['keyset >= (ស្ទួនត្រង់ព្រំទំព័រ)', '(z.seq, z.root collate "C", z.key collate "C") > (after_seq, after_root collate "C", after_key collate "C")',
        '(z.seq, z.root collate "C", z.key collate "C") >= (after_seq, after_root collate "C", after_key collate "C")'],
    ['គ្មានពិដាន byte', 'where p.rn <= lim and (p.rn = 1 or p.running <= max_bytes)', 'where p.rn <= lim'],
    ['គ្មានពិដានជួរ', 'lim integer := least(greatest(coalesce(p_limit, 500), 1), 2000);', 'lim integer := greatest(coalesce(p_limit, 500), 1);'],
    ['export ជា VOLATILE', "    p_max_bytes integer default 2097152\n)\nreturns jsonb\nlanguage plpgsql stable",
        "    p_max_bytes integer default 2097152\n)\nreturns jsonb\nlanguage plpgsql volatile"],
    ['zoe_admin_export ឲ្យ authenticated', 'grant execute on function public.zoe_admin_export(uuid, bigint, text, text, bigint, integer, integer) to service_role;',
        'grant execute on function public.zoe_admin_export(uuid, bigint, text, text, bigint, integer, integer) to service_role, authenticated;'],
    ['tenants រាប់ tombstone ជា doc', "(select count(*) from public.zoe_docs z where z.tenant_id = tn.id and z.value is not null)",
        '(select count(*) from public.zoe_docs z where z.tenant_id = tn.id)']
];

const JS_MUTATIONS = [
    { name: 'op id ដេរីវេពីលេខបាច់ (មិនមែនខ្លឹមសារ)', file: 'tools/supabase-migrate/migrate.js', from: ".update(tenantId + '\\n' + stableJson(ops))",
        to: ".update(tenantId + '\\n' + index)", run: 'lost' },
    { name: 'CLI រំលងការផ្ទៀងផ្ទាត់ក្រោយសរសេរ', file: 'tools/supabase-migrate/migrate.js', from: 'const verdict = verifyTenant(', to: 'const verdict = { equal: true, roots: [] } || verifyTenant(', run: 'foreign' },
    { name: 'CLI មិនរាប់ការសរសេររបស់អ្នកដទៃ', file: 'tools/supabase-migrate/migrate.js', from: 'const foreign = foreignWrites(', to: 'const foreign = 0 && foreignWrites(', run: 'foreign' },
    { name: 'CLI មិនបដិសេធហាងមានទិន្នន័យ', file: 'tools/supabase-migrate/migrate.js', from: 'if (plan.extra.length && !opts.replace)', to: 'if (false)', run: 'refuse' },
    { name: 'CLI ប្រើ p_replace ពេល --replace', file: 'tools/supabase-migrate/migrate.js', from: 'p_replace: false', to: 'p_replace: !!opts.replace', run: 'refuse' },
    { name: 'CLI មិនរាយ primitive ដែល rules រំពឹង object', file: 'tools/supabase-migrate/migrate.js', from: 'if (expectsObject(node)) problems.push(', to: 'if (false) problems.push(', run: 'invalid' },
    { name: 'CLI បោះពុម្ព secret', file: 'tools/supabase-migrate/migrate.js', from: "say('Target : ' + target.url", to: "say('Target : ' + target.url + ' ' + target.key", run: 'auth' },
    { name: 'RPC មិន abort សំណើដែលផុតពិដាន', file: 'firebase-backup/supabase.js', from: 'clearTimeout(timer);\n            controller.abort();', to: 'clearTimeout(timer);', run: 'hang' },
    { name: 'retry លើ 401', file: 'firebase-backup/supabase.js', from: 'const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);',
        to: 'const RETRYABLE_STATUS = new Set([401, 408, 425, 429, 500, 502, 503, 504]);', run: 'auth' },
    { name: 'export មិនលុប doc ដែលមាន tombstone', file: 'firebase-backup/supabase.js', from: 'delete bucket[row.k];', to: '', run: 'chain' },
    { name: 'export មិនបញ្ជូន tombstones_after', file: 'firebase-backup/supabase.js', from: 'p_tombstones_after: threshold', to: 'p_tombstones_after: null', run: 'chain' },
    { name: 'ci-config សរសេរសោដោយ mode លំនាំដើម', file: 'firebase-backup/ci-config.js', from: "fs.writeFileSync(keyPath, key + '\\n', { mode: 0o600 });",
        to: "fs.writeFileSync(keyPath, key + '\\n');", run: 'chain' },
    { name: 'backup ដាក់ហាងទាំងអស់ក្នុងថតតែមួយ', file: 'firebase-backup/backup.js', from: 'path.join(outDir, tenant.id)', to: 'outDir', run: 'chain' }
];

async function makeEnv(sql, opts) {
    const o = opts || {};
    const { c, name } = await H.freshDb('default-grants');
    c.on('error', () => {});
    const env = { c, name, D: null, pool: null, side: null, fake: null, shops: {}, chainRuns: 0, applied: false };
    env.close = async () => {
        if (env.fake) try { await env.fake.close(); } catch (e) {}
        if (env.pool) try { await env.pool.end(); } catch (e) {}
        if (env.side) try { await env.side.end(); } catch (e) {}
        try { await c.end(); } catch (e) {}
    };
    try {
        await c.query(sql);
    } catch (e) {
        await env.close();
        throw Object.assign(new Error('sql: ' + e.message), { stage: 'sql' });
    }
    env.applied = true;
    try {
        await setupEnv(env, o);
    } catch (e) {
        await env.close();
        throw e;
    }
    return env;
}

async function setupEnv(env, o) {
    const c = env.c, name = env.name;
    env.D = dbApi(c);
    await env.D.init();
    if (o.fake) {
        env.pool = new H.PG.Pool({ host: '127.0.0.1', port: c.connectionParameters.port, user: 'postgres', database: name, max: 6 });
        env.pool.on('error', () => {});
        env.side = await H.connect('postgres', name);
        env.side.on('error', () => {});
        env.fake = await require('./supabase-fake-server.js').startFakeSupabase({ pool: env.pool, secretKey: SECRET });
        env.D.side = env.side;
    }
    if (o.shops) {
        const A = await env.D.tenant('ក (ប្រភព backup)', true);
        await seedShop(env.D, A, { registry: 2300, items: 30, big: 2, tombstones: 3 });
        const C = await env.D.tenant('គ (ព្យួរ)', false);
        await env.D.admin(C.id, [{ k: 'set', p: [REG, 'C1'], v: true }]);
        env.shops = { A, C };
    }
}

async function pool(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const k = next++;
            out[k] = await fn(items[k], k);
        }
    }));
    return out;
}
const JOBS = (() => {
    const asked = parseInt(process.env.SBDATA_JOBS || '', 10);
    if (Number.isFinite(asked) && asked >= 1) return Math.min(asked, 8);
    return Math.min(3, Math.max(1, os.cpus().length - 1));
})();

async function sqlMutationRound() {
    section('ង១. mutation លើ migration ពិត (RPC export) ➜ សេណារីយ៉ូ ក ត្រូវក្រហម');
    const results = await pool(SQL_MUTATIONS, JOBS, async ([label, from, to]) => {
        const hits = migrationSql.split(from).length - 1;
        if (hits !== 1) return { hits, applied: false, red: 0 };
        let env = null, red = 0, applied = false;
        try {
            env = await makeEnv(migrationSql.replace(from, () => to), {});
            applied = true;
            await rpcScenario((l, cond) => { if (!cond) red++; }, env.D);
        } catch (e) {
            if (e && e.stage !== 'sql') { applied = true; red++; }
        } finally {
            if (env) await env.close();
        }
        return { hits, applied, red };
    });
    SQL_MUTATIONS.forEach(([label], i) => {
        const r = results[i];
        if (r.hits !== 1) ok('mutation SQL «' + label + '» ៖ anchor លេចម្តងគត់ (ឃើញ ' + r.hits + ')', false);
        else ok('mutation SQL «' + label + '» ➜ ' + (r.applied ? 'ក្រហម (' + r.red + ')' : 'SQL អនុវត្តមិនបាន (មិនរាប់)'), r.applied && r.red > 0);
    });
}

async function jsMutationRound() {
    section('ង២. mutation លើ tool ពិត (ច្បាប់ចម្លង · DB និងម៉ាស៊ីនមេដាច់ពីគ្នា) ➜ សេណារីយ៉ូត្រូវក្រហម');
    const results = await pool(JS_MUTATIONS, JOBS, async (mut) => {
        const base = tmpDir('zoe-sbdata-mut-');
        let env = null, applied = false, red = 0;
        try {
            for (const rel of TOOL_FILES) {
                fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true });
                fs.copyFileSync(path.join(ROOT, rel), path.join(base, rel));
            }
            const file = path.join(base, mut.file);
            const src = fs.readFileSync(file, 'utf8');
            if (src.split(mut.from).length - 1 !== 1) return { applied: false, red: 0 };
            fs.writeFileSync(file, src.replace(mut.from, () => mut.to));
            applied = true;
            env = await makeEnv(migrationSql, { fake: true, shops: mut.run === 'chain' });
            const silent = (l, cond) => { if (!cond) red++; };
            if (mut.run === 'chain') await backupChain(silent, env, base);
            else await cliScenarios(silent, env, base, mut.run);
        } catch (e) {
            red++;
        } finally {
            if (env) await env.close();
            fs.rmSync(base, { recursive: true, force: true });
        }
        return { applied, red };
    });
    JS_MUTATIONS.forEach((mut, i) => {
        const r = results[i];
        ok('mutation «' + mut.name + '» (' + mut.file + ') ➜ ' + (r.applied ? 'ក្រហម (' + r.red + ')' : 'anchor មិនលេចម្តងគត់'), r.applied && r.red > 0);
    });
}

async function main() {
    const t0 = Date.now();
    await H.start();
    console.log('  (Postgres ' + H.pgBin.version.replace(/^postgres \(PostgreSQL\) /, '') + ' · ' + (Date.now() - t0) + 'ms)');
    let env = null;
    try {
        try {
            env = await makeEnv(migrationSql, { fake: true });
        } catch (e) {
            ok('migration ពិតអនុវត្តបាន · harness ចាប់ផ្តើមបាន', false, String(e && e.message || e));
            return;
        }
        ok('migration ពិតអនុវត្តបាន (' + migrationFiles.length + ')', true);

        section('ក. RPC zoe_admin_tenants · zoe_admin_export');
        await rpcScenario(ok, env.D);

        const A = await env.D.tenant('ក (ប្រភព backup)', true);
        await seedShop(env.D, A, { registry: 2300, items: 30, big: 2, tombstones: 3 });
        const C = await env.D.tenant('គ (ព្យួរ)', false);
        await env.D.admin(C.id, [{ k: 'set', p: [REG, 'C1'], v: true }]);
        env.shops = { A, C };

        section('ខ. ខ្សែ CI ៖ ci-config ➜ backup.js ➜ crypt seal ➜ ស្កេន plaintext ➜ migrate.js ➜ backup ម្តងទៀត');
        await backupChain(ok, env, ROOT);
        await backupFailures(ok, env, ROOT);

        section('គ. CLI ផ្ទេរ (tools/supabase-migrate/migrate.js)');
        await cliScenarios(ok, env, ROOT);

        section('ឃ. secret key');
        const leaked = outputs.filter((o) => o.includes(SECRET));
        ok('secret key មិនលេចក្នុង stdout/stderr នៃការរត់ឧបករណ៍ទាំង ' + outputs.length, outputs.length >= 20 && leaked.length === 0, leaked.map((o) => o.slice(0, 200)));
        await env.close();
        env = null;

        if (process.env.SBDATA_MUTATIONS !== '0') {
            await sqlMutationRound();
            await jsMutationRound();
        }
    } finally {
        if (env) await env.close();
        finish();
    }
}
