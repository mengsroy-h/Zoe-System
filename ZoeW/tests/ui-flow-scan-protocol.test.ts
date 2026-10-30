import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { addOrUpdateEntry } from '../src/features/scan-action';
import { toggleCloseStatus } from '../src/features/entry-ops';
import { preparePendingScan } from '../src/services/scan-pending';

const H = 'zoew_scan_history_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod', P = 'zoew_daily_pickup_cod_dod';
const NOW = Date.UTC(2026, 9, 30, 9), DAY = '2026-10-30', HOST = 'https://fake-default-rtdb.firebaseio.com';
const source = fs.readFileSync('../audit-tools/ui-flow-test.js', 'utf8');
const clone = (value: any) => JSON.parse(JSON.stringify(value));
let fixture: any;
beforeEach(() => {
    uiState.toasts = [];
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('confirm', () => true);
    const row = { id: 'row', phone: '0655444333', scanDate: DAY, createdAt: NOW - 150, cod: 8, dod: 0, price: 8, count: 1,
        barcode: 'GG1', time: '15:00', isClosed: true, closedAt: NOW - 10,
        barcodes: [{ code: 'GG1', time: '15:00', cod: 8, dod: 0, locker: 'F1', isClosed: true, closedAt: NOW - 10,
            isDeducted: false, isFromDeletion: false, createdAt: NOW - 150 }] };
    const seed = { [H]: { row }, [D]: { [DAY]: { codDollar: 8, dodDollar: 0, totalCount: 1 } },
        [M]: { '2026-10': { codDollar: 8, dodDollar: 0, totalCount: 1 } },
        [P]: { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 1, pickedUpPhones: { '0655444333': 1 }, pickedUpBarcodes: { GG1: '0655444333' } } },
        zoew_barcode_registry: { GG1: true } };
    const context: any = vm.createContext({ window: { dispatchEvent() {} }, Event, Date, setTimeout });
    vm.runInContext(source.slice(source.indexOf('const FAKE_SDK = function'), source.indexOf('function seedData()')) + '\nFAKE_SDK(' + JSON.stringify(seed) + ');', context);
    fixture = context.window;
    const sdk = fixture.firebaseSDK;
    firebaseState.authGeneration++; firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    Object.assign(firebaseState, { fb: sdk, db: sdk.getDatabase(), auth: sdk.getAuth(), isDatabaseConnected: true, isDatabaseInitialized: true,
        isInitializingFirebase: false, serverClockTrusted: true, serverTimeOffsetMs: 0 });
    firebaseState.dbRefHistory = sdk.ref(firebaseState.db, H); firebaseState.dbRefDailyRevenue = sdk.ref(firebaseState.db, D); firebaseState.dbRefMonthlyRevenue = sdk.ref(firebaseState.db, M);
    dataState.scanHistory = [clone(row)]; dataState.deletedItems = [];
    dataState.dailyRevenueData = clone(seed[D]); dataState.monthlyRevenueData = clone(seed[M]);
});
afterEach(() => { firebaseState.authGeneration++; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('v1 ដែលទទួលយករួច៖ merge បើក row ប៉ុន្តែរក្សា barcode យករួច និង pickup', async () => {
    const local = dataState.scanHistory[0]; local.isClosed = false; local.barcodes[0].isClosed = false;
    const pickup = clone(fixture.__fakeStore[P]);
    const handle = preparePendingScan('GG2', 4, 0, NOW, 'legacy-compatibility', 1);
    expect(await addOrUpdateEntry('GG2', '0655444333', 4, 0, 'F2', NOW, 0, handle)).toBe(true);
    expect(fixture.__fakeStore[H].row).toMatchObject({ isClosed: false, count: 2, cod: 12 });
    expect(fixture.__fakeStore[H].row.barcodes[0].isClosed).toBe(true);
    expect(fixture.__fakeStore[H].row.barcodes[1]).toMatchObject({ code: 'GG2', cod: 4, dod: 0, locker: 'F2' });
    expect(fixture.__fakeStore[P]).toEqual(pickup);
});

it('public v2៖ server បិទក្រោយជ្រើស target ➜ មិនបើកវិញ; refresh/retry បង្កើត row ថ្មីដោយរក្សា pickup', async () => {
    const local = dataState.scanHistory[0]; local.isClosed = false; local.barcodes[0].isClosed = false;
    const original = clone(fixture.__fakeStore[H].row), pickup = clone(fixture.__fakeStore[P]);
    expect(await addOrUpdateEntry('GG2', '0655444333', 4, 0, 'F2')).toBe('unknown');
    expect(fixture.__fakeStore[H].row).toEqual(original);
    const notices = uiState.toasts.filter(toast => String(toast.msg).includes('(GG2)'));
    expect(notices.some(toast => toast.kind === 'warn' && toast.msg.includes('មិនបានរក្សាទុក') && toast.msg.includes('មិនបូកប្រាក់'))).toBe(true);
    expect(notices.some(toast => toast.kind === 'success' || toast.msg.startsWith('✅'))).toBe(false);
    expect(fixture.__fakeStore[P]).toEqual(pickup);
    expect(fixture.__fakeStore.zoew_barcode_registry.GG2).toBeUndefined();
    expect(Object.values(fixture.__fakeStore.zoew_scan_operations)).toEqual([expect.objectContaining({ phase: 'cancelled', code: 'GG2' })]);
    expect(fixture.__fakeStore[D][DAY]).toMatchObject({ codDollar: 8, dodDollar: 0, totalCount: 1 });
    dataState.scanHistory = Object.values(clone(fixture.__fakeStore[H]));
    expect(await addOrUpdateEntry('GG2', '0655444333', 4, 0, 'F2')).toBe(true);
    const rows: any[] = Object.values(fixture.__fakeStore[H]);
    expect(rows).toHaveLength(2);
    expect(fixture.__fakeStore[H].row).toEqual(original);
    expect(rows.find(row => row.id !== 'row')).toMatchObject({ isClosed: false, count: 1, cod: 4,
        barcodes: [expect.objectContaining({ code: 'GG2', cod: 4, dod: 0, locker: 'F2', isClosed: false })] });
    expect(fixture.__fakeStore[P]).toEqual(pickup);
    expect(fixture.__fakeStore[D][DAY]).toMatchObject({ codDollar: 12, dodDollar: 0, totalCount: 2 });
});


it('browser callback ពិត៖ ប្រណាំងពេល server បិទ និង retry មានភស្តុតាងឆ្លងកាត់ public actions', async () => {
    const sdk = fixture.firebaseSDK;
    Object.assign(fixture, { addOrUpdateEntry, toggleCloseStatus });
    for (const [path, apply] of [
        [H, (value: any) => { dataState.scanHistory = Object.values(value || {}); }],
        [D, (value: any) => { dataState.dailyRevenueData = value || {}; }],
        [M, (value: any) => { dataState.monthlyRevenueData = value || {}; }],
        [P, (value: any) => { dataState.dailyPickupData = value || {}; }]
    ] as const) sdk.onValue(sdk.ref(firebaseState.db, path), (snap: any) => apply(snap.val()));
    const start = source.indexOf('const outcome = await page.evaluate(async (dk) => {');
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start + 'const outcome = await page.evaluate('.length, source.indexOf('}, seed._dateKey);', start) + 1);
    const context: any = vm.createContext({ window: fixture, fb: sdk, Date });
    Object.defineProperty(context, 'toasts', { get: () => uiState.toasts });
    const outcome = await vm.runInContext('(' + body + ')(' + JSON.stringify(DAY) + ')', context);
    expect(outcome.firstState).toMatchObject({ fired: true, result: 'unknown', historySame: true, pickupSame: true, noClaim: true, moneySame: true, cancelled: true });
    expect(outcome.firstState.notices.some((toast: any) => toast.kind === 'warn' && toast.msg.includes('មិនបានរក្សាទុក') && toast.msg.includes('មិនបូកប្រាក់'))).toBe(true);
    expect(outcome.firstState.notices.some((toast: any) => toast.kind === 'success' || toast.msg.startsWith('✅'))).toBe(false);
    expect(outcome).toMatchObject({ retry: true, committed: true, addedClosed: false, oldSame: true, pickupSame: true, moneyOnce: true,
        added: { cod: 4, dod: 0, locker: 'F2' } });
});
