import { firebaseState, ztoState } from '../core/state';
import { cleanupClockIsTrustworthy, getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { sameShop, shopScope } from '../core/shop-scope';
import { appLocalStore, appSessionStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { ZTO_TRASH_MODE_DEVICE_KEY, ZTO_TRASH_MODE_WITHDRAW_KEY } from '../core/storage-keys';

export const ZTO_TRASH_MODE_PATH = 'zoew_settings/zto_trash_mode';
export const ZTO_TRASH_MODE_MARK_GAP_MS = 6 * 60 * 60 * 1000;
export const ZTO_TRASH_MODE_ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;
export const ZTO_TRASH_MODE_RETRY_MS = 5 * 60 * 1000;
export const ZTO_TRASH_MODE_REFUSED_RETRY_MS = 6 * 60 * 60 * 1000;
export const ZTO_TRASH_MODE_PRUNE_MAX = 4;
export const ZTO_TRASH_MODE_DEVICE_SHOPS_MAX = 8;
export const ZTO_TRASH_MODE_FUTURE_MS = 24 * 60 * 60 * 1000;
export const ZTO_TRASH_MODE_WITHDRAW_MAX = 16;

const ZTO_TRASH_MODE_KEYS = { palm: 'palmAt', cookie: 'cookieAt' };
const ZTO_TRASH_MODE_DEVICE_RE = /^[a-z0-9]{8,32}$/;
const ZTO_TRASH_MODE_PATH_RE = /^(palm|cookie)\/[a-z0-9]{8,32}$/;

let ztoTrashModeSeen = { shop: '', mode: '' };
let ztoTrashModePageDevices = {};
let ztoTrashModePrunedAt = 0;
let ztoTrashModePruneTurn = 0;
let ztoTrashModeWithdrawnAt = {};
let ztoTrashModeWithdrawing = { db: null, generation: -1, paths: {} };
let ztoTrashModeNotedDb = null;
let ztoTrashModeRefused = { db: null, generation: -1 };
let ztoTrashModeRefusal = { db: null, at: 0 };
let ztoTrashModeIntentMemory = null;

function ztoTrashModeStamp(v) {
    return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0;
}

function randomZtoTrashModeDevice() {
    const bytes = new Uint8Array(16);
    try {
        crypto.getRandomValues(bytes);
    } catch (e) {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

function ztoTrashModeDevicesIn(store) {
    try {
        const devices = JSON.parse(safeStoreGet(store, ZTO_TRASH_MODE_DEVICE_KEY) || 'null');
        return devices && typeof devices === 'object' && !Array.isArray(devices) ? devices : {};
    } catch (e) {
        return {};
    }
}

function ztoTrashModeDeviceOf(devices, shop) {
    const scope = Object.keys(devices).find((s) => sameShop(s, shop));
    const device = scope ? devices[scope] : '';
    return typeof device === 'string' && ZTO_TRASH_MODE_DEVICE_RE.test(device) ? device : '';
}

function ztoTrashModeDevicesWith(devices, shop, device) {
    const next = {};
    for (const scope of Object.keys(devices)) {
        if (!sameShop(scope, shop)) next[scope] = devices[scope];
    }
    next[shop] = device;
    const scopes = Object.keys(next);
    for (const scope of scopes.slice(0, Math.max(0, scopes.length - ZTO_TRASH_MODE_DEVICE_SHOPS_MAX))) delete next[scope];
    return next;
}

function keepZtoTrashModeDevice(store, shop, device) {
    const text = JSON.stringify(ztoTrashModeDevicesWith(ztoTrashModeDevicesIn(store), shop, device));
    return safeStoreSet(store, ZTO_TRASH_MODE_DEVICE_KEY, text) && safeStoreGet(store, ZTO_TRASH_MODE_DEVICE_KEY) === text;
}

export function ztoTrashModeDeviceKey() {
    const shop = shopScope();
    if (!shop) return '';
    const local = ztoTrashModeDevicesIn(appLocalStore);
    const stored = ztoTrashModeDeviceOf(local, shop);
    if (stored) {
        if (!sameShop(Object.keys(local).pop(), shop)) keepZtoTrashModeDevice(appLocalStore, shop, stored);
        return stored;
    }
    const device = ztoTrashModeDeviceOf(ztoTrashModeDevicesIn(appSessionStore), shop) || ztoTrashModeDeviceOf(ztoTrashModePageDevices, shop) || randomZtoTrashModeDevice();
    if (!keepZtoTrashModeDevice(appLocalStore, shop, device) && !keepZtoTrashModeDevice(appSessionStore, shop, device)) {
        ztoTrashModePageDevices = ztoTrashModeDevicesWith(ztoTrashModePageDevices, shop, device);
    }
    return device;
}

function ztoTrashModeStampsOf(val) {
    const stamps = {};
    if (!val || typeof val !== 'object') return stamps;
    for (const kind of Object.keys(ZTO_TRASH_MODE_KEYS)) {
        const devices = val[kind];
        if (!devices || typeof devices !== 'object') continue;
        for (const device of Object.keys(devices)) {
            const at = ztoTrashModeStamp(devices[device]);
            if (at) stamps[kind + '/' + device] = at;
        }
    }
    return stamps;
}

function newestZtoTrashModeStamp(stamps, kind) {
    let newest = 0;
    for (const path of Object.keys(stamps)) {
        if (path.startsWith(kind + '/')) newest = Math.max(newest, stamps[path]);
    }
    return newest;
}

export function resetZtoTrashMode() {
    const sdk = firebaseState.fb;
    const markRef = firebaseState.dbRefZtoTrashMode;
    if (sdk && markRef && typeof sdk.off === 'function') { try { sdk.off(markRef); } catch (e) {} }
    ztoState.ztoTrashMode = { state: 'off', palmAt: 0, cookieAt: 0, failedAt: 0, stamps: {}, shop: '' };
    ztoState.ztoTrashModeWrote = { palmAt: 0, cookieAt: 0 };
    ztoTrashModePrunedAt = 0;
    ztoTrashModePruneTurn = 0;
    ztoTrashModeWithdrawnAt = {};
    ztoTrashModeNotedDb = null;
}

export function noteZtoTrashMode(val) {
    const stamps = ztoTrashModeStampsOf(val);
    ztoState.ztoTrashMode = {
        state: 'ok',
        palmAt: newestZtoTrashModeStamp(stamps, 'palm'),
        cookieAt: newestZtoTrashModeStamp(stamps, 'cookie'),
        failedAt: 0,
        stamps,
        shop: shopScope()
    };
    ztoTrashModeNotedDb = firebaseState.db;
}

export function noteZtoTrashModeError(err) {
    const denied = /permission[_ ]denied/i.test(String((err && (err.code || err.message)) || err));
    ztoState.ztoTrashMode = { state: denied ? 'denied' : 'failed', palmAt: 0, cookieAt: 0, failedAt: Date.now(), stamps: {}, shop: '' };
}

export function attachZtoTrashModeListener(listenerGeneration, keepState?) {
    const sdk = firebaseState.fb;
    const markRef = firebaseState.dbRefZtoTrashMode;
    if (!sdk || !markRef || typeof sdk.onValue !== 'function') return false;
    if (!keepState) ztoState.ztoTrashMode = { state: 'pending', palmAt: 0, cookieAt: 0, failedAt: 0, stamps: {}, shop: '' };
    sdk.onValue(markRef, (snapshot) => {
        if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
        noteZtoTrashMode(snapshot.val());
    }, (err) => {
        if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
        noteZtoTrashModeError(err);
    });
    return true;
}

export function retryZtoTrashModeListener() {
    const shop = ztoState.ztoTrashMode;
    if (shop.state !== 'denied' && shop.state !== 'failed') return false;
    if (shop.failedAt && elapsedSince(shop.failedAt) < ZTO_TRASH_MODE_RETRY_MS) return false;
    const sdk = firebaseState.fb;
    const markRef = firebaseState.dbRefZtoTrashMode;
    if (!sdk || !markRef) return false;
    if (typeof sdk.off === 'function') { try { sdk.off(markRef); } catch (e) {} }
    ztoState.ztoTrashMode = Object.assign({}, shop, { failedAt: Date.now() });
    return attachZtoTrashModeListener(firebaseState.dbListenerGeneration, true);
}

export function shopZtoTrashMode() {
    const shop = ztoState.ztoTrashMode;
    if (shop.state === 'pending' || shop.state === 'failed') return '';
    if (shop.state !== 'ok') return 'local';
    const now = getServerNow();
    const mode = shop.palmAt && now - shop.palmAt <= ZTO_TRASH_MODE_ACTIVE_MS ? 'palm'
        : shop.cookieAt && now - shop.cookieAt <= ZTO_TRASH_MODE_ACTIVE_MS ? 'cookie' : 'local';
    const scope = shopScope();
    if (ztoTrashModeSeen.shop !== scope || ztoTrashModeSeen.mode !== mode) ztoTrashModeSeen = { shop: scope, mode };
    return mode;
}

export function lastSeenShopZtoTrashMode() {
    return ztoTrashModeSeen.shop && ztoTrashModeSeen.shop === shopScope() ? ztoTrashModeSeen.mode : '';
}

export function effectiveZtoTrashMode(deviceMode) {
    return deviceMode === 'palm' || deviceMode === 'cookie' ? deviceMode : shopZtoTrashMode();
}

function ztoTrashModeActiveShop(here) {
    const options = (firebaseState.auth && firebaseState.auth.app && firebaseState.auth.app.options) || {};
    const tenant = here.indexOf('#');
    return options.databaseURL || (options.supabaseUrl && tenant > 0 ? options.supabaseUrl + here.slice(tenant) : '');
}

function ztoTrashModeWritable() {
    const mark = ztoState.ztoTrashMode;
    const sdk = firebaseState.fb;
    if (mark.state !== 'ok' || firebaseState.isInitializingFirebase || firebaseState.firebaseSdkUnavailable || !firebaseState.isDatabaseConnected
        || !sdk || typeof sdk.runTransaction !== 'function' || !firebaseState.db || ztoTrashModeNotedDb !== firebaseState.db) return false;
    const here = shopScope();
    return !!here && sameShop(mark.shop || here, here) && sameShop(ztoTrashModeActiveShop(here), here);
}

function ztoTrashModeRefusalOf(db) {
    if (ztoTrashModeRefusal.db !== db) ztoTrashModeRefusal = { db, at: 0 };
    return ztoTrashModeRefusal;
}

function ztoTrashModeRefusedHere() {
    return elapsedSince(ztoTrashModeRefusalOf(firebaseState.db).at) < ZTO_TRASH_MODE_REFUSED_RETRY_MS;
}

function ztoTrashModeAccount() {
    const user = firebaseState.auth && firebaseState.auth.currentUser;
    return user && user.uid ? String(user.uid) : '';
}

function ztoTrashModeGapStamp(gaps, key) {
    return Object.assign({}, gaps, { [key]: Date.now() });
}

function noteZtoTrashModeRefused(err, markDb, generation, account, op) {
    if (!/permission[_ ]denied/i.test(String((err && (err.code || err.message)) || err))) return false;
    if (markDb !== firebaseState.db || generation !== firebaseState.authGeneration || account !== ztoTrashModeAccount()) return false;
    ztoTrashModeRefusalOf(markDb).at = Date.now();
    if (ztoTrashModeRefused.db === markDb && ztoTrashModeRefused.generation === generation) return true;
    ztoTrashModeRefused = { db: markDb, generation };
    if (window.ZoeErrors) ZoeErrors.capture(err, { zone: 'data', context: 'ZTO trash-mode stamp refused (' + op + ') — publish the database rules' });
    return true;
}

function sendZtoTrashModeWrite(path, update, op) {
    const sdk = firebaseState.fb;
    const markDb = firebaseState.db;
    const generation = firebaseState.authGeneration;
    const account = ztoTrashModeAccount();
    const updater = Object.assign(update, { txOutcomeWitness: () => 'not-applied', txAdvisory: true });
    return Promise.resolve().then(() => sdk.runTransaction(sdk.ref(markDb, ZTO_TRASH_MODE_PATH + '/' + path), updater))
        .catch((err) => {
            noteZtoTrashModeRefused(err, markDb, generation, account, op);
            throw err;
        });
}

function ztoTrashModeIntents() {
    let list = ztoTrashModeIntentMemory;
    if (!list) {
        try { list = JSON.parse(safeStoreGet(appLocalStore, ZTO_TRASH_MODE_WITHDRAW_KEY) || '[]'); } catch (e) { list = []; }
    }
    return (Array.isArray(list) ? list : []).filter((row) => row && typeof row.shop === 'string' && row.shop
        && typeof row.path === 'string' && ZTO_TRASH_MODE_PATH_RE.test(row.path));
}

function keepZtoTrashModeIntents(list) {
    const next = list.slice(Math.max(0, list.length - ZTO_TRASH_MODE_WITHDRAW_MAX));
    const text = JSON.stringify(next);
    ztoTrashModeIntentMemory = safeStoreSet(appLocalStore, ZTO_TRASH_MODE_WITHDRAW_KEY, text)
        && safeStoreGet(appLocalStore, ZTO_TRASH_MODE_WITHDRAW_KEY) === text ? null : next;
}

function dropZtoTrashModeIntent(shop, path) {
    const list = ztoTrashModeIntents();
    const next = list.filter((row) => !(row.path === path && sameShop(row.shop, shop)));
    if (next.length !== list.length) keepZtoTrashModeIntents(next);
}

function addZtoTrashModeIntent(shop, path) {
    keepZtoTrashModeIntents(ztoTrashModeIntents().filter((row) => !(row.path === path && sameShop(row.shop, shop))).concat([{ shop, path }]));
}

export function markZtoTrashMode(deviceMode) {
    const key = ZTO_TRASH_MODE_KEYS[deviceMode];
    if (!key || !ztoTrashModeWritable() || ztoTrashModeRefusedHere()) return false;
    const device = ztoTrashModeDeviceKey();
    if (!device) return false;
    const path = deviceMode + '/' + device;
    const now = getServerNow();
    const stamp = ztoState.ztoTrashMode.stamps[path];
    if (stamp && now - stamp < ZTO_TRASH_MODE_MARK_GAP_MS) return false;
    if (elapsedSince(ztoState.ztoTrashModeWrote[key]) < ZTO_TRASH_MODE_RETRY_MS) return false;
    ztoState.ztoTrashModeWrote = ztoTrashModeGapStamp(ztoState.ztoTrashModeWrote, key);
    sendZtoTrashModeWrite(path, () => now, 'stamp').catch(() => {});
    return true;
}

function ztoTrashModeWithdrawingHere() {
    const sessionDb = firebaseState.db;
    const sessionGeneration = firebaseState.authGeneration;
    if (ztoTrashModeWithdrawing.db !== sessionDb || ztoTrashModeWithdrawing.generation !== sessionGeneration) {
        ztoTrashModeWithdrawing = { db: sessionDb, generation: sessionGeneration, paths: {} };
    }
    return ztoTrashModeWithdrawing;
}

function sendZtoTrashModeWithdrawal(shop, path) {
    if (!ztoTrashModeWritable() || ztoTrashModeRefusedHere()) return false;
    ztoTrashModeWithdrawnAt = Object.assign({}, ztoTrashModeWithdrawnAt, { [path]: Date.now() });
    const inFlight = ztoTrashModeWithdrawingHere();
    inFlight.paths = Object.assign({}, inFlight.paths, { [path]: (inFlight.paths[path] || 0) + 1 });
    sendZtoTrashModeWrite(path, () => null, 'withdraw')
        .then((res) => { if (res && res.committed) dropZtoTrashModeIntent(shop, path); }, () => {})
        .finally(() => {
            if (ztoTrashModeWithdrawing !== inFlight) return;
            inFlight.paths = Object.assign({}, inFlight.paths, { [path]: (inFlight.paths[path] || 1) - 1 });
        })
        .catch(() => {});
    return true;
}

export function withdrawZtoTrashMode(deviceMode) {
    const key = ZTO_TRASH_MODE_KEYS[deviceMode];
    if (!key) return false;
    const device = ztoTrashModeDeviceKey();
    if (!device) return false;
    const shop = shopScope();
    const path = deviceMode + '/' + device;
    addZtoTrashModeIntent(shop, path);
    ztoState.ztoTrashModeWrote = Object.assign({}, ztoState.ztoTrashModeWrote, { [key]: 0 });
    return sendZtoTrashModeWithdrawal(shop, path);
}

export function withdrawLeftZtoTrashModes(deviceMode) {
    const mark = ztoState.ztoTrashMode;
    if (!ztoTrashModeWritable()) return 0;
    const here = shopScope();
    let sent = 0;
    for (const row of ztoTrashModeIntents()) {
        if (!sameShop(row.shop, here) || ztoTrashModeWithdrawingHere().paths[row.path]) continue;
        if (row.path.split('/')[0] === deviceMode || !mark.stamps[row.path]) {
            dropZtoTrashModeIntent(row.shop, row.path);
            continue;
        }
        if (elapsedSince(ztoTrashModeWithdrawnAt[row.path]) < ZTO_TRASH_MODE_RETRY_MS) continue;
        if (sendZtoTrashModeWithdrawal(row.shop, row.path)) sent++;
    }
    return sent;
}

export function pruneZtoTrashMode() {
    const shop = ztoState.ztoTrashMode;
    if (!ztoTrashModeWritable() || ztoTrashModeRefusedHere() || !cleanupClockIsTrustworthy()) return 0;
    if (elapsedSince(ztoTrashModePrunedAt) < ZTO_TRASH_MODE_RETRY_MS) return 0;
    const now = getServerNow();
    const stale = Object.keys(shop.stamps).filter((path) => now - shop.stamps[path] > ZTO_TRASH_MODE_ACTIVE_MS
        || shop.stamps[path] - now > ZTO_TRASH_MODE_FUTURE_MS).sort();
    if (!stale.length) return 0;
    const start = ztoTrashModePruneTurn % stale.length;
    const batch = stale.slice(start).concat(stale.slice(0, start)).slice(0, ZTO_TRASH_MODE_PRUNE_MAX);
    ztoTrashModePruneTurn += batch.length;
    ztoTrashModePrunedAt = Date.now();
    for (const path of batch) {
        const seen = shop.stamps[path];
        sendZtoTrashModeWrite(path, (current) => (current == null || current === seen ? null : undefined), 'prune').catch(() => {});
    }
    return batch.length;
}
