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
import { pendingScanScope, preparePendingScan, notePendingScan, releasePendingScan, warnPendingScans } from '../src/services/scan-pending';

import { claimBarcodeInRegistry, releaseLateBarcodeClaim } from '../src/domain/registry';
import { withTimeout } from '../src/services/network';

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
    if (route === 'legacy-v1') {
        const handle = preparePendingScan(CODE, 5, 1, NOW, 'legacy-compatibility', 1);
        notePendingScan(handle, 'claim-pending');
        const pending = claimBarcodeInRegistry(CODE, handle);
        running = withTimeout(pending, 15000, 'Barcode claim timed out').catch(() => {
            releaseLateBarcodeClaim(pending, CODE, handle);
        }).finally(() => releasePendingScan(handle));
    } else if (route === 'confirmPhone') {
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

for (const route of ['legacy-v1']) describe(route + ' actual late-claim release seam (not current public routing)', () => {
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

const OP = 'zoew_scan_operations';
const PENDING = 'zoew_scan_pending';
const copy = (value: any) => value === undefined ? value : JSON.parse(JSON.stringify(value));
let server: Record<string, any>;
let readsBlocked: boolean;
const v2Rows = () => createScanEvidenceJournal(appLocalStore, 2).list(scope);
const read = (path: string) => copy(path.split('/').filter(Boolean).reduce((node, part) => node?.[part], server) ?? null);
const write = (path: string, value: any) => {
    const parts = path.split('/').filter(Boolean); const leaf = parts.pop()!; let node = server;
    for (const part of parts) node = node[part] ||= {};
    if (value === null) delete node[leaf]; else node[leaf] = copy(value);
};
const cancellationCalls = () => updates.mock.calls.filter(([, payload]: any[]) => Object.entries(payload).some(([path, value]: any[]) => path.startsWith(OP + '/') && value?.phase === 'cancelled'));
const operations = () => Object.values(read(OP) || {}) as any[];

for (const route of ['confirmPhone', 'importZtoListRows']) describe('v2 public ' + route + ' late claim', () => {
    beforeEach(() => {
        server = {}; readsBlocked = false;
        const sdk = firebaseState.fb as any;
        sdk.get = async (ref: any) => {
            if (readsBlocked) throw new Error('offline');
            const value = read(ref.path);
            return { val: () => value, exists: () => value !== null };
        };
        transactions = vi.fn(async (ref: any, update: any) => {
            if (ref.path !== REGISTRY + '/' + CODE) { unexpectedWrites.push(ref.path); throw new Error('Unexpected transaction'); }
            const proposed = update(read(ref.path));
            const result = await claim.promise;
            if (result.committed && proposed !== undefined) write(ref.path, proposed);
            else if (result.committed === false) write(ref.path, { foreign: true });
            return result;
        });
        updates = vi.fn(async (ref: any, payload: any) => {
            if (ref.path !== '') { unexpectedWrites.push(ref.path); throw new Error('Unexpected non-root update'); }
            const operationPair = Object.entries(payload).find(([path]) => path.startsWith(OP + '/')) as [string, any] | undefined;
            if (!operationPair) { unexpectedWrites.push(JSON.stringify(Object.keys(payload))); throw new Error('Missing operation'); }
            const [path, operation] = operationPair;
            const prior = read(path);
            if (operation.phase === 'admitted') {
                expect(prior).toBeNull();
                expect(Object.keys(payload).sort()).toEqual([path, PENDING + '/' + operation.id].sort());
                expect(payload[PENDING + '/' + operation.id]).toBe(operation.actorUid);
            } else if (operation.phase === 'cancelled') {
                expect(prior?.phase).toBe('admitted');
                expect(operation).toEqual({ ...prior, phase: 'cancelled' });
                expect(payload[PENDING + '/' + operation.id]).toBeNull();
                expect(Object.keys(payload).sort()).toEqual([path, PENDING + '/' + operation.id,
                    ...(payload[REGISTRY + '/' + CODE] === null ? [REGISTRY + '/' + CODE] : [])].sort());
                const owner = read(REGISTRY + '/' + CODE);
                if (payload[REGISTRY + '/' + CODE] === null) expect(owner).toMatchObject({ intent: operation.id, actorUid: operation.actorUid, birth: operation.birth });
                if (releaseMode === 'fail') throw new Error('disconnect');
                if (releaseMode === 'pending') await release.promise;
            } else { unexpectedWrites.push(path); throw new Error('Unexpected phase'); }
            for (const [key, value] of Object.entries(payload)) write(key, value);
        });
        sdk.runTransaction = transactions; sdk.update = updates;
        sdk.ref = (db: any, path = '') => ({ db, path });
    });
    async function timedOut() {
        let running;
        if (route === 'confirmPhone') {
            triggerScanAction(CODE); setFieldValue('modalCodInput', '5'); setFieldValue('modalDodInput', '1');
            running = confirmPhone(true);
        } else {
            ztoState.ztoListSyncResult = { verifiedAt: NOW, verifiedServerAt: NOW, rows: [{ barcode: CODE, phone: '012345678', cod: 5, dod: 1,
                at: '2026-10-30 09:00:00', ztoClosed: null, skip: '', from: 'fixture' }], signedRows: [], from: '2026-10-30', to: '2026-10-30', total: 1 } as any;
            running = importZtoListRows();
        }
        await flush();
        expect(transactions).toHaveBeenCalledOnce();
        expect(v2Rows()).toEqual([expect.objectContaining({ v: 2, barcode: CODE, phase: 'claim-pending' })]);
        expect(operations()).toHaveLength(1);
        expect(operations()[0].phase).toBe('admitted');
        await vi.advanceTimersByTimeAsync(15000); await running;
        expect(cancellationCalls()).toHaveLength(0);
        expect(unexpectedWrites).toEqual([]);
        expect(read('zoew_scan_history_cod_dod')).toBeNull();
        expect(read('zoew_daily_revenue_cod_dod')).toBeNull();
        expect(read('zoew_monthly_revenue_cod_dod')).toBeNull();
        return v2Rows()[0];
    }
    it.each(['ack', 'unproven-applied'])('late claim %s ➜ authoritative owned state and atomic cancelled receipt, no financial effects', async kind => {
        await timedOut(); claim.resolve({ committed: true, ...(kind === 'unproven-applied' ? { txOutcome: 'applied' } : {}) }); await flush();
        await vi.waitFor(() => expect(v2Rows()).toEqual([]));
        expect(cancellationCalls()).toHaveLength(1);
        expect(operations()[0].phase).toBe('cancelled');
        expect(read(REGISTRY + '/' + CODE)).toBeNull();
        expect(v2Rows()).toEqual([]); expect(unexpectedWrites).toEqual([]);
        expect(read('zoew_daily_revenue_cod_dod')).toBeNull();
    });
    it('late taken ➜ cancel own admission without releasing foreign registry', async () => {
        await timedOut(); claim.resolve({ committed: false }); await flush();
        expect(operations()[0].phase).toBe('cancelled');
        expect(read(REGISTRY + '/' + CODE)).toEqual({ foreign: true });
        expect(cancellationCalls().every(([, payload]) => !(REGISTRY + '/' + CODE in payload))).toBe(true);
        expect(v2Rows()).toEqual([]);
    });
    it.each(['lost-ack', 'rejected'])('%s plus unreadable authoritative receipt ➜ HOLD, no guessed release', async kind => {
        const original = await timedOut(); readsBlocked = true;
        if (kind === 'lost-ack') claim.resolve({ committed: true, txOutcome: 'applied' }); else claim.reject(new Error('disconnect'));
        await flush();
        expect(cancellationCalls()).toHaveLength(0);
        expect(v2Rows()).toEqual([expect.objectContaining({ id: original.id })]);
        expect(operations()[0].phase).toBe('admitted');
    });
    it.each(['generation', 'db', 'uid', 'scope'])('%s changed ➜ old callback cannot cancel or finish', async changed => {
        const original = await timedOut();
        if (changed === 'generation') firebaseState.authGeneration++;
        if (changed === 'db') firebaseState.db = { ...firebaseState.db } as any;
        if (changed === 'uid') firebaseState.auth.currentUser.uid = 'next-user';
        if (changed === 'scope') (firebaseState.db.app.options as any).databaseURL = 'https://next-shop.invalid';
        claim.resolve({ committed: true }); await flush();
        expect(cancellationCalls()).toHaveLength(0); expect(v2Rows()).toEqual([original]);
    });
    it('server prepared row owns intent ➜ late callback retains HOLD and registry', async () => {
        const original = await timedOut();
        const operation = operations()[0];
        // A separate continuation legitimately advanced the same server operation before the delayed callback.
        write(OP + '/' + operation.id, { ...operation, phase: 'prepared', targetId: 'target', payloadHash: 'a'.repeat(64), phone: '012345678', locker: 'N/A', closedAt: 0 });
        write('zoew_scan_history_cod_dod/target', { scanPending: { intent: operation.id } });
        claim.resolve({ committed: true }); await flush();
        expect(cancellationCalls()).toHaveLength(0);
        expect(v2Rows()).toEqual([expect.objectContaining({ id: original.id })]);
        expect(read(REGISTRY + '/' + CODE)).toMatchObject({ intent: original.id });
    });
    it('cancel ACK pending ➜ evidence retained, true terminal receipt settles', async () => {
        await timedOut(); releaseMode = 'pending'; claim.resolve({ committed: true }); await flush();
        expect(cancellationCalls()).toHaveLength(1); expect(v2Rows()).toHaveLength(1);
        expect(operations()[0].phase).toBe('admitted');
        release.resolve(); await flush();
        expect(operations()[0].phase).toBe('cancelled'); expect(v2Rows()).toEqual([]);
    });
    it('cancel refused ➜ admitted server receipt and local HOLD remain, no money', async () => {
        const original = await timedOut(); releaseMode = 'fail'; claim.resolve({ committed: true }); await flush();
        expect(cancellationCalls()).toHaveLength(1); expect(operations()[0].phase).toBe('admitted');
        expect(v2Rows()).toEqual([expect.objectContaining({ id: original.id })]);
        expect(read(REGISTRY + '/' + CODE)).toMatchObject({ intent: original.id });
        expect(read('zoew_daily_revenue_cod_dod')).toBeNull();
    });
    it('session changes during cancel ACK ➜ terminal server result cannot clear old local evidence', async () => {
        const original = await timedOut(); releaseMode = 'pending'; claim.resolve({ committed: true }); await flush();
        expect(cancellationCalls()).toHaveLength(1); firebaseState.authGeneration++;
        release.resolve(); await flush();
        expect(operations()[0].phase).toBe('cancelled');
        expect(v2Rows()).toEqual([expect.objectContaining({ id: original.id })]);
    });
    it.each(['advanced', 'corrupt'])('local journal %s cannot override authoritative not-started server outcome', async changed => {
        const original = await timedOut();
        if (changed === 'advanced') createScanEvidenceJournal(appLocalStore, 2).appendPhase(original, { phase: 'save-pending' });
        else {
            const key = Object.keys(appLocalStore).find(key => key.includes(original.id) && key.endsWith(':prepared'))!;
            const row = JSON.parse(appLocalStore.getItem(key)!); row.cod = -1;
            appLocalStore.setItem(key, JSON.stringify(row));
        }
        claim.resolve({ committed: true }); await flush();
        await vi.waitFor(() => expect(operations()[0].phase).toBe('cancelled'));
        await flush();
        expect(read(REGISTRY + '/' + CODE)).toBeNull();
        if (changed === 'advanced') await vi.waitFor(() => expect(v2Rows()).toEqual([]));
        else expect(v2Rows()).toEqual([expect.objectContaining({ id: original.id, corrupt: true })]);
        expect(read('zoew_daily_revenue_cod_dod')).toBeNull();
    });

});
