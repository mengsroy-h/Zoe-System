/**
 * ⛔ M5 (ការសម្រេចម្ចាស់គម្រោង ៖ «ដក» ដក key យករួចផង) ៖ ស្ថិតិ «យករួច» តាមប្រាក់។ «ដក» Barcode ដែលបិទរួចកាត់ COD · DOD ·
 *    ចំនួនកញ្ចប់ ប៉ុន្តែ key របស់វានៅក្នុង `zoew_daily_pickup_cod_dod/<ថ្ងៃ>/pickedUpBarcodes` ➜ «យករួច» រាប់កញ្ចប់ដែលលែងមាន
 *    (អត្រាយក > ១០០%)។ ច្បាប់ ៖ copy ក្នុងធុងសំរាមដែលកាត់ប្រាក់ (`remove` · `returned`) មិនរាប់ជា «យករួច» · «ដក» លុប key ·
 *    «ស្តារ» Barcode បិទពីធុងសំរាមនោះដាក់ key វិញ · ទាំងពីររស់រានពេលទំព័រស្លាប់ (journal ការសម្អាត · journal ស្ថិតិយក) និង
 *    ការប្រណាំងឧបករណ៍ ២ (ការលុប key ចុះយឺតក្រោយការស្តារ ➜ ដាក់វិញ)។ ទិសផ្ទុយ ៖ «លុប» · Barcode បើក · Reset មិនកើតវិញ។
 */
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../../../../ZoeW/src/core/state';
import { resetServerClock } from '../../../../ZoeW/src/core/clock';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import * as storageAdapter from '../../../../ZoeW/src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { getZoneDateKey } from '../../../../ZoeW/src/core/timezone';
import { barcodeRegistryKey } from '../../../../ZoeW/src/domain/registry';
import * as cleanup from '../../../../ZoeW/src/domain/cleanup';
import * as pickup from '../../../../ZoeW/src/domain/pickup';
import { removeSingleBarcode } from '../../../../ZoeW/src/features/barcode-ops';
import { deleteSingleItem, toggleCloseStatus } from '../../../../ZoeW/src/features/entry-ops';
import { activeRestoreClaims, executeRestoreItem, restoreInFlight, saveRestoreClaim, storedRestoreClaims } from '../../../../ZoeW/src/features/restore';

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const PICKUP = 'zoew_daily_pickup_cod_dod';
const MIRROR = 'zoew_daily_collected_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const H = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 5, 9, 30, 0);
const DAY = getZoneDateKey(NOW - 2 * H, 0);
const MONTH = DAY.substring(0, 7);
const PHONE = '0960007345';
const DB = { name: 'm5-shop' };
const SHOP_CONFIG = JSON.stringify({ apiKey: 'k', databaseURL: 'https://m5-pickup-default-rtdb.firebaseio.com', projectId: 'p' });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitForState(check: () => void, { timeout = 1000 } = {}) {
    const deadline = performance.now() + timeout;
    while (true) {
        try { check(); return; }
        catch (error) {
            const remaining = deadline - performance.now();
            if (remaining <= 0) throw error;
            await sleep(Math.min(50, remaining));
        }
    }
}
const key = (code: string) => barcodeRegistryKey(code);

const lab = { store: {} as Record<string, any>, hang: [] as string[], txGate: null as null | ((path: string) => Promise<void> | null) };

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
const split = (path: string) => String(path || '').split('/').filter(Boolean);
function getAt(path: string) {
    let cur: any = lab.store;
    for (const part of split(path)) {
        if (cur === null || cur === undefined || typeof cur !== 'object') return null;
        cur = cur[part];
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
    if (value === null || value === undefined) delete cur[parts[parts.length - 1]];
    else cur[parts[parts.length - 1]] = clone(value);
}
const hangs = (path: string) => lab.hang.some((prefix) => path.indexOf(prefix) === 0);
const makeRef = (db: any, path = '') => ({ db, path: split(path).join('/'), key: split(path).pop() || null });
const snap = (ref: any, value: any) => ({ key: ref && ref.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined });
function makeFb() {
    return {
        ref: (db: any, path = '') => makeRef(db, path),
        increment: (n: number) => ({ __inc__: n }),
        get: async (ref: any) => { await sleep(1); return snap(ref, getAt(ref.path)); },
        set: async (ref: any, value: any) => { await sleep(1); setAt(ref.path, value); },
        update: async (ref: any, updates: any) => {
            const paths = Object.keys(updates).map((k) => [ref.path, k].filter(Boolean).join('/'));
            if (paths.some(hangs)) return new Promise(() => {});
            await sleep(1);
            paths.forEach((path, i) => {
                let value = updates[Object.keys(updates)[i]];
                if (value && typeof value === 'object' && value.__inc__ !== undefined) value = (Number(getAt(path)) || 0) + value.__inc__;
                setAt(path, value);
            });
        },
        runTransaction: (ref: any, updater: any) => {
            if (hangs(ref.path)) return new Promise(() => {});
            const gate = lab.txGate ? lab.txGate(ref.path) : null;
            return (gate || Promise.resolve()).then(() => sleep(1)).then(() => {
                const prior = getAt(ref.path);
                const proposed = updater(clone(prior));
                if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
                setAt(ref.path, proposed);
                return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
            });
        },
        onValue: () => () => {},
        off: () => {}
    };
}

function seedItem(id: string, codes: string[], closed: string[]) {
    const barcodes = codes.map((code, i) => {
        const b: any = { code, isClosed: closed.includes(code), cod: 4 + i, dod: 1, isDeducted: false, isFromDeletion: false, createdAt: NOW - 3 * H, time: '13:30:00', locker: 'N/A' };
        if (b.isClosed) b.closedAt = NOW - 2 * H;
        return b;
    });
    const cod = barcodes.reduce((s: number, b: any) => s + b.cod, 0);
    const item: any = { id, phone: PHONE, scanDate: DAY, isClosed: barcodes.every((b: any) => b.isClosed), createdAt: NOW - 3 * H,
        cod, dod: codes.length, price: cod + codes.length, count: codes.length, barcode: codes[0], time: '13:30:00 (' + DAY + ')', barcodes };
    if (item.isClosed) item.closedAt = NOW - 2 * H;
    setAt(HISTORY + '/' + id, item);
    codes.forEach((code) => setAt('zoew_barcode_registry/' + key(code), true));
    const pickedUp = barcodes.filter((b: any) => b.isClosed);
    pickedUp.forEach((b: any) => setAt(MIRROR + '/' + getZoneDateKey(b.closedAt, 0) + '/' + key(b.code), { c: b.cod, d: b.dod }));
    if (pickedUp.length) {
        const set: Record<string, string> = {};
        pickedUp.forEach((b: any) => { set[key(b.code)] = PHONE; });
        setAt(PICKUP + '/' + DAY, { packagesPickedUp: pickedUp.length, pickedUpPhones: { [PHONE]: pickedUp.length }, pickedUpBarcodes: set });
    }
    setAt(DAILY + '/' + DAY, { codDollar: 100, dodDollar: 10, totalCount: 10 });
    setAt(MONTHLY + '/' + MONTH, { codDollar: 100, dodDollar: 10, totalCount: 10 });
}
function loadViewsFromServer() {
    const list = (root: string) => { const raw = getAt(root) || {}; return Object.keys(raw).map((k) => Object.assign({ id: k }, raw[k])); };
    dataState.scanHistory = list(HISTORY);
    dataState.deletedItems = list(TRASH);
    dataState.dailyPickupData = getAt(PICKUP) || {};
    dataState.dailyCollectedData = getAt(MIRROR) || {};
    dataState.dailyRevenueData = getAt(DAILY) || {};
    dataState.monthlyRevenueData = getAt(MONTHLY) || {};
}
function crashAndReload() {
    firebaseState.authGeneration++;
    pickup.pickupIntentsLive.clear();
    cleanup.cleanupJournalLive.clear();
    cleanup.cleanupInFlight.clear();
    activeRestoreClaims.clear();
    restoreInFlight.clear();
    dataState.pickupResumeInFlight = false;
    dataState.cleanupResumeInFlight = false;
    lab.hang = [];
    lab.txGate = null;
    loadViewsFromServer();
}
async function resumeDoors() {
    await pickup.resumePickupIntents();
    await cleanup.resumeInterruptedCleanups();
    await cleanup.cleanupResumeBarrier.settled;
}
async function restore(trashId: string) {
    loadViewsFromServer();
    uiState.pendingRestoreId = trashId;
    await executeRestoreItem();
    await sleep(20);
}
const pickupKeys = () => Object.keys((getAt(PICKUP + '/' + DAY) || {}).pickedUpBarcodes || {}).sort();
const pickupCount = () => (getAt(PICKUP + '/' + DAY) || {}).packagesPickedUp;
const memoryKeys = () => Object.keys((dataState.dailyPickupData[DAY] || {}).pickedUpBarcodes || {}).sort();
const pickupJournal = () => pickup.readPickupJournal();
const cleanupJournal = () => cleanup.readCleanupJournal();
const serverBarcode = (id: string, code: string) => ((getAt(HISTORY + '/' + id) || {}).barcodes || []).find((b: any) => b.code === code) || null;
const trashItems = () => Object.entries(getAt(TRASH) || {}).map(([id, item]: [string, any]) => ({ ...item, id }));
const revenueDay = () => {
    const day = getAt(DAILY + '/' + DAY) || {};
    return [Math.round((day.codDollar || 0) * 100) / 100, Math.round((day.dodDollar || 0) * 100) / 100, day.totalCount];
};

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    lab.store = {};
    lab.hang = [];
    lab.txGate = null;
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', SHOP_CONFIG);
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = {};
    dataState.monthlyRevenueData = {};
    dataState.dailyCollectedData = {};
    dataState.dailyPickupData = {};
    dataState.pickupResumeInFlight = false;
    dataState.cleanupResumeInFlight = false;
    uiState.toasts = [];
    uiState.scanRemoveInFlight = null;
    pickup.pickupIntentsLive.clear();
    cleanup.cleanupJournalLive.clear();
    cleanup.cleanupInFlight.clear();
    activeRestoreClaims.clear();
    restoreInFlight.clear();
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'm5-pickup' } } as any;
    firebaseState.db = DB as any;
    firebaseState.firebaseConfig = { databaseURL: 'https://m5-pickup-default-rtdb.firebaseio.com' } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.dbListenersFailed = false;
    firebaseState.isDatabaseConnected = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.fb = makeFb() as any;
    for (const [name, path] of [['dbRefHistory', HISTORY], ['dbRefDeleted', TRASH], ['dbRefDailyRevenue', DAILY], ['dbRefMonthlyRevenue', MONTHLY],
        ['dbRefDailyCollected', MIRROR], ['dbRefDailyPickup', PICKUP], ['dbRefRegistry', 'zoew_barcode_registry']] as const) {
        (firebaseState as any)[name] = makeRef(DB, path);
    }
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => undefined);
    (window as any).ZoeErrors = { capture: () => {} };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    expect(Date.now()).toBe(NOW);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as any).ZoeErrors;
    firebaseState.dbLivenessProbe = null as any;
    firebaseState.serverClockTrusted = false;
    firebaseState.isDatabaseConnected = false;
    firebaseState.isDatabaseInitialized = false;
    appLocalStore.clear();
});

it('⛔ ដក Barcode បិទ ៖ key យករួចចេញ (server + memory) ក្នុងប្រតិបត្តិការផ្ទាល់ · ប្រាក់ដកម្តង · journal ទទេ', async () => {
    seedItem('p1', ['M5P0001', 'M5P0002'], ['M5P0001']);
    loadViewsFromServer();
    expect(pickupKeys(), 'លក្ខខណ្ឌមុន ៖ key របស់ Barcode បិទ').toEqual([key('M5P0001')]);
    expect(await removeSingleBarcode('p1', 'M5P0001')).toBe('done');
    await sleep(20);
    expect(revenueDay(), 'ប្រាក់ និងចំនួនកញ្ចប់ដកម្តង').toEqual([96, 9, 9]);
    expect(pickupKeys(), 'key យករួចចេញពី server').toEqual([]);
    expect(pickupCount()).toBe(0);
    expect(memoryKeys(), 'key យករួចចេញពី memory').toEqual([]);
    expect(dataState.dailyPickupData[DAY].packagesPickedUp).toBe(0);
    expect(cleanupJournal()).toEqual([]);
    expect(pickupJournal()).toEqual([]);
});

it('ទិសផ្ទុយ ៖ ដក Barcode បើក · លុបកញ្ចប់បិទ (មិនកាត់ប្រាក់) ➜ ស្ថិតិយករួចមិនប៉ះ', async () => {
    seedItem('p2', ['M5P0021', 'M5P0022'], ['M5P0021']);
    loadViewsFromServer();
    expect(await removeSingleBarcode('p2', 'M5P0022')).toBe('done');
    await sleep(20);
    expect(pickupKeys(), 'ដក Barcode បើក ➜ key របស់ Barcode បិទនៅ').toEqual([key('M5P0021')]);
    expect(pickupCount()).toBe(1);
    loadViewsFromServer();
    await deleteSingleItem('p2', { confirmed: true, quiet: true });
    await sleep(20);
    expect(trashItems().map((t) => t.trashReason).sort(), 'លក្ខខណ្ឌមុន ៖ កញ្ចប់ចូលធុងសំរាម «លុប»').toEqual(['delete', 'remove']);
    expect(pickupKeys(), '«លុប» មិនកាត់ប្រាក់ ➜ key នៅ').toEqual([key('M5P0021')]);
    expect(pickupCount()).toBe(1);
});

it('⛔ ដក ៖ claim កញ្ចប់រួច · ធុងសំរាមមិនទាន់ ➜ ទំព័រស្លាប់ ➜ ការស្តារ journal ដកប្រាក់ ហើយលុប key យករួច', async () => {
    seedItem('p3', ['M5P0031', 'M5P0032'], ['M5P0031']);
    loadViewsFromServer();
    lab.hang = [TRASH];
    void removeSingleBarcode('p3', 'M5P0031');
    await waitForState(() => expect(serverBarcode('p3', 'M5P0031')).toBeNull());
    expect(serverBarcode('p3', 'M5P0031'), 'លក្ខខណ្ឌមុន ៖ Barcode ចេញពីកញ្ចប់លើ server').toBeNull();
    expect(pickupKeys(), 'លក្ខខណ្ឌមុន ៖ key មិនទាន់ប៉ះ').toEqual([key('M5P0031')]);
    crashAndReload();
    await resumeDoors();
    expect(trashItems().map((t) => [t.trashReason, t.barcodes[0].isDeducted]), 'ធុងសំរាម «ដក» · ប្រាក់ដករួច').toEqual([['remove', true]]);
    expect(revenueDay()).toEqual([96, 9, 9]);
    expect(pickupKeys(), 'ការស្តារលុប key យករួច').toEqual([]);
    expect(pickupCount()).toBe(0);
    expect(cleanupJournal()).toEqual([]);
});

it('⛔ ដកផ្ទាល់ ៖ ការលុប key យករួចព្យួរ ➜ ✅ ភ្លាម · journal នៅ «collected» ➜ ទំព័រស្លាប់ ➜ ការស្តារលុប key · ប្រាក់ដកម្តង', async () => {
    seedItem('p4', ['M5P0041', 'M5P0042'], ['M5P0041']);
    loadViewsFromServer();
    await pickup.capturePickupContext(DAY);
    lab.hang = [PICKUP];
    expect(await removeSingleBarcode('p4', 'M5P0041')).toBe('done');
    await sleep(20);
    expect(cleanupJournal().map((e: any) => e.stage), 'ការលុប key មិនទាន់ចុះ ➜ journal នៅ «collected»').toEqual(['collected']);
    expect(pickupKeys(), 'លក្ខខណ្ឌមុន ៖ key នៅលើ server').toEqual([key('M5P0041')]);
    crashAndReload();
    await resumeDoors();
    expect(pickupKeys(), 'ការស្តារលុប key').toEqual([]);
    expect(cleanupJournal()).toEqual([]);
    expect(revenueDay(), 'ប្រាក់ដកតែម្តង').toEqual([96, 9, 9]);
});

it('⛔ ស្តារ Barcode បិទពីធុងសំរាម «ដក» ➜ key យករួចត្រឡប់ · ប្រាក់បូកវិញម្តង · ស្តារ Barcode បើក ➜ គ្មាន key', async () => {
    seedItem('p5', ['M5P0051', 'M5P0052', 'M5P0053'], ['M5P0051']);
    loadViewsFromServer();
    await removeSingleBarcode('p5', 'M5P0051');
    loadViewsFromServer();
    await removeSingleBarcode('p5', 'M5P0052');
    await sleep(20);
    expect(pickupKeys(), 'លក្ខខណ្ឌមុន ៖ key ចេញ').toEqual([]);
    const closedTrash = trashItems().find((t) => t.barcodes[0].code === 'M5P0051');
    const openTrash = trashItems().find((t) => t.barcodes[0].code === 'M5P0052');
    await restore(closedTrash.id);
    expect(getAt(TRASH + '/' + closedTrash.id), 'លក្ខខណ្ឌមុន ៖ ស្តាររួច').toBeNull();
    expect(serverBarcode('p5', 'M5P0051').isClosed).toBe(true);
    expect(pickupKeys(), 'ស្តារ Barcode បិទ ➜ key ត្រឡប់').toEqual([key('M5P0051')]);
    expect(pickupCount()).toBe(1);
    expect(getAt(PICKUP + '/' + DAY).pickedUpPhones).toEqual({ [PHONE]: 1 });
    await restore(openTrash.id);
    expect(serverBarcode('p5', 'M5P0052').isClosed).toBe(false);
    expect(pickupKeys(), 'ស្តារ Barcode បើក ➜ គ្មាន key ថ្មី').toEqual([key('M5P0051')]);
    expect(revenueDay(), 'ប្រាក់ត្រឡប់ដូចដើម').toEqual([100, 10, 10]);
    expect(pickupJournal()).toEqual([]);
});

it.each(['pickup', 'collected'] as const)('Restore ចម្លើយ %s មកក្រោយប្ដូរហាង មិនលុប claim ថ្មី ឬបង្ហាញជោគជ័យក្នុងហាងថ្មី', async phase => {
    seedItem('late_restore', ['LATE_CLOSED', 'KEPT_OPEN'], ['LATE_CLOSED']);
    loadViewsFromServer();
    await removeSingleBarcode('late_restore', 'LATE_CLOSED');
    await sleep(20);
    const trash = trashItems()[0];
    const sdk = firebaseState.fb as any;
    const originalTx = sdk.runTransaction, originalGet = sdk.get;
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let waiting = false;
    if (phase === 'pickup') sdk.runTransaction = async (ref: any, updater: any, options: any) => {
        const result = await originalTx(ref, updater, options);
        if (ref.path === PICKUP + '/' + DAY && getAt(TRASH + '/' + trash.id) === null) { waiting = true; await gate; }
        return result;
    };
    else sdk.get = async (ref: any) => {
        const result = await originalGet(ref);
        if (ref.path === HISTORY + '/late_restore' && getAt(TRASH + '/' + trash.id) === null
            && pickupJournal().length === 0) { waiting = true; await gate; }
        return result;
    };
    const restoring = restore(trash.id);
    try {
        await waitForState(() => expect(waiting).toBe(true));
        expect(getAt(TRASH + '/' + trash.id)).toBeNull();
        expect(revenueDay()).toEqual([100, 10, 10]);
        firebaseState.authGeneration++;
        firebaseState.db = { name: 'another-shop' } as any;
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://another-shop.firebaseio.com' }));
        const nextClaim = { token: 'next-shop-token', targetId: 'next-shop-row' };
        activeRestoreClaims.set(trash.id, nextClaim);
        saveRestoreClaim(trash.id, nextClaim);
        uiState.toasts = [];
        release();
        await restoring;
        expect.soft(activeRestoreClaims.get(trash.id)).toEqual(nextClaim);
        expect.soft(storedRestoreClaims()[trash.id]).toMatchObject(nextClaim);
        expect(uiState.toasts).toEqual([]);
    } finally { release(); await restoring; }
});

it('⛔ ស្តារ ៖ ការដាក់ key ព្យួរ ➜ ទំព័រស្លាប់ ➜ journal ស្ថិតិយកដាក់ key វិញ', async () => {
    seedItem('p6', ['M5P0061', 'M5P0062'], ['M5P0061']);
    loadViewsFromServer();
    await removeSingleBarcode('p6', 'M5P0061');
    await sleep(20);
    const trash = trashItems()[0];
    lab.hang = [PICKUP];
    void restore(trash.id);
    await waitForState(() => expect(getAt(TRASH + '/' + trash.id), 'លក្ខខណ្ឌមុន ៖ ការស្តារបញ្ចប់លើ server').toBeNull(), { timeout: 3000 });
    await sleep(20);
    expect(pickupKeys(), 'លក្ខខណ្ឌមុន ៖ key មិនទាន់ចុះ').toEqual([]);
    expect(pickupJournal().length, 'journal ស្ថិតិយកនៅ').toBe(1);
    crashAndReload();
    await resumeDoors();
    expect(pickupKeys(), 'ការស្តារ journal ដាក់ key វិញ').toEqual([key('M5P0061')]);
    expect(pickupJournal()).toEqual([]);
});

it.each(['exact', 'missing', 'generation', 'birth', 'time', 'scope', 'duplicate', 'target-birth', 'target-missing', 'different-target-stale-view', 'clear-claim-false', 'barcode-claim-zero', 'target-changed-after-proof', 'barcode-disappears-at-holder', 'birth-changes-at-holder', 'busy-at-holder'] as const)('⛔ ឧបករណ៍ ២ ៖ Remove → Restore · consumption %s · mirror recovery មិនប៉ះប្រាក់', async (proof) => {
    seedItem('p7', ['M5P0071', 'M5P0072'], ['M5P0071']);
    loadViewsFromServer();
    await pickup.capturePickupContext(DAY);
    const adapter: any = firebaseState.fb;
    const runTransaction = adapter.runTransaction;
    let receive!: (value: any) => void;
    const delayedResult = new Promise<any>((resolve) => { receive = resolve; });
    let tracked = false;
    adapter.runTransaction = (ref: any, updater: any) => {
        const pending = runTransaction(ref, updater);
        if (!tracked && ref.path === PICKUP + '/' + DAY) { tracked = true; pending.then(receive); }
        return pending;
    };
    let release: () => void = () => {};
    let gated = 0;
    lab.txGate = (path) => (path.indexOf(PICKUP) === 0 && !gated++ ? new Promise<void>((r) => { release = r; }) : null);
    expect(await removeSingleBarcode('p7', 'M5P0071')).toBe('done');
    await sleep(20);
    expect(gated, 'លក្ខខណ្ឌមុន ៖ ការលុប key កំពុងរង់ចាំ').toBe(1);
    const trash = trashItems()[0];
    expect(trash.trashGeneration).toBe(1);
    if (proof === 'different-target-stale-view') {
        const original = getAt(HISTORY + '/p7');
        setAt(HISTORY + '/p7', { ...original, phone: '098765432' });
        setAt(HISTORY + '/restore_peer', { ...original, id: 'restore_peer', barcode: 'PEER70002', barcodes: original.barcodes.map((b: any) => ({ ...b, code: 'PEER70002' })) });
    }
    await restore(trash.id);
    const receiptPath = 'zoew_trash_consumptions/' + trash.id;
    const receipt = getAt(receiptPath);
    expect(receipt).toMatchObject({ sourceId: trash.id, generation: 1, kind: 'restore', deletedAt: trash.deletedAt, rowBirth: trash.createdAt || 0 });
    const moneyBefore = [getAt(DAILY), getAt(MONTHLY)];
    if (proof === 'missing') setAt(receiptPath, null);
    else if (proof === 'duplicate') setAt(HISTORY + '/duplicate', getAt(HISTORY + '/' + receipt.targetId));
    else if (proof === 'target-birth') { const row = getAt(HISTORY + '/' + receipt.targetId); row.barcodes.find((b: any) => b.code === 'M5P0071').createdAt++; setAt(HISTORY + '/' + receipt.targetId, row); }
    else if (proof === 'target-missing') setAt(HISTORY + '/' + receipt.targetId, null);
    else if (proof === 'clear-claim-false') setAt(HISTORY + '/' + receipt.targetId, { ...getAt(HISTORY + '/' + receipt.targetId), clearClaim: false });
    else if (proof === 'barcode-claim-zero') { const row = getAt(HISTORY + '/' + receipt.targetId); row.barcodes.find((b: any) => b.code === 'M5P0071').trashClaimAt = 0; setAt(HISTORY + '/' + receipt.targetId, row); }
    else if (proof !== 'exact' && proof !== 'different-target-stale-view' && proof !== 'target-changed-after-proof' && !proof.endsWith('-at-holder')) setAt(receiptPath, { ...receipt, ...(proof === 'generation' ? { generation: 2 } : proof === 'birth' ? { rowBirth: receipt.rowBirth + 1 } : proof === 'time' ? { deletedAt: receipt.deletedAt + 1 } : { scope: 'other-shop' }) });
    if (proof !== 'target-missing') expect(serverBarcode(receipt.targetId, 'M5P0071').isClosed, 'លក្ខខណ្ឌមុន ៖ ស្តាររួច').toBe(true);
    expect(pickupKeys(), 'លក្ខខណ្ឌមុន ៖ ការស្តារដាក់ key').toEqual([key('M5P0071')]);
    let roots = 0;
    if (proof === 'different-target-stale-view') {
        expect(receipt.targetId).toBe('restore_peer');
        expect(getAt('zoew_restore_finalizations/' + trash.id)).toBeNull();
        dataState.scanHistory = dataState.scanHistory.filter(item => item.id !== receipt.targetId);
        expect(dbListenerFailedPaths.size + dbListenerPendingPaths.size).toBe(0);
    }
    if (proof === 'target-changed-after-proof') {
        const read = adapter.get;

        adapter.get = async (ref: any) => { const value = await read(ref); if (ref.path === HISTORY && ++roots === 1) setAt(HISTORY + '/' + receipt.targetId, null); return value; };
    }
    if (proof.endsWith('-at-holder')) {
        const read = adapter.get;
        adapter.get = async (ref: any) => {
            if (ref.path === HISTORY + '/' + receipt.targetId) {
                roots++;
                const row = getAt(ref.path);
                if (proof === 'barcode-disappears-at-holder') row.barcodes = row.barcodes.filter((b: any) => b.code !== 'M5P0071');
                else if (proof === 'birth-changes-at-holder') row.barcodes.find((b: any) => b.code === 'M5P0071').createdAt++;
                else row.clearClaim = false;
                setAt(ref.path, row);
            }
            return read(ref);
        };
    }
    release();
    expect((await delayedResult).committed, 'stale Remove cannot commit over the newer Restore revision').toBe(false);
    expect(pickupKeys(), 'stale Remove refuses the newer restore revision').toEqual([key('M5P0071')]);
    await waitForState(() => expect(cleanup.cleanupJournalLive.has(trash.id)).toBe(false));
    await resumeDoors();
    if (proof === 'target-changed-after-proof' || proof.endsWith('-at-holder')) expect(roots, 'mutation boundary was entered').toBeGreaterThan(0);
    expect(cleanupJournal()).toHaveLength(proof === 'exact' || proof === 'different-target-stale-view' ? 0 : 1);
    expect([getAt(DAILY), getAt(MONTHLY)], 'mirror recovery never repeats money').toEqual(moneyBefore);
    expect(pickupKeys(), 'Barcode បិទក្នុងប្រវត្តិ ➜ key នៅ').toEqual([key('M5P0071')]);
    expect(pickupCount()).toBe(1);
});

it('⛔ ឧបករណ៍ ២ ៖ ឧបករណ៍ផ្សេង «ដក» Barcode បិទ (key ចេញ) · ឧបករណ៍នេះ (ទិដ្ឋភាពចាស់) បើកជួរទាំងមូលវិញ ➜ key មិនកើតវិញពីស្ថានភាព «មុន» ចាស់', async () => {
    seedItem('p9', ['M5P0091', 'M5P0092'], ['M5P0091', 'M5P0092']);
    loadViewsFromServer();
    const removed = getAt(HISTORY + '/p9');
    const gone = removed.barcodes.find((b: any) => b.code === 'M5P0091');
    const kept = removed.barcodes.filter((b: any) => b.code !== 'M5P0091');
    setAt(HISTORY + '/p9', { ...removed, barcodes: kept, count: 1, barcode: kept[0].code, cod: kept[0].cod, dod: kept[0].dod, price: kept[0].cod + kept[0].dod });
    setAt(TRASH + '/p9_rm1', { ...removed, id: 'p9_rm1', barcodes: [{ ...gone, isDeducted: true }], count: 1, barcode: gone.code, trashReason: 'remove', isFromDeletion: false, deletedAt: NOW });
    setAt(PICKUP + '/' + DAY, { packagesPickedUp: 1, pickedUpPhones: { [PHONE]: 1 }, pickedUpBarcodes: { [key('M5P0092')]: PHONE } });
    expect(memoryKeys(), 'លក្ខខណ្ឌមុន ៖ ទិដ្ឋភាពឧបករណ៍នេះចាស់ (key ទាំងពីរ)').toEqual([key('M5P0091'), key('M5P0092')].sort());
    expect(await toggleCloseStatus('p9')).toBe(false);
    expect(pickupKeys(), 'បដិសេធ membership ចាស់៖ key ដែលដកមិនរស់ឡើងវិញ ហើយ kept barcode នៅបិទ').toEqual([key('M5P0092')]);
    await waitForState(() => expect(pickup.pickupIntentsLive.size).toBe(0));
    await pickup.resumePickupIntents();
    expect(pickupJournal()).toEqual([]);
    expect(serverBarcode('p9', 'M5P0092').isClosed).toBe(true);
    loadViewsFromServer();
    expect(await toggleCloseStatus('p9')).toBe(true);
    expect(serverBarcode('p9', 'M5P0092').isClosed, 'លក្ខខណ្ឌមុន ៖ ជួរបើកវិញលើ server').toBe(false);
    expect(pickupKeys(), 'Barcode «ដក» មិនរាប់ · Barcode បើក មិនរាប់').toEqual([]);
    expect(pickupCount()).toBe(0);
});

it('ទិសផ្ទុយ ៖ Reset ស្ថិតិយក ➜ ដក Barcode បិទ ➜ Reset មិនកើតវិញ', async () => {
    seedItem('p8', ['M5P0081', 'M5P0082'], ['M5P0081', 'M5P0082']);
    await firebaseState.fb.runTransaction(makeRef(DB, PICKUP + '/' + DAY), pickup.pickupResetRecord);
    loadViewsFromServer();
    expect(await removeSingleBarcode('p8', 'M5P0081')).toBe('done');
    await sleep(20);
    expect(pickupCount(), 'Reset នៅ ០').toBe(0);
    expect(pickupKeys()).toEqual([]);
});

it('⛔ ការពិតស្ថិតិយក ៖ copy ក្នុងធុងសំរាមកាត់ប្រាក់មិនរាប់ · copy ដែលការស្តារមិនទាន់ចប់មិនរាប់ · «លុប» / «យករួច» រាប់', () => {
    const closedBarcode = (code: string) => ({ code, isClosed: true, closedAt: NOW - H, cod: 1, dod: 0 });
    const item = (id: string, code: string, extra: any = {}) => ({ id, phone: PHONE, scanDate: DAY, isClosed: true, barcodes: [closedBarcode(code)], ...extra });
    const removed = item('t1', 'M5T0001', { trashReason: 'remove', isFromDeletion: false });
    const returned = item('t2', 'M5T0002', { trashReason: 'returned', isFromDeletion: false });
    const deleted = item('t3', 'M5T0003', { trashReason: 'delete', isFromDeletion: true });
    const cleaned = item('t4', 'M5T0004', { trashReason: 'pickup', isFromDeletion: true });
    const pending = item('h1', 'M5T0001', { restoreClaimId: 't1', restoreClaimToken: 'tok', restoreAddedCodes: JSON.stringify(['M5T0001']) });
    const trash = [removed, returned, deleted, cleaned];
    const wanted = ['M5T0001', 'M5T0002', 'M5T0003', 'M5T0004'].map(key);
    const marks = pickup.pickupTruthMarks(DAY, wanted, [pending], trash);
    const closedOf = (code: string) => marks.find((m) => m.key === key(code))?.closed;
    expect([closedOf('M5T0001'), closedOf('M5T0002'), closedOf('M5T0003'), closedOf('M5T0004')]).toEqual([false, false, true, true]);
});

it('មិនដក Barcode ពេលនាឡិកាមិនទាន់បានផ្ទៀងផ្ទាត់', async () => {
    seedItem('p1', ['M5P0001', 'M5P0002'], ['M5P0001']);
    loadViewsFromServer();
    const source = clone(dataState.scanHistory[0]);
    expect(source?.barcodes?.length).toBeGreaterThan(0);
    firebaseState.serverClockTrusted = false;
    const before = clone(lab.store[HISTORY]);
    expect(await removeSingleBarcode(source.id, source.barcodes[0].code)).toBe('failed');
    expect(lab.store[HISTORY]).toEqual(before);
    expect(trashItems()).toEqual([]);
});


it('មិនដកតាមគម្រោងចាស់ក្រោយនាឡិកាបាត់ទំនុកចិត្ត និង Sync វិញ', async () => {
    seedItem('p1', ['M5P0001', 'M5P0002'], ['M5P0001']);
    loadViewsFromServer();
    let calls = 0;
    lab.txGate = (path) => {
        if (path === HISTORY + '/p1' && ++calls === 2) {
            resetServerClock();
            firebaseState.serverClockTrusted = true;
        }
        return null;
    };
    expect(await removeSingleBarcode('p1', 'M5P0001')).not.toBe('done');
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(serverBarcode('p1', 'M5P0001')).not.toBeNull();
    expect(trashItems()).toEqual([]);
});

it('ការដកដែលបានបញ្ជាក់នៅតែបញ្ចប់ដោយពេលគម្រោងដើម បើនាឡិកាប្រែក្រោយសរសេរ', async () => {
    seedItem('p1', ['M5P0001', 'M5P0002'], ['M5P0001']);
    loadViewsFromServer();
    const runTransaction = firebaseState.fb.runTransaction;
    let calls = 0;
    firebaseState.fb.runTransaction = async (ref, updater) => {
        const result = await runTransaction(ref, updater);
        if (ref.path === HISTORY + '/p1' && ++calls === 2 && result.committed) {
            firebaseState.serverClockTrusted = false;
            firebaseState.serverTimeOffsetMs = 7 * 86400000;
        }
        return result;
    };
    expect(await removeSingleBarcode('p1', 'M5P0001')).toBe('done');
    expect(trashItems()).toHaveLength(1);
    expect(trashItems()[0].closedAt).toBe(NOW);
    expect(serverBarcode('p1', 'M5P0001')).toBeNull();
});


it.each(['exact', 'reset', 'missing-final', 'wrong-final-token', 'wrong-final-target', 'wrong-final-at', 'missing-consumption', 'generation', 'scope', 'actor', 'source', 'birth', 'deleted-at', 'consumption-token', 'consumption-target', 'extra-final', 'unread', 'session'] as const)('Restore ACK បាត់ ៖ exact financial receipts %s បន្តតែ mirrors · ខ្វះ proof នៅ HOLD', async proof => {
    seedItem('ack', ['ACK0001', 'ACK0002'], ['ACK0001']); loadViewsFromServer();
    expect(await removeSingleBarcode('ack', 'ACK0001')).toBe('done'); await sleep(20);
    const trash = trashItems()[0]; expect(pickupKeys()).toEqual([]);
    const sdk: any = firebaseState.fb, originalUpdate = sdk.update, originalGet = sdk.get;
    let finalized = 0, proofReads = 0;
    sdk.update = async (ref: any, patch: any) => {
        await originalUpdate(ref, patch);
        if (!patch['zoew_restore_finalizations/' + trash.id]) return;
        finalized++;
        const finalPath = 'zoew_restore_finalizations/' + trash.id, receiptPath = 'zoew_trash_consumptions/' + trash.id;
        if (proof === 'missing-final') setAt(finalPath, null);
        if (proof === 'wrong-final-token') setAt(finalPath, { ...getAt(finalPath), token: 'foreign' });
        if (proof === 'wrong-final-target') setAt(finalPath, { ...getAt(finalPath), targetId: 'foreign' });
        if (proof === 'wrong-final-at') setAt(finalPath, { ...getAt(finalPath), finalizedAt: NOW - 1 });
        if (proof === 'missing-consumption') setAt(receiptPath, null);
        if (proof === 'generation') setAt(receiptPath, { ...getAt(receiptPath), generation: 2 });
        if (proof === 'scope') setAt(receiptPath, { ...getAt(receiptPath), scope: 'other-shop' });
        const field = { actor: 'actorUid', source: 'sourceId', birth: 'rowBirth', 'deleted-at': 'deletedAt', 'consumption-token': 'token', 'consumption-target': 'targetId' }[proof];
        if (field) { const saved = getAt(receiptPath); setAt(receiptPath, { ...saved, [field]: typeof saved[field] === 'number' ? saved[field] + 1 : 'foreign' }); }
        if (proof === 'extra-final') setAt(finalPath, { ...getAt(finalPath), extra: true });
        if (proof === 'reset') setAt(PICKUP + '/' + DAY, { ...getAt(PICKUP + '/' + DAY), pickupRevision: 20, pickupResetEpoch: 1, packagesPickedUp: 0 });
        throw Object.assign(new Error('committed financial write; acknowledgement unavailable'), { txOutcome: 'unknown' });
    };
    sdk.get = async (ref: any) => {
        if (finalized && (ref.path === 'zoew_restore_finalizations/' + trash.id || ref.path === 'zoew_trash_consumptions/' + trash.id)) {
            proofReads++;
            if (proof === 'unread') throw new Error('authoritative receipt read unavailable');
            if (proof === 'session') firebaseState.authGeneration++;
        }
        return originalGet(ref);
    };
    await restore(trash.id);
    expect(finalized).toBe(1);
    expect(getAt(TRASH + '/' + trash.id)).toBeNull(); expect(revenueDay()).toEqual([100, 10, 10]);
    const exact = proof === 'exact' || proof === 'reset';
    expect(pickupKeys()).toEqual(proof === 'exact' ? [key('ACK0001')] : []);
    if (exact) expect(getAt(MIRROR + '/' + DAY + '/' + key('ACK0001'))).toEqual({ c: 4, d: 1 });
    else expect(pickupJournal()).toHaveLength(1);
    const settledMoney = [getAt(DAILY), getAt(MONTHLY)];
    if (proof !== 'session') { crashAndReload(); await resumeDoors(); }
    expect([getAt(DAILY), getAt(MONTHLY)]).toEqual(settledMoney);
    expect(pickupKeys()).toEqual(proof === 'exact' ? [key('ACK0001')] : []);
    expect(finalized).toBe(1); expect(proofReads).toBeGreaterThan(0);
});


it.each(['exact', 'reordered', 'reset', 'missing-final', 'final-token', 'final-target', 'final-at', 'missing-consumption', 'consumption-generation', 'consumption-time', 'consumption-birth', 'consumption-scope', 'consumption-uid', 'consumption-token', 'consumption-target', 'identity-birth', 'identity-restored', 'identity-intent', 'identity-closedAt', 'identity-open', 'identity-phone', 'identity-date', 'identity-duplicate', 'legacy-v2', 'plan-version', 'plan-extra', 'protocol-unknown', 'session-db', 'session-sdk', 'session-uid', 'session-scope', 'session-generation'] as const)('Restore origin restart ៖ %s exact durable proof តែម្ដង · UNKNOWN មិនសន្មត pickup', async fault => {
    seedItem('origin', ['ORIGIN01', 'ORIGIN02'], ['ORIGIN01']); loadViewsFromServer();
    expect(await removeSingleBarcode('origin', 'ORIGIN01')).toBe('done'); await sleep(20);
    const trash = trashItems()[0], sdk: any = firebaseState.fb, originalUpdate = sdk.update, originalGet = sdk.get;
    let finalWrites = 0, proofBlocked = true, resumeProofReads = 0;
    sdk.update = async (ref: any, patch: any) => {
        await originalUpdate(ref, patch);
        if (!patch['zoew_restore_finalizations/' + trash.id]) return;
        finalWrites++;
        throw Object.assign(new Error('financial commit ACK unavailable'), { txOutcome: 'unknown' });
    };
    sdk.get = async (ref: any) => {
        const proof = ref.path === 'zoew_restore_finalizations/' + trash.id || ref.path === 'zoew_trash_consumptions/' + trash.id;
        if (finalWrites && proof) { if (proofBlocked) throw new Error('financial proof unread until restart'); resumeProofReads++; }
        return originalGet(ref);
    };
    await restore(trash.id);
    const entry = pickupJournal()[0], journalKey = pickup.PICKUP_JOURNAL_V2_PREFIX + entry.id;
    expect(entry).toMatchObject({ protocol: 3, kind: 'restore', stage: 'started', allowedAddKeys: [] });
    expect(entry.restorePlan.consumption).toEqual(getAt('zoew_trash_consumptions/' + trash.id));
    expect(entry.restorePlan.finalization).toEqual(getAt('zoew_restore_finalizations/' + trash.id));
    expect(pickupKeys()).toEqual([]); expect(revenueDay()).toEqual([100, 10, 10]); expect(finalWrites).toBe(1);
    const rowId = entry.item, originalReceipt = getAt('zoew_restore_finalizations/' + trash.id), originalConsumption = getAt('zoew_trash_consumptions/' + trash.id);
    if (fault === 'missing-final') setAt('zoew_restore_finalizations/' + trash.id, null);
    if (fault.startsWith('final-')) { const field = { 'final-token': 'token', 'final-target': 'targetId', 'final-at': 'finalizedAt' }[fault]; setAt('zoew_restore_finalizations/' + trash.id, { ...originalReceipt, [field]: field === 'finalizedAt' ? originalReceipt[field] + 1 : 'foreign' }); }
    if (fault === 'missing-consumption') setAt('zoew_trash_consumptions/' + trash.id, null);
    if (fault.startsWith('consumption-')) { const field = { 'consumption-generation': 'generation', 'consumption-time': 'deletedAt', 'consumption-birth': 'rowBirth', 'consumption-scope': 'scope', 'consumption-uid': 'actorUid', 'consumption-token': 'token', 'consumption-target': 'targetId' }[fault]; setAt('zoew_trash_consumptions/' + trash.id, { ...originalConsumption, [field]: typeof originalConsumption[field] === 'number' ? originalConsumption[field] + 1 : 'foreign' }); }
    if (fault === 'reordered') { setAt('zoew_restore_finalizations/' + trash.id, Object.fromEntries(Object.entries(originalReceipt).reverse())); setAt('zoew_trash_consumptions/' + trash.id, Object.fromEntries(Object.entries(originalConsumption).reverse())); }
    if (fault.startsWith('identity-')) {
        const row = getAt(HISTORY + '/' + rowId), barcode = row.barcodes.find((b: any) => b.code === 'ORIGIN01');
        if (fault === 'identity-birth') barcode.createdAt++;
        if (fault === 'identity-restored') barcode.restoredAt = 1;
        if (fault === 'identity-intent') barcode.scanIntent = 'scan_' + 'a'.repeat(32);
        if (fault === 'identity-closedAt') barcode.closedAt++;
        if (fault === 'identity-open') { barcode.isClosed = false; delete barcode.closedAt; }
        if (fault === 'identity-phone') row.phone = '099999999';
        if (fault === 'identity-date') row.scanDate = '2026-10-04';
        setAt(HISTORY + '/' + rowId, row);
        if (fault === 'identity-duplicate') setAt(HISTORY + '/duplicate', { ...row, id: 'duplicate', barcodes: [barcode] });
    }
    if (fault === 'reset') setAt(PICKUP + '/' + DAY, { packagesPickedUp: 0, pickupRevision: 20, pickupResetEpoch: 1 });
    const edited = clone(entry);
    if (fault === 'legacy-v2') { edited.protocol = 2; delete edited.kind; delete edited.restorePlan; }
    if (fault === 'plan-version') edited.restorePlan.v = 2;
    if (fault === 'plan-extra') edited.restorePlan.extra = true;
    if (fault === 'protocol-unknown') edited.protocol = 4;
    if (fault === 'legacy-v2' || fault.startsWith('plan-') || fault === 'protocol-unknown') appLocalStore.setItem(journalKey, JSON.stringify(edited));
    const rawBefore = appLocalStore.getItem(journalKey), stableMoney = [getAt(DAILY), getAt(MONTHLY)];
    proofBlocked = false; crashAndReload();
    let switched = false;
    const read = sdk.get;
    sdk.get = async (ref: any) => {
        const value = await read(ref);
        if (!switched && fault.startsWith('session-') && ref.path === 'zoew_restore_finalizations/' + trash.id) {
            switched = true;
            if (fault === 'session-db') firebaseState.db = { name: 'foreign' } as any;
            if (fault === 'session-sdk') firebaseState.fb = { ...sdk };
            if (fault === 'session-uid') firebaseState.auth.currentUser.uid = 'foreign';
            if (fault === 'session-scope') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://foreign.firebaseio.com' }));
            if (fault === 'session-generation') firebaseState.authGeneration++;
        }
        return value;
    };
    await pickup.resumePickupIntents();
    const succeeds = ['exact', 'reordered', 'reset'].includes(fault);
    expect(pickupKeys()).toEqual(fault === 'exact' || fault === 'reordered' ? [key('ORIGIN01')] : []);
    expect([getAt(DAILY), getAt(MONTHLY)]).toEqual(stableMoney); expect(finalWrites).toBe(1);
    if (succeeds) { expect(pickupJournal()).toEqual([]); expect(getAt(MIRROR + '/' + DAY + '/' + key('ORIGIN01'))).toEqual({ c: 4, d: 1 }); expect(getAt('zoew_restore_finalizations/' + trash.id)).toBeNull(); }
    else { expect(appLocalStore.getItem(journalKey)).not.toBeNull(); if (fault.startsWith('plan-') || fault === 'protocol-unknown' || fault.startsWith('session-')) expect(appLocalStore.getItem(journalKey)).toBe(rawBefore); }
    if (fault.startsWith('session-')) expect(switched).toBe(true);
    if (!fault.startsWith('plan-') && fault !== 'protocol-unknown' && fault !== 'legacy-v2') expect(resumeProofReads).toBeGreaterThan(0);
});

it.each(['admission', 'ready'] as const)('Restore v3 journal persistence %s បរាជ័យ មិនបញ្ចប់ហិរញ្ញវត្ថុ', async stage => {
    seedItem('persist', ['PERSIST1', 'PERSIST2'], ['PERSIST1']); loadViewsFromServer();
    expect(await removeSingleBarcode('persist', 'PERSIST1')).toBe('done'); await sleep(20);
    const trash = trashItems()[0], money = [getAt(DAILY), getAt(MONTHLY)], original = storageAdapter.safeStoreSet;
    let denied = 0;
    vi.spyOn(storageAdapter, 'safeStoreSet').mockImplementation((store, name, value) => {
        if (name.startsWith(pickup.PICKUP_JOURNAL_V2_PREFIX)) { const entry = JSON.parse(String(value)); if (entry.protocol === 3 && (stage === 'admission' || entry.restorePlan)) { denied++; return false; } }
        return original(store, name, value);
    });
    await restore(trash.id);
    expect(denied, JSON.stringify({ journal: pickupJournal(), source: getAt(TRASH + '/' + trash.id), toasts: uiState.toasts.map(row => row.msg) })).toBeGreaterThan(0); expect([getAt(DAILY), getAt(MONTHLY)]).toEqual(money);
    expect(getAt('zoew_restore_finalizations/' + trash.id)).toBeNull(); expect(getAt('zoew_trash_consumptions/' + trash.id)).toBeNull(); expect(pickupKeys()).toEqual([]);
    expect(getAt(TRASH + '/' + trash.id)).toBeTruthy();
    if (stage === 'admission') { expect(getAt(TRASH + '/' + trash.id + '/restoreClaim')).toBeNull(); expect(serverBarcode('persist', 'PERSIST1')).toBeNull(); }
    else expect(pickupJournal()[0]).toMatchObject({ protocol: 3, stage: 'started', kind: 'restore' });
});

it.each(['unchanged', 'phone', 'birth', 'finalization', 'consumption'] as const)('Restore atomic guard→server denial ៖ %s រក្សា UNKNOWN journal ដោយមិនមាន fallback', async change => {
    seedItem('race', ['RACE0001', 'RACE0002'], ['RACE0001']); loadViewsFromServer();
    expect(await removeSingleBarcode('race', 'RACE0001')).toBe('done'); await sleep(20);
    const trash = trashItems()[0], sdk: any = firebaseState.fb, originalUpdate = sdk.update, originalGet = sdk.get;
    let finalized = 0;
    sdk.update = async (ref: any, patch: any) => {
        await originalUpdate(ref, patch);
        if (patch['zoew_restore_finalizations/' + trash.id]) { finalized++; throw Object.assign(new Error('financial ACK lost'), { txOutcome: 'unknown' }); }
    };
    sdk.get = async (ref: any) => {
        if (finalized && (ref.path === 'zoew_restore_finalizations/' + trash.id || ref.path === 'zoew_trash_consumptions/' + trash.id)) throw new Error('initial proof read outage');
        return originalGet(ref);
    };
    await restore(trash.id); expect(finalized).toBe(1); expect(pickupKeys()).toEqual([]);
    expect(pickupJournal()[0]).toMatchObject({ protocol: 3, kind: 'restore' });
    sdk.update = originalUpdate; sdk.get = originalGet; crashAndReload();
    const money = [getAt(DAILY), getAt(MONTHLY)], finalPath = 'zoew_restore_finalizations/' + trash.id, consumptionPath = 'zoew_trash_consumptions/' + trash.id;
    const transaction = sdk.runTransaction; let entered = 0;
    sdk.runTransaction = async (ref: any, updater: any) => {
        if (ref.path === PICKUP + '/' + DAY && !entered) {
            entered++;
            if (change === 'phone') setAt(HISTORY + '/race/phone', '0999999999');
            if (change === 'birth') { const row = getAt(HISTORY + '/race'); row.barcodes.find((b: any) => b.code === 'RACE0001').createdAt++; setAt(HISTORY + '/race', row); }
            if (change === 'finalization') setAt(finalPath, { ...getAt(finalPath), token: 'foreign' });
            if (change === 'consumption') setAt(consumptionPath, { ...getAt(consumptionPath), generation: 2, token: 'foreign' });
        }
        return transaction(ref, (current: any) => {
            const next = updater(current);
            if (ref.path === PICKUP + '/' + DAY && next !== undefined) {
                expect(next.restoreGuard).toMatchObject({ v: 1, sourceId: trash.id, targetId: 'race', actorUid: 'm5-pickup', phone: PHONE, phoneKey: PHONE, date: DAY, epoch: 0,
                    target: { slot: '1', key: key('RACE0001'), code: 'RACE0001', scanIntent: '' } });
                expect(Object.keys(next.restoreGuard)).toHaveLength(15); expect(Object.keys(next.restoreGuard.target)).toHaveLength(7);
                if (change !== 'unchanged') throw Object.assign(new Error('server denied stale Restore companion'), { code: 'PERMISSION_DENIED' });
            }
            return next;
        });
    };
    await pickup.resumePickupIntents();
    expect(entered).toBe(1); expect([getAt(DAILY), getAt(MONTHLY)]).toEqual(money);
    expect(pickupKeys()).toEqual(change === 'unchanged' ? [key('RACE0001')] : []);
    if (change === 'unchanged') expect(pickupJournal()).toEqual([]);
    else { expect(pickupJournal()).toHaveLength(1); expect(pickupJournal()[0].hold).toBe('recovery-pending'); expect(getAt(finalPath)).toBeTruthy(); }
});

it.each(['complete', 'second-denied', 'reset-between', 'second-unknown'] as const)('Restore v3 serial guards ៖ %s កញ្ចប់ពីរមាន witness/CAS ដាច់ដោយឡែក', async fault => {
    seedItem('multi', ['MULTI001', 'MULTI002', 'MULTI003'], ['MULTI001', 'MULTI002']);
    const whole = getAt(HISTORY + '/multi'), restoring = whole.barcodes.slice(0, 2).map((b: any) => ({ ...b, isDeducted: true }));
    const trash = { ...whole, id: 'multi_trash', barcodes: restoring, count: 2, cod: 9, dod: 2, price: 11, isClosed: true,
        deletedAt: NOW - 1000, trashGeneration: 1, trashReason: 'remove', trashMode: 'local', isFromDeletion: false };
    setAt(TRASH + '/' + trash.id, trash); setAt(HISTORY + '/multi', { ...whole, barcodes: whole.barcodes.slice(2), count: 1, cod: 6, dod: 1, price: 7, barcode: 'MULTI003' });
    setAt(PICKUP + '/' + DAY, { packagesPickedUp: 0, pickupRevision: 3, pickupResetEpoch: 0 }); setAt(MIRROR, null);
    for (const [root, bucket] of [[DAILY, DAY], [MONTHLY, MONTH]]) setAt(root + '/' + bucket, { codDollar: 91, dodDollar: 8, totalCount: 8, ded: { [trash.id]: { at: trash.deletedAt, cod: 9, dod: 2, count: 2 } } });
    loadViewsFromServer(); const sdk: any = firebaseState.fb, transaction = sdk.runTransaction; let blocked = 0;
    sdk.runTransaction = (ref: any, updater: any) => transaction(ref, (current: any) => {
        const next = updater(current);
        if (ref.path === PICKUP + '/' + DAY && next?.restoreGuard) { blocked++; throw Object.assign(new Error('guarded server write unavailable'), { code: 'PERMISSION_DENIED' }); }
        return next;
    });
    await restore(trash.id); expect(blocked).toBe(1); expect(pickupKeys()).toEqual([]); expect(pickupJournal()[0].restorePlan.targets).toHaveLength(2); expect(revenueDay()).toEqual([100, 10, 10]);
    sdk.runTransaction = transaction; crashAndReload(); const seen: any[] = [];
    sdk.runTransaction = async (ref: any, updater: any) => {
        const result = await transaction(ref, (current: any) => {
            const next = updater(current);
            if (ref.path === PICKUP + '/' + DAY && next?.restoreGuard) {
                const guard = next.restoreGuard; seen.push(clone(guard));
                expect(Object.keys(guard)).toHaveLength(15); expect(Object.keys(guard.target)).toHaveLength(7); expect(guard.epoch).toBe(0);
                if (seen.length === 1) expect(Object.keys(next.pickedUpBarcodes)).toEqual([key('MULTI001')]);
                if (seen.length === 2 && fault === 'second-denied') throw Object.assign(new Error('server rejected changed second target'), { code: 'PERMISSION_DENIED' });
            }
            return next;
        });
        if (ref.path === PICKUP + '/' + DAY && result.committed && seen.length === 1 && fault === 'reset-between') setAt(PICKUP + '/' + DAY, { packagesPickedUp: 0, pickupRevision: result.snapshot.val().pickupRevision + 1, pickupResetEpoch: 1 });
        if (ref.path === PICKUP + '/' + DAY && result.committed && seen.length === 2 && fault === 'second-unknown') throw Object.assign(new Error('second committed ACK unavailable'), { txOutcome: 'unknown' });
        return result;
    };
    await pickup.resumePickupIntents();
    expect(seen.map(guard => guard.target.code)).toEqual(fault === 'reset-between' ? ['MULTI001'] : ['MULTI001', 'MULTI002']);
    expect(revenueDay()).toEqual([100, 10, 10]);
    expect(pickupKeys()).toEqual(fault === 'reset-between' ? [] : fault === 'second-denied' ? [key('MULTI001')] : [key('MULTI001'), key('MULTI002')]);
    if (fault === 'complete') expect(pickupJournal()).toEqual([]);
    else { expect(pickupJournal()).toHaveLength(1); expect(getAt('zoew_restore_finalizations/' + trash.id)).toBeTruthy(); }
    if (fault === 'second-unknown' || fault === 'reset-between') {
        sdk.runTransaction = transaction; loadViewsFromServer(); await pickup.resumePickupIntents();
        expect(pickupJournal()).toEqual([]); expect(revenueDay()).toEqual([100, 10, 10]);
        expect(pickupKeys()).toEqual(fault === 'reset-between' ? [] : [key('MULTI001'), key('MULTI002')]);
    }
});

it.each(['096 000-7345', '+855 (96) 0007345', '9'.repeat(80), 'គ្មានលេខ'])('Restore guard ៖ raw phone %s ខុសពី pickup key តែទាំងពីរត្រូវរក្សា', async phone => {
    seedItem('phone_guard', ['PHONEG01', 'PHONEG02'], ['PHONEG01']); const row = getAt(HISTORY + '/phone_guard'); row.phone = phone; setAt(HISTORY + '/phone_guard', row); loadViewsFromServer();
    expect(await removeSingleBarcode('phone_guard', 'PHONEG01')).toBe('done'); await sleep(20); const trash = trashItems()[0];
    const sdk: any = firebaseState.fb, transaction = sdk.runTransaction; let observed: any = null;
    sdk.runTransaction = (ref: any, updater: any) => transaction(ref, (current: any) => { const next = updater(current); if (next?.restoreGuard) observed = clone(next.restoreGuard); return next; });
    await restore(trash.id); expect(observed?.phone).toBe(phone); expect(observed?.phoneKey).toBe(pickup.getPickupPhoneKey(getAt(HISTORY + '/' + observed.targetId)));
    expect(getAt(PICKUP + '/' + DAY + '/pickedUpBarcodes/' + key('PHONEG01'))).toBe(observed.phoneKey); expect(pickupJournal()).toEqual([]); expect(revenueDay()).toEqual([100, 10, 10]);
});

it('Restore guard រួច F អស់ ៖ normal Close និង Reset canonical record មិនយក guard ចាស់មកប្រើ', async () => {
    seedItem('canonical', ['CANON001', 'CANON002'], ['CANON001']); loadViewsFromServer();
    expect(await removeSingleBarcode('canonical', 'CANON001')).toBe('done'); await sleep(20); const trash = trashItems()[0];
    await restore(trash.id); loadViewsFromServer(); expect(getAt(PICKUP + '/' + DAY + '/restoreGuard')).toBeTruthy(); expect(getAt('zoew_restore_finalizations/' + trash.id)).toBeNull();
    const sdk: any = firebaseState.fb, transaction = sdk.runTransaction; let plainWrites = 0;
    sdk.runTransaction = (ref: any, updater: any) => transaction(ref, (current: any) => {
        const next = updater(current);
        if (ref.path === PICKUP + '/' + DAY && next !== undefined) { plainWrites++; expect(next.restoreGuard).toBeUndefined(); }
        return next;
    });
    const closed = await toggleCloseStatus('canonical'); expect(closed, JSON.stringify({ server: getAt(HISTORY), local: dataState.scanHistory, journals: pickupJournal(), toasts: uiState.toasts.map(row => row.msg) })).toBe(true); await waitForState(() => expect(pickupKeys()).toEqual([key('CANON001'), key('CANON002')])); loadViewsFromServer();
    expect(plainWrites).toBeGreaterThan(0); expect(pickupKeys()).toEqual([key('CANON001'), key('CANON002')]); expect(getAt(PICKUP + '/' + DAY + '/restoreGuard')).toBeNull();
    expect(pickup.pickupResetRecord({ ...getAt(PICKUP + '/' + DAY), restoreGuard: { stale: true } }).restoreGuard).toBeUndefined();
    expect(revenueDay()).toEqual([100, 10, 10]);
});


it('Restore targets ទទេក្រោយ lost codes ៖ exact F/K បញ្ចប់ journal ដោយ zero pickup CAS មិនបូកប្រាក់ម្ដងទៀត', async () => {
    seedItem('lost', ['LOST0001'], ['LOST0001']); loadViewsFromServer();
    expect(await removeSingleBarcode('lost', 'LOST0001')).toBe('done'); await sleep(20); const trash = trashItems()[0], token = 'restore_lost_original', targetId = 'restore_empty';
    setAt(TRASH + '/' + trash.id + '/restoreClaim', { token, targetId, claimedAt: NOW });
    const prepared = { ...getAt(TRASH + '/' + trash.id), id: targetId, barcodes: [], count: 0, cod: 0, dod: 0, price: 0,
        restoreClaimId: trash.id, restoreClaimToken: token, restoreAddedCodes: JSON.stringify(['LOST0001']) };
    for (const field of ['deletedAt', 'trashGeneration', 'trashReason', 'trashMode', 'isFromDeletion', 'restoreClaim']) delete prepared[field];
    setAt(HISTORY + '/' + targetId, prepared);
    saveRestoreClaim(trash.id, { token, targetId }); loadViewsFromServer();
    const sdk: any = firebaseState.fb, update = sdk.update, get = sdk.get; let financial = 0, blocked = true;
    sdk.update = async (ref: any, patch: any) => { await update(ref, patch); if (patch['zoew_restore_finalizations/' + trash.id]) { financial++; throw new Error('financial ACK unavailable'); } };
    sdk.get = async (ref: any) => { if (financial && blocked && (ref.path === 'zoew_restore_finalizations/' + trash.id || ref.path === 'zoew_trash_consumptions/' + trash.id)) throw new Error('proof unavailable'); return get(ref); };
    await restore(trash.id); expect(financial).toBe(1); expect(revenueDay()).toEqual([100, 10, 10]);
    expect(pickupJournal()[0].restorePlan.targets).toEqual([]); expect(getAt(HISTORY + '/' + targetId)).toBeNull(); expect(pickupKeys()).toEqual([]);
    const counter = getAt(PICKUP + '/' + DAY), money = [getAt(DAILY), getAt(MONTHLY)], transaction = sdk.runTransaction; let pickupWrites = 0;
    sdk.runTransaction = (ref: any, updater: any) => { if (ref.path === PICKUP + '/' + DAY) pickupWrites++; return transaction(ref, updater); };
    blocked = false; crashAndReload(); await pickup.resumePickupIntents();
    expect(pickupWrites).toBe(0); expect(getAt(PICKUP + '/' + DAY)).toEqual(counter); expect([getAt(DAILY), getAt(MONTHLY)]).toEqual(money); expect(financial).toBe(1);
    expect(pickupJournal()).toEqual([]); expect(getAt('zoew_restore_finalizations/' + trash.id)).toBeNull();
});
