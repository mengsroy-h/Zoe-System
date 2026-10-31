/**
 * ⛔ M5 (ការសម្រេចម្ចាស់គម្រោង ៖ «ដក» ដក key យករួចផង) ៖ ស្ថិតិ «យករួច» តាមប្រាក់។ «ដក» Barcode ដែលបិទរួចកាត់ COD · DOD ·
 *    ចំនួនកញ្ចប់ ប៉ុន្តែ key របស់វានៅក្នុង `zoew_daily_pickup_cod_dod/<ថ្ងៃ>/pickedUpBarcodes` ➜ «យករួច» រាប់កញ្ចប់ដែលលែងមាន
 *    (អត្រាយក > ១០០%)។ ច្បាប់ ៖ copy ក្នុងធុងសំរាមដែលកាត់ប្រាក់ (`remove` · `returned`) មិនរាប់ជា «យករួច» · «ដក» លុប key ·
 *    «ស្តារ» Barcode បិទពីធុងសំរាមនោះដាក់ key វិញ · ទាំងពីររស់រានពេលទំព័រស្លាប់ (journal ការសម្អាត · journal ស្ថិតិយក) និង
 *    ការប្រណាំងឧបករណ៍ ២ (ការលុប key ចុះយឺតក្រោយការស្តារ ➜ ដាក់វិញ)។ ទិសផ្ទុយ ៖ «លុប» · Barcode បើក · Reset មិនកើតវិញ។
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getZoneDateKey } from '../src/core/timezone';
import { barcodeRegistryKey } from '../src/domain/registry';
import * as cleanup from '../src/domain/cleanup';
import * as pickup from '../src/domain/pickup';
import { removeSingleBarcode } from '../src/features/barcode-ops';
import { deleteSingleItem, toggleCloseStatus } from '../src/features/entry-ops';
import { activeRestoreClaims, executeRestoreItem, restoreInFlight } from '../src/features/restore';

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
    await sleep(20);
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
    await sleep(40);
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

it('⛔ ស្តារ ៖ ការដាក់ key ព្យួរ ➜ ទំព័រស្លាប់ ➜ journal ស្ថិតិយកដាក់ key វិញ', async () => {
    seedItem('p6', ['M5P0061', 'M5P0062'], ['M5P0061']);
    loadViewsFromServer();
    await removeSingleBarcode('p6', 'M5P0061');
    await sleep(20);
    const trash = trashItems()[0];
    lab.hang = [PICKUP];
    void restore(trash.id);
    await vi.waitFor(() => expect(getAt(TRASH + '/' + trash.id), 'លក្ខខណ្ឌមុន ៖ ការស្តារបញ្ចប់លើ server').toBeNull(), { timeout: 3000 });
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
    await vi.waitFor(() => expect(cleanup.cleanupJournalLive.has(trash.id)).toBe(false));
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
    await vi.waitFor(() => expect(pickup.pickupIntentsLive.size).toBe(0));
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
