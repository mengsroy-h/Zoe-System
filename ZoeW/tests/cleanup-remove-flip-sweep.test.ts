// A Remove deducts through the keyed ledger event (ded/<trashId>) and only then flips the trash barcode to
// isDeducted:true. When the device that owns the journal dies between the two, runCleanupLedgerKeySweep() flips the
// trash copy from the day key for `remove` as for `returned` ➜ «ចំណូល (យករួច)» never subtracts the barcode twice.
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupServerRead } from './helpers/cleanup-server-read';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { CLEANUP_JOURNAL_KEY } from '../src/core/storage-keys';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getFormattedDate } from '../src/core/timezone';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, runCleanupLedgerKeySweep } from '../src/domain/cleanup';
import { ledgerDedOf as ledgerDedOfForTest } from '../src/domain/ledger';
import { removeSingleBarcode } from '../src/features/barcode-ops';
import { collectedValueOf, uncollectedValueByDate } from '../src/features/export';
import { noteZtoTrashMode, resetZtoTrashMode } from '../src/services/zto-trash-mode';

const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const HOST = 'https://audit-flip.firebaseio.com';
const NOW = Date.UTC(2026, 9, 24, 2);
const CODE = '77130500000071';
const lab = { store: {} as any, refuseFlip: false };
const clone = <V,>(v: V): V => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const parts = (p: string) => p.split('/').filter(Boolean);
const getAt = (p: string) => clone(parts(p).reduce((n: any, k) => n?.[k], lab.store) ?? null);
function setAt(p: string, v: any) {
    const segs = parts(p); const leaf = segs.pop()!; let node = lab.store;
    for (const s of segs) node = node[s] ||= {};
    if (v === null || v === undefined) delete node[leaf]; else node[leaf] = clone(v);
}
const ref = (p = '') => ({ path: p, key: parts(p).at(-1) || null, toString: () => HOST + '/' + p });
const snap = (r: any, v: any) => ({ ref: r, key: r.key, val: () => clone(v), exists: () => v !== null && v !== undefined });
function sdk() {
    return {
        ref: (_db: any, p = '') => ref(p), increment: (n: number) => ({ __inc: n }),
        get: async (r: any) => snap(r, getAt(r.path)),
        set: async (r: any, v: any) => setAt(r.path, v),
        update: async (r: any, ups: any) => {
            for (const [k, v] of Object.entries(ups)) {
                const p = [r.path, k].filter(Boolean).join('/');
                setAt(p, (v as any)?.__inc !== undefined ? (Number(getAt(p)) || 0) + (v as any).__inc : v);
            }
        },
        runTransaction: async (r: any, change: (v: any) => any) => {
            const prior = getAt(r.path);
            // The flip is the only transaction on an EXISTING trash item in this flow: refuse it to model the app dying
            // (or the network failing for good) after the ledger deduction landed and before the flag flipped.
            if (lab.refuseFlip && r.path.startsWith(T + '/') && prior) throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
            const next = change(clone(prior));
            if (next === undefined) return { committed: false, snapshot: snap(r, prior) };
            setAt(r.path, next); return { committed: true, snapshot: snap(r, getAt(r.path)) };
        },
        onValue: () => () => {}, off: () => {}
    };
}
const DAY = () => getFormattedDate(new Date(NOW - 9 * 86400000));
function seed() {
    const at = NOW - 9 * 86400000;
    const id = 'id_' + at + '_flip1';
    const b = { code: CODE, time: '08:00:00 (' + DAY() + ')', cod: 10, dod: 2, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: at };
    lab.store = {
        [H]: { [id]: { id, phone: '012345678', scanDate: DAY(), time: b.time, createdAt: at, count: 1, cod: 10, dod: 2, price: 12, isClosed: false, isCalled: false, barcode: CODE, locker: 'N/A', barcodes: [b] } },
        [D]: { [DAY()]: { codDollar: 110, dodDollar: 22, totalCount: 11 } },
        [M]: { [DAY().slice(0, 7)]: { codDollar: 110, dodDollar: 22, totalCount: 11 } }
    };
    sync();
    return id;
}
function sync() {
    dataState.scanHistory = Object.values(getAt(H) || {});
    dataState.deletedItems = Object.values(getAt(T) || {});
    dataState.dailyRevenueData = getAt(D) || {}; dataState.monthlyRevenueData = getAt(M) || {};
    dataState.dailyPickupData = {}; dataState.dailyCollectedData = {};
}
const shownCollected = () => {
    const day = getAt(D + '/' + DAY());
    return collectedValueOf(day.codDollar, day.dodDollar, uncollectedValueByDate()[DAY()]);
};

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', vi.fn());
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    lab.store = {}; lab.refuseFlip = false;
    appLocalStore.clear(); cleanupInFlight.clear(); cleanupJournalLive.clear();
    dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    firebaseState.authGeneration++; firebaseState.db = { name: 'audit-flip-db' } as any; firebaseState.fb = sdk() as any;
    firebaseState.auth = { currentUser: { uid: 'audit-user', getIdToken: async () => 'synthetic-id' } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true; firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0;
    firebaseState.dbRefHistory = ref(H) as any; firebaseState.dbRefDeleted = ref(T) as any; firebaseState.dbRefDailyRevenue = ref(D) as any; firebaseState.dbRefMonthlyRevenue = ref(M) as any;
    firebaseState.dbRefDailyPickup = ref('zoew_daily_pickup_cod_dod') as any; firebaseState.dbRefDailyCollected = ref('zoew_daily_collected_cod_dod') as any;
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    resetZtoTrashMode(); noteZtoTrashMode(null); uiState.toasts = [];
    vi.stubGlobal('fetch', vi.fn(cleanupServerRead(getAt)));
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => { firebaseState.authGeneration++; vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as any).ZoeErrors; });

describe('deduction landed · flip lost · journal lost ➜ the day-key sweep repairs the flag', () => {
    it('control (returned): the 8-day abandon is flipped by another device\'s sweep and the collected value is right', async () => {
        const id = seed();
        lab.refuseFlip = true;
        await claimAndCleanupItem(id, 'abandon'); sync();
        expect(getAt(D + '/' + DAY())).toMatchObject({ codDollar: 100, dodDollar: 20, totalCount: 10 });
        const trash = dataState.deletedItems[0];
        expect(trash.barcodes[0].isDeducted).toBe(false);
        expect(ledgerDedOfForTest(getAt(D + '/' + DAY()), trash.id)).toBeTruthy();
        appLocalStore.removeItem(CLEANUP_JOURNAL_KEY); lab.refuseFlip = false;
        vi.setSystemTime(NOW + 11 * 60000); sync();
        runCleanupLedgerKeySweep(); await vi.waitFor(() => expect(getAt(T + '/' + trash.id).barcodes[0].isDeducted).toBe(true)); sync();
        expect(shownCollected()).toEqual({ cod: 100, dod: 20, total: 120 });
    });

    it('remove: the same state for a manual Remove is flipped by the sweep ➜ «ចំណូល (យករួច)» is right', async () => {
        const id = seed();
        lab.refuseFlip = true;
        expect(await removeSingleBarcode(id, CODE)).toBe('pending'); sync();
        expect(getAt(D + '/' + DAY())).toMatchObject({ codDollar: 100, dodDollar: 20, totalCount: 10 });
        const trash = dataState.deletedItems[0];
        expect(trash.trashReason).toBe('remove');
        expect(ledgerDedOfForTest(getAt(D + '/' + DAY()), trash.id)).toBeTruthy();
        appLocalStore.removeItem(CLEANUP_JOURNAL_KEY); lab.refuseFlip = false;
        vi.setSystemTime(NOW + 11 * 60000); sync();
        runCleanupLedgerKeySweep(); await new Promise((r) => setTimeout(r, 20)); sync();
        expect({ flag: getAt(T + '/' + trash.id).barcodes[0].isDeducted, shown: shownCollected() })
            .toEqual({ flag: true, shown: { cod: 100, dod: 20, total: 120 } });
    });
});
