import { firebaseState, ztoState } from '../core/state';
import { getServerNow } from '../core/clock';

export const ZTO_SHOP_SWEEP_PATH = 'zoew_settings/zto_signed_sweep';
export const ZTO_SHOP_SWEEP_MARK_GAP_MS = 5 * 60 * 1000;
export const ZTO_SHOP_SWEEP_ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;

function ztoShopSweepStamp(v) {
    return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0;
}

export function resetZtoShopSweep() {
    const sdk = firebaseState.fb;
    const markRef = firebaseState.dbRefZtoSignedSweep;
    if (sdk && markRef && typeof sdk.off === 'function') { try { sdk.off(markRef); } catch (e) {} }
    ztoState.ztoShopSweep = { state: 'off', activeAt: 0, completeAt: 0, advancedAt: 0 };
    ztoState.ztoShopSweepWrote = { activeAt: 0, completeAt: 0 };
}

export function noteZtoShopSweep(val) {
    const prev = ztoState.ztoShopSweep;
    const completeAt = ztoShopSweepStamp(val && val.completeAt);
    ztoState.ztoShopSweep = {
        state: 'ok',
        activeAt: ztoShopSweepStamp(val && val.activeAt),
        completeAt: completeAt,
        advancedAt: completeAt > prev.completeAt ? Date.now() : prev.advancedAt
    };
}

export function noteZtoShopSweepError(err) {
    const denied = /permission[_ ]denied/i.test(String((err && (err.code || err.message)) || err));
    ztoState.ztoShopSweep = { state: denied ? 'denied' : 'failed', activeAt: 0, completeAt: 0, advancedAt: 0 };
}

export function attachZtoShopSweepListener(listenerGeneration) {
    const sdk = firebaseState.fb;
    const markRef = firebaseState.dbRefZtoSignedSweep;
    if (!sdk || !markRef || typeof sdk.onValue !== 'function') return false;
    ztoState.ztoShopSweep = { state: 'pending', activeAt: 0, completeAt: 0, advancedAt: 0 };
    sdk.onValue(markRef, (snapshot) => {
        if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
        noteZtoShopSweep(snapshot.val());
    }, (err) => {
        if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
        noteZtoShopSweepError(err);
    });
    return true;
}

export function ztoShopSweepHolds(ripeAt) {
    const shop = ztoState.ztoShopSweep;
    if (shop.state === 'pending' || shop.state === 'failed') return true;
    if (shop.state !== 'ok' || !shop.activeAt || getServerNow() - shop.activeAt > ZTO_SHOP_SWEEP_ACTIVE_MS) return false;
    return typeof ripeAt === 'number' && isFinite(ripeAt) && shop.completeAt < ripeAt;
}

export function markZtoShopSweep(completeAt) {
    const sdk = firebaseState.fb;
    const markRef = firebaseState.dbRefZtoSignedSweep;
    if (!sdk || !markRef || typeof sdk.update !== 'function') return false;
    const now = getServerNow();
    const wrote = ztoState.ztoShopSweepWrote;
    const lastActive = Math.max(ztoState.ztoShopSweep.activeAt, wrote.activeAt);
    const lastComplete = Math.max(ztoState.ztoShopSweep.completeAt, wrote.completeAt);
    const patch: any = {};
    if (ztoShopSweepStamp(completeAt) && completeAt - lastComplete >= ZTO_SHOP_SWEEP_MARK_GAP_MS) patch.completeAt = completeAt;
    if (patch.completeAt || !lastActive || now - lastActive >= ZTO_SHOP_SWEEP_MARK_GAP_MS) patch.activeAt = now;
    if (!patch.activeAt) return false;
    ztoState.ztoShopSweepWrote = { activeAt: patch.activeAt, completeAt: patch.completeAt || wrote.completeAt };
    Promise.resolve().then(() => sdk.update(markRef, patch)).catch(() => {});
    return true;
}
