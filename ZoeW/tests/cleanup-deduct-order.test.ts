import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { CLEANUP_JOURNAL_KEY } from '../src/core/storage-keys';
import { dbListenerFailedPaths, dbListenerPendingPaths, DB_LISTENER_KEY_HISTORY } from '../src/core/text';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, noteCleanupJournalEntry, readCleanupJournal, resumeCleanupJournalEntry } from '../src/domain/cleanup';
import { activeRestoreClaims, executeRestoreItem } from '../src/features/restore';
import { ABANDON_AGE_MS } from '../src/features/session';

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const MONTH = '2026-09';
const ID = 'id_x';
const HOST = 'https://shop.firebaseio.com';

type TxHook = (info: { path: string; prior: any; proposed: any; apply: () => void }) => any;
const lab = {
    store: {} as Record<string, any>,
    tx: [] as { path: string; prior: any; proposed: any }[],
    hook: null as TxHook | null,
    beforeTx: null as ((path: string) => void) | null
};

function clone<T>(value: T): T {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
}
function split(path: string) {
    return String(path || '').split('/').filter(Boolean);
}
function getAt(path: string) {
    let cur: any = lab.store;
    for (const key of split(path)) {
        if (cur === null || cur === undefined || typeof cur !== 'object') return null;
        cur = cur[key];
    }
    return cur === undefined ? null : clone(cur);
}
function prune(node: any): any {
    if (node === null || node === undefined) return null;
    if (typeof node !== 'object') return node;
    const out: any = Array.isArray(node) ? [] : {};
    let keys = 0;
    for (const key of Object.keys(node)) {
        const value = prune(node[key]);
        if (value === null || value === undefined) continue;
        out[key] = value;
        keys++;
    }
    return keys ? out : null;
}
function setAt(path: string, value: any) {
    const parts = split(path);
    if (!parts.length) { lab.store = prune(clone(value)) || {}; return; }
    let cur: any = lab.store;
    for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === null || cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    const next = prune(clone(value));
    if (next === null) delete cur[parts[parts.length - 1]]; else cur[parts[parts.length - 1]] = next;
    lab.store = prune(lab.store) || {};
}
const INC = '__inc__';
function makeRef(path = '') {
    const p = split(path).join('/');
    return { path: p, key: split(p).pop() || null, toString: () => HOST + '/' + p };
}
function snap(ref: any, value: any) {
    return { key: ref && ref.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined };
}
function makeFb() {
    return {
        ref: (_db: any, path = '') => makeRef(path),
        increment: (n: number) => ({ [INC]: n }),
        get: async (ref: any) => snap(ref, getAt(ref.path)),
        update: async (ref: any, updates: any) => {
            for (const key of Object.keys(updates)) {
                const path = [ref.path, key].filter(Boolean).join('/');
                let value = updates[key];
                if (value && typeof value === 'object' && value[INC] !== undefined) value = (Number(getAt(path)) || 0) + value[INC];
                setAt(path, value);
            }
        },
        set: async (ref: any, value: any) => { setAt(ref.path, value); },
        runTransaction: async (ref: any, updater: any) => {
            if (lab.beforeTx) lab.beforeTx(ref.path);
            const prior = getAt(ref.path);
            const proposed = updater(clone(prior));
            lab.tx.push({ path: ref.path, prior: clone(prior), proposed: clone(proposed) });
            if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
            const apply = () => setAt(ref.path, proposed);
            if (lab.hook) {
                const out = lab.hook({ path: ref.path, prior, proposed, apply });
                if (out !== undefined) return out;
            }
            apply();
            return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
        },
        onValue: () => () => {},
        off: () => {}
    };
}
const ledgerPath = (path: string) => [DAILY, MONTHLY].some((root) => path === root || path.startsWith(root + '/'));
const hangLedger: TxHook = ({ path }) => (ledgerPath(path) ? new Promise(() => {}) : undefined);
const rejectLedger: TxHook = ({ path }) => (ledgerPath(path) ? Promise.reject(Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' })) : undefined);
const flush = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };

function barcode(code: string, cod: number, createdAt: number) {
    return { code, time: '08:00:00 (' + DAY + ')', cod, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt };
}
function seed(items: any[]) {
    lab.store = {
        [HISTORY]: Object.fromEntries(items.map((it) => [it.id, clone(it)])),
        [TRASH]: {},
        [DAILY]: { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } },
        [MONTHLY]: { [MONTH]: { codDollar: 100, dodDollar: 0, totalCount: 10 } }
    };
    firebaseState.db = { name: 'test-db' } as any;
    firebaseState.fb = makeFb() as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.auth = { currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.dbRefHistory = makeRef(HISTORY) as any;
    firebaseState.dbRefDeleted = makeRef(TRASH) as any;
    firebaseState.dbRefDailyRevenue = makeRef(DAILY) as any;
    firebaseState.dbRefMonthlyRevenue = makeRef(MONTHLY) as any;
    firebaseState.dbRefDailyPickup = makeRef('zoew_daily_pickup_cod_dod') as any;
    firebaseState.dbRefDailyCollected = makeRef('zoew_daily_collected_cod_dod') as any;
    dataState.scanHistory = items.map((it) => clone(it));
    dataState.deletedItems = [];
    dataState.dailyRevenueData = clone(lab.store[DAILY]);
    dataState.monthlyRevenueData = clone(lab.store[MONTHLY]);
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
}
function expiredItem(id = ID) {
    const old = getServerNow() - ABANDON_AGE_MS - 3600000;
    const a = barcode('A', 10, old);
    return { id, phone: '012', scanDate: DAY, time: a.time, createdAt: old, count: 1, cod: 10, dod: 0, price: 10, isClosed: false, isCalled: false, barcode: 'A', barcodes: [a] };
}
function syncLocalViewsFromServer() {
    dataState.scanHistory = Object.values(getAt(HISTORY) || {}).map((v: any) => clone(v));
    dataState.deletedItems = Object.values(getAt(TRASH) || {}).map((v: any) => clone(v));
}
async function restoreOnOtherDevice(trashId: string, token?: string) {
    syncLocalViewsFromServer();
    if (token) activeRestoreClaims.set(trashId, { token, targetId: null });
    uiState.pendingRestoreId = trashId;
    await executeRestoreItem();
    await flush();
}
const ledger = () => getAt(DAILY + '/' + DAY);
const month = () => getAt(MONTHLY + '/' + MONTH);
const journalStage = () => (readCleanupJournal()[0] || {}).stage;
const toastTexts = () => (uiState.toasts || []).map((t: any) => String(t && t.msg || t));

beforeEach(() => {
    lab.tx = [];
    lab.hook = null;
    lab.beforeTx = null;
    uiState.toasts = [];
    try { localStorage.clear(); } catch {}
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    activeRestoreClaims.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    (window as any).ZoeErrors = { capture: vi.fn() };
    vi.stubGlobal('confirm', () => true);
    firebaseState.authGeneration++;
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

describe('7-day cleanup ៖ the trash flag follows the money (isDeducted:true only after the ledger deduction lands)', () => {
    it('1. the ledger never lands (app dies) ➜ trash holds isDeducted:false ➜ a restore elsewhere adds nothing (100) ➜ resume reports unverified, money untouched', async () => {
        seed([expiredItem()]);
        lab.hook = hangLedger;
        claimAndCleanupItem(ID, 'abandon');
        await flush();
        const trash = getAt(TRASH + '/' + ID);
        expect(trash).not.toBeNull();
        expect(trash.barcodes[0].isDeducted).toBe(false);
        expect(journalStage()).toBe('ledger');
        expect(ledger().codDollar).toBe(100);
        const journalRaw = localStorage.getItem(CLEANUP_JOURNAL_KEY);
        lab.hook = null;
        await restoreOnOtherDevice(ID);
        expect(getAt(HISTORY + '/' + ID).barcodes[0].isDeducted).toBe(false);
        expect(ledger().codDollar).toBe(100);
        expect(month().codDollar).toBe(100);
        localStorage.setItem(CLEANUP_JOURNAL_KEY, journalRaw as string);
        cleanupJournalLive.clear();
        const outcome = await resumeCleanupJournalEntry(ID);
        expect(outcome).toBe('unverified');
        expect(ledger().codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('2. reverse ៖ the normal path ends with isDeducted:true · ledger 90 · journal empty · a later restore adds the 10 back (100)', async () => {
        seed([expiredItem()]);
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(ledger().codDollar).toBe(90);
        expect(ledger().totalCount).toBe(9);
        expect(readCleanupJournal().length).toBe(0);
        await restoreOnOtherDevice(ID);
        expect(ledger().codDollar).toBe(100);
        expect(ledger().totalCount).toBe(10);
    }, 20000);

    it('3. the ledger rejects (never deducted) ➜ trash stays isDeducted:false ➜ a restore adds nothing (100)', async () => {
        seed([expiredItem()]);
        lab.hook = rejectLedger;
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(false);
        expect(ledger().codDollar).toBe(100);
        expect(toastTexts().some((t) => t.includes('មិនទាន់ Sync'))).toBe(true);
        lab.hook = null;
        await restoreOnOtherDevice(ID);
        expect(ledger().codDollar).toBe(100);
        expect(month().codDollar).toBe(100);
    }, 20000);

    it('4. the flip meets a live restore claim ➜ the journal waits (stage flip) ➜ the restore adds nothing ➜ resume adds the deduction back (100)', async () => {
        seed([expiredItem()]);
        let injected = false;
        lab.beforeTx = (path) => {
            if (injected || path !== TRASH + '/' + ID) return;
            const item = getAt(path);
            if (!item) return;
            injected = true;
            setAt(path + '/restoreClaim', { token: 'tokB', claimedAt: getServerNow(), targetId: ID });
        };
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(injected).toBe(true);
        expect(ledger().codDollar).toBe(90);
        expect(journalStage()).toBe('flip');
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(false);
        await restoreOnOtherDevice(ID, 'tokB');
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(ledger().codDollar).toBe(90);
        syncLocalViewsFromServer();
        const outcome = await resumeCleanupJournalEntry(ID);
        await flush();
        expect(outcome).toBe('');
        expect(ledger().codDollar).toBe(100);
        expect(ledger().totalCount).toBe(10);
        expect(month().codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('5. stage flip ➜ the claim was released (restore gave up) ➜ resume flips isDeducted:true · money untouched (90)', async () => {
        seed([expiredItem()]);
        let injected = false;
        lab.beforeTx = (path) => {
            if (injected || path !== TRASH + '/' + ID || !getAt(path)) return;
            injected = true;
            setAt(path + '/restoreClaim', { token: 'tokB', claimedAt: getServerNow(), targetId: ID });
        };
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(journalStage()).toBe('flip');
        setAt(TRASH + '/' + ID + '/restoreClaim', null);
        syncLocalViewsFromServer();
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(ledger().codDollar).toBe(90);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('6. stage flip ➜ trash gone and the barcode is not back in history (purged) ➜ money stays deducted · a stale history view waits', async () => {
        seed([expiredItem()]);
        let injected = false;
        lab.beforeTx = (path) => {
            if (injected || path !== TRASH + '/' + ID || !getAt(path)) return;
            injected = true;
            setAt(path + '/restoreClaim', { token: 'tokB', claimedAt: getServerNow(), targetId: ID });
        };
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(journalStage()).toBe('flip');
        setAt(TRASH + '/' + ID, null);
        syncLocalViewsFromServer();
        dbListenerPendingPaths.add(DB_LISTENER_KEY_HISTORY);
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        expect(readCleanupJournal().length).toBe(1);
        expect(ledger().codDollar).toBe(90);
        dbListenerPendingPaths.clear();
        dataState.deletedItems = [{ id: ID }];
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        expect(readCleanupJournal().length).toBe(1);
        dataState.deletedItems = [];
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        expect(ledger().codDollar).toBe(90);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('7. stage moved ➜ trash absent but the barcode is back in history (restored before the ledger step) ➜ no trash rewrite · no deduction', async () => {
        const item = expiredItem();
        const deletedAt = getServerNow() - 60000;
        const restored: any = clone(item);
        restored.barcodes[0].restoredAt = getServerNow();
        seed([restored]);
        const trashItem = { ...clone(item), deletedAt, isFromDeletion: false, trashReason: 'expired', barcodes: item.barcodes.map((b) => ({ ...b, isDeducted: false })) };
        noteCleanupJournalEntry({ id: ID, reason: 'abandon', journalAt: deletedAt, stage: 'moved', trashItem, revenue: { scanDate: DAY, cod: 10, dod: 0, count: 1 } });
        syncLocalViewsFromServer();
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(ledger().codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('8. reverse ៖ stage moved ➜ trash absent and the barcode is not in history (the trash write never landed) ➜ trash rewritten · deducted once · flipped', async () => {
        const item = expiredItem();
        seed([]);
        const trashItem = { ...clone(item), deletedAt: getServerNow(), isFromDeletion: false, trashReason: 'expired', barcodes: item.barcodes.map((b) => ({ ...b, isDeducted: false })) };
        noteCleanupJournalEntry({ id: ID, reason: 'abandon', journalAt: getServerNow(), stage: 'moved', trashItem, revenue: { scanDate: DAY, cod: 10, dod: 0, count: 1 } });
        syncLocalViewsFromServer();
        expect(await resumeCleanupJournalEntry(ID)).toBe('restored');
        await flush();
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(ledger().codDollar).toBe(90);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('8b. stage moved ➜ trash absent · the local view still holds the cleaned item without restore evidence ➜ not a restore ➜ trash rewritten · deducted once', async () => {
        const item = expiredItem();
        seed([]);
        dataState.scanHistory = [clone(item)];
        const trashItem = { ...clone(item), deletedAt: getServerNow(), isFromDeletion: false, trashReason: 'expired', barcodes: item.barcodes.map((b) => ({ ...b, isDeducted: false })) };
        noteCleanupJournalEntry({ id: ID, reason: 'abandon', journalAt: getServerNow(), stage: 'moved', trashItem, revenue: { scanDate: DAY, cod: 10, dod: 0, count: 1 } });
        expect(await resumeCleanupJournalEntry(ID)).toBe('restored');
        await flush();
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(ledger().codDollar).toBe(90);
    }, 20000);

    it('9. an entry journaled by the previous version (trash isDeducted:true) at stage moved, restored elsewhere with +10 ➜ deduct only, no duplicate trash (100)', async () => {
        const item = expiredItem();
        const restored: any = clone(item);
        restored.barcodes[0].restoredAt = getServerNow();
        seed([restored]);
        lab.store[DAILY][DAY].codDollar = 110;
        lab.store[DAILY][DAY].totalCount = 11;
        lab.store[MONTHLY][MONTH].codDollar = 110;
        lab.store[MONTHLY][MONTH].totalCount = 11;
        const trashItem = { ...clone(item), deletedAt: getServerNow(), isFromDeletion: false, trashReason: 'expired', barcodes: item.barcodes.map((b) => ({ ...b, isDeducted: true })) };
        noteCleanupJournalEntry({ id: ID, reason: 'abandon', journalAt: getServerNow(), stage: 'moved', trashItem, revenue: { scanDate: DAY, cod: 10, dod: 0, count: 1 } });
        syncLocalViewsFromServer();
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(ledger().codDollar).toBe(100);
        expect(ledger().totalCount).toBe(10);
        expect(month().codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('10. partial abandon (one old barcode, one fresh) ➜ the old barcode lands in trash flipped to isDeducted:true · ledger −old only', async () => {
        const item: any = expiredItem();
        const fresh: any = barcode('B', 5, getServerNow() - 3600000);
        fresh.restoredAt = getServerNow() - 3600000;
        item.barcodes.push(fresh);
        item.count = 2;
        item.cod = 15;
        item.price = 15;
        seed([item]);
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        const left = getAt(HISTORY + '/' + ID);
        expect(left.barcodes.map((b: any) => b.code)).toEqual(['B']);
        const trash = Object.values(getAt(TRASH) || {}) as any[];
        expect(trash.length).toBe(1);
        expect(trash[0].barcodes.map((b: any) => [b.code, b.isDeducted])).toEqual([['A', true]]);
        expect(ledger().codDollar).toBe(90);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);
});
