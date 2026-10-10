import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, cleanupLedgerKeyOf, noteCleanupJournalEntry, readCleanupJournal, resumeCleanupJournalEntry } from '../src/domain/cleanup';
import { deleteSingleItem } from '../src/features/entry-ops';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { ABANDON_AGE_MS, TWO_HOURS_MS } from '../src/features/session';

// ⛔ «បញ្ចូលទៅក្នុងធាតុដែលបាត់» (`mergeBarcodeIntoHistoryItem()` ៖ server ឃើញ null ➜ ធាតុថ្មីក្រោម id ចាស់) បង្កើត history/<id> ម្តងទៀត
//    ខណៈ trash/<id> នៅកាន់ច្បាប់ចម្លងនៃជីវិតមុន (លុប · ផុតកំណត់ · យករួច) ➜ slot របស់ id នោះមិនទំនេរ ហើយម្ចាស់វាមិនមែនជាការ claim ដដែលទេ
//    (barcode ខុសគ្នាទាំងស្រុង)។ ការសម្អាតមិនត្រូវបោះ barcode ដែល claim ចោល (មិននៅប្រវត្តិ · មិននៅធុងសំរាម · មិនដកលុយ) ហើយការលុបមិនត្រូវ
//    សរសេរជាន់ច្បាប់ចម្លងចាស់ទេ។
const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const MONTH = '2026-09';
const ID = 'id_1758000000000_old0x';
const FIREBASE_HOST = 'https://shop.firebaseio.com';

type TxHook = (info: { path: string; prior: any; proposed: any; apply: () => void }) => any;
const lab = { store: {} as Record<string, any>, tx: [] as { path: string; prior: any; proposed: any }[], updates: [] as string[], hook: null as TxHook | null };

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
    return { path: p, key: split(p).pop() || null, toString: () => FIREBASE_HOST + '/' + p };
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

function barcodeOf(code: string, cod: number, opts: { closedAt?: number; createdAt: number; deducted?: boolean }) {
    const b: any = { code, time: '08:00:00 (' + DAY + ')', cod, dod: 0, locker: 'N/A', isClosed: typeof opts.closedAt === 'number', isDeducted: !!opts.deducted, isFromDeletion: false, createdAt: opts.createdAt };
    if (typeof opts.closedAt === 'number') b.closedAt = opts.closedAt;
    return b;
}
function recreatedItem(reason: 'abandon' | 'close') {
    const now = getServerNow();
    const closed = reason === 'close';
    const createdAt = closed ? now - 3600000 : now - ABANDON_AGE_MS - 3600000;
    const closedAt = closed ? now - TWO_HOURS_MS - 60000 : undefined;
    const c = barcodeOf('C', 7, { closedAt, createdAt });
    const item: any = { id: ID, phone: '012', scanDate: DAY, time: c.time, createdAt, count: 1, cod: 7, dod: 0, price: 7, isClosed: closed, isCalled: false, barcode: 'C', barcodes: [c] };
    if (closed) item.closedAt = closedAt;
    return item;
}
function oldLifecycleCopy(trashReason: 'delete' | 'expired' | 'pickup') {
    const at = getServerNow() - 3 * 3600000;
    const a = barcodeOf('A', 10, { createdAt: at - 3600000, deducted: trashReason === 'expired', closedAt: trashReason === 'pickup' ? at - 60000 : undefined });
    a.isFromDeletion = trashReason !== 'expired';
    return { id: ID, phone: '012', scanDate: DAY, time: a.time, createdAt: at - 3600000, count: 1, cod: 10, dod: 0, price: 10, barcode: 'A', barcodes: [a],
        isClosed: trashReason === 'pickup', deletedAt: at, isFromDeletion: trashReason !== 'expired', trashReason };
}
function install(reason: 'abandon' | 'close', occupant: 'delete' | 'expired' | 'pickup') {
    const item = recreatedItem(reason);
    const old = oldLifecycleCopy(occupant);
    lab.store = {
        [HISTORY]: { [ID]: clone(item) },
        [TRASH]: { [ID]: clone(old) },
        [DAILY]: { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } },
        [MONTHLY]: { [MONTH]: { codDollar: 100, dodDollar: 0, totalCount: 10 } }
    };
    firebaseState.db = { name: 'test-db' } as any;
    firebaseState.fb = makeFb() as any;
    firebaseState.firebaseConfig = { databaseURL: FIREBASE_HOST } as any;
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
    dataState.deletedItems = [clone(old)];
    dataState.dailyRevenueData = clone(lab.store[DAILY]);
    dataState.monthlyRevenueData = clone(lab.store[MONTHLY]);
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
    return { item, old };
}
const flush = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };
const trashCopiesOf = (code: string): any[] => Object.values(getAt(TRASH) || {}).filter((t: any) => t && Array.isArray(t.barcodes) && t.barcodes.some((b: any) => b && b.code === code));
const historyCodes = (): string[] => Object.values(getAt(HISTORY) || {}).flatMap((t: any) => (t && Array.isArray(t.barcodes) ? t.barcodes.map((b: any) => b.code) : []));

beforeEach(() => {
    lab.tx = [];
    lab.updates = [];
    lab.hook = null;
    uiState.toasts = [];
    try { localStorage.clear(); } catch {}
    (window as any).ZoeErrors = { capture: vi.fn() };
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    vi.stubGlobal('confirm', () => true);
    firebaseState.authGeneration++;
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

describe('cleanup of an item recreated under an id whose trash slot holds another lifecycle', () => {
    it('1. abandon (8 days) · trash/<id> = the old item deleted by hand ➜ C lands in trash «expired» · deducted once · the old copy untouched', async () => {
        const { old } = install('abandon', 'delete');
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(historyCodes()).not.toContain('C');
        const copies = trashCopiesOf('C');
        expect(copies.length).toBe(1);
        expect(copies[0].id).not.toBe(ID);
        expect(copies[0].trashReason).toBe('expired');
        expect(copies[0].barcodes[0].isDeducted).toBe(true);
        expect(getAt(TRASH + '/' + ID)).toEqual(prune(clone(old)));
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(93);
        expect(getAt(DAILY + '/' + DAY).totalCount).toBe(9);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(93);
        expect(getAt(DAILY + '/' + DAY).ded[copies[0].id].at).toBe(copies[0].deletedAt);
        expect(readCleanupJournal().length).toBe(0);
        expect(cleanupJournalLive.size).toBe(0);
        expect(dataState.deletedItems.filter((t) => t && t.id === copies[0].id).length).toBe(1);
        dataState.dailyRevenueData = clone(getAt(DAILY));
        expect(cleanupLedgerKeyOf(copies[0])).toEqual({ scanDate: DAY });
    }, 20000);

    it('2. close (2 hours) · trash/<id> = the old expired copy ➜ C lands in trash «pickup» · money untouched · the old copy untouched', async () => {
        const { old } = install('close', 'expired');
        await claimAndCleanupItem(ID, 'close');
        await flush();
        expect(historyCodes()).not.toContain('C');
        const copies = trashCopiesOf('C');
        expect(copies.length).toBe(1);
        expect(copies[0].id).not.toBe(ID);
        expect(copies[0].trashReason).toBe('pickup');
        expect(getAt(TRASH + '/' + ID)).toEqual(prune(clone(old)));
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
        expect(cleanupJournalLive.size).toBe(0);
    }, 20000);

    it('3. two devices claim the recreated item (the late one resolves «applied») ➜ both pick the same moved slot ➜ one copy · one deduction', async () => {
        const { item } = install('abandon', 'delete');
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(trashCopiesOf('C').length).toBe(1);
        dataState.deletedItems = [];
        dataState.scanHistory = [clone(item)];
        dataState.dailyRevenueData = clone(getAt(DAILY));
        dataState.monthlyRevenueData = clone(getAt(MONTHLY));
        const realTx = firebaseState.fb.runTransaction;
        let staleOnce = true;
        (firebaseState.fb as any).runTransaction = async (ref: any, updater: any) => {
            if (ref.path === HISTORY + '/' + ID && staleOnce) {
                staleOnce = false;
                const proposed = updater(clone(item));
                return proposed === null ? { committed: true, snapshot: snap(ref, null), txOutcome: 'applied' } : { committed: false, snapshot: snap(ref, null) };
            }
            return realTx(ref, updater);
        };
        await claimAndCleanupItem(ID, 'abandon');
        await flush(60);
        expect(trashCopiesOf('C').length).toBe(1);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(93);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(93);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('4. resume «slot» (the app died after the claim, before the trash write) · trash/<id> = another lifecycle ➜ moved slot · deducted once · the old copy untouched', async () => {
        const { item, old } = install('abandon', 'delete');
        setAt(HISTORY + '/' + ID, null);
        dataState.scanHistory = [];
        const trashItem = { ...clone(item), deletedAt: getServerNow() - 5000, isFromDeletion: false, trashReason: 'expired',
            barcodes: item.barcodes.map((b: any) => ({ ...b, isDeducted: false })) };
        noteCleanupJournalEntry({ id: ID, reason: 'abandon', journalAt: trashItem.deletedAt, stage: 'slot', trashItem, revenue: { scanDate: DAY, cod: 7, dod: 0, count: 1 } });
        expect(await resumeCleanupJournalEntry(ID)).toBe('restored');
        await flush();
        const copies = trashCopiesOf('C');
        expect(copies.length).toBe(1);
        expect(copies[0].id).not.toBe(ID);
        expect(copies[0].barcodes[0].isDeducted).toBe(true);
        expect(getAt(TRASH + '/' + ID)).toEqual(prune(clone(old)));
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(93);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('5. resume «slot» · history/<id> was recreated with other barcodes (not ours) ➜ not evidence that the claim came back ➜ C lands in trash · deducted once', async () => {
        const { item } = install('abandon', 'delete');
        setAt(TRASH + '/' + ID, null);
        dataState.deletedItems = [];
        const fresh = { ...clone(item), barcodes: [barcodeOf('D', 3, { createdAt: getServerNow() })], barcode: 'D', cod: 3, price: 3, createdAt: getServerNow() };
        setAt(HISTORY + '/' + ID, fresh);
        dataState.scanHistory = [clone(fresh)];
        const trashItem = { ...clone(item), deletedAt: getServerNow() - 5000, isFromDeletion: false, trashReason: 'expired',
            barcodes: item.barcodes.map((b: any) => ({ ...b, isDeducted: false })) };
        noteCleanupJournalEntry({ id: ID, reason: 'abandon', journalAt: trashItem.deletedAt, stage: 'slot', trashItem, revenue: { scanDate: DAY, cod: 7, dod: 0, count: 1 } });
        expect(await resumeCleanupJournalEntry(ID)).toBe('restored');
        await flush();
        expect(trashCopiesOf('C').length).toBe(1);
        expect(trashCopiesOf('C')[0].barcodes[0].isDeducted).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(93);
        expect(historyCodes()).toEqual(['D']);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('6. reverse ៖ the slot holds a copy of the same barcodes (an identical claim from another device) ➜ still «elsewhere» · nothing moved · no deduction', async () => {
        const { item } = install('abandon', 'delete');
        const twin = { ...clone(item), deletedAt: getServerNow() - 1000, isFromDeletion: false, trashReason: 'expired',
            barcodes: item.barcodes.map((b: any) => ({ ...b, isDeducted: true })) };
        setAt(TRASH + '/' + ID, twin);
        dataState.deletedItems = [clone(twin)];
        lab.hook = ({ path, apply }) => {
            if (path !== HISTORY + '/' + ID) return undefined;
            apply();
            return { committed: true, snapshot: snap(makeRef(path), getAt(path)), txOutcome: 'applied' };
        };
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(trashCopiesOf('C').length).toBe(1);
        expect(getAt(TRASH + '/' + ID).deletedAt).toBe(twin.deletedAt);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);
});

describe('Delete (លុប) of an item recreated under an id whose trash slot holds another lifecycle', () => {
    it('7. trash/<id> = the old expired copy (deducted) ➜ the delete copy lands beside it · the old copy untouched · money untouched', async () => {
        const { old } = install('abandon', 'expired');
        dataState.scanHistory[0].createdAt = getServerNow();
        await deleteSingleItem(ID);
        await flush();
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        expect(getAt(TRASH + '/' + ID)).toEqual(prune(clone(old)));
        const copies = trashCopiesOf('C');
        expect(copies.length).toBe(1);
        expect(copies[0].trashReason).toBe('delete');
        expect(copies[0].isFromDeletion).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(dataState.deletedItems.filter((t) => t && t.id === copies[0].id).length).toBe(1);
    }, 20000);

    it('8. parity ៖ a free slot still takes the delete copy under the item id', async () => {
        install('abandon', 'delete');
        setAt(TRASH + '/' + ID, null);
        dataState.deletedItems = [];
        await deleteSingleItem(ID);
        await flush();
        expect(getAt(TRASH + '/' + ID).trashReason).toBe('delete');
        expect(trashCopiesOf('C').length).toBe(1);
    }, 20000);
});
