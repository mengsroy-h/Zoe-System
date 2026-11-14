import { acceptFixtureSession } from './helpers/accepted-session';
import { createRequire } from 'node:module';
import { cleanupServerRead } from './helpers/cleanup-server-read';
import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fieldValue, refTo, setFieldValue } from '../../../../ZoeW/src/app/refs';
import { dataState, firebaseState, lookupState, scanState, securityState, uiState } from '../../../../ZoeW/src/core/state';
import { shopScope } from '../../../../ZoeW/src/core/shop-scope';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { registerModalMeta, unregisterModalMeta } from '../../../../ZoeW/src/core/modals';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { getFormattedDate } from '../../../../ZoeW/src/core/timezone';
import { barcodeSignIdentity } from '../../../../ZoeW/src/domain/barcode';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, readCleanupJournal } from '../../../../ZoeW/src/domain/cleanup';
import { resumePendingScanOperations } from '../../../../ZoeW/src/services/scan-operation';
import { confirmPhone, triggerScanAction } from '../../../../ZoeW/src/features/scan-action';
import { attemptAutoLookup, autoLookupFailureAt, autoLookupInFlight, clearAutoLookupQueueRetries, lookupFastCache } from '../../../../ZoeW/src/features/auto-lookup';
import { clearCustomerDataTableCache } from '../../../../ZoeW/src/features/customer-table';
import { applyBarcodeCloseChange, removeSingleBarcode } from '../../../../ZoeW/src/features/barcode-ops';
import { deleteSingleItem } from '../../../../ZoeW/src/features/entry-ops';
import { activeRestoreClaims, executeRestoreItem, restoreInFlight } from '../../../../ZoeW/src/features/restore';
import { autoCloseBarcodeFromZto, clearZtoPickupStatusStore, setZtoPickupVerdict } from '../../../../ZoeW/src/features/zto-status';
import { resetZtoFinalMarks, syncZtoFinalMarks } from '../../../../ZoeW/src/features/zto-final-marks';
import { persistPalmSignJob, runPalmSignOutbox } from '../../../../ZoeW/src/features/palm-sign-outbox';
import { recordSigned } from '../../../../ZoeW/src/services/palm-sign-transport';
import { openSignJob } from '../../../../ZoeW/src/services/palm-sign-outbox-store';
import { encryptLookupSecret } from '../../../../ZoeW/src/services/crypto';
import { noteZtoTrashMode, resetZtoTrashMode } from '../../../../ZoeW/src/services/zto-trash-mode';
import { closeModal, openModalHelper } from '../../../../ZoeW/src/ui/modal';

// មុខងារ app ពិតទាំងអស់; ជំនួសតែ SDK, HTTP និង disk។ Rules/DB ពិតវាស់ក្នុង money-multidevice។
const scanProtocol = vi.hoisted(() => ({ version: 2 as 1 | 2 }));
vi.mock('../../../../ZoeW/src/services/scan-pending', async load => {
    const original = await load<any>();
    return { ...original, preparePendingScan: (code: string, cod: number, dod: number, stamp: number, mode: string) =>
        original.preparePendingScan(code, cod, dod, stamp, mode, scanProtocol.version) };
});
const disk = vi.hoisted(() => ({ rows: new Map<string, any>() }));
vi.mock('../../../../ZoeW/src/services/palm-sign-outbox-store', async (original) => ({ ...await original<any>(),
    listSignJobs: async (owner) => [...disk.rows.values()].filter((row) => row.owner === owner).map((row) => ({ ...row })),
    addSignJob: async (row, current) => {
        if (!current()) throw new Error('outbox:aborted');
        if (disk.rows.has(row.id)) return false;
        disk.rows.set(row.id, { ...row }); return true;
    },
    replaceSignJob: async (previous, next, current) => {
        const actual = disk.rows.get(previous.id);
        if (!current() || !actual || actual.revision !== previous.revision) return false;
        if (next) disk.rows.set(next.id, { ...next, revision: previous.revision + 1 }); else disk.rows.delete(previous.id);
        return true;
    }
}));

const H = 'zoew_scan_history_cod_dod';
const T = 'zoew_recently_deleted_cod_dod';
const D = 'zoew_daily_revenue_cod_dod';
const M = 'zoew_monthly_revenue_cod_dod';
const P = 'zoew_daily_pickup_cod_dod';
const C = 'zoew_daily_collected_cod_dod';
const HOST = 'https://money-matrix.firebaseio.com';
const NOW = Date.UTC(2026, 9, 24, 2);
const CODE = '77130500000012';
const SECOND = '77130500000013';
const modes = ['sheet', 'cookie', 'palm'] as const;
type Mode = typeof modes[number];
const fields = ['modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput'] as const;
const lab = {
    backend: 'firebase' as 'firebase' | 'supabase',
    store: {} as Record<string, any>,
    failed: new Set<string>(),
    failNext: new Set<string>(),
    tx: [] as { path: string; proposed: any; failed: boolean }[],
    rootAckLost: false,
    rootAckLostCount: 0,
    historyGate: null as Promise<void> | null
};
let key: CryptoKey;
let network: (url: URL, body: any) => Promise<Response>;
let requests: { url: URL; body: any }[];
const clone = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const parts = (path: string) => path.split('/').filter(Boolean);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function gate<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { resolve, promise }; }
function getAt(path: string): any { return clone(parts(path).reduce((node, part) => node?.[part], lab.store) ?? null); }
function prune(value: any): any {
    if (value == null || typeof value !== 'object') return value ?? null;
    const next: any = Array.isArray(value) ? [] : {};
    for (const [name, child] of Object.entries(value)) { const kept = prune(child); if (kept !== null) next[name] = kept; }
    return Object.keys(next).length ? next : null;
}
function setAt(path: string, value: any) {
    const segments = parts(path);
    if (!segments.length) { lab.store = prune(clone(value)) || {}; return; }
    const leaf = segments.pop()!; let node = lab.store;
    for (const segment of segments) node = node[segment] ||= {};
    const kept = prune(clone(value));
    if (kept === null) delete node[leaf]; else node[leaf] = kept;
    lab.store = prune(lab.store) || {};
}
const ref = (path = '') => ({ path, key: parts(path).at(-1) || null, toString: () => lab.backend === 'supabase' ? 'supabase:' + path : HOST + '/' + path });
const snapshot = (r: any, value: any) => ({ ref: r, key: r.key, val: () => clone(value), exists: () => value !== null });
function sdk() {
    return {
        ref: (_db: any, path = '') => ref(path), increment: (amount: number) => ({ __increment: amount }),
        getIdTokenResult: async () => ({ token: 'synthetic-identity' }),
        get: async (r: any) => snapshot(r, getAt(r.path)),
        set: async (r: any, value: any) => setAt(r.path, value),
        update: async (r: any, updates: any) => {
            if (r.path === H && lab.historyGate) await lab.historyGate;
            for (const [child, update] of Object.entries(updates)) {
                const path = [r.path, child].filter(Boolean).join('/');
                const value: any = update;
                setAt(path, value?.__increment !== undefined ? (Number(getAt(path)) || 0) + value.__increment : value);
            }
            if (!r.path && lab.rootAckLost) {
                lab.rootAckLost = false; lab.rootAckLostCount++;
                throw new Error('disconnect after committed root update');
            }
        },
        runTransaction: async (r: any, change: (value: any) => any) => {
            if (r.path.startsWith(H + '/') && lab.historyGate) await lab.historyGate;
            const prior = getAt(r.path); const next = change(clone(prior));
            const fail = next !== undefined && lab.failNext.delete(r.path);
            lab.tx.push({ path: r.path, proposed: clone(next), failed: fail });
            if (fail) { lab.failed.add(r.path); throw Object.assign(new Error('disconnect'), { code: 'disconnect', txOutcome: 'not-applied' }); }
            if (next === undefined) return { committed: false, snapshot: snapshot(r, prior) };
            setAt(r.path, next); return { committed: true, snapshot: snapshot(r, getAt(r.path)) };
        }, onValue: () => () => {}, off: () => {}
    };
}
function expectRegistryOwner() {
    const operations = Object.values(getAt('zoew_scan_operations') || {}) as any[];
    const operation = operations.find(row => row.code === CODE && row.phase === 'committed');
    expect(operation).toBeTruthy();
    expect(getAt('zoew_barcode_registry')).toEqual({ [CODE]: {
        v: 2, intent: operation.id, actorUid: 'money-user', birth: operation.birth
    } });
}
function sync() {
    dataState.scanHistory = Object.values(getAt(H) || {});
    dataState.deletedItems = Object.values(getAt(T) || {});
    dataState.dailyRevenueData = getAt(D) || {}; dataState.monthlyRevenueData = getAt(M) || {};
    dataState.dailyPickupData = getAt(P) || {}; dataState.dailyCollectedData = getAt(C) || {};
}
const day = () => getFormattedDate();
const moneyPaths = () => [D + '/' + day(), M + '/' + day().slice(0, 7)];
const moneyTransactionPaths = () => [D + '/' + day(), M];
function expectMoney(cod: number, dod: number, count: number) {
    for (const path of moneyPaths()) expect(getAt(path)).toMatchObject({ codDollar: cod, dodDollar: dod, totalCount: count });
}
function expectIdentities(history: string[], trash: string[]) {
    const codes = (root: string) => (Object.values(getAt(root) || {}) as any[]).flatMap((item) => item.barcodes.map((bc: any) => bc.code)).sort();
    expect(codes(H)).toEqual([...history].sort()); expect(codes(T)).toEqual([...trash].sort());
    expect(new Set([...codes(H), ...codes(T)]).size).toBe(history.length + trash.length);
}
function currentItem(code = CODE) { return dataState.scanHistory.find((item) => item.barcodes?.some((bc) => bc.code === code))!; }
const trashId = () => dataState.deletedItems[0].id;
async function useMode(mode: Mode) {
    const cfg: any = { enabled: true, fastMode: true, autoSubmit: false, phoneField: 'phone', codField: 'cod', dodField: 'dod', shop: shopScope(),
        url: mode === 'sheet' ? 'https://script.google.com/macros/s/AKfy/exec?code={barcode}&key=k'
            : window.location.origin + '/.netlify/functions/zto-order-detail?' + (mode === 'palm' ? 'palm=1&' : '') + 'barcode={barcode}' };
    if (mode !== 'sheet') Object.assign(cfg, { headerName: 'X-Zoe-Proxy-Key', headerValueEnc: await encryptLookupSecret('synthetic-key') });
    if (mode === 'palm') cfg.palmTokenEnc = await encryptLookupSecret('synthetic-session');
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
    noteZtoTrashMode(null);
}
async function scan(code = CODE, cod = 10, dod = 2, lookup = true) {
    scanState.pendingBarcode = code; scanState.phoneModalTyped = false;
    for (const field of fields) setFieldValue(field, '');
    openModalHelper('phoneModal');
    if (lookup) {
        network = async (url) => json({ success: true, found: true, cached: false, verifiedForRestore: true,
            barcode: url.searchParams.get('barcode') || url.searchParams.get('code'), phone: '012345678', cod, dod, ztoClosed: false });
        await attemptAutoLookup(code);
        expect(fieldValue('modalPhoneInput')).toBe('012345678');
        expect(Number(fieldValue('modalCodInput'))).toBe(cod); expect(Number(fieldValue('modalDodInput'))).toBe(dod);
    } else {
        setFieldValue('modalPhoneInput', '012345678'); setFieldValue('modalCodInput', String(cod)); setFieldValue('modalDodInput', String(dod));
    }
    await Promise.all([confirmPhone(), confirmPhone()]);
    sync(); expect(currentItem(code)).toBeTruthy();
    return currentItem(code).id;
}
async function restore(id: string) { uiState.pendingRestoreId = id; await executeRestoreItem(); sync(); }
async function closedTotals(count = 1, cod = 10, dod = 2) {
    await vi.waitFor(() => expect(getAt(P + '/' + day())?.packagesPickedUp).toBe(count));
    const pickup = getAt(P + '/' + day());
    expect(Object.keys(pickup.pickedUpPhones || {})).toHaveLength(1);
    expect(Object.keys(pickup.pickedUpBarcodes || {}).sort()).toEqual([CODE, SECOND].slice(0, count).sort());
    expect(Object.keys(getAt(C + '/' + day()) || {}).sort()).toEqual([CODE, SECOND].slice(0, count).sort());
    const collected = Object.values(getAt(C + '/' + day()) || {}) as { c: number; d: number }[];
    expect(collected).toHaveLength(count);
    expect(collected.reduce((sum, row) => sum + row.c, 0)).toBe(cod);
    expect(collected.reduce((sum, row) => sum + row.d, 0)).toBe(dod);
}

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('indexedDB', {}); vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', vi.fn());
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    scanProtocol.version = 2;
    lab.backend = 'firebase'; lab.store = {}; lab.failed.clear(); lab.failNext.clear(); lab.tx = []; lab.rootAckLost = false; lab.rootAckLostCount = 0; lab.historyGate = null;
    disk.rows.clear(); appLocalStore.clear(); clearCustomerDataTableCache(); resetZtoFinalMarks(); clearZtoPickupStatusStore();
    autoLookupFailureAt.clear(); autoLookupInFlight.clear(); lookupFastCache.clear(); clearAutoLookupQueueRetries();
    activeRestoreClaims.clear(); restoreInFlight.clear(); cleanupInFlight.clear(); cleanupJournalLive.clear();
    dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    firebaseState.authGeneration++; firebaseState.db = { name: 'matrix-db' }; firebaseState.fb = sdk() as any;
    firebaseState.auth = { currentUser: { uid: 'money-user', getIdToken: async () => 'synthetic-id' } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true; firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.sessionExpiryCheck = 'live';
    firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0;
    firebaseState.dbRefHistory = ref(H); firebaseState.dbRefDeleted = ref(T); firebaseState.dbRefDailyRevenue = ref(D); firebaseState.dbRefMonthlyRevenue = ref(M);
    firebaseState.dbRefDailyPickup = ref(P); firebaseState.dbRefDailyCollected = ref(C);
    firebaseState.dbLivenessProbe = Promise.resolve(null);
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    acceptFixtureSession();
    key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as CryptoKey;
    securityState.lookupSecretKey = key; securityState.appIsLocked = false; securityState.appLockVeiled = false;
    resetZtoTrashMode(); noteZtoTrashMode(null); sync();
    uiState.toasts = []; uiState.isModalOpen = false; uiState.entryScanMode = 'normal'; viewState.phoneModalBusy = false;
    lookupState.customerDataTableSessionGeneration++;
    for (const field of fields) refTo(field)(document.createElement('input'));
    registerModalMeta('phoneModal', {});
    requests = []; network = async () => json({ success: false });
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        const parsed = new URL(String(url), window.location.href); const body = init?.body ? JSON.parse(String(init.body)) : null;
        if (parsed.origin === HOST) return cleanupServerRead(getAt)(parsed, init);
        requests.push({ url: parsed, body }); return network(parsed, body);
    }));
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(async () => {
    await runPalmSignOutbox(); resetZtoFinalMarks(); clearZtoPickupStatusStore(); clearAutoLookupQueueRetries(); clearCustomerDataTableCache();
    firebaseState.authGeneration++; securityState.lookupSecretKey = null; closeModal('phoneModal'); unregisterModalMeta('phoneModal');
    for (const field of fields) refTo(field)(null);
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as any).ZoeErrors;
});

describe('Lookup ទាំងបី៖ ប្រាក់ និងអត្តសញ្ញាណតាមមុខងារ app ពិត', () => {
    it.each(modes)('%s៖ lookup→ចុចរក្សាទុកស្ទួន→ស្កេនស្ទួន→កញ្ចប់ទីពីរ មិនបូកស្ទួន', async (mode) => {
        await useMode(mode); const id = await scan(); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        triggerScanAction('  ' + CODE + '  '); await confirmPhone(); sync();
        expectMoney(10, 2, 1); expectIdentities([CODE], []);
        dataState.scanHistory = []; scanState.pendingBarcode = CODE;
        await confirmPhone(); sync(); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        await scan(SECOND, 3.5, 0.25); expectMoney(13.5, 2.25, 2); expectIdentities([CODE, SECOND], []);
        expect(dataState.scanHistory).toHaveLength(1); expect(currentItem().id).toBe(id);
    });

    it.each((['firebase', 'supabase'] as const).flatMap(backend => (['cookie', 'palm'] as const).flatMap(mode => (['cached', 'unverified', 'offline'] as const).map(kind => ({ backend, mode, kind })))))('$mode $backend $kind៖ ស្តារហាម មិនបូកប្រាក់; ភស្តុតាងថ្មីអនុញ្ញាតស្តារតែម្តង', async ({ backend, mode, kind }) => {
        useSyntheticBackend(backend);
        await useMode(mode); const id = await scan(); await removeSingleBarcode(id, CODE); sync(); expectMoney(0, 0, 0);
        const removed = trashId(); const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(kind !== 'offline');
        const fresh = { success: true, found: true, barcode: CODE, cached: false, verifiedForRestore: true, ztoClosed: false };
        network = async () => json({ ...fresh, ...(kind === 'cached' ? { cached: true } : { verifiedForRestore: false }) });
        await restore(removed); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        expect(getAt(T + '/' + removed + '/restoreClaim')).toBeNull(); expect(getAt('zoew_restore_finalizations')).toBeNull();
        online.mockReturnValue(true); network = async () => json(fresh);
        await restore(removed); expectMoney(10, 2, 1); expectIdentities([CODE], []);
    });

    it.each(modes)('%s៖ ដក→ស្តារ→លុប→ស្តារ និងធ្វើស្ទួនគ្រប់ជំហាន', async (mode) => {
        await useMode(mode); let id = await scan(); expectMoney(10, 2, 1);
        await Promise.all([removeSingleBarcode(id, CODE), removeSingleBarcode(id, CODE)]); sync();
        expectMoney(0, 0, 0); expectIdentities([], [CODE]); const removed = trashId();
        expect(dataState.deletedItems[0].barcodes[0].isDeducted).toBe(true);
        await restore(removed); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        const removalReceipt = getAt('zoew_trash_consumptions/' + removed);
        expect(removalReceipt).toMatchObject({ v: 1, sourceId: removed, generation: 1, kind: 'restore', actorUid: 'money-user', deletedAt: NOW,
            targetId: currentItem().id, token: expect.any(String), scope: shopScope() });
        await restore(removed); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        expect(getAt('zoew_trash_consumptions/' + removed)).toEqual(removalReceipt);
        vi.setSystemTime(Date.now() + 1);
        id = currentItem().id;
        await Promise.all([deleteSingleItem(id), deleteSingleItem(id)]); sync();
        expectMoney(10, 2, 1); expectIdentities([], [CODE]); const deleted = trashId();
        expect(dataState.deletedItems[0]).toMatchObject({ trashGeneration: 2, deletedAt: NOW + 1 });
        expect(dataState.deletedItems[0].barcodes[0].isDeducted).toBe(false);
        await restore(deleted); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        const deletionReceipt = getAt('zoew_trash_consumptions/' + deleted);
        expect(deletionReceipt).toMatchObject({ v: 1, sourceId: deleted, generation: 2, kind: 'restore', actorUid: 'money-user', deletedAt: NOW + 1,
            targetId: currentItem().id, token: expect.any(String), scope: shopScope() });
        await restore(deleted); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        expect(getAt('zoew_trash_consumptions/' + deleted)).toEqual(deletionReceipt);
        const verification = requests.filter((request) => request.url.searchParams.get('restore') === '1');
        expect(verification).toHaveLength(mode === 'sheet' ? 0 : 2);
        if (mode === 'palm') expect(verification.every(request => request.url.searchParams.get('palm') === '1')).toBe(true);
    });

    it.each(['palm-signed', 'cookie-signed'] as const)('%s៖ ដក→ស្តារហាម→លុបគ្មានធាតុ→ស្តារហាម មិនបូកប្រាក់', async (mode) => {
        await useMode(mode === 'palm-signed' ? 'palm' : 'cookie'); const id = await scan();
        await recordSigned(id, CODE, () => true); await syncZtoFinalMarks(); sync();
        await removeSingleBarcode(id, CODE); sync(); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        const removed = trashId();
        expect(dataState.deletedItems[0].restoreBlocked).toBe(true);
        expect(Number(dataState.deletedItems[0].barcodes[0].ztoSignedAt)).toBeGreaterThan(0);
        await restore(removed); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        expect(getAt(T + '/' + removed + '/restoreClaim')).toBeNull(); expect(getAt('zoew_restore_finalizations')).toBeNull();
        expect(await deleteSingleItem(id)).toBe('missing'); expectMoney(0, 0, 0);
        await restore(removed); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        await useMode('sheet'); await restore(removed); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
    });

    it.each(['palm-signed', 'cookie-signed'] as const)('%s៖ លុបរក្សាប្រាក់ ហើយស្តារហាមមិនបូកបន្ថែម', async (mode) => {
        await useMode(mode === 'palm-signed' ? 'palm' : 'cookie'); const id = await scan();
        await recordSigned(id, CODE, () => true); await syncZtoFinalMarks(); sync();
        await deleteSingleItem(id); sync(); expectMoney(10, 2, 1); expectIdentities([], [CODE]);
        const deleted = trashId(); await restore(deleted); expectMoney(10, 2, 1); expectIdentities([], [CODE]);
        await useMode('sheet'); await restore(deleted); expectMoney(10, 2, 1); expectIdentities([], [CODE]);
    });

    it.each(modes)('legacy v1 handle %s៖ ដាច់មុន commit ledger បូក/ដក → retry រក្សា op ដដែល និងចូលតែម្តង', async (mode) => {
        scanProtocol.version = 1;
        await useMode(mode); moneyTransactionPaths().forEach((path) => lab.failNext.add(path));
        const id = await scan(); expectMoney(10, 2, 1);
        moneyTransactionPaths().forEach((path) => lab.failNext.add(path));
        await removeSingleBarcode(id, CODE); sync(); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        expect(lab.failed.size).toBe(2);
        for (const path of moneyTransactionPaths()) {
            const writes = lab.tx.filter((row) => row.path === path);
            expect(writes.filter((row) => row.failed)).toHaveLength(2);
            const opOf = (value: any) => path === M ? value[day().slice(0, 7)].op : value.op;
            for (let n = 0; n < writes.length; n++) if (writes[n].failed) {
                expect(opOf(writes[n].proposed)).toMatch(/^op_/);
                expect(opOf(writes[n + 1].proposed)).toBe(opOf(writes[n].proposed));
            }
        }
    });

    it.each(modes)('v2 %s: month preflight failure holds claim without revenue; recovery cancels before fresh retry', async mode => {
        await useMode(mode);
        lab.failNext.add(M);
        scanState.pendingBarcode = CODE;
        openModalHelper('phoneModal');
        setFieldValue('modalPhoneInput', '012345678');
        setFieldValue('modalCodInput', '10'); setFieldValue('modalDodInput', '2');
        await confirmPhone(); sync();
        expect(lab.failed.has(M)).toBe(true);
        expect(dataState.scanHistory).toHaveLength(0);
        expect(getAt(D + '/' + day())).toBeNull();
        expect(getAt(M + '/' + day().slice(0, 7))).toBeNull();
        const operation = Object.values(getAt('zoew_scan_operations'))[0] as any;
        expect(operation).toMatchObject({ phase: 'prepared', code: CODE });
        expect(getAt('zoew_barcode_registry/' + CODE)).toEqual({ v: 2, intent: operation.id, actorUid: 'money-user', birth: operation.birth });
        await resumePendingScanOperations();
        expect(getAt('zoew_scan_operations/' + operation.id)).toMatchObject({ phase: 'cancelled' });
        expect(getAt('zoew_barcode_registry')).toBeNull();
        await scan(); sync();
        expectMoney(10, 2, 1); expectIdentities([CODE], []); expectRegistryOwner();
    });

    it.each(modes)('%s៖ ស្តារបាន commit តែ ACK ដាច់ → មិនបូកពីរដង', async (mode) => {
        await useMode(mode); const id = await scan(); await removeSingleBarcode(id, CODE); sync(); expectMoney(0, 0, 0);
        const removed = trashId(); lab.rootAckLost = true;
        await restore(removed); expect(lab.rootAckLostCount).toBe(1); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        await restore(removed); expectMoney(10, 2, 1); expectIdentities([CODE], []);
    });

    it.each([false, true])('Cookie៖ cleanup ពីរម៉ោងតាមបិទ ZoeW → ស្តារ (Sign=%s) រក្សាលុយ និង barcode តែមួយ', async (signed) => {
        await useMode('cookie'); const id = await scan();
        await applyBarcodeCloseChange(id, CODE, true, { silent: true, showModal: false }); await closedTotals(); sync();
        if (signed) { await recordSigned(id, CODE, () => true); await syncZtoFinalMarks(); sync(); }
        await claimAndCleanupItem(id, 'close'); sync(); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        vi.setSystemTime(NOW + 2 * 3600000 - 1);
        await claimAndCleanupItem(id, 'close'); sync(); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        vi.setSystemTime(NOW + 2 * 3600000);
        await Promise.all([claimAndCleanupItem(id, 'close'), claimAndCleanupItem(id, 'close')]); sync();
        expectMoney(10, 2, 1); expectIdentities([], [CODE]);
        const cleaned = trashId();
        expect(dataState.deletedItems[0]).toMatchObject({ trashMode: 'cookie', trashReason: 'pickup', isFromDeletion: true });
        expect(dataState.deletedItems[0].barcodes[0].isDeducted).toBe(false);
        expect(!!dataState.deletedItems[0].restoreBlocked).toBe(signed);
        expect(readCleanupJournal()).toHaveLength(0);
        network = async () => json({ success: true, found: true, barcode: CODE, cached: false, verifiedForRestore: true, ztoClosed: signed });
        await restore(cleaned); await restore(cleaned);
        expectMoney(10, 2, 1); expectIdentities(signed ? [] : [CODE], signed ? [CODE] : []);
        if (!signed) expect(currentItem().barcodes[0]).toMatchObject({ isClosed: true, closedAt: NOW + 2 * 3600000 });
        await closedTotals();
    });

    it('Cookie៖ cleanup មួយ barcode ក្នុងជួរលាយ → ស្តារ មិនប្ដូរប្រាក់/ស្ថានភាព barcode ផ្សេង', async () => {
        await useMode('cookie'); await scan(); await scan(SECOND, 3.5, 0.25); const id = currentItem().id;
        await applyBarcodeCloseChange(id, CODE, true, { silent: true, showModal: false }); await closedTotals(); sync();
        vi.setSystemTime(NOW + 2 * 3600000);
        await Promise.all([claimAndCleanupItem(id, 'close'), claimAndCleanupItem(id, 'close')]); sync();
        expectMoney(13.5, 2.25, 2); expectIdentities([SECOND], [CODE]);
        expect(currentItem(SECOND)).toMatchObject({ isClosed: false, cod: 3.5, dod: 0.25, count: 1 });
        const cleaned = trashId();
        network = async () => json({ success: true, found: true, barcode: CODE, cached: false, verifiedForRestore: true, ztoClosed: false });
        await restore(cleaned); await restore(cleaned);
        expectMoney(13.5, 2.25, 2); expectIdentities([CODE, SECOND], []);
        expect(currentItem(SECOND).barcodes.find((b) => b.code === SECOND)).toMatchObject({ isClosed: false, cod: 3.5, dod: 0.25 });
        await closedTotals();
    });

    it.each(modes)('%s៖ ចម្លើយ lookup យឺតពេល Save មិនជាន់ប្រាក់ដែលបានជ្រើស', async (mode) => {
        await useMode(mode); const answer = gate<Response>(); const write = gate<void>();
        scanState.pendingBarcode = CODE; openModalHelper('phoneModal');
        setFieldValue('modalPhoneInput', '012345678'); setFieldValue('modalCodInput', '0'); setFieldValue('modalDodInput', '2');
        network = async () => answer.promise; const lookup = attemptAutoLookup(CODE);
        await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0));
        lab.historyGate = write.promise; const save = confirmPhone();
        await vi.waitFor(() => expect(viewState.phoneModalBusy).toBe(true));
        answer.resolve(json({ success: true, found: true, barcode: CODE, phone: '099999999', cod: 99, dod: 7, ztoClosed: false }));
        await lookup; write.resolve(); await save; sync();
        expectMoney(0, 2, 1); expectIdentities([CODE], []); expect(currentItem().barcodes[0]).toMatchObject({ cod: 0, dod: 2 });
    });

    it.each(modes)('%s៖ បិទដដែលពីរដង រក្សាប្រាក់ និង pickup/collected តែមួយ', async (mode) => {
        await useMode(mode); const id = await scan(); const item = currentItem(); const identity = barcodeSignIdentity(item, item.barcodes[0]);
        for (let n = 0; n < 2; n++) {
            if (mode === 'sheet') await applyBarcodeCloseChange(id, CODE, true, { silent: true, showModal: false });
            else if (mode === 'cookie') { setZtoPickupVerdict(CODE, true, NOW); await autoCloseBarcodeFromZto({ itemId: id, code: CODE }, dataState.scanHistory); await syncZtoFinalMarks(); }
            else await recordSigned(id, CODE, () => true, identity, NOW);
            expectMoney(10, 2, 1); await closedTotals(); sync(); expectIdentities([CODE], []);
        }
    });

    it.each(modes)('%s៖ លេខទូរស័ព្ទមួយពីរកញ្ចប់ បិទម្តងហើយម្តងទៀតរាប់អត្តសញ្ញាណត្រូវ', async (mode) => {
        await useMode(mode); await scan(); await scan(SECOND, 3.5, 0.25);
        const id = currentItem().id;
        for (const code of [CODE, SECOND, CODE, SECOND]) {
            if (mode === 'sheet') await applyBarcodeCloseChange(id, code, true, { silent: true, showModal: false });
            else if (mode === 'cookie') { setZtoPickupVerdict(code, true, NOW); await autoCloseBarcodeFromZto({ itemId: id, code }, dataState.scanHistory); }
            else await recordSigned(id, code, () => true);
            expectMoney(13.5, 2.25, 2); sync(); expectIdentities([CODE, SECOND], []);
        }
        await closedTotals(2, 13.5, 2.25);
    });
});

describe('Palm durable queue → recordSigned → close/ledger ពិត', () => {
    const photo = Buffer.from([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217]).toString('base64');
    const requestId = '12345678-1234-4234-8234-123456789012';
    const originalSHA256 = createHash('sha256').update(Buffer.from(photo, 'base64')).digest('hex');
    const receipt = (body: any) => json({ success: true, stage: 'receipt', barcode: body.barcode, requestId: body.requestId, ztoClosed: true, photoAccepted: true,
        photoProof: { protocol: 'original-sha256-v1', verified: true, barcode: body.barcode, requestId: body.requestId, originalSHA256 } });
    function reservedNetwork(next: typeof network): typeof network {
        let started = false;
        return async (url, body) => {
            expect(body).toMatchObject({ barcode: CODE, requestId, photoProtocol: 'original-sha256-v1', originalSHA256, reservationProtocol: 'original-reservation-v1',
                originalFingerprint: createHash('sha256').update(JSON.stringify([CODE, requestId, 'សុខា', photo])).digest('hex') });
            if (body.stage === 'receipt-status' && !started) return json({ ...body, stage: 'receipt', code: 'ZTO_PALM_SIGN_RESUME_READY', reservationOwner: 'money-owner', reservationToken: 'money-reservation' }, 409);
            if (body.stage === 'receipt') {
                expect(body).toMatchObject({ photo, reservationOwner: 'money-owner', reservationToken: 'money-reservation' });
                started = true;
            }
            return next(url, body);
        };
    }
    async function queued(id: string) {
        const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        const input = { code: CODE, itemId: id, requestId, signMan: 'សុខា', photo, dispatchProof: 'synthetic-proof', autoConfirm: true };
        await persistPalmSignJob(input, () => true); await runPalmSignOutbox();
        await expect(persistPalmSignJob(input, () => true)).rejects.toThrow('outbox:duplicate');
        expect(disk.rows.size).toBe(1); expectMoney(10, 2, 1);
        expect(await openSignJob([...disk.rows.values()][0], key)).toMatchObject({ photo, originalSHA256, requestId });
        return online;
    }
    it('ACK យឺតក្រោយ sweep បិទរួច → pickup/collected តែមួយ និងមិនបូកប្រាក់ស្ទួន', async () => {
        await useMode('palm'); const id = await scan(); const online = await queued(id); const ack = gate<void>();
        requests = []; network = reservedNetwork(async (_url, body) => { await ack.promise; return receipt(body); });
        online.mockReturnValue(true); const running = runPalmSignOutbox();
        await vi.waitFor(() => expect(requests.filter((row) => row.body?.stage === 'receipt')).toHaveLength(1));
        setZtoPickupVerdict(CODE, true, NOW);
        await autoCloseBarcodeFromZto({ itemId: id, code: CODE }, dataState.scanHistory); await closedTotals(); expectMoney(10, 2, 1);
        ack.resolve(); await running;
        await vi.waitFor(async () => {
            expect(disk.rows.size).toBe(1);
            expect(await openSignJob([...disk.rows.values()][0], key)).toMatchObject({ signedCleanupConfirmed: true, photo, originalSHA256, requestId });
        });
        await runPalmSignOutbox(); await recordSigned(id, CODE, () => true); await closedTotals(); expectMoney(10, 2, 1); sync(); expectIdentities([CODE], []);
        expect(requests.filter((row) => row.body?.stage === 'receipt')).toHaveLength(1);
    });
    it('receipt បាត់ ACK → reconnect ផ្ទៀង receipt-status → បិទម្តង មិនផ្ញើ receipt ទីពីរ', async () => {
        await useMode('palm'); const id = await scan(); const online = await queued(id);
        requests = []; network = reservedNetwork(async (_url, body) => { if (body.stage === 'receipt') throw new TypeError('Failed to fetch'); return receipt(body); });
        online.mockReturnValue(true); await runPalmSignOutbox();
        expect(disk.rows.size).toBe(1); expectMoney(10, 2, 1); expect(getAt(P)).toBeNull();
        await vi.waitFor(async () => {
            const row = [...disk.rows.values()][0]; expect(await openSignJob(row, key)).toMatchObject({ phase: 'checking', photo, requestId });
            expect(row.due).toBeGreaterThan(NOW); expect(row.leaseUntil).toBe(0);
        });
        vi.setSystemTime(NOW + 16000); await runPalmSignOutbox();
        await vi.waitFor(async () => {
            expect(disk.rows.size).toBe(1);
            expect(await openSignJob([...disk.rows.values()][0], key)).toMatchObject({ signedCleanupConfirmed: true, photo, originalSHA256, requestId });
        }); await closedTotals(); expectMoney(10, 2, 1);
        await runPalmSignOutbox();
        expect(requests.map((request) => request.body.stage)).toEqual(['receipt-status', 'receipt', 'receipt-status']);
        expect(new Set(requests.map((request) => request.body.requestId))).toEqual(new Set([requestId]));
    });
    it('warning→auto-confirm→ACK ហៅ close ពិត និងរក្សា requestId/ប្រាក់ដដែល', async () => {
        await useMode('palm'); const id = await scan(); const online = await queued(id);
        requests = []; network = reservedNetwork(async (_url, body) => body.confirmationToken ? receipt(body)
            : json({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', stage: 'receipt', barcode: CODE,
                message: 'កញ្ចប់មានបញ្ហា សូមបញ្ជាក់ដោះស្រាយរួច', confirmationToken: 'same-parcel-confirm' }, 409));
        online.mockReturnValue(true); await runPalmSignOutbox();
        await vi.waitFor(async () => {
            expect(disk.rows.size).toBe(1);
            expect(await openSignJob([...disk.rows.values()][0], key)).toMatchObject({ signedCleanupConfirmed: true, photo, originalSHA256, requestId });
        }); await closedTotals(); expectMoney(10, 2, 1);
        expect(requests.map(row => row.body.stage)).toEqual(['receipt-status', 'receipt', 'receipt']);
        expect(requests[2].body).toEqual({ ...requests[1].body, confirmationToken: 'same-parcel-confirm' });
        await runPalmSignOutbox(); expect(requests).toHaveLength(3); expectMoney(10, 2, 1);
    });
    it('ACK មកក្រោយដកកញ្ចប់ → គ្មានការបិទ/បូកប្រាក់ឡើងវិញ ហើយស្តារនៅតែហាម', async () => {
        await useMode('palm'); const id = await scan();
        const emptyPickup = { packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 };
        setAt(P + '/' + day(), emptyPickup); sync();
        const online = await queued(id); const ack = gate<void>();
        requests = []; network = reservedNetwork(async (_url, body) => { await ack.promise; return receipt(body); });
        online.mockReturnValue(true); await runPalmSignOutbox();
        await vi.waitFor(() => expect(requests.filter((row) => row.body?.stage === 'receipt')).toHaveLength(1));
        await removeSingleBarcode(id, CODE); sync(); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        ack.resolve();
        await vi.waitFor(async () => {
            const row = [...disk.rows.values()][0]; expect(await openSignJob(row, key)).toMatchObject({ phase: 'checking', photo, requestId });
            expect(row.due).toBeGreaterThan(NOW); expect(row.leaseUntil).toBe(0);
        });
        vi.setSystemTime(NOW + 16000); await runPalmSignOutbox();
        await vi.waitFor(async () => {
            const row = [...disk.rows.values()][0]; expect(await openSignJob(row, key)).toMatchObject({ phase: 'checking', photo, requestId });
            expect(row.due).toBeGreaterThan(Date.now()); expect(row.leaseUntil).toBe(0);
        });
        expectMoney(0, 0, 0); expect(getAt(P)).toEqual({ [day()]: emptyPickup }); expect(getAt(C)).toBeNull();
        network = async () => json({ success: true, found: true, barcode: CODE, cached: false, verifiedForRestore: true, ztoClosed: true });
        await restore(trashId()); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        expect(requests.filter((row) => row.body?.stage === 'receipt')).toHaveLength(1);
        expect(requests.filter((row) => row.body?.stage === 'receipt-status')).toHaveLength(1);
        expect(requests.filter(row => row.body).map(row => row.body.stage)).toEqual(['receipt-status', 'receipt']);
        expect(requests.filter(row => row.url.searchParams.get('restore') === '1')).toHaveLength(1);
        expect(await openSignJob([...disk.rows.values()][0], key)).toMatchObject({ photo, requestId });
    });
});


const { invariant: independentInvariant, invariantBroken: independentInvariantBroken } = createRequire(import.meta.url)('../../money-multidevice-core.js');
const { createRevenueExpectation, scanDayForCheckpoint } = createRequire(import.meta.url)('../../money-cookie-blob.js');
describe('checker ឆ្លងថ្ងៃ៖ scan ពិតជាមួយ expected ឯករាជ្យ', () => {
    it.each([
        ['ថ្ងៃដដែល', '2026-10-31T16:59:58Z', '2026-10-31T16:59:59Z', '2026-10-31'],
        ['អធ្រាត្រ Cambodia', '2026-10-30T16:59:59Z', '2026-10-30T17:00:01Z', '2026-10-31'],
        ['ចុងខែ Cambodia', '2026-10-31T16:59:59Z', '2026-10-31T17:00:01Z', '2026-11-01']
    ])('%s៖ COD 10/DOD 2/count 1 នៅថ្ងៃ scan មិនមែនថ្ងៃចាប់ផ្តើម', async (_label, started, scanned, expectedDay) => {
        vi.setSystemTime(Date.parse(started));
        const initialDay = day(), expected = createRevenueExpectation({}); expected.adjust(initialDay, 0, 0, 0);
        vi.setSystemTime(Date.parse(scanned)); await useMode('palm');
        const before = Date.now(); await scan();
        const scanDay = scanDayForCheckpoint(currentItem(), { before, after: Date.now() });
        expect(scanDay).toBe(expectedDay); expected.adjust(scanDay, 10, 2, 1);
        expect(independentInvariantBroken(independentInvariant(clone(lab.store), scanDay, scanDay.slice(0, 7), [CODE], HOST))).toBeNull();
        expect(() => expected.verify(clone(lab.store), [CODE], 'scan')).not.toThrow();
        expectMoney(10, 2, 1); expectIdentities([CODE], []);
        if (initialDay !== scanDay) expect(getAt(D + '/' + initialDay)).toBeNull();
        if (initialDay.slice(0, 7) !== scanDay.slice(0, 7)) expect(getAt(M + '/' + initialDay.slice(0, 7))).toBeNull();
    });
});

it.each(modes.flatMap(mode => [false, true].map(reverse => [mode, reverse] as const)))('ជីកជម្រៅ %s បញ្ច្រាស %s៖ ដក/ស្តារកញ្ចប់ដដែល៦ជុំ បាត់ ACK រាល់ជុំ មិនស្ទួនប្រាក់', async (mode, reverse) => {
    await useMode(mode);
    const entries = [
        { code: CODE, cod: 111, dod: 11 },
        { code: SECOND, cod: 222, dod: 22 },
        { code: '77130500000014', cod: 333, dod: 33 }
    ];
    for (const item of entries) await scan(item.code, item.cod / 100, item.dod / 100);
    expectMoney(6.66, 0.66, 3);
    const order = reverse ? [2, 1, 0, 2, 0, 1] : [0, 1, 2, 0, 2, 1];
    for (const index of order) {
        const item = entries[index];
        const id = currentItem(item.code).id;
        await Promise.all([removeSingleBarcode(id, item.code), removeSingleBarcode(id, item.code)]);
        sync();
        expectMoney((666 - item.cod) / 100, (66 - item.dod) / 100, 2);
        expectIdentities(entries.filter(row => row.code !== item.code).map(row => row.code), [item.code]);
        const removed = dataState.deletedItems.find(row => row.barcodes.some(bc => bc.code === item.code))!.id;
        lab.rootAckLost = true;
        await restore(removed);
        await restore(removed);
        expectMoney(6.66, 0.66, 3);
        expectIdentities(entries.map(row => row.code), []);
        expect(dataState.scanHistory).toHaveLength(1);
    }
    expect(lab.rootAckLostCount).toBe(6);
});


// SDK/HTTP សិប្បនិម្មិត៖ backend នៅទីនេះវាស់ផ្លូវ app និង ref មិនមែន RLS/CAS របស់ DB ពិត។
const lifecycleCases = (['firebase', 'supabase'] as const).flatMap(backend =>
    (['cookie', 'cookie-signed', 'palm'] as const).flatMap(mode =>
        (['delete', 'remove', 'pickup'] as const).map(action => ({ backend, mode, action }))));
it.each(lifecycleCases)('$backend $mode $action៖ ទិដ្ឋភាព A/B/C ចាស់ និងចុចស្ទួន ផ្ទៀងប្រាក់/registry/barcode រាល់ជំហាន', async ({ backend, mode, action }) => {
    useSyntheticBackend(backend);
    await useMode(mode === 'palm' ? 'palm' : 'cookie');
    const id = await scan();
    const check = (where: 'history' | 'trash', deducted: boolean, closed: boolean) => {
        expectMoney(deducted ? 0 : 10, deducted ? 0 : 2, deducted ? 0 : 1);
        expectIdentities(where === 'history' ? [CODE] : [], where === 'trash' ? [CODE] : []);
        expectRegistryOwner();
        const rows = Object.values(getAt(where === 'history' ? H : T)) as any[];
        expect(rows[0].barcodes[0]).toMatchObject({ code: CODE, cod: 10, dod: 2, isDeducted: deducted, isClosed: closed });
    };
    check('history', false, false);
    let closed = false;
    if (action === 'pickup') {
        await applyBarcodeCloseChange(id, CODE, true, { silent: true, showModal: false }); await closedTotals(); sync();
        closed = true; check('history', false, true);
    }
    if (mode === 'cookie-signed' || mode === 'palm' && action === 'pickup') {
        vi.setSystemTime(NOW + 3600000);
        await recordSigned(id, CODE, () => true); await syncZtoFinalMarks(); sync();
        closed = true; check('history', false, true);
    }
    const staleHistory = clone(dataState.scanHistory);
    const move = () => action === 'delete' ? deleteSingleItem(id, { confirmed: true, quiet: true })
        : action === 'remove' ? removeSingleBarcode(id, CODE) : claimAndCleanupItem(id, 'close');
    if (action === 'pickup') {
        vi.setSystemTime(NOW + 2 * 3600000 - 1); await move(); sync(); check('history', false, true);
        vi.setSystemTime(NOW + 2 * 3600000);
        if (mode === 'palm') { await move(); sync(); check('history', false, true); vi.setSystemTime(NOW + 3 * 3600000); }
    }
    await Promise.all([move(), move()]); sync(); check('trash', action === 'remove', closed);
    const removed = trashId(), staleTrash = clone(dataState.deletedItems);
    for (let device = 0; device < 2; device++) {
        dataState.scanHistory = clone(staleHistory); dataState.deletedItems = [];
        await move(); sync(); check('trash', action === 'remove', closed);
    }
    network = async () => json({ success: true, found: true, barcode: CODE, cached: false, verifiedForRestore: true, ztoClosed: mode === 'cookie-signed' });
    const allowed = mode === 'cookie' || mode === 'palm' && action !== 'pickup';
    await restore(removed); check(allowed ? 'history' : 'trash', !allowed && action === 'remove', closed);
    for (let device = 0; device < 2; device++) {
        dataState.scanHistory = []; dataState.deletedItems = clone(staleTrash);
        await restore(removed); check(allowed ? 'history' : 'trash', !allowed && action === 'remove', closed);
    }
    expect(readCleanupJournal()).toEqual([]);
});

function useSyntheticBackend(backend: 'firebase' | 'supabase') {
    lab.backend = backend;
    if (backend === 'supabase') {
        const config = { supabaseUrl: 'https://synthetic.supabase.co', supabaseKey: 'sb_publishable_synthetic' };
        firebaseState.firebaseConfig = config as any;
        (firebaseState.fb as any).tenantScope = () => 'synthetic-shop';
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify(config));
        resetZtoTrashMode(); noteZtoTrashMode(null);
        acceptFixtureSession();
    }
}

it.each(['firebase', 'supabase'] as const)('%s Cookie៖ ផ្ទៀង ZTO យឺតមុនស្តារ រក្សាប្រាក់/អត្តសញ្ញាណ ហើយចុចស្ទួនមិនបូកពីរដង', async backend => {
    useSyntheticBackend(backend); await useMode('cookie');
    const id = await scan(); expectMoney(10, 2, 1); expectIdentities([CODE], []);
    await removeSingleBarcode(id, CODE); sync(); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
    const removed = trashId(), reply = gate<Response>();
    requests = []; network = async () => reply.promise;
    uiState.pendingRestoreId = removed; const pending = executeRestoreItem();
    await vi.waitFor(() => expect(requests.some(row => row.url.searchParams.get('restore') === '1')).toBe(true));
    expectMoney(0, 0, 0); expectIdentities([], [CODE]);
    expect(getAt(T + '/' + removed + '/restoreClaim')).toBeNull();
    uiState.pendingRestoreId = removed; await executeRestoreItem();
    expectMoney(0, 0, 0); expectIdentities([], [CODE]);
    reply.resolve(json({ success: true, found: true, barcode: CODE, cached: false, verifiedForRestore: true, ztoClosed: false }));
    await pending; sync(); expectMoney(10, 2, 1); expectIdentities([CODE], []);
    await restore(removed); expectMoney(10, 2, 1); expectIdentities([CODE], []);
    expectRegistryOwner();
});

it.each((['firebase', 'supabase'] as const).flatMap(backend =>
    (['absent', 'disabled'] as const).map(lookup => ({ backend, lookup }))))(
    '$backend lookup $lookup៖ local ដក/ស្តារ/លុប និងបាត់ ACK មិនស្ទួនប្រាក់',
    async ({ backend, lookup }) => {
        useSyntheticBackend(backend);
        if (lookup === 'disabled') appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: false }));
        else appLocalStore.removeItem('zoew_lookup_api_config');
        noteZtoTrashMode(null);
        const id = await scan(CODE, 1.25, 0.5, false);
        expectMoney(1.25, 0.5, 1); expectIdentities([CODE], []); expectRegistryOwner();
        await Promise.all([removeSingleBarcode(id, CODE), removeSingleBarcode(id, CODE)]); sync();
        expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        const removed = trashId();
        lab.rootAckLost = true;
        await restore(removed); await restore(removed);
        expectMoney(1.25, 0.5, 1); expectIdentities([CODE], []); expectRegistryOwner();
        expect(lab.rootAckLostCount).toBe(1);
        vi.setSystemTime(Date.now() + 1);
        await deleteSingleItem(currentItem().id, { confirmed: true, quiet: true }); sync();
        expectMoney(1.25, 0.5, 1); expectIdentities([], [CODE]);
        expect(dataState.deletedItems[0]).toMatchObject({ trashGeneration: 2, deletedAt: NOW + 1 });
        const deleted = trashId();
        await restore(deleted); await restore(deleted);
        expectMoney(1.25, 0.5, 1); expectIdentities([CODE], []); expectRegistryOwner();
        expect(requests.filter(request => request.url.searchParams.get('restore') === '1')).toEqual([]);
        expect(readCleanupJournal()).toEqual([]);
    }
);

it.each(['control', 'drop', 'cod', 'swap', 'duplicate'])('ផ្លូវបិទ app ពិត និង collected write ខូច៖ %s', async fault => {
    await useMode('sheet'); const id = await scan();
    const expected = createRevenueExpectation(clone(lab.store));
    const originalUpdate = firebaseState.fb.update;
    let hits = 0;
    firebaseState.fb.update = (async (r: any, updates: any) => {
        if (r.path !== C || !Object.values(updates).some(Boolean)) return originalUpdate(r, updates);
        hits++;
        if (fault === 'drop') return;
        await originalUpdate(r, updates);
        if (fault !== 'control') {
            const mirror = getAt(C) || {};
            for (const entries of Object.values(mirror) as any[]) for (const leaf of Object.values(entries) as any[]) {
                if (fault === 'cod') leaf.c += 99;
                if (fault === 'swap') { leaf.c -= 1; leaf.d += 1; }
            }
            if (fault === 'duplicate') mirror['2026-10-19'] = clone(mirror[day()]);
            setAt(C, mirror);
        }
    }) as any;
    expect(await applyBarcodeCloseChange(id, CODE, true, { silent: true, showModal: false })).toBe(true);
    sync();
    expect(hits).toBeGreaterThan(0);
    expect(currentItem().barcodes[0].isClosed).toBe(true);
    expectMoney(10, 2, 1);
    const inspect = () => expected.verify(lab.store, [CODE], fault, Date.now());
    if (fault === 'control') expect(inspect).not.toThrow();
    else expect(inspect).toThrow();
});

// អយស្ករនេះកត់ intent ពី input/នាឡិកាមុនសកម្មភាព។ SDK ខូចអាចធ្វើ source និង mirror ខុសជាមួយគ្នា។
type OracleLookup = 'absent' | 'disabled' | 'sheet' | 'cookie' | 'cookie-signed' | 'palm';
type CorrelatedFault = 'control' | 'backdate-both' | 'reopen-both' | 'swap-parcel-values';
const oracleLookups: OracleLookup[] = ['absent', 'disabled', 'sheet', 'cookie', 'cookie-signed', 'palm'];
const correlatedFaults: CorrelatedFault[] = ['control', 'backdate-both', 'reopen-both', 'swap-parcel-values'];
const operationOracleCases = (['firebase', 'supabase'] as const).flatMap(backend => oracleLookups.flatMap(lookup =>
    correlatedFaults.map(fault => ({ backend, lookup, fault }))));
const configureOracleMode = useMode;
async function configureOracleLookup(lookup: OracleLookup) {
    if (lookup === 'absent' || lookup === 'disabled') {
        if (lookup === 'absent') appLocalStore.removeItem('zoew_lookup_api_config');
        else appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: false }));
        noteZtoTrashMode(null);
    } else await configureOracleMode(lookup === 'cookie-signed' ? 'cookie' : lookup);
}
async function oracleClose(lookup: OracleLookup, id: string) {
    if (lookup === 'cookie-signed') {
        setZtoPickupVerdict(CODE, true, Date.now());
        await autoCloseBarcodeFromZto({ itemId: id, code: CODE }, dataState.scanHistory);
        await syncZtoFinalMarks();
    } else if (lookup === 'palm') {
        expect(await recordSigned(id, CODE, () => true)).toBe(true);
        await syncZtoFinalMarks();
    } else expect(await applyBarcodeCloseChange(id, CODE, true, { silent: true, showModal: false })).toBe(true);
    sync();
}
function parcelExpectation(scanDay: string) {
    const expected = createRevenueExpectation(clone(lab.store), { requireParcelIntents: true });
    // Optional call ទុកឱ្យអយស្ករចាស់រត់ដល់ assertion៖ ដក expectParcel ចេញត្រូវធ្លាក់ negative controls មិនមែន crash។
    for (const [code, cod, dod] of [[CODE, 10, 2], [SECOND, 3.5, 0.25]] as const) {
        expected.expectParcel?.(code, { cod, dod, day: scanDay, root: 'history', closed: false, deducted: false, phone: '012345678' });
    }
    return expected;
}
function injectCorrelatedCollectedFault(fault: CorrelatedFault) {
    const originalUpdate = firebaseState.fb.update;
    const badStamp = Date.now() - 86400000;
    const badDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(badStamp);
    let hits = 0;
    firebaseState.fb.update = (async (r: any, updates: any) => {
        await originalUpdate(r, updates);
        if (r.path !== C || !Object.values(updates).some(Boolean)) return;
        hits++;
        if (fault === 'control') return;
        const history = getAt(H) || {};
        const row = (Object.values(history) as any[]).find(item => item.barcodes?.some(barcode => barcode.code === CODE));
        expect(row, 'ការចាក់ fault ត្រូវចំ barcode ពិតក្រោយ commit').toBeTruthy();
        const barcode = row.barcodes.find(entry => entry.code === CODE);
        const mirror = getAt(C) || {};
        if (fault === 'backdate-both') {
            barcode.closedAt = badStamp;
            if (row.isClosed) row.closedAt = badStamp;
            for (const record of Object.values(mirror) as any[]) delete record[CODE];
            mirror[badDay] ||= {}; mirror[badDay][CODE] = { c: barcode.cod, d: barcode.dod };
        } else if (fault === 'reopen-both') {
            barcode.isClosed = false; delete barcode.closedAt;
            row.isClosed = false; delete row.closedAt;
            for (const record of Object.values(mirror) as any[]) delete record[CODE];
            setAt(P, null);
        } else {
            const sibling = row.barcodes.find(entry => entry.code === SECOND);
            expect(sibling, 'ការប្ដូរតម្លៃត្រូវមាន barcode ពីរនៅ server').toBeTruthy();
            Object.assign(barcode, { cod: 3.5, dod: 0.25 });
            Object.assign(sibling, { cod: 10, dod: 2 });
            for (const record of Object.values(mirror) as any[]) if (record[CODE]) record[CODE] = { c: 3.5, d: 0.25 };
        }
        setAt(H, history); setAt(C, mirror);
    }) as any;
    return () => hits;
}
function expectCorrelatedFaultPresent(fault: CorrelatedFault, wantedClosedAt: number) {
    const barcode = currentItem(CODE).barcodes.find(entry => entry.code === CODE)!;
    if (fault === 'backdate-both') expect(barcode.closedAt).toBe(wantedClosedAt - 86400000);
    if (fault === 'reopen-both') {
        expect(barcode.isClosed).toBe(false); expect(getAt(C)).toBeNull();
        for (const pickup of Object.values(getAt(P) || {}) as any[]) {
            expect(pickup.packagesPickedUp || 0).toBe(0);
            expect(pickup.pickedUpBarcodes || {}).toEqual({}); expect(pickup.pickedUpPhones || {}).toEqual({});
        }
    }
    if (fault === 'swap-parcel-values') {
        expect(barcode).toMatchObject({ cod: 3.5, dod: 0.25 });
        expect(currentItem(SECOND).barcodes.find(entry => entry.code === SECOND)).toMatchObject({ cod: 10, dod: 2 });
    }
}
it.each(operationOracleCases)('[parcel-oracle-close] $backend $lookup $fault៖ source/mirror ខុសជាមួយគ្នា មិនអាចធ្វើ expected តាម actual', async ({ backend, lookup, fault }) => {
    useSyntheticBackend(backend); await configureOracleLookup(lookup);
    const scanDay = day(), useLookup = lookup !== 'absent' && lookup !== 'disabled';
    const id = await scan(CODE, 10, 2, useLookup); await scan(SECOND, 3.5, 0.25, useLookup);
    const expected = parcelExpectation(scanDay);
    expected.verify(clone(lab.store), [CODE, SECOND], 'before-close', Date.now());
    const closeAt = Date.now();
    expected.expectParcel?.(CODE, { closed: true, closedAt: [closeAt, closeAt] });
    const hits = injectCorrelatedCollectedFault(fault);
    await oracleClose(lookup, id);
    expect(hits()).toBeGreaterThan(0); expectIdentities([CODE, SECOND], []); expectMoney(13.5, 2.25, 2);
    expectCorrelatedFaultPresent(fault, closeAt);
    // ភស្តុតាងថា aggregate/mirror oracle ចាស់មិនចាប់ថ្នាក់នេះ មិនមែន test គ្រាន់តែបង្កើតទិន្នន័យខូចទទេ។
    expect(independentInvariantBroken(independentInvariant(clone(lab.store), scanDay, scanDay.slice(0, 7), [CODE, SECOND], undefined, Date.now()))).toBeNull();
    const inspect = () => expected.verify(clone(lab.store), [CODE, SECOND], 'close-' + fault, Date.now());
    if (fault === 'control') expect(inspect).not.toThrow(); else expect(inspect).toThrow();
});
it.each(operationOracleCases.filter(row => row.lookup !== 'cookie-signed'))('[parcel-oracle-restore] $backend $lookup $fault៖ ស្តារបិទ renew closedAt និងតម្លៃដើមតាម intent', async ({ backend, lookup, fault }) => {
    useSyntheticBackend(backend); await configureOracleLookup(lookup);
    const scanDay = day(), useLookup = lookup !== 'absent' && lookup !== 'disabled';
    const id = await scan(CODE, 10, 2, useLookup); await scan(SECOND, 3.5, 0.25, useLookup);
    const expected = parcelExpectation(scanDay), firstCloseAt = Date.now();
    if (lookup === 'palm') { await applyBarcodeCloseChange(id, CODE, true, { silent: true, showModal: false }); sync(); }
    else await oracleClose(lookup, id);
    expected.expectParcel?.(CODE, { closed: true, closedAt: [firstCloseAt, firstCloseAt] });
    expected.verify(clone(lab.store), [CODE, SECOND], 'closed-before-remove', Date.now());
    await removeSingleBarcode(id, CODE); sync();
    expected.adjust(scanDay, -10, -2, -1); expected.expectParcel?.(CODE, { root: 'trash', deducted: true });
    expected.verify(clone(lab.store), [CODE, SECOND], 'removed-before-restore', Date.now());
    const removed = trashId(); vi.setSystemTime(NOW + 86400000);
    const restoreAt = Date.now();
    expected.adjust(scanDay, 10, 2, 1); expected.expectParcel?.(CODE, { root: 'history', deducted: false, closed: true, closedAt: [restoreAt, restoreAt] });
    const hits = injectCorrelatedCollectedFault(fault);
    await restore(removed);
    expect(hits()).toBeGreaterThan(0); expectIdentities([CODE, SECOND], []);
    expect(getAt(D + '/' + scanDay)).toMatchObject({ codDollar: 13.5, dodDollar: 2.25, totalCount: 2 });
    expectCorrelatedFaultPresent(fault, restoreAt);
    expect(independentInvariantBroken(independentInvariant(clone(lab.store), scanDay, scanDay.slice(0, 7), [CODE, SECOND], undefined, Date.now()))).toBeNull();
    const inspect = () => expected.verify(clone(lab.store), [CODE, SECOND], 'restore-' + fault, Date.now());
    if (fault === 'control') expect(inspect).not.toThrow(); else expect(inspect).toThrow();
});
it.each((['firebase', 'supabase'] as const).flatMap(backend => (['palm', 'cookie-signed'] as const).map(lookup => ({ backend, lookup }))))(
    '[parcel-oracle-blocked] $backend $lookup៖ ស្តារហាមរក្សា intent ដើម និងមិនបាញ់ mirror write', async ({ backend, lookup }) => {
        useSyntheticBackend(backend); await configureOracleLookup(lookup);
        const scanDay = day(), id = await scan(); await scan(SECOND, 3.5, 0.25);
        const expected = parcelExpectation(scanDay), closedAt = Date.now();
        await oracleClose(lookup, id); expected.expectParcel?.(CODE, { closed: true, closedAt: [closedAt, closedAt] });
        await removeSingleBarcode(id, CODE); sync();
        expected.adjust(scanDay, -10, -2, -1); expected.expectParcel?.(CODE, { root: 'trash', deducted: true });
        expected.verify(clone(lab.store), [CODE, SECOND], 'blocked-before', Date.now());
        const removed = trashId(), before = clone(lab.store), hits = injectCorrelatedCollectedFault('backdate-both');
        vi.setSystemTime(NOW + 86400000); await restore(removed); await restore(removed);
        expect(hits()).toBe(0); expect(lab.store).toEqual(before); expectIdentities([SECOND], [CODE]);
        expected.verify(clone(lab.store), [CODE, SECOND], 'blocked-after', Date.now());
    }
);

it.each((['firebase', 'supabase'] as const).flatMap(backend => (['absent', 'disabled', 'sheet', 'cookie', 'palm'] as const).flatMap(lookup =>
    (['control', 'old-restoredAt', 'forbidden-closedAt'] as const).map(fault => ({ backend, lookup, fault })))))(
    '[parcel-oracle-open-restore] $backend $lookup $fault៖ ស្តារបើកត្រូវ renew restoredAt ហើយគ្មាន closedAt', async ({ backend, lookup, fault }) => {
        useSyntheticBackend(backend); await configureOracleLookup(lookup);
        const scanDay = day(), useLookup = lookup !== 'absent' && lookup !== 'disabled';
        const id = await scan(CODE, 10, 2, useLookup); await scan(SECOND, 3.5, 0.25, useLookup);
        const expected = parcelExpectation(scanDay);
        await removeSingleBarcode(id, CODE); sync();
        expected.adjust(scanDay, -10, -2, -1); expected.expectParcel?.(CODE, { root: 'trash', deducted: true });
        expected.verify(clone(lab.store), [CODE, SECOND], 'open-before-restore', Date.now());
        const removed = trashId(); vi.setSystemTime(NOW + 86400000); const restoreAt = Date.now();
        expected.adjust(scanDay, 10, 2, 1);
        expected.expectParcel?.(CODE, { root: 'history', closed: false, deducted: false, restoredAt: [restoreAt, restoreAt] });
        const originalUpdate = firebaseState.fb.update; let hits = 0;
        firebaseState.fb.update = (async (r: any, updates: any) => {
            await originalUpdate(r, updates);
            if (r.path || !Object.keys(updates).some(path => path.startsWith(H + '/'))) return;
            const history = getAt(H) || {};
            const row = (Object.values(history) as any[]).find(item => item.barcodes?.some(barcode => barcode.code === CODE));
            if (!row || row.restoreClaimId || row.restoreClaimToken || getAt(T + '/' + removed)) return;
            hits++;
            const barcode = row.barcodes.find(entry => entry.code === CODE);
            if (fault === 'old-restoredAt') barcode.restoredAt = NOW;
            if (fault === 'forbidden-closedAt') barcode.closedAt = NOW;
            setAt(H, history);
        }) as any;
        await restore(removed); expect(hits).toBeGreaterThan(0); expectIdentities([CODE, SECOND], []);
        const barcode = currentItem(CODE).barcodes.find(entry => entry.code === CODE)!;
        expect(barcode.isClosed).toBe(false); expect(getAt(C)).toBeNull();
        if (fault === 'old-restoredAt') expect(barcode.restoredAt).toBe(NOW);
        if (fault === 'forbidden-closedAt') expect(barcode.closedAt).toBe(NOW);
        expect(independentInvariantBroken(independentInvariant(clone(lab.store), scanDay, scanDay.slice(0, 7), [CODE, SECOND], undefined, Date.now()))).toBeNull();
        const inspect = () => expected.verify(clone(lab.store), [CODE, SECOND], 'open-restore-' + fault, Date.now());
        if (fault === 'control') expect(inspect).not.toThrow(); else expect(inspect).toThrow();
    }
);

it.each((['firebase', 'supabase'] as const).flatMap(backend => oracleLookups.map(lookup => ({ backend, lookup }))))(
    '[parcel-oracle-repeat-close] $backend $lookup៖ បិទស្ទួនពេលក្រោយរក្សាបង្អួច closedAt ដើម', async ({ backend, lookup }) => {
        useSyntheticBackend(backend); await configureOracleLookup(lookup);
        const scanDay = day(), useLookup = lookup !== 'absent' && lookup !== 'disabled';
        const id = await scan(CODE, 10, 2, useLookup); await scan(SECOND, 3.5, 0.25, useLookup);
        const expected = parcelExpectation(scanDay), closedAt = Date.now();
        expected.expectParcel?.(CODE, { closed: true, closedAt: [closedAt, closedAt] });
        await oracleClose(lookup, id); expected.verify(clone(lab.store), [CODE, SECOND], 'first-close', Date.now());
        vi.setSystemTime(NOW + 3600000); await oracleClose(lookup, id);
        expected.verify(clone(lab.store), [CODE, SECOND], 'repeat-close', Date.now());
    }
);
it.each((['firebase', 'supabase'] as const).flatMap(backend => (['absent', 'disabled', 'sheet', 'cookie', 'palm'] as const).flatMap(lookup =>
    [false, true].map(closed => ({ backend, lookup, closed })))))(
    '[parcel-oracle-repeat-restore] $backend $lookup closed=$closed៖ ស្តារស្ទួនរក្សាពេលស្តារដើម មិនបន្ថែមប្រាក់', async ({ backend, lookup, closed }) => {
        useSyntheticBackend(backend); await configureOracleLookup(lookup);
        const scanDay = day(), useLookup = lookup !== 'absent' && lookup !== 'disabled';
        const id = await scan(CODE, 10, 2, useLookup); await scan(SECOND, 3.5, 0.25, useLookup);
        const expected = parcelExpectation(scanDay), originalClose = Date.now();
        if (closed) {
            if (lookup === 'palm') { await applyBarcodeCloseChange(id, CODE, true, { silent: true, showModal: false }); sync(); }
            else await oracleClose(lookup, id);
            expected.expectParcel?.(CODE, { closed: true, closedAt: [originalClose, originalClose] });
        }
        await removeSingleBarcode(id, CODE); sync();
        expected.adjust(scanDay, -10, -2, -1); expected.expectParcel?.(CODE, { root: 'trash', deducted: true });
        expected.verify(clone(lab.store), [CODE, SECOND], 'before-repeat-restore', Date.now());
        const removed = trashId(); vi.setSystemTime(NOW + 86400000); const restoredAt = Date.now();
        expected.adjust(scanDay, 10, 2, 1);
        expected.expectParcel?.(CODE, { root: 'history', deducted: false, ...(closed ? { closedAt: [restoredAt, restoredAt] } : { restoredAt: [restoredAt, restoredAt] }) });
        await restore(removed); expected.verify(clone(lab.store), [CODE, SECOND], 'first-restore', Date.now());
        vi.setSystemTime(NOW + 90000000); await restore(removed);
        expected.verify(clone(lab.store), [CODE, SECOND], 'repeat-restore', Date.now());
    }
);

it.each(['pending', 'unverified', 'clock-untrusted'] as const)(
    '[audit-session-admission] Cookie %s៖ មិនបិទឬប្ដូរប្រាក់មុនផ្ទៀង ហើយបន្តក្រោយផ្ទៀងវិញ',
    async state => {
        await useMode('cookie');
        const id = await scan();
        setZtoPickupVerdict(CODE, true, NOW);
        const before = clone(lab.store);
        const transactions = lab.tx.length;
        firebaseState.sessionExpiryCheck = state === 'clock-untrusted' ? 'live' : state;
        firebaseState.serverClockTrusted = state !== 'clock-untrusted';
        expect(await autoCloseBarcodeFromZto({ itemId: id, code: CODE }, dataState.scanHistory)).toBe(false);
        expect(lab.store).toEqual(before);
        expect(lab.tx).toHaveLength(transactions);
        sync(); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        expect(currentItem().barcodes[0].isClosed).toBe(false);
        firebaseState.sessionExpiryCheck = 'live';
        firebaseState.serverClockTrusted = true;
        expect(await autoCloseBarcodeFromZto({ itemId: id, code: CODE }, dataState.scanHistory)).toBe(true);
        await closedTotals(); sync();
        expect(lab.tx.length).toBeGreaterThan(transactions);
        expectMoney(10, 2, 1); expectIdentities([CODE], []);
        expect(currentItem().barcodes[0].isClosed).toBe(true);
    }
);
