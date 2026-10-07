/**
 * ⛔ ZTO ៖ ការបញ្ចូលបញ្ជី **ស្របគ្នា** តាមខ្សែ «អតិថិជន + ថ្ងៃ» (សំណើម្ចាស់គម្រោង ៖ «ការទាញកញ្ចប់ពី ZTO យឺត ពេលចុច
 * បញ្ចូលក៏យឺត»)។ ការវាស់ ៖ ជួរដេកមួយ = ~៤–៩ ដំណើរទៅមក Firebase តាមលំដាប់ ➜ ១០០ ជួរ ≈ ២–៣ នាទី។
 *
 * ១. ជួរដេកអតិថិជនផ្សេងគ្នា ➜ claim/រក្សាទុក **ស្របគ្នា** (≤ `ZTO_LIST_IMPORT_CONCURRENCY`) ➜ ផ្លូវសំខាន់ខ្លីជាង ~៣ ដង
 *    (មុនកែ ៖ ម្តងមួយជួរ)។
 * ២. ជួរដេកអតិថិជនដដែល ថ្ងៃដដែល ➜ **ខ្សែតែមួយ តាមលំដាប់** ➜ `addOrUpdateEntry()` បញ្ចូលគ្នាជាកញ្ចប់តែមួយ (barcode តាមលំដាប់
 *    · `count` · លុយ ledger ត្រឹម · registry គ្រប់)។
 * ៣. ការព្យួរដំបូង ➜ **គ្មានជួរថ្មីចាប់ផ្តើម** · ខ្សែដែលកំពុងរត់បញ្ចប់ជួររបស់វា (⏳ ≤ ចំនួនខ្សែ) · «មិនទាន់បញ្ចូល N» ·
 *    ចំនួនបូកគ្នា = បញ្ជី · បញ្ជីនៅដដែល។
 * ៤. ក្រៅបណ្តាញកណ្តាលការបញ្ចូល ➜ ឈប់ដូចគ្នា។
 * ៥–៧. **អតិថិជនរាប់រយ** (សំណើម្ចាស់គម្រោង) ៖ បញ្ជី ១០០ ជួរ (ពិដានមួយដង) បញ្ចូលគ្រប់ និងត្រឹម · ៣០០ ជួរ ➜ ១០០ ក្នុងមួយចុច ·
 *    អតិថិជនមួយមាន ២០ កញ្ចប់ក្នុងចំណោម ២០ អតិថិជន ➜ ខ្សែតែមួយ លំដាប់ត្រឹម · ហាងធំ (៥០០ កញ្ចប់ក្នុងប្រវត្តិរួច) ➜ បញ្ចូល ១០០ ថ្មីលឿនដដែល។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { barcodeRegistryKey } from '../src/domain/registry';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { ZTO_LIST_IMPORT_CONCURRENCY, ZTO_LIST_IMPORT_MAX, importZtoListRows } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';

const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const HISTORY = 'zoew_scan_history_cod_dod';
const REGISTRY = 'zoew_barcode_registry/';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = { barcode: string; phone: string; cod: number; dod: number; at: string; ztoClosed: null; skip: string; from: string };
const lab = {
    latMs: 10,
    store: {} as Record<string, any>,
    phoneOfKey: new Map<string, string>(),
    inFlightClaims: 0,
    inFlightByPhone: new Map<string, number>(),
    maxClaimOverlap: 0,
    maxClaimOverlapPerPhone: 0,
    claims: 0,
    historyWrites: 0,
    hangCodes: new Set<string>(),
    onHistoryWrite: null as null | ((n: number) => void),
    lastQuestion: ''
};

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

const mentionsHangCode = (value: unknown) => {
    if (!lab.hangCodes.size) return false;
    const text = JSON.stringify(value) || '';
    for (const code of lab.hangCodes) if (text.indexOf(code) !== -1) return true;
    return false;
};
const hangForever = () => new Promise<never>(() => {});

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
            if (ref.path === HISTORY && mentionsHangCode(payload)) return hangForever();
            await sleep(lab.latMs);
            for (const k of Object.keys(payload)) setPath(ref.path + '/' + k, payload[k]);
            if (ref.path === HISTORY && lab.onHistoryWrite) lab.onHistoryWrite(++lab.historyWrites);
            return true;
        },
        set: async (ref: any, value: any) => {
            await sleep(lab.latMs);
            setPath(ref.path, value);
            return true;
        },
        runTransaction: async (ref: any, fn: any) => {
            const claimKey = ref.path.startsWith(REGISTRY) ? ref.path.slice(REGISTRY.length) : '';
            const phone = claimKey ? (lab.phoneOfKey.get(claimKey) || '?') : '';
            if (claimKey) {
                lab.claims++;
                lab.inFlightClaims++;
                lab.inFlightByPhone.set(phone, (lab.inFlightByPhone.get(phone) || 0) + 1);
                lab.maxClaimOverlap = Math.max(lab.maxClaimOverlap, lab.inFlightClaims);
                lab.maxClaimOverlapPerPhone = Math.max(lab.maxClaimOverlapPerPhone, lab.inFlightByPhone.get(phone) || 0);
            }
            try {
                await sleep(lab.latMs);
                const cur = getPath(ref.path);
                const next = fn(cur);
                if (next === undefined) return { committed: false, snapshot: { val: () => cur }, txOutcome: 'not-applied' };
                if (ref.path.startsWith(HISTORY + '/') && mentionsHangCode(next)) return hangForever();
                setPath(ref.path, next);
                const v = getPath(ref.path);
                if (ref.path.startsWith(HISTORY + '/') && lab.onHistoryWrite) lab.onHistoryWrite(++lab.historyWrites);
                return { committed: true, snapshot: { val: () => v }, txOutcome: 'committed' };
            } finally {
                if (claimKey) {
                    lab.inFlightClaims--;
                    lab.inFlightByPhone.set(phone, (lab.inFlightByPhone.get(phone) || 1) - 1);
                }
            }
        },
        onValue: () => () => {},
        off: () => {},
        increment: (n: number) => n
    };
}

function row(index: number, phone: string, minute: number): Row {
    const barcode = 'ZTL' + String(100000 + index);
    lab.phoneOfKey.set(barcodeRegistryKey(barcode), phone);
    const hour = 9 + Math.floor(minute / 60);
    const at = '2026-10-05 ' + String(hour).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0') + ':00';
    return { barcode, phone, cod: 1 + index, dod: 0, at, ztoClosed: null, skip: '', from: 'cn' };
}

function distinctRows(n: number) {
    const out: Row[] = [];
    for (let i = 0; i < n; i++) out.push(row(i, '09' + String(10000000 + i), i));
    return out;
}

function loadList(rows: Row[]) {
    ztoState.ztoListSyncResult = { rows, signedRows: [], from: '2026-10-03', to: '2026-10-06', total: rows.length } as any;
}

function numberAfter(label: string) {
    const match = viewState.ztoListSyncNote.match(new RegExp(label + ' (\\d+)'));
    return match ? Number(match[1]) : 0;
}

function tally() {
    return {
        saved: numberAfter('✅ បញ្ចូល'),
        pending: numberAfter('⏳ កំពុងរក្សាទុក'),
        failed: numberAfter('⚠️ បរាជ័យ'),
        notTried: numberAfter('⏸️ មិនទាន់បញ្ចូល')
    };
}

function itemWithBarcode(code: string) {
    return dataState.scanHistory.find((item: any) => Array.isArray(item.barcodes) && item.barcodes.some((b: any) => b.code === code));
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    lab.store = {};
    lab.phoneOfKey.clear();
    lab.inFlightClaims = 0;
    lab.inFlightByPhone.clear();
    lab.maxClaimOverlap = 0;
    lab.maxClaimOverlapPerPhone = 0;
    lab.claims = 0;
    lab.historyWrites = 0;
    lab.hangCodes.clear();
    lab.onHistoryWrite = null;
    lab.latMs = 10;
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
    firebaseState.auth = { currentUser: { uid: 'lanes-user' } } as any;
    firebaseState.db = { lanes: true } as any;
    firebaseState.isDatabaseConnected = true;
    firebaseState.fb = makeFb() as any;
    for (const [name, path] of [['dbRefHistory', HISTORY], ['dbRefDeleted', 'zoew_recently_deleted_cod_dod'],
        ['dbRefDailyRevenue', 'zoew_daily_revenue_cod_dod'], ['dbRefMonthlyRevenue', 'zoew_monthly_revenue_cod_dod'],
        ['dbRefDailyCollected', 'zoew_daily_collected_cod_dod'], ['dbRefDailyPickup', 'zoew_daily_pickup_cod_dod'],
        ['dbRefRegistry', 'zoew_barcode_registry']] as const) {
        (firebaseState as any)[name] = { path };
    }
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
        const input = document.createElement('input');
        input.value = name === 'ztoListSyncFrom' ? '2026-10-03' : '2026-10-06';
        refTo(name)(input);
    }
    lab.lastQuestion = '';
    vi.stubGlobal('confirm', (question: string) => { lab.lastQuestion = String(question); return true; });
    vi.stubGlobal('alert', () => undefined);
    (window as any).ZoeErrors = { capture: () => {} };
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as any).ZoeErrors;
    firebaseState.dbLivenessProbe = null as any;
    refTo('ztoListSyncFrom')(null);
    refTo('ztoListSyncTo')(null);
    appLocalStore.clear();
});

describe('ZTO list import — lanes by customer + day', () => {
    it('1. rows of different customers import in parallel (≤ ZTO_LIST_IMPORT_CONCURRENCY) and finish ~3× sooner', async () => {
        const rows = distinctRows(16);
        lab.latMs = 30;
        loadList(rows);
        const startedAt = performance.now();
        await importZtoListRows();
        const wallMs = performance.now() - startedAt;
        expect(ZTO_LIST_IMPORT_CONCURRENCY).toBe(4);
        expect(lab.maxClaimOverlap).toBeGreaterThanOrEqual(2);
        expect(lab.maxClaimOverlap).toBeLessThanOrEqual(ZTO_LIST_IMPORT_CONCURRENCY);
        expect(wallMs).toBeLessThan(rows.length * lab.latMs * 1.2);
        expect(tally()).toEqual({ saved: 16, pending: 0, failed: 0, notTried: 0 });
        expect(dataState.scanHistory.length).toBe(16);
        expect(Object.keys(lab.store.zoew_barcode_registry || {}).length).toBe(16);
        expect(ztoState.ztoListSyncResult).toBeNull();
    }, 20000);

    it('2. rows of the same customer + day stay in one lane: merged into one item, barcodes in list order, money exact', async () => {
        const a = [row(0, '0961111111', 0), row(1, '0961111111', 1), row(2, '0961111111', 2), row(3, '0961111111', 3)];
        const b = [row(4, '0962222222', 4), row(5, '0962222222', 5)];
        const others = [row(6, '0963333333', 6), row(7, '0964444444', 7), row(8, '0965555555', 8)];
        const rows = [a[0], b[0], others[0], a[1], others[1], b[1], a[2], others[2], a[3]];
        loadList(rows);
        await importZtoListRows();
        expect(lab.maxClaimOverlapPerPhone).toBe(1);
        expect(lab.maxClaimOverlap).toBeGreaterThanOrEqual(2);
        expect(tally()).toEqual({ saved: 9, pending: 0, failed: 0, notTried: 0 });
        expect(dataState.scanHistory.length).toBe(5);
        const itemA = itemWithBarcode(a[0].barcode) as any;
        expect(itemA.barcodes.map((x: any) => x.code)).toEqual(a.map((r) => r.barcode));
        expect(itemA.count).toBe(4);
        expect(Number(itemA.cod)).toBe(a.reduce((sum, r) => sum + r.cod, 0));
        const itemB = itemWithBarcode(b[0].barcode) as any;
        expect(itemB.barcodes.map((x: any) => x.code)).toEqual(b.map((r) => r.barcode));
        const ledgerDay = (lab.store.zoew_daily_revenue_cod_dod || {})['2026-10-05'] || {};
        expect(Number(ledgerDay.codDollar)).toBe(rows.reduce((sum, r) => sum + r.cod, 0));
        expect(Number(ledgerDay.dodDollar)).toBe(0);
        expect(Number(ledgerDay.totalCount)).toBe(rows.length);
        expect(Object.keys(lab.store.zoew_barcode_registry || {}).length).toBe(9);
        const serverItems = Object.values(lab.store[HISTORY] || {}) as any[];
        expect(serverItems.length).toBe(5);
        expect(serverItems.filter((item) => item.phone === itemA.phone).length).toBe(1);
    }, 20000);

    it('3. the first hung save stops new rows; lanes in flight finish (⏳ ≤ lanes); counts add up; the list stays', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(NOW));
        const rows = distinctRows(12);
        for (let i = 4; i < rows.length; i++) lab.hangCodes.add(rows[i].barcode);
        loadList(rows);
        const run = importZtoListRows();
        await vi.advanceTimersByTimeAsync(40000);
        await run;
        const counts = tally();
        expect(counts.saved).toBe(4);
        expect(counts.pending).toBeGreaterThanOrEqual(2);
        expect(counts.pending).toBeLessThanOrEqual(ZTO_LIST_IMPORT_CONCURRENCY);
        expect(counts.notTried).toBeGreaterThanOrEqual(1);
        expect(counts.saved + counts.pending + counts.failed + counts.notTried).toBe(rows.length);
        expect(lab.claims).toBe(rows.length - counts.notTried);
        expect(viewState.ztoListSyncNote).toContain('បញ្ជីនៅដដែល');
        expect(ztoState.ztoListSyncResult).not.toBeNull();
        expect(ztoState.ztoListSyncInFlight).toBe(false);
    }, 20000);

    it('4. going offline mid-import stops new rows; counts add up; the list stays', async () => {
        let online = true;
        vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
        const rows = distinctRows(12);
        lab.onHistoryWrite = (n) => { if (n === 2) online = false; };
        loadList(rows);
        await importZtoListRows();
        const counts = tally();
        expect(counts.notTried).toBeGreaterThanOrEqual(1);
        expect(counts.saved).toBeGreaterThanOrEqual(1);
        expect(counts.saved + counts.pending + counts.failed + counts.notTried).toBe(rows.length);
        expect(lab.claims).toBe(rows.length - counts.notTried);
        expect(ztoState.ztoListSyncResult).not.toBeNull();
        expect(ztoState.ztoListSyncInFlight).toBe(false);
    }, 20000);
    it('5. hundreds of customers: a 100-row list (the per-click cap) imports fully and exactly; 300 rows ➜ 100 per click', async () => {
        const rows = distinctRows(100);
        loadList(rows);
        const startedAt = performance.now();
        await importZtoListRows();
        const wallMs = performance.now() - startedAt;
        expect(tally()).toEqual({ saved: 100, pending: 0, failed: 0, notTried: 0 });
        expect(lab.maxClaimOverlap).toBeGreaterThanOrEqual(2);
        expect(lab.maxClaimOverlap).toBeLessThanOrEqual(ZTO_LIST_IMPORT_CONCURRENCY);
        expect(wallMs).toBeLessThan(rows.length * lab.latMs * 1.5);
        expect(dataState.scanHistory.length).toBe(100);
        expect(Object.keys(lab.store[HISTORY] || {}).length).toBe(100);
        expect(Object.keys(lab.store.zoew_barcode_registry || {}).length).toBe(100);
        const ledgerDay = (lab.store.zoew_daily_revenue_cod_dod || {})['2026-10-05'] || {};
        expect(Number(ledgerDay.codDollar)).toBe(rows.reduce((sum, r) => sum + r.cod, 0));
        expect(Number(ledgerDay.totalCount)).toBe(100);
        expect(ztoState.ztoListSyncResult).toBeNull();

        const threeHundred = distinctRows(300);
        loadList(threeHundred);
        await importZtoListRows();
        expect(lab.lastQuestion).toContain('បញ្ចូល ' + ZTO_LIST_IMPORT_MAX + ' កញ្ចប់ថ្មី');
        expect(lab.lastQuestion).toContain('ពិដាន ' + ZTO_LIST_IMPORT_MAX);
        expect(tally()).toEqual({ saved: ZTO_LIST_IMPORT_MAX, pending: 0, failed: 0, notTried: 0 });
        expect(dataState.scanHistory.length).toBe(100 + ZTO_LIST_IMPORT_MAX);
        expect(Object.keys(lab.store.zoew_barcode_registry || {}).length).toBe(100 + ZTO_LIST_IMPORT_MAX);
        expect(Number(((lab.store.zoew_daily_revenue_cod_dod || {})['2026-10-05'] || {}).totalCount)).toBe(100 + ZTO_LIST_IMPORT_MAX);
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(viewState.ztoListSyncNote).toContain('សូមទាញបញ្ជីម្តងទៀត');
    }, 30000);

    it('6. one customer with 20 parcels among 20 customers × 4 (shuffled): one lane per customer, order kept, money exact', async () => {
        let index = 0;
        const bigRows: Row[] = [];
        for (let i = 0; i < 20; i++) bigRows.push(row(index++, '0969999999', i));
        const groups: Row[][] = [];
        for (let c = 0; c < 20; c++) {
            const phone = '09' + String(20000000 + c);
            const group: Row[] = [];
            for (let k = 0; k < 4; k++) group.push(row(index++, phone, 20 + k));
            groups.push(group);
        }
        const sources = [bigRows].concat(groups);
        const cursors = sources.map(() => 0);
        const rows: Row[] = [];
        while (rows.length < 100) {
            for (let s = 0; s < sources.length; s++) {
                if (cursors[s] < sources[s].length) rows.push(sources[s][cursors[s]++]);
            }
        }
        loadList(rows);
        await importZtoListRows();
        expect(tally()).toEqual({ saved: 100, pending: 0, failed: 0, notTried: 0 });
        expect(lab.maxClaimOverlapPerPhone).toBe(1);
        expect(lab.maxClaimOverlap).toBeGreaterThanOrEqual(2);
        expect(dataState.scanHistory.length).toBe(21);
        expect(Object.keys(lab.store[HISTORY] || {}).length).toBe(21);
        const bigItem = itemWithBarcode(bigRows[0].barcode) as any;
        expect(bigItem.barcodes.map((x: any) => x.code)).toEqual(bigRows.map((r) => r.barcode));
        expect(bigItem.count).toBe(20);
        expect(Number(bigItem.cod)).toBe(bigRows.reduce((sum, r) => sum + r.cod, 0));
        for (const group of groups) {
            const item = itemWithBarcode(group[0].barcode) as any;
            expect(item.barcodes.map((x: any) => x.code)).toEqual(group.map((r) => r.barcode));
            expect(item.count).toBe(4);
        }
        const ledgerDay = (lab.store.zoew_daily_revenue_cod_dod || {})['2026-10-05'] || {};
        expect(Number(ledgerDay.codDollar)).toBe(rows.reduce((sum, r) => sum + r.cod, 0));
        expect(Number(ledgerDay.totalCount)).toBe(100);
        expect(Object.keys(lab.store.zoew_barcode_registry || {}).length).toBe(100);
    }, 30000);

    it('7. a big shop (500 parcels already in history) still imports 100 new rows fully and within the same time bound', async () => {
        const existing: any[] = [];
        for (let i = 0; i < 500; i++) {
            const code = 'OLD' + String(500000 + i);
            const item = { id: 'old-' + i, phone: '09' + String(70000000 + i), scanDate: '2026-10-05', isClosed: false, createdAt: NOW - 7200000,
                count: 1, cod: 1, dod: 0, barcodes: [{ code, isClosed: false, cod: 1, dod: 0, createdAt: NOW - 7200000 }] };
            existing.push(item);
            setPath(HISTORY + '/' + item.id, item);
            setPath(REGISTRY + barcodeRegistryKey(code), true);
        }
        dataState.scanHistory = existing;
        const rows = distinctRows(100);
        loadList(rows);
        const startedAt = performance.now();
        await importZtoListRows();
        const wallMs = performance.now() - startedAt;
        expect(tally()).toEqual({ saved: 100, pending: 0, failed: 0, notTried: 0 });
        expect(wallMs).toBeLessThan(rows.length * lab.latMs * 1.5);
        expect(dataState.scanHistory.length).toBe(600);
        expect(Object.keys(lab.store[HISTORY] || {}).length).toBe(600);
        expect(Object.keys(lab.store.zoew_barcode_registry || {}).length).toBe(600);
        expect(Number(((lab.store.zoew_daily_revenue_cod_dod || {})['2026-10-05'] || {}).totalCount)).toBe(100);
    }, 30000);
});
