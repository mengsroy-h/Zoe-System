'use strict';
process.exitCode = 1;
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { createHash, webcrypto, randomBytes } = require('crypto');
const { pathToFileURL } = require('url');
const { isDeepStrictEqual } = require('util');
const ROOT = path.resolve(process.env.F03_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '../..'));
const REPO = path.resolve(process.env.ZOE_REPO_ROOT || ROOT);
const STRICT = process.env.CRUD_FLOW_STRICT === '1' || process.env.RUNALL_STRICT === '1';
const FIXTURES_ONLY = process.argv.includes('--fixtures-only');
const LIMIT = 4194304, WAIT_MS = 15000;
const T = 'zoew_recently_deleted_cod_dod', R = 'zoew_barcode_registry', P = 'zoew_registry_releases';
const G = 'zoew_trash_consumptions', W = 'zoew_write_receipts', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-10-01', MONTH = '2026-10';
const SUPABASE_FIXTURE_USERNAME = 'f03_checker';
const SUPABASE_FIXTURE_EMAIL = SUPABASE_FIXTURE_USERNAME + '@users.zoew.invalid';
const SOURCE_FILES = ['ZoeW/src/domain/registry-purge-proof.ts', 'ZoeW/src/services/registry-purge.ts',
    'ZoeW/src/services/native-write-recovery.ts', 'ZoeW/src/services/supabase-rtdb.ts', 'ZoeW/src/services/supabase-sdk.ts',
    'ZoeW/src/services/supabase-transport.ts', 'ZoeW/src/services/connection-flow.ts', 'ZoeW/src/services/write-journal.ts',
    'ZoeW/src/services/tx-outcome.ts', 'firebase-database.rules.json'];
const clone = value => JSON.parse(JSON.stringify(value));
const digest = value => createHash('sha256').update(value).digest('hex');
const equal = (left, right) => isDeepStrictEqual(left, right);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const sourceHashes = {}, results = [], activeChecks = [];
let pass = 0, fail = 0, activeCase = null, engineStarted = false, bundleHash = null, nativeResources = null;
function ok(label, cond, detail) {
    const entry = { label, pass: !!cond, ...(activeCase ? { caseId: activeCase.id, provider: activeCase.provider } : {}) };
    activeChecks.push(entry);
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.error('  FAIL  ' + label + (detail === undefined ? '' : '\n        ' + JSON.stringify(detail).slice(0, 1600))); }
    return !!cond;
}
function requireCheck(label, condition, detail) {
    if (!ok(label, condition, detail)) throw new Error('Assertion failed: ' + label);
}
async function bounded(promise, label, ms = WAIT_MS) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out: ' + label)), ms); })]); }
    finally { clearTimeout(timer); }
}
async function until(test, label) {
    const started = Date.now();
    for (;;) { if (await test()) return; if (Date.now() - started > WAIT_MS) throw new Error('Timed out: ' + label); await pause(10); }
}
const UNICODE_CODES = [' ﻿straße😀/é﻿ ', 'iıİß.%$[]/'];
const FIXED_KEYS = new Map([[UNICODE_CODES[0], 'STRASSE😀%2FÉ'], [UNICODE_CODES[1], 'IIİSS%2E%25%24%5B%5D%2F'], ['ß', 'SS'], ['SS', 'SS']]);
function expectedKey(code) {
    if (FIXED_KEYS.has(code)) return FIXED_KEYS.get(code);
    if (/^[A-Z0-9_]+$/.test(code)) return code;
    throw new Error('Missing independent fixed key oracle for fixture code');
}
function source(count, id, scenario = {}) {
    const createdAt = 1700000000000, deletedAt = 1790000000000;
    return { id, phone: '012345678', cod: count, dod: 0, price: count, count, isClosed: false, createdAt,
        scanDate: DAY, time: '09:00:00 (' + DAY + ')', barcodes: Object.fromEntries(Array.from({ length: count }, (_, index) =>
            [String(index), { code: scenario.collision ? ['ß', 'SS'][index] : scenario.unicodeOracle ? UNICODE_CODES[index] : 'F03_' + id.toUpperCase() + '_' + index, cod: 1, dod: 0, isClosed: false, createdAt: createdAt + index }])),
        deletedAt, trashGeneration: 1 };
}
function image(row) {
    return { [T]: { [row.id]: clone(row) }, [R]: Object.fromEntries(Object.values(row.barcodes).map(barcode => [expectedKey(barcode.code), true])),
        [D]: { [DAY]: { codDollar: 37, dodDollar: 5, totalCount: 11 } },
        [M]: { [MONTH]: { codDollar: 37, dodDollar: 5, totalCount: 11 } } };
}
function packet(row, context) {
    const receipts = Object.entries(row.barcodes).map(([slot, barcode]) => ({ v: 2, generation: row.trashGeneration,
        id: 'release_' + digest(row.id + ':' + slot).slice(0, 32), kind: 'legacy', actorUid: context.uid, releasedBy: context.uid,
        scope: context.scope, code: barcode.code, registryKey: expectedKey(barcode.code), birth: barcode.createdAt, trashId: row.id, slot,
        deletedAt: row.deletedAt, rowBirth: row.createdAt, rowCount: row.count }));
    const consumption = { v: 1, sourceId: row.id, generation: row.trashGeneration, kind: 'purge', actorUid: context.uid,
        scope: context.scope, deletedAt: row.deletedAt, rowBirth: row.createdAt };
    return [{ k: 'set', p: [T, row.id], v: null }, { k: 'set', p: [G, row.id], v: consumption },
        ...receipts.flatMap(receipt => [{ k: 'set', p: [R, receipt.registryKey], v: null }, { k: 'set', p: [P, receipt.id], v: receipt }])];
}
const updateOf = ops => Object.fromEntries(ops.map(op => [op.p.join('/'), clone(op.v)]));
const moneyOf = value => ({ [D]: value?.[D] || null, [M]: value?.[M] || null });
const rowsOf = value => Object.fromEntries(Object.entries(value || {}).filter(([, child]) => child !== null && child !== undefined));
const projected = value => Object.fromEntries([T, R, P, G, D, M].map(root => [root, rowsOf(value?.[root])]));
const FAMILY = {
    positive: ['applied', 'one-commit', 'full-journal-before-dispatch', 'all-original-effects', 'all-receipt-members', 'money-unchanged'],
    backend: ['backend-attempt-reached', 'backend-refused', 'zero-effects', 'money-unchanged'],
    barrier: ['preflight-gate-reached', 'controller-committed', 'refused', 'intervening-state-preserved', 'money-unchanged'],
    lost: ['commit-before-loss', 'one-commit', 'same-original-intent', 'proof-completed', 'money-unchanged'],
    unknown: ['commit-before-loss', 'proof-fault-reached', 'full-journal-hold', 'no-reexecute', 'proof-completed', 'money-unchanged'],
    storage: ['storage-fault-reached', 'zero-dispatch', 'zero-effects', 'money-unchanged'],
    postgc: ['real-lost-ack-journal', 'original-op-gone', 'proof-result', 'same-original-intent', 'zero-replay', 'new-incarnation-preserved', 'money-unchanged'],
    bytes: ['otherwise-complete-packet', 'over-byte-envelope', 'zero-dispatch', 'zero-effects', 'money-unchanged']
};
const CASES = [
    ...[1, 2, 249, 250, 251].map(count => ({ id: 'positive-' + count, count, family: 'positive', unicodeOracle: count === 2 })),
    ...['wrong-key', 'missing-pair', 'count-mirror'].map(fault => ({ id: 'backend-' + fault, count: 2, family: 'backend', fault, unicodeOracle: fault === 'wrong-key' })),
    { id: 'backend-canonical-collision', count: 2, family: 'backend', fault: 'collision', collision: true },
    ...['source', 'restore', 'holder'].map(fault => ({ id: 'barrier-' + fault, count: 2, family: 'barrier', fault })),
    { id: 'lost-ack', count: 250, family: 'lost' },
    { id: 'read-unknown', count: 250, family: 'unknown' },
    ...['unavailable', 'quota'].map(fault => ({ id: 'storage-' + fault, count: 250, family: 'storage', fault })),
    ...['full', 'partial', 'absent'].map(fault => ({ id: 'postgc-' + fault, count: 250, family: 'postgc', fault })),
    { id: 'byte-oversize', count: 230, family: 'bytes' }
];
const EXPECTED = CASES.flatMap(scenario => ['native', 'supabase'].map(provider =>
    ({ id: scenario.id, provider, assertions: FAMILY[scenario.family] })));
const manifestHash = digest(JSON.stringify(EXPECTED));
function verifyConstruction() {
    requireCheck('case manifest nonempty, unique, both providers and exact assertion IDs', CASES.length === 20 && EXPECTED.length === 40
        && new Set(EXPECTED.map(entry => entry.provider + ':' + entry.id)).size === 40
        && EXPECTED.every(entry => entry.assertions.length > 0 && new Set(entry.assertions).size === entry.assertions.length));
    for (const count of [1, 2, 249, 250, 251]) {
        const row = source(count, 'matched_' + count, CASES.find(item => item.id === 'positive-' + count)), seed = image(row), ops = packet(row, { uid: 'fixture-user', scope: 'fixture-scope' });
        requireCheck('fixture N=' + count + ' complete 2+2N and nonempty matching money', ops.length === 2 + 2 * count
            && Object.keys(row.barcodes).length === count && seed[D][DAY].codDollar === 37 && seed[M][MONTH].totalCount === 11);
    }
    requireCheck('fixed independent Unicode trim/reserved-key oracles', expectedKey(UNICODE_CODES[0]) === 'STRASSE😀%2FÉ'
        && expectedKey(UNICODE_CODES[1]) === 'IIİSS%2E%25%24%5B%5D%2F' && expectedKey('ß') === expectedKey('SS'));
    requireCheck('case assertion manifest exact and nonempty', EXPECTED.reduce((sum, entry) => sum + entry.assertions.length, 0) === 212);
    const objectSeed = image(source(2, 'matched_2', { unicodeOracle: true })), arraySeed = clone(objectSeed);
    arraySeed[T].matched_2.barcodes = Object.values(arraySeed[T].matched_2.barcodes);
    requireCheck('comparison maps only known numeric barcode container, preserving original Unicode values',
        equal(logicalForComparison(projected(objectSeed)), logicalForComparison(projected(arraySeed)))
        && objectSeed[T].matched_2.barcodes['0'].code === UNICODE_CODES[0]);
}
function report(status, extra = {}) {
    const summary = { status, pass, fail, engineStarted, cases: results, checks: activeChecks, expected: EXPECTED,
        manifestHash, expectedBehaviorAssertions: EXPECTED.reduce((sum, entry) => sum + entry.assertions.length, 0), sourceHashes, bundleHash, nativeResources, driverHash: digest(fs.readFileSync(__filename)), ...extra };
    const destination = process.env.F03_PARITY_RESULT;
    if (destination) fs.writeFileSync(path.resolve(destination), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary));
    return summary;
}
function memoryStorage() {
    const data = new Map();
    return { get length() { return data.size; }, key: index => [...data.keys()][index] ?? null,
        getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, String(value)),
        removeItem: key => data.delete(key), clear: () => data.clear() };
}
function parseOrigin(raw, manual) {
    if (!raw) throw new Error(manual ? 'Explicit owned emulator origin required for manual run' : 'Emulator origin unavailable');
    const origin = new URL(raw);
    if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.pathname !== '/' || origin.search || origin.hash
        || origin.username || origin.password || !Number.isInteger(Number(origin.port)) || !(Number(origin.port) > 0)) throw new Error('Only owned explicit 127.0.0.1 HTTP origin allowed');
    return origin;
}
const encodePath = node => String(node).split('/').filter(Boolean).map(encodeURIComponent).join('/');
const allowedOrigins = new Set();
function request(url, init = {}) {
    const target = new URL(url);
    if (!allowedOrigins.has(target.origin) || target.hostname !== '127.0.0.1' || target.protocol !== 'http:') return Promise.reject(new Error('Request escaped owned loopback'));
    return new Promise((resolve, reject) => {
        let finished = false, timer;
        const finish = (error, value) => {
            if (finished) return; finished = true; clearTimeout(timer);
            if (error) reject(error); else resolve(value);
        };
        const req = http.request(target, { method: init.method || 'GET', headers: init.headers || {}, timeout: WAIT_MS }, response => {
            let body = ''; response.on('data', part => { body += part; });
            response.on('error', error => finish(error));
            response.on('aborted', () => finish(new Error('Owned loopback response aborted')));
            response.on('end', () => {
                try { finish(null, new Response(body || null, { status: response.statusCode, headers: response.headers })); }
                catch (error) { finish(error); }
            });
        });
        timer = setTimeout(() => { const error = new Error('Loopback request timed out'); finish(error); req.destroy(error); }, WAIT_MS);
        req.on('error', error => finish(error)); req.on('timeout', () => { const error = new Error('Loopback request timed out'); finish(error); req.destroy(error); });
        if (init.body !== undefined) req.write(init.body); req.end();
    });
}
function journalRows() {
    const out = [];
    const storage = window.localStorage;
    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (!key?.startsWith('zoew_connection_writes_v1:')) continue;
        const text = storage.getItem(key);
        try { out.push({ key, row: JSON.parse(text) }); } catch (error) { throw new Error('Malformed retained journal in fixture'); }
    }
    return out;
}
function originalJournal(sourceId) {
    return journalRows().find(entry => entry.row.ops?.some(op => op.p?.[0] === T && op.p[1] === sourceId));
}
function intentIdentity(entry) {
    return entry && { key: entry.key, opId: entry.row.opId, ops: entry.row.ops, hash: entry.row.hash ?? null, purgeHash: entry.row.purgeHash ?? null,
        scope: entry.row.scope, topic: entry.row.topic, writeProtocol: entry.row.writeProtocol ?? null };
}
function installStorageFault(kind, counters) {
    const oldWindow = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const oldGlobal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const real = window.localStorage;
    const forwarded = { get length() { return real.length; }, key: index => real.key(index), getItem: key => real.getItem(key),
        removeItem: key => real.removeItem(key), clear: () => real.clear(), setItem: (key, value) => {
            if (String(key).startsWith('zoew_connection_writes_v1:')) { counters.storageFailures++; throw new DOMException('Synthetic quota', 'QuotaExceededError'); }
            return real.setItem(key, value);
        } };
    const getter = () => { if (kind === 'unavailable') { counters.storageFailures++; throw new Error('Synthetic storage unavailable'); } return forwarded; };
    Object.defineProperty(window, 'localStorage', { configurable: true, get: getter });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: getter });
    return () => {
        if (oldWindow) Object.defineProperty(window, 'localStorage', oldWindow); else delete window.localStorage;
        if (oldGlobal) Object.defineProperty(globalThis, 'localStorage', oldGlobal); else delete globalThis.localStorage;
    };
}
async function bootstrap(base) {
    const deps = path.join(REPO, 'ZoeW/node_modules');
    const { Window } = await import(pathToFileURL(path.join(deps, 'happy-dom/lib/index.js')).href);
    const dom = new Window({ url: 'https://f03-parity-fixture.invalid' });
    for (const name of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'HTMLElement', 'HTMLInputElement',
        'HTMLVideoElement', 'HTMLCanvasElement', 'HTMLImageElement', 'HTMLTextAreaElement', 'MutationObserver', 'CustomEvent',
        'FileReader', 'Image', 'Node', 'Element', 'Event', 'DOMException']) {
        Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === 'window' ? dom : dom[name] });
    }
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    globalThis.requestAnimationFrame = dom.requestAnimationFrame.bind(dom);
    globalThis.cancelAnimationFrame = dom.cancelAnimationFrame.bind(dom);
    globalThis.confirm = () => true;
    const websocket = require(require.resolve('faye-websocket', { paths: [deps] })), OriginalClient = websocket.Client;
    websocket.Client = function (url, protocols, options) {
        const target = new URL(url), copy = { ...options };
        if (target.protocol === 'ws:' && target.hostname === '127.0.0.1' && target.port === base.port) delete copy.proxy;
        return new OriginalClient(url, protocols, copy);
    };
    const { buildSync } = require(path.join(deps, 'esbuild'));
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-f03-parity-'));
    const built = path.join(scratch, 'actual-source.cjs');
    const exports = [
        "export { purgeTrashWithRegistry } from './ZoeW/src/services/registry-purge';",
        "export { withTransactionOutcomeResolution } from './ZoeW/src/services/tx-outcome';",
        "export { nativeWriteRecoveryState } from './ZoeW/src/services/native-write-recovery';",
        "export { createSupabaseSdk } from './ZoeW/src/services/supabase-sdk';",
        "export { createSupabaseTransport } from './ZoeW/src/services/supabase-transport';",
        "export { SB_OPS_PER_WRITE } from './ZoeW/src/services/supabase-rtdb';",
        "export { boundedRegistryPurgeIntent, registryPurgeIntent, registryPurgeBindingHash, registryPurgeReceiptMatches } from './ZoeW/src/domain/registry-purge-proof';",
        "export { liveShopScope } from './ZoeW/src/core/shop-scope';",
        "export { firebaseState, dataState } from './ZoeW/src/core/state';"
    ].join('\n');
    buildSync({ absWorkingDir: ROOT, stdin: { contents: exports, resolveDir: ROOT }, bundle: true, platform: 'node', format: 'cjs',
        outfile: built, logLevel: 'error', define: { 'import.meta.env': '{}' } });
    const api = require(built);
    bundleHash = digest(fs.readFileSync(built));
    requireCheck('generic Supabase limit remains exactly500', api.SB_OPS_PER_WRITE === 500);
    const firebaseApp = require(path.join(deps, 'firebase/app'));
    const database = require(path.join(deps, 'firebase/database'));
    const { createMockUserToken } = require(path.join(deps, '@firebase/util'));
    return { api, database, firebaseApp, createMockUserToken, scratch, restore: async () => { websocket.Client = OriginalClient; if (typeof dom.happyDOM?.abort === 'function') await dom.happyDOM.abort(); } };
}
function activate(api, client) {
    Object.assign(api.firebaseState, { db: client.db, fb: client.sdk, auth: client.auth, firebaseConfig: client.app.options,
        isInitializingFirebase: false, isDatabaseInitialized: true, firebaseSdkUnavailable: false, isDatabaseConnected: true,
        hasEverConnectedToDatabase: true, serverClockTrusted: true, serverTimeOffsetMs: 0, sessionExpiryCheck: 'live', authLoginOperation: null });
    Object.assign(api.dataState, { scanHistory: [], deletedItems: [], dailyRevenueData: {}, monthlyRevenueData: {},
        dailyPickupData: {}, dailyCollectedData: {} });
    window.localStorage.setItem('zoew_firebase_config', JSON.stringify(client.app.options));
}
function stats() {
    return { executeRequests: 0, commits: 0, backendAttempts: 0, dropped: 0, deniedReads: 0, storageFailures: 0, captures: [] };
}
function capture(statsValue, sourceId, args) {
    const entry = originalJournal(sourceId);
    if (!entry) throw new Error('Complete original journal missing before dispatch');
    statsValue.captures.push({ journal: clone(entry), args: clone(args) });
}
class NativeNamespace {
    constructor(base, transport = request) {
        const { emuNamespace } = require(path.join(REPO, 'audit-tools/emu/ns.js'));
        this.base = base; this.ns = emuNamespace('demo-f03-purge'); this.active = null; this.transport = transport;
        this.canonicalLoads = 0; this.cleanupRuleWrites = 0; this.beforeEmpty = 0; this.afterEmpty = 0;
        this.uncertain = false; this.closed = false; this.requests = new Set();
    }
    send(target, init) {
        const task = Promise.resolve().then(() => this.transport(target, init)); this.requests.add(task);
        const settled = () => this.requests.delete(task); task.then(settled, settled); return task;
    }
    async owner(node = '', method = 'GET', value) {
        const target = new URL(this.base.origin + '/' + encodePath(node) + '.json'); target.searchParams.set('ns', this.ns);
        if (!/^demo-f03-purge-[a-z0-9-]+$/.test(this.ns) || target.searchParams.get('ns') !== this.ns) throw new Error('Unowned namespace');
        try {
            const response = await this.send(target, { method, headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' },
                ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
            const text = await response.text();
            if (!response.ok) throw new Error('Owned native fixture HTTP ' + response.status);
            return text ? JSON.parse(text) : null;
        } catch (error) { if (method !== 'GET') this.uncertain = true; throw error; }
    }
    async rules(body, cleanup) {
        const target = new URL(this.base.origin + '/.settings/rules.json'); target.searchParams.set('ns', this.ns);
        try {
            const response = await this.send(target, { method: 'PUT', headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, body });
            if (response.status !== 200) throw new Error('Owned native fixture rules failed to load');
            if (cleanup) this.cleanupRuleWrites++; else this.canonicalLoads++;
        } catch (error) { this.uncertain = true; throw error; }
    }
    async start() {
        if (this.canonicalLoads || this.closed) throw new Error('Native namespace already initialized');
        await this.rules(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8'), false);
    }
    async acquire(provider) {
        if (this.active || this.closed || this.uncertain || this.canonicalLoads !== 1) throw new Error('Native namespace is not available');
        this.active = provider;
        if (await this.owner() !== null) { this.uncertain = true; throw new Error('Native namespace was not empty before seed'); }
        this.beforeEmpty++;
    }
    async release(provider) {
        if (this.active !== provider || this.uncertain || this.requests.size || provider.tasks.size || provider.startedTasks !== provider.settledTasks
            || provider.client || provider.pendingApp) throw new Error('Native namespace release without quiescence');
        await this.owner('', 'DELETE');
        if (await this.owner() !== null) { this.uncertain = true; throw new Error('Native namespace was not empty after cleanup'); }
        if (this.uncertain) throw new Error('Native namespace became uncertain during cleanup');
        this.afterEmpty++; this.active = null;
    }
    async close() {
        if (this.active || this.uncertain || this.requests.size) throw new Error('Native namespace cleanup incomplete; original work not quiescent');
        if (!this.canonicalLoads) return;
        await this.rules(JSON.stringify({ rules: { '.read': false, '.write': false } }), true);
        await this.owner('', 'DELETE');
        if (await this.owner() !== null) throw new Error('Native namespace final cleanup not empty');
        if (this.uncertain) throw new Error('Native namespace became uncertain during final cleanup');
        this.closed = true;
    }
    resourceReport() {
        return { namespace: this.ns, canonicalLoads: this.canonicalLoads, cleanupRuleWrites: this.cleanupRuleWrites,
            beforeEmpty: this.beforeEmpty, afterEmpty: this.afterEmpty, active: !!this.active, uncertain: this.uncertain,
            pendingRequests: this.requests.size, closed: this.closed };
    }
}
class NativeProvider {
    constructor(runtime, namespace, scenario, row) {
        this.kind = 'native'; this.runtime = runtime; this.namespace = namespace; this.base = namespace.base; this.row = row; this.scenario = scenario;
        this.uid = 'f03-native-owner'; this.stats = stats(); this.faults = {}; this.client = null; this.serial = 0;
        this.ns = namespace.ns; this.endpoint = this.base.origin + '/?ns=' + this.ns;
        this.tasks = new Set(); this.taskLabels = new Map(); this.startedTasks = 0; this.settledTasks = 0; this.closing = false; this.clientEpoch = 0;
        for (const name of ['setup', 'owner', 'guardFetch', 'open', 'purge', 'retry', 'patch', 'rawBackend']) {
            const original = this[name].bind(this);
            this[name] = (...args) => this.track(name, () => original(...args));
        }
    }
    assertOpen(epoch) {
        if (this.closing || epoch !== undefined && epoch !== this.clientEpoch) throw new Error('Native fixture dispatch after client close');
    }
    track(label, run) {
        const task = Promise.resolve().then(() => { this.assertOpen(); return run(); });
        this.startedTasks++; this.tasks.add(task); this.taskLabels.set(task, label);
        const settled = () => { this.tasks.delete(task); this.taskLabels.delete(task); this.settledTasks++; };
        task.then(settled, settled);
        return task;
    }
    async sdkWrite(ref, updates, epoch) {
        this.assertOpen(epoch);
        try { return await this.runtime.database.update(ref, updates); }
        catch (error) {
            if (error?.code !== 'PERMISSION_DENIED') this.namespace.uncertain = true;
            throw error;
        }
    }
    async quiesce() {
        const deadline = Date.now() + WAIT_MS;
        while (this.tasks.size) {
            const remaining = deadline - Date.now();
            if (remaining <= 0) throw new Error('Native fixture original tasks did not quiesce');
            await bounded(Promise.allSettled([...this.tasks]), 'native original task quiescence', remaining);
        }
    }
    resourceReport() {
        return { started: this.startedTasks, settled: this.settledTasks, pending: this.tasks.size,
            pendingKinds: [...this.taskLabels.values()],
            closing: this.closing, activeApp: !!this.client, pendingApp: !!this.pendingApp, ...this.namespace.resourceReport() };
    }
    async owner(node = '', method = 'GET', value) {
        if (this.namespace.active !== this) throw new Error('Native fixture does not own namespace');
        return this.namespace.owner(node, method, value);
    }
    async setup(seed) {
        await this.namespace.acquire(this); this.assertOpen();
        await this.owner('', 'PUT', seed); this.assertOpen(); await this.open();
    }
    guardFetch(url, init, epoch = this.clientEpoch) {
        this.assertOpen(epoch);
        if (String(init?.method || 'GET').toUpperCase() !== 'GET' || init?.body !== undefined) return Promise.reject(new Error('Native proof fetch must be read-only'));
        const target = new URL(String(url));
        if (target.origin !== this.base.origin || target.searchParams.get('ns') !== this.ns) return Promise.reject(new Error('Native proof read escaped namespace'));
        if (this.faults.denyProof && [P, W].some(root => target.pathname.startsWith('/' + root + '/'))) {
            this.stats.deniedReads++; return Promise.resolve(new Response(JSON.stringify({ error: 'synthetic proof READ unavailable' }), { status: 403 }));
        }
        return request(target, init);
    }
    async open() {
        const { api, database, firebaseApp, createMockUserToken } = this.runtime;
        this.assertOpen(); const epoch = ++this.clientEpoch;
        globalThis.fetch = (url, init) => this.guardFetch(url, init, epoch);
        const app = firebaseApp.initializeApp({ projectId: 'demo-f03-purge', databaseURL: this.endpoint }, this.ns + '-' + (++this.serial));
        this.pendingApp = { app, close: () => firebaseApp.deleteApp(app) };
        const db = database.getDatabase(app);
        database.connectDatabaseEmulator(db, '127.0.0.1', Number(this.base.port), { mockUserToken: { sub: this.uid, user_id: this.uid } });
        const token = createMockUserToken({ sub: this.uid, user_id: this.uid }, 'demo-f03-purge');
        const auth = { app, currentUser: { uid: this.uid, getIdToken: async () => token } };
        const raw = { ...database, getAuth: () => auth, getDatabase: () => db, deleteApp: firebaseApp.deleteApp,
            update: (ref, updates) => this.track('sdk-update', async () => {
                this.assertOpen(epoch);
                const isPurge = Object.keys(updates).some(key => key.startsWith(P + '/'));
                if (isPurge) {
                    this.stats.executeRequests++; capture(this.stats, this.row.id, updates);
                    const target = new URL(String(ref));
                    if (target.hostname !== '127.0.0.1' || Number(target.port) !== Number(this.base.port)) throw new Error('Native SDK escaped owned origin');
                    this.stats.lastWireBytes = Buffer.byteLength(JSON.stringify(updates), 'utf8');
                    if (this.beforePurge) { const action = this.beforePurge; this.beforePurge = null; await action(); }
                }
                this.assertOpen(epoch);
                const out = await this.track('database-update', () => this.sdkWrite(ref, updates, epoch));
                if (isPurge) {
                    this.stats.commits++;
                    if (this.faults.drop) {
                        this.faults.drop = false; this.stats.dropped++;
                        this.faults.denyProof = !!this.faults.denyAfterDrop;
                        throw new Error('Synthetic lost ACK after canonical native commit');
                    }
                }
                return out;
            }) };
        const sdk = api.withTransactionOutcomeResolution(raw);
        sdk.getAuth(app); sdk.getDatabase(app);
        this.assertOpen(epoch); this.client = { app, db, auth, sdk }; this.pendingApp = null; activate(api, this.client);
        this.scope = api.liveShopScope();
        return this.client;
    }
    async closeClient() {
        this.clientEpoch++;
        if (this.client) { const client = this.client; await client.sdk.deleteApp(client.app); this.client = null; }
        if (this.pendingApp) { await this.pendingApp.close(); this.pendingApp = null; }
        await this.quiesce();
    }
    async close() { this.closing = true; await this.closeClient(); await this.namespace.release(this); }
    async purge() { return this.runtime.api.purgeTrashWithRegistry(clone(this.row)); }
    async retry() { return this.client.sdk.retryWriteRecovery(this.client.db); }
    recovery() { return this.runtime.api.nativeWriteRecoveryState(this.client.db); }
    async settle() { await until(() => !this.recovery().recovering && !this.recovery().deferred, 'native recovery completion'); }
    async snapshot() { const physical = await this.owner() || {}; return { physical, logical: projected(physical) }; }
    async patch(node, value) { await this.owner(node, value === null ? 'DELETE' : 'PUT', ...(value === null ? [] : [value])); }
    async rawBackend(ops) {
        this.stats.backendAttempts++;
        const epoch = this.clientEpoch;
        return this.track('database-raw-update', () => this.sdkWrite(this.runtime.database.ref(this.client.db), updateOf(ops), epoch));
    }
    async removeOperationReceipt(entry) { await this.patch(W + '/' + entry.row.opId, null); }
    async operationGone(entry) { return await this.owner(W + '/' + entry.row.opId) === null; }
}
async function makeSqlHarness() {
    const { createPgHarness } = require(path.join(REPO, 'audit-tools/supabase-pg.js'));
    const config = fs.readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8');
    const H = createPgHarness({ depsDirs: [process.env.SUPABASE_DEPS_DIR, path.join(REPO, 'supabase/node_modules')].filter(Boolean),
        shimDir: path.join(REPO, 'audit-tools/supabase-shim'), wantMajor: Number((config.match(/^major_version\s*=\s*(\d+)/m) || [])[1]) });
    if (H.unavailableReason()) throw new Error(H.unavailableReason());
    let c, pool, fake;
    const shutdown = async () => {
        const errors = [];
        for (const close of [() => fake?.close(), () => pool?.end(), () => c?.end(), () => H.stop()]) {
            try { await close(); } catch (error) { errors.push(String(error?.message || error)); }
        }
        if (errors.length) throw new Error('Owned PG cleanup failed: ' + errors.join('; '));
    };
    try {
    await H.start(); const database = await H.freshDb('no-default-grants'); c = database.c; const name = database.name;
    for (const file of fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter(file => /^\d{14}_[a-z0-9_]+\.sql$/.test(file)).sort()) {
        await c.query(fs.readFileSync(path.join(ROOT, 'supabase/migrations', file), 'utf8'));
    }
    const uid = await H.makeAuthUser(c, SUPABASE_FIXTURE_EMAIL);
    pool = new H.PG.Pool({ host: '127.0.0.1', port: c.connectionParameters.port, user: 'postgres', database: name, max: 4 });
    const { startFakeSupabase } = require(path.join(REPO, 'audit-tools/supabase-fake-server.js'));
    fake = await startFakeSupabase({ pool });
    fake.addUser(SUPABASE_FIXTURE_EMAIL, 'f03-synthetic-password', uid);
    allowedOrigins.add(fake.url);
    let active = null;
    fake.setRpcHook(async event => active ? active.hook(event) : undefined);
    return { H, c, fake, uid, pool, setActive: provider => { active = provider; }, close: shutdown };
    } catch (error) { try { await shutdown(); } catch (cleanup) { error.message += '; ' + cleanup.message; } throw error; }
}
class SupabaseProvider {
    constructor(runtime, harness, scenario, row) {
        this.kind = 'supabase'; this.runtime = runtime; this.harness = harness; this.scenario = scenario; this.row = row;
        this.uid = harness.uid; this.stats = stats(); this.faults = {}; this.client = null; this.rawMode = false;
    }
    async setup(seed) {
        const c = this.harness.c;
        this.tenant = (await c.query("insert into public.tenants(name,branch_code,expires_at) values($1,$2,now()+interval '30 days') returning id",
            ['F03 ' + this.scenario.id, 'f03_' + randomBytes(6).toString('hex')])).rows[0].id;
        await c.query("insert into public.tenant_members(user_id,tenant_id,username,role) values($1,$2,$3,'owner') on conflict(user_id) do update set tenant_id=excluded.tenant_id",
            [this.uid, this.tenant, SUPABASE_FIXTURE_USERNAME]);
        for (const [root, children] of Object.entries(seed)) for (const [key, value] of Object.entries(children)) {
            await c.query('insert into public.zoe_docs(tenant_id,root,key,value,seq) values($1,$2,$3,$4,1)', [this.tenant, root, key, value]);
        }
        this.harness.setActive(this); await this.open();
    }
    guardFetch(url, init) {
        const target = new URL(String(url));
        if (target.origin !== this.harness.fake.url) return Promise.reject(new Error('Supabase request escaped owned fake HTTP origin'));
        let body = null; try { body = init?.body ? JSON.parse(String(init.body)) : null; } catch (error) {}
        const proofRead = target.pathname.endsWith('/zoe_purge_status_v1')
            || target.pathname.endsWith('/zoe_read') && [P, W].includes(body?.p_root);
        if (this.faults.denyProof && proofRead) {
            this.stats.deniedReads++; return Promise.resolve(new Response(JSON.stringify({ code: '42501', message: 'synthetic proof READ unavailable' }), { status: 403 }));
        }
        return request(target, init);
    }
    async hook(event) {
        if (event.fn !== 'zoe_purge_execute_v1') return;
        if (event.phase === 'before') {
            if (this.rawMode) { this.stats.backendAttempts++; return; }
            this.stats.executeRequests++; capture(this.stats, this.row.id, event.body);
            if (this.beforePurge) { const action = this.beforePurge; this.beforePurge = null; await action(); }
        } else if (event.phase === 'after' && !this.rawMode) {
            const result = event.result?.[0]?.r;
            if (result?.ok === true && result.purge?.outcome === 'applied' && !result.replayed) this.stats.commits++;
            if (this.faults.drop && result?.ok === true) {
                this.faults.drop = false; this.stats.dropped++; this.faults.denyProof = !!this.faults.denyAfterDrop; return 'drop';
            }
        }
    }
    async open() {
        const api = this.runtime.api;
        const local = memoryStorage(), session = memoryStorage();
        const base = api.createSupabaseSdk(cfg => api.createSupabaseTransport(cfg, { localStorage: local, sessionStorage: session,
            fetch: (url, init) => this.guardFetch(url, init) }), {
            onListenerError: () => {}, onAccountBlocked: () => {}, onTxOutcomeUnknown: () => {}, onWriteRecovery: () => {},
            docsCache: null, registryPurge: { intent: api.boundedRegistryPurgeIntent, hash: api.registryPurgeBindingHash },
            dbOptions: { retryStepsMs: [50, 100], pollFallbackMs: 600000 }
        });
        const sdk = api.withTransactionOutcomeResolution(base);
        const app = sdk.initializeApp({ supabaseUrl: this.harness.fake.url, supabaseKey: 'sb_publishable_f03_synthetic', loginDomain: 'users.zoew.invalid' });
        this.pendingApp = { app, close: () => sdk.deleteApp(app) };
        const auth = sdk.getAuth(app), db = sdk.getDatabase(app);
        await bounded(sdk.signInWithEmailAndPassword(auth, SUPABASE_FIXTURE_USERNAME, 'f03-synthetic-password'), 'synthetic Supabase login');
        this.client = { sdk, app, auth, db }; this.pendingApp = null; activate(api, this.client);
        await until(() => db.isReady() && sdk.tenantScope(auth) === this.tenant, 'Supabase original tenant ready');
        this.scope = api.liveShopScope();
        return this.client;
    }
    async closeClient() {
        if (this.client) { const client = this.client; await client.sdk.deleteApp(client.app); this.client = null; }
        if (this.pendingApp) { await this.pendingApp.close(); this.pendingApp = null; }
    }
    async close() { await this.closeClient(); }
    async purge() { return this.runtime.api.purgeTrashWithRegistry(clone(this.row)); }
    async retry() { return this.client.sdk.retryWriteRecovery(this.client.db); }
    recovery() { return this.client.db.recoveryState(); }
    async settle() { await until(() => this.client.db.isReady() && !this.recovery().recovering, 'Supabase recovery completion'); }
    async snapshot() {
        const c = this.harness.c;
        const docs = (await c.query('select root,key,value,seq from public.zoe_docs where tenant_id=$1 order by root,key', [this.tenant])).rows;
        const logical = {};
        for (const doc of docs) if (doc.value !== null) { logical[doc.root] ||= {}; logical[doc.root][doc.key] = doc.value; }
        const state = (await c.query('select to_jsonb(s) as value from public.zoe_tenant_state s where tenant_id=$1', [this.tenant])).rows[0]?.value;
        const ops = (await c.query('select op_id,result from public.zoe_ops where tenant_id=$1 order by op_id', [this.tenant])).rows;
        return { physical: { docs, state, ops }, logical: projected(logical) };
    }
    async patch(node, value) {
        const [root, key, ...segments] = node.split('/');
        if (!root || !key) throw new Error('SQL controller requires exact owned root/key');
        if (segments.length) {
            if (value === null) await this.harness.c.query('update public.zoe_docs set value=value #- $1::text[] where tenant_id=$2 and root=$3 and key=$4', [segments, this.tenant, root, key]);
            else await this.harness.c.query('update public.zoe_docs set value=jsonb_set(value,$1::text[],$2::jsonb,true) where tenant_id=$3 and root=$4 and key=$5',
                [segments, JSON.stringify(value), this.tenant, root, key]);
        } else await this.harness.c.query('insert into public.zoe_docs(tenant_id,root,key,value,seq) values($1,$2,$3,$4,1) on conflict(tenant_id,root,key) do update set value=excluded.value',
            [this.tenant, root, key, value]);
    }
    async rawBackend(ops) {
        this.rawMode = true;
        try { return await this.client.app._transport.rpc('zoe_purge_execute_v1', { p_expected_tenant: this.tenant,
            p_op_id: 'f03_raw_' + randomBytes(12).toString('hex'), p_ops: ops }, WAIT_MS); }
        finally { this.rawMode = false; }
    }
    async removeOperationReceipt(entry) { await this.harness.c.query('delete from public.zoe_ops where tenant_id=$1 and op_id=$2', [this.tenant, entry.row.opId]); }
    async operationGone(entry) { return (await this.harness.c.query('select 1 from public.zoe_ops where tenant_id=$1 and op_id=$2', [this.tenant, entry.row.opId])).rows.length === 0; }
}
function futureHolder(row) {
    return { v: 2, intent: 'scan_' + digest('successor:' + row.id).slice(0, 32), actorUid: 'f03-synthetic-successor', birth: row.createdAt + 999 };
}
async function observePurge(provider) {
    const result = await bounded(provider.purge(), provider.kind + ' public purge');
    await provider.settle();
    return result;
}
async function fullJournalValid(api, provider, entry) {
    if (!entry || entry.row.v !== 1 || !/^[A-Za-z0-9_-]{16,64}$/.test(entry.row.opId)) return false;
    const intent = api.boundedRegistryPurgeIntent(entry.row.ops);
    if (!intent || intent.sourceId !== provider.row.id || intent.receipts.length !== provider.row.count
        || !intent.receipts.every(receipt => receipt.releasedBy === provider.uid && receipt.scope === provider.scope)) return false;
    return provider.kind === 'native' ? entry.row.hash === digest(JSON.stringify(entry.row.ops))
        : entry.row.writeProtocol === 3 && entry.row.purgeHash === await api.registryPurgeBindingHash(entry.row.ops);
}
function originalEffectsMatch(provider, entry, actual) {
    if (!entry) return false;
    return entry.row.ops.every(op => equal(actual[op.p[0]]?.[op.p[1]] ?? null, op.v));
}
function fullMembersMatch(api, provider, entry, actual) {
    const members = Object.entries(provider.row.barcodes);
    const receipts = Object.values(actual[P] || {});
    if (receipts.length !== members.length) return false;
    return members.every(([slot, barcode]) => {
        const candidates = receipts.filter(receipt => receipt.slot === slot);
        if (candidates.length !== 1) return false;
        const receipt = candidates[0];
        const expected = { v: 2, generation: provider.row.trashGeneration, id: receipt.id, kind: 'legacy', actorUid: provider.uid,
            releasedBy: provider.uid, scope: provider.scope, code: barcode.code, registryKey: expectedKey(barcode.code), birth: barcode.createdAt,
            trashId: provider.row.id, slot, deletedAt: provider.row.deletedAt, rowBirth: provider.row.createdAt, rowCount: provider.row.count };
        const original = entry.row.ops.find(op => op.p[0] === P && op.p[1] === receipt.id)?.v;
        return equal(receipt, expected) && api.registryPurgeReceiptMatches(original, receipt);
    });
}
async function retainedAfterLostAck(provider) {
    provider.faults.drop = true; provider.faults.denyAfterDrop = true;
    const outcome = await observePurge(provider);
    await bounded(provider.retry().catch(() => {}), 'join unknown recovery');
    await provider.settle();
    const entry = originalJournal(provider.row.id);
    if (outcome !== false || !entry || provider.stats.dropped !== 1 || provider.stats.commits !== 1
        || provider.stats.deniedReads < 1 || provider.recovery().blocked < 1) throw new Error('Actual committed lost ACK did not retain unknown original journal');
    return clone(entry);
}
function logicalForComparison(logical) {
    const receipts = Object.values(logical[P] || {}).map(receipt => {
        const value = clone(receipt); delete value.id; value.actorUid = '<owner>'; value.releasedBy = '<owner>'; value.scope = '<scope>'; return value;
    }).sort((a, b) => Number(a.slot) - Number(b.slot));
    const consumptions = Object.fromEntries(Object.entries(logical[G] || {}).map(([id, value]) => [id, { ...value, actorUid: '<owner>', scope: '<scope>' }]));
    const sources = Object.fromEntries(Object.entries(logical[T] || {}).map(([id, row]) => [id, { ...row,
        barcodes: Object.fromEntries(Object.entries(row.barcodes || {}).filter(([, barcode]) => barcode !== null && barcode !== undefined)) }]));
    return { ...logical, [T]: sources, [P]: receipts, [G]: consumptions };
}
async function runCase(runtime, provider, scenario) {
    const before = await provider.snapshot();
    const initialMoney = moneyOf(before.logical);
    const context = { uid: provider.uid, scope: provider.scope };
    const check = (label, condition, detail) => {
        if (!FAMILY[scenario.family].includes(label)) throw new Error('Unknown assertion ID ' + label);
        requireCheck(label, condition, detail);
    };
    if (scenario.family === 'positive') {
        const success = await observePurge(provider), after = await provider.snapshot();
        const entry = provider.stats.captures[0]?.journal;
        check('applied', success === true);
        check('one-commit', provider.stats.commits === 1 && provider.stats.executeRequests === 1, provider.stats);
        check('full-journal-before-dispatch', await fullJournalValid(runtime.api, provider, entry));
        check('all-original-effects', originalEffectsMatch(provider, entry, after.logical));
        check('all-receipt-members', fullMembersMatch(runtime.api, provider, entry, after.logical));
        check('money-unchanged', equal(moneyOf(after.logical), initialMoney));
        return { logical: logicalForComparison(after.logical), capture: intentIdentity(entry),
            wireBytes: provider.stats.lastWireBytes ?? null, submittedOpsUtf8: Buffer.byteLength(JSON.stringify(entry.row.ops), 'utf8') };
    }
    if (scenario.family === 'backend') {
        const ops = packet(provider.row, context);
        if (scenario.fault === 'wrong-key') {
            ops[2].p[1] = 'F03_UNRELATED_KEY'; ops[3].v.registryKey = 'F03_UNRELATED_KEY';
            await provider.patch(R + '/F03_UNRELATED_KEY', true);
        }
        if (scenario.fault === 'missing-pair') ops.splice(2, 1);
        if (scenario.fault === 'count-mirror') {
            const changed = clone(provider.row);
            changed.barcodes['2'] = { code: 'F03_EXTRA_ACTUAL_MEMBER', cod: 1, dod: 0, isClosed: false, createdAt: changed.createdAt + 2 };
            await provider.patch(T + '/' + changed.id, changed); await provider.patch(R + '/F03_EXTRA_ACTUAL_MEMBER', true);
        }
        const controlled = await provider.snapshot();
        const rejection = await bounded(provider.rawBackend(ops), 'raw authenticated backend negative').then(() => null, error => error);
        const after = await provider.snapshot();
        const backendCode = String(rejection?.code || '');
        check('backend-attempt-reached', provider.stats.backendAttempts === 1 && !!rejection
            && (provider.kind === 'native' ? /permission[_-]denied/i.test(backendCode) : ['22023', '42501', 'PT409'].includes(backendCode)), { backendCode });
        check('backend-refused', !!rejection);
        check('zero-effects', equal(after, controlled));
        check('money-unchanged', equal(moneyOf(after.logical), initialMoney));
        return { logical: logicalForComparison(after.logical), backendCode, publicReachability: 'UNPROVEN; raw backend adversarial/schema-resilience fixture, not supported public admission proof', barrier: 'raw syntactically valid authenticated attempt; denial code required, not counter alone' };
    }
    if (scenario.family === 'barrier') {
        let reached = false, controlled = null;
        provider.beforePurge = async () => {
            reached = true;
            if (scenario.fault === 'source') await provider.patch(T + '/' + provider.row.id + '/deletedAt', provider.row.deletedAt + 1);
            if (scenario.fault === 'restore') await provider.patch(T + '/' + provider.row.id + '/restoreClaim',
                { token: 'f03_fixture_claim', targetId: 'f03_restore_target', claimedAt: 1790000000010 });
            if (scenario.fault === 'holder') await provider.patch(R + '/' + expectedKey(Object.values(provider.row.barcodes)[0].code), futureHolder(provider.row));
            controlled = await provider.snapshot();
        };
        const success = await observePurge(provider), after = await provider.snapshot();
        check('preflight-gate-reached', reached && provider.stats.captures.length === 1);
        check('controller-committed', controlled !== null);
        check('refused', success === false && provider.stats.commits === 0);
        check('intervening-state-preserved', equal(after, controlled));
        check('money-unchanged', equal(moneyOf(after.logical), initialMoney));
        return { logical: logicalForComparison(after.logical), barrier: 'public preflight complete -> synthetic controller commit -> backend admission; not a SQL lock-parity claim' };
    }
    if (scenario.family === 'lost') {
        provider.faults.drop = true; provider.faults.denyAfterDrop = false;
        const success = await observePurge(provider), after = await provider.snapshot();
        const original = provider.stats.captures[0]?.journal;
        check('commit-before-loss', provider.stats.dropped === 1 && provider.stats.commits === 1);
        check('one-commit', provider.stats.executeRequests === 1);
        check('same-original-intent', await fullJournalValid(runtime.api, provider, original));
        check('proof-completed', success === true && !originalJournal(provider.row.id) && provider.recovery().blocked === 0);
        check('money-unchanged', equal(moneyOf(after.logical), initialMoney));
        return { logical: logicalForComparison(after.logical), capture: intentIdentity(original) };
    }
    if (scenario.family === 'unknown') {
        const held = await retainedAfterLostAck(provider), count = provider.stats.executeRequests;
        check('commit-before-loss', provider.stats.dropped === 1 && provider.stats.commits === 1);
        check('proof-fault-reached', provider.stats.deniedReads > 0);
        check('full-journal-hold', await fullJournalValid(runtime.api, provider, held) && provider.recovery().blocked > 0
            && equal(intentIdentity(held), intentIdentity(provider.stats.captures[0]?.journal)));
        provider.faults.denyProof = false;
        await bounded(provider.retry(), 'original proof retry'); await provider.settle();
        const after = await provider.snapshot();
        check('no-reexecute', provider.stats.executeRequests === count);
        check('proof-completed', !originalJournal(provider.row.id) && provider.recovery().blocked === 0);
        check('money-unchanged', equal(moneyOf(after.logical), initialMoney));
        return { logical: logicalForComparison(after.logical), capture: intentIdentity(held), readFault: 'transport-only proof READ fault, no Auth/rules mutation' };
    }
    if (scenario.family === 'storage') {
        const undo = installStorageFault(scenario.fault === 'unavailable' ? 'unavailable' : 'quota', provider.stats);
        let success;
        try { success = await observePurge(provider); } finally { undo(); }
        const after = await provider.snapshot();
        check('storage-fault-reached', provider.stats.storageFailures > 0 && success === false);
        check('zero-dispatch', provider.stats.executeRequests === 0 && provider.stats.commits === 0);
        check('zero-effects', equal(after, before));
        check('money-unchanged', equal(moneyOf(after.logical), initialMoney));
        return { logical: logicalForComparison(after.logical) };
    }
    if (scenario.family === 'postgc') {
        const held = await retainedAfterLostAck(provider);
        const identity = intentIdentity(held), dispatches = provider.stats.executeRequests;
        check('real-lost-ack-journal', await fullJournalValid(runtime.api, provider, held) && equal(identity, intentIdentity(originalJournal(provider.row.id))));
        await provider.closeClient();
        const existing = originalJournal(provider.row.id);
        if (!existing || !equal(intentIdentity(existing), identity)) throw new Error('Original journal disappeared at close');
        const aged = clone(existing.row);
        aged.queuedAt = Date.now() - 3 * 86400000;
        if (provider.kind === 'supabase') aged.sentAfter = Date.now() - 3 * 86400000;
        window.localStorage.setItem(existing.key, JSON.stringify(aged));
        await provider.removeOperationReceipt(held);
        check('original-op-gone', await provider.operationGone(held));
        const successor = clone(provider.row);
        successor.trashGeneration = 3; successor.createdAt += 999; successor.deletedAt += 999;
        successor.count = 1; successor.cod = 1; successor.price = 1;
        const first = clone(Object.values(successor.barcodes)[0]); first.createdAt = successor.createdAt;
        first.scanIntent = futureHolder(provider.row).intent; successor.barcodes = { '0': first };
        await provider.patch(T + '/' + successor.id, successor);
        await provider.patch(R + '/' + expectedKey(first.code), futureHolder(provider.row));
        await provider.patch(G + '/' + successor.id, { v: 1, sourceId: successor.id, generation: 2, kind: 'purge',
            actorUid: provider.uid, scope: provider.scope, deletedAt: successor.deletedAt - 1, rowBirth: successor.createdAt - 1 });
        const releases = held.row.ops.filter(op => op.p[0] === P);
        if (scenario.fault === 'partial') await provider.patch(P + '/' + releases[0].p[1], null);
        if (scenario.fault === 'absent') for (const release of releases) await provider.patch(P + '/' + release.p[1], null);
        const controlled = await provider.snapshot();
        provider.faults.denyProof = false;
        await provider.open();
        await bounded(provider.retry().catch(() => {}), 'postGC original proof'); await provider.settle();
        const after = await provider.snapshot(), retained = originalJournal(provider.row.id);
        const completed = scenario.fault === 'full';
        check('proof-result', completed ? !retained && provider.recovery().blocked === 0 : !!retained && provider.recovery().blocked > 0);
        check('same-original-intent', completed ? equal(intentIdentity(existing), identity) : equal(intentIdentity(retained), identity));
        check('zero-replay', provider.stats.executeRequests === dispatches);
        check('new-incarnation-preserved', equal(after, controlled));
        check('money-unchanged', equal(moneyOf(after.logical), initialMoney));
        return { logical: logicalForComparison(after.logical), capture: identity,
            aging: 'only timestamps of actual still-retained row changed; no reconstructed/new intent; only exact original remote operation receipt removed' };
    }
    if (scenario.family === 'bytes') {
        const ops = packet(provider.row, context), scope = '\u0002'.repeat(2048);
        ops[1].v.scope = scope;
        for (const op of ops) if (op.p[0] === P) {
            op.v.scope = scope; op.v.actorUid = '漢'.repeat(2048); op.v.kind = 'scan';
            op.v.id = 'scan_' + Number(op.v.slot).toString(16).padStart(32, '0'); op.p[1] = op.v.id;
        }
        const raw = JSON.stringify(ops), opsBytes = Buffer.byteLength(raw, 'utf8'), patchBytes = Buffer.byteLength(JSON.stringify(updateOf(ops)), 'utf8');
        check('otherwise-complete-packet', !!runtime.api.registryPurgeIntent(ops) && ops.length <= 500 && raw.length + 2000 < LIMIT);
        check('over-byte-envelope', opsBytes > LIMIT && patchBytes > LIMIT && runtime.api.boundedRegistryPurgeIntent(ops) === null);
        const failure = await bounded(Promise.resolve().then(() => provider.client.sdk.update(provider.client.sdk.ref(provider.client.db), updateOf(ops))), 'predispatch oversized update').then(() => null, error => error);
        const after = await provider.snapshot();
        check('zero-dispatch', ['write_recovery_pending', 'write_purge_oversize'].includes(String(failure?.code || '').toLowerCase())
            && failure?.txOutcome === 'not-applied' && failure?.noRetry === true && provider.stats.executeRequests === 0 && provider.stats.commits === 0,
        { code: failure?.code, txOutcome: failure?.txOutcome, noRetry: failure?.noRetry, dispatches: provider.stats.executeRequests, commits: provider.stats.commits });
        check('zero-effects', equal(after, before));
        check('money-unchanged', equal(moneyOf(after.logical), initialMoney));
        return { logical: logicalForComparison(after.logical), opsUtf8: opsBytes, patchUtf8WithoutOperationReceipt: patchBytes,
            submittedWireBytes: null, scope: 'adversarial complete-shape wrapper byte gate; not public admission or native database max-payload proof' };
    }
    throw new Error('Unknown case family');
}
async function main() {
    if (FIXTURES_ONLY && STRICT) throw new Error('fixtures-only cannot satisfy CI STRICT');
    verifyConstruction();
    if (FIXTURES_ONLY) { report('FIXTURES_ONLY_UNRUN', { nativeRuntime: 'UNRUN', supabaseRuntime: 'UNRUN' }); process.exitCode = fail ? 1 : 0; return; }
    for (const file of SOURCE_FILES) requireCheck('source input ' + file, fs.existsSync(path.join(ROOT, file)));
    for (const file of SOURCE_FILES) sourceHashes[file] = digest(fs.readFileSync(path.join(ROOT, file)));
    for (const file of fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter(file => /^\d{14}_[a-z0-9_]+\.sql$/.test(file)).sort()) {
        sourceHashes['supabase/migrations/' + file] = digest(fs.readFileSync(path.join(ROOT, 'supabase/migrations', file)));
    }
    if (!STRICT && process.env.F03_RUN_NATIVE_ENGINE !== '1') {
        console.log('SKIP — F03 native engine not opted in; no backend parity evidence');
        report('UNRUN', { reason: 'No explicit runtime opt-in', nativeRuntime: 'UNRUN' }); process.exitCode = 0; return;
    }
    const origin = parseOrigin(process.env.F03_NATIVE_EMULATOR_URL || (STRICT ? 'http://127.0.0.1:9000' : ''), !STRICT);
    allowedOrigins.add(origin.origin);
    const probeNs = 'demo-f03-purge-probe-' + process.pid + '-' + randomBytes(4).toString('hex');
    let reach = null;
    try { reach = await request(origin.origin + '/.json?ns=' + probeNs); } catch (error) {}
    if (!reach || reach.status >= 500) {
        if (STRICT) requireCheck('owned loopback emulator available', false);
        console.log('SKIP — owned native emulator unavailable; engine UNRUN');
        report('UNRUN', { nativeRuntime: 'UNRUN' }); process.exitCode = 0; return;
    }
    let runtime, sql, native;
    try {
        runtime = await bootstrap(origin); sql = await makeSqlHarness(); native = new NativeNamespace(origin); await native.start(); engineStarted = true;
        for (const scenario of CASES) {
            const comparisons = [];
            for (const providerName of ['native', 'supabase']) {
                window.localStorage.clear(); window.sessionStorage.clear(); runtime.api.firebaseState.authGeneration++;
                const row = source(scenario.count, scenario.family === 'positive' ? 'matched_' + scenario.count : 'f03_' + scenario.id.replace(/-/g, '_'), scenario);
                const provider = providerName === 'native' ? new NativeProvider(runtime, native, scenario, row) : new SupabaseProvider(runtime, sql, scenario, row);
                activeCase = { id: scenario.id, provider: providerName };
                const start = activeChecks.length;
                const inputFingerprint = digest(JSON.stringify(image(row)));
                let value = null, error = null, cleaned = false;
                try { await provider.setup(image(row)); value = await runCase(runtime, provider, scenario); }
                catch (failure) { error = String(failure?.stack || failure); console.error(error); }
                finally {
                    provider.beforePurge = null; provider.faults.denyProof = false; provider.faults.drop = false;
                    try { await bounded(provider.close(), 'close fixture client'); cleaned = true; }
                    catch (failure) { if (providerName === 'native') native.uncertain = true; error ||= String(failure?.stack || failure); }
                }
                const checks = activeChecks.slice(start).filter(check => check.caseId === scenario.id && check.provider === providerName);
                const expected = FAMILY[scenario.family];
                const coherent = checks.length === expected.length && expected.every(label => checks.filter(check => check.label === label && check.pass).length === 1)
                    && cleaned && !error;
                if (!coherent) { fail++; console.error('  FAIL  case manifest ' + providerName + ':' + scenario.id); }
                results.push({ id: scenario.id, provider: providerName, inputFingerprint, pass: coherent, assertions: checks, cleanup: cleaned, error,
                    ...(providerName === 'native' ? { resources: provider.resourceReport() } : {}), ...value });
                if (!cleaned) throw new Error('Client cleanup failed; aborting before another provider can reuse globals');
                comparisons.push(value?.logical ?? null);
                activeCase = null;
            }
            requireCheck('matched logical state ' + scenario.id, comparisons.every(Boolean) && equal(comparisons[0], comparisons[1]));
        }
        requireCheck('all expected case/provider IDs executed exactly once', results.length === EXPECTED.length
            && EXPECTED.every(expected => results.filter(result => result.id === expected.id && result.provider === expected.provider && result.pass).length === 1));
        requireCheck('frozen source inputs unchanged after engine run', Object.entries(sourceHashes).every(([file, hash]) => digest(fs.readFileSync(path.join(ROOT, file))) === hash));
    } finally {
        const cleanupErrors = [];
        if (native) {
            try { await bounded(native.close(), 'close owned native namespace'); }
            catch (error) { native.uncertain = true; cleanupErrors.push(String(error?.message || error)); }
            nativeResources = native.resourceReport();
        }
        if (sql) { try { await bounded(sql.close(), 'close owned Postgres harness'); } catch (error) { cleanupErrors.push(String(error?.message || error)); } }
        if (runtime) {
            try { await bounded(runtime.restore(), 'restore checker runtime'); } catch (error) { cleanupErrors.push(String(error?.message || error)); }
            fs.rmSync(runtime.scratch, { recursive: true, force: true });
        }
        if (cleanupErrors.length) throw new Error('Final cleanup incomplete: ' + cleanupErrors.join('; '));
    }
    requireCheck('owned native namespace quiescent and empty across all cases', nativeResources?.canonicalLoads === 1
        && nativeResources.cleanupRuleWrites === 1 && nativeResources.beforeEmpty === CASES.length && nativeResources.afterEmpty === CASES.length
        && nativeResources.closed === true && nativeResources.active === false && nativeResources.uncertain === false && nativeResources.pendingRequests === 0);
    report(fail ? 'FAIL' : 'PASS', { nativeRuntime: 'EXECUTED', supabaseRuntime: 'EXECUTED', infrastructureCleanup: 'complete',
        semantics: 'Already-trashed synthetic groups; nonempty money sentinels unchanged, not complete public financial lifecycle proof',
        providerDifferences: ['Actor/tenant/scope/op IDs and journal hash protocols differ', 'Native adds one operation receipt; SQL adds typed op cache/seq/accounting',
            'Controller commits are before backend admission; SQL93driver separately proves transaction lock interleavings',
            '4MiB representations are layered; wrapper byte rejection is not native engine size acceptance proof',
            'Only known barcode array/object containers are projected to keyed slots for comparison; original codes, keys, numbers and per-provider snapshots stay exact'] });
    process.exitCode = fail ? 1 : 0;
}
main().catch(error => { console.error(error.stack || error); report('FAIL', { infrastructureError: String(error?.message || error), nativeRuntime: engineStarted ? 'INCOMPLETE' : 'UNRUN' }); process.exitCode = 1; });
