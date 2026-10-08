// ថ្នាក់ ៖ **adapter `fb` របស់ ZoeW លើ Supabase (`src/services/supabase-*.ts`) ឃ្លាតពី SDK Firebase ពិត ➜ កូដលុយ/listener របស់ App
// (ដែលសរសេរលើ semantics RTDB) ធ្វើខុសលើ backend Supabase ដោយស្ងាត់ ៖ val() array/object · លំដាប់កូនសោ · update ជ្រៅ · increment ·
// transaction (abort · លុប · node ទាំងមូល) · listener (ជ្រៅ · off) · កំហុស sync ធៀប async។**
//
// ⛔ oracle = SDK Firebase **ពិត** (កំណែដដែលនឹង CDN) + RTDB emulator ពិត ។ adapter = ប្រភព TypeScript ពិត (esbuild) + supabase-js ពិត ទល់នឹង
//    ម៉ាស៊ីនមេ Supabase ក្លែង (`supabase-fake-server.js` ៖ JWT ពិត · RPC លើ Postgres ពិត + migration ពិត)។ ជំហានដដែលរត់លើ backend ទាំង ២
//    ➜ លទ្ធផល (JSON ពេញ រួមលំដាប់កូនសោ) · ប្រភេទកំហុស · តម្លៃចុងក្រោយរបស់ listener នីមួយៗ ត្រូវដូចគ្នា។
// ⛔ ផ្នែកដែល Firebase គ្មានអ្វីប្រៀប (ផ្លូវបរាជ័យរបស់ HTTP) វាស់ដោយការអះអាងផ្ទាល់ ៖ server ធ្លាក់ ➜ ការសរសេរនៅក្នុងជួរ (មិនបដិសេធ) ·
//    ចម្លើយបាត់ក្រោយ commit ➜ op_id ដដែល ➜ **increment មិនអនុវត្ត ២ ដង** · transaction ➜ txOutcome 'applied' / 'unknown' · token ផុត ➜ refresh ·
//    ហាងត្រូវ Revoke ➜ listener បដិសេធ + ចាកចេញ · ឧបករណ៍ ២ ប្រណាំង transaction ➜ មិនបាត់ការបូក។
//
//   java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
//   npm ci --prefix ZoeW && npm ci --prefix supabase
//   node audit-tools/emu/supabase-adapter-parity-test.js
'use strict';
process.exitCode = 1;

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { emuNamespace } = require('./ns.js');
const { createPgHarness } = require('../supabase-pg.js');
const { startFakeSupabase } = require('../supabase-fake-server.js');

const ROOT = process.env.SBADAPTER_APP_DIR ? path.resolve(process.env.SBADAPTER_APP_DIR) : path.join(__dirname, '..', '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : ROOT;
// ⛔ STRICT តាម emulator (`CRUD_FLOW_STRICT` ដូច emu/* ដទៃ) មិនមែន `SUPABASE_STRICT` ៖ job `audit-suite` របស់ CI គ្មាន emulator តែមាន
//    `SUPABASE_STRICT=1` ➜ checker នេះ SKIP ស្អាតនៅទីនោះ ហើយរត់ STRICT ក្នុង job `firebase-rules` (មាន emulator · `.github/workflows/audit.yml`)
const STRICT = process.env.SBADAPTER_STRICT === '1' || process.env.CRUD_FLOW_STRICT === '1';
const SRC = [path.join(ROOT, 'ZoeW', 'src', 'services'), path.join(REPO, 'ZoeW', 'src', 'services')].find((d) => fs.existsSync(path.join(d, 'supabase-rtdb.ts')));
const ZOEW_MODULES = [path.join(REPO, 'ZoeW', 'node_modules'), path.join(ROOT, 'ZoeW', 'node_modules'), path.join(ROOT, 'node_modules')].find((d) => fs.existsSync(path.join(d, 'firebase')));
const DEPS_DIRS = [process.env.SUPABASE_DEPS_DIR, path.join(ROOT, 'supabase', 'node_modules'), path.join(REPO, 'supabase', 'node_modules')].filter(Boolean);

let pass = 0, fail = 0;
const check = (c, label, detail) => {
    if (c) { pass++; console.log('  ok    ' + label); } else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 1500) : '')); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, ms, step) {
    const end = Date.now() + ms;
    for (;;) {
        if (await pred()) return true;
        if (Date.now() > end) return false;
        await sleep(step || 25);
    }
}
function emuReq(method, p, body) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const r = http.request({ host: '127.0.0.1', port: 9000, method, path: p, headers: Object.assign({ Authorization: 'Bearer owner' },
            payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) },
        (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
        r.on('error', reject);
        if (payload) r.write(payload);
        r.end();
    });
}

async function bundleAdapter() {
    const esbuild = require(path.join(ZOEW_MODULES, 'esbuild'));
    const entry = path.join(os.tmpdir(), 'sbadapter-entry-' + process.pid + '.ts');
    fs.writeFileSync(entry, "export { createSupabaseSdk, loginEmailFor, SB_ACCOUNT_BLOCKED_TEXT } from " + JSON.stringify(path.join(SRC, 'supabase-sdk.ts')) + ";\n"
        + "export { createSupabaseTransport } from " + JSON.stringify(path.join(SRC, 'supabase-transport.ts')) + ";\n"
        + "export { exportVal, nameCompare } from " + JSON.stringify(path.join(SRC, 'supabase-rtdb.ts')) + ";\n"
        + "export { txDisconnectResolving } from " + JSON.stringify(path.join(SRC, 'tx-disconnect.ts')) + ";\n");
    try {
        const out = await esbuild.build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, target: 'node20',
            nodePaths: [ZOEW_MODULES], logLevel: 'silent' });
        const file = path.join(os.tmpdir(), 'sbadapter-' + process.pid + '.cjs');
        fs.writeFileSync(file, out.outputFiles[0].text);
        const mod = require(file);
        fs.unlinkSync(file);
        return mod;
    } finally {
        try { fs.unlinkSync(entry); } catch (e) {}
    }
}

function memStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _map: m };
}

const PERMISSIVE = { rules: { '.read': true, '.write': true } };

function firebaseApi(sdkDb, db) {
    return {
        name: 'firebase',
        ref: (p) => (p === undefined ? sdkDb.ref(db) : sdkDb.ref(db, p)),
        set: (r, v) => sdkDb.set(r, v),
        update: (r, v) => sdkDb.update(r, v),
        get: (r) => sdkDb.get(r),
        tx: (r, fn) => sdkDb.runTransaction(r, fn),
        increment: (n) => sdkDb.increment(n),
        onValue: (r, cb, err) => sdkDb.onValue(r, cb, err),
        off: (r) => sdkDb.off(r),
        settle: () => sleep(250)
    };
}
function adapterApi(sdk, db) {
    return {
        name: 'supabase',
        ref: (p) => (p === undefined ? sdk.ref(db) : sdk.ref(db, p)),
        set: (r, v) => sdk.set(r, v),
        update: (r, v) => sdk.update(r, v),
        get: (r) => sdk.get(r),
        tx: (r, fn) => sdk.runTransaction(r, fn),
        increment: (n) => sdk.increment(n),
        onValue: (r, cb, err) => sdk.onValue(r, cb, err),
        off: (r) => sdk.off(r),
        settle: () => sleep(150)
    };
}

const J = (v) => JSON.stringify(v === undefined ? '__undefined__' : v);

async function scenario(api) {
    const trace = [];
    const last = {};
    const counts = {};
    const listen = (name, p) => {
        const r = api.ref(p);
        counts[name] = 0;
        api.onValue(r, (snap) => { last[name] = J(snap.val()); counts[name]++; }, (e) => { last[name] = 'ERR ' + (e && e.code); });
        return r;
    };
    const snapshotListeners = () => J(Object.keys(last).sort().map((k) => [k, last[k]]));
    const step = async (label, fn, opts) => {
        let out;
        let immediate = null;
        try {
            let started;
            try {
                started = fn();
            } catch (e) {
                out = { sync: 'throw' };
                started = null;
            }
            if (!opts || opts.immediate !== false) immediate = snapshotListeners();
            if (started && typeof started.then === 'function') {
                try {
                    const v = await started;
                    out = { ok: v === undefined ? null : v };
                } catch (e) {
                    out = { async: 'reject' };
                }
            } else if (!out) {
                out = { ok: started === undefined ? null : started };
            }
        } catch (e) {
            out = { crash: String(e && e.message) };
        }
        await api.settle();
        trace.push({ label, out: J(out), listeners: snapshotListeners(), immediate });
    };
    const snapVal = (s) => (s && typeof s.val === 'function' ? { exists: s.exists(), val: s.val() } : s);
    const txOut = (r) => (r ? { committed: r.committed, val: r.snapshot ? r.snapshot.val() : null } : r);

    const rootRef = listen('t1', 'sbp_t1');
    listen('t1/a', 'sbp_t1/a');
    listen('t1/a/list', 'sbp_t1/a/list');
    listen('t2', 'sbp_t2');
    listen('missing', 'sbp_t1/nothing/here');
    // ⛔ ការតភ្ជាប់ដំបូងរបស់ SDK ពិតទៅ emulator យឺតលើ runner រវល់ (CI ផ្នែក ៖ > settle ២៥០ms) ➜ តម្លៃដំបូងផ្ទុះចូលជំហានបន្ទាប់
    //    ➜ រង់ចាំ listener ទាំងអស់បាញ់ម្តង (ពិដាន ១៥ វិ.) មុនជំហានទី ១ ៖ ការប្រៀបបន្ទាប់វាស់ semantics មិនមែនល្បឿនតភ្ជាប់
    await until(() => Object.keys(counts).every((k) => counts[k] > 0), 15000);
    await step('initial listener values', () => null, { immediate: false });
    await step('set object + array', () => api.set(api.ref('sbp_t1/a'), { name: 'x', n: 1, list: [{ c: 1 }, { c: 2 }], flag: true }));
    await step('get doc', () => api.get(api.ref('sbp_t1/a')).then(snapVal));
    await step('update deep paths', () => api.update(api.ref('sbp_t1/a'), { n: 2, 'list/1/c': 5 }));
    await step('update from root node', () => api.update(api.ref('sbp_t1'), { 'a/n': 3, b: { z: 1 } }));
    await step('sparse array with null', () => api.set(api.ref('sbp_t1/a/list'), [{ c: 1 }, null, { c: 3 }]));
    await step('get sparse', () => api.get(api.ref('sbp_t1/a/list')).then(snapVal));
    await step('key ordering', () => api.set(api.ref('sbp_t1/c'), { 10: 1, 9: 2, a: 3, '-1': 4, '01': 5, b: 6, 2: 7 }));
    await step('get ordering', () => api.get(api.ref('sbp_t1/c')).then(snapVal));
    await step('int keys far apart ➜ object', () => api.set(api.ref('sbp_t1/d'), { 0: 'x', 5: 'y' }));
    await step('int keys max = 2n ➜ object', () => api.set(api.ref('sbp_t1/d2'), { 0: 'x', 4: 'y' }));
    await step('int keys max = 2n-1 ➜ array', () => api.set(api.ref('sbp_t1/d3'), { 0: 'x', 3: 'y' }));
    await step('forEach order', () => api.set(api.ref('sbp_t1/o'), { 10: 1, 9: 1, '-5': 1, '007': 1, 7: 1, z: 1, A: 1, '2147483648': 1, '-2147483649': 1, '1a': 1, '0': 1, '-0': 1 })
        .then(() => api.get(api.ref('sbp_t1/o'))).then((snap) => { const keys = []; snap.forEach((c) => { keys.push(c.key); }); return keys; }));
    await step('int keys with hole ➜ array', () => api.set(api.ref('sbp_t1/e'), { 0: 'x', 1: 'y', 3: 'z' }));
    await step('delete array element', () => api.update(api.ref('sbp_t1'), { 'e/1': null }));
    await step('empty object ➜ null', () => api.set(api.ref('sbp_t1/f'), {}));
    await step('nested nulls/empties', () => api.set(api.ref('sbp_t1/g'), { x: null, y: {}, z: { w: null } }));
    await step('increment new', () => api.set(api.ref('sbp_t1/h/count'), api.increment(2)));
    await step('increment in update', () => api.update(api.ref('sbp_t1/h'), { count: api.increment(3), total: api.increment(1.5) }));
    await step('increment float', () => api.update(api.ref('sbp_t1/h'), { total: api.increment(0.1) }));
    await step('get increments', () => api.get(api.ref('sbp_t1/h')).then(snapVal));
    for (let i = 0; i < 3; i++) await step('tx counter #' + i, () => api.tx(api.ref('sbp_t1/i'), (v) => (v || 0) + 1).then(txOut), { immediate: false });
    await step('tx abort', () => api.tx(api.ref('sbp_t1/i'), () => undefined).then(txOut), { immediate: false });
    await step('tx create object', () => api.tx(api.ref('sbp_t1/j'), (v) => (v ? v : { a: 1, arr: [1, 2] })).then(txOut), { immediate: false });
    await step('tx delete', () => api.tx(api.ref('sbp_t1/j'), () => null).then(txOut), { immediate: false });
    for (const m of ['2026-07', '2026-08', '2026-09', '2026-10']) {
        await step('tx root keep 3 ' + m, () => api.tx(api.ref('sbp_t2'), (v) => {
            const months = v && typeof v === 'object' ? v : {};
            months[m] = { cod: 1, op: 'op_' + m };
            const out = {};
            Object.keys(months).sort().reverse().slice(0, 3).forEach((k) => { out[k] = months[k]; });
            return out;
        }).then(txOut), { immediate: false });
    }
    await step('empty path ➜ throw', () => api.ref(''));
    await step('multi-root update', () => api.update(api.ref(), { 'sbp_t1/k': 1, 'sbp_t2/2026-11': { x: 1 } }));
    const big = {};
    for (let i = 0; i < 1200; i++) big['k' + i] = { v: i, tag: 'x' + (i % 7) };
    await step('update 1200 paths (ជាង ៥០០ ក្នុងមួយ RPC)', () => api.update(api.ref('sbp_big'), big));
    await step('get 1200', () => api.get(api.ref('sbp_big')).then((snap) => ({ n: snap.numChildren ? snap.numChildren() : Object.keys(snap.val() || {}).length, k999: snap.val().k999 })));
    const drop = {};
    for (let i = 0; i < 1200; i += 2) drop['k' + i] = null;
    await step('delete 600 paths', () => api.update(api.ref('sbp_big'), drop));
    await step('get after delete', () => api.get(api.ref('sbp_big')).then((snap) => ({ n: Object.keys(snap.val() || {}).length, k0: snap.val().k0 === undefined, k1: snap.val().k1 })));
    await step('update sibling prefix not ancestor', () => api.update(api.ref('sbp_t1'), { 'a-b': 1, 'a/y': 2 }));
    await step('update non-object ➜ throw', () => api.update(api.ref('sbp_t1'), 5));
    await step('write .info ➜ throw', () => api.set(api.ref('.info/connected'), true));
    await step('ancestor overlap ➜ error', () => api.update(api.ref('sbp_t1'), { a: { x: 1 }, 'a/y': 2 }));
    await step('update undefined value ➜ throw', () => api.update(api.ref('sbp_t1'), { q: undefined }));
    await step('update empty object', () => api.update(api.ref('sbp_t1'), {}));
    await step('undefined value ➜ throw', () => api.set(api.ref('sbp_t1/a/n'), undefined));
    await step('NaN ➜ throw', () => api.set(api.ref('sbp_t1/l'), NaN));
    await step('invalid path ➜ throw', () => api.set(api.ref('sbp_t1/bad.key'), 1));
    await step('invalid child key ➜ throw', () => api.set(api.ref('sbp_t1/m'), { 'a.b': 1 }));
    await step('child empty ➜ throw', () => api.ref('sbp_t1').child(''));
    await step('off doc listener', () => { api.off(api.ref('sbp_t1/a')); return api.set(api.ref('sbp_t1/a/n'), 99); });
    await step('get missing root', () => api.get(api.ref('sbp_t9')).then(snapVal));
    await step('get missing doc', () => api.get(api.ref('sbp_t1/zz')).then(snapVal));
    await step('get root node', () => api.get(rootRef).then(snapVal));
    await step('set whole doc replaced', () => api.set(api.ref('sbp_t1/a'), { only: true }));
    await step('boolean/string/number leaves', () => api.set(api.ref('sbp_t1/n'), { s: 'ក្រហម 😀', b: false, z: 0, neg: -1.25, big: 9007199254740991 }));
    await step('get leaves', () => api.get(api.ref('sbp_t1/n')).then(snapVal));
    return { trace, counts };
}

(async () => {
    console.log('supabase-adapter-parity — adapter fb លើ Supabase (ប្រភព TS ពិត) ធៀបនឹង SDK Firebase ពិត (RTDB emulator)\n');
    const reach = await emuReq('GET', '/.json?ns=' + emuNamespace('sbadapter-probe')).catch(() => null);
    const H = createPgHarness({ depsDirs: DEPS_DIRS, shimDir: path.join(__dirname, '..', 'supabase-shim'),
        wantMajor: parseInt((fs.readFileSync(path.join(ROOT, 'supabase', 'config.toml'), 'utf8').match(/^major_version\s*=\s*(\d+)\s*$/m) || [])[1] || '0', 10) });
    const missing = !reach || reach.status >= 500 ? 'គ្មាន RTDB emulator នៅ 127.0.0.1:9000'
        : !SRC ? 'រកប្រភព ZoeW/src/services/supabase-rtdb.ts មិនឃើញ'
            : !ZOEW_MODULES ? 'គ្មាន ZoeW/node_modules (firebase · esbuild · supabase-js)'
                : H.unavailableReason();
    if (missing) {
        if (STRICT) { console.log('  FAIL  ' + missing + ' — STRICT ➜ ការ SKIP រាប់ជាការធ្លាក់'); process.exit(1); }
        console.log('SKIP — ' + missing);
        process.exitCode = 0;
        return;
    }
    let fake = null;
    let pool = null;
    let client = null;
    const apps = [];
    try {
        const mod = await bundleAdapter();
        check(typeof mod.createSupabaseSdk === 'function' && typeof mod.createSupabaseTransport === 'function', 'bundle adapter ពីប្រភព TS ពិត');
        await H.start();
        const { c, name } = await H.freshDb('default-grants');
        client = c;
        c.on('error', () => {});
        const migDir = path.join(ROOT, 'supabase', 'migrations');
        await c.query(fs.readdirSync(migDir).filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort().map((f) => fs.readFileSync(path.join(migDir, f), 'utf8')).join('\n;\n'));
        const { compileRules, rulesSql } = await import(require('url').pathToFileURL(path.join(ROOT, 'supabase', 'scripts', 'rtdb-rules.mjs')).href);
        await c.query(rulesSql(compileRules(PERMISSIVE)));
        const tA = (await c.query("insert into public.tenants (name, branch_code, expires_at) values ('A', '200001', now() + interval '30 days') returning id")).rows[0].id;
        const tB = (await c.query("insert into public.tenants (name, branch_code, expires_at) values ('B', '200002', now() + interval '30 days') returning id")).rows[0].id;
        const u1 = await H.makeAuthUser(c, 'sokha@users.zoew.invalid');
        const u2 = await H.makeAuthUser(c, 'dara@users.zoew.invalid');
        const u3 = await H.makeAuthUser(c, 'vanna@users.zoew.invalid');
        const u4 = await H.makeAuthUser(c, 'lonely@users.zoew.invalid');
        await c.query("insert into public.tenant_members (user_id, tenant_id, username, role) values ($1, $2, 'sokha', 'owner'), ($3, $2, 'dara', 'member'), ($4, $5, 'vanna', 'owner')",
            [u1, tA, u2, u3, tB]);
        const PG = H.PG;
        pool = new PG.Pool({ host: '127.0.0.1', port: c.connectionParameters.port, user: 'postgres', database: name, max: 12 });
        pool.on('error', () => {});
        fake = await startFakeSupabase({ pool });
        fake.addUser('sokha@users.zoew.invalid', 'pass-sokha-1', u1);
        fake.addUser('dara@users.zoew.invalid', 'pass-dara-12', u2);
        fake.addUser('vanna@users.zoew.invalid', 'pass-vanna-1', u3);
        fake.addUser('lonely@users.zoew.invalid', 'pass-lonely1', u4);

        const events = { blocked: [], unknown: [], listenerErrors: [] };
        const makeSdk = (dbOptions, docsCache) => mod.createSupabaseSdk((cfg) => mod.createSupabaseTransport(cfg, { localStorage: memStorage(), sessionStorage: memStorage() }), {
            onListenerError: (e) => events.listenerErrors.push(String(e && e.message)),
            onAccountBlocked: (m) => events.blocked.push(m),
            onTxOutcomeUnknown: (p) => events.unknown.push(p.join('/')),
            docsCache,
            dbOptions: Object.assign({ pollFallbackMs: 400, retryStepsMs: [100, 200, 400] }, dbOptions || {})
        });
        const config = { supabaseUrl: fake.url, supabaseKey: 'sb_publishable_' + 'x'.repeat(30), loginDomain: 'users.zoew.invalid' };
        const openClient = async (username, password, dbOptions, docsCache) => {
            const sdk = makeSdk(dbOptions, docsCache);
            const app = sdk.initializeApp(config);
            apps.push({ sdk, app });
            const auth = sdk.getAuth(app);
            const db = sdk.getDatabase(app);
            let states = [];
            sdk.onAuthStateChanged(auth, (u) => states.push(u ? u.uid : null));
            const cred = await sdk.signInWithEmailAndPassword(auth, username, password);
            return { sdk, app, auth, db, cred, states: () => states };
        };

        console.log('── ១. auth ──');
        const A = await openClient('SoKha', 'pass-sokha-1');
        check(A.cred && A.cred.user && A.cred.user.uid === u1 && A.auth.currentUser === A.cred.user, 'Login ដោយ username (អក្សរធំ) ➜ email ខាងក្នុង · currentUser = user ដដែល');
        check(await until(() => A.states().includes(u1), 3000), 'onAuthStateChanged បាញ់ជាមួយ user ក្រោយ Login');
        const tok = await A.sdk.getIdTokenResult(A.auth.currentUser);
        check(!!tok.token && Math.abs(new Date(tok.authTime).getTime() - Date.now()) < 10000, 'getIdTokenResult ៖ token · authTime = ម៉ោង Login (ច្បាប់ ៤ ម៉ោង)', tok.authTime);
        const bad = makeSdk();
        const badApp = bad.initializeApp(config);
        apps.push({ sdk: bad, app: badApp });
        const badErr = await bad.signInWithEmailAndPassword(bad.getAuth(badApp), 'sokha', 'wrong-pass').then(() => null, (e) => e);
        check(!!badErr && /មិនត្រឹមត្រូវ/.test(badErr.message) && !bad.getAuth(badApp).currentUser, 'ពាក្យសម្ងាត់ខុស ➜ សារខ្មែរ · currentUser null', badErr && badErr.message);
        const lonely = await bad.signInWithEmailAndPassword(bad.getAuth(badApp), 'lonely', 'pass-lonely1').then(() => null, (e) => e);
        check(!!lonely && lonely.message === mod.SB_ACCOUNT_BLOCKED_TEXT.none && !bad.getAuth(badApp).currentUser, 'គណនីគ្មានហាង ➜ បដិសេធការ Login (មិនចូលដោយគ្មានទិន្នន័យ)', lonely && lonely.message);

        console.log('\n── ២. semantics ប្រៀបនឹង SDK Firebase ពិត ──');
        const ns = emuNamespace('sbadapter');
        await emuReq('PUT', '/.settings/rules.json?ns=' + ns, PERMISSIVE);
        const sdkApp = require(path.join(ZOEW_MODULES, 'firebase', 'app'));
        const sdkDb = require(path.join(ZOEW_MODULES, 'firebase', 'database'));
        const fbApp = sdkApp.initializeApp({ projectId: 'demo-sbadapter', databaseURL: 'http://127.0.0.1:9000?ns=' + ns }, 'sbadapter-' + process.pid);
        const fbDb = sdkDb.getDatabase(fbApp);
        const fbRun = await scenario(firebaseApi(sdkDb, fbDb));
        const sbRun = await scenario(adapterApi(A.sdk, A.db));
        let mismatches = 0;
        for (let i = 0; i < fbRun.trace.length; i++) {
            const f = fbRun.trace[i];
            const s = sbRun.trace[i] || {};
            const same = f.out === s.out && f.listeners === s.listeners && f.immediate === s.immediate;
            if (!same) mismatches++;
            check(same, 'ជំហាន «' + f.label + '» ៖ លទ្ធផល + listener (ភ្លាម និងក្រោយ commit) ដូច SDK Firebase',
                same ? undefined : 'firebase ' + f.out + ' | ' + f.listeners + ' | ភ្លាម ' + f.immediate + '\n        supabase ' + s.out + ' | ' + s.listeners + ' | ភ្លាម ' + s.immediate);
        }
        check(fbRun.trace.length >= 40 && sbRun.trace.length === fbRun.trace.length, 'ជាន់អប្បបរមា ៖ ជំហាន ≥ ៤០ (' + fbRun.trace.length + ')');
        const offCount = sbRun.counts['t1/a'];
        check(offCount >= 3, 'listener ដែលដកចេញ (off) បានបាញ់មុនការដក ហើយមិនបាញ់ក្រោយ', { counts: sbRun.counts });
        try { await sdkApp.deleteApp(fbApp); } catch (e) {}

        console.log('\n── ៣. ឧបករណ៍ ២ ក្នុងហាងតែមួយ · ហាងផ្សេង ──');
        const D = await openClient('dara', 'pass-dara-12');
        const V = await openClient('vanna', 'pass-vanna-1');
        let dSeen = null, vSeen = 'unset';
        D.sdk.onValue(D.sdk.ref(D.db, 'sbp_t1/i'), (s) => { dSeen = s.val(); });
        V.sdk.onValue(V.sdk.ref(V.db, 'sbp_t1'), (s) => { vSeen = s.val(); });
        check(await until(() => dSeen === 3, 4000), 'ឧបករណ៍ទី ២ (ហាងដដែល) ឃើញទិន្នន័យដែលឧបករណ៍ទី ១ សរសេរ', dSeen);
        check(await until(() => vSeen === null, 4000) && vSeen === null, 'ហាងផ្សេង (B) មិនឃើញទិន្នន័យហាង A', vSeen);
        const incA = [], incD = [];
        for (let i = 0; i < 12; i++) {
            incA.push(A.sdk.runTransaction(A.sdk.ref(A.db, 'sbp_race/n'), (v) => (v || 0) + 1));
            incD.push(D.sdk.runTransaction(D.sdk.ref(D.db, 'sbp_race/n'), (v) => (v || 0) + 1));
        }
        const raced = await Promise.all(incA.concat(incD).map((p) => p.then((r) => r.committed, () => false)));
        const finalRace = (await A.sdk.get(A.sdk.ref(A.db, 'sbp_race/n'))).val();
        check(raced.every(Boolean) && finalRace === 24, 'transaction ប្រណាំង ២ ឧបករណ៍ × ១២ ➜ ២៤ (មិនបាត់ការបូក)', { finalRace, raced: raced.filter(Boolean).length });
        A.sdk.goOnline(A.db);
        D.sdk.goOnline(D.db);

        console.log('\n── ៤. ផ្លូវបរាជ័យ HTTP (Firebase គ្មានសមមូល) ──');
        const F = await openClient('sokha', 'pass-sokha-1', { rpcTimeoutMs: 1500 });
        let connected = null;
        F.sdk.onValue(F.sdk.ref(F.db, '.info/connected'), (s) => { connected = s.val(); });
        let fView = 'unset';
        F.sdk.onValue(F.sdk.ref(F.db, 'sbp_fail'), (s) => { fView = s.val(); });
        check(await until(() => connected === true && fView === null, 4000), '.info/connected = true ក្រោយការទាញជោគជ័យ · listener បាញ់ null លើ node ទទេ', { connected, fView });
        fake.setMode('down');
        let settled = 'pending';
        const queued = F.sdk.set(F.sdk.ref(F.db, 'sbp_fail/a'), { v: 1 }).then(() => { settled = 'ok'; }, (e) => { settled = 'err ' + e.message; });
        await sleep(600);
        check(settled === 'pending' && connected === false, 'server ធ្លាក់ ➜ set() នៅក្នុងជួរ (មិនបដិសេធ) · .info/connected = false', { settled, connected });
        check(fView && fView.a && fView.a.v === 1, 'ការសរសេរក្នុងជួរលេចលើ listener ភ្លាម (ដូច RTDB ក្រៅបណ្តាញ)', fView);
        fake.setMode('ok');
        F.sdk.goOnline(F.db);
        await queued;
        check(settled === 'ok' && await until(() => connected === true, 3000), 'server មកវិញ ➜ ការសរសេរ commit · connected = true', { settled, connected });
        const rows = async (k) => (await c.query("select value from public.zoe_docs where tenant_id = $1 and root = 'sbp_fail' and key = $2", [tA, k])).rows;
        check(JSON.stringify((await rows('a'))[0].value) === '{"v":1}', 'ការសរសេរក្នុងជួរនៅលើ Postgres ពិត');
        fake.setMode('drop-response');
        let incSettled = 'pending';
        const inc = F.sdk.update(F.sdk.ref(F.db, 'sbp_fail/money'), { cod: F.sdk.increment(10) }).then(() => { incSettled = 'ok'; }, (e) => { incSettled = 'err ' + e.message; });
        // ⛔ រង់ចាំ commit ពិតលើ Postgres (ចម្លើយត្រូវបោះចោល) មុនប្តូរ mode — `sleep` ក្រោមបន្ទុកអាចប្តូរមុនសំណើដល់ ➜ មិនចូលស្ថានភាព «ចម្លើយបាត់ក្រោយ commit»
        const incDropped = await until(async () => { const m = (await rows('money'))[0]; return !!m && !!m.value && m.value.cod === 10 && incSettled === 'pending'; }, 10000);
        fake.setMode('ok');
        await inc;
        const money = (await rows('money'))[0];
        check(incDropped && incSettled === 'ok' && money && money.value.cod === 10, '⛔ ចម្លើយបាត់ក្រោយ commit ➜ ផ្ញើម្តងទៀតដោយ op_id ដដែល ➜ increment ១០ មិនមែន ២០', { incDropped, incSettled, money });
        fake.setMode('drop-response');
        const txP = F.sdk.runTransaction(F.sdk.ref(F.db, 'sbp_fail/tx'), (v) => (v || 0) + 5);
        await until(async () => { const r = (await rows('tx'))[0]; return !!r && r.value === 5 && !!mod.txDisconnectResolving.get(txP); }, 10000);
        const pendingMark = mod.txDisconnectResolving.get(txP);
        fake.setMode('ok');
        const txRes = await txP.then((r) => r, (e) => ({ error: e }));
        const txRow = (await rows('tx'))[0];
        check(!!pendingMark && pendingMark.message === 'disconnect', 'transaction ចម្លើយបាត់ ➜ ចុះក្នុង txDisconnectResolving (history-write ប្រើ)', pendingMark && pendingMark.message);
        check(txRes.committed === true && txRes.txOutcome === 'applied' && txRes.txProven === true && txRow && txRow.value === 5, 'transaction ចម្លើយបាត់ ➜ committed · txOutcome applied · txProven (op_id ដដែលបញ្ជាក់ថាជារបស់យើង) · អនុវត្តម្តង', { txRes: txRes.committed, outcome: txRes.txOutcome, proven: txRes.txProven, row: txRow });
        // ⛔ outcome ដែល *មិនទាន់ដឹង* មិនមែន *មិនអាចដឹង* ៖ `zoe_ops` រក្សាលទ្ធផល op_id ២ ថ្ងៃ ➜ adapter ផ្ញើ op_id ដដែលរហូតបានចម្លើយច្បាស់។
        //    មុនកែ ៖ បោះបង់ក្រោយ ៦០ វិ. ➜ `unknown` ➜ «ដក» ធ្វើឲ្យកញ្ចប់បាត់ · reconcile ដក ២ ដង (tx-outcome-test ផ្នែក ៤ឃ · ៦)
        // ⛔ ចម្លើយ replay គ្មានតម្លៃ doc ➜ adapter ទាញតម្លៃពិតក្រោយ replay (`requestSync()`) ➜ រង់ចាំទិដ្ឋភាពស្រស់ (`tx = 5`) ៖ សេណារីយ៉ូនេះវាស់ «ចម្លើយបាត់ + server ធ្លាក់យូរ»
        //    មិនមែន base ហួសសម័យ + ចម្លើយ conflict បាត់ (ការបរាជ័យពីរជាន់ ➜ `not-applied` ពិត · ledger ផ្ញើម្តងទៀត)
        const freshBase = await until(() => !!fView && fView.tx === 5, 10000);
        check(freshBase, 'លក្ខខណ្ឌចាំបាច់ ៖ ទិដ្ឋភាពក្នុងគ្រឿងស្រស់ (tx = 5) ក្រោយ transaction ដែល replay', fView);
        fake.setMode('drop-response');
        let longState = 'pending';
        const longP = F.sdk.runTransaction(F.sdk.ref(F.db, 'sbp_fail/tx'), (v) => (v || 0) + 1);
        longP.then((r) => { longState = r; }, (e) => { longState = e; });
        const longDropped = await until(async () => { const r = (await rows('tx'))[0]; return !!r && r.value === 6 && !!mod.txDisconnectResolving.get(longP); }, 10000);
        check(longDropped, 'លក្ខខណ្ឌចាំបាច់ ៖ transaction commit លើ Postgres (5 ➜ 6) ហើយចម្លើយបាត់ មុន server ធ្លាក់');
        fake.setMode('down');
        await sleep(3500);
        check(longState === 'pending' && !!mod.txDisconnectResolving.get(longP) && !events.unknown.includes('sbp_fail/tx'),
            '⛔⛔ ចម្លើយបាត់ + server ធ្លាក់យូរ (លើសពិដាន RPC ២ ដង) ➜ transaction នៅរង់ចាំ មិនបោះបង់ មិនទាយ unknown',
            { state: longState === 'pending' ? 'pending' : (longState && (longState.message || longState.committed)), unknown: events.unknown });
        fake.setMode('ok');
        F.sdk.goOnline(F.db);
        await until(() => longState !== 'pending', 15000);
        const txRow2 = (await rows('tx'))[0];
        check(!!longState && longState.committed === true && longState.txOutcome === 'applied' && txRow2 && txRow2.value === 6,
            '⛔⛔ server មកវិញ ➜ op_id ដដែល ➜ committed · applied · អនុវត្តតែម្តង (5 ➜ 6)',
            { committed: longState && longState.committed, outcome: longState && longState.txOutcome, row: txRow2 && txRow2.value });
        const G = await openClient('sokha', 'pass-sokha-1', { rpcTimeoutMs: 1500 });
        let gView = 'unset';
        G.sdk.onValue(G.sdk.ref(G.db, 'sbp_fail'), (s) => { gView = s.val(); });
        await until(() => gView !== 'unset', 5000);
        fake.setMode('down');
        const lostP = G.sdk.runTransaction(G.sdk.ref(G.db, 'sbp_fail/tx'), (v) => (v || 0) + 1).then(() => null, (e) => e);
        await sleep(600);
        await G.sdk.deleteApp(G.app);
        const lost = await lostP;
        fake.setMode('ok');
        check(!!lost && lost.message === 'disconnect' && lost.txOutcome === 'unknown' && events.unknown.includes('sbp_fail/tx'),
            'adapter ត្រូវបិទ (deleteApp) ខណៈលទ្ធផលមិនទាន់ដឹង ➜ បដិសេធ disconnect · txOutcome unknown · រាយការណ៍ (zone money)', lost && { m: lost.message, o: lost.txOutcome, u: events.unknown });
        // ⛔ ថ្នេរ adapter ↔ ledger ៖ `ledgerRejectionVerdict()` (domain/ledger.ts) រាយ «មិន ok» តែពេល `txServerUnread === true`
        check(!!lost && lost.txServerUnread === true, 'unknown ពេលបិទ ➜ txServerUnread (ledger reconcile មិនរាយ ok)', lost && { unread: lost.txServerUnread });
        F.sdk.goOnline(F.db);
        await until(() => connected === true, 3000);
        fake.expireTokens();
        await sleep(1100);
        const afterExpire = await F.sdk.set(F.sdk.ref(F.db, 'sbp_fail/b'), 2).then(() => 'ok', (e) => 'err ' + e.message);
        check(afterExpire === 'ok', 'JWT ផុត ➜ transport refresh ➜ ការសរសេរជោគជ័យ', afterExpire);
        let permErr = null;
        F.sdk.onValue(F.sdk.ref(F.db, 'sbp_other'), () => {}, (e) => { permErr = e; });
        await c.query('update public.tenants set revoked = true where id = $1', [tA]);
        F.sdk.goOnline(F.db);
        check(await until(() => !!permErr, 5000) && permErr.code === 'PERMISSION_DENIED', 'ហាងត្រូវ Revoke ➜ listener ទទួល PERMISSION_DENIED (ដូច rules បដិសេធ)', permErr && permErr.code);
        check(await until(() => events.blocked.includes(mod.SB_ACCOUNT_BLOCKED_TEXT.revoked) && !F.auth.currentUser, 5000),
            'ហាងត្រូវ Revoke ➜ ប្រាប់មូលហេតុ + ចាកចេញ (currentUser null)', { blocked: events.blocked, user: !!F.auth.currentUser });
        await c.query('update public.tenants set revoked = false where id = $1', [tA]);

        console.log('\n── ៥. ទាញពេញជាទំព័រ ក្រោយ purge tombstone (client ពិត + SQL ពិត) ──');
        const S = await openClient('dara', 'pass-dara-12');
        for (let i = 0; i < 12; i++) await S.sdk.set(S.sdk.ref(S.db, 'sbp_page/k' + i), i);
        await S.sdk.set(S.sdk.ref(S.db, 'sbp_page/gone'), 1);
        await S.sdk.set(S.sdk.ref(S.db, 'sbp_page/gone'), null);
        await c.query("update public.zoe_docs set updated_at = now() - interval '8 days' where tenant_id = $1 and value is null", [tA]);
        await c.query('select private.zoe_housekeeping($1)', [tA]);
        const PAGE = 2;
        const st5 = (await c.query('select seq, purged_seq from public.zoe_tenant_state where tenant_id = $1', [tA])).rows[0];
        const live5 = (await c.query('select seq from public.zoe_docs where tenant_id = $1 and value is not null order by seq', [tA])).rows.map((r) => Number(r.seq));
        check(Number(st5.purged_seq) > live5[PAGE - 1] && live5.length > PAGE * 4,
            'មុនលក្ខខណ្ឌ ៖ purged_seq លើសព្រំទំព័រទី ១ · doc រស់ច្រើនទំព័រ', { purged: st5.purged_seq, boundary: live5[PAGE - 1], live: live5.length });
        const pulls = [];
        fake.setRpcHook(({ fn, body, phase }) => {
            if (fn === 'zoe_pull' && phase === 'before' && body && body.p_limit === PAGE) pulls.push(body);
            return null;
        });
        const P = await openClient('sokha', 'pass-sokha-1', { pullPage: PAGE });
        let pView = null;
        P.sdk.onValue(P.sdk.ref(P.db, 'sbp_page'), (s) => { pView = s.val(); });
        const want5 = Array.from({ length: 12 }, (_, i) => 'k' + i).join();
        const converged = await until(() => !!pView && Object.keys(pView).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).join() === want5, 8000);
        const pullsAtReady = pulls.length;
        fake.setRpcHook(null);
        check(converged && !('gone' in (pView || {})), 'client ទំព័រ ' + PAGE + ' ៖ ទាញពេញបញ្ចប់ · ឃើញ doc រស់គ្រប់ · មិនឃើញ doc ដែលលុប', pView);
        check(pullsAtReady > 1 && pullsAtReady <= Math.ceil(live5.length / PAGE) + 3,
            'ចំនួន zoe_pull ≤ ចំនួនទំព័រ + ៣ (មិនវិលចាប់ផ្តើមម្តងទៀត ➜ មិនខាត egress)', { pulls: pullsAtReady, pages: Math.ceil(live5.length / PAGE) });
        const continuing = pulls.filter((b) => b.p_since > 0 && b.p_since < Number(st5.purged_seq));
        check(continuing.length >= 1 && continuing.every((b) => typeof b.p_full_head === 'number'),
            'ទំព័របន្ត (0 < since < purged_seq) ផ្ញើ p_full_head (head ពីទំព័រ reset) ➜ server មិន reset', pulls.slice(0, 6));

        console.log('\n── ៦. cache zoe_docs (egress តែប៉ុណ្ណោះ) ៖ client ពិត + SQL ពិត ──');
        for (const { sdk, app } of apps.splice(0)) { try { await sdk.deleteApp(app); } catch (e) {} }
        const cacheStore = new Map();
        const cacheLog = [];
        const docsCache = {
            load: async (scope) => { cacheLog.push('load'); return cacheStore.has(scope) ? JSON.parse(JSON.stringify(cacheStore.get(scope))) : null; },
            save: async (scope, rec) => { cacheLog.push('save'); cacheStore.clear(); cacheStore.set(scope, JSON.parse(JSON.stringify(rec))); return true; },
            clear: async () => { cacheLog.push('clear'); cacheStore.clear(); return true; }
        };
        const pullLog = [];
        fake.setRpcHook(({ fn, body, phase, result }) => {
            if (fn === 'zoe_pull' && phase === 'after' && result && result[0]) pullLog.push({ since: body.p_since, rows: result[0].r.rows.length, tenant: result[0].r.tenant });
            return null;
        });
        const C1 = await openClient('dara', 'pass-dara-12', { docsCacheFirstSaveMs: 50 }, docsCache);
        let c1View = null;
        C1.sdk.onValue(C1.sdk.ref(C1.db, 'sbp_page'), (s) => { c1View = s.val(); });
        const scope6 = fake.url.replace(/\/+$/, '') + '|' + u2;
        const saved6 = await until(() => !!c1View && cacheStore.has(scope6), 5000);
        const rec6 = cacheStore.get(scope6) || {};
        const coldRows = pullLog.filter((p) => p.since === 0).reduce((n, p) => n + p.rows, 0);
        check(saved6 && rec6.tenant === tA && rec6.cursor > 0 && rec6.docs.length === coldRows && coldRows >= 12,
            'ក្រោយ sync ៖ cache មាន tenant ពី server · cursor · doc រស់ស្មើការទាញពេញ', { tenant: rec6.tenant, cursor: rec6.cursor, docs: (rec6.docs || []).length, coldRows });
        await C1.sdk.deleteApp(C1.app);
        await c.query("select public.zoe_admin_write($1, $2, $3::jsonb, false)", [tA, ('op6x' + process.pid + 'x000000000000').slice(0, 24), JSON.stringify([{ k: 'set', p: ['sbp_page', 'k0'], v: 100 }])]);
        pullLog.length = 0;
        const C2 = await openClient('dara', 'pass-dara-12', {}, docsCache);
        let c2View = null;
        C2.sdk.onValue(C2.sdk.ref(C2.db, 'sbp_page'), (s) => { c2View = s.val(); });
        const delta6 = await until(() => !!c2View && c2View.k0 === 100, 5000);
        const warmRows = pullLog.reduce((n, p) => n + p.rows, 0);
        check(delta6 && pullLog.length >= 1 && pullLog[0].since === rec6.cursor && warmRows <= 2 && Object.keys(c2View).length === 12,
            'បើក App ម្តងទៀត ៖ ទាញតែ delta ពី cursor ក្នុង cache (' + warmRows + ' ជួរ ជំនួស ' + coldRows + ') · ទិដ្ឋភាពពេញ', { pullLog: pullLog.slice(0, 3), keys: c2View && Object.keys(c2View).length });
        await C2.sdk.deleteApp(C2.app);
        await c.query('update public.tenant_members set tenant_id = $1 where user_id = $2', [tB, u2]);
        // ⛔ ការទាញយឺតរបស់ C2 (បិទរួច) អាចមកដល់ server ក្រោយការកំណត់ log ឡើងវិញ (ក្រោមបន្ទុក) ➜ វាស់ការទាញរបស់ C3 តាម cursor ពិតក្នុង cache មិនមែនតាមលំដាប់
        const cursorBeforeC3 = (cacheStore.get(scope6) || {}).cursor;
        pullLog.length = 0;
        const C3 = await openClient('dara', 'pass-dara-12', {}, docsCache);
        let c3View = 'unset';
        C3.sdk.onValue(C3.sdk.ref(C3.db, 'sbp_page'), (s) => { c3View = s.val(); });
        const c3Delta = () => pullLog.findIndex((p) => p.since === cursorBeforeC3 && p.tenant === tB);
        const c3Full = () => pullLog.findIndex((p, i) => i > c3Delta() && c3Delta() >= 0 && p.since === 0 && p.tenant === tB);
        const moved = await until(() => c3View !== 'unset' && c3Full() > 0, 5000);
        check(moved && c3View === null && typeof cursorBeforeC3 === 'number' && cursorBeforeC3 > 0 && c3Delta() >= 0 && c3Full() > c3Delta(),
            '⛔ សមាជិកផ្លាស់ទៅហាងផ្សេង ➜ server ប្រាប់ tenant ថ្មី ➜ បោះ cache ចោល · ទាញពេញ · គ្មានទិន្នន័យហាងចាស់លេច', { c3View, cursorBeforeC3, pullLog: pullLog.slice(0, 4) });
        await C3.sdk.signOut(C3.auth);
        check(cacheStore.size === 0 && cacheLog[cacheLog.length - 1] === 'clear', 'ចាកចេញ ➜ cache ទទេ', { size: cacheStore.size, log: cacheLog.slice(-3) });
        await c.query('update public.tenant_members set tenant_id = $1 where user_id = $2', [tA, u2]);
        fake.setRpcHook(null);
        check(events.listenerErrors.length === 0, 'callback របស់ listener មិនបោះកំហុស', events.listenerErrors.slice(0, 3));
    } catch (e) {
        check(false, 'ការវាស់មិនគាំង', String(e && e.stack || e));
    } finally {
        for (const { sdk, app } of apps) { try { await sdk.deleteApp(app); } catch (e) {} }
        if (fake) await fake.close();
        if (pool) await pool.end().catch(() => {});
        if (client) await client.end().catch(() => {});
        H.stop();
    }
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exitCode = fail ? 1 : 0;
    setTimeout(() => process.exit(process.exitCode), 200).unref();
})();
