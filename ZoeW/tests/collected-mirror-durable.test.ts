/**
 * ⛔ MX-1 ៖ mirror «ចំណូលតាមថ្ងៃយក» (`zoew_daily_collected_cod_dod`) ត្រូវរស់រានពេលទំព័រស្លាប់ចន្លោះ commit កញ្ចប់ និង commit mirror។
 *    មុនកែ ៖ ការបិទ/បើកដក journal ស្ថិតិយកចេញភ្លាមពេល pickup commit ចុះ ហើយទើបសរសេរ mirror · ការដក barcode បិទ
 *    លុប mirror តែក្នុង `finishRemoval` ➜ ការស្តារ journal សម្អាតគ្មានជំហាន mirror ➜ ចំណូលតាមថ្ងៃយកខុសរហូត ៧ ថ្ងៃ។
 *    ច្បាប់ ៖ mirror = barcode បិទ មិនទាន់ដក (`isDeducted` ≠ true) លើថ្ងៃបិទរបស់វា · ទ្វារស្តារពិត (`resumePickupIntents` ·
 *    `resumeInterruptedCleanups`) បញ្ចប់វា · ផ្លូវបរាជ័យដែលអាច landed (txOutcome ≠ 'not-applied') reconcile ពី server។
 *    ទិសផ្ទុយ ៖ 'not-applied' មិនសរសេរ mirror · ប្រតិបត្តិការធម្មតាមិនបន្សល់ journal · entry ចាស់គ្មាន `item` នៅដើរដូចមុន។
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
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
import { DB_OP_TIMEOUT_MS, LOCK_STALL_RELEASE_MS } from '../src/services/network';
import { toggleCloseStatus, deleteSingleItem } from '../src/features/entry-ops';

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
    hangTx: null as null | ((path: string, next: any) => boolean), mirrorGate: null as null | Promise<void>, captures: [] as any[],
    txGate: null as null | ((path: string) => Promise<void> | null) };

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
            const gate = lab.txGate ? lab.txGate(ref.path) : null;
            return (gate || Promise.resolve()).then(() => sleep(1)).then(() => {
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

const scopeDrops = () => lab.captures.filter((c) => c.extra && c.extra.context === 'resumeCleanupJournalEntry scope mismatch');
const moneyCaptures = () => lab.captures.filter((c) => c.extra && c.extra.zone === 'money');

it('⛔ ដក ៖ ជំហាន ledger ព្យួរ ➜ ទំព័រស្លាប់ ➜ បើកវិញក្នុងហាង B ➜ entry ហាង A (ledger · ប្រាក់មិនទាន់បញ្ជាក់) ចេញ ➜ Sentry money ម្តង', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('e1', ['MX1E0011', 'MX1E0012'], ['MX1E0011']);
    seedRevenue();
    loadViewsFromServer();
    lab.hangTx = (path) => path.indexOf('zoew_monthly_revenue_cod_dod') === 0;
    void removeSingleBarcode('e1', 'MX1E0011');
    await vi.advanceTimersByTimeAsync(500);
    expect(cleanupJournal().map((e: any) => [e.stage, e.ledger]), 'លក្ខខណ្ឌមុន ៖ entry នៅជំហាន ledger').toEqual([['ledger', 'keyed']]);
    expect(revenueDay(), 'លក្ខខណ្ឌមុន ៖ ប្រាក់មិនទាន់ដក').toEqual([100, 10, 10]);
    expect(moneyCaptures(), 'លក្ខខណ្ឌមុន ៖ គ្មាន Sentry money').toEqual([]);
    crashAndReload();
    appLocalStore.setItem('zoew_firebase_config', SHOP_B);
    firebaseState.db = { shopB: true } as any;
    const pass = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(5000);
    await pass;
    expect(cleanupJournal(), 'scope ផ្សេង ➜ entry ចេញ').toEqual([]);
    expect(moneyCaptures().map((c) => [c.extra.context, c.extra.itemId]), 'ការដកមិនបានបញ្ជាក់ ➜ Sentry money ម្តង').toEqual([['resumeCleanupJournalEntry scope mismatch', 'e1']]);
    expect(lab.captures, 'Sentry តែម្តង').toHaveLength(1);
    expect(revenueDay(), 'ហាង B មិនសរសេរប្រាក់ហាង A').toEqual([100, 10, 10]);
});

it('⛔ ដក ៖ ប្តូរហាងពេលជំហាន ledger កំពុងរត់ ➜ ការដកត្រឡប់ pending ស្ងាត់ (remove-stale-session) ➜ ជុំហាង B ទម្លាក់ entry ➜ Sentry money ម្តងសរុប', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('e2', ['MX1E0021', 'MX1E0022'], ['MX1E0021']);
    seedRevenue();
    loadViewsFromServer();
    let open: () => void = () => {};
    const gate = new Promise<void>((resolve) => { open = resolve; });
    lab.txGate = (path) => (path.indexOf('zoew_monthly_revenue_cod_dod') === 0 ? gate : null);
    const removal = removeSingleBarcode('e2', 'MX1E0021');
    await vi.advanceTimersByTimeAsync(300);
    expect(cleanupJournal().map((e: any) => e.stage), 'លក្ខខណ្ឌមុន ៖ ជំហាន ledger កំពុងរត់').toEqual(['ledger']);
    appLocalStore.setItem('zoew_firebase_config', SHOP_B);
    firebaseState.authGeneration++;
    firebaseState.db = { shopB: true } as any;
    open();
    await vi.advanceTimersByTimeAsync(300);
    expect(await removal).toBe('pending');
    expect(lab.captures, 'ការដកខ្លួនឯងស្ងាត់ ៖ entry នៅ ➜ ហាងដដែលបញ្ចប់វា').toEqual([]);
    lab.txGate = null;
    const pass = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(5000);
    await pass;
    expect(cleanupJournal(), 'scope ផ្សេង ➜ entry ចេញ').toEqual([]);
    expect(moneyCaptures().map((c) => [c.extra.context, c.extra.itemId]), 'month ≠ day ➜ Sentry money ម្តង').toEqual([['resumeCleanupJournalEntry scope mismatch', 'e2']]);
    expect(lab.captures, 'Sentry តែម្តងសរុប').toHaveLength(1);
    const month = getPath('zoew_monthly_revenue_cod_dod/' + DAY.substring(0, 7));
    expect([month.codDollar, month.dodDollar, month.totalCount], 'លក្ខខណ្ឌ ៖ ខែដករួច').toEqual([96, 9, 9]);
    expect(revenueDay(), 'លក្ខខណ្ឌ ៖ ថ្ងៃមិនទាន់ដក').toEqual([100, 10, 10]);
});

it.each([
    ['moved', false, '', 'data'],
    ['slot', true, '', 'money'],
    ['moved', true, '', 'money'],
    ['flip', true, '', 'money'],
    ['undo', true, '', 'money'],
    ['collected', true, 'restored', 'data'],
    ['collected', true, '', 'data'],
    ['collected', true, 'unverified', 'money']
])('⛔ entry ហាង A (stage %s · revenue %s · outcome «%s») ➜ ហាង B ទម្លាក់ ➜ Sentry ម្តង zone %s · គ្មានការសរសេរ', async (stage, revenue, outcome, zone) => {
    const closedAt = NOW - 2 * H;
    const trashItem = { id: 'id_z1_' + stage, deletedAt: NOW - H, scanDate: DAY, trashReason: revenue ? 'remove' : 'pickup', isFromDeletion: !revenue,
        barcode: 'MX1Z0011', count: 1, cod: 4, dod: 1, isClosed: true, closedAt,
        barcodes: [{ code: 'MX1Z0011', isClosed: true, closedAt, cod: 4, dod: 1, isDeducted: false, isFromDeletion: !revenue }] };
    const entry: any = { id: 'z1', reason: revenue ? 'remove' : 'close', journalAt: NOW - H, stage, scope: cleanup.cleanupJournalScope(), trashItem,
        revenue: revenue ? { scanDate: DAY, cod: 4, dod: 1, count: 1 } : null };
    if (outcome) entry.outcome = outcome;
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify([entry]));
    appLocalStore.setItem('zoew_firebase_config', SHOP_B);
    firebaseState.authGeneration++;
    firebaseState.db = { shopB: true } as any;
    const before = JSON.stringify(lab.store);
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(cleanupJournal(), 'scope ផ្សេង ➜ entry ចេញ').toEqual([]);
    expect(lab.captures.map((c) => [c.extra.zone, c.extra.context, c.extra.itemId]), 'ការទម្លាក់នីមួយៗ ➜ Sentry ម្តង').toEqual([[zone, 'resumeCleanupJournalEntry scope mismatch', 'z1']]);
    expect(scopeDrops()).toHaveLength(1);
    expect(JSON.stringify(lab.store), 'ហាង B មិនសរសេរអ្វី').toBe(before);
});

it('⛔ journal ស្ថិតិយក ៖ item «a/b» (មិនមែន id) ➜ គ្មានផ្លូវ Firebase ណាប្រើវា · ការស្តារបញ្ចប់ day record ដដែល · beginPickupIntent មិនទុក item មិនត្រឹមត្រូវ', async () => {
    const code = 'MX1A0011';
    const key = barcodeRegistryKey(code);
    const closedAt = NOW - 2 * H;
    setPath(TRASH + '/pa_tr', { id: 'pa_tr', phone: PHONE, scanDate: DAY, deletedAt: NOW - H, trashReason: 'pickup', isFromDeletion: true, isClosed: true, closedAt,
        barcode: code, count: 1, cod: 4, dod: 1, barcodes: [{ code, isClosed: true, closedAt, cod: 4, dod: 1, isDeducted: false, isFromDeletion: true, createdAt: NOW - 3 * H }] });
    setPath(HISTORY + '/a', { b: { decoy: true } });
    loadViewsFromServer();
    dataState.scanHistory = [];
    appLocalStore.setItem('zoew_pickup_journal_v1', JSON.stringify([{ id: 'pk_bad', scope: cleanup.cleanupJournalScope(), date: DAY, keys: [key], at: Date.now(), item: 'a/b' }]));
    const refs: string[] = [];
    const fb: any = firebaseState.fb;
    const ref = fb.ref;
    fb.ref = (db: unknown, path: string) => { refs.push(String(path)); return ref(db, path); };
    await pickup.resumePickupIntents();
    await sleep(20);
    expect(refs.length, 'លក្ខខណ្ឌមុន ៖ ការស្តាររត់').toBeGreaterThan(0);
    expect(refs.filter((path) => path.indexOf('a/b') !== -1), 'គ្មាន reconcile/ការសរសេរលើ «a/b»').toEqual([]);
    expect(lab.mirrorWrites, 'គ្មានការសរសេរ mirror').toBe(0);
    expect(getPath(PICKUP + '/' + DAY + '/pickedUpBarcodes/' + key), 'day record ពីការពិតលើ server').toBe(PHONE);
    expect(pickupJournal(), 'entry បញ្ចប់').toEqual([]);
    const bad = pickup.beginPickupIntent(DAY, [key], 'a/b');
    const good = pickup.beginPickupIntent(DAY, [key], 'ok_1');
    const stored = pickupJournal();
    expect(stored.find((e: any) => e.id === bad), 'item មិនត្រឹមត្រូវ ➜ មិនទុក').not.toHaveProperty('item');
    expect(stored.find((e: any) => e.id === good).item, 'ទិសផ្ទុយ ៖ id ត្រឹមត្រូវទុក').toBe('ok_1');
    pickup.releasePickupIntent(bad);
    pickup.releasePickupIntent(good);
});

it.each([true, false])('⛔ ដកផ្ទាល់ ៖ mirror កំពុងសរសេរ · ឧបករណ៍ផ្សេង Restore barcode (បិទវិញ %s) ➜ ការលុប mark ចាស់ចុះយឺត ➜ mirror តាម reconcile · ប្រាក់មិនប៉ះ', async (reclosed) => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('b1', ['MX1B0011', 'MX1B0012'], ['MX1B0011']);
    seedRevenue();
    loadViewsFromServer();
    let open: () => void = () => {};
    lab.mirrorGate = new Promise<void>((resolve) => { open = resolve; });
    const removal = removeSingleBarcode('b1', 'MX1B0011');
    await vi.advanceTimersByTimeAsync(300);
    expect(await removal).toBe('done');
    const entry = cleanupJournal()[0];
    expect(entry.stage, 'លក្ខខណ្ឌមុន ៖ mirror មិនទាន់ចុះ').toBe('collected');
    const item = getPath(HISTORY + '/b1');
    const back: any = Object.assign({}, entry.trashItem.barcodes[0], { isClosed: reclosed, isDeducted: false, restoredAt: NOW });
    if (reclosed) back.closedAt = NOW; else delete back.closedAt;
    item.barcodes.push(back);
    item.count = 2;
    setPath(HISTORY + '/b1', item);
    setPath(TRASH + '/' + entry.trashItem.id, null);
    if (reclosed) setPath(MIRROR + '/' + getZoneDateKey(NOW, 0) + '/' + barcodeRegistryKey('MX1B0011'), { c: back.cod, d: back.dod });
    loadViewsFromServer();
    const money = revenueDay();
    open();
    lab.mirrorGate = null;
    await vi.advanceTimersByTimeAsync(1000);
    expect(Object.keys(expectedMirror()), 'លក្ខខណ្ឌ ៖ barcode ត្រឡប់ក្នុង history').toHaveLength(reclosed ? 1 : 0);
    expect(actualMirror(), 'mirror = barcode បិទ មិនទាន់ដក').toEqual(expectedMirror());
    expect(cleanupJournal(), 'entry បញ្ចប់').toEqual([]);
    expect(cleanup.cleanupJournalLive.size).toBe(0);
    expect(revenueDay(), 'ប្រាក់មិនប៉ះ').toEqual(money);
    expect(mirrorToasts(), 'ស្ងាត់').toEqual([]);
});

const gateReply = (prefix: string) => {
    let open: () => void = () => {};
    const gate = new Promise<void>((resolve) => { open = resolve; });
    const fb: any = firebaseState.fb;
    const orig = fb.runTransaction;
    fb.runTransaction = (ref: any, fn: any, o?: any) => {
        const p = orig(ref, fn, o);
        return ref.path.indexOf(prefix) === 0 ? p.then(async (r: any) => { await gate; return r; }) : p;
    };
    return () => open();
};
const failTrashOnce = () => {
    let failed = 0;
    lab.fail = (path, kind) => (kind === 'transaction' && path.indexOf(TRASH + '/') === 0 && failed++ === 0
        ? { notApplied: true, error: Object.assign(new Error('network'), { txOutcome: 'not-applied' }) } : null);
};
const seedAbandoned = (id: string, code: string) => {
    seedItem(id, [code], []);
    const old = getPath(HISTORY + '/' + id);
    old.createdAt = NOW - 9 * 24 * H;
    old.barcodes[0].createdAt = NOW - 9 * 24 * H;
    setPath(HISTORY + '/' + id, old);
};
const switchShopB = () => {
    appLocalStore.setItem('zoew_firebase_config', SHOP_B);
    firebaseState.authGeneration++;
    firebaseState.db = { shopB: true } as any;
};
const capturesOf = (id: string) => lab.captures.filter((c) => c.extra && (c.extra.itemId === id || String(c.extra.itemIds || '').split(',').includes(id)));

it.each([
    ['remove · ចម្លើយ history ក្រោយប្តូរហាង', 'rm-claim'],
    ['remove · ធុងសំរាមបរាជ័យម្តង · ប្តូរហាងពេលរង់ចាំ retry', 'rm-trash'],
    ['abandon · ចម្លើយ history ក្រោយប្តូរហាង', 'ab-claim'],
    ['abandon · ចម្លើយធុងសំរាមក្រោយប្តូរហាង', 'ab-trash-reply'],
    ['abandon · ធុងសំរាមបរាជ័យម្តង · ប្តូរហាងពេលរង់ចាំ retry', 'ab-trash'],
    ['abandon · ប្តូរហាងពេលជំហាន ledger', 'ab-ledger']
])('⛔ ប្រតិបត្តិការមួយដែលដាច់ពេលប្តូរហាង (%s) ➜ Sentry money តែម្តងសរុប ៖ សញ្ញាពេលប្តូរបោះត្រា journal ➜ ហាង B ទម្លាក់ស្ងាត់', async (_label, kind) => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    const id = 'sw_' + kind.replace(/-/g, '_');
    const code = 'MX1W' + String(['rm-claim', 'rm-trash', 'ab-claim', 'ab-trash-reply', 'ab-trash', 'ab-ledger'].indexOf(kind) + 1).padStart(4, '0');
    if (kind.indexOf('rm-') === 0) seedItem(id, [code, code + 'X'], [code]); else seedAbandoned(id, code);
    seedRevenue();
    loadViewsFromServer();
    let open: () => void = () => {};
    if (kind === 'rm-claim' || kind === 'ab-claim') open = gateReply(HISTORY + '/');
    if (kind === 'ab-trash-reply') open = gateReply(TRASH + '/');
    if (kind === 'rm-trash' || kind === 'ab-trash') failTrashOnce();
    if (kind === 'ab-ledger') {
        const gate = new Promise<void>((resolve) => { open = resolve; });
        lab.txGate = (path) => (path.indexOf('zoew_monthly_revenue_cod_dod') === 0 ? gate : null);
    }
    const run = kind.indexOf('rm-') === 0 ? removeSingleBarcode(id, code) : cleanup.claimAndCleanupItem(id, 'abandon');
    await vi.advanceTimersByTimeAsync(100);
    expect(cleanupJournal().map((e: any) => e.id), 'លក្ខខណ្ឌមុន ៖ entry journal នៅ').toEqual([id]);
    switchShopB();
    open();
    await vi.advanceTimersByTimeAsync(5000);
    await run;
    expect(capturesOf(id).map((c) => c.extra.zone), 'លក្ខខណ្ឌមុន ៖ សញ្ញាពេលប្តូរ').toEqual(['money']);
    expect(cleanupJournal().map((e: any) => [e.id, e.switchReported]), 'entry បោះត្រា «បានរាយការណ៍»').toEqual([[id, true]]);
    lab.fail = null;
    lab.txGate = null;
    const pass = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(5000);
    await pass;
    expect(cleanupJournal(), 'scope ផ្សេង ➜ entry ចេញ').toEqual([]);
    expect(capturesOf(id).map((c) => [c.extra.zone, c.extra.context]), 'Sentry តែម្តងសរុបសម្រាប់ item នេះ').toEqual([[
        'money', kind.indexOf('rm-') === 0 ? 'removeSingleBarcode session switch'
            : 'claimAndCleanupItem session switch ' + (kind === 'ab-claim' ? 'claim' : kind === 'ab-ledger' ? 'ledger' : 'trash')]]);
});

it('ទិសផ្ទុយ ៖ ត្រា «បានរាយការណ៍» មិនរារាំងហាងដដែល ៖ Login ឡើងវិញក្នុងហាង A ➜ ការដកបញ្ចប់ (ប្រាក់ដកម្តង) · Sentry តែសញ្ញាពេលប្តូរ', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('sw_same', ['MX1W0101', 'MX1W0102'], ['MX1W0101']);
    seedRevenue();
    loadViewsFromServer();
    const open = gateReply(HISTORY + '/');
    const removal = removeSingleBarcode('sw_same', 'MX1W0101');
    await vi.advanceTimersByTimeAsync(100);
    firebaseState.authGeneration++;
    open();
    await vi.advanceTimersByTimeAsync(300);
    expect(await removal).toBe('stale');
    expect(cleanupJournal().map((e: any) => [e.stage, e.switchReported]), 'លក្ខខណ្ឌមុន ៖ entry បោះត្រា').toEqual([['slot', true]]);
    loadViewsFromServer();
    const pass = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(5000);
    await pass;
    expect(cleanupJournal(), 'ហាងដដែល ➜ entry បញ្ចប់').toEqual([]);
    expect(revenueDay(), 'ប្រាក់ដកម្តង').toEqual([96, 9, 9]);
    const trash = Object.values(getPath(TRASH) || {}) as any[];
    expect(trash.map((t) => [t.trashReason, t.barcodes[0].isDeducted])).toEqual([['remove', true]]);
    expect(capturesOf('sw_same').map((c) => c.extra.context)).toEqual(['removeSingleBarcode session switch']);
});

function realAdmitRepeat() {
    const src = readFileSync(path.join(__dirname, '..', 'public', 'error-reporting.js'), 'utf8');
    const start = src.indexOf('    function repeatSignature');
    const end = src.indexOf('    function capture(');
    const consts = (src.match(/const REPEAT_[A-Z_]+ = [^;]+;/g) || []).join('\n');
    expect(start > 0 && end > start && /REPEAT_IDENTITIES_MAX/.test(consts), 'លក្ខខណ្ឌមុន ៖ រក admitRepeat ពិតឃើញ').toBe(true);
    const ctx: any = { Date };
    vm.createContext(ctx);
    vm.runInContext(consts + '\nconst repeatSeen = new Map();\n' + src.slice(start, end) + '\nthis.admitRepeat = admitRepeat;', ctx);
    return ctx.admitRepeat;
}

it('⛔ ជុំមួយទម្លាក់ entry ហាង A ច្រើន ➜ Sentry មួយក្នុងមួយ zone (itemCount · itemIds) ➜ តម្រង repeat ពិតមិនបំបាត់ item ណា · entry បោះត្រារួចមិនរាយការណ៍ម្តងទៀត', async () => {
    const admitProbe = realAdmitRepeat();
    let probeAdmitted = 0;
    for (let i = 0; i < 8; i++) if (admitProbe(new Error('probe'), { zone: 'money', context: 'probe', itemId: 'probe' + i })) probeAdmitted++;
    expect(probeAdmitted, 'លក្ខខណ្ឌមុន ៖ តម្រងពិតទុកតែ ៥ item ក្នុងមួយ signature').toBe(5);
    const entryOf = (id: string, revenue: boolean, extra?: any) => {
        const closedAt = NOW - 2 * H;
        return Object.assign({ id, reason: revenue ? 'remove' : 'close', journalAt: NOW - H, stage: 'moved', scope: cleanup.cleanupJournalScope(),
            trashItem: { id: 'id_' + id, deletedAt: NOW - H, scanDate: DAY, trashReason: revenue ? 'remove' : 'pickup', isFromDeletion: !revenue, barcode: 'MX1Q' + id, count: 1, cod: 4, dod: 1, isClosed: true, closedAt,
                barcodes: [{ code: 'MX1Q' + id, isClosed: true, closedAt, cod: 4, dod: 1, isDeducted: false, isFromDeletion: !revenue }] },
            revenue: revenue ? { scanDate: DAY, cod: 4, dod: 1, count: 1 } : null }, extra || {});
    };
    const moneyIds = Array.from({ length: 12 }, (_v, i) => 'qm' + i);
    const dataIds = ['qd0', 'qd1', 'qd2'];
    const list = [...moneyIds.map((id) => entryOf(id, true)), ...dataIds.map((id) => entryOf(id, false)), entryOf('qr0', true, { switchReported: true })];
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify(list));
    switchShopB();
    const before = JSON.stringify(lab.store);
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(cleanupJournal(), 'scope ផ្សេង ➜ entry ទាំងអស់ចេញ').toEqual([]);
    expect(JSON.stringify(lab.store), 'ហាង B មិនសរសេរអ្វី').toBe(before);
    expect(lab.captures.map((c) => [c.extra.zone, c.extra.context, c.extra.itemId, c.extra.itemCount]), 'មួយក្នុងមួយ zone').toEqual([
        ['money', 'resumeCleanupJournalEntry scope mismatch', 'qm0', 12],
        ['data', 'resumeCleanupJournalEntry scope mismatch', 'qd0', 3]]);
    expect(lab.captures[0].extra.itemIds.split(','), 'itemIds ≤ ១០').toEqual(moneyIds.slice(0, cleanup.CLEANUP_DROP_REPORT_IDS_MAX));
    expect(lab.captures[1].extra.itemIds.split(',')).toEqual(dataIds);
    expect(capturesOf('qr0'), 'entry បោះត្រារួច ➜ មិនរាយការណ៍ម្តងទៀត').toEqual([]);
    const admit = realAdmitRepeat();
    const admitted = lab.captures.filter((c) => admit(new Error(c.message), c.extra));
    expect(admitted, 'តម្រង repeat ពិតមិនបំបាត់ព្រឹត្តិការណ៍ណា').toHaveLength(lab.captures.length);
    const reported = new Set(admitted.flatMap((c) => [c.extra.itemId, ...String(c.extra.itemIds || '').split(',')]));
    expect(moneyIds.slice(0, cleanup.CLEANUP_DROP_REPORT_IDS_MAX).every((id) => reported.has(id)), 'item ប្រាក់ ១០ ដំបូងឃើញក្នុង Sentry').toBe(true);
    expect(admitted.filter((c) => c.extra.zone === 'money').reduce((n, c) => n + c.extra.itemCount, 0), 'ចំនួនពិត').toBe(12);
});

it.each(['added', 'legacy', 'tokenless'])('⛔ ដកផ្ទាល់ ៖ ការលុប mark ចុះយឺត · history កាន់ barcode ក្រោមការស្តារមិនទាន់បញ្ចប់ (%s) ➜ មិនដាក់ mark វិញ ➜ ការស្តារត្រូវបោះបង់ ➜ mirror គ្មាន mark លើស', async (shape) => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('b5', ['MX1B0051', 'MX1B0052'], ['MX1B0051']);
    seedRevenue();
    loadViewsFromServer();
    let open: () => void = () => {};
    lab.mirrorGate = new Promise<void>((resolve) => { open = resolve; });
    const removal = removeSingleBarcode('b5', 'MX1B0051');
    await vi.advanceTimersByTimeAsync(300);
    expect(await removal).toBe('done');
    const entry = cleanupJournal()[0];
    expect(entry.stage, 'លក្ខខណ្ឌមុន ៖ mirror មិនទាន់ចុះ').toBe('collected');
    const trashId = entry.trashItem.id;
    const item = getPath(HISTORY + '/b5');
    item.barcodes.push(Object.assign({}, entry.trashItem.barcodes[0], { isClosed: true, isDeducted: false, closedAt: NOW }));
    item.count = 2;
    item.restoreClaimId = trashId;
    if (shape !== 'tokenless') item.restoreClaimToken = 'tok5';
    if (shape === 'added') item.restoreAddedCodes = JSON.stringify(['MX1B0051']);
    if (shape === 'tokenless') item.restoreAddedCodes = JSON.stringify(['MX1B0059']);
    setPath(HISTORY + '/b5', item);
    const tr = getPath(TRASH + '/' + trashId);
    tr.restoreClaim = { token: 'tok5', targetId: 'b5', at: NOW };
    setPath(TRASH + '/' + trashId, tr);
    loadViewsFromServer();
    const writes = lab.mirrorWrites;
    open();
    lab.mirrorGate = null;
    await vi.advanceTimersByTimeAsync(1000);
    expect(lab.mirrorWrites, 'ការលុបចាស់ចុះម្តង · គ្មានការដាក់ mark វិញ').toBe(writes + 1);
    expect(actualMirror(), 'barcode ក្រោមការស្តារ ➜ គ្មាន mark (ការស្តារ reconcile ខ្លួនឯងពេលបញ្ចប់)').toEqual({});
    expect(cleanupJournal(), 'entry បញ្ចប់').toEqual([]);
    const cancelled = getPath(HISTORY + '/b5');
    cancelled.barcodes = cancelled.barcodes.filter((b: any) => b.code !== 'MX1B0051');
    cancelled.count = 1;
    delete cancelled.restoreClaimId; delete cancelled.restoreClaimToken; delete cancelled.restoreAddedCodes;
    setPath(HISTORY + '/b5', cancelled);
    const tr2 = getPath(TRASH + '/' + trashId);
    delete tr2.restoreClaim;
    tr2.restoreBlocked = true;
    setPath(TRASH + '/' + trashId, tr2);
    expect(actualMirror(), 'ការស្តារបោះបង់ ➜ mirror = barcode បិទ មិនទាន់ដក').toEqual(expectedMirror());
    expect(revenueDay(), 'ប្រាក់ដកម្តង').toEqual([96, 9, 9]);
});

it('ទិសផ្ទុយ ៖ history មានការស្តារមួយទៀតកំពុងរៀបចំ (បញ្ចូល barcode ផ្សេង) · barcode របស់យើងត្រូវ Restore រួចមុន ➜ mark របស់វាត្រូវដាក់វិញ', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('b6', ['MX1B0061', 'MX1B0062'], ['MX1B0061']);
    seedRevenue();
    loadViewsFromServer();
    let open: () => void = () => {};
    lab.mirrorGate = new Promise<void>((resolve) => { open = resolve; });
    const removal = removeSingleBarcode('b6', 'MX1B0061');
    await vi.advanceTimersByTimeAsync(300);
    expect(await removal).toBe('done');
    const entry = cleanupJournal()[0];
    const item = getPath(HISTORY + '/b6');
    item.barcodes.push(Object.assign({}, entry.trashItem.barcodes[0], { isClosed: true, isDeducted: false, closedAt: NOW, restoredAt: NOW }));
    item.barcodes.push({ code: 'MX1B0069', isClosed: false, cod: 2, dod: 1, isDeducted: false, isFromDeletion: true, createdAt: NOW - 3 * H, time: '13:30:00' });
    item.count = 3;
    item.restoreClaimId = 'id_other';
    item.restoreClaimToken = 'tok6';
    item.restoreAddedCodes = JSON.stringify(['MX1B0069']);
    setPath(HISTORY + '/b6', item);
    setPath(TRASH + '/' + entry.trashItem.id, null);
    setPath(MIRROR + '/' + getZoneDateKey(NOW, 0) + '/' + barcodeRegistryKey('MX1B0061'), { c: 4, d: 1 });
    loadViewsFromServer();
    open();
    lab.mirrorGate = null;
    await vi.advanceTimersByTimeAsync(1000);
    expect(Object.keys(expectedMirror()), 'លក្ខខណ្ឌ ៖ barcode បិទក្នុង history').toEqual([getZoneDateKey(NOW, 0) + '/' + barcodeRegistryKey('MX1B0061')]);
    expect(actualMirror(), 'barcode មិនមែនជារបស់ការស្តារកំពុងរៀបចំ ➜ mark ដាក់វិញ').toEqual(expectedMirror());
    expect(cleanupJournal()).toEqual([]);
});

it('⛔ barcode ក្នុង history មាន isDeducted ចាស់ ៖ ការដកផ្ទាល់មិនដកប្រាក់ ➜ ទំព័រស្លាប់នៅ slot ➜ ការស្តារក៏មិនដកប្រាក់ (មិនដក ២ ដង)', async () => {
    seedItem('ld1', ['MX1L0101', 'MX1L0102'], []);
    const item = getPath(HISTORY + '/ld1');
    item.barcodes[0].isDeducted = true;
    setPath(HISTORY + '/ld1', item);
    seedRevenue();
    loadViewsFromServer();
    lab.hang = [TRASH];
    void removeSingleBarcode('ld1', 'MX1L0101');
    await sleep(40);
    expect(serverBarcode('ld1', 'MX1L0101'), 'លក្ខខណ្ឌមុន ៖ barcode ចេញពីកញ្ចប់លើ server').toBeNull();
    expect(cleanupJournal().map((e: any) => [e.stage, e.revenue]), 'barcode ដករួច ➜ journal គ្មានប្រាក់ត្រូវដក').toEqual([['slot', null]]);
    crashAndReload();
    await resumeDoors();
    expect(revenueDay(), 'ប្រាក់មិនប៉ះ').toEqual([100, 10, 10]);
    const trash = Object.values(getPath(TRASH) || {}) as any[];
    expect(trash.map((t) => [t.trashReason, t.barcodes[0].isDeducted]), 'ធុងសំរាម «ដក» ចុះ · ទង់ដដែល').toEqual([['remove', true]]);
    expect(cleanupJournal()).toEqual([]);
});

it('ទិសផ្ទុយ ៖ barcode មិនទាន់ដក ៖ journal ការដកមានប្រាក់ (cent) · barcode ដករួចក្នុង claim ច្រើនមិនត្រូវរាប់', () => {
    const parent = { id: 'pz', phone: PHONE, scanDate: DAY, createdAt: NOW - 3 * H, barcodes: [] as any[] };
    const one = cleanup.prepareCleanupClaim('pz', 'remove', null, Object.assign({}, parent, { barcodes: [{ code: 'MX1Z0101', cod: 4.555, dod: 1.1, isClosed: false, isDeducted: false }] }), 'local');
    expect(one.revenue).toMatchObject({ cod: 4.56, dod: 1.1, count: 1 });
    cleanup.releaseCleanupJournalLive(one.trashItem.id);
    const mixed = cleanup.prepareCleanupClaim('pz2', 'remove', null, Object.assign({}, parent, { id: 'pz2', barcodes: [
        { code: 'MX1Z0102', cod: 4, dod: 1, isClosed: false, isDeducted: true }, { code: 'MX1Z0103', cod: 2, dod: 0.5, isClosed: false, isDeducted: false }] }), 'local');
    expect(mixed.revenue).toMatchObject({ cod: 2, dod: 0.5, count: 1 });
    cleanup.releaseCleanupJournalLive(mixed.trashItem.id);
    const abandon = cleanup.prepareCleanupClaim('pz3', 'abandon', null, Object.assign({}, parent, { id: 'pz3', barcodes: [
        { code: 'MX1Z0104', cod: 4, dod: 1, isClosed: false, isDeducted: true }, { code: 'MX1Z0105', cod: 2, dod: 0.5, isClosed: false, isDeducted: false }] }), 'local');
    expect(abandon.revenue, 'abandon ដកទាំងអស់ដូចផ្លូវផ្ទាល់').toMatchObject({ cod: 6, dod: 1.5, count: 2 });
    cleanup.releaseCleanupJournalLive(abandon.trashItem.id);
});

it('⛔ ដកផ្ទាល់ ៖ Login ឡើងវិញ (auth ផ្លាស់ · db/ហាងដដែល) ពេល mirror កំពុងសរសេរ ➜ callback ចាស់មិនអាន/មិនសរសេរ mirror ➜ ការស្តារក្នុង session ថ្មីដាក់ mark វិញ', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('b7', ['MX1B0071', 'MX1B0072'], ['MX1B0071']);
    seedRevenue();
    loadViewsFromServer();
    let open: () => void = () => {};
    lab.mirrorGate = new Promise<void>((resolve) => { open = resolve; });
    const removal = removeSingleBarcode('b7', 'MX1B0071');
    await vi.advanceTimersByTimeAsync(300);
    expect(await removal).toBe('done');
    const entry = cleanupJournal()[0];
    const item = getPath(HISTORY + '/b7');
    item.barcodes.push(Object.assign({}, entry.trashItem.barcodes[0], { isClosed: true, isDeducted: false, closedAt: NOW, restoredAt: NOW }));
    item.count = 2;
    setPath(HISTORY + '/b7', item);
    setPath(TRASH + '/' + entry.trashItem.id, null);
    setPath(MIRROR + '/' + getZoneDateKey(NOW, 0) + '/' + barcodeRegistryKey('MX1B0071'), { c: 4, d: 1 });
    loadViewsFromServer();
    firebaseState.authGeneration++;
    const writes = lab.mirrorWrites;
    const reads: string[] = [];
    const fb: any = firebaseState.fb;
    const get = fb.get;
    fb.get = (ref: any) => { reads.push(ref.path); return get(ref); };
    open();
    lab.mirrorGate = null;
    await vi.advanceTimersByTimeAsync(LOCK_STALL_RELEASE_MS + 1000);
    fb.get = get;
    expect(reads, 'session ចាស់ ៖ callback មិនអាន').toEqual([]);
    expect(lab.mirrorWrites, 'session ចាស់ ៖ តែការលុបដែលកំពុងរត់ចុះ').toBe(writes + 1);
    expect(actualMirror(), 'លក្ខខណ្ឌ ៖ mark ត្រូវលុបដោយការលុបយឺត').toEqual({});
    expect(cleanupJournal().map((e: any) => e.stage), 'entry នៅចាំការស្តារ').toEqual(['collected']);
    expect(lab.captures, 'ហាងដដែល ➜ គ្មាន Sentry').toEqual([]);
    const pass = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(1000);
    await pass;
    expect(actualMirror(), 'ការស្តារក្នុង session ថ្មីដាក់ mark ដែលបាត់វិញ').toEqual(expectedMirror());
    expect(Object.keys(expectedMirror())).toHaveLength(1);
    expect(cleanupJournal()).toEqual([]);
    expect(revenueDay(), 'ប្រាក់ដកម្តង').toEqual([96, 9, 9]);
});

it.each([false, true])('⛔ journal «collected» ៖ ទំព័រស្លាប់ក្រោយការលុប mark ចុះ មុនការដាក់វិញ · barcode ត្រូវ Restore (បិទ · isDeducted ចាស់ %s) ➜ ការស្តារដាក់ mark ដែលបាត់វិញតែ barcode មិនទាន់ដក', async (legacyDeducted) => {
    seedItem('g6', ['MX1G0061', 'MX1G0062'], ['MX1G0061']);
    seedRevenue();
    const item = getPath(HISTORY + '/g6');
    const back = item.barcodes.find((b: any) => b.code === 'MX1G0061');
    back.restoredAt = NOW;
    if (legacyDeducted) back.isDeducted = true;
    setPath(HISTORY + '/g6', item);
    setPath(MIRROR, null);
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify([{ id: 'g6', reason: 'remove', journalAt: NOW - H, stage: 'collected', outcome: '', scope: cleanup.cleanupJournalScope(),
        trashItem: { id: 'id_g6_gone', deletedAt: NOW - H, scanDate: DAY, trashReason: 'remove', isFromDeletion: false, barcode: 'MX1G0061', count: 1, cod: 4, dod: 1, isClosed: true, closedAt: back.closedAt,
            barcodes: [Object.assign({}, back, { isDeducted: true, isFromDeletion: false })] },
        revenue: { scanDate: DAY, cod: 4, dod: 1, count: 1 } }]));
    loadViewsFromServer();
    expect(Object.keys(expectedMirror()), 'លក្ខខណ្ឌមុន ៖ barcode បិទក្នុង history').toHaveLength(legacyDeducted ? 0 : 1);
    expect(actualMirror(), 'លក្ខខណ្ឌមុន ៖ mark បាត់').toEqual({});
    const writes = lab.mirrorWrites;
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(actualMirror()).toEqual(expectedMirror());
    expect(lab.mirrorWrites, 'ដករួច ➜ មិនសរសេរ').toBe(writes + (legacyDeducted ? 0 : 1));
    expect(cleanupJournal()).toEqual([]);
    expect(revenueDay(), 'ប្រាក់មិនប៉ះ').toEqual([100, 10, 10]);
    expect(mirrorToasts(), 'ស្ងាត់').toEqual([]);
});

it.each([
    ['ការអាន mark បរាជ័យ (បណ្តាញ)', 'read', undefined],
    ['ការសរសេរ mark ត្រូវ rules បដិសេធ', 'refused', 1]
])('⛔ journal «collected» ៖ ការដាក់ mark វិញ — %s ➜ entry នៅ · collectedTries = %s (មានតែការបដិសេធទេដែលរាប់) ➜ ជុំក្រោយដាក់ mark វិញ', async (_label, mode, tries) => {
    seedItem('g9', ['MX1G0091', 'MX1G0092'], ['MX1G0091']);
    seedRevenue();
    const item = getPath(HISTORY + '/g9');
    const back = item.barcodes.find((b: any) => b.code === 'MX1G0091');
    back.restoredAt = NOW;
    setPath(HISTORY + '/g9', item);
    setPath(MIRROR, null);
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify([{ id: 'g9', reason: 'remove', journalAt: NOW - H, stage: 'collected', outcome: '', scope: cleanup.cleanupJournalScope(),
        trashItem: { id: 'id_g9_gone', deletedAt: NOW - H, scanDate: DAY, trashReason: 'remove', isFromDeletion: false, barcode: 'MX1G0091', count: 1, cod: 4, dod: 1, isClosed: true, closedAt: back.closedAt,
            barcodes: [Object.assign({}, back, { isDeducted: true, isFromDeletion: false })] },
        revenue: { scanDate: DAY, cod: 4, dod: 1, count: 1 } }]));
    loadViewsFromServer();
    expect(Object.keys(expectedMirror()), 'លក្ខខណ្ឌមុន ៖ barcode បិទក្នុង history').toHaveLength(1);
    const fb: any = firebaseState.fb;
    const get = fb.get;
    let failures = 0;
    if (mode === 'read') fb.get = (ref: any) => (ref.path.indexOf(MIRROR + '/') === 0 && ++failures ? Promise.reject(new Error('network')) : get(ref));
    else lab.fail = (path, kind) => (kind === 'update' && path.indexOf(MIRROR) === 0 && ++failures ? new Error('permission_denied') : null);
    await resumeInterruptedCleanups();
    await sleep(20);
    fb.get = get;
    lab.fail = null;
    expect(failures, 'លក្ខខណ្ឌមុន ៖ ផ្លូវបរាជ័យត្រូវបានដើរ').toBeGreaterThan(0);
    expect(cleanupJournal().map((e: any) => [e.stage, e.collectedTries]), 'entry នៅ').toEqual([['collected', tries]]);
    expect(actualMirror(), 'mark មិនទាន់ដាក់').toEqual({});
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(actualMirror(), 'ជុំក្រោយ ➜ mark ដាក់វិញ').toEqual(expectedMirror());
    expect(cleanupJournal()).toEqual([]);
    expect(revenueDay(), 'ប្រាក់មិនប៉ះ').toEqual([100, 10, 10]);
    expect(lab.captures, 'គ្មាន Sentry').toEqual([]);
});

it('⛔ ការស្តារ ៖ ការលុប mark របស់ entry ចុះយឺតក្រោយឧបករណ៍ផ្សេង Restore barcode (បិទ) ➜ ការស្តារពិនិត្យម្តងទៀត ហើយដាក់ mark វិញ', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('g7', ['MX1G0071', 'MX1G0072'], ['MX1G0071']);
    seedRevenue();
    const item = getPath(HISTORY + '/g7');
    const gone = item.barcodes.find((b: any) => b.code === 'MX1G0071');
    item.barcodes = item.barcodes.filter((b: any) => b.code !== 'MX1G0071');
    item.count = 1;
    item.isClosed = false;
    delete item.closedAt;
    setPath(HISTORY + '/g7', item);
    const trashItem = { id: 'id_g7_tr', deletedAt: NOW - H, scanDate: DAY, trashReason: 'remove', isFromDeletion: false, barcode: 'MX1G0071', count: 1, cod: 4, dod: 1, isClosed: true, closedAt: gone.closedAt,
        barcodes: [Object.assign({}, gone, { isDeducted: true, isFromDeletion: false })] };
    setPath(TRASH + '/' + trashItem.id, trashItem);
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify([{ id: 'g7', reason: 'remove', journalAt: NOW - H, stage: 'collected', outcome: '', scope: cleanup.cleanupJournalScope(),
        trashItem, revenue: { scanDate: DAY, cod: 4, dod: 1, count: 1 } }]));
    loadViewsFromServer();
    let open: () => void = () => {};
    lab.mirrorGate = new Promise<void>((resolve) => { open = resolve; });
    const pass = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(50);
    const restored = getPath(HISTORY + '/g7');
    restored.barcodes.push(Object.assign({}, gone, { closedAt: NOW, restoredAt: NOW, isDeducted: false }));
    restored.count = 2;
    setPath(HISTORY + '/g7', restored);
    setPath(TRASH + '/' + trashItem.id, null);
    setPath(MIRROR + '/' + getZoneDateKey(NOW, 0) + '/' + barcodeRegistryKey('MX1G0071'), { c: 4, d: 1 });
    loadViewsFromServer();
    open();
    lab.mirrorGate = null;
    await vi.advanceTimersByTimeAsync(1000);
    await pass;
    expect(Object.keys(expectedMirror())).toHaveLength(1);
    expect(actualMirror(), 'ការលុបយឺតមិនលុប mark របស់វដ្តថ្មី').toEqual(expectedMirror());
    expect(cleanupJournal()).toEqual([]);
    expect(revenueDay(), 'ប្រាក់មិនប៉ះ').toEqual([100, 10, 10]);
});

it('⛔ ដកផ្ទាល់ ៖ ការលុប mark ចុះយឺត · barcode ត្រឡប់ក្នុង history (Restore) · ការដាក់ mark វិញត្រូវ rules បដិសេធ ➜ entry មិនចេញ ➜ ការស្តារដាក់ mark វិញ', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('b8', ['MX1B0081', 'MX1B0082'], ['MX1B0081']);
    seedRevenue();
    loadViewsFromServer();
    let open: () => void = () => {};
    lab.mirrorGate = new Promise<void>((resolve) => { open = resolve; });
    const removal = removeSingleBarcode('b8', 'MX1B0081');
    await vi.advanceTimersByTimeAsync(300);
    expect(await removal).toBe('done');
    const entry = cleanupJournal()[0];
    expect(entry.stage, 'លក្ខខណ្ឌមុន ៖ mirror មិនទាន់ចុះ').toBe('collected');
    const item = getPath(HISTORY + '/b8');
    item.barcodes.push(Object.assign({}, entry.trashItem.barcodes[0], { isClosed: true, isDeducted: false, closedAt: NOW, restoredAt: NOW }));
    item.count = 2;
    setPath(HISTORY + '/b8', item);
    setPath(TRASH + '/' + entry.trashItem.id, null);
    setPath(MIRROR + '/' + getZoneDateKey(NOW, 0) + '/' + barcodeRegistryKey('MX1B0081'), { c: 4, d: 1 });
    loadViewsFromServer();
    let landed = 0;
    let refused = 0;
    lab.fail = (path, kind) => {
        if (kind !== 'update' || path.indexOf(MIRROR) !== 0) return null;
        if (landed++ === 0) return null;
        refused++;
        return new Error('permission_denied');
    };
    open();
    lab.mirrorGate = null;
    await vi.advanceTimersByTimeAsync(1000);
    lab.fail = null;
    expect(refused, 'លក្ខខណ្ឌមុន ៖ ការដាក់ mark វិញត្រូវបដិសេធ').toBeGreaterThan(0);
    expect(actualMirror(), 'លក្ខខណ្ឌ ៖ ការលុបយឺតលុប mark').toEqual({});
    expect(cleanupJournal().map((e: any) => e.stage), 'mark មិនទាន់ដាក់វិញ ➜ entry នៅ').toEqual(['collected']);
    const pass = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(1000);
    await pass;
    expect(Object.keys(expectedMirror())).toHaveLength(1);
    expect(actualMirror(), 'ការស្តារដាក់ mark វិញ').toEqual(expectedMirror());
    expect(cleanupJournal()).toEqual([]);
    expect(revenueDay(), 'ប្រាក់ដកម្តង').toEqual([96, 9, 9]);
});

it('ទិសផ្ទុយ ៖ journal «collected» · barcode ត្រឡប់ក្នុង history បិទមុនរយៈរក្សា mirror ➜ មិនអាន/មិនសរសេរ mirror · entry បញ្ចប់', async () => {
    const closedAt = NOW - 40 * 24 * H;
    seedItem('g10', ['MX1G0101', 'MX1G0102'], []);
    seedRevenue();
    const item = getPath(HISTORY + '/g10');
    const back = item.barcodes.find((b: any) => b.code === 'MX1G0101');
    Object.assign(back, { isClosed: true, closedAt, restoredAt: NOW });
    setPath(HISTORY + '/g10', item);
    setPath(MIRROR, null);
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify([{ id: 'g10', reason: 'remove', journalAt: NOW - H, stage: 'collected', outcome: '', scope: cleanup.cleanupJournalScope(),
        trashItem: { id: 'id_g10_gone', deletedAt: NOW - H, scanDate: DAY, trashReason: 'remove', isFromDeletion: false, barcode: 'MX1G0101', count: 1, cod: 4, dod: 1, isClosed: true, closedAt,
            barcodes: [Object.assign({}, back, { isDeducted: true, isFromDeletion: false })] },
        revenue: { scanDate: DAY, cod: 4, dod: 1, count: 1 } }]));
    loadViewsFromServer();
    const { collectedRetentionCutoffKey } = await import('../src/domain/collected');
    expect(getZoneDateKey(closedAt, 0) < collectedRetentionCutoffKey(NOW), 'លក្ខខណ្ឌមុន ៖ ថ្ងៃបិទចាស់ជាងរយៈរក្សា').toBe(true);
    const reads: string[] = [];
    const fb: any = firebaseState.fb;
    const get = fb.get;
    fb.get = (ref: any) => { reads.push(ref.path); return get(ref); };
    await resumeInterruptedCleanups();
    await sleep(20);
    fb.get = get;
    expect(reads.filter((p) => p.indexOf(HISTORY + '/g10') === 0).length, 'លក្ខខណ្ឌមុន ៖ holder ត្រូវអាន').toBeGreaterThan(0);
    expect(reads.filter((p) => p.indexOf(MIRROR) === 0), 'មិនអាន mark').toEqual([]);
    expect(lab.mirrorWrites, 'មិនសរសេរ mirror').toBe(0);
    expect(cleanupJournal()).toEqual([]);
});

it('⛔ cleanupHistoryForRecovery ៖ db របស់ប្រតិបត្តិការលែងជា db បច្ចុប្បន្ន ➜ null ដោយមិនអាន', async () => {
    seedItem('hx1', ['MX1H0011'], []);
    const reads: string[] = [];
    const fb: any = firebaseState.fb;
    const get = fb.get;
    fb.get = (ref: any) => { reads.push(ref.path); return get(ref); };
    const opDb = firebaseState.db;
    expect(await cleanup.cleanupHistoryForRecovery('hx1', undefined, opDb), 'លក្ខខណ្ឌមុន ៖ db ដដែល ➜ អាន').not.toBeNull();
    expect(reads, 'លក្ខខណ្ឌមុន ៖ អាន history').toEqual([HISTORY + '/hx1']);
    reads.length = 0;
    firebaseState.db = { other: true } as any;
    expect(await cleanup.cleanupHistoryForRecovery('hx1', undefined, opDb)).toBeNull();
    expect(reads, 'db ចាស់ ➜ មិនអាន').toEqual([]);
    fb.get = get;
});

it('⛔ journal «collected» ៖ view ក្នុងឧបករណ៍ចាស់ឃើញ barcode នៅក្នុង item ដែលលែងមានលើ server ➜ មិនសម្រេច (entry នៅ) ➜ view ស្រស់ ➜ លុប mark', async () => {
    const closedAt = NOW - 2 * H;
    const code = 'MX1G0081';
    const gone = { code, isClosed: true, closedAt, cod: 4, dod: 1, isDeducted: false, isFromDeletion: false, createdAt: NOW - 3 * H, time: '13:30:00' };
    seedItem('g8', ['MX1G0082'], []);
    seedRevenue();
    setPath(MIRROR + '/' + DAY + '/' + barcodeRegistryKey(code), { c: 4, d: 1 });
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify([{ id: 'g8', reason: 'remove', journalAt: NOW - H, stage: 'collected', outcome: '', scope: cleanup.cleanupJournalScope(),
        trashItem: { id: 'id_g8_tr', deletedAt: NOW - H, scanDate: DAY, trashReason: 'remove', isFromDeletion: false, barcode: code, count: 1, cod: 4, dod: 1, isClosed: true, closedAt,
            barcodes: [Object.assign({}, gone, { isDeducted: true })] },
        revenue: { scanDate: DAY, cod: 4, dod: 1, count: 1 } }]));
    loadViewsFromServer();
    dataState.scanHistory.push({ id: 'g8_phantom', phone: PHONE, scanDate: DAY, isClosed: true, closedAt, count: 1, cod: 4, dod: 1, barcode: code, barcodes: [gone] });
    expect(Object.keys(expectedMirror()), 'លក្ខខណ្ឌមុន ៖ barcode លែងមានលើ server').toHaveLength(0);
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(cleanupJournal().map((e: any) => [e.stage, e.collectedTries]), 'holder លែងមាន ➜ មិនសម្រេច ➜ entry នៅ').toEqual([['collected', 1]]);
    expect(Object.keys(actualMirror()), 'មិនទាន់ប៉ះ mark').toHaveLength(1);
    loadViewsFromServer();
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(actualMirror(), 'view ស្រស់ ➜ mark លើសត្រូវលុប').toEqual(expectedMirror());
    expect(cleanupJournal()).toEqual([]);
    expect(revenueDay(), 'ប្រាក់មិនប៉ះ').toEqual([100, 10, 10]);
});

it('MX-1 ពិនិត្យ ៦ · 1 delete · late reply after shop switch ➜ count alarms', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('dz1', ['MX1D0001', 'MX1D0002'], ['MX1D0001']);
    loadViewsFromServer();
    const open = gateReply(HISTORY + '/');
    const run = deleteSingleItem('dz1', { confirmed: true, quiet: true });
    await vi.advanceTimersByTimeAsync(100);
    expect(cleanupJournal().map((e: any) => e.id)).toEqual(['dz1']);
    switchShopB();
    open();
    await vi.advanceTimersByTimeAsync(5000);
    await run;
    const pass = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(5000);
    await pass;
    expect(capturesOf('dz1').length, 'one alarm per interrupted Delete').toBe(1);
});

it('MX-1 ពិនិត្យ ៦ · 2 delete · trash write fails once · shop switch during retry ➜ count alarms', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('dz2', ['MX1D0011', 'MX1D0012'], ['MX1D0011']);
    loadViewsFromServer();
    failTrashOnce();
    const run = deleteSingleItem('dz2', { confirmed: true, quiet: true });
    await vi.advanceTimersByTimeAsync(100);
    switchShopB();
    await vi.advanceTimersByTimeAsync(5000);
    await run;
    lab.fail = null;
    const pass = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(5000);
    await pass;
    expect(capturesOf('dz2').length, 'one alarm per interrupted Delete').toBe(1);
});

it('MX-1 ពិនិត្យ ៦ · 3 drop alarm deferred behind a hanging later entry ➜ entry already gone, no alarm yet (page death loses it)', async () => {
    const closedAt = NOW - 2 * H;
    const mk = (id: string, scope: string, stage: string, extra: any = {}) => Object.assign({ id, reason: 'remove', journalAt: NOW - H, stage, scope,
        trashItem: { id: 'id_' + id, deletedAt: NOW - H, scanDate: DAY, trashReason: 'remove', isFromDeletion: false, barcode: 'MX1H' + id, count: 1, cod: 4, dod: 1, isClosed: true, closedAt,
            barcodes: [{ code: 'MX1H' + id, isClosed: true, closedAt, cod: 4, dod: 1, isDeducted: false, isFromDeletion: false }] },
        revenue: { scanDate: DAY, cod: 4, dod: 1, count: 1 } }, extra);
    const scopeA = cleanup.cleanupJournalScope();
    switchShopB();
    const scopeB = cleanup.cleanupJournalScope();
    expect(scopeA).not.toBe(scopeB);
    setPath(TRASH + '/id_hb', mk('hb', scopeB, 'ledger').trashItem);
    seedRevenue();
    loadViewsFromServer();
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify([mk('ha', scopeA, 'ledger'), mk('hb', scopeB, 'ledger', { ledger: 'keyed', prior: { d: [], m: [] } })]));
    lab.hang = ['zoew_monthly_revenue_cod_dod', 'zoew_daily_revenue_cod_dod'];
    void resumeInterruptedCleanups();
    await sleep(200);
    const haInJournal = cleanupJournal().some((e: any) => e.id === 'ha');
    expect(haInJournal || capturesOf('ha').length > 0, 'a dropped entry is either still journaled (retry) or already reported').toBe(true);
});

it('MX-1 ពិនិត្យ ៦ · 4 legacy isDeducted closed barcode · live Remove mirror delete refused ➜ resume leaves the stale mark', async () => {
    seedItem('lz1', ['MX1Z0201', 'MX1Z0202'], ['MX1Z0201']);
    const item = getPath(HISTORY + '/lz1');
    item.barcodes[0].isDeducted = true;
    setPath(HISTORY + '/lz1', item);
    seedRevenue();
    loadViewsFromServer();
    expect(Object.keys(actualMirror()), 'precondition: mark exists for the closed barcode').toHaveLength(1);
    refuseMirror();
    await removeSingleBarcode('lz1', 'MX1Z0201');
    await sleep(20);
    lab.fail = null;
    loadViewsFromServer();
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(actualMirror(), 'resume completes what the live path intended (drop the mark)').toEqual(expectedMirror());
    expect(revenueDay()).toEqual([100, 10, 10]);
});

it('MX-1 ពិនិត្យ ៦ · 4b legacy isDeducted closed barcode · page dies at slot ➜ resume leaves the stale mark', async () => {
    seedItem('lz2', ['MX1Z0211', 'MX1Z0212'], ['MX1Z0211']);
    const item = getPath(HISTORY + '/lz2');
    item.barcodes[0].isDeducted = true;
    setPath(HISTORY + '/lz2', item);
    seedRevenue();
    loadViewsFromServer();
    lab.hang = [TRASH];
    void removeSingleBarcode('lz2', 'MX1Z0211');
    await sleep(40);
    crashAndReload();
    await resumeDoors();
    expect(actualMirror()).toEqual(expectedMirror());
    expect(revenueDay()).toEqual([100, 10, 10]);
});

const rerunAfterGate = (prefix: string) => {
    let open: () => void = () => {};
    const gate = new Promise<void>((resolve) => { open = resolve; });
    const fb: any = firebaseState.fb;
    const orig = fb.runTransaction;
    fb.runTransaction = (ref: any, fn: any, o?: any) => {
        if (ref.path.indexOf(prefix) !== 0) return orig(ref, fn, o);
        return (async () => {
            await sleep(1);
            const cached = getPath(ref.path);
            fn(JSON.parse(JSON.stringify(cached)));
            await gate;
            const server = getPath(ref.path);
            const next = fn(server);
            if (next === undefined) return { committed: false, snapshot: { val: () => server } };
            setPath(ref.path, next);
            const v = getPath(ref.path);
            return { committed: true, snapshot: { val: () => v } };
        })();
    };
    return () => open();
};

it.each(['remove', 'delete', 'abandon'])('MX-1 ពិនិត្យ ៦ · 5 %s · SDK reruns the updater after the shop switch (abort) ➜ count alarms', async (kind) => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    const id = 'rz_' + kind;
    if (kind === 'abandon') seedAbandoned(id, 'MX1R9' + kind.length); else seedItem(id, ['MX1R8' + kind.length, 'MX1R7' + kind.length], ['MX1R8' + kind.length]);
    seedRevenue();
    loadViewsFromServer();
    const open = rerunAfterGate(HISTORY + '/');
    const run = kind === 'remove' ? removeSingleBarcode(id, 'MX1R8' + kind.length) : kind === 'delete' ? deleteSingleItem(id, { confirmed: true, quiet: true }) : cleanup.claimAndCleanupItem(id, 'abandon');
    await vi.advanceTimersByTimeAsync(100);
    switchShopB();
    open();
    await vi.advanceTimersByTimeAsync(5000);
    await run;
    const pass = resumeInterruptedCleanups();
    await vi.advanceTimersByTimeAsync(5000);
    await pass;
    expect(capturesOf(id).length + lab.captures.filter((c) => !c.extra.itemId && !c.extra.itemIds).length, 'one alarm per interrupted operation').toBe(1);
});

it('MX-1 ពិនិត្យ ៦ · 6 drop keeps a mark only an unfinished restore inserted ➜ restore cancelled ➜ stale mark', async () => {
    const code = 'MX1K0061';
    seedItem('k6', [code, 'MX1K0062'], [code]);
    seedRevenue();
    const hist = getPath(HISTORY + '/k6');
    const removed = hist.barcodes.find((b: any) => b.code === code);
    const trashId = 'id_k6_rm';
    const trashItem = { id: trashId, phone: PHONE, deletedAt: NOW - H, scanDate: DAY, trashReason: 'remove', isFromDeletion: false, barcode: code, count: 1, cod: 4, dod: 1, isClosed: true, closedAt: removed.closedAt,
        barcodes: [Object.assign({}, removed, { isDeducted: true, isFromDeletion: false })], restoreClaim: { token: 'tok6', targetId: 'k6', at: NOW } };
    setPath(TRASH + '/' + trashId, trashItem);
    hist.restoreClaimId = trashId;
    hist.restoreClaimToken = 'tok6';
    hist.restoreAddedCodes = JSON.stringify([code]);
    removed.closedAt = NOW;
    removed.restoredAt = NOW;
    setPath(HISTORY + '/k6', hist);
    const stripped = Object.assign({}, trashItem);
    delete (stripped as any).restoreClaim;
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify([{ id: 'k6', reason: 'remove', journalAt: NOW - H, stage: 'collected', outcome: '', scope: cleanup.cleanupJournalScope(),
        trashItem: stripped, revenue: { scanDate: DAY, cod: 4, dod: 1, count: 1 } }]));
    loadViewsFromServer();
    await resumeInterruptedCleanups();
    await sleep(20);
    const h2 = getPath(HISTORY + '/k6');
    h2.barcodes = h2.barcodes.filter((b: any) => b.code !== code);
    h2.count = h2.barcodes.length;
    delete h2.restoreClaimId; delete h2.restoreClaimToken; delete h2.restoreAddedCodes;
    setPath(HISTORY + '/k6', h2);
    const t2 = getPath(TRASH + '/' + trashId);
    delete t2.restoreClaim; t2.restoreBlocked = true;
    setPath(TRASH + '/' + trashId, t2);
    expect(actualMirror(), 'after the restore is cancelled the removed (deducted) barcode carries no mark').toEqual(expectedMirror());
});

it('MX-1 ពិនិត្យ ៦ · 7 microtask scan: shop switch right after the last session check ➜ does a mirror write reach the new shop?', async () => {
    const hits: number[] = [];
    const okWrites: number[] = [];
    for (let k = 0; k < 80; k++) {
        lab.store = {};
        appLocalStore.clear();
        appLocalStore.setItem('zoew_firebase_config', SHOP_CONFIG);
        firebaseState.authGeneration++;
        firebaseState.db = { mx1: true } as any;
        firebaseState.fb = makeFb() as any;
        dataState.cleanupResumeInFlight = false;
        cleanup.cleanupJournalLive.clear();
        const code = 'MX1M' + String(k).padStart(4, '0');
        seedItem('m7', ['MX1M9999'], []);
        setPath(MIRROR + '/' + DAY + '/' + barcodeRegistryKey(code), { c: 4, d: 1 });
        const closedAt = NOW - 2 * H;
        appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify([{ id: 'm7', reason: 'remove', journalAt: NOW - H, stage: 'collected', outcome: '', scope: cleanup.cleanupJournalScope(),
            trashItem: { id: 'id_m7', deletedAt: NOW - H, scanDate: DAY, trashReason: 'remove', isFromDeletion: false, barcode: code, count: 1, cod: 4, dod: 1, isClosed: true, closedAt,
                barcodes: [{ code, isClosed: true, closedAt, cod: 4, dod: 1, isDeducted: true, isFromDeletion: false }] },
            revenue: { scanDate: DAY, cod: 4, dod: 1, count: 1 } }]));
        setPath(TRASH + '/id_m7', JSON.parse(appLocalStore.getItem('zoew_cleanup_journal_v1') as string)[0].trashItem);
        loadViewsFromServer();
        const fb: any = firebaseState.fb;
        const get = fb.get;
        const update = fb.update;
        let crossShop = false;
        const sameShopBefore = lab.mirrorWrites;
        fb.update = (ref: any, payload: any) => { if (ref.path.indexOf(MIRROR) === 0 && (firebaseState.db as any).shopB) crossShop = true; return update(ref, payload); };
        fb.get = (ref: any) => {
            const p = get(ref);
            if (ref.path === 'zoew_restore_finalizations/id_m7') {
                return p.then((v: any) => {
                    let n = k;
                    const tick = () => { if (n-- <= 0) { appLocalStore.setItem('zoew_firebase_config', SHOP_B); firebaseState.authGeneration++; firebaseState.db = { shopB: true } as any; } else queueMicrotask(tick); };
                    queueMicrotask(tick);
                    return v;
                });
            }
            return p;
        };
        await resumeInterruptedCleanups();
        await sleep(5);
        if (crossShop) hits.push(k);
        if (lab.mirrorWrites > sameShopBefore && !crossShop) okWrites.push(k);
    }
    expect(hits, 'no mirror write of shop A reaches shop B at any microtask offset').toEqual([]);
    expect(okWrites.length, 'control ៖ offsets that stay in shop A still write the mirror').toBeGreaterThan(0);
});

const pickupDay = () => getPath(PICKUP + '/' + DAY);
const pickupCollectedDrops = () => lab.captures.filter((c) => c.extra && c.extra.context === 'resumePickupIntents collected');

it.each(['barcode', 'whole'])('⛔ MX1-PJ-1 បិទ (%s) ៖ ស្ថិតិយកចុះ · mirror ព្យួរ ➜ ទំព័រស្លាប់ ➜ ឧបករណ៍ផ្សេង «Reset ចំនួនយករួច» ➜ ការស្តារមិនដាក់ស្ថិតិវិញ · mirror នៅជួសជុល', async (kind) => {
    seedItem('pj1', ['MX1J0001', 'MX1J0002'], []);
    loadViewsFromServer();
    lab.hang = [MIRROR];
    void (kind === 'whole' ? toggleCloseStatus('pj1') : applyBarcodeCloseChange('pj1', 'MX1J0001', true, { silent: true, showModal: false }));
    await sleep(40);
    expect(pickupDay().packagesPickedUp, 'លក្ខខណ្ឌមុន ៖ ស្ថិតិយក commit រួច').toBe(kind === 'whole' ? 2 : 1);
    expect(actualMirror(), 'លក្ខខណ្ឌមុន ៖ mirror មិនទាន់សរសេរ').toEqual({});
    expect(pickupJournal(), 'លក្ខខណ្ឌមុន ៖ journal នៅ (mirror មិនទាន់ឆ្លើយ true)').toHaveLength(1);
    crashAndReload();
    setPath(PICKUP + '/' + DAY, { packagesPickedUp: 0 });
    loadViewsFromServer();
    await resumeDoors();
    expect(pickupDay(), 'Reset ពីឧបករណ៍ផ្សេងនៅជាប់ (ស្ថិតិយកចុះរួចមុន ➜ មិនដាក់ពីការស្តារវិញ)').toEqual({ packagesPickedUp: 0 });
    expect(Object.keys(expectedMirror())).toHaveLength(kind === 'whole' ? 2 : 1);
    expect(actualMirror(), 'mirror នៅត្រូវជួសជុល').toEqual(expectedMirror());
    expect(pickupJournal(), 'mirror ចុះ ➜ journal ទទេ').toEqual([]);
});

it('⛔ MX1-PJ-1 បិទ ៖ ស្ថិតិយកចុះ · mirror ព្យួរហួសពិដាន dbOp («pending») ➜ ឧបករណ៍ផ្សេង Reset ➜ ការស្តារក្នុង session ដដែលមិនដាក់ស្ថិតិវិញ · mirror ជួសជុល', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(NOW));
    seedItem('pj2', ['MX1J0011', 'MX1J0012'], []);
    loadViewsFromServer();
    lab.hang = [MIRROR];
    const run = applyBarcodeCloseChange('pj2', 'MX1J0011', true, { silent: true, showModal: false });
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 2000);
    expect(await run, 'លក្ខខណ្ឌមុន ៖ ការបិទចុះ').toBe(true);
    expect(toastMsgs().some((m) => /Sync ដោយស្វ័យប្រវត្តិ/.test(m)), 'លក្ខខណ្ឌមុន ៖ mirror ឆ្លើយ «pending»').toBe(true);
    expect(pickupDay().packagesPickedUp, 'លក្ខខណ្ឌមុន ៖ ស្ថិតិយក commit រួច').toBe(1);
    expect(pickupJournal(), 'លក្ខខណ្ឌមុន ៖ journal នៅ').toHaveLength(1);
    expect(pickup.pickupIntentsLive.size, 'លក្ខខណ្ឌមុន ៖ ប្រតិបត្តិការផ្ទាល់លែង entry').toBe(0);
    setPath(PICKUP + '/' + DAY, { packagesPickedUp: 0 });
    loadViewsFromServer();
    lab.hang = [];
    const pass = pickup.resumePickupIntents();
    await vi.advanceTimersByTimeAsync(500);
    await pass;
    expect(pickupDay(), 'Reset នៅជាប់').toEqual({ packagesPickedUp: 0 });
    expect(Object.keys(expectedMirror())).toHaveLength(1);
    expect(actualMirror(), 'mirror ជួសជុល').toEqual(expectedMirror());
    expect(pickupJournal()).toEqual([]);
});

it('⛔ MX1-PJ-1 mirror បដិសេធជាប់រហូត ៖ entry ស្ថិតិយកចុះរួចមិនសរសេរស្ថិតិឡើងវិញ · ការអានបរាជ័យមិនរាប់ · ចេញក្រោយ CLEANUP_LEDGER_RETRY_MAX ជុំបដិសេធ + Sentry data ម្តង', async () => {
    seedItem('pj3', ['MX1J0021'], []);
    loadViewsFromServer();
    refuseMirror();
    expect(await applyBarcodeCloseChange('pj3', 'MX1J0021', true, { silent: true, showModal: false }), 'លក្ខខណ្ឌមុន ៖ ការបិទចុះ').toBe(true);
    await sleep(20);
    expect(pickupDay().packagesPickedUp, 'លក្ខខណ្ឌមុន ៖ ស្ថិតិយក commit រួច').toBe(1);
    expect(pickupJournal(), 'លក្ខខណ្ឌមុន ៖ mirror បដិសេធ ➜ journal នៅ').toHaveLength(1);
    setPath(PICKUP + '/' + DAY, { packagesPickedUp: 0 });
    loadViewsFromServer();
    const fb: any = firebaseState.fb;
    const realGet = fb.get;
    fb.get = (ref: any) => (ref.path === HISTORY + '/pj3' ? Promise.reject(new Error('network')) : realGet(ref));
    for (let round = 0; round < 3; round++) await resumeDoors();
    expect(pickupDay(), 'Reset នៅជាប់').toEqual({ packagesPickedUp: 0 });
    expect(pickupJournal().map((e: any) => e.collectedTries || 0), 'ការអានបរាជ័យ ➜ មិនរាប់').toEqual([0]);
    fb.get = realGet;
    for (let round = 1; round < cleanup.CLEANUP_LEDGER_RETRY_MAX; round++) {
        await resumeDoors();
        expect(pickupJournal().map((e: any) => e.collectedTries), 'បដិសេធ ➜ រាប់ម្តងក្នុងមួយជុំ').toEqual([round]);
        expect(pickupDay(), 'Reset នៅជាប់គ្រប់ជុំ').toEqual({ packagesPickedUp: 0 });
    }
    expect(pickupCollectedDrops(), 'មុនពិដាន ៖ គ្មាន Sentry').toEqual([]);
    await resumeDoors();
    expect(pickupJournal(), 'ពិដាន ➜ entry ចេញ').toEqual([]);
    expect(pickupCollectedDrops().map((c) => [c.extra.zone, c.extra.itemId]), 'Sentry data ម្តង').toEqual([['data', 'pj3']]);
    await resumeDoors();
    expect(pickupCollectedDrops(), 'មិនរាយការណ៍ម្តងទៀត').toHaveLength(1);
    expect(pickupDay(), 'ស្ថិតិមិនប៉ះ').toEqual({ packagesPickedUp: 0 });
    lab.fail = null;
});

it('⛔ MX1-PJ-1 journal ស្ថិតិយកពេញ PICKUP_JOURNAL_MAX ៖ entry ដែលប្រតិបត្តិការផ្ទាល់កាន់ មិនត្រូវកាត់ចេញ (ទាំងពេលម៉ោងថយក្រោយ) · កាត់ entry ចាស់ដែលគ្មានម្ចាស់ជំនួស', async () => {
    const liveId = pickup.beginPickupIntent(DAY, ['MX1JLIVE'], 'pjlive');
    expect(pickup.pickupIntentsLive.has(liveId as string), 'លក្ខខណ្ឌមុន ៖ entry ផ្ទាល់').toBe(true);
    const filler = Array.from({ length: pickup.PICKUP_JOURNAL_MAX - 1 }, (_v, i) => ({ id: 'pkfill' + i, scope: 'x', date: DAY, keys: ['MX1JF' + i], at: NOW }));
    appLocalStore.setItem('zoew_pickup_journal_v1', JSON.stringify([...pickupJournal(), ...filler]));
    expect(pickupJournal(), 'លក្ខខណ្ឌមុន ៖ journal ពេញ').toHaveLength(pickup.PICKUP_JOURNAL_MAX);
    const nextId = pickup.beginPickupIntent(DAY, ['MX1JNEXT'], 'pjnext');
    let ids = pickupJournal().map((e: any) => e.id);
    expect(ids, 'នៅតែមានទំហំ').toHaveLength(pickup.PICKUP_JOURNAL_MAX);
    expect(ids.includes(liveId), 'entry ផ្ទាល់មិនត្រូវកាត់').toBe(true);
    expect(ids.includes('pkfill0'), 'entry ចាស់បំផុតដែលគ្មានម្ចាស់ត្រូវកាត់ជំនួស').toBe(false);
    expect(ids[ids.length - 1]).toBe(nextId);
    vi.setSystemTime(new Date(NOW - H));
    pickup.beginPickupIntent(DAY, ['MX1JBACK'], 'pjback');
    ids = pickupJournal().map((e: any) => e.id);
    expect(ids.includes(liveId), 'ម៉ោងថយក្រោយ ➜ entry ផ្ទាល់នៅ').toBe(true);
    expect(ids.includes(nextId), 'ម៉ោងថយក្រោយ ➜ entry ផ្ទាល់ទីពីរនៅ').toBe(true);
    pickup.endPickupIntent(liveId, Promise.resolve(true));
    await sleep(5);
    expect(pickupJournal().map((e: any) => e.id).includes(liveId), 'ម្ចាស់បញ្ចប់ ➜ entry ចេញ').toBe(false);
});

it('⛔ GG-3 journal លាយ ៖ entry ប្រាក់ហាងផ្សេង ៧ ឆ្លាស់ជាមួយ entry «collected» ហាងនេះ ➜ Sentry money «scope mismatch» តែមួយ (itemCount ពេញ) ឆ្លងតម្រង repeat ពិត', async () => {
    const entryOf = (id: string, revenue: boolean, extra?: any) => {
        const closedAt = NOW - 2 * H;
        return Object.assign({ id, reason: revenue ? 'remove' : 'close', journalAt: NOW - H, stage: 'moved', scope: cleanup.cleanupJournalScope(),
            trashItem: { id: 'id_' + id, deletedAt: NOW - H, scanDate: DAY, trashReason: revenue ? 'remove' : 'pickup', isFromDeletion: !revenue, barcode: 'MX1Q' + id, count: 1, cod: 4, dod: 1, isClosed: true, closedAt,
                barcodes: [{ code: 'MX1Q' + id, isClosed: true, closedAt, cod: 4, dod: 1, isDeducted: false, isFromDeletion: !revenue }] },
            revenue: revenue ? { scanDate: DAY, cod: 4, dod: 1, count: 1 } : null }, extra || {});
    };
    const moneyIds = Array.from({ length: 7 }, (_v, i) => 'gm' + i);
    const otherShop = moneyIds.map((id) => entryOf(id, true));
    switchShopB();
    const ownScope = cleanup.cleanupJournalScope();
    expect(ownScope !== otherShop[0].scope, 'លក្ខខណ្ឌមុន ៖ scope ពីរខុសគ្នា').toBe(true);
    const list: any[] = [];
    otherShop.forEach((e, i) => { list.push(e); list.push(entryOf('go' + i, false, { stage: 'collected', scope: ownScope })); });
    appLocalStore.setItem('zoew_cleanup_journal_v1', JSON.stringify(list));
    await resumeInterruptedCleanups();
    await sleep(20);
    expect(cleanupJournal(), 'entry ទាំងអស់ចេញ').toEqual([]);
    const admit = realAdmitRepeat();
    const money = lab.captures.filter((c) => c.extra && c.extra.zone === 'money' && c.extra.context === 'resumeCleanupJournalEntry scope mismatch' && admit(new Error(c.message), c.extra));
    expect(money.map((c) => [c.extra.itemId, c.extra.itemCount]), 'ព្រឹត្តិការណ៍មួយក្នុងមួយជុំ · ចំនួនពេញ').toEqual([['gm0', moneyIds.length]]);
});
