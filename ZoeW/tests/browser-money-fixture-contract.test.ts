import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { claimAndCleanupItem, readCleanupJournal } from '../src/domain/cleanup';
import { executeRestoreItem } from '../src/features/restore';
import { uiState } from '../src/core/state';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { preparePendingScan } from '../src/services/scan-pending';
import { claimScanOperation, saveScanOperation } from '../src/services/scan-operation';
import { purgeTrashWithRegistry } from '../src/services/registry-purge';

const H = 'zoew_scan_history_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod', R = 'zoew_barcode_registry';
const HOST = 'https://fake-default-rtdb.firebaseio.com', NOW = Date.UTC(2026, 9, 30, 9);
const duplicateSource = fs.readFileSync('../audit-tools/duplicate-scan-test.js', 'utf8');
const moneySource = fs.readFileSync('../audit-tools/duplicate-money-test.js', 'utf8');
const slowSource = fs.readFileSync('../audit-tools/slow-write-test.js', 'utf8');
const cleanupSource = fs.readFileSync('scripts/cleanup-rules-check.mjs', 'utf8');
function duplicateFixture(slow: boolean | 'money' = false, missingIncrement = false) {
    const context: any = vm.createContext({ window: { dispatchEvent() {}, setTimeout, setInterval }, Event, Date, setTimeout });
    let source = slow === 'money' ? moneySource : slow ? slowSource : duplicateSource;
    if (missingIncrement) source = source.replace(/ {8}increment: \(amount\) => \{[\s\S]*?\n {8}\},\n/, '');
    vm.runInContext(source.slice(source.indexOf('const BOOT = function'), source.indexOf(slow === true ? 'function seedData()' : 'function seedEmpty()')) + '\nBOOT({});', context);
    return context.window;
}
function cleanupFixture() {
    const context: any = vm.createContext({ NOW, TODAY: '2026-10-30', D15: '2026-10-23', D14: '2026-10-22', HOUR: 3600000, MIN: 60000, DAY: 86400000,
        TWO_HOURS: 7200000, ABANDON: 604800000, RETURNED_RETENTION: 172800000, TRASH_RETENTION: 2592000000 });
    vm.runInContext(cleanupSource.slice(cleanupSource.indexOf('function bc('), cleanupSource.indexOf('/* ── build React')) + '\nglobalThis.initial = seed();', context);
    return context;
}
beforeEach(() => {
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); vi.stubGlobal('crypto', webcrypto);
    firebaseState.authGeneration++; firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    Object.assign(firebaseState, { isDatabaseConnected: true, isDatabaseInitialized: true, isInitializingFirebase: false, serverClockTrusted: true, serverTimeOffsetMs: 0 });
    dataState.scanHistory = []; dataState.deletedItems = [];
});
afterEach(() => { firebaseState.authGeneration++; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it.each([false, true, 'money'] as const)('browser fixture slow=%s ៖ public v2 claim/save បញ្ចប់ receipt/history/owned registry និងប្រាក់តែម្តង', async (slow) => {
    const fixture = duplicateFixture(slow), sdk = fixture.firebaseSDK, db = sdk.getDatabase();
    Object.assign(firebaseState, { fb: sdk, db, auth: sdk.getAuth() });
    const handle = preparePendingScan('FIXTURE0001', 5, 0, NOW, 'direct', 2);
    expect(await claimScanOperation(handle, 'FIXTURE0001')).toBe('claimed');
    expect(await saveScanOperation(handle, '012345678', 'A1')).toBe(true);
    const operation = fixture.__fakeStore.zoew_scan_operations[handle.record.id];
    expect(operation.phase).toBe('committed');
    expect(fixture.__fakeStore[H][operation.targetId].scanPending).toBeUndefined();
    expect(Array.isArray(fixture.__fakeStore[H][operation.targetId].barcodes)).toBe(true);
    expect(fixture.__fakeStore[R].FIXTURE0001.intent).toBe(handle.record.id);
    for (const root of [D, M]) expect(Object.values(fixture.__fakeStore[root])[0]).toMatchObject({ codDollar: 5, dodDollar: 0, totalCount: 1 });
    const before = JSON.stringify(fixture.__fakeStore);
    expect(await saveScanOperation(handle, '012345678', 'A1')).toBe('unknown');
    expect(JSON.stringify(fixture.__fakeStore)).toBe(before);
    const duplicate = preparePendingScan('FIXTURE0001', 5, 0, NOW + 1, 'direct', 2);
    expect(await claimScanOperation(duplicate, 'FIXTURE0001')).toBe('taken');
    for (const root of [D, M]) expect(Object.values(fixture.__fakeStore[root])[0]).toMatchObject({ codDollar: 5, totalCount: 1 });
    expect(fixture.__fakeStore[R].FIXTURE0001.intent).toBe(handle.record.id);
});

it('cleanup seed ៖ legacy registry ប្រើ true ដូច writer ពិត ហើយ public purge លុបបាន', async () => {
    const fixture = duplicateFixture(), seed = cleanupFixture().initial;
    Object.assign(fixture.__fakeStore, JSON.parse(JSON.stringify(seed)));
    const sdk = fixture.firebaseSDK, db = sdk.getDatabase(); Object.assign(firebaseState, { fb: sdk, db, auth: sdk.getAuth() });
    const source = seed.zoew_recently_deleted_cod_dod.tRetOut;
    expect(await purgeTrashWithRegistry(source)).toBe(true);
    expect(fixture.__fakeStore.zoew_recently_deleted_cod_dod.tRetOut).toBeUndefined();
    expect(fixture.__fakeStore[R].TEO).toBeUndefined();
    expect(fixture.__fakeStore.zoew_trash_consumptions.tRetOut).toMatchObject({ generation: 0, kind: 'purge' });
    expect(Object.values(fixture.__fakeStore.zoew_registry_releases)).toHaveLength(1);
});

it('legacy registry string ដែលមិនស្គាល់ ត្រូវនៅ HOLD មិនក្លែងថាដោះបាន', async () => {
    const fixture = duplicateFixture(), seed = cleanupFixture().initial;
    Object.assign(fixture.__fakeStore, JSON.parse(JSON.stringify(seed)));
    const sdk = fixture.firebaseSDK, db = sdk.getDatabase(); Object.assign(firebaseState, { fb: sdk, db, auth: sdk.getAuth() });
    fixture.__fakeStore[R].TEO = 'tRetOut';
    const before = JSON.stringify(fixture.__fakeStore);
    expect(await purgeTrashWithRegistry(seed.zoew_recently_deleted_cod_dod.tRetOut)).toBe(false);
    expect(JSON.stringify(fixture.__fakeStore)).toBe(before);
});


it.each([false, true, 'money'] as const)('fixture slow=%s increment ៖ nested ដោះស្រាយត្រឹមត្រូវ ហើយ atomic update មិនទុកពាក់កណ្តាលពេល malformed', async (slow) => {
    const fixture = duplicateFixture(slow), sdk = fixture.firebaseSDK, db = sdk.getDatabase();
    fixture.__fakeStore.money = { cod: 3, nested: { count: 1 } };
    await sdk.update(sdk.ref(db), { 'money/cod': sdk.increment(2), 'money/nested': { count: sdk.increment(1) } });
    expect(fixture.__fakeStore.money).toEqual({ cod: 5, nested: { count: 2 } });
    const before = JSON.stringify(fixture.__fakeStore);
    expect(() => sdk.update(sdk.ref(db), { 'money/cod': sdk.increment(7), 'money/nested/count': { '.sv': { increment: 'bad' } } })).toThrow('invalid increment');
    expect(JSON.stringify(fixture.__fakeStore)).toBe(before);
    expect(() => sdk.increment(NaN)).toThrow('invalid increment');
});


it('cleanup parity ៖ token ថ្មីតែប៉ុណ្ណោះស្មើ ក្រោយផ្ទៀង receipt/target ហើយព្រំដែនសំខាន់នៅប្រៀបធៀប', () => {
    const context: any = vm.createContext({});
    vm.runInContext(cleanupSource.slice(cleanupSource.indexOf('function normalizeRestoreConsumptions('), cleanupSource.indexOf('function normalize(db)')) + '; globalThis.check = normalizeRestoreConsumptions;', context);
    const receipt = { v: 1, sourceId: 'source1', generation: 1, kind: 'restore', actorUid: 'admin-uid', scope: HOST,
        deletedAt: NOW - 100, rowBirth: NOW - 1000, token: 'restore_id_100_aaaa_bbbb', targetId: 'target1' };
    const db = { zoew_scan_history_cod_dod: { target1: { id: 'target1', cod: 5, count: 1 } }, zoew_trash_consumptions: { source1: receipt } };
    const other = structuredClone(db); other.zoew_trash_consumptions.source1.token = 'restore_id_200_cccc_dddd';
    expect(context.check(db)).toEqual(context.check(other));
    for (const field of ['generation', 'actorUid', 'scope', 'deletedAt', 'rowBirth']) {
        const changed: any = structuredClone(other); changed.zoew_trash_consumptions.source1[field] = typeof receipt[field] === 'number' ? receipt[field] + 1 : receipt[field] + '-other';
        expect(context.check(db)).not.toEqual(context.check(changed));
    }
    const money = structuredClone(other); money.zoew_scan_history_cod_dod.target1.cod = 9;
    expect(context.check(db)).not.toEqual(context.check(money));
    for (const mutate of [
        (x: any) => { x.zoew_trash_consumptions.source1.sourceId = 'foreign'; },
        (x: any) => { x.zoew_trash_consumptions.source1.token = 'malformed'; },
        (x: any) => { delete x.zoew_scan_history_cod_dod.target1; },
        (x: any) => { x.zoew_recently_deleted_cod_dod = { source1: {} }; },
        (x: any) => { x.zoew_trash_consumptions.source1.extra = true; }
    ]) {
        const malformed = structuredClone(db); mutate(malformed);
        expect(() => context.check(malformed)).toThrow('invalid restore consumption parity proof');
    }
});


it.each([false, true, 'money'] as const)('negative fixture slow=%s ៖ ខ្វះ increment មិនអាចអះអាងថា v2 បានរក្សាទុក', async (slow) => {
    const fixture = duplicateFixture(slow, true), sdk = fixture.firebaseSDK, db = sdk.getDatabase();
    expect(sdk.increment).toBeUndefined();
    Object.assign(firebaseState, { fb: sdk, db, auth: sdk.getAuth() });
    const handle = preparePendingScan('MISSINGINC1', 5, 0, NOW, 'direct', 2);
    expect(await claimScanOperation(handle, 'MISSINGINC1')).toBe('claimed');
    expect(await saveScanOperation(handle, '012345678', 'A1')).toBe('unknown');
    const operation = fixture.__fakeStore.zoew_scan_operations[handle.record.id];
    expect(operation.phase).toBe('prepared');
    expect(fixture.__fakeStore[H][operation.targetId].scanPending.intent).toBe(handle.record.id);
    expect(Object.values(fixture.__fakeStore[D] || {})).toHaveLength(0);
});

it('slow fixture ៖ pending write ចុះយឺត បន្ទាប់មក committed និងប្រាក់តែម្តង', async () => {
    const fixture = duplicateFixture(true), sdk = fixture.firebaseSDK, db = sdk.getDatabase();
    Object.assign(firebaseState, { fb: sdk, db, auth: sdk.getAuth() });
    const handle = preparePendingScan('LATESAVEFIX1', 5, 0, NOW, 'direct', 2);
    expect(await claimScanOperation(handle, 'LATESAVEFIX1')).toBe('claimed');
    fixture.__slow = [{ match: H, landAfterMs: 25 }];
    const result = saveScanOperation(handle, '012345678', 'A1');
    let settled = false; result.then(() => { settled = true; });
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(settled).toBe(false);
    expect(await result).toBe(true);
    const operation = fixture.__fakeStore.zoew_scan_operations[handle.record.id];
    expect(operation.phase).toBe('committed');
    expect(fixture.__fakeStore[R].LATESAVEFIX1).toEqual({ v: 2, intent: handle.record.id, actorUid: operation.actorUid, birth: NOW });
    expect(fixture.__fakeStore[H][operation.targetId].scanPending).toBeUndefined();
    expect(Array.isArray(fixture.__fakeStore[H][operation.targetId].barcodes)).toBe(true);
    for (const root of [D, M]) expect(Object.values(fixture.__fakeStore[root])[0]).toMatchObject({ codDollar: 5, totalCount: 1 });
});


it('slow claim oracle ៖ v2 owner ត្រូវ receipt និង lifecycle មិនទទួល object ណាក៏បាន', async () => {
    const fixture = duplicateFixture(true), sdk = fixture.firebaseSDK, db = sdk.getDatabase();
    Object.assign(firebaseState, { fb: sdk, db, auth: sdk.getAuth() });
    const handle = preparePendingScan('SLOWSAVE1', 5, 0, NOW, 'direct', 2);
    expect(await claimScanOperation(handle, 'SLOWSAVE1')).toBe('claimed');
    expect(await saveScanOperation(handle, '012345678', 'A1')).toBe(true);
    const ownerAt = slowSource.indexOf('const owner = reg.SLOWSAVE1;');
    const body = slowSource.slice(slowSource.lastIndexOf('const s = window.__fakeStore;', ownerAt), slowSource.indexOf('\n        });', ownerAt));
    const inspect = (store) => {
        const context: any = vm.createContext({ window: { __fakeStore: store } });
        vm.runInContext('globalThis.result = (() => {' + body + '})();', context);
        return context.result;
    };
    const original = structuredClone(fixture.__fakeStore), op = original.zoew_scan_operations[handle.record.id];
    expect(inspect(original)).toMatchObject({ parcelExists: true, claimed: true, phase: 'committed' });
    for (const mutate of [
        (x: any) => { x[R].SLOWSAVE1.extra = true; },
        (x: any) => { x[R].SLOWSAVE1.birth++; },
        (x: any) => { x[R].SLOWSAVE1.intent = 'foreign'; },
        (x: any) => { x.zoew_scan_operations[handle.record.id].phase = 'prepared'; },
        (x: any) => { x.zoew_scan_operations[handle.record.id].count = 2; },
        (x: any) => { x[H][op.targetId].scanPending = { intent: 'foreign' }; },
        (x: any) => { x[H][op.targetId].barcodes[0].cod++; },
        (x: any) => { x[H][op.targetId].barcodes[0].createdAt++; }
    ]) {
        const changed = structuredClone(original); mutate(changed);
        expect(inspect(changed).claimed).toBe(false);
    }
});

const multiSource = fs.readFileSync('../audit-tools/emu/money-multidevice-emu-test.js', 'utf8');
const { invariant, invariantBroken } = createRequire(import.meta.url)('../../audit-tools/money-multidevice-core.js');
function agePatch(item, registry) {
    const context: any = vm.createContext({});
    vm.runInContext(multiSource.slice(multiSource.indexOf('function sweepAgePatch('), multiSource.indexOf('(async () => {')) + ';globalThis.age = sweepAgePatch;', context);
    return context.age(item, registry, NOW);
}
it('multidevice aging ៖ birth v2 មិនត្រូវកែ ទោះ registry ឬ scanIntent ខ្វះមួយក៏ដោយ', () => {
    const parcel = { createdAt: NOW - 1000, barcodes: [{ code: 'V2AGE', createdAt: NOW - 1000, scanIntent: 'scan_x', isClosed: false }] };
    expect(agePatch(parcel, { V2AGE: { v: 2, birth: NOW - 1000 } })).toBeNull();
    expect(agePatch(parcel, { V2AGE: true })).toBeNull();
    delete (parcel.barcodes[0] as any).scanIntent;
    expect(agePatch(parcel, { V2AGE: { v: 2, birth: NOW - 1000 } })).toBeNull();
    expect(agePatch(parcel, {})).toBeNull();
    expect(agePatch(parcel, { V2AGE: true })).toMatchObject({ createdAt: NOW - 9 * 86400000, 'barcodes/0/createdAt': NOW - 9 * 86400000 });
});
it('multidevice pickup aging ៖ closedAt ប្រែបាន តែ immutable birth នៅដដែល', () => {
    const parcel = { createdAt: NOW - 1000, isClosed: true, barcodes: [{ code: 'V2AGE', createdAt: NOW - 1000, scanIntent: 'scan_x', isClosed: true }] };
    expect(agePatch(parcel, {})).toEqual({ closedAt: NOW - 3 * 3600000, 'barcodes/0/closedAt': NOW - 3 * 3600000 });
});

it('historical v2 admission → abandon → Restore ៖ birth/receipt/registry ថេរ និង strict oracle ចាប់ wrong-birth', async () => {
    const fixture = duplicateFixture('money'), sdk = fixture.firebaseSDK, db = sdk.getDatabase();
    Object.assign(firebaseState, { fb: sdk, db, auth: sdk.getAuth(), hasEverConnectedToDatabase: true, dbListenersFailed: false });
    for (const [key, path] of Object.entries({ dbRefHistory: H, dbRefDeleted: 'zoew_recently_deleted_cod_dod', dbRefDailyRevenue: D, dbRefMonthlyRevenue: M,
        dbRefDailyPickup: 'zoew_daily_pickup_cod_dod', dbRefDailyCollected: 'zoew_daily_collected_cod_dod' })) firebaseState[key] = sdk.ref(db, path);
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('fetch', async (url: string) => new Response(JSON.stringify((await sdk.get(sdk.ref(db, new URL(url).pathname.replace(/^\//, '').replace(/\.json$/, '')))).val()), { status: 200 }));
    const birth = NOW - 9 * 86400000;
    const handle = preparePendingScan('HISTORYV2', 10, 2, birth, 'direct', 2);
    expect(await claimScanOperation(handle, 'HISTORYV2')).toBe('claimed');
    expect(await saveScanOperation(handle, '012345678', 'A1')).toBe(true);
    const store = fixture.__fakeStore, receipt = structuredClone(store.zoew_scan_operations[handle.record.id]);
    expect(receipt.birth).toBe(birth);
    const sync = () => {
        dataState.scanHistory = structuredClone(Object.values(store[H] || {}));
        dataState.deletedItems = structuredClone(Object.values(store.zoew_recently_deleted_cod_dod || {}));
        dataState.dailyRevenueData = structuredClone(store[D] || {});
        dataState.monthlyRevenueData = structuredClone(store[M] || {});
        dataState.dailyPickupData = {}; dataState.dailyCollectedData = {};
    };
    const inspect = () => invariant(store, receipt.scanDate, receipt.month, ['HISTORYV2'], HOST);
    expect(invariantBroken(inspect())).toBeFalsy();
    sync();
    await claimAndCleanupItem(receipt.targetId, 'abandon');
    expect(store[H][receipt.targetId]).toBeUndefined();
    const trash: any = Object.values(store.zoew_recently_deleted_cod_dod || {})[0];
    expect(trash.barcodes[0]).toMatchObject({ createdAt: birth, scanIntent: receipt.id, isDeducted: true });
    expect(readCleanupJournal()).toHaveLength(0);
    expect(invariantBroken(inspect())).toBeFalsy();
    sync(); uiState.pendingRestoreId = trash.id;
    await executeRestoreItem();
    expect(Object.values(store.zoew_recently_deleted_cod_dod || {})).toHaveLength(0);
    const restored: any = Object.values(store[H])[0];
    expect(restored.barcodes[0]).toMatchObject({ createdAt: birth, scanIntent: receipt.id, isDeducted: false });
    expect(store.zoew_scan_operations[receipt.id]).toEqual(receipt);
    expect(store[R].HISTORYV2).toMatchObject({ birth, intent: receipt.id });
    expect(invariantBroken(inspect())).toBeFalsy();
    const negative = structuredClone(store);
    negative[H][restored.id].barcodes[0].createdAt++;
    const rejected = invariant(negative, receipt.scanDate, receipt.month, ['HISTORYV2'], HOST);
    expect(rejected.registryMissing).toEqual(['HISTORYV2']);
    expect(invariantBroken(rejected)).toBeTruthy();
});

it('aging ៖ mixed legacy/v2 មិនកែ birth និង sparse barcode index មិនត្រូវប្ដូរ', () => {
    const parcel = { createdAt: NOW - 1000, barcodes: { 3: { code: 'LEGACY', createdAt: NOW - 1000 }, 8: { code: 'V2AGE', createdAt: NOW - 1000, scanIntent: 'scan_x' } } };
    expect(agePatch(parcel, { LEGACY: true, V2AGE: true })).toBeNull();
    delete (parcel.barcodes as any)[8];
    expect(agePatch(parcel, { LEGACY: true })).toEqual({ createdAt: NOW - 9 * 86400000, 'barcodes/3/createdAt': NOW - 9 * 86400000 });
});
