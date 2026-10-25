import { cleanupServerRead } from './helpers/cleanup-server-read';
import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fieldValue, refTo, setFieldValue } from '../src/app/refs';
import { dataState, firebaseState, lookupState, scanState, securityState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { viewState } from '../src/core/view-state';
import { registerModalMeta, unregisterModalMeta } from '../src/core/modals';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getFormattedDate } from '../src/core/timezone';
import { barcodeSignIdentity } from '../src/domain/barcode';
import { cleanupInFlight, cleanupJournalLive } from '../src/domain/cleanup';
import { confirmPhone, triggerScanAction } from '../src/features/scan-action';
import { attemptAutoLookup, autoLookupFailureAt, autoLookupInFlight, clearAutoLookupQueueRetries, lookupFastCache } from '../src/features/auto-lookup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { applyBarcodeCloseChange, removeSingleBarcode } from '../src/features/barcode-ops';
import { deleteSingleItem } from '../src/features/entry-ops';
import { activeRestoreClaims, executeRestoreItem, restoreInFlight } from '../src/features/restore';
import { autoCloseBarcodeFromZto, clearZtoPickupStatusStore, setZtoPickupVerdict } from '../src/features/zto-status';
import { resetZtoFinalMarks, syncZtoFinalMarks } from '../src/features/zto-final-marks';
import { persistPalmSignJob, runPalmSignOutbox } from '../src/features/palm-sign-outbox';
import { recordSigned } from '../src/services/palm-sign-transport';
import { openSignJob } from '../src/services/palm-sign-outbox-store';
import { encryptLookupSecret } from '../src/services/crypto';
import { noteZtoTrashMode, resetZtoTrashMode } from '../src/services/zto-trash-mode';
import { closeModal, openModalHelper } from '../src/ui/modal';

// មុខងារ app ពិតទាំងអស់; ជំនួសតែ SDK, HTTP និង disk។ Rules/DB ពិតវាស់ក្នុង money-multidevice។
const disk = vi.hoisted(() => ({ rows: new Map<string, any>() }));
vi.mock('../src/services/palm-sign-outbox-store', async (original) => ({ ...await original<any>(),
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
const ref = (path = '') => ({ path, key: parts(path).at(-1) || null, toString: () => HOST + '/' + path });
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
            const prior = getAt(r.path); const next = change(clone(prior));
            const fail = next !== undefined && lab.failNext.delete(r.path);
            lab.tx.push({ path: r.path, proposed: clone(next), failed: fail });
            if (fail) { lab.failed.add(r.path); throw Object.assign(new Error('disconnect'), { code: 'disconnect', txOutcome: 'not-applied' }); }
            if (next === undefined) return { committed: false, snapshot: snapshot(r, prior) };
            setAt(r.path, next); return { committed: true, snapshot: snapshot(r, getAt(r.path)) };
        }, onValue: () => () => {}, off: () => {}
    };
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
    const cfg: any = { enabled: true, fastMode: true, autoSubmit: false, phoneField: 'phone', codField: 'cod', dodField: 'dod', shop: HOST,
        url: mode === 'sheet' ? 'https://script.google.com/macros/s/AKfy/exec?code={barcode}&key=k'
            : window.location.origin + '/.netlify/functions/zto-order-detail?' + (mode === 'palm' ? 'palm=1&' : '') + 'barcode={barcode}' };
    if (mode !== 'sheet') Object.assign(cfg, { headerName: 'X-Zoe-Proxy-Key', headerValue: 'synthetic-key' });
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
    lab.store = {}; lab.failed.clear(); lab.failNext.clear(); lab.tx = []; lab.rootAckLost = false; lab.rootAckLostCount = 0; lab.historyGate = null;
    disk.rows.clear(); appLocalStore.clear(); clearCustomerDataTableCache(); resetZtoFinalMarks(); clearZtoPickupStatusStore();
    autoLookupFailureAt.clear(); autoLookupInFlight.clear(); lookupFastCache.clear(); clearAutoLookupQueueRetries();
    activeRestoreClaims.clear(); restoreInFlight.clear(); cleanupInFlight.clear(); cleanupJournalLive.clear();
    dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    firebaseState.authGeneration++; firebaseState.db = { name: 'matrix-db' }; firebaseState.fb = sdk() as any;
    firebaseState.auth = { currentUser: { uid: 'money-user', getIdToken: async () => 'synthetic-id' } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true; firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0;
    firebaseState.dbRefHistory = ref(H); firebaseState.dbRefDeleted = ref(T); firebaseState.dbRefDailyRevenue = ref(D); firebaseState.dbRefMonthlyRevenue = ref(M);
    firebaseState.dbRefDailyPickup = ref(P); firebaseState.dbRefDailyCollected = ref(C);
    firebaseState.dbLivenessProbe = Promise.resolve(null);
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
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

    it.each(['cached', 'unverified', 'offline'] as const)('Cookie %s៖ ស្តារហាម មិនបូកប្រាក់; ភស្តុតាងថ្មីអនុញ្ញាតស្តារតែម្តង', async (kind) => {
        await useMode('cookie'); const id = await scan(); await removeSingleBarcode(id, CODE); sync(); expectMoney(0, 0, 0);
        const removed = trashId(); const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(kind !== 'offline');
        const fresh = { success: true, found: true, barcode: CODE, cached: false, verifiedForRestore: true, ztoClosed: false };
        network = async () => json({ ...fresh, ...(kind === 'cached' ? { cached: true } : { verifiedForRestore: false }) });
        await restore(removed); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        expect(getAt(T + '/' + removed + '/restoreClaim')).toBeNull(); expect(getAt('zoew_restore_finalizations')).toBeNull();
        online.mockReturnValue(true); network = async () => json(fresh);
        await restore(removed); expectMoney(10, 2, 1); expectIdentities([CODE], []);
    });

    it.each(['sheet', 'cookie'] as const)('%s៖ ដក→ស្តារ→លុប→ស្តារ និងធ្វើស្ទួនគ្រប់ជំហាន', async (mode) => {
        await useMode(mode); let id = await scan(); expectMoney(10, 2, 1);
        await Promise.all([removeSingleBarcode(id, CODE), removeSingleBarcode(id, CODE)]); sync();
        expectMoney(0, 0, 0); expectIdentities([], [CODE]); const removed = trashId();
        expect(dataState.deletedItems[0].barcodes[0].isDeducted).toBe(true);
        await restore(removed); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        await restore(removed); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        id = currentItem().id;
        await Promise.all([deleteSingleItem(id), deleteSingleItem(id)]); sync();
        expectMoney(10, 2, 1); expectIdentities([], [CODE]); const deleted = trashId();
        expect(dataState.deletedItems[0].barcodes[0].isDeducted).toBe(false);
        await restore(deleted); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        await restore(deleted); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        const verification = requests.filter((request) => request.url.searchParams.get('restore') === '1');
        expect(verification).toHaveLength(mode === 'cookie' ? 2 : 0);
    });

    it.each(['palm', 'cookie-signed'] as const)('%s៖ ដក→ស្តារហាម→លុបគ្មានធាតុ→ស្តារហាម មិនបូកប្រាក់', async (mode) => {
        await useMode(mode === 'palm' ? 'palm' : 'cookie'); const id = await scan();
        if (mode === 'cookie-signed') { await recordSigned(id, CODE, () => true); await syncZtoFinalMarks(); sync(); }
        await removeSingleBarcode(id, CODE); sync(); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        const removed = trashId();
        if (mode === 'palm') expect(dataState.deletedItems[0].restoreBlocked).toBe(true);
        else expect(Number(dataState.deletedItems[0].barcodes[0].ztoSignedAt)).toBeGreaterThan(0);
        await restore(removed); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        expect(getAt(T + '/' + removed + '/restoreClaim')).toBeNull(); expect(getAt('zoew_restore_finalizations')).toBeNull();
        expect(await deleteSingleItem(id)).toBe('missing'); expectMoney(0, 0, 0);
        await restore(removed); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        await useMode('sheet'); await restore(removed); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
    });

    it.each(['palm', 'cookie-signed'] as const)('%s៖ លុបរក្សាប្រាក់ ហើយស្តារហាមមិនបូកបន្ថែម', async (mode) => {
        await useMode(mode === 'palm' ? 'palm' : 'cookie'); const id = await scan();
        if (mode === 'cookie-signed') { await recordSigned(id, CODE, () => true); await syncZtoFinalMarks(); sync(); }
        await deleteSingleItem(id); sync(); expectMoney(10, 2, 1); expectIdentities([], [CODE]);
        const deleted = trashId(); await restore(deleted); expectMoney(10, 2, 1); expectIdentities([], [CODE]);
        await useMode('sheet'); await restore(deleted); expectMoney(10, 2, 1); expectIdentities([], [CODE]);
    });

    it.each(modes)('%s៖ ដាច់មុន commit ledger បូក/ដក → retry រក្សា op ដដែល និងចូលតែម្តង', async (mode) => {
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

    it.each(['sheet', 'cookie'] as const)('%s៖ ស្តារបាន commit តែ ACK ដាច់ → មិនបូកពីរដង', async (mode) => {
        await useMode(mode); const id = await scan(); await removeSingleBarcode(id, CODE); sync(); expectMoney(0, 0, 0);
        const removed = trashId(); lab.rootAckLost = true;
        await restore(removed); expect(lab.rootAckLostCount).toBe(1); expectMoney(10, 2, 1); expectIdentities([CODE], []);
        await restore(removed); expectMoney(10, 2, 1); expectIdentities([CODE], []);
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
        await vi.waitFor(() => expect(disk.rows.size).toBe(0));
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
        await vi.waitFor(() => expect(disk.rows.size).toBe(0)); await closedTotals(); expectMoney(10, 2, 1);
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
        await vi.waitFor(() => expect(disk.rows.size).toBe(0)); await closedTotals(); expectMoney(10, 2, 1);
        expect(requests.map(row => row.body.stage)).toEqual(['receipt-status', 'receipt', 'receipt']);
        expect(requests[2].body).toEqual({ ...requests[1].body, confirmationToken: 'same-parcel-confirm' });
        await runPalmSignOutbox(); expect(requests).toHaveLength(3); expectMoney(10, 2, 1);
    });
    it('ACK មកក្រោយដកកញ្ចប់ → គ្មានការបិទ/បូកប្រាក់ឡើងវិញ ហើយស្តារនៅតែហាម', async () => {
        await useMode('palm'); const id = await scan(); const online = await queued(id); const ack = gate<void>();
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
        expectMoney(0, 0, 0); expect(getAt(P)).toBeNull(); expect(getAt(C)).toBeNull();
        await restore(trashId()); expectMoney(0, 0, 0); expectIdentities([], [CODE]);
        expect(requests.filter((row) => row.body?.stage === 'receipt')).toHaveLength(1);
        expect(requests.filter((row) => row.body?.stage === 'receipt-status')).toHaveLength(1);
        expect(requests.map(row => row.body.stage)).toEqual(['receipt-status', 'receipt']);
        expect(await openSignJob([...disk.rows.values()][0], key)).toMatchObject({ photo, requestId });
    });
});
