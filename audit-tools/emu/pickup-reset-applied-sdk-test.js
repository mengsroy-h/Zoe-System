'use strict';

const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), crypto = require('crypto');
const { pathToFileURL } = require('url'), { isDeepStrictEqual: equal } = require('util');
const vm = require('vm'), { createRequire } = require('module');
const { emuNamespace } = require('./ns');
const ROOT = path.resolve(process.env.PICKUPRESET_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '../..'));
const pairedFixture = require(path.join(ROOT, 'audit-tools/fixtures/pickup-reset-parity-fixture.cjs'));
const DEPS = path.join(ROOT, 'ZoeW/node_modules'), PORT = Number(process.env.SCANRULES_EMU_PORT || 9000);
const STRICT = process.env.RUNALL_STRICT === '1' || process.env.CRUD_FLOW_STRICT === '1';
const P = 'zoew_daily_pickup_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod', H = 'zoew_scan_history_cod_dod';
const DAY = '2026-11-01', OTHER = '2026-10-31', TAIL = '2026-11-02', PREFIX = 'zoew_pickup_reset_pending_v2:';
const PROJECT = 'demo-f09-reset', UID = 'f09-native-owner', WAIT_MS = 15000;
const PRIOR = { pickupRevision: 5, pickupResetEpoch: 2, packagesPickedUp: 2, pickedUpPhones: { PHONE: 2 }, pickedUpBarcodes: { CODE_A: 'PHONE', CODE_B: 'PHONE' } };
const MONEY = { codDollar: 37, dodDollar: 5, totalCount: 11 };
const ARCHIVE_UID = 'f09-native-archive-owner-B';
const PLAN = [
    ['native-strict-cas-cold', ['null-callback', 'known-false', 'no-applied', 'money-history-unchanged']],
    ['ui-pending-first-snapshot', ['pending-view-floor', 'no-confirmation-or-dispatch', 'no-journal-or-server-change', 'real-first-snapshot-ready']],
    ['ready-service-positive', ['complete', 'two-days-reset', 'bound-journal', 'money-history-unchanged']],
    ['positive-conflict-explicit', ['applied', 'known-false', 'new-attempt', 'money-history-unchanged']],
    ['same-intent-changed-body', ['not-applied', 'zero-dispatch', 'money-history-unchanged']],
    ['lost-ack-readonly-later-pickup', ['actual-commit-unknown', 'denied-proof-hold', 'restart-status-only', 'later-view-kept', 'original-proof', 'money-history-unchanged']],
    ['public-unknown-manual-resume', ['unknown-second-day', 'untouched-tail', 'original-journal', 'status-only-settlement', 'view-kept', 'money-history-unchanged']],
    ['ordinary-pickup-preserves', ['committed', 'same-proof', 'epoch-kept', 'revision-increased', 'money-history-unchanged']],
    ['native-drop-proof-rejected', ['rules-denied', 'exact-day-kept', 'money-history-unchanged']],
    ['native-malformed-proof-rejected', ['rules-denied', 'exact-day-kept', 'money-history-unchanged']],
    ['old-client-failclosed-after-proof', ['rules-denied', 'exact-day-kept', 'money-history-unchanged']],
    ['legacy-unreceipted-hold', ['legacy-write-allowed', 'no-proof-created', 'status-unknown', 'money-history-unchanged']],
    ['receipt-replacement-HOLD', ['new-proof', 'old-status-unknown', 'original-held', 'server-kept', 'money-history-unchanged']],
    ['concurrent-reset', ['one-applied', 'loser-held-or-false', 'distinct-attempts', 'one-epoch-step', 'money-history-unchanged']],
    ['old-session-receipt-only', ['original-proof', 'no-snapshot', 'view-clock-kept', 'no-tail', 'money-history-unchanged']],
    ['public-storage-denied', ['fault-hit', 'zero-dispatch', 'server-kept', 'no-memory-fallback']],
    ['paired-native-archive-actor-preservation', ['actual-A-proof', 'archive-roundtrip', 'fresh-B-owner', 'unexecuted-B-unknown', 'ordinary-pickup-committed', 'A-proof-preserved', 'B-reset-applied', 'B-basis-bound', 'B-proof', 'no-A-intent-retarget', 'money-history-unchanged']]
];
PLAN.push(['independent-context-fixed-cas', ["independent-source-globals", "captured-store-canaries", "source-listener-lease-canaries", "distinct-sdk-owner-registration", "same-ready-original-basis", "crossed-reference-zero-dispatch", "two-distinct-pre-admission", "one-original-applied", "loser-fixed-false-or-unknown", "one-epoch-no-tail", "closed-owner-zero-dispatch", "sibling-listener-survives", "money-history-unchanged"]],
    ['independent-context-unknown-restart', ["independent-source-globals", "same-ready-original-basis", "durable-original-before-effects", "actual-commit-unknown", "original-held-no-tail", "independent-later-pickup", "sdk-source-recreated", "same-original-status-only", "later-view-clock-kept", "no-execute-replay-or-tail", "money-history-unchanged"]]);
const SOURCES = ['firebase-database.rules.json', 'ZoeW/src/domain/pickup-reset-proof.ts', 'ZoeW/src/domain/pickup.ts',
    'ZoeW/src/services/pickup-reset.ts', 'ZoeW/src/services/tx-outcome.ts', 'ZoeW/src/services/connection-flow.ts',
    'ZoeW/src/core/state.ts', 'ZoeW/src/core/storage.ts', 'ZoeW/src/core/text.ts',
    'ZoeW/src/domain/collected.ts', 'ZoeW/src/features/export.ts', 'ZoeW/src/services/db-listeners.ts',
    'audit-tools/fixtures/pickup-reset-parity-fixture.cjs'];
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const counters = value => ({ pickupRevision: value?.pickupRevision, pickupResetEpoch: value?.pickupResetEpoch, packagesPickedUp: value?.packagesPickedUp });
const errors = [], cases = [], pending = new Set(), requests = new Set(), sockets = new Set(), locks = new Set(), animationFrames = new Set();
const httpAgent = new http.Agent({ keepAlive: false });
let independentGroup = null;
let active = null, api, dom, database, firebaseApp, createMockUserToken, bundle, serial = 0, originalSocket, websocket;
let namespace, origin, closing = false, denyStorage = false, storageDenials = 0, poisoned = false, acquired = false, released = false, engineStarted = false;
const rows = new Map();
const store = { get length() { return rows.size; }, key: i => [...rows.keys()][i] ?? null, getItem: key => rows.get(key) ?? null,
    setItem(key, value) { if (denyStorage && key.startsWith(PREFIX)) { storageDenials++; throw new Error('synthetic actual persistence denial'); } rows.set(key, String(value)); },
    removeItem: key => rows.delete(key), clear: () => rows.clear() };
const journal = () => [...rows].filter(([key]) => key.startsWith(PREFIX)).map(([key, text]) => ({ key, value: JSON.parse(text) }));
function track(promise) { const task = Promise.resolve(promise); pending.add(task); task.then(() => pending.delete(task), () => pending.delete(task)); return task; }
async function bounded(promise, label) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out: ' + label)), WAIT_MS); })]); }
    finally { clearTimeout(timer); }
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) { const stop = Date.now() + WAIT_MS; while (!check()) { if (Date.now() >= stop) throw new Error('Unsettled: ' + label); await pause(5); } }
function check(row, label, condition) {
    if (!row.expected.includes(label) || row.assertions.some(value => value.label === label)) throw new Error('Unexpected or duplicate assertion ' + row.id + '/' + label);
    row.assertions.push({ label, pass: !!condition });
    if (!condition) throw new Error('Assertion failed: ' + row.id + '/' + label);
}
function endpoint(node = '') { return origin + '/' + node + '.json?ns=' + namespace; }
function ownedTarget(url) {
    const target = new URL(String(url));
    if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || Number(target.port) !== PORT || target.searchParams.getAll('ns').length !== 1 || target.searchParams.get('ns') !== namespace) throw new Error('Fixture transport escaped owned loopback namespace');
    return target;
}
function transport(url, init = {}) {
    const target = ownedTarget(url);
    return track(new Promise((resolve, reject) => {
        const req = http.request(target, { method: init.method || 'GET', headers: init.headers || {}, timeout: WAIT_MS, agent: httpAgent }, response => {
            let body = ''; response.setEncoding('utf8'); response.on('data', part => { body += part; });
            response.on('error', reject); response.on('end', () => resolve(new Response(body, { status: response.statusCode, headers: response.headers })));
        });
        requests.add(req); req.on('close', () => requests.delete(req)); req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error('Owned fixture HTTP timeout')));
        if (init.signal) { if (init.signal.aborted) req.destroy(new Error('Aborted fixture HTTP')); else init.signal.addEventListener('abort', () => req.destroy(new Error('Aborted fixture HTTP')), { once: true }); }
        if (init.body !== undefined) req.write(init.body); req.end();
    }));
}
async function owner(node = '', method = 'GET', value) {
    const response = await transport(endpoint(node), { method, headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    if (!response.ok) throw new Error('Owned fixture HTTP ' + response.status);
    return response.json();
}
async function rules(body) {
    const response = await transport(origin + '/.settings/rules.json?ns=' + namespace, { method: 'PUT', headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, body });
    if (!response.ok) throw new Error('Owned fixture rules HTTP ' + response.status);
}
async function bootstrap() {
    if (!Number.isSafeInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('Invalid loopback emulator port');
    namespace = emuNamespace('demo-f09-reset'); origin = 'http://127.0.0.1:' + PORT;
    websocket = require(require.resolve('faye-websocket', { paths: [DEPS] })); originalSocket = websocket.Client;
    websocket.Client = function (url, protocols, options) {
        const target = new URL(url);
        if (target.protocol !== 'ws:' || target.hostname !== '127.0.0.1' || Number(target.port) !== PORT || target.searchParams.getAll('ns').length !== 1 || target.searchParams.get('ns') !== namespace || closing || (independentGroup ? independentGroup.closing : active?.closing)) throw new Error('SDK socket escaped owned namespace');
        const local = { ...options }; delete local.proxy;
        const socket = new originalSocket(url, protocols, local); sockets.add(socket); socket.on('close', () => sockets.delete(socket)); return socket;
    };
    firebaseApp = require(path.join(DEPS, 'firebase/app')); database = require(path.join(DEPS, 'firebase/database'));
    ({ createMockUserToken } = require(path.join(DEPS, '@firebase/util')));
    const { Window } = await import(pathToFileURL(path.join(DEPS, 'happy-dom/lib/index.js')).href);
    dom = new Window({ url: 'https://f09-native-fixture.invalid' });
    Object.defineProperty(dom, 'localStorage', { configurable: true, value: store });
    for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'HTMLInputElement', 'HTMLCanvasElement', 'HTMLImageElement', 'HTMLVideoElement', 'HTMLTextAreaElement', 'MutationObserver', 'CustomEvent', 'FileReader', 'Image', 'Node', 'Element', 'Event']) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === 'window' ? dom : dom[key] });
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: crypto.webcrypto });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (name, options, action) => {
        if (options.ifAvailable !== true) throw new Error('Fixture only supports production ifAvailable lock path');
        if (locks.has(name)) return action(null); locks.add(name); try { return await action({ name }); } finally { locks.delete(name); }
    } } });
    globalThis.requestAnimationFrame = action => {
        const id = dom.requestAnimationFrame(time => { animationFrames.delete(id); action(time); }); animationFrames.add(id); return id;
    };
    globalThis.cancelAnimationFrame = id => { animationFrames.delete(id); dom.cancelAnimationFrame(id); };
    globalThis.confirm = () => { if (active) active.confirmations++; return true; }; globalThis.alert = () => {};
    globalThis.fetch = (url, init) => {
        if (!active || active.closing) return Promise.reject(new Error('Fixture read after client close'));
        const target = ownedTarget(url);
        active.reads++;
        if (active.denyProof && target.pathname.startsWith('/' + P + '/')) { active.deniedReads++; return Promise.resolve(new Response('{"error":"synthetic proof READ unavailable"}', { status: 403 })); }
        return transport(target, init);
    };
    bundle = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-f09-native-')), 'source.cjs');
    const built = require(path.join(DEPS, 'esbuild')).buildSync({ absWorkingDir: ROOT, stdin: { resolveDir: ROOT, contents: [
        "export * from './ZoeW/src/domain/pickup-reset-proof';",
        "export { pickupResetRecord,capturePickupContext,commitPickupMarks } from './ZoeW/src/domain/pickup';",
        "export { runPickupResetBatch,resumePickupResetOutcomes,pickupResetPendingState } from './ZoeW/src/services/pickup-reset';",
        "export { withTransactionOutcomeResolution } from './ZoeW/src/services/tx-outcome';",
        "export { firebaseState,dataState,uiState } from './ZoeW/src/core/state';",
        "export { resetPickupStats } from './ZoeW/src/domain/collected';",
        "export { noteDbListenerAlive } from './ZoeW/src/services/db-listeners';",
        "export { dbListenerPendingPaths,dbListenerFailedPaths } from './ZoeW/src/core/text';",
        "export { appLocalStore,appSessionStore } from './ZoeW/src/core/storage';",
        "export { allStores } from './ZoeW/src/core/store';",
        "export { captureConnectionOperation } from './ZoeW/src/services/connection-flow';",
        "export { dropOldestToast } from './ZoeW/src/ui/toast';"
    ].join('\n') }, bundle: true, platform: 'node', format: 'cjs', metafile: true, outfile: bundle, logLevel: 'error', define: { 'import.meta.env': '{}' } });
    api = require(bundle);
    const inputs = Object.keys(built.metafile.inputs).filter(value => !value.includes('node_modules') && !value.startsWith('<')).sort();
    return { hash: digest(fs.readFileSync(bundle)), inputs, inputHashes: Object.fromEntries(inputs.map(file => [file, digest(fs.readFileSync(path.resolve(ROOT, file)))])) };
}
async function open(actorUid = UID) {
    const frame = { closing: false, reads: 0, deniedReads: 0, rawCalls: 0, nullCallbacks: 0, nonnullCallbacks: 0, rootSubscriptions: 0, rootSnapshots: 0, confirmations: 0, denyProof: false, hook: null, releases: [], unsubscribers: [] };
    const app = firebaseApp.initializeApp({ projectId: PROJECT, databaseURL: origin + '/?ns=' + namespace }, namespace + '-' + (++serial));
    frame.app = app; active = frame;
    const db = database.getDatabase(app);
    frame.db = db;
    database.connectDatabaseEmulator(db, '127.0.0.1', PORT, { mockUserToken: { sub: actorUid, user_id: actorUid, aud: PROJECT } });
    const token = createMockUserToken({ sub: actorUid, user_id: actorUid }, PROJECT);
    const auth = { app, currentUser: { uid: actorUid, getIdToken: async () => token, getIdTokenResult: async () => ({ claims: { aud: PROJECT } }) } };
    const raw = { ...database, getAuth: () => auth, getDatabase: () => db, deleteApp: firebaseApp.deleteApp,
        runTransaction(ref, updater, options) {
            if (frame.closing) return Promise.reject(new Error('SDK dispatch after client close'));
            frame.rawCalls++;
            return track((async () => {
                const result = await database.runTransaction(ref, value => { if (value === null) frame.nullCallbacks++; else frame.nonnullCallbacks++; return updater(value); }, options);
                if (frame.hook) await frame.hook(ref, result);
                return result;
            })());
        } };
    const sdk = api.withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(frame, { app, db, auth, sdk, actorUid, ref: sdk.ref(db, P + '/' + DAY) }); active = frame;
    store.setItem('zoew_firebase_config', JSON.stringify(app.options));
    Object.assign(api.firebaseState, { db, fb: sdk, auth, authGeneration: api.firebaseState.authGeneration + 1, firebaseConfig: app.options,
        isInitializingFirebase: false, isDatabaseInitialized: true, isDatabaseConnected: true, firebaseSdkUnavailable: false,
        dbListenersFailed: false, authLoginOperation: null, sessionExpiryCheck: 'live', serverClockTrusted: true, serverTimeOffsetMs: 0 });
    api.firebaseState.dbRefDailyPickup = sdk.ref(db, P);
    api.dbListenerPendingPaths.clear(); api.dbListenerPendingPaths.add('dailyPickup'); api.dbListenerFailedPaths.clear();
    api.dataState.dailyPickupData = {}; api.dataState.pickupResetInFlight = false;
    api.uiState.currentFilterMode = 'all'; api.uiState.toasts = [];
    return frame;
}
function close(frame) {
    if (frame.closePromise) return frame.closePromise;
    frame.closePromise = (async () => {
        frame.closing = true; frame.releases.splice(0).forEach(release => release()); frame.unsubscribers.splice(0).forEach(unsubscribe => unsubscribe()); api.firebaseState.authGeneration++;
        while (api.uiState.toasts.length) api.dropOldestToast();
        for (const id of animationFrames) globalThis.cancelAnimationFrame(id);
        if (frame.db) database.goOffline(frame.db);
        await bounded(frame.sdk ? frame.sdk.deleteApp(frame.app) : firebaseApp.deleteApp(frame.app), 'actual SDK app close');
        for (const socket of sockets) socket.close();
        await until(() => pending.size === 0 && requests.size === 0 && sockets.size === 0 && locks.size === 0, 'all owned SDK/HTTP/socket/lock tasks');
        if (active === frame) active = null;
    })().catch(error => { poisoned = true; throw error; });
    return frame.closePromise;
}
function pickupRootReadiness(frame) {
    if (frame.readiness) return frame.readiness;
    frame.rootSubscriptions++;
    const generation = api.firebaseState.authGeneration;
    frame.readiness = track(new Promise((resolve, reject) => {
        frame.releases.push(() => reject(new Error('Fixture first snapshot cancelled by close')));
        const unsubscribe = frame.sdk.onValue(api.firebaseState.dbRefDailyPickup, snapshot => {
            if (frame.closing || active !== frame || generation !== api.firebaseState.authGeneration) { reject(new Error('First snapshot belongs to ended fixture owner')); return; }
            frame.rootSnapshots++;
            api.noteDbListenerAlive('dailyPickup');
            api.dataState.dailyPickupData = snapshot.val() || {};
            resolve();
        }, reject, { onlyOnce: true });
        frame.unsubscribers.push(unsubscribe);
    }));
    return frame.readiness;
}
async function ready(frame) { await bounded(pickupRootReadiness(frame), 'actual dailyPickup ROOT first snapshot'); }
async function requestFor(frame, basis = PRIOR, day = DAY) {
    const batchId = 'native-batch-' + (++serial), scope = frame.app.options.databaseURL, actorUid = frame.auth.currentUser.uid;
    const context = { v: 1, scope, batchId, batchHash: await api.pickupResetBatchHash(PROJECT, scope, actorUid, batchId, [day]), dayId: batchId + ':' + day, day, nonce: 'native-nonce-' + serial };
    const casText = api.pickupResetCasText(day, basis, api.pickupResetRecord(basis));
    return Object.freeze({ tenant: PROJECT, actorUid, context: Object.freeze(context), casText, attemptId: await api.pickupResetAttemptId(PROJECT, actorUid, context, casText) });
}
const expected = request => api.pickupResetBoundReceipt(PROJECT, request.actorUid, request.context, request.attemptId, request.casText, 'native-day');
const execute = (frame, request) => bounded(track(frame.sdk.executePickupReset(frame.sdk.ref(frame.db, P + '/' + request.context.day), request, () => true)), 'actual owned Reset');
const status = (frame, request) => bounded(track(frame.sdk.pickupResetStatus(frame.sdk.ref(frame.db, P + '/' + request.context.day), request, () => true)), 'original status');
const seed = () => ({ [P]: { [DAY]: clone(PRIOR), [OTHER]: clone(PRIOR), [TAIL]: clone(PRIOR) }, [D]: { [DAY]: clone(MONEY) }, [M]: { '2026-11': clone(MONEY) }, [H]: { retained: { id: 'retained', isClosed: true, count: 1, cod: 37, dod: 5 } } });
async function preserve(row) { const value = await owner(); check(row, 'money-history-unchanged', equal(value[D], seed()[D]) && equal(value[M], seed()[M]) && equal(value[H], seed()[H])); }
async function apply(frame) {
    const request = await requestFor(frame, await owner(P + '/' + DAY)), result = await execute(frame, request);
    if (result.committed !== true || !api.pickupResetReceiptMatches(result.pickupReset, await expected(request))) throw new Error('Actual original receipt-bearing Reset did not commit');
    return { request, result };
}
function drop(frame, day = DAY) { frame.hook = async (ref, result) => { if (result.committed && String(ref).includes('/' + day)) { frame.denyProof = true; throw new Error('synthetic ACK lost after real SDK commit'); } }; }
async function ruleDenial(row, frame, value) {
    const before = await owner(P + '/' + DAY); let error;
    try { await bounded(track(database.set(database.ref(frame.db, P + '/' + DAY), value)), 'actual canonical rejection'); } catch (caught) { error = caught; }
    check(row, 'rules-denied', !!error && /permission[_ -]?denied/i.test(String(error.code || '') + ' ' + error.message));
    check(row, 'exact-day-kept', equal(await owner(P + '/' + DAY), before)); await preserve(row);
}
async function behavior(row, frame) {
    if (row.id === 'native-strict-cas-cold') {
        const request = await requestFor(frame), result = await execute(frame, request);
        row.observed = { committed: result.committed, rawCalls: frame.rawCalls, nullCallbacks: frame.nullCallbacks, nonnullCallbacks: frame.nonnullCallbacks };
        check(row, 'null-callback', frame.rawCalls === 1 && frame.nullCallbacks > 0 && frame.nonnullCallbacks === 0 && frame.rootSubscriptions === 0);
        check(row, 'known-false', result.committed === false && equal(await owner(P + '/' + DAY), PRIOR));
        check(row, 'no-applied', result.pickupReset === undefined && (await status(frame, request)).outcome === 'unknown' && journal().length === 0);
        await preserve(row); return;
    }
    if (row.id === 'ui-pending-first-snapshot') {
        const firstSnapshot = pickupRootReadiness(frame);
        check(row, 'pending-view-floor', frame.rootSnapshots === 0 && api.dbListenerPendingPaths.has('dailyPickup') && equal(api.dataState.dailyPickupData, {}));
        await api.resetPickupStats();
        while (api.uiState.toasts.length) api.dropOldestToast();
        check(row, 'no-confirmation-or-dispatch', frame.confirmations === 0 && frame.rawCalls === 0 && frame.reads === 0);
        check(row, 'no-journal-or-server-change', journal().length === 0 && equal(await owner(), seed()));
        await bounded(firstSnapshot, 'real snapshot after refused UI Reset');
        check(row, 'real-first-snapshot-ready', frame.rootSnapshots === 1 && frame.rootSubscriptions === 1 && !api.dbListenerPendingPaths.has('dailyPickup') && equal(api.dataState.dailyPickupData, seed()[P]));
        return;
    }
    await ready(frame);
    if (row.id === 'ready-service-positive') {
        const result = await bounded(track(api.runPickupResetBatch([DAY, OTHER])), 'ready service Reset');
        row.observed = { result, rawCalls: frame.rawCalls, nullCallbacks: frame.nullCallbacks, nonnullCallbacks: frame.nonnullCallbacks };
        check(row, 'complete', result.status === 'complete' && result.doneCount === 2);
        const actual = await Promise.all([owner(P + '/' + DAY), owner(P + '/' + OTHER)]);
        check(row, 'two-days-reset', actual.every(value => equal(counters(value), { pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0 })));
        const value = journal()[0]?.value;
        const proofs = value && await Promise.all(value.days.map(day => expected(day.attempts[0])));
        check(row, 'bound-journal', value?.complete === true && value.settled === true && value.batchHash === await api.pickupResetBatchHash(PROJECT, frame.app.options.databaseURL, UID, value.id, [DAY, OTHER])
            && value.days.every((day, index) => day.attempts.length === 1 && day.attempts[0].outcome === 'applied' && api.pickupResetReceiptMatches(actual[index].pickupResetApplied, proofs[index])));
        await preserve(row); return;
    }
    if (row.id === 'positive-conflict-explicit') {
        const first = await apply(frame); check(row, 'applied', first.result.committed === true && api.pickupResetReceiptMatches(first.result.pickupReset, await expected(first.request)));
        const prior = await owner(P + '/' + DAY), stale = await requestFor(frame, PRIOR), conflict = await execute(frame, stale);
        check(row, 'known-false', conflict.committed === false && equal(await owner(P + '/' + DAY), prior));
        const second = await apply(frame); check(row, 'new-attempt', second.result.committed === true && second.request.attemptId !== first.request.attemptId && equal(counters(await owner(P + '/' + DAY)), { pickupRevision: 7, pickupResetEpoch: 4, packagesPickedUp: 0 }));
    } else if (row.id === 'same-intent-changed-body') {
        const request = await requestFor(frame), changed = { ...request, context: { ...request.context, nonce: 'changed' } }; let error;
        try { await execute(frame, changed); } catch (caught) { error = caught; }
        check(row, 'not-applied', error?.txOutcome === 'not-applied'); check(row, 'zero-dispatch', frame.rawCalls === 0 && equal(await owner(P + '/' + DAY), PRIOR));
    } else if (row.id === 'lost-ack-readonly-later-pickup') {
        const request = await requestFor(frame); drop(frame); let error;
        try { await execute(frame, request); } catch (caught) { error = caught; }
        check(row, 'actual-commit-unknown', error?.txOutcome === 'unknown' && (await owner(P + '/' + DAY)).pickupResetApplied?.attemptId === request.attemptId);
        check(row, 'denied-proof-hold', (await status(frame, request)).outcome === 'unknown' && frame.deniedReads > 0);
        frame.hook = null; frame.denyProof = false;
        const context = await api.capturePickupContext(DAY);
        if (await api.commitPickupMarks(DAY, [{ key: 'NEW', phoneKey: 'NEW', closed: true }], false, true, undefined, context) !== true) throw new Error('Actual later pickup did not commit');
        await close(frame); frame = await open(); active = frame;
        const view = clone(api.dataState.dailyPickupData), emptyRestart = equal(view, {}) && frame.reads === 0 && frame.rootSubscriptions === 0 && frame.rootSnapshots === 0;
        const result = await status(frame, request);
        check(row, 'restart-status-only', emptyRestart && result.outcome === 'applied' && frame.reads > 0 && frame.rawCalls === 0 && frame.rootSubscriptions === 0 && frame.rootSnapshots === 0);
        check(row, 'later-view-kept', equal(api.dataState.dailyPickupData, view) && (await owner(P + '/' + DAY)).packagesPickedUp === 1);
        check(row, 'original-proof', api.pickupResetReceiptMatches(result.pickupReset, await expected(request)));
    } else if (row.id === 'public-unknown-manual-resume') {
        drop(frame, OTHER); const result = await bounded(track(api.runPickupResetBatch([DAY, OTHER, TAIL])), 'partial public Reset');
        const entry = clone(journal()[0]); check(row, 'unknown-second-day', result.status === 'hold' && frame.rawCalls === 2 && entry.value.days[1].attempts[0].outcome === 'pending');
        check(row, 'untouched-tail', equal(await owner(P + '/' + TAIL), PRIOR) && entry.value.days[2].attempts.length === 0);
        frame.hook = null; frame.denyProof = false; await close(frame); frame = await open(); active = frame;
        const view = clone(api.dataState.dailyPickupData), emptyRestart = equal(view, {}) && frame.reads === 0 && frame.rootSubscriptions === 0 && frame.rootSnapshots === 0;
        const resumed = await api.resumePickupResetOutcomes(), saved = journal()[0];
        check(row, 'original-journal', saved.key === entry.key && saved.value.days[1].attempts[0].attemptId === entry.value.days[1].attempts[0].attemptId);
        check(row, 'status-only-settlement', emptyRestart && resumed.resolved === 1 && frame.reads > 0 && frame.rawCalls === 0 && frame.rootSubscriptions === 0 && frame.rootSnapshots === 0 && saved.value.settled === true && saved.value.complete === false);
        check(row, 'view-kept', equal(api.dataState.dailyPickupData, view) && equal(await owner(P + '/' + TAIL), PRIOR));
    } else if (row.id === 'ordinary-pickup-preserves') {
        const first = await apply(frame), context = await api.capturePickupContext(DAY);
        const committed = await api.commitPickupMarks(DAY, [{ key: 'NEW_NATIVE', phoneKey: '000000009', closed: true }], false, true, undefined, context);
        const value = await owner(P + '/' + DAY); check(row, 'committed', committed === true && value.packagesPickedUp === 1);
        check(row, 'same-proof', equal(value.pickupResetApplied, first.result.pickupReset)); check(row, 'epoch-kept', value.pickupResetEpoch === 3); check(row, 'revision-increased', value.pickupRevision === 7);
    } else if (['native-drop-proof-rejected', 'native-malformed-proof-rejected', 'old-client-failclosed-after-proof'].includes(row.id)) {
        await apply(frame); const previous = await owner(P + '/' + DAY); let next;
        if (row.id === 'native-drop-proof-rejected') { next = { ...previous, pickupRevision: 7, packagesPickedUp: 1, pickedUpPhones: { NEW: 1 }, pickedUpBarcodes: { NEW: 'NEW' } }; delete next.pickupResetApplied; }
        else { next = api.pickupResetRecord(previous); if (row.id === 'native-malformed-proof-rejected') { const request = await requestFor(frame, previous); next.pickupResetApplied = { ...(await expected(request)), intentHash: 'bad' }; } }
        await ruleDenial(row, frame, next); return;
    } else if (row.id === 'legacy-unreceipted-hold') {
        const request = await requestFor(frame), result = await bounded(track(database.runTransaction(database.ref(frame.db, P + '/' + DAY), value => api.pickupResetRecord(value), { applyLocally: false })), 'legacy Reset');
        check(row, 'legacy-write-allowed', result.committed === true && (await owner(P + '/' + DAY)).pickupResetEpoch === 3);
        check(row, 'no-proof-created', !(await owner(P + '/' + DAY)).pickupResetApplied); check(row, 'status-unknown', (await status(frame, request)).outcome === 'unknown');
    } else if (row.id === 'receipt-replacement-HOLD') {
        drop(frame); await api.runPickupResetBatch([DAY]); const original = clone(journal()[0]), attempt = original.value.days[0].attempts[0]; frame.hook = null; frame.denyProof = false;
        await close(frame); frame = await open(); active = frame; await ready(frame);
        const newer = await apply(frame), before = await owner(P + '/' + DAY); check(row, 'new-proof', newer.result.committed === true && newer.request.attemptId !== attempt.attemptId);
        check(row, 'old-status-unknown', (await status(frame, attempt)).outcome === 'unknown');
        const resumed = await api.resumePickupResetOutcomes(); check(row, 'original-held', resumed.held === true && journal()[0].value.days[0].attempts[0].outcome === 'pending');
        check(row, 'server-kept', equal(await owner(P + '/' + DAY), before));
    } else if (row.id === 'concurrent-reset') {
        const requests = await Promise.all([requestFor(frame), requestFor(frame)]), results = await Promise.allSettled(requests.map(request => execute(frame, request)));
        const applied = results.filter(value => value.status === 'fulfilled' && value.value.committed === true);
        check(row, 'one-applied', applied.length === 1);
        check(row, 'loser-held-or-false', results.filter(value => value.status === 'fulfilled' ? value.value.committed === false : value.reason.txOutcome === 'unknown').length === 1);
        check(row, 'distinct-attempts', requests[0].attemptId !== requests[1].attemptId);
        check(row, 'one-epoch-step', equal(counters(await owner(P + '/' + DAY)), { pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0 }) && frame.rawCalls === 2);
    } else if (row.id === 'old-session-receipt-only') {
        let entered, release; const reached = new Promise(resolve => { entered = resolve; }), gate = new Promise(resolve => { release = resolve; }); frame.releases.push(release);
        frame.hook = async (_ref, result) => { if (result.committed) { entered(); await gate; } };
        const request = await requestFor(frame), operation = execute(frame, request); await bounded(reached, 'real commit before stale session');
        api.firebaseState.authGeneration++; const view = clone(api.dataState.dailyPickupData), clock = api.firebaseState.serverTimeOffsetMs; release(); const result = await operation;
        check(row, 'original-proof', result.committed === true && api.pickupResetReceiptMatches(result.pickupReset, await expected(request))); check(row, 'no-snapshot', result.snapshot === undefined);
        check(row, 'view-clock-kept', equal(api.dataState.dailyPickupData, view) && api.firebaseState.serverTimeOffsetMs === clock); check(row, 'no-tail', frame.rawCalls === 1 && equal(await owner(P + '/' + OTHER), PRIOR));
    } else if (row.id === 'paired-native-archive-actor-preservation') {
        const first = await apply(frame), originalIntent = JSON.stringify(first.request), archiveText = JSON.stringify(await owner());
        const archiveFile = path.join(path.dirname(bundle), 'actual-native-A-archive.json');
        fs.writeFileSync(archiveFile, archiveText, { flag: 'wx' });
        const exported = fs.readFileSync(archiveFile, 'utf8'), archive = JSON.parse(exported), proofA = clone(archive[P]?.[DAY]?.pickupResetApplied);
        check(row, 'actual-A-proof', first.result.committed === true && Object.keys(proofA || {}).length === 17 && proofA?.proof === 'native-day' && proofA.actorUid === UID
            && api.pickupResetReceiptMatches(proofA, first.result.pickupReset) && api.pickupResetReceiptMatches(proofA, await expected(first.request))
            && equal(counters(archive[P][DAY]), { pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0 }));
        await close(frame);
        await owner('', 'DELETE');
        if (await owner() !== null) throw new Error('Owned archive restore requires empty root');
        await owner('', 'PUT', archive);
        check(row, 'archive-roundtrip', digest(exported) === digest(archiveText) && equal(await owner(), archive));
        frame = await open(ARCHIVE_UID); active = frame; await ready(frame);
        check(row, 'fresh-B-owner', frame.actorUid === ARCHIVE_UID && frame.auth.currentUser.uid === ARCHIVE_UID && frame.app.options.projectId === PROJECT
            && frame.rawCalls === 0 && frame.rootSnapshots === 1 && journal().length === 0 && equal(api.dataState.dailyPickupData, archive[P]));
        const unexecuted = await requestFor(frame, archive[P][DAY]);
        check(row, 'unexecuted-B-unknown', (await status(frame, unexecuted)).outcome === 'unknown' && frame.rawCalls === 0);
        const context = await api.capturePickupContext(DAY);
        const committed = await api.commitPickupMarks(DAY, [{ key: 'NEW_B', phoneKey: 'PHONE_B', closed: true }], false, true, undefined, context);
        const picked = await owner(P + '/' + DAY);
        check(row, 'ordinary-pickup-committed', committed === true && equal(counters(picked), { pickupRevision: 7, pickupResetEpoch: 3, packagesPickedUp: 1 })
            && equal(picked.pickedUpBarcodes, { NEW_B: 'PHONE_B' }) && equal(picked.pickedUpPhones, { PHONE_B: 1 }));
        check(row, 'A-proof-preserved', equal(picked.pickupResetApplied, proofA) && Object.keys(picked.pickupResetApplied).length === 17);
        const reset = await api.runPickupResetBatch([DAY]), saved = await owner(P + '/' + DAY), entry = journal()[0]?.value;
        check(row, 'B-reset-applied', reset.status === 'complete' && reset.doneCount === 1 && entry?.complete === true && entry.settled === true
            && equal(counters(saved), { pickupRevision: 8, pickupResetEpoch: 4, packagesPickedUp: 0 }));
        const attempt = entry.days[0].attempts[0];
        check(row, 'B-basis-bound', entry.dates.length === 1 && entry.days[0].attempts.length === 1 && attempt.outcome === 'applied'
            && attempt.casText === api.pickupResetCasText(DAY, picked, api.pickupResetRecord(picked)));
        check(row, 'B-proof', saved.pickupResetApplied.actorUid === ARCHIVE_UID && saved.pickupResetApplied.proof === 'native-day'
            && Object.keys(saved.pickupResetApplied).length === 17 && api.pickupResetReceiptMatches(saved.pickupResetApplied, await expected(attempt)));
        check(row, 'no-A-intent-retarget', JSON.stringify(first.request) === originalIntent && attempt.actorUid === ARCHIVE_UID && attempt.attemptId !== first.request.attemptId
            && attempt.attemptId !== unexecuted.attemptId && equal(await owner(P + '/' + OTHER), PRIOR) && equal(await owner(P + '/' + TAIL), PRIOR));
        row.observed = { archiveHash: digest(exported), originalActor: UID, restoredActor: ARCHIVE_UID, authority: 'actual prior native CAS; owned fixture JSON export/restore' };
    } else if (row.id === 'public-storage-denied') {
        const before = await owner(); denyStorage = true; const result = await api.runPickupResetBatch([DAY]); denyStorage = false;
        check(row, 'fault-hit', storageDenials > 0); check(row, 'zero-dispatch', frame.rawCalls === 0);
        check(row, 'server-kept', equal(await owner(), before)); check(row, 'no-memory-fallback', journal().length === 0 && result.status !== 'complete'); return;
    }
    await preserve(row);
}
function independentStore() {
    const values = new Map();
    return { values, get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
        getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key), clear: () => values.clear() };
}
function independentJournal(frame) {
    return [...frame.store.values].filter(([key]) => key.startsWith(PREFIX)).map(([key, text]) => ({ key, value: JSON.parse(text) }));
}
function independentTask(frame, promise) {
    if (frame.closing) throw new Error('Independent context task after close');
    const task = track(promise); frame.tasks.add(task);
    task.then(() => frame.tasks.delete(task), () => frame.tasks.delete(task)); return task;
}
function independentGroupForCase() {
    return { frames: new Set(), closing: false, poisoned: false, releases: [], evidence: [], bundleHash: digest(fs.readFileSync(bundle)) };
}
async function evaluateIndependentContext(group, label, retainedStore) {
    const { Window } = await import(pathToFileURL(path.join(DEPS, 'happy-dom/lib/index.js')).href);
    const frame = { id: label + '-' + (++serial), group, closing: false, closed: false, tasks: new Set(), stops: [],
        timers: new Set(), intervals: new Set(), animations: new Set(), localLocks: new Set(), reads: 0, deniedReads: 0,
        rawCalls: 0, sdkDispatches: 0, callbacks: 0, nullCallbacks: 0, rootSnapshots: 0, rootSubscriptions: 0,
        published: 0, lateCallbacks: 0, lockCalls: 0, leaseEnds: 0, denyProof: false, hook: null, beforeDispatch: null,
        store: retainedStore || independentStore(), session: independentStore() };
    group.frames.add(frame);
    const ownDom = new Window({ url: 'https://f09-independent-fixture.invalid' }); frame.dom = ownDom;
    Object.defineProperty(ownDom, 'localStorage', { configurable: true, value: frame.store });
    Object.defineProperty(ownDom, 'sessionStorage', { configurable: true, value: frame.session });
    Object.defineProperty(ownDom.navigator, 'locks', { configurable: true, value: { request: async (name, options, action) => {
        if (frame.closing || group.closing || options?.ifAvailable !== true) throw new Error('Independent lock owner ended');
        frame.lockCalls++; if (frame.localLocks.has(name)) return action(null);
        const key = frame.id + ':' + name; frame.localLocks.add(name); locks.add(key);
        try { return await action({ name }); } finally { frame.localLocks.delete(name); locks.delete(key); }
    } } });
    const localFetch = (url, init) => {
        if (frame.closing || group.closing) return Promise.reject(new Error('Independent source read after close'));
        const target = ownedTarget(url); frame.reads++;
        if (frame.denyProof && target.pathname.startsWith('/' + P + '/')) { frame.deniedReads++; return Promise.resolve(new Response('{"error":"synthetic proof READ unavailable"}', { status: 403 })); }
        return independentTask(frame, transport(target, init));
    };
    Object.defineProperty(ownDom, 'fetch', { configurable: true, value: localFetch });
    const timer = (action, ms, ...args) => { const id = ownDom.setTimeout(() => { frame.timers.delete(id); action(...args); }, ms); frame.timers.add(id); return id; };
    const clearTimer = id => { frame.timers.delete(id); ownDom.clearTimeout(id); };
    const interval = (action, ms, ...args) => { const id = ownDom.setInterval(action, ms, ...args); frame.intervals.add(id); return id; };
    const clearIntervalForFrame = id => { frame.intervals.delete(id); ownDom.clearInterval(id); };
    const raf = action => { const id = ownDom.requestAnimationFrame(time => { frame.animations.delete(id); action(time); }); frame.animations.add(id); return id; };
    const cancelRaf = id => { frame.animations.delete(id); ownDom.cancelAnimationFrame(id); };
    const filename = path.join(path.dirname(bundle), frame.id + '.cjs'); fs.writeFileSync(filename, fs.readFileSync(bundle));
    frame.filename = filename; frame.bundleHash = digest(fs.readFileSync(filename));
    const module = { exports: {} }, cache = new Map(), requireHere = createRequire(path.join(ROOT, 'ZoeW/package.json'));
    cache.set(filename, module); frame.moduleCache = cache; frame.module = module;
    const sandbox = { module, exports: module.exports, require: name => { if (!cache.has(name)) cache.set(name, requireHere(name)); return cache.get(name); },
        __filename: filename, __dirname: path.dirname(filename), window: ownDom, document: ownDom.document, navigator: ownDom.navigator,
        localStorage: frame.store, sessionStorage: frame.session, fetch: localFetch, crypto: crypto.webcrypto, process, Buffer, console,
        URL, URLSearchParams, Headers, Request, Response, TextEncoder, TextDecoder, AbortController, AbortSignal, MessageChannel,
        setTimeout: timer, clearTimeout: clearTimer, setInterval: interval, clearInterval: clearIntervalForFrame,
        setImmediate, clearImmediate, queueMicrotask, structuredClone, atob, btoa, performance,
        requestAnimationFrame: raf, cancelAnimationFrame: cancelRaf, confirm: () => true, alert: () => {} };
    for (const name of ['HTMLElement', 'HTMLInputElement', 'HTMLCanvasElement', 'HTMLImageElement', 'HTMLVideoElement', 'HTMLTextAreaElement', 'MutationObserver', 'CustomEvent', 'FileReader', 'Image', 'Node', 'Element', 'Event', 'DOMException']) sandbox[name] = ownDom[name];
    frame.context = vm.createContext(sandbox, { name: 'F09 independent source ' + frame.id });
    vm.runInContext(fs.readFileSync(filename, 'utf8'), frame.context, { filename, timeout: WAIT_MS });
    frame.api = module.exports; return frame;
}
async function connectIndependentContext(frame) {
    const localApi = frame.api;
    const app = firebaseApp.initializeApp({ projectId: PROJECT, databaseURL: origin + '/?ns=' + namespace }, namespace + '-' + frame.id);
    const db = database.getDatabase(app);
    database.connectDatabaseEmulator(db, '127.0.0.1', PORT, { mockUserToken: { sub: UID, user_id: UID, aud: PROJECT } });
    const token = createMockUserToken({ sub: UID, user_id: UID }, PROJECT);
    const auth = { app, currentUser: { uid: UID, getIdToken: async () => token, getIdTokenResult: async () => ({ claims: { aud: PROJECT } }) } };
    const raw = { ...database, getAuth: () => auth, getDatabase: () => db, deleteApp: firebaseApp.deleteApp,
        runTransaction(ref, updater, options) {
            if (frame.closing || frame.group.closing) return Promise.reject(new Error('Independent raw SDK dispatch after close'));
            frame.rawCalls++;
            return independentTask(frame, (async () => {
                if (frame.beforeDispatch) await frame.beforeDispatch(ref);
                if (frame.closing || frame.group.closing) throw new Error('Independent delegate ended before admission');
                frame.sdkDispatches++;
                const result = await database.runTransaction(ref, value => { frame.callbacks++; if (value === null) frame.nullCallbacks++; return updater(value); }, options);
                if (frame.hook) await frame.hook(ref, result); return result;
            })());
        } };
    const sdk = localApi.withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(frame, { app, db, auth, sdk, ref: sdk.ref(db, P + '/' + DAY) });
    frame.store.setItem('zoew_firebase_config', JSON.stringify(app.options));
    Object.assign(localApi.firebaseState, { db, fb: sdk, auth, authGeneration: localApi.firebaseState.authGeneration + 1, firebaseConfig: app.options,
        isInitializingFirebase: false, isDatabaseInitialized: true, isDatabaseConnected: true, firebaseSdkUnavailable: false,
        dbListenersFailed: false, authLoginOperation: null, sessionExpiryCheck: 'live', serverClockTrusted: true, serverTimeOffsetMs: 0 });
    localApi.firebaseState.dbRefDailyPickup = sdk.ref(db, P); localApi.dbListenerPendingPaths.clear(); localApi.dbListenerPendingPaths.add('dailyPickup');
    localApi.dbListenerFailedPaths.clear(); localApi.dataState.dailyPickupData = {}; localApi.dataState.pickupResetInFlight = false;
    localApi.uiState.toasts = []; localApi.uiState.currentFilterMode = 'all'; return frame;
}
async function independentReady(frame) {
    if (frame.readiness) return frame.readiness;
    frame.rootSubscriptions++;
    frame.readiness = independentTask(frame, new Promise((resolve, reject) => {
        frame.cancelReady = () => reject(new Error('Independent first snapshot cancelled'));
        const stop = frame.sdk.onValue(frame.api.firebaseState.dbRefDailyPickup, snapshot => {
            if (frame.closing || frame.group.closing) { frame.lateCallbacks++; return; }
            frame.rootSnapshots++; frame.published++; frame.api.noteDbListenerAlive('dailyPickup');
            frame.api.dataState.dailyPickupData = snapshot.val() || {}; resolve();
        }, reject);
        frame.stops.push(stop);
    }));
    await bounded(frame.readiness, 'independent actual ROOT first snapshot');
}
function independentCanaries(a, b) {
    const registryA = a.api.allStores(), registryB = b.api.allStores();
    const isolated = a.context !== b.context && a.moduleCache !== b.moduleCache && a.module !== b.module && a.api !== b.api
        && a.dom !== b.dom && a.dom.navigator !== b.dom.navigator && a.dom.navigator.locks !== b.dom.navigator.locks
        && a.api.firebaseState !== b.api.firebaseState && a.api.dataState !== b.api.dataState && a.api.allStores !== b.api.allStores
        && registryA.length > 0 && registryA.length === registryB.length && !registryA.some(value => registryB.includes(value))
        && a.api.dbListenerPendingPaths !== b.api.dbListenerPendingPaths && a.api.dbListenerFailedPaths !== b.api.dbListenerFailedPaths
        && a.bundleHash === b.bundleHash && a.bundleHash === a.group.bundleHash;
    a.api.appLocalStore.setItem('p1-store-canary', 'A'); b.api.appLocalStore.setItem('p1-store-canary', 'B');
    a.api.appSessionStore.setItem('p1-session-canary', 'A'); b.api.appSessionStore.setItem('p1-session-canary', 'B');
    const storage = new Set([a.api.appLocalStore, a.api.appSessionStore, b.api.appLocalStore, b.api.appSessionStore]).size === 4
        && a.api.appLocalStore === a.store && b.api.appLocalStore === b.store && a.api.appSessionStore === a.session && b.api.appSessionStore === b.session
        && a.store.getItem('p1-store-canary') === 'A' && b.store.getItem('p1-store-canary') === 'B'
        && a.session.getItem('p1-session-canary') === 'A' && b.session.getItem('p1-session-canary') === 'B';
    const counts = { a: 0, b: 0 }, stopA = a.api.dataState.subscribe(() => counts.a++), stopB = b.api.dataState.subscribe(() => counts.b++);
    a.api.dataState.p1Canary = 'A'; a.api.dataState.flush(); const first = { ...counts };
    b.api.dataState.p1Canary = 'B'; b.api.dataState.flush(); stopA(); stopB();
    const listeners = first.a > 0 && first.b === 0 && counts.a === first.a && counts.b > 0 && a.api.dataState.p1Canary === 'A' && b.api.dataState.p1Canary === 'B';
    a.lease = a.api.captureConnectionOperation(); b.lease = b.api.captureConnectionOperation();
    a.stops.push(a.lease.watch(() => a.leaseEnds++)); b.stops.push(b.lease.watch(() => b.leaseEnds++));
    return { isolated, storage, listeners: listeners && a.lease.current() && b.lease.current(), counts };
}
async function independentRequest(frame, basis = PRIOR, day = DAY) {
    const localApi = frame.api, batchId = 'independent-' + frame.id + '-' + (++serial), scope = frame.app.options.databaseURL;
    const context = { v: 1, scope, batchId, batchHash: await localApi.pickupResetBatchHash(PROJECT, scope, UID, batchId, [day]),
        dayId: batchId + ':' + day, day, nonce: 'independent-nonce-' + serial };
    const casText = localApi.pickupResetCasText(day, basis, localApi.pickupResetRecord(basis));
    return Object.freeze({ tenant: PROJECT, actorUid: UID, context: Object.freeze(context), casText,
        attemptId: await localApi.pickupResetAttemptId(PROJECT, UID, context, casText) });
}
const independentExpected = (frame, request) => frame.api.pickupResetBoundReceipt(PROJECT, UID, request.context, request.attemptId, request.casText, 'native-day');
const independentExecute = (frame, request) => bounded(independentTask(frame, frame.sdk.executePickupReset(frame.sdk.ref(frame.db, P + '/' + request.context.day), request, () => true)), 'independent fixed owned Reset');
const independentStatus = (frame, request) => bounded(independentTask(frame, frame.sdk.pickupResetStatus(frame.sdk.ref(frame.db, P + '/' + request.context.day), request, () => true)), 'independent original status');
async function closeIndependentFrame(frame) {
    if (frame.closed) return;
    const unresolved = frame.tasks.size > 0; frame.closing = true;
    if (frame.api?.firebaseState) { frame.api.firebaseState.authGeneration++; frame.api.firebaseState.flush(); }
    if (frame.cancelReady) frame.cancelReady(); frame.stops.splice(0).forEach(stop => stop());
    for (const id of frame.timers) frame.dom.clearTimeout(id); frame.timers.clear();
    for (const id of frame.intervals) frame.dom.clearInterval(id); frame.intervals.clear();
    for (const id of frame.animations) frame.dom.cancelAnimationFrame(id); frame.animations.clear();
    try {
        if (frame.db) database.goOffline(frame.db);
        if (frame.app) await bounded(frame.sdk ? frame.sdk.deleteApp(frame.app) : firebaseApp.deleteApp(frame.app), 'close only independent SDK app');
        if (frame.dom) await bounded(frame.dom.happyDOM.close(), 'close only independent Window');
        if (unresolved) throw new Error('Independent context closed with unresolved underlying SDK work');
        if (frame.tasks.size || frame.localLocks.size) throw new Error('Independent context is not quiescent');
        frame.closed = true;
    } catch (error) { frame.group.poisoned = true; poisoned = true; throw error; }
}
async function closeIndependentGroup(group) {
    group.closing = true; group.releases.splice(0).forEach(release => release());
    const results = await Promise.allSettled([...group.frames].map(frame => closeIndependentFrame(frame)));
    for (const socket of sockets) socket.close();
    await until(() => [...group.frames].every(frame => frame.tasks.size === 0 && frame.localLocks.size === 0)
        && pending.size === 0 && requests.size === 0 && sockets.size === 0 && locks.size === 0, 'independent group SDK/request/socket/lock quiescence');
    if (group.poisoned || results.some(result => result.status === 'rejected')) { poisoned = true; throw new Error('Independent group outcome uncertain; refuse namespace reuse'); }
    return { contexts: group.frames.size, pending: 0, requests: 0, sockets: 0, locks: 0 };
}
async function independentBehavior(row, group) {
    let a = await connectIndependentContext(await evaluateIndependentContext(group, 'A'));
    const b = await connectIndependentContext(await evaluateIndependentContext(group, 'B'));
    const canaries = independentCanaries(a, b);
    check(row, 'independent-source-globals', canaries.isolated);
    if (row.id === 'independent-context-fixed-cas') {
        check(row, 'captured-store-canaries', canaries.storage);
        check(row, 'source-listener-lease-canaries', canaries.listeners);
    }
    await Promise.all([independentReady(a), independentReady(b)]);
    check(row, 'same-ready-original-basis', equal(clone(a.api.dataState.dailyPickupData[DAY]), PRIOR) && equal(clone(b.api.dataState.dailyPickupData[DAY]), PRIOR));
    if (row.id === 'independent-context-fixed-cas') {
        check(row, 'distinct-sdk-owner-registration', a.app !== b.app && a.db !== b.db && a.auth !== b.auth && a.ref !== b.ref
            && a.app.name !== b.app.name && a.sdk.__connectionOwned === true && b.sdk.__connectionOwned === true);
        const requestsForPair = await Promise.all([independentRequest(a), independentRequest(b)]), original = requestsForPair.map(value => JSON.stringify(value));
        const crossReads = b.reads, crossCalls = b.rawCalls;
        const crossed = await b.sdk.pickupResetStatus(a.ref, requestsForPair[0], () => true);
        check(row, 'crossed-reference-zero-dispatch', crossed.outcome === 'unknown' && b.reads === crossReads && b.rawCalls === crossCalls);
        const entered = new Set(); let openBarrier; const gate = new Promise(resolve => { openBarrier = resolve; }); group.releases.push(openBarrier);
        const before = frame => async () => { entered.add(frame.id); await gate; };
        a.beforeDispatch = before(a); b.beforeDispatch = before(b);
        const operations = [independentExecute(a, requestsForPair[0]), independentExecute(b, requestsForPair[1])];
        await until(() => entered.size === 2, 'two distinct independent delegate entries');
        check(row, 'two-distinct-pre-admission', entered.has(a.id) && entered.has(b.id) && a.rawCalls === 1 && b.rawCalls === 1
            && a.sdkDispatches === 0 && b.sdkDispatches === 0 && requestsForPair[0].attemptId !== requestsForPair[1].attemptId
            && requestsForPair[0].casText === requestsForPair[1].casText && equal(await owner(), seed()));
        openBarrier(); const settled = await Promise.allSettled(operations);
        const winner = settled.findIndex(result => result.status === 'fulfilled' && result.value.committed === true);
        const applied = settled.filter(result => result.status === 'fulfilled' && result.value.committed === true);
        const winnerExpected = winner >= 0 ? await independentExpected(winner ? b : a, requestsForPair[winner]) : null;
        check(row, 'one-original-applied', applied.length === 1 && winner >= 0
            && (winner ? b : a).api.pickupResetReceiptMatches(settled[winner].value.pickupReset, winnerExpected)
            && (winner ? b : a).api.pickupResetReceiptMatches((await owner(P + '/' + DAY)).pickupResetApplied, winnerExpected));
        const loser = settled[1 - winner];
        check(row, 'loser-fixed-false-or-unknown', (loser.status === 'fulfilled' ? loser.value.committed === false : loser.reason?.txOutcome === 'unknown')
            && requestsForPair.every((value, index) => JSON.stringify(value) === original[index]) && a.sdkDispatches === 1 && b.sdkDispatches === 1);
        check(row, 'one-epoch-no-tail', equal(counters(await owner(P + '/' + DAY)), { pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0 })
            && equal(await owner(P + '/' + OTHER), PRIOR) && equal(await owner(P + '/' + TAIL), PRIOR) && independentJournal(a).length === 0 && independentJournal(b).length === 0);
        const listener = frame => { frame.canaryValue = null; frame.stops.push(frame.sdk.onValue(frame.sdk.ref(frame.db, 'zoew_settings/p1_context_canary'), snapshot => { if (!frame.closing) frame.canaryValue = snapshot.val(); })); };
        listener(a); listener(b); await pause(0);
        const oldCalls = a.rawCalls, oldReads = a.reads; await closeIndependentFrame(a);
        let closedError; try { await a.sdk.executePickupReset(a.ref, requestsForPair[0], () => true); } catch (error) { closedError = error; }
        check(row, 'closed-owner-zero-dispatch', closedError?.txOutcome === 'not-applied' && a.rawCalls === oldCalls && a.reads === oldReads
            && !a.lease.current() && a.leaseEnds > 0 && b.lease.current() && b.leaseEnds === 0);
        await owner('zoew_settings/p1_context_canary', 'PUT', 'B-still-live');
        await until(() => b.canaryValue === 'B-still-live', 'sibling actual listener after first context close');
        check(row, 'sibling-listener-survives', a.canaryValue !== 'B-still-live' && b.canaryValue === 'B-still-live' && !b.closed && b.lease.current());
        row.observed = { canaries, sameBundleHash: group.bundleHash, frameIds: [a.id, b.id], preAdmissionFrames: [...entered],
            requests: requestsForPair, outcomes: settled.map(value => value.status === 'fulfilled' ? { committed: value.value.committed, pickupReset: clone(value.value.pickupReset) } : { txOutcome: value.reason?.txOutcome }),
            sdkDispatches: [a.sdkDispatches, b.sdkDispatches], callbacks: [a.callbacks, b.callbacks], lockModel: 'separate per-VM device scaffolds; not browser engines' };
    } else {
        let durable;
        a.beforeDispatch = async () => { durable = clone(independentJournal(a)[0]); };
        a.hook = async (_ref, result) => { if (result.committed) { a.denyProof = true; throw new Error('synthetic lost ACK after actual independent SDK commit'); } };
        const result = await bounded(independentTask(a, a.api.runPickupResetBatch([DAY, OTHER, TAIL])), 'independent public UNKNOWN');
        const entry = independentJournal(a)[0], attempt = entry?.value.days[0].attempts[0];
        check(row, 'durable-original-before-effects', durable?.key === entry?.key && durable.value.days[0].attempts[0].outcome === 'pending'
            && durable.value.days[0].attempts[0].attemptId === attempt.attemptId && independentJournal(b).length === 0 && canaries.storage && canaries.listeners);
        check(row, 'actual-commit-unknown', result.status === 'hold' && result.doneCount === 0 && attempt.outcome === 'pending'
            && a.deniedReads > 0 && a.rawCalls === 1 && a.api.pickupResetReceiptMatches((await owner(P + '/' + DAY)).pickupResetApplied, await independentExpected(a, attempt)));
        const repeat = await a.api.runPickupResetBatch([DAY, OTHER, TAIL]);
        check(row, 'original-held-no-tail', repeat.status === 'hold' && a.rawCalls === 1 && entry.value.days.slice(1).every(day => day.attempts.length === 0)
            && equal(await owner(P + '/' + OTHER), PRIOR) && equal(await owner(P + '/' + TAIL), PRIOR));
        await until(() => b.api.dataState.dailyPickupData[DAY]?.pickupResetEpoch === 3 && b.api.dataState.dailyPickupData[DAY]?.packagesPickedUp === 0, 'sibling actual Reset snapshot before pickup');
        const pickupContext = await b.api.capturePickupContext(DAY);
        const picked = await bounded(independentTask(b, b.api.commitPickupMarks(DAY, [{ key: 'AFTER', phoneKey: 'PHONE', closed: true }], false, true, undefined, pickupContext)), 'independent sibling actual pickup');
        await until(() => b.api.dataState.dailyPickupData[DAY]?.packagesPickedUp === 1, 'sibling real pickup listener');
        const later = await owner(P + '/' + DAY), proof = clone(later.pickupResetApplied);
        check(row, 'independent-later-pickup', picked === true && later.pickupRevision === 7 && later.pickupResetEpoch === 3 && later.packagesPickedUp === 1
            && equal(later.pickedUpBarcodes, { AFTER: 'PHONE' }) && equal(later.pickedUpPhones, { PHONE: 1 })
            && b.api.pickupResetReceiptMatches(proof, await independentExpected(a, attempt)) && independentJournal(b).length === 0);
        const retainedStore = a.store, originalBytes = retainedStore.getItem(entry.key), oldApi = a.api, oldDb = a.db;
        a.hook = null; a.denyProof = false; await closeIndependentFrame(a);
        a = await connectIndependentContext(await evaluateIndependentContext(group, 'A-recreated', retainedStore));
        check(row, 'sdk-source-recreated', a.api !== oldApi && a.db !== oldDb && a.bundleHash === group.bundleHash
            && a.store.getItem(entry.key) === originalBytes && a.rootSubscriptions === 0 && a.rootSnapshots === 0 && b.lease.current());
        const view = clone(a.api.dataState.dailyPickupData), bView = clone(b.api.dataState.dailyPickupData), clock = a.api.firebaseState.serverTimeOffsetMs, bClock = b.api.firebaseState.serverTimeOffsetMs;
        const beforeResume = await owner(), resumed = await bounded(independentTask(a, a.api.resumePickupResetOutcomes()), 'independent original status-only resume');
        const saved = independentJournal(a)[0];
        check(row, 'same-original-status-only', resumed.resolved === 1 && saved.key === entry.key && saved.value.days[0].attempts[0].attemptId === attempt.attemptId
            && saved.value.days[0].attempts[0].casText === attempt.casText && saved.value.settled === true && saved.value.complete === false
            && a.reads > 0 && a.rawCalls === 0 && a.rootSubscriptions === 0 && a.rootSnapshots === 0);
        check(row, 'later-view-clock-kept', equal(clone(a.api.dataState.dailyPickupData), view) && equal(clone(b.api.dataState.dailyPickupData), bView)
            && a.api.firebaseState.serverTimeOffsetMs === clock && b.api.firebaseState.serverTimeOffsetMs === bClock && equal(await owner(), beforeResume));
        check(row, 'no-execute-replay-or-tail', a.rawCalls === 0 && saved.value.days.slice(1).every(day => day.attempts.length === 0)
            && equal(await owner(P + '/' + OTHER), PRIOR) && equal(await owner(P + '/' + TAIL), PRIOR) && equal((await owner(P + '/' + DAY)).pickupResetApplied, proof));
        row.observed = { canaries, original: clone(attempt), beforeEffects: durable, retainedJournalBytes: originalBytes.length, resumed,
            recreatedBundleHash: a.bundleHash, sameProcessMemoryStore: true, automaticStartup: 'UNRUN; direct resume service', realBrowserLocks: 'UNRUN; separate per-VM scaffolds' };
    }
    await preserve(row);
}

async function run() {
    const sourceHashes = Object.fromEntries(SOURCES.map(file => [file, digest(fs.readFileSync(path.join(ROOT, file)))]));
    const built = await bootstrap();
    if (await owner() !== null) throw new Error('Fresh owned namespace is not empty');
    acquired = true; await rules(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8')); engineStarted = true;
    for (const [id, labels] of PLAN) {
        const row = { id, expected: labels, assertions: [], pass: false, cleanup: false }; cases.push(row);
        if (await owner() !== null) { poisoned = true; throw new Error('Owned root was not empty before seed'); }
        let frame, group;
        try {
            const fixture = await pairedFixture.seedFor(id, api);
            if (!equal(pairedFixture.commonSeed(), seed())) throw new Error('Shared common fixture differs from native baseline');
            row.seedProfile = fixture.profile; row.seedHash = fixture.seedHash; row.seedProvenance = fixture.provenance;
            store.clear(); denyStorage = false; storageDenials = 0; await owner('', 'PUT', fixture.value);
            if (id.startsWith('independent-context-')) { group = independentGroupForCase(); independentGroup = group; await bounded(independentBehavior(row, group), id); }
            else { frame = await open(); await bounded(behavior(row, frame), id); }
            row.pass = row.assertions.length === labels.length && row.assertions.every(value => value.pass);
        } catch (error) { row.error = String(error.message || error); if (/Timed out|Unsettled/.test(row.error)) poisoned = true; }
        finally {
            denyStorage = false;
            try {
                if (group) { row.contextCleanup = await closeIndependentGroup(group); independentGroup = null; }
                else { frame = active || frame; if (frame) await close(frame); }
                if (poisoned) throw new Error('Uncertain asynchronous fixture outcome; no namespace reuse');
                await owner('', 'DELETE'); if (await owner() !== null) throw new Error('Owned root not empty after case'); row.cleanup = true;
            }
            catch (error) { poisoned = true; row.cleanupError = String(error.message || error); throw error; }
        }
    }
    closing = true; await rules(JSON.stringify({ rules: { '.read': false, '.write': false } })); released = true;
    const after = Object.fromEntries(SOURCES.map(file => [file, digest(fs.readFileSync(path.join(ROOT, file)))]));
    const inputHashesAfter = Object.fromEntries(built.inputs.map(file => [file, digest(fs.readFileSync(path.resolve(ROOT, file)))]));
    if (!equal(sourceHashes, after) || !equal(built.inputHashes, inputHashesAfter)) throw new Error('Source changed while native checker ran');
    return { bundleHash: built.hash, bundleInputs: built.inputs, bundleInputHashes: built.inputHashes, sourceHashes, namespace, sourceStable: true };
}
if ((!STRICT && process.env.F09_RUN_NATIVE_ENGINE !== '1') || process.argv.includes('--plan')) {
    const refused = STRICT && process.argv.includes('--plan');
    console.log(refused ? 'FAIL strict native checker refuses plan-only execution' : 'SKIP actual native F09 engine UNRUN; enable strict CI or F09_RUN_NATIVE_ENGINE=1');
    console.log(JSON.stringify({ status: refused ? 'FAIL_PLAN_ONLY_IN_STRICT' : 'UNRUN_NATIVE_ENGINE', engineStarted: false, plan: PLAN, expectedCases: PLAN.length, expectedAssertions: PLAN.reduce((sum, row) => sum + row[1].length, 0) }));
    process.exitCode = refused ? 1 : 0;
} else {
    process.exitCode = 1;
    let evidence;
    run().then(value => { evidence = value; }, error => { errors.push(String(error.stack || error)); })
        .finally(async () => {
            if (!poisoned && active) { try { await close(active); } catch (error) { errors.push('Final app cleanup: ' + error.message); poisoned = true; } }
            if (!poisoned && acquired && !released) {
                try { await owner('', 'DELETE'); if (await owner() !== null) throw new Error('Final owned root not empty'); await rules(JSON.stringify({ rules: { '.read': false, '.write': false } })); released = true; }
                catch (error) { errors.push('Namespace cleanup: ' + error.message); poisoned = true; }
            }
            if (!poisoned && dom) { try { await dom.happyDOM.close(); } catch (error) { errors.push('DOM cleanup: ' + error.message); } }
            if (websocket && !poisoned) websocket.Client = originalSocket;
            httpAgent.destroy();
            if (bundle && !poisoned) fs.rmSync(path.dirname(bundle), { recursive: true, force: true });
            const pass = engineStarted && released && cases.length === PLAN.length && cases.every(row => row.pass && row.cleanup) && !errors.length && !poisoned && pending.size === 0 && requests.size === 0 && sockets.size === 0 && locks.size === 0 && animationFrames.size === 0;
            console.log(JSON.stringify({ status: pass ? 'PASS_ACTUAL_NATIVE_F09_BOUNDARY' : 'FAIL_ACTUAL_NATIVE_F09_BOUNDARY', engineRequested: true, engineStarted,
                expectedCases: PLAN.length, expectedAssertions: PLAN.reduce((sum, row) => sum + row[1].length, 0), completedCases: cases.length,
                executedAssertions: cases.reduce((sum, row) => sum + row.assertions.length, 0), cases, errors, cleanupUncertain: poisoned,
                pendingTasks: pending.size, activeRequests: requests.size, ownedSockets: sockets.size, heldLocks: locks.size, pendingAnimationFrames: animationFrames.size, evidence,
                limits: ['native only; not SQL membership/quota/2-day expiry proof', 'WebLocks scaffold is not browser engine proof', 'legacy cases represent field-unaware payloads, not every old binary', 'no hosted/old-client universal compatibility guarantee'] }));
            process.exitCode = pass ? 0 : 1;
            if (!pass) process.exit(1);
        });
}
