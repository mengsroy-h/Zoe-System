import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo, setFieldValue } from '../src/app/refs';
import { dataState, firebaseState, scanState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import * as clock from '../src/core/clock';
import { pendingRegistryReleases } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { pickupResetRecord } from '../src/domain/pickup';
import { releaseBarcodesInRegistry } from '../src/domain/registry';
import { getFormattedDate } from '../src/core/timezone';
import { addOrUpdateEntry, confirmPhone, triggerScanAction } from '../src/features/scan-action';
import { importZtoListRows } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore, loadZtoPickupStatusOnce, ztoPickupStatus } from '../src/features/zto-status';
import { debouncedRenderAfterHistorySync } from '../src/services/network';
import { createScanEvidenceJournal } from '../src/services/scan-evidence';
import { pendingScanScope, preparePendingScan } from '../src/services/scan-pending';
import { cancelScanOperation, claimScanOperation, resumePendingScanOperations, saveScanOperation } from '../src/services/scan-operation';
import { txResolvingPaths, withTransactionOutcomeResolution } from '../src/services/tx-outcome';

const H = 'zoew_scan_history_cod_dod';
const D = 'zoew_daily_revenue_cod_dod';
const M = 'zoew_monthly_revenue_cod_dod';
const R = 'zoew_barcode_registry';
const HOST = 'https://scan-reboot-closure.firebaseio.com';
const CODE = 'REBOOTSCAN0001';
const NOW = Date.UTC(2026, 9, 24, 2);
const fields = ['modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput'] as const;
const copy = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const parts = (path: string) => path.split('/').filter(Boolean);
let server: any;
let blockReads = false;
let historyFault = '';
let historyAttempts = 0;
let heldRegistryRelease: null | { reached: () => void; wait: Promise<void> } = null;
let applications: { sdk: any; db: any; app: any }[] = [];
const day = () => getFormattedDate(new Date(NOW));
const get = (path: string) => copy(parts(path).reduce((node, key) => node?.[key], server) ?? null);
const money = () => [get(D + '/' + day()), get(M + '/' + day().slice(0, 7))]
    .map(row => [row?.codDollar ?? 0, row?.dodDollar ?? 0, row?.totalCount ?? 0]);
const parcels = () => Object.values(get(H) || {}).flatMap((row: any) => Object.values(row.barcodes || {})) as any[];
const evidence = () => ([1, 2] as const).flatMap(version => createScanEvidenceJournal(localStorage, version).list(pendingScanScope()));
const flush = async () => { for (let n = 0; n < 25; n++) await new Promise(resolve => setTimeout(resolve, 0)); };

function put(path: string, value: any) {
    const keys = parts(path);
    const last = keys.pop()!;
    let target = server;
    for (const key of keys) target = target[key] ||= {};
    if (value === null || value === undefined) delete target[last];
    else if (value?.['.sv'] === 'timestamp') target[last] = NOW;
    else if (typeof value?.['.sv']?.increment === 'number') target[last] = (Number(target[last]) || 0) + value['.sv'].increment;
    else target[last] = copy(value);
}

function reference(path = '') {
    return { path, key: parts(path).at(-1) || null, toString: () => HOST + '/' + path };
}

function snapshot(ref: any, value: any) {
    return { ref, key: ref.key, val: () => copy(value), exists: () => value !== null && value !== undefined };
}

function makeNative() {
    const app = { options: { databaseURL: HOST } };
    const auth = { app, currentUser: { uid: 'scan-owner', getIdToken: async () => 'test-token' } };
    const db = { app };
    const raw = {
        getAuth: () => auth,
        getDatabase: () => db,
        deleteApp: async () => {},
        ref: (_db: any, path = '') => reference(path),
        increment: (amount: number) => ({ '.sv': { increment: amount } }),
        get: async (ref: any) => {
            if (blockReads) throw new TypeError('Failed to fetch');
            return snapshot(ref, get(ref.path));
        },
        update: async (ref: any, updates: any) => {
            const writes = Object.entries(updates).map(([key, value]) => ({ path: [ref.path, key].filter(Boolean).join('/'), value }));
            if (heldRegistryRelease && writes.some(write => write.path.startsWith(R + '/') && write.value === null)) {
                const held = heldRegistryRelease; heldRegistryRelease = null; held.reached(); await held.wait;
            }
            for (const write of writes) {
                const owner = get(write.path);
                if (!write.path.startsWith(R + '/') || write.value !== null || owner?.v !== 2) continue;
                const cancelled = writes.find(entry => entry.path === 'zoew_scan_operations/' + owner.intent)?.value as any;
                const released = writes.find(entry => entry.path === 'zoew_registry_releases/' + owner.intent)?.value as any;
                if (cancelled?.phase !== 'cancelled' && !(released?.kind === 'scan' && released?.id === owner.intent)) {
                    throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
                }
            }
            const touchesHistory = writes.some(write => write.path.startsWith(H + '/'));
            if (touchesHistory && historyFault) {
                historyAttempts++;
                blockReads = true;
                if (historyFault === 'refused') throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
            }
            for (const write of writes) put(write.path, write.value);
            if (touchesHistory && historyFault === 'lost-ack') throw new Error('disconnect');
        },
        set: async (ref: any, value: any) => put(ref.path, value),
        runTransaction: async (ref: any, update: any) => {
            const previous = get(ref.path);
            const next = update(copy(previous));
            if (next === undefined) return { committed: false, snapshot: snapshot(ref, previous) };
            const touchesHistory = ref.path.startsWith(H + '/');
            if (touchesHistory && historyFault) {
                historyAttempts++;
                blockReads = true;
                if (historyFault === 'refused') throw Object.assign(new Error('disconnect'), { txOutcome: 'unknown' });
            }
            put(ref.path, next);
            if (touchesHistory && historyFault === 'lost-ack') throw Object.assign(new Error('disconnect'), { txOutcome: 'unknown' });
            return { committed: true, snapshot: snapshot(ref, get(ref.path)) };
        },
        onValue: () => () => {},
        off: () => {}
    };
    const sdk = withTransactionOutcomeResolution(raw);
    sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
        isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true,
        sessionExpiryCheck: 'live', authLoginOperation: null, dbLivenessProbe: Promise.resolve(null) });
    firebaseState.dbRefHistory = sdk.ref(db, H);
    firebaseState.dbRefDailyRevenue = sdk.ref(db, D);
    firebaseState.dbRefMonthlyRevenue = sdk.ref(db, M);
    const result = { sdk, db, app };
    applications.push(result);
    return result;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('confirm', () => true);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    localStorage.clear(); pendingRegistryReleases.clear(); clearZtoPickupStatusStore();
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    txResolvingPaths.clear();
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    blockReads = false; historyFault = ''; historyAttempts = 0; heldRegistryRelease = null; applications = [];
    const old = { id: 'existing-row', phone: '012000111', scanDate: day(), time: '09:00:00 (' + day() + ')',
        createdAt: NOW - 60000, count: 1, cod: 10, dod: 0, price: 10, isClosed: false, isCalled: false,
        barcode: 'EXISTING0001', barcodes: [{ code: 'EXISTING0001', cod: 10, dod: 0, createdAt: NOW - 60000,
            isClosed: false, isDeducted: false, isFromDeletion: false }] };
    server = { [H]: { [old.id]: old }, [D]: { [day()]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
        [M]: { [day().slice(0, 7)]: { codDollar: 10, dodDollar: 0, totalCount: 1 } }, [R]: { EXISTING0001: true } };
    dataState.scanHistory = [copy(old)]; dataState.deletedItems = [];
    dataState.dailyRevenueData = get(D); dataState.monthlyRevenueData = get(M);
    dataState.dailyCollectedData = {}; dataState.dailyPickupData = {};
    scanState.pendingBarcode = ''; scanState.pendingScanSession = null;
    viewState.phoneModalBusy = false; uiState.modalDisplay = {}; uiState.isModalOpen = false; uiState.toasts = [];
    uiState.entryScanMode = 'add'; uiState.lastEnteredLocker = '';
    ztoState.ztoListSyncInFlight = false; ztoState.ztoListSyncResult = null;
    firebaseState.authGeneration++;
    for (const field of fields) refTo(field)(document.createElement('input'));
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
        if (blockReads) throw new TypeError('Failed to fetch');
        const path = decodeURIComponent(new URL(String(url)).pathname).replace(/^\//, '').replace(/\.json$/, '');
        return new Response(JSON.stringify(get(path)), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    (window as any).ZoeErrors = { capture: vi.fn() };
});

afterEach(async () => {
    firebaseState.authGeneration++;
    for (const app of applications) await app.sdk.deleteApp(app.app);
    for (const field of fields) refTo(field)(null);
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
    delete (window as any).ZoeErrors;
});

async function scanThrough(route: string, target: string, code = CODE, cod = 5) {
    if (route === 'confirmPhone') {
        triggerScanAction(code);
        setFieldValue('modalCodInput', String(cod)); setFieldValue('modalDodInput', '0');
        if (target === 'merge') setFieldValue('modalPhoneInput', '012000111');
        return confirmPhone(target !== 'merge');
    }
    ztoState.ztoListSyncResult = { rows: [{ barcode: code, phone: target === 'merge' ? '012000111' : '012999888', cod, dod: 0,
        at: '2026-10-24 09:00:00', ztoClosed: null, skip: '', from: 'fixture' }], signedRows: [],
        from: '2026-10-24', to: '2026-10-24', total: 1 } as any;
    return importZtoListRows();
}

for (const route of ['confirmPhone', 'importZtoListRows']) describe(route + ' BM07 restart', () => {
    for (const target of ['new', 'merge']) for (const fault of ['refused', 'lost-ack']) it(target + ' ' + fault + ' ៖ បើក App វិញត្រូវផ្ទៀងបញ្ជីនិងប្រាក់ មិនបូកឬដកពីរដង', async () => {
        const first = makeNative(); historyFault = fault;
        const saving = scanThrough(route, target).catch(error => error);
        await vi.waitFor(() => expect(historyAttempts).toBeGreaterThan(0), { timeout: 2000 });
        await flush();
        expect(historyAttempts, 'ត្រូវទៅដល់ history write ពិតតាមផ្លូវស្កេន').toBeGreaterThan(0);
        expect(evidence(), 'លទ្ធផលមិនច្បាស់ត្រូវមានភស្តុតាង មុនបិទ App').toHaveLength(1);
        expect(parcels().some(barcode => barcode.code === CODE)).toBe(fault === 'lost-ack');

        await first.sdk.deleteApp(first.app); firebaseState.authGeneration++;
        // បិទ process បាត់តែ resolver ក្នុង RAM; journal ក្នុង storage នៅដដែល។
        txResolvingPaths.clear();
        void saving;
        blockReads = false; historyFault = '';
        const second = makeNative();
        await second.sdk.retryWriteRecovery(second.db);
        dataState.scanHistory = Object.values(get(H));
        dataState.dailyRevenueData = get(D); dataState.monthlyRevenueData = get(M);
        debouncedRenderAfterHistorySync();
        await resumePendingScanOperations();
        await flush();

        const expectedMoney = fault === 'lost-ack' ? [[15, 0, 2], [15, 0, 2]] : [[10, 0, 1], [10, 0, 1]];
        expect(money(), 'ប្រាក់ដែលគ្មានកញ្ចប់មិនអាចទុកថាបញ្ចប់; កញ្ចប់បានរក្សាទុកមិនអាចដកម្ដងទៀត').toEqual(expectedMoney);
        expect(get(R + '/' + CODE), 'ដោះសោបានតែក្រោយភស្តុតាងមិនបានរក្សាទុក និងប្រាក់មិនសល់').toEqual(fault === 'lost-ack'
            ? expect.objectContaining({ v: 2, actorUid: 'scan-owner', birth: NOW }) : null);
        expect(evidence(), 'receipt ដែលបានផ្ទៀងត្រូវបញ្ចប់; មិនសម្គាល់ HOLD ជា closure').toEqual([]);
        const settled = copy(server);
        await second.sdk.retryWriteRecovery(second.db);
        debouncedRenderAfterHistorySync();
        await resumePendingScanOperations();
        expect(server, 'ការស្តារម្ដងទៀតមិនអាចប្តូរប្រាក់ឬជីវិត Barcode').toEqual(settled);
    }, 15000);
});

it('ស្កេន 0.10 + 0.20 + 0.10 មិន HOLD ដោយសំណល់ IEEE របស់ server increment', async () => {
    makeNative();
    put(D + '/' + day(), { codDollar: 0.1, dodDollar: 0, totalCount: 1 });
    put(M + '/' + day().slice(0, 7), { codDollar: 0.1, dodDollar: 0, totalCount: 1 });
    server[H]['existing-row'].barcodes[0].cod = 0.1;
    Object.assign(server[H]['existing-row'], { cod: 0.1, price: 0.1 });
    dataState.scanHistory = Object.values(get(H));
    await scanThrough('confirmPhone', 'new', 'DECIMAL0001', 0.2);
    await scanThrough('confirmPhone', 'new', 'DECIMAL0002', 0.1);
    expect(money().map(bucket => [Math.round(bucket[0] * 100), bucket[2]])).toEqual([[40, 3], [40, 3]]);
    expect(parcels().filter(barcode => barcode.code.startsWith('DECIMAL'))).toHaveLength(2);
    expect(evidence()).toEqual([]);
});

it('server operation key ខូច មិនអនុញ្ញាត claim/finalize/cancel ឬដោះសោដែលកំពុងកាន់', async () => {
    makeNative();
    const handle = preparePendingScan(CODE, 5, 0, NOW, 'direct', 2);
    expect(await claimScanOperation(handle, CODE)).toBe('claimed');
    const path = 'zoew_scan_operations/' + handle.record.id;
    const corrupted = get(path); corrupted.registryKey = 'OTHER'; put(path, corrupted);
    const before = copy(server);
    expect(await claimScanOperation(handle, CODE)).toBe('unknown');
    expect(await saveScanOperation(handle, '012345678', 'A')).toBe('unknown');
    expect(await cancelScanOperation(handle)).toBe(false);
    await resumePendingScanOperations();
    expect(server).toEqual(before);
    expect(evidence()).toHaveLength(1);
});

for (const state of ['evicted', 'pruned-recreated', 'present']) it('prepared save ចូលម្ដងទៀត month witness ' + state + ' មិនបង្កើត permission ថ្មី', async () => {
    makeNative();
    const handle = preparePendingScan(CODE, 5, 0, NOW, 'direct', 2);
    const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ phone: '012345678', locker: 'A', closedAt: 0 })));
    const payloadHash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    const id = handle.record.id; const monthToken = 'op_m' + id.slice(5);
    const operation = { v: 2, id, actorUid: 'scan-owner', scope: HOST, code: CODE, registryKey: CODE, birth: NOW,
        scanDate: day(), month: day().slice(0, 7), cod: 5, dod: 0, count: 1, monthToken, phase: 'prepared',
        targetId: 'prepared-row', payloadHash, phone: '012345678', locker: 'A', closedAt: 0 };
    put('zoew_scan_operations/' + id, operation);
    put('zoew_scan_pending/' + id, 'scan-owner');
    put(R + '/' + CODE, { v: 2, intent: id, actorUid: 'scan-owner', birth: NOW });
    if (state === 'pruned-recreated') put(M + '/' + operation.month, { codDollar: 10, dodDollar: 0, totalCount: 1, op: 'op_other_stamp', ops: { op_other_stamp: 1 } });
    if (state === 'present') put(M + '/' + operation.month, { codDollar: 10, dodDollar: 0, totalCount: 1, op: monthToken, ops: { [monthToken]: 1 } });
    const before = copy(server);
    const result = await addOrUpdateEntry(CODE, operation.phone, 5, 0, operation.locker, NOW, 0, handle);
    if (state === 'present') {
        expect(result).toBe(true);
        expect(money()).toEqual([[15, 0, 2], [15, 0, 2]]);
        expect(evidence()).toEqual([]);
    } else {
        expect(result).toBe('unknown');
        expect(server).toEqual(before);
        expect(evidence()).toHaveLength(1);
    }
});


it('release ចាស់ដែលយឺត មិនអាចលុប registry របស់ស្កេន v2 កើតថ្មីក្រោយ finalize', async () => {
    makeNative(); put(R + '/' + CODE, true);
    let started!: () => void; let send!: () => void;
    const reached = new Promise<void>(resolve => { started = resolve; });
    heldRegistryRelease = { reached: started, wait: new Promise<void>(resolve => { send = resolve; }) };
    const oldRelease = releaseBarcodesInRegistry([CODE]);
    await reached;
    expect(await releaseBarcodesInRegistry([CODE]), 'ការលុបជីវិតចាស់របស់ឧបករណ៍ទីពីរ ACK').toBe(true);
    expect(get(R + '/' + CODE)).toBeNull();
    await scanThrough('confirmPhone', 'new');
    expect(parcels().some(barcode => barcode.code === CODE)).toBe(true);
    expect(money()).toEqual([[15, 0, 2], [15, 0, 2]]);
    expect(evidence()).toEqual([]);
    const before = copy(server);
    expect(before[R][CODE]).toEqual(expect.objectContaining({ v: 2, actorUid: 'scan-owner', birth: NOW }));
    send(); expect(await oldRelease).toBe(false);
    expect(get(R + '/' + CODE), 'request ចាស់មិនមានសិទ្ធិលុប claim កើតថ្មី').toEqual(before[R][CODE]);
    expect(get(H)).toEqual(before[H]);
    expect(money()).toEqual([[15, 0, 2], [15, 0, 2]]);
});

it('release legacy true ដដែលនៅតែសម្រេចបានដោយ ACK', async () => {
    makeNative(); put(R + '/' + CODE, true);
    expect(await releaseBarcodesInRegistry([CODE])).toBe(true);
    expect(get(R + '/' + CODE)).toBeNull();
});


for (const reset of [false, true]) it('born-closed import៖ reboot ត្រូវស្មើធម្មតា និងមិនស្ដារ pickup ក្រោយ Reset=' + reset, async () => {
    vi.spyOn(clock, 'getServerNow').mockReturnValue(NOW);
    const initial = copy(server);
    const start = async () => {
        ztoState.ztoListSyncResult = { rows: [{ barcode: CODE, phone: '012999888', cod: 5, dod: 0, at: '2026-10-24 09:00:00',
            ztoClosed: true, skip: '', from: 'fixture' }], signedRows: [], from: day(), to: day(), total: 1 } as any;
        return importZtoListRows();
    };
    const projection = () => ({ money: money(), barcode: (() => { const barcode = copy(parcels().find(barcode => barcode.code === CODE)); if (barcode) { expect(barcode.scanIntent).toMatch(/^scan_[a-f0-9]{32}$/); delete barcode.scanIntent; } return barcode; })(),
        pickup: get('zoew_daily_pickup_cod_dod'), collected: get('zoew_daily_collected_cod_dod'), sign: copy(ztoPickupStatus.get(CODE)) });
    const first = makeNative(); await start();
    expect(money()).toEqual([[15, 0, 2], [15, 0, 2]]);
    expect(parcels().find(barcode => barcode.code === CODE)?.isClosed).toBe(true);
    await first.sdk.deleteApp(first.app);
    ztoPickupStatus.clear(); ztoState.ztoStatusLoaded = false; loadZtoPickupStatusOnce();
    const normal = projection();
    firebaseState.authGeneration++; txResolvingPaths.clear();
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    clearZtoPickupStatusStore(); server = copy(initial); dataState.scanHistory = Object.values(get(H));
    dataState.dailyRevenueData = get(D); dataState.monthlyRevenueData = get(M);
    dataState.dailyPickupData = {}; dataState.dailyCollectedData = {};
    const crashing = makeNative(); historyFault = 'lost-ack'; historyAttempts = 0;
    void start(); await vi.waitFor(() => expect(historyAttempts).toBeGreaterThan(0)); await flush();
    await crashing.sdk.deleteApp(crashing.app); firebaseState.authGeneration++; txResolvingPaths.clear();
    blockReads = false; historyFault = ''; makeNative();
    if (reset) { put('zoew_daily_pickup_cod_dod/' + day(), pickupResetRecord({ pickupResetEpoch: 0, pickupRevision: 1, packagesPickedUp: 1 })); dataState.dailyPickupData = get('zoew_daily_pickup_cod_dod'); }
    dataState.scanHistory = Object.values(get(H));
    await resumePendingScanOperations(); await flush();
    ztoPickupStatus.clear(); ztoState.ztoStatusLoaded = false; loadZtoPickupStatusOnce();
    const recovered = projection();
    expect.soft(recovered.money).toEqual(normal.money);
    expect.soft(recovered.barcode).toEqual(normal.barcode);
    expect.soft(recovered.collected).toEqual(normal.collected);
    expect.soft(recovered.sign).toEqual(normal.sign);
    expect(normal.pickup?.[day()]?.packagesPickedUp || 0).toBe(0);
    expect.soft(recovered.pickup?.[day()]?.packagesPickedUp || 0).toBe(0);
    expect.soft(recovered.pickup?.[day()]?.pickupResetEpoch || 0).toBe(reset ? 1 : 0);
    expect(evidence()).toEqual([]);
}, 15000);
