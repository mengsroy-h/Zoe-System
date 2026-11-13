import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parse } from 'acorn';
import { transformSync } from 'esbuild';
import { getZoneDateKey } from '../../../ZoeW/src/core/timezone';
import { commitNow } from '../../../ZoeW/src/app/flush';
import { withTransactionOutcomeResolution } from '../../../ZoeW/src/services/tx-outcome';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../../../ZoeW/src/core/state';
import * as clock from '../../../ZoeW/src/core/clock';
import { sessionUserActionAllowed } from '../../../ZoeW/src/core/session-verification';
import { attachInfoListeners, detachInfoListeners } from '../../../ZoeW/src/services/connection';
import { initDatabaseListeners, detachDatabaseListeners, resetDbListenerHealthState } from '../../../ZoeW/src/services/db-listeners';
import { clearRememberedSession, runSessionExpiryCheck } from '../../../ZoeW/src/features/session';
import { filterDataByDate, filterDataByCustomDate, getFilteredDataByDate } from '../../../ZoeW/src/ui/more-menu';
import { clearHistory, resetClearHistoryOperationState } from '../../../ZoeW/src/features/clear-history';
import { cleanupInFlight, cleanupJournalLive, runAutomaticCleanupRules } from '../../../ZoeW/src/domain/cleanup';
import { refTo } from '../../../ZoeW/src/app/refs';

// វាស់ module ម្ចាស់ និង setup ពិតរបស់ checker។ មិនមែន browser ឬ backend ពិត។
const ROOT = path.resolve(process.env.BROWSER_SCENARIO_ROOT || '..');
const NOW = Date.UTC(2026, 10, 9, 2, 30), DAY = '2026-11-09';
const HOST = 'https://fake-default-rtdb.firebaseio.com';
const w = window as any;
let trace: any[];
let readinessDelay: number;
const turn = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
function parsed(file: string) {
    const name = path.join(ROOT, 'audit-tools', file), source = readFileSync(name, 'utf8');
    const tree: any = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    return { name, source, tree };
}
function declaration(file: string, name: string) {
    const p = parsed(file);
    const node = p.tree.body.flatMap((n: any) => n.declarations || []).find((n: any) => n.id.name === name);
    expect(node, file + ':' + name).toBeDefined();
    return new Function('require', 'return ' + p.source.slice(node.init.start, node.init.end))(createRequire(p.name));
}
function block(file: string, marker: string, includeFinally = false) {
    const { tree, source } = parsed(file); const blocks: any[] = [];
    function visit(node: any) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'BlockStatement' && source.slice(node.start, node.end).includes(marker)
            && (!includeFinally || node.body.some((entry: any) => entry.type === 'TryStatement'))) blocks.push(node);
        for (const val of Object.values(node)) if (Array.isArray(val)) val.forEach(visit); else if (val && typeof val === 'object') visit(val);
    }
    visit(tree); blocks.sort((a, b) => a.end - a.start - (b.end - b.start));
    expect(blocks.length).toBeGreaterThan(0);
    return source.slice(blocks[0].start + 1, blocks[0].end - 1);
}
function seed() {
    return { _dateKey: DAY,
        zoew_scan_history_cod_dod: {}, zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [DAY]: { codDollar: 1.5, dodDollar: 0, totalCount: 1 } },
        zoew_monthly_revenue_cod_dod: { [DAY.slice(0, 7)]: { codDollar: 1.5, dodDollar: 0, totalCount: 1 } },
        zoew_daily_pickup_cod_dod: {}, zoew_barcode_registry: {}, zoew_settings: { exchange_rate: 4100 } };
}
async function bootSource(file: string, data: any, options?: any, owned = false) {
    declaration(file, file === 'ui-flow-test.js' ? 'FAKE_SDK' : 'BOOT')(data, options);
    new Function(declaration(file, 'LICENSE_STUB'))();
    let sdk = w.firebaseSDK;
    for (const method of ['runTransaction', 'update', 'set']) {
        const original = sdk[method];
        sdk[method] = (...args: any[]) => { trace.push({ method, path: args[0].path, fault: w.__failTrashWrite === true }); return original(...args); };
    }
    if (owned) sdk = withTransactionOutcomeResolution(sdk);
    const config = { databaseURL: HOST, apiKey: 'k', projectId: 'p' };
    localStorage.setItem('zoew_firebase_config', JSON.stringify(config));
    const app = sdk.initializeApp(config);
    Object.assign(firebaseState, { firebaseConfig: config, fb: sdk, db: sdk.getDatabase(app), auth: sdk.getAuth(app),
        isInitializingFirebase: false, isDatabaseInitialized: true, sessionExpiryCheck: 'unverified', sessionExpiryCheckInFlight: false });
    for (const [field, value] of Object.entries({ dbRefHistory: 'zoew_scan_history_cod_dod', dbRefDeleted: 'zoew_recently_deleted_cod_dod',
        dbRefDailyRevenue: 'zoew_daily_revenue_cod_dod', dbRefMonthlyRevenue: 'zoew_monthly_revenue_cod_dod',
        dbRefDailyPickup: 'zoew_daily_pickup_cod_dod', dbRefDailyCollected: 'zoew_daily_collected_cod_dod',
        dbRefExchangeRate: 'zoew_settings/exchange_rate', dbRefConnected: '.info/connected', dbRefServerTimeOffset: '.info/serverTimeOffset',
        dbRefZtoTrashMode: 'zoew_settings/zto_trash_mode' })) (firebaseState as any)[field] = sdk.ref(firebaseState.db, value);
    await w.ZoeLicense.syncServerTime(); attachInfoListeners(); await vi.advanceTimersByTimeAsync(1); await turn(); await runSessionExpiryCheck();
    expect(clock.serverClockIsTrustworthy()).toBe(true); expect(firebaseState.sessionExpiryCheck).toBe('live');
    initDatabaseListeners(); await vi.advanceTimersByTimeAsync(1600); await turn();
}
const page = {
    evaluate: async (fn: any, arg?: any) => fn(arg?.__handle || arg),
    evaluateHandle: async (fn: any) => ({ __handle: fn(), dispose: async () => {} }),
    waitForTimeout: async (ms: number) => { await vi.advanceTimersByTimeAsync(ms); await turn(); },
    waitForFunction: async (fn: any) => {
        if (readinessDelay) { await vi.advanceTimersByTimeAsync(readinessDelay); await turn(); }
        for (let i = 0; i < 100 && !fn(); i++) { await vi.advanceTimersByTimeAsync(10); await turn(); } expect(fn()).toBeTruthy(); }
};
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'] }); vi.setSystemTime(NOW);
    localStorage.clear(); sessionStorage.clear(); trace = []; readinessDelay = 0; cleanupInFlight.clear(); cleanupJournalLive.clear();
    resetClearHistoryOperationState(); clock.resetServerClock(); resetDbListenerHealthState(); clearRememberedSession(true);
    firebaseState.authGeneration++; firebaseState.dbRefZtoSignedSweep = null; firebaseState.dbRefZtoSweepLane = null;
    Object.assign(dataState, { scanHistory: [], deletedItems: [], dailyRevenueData: {}, monthlyRevenueData: {}, dailyPickupData: {}, dailyCollectedData: {}, clearHistoryInFlight: false });
    vi.stubGlobal('confirm', () => true); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Unexpected network'); }));
    Object.assign(w, { getServerNow: clock.getServerNow, serverClockIsTrustworthy: clock.serverClockIsTrustworthy,
        runSessionExpiryCheck, filterDataByDate, filterDataByCustomDate, getFilteredDataByDate, clearHistory, runAutomaticCleanupRules });
    for (const field of ['sessionExpiryCheck', 'sessionExpiryCheckInFlight']) Object.defineProperty(w, field, { configurable: true, get: () => (firebaseState as any)[field] });
    const input = document.createElement('input'); input.id = 'customDateInput'; document.body.append(input); refTo('customDateInput')(input);
});
afterEach(() => {
    detachInfoListeners(); detachDatabaseListeners(); clock.resetServerClock(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    document.body.innerHTML = ''; refTo('customDateInput')(null); delete w.ZoeLicense; delete w.__fixtureAuthTime; delete w.__fixtureServerTime; delete w.__zoeFixtureServerNow;
});
it.each([0, 1500, 30000])('តម្រងឆ្លងអធ្រាត្រ readiness %sms និង clear រក្សា identity និងប្រាក់តាម scenario ពិត', async delay => {
    readinessDelay = delay;
    const data = seed(); await bootSource('ui-flow-test.js', data);
    const checks: { pass: boolean; label: string; detail: any }[] = [];
    const source = block('ui-flow-test.js', 'const clearIdsBeforeMidnight', true);
    await new Function('page', 'seed', 'check', 'setBrowserScenarioTime', 'return (async () => {' + source + '})()')(page, data,
        (pass: boolean, label: string, detail: any) => checks.push({ pass, label, detail }), createRequire(path.join(ROOT, 'audit-tools/ui-flow-test.js'))('./browser-clock-fixture.cjs').setBrowserScenarioTime);
    expect(checks.length).toBeGreaterThanOrEqual(9); expect(checks.filter(c => !c.pass)).toEqual([]);
});
it('scenario ៣ បំពាក់ fault មុន boot cleanup ហើយរក្សា 1.5', async () => {
    const source = block('ledger-clamp-symmetry-test.js', "item('it3'"); const checks: any[] = [];
    const bc = (code: string, cod: number, dod: number) => ({ code, cod, dod, createdAt: NOW - 60000, isClosed: false, isDeducted: false, isFromDeletion: false });
    const item = (id: string, phone: string, barcodes: any[]) => ({ id, phone, barcodes, createdAt: NOW - 60000, scanDate: DAY, cod: 6, dod: 0, count: 1, price: 6, barcode: 'CC1', isClosed: false });
    await new Function('browser', 'port', 'boot', 'page', 'bc', 'item', 'seed', 'rev', 'mrev', 'ok', 'return (async () => {' + source + '})()')({}, 0,
        async (_browser: any, _port: any, data: any, options: any) => { await bootSource('ledger-clamp-symmetry-test.js', data, options); return { page, ctx: { close: async () => {} } }; },
        page, bc, item, (hist: any, revenue: any) => ({ ...seed(), zoew_scan_history_cod_dod: hist, zoew_daily_revenue_cod_dod: { [DAY]: revenue }, zoew_monthly_revenue_cod_dod: { [DAY.slice(0, 7)]: revenue } }),
        async () => w.__fakeStore.zoew_daily_revenue_cod_dod[DAY], async () => w.__fakeStore.zoew_monthly_revenue_cod_dod[DAY.slice(0, 7)], (label: string, pass: boolean, detail: any) => checks.push({ label, pass, detail }));
    expect(checks.length).toBeGreaterThanOrEqual(1); expect(checks.filter(c => !c.pass), JSON.stringify(trace)).toEqual([]);
    expect(trace.some(t => t.path.startsWith('zoew_recently_deleted_cod_dod/') && t.fault)).toBe(true);
    expect(w.__fakeStore.zoew_scan_history_cod_dod.it3?.barcodes.map((b: any) => b.code)).toEqual(['CC1']);
    expect(w.__fakeStore.zoew_recently_deleted_cod_dod.it3).toBeUndefined();
    expect(w.__fakeStore.zoew_monthly_revenue_cod_dod[DAY.slice(0, 7)].codDollar).toBe(1.5);
});
function oldSeed() {
    const data: any = seed(), old = NOW - 9 * 86400000;
    const barcode = { code: 'CC1', cod: 6, dod: 0, createdAt: old, isClosed: false, isDeducted: false, isFromDeletion: false };
    data.zoew_scan_history_cod_dod.it3 = { id: 'it3', phone: '0611234567', scanDate: DAY, createdAt: old, barcodes: [barcode], barcode: 'CC1', cod: 6, dod: 0, count: 1, price: 6, isClosed: false };
    return data;
}
it('fault មិនបានបំពាក់៖ listener ពិតសម្អាតពេល boot មុនការហៅ cleanup ដោយដៃ', async () => {
    await bootSource('ledger-clamp-symmetry-test.js', oldSeed());
    expect(trace.some(t => t.path.startsWith('zoew_recently_deleted_cod_dod/') && !t.fault)).toBe(true);
    expect(trace.some(t => t.fault)).toBe(false);
    expect(w.__fakeStore.zoew_scan_history_cod_dod.it3).toBeUndefined();
    expect(w.__fakeStore.zoew_recently_deleted_cod_dod.it3.barcodes[0]).toMatchObject({ code: 'CC1', isDeducted: true });
    expect(w.__fakeStore.zoew_daily_revenue_cod_dod[DAY]).toMatchObject({ codDollar: 0, ded: { it3: { cod: 1.5, count: 1 } } });
});
it.each(['untrusted', 'pending'])('cleanup រង់ចាំពេល %s ទោះ fault បានបំពាក់', async reason => {
    await bootSource('ledger-clamp-symmetry-test.js', seed(), { failTrashWrite: true });
    const row = oldSeed().zoew_scan_history_cod_dod.it3;
    w.__fakeStore.zoew_scan_history_cod_dod.it3 = row; dataState.scanHistory = [structuredClone(row)]; trace = [];
    if (reason === 'pending') firebaseState.sessionExpiryCheck = 'pending';
    else { w.ZoeLicense.syncServerTime = async () => false; clock.resetServerClock(); }
    runAutomaticCleanupRules(); await turn(); await vi.advanceTimersByTimeAsync(300);
    expect(trace).toEqual([]); expect(w.__fakeStore.zoew_scan_history_cod_dod.it3.barcodes[0].code).toBe('CC1');
    expect(w.__fakeStore.zoew_daily_revenue_cod_dod[DAY].codDollar).toBe(1.5);
});
it('sample ថ្មីមិនបម្លែង pending session ទៅ live ហើយ wall jump ដក lease ចាស់', async () => {
    await bootSource('ui-flow-test.js', seed());
    const lease = clock.captureClockOperation();
    firebaseState.sessionExpiryCheck = 'pending';
    const helper = createRequire(path.join(ROOT, 'audit-tools/ui-flow-test.js'))('./browser-clock-fixture.cjs').setBrowserScenarioTime;
    await helper(Date.parse(DAY + 'T16:59:59.000Z')); await turn();
    expect(clock.serverClockIsTrustworthy()).toBe(true); expect(firebaseState.sessionExpiryCheck).toBe('pending');
    expect(sessionUserActionAllowed('clearHistory')).toBe(false); expect(lease.current()).toBe(false);
    const current = clock.captureClockOperation(); w.ZoeLicense.syncServerTime = async () => false;
    vi.setSystemTime(Date.now() + 3000);
    expect(clock.serverClockIsTrustworthy()).toBe(false); expect(current.current()).toBe(false);
    expect(sessionUserActionAllowed('clearHistory')).toBe(false);
});

// ស្រង់ wrapper ពិត៖ clock getter ក៏ flush store ដូច audit bundle ដែរ។
function wrapAuditCalls() {
    const compiled = transformSync(readFileSync(path.join(ROOT, 'audit-tools/zoew/runtime/expose-globals.ts'), 'utf8'), { loader: 'ts', format: 'esm' }).code;
    const ast: any = parse(compiled, { ecmaVersion: 'latest', sourceType: 'module' });
    const owner = ast.body.find((n: any) => n.type === 'FunctionDeclaration' && n.id.name === 'exposeGlobals');
    expect(owner).toBeDefined();
    const parts = ['NO_WRAP', 'depth', 'settle', 'wrap'].map(name => {
        const declaration = owner.body.body.find((n: any) => n.type === 'VariableDeclaration' && n.declarations.some((d: any) => d.id.name === name));
        expect(declaration).toBeDefined(); return declaration;
    });
    const wrap = new Function('commitNow', compiled.slice(parts[0].start, parts.at(-1).end) + '; return wrap;')(commitNow);
    for (const name of ['getServerNow', 'serverClockIsTrustworthy', 'runSessionExpiryCheck', 'filterDataByDate', 'filterDataByCustomDate', 'getFilteredDataByDate', 'clearHistory', 'runAutomaticCleanupRules']) {
        const raw = w[name]; w[name] = wrap(name, raw);
        expect(w[name].__auditOrig).toBe(raw);
    }
}
it.each([0, 1500, 30000].flatMap(delay => [0.1, 0.375].map(tick => ({ delay, tick }))))(
'នាឡិកា browser មានប្រភាគ $tick ms និង readiness $delay ms៖ clock ពិតទទួលថ្ងៃថ្មី និង clear រក្សា identity', async ({ delay, tick }) => {
    readinessDelay = delay; wrapAuditCalls();
    // SHA-256 ពិត តែចប់ក្នុង microtask ដើម្បីមិនប្រណាំងជាមួយ fake timers។
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (algorithm, bytes) => {
        expect(algorithm).toBe('SHA-256');
        return new Uint8Array(createHash('sha256').update(Buffer.from(bytes as ArrayBuffer)).digest()).buffer;
    });
    let reads = 0;
    const real = performance.now.bind(performance);
    vi.spyOn(performance, 'now').mockImplementation(() => real() + ++reads * tick);
    const data = seed(); await bootSource('ui-flow-test.js', data, undefined, true);
    const checks: any[] = [], observations: any[] = [];
    const helper = createRequire(path.join(ROOT, 'audit-tools/ui-flow-test.js'))('./browser-clock-fixture.cjs').setBrowserScenarioTime;
    let requested: number | null;
    const instrumented = async (epoch: number | null) => { requested = epoch; await helper(epoch); };
    const observedPage = { ...page, waitForFunction: async (predicate: () => boolean) => {
        await page.waitForFunction(predicate);
        const sample = w.ZoeLicense.getServerTimeSample();
        observations.push({ requested, sample, frozen: Object.isFrozen(sample), effective: clock.getServerNow(),
            bounds: clock.getServerClockBounds(), filter: uiState.currentFilterMode,
            trusted: clock.serverClockIsTrustworthy(), session: firebaseState.sessionExpiryCheck });
    } };
    const source = block('ui-flow-test.js', 'const clearIdsBeforeMidnight', true);
    await new Function('page', 'seed', 'check', 'setBrowserScenarioTime', 'return (async () => {' + source + '})()')(observedPage, data,
        (pass: boolean, label: string, detail: any) => checks.push({ pass, label, detail }), instrumented);
    const detail = JSON.stringify(observations);
    expect(checks.length).toBeGreaterThanOrEqual(9); expect(checks.filter(c => !c.pass), detail).toEqual([]);
    expect(observations).toHaveLength(4);
    for (const row of observations) {
        const requested = row.requested === null ? row.sample.wallMs : row.requested;
        expect(row.sample.epochMs, detail).toBe(requested);
        expect(row.sample.uncertaintyMs).toBe(0); expect(row.sample.source).toBe('nonce'); expect(row.frozen).toBe(true);
        expect(row.effective, detail).toBeGreaterThanOrEqual(requested);
        expect(row.effective, detail).toBeLessThan(requested + delay + 1000);
        expect(getZoneDateKey(row.effective, 0), detail).toBe(getZoneDateKey(requested, 0));
        expect(row.bounds.lowerMs, detail).toBeGreaterThanOrEqual(requested);
        expect(row.bounds.upperMs, detail).toBeLessThan(requested + delay + 1000);
        expect(row.trusted).toBe(true); expect(row.session).toBe('live');
    }
    expect(observations[2].filter).toBe('today');
});
it.each([0.25, 0.75])('ទិសផ្ទុយ៖ nonce ប្រភាគ %s និង uncertainty 0 មិនអាចជំនួស clock ពិត', async fraction => {
    await bootSource('ui-flow-test.js', seed());
    const sample = w.ZoeLicense.getServerTimeSample();
    const invalid = Object.freeze({ ...sample, epochMs: Date.parse(DAY + 'T17:00:01.000Z') + fraction,
        monotonicMs: performance.now(), wallMs: Date.now(), observation: sample.observation + 1 });
    const before = clock.getServerNow();
    expect(clock.acceptServerClockOffset(invalid.epochMs - invalid.wallMs, invalid, false)).toBe(false);
    expect(clock.getServerNow()).toBe(before); expect(clock.serverClockIsTrustworthy()).toBe(true);
});

it.each([
    ['undefined', undefined], ['null', null], ['NaN', NaN], ['object', {}], ['array', []],
    ['sub-ms', 0.75], ['zero', 0], ['negative', -1], ['infinite', Infinity], ['out-of-range', 8640000000000001]
])('ប្រភព epoch %s៖ sync បដិសេធ ហើយមិនបង្កើតភស្តុតាងថ្មី', async (_name, value) => {
    await bootSource('ui-flow-test.js', seed());
    const sample = w.ZoeLicense.getServerTimeSample();
    w.__zoeFixtureServerNow = () => value;
    expect(await w.ZoeLicense.syncServerTime()).toBe(false);
    expect(w.ZoeLicense.getServerTimeSample()).toBe(sample);
});
