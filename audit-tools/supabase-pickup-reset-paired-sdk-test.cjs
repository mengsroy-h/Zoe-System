'use strict';
process.exitCode = 1;
const fs = require('fs'), path = require('path'), vm = require('vm'), http = require('http'), crypto = require('crypto'), os = require('os');
const cp = require('child_process');
const { pathToFileURL } = require('url'), { createRequire } = require('module'), { isDeepStrictEqual } = require('util');
const ROOT = path.resolve(process.env.SUPABASE_RESET_PAIRED_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '..'));
const OUT = process.env.SUPABASE_RESET_PAIRED_OUT ? path.resolve(process.env.SUPABASE_RESET_PAIRED_OUT) : fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-reset-paired-sdk-'));
fs.mkdirSync(OUT, { recursive: true });
const RESULT = process.env.SUPABASE_RESET_PAIRED_RESULT || path.join(OUT, 'result.json');
const DEPS = path.join(ROOT, 'ZoeW/node_modules'), PICKUP = 'zoew_daily_pickup_cod_dod', DAY = '2026-11-01', OTHER = '2026-10-31', TAIL = '2026-11-02';
const DAILY = 'zoew_daily_revenue_cod_dod', MONTHLY = 'zoew_monthly_revenue_cod_dod', HISTORY = 'zoew_scan_history_cod_dod', PREFIX = 'zoew_pickup_reset_pending_v2:';
const PRIOR = { pickupRevision: 5, pickupResetEpoch: 2, packagesPickedUp: 2, pickedUpPhones: { PHONE: 2 }, pickedUpBarcodes: { CODE_A: 'PHONE', CODE_B: 'PHONE' } };
const CLEARED = { pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0 };
const SEED = { [PICKUP]: { [DAY]: PRIOR, [OTHER]: PRIOR, [TAIL]: PRIOR }, [DAILY]: { [DAY]: { codDollar: 37, dodDollar: 5, totalCount: 11 } },
    [MONTHLY]: { '2026-11': { codDollar: 37, dodDollar: 5, totalCount: 11 } }, [HISTORY]: { retained: { id: 'retained', isClosed: true, count: 1, cod: 37, dod: 5 } } };
const NATIVE = loadNativeContract();
const PLAN = NATIVE.plan.map(row => row[0]);
const SHARED_FILE = path.join(ROOT, 'audit-tools/fixtures/pickup-reset-parity-fixture.cjs');
if (crypto.createHash('sha256').update(fs.readFileSync(SHARED_FILE)).digest('hex') !== '5a473ed0aec3f32dab11e8be00d8360d6ce29f8189f7ec1f47a864fe0c2f65ea') throw new Error('shared paired fixture changed without review');
const FIXTURE = require(SHARED_FILE);
const SQL_LABELS = [["actual-root-not-subscribed","original-cas-applied-once","exact-original-authority","status-only-no-duplicate","money-history-unchanged"],["actual-root-not-ready","public-no-confirmation-or-reset-dispatch","no-applied-journal-or-effects","actual-root-readiness-restored","money-history-unchanged"],["complete","two-days-reset","bound-journal","money-history-unchanged"],["applied","known-false","new-attempt","money-history-unchanged"],["not-applied","zero-dispatch","money-history-unchanged"],["actual-commit-unknown","denied-proof-hold","later-pickup","restart-status-only","later-view-kept","original-proof","money-history-unchanged"],["unknown-second-day","untouched-tail","original-journal","status-only-settlement","view-kept","money-history-unchanged"],["committed","same-proof","epoch-kept","revision-increased","money-history-unchanged"],["authenticated-backend-denied","exact-day-and-operation-state-kept","money-history-unchanged"],["authenticated-backend-denied","exact-day-and-operation-state-kept","money-history-unchanged"],["authenticated-backend-denied","exact-day-and-operation-state-kept","money-history-unchanged"],["legacy-write-allowed","no-proof-created","status-unknown","money-history-unchanged"],["new-proof","retained-old-sql-receipt-still-applied","owned-expired-original-receipt-gc-only","old-status-unknown","original-held","server-kept","money-history-unchanged"],["one-applied","loser-held-or-false","distinct-attempts","one-epoch-step","money-history-unchanged"],["original-proof","no-snapshot","view-clock-kept","no-tail","money-history-unchanged"],["fault-hit","zero-dispatch","server-kept","no-memory-fallback","money-history-unchanged"],["actual-A-proof","archive-roundtrip","fresh-B-owner","unexecuted-B-unknown","ordinary-pickup-committed","A-proof-preserved","B-reset-applied","B-basis-bound","B-proof","no-A-intent-retarget","money-history-unchanged"],["independent-source-globals","captured-store-canaries","source-listener-lease-canaries","distinct-sdk-owner-registration","same-ready-original-basis","crossed-reference-zero-dispatch","two-distinct-pre-admission","one-original-applied","loser-fixed-false-or-unknown","one-epoch-no-tail","closed-owner-zero-dispatch","sibling-listener-survives","money-history-unchanged"],["independent-source-globals","same-ready-original-basis","durable-original-before-effects","actual-commit-unknown","original-held-no-tail","independent-later-pickup","sdk-source-recreated","same-original-status-only","later-view-clock-kept","no-execute-replay-or-tail","money-history-unchanged"]];
const SOURCE = { files: {} };
const fixtureControls = [];
const results = [], records = [], errors = [], cleanupErrors = [], frames = new Set(), httpTasks = new Set(), sockets = new Set();
let H, c, pool, fake, Window, bundleBytes, bundleHash, active, serial = 0, currentCase;
const ownedPgChildren = [], outboundViolations = [];
function outside(reason, target) { outboundViolations.push({ reason, target: String(target) }); throw new Error(reason); }
const hash = value => crypto.createHash('sha256').update(value).digest('hex'), clone = value => JSON.parse(JSON.stringify(value));
const equal = (a, b) => a === undefined || b === undefined ? a === b : isDeepStrictEqual(clone(a), clone(b));
function memory() { const data = new Map(); const store = { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null, setItem: (k, v) => { if (store.deny && k.startsWith(PREFIX)) { store.denials++; throw new Error('synthetic actual journal persistence denial'); } data.set(k, String(v)); },
    removeItem: k => data.delete(k), clear: () => data.clear(), deny: false, denials: 0 }; return store; }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function bounded(promise, label, ms = 15000) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' timed out')), ms); })]); } finally { clearTimeout(timer); } }
async function until(predicate, label) { const stop = Date.now() + 15000; while (!predicate()) { if (Date.now() > stop) throw new Error(label + ' not reached'); await new Promise(r => setTimeout(r, 10)); } }
function check(id, pass, detail) { if (results.some(row => row.id === id)) throw new Error('duplicate assertion ' + id);
    if (!currentCase) throw new Error('assertion outside actual scenario');
    if (!SQL_LABELS[PLAN.indexOf(currentCase.id)].some(label => currentCase.id + '/' + label === id)) throw new Error('unknown assertion ID ' + id);
    currentCase.assertions.push(id);
    results.push({ id, pass: !!pass, ...(pass ? {} : { detail }) }); console.log((pass ? 'PASS ' : 'FAIL ') + id + (pass ? '' : ' ' + JSON.stringify(detail)));
    if (!pass) throw new Error('assertion failed: ' + id); }
function locks() { const held = new Set(), calls = []; return { held, calls, api: { request: async (name, options, action) => {
    if (options?.ifAvailable !== true) throw new Error('only production ifAvailable contract supported'); calls.push(name);
    if (held.has(name)) return action(null); held.add(name); try { return await action({ name, mode: 'exclusive' }); } finally { held.delete(name); }
} } }; }
function requestHttp(input, init = {}) {
    const target = new URL(typeof input === 'string' ? input : input.url);
    if (!fake || target.origin !== fake.url || target.hostname !== '127.0.0.1' || target.protocol !== 'http:') outside('request escaped owned HTTP', target.origin);
    let task;
    task = new Promise((resolve, reject) => {
        const req = http.request(target, { method: init.method || 'GET', headers: init.headers || {}, signal: init.signal, timeout: 8000, agent: false }, res => {
            let body = ''; res.on('data', chunk => { body += chunk; }); res.on('error', reject);
            res.on('end', () => resolve(new Response(body || null, { status: res.statusCode, headers: res.headers })));
        });
        req.on('socket', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
        req.on('error', reject); req.on('timeout', () => req.destroy(new Error('owned HTTP timeout')));
        if (init.body !== undefined) req.write(init.body); req.end();
    });
    httpTasks.add(task); task.finally(() => httpTasks.delete(task)).catch(() => {}); return task;
}
async function build() {
    ({ Window } = await import(pathToFileURL(path.join(DEPS, 'happy-dom/lib/index.js')).href));
    const entry = [
        "export { createSupabaseSdk } from './ZoeW/src/services/supabase-sdk';",
        "export { createSupabaseTransport } from './ZoeW/src/services/supabase-transport';",
        "export { withConnectionOwnership,captureConnectionOperation,connectionFlowSnapshot } from './ZoeW/src/services/connection-flow';",
        "export { appLocalStore,appSessionStore } from './ZoeW/src/core/storage';",
        "export { dbListenerPendingPaths,dbListenerFailedPaths } from './ZoeW/src/core/text';",
        "export { allStores } from './ZoeW/src/core/store';",
        "export { firebaseState,dataState,uiState } from './ZoeW/src/core/state';",
        "export * from './ZoeW/src/domain/pickup-reset-proof';",
        "export { pickupResetRecord,buildPickupRecordFromSet,capturePickupContext,commitPickupMarks } from './ZoeW/src/domain/pickup';",
        "export { resetPickupStats } from './ZoeW/src/domain/collected';",
        "export { noteDbListenerAlive } from './ZoeW/src/services/db-listeners';",
        "export { dropOldestToast } from './ZoeW/src/ui/toast';",
        "export { runPickupResetBatch,resumePickupResetOutcomes,pickupResetPendingState } from './ZoeW/src/services/pickup-reset';"
    ].join('\n');
    fs.writeFileSync(path.join(OUT, 'source-entry.ts'), entry + '\n');
    const build = require(path.join(DEPS, 'esbuild')).buildSync({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, contents: entry },
        bundle: true, platform: 'node', format: 'cjs', write: false, metafile: true, logLevel: 'error', define: { 'import.meta.env': '{}' } });
    bundleBytes = build.outputFiles[0].contents; bundleHash = hash(bundleBytes);
    fs.writeFileSync(path.join(OUT, 'context-source.bundle.cjs'), bundleBytes);
    fs.writeFileSync(path.join(OUT, 'bundle-inputs.json'), JSON.stringify(build.metafile.inputs, null, 2) + '\n');
    const used = Object.keys(build.metafile.inputs).filter(name => !name.startsWith('<')).map(name => {
        const file = path.resolve(ROOT, name), bytes = fs.readFileSync(file);
        return { name, resolvedFile: file, sha256: hash(bytes), mode: (fs.statSync(file).mode & 0o777).toString(8), bytes: bytes.length };
    });
    fs.writeFileSync(path.join(OUT, 'BUNDLE-SOURCE-INPUTS.json'), JSON.stringify(used, null, 2) + '\n');
    for (const row of used) SOURCE.files[row.resolvedFile] = row.sha256;
    SOURCE.files[SHARED_FILE] = hash(fs.readFileSync(SHARED_FILE));
    for (const file of [__filename, path.join(ROOT, 'audit-tools/emu/pickup-reset-applied-sdk-test.js'), ...migrationFiles().map(name => path.join(ROOT, 'supabase/migrations', name)), path.join(ROOT,'audit-tools/supabase-pg.js'), path.join(ROOT,'audit-tools/supabase-fake-server.js')]) SOURCE.files[file] = hash(fs.readFileSync(file));
}
function evaluate(label, coordinator, store = memory(), session = memory()) {
    const dom = new Window({ url: 'https://f09-context-' + label.toLowerCase() + '.invalid' });
    Object.defineProperty(dom, 'localStorage', { configurable: true, value: store });
    Object.defineProperty(dom, 'sessionStorage', { configurable: true, value: session });
    class OwnedWebSocket extends WebSocket {
        constructor(url, protocols) {
            const target = new URL(url);
            if (!fake || target.hostname !== '127.0.0.1' || target.port !== new URL(fake.url).port || target.protocol !== 'ws:') outside('WebSocket escaped owned loopback', target.origin);
            super(url, protocols);
        }
    }
    const module = { exports: {} }, moduleCache = new Map(), requireHere = createRequire(path.join(OUT, 'context-source.bundle.cjs'));
    const sandbox = { module, exports: module.exports, require: name => {
        if (!moduleCache.has(name)) moduleCache.set(name, requireHere(name)); return moduleCache.get(name);
    }, __filename: path.join(OUT, 'context-' + label + '.cjs'), __dirname: OUT, window: dom, document: dom.document,
        navigator: dom.navigator, localStorage: store, sessionStorage: session, crypto: crypto.webcrypto, process, Buffer, console,
        URL, URLSearchParams, Headers, Request, Response, TextEncoder, TextDecoder, AbortController, AbortSignal, MessageChannel, WebSocket: OwnedWebSocket,
        setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate, queueMicrotask, structuredClone, atob, btoa,
        performance, fetch: input => outside('unowned global fetch', input),
        requestAnimationFrame: cb => dom.requestAnimationFrame(cb), cancelAnimationFrame: id => dom.cancelAnimationFrame(id),
        confirm: () => { frame.confirmations++; return true; }, alert: () => {} };
    for (const name of ['HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Event', 'CustomEvent', 'DOMException', 'MutationObserver']) sandbox[name] = dom[name];
    const context = vm.createContext(sandbox, { name: 'F09 production source ' + label });
    vm.runInContext(Buffer.from(bundleBytes).toString(), context, { filename: sandbox.__filename, timeout: 10000 });
    const frame = { label, api: module.exports, module, moduleCache, context, dom, store, session, coordinator, tasks: new Set(),
        calls: [], listenerValues: [], listenerErrors: [], closing: false, closed: false, denyStatus: false, stops: [], releases: [], confirmations: 0 };
    frames.add(frame); return frame;
}
function task(frame, promise) { frame.tasks.add(promise); promise.finally(() => frame.tasks.delete(promise)).catch(() => {}); return promise; }
function pending(frame) { const rows = []; for (let i = 0; i < frame.store.length; i++) { const key = frame.store.key(i); if (key.startsWith(PREFIX)) rows.push({ key, value: JSON.parse(frame.store.getItem(key)) }); } return rows; }
function activate(frame) {
    const { api, sdk, app, auth, db } = frame; frame.store.setItem('zoew_firebase_config', JSON.stringify(app.options));
    Object.assign(api.firebaseState, { db, fb: sdk, auth, authGeneration: (api.firebaseState.authGeneration || 0) + 1, firebaseConfig: app.options,
        isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseInitialized: true, isDatabaseConnected: true, dbListenersFailed: false,
        hasEverConnectedToDatabase: true, serverClockTrusted: true, serverTimeOffsetMs: 0, sessionExpiryCheck: 'live' });
}
async function connect(frame, fixture, ready = true) {
    const { api } = frame;
    const raw = api.createSupabaseSdk(cfg => api.createSupabaseTransport(cfg, { localStorage: frame.store, sessionStorage: frame.session, fetchTimeoutMs: 4000,
        fetch: async (input, init) => {
            if (frame.closing) throw new Error('frame fetch after closing');
            const url = new URL(typeof input === 'string' ? input : input.url), fn = url.pathname.split('/').pop();
            if (url.pathname.includes('/rest/v1/rpc/')) {
                const body = init?.body ? JSON.parse(String(init.body)) : {}; frame.calls.push({ fn, body: clone(body), bodyText: String(init?.body || '') });
                if (frame.denyStatus && fn === 'zoe_pickup_reset_status_v1') return new Response(JSON.stringify({ code: '42501', message: 'synthetic original status unavailable' }), { status: 403 });
            }
            return requestHttp(input, init);
        } }), { docsCache: null, writeJournal: null, pickupReset: { boundReceipt: api.pickupResetBoundReceipt, receiptMatches: api.pickupResetReceiptMatches, cas: api.pickupResetCasOf },
        onListenerError: error => frame.listenerErrors.push(String(error.message || error)), onWriteRecovery() {}, onAccountBlocked() {}, onTxOutcomeUnknown() {},
        dbOptions: { pollFallbackMs: 600000, retryStepsMs: [20, 50] } });
    frame.rawSdk = raw; frame.sdk = api.withConnectionOwnership(raw);
    frame.app = frame.sdk.initializeApp({ supabaseUrl: fake.url, supabaseKey: 'sb_publishable_f09_synthetic', loginDomain: 'users.zoew.invalid' });
    frame.auth = frame.sdk.getAuth(frame.app); frame.db = frame.sdk.getDatabase(frame.app);
    await bounded(task(frame, frame.sdk.signInWithEmailAndPassword(frame.auth, fixture.email, 'synthetic-f09-only')), 'owned synthetic login');
    await until(() => frame.db.isReady() && frame.sdk.tenantScope(frame.auth) === fixture.tenant, 'actual SDK tenant readiness');
    Object.defineProperty(frame.dom.navigator, 'locks', { configurable: true, value: frame.coordinator.api });
    activate(frame);
    api.firebaseState.dbRefDailyPickup = frame.sdk.ref(frame.db, PICKUP);
    api.dbListenerPendingPaths.clear(); api.dbListenerPendingPaths.add('dailyPickup'); api.dbListenerFailedPaths.clear();
    api.dataState.dailyPickupData = {}; api.dataState.pickupResetInFlight = false; api.uiState.currentFilterMode = 'all'; api.uiState.toasts = [];
    frame.ref = frame.sdk.ref(frame.db, PICKUP + '/' + DAY); frame.rootRef = frame.sdk.ref(frame.db, PICKUP);
    if (ready) await rootReady(frame);
}
async function rootReady(frame) {
    if (!frame.rootStarted) { frame.rootStarted = true;
        frame.stops.push(frame.sdk.onValue(frame.rootRef, snapshot => { frame.listenerValues.push(clone(snapshot.val()));
            frame.api.dataState.dailyPickupData = snapshot.val() || {}; frame.api.noteDbListenerAlive('dailyPickup');
        }, error => frame.listenerErrors.push(String(error))));
    }
    await until(() => frame.listenerValues.length > 0, 'actual pickup ROOT first snapshot');
}
async function closeFrame(frame) {
    if (frame.closed) return;
    if (frame.tasks.size) throw new Error('refuse closing frame with pending SDK tasks: ' + frame.label);
    frame.closing = true; frame.releases.splice(0).forEach(release => release()); frame.stops.splice(0).forEach(stop => stop());
    while (frame.api.uiState.toasts.length) frame.api.dropOldestToast();
    if (frame.sdk && frame.app) await bounded(frame.sdk.deleteApp(frame.app), 'delete own app ' + frame.label);
    await bounded(frame.dom.happyDOM.abort(), 'abort own DOM'); frame.closed = true; frames.delete(frame);
}
async function bootstrap() {
    const { createPgHarness } = require(path.join(ROOT, 'audit-tools/supabase-pg.js'));
    const config = fs.readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8');
    H = createPgHarness({ depsDirs: [path.join(ROOT, 'supabase/node_modules')], shimDir: path.join(ROOT, 'audit-tools/supabase-shim'), wantMajor: Number(config.match(/^major_version\s*=\s*(\d+)/m)[1]) });
    if (H.unavailableReason()) throw new Error(H.unavailableReason());
    const originalSpawn = cp.spawn;
    try { cp.spawn = function (...args) { const child = Reflect.apply(originalSpawn, this, args); ownedPgChildren.push(child); return child; }; await H.start(); }
    finally { cp.spawn = originalSpawn; }
    const database = await H.freshDb('no-default-grants'); c = database.c;
    const migrations = migrationFiles();
    if (migrations.length !== 50) throw new Error('not exact canonical50 migrations');
    for (const name of migrations) await c.query(fs.readFileSync(path.join(ROOT, 'supabase/migrations', name), 'utf8'));
    pool = new H.PG.Pool({ host: '127.0.0.1', port: c.connectionParameters.port, user: 'postgres', database: database.name, max: 4 });
    fake = await require(path.join(ROOT, 'audit-tools/supabase-fake-server.js')).startFakeSupabase({ pool });
    fake.setRpcHook(event => active?.hook?.(event));
    console.log('READY owned HTTP PostgreSQL ' + H.pgBin.version + ' migrations50; two independent VM production-source evaluations');
}
async function snapshot(tenant) { return (await c.query(`select jsonb_build_object('state',(select to_jsonb(s) from public.zoe_tenant_state s where tenant_id=$1),
    'docs',(select coalesce(jsonb_agg(to_jsonb(d) order by root,key),'[]') from public.zoe_docs d where tenant_id=$1),
    'ops',(select coalesce(jsonb_agg(to_jsonb(o) order by op_id),'[]') from public.zoe_ops o where tenant_id=$1)) as value`, [tenant])).rows[0].value; }
async function dayValue(tenant, day = DAY) { return (await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, PICKUP, day])).rows[0]?.value; }
const resetCalls = frame => frame.calls.filter(row => /^zoe_pickup_reset_/.test(row.fn));
async function fixture(label, options = {}) {
    const id = ++serial, email = 'f09_paired_' + id + '@users.zoew.invalid', uid = await H.makeAuthUser(c, email);
    const tenant = (await c.query("insert into public.tenants(name,branch_code,expires_at) values($1,$2,now()+interval '30 days') returning id", ['F09 paired ' + label, 'f09_pair_' + id])).rows[0].id;
    await c.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [uid, tenant, 'f09_pair_' + id]);
    const coordinator = locks(), a = evaluate(label + '-A', coordinator);
    const seedInput = await FIXTURE.seedFor(options.caseId || 'ready-service-positive', a.api);
    if (!seedInput || !equal(FIXTURE.commonSeed(), NATIVE.seed) || seedInput.profile !== FIXTURE.seedProfileFor(options.caseId || 'ready-service-positive')) throw new Error('shared fixture contract mismatch');
    const initial = clone(seedInput.value); if (options.mutate) options.mutate(initial);
    await adminWrite(tenant, Object.entries(initial).flatMap(([root, rows]) => Object.entries(rows).map(([key, value]) => ({ k: 'set', p: [root, key], v: value }))));
    fake.addUser(email, 'synthetic-f09-only', uid);
    const f = { tenant, uid, email, a, b: null, coordinator, hook: null, allFrames: [a], snapshots: [], seedInput };
    active = f; await connect(a, f, options.ready !== false); return f;
}
async function sibling(f, label = 'B') {
    const frame = evaluate('case-' + serial + '-' + label, f.coordinator); f.allFrames.push(frame); await connect(frame, f); f.b = frame; return frame;
}
async function recreate(f, old, ready = false) {
    await closeFrame(old); const fresh = evaluate('recreated-' + (++serial), f.coordinator, old.store, old.session);
    f.allFrames.push(fresh); f.a = fresh; await connect(fresh, f, ready); return fresh;
}
async function request(frame, f, _label, basis = PRIOR, day = DAY) {
    const sequence = ++serial, independent = currentCase?.id.startsWith('independent-context-');
    const scope = fake.url + '#' + f.tenant;
    const batchId = independent ? 'independent-' + frame.label + '-' + sequence : 'native-batch-' + sequence;
    const nonce = (independent ? 'independent-nonce-' : 'native-nonce-') + sequence;
    const batchHash = await frame.api.pickupResetBatchHash(f.tenant, scope, f.uid, batchId, [day]);
    const context = Object.freeze({ v: 1, scope, batchId, batchHash, dayId: batchId + ':' + day, day, nonce });
    const casText = frame.api.pickupResetCasText(day, basis, frame.api.pickupResetRecord(basis));
    return Object.freeze({ tenant: f.tenant, actorUid: f.uid, context, attemptId: await frame.api.pickupResetAttemptId(f.tenant, f.uid, context, casText), casText });
}
function identityCanaries(a, b) {
    const captured = a.api.appLocalStore === a.store && b.api.appLocalStore === b.store && a.api.appSessionStore === a.session && b.api.appSessionStore === b.session;
    a.api.appLocalStore.setItem('context-canary', 'A'); b.api.appLocalStore.setItem('context-canary', 'B');
    const storage = a.store.getItem('context-canary') === 'A' && b.store.getItem('context-canary') === 'B';
    const counts = { a: 0, b: 0 }, offA = a.api.dataState.subscribe(() => counts.a++), offB = b.api.dataState.subscribe(() => counts.b++);
    a.api.dataState.contextCanary = 'A'; a.api.dataState.flush(); const first = { ...counts };
    b.api.dataState.contextCanary = 'B'; b.api.dataState.flush(); offA(); offB();
    a.api.dbListenerPendingPaths.add('A-only'); const listener = !b.api.dbListenerPendingPaths.has('A-only'); a.api.dbListenerPendingPaths.delete('A-only');
    return { modules: a.context !== b.context && a.module !== b.module && a.moduleCache !== b.moduleCache && a.api !== b.api,
        captured, storage, state: a.api.firebaseState !== b.api.firebaseState && a.api.dataState !== b.api.dataState
            && a.api.allStores() !== b.api.allStores() && a.api.dataState.contextCanary === 'A' && b.api.dataState.contextCanary === 'B',
        listeners: listener && a.api.dbListenerPendingPaths !== b.api.dbListenerPendingPaths && first.a === 1 && first.b === 0 && counts.a === 1 && counts.b === 1 };
}
function migrationFiles() { return fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort(); }
function loadNativeContract() {
    const file = path.join(ROOT, 'audit-tools/emu/pickup-reset-applied-sdk-test.js'), source = fs.readFileSync(file, 'utf8');
    const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
    if (sourceHash !== '0d3bcdb0de1c515a3715a4659bdd6190ff8ec5ec89e0e7370a26aa398f95a1a2') throw new Error('native counterpart changed; independently review matched contract before accepting it');
    const nodes = [], env = {}, parse = require(path.join(DEPS, 'acorn')).parse;
    function walk(node) { if (!node || typeof node !== 'object') return; if (node.type) nodes.push(node);
        for (const value of Object.values(node)) { if (Array.isArray(value)) value.forEach(walk); else if (value?.type) walk(value); } }
    walk(parse(source, { ecmaVersion: 'latest' }));
    function literal(node) {
        if (node?.type === 'Literal') return node.value;
        if (node?.type === 'Identifier' && Object.hasOwn(env, node.name)) return env[node.name];
        if (node?.type === 'ArrayExpression') return node.elements.map(literal);
        if (node?.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(prop => {
            if (prop.type !== 'Property' || prop.kind !== 'init') throw new Error('nonliteral fixture property');
            return [prop.computed ? literal(prop.key) : prop.key.name ?? prop.key.value, literal(prop.value)];
        }));
        if (node?.type === 'CallExpression' && node.callee.name === 'clone' && node.arguments.length === 1) return JSON.parse(JSON.stringify(literal(node.arguments[0])));
        throw new Error('nonliteral native fixture: ' + node?.type);
    }
    const wanted = new Set(['P', 'D', 'M', 'H', 'DAY', 'OTHER', 'TAIL', 'PROJECT', 'UID', 'PRIOR', 'MONEY']);
    for (const node of nodes) if (node.type === 'VariableDeclarator' && wanted.has(node.id.name)) env[node.id.name] = literal(node.init);
    const plan = literal(nodes.find(node => node.type === 'VariableDeclarator' && node.id.name === 'PLAN').init);
    for (const node of nodes) if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.object.name === 'PLAN' && node.callee.property.name === 'push') plan.push(...node.arguments.map(literal));
    const seed = literal(nodes.find(node => node.type === 'VariableDeclarator' && node.id.name === 'seed').init.body);
    if (plan.length !== 19 || new Set(plan.map(row => row[0])).size !== 19 || plan.reduce((sum, row) => sum + row[1].length, 0) !== 103) throw new Error('native contract inventory mismatch');
    // This is data extraction, never native checker/engine execution.
    if (!isDeepStrictEqual(seed, SEED)) throw new Error('full native/SQL seed mismatch');
    return { sourceHash, plan, seed, nativeAuthority: { project: env.PROJECT, actorUid: env.UID }, engine: 'UNRUN_BY_THIS_CHECKER' };
}
async function adminWrite(tenant, ops) {
    const result = await H.as(c, { role: 'service_role' }, 'select public.zoe_admin_write($1,$2,$3::jsonb,false) as value', [tenant, 'f09_paired_admin_' + (++serial), JSON.stringify(ops)]);
    if (result.error || result.rows[0]?.value?.ok !== true) throw new Error('owned synthetic fixture admin setup failed: ' + JSON.stringify(result));
}
async function logical(tenant) {
    const docs = (await c.query('select root,key,value from public.zoe_docs where tenant_id=$1 order by root,key', [tenant])).rows;
    const root = {}; for (const row of docs) (root[row.root] ||= {})[row.key] = row.value; return root;
}
async function requireSeed(f) {
    const actual = await logical(f.tenant);
    if (!equal(actual, f.seedInput.value)) throw new Error('stored actual PG fixture differs from native full seed/profile');
    return actual;
}
async function seedPoisonControls() {
    const poisons = [ ['wrong-packages', value => value[PICKUP][DAY].packagesPickedUp++], ['missing-tail', value => delete value[PICKUP][TAIL]],
        ['wrong-money', value => value[DAILY][DAY].codDollar++], ['missing-month', value => delete value[MONTHLY]], ['wrong-history-count', value => value[HISTORY].retained.count++] ];
    for (const [id, mutate] of poisons) {
        const f = await fixture('poison-' + id, { mutate, ready: false }); let refused = false;
        try { await requireSeed(f); } catch (error) { refused = /stored actual PG fixture differs/.test(error.message); }
        const pass = refused && resetCalls(f.a).length === 0 && (await snapshot(f.tenant)).ops.every(row => !row.result?.reset);
        fixtureControls.push({ id, pass, actualStored: await logical(f.tenant), resetRpcCalls: resetCalls(f.a).length });
        await closeFrame(f.a); active = null;
        if (!pass) throw new Error('actual fixture poison was not rejected before Reset: ' + id);
    }
}
const execute = (frame, req) => bounded(task(frame, frame.sdk.executePickupReset(frame.sdk.ref(frame.db, PICKUP + '/' + req.context.day), req, () => true)), 'actual SDK Reset');
const requestOnly = req => ({ tenant: req.tenant, actorUid: req.actorUid, context: clone(req.context), attemptId: req.attemptId, casText: req.casText });
const status = (frame, req) => bounded(task(frame, frame.sdk.pickupResetStatus(frame.sdk.ref(frame.db, PICKUP + '/' + req.context.day), requestOnly(req), () => true)), 'actual original status');
const bound = (frame, req, proof = 'operation') => frame.api.pickupResetBoundReceipt(req.tenant, req.actorUid, req.context, req.attemptId, req.casText, proof);
async function apply(frame, f) { const req = await request(frame, f, undefined, await dayValue(f.tenant)); return { request: req, result: await execute(frame, req) }; }
async function preserve(f, id) {
    const root = await logical(f.tenant);
    check(id('money-history-unchanged'), [DAILY, MONTHLY, HISTORY].every(key => equal(root[key], SEED[key])));
}
function drop(f, frame, day = DAY) {
    let dropped = false;
    f.hook = event => {
        if (event.fn === 'zoe_pickup_reset_execute_v1' && event.phase === 'after' && event.body.p_context.day === day && !dropped) {
            dropped = true; frame.denyStatus = true; return 'drop';
        }
    };
    return () => dropped;
}
async function rawWrite(frame, f, value) {
    return task(frame, frame.app._transport.rpc('zoe_write_v2', { p_expected_tenant: f.tenant, p_op_id: 'f09_paired_raw_' + (++serial),
        p_ops: [{ k: 'set', p: [PICKUP, DAY], v: value }] }, 15000));
}
async function installImportedProof(frame, f, applied) {
    const receipt = applied.result.pickupReset;
    if (!frame.api.pickupResetReceiptMatches(receipt, await bound(frame, applied.request))) throw new Error('cannot derive imported proof without actual SQL APPLIED');
    const physical = { ...(await dayValue(f.tenant)), pickupResetApplied: { ...receipt, proof: 'native-day' } };
    await adminWrite(f.tenant, [{ k: 'set', p: [PICKUP, DAY], v: physical }]);
    if (!equal(await dayValue(f.tenant), physical)) throw new Error('supported imported-day precondition did not persist');
    currentCase.providerMechanism = 'SQL operation receipt first proved APPLIED; supported synthetic admin/import stores codec-valid native-day projection. Fresh SQL Reset itself does not create this field.';
    return physical;
}
async function pickup(frame, f, code = 'NEW', phoneKey = 'NEW') {
    const result = await task(frame, frame.sdk.runTransaction(frame.ref, current => frame.api.buildPickupRecordFromSet({ [code]: phoneKey },
        { revision: current.pickupRevision + 1, epoch: current.pickupResetEpoch }, current)));
    return { result, day: await dayValue(f.tenant) };
}
async function behavior(index, f, id) {
    let a = f.a; const caseId = PLAN[index];
    if (caseId === 'native-strict-cas-cold') {
        const req = await request(a, f);
        check(id('actual-root-not-subscribed'), !a.rootStarted && a.listenerValues.length === 0 && equal(a.api.dataState.dailyPickupData, {}));
        const result = await execute(a, req), applied = await snapshot(f.tenant);
        currentCase.coldObserved = { committed: result.committed, pickupReset: result.pickupReset, resetCalls: clone(resetCalls(a)),
            after: applied, knownScopeAfterInitialAdapterSync: a.sdk.tenantScope(a.auth), rootSnapshots: a.listenerValues.length };
        check(id('original-cas-applied-once'), result.committed === true && equal(await dayValue(f.tenant), CLEARED)
            && equal(await dayValue(f.tenant, OTHER), PRIOR) && equal(await dayValue(f.tenant, TAIL), PRIOR)
            && applied.ops.filter(row => row.op_id === req.attemptId && row.result?.reset).length === 1);
        check(id('exact-original-authority'), equal(result.pickupReset, await bound(a, req)) && result.pickupReset.tenant === f.tenant && result.pickupReset.actorUid === f.uid
            && resetCalls(a).length === 1 && resetCalls(a)[0].body.p_attempt_id === req.attemptId && resetCalls(a)[0].body.p_cas_text === req.casText);
        const resolved = await status(a, req);
        check(id('status-only-no-duplicate'), resolved.outcome === 'applied' && equal(resolved.pickupReset, result.pickupReset) && equal(applied, await snapshot(f.tenant))
            && resetCalls(a).length === 2 && resetCalls(a).filter(row => row.fn.endsWith('execute_v1')).length === 1 && !a.rootStarted && a.listenerValues.length === 0);
        currentCase.providerSpecific = true;
        currentCase.providerMechanism = 'Root-approved provider-specific outcome: SQL RPC validates original CAS atomically and APPLIES after adapter/tenant readiness without a ROOT listener. Firebase speculative cold-null callback returns known-false. Public UI pending-floor refusal remains the separately matched N2. Baseline708343... retained1PASS/1contractRED; no production policy changed.';
    } else if (caseId === 'ui-pending-first-snapshot') {
        const before = await snapshot(f.tenant);
        check(id('actual-root-not-ready'), !a.rootStarted && a.listenerValues.length === 0 && a.api.dbListenerPendingPaths.has('dailyPickup') && equal(a.api.dataState.dailyPickupData, {}));
        await task(a, a.api.resetPickupStats());
        check(id('public-no-confirmation-or-reset-dispatch'), a.confirmations === 0 && resetCalls(a).length === 0);
        check(id('no-applied-journal-or-effects'), pending(a).length === 0 && equal(before, await snapshot(f.tenant)));
        await rootReady(a);
        check(id('actual-root-readiness-restored'), a.listenerValues.length > 0 && !a.api.dbListenerPendingPaths.has('dailyPickup') && equal(a.listenerValues[0], SEED[PICKUP]));
    } else if (caseId === 'ready-service-positive') {
        const result = await task(a, a.api.runPickupResetBatch([DAY, OTHER]));
        check(id('complete'), result.status === 'complete' && result.doneCount === 2);
        check(id('two-days-reset'), equal(await dayValue(f.tenant), CLEARED) && equal(await dayValue(f.tenant, OTHER), CLEARED) && equal(await dayValue(f.tenant, TAIL), PRIOR));
        const entry = pending(a)[0]?.value;
        check(id('bound-journal'), entry?.complete === true && entry.settled === true && entry.days.length === 2 && entry.tenant === f.tenant && entry.actorUid === f.uid
            && await Promise.all(entry.days.map(async day => day.attempts.length === 1 && day.attempts[0].outcome === 'applied'
                && a.api.pickupResetReceiptMatches(day.attempts[0].receipt, await bound(a, day.attempts[0])))).then(values => values.every(Boolean)));
    } else if (caseId === 'positive-conflict-explicit') {
        const first = await apply(a, f); check(id('applied'), first.result.committed === true && equal(first.result.pickupReset, await bound(a, first.request)));
        const before = await snapshot(f.tenant), stale = await request(a, f), conflict = await execute(a, stale);
        check(id('known-false'), conflict.committed === false && conflict.pickupReset === undefined && equal(await snapshot(f.tenant), before));
        const second = await apply(a, f);
        check(id('new-attempt'), second.result.committed === true && second.request.attemptId !== first.request.attemptId && equal(await dayValue(f.tenant), { pickupRevision: 7, pickupResetEpoch: 4, packagesPickedUp: 0 }));
    } else if (caseId === 'same-intent-changed-body') {
        const req = await request(a, f); let error;
        try { await execute(a, { ...req, context: { ...req.context, nonce: 'changed' } }); } catch (caught) { error = caught; }
        check(id('not-applied'), error?.txOutcome === 'not-applied');
        check(id('zero-dispatch'), resetCalls(a).length === 0 && equal(await logical(f.tenant), SEED));
    } else if (caseId === 'lost-ack-readonly-later-pickup') {
        const req = await request(a, f), dropped = drop(f, a); let error;
        try { await execute(a, req); } catch (caught) { error = caught; }
        const actual = (await snapshot(f.tenant)).ops.find(row => row.op_id === req.attemptId);
        check(id('actual-commit-unknown'), dropped() && error?.txOutcome === 'unknown' && equal(actual?.result?.reset, await bound(a, req)) && equal(await dayValue(f.tenant), CLEARED));
        check(id('denied-proof-hold'), (await status(a, req)).outcome === 'unknown' && resetCalls(a).some(row => row.fn.endsWith('status_v1')));
        f.hook = null; a.denyStatus = false; const picked = await pickup(a, f); check(id('later-pickup'), picked.result.committed === true && picked.day.packagesPickedUp === 1);
        a = await recreate(f, a); const view = clone(a.api.dataState.dailyPickupData), before = await snapshot(f.tenant), answer = await status(a, req);
        check(id('restart-status-only'), answer.outcome === 'applied' && resetCalls(a).length === 1 && resetCalls(a)[0].fn.endsWith('status_v1') && !a.rootStarted);
        check(id('later-view-kept'), equal(view, a.api.dataState.dailyPickupData) && equal(before, await snapshot(f.tenant)) && (await dayValue(f.tenant)).packagesPickedUp === 1);
        check(id('original-proof'), equal(answer.pickupReset, await bound(a, req)));
    } else if (caseId === 'public-unknown-manual-resume') {
        const dropped = drop(f, a, OTHER), result = await task(a, a.api.runPickupResetBatch([DAY, OTHER, TAIL])), original = clone(pending(a)[0]);
        check(id('unknown-second-day'), dropped() && result.status === 'hold' && result.doneCount === 1 && resetCalls(a).filter(row => row.fn.endsWith('execute_v1')).length === 2
            && original.value.days[1].attempts[0].outcome === 'pending');
        check(id('untouched-tail'), equal(await dayValue(f.tenant, TAIL), PRIOR) && original.value.days[2].attempts.length === 0);
        f.hook = null; a.denyStatus = false; a = await recreate(f, a); const view = clone(a.api.dataState.dailyPickupData), before = await snapshot(f.tenant);
        const resumed = await task(a, a.api.resumePickupResetOutcomes()), saved = pending(a)[0];
        check(id('original-journal'), saved.key === original.key && saved.value.days[1].attempts[0].attemptId === original.value.days[1].attempts[0].attemptId && saved.value.days[1].attempts[0].casText === original.value.days[1].attempts[0].casText);
        check(id('status-only-settlement'), resumed.resolved === 1 && saved.value.settled === true && saved.value.complete === false && resetCalls(a).length === 1 && resetCalls(a)[0].fn.endsWith('status_v1') && !a.rootStarted);
        check(id('view-kept'), equal(view, a.api.dataState.dailyPickupData) && equal(before, await snapshot(f.tenant)));
    } else if (caseId === 'ordinary-pickup-preserves') {
        const first = await apply(a, f), priorReceipt = clone(first.result.pickupReset), picked = await pickup(a, f, 'NEW_NATIVE', '000000009');
        check(id('committed'), picked.result.committed === true && picked.day.packagesPickedUp === 1);
        check(id('same-proof'), equal((await status(a, first.request)).pickupReset, priorReceipt));
        check(id('epoch-kept'), picked.day.pickupResetEpoch === 3); check(id('revision-increased'), picked.day.pickupRevision === 7);
    } else if (['native-drop-proof-rejected', 'native-malformed-proof-rejected', 'old-client-failclosed-after-proof'].includes(caseId)) {
        const first = await apply(a, f), prior = await dayValue(f.tenant), before = await snapshot(f.tenant); let next;
        if (f.seedInput.profile !== 'imported-native-day' || first.result.committed !== true || !equal(prior.pickupResetApplied, await bound(a, first.request, 'native-day'))) throw new Error('actual typed Reset did not advance shared imported native-day proof');
        if (caseId === 'native-drop-proof-rejected') { next = { ...prior, pickupRevision: 7, packagesPickedUp: 1, pickedUpPhones: { NEW: 1 }, pickedUpBarcodes: { NEW: 'NEW' } }; delete next.pickupResetApplied; }
        else { next = a.api.pickupResetRecord(prior); if (caseId === 'native-malformed-proof-rejected') { const req = await request(a, f, undefined, prior); next.pickupResetApplied = { ...(await bound(a, req, 'native-day')), intentHash: 'bad' }; } }
        const rawBefore = a.calls.length; let error; try { await rawWrite(a, f, next); } catch (caught) { error = caught; }
        currentCase.rawOutcome = error ? { code: error.code, name: error.name, message: error.message } : { accepted: true };
        check(id('authenticated-backend-denied'), error?.code === '42501' && a.calls.slice(rawBefore).some(row => row.fn === 'zoe_write_v2'));
        check(id('exact-day-and-operation-state-kept'), equal(prior, await dayValue(f.tenant)) && equal(before, await snapshot(f.tenant)));
    } else if (caseId === 'legacy-unreceipted-hold') {
        const req = await request(a, f), reset = await rawWrite(a, f, a.api.pickupResetRecord(PRIOR));
        check(id('legacy-write-allowed'), reset.ok === true && equal(await dayValue(f.tenant), CLEARED));
        check(id('no-proof-created'), !(await dayValue(f.tenant)).pickupResetApplied && !(await snapshot(f.tenant)).ops.some(row => row.op_id === req.attemptId));
        check(id('status-unknown'), (await status(a, req)).outcome === 'unknown');
    } else if (caseId === 'receipt-replacement-HOLD') {
        drop(f, a); const partial = await task(a, a.api.runPickupResetBatch([DAY])), original = clone(pending(a)[0]), req = original.value.days[0].attempts[0];
        if (partial.status !== 'hold') throw new Error('failed to retain actual original unknown journal');
        f.hook = null; a.denyStatus = false; a = await recreate(f, a, true); const newer = await apply(a, f);
        check(id('new-proof'), newer.result.committed === true && newer.request.attemptId !== req.attemptId);
        const oldBeforeGC = await status(a, req);
        check(id('retained-old-sql-receipt-still-applied'), oldBeforeGC.outcome === 'applied' && equal(oldBeforeGC.pickupReset, await bound(a, req)));
        const aged = await c.query("update public.zoe_ops set created_at=now()-interval '3 days' where tenant_id=$1 and op_id=$2 returning op_id", [f.tenant, req.attemptId]);
        await c.query('select private.zoe_housekeeping($1)', [f.tenant]);
        const gcState = await snapshot(f.tenant);
        check(id('owned-expired-original-receipt-gc-only'), aged.rowCount === 1 && !gcState.ops.some(row => row.op_id === req.attemptId) && gcState.ops.some(row => row.op_id === newer.request.attemptId));
        const before = await snapshot(f.tenant), rpcBefore = resetCalls(a).length, unknown = await status(a, req), resumed = await task(a, a.api.resumePickupResetOutcomes());
        check(id('old-status-unknown'), unknown.outcome === 'unknown' && unknown.pickupReset === null);
        check(id('original-held'), resumed.held === true && pending(a)[0].value.days[0].attempts[0].outcome === 'pending' && resetCalls(a).slice(rpcBefore).every(row => row.fn.endsWith('status_v1')));
        check(id('server-kept'), equal(before, await snapshot(f.tenant)));
        currentCase.providerMechanism = 'SQL keeps original zoe_ops receipt across newer Reset within retention. Only original owned receipt is aged3days and actual existing housekeeping removes it (two-day retention); this models missing/expired receipt, then UNKNOWN/HOLD; native latest-day replacement loses old proof earlier. No automatic GC policy was changed.';
    } else if (caseId === 'concurrent-reset') {
        const requests = await Promise.all([request(a, f), request(a, f)]), outcomes = await Promise.allSettled(requests.map(req => execute(a, req)));
        check(id('one-applied'), outcomes.filter(row => row.status === 'fulfilled' && row.value.committed === true).length === 1);
        check(id('loser-held-or-false'), outcomes.filter(row => row.status === 'fulfilled' ? row.value.committed === false : row.reason.txOutcome === 'unknown').length === 1);
        check(id('distinct-attempts'), requests[0].attemptId !== requests[1].attemptId);
        check(id('one-epoch-step'), equal(await dayValue(f.tenant), CLEARED) && resetCalls(a).filter(row => row.fn.endsWith('execute_v1')).length === 2);
    } else if (caseId === 'old-session-receipt-only') {
        const entered = deferred(), release = deferred(); a.releases.push(release.resolve);
        f.hook = async event => { if (event.fn === 'zoe_pickup_reset_execute_v1' && event.phase === 'after') { entered.resolve(); await release.promise; } };
        const req = await request(a, f), operation = execute(a, req); await bounded(entered.promise, 'actual SQL commit before old ACK owner transition');
        const oldScope = fake.url + '|' + f.uid;
        // Synthetic adapter-owner transition only: no password/revocation/Auth-server mutation.
        a.db.goOffline(); a.db.setAuthed(true, fake.url + '|synthetic-ended-f09-owner'); a.api.firebaseState.authGeneration++;
        await new Promise(resolve => setImmediate(resolve));
        a.api.dataState.dailyPickupData = { NEW_OWNER: { packagesPickedUp: 9 } }; a.api.firebaseState.serverTimeOffsetMs = 2468;
        const view = clone(a.api.dataState.dailyPickupData), clock = a.api.firebaseState.serverTimeOffsetMs;
        const newState = clone(a.db.snapshotState()), newCursor = a.db.cursor(); release.resolve(); const result = await operation;
        check(id('original-proof'), result.committed === true && equal(result.pickupReset, await bound(a, req)));
        check(id('no-snapshot'), result.snapshot === undefined);
        check(id('view-clock-kept'), equal(a.api.dataState.dailyPickupData, view) && a.api.firebaseState.serverTimeOffsetMs === clock && equal(a.db.snapshotState(), newState) && a.db.cursor() === newCursor);
        check(id('no-tail'), resetCalls(a).length === 1 && equal(await dayValue(f.tenant, OTHER), PRIOR));
        currentCase.providerMechanism = 'Synthetic in-memory owner transition after actual SQL commit; no Auth/password/revoke control. Original transport operation/typed receipt remain bound to original tenant/actor. Original scope: ' + oldScope;
    } else if (caseId === 'public-storage-denied') {
        const before = await snapshot(f.tenant); a.store.deny = true;
        let result; try { result = await task(a, a.api.runPickupResetBatch([DAY])); } finally { a.store.deny = false; }
        check(id('fault-hit'), a.store.denials > 0); check(id('zero-dispatch'), resetCalls(a).length === 0);
        check(id('server-kept'), equal(before, await snapshot(f.tenant))); check(id('no-memory-fallback'), pending(a).length === 0 && result.status !== 'complete');
    } else if (caseId === 'paired-native-archive-actor-preservation') {
        const first = await apply(a, f), physical = await installImportedProof(a, f, first), originalIntent = JSON.stringify(first.request), archive = await logical(f.tenant), text = JSON.stringify(archive);
        check(id('actual-A-proof'), first.result.committed === true && physical.pickupResetApplied.actorUid === f.uid && Object.keys(physical.pickupResetApplied).length === 17
            && equal(physical.pickupResetApplied, await bound(a, first.request, 'native-day')));
        await adminWrite(f.tenant, [{ k: 'set', p: [PICKUP, DAY], v: CLEARED }]);
        const file = path.join(OUT, 'archive-' + serial + '.json'); fs.writeFileSync(file, text); const restored = JSON.parse(fs.readFileSync(file, 'utf8'));
        await adminWrite(f.tenant, Object.entries(restored).flatMap(([root, days]) => Object.entries(days).map(([key, value]) => ({ k: 'set', p: [root, key], v: value }))));
        check(id('archive-roundtrip'), equal(await logical(f.tenant), archive) && hash(fs.readFileSync(file)) === hash(text));
        await closeFrame(a); const bEmail = 'paired_archive_b_' + (++serial) + '@users.zoew.invalid', bUid = await H.makeAuthUser(c, bEmail);
        await c.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [bUid, f.tenant, 'paired_archive_b_' + serial]); fake.addUser(bEmail, 'synthetic-f09-only', bUid);
        a = evaluate('archive-B-' + serial, f.coordinator); f.allFrames.push(a); f.a = a; const bFixture = { ...f, uid: bUid, email: bEmail }; await connect(a, bFixture);
        check(id('fresh-B-owner'), a.auth.currentUser.uid === bUid && bUid !== f.uid && pending(a).length === 0 && equal(a.api.dataState.dailyPickupData, archive[PICKUP]));
        const unexecuted = await request(a, bFixture, undefined, physical);
        check(id('unexecuted-B-unknown'), (await status(a, unexecuted)).outcome === 'unknown' && !resetCalls(a).some(row => row.fn.endsWith('execute_v1')));
        const picked = await pickup(a, f, 'NEW_B', 'PHONE_B');
        check(id('ordinary-pickup-committed'), picked.result.committed === true && picked.day.pickupRevision === 7 && picked.day.pickupResetEpoch === 3 && picked.day.packagesPickedUp === 1);
        check(id('A-proof-preserved'), equal(picked.day.pickupResetApplied, physical.pickupResetApplied));
        const reset = await task(a, a.api.runPickupResetBatch([DAY])), saved = await dayValue(f.tenant), entry = pending(a)[0]?.value;
        check(id('B-reset-applied'), reset.status === 'complete' && reset.doneCount === 1 && entry?.complete === true && entry.settled === true && saved.pickupRevision === 8 && saved.pickupResetEpoch === 4);
        const attempt = entry.days[0].attempts[0];
        const actualWire = a.calls.filter(row => row.fn === 'zoe_pickup_reset_execute_v1').at(-1)?.body, operation = JSON.parse(attempt.casText);
        check(id('B-basis-bound'), !!actualWire && attempt.casText === actualWire.p_cas_text && attempt.attemptId === actualWire.p_attempt_id
            && JSON.stringify(attempt.context) === JSON.stringify(actualWire.p_context) && attempt.tenant === actualWire.p_expected_tenant
            && equal(operation.x, picked.day) && equal(operation.v, a.api.pickupResetRecord(picked.day)) && attempt.outcome === 'applied');
        check(id('B-proof'), saved.pickupResetApplied.actorUid === bUid && equal(saved.pickupResetApplied, await bound(a, attempt, 'native-day')) && equal(attempt.receipt, await bound(a, attempt)));
        check(id('no-A-intent-retarget'), JSON.stringify(first.request) === originalIntent && attempt.actorUid === bUid && attempt.attemptId !== first.request.attemptId
            && attempt.attemptId !== unexecuted.attemptId && equal(await dayValue(f.tenant, OTHER), PRIOR) && equal(await dayValue(f.tenant, TAIL), PRIOR));
    } else if (caseId === 'independent-context-fixed-cas') { await independentFixed(f, id); }
    else if (caseId === 'independent-context-unknown-restart') { await independentUnknown(f, id); }
    else throw new Error('unimplemented native counterpart ID ' + caseId);
    await preserve(f, id);
}
async function independentFixed(f, id) {
    const a = f.a, b = await sibling(f), canaries = identityCanaries(a, b);
    check(id('independent-source-globals'), canaries.modules && canaries.state);
    check(id('captured-store-canaries'), canaries.captured && canaries.storage && a.store !== b.store && a.session !== b.session);
    const leaseA = a.api.captureConnectionOperation(), leaseB = b.api.captureConnectionOperation(), ended = { a: 0, b: 0 };
    const offA = leaseA.watch(() => ended.a++), offB = leaseB.watch(() => ended.b++), config = a.store.getItem('zoew_firebase_config');
    a.store.setItem('zoew_firebase_config', config + ' '); a.dom.dispatchEvent(new a.dom.Event('storage'));
    check(id('source-listener-lease-canaries'), canaries.listeners && !leaseA.current() && leaseB.current() && ended.a === 1 && ended.b === 0);
    offA(); offB(); a.store.setItem('zoew_firebase_config', config);
    check(id('distinct-sdk-owner-registration'), a.sdk !== b.sdk && a.app !== b.app && a.auth !== b.auth && a.db !== b.db && a.sdk.__connectionOwned && b.sdk.__connectionOwned);
    check(id('same-ready-original-basis'), equal(a.listenerValues[0], SEED[PICKUP]) && equal(b.listenerValues[0], SEED[PICKUP]));
    const reqA = await request(a, f), reqB = await request(b, f), beforeCross = resetCalls(b).length, crossed = await b.sdk.pickupResetStatus(a.ref, reqA);
    check(id('crossed-reference-zero-dispatch'), crossed.outcome === 'unknown' && crossed.pickupReset === null && resetCalls(b).length === beforeCross);
    const admitted = new Set(), entered = deferred(), release = deferred(), bodies = []; a.releases.push(release.resolve); b.releases.push(release.resolve);
    f.hook = async event => {
        if (event.fn !== 'zoe_pickup_reset_execute_v1' || event.phase !== 'before') return;
        admitted.add(event.body.p_attempt_id); bodies.push(clone(event.body)); if (admitted.size === 2) entered.resolve(); await release.promise;
    };
    const first = execute(a, reqA).catch(error => ({ error: error.txOutcome })), second = execute(b, reqB).catch(error => ({ error: error.txOutcome }));
    try { await bounded(entered.promise, 'two independent HTTP original attempts');
        check(id('two-distinct-pre-admission'), admitted.size === 2 && reqA.attemptId !== reqB.attemptId && reqA.casText === reqB.casText && bodies.every(body => body.p_cas_text === reqA.casText));
    } finally { release.resolve(); }
    const outcomes = await Promise.all([first, second]), winning = outcomes.findIndex(value => value.committed === true), loser = outcomes[1 - winning];
    check(id('one-original-applied'), outcomes.filter(value => value.committed === true).length === 1 && equal(outcomes[winning].pickupReset, await bound(a, [reqA, reqB][winning])));
    check(id('loser-fixed-false-or-unknown'), loser?.committed === false && loser.pickupReset === undefined || loser?.error === 'unknown');
    check(id('one-epoch-no-tail'), equal(await dayValue(f.tenant), CLEARED) && equal(await dayValue(f.tenant, OTHER), PRIOR) && equal(await dayValue(f.tenant, TAIL), PRIOR)
        && resetCalls(a).length + resetCalls(b).length === 2);
    f.hook = null; const aCount = a.listenerValues.length; await closeFrame(a); const closedBefore = resetCalls(a).length, closed = await a.sdk.pickupResetStatus(a.ref, reqA);
    check(id('closed-owner-zero-dispatch'), closed.outcome === 'unknown' && resetCalls(a).length === closedBefore && a.listenerValues.length === aCount);
    const survivor = (await task(b, b.sdk.get(b.ref))).val();
    check(id('sibling-listener-survives'), !b.closed && equal(survivor, CLEARED) && b.api.captureConnectionOperation().current());
    currentCase.fixedAttempts = [reqA, reqB]; currentCase.fixedOutcomes = clone(outcomes);
}
async function independentUnknown(f, id) {
    const a = f.a, b = await sibling(f), canaries = identityCanaries(a, b);
    check(id('independent-source-globals'), Object.values(canaries).every(Boolean) && a.api !== b.api);
    check(id('same-ready-original-basis'), equal(a.listenerValues[0], SEED[PICKUP]) && equal(b.listenerValues[0], SEED[PICKUP]));
    let captured, dropped = false;
    f.hook = event => {
        if (event.fn !== 'zoe_pickup_reset_execute_v1') return;
        if (event.phase === 'before') captured = { body: clone(event.body), journal: clone(pending(a)) };
        if (event.phase === 'after' && !dropped) { dropped = true; a.denyStatus = true; return 'drop'; }
    };
    const partial = await task(a, a.api.runPickupResetBatch([DAY, OTHER, TAIL])), stored = clone(pending(a)[0]), original = stored?.value.days[0].attempts[0], bytes = a.store.getItem(stored.key);
    check(id('durable-original-before-effects'), captured?.journal[0]?.value.days[0].attempts[0].attemptId === original.attemptId
        && captured.body.p_attempt_id === original.attemptId && captured.body.p_cas_text === original.casText);
    const expectedReceipt = await bound(a, original);
    check(id('actual-commit-unknown'), dropped && partial.status === 'hold' && original.outcome === 'pending' && equal(await dayValue(f.tenant), CLEARED)
        && (await snapshot(f.tenant)).ops.some(row => row.op_id === original.attemptId && equal(row.result.reset, expectedReceipt)));
    const beforeHeld = resetCalls(a).length, held = await task(a, a.api.runPickupResetBatch([DAY, OTHER, TAIL]));
    check(id('original-held-no-tail'), held.status === 'hold' && resetCalls(a).length === beforeHeld && stored.value.days.slice(1).every(day => day.attempts.length === 0) && pending(b).length === 0);
    f.hook = null; a.denyStatus = false; const picked = await pickup(b, f, 'AFTER', 'PHONE');
    check(id('independent-later-pickup'), picked.result.committed === true && picked.day.packagesPickedUp === 1 && picked.day.pickupRevision === 7 && picked.day.pickupResetEpoch === 3 && equal(picked.day.pickedUpBarcodes, { AFTER: 'PHONE' }));
    const oldApi = a.api, oldSdk = a.sdk, fresh = await recreate(f, a);
    check(id('sdk-source-recreated'), fresh.api !== oldApi && fresh.sdk !== oldSdk && fresh.api.firebaseState !== oldApi.firebaseState && fresh.store.getItem(stored.key) === bytes && !b.closed);
    const before = await snapshot(f.tenant), view = clone(fresh.api.dataState.dailyPickupData), clock = fresh.api.firebaseState.serverTimeOffsetMs, calls = resetCalls(fresh).length;
    const recovery = await task(fresh, fresh.api.resumePickupResetOutcomes()), final = pending(fresh)[0].value, tail = resetCalls(fresh).slice(calls);
    check(id('same-original-status-only'), recovery.resolved === 1 && recovery.held === false && final.days[0].attempts[0].attemptId === original.attemptId
        && final.days[0].attempts[0].casText === original.casText && final.days[0].attempts[0].outcome === 'applied' && equal(final.days[0].attempts[0].receipt, await bound(fresh, original)));
    check(id('later-view-clock-kept'), equal(view, fresh.api.dataState.dailyPickupData) && fresh.api.firebaseState.serverTimeOffsetMs === clock && equal(before, await snapshot(f.tenant)));
    check(id('no-execute-replay-or-tail'), tail.length === 1 && tail[0].fn === 'zoe_pickup_reset_status_v1' && tail[0].body.p_attempt_id === original.attemptId && tail[0].body.p_cas_text === original.casText
        && final.complete === false && final.settled === true && final.days.slice(1).every(day => day.attempts.length === 0) && !fresh.rootStarted);
}
async function runCase(index) {
    const caseId = PLAN[index], row = { id: caseId, provider: 'supabase-sdk-http-postgresql', nativePlannedLabels: NATIVE.plan[index][1], assertions: [], status: 'RUNNING' };
    currentCase = row; records.push(row); let f;
    const id = label => caseId + '/' + label;
    try {
        f = await fixture('case-' + index, { ready: index > 1, caseId }); row.sharedFixture = clone(f.seedInput); row.authority = { tenant: f.tenant, actorUid: f.uid, scope: fake.url + '#' + f.tenant, native: NATIVE.nativeAuthority };
        row.before = await snapshot(f.tenant); await requireSeed(f); await behavior(index, f, id);
        if (!equal(row.assertions, SQL_LABELS[index].map(id))) throw new Error('missing or reordered scenario assertion IDs');
        row.status = 'PASS';
    } catch (error) { row.status = 'FAIL'; row.error = String(error.stack || error); errors.push({ caseId, error: row.error }); }
    finally {
        if (!f && active) f = active;
        if (f) {
            f.hook = null; f.allFrames.forEach(frame => frame.releases.splice(0).forEach(release => release()));
            try { await bounded(Promise.allSettled(f.allFrames.flatMap(frame => [...frame.tasks])), 'settle owned profile tasks before cleanup'); }
            catch (error) { cleanupErrors.push({ caseId, error: String(error) }); }
            row.after = await snapshot(f.tenant);
            row.clients = f.allFrames.map(frame => ({ label: frame.label, calls: clone(frame.calls), rootSnapshots: frame.listenerValues.length,
                pendingJournal: pending(frame), listenerErrors: frame.listenerErrors, ownsLocalStore: frame.api.appLocalStore === frame.store,
                ownsSessionStore: frame.api.appSessionStore === frame.session }));
            for (const frame of f.allFrames) try { await closeFrame(frame); } catch (error) { cleanupErrors.push({ caseId, error: String(error) }); }
        }
        active = null; currentCase = null;
    }
    if (cleanupErrors.length) throw new Error('failed cleanup; refuse next fixture');
}
async function cleanup() {
    if (active) { active.hook = null; for (const frame of active.allFrames) frame.releases.splice(0).forEach(release => release()); }
    for (const frame of [...frames]) try { await bounded(Promise.allSettled([...frame.tasks]), 'settle own SDK tasks before final cleanup'); await closeFrame(frame); } catch (error) { cleanupErrors.push(String(error)); }
    for (const close of [() => fake?.close(), () => pool?.end(), () => c?.end(), () => H?.stop()]) try { await bounded(Promise.resolve(close()), 'owned runtime cleanup'); } catch (error) { cleanupErrors.push(String(error)); }
    try { await until(() => httpTasks.size === 0 && sockets.size === 0 && ownedPgChildren.every(child => child.exitCode !== null || child.signalCode !== null), 'all owned HTTP/PG gone'); } catch (error) { cleanupErrors.push(String(error)); }
}
(async () => {
    if (process.argv.includes('--plan')) { console.log(JSON.stringify({ status: 'UNRUN_PLAN', nativeSourceHash: NATIVE.sourceHash, cases: PLAN, seed: SEED, fixtureOnly: true })); return; }
    await build();
    const selected = process.env.SUPABASE_RESET_PAIRED_CASE ? PLAN.filter(id => id === process.env.SUPABASE_RESET_PAIRED_CASE) : PLAN;
    if (!selected.length) throw new Error('unknown selected profile');
    try { await bootstrap(); if (!process.env.SUPABASE_RESET_PAIRED_CASE) await seedPoisonControls();
        for (const id of selected) await runCase(PLAN.indexOf(id)); }
    catch (error) { errors.push({ infrastructure: String(error.stack || error) }); }
    finally {
        await cleanup();
        const drift = Object.entries(SOURCE.files).filter(([file, expected]) => hash(fs.readFileSync(file)) !== expected).map(([file]) => file);
        const full = !process.env.SUPABASE_RESET_PAIRED_CASE;
        const success = records.length === selected.length && new Set(records.map(row => row.id)).size === selected.length && records.every(row => row.status === 'PASS' && row.assertions.length > 0)
            && results.length > 0 && results.every(row => row.pass) && outboundViolations.length === 0 && !errors.length && !cleanupErrors.length && !drift.length && (!full || fixtureControls.length === 5 && fixtureControls.every(row => row.pass));
        const report = { status: success ? full ? 'PASS_ACTUAL_SDK_HTTP_PG_19_SCENARIOS_18_COMPARABLE_1_SDK_SPECIFIC' : 'PASS_FOCUSED_ACTUAL_PROFILE' : 'FAIL', full, selectedCases: selected,
            expectedCases: PLAN, expectedSqlLabels: SQL_LABELS, cases: records, assertions: results, pass: results.filter(row => row.pass).length, fail: results.filter(row => !row.pass).length,
            errors, cleanupErrors, outboundViolations, inputDrift: drift, fixtureControls, nativeSourceHash: NATIVE.sourceHash, nativePlan: NATIVE.plan,
            commonSeed: SEED, sharedFixtureHash: hash(fs.readFileSync(SHARED_FILE)), bundleHash, sourceFiles: SOURCE.files, driverHash: hash(fs.readFileSync(__filename)), migrationCount: migrationFiles().length,
            layers: 'actual production SDK/transport/public service + owned loopback HTTP gateway + actual PostgreSQL17 canonical50 migrations; separately evaluated VM source contexts',
            limitations: 'HappyDOM/memory local+session stores/fake GoTrue setup/deterministic Web Locks; no actual native engine/device/browser lock/process-crash proof. Native-specific callback and receipt availability differences labelled in case records.',
            nativeEngine: 'UNRUN_BY_THIS_CHECKER', comparison: { comparableScenarios: 18, providerSpecificScenarios: ['native-strict-cas-cold'], identicalOutcomeClaim: false }, authPasswordOrRevocationMutation: false,
            cleanup: { frames: frames.size, httpTasks: httpTasks.size, sockets: sockets.size, pgStopRequested: !!H, ownedPgChildren: ownedPgChildren.map(child => ({ pid: child.pid, exitCode: child.exitCode, signalCode: child.signalCode })) } };
        fs.writeFileSync(RESULT, JSON.stringify(report, null, 2) + '\n');
        console.log(JSON.stringify({ status: report.status, full, cases: records.length, pass: report.pass, fail: report.fail, errors: errors.length, cleanupErrors: cleanupErrors.length,
            inputDrift: drift, driverHash: report.driverHash, nativeSourceHash: NATIVE.sourceHash, resultFile: RESULT })); process.exitCode = success ? 0 : 1;
    }
})().catch(error => { console.error(error.stack || error); process.exitCode = 2; });
