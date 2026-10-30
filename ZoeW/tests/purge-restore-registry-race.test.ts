import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { pendingRegistryReleases } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { activeRestoreClaims, executePermanentDelete, executeRestoreItem, restoreCancellationInFlight, restoreInFlight, restoreRecoveryHolds } from '../src/features/restore';
import { resetZtoFinalMarks } from '../src/features/zto-final-marks';
import { ztoPickupStatus } from '../src/features/zto-status';
import { cleanupServerRead } from './helpers/cleanup-server-read';

const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', R = 'zoew_barcode_registry';
const D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const NOW = Date.UTC(2026, 9, 30, 9), DAY = '2026-10-30', CODE = 'PURGE000001', BIRTH = NOW - 3600000;
const HOST = 'https://purge-restore.firebaseio.com';
const clone = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
let store: Record<string, any>, events: { kind: string; path: string; value?: any }[];
let purgeGate: null | { entered: () => void; wait: Promise<void> };
function at(path: string) { return clone(path.split('/').filter(Boolean).reduce((value, key) => value?.[key], store) ?? null); }
function put(path: string, value: any) {
    const keys = path.split('/').filter(Boolean); let target = store;
    for (const key of keys.slice(0, -1)) target = target[key] ||= {};
    if (value == null) delete target[keys.at(-1)!]; else target[keys.at(-1)!] = clone(value);
}
const ref = (_db: any, path = '') => ({ path, key: path.split('/').at(-1), toString: () => HOST + '/' + path });
const snap = (value: any) => ({ val: () => clone(value), exists: () => value != null });
const money = () => ({ daily: at(D), monthly: at(M) });
function deferred() { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; }

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    events = []; purgeGate = null; pendingRegistryReleases.clear();
    activeRestoreClaims.clear(); restoreInFlight.clear(); restoreCancellationInFlight.clear(); restoreRecoveryHolds.clear();
    ztoPickupStatus.clear(); resetZtoFinalMarks(); dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    ztoState.ztoStatusLoaded = true;
    ztoState.ztoTrashMode = { state: 'off', palmAt: 0, cookieAt: 0, failedAt: 0, stamps: {}, shop: HOST };
    const source = { id: 'source', phone: '012345678', scanDate: DAY, time: '08:00:00 (' + DAY + ')', createdAt: BIRTH,
        count: 1, cod: 7, dod: 0, price: 7, isClosed: false, isCalled: false, barcode: CODE,
        deletedAt: NOW - 1000, trashReason: 'delete', trashMode: 'local', isFromDeletion: true,
        barcodes: [{ code: CODE, cod: 7, dod: 0, time: '08:00:00 (' + DAY + ')', locker: 'N/A', createdAt: BIRTH, isClosed: false, isFromDeletion: true, isDeducted: false }] };
    store = { [H]: {}, [T]: { source }, [R]: { [CODE]: true }, [D]: { [DAY]: { codDollar: 7, dodDollar: 0, totalCount: 1 } }, [M]: { '2026-10': { codDollar: 7, dodDollar: 0, totalCount: 1 } } };
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
            events.push({ kind: 'transaction', path: target.path, value: clone(value) }); put(target.path, value);
            return { committed: true, snapshot: snap(at(target.path)) };
        },
        update: async (target: any, patch: Record<string, any>) => {
            if (purgeGate && (target.path === T && patch.source === null || target.path === '' && patch[T + '/source'] === null && Object.keys(patch).some(path => path.startsWith('zoew_registry_releases/')))) {
                events.push({ kind: 'purge-issued', path: T + '/source', value: at(T + '/source') });
                purgeGate.entered(); await purgeGate.wait;
                events.push({ kind: 'purge-before-commit', path: T + '/source', value: at(T + '/source') });
            }
            const receipts = Object.entries(patch).filter(([path]) => path.startsWith('zoew_registry_releases/'));
            for (const [path, receipt] of receipts) {
                const source = at(T + '/' + receipt.trashId), barcode = source?.barcodes?.[receipt.slot];
                if (target.path !== '' || at(path) !== null || !source || source.restoreClaim || source.deletedAt !== receipt.deletedAt
                    || (source.createdAt || 0) !== receipt.rowBirth || source.count !== receipt.rowCount || !barcode || barcode.code !== receipt.code
                    || (barcode.createdAt || 0) !== receipt.birth || patch[T + '/' + receipt.trashId] !== null || patch[R + '/' + receipt.registryKey] !== null)
                    throw Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' });
            }
            for (const [key, value] of Object.entries(patch)) {
                const path = [target.path, key].filter(Boolean).join('/');
                events.push({ kind: 'update', path, value: clone(value) });
                put(path, value && typeof value === 'object' && 'inc' in value ? Number(at(path) || 0) + Number(value.inc) : value);
            }
        }, onValue: () => () => {}, off: () => {}
    } as any;
    for (const [field, path] of Object.entries({ dbRefHistory: H, dbRefDeleted: T, dbRefDailyRevenue: D, dbRefMonthlyRevenue: M,
        dbRefDailyPickup: 'zoew_daily_pickup_cod_dod', dbRefDailyCollected: 'zoew_daily_collected_cod_dod' })) (firebaseState as any)[field] = ref(firebaseState.db, path);
    dataState.scanHistory = []; dataState.deletedItems = [clone(source)]; dataState.dailyRevenueData = clone(store[D]); dataState.monthlyRevenueData = clone(store[M]);
    dataState.dailyPickupData = {}; dataState.dailyCollectedData = {}; dataState.pickupResumeInFlight = false; dataState.registryReleaseFlushInFlight = false;
    uiState.toasts = []; uiState.pendingPermanentDeleteId = null; uiState.pendingRestoreId = null;
    vi.stubGlobal('fetch', cleanupServerRead(at)); vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', vi.fn());
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => { firebaseState.authGeneration++; vi.useRealTimers(); vi.unstubAllGlobals(); delete (window as any).ZoeErrors; });

it('purge/Restore ៖ Delete រួចមិនដកប្រាក់ ហើយ purge ធម្មតាដោះ registry ដើមបាន', async () => {
    const before = money(); uiState.pendingPermanentDeleteId = 'source';
    await executePermanentDelete();
    await vi.waitFor(() => expect(at(R + '/' + CODE)).toBeNull());
    expect(at(T + '/source')).toBeNull(); expect(at(H)).toEqual({}); expect(money()).toEqual(before);
    expect(events.some(event => event.path === R + '/' + CODE && event.value === null)).toBe(true);
});

it('purge/Restore ៖ null ACK មកក្រោយ Restore ជីវិតដើម មិនអាចដោះ registry របស់ history ដែលស្តាររួច', async () => {
    const before = money(); const source = at(T + '/source');
    expect(source.trashReason).toBe('delete'); expect(source.isFromDeletion).toBe(true); expect(source.barcodes[0].isDeducted).toBe(false);
    const entered = deferred(), released = deferred(); purgeGate = { entered: entered.resolve, wait: released.promise };
    uiState.pendingPermanentDeleteId = 'source'; const purge = executePermanentDelete();
    await entered.promise;
    expect(dataState.deletedItems).toEqual([source]); expect(at(T + '/source')).toEqual(source); expect(at(R + '/' + CODE)).toBe(true);
    dataState.deletedItems = [clone(at(T + '/source'))];
    events.push({ kind: 'device-b-view', path: T + '/source', value: at(T + '/source') });
    uiState.pendingRestoreId = 'source'; await executeRestoreItem();
    const restored = at(H + '/source');
    expect(restored.barcodes).toEqual([expect.objectContaining({ code: CODE, createdAt: BIRTH, cod: 7, dod: 0, isDeducted: false, isFromDeletion: false })]);
    expect(restored.restoreClaimId).toBeUndefined(); expect(restored.restoreClaimToken).toBeUndefined();
    expect(at(T + '/source')).toBeNull(); expect(at('zoew_restore_finalizations/source')).toBeNull(); expect(money()).toEqual(before);
    expect(at(R + '/' + CODE)).toBe(true);
    released.resolve(); await purge;
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(events.find(event => event.kind === 'purge-before-commit')?.value).toBeNull();
    expect(at(H + '/source')).toEqual(restored); expect(money()).toEqual(before);
    expect(at(R + '/' + CODE), JSON.stringify({ events: events.map(({ kind, path, value }) => ({ kind, path, absent: value === null })),
        restoredBirth: restored.barcodes[0].createdAt, moneyBefore: before, moneyAfter: money(), registry: at(R + '/' + CODE) })).toBe(true);
});
