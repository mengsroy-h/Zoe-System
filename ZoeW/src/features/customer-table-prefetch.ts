import { firebaseState, lookupState, uiState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { autoLookupInFlight } from './auto-lookup';
import { fetchCustomerDataTableRows } from './customer-table';
import { lookupApiSupportsList } from './lookup-api';
import { getLookupApiConfig } from './lookup-config';
import { fetchWithTimeout, linkIsFrugal } from '../services/network';

export const CUSTOMER_TABLE_CACHE_MS = 5 * 60 * 1000;

export const CUSTOMER_TABLE_FAIL_COOLDOWN_MS = 60 * 1000;

export const CUSTOMER_TABLE_RETRY_STEPS_MS = [65 * 1000, 2 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];

export const CUSTOMER_TABLE_RETRY_BUSY_MS = 20 * 1000;

export const CUSTOMER_TABLE_SOON_MS = 1200;

export const CUSTOMER_TABLE_SOON_BUSY_MS = 3000;

export const CUSTOMER_TABLE_SOON_MAX_WAIT_MS = 90 * 1000;

export const ZTO_WARMUP_COOLDOWN_MS = 4 * 60 * 1000;

export const ZTO_WARMUP_TIMEOUT_MS = 6000;

export function customerTablePrefetchAllowed() {
    if (!firebaseState.auth || !firebaseState.auth.currentUser) return false;
    if ((navigator.onLine as boolean) === false) return false;
    if (linkIsFrugal()) return false;
    if (uiState.isModalOpen) return false;
    if (autoLookupInFlight.size > 0) return false;
    return true;
}

export function clearCustomerTableRetry() {
    if (lookupState.customerTableRetryTimer) {
        clearTimeout(lookupState.customerTableRetryTimer);
        lookupState.customerTableRetryTimer = null;
    }
    lookupState.customerTableFailStreak = 0;
}

export function scheduleCustomerTableRetry() {
    if (lookupState.customerTableRetryTimer) return;
    const idx = Math.min(lookupState.customerTableFailStreak, CUSTOMER_TABLE_RETRY_STEPS_MS.length - 1);
    lookupState.customerTableFailStreak++;
    lookupState.customerTableRetryTimer = setTimeout(runCustomerTableRetry, CUSTOMER_TABLE_RETRY_STEPS_MS[idx]);
}

export function runCustomerTableRetry() {
    lookupState.customerTableRetryTimer = null;
    if (!customerTablePrefetchAllowed()) {
        lookupState.customerTableRetryTimer = setTimeout(runCustomerTableRetry, CUSTOMER_TABLE_RETRY_BUSY_MS);
        return;
    }
    const cfg = getLookupApiConfig();
    if (!lookupApiSupportsList(cfg)) {
        clearCustomerTableRetry();
        return;
    }
    fetchCustomerDataTableRows(true);
}

export function customerTableNeedsRefresh() {
    if (!Array.isArray(lookupState.customerDataTableRows)) return true;
    if (lookupState.customerTableIsPartial) return true;
    return elapsedSince(lookupState.customerDataTableFetchedAt) >= CUSTOMER_TABLE_CACHE_MS;
}

export function clearCustomerTableSoonRefresh() {
    if (lookupState.customerTableSoonTimer) {
        clearTimeout(lookupState.customerTableSoonTimer);
        lookupState.customerTableSoonTimer = null;
    }
    lookupState.customerTableSoonArmedAt = 0;
}

export function scheduleCustomerTableSoonRefresh(force?) {
    const cfg = getLookupApiConfig();
    if (!lookupApiSupportsList(cfg)) {
        clearCustomerTableSoonRefresh();
        return;
    }
    if (lookupState.customerTableSoonTimer) return;
    if (!force && !customerTableNeedsRefresh()) return;
    lookupState.customerTableSoonArmedAt = Date.now();
    lookupState.customerTableSoonTimer = setTimeout(runCustomerTableSoonRefresh, CUSTOMER_TABLE_SOON_MS);
}

export function runCustomerTableSoonRefresh() {
    lookupState.customerTableSoonTimer = null;
    if (elapsedSince(lookupState.customerTableSoonArmedAt) >= CUSTOMER_TABLE_SOON_MAX_WAIT_MS) {
        lookupState.customerTableSoonArmedAt = 0;
        return;
    }
    if (!customerTablePrefetchAllowed()) {
        lookupState.customerTableSoonTimer = setTimeout(runCustomerTableSoonRefresh, CUSTOMER_TABLE_SOON_BUSY_MS);
        return;
    }
    lookupState.customerTableSoonArmedAt = 0;
    if (elapsedSince(lookupState.customerDataTableLastFailedAt) < CUSTOMER_TABLE_FAIL_COOLDOWN_MS) return;
    const cfg = getLookupApiConfig();
    if (lookupApiSupportsList(cfg)) fetchCustomerDataTableRows(true, true);
}

export function safeLookupReason(raw) {
    const text = String(raw === null || raw === undefined ? '' : raw).trim();
    return /^[A-Za-z0-9_.:@-]{1,80}$/.test(text) ? text : '';
}

export function lookupApiIsZto(cfg) {
    if (!cfg || !cfg.url) return false;
    return /(?:^|\/)\.netlify\/functions\/zto-order-detail\/?(?:[?#]|$)/i.test(String(cfg.url).trim());
}

export function warmZtoLookupProxyIfConfigured(cfg) {
    if (!cfg || !cfg.enabled || !lookupApiIsZto(cfg) || lookupState.ztoWarmupInFlight || elapsedSince(lookupState.ztoWarmupAt) < ZTO_WARMUP_COOLDOWN_MS) return false;
    const raw = String(cfg.url).trim();
    const marker = '/.netlify/functions/zto-order-detail';
    const markerAt = raw.toLowerCase().indexOf(marker);
    const target = markerAt === -1 ? marker : raw.slice(0, markerAt) + marker;
    lookupState.ztoWarmupAt = Date.now();
    lookupState.ztoWarmupInFlight = true;
    fetchWithTimeout(target, { method: 'OPTIONS', cache: 'no-store', credentials: 'same-origin' }, ZTO_WARMUP_TIMEOUT_MS, 'ZTO warmup timed out')
        .catch(() => {})
        .finally(() => { lookupState.ztoWarmupInFlight = false; });
    return true;
}
