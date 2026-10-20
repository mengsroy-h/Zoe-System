import { firebaseState, ztoState } from '../core/state';
import { getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { shopScope } from '../core/shop-scope';

export const ZTO_TRASH_MODE_PATH = 'zoew_settings/zto_trash_mode';
export const ZTO_TRASH_MODE_MARK_GAP_MS = 6 * 60 * 60 * 1000;
export const ZTO_TRASH_MODE_ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;
export const ZTO_TRASH_MODE_RETRY_MS = 5 * 60 * 1000;
export const ZTO_TRASH_MODE_FUTURE_MS = 10 * 60 * 1000;

const ZTO_TRASH_MODE_KEYS = { palm: 'palmAt', cookie: 'cookieAt' };

let ztoTrashModeSeen = { shop: '', mode: '' };

function ztoTrashModeStamp(v) {
    return typeof v === 'number' && isFinite(v) && v > 0 && v <= getServerNow() + ZTO_TRASH_MODE_FUTURE_MS ? v : 0;
}

export function resetZtoTrashMode() {
    const sdk = firebaseState.fb;
    const markRef = firebaseState.dbRefZtoTrashMode;
    if (sdk && markRef && typeof sdk.off === 'function') { try { sdk.off(markRef); } catch (e) {} }
    ztoState.ztoTrashMode = { state: 'off', palmAt: 0, cookieAt: 0, failedAt: 0 };
    ztoState.ztoTrashModeWrote = { palmAt: 0, cookieAt: 0 };
}

export function noteZtoTrashMode(val) {
    ztoState.ztoTrashMode = {
        state: 'ok',
        palmAt: ztoTrashModeStamp(val && val.palmAt),
        cookieAt: ztoTrashModeStamp(val && val.cookieAt),
        failedAt: 0
    };
}

export function noteZtoTrashModeError(err) {
    const denied = /permission[_ ]denied/i.test(String((err && (err.code || err.message)) || err));
    ztoState.ztoTrashMode = { state: denied ? 'denied' : 'failed', palmAt: 0, cookieAt: 0, failedAt: Date.now() };
}

export function attachZtoTrashModeListener(listenerGeneration, keepState?) {
    const sdk = firebaseState.fb;
    const markRef = firebaseState.dbRefZtoTrashMode;
    if (!sdk || !markRef || typeof sdk.onValue !== 'function') return false;
    if (!keepState) ztoState.ztoTrashMode = { state: 'pending', palmAt: 0, cookieAt: 0, failedAt: 0 };
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

export function markZtoTrashMode(deviceMode) {
    const key = ZTO_TRASH_MODE_KEYS[deviceMode];
    const sdk = firebaseState.fb;
    const markRef = firebaseState.dbRefZtoTrashMode;
    if (!key || !sdk || !markRef || typeof sdk.update !== 'function' || ztoState.ztoTrashMode.state !== 'ok') return false;
    const now = getServerNow();
    const stamp = ztoState.ztoTrashMode[key];
    if (stamp && now - stamp < ZTO_TRASH_MODE_MARK_GAP_MS) return false;
    if (elapsedSince(ztoState.ztoTrashModeWrote[key]) < ZTO_TRASH_MODE_RETRY_MS) return false;
    ztoState.ztoTrashModeWrote = Object.assign({}, ztoState.ztoTrashModeWrote, { [key]: Date.now() });
    Promise.resolve().then(() => sdk.update(markRef, { [key]: now })).catch(() => {});
    return true;
}

export function withdrawZtoTrashMode(deviceMode) {
    const key = ZTO_TRASH_MODE_KEYS[deviceMode];
    const sdk = firebaseState.fb;
    const markRef = firebaseState.dbRefZtoTrashMode;
    if (!key || !sdk || !markRef || typeof sdk.update !== 'function' || ztoState.ztoTrashMode.state !== 'ok' || !ztoState.ztoTrashMode[key]) return false;
    ztoState.ztoTrashModeWrote = Object.assign({}, ztoState.ztoTrashModeWrote, { [key]: 0 });
    Promise.resolve().then(() => sdk.update(markRef, { [key]: null })).catch(() => {});
    return true;
}
