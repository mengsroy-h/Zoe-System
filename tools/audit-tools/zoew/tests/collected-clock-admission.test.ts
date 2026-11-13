import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../../../../ZoeW/src/core/state';
import { acceptServerClockOffset, resetServerClock, serverClockIsTrustworthy, setServerClockRefresh } from '../../../../ZoeW/src/core/clock';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { reconcileCollectedHistory, syncCollectedValueForBarcode } from '../../../../ZoeW/src/domain/collected';
import { pickupIntentTracker, pickupIntentsLive, readPickupJournal, releasePickupIntent, resumePickupIntents } from '../../../../ZoeW/src/domain/pickup';

const NOW = Date.UTC(2026, 10, 8, 9), DAY = '2026-11-08', DAY_MS = 86400000;
const H = 'zoew_scan_history_cod_dod', C = 'zoew_daily_collected_cod_dod';
const clone = (value: any) => value == null ? value : JSON.parse(JSON.stringify(value));
let tree: Record<string, any>, monotonic: number, writes: number;
let beforeRead: null | (() => Promise<void>), afterWrite: null | (() => void);
function get(path: string) { return clone(path.split('/').filter(Boolean).reduce((node: any, part) => node?.[part], tree) ?? null); }
function put(path: string, value: any) {
    const parts = path.split('/').filter(Boolean); let parent = tree;
    for (const part of parts.slice(0, -1)) parent = parent[part] ||= {};
    if (value == null) delete parent[parts.at(-1)!]; else parent[parts.at(-1)!] = clone(value);
}
function sample(now = NOW) {
    expect(acceptServerClockOffset(now - Date.now(), null, false)).toBe(true);
    firebaseState.sessionExpiryCheck = 'live';
}
async function confirmedPending() {
    const tracker = pickupIntentTracker(() => true, 'item1');
    expect(await tracker.prepare(DAY, ['ONE'])).toBeTruthy();
    expect(tracker.start()).toBe(true); expect(tracker.confirm(['ONE'])).toBe(true); tracker.release();
    expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].transitionKnown).toBe(true);
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    monotonic = 1000; vi.spyOn(performance, 'now').mockImplementation(() => monotonic);
    writes = 0; beforeRead = null; afterWrite = null;
    appLocalStore.clear(); appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://collected-clock.firebaseio.com' }));
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear(); pickupIntentsLive.clear();
    tree = { [H]: { item1: { id: 'item1', phone: '012345678', scanDate: DAY, createdAt: NOW - 1000, isClosed: true,
        barcodes: [{ code: 'ONE', cod: 12.5, dod: 0, createdAt: NOW - 1000, isClosed: true, closedAt: NOW }] } },
    [C]: { [DAY]: { ONE: { c: 12.5, d: 0 } } } };
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'clock-owner' } } as any;
    firebaseState.db = { app: { options: { databaseURL: 'https://collected-clock.firebaseio.com' } } } as any;
    firebaseState.isInitializingFirebase = false; firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true; firebaseState.hasEverConnectedToDatabase = true; firebaseState.dbListenersFailed = false;
    firebaseState.fb = {
        ref: (_db: any, path = '') => ({ path }),
        get: async (ref: any) => {
            const value = get(ref.path);
            if (beforeRead && ref.path === H + '/item1') { const run = beforeRead; beforeRead = null; await run(); }
            return { val: () => clone(value), exists: () => value !== null };
        },
        update: async (ref: any, values: Record<string, any>) => {
            if (ref.path === C) writes++;
            for (const [key, value] of Object.entries(values)) put(ref.path + '/' + key, value);
            if (afterWrite && ref.path === C) { const run = afterWrite; afterWrite = null; run(); }
        },
        runTransaction: async (ref: any, updater: (value: any) => any) => {
            const next = updater(get(ref.path));
            if (next === undefined) return { committed: false, snapshot: { val: () => get(ref.path) } };
            put(ref.path, next); return { committed: true, snapshot: { val: () => get(ref.path) } };
        }
    } as any;
    firebaseState.dbRefHistory = { path: H } as any;
    firebaseState.dbRefDeleted = { path: 'zoew_recently_deleted_cod_dod' } as any;
    firebaseState.dbRefDailyPickup = { path: 'zoew_daily_pickup_cod_dod' } as any;
    firebaseState.dbRefDailyCollected = { path: C } as any;
    dataState.scanHistory = Object.values(clone(tree[H])); dataState.deletedItems = []; dataState.dailyPickupData = {};
    dataState.dailyCollectedData = clone(tree[C]); dataState.pickupResumeInFlight = false; uiState.toasts = [];
    resetServerClock(); setServerClockRefresh(null); sample();
});
afterEach(() => {
    for (const id of pickupIntentsLive) releasePickupIntent(id);
    resetServerClock(); setServerClockRefresh(null); appLocalStore.clear(); vi.useRealTimers();
});

it.each([-365, 365])('ចាប់ផ្ដើមឡើងវិញ ដោយម៉ោងមិនទាន់ផ្ទៀង %s ថ្ងៃ រក្សាចំណូល និង journal', async days => {
    await confirmedPending(); const pending = readPickupJournal()[0];
    resetServerClock(); vi.setSystemTime(NOW + days * DAY_MS);
    expect(serverClockIsTrustworthy()).toBe(false);
    await resumePickupIntents();
    expect(writes).toBe(0); expect(get(C + '/' + DAY + '/ONE')).toEqual({ c: 12.5, d: 0 });
    expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].id).toBe(pending.id);
    sample(); await resumePickupIntents();
    expect(readPickupJournal()).toEqual([]); expect(get(C + '/' + DAY + '/ONE')).toEqual({ c: 12.5, d: 0 });
    expect(get(H + '/item1').barcodes[0].closedAt).toBe(NOW);
});

it.each([false, true])('ពេលអានភស្តុតាង ម៉ោងលោតហើយ sample ថ្មី=%s មិនសង្គ្រោះ lease ចាស់', async refresh => {
    let entered!: () => void, release!: () => void;
    const reached = new Promise<void>(resolve => { entered = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    beforeRead = async () => { entered(); await held; };
    const running = reconcileCollectedHistory('item1', ['ONE']); await reached;
    vi.setSystemTime(NOW + DAY_MS);
    if (refresh) sample();
    release(); expect(await running).toBeNull(); expect(writes).toBe(0);
    expect(get(C + '/' + DAY + '/ONE')).toEqual({ c: 12.5, d: 0 });
    if (!refresh) sample();
    expect(await reconcileCollectedHistory('item1', ['ONE'])).toBe(true);
});

it('ការសរសេរបានបញ្ចប់មុនម៉ោងមិនប្រាកដ រក្សាចំណូល ហើយទុក journal សម្រាប់ផ្ទៀងម្ដងទៀត', async () => {
    await confirmedPending(); afterWrite = () => { vi.setSystemTime(NOW + DAY_MS); };
    await resumePickupIntents();
    expect(writes).toBe(1); expect(readPickupJournal()).toHaveLength(1);
    expect(get(C + '/' + DAY + '/ONE')).toEqual({ c: 12.5, d: 0 });
    sample(); await resumePickupIntents(); expect(readPickupJournal()).toEqual([]);
});

it('ម៉ោងដែលបានផ្ទៀងនៅតែអនុញ្ញាតឱ្យដកចំណូលលើសអាយុ', async () => {
    const old = '2026-10-29'; tree[H].item1.barcodes[0].closedAt = NOW - 10 * DAY_MS;
    tree[C] = { [old]: { ONE: { c: 12.5, d: 0 } } }; dataState.dailyCollectedData = clone(tree[C]);
    expect(await reconcileCollectedHistory('item1', ['ONE'])).toBe(true);
    expect(get(C + '/' + old + '/ONE')).toBeNull(); expect(writes).toBe(1);
    expect(get(H + '/item1').barcodes[0].closedAt).toBe(NOW - 10 * DAY_MS);
});

it('ចន្លោះម៉ោងកាត់អធ្រាត្ររក្សាថ្ងៃចុងក្រោយនៃអាយុចំណូល', async () => {
    const midnight = Date.UTC(2026, 10, 8, 17), old = '2026-11-02';
    vi.setSystemTime(midnight + 500); resetServerClock();
    expect(acceptServerClockOffset(0, Object.freeze({ epochMs: midnight - 500, estimateEpochMs: midnight + 500,
        uncertaintyMs: 2000, wallMs: Date.now(), monotonicMs: monotonic }), false)).toBe(true);
    firebaseState.sessionExpiryCheck = 'live';
    tree[H].item1.barcodes[0].closedAt = Date.UTC(2026, 10, 2, 2);
    tree[C] = { [old]: { ONE: { c: 12.5, d: 0 } } }; dataState.dailyCollectedData = clone(tree[C]);
    expect(await reconcileCollectedHistory('item1', ['ONE'])).toBeNull();
    expect(writes).toBe(0); expect(get(C + '/' + old + '/ONE')).toEqual({ c: 12.5, d: 0 });
    expect(get(H + '/item1').barcodes[0].closedAt).toBe(Date.UTC(2026, 10, 2, 2));
});

it.each([true, false])('ការកែតម្លៃ និងដក mirror ដែលបើករួច មិនពឹងអាយុ closed=%s', async closed => {
    resetServerClock(); vi.setSystemTime(NOW + 365 * DAY_MS);
    Object.assign(tree[H].item1.barcodes[0], { cod: 15, isClosed: closed });
    expect(await syncCollectedValueForBarcode('item1', 'ONE')).toBe(true);
    expect(get(C + '/' + DAY + '/ONE')).toEqual(closed ? { c: 15, d: 0 } : null);
    expect(get(H + '/item1').barcodes[0].closedAt).toBe(NOW);
});
