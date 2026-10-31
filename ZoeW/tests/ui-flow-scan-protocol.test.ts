import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { addOrUpdateEntry } from '../src/features/scan-action';
import * as barcodeDomain from '../src/domain/barcode';
import { refTo } from '../src/app/refs';
import { openEditBarcodePriceModal, saveEditedBarcodePrice, removeSingleBarcode } from '../src/features/barcode-ops';
import { runAutomaticCleanupRules } from '../src/domain/cleanup';
import { executeRestoreItem } from '../src/features/restore';
import { promptRestoreDeletedItem } from '../src/features/trash';
import { toggleIndividualBarcodeClose } from '../src/features/barcode-ops';
import { deleteSingleItem, toggleCloseStatus } from '../src/features/entry-ops';
import { withConnectionOwnership } from '../src/services/connection-flow';
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
    firebaseState.fb = withConnectionOwnership(sdk);
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
    const context: any = vm.createContext({ window: fixture, fb: firebaseState.fb, Date });
    fixture.uiState = uiState;
    // Browser exposes the exported state object, not every new state field as a global.
    const generated = JSON.parse(fs.readFileSync('src/_generated-state.json', 'utf8'));
    expect(generated.uiState.some((field: any) => field.name === 'toasts')).toBe(false);
    expect(() => vm.runInContext('toasts.filter(() => true)', context)).toThrow('toasts is not defined');
    expect(vm.runInContext('window.uiState', context)).toBe(uiState);
    const outcome = await vm.runInContext('(' + body + ')(' + JSON.stringify(DAY) + ')', context);
    expect(outcome.firstState).toMatchObject({ fired: true, result: 'unknown', historySame: true, pickupSame: true, noClaim: true, moneySame: true, cancelled: true });
    expect(outcome.firstState.notices.some((toast: any) => toast.kind === 'warn' && toast.msg.includes('មិនបានរក្សាទុក') && toast.msg.includes('មិនបូកប្រាក់'))).toBe(true);
    expect(outcome.firstState.notices.some((toast: any) => toast.kind === 'success' || toast.msg.startsWith('✅'))).toBe(false);
    expect(outcome).toMatchObject({ retry: true, committed: true, addedClosed: false, oldSame: true, pickupSame: true, moneyOnce: true,
        added: { cod: 4, dod: 0, locker: 'F2' } });
});

it('callback ប្រណាំងចាស់ដែលចាក់លើ Proxy វិលជុំ ខណៈ raw transport នៅថេរ', async () => {
    const sdk = fixture.firebaseSDK;
    const owned = withConnectionOwnership(sdk);
    const original = owned.runTransaction;
    let calls = 0;
    sdk.runTransaction = (...args: any[]) => {
        if (++calls > 8) throw new Error('fixture proxy recursion detected');
        return original(...args);
    };
    expect(() => owned.runTransaction(owned.ref(firebaseState.db, H + '/row'), (row: any) => row))
        .toThrow('fixture proxy recursion detected');
    expect(calls).toBe(9);
});


it.each(['settled', 'delayed', 'rules-reject-marker', 'old-marker', 'rules-reject-old-marker', 'old-order', 'settlement-aborted', 'real-boot', 'empty-month', 'full-sequence', 'full-sequence-empty'])('fractional browser callback %s ៖ price settlement មុន Remove តាមផ្លូវពិត', async (mode) => {
    if (mode === 'real-boot' || mode === 'empty-month' || mode.startsWith('full-sequence')) {
        const fuzz = fs.readFileSync('../audit-tools/revenue-fuzz-test.js', 'utf8');
        let seed = clone(fixture.__fakeStore);
        if (mode.startsWith('full-sequence')) {
            const moneySource = fs.readFileSync('../audit-tools/item-money-integrity-test.js', 'utf8');
            const seedSource = fuzz.slice(fuzz.indexOf('function seedData()'), fuzz.indexOf('// deterministic PRNG'));
            const seedContext: any = vm.createContext({ Date });
            vm.runInContext(seedSource + '\nconst mod = { seedData };' + moneySource.slice(moneySource.indexOf('    const seed = mod.seedData();'), moneySource.indexOf('    await page.addInitScript(`window.localStorage')), seedContext);
            seed = vm.runInContext('seed', seedContext);
            expect(seed[M]['2026-10']).toEqual({ codDollar: 47.75, dodDollar: 7.25, totalCount: 6 });
        }
        if (mode === 'full-sequence-empty') seed[M] = {};
        if (mode === 'empty-month') seed[M] = {};
        const context: any = vm.createContext({ window: { dispatchEvent() {} }, Event, Date, setTimeout, URL, Response });
        vm.runInContext(fuzz.slice(fuzz.indexOf('const BOOT = function (seed) {'), fuzz.indexOf('function seedData()')) + '\nBOOT(' + JSON.stringify(seed) + ');', context);
        fixture = context.window;
        vi.stubGlobal('fetch', fixture.fetch);
        const sdk = fixture.firebaseSDK;
        Object.assign(firebaseState, { fb: sdk, db: sdk.getDatabase(), auth: sdk.getAuth() });
        firebaseState.dbRefHistory = sdk.ref(firebaseState.db, H); firebaseState.dbRefDailyRevenue = sdk.ref(firebaseState.db, D); firebaseState.dbRefMonthlyRevenue = sdk.ref(firebaseState.db, M);
    }
    const sdk = fixture.firebaseSDK, store = fixture.__fakeStore;
    if (store[H].row) {
        store[H].row.isClosed = false; store[H].row.barcodes[0].isClosed = false;
        delete store[H].row.closedAt; delete store[H].row.barcodes[0].closedAt;
    }
    firebaseState.dbRefDeleted = sdk.ref(firebaseState.db, 'zoew_recently_deleted_cod_dod');
    store[P] = {}; store.zoew_daily_collected_cod_dod = {};
    dataState.dailyCollectedData = {}; dataState.dailyPickupData = {};
    firebaseState.dbRefDailyCollected = sdk.ref(firebaseState.db, 'zoew_daily_collected_cod_dod');
    for (const [path, apply] of [
        [H, (value: any) => { dataState.scanHistory = Object.values(value || {}); }],
        [D, (value: any) => { dataState.dailyRevenueData = value || {}; }],
        [M, (value: any) => { dataState.monthlyRevenueData = value || {}; }],
        [P, (value: any) => { dataState.dailyPickupData = value || {}; }],
        ['zoew_recently_deleted_cod_dod', (value: any) => { dataState.deletedItems = Object.values(value || {}); }]
    ] as const) sdk.onValue(sdk.ref(firebaseState.db, path), (snap: any) => apply(snap.val()));
    fixture.__fireAll();
    if (mode.startsWith('full-sequence')) {
        const moneySource = fs.readFileSync('../audit-tools/item-money-integrity-test.js', 'utf8');
        Object.assign(fixture, { toggleIndividualBarcodeClose, toggleCloseStatus, removeSingleBarcode, deleteSingleItem, promptRestoreDeletedItem, executeRestoreItem, runAutomaticCleanupRules });
        const context: any = vm.createContext({ window: fixture });
        Object.defineProperty(context, 'scanHistory', { get: () => dataState.scanHistory });
        Object.defineProperty(context, 'deletedItems', { get: () => dataState.deletedItems });
        const ops = vm.runInContext(moneySource.slice(moneySource.indexOf('    const OPS = ['), moneySource.indexOf('    const results = await page.evaluate')) + '\nOPS', context);
        expect(ops).toHaveLength(7);
        for (const [, run] of ops) { await run(); await new Promise(resolve => setTimeout(resolve, 220)); }
    }
    for (const id of ['editBcCodInput', 'editBcDodInput'] as const) {
        document.getElementById(id)?.remove();
        const input = document.createElement('input'); input.id = id; document.body.appendChild(input); refTo(id)(input);
    }
    if (mode === 'old-marker' || mode === 'rules-reject-old-marker') {
        const strip = barcodeDomain.stripHistoryOnlyMarkers;
        vi.spyOn(barcodeDomain, 'stripHistoryOnlyMarkers').mockImplementation(item => {
            const prior = item.pricePending;
            strip(item);
            if (prior) item.pricePending = prior;
            return item;
        });
    }
    let deniedTrash = 0;
    const originalUpdate = sdk.update;
    sdk.update = (ref: any, values: any) => {
        if ((mode === 'rules-reject-marker' || mode === 'rules-reject-old-marker') && Object.entries(values).some(([key, value]: [string, any]) =>
            [ref.path, key].filter(Boolean).join('/').startsWith('zoew_recently_deleted_cod_dod/') && value?.pricePending !== undefined)) {
            deniedTrash++;
            return Promise.reject(Object.assign(new Error('PERMISSION_DENIED: history-only marker'), { code: 'PERMISSION_DENIED' }));
        }
        return originalUpdate(ref, values);
    };
    let delayed = false;
    const originalTransaction = sdk.runTransaction;
    sdk.runTransaction = async (ref: any, update: any, options: any) => {
        if ((mode === 'rules-reject-marker' || mode === 'rules-reject-old-marker') && ref.path.startsWith('zoew_recently_deleted_cod_dod/')) {
            const candidate = update((await sdk.get(ref)).val());
            if (candidate?.pricePending !== undefined) {
                deniedTrash++;
                throw Object.assign(new Error('PERMISSION_DENIED: history-only marker'), { code: 'PERMISSION_DENIED' });
            }
        }
        if (ref.path.startsWith(H + '/') && !delayed) {
            const candidate = update(clone(store[H][ref.path.slice(H.length + 1)]));
            if (candidate?.pricePending?.phase === 'settled') {
                delayed = true;
                if (mode === 'settlement-aborted') return { committed: false, snapshot: { val: () => clone(store[H].row) } };
                if (mode === 'delayed' || mode === 'old-order') await new Promise(resolve => setTimeout(resolve, 700));
            }
        }
        return originalTransaction(ref, update, options);
    };
    const moneySource = fs.readFileSync('../audit-tools/item-money-integrity-test.js', 'utf8');
    const start = moneySource.indexOf('const fractionalEdit = await page.evaluate(async () => {');
    let body = moneySource.slice(start + 'const fractionalEdit = await page.evaluate('.length, moneySource.indexOf('\n    });', start) + 6);
    if (mode === 'old-order') body = body.replace('await saveEditedBarcodePrice();', 'saveEditedBarcodePrice(); await new Promise(resolve => setTimeout(resolve, 300));')
        .replace(/ {8}const settled =[^\n]+\n {8}if \(settled\?\.phase[^\n]+\n/, '');
    if (mode === 'rules-reject-old-marker') vi.useFakeTimers();
    const context: any = vm.createContext({ window: fixture, document, openEditBarcodePriceModal, saveEditedBarcodePrice, removeSingleBarcode, setTimeout });
    const priorTrash = clone(store.zoew_recently_deleted_cod_dod || {});
    const pending = vm.runInContext('(' + body + ')()', context);
    if (mode === 'rules-reject-old-marker') await vi.advanceTimersByTimeAsync(12000);
    const result = await pending;
    if (mode === 'empty-month' || mode === 'full-sequence-empty') {
        expect(result).toEqual({ reached: true, priceSettled: false });
        expect(Object.values(store[H]).some((row: any) => row.pricePending?.phase === 'history')).toBe(true);
        expect(delayed).toBe(false);
        expect(store.zoew_recently_deleted_cod_dod || {}).toEqual(priorTrash);
        expect(store[M]['2026-10'].codDollar).toBe(0);
        return;
    }
    expect(delayed).toBe(true);
    if (mode === 'old-marker') {
        expect(result.trash).toBe(true);
        expect(result.trashMarkerFree).toBe(false);
        return;
    }
    if (mode === 'rules-reject-old-marker') {
        expect(deniedTrash).toBeGreaterThan(0);
        expect(result.trash).toBe(false);
        expect(result.removed).toMatchObject({ codDollar: 0.01, dodDollar: 0.01, totalCount: 1 });
        return;
    }
    if (mode === 'old-order') {
        expect(result.trash).toBe(false);
        expect(result.removed).toMatchObject({ codDollar: 0.01, dodDollar: 0.01, totalCount: 1 });
        await new Promise(resolve => setTimeout(resolve, 200));
        return;
    }
    if (mode === 'settlement-aborted') {
        expect(result).toEqual({ reached: true, priceSettled: false });
        expect(store[H].row.pricePending.phase).toBe('history');
        expect(store.zoew_recently_deleted_cod_dod || {}).toEqual(priorTrash);
        return;
    }
    expect(result).toMatchObject({ reached: true, priceSettled: true, trash: true, trashMarkerFree: true });
    expect(result.edited).toMatchObject({ cod: 0.01, dod: 0.01 });
    if (mode === 'full-sequence') {
        expect(result.removed.codDollar).toBe(Math.round((result.before.codDollar - result.original.cod) * 100) / 100);
        expect(result.removed.dodDollar).toBe(Math.round((result.before.dodDollar - result.original.dod) * 100) / 100);
    } else expect(result.removed).toMatchObject({ codDollar: 0, dodDollar: 0, totalCount: 0 });
    expect(deniedTrash).toBe(0);
});
