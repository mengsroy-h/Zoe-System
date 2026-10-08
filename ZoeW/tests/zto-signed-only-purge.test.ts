import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getZoneDateKey } from '../src/core/timezone';
import { barcodeRegistryKey, claimBarcodeInRegistry } from '../src/domain/registry';
import { cleanupInFlight, runAutomaticCleanupRules, runAutomaticDeletedCleanup } from '../src/domain/cleanup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { addOrUpdateEntry } from '../src/features/scan-action';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { classifyZtoListRows, importZtoListRows, ztoListRowAgeState } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const REGISTRY = 'zoew_barcode_registry';
const H = 60 * 60 * 1000;
const DAY = 24 * H;
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
const listOf = (node: any) => node && typeof node === 'object' ? Object.keys(node).map((k) => node[k]) : [];
function syncViewFromStore() {
    dataState.scanHistory = listOf(lab.store[HISTORY]);
    dataState.deletedItems = listOf(lab.store[TRASH]);
    dataState.dailyPickupData = getPath('zoew_daily_pickup_cod_dod') || {};
}
function at(ms: number) {
    vi.setSystemTime(new Date(ms));
}
async function settle(ms = 150) {
    await sleep(ms);
}
function numberAfter(label: string) {
    const match = viewState.ztoListSyncNote.match(new RegExp(label + ' (\\d+)'));
    return match ? Number(match[1]) : 0;
}

const CODE = 'ZTX1000001';
const PHONE = '0961234567';
const D = Date.UTC(2026, 8, 5, 3, 0, 0);
const S_AT = '2026-09-05 13:00:00';
const PULL = D + 30 * DAY + 2.5 * H;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    at(D);
    lab.store = {};
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    cleanupInFlight.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = {};
    dataState.monthlyRevenueData = {};
    dataState.dailyCollectedData = {};
    dataState.dailyPickupData = {};
    dataState.deletedCleanupInFlight = false;
    uiState.isModalOpen = false;
    uiState.toasts = [];
    viewState.ztoListSyncNote = '';
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'purge-user' } } as any;
    firebaseState.db = { purge: true } as any;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.fb = makeFb() as any;
    for (const [name, path] of [['dbRefHistory', HISTORY], ['dbRefDeleted', TRASH],
        ['dbRefDailyRevenue', 'zoew_daily_revenue_cod_dod'], ['dbRefMonthlyRevenue', 'zoew_monthly_revenue_cod_dod'],
        ['dbRefDailyCollected', 'zoew_daily_collected_cod_dod'], ['dbRefDailyPickup', 'zoew_daily_pickup_cod_dod'],
        ['dbRefRegistry', REGISTRY]] as const) {
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

async function scanCloseAndClean(untilMs: number) {
    expect(await claimBarcodeInRegistry(CODE)).toBe('claimed');
    expect(await addOrUpdateEntry(CODE, PHONE, 10, 0, 'N/A', 0, 0)).toBe(true);
    const item = dataState.scanHistory.find((i: any) => i.barcodes.some((b: any) => b.code === CODE));
    expect(await applyBarcodeCloseChange(item.id, CODE, true, { silent: true, showModal: false })).toBe(true);
    at(D + 2 * H + 2 * 60000);
    syncViewFromStore();
    cleanupInFlight.clear();
    runAutomaticCleanupRules();
    await settle(400);
    at(untilMs);
    syncViewFromStore();
    dataState.deletedCleanupInFlight = false;
    await runAutomaticDeletedCleanup();
    await settle(400);
    syncViewFromStore();
}
const signedRowsFor = (code: string) => [{ barcode: code, phone: PHONE, cod: 10, dod: 0, at: S_AT, from: '' }];

describe('signed-only list row of a parcel ZoeW already picked up, after its pickup trash was purged (ZTO-2)', () => {
    it('1. scan ➜ hand close ➜ 2h cleanup ➜ 30d purge ➜ list pull ➜ skipped as purged · nothing imported · ledger counts the parcel once', async () => {
        const dayKey = getZoneDateKey(D, 0);
        await scanCloseAndClean(PULL);
        expect(listOf(getPath(TRASH)).length).toBe(0);
        expect(getPath(REGISTRY + '/' + barcodeRegistryKey(CODE))).toBe(null);
        const range = { from: '2026-09-05', to: getZoneDateKey(PULL, 0) };
        const groups = classifyZtoListRows([], dataState.scanHistory, dataState.deletedItems, signedRowsFor(CODE), range, dataState.dailyPickupData);
        expect(groups.fresh.length).toBe(0);
        expect(groups.skipped.some((r: any) => r.key === barcodeRegistryKey(CODE) && r.skip === 'too-old-purged')).toBe(true);
        ztoState.ztoListSyncResult = { rows: [], signedRows: signedRowsFor(CODE), from: range.from, to: range.to, total: 0 } as any;
        await importZtoListRows();
        await settle(300);
        expect(numberAfter('✅ បញ្ចូល')).toBe(0);
        expect(listOf(getPath(HISTORY)).length).toBe(0);
        expect(getPath('zoew_daily_revenue_cod_dod/' + dayKey).codDollar).toBe(10);
    });

    it('2. control ៖ 29 days (pickup trash still there) ➜ existing, nothing imported', async () => {
        await scanCloseAndClean(D + 29 * DAY);
        expect(dataState.deletedItems.length).toBe(1);
        const range = { from: '2026-09-05', to: getZoneDateKey(D + 29 * DAY, 0) };
        const groups = classifyZtoListRows([], dataState.scanHistory, dataState.deletedItems, signedRowsFor(CODE), range, dataState.dailyPickupData);
        expect(groups.fresh.length).toBe(0);
        expect(groups.existing.length).toBe(1);
    });

    it('3. reverse ៖ a signed-only parcel ZoeW never recorded is still imported born closed', async () => {
        at(PULL);
        const other = 'ZTX2000002';
        const range = { from: '2026-09-05', to: getZoneDateKey(PULL, 0) };
        const groups = classifyZtoListRows([], [], [], signedRowsFor(other), range, { [getZoneDateKey(D, 0)]: { pickedUpBarcodes: { [barcodeRegistryKey(CODE)]: PHONE } } });
        expect(groups.fresh.length).toBe(1);
        expect(groups.fresh[0].signedOnly).toBe(true);
        ztoState.ztoListSyncResult = { rows: [], signedRows: signedRowsFor(other), from: range.from, to: range.to, total: 0 } as any;
        await importZtoListRows();
        await settle(300);
        expect(numberAfter('✅ បញ្ចូល')).toBe(1);
    });
});
