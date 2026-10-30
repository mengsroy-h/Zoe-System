'use strict';
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
    buildSync({ absWorkingDir: ROOT, stdin: { contents: `export { addOrUpdateEntry } from './ZoeW/src/features/scan-action';
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
    for (const scenario of ['restore-remove', 'purge', 'reuse']) {
        localStorage.clear(); sessionStorage.clear(); api.firebaseState.authGeneration++;
        const ns = 'demo-trash-generation-' + process.pid + '-' + scenario;
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
                const result = await database.runTransaction(ref, updater, options);
                if (gate && !gate.used && String(ref).includes('/' + T + '/') && result.committed) {
                    gate.used = true; gate.entered(); await gate.wait;
                }
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
        await Promise.all([[H, 'scanHistory', true], [T, 'deletedItems', true], [D, 'dailyRevenueData', false], [M, 'monthlyRevenueData', false]].map(([node, field, list]) => new Promise((resolve, reject) => {
            let first = true;
            unsubscribers.push(database.onValue(database.ref(db, node), snapshot => { api.dataState[field] = list ? Object.values(snapshot.val() || {}) : snapshot.val() || {}; if (first) { first = false; resolve(); } }, reject));
        })));
        const saved = await bounded(api.addOrUpdateEntry(code, '012345678', 5, 0, 'A1', stamp), 'scan'); assert.ok(saved === true || saved === false);
        let server = await owner();
        const initial = Object.values(server[H]).find(row => Object.values(row.barcodes || {}).some(barcode => barcode.code === code));
        assert.ok(initial); const registry = copy(server[R][code]);
        let entered, release; const reached = new Promise(resolve => { entered = resolve; });
        gate = { entered, wait: new Promise(resolve => { release = resolve; }), used: false };
        const removing = api.removeSingleBarcode(initial.id, code);
        await bounded(reached, 'trash commit before ACK');
        const pending = api.readCleanupJournal(); assert.equal(pending.length, 1);
        const original = copy(pending[0]); assert.equal(original.stage, 'slot'); assert.equal(original.trashItem.trashGeneration, 1);
        const journal = Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith(api.CLEANUP_JOURNAL_KEY)).map(key => [key, localStorage.getItem(key)]));
        release(); await bounded(removing, 'first Remove'); gate = null;
        server = await owner(); const firstId = original.trashItem.id;
        assert.equal(server[D][day].codDollar, 10); assert.equal(server[D][day].totalCount, 1);
        assert.equal(server[T][firstId].trashGeneration, 1);
        let finalId = firstId, expectedMoney = 10, expectedCount = 1;
        if (scenario !== 'purge') {
            api.uiState.pendingRestoreId = firstId; await bounded(api.executeRestoreItem(), 'Restore');
            server = await owner(); assert.equal(server[G][firstId].generation, 1); assert.equal(server[G][firstId].kind, 'restore');
            const restored = Object.values(server[H]).find(row => Object.values(row.barcodes || {}).some(barcode => barcode.code === code));
            assert.ok(restored); assert.equal(restored.trashGeneration, undefined); assert.equal(server[D][day].codDollar, 15);
            if (scenario === 'reuse') {
                api.firebaseState.serverTimeOffsetMs = original.trashItem.deletedAt - Date.now();
                await bounded(api.deleteSingleItem(restored.id, { confirmed: true, quiet: true }), 'new generation Delete');
                api.firebaseState.serverTimeOffsetMs = 0;
                server = await owner(); finalId = restored.id;
                assert.equal(finalId, firstId); assert.equal(server[T][finalId].trashGeneration, 2);
                expectedMoney = 15; expectedCount = 2;
            } else {
                await bounded(api.removeSingleBarcode(restored.id, code), 'second Remove');
                server = await owner(); finalId = Object.keys(server[T]).find(id => Object.values(server[T][id].barcodes || {}).some(barcode => barcode.code === code));
                assert.notEqual(finalId, firstId); assert.equal(server[T][finalId].trashGeneration, 1);
            }
        }
        if (scenario === 'purge') { api.uiState.pendingPermanentDeleteId = finalId; await bounded(api.executePermanentDelete(), 'purge'); }
        for (const [key, value] of Object.entries(journal)) localStorage.setItem(key, value);
        api.cleanupJournalLive.clear(); api.cleanupInFlight.clear(); api.dataState.deletedItems = [];
        const before = await owner(); await bounded(api.resumeCleanupJournalEntry(firstId), 'old journal replay');
        assert.deepEqual(await owner(), before); assert.equal(api.readCleanupJournal().length, 1);
        if (scenario !== 'purge') {
            api.dataState.deletedItems = Object.values((await owner(T)) || {});
            api.uiState.pendingPermanentDeleteId = finalId; await bounded(api.executePermanentDelete(), 'purge newer source');
        }
        server = await owner(); assert.equal(server[R]?.[code] ?? null, null); assert.equal(server[T]?.[finalId] ?? null, null);
        assert.equal(server[G][finalId].kind, 'purge'); assert.equal(server[G][finalId].generation, scenario === 'reuse' ? 2 : 1);
        for (const [node, bucket] of [[D, day], [M, month]]) { assert.equal(server[node][bucket].codDollar, expectedMoney); assert.equal(server[node][bucket].totalCount, expectedCount); }
        const done = copy(server); await api.resumeCleanupJournalEntry(firstId); assert.deepEqual(await owner(), done);
        assert.equal(Object.values(server[H] || {}).some(row => Object.values(row.barcodes || {}).some(barcode => barcode.code === code)), false);
        results.push({ scenario, originalGeneration: 1, finalGeneration: server[G][finalId].generation, money: expectedMoney, count: expectedCount,
            oldJournalHeld: api.readCleanupJournal().length === 1, originalRegistryOwner: registry, noResurrection: true });
        for (const unsubscribe of unsubscribers) unsubscribe(); await sdk.deleteApp(app); api.firebaseState.authGeneration++; await owner('', 'DELETE');
    }
    assert.equal(results.length, 3);
    console.log(JSON.stringify({ actualSdkAndCanonicalRtdb: true, sourceBundleHash: bundleHash, simulatedLateTrashAckAndLocalJournalRestart: true, cases: results }, null, 2));
    await window.happyDOM.close();
    console.log('trash generation SDK: ' + results.length + ' PASS, 0 FAIL');
    process.exit(0);
})().catch(async error => { console.error(error.stack || error); for (const app of apps) await deleteApp(app).catch(() => {}); process.exit(1); });
