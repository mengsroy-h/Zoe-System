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
const sourceHashes = {}, results = [], activeChecks = [], timingResults = [];
const guardResults = [], guardChecks = [], guardFixtureChecks = [];
let guardOracleHash = null, guardOracle = null, guardNativeResources = null, guardEngineStarted = false;
function timingOrder(value) {
    const selected = value === undefined ? '249,250,251' : value;
    if (!['249,250,251', '251,249,250'].includes(selected)) throw new Error('Unsupported owned diagnostic timing order');
    return selected.split(',').map(Number);
}
function failureMetadata(error) {
    try {
        return { code: ['INTERNAL_ERROR', 'PERMISSION_DENIED', 'DISCONNECTED', 'write_recovery_pending', 'write_outcome_unknown'].includes(error?.code) ? error.code : 'other',
            txOutcome: ['unknown', 'not-applied', 'committed'].includes(error?.txOutcome) ? error.txOutcome : 'unclassified' };
    } catch (_) { return { code: 'other', txOutcome: 'unclassified' }; }
}
const TIMING_COUNTS = timingOrder(process.env.F03_TIMING_ORDER), TIMING_PHASE_MS = 90000;
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
    const started = process.hrtime.bigint();
    let timer;
    try {
        const value = await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out: ' + label)), ms); })]);
        if (Number(process.hrtime.bigint() - started) / 1e6 > ms) throw new Error('Timed out: ' + label);
        return value;
    } finally { clearTimeout(timer); }
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
const GUARD_WHITESPACE = [0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x0020, 0x00A0, 0x1680,
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
    0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF];
const GUARD_VECTORS = [
    ...GUARD_WHITESPACE.map(point => ({ id: 'edge-' + point.toString(16), code: String.fromCharCode(point) + 'A' + String.fromCharCode(point),
        key: 'A', badKey: point === 0xFEFF ? 'A\uFEFF' : point === 0x00A0 ? 'A\u00A0' : 'F03_EDGE_' + point.toString(16).toUpperCase() })),
    { id: 'all-js-whitespace', code: GUARD_WHITESPACE.map(point => String.fromCharCode(point)).join('') + 'A'
        + GUARD_WHITESPACE.map(point => String.fromCharCode(point)).reverse().join(''), key: 'A', badKey: 'F03_ALL_JS_WHITESPACE' },
    { id: 'trailing-lf', code: 'A\n', key: 'A', badKey: 'A%0A' },
    { id: 'interior-tab', code: 'A\tB', key: 'A%09B', badKey: 'A%2509B' },
    { id: 'literal-tab-escape', code: 'A%09B', key: 'A%2509B', badKey: 'A%09B' },
    { id: 'interior-lf', code: 'A\nB', key: 'A%0AB', badKey: 'AB' },
    { id: 'interior-cr', code: 'A\rB', key: 'A%0DB', badKey: 'AB' },
    { id: 'interior-vt', code: 'A\vB', key: 'A%0BB', badKey: 'AB' },
    { id: 'interior-ff', code: 'A\fB', key: 'A%0CB', badKey: 'AB' },
    { id: 'interior-nul-del', code: 'A\u0000\u007FB', key: 'A%00%7FB', badKey: 'AB' },
    { id: 'interior-del', code: 'A\u007FB', key: 'A%7FB', badKey: 'AB' },
    { id: 'repeated-code', code: 'AA', key: 'AA', badKey: 'A' },
    { id: 'dot', code: 'A.B', key: 'A%2EB', badKey: 'AXB' },
    { id: 'backslash', code: 'A\\B', key: 'A\\B', badKey: 'AB' },
    { id: 'regex-metacharacters', code: 'A+*?^(){}|\\B', key: 'A+*?^(){}|\\B', badKey: 'AB' },
    { id: 'reserved-percent', code: 'a%.#$[]/b', key: 'A%25%2E%23%24%5B%5D%2FB', badKey: 'A%2E%23%24%5B%5D%2FB' },
    { id: 'unicode-sharp-s', code: 'ß', key: 'SS', badKey: 'ß' },
    { id: 'unicode-turkish-i', code: 'iıİ', key: 'IIİ', badKey: 'III' },
    { id: 'unicode-emoji', code: '😀', key: '😀', badKey: 'F03_OTHER_EMOJI' },
    { id: 'unicode-interior-separators', code: 'a\u2028\u2029\uFEFF\u00A0é', key: 'A\u2028\u2029\uFEFF\u00A0É', badKey: 'AÉ' },
    { id: 'regex-dot-backslash', code: 'A.B\\+*?^(){}|C', key: 'A%2EB\\+*?^(){}|C', badKey: 'AXB\\+*?^(){}|C' },
    { id: 'unicode-mixed', code: 'straße😀/iıİ', key: 'STRASSE😀%2FIIİ', badKey: 'STRASSE😀%2FIII' },
    { id: 'unicode-recent-1c8a', code: '\u1C8A', key: null, badKey: 'F03_OTHER_UNICODE', runtimeKey: true }
];
for (const vector of GUARD_VECTORS) {
    if (FIXED_KEYS.has(vector.code) && FIXED_KEYS.get(vector.code) !== vector.key) throw new Error('Conflicting guard golden');
    FIXED_KEYS.set(vector.code, vector.key);
}
const GUARD_FAMILY = {
    matching: ['seed-proven', 'backend-attempt-reached', 'backend-accepted', 'all-original-effects', 'all-receipt-members', 'money-history-unchanged', 'raw-bypassed-preflight'],
    mismatch: ['seed-proven', 'backend-attempt-reached', 'backend-typed-denial', 'exact-zero-effects', 'money-history-unchanged', 'raw-bypassed-preflight']
};
const GUARD_ENGINE_IDS = ['all-js-whitespace', 'trailing-lf', 'edge-feff', 'edge-a0', 'interior-tab', 'literal-tab-escape',
    'repeated-code', 'regex-dot-backslash', 'reserved-percent', 'unicode-mixed', 'unicode-recent-1c8a', 'interior-del'];
const GUARD_CASES = GUARD_VECTORS.filter(vector => GUARD_ENGINE_IDS.includes(vector.id))
    .flatMap(vector => ['matching', 'mismatch'].map(mode => ({ id: 'guard-' + vector.id + '-' + mode, vector, mode })));
const GUARD_EXPECTED = GUARD_CASES.flatMap(scenario => ['native', 'supabase'].map(provider => ({ id: scenario.id, provider, assertions: GUARD_FAMILY[scenario.mode] })));
let guardManifestHash = null;
function guardCheck(label, condition, detail, fixture = false) {
    const entry = { label, pass: !!condition, ...(!fixture && activeCase ? { caseId: activeCase.id, provider: activeCase.provider } : {}) };
    (fixture ? guardFixtureChecks : guardChecks).push(entry);
    if (!condition) { fail++; console.error('  FAIL  guard ' + label + (detail === undefined ? '' : '\n        ' + JSON.stringify(detail).slice(0, 1600))); }
    if (!condition) throw new Error('Guard assertion failed: ' + label);
}
function verifyGuardConstruction() {
    const file = 'ZoeW/src/domain/barcode-key.ts', absolute = path.join(ROOT, file);
    const { buildSync } = require(path.join(REPO, 'ZoeW/node_modules/esbuild'));
    const built = buildSync({ absWorkingDir: ROOT, stdin: { contents: "export { canonicalBarcodeRegistryKey } from './ZoeW/src/domain/barcode-key';", resolveDir: ROOT },
        bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'error' });
    const actual = { exports: {} };
    require('vm').runInNewContext(built.outputFiles[0].text, { module: actual, exports: actual.exports });
    guardOracle = actual.exports.canonicalBarcodeRegistryKey;
    guardOracleHash = digest(built.outputFiles[0].text); sourceHashes[file] = digest(fs.readFileSync(absolute));
    for (const vector of GUARD_VECTORS.filter(vector => vector.runtimeKey)) { vector.key = guardOracle(vector.code); FIXED_KEYS.set(vector.code, vector.key); }
    guardManifestHash = digest(JSON.stringify({ vectors: GUARD_VECTORS, engineIds: GUARD_ENGINE_IDS, expected: GUARD_EXPECTED }));
    guardCheck('actual-TS-domain-oracle-and-static-goldens', typeof guardOracle === 'function'
        && GUARD_VECTORS.every(vector => guardOracle(vector.code) === vector.key && vector.badKey !== vector.key), undefined, true);
    guardCheck('all-25-JS-edge-whitespace-and-unique-vectors', GUARD_WHITESPACE.length === 25 && new Set(GUARD_WHITESPACE).size === 25
        && GUARD_WHITESPACE.every(point => GUARD_VECTORS.some(vector => vector.id === 'edge-' + point.toString(16)))
        && GUARD_VECTORS.length === 47 && new Set(GUARD_VECTORS.map(vector => vector.id)).size === 47, undefined, true);
    guardCheck('every-golden-and-negative-key-is-legal-SDK-path', GUARD_VECTORS.every(vector => [vector.key, vector.badKey]
        .every(key => typeof key === 'string' && key.length > 0 && !/[.#$\[\]\/\u0000-\u001F\u007F]/.test(key))), undefined, true);
    guardCheck('guard-manifest-separate-and-complete', GUARD_ENGINE_IDS.length === 12 && GUARD_CASES.length === 24 && GUARD_EXPECTED.length === 48
        && new Set(GUARD_EXPECTED.map(entry => entry.provider + ':' + entry.id)).size === 48
        && GUARD_EXPECTED.reduce((sum, entry) => sum + entry.assertions.length, 0) === 312
        && CASES.length === 20 && EXPECTED.length === 40 && EXPECTED.reduce((sum, entry) => sum + entry.assertions.length, 0) === 212, undefined, true);
    guardCheck('full-pure-vector-matrix-has-six-ops-and-legal-seeded-wrong-key', GUARD_VECTORS.every(vector => {
        const { row, seed } = guardFixture({ vector, mode: 'mismatch' }), ops = packet(row, { uid: 'pure-fixture-owner', scope: 'pure-fixture-scope' });
        const original = clone(ops); ops[2].p[1] = vector.badKey; ops[3].v.registryKey = vector.badKey;
        return ops.length === 6 && seed[R][vector.key] === true && seed[R][vector.badKey] === true
            && ops[3].v.code === vector.code && original[3].v.code === vector.code
            && ops.every((op, index) => equal(op, index === 2 ? { ...original[index], p: [R, vector.badKey] }
                : index === 3 ? { ...original[index], v: { ...original[index].v, registryKey: vector.badKey } } : original[index]));
    }), undefined, true);
}
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
        manifestHash, expectedBehaviorAssertions: EXPECTED.reduce((sum, entry) => sum + entry.assertions.length, 0), sourceHashes, bundleHash, nativeResources, timingResults,
        guardVectors: { status: guardResults.length === GUARD_EXPECTED.length && guardResults.every(row => row.pass)
                && guardChecks.length === GUARD_EXPECTED.reduce((sum, row) => sum + row.assertions.length, 0)
                && guardFixtureChecks.every(row => row.pass) && guardNativeResources?.closed === true && guardNativeResources?.uncertain === false
                ? 'EXECUTED' : guardEngineStarted ? 'INCOMPLETE' : 'UNRUN',
            vectors: GUARD_VECTORS, engineIds: GUARD_ENGINE_IDS, expected: GUARD_EXPECTED, results: guardResults, checks: guardChecks, fixtureChecks: guardFixtureChecks,
            oracleRuntime: { node: process.version, unicode: process.versions.unicode, recentUnicodeKeySource: 'actual TS canonicalBarcodeRegistryKey' },
            manifestHash: guardManifestHash, oracleBundleHash: guardOracleHash, nativeResources: guardNativeResources, expectedBehaviorAssertions: GUARD_EXPECTED.reduce((sum, entry) => sum + entry.assertions.length, 0),
            actualBehaviorAssertions: guardChecks.length, scope: 'Raw authenticated SDK/RPC synthetic legacy-key guard vectors; independent of client preflight' },
        timingPlan: { counts: TIMING_COUNTS, deadlineMs: WAIT_MS, observationMs: WAIT_MS, phaseMs: TIMING_PHASE_MS, scope: 'nativeRecovery atomic update only; fresh data/app, shared Node/JVM; main40/212 unchanged' }, driverHash: digest(fs.readFileSync(__filename)), ...extra };
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
function physicalWriteEvidence(updates, physical, binding) {
    if (!updates || typeof updates !== 'object' || Array.isArray(updates) || !Object.keys(updates).length
        || physical !== null && (typeof physical !== 'object' || Array.isArray(physical))) return { status: 'UNAVAILABLE', reason: 'invalid-physical-shape' };
    const observed = {}, paths = Object.keys(updates), receiptPath = W + '/' + binding?.opId;
    const captured = updates[receiptPath], exactKeys = value => value && typeof value === 'object' && !Array.isArray(value)
        && equal(Object.keys(value).sort(), ['at', 'hash', 'uid']);
    if (!/^native_[a-f0-9]{32}$/.test(binding?.opId) || typeof binding?.uid !== 'string' || !/^[a-f0-9]{64}$/.test(binding?.hash)
        || paths.filter(key => key.startsWith(W + '/')).length !== 1 || !exactKeys(captured) || captured.uid !== binding.uid || captured.hash !== binding.hash
        || !equal(captured.at, { '.sv': 'timestamp' })) return { status: 'UNAVAILABLE', reason: 'invalid-original-transport-binding' };
    let matchedPaths = 0, originalMatchedPaths = 0;
    for (const key of paths) {
        const parts = key.split('/');
        if (parts.some(part => !part)) return { status: 'UNAVAILABLE', reason: 'invalid-captured-path' };
        let value = physical;
        for (const part of parts) value = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, part) ? value[part] : null;
        observed[key] = value ?? null;
        if (equal(updates[key], observed[key])) { matchedPaths++; if (key !== receiptPath) originalMatchedPaths++; }
    }
    const receipt = observed[receiptPath], receiptShape = exactKeys(receipt), uidHashBound = receipt?.uid === binding.uid && receipt?.hash === binding.hash;
    const timestampResolved = Number.isSafeInteger(receipt?.at) && receipt.at > 0;
    const transportMatched = receiptShape && uidHashBound && timestampResolved;
    const semanticMatchedPaths = originalMatchedPaths + (transportMatched ? 1 : 0), originalPaths = paths.length - 1;
    return { status: 'OBSERVED', effects: semanticMatchedPaths === paths.length ? 'ALL_ORIGINAL_EFFECTS_AND_BOUND_RECEIPT' : semanticMatchedPaths ? 'MIXED' : 'NONE_MATCHED',
        totalPaths: paths.length, matchedPaths, unmatchedPaths: paths.length - matchedPaths, rootAbsent: physical === null,
        originalEffects: { totalPaths: originalPaths, matchedPaths: originalMatchedPaths, unmatchedPaths: originalPaths - originalMatchedPaths },
        transportReceipt: { status: transportMatched ? 'MATCHED_RESOLVED_TIMESTAMP' : receipt === null ? 'MISSING' : 'MISMATCH',
            exactShape: !!receiptShape, uidHashBound, timestampResolved, originalOpIdBound: true },
        semanticMatchedPaths, semanticUnmatchedPaths: paths.length - semanticMatchedPaths,
        expectedPatchHash: digest(JSON.stringify(updates)), observedPathsHash: digest(JSON.stringify(observed)), physicalRootHash: digest(JSON.stringify(physical)),
        meaning: 'Read snapshot only; original effects exact, bound transport timestamp server-resolved; literal wire hashes remain distinct; no completion, NOT_APPLIED, replay or lease release authorized' };
}
function endNativeFixtureOwner(api, client, trace) {
    const state = api?.firebaseState;
    if (!client || !state || state.db !== client.db || state.fb !== client.sdk || state.auth !== client.auth) return null;
    const probe = state.dbLivenessProbe;
    state.authGeneration++; state.infoListenerGeneration++;
    state.isDatabaseConnected = false; state.hasEverConnectedToDatabase = false;
    let cancelledTimers = 0;
    for (const key of ['reconnectWatchdogTimer', 'infoListenerRecoveryTimer']) {
        if (state[key]) { clearTimeout(state[key]); state[key] = null; cancelledTimers++; }
    }
    state.reconnectWatchdogAttempt = 0; state.infoListenerRecoveryAttempt = 0;
    trace.note('fixture-owner-ended', { cancelledTimers });
    return probe;
}
class NativeWireTrace {
    constructor(base, namespace, clock = () => process.hrtime.bigint()) {
        this.base = base; this.namespace = namespace; this.clock = clock; this.started = clock();
        this.events = []; this.sockets = []; this.connections = 0; this.observerErrors = 0; this.droppedEvents = 0;
    }
    safely(run) { try { return run(); } catch (_) { this.observerErrors++; } }
    note(phase, detail = {}) {
        this.safely(() => {
            if (this.events.length >= 128) { this.droppedEvents++; return; }
            const memory = process.memoryUsage();
            this.events.push({ phase, ms: Number(this.clock() - this.started) / 1e6, heapUsed: memory.heapUsed, rss: memory.rss, ...detail });
        });
    }
    owns(url) {
        try {
            const value = new URL(url);
            return value.protocol === 'ws:' && value.hostname === '127.0.0.1' && value.port === this.base.port
                && value.searchParams.get('ns') === this.namespace && !value.username && !value.password;
        } catch (_) { return false; }
    }
    attach(socket, url) {
        if (!this.owns(url)) return socket;
        this.safely(() => {
            if (this.connections >= 128) { this.note('trace-connection-limit'); return; }
            const connection = ++this.connections, requests = new Map();
            const state = { connection, sentFrames: 0, receivedFrames: 0, sentMessages: 0, receivedMessages: 0, arrivedFrames: 0, arrivedMessages: 0, sendReturnedFalse: 0, awaitingMergeAcks: 0, closed: false };
            this.sockets.push(state);
            const stream = direction => {
                let parts = [], expected = 0, bytes = 0, disabled = false;
                return frame => this.safely(() => {
                    if (disabled || typeof frame !== 'string') return;
                    state[direction === 'sent' ? 'sentFrames' : direction === 'arrived' ? 'arrivedFrames' : 'receivedFrames']++;
                    if (!expected && frame.length <= 6 && /^\d+$/.test(frame)) {
                        expected = Number(frame);
                        if (expected === 0) return;
                        if (expected > 1024) { disabled = true; this.note('trace-frame-limit', { connection, direction }); }
                        return;
                    }
                    if (!expected) expected = 1;
                    bytes += Buffer.byteLength(frame, 'utf8');
                    if (bytes > LIMIT + 65536) { disabled = true; parts = []; this.note('trace-byte-limit', { connection, direction }); return; }
                    parts.push(frame);
                    if (parts.length !== expected) return;
                    const text = parts.join(''), frames = expected, utf8 = bytes;
                    parts = []; expected = 0; bytes = 0;
                    state[direction === 'sent' ? 'sentMessages' : direction === 'arrived' ? 'arrivedMessages' : 'receivedMessages']++;
                    const message = JSON.parse(text), data = message?.t === 'd' ? message.d : null;
                    if (!data || !Number.isSafeInteger(data.r) || data.r < 1) return;
                    if (direction === 'sent' && data.a === 'm' && data.b && data.b.d && typeof data.b.d === 'object' && !Array.isArray(data.b.d)) {
                        const metadata = { request: data.r, paths: Object.keys(data.b.d).length,
                            patchUtf8: Buffer.byteLength(JSON.stringify(data.b.d), 'utf8'), patchHash: digest(JSON.stringify(data.b.d)) };
                        if (requests.size >= 128) { this.note('trace-request-limit', { connection }); return; }
                        requests.set(data.r, metadata); state.awaitingMergeAcks = requests.size;
                        this.note('merge-send-returned', { connection, frames, envelopeUtf8: utf8, root: data.b.p === '/', ...metadata });
                    } else if (direction !== 'sent' && requests.has(data.r)) {
                        const metadata = requests.get(data.r);
                        if (direction === 'received') { requests.delete(data.r); state.awaitingMergeAcks = requests.size; }
                        const status = ['ok', 'permission_denied', 'datastale', 'too_big', 'unavailable', 'internal_error'].includes(data.b?.s) ? data.b.s : 'other';
                        this.note(direction === 'arrived' ? 'merge-ack-frame-arrived' : 'merge-ack-observed', { connection, request: data.r, status, patchHash: metadata.patchHash });
                    }
                });
            };
            const outgoing = stream('sent'), incoming = stream('received'), arrived = stream('arrived'), send = socket.send;
            socket.send = function (...args) {
                let value;
                try { value = send.apply(this, args); }
                catch (error) { thisTrace.safely(() => thisTrace.note('socket-send-threw', { connection })); throw error; }
                thisTrace.safely(() => { if (value === false) state.sendReturnedFalse++; outgoing(args[0]); });
                return value;
            };
            const thisTrace = this;
            socket.on('data', frame => this.safely(() => arrived(frame)));
            socket.addEventListener('message', event => this.safely(() => incoming(event.data)));
            socket.addEventListener('close', () => this.safely(() => { state.closed = true; this.note('socket-closed', { connection, awaitingMergeAcks: requests.size }); }));
            this.note('socket-observer-attached', { connection });
        });
        return socket;
    }
    summary() {
        return { events: this.events.slice(), sockets: this.sockets.map(value => ({ ...value })), connections: this.connections, observerErrors: this.observerErrors, droppedEvents: this.droppedEvents,
            meaning: 'send-returned is Faye invocation, not server commit; frame-arrived is Faye data before SDK handler, observed is after SDK handler; neither is independent effect proof' };
    }
}
function verifyNativeTrace() {
    const base = new URL('http://127.0.0.1:9000'), ns = 'demo-f03-purge-trace', url = 'ws://127.0.0.1:9000/.ws?ns=' + ns;
    let ticks = 0n;
    const trace = new NativeWireTrace(base, ns, () => ++ticks);
    const socket = () => {
        const listeners = {}, calls = [];
        return { calls, send(...args) { calls.push({ receiver: this, args }); return false; },
            on(name, fn) { listeners[name] = fn; }, addEventListener(name, fn) { listeners[name] = fn; }, emit(name, data) { listeners[name]?.(data); } };
    };
    const client = socket();
    const foreign = socket(), originalSend = foreign.send; trace.attach(foreign, url.replace(ns, ns + '-other'));
    requireCheck('trace ignores foreign namespace and non-loopback origin', foreign.send === originalSend
        && !trace.owns(url.replace('127.0.0.1', 'localhost')) && !trace.owns(url.replace('ws:', 'wss:')));
    trace.attach(client, url);
    const patch = { 'synthetic/a': null, 'synthetic/b': { safe: '漢' } };
    const merge = JSON.stringify({ t: 'd', d: { r: 7, a: 'm', b: { p: '/', d: patch } } });
    const first = merge.slice(0, 11), second = merge.slice(11);
    const extra = { synthetic: true };
    const sent = [client.send('2'), client.send(first, extra), client.send(second)];
    requireCheck('trace forwards exact frame identities, receiver, order and false returns', sent.every(value => value === false)
        && client.calls.length === 3 && client.calls[0].args[0] === '2' && client.calls[1].args[0] === first
        && client.calls[1].args[1] === extra && client.calls[2].args[0] === second && client.calls.every(call => call.receiver === client));
    const sendEvent = trace.events.find(event => event.phase === 'merge-send-returned');
    requireCheck('trace reconstructs fragmented merge with exact structural hash', sendEvent?.frames === 2 && sendEvent.paths === 2
        && sendEvent.patchHash === digest(JSON.stringify(patch)) && sendEvent.patchUtf8 === Buffer.byteLength(JSON.stringify(patch), 'utf8'));
    const auth = JSON.stringify({ t: 'd', d: { r: 8, a: 'auth', b: { cred: 'SECRET_AUTH_TOKEN' } } });
    client.send('2'); client.send(auth.slice(0, 13)); client.send(auth.slice(13)); client.emit('message', { data: JSON.stringify({ t: 'd', d: { r: 8, b: { s: 'SECRET_STATUS', d: 'SECRET_AUTH_REPLY' } } }) });
    requireCheck('trace ignores auth ACK while an original merge remains pending', trace.sockets[0].awaitingMergeAcks === 1
        && !trace.events.some(event => event.phase === 'merge-ack-observed'));
    const other = socket(); trace.attach(other, url);
    const ack = JSON.stringify({ t: 'd', d: { r: 7, b: { s: 'ok', d: 'SECRET_ACK_BODY' } } });
    other.emit('message', { data: ack });
    requireCheck('trace does not correlate ACK across connections', !trace.events.some(event => event.phase === 'merge-ack-observed'));
    client.emit('data', '2'); client.emit('data', ack.slice(0, 9)); client.emit('data', ack.slice(9));
    const arrivedEvent = trace.events.find(event => event.phase === 'merge-ack-frame-arrived');
    requireCheck('trace early Faye frame boundary retains matching request before SDK message handler', arrivedEvent?.request === 7
        && arrivedEvent.patchHash === sendEvent.patchHash && !trace.events.some(event => event.phase === 'merge-ack-observed'));
    client.emit('message', { data: '2' }); client.emit('message', { data: ack.slice(0, 9) }); client.emit('message', { data: ack.slice(9) });
    const ackEvent = trace.events.find(event => event.phase === 'merge-ack-observed');
    requireCheck('trace correlates fragmented ACK only to its connection and request', ackEvent?.connection === sendEvent.connection
        && ackEvent.request === 7 && ackEvent.patchHash === sendEvent.patchHash && ackEvent.status === 'ok');
    requireCheck('trace early and post SDK ACK boundaries correlate without consuming proof early', arrivedEvent.connection === ackEvent.connection
        && arrivedEvent.request === ackEvent.request && arrivedEvent.ms < ackEvent.ms && trace.sockets[0].awaitingMergeAcks === 0);
    requireCheck('trace excludes auth, payload values and ACK bodies from retained output', !/SECRET_|synthetic\/|漢|cred/.test(JSON.stringify(trace.summary())));
    client.send('not-json'); client.send('0');
    requireCheck('trace malformed observer input cannot throw into SDK dispatch', trace.observerErrors === 1 && client.calls.length === 8);
    const boom = new Error('SECRET_SDK_ERROR'), throwing = socket(); throwing.send = () => { throw boom; }; trace.attach(throwing, url);
    let observed; try { throwing.send(merge); } catch (error) { observed = error; }
    requireCheck('trace preserves original SDK send exception identity without message retention', observed === boom && !JSON.stringify(trace.summary()).includes(boom.message));
    const broken = new NativeWireTrace(base, ns), safe = socket(); broken.attach(safe, url); broken.note = () => { throw new Error('observer only'); };
    requireCheck('trace observer failure preserves original send result', safe.send(merge) === false && broken.observerErrors === 1);
    const capped = new NativeWireTrace(base, ns), busy = socket(); capped.attach(busy, url);
    for (let request = 1; request <= 256; request++) busy.send(JSON.stringify({ t: 'd', d: { r: request, a: 'm', b: { p: '/', d: patch } } }));
    requireCheck('trace bounds retained events and pending merge metadata independently', capped.events.length === 128 && capped.droppedEvents > 0
        && capped.sockets[0].awaitingMergeAcks === 128 && busy.calls.length === 256);
    const limited = new NativeWireTrace(base, ns), huge = socket(); limited.attach(huge, url); huge.send('1025'); huge.send(merge);
    requireCheck('trace fragmented-message cap cannot block or mutate transport', huge.calls.length === 2 && limited.events.some(event => event.phase === 'trace-frame-limit')
        && !limited.events.some(event => event.phase === 'merge-send-returned'));
    requireCheck('trace times are monotonic and helper has no pending task or timer', trace.events.every((event, index) => !index || event.ms >= trace.events[index - 1].ms)
        && !('tasks' in trace) && !('timer' in trace));
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
    const websocket = require(require.resolve('faye-websocket', { paths: [deps] })), OriginalClient = websocket.Client, wireTraces = new Map();
    websocket.Client = function (url, protocols, options) {
        const target = new URL(url), copy = { ...options };
        if (target.protocol === 'ws:' && target.hostname === '127.0.0.1' && target.port === base.port) delete copy.proxy;
        const socket = new OriginalClient(url, protocols, copy);
        const trace = wireTraces.get(target.searchParams.get('ns'));
        if (trace) trace.attach(socket, url);
        return socket;
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
    return { api, database, firebaseApp, createMockUserToken, scratch, wireTraces, restore: async () => { websocket.Client = OriginalClient; if (typeof dom.happyDOM?.abort === 'function') await dom.happyDOM.abort(); } };
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
        this.trace = new NativeWireTrace(this.base, namespace.ns);
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
        this.trace.safely(() => this.trace.note('raw-sdk-update-call', { paths: Object.keys(updates).length,
            patchUtf8: Buffer.byteLength(JSON.stringify(updates), 'utf8'), patchHash: digest(JSON.stringify(updates)) }));
        try {
            const pending = this.runtime.database.update(ref, updates);
            this.trace.note('raw-sdk-update-returned');
            const out = await pending; this.trace.note('raw-sdk-update-resolved'); return out;
        }
        catch (error) {
            this.trace.note('raw-sdk-update-rejected', { permissionDenied: error?.code === 'PERMISSION_DENIED', ...failureMetadata(error) });
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
    async failureEvidence(budget = WAIT_MS, originalRejected = false) {
        const capture = this.stats.captures.at(-1), pending = () => [...this.taskLabels.values()].includes('database-update');
        const wasPending = pending();
        if (!capture?.args || !wasPending && originalRejected !== true) return null;
        const epoch = this.clientEpoch;
        if (this.closing || this.namespace.active !== this) return { attempted: false, status: 'UNAVAILABLE', reason: 'inactive-owner' };
        try {
            const updates = clone(capture.args), opId = capture.journal?.row?.opId;
            const binding = Object.freeze({ opId, uid: this.uid, hash: capture.journal?.row?.hash });
            if (typeof opId !== 'string' || !Object.prototype.hasOwnProperty.call(updates, W + '/' + opId)
                || updates[W + '/' + opId] === null) return { attempted: false, status: 'UNAVAILABLE', reason: 'missing-original-receipt-capture' };
            this.trace.note('failure-read-start', { paths: Object.keys(updates).length, patchHash: digest(JSON.stringify(updates)) });
            const physical = await bounded(this.owner(), 'native failure read-only evidence', Math.min(budget, WAIT_MS));
            if (this.closing || this.namespace.active !== this || this.clientEpoch !== epoch) {
                this.trace.note('failure-read-unavailable');
                return { attempted: true, status: 'UNAVAILABLE', reason: 'owner-changed' };
            }
            const evidence = physicalWriteEvidence(updates, physical, binding);
            this.trace.note('failure-read-finished', { status: evidence.status, totalPaths: evidence.totalPaths ?? null, matchedPaths: evidence.matchedPaths ?? null });
            return { attempted: true, sdkPendingAtReadStart: wasPending, originalRejected: originalRejected === true, sdkPendingAtReadEnd: pending(), ...evidence };
        } catch (_) {
            this.trace.note('failure-read-unavailable');
            return { attempted: true, status: 'UNAVAILABLE', reason: 'read-unavailable', sdkPendingAtReadEnd: pending() };
        }
    }
    async owner(node = '', method = 'GET', value) {
        if (this.namespace.active !== this) throw new Error('Native fixture does not own namespace');
        return this.namespace.owner(node, method, value);
    }
    async setup(seed) {
        await this.namespace.acquire(this); this.assertOpen();
        this.runtime.wireTraces?.set(this.ns, this.trace);
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
            get: ref => this.track('sdk-get', () => { this.assertOpen(epoch); return database.get(ref); }),
            update: (ref, updates) => this.track('sdk-update', async () => {
                this.assertOpen(epoch);
                const isPurge = Object.keys(updates).some(key => key.startsWith(P + '/'));
                if (isPurge) {
                    this.stats.executeRequests++; capture(this.stats, this.row.id, updates);
                    this.trace.safely(() => {
                        const journal = this.stats.captures.at(-1)?.journal?.row;
                        this.trace.note('purge-wrapper-entered', { logicalOps: journal?.ops?.length ?? null,
                            opId: /^native_[a-f0-9]{32}$/.test(journal?.opId) ? journal.opId : null,
                            journalHash: /^[a-f0-9]{64}$/.test(journal?.hash) ? journal.hash : null });
                    });
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
        if (this.client) {
            const client = this.client, probe = endNativeFixtureOwner(this.runtime.api, client, this.trace);
            if (probe && typeof probe.then === 'function') {
                const task = Promise.resolve(probe); this.startedTasks++; this.tasks.add(task); this.taskLabels.set(task, 'app-liveness-probe');
                const settled = () => { this.tasks.delete(task); this.taskLabels.delete(task); this.settledTasks++; };
                task.then(settled, settled);
            }
            await client.sdk.deleteApp(client.app); this.client = null;
        }
        if (this.pendingApp) { await this.pendingApp.close(); this.pendingApp = null; }
        await this.quiesce();
    }
    async close() {
        this.trace.note('fixture-close-start'); this.closing = true; await this.closeClient(); await this.namespace.release(this);
        this.runtime.wireTraces?.delete(this.ns); this.trace.note('fixture-close-complete');
    }
    async purge() {
        this.trace.note('public-purge-start');
        try { const out = await this.runtime.api.purgeTrashWithRegistry(clone(this.row)); this.trace.note('public-purge-resolved', { result: out === true ? 'true' : out === false ? 'false' : 'other' }); return out; }
        catch (error) { this.trace.note('public-purge-rejected'); throw error; }
    }
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
async function verifyFailureEvidence() {
    const opId = 'native_' + 'a'.repeat(32), uid = 'f03-native-owner', hash = 'b'.repeat(64);
    const binding = { opId, uid, hash }, receipt = { uid, hash, at: { '.sv': 'timestamp' } };
    const updates = { 'synthetic/delete': null, [W + '/' + opId]: receipt };
    const complete = { [W]: { [opId]: { uid, hash, at: 1790000000000 } }, unrelated: { count: 19 } };
    const all = physicalWriteEvidence(updates, complete, binding);
    requireCheck('failure evidence compares every captured physical path including operation receipt', all.status === 'OBSERVED'
        && all.effects === 'ALL_ORIGINAL_EFFECTS_AND_BOUND_RECEIPT' && all.totalPaths === 2 && all.matchedPaths === 1 && all.semanticMatchedPaths === 2
        && all.originalEffects.matchedPaths === 1 && all.transportReceipt.status === 'MATCHED_RESOLVED_TIMESTAMP'
        && all.expectedPatchHash !== all.observedPathsHash);
    const mixed = clone(complete); mixed[W][opId].unexpected = true;
    requireCheck('failure evidence requires exact receipt value without subset or logical projection', physicalWriteEvidence(updates, mixed, binding).effects === 'MIXED'
        && physicalWriteEvidence(updates, mixed, binding).matchedPaths === 1 && physicalWriteEvidence(updates, { unrelated: 19 }, binding).effects !== 'ALL_ORIGINAL_EFFECTS_AND_BOUND_RECEIPT');
    const missing = physicalWriteEvidence(updates, null, binding), none = physicalWriteEvidence(updates, { synthetic: { delete: 'old' } }, binding);
    requireCheck('failure evidence distinguishes missing root and zero matches without NOT_APPLIED inference', missing.rootAbsent && missing.effects === 'MIXED'
        && none.effects === 'NONE_MATCHED' && !('txOutcome' in missing) && !('applied' in missing));
    requireCheck('failure evidence emits only counts hashes and fixed labels', !JSON.stringify(all).includes(opId)
        && !JSON.stringify(all).includes('unrelated') && !JSON.stringify(all).includes('synthetic/'));
    const fixture = () => {
        const p = Object.create(NativeProvider.prototype); p.closing = false; p.clientEpoch = 1; p.uid = uid;
        p.namespace = { active: p }; p.taskLabels = new Map([[{}, 'database-update']]);
        p.stats = { captures: [{ args: clone(updates), journal: { row: { opId, hash } } }] };
        p.trace = new NativeWireTrace(new URL('http://127.0.0.1:9000'), 'demo-f03-purge-proof');
        p.ownerCalls = 0; p.owner = (...args) => { p.ownerCalls++; p.ownerArgs = args; return Promise.resolve(clone(complete)); };
        return p;
    };
    const p = fixture(), evidence = await p.failureEvidence();
    requireCheck('failure probe uses exactly one root GET and retains original task and lease', evidence.attempted && evidence.effects === 'ALL_ORIGINAL_EFFECTS_AND_BOUND_RECEIPT'
        && p.ownerCalls === 1 && p.ownerArgs.length === 0 && p.taskLabels.size === 1 && p.namespace.active === p && !p.closing);
    const absent = fixture(); absent.taskLabels.clear();
    const unsubmitted = fixture(); unsubmitted.stats.captures = [];
    requireCheck('failure probe never reads without pending original SDK write and actual capture', await absent.failureEvidence() === null
        && await unsubmitted.failureEvidence() === null && absent.ownerCalls === 0 && unsubmitted.ownerCalls === 0);
    const rejected = fixture(); rejected.taskLabels.clear();
    const rejectedEvidence = await rejected.failureEvidence(WAIT_MS, true);
    requireCheck('original rejected write readback is read-only evidence and never completion', rejectedEvidence.attempted
        && rejectedEvidence.originalRejected && !rejectedEvidence.sdkPendingAtReadStart && rejected.ownerCalls === 1
        && rejectedEvidence.effects === 'ALL_ORIGINAL_EFFECTS_AND_BOUND_RECEIPT' && !('txOutcome' in rejectedEvidence) && !('applied' in rejectedEvidence)
        && rejected.namespace.active === rejected && !rejected.closing);
    const rejectedStale = fixture(); rejectedStale.taskLabels.clear(); rejectedStale.namespace.active = {};
    const rejectedMissing = fixture(); rejectedMissing.taskLabels.clear(); rejectedMissing.stats.captures = [];
    requireCheck('rejected readback still refuses stale ownership and missing original capture',
        !(await rejectedStale.failureEvidence(WAIT_MS, true)).attempted && await rejectedMissing.failureEvidence(WAIT_MS, true) === null
        && rejectedStale.ownerCalls === 0 && rejectedMissing.ownerCalls === 0);
    const refused = fixture(); refused.owner = () => Promise.reject(new Error('SECRET_READ_REFUSAL'));
    const denied = await refused.failureEvidence();
    requireCheck('failure probe refusal stays unavailable with no raw response or error disclosure', denied.status === 'UNAVAILABLE'
        && !JSON.stringify(denied).includes('SECRET_') && !JSON.stringify(refused.trace.summary()).includes('SECRET_'));
    const stale = fixture(); stale.namespace.active = {};
    const staleResult = await stale.failureEvidence();
    requireCheck('failure probe refuses stale ownership before dispatch', staleResult.status === 'UNAVAILABLE' && !staleResult.attempted && stale.ownerCalls === 0);
    const changed = fixture(); let finishChanged;
    changed.owner = () => new Promise(resolve => { finishChanged = resolve; });
    const changing = changed.failureEvidence(); changed.clientEpoch++; finishChanged(clone(complete));
    const changedResult = await changing;
    requireCheck('failure probe discards evidence when ownership epoch changes during read', changedResult.status === 'UNAVAILABLE' && changedResult.reason === 'owner-changed');
    const late = fixture(); let finishLate;
    late.owner = () => new Promise(resolve => { finishLate = resolve; });
    const lateResult = await late.failureEvidence(1), retained = JSON.stringify(lateResult);
    finishLate(clone(complete)); await Promise.resolve();
    requireCheck('failure probe deadline retains unavailable evidence after a late complete read', lateResult.status === 'UNAVAILABLE'
        && JSON.stringify(lateResult) === retained && late.taskLabels.size === 1 && late.namespace.active === late);
    const original = fixture(); let finishOriginal;
    original.owner = () => new Promise(resolve => { finishOriginal = resolve; });
    const waiting = original.failureEvidence(); original.stats.captures[0].args[W + '/' + opId].hash = 'c'.repeat(64);
    original.stats.captures[0].journal.row.hash = 'c'.repeat(64); original.stats.captures[0].journal.row.opId = 'native_' + 'c'.repeat(32); original.uid = 'changed-owner';
    finishOriginal(clone(complete)); const immutable = await waiting;
    requireCheck('failure probe binds immutable updates and original uid hash opId before awaiting read', immutable.effects === 'ALL_ORIGINAL_EFFECTS_AND_BOUND_RECEIPT'
        && immutable.expectedPatchHash === all.expectedPatchHash);
    let finishOwnedRead, finishOwnedSdk;
    const ownedRead = new Promise(resolve => { finishOwnedRead = resolve; }), ownedSdk = new Promise(resolve => { finishOwnedSdk = resolve; });
    const namespace = { base: new URL('http://127.0.0.1:9000'), ns: 'demo-f03-purge-owned', owner: () => ownedRead };
    const owned = new NativeProvider({}, namespace, {}, { id: 'synthetic' }); namespace.active = owned;
    owned.stats.captures = [{ args: clone(updates), journal: { row: { opId, hash } } }];
    const rawPending = owned.track('database-update', () => ownedSdk);
    const ownedResult = await owned.failureEvidence(1);
    requireCheck('failure probe timeout keeps actual constructor-owned SDK and GET tasks tracked', ownedResult.status === 'UNAVAILABLE'
        && owned.tasks.size === 2 && [...owned.taskLabels.values()].includes('owner') && namespace.active === owned);
    finishOwnedRead(clone(complete)); await Promise.resolve(); await Promise.resolve();
    requireCheck('late GET cannot remove original pending SDK task or release its lease', owned.tasks.has(rawPending)
        && owned.taskLabels.get(rawPending) === 'database-update' && namespace.active === owned && ownedResult.status === 'UNAVAILABLE');
    finishOwnedSdk(); await rawPending; await owned.quiesce();

}
async function verifyReceiptAndFixtureOwnership() {
    const opId = 'native_' + 'a'.repeat(32), uid = 'f03-native-owner', hash = 'b'.repeat(64), binding = { opId, uid, hash };
    const updates = { 'synthetic/delete': null, [W + '/' + opId]: { uid, hash, at: { '.sv': 'timestamp' } } };
    const physical = { [W]: { [opId]: { uid, hash, at: 1790000000000 } } };
    const good = physicalWriteEvidence(updates, physical, binding);
    requireCheck('native resolved timestamp is observed while literal wire mismatch stays visible', good.effects === 'ALL_ORIGINAL_EFFECTS_AND_BOUND_RECEIPT'
        && good.matchedPaths === 1 && good.unmatchedPaths === 1 && good.semanticMatchedPaths === 2
        && good.originalEffects.totalPaths === 1 && good.originalEffects.matchedPaths === 1 && good.transportReceipt.status === 'MATCHED_RESOLVED_TIMESTAMP');
    for (const [name, receipt] of [
        ['wrong-uid', { ...physical[W][opId], uid: 'other' }], ['wrong-hash', { ...physical[W][opId], hash: 'c'.repeat(64) }],
        ['extra-field', { ...physical[W][opId], extra: true }],
        ...[0, -1, 1.5, '1790000000000', { '.sv': 'timestamp' }, 9007199254740992].map((at, index) => ['invalid-at-' + index, { ...physical[W][opId], at }])
    ]) {
        const bad = physicalWriteEvidence(updates, { [W]: { [opId]: receipt } }, binding);
        requireCheck('native transport receipt rejects ' + name, bad.effects === 'MIXED' && bad.transportReceipt.status === 'MISMATCH'
            && bad.originalEffects.matchedPaths === 1 && bad.semanticMatchedPaths === 1);
    }
    const moved = physicalWriteEvidence(updates, { [W]: { ['native_' + 'c'.repeat(32)]: physical[W][opId] } }, binding);
    requireCheck('native transport receipt binds original opId path and never borrows another holder', moved.transportReceipt.status === 'MISSING' && moved.effects !== 'ALL_ORIGINAL_EFFECTS_AND_BOUND_RECEIPT');
    for (const bad of [{ ...binding, opId: 'native_' + 'd'.repeat(32) }, { ...binding, uid: 'other' }, { ...binding, hash: 'd'.repeat(64) }]) {
        requireCheck('native captured transport binding must agree with immutable journal identity', physicalWriteEvidence(updates, physical, bad).status === 'UNAVAILABLE');
    }
    const changedEffect = { ...physical, synthetic: { delete: 'new-holder' } }, effect = physicalWriteEvidence(updates, changedEffect, binding);
    requireCheck('valid transport receipt cannot hide a mismatching original purge effect', effect.effects === 'MIXED'
        && effect.originalEffects.unmatchedPaths === 1 && effect.transportReceipt.status === 'MATCHED_RESOLVED_TIMESTAMP');
    const wrongMarker = clone(updates); wrongMarker[W + '/' + opId].at.extra = true;
    requireCheck('timestamp transform applies only to exact captured server marker', physicalWriteEvidence(wrongMarker, physical, binding).status === 'UNAVAILABLE');
    const client = { db: {}, sdk: {}, auth: {}, app: {} }, state = { db: client.db, fb: client.sdk, auth: client.auth,
        authGeneration: 7, infoListenerGeneration: 11, isDatabaseConnected: true, hasEverConnectedToDatabase: true };
    let timerCalls = 0, releaseProbe;
    state.reconnectWatchdogTimer = setTimeout(() => { timerCalls++; }, 2);
    state.infoListenerRecoveryTimer = setTimeout(() => { timerCalls++; }, 2);
    const probe = new Promise(resolve => { releaseProbe = resolve; }); state.dbLivenessProbe = probe;
    const trace = new NativeWireTrace(new URL('http://127.0.0.1:9000'), 'demo-f03-purge-owner');
    const returned = endNativeFixtureOwner({ firebaseState: state }, client, trace);
    requireCheck('owned fixture teardown invalidates auth and info owner before SDK deletion', state.authGeneration === 8 && state.infoListenerGeneration === 12
        && state.isDatabaseConnected === false && state.hasEverConnectedToDatabase === false && returned === probe);
    await pause(4);
    requireCheck('owned fixture teardown cancels only its reconnect timers without settling probe', timerCalls === 0
        && state.reconnectWatchdogTimer === null && state.infoListenerRecoveryTimer === null && state.dbLivenessProbe === probe);
    const foreign = { firebaseState: { ...state, authGeneration: 20, infoListenerGeneration: 30, db: {} } }, before = { ...foreign.firebaseState };
    requireCheck('fixture teardown cannot invalidate another database owner', endNativeFixtureOwner(foreign, client, trace) === null && equal(foreign.firebaseState, before));
    releaseProbe(null);
    for (const result of [true, false, { private: 'SECRET_RETURN' }, undefined]) {
        const namespace = { base: new URL('http://127.0.0.1:9000'), ns: 'demo-f03-purge-result' };
        const provider = new NativeProvider({ api: { purgeTrashWithRegistry: async () => result } }, namespace, {}, { id: 'synthetic' });
        const received = await provider.purge(), event = provider.trace.events.find(event => event.phase === 'public-purge-resolved');
        requireCheck('public purge diagnostic preserves exact result and redacts body', received === result && event.result === (result === true ? 'true' : result === false ? 'false' : 'other')
            && !JSON.stringify(provider.trace.summary()).includes('SECRET_RETURN'));
    }
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
function backendSnapshotEvidence(provider, ops, controlled, after, rejection, initialMoney) {
    const unavailable = () => ({ version: 1, status: 'UNAVAILABLE', reason: 'diagnostic-input-unavailable' });
    try {
        const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
        const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
        if (!provider || typeof provider.uid !== 'string' || !provider.uid || typeof provider.scope !== 'string' || !provider.scope
            || !Number.isSafeInteger(provider.stats?.backendAttempts) || provider.stats.backendAttempts < 0
            || !object(controlled) || !object(after) || !has(controlled, 'physical') || !has(after, 'physical')
            || !object(controlled.logical) || !object(after.logical) || !object(initialMoney) || !Array.isArray(ops) || !ops.length
            || ops.some(op => !object(op) || op.k !== 'set' || !has(op, 'v') || op.v === undefined || !Array.isArray(op.p)
                || !op.p.length || op.p.some(part => typeof part !== 'string' || !part))) return unavailable();
        const roots = [T, R, P, G, D, M];
        const valueAt = (image, parts) => parts.reduce((value, part) => value !== null && value !== undefined
            && has(value, part) ? value[part] : undefined, image);
        const pathEvidence = ops.map((op, index) => {
            const prior = valueAt(controlled.logical, op.p), actual = valueAt(after.logical, op.p);
            return { index, root: roots.includes(op.p[0]) ? op.p[0] : 'other', pathHash: digest(op.p.join('/')),
                beforePresent: prior !== null && prior !== undefined, afterPresent: actual !== null && actual !== undefined,
                beforeValueHash: digest(JSON.stringify(prior ?? null)), afterValueHash: digest(JSON.stringify(actual ?? null)),
                requestedValueHash: digest(JSON.stringify(op.v)), beforeRequestedEffectMatched: equal(prior ?? null, op.v),
                afterRequestedEffectMatched: equal(actual ?? null, op.v) };
        });
        const backendCode = typeof rejection?.code === 'string' ? rejection.code : '';
        return { version: 1, status: 'OBSERVED', operationCount: ops.length, patchHash: digest(JSON.stringify(updateOf(ops))),
            actorHash: digest(provider.uid), scopeHash: digest(provider.scope), backendAttempts: provider.stats.backendAttempts,
            rejectionTruthy: !!rejection, rejectionValueKind: rejection === null ? 'null' : typeof rejection,
            backendCode: ['PERMISSION_DENIED', 'permission_denied', '22023', '42501', 'PT409'].includes(backendCode) ? backendCode : backendCode ? 'other' : 'none',
            exactControlledSnapshotUnchanged: equal(after, controlled), moneyUnchanged: equal(moneyOf(after.logical), initialMoney),
            controlledPhysicalHash: digest(JSON.stringify(controlled.physical)), afterPhysicalHash: digest(JSON.stringify(after.physical)),
            everyRequestedEffectObserved: pathEvidence.every(entry => entry.afterRequestedEffectMatched), pathEvidence,
            roots: roots.map(root => ({ root, beforePresent: controlled.logical[root] !== null && controlled.logical[root] !== undefined,
                afterPresent: after.logical[root] !== null && after.logical[root] !== undefined,
                beforeCount: Object.keys(controlled.logical[root] ?? {}).length, afterCount: Object.keys(after.logical[root] ?? {}).length,
                beforeHash: digest(JSON.stringify(controlled.logical[root] ?? null)), afterHash: digest(JSON.stringify(after.logical[root] ?? null)),
                unchanged: equal(controlled.logical[root], after.logical[root]) })),
            meaning: 'Read-only snapshots of original raw packet; no durable operation receipt, completion, replay or public reachability inferred' };
    } catch (_) { return unavailable(); }
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
const GUARD_HISTORY = 'zoew_scan_history_cod_dod';
function guardFixture(scenario) {
    const row = source(2, 'f03_guard_' + scenario.vector.id.replace(/-/g, '_'));
    row.barcodes['0'].code = scenario.vector.code;
    row.barcodes['1'].code = 'F03_GUARD_NEIGHBOR';
    const seed = image(row), history = source(1, 'f03_guard_history');
    delete history.deletedAt; delete history.trashGeneration;
    seed[GUARD_HISTORY] = { [history.id]: history };
    if (scenario.mode === 'mismatch') seed[R][scenario.vector.badKey] = true;
    return { row, seed };
}
function guardProtected(provider, snapshot) {
    const roots = [GUARD_HISTORY, D, M];
    return provider.kind === 'native' ? Object.fromEntries(roots.map(root => [root, snapshot.physical?.[root] ?? null]))
        : snapshot.physical.docs.filter(doc => roots.includes(doc.root));
}
async function runGuardCase(provider, scenario) {
    const before = await provider.snapshot(), protectedBefore = guardProtected(provider, before);
    const ops = packet(provider.row, { uid: provider.uid, scope: provider.scope });
    const check = (label, condition, detail) => {
        if (!GUARD_FAMILY[scenario.mode].includes(label)) throw new Error('Unknown guard assertion ID ' + label);
        guardCheck(label, condition, detail);
    };
    check('seed-proven', ops.length === 6 && provider.row.barcodes['0'].code === scenario.vector.code
        && ops[2].p[1] === scenario.vector.key && ops[3].v.registryKey === scenario.vector.key
        && guardOracle(provider.row.barcodes['0'].code) === scenario.vector.key
        && before.logical[R][scenario.vector.key] === true && before.logical[R].F03_GUARD_NEIGHBOR === true
        && (scenario.mode === 'matching' || before.logical[R][scenario.vector.badKey] === true)
        && Object.keys(before.logical[T]).length === 1 && Object.keys(before.logical[P]).length === 0 && Object.keys(before.logical[G]).length === 0
        && moneyOf(before.logical)[D][DAY].codDollar === 37 && moneyOf(before.logical)[M][MONTH].totalCount === 11
        && (provider.kind === 'native' ? !!protectedBefore[GUARD_HISTORY]?.f03_guard_history : protectedBefore.some(doc => doc.root === GUARD_HISTORY)));
    if (scenario.mode === 'mismatch') { ops[2].p[1] = scenario.vector.badKey; ops[3].v.registryKey = scenario.vector.badKey; }
    const originalOps = clone(ops), patchHash = digest(JSON.stringify(updateOf(originalOps)));
    const response = await bounded(provider.rawBackend(ops), 'guard raw authenticated backend').then(value => ({ fulfilled: true, value, rejection: null }), rejection => ({ fulfilled: false, value: null, rejection }));
    if (provider.kind === 'native' && !response.fulfilled && !/permission[_-]denied/i.test(String(response.rejection?.code || ''))) provider.namespace.uncertain = true;
    const after = await provider.snapshot(), backendCode = String(response.rejection?.code || '');
    const evidence = backendSnapshotEvidence(provider, originalOps, before, after, response.rejection, moneyOf(before.logical));
    provider.guardEvidence = evidence;
    provider.guardOutcome = { backendCode, backendFulfilled: response.fulfilled, rejectionValueKind: response.rejection === null ? 'null' : typeof response.rejection,
        patchHash, operationCount: originalOps.length,
        protectedBeforeHash: digest(JSON.stringify(protectedBefore)), protectedAfterHash: digest(JSON.stringify(guardProtected(provider, after))) };
    const nativeAcks = provider.kind === 'native' ? provider.trace.events.filter(event => event.phase === 'merge-ack-observed' && event.patchHash === patchHash) : [];
    check('backend-attempt-reached', provider.stats.backendAttempts === 1 && (provider.kind !== 'native'
        || nativeAcks.length === 1 && ['ok', 'permission_denied'].includes(nativeAcks[0].status)),
    { backendCode, nativeAckCount: nativeAcks.length });
    if (scenario.mode === 'matching') {
        check('backend-accepted', response.fulfilled === true && (provider.kind === 'native'
            || response.value?.ok === true && response.value?.purge?.outcome === 'applied' && !response.value?.replayed), { backendCode });
        check('all-original-effects', evidence.status === 'OBSERVED' && evidence.everyRequestedEffectObserved
            && Object.keys(after.logical[T]).length === 0 && Object.keys(after.logical[R]).length === 0
            && Object.keys(after.logical[P]).length === 2 && Object.keys(after.logical[G]).length === 1);
        check('all-receipt-members', originalOps.filter(op => op.p[0] === P).every(op => equal(after.logical[P][op.p[1]], op.v)
            && guardOracle(op.v.code) === op.v.registryKey) && after.logical[P][originalOps[3].p[1]].code === scenario.vector.code);
    } else {
        check('backend-typed-denial', response.fulfilled === false && (provider.kind === 'native' ? /permission[_-]denied/i.test(backendCode)
            : ['22023', '42501', 'PT409'].includes(backendCode)), { backendCode });
        check('exact-zero-effects', equal(after, before) && evidence.status === 'OBSERVED' && evidence.exactControlledSnapshotUnchanged);
    }
    check('money-history-unchanged', equal(guardProtected(provider, after), protectedBefore));
    check('raw-bypassed-preflight', provider.stats.executeRequests === 0 && provider.stats.captures.length === 0 && journalRows().length === 0);
    return { logical: logicalForComparison(after.logical) };
}
async function runGuardVectors(runtime, sql, origin) {
    const namespace = new NativeNamespace(origin);
    try {
        await namespace.start(); guardEngineStarted = true;
        for (const scenario of GUARD_CASES) {
            const comparisons = [];
            for (const providerName of ['native', 'supabase']) {
                if (journalRows().length || namespace.uncertain || namespace.active || namespace.requests.size) throw new Error('Guard fresh fixture refused retained intent or uncertain owner');
                window.localStorage.clear(); window.sessionStorage.clear(); runtime.api.firebaseState.authGeneration++;
                const { row, seed } = guardFixture(scenario);
                const provider = providerName === 'native' ? new NativeProvider(runtime, namespace, scenario, row) : new SupabaseProvider(runtime, sql, scenario, row);
                activeCase = { id: scenario.id, provider: providerName };
                const start = guardChecks.length, inputFingerprint = digest(JSON.stringify(seed));
                let value = null, error = null, cleaned = false;
                try { await provider.setup(seed); value = await runGuardCase(provider, scenario); }
                catch (failure) { error = String(failure?.stack || failure); console.error(error); }
                finally {
                    try { await bounded(provider.close(), 'close guard fixture client'); cleaned = true; }
                    catch (failure) { if (providerName === 'native') namespace.uncertain = true; error ||= String(failure?.stack || failure); }
                }
                const checks = guardChecks.slice(start), expected = GUARD_FAMILY[scenario.mode];
                const coherent = !error && cleaned && checks.length === expected.length
                    && expected.every(label => checks.filter(check => check.label === label && check.pass).length === 1);
                guardResults.push({ id: scenario.id, vectorId: scenario.vector.id, mode: scenario.mode, provider: providerName, inputFingerprint,
                    pass: coherent, assertions: checks, cleanup: cleaned, error, rawBackendEvidence: provider.guardEvidence ?? null, ...provider.guardOutcome, ...value,
                    ...(providerName === 'native' ? { resources: provider.resourceReport(), diagnostic: provider.trace.summary() } : {}) });
                activeCase = null;
                if (!coherent) throw new Error('Guard case incomplete; aborting without another backend intent: ' + providerName + ':' + scenario.id);
                comparisons.push(value.logical);
            }
            guardCheck('matched-provider-state:' + scenario.id, equal(comparisons[0], comparisons[1]), undefined, true);
        }
        guardCheck('all-guard-case-provider-assertion-IDs-executed-once', guardResults.length === GUARD_EXPECTED.length
            && GUARD_EXPECTED.every(expected => guardResults.filter(row => row.id === expected.id && row.provider === expected.provider && row.pass).length === 1)
            && guardChecks.length === GUARD_EXPECTED.reduce((sum, entry) => sum + entry.assertions.length, 0), undefined, true);
    } finally {
        try { await bounded(namespace.close(), 'close guard native namespace'); }
        finally { guardNativeResources = namespace.resourceReport(); }
    }
    guardCheck('guard-native-namespace-quiescent-empty-and-closed', guardNativeResources?.canonicalLoads === 1 && guardNativeResources.cleanupRuleWrites === 1
        && guardNativeResources.beforeEmpty === GUARD_CASES.length && guardNativeResources.afterEmpty === GUARD_CASES.length
        && guardNativeResources.closed === true && guardNativeResources.active === false && guardNativeResources.uncertain === false && guardNativeResources.pendingRequests === 0, undefined, true);
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
        const diagnosticOps = clone(ops);
        const rejection = await bounded(provider.rawBackend(ops), 'raw authenticated backend negative').then(() => null, error => error);
        const after = await provider.snapshot();
        const backendCode = String(rejection?.code || '');
        provider.rawBackendEvidence = backendSnapshotEvidence(provider, diagnosticOps, controlled, after, rejection, initialMoney);
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
async function verifyBoundedDeadline() {
    let timedOut = false;
    try {
        await bounded(Promise.resolve().then(() => {
            const end = process.hrtime.bigint() + 12000000n;
            while (process.hrtime.bigint() < end) {}
            return true;
        }), 'blocked microtask proof', 2);
    } catch (error) { timedOut = error?.message === 'Timed out: blocked microtask proof'; }
    requireCheck('bounded rejects overdue blocked microtask even if its promise wins the race', timedOut);
    const value = {};
    requireCheck('bounded preserves fast resolved value identity', await bounded(Promise.resolve(value), 'fast identity', 1000) === value);
    const original = new TypeError('synthetic original rejection');
    const received = await bounded(Promise.reject(original), 'rejection identity', 1000).catch(error => error);
    requireCheck('bounded preserves original rejection identity', received === original);
    const late = pause(5); let rejected = false;
    try { await bounded(late, 'original timer failure', 1); } catch (error) { rejected = error?.message === 'Timed out: original timer failure'; }
    await late;
    requireCheck('bounded retains timer failure after original promise later settles', rejected);
}
function controlledTimingProofReady(row) {
    const expected = 2 + 2 * row.count, proof = row.evidence;
    return TIMING_COUNTS.includes(row.count) && row.workSettled === true && row.acknowledged === true
        && row.fullOriginalJournal === true && row.originalEffectsExact === true && row.releaseMembersExact === true
        && row.nonemptySentinels === true && row.moneyHistoryUnchanged === true && row.journalCompleted === true
        && proof?.status === 'OBSERVED' && proof.effects === 'ALL_ORIGINAL_EFFECTS_AND_BOUND_RECEIPT'
        && proof.totalPaths === expected + 1 && proof.originalEffects.totalPaths === expected
        && proof.originalEffects.matchedPaths === expected && proof.originalEffects.unmatchedPaths === 0
        && proof.transportReceipt.status === 'MATCHED_RESOLVED_TIMESTAMP' && proof.transportReceipt.exactShape === true
        && proof.transportReceipt.uidHashBound === true && proof.transportReceipt.timestampResolved === true && proof.transportReceipt.originalOpIdBound === true;
}
function controlledTimingCanContinue(row) {
    const resource = row.resources;
    return controlledTimingProofReady(row) && row.phaseWithinBudget === true && row.cleanup === true && row.rootEmpty === true && row.connections > 0 && row.closedSockets === row.connections
        && resource?.pending === 0 && resource.started > 0 && resource.started === resource.settled && resource.activeApp === false && resource.pendingApp === false
        && resource.active === false && resource.uncertain === false && resource.pendingRequests === 0;
}
function controlledTimingOutcome(row) {
    const canContinue = controlledTimingCanContinue(row), pass = canContinue && row.latencyPass === true;
    return { canContinue, pass, status: canContinue ? pass ? 'PASS' : 'LATENCY_FAIL_CORRECTNESS_PROVEN' : 'HOLD_ABORT' };
}
function controlledTimingOverallFailed(rows, existingFailure) {
    return !!existingFailure || rows.length !== TIMING_COUNTS.length
        || TIMING_COUNTS.some(count => rows.filter(row => row.count === count && row.pass === true).length !== 1);
}
function verifyControlledTimingGates() {
    const good = count => ({ count, workSettled: true, acknowledged: true, fullOriginalJournal: true, originalEffectsExact: true,
        releaseMembersExact: true, nonemptySentinels: true, moneyHistoryUnchanged: true, journalCompleted: true, latencyPass: true,
        evidence: { status: 'OBSERVED', effects: 'ALL_ORIGINAL_EFFECTS_AND_BOUND_RECEIPT', totalPaths: 3 + 2 * count,
            originalEffects: { totalPaths: 2 + 2 * count, matchedPaths: 2 + 2 * count, unmatchedPaths: 0 },
            transportReceipt: { status: 'MATCHED_RESOLVED_TIMESTAMP', exactShape: true, uidHashBound: true, timestampResolved: true, originalOpIdBound: true } },
        phaseWithinBudget: true, cleanup: true, rootEmpty: true, connections: 1, closedSockets: 1,
        resources: { pending: 0, started: 10, settled: 10, activeApp: false, pendingApp: false, active: false, uncertain: false, pendingRequests: 0 } });
    for (const count of TIMING_COUNTS) requireCheck('controlled N=' + count + ' needs complete original evidence and quiescence', controlledTimingCanContinue(good(count)));
    for (const key of ['workSettled', 'acknowledged', 'fullOriginalJournal', 'originalEffectsExact', 'releaseMembersExact', 'nonemptySentinels', 'moneyHistoryUnchanged', 'journalCompleted', 'phaseWithinBudget', 'cleanup', 'rootEmpty']) {
        const bad = good(250); bad[key] = false;
        requireCheck('controlled continuation refuses missing ' + key, !controlledTimingCanContinue(bad));
    }
    for (const [key, value] of [['pending', 1], ['started', 0], ['settled', 9], ['activeApp', true], ['pendingApp', true], ['active', true], ['uncertain', true], ['pendingRequests', 1]]) {
        const bad = good(250); bad.resources[key] = value;
        requireCheck('controlled continuation refuses resource ' + key, !controlledTimingCanContinue(bad));
    }
    const socket = good(250); socket.closedSockets = 0;
    const empty = good(250); empty.connections = 0; empty.closedSockets = 0;
    requireCheck('controlled continuation refuses unclosed or unobserved sockets', !controlledTimingCanContinue(socket) && !controlledTimingCanContinue(empty));
    const effect = good(250); effect.evidence.originalEffects.matchedPaths--;
    const receipt = good(250); receipt.evidence.transportReceipt.uidHashBound = false;
    const missing = good(250); missing.evidence.effects = 'MIXED';
    requireCheck('controlled continuation cannot project away effect or receipt mismatches', !controlledTimingCanContinue(effect) && !controlledTimingCanContinue(receipt) && !controlledTimingCanContinue(missing));
    const late = good(250); late.latencyPass = false; Object.assign(late, controlledTimingOutcome(late));
    requireCheck('late same-original proof can release isolated fixture without converting deadline FAIL', late.canContinue && !late.pass && late.status === 'LATENCY_FAIL_CORRECTNESS_PROVEN');
    const healthy = TIMING_COUNTS.map(count => Object.assign(good(count), controlledTimingOutcome(good(count))));
    requireCheck('controlled deadline failure remains overall failure even if all original case assertions pass', !controlledTimingOverallFailed(healthy, 0)
        && controlledTimingOverallFailed([healthy[0], late, healthy[2]], 0) && controlledTimingOverallFailed(healthy, 1));
    requireCheck('controlled unrun or duplicate target cannot produce overall PASS', controlledTimingOverallFailed(healthy.slice(0, 2), 0)
        && controlledTimingOverallFailed([healthy[0], healthy[0], healthy[2]], 0));
    const emptyOwner = { active: false, uncertain: false, pendingRequests: 0 };
    requireCheck('controlled fresh fixture refuses retained or malformed journal before clearing storage', controlledTimingFreshState([], emptyOwner)
        && !controlledTimingFreshState([{ originalPending: true }], emptyOwner) && !controlledTimingFreshState(null, emptyOwner));
    requireCheck('controlled fresh fixture refuses active uncertain or pending owner', !controlledTimingFreshState([], { ...emptyOwner, active: true })
        && !controlledTimingFreshState([], { ...emptyOwner, uncertain: true }) && !controlledTimingFreshState([], { ...emptyOwner, pendingRequests: 1 }));
    requireCheck('controlled measured deadline rejects overdue work even when Promise.race wins', !controlledDeadlinePass(true, WAIT_MS + 1, WAIT_MS + 1)
        && !controlledDeadlinePass(true, WAIT_MS, WAIT_MS + 1) && controlledDeadlinePass(true, WAIT_MS, WAIT_MS));
    requireCheck('controlled timer failure never becomes PASS from later fast measurement', !controlledDeadlinePass(false, 1, 1)
        && !controlledDeadlinePass(undefined, 1, 1) && !controlledDeadlinePass(true, NaN, 1));
    requireCheck('controlled phase is separate from unchanged main manifest and bounded90s', TIMING_PHASE_MS === 90000 && WAIT_MS === 15000
        && TIMING_COUNTS.length === 3 && [...TIMING_COUNTS].sort().join(',') === '249,250,251' && CASES.length === 20 && EXPECTED.length === 40);
    requireCheck('owned diagnostic orders contain every original target exactly once', timingOrder(undefined).join(',') === '249,250,251'
        && timingOrder('251,249,250').join(',') === '251,249,250');
    for (const invalid of ['', '249,250', '249,250,250', '250,249,251', '251,249,250,1']) {
        let refused = false; try { timingOrder(invalid); } catch (_) { refused = true; }
        requireCheck('owned diagnostic order refuses ' + JSON.stringify(invalid), refused);
    }
    requireCheck('failure metadata whitelists codes without disclosing error text', equal(failureMetadata({ code: 'INTERNAL_ERROR', message: 'SECRET' }), { code: 'INTERNAL_ERROR', txOutcome: 'unclassified' })
        && !JSON.stringify(failureMetadata({ code: 'SECRET', txOutcome: 'SECRET', message: 'SECRET' })).includes('SECRET'));
}
function controlledTimingFreshState(rows, resource) {
    return Array.isArray(rows) && rows.length === 0 && resource?.active === false && resource.uncertain === false && resource.pendingRequests === 0;
}
function controlledMonotonicMs() { return Number(process.hrtime.bigint()) / 1e6; }
function controlledDeadlinePass(raceFulfilled, settledMs, observedMs) {
    return raceFulfilled === true && Number.isFinite(settledMs) && Number.isFinite(observedMs) && settledMs >= 0 && observedMs >= 0
        && settledMs <= WAIT_MS && observedMs <= WAIT_MS;
}
async function runControlledTimings(runtime, namespace) {
    const phaseStarted = controlledMonotonicMs(), deadline = phaseStarted + TIMING_PHASE_MS;
    const budget = (maximum = WAIT_MS, cleanup = false) => {
        const remaining = deadline - controlledMonotonicMs() - (cleanup ? 0 : WAIT_MS);
        if (remaining <= 0) throw new Error('CONTROLLED_PHASE_BUDGET');
        return Math.min(maximum, remaining);
    };
    const blockRemaining = reason => {
        for (const count of TIMING_COUNTS) if (!timingResults.some(row => row.count === count)) timingResults.push({ count, executed: false, status: 'UNRUN_BLOCKED', runtimeBlocker: reason });
        report('CONTROLLED_TIMING_BLOCKED_INCOMPLETE', { nativeRuntime: 'INCOMPLETE', supabaseRuntime: 'INCOMPLETE' });
    };
    for (const count of TIMING_COUNTS) {
        if (deadline - controlledMonotonicMs() < 2 * WAIT_MS) { blockRemaining('controlled90s-phase-budget-before-new-intent'); ok('controlled timing all three targets admitted within phase budget', false); break; }
        let fresh = false;
        try { fresh = controlledTimingFreshState(journalRows(), namespace.resourceReport()); } catch (_) {}
        if (!fresh) { blockRemaining('original-journal-or-owner-evidence-present-before-fresh-fixture'); throw new Error('Controlled timing cannot clear retained evidence'); }
        window.localStorage.clear(); window.sessionStorage.clear(); runtime.api.firebaseState.authGeneration++;
        const sourceRow = source(count, 'timing' + count), seed = image(sourceRow);
        const history = 'zoew_scan_history_cod_dod';
        seed[history] = { timingSentinel: { id: 'timingSentinel', count: 1, cod: 37, dod: 5, isClosed: true,
            createdAt: 1700000000000, scanDate: DAY, barcodes: [{ code: 'TIMING_KEEP', cod: 37, dod: 5, isClosed: true, createdAt: 1700000000000 }] } };
        const provider = new NativeProvider(runtime, namespace, { count, id: 'controlled-' + count }, sourceRow);
        const row = { count, executed: true, wallStartedUtc: new Date().toISOString(), scope: 'nativeRecovery atomic update, not public purge end-to-end',
            freshness: 'new source/app and authoritative empty root; shared Node process/JVM/rules graph', latencyDeadlineMs: WAIT_MS,
            workSettled: false, cleanup: false, rootEmpty: false, status: 'INCOMPLETE' };
        timingResults.push(row); let work = null, failure = null;
        try {
            const setupBudget = budget(TIMING_PHASE_MS);
            await bounded(provider.setup(seed), 'controlled setup ' + count, setupBudget);
            if (deadline - controlledMonotonicMs() < 2 * WAIT_MS) throw new Error('CONTROLLED_PHASE_BUDGET_BEFORE_DISPATCH');
            const operations = packet(sourceRow, { uid: provider.uid, scope: provider.scope }), operationBudget = WAIT_MS, started = controlledMonotonicMs();
            provider.trace.note('controlled-atomic-start', { count });
            work = provider.track('controlled-original-update', () => provider.client.sdk.update(provider.client.sdk.ref(provider.client.db), updateOf(operations)));
            work.then(() => { row.workSettled = true; row.settlementMs = controlledMonotonicMs() - started; }, error => { row.workSettled = true; row.writeRejected = true; row.writeFailure = failureMetadata(error); row.settlementMs = controlledMonotonicMs() - started; });
            try { await bounded(work, 'controlled atomic15s ' + count, operationBudget); row.raceFulfilled = true; }
            catch (error) { row.raceFulfilled = false; row.latencyFailure = String(error?.message || '').startsWith('Timed out: controlled atomic15s') ? 'deadline' : 'write-rejected-or-unknown'; provider.trace.note('controlled15s-failed', { reason: row.latencyFailure }); }
            row.latencyObservedMs = controlledMonotonicMs() - started;
            row.latencyPass = controlledDeadlinePass(row.raceFulfilled, row.settlementMs, row.latencyObservedMs);
            if (row.raceFulfilled && !row.latencyPass) row.latencyFailure = 'measured-deadline';
            ok('controlled atomic15s deadline N=' + count, row.latencyPass === true);
            if (!row.workSettled) {
                const observationBudget = budget();
                await bounded(Promise.resolve(work).catch(() => {}), 'controlled same-original settlement ' + count, observationBudget);
            }
            if (row.writeRejected) {
                const failureReadBudget = budget();
                row.failureReadback = await provider.failureEvidence(failureReadBudget, true);
                throw new Error('CONTROLLED_ORIGINAL_WRITE_REJECTED');
            }
            const recoveryBudget = budget();
            await bounded(provider.track('controlled-recovery-settlement', () => provider.settle()), 'controlled recovery settlement ' + count, recoveryBudget);
            const capture = provider.stats.captures[0], binding = Object.freeze({ opId: capture?.journal?.row?.opId, uid: provider.uid, hash: capture?.journal?.row?.hash });
            if (!capture || provider.stats.captures.length !== 1) throw new Error('CONTROLLED_ORIGINAL_CAPTURE');
            const readBudget = budget();
            const physical = await bounded(provider.owner(), 'controlled physical proof ' + count, readBudget);
            row.evidence = physicalWriteEvidence(capture.args, physical, binding);
            const journalBudget = budget();
            row.fullOriginalJournal = await bounded(provider.track('controlled-original-journal-proof', () => fullJournalValid(runtime.api, provider, capture.journal)), 'controlled original journal proof ' + count, journalBudget);
            const logical = projected(physical);
            row.originalEffectsExact = originalEffectsMatch(provider, capture.journal, logical);
            row.releaseMembersExact = fullMembersMatch(runtime.api, provider, capture.journal, logical);
            row.nonemptySentinels = seed[D][DAY].codDollar === 37 && seed[M][MONTH].totalCount === 11 && Object.keys(seed[history]).length === 1;
            row.moneyHistoryUnchanged = equal(physical?.[D], seed[D]) && equal(physical?.[M], seed[M]) && equal(physical?.[history], seed[history]);
            const recovery = provider.recovery();
            row.journalCompleted = !originalJournal(sourceRow.id) && journalRows().length === 0 && !recovery.blocked && !recovery.recovering && !recovery.deferred;
            const patchHash = digest(JSON.stringify(capture.args));
            row.acknowledged = provider.stats.commits === 1 && provider.stats.executeRequests === 1
                && provider.trace.events.some(event => event.phase === 'merge-ack-observed' && event.status === 'ok' && event.patchHash === patchHash)
                && provider.trace.events.some(event => event.phase === 'raw-sdk-update-resolved');
            if (!controlledTimingProofReady(row)) throw new Error('CONTROLLED_PROOF_INCOMPLETE');
        } catch (error) {
            failure = String(error?.message || '').startsWith('CONTROLLED_PHASE_BUDGET') ? 'controlled90s-phase-budget' : 'original-proof-or-runtime-unavailable';
            row.runtimeBlocker = failure;
            if (work && !controlledTimingProofReady(row)) namespace.uncertain = true;
        } finally {
            const remainingForCleanup = deadline - controlledMonotonicMs();
            if (remainingForCleanup <= 0) {
                namespace.uncertain = true; provider.closing = true;
                row.runtimeBlocker = 'controlled90s-budget-exhausted-before-cleanup'; row.emergencyOwnerStop = true;
                const stopBudget = 1;
                try { await bounded(provider.closeClient(), 'controlled emergency owned SDK stop ' + count, stopBudget); }
                catch (_) { row.emergencyStopUncertain = true; }
            } else {
                const cleanupBudget = Math.min(WAIT_MS, remainingForCleanup);
                try { await bounded(provider.close(), 'controlled cleanup ' + count, cleanupBudget); row.cleanup = true; }
                catch (_) { namespace.uncertain = true; row.runtimeBlocker ||= 'original-tasks-or-cleanup-not-quiescent'; }
            }
            row.phaseElapsedMs = controlledMonotonicMs() - phaseStarted;
            row.phaseWithinBudget = row.phaseElapsedMs <= TIMING_PHASE_MS;
            if (!row.phaseWithinBudget) { namespace.uncertain = true; row.runtimeBlocker ||= 'controlled90s-phase-deadline'; }
            row.resources = provider.resourceReport(); row.connections = provider.trace.connections;
            row.closedSockets = provider.trace.sockets.filter(socket => socket.closed).length;
            row.rootEmpty = row.cleanup && namespace.active === null && namespace.afterEmpty === namespace.beforeEmpty;
            row.trace = provider.trace.summary();
            Object.assign(row, controlledTimingOutcome(row));
            report('CONTROLLED_TIMING_PARTIAL_INCOMPLETE', { nativeRuntime: 'INCOMPLETE', supabaseRuntime: 'INCOMPLETE' });
        }
        if (!row.canContinue) { blockRemaining(row.runtimeBlocker || 'original-proof-or-quiescence-incomplete'); throw new Error('Controlled timing HOLD; aborting before another intent'); }
    }
}
async function main() {
    if (FIXTURES_ONLY && STRICT) throw new Error('fixtures-only cannot satisfy CI STRICT');
    verifyConstruction(); verifyNativeTrace(); await verifyFailureEvidence(); await verifyReceiptAndFixtureOwnership(); await verifyBoundedDeadline(); verifyControlledTimingGates();
    verifyGuardConstruction();
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
        await runControlledTimings(runtime, native);
        for (const scenario of CASES) {
            const comparisons = [];
            for (const providerName of ['native', 'supabase']) {
                window.localStorage.clear(); window.sessionStorage.clear(); runtime.api.firebaseState.authGeneration++;
                const row = source(scenario.count, scenario.family === 'positive' ? 'matched_' + scenario.count : 'f03_' + scenario.id.replace(/-/g, '_'), scenario);
                const provider = providerName === 'native' ? new NativeProvider(runtime, native, scenario, row) : new SupabaseProvider(runtime, sql, scenario, row);
                activeCase = { id: scenario.id, provider: providerName };
                const start = activeChecks.length;
                const inputFingerprint = digest(JSON.stringify(image(row)));
                let value = null, error = null, cleaned = false, failureReadback = null;
                try { await provider.setup(image(row)); value = await runCase(runtime, provider, scenario); }
                catch (failure) {
                    if (providerName === 'native') provider.trace.note('case-failed', { timedOut: String(failure?.message).startsWith('Timed out:') });
                    error = String(failure?.stack || failure); console.error(error);
                    if (providerName === 'native') failureReadback = await provider.failureEvidence();
                }
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
                    ...(provider.rawBackendEvidence ? { rawBackendEvidence: provider.rawBackendEvidence } : {}),
                    ...(providerName === 'native' ? { resources: provider.resourceReport(), diagnostic: provider.trace.summary(), failureReadback } : {}), ...value });
                if (!cleaned) throw new Error('Client cleanup failed; aborting before another provider can reuse globals');
                if (failureReadback?.attempted) throw new Error('Original native pending-write failure retained; aborting after read-only evidence');
                comparisons.push(value?.logical ?? null);
                activeCase = null;
            }
            requireCheck('matched logical state ' + scenario.id, comparisons.every(Boolean) && equal(comparisons[0], comparisons[1]));
        }
        requireCheck('all expected case/provider IDs executed exactly once', results.length === EXPECTED.length
            && EXPECTED.every(expected => results.filter(result => result.id === expected.id && result.provider === expected.provider && result.pass).length === 1));
        await runGuardVectors(runtime, sql, origin);
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
    requireCheck('all three controlled timing targets completed correctness and quiescence', timingResults.length === TIMING_COUNTS.length
        && TIMING_COUNTS.every(count => timingResults.filter(row => row.count === count && row.executed && row.canContinue).length === 1));
    requireCheck('owned native namespace quiescent and empty across all cases', nativeResources?.canonicalLoads === 1
        && nativeResources.cleanupRuleWrites === 1 && nativeResources.beforeEmpty === CASES.length + TIMING_COUNTS.length && nativeResources.afterEmpty === CASES.length + TIMING_COUNTS.length
        && nativeResources.closed === true && nativeResources.active === false && nativeResources.uncertain === false && nativeResources.pendingRequests === 0);
    const overallFailed = controlledTimingOverallFailed(timingResults, fail);
    report(overallFailed ? 'FAIL' : 'PASS', { nativeRuntime: 'EXECUTED', supabaseRuntime: 'EXECUTED', infrastructureCleanup: 'complete',
        semantics: 'Already-trashed synthetic groups; nonempty money sentinels unchanged, not complete public financial lifecycle proof',
        providerDifferences: ['Actor/tenant/scope/op IDs and journal hash protocols differ', 'Native adds one operation receipt; SQL adds typed op cache/seq/accounting',
            'Controller commits are before backend admission; SQL93driver separately proves transaction lock interleavings',
            '4MiB representations are layered; wrapper byte rejection is not native engine size acceptance proof',
            'Only known barcode array/object containers are projected to keyed slots for comparison; original codes, keys, numbers and per-provider snapshots stay exact'] });
    process.exitCode = overallFailed ? 1 : 0;
}
main().catch(error => { console.error(error.stack || error); report('FAIL', { infrastructureError: String(error?.message || error), nativeRuntime: engineStarted ? 'INCOMPLETE' : 'UNRUN' }); process.exitCode = 1; });
