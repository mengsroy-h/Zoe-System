import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo, setFieldValue } from '../src/app/refs';
import { dataState, firebaseState, scanState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { pendingRegistryReleases } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { confirmPhone, triggerScanAction } from '../src/features/scan-action';
import { importZtoListRows } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';
import { createScanEvidenceJournal } from '../src/services/scan-evidence';
import { pendingScanScope, warnPendingScans } from '../src/services/scan-pending';

const CODE = 'LATECLAIM0001';
const REGISTRY = 'zoew_barcode_registry';
const NOW = Date.UTC(2026, 9, 30, 2);
const fields = ['modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput'] as const;
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
let claim: ReturnType<typeof deferred<any>>;
let release: ReturnType<typeof deferred<void>>;
let releaseMode = 'ack';
let scope = '';
let updates: ReturnType<typeof vi.fn>;
let transactions: ReturnType<typeof vi.fn>;
let unexpectedWrites: string[];
const journal = () => createScanEvidenceJournal(appLocalStore);
const rows = () => journal().list(scope);
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    appLocalStore.clear(); pendingRegistryReleases.clear(); clearZtoPickupStatusStore();
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    claim = deferred(); release = deferred(); releaseMode = 'ack'; unexpectedWrites = [];
    for (const field of fields) refTo(field)(document.createElement('input'));
    const options = { databaseURL: 'https://late-claim-fixture.firebaseio.com' };
    firebaseState.authGeneration++;
    firebaseState.db = { app: { options } } as any;
    firebaseState.auth = { app: { options }, currentUser: { uid: 'original-user' } } as any;
    firebaseState.isInitializingFirebase = false; firebaseState.isDatabaseConnected = true;
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(options));
    transactions = vi.fn((ref: any) => {
        if (ref.path !== REGISTRY + '/' + CODE) { unexpectedWrites.push(ref.path); throw new Error('Unexpected transaction'); }
        return claim.promise;
    });
    updates = vi.fn(async (ref: any, payload: any) => {
        if (ref.path !== REGISTRY || JSON.stringify(payload) !== JSON.stringify({ [CODE]: null })) {
            unexpectedWrites.push(ref.path); throw new Error('Unexpected write');
        }
        if (releaseMode === 'fail') throw new Error('disconnect');
        if (releaseMode === 'pending') return release.promise;
    });
    firebaseState.fb = { ref: (db: any, path: string) => ({ db, path }), runTransaction: transactions, update: updates,
        set: (ref: any) => { unexpectedWrites.push(ref.path); throw new Error('Unexpected set'); } } as any;
    scope = pendingScanScope();
    dataState.scanHistory = []; dataState.deletedItems = []; dataState.dailyRevenueData = {}; dataState.monthlyRevenueData = {};
    dataState.dailyCollectedData = {}; dataState.dailyPickupData = {};
    scanState.pendingBarcode = ''; scanState.pendingScanSession = null;
    viewState.phoneModalBusy = false; uiState.modalDisplay = {}; uiState.isModalOpen = false; uiState.toasts = [];
    uiState.entryScanMode = 'add'; uiState.lastEnteredLocker = '';
    ztoState.ztoListSyncInFlight = false; ztoState.ztoListSyncResult = null;
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.stubGlobal('confirm', () => true);
});
afterEach(() => {
    firebaseState.authGeneration++;
    for (const field of fields) refTo(field)(null);
    release.resolve();
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    appLocalStore.clear(); pendingRegistryReleases.clear(); viewState.phoneModalBusy = false;
});

async function reachTimedOutClaim(route: string) {
    let running: Promise<unknown>;
    if (route === 'confirmPhone') {
        triggerScanAction(CODE);
        setFieldValue('modalCodInput', '5'); setFieldValue('modalDodInput', '1');
        running = confirmPhone(true);
    } else {
        ztoState.ztoListSyncResult = { rows: [{ barcode: CODE, phone: '012345678', cod: 5, dod: 1,
            at: '2026-10-30 09:00:00', ztoClosed: null, skip: '', from: 'fixture' }], signedRows: [],
            from: '2026-10-30', to: '2026-10-30', total: 1 } as any;
        running = importZtoListRows();
    }
    await flush();
    expect(transactions).toHaveBeenCalledOnce();
    expect(rows()).toEqual([expect.objectContaining({ barcode: CODE, cod: 5, dod: 1, phase: 'claim-pending' })]);
    await vi.advanceTimersByTimeAsync(15000);
    await running;
    expect(updates).not.toHaveBeenCalled();
    expect(unexpectedWrites).toEqual([]);
    expect(dataState.scanHistory).toEqual([]);
    return rows()[0];
}

for (const route of ['confirmPhone', 'importZtoListRows']) describe(route + ' late claim', () => {
    it('claim ACK យឺតមុនប៉ះលុយ + release ACK ➜ បញ្ចប់ evidence មិនបង្ហាញ HOLD ក្លែង', async () => {
        await reachTimedOutClaim(route);
        claim.resolve({ committed: true }); await flush();
        expect(updates).toHaveBeenCalledOnce();
        expect(rows()).toEqual([]);
        uiState.toasts = []; warnPendingScans();
        expect(uiState.toasts).toEqual([]);
        expect(unexpectedWrites).toEqual([]);
    });
    it('late taken ➜ មិនបានចាប់ផ្តើម មិន release និងបញ្ចប់ evidence', async () => {
        await reachTimedOutClaim(route);
        claim.resolve({ committed: false }); await flush();
        expect(updates).not.toHaveBeenCalled(); expect(rows()).toEqual([]);
        expect(unexpectedWrites).toEqual([]);
    });
    it.each(['unknown', 'rejected'])('%s ➜ រក្សា HOLD មិន release', async verdict => {
        const original = await reachTimedOutClaim(route);
        if (verdict === 'unknown') claim.resolve({ committed: true, txOutcome: 'applied' });
        else claim.reject(new Error('disconnect'));
        await flush();
        expect(updates).not.toHaveBeenCalled(); expect(rows()).toEqual([original]);
    });
    it.each(['generation', 'db', 'uid', 'scope'])('%s ផ្លាស់ប្តូរ ➜ callback ចាស់មិន release/finish', async changed => {
        const original = await reachTimedOutClaim(route);
        if (changed === 'generation') firebaseState.authGeneration++;
        if (changed === 'db') firebaseState.db = { ...firebaseState.db } as any;
        if (changed === 'uid') firebaseState.auth.currentUser.uid = 'next-user';
        if (changed === 'scope') (firebaseState.db.app.options as any).databaseURL = 'https://next-shop.invalid';
        claim.resolve({ committed: true }); await flush();
        expect(updates).not.toHaveBeenCalled(); expect(rows()).toEqual([original]);
    });
    it.each(['advanced', 'corrupt', 'birth'])('durable %s ផ្លាស់ប្តូរ ➜ មិនសន្មតថាលុយមិនទាន់ប៉ះ', async changed => {
        const original = await reachTimedOutClaim(route);
        if (changed === 'advanced') journal().appendPhase(original, { phase: 'save-pending' });
        else {
            const key = Object.keys(appLocalStore).find(key => key.includes(original.id) && key.endsWith(':prepared'))!;
            const row = JSON.parse(appLocalStore.getItem(key)!);
            if (changed === 'corrupt') row.cod = -1; else row.createdAt++;
            appLocalStore.setItem(key, JSON.stringify(row));
        }
        const before = rows();
        claim.resolve({ committed: true }); await flush();
        expect(updates).not.toHaveBeenCalled(); expect(rows()).toEqual(before);
    });
    it('release មិនទាន់ ACK ➜ evidence នៅ; ACK ពិតប៉ុណ្ណោះអាចបញ្ចប់', async () => {
        await reachTimedOutClaim(route); releaseMode = 'pending';
        claim.resolve({ committed: true }); await flush();
        expect(updates).toHaveBeenCalledOnce(); expect(rows()).toHaveLength(1);
        release.resolve(); await flush();
        expect(rows()).toEqual([]); expect(unexpectedWrites).toEqual([]);
    });
    it('release បរាជ័យគ្រប់ retry ➜ HOLD នៅ ទោះបានអះអាង claim ពិត', async () => {
        const original = await reachTimedOutClaim(route); releaseMode = 'fail';
        claim.resolve({ committed: true }); await vi.advanceTimersByTimeAsync(10000);
        expect(updates.mock.calls.length).toBeGreaterThan(1); expect(rows()).toEqual([original]);
        expect(unexpectedWrites).toEqual([]);
    });
    it.each(['generation', 'advanced'])('%s ផ្លាស់ប្តូរកណ្ដាល release ➜ ACK ចាស់មិន finish', async changed => {
        const original = await reachTimedOutClaim(route); releaseMode = 'pending';
        claim.resolve({ committed: true }); await flush();
        expect(updates).toHaveBeenCalledOnce();
        if (changed === 'generation') firebaseState.authGeneration++;
        else journal().appendPhase(original, { phase: 'save-pending' });
        const before = rows(); release.resolve(); await flush();
        expect(rows()).toEqual(before);
    });
});
