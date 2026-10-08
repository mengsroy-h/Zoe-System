import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getZoneDateKey } from '../src/core/timezone';
import { barcodeRegistryKey } from '../src/domain/registry';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearZtoPickupStatusStore, runZtoStatusSweep } from '../src/features/zto-status';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';

const HISTORY = 'zoew_scan_history_cod_dod';
const H = 60 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lab = { latMs: 5, store: {} as Record<string, any> };

function getPath(path: string) {
    const parts = path.split('/').filter(Boolean);
    let cur: any = lab.store;
    for (const p of parts) {
        if (!cur || typeof cur !== 'object' || !(p in cur)) return null;
        cur = cur[p];
    }
    return cur === undefined ? null : JSON.parse(JSON.stringify(cur));
}
function setPath(path: string, value: any) {
    const parts = path.split('/').filter(Boolean);
    let cur: any = lab.store;
    if (value === null || value === undefined) {
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') return;
            cur = cur[parts[i]];
        }
        delete cur[parts[parts.length - 1]];
        return;
    }
    for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = JSON.parse(JSON.stringify(value));
}
function makeFb() {
    return {
        getIdTokenResult: async () => ({ token: 't' }),
        ref: (_db: unknown, path: string) => ({ path }),
        get: async (ref: any) => {
            await sleep(lab.latMs);
            const v = getPath(ref.path);
            return { val: () => v, exists: () => v !== null };
        },
        update: async (ref: any, payload: any) => {
            await sleep(lab.latMs);
            for (const k of Object.keys(payload)) setPath(ref.path + '/' + k, payload[k]);
            return true;
        },
        set: async (ref: any, value: any) => {
            await sleep(lab.latMs);
            setPath(ref.path, value);
            return true;
        },
        runTransaction: async (ref: any, fn: any) => {
            await sleep(lab.latMs);
            const cur = getPath(ref.path);
            const next = fn(cur);
            if (next === undefined) return { committed: false, snapshot: { val: () => cur }, txOutcome: 'not-applied' };
            setPath(ref.path, next);
            const v = getPath(ref.path);
            return { committed: true, snapshot: { val: () => v }, txOutcome: 'committed' };
        },
        onValue: () => () => {},
        off: () => {},
        increment: (n: number) => n
    };
}
const NOW = Date.UTC(2026, 9, 5, 17, 30, 0);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    lab.store = {};
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    ztoState.ztoStatusInFlight = false;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = {};
    dataState.monthlyRevenueData = {};
    dataState.dailyCollectedData = {};
    dataState.dailyPickupData = {};
    uiState.isModalOpen = false;
    uiState.toasts = [];
    viewState.ztoListSyncNote = '';
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'restamp-user' } } as any;
    firebaseState.db = { restamp: true } as any;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.fb = makeFb() as any;
    for (const [name, path] of [['dbRefHistory', HISTORY], ['dbRefDeleted', 'zoew_recently_deleted_cod_dod'],
        ['dbRefDailyRevenue', 'zoew_daily_revenue_cod_dod'], ['dbRefMonthlyRevenue', 'zoew_monthly_revenue_cod_dod'],
        ['dbRefDailyCollected', 'zoew_daily_collected_cod_dod'], ['dbRefDailyPickup', 'zoew_daily_pickup_cod_dod'],
        ['dbRefRegistry', 'zoew_barcode_registry']] as const) {
        (firebaseState as any)[name] = { path };
    }
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => undefined);
    (window as any).ZoeErrors = { capture: () => {} };
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as any).ZoeErrors;
    firebaseState.dbLivenessProbe = null as any;
    firebaseState.serverClockTrusted = false;
    firebaseState.isDatabaseConnected = false;
    appLocalStore.clear();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const T0 = NOW - 1 * H;
function seed(codes: string[], closedCodes: string[]) {
    const day = getZoneDateKey(T0, 0);
    const barcodes = codes.map((code) => {
        const closed = closedCodes.includes(code);
        const b: any = { code, isClosed: closed, cod: 5, dod: 0, isDeducted: false, isFromDeletion: false, createdAt: T0 - 2 * H, time: '21:30:00' };
        if (closed) b.closedAt = T0;
        return b;
    });
    const allClosed = barcodes.every((b: any) => b.isClosed);
    const item: any = { id: 'it1', phone: '0961234567', scanDate: day, isClosed: allClosed, createdAt: T0 - 2 * H,
        cod: 5 * codes.length, dod: 0, price: 5 * codes.length, count: codes.length, barcode: codes[0], time: '21:30:00 (' + day + ')', barcodes };
    if (allClosed) item.closedAt = T0;
    setPath(HISTORY + '/it1', item);
    codes.forEach((code) => setPath('zoew_barcode_registry/' + barcodeRegistryKey(code), true));
    const stale = JSON.parse(JSON.stringify(item));
    stale.isClosed = false;
    delete stale.closedAt;
    stale.barcodes.forEach((b: any) => { b.isClosed = false; delete b.closedAt; });
    dataState.scanHistory = [stale];
    return item;
}
const server = () => getPath(HISTORY + '/it1');
const barcodeOf = (code: string) => server().barcodes.find((b: any) => b.code === code);

describe('closing a barcode that the server already holds closed keeps its closedAt (ZTO-3)', () => {
    it('1. ZTO sign-list sweep on a stale view ➜ server closedAt stays T0 (item and barcode) · no collected node on the new day', async () => {
        const code = 'ZTR1000001';
        seed([code], [code]);
        vi.stubGlobal('fetch', vi.fn(async () => json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, total: 1,
            rows: [], otherScans: 0, signedScans: 1, signed: [code], signedOk: true })));
        await runZtoStatusSweep(false);
        await sleep(200);
        expect(server().closedAt).toBe(T0);
        expect(barcodeOf(code).closedAt).toBe(T0);
        const collected = getPath('zoew_daily_collected_cod_dod') || {};
        expect(Object.keys(collected)).not.toContain(getZoneDateKey(NOW, 0));
    });

    it('2. direct close on a stale view ➜ the server stamp is kept', async () => {
        const code = 'ZTR1000002';
        seed([code], [code]);
        const out = await applyBarcodeCloseChange('it1', code, true, { silent: true, showModal: false });
        expect(out).toBe(true);
        expect(server().closedAt).toBe(T0);
        expect(barcodeOf(code).closedAt).toBe(T0);
        expect(barcodeOf(code).isClosed).toBe(true);
    });

    it('3. mixed parcel ៖ re-closing A (closed at T0) keeps T0 · closing B (open) stamps now and closes the parcel now', async () => {
        seed(['ZTRA', 'ZTRB'], ['ZTRA']);
        await applyBarcodeCloseChange('it1', 'ZTRA', true, { silent: true, showModal: false });
        expect(barcodeOf('ZTRA').closedAt).toBe(T0);
        expect(server().isClosed).toBe(false);
        expect(server().closedAt).toBeUndefined();
        await applyBarcodeCloseChange('it1', 'ZTRB', true, { silent: true, showModal: false });
        expect(barcodeOf('ZTRA').closedAt).toBe(T0);
        expect(barcodeOf('ZTRB').closedAt).toBe(NOW);
        expect(server().isClosed).toBe(true);
        expect(server().closedAt).toBe(NOW);
    });

    it('4. reverse ៖ an open server barcode is stamped now', async () => {
        const code = 'ZTR1000004';
        seed([code], []);
        await applyBarcodeCloseChange('it1', code, true, { silent: true, showModal: false });
        expect(barcodeOf(code).isClosed).toBe(true);
        expect(barcodeOf(code).closedAt).toBe(NOW);
        expect(server().closedAt).toBe(NOW);
    });

    it('5. reverse ៖ reopening a closed barcode removes its stamp', async () => {
        const code = 'ZTR1000005';
        seed([code], [code]);
        const local = dataState.scanHistory[0];
        local.isClosed = true;
        local.closedAt = T0;
        local.barcodes[0].isClosed = true;
        local.barcodes[0].closedAt = T0;
        await applyBarcodeCloseChange('it1', code, false, { silent: true, showModal: false });
        expect(barcodeOf(code).isClosed).toBe(false);
        expect(barcodeOf(code).closedAt).toBeUndefined();
        expect(server().isClosed).toBe(false);
        expect(server().closedAt).toBeUndefined();
    });
});
