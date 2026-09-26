import { firebaseState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { fetchWithTimeout } from './network';

export const TX_OUTCOME_READ_TIMEOUT_MS = 8000;

export const TX_OUTCOME_RETRY_GAP_MS = 2000;

export const TX_OUTCOME_MAX_ATTEMPTS = 30;

export const TX_OUTCOME_MAX_WAIT_MS = 60000;

export const txOutcomeUnknownReported = new Set();

export function transactionOutcomeUnknown(error) {
    if (!error) return false;
    return /^(?:Error:\s*)?disconnect$/i.test(String(error.message || error).trim());
}

export function txCloneJson(value) {
    if (value === undefined) return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (e) {
        return undefined;
    }
}

export function txCanonical(value, depth?) {
    const level = depth || 0;
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'object') return value;
    if (level > 64) return null;
    const keys = Array.isArray(value) ? value.map((_, i) => String(i)) : Object.keys(value);
    const out = {};
    keys.sort().forEach((key) => {
        const next = txCanonical(value[key], level + 1);
        if (next !== null) out[key] = next;
    });
    return Object.keys(out).length ? out : null;
}

export function txSameValue(a, b) {
    return JSON.stringify(txCanonical(a)) === JSON.stringify(txCanonical(b));
}

export function txRestUrl(ref) {
    let raw = '';
    try {
        raw = ref && typeof ref.toString === 'function' ? String(ref.toString()) : '';
    } catch (e) {
        return '';
    }
    if (!/^https?:\/\//i.test(raw)) return '';
    const cfg = firebaseState.firebaseConfig;
    let loc;
    let base;
    try {
        loc = new URL(raw);
        base = new URL(String((cfg && cfg.databaseURL) || ''));
    } catch (e) {
        return '';
    }
    if (loc.host !== base.host) return '';
    const local = /^(?:127\.0\.0\.1|localhost)$/i.test(loc.hostname);
    if (loc.protocol !== 'https:' && !(local && loc.protocol === 'http:')) return '';
    if (!local && !/\.(?:firebaseio\.com|firebasedatabase\.app)$/i.test(loc.hostname)) return '';
    const url = new URL(loc.origin + loc.pathname.replace(/\/+$/, '') + '.json');
    const ns = base.searchParams.get('ns');
    if (ns) url.searchParams.set('ns', ns);
    return url.toString();
}

export async function txReadServerValue(restUrl) {
    const user = firebaseState.auth && firebaseState.auth.currentUser;
    if (!restUrl || !user || typeof user.getIdToken !== 'function') throw new Error('Transaction outcome read unavailable');
    const token = await user.getIdToken();
    if (!token) throw new Error('Transaction outcome read unavailable');
    const url = new URL(restUrl);
    url.searchParams.set('auth', String(token));
    const out = await fetchWithTimeout(url.toString(), { cache: 'no-store', credentials: 'omit' },
        TX_OUTCOME_READ_TIMEOUT_MS, 'Transaction outcome read timed out',
        (res) => (res && res.ok ? res.json() : Promise.reject(new Error('HTTP ' + (res ? res.status : 0)))));
    return out.body === undefined ? null : out.body;
}

export function txDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function txResolveOutcome(restUrl, sentValue, priorValue) {
    const startedAt = Date.now();
    for (let attempt = 0; attempt < TX_OUTCOME_MAX_ATTEMPTS; attempt++) {
        if (attempt) {
            if (elapsedSince(startedAt) >= TX_OUTCOME_MAX_WAIT_MS) break;
            await txDelay(TX_OUTCOME_RETRY_GAP_MS);
        }
        if ((navigator.onLine as boolean) === false) continue;
        let server;
        try {
            server = await txReadServerValue(restUrl);
        } catch (e) {
            continue;
        }
        if (txSameValue(server, sentValue)) return { outcome: 'applied', server };
        if (txSameValue(server, priorValue)) return { outcome: 'not-applied', server };
        return { outcome: 'unknown', server };
    }
    return { outcome: 'unknown', server: undefined };
}

export function txSnapshotOf(ref, value) {
    const frozen = txCloneJson(value === undefined ? null : value);
    return {
        key: ref && typeof ref.key === 'string' ? ref.key : null,
        ref,
        val: () => txCloneJson(frozen === undefined ? null : frozen),
        exists: () => frozen !== null && frozen !== undefined
    };
}

export function reportTxOutcomeUnknown(restUrl) {
    let path = '';
    try { path = new URL(restUrl).pathname; } catch (e) {}
    if (txOutcomeUnknownReported.has(path)) return;
    txOutcomeUnknownReported.add(path);
    if (window.ZoeErrors) ZoeErrors.capture(new Error('Transaction outcome unknown after disconnect'), { zone: 'money', context: 'runTransactionResolved', path });
}

export function runTransactionResolved(sdk, ref, updater, options) {
    let ran = false;
    let sent;
    let prior;
    const tracked = (current) => {
        const before = txCloneJson(current);
        const result = updater(current);
        ran = true;
        prior = before === undefined ? null : before;
        sent = result === undefined ? undefined : txCloneJson(result);
        return result;
    };
    let started;
    try {
        started = options === undefined ? sdk.runTransaction(ref, tracked) : sdk.runTransaction(ref, tracked, options);
    } catch (e) {
        return Promise.reject(e);
    }
    return Promise.resolve(started).catch((error) => {
        if (!transactionOutcomeUnknown(error) || !ran || sent === undefined) throw error;
        const restUrl = txRestUrl(ref);
        if (!restUrl) throw error;
        const sentValue = sent;
        const priorValue = prior;
        return txResolveOutcome(restUrl, sentValue, priorValue).then((resolved) => {
            if (resolved.outcome === 'applied') {
                return { committed: true, snapshot: txSnapshotOf(ref, resolved.server), txOutcome: 'applied' };
            }
            try { error.txOutcome = resolved.outcome; } catch (e) {}
            if (resolved.outcome === 'unknown') reportTxOutcomeUnknown(restUrl);
            throw error;
        });
    });
}

export function withTransactionOutcomeResolution(sdk) {
    if (!sdk || typeof sdk !== 'object' || typeof Proxy !== 'function') return sdk;
    if (sdk.__txOutcomeResolved) return sdk;
    return new Proxy(sdk, {
        get(target, prop) {
            if (prop === '__txOutcomeResolved') return true;
            if (prop === 'runTransaction') {
                if (typeof target.runTransaction !== 'function') return target.runTransaction;
                return (ref, updater, options) => runTransactionResolved(target, ref, updater, options);
            }
            return target[prop];
        }
    });
}
