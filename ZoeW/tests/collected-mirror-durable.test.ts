/**
 * ⛔ MX-1 ៖ mirror «ចំណូលតាមថ្ងៃយក» (`zoew_daily_collected_cod_dod`) ត្រូវរស់រានពេលទំព័រស្លាប់ចន្លោះ commit កញ្ចប់ និង commit mirror។
 *    មុនកែ ៖ ការបិទ/បើកដក journal ស្ថិតិយកចេញភ្លាមពេល pickup commit ចុះ ហើយទើបសរសេរ mirror · ការដក barcode បិទ
 *    លុប mirror តែក្នុង `finishRemoval` ➜ ការស្តារ journal សម្អាតគ្មានជំហាន mirror ➜ ចំណូលតាមថ្ងៃយកខុសរហូត ៧ ថ្ងៃ។
 *    ច្បាប់ ៖ mirror = barcode បិទ មិនទាន់ដក (`isDeducted` ≠ true) លើថ្ងៃបិទរបស់វា · ទ្វារស្តារពិត (`resumePickupIntents` ·
 *    `resumeInterruptedCleanups`) បញ្ចប់វា · ផ្លូវបរាជ័យដែលអាច landed (txOutcome ≠ 'not-applied') reconcile ពី server។
 *    ទិសផ្ទុយ ៖ 'not-applied' មិនសរសេរ mirror · ប្រតិបត្តិការធម្មតាមិនបន្សល់ journal · entry ចាស់គ្មាន `item` នៅដើរដូចមុន។
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getZoneDateKey } from '../src/core/timezone';
import { barcodeRegistryKey } from '../src/domain/registry';
import * as cleanup from '../src/domain/cleanup';
import { resumeInterruptedCleanups } from '../src/domain/cleanup';
import * as pickup from '../src/domain/pickup';
import { applyBarcodeCloseChange, removeSingleBarcode } from '../src/features/barcode-ops';
import { toggleCloseStatus } from '../src/features/entry-ops';

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const PICKUP = 'zoew_daily_pickup_cod_dod';
const MIRROR = 'zoew_daily_collected_cod_dod';
const H = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 5, 9, 30, 0);
const DAY = getZoneDateKey(NOW - 2 * H, 0);
const SHOP_CONFIG = JSON.stringify({ apiKey: 'k', databaseURL: 'https://mx1-durable-default-rtdb.firebaseio.com', projectId: 'p' });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lab = { store: {} as Record<string, any>, hang: [] as string[], fail: null as null | ((path: string, kind: string) => any), mirrorWrites: 0 };

function getPath(path: string) {
    let cur: any = lab.store;
    for (const p of path.split('/').filter(Boolean)) {
        if (!cur || typeof cur !== 'object' || !(p in cur)) return null;
        cur = cur[p];
    }
    return cur === undefined ? null : JSON.parse(JSON.stringify(cur));
}
function setPath(path: string, value: any) {
    const parts = path.split('/').filter(Boolean);
    let cur: any = lab.store;
    if (value === null || value === undefined) {
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') return;
            cur = cur[parts[i]];
        }
        delete cur[parts[parts.length - 1]];
        return;
    }
    for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = JSON.parse(JSON.stringify(value));
}
const hangs = (path: string) => lab.hang.some((prefix) => path.indexOf(prefix) === 0);
function makeFb() {
    return {
        getIdTokenResult: async () => ({ token: 't' }),
        ref: (_db: unknown, path: string) => ({ path }),
        get: async (ref: any) => { await sleep(1); const v = getPath(ref.path); return { val: () => v, exists: () => v !== null }; },
        update: async (ref: any, payload: any) => {
            if (hangs(ref.path)) return new Promise(() => {});
            await sleep(1);
            const failed = lab.fail && lab.fail(ref.path, 'update');
            if (failed) throw failed;
            if (ref.path.indexOf(MIRROR) === 0) lab.mirrorWrites++;
            for (const k of Object.keys(payload)) setPath(ref.path + '/' + k, payload[k]);
            return true;
        },
        set: async (ref: any, value: any) => { await sleep(1); setPath(ref.path, value); return true; },
        runTransaction: (ref: any, fn: any) => {
            if (hangs(ref.path)) return new Promise(() => {});
            return sleep(1).then(() => {
                const cur = getPath(ref.path);
                const next = fn(cur);
                if (next === undefined) return { committed: false, snapshot: { val: () => cur } };
                const failed = lab.fail && lab.fail(ref.path, 'transaction');
                if (failed && failed.notApplied) throw failed.error;
                if (ref.path.indexOf(MIRROR) === 0) lab.mirrorWrites++;
                setPath(ref.path, next);
                if (failed) throw failed.error;
                const v = getPath(ref.path);
                return { committed: true, snapshot: { val: () => v } };
            });
        },
        onValue: () => () => {},
        off: () => {},
        increment: (n: number) => n
    };
}

const PHONE = '0960007345';
function seedItem(id: string, codes: string[], closed: string[]) {
    const barcodes = codes.map((code, i) => {
        const b: any = { code, isClosed: closed.includes(code), cod: 4 + i, dod: 1, isDeducted: false, isFromDeletion: false, createdAt: NOW - 3 * H, time: '13:30:00' };
        if (b.isClosed) b.closedAt = NOW - 2 * H;
        return b;
    });
    const cod = barcodes.reduce((s: number, b: any) => s + b.cod, 0);
    const item: any = { id, phone: PHONE, scanDate: DAY, isClosed: barcodes.every((b: any) => b.isClosed), createdAt: NOW - 3 * H,
        cod, dod: codes.length, price: cod + codes.length, count: codes.length, barcode: codes[0], time: '13:30:00 (' + DAY + ')', barcodes };
    if (item.isClosed) item.closedAt = NOW - 2 * H;
    setPath(HISTORY + '/' + id, item);
    codes.forEach((code) => setPath('zoew_barcode_registry/' + barcodeRegistryKey(code), true));
    barcodes.filter((b: any) => b.isClosed).forEach((b: any) => {
        setPath(MIRROR + '/' + getZoneDateKey(b.closedAt, 0) + '/' + barcodeRegistryKey(b.code), { c: b.cod, d: b.dod });
    });
    const pickedUp = barcodes.filter((b: any) => b.isClosed);
    if (pickedUp.length) {
        const set: Record<string, string> = {};
        pickedUp.forEach((b: any) => { set[barcodeRegistryKey(b.code)] = PHONE; });
        setPath(PICKUP + '/' + DAY, { packagesPickedUp: pickedUp.length, pickedUpPhones: { [PHONE]: pickedUp.length }, pickedUpBarcodes: set });
    }
}
function seedRevenue() {
    setPath('zoew_daily_revenue_cod_dod/' + DAY, { codDollar: 100, dodDollar: 10, totalCount: 10 });
    setPath('zoew_monthly_revenue_cod_dod/' + DAY.substring(0, 7), { codDollar: 100, dodDollar: 10, totalCount: 10 });
}
function loadViewsFromServer() {
    const hist = getPath(HISTORY) || {};
    dataState.scanHistory = Object.keys(hist).map((k) => Object.assign({ id: k }, hist[k]));
    const trash = getPath(TRASH) || {};
    dataState.deletedItems = Object.keys(trash).map((k) => Object.assign({ id: k }, trash[k]));
    dataState.dailyPickupData = getPath(PICKUP) || {};
    dataState.dailyCollectedData = getPath(MIRROR) || {};
    dataState.dailyRevenueData = getPath('zoew_daily_revenue_cod_dod') || {};
    dataState.monthlyRevenueData = getPath('zoew_monthly_revenue_cod_dod') || {};
}
function crashAndReload() {
    firebaseState.authGeneration++;
    pickup.pickupIntentsLive.clear();
    cleanup.cleanupJournalLive.clear();
    cleanup.cleanupInFlight.clear();
    dataState.pickupResumeInFlight = false;
    dataState.cleanupResumeInFlight = false;
    lab.hang = [];
    lab.fail = null;
    loadViewsFromServer();
}
async function resumeDoors() {
    await pickup.resumePickupIntents();
    await resumeInterruptedCleanups();
    await sleep(20);
}
function expectedMirror() {
    const out: Record<string, any> = {};
    const add = (item: any) => (item && Array.isArray(item.barcodes) ? item.barcodes : []).forEach((b: any) => {
        if (!b || !b.isClosed || b.isDeducted === true || !(b.closedAt > 0)) return;
        out[getZoneDateKey(b.closedAt, 0) + '/' + barcodeRegistryKey(b.code)] = { c: b.cod, d: b.dod };
    });
    const hist = getPath(HISTORY) || {};
    Object.keys(hist).forEach((id) => add(hist[id]));
    const trash = getPath(TRASH) || {};
    Object.keys(trash).forEach((id) => add(trash[id]));
    return out;
}
function actualMirror() {
    const out: Record<string, any> = {};
    const root = getPath(MIRROR) || {};
    Object.keys(root).forEach((day) => Object.keys(root[day] || {}).forEach((key) => {
        out[day + '/' + key] = { c: root[day][key].c, d: root[day][key].d };
    }));
    return out;
}
const pickupJournal = () => { try { return JSON.parse(appLocalStore.getItem('zoew_pickup_journal_v1') || '[]'); } catch { return ['unreadable']; } };
const cleanupJournal = () => { try { return JSON.parse(appLocalStore.getItem('zoew_cleanup_journal_v1') || '[]'); } catch { return ['unreadable']; } };
const serverBarcode = (id: string, code: string) => ((getPath(HISTORY + '/' + id) || {}).barcodes || []).find((b: any) => b.code === code) || null;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    lab.store = {};
    lab.hang = [];
    lab.fail = null;
    lab.mirrorWrites = 0;
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
    dataState.pickupLedgerRepairDone = true;
    dataState.pickupLedgerRepairRunning = false;
    dataState.pickupResumeInFlight = false;
    dataState.cleanupResumeInFlight = false;
    uiState.toasts = [];
    pickup.pickupIntentsLive.clear();
    cleanup.cleanupJournalLive.clear();
    cleanup.cleanupInFlight.clear();
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'mx1-durable' } } as any;
    firebaseState.db = { mx1: true } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.dbListenersFailed = false;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.fb = makeFb() as any;
    for (const [name, path] of [['dbRefHistory', HISTORY], ['dbRefDeleted', TRASH],
        ['dbRefDailyRevenue', 'zoew_daily_revenue_cod_dod'], ['dbRefMonthlyRevenue', 'zoew_monthly_revenue_cod_dod'],
        ['dbRefDailyCollected', MIRROR], ['dbRefDailyPickup', PICKUP],
        ['dbRefRegistry', 'zoew_barcode_registry']] as const) {
        (firebaseState as any)[name] = { path };
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

it.each(['barcode', 'whole'])('⛔ បិទ (%s) ៖ កញ្ចប់ + ស្ថិតិយក commit រួច · mirror ព្យួរ ➜ ទំព័រស្លាប់ ➜ ទ្វារស្តារសរសេរ mirror លើថ្ងៃបិទ', async (kind) => {
    seedItem('c1', ['MX1C0001', 'MX1C0002'], []);
    loadViewsFromServer();
    lab.hang = [MIRROR];
    void (kind === 'whole' ? toggleCloseStatus('c1') : applyBarcodeCloseChange('c1', 'MX1C0001', true, { silent: true, showModal: false }));
    await sleep(40);
    expect(serverBarcode('c1', 'MX1C0001').isClosed, 'លក្ខខណ្ឌមុន ៖ កញ្ចប់បិទលើ server').toBe(true);
    expect(getPath(PICKUP + '/' + DAY).packagesPickedUp, 'លក្ខខណ្ឌមុន ៖ ស្ថិតិយក commit រួច').toBe(kind === 'whole' ? 2 : 1);
    expect(actualMirror(), 'លក្ខខណ្ឌមុន ៖ mirror មិនទាន់សរសេរ').toEqual({});
    crashAndReload();
    await resumeDoors();
    expect(Object.keys(expectedMirror()).length).toBe(kind === 'whole' ? 2 : 1);
    expect(actualMirror(), 'mirror = barcode បិទលើថ្ងៃបិទ').toEqual(expectedMirror());
    expect(pickupJournal(), 'mirror ចុះរួច ➜ journal ទទេ').toEqual([]);
});

it.each(['barcode', 'whole'])('⛔ បើកវិញ (%s) ៖ កញ្ចប់ + ស្ថិតិយក commit រួច · ការលុប mirror ព្យួរ ➜ ទំព័រស្លាប់ ➜ mirror លែងរាប់ barcode បើក', async (kind) => {
    seedItem('r1', ['MX1R0001'], ['MX1R0001']);
    loadViewsFromServer();
    expect(Object.keys(actualMirror()), 'លក្ខខណ្ឌមុន ៖ mirror មាន barcode បិទ').toHaveLength(1);
    lab.hang = [MIRROR];
    void (kind === 'whole' ? toggleCloseStatus('r1') : applyBarcodeCloseChange('r1', 'MX1R0001', false, { silent: true, showModal: false }));
    await sleep(40);
    expect(serverBarcode('r1', 'MX1R0001').isClosed, 'លក្ខខណ្ឌមុន ៖ កញ្ចប់បើកលើ server').toBe(false);
    crashAndReload();
    await resumeDoors();
    expect(expectedMirror()).toEqual({});
    expect(actualMirror(), 'barcode បើក ➜ គ្មានក្នុង mirror').toEqual({});
    expect(pickupJournal()).toEqual([]);
});

it('⛔ ដក barcode បិទ ៖ claim កញ្ចប់រួច · ធុងសំរាម/mirror មិនទាន់ ➜ ទំព័រស្លាប់ ➜ ការស្តារដកប្រាក់ ហើយលុប mirror', async () => {
    seedItem('d1', ['MX1D0001', 'MX1D0002'], ['MX1D0001']);
    seedRevenue();
    loadViewsFromServer();
    expect(Object.keys(actualMirror()), 'លក្ខខណ្ឌមុន ៖ mirror មាន barcode បិទ').toHaveLength(1);
    lab.hang = [TRASH];
    void removeSingleBarcode('d1', 'MX1D0001');
    await sleep(40);
    expect(serverBarcode('d1', 'MX1D0001'), 'លក្ខខណ្ឌមុន ៖ barcode ចេញពីកញ្ចប់លើ server').toBeNull();
    expect(cleanupJournal(), 'លក្ខខណ្ឌមុន ៖ journal ការសម្អាតនៅ').toHaveLength(1);
    crashAndReload();
    await resumeDoors();
    const trash = Object.values(getPath(TRASH) || {}) as any[];
    expect(trash.map((t) => t.trashReason), 'ធុងសំរាម «ដក» ត្រូវបានបញ្ចប់').toEqual(['remove']);
    expect(trash[0].barcodes[0].isDeducted, 'ប្រាក់ដករួច').toBe(true);
    expect(actualMirror(), 'barcode ដក (ដកប្រាក់រួច) ➜ គ្មានក្នុង mirror').toEqual(expectedMirror());
    expect(actualMirror()).toEqual({});
    expect(cleanupJournal()).toEqual([]);
});

it('⛔ ដក barcode បិទ ៖ ការស្តារឃើញ mirror សរសេរមិនចុះ ➜ journal នៅ · ជុំក្រោយបញ្ចប់ (មិនដកប្រាក់ ២ ដង)', async () => {
    seedItem('d2', ['MX1D0011', 'MX1D0012'], ['MX1D0011']);
    seedRevenue();
    loadViewsFromServer();
    lab.hang = [TRASH];
    void removeSingleBarcode('d2', 'MX1D0011');
    await sleep(40);
    crashAndReload();
    lab.fail = (path, kind) => (kind === 'update' && path.indexOf(MIRROR) === 0 ? new Error('permission_denied') : null);
    await resumeDoors();
    expect(cleanupJournal(), 'mirror មិនចុះ ➜ journal នៅ').toHaveLength(1);
    expect(Object.keys(actualMirror())).toHaveLength(1);
    lab.fail = null;
    loadViewsFromServer();
    await resumeDoors();
    expect(actualMirror()).toEqual({});
    expect(cleanupJournal()).toEqual([]);
    const day = getPath('zoew_daily_revenue_cod_dod/' + DAY) || {};
    expect(Math.round((day.codDollar || 0) * 100) / 100, 'ប្រាក់ដកតែម្តង').toBe(96);
    expect(Math.round((day.dodDollar || 0) * 100) / 100, 'DOD ដកតែម្តង').toBe(9);
    expect(day.totalCount, 'ចំនួនកញ្ចប់ដកតែម្តង').toBe(9);
});

it.each(['barcode', 'whole'])('⛔ បិទ (%s) ត្រូវបដិសេធក្រោយ landed (txOutcome ≠ not-applied) ➜ mirror reconcile ពី server', async (kind) => {
    seedItem('f1', ['MX1F0001'], []);
    loadViewsFromServer();
    lab.fail = (path, k) => (k === 'transaction' && path === HISTORY + '/f1' ? { error: new Error('disconnect') } : null);
    const saved = kind === 'whole' ? await toggleCloseStatus('f1') : await applyBarcodeCloseChange('f1', 'MX1F0001', true, { silent: true, showModal: false });
    expect(saved).toBe(false);
    lab.fail = null;
    await sleep(40);
    expect(serverBarcode('f1', 'MX1F0001').isClosed, 'លក្ខខណ្ឌមុន ៖ ការបិទ landed លើ server').toBe(true);
    expect(Object.keys(expectedMirror())).toHaveLength(1);
    expect(actualMirror(), 'mirror ស្របនឹង server').toEqual(expectedMirror());
    expect(pickupJournal(), 'mirror ចុះរួច ➜ journal ទទេ').toEqual([]);
});

it.each(['barcode', 'whole'])('⛔ បិទ (%s) បដិសេធក្រោយ landed · reconcile ព្យួរ ➜ ទំព័រស្លាប់ ➜ ទ្វារស្តារបញ្ចប់ mirror', async (kind) => {
    seedItem('f2', ['MX1F0011'], []);
    loadViewsFromServer();
    lab.fail = (path, k) => (k === 'transaction' && path === HISTORY + '/f2' ? { error: new Error('disconnect') } : null);
    lab.hang = [MIRROR];
    void (kind === 'whole' ? toggleCloseStatus('f2') : applyBarcodeCloseChange('f2', 'MX1F0011', true, { silent: true, showModal: false }));
    await sleep(40);
    expect(serverBarcode('f2', 'MX1F0011').isClosed, 'លក្ខខណ្ឌមុន ៖ ការបិទ landed').toBe(true);
    crashAndReload();
    await resumeDoors();
    expect(Object.keys(expectedMirror())).toHaveLength(1);
    expect(actualMirror()).toEqual(expectedMirror());
    expect(pickupJournal()).toEqual([]);
});

it.each(['barcode', 'whole'])('ទិសផ្ទុយ ៖ បិទ (%s) បដិសេធ not-applied ➜ មិនសរសេរ mirror', async (kind) => {
    seedItem('n1', ['MX1N0001'], []);
    loadViewsFromServer();
    lab.fail = (path, k) => (k === 'transaction' && path === HISTORY + '/n1'
        ? { notApplied: true, error: Object.assign(new Error('disconnect'), { txOutcome: 'not-applied' }) } : null);
    const saved = kind === 'whole' ? await toggleCloseStatus('n1') : await applyBarcodeCloseChange('n1', 'MX1N0001', true, { silent: true, showModal: false });
    expect(saved).toBe(false);
    lab.fail = null;
    await sleep(40);
    expect(serverBarcode('n1', 'MX1N0001').isClosed).toBe(false);
    expect(lab.mirrorWrites, 'not-applied ➜ គ្មានការសរសេរ mirror').toBe(0);
    expect(actualMirror()).toEqual({});
});

it('ទិសផ្ទុយ ៖ ប្រតិបត្តិការធម្មតា ➜ mirror ត្រឹមត្រូវ និង journal ទទេ · entry ចាស់គ្មាន item / barcode បាត់ ➜ ដកចេញដោយមិនសរសេរ mirror', async () => {
    seedItem('ok1', ['MX1K0001', 'MX1K0002'], []);
    loadViewsFromServer();
    await applyBarcodeCloseChange('ok1', 'MX1K0001', true, { silent: true, showModal: false });
    await toggleCloseStatus('ok1');
    await sleep(40);
    expect(actualMirror()).toEqual(expectedMirror());
    expect(Object.keys(actualMirror())).toHaveLength(2);
    expect(pickupJournal()).toEqual([]);
    const writes = lab.mirrorWrites;
    pickup.beginPickupIntent(DAY, [barcodeRegistryKey('MX1K0001')]);
    pickup.beginPickupIntent(DAY, [barcodeRegistryKey('MX1GONE01')], 'ok1');
    crashAndReload();
    uiState.toasts = [];
    await resumeDoors();
    expect(pickupJournal()).toEqual([]);
    expect(lab.mirrorWrites, 'គ្មានអ្វីត្រូវ reconcile ➜ មិនសរសេរ mirror').toBe(writes);
    expect(actualMirror()).toEqual(expectedMirror());
    expect(uiState.toasts.map((t: any) => t.msg).filter((m: string) => /ចំណូលប្រចាំថ្ងៃ/.test(m)), 'ទ្វារស្តារមិនបង្ហាញសារ').toEqual([]);
});
