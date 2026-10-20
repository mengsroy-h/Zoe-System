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
import { LOCK_STALL_RELEASE_MS } from '../src/services/network';
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
const lab = { store: {} as Record<string, any>, hang: [] as string[], fail: null as null | ((path: string, kind: string) => any), mirrorWrites: 0,
    hangTx: null as null | ((path: string, next: any) => boolean), mirrorGate: null as null | Promise<void>, captures: [] as any[] };

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
            if (ref.path.indexOf(MIRROR) === 0 && lab.mirrorGate) await lab.mirrorGate;
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
                if (lab.hangTx && lab.hangTx(ref.path, next)) return new Promise(() => {});
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
    lab.hangTx = null;
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
const toastMsgs = (): string[] => (uiState.toasts || []).map((t: any) => t.msg);
const mirrorToasts = () => toastMsgs().filter((m) => /ចំណូលប្រចាំថ្ងៃ/.test(m));
const finishedToasts = () => toastMsgs().filter((m) => /បញ្ចប់ការសម្អាតស្វ័យប្រវត្តិ/.test(m));
const revenueDay = () => {
    const day = getPath('zoew_daily_revenue_cod_dod/' + DAY) || {};
    return [Math.round((day.codDollar || 0) * 100) / 100, Math.round((day.dodDollar || 0) * 100) / 100, day.totalCount];
};
const refuseMirror = () => { lab.fail = (path, kind) => (kind === 'update' && path.indexOf(MIRROR) === 0 ? new Error('permission_denied') : null); };

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    lab.store = {};
    lab.hang = [];
    lab.fail = null;
    lab.mirrorWrites = 0;
    lab.hangTx = null;
    lab.mirrorGate = null;
    lab.captures = [];
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
    (window as any).ZoeErrors = { capture: (error: any, extra: any) => { lab.captures.push({ message: error && error.message, extra }); } };
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

it('⛔ ដក barcode បិទ ៖ ការស្តារឃើញ mirror សរសេរមិនចុះ ➜ ប្រាក់ដក + ទង់ isDeducted ក្នុងជុំដដែល · journal នៅ «collected» មិនរាប់ថាចប់ · ជុំក្រោយបញ្ចប់ (មិនដកប្រាក់ ២ ដង)', async () => {
    seedItem('d2', ['MX1D0011', 'MX1D0012'], ['MX1D0011']);
    seedRevenue();
    loadViewsFromServer();
    lab.hang = [TRASH];
    void removeSingleBarcode('d2', 'MX1D0011');
    await sleep(40);
    crashAndReload();
    refuseMirror();
    uiState.toasts = [];
    await resumeDoors();
    expect(revenueDay(), 'mirror មិនចុះ ➜ ប្រាក់នៅតែដកក្នុងជុំដដែល').toEqual([96, 9, 9]);
    const trash = Object.values(getPath(TRASH) || {}) as any[];
    expect(trash.map((t) => t.barcodes[0].isDeducted), 'ទង់ isDeducted តាមប្រាក់').toEqual([true]);
    expect(cleanupJournal().map((e: any) => e.stage), 'mirror មិនចុះ ➜ journal នៅ «collected»').toEqual(['collected']);
    expect(Object.keys(actualMirror())).toHaveLength(1);
    expect(finishedToasts(), 'មិនទាន់ចប់ ➜ មិនរាប់ ✅').toEqual([]);
    expect(mirrorToasts(), 'ទ្វារស្តារស្ងាត់').toEqual([]);
    lab.fail = null;
    loadViewsFromServer();
    await resumeDoors();
    expect(actualMirror()).toEqual({});
    expect(cleanupJournal()).toEqual([]);
    expect(revenueDay(), 'ប្រាក់ ដក និងចំនួនកញ្ចប់ ដកតែម្តង').toEqual([96, 9, 9]);
    expect(finishedToasts(), 'ចប់ពិត ➜ រាប់ ✅ ម្តង').toHaveLength(1);
});

it('⛔ mirror បដិសេធជាប់រហូត ➜ មិនរារាំងប្រាក់ ឬសមត្ថភាព journal ៖ ប្រាក់ដកម្តង · journal ចេញក្រោយ CLEANUP_LEDGER_RETRY_MAX ជុំ + Sentry', async () => {
    seedItem('d3', ['MX1D0021', 'MX1D0022'], ['MX1D0021']);
    seedRevenue();
    loadViewsFromServer();
    lab.hang = [TRASH];
    void removeSingleBarcode('d3', 'MX1D0021');
    await sleep(40);
    crashAndReload();
    refuseMirror();
    for (let round = 1; round < cleanup.CLEANUP_LEDGER_RETRY_MAX; round++) {
        await resumeDoors();
        expect(cleanupJournal(), 'ជុំ ' + round + ' ៖ journal នៅ').toHaveLength(1);
    }
    await resumeDoors();
    expect(cleanupJournal(), 'ក្រោយចំនួនជុំកំណត់ ➜ journal ចេញ').toEqual([]);
    expect(revenueDay(), 'ប្រាក់ដកតែម្តង').toEqual([96, 9, 9]);
    expect(lab.captures.filter((c) => c.extra && c.extra.context === 'finishCleanupCollected' && c.extra.zone === 'data'), 'Sentry ម្តង').toHaveLength(1);
    expect(mirrorToasts()).toEqual([]);
});

it.each(['delete', 'pickup'])('⛔ journal «ដក» ចាស់ (flip) ៖ barcode ត្រូវ Restore ពីឧបករណ៍ផ្សេង រួចទៅធុងសំរាម «%s» (បិទ · មិនដក) ➜ mark mirror ត្រូវនៅ', async (reason) => {
    seedItem('x1', ['MX1X0001', 'MX1X0002'], ['MX1X0001']);
    seedRevenue();
    loadViewsFromServer();
    lab.hangTx = (path, next) => path.indexOf(TRASH + '/') === 0 && !!next && Array.isArray(next.barcodes) && next.barcodes.some((b: any) => b && b.isDeducted === true);
    void removeSingleBarcode('x1', 'MX1X0001');
    await sleep(80);
    const journal = cleanupJournal();
    expect(journal.map((e: any) => e.stage), 'លក្ខខណ្ឌមុន ៖ ជាប់នៅ flip').toEqual(['flip']);
    expect(actualMirror(), 'លក្ខខណ្ឌមុន ៖ ការដកផ្ទាល់លុប mirror រួច').toEqual({});
    const restoreAt = NOW + 30 * 60 * 1000;
    setPath(TRASH + '/' + journal[0].trashItem.id, null);
    const item = getPath(HISTORY + '/x1');
    const restored = { code: 'MX1X0001', isClosed: true, closedAt: restoreAt, restoredAt: restoreAt, cod: 4, dod: 1, isDeducted: false, isFromDeletion: true, createdAt: NOW - 3 * H, time: '13:30:00' };
    setPath(MIRROR + '/' + getZoneDateKey(restoreAt, 0) + '/' + barcodeRegistryKey('MX1X0001'), { c: 4, d: 1 });
    if (reason === 'delete') {
        setPath(HISTORY + '/x1', null);
        setPath(TRASH + '/x1', Object.assign({}, item, { trashReason: 'delete', isFromDeletion: true, deletedAt: restoreAt + 1000, count: 2,
            barcodes: [...item.barcodes.map((b: any) => ({ ...b, isFromDeletion: true })), restored] }));
    } else {
        setPath(TRASH + '/x1_pk', Object.assign({}, item, { id: 'x1_pk', trashReason: 'pickup', isFromDeletion: true, deletedAt: restoreAt + 2 * H + 1000,
            isClosed: true, closedAt: restoreAt, count: 1, barcode: 'MX1X0001', barcodes: [restored] }));
    }
    vi.setSystemTime(new Date(NOW + 4 * H));
    crashAndReload();
    expect(Object.keys(expectedMirror()), 'លក្ខខណ្ឌមុន ៖ barcode បិទ មិនដក ក្នុងធុងសំរាម «' + reason + '»').toHaveLength(1);
    await resumeDoors();
    expect(actualMirror(), 'journal ចាស់មិនលុប mark របស់វដ្តថ្មី').toEqual(expectedMirror());
    expect(cleanupJournal()).toEqual([]);
});

it('ទិសផ្ទុយ ៖ journal «ដក» ចាស់ (flip) ៖ copy ក្នុងធុងសំរាម «delete» ដែលដករួច (isDeducted) មិនការពារ mark ➜ mark ត្រូវលុប', async () => {
    seedItem('x3', ['MX1X0021', 'MX1X0022'], ['MX1X0021']);
    seedRevenue();
    loadViewsFromServer();
    lab.hangTx = (path, next) => path.indexOf(TRASH + '/') === 0 && !!next && Array.isArray(next.barcodes) && next.barcodes.some((b: any) => b && b.isDeducted === true);
    void removeSingleBarcode('x3', 'MX1X0021');
    await sleep(80);
    expect(cleanupJournal().map((e: any) => e.stage), 'លក្ខខណ្ឌមុន ៖ ជាប់នៅ flip').toEqual(['flip']);
    const item = getPath(HISTORY + '/x3');
    setPath(TRASH + '/x3_old', Object.assign({}, item, { id: 'x3_old', trashReason: 'delete', isFromDeletion: true, deletedAt: NOW - H, count: 1, barcode: 'MX1X0021',
        barcodes: [{ code: 'MX1X0021', isClosed: true, closedAt: NOW - 2 * H, cod: 4, dod: 1, isDeducted: true, isFromDeletion: true, createdAt: NOW - 3 * H, time: '13:30:00' }] }));
    setPath(MIRROR + '/' + DAY + '/' + barcodeRegistryKey('MX1X0021'), { c: 4, d: 1 });
    crashAndReload();
    expect(Object.keys(actualMirror()), 'លក្ខខណ្ឌមុន ៖ mark នៅ').toHaveLength(1);
    await resumeDoors();
    expect(actualMirror()).toEqual({});
    expect(cleanupJournal()).toEqual([]);
    expect(revenueDay(), 'ប្រាក់ដកតែម្តង').toEqual([96, 9, 9]);
});

it('⛔ ការស្តារ journal បិទ ៦ ថ្ងៃចាស់ ➜ មិនបង្កើតថ្ងៃ mirror ហួស retention ឡើងវិញ', async () => {
    const { collectedRetentionCutoffKey } = await import('../src/domain/collected');
    const t0 = Date.UTC(2026, 9, 1, 15, 0, 0);
    vi.setSystemTime(new Date(t0));
    const day = getZoneDateKey(t0, 0);
    setPath(HISTORY + '/e1', { phone: PHONE, scanDate: day, isClosed: false, createdAt: t0 - H, cod: 4, dod: 1, price: 5, count: 1, barcode: 'MX1E0001', time: '21:00:00 (' + day + ')',
        barcodes: [{ code: 'MX1E0001', isClosed: false, cod: 4, dod: 1, isDeducted: false, isFromDeletion: false, createdAt: t0 - H, time: '21:00:00' }] });
    loadViewsFromServer();
    lab.hang = [MIRROR];
    void applyBarcodeCloseChange('e1', 'MX1E0001', true, { silent: true, showModal: false });
    await sleep(40);
    expect(serverBarcode('e1', 'MX1E0001').isClosed, 'លក្ខខណ្ឌមុន ៖ បិទលើ server').toBe(true);
    const later = t0 + 6 * 24 * H + 20 * H;
    vi.setSystemTime(new Date(later));
    crashAndReload();
    const cutoff = collectedRetentionCutoffKey(later);
    expect(day < cutoff, 'លក្ខខណ្ឌមុន ៖ ថ្ងៃបិទហួស retention').toBe(true);
    expect(pickupJournal(), 'លក្ខខណ្ឌមុន ៖ journal នៅក្នុងអាយុ').toHaveLength(1);
    await resumeDoors();
    expect(Object.keys(getPath(MIRROR) || {}).filter((d) => d < cutoff), 'គ្មានថ្ងៃ mirror ចាស់ជាង retention').toEqual([]);
    expect(pickupJournal(), 'គ្មានអ្វីត្រូវសរសេរ ➜ journal ចេញ').toEqual([]);
});

it('⛔ ការស្តារ journal បិទ ៖ mirror បដិសេធ ➜ ទ្វារស្តារស្ងាត់ (គ្មានសារ «⚠️ … ចំណូលប្រចាំថ្ងៃ») · journal នៅ', async () => {
    seedItem('q1', ['MX1Q0001'], []);
    loadViewsFromServer();
    lab.hang = [MIRROR];
    void applyBarcodeCloseChange('q1', 'MX1Q0001', true, { silent: true, showModal: false });
    await sleep(40);
    crashAndReload();
    refuseMirror();
    uiState.toasts = [];
    for (let round = 0; round < 3; round++) await resumeDoors();
    expect(mirrorToasts(), 'ទ្វារស្តារស្ងាត់').toEqual([]);
    expect(pickupJournal(), 'mirror មិនចុះ ➜ journal នៅ').toHaveLength(1);
    lab.fail = null;
    await resumeDoors();
    expect(actualMirror()).toEqual(expectedMirror());
    expect(pickupJournal()).toEqual([]);
});

it('⛔ ដកផ្ទាល់ ៖ mirror បដិសេធពេល online ➜ ✅ ភ្លាម · ប្រាក់ដកម្តង · journal នៅ «collected» · ការស្តារលុប mark', async () => {
    seedItem('g1', ['MX1G0001', 'MX1G0002'], ['MX1G0001']);
    seedRevenue();
    loadViewsFromServer();
    refuseMirror();
    const out = await removeSingleBarcode('g1', 'MX1G0001');
    expect(out).toBe('done');
    expect(toastMsgs().some((m) => /✅ បានដកកញ្ចប់អីវ៉ាន់ និងកាត់ប្រាក់/.test(m)), 'លទ្ធផលដែលអ្នកប្រើឃើញមិនពន្យារ').toBe(true);
    expect(revenueDay()).toEqual([96, 9, 9]);
    await sleep(40);
    expect(cleanupJournal().map((e: any) => e.stage), 'mirror មិនចុះ ➜ journal នៅ').toEqual(['collected']);
    lab.fail = null;
    crashAndReload();
    await resumeDoors();
    expect(actualMirror()).toEqual(expectedMirror());
    expect(actualMirror()).toEqual({});
    expect(cleanupJournal()).toEqual([]);
    expect(revenueDay(), 'ប្រាក់ដកតែម្តង').toEqual([96, 9, 9]);
});

it('⛔ ដកផ្ទាល់ ៖ mirror កំពុងសរសេរ ➜ ✅ និងលទ្ធផលមិនរង់ចាំ · journal នៅ (ផ្ទាល់ · មិនផ្ទេរទៅការស្តារ) រហូត mirror ចុះ', async () => {
    seedItem('g2', ['MX1G0011', 'MX1G0012'], ['MX1G0011']);
    seedRevenue();
    loadViewsFromServer();
    let release: () => void = () => {};
    lab.mirrorGate = new Promise<void>((resolve) => { release = resolve; });
    const out = await removeSingleBarcode('g2', 'MX1G0011');
    expect(out, 'លទ្ធផលមិនរង់ចាំ mirror').toBe('done');
    expect(revenueDay()).toEqual([96, 9, 9]);
    const journal = cleanupJournal();
    expect(journal.map((e: any) => e.stage), 'mirror មិនទាន់ចុះ ➜ journal នៅ').toEqual(['collected']);
    expect(cleanup.cleanupJournalLive.has(journal[0].trashItem.id), 'នៅជាម្ចាស់ផ្ទាល់ ➜ ការស្តារមិនរត់ស្រប').toBe(true);
    lab.mirrorGate = null;
    release();
    await sleep(20);
    expect(cleanupJournal()).toEqual([]);
    expect(cleanup.cleanupJournalLive.size).toBe(0);
    expect(actualMirror()).toEqual({});
});

it('⛔ ដកផ្ទាល់ ៖ mirror ព្យួររហូត (សរសេរមុន deleteApp) · ប្តូរ session ➜ ម្ចាស់ផ្ទាល់មិនជាប់ · ការស្តារក្នុងហាងដដែលបញ្ចប់ entry ភ្លាម · ប្រាក់មិនប៉ះ', async () => {
    seedItem('n7', ['MX1N0071', 'MX1N0072'], ['MX1N0071']);
    seedRevenue();
    loadViewsFromServer();
    lab.hang = [MIRROR];
    expect(await removeSingleBarcode('n7', 'MX1N0071')).toBe('done');
    await sleep(30);
    const journal = cleanupJournal();
    expect(journal.map((e: any) => e.stage), 'លក្ខខណ្ឌមុន ៖ mirror មិនទាន់ចុះ ➜ journal នៅ «collected»').toEqual(['collected']);
    const trashId = journal[0].trashItem.id;
    expect(cleanup.cleanupJournalLive.has(trashId), 'លក្ខខណ្ឌមុន ៖ នៅជាម្ចាស់ផ្ទាល់').toBe(true);
    expect(revenueDay(), 'លក្ខខណ្ឌមុន ៖ ប្រាក់ដករួច').toEqual([96, 9, 9]);
    firebaseState.authGeneration++;
    firebaseState.db = { mx1b: true } as any;
    lab.hang = [];
    loadViewsFromServer();
    uiState.toasts = [];
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(cleanup.cleanupJournalLive.has(trashId), 'session ចាស់លែងជាម្ចាស់').toBe(false);
    expect(cleanupJournal(), 'ការស្តារបញ្ចប់ entry').toEqual([]);
    expect(actualMirror()).toEqual(expectedMirror());
    expect(actualMirror()).toEqual({});
    expect(revenueDay(), 'ប្រាក់ដកតែម្តង').toEqual([96, 9, 9]);
    expect(uiState.toasts, 'session ថ្មីគ្មានសារ').toEqual([]);
});

it('⛔ ដកផ្ទាល់ ៖ mirror ព្យួរក្នុង session ដដែល ➜ ម្ចាស់ផ្ទាល់លែងក្រោយ LOCK_STALL_RELEASE_MS · ការស្តារបញ្ចប់ · ការសរសេរចាស់ចុះយឺតមិនធ្វើការឡើងវិញ', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('h7', ['MX1H0071', 'MX1H0072'], ['MX1H0071']);
    seedRevenue();
    loadViewsFromServer();
    let landLate: () => void = () => {};
    lab.mirrorGate = new Promise<void>((resolve) => { landLate = resolve; });
    const removal = removeSingleBarcode('h7', 'MX1H0071');
    await vi.advanceTimersByTimeAsync(200);
    expect(await removal).toBe('done');
    const trashId = cleanupJournal()[0].trashItem.id;
    expect(cleanupJournal().map((e: any) => e.stage), 'លក្ខខណ្ឌមុន ៖ journal នៅ «collected»').toEqual(['collected']);
    lab.mirrorGate = null;
    await vi.advanceTimersByTimeAsync(LOCK_STALL_RELEASE_MS - 1000);
    expect(cleanup.cleanupJournalLive.has(trashId), 'មុនពិដាន ៖ នៅជាម្ចាស់ផ្ទាល់').toBe(true);
    expect(cleanupJournal(), 'មុនពិដាន ៖ ការស្តារមិនរត់ស្រប').toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(500);
    expect(cleanup.cleanupJournalLive.has(trashId), 'ក្រោយពិដាន ៖ លែងជាម្ចាស់').toBe(false);
    expect(cleanupJournal(), 'ការស្តារក្នុង session ដដែលបញ្ចប់ entry').toEqual([]);
    expect(actualMirror()).toEqual({});
    const writes = lab.mirrorWrites;
    landLate();
    await vi.advanceTimersByTimeAsync(200);
    for (let round = 0; round < 2; round++) {
        await resumeInterruptedCleanups();
        await vi.advanceTimersByTimeAsync(200);
    }
    expect(lab.mirrorWrites, 'ការសរសេរចាស់ចុះម្តង · គ្មានការធ្វើឡើងវិញ').toBe(writes + 1);
    expect(cleanupJournal()).toEqual([]);
    expect(cleanup.cleanupJournalLive.size).toBe(0);
    expect(actualMirror()).toEqual({});
    expect(revenueDay(), 'ប្រាក់ដកតែម្តង').toEqual([96, 9, 9]);
    expect(finishedToasts(), 'មិនរាប់ ✅ «បញ្ចប់ការសម្អាត…»').toEqual([]);
    expect(mirrorToasts()).toEqual([]);
});

it('⛔ ដកផ្ទាល់ ៖ ប្តូរ session · ការស្តារបញ្ចប់ · ការសរសេរ mirror ចាស់ចុះយឺត ➜ entry មិនកើតវិញ · គ្មានការធ្វើឡើងវិញ · គ្មានសារក្នុង session ថ្មី', async () => {
    seedItem('l7', ['MX1L0071', 'MX1L0072'], ['MX1L0071']);
    seedRevenue();
    loadViewsFromServer();
    let landLate: () => void = () => {};
    lab.mirrorGate = new Promise<void>((resolve) => { landLate = resolve; });
    expect(await removeSingleBarcode('l7', 'MX1L0071')).toBe('done');
    const trashId = cleanupJournal()[0].trashItem.id;
    expect(cleanup.cleanupJournalLive.has(trashId), 'លក្ខខណ្ឌមុន ៖ នៅជាម្ចាស់ផ្ទាល់').toBe(true);
    firebaseState.authGeneration++;
    firebaseState.db = { mx1c: true } as any;
    lab.mirrorGate = null;
    loadViewsFromServer();
    uiState.toasts = [];
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(cleanupJournal(), 'ការស្តារក្នុង session ថ្មីបញ្ចប់ entry').toEqual([]);
    const writes = lab.mirrorWrites;
    landLate();
    await sleep(30);
    for (let round = 0; round < 2; round++) await resumeDoors();
    expect(lab.mirrorWrites, 'ការសរសេរចាស់ចុះម្តង · គ្មានការធ្វើឡើងវិញ').toBe(writes + 1);
    expect(cleanupJournal()).toEqual([]);
    expect(cleanup.cleanupJournalLive.size).toBe(0);
    expect(actualMirror()).toEqual({});
    expect(revenueDay(), 'ប្រាក់ដកតែម្តង').toEqual([96, 9, 9]);
    expect(uiState.toasts, 'session ថ្មីគ្មានសារ').toEqual([]);
});

it('⛔ holdCleanupJournalLive ៖ session ផ្លាស់រួចពេលចាប់កាន់ ➜ លែងភ្លាម · ម្ចាស់ចាស់មិនលែងម្ចាស់ថ្មីលើ id ដដែល · ម្ចាស់ធម្មតានៅរារាំង', async () => {
    cleanup.markCleanupJournalLive('tHoldA');
    cleanup.holdCleanupJournalLive(['tHoldA', 'tHoldA', null], new Promise(() => {}), () => false);
    expect(cleanup.cleanupJournalLive.has('tHoldA'), 'session ចាស់ពេលចាប់កាន់ ➜ លែងភ្លាម').toBe(false);
    let settle: () => void = () => {};
    let current = true;
    cleanup.markCleanupJournalLive('tHoldB');
    cleanup.holdCleanupJournalLive(['tHoldB'], new Promise<void>((resolve) => { settle = resolve; }), () => current);
    expect(cleanup.cleanupJournalLive.has('tHoldB')).toBe(true);
    expect(await cleanup.withCleanupEntryOwnership('tHoldB', async () => {}), 'session ដដែល ➜ នៅជាម្ចាស់').toBe(false);
    current = false;
    let ran = false;
    expect(await cleanup.withCleanupEntryOwnership('tHoldB', async () => { ran = true; }), 'session ផ្លាស់ ➜ ការស្តារបានជាម្ចាស់').toBe(true);
    expect(ran).toBe(true);
    cleanup.markCleanupJournalLive('tHoldB');
    const newer = cleanup.cleanupJournalLive.get('tHoldB');
    settle();
    await sleep(5);
    expect(cleanup.cleanupJournalLive.get('tHoldB'), 'ការកាន់ចាស់ចប់ ➜ មិនលែងម្ចាស់ថ្មី').toBe(newer);
    expect(await cleanup.withCleanupEntryOwnership('tHoldB', async () => {}), 'ម្ចាស់ធម្មតា (គ្មានការកាន់) នៅរារាំង').toBe(false);
    cleanup.releaseCleanupJournalLive('tHoldB');
});

it('⛔ journal «ដក» legacy (ledger) · ធុងសំរាមលុបជាអចិន្ត្រៃយ៍ · barcode មិនត្រឡប់ក្នុង history ➜ «unverified» ហើយលុប mark mirror · ប្រាក់មិនប៉ះ', async () => {
    seedItem('lg1', ['MX1L0001', 'MX1L0002'], ['MX1L0001']);
    seedRevenue();
    const item = getPath(HISTORY + '/lg1');
    const gone = item.barcodes.find((b: any) => b.code === 'MX1L0001');
    item.barcodes = item.barcodes.filter((b: any) => b.code !== 'MX1L0001');
    item.count = 1;
    item.isClosed = false;
    delete item.closedAt;
    setPath(HISTORY + '/lg1', item);
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify([{ id: 'lg1', reason: 'remove', journalAt: NOW - H, stage: 'ledger', scope: cleanup.cleanupJournalScope(),
        trashItem: { id: 'id_lg1_gone', deletedAt: NOW - H, scanDate: DAY, trashReason: 'remove', isFromDeletion: false, barcode: 'MX1L0001', count: 1, cod: 4, dod: 1,
            barcodes: [Object.assign({}, gone, { isFromDeletion: false })] },
        revenue: { scanDate: DAY, cod: 4, dod: 1, count: 1 } }]));
    loadViewsFromServer();
    expect(Object.keys(actualMirror()), 'លក្ខខណ្ឌមុន ៖ mark នៅ').toHaveLength(1);
    expect(Object.keys(expectedMirror()), 'លក្ខខណ្ឌមុន ៖ barcode លែងមានក្នុង history និងធុងសំរាម').toHaveLength(0);
    refuseMirror();
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(cleanupJournal().map((e: any) => [e.stage, e.outcome]), 'mirror មិនចុះ ➜ entry នៅ «collected» ចាំ «unverified»').toEqual([['collected', 'unverified']]);
    expect(toastMsgs().filter((m) => /មិនអាចផ្ទៀងផ្ទាត់/.test(m)), 'មិនទាន់ចប់ ➜ មិនទាន់រាយការណ៍').toEqual([]);
    lab.fail = null;
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(actualMirror(), 'mark របស់ barcode ដែលបាត់ត្រូវលុប').toEqual({});
    expect(cleanupJournal()).toEqual([]);
    expect(revenueDay(), 'ប្រាក់មិនប៉ះ').toEqual([100, 10, 10]);
    expect(toastMsgs().filter((m) => /មិនអាចផ្ទៀងផ្ទាត់/.test(m)), '«unverified» រាយការណ៍ម្តង').toHaveLength(1);
    expect(lab.captures.filter((c) => c.extra && c.extra.context === 'resumeInterruptedCleanups unverified'), 'Sentry ម្តង').toHaveLength(1);
});

it('ទិសផ្ទុយ ៖ journal «ដក» legacy (ledger) · ធុងសំរាមបាត់ · barcode ត្រឡប់ក្នុង history (Restore) ➜ mark របស់វានៅ · ប្រាក់មិនប៉ះ', async () => {
    seedItem('lg2', ['MX1L0011', 'MX1L0012'], ['MX1L0011']);
    seedRevenue();
    const item = getPath(HISTORY + '/lg2');
    const back = item.barcodes.find((b: any) => b.code === 'MX1L0011');
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify([{ id: 'lg2', reason: 'remove', journalAt: NOW - H, stage: 'ledger', scope: cleanup.cleanupJournalScope(),
        trashItem: { id: 'id_lg2_gone', deletedAt: NOW - H, scanDate: DAY, trashReason: 'remove', isFromDeletion: false, barcode: 'MX1L0011', count: 1, cod: 4, dod: 1,
            barcodes: [Object.assign({}, back, { isFromDeletion: false })] },
        revenue: { scanDate: DAY, cod: 4, dod: 1, count: 1 } }]));
    loadViewsFromServer();
    expect(Object.keys(expectedMirror()), 'លក្ខខណ្ឌមុន ៖ barcode បិទក្នុង history').toHaveLength(1);
    const writes = lab.mirrorWrites;
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(actualMirror()).toEqual(expectedMirror());
    expect(lab.mirrorWrites, 'គ្មាន mark ត្រូវលុប ➜ មិនសរសេរ mirror').toBe(writes);
    expect(cleanupJournal()).toEqual([]);
    expect(revenueDay(), 'ប្រាក់មិនប៉ះ').toEqual([100, 10, 10]);
});

it('ទិសផ្ទុយ ៖ ដកផ្ទាល់ធម្មតា ➜ journal ទទេភ្លាមពេលត្រឡប់', async () => {
    seedItem('g3', ['MX1G0021', 'MX1G0022'], ['MX1G0021']);
    seedRevenue();
    loadViewsFromServer();
    expect(await removeSingleBarcode('g3', 'MX1G0021')).toBe('done');
    expect(cleanupJournal()).toEqual([]);
    expect(actualMirror()).toEqual({});
    expect(revenueDay()).toEqual([96, 9, 9]);
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

const SHOP_B = JSON.stringify({ apiKey: 'k', databaseURL: 'https://mx1-other-default-rtdb.firebaseio.com', projectId: 'q' });

function fakeWebLocks() {
    const held = new Set<string>();
    const queues = new Map<string, Array<() => void>>();
    const releaseNow = (name: string) => {
        const queue = queues.get(name);
        if (queue && queue.length) {
            queue.shift()!();
            return;
        }
        held.delete(name);
    };
    const request = (name: string, opts: any, cb?: any) => {
        const fn = typeof opts === 'function' ? opts : cb;
        const options = typeof opts === 'function' ? {} : (opts || {});
        return new Promise((resolve, reject) => {
            const run = () => {
                held.add(name);
                let result: Promise<any>;
                try { result = Promise.resolve(fn({ name })); } catch (e) { result = Promise.reject(e); }
                result.then((value) => { releaseNow(name); resolve(value); }, (error) => { releaseNow(name); reject(error); });
            };
            if (held.has(name) || (queues.get(name) || []).length) {
                if (options.ifAvailable) {
                    Promise.resolve().then(() => fn(null)).then(resolve, reject);
                    return;
                }
                if (!queues.has(name)) queues.set(name, []);
                queues.get(name)!.push(run);
                return;
            }
            held.add(name);
            queueMicrotask(run);
        });
    };
    return { held, api: { request } };
}

async function withWebLocks(body: (locks: ReturnType<typeof fakeWebLocks>) => Promise<void>) {
    const locks = fakeWebLocks();
    Object.defineProperty(navigator, 'locks', { configurable: true, value: locks.api });
    try {
        await body(locks);
    } finally {
        delete (navigator as any).locks;
    }
}

it('⛔ ដកផ្ទាល់ · Web Lock ៖ mirror ព្យួររហូត · ប្តូរ session ➜ ការស្តារលែងការកាន់ចាស់ ហើយរង់ចាំ Web Lock លែងពិត ➜ បញ្ចប់ entry ក្នុងជុំដដែល', async () => {
    await withWebLocks(async (locks) => {
        seedItem('w7', ['MX1W0071', 'MX1W0072'], ['MX1W0071']);
        seedRevenue();
        loadViewsFromServer();
        lab.hang = [MIRROR];
        expect(await removeSingleBarcode('w7', 'MX1W0071')).toBe('done');
        await sleep(30);
        const trashId = cleanupJournal()[0].trashItem.id;
        expect(cleanupJournal().map((e: any) => e.stage), 'លក្ខខណ្ឌមុន ៖ journal នៅ «collected»').toEqual(['collected']);
        expect(locks.held.has(cleanup.CLEANUP_LIVE_LOCK_PREFIX + trashId), 'លក្ខខណ្ឌមុន ៖ tab កាន់ Web Lock').toBe(true);
        firebaseState.authGeneration++;
        firebaseState.db = { mx1w: true } as any;
        lab.hang = [];
        loadViewsFromServer();
        uiState.toasts = [];
        await resumeInterruptedCleanups();
        await sleep(30);
        expect(cleanup.cleanupJournalLive.has(trashId), 'session ចាស់លែងជាម្ចាស់').toBe(false);
        expect(locks.held.has(cleanup.CLEANUP_LIVE_LOCK_PREFIX + trashId), 'Web Lock លែង').toBe(false);
        expect(cleanupJournal(), 'ការស្តារបញ្ចប់ entry ក្នុងជុំដដែល').toEqual([]);
        expect(actualMirror()).toEqual({});
        expect(revenueDay(), 'ប្រាក់ដកតែម្តង').toEqual([96, 9, 9]);
    });
});

it('⛔ ដកផ្ទាល់ · Web Lock tab ផ្សេង ៖ tab A កាន់ ➜ tab B មិនបញ្ចប់ជំនួសមុនពិដាន · ក្រោយពិដាន tab A លែង Web Lock ➜ tab B បញ្ចប់', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    await withWebLocks(async (locks) => {
        seedItem('w9', ['MX1W0091', 'MX1W0092'], ['MX1W0091']);
        seedRevenue();
        loadViewsFromServer();
        lab.hang = [MIRROR];
        const removal = removeSingleBarcode('w9', 'MX1W0091');
        await vi.advanceTimersByTimeAsync(200);
        expect(await removal).toBe('done');
        const trashId = cleanupJournal()[0].trashItem.id;
        const lockName = cleanup.CLEANUP_LIVE_LOCK_PREFIX + trashId;
        expect(locks.held.has(lockName), 'លក្ខខណ្ឌមុន ៖ tab A កាន់ Web Lock').toBe(true);
        const asTabB = async () => {
            const tabA = new Map(cleanup.cleanupJournalLive);
            cleanup.cleanupJournalLive.clear();
            const hangA = lab.hang;
            lab.hang = [];
            try {
                const pass = resumeInterruptedCleanups();
                await vi.advanceTimersByTimeAsync(cleanup.CLEANUP_OWNERSHIP_WAIT_MS + 1000);
                await pass;
            } finally {
                lab.hang = hangA;
                tabA.forEach((owner, id) => { if (!cleanup.cleanupJournalLive.has(id)) cleanup.cleanupJournalLive.set(id, owner); });
            }
        };
        await asTabB();
        expect(cleanupJournal(), 'tab B ឃើញ Web Lock របស់ tab A ➜ មិនបញ្ចប់ជំនួស').toHaveLength(1);
        expect(cleanup.cleanupJournalLive.has(trashId), 'tab A នៅកាន់').toBe(true);
        await vi.advanceTimersByTimeAsync(LOCK_STALL_RELEASE_MS + 1000);
        await vi.advanceTimersByTimeAsync(LOCK_STALL_RELEASE_MS + 4000);
        expect(cleanup.cleanupJournalLive.has(trashId), 'ក្រោយពិដាន tab A លែងជាម្ចាស់').toBe(false);
        expect(locks.held.has(lockName), 'ក្រោយពិដាន និងការស្តាររបស់ tab A ខ្លួនឯង ➜ Web Lock លែង').toBe(false);
        await asTabB();
        expect(cleanupJournal(), 'tab B បញ្ចប់').toEqual([]);
        expect(actualMirror()).toEqual({});
        expect(revenueDay(), 'ប្រាក់ដកតែម្តង').toEqual([96, 9, 9]);
    });
});

it('⛔ ដកផ្ទាល់ mirror ព្យួររហូត · Reconfig ទៅហាង B ➜ entry របស់ហាង A ចេញដោយ scope ផ្សេង ➜ Sentry (data) តាមដានបាន · ប្រាក់មិនប៉ះ', async () => {
    seedItem('s1', ['MX1S0011', 'MX1S0012'], ['MX1S0011']);
    seedRevenue();
    loadViewsFromServer();
    lab.hang = [MIRROR];
    expect(await removeSingleBarcode('s1', 'MX1S0011')).toBe('done');
    await sleep(30);
    const trashId = cleanupJournal()[0].trashItem.id;
    expect(cleanupJournal().map((e: any) => e.stage), 'លក្ខខណ្ឌមុន ៖ journal នៅ «collected»').toEqual(['collected']);
    expect(cleanup.cleanupJournalLive.has(trashId), 'លក្ខខណ្ឌមុន ៖ នៅកាន់').toBe(true);
    appLocalStore.setItem('zoew_firebase_config', SHOP_B);
    firebaseState.authGeneration++;
    firebaseState.db = { shopB: true } as any;
    lab.hang = [];
    lab.captures = [];
    await resumeInterruptedCleanups();
    await sleep(30);
    expect(cleanup.cleanupJournalLive.has(trashId), 'ការកាន់ចាស់លែង').toBe(false);
    expect(cleanupJournal(), 'scope ផ្សេង ➜ entry ចេញ').toEqual([]);
    const dropped = lab.captures.filter((c) => c.extra && c.extra.context === 'resumeCleanupJournalEntry scope mismatch');
    expect(dropped.map((c) => [c.extra.zone, c.extra.itemId]), 'Sentry ម្តង · zone data · item id').toEqual([['data', 's1']]);
    expect(lab.captures.filter((c) => c.extra && c.extra.zone === 'money'), 'មិនមែនបញ្ហាប្រាក់').toEqual([]);
    expect(revenueDay(), 'ប្រាក់ដកតែម្តង').toEqual([96, 9, 9]);
});

it.each(['gone', 'present'])('⛔ journal «ដក» legacy (ledger) · ធុងសំរាម %s · mirror ព្យួរ ➜ entry ចាំ «unverified» · Reconfig ទៅហាង B ➜ សញ្ញា Sentry money មិនបាត់', async (trash) => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('s2', ['MX1S0021', 'MX1S0022'], ['MX1S0021']);
    seedRevenue();
    const item = getPath(HISTORY + '/s2');
    const gone = item.barcodes.find((b: any) => b.code === 'MX1S0021');
    item.barcodes = item.barcodes.filter((b: any) => b.code !== 'MX1S0021');
    item.count = 1;
    item.isClosed = false;
    delete item.closedAt;
    setPath(HISTORY + '/s2', item);
    const trashItem = { id: 'id_s2_' + trash, deletedAt: NOW - H, scanDate: DAY, trashReason: 'remove', isFromDeletion: false, barcode: 'MX1S0021', count: 1, cod: 4, dod: 1,
        barcodes: [Object.assign({}, gone, { isFromDeletion: false })] };
    if (trash === 'present') setPath(TRASH + '/' + trashItem.id, trashItem);
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify([{ id: 's2', reason: 'remove', journalAt: NOW - H, stage: 'ledger', scope: cleanup.cleanupJournalScope(),
        trashItem, revenue: { scanDate: DAY, cod: 4, dod: 1, count: 1 } }]));
    loadViewsFromServer();
    lab.hang = [MIRROR];
    const first = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(LOCK_STALL_RELEASE_MS + 5000);
    await first;
    expect(cleanupJournal().map((e: any) => [e.stage, e.outcome]), 'លក្ខខណ្ឌមុន ៖ mirror មិនចុះ ➜ entry នៅ «collected» ចាំ «unverified»').toEqual([['collected', 'unverified']]);
    expect(toastMsgs().filter((m) => /មិនអាចផ្ទៀងផ្ទាត់/.test(m)), 'លក្ខខណ្ឌមុន ៖ មិនទាន់រាយការណ៍').toEqual([]);
    expect(lab.captures.filter((c) => c.extra && c.extra.zone === 'money'), 'លក្ខខណ្ឌមុន ៖ មិនទាន់ Sentry money').toEqual([]);
    appLocalStore.setItem('zoew_firebase_config', SHOP_B);
    firebaseState.authGeneration++;
    firebaseState.db = { shopB2: true } as any;
    lab.hang = [];
    const second = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(5000);
    await second;
    expect(cleanupJournal(), 'scope ផ្សេង ➜ entry ចេញ').toEqual([]);
    const money = lab.captures.filter((c) => c.extra && c.extra.zone === 'money');
    expect(money.map((c) => [c.extra.context, c.extra.itemId]), 'សញ្ញា «unverified» នៅ ៖ Sentry money ម្តង').toEqual([['resumeCleanupJournalEntry scope mismatch', 's2']]);
    expect(revenueDay(), 'ប្រាក់មិនប៉ះ').toEqual([100, 10, 10]);
});

it('⛔ ការស្តារ offline (ការអាន/សរសេរ RTDB ព្យួរ) ៖ entry «collected» ដែល mirror ព្យួរ ➜ គ្មានការសរសេរ mirror ថ្មី · ជុំមិនរង់ចាំពិដាន dbOp · ទិសផ្ទុយ online ➜ ការលុប mark ដើរ', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    const codes = ['MX1P0011', 'MX1P0012', 'MX1P0013', 'MX1P0014', 'MX1P0015', 'MX1P0016'];
    seedItem('p1', codes, codes.slice(0, 5));
    seedRevenue();
    loadViewsFromServer();
    lab.hang = [MIRROR];
    let calls = 0;
    const fb: any = firebaseState.fb;
    const update = fb.update;
    const get = fb.get;
    fb.update = (ref: any, payload: any) => {
        if (ref.path.indexOf(MIRROR) === 0) calls++;
        return firebaseState.isDatabaseConnected ? update(ref, payload) : new Promise(() => {});
    };
    fb.get = (ref: any) => (firebaseState.isDatabaseConnected ? get(ref) : new Promise(() => {}));
    for (const code of codes.slice(0, 5)) {
        const removal = removeSingleBarcode('p1', code);
        await vi.advanceTimersByTimeAsync(50);
        expect(await removal).toBe('done');
    }
    const afterRemoves = calls;
    expect(afterRemoves, 'លក្ខខណ្ឌមុន ៖ ការដកនីមួយៗសរសេរ mirror ម្តង').toBe(5);
    expect(cleanupJournal().map((e: any) => e.stage), 'លក្ខខណ្ឌមុន ៖ entry ៥ នៅ «collected»').toEqual(Array(5).fill('collected'));
    firebaseState.isDatabaseConnected = false;
    await vi.advanceTimersByTimeAsync(LOCK_STALL_RELEASE_MS + 1000);
    expect(cleanup.cleanupJournalLive.size, 'ក្រោយពិដាន ៖ ការកាន់លែង').toBe(0);
    expect(dataState.cleanupResumeInFlight, 'ជុំ handoff offline ចប់ភ្លាម').toBe(false);
    const pass = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(100);
    expect(dataState.cleanupResumeInFlight, 'ជុំ offline មិនរង់ចាំពិដាន dbOp').toBe(false);
    await pass;
    expect(calls, 'offline ➜ គ្មានការសរសេរ mirror ថ្មី').toBe(afterRemoves);
    expect(cleanupJournal().map((e: any) => e.stage), 'entry នៅចាំ online').toEqual(Array(5).fill('collected'));
    expect(revenueDay(), 'ប្រាក់ដកតែម្តង').toEqual([70, 5, 5]);
    firebaseState.isDatabaseConnected = true;
    lab.hang = [];
    const online = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(1000);
    await online;
    expect(calls, 'online ➜ ការលុប mark ដើរ').toBeGreaterThan(afterRemoves);
    expect(cleanupJournal(), 'online ➜ entry ចប់').toEqual([]);
    expect(actualMirror()).toEqual(expectedMirror());
    expect(actualMirror()).toEqual({});
    expect(revenueDay(), 'ប្រាក់ដកតែម្តង').toEqual([70, 5, 5]);
});
