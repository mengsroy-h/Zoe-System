import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupServerRead } from './helpers/cleanup-server-read';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { collectedDayOfStamp } from '../src/domain/collected';
import { getServerNow } from '../src/core/clock';
import { appLocalStore } from '../src/core/storage';
import { DB_LISTENER_KEY_DELETED, dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { cleanupInFlight, claimAndCleanupItem, resumeInterruptedCleanups, runAutomaticCleanupRules } from '../src/domain/cleanup';
import { deleteSingleItem } from '../src/features/entry-ops';
import { getShopZtoTrashMode, refreshZtoTrashModeMark, storeLookupApiConfig } from '../src/features/lookup-config';
import { RESTORE_CLAIM_FUTURE_MS, RESTORE_CLAIM_LEASE_MS, executeRestoreItem, RESTORE_SHOP_MODE_UNSYNCED_TEXT, RESTORE_ZTO_NEEDS_LOOKUP_TEXT, activeRestoreClaims, restoreInFlight } from '../src/features/restore';
import { trashRestoreBlockOf } from '../src/features/zto-final-marks';
import { ztoPickupStatus } from '../src/features/zto-status';
import {
    ZTO_TRASH_MODE_ACTIVE_MS, ZTO_TRASH_MODE_MARK_GAP_MS, ZTO_TRASH_MODE_PATH, ZTO_TRASH_MODE_RETRY_MS, attachZtoTrashModeListener, effectiveZtoTrashMode, markZtoTrashMode,
    noteZtoTrashMode, noteZtoTrashModeError, resetZtoTrashMode, shopZtoTrashMode, ztoTrashModeDeviceKey
} from '../src/services/zto-trash-mode';

const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-10-20', HOUR = 60 * 60 * 1000;
const db = { name: 'shop-trash-mode' };
let store: Record<string, any>, writes: string[], listeners: Array<{ path: string; cb: (s: any) => void }>;
const clone = <V>(value: V): V => value === undefined ? value : JSON.parse(JSON.stringify(value));
const at = (path: string) => clone(path.split('/').filter(Boolean).reduce((v: any, k) => v?.[k], store) ?? null);
function put(path: string, value: any) {
    const keys = path.split('/').filter(Boolean); let node = store;
    for (const key of keys.slice(0, -1)) node = node[key] ||= {};
    if (value == null) delete node[keys.at(-1)!]; else node[keys.at(-1)!] = clone(value);
}
const snap = (value: any) => ({ val: () => clone(value), exists: () => value != null });
const ref = (_db: any, path = '') => ({ db: _db, path, key: path.split('/').at(-1), toString: () => `https://shop.firebaseio.com/${path}` });
function fb() {
    return {
        ref, increment: (n: number) => ({ inc: n }),
        get: async (r: any) => snap(at(r.path)),
        runTransaction: async (r: any, update: any) => {
            const next = update(at(r.path));
            if (next === undefined) return { committed: false, snapshot: snap(at(r.path)) };
            put(r.path, next); writes.push('tx:' + r.path);
            return { committed: true, snapshot: snap(at(r.path)) };
        },
        update: async (r: any, patch: any) => {
            for (const [key, value] of Object.entries(patch)) {
                const path = [r.path, key].filter(Boolean).join('/');
                put(path, value && typeof value === 'object' && 'inc' in (value as any) ? Number(at(path) || 0) + Number((value as any).inc) : value);
                writes.push('update:' + path);
            }
        },
        set: async (r: any, value: any) => { put(r.path, value); writes.push('set:' + r.path); },
        onValue: (r: any, cb: any) => { listeners.push({ path: r.path, cb }); return () => {}; },
        off: () => {}
    };
}
function closedItem(id: string, code: string, extra: any = {}) {
    const closedAt = getServerNow() - 3 * HOUR;
    return { id, phone: '012000111', scanDate: DAY, time: `08:00:00 (${DAY})`, createdAt: closedAt - HOUR, count: 1, cod: 5, dod: 1, price: 6,
        isClosed: true, closedAt, isCalled: false, barcode: code,
        barcodes: [{ code, cod: 5, dod: 1, locker: 'A1', createdAt: closedAt - HOUR, isClosed: true, closedAt, isFromDeletion: false, isDeducted: false, ...extra }] };
}
function install() {
    store = { [H]: {}, [T]: {}, [D]: { [DAY]: { codDollar: 6, dodDollar: 0, totalCount: 1 } }, [M]: { '2026-10': { codDollar: 6, dodDollar: 0, totalCount: 1 } } };
    writes = []; listeners = [];
    firebaseState.db = db as any; firebaseState.fb = fb() as any;
    firebaseState.firebaseConfig = { databaseURL: 'https://shop.firebaseio.com' } as any;
    firebaseState.auth = { app: { options: { databaseURL: 'https://shop.firebaseio.com' } }, currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
    firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true; firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.dbRefHistory = ref(db, H) as any; firebaseState.dbRefDeleted = ref(db, T) as any;
    firebaseState.dbRefDailyRevenue = ref(db, D) as any; firebaseState.dbRefMonthlyRevenue = ref(db, M) as any;
    firebaseState.dbRefDailyPickup = ref(db, 'zoew_daily_pickup_cod_dod') as any; firebaseState.dbRefDailyCollected = ref(db, 'zoew_daily_collected_cod_dod') as any;
    firebaseState.dbRefZtoTrashMode = ref(db, ZTO_TRASH_MODE_PATH) as any;
    dataState.scanHistory = []; dataState.deletedItems = [];
    dataState.dailyRevenueData = clone(store[D]); dataState.monthlyRevenueData = clone(store[M]);
    dataState.dailyPickupData = {}; dataState.dailyCollectedData = {};
}
function seedHistory(...items: any[]) {
    items.forEach((it) => { store[H][it.id] = clone(it); });
    dataState.scanHistory = items.map(clone);
}
function shopMarker(val: any) {
    if (!val || typeof val !== 'object') { noteZtoTrashMode(val); return; }
    const out: any = {};
    for (const kind of ['palm', 'cookie']) {
        if (typeof val[kind] === 'number') out[kind] = { otherdev01: val[kind] };
        else if (val[kind] && typeof val[kind] === 'object') out[kind] = val[kind];
    }
    noteZtoTrashMode(out);
}
const own = (kind: string) => `${ZTO_TRASH_MODE_PATH}/${kind}/${ztoTrashModeDeviceKey()}`;
const useShop = () => appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://shop.firebaseio.com' }));
async function settle() { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); }
const toasts = () => (uiState.toasts || []).map((t: any) => String(t.msg || ''));
const PALM_URL = '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}';
const COOKIE_URL = '/.netlify/functions/zto-order-detail?barcode={barcode}';
function deviceLookup(url: string | null) {
    if (!url) { appLocalStore.removeItem('zoew_lookup_api_config'); return; }
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, url: window.location.origin + url }));
}

beforeEach(() => {
    appLocalStore.clear(); uiState.toasts = []; firebaseState.authGeneration++; firebaseState.dbListenerGeneration++;
    cleanupInFlight.clear(); activeRestoreClaims.clear(); restoreInFlight.clear(); ztoPickupStatus.clear();
    dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('fetch', cleanupServerRead(at));
    (window as any).ZoeErrors = { capture: vi.fn() };
    install(); resetZtoTrashMode();
});
afterEach(() => { firebaseState.authGeneration++; firebaseState.isDatabaseConnected = false; firebaseState.db = null; vi.unstubAllGlobals(); resetZtoTrashMode(); appLocalStore.clear(); });

describe('shop-wide trash mode marker', () => {
    it('a ZTO device follows its own lookup; a device without ZTO follows the strictest recently active shop mode', () => {
        const now = getServerNow();
        expect(effectiveZtoTrashMode('palm')).toBe('palm');
        expect(effectiveZtoTrashMode('cookie')).toBe('cookie');
        expect(effectiveZtoTrashMode('local'), 'listener not attached (off)').toBe('local');
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        expect(shopZtoTrashMode(), 'listener pending ➜ unknown').toBe('');
        shopMarker(null);
        expect(shopZtoTrashMode(), 'no marker').toBe('local');
        shopMarker({ cookie: now - HOUR });
        expect(effectiveZtoTrashMode('local')).toBe('cookie');
        shopMarker({ cookie: now - HOUR, palm: now - 2 * HOUR });
        expect(effectiveZtoTrashMode('local'), 'palm is stricter than cookie').toBe('palm');
        expect(effectiveZtoTrashMode('cookie'), 'a ZTO device keeps its own mode').toBe('cookie');
        shopMarker({ palm: now - ZTO_TRASH_MODE_ACTIVE_MS - 1, cookie: now - HOUR });
        expect(effectiveZtoTrashMode('local'), 'stale palm marker expires').toBe('cookie');
        shopMarker({ palm: now + 30 * 24 * HOUR });
        expect(effectiveZtoTrashMode('local'), 'a stamp ahead of this clock beyond what the rules accept counts as active (fail closed)').toBe('palm');
        shopMarker({ palm: now - ZTO_TRASH_MODE_ACTIVE_MS - 1 });
        expect(effectiveZtoTrashMode('local'), 'a stamp older than the window still expires').toBe('local');
        noteZtoTrashModeError({ code: 'PERMISSION_DENIED' });
        expect(shopZtoTrashMode(), 'rules not published ➜ device rules').toBe('local');
        noteZtoTrashModeError(new Error('network'));
        expect(shopZtoTrashMode(), 'listener failed ➜ unknown').toBe('');
    });

    it('a ZTO device writes its own mode at most once per gap and only after the marker arrived', async () => {
        useShop();
        expect(markZtoTrashMode('palm'), 'not attached').toBe(false);
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        expect(markZtoTrashMode('palm'), 'pending').toBe(false);
        shopMarker(null);
        expect(markZtoTrashMode('local')).toBe(false);
        expect(markZtoTrashMode('palm')).toBe(true);
        await settle();
        expect(at(own('palm'))).toBeGreaterThan(0);
        expect(markZtoTrashMode('palm'), 'within the gap').toBe(false);
        expect(markZtoTrashMode('cookie'), 'another key').toBe(true);
        shopMarker({ palm: { [ztoTrashModeDeviceKey()]: getServerNow() - ZTO_TRASH_MODE_MARK_GAP_MS - 1 } });
        (ztoState as any).ztoTrashModeWrote = { palmAt: 0, cookieAt: 0 };
        expect(markZtoTrashMode('palm'), 'gap passed').toBe(true);
    });

    it('CHK-5 ៖ this device\'s own stamp younger than the 6-hour gap is never rewritten, even with no recent write in this page · another device\'s fresh stamp never stands in for it', () => {
        useShop();
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        const key = ztoTrashModeDeviceKey();
        for (const mode of ['palm', 'cookie'] as const) {
            for (const age of [HOUR, ZTO_TRASH_MODE_MARK_GAP_MS - 60 * 1000]) {
                shopMarker({ [mode]: { [key]: getServerNow() - age } });
                (ztoState as any).ztoTrashModeWrote = {};
                expect(markZtoTrashMode(mode), `${mode} own stamp ${age / HOUR}h ago`).toBe(false);
            }
            shopMarker({ [mode]: { [key]: getServerNow() - ZTO_TRASH_MODE_MARK_GAP_MS - 1000 } });
            (ztoState as any).ztoTrashModeWrote = {};
            expect(markZtoTrashMode(mode), `reverse ៖ ${mode} own stamp past the gap`).toBe(true);
            shopMarker({ [mode]: { otherdevice0001: getServerNow() - HOUR } });
            (ztoState as any).ztoTrashModeWrote = {};
            expect(markZtoTrashMode(mode), `${mode} ៖ another device's fresh stamp never stands in`).toBe(true);
        }
    });

    it('an old listener generation never changes the marker state', () => {
        const generation = firebaseState.dbListenerGeneration;
        attachZtoTrashModeListener(generation);
        firebaseState.dbListenerGeneration++;
        listeners.find((l) => l.path === ZTO_TRASH_MODE_PATH)!.cb(snap({ palm: { otherdev01: getServerNow() } }));
        expect(ztoState.ztoTrashMode.state).toBe('pending');
    });
});

describe('a device without ZTO Lookup in a ZTO shop', () => {
    it.each([null, [], {}])('legacy manual Delete obtains committed source after a cold cache null (%j)', async (barcodes) => {
        deviceLookup(null); shopMarker(null);
        seedHistory({ ...closedItem('legacy', 'OLD'), barcodes });
        const original = firebaseState.fb.runTransaction;
        let cold = true;
        firebaseState.fb.runTransaction = (async (target, updater, ...args) => {
            if ((target as any).path === `${H}/legacy` && cold) {
                cold = false;
                if (updater(null) === undefined) return { committed: false, snapshot: snap(null) };
            }
            return original(target, updater, ...args);
        }) as any;
        expect(await deleteSingleItem('legacy', { confirmed: true, quiet: true })).toBe('deleted');
        expect(at(`${H}/legacy`)).toBeNull();
        expect(at(`${T}/legacy`)).toMatchObject({ trashReason: 'delete', trashGeneration: 1 });
    });

    it.each(['malformed', 7, false, { unexpected: 'bad' }])('manual Delete does not admit malformed barcodes as an empty legacy row (%j)', async (barcodes) => {
        deviceLookup(null); shopMarker(null);
        seedHistory({ ...closedItem('legacy', 'OLD'), barcodes });
        const before = clone(store);
        expect(await deleteSingleItem('legacy', { confirmed: true, quiet: true })).not.toBe('deleted');
        expect(at(`${H}/legacy`)).toEqual(before[H].legacy);
        expect(at(`${T}/legacy`)).toBeNull();
        expect(store[D]).toEqual(before[D]); expect(store[M]).toEqual(before[M]);
    });

    it.each([false, 'another-owner'])('manual Delete holds empty legacy rows with a clear marker (%j)', async (clearClaim) => {
        deviceLookup(null); shopMarker(null);
        seedHistory({ ...closedItem('legacy', 'OLD'), barcodes: [], clearClaim });
        const before = clone(store);
        expect(await deleteSingleItem('legacy', { confirmed: true, quiet: true })).toBe('blocked');
        expect(at(`${H}/legacy`)).toEqual(before[H].legacy);
        expect(at(`${T}/legacy`)).toBeNull();
    });

    it('legacy manual Delete holds if the authoritative empty row changes after admission', async () => {
        deviceLookup(null); shopMarker(null);
        seedHistory({ ...closedItem('legacy', 'OLD'), barcodes: [] });
        const before = clone(store);
        const original = firebaseState.fb.runTransaction;
        let historyTransactions = 0;
        firebaseState.fb.runTransaction = (async (target, updater, ...args) => {
            if ((target as any).path === `${H}/legacy` && ++historyTransactions === 2) {
                put(`${H}/legacy/phone`, '099999999');
            }
            return original(target, updater, ...args);
        }) as any;
        expect(await deleteSingleItem('legacy', { confirmed: true, quiet: true })).toBe('blocked');
        expect(at(`${H}/legacy/phone`)).toBe('099999999');
        expect(at(`${T}/legacy`)).toBeNull();
        expect(store[D]).toEqual(before[D]); expect(store[M]).toEqual(before[M]);
    });

    it('legacy manual Delete cannot use an aborted speculative row as admission proof', async () => {
        deviceLookup(null); shopMarker(null);
        seedHistory({ ...closedItem('legacy', 'OLD'), barcodes: [] });
        const before = clone(store);
        const original = firebaseState.fb.runTransaction;
        firebaseState.fb.runTransaction = (async (target, updater, ...args) => {
            if ((target as any).path === `${H}/legacy`) {
                updater(at(`${H}/legacy`));
                return { committed: false, snapshot: snap(at(`${H}/legacy`)) };
            }
            return original(target, updater, ...args);
        }) as any;
        expect(await deleteSingleItem('legacy', { confirmed: true, quiet: true })).not.toBe('deleted');
        expect(at(`${H}/legacy`)).toEqual(before[H].legacy);
        expect(at(`${T}/legacy`)).toBeNull();
        expect(store[D]).toEqual(before[D]); expect(store[M]).toEqual(before[M]);
    });

    it.each([{ name: 'missing', barcodes: undefined }, { name: 'empty', barcodes: [] }])('Palm៖ ធាតុចាស់ $name គ្មាន Sign ពិត មិនចូល cleanup តាមពេលបិទ ZoeW', async ({ barcodes }) => {
        deviceLookup(null); shopMarker({ palm: getServerNow() - HOUR });
        const legacy = { ...closedItem('legacy', 'OLD'), barcodes };
        seedHistory(legacy);
        const before = clone(store);
        runAutomaticCleanupRules(); await settle();
        expect(store).toEqual(before);
        await claimAndCleanupItem('legacy', 'close');
        expect(store).toEqual(before);
        expect(await deleteSingleItem('legacy', { confirmed: true, quiet: true })).toBe('deleted');
        expect(at(`${T}/legacy`)).toMatchObject({ trashReason: 'delete', trashMode: 'palm', restoreBlocked: true });
        expect(store[D]).toEqual(before[D]); expect(store[M]).toEqual(before[M]);
    });

    it.each(['cookie', 'local'])('%s៖ ធាតុគ្មានបញ្ជី barcodes មិនចូល cleanup ស្វ័យប្រវត្តិ (គ្មានត្រាទាយ) តែលុបដោយដៃបាន ដោយមិនដកប្រាក់', async (mode) => {
        deviceLookup(mode === 'cookie' ? COOKIE_URL : null); shopMarker(null);
        seedHistory({ ...closedItem('legacy', 'OLD'), barcodes: undefined });
        const before = clone(store);
        runAutomaticCleanupRules(); await settle();
        expect(store).toEqual(before);
        expect(await deleteSingleItem('legacy', { confirmed: true, quiet: true })).toBe('deleted');
        expect(at(`${H}/legacy`)).toBeNull();
        expect(at(`${T}/legacy`)).toMatchObject({ trashReason: 'delete', trashMode: mode });
        expect(store[D]).toEqual(before[D]); expect(store[M]).toEqual(before[M]);
    });

    it('Palm shop: holds an unsigned close past 2h and trashes a signed one 2h after the real Sign, stamped non-restorable', async () => {
        deviceLookup(null);
        shopMarker({ palm: getServerNow() - HOUR });
        expect(getShopZtoTrashMode()).toBe('palm');
        seedHistory(closedItem('unsigned', 'C1'), closedItem('signed', 'C2', { ztoSignedAt: getServerNow() - 2 * HOUR - 1000 }),
            closedItem('fresh', 'C3', { ztoSignedAt: getServerNow() - HOUR }));
        const collectedDay = collectedDayOfStamp(store[H].signed.barcodes[0].closedAt);
        put(`zoew_daily_collected_cod_dod/${collectedDay}/C2`, { c: 5, d: 1 });
        runAutomaticCleanupRules();
        await settle(); await claimAndCleanupItem('noop', 'close'); await settle();
        expect(at(`${H}/unsigned`), 'Palm: closed in ZoeW but not signed ➜ stays').toBeTruthy();
        expect(at(`${H}/fresh`), 'signed less than 2h ago ➜ stays').toBeTruthy();
        expect(at(`${H}/signed`)).toBeNull();
        expect(at(`${T}/signed`)).toMatchObject({ trashReason: 'pickup', trashMode: 'palm', restoreBlocked: true });
        expect(at(`${D}/${DAY}`)).toEqual({ codDollar: 6, dodDollar: 0, totalCount: 1 });
    });

    it('marker not arrived yet ➜ no automatic cleanup at all (no local 2h guess)', async () => {
        deviceLookup(null);
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        seedHistory(closedItem('unsigned', 'C1'));
        runAutomaticCleanupRules();
        await settle();
        expect(at(`${H}/unsigned`)).toBeTruthy();
        expect(writes).toEqual([]);
        shopMarker(null);
        runAutomaticCleanupRules();
        await settle();
        expect(at(`${H}/unsigned`), 'shop without ZTO ➜ local 2h rule').toBeNull();
        expect(at(`${T}/unsigned`)).toMatchObject({ trashMode: 'local' });
        expect(at(`${T}/unsigned`).restoreBlocked).toBeUndefined();
    });

    it('CHK-5 ៖ marker pending or failed ➜ an 8-day open parcel is never abandoned (no deduction, no «local» stamp); once the Palm marker arrives it leaves stamped Palm', async () => {
        deviceLookup(null);
        const old = getServerNow() - 9 * 24 * HOUR;
        const base = closedItem('open9', 'O9');
        const open9 = { ...base, isClosed: false, createdAt: old, barcodes: [{ ...base.barcodes[0], isClosed: false, createdAt: old }] };
        delete (open9 as any).closedAt; delete (open9.barcodes[0] as any).closedAt;
        seedHistory(open9);
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        expect(shopZtoTrashMode()).toBe('');
        runAutomaticCleanupRules();
        await settle();
        expect({ writes, trash: at(`${T}/open9`) }, 'marker pending').toEqual({ writes: [], trash: null });
        noteZtoTrashModeError(new Error('network'));
        expect(shopZtoTrashMode()).toBe('');
        runAutomaticCleanupRules();
        await settle();
        expect({ writes, trash: at(`${T}/open9`) }, 'marker listener failed').toEqual({ writes: [], trash: null });
        expect(at(`${H}/open9`)).toEqual(open9);
        expect(at(`${D}/${DAY}`)).toEqual({ codDollar: 6, dodDollar: 0, totalCount: 1 });
        shopMarker({ palm: getServerNow() - HOUR });
        runAutomaticCleanupRules();
        await settle(); await claimAndCleanupItem('noop', 'abandon'); await settle();
        expect(at(`${H}/open9`), 'reverse ៖ the marker arrived ➜ the 8-day rule runs').toBeNull();
        expect(at(`${T}/open9`)).toMatchObject({ trashReason: 'returned', trashMode: 'palm', restoreBlocked: true });
    });

    it('Palm shop: Delete stamps the trash as non-restorable and the trash shows 🔒 on this device', async () => {
        deviceLookup(null);
        shopMarker({ palm: getServerNow() - HOUR });
        seedHistory({ ...closedItem('del', 'C9'), isClosed: false, barcodes: [{ ...closedItem('del', 'C9').barcodes[0], isClosed: false }] });
        expect(await deleteSingleItem('del', { confirmed: true, quiet: true })).toBe('deleted');
        expect(at(`${T}/del`)).toMatchObject({ trashReason: 'delete', trashMode: 'palm', restoreBlocked: true });
        expect(trashRestoreBlockOf({ ...at(`${T}/del`), trashMode: 'local', restoreBlocked: false })).toBe('palm');
    });

    it('Cookie shop: restore of unsigned trash needs a device with ZTO Lookup; unsynced shop mode waits', async () => {
        deviceLookup(null);
        const item = { ...closedItem('t1', 'C5'), isClosed: false, deletedAt: getServerNow() - HOUR, trashReason: 'delete', trashMode: 'local', isFromDeletion: true };
        item.barcodes[0].isClosed = false;
        store[T].t1 = clone(item); dataState.deletedItems = [clone(item)];
        shopMarker({ cookie: getServerNow() - HOUR });
        uiState.pendingRestoreId = 't1'; await executeRestoreItem();
        expect(toasts()).toContain(RESTORE_ZTO_NEEDS_LOOKUP_TEXT);
        expect(at(`${T}/t1`)).toEqual(item); expect(at(`${T}/t1`).restoreClaim).toBeUndefined();
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        uiState.toasts = [];
        uiState.pendingRestoreId = 't1'; await executeRestoreItem();
        expect(toasts()).toContain(RESTORE_SHOP_MODE_UNSYNCED_TEXT);
        expect(at(`${T}/t1`)).toEqual(item);
        shopMarker(null);
        uiState.toasts = [];
        uiState.pendingRestoreId = 't1'; await executeRestoreItem();
        expect(at(`${T}/t1`), 'shop without ZTO ➜ ordinary restore').toBeNull();
    });

    function abandonedPreparedRestore(claimedAt: number) {
        const kept = { ...closedItem('h1', 'K1').barcodes[0], isClosed: false };
        const added = { ...closedItem('h1', 'C5').barcodes[0], isClosed: false };
        const target = { ...closedItem('h1', 'K1'), isClosed: false, count: 2, cod: 10, dod: 2, price: 12, barcodes: [kept, added],
            restoreClaimId: 't1', restoreClaimToken: 'tok1', restoreAddedCodes: JSON.stringify(['C5']) };
        const trash = { ...closedItem('t1', 'C5'), isClosed: false, barcodes: [{ ...added, isDeducted: true }], deletedAt: getServerNow() - HOUR,
            trashReason: 'remove', trashMode: 'cookie', isFromDeletion: false, restoreClaim: { token: 'tok1', claimedAt, targetId: 'h1' } };
        seedHistory(target);
        store[T].t1 = clone(trash); dataState.deletedItems = [clone(trash)];
        return { trash, target };
    }

    it('FIXSHOP-1 ៖ a Palm view never freezes an abandoned restore of an unsigned Cookie item (the device mode is not evidence) — a Cookie phone still finishes it', async () => {
        deviceLookup(null);
        shopMarker({ palm: getServerNow() - HOUR, cookie: getServerNow() - HOUR });
        const { trash, target } = abandonedPreparedRestore(getServerNow() - RESTORE_CLAIM_LEASE_MS - 1000);
        const money = clone(store[D]);
        expect(trashRestoreBlockOf(at(`${T}/t1`)), 'the Palm view still shows the item as locked').toBe('palm');
        await resumeInterruptedCleanups(); await settle();
        expect(at(`${T}/t1`), 'not frozen · claim kept').toEqual(trash);
        expect(at(`${H}/h1`), 'prepared row kept for the claimant').toEqual(target);
        expect(store[D]).toEqual(money);
        deviceLookup(COOKIE_URL);
        expect(trashRestoreBlockOf(at(`${T}/t1`)), 'Cookie phone ៖ still restorable').toBe('');
    });

    it('Palm view: an abandoned prepared restore whose barcode ZTO reports signed is cancelled and frozen — no frozen history row', async () => {
        deviceLookup(null);
        shopMarker({ palm: getServerNow() - HOUR });
        abandonedPreparedRestore(getServerNow() - RESTORE_CLAIM_LEASE_MS - 1000);
        ztoPickupStatus.set('C5', { closed: true, signedAt: getServerNow(), signedAtExact: true, checkedAt: getServerNow() });
        const money = clone(store[D]);
        await resumeInterruptedCleanups(); await settle();
        expect(at(`${H}/h1`).barcodes.map((b: any) => b.code)).toEqual(['K1']);
        expect(at(`${H}/h1`).restoreClaimId).toBeUndefined();
        expect(at(`${T}/t1`)).toMatchObject({ restoreBlocked: true });
        expect(at(`${T}/t1`).restoreClaim).toBeUndefined();
        expect(store[D]).toEqual(money);
        ztoPickupStatus.clear();
    });

    it('a live restore claim, or a device whose own mode lets it resume, is never cancelled', async () => {
        deviceLookup(null);
        shopMarker({ palm: getServerNow() - HOUR });
        const { trash, target } = abandonedPreparedRestore(getServerNow() - 1000);
        await resumeInterruptedCleanups(); await settle();
        expect(at(`${T}/t1`)).toEqual(trash);
        expect(at(`${H}/h1`)).toEqual(target);
        deviceLookup(COOKIE_URL);
        abandonedPreparedRestore(getServerNow() - RESTORE_CLAIM_LEASE_MS - 1000);
        await resumeInterruptedCleanups(); await settle();
        expect(at(`${T}/t1`).restoreBlocked, 'Cookie device: unsigned Cookie trash stays restorable (🔄 resumes it)').toBeUndefined();
        expect(at(`${H}/h1`).restoreClaimId).toBe('t1');
    });

    const signC5 = () => ztoPickupStatus.set('C5', { closed: true, signedAt: getServerNow(), signedAtExact: true, checkedAt: getServerNow() });

    it('FIXSHOP-2 ៖ a claim stamped a little ahead by the claimant\'s clock is live ➜ the background pass never cancels it; a stamp beyond the tolerance is invalid ➜ cancelled', async () => {
        deviceLookup(null);
        shopMarker({ palm: getServerNow() - HOUR });
        signC5();
        const api: any = firebaseState.fb, plain = api.runTransaction;
        let tries = 0;
        api.runTransaction = (r: any, update: any) => { tries++; return plain(r, update); };
        for (const ahead of [400, 5000, RESTORE_CLAIM_FUTURE_MS - 1000]) {
            const { trash, target } = abandonedPreparedRestore(getServerNow() + ahead);
            await resumeInterruptedCleanups(); await settle();
            expect(at(`${T}/t1`), `claimedAt = now + ${ahead} ➜ live claim kept`).toEqual(trash);
            expect(at(`${H}/h1`), `claimedAt = now + ${ahead} ➜ prepared row kept`).toEqual(target);
        }
        expect({ writes, tries }, 'the view already sees a live claim ➜ no server round trip').toEqual({ writes: [], tries: 0 });
        abandonedPreparedRestore(getServerNow() + RESTORE_CLAIM_FUTURE_MS + 60 * 1000);
        await resumeInterruptedCleanups(); await settle();
        expect(at(`${T}/t1`), 'a far-future stamp never holds the item forever').toMatchObject({ restoreBlocked: true });
        expect(at(`${H}/h1`).barcodes.map((b: any) => b.code)).toEqual(['K1']);
    });

    it('FIXSHOP-2 ៖ the freeze re-checks the lease on the server value (a retry with the same token refreshed claimedAt) ➜ nothing written', async () => {
        deviceLookup(null);
        shopMarker({ palm: getServerNow() - HOUR });
        signC5();
        const { target } = abandonedPreparedRestore(getServerNow() - RESTORE_CLAIM_LEASE_MS - 1000);
        store[T].t1.restoreClaim.claimedAt = getServerNow() - 500;
        const server = clone(store[T].t1);
        const money = clone(store[D]);
        await resumeInterruptedCleanups(); await settle();
        expect(at(`${T}/t1`), 'server claim refreshed by the claimant ➜ not frozen').toEqual(server);
        expect(at(`${H}/h1`)).toEqual(target);
        expect(store[D]).toEqual(money);
        expect(writes).toEqual([]);
    });

    it('FIXSHOP-2 ៖ server claim refreshed ahead by the claimant clock (same token) ➜ the freeze keeps it', async () => {
        deviceLookup(null);
        shopMarker({ palm: getServerNow() - HOUR });
        signC5();
        const { target } = abandonedPreparedRestore(getServerNow() - RESTORE_CLAIM_LEASE_MS - 1000);
        store[T].t1.restoreClaim.claimedAt = getServerNow() + 400;
        const server = clone(store[T].t1);
        await resumeInterruptedCleanups(); await settle();
        expect(at(`${T}/t1`), 'a server stamp a little ahead of this clock is a live lease').toEqual(server);
        expect(at(`${H}/h1`)).toEqual(target);
        expect(writes).toEqual([]);
    });

    it('FIXSHOP-2 ៖ a stale trash view never decides that a lease expired; once fresh, the expired claim with Sign evidence is cancelled', async () => {
        deviceLookup(null);
        shopMarker({ palm: getServerNow() - HOUR });
        signC5();
        for (const stale of [dbListenerPendingPaths, dbListenerFailedPaths]) {
            const { trash, target } = abandonedPreparedRestore(getServerNow() - RESTORE_CLAIM_LEASE_MS - 1000);
            stale.add(DB_LISTENER_KEY_DELETED);
            await resumeInterruptedCleanups(); await settle();
            expect(at(`${T}/t1`)).toEqual(trash);
            expect(at(`${H}/h1`)).toEqual(target);
            stale.delete(DB_LISTENER_KEY_DELETED);
        }
        expect(writes).toEqual([]);
        await resumeInterruptedCleanups(); await settle();
        expect(at(`${T}/t1`)).toMatchObject({ restoreBlocked: true });
        expect(at(`${H}/h1`).barcodes.map((b: any) => b.code)).toEqual(['K1']);
    });

    it('CHK-5 ៖ a clock that is not trusted, or this device\'s own live claim, never lets the background pass cancel an expired-looking restore', async () => {
        deviceLookup(null);
        shopMarker({ palm: getServerNow() - HOUR });
        signC5();
        let seeded = abandonedPreparedRestore(getServerNow() - RESTORE_CLAIM_LEASE_MS - 1000);
        firebaseState.serverClockTrusted = false;
        await resumeInterruptedCleanups(); await settle();
        expect(at(`${T}/t1`), 'server clock not trusted').toEqual(seeded.trash);
        expect(at(`${H}/h1`)).toEqual(seeded.target);
        firebaseState.serverClockTrusted = true;
        firebaseState.isDatabaseConnected = false;
        await resumeInterruptedCleanups(); await settle();
        expect(at(`${T}/t1`), 'database not connected').toEqual(seeded.trash);
        firebaseState.isDatabaseConnected = true;
        seeded = abandonedPreparedRestore(getServerNow() - RESTORE_CLAIM_LEASE_MS - 1000);
        activeRestoreClaims.set('t1', { token: 'tok1', targetId: 'h1' });
        await resumeInterruptedCleanups(); await settle();
        expect(at(`${T}/t1`), 'this device still runs the restore').toEqual(seeded.trash);
        expect(at(`${H}/h1`)).toEqual(seeded.target);
        expect(writes).toEqual([]);
        activeRestoreClaims.clear();
        await resumeInterruptedCleanups(); await settle();
        expect(at(`${T}/t1`), 'reverse ៖ the same item is cancelled once both gates open').toMatchObject({ restoreBlocked: true });
    });

    it('leaving Palm withdraws the Palm stamp; a Palm device still active stamps again', async () => {
        useShop();
        deviceLookup(PALM_URL);
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        shopMarker(null);
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        shopMarker(at(ZTO_TRASH_MODE_PATH));
        expect(at(own('palm'))).toBeGreaterThan(0);
        expect(storeLookupApiConfig({ enabled: true, fastMode: true, url: window.location.origin + COOKIE_URL })).toBe(true);
        await settle();
        expect(at(own('palm')), 'withdrawn').toBeNull();
        shopMarker(at(ZTO_TRASH_MODE_PATH));
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        expect(at(own('cookie'))).toBeGreaterThan(0);
        shopMarker(at(ZTO_TRASH_MODE_PATH));
        expect(getShopZtoTrashMode()).toBe('cookie');
        (ztoState as any).ztoTrashModeWrote = { palmAt: 0, cookieAt: 0 };
        expect(markZtoTrashMode('palm'), 'another Palm device sees no Palm stamp ➜ stamps again').toBe(true);
    });

    it('MX-3 · leaving Palm never withdraws a stamp another device wrote; its own key goes whatever it holds, and a refresh stamps it again while it uses Palm', async () => {
        useShop();
        deviceLookup(PALM_URL);
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        const theirs = getServerNow() - HOUR;
        put(ZTO_TRASH_MODE_PATH, { palm: { otherdevice1: theirs } });
        shopMarker(at(ZTO_TRASH_MODE_PATH));
        expect(refreshZtoTrashModeMark(), 'FIXSHOP-3 ៖ a fresh stamp of another device never stands in for this one').toBe(true);
        expect(storeLookupApiConfig({ enabled: true, fastMode: true, url: window.location.origin + COOKIE_URL })).toBe(true);
        await settle();
        expect(at(ZTO_TRASH_MODE_PATH + '/palm/otherdevice1'), 'the other Palm device keeps the shop on Palm').toBe(theirs);
        expect(at(own('palm')), 'its own Palm stamp withdrawn').toBeNull();
        deviceLookup(PALM_URL);
        put(ZTO_TRASH_MODE_PATH, null); shopMarker(null);
        (ztoState as any).ztoTrashModeWrote = { palmAt: 0, cookieAt: 0 };
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        shopMarker(at(ZTO_TRASH_MODE_PATH));
        const meanwhile = getServerNow();
        const api: any = firebaseState.fb, plain = api.runTransaction;
        api.runTransaction = async (r: any, update: any) => { if (r.path.startsWith(ZTO_TRASH_MODE_PATH)) put(own('palm'), meanwhile); return plain(r, update); };
        storeLookupApiConfig({ enabled: true, fastMode: true, url: window.location.origin + COOKIE_URL });
        await settle();
        api.runTransaction = plain;
        expect(at(own('palm')), 'another tab of this install re-stamped before the withdrawal landed ➜ the delete of its own key wins once').toBeNull();
        deviceLookup(PALM_URL);
        shopMarker(at(ZTO_TRASH_MODE_PATH));
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + ZTO_TRASH_MODE_RETRY_MS + 1000);
        try {
            expect(refreshZtoTrashModeMark(), 'the next refresh stamps the missing own stamp again').toBe(true);
            await settle();
        } finally {
            vi.mocked(Date.now).mockRestore();
        }
        expect(at(own('palm'))).toBeGreaterThan(0);
    });

    it('manual Delete while the marker re-attaches keeps the shop mode last seen (not local)', async () => {
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://shop.firebaseio.com' }));
        deviceLookup(null);
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        shopMarker({ palm: getServerNow() - HOUR });
        expect(getShopZtoTrashMode()).toBe('palm');
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        expect(getShopZtoTrashMode()).toBe('');
        seedHistory({ ...closedItem('del', 'C9'), isClosed: false, barcodes: [{ ...closedItem('del', 'C9').barcodes[0], isClosed: false }] });
        expect(await deleteSingleItem('del', { confirmed: true, quiet: true })).toBe('deleted');
        expect(at(`${T}/del`)).toMatchObject({ trashMode: 'palm', restoreBlocked: true });
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
        seedHistory({ ...closedItem('del2', 'C8'), isClosed: false, barcodes: [{ ...closedItem('del2', 'C8').barcodes[0], isClosed: false }] });
        expect(await deleteSingleItem('del2', { confirmed: true, quiet: true })).toBe('deleted');
        expect(at(`${T}/del2`).trashMode, 'another shop never inherits the remembered mode').toBe('local');
    });
});
