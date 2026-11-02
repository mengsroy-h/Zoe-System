import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { toggleCloseStatus } from '../src/features/entry-ops';
import { pickupIntentTracker, pickupIntentsLive, readPickupJournal, resumePickupIntents, releasePickupIntent } from '../src/domain/pickup';
import { resetPickupStats } from '../src/domain/collected';
import { txReadServerValue } from '../src/services/tx-outcome';

vi.mock('../src/services/tx-outcome', async (importOriginal) => ({
    ...await importOriginal<typeof import('../src/services/tx-outcome')>(),
    txRestUrl: vi.fn(() => null),
    txReadServerValue: vi.fn(() => { throw new Error('Unexpected REST execution in frontend SDK fixture'); })
}));

const NOW = Date.UTC(2026, 9, 30, 9), DAY = '2026-10-30';
const HISTORY = 'zoew_scan_history_cod_dod', PICKUP = 'zoew_daily_pickup_cod_dod';
const clone = (value: any) => value === undefined ? undefined : structuredClone(value);
let tree: any, attempts: string[], mode: string, retryUpdater: boolean, releaseAck: (() => void) | undefined;
const valueAt = (path: string) => clone(path.split('/').filter(Boolean).reduce((value, key) => value?.[key], tree) ?? null);
function put(path: string, value: any) {
    const parts = path.split('/').filter(Boolean); let node = tree;
    for (const part of parts.slice(0, -1)) node = node[part] ||= {};
    if (value == null) delete node[parts.at(-1)!]; else node[parts.at(-1)!] = clone(value);
}
const snapshot = (value: any) => ({ val: () => clone(value), exists: () => value != null });
const flush = async () => { for (let index = 0; index < 50; index++) await Promise.resolve(); };
function load() {
    dataState.scanHistory = Object.values(clone(tree[HISTORY] || {})); dataState.deletedItems = [];
    dataState.dailyPickupData = clone(tree[PICKUP] || {}); dataState.dailyCollectedData = clone(tree.zoew_daily_collected_cod_dod || {});
}
beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(NOW); appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://pickup-budget.invalid' }));
    mode = 'normal'; attempts = []; releaseAck = undefined; retryUpdater = false;
    pickupIntentsLive.clear(); dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    firebaseState.authGeneration++; firebaseState.auth = { currentUser: { uid: 'budget-owner' } } as any;
    firebaseState.db = { app: { options: { databaseURL: 'https://pickup-budget.invalid' } } } as any;
    firebaseState.isInitializingFirebase = false; firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true;
    firebaseState.dbListenersFailed = false; firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0;
    ztoState.ztoTrashMode = { state: 'off', palmAt: 0, cookieAt: 0, failedAt: 0, stamps: {}, shop: 'https://pickup-budget.invalid' };
    const barcode = { code: 'BUDGET_A', createdAt: NOW - 3600000, isClosed: false, isDeducted: false, cod: 5, dod: 0 };
    tree = { [HISTORY]: { target: { id: 'target', phone: '000000001', scanDate: DAY, createdAt: barcode.createdAt,
        isClosed: false, barcodes: [barcode], count: 1, cod: 5, dod: 0, price: 5 } },
    [PICKUP]: { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 0 } } };
    firebaseState.fb = {
        ref: (_database: any, path = '') => ({ path }), get: async (ref: any) => snapshot(valueAt(ref.path)),
        update: async (ref: any, values: any) => { for (const [key, value] of Object.entries(values)) put([ref.path, key].filter(Boolean).join('/'), value); },
        runTransaction: async (ref: any, updater: any) => {
            attempts.push(ref.path);
            if (retryUpdater) updater(null);
            const commit = () => { const next = updater(valueAt(ref.path)); if (next !== undefined) put(ref.path, next); return { committed: next !== undefined, snapshot: snapshot(valueAt(ref.path)) }; };
            if (mode === 'hang-pickup' && ref.path === PICKUP + '/' + DAY) return new Promise(resolve => { releaseAck = () => resolve(commit()); });
            const result = commit();
            if (mode === 'hold-pickup-ack' && ref.path === PICKUP + '/' + DAY) return new Promise(resolve => { releaseAck = () => resolve(result); });
            if (mode === 'interrupt-close' && ref.path === HISTORY + '/target') firebaseState.authGeneration++;
            return result;
        }
    } as any;
    for (const [key, path] of Object.entries({ dbRefHistory: HISTORY, dbRefDeleted: 'zoew_recently_deleted_cod_dod', dbRefDailyPickup: PICKUP,
        dbRefDailyCollected: 'zoew_daily_collected_cod_dod', dbRefDailyRevenue: 'zoew_daily_revenue_cod_dod', dbRefMonthlyRevenue: 'zoew_monthly_revenue_cod_dod' })) (firebaseState as any)[key] = { path };
    dataState.dailyRevenueData = {}; dataState.monthlyRevenueData = {}; dataState.pickupResumeInFlight = false; dataState.pickupResetInFlight = false; uiState.currentFilterMode = 'all'; uiState.toasts = [];
    vi.stubGlobal('navigator', { locks: undefined }); vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', () => undefined); load();
});
afterEach(async () => {
    mode = 'normal'; releaseAck?.(); await flush();
    expect(txReadServerValue).not.toHaveBeenCalled();
    for (const id of pickupIntentsLive) releasePickupIntent(id);
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); appLocalStore.clear();
});
async function parkTwo() {
    mode = 'interrupt-close'; await toggleCloseStatus('target'); mode = 'normal'; load();
    expect(readPickupJournal()).toHaveLength(1);
    expect(tree[HISTORY].target.barcodes[0].pickupTransition).toBeTruthy();
    const later = pickupIntentTracker(() => true, 'other'); expect(await later.prepare(DAY, ['BUDGET_B'])).toBeTruthy(); later.release();
    expect(readPickupJournal()).toHaveLength(2); return clone(readPickupJournal()[0]);
}
it.each([false, true])('ភស្តុតាង ACK ធម្មតាបញ្ចប់ intents ទាំងពីរ (updater retry=%s)', async (retry) => {
    retryUpdater = retry; await parkTwo(); await resumePickupIntents();
    expect(readPickupJournal()).toEqual([]); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(1); expect(dataState.pickupResumeInFlight).toBe(false);
});
it.each([false, true])('CAS រង់ចាំរក្សា identity និងឱ្យ tail បន្តដោយមិនសរសេរស្ទួន (updater retry=%s)', async (retry) => {
    retryUpdater = retry; const original = await parkTwo(); const before = attempts.filter(path => path === PICKUP + '/' + DAY).length;
    mode = 'hang-pickup'; let settled = false; const running = resumePickupIntents().then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(60001); await resumePickupIntents();
    const pending = readPickupJournal().find(entry => entry.id === original.id)!;
    for (const key of ['id', 'uid', 'scope', 'date', 'item', 'keys', 'closePlan', 'pickupResetEpoch']) expect(pending[key]).toEqual(original[key]);
    expect(pending.stage).toBe('started'); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0);
    expect(attempts.filter(path => path === PICKUP + '/' + DAY).length - before).toBe(1);
    expect.soft(settled).toBe(true); expect.soft(dataState.pickupResumeInFlight).toBe(false);
    expect.soft(readPickupJournal().filter(entry => entry.stage === 'prepared')).toHaveLength(0);
    mode = 'normal'; releaseAck?.(); await running; await flush();
    expect(readPickupJournal()).toEqual([]); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(1);
});
it('ចម្លើយរង់ចាំក្រោយប្តូរ session មិនប្តូរទិដ្ឋភាពថ្មី', async () => {
    const original = await parkTwo(); mode = 'hang-pickup'; const running = resumePickupIntents();
    await vi.advanceTimersByTimeAsync(60001);
    firebaseState.authGeneration++; dataState.dailyPickupData = { fresh: { packagesPickedUp: 9 } };
    mode = 'normal'; releaseAck?.(); await running; await flush();
    expect(dataState.dailyPickupData).toEqual({ fresh: { packagesPickedUp: 9 } });
    expect(readPickupJournal().map(entry => entry.id)).toContain(original.id);
});
it.each([false, true])('ACK pickup ចាស់រក្សា authoritative view និងមិនធ្វើ CAS ថ្មី (newer Reset=%s)', async (reset) => {
    await parkTwo(); mode = 'hold-pickup-ack'; const running = resumePickupIntents();
    await vi.advanceTimersByTimeAsync(15001); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(1);
    load(); mode = 'normal'; if (reset) await resetPickupStats();
    const authoritative = clone(tree[PICKUP][DAY]); const before = attempts.filter(path => path === PICKUP + '/' + DAY).length;
    releaseAck?.(); await running; await flush();
    expect(tree[PICKUP][DAY]).toEqual(authoritative);
    expect.soft(dataState.dailyPickupData[DAY]).toEqual({ ...authoritative, pickedUpPhones: authoritative.pickedUpPhones || {}, pickedUpBarcodes: authoritative.pickedUpBarcodes || {} });
    expect(attempts.filter(path => path === PICKUP + '/' + DAY).length).toBe(before); expect(readPickupJournal()).toEqual([]);
});
