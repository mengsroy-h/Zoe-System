import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, noteCleanupJournalEntry, readCleanupJournal, resumeCleanupJournalEntry } from '../src/domain/cleanup';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { ABANDON_AGE_MS, TWO_HOURS_MS } from '../src/features/session';

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const MONTH = '2026-09';
const ID = 'id_x';
const FIREBASE_HOST = 'https://shop.firebaseio.com';

type TxHook = (info: { path: string; prior: any; proposed: any; apply: () => void }) => any;
const lab = { store: {} as Record<string, any>, tx: [] as { path: string; prior: any; proposed: any }[], updates: [] as string[], hook: null as TxHook | null, refScheme: 'firebase' as 'firebase' | 'supabase' };

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
    return { path: p, key: split(p).pop() || null, toString: () => (lab.refScheme === 'supabase' ? 'supabase:' + p : FIREBASE_HOST + '/' + p) };
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
                lab.updates.push(path);
            }
        },
        runTransaction: async (ref: any, updater: any) => {
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
const appliedAfterLostReply: TxHook = ({ path, apply }) => {
    if (path !== HISTORY + '/' + ID) return undefined;
    apply();
    return { committed: true, snapshot: { val: () => getAt(path), exists: () => getAt(path) !== null }, txOutcome: 'applied' };
};
function seedItem(reason: 'abandon' | 'close') {
    const now = getServerNow();
    const closed = reason === 'close';
    const createdAt = closed ? now - 3600000 : now - ABANDON_AGE_MS - 3600000;
    const closedAt = closed ? now - TWO_HOURS_MS - 60000 : undefined;
    const barcode: any = { code: 'A', time: '08:00:00 (' + DAY + ')', cod: 10, dod: 0, locker: 'N/A', isClosed: closed, isDeducted: false, isFromDeletion: false, createdAt };
    if (closed) barcode.closedAt = closedAt;
    const item: any = { id: ID, phone: '012', scanDate: DAY, time: barcode.time, createdAt, count: 1, cod: 10, dod: 0, price: 10, isClosed: closed, isCalled: false, barcode: 'A', barcodes: [barcode] };
    if (closed) item.closedAt = closedAt;
    return item;
}
function install(reason: 'abandon' | 'close', scheme: 'firebase' | 'supabase') {
    lab.refScheme = scheme;
    const item = seedItem(reason);
    lab.store = {
        [HISTORY]: { [ID]: clone(item) },
        [TRASH]: {},
        [DAILY]: { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } },
        [MONTHLY]: { [MONTH]: { codDollar: 100, dodDollar: 0, totalCount: 10 } }
    };
    firebaseState.db = { name: 'test-db' } as any;
    firebaseState.fb = makeFb() as any;
    firebaseState.firebaseConfig = (scheme === 'supabase'
        ? { supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'sb_publishable_x' }
        : { databaseURL: FIREBASE_HOST }) as any;
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
    dataState.scanHistory = [clone(item)];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = clone(lab.store[DAILY]);
    dataState.monthlyRevenueData = clone(lab.store[MONTHLY]);
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
    return item;
}
const flush = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };
const captures = () => ((window as any).ZoeErrors.capture as any).mock.calls.map((c: any[]) => ({ message: String(c[0] && c[0].message), ...(c[1] || {}) }));
const unverifiedCaptures = () => captures().filter((c: any) => /ownership unverified/.test(c.message));
const fetchSpy = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

beforeEach(() => {
    lab.tx = [];
    lab.updates = [];
    lab.hook = null;
    uiState.toasts = [];
    try { localStorage.clear(); } catch {}
    (window as any).ZoeErrors = { capture: vi.fn() };
    fetchSpy.mockClear();
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('confirm', () => true);
    firebaseState.authGeneration++;
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

describe('automatic cleanup whose claim reply was lost (txOutcome applied) decides ownership by the trash slot, never by a REST read', () => {
    it('1. Supabase · abandon whole item · applied ➜ trash written once · ledger deducted once · journal cleared · no «ownership unverified»', async () => {
        install('abandon', 'supabase');
        lab.hook = appliedAfterLostReply;
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        const trash = getAt(TRASH + '/' + ID);
        expect(trash).not.toBeNull();
        expect(trash.trashReason).toBe('expired');
        expect(trash.barcodes[0].isDeducted).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(getAt(DAILY + '/' + DAY).totalCount).toBe(9);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(90);
        expect(readCleanupJournal().length).toBe(0);
        expect(dataState.deletedItems.filter((t) => t && t.id === ID).length).toBe(1);
        expect(unverifiedCaptures().length).toBe(0);
        expect(fetchSpy).not.toHaveBeenCalled();
    }, 20000);

    it('2. Supabase · close (2h) whole item · applied ➜ trash «pickup» written · money untouched · journal cleared', async () => {
        install('close', 'supabase');
        lab.hook = appliedAfterLostReply;
        await claimAndCleanupItem(ID, 'close');
        await flush();
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        const trash = getAt(TRASH + '/' + ID);
        expect(trash).not.toBeNull();
        expect(trash.trashReason).toBe('pickup');
        expect(trash.isFromDeletion).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
        expect(unverifiedCaptures().length).toBe(0);
    }, 20000);

    it('3. reverse ៖ another device already holds trash/<id> · applied ➜ nothing overwritten · no deduction · journal cleared · no duplicate local copy', async () => {
        install('abandon', 'supabase');
        const foreign = { id: ID, trashReason: 'expired', deletedAt: getServerNow() - 1000, isFromDeletion: false, scanDate: DAY, phone: '012', cod: 10, dod: 0, price: 10, count: 1, barcode: 'A',
            barcodes: [{ code: 'A', cod: 10, dod: 0, isClosed: false, isDeducted: true, isFromDeletion: false, time: '08:00:00 (' + DAY + ')', locker: 'N/A' }] };
        setAt(TRASH + '/' + ID, foreign);
        lab.hook = appliedAfterLostReply;
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(TRASH + '/' + ID).deletedAt).toBe(foreign.deletedAt);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
        expect(dataState.deletedItems.filter((t) => t && t.id === ID).length).toBe(0);
        expect(unverifiedCaptures().length).toBe(0);
        expect(lab.updates.filter((p) => p === TRASH + '/' + ID).length).toBe(0);
    }, 20000);

    it('4. Firebase · REST unreachable · applied ➜ trash written · ledger deducted once · no fetch at all', async () => {
        install('abandon', 'firebase');
        lab.hook = appliedAfterLostReply;
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(TRASH + '/' + ID)).not.toBeNull();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(readCleanupJournal().length).toBe(0);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(unverifiedCaptures().length).toBe(0);
    }, 20000);

    it('5. applied · the trash transaction rejects once (network) then commits ➜ trash once · ledger deducted once', async () => {
        install('abandon', 'supabase');
        let trashAttempts = 0;
        lab.hook = (info) => {
            if (info.path === TRASH + '/' + ID && info.prior === null && trashAttempts++ === 0) throw new Error('disconnect');
            return appliedAfterLostReply(info);
        };
        await claimAndCleanupItem(ID, 'abandon');
        await flush(60);
        expect(trashAttempts).toBe(2);
        expect(getAt(TRASH + '/' + ID)).not.toBeNull();
        expect(lab.tx.filter((t) => t.path === TRASH + '/' + ID && t.prior === null && t.proposed !== undefined).length).toBe(2);
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(getAt(DAILY + '/' + DAY).totalCount).toBe(9);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('6. parity ៖ a claim acknowledged normally (no lost reply) still writes the trash by update and deducts once', async () => {
        install('abandon', 'supabase');
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(TRASH + '/' + ID)).not.toBeNull();
        expect(lab.updates.filter((p) => p === TRASH + '/' + ID).length).toBe(1);
        expect(lab.tx.filter((t) => t.path === TRASH + '/' + ID && t.prior === null).length).toBe(0);
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);
    it('7. applied · the app dies after the journal is written, before the slot claim lands ➜ the journal says «slot» (ownership unknown), never «moved»', async () => {
        install('abandon', 'supabase');
        lab.hook = (info) => {
            if (info.path === TRASH + '/' + ID) return new Promise(() => {});
            return appliedAfterLostReply(info);
        };
        claimAndCleanupItem(ID, 'abandon');
        await flush();
        const journal = readCleanupJournal();
        expect(journal.length).toBe(1);
        expect(journal[0].stage).toBe('slot');
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
    }, 20000);

    const slotEntry = (item: any) => {
        const trashItem = { ...clone(item), deletedAt: getServerNow() - 5000, isFromDeletion: false, trashReason: 'expired',
            barcodes: item.barcodes.map((b: any) => ({ ...b, isDeducted: false })) };
        noteCleanupJournalEntry({ id: ID, reason: 'abandon', journalAt: trashItem.deletedAt, stage: 'slot', trashItem,
            revenue: { scanDate: DAY, cod: 10, dod: 0, count: 1 } });
        return trashItem;
    };

    it('8. resume «slot» · another device already holds trash/<id> (its own deletedAt) ➜ no deduction · its copy untouched · journal cleared', async () => {
        const item = install('abandon', 'firebase');
        setAt(HISTORY + '/' + ID, null);
        dataState.scanHistory = [];
        slotEntry(item);
        const foreign = { ...clone(item), deletedAt: getServerNow() - 1000, trashReason: 'expired', isFromDeletion: false,
            barcodes: item.barcodes.map((b: any) => ({ ...b, isDeducted: true })) };
        setAt(TRASH + '/' + ID, foreign);
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        await flush();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(getAt(TRASH + '/' + ID).deletedAt).toBe(foreign.deletedAt);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('9. resume «slot» · our own slot write landed before the app died (same deletedAt) ➜ deducted once · flipped', async () => {
        const item = install('abandon', 'firebase');
        setAt(HISTORY + '/' + ID, null);
        dataState.scanHistory = [];
        const trashItem = slotEntry(item);
        setAt(TRASH + '/' + ID, trashItem);
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(getAt(DAILY + '/' + DAY).totalCount).toBe(9);
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('10. resume «slot» · trash absent and the item is not back in history ➜ slot claimed · deducted once · flipped', async () => {
        const item = install('abandon', 'firebase');
        setAt(HISTORY + '/' + ID, null);
        dataState.scanHistory = [];
        slotEntry(item);
        expect(await resumeCleanupJournalEntry(ID)).toBe('restored');
        await flush();
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('11. resume «slot» · the item is back in history under its id ➜ no trash write · no deduction · journal cleared · a stale view waits', async () => {
        const item = install('abandon', 'firebase');
        slotEntry(item);
        dbListenerPendingPaths.add('history');
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        expect(readCleanupJournal().length).toBe(1);
        dbListenerPendingPaths.clear();
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        await flush();
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);
});
