import { modalIsOpen } from '../core/modals';
import { addPreconnectHint } from '../platform/document-io';
import { lookupState, uiState } from '../core/state';
import { runAutomaticCleanupRules } from '../domain/cleanup';
import { AUTO_LOOKUP_FAIL_COOLDOWN_MS, AUTO_LOOKUP_TRANSIENT_COOLDOWN_MS } from '../features/auto-lookup';
import { safeLookupReason } from '../features/customer-table-prefetch';
import { getLookupApiConfig } from '../features/lookup-config';
import { updateRecentPhonesList } from './db-listeners';
import { refreshEntryPagePanels } from '../ui/entry-list';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { showToast } from '../ui/toast';
import { nativeFunctionRequest, resolveNativeApiUrl } from '../platform/native';
import { refreshNotifyView } from '../features/notifications';

export function preconnectToOrigin(rawUrl) {
    try {
        if (!rawUrl) return;
        const parsed = new URL(rawUrl);
        if (!/^https?:$/.test(parsed.protocol)) return;
        addPreconnectHint(parsed.origin);
    } catch (e) {}
}

export function preconnectToLookupHost() {
    const cfg = getLookupApiConfig();
    if (!cfg || !cfg.enabled || !cfg.url) return;
    preconnectToOrigin(cfg.url);
}

export function preconnectToDatabaseHost(cfg) {
    try {
        if (!cfg || !cfg.databaseURL) return;
        addPreconnectHint(new URL(cfg.databaseURL).origin);
    } catch (e) {}
}

export function waitForFirebaseSDK(timeoutMs = 15000) {
    if (window.firebaseSDK) return Promise.resolve(window.firebaseSDK);
    return new Promise((resolve, reject) => {
        const notReadyErr: any = new Error('Firebase SDK failed to load (network/CDN issue)');
        notReadyErr.code = 'SDK_UNAVAILABLE';
        let timer = null;
        const onReady = () => {
            clearTimeout(timer);
            resolve(window.firebaseSDK);
        };
        window.addEventListener('firebasesdkready', onReady, { once: true });
        timer = setTimeout(() => {
            window.removeEventListener('firebasesdkready', onReady);
            if (window.firebaseSDK) resolve(window.firebaseSDK);
            else reject(notReadyErr);
        }, timeoutMs);
    });
}

export function debounce(fn, ms) {
    let timer = null;
    return function (this: any, ...args: any[]) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

export const debouncedRenderAfterHistorySync = debounce(() => {
    runAutomaticCleanupRules();
    refreshCurrentHistoryView();
    updateRecentPhonesList();
    refreshEntryPagePanels();
    refreshNotifyView();
}, 120);

export function withTimeout(promise, ms, timeoutMsg) {
    const timeoutErr = new Error(timeoutMsg || 'Timed out');
    let timer;
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutErr), ms); })
    ]);
}

export const DB_OP_TIMEOUT_MS = 15000;

export function dbOp(promise, timeoutMsg?) {
    return withTimeout(promise, DB_OP_TIMEOUT_MS, timeoutMsg || 'Database operation stalled');
}

export function dbOpStalled(error) {
    return !!(error && /stalled/i.test(String(error.message || error)));
}

export function armLateCommit(promise, onCommitted, onFailed, label) {
    if (!promise || typeof promise.then !== 'function') return false;
    promise.then((result) => {
        if (result && result.committed) return onCommitted(result);
        return onFailed ? onFailed(null, result) : undefined;
    }, (error) => (onFailed ? onFailed(error, null) : undefined)).catch((error) => {
        console.error('Late commit follow-up failed for', label, error);
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'money', context: 'armLateCommit ' + (label || '') });
    });
    return true;
}

export function armLateWrite(promise, onDone, onFailed, label) {
    if (!promise || typeof promise.then !== 'function') return false;
    promise.then(() => (onDone ? onDone() : undefined), (error) => (onFailed ? onFailed(error) : undefined))
        .catch((error) => {
            console.error('Late write follow-up failed for', label, error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'data', context: 'armLateWrite ' + (label || '') });
        });
    return true;
}

export const LOCK_STALL_RELEASE_MS = DB_OP_TIMEOUT_MS;

export function settleLockWithin(promise, ms, label) {
    if (!promise || typeof promise.then !== 'function') return Promise.resolve(promise);
    let timer = null;
    return new Promise((resolve) => {
        timer = setTimeout(() => { timer = null; resolve(undefined); }, ms);
        promise.then((value) => {
            if (timer !== null) { clearTimeout(timer); timer = null; }
            resolve(value);
        }, (error) => {
            if (timer !== null) { clearTimeout(timer); timer = null; }
            if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'money', context: 'settleLockWithin ' + (label || '') });
            resolve(undefined);
        });
    });
}

export function notifyIfSlow(promise, ms, message) {
    if (!promise || typeof promise.then !== 'function') return promise;
    let timer = setTimeout(() => {
        timer = null;
        showToast(message);
    }, ms);
    const stop = () => {
        if (timer === null) return;
        clearTimeout(timer);
        timer = null;
    };
    promise.then(stop, stop);
    return promise;
}

export function viewListModalShowing(itemId) {
    return modalIsOpen('viewListModal') && uiState.activeParentItemId === itemId;
}

export function fetchWithTimeout(url, options, ms, timeoutMsg, readBody?): Promise<any> {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const opts = Object.assign({}, options || {});
    const sourceSignal = opts.signal || null;
    if (controller) opts.signal = controller.signal;
    const timeoutErr = new Error(timeoutMsg || 'Timed out');
    let settled = false;
    let timer = null;
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
            if (sourceSignal && typeof sourceSignal.removeEventListener === 'function') {
                sourceSignal.removeEventListener('abort', abortFromSource);
            }
        };
        const abortFromSource = () => {
            if (settled) return;
            settled = true;
            if (controller) { try { controller.abort(); } catch (e) {} }
            cleanup();
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
        };
        if (sourceSignal && typeof sourceSignal.addEventListener === 'function') {
            if (sourceSignal.aborted) {
                abortFromSource();
                return;
            }
            sourceSignal.addEventListener('abort', abortFromSource, { once: true });
        }
        timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            if (controller) { try { controller.abort(); } catch (e) {} }
            cleanup();
            reject(timeoutErr);
        }, ms);
        const legacyUrl = resolveNativeApiUrl(url);
        const request = lookupState.nativeQueryHeaderUnsupported ? { url: legacyUrl, options: opts } : nativeFunctionRequest(url, opts);
        fetch(request.url, request.options).then((res) => {
            if (request.url === legacyUrl || settled || !res || res.status !== 400) return res;
            return fetch(legacyUrl, opts).then((legacy) => {
                if (legacy && legacy.status !== 400) lookupState.nativeQueryHeaderUnsupported = true;
                return legacy;
            });
        }).then((res) => {
            if (settled) return null;
            if (!readBody) return { res: res, body: undefined };
            return Promise.resolve(readBody(res)).then((body) => ({ res: res, body: body }));
        }, (err) => {
            if (settled) return null;
            settled = true;
            cleanup();
            reject(err);
            return null;
        }).then((out) => {
            if (settled || !out) return;
            settled = true;
            cleanup();
            resolve(out);
        }, (err) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(err);
        });
    });
}

export function retryAsync(fn, attempts, delayMs) {
    return fn().catch((err) => {
        if (attempts <= 1 || (err && err.noRetry)) throw err;
        return new Promise((resolve) => setTimeout(resolve, delayMs)).then(() => retryAsync(fn, attempts - 1, delayMs * 2));
    });
}

export function lookupResponseError(status, body, retryable) {
    const error: any = new Error('HTTP ' + status);
    error.lookupCode = body && body.code ? String(body.code) : '';
    error.lookupReason = safeLookupReason(body && body.reason);
    if (!retryable) error.noRetry = true;
    return error;
}

export function markLookupTimeoutNoRetry(error) {
    if (error && error.message === 'Auto lookup timed out') error.noRetry = true;
    throw error;
}

export function lookupFailureCooldownMs(kind) {
    return kind === 'transient' ? AUTO_LOOKUP_TRANSIENT_COOLDOWN_MS : AUTO_LOOKUP_FAIL_COOLDOWN_MS;
}

export function lookupFailureIsDefinitive(error) {
    const code = String(error && error.lookupCode || '');
    if (code === 'ZTO_AUTH_EXPIRED' || code === 'ZTO_AUTH_NOT_CONFIGURED'
        || code === 'ZTO_CONFIG_INVALID' || code === 'ZTO_PROXY_NOT_CONFIGURED') return true;
    return /^HTTP (401|403)$/.test(error && error.message || '');
}

export function noteSheetScriptVersion(body) {
    const raw = body && body.scriptVersion;
    const seen = typeof raw === 'number' ? raw : parseInt(String(raw === undefined ? '' : raw), 10);
    if (!Number.isFinite(seen) || seen < 0) return;
    lookupState.sheetScriptVersionSeen = seen;
}

export function retryTransientLookupResponse(out) {
    noteSheetScriptVersion(out && out.body);
    const status = Number(out && out.res && out.res.status);
    const code = String(out && out.body && out.body.code || '');
    if (code === 'ZTO_AUTH_NOT_CONFIGURED' || code === 'ZTO_CONFIG_INVALID'
        || code === 'ZTO_PROXY_NOT_CONFIGURED') return out;
    if (code === 'ZTO_TIMEOUT') {
        throw lookupResponseError(status, out && out.body, false);
    }
    if (status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599)) {
        throw lookupResponseError(status, out && out.body, true);
    }
    return out;
}

export function linkIsFrugal() {
    const link = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!link) return false;
    if (link.saveData === true) return true;
    const type = String(link.effectiveType || '');
    return type === 'slow-2g' || type === '2g';
}
