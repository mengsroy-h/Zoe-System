/**
 * ស្កេន Lookup ទល់នឹងទាញបញ្ជី ZTO៖ ច្រកស្កេន, lookup, protocol រក្សាទុក,
 * preview/import, sweep, close/pickup, final marks, cleanup, restore និង purge ជា App ពិត។
 * HTTP និង SDK ជា simulator; ជម្រើស backend វាស់ផ្លូវ App មិនមែន Firebase rules/emulator
 * ឬ Supabase RPC/RLS ទេ។ គ្មានការវាស់ browser, camera ឬ ZTO ផ្ទាល់។
 */
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupServerRead } from './helpers/cleanup-server-read';
import { fieldValue, refTo } from '../../../../ZoeW/src/app/refs';
import { dataState, firebaseState, lookupState, scanState, securityState, uiState, ztoState } from '../../../../ZoeW/src/core/state';
import { shopScope } from '../../../../ZoeW/src/core/shop-scope';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { registerModalMeta, unregisterModalMeta } from '../../../../ZoeW/src/core/modals';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { getZoneDateKey } from '../../../../ZoeW/src/core/timezone';
import * as clock from '../../../../ZoeW/src/core/clock';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, runAutomaticDeletedCleanup, trashRetentionMs } from '../../../../ZoeW/src/domain/cleanup';
import { confirmPhone, triggerScanAction } from '../../../../ZoeW/src/features/scan-action';
import { autoLookupFailureAt, autoLookupInFlight, clearAutoLookupQueueRetries, lookupFastCache } from '../../../../ZoeW/src/features/auto-lookup';
import { clearCustomerDataTableCache } from '../../../../ZoeW/src/features/customer-table';
import { applyBarcodeCloseChange, removeSingleBarcode } from '../../../../ZoeW/src/features/barcode-ops';
import { activeRestoreClaims, executeRestoreItem, restoreInFlight } from '../../../../ZoeW/src/features/restore';
import { clearZtoPickupStatusStore, runZtoStatusSweep } from '../../../../ZoeW/src/features/zto-status';
import { resetZtoFinalMarks, syncZtoFinalMarks } from '../../../../ZoeW/src/features/zto-final-marks';
import { importZtoListRows, runZtoListSyncPreview } from '../../../../ZoeW/src/features/zto-list-sync';
import { encryptLookupSecret } from '../../../../ZoeW/src/services/crypto';
import { noteZtoTrashMode, resetZtoTrashMode } from '../../../../ZoeW/src/services/zto-trash-mode';
import { closeModal } from '../../../../ZoeW/src/ui/modal';
import { buildMonthlyReport, monthlyReportRows } from '../../../../ZoeW/src/features/monthly-report';
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
const modes = ['cookie', 'palm'] as const;
type Mode = typeof modes[number];
const fields = ['modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput'] as const;
const lab = {
    backend: 'firebase' as 'firebase' | 'supabase',
    store: {} as Record<string, any>
};
let network: (url: URL, body: any) => Promise<Response>;
let requests: { url: URL; body: any }[];
const clone = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const parts = (path: string) => path.split('/').filter(Boolean);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
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
            for (const [child, update] of Object.entries(updates)) {
                const path = [r.path, child].filter(Boolean).join('/');
                const value: any = update;
                setAt(path, value?.__increment !== undefined ? (Number(getAt(path)) || 0) + value.__increment : value);
            }
        },
        runTransaction: async (r: any, change: (value: any) => any) => {
            const prior = getAt(r.path); const next = change(clone(prior));
            if (next === undefined) return { committed: false, snapshot: snapshot(r, prior) };
            setAt(r.path, next); return { committed: true, snapshot: snapshot(r, getAt(r.path)) };
        }, onValue: () => () => {}, off: () => {}
    };
}
async function waitFor(check: () => void) {
    let failure: unknown;
    for (let attempt = 0; attempt < 100; attempt++) {
        try { check(); return; } catch (error) { failure = error; }
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw failure;
}
const HOUR = 3600000, DAY = 86400000, ARRIVAL = NOW - 2 * DAY;
const ztoStamp = (ms: number) => new Date(ms + 7 * HOUR).toISOString().replace('T', ' ').slice(0, 19);
const dayOf = (ms: number) => getZoneDateKey(ms, 0);
const matrix = (['firebase', 'supabase'] as const).flatMap(backend => modes.map(mode => ({ backend, mode })));
function sync() {
    dataState.scanHistory = Object.values(getAt(H) || {}); dataState.deletedItems = Object.values(getAt(T) || {});
    dataState.dailyRevenueData = getAt(D) || {}; dataState.monthlyRevenueData = getAt(M) || {};
    dataState.dailyPickupData = getAt(P) || {}; dataState.dailyCollectedData = getAt(C) || {};
}
function currentItem(code: string) { return dataState.scanHistory.find(item => item.barcodes?.some(b => b.code === code))!; }
function bar(code: string) { return currentItem(code)?.barcodes.find(b => b.code === code); }
function codes(root: string) { return (Object.values(getAt(root) || {}) as any[]).flatMap(item => item.barcodes.map((b: any) => b.code)).sort(); }
function expectMoney(count: number) {
    const rows = Object.values(getAt(D) || {}) as any[];
    expect(rows.reduce((n, r) => n + r.totalCount, 0)).toBe(count);
    expect(rows.reduce((n, r) => n + r.codDollar, 0)).toBe(count * 10);
    expect(rows.reduce((n, r) => n + r.dodDollar, 0)).toBe(count * 2);
    expect(getAt(M + '/' + dayOf(NOW).slice(0, 7))).toMatchObject({ totalCount: count, codDollar: count * 10, dodDollar: count * 2 });
}
function establishTime(at: number) {
    vi.setSystemTime(at);
    // ជម្រើសនេះអនុញ្ញាតឱ្យ fixture ដដែលវាស់លើ cf1a564a មុនមាន clock API ថ្មី។
    (clock as any).resetServerClock?.();
    (clock as any).acceptServerClockOffset?.(0, { epochMs: at, wallMs: Date.now(), monotonicMs: performance.now() }, false);
    firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0; firebaseState.sessionExpiryCheck = 'live';
}
async function configure(backend: 'firebase' | 'supabase', mode: Mode) {
    lab.backend = backend;
    const options = backend === 'firebase' ? { databaseURL: HOST } : { supabaseUrl: 'https://synthetic.supabase.co', supabaseKey: 'sb_publishable_synthetic' };
    firebaseState.firebaseConfig = options as any;
    (firebaseState.db as any).app = { options }; (firebaseState.auth as any).app = { options };
    if (backend === 'supabase') (firebaseState.fb as any).tenantScope = () => 'synthetic-shop';
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(options));
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, autoSubmit: false,
        phoneField: 'phone', codField: 'cod', dodField: 'dod', shop: shopScope(),
        url: window.location.origin + '/.netlify/functions/zto-order-detail?' + (mode === 'palm' ? 'palm=1&' : '') + 'barcode={barcode}',
        headerName: 'X-Zoe-Proxy-Key', headerValueEnc: await encryptLookupSecret('synthetic-key'),
        ...(mode === 'palm' ? { palmTokenEnc: await encryptLookupSecret('synthetic-session') } : {}) }));
    resetZtoTrashMode(); noteZtoTrashMode(null); establishTime(NOW);
}
async function scanned(extra: any = {}) {
    network = async url => json({ success: true, found: true, barcode: url.searchParams.get('barcode'),
        phone: '012345678', cod: 10, dod: 2, at: ztoStamp(ARRIVAL), ztoClosed: false, ...extra });
    triggerScanAction(CODE);
    await waitFor(() => expect(fieldValue('modalPhoneInput')).toBe('012345678'));
    expect(Number(fieldValue('modalCodInput'))).toBe(10);
    expect(Number(fieldValue('modalDodInput'))).toBe(2);
    await Promise.all([confirmPhone(), confirmPhone()]);
    await waitFor(() => expect(codes(H)).toContain(CODE)); sync(); closeModal('phoneModal');
    expect(bar(CODE)).toMatchObject({ createdAt: NOW, isClosed: false });
    expect(currentItem(CODE)).toMatchObject({ createdAt: NOW, scanDate: dayOf(NOW) });
    expect(requests.some(r => r.url.searchParams.get('barcode') === CODE && !r.url.searchParams.has('status'))).toBe(true);
}
async function imported(signedAt = 0) {
    const signed = signedAt ? [SECOND] : [];
    network = async url => {
        if (url.searchParams.get('candidates') === '1') return json({ success: true, list: true, enabled: true, kind: 'candidates', page: 1, pages: 1,
            tabPages: { '3': 1 }, rows: [], candidates: [{ barcode: SECOND, phone: '012345678', cod: 10, dod: 2 }], otherScans: 0 });
        if (url.searchParams.has('tracks')) return json({ success: true, list: true, enabled: true, kind: 'tracks', rows: [],
            evidence: [{ barcode: SECOND, arrivals: [ztoStamp(ARRIVAL)], ztoClosed: !!signedAt, signedAt: signedAt ? ztoStamp(signedAt) : '' }] });
        if (['returned', 'sent', 'problem'].some(k => url.searchParams.get(k) === '1')) return json({ success: true, list: true, enabled: true, rows: [], pages: 1,
            returned: [], returnedOk: true, sent: [], sentOk: true, problem: [], problemOk: true });
        return json({ success: true, list: true, enabled: true, pages: 1, total: 1, palm: url.searchParams.get('palm') === '1',
            rows: [{ barcode: SECOND, phone: '012345678', cod: 10, dod: 2, at: ztoStamp(ARRIVAL), ztoClosed: signedAt ? true : false, skip: '' }],
            signed, signedRows: signedAt ? [{ barcode: SECOND, at: ztoStamp(signedAt) }] : [], signedOk: true, signedPages: 1 });
    };
    await runZtoListSyncPreview(); expect(ztoState.ztoListSyncResult?.rows).toHaveLength(1);
    await importZtoListRows(); await waitFor(() => expect(codes(H)).toContain(SECOND)); sync();
    expect(bar(SECOND)?.createdAt).toBe(ARRIVAL); expect(currentItem(SECOND)?.scanDate).toBe(dayOf(ARRIVAL));
}
function upstream(signedAt = 0, returnedAt = 0, listSigned = false) {
    network = async url => {
        if (url.searchParams.get('list') === '1') return json({ success: true, list: true, enabled: true, pages: 1, total: 0, rows: [],
            signed: listSigned && signedAt ? [CODE, SECOND] : [],
            signedRows: listSigned && signedAt ? [CODE, SECOND].map(barcode => ({ barcode, at: ztoStamp(signedAt) })) : [], signedOk: true, signedPages: 1,
            returned: [], returnedOk: true, sent: [], sentOk: true, problem: [], problemOk: true });
        return json({ success: true, found: true, barcode: url.searchParams.get('barcode'), cached: false, verifiedForRestore: true,
            phone: '012345678', cod: 10, dod: 2, ztoClosed: !!signedAt,
            ...(signedAt ? { ztoSignedAt: ztoStamp(signedAt) } : {}), ...(returnedAt ? { ztoReturnedAt: ztoStamp(returnedAt) } : {}) });
    };
}
async function sweep() {
    await runZtoStatusSweep(true); await syncZtoFinalMarks();
    await waitFor(() => expect(cleanupInFlight.size).toBe(0)); sync();
}
async function restore(id: string) { uiState.pendingRestoreId = id; await executeRestoreItem(); sync(); }
async function expectPickup() {
    await waitFor(() => expect((Object.values(getAt(P) || {}) as any[]).reduce((n, r) => n + r.packagesPickedUp, 0)).toBe(2));
    expect((Object.values(getAt(P) || {}) as any[]).flatMap(r => Object.keys(r.pickedUpBarcodes || {})).sort()).toEqual([CODE, SECOND]);
    const collected = (Object.values(getAt(C) || {}) as Record<string, { c: number; d: number }>[]).flatMap(r => Object.entries(r));
    expect(collected.map(([code]) => code).sort()).toEqual([CODE, SECOND]);
    expect(collected.reduce((n, [, r]) => n + r.c, 0)).toBe(20);
}
beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.spyOn(performance, 'now').mockReturnValue(1000);
    vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', vi.fn());
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    lab.backend = 'firebase'; lab.store = {};
    appLocalStore.clear(); clearCustomerDataTableCache(); resetZtoFinalMarks(); clearZtoPickupStatusStore();
    autoLookupFailureAt.clear(); autoLookupInFlight.clear(); lookupFastCache.clear(); clearAutoLookupQueueRetries();
    activeRestoreClaims.clear(); restoreInFlight.clear(); cleanupInFlight.clear(); cleanupJournalLive.clear();
    dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    firebaseState.authGeneration++; firebaseState.db = { name: 'lookup-compare-db' }; firebaseState.fb = sdk() as any;
    firebaseState.auth = { currentUser: { uid: 'money-user', getIdToken: async () => 'synthetic-id' } } as any;
    firebaseState.isInitializingFirebase = false; firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true; firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.dbRefHistory = ref(H); firebaseState.dbRefDeleted = ref(T); firebaseState.dbRefDailyRevenue = ref(D); firebaseState.dbRefMonthlyRevenue = ref(M);
    firebaseState.dbRefDailyPickup = ref(P); firebaseState.dbRefDailyCollected = ref(C);
    firebaseState.dbLivenessProbe = Promise.resolve(null);
    securityState.lookupSecretKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as any;
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    uiState.toasts = []; uiState.isModalOpen = false; uiState.entryScanMode = 'normal'; viewState.phoneModalBusy = false;
    scanState.pendingBarcode = null; dataState.deletedCleanupInFlight = false;
    ztoState.ztoStatusInFlight = false; ztoState.ztoListSyncInFlight = false; ztoState.ztoListSyncResult = null;
    lookupState.customerDataTableSessionGeneration++; sync();
    for (const field of fields) refTo(field)(document.createElement('input'));
    for (const field of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) { const el = document.createElement('input'); el.value = dayOf(field.endsWith('From') ? ARRIVAL : NOW); refTo(field)(el); }
    registerModalMeta('phoneModal', {}); appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    requests = []; network = async () => json({ success: false });
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        const parsed = new URL(String(url), window.location.href), body = init?.body ? JSON.parse(String(init.body)) : null;
        if (parsed.origin === HOST) return cleanupServerRead(getAt)(parsed, init);
        requests.push({ url: parsed, body }); return network(parsed, body);
    }));
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => {
    resetZtoFinalMarks(); clearZtoPickupStatusStore(); clearAutoLookupQueueRetries(); clearCustomerDataTableCache();
    firebaseState.authGeneration++; securityState.lookupSecretKey = null; closeModal('phoneModal'); unregisterModalMeta('phoneModal');
    for (const field of [...fields, 'ztoListSyncFrom', 'ztoListSyncTo'] as const) refTo(field)(null);
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as any).ZoeErrors;
});

describe.each(matrix)('$backend $mode៖ ស្កេន Lookup ទល់នឹងទាញបញ្ជី ZTO', ({ backend, mode }) => {
    it('ចន្លោះអាយុ២ម៉ោងទុក history ហើយផ្ទេរក្រោយផ្ទៀងដោយរក្សា timestamp ជាក់លាក់', async () => {
        await configure(backend, mode); await scanned(); await imported();
        establishTime(NOW + HOUR); upstream(NOW + HOUR); await sweep(); sync();
        const at = NOW + 3 * HOUR;
        establishTime(at);
        expect(clock.acceptServerClockOffset(0, Object.freeze({ epochMs: at - 1000, estimateEpochMs: at,
            uncertaintyMs: 2000, wallMs: Date.now(), monotonicMs: performance.now() }), false)).toBe(true);
        firebaseState.sessionExpiryCheck = 'live';
        for (const item of [...dataState.scanHistory]) await claimAndCleanupItem(item.id, 'close'); sync();
        expect(codes(H)).toEqual([CODE, SECOND]); expect(codes(T)).toEqual([]); expectMoney(2);
        establishTime(at + 1000);
        for (const item of [...dataState.scanHistory]) await claimAndCleanupItem(item.id, 'close'); sync();
        expect(codes(H)).toEqual([]); expect(codes(T)).toEqual([CODE, SECOND]); expectMoney(2);
        for (const item of dataState.deletedItems) expect(item.deletedAt).toBe(at + 1000);
    });
    it('រក្សាពេលមកដល់រៀងខ្លួន · Sign ក្រោយបិទតែម្តង · ហាមបើក/ស្តារ · pickup ទុក៣០ថ្ងៃ', async () => {
        await configure(backend, mode); await scanned(); await imported(); expectMoney(2);
        expect(getAt(D + '/' + dayOf(NOW))).toMatchObject({ totalCount: 1 });
        expect(getAt(D + '/' + dayOf(ARRIVAL))).toMatchObject({ totalCount: 1 });
        establishTime(NOW + HOUR); upstream(NOW + HOUR); await sweep(); await sweep();
        for (const code of [CODE, SECOND]) expect(bar(code)).toMatchObject({ isClosed: true, closedAt: NOW + HOUR, ztoSignedAt: NOW + HOUR, ztoSignedExact: true });
        expectMoney(2); await expectPickup();
        for (const code of [CODE, SECOND]) expect(await applyBarcodeCloseChange(currentItem(code).id, code, false, { silent: true })).toBe(false);
        establishTime(NOW + 3 * HOUR - 1);
        for (const item of [...dataState.scanHistory]) await claimAndCleanupItem(item.id, 'close'); sync(); expect(codes(H)).toEqual([CODE, SECOND]);
        establishTime(NOW + 3 * HOUR);
        for (const item of [...dataState.scanHistory]) await claimAndCleanupItem(item.id, 'close'); sync();
        expect(codes(H)).toEqual([]); expect(codes(T)).toEqual([CODE, SECOND]); expectMoney(2);
        for (const item of dataState.deletedItems) {
            expect(item).toMatchObject({ trashReason: 'pickup', trashMode: mode, restoreBlocked: true, isFromDeletion: true });
            expect(item.barcodes[0].isDeducted).toBe(false); expect(trashRetentionMs(item)).toBe(30 * DAY);
            await restore(item.id);
        }
        expect(codes(T)).toEqual([CODE, SECOND]); expectMoney(2); await expectPickup();
        establishTime(NOW + 3 * HOUR + 30 * DAY); await runAutomaticDeletedCleanup(); sync(); expect(codes(T)).toEqual([CODE, SECOND]);
        establishTime(NOW + 3 * HOUR + 30 * DAY + 1); await runAutomaticDeletedCleanup(); sync(); expect(codes(T)).toEqual([]); expectMoney(2);
    });
    it('ត្រឡប់ក្រោយដកកញ្ចប់និងប្រាក់តែម្តង · ហាមស្តារ · returned ទុក២ថ្ងៃ', async () => {
        await configure(backend, mode); await scanned(); await imported(); expectMoney(2);
        establishTime(NOW + HOUR); upstream(0, NOW + HOUR); await sweep(); await sweep();
        expect(codes(H)).toEqual([]); expect(codes(T)).toEqual([CODE, SECOND]); expectMoney(0);
        expect(getAt(P)).toBeNull(); expect(getAt(C)).toBeNull();
        for (const item of dataState.deletedItems) {
            expect(item).toMatchObject({ trashReason: 'returned', trashMode: mode, isFromDeletion: false });
            expect(item.barcodes[0]).toMatchObject({ isClosed: false, isDeducted: true, ztoReturnedAt: NOW + HOUR });
            expect(trashRetentionMs(item)).toBe(2 * DAY); await restore(item.id);
        }
        expectMoney(0); expect(codes(T)).toEqual([CODE, SECOND]);
        establishTime(NOW + HOUR + 2 * DAY); await runAutomaticDeletedCleanup(); sync(); expect(codes(T)).toEqual([CODE, SECOND]);
        establishTime(NOW + HOUR + 2 * DAY + 1); await runAutomaticDeletedCleanup(); sync(); expect(codes(T)).toEqual([]); expectMoney(0);
    });
    it('ត្រឡប់មុនស្កេន ZoeW ចាស់សម្រាប់វដ្តស្កេន តែថ្មីសម្រាប់វដ្តទាញបញ្ជី', async () => {
        await configure(backend, mode); await scanned({ ztoReturnedAt: ztoStamp(NOW - HOUR) }); await imported();
        establishTime(NOW + HOUR); upstream(0, NOW - HOUR); await sweep();
        expect(codes(H)).toEqual([CODE]); expect(codes(T)).toEqual([SECOND]); expectMoney(1);
        expect(bar(CODE)).toMatchObject({ isClosed: false, createdAt: NOW }); expect(bar(CODE)?.ztoReturnedAt).toBeUndefined();
    });
    it('ស្កេនកញ្ចប់ Sign រួចនៅបើករហូត sweep · ទាញបញ្ជីបិទតាំងពីចូល · មិនរាប់ស្ទួន', async () => {
        await configure(backend, mode); await scanned({ ztoClosed: true, ztoSignedAt: ztoStamp(NOW - HOUR) });
        expect(bar(CODE)?.ztoSignedAt).toBeUndefined(); expect(getAt(P)).toBeNull();
        await imported(NOW - HOUR); expect(bar(SECOND)?.isClosed).toBe(true); expectMoney(2);
        establishTime(NOW + HOUR); upstream(NOW - HOUR, 0, true); await sweep(); await sweep();
        for (const code of [CODE, SECOND]) expect(bar(code)).toMatchObject({ isClosed: true, ztoSignedAt: NOW - HOUR, ztoSignedExact: true });
        expectMoney(2); await expectPickup();
    });
});

it.each(matrix)('$backend $mode៖ បិទកុងតាក់ auto-close ទុកប្រភពទាំងពីរបើក ទោះ Sign/ត្រឡប់ក្រោយ', async ({ backend, mode }) => {
    await configure(backend, mode); await scanned(); await imported();
    appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
    establishTime(NOW + HOUR); upstream(NOW + HOUR, NOW + HOUR, true); await sweep();
    expect(codes(H)).toEqual([CODE, SECOND]); expect(codes(T)).toEqual([]); expectMoney(2);
    for (const code of [CODE, SECOND]) expect(bar(code)?.isClosed).toBe(false);
    expect(getAt(P)).toBeNull(); expect(getAt(C)).toBeNull();
});

it.each(['firebase', 'supabase'] as const)('%s Cookie៖ ដក/ស្តាររក្សាពេលកំណើតទាំងពីរ តែបដិសេធ Sign-list/ត្រឡប់មុនពេលស្តារ', async backend => {
    await configure(backend, 'cookie'); await scanned(); await imported();
    for (const code of [CODE, SECOND]) { await removeSingleBarcode(currentItem(code).id, code); sync(); }
    expectMoney(0); expect(codes(H)).toEqual([]); expect(codes(T)).toEqual([CODE, SECOND]);
    establishTime(NOW + HOUR); upstream();
    for (const item of [...dataState.deletedItems]) { await restore(item.id); await restore(item.id); }
    expectMoney(2); expect(codes(H)).toEqual([CODE, SECOND]); expect(codes(T)).toEqual([]);
    expect(bar(CODE)).toMatchObject({ createdAt: NOW, restoredAt: NOW + HOUR, isClosed: false });
    expect(bar(SECOND)).toMatchObject({ createdAt: ARRIVAL, restoredAt: NOW + HOUR, isClosed: false });
    establishTime(NOW + 2 * HOUR); upstream(NOW + HOUR / 2, NOW + HOUR / 2, true);
    const route = network;
    network = async (url, body) => {
        if (url.searchParams.get('status') === '1') return json({ success: true, found: true, barcode: url.searchParams.get('barcode'),
            ztoClosed: false, ztoReturnedAt: ztoStamp(NOW + HOUR / 2) });
        return route(url, body);
    };
    await sweep();
    expectMoney(2); expect(codes(H)).toEqual([CODE, SECOND]); expect(codes(T)).toEqual([]);
    for (const code of [CODE, SECOND]) {
        expect(bar(code)?.isClosed).toBe(false); expect(bar(code)?.ztoSignedAt).toBeUndefined(); expect(bar(code)?.ztoReturnedAt).toBeUndefined();
    }
    establishTime(NOW + 3 * HOUR); upstream(0, NOW + 3 * HOUR); await sweep(); await sweep();
    expectMoney(0); expect(codes(H)).toEqual([]); expect(codes(T)).toEqual([CODE, SECOND]);
});

it.each(matrix)('$backend $mode៖ បិទដោយដៃទាំងពីរ · Cookie រាប់ពី close · Palm រាប់ពី Sign សម្រាប់ cleanup', async ({ backend, mode }) => {
    await configure(backend, mode); await scanned(); await imported();
    for (const code of [CODE, SECOND]) expect(await applyBarcodeCloseChange(currentItem(code).id, code, true, { silent: true, showModal: false })).toBe(true);
    sync(); await expectPickup(); expectMoney(2);
    establishTime(NOW + 3 * HOUR); upstream(); await sweep();
    for (const item of [...dataState.scanHistory]) await claimAndCleanupItem(item.id, 'close'); sync();
    expect(codes(H)).toEqual(mode === 'palm' ? [CODE, SECOND] : []);
    expect(codes(T)).toEqual(mode === 'cookie' ? [CODE, SECOND] : []);
    upstream(NOW + 3 * HOUR); await sweep(); await sweep(); expectMoney(2); await expectPickup();
    establishTime(NOW + 5 * HOUR - 1);
    for (const item of [...dataState.scanHistory]) await claimAndCleanupItem(item.id, 'close'); sync();
    expect(codes(H)).toEqual(mode === 'palm' ? [CODE, SECOND] : []);
    establishTime(NOW + 5 * HOUR);
    for (const item of [...dataState.scanHistory]) await claimAndCleanupItem(item.id, 'close'); sync();
    expect(codes(H)).toEqual([]); expect(codes(T)).toEqual([CODE, SECOND]); expectMoney(2); await expectPickup();
});

it.each((['firebase', 'supabase'] as const).flatMap(backend => [
    { edge: Date.UTC(2026, 10, 30, 17), before: '2026-11-30', after: '2026-12-01' },
    { edge: Date.UTC(2026, 11, 31, 17), before: '2026-12-31', after: '2027-01-01' },
    { edge: Date.UTC(2028, 1, 28, 17), before: '2028-02-28', after: '2028-02-29' }
].map(boundary => ({ backend, ...boundary }))))('$backend៖ ប្រតិទិនស្កេន $before ទៅ $after រក្សាក្រុមថ្ងៃ និង ledger', async ({ backend, edge, before, after }) => {
    await configure(backend, 'cookie');
    network = async url => json({ success: true, found: true, barcode: url.searchParams.get('barcode'),
        phone: '012345678', cod: 10, dod: 2, ztoClosed: false });
    for (const [code, at, expectedDay] of [[CODE, edge - 1, before], [SECOND, edge, after]] as const) {
        establishTime(at);
        triggerScanAction(code);
        await waitFor(() => expect(fieldValue('modalPhoneInput')).toBe('012345678'));
        await confirmPhone();
        await waitFor(() => expect(codes(H)).toContain(code)); sync(); closeModal('phoneModal');
        expect(currentItem(code)).toMatchObject({ scanDate: expectedDay, createdAt: at });
        expect(bar(code).createdAt).toBe(at);
        expect(getAt(D + '/' + expectedDay)).toMatchObject({ totalCount: 1, codDollar: 10, dodDollar: 2 });
    }
    expect(dataState.scanHistory).toHaveLength(2);
    expect(currentItem(CODE).time).toBe('23:59:59 (' + before + ')');
    expect(currentItem(SECOND).time).toBe('00:00:00 (' + after + ')');
    const months = [...new Set([before.slice(0, 7), after.slice(0, 7)])];
    for (const month of months) {
        const count = months.length === 1 ? 2 : 1;
        expect(getAt(M + '/' + month)).toMatchObject({ totalCount: count, codDollar: count * 10, dodDollar: count * 2 });
        const report = buildMonthlyReport(month);
        const expectedDays = [before, after].filter(day => day.startsWith(month));
        expect(report.days.map(day => day.date)).toEqual(expectedDays);
        expect(report.totals).toMatchObject({ count, total: count * 12, pendingTotal: count * 12, collectedTotal: 0 });
        expect(report.mismatch).toBe(false);
        expect(monthlyReportRows(report).slice(0, -1).map(row => row[0])).toEqual(expectedDays);
    }
});

it.each(matrix.flatMap(variant => ['', null, 'abc', '2026-02-31 09:00:00', '2026-04-31 09:00:00'].map(at => ({ ...variant, at }))))('$backend $mode៖ ត្រាខ្វះឬខូច $at ប្រើម៉ោងបញ្ចូលក្រោយព្រមាន', async ({ backend, mode, at }) => {
    await configure(backend, mode);
    const confirms = vi.fn((_question: string) => true); vi.stubGlobal('confirm', confirms);
    ztoState.ztoListSyncResult = { rows: [{ barcode: CODE, phone: '012345678', cod: 10, dod: 2, at, ztoClosed: false }],
        signedRows: [], from: dayOf(NOW), to: dayOf(NOW), verifiedAt: NOW, verifiedServerAt: NOW, palm: mode === 'palm' } as any;
    await importZtoListRows();
    await waitFor(() => expect(codes(H)).toContain(CODE)); sync();
    expect(confirms).toHaveBeenCalledTimes(1);
    expect(confirms.mock.calls[0][0]).toContain('កញ្ចប់គ្មានម៉ោងស្កេនពី ZTO ➜ ប្រើម៉ោងបញ្ចូលជំនួស');
    expect(currentItem(CODE)).toMatchObject({ createdAt: NOW, scanDate: dayOf(NOW) });
    expect(bar(CODE).createdAt).toBe(NOW);
    expect(getAt(D + '/' + dayOf(NOW))).toMatchObject({ totalCount: 1, codDollar: 10, dodDollar: 2 });
});
