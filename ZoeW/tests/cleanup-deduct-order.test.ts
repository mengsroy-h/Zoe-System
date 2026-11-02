import { cleanupServerRead } from './helpers/cleanup-server-read';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { CLEANUP_JOURNAL_KEY } from '../src/core/storage-keys';
import { appLocalStore } from '../src/core/storage';
import { trashClaimPolicy } from '../src/domain/trash-claim';
import { dbListenerFailedPaths, dbListenerPendingPaths, DB_LISTENER_KEY_HISTORY } from '../src/core/text';
import { beginCleanupOperation, releaseCleanupOperation, prepareCleanupClaim, cleanupJournalStorageKeys, claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, cleanupResumeBarrier, noteCleanupJournalEntry, readCleanupJournal, resumeCleanupJournalEntry } from '../src/domain/cleanup';
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
    firebaseState.db = { name: 'test-db', app: { options: { databaseURL: HOST } } } as any;
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
function returnedItem(id = ID) {
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

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(cleanupServerRead(getAt)));
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
    it('1. ledger មិនទាន់ឆ្លើយ · restore គ្មាន receipt ត្រូវរង់ចាំ · bucket ចាស់គ្មាន witness រក្សា journal និងមិនប៉ះប្រាក់', async () => {
        seed([returnedItem()]);
        let release = () => {};
        lab.hook = ({ path, prior }) => ledgerPath(path) ? new Promise((resolve) => {
            release = () => resolve({ committed: false, snapshot: snap(makeRef(path), prior) });
        }) : undefined;
        const pending = claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(false);
        expect(journalStage()).toBe('ledger');
        expect(readCleanupJournal()[0].prior).toEqual({ d: [], m: [] });
        expect(ledger().codDollar).toBe(100);
        await restoreOnOtherDevice(ID);
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        expect(getAt(TRASH + '/' + ID)).not.toBeNull();
        expect(ledger().codDollar).toBe(100);
        expect(month().codDollar).toBe(100);
        release();
        await pending;
        expect(readCleanupJournal()).toHaveLength(1);
        lab.hook = null;
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        expect(ledger().codDollar).toBe(100);
        expect(month().codDollar).toBe(100);
        expect(readCleanupJournal()).toHaveLength(1);
        expect(journalStage()).toBe('ledger');
        await resumeCleanupJournalEntry(ID);
        expect(readCleanupJournal()).toHaveLength(1);
        expect(ledger().codDollar).toBe(100);
        expect(month().codDollar).toBe(100);
    }, 20000);

    it('2. reverse ៖ the normal path ends with isDeducted:true · ledger 90 · journal empty · a later restore adds the 10 back (100)', async () => {
        seed([returnedItem()]);
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

    it('3. ledger បដិសេធ · trash មិនទាន់កាត់ · restore គ្មាន receipt ត្រូវរង់ចាំ និងមិនបូកប្រាក់', async () => {
        seed([returnedItem()]);
        lab.hook = rejectLedger;
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(false);
        expect(ledger().codDollar).toBe(100);
        expect(readCleanupJournal()).toHaveLength(1);
        expect(journalStage()).toBe('ledger');
        lab.hook = null;
        await restoreOnOtherDevice(ID);
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        expect(getAt(TRASH + '/' + ID)).not.toBeNull();
        expect(readCleanupJournal()).toHaveLength(1);
        expect(ledger().codDollar).toBe(100);
        expect(month().codDollar).toBe(100);
    }, 20000);

    it('4. flip ជួប restore claim · restore អាន receipt និងបូកវិញ · resume មិនបូកស្ទួន', async () => {
        seed([returnedItem()]);
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
        expect(ledger().codDollar).toBe(100);
        syncLocalViewsFromServer();
        const outcome = await resumeCleanupJournalEntry(ID);
        await flush();
        expect(outcome).toBe('');
        expect(ledger().codDollar).toBe(100);
        expect(ledger().totalCount).toBe(10);
        expect(month().codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(1);
        expect(journalStage()).toBe('flip');
    }, 20000);

    it('5. stage flip ➜ the claim was released (restore gave up) ➜ resume flips isDeducted:true · money untouched (90)', async () => {
        seed([returnedItem()]);
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
        seed([returnedItem()]);
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

    it.each([0, 1])('7. journal ជំនាន់%s គ្មាន trash ប៉ុន្តែ history បានស្តារ៖ legacy HOLD ហើយថ្មីមិនកាត់ប្រាក់', async generation => {
        const item = returnedItem();
        const deletedAt = getServerNow() - 60000;
        const restored: any = clone(item);
        restored.barcodes[0].restoredAt = getServerNow();
        seed([restored]);
        const trashItem = { ...clone(item), trashGeneration: generation, deletedAt, isFromDeletion: false, trashReason: 'returned', barcodes: item.barcodes.map((b) => ({ ...b, isDeducted: false })) };
        noteCleanupJournalEntry({ id: ID, reason: 'abandon', journalAt: deletedAt, stage: 'moved', trashItem, revenue: { scanDate: DAY, cod: 10, dod: 0, count: 1 } });
        syncLocalViewsFromServer();
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(ledger().codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(generation === 0 ? 1 : 0);
    }, 20000);

    it.each([0, 1])('8. journal ជំនាន់%s គ្មាន source៖ legacy HOLD ហើយថ្មីសរសេរ trash និងកាត់ម្ដង', async generation => {
        const item = returnedItem();
        seed([]);
        const trashItem = { ...clone(item), trashGeneration: generation, deletedAt: getServerNow(), isFromDeletion: false, trashReason: 'returned', barcodes: item.barcodes.map((b) => ({ ...b, isDeducted: false })) };
        noteCleanupJournalEntry({ id: ID, reason: 'abandon', journalAt: getServerNow(), stage: 'moved', trashItem, revenue: { scanDate: DAY, cod: 10, dod: 0, count: 1 } });
        syncLocalViewsFromServer();
        expect(await resumeCleanupJournalEntry(ID)).toBe(generation === 0 ? '' : 'restored');
        await flush();
        if (generation === 0) expect(getAt(TRASH + '/' + ID)).toBeNull();
        else expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(ledger().codDollar).toBe(generation === 0 ? 100 : 90);
        expect(month().codDollar).toBe(generation === 0 ? 100 : 90);
        expect(readCleanupJournal().length).toBe(generation === 0 ? 1 : 0);
    }, 20000);

    it.each([0, 1])('8b. journal ជំនាន់%s គ្មាន source និង local history ចាស់៖ legacy HOLD ហើយថ្មីសរសេរ trash', async generation => {
        const item = returnedItem();
        seed([]);
        dataState.scanHistory = [clone(item)];
        const trashItem = { ...clone(item), trashGeneration: generation, deletedAt: getServerNow(), isFromDeletion: false, trashReason: 'returned', barcodes: item.barcodes.map((b) => ({ ...b, isDeducted: false })) };
        noteCleanupJournalEntry({ id: ID, reason: 'abandon', journalAt: getServerNow(), stage: 'moved', trashItem, revenue: { scanDate: DAY, cod: 10, dod: 0, count: 1 } });
        expect(await resumeCleanupJournalEntry(ID)).toBe(generation === 0 ? '' : 'restored');
        await flush();
        if (generation === 0) expect(getAt(TRASH + '/' + ID)).toBeNull();
        else expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(ledger().codDollar).toBe(generation === 0 ? 100 : 90);
        expect(month().codDollar).toBe(generation === 0 ? 100 : 90);
    }, 20000);

    it('10. partial abandon (one old barcode, one fresh) ➜ the old barcode lands in trash flipped to isDeducted:true · ledger −old only', async () => {
        const item: any = returnedItem();
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

    it.each(['claim', 'cleanup'] as const)('12. localStorage ពេញនៅ %s journal ➜ history និង ledger នៅដដែល ដោយមិនដកប្រាក់', async (failedJournal) => {
        seed([returnedItem()]);
        const failedKey = failedJournal === 'claim' ? trashClaimPolicy().storeKey : CLEANUP_JOURNAL_KEY;
        const originalSetItem = (appLocalStore as Storage).setItem.bind(appLocalStore);
        const quota = vi.spyOn(appLocalStore as Storage, 'setItem').mockImplementation((key, value) => {
            if (failedJournal === 'claim' || key.startsWith(failedKey)) throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
            originalSetItem(key, value);
        });
        let journalSeenDuringRun = 0;
        lab.beforeTx = () => { journalSeenDuringRun = Math.max(journalSeenDuringRun, readCleanupJournal().length); };
        expect(() => (appLocalStore as Storage).setItem(failedKey, 'probe')).toThrow();
        quota.mockClear(); // The failed probe must not satisfy the app-write assertion.
        let appWrites: number;
        try {
            await claimAndCleanupItem(ID, 'abandon');
            await flush();
            appWrites = quota.mock.calls.filter((c: any[]) => String(c[0]).startsWith(failedKey)).length;
        } finally {
            quota.mockRestore();
        }
        expect(appWrites).toBeGreaterThan(0);
        if (failedJournal === 'claim') expect(lab.tx).toEqual([]);
        expect(getAt(HISTORY + '/' + ID).barcodes[0].code).toBe('A');
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(ledger().codDollar).toBe(100);
        expect(month().codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
        expect(journalSeenDuringRun).toBe(0);
        expect(cleanupInFlight.size).toBe(0);
    }, 20000);
});


it.each([false, true])('cleanup v2 keeps one final admission across retried updater payloads (partial=%s)', async (partial) => {
    seed([returnedItem()]);
    const owner = beginCleanupOperation(ID);
    const firstItem = getAt(HISTORY + '/' + ID);
    firstItem.barcodes.push({ ...firstItem.barcodes[0], code: 'B', cod: 3 });
    firstItem.count = 2;
    const first = prepareCleanupClaim(ID, 'abandon', partial ? null : firstItem, partial ? firstItem : null, 'local', owner);
    const now = vi.spyOn(Date, 'now').mockReturnValue(first.trashItem.deletedAt + 100);
    try {
        const finalItem = { ...firstItem, barcodes: [firstItem.barcodes[1]], count: 1 };
        const final = prepareCleanupClaim(ID, 'abandon', partial ? null : finalItem, partial ? finalItem : null, 'local', owner);
        expect(final.journalId).toBe(first.journalId);
        expect(final.trashItem.deletedAt).toBe(first.trashItem.deletedAt);
        expect(cleanupJournalStorageKeys()).toHaveLength(1);
        expect(readCleanupJournal().map(entry => entry.trashItem.barcodes.map((barcode: any) => barcode.code))).toEqual([['B']]);
        expect(ledger().codDollar).toBe(100);
        expect(getAt(HISTORY + '/' + ID).barcodes.map((barcode: any) => barcode.code)).toEqual(['A']);
    } finally {
        now.mockRestore();
        releaseCleanupOperation(ID, owner);
        await flush();
        await cleanupResumeBarrier.settled;
    }
    expect(dataState.cleanupResumeInFlight).toBe(false);
    expect(cleanupInFlight.size).toBe(0);
    expect(ledger().codDollar).toBe(100);
    expect(month().codDollar).toBe(100);
    expect(getAt(HISTORY + '/' + ID).barcodes.map((barcode: any) => barcode.code)).toEqual(['A']);
});
