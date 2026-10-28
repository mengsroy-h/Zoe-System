/**
 * Deep audit 9 · M3 ៖ the close of a row commits on the server, then re-writes the «យករួច» keys of the barcodes the server row holds closed
 * (`reapplyPickupMarks(…, true)`). When another device Removes one of them between that commit and the re-write (its Remove deletes
 * the key), the re-write put the key back ➜ «យករួច» counted a parcel that sits deducted in «ដក» trash (customers +1 when it was the
 * phone's only closed barcode), and the pickup journal (marked done) never healed it. After the re-write commits, the row is read again:
 * a written key whose barcode left the row or is open there is set from fresh server truth (only deleted, never re-added ➜ a Reset stays).
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getZoneDateKey } from '../src/core/timezone';
import { barcodeRegistryKey } from '../src/domain/registry';
import * as cleanup from '../src/domain/cleanup';
import * as pickup from '../src/domain/pickup';
import { healPickupKeysLeftRow } from '../src/domain/collected';
import { toggleIndividualBarcodeClose } from '../src/features/barcode-ops';
import { toggleCloseStatus } from '../src/features/entry-ops';
import { activeRestoreClaims, restoreInFlight } from '../src/features/restore';

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

const lab = { store: {} as Record<string, any>, hang: [] as string[], txGate: null as null | ((path: string) => Promise<void> | null),
    getGate: null as null | ((path: string) => Promise<void> | null), getFail: false, getHang: false };

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
        get: async (ref: any) => {
            const gate = lab.getGate ? lab.getGate(ref.path) : null;
            if (gate) await gate;
            if (lab.getHang) return new Promise(() => {});
            if (lab.getFail) throw new Error('read failed');
            await sleep(1);
            return snap(ref, getAt(ref.path));
        },
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
const pickupKeys = () => Object.keys((getAt(PICKUP + '/' + DAY) || {}).pickedUpBarcodes || {}).sort();
const pickupCount = () => (getAt(PICKUP + '/' + DAY) || {}).packagesPickedUp;
const serverBarcode = (id: string, code: string) => ((getAt(HISTORY + '/' + id) || {}).barcodes || []).find((b: any) => b.code === code) || null;
const trashItems = () => Object.entries(getAt(TRASH) || {}).map(([id, item]: [string, any]) => ({ ...item, id }));

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    lab.store = {};
    lab.hang = [];
    lab.txGate = null;
    lab.getGate = null;
    lab.getFail = false;
    lab.getHang = false;
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


async function removeOnOtherDevice(id: string, code: string) {
    const row = getAt(HISTORY + '/' + id);
    const moved = row.barcodes.find((b: any) => b.code === code);
    row.barcodes = row.barcodes.filter((b: any) => b.code !== code);
    row.count = row.barcodes.length;
    setAt(HISTORY + '/' + id, row);
    setAt(TRASH + '/rm_' + id, { id: 'rm_' + id, phone: row.phone, scanDate: row.scanDate, trashReason: 'remove', isFromDeletion: false,
        deletedAt: NOW, barcodes: [{ ...moved, isDeducted: true }] });
    const day = getAt(PICKUP + '/' + DAY) || {};
    const set = { ...(day.pickedUpBarcodes || {}) };
    delete set[key(code)];
    const count = Object.keys(set).length;
    setAt(PICKUP + '/' + DAY, { packagesPickedUp: count, pickedUpPhones: count ? { [PHONE]: count } : {}, pickedUpBarcodes: set });
}

function holdPickupWrite(nth: number, during: () => Promise<void>) {
    let seen = 0;
    lab.txGate = (path: string) => {
        if (path !== PICKUP + '/' + DAY) return null;
        seen++;
        return seen === nth ? during() : null;
    };
}

it('M3 ៖ whole-row close · another device Removes one closed barcode before the re-write ➜ its key does not come back', async () => {
    seedItem('c1', ['ZZP0001', 'ZZP0002'], []);
    loadViewsFromServer();
    holdPickupWrite(2, () => removeOnOtherDevice('c1', 'ZZP0001'));
    await toggleCloseStatus('c1');
    await sleep(40);
    expect(serverBarcode('c1', 'ZZP0002')?.isClosed, 'លក្ខខណ្ឌមុន ៖ ការបិទ commit').toBe(true);
    expect(trashItems().map((t) => t.trashReason), 'លក្ខខណ្ឌមុន ៖ ឧបករណ៍ផ្សេងដក ZZP0001').toEqual(['remove']);
    expect(pickupKeys()).toEqual([key('ZZP0002')]);
    expect(pickupCount()).toBe(1);
    expect((getAt(PICKUP + '/' + DAY) || {}).pickedUpPhones).toEqual({ [PHONE]: 1 });
});

it('M3 ៖ single-barcode close · another device Removes it before the re-write ➜ no key', async () => {
    seedItem('c2', ['ZZQ0001', 'ZZQ0002'], []);
    loadViewsFromServer();
    holdPickupWrite(2, () => removeOnOtherDevice('c2', 'ZZQ0001'));
    await toggleIndividualBarcodeClose('c2', 'ZZQ0001');
    await sleep(40);
    expect(trashItems().map((t) => t.trashReason), 'លក្ខខណ្ឌមុន').toEqual(['remove']);
    expect(pickupKeys()).toEqual([]);
    expect(pickupCount()).toBe(0);
});

it('control ៖ no foreign Remove ➜ the close keeps both keys', async () => {
    seedItem('c3', ['ZZR0001', 'ZZR0002'], []);
    loadViewsFromServer();
    await toggleCloseStatus('c3');
    await sleep(40);
    expect(pickupKeys()).toEqual([key('ZZR0001'), key('ZZR0002')].sort());
    expect(pickupCount()).toBe(2);
});

// Re-audit ៖ the heal of the close's re-write must neither hold back the `pickupDone` flag (a Reset made later came back on resume)
// nor delete a key that a newer close wrote while the heal was reading (one device · close ➜ reopen ➜ close · or another device).
async function resumeAfterReset(id: string) {
    setAt(PICKUP + '/' + DAY, { packagesPickedUp: 0 });
    lab.getFail = false;
    lab.getHang = false;
    pickup.pickupIntentsLive.clear();
    cleanup.cleanupJournalLive.clear();
    loadViewsFromServer();
    await pickup.resumePickupIntents();
    await sleep(30);
    expect(serverBarcode(id, (getAt(HISTORY + '/' + id) || {}).barcodes[0].code)?.isClosed, 'លក្ខខណ្ឌមុន ៖ Barcode នៅបិទក្នុងជួរ').toBe(true);
}

it('M1 ៖ the re-write committed but the heal cannot read ➜ the intent is marked done · a later Reset stays after the resume', async () => {
    seedItem('h1', ['ZZK0001', 'ZZK0002'], []);
    loadViewsFromServer();
    holdPickupWrite(2, async () => { lab.getFail = true; });
    await toggleIndividualBarcodeClose('h1', 'ZZK0001');
    await sleep(40);
    expect(pickup.readPickupJournal().map((e) => e.pickupDone === true), 'ការសរសេរ «យករួច» commit ➜ ត្រា pickupDone').toEqual([true]);
    await resumeAfterReset('h1');
    expect(pickupKeys()).toEqual([]);
    expect(pickupCount()).toBe(0);
});

it('M1 ៖ the App dies while the heal reads ➜ the next page never re-adds a key a Reset cleared', async () => {
    seedItem('h2', ['ZZK0101'], []);
    loadViewsFromServer();
    holdPickupWrite(2, async () => { lab.getHang = true; });
    void toggleIndividualBarcodeClose('h2', 'ZZK0101');
    await sleep(40);
    expect(pickup.readPickupJournal().map((e) => e.pickupDone === true)).toEqual([true]);
    await resumeAfterReset('h2');
    expect(pickupKeys()).toEqual([]);
});

it('M1 ៖ the resume still finishes the heal ៖ a key whose barcode another device Removed is deleted (delete only)', async () => {
    seedItem('h5', ['ZZK0201', 'ZZK0202'], []);
    loadViewsFromServer();
    holdPickupWrite(2, async () => { await removeOnOtherDevice('h5', 'ZZK0201'); lab.getFail = true; });
    await toggleCloseStatus('h5');
    await sleep(40);
    expect(pickupKeys(), 'លក្ខខណ្ឌមុន ៖ heal អានមិនបាន ➜ key នៅសល់').toEqual([key('ZZK0201'), key('ZZK0202')].sort());
    lab.getFail = false;
    pickup.pickupIntentsLive.clear();
    cleanup.cleanupJournalLive.clear();
    loadViewsFromServer();
    await pickup.resumePickupIntents();
    await sleep(30);
    expect(pickupKeys()).toEqual([key('ZZK0202')]);
});

it('M2 ៖ a newer close on this device adds the key while the heal deletes ➜ the key stays', async () => {
    seedItem('h3', ['ZZT0001'], []);
    loadViewsFromServer();
    const K = key('ZZT0001');
    setAt(PICKUP + '/' + DAY, { packagesPickedUp: 1, pickedUpPhones: { [PHONE]: 1 }, pickedUpBarcodes: { [K]: PHONE } });
    let seen = 0;
    lab.txGate = (path: string) => {
        if (path !== PICKUP + '/' + DAY || seen++) return null;
        return (async () => {
            const row = getAt(HISTORY + '/h3');
            row.barcodes[0].isClosed = true;
            row.barcodes[0].closedAt = NOW;
            row.isClosed = true;
            setAt(HISTORY + '/h3', row);
            const newer = pickup.markPickupBarcodes(DAY, [{ key: K, phoneKey: PHONE, closed: true }]);
            await newer!.commit;
        })();
    };
    const healed = healPickupKeysLeftRow('h3', { scanDate: DAY, marks: [{ key: K, phoneKey: PHONE, closed: true }], previous: [], changed: true,
        commit: Promise.resolve(true) });
    expect(await healed.commit).toBe(true);
    expect(seen, 'លក្ខខណ្ឌមុន ៖ heal បានព្យាយាមលុប').toBeGreaterThanOrEqual(2);
    expect(pickupKeys()).toEqual([K]);
});

it('M2 ៖ another device closes the barcode again while the heal reads the shop ➜ the heal re-reads its row and keeps the key', async () => {
    seedItem('h4', ['ZZT0101'], []);
    loadViewsFromServer();
    const K = key('ZZT0101');
    setAt(PICKUP + '/' + DAY, { packagesPickedUp: 1, pickedUpPhones: { [PHONE]: 1 }, pickedUpBarcodes: { [K]: PHONE } });
    let fired = false;
    lab.getGate = (path: string) => {
        if (path !== TRASH || fired) return null;
        fired = true;
        return (async () => {
            await sleep(8);
            const row = getAt(HISTORY + '/h4');
            row.barcodes[0].isClosed = true;
            row.barcodes[0].closedAt = NOW;
            row.isClosed = true;
            setAt(HISTORY + '/h4', row);
        })();
    };
    const healed = healPickupKeysLeftRow('h4', { scanDate: DAY, marks: [{ key: K, phoneKey: PHONE, closed: true }], previous: [], changed: true,
        commit: Promise.resolve(true) });
    expect(await healed.commit).toBe(true);
    expect(fired, 'លក្ខខណ្ឌមុន ៖ ឧបករណ៍ផ្សេងបិទម្តងទៀតពេល heal អាន').toBe(true);
    expect(pickupKeys()).toEqual([K]);
});
