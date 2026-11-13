import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../../../../ZoeW/src/core/state';
import * as clock from '../../../../ZoeW/src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { importZtoListRows } from '../../../../ZoeW/src/features/zto-list-sync';
import { clearZtoPickupStatusStore, loadZtoPickupStatusOnce, getZtoPickupVerdict, setZtoPickupVerdict, ztoVerdictCandidate, ztoPickupStatus } from '../../../../ZoeW/src/features/zto-status';
import { addOrUpdateEntry } from '../../../../ZoeW/src/features/scan-action';
import { trashConsumptionOf } from '../../../../ZoeW/src/domain/trash-generation';
import { claimAndCleanupItem } from '../../../../ZoeW/src/domain/cleanup';
import { syncZtoFinalMarks } from '../../../../ZoeW/src/features/zto-final-marks';
import { resetZtoTrashMode } from '../../../../ZoeW/src/services/zto-trash-mode';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { pickupResetRecord, readPickupJournal } from '../../../../ZoeW/src/domain/pickup';
import { createScanEvidenceJournal } from '../../../../ZoeW/src/services/scan-evidence';
import { pendingScanScope } from '../../../../ZoeW/src/services/scan-pending';
import { finishScanImportCollected, resumePendingScanOperations } from '../../../../ZoeW/src/services/scan-operation';
import { withTransactionOutcomeResolution } from '../../../../ZoeW/src/services/tx-outcome';
import { resolveScanEvidence } from '../../../../ZoeW/src/features/pending-writes';

const H = 'zoew_scan_history_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const P = 'zoew_daily_pickup_cod_dod', C = 'zoew_daily_collected_cod_dod';
const HOST = 'https://born-closed-baseline.firebaseio.com', DAY = '2026-10-30', NOW = Date.UTC(2026, 9, 30, 2), CODE = 'BORNBASE0001';
const copy = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const PHONE = '012999888';
const originalStorageWrite = appLocalStore.setItem.bind(appLocalStore), originalStorageRemove = appLocalStore.removeItem.bind(appLocalStore);
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as any).ZoeErrors; });

/**
 * ផ្លូវចេញរបស់ម្ចាស់ ៖ import born-closed ពិត (cookie) ដែល importer ដើមបាត់ (handoff) បន្សល់កំណត់ត្រា collected-pending ដែល Server បញ្ជាក់ពេញ។
 * ការអាន receipt លើកដំបូងក្នុងផ្លូវចេញបរាជ័យម្តង (TypeError 'Failed to fetch') ➜ ផ្លូវចេញព្យាយាមម្តងទៀត ហើយបញ្ចប់កំណត់ត្រា (mirror + «យករួច»)
 * ⛔ មិនទម្លាក់។ មុនកែ ៖ ទម្លាក់ ➜ «យករួច» និង mirror បាត់ជារៀងរហូត។ control ៖ ការសង្គ្រោះធម្មតាបញ្ចប់កំណត់ត្រាដដែល។
 */
it.each(['transient-exit', 'control-resume', 'interval-retention'])('⛔ ផ្លូវចេញម្ចាស់ ធៀបនឹងកំណត់ត្រាដែល Server បញ្ជាក់ ៖ %s', async (mode) => {
    const provider: string = 'cookie', fault: string = 'handoff';
    let blip = false, blipHit = false;
    vi.useFakeTimers({ toFake: fault === 'late-save' ? ['Date', 'setTimeout', 'clearTimeout'] : ['Date'] }); vi.setSystemTime(NOW); const serverNow = vi.spyOn(clock, 'getServerNow').mockReturnValue(NOW);
    vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('confirm', () => true);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    clearZtoPickupStatusStore(); dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    const tree: Record<string, any> = {};
    let serverWrites = 0, mirrorRefusals = 0, ackFaultHit = false;
    const cleanupProof: any = {};
    let delayed = false, preparePaused = false, releaseSave!: () => void, releasePrepare!: () => void;
    const delayedSave = new Promise<void>(resolve => { releaseSave = resolve; });
    const delayedPrepare = new Promise<void>(resolve => { releasePrepare = resolve; });
    const get = (path: string) => copy(path.split('/').filter(Boolean).reduce((node, key) => node?.[key], tree) ?? null);
    const put = (path: string, value: any) => {
        const keys = path.split('/').filter(Boolean), last = keys.pop()!; let node = tree;
        for (const key of keys) node = node[key] ||= {};
        if (value === null) delete node[last];
        else if (typeof value?.['.sv']?.increment === 'number') node[last] = (Number(node[last]) || 0) + value['.sv'].increment;
        else if (value?.['.sv'] === 'timestamp') node[last] = NOW;
        else node[last] = copy(value);
    };
    const reference = (path = '') => ({ path, key: path.split('/').at(-1) || null, toString: () => HOST + '/' + path });
    const snapshot = (ref: any) => { const value = get(ref.path); return { ref, key: ref.key, exists: () => value !== null, val: () => copy(value) }; };
    const app = { options: { databaseURL: HOST } }, db = { app };
    const auth = { app, currentUser: { uid: 'born-user', getIdToken: async () => 'fixture-token' } };
    const raw = { getAuth: () => auth, getDatabase: () => db, deleteApp: async () => {}, ref: (_db: any, path = '') => reference(path),
        increment: (amount: number) => ({ '.sv': { increment: amount } }), get: async (ref: any) => snapshot(ref),
        set: async (ref: any, value: any) => put(ref.path, value),
        update: async (ref: any, patch: any) => {
            if (fault === 'late-save' && !delayed && Object.values(patch).some((value: any) => value?.phase === 'committed')) { delayed = true; await delayedSave; }
            if (fault === 'mirror-refused' && Object.keys(patch).some(key => [ref.path, key].filter(Boolean).join('/').startsWith(C + '/'))) { mirrorRefusals++; throw new Error('mirror refused'); }
            serverWrites++; for (const [key, value] of Object.entries(patch)) put([ref.path, key].filter(Boolean).join('/'), value); },
        runTransaction: async (ref: any, update: any) => {
            const next = update(get(ref.path)); if (next === undefined) return { committed: false, snapshot: snapshot(ref) };
            serverWrites++; put(ref.path, next);
            const committedSnapshot = snapshot(ref);
            if (fault === 'late-save' && !preparePaused && next?.phase === 'prepared' && ref.path.startsWith('zoew_scan_operations/')) { preparePaused = true; await delayedPrepare; }
            if (fault === 'reset-after-epoch' && !preparePaused && next?.phase === 'prepared' && ref.path.startsWith('zoew_scan_operations/')) {
                preparePaused = true; put(P + '/' + DAY, pickupResetRecord(get(P + '/' + DAY)));
            }
            if (fault.startsWith('newer-') && !preparePaused && next?.phase === 'prepared' && ref.path.startsWith('zoew_scan_operations/')) {
                preparePaused = true; setZtoPickupVerdict(CODE, fault === 'newer-sign-verdict' ? true : false, fault === 'newer-sign-verdict' ? NOW : undefined);
            }
            return { committed: true, snapshot: committedSnapshot };
        }, onValue: () => () => {}, off: () => {} };
    vi.stubGlobal('fetch', async (url: any) => {
        const path = decodeURIComponent(new URL(String(url)).pathname).replace(/^\//, '').replace(/\.json$/, '');
        if (blip && !blipHit && path.startsWith('zoew_scan_operations/')) { blipHit = true; throw new TypeError('Failed to fetch'); }
        if (fault.startsWith('ack-') && !ackFaultHit && (path === H || path.startsWith(H + '/')) && get(C + '/' + DAY + '/' + CODE) && readPickupJournal().length === 0) {
            ackFaultHit = true;
            try {
            const row: any = path === H ? Object.values(get(H)).find((entry: any) => entry.barcodes.some((barcode: any) => barcode.code === CODE)) : get(path);
            const targetPath = H + '/' + row.id, barcode = row.barcodes.find((entry: any) => entry.code === CODE);
            if (fault.startsWith('ack-cleanup')) {
                try {
                resetZtoTrashMode();
                originalStorageWrite('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
                    url: window.location.origin + '/.netlify/functions/zto-order-detail?' + (provider === 'palm' ? 'palm=1&' : '') + 'barcode={barcode}' }));
                vi.spyOn(clock, 'getServerNow').mockReturnValue(NOW + 3 * 3600000);
                if (fault === 'ack-cleanup-partial') cleanupProof.scan = await addOrUpdateEntry('BORNSIBLING', '012999888', 7, 0, 'N/A', NOW + 3 * 3600000, NOW + 3 * 3600000);
                cleanupProof.signed = await syncZtoFinalMarks();
                dataState.scanHistory = Object.values(get(H));
                await claimAndCleanupItem(row.id, 'close');
                cleanupProof.history = get(targetPath);
                cleanupProof.trash = get('zoew_recently_deleted_cod_dod');
                const moved: any = Object.values(cleanupProof.trash || {})[0];
                if (fault === 'ack-cleanup-consumed') put('zoew_trash_consumptions/' + moved.id, trashConsumptionOf(moved, 'purge', { uid: 'born-user', scope: HOST }));
                if (fault === 'ack-cleanup-deducted') { moved.barcodes[0].isDeducted = true; put('zoew_recently_deleted_cod_dod/' + moved.id, moved); }

                } catch (error) { cleanupProof.error = String(error); } finally { cleanupProof.done = true; }
            }
            if (fault === 'ack-reused') {
                barcode.scanIntent = 'scan_' + 'f'.repeat(32); barcode.createdAt++; barcode.cod = 7;
                row.cod = row.price = 7; put(targetPath, row); put(C + '/' + DAY + '/' + CODE, { c: 7, d: 0 });
                put(D + '/' + DAY + '/codDollar', 7); put(M + '/2026-10/codDollar', 7);
            }
            if (fault === 'ack-purged') { put(targetPath, null); put(C + '/' + DAY + '/' + CODE, null); }
            if (fault === 'ack-mirror-missing') put(C + '/' + DAY + '/' + CODE, null);
            if (fault === 'ack-registry') put('zoew_barcode_registry/' + CODE, true);
            if (fault === 'ack-receipt') put('zoew_scan_operations/' + barcode.scanIntent, null);
            if (fault === 'ack-session') firebaseState.authGeneration++;
            if (fault === 'ack-busy' || fault === 'ack-clear-empty') { row.clearClaim = fault === 'ack-busy' ? 'other' : ''; put(targetPath, row); }
            if (fault === 'ack-trash-zero') { barcode.trashClaimAt = 0; put(targetPath, row); }
            if (fault === 'ack-restored') { barcode.restoredAt = NOW + 1; put(targetPath, row); }
            if (fault === 'ack-cross-copy') put('zoew_recently_deleted_cod_dod/duplicate', { ...copy(row), id: 'duplicate', trashReason: 'pickup', trashGeneration: 1 });
            if (fault === 'ack-duplicate') { row.barcodes.push(copy(barcode)); put(targetPath, row); }
            } catch (error) { cleanupProof.error = String(error); }
        }
        if (fault === 'ack-sign-metadata' && ackFaultHit && !cleanupProof.done && path === C + '/' + DAY + '/' + CODE) {
            cleanupProof.done = true;
            dataState.scanHistory = Object.values(get(H));
            cleanupProof.signed = await syncZtoFinalMarks();
        }
        if (fault.startsWith('ack-between-') && ackFaultHit && !cleanupProof.done && path === C + '/' + DAY + '/' + CODE) {
            cleanupProof.done = true;
            const row: any = Object.values(get(H))[0], barcode = row.barcodes.find((entry: any) => entry.code === CODE);
            if (fault === 'ack-between-price') barcode.cod = 7;
            if (fault === 'ack-between-closed-at') barcode.closedAt = NOW + 1;
            if (fault === 'ack-between-intent') barcode.scanIntent = 'scan_' + 'f'.repeat(32);
            if (fault === 'ack-between-deducted') barcode.isDeducted = true;
            if (fault === 'ack-between-reopen') barcode.isClosed = false;
            if (fault === 'ack-between-restored') barcode.restoredAt = NOW + 1;
            if (fault === 'ack-between-trash') barcode.trashClaimAt = 0;
            put(H + '/' + row.id, row);
        }
        if (fault === 'ack-sibling' && ackFaultHit && !cleanupProof.done && path === C + '/' + DAY + '/' + CODE) {
            cleanupProof.done = true;
            expect(get(D + '/' + DAY)).toMatchObject({ codDollar: 5, totalCount: 1 });
            expect(get(M + '/2026-10')).toMatchObject({ codDollar: 5, totalCount: 1 });
            cleanupProof.scan = await addOrUpdateEntry('BORNSIBLING', '012999888', 7, 0, 'N/A', NOW, NOW);
            expect(get(D + '/' + DAY)).toMatchObject({ codDollar: 12, totalCount: 2 });
            expect(get(M + '/2026-10')).toMatchObject({ codDollar: 12, totalCount: 2 });
        }
        return Response.json(get(path));
    });
    (window as any).ZoeErrors = { capture: vi.fn() };
    const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
        isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, serverClockTrusted: true, hasEverConnectedToDatabase: true, serverTimeOffsetMs: 0, sessionExpiryCheck: 'live', authLoginOperation: null });
    firebaseState.authGeneration++;
    for (const [field, path] of Object.entries({ dbRefHistory: H, dbRefDailyRevenue: D, dbRefMonthlyRevenue: M, dbRefDailyPickup: P, dbRefDailyCollected: C })) (firebaseState as any)[field] = sdk.ref(db, path);
    dataState.scanHistory = []; dataState.deletedItems = []; dataState.dailyRevenueData = {}; dataState.monthlyRevenueData = {};
    dataState.dailyPickupData = {}; dataState.dailyCollectedData = {}; uiState.toasts = [];
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = { verifiedAt: NOW, verifiedServerAt: NOW, rows: [{ barcode: CODE, phone: '012999888', cod: 5, dod: 0, at: '2026-10-30 09:00:00',
        ztoClosed: true, skip: '', from: 'fixture' }], palm: provider === 'palm', signedRows: [], from: DAY, to: DAY, total: 1 } as any;
    let interruptedAtBoundary = false;
    const remove = originalStorageRemove, write = originalStorageWrite;
    vi.spyOn(appLocalStore, 'setItem').mockImplementation((key: string, value: string) => {
        if (key.startsWith('zoew_scan_evidence_v2:') && key.endsWith(':collected-pending')) {
            if (fault === 'phase-refused') throw new Error('quota');
            write(key, value);
            if (fault === 'handoff' && !interruptedAtBoundary) { interruptedAtBoundary = true; firebaseState.authGeneration++; }
        } else write(key, value);
    });
    vi.spyOn(appLocalStore, 'removeItem').mockImplementation((key: string) => {
        remove(key);
        if (fault === 'after-ack' && !interruptedAtBoundary && key.startsWith('zoew_scan_evidence_v2:') && key.endsWith(':terminal')) {
            interruptedAtBoundary = true; firebaseState.authGeneration++;
        }
    });
    try {
        const importing = importZtoListRows();
        if (fault === 'late-save') {
            await vi.waitFor(() => expect(preparePaused).toBe(true));
            await vi.advanceTimersByTimeAsync(10000); releasePrepare();
            await vi.waitFor(() => expect(delayed).toBe(true));
            await vi.advanceTimersByTimeAsync(5001); await importing;
            expect(createScanEvidenceJournal(appLocalStore, 2).list(pendingScanScope())).toHaveLength(1);
            expect(get(C)).toBeNull();
            expect(get(D + '/' + DAY)?.codDollar || 0).toBe(0); expect(get(M + '/2026-10')?.codDollar || 0).toBe(0);
            releaseSave();
            await vi.waitFor(() => {
                expect(get(C + '/' + DAY + '/' + CODE)).toEqual({ c: 5, d: 0 });
                expect(createScanEvidenceJournal(appLocalStore, 2).list(pendingScanScope())).toEqual([]);
            });
            expect(get(P + '/' + DAY)).toMatchObject({ packagesPickedUp: 1, pickedUpBarcodes: { [CODE]: PHONE }, pickedUpPhones: { [PHONE]: 1 } });
        } else await importing;
        if (fault.startsWith('ack-')) {
            expect(ackFaultHit).toBe(true);
            if (fault.startsWith('ack-cleanup')) await vi.waitFor(() => expect(cleanupProof.done).toBe(true));
            expect(cleanupProof.error).toBeUndefined();
            if (fault.startsWith('ack-between-')) expect(cleanupProof.done).toBe(true);
            const journal = () => createScanEvidenceJournal(appLocalStore, 2).list(pendingScanScope());
            if (fault === 'ack-cleanup' || fault === 'ack-cleanup-partial') {
                await vi.waitFor(() => expect(cleanupProof.done).toBe(true));
                expect(cleanupProof.error).toBeUndefined();
                if (fault === 'ack-cleanup-partial') expect(cleanupProof.scan, JSON.stringify(cleanupProof)).toBe(true);
                expect(cleanupProof.signed, JSON.stringify(cleanupProof)).toBe(1);
                if (fault === 'ack-cleanup') expect(cleanupProof.history).toBeNull();
                else expect(cleanupProof.history?.barcodes.map((entry: any) => entry.code)).toEqual(['BORNSIBLING']);
                expect(Object.values(cleanupProof.trash || {}).map((entry: any) => entry.trashReason)).toEqual(['pickup']);
                expect(get(C + '/' + DAY + '/' + CODE)).toEqual({ c: 5, d: 0 });
                expect(journal()).toEqual([]);
                expect(get(P + '/' + DAY)).toMatchObject({ packagesPickedUp: 1, pickedUpBarcodes: { [CODE]: PHONE } });
                expect(get(D + '/' + DAY).codDollar).toBe(fault === 'ack-cleanup-partial' ? 12 : 5);
                expect(get(M + '/2026-10').codDollar).toBe(fault === 'ack-cleanup-partial' ? 12 : 5);
                expect(get(D + '/' + DAY).totalCount).toBe(fault === 'ack-cleanup-partial' ? 2 : 1);
                expect(get(M + '/2026-10').totalCount).toBe(fault === 'ack-cleanup-partial' ? 2 : 1);
                return;
            }
            if (fault === 'ack-sign-metadata') {
                expect(cleanupProof.done).toBe(true); expect(cleanupProof.signed).toBe(1);
                const row: any = Object.values(get(H))[0];
                expect(row.barcodes[0].ztoSignedAt).toBeGreaterThan(0);
                expect(get(C + '/' + DAY + '/' + CODE)).toEqual({ c: 5, d: 0 });
                expect(get(P + '/' + DAY)).toMatchObject({ packagesPickedUp: 1, pickedUpBarcodes: { [CODE]: PHONE } });
                expect(get(D + '/' + DAY)).toMatchObject({ codDollar: 5, totalCount: 1 });
                expect(get(M + '/2026-10')).toMatchObject({ codDollar: 5, totalCount: 1 });
                expect(journal()).toEqual([]);
                return;
            }
            if (fault === 'ack-sibling') {
                expect(cleanupProof.done).toBe(true); expect(cleanupProof.scan).toBe(true);
                const rows: any[] = Object.values(get(H));
                expect(rows).toHaveLength(1);
                expect(rows[0].barcodes.map((barcode: any) => barcode.code)).toEqual([CODE, 'BORNSIBLING']);
                expect(get(C + '/' + DAY + '/' + CODE)).toEqual({ c: 5, d: 0 });
                expect(get(P + '/' + DAY)?.pickedUpBarcodes?.[CODE]).toBe(PHONE);
                expect(get(D + '/' + DAY)).toMatchObject({ codDollar: 12, totalCount: 2 });
                expect(get(M + '/2026-10')).toMatchObject({ codDollar: 12, totalCount: 2 });
                expect(journal()).toEqual([]);
                return;
            }
            if (fault === 'ack-cross-copy') {
                expect(journal()).toEqual([]);
                expect(get(C + '/' + DAY + '/' + CODE)).toEqual({ c: 5, d: 0 });
                expect(Object.values(get('zoew_recently_deleted_cod_dod'))).toHaveLength(1);
                expect(get(D + '/' + DAY).codDollar).toBe(5); expect(get(M + '/2026-10').codDollar).toBe(5);
                return;
            }
            expect(journal()).toHaveLength(1); expect(journal()[0].phase).toBe('collected-pending');
            const expectedCod = fault === 'ack-reused' ? 7 : 5;
            expect(get(D + '/' + DAY).codDollar).toBe(expectedCod); expect(get(M + '/2026-10').codDollar).toBe(expectedCod);
            expect(get(D + '/' + DAY).totalCount).toBe(1); expect(get(M + '/2026-10').totalCount).toBe(1);
            if (fault === 'ack-reused') expect(get(C + '/' + DAY + '/' + CODE)).toEqual({ c: 7, d: 0 });
            expect(get(P + '/' + DAY)?.packagesPickedUp || 0).toBe(0);
            const held = copy(tree), writesBefore = serverWrites;
            firebaseState.authGeneration++; firebaseState.db = { app } as any;
            dataState.scanHistory = Object.values(get(H) || {}); dataState.deletedItems = Object.values(get('zoew_recently_deleted_cod_dod') || {});
            await resumePendingScanOperations(); await resumePendingScanOperations();
            if (fault === 'ack-mirror-missing' || fault === 'ack-session') {
                expect(journal(), 'server ពិតបញ្ជាក់លទ្ធផល ➜ ការសង្គ្រោះបញ្ចប់ភស្តុតាង').toEqual([]);
                expect(get(C + '/' + DAY + '/' + CODE)).toEqual({ c: 5, d: 0 });
                expect(get(P + '/' + DAY)).toMatchObject({ packagesPickedUp: 1, pickedUpBarcodes: { [CODE]: PHONE }, pickedUpPhones: { [PHONE]: 1 } });
                expect(get(D + '/' + DAY)).toMatchObject({ codDollar: 5, totalCount: 1 }); expect(get(M + '/2026-10')).toMatchObject({ codDollar: 5, totalCount: 1 });
                const done = copy(tree), writesDone = serverWrites;
                await resumePendingScanOperations();
                expect(tree).toEqual(done); expect(serverWrites).toBe(writesDone);
                return;
            }
            expect(tree).toEqual(held); expect(serverWrites).toBe(writesBefore); expect(journal()).toHaveLength(1);
            return;
        }
        const item: any = Object.values(get(H) || {}).find((row: any) => Object.values(row.barcodes || {}).some((barcode: any) => barcode.code === CODE));
        const barcode: any = Object.values(item?.barcodes || {}).find((row: any) => row.code === CODE);
        expect(barcode?.isClosed).toBe(true);
        if (fault.startsWith('newer-')) {
            const journal = () => createScanEvidenceJournal(appLocalStore, 2).list(pendingScanScope());
            expect(preparePaused).toBe(true);
            expect(Object.values(get('zoew_scan_operations')).map((receipt: any) => receipt.phase)).toEqual(['committed']);
            expect(get(D + '/' + DAY)).toEqual(expect.objectContaining({ codDollar: 5, dodDollar: 0, totalCount: 1 }));
            if (fault === 'newer-sign-verdict') {
                expect(get(C + '/' + DAY + '/' + CODE), 'verdict «បាន Sign» ថ្មីជាងមិនផ្ទុយភស្តុតាង import').toEqual({ c: 5, d: 0 });
                expect(journal()).toEqual([]);
                expect(getZtoPickupVerdict(CODE, ztoVerdictCandidate(item, barcode))?.closed).toBe(true);
            } else {
                expect(get(C), 'verdict «មិនទាន់ Sign» ថ្មីជាងផ្ទុយភស្តុតាង ➜ HOLD').toBeNull();
                expect(journal()).toHaveLength(1);
                expect(journal()[0].phase).toBe('hold');
            }
            return;
        }
        expect(get(D + '/' + DAY)).toEqual(expect.objectContaining({ codDollar: 5, dodDollar: 0, totalCount: 1 }));
        expect(get(M + '/2026-10')).toEqual(expect.objectContaining({ codDollar: 5, dodDollar: 0, totalCount: 1 }));
        ztoPickupStatus.clear(); ztoState.ztoStatusLoaded = false; loadZtoPickupStatusOnce();
        if (fault === 'normal' || fault === 'late-save' || fault === 'after-ack' || fault === 'newer-sign-verdict') {
            expect(get(P + '/' + DAY), 'born-closed import ចូល «យករួច» ម្តង').toMatchObject({ packagesPickedUp: 1, pickedUpBarcodes: { [CODE]: PHONE }, pickedUpPhones: { [PHONE]: 1 } });
        } else if (fault === 'reset-after-epoch') {
            expect(preparePaused).toBe(true);
            expect(get(P + '/' + DAY), 'Reset ក្រោយ epoch ដើម ➜ born-closed import មិនបន្ថែម key').toEqual(expect.objectContaining({ packagesPickedUp: 0, pickupResetEpoch: 1 }));
            expect(get(P + '/' + DAY)?.pickedUpBarcodes?.[CODE]).toBeUndefined();
        } else expect(get(P + '/' + DAY)?.packagesPickedUp || 0).toBe(0);
        expect(getZtoPickupVerdict(CODE, ztoVerdictCandidate(item, barcode))?.closed).toBe(true);
        expect(ztoPickupStatus.get(CODE)).toBeUndefined();
        if (fault === 'mirror-refused') expect(mirrorRefusals).toBeGreaterThan(0);
        const journal = () => createScanEvidenceJournal(appLocalStore, 2).list(pendingScanScope());
        expect(Object.values(get('zoew_scan_operations')).map((receipt: any) => receipt.phase)).toEqual(['committed']);
        if (fault === 'normal' || fault === 'late-save' || fault === 'after-ack' || fault === 'reset-after-epoch') {
            expect(get(C + '/' + DAY + '/' + CODE)).toEqual({ c: 5, d: 0 });
            expect(journal()).toEqual([]);
            expect(readPickupJournal()).toEqual([]);
            expect(interruptedAtBoundary).toBe(fault === 'after-ack');
            if (fault === 'normal') expect(uiState.toasts.some((toast: any) => toast.msg.includes('ចំណូលយករួចនៅរង់ចាំផ្ទៀង'))).toBe(false);
        } else {
            expect(interruptedAtBoundary).toBe(fault === 'handoff');
            expect(journal()).toHaveLength(1);
            expect(journal()[0].phase).toBe(fault === 'phase-refused' ? 'hold' : 'collected-pending');
            const reconstructed = { record: copy(journal()[0]), db: firebaseState.db, sdk: firebaseState.fb, auth: firebaseState.authGeneration };
            expect(await finishScanImportCollected(reconstructed, { collectedSaved: true, pickupSaved: true, itemId: item.id, scanDate: item.scanDate, barcode: copy(barcode) })).toBe(false);
            expect(get(C)).toBeNull();
            const settled = copy(tree), writesBefore = serverWrites;
            firebaseState.db = { app } as any; firebaseState.authGeneration++;
            dataState.scanHistory = Object.values(get(H)); dataState.pickupResumeInFlight = false;
            const toastsBefore = uiState.toasts.length;
            if (mode === 'interval-retention') {
                serverNow.mockRestore();
                const midnight = Date.UTC(2026, 10, 5, 17);
                vi.setSystemTime(midnight + 500); vi.spyOn(performance, 'now').mockReturnValue(1000); clock.resetServerClock();
                expect(clock.acceptServerClockOffset(0, Object.freeze({ epochMs: midnight - 500, estimateEpochMs: midnight + 500,
                    uncertaintyMs: 2000, wallMs: Date.now(), monotonicMs: 1000 }), false)).toBe(true);
                firebaseState.sessionExpiryCheck = 'live';
                await resumePendingScanOperations();
                expect(journal()).toHaveLength(1); expect(journal()[0].phase).toBe('collected-pending');
                expect(serverWrites).toBe(writesBefore); expect(get(C)).toBeNull();
                expect(get(P + '/' + DAY)?.packagesPickedUp || 0).toBe(0);
                expect(clock.acceptServerClockOffset(0, Object.freeze({ epochMs: midnight + 500, estimateEpochMs: midnight + 500,
                    uncertaintyMs: 0, wallMs: Date.now(), monotonicMs: 1000 }), false)).toBe(true);
                await resumePendingScanOperations();
                expect(journal()).toEqual([]); expect(get(C)).toBeNull();
                expect(get(P + '/' + DAY)?.pickedUpBarcodes?.[CODE]).toBe(PHONE);
                expect(get(D + '/' + DAY)).toMatchObject({ codDollar: 5, totalCount: 1 });
                expect(get(M + '/2026-10')).toMatchObject({ codDollar: 5, totalCount: 1 });
                return;
            }
            if (mode === 'transient-exit') {
                blip = true;
                vi.stubGlobal('confirm', () => true);
                expect(await resolveScanEvidence()).toBe(true);
                const remaining = journal();
                const receipt: any = Object.values(get('zoew_scan_operations'))[0];
                expect(blipHit).toBe(true);
                expect(receipt.phase).toBe('committed');
                expect(remaining, 'កំណត់ត្រាដែល Server បញ្ជាក់ មិនត្រូវទម្លាក់ដោយផ្លូវចេញម្ចាស់').toHaveLength(0);
                expect(get(C + '/' + DAY + '/' + CODE), 'mirror ត្រូវសរសេរ').toEqual({ c: 5, d: 0 });
                expect((window as any).ZoeErrors.capture.mock.calls.filter((c: any[]) => c[1]?.context === 'resolveRetainedScanEvidence'), 'គ្មានការទម្លាក់ (Sentry money)').toEqual([]);
                expect(get(P + '/' + DAY)?.pickedUpBarcodes?.[CODE], 'ផ្លូវចេញម្ចាស់បញ្ចប់កំណត់ត្រាដែល Server បញ្ជាក់ («យករួច» សរសេរ)').toBe(PHONE);
                return;
            }
            await resumePendingScanOperations(); await resumePendingScanOperations();
            if (fault === 'handoff') {
                expect(journal(), 'importer ដើមបាត់ ➜ ការសង្គ្រោះបញ្ចប់ពី server ពិត').toEqual([]);
                expect(get(C + '/' + DAY + '/' + CODE)).toEqual({ c: 5, d: 0 });
                expect(get(P + '/' + DAY)).toMatchObject({ packagesPickedUp: 1, pickedUpBarcodes: { [CODE]: PHONE }, pickedUpPhones: { [PHONE]: 1 } });
                expect(get(D + '/' + DAY)).toMatchObject({ codDollar: 5, totalCount: 1 }); expect(get(M + '/2026-10')).toMatchObject({ codDollar: 5, totalCount: 1 });
                expect(uiState.toasts.slice(toastsBefore).filter((toast: any) => /✅|⚠️/.test(toast.msg)), 'ការសង្គ្រោះស្ងាត់').toEqual([]);
                const done = copy(tree), writesDone = serverWrites;
                await resumePendingScanOperations();
                expect(tree).toEqual(done); expect(serverWrites).toBe(writesDone);
                return;
            }
            expect(tree).toEqual(settled); expect(serverWrites).toBe(writesBefore);
            expect(journal()).toHaveLength(1);
            expect(get(C), 'mirror មិនអាចសរសេរ ➜ ភស្តុតាងនៅរក្សាទុក').toBeNull();
            expect(get(P + '/' + DAY)?.packagesPickedUp || 0).toBe(0);
            if (fault !== 'phase-refused') expect(uiState.toasts.some((toast: any) => toast.msg.includes('ចំណូលយករួចនៅរង់ចាំផ្ទៀង'))).toBe(true);
        }

    } finally { await sdk.deleteApp(app); firebaseState.authGeneration++; }
}, 15000);
