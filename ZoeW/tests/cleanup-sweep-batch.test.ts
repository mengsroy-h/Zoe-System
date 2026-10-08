/**
 * ⛔ SCALE-2 ៖ ការសម្អាតស្វ័យប្រវត្តិច្រើនរយកញ្ចប់ក្នុងពេលតែមួយ មិនត្រូវរារាំង main thread ៖ `runAutomaticCleanupRules()` ចាប់ផ្តើម
 *    `claimAndCleanupItem()` សម្រាប់កញ្ចប់ ripe ទាំងអស់ក្នុង loop synchronous តែមួយ (ការហៅនីមួយៗអាន journal ពី localStorage ·
 *    transaction នីមួយៗធ្វើឲ្យ listener ប្រវត្តិដំណើរការម្តងទៀត) ➜ ៣០០ ripe ➜ ៤.៩–៦ វិ. អេក្រង់កក (Deep audit ២)។
 * ⛔ ច្រកចូលរបស់ App (`debouncedRenderAfterHistorySync` · `runScheduledCleanup`) ចាប់ផ្តើម ≤ `CLEANUP_SWEEP_BATCH` ក្នុងមួយជុំ ហើយបន្តក្រោយ
 *    yield ➜ គ្រប់កញ្ចប់នៅតែត្រូវសម្អាត (លុយដកត្រឹមត្រូវ) · កញ្ចប់ដែលជាប់ (transaction ព្យួរ) មិនធ្វើឲ្យកញ្ចប់ខាងក្រោយស្រេកឃ្លាន ·
 *    ការហៅដោយគ្មាន limit (checker ចាស់) ដំណើរការដូចដើម។ វាស់តាមចំនួន មិនមែនតាមម៉ោង។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import * as cleanup from '../src/domain/cleanup';
import { CLEANUP_JOURNAL_MAX, cleanupInFlight, cleanupJournalLive, runAutomaticCleanupRules, runScheduledCleanup } from '../src/domain/cleanup';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { ABANDON_AGE_MS } from '../src/features/session';
import { debouncedRenderAfterHistorySync } from '../src/services/network';

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

const BATCH: number = (cleanup as any).CLEANUP_SWEEP_BATCH || 8;
const drain = async (rounds = 60) => { for (let i = 0; i < rounds; i++) { await flush(20); await new Promise((r) => setTimeout(r, 60)); syncViews(); } };

describe('SCALE-2 ៖ ការសម្អាតច្រើនរយកញ្ចប់ ➜ batch + yield (មិនកក main thread)', () => {
    it('ជាន់អប្បបរមា ៖ batch តូច (≤ ១០) ហើយតូចជាងពិដាន journal', () => {
        expect(BATCH).toBeGreaterThan(0);
        expect(BATCH).toBeLessThanOrEqual(10);
        expect(BATCH).toBeLessThan(CLEANUP_JOURNAL_MAX);
    });

    it('⛔ runScheduledCleanup() (ច្រកពិតរបស់ App) ៖ ៣០០ ripe ➜ ចាប់ផ្តើម ≤ batch ក្នុងជុំមួយ · បន្តដោយខ្លួនឯង ➜ ទាំង ៣០០ ចូលធុងសំរាម · លុយដក ៣០០ ម្តង', async () => {
        const count = 300;
        install(count);
        runScheduledCleanup();
        const firstSweep = cleanupInFlight.size;
        expect(firstSweep).toBeGreaterThan(0);
        expect(firstSweep).toBeLessThanOrEqual(BATCH);
        await drain();
        expect(serverIds(HISTORY)).toEqual([]);
        expect(serverIds(TRASH).length).toBe(count);
        expect(getAt(DAILY + '/' + DAY + '/codDollar')).toBe(OPENING_COD - count);
        expect(getAt(MONTHLY + '/' + MONTH + '/codDollar')).toBe(OPENING_COD - count);
    }, 30000);

    it('⛔ កញ្ចប់ ២០ ដំបូងជាប់ (transaction ព្យួរ) ➜ កញ្ចប់ ២៨០ ផ្សេងនៅតែត្រូវសម្អាត (គ្មានការស្រេកឃ្លាន)', async () => {
        const count = 300;
        install(count);
        const stuck = new Set(Array.from({ length: 20 }, (_, i) => HISTORY + '/' + idOf(i)));
        lab.hook = ({ path }) => (stuck.has(path) ? new Promise(() => {}) : undefined);
        runScheduledCleanup();
        await drain();
        const left = serverIds(HISTORY);
        expect(left.sort()).toEqual([...stuck].map((p) => p.split('/')[1]).sort());
        expect(serverIds(TRASH).length).toBe(count - 20);
    }, 30000);

    it('⛔ កញ្ចប់ ២០ ដំបូងបរាជ័យភ្លាម (transaction reject) ➜ ជុំបន្ទាប់មិនចាប់ផ្តើមពីក្បាលម្តងទៀត · កញ្ចប់ ២៨០ ផ្សេងត្រូវសម្អាត · ការបន្តឈប់ពេលដើរគ្រប់ · ជុំក្រោយព្យាយាមកញ្ចប់ទាំង ២០ ម្តងទៀត', async () => {
        const count = 300;
        install(count);
        const failing = new Set(Array.from({ length: 20 }, (_, i) => HISTORY + '/' + idOf(i)));
        lab.hook = ({ path }) => (failing.has(path) ? Promise.reject(new Error('permission_denied')) : undefined);
        runScheduledCleanup();
        await drain();
        const left = serverIds(HISTORY);
        expect(left.sort()).toEqual([...failing].map((p) => p.split('/')[1]).sort());
        expect(serverIds(TRASH).length).toBe(count - 20);
        expect((dataState as any).cleanupSweepTimer || null).toBe(null);

        lab.hook = null;
        runScheduledCleanup();
        await drain(20);
        expect(serverIds(HISTORY)).toEqual([]);
        expect(serverIds(TRASH).length).toBe(count);
        expect(getAt(DAILY + '/' + DAY + '/codDollar')).toBe(OPENING_COD - count);
    }, 30000);

    it('⛔ debouncedRenderAfterHistorySync (ក្រោយ snapshot ប្រវត្តិ) ៖ ចាប់ផ្តើម ≤ batch ក្នុងជុំមួយដូចគ្នា', async () => {
        install(300);
        vi.useFakeTimers();
        try {
            debouncedRenderAfterHistorySync();
            vi.advanceTimersByTime(125);
            expect(cleanupInFlight.size).toBeGreaterThan(0);
            expect(cleanupInFlight.size).toBeLessThanOrEqual(BATCH);
        } finally {
            vi.clearAllTimers();
            vi.useRealTimers();
            (dataState as any).cleanupSweepTimer = null;
        }
        runScheduledCleanup();
        await drain();
        expect(serverIds(HISTORY)).toEqual([]);
    }, 30000);

    it('ទិសផ្ទុយ ៖ ការហៅគ្មាន limit (checker · ផ្លូវចាស់) ចាប់ផ្តើមគ្រប់កញ្ចប់ ripe ដល់ពិដាន journal ក្នុងការហៅតែមួយ', () => {
        install(50);
        runAutomaticCleanupRules();
        expect(cleanupInFlight.size).toBe(50);
    });
});
