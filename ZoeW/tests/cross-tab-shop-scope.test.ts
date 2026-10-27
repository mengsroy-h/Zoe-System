import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { liveShopScope, shopScope, shopScopePending } from '../src/core/shop-scope';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, cleanupOperationOwners, readCleanupJournal, resumeInterruptedCleanups, runAutomaticCleanupRules } from '../src/domain/cleanup';
import { saveRestoreClaim, storedRestoreClaims } from '../src/features/restore';
import { ABANDON_AGE_MS } from '../src/features/session';
import { withConnectionOwnership } from '../src/services/connection-flow';

// Two tabs share localStorage: one saves shop B's Config while the other stays connected to shop A. The shop identity of
// a journal must be the database the operation writes to, and a tab whose stored Config no longer names its live database
// waits as if its shop were not known yet (no automatic cleanup, no journal resume) ➜ shop A's parcel or deduction never lands in B.

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const MONTH = '2026-09';
const ID = 'id_1758000000000_aaaa1';
const URL_A = 'https://shop-a.firebaseio.com';
const URL_B = 'https://shop-b.firebaseio.com';
const APP_A: any = { name: 'a', options: { databaseURL: URL_A } };
const APP_B: any = { name: 'b', options: { databaseURL: URL_B } };
const DB_A: any = { name: 'shop-a', app: APP_A };
const DB_B: any = { name: 'shop-b', app: APP_B };
const lab = { stores: new Map<any, any>(), hangOn: null as any, hangPath: (_path: string) => false };

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
const split = (path: string) => String(path || '').split('/').filter(Boolean);
function getAt(db: any, path: string) {
    let cur: any = lab.stores.get(db);
    for (const key of split(path)) {
        if (cur === null || cur === undefined || typeof cur !== 'object') return null;
        cur = cur[key];
    }
    return cur === undefined ? null : clone(cur);
}
function setAt(db: any, path: string, value: any) {
    const parts = split(path);
    let cur: any = lab.stores.get(db);
    for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === null || cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    if (value === null || value === undefined) delete cur[parts[parts.length - 1]]; else cur[parts[parts.length - 1]] = clone(value);
}
const urlOf = (db: any) => (db === DB_A ? URL_A : URL_B);
function makeRef(db: any, path = '') {
    const p = split(path).join('/');
    return { db, path: p, key: split(p).pop() || null, toString: () => urlOf(db) + '/' + p };
}
const snap = (ref: any, value: any) => ({ key: ref && ref.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined });
const ledgerPath = (path: string) => [DAILY, MONTHLY].some((root) => path === root || path.startsWith(root + '/'));
function makeFb() {
    return {
        ref: (db: any, path = '') => makeRef(db, path),
        increment: (n: number) => ({ __inc__: n }),
        get: async (ref: any) => snap(ref, getAt(ref.db, ref.path)),
        update: async (ref: any, updates: any) => {
            for (const key of Object.keys(updates)) setAt(ref.db, [ref.path, key].filter(Boolean).join('/'), updates[key]);
        },
        set: async (ref: any, value: any) => { setAt(ref.db, ref.path, value); },
        runTransaction: async (ref: any, updater: any) => {
            if (lab.hangOn === ref.db && lab.hangPath(ref.path)) return new Promise(() => {});
            const prior = getAt(ref.db, ref.path);
            const proposed = updater(clone(prior));
            if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
            setAt(ref.db, ref.path, proposed);
            return { committed: true, snapshot: snap(ref, getAt(ref.db, ref.path)) };
        },
        onValue: () => () => {},
        off: () => {}
    };
}
function serverRead(input: string | URL | Request) {
    const url = new URL(String(input));
    const db = url.hostname.startsWith('shop-a.') ? DB_A : DB_B;
    const path = decodeURIComponent(url.pathname.slice(1, -5));
    return Promise.resolve(new Response(JSON.stringify(getAt(db, path)), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}
function connectTabTo(db: any, api: any = firebaseState.fb) {
    firebaseState.fb = api;
    firebaseState.db = db;
    firebaseState.auth = (api && api.getAuth ? api.getAuth(db.app) : { app: db.app, currentUser: { uid: 'u1', getIdToken: async () => 'tok' } }) as any;
    firebaseState.firebaseConfig = { databaseURL: urlOf(db) } as any;
    for (const [field, path] of [['dbRefHistory', HISTORY], ['dbRefDeleted', TRASH], ['dbRefDailyRevenue', DAILY], ['dbRefMonthlyRevenue', MONTHLY],
        ['dbRefDailyPickup', 'zoew_daily_pickup_cod_dod'], ['dbRefDailyCollected', 'zoew_daily_collected_cod_dod']] as const) {
        (firebaseState as any)[field] = api.ref(db, path);
    }
    dataState.scanHistory = Object.values(getAt(db, HISTORY) || {}).map((v: any) => clone(v));
    dataState.deletedItems = Object.values(getAt(db, TRASH) || {}).map((v: any) => clone(v));
    dataState.dailyRevenueData = getAt(db, DAILY) || {};
    dataState.monthlyRevenueData = getAt(db, MONTHLY) || {};
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
}
const store = (url: string) => localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: url }));
const revenueStore = () => ({ [DAILY]: { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } }, [MONTHLY]: { [MONTH]: { codDollar: 100, dodDollar: 0, totalCount: 10 } } });
function returnedItem() {
    const old = getServerNow() - ABANDON_AGE_MS - 3600000;
    const a = { code: 'A1', time: '08:00:00 (' + DAY + ')', cod: 10, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: old };
    return { id: ID, phone: '012', scanDate: DAY, time: a.time, createdAt: old, count: 1, cod: 10, dod: 0, price: 10, isClosed: false, isCalled: false, barcode: 'A1', barcodes: [a] };
}
const flush = async (n = 60) => { for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };
function forgetTabMemory() {
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    cleanupOperationOwners.clear();
    dataState.cleanupResumeInFlight = false;
}
const untouched = (db: any) => ({ trash: getAt(db, TRASH + '/' + ID), daily: getAt(db, DAILY + '/' + DAY).codDollar, monthly: getAt(db, MONTHLY + '/' + MONTH).codDollar });

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(serverRead));
    try { localStorage.clear(); } catch {}
    (window as any).ZoeErrors = { capture: vi.fn() };
    uiState.toasts = [];
    forgetTabMemory();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    lab.stores = new Map<any, any>([[DB_A, { [HISTORY]: { [ID]: returnedItem() }, ...revenueStore() }], [DB_B, revenueStore()]]);
    lab.hangOn = DB_A;
    lab.hangPath = ledgerPath;
    firebaseState.fb = makeFb() as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.authGeneration++;
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
    firebaseState.db = null as any;
    firebaseState.auth = null as any;
    firebaseState.fb = null as any;
    firebaseState.firebaseConfig = null as any;
});

async function staleTabClaimsShopA(diesAt: 'slot' | 'ledger') {
    lab.hangPath = diesAt === 'slot' ? (path: string) => path === TRASH + '/' + ID : ledgerPath;
    store(URL_A);
    connectTabTo(DB_A);
    store(URL_B);
    void claimAndCleanupItem(ID, 'abandon');
    await flush();
    expect(getAt(DB_A, HISTORY + '/' + ID), 'the stale tab claimed its own shop A parcel').toBeNull();
    expect(readCleanupJournal()).toHaveLength(1);
    forgetTabMemory();
}

describe('shop identity across tabs that share one stored Config', () => {
    it('a tab whose stored Config names another database waits (shop pending); its journals keep the written database', () => {
        store(URL_A);
        connectTabTo(DB_A);
        expect({ scope: shopScope(), live: liveShopScope(), pending: shopScopePending() }).toEqual({ scope: URL_A, live: URL_A, pending: false });
        store(URL_B);
        expect({ scope: shopScope(), live: liveShopScope(), pending: shopScopePending() }).toEqual({ scope: URL_B, live: URL_A, pending: true });
        connectTabTo(DB_B);
        expect({ scope: shopScope(), live: liveShopScope(), pending: shopScopePending() }).toEqual({ scope: URL_B, live: URL_B, pending: false });
    });

    it('a stored Config without a live backend (boot before init) still names its shop', () => {
        store(URL_B);
        firebaseState.db = null as any;
        firebaseState.auth = null as any;
        expect({ scope: shopScope(), live: liveShopScope(), pending: shopScopePending() }).toEqual({ scope: URL_B, live: URL_B, pending: false });
    });

    it('a restore intent saved by the stale tab names the database the restore writes (shop A)', () => {
        store(URL_A);
        connectTabTo(DB_A);
        store(URL_B);
        saveRestoreClaim(ID, { token: 'tok-a', targetId: ID, claimedAt: getServerNow() });
        expect(storedRestoreClaims()[ID].scope).toBe(URL_A);
    });

    it('the stale tab runs no automatic cleanup', () => {
        store(URL_A);
        connectTabTo(DB_A);
        store(URL_B);
        runAutomaticCleanupRules();
        expect(cleanupInFlight.size).toBe(0);
        expect(getAt(DB_A, HISTORY + '/' + ID)).not.toBeNull();
    });

    it.each(['slot', 'ledger'] as const)('a stale tab dies at the %s step ➜ the shop B tab never writes shop A money or parcels into B', async (diesAt) => {
        await staleTabClaimsShopA(diesAt);
        expect(readCleanupJournal()[0].scope, 'journal names the database the claim wrote to').toBe(URL_A);
        lab.hangOn = null;
        firebaseState.authGeneration++;
        connectTabTo(DB_B);
        await resumeInterruptedCleanups();
        await flush();
        expect(untouched(DB_B)).toEqual({ trash: null, daily: 100, monthly: 100 });
        expect(uiState.toasts.map((t: any) => t.msg)).toEqual([]);
    });

    it('through the real connection proxy: the stale tab\'s journal is scoped to its live database', async () => {
        const raw: any = makeFb();
        raw.getAuth = (app: any) => app.__auth || (app.__auth = { app, currentUser: { uid: 'u1', getIdToken: async () => 'tok' } });
        raw.getDatabase = (app: any) => (app === APP_A ? DB_A : DB_B);
        const owned: any = withConnectionOwnership(raw);
        try {
            lab.hangPath = (path: string) => path === TRASH + '/' + ID;
            store(URL_A);
            connectTabTo(owned.getDatabase(APP_A), owned);
            store(URL_B);
            void claimAndCleanupItem(ID, 'abandon');
            await flush();
            expect(readCleanupJournal().map((e: any) => e.scope)).toEqual([URL_A]);
            forgetTabMemory();
            lab.hangOn = null;
            firebaseState.authGeneration++;
            connectTabTo(owned.getDatabase(APP_B), owned);
            await resumeInterruptedCleanups();
            await flush();
            expect(untouched(DB_B)).toEqual({ trash: null, daily: 100, monthly: 100 });
        } finally {
            delete APP_A.__auth;
            delete APP_B.__auth;
        }
    });

    it('mirror: the shop B tab dies mid-cleanup ➜ the stale tab on A never resumes B\'s entry into A and keeps it for B', async () => {
        lab.stores = new Map<any, any>([[DB_A, revenueStore()], [DB_B, { [HISTORY]: { [ID]: returnedItem() }, ...revenueStore() }]]);
        lab.hangOn = DB_B;
        lab.hangPath = (path: string) => path === TRASH + '/' + ID;
        store(URL_B);
        connectTabTo(DB_B);
        void claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(readCleanupJournal().map((e: any) => e.scope)).toEqual([URL_B]);
        forgetTabMemory();
        lab.hangOn = null;
        firebaseState.authGeneration++;
        connectTabTo(DB_A);
        await resumeInterruptedCleanups();
        await flush();
        expect(untouched(DB_A)).toEqual({ trash: null, daily: 100, monthly: 100 });
        expect(readCleanupJournal().map((e: any) => e.scope), 'B keeps its entry').toEqual([URL_B]);
    });
});
