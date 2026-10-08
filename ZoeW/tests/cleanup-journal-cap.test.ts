import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { CLEANUP_JOURNAL_MAX, cleanupInFlight, cleanupJournalLive, readCleanupJournal, resumeInterruptedCleanups, runAutomaticCleanupRules, writeCleanupJournal } from '../src/domain/cleanup';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { ABANDON_AGE_MS } from '../src/features/session';

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const MONTH = '2026-09';
const FIREBASE_HOST = 'https://shop.firebaseio.com';

type TxHook = (info: { path: string; prior: any; proposed: any; apply: () => void }) => any;
const lab = { store: {} as Record<string, any>, tx: [] as { path: string; prior: any; proposed: any }[], updates: [] as string[], hook: null as TxHook | null, refScheme: 'firebase' as 'firebase' | 'supabase', hangTrash: false };

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
            if (lab.hangTrash && ref.path === TRASH) return new Promise(() => {});
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
const OPENING_COD = 1000;
const idOf = (i: number) => 'id_' + String(i).padStart(4, '0');
function seedItems(count: number) {
    const now = getServerNow();
    const createdAt = now - ABANDON_AGE_MS - 3600000;
    const history: Record<string, any> = {};
    for (let i = 0; i < count; i++) {
        const id = idOf(i);
        const code = 'B' + String(i).padStart(4, '0');
        const time = '08:00:00 (' + DAY + ')';
        const barcode: any = { code, time, cod: 1, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt };
        history[id] = { id, phone: '01' + String(i).padStart(7, '0'), scanDate: DAY, time, createdAt, count: 1, cod: 1, dod: 0, price: 1, isClosed: false, isCalled: false, barcode: code, barcodes: [barcode] };
    }
    return history;
}
function install(count: number) {
    lab.refScheme = 'firebase';
    const history = seedItems(count);
    lab.store = {
        [HISTORY]: clone(history),
        [TRASH]: {},
        [DAILY]: { [DAY]: { codDollar: OPENING_COD, dodDollar: 0, totalCount: OPENING_COD } },
        [MONTHLY]: { [MONTH]: { codDollar: OPENING_COD, dodDollar: 0, totalCount: OPENING_COD } }
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
    dataState.scanHistory = Object.values(clone(history));
    dataState.deletedItems = [];
    dataState.dailyRevenueData = clone(lab.store[DAILY]);
    dataState.monthlyRevenueData = clone(lab.store[MONTHLY]);
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
    dataState.cleanupResumeInFlight = false;
}
const flush = async (n = 200) => { for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };
function serverIds(root: string) {
    return Object.keys(getAt(root) || {});
}
function claimedIds(count: number) {
    const left = new Set(serverIds(HISTORY));
    const out: string[] = [];
    for (let i = 0; i < count; i++) if (!left.has(idOf(i))) out.push(idOf(i));
    return out;
}
function lostIds(count: number) {
    const journal = new Set(readCleanupJournal().map((e) => e.trashItem.id));
    const trash = new Set(serverIds(TRASH));
    return claimedIds(count).filter((id) => !journal.has(id) && !trash.has(id));
}
function killAndReopen() {
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    lab.hangTrash = false;
    const history = getAt(HISTORY) || {};
    dataState.scanHistory = Object.values(history);
    dataState.deletedItems = Object.values(getAt(TRASH) || {});
    dataState.dailyRevenueData = clone(getAt(DAILY));
    dataState.monthlyRevenueData = clone(getAt(MONTHLY));
    dataState.cleanupResumeInFlight = false;
}
const syncViews = () => {
    dataState.scanHistory = Object.values(getAt(HISTORY) || {});
    dataState.deletedItems = Object.values(getAt(TRASH) || {});
    dataState.dailyRevenueData = clone(getAt(DAILY));
    dataState.monthlyRevenueData = clone(getAt(MONTHLY));
};

beforeEach(() => {
    lab.tx = [];
    lab.updates = [];
    lab.hook = null;
    lab.hangTrash = false;
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

describe('cleanup journal ceiling never drops an unfinished cleanup (SCALE-1)', () => {
    it('1. more ripe parcels than the ceiling while trash writes hang ➜ every parcel claimed from history has a journal entry (none lost)', async () => {
        const count = CLEANUP_JOURNAL_MAX + 60;
        install(count);
        lab.hangTrash = true;
        runAutomaticCleanupRules();
        await flush();
        const claimed = claimedIds(count);
        expect(claimed.length).toBeGreaterThan(0);
        expect(lostIds(count)).toEqual([]);
        expect(readCleanupJournal().length).toBe(claimed.length);
        expect(readCleanupJournal().length).toBeLessThanOrEqual(CLEANUP_JOURNAL_MAX);
    }, 60000);

    it('2. killed mid-burst ➜ reopen resumes every journal entry, later rounds clean the rest ➜ every parcel in trash once · ledger deducted once per parcel', async () => {
        const count = CLEANUP_JOURNAL_MAX + 60;
        install(count);
        lab.hangTrash = true;
        runAutomaticCleanupRules();
        await flush();
        killAndReopen();
        await resumeInterruptedCleanups();
        await flush();
        expect(readCleanupJournal().length).toBe(0);
        for (let round = 0; round < 4 && serverIds(HISTORY).length; round++) {
            syncViews();
            runAutomaticCleanupRules();
            await flush();
        }
        expect(serverIds(HISTORY)).toEqual([]);
        expect(serverIds(TRASH).length).toBe(count);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(OPENING_COD - count);
        expect(getAt(DAILY + '/' + DAY).totalCount).toBe(OPENING_COD - count);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(OPENING_COD - count);
        expect(readCleanupJournal().length).toBe(0);
    }, 60000);

    it('3. reverse: under the ceiling one round starts every ripe parcel', async () => {
        const count = 12;
        install(count);
        runAutomaticCleanupRules();
        await flush();
        expect(serverIds(HISTORY)).toEqual([]);
        expect(serverIds(TRASH).length).toBe(count);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(OPENING_COD - count);
        expect(readCleanupJournal().length).toBe(0);
    }, 60000);

    it('4. writing the journal never drops an entry, even past the ceiling (another tab can add its own)', () => {
        const entries = Array.from({ length: CLEANUP_JOURNAL_MAX + 25 }, (_, i) => ({ id: idOf(i), reason: 'abandon', stage: 'moved', trashItem: { id: idOf(i), barcodes: [] }, revenue: null }));
        writeCleanupJournal(entries);
        expect(readCleanupJournal().length).toBe(CLEANUP_JOURNAL_MAX + 25);
    });

    it('5. a journal already full of unfinished entries holds new cleanups (no claim) until resume clears it', async () => {
        const count = 5;
        install(count);
        const stale = Array.from({ length: CLEANUP_JOURNAL_MAX }, (_, i) => ({ id: 'old_' + i, reason: 'close', stage: 'moved', journalAt: getServerNow(), trashItem: { id: 'old_' + i, barcodes: [] }, revenue: null }));
        writeCleanupJournal(stale);
        runAutomaticCleanupRules();
        await flush();
        expect(serverIds(HISTORY).length).toBe(count);
        expect(readCleanupJournal().length).toBe(CLEANUP_JOURNAL_MAX);
        writeCleanupJournal([]);
        runAutomaticCleanupRules();
        await flush();
        expect(serverIds(HISTORY)).toEqual([]);
        expect(serverIds(TRASH).length).toBe(count);
    }, 60000);
});
