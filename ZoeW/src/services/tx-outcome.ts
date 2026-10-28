import { firebaseState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { fetchWithTimeout, withTimeout } from './network';
import { txDisconnectResolving, txMutationSources } from './tx-disconnect';
import { withFirebaseAuthOwnership } from './firebase-auth-owner';
import { withConnectionOwnership } from './connection-flow';

export { txDisconnectResolving };

export const TX_OUTCOME_READ_TIMEOUT_MS = 8000;

export const TX_OUTCOME_RETRY_GAP_MS = 2000;

export const TX_OUTCOME_MAX_GAP_MS = 30000;

export const TX_OUTCOME_MAX_REFUSALS = 30;

export const TX_OUTCOME_GATE_RELEASE_FAILS = 3;

export const txResolvingPaths = new Map();

export const txOutcomeUnknownReported = new Set();

export function transactionDisconnectPending(promise) {
    if (!promise || typeof promise !== 'object') return null;
    const direct = txDisconnectResolving.get(promise);
    if (direct) return direct;
    const source = txMutationSources.get(promise);
    return source && source.promise && source.promise !== promise ? transactionDisconnectPending(source.promise) : null;
}

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
    let namespace;
    try {
        loc = new URL(raw);
        const configured = String((cfg && cfg.databaseURL) || '');
        base = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(configured) ? configured : 'https://' + configured);
        const queryAt = configured.indexOf('?');
        if (queryAt >= 0) for (const segment of configured.slice(queryAt + 1).split('&')) {
            const pair = segment.split('=');
            if (pair.length === 2 && decodeURIComponent(pair[0]) === 'ns') namespace = decodeURIComponent(pair[1]);
        }
    } catch (e) {
        return '';
    }
    if (loc.host !== base.host) return '';
    const local = /^(?:127\.0\.0\.1|localhost)$/i.test(loc.hostname);
    if (loc.protocol !== 'https:' && !(local && loc.protocol === 'http:')) return '';
    if (!local && !/\.(?:firebaseio\.com|firebasedatabase\.app)$/i.test(loc.hostname)) return '';
    const url = new URL(loc.origin + loc.pathname.replace(/\/+$/, '') + '.json');
    if (namespace !== undefined) url.searchParams.set('ns', namespace);
    return url.toString();
}

export async function txReadServerValue(restUrl, budgetMs = TX_OUTCOME_READ_TIMEOUT_MS) {
    const startedAt = Date.now();
    const user = firebaseState.auth && firebaseState.auth.currentUser;
    if (!restUrl || !user || typeof user.getIdToken !== 'function') throw new Error('Transaction outcome read unavailable');
    const token = await withTimeout(user.getIdToken(), budgetMs, 'Transaction outcome token timed out');
    const remaining = budgetMs - elapsedSince(startedAt);
    if (!token || !firebaseState.auth || firebaseState.auth.currentUser !== user) throw new Error('Transaction outcome read unavailable');
    if (remaining <= 0) throw new Error('Transaction outcome read timed out');
    const url = new URL(restUrl);
    url.searchParams.set('auth', String(token));
    const out = await fetchWithTimeout(url.toString(), { cache: 'no-store', credentials: 'omit' },
        remaining, 'Transaction outcome read timed out',
        (res) => (res && res.ok ? res.json() : Promise.reject(new Error('HTTP ' + (res ? res.status : 0)))));
    return out.body === undefined ? null : out.body;
}

export function txDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function txReadWasRefused(error) {
    const text = String((error && error.message) || error || '');
    if (/^Transaction outcome read unavailable$/.test(text)) return true;
    const m = /^HTTP (\d{3})$/.exec(text);
    return !!m && Number(m[1]) < 500;
}

export async function txResolveOutcome(restUrl, sentValue, priorValue, onStuck?, witness?) {
    const capturedAuthGeneration = firebaseState.authGeneration;
    const capturedDb = firebaseState.db;
    const current = () => firebaseState.authGeneration === capturedAuthGeneration && firebaseState.db === capturedDb;
    let refusals = 0;
    let onlineFailures = 0;
    let gap = TX_OUTCOME_RETRY_GAP_MS;
    for (let attempt = 0; current(); attempt++) {
        if (attempt) {
            await txDelay(gap);
            if (!current()) break;
        }
        if ((navigator.onLine as boolean) === false) {
            gap = TX_OUTCOME_RETRY_GAP_MS;
            continue;
        }
        let server;
        try {
            server = await txReadServerValue(restUrl, TX_OUTCOME_READ_TIMEOUT_MS);
        } catch (e) {
            gap = Math.min(gap * 2, TX_OUTCOME_MAX_GAP_MS);
            if (++onlineFailures === TX_OUTCOME_GATE_RELEASE_FAILS && typeof onStuck === 'function') onStuck();
            if (txReadWasRefused(e) && ++refusals >= TX_OUTCOME_MAX_REFUSALS) break;
            continue;
        }
        if (!current()) break;
        if (txSameValue(server, sentValue)) return { outcome: 'applied', server };
        if (txSameValue(server, priorValue)) return { outcome: 'not-applied', server };
        let witnessed = null;
        try {
            witnessed = typeof witness === 'function' ? witness(server, priorValue) : null;
        } catch (e) {
            witnessed = null;
        }
        if (witnessed === 'applied') return { outcome: 'applied', server, committed: sentValue };
        if (witnessed === 'not-applied') return { outcome: 'not-applied', server };
        return { outcome: 'unknown', server };
    }
    return { outcome: 'unknown', server: undefined };
}

export function txPathKey(restUrl) {
    if (!restUrl) return '';
    try {
        const url = new URL(restUrl);
        return url.origin + url.pathname.replace(/\.json$/, '') + '|' + (url.searchParams.get('ns') || '');
    } catch (e) {
        return '';
    }
}

export function txResolvingBlockers(key) {
    if (!key) return [];
    const [path, ns] = key.split('|');
    const out = [];
    txResolvingPaths.forEach((entry, other) => {
        const [otherPath, otherNs] = other.split('|');
        if (ns !== otherNs) return;
        if (otherPath === path || otherPath.startsWith(path + '/') || path.startsWith(otherPath + '/')) entry.forEach((e) => out.push(e));
    });
    return out;
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

export function reportTxOutcomeUnknown(restUrl, context = 'runTransactionResolved') {
    let path = String(restUrl || '');
    let origin = '';
    try {
        const url = new URL(restUrl);
        path = url.pathname;
        origin = url.origin;
    } catch (e) {}
    noteTxOutcomeUnknown(origin, path, context);
}

export function noteTxOutcomeUnknown(scope, path, context) {
    const key = String(scope || '') + '|' + path + '#' + Math.floor(Date.now() / 600000);
    if (txOutcomeUnknownReported.has(key)) return;
    if (txOutcomeUnknownReported.size >= 200) txOutcomeUnknownReported.clear();
    txOutcomeUnknownReported.add(key);
    if (window.ZoeErrors) ZoeErrors.capture(new Error('Transaction outcome unknown after disconnect'), { zone: 'money', context, path });
}

export function txTrackResolving(key, error) {
    if (!key) return () => {};
    let open;
    const entry = { error, released: new Promise<void>((resolve) => { open = resolve; }) };
    let entries = txResolvingPaths.get(key);
    if (!entries) {
        entries = new Set();
        txResolvingPaths.set(key, entries);
    }
    entries.add(entry);
    return () => {
        open();
        const live = txResolvingPaths.get(key);
        if (!live) return;
        live.delete(entry);
        if (!live.size) txResolvingPaths.delete(key);
    };
}

export function runTransactionResolved(sdk, ref, updater, options) {
    const pathKey = txPathKey(txRestUrl(ref));
    const blockers = txResolvingBlockers(pathKey);
    if (blockers.length) {
        const waited = Promise.all(blockers.map((b) => b.released)).then(() => runTransactionResolved(sdk, ref, updater, options));
        txDisconnectResolving.set(waited, blockers[0].error);
        waited.then(() => txDisconnectResolving.delete(waited), () => txDisconnectResolving.delete(waited));
        return waited;
    }
    let ran = false;
    let sent;
    let prior;
    const witness = updater && typeof updater.txOutcomeWitness === 'function' ? updater.txOutcomeWitness : null;
    let thrown = null;
    const tracked = (current) => {
        thrown = null;
        const before = txCloneJson(current);
        let result;
        try {
            result = updater(current);
        } catch (error) {
            thrown = error || new Error('Transaction updater failed');
            result = undefined;
        }
        ran = true;
        prior = before === undefined ? null : before;
        sent = result === undefined ? undefined : txCloneJson(result);
        return result;
    };
    if (updater && updater.connectionIntent) (tracked as any).connectionIntent = updater.connectionIntent;
    let started;
    try {
        started = options === undefined ? sdk.runTransaction(ref, tracked) : sdk.runTransaction(ref, tracked, options);
    } catch (e) {
        return Promise.reject(e);
    }
    const settled = Promise.resolve(started).then((result) => {
        if (thrown) throw thrown;
        return result;
    });
    if (updater && updater.txAdvisory === true) {
        return settled.catch((error) => {
            if (error && typeof error === 'object' && !/permission[_ ]denied/i.test(String(error.code || error.message))) {
                try { error.txOutcome = 'not-applied'; } catch (e) {}
            }
            throw error;
        });
    }
    const outcome = settled.catch((error) => {
        if (!transactionOutcomeUnknown(error) || !ran || sent === undefined) throw error;
        const restUrl = txRestUrl(ref);
        if (!restUrl) throw error;
        const sentValue = sent;
        const priorValue = prior;
        txDisconnectResolving.set(outcome, error);
        const releaseGate = txTrackResolving(pathKey, error);
        const resolving = txResolveOutcome(restUrl, sentValue, priorValue, releaseGate, witness);
        resolving.then(releaseGate, releaseGate);
        return resolving.then((resolved) => {
            txDisconnectResolving.delete(outcome);
            if (resolved.outcome === 'applied') {
                const committed = 'committed' in resolved ? resolved.committed : resolved.server;
                return { committed: true, snapshot: txSnapshotOf(ref, committed), txOutcome: 'applied' };
            }
            try { error.txOutcome = resolved.outcome; } catch (e) {}
            if (resolved.outcome === 'unknown' && resolved.server === undefined) {
                try { error.txServerUnread = true; } catch (e) {}
            }
            if (resolved.outcome === 'unknown') reportTxOutcomeUnknown(restUrl);
            throw error;
        }, (resolveErr) => {
            txDisconnectResolving.delete(outcome);
            throw resolveErr;
        });
    });
    return outcome;
}

export function withTransactionOutcomeResolution(sdk) {
    if (!sdk || typeof sdk !== 'object' || typeof Proxy !== 'function') return sdk;
    if (typeof sdk.beforeAuthStateChanged === 'function') sdk = withFirebaseAuthOwnership(sdk);
    if (sdk.__txOutcomeResolved) return sdk;
    const resolved = new Proxy(sdk, {
        get(target, prop) {
            if (prop === '__txOutcomeResolved') return true;
            if (prop === 'runTransaction') {
                if (typeof target.runTransaction !== 'function') return target.runTransaction;
                return (ref, updater, options) => runTransactionResolved(target, ref, updater, options);
            }
            return target[prop];
        }
    });
    return withConnectionOwnership(resolved);
}
