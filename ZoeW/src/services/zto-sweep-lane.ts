import { firebaseState, ztoState } from '../core/state';
import { cleanupClockIsTrustworthy, getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { shopScope } from '../core/shop-scope';
import { withTimeout } from './network';
import { ztoTrashModeDeviceKey } from './zto-trash-mode';

export const ZTO_SWEEP_LANE_PATH = 'zoew_settings/zto_sweep_lead';
export const ZTO_SWEEP_LANE_FLOOR_MS = 5000;
export const ZTO_SWEEP_LANE_PEER_SPAN = 2;
export const ZTO_SWEEP_LANE_FUTURE_MS = 30000;
export const ZTO_SWEEP_LANE_CLAIM_TIMEOUT_MS = 8000;
export const ZTO_SWEEP_LANE_RETRY_MS = 5 * 60 * 1000;
export const ZTO_SWEEP_LANE_FORGET_MS = 60 * 60 * 1000;

const ZTO_SWEEP_LANE_RE = /^(palm|cookie)_[a-z0-9_-]{1,40}$/;
const ZTO_SWEEP_LANE_DEVICE_RE = /^[a-z0-9]{8,32}$/;

let ztoSweepLaneSeen = new Map();
let ztoSweepLaneNotedDb = null;
let ztoSweepLanePaused = { db: null, pausedAt: 0 };

function ztoSweepLaneEntry(value) {
    if (!value || typeof value !== 'object') return null;
    const device = typeof value.device === 'string' && ZTO_SWEEP_LANE_DEVICE_RE.test(value.device) ? value.device : '';
    const at = typeof value.at === 'number' && isFinite(value.at) && value.at > 0 ? value.at : 0;
    return device && at ? { device, at } : null;
}

function ztoSweepLanePart(text) {
    return String(text || '').trim().toLowerCase().replace(/\./g, '_').replace(/[^a-z0-9_-]/g, '');
}

export function ztoSweepLaneOf(cfg, palm) {
    let id = '';
    if (palm) {
        id = cfg && cfg.palmAccount && typeof cfg.palmAccount.siteCode === 'string' ? cfg.palmAccount.siteCode : '';
    } else {
        const user = firebaseState.auth && firebaseState.auth.currentUser;
        const email = user && typeof user.email === 'string' ? user.email : '';
        const at = email.lastIndexOf('@');
        id = at > 0 ? email.slice(at + 1) : '';
    }
    const part = ztoSweepLanePart(id);
    const lane = (palm ? 'palm_' : 'cookie_') + part;
    return part && ZTO_SWEEP_LANE_RE.test(lane) ? lane : '';
}

export function resetZtoSweepLane() {
    const sdk = firebaseState.fb;
    const laneRef = firebaseState.dbRefZtoSweepLane;
    if (sdk && laneRef && typeof sdk.off === 'function') { try { sdk.off(laneRef); } catch (e) {} }
    ztoState.ztoSweepLane = { state: 'off', lanes: {}, failedAt: 0 };
    ztoSweepLaneSeen = new Map();
    ztoSweepLaneNotedDb = null;
}

export function noteZtoSweepLane(val) {
    const lanes = {};
    const now = getServerNow();
    if (val && typeof val === 'object') {
        for (const lane of Object.keys(val)) {
            const entry = ztoSweepLaneEntry(val[lane]);
            if (!entry || !ZTO_SWEEP_LANE_RE.test(lane)) continue;
            lanes[lane] = entry;
            const seen = ztoSweepLaneSeen.get(lane) || new Map();
            if (!(seen.get(entry.device) >= entry.at)) seen.set(entry.device, entry.at);
            seen.forEach((at, device) => { if (now - at > ZTO_SWEEP_LANE_FORGET_MS) seen.delete(device); });
            ztoSweepLaneSeen.set(lane, seen);
        }
    }
    ztoState.ztoSweepLane = { state: 'ok', lanes, failedAt: 0 };
    ztoSweepLaneNotedDb = firebaseState.db;
}

export function noteZtoSweepLaneError(err) {
    const denied = /permission[_ ]denied/i.test(String((err && (err.code || err.message)) || err));
    ztoState.ztoSweepLane = { state: denied ? 'denied' : 'failed', lanes: {}, failedAt: Date.now() };
}

export function attachZtoSweepLaneListener(listenerGeneration, keepState?) {
    const sdk = firebaseState.fb;
    const laneRef = firebaseState.dbRefZtoSweepLane;
    if (!sdk || !laneRef || typeof sdk.onValue !== 'function' || typeof sdk.tenantScope === 'function') return false;
    if (!keepState) ztoState.ztoSweepLane = { state: 'pending', lanes: {}, failedAt: 0 };
    sdk.onValue(laneRef, (snapshot) => {
        if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
        noteZtoSweepLane(snapshot.val());
    }, (err) => {
        if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
        noteZtoSweepLaneError(err);
    });
    return true;
}

export function retryZtoSweepLaneListener() {
    const mark = ztoState.ztoSweepLane;
    if (mark.state !== 'denied' && mark.state !== 'failed') return false;
    if (mark.failedAt && elapsedSince(mark.failedAt) < ZTO_SWEEP_LANE_RETRY_MS) return false;
    const sdk = firebaseState.fb;
    const laneRef = firebaseState.dbRefZtoSweepLane;
    if (!sdk || !laneRef) return false;
    if (typeof sdk.off === 'function') { try { sdk.off(laneRef); } catch (e) {} }
    ztoState.ztoSweepLane = Object.assign({}, mark, { failedAt: Date.now() });
    return attachZtoSweepLaneListener(firebaseState.dbListenerGeneration, true);
}

function ztoSweepLaneUsable() {
    const sdk = firebaseState.fb;
    if (ztoState.ztoSweepLane.state !== 'ok' || !firebaseState.db || ztoSweepLaneNotedDb !== firebaseState.db) return false;
    if (firebaseState.isInitializingFirebase || firebaseState.firebaseSdkUnavailable || !cleanupClockIsTrustworthy()) return false;
    if (!sdk || typeof sdk.runTransaction !== 'function' || typeof sdk.ref !== 'function') return false;
    if (ztoSweepLanePaused.db === firebaseState.db && elapsedSince(ztoSweepLanePaused.pausedAt) < ZTO_SWEEP_LANE_RETRY_MS) return false;
    return !!shopScope();
}

function ztoSweepLaneFresh(entry, me, spacing, now) {
    if (!entry || entry.device === me) return false;
    const age = now - entry.at;
    return age >= -ZTO_SWEEP_LANE_FUTURE_MS && age < spacing;
}

export function ztoSweepLaneTurn(lane, cadenceMs) {
    const solo = { mode: 'solo', lane: '', device: '', spacing: 0, waitMs: 0 };
    if (!lane || !ztoSweepLaneUsable()) return solo;
    const me = ztoTrashModeDeviceKey();
    if (!me) return solo;
    const now = getServerNow();
    const seen = ztoSweepLaneSeen.get(lane);
    let peers = 0;
    if (seen) seen.forEach((at, device) => { if (device !== me && now - at <= ZTO_SWEEP_LANE_PEER_SPAN * cadenceMs) peers++; });
    const spacing = Math.max(ZTO_SWEEP_LANE_FLOOR_MS, cadenceMs / (1 + peers));
    const last = ztoState.ztoSweepLane.lanes[lane] || null;
    if (ztoSweepLaneFresh(last, me, spacing, now)) {
        return { mode: 'wait', lane, device: me, spacing, waitMs: spacing - Math.max(0, now - last.at) };
    }
    return { mode: 'claim', lane, device: me, spacing, waitMs: spacing };
}

export async function claimZtoSweepLane(turn) {
    if (!turn || turn.mode !== 'claim') return turn && turn.mode === 'wait' ? 'wait' : 'solo';
    const sdk = firebaseState.fb;
    const laneDb = firebaseState.db;
    const generation = firebaseState.authGeneration;
    const updater = Object.assign((current) => {
        const now = getServerNow();
        if (ztoSweepLaneFresh(ztoSweepLaneEntry(current), turn.device, turn.spacing, now)) return undefined;
        return { device: turn.device, at: now };
    }, { txOutcomeWitness: () => 'not-applied', txAdvisory: true });
    try {
        const res = await withTimeout(Promise.resolve().then(() => sdk.runTransaction(sdk.ref(laneDb, ZTO_SWEEP_LANE_PATH + '/' + turn.lane), updater)),
            ZTO_SWEEP_LANE_CLAIM_TIMEOUT_MS, 'ZTO sweep lane claim timed out');
        return res && res.committed ? 'won' : 'lost';
    } catch (err) {
        if (laneDb === firebaseState.db && generation === firebaseState.authGeneration) ztoSweepLanePaused = { db: laneDb, pausedAt: Date.now() };
        return 'solo';
    }
}
