import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { getFormattedDate } from '../src/core/timezone';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { appLocalStore } from '../src/core/storage';
import { refTo } from '../src/app/refs';
import { addOrUpdateEntry } from '../src/features/scan-action';
import { removeSingleBarcode } from '../src/features/barcode-ops';
import { uncollectedValueByDate } from '../src/features/export';
import { importZtoListRows } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const PHONE = '0961111111';
const OLD = 'A111111111';
const NEW = 'C333333333';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Proposal = { path: string; seen: any; next: any };
const lab = { store: {} as Record<string, any>, txLog: [] as string[], proposals: [] as Proposal[], coldPaths: new Set<string>(), coldSeen: new Set<string>() };

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}
function getPath(path: string) {
    const parts = path.split('/').filter(Boolean);
    let cur: any = lab.store;
    for (const part of parts) {
        if (!cur || typeof cur !== 'object' || !(part in cur)) return null;
        cur = cur[part];
    }
    return cur === undefined ? null : clone(cur);
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
    cur[parts[parts.length - 1]] = clone(value);
}
function makeFb() {
    return {
        ref: (_db: unknown, path = '') => ({ path }),
        get: async (ref: any) => { await sleep(2); const v = getPath(ref.path); return { val: () => v, exists: () => v !== null }; },
        update: async (ref: any, payload: any) => {
            await sleep(2);
            for (const key of Object.keys(payload)) setPath((ref.path ? ref.path + '/' : '') + key, payload[key]);
            return true;
        },
        set: async (ref: any, value: any) => { await sleep(2); setPath(ref.path, value); return true; },
        runTransaction: async (ref: any, fn: any) => {
            await sleep(2);
            let cur = lab.coldPaths.has(ref.path) && !lab.coldSeen.has(ref.path) ? null : getPath(ref.path);
            lab.coldSeen.add(ref.path);
            for (let round = 0; round < 4; round++) {
                const seen = JSON.stringify(cur);
                lab.txLog.push(ref.path + ' <- ' + (cur === null ? 'null' : 'value'));
                const next = fn(cur);
                if (next === undefined) return { committed: false, snapshot: { val: () => getPath(ref.path) } };
                lab.proposals.push({ path: ref.path, seen: JSON.parse(seen), next: clone(next) });
                const server = getPath(ref.path);
                if (JSON.stringify(server) !== seen) { cur = server; continue; }
                setPath(ref.path, next);
                return { committed: true, snapshot: { val: () => getPath(ref.path) } };
            }
            throw new Error('maxretry');
        },
        onValue: () => () => {},
        off: () => {},
        increment: (n: number) => n
    };
}

let today = '';
let staleCreatedAt = 0;

function seedOldBarcode() {
    return { code: OLD, time: '09:00:00 (' + today + ')', cod: 10, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: staleCreatedAt };
}
function seedStaleItem() {
    const a = seedOldBarcode();
    return { id: 'itemI', createdAt: staleCreatedAt, phone: PHONE, cod: 10, dod: 0, price: 10, count: 1, barcode: OLD,
        barcodes: [a], time: a.time, scanDate: today, isClosed: false, isCalled: false, locker: 'L-07', lockerUpdatedAt: staleCreatedAt };
}
function historyProposals() {
    return lab.proposals.filter((p) => p.path === HISTORY + '/itemI');
}
function codesOf(item: any) {
    return (item && Array.isArray(item.barcodes) ? item.barcodes : []).map((b: any) => b.code);
}
function deductedTrashCopiesOf(code: string) {
    const trash = getPath(TRASH) || {};
    return Object.values(trash).filter((t: any) => (t.barcodes || []).some((b: any) => b.code === code && b.isDeducted)).length;
}
function syncLocalViewFromServer() {
    dataState.scanHistory = Object.values(getPath(HISTORY) || {}).map((v: any) => clone(v));
    dataState.deletedItems = Object.values(getPath(TRASH) || {}).map((v: any) => clone(v));
}

beforeEach(() => {
    lab.store = {};
    lab.txLog = [];
    lab.proposals = [];
    lab.coldPaths = new Set();
    lab.coldSeen = new Set();
    uiState.toasts = [];
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => undefined);
    (window as any).ZoeErrors = { capture: () => {} };
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'u' } } as any;
    firebaseState.db = { name: 'db' } as any;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.fb = makeFb() as any;
    for (const [name, path] of [['dbRefHistory', HISTORY], ['dbRefDeleted', TRASH],
        ['dbRefDailyRevenue', DAILY], ['dbRefMonthlyRevenue', 'zoew_monthly_revenue_cod_dod'],
        ['dbRefDailyCollected', 'zoew_daily_collected_cod_dod'], ['dbRefDailyPickup', 'zoew_daily_pickup_cod_dod']] as const) {
        (firebaseState as any)[name] = { path };
    }
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    today = getFormattedDate();
    staleCreatedAt = Date.now() - 3600000;
    const other = { id: 'itemO', createdAt: Date.now() - 7200000, phone: '0962222222', cod: 20, dod: 0, price: 20, count: 1, barcode: 'B222222222',
        barcodes: [{ code: 'B222222222', time: '08:00:00 (' + today + ')', cod: 20, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 7200000 }],
        time: '08:00:00 (' + today + ')', scanDate: today, isClosed: false, isCalled: false };
    dataState.scanHistory = [seedStaleItem(), clone(other)];
    dataState.deletedItems = [];
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
    lab.store[HISTORY] = { itemO: clone(other) };
    lab.store[TRASH] = { trashT: { ...seedStaleItem(), id: 'trashT', deletedAt: Date.now() - 500, isFromDeletion: false, trashReason: 'remove',
        barcodes: [{ ...seedOldBarcode(), isDeducted: true }] } };
    lab.store[DAILY] = { [today]: { codDollar: 20, dodDollar: 0, totalCount: 1 } };
    lab.store.zoew_monthly_revenue_cod_dod = { [today.slice(0, 7)]: { codDollar: 20, dodDollar: 0, totalCount: 1 } };
    dataState.dailyRevenueData = { [today]: { codDollar: 20, dodDollar: 0, totalCount: 1 } };
    dataState.monthlyRevenueData = { [today.slice(0, 7)]: { codDollar: 20, dodDollar: 0, totalCount: 1 } };
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

describe('scan merge into an item the server no longer holds (removed/deleted by another device)', () => {
    it('1. server item gone ➜ the write holds only the scanned barcode (nothing of the stale local item returns)', async () => {
        expect(getPath(HISTORY + '/itemI')).toBeNull();
        const status = await addOrUpdateEntry(NEW, PHONE, 5, 0);
        expect(status).toBe(true);
        expect(lab.txLog.some((l) => l === HISTORY + '/itemI <- null')).toBe(true);
        const server = getPath(HISTORY + '/itemI');
        expect(codesOf(server)).toEqual([NEW]);
        expect(server.count).toBe(1);
        expect(server.cod).toBe(5);
        expect(server.price).toBe(5);
        expect(server.phone).toBe(PHONE);
        expect(server.scanDate).toBe(today);
        expect(server.isClosed).toBe(false);
        expect(server.createdAt).toBe(server.barcodes[0].createdAt);
        expect(server.createdAt).toBeGreaterThan(staleCreatedAt);
        expect(server.locker).toBeUndefined();
        expect(server.lockerUpdatedAt).toBeUndefined();
        expect(getPath(DAILY + '/' + today).codDollar).toBe(25);
        expect(getPath(DAILY + '/' + today).totalCount).toBe(2);
        expect(getPath(TRASH + '/trashT').barcodes[0].isDeducted).toBe(true);
        syncLocalViewFromServer();
        expect(uncollectedValueByDate()[today].cod).toBe(25);
    }, 20000);

    it('2. the removed barcode is never deducted a second time (one deducted trash copy, ledger = ledger − new barcode only)', async () => {
        await addOrUpdateEntry(NEW, PHONE, 5, 0);
        await sleep(20);
        syncLocalViewFromServer();
        const outcome = await removeSingleBarcode('itemI', NEW);
        expect(outcome).toBe('done');
        await sleep(40);
        expect(getPath(DAILY + '/' + today).codDollar).toBe(20);
        expect(deductedTrashCopiesOf(OLD)).toBe(1);
        expect(deductedTrashCopiesOf(NEW)).toBe(1);
        expect(getPath(HISTORY + '/itemI')).toBeNull();
    }, 20000);

    it('3. the same door through the ZTO list import lanes writes only the imported barcode', async () => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
            url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
        appLocalStore.setItem('zoew_zto_listsync_v1', '1');
        clearZtoPickupStatusStore();
        dbListenerPendingPaths.clear();
        dbListenerFailedPaths.clear();
        ztoState.ztoListSyncInFlight = false;
        uiState.isModalOpen = false;
        for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
            const input = document.createElement('input');
            input.value = today;
            refTo(name)(input);
        }
        const at = today + ' 10:15:00';
        ztoState.ztoListSyncResult = { rows: [{ barcode: 'ZTL100001', phone: PHONE, cod: 7, dod: 0, at, ztoClosed: null, skip: '', from: 'cn' }],
            signedRows: [], from: today, to: today, total: 1 } as any;
        try {
            await importZtoListRows();
            await sleep(30);
            const server = getPath(HISTORY + '/itemI');
            expect(codesOf(server)).toEqual(['ZTL100001']);
            expect(server.cod).toBe(7);
            expect(getPath(TRASH + '/trashT').barcodes[0].isDeducted).toBe(true);
            expect(deductedTrashCopiesOf(OLD)).toBe(1);
        } finally {
            refTo('ztoListSyncFrom')(null);
            refTo('ztoListSyncTo')(null);
            appLocalStore.clear();
        }
    }, 20000);

    it('4. reverse ៖ the server still holds the item ➜ the barcode merges into it (both barcodes stay)', async () => {
        setPath(HISTORY + '/itemI', seedStaleItem());
        const status = await addOrUpdateEntry(NEW, PHONE, 5, 0);
        expect(status).toBe(true);
        const server = getPath(HISTORY + '/itemI');
        expect(codesOf(server)).toEqual([OLD, NEW]);
        expect(server.count).toBe(2);
        expect(server.cod).toBe(15);
        expect(server.createdAt).toBe(staleCreatedAt);
        expect(server.locker).toBe('L-07');
        expect(getPath(DAILY + '/' + today).codDollar).toBe(25);
    }, 20000);

    it('5. cold cache ៖ the first run sees null while the server holds the item ➜ the null-run proposal carries only the new barcode and the rerun merges', async () => {
        setPath(HISTORY + '/itemI', seedStaleItem());
        lab.coldPaths.add(HISTORY + '/itemI');
        const status = await addOrUpdateEntry(NEW, PHONE, 5, 0);
        expect(status).toBe(true);
        const proposals = historyProposals();
        expect(proposals.length).toBe(2);
        expect(proposals[0].seen).toBeNull();
        expect(codesOf(proposals[0].next)).toEqual([NEW]);
        expect(codesOf(proposals[1].seen)).toEqual([OLD]);
        const server = getPath(HISTORY + '/itemI');
        expect(codesOf(server)).toEqual([OLD, NEW]);
        expect(server.cod).toBe(15);
        expect(getPath(DAILY + '/' + today).codDollar).toBe(25);
        expect(getPath(DAILY + '/' + today).totalCount).toBe(2);
    }, 20000);

    it('6. cold cache + the server already holds the barcode ➜ duplicate verdict, ledger reverted (no state leaks between runs)', async () => {
        const held = seedStaleItem();
        held.barcodes.push({ ...seedOldBarcode(), code: NEW, cod: 5, createdAt: staleCreatedAt + 1000 });
        held.count = 2;
        held.cod = 15;
        held.price = 15;
        setPath(HISTORY + '/itemI', held);
        lab.coldPaths.add(HISTORY + '/itemI');
        const status = await addOrUpdateEntry(NEW, PHONE, 5, 0);
        expect(status).toBeNull();
        expect(historyProposals().length).toBe(2);
        expect(codesOf(getPath(HISTORY + '/itemI'))).toEqual([OLD, NEW]);
        await sleep(40);
        expect(getPath(DAILY + '/' + today).codDollar).toBe(20);
        expect(getPath(DAILY + '/' + today).totalCount).toBe(1);
        expect(uiState.toasts.some((t: any) => String(t && t.msg || t).includes('មានក្នុងប្រព័ន្ធរួចហើយ'))).toBe(true);
    }, 20000);
});
