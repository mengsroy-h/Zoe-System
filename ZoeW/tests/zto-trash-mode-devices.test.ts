import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { appLocalStore, appSessionStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { cleanupInFlight, claimAndCleanupItem, runAutomaticCleanupRules } from '../src/domain/cleanup';
import { deleteSingleItem } from '../src/features/entry-ops';
import { getShopZtoTrashMode, refreshZtoTrashModeMark, storeLookupApiConfig } from '../src/features/lookup-config';
import { activeRestoreClaims, restoreInFlight } from '../src/features/restore';
import { disconnectZtoPalm } from '../src/features/zto-palm-login';
import * as trashMode from '../src/services/zto-trash-mode';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { nativeWriteRecoveryState } from '../src/services/native-write-recovery';
import { createSupabaseDatabase, SbNetworkError, SbRpcError } from '../src/services/supabase-rtdb';

const {
    ZTO_TRASH_MODE_ACTIVE_MS, ZTO_TRASH_MODE_MARK_GAP_MS, ZTO_TRASH_MODE_PATH, ZTO_TRASH_MODE_REFUSED_RETRY_MS, ZTO_TRASH_MODE_RETRY_MS,
    attachZtoTrashModeListener, markZtoTrashMode, noteZtoTrashMode, resetZtoTrashMode, retryZtoTrashModeListener, withdrawZtoTrashMode
} = trashMode;
const RULES_FUTURE_MS = 10 * 60 * 1000;
const PRUNE_MAX: number = (trashMode as any).ZTO_TRASH_MODE_PRUNE_MAX;
const pruneZtoTrashMode: () => number = (trashMode as any).pruneZtoTrashMode;
const ztoTrashModeDeviceKey: () => string = (trashMode as any).ztoTrashModeDeviceKey;

const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-10-20', HOUR = 60 * 60 * 1000;
const DEVICE_STORE = 'zoew_trash_mode_device_v1';
const SHOP = 'https://shop.firebaseio.com';
const SHOP_CONFIG = JSON.stringify({ databaseURL: SHOP });
let db: any = { name: 'shop-trash-mode-devices' };
let store: Record<string, any>, writes: string[];
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
            put(r.path, next); writes.push((next === null ? 'del:' : 'tx:') + r.path);
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
        onValue: () => () => {},
        off: () => {}
    };
}
function closedItem(id: string, code: string) {
    const closedAt = getServerNow() - 3 * HOUR;
    return { id, phone: '012000111', scanDate: DAY, time: `08:00:00 (${DAY})`, createdAt: closedAt - HOUR, count: 1, cod: 5, dod: 1, price: 6,
        isClosed: true, closedAt, isCalled: false, barcode: code,
        barcodes: [{ code, cod: 5, dod: 1, locker: 'A1', createdAt: closedAt - HOUR, isClosed: true, closedAt, isFromDeletion: false, isDeducted: false }] };
}
function openItem(id: string, code: string) {
    const item = closedItem(id, code);
    return { ...item, isClosed: false, barcodes: [{ ...item.barcodes[0], isClosed: false }] };
}
function install() {
    store = { [H]: {}, [T]: {}, [D]: { [DAY]: { codDollar: 6, dodDollar: 0, totalCount: 1 } }, [M]: { '2026-10': { codDollar: 6, dodDollar: 0, totalCount: 1 } } };
    writes = [];
    db = { name: 'shop-trash-mode-devices' };
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
async function settle() { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); }
const PALM_URL = '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}';
const COOKIE_URL = '/.netlify/functions/zto-order-detail?barcode={barcode}';
const lookupCfg = (url: string, enabled = true) => ({ enabled, fastMode: true, url: window.location.origin + url });

type Page = { local: Record<string, string>; wrote: any };
const pages = new Map<string, Page>();
let current = '', freshPage: Page;
function dumpLocal() {
    const out: Record<string, string> = {};
    for (let i = 0; i < appLocalStore.length; i++) { const k = appLocalStore.key(i)!; out[k] = appLocalStore.getItem(k)!; }
    return out;
}
function device(name: string, url?: string | null) {
    if (current) pages.set(current, { local: dumpLocal(), wrote: clone(ztoState.ztoTrashModeWrote) });
    const page = pages.get(name) || freshPage;
    appLocalStore.clear();
    for (const [k, v] of Object.entries(page.local)) appLocalStore.setItem(k, v);
    (ztoState as any).ztoTrashModeWrote = clone(page.wrote);
    current = name;
    if (url === null) appLocalStore.removeItem('zoew_lookup_api_config');
    else if (url) appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(lookupCfg(url)));
    noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
}
function storedDevices(store: Storage = appLocalStore) {
    return JSON.parse(store.getItem(DEVICE_STORE) || 'null');
}
function stampsIn(node: any): number[] {
    if (typeof node === 'number') return [node];
    if (!node || typeof node !== 'object') return [];
    return Object.values(node).flatMap(stampsIn);
}

beforeEach(() => {
    appLocalStore.clear(); appSessionStore.clear(); uiState.toasts = []; firebaseState.authGeneration++; firebaseState.dbListenerGeneration++;
    cleanupInFlight.clear(); activeRestoreClaims.clear(); restoreInFlight.clear();
    dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', vi.fn());
    (window as any).ZoeErrors = { capture: vi.fn() };
    install(); resetZtoTrashMode();
    appLocalStore.setItem('zoew_firebase_config', SHOP_CONFIG);
    freshPage = { local: { zoew_firebase_config: SHOP_CONFIG }, wrote: clone(ztoState.ztoTrashModeWrote) };
    pages.clear(); current = '';
    attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); resetZtoTrashMode(); appLocalStore.clear(); appSessionStore.clear(); firebaseState.serverTimeOffsetMs = 0; });

describe('FIXSHOP-3 ៖ ត្រារបៀបធុងសំរាមហាងតាមឧបករណ៍', () => {
    it('Palm phone A leaving never turns the shop local while Palm phone X is still active — both gone ➜ local', async () => {
        device('A', PALM_URL);
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        device('X', PALM_URL);
        refreshZtoTrashModeMark();
        await settle();
        device('A');
        expect(storeLookupApiConfig(lookupCfg(PALM_URL, false))).toBe(true);
        await settle();
        device('N', null);
        expect(getShopZtoTrashMode(), 'X still uses Palm ➜ a device without ZTO keeps the Palm rules').toBe('palm');
        seedHistory(closedItem('unsigned', 'C1'), openItem('del', 'C9'));
        runAutomaticCleanupRules();
        await settle(); await claimAndCleanupItem('noop', 'close'); await settle();
        expect(at(`${H}/unsigned`), 'closed in ZoeW but not signed in ZTO ➜ stays in history').toBeTruthy();
        expect(await deleteSingleItem('del', { confirmed: true, quiet: true })).toBe('deleted');
        expect(at(`${T}/del`)).toMatchObject({ trashMode: 'palm', restoreBlocked: true });
        device('X');
        expect(storeLookupApiConfig(lookupCfg(PALM_URL, false))).toBe(true);
        await settle();
        device('N');
        expect(getShopZtoTrashMode(), 'no Palm phone left ➜ local').toBe('local');
    });

    it('«ផ្តាច់ Palm» on the phone that stamped first never turns the shop local while another Palm phone is active', async () => {
        device('X', PALM_URL);
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...lookupCfg(PALM_URL), palmShared: true }));
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        device('A', PALM_URL);
        refreshZtoTrashModeMark();
        await settle();
        device('X');
        disconnectZtoPalm();
        await settle();
        expect(getShopZtoTrashMode(), 'X itself has no ZTO now ➜ follows the shop').toBe('palm');
        device('N', null);
        expect(getShopZtoTrashMode(), 'A still uses Palm').toBe('palm');
        seedHistory(closedItem('unsigned', 'C1'));
        runAutomaticCleanupRules();
        await settle(); await claimAndCleanupItem('noop', 'close'); await settle();
        expect(at(`${H}/unsigned`), 'closed in ZoeW but not signed in ZTO ➜ stays in history').toBeTruthy();
        expect(at(`${T}/unsigned`)).toBeNull();
    });

    it('Palm phone X leaving first never deletes the stamp of Palm phone A; A leaving afterwards turns the shop local', async () => {
        device('A', PALM_URL);
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        const stampA = stampsIn(at(ZTO_TRASH_MODE_PATH));
        expect(stampA).toHaveLength(1);
        device('X', PALM_URL);
        refreshZtoTrashModeMark();
        await settle();
        device('X');
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await settle();
        expect(stampsIn(at(ZTO_TRASH_MODE_PATH)), 'the stamp of A stays').toContain(stampA[0]);
        device('N', null);
        expect(getShopZtoTrashMode()).toBe('palm');
        device('A');
        expect(storeLookupApiConfig(lookupCfg(PALM_URL, false))).toBe(true);
        await settle();
        device('X');
        refreshZtoTrashModeMark();
        await settle();
        device('N');
        expect(getShopZtoTrashMode(), 'Palm gone · X now Cookie ➜ cookie').toBe('cookie');
    });

    it('each Palm phone keeps its own stamp — another phone\'s fresh stamp never stands in for it; the gap applies to its own stamp', async () => {
        device('A', PALM_URL);
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        device('X', PALM_URL);
        expect(refreshZtoTrashModeMark(), 'A stamped a minute ago, X has no stamp of its own ➜ X stamps').toBe(true);
        await settle();
        expect(stampsIn(at(ZTO_TRASH_MODE_PATH))).toHaveLength(2);
        device('X');
        (ztoState as any).ztoTrashModeWrote = clone(freshPage.wrote);
        expect(markZtoTrashMode('palm'), 'own stamp within the gap').toBe(false);
        const key = ztoTrashModeDeviceKey();
        put(`${ZTO_TRASH_MODE_PATH}/palm/${key}`, getServerNow() - ZTO_TRASH_MODE_MARK_GAP_MS - 1);
        device('X');
        expect(markZtoTrashMode('palm'), 'own stamp older than the gap ➜ stamps again').toBe(true);
        await settle();
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${key}`)).toBeGreaterThan(getServerNow() - HOUR);
    });

    it('a device writes and withdraws only its own key — unconditionally, whatever value it holds', async () => {
        device('A', PALM_URL);
        refreshZtoTrashModeMark();
        await settle();
        const keyA = ztoTrashModeDeviceKey();
        expect(keyA).toMatch(/^[a-z0-9]{8,32}$/);
        expect(storedDevices(), 'one key per shop, kept in the device store').toEqual({ [SHOP]: keyA });
        expect(Object.keys(at(`${ZTO_TRASH_MODE_PATH}/palm`))).toEqual([keyA]);
        device('X', PALM_URL);
        const keyX = ztoTrashModeDeviceKey();
        expect(keyX).not.toBe(keyA);
        refreshZtoTrashModeMark();
        await settle();
        expect(Object.keys(at(`${ZTO_TRASH_MODE_PATH}/palm`)).sort()).toEqual([keyA, keyX].sort());
        device('X');
        expect(withdrawZtoTrashMode('palm')).toBe(true);
        await settle();
        expect(Object.keys(at(`${ZTO_TRASH_MODE_PATH}/palm`))).toEqual([keyA]);
        device('X');
        withdrawZtoTrashMode('palm');
        await settle();
        expect(Object.keys(at(`${ZTO_TRASH_MODE_PATH}/palm`)), 'nothing of its own left ➜ A untouched').toEqual([keyA]);
        device('A');
        const values: any[] = [];
        const api: any = firebaseState.fb, plain = api.runTransaction;
        api.runTransaction = async (r: any, update: any) => {
            for (const v of [null, 1, getServerNow() - HOUR, getServerNow() + RULES_FUTURE_MS, getServerNow() + 30 * 24 * HOUR, 'x', { at: 1 }]) values.push(update(v));
            return plain(r, update);
        };
        expect(withdrawZtoTrashMode('palm')).toBe(true);
        await settle();
        expect(values.every((v) => v === null), 'the delete never depends on the value under its own key').toBe(true);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${keyA}`)).toBeNull();
    });

    it('accepted boundary: a quick Palm ➜ Cookie ➜ Palm flip can lose the re-stamp to the late withdrawal once; a refresh after the retry gap stamps it again', async () => {
        device('A', PALM_URL);
        const key = ztoTrashModeDeviceKey();
        put(ZTO_TRASH_MODE_PATH, { palm: { [key]: getServerNow() - ZTO_TRASH_MODE_MARK_GAP_MS - HOUR } });
        device('A');
        const api: any = firebaseState.fb, plain = api.runTransaction;
        let release: (() => void) | null = null;
        api.runTransaction = (r: any, update: any) => (r.path.endsWith('/palm/' + key) && !release
            ? new Promise((res) => { release = () => res(plain(r, update)); }) : plain(r, update));
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await settle();
        expect(release, 'the withdrawal of Palm is still on its way').not.toBeNull();
        expect(storeLookupApiConfig(lookupCfg(PALM_URL))).toBe(true);
        expect(refreshZtoTrashModeMark(), 'back on Palm with an own stamp older than the gap ➜ stamps again').toBe(true);
        await settle();
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${key}`)).toBeGreaterThan(getServerNow() - HOUR);
        release!();
        await settle();
        api.runTransaction = plain;
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${key}`), 'the late unconditional withdrawal took the re-stamp').toBeNull();
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
        expect(refreshZtoTrashModeMark(), 'within the retry gap of the re-stamp ➜ not yet').toBe(false);
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + ZTO_TRASH_MODE_RETRY_MS + 1000);
        expect(refreshZtoTrashModeMark(), 'healed by the next refresh after the gap').toBe(true);
        await settle();
        vi.mocked(Date.now).mockRestore();
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${key}`)).toBeGreaterThan(getServerNow() - HOUR);
        device('N', null);
        expect(getShopZtoTrashMode()).toBe('palm');
    });

    it('a withdrawal lost to the network (disconnect, then a reload) is sent again from the refresh cycle — only for its own key of a mode it left, ≤ 1 per retry gap, and only while connected', async () => {
        device('X', PALM_URL);
        refreshZtoTrashModeMark();
        await settle();
        device('A', PALM_URL);
        refreshZtoTrashModeMark();
        await settle();
        const key = ztoTrashModeDeviceKey();
        const api: any = firebaseState.fb, plain = api.runTransaction;
        let sent = 0;
        api.runTransaction = async (r: any, update: any) => {
            if (!r.path.endsWith('/palm/' + key)) return plain(r, update);
            sent++;
            throw Object.assign(new Error('disconnect'), { code: 'disconnect' });
        };
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await settle();
        expect(sent).toBe(1);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${key}`), 'the withdrawal never reached the server').toBeGreaterThan(0);
        device('A');
        refreshZtoTrashModeMark();
        await settle();
        expect(sent, 'same page, within the retry gap of the last attempt ➜ nothing more').toBe(1);
        resetZtoTrashMode();
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        expect(refreshZtoTrashModeMark(), 'reloaded: marker not arrived ➜ nothing').toBe(false);
        await settle();
        expect(sent).toBe(1);
        device('A');
        refreshZtoTrashModeMark();
        refreshZtoTrashModeMark();
        await settle();
        expect(sent, 'reloaded: the marker shows its own Palm stamp ➜ one retry').toBe(2);
        let clock = Date.now() + ZTO_TRASH_MODE_RETRY_MS + 1000;
        vi.spyOn(Date, 'now').mockReturnValue(clock);
        firebaseState.isDatabaseConnected = false;
        device('A');
        refreshZtoTrashModeMark();
        await settle();
        expect(sent, 'offline ➜ no retry queued').toBe(2);
        firebaseState.isDatabaseConnected = true;
        refreshZtoTrashModeMark();
        refreshZtoTrashModeMark();
        await settle();
        expect(sent, 'connected again ➜ one retry per gap').toBe(3);
        vi.mocked(Date.now).mockRestore();
        api.runTransaction = plain;
        clock += ZTO_TRASH_MODE_RETRY_MS + 1000;
        vi.spyOn(Date, 'now').mockReturnValue(clock);
        device('A');
        refreshZtoTrashModeMark();
        await settle();
        vi.mocked(Date.now).mockRestore();
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${key}`), 'own Palm stamp withdrawn after the reload').toBeNull();
        expect(at(`${ZTO_TRASH_MODE_PATH}/cookie/${key}`), 'its current mode stays stamped').toBeGreaterThan(0);
        device('X');
        const keyX = ztoTrashModeDeviceKey();
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${keyX}`), 'another device\'s Palm stamp is never touched').toBeGreaterThan(0);
        device('N', null);
        expect(getShopZtoTrashMode()).toBe('palm');
        device('X');
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await settle();
        device('N');
        expect(getShopZtoTrashMode(), 'no Palm stamp left ➜ cookie').toBe('cookie');
    });

    it('a device clock 2 h slow with no server offset yet still withdraws its own stamp once the marker arrives (an unconditional delete of its own key needs no clock)', async () => {
        const real = Date.now();
        device('A', PALM_URL);
        const keyA = ztoTrashModeDeviceKey();
        const earlier = real - 30 * 60 * 1000;
        put(ZTO_TRASH_MODE_PATH, { palm: { [keyA]: earlier, otherdevice1: earlier } });
        resetZtoTrashMode();
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        const api: any = firebaseState.fb, plain = api.runTransaction;
        const offsets: number[] = [];
        api.runTransaction = async (r: any, update: any) => {
            offsets.push(firebaseState.serverTimeOffsetMs);
            expect(update(null), 'the local cache is empty first').toBeNull();
            firebaseState.serverTimeOffsetMs = 2 * HOUR;
            return plain(r, update);
        };
        firebaseState.serverTimeOffsetMs = 0;
        vi.spyOn(Date, 'now').mockReturnValue(real - 2 * HOUR);
        try {
            expect(getServerNow()).toBeLessThan(earlier);
            expect(storeLookupApiConfig(lookupCfg(PALM_URL, false))).toBe(true);
            await settle();
            expect(offsets, 'marker pending ➜ nothing sent, nothing journaled').toEqual([]);
            noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
            refreshZtoTrashModeMark();
            await settle();
        } finally {
            vi.mocked(Date.now).mockRestore();
            firebaseState.serverTimeOffsetMs = 0;
        }
        expect(offsets, 'the withdrawal was sent while the offset was still unknown').toEqual([0]);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm`), 'own stamp withdrawn · another device untouched').toEqual({ otherdevice1: earlier });
    });

    it('its own earlier stamp written on a clock ahead (inside what the rules accept) is withdrawn once the marker arrives; another device\'s stamp stays', async () => {
        device('A', PALM_URL);
        const keyA = ztoTrashModeDeviceKey();
        const ahead = getServerNow() + RULES_FUTURE_MS - 60 * 1000;
        const otherAt = getServerNow() - HOUR;
        put(ZTO_TRASH_MODE_PATH, { palm: { [keyA]: ahead, otherdevice1: otherAt } });
        resetZtoTrashMode();
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        expect(storeLookupApiConfig(lookupCfg(PALM_URL, false))).toBe(true);
        await settle();
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${keyA}`), 'marker pending ➜ not yet').toBe(ahead);
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
        refreshZtoTrashModeMark();
        await settle();
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm`)).toEqual({ otherdevice1: otherAt });
    });

    it('leaving Palm before the marker arrived sends nothing; the marker arriving lets the refresh withdraw this device\'s own stamp from an earlier session (never another one)', async () => {
        device('A', PALM_URL);
        const keyA = ztoTrashModeDeviceKey();
        const earlier = getServerNow() - HOUR;
        put(ZTO_TRASH_MODE_PATH, { palm: { [keyA]: earlier, otherdevice1: earlier } });
        resetZtoTrashMode();
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        expect(ztoState.ztoTrashMode.state).toBe('pending');
        writes = [];
        expect(storeLookupApiConfig(lookupCfg(PALM_URL, false))).toBe(true);
        expect(refreshZtoTrashModeMark()).toBe(false);
        await settle();
        expect(writes, 'marker pending ➜ no trash-mode write at all').toEqual([]);
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
        refreshZtoTrashModeMark();
        refreshZtoTrashModeMark();
        await settle();
        expect(writes).toEqual([`del:${ZTO_TRASH_MODE_PATH}/palm/${keyA}`]);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm`)).toEqual({ otherdevice1: earlier });
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + ZTO_TRASH_MODE_RETRY_MS + 1000);
        try {
            put(`${ZTO_TRASH_MODE_PATH}/palm/${keyA}`, getServerNow() - 60 * 1000);
            noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
            refreshZtoTrashModeMark();
            await settle();
        } finally {
            vi.mocked(Date.now).mockRestore();
        }
        expect(writes, 'landed ➜ the intent is gone: a stamp another install of the same key wrote later stays').toEqual([`del:${ZTO_TRASH_MODE_PATH}/palm/${keyA}`]);
    });

    it('storage that refuses writes ➜ one random key for the whole page, never a License or device identifier; no shop known ➜ no key, no stamp', async () => {
        const localSet = vi.spyOn(appLocalStore as any, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        const sessionSet = vi.spyOn(appSessionStore as any, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        try {
            const first = ztoTrashModeDeviceKey();
            expect(first).toMatch(/^[a-z0-9]{8,32}$/);
            expect(ztoTrashModeDeviceKey()).toBe(first);
            expect(localSet).toHaveBeenCalled();
            expect(sessionSet).toHaveBeenCalled();
            expect(appLocalStore.getItem(DEVICE_STORE)).toBeNull();
            expect(appSessionStore.getItem(DEVICE_STORE)).toBeNull();
        } finally {
            localSet.mockRestore(); sessionSet.mockRestore();
        }
        appLocalStore.removeItem('zoew_firebase_config');
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(lookupCfg(PALM_URL)));
        noteZtoTrashMode(null);
        expect(ztoTrashModeDeviceKey()).toBe('');
        expect(markZtoTrashMode('palm')).toBe(false);
        expect(withdrawZtoTrashMode('palm')).toBe(false);
        await settle();
        expect(at(ZTO_TRASH_MODE_PATH)).toBeNull();
    });

    it('local storage that reads but refuses writes ➜ the key lives in the session store and survives a reload of the page', async () => {
        const localSet = vi.spyOn(appLocalStore as any, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
        try {
            const first = ztoTrashModeDeviceKey();
            expect(first).toMatch(/^[a-z0-9]{8,32}$/);
            expect(localSet).toHaveBeenCalled();
            expect(appLocalStore.getItem(DEVICE_STORE)).toBeNull();
            expect(storedDevices(appSessionStore)).toEqual({ [SHOP]: first });
            vi.resetModules();
            const reloaded = await import('../src/services/zto-trash-mode');
            expect(reloaded.ztoTrashModeDeviceKey(), 'a reload of the page keeps the key').toBe(first);
            localSet.mockRestore();
            expect(reloaded.ztoTrashModeDeviceKey(), 'local storage writable again ➜ the same key moves there').toBe(first);
            expect(storedDevices()).toEqual({ [SHOP]: first });
        } finally {
            localSet.mockRestore();
        }
    });

    it('a separate random key per shop (never one key that links an install across shops); bounded, the least recently used shop leaves first', async () => {
        const MAX: number = (trashMode as any).ZTO_TRASH_MODE_DEVICE_SHOPS_MAX;
        expect(MAX).toBeGreaterThanOrEqual(2);
        device('A', PALM_URL);
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        const inShop = ztoTrashModeDeviceKey();
        const other = 'https://other.firebaseio.com';
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: other }));
        const inOther = ztoTrashModeDeviceKey();
        expect(inOther).toMatch(/^[a-z0-9]{8,32}$/);
        expect(inOther, 'another shop never sees the same key').not.toBe(inShop);
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: other + '/' }));
        expect(ztoTrashModeDeviceKey(), 'the same shop written another way keeps its key').toBe(inOther);
        appLocalStore.setItem('zoew_firebase_config', SHOP_CONFIG);
        expect(ztoTrashModeDeviceKey(), 'back in the first shop ➜ its own key again').toBe(inShop);
        expect(Object.keys(at(`${ZTO_TRASH_MODE_PATH}/palm`))).toEqual([inShop]);
        for (let i = 0; i < MAX - 1; i++) {
            appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: `https://shop${i}.firebaseio.com` }));
            ztoTrashModeDeviceKey();
        }
        const kept = storedDevices();
        expect(Object.keys(kept)).toHaveLength(MAX);
        expect(kept[SHOP], 'used most recently before the new shops ➜ kept').toBe(inShop);
        expect(kept[other], 'the least recently used shop left the store').toBeUndefined();
        appLocalStore.setItem('zoew_firebase_config', SHOP_CONFIG);
        expect(ztoTrashModeDeviceKey()).toBe(inShop);
    });

    it('a slow device clock with no server offset yet: the marker arriving first is kept raw ➜ the shop mode stays Palm (fail closed) and is right once the offset arrives', async () => {
        const real = Date.now();
        put(ZTO_TRASH_MODE_PATH, { palm: { palmdevice1: real - HOUR } });
        firebaseState.serverTimeOffsetMs = 0;
        vi.spyOn(Date, 'now').mockReturnValue(real - 2 * HOUR);
        try {
            device('N', null);
            expect(getShopZtoTrashMode(), 'a stamp ahead of this clock beyond what the rules accept counts as active').toBe('palm');
            expect(pruneZtoTrashMode(), 'never pruned by age').toBe(0);
            firebaseState.serverTimeOffsetMs = 2 * HOUR;
            expect(getShopZtoTrashMode(), 'the server offset arrived after the marker').toBe('palm');
            seedHistory(closedItem('unsigned', 'C1'), openItem('del', 'C9'));
            runAutomaticCleanupRules();
            await settle(); await claimAndCleanupItem('noop', 'close'); await settle();
            expect(at(`${H}/unsigned`), 'Palm shop: closed in ZoeW but not signed ➜ stays').toBeTruthy();
            expect(await deleteSingleItem('del', { confirmed: true, quiet: true })).toBe('deleted');
            expect(at(`${T}/del`)).toMatchObject({ trashMode: 'palm', restoreBlocked: true });
        } finally {
            vi.mocked(Date.now).mockRestore();
            firebaseState.serverTimeOffsetMs = 0;
        }
    });

    it('a stamp ahead of this clock is fresh for its own device (no re-stamp) and stays out of the prune; within the window nothing changes', async () => {
        const real = Date.now();
        device('A', PALM_URL);
        const key = ztoTrashModeDeviceKey();
        const old = real - ZTO_TRASH_MODE_ACTIVE_MS - HOUR;
        put(ZTO_TRASH_MODE_PATH, { palm: { [key]: real - HOUR, staledevice1: old } });
        firebaseState.serverTimeOffsetMs = 0;
        vi.spyOn(Date, 'now').mockReturnValue(real - 2 * HOUR);
        try {
            device('A');
            expect(markZtoTrashMode('palm'), 'own stamp ahead of this clock ➜ fresh').toBe(false);
            vi.mocked(Date.now).mockReturnValue(real);
            device('A');
            expect(markZtoTrashMode('palm'), 'within the window: own stamp an hour old ➜ fresh').toBe(false);
            expect(pruneZtoTrashMode(), 'the stale stamp of another device goes').toBe(1);
            await settle();
            expect(at(`${ZTO_TRASH_MODE_PATH}/palm`)).toEqual({ [key]: real - HOUR });
            put(`${ZTO_TRASH_MODE_PATH}/palm/${key}`, real - ZTO_TRASH_MODE_ACTIVE_MS - 1);
            device('N', null);
            expect(getShopZtoTrashMode(), 'older than the window ➜ local').toBe('local');
        } finally {
            vi.mocked(Date.now).mockRestore();
        }
    });

    it('stale stamps of any device are pruned (bounded per pass, CAS on the value seen); fresh and re-stamped ones stay', async () => {
        const now = getServerNow();
        const old = now - ZTO_TRASH_MODE_ACTIVE_MS - HOUR;
        const palm: Record<string, number> = { fresh0001: now - HOUR, moved0001: old };
        for (let i = 0; i < PRUNE_MAX + 2; i++) palm['stale000' + i] = old - i;
        put(ZTO_TRASH_MODE_PATH, { palm, cookie: { cstale001: old }, palmAt: old });
        const staleCount = () => stampsIn(at(ZTO_TRASH_MODE_PATH)).filter((v) => v <= old).length;
        const before = staleCount();
        expect(before).toBe(PRUNE_MAX + 5);
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        expect(pruneZtoTrashMode(), 'marker not arrived ➜ never prunes').toBe(0);
        device('N', null);
        expect(getShopZtoTrashMode()).toBe('palm');
        firebaseState.serverClockTrusted = false;
        expect(pruneZtoTrashMode(), 'server clock not trusted ➜ never prunes').toBe(0);
        firebaseState.serverClockTrusted = true;
        const api: any = firebaseState.fb, plain = api.runTransaction;
        let moved = false;
        api.runTransaction = async (r: any, update: any) => {
            if (r.path.endsWith('/moved0001') && !moved) { moved = true; put(r.path, now); }
            return plain(r, update);
        };
        expect(refreshZtoTrashModeMark(), 'a device without ZTO never stamps').toBe(false);
        expect(pruneZtoTrashMode(), 'the pass inside refreshZtoTrashModeMark() ran ➜ the next waits').toBe(0);
        await settle();
        const firstPass = before - staleCount();
        expect(firstPass, 'a pass prunes something').toBeGreaterThan(0);
        expect(firstPass, 'bounded per pass (a re-stamped key also leaves the stale set)').toBeLessThanOrEqual(PRUNE_MAX);
        let clock = Date.now();
        for (let pass = 0; pass < 6 && staleCount(); pass++) {
            clock += ZTO_TRASH_MODE_RETRY_MS + 1000;
            vi.spyOn(Date, 'now').mockReturnValue(clock);
            device('N');
            expect(pruneZtoTrashMode()).toBeLessThanOrEqual(PRUNE_MAX);
            await settle();
            vi.mocked(Date.now).mockRestore();
        }
        expect(staleCount(), 'every stale stamp gone after enough passes').toBe(0);
        expect(moved, 'the re-stamped key went through its CAS').toBe(true);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/moved0001`), 're-stamped meanwhile ➜ kept').toBe(now);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/fresh0001`), 'fresh stamp kept').toBe(now - HOUR);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palmAt`), 'stale legacy stamp pruned too').toBeNull();
        device('N');
        expect(getShopZtoTrashMode()).toBe('palm');
    });

    it('Palm ➜ Cookie, the withdrawal landed, back on Palm a minute later ➜ it stamps Palm again at once (leaving a mode clears its send gap)', async () => {
        device('A', PALM_URL);
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        const key = ztoTrashModeDeviceKey();
        device('A');
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await settle();
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${key}`), 'withdrawal landed').toBeNull();
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 1000);
        try {
            device('A');
            expect(storeLookupApiConfig(lookupCfg(PALM_URL))).toBe(true);
            expect(refreshZtoTrashModeMark(), 'a minute after its last Palm stamp ➜ stamps again without waiting for the send gap').toBe(true);
            await settle();
        } finally {
            vi.mocked(Date.now).mockRestore();
        }
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${key}`)).toBeGreaterThan(getServerNow() - HOUR);
        device('N', null);
        expect(getShopZtoTrashMode()).toBe('palm');
    });

    it('two installs sharing one device key (a copied profile · a restored PWA) never keep withdrawing each other\'s stamps: only a mode this install left is withdrawn, until it is gone', async () => {
        device('I1', PALM_URL);
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        const key = ztoTrashModeDeviceKey();
        pages.set('I2', { local: dumpLocal(), wrote: clone(ztoState.ztoTrashModeWrote) });
        device('I2', COOKIE_URL);
        expect(ztoTrashModeDeviceKey(), 'the copy carries the same key').toBe(key);
        let clock = Date.now();
        const withdrawals = () => writes.filter((w) => w.startsWith('del:' + ZTO_TRASH_MODE_PATH + '/')).length;
        for (let round = 0; round < 4; round++) {
            clock += ZTO_TRASH_MODE_RETRY_MS + 1000;
            vi.spyOn(Date, 'now').mockReturnValue(clock);
            try {
                device('I2');
                refreshZtoTrashModeMark();
                await settle();
                device('I1');
                refreshZtoTrashModeMark();
                await settle();
            } finally {
                vi.mocked(Date.now).mockRestore();
            }
        }
        expect(withdrawals(), 'no install ever withdraws a mode it never left').toBe(0);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${key}`)).toBeGreaterThan(0);
        expect(at(`${ZTO_TRASH_MODE_PATH}/cookie/${key}`)).toBeGreaterThan(0);
        device('N', null);
        expect(getShopZtoTrashMode()).toBe('palm');
        device('I1');
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await settle();
        expect(withdrawals(), 'I1 leaving Palm withdraws its own Palm stamp once').toBe(1);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${key}`)).toBeNull();
    });

    it('a Config change to another shop while the SDK still loads never writes into the old database (marker of the old shop · stale snapshot in the window)', async () => {
        device('A', PALM_URL);
        const OTHER = 'https://other.firebaseio.com';
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: OTHER }));
        writes = [];
        expect(refreshZtoTrashModeMark(), 'the marker belongs to the old shop').toBe(false);
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        firebaseState.isInitializingFirebase = true;
        try {
            noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
            appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(lookupCfg(PALM_URL)));
            expect(refreshZtoTrashModeMark(), 'a stale snapshot of the old database delivered while initFirebase() runs').toBe(false);
            expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
            await settle();
        } finally {
            firebaseState.isInitializingFirebase = false;
        }
        expect(writes, 'nothing written into the old database').toEqual([]);
        const otherDb = { name: 'other-shop' };
        firebaseState.db = otherDb as any;
        firebaseState.auth = { app: { options: { databaseURL: OTHER } }, currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
        expect(refreshZtoTrashModeMark(), 'the database of the new shop is up but its marker has not arrived').toBe(false);
        noteZtoTrashMode(null);
        expect(refreshZtoTrashModeMark(), 'the marker of the new shop arrived ➜ stamps there').toBe(true);
    });

    it('a stamp far ahead of the server clock (written outside the rules: Console · import) is read as active until the trusted clock prunes it; a stamp just ahead stays', async () => {
        const now = getServerNow();
        const far = now + 2 * 24 * HOUR, near = now + 30 * 60 * 1000;
        put(ZTO_TRASH_MODE_PATH, { palm: { futuredv1: far, nearfut1: near } });
        device('N', null);
        expect(getShopZtoTrashMode(), 'fail closed until pruned').toBe('palm');
        firebaseState.serverClockTrusted = false;
        expect(pruneZtoTrashMode(), 'server clock not trusted ➜ kept').toBe(0);
        firebaseState.serverClockTrusted = true;
        expect(pruneZtoTrashMode(), 'more than a day ahead ➜ pruned').toBe(1);
        await settle();
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm`)).toEqual({ nearfut1: near });
    });

    it('rules that refuse a trash-mode write leave one Sentry signal per session (zone data) and pause that database; a network failure neither', async () => {
        const capture = (window as any).ZoeErrors.capture as ReturnType<typeof vi.fn>;
        device('A', PALM_URL);
        const key = ztoTrashModeDeviceKey();
        const api: any = firebaseState.fb;
        const sent: string[] = [];
        let failure: any = Object.assign(new Error('Network error'), { code: 'disconnect' });
        api.runTransaction = async (r: any) => { sent.push(r.path.slice(ZTO_TRASH_MODE_PATH.length + 1)); throw failure; };
        let clock = Date.now();
        vi.spyOn(Date, 'now').mockImplementation(() => clock);
        const refreshAt = async (ms: number) => {
            clock += ms;
            device('A');
            refreshZtoTrashModeMark();
            await settle();
        };
        await refreshAt(0);
        expect(capture, 'a network failure is no rollout signal').not.toHaveBeenCalled();
        await refreshAt(ZTO_TRASH_MODE_RETRY_MS + 1000);
        expect(sent, 'a network failure never pauses the database: sent again after the retry gap').toEqual([`palm/${key}`, `palm/${key}`]);
        failure = Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });
        sent.length = 0;
        await refreshAt(ZTO_TRASH_MODE_RETRY_MS + 1000);
        expect(sent, 'refused ➜ one legacy stamp beside it').toEqual([`palm/${key}`, 'palmAt']);
        expect(capture).toHaveBeenCalledTimes(1);
        expect(capture.mock.calls[0][1]).toMatchObject({ zone: 'data', context: expect.stringMatching(/trash-mode stamp refused/) });
        sent.length = 0;
        await refreshAt(ZTO_TRASH_MODE_RETRY_MS + 1000);
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await settle();
        firebaseState.authGeneration++;
        await refreshAt(ZTO_TRASH_MODE_RETRY_MS + 1000);
        expect(sent, 'the database stays paused (stamp · withdrawal · legacy), a new session included').toEqual([]);
        expect(capture).toHaveBeenCalledTimes(1);
        await refreshAt(ZTO_TRASH_MODE_REFUSED_RETRY_MS);
        expect(sent, 'after the pause ➜ one more try of the per-device stamp, then the legacy one').toEqual([`cookie/${key}`, 'cookieAt']);
        expect(capture, 'a new session reports again').toHaveBeenCalledTimes(2);
    });

    it('local storage that accepts a write without keeping it (no error) ➜ the read-back keeps the key in the session store; the key never changes within the page', async () => {
        const localSet = vi.spyOn(appLocalStore as any, 'setItem').mockImplementation(() => {});
        try {
            const first = ztoTrashModeDeviceKey();
            expect(first).toMatch(/^[a-z0-9]{8,32}$/);
            expect(ztoTrashModeDeviceKey()).toBe(first);
            expect(appLocalStore.getItem(DEVICE_STORE)).toBeNull();
            expect(storedDevices(appSessionStore)).toEqual({ [SHOP]: first });
        } finally {
            localSet.mockRestore();
        }
    });

    it('stale stamps whose delete keeps failing never starve the rest (the batch rotates)', async () => {
        const old = getServerNow() - ZTO_TRASH_MODE_ACTIVE_MS - HOUR;
        const palm: Record<string, number> = {};
        for (let i = 0; i < PRUNE_MAX * 2; i++) palm['stale00' + String(i).padStart(2, '0')] = old;
        put(ZTO_TRASH_MODE_PATH, { palm });
        const stuck = new Set(Object.keys(palm).sort().slice(0, PRUNE_MAX));
        const api: any = firebaseState.fb, plain = api.runTransaction;
        api.runTransaction = async (r: any, update: any) => {
            if (stuck.has(String(r.path).split('/').at(-1))) throw new Error('network');
            return plain(r, update);
        };
        let clock = Date.now();
        for (let pass = 0; pass < 4; pass++) {
            clock += ZTO_TRASH_MODE_RETRY_MS + 1000;
            vi.spyOn(Date, 'now').mockReturnValue(clock);
            device('N', null);
            pruneZtoTrashMode();
            await settle();
            vi.mocked(Date.now).mockRestore();
        }
        expect(Object.keys(at(`${ZTO_TRASH_MODE_PATH}/palm`)).sort()).toEqual([...stuck].sort());
    });
});

describe('FIXSHOP-3 ៖ ត្រារបៀបធុងសំរាម ↔ journal ការសរសេរ', () => {
    const turn = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
    const journalRows = () => Object.keys(localStorage).filter((k) => k.startsWith('zoew_connection_writes_v1:'));
    function nativeLab(update: any, transaction: any, onValue: any = () => () => {}) {
        const app = { options: { databaseURL: SHOP } };
        const auth = { app, currentUser: { uid: 'A', getIdToken: async () => 'fake-token' } };
        const ndb = { app };
        const raw = { getAuth: () => auth, getDatabase: () => ndb, ref: (_db: any, path = '') => ({ path, toString: () => SHOP + '/' + path }),
            update, set: update, runTransaction: transaction, onValue, off: () => {}, deleteApp: async () => {} };
        const sdk: any = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
        Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db: ndb, isDatabaseInitialized: true,
            isInitializingFirebase: false, firebaseSdkUnavailable: false, sessionExpiryCheck: 'live', authLoginOperation: null });
        firebaseState.dbRefZtoTrashMode = sdk.ref(ndb, ZTO_TRASH_MODE_PATH);
        return { sdk, db: ndb, app };
    }

    it('Palm ➜ Cookie saved offline while the marker is pending journals nothing ➜ a reopen whose recovery read the rules refuse never blocks later writes; the withdrawal goes once the marker arrives', async () => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(lookupCfg(PALM_URL)));
        const key = ztoTrashModeDeviceKey();
        const sent: string[] = [];
        const first = nativeLab(vi.fn(() => new Promise(() => {})), (r: any, update: any) => { sent.push(r.path); update(null); return new Promise(() => {}); });
        firebaseState.isDatabaseConnected = false;
        resetZtoTrashMode();
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        expect(ztoState.ztoTrashMode.state).toBe('pending');
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await turn(); await settle();
        const offline = { sent: sent.slice(), rows: journalRows().length };
        await first.sdk.deleteApp(first.app);
        vi.stubGlobal('fetch', async () => new Response('{"error":"Permission denied"}', { status: 401 }));
        const dispatched = vi.fn(async () => {});
        const committed: string[] = [];
        const second = nativeLab(dispatched, async (r: any, update: any) => { const next = update(null); committed.push(r.path); return { committed: true, snapshot: { val: () => next } }; });
        firebaseState.isDatabaseConnected = true;
        const verdict = await second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4300).then(() => 'sent', (e: any) => e.code || e.message);
        expect({ offline, verdict, blocked: nativeWriteRecoveryState(second.db).blocked }, 'nothing journaled while the marker was pending ➜ nothing to block')
            .toEqual({ offline: { sent: [], rows: 0 }, verdict: 'sent', blocked: 0 });
        resetZtoTrashMode();
        attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
        noteZtoTrashMode({ palm: { [key]: getServerNow() - HOUR } });
        refreshZtoTrashModeMark();
        await turn(); await settle();
        expect(committed, 'the marker arrived (its read is allowed) ➜ the withdrawal of the mode it left goes · its current mode is stamped')
            .toEqual([`${ZTO_TRASH_MODE_PATH}/palm/${key}`, `${ZTO_TRASH_MODE_PATH}/cookie/${key}`]);
        expect(journalRows()).toEqual([]);
    });
});

describe('FIXSHOP-3 review 4 ៖ rollout before the rules · advisory writes · reconfig window', () => {
    const WITHDRAW_STORE = 'zoew_trash_mode_withdraw_v1';
    const deletes = () => writes.filter((w) => w.startsWith('del:' + ZTO_TRASH_MODE_PATH + '/'));
    const intents = () => JSON.parse(appLocalStore.getItem(WITHDRAW_STORE) || '[]');
    const refusing = () => Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });
    const perDevice = (path: string) => /\/zto_trash_mode\/(palm|cookie)\//.test(path);

    it('rules that refuse per-device stamps (older rules): one refused send per pause, one legacy stamp the older rules accept ➜ a device without ZTO still resolves Palm', async () => {
        const api: any = firebaseState.fb, plainTx = api.runTransaction, plainUpdate = api.update;
        let refused = 0, legacy = 0;
        api.runTransaction = async (r: any, update: any) => {
            if (perDevice(r.path)) { refused++; throw refusing(); }
            const res = await plainTx(r, update);
            if (r.path.endsWith('/palmAt') && at(r.path) !== null) legacy++;
            return res;
        };
        api.update = async (r: any, patch: any) => {
            if (Object.keys(patch).some((k) => perDevice(r.path + '/' + k))) { refused++; throw refusing(); }
            return plainUpdate(r, patch);
        };
        put(ZTO_TRASH_MODE_PATH, { palmAt: getServerNow() - 8 * 24 * HOUR });
        let clock = Date.now();
        vi.spyOn(Date, 'now').mockImplementation(() => clock);
        for (let gap = 0; gap < 12; gap++) {
            clock += ZTO_TRASH_MODE_RETRY_MS + 1000;
            device('A', PALM_URL);
            refreshZtoTrashModeMark();
            await settle();
        }
        expect(refused, 'an hour of refreshes ➜ one refused send').toBeLessThanOrEqual(1);
        expect(legacy, 'one legacy stamp, never resent while it is fresh').toBe(1);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palmAt`), 'server basis').toBeGreaterThan(getServerNow() - HOUR);
        device('N', null);
        expect(getShopZtoTrashMode(), 'the shop mode still spreads').toBe('palm');
        expect((window as any).ZoeErrors.capture).toHaveBeenCalledTimes(1);
    });

    it('rules that refuse every trash-mode write (no node in the rules at all): ≤ 2 refused sends per pause; a legacy stamp lost to the network is sent ≤ 1 per retry gap', async () => {
        const api: any = firebaseState.fb;
        const sent: string[] = [];
        let legacyFailure: any = refusing();
        api.runTransaction = async (r: any) => {
            sent.push(r.path.slice(ZTO_TRASH_MODE_PATH.length + 1));
            throw perDevice(r.path) ? refusing() : legacyFailure;
        };
        let clock = Date.now();
        vi.spyOn(Date, 'now').mockImplementation(() => clock);
        for (let gap = 0; gap < 12; gap++) {
            clock += ZTO_TRASH_MODE_RETRY_MS + 1000;
            device('A', PALM_URL);
            refreshZtoTrashModeMark();
            refreshZtoTrashModeMark();
            await settle();
        }
        expect(sent.length, JSON.stringify(sent)).toBeLessThanOrEqual(2);
        clock += ZTO_TRASH_MODE_REFUSED_RETRY_MS;
        legacyFailure = Object.assign(new Error('Network error'), { code: 'disconnect' });
        sent.length = 0;
        for (let gap = 0; gap < 3; gap++) {
            clock += ZTO_TRASH_MODE_RETRY_MS + 1000;
            device('A', PALM_URL);
            refreshZtoTrashModeMark();
            refreshZtoTrashModeMark();
            await settle();
        }
        expect(sent.filter((p) => p === 'palmAt'), 'legacy lost to the network ➜ once per retry gap').toHaveLength(3);
        expect(sent.filter((p) => p !== 'palmAt'), 'the per-device stamp is refused once, then paused').toHaveLength(1);
    });

    it('the pause holds the prune too, belongs to its own database only, and a refusal answered while offline sends no legacy stamp', async () => {
        const api: any = firebaseState.fb, plain = api.runTransaction;
        const old = getServerNow() - ZTO_TRASH_MODE_ACTIVE_MS - HOUR;
        put(ZTO_TRASH_MODE_PATH, { palm: { stale0001: old } });
        let release: (() => void) | null = null;
        api.runTransaction = (r: any, update: any) => (perDevice(r.path) && !r.path.endsWith('/stale0001')
            ? new Promise((_, reject) => { release = () => reject(refusing()); }) : plain(r, update));
        device('A', PALM_URL);
        expect(markZtoTrashMode('palm')).toBe(true);
        await settle();
        firebaseState.isDatabaseConnected = false;
        writes = [];
        release!();
        await settle();
        expect(writes, 'refused while offline ➜ no legacy stamp queued').toEqual([]);
        firebaseState.isDatabaseConnected = true;
        device('A');
        expect(pruneZtoTrashMode(), 'paused database ➜ no prune').toBe(0);
        expect(markZtoTrashMode('palm'), 'paused ➜ legacy instead').toBe(true);
        await settle();
        expect(writes).toEqual([`tx:${ZTO_TRASH_MODE_PATH}/palmAt`]);
        api.runTransaction = plain;
        db = { name: 'shop-trash-mode-devices-other' };
        firebaseState.db = db;
        (ztoState as any).ztoTrashModeWrote = { palmAt: 0, cookieAt: 0 };
        device('A');
        writes = [];
        expect(pruneZtoTrashMode(), 'another database is not paused').toBe(1);
        expect(markZtoTrashMode('palm')).toBe(true);
        await settle();
        expect(writes.sort()).toEqual([`del:${ZTO_TRASH_MODE_PATH}/palm/stale0001`, `tx:${ZTO_TRASH_MODE_PATH}/palm/${ztoTrashModeDeviceKey()}`].sort());
    });

    it('a refusal that lands after a session switch never pauses the new session nor stamps anything into it', async () => {
        device('A', PALM_URL);
        const api: any = firebaseState.fb, plain = api.runTransaction;
        let release: (() => void) | null = null;
        api.runTransaction = (r: any, update: any) => (perDevice(r.path)
            ? new Promise((_, reject) => { release = () => reject(refusing()); }) : plain(r, update));
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        firebaseState.authGeneration++;
        db = { name: 'shop-trash-mode-devices-next' };
        firebaseState.db = db;
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
        writes = [];
        release!();
        await settle();
        api.runTransaction = plain;
        expect(writes, 'no legacy stamp from the old session').toEqual([]);
        expect((window as any).ZoeErrors.capture, 'no rollout signal for a refusal of the old session').not.toHaveBeenCalled();
        (ztoState as any).ztoTrashModeWrote = { palmAt: 0, cookieAt: 0 };
        expect(refreshZtoTrashModeMark(), 'the new session is not paused').toBe(true);
        await settle();
        expect(writes).toEqual([`tx:${ZTO_TRASH_MODE_PATH}/palm/${ztoTrashModeDeviceKey()}`]);
    });

    it('Supabase shop whose migration is not applied: a refused per-device stamp after a lost reply leaves no journal row, sends one legacy stamp, and the next session writes normally', async () => {
        const SB_URL = 'https://p.supabase.co';
        const rows = new Map<string, any>();
        const journal = { put: (row: any) => { rows.set(row.opId, structuredClone(row)); return true; },
            list: (scope: string, topic: string) => [...rows.values()].filter((x) => x.scope === scope && x.topic === topic),
            remove: (_s: string, _t: string, id: string) => rows.delete(id) };
        const hooks = () => ({ onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() });
        const pull = { seq: 1, more: false, reset: true, tenant: 'A', rows: [] };
        const sent: Array<{ path: string; v: any }> = [];
        let palmTries = 0;
        const hook = hooks();
        const sb: any = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
            if (fn !== 'zoe_write') return { ...pull, now: Date.now() };
            const path = args.p_ops[0].p.join('/');
            sent.push({ path, v: args.p_ops[0].v });
            if (path.includes('/palm/')) {
                if (++palmTries === 1) throw new SbNetworkError('rpc timed out');
                throw new SbRpcError('new row violates rules', '42501', 403, '');
            }
            return { ok: true, docs: [], now: Date.now() };
        } }, hook, { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 600000 });
        sb.setTenantTopic('zoe:A'); sb.setAuthed(true, 'project|user');
        for (let i = 0; i < 60; i++) await Promise.resolve();
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: SB_URL, supabaseKey: 'sb_publishable_x' }));
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(lookupCfg(PALM_URL)));
        firebaseState.db = sb;
        firebaseState.fb = { __supabase: true, tenantScope: () => 'A', ref: (d: any, path: string) => d.ref(path),
            runTransaction: (r: any, fn: any) => r._db.runTransaction(r, fn), update: (r: any, v: any) => r._db.update(r, v),
            onValue: () => () => {}, off: () => {} } as any;
        firebaseState.auth = { app: { options: { supabaseUrl: SB_URL } }, currentUser: { uid: 'user' } } as any;
        firebaseState.dbRefZtoTrashMode = sb.ref(ZTO_TRASH_MODE_PATH);
        resetZtoTrashMode();
        noteZtoTrashMode(null);
        expect(refreshZtoTrashModeMark()).toBe(true);
        await new Promise((r) => setTimeout(r, 80));
        await settle();
        const left = [...rows.values()].map((r) => r.stage);
        sb.close('test');
        const legacy = sent.find((w) => w.path === ZTO_TRASH_MODE_PATH + '/palmAt');
        const next: any = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string) => (fn === 'zoe_write'
            ? { ok: true, docs: [], now: Date.now() } : { ...pull, now: Date.now() }) }, hooks(), { writeJournal: journal });
        next.setTenantTopic('zoe:A'); next.setAuthed(true, 'project|user');
        for (let i = 0; i < 60; i++) await Promise.resolve();
        const later = await next.set(next.ref('zoew_settings/exchange_rate'), 4200).then(() => 'sent', (e: any) => e.code || e.message);
        const blocked = next.recoveryState().blocked;
        next.close('test');
        expect({ palmTries, left, legacy: !!legacy, unknownReported: hook.onTxOutcomeUnknown.mock.calls.length, later, blocked })
            .toEqual({ palmTries: 2, left: [], legacy: true, unknownReported: 0, later: 'sent', blocked: 0 });
        resetZtoTrashMode();
        noteZtoTrashMode({ palmAt: legacy!.v });
        appLocalStore.removeItem('zoew_lookup_api_config');
        expect(getShopZtoTrashMode(), 'a device without ZTO reads the legacy stamp').toBe('palm');
    });

    for (const op of ['prune', 'withdraw'] as const) {
        it(`a ${op} cut by a disconnect while the server holds a third value is not applied (witness) ➜ no blocked writes, no money alert`, async () => {
            const app = { options: { databaseURL: SHOP } };
            const auth = { app, currentUser: { uid: 'A', getIdToken: async () => 'tok' } };
            const ndb = { app };
            const old = getServerNow() - ZTO_TRASH_MODE_ACTIVE_MS - HOUR;
            const raw: any = { getAuth: () => auth, getDatabase: () => ndb, ref: (_d: any, path = '') => ({ path, toString: () => SHOP + '/' + path }),
                update: vi.fn(async () => {}), set: vi.fn(async () => {}), onValue: () => () => {}, off: () => {}, deleteApp: async () => {},
                runTransaction: async (_r: any, update: any) => { update(old); throw Object.assign(new Error('disconnect'), { code: 'disconnect' }); } };
            const sdk: any = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
            Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db: ndb, isDatabaseInitialized: true, isInitializingFirebase: false,
                firebaseSdkUnavailable: false, isDatabaseConnected: true, serverClockTrusted: true, hasEverConnectedToDatabase: true, sessionExpiryCheck: 'live', authLoginOperation: null });
            firebaseState.dbRefZtoTrashMode = sdk.ref(ndb, ZTO_TRASH_MODE_PATH);
            vi.stubGlobal('fetch', async () => new Response(JSON.stringify(getServerNow()), { status: 200 }));
            appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(lookupCfg(COOKIE_URL)));
            const key = ztoTrashModeDeviceKey();
            resetZtoTrashMode();
            noteZtoTrashMode({ palm: op === 'prune' ? { staledev1: old } : { [key]: old + ZTO_TRASH_MODE_ACTIVE_MS } });
            if (op === 'prune') expect(pruneZtoTrashMode()).toBe(1);
            else expect(withdrawZtoTrashMode('palm')).toBe(true);
            for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 0));
            const later = await sdk.set(sdk.ref(ndb, 'zoew_settings/exchange_rate'), 4300).then(() => 'sent', (e: any) => e.code || e.message);
            const money = ((window as any).ZoeErrors.capture as any).mock.calls.filter((c: any) => c[1] && c[1].zone === 'money');
            expect({ blocked: nativeWriteRecoveryState(ndb).blocked, later, money: money.length }).toEqual({ blocked: 0, later: 'sent', money: 0 });
        });
    }

    it('a Reconfig whose new SDK cannot load (the old backend still delivers a late snapshot) never writes the new shop\'s key into the old database', async () => {
        const SB_URL = 'https://p.supabase.co';
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: SB_URL, supabaseKey: 'sb_publishable_x' }));
        (firebaseState.fb as any).tenantScope = () => 'tenantA';
        firebaseState.auth = { app: { options: { supabaseUrl: SB_URL } }, currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(lookupCfg(PALM_URL)));
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
        expect(refreshZtoTrashModeMark(), 'the Supabase shop stamps').toBe(true);
        await settle();
        appLocalStore.setItem('zoew_firebase_config', SHOP_CONFIG);
        firebaseState.firebaseConfig = { databaseURL: SHOP } as any;
        firebaseState.firebaseSdkUnavailable = true;
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...lookupCfg(PALM_URL), shop: SHOP }));
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
        expect(ztoState.ztoTrashMode.shop, 'the late snapshot is labelled with the stored (new) shop').toBe(SHOP);
        writes = [];
        (ztoState as any).ztoTrashModeWrote = { palmAt: 0, cookieAt: 0 };
        expect(refreshZtoTrashModeMark(), 'SDK unavailable').toBe(false);
        firebaseState.firebaseSdkUnavailable = false;
        expect(refreshZtoTrashModeMark(), 'the active backend is still the old Supabase shop').toBe(false);
        await settle();
        expect(writes, 'nothing written into the old database').toEqual([]);
        firebaseState.auth = { app: { options: { databaseURL: SHOP } }, currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
        firebaseState.firebaseSdkUnavailable = true;
        expect(refreshZtoTrashModeMark(), 'the backend names the shop but initFirebase() reports the SDK unavailable').toBe(false);
        firebaseState.firebaseSdkUnavailable = false;
        expect(refreshZtoTrashModeMark(), 'the backend of the stored shop is up').toBe(true);
    });

    it('offline ➜ no trash-mode write is queued (a stamp queued offline would outlive the app); connected again ➜ it stamps', async () => {
        device('A', PALM_URL);
        firebaseState.isDatabaseConnected = false;
        expect(refreshZtoTrashModeMark()).toBe(false);
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        expect(storeLookupApiConfig(lookupCfg(PALM_URL))).toBe(true);
        await settle();
        expect(writes, 'nothing sent or queued while offline').toEqual([]);
        firebaseState.isDatabaseConnected = true;
        device('A');
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${ztoTrashModeDeviceKey()}`)).toBeGreaterThan(0);
    });

    it('G1 Palm ➜ Cookie (withdrawal lost) ➜ back on Palm: the refresh never withdraws the Palm stamp it uses now', async () => {
        device('A', PALM_URL);
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        const key = ztoTrashModeDeviceKey();
        const api: any = firebaseState.fb, plain = api.runTransaction;
        api.runTransaction = async () => { throw Object.assign(new Error('Network error'), { code: 'disconnect' }); };
        device('A');
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await settle();
        api.runTransaction = plain;
        device('A');
        expect(storeLookupApiConfig(lookupCfg(PALM_URL))).toBe(true);
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + ZTO_TRASH_MODE_RETRY_MS + 1000);
        try { device('A'); refreshZtoTrashModeMark(); await settle(); } finally { vi.mocked(Date.now).mockRestore(); }
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${key}`), 'its current Palm stamp stays').toBeGreaterThan(0);
        expect(intents(), 'the stale intent of the mode it uses again is dropped').toEqual([]);
    });

    it('G2 an intent of another shopScope() is neither sent nor dropped here', async () => {
        device('A', PALM_URL);
        const OTHER = 'https://other.firebaseio.com';
        appLocalStore.setItem(WITHDRAW_STORE, JSON.stringify([{ shop: OTHER, path: 'palm/abcdefgh12345678' }, { shop: OTHER, path: 'cookie/abcdefgh12345678' }]));
        put(`${ZTO_TRASH_MODE_PATH}/cookie/abcdefgh12345678`, getServerNow() - HOUR);
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
        writes = [];
        refreshZtoTrashModeMark();
        await settle();
        expect(deletes()).toEqual([]);
        expect(intents()).toEqual([{ shop: OTHER, path: 'palm/abcdefgh12345678' }, { shop: OTHER, path: 'cookie/abcdefgh12345678' }]);
    });

    it('G3 a marker of the old shop never prunes after a Config change', async () => {
        const old = getServerNow() - ZTO_TRASH_MODE_ACTIVE_MS - HOUR;
        put(ZTO_TRASH_MODE_PATH, { palm: { stale0001: old } });
        device('N', null);
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
        writes = [];
        expect(pruneZtoTrashMode()).toBe(0);
        await settle();
        expect(writes).toEqual([]);
    });

    it('G4 Supabase: a marker that arrived before the account (shop unknown) is used once the shop is known on the same database', async () => {
        device('A', PALM_URL);
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: 'https://p.supabase.co', supabaseKey: 'sb_publishable_x' }));
        (firebaseState as any).auth = { app: { options: { supabaseUrl: 'https://p.supabase.co' } }, currentUser: { uid: 'u1' } };
        let tenant = '';
        (firebaseState.fb as any).tenantScope = () => tenant;
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(lookupCfg(PALM_URL)));
        noteZtoTrashMode(null);
        expect(ztoState.ztoTrashMode.shop).toBe('');
        expect(refreshZtoTrashModeMark(), 'account not arrived ➜ no shop, no write').toBe(false);
        tenant = 'tenantA';
        expect(refreshZtoTrashModeMark(), 'account arrived ➜ stamps').toBe(true);
    });

    it('an intent whose key is gone from the marker is dropped without a write', async () => {
        device('A', COOKIE_URL);
        const key = ztoTrashModeDeviceKey();
        appLocalStore.setItem(WITHDRAW_STORE, JSON.stringify([{ shop: SHOP, path: `palm/${key}` }]));
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
        writes = [];
        refreshZtoTrashModeMark();
        await settle();
        expect(deletes()).toEqual([]);
        expect(intents()).toEqual([]);
    });

    it('a withdrawal still in flight is never sent a second time, even past the retry gap', async () => {
        device('A', PALM_URL);
        refreshZtoTrashModeMark();
        await settle();
        const key = ztoTrashModeDeviceKey();
        const api: any = firebaseState.fb, plain = api.runTransaction;
        let sent = 0;
        let release: (() => void) | null = null;
        api.runTransaction = (r: any, update: any) => (r.path.endsWith('/palm/' + key)
            ? (sent++, new Promise((_, reject) => { release = () => reject(new Error('disconnect')); })) : plain(r, update));
        device('A');
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await settle();
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + ZTO_TRASH_MODE_RETRY_MS + 1000);
        try { device('A'); refreshZtoTrashModeMark(); await settle(); } finally { vi.mocked(Date.now).mockRestore(); }
        api.runTransaction = plain;
        const inFlight = sent;
        release!();
        await settle();
        expect(inFlight).toBe(1);
        expect(intents(), 'kept until it lands').toEqual([{ shop: SHOP, path: `palm/${key}` }]);
    });

    it('the stored intents stay bounded (oldest first out) and the newest is kept', () => {
        const MAX: number = (trashMode as any).ZTO_TRASH_MODE_WITHDRAW_MAX;
        device('A', PALM_URL);
        const key = ztoTrashModeDeviceKey();
        appLocalStore.setItem(WITHDRAW_STORE, JSON.stringify(Array.from({ length: MAX + 4 }, (_, i) => ({ shop: 'https://s' + i + '.firebaseio.com', path: 'palm/abcdefgh' + String(i).padStart(4, '0') }))));
        withdrawZtoTrashMode('palm');
        const kept = intents();
        expect(kept).toHaveLength(MAX);
        expect(kept.at(-1)).toEqual({ shop: SHOP, path: `palm/${key}` });
        expect(kept.some((row: any) => row.shop === 'https://s0.firebaseio.com'), 'the oldest left').toBe(false);
    });

    it('storage that refuses the intent list keeps it in page memory ➜ a lost withdrawal is still sent again', async () => {
        device('A', PALM_URL);
        refreshZtoTrashModeMark();
        await settle();
        const key = ztoTrashModeDeviceKey();
        const realSet = appLocalStore.setItem.bind(appLocalStore);
        const blockIntents = vi.spyOn(appLocalStore as any, 'setItem').mockImplementation((k: any, v: any) => {
            if (k === WITHDRAW_STORE) throw new Error('QuotaExceededError');
            realSet(k, v);
        });
        const api: any = firebaseState.fb, plain = api.runTransaction;
        let sent = 0;
        api.runTransaction = async (r: any, update: any) => {
            if (!r.path.endsWith('/palm/' + key)) return plain(r, update);
            if (++sent === 1) throw Object.assign(new Error('disconnect'), { code: 'disconnect' });
            return plain(r, update);
        };
        try {
            expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
            await settle();
            expect(appLocalStore.getItem(WITHDRAW_STORE)).toBeNull();
            vi.spyOn(Date, 'now').mockReturnValue(Date.now() + ZTO_TRASH_MODE_RETRY_MS + 1000);
            device('A');
            refreshZtoTrashModeMark();
            await settle();
        } finally {
            api.runTransaction = plain;
            blockIntents.mockRestore();
        }
        expect(sent).toBe(2);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palm/${key}`)).toBeNull();
    });
});

describe('FIXSHOP-3 review 5 ៖ advisory transactions on Firebase · late refusals · reconfig gates · server basis', () => {
    const journalRows = () => Object.keys(localStorage).filter((k) => k.startsWith('zoew_connection_writes_v1:'));
    const refusing = () => Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });
    const perDevice = (path: string) => /\/zto_trash_mode\/(palm|cookie)\//.test(path);
    const money = () => ((window as any).ZoeErrors.capture as any).mock.calls.filter((c: any) => c[1] && c[1].zone === 'money').length;
    function lab(runTransaction: any) {
        const app = { options: { databaseURL: SHOP } };
        const user = () => ({ uid: 'A', getIdToken: async () => 'tok' });
        const auth: any = { app, currentUser: user() };
        const ndb = { app };
        const raw: any = { getAuth: () => auth, getDatabase: () => ndb, ref: (_d: any, path = '') => ({ path, toString: () => SHOP + '/' + path }),
            update: vi.fn(async () => {}), set: vi.fn(async () => {}), onValue: () => () => {}, off: () => {}, deleteApp: async () => {},
            signOut: async () => { auth.currentUser = null; }, signInWithEmailAndPassword: async () => { auth.currentUser = user(); }, runTransaction };
        const sdk: any = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
        Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db: ndb, isDatabaseInitialized: true, isInitializingFirebase: false,
            firebaseSdkUnavailable: false, isDatabaseConnected: true, serverClockTrusted: true, hasEverConnectedToDatabase: true, sessionExpiryCheck: 'live', authLoginOperation: null });
        firebaseState.dbRefZtoTrashMode = sdk.ref(ndb, ZTO_TRASH_MODE_PATH);
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(lookupCfg(PALM_URL)));
        resetZtoTrashMode();
        noteZtoTrashMode(null);
        return { sdk, db: ndb, auth };
    }
    const failing = (thrown: any[], make: () => any) => async (_r: any, update: any) => { update(null); const e = make(); thrown.push(e); throw e; };
    const disconnect = () => Object.assign(new Error('disconnect'), { code: 'disconnect' });
    function laterWrite(l: any) {
        vi.useRealTimers();
        const write = l.sdk.set(l.sdk.ref(l.db, 'zoew_settings/exchange_rate'), 4300).then(() => 'sent', (e: any) => e.code || e.message);
        return Promise.race([write, new Promise((r) => setTimeout(() => r('waiting'), 3000))]);
    }

    it('P1 an advisory trash-mode transaction cut by a disconnect whose outcome read the rules would refuse 30× ends not-applied at once: no REST read · no money signal · no blocked write · no journal row', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        try {
            let reads = 0;
            vi.stubGlobal('fetch', async () => { reads++; return new Response('{"error":"Permission denied"}', { status: 401 }); });
            const thrown: any[] = [];
            const l = lab(failing(thrown, disconnect));
            expect(markZtoTrashMode('palm')).toBe(true);
            await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
            const later = await laterWrite(l);
            expect({ reads, outcome: thrown[0] && thrown[0].txOutcome, money: money(), blocked: nativeWriteRecoveryState(l.db).blocked, rows: journalRows().length, later })
                .toEqual({ reads: 0, outcome: 'not-applied', money: 0, blocked: 0, rows: 0, later: 'sent' });
        } finally { vi.useRealTimers(); }
    });

    it('P1 control ៖ a journaled (non-advisory) transaction with the same refused reads stays unknown, raises the money signal and blocks', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        try {
            let reads = 0;
            vi.stubGlobal('fetch', async () => { reads++; return new Response('{"error":"Permission denied"}', { status: 401 }); });
            const thrown: any[] = [];
            const l = lab(failing(thrown, disconnect));
            const verdict = l.sdk.runTransaction(l.sdk.ref(l.db, 'zoew_settings/review5_control'), () => 7).then(() => 'sent', (e: any) => e.txOutcome);
            await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
            expect({ reads, outcome: await verdict, money: money(), blocked: nativeWriteRecoveryState(l.db).blocked })
                .toEqual({ reads: 30, outcome: 'unknown', money: 1, blocked: 1 });
        } finally { vi.useRealTimers(); }
    });

    for (const cut of ['reconfig', 'logout'] as const) {
        it(`P${cut === 'reconfig' ? 2 : 3} a ${cut} while the outcome read of an advisory transaction fails on the network leaves no money signal and no journal row; back on the same shop and account the next write is sent`, async () => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
                const thrown: any[] = [];
                const first = lab(failing(thrown, disconnect));
                expect(markZtoTrashMode('palm')).toBe(true);
                await vi.advanceTimersByTimeAsync(10000);
                if (cut === 'reconfig') {
                    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
                    firebaseState.authGeneration++;
                } else {
                    await first.sdk.signOut(first.auth);
                    firebaseState.authGeneration++;
                }
                await vi.advanceTimersByTimeAsync(60000);
                const atCut = { outcome: thrown[0] && thrown[0].txOutcome, money: money(), rows: journalRows().length };
                let next = first;
                if (cut === 'reconfig') {
                    appLocalStore.setItem('zoew_firebase_config', SHOP_CONFIG);
                    next = lab(async (_r: any, update: any) => ({ committed: true, snapshot: { val: () => update(null) } }));
                } else {
                    await first.sdk.signInWithEmailAndPassword(first.auth, 'a@zoew1.com', 'pw');
                }
                firebaseState.authGeneration++;
                const later = await laterWrite(next);
                expect({ ...atCut, later, blocked: nativeWriteRecoveryState(next.db).blocked })
                    .toEqual({ outcome: 'not-applied', money: 0, rows: 0, later: 'sent', blocked: 0 });
            } finally { vi.useRealTimers(); }
        });
    }

    for (const reason of ['maxretry', 'set', 'frozen']) {
        it(`P4 an advisory transaction the SDK aborts (${reason}) is not-applied: its journal row is dropped, nothing blocks, no money signal`, async () => {
            const thrown: any[] = [];
            const l = lab(failing(thrown, () => (reason === 'frozen' ? Object.freeze(new Error('maxretry')) : new Error(reason))));
            expect(markZtoTrashMode('palm')).toBe(true);
            await settle();
            const later = await laterWrite(l);
            expect({ outcome: thrown[0] && thrown[0].txOutcome, money: money(), blocked: nativeWriteRecoveryState(l.db).blocked, rows: journalRows().length, later },
                'an error the app cannot annotate (frozen) is still dropped by the journal')
                .toEqual({ outcome: reason === 'frozen' ? undefined : 'not-applied', money: 0, blocked: 0, rows: 0, later: 'sent' });
        });
    }

    it('P4 control ៖ an advisory write the rules refuse stays a plain refusal (no txOutcome), the same answer as the Supabase adapter; nothing blocks', async () => {
        const thrown: any[] = [];
        const l = lab(failing(thrown, refusing));
        expect(markZtoTrashMode('palm')).toBe(true);
        await settle();
        const later = await laterWrite(l);
        expect({ code: thrown[0] && thrown[0].code, outcome: thrown[0] && thrown[0].txOutcome, blocked: nativeWriteRecoveryState(l.db).blocked, rows: journalRows().length, later })
            .toEqual({ code: 'PERMISSION_DENIED', outcome: undefined, blocked: 0, rows: 0, later: 'sent' });
    });

    it('a device clock 2 h behind the server keeps the send gaps on the device clock: a stamp and a legacy stamp lost to the network go ≤ 1 per retry gap', async () => {
        firebaseState.serverTimeOffsetMs = 2 * HOUR;
        device('A', PALM_URL);
        const api: any = firebaseState.fb;
        const sent: string[] = [];
        let perDeviceFailure: any = disconnect();
        api.runTransaction = async (r: any) => {
            sent.push(r.path.slice(ZTO_TRASH_MODE_PATH.length + 1));
            throw perDevice(r.path) ? perDeviceFailure : disconnect();
        };
        for (let i = 0; i < 3; i++) { device('A'); refreshZtoTrashModeMark(); await settle(); }
        expect(sent, 'a stamp lost to the network ➜ once per retry gap').toHaveLength(1);
        perDeviceFailure = refusing();
        (ztoState as any).ztoTrashModeWrote = { palmAt: 0, cookieAt: 0 };
        sent.length = 0;
        for (let i = 0; i < 3; i++) { device('A'); refreshZtoTrashModeMark(); await settle(); }
        expect(sent, 'refused once ➜ one legacy stamp, lost to the network ➜ not resent within the gap').toEqual([`palm/${ztoTrashModeDeviceKey()}`, 'palmAt']);
    });

    function hangPerDevice() {
        const api: any = firebaseState.fb, plain = api.runTransaction;
        const pending = new Map<string, () => void>();
        api.runTransaction = (r: any, update: any) => (perDevice(r.path)
            ? new Promise((_, reject) => { pending.set((update(null) === null ? 'del:' : 'tx:') + r.path.slice(ZTO_TRASH_MODE_PATH.length + 1), () => reject(refusing())); })
            : plain(r, update));
        return { pending, restore: () => { api.runTransaction = plain; } };
    }

    it('P6 a refused Palm stamp answered after the device left Palm never writes the legacy palmAt; the refused stamp of the mode it uses now still writes its legacy stamp', async () => {
        device('A', PALM_URL);
        const key = ztoTrashModeDeviceKey();
        const hung = hangPerDevice();
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        expect(refreshZtoTrashModeMark(), 'the Cookie stamp goes out too').toBe(true);
        await settle();
        writes = [];
        hung.pending.get(`tx:palm/${key}`)!();
        await settle();
        expect(writes, 'left Palm before the refusal landed ➜ no palmAt').toEqual([]);
        hung.pending.get(`tx:cookie/${key}`)!();
        await settle();
        hung.restore();
        expect(writes, 'the mode it uses now ➜ its legacy stamp').toEqual([`tx:${ZTO_TRASH_MODE_PATH}/cookieAt`]);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palmAt`)).toBeNull();
    });

    it('P6 DOC-3 a refused Palm stamp answered after the device left Palm (withdrawal sent, no Cookie stamp yet) still pauses the database and reports once (zone data), writes no legacy palmAt; the next Cookie stamp goes to the legacy cookieAt', async () => {
        const capture = (window as any).ZoeErrors.capture as ReturnType<typeof vi.fn>;
        device('A', PALM_URL);
        const key = ztoTrashModeDeviceKey();
        const hung = hangPerDevice();
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await settle();
        expect([...hung.pending.keys()].sort(), 'the Palm stamp and its withdrawal are both in flight').toEqual([`del:palm/${key}`, `tx:palm/${key}`]);
        writes = [];
        hung.pending.get(`tx:palm/${key}`)!();
        hung.pending.delete(`tx:palm/${key}`);
        await settle();
        expect(writes, 'left Palm before the refusal landed ➜ no palmAt').toEqual([]);
        expect(capture, 'the refusal is reported once').toHaveBeenCalledTimes(1);
        expect(capture.mock.calls[0][1]).toMatchObject({ zone: 'data', context: expect.stringMatching(/trash-mode stamp refused \(stamp\)/) });
        hung.pending.get(`del:palm/${key}`)!();
        hung.pending.delete(`del:palm/${key}`);
        await settle();
        expect(writes, 'the refused withdrawal writes nothing either').toEqual([]);
        expect(capture, 'still one report for the session').toHaveBeenCalledTimes(1);
        expect(markZtoTrashMode('cookie'), 'paused ➜ the Cookie stamp goes to the legacy key').toBe(true);
        await settle();
        hung.restore();
        expect([...hung.pending.keys()], 'no per-device Cookie stamp is sent while paused').toEqual([]);
        expect(writes).toEqual([`tx:${ZTO_TRASH_MODE_PATH}/cookieAt`]);
        expect(at(`${ZTO_TRASH_MODE_PATH}/cookieAt`)).toBeGreaterThan(0);
        expect(at(`${ZTO_TRASH_MODE_PATH}/palmAt`)).toBeNull();
        expect(capture).toHaveBeenCalledTimes(1);
    });

    const sessionChanges = {
        account: () => { firebaseState.auth = { app: { options: { databaseURL: SHOP } }, currentUser: { uid: 'u2', getIdToken: async () => 'tok' } } as any; },
        generation: () => { firebaseState.authGeneration++; },
        database: () => { db = { name: 'shop-trash-mode-devices-moved' }; firebaseState.db = db; noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH)); }
    };
    const sessionLabels = {
        account: 'P5 another account signed in on the same database (authGeneration unchanged)',
        generation: 'N17 only authGeneration changed (Supabase ៖ the account moved to another shop on the same database object)',
        database: 'N18 only the database changed'
    };
    for (const change of Object.keys(sessionChanges) as Array<keyof typeof sessionChanges>) {
        it(`${sessionLabels[change]} ➜ a refusal of the old session neither pauses, stamps nor reports`, async () => {
            device('A', PALM_URL);
            const hung = hangPerDevice();
            expect(refreshZtoTrashModeMark()).toBe(true);
            await settle();
            sessionChanges[change]();
            writes = [];
            hung.pending.get(`tx:palm/${ztoTrashModeDeviceKey()}`)!();
            await settle();
            hung.restore();
            expect(writes, 'no legacy stamp into the new session').toEqual([]);
            expect((window as any).ZoeErrors.capture, 'no rollout signal for a refusal of the old session').not.toHaveBeenCalled();
            (ztoState as any).ztoTrashModeWrote = { palmAt: 0, cookieAt: 0 };
            expect(refreshZtoTrashModeMark(), 'the new session is not paused').toBe(true);
            await settle();
            expect(writes).toEqual([`tx:${ZTO_TRASH_MODE_PATH}/palm/${ztoTrashModeDeviceKey()}`]);
        });
    }

    it('N10 another tab stores a Config of another Firebase shop while this tab\'s SDK still serves the old database (not initializing): a late snapshot never writes the new shop\'s key into the old database', async () => {
        device('A', PALM_URL);
        const OTHER = 'https://other.firebaseio.com';
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: OTHER }));
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(lookupCfg(PALM_URL)));
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
        expect({ shop: ztoState.ztoTrashMode.shop, initializing: firebaseState.isInitializingFirebase }).toEqual({ shop: OTHER, initializing: false });
        writes = [];
        expect(refreshZtoTrashModeMark(), 'the active backend still names the old shop').toBe(false);
        expect(withdrawZtoTrashMode('palm')).toBe(false);
        await settle();
        expect(writes, 'nothing written into the old database').toEqual([]);
    });

    it('N29 initFirebase() re-running for the same shop (Config saved again · another key) holds every trash-mode write: the database it serves is about to be deleted', async () => {
        device('A', PALM_URL);
        writes = [];
        firebaseState.isInitializingFirebase = true;
        try {
            appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: SHOP, apiKey: 'another-key' }));
            noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
            expect(refreshZtoTrashModeMark(), 'only the initializing gate holds it').toBe(false);
            expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
            await settle();
        } finally {
            firebaseState.isInitializingFirebase = false;
        }
        expect(writes, 'nothing written while the old database is torn down').toEqual([]);
        db = { name: 'shop-trash-mode-devices-reinit' };
        firebaseState.db = db;
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
        expect(refreshZtoTrashModeMark(), 'the new SDK\'s marker arrived ➜ it stamps').toBe(true);
        await settle();
        expect(writes).toEqual([`tx:${ZTO_TRASH_MODE_PATH}/cookie/${ztoTrashModeDeviceKey()}`]);
    });

    it('N27 a device clock 2 h behind the server: the per-device stamp and the legacy stamp both carry server time', async () => {
        firebaseState.serverTimeOffsetMs = 2 * HOUR;
        device('A', PALM_URL);
        expect(refreshZtoTrashModeMark()).toBe(true);
        await settle();
        const own = at(`${ZTO_TRASH_MODE_PATH}/palm/${ztoTrashModeDeviceKey()}`);
        const api: any = firebaseState.fb, plain = api.runTransaction;
        api.runTransaction = async (r: any, update: any) => {
            if (perDevice(r.path)) throw refusing();
            return plain(r, update);
        };
        try {
            expect(storeLookupApiConfig(lookupCfg(COOKIE_URL)), 'the withdrawal is refused ➜ the database pauses').toBe(true);
            await settle();
            expect(refreshZtoTrashModeMark(), 'paused ➜ the legacy cookieAt').toBe(true);
            await settle();
        } finally { api.runTransaction = plain; }
        const legacy = at(`${ZTO_TRASH_MODE_PATH}/cookieAt`);
        const server = getServerNow();
        expect({ own: Math.abs(own - server) < 60000, legacy: Math.abs(legacy - server) < 60000 }, JSON.stringify({ own, legacy, server, device: Date.now() }))
            .toEqual({ own: true, legacy: true });
    });
});

describe('GG-2 ៖ សញ្ញាត្រារបៀបធុងសំរាមដែល listener ខូច មិនជាការមើលឃើញថ្មី', () => {
    const listenerFailures = {
        permission_denied: { state: 'denied', make: () => Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' }) },
        network: { state: 'failed', make: () => Object.assign(new Error('Client is offline.'), { code: 'unavailable' }) }
    };
    for (const failure of Object.keys(listenerFailures) as Array<keyof typeof listenerFailures>) {
        it(`a marker listener that fails (${failure}) after an ok snapshot never stands for an empty marker: a lost withdrawal keeps its intent and nothing is sent, stamped or pruned until a snapshot arrives; then the withdrawal is resent`, async () => {
            const { state, make } = listenerFailures[failure];
            const api: any = firebaseState.fb, plain = api.runTransaction;
            let marker: { ok: (s: any) => void; fail: (e: any) => void } | null = null;
            api.onValue = (_r: any, ok: any, fail: any) => { marker = { ok, fail }; return () => {}; };
            attachZtoTrashModeListener(firebaseState.dbListenerGeneration);
            device('A', PALM_URL);
            const key = 'gg' + failure.slice(0, 3) + Math.random().toString(36).slice(2, 12).padEnd(10, '0');
            appLocalStore.setItem(DEVICE_STORE, JSON.stringify({ [SHOP]: key }));
            expect(ztoTrashModeDeviceKey(), 'a key of its own: a withdrawal another test left in flight under the page key never holds this one').toBe(key);
            expect(refreshZtoTrashModeMark()).toBe(true);
            await settle();
            const palm = `${ZTO_TRASH_MODE_PATH}/palm/${key}`, cookie = `${ZTO_TRASH_MODE_PATH}/cookie/${key}`, stale = `${ZTO_TRASH_MODE_PATH}/palm/staleothr1`;
            expect(at(palm)).toBeGreaterThan(0);
            marker!.ok(snap(at(ZTO_TRASH_MODE_PATH)));
            expect(ztoState.ztoTrashMode.state).toBe('ok');
            const sent: string[] = [];
            let lose = true;
            api.runTransaction = async (r: any, update: any) => {
                sent.push(r.path.slice(ZTO_TRASH_MODE_PATH.length + 1));
                if (lose && r.path === palm) throw Object.assign(new Error('disconnect'), { code: 'disconnect' });
                return plain(r, update);
            };
            expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
            await settle();
            expect(sent, 'the withdrawal went out once and was lost').toEqual([`palm/${key}`]);
            expect(at(palm), 'the Palm stamp is still on the server').toBeGreaterThan(0);
            const intents = () => JSON.parse(appLocalStore.getItem('zoew_trash_mode_withdraw_v1') || '[]');
            expect(intents()).toEqual([{ shop: SHOP, path: `palm/${key}` }]);
            put(stale, getServerNow() - ZTO_TRASH_MODE_ACTIVE_MS - HOUR);
            marker!.fail(make());
            expect(ztoState.ztoTrashMode).toMatchObject({ state, stamps: {} });
            let clock = Date.now();
            vi.spyOn(Date, 'now').mockImplementation(() => clock);
            const cycle = async () => {
                clock += ZTO_TRASH_MODE_RETRY_MS + 1000;
                retryZtoTrashModeListener();
                const marked = refreshZtoTrashModeMark();
                await settle();
                return marked;
            };
            sent.length = 0; writes = [];
            lose = false;
            for (let turn = 0; turn < 2; turn++) {
                expect(await cycle(), `turn ${turn}: the listener is still ${state} ➜ no stamp`).toBe(false);
                expect(ztoState.ztoTrashMode.state, `turn ${turn}: re-attached, no snapshot yet`).toBe(state);
            }
            expect(sent, 'nothing sent while the marker view is failed: no withdrawal dropped, no stamp, no prune').toEqual([]);
            expect(writes).toEqual([]);
            expect(intents(), 'the withdrawal intent is kept').toEqual([{ shop: SHOP, path: `palm/${key}` }]);
            expect(at(palm)).toBeGreaterThan(0);
            expect(at(cookie)).toBeNull();
            expect(at(stale), 'nothing pruned').toBeGreaterThan(0);
            marker!.ok(snap(at(ZTO_TRASH_MODE_PATH)));
            expect(ztoState.ztoTrashMode.state).toBe('ok');
            expect(await cycle(), 'a snapshot arrived ➜ the Cookie stamp goes out').toBe(true);
            expect(sent.sort()).toEqual([`cookie/${key}`, `palm/${key}`, 'palm/staleothr1'].sort());
            expect(at(palm), 'the lost withdrawal is resent and lands').toBeNull();
            expect(at(cookie)).toBeGreaterThan(0);
            expect(at(stale)).toBeNull();
            expect(intents()).toEqual([]);
        });
    }
});

describe('GG-3 ៖ ការដកត្រារបៀបធុងសំរាមដែលកំពុងផ្ញើ ជាកម្មសិទ្ធិ session ដែលផ្ញើវា', () => {
    function hungWithdrawals(api: any, key: string) {
        const plain = api.runTransaction;
        const pending: Array<() => void> = [];
        let sent = 0;
        api.runTransaction = (r: any, update: any) => (r.path.endsWith('/palm/' + key) && update(null) === null
            ? (sent++, new Promise((_, reject) => { pending.push(() => reject(Object.assign(new Error('disconnect'), { code: 'disconnect' }))); }))
            : plain(r, update));
        return { pending, sent: () => sent, restore: () => { api.runTransaction = plain; } };
    }
    function leavePalmWithHungWithdrawal() {
        device('A', PALM_URL);
        const key = 'gg3' + Math.random().toString(36).slice(2, 12).padEnd(10, '0');
        appLocalStore.setItem(DEVICE_STORE, JSON.stringify({ [SHOP]: key }));
        expect(ztoTrashModeDeviceKey()).toBe(key);
        expect(refreshZtoTrashModeMark()).toBe(true);
        return key;
    }
    const intents = () => JSON.parse(appLocalStore.getItem('zoew_trash_mode_withdraw_v1') || '[]');
    const sessionEnds = {
        teardown: 'the backend teardown of initFirebase() (deleteApp ➜ new SDK · new database object · authGeneration++), same shop',
        relogin: 'sign-out and sign-in again on the same database object (authGeneration twice · listeners detached)'
    };
    function endSession(kind: keyof typeof sessionEnds) {
        resetZtoTrashMode();
        if (kind === 'teardown') {
            db = { name: 'shop-trash-mode-devices-reinit' };
            firebaseState.db = db as any; firebaseState.fb = fb() as any;
            firebaseState.dbRefZtoTrashMode = ref(db, ZTO_TRASH_MODE_PATH) as any;
            firebaseState.authGeneration++;
        } else {
            firebaseState.authGeneration += 2;
        }
        firebaseState.dbListenerGeneration++;
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
    }
    for (const kind of Object.keys(sessionEnds) as Array<keyof typeof sessionEnds>) {
        it(`a withdrawal that never settles across ${sessionEnds[kind]} never blocks the new session: the stored intent is resent and the Palm stamp leaves`, async () => {
            const key = leavePalmWithHungWithdrawal();
            await settle();
            const palm = `${ZTO_TRASH_MODE_PATH}/palm/${key}`;
            expect(at(palm)).toBeGreaterThan(0);
            const hung = hungWithdrawals(firebaseState.fb, key);
            expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
            await settle();
            expect(hung.sent(), 'the withdrawal is in flight and never settles').toBe(1);
            expect(intents()).toEqual([{ shop: SHOP, path: `palm/${key}` }]);
            endSession(kind);
            if (kind === 'relogin') hung.restore();
            let clock = Date.now();
            vi.spyOn(Date, 'now').mockImplementation(() => clock);
            for (let turn = 0; turn < 2; turn++) {
                clock += ZTO_TRASH_MODE_RETRY_MS + 1000;
                refreshZtoTrashModeMark();
                await settle();
            }
            expect(at(palm), 'the withdrawal is resent in the new session of the same shop').toBeNull();
            expect(intents()).toEqual([]);
            expect(at(`${ZTO_TRASH_MODE_PATH}/cookie/${key}`)).toBeGreaterThan(0);
        });
    }

    it('a late answer of the old session\'s withdrawal never releases the new session\'s withdrawal still in flight (never two at once); once it fails the next cycle resends', async () => {
        const key = leavePalmWithHungWithdrawal();
        await settle();
        const palm = `${ZTO_TRASH_MODE_PATH}/palm/${key}`;
        const old = hungWithdrawals(firebaseState.fb, key);
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await settle();
        expect(old.sent()).toBe(1);
        endSession('teardown');
        const fresh = hungWithdrawals(firebaseState.fb, key);
        let clock = Date.now();
        vi.spyOn(Date, 'now').mockImplementation(() => clock);
        const cycle = async () => { clock += ZTO_TRASH_MODE_RETRY_MS + 1000; refreshZtoTrashModeMark(); await settle(); };
        await cycle();
        expect(fresh.sent(), 'the new session sends its own withdrawal').toBe(1);
        old.pending.splice(0).forEach((reject) => reject());
        await settle();
        await cycle();
        await cycle();
        expect(fresh.sent(), 'still in flight in this session ➜ never sent a second time').toBe(1);
        fresh.pending.splice(0).forEach((reject) => reject());
        await settle();
        fresh.restore();
        await cycle();
        expect(at(palm), 'it failed ➜ the next cycle resends and it lands').toBeNull();
        expect(intents()).toEqual([]);
    });

    it('a listener re-attach inside the same session (resetZtoTrashMode · same database · same authGeneration) keeps the withdrawal in flight: never sent a second time', async () => {
        const key = leavePalmWithHungWithdrawal();
        await settle();
        const hung = hungWithdrawals(firebaseState.fb, key);
        expect(storeLookupApiConfig(lookupCfg(COOKIE_URL))).toBe(true);
        await settle();
        expect(hung.sent()).toBe(1);
        resetZtoTrashMode();
        firebaseState.dbListenerGeneration++;
        noteZtoTrashMode(at(ZTO_TRASH_MODE_PATH));
        let clock = Date.now();
        vi.spyOn(Date, 'now').mockImplementation(() => clock);
        for (let turn = 0; turn < 2; turn++) {
            clock += ZTO_TRASH_MODE_RETRY_MS + 1000;
            refreshZtoTrashModeMark();
            await settle();
        }
        expect(hung.sent(), 'the same session ➜ the withdrawal is still in flight').toBe(1);
        hung.pending.splice(0).forEach((reject) => reject());
        await settle();
        hung.restore();
        expect(intents(), 'kept until it lands').toEqual([{ shop: SHOP, path: `palm/${key}` }]);
    });
});
