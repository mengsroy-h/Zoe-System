import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { pendingRegistryReleases } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { noteCleanupJournalEntry, PURGE_DEDUCTION_RETRY_MS, purgeDeductionWaits, readCleanupJournal, resumeCleanupJournalEntry, runAutomaticDeletedCleanup } from '../src/domain/cleanup';
import { activeRestoreClaims, executePermanentDelete, restoreCancellationInFlight, restoreInFlight, restoreRecoveryHolds } from '../src/features/restore';
import { resetZtoFinalMarks } from '../src/features/zto-final-marks';
import { ztoPickupStatus } from '../src/features/zto-status';
import { purgeTrashWithRegistry } from '../src/services/registry-purge';
import { cleanupServerRead } from './helpers/cleanup-server-read';
import { prunedPut, purgesSource, slotPurgeAdmitted } from './helpers/purge-slot-model';

/**
 * ធាតុធុងសំរាម «ត្រឡប់» · «ដក» ត្រូវកាត់ COD/DOD/ចំនួនកញ្ចប់ពី ledger (keyed event · `ded/<trashId>` ក្នុងថ្ងៃ និងខែ) ហើយ flag `isDeducted`
 * តាមក្រោយ។ ពេលការកាត់មិនទាន់ដល់ (ឧបករណ៍ដែលដកបាត់អ៊ីនធឺណិត ឬបិទ App) ចំណូលយករួចនៅត្រឹមត្រូវ ព្រោះ copy ក្នុងធុងសំរាមរាប់ជា «មិនទាន់យក»។
 * មុនកែ ៖ purge ស្វ័យប្រវត្តិ (២ ថ្ងៃ) ឬ ✖️ លុប copy នោះ ➜ journal របស់ឧបករណ៍ដើមឃើញ consumed ហើយមិនកាត់ទៀត ➜ ចំណូលលើសជារៀងរហូត
 * គ្មាន toast គ្មាន Sentry។ ឥឡូវ purge រង់ចាំ receipt ការកាត់ទាំងពីរ (ឬ flag) មុនលុប។
 * ផ្លូវចេញ (A522) ៖ ពេលធាតុផុតរយៈរក្សាទុក ហើយឧបករណ៍នេះគ្មាន journal របស់វា ឧបករណ៍ដែល purge ដក keyed event ដដែល
 * (`ded/<trashId>` · token `ledgerEventToken(trashId, deletedAt, 'd')`) ពី copy របស់ server ដោយខ្លួនឯង រួច purge ➜ ការដកចុះម្តង
 * ទោះឧបករណ៍ដើមត្រឡប់មកវិញ (journal ឃើញ consumed) ⛔ មិនជាប់ក្នុងធុងសំរាមជារៀងរហូត។
 */

const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', R = 'zoew_barcode_registry';
const D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const NOW = Date.UTC(2026, 9, 30, 9), DAY = '2026-10-28', CODE = 'PENDINGDED01', BIRTH = NOW - 3 * 86400000;
const deletedAtOf = (reason: string) => reason === 'returned' ? NOW - 2 * 86400000 - 60000 : NOW - 31 * 86400000;
const HOST = 'https://purge-deduction-pending.firebaseio.com';
const clone = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
let store: Record<string, any>;
let purgeWrites = 0;
let refuseLedger = false;
let ledgerTx = 0;
function at(path: string): any { return clone(path.split('/').filter(Boolean).reduce((value, key) => value?.[key], store) ?? null); }
function put(path: string, value: any) { prunedPut(store, path, value); }
const ref = (_db: any, path = '') => ({ path, key: path.split('/').at(-1), toString: () => HOST + '/' + path });
const snap = (value: any) => ({ val: () => clone(value), exists: () => value != null });
const totals = (record: any) => [record?.codDollar ?? 0, record?.dodDollar ?? 0, record?.totalCount ?? 0];

function trashItem(reason: string, deducted: boolean) {
    return { id: 'source', phone: '012345678', scanDate: DAY, time: '08:00:00 (' + DAY + ')', createdAt: BIRTH,
        count: 1, cod: 7, dod: 2, price: 9, isClosed: false, isCalled: false, barcode: CODE,
        deletedAt: deletedAtOf(reason), trashReason: reason, trashMode: 'local', isFromDeletion: reason === 'delete',
        barcodes: [{ code: CODE, cod: 7, dod: 2, time: '08:00:00 (' + DAY + ')', locker: 'N/A', createdAt: BIRTH, isClosed: false,
            isFromDeletion: reason === 'delete', isDeducted: deducted }] };
}

function arrange(reason: string, deducted: boolean, receipts: 'none' | 'daily' | 'monthly' | 'both' = 'none') {
    const source = trashItem(reason, deducted);
    const ded = { source: { at: deletedAtOf(reason), cod: 7, dod: 2, count: 1 } };
    store = { [H]: {}, [T]: { source }, [R]: { [CODE]: true },
        [D]: { [DAY]: { codDollar: 7, dodDollar: 2, totalCount: 1, ...(receipts === 'daily' || receipts === 'both' ? { ded } : {}) } },
        [M]: { '2026-10': { codDollar: 7, dodDollar: 2, totalCount: 1, ...(receipts === 'monthly' || receipts === 'both' ? { ded } : {}) } } };
    dataState.deletedItems = [clone(source)];
    dataState.dailyRevenueData = clone(store[D]); dataState.monthlyRevenueData = clone(store[M]);
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    purgeWrites = 0; pendingRegistryReleases.clear(); purgeDeductionWaits.clear(); refuseLedger = false; ledgerTx = 0;
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
            if (target.path.startsWith(D) || target.path.startsWith(M)) ledgerTx++;
            if (refuseLedger && (target.path.startsWith(D) || target.path.startsWith(M))) throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
            const value = update(at(target.path));
            if (value === undefined) return { committed: false, snapshot: snap(at(target.path)) };
            put(target.path, value);
            return { committed: true, snapshot: snap(at(target.path)) };
        },
        update: async (target: any, patch: Record<string, any>) => {
            if (purgesSource(patch, 'source')) {
                purgeWrites++;
                if (!slotPurgeAdmitted(patch, 'source', at(T + '/source'))) throw Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' });
            }
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
    // A522 «ខែលែងនៅក្នុង ៣ ខែចុងក្រោយ» ៖ root ខែរក្សាតែ ៣ ខែថ្មី ➜ receipt ខែសរសេរមិនបាន ➜ មុនកែ hold ជារៀងរហូត ➜ ខែដែលកាត់ចេញ = ដកតាមថ្ងៃតែប៉ុណ្ណោះ
    it(reason + ' ៖ ខែរបស់ធាតុលែងនៅក្នុង root ខែ (៣ ខែថ្មីជាង) ➜ ដកតែថ្ងៃម្តង · purge បាន · មិនបង្កើតខែចាស់ឡើងវិញ', async () => {
        arrange(reason, false);
        store[M] = { '2026-11': { codDollar: 1, dodDollar: 0, totalCount: 1 }, '2026-12': { codDollar: 2, dodDollar: 0, totalCount: 1 }, '2027-01': { codDollar: 3, dodDollar: 0, totalCount: 1 } };
        dataState.monthlyRevenueData = clone(store[M]);
        await runAutomaticDeletedCleanup();
        expect(totals(at(D + '/' + DAY)), 'ថ្ងៃដកម្តង').toEqual([0, 0, 0]);
        expect(Object.keys(at(M)).sort(), 'មិនបង្កើតខែ 2026-10 ឡើងវិញ').toEqual(['2026-11', '2026-12', '2027-01']);
        expect({ copy: at(T + '/source'), purges: purgeWrites }).toEqual({ copy: null, purges: 1 });
        await runAutomaticDeletedCleanup();
        expect(totals(at(D + '/' + DAY)), 'ដកតែម្តង').toEqual([0, 0, 0]);
    });
    it(reason + ' ៖ ផុតរយៈរក្សាទុក គ្មាន flag · គ្មាន receipt · គ្មាន journal នៅឧបករណ៍នេះ ➜ purge ដក keyed event ម្តង រួចលុប copy (A522)', async () => {
        arrange(reason, false);
        await runAutomaticDeletedCleanup();
        const ded = { at: deletedAtOf(reason), cod: 7, dod: 2, count: 1 };
        expect({ day: totals(at(D + '/' + DAY)), month: totals(at(M + '/2026-10')), dayKey: at(D + '/' + DAY + '/ded/source'), monthKey: at(M + '/2026-10/ded/source') })
            .toEqual({ day: [0, 0, 0], month: [0, 0, 0], dayKey: reason === 'returned' ? null : ded, monthKey: ded });
        expect({ copy: at(T + '/source'), purges: purgeWrites, view: dataState.deletedItems.length }).toEqual({ copy: null, purges: 1, view: 0 });
        await runAutomaticDeletedCleanup();
        expect([totals(at(D + '/' + DAY)), totals(at(M + '/2026-10'))], 'ដកតែម្តង').toEqual([[0, 0, 0], [0, 0, 0]]);
        expect(uiState.toasts.map(toast => toast.msg)).toEqual([]);
        expect((window as any).ZoeErrors.capture).not.toHaveBeenCalled();
    });

    it(reason + ' ៖ journal របស់ធាតុនៅឧបករណ៍នេះ ➜ មិនដកជំនួស (journal បញ្ចប់វាខ្លួនឯង) · copy នៅ', async () => {
        arrange(reason, false);
        noteCleanupJournalEntry({ id: 'source', reason: reason === 'returned' ? 'abandon' : 'remove', journalAt: NOW, stage: 'moved', trashItem: clone(at(T + '/source')),
            revenue: { scanDate: DAY, cod: 7, dod: 2, count: 1 } });
        const before = clone(store);
        await runAutomaticDeletedCleanup();
        expect(store).toEqual(before);
        expect(uiState.toasts.map(toast => toast.msg)).toEqual([]);
    });

    it(reason + ' ៖ ខែដកចុះរួច (receipt ខែ) តែថ្ងៃមិនទាន់ ➜ ផ្លូវចេញដកតែថ្ងៃ (ម្តងក្នុងមួយ bucket)', async () => {
        arrange(reason, false, 'monthly');
        await runAutomaticDeletedCleanup();
        expect({ day: totals(at(D + '/' + DAY)), month: totals(at(M + '/2026-10')), copy: at(T + '/source') }).toEqual({ day: [0, 0, 0], month: [7, 2, 1], copy: null });
    });

    it(reason + ' ៖ receipt ថ្ងៃរបស់ lifecycle មុន (at ផ្សេង) មិនមែនភស្តុតាង ➜ ដក lifecycle នេះម្តង', async () => {
        arrange(reason, false);
        put(D + '/' + DAY + '/ded/source', { at: deletedAtOf(reason) - 86400000, cod: 4, dod: 0, count: 1 });
        put(M + '/2026-10/ded/source', { at: deletedAtOf(reason) - 86400000, cod: 4, dod: 0, count: 1 });
        await runAutomaticDeletedCleanup();
        expect({ day: totals(at(D + '/' + DAY)), month: totals(at(M + '/2026-10')), monthKey: at(M + '/2026-10/ded/source')?.at, copy: at(T + '/source') })
            .toEqual({ day: [0, 0, 0], month: [0, 0, 0], monthKey: deletedAtOf(reason), copy: null });
    });

    it(reason + ' ៖ receipt ដដែលដែលស្តាររួច (back) ➜ មិនដក មិនលុប · Sentry ម្តង · រង់ចាំ PURGE_DEDUCTION_RETRY_MS មុនព្យាយាមម្តងទៀត', async () => {
        arrange(reason, false);
        put(M + '/2026-10/ded/source', { at: deletedAtOf(reason), cod: 7, dod: 2, count: 1, back: true });
        const before = clone(store);
        await runAutomaticDeletedCleanup();
        expect(store).toEqual(before);
        const attempts = ledgerTx;
        expect(attempts, 'ការព្យាយាមដំបូងអាន ledger').toBeGreaterThan(0);
        await runAutomaticDeletedCleanup();
        expect(store).toEqual(before);
        expect(ledgerTx - attempts, 'ក្នុងរយៈរង់ចាំ មិនព្យាយាមដកម្តងទៀត').toBe(0);
        expect((window as any).ZoeErrors.capture.mock.calls.map((call: any[]) => call[1].context)).toEqual(['settlePurgeDeduction']);
        vi.setSystemTime(NOW + PURGE_DEDUCTION_RETRY_MS + 1);
        await runAutomaticDeletedCleanup();
        expect(ledgerTx, 'ក្រោយរយៈរង់ចាំ ព្យាយាមម្តងទៀត').toBeGreaterThan(attempts);
        expect(store, 'ក្រោយរយៈរង់ចាំ ការព្យាយាមម្តងទៀតក៏មិនដក').toEqual(before);
        expect((window as any).ZoeErrors.capture, 'Sentry ម្តងក្នុងមួយធាតុ').toHaveBeenCalledTimes(1);
        expect(uiState.toasts.map(toast => toast.msg)).toEqual([]);
    });

    it(reason + ' ៖ rules បដិសេធការដក ➜ copy នៅ · Sentry ម្តង · រយៈរង់ចាំកើនទ្វេ', async () => {
        arrange(reason, false);
        refuseLedger = true;
        const before = clone(store);
        await runAutomaticDeletedCleanup();
        expect(store).toEqual(before);
        const first = [...purgeDeductionWaits.values()][0];
        expect(first.gap).toBe(PURGE_DEDUCTION_RETRY_MS);
        vi.setSystemTime(NOW + PURGE_DEDUCTION_RETRY_MS + 1);
        await runAutomaticDeletedCleanup();
        expect([...purgeDeductionWaits.values()][0].gap).toBe(2 * PURGE_DEDUCTION_RETRY_MS);
        expect(store).toEqual(before);
        expect((window as any).ZoeErrors.capture).toHaveBeenCalledTimes(1);
        refuseLedger = false;
        vi.setSystemTime(NOW + 3 * PURGE_DEDUCTION_RETRY_MS + 2);
        await runAutomaticDeletedCleanup();
        expect({ day: totals(at(D + '/' + DAY)), copy: at(T + '/source') }).toEqual({ day: [0, 0, 0], copy: null });
    });

    it(reason + ' ៖ control end-to-end ៖ copy មិនទាន់ purge ➜ journal ដដែលរបស់ឧបករណ៍ដើមដកបានពិត (fixture នេះឈានដល់ផ្លូវដកនៃ journal)', async () => {
        arrange(reason, false);
        const copy = clone(at(T + '/source'));
        noteCleanupJournalEntry({ id: 'source', reason: reason === 'returned' ? 'abandon' : 'remove', journalAt: copy.deletedAt, stage: 'moved', trashItem: copy,
            actorUid: 'purge-user', revenue: { scanDate: DAY, cod: 7, dod: 2, count: 1 } });
        await resumeCleanupJournalEntry('source');
        expect([totals(at(D + '/' + DAY)), totals(at(M + '/2026-10'))]).toEqual([[0, 0, 0], [0, 0, 0]]);
    });

    it(reason + ' ៖ end-to-end ៖ ឧបករណ៍ដើមត្រឡប់មកវិញក្រោយផ្លូវចេញ (journal stage moved) ➜ ឃើញ consumed ➜ មិនដកម្តងទៀត', async () => {
        arrange(reason, false);
        const copy = clone(at(T + '/source'));
        await runAutomaticDeletedCleanup();
        expect(at(T + '/source')).toBeNull();
        const after = [totals(at(D + '/' + DAY)), totals(at(M + '/2026-10'))];
        noteCleanupJournalEntry({ id: 'source', reason: reason === 'returned' ? 'abandon' : 'remove', journalAt: copy.deletedAt, stage: 'moved', trashItem: copy,
            actorUid: 'purge-user', revenue: { scanDate: DAY, cod: 7, dod: 2, count: 1 } });
        expect(readCleanupJournal().map(entry => entry.trashItem.id)).toEqual(['source']);
        await resumeCleanupJournalEntry('source');
        expect([totals(at(D + '/' + DAY)), totals(at(M + '/2026-10'))], 'ការដកចុះតែម្តង').toEqual(after);
        expect(at(T + '/source'), 'មិនសរសេរ copy ដែល purge រួចឡើងវិញ').toBeNull();
        expect(readCleanupJournal().map(entry => entry.trashItem.id), 'journal stale ចេញ ៖ purge consumption នៃ copy ដដែល').toEqual([]);
    });
    it(reason + ' ៖ control ៖ consumption របស់ copy ផ្សេង (deletedAt ផ្សេង) ➜ journal នៅដដែល (មិនស្មាន)', async () => {
        arrange(reason, false);
        const copy = clone(at(T + '/source'));
        await runAutomaticDeletedCleanup();
        expect(at(T + '/source')).toBeNull();
        const other = { ...copy, deletedAt: copy.deletedAt - 1000 };
        noteCleanupJournalEntry({ id: 'source', reason: reason === 'returned' ? 'abandon' : 'remove', journalAt: other.deletedAt, stage: 'moved', trashItem: other,
            actorUid: 'purge-user', revenue: { scanDate: DAY, cod: 7, dod: 2, count: 1 } });
        await resumeCleanupJournalEntry('source');
        expect(readCleanupJournal().map(entry => entry.trashItem.id)).toEqual(['source']);
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

it('remove ៖ flag ចម្រុះ ៖ ផ្លូវចេញដកតែ barcode ដែលគ្មាន flag (ដូចការដកផ្ទាល់)', async () => {
    arrange('remove', false);
    const source = at(T + '/source');
    source.barcodes.push({ code: 'PENDINGDED02', cod: 3, dod: 1, time: source.time, locker: 'N/A', createdAt: BIRTH, isClosed: false, isFromDeletion: false, isDeducted: true });
    source.count = 2; source.cod = 10; source.dod = 3; source.price = 13;
    put(T + '/source', source); put(R + '/PENDINGDED02', true);
    dataState.deletedItems = [clone(source)];
    await runAutomaticDeletedCleanup();
    expect({ day: totals(at(D + '/' + DAY)), month: totals(at(M + '/2026-10')), copy: at(T + '/source') }).toEqual({ day: [0, 0, 0], month: [0, 0, 0], copy: null });
    expect(at(M + '/2026-10/ded/source')).toEqual({ at: deletedAtOf('remove'), cod: 7, dod: 2, count: 1 });
});

for (const receipts of ['both', 'none'] as const) it('គ្មាន scanDate ៖ ថ្ងៃ = ថ្ងៃនៃ deletedAt ដូច cleanupScanDateOf ' + (receipts === 'both' ? '(receipt នៅថ្ងៃនោះ ➜ purge មិនដកម្តងទៀត)' : '(គ្មាន receipt ➜ ផ្លូវចេញដកក្នុងថ្ងៃនោះ)'), async () => {
    arrange('remove', false);
    const source = at(T + '/source'); delete source.scanDate; put(T + '/source', source);
    dataState.deletedItems = [clone(source)];
    const day = '2026-09-29', month = '2026-09';
    put(D + '/' + day, { codDollar: 7, dodDollar: 2, totalCount: 1, ...(receipts === 'both' ? { ded: { source: { at: deletedAtOf('remove'), cod: 7, dod: 2, count: 1 } } } : {}) });
    put(M + '/' + month, { codDollar: 7, dodDollar: 2, totalCount: 1, ...(receipts === 'both' ? { ded: { source: { at: deletedAtOf('remove'), cod: 7, dod: 2, count: 1 } } } : {}) });
    await runAutomaticDeletedCleanup();
    expect({ day: totals(at(D + '/' + day)), month: totals(at(M + '/' + month)), copy: at(T + '/source'), other: totals(at(D + '/' + DAY)) })
        .toEqual({ day: receipts === 'both' ? [7, 2, 1] : [0, 0, 0], month: receipts === 'both' ? [7, 2, 1] : [0, 0, 0], copy: null, other: [7, 2, 1] });
});
