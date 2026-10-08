/**
 * ⛔ ZTO-4 ៖ ជួរដែលបញ្ចូលជា «យករួច» (born closed ៖ ZTO ចុះហត្ថលេខា · `closedAtMs > 0`) របស់អតិថិជនដដែល ថ្ងៃដដែល ត្រូវបញ្ចូលគ្នាជាជួរតែមួយ
 *    (ច្បាប់ «មួយជួរ = អតិថិជនម្នាក់ក្នុងមួយថ្ងៃ») — ការសម្រេចរបស់ម្ចាស់គម្រោង ៖ បញ្ចូលចូលជួរដែលបិទទាំងអស់។ មុនកែ ៖ `!bornClosed` ក្នុង
 *    `addOrUpdateEntry()` ➜ មួយកញ្ចប់មួយជួរ។ ឥឡូវ ៖ ជួរ born-closed រកជួរបិទរបស់អតិថិជនដដែល ថ្ងៃដដែល ➜ merge (barcode នីមួយៗរក្សា `closedAt` ខ្លួន ·
 *    `isClosed` ដេរីវេពី barcode ទាំងអស់ · `closedAt` ជួរ = ថ្មីបំផុត) · ទិសផ្ទុយ ៖ ជួរបើក/គ្មានលេខ/អតិថិជនផ្សេង មិនបញ្ចូល · server បើកវិញ ➜ មិនបិទក្លែង។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { cleanupInFlight } from '../src/domain/cleanup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { addOrUpdateEntry } from '../src/features/scan-action';
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
function at(ms: number) {
    vi.setSystemTime(new Date(ms));
}
async function settle(ms = 150) {
    await sleep(ms);
}

const PHONE = '0961234567';
const D = Date.UTC(2026, 8, 5, 3, 0, 0);

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


const live = () => listOf(lab.store[HISTORY]);
const dayKey = '2026-09-05';

describe('ZTO-4 ៖ ជួរ born-closed របស់អតិថិជនដដែល ថ្ងៃដដែល បញ្ចូលគ្នា', () => {
    it('⛔ ជួរ born-closed ២ ➜ ជួរបិទតែមួយ · barcode ២ រក្សា closedAt ខ្លួន · closedAt ជួរ = ថ្មីបំផុត · ledger ២ កញ្ចប់', async () => {
        expect(await addOrUpdateEntry('ZTB0000001', PHONE, 10, 0, 'N/A', D, D + H)).toBe(true);
        expect(await addOrUpdateEntry('ZTB0000002', PHONE, 5, 1, 'N/A', D + 60000, D + 2 * H)).toBe(true);
        await settle();
        const items = live();
        expect(items.length).toBe(1);
        const it0 = items[0];
        expect(it0.isClosed).toBe(true);
        expect(it0.closedAt).toBe(D + 2 * H);
        expect(it0.barcodes.map((b: any) => [b.code, b.isClosed, b.closedAt])).toEqual([['ZTB0000001', true, D + H], ['ZTB0000002', true, D + 2 * H]]);
        expect(it0.count).toBe(2);
        expect(it0.cod).toBe(15);
        expect(it0.dod).toBe(1);
        const rev = getPath('zoew_daily_revenue_cod_dod/' + dayKey);
        expect(rev.totalCount).toBe(2);
        expect(rev.codDollar).toBe(15);
    });

    it('ទិសផ្ទុយ ៖ ជួរបើក + ជួរ born-closed អតិថិជនដដែល ➜ ២ ជួរ (បើក · បិទ) · ជួរបើកនៅបើក', async () => {
        expect(await addOrUpdateEntry('ZTB0000011', PHONE, 10, 0, 'N/A', D, 0)).toBe(true);
        expect(await addOrUpdateEntry('ZTB0000012', PHONE, 5, 0, 'N/A', D + 60000, D + H)).toBe(true);
        await settle();
        const items = live();
        expect(items.length).toBe(2);
        expect(items.filter((i: any) => i.isClosed).length).toBe(1);
        expect(items.find((i: any) => !i.isClosed).barcodes.map((b: any) => b.code)).toEqual(['ZTB0000011']);
    });

    it('ទិសផ្ទុយ ៖ អតិថិជនផ្សេង · «គ្មានលេខ» · ថ្ងៃផ្សេង ➜ មិនបញ្ចូល', async () => {
        expect(await addOrUpdateEntry('ZTB0000021', PHONE, 1, 0, 'N/A', D, D + H)).toBe(true);
        expect(await addOrUpdateEntry('ZTB0000022', '0977000111', 1, 0, 'N/A', D, D + H)).toBe(true);
        expect(await addOrUpdateEntry('ZTB0000023', 'គ្មានលេខ', 1, 0, 'N/A', D, D + H)).toBe(true);
        expect(await addOrUpdateEntry('ZTB0000024', 'គ្មានលេខ', 1, 0, 'N/A', D, D + H)).toBe(true);
        expect(await addOrUpdateEntry('ZTB0000025', PHONE, 1, 0, 'N/A', D + DAY, D + DAY + H)).toBe(true);
        await settle();
        expect(live().length).toBe(5);
    });

    it('⛔ server បើកជួរវិញ (ទិដ្ឋភាពក្នុងសតិនៅបិទ) ➜ merge មិនបិទជួរក្លែង · barcode born-closed នៅបិទ', async () => {
        expect(await addOrUpdateEntry('ZTB0000031', PHONE, 10, 0, 'N/A', D, D + H)).toBe(true);
        await settle();
        const id = live()[0].id;
        const server = getPath(HISTORY + '/' + id);
        server.isClosed = false;
        delete server.closedAt;
        server.barcodes[0].isClosed = false;
        delete server.barcodes[0].closedAt;
        setPath(HISTORY + '/' + id, server);
        expect(await addOrUpdateEntry('ZTB0000032', PHONE, 5, 0, 'N/A', D + 60000, D + 2 * H)).toBe(true);
        await settle();
        const merged = getPath(HISTORY + '/' + id);
        expect(merged.barcodes.map((b: any) => [b.code, b.isClosed])).toEqual([['ZTB0000031', false], ['ZTB0000032', true]]);
        expect(merged.isClosed).toBe(false);
        expect(merged.closedAt).toBeUndefined();
    });
});
