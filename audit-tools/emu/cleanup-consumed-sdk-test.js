'use strict';
let failed = 0;
// Actual Firebase SDK + canonical rules. Only emulator fixture setup uses owner REST.
// Delay original pickup submission, never fabricate its transaction outcome.
// Both warm-listener and cold-cache finalization paths must settle actual server receipts.
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), assert = require('assert/strict');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(process.env.SCANSDK_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '../..'));
const deps = path.join(ROOT, 'ZoeW/node_modules');
const port = Number(process.env.SCANRULES_EMU_PORT || 9000);
const websocket = require(require.resolve('faye-websocket', { paths: [deps] }));
const originalClient = websocket.Client;
const localSocketOptions = (url, options) => {
    const target = new URL(url);
    if (target.protocol !== 'ws:' || target.hostname !== '127.0.0.1' || Number(target.port) !== port) return options;
    const local = { ...options }; delete local.proxy; return local;
};
const originalOptions = { proxy: { origin: 'http://fixture-proxy.invalid' }, headers: { test: 'kept' } };
assert.deepEqual(localSocketOptions('ws://127.0.0.1:' + port, originalOptions), { headers: originalOptions.headers });
assert.ok(originalOptions.proxy);
for (const url of ['ws://example.invalid:' + port, 'ws://127.0.0.1:' + (port + 1), 'wss://127.0.0.1:' + port]) {
    assert.equal(localSocketOptions(url, originalOptions), originalOptions);
}
websocket.Client = function (url, protocols, options) { return new originalClient(url, protocols, localSocketOptions(url, options)); };
const { buildSync } = require(path.join(deps, 'esbuild'));
const { initializeApp, deleteApp } = require(path.join(deps, 'firebase/app'));
const database = require(path.join(deps, 'firebase/database'));
const { createMockUserToken } = require(path.join(deps, '@firebase/util'));
const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', D = 'zoew_daily_revenue_cod_dod';
const M = 'zoew_monthly_revenue_cod_dod', R = 'zoew_barcode_registry', G = 'zoew_trash_consumptions';
const P = 'zoew_daily_pickup_cod_dod', C = 'zoew_daily_collected_cod_dod';
const day = '2026-10-30', month = '2026-10', stamp = Date.UTC(2026, 9, 30, 2), uid = 'generation-owner', code = 'GENSDK000001';
const copy = value => JSON.parse(JSON.stringify(value));
const apps = [], results = [];
setTimeout(() => { console.error('fixture global timeout'); process.exit(124); }, 60000).unref();
function request(url, init = {}) {
    const target = new URL(url);
    if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || Number(target.port) !== port) throw new Error('fixture ទទួលតែ loopback ដែលកាន់កាប់');
    return new Promise((resolve, reject) => {
        const req = http.request(target, { method: init.method || 'GET', headers: init.headers || {}, timeout: 15000 }, response => {
            let body = ''; response.on('data', part => { body += part; }); response.on('end', () => resolve(new Response(body, { status: response.statusCode, headers: response.headers })));
        });
        req.on('timeout', () => req.destroy(new Error('fixture local timeout'))); req.on('error', reject);
        if (init.body) req.write(init.body); req.end();
    });
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const bounded = (promise, label) => Promise.race([promise, pause(12000).then(() => { throw new Error('fixture timed out: ' + label); })]);
(async () => {
    const { Window } = await import(pathToFileURL(path.join(deps, 'happy-dom/lib/index.js')).href);
    const window = new Window({ url: 'https://generation-probe.invalid' });
    for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'HTMLInputElement', 'HTMLVideoElement',
        'HTMLCanvasElement', 'HTMLImageElement', 'HTMLTextAreaElement', 'MutationObserver', 'CustomEvent', 'FileReader', 'Image', 'Node', 'Element', 'Event']) {
        Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window); globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    globalThis.confirm = () => true; globalThis.alert = message => console.log('fixture alert', message);
    Object.defineProperty(globalThis, 'crypto', { value: require('crypto').webcrypto, configurable: true });
    globalThis.ZoeErrors = window.ZoeErrors = { capture: (error, detail) => console.log('fixture captured', error?.message, detail?.context) };
    const built = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-trash-generation-sdk-')), 'source.cjs');
    buildSync({ absWorkingDir: ROOT, stdin: { contents: `export { capturePickupContext } from './ZoeW/src/domain/pickup';
export { addOrUpdateEntry } from './ZoeW/src/features/scan-action';
export { removeSingleBarcode } from './ZoeW/src/features/barcode-ops';
export { deleteSingleItem } from './ZoeW/src/features/entry-ops';
export { executeRestoreItem, executePermanentDelete } from './ZoeW/src/features/restore';
export { readCleanupJournal, resumeCleanupJournalEntry, cleanupJournalLive, cleanupInFlight } from './ZoeW/src/domain/cleanup';
export { CLEANUP_JOURNAL_KEY } from './ZoeW/src/core/storage-keys';
export { withTransactionOutcomeResolution } from './ZoeW/src/services/tx-outcome';
export { liveShopScope } from './ZoeW/src/core/shop-scope';
export { firebaseState, dataState, uiState, ztoState } from './ZoeW/src/core/state';`, resolveDir: ROOT }, bundle: true, platform: 'node', format: 'cjs', outfile: built, logLevel: 'error', define: { 'import.meta.env': '{}' } });
    const api = require(built);
    const bundleHash = require('crypto').createHash('sha256').update(fs.readFileSync(built)).digest('hex');
    for (const warmFinalization of [true, false]) for (const scenario of ['exact', 'different-target', 'missing', 'old-generation']) {
        localStorage.clear(); sessionStorage.clear(); api.firebaseState.authGeneration++;
        const ns = 'demo-trash-generation-' + process.pid + '-' + scenario + '-' + warmFinalization;
        const endpoint = 'http://127.0.0.1:' + port + '/?ns=' + ns;
        const owner = async (node = '', method = 'GET', value) => {
            const response = await request('http://127.0.0.1:' + port + '/' + node + '.json?ns=' + ns, {
                method, headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
            const text = await response.text(); if (!response.ok) throw new Error('fixture owner ' + response.status + ' ' + text); return text ? JSON.parse(text) : null;
        };
        const rules = await request('http://127.0.0.1:' + port + '/.settings/rules.json?ns=' + ns, { method: 'PUT', headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, body: fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8') });
        assert.equal(rules.status, 200);
        await owner('', 'PUT', { [D]: { [day]: { codDollar: 10, dodDollar: 0, totalCount: 1 } }, [M]: { [month]: { codDollar: 10, dodDollar: 0, totalCount: 1 } } });
        globalThis.fetch = (url, init) => request(String(url), init);
        const app = initializeApp({ projectId: 'demo-trash-generation', databaseURL: endpoint }, ns); apps.push(app);
        const db = database.getDatabase(app); database.connectDatabaseEmulator(db, '127.0.0.1', port, { mockUserToken: { sub: uid, user_id: uid } });
        const token = createMockUserToken({ sub: uid, user_id: uid }, 'demo-trash-generation');
        const auth = { app, currentUser: { uid, getIdToken: async () => token } };
        let gate = null;
        const raw = { ...database, getAuth: () => auth, getDatabase: () => db, deleteApp,
            runTransaction: async (ref, updater, options) => {
                if (gate && !gate.used && String(ref).includes('/' + P + '/')) {
                    gate.used = true; gate.entered(); await gate.wait;
                    const result = await database.runTransaction(ref, updater, options);
                    gate.outcome = result.committed; return result;
                }
                const result = await database.runTransaction(ref, updater, options);
                return result;
            } };
        const sdk = api.withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
        Object.assign(api.firebaseState, { db, fb: sdk, auth, firebaseConfig: app.options, isInitializingFirebase: false, isDatabaseInitialized: true,
            firebaseSdkUnavailable: false, isDatabaseConnected: true, hasEverConnectedToDatabase: true, serverClockTrusted: true, serverTimeOffsetMs: 0,
            sessionExpiryCheck: 'live', authLoginOperation: null });
        localStorage.setItem('zoew_firebase_config', JSON.stringify(app.options));
        Object.assign(api.dataState, { scanHistory: [], deletedItems: [], dailyRevenueData: {}, monthlyRevenueData: {}, dailyPickupData: {}, dailyCollectedData: {}, pickupResumeInFlight: false, cleanupResumeInFlight: false, deletedCleanupInFlight: false });
        api.uiState.toasts = []; api.cleanupJournalLive.clear(); api.cleanupInFlight.clear();
        api.ztoState.ztoStatusLoaded = true; api.ztoState.ztoTrashMode = { state: 'off', palmAt: 0, cookieAt: 0, failedAt: 0, stamps: {}, shop: api.liveShopScope() };
        const mapping = { dbRefHistory: H, dbRefDeleted: T, dbRefDailyRevenue: D, dbRefMonthlyRevenue: M,
            dbRefDailyPickup: 'zoew_daily_pickup_cod_dod', dbRefDailyCollected: 'zoew_daily_collected_cod_dod' };
        for (const [field, node] of Object.entries(mapping)) api.firebaseState[field] = sdk.ref(db, node);
        const unsubscribers = [];
        await Promise.all([...(warmFinalization ? [['zoew_restore_finalizations', 'fixtureFinalizations', false]] : []), [H, 'scanHistory', true], [T, 'deletedItems', true], [D, 'dailyRevenueData', false], [M, 'monthlyRevenueData', false]].map(([node, field, list]) => new Promise((resolve, reject) => {
            let first = true;
            unsubscribers.push(database.onValue(database.ref(db, node), snapshot => { api.dataState[field] = list ? Object.values(snapshot.val() || {}) : snapshot.val() || {}; if (first) { first = false; resolve(); } }, reject));
        })));
        const birth = Date.now() - 3600000;
        const barcode = { code, cod: 5, dod: 0, createdAt: birth, isClosed: true, closedAt: birth + 1000 };
        const sibling = { code: 'GENSDK000002', cod: 5, dod: 0, createdAt: birth, isClosed: false };
        const initial = { id: 'p7', time: '09:00:00', phone: '012345678', scanDate: day, createdAt: birth, isClosed: false, cod: 10, dod: 0, price: 10, count: 2, barcode: code, barcodes: [barcode, sibling] };
        await owner(H + '/p7', 'PUT', initial);
        await owner(R, 'PUT', { [code]: true, [sibling.code]: true });
        await owner(P + '/' + day, 'PUT', { packagesPickedUp: 1, pickedUpPhones: { '012345678': 1 }, pickedUpBarcodes: { [code]: '012345678' } });
        await owner(C + '/' + day + '/' + code, 'PUT', { c: 5, d: 0 });
        await pause(50);
        api.dataState.dailyPickupData = await owner(P); api.dataState.dailyCollectedData = await owner(C);
        await api.capturePickupContext(day);
        let entered, release; const reached = new Promise(resolve => { entered = resolve; });
        gate = { entered, wait: new Promise(resolve => { release = resolve; }), used: false };
        const removing = api.removeSingleBarcode(initial.id, code);
        await bounded(reached, 'pickup submission held');
        await bounded(removing, 'Remove while mirror held');
        const pending = api.readCleanupJournal(); assert.equal(pending.length, 1); assert.equal(pending[0].stage, 'collected');
        const trashId = pending[0].trashItem.id;
        if (scenario === 'different-target') {
            const old = await owner(H + '/p7');
            await owner(H + '/p7/phone', 'PUT', '098765432');
            await owner(H + '/restore_peer', 'PUT', { ...old, id: 'restore_peer', barcode: 'PEER70002', barcodes: [{ ...sibling, code: 'PEER70002' }] });
            await pause(50);
        }
        api.uiState.pendingRestoreId = trashId; await bounded(api.executeRestoreItem(), 'public Restore');
        let server = await owner();
        for (let n = 0; n < 100 && server.zoew_restore_finalizations?.[trashId]; n++) { await pause(20); server = await owner(); }
        const receipt = server[G][trashId];
        assert.equal(receipt.kind, 'restore'); assert.equal(receipt.generation, 1);
        assert.equal(server[T]?.[trashId] ?? null, null);
        assert.equal(server.zoew_restore_finalizations?.[trashId] ?? null, null);
        const money = [copy(server[D]), copy(server[M])];
        assert.equal(server[P][day].packagesPickedUp, 1);
        if (scenario === 'missing') await owner(G + '/' + trashId, 'DELETE');
        if (scenario === 'old-generation') await owner(G + '/' + trashId + '/generation', 'PUT', 2);
        if (scenario === 'different-target') {
            assert.equal(receipt.targetId, 'restore_peer');
            for (const unsubscribe of unsubscribers) unsubscribe();
            api.dataState.scanHistory = api.dataState.scanHistory.filter(row => row.id !== receipt.targetId);
        }
        const held = gate; release();
        for (let n = 0; n < 100 && held.outcome === undefined; n++) await pause(20);
        assert.equal(held.outcome, false, 'actual SDK refuses obsolete pickup revision against server-synchronized state');
        gate = null;
        for (let n = 0; n < 100 && api.cleanupJournalLive.has(trashId); n++) await pause(20);
        await bounded(api.resumeCleanupJournalEntry(trashId), 'collected consumed recovery');
        server = await owner();
        assert.deepEqual([server[D], server[M]], money);
        assert.equal(server[D][day].codDollar, 10); assert.equal(server[M][month].codDollar, 10);
        assert.equal(server[D][day].totalCount, 1); assert.equal(server[M][month].totalCount, 1);
        assert.equal(server[P][day].packagesPickedUp, 1);
        assert.equal(server[P][day].pickedUpBarcodes[code], '012345678');
        assert.ok(Object.values(server[C] || {}).some(bucket => bucket[code]));
        const expectedHeld = scenario === 'missing' || scenario === 'old-generation';
        assert.equal(api.readCleanupJournal().length, expectedHeld ? 1 : 0);
        const journalBytes = JSON.stringify(api.readCleanupJournal());
        await bounded(api.resumeCleanupJournalEntry(trashId), 'repeat recovery');
        assert.equal(JSON.stringify(api.readCleanupJournal()), journalBytes);
        assert.deepEqual(await owner(), server);
        results.push({ scenario, warmFinalization, actualOldPickupCommitted: held.outcome, targetId: receipt.targetId, pickup: server[P][day].packagesPickedUp, dailyMoney: server[D][day].codDollar, monthlyMoney: server[M][month].codDollar, collectedPresent: true, journalHeld: expectedHeld, repeatedResumeUnchanged: true });
        for (const unsubscribe of unsubscribers) unsubscribe(); await sdk.deleteApp(app); api.firebaseState.authGeneration++; await owner('', 'DELETE');
    }
    assert.equal(results.length, 8);
    console.log(JSON.stringify({ actualSdkAndCanonicalRtdb: true, sourceBundleHash: bundleHash, delayedOriginalPickupSubmission: true, warmAndColdFinalization: true, sourceHashes: Object.fromEntries(['ZoeW/src/domain/cleanup.ts', 'ZoeW/src/features/restore.ts', 'firebase-database.rules.json'].map(file => [file, require('crypto').createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')])), cases: results }, null, 2));
    await window.happyDOM.close();
    console.log('cleanup consumed SDK: ' + results.length + ' PASS, 0 FAIL');
})().catch(async error => { failed++; console.error(error.stack || error); for (const app of apps) await deleteApp(app).catch(() => {}); })
    .finally(() => process.exit(failed ? 1 : 0));
