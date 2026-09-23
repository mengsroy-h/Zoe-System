import { fieldValue, focusField, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { lookupState, scanState, securityState, uiState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { normalizeStoredPhone } from '../core/text';
import { isPinFlowPending } from './config';
import { findCustomerDataTableRow, getNestedField, rememberCustomerTableRow } from './customer-table';
import { lookupApiIsZto, scheduleCustomerTableSoonRefresh } from './customer-table-prefetch';
import { lookupApiSendsHeader } from './lookup-api';
import { getLookupApiConfig } from './lookup-config';
import { requestPinBeforeConfig } from './pin';
import { confirmPhone } from './scan-action';
import { decryptLookupSecret } from '../services/crypto';
import { fetchWithTimeout, lookupFailureCooldownMs, lookupFailureIsDefinitive, lookupResponseError, markLookupTimeoutNoRetry, retryAsync, retryTransientLookupResponse } from '../services/network';
import { showToast } from '../ui/toast';

export const AUTO_LOOKUP_FAIL_COOLDOWN_MS = 30 * 1000;

export const AUTO_LOOKUP_TRANSIENT_COOLDOWN_MS = 6 * 1000;

export const AUTO_LOOKUP_FAILURE_MAX = 100;

export const LOOKUP_FOCUS_GRACE_MS = 250;

export const LOOKUP_MANUAL_FALLBACK_MS = 1800;

export const LOOKUP_FOCUS_MAX_WAIT_MS = 15000;

export const AUTO_LOOKUP_MAX_IN_FLIGHT = 2;

export const AUTO_LOOKUP_QUEUE_RETRY_MS = 400;

export const AUTO_LOOKUP_QUEUE_MAX_WAIT_MS = 20000;

export const AUTO_LOOKUP_TIMEOUT_MS = 16000;

export const ZTO_AUTO_LOOKUP_TIMEOUT_MS = 13000;

export const LOOKUP_TEST_TIMEOUT_MS = 20000;

export const ZTO_TEST_TIMEOUT_MS = 11000;

export const LOOKUP_FAST_CACHE_TTL_MS = 10 * 60 * 1000;

export const LOOKUP_FAST_CACHE_MAX = 300;

export const autoLookupInFlight = new Map();

export const autoLookupFailureAt = new Map();

export const autoLookupQueueRetries = new Map();

export const lookupFastCache = new Map();

export function clearAutoLookupQueueRetries() {
    autoLookupQueueRetries.forEach((queued) => {
        if (queued && queued.timer) clearTimeout(queued.timer);
    });
    autoLookupQueueRetries.clear();
}

export function dropAutoLookupQueueEntry(key) {
    const queued = autoLookupQueueRetries.get(key);
    if (!queued) return;
    if (queued.timer) clearTimeout(queued.timer);
    autoLookupQueueRetries.delete(key);
}

export function scheduleAutoLookupQueueRetry(barcode) {
    const key = String(barcode || '').trim().toUpperCase();
    if (!key) return false;
    const existing = autoLookupQueueRetries.get(key);
    const waiting = !!(existing && (existing.timer || existing.pending));
    const armedAt = (waiting && existing.armedAt) || Date.now();
    if (waiting && elapsedSince(armedAt) >= AUTO_LOOKUP_QUEUE_MAX_WAIT_MS) {
        dropAutoLookupQueueEntry(key);
        return false;
    }
    if (existing && existing.timer) return true;
    const timer = setTimeout(() => {
        const queued = autoLookupQueueRetries.get(key);
        if (queued) { queued.timer = null; queued.pending = true; }
        if (scanState.pendingBarcode !== barcode || !uiState.isModalOpen) {
            dropAutoLookupQueueEntry(key);
            return;
        }
        if (elapsedSince(armedAt) >= AUTO_LOOKUP_QUEUE_MAX_WAIT_MS) {
            dropAutoLookupQueueEntry(key);
            setLookupStatus(barcode, 'warn', '⏳ Lookup រវល់យូរពេក — សូមស្កេនម្ដងទៀត');
            return;
        }
        attemptAutoLookup(barcode);
    }, AUTO_LOOKUP_QUEUE_RETRY_MS);
    autoLookupQueueRetries.set(key, { timer, armedAt });
    return true;
}

export function pumpAutoLookupQueue() {
    if (!autoLookupQueueRetries.size) return;
    if (autoLookupInFlight.size >= AUTO_LOOKUP_MAX_IN_FLIGHT) return;
    if (!uiState.isModalOpen || !scanState.pendingBarcode) return;
    const key = String(scanState.pendingBarcode).trim().toUpperCase();
    if (!autoLookupQueueRetries.has(key)) return;
    const barcode = scanState.pendingBarcode;
    dropAutoLookupQueueEntry(key);
    attemptAutoLookup(barcode);
}

export function clearLookupStatus() {
    viewState.lookupStatus = { kind: '', text: '' };
}

export function setLookupStatus(barcode, kind, text) {
    if (barcode && (scanState.pendingBarcode !== barcode || !uiState.isModalOpen)) return false;
    const classes = {
        loading: 'lookup-status-loading',
        success: 'lookup-status-success',
        warn: 'lookup-status-warn',
        error: 'lookup-status-error',
        offline: 'lookup-status-offline',
        cache: 'lookup-status-cache'
    };
    viewState.lookupStatus = { kind: classes[kind] || classes.warn, text: String(text || '') };
    return true;
}

export function getFastLookupRow(barcode, cfg) {
    if (!cfg.fastMode) return null;
    const key = String(barcode || '').trim().toUpperCase();
    const entry = lookupFastCache.get(key);
    if (!entry) return null;
    if (elapsedSince(entry.storedAt) >= LOOKUP_FAST_CACHE_TTL_MS) {
        lookupFastCache.delete(key);
        return null;
    }
    lookupFastCache.delete(key);
    lookupFastCache.set(key, entry);
    return entry.row;
}

export function setFastLookupRow(barcode, phone, cod, dod, cfg) {
    if (!cfg.fastMode) return;
    const key = String(barcode || '').trim().toUpperCase();
    if (!key) return;
    lookupFastCache.delete(key);
    lookupFastCache.set(key, {
        storedAt: Date.now(),
        row: { phone: phone, cod: cod, dod: dod }
    });
    while (lookupFastCache.size > LOOKUP_FAST_CACHE_MAX) {
        lookupFastCache.delete(lookupFastCache.keys().next().value);
    }
}

export function applyLookupFillToModal(barcode, phoneVal, codVal, dodVal, cfg) {
    if (scanState.pendingBarcode !== barcode || !uiState.isModalOpen) return false;

    let filledAny = false;
    let phoneWasAutoFilled = false;

    if (phoneVal && !fieldValue('modalPhoneInput')) {
        setFieldValue('modalPhoneInput', normalizeStoredPhone(phoneVal));
        filledAny = true;
        phoneWasAutoFilled = true;
    }

    if (codVal !== null && codVal !== undefined && !isNaN(parseFloat(codVal)) && !fieldValue('modalCodInput')) {
        setFieldValue('modalCodInput', String(parseFloat(codVal)));
        filledAny = true;
    }

    if (dodVal !== null && dodVal !== undefined && !isNaN(parseFloat(dodVal)) && !fieldValue('modalDodInput')) {
        setFieldValue('modalDodInput', String(parseFloat(dodVal)));
        filledAny = true;
    }

    if (cfg.autoSubmit && phoneWasAutoFilled && scanState.pendingBarcode === barcode && uiState.isModalOpen) {
        showToast("⏳ បានរកឃើញអតិថិជន — កំពុងរក្សាទុកស្វ័យប្រវត្តិ...");
        confirmPhone(false);
    } else if (filledAny) {
        showToast("✅ បានទាញយកទិន្នន័យអតិថិជនស្វ័យប្រវត្តិ!");
    }
    return filledAny;
}

export function retryPendingLookupAfterUnlock() {
    const barcode = lookupState.pendingLookupUnlockBarcode;
    const resolve = lookupState.pendingLookupUnlockResolve;
    lookupState.pendingLookupUnlockBarcode = '';
    lookupState.pendingLookupUnlockResolve = null;
    lookupState.lookupLockedNoticeShown = false;
    if (!barcode || scanState.pendingBarcode !== barcode) {
        if (resolve) resolve();
        return;
    }
    Promise.resolve(attemptAutoLookup(barcode)).then(resolve, resolve);
}

export function cancelPendingLookupUnlock() {
    const resolve = lookupState.pendingLookupUnlockResolve;
    lookupState.pendingLookupUnlockBarcode = '';
    lookupState.pendingLookupUnlockResolve = null;
    lookupState.lookupLockedNoticeShown = false;
    if (resolve) resolve();
}

export function lookupIsWorkingOn(barcode) {
    const key = String(barcode || '').trim().toUpperCase();
    if (!key) return false;
    if (autoLookupInFlight.has(key)) return true;
    if (autoLookupQueueRetries.has(key)) return true;
    return String(lookupState.pendingLookupUnlockBarcode || '').trim().toUpperCase() === key;
}

export function armLookupFocus(phoneInputName, barcode, lookupPromise) {
    let focused = false;
    let fallbackTimer = null;
    let waitingForPin = false;
    const armedAt = Date.now();
    const lookupStillWorking = () => elapsedSince(armedAt) < LOOKUP_FOCUS_MAX_WAIT_MS && lookupIsWorkingOn(barcode);
    const focusIfEmpty = () => {
        if (focused || isPinFlowPending()) return;
        if (!uiState.isModalOpen || scanState.pendingBarcode !== barcode) return;
        if (!phoneInputName || fieldValue(phoneInputName)) return;
        focused = true;
        focusField(phoneInputName);
    };
    const armFallback = (ms) => {
        if (fallbackTimer !== null) clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(runFallback, ms);
    };
    const runFallback = () => {
        fallbackTimer = null;
        if (focused) return;
        if (!uiState.isModalOpen || scanState.pendingBarcode !== barcode) return;
        if (isPinFlowPending()) {
            waitingForPin = true;
            armFallback(LOOKUP_FOCUS_GRACE_MS);
            return;
        }
        if (waitingForPin) {
            waitingForPin = false;
            armFallback(LOOKUP_MANUAL_FALLBACK_MS);
            return;
        }
        if (lookupStillWorking()) {
            armFallback(LOOKUP_FOCUS_GRACE_MS);
            return;
        }
        focusIfEmpty();
    };
    armFallback(isPinFlowPending() ? LOOKUP_FOCUS_GRACE_MS : LOOKUP_MANUAL_FALLBACK_MS);
    return Promise.resolve(lookupPromise).finally(() => {
        armFallback(LOOKUP_FOCUS_GRACE_MS);
    });
}

export async function attemptAutoLookup(barcode) {
    const lookupKey = String(barcode || '').trim().toUpperCase();
    const cfg = getLookupApiConfig();
    if (!cfg || !cfg.enabled || !cfg.url) { dropAutoLookupQueueEntry(lookupKey); return; }
    const isZtoLookup = lookupApiIsZto(cfg);
    const lookupSource = isZtoLookup ? 'ZTO' : 'API';

    const fastCachedRow = getFastLookupRow(barcode, cfg);
    if (fastCachedRow) {
        dropAutoLookupQueueEntry(lookupKey);
        setLookupStatus(barcode, 'cache', '⚡ រកឃើញភ្លាមពី cache ក្នុងឧបករណ៍');
        applyLookupFillToModal(barcode, fastCachedRow.phone, fastCachedRow.cod, fastCachedRow.dod, cfg);
        return;
    }

    const cachedRow = findCustomerDataTableRow(barcode);
    if (cachedRow) {
        dropAutoLookupQueueEntry(lookupKey);
        setLookupStatus(barcode, 'cache', '⚡ រកឃើញភ្លាមពីតារាងអតិថិជន');
        applyLookupFillToModal(barcode, cachedRow.phone, cachedRow.cod, cachedRow.dod, cfg);
        return;
    }

    scheduleCustomerTableSoonRefresh();

    if (lookupApiSendsHeader(cfg) && cfg.headerValueEnc && !securityState.lookupSecretKey) {
        dropAutoLookupQueueEntry(lookupKey);
        setLookupStatus(barcode, 'warn', '🔒 សូមវាយ PIN ដើម្បីដោះសោ ' + lookupSource + ' Lookup');
        if (lookupState.pendingLookupUnlockResolve) lookupState.pendingLookupUnlockResolve();
        lookupState.pendingLookupUnlockBarcode = String(barcode || '');
        return new Promise((resolve) => {
            lookupState.pendingLookupUnlockResolve = resolve;
            if (!lookupState.lookupLockedNoticeShown) {
                lookupState.lookupLockedNoticeShown = true;
                showToast("🔒 សូមវាយ PIN ម្តង ដើម្បីដោះសោការស្វែងរកអតិថិជន");
            }
            if (!isPinFlowPending()) requestPinBeforeConfig(retryPendingLookupAfterUnlock, 'lookupUnlock');
        });
    }

    if ((navigator.onLine as boolean) === false) {
        dropAutoLookupQueueEntry(lookupKey);
        setLookupStatus(barcode, 'offline', '📴 ក្រៅបណ្ដាញ — សូមភ្ជាប់បណ្ដាញ ហើយស្កេនម្ដងទៀត');
        return;
    }

    const failureRecord = autoLookupFailureAt.get(lookupKey);
    const failedAt = (failureRecord && typeof failureRecord === 'object' ? failureRecord.at : failureRecord) || 0;
    const failureCooldownMs = (failureRecord && typeof failureRecord === 'object' && failureRecord.ms)
        || AUTO_LOOKUP_FAIL_COOLDOWN_MS;
    const failedElapsed = elapsedSince(failedAt);
    if (failedElapsed < failureCooldownMs) {
        dropAutoLookupQueueEntry(lookupKey);
        const waitSeconds = Math.max(1, Math.ceil((failureCooldownMs - failedElapsed) / 1000));
        setLookupStatus(barcode, 'warn', '⏳ ' + lookupSource + ' ទើបខកខាន — សូមស្កេនម្ដងទៀតក្រោយ ' + waitSeconds + ' វិ.');
        return;
    }

    if (autoLookupInFlight.has(lookupKey)) {
        dropAutoLookupQueueEntry(lookupKey);
        setLookupStatus(barcode, 'loading', '🔎 កំពុងស្វែងរកពី ' + lookupSource + '...');
        return;
    }
    if (autoLookupInFlight.size >= AUTO_LOOKUP_MAX_IN_FLIGHT) {
        if (scheduleAutoLookupQueueRetry(barcode)) {
            setLookupStatus(barcode, 'loading', '🔎 កំពុងរង់ចាំជួរ ' + lookupSource + '...');
        } else {
            setLookupStatus(barcode, 'warn', '⏳ Lookup រវល់យូរពេក — សូមស្កេនម្ដងទៀត');
        }
        return;
    }
    const lookupRunToken = {};
    autoLookupInFlight.set(lookupKey, lookupRunToken);
    dropAutoLookupQueueEntry(lookupKey);

    const myGeneration = lookupState.customerDataTableSessionGeneration;
    const startedAt = Date.now();
    setLookupStatus(barcode, 'loading', isZtoLookup ? '🔎 កំពុងស្វែងរកពី ZTO...' : '🔎 កំពុងស្វែងរកព័ត៌មានអតិថិជន...');
    try {
        const targetUrl = cfg.url.replace('{barcode}', encodeURIComponent(barcode));
        const headers = {};
        if (lookupApiSendsHeader(cfg)) {
            if (cfg.headerValueEnc) {
                const decrypted = await decryptLookupSecret(cfg.headerValueEnc);
                if (decrypted) headers[cfg.headerName] = decrypted;
            } else if (cfg.headerValue) {
                headers[cfg.headerName] = cfg.headerValue;
            }
        }

        const out = await retryAsync(
            () => fetchWithTimeout(targetUrl, { headers }, isZtoLookup ? ZTO_AUTO_LOOKUP_TIMEOUT_MS : AUTO_LOOKUP_TIMEOUT_MS, 'Auto lookup timed out',
                (r) => r.json().catch(() => null))
                .catch(markLookupTimeoutNoRetry)
                .then(retryTransientLookupResponse),
            2, isZtoLookup ? 350 : 1500
        );
        const data = out.body;
        if (!out.res.ok) throw lookupResponseError(out.res.status, data, false);
        if (myGeneration !== lookupState.customerDataTableSessionGeneration) return;
        if (data && data.error) throw new Error('Lookup rejected');

        const phoneVal = getNestedField(data, cfg.phoneField);
        const codVal = getNestedField(data, cfg.codField);
        const dodVal = getNestedField(data, cfg.dodField);
        const hasPhone = phoneVal !== null && phoneVal !== undefined && String(phoneVal) !== '';
        const hasCod = codVal !== null && codVal !== undefined && !isNaN(parseFloat(codVal));
        const hasDod = dodVal !== null && dodVal !== undefined && !isNaN(parseFloat(dodVal));
        const found = !!(data && (data.success === true || data.found === true)) || hasPhone || hasCod || hasDod;
        autoLookupFailureAt.delete(lookupKey);
        if (!found) {
            setLookupStatus(barcode, 'warn', '⚠️ ' + lookupSource + ' មិនឃើញទិន្នន័យសម្រាប់ Barcode នេះ');
            return;
        }
        const elapsedSeconds = Math.max(0.1, elapsedSince(startedAt) / 1000).toFixed(1);
        setLookupStatus(barcode, 'success', '✅ រកឃើញពី ' + (isZtoLookup ? 'ZTO' : 'API') + ' (' + elapsedSeconds + ' វិ.)');
        setFastLookupRow(barcode, phoneVal, codVal, dodVal, cfg);
        rememberCustomerTableRow(barcode, phoneVal, codVal, dodVal);
        applyLookupFillToModal(barcode, phoneVal, codVal, dodVal, cfg);
    } catch (e) {
        if (myGeneration !== lookupState.customerDataTableSessionGeneration) return;
        autoLookupFailureAt.delete(lookupKey);
        autoLookupFailureAt.set(lookupKey, {
            at: Date.now(),
            ms: lookupFailureCooldownMs(lookupFailureIsDefinitive(e) ? 'definitive' : 'transient')
        });
        while (autoLookupFailureAt.size > AUTO_LOOKUP_FAILURE_MAX) {
            autoLookupFailureAt.delete(autoLookupFailureAt.keys().next().value);
        }
        if ((navigator.onLine as boolean) === false) {
            setLookupStatus(barcode, 'offline', '📴 បណ្ដាញបានដាច់ — សូមភ្ជាប់ ហើយស្កេនម្ដងទៀត');
        } else if (e && e.message === 'Auto lookup timed out') {
            setLookupStatus(barcode, 'error', '⏱️ ' + lookupSource + ' ឆ្លើយតបយឺតពេក — សូមស្កេនម្ដងទៀត');
        } else if (e && e.lookupCode === 'ZTO_AUTH_EXPIRED') {
            setLookupStatus(barcode, 'error', '🔒 ZTO បដិសេធ Cookie — សូមចូល Argus ហើយរត់ ZTO Cookie Sync លើ Windows ដើម្បីផ្ទៀងផ្ទាត់ និង Sync ម្ដងទៀត');
        } else if (e && e.lookupCode === 'ZTO_AUTH_NOT_CONFIGURED') {
            setLookupStatus(barcode, 'error', '🔒 Netlify មិនទាន់មាន Cookie ឬ Token សម្រាប់ ZTO');
        } else if (e && (e.lookupCode === 'ZTO_CONFIG_INVALID' || e.lookupCode === 'ZTO_PROXY_NOT_CONFIGURED')) {
            setLookupStatus(barcode, 'error', '⚙️ Config ZTO នៅ Netlify មិនត្រឹមត្រូវ'
                + (e.lookupReason ? ' — ជាប់ត្រង់ ' + e.lookupReason : ''));
        } else if (e && e.lookupCode === 'ZTO_RATE_LIMITED') {
            setLookupStatus(barcode, 'error', '🚦 ZTO កំណត់ល្បឿន — សូមរង់ចាំបន្តិច ហើយស្កេនម្ដងទៀត');
        } else if (e && e.lookupCode === 'ZTO_TIMEOUT') {
            setLookupStatus(barcode, 'error', '⏱️ ZTO ឆ្លើយតបយឺតពេក — សូមស្កេនម្ដងទៀត');
        } else if (e && e.lookupCode === 'ZTO_UPSTREAM_UNAVAILABLE') {
            setLookupStatus(barcode, 'error', '📡 ZTO ឆ្លើយមិនចេញ — សូមស្កេនម្ដងទៀត');
        } else if (e && /^HTTP (401|403)$/.test(e.message || '')) {
            setLookupStatus(barcode, 'error', '🔒 ' + lookupSource + ' Secret មិនត្រឹមត្រូវ ឬផុតកំណត់');
        } else {
            setLookupStatus(barcode, 'error', '⚠️ មិនអាចភ្ជាប់ ' + lookupSource + ' បាន — សូមស្កេនម្ដងទៀត');
        }
        console.error("Lookup API error:", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'lookup', context: "Lookup API error:" });
    } finally {
        if (autoLookupInFlight.get(lookupKey) === lookupRunToken) {
            autoLookupInFlight.delete(lookupKey);
        }
        pumpAutoLookupQueue();
    }
}
