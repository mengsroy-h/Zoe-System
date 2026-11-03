import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { pendingRegistryReleases } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { runAutomaticDeletedCleanup } from '../src/domain/cleanup';
import { activeRestoreClaims, executePermanentDelete, restoreCancellationInFlight, restoreInFlight, restoreRecoveryHolds } from '../src/features/restore';
import { resetZtoFinalMarks } from '../src/features/zto-final-marks';
import { ztoPickupStatus } from '../src/features/zto-status';
import { purgeTrashWithRegistry } from '../src/services/registry-purge';
import { cleanupServerRead } from './helpers/cleanup-server-read';

/**
 * ធាតុធុងសំរាម «ត្រឡប់» · «ដក» ត្រូវកាត់ COD/DOD/ចំនួនកញ្ចប់ពី ledger (keyed event · `ded/<trashId>` ក្នុងថ្ងៃ និងខែ) ហើយ flag `isDeducted`
 * តាមក្រោយ។ ពេលការកាត់មិនទាន់ដល់ (ឧបករណ៍ដែលដកបាត់អ៊ីនធឺណិត ឬបិទ App) ចំណូលយករួចនៅត្រឹមត្រូវ ព្រោះ copy ក្នុងធុងសំរាមរាប់ជា «មិនទាន់យក»។
 * មុនកែ ៖ purge ស្វ័យប្រវត្តិ (២ ថ្ងៃ) ឬ ✖️ លុប copy នោះ ➜ journal របស់ឧបករណ៍ដើមឃើញ consumed ហើយមិនកាត់ទៀត ➜ ចំណូលលើសជារៀងរហូត
 * គ្មាន toast គ្មាន Sentry។ ឥឡូវ purge រង់ចាំ receipt ការកាត់ទាំងពីរ (ឬ flag) មុនលុប។
 */

const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', R = 'zoew_barcode_registry';
const D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const NOW = Date.UTC(2026, 9, 30, 9), DAY = '2026-10-28', CODE = 'PENDINGDED01', BIRTH = NOW - 3 * 86400000;
const deletedAtOf = (reason: string) => reason === 'returned' ? NOW - 2 * 86400000 - 60000 : NOW - 31 * 86400000;
const HOST = 'https://purge-deduction-pending.firebaseio.com';
const clone = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
let store: Record<string, any>;
let purgeWrites = 0;
function at(path: string): any { return clone(path.split('/').filter(Boolean).reduce((value, key) => value?.[key], store) ?? null); }
function put(path: string, value: any) {
    const keys = path.split('/').filter(Boolean); let target = store;
    for (const key of keys.slice(0, -1)) target = target[key] ||= {};
    if (value == null) delete target[keys.at(-1)!]; else target[keys.at(-1)!] = clone(value);
}
const ref = (_db: any, path = '') => ({ path, key: path.split('/').at(-1), toString: () => HOST + '/' + path });
const snap = (value: any) => ({ val: () => clone(value), exists: () => value != null });

function trashItem(reason: string, deducted: boolean) {
    return { id: 'source', phone: '012345678', scanDate: DAY, time: '08:00:00 (' + DAY + ')', createdAt: BIRTH,
        count: 1, cod: 7, dod: 2, price: 9, isClosed: false, isCalled: false, barcode: CODE,
        deletedAt: deletedAtOf(reason), trashReason: reason, trashMode: 'local', isFromDeletion: reason === 'delete',
        barcodes: [{ code: CODE, cod: 7, dod: 2, time: '08:00:00 (' + DAY + ')', locker: 'N/A', createdAt: BIRTH, isClosed: false,
            isFromDeletion: reason === 'delete', isDeducted: deducted }] };
}

function arrange(reason: string, deducted: boolean, receipts: 'none' | 'daily' | 'both' = 'none') {
    const source = trashItem(reason, deducted);
    const ded = { source: { at: deletedAtOf(reason), cod: 7, dod: 2, count: 1 } };
    store = { [H]: {}, [T]: { source }, [R]: { [CODE]: true },
        [D]: { [DAY]: { codDollar: 7, dodDollar: 2, totalCount: 1, ...(receipts !== 'none' ? { ded } : {}) } },
        [M]: { '2026-10': { codDollar: 7, dodDollar: 2, totalCount: 1, ...(receipts === 'both' ? { ded } : {}) } } };
    dataState.deletedItems = [clone(source)];
    dataState.dailyRevenueData = clone(store[D]); dataState.monthlyRevenueData = clone(store[M]);
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    purgeWrites = 0; pendingRegistryReleases.clear();
    activeRestoreClaims.clear(); restoreInFlight.clear(); restoreCancellationInFlight.clear(); restoreRecoveryHolds.clear();
    ztoPickupStatus.clear(); resetZtoFinalMarks(); dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    ztoState.ztoStatusLoaded = true;
    ztoState.ztoTrashMode = { state: 'off', palmAt: 0, cookieAt: 0, failedAt: 0, stamps: {}, shop: HOST };
    firebaseState.authGeneration++;
    firebaseState.db = { app: { options: { databaseURL: HOST } } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.auth = { currentUser: { uid: 'purge-user', getIdToken: async () => 'synthetic-token' } } as any;
    firebaseState.isInitializingFirebase = false; firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0; firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.fb = {
        ref, increment: (n: number) => ({ inc: n }), get: async (target: any) => snap(at(target.path)),
        runTransaction: async (target: any, update: any) => {
            const value = update(at(target.path));
            if (value === undefined) return { committed: false, snapshot: snap(at(target.path)) };
            put(target.path, value);
            return { committed: true, snapshot: snap(at(target.path)) };
        },
        update: async (target: any, patch: Record<string, any>) => {
            if (patch[T + '/source'] === null) purgeWrites++;
            for (const [key, value] of Object.entries(patch)) put([target.path, key].filter(Boolean).join('/'), value);
        }, onValue: () => () => {}, off: () => {}
    } as any;
    for (const [field, path] of Object.entries({ dbRefHistory: H, dbRefDeleted: T, dbRefDailyRevenue: D, dbRefMonthlyRevenue: M,
        dbRefDailyPickup: 'zoew_daily_pickup_cod_dod', dbRefDailyCollected: 'zoew_daily_collected_cod_dod' })) (firebaseState as any)[field] = ref(firebaseState.db, path);
    dataState.scanHistory = []; dataState.dailyPickupData = {}; dataState.dailyCollectedData = {};
    dataState.pickupResumeInFlight = false; dataState.registryReleaseFlushInFlight = false; dataState.deletedCleanupInFlight = false;
    uiState.toasts = []; uiState.pendingPermanentDeleteId = null; uiState.pendingRestoreId = null;
    vi.stubGlobal('fetch', cleanupServerRead(at, () => {})); vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', vi.fn());
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => { firebaseState.authGeneration++; vi.useRealTimers(); vi.unstubAllGlobals(); delete (window as any).ZoeErrors; });

for (const reason of ['returned', 'remove']) {
    it(reason + ' ៖ purge ស្វ័យប្រវត្តិរង់ចាំ ពេលការកាត់មិនទាន់ដល់ (គ្មាន flag · គ្មាន receipt) ➜ copy នៅ ចំណូលមិនលើស', async () => {
        arrange(reason, false);
        const before = clone(store);
        await runAutomaticDeletedCleanup();
        expect(purgeWrites, 'មិនលុប copy ដែលនៅត្រូវកាត់').toBe(0);
        expect(store).toEqual(before);
        expect(dataState.deletedItems.map(item => item.id)).toEqual(['source']);
        await runAutomaticDeletedCleanup();
        expect(uiState.toasts.map(toast => toast.msg), 'ការរង់ចាំការដកប្រាក់មិនបង្ហាញ toast រៀងរាល់ cycle').toEqual([]);
    });

    it(reason + ' ៖ ✖️ លុបដោយដៃក៏រង់ចាំដូចគ្នា (គ្មាន receipt ខែ)', async () => {
        arrange(reason, false, 'daily');
        const before = clone(store);
        uiState.pendingPermanentDeleteId = 'source';
        await executePermanentDelete();
        expect(purgeWrites).toBe(0);
        expect(store).toEqual(before);
        expect(uiState.toasts.map(toast => toast.msg).join(' | ')).toContain('ការដកប្រាក់នៃកញ្ចប់នេះមិនទាន់បញ្ចប់នៅឧបករណ៍ដែលដក ឬសម្អាត');
    });

    it(reason + ' ៖ control ៖ receipt ថ្ងៃ និងខែមាន (ការកាត់ដល់ · flag មិនទាន់ flip) ➜ purge បាន', async () => {
        arrange(reason, false, 'both');
        expect(await purgeTrashWithRegistry(clone(at(T + '/source')))).toBe(true);
        expect(at(T + '/source')).toBeNull();
        expect(purgeWrites).toBe(1);
    });

    it(reason + ' ៖ control ៖ flag isDeducted រួច ➜ purge ស្វ័យប្រវត្តិលុបបានដោយមិនត្រូវការ receipt (ធាតុហួសរយៈរក្សាពិត)', async () => {
        arrange(reason, true);
        await runAutomaticDeletedCleanup();
        expect(purgeWrites).toBe(1);
        expect(at(T + '/source')).toBeNull();
    });
}

for (const reason of ['delete', 'pickup']) it(reason + ' ៖ control ៖ ធាតុដែលមិនកាត់លុយ purge បានដោយមិនត្រូវការ receipt', async () => {
    arrange(reason, false);
    expect(await purgeTrashWithRegistry(clone(at(T + '/source')))).toBe(true);
    expect(at(T + '/source')).toBeNull();
});

it('control ៖ ធាតុគ្មាន trashReason (ទម្រង់ចាស់) មិនរង់ចាំ receipt ដូច sweep និងការស្តារ ➜ purge បាន', async () => {
    arrange('returned', false);
    const legacy = at(T + '/source'); delete legacy.trashReason; delete legacy.isFromDeletion; put(T + '/source', legacy);
    expect(await purgeTrashWithRegistry(clone(at(T + '/source')))).toBe(true);
    expect(at(T + '/source')).toBeNull();
});
