import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, readCleanupJournal, restoreClaimedItemToScanHistory } from '../src/domain/cleanup';
import { removeSingleBarcode } from '../src/features/barcode-ops';
import { deleteSingleItem } from '../src/features/entry-ops';
import { ABANDON_AGE_MS } from '../src/features/session';

// ⛔ ការសរសេរធុងសំរាមរបស់ ការសម្អាត ៨ ថ្ងៃ · លុប · ដក សាកឡើងវិញ (`retryAsync()` ១,៥ · ៣ · ៦ វិ.) ៖ ការសាកលើកក្រោយដែលកើតក្រោយការចាកចេញ/ប្តូរ Config
//    ជាការសរសេរថ្មីក្រោម session ថ្មី (Supabase ៖ គណនីថ្មី ➜ tenant ផ្សេងក្នុង Project ដដែល · Firebase ៖ Database ថ្មី) ➜ កញ្ចប់របស់ហាង A ចូលធុងសំរាមហាង B។
//    ផ្លូវ «ដក» ៖ ការសរសេរបរាជ័យ ➜ ស្តារ barcode ចូលប្រវត្តិ ➜ ត្រូវតែក្នុង session ដើមដែរ។
const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const ID = 'id_1758000000000_aaaa1';
const DB_A = { name: 'shop-a' };
const DB_B = { name: 'shop-b' };

const lab = { store: {} as Record<string, any>, writes: [] as { db: any; path: string }[], failFirstTrash: true, onTrashFail: null as null | (() => void) };

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
    return { db, path: p, key: split(p).pop() || null, toString: () => 'https://shop.firebaseio.com/' + p };
}
function snap(ref: any, value: any) {
    return { key: ref && ref.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined };
}
const isTrash = (path: string) => path === TRASH || path.startsWith(TRASH + '/');
function trashFailure() {
    if (!lab.failFirstTrash) return null;
    lab.failFirstTrash = false;
    if (lab.onTrashFail) lab.onTrashFail();
    return Promise.reject(Object.assign(new Error('network error'), { code: 'NETWORK_ERROR' }));
}
function makeFb() {
    return {
        ref: (db: any, path = '') => makeRef(db, path),
        increment: (n: number) => ({ __inc__: n }),
        get: async (ref: any) => snap(ref, getAt(ref.path)),
        update: async (ref: any, updates: any) => {
            for (const key of Object.keys(updates)) {
                const path = [ref.path, key].filter(Boolean).join('/');
                if (isTrash(path)) { const failed = trashFailure(); if (failed) return failed; }
                lab.writes.push({ db: ref.db, path });
                let value = updates[key];
                if (value && typeof value === 'object' && value.__inc__ !== undefined) value = (Number(getAt(path)) || 0) + value.__inc__;
                setAt(path, value);
            }
        },
        runTransaction: async (ref: any, updater: any) => {
            if (isTrash(ref.path)) { const failed = trashFailure(); if (failed) return failed; }
            const prior = getAt(ref.path);
            const proposed = updater(clone(prior));
            if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
            lab.writes.push({ db: ref.db, path: ref.path });
            setAt(ref.path, proposed);
            return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
        },
        onValue: () => () => {},
        off: () => {}
    };
}
function itemOf(createdAt: number) {
    const b = { code: 'C', time: '08:00:00 (' + DAY + ')', cod: 7, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt };
    const d = { ...b, code: 'D', cod: 3 };
    return { id: ID, phone: '012', scanDate: DAY, time: b.time, createdAt, count: 2, cod: 10, dod: 0, price: 10, isClosed: false, isCalled: false, barcode: 'C', barcodes: [b, d] };
}
function install(createdAt: number) {
    const item = itemOf(createdAt);
    lab.store = {
        [HISTORY]: { [ID]: clone(item) },
        [DAILY]: { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } },
        [MONTHLY]: { '2026-09': { codDollar: 100, dodDollar: 0, totalCount: 10 } }
    };
    firebaseState.db = DB_A as any;
    firebaseState.fb = makeFb() as any;
    firebaseState.firebaseConfig = { databaseURL: 'https://shop.firebaseio.com' } as any;
    firebaseState.auth = { currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.dbRefHistory = makeRef(DB_A, HISTORY) as any;
    firebaseState.dbRefDeleted = makeRef(DB_A, TRASH) as any;
    firebaseState.dbRefDailyRevenue = makeRef(DB_A, DAILY) as any;
    firebaseState.dbRefMonthlyRevenue = makeRef(DB_A, MONTHLY) as any;
    firebaseState.dbRefDailyPickup = makeRef(DB_A, 'zoew_daily_pickup_cod_dod') as any;
    firebaseState.dbRefDailyCollected = makeRef(DB_A, 'zoew_daily_collected_cod_dod') as any;
    dataState.scanHistory = [clone(item)];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = clone(lab.store[DAILY]);
    dataState.monthlyRevenueData = clone(lab.store[MONTHLY]);
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
}
function switchToShopB() {
    firebaseState.authGeneration++;
    firebaseState.db = DB_B as any;
    firebaseState.dbRefHistory = makeRef(DB_B, HISTORY) as any;
    firebaseState.dbRefDeleted = makeRef(DB_B, TRASH) as any;
    firebaseState.dbRefDailyRevenue = makeRef(DB_B, DAILY) as any;
    firebaseState.dbRefMonthlyRevenue = makeRef(DB_B, MONTHLY) as any;
}
const writesTo = (db: any) => lab.writes.filter((w) => w.db === db).map((w) => w.path);
const waitRetries = () => new Promise((resolve) => setTimeout(resolve, 1800));

beforeEach(() => {
    lab.writes = [];
    lab.failFirstTrash = true;
    lab.onTrashFail = null;
    uiState.toasts = [];
    uiState.scanRemoveInFlight = null;
    try { localStorage.clear(); } catch {}
    (window as any).ZoeErrors = { capture: vi.fn() };
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    vi.stubGlobal('confirm', () => true);
    firebaseState.authGeneration++;
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

describe('ការសរសេរធុងសំរាមឡើងវិញក្រោយប្តូរ session', () => {
    it('១. ការសម្អាត ៨ ថ្ងៃ ៖ ការសរសេរលើកទី ១ បរាជ័យ ➜ ប្តូរទៅហាង B ➜ គ្មានការសរសេរណាមួយចូល B · journal នៅសម្រាប់ហាង A', async () => {
        install(getServerNow() - ABANDON_AGE_MS - 3600000);
        lab.onTrashFail = switchToShopB;
        await claimAndCleanupItem(ID, 'abandon');
        await waitRetries();
        expect(writesTo(DB_B)).toEqual([]);
        expect(readCleanupJournal().length).toBe(1);
        expect(readCleanupJournal()[0].stage).toBe('slot');
    }, 20000);

    it('២. លុប ៖ ការសរសេរលើកទី ១ បរាជ័យ ➜ ប្តូរទៅហាង B ➜ គ្មានការសរសេរណាមួយចូល B', async () => {
        install(getServerNow() - 3600000);
        lab.onTrashFail = switchToShopB;
        await deleteSingleItem(ID);
        await waitRetries();
        expect(writesTo(DB_B)).toEqual([]);
    }, 20000);

    it('៣. ដក ៖ ការសរសេរលើកទី ១ បរាជ័យ ➜ ប្តូរទៅហាង B ➜ គ្មានការសរសេរណាមួយចូល B (ធុងសំរាម · ការស្តារ barcode · ledger)', async () => {
        install(getServerNow() - 3600000);
        lab.onTrashFail = switchToShopB;
        await removeSingleBarcode(ID, 'C');
        await waitRetries();
        expect(writesTo(DB_B)).toEqual([]);
    }, 20000);

    it('៥. ការស្តារ barcode ចូលប្រវត្តិ (ក្រោយធុងសំរាមបរាជ័យ) ៖ ការសាកលើកទី ១ បរាជ័យ ➜ ប្តូរទៅហាង B ➜ មិនសរសេរចូល B · ទិសផ្ទុយ ៖ session ដដែល ➜ ស្តារចូល A', async () => {
        for (const switchShop of [true, false]) {
            install(getServerNow() - 3600000);
            lab.writes = [];
            setAt(HISTORY + '/' + ID, null);
            const claimed = itemOf(getServerNow() - 3600000);
            const fb: any = firebaseState.fb;
            const realTx = fb.runTransaction;
            let failed = false;
            fb.runTransaction = (ref: any, updater: any) => {
                if (!failed && ref.path === HISTORY + '/' + ID) {
                    failed = true;
                    if (switchShop) switchToShopB();
                    return Promise.reject(Object.assign(new Error('network error'), { code: 'NETWORK_ERROR' }));
                }
                return realTx(ref, updater);
            };
            let outcome = 'ok';
            try { await restoreClaimedItemToScanHistory(ID, claimed, null); } catch (e) { outcome = 'rejected'; }
            if (switchShop) {
                expect(writesTo(DB_B)).toEqual([]);
                expect(outcome).toBe('rejected');
            } else {
                expect(writesTo(DB_A)).toEqual([HISTORY + '/' + ID]);
                expect(getAt(HISTORY + '/' + ID).barcodes.map((b: any) => b.code)).toEqual(['C', 'D']);
            }
        }
    }, 20000);

    it('៤. ទិសផ្ទុយ ៖ session ដដែល ➜ ការសម្អាត · លុប · ដក សាកឡើងវិញ ហើយសរសេរធុងសំរាមចូលហាង A', async () => {
        install(getServerNow() - ABANDON_AGE_MS - 3600000);
        await claimAndCleanupItem(ID, 'abandon');
        await waitRetries();
        expect(writesTo(DB_A).filter(isTrash).length).toBeGreaterThan(0);
        expect(readCleanupJournal().length).toBe(0);

        lab.writes = [];
        lab.failFirstTrash = true;
        install(getServerNow() - 3600000);
        await deleteSingleItem(ID);
        await waitRetries();
        expect(writesTo(DB_A).filter(isTrash).length).toBe(1);

        lab.writes = [];
        lab.failFirstTrash = true;
        install(getServerNow() - 3600000);
        await removeSingleBarcode(ID, 'C');
        await waitRetries();
        expect(writesTo(DB_A).filter(isTrash).length).toBe(1);
        expect(getAt(HISTORY + '/' + ID).barcodes.map((b: any) => b.code)).toEqual(['D']);
    }, 30000);
});
