'use strict';
let failed = 0;
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
let wireMonthGate = null;
websocket.Client = function (url, protocols, options) {
    const client = new originalClient(url, protocols, localSocketOptions(url, options));
    const target = new URL(url), requests = new Set();
    const local = target.protocol === 'ws:' && target.hostname === '127.0.0.1' && Number(target.port) === port;
    if (!local) return client;
    const send = client.send, dispatch = client.dispatchEvent;
    client.send = function (data) {
        try {
            const request = JSON.parse(String(data));
            if (wireMonthGate && target.searchParams.get('ns') === wireMonthGate.namespace && request.t === 'd'
                && request.d?.a === 'p' && request.d?.b?.p === '/zoew_monthly_revenue_cod_dod' && typeof request.d?.b?.h === 'string') {
                requests.add(request.d.r); wireMonthGate.requests++;
            }
        } catch (error) {}
        return send.call(this, data);
    };
    client.dispatchEvent = function (event) {
        try {
            const message = event.type === 'message' ? JSON.parse(String(event.data)) : null;
            if (wireMonthGate && !wireMonthGate.held && target.searchParams.get('ns') === wireMonthGate.namespace
                && message?.t === 'd' && requests.has(message.d?.r) && message.d?.b?.s === 'ok') {
                wireMonthGate.held = true;
                wireMonthGate.resolve({ client, deliver: () => dispatch.call(client, event) });
                return;
            }
        } catch (error) {}
        return dispatch.call(this, event);
    };
    return client;
};
const { buildSync } = require(path.join(deps, 'esbuild'));
const { initializeApp, deleteApp, getApps } = require(path.join(deps, 'firebase/app'));
const database = require(path.join(deps, 'firebase/database'));
const { createMockUserToken } = require(path.join(deps, '@firebase/util'));
const H = 'zoew_scan_history_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod', R = 'zoew_barcode_registry';
const day = '2026-10-30', month = '2026-10', stamp = Date.UTC(2026, 9, 30, 2), uid = 'scan-owner';
const copy = value => JSON.parse(JSON.stringify(value));
const results = [], apps = [], negativeResults = [];
const selectedMode = process.argv.slice(2);
assert.ok(selectedMode.length <= 1 && selectedMode.every(value => ['--month-wire=delay', '--month-wire=reconnect'].includes(value)), 'fixture mode មិនត្រឹមត្រូវ');
const wireRetry = selectedMode[0] === '--month-wire=reconnect' || process.env.SCANSDK_MONTH_WIRE === '2';
const wireMode = selectedMode[0] === '--month-wire=delay' || process.env.SCANSDK_MONTH_WIRE === '1' || wireRetry;
let negativeControlsDone = false;
setTimeout(() => { console.error('fixture global timeout'); process.exit(124); }, 60000).unref();
function localRequest(url, init = {}) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || Number(parsed.port) !== port) throw new Error('ច្រក fixture មិនមែន loopback');
    return new Promise((resolve, reject) => {
        const request = http.request(parsed, { method: init.method || 'GET', headers: init.headers || {}, timeout: 15000 }, response => {
            let body = ''; response.on('data', part => { body += part; });
            response.on('end', () => resolve(new Response(body, { status: response.statusCode, headers: response.headers })));
        });
        request.on('timeout', () => request.destroy(new Error('fixture local request timed out')));
        request.on('error', reject); if (init.body) request.write(init.body); request.end();
    });
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const bounded = (promise, label) => Promise.race([promise, pause(15000).then(() => { throw new Error('probe timed out: ' + label); })]);

(async () => {
    const { Window } = await import(pathToFileURL(path.join(deps, 'happy-dom/lib/index.js')).href);
    const window = new Window({ url: 'https://scan-probe.invalid' });
    for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'HTMLInputElement', 'HTMLVideoElement',
        'HTMLCanvasElement', 'HTMLImageElement', 'HTMLTextAreaElement', 'MutationObserver', 'CustomEvent', 'FileReader', 'Image', 'Node', 'Element', 'Event']) {
        Object.defineProperty(globalThis, key, { value: key === 'window' ? window : window[key], configurable: true, writable: true });
    }
    globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
    globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    globalThis.confirm = () => true;
    Object.defineProperty(globalThis, 'crypto', { value: require('crypto').webcrypto, configurable: true });
    const built = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-scan-sdk-')), 'source.cjs');
    buildSync({ absWorkingDir: ROOT, stdin: { contents: `export { addOrUpdateEntry } from './ZoeW/src/features/scan-action';
export { resumePendingScanOperations } from './ZoeW/src/services/scan-operation';
export { createScanEvidenceJournal } from './ZoeW/src/services/scan-evidence';
export { pendingScanScope } from './ZoeW/src/services/scan-pending';
export { withTransactionOutcomeResolution, txResolvingPaths } from './ZoeW/src/services/tx-outcome';
export { firebaseState, dataState, uiState } from './ZoeW/src/core/state';`, resolveDir: ROOT },
        bundle: true, platform: 'node', format: 'cjs', outfile: built, logLevel: 'error', define: { 'import.meta.env': '{}' } });
    const api = require(built);
    globalThis.ZoeErrors = window.ZoeErrors = { capture: (error, context) => console.log('fixture captured', error?.message, context?.context) };
    let blockReads = false;
    globalThis.fetch = (url, init) => blockReads ? Promise.reject(new TypeError('fixture read lost')) : localRequest(String(url), init);
    for (const mode of wireMode ? ['new'] : ['new', 'merge']) for (const fault of wireMode ? ['month-evicted', 'month-pruned-recreated'] : ['before-stage', 'lost-stage-ack', 'prepared-lost-ack', 'final-lost-ack', 'final-before-send']) {
        const ns = 'demo-scan-sdk-' + process.pid + '-' + results.length;
        const endpoint = 'http://127.0.0.1:' + port + '/?ns=' + ns;
        const owner = async (location = '', method = 'GET', body) => {
            const response = await localRequest('http://127.0.0.1:' + port + '/' + location + '.json?ns=' + ns,
                { method, headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
            const text = await response.text(); assert.equal(response.status, 200, text); return JSON.parse(text);
        };
        await owner('.settings/rules', 'PUT', JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8')));
        const prior = { id: 'prior', phone: '012000111', scanDate: day, createdAt: stamp - 1000, count: 1, cod: 10, dod: 0, price: 10,
            isClosed: false, isCalled: false, barcode: 'OLD', time: '09:00:00', barcodes: [{ code: 'OLD', createdAt: stamp - 1000, cod: 10, dod: 0, isClosed: false }] };
        const tree = { [H]: { prior }, [D]: { [day]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
            [M]: { [month]: { codDollar: 10, dodDollar: 0, totalCount: 1 } }, [R]: { OLD: true } };
        await owner('', 'PUT', tree);
        localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: endpoint }));
        api.txResolvingPaths.clear(); blockReads = false;
        api.dataState.scanHistory = [copy(prior)]; api.dataState.deletedItems = [];
        api.dataState.dailyRevenueData = copy(tree[D]); api.dataState.monthlyRevenueData = copy(tree[M]);
        api.dataState.dailyPickupData = {}; api.dataState.dailyCollectedData = {};
        api.uiState.toasts = [];
        let stageReached;
        const stage = new Promise(resolve => { stageReached = resolve; });
        let armed = true;
        if (wireMode) wireMonthGate = { namespace: ns, held: false, requests: 0, resolve: signal => { armed = false; stageReached(signal); } };
        const device = () => {
            const app = initializeApp({ projectId: 'demo-scan-sdk', databaseURL: endpoint }, ns + '-' + apps.length);
            apps.push(app); const db = database.getDatabase(app);
            database.connectDatabaseEmulator(db, '127.0.0.1', port, { mockUserToken: { sub: uid, user_id: uid } });
            const token = createMockUserToken({ sub: uid, user_id: uid }, 'demo-scan-sdk');
            const auth = { app, currentUser: { uid, getIdToken: async () => token } };
            const raw = { ...database, getAuth: () => auth, getDatabase: () => db, deleteApp,
                update: async (ref, patch) => {
                    if (armed && ['final-lost-ack', 'final-before-send'].includes(fault) && Object.entries(patch).some(([path, value]) => path.startsWith('zoew_scan_operations/') && value?.phase === 'committed')) {
                        if (fault === 'final-lost-ack') await database.update(ref, patch); armed = false; blockReads = true; stageReached();
                        throw new Error('fixture final ACK unavailable');
                    }
                    return database.update(ref, patch);
                },
                runTransaction: async (ref, update, options) => {
                    if (!negativeControlsDone && String(ref).includes('/zoew_scan_operations/')) {
                        const candidate = update(null);
                        if (candidate?.phase === 'prepared') {
                            negativeControlsDone = true;
                            const initial = await owner();
                            for (const kind of ['absent', 'foreign', 'cancelled', 'committed', 'changed-code']) {
                                const mutated = copy(initial);
                                const operation = mutated.zoew_scan_operations[candidate.id];
                                if (kind === 'absent') delete mutated.zoew_scan_operations[candidate.id];
                                else if (kind === 'foreign') operation.actorUid = 'foreign-owner';
                                else if (kind === 'changed-code') operation.code = 'OTHER';
                                else mutated.zoew_scan_operations[candidate.id] = { ...candidate, phase: kind };
                                await owner('', 'PUT', mutated);
                                const expected = await owner();
                                const negativeApp = initializeApp({ projectId: 'demo-scan-sdk', databaseURL: endpoint }, ns + '-negative-' + kind);
                                apps.push(negativeApp); const negativeDb = database.getDatabase(negativeApp);
                                database.connectDatabaseEmulator(negativeDb, '127.0.0.1', port, { mockUserToken: { sub: uid, user_id: uid } });
                                let denied = false;
                                try {
                                    const result = await database.runTransaction(database.ref(negativeDb, 'zoew_scan_operations/' + candidate.id), update, options);
                                    denied = result.committed === false;
                                } catch (error) { assert.match(String(error.code || error.message), /permission_denied/i); denied = true; }
                                assert.equal(denied, true, 'prepared cold candidate មិនអាចឆ្លង ' + kind);
                                assert.deepEqual(await owner(), expected, 'negative ត្រូវគ្មានការផ្លាស់ប្ដូរ ' + kind);
                                negativeResults.push(kind); await deleteApp(negativeApp);
                            }
                            await owner('', 'PUT', initial);
                        }
                    }
                    if (armed && fault === 'prepared-lost-ack' && String(ref).includes('/zoew_scan_operations/')) {
                        await database.runTransaction(ref, update, options); armed = false; blockReads = true; stageReached();
                        throw Object.assign(new Error('fixture prepared ACK unavailable'), { txOutcome: 'unknown' });
                    }
                    if (armed && ['before-stage', 'lost-stage-ack'].includes(fault) && String(ref).includes('/' + H + '/')) {
                        armed = false;
                        if (fault === 'lost-stage-ack') await database.runTransaction(ref, update, options);
                        blockReads = true; stageReached();
                        throw Object.assign(new Error('fixture stage ACK unavailable'), { txOutcome: 'unknown' });
                    }
                    return database.runTransaction(ref, update, options);
                } };
            const sdk = api.withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
            Object.assign(api.firebaseState, { fb: sdk, db, auth, firebaseConfig: app.options, isDatabaseInitialized: true,
                isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
            return { app, db, sdk };
        };
        const first = device();
        await bounded(database.get(database.ref(first.db, H)), 'initial SDK read');
        const saving = api.addOrUpdateEntry('NEWSCAN', mode === 'merge' ? prior.phone : 'គ្មានលេខ', 5, 0, 'A1', stamp);
        saving.then(value => console.log('fixture save status', mode, fault, value), error => console.log('fixture save error', error?.message));
        let boundary;
        try { boundary = await bounded(Promise.race([stage, saving.then(() => { assert.equal(armed, false, 'actual SDK cold cache ត្រូវទៅដល់ stage; កុំ abort prepared ពី speculative null'); })]), mode + ':' + fault); }
        catch (error) {
            console.log('fixture unresolved', JSON.stringify({ server: await owner(), evidence: api.createScanEvidenceJournal(localStorage, 2).list(api.pendingScanScope()),
                connectionWrites: Object.keys(localStorage).filter(key => key.startsWith('zoew_connection_writes_v1:')).map(key => JSON.parse(localStorage.getItem(key))) }));
            throw error;
        }
        assert.equal(api.createScanEvidenceJournal(localStorage, 2).list(api.pendingScanScope()).length, 1);
        if (wireMode) {
            const operation = Object.values(await owner('zoew_scan_operations'))[0];
            const committedMonth = await owner(M + '/' + month);
            assert.ok(committedMonth.ops?.[operation.monthToken], 'server បាន commit witness មុនទប់ ACK');
            const replacement = { codDollar: 10, dodDollar: 0, totalCount: 1 };
            if (fault === 'month-evicted') {
                replacement.ops = Object.fromEntries(Array.from({ length: 12 }, (_, index) => ['op_x' + String(index).padStart(8, '0'), index + 1]));
                replacement.op = 'op_x00000011';
            } else await owner(M + '/' + month, 'DELETE');
            await owner(M + '/' + month, 'PUT', replacement);
            const committedRequestCount = wireMonthGate.requests;
            let reconnected = Promise.resolve(), stopConnection = () => {};
            if (wireRetry) {
                reconnected = new Promise(resolve => {
                    let disconnected = false;
                    stopConnection = database.onValue(database.ref(first.db, '.info/connected'), snapshot => {
                        if (snapshot.val() === false) disconnected = true;
                        else if (disconnected) resolve();
                    });
                });
                boundary.client.close();
            } else boundary.deliver();
            const originalOutcome = await bounded(saving, fault + ': original ACK');
            console.log('fixture monthly wire boundary', JSON.stringify({ fault, wireRetry, originalOutcome, requests: wireMonthGate.requests, server: await owner() }));
            assert.equal(originalOutcome, 'unknown');
            await bounded(reconnected, fault + ': SDK reconnect'); stopConnection();
            assert.equal(wireMonthGate.requests, committedRequestCount, 'SDK មិនអាចផ្ញើ monthly transaction ឡើងវិញក្រោយ commit');
            assert.deepEqual(await owner(M + '/' + month), replacement, 'original CAS មិនអាចបញ្ចូល witness វិញក្រោយបាត់');
            assert.equal(Object.values(await owner(H) || {}).some(row => Object.values(row.barcodes || {}).some(barcode => barcode.code === 'NEWSCAN')), false);
            await api.resumePendingScanOperations();
            const after = await owner();
            assert.equal(after.zoew_scan_operations[operation.id].phase, 'cancelled');
            assert.equal(after[R]?.NEWSCAN ?? null, null);
            assert.equal(after[D][day].codDollar, 10); assert.equal(after[D][day].totalCount, 1);
            assert.deepEqual(after[M][month], replacement);
            assert.equal(api.createScanEvidenceJournal(localStorage, 2).list(api.pendingScanScope()).length, 0);
            assert.equal(wireMonthGate.requests, committedRequestCount, 'recovery មិនអាចចាប់ផ្ដើម monthly transaction ចាស់ឡើងវិញ');
            results.push({ mode, fault, wireSuccessfulAckHeld: true, lostAckDisconnect: wireRetry, observedSdkReconnect: wireRetry, actualMonthlyRequests: wireMonthGate.requests, outcome: 'cancelled-without-money', witnessReadded: false });
            wireMonthGate = null; await first.sdk.deleteApp(first.app); api.firebaseState.authGeneration++;
            continue;
        }
        await first.sdk.deleteApp(first.app); api.firebaseState.authGeneration++; api.txResolvingPaths.clear();
        let agedRows = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key.startsWith('zoew_connection_writes_v1:')) continue;
            const row = JSON.parse(localStorage.getItem(key)); row.queuedAt = Date.now() - 3 * 86400000;
            localStorage.setItem(key, JSON.stringify(row)); agedRows++;
        }
        if (fault.startsWith('final-')) assert.ok(agedRows > 0, 'final transport journal ត្រូវបានរក្សា មុនរំលងអាយុ២ថ្ងៃ');
        blockReads = false; const second = device();
        await bounded(second.sdk.retryWriteRecovery(second.db), 'transport recovery');
        api.dataState.scanHistory = Object.values(await owner(H) || {});
        await bounded(api.resumePendingScanOperations(), 'business recovery');
        const after = await owner(); const committed = fault === 'lost-stage-ack' || fault === 'final-lost-ack';
        for (const [root, key] of [[D, day], [M, month]]) {
            assert.equal(after[root][key].codDollar, committed ? 15 : 10);
            assert.equal(after[root][key].totalCount, committed ? 2 : 1);
        }
        const held = fault === 'final-before-send';
        if (held) assert.equal(after[R]?.NEWSCAN?.v, 2);
        else if (committed) assert.deepEqual(after[R]?.NEWSCAN, { v: 2, intent: Object.values(after.zoew_scan_operations)[0].id, actorUid: uid, birth: stamp });
        else assert.equal(after[R]?.NEWSCAN ?? null, null);
        assert.equal(api.createScanEvidenceJournal(localStorage, 2).list(api.pendingScanScope()).length, held ? 1 : 0);
        const business = root => Object.fromEntries([H, D, M, R, 'zoew_scan_operations', 'zoew_scan_pending'].map(key => [key, root[key] ?? null]));
        await api.resumePendingScanOperations();
        assert.deepEqual(business(await owner()), business(after));
        assert.equal(Object.keys(localStorage).filter(key => key.startsWith('zoew_connection_writes_v1:')).length, held ? 1 : 0, 'transport journal ត្រូវបញ្ចប់តែភស្តុតាងពិត');
        results.push({ mode, fault, agedRows, money: after[D][day].codDollar, count: after[D][day].totalCount, pending: held ? 1 : 0, expectedHold: held });
        await second.sdk.deleteApp(second.app); api.firebaseState.authGeneration++;
    }
    assert.equal(results.length, wireMode ? 2 : 10); assert.equal(negativeResults.length, 5);
    console.log(JSON.stringify({ actualSdkAndRtdb: true, simulatedProcessDeathAndReadLoss: true, coldCacheNegativeControls: negativeResults, cases: results }, null, 2));
    for (const app of apps) if (getApps().includes(app)) await deleteApp(app);
    await window.happyDOM.close();
    console.log('scan SDK: ' + (results.length + negativeResults.length) + ' PASS, 0 FAIL');
})().catch(async error => { failed++; console.error(error.stack || error); for (const app of apps) await deleteApp(app).catch(() => {}); })
    .finally(() => process.exit(failed ? 1 : 0));
