import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { cleanupInFlight, cleanupJournalLive, noteCleanupJournalEntry, readCleanupJournal, resumeCleanupJournalEntry } from '../src/domain/cleanup';

// ⛔ ការបន្តការសម្អាតដែលត្រូវរំខាន (`resumeCleanupJournalEntry()`) ពិនិត្យ scope របស់ journal តែនៅដើម ៖ ការចាកចេញ/ប្តូរ Config **កណ្តាលផ្លូវ**
//    (ក្រោយការអានធុងសំរាម · ក្រោយជំហាន ledger ខែ · ក្រោយការរកឃើញ slot) មិនត្រូវឲ្យជំហានបន្ទាប់សរសេរធុងសំរាម ឬកាត់ប្រាក់ក្នុងហាងថ្មីទេ
//    (Firebase ៖ Database ថ្មី · Supabase ៖ គណនីថ្មីក្នុង Project ដដែល)។ journal នៅសម្រាប់ហាងដើម។
const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const MONTH = '2026-09';
const ID = 'id_1758000000000_bbbb2';
const DB_A = { name: 'shop-a' };
const DB_B = { name: 'shop-b' };
const URL_A = 'https://shop-a.firebaseio.com';
const URL_B = 'https://shop-b.firebaseio.com';

type Hook = (info: { kind: 'get' | 'tx' | 'update'; path: string }) => void;
const lab = { store: {} as Record<string, any>, writes: [] as { db: any; path: string }[], hook: null as Hook | null };

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
function setAt(path: string, value: any) {
    const parts = split(path);
    let cur: any = lab.store;
    for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === null || cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    if (value === null || value === undefined) delete cur[parts[parts.length - 1]]; else cur[parts[parts.length - 1]] = clone(value);
}
function makeRef(db: any, path = '') {
    const p = split(path).join('/');
    return { db, path: p, key: split(p).pop() || null, toString: () => URL_A + '/' + p };
}
function snap(ref: any, value: any) {
    return { key: ref && ref.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined };
}
function makeFb() {
    return {
        ref: (db: any, path = '') => makeRef(db, path),
        increment: (n: number) => ({ __inc__: n }),
        get: async (ref: any) => {
            const value = getAt(ref.path);
            if (lab.hook) lab.hook({ kind: 'get', path: ref.path });
            return snap(ref, value);
        },
        update: async (ref: any, updates: any) => {
            for (const key of Object.keys(updates)) {
                const path = [ref.path, key].filter(Boolean).join('/');
                lab.writes.push({ db: ref.db, path });
                setAt(path, updates[key]);
                if (lab.hook) lab.hook({ kind: 'update', path });
            }
        },
        runTransaction: async (ref: any, updater: any) => {
            const prior = getAt(ref.path);
            const proposed = updater(clone(prior));
            if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
            lab.writes.push({ db: ref.db, path: ref.path });
            setAt(ref.path, proposed);
            if (lab.hook) lab.hook({ kind: 'tx', path: ref.path });
            return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
        },
        onValue: () => () => {},
        off: () => {}
    };
}
function attachShop(db: any, url: string) {
    firebaseState.db = db as any;
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: url }));
    firebaseState.firebaseConfig = { databaseURL: url } as any;
    firebaseState.dbRefHistory = makeRef(db, HISTORY) as any;
    firebaseState.dbRefDeleted = makeRef(db, TRASH) as any;
    firebaseState.dbRefDailyRevenue = makeRef(db, DAILY) as any;
    firebaseState.dbRefMonthlyRevenue = makeRef(db, MONTHLY) as any;
    firebaseState.dbRefDailyPickup = makeRef(db, 'zoew_daily_pickup_cod_dod') as any;
    firebaseState.dbRefDailyCollected = makeRef(db, 'zoew_daily_collected_cod_dod') as any;
}
function switchToShopB() {
    firebaseState.authGeneration++;
    attachShop(DB_B, URL_B);
    dataState.scanHistory = [];
    dataState.deletedItems = [];
}
function trashItemOf() {
    const deletedAt = getServerNow() - 60000;
    const c = { code: 'C', time: '08:00:00 (' + DAY + ')', cod: 7, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: deletedAt - 9 * 86400000 };
    return { id: ID, phone: '012', scanDate: DAY, time: c.time, createdAt: c.createdAt, count: 1, cod: 7, dod: 0, price: 7, isClosed: false, barcode: 'C', barcodes: [c],
        deletedAt, isFromDeletion: false, trashReason: 'expired' };
}
function install(stage: string, trashPresent: boolean, extra: any = {}) {
    const trashItem = trashItemOf();
    lab.store = {
        [DAILY]: { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } },
        [MONTHLY]: { [MONTH]: { codDollar: 100, dodDollar: 0, totalCount: 10 } }
    };
    if (trashPresent) lab.store[TRASH] = { [ID]: clone(trashItem) };
    firebaseState.fb = makeFb() as any;
    firebaseState.auth = { currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    attachShop(DB_A, URL_A);
    dataState.scanHistory = [];
    dataState.deletedItems = trashPresent ? [clone(trashItem)] : [];
    dataState.dailyRevenueData = clone(lab.store[DAILY]);
    dataState.monthlyRevenueData = clone(lab.store[MONTHLY]);
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
    noteCleanupJournalEntry(Object.assign({ id: ID, reason: 'abandon', journalAt: trashItem.deletedAt, stage, trashItem,
        revenue: { scanDate: DAY, cod: 7, dod: 0, count: 1 } }, extra));
    return trashItem;
}
const writesTo = (db: any) => lab.writes.filter((w) => w.db === db).map((w) => w.path);
const switchOnce = (when: (info: { kind: string; path: string }) => boolean) => {
    let done = false;
    lab.hook = (info) => { if (!done && when(info)) { done = true; switchToShopB(); } };
};

beforeEach(() => {
    lab.writes = [];
    lab.hook = null;
    uiState.toasts = [];
    try { localStorage.clear(); } catch {}
    (window as any).ZoeErrors = { capture: vi.fn() };
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    firebaseState.authGeneration++;
});

afterEach(() => {
    delete (window as any).ZoeErrors;
});

describe('resume ការសម្អាតដែលត្រូវរំខាន ៖ ប្តូរ session កណ្តាលផ្លូវ', () => {
    it('១. stage moved ៖ ប្តូរទៅហាង B ពេលអានធុងសំរាម ➜ មិនសរសេរធុងសំរាម · មិនកាត់ប្រាក់ក្នុង B', async () => {
        install('moved', false);
        switchOnce((i) => i.kind === 'get' && i.path === TRASH + '/' + ID);
        await resumeCleanupJournalEntry(ID);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(writesTo(DB_B)).toEqual([]);
    }, 20000);

    it('២. stage moved (ធុងសំរាមមានក្នុង A) ៖ ប្តូរទៅហាង B ក្រោយជំហាន ledger ខែ ➜ ជំហានថ្ងៃ · flip មិនសរសេរក្នុង B', async () => {
        install('moved', true);
        switchOnce((i) => i.kind === 'tx' && i.path === MONTHLY);
        await resumeCleanupJournalEntry(ID);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(writesTo(DB_A)).toEqual([MONTHLY]);
        expect(writesTo(DB_B)).toEqual([]);
    }, 20000);

    it('៣. stage slot ៖ ប្តូរទៅហាង B ពេលអាន slot ➜ មិនទាមទារ slot · មិនកាត់ប្រាក់ក្នុង B', async () => {
        install('slot', false);
        switchOnce((i) => i.kind === 'get' && i.path === TRASH + '/' + ID);
        await resumeCleanupJournalEntry(ID);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(writesTo(DB_B)).toEqual([]);
    }, 20000);

    it('៤. stage moved ៖ ប្តូរទៅហាង B ក្រោយសរសេរធុងសំរាមឡើងវិញក្នុង A ➜ មិនកាត់ប្រាក់ក្នុង B · journal នៅសម្រាប់ A', async () => {
        install('moved', false);
        switchOnce((i) => i.kind === 'update' && i.path === TRASH + '/' + ID);
        await resumeCleanupJournalEntry(ID);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(writesTo(DB_A)).toEqual([TRASH + '/' + ID]);
        expect(writesTo(DB_B)).toEqual([]);
        expect(readCleanupJournal().length).toBe(1);
    }, 20000);

    it('៥. ទិសផ្ទុយ ៖ session ដដែល ➜ stage moved សរសេរធុងសំរាម · កាត់ ៧ · flip · journal ទទេ', async () => {
        install('moved', false);
        await resumeCleanupJournalEntry(ID);
        expect(writesTo(DB_B)).toEqual([]);
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(93);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(93);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);
});
