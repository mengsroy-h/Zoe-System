import { byId } from '../core/dom';
import { firebaseState, lookupState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { fetchCustomerDataTableRows } from './customer-table';
import { CUSTOMER_TABLE_SOON_BUSY_MS, CUSTOMER_TABLE_SOON_MAX_WAIT_MS, customerTablePrefetchAllowed, lookupApiIsZto, warmZtoLookupProxyIfConfigured } from './customer-table-prefetch';
import { getLookupApiConfig } from './lookup-config';
import { decryptLookupSecret } from '../services/crypto';
import { withTimeout } from '../services/network';
import { openModalHelper } from '../ui/modal';

export function clearZtoWarmSoon() {
    if (lookupState.ztoWarmSoonTimer) {
        clearTimeout(lookupState.ztoWarmSoonTimer);
        lookupState.ztoWarmSoonTimer = null;
    }
    lookupState.ztoWarmSoonArmedAt = 0;
}

export function scheduleZtoWarmSoon() {
    const cfg = getLookupApiConfig();
    if (!cfg || !cfg.enabled || !lookupApiIsZto(cfg)) {
        clearZtoWarmSoon();
        return false;
    }
    if (lookupState.ztoWarmSoonTimer) return true;
    lookupState.ztoWarmSoonArmedAt = Date.now();
    lookupState.ztoWarmSoonTimer = setTimeout(runZtoWarmSoon, CUSTOMER_TABLE_SOON_BUSY_MS);
    return true;
}

export function runZtoWarmSoon() {
    lookupState.ztoWarmSoonTimer = null;
    if (elapsedSince(lookupState.ztoWarmSoonArmedAt) >= CUSTOMER_TABLE_SOON_MAX_WAIT_MS) {
        lookupState.ztoWarmSoonArmedAt = 0;
        return;
    }
    const cfg = getLookupApiConfig();
    if (!cfg || !cfg.enabled || !lookupApiIsZto(cfg)) {
        clearZtoWarmSoon();
        return;
    }
    if (!customerTablePrefetchAllowed()) {
        lookupState.ztoWarmSoonTimer = setTimeout(runZtoWarmSoon, CUSTOMER_TABLE_SOON_BUSY_MS);
        return;
    }
    lookupState.ztoWarmSoonArmedAt = 0;
    warmZtoLookupProxyIfConfigured(cfg);
}

export function warmZtoLookupProxyNow() {
    try {
        const cfg = getLookupApiConfig();
        if (!cfg || !cfg.enabled) return false;
        if (!customerTablePrefetchAllowed()) {
            scheduleZtoWarmSoon();
            return false;
        }
        clearZtoWarmSoon();
        return warmZtoLookupProxyIfConfigured(cfg);
    } catch (e) {
        return false;
    }
}

export function lookupApiIsAppsScript(cfg) {
    if (!cfg || !cfg.url) return false;
    const raw = String(cfg.url).trim();
    let host = '';
    try {
        host = new URL(raw).hostname;
    } catch (e) {
        const m = raw.match(/^https?:\/\/([^/?#]+)/i);
        host = m ? m[1] : '';
    }
    return /(^|\.)script\.google\.com$/i.test(host) || /(^|\.)script\.googleusercontent\.com$/i.test(host);
}

export function lookupApiSendsHeader(cfg) {
    return !!(cfg && cfg.headerName) && !lookupApiIsAppsScript(cfg);
}

export async function buildLookupRequestHeaders(cfg) {
    const headers = {};
    if (lookupApiSendsHeader(cfg)) {
        if (cfg.headerValueEnc) {
            const decrypted = await decryptLookupSecret(cfg.headerValueEnc);
            if (decrypted) headers[cfg.headerName] = decrypted;
        } else if (cfg.headerValue) {
            headers[cfg.headerName] = cfg.headerValue;
        }
    }
    return headers;
}

export async function ztoIdToken() {
    try {
        if (!firebaseState.fb || typeof firebaseState.fb.getIdTokenResult !== 'function' || !firebaseState.auth || !firebaseState.auth.currentUser) return '';
        const out = await withTimeout(firebaseState.fb.getIdTokenResult(firebaseState.auth.currentUser), 8000, 'ID token timed out');
        return out && typeof out.token === 'string' ? out.token : '';
    } catch (e) { return ''; }
}

export function lookupApiSupportsList(cfg) {
    return !!(cfg && cfg.url && !lookupApiIsZto(cfg));
}

export function buildCustomerListApiUrl(cfg, wantFresh) {
    if (!lookupApiSupportsList(cfg)) return null;
    let url = cfg.url.trim();
    if (/[?&][^=&]*=\{barcode\}/.test(url)) {
        url = url.replace(/([?&])[^=&]*=\{barcode\}/, '$1list=1');
    } else if (/[?&]code=/.test(url)) {
        url = url.replace(/([?&])code=[^&]*/, '$1list=1');
    } else {
        url = url.replace('{barcode}', '');
        url += (url.indexOf('?') !== -1 ? '&' : '?') + 'list=1';
    }
    if (wantFresh) url += (url.indexOf('?') !== -1 ? '&' : '?') + 'fresh=1';
    return url;
}

export function openCustomerDataTableModal() {
    const cfg = getLookupApiConfig();
    if (!cfg || !cfg.url) {
        alert("សូមកំណត់ Config API ស្វែងរកអតិថិជនជាមុនសិន (⋯ ➜ 🔌 API ស្វែងរកអតិថិជន) មុននឹងបើកតារាងនេះ។");
        return;
    }
    if (!lookupApiSupportsList(cfg)) {
        alert("ZTO Lookup មិនមានតារាងទិន្នន័យទាំងមូលទេ។ សូមស្កេន Barcode ដើម្បីស្វែងរកផ្ទាល់ពី ZTO។");
        return;
    }
    const searchInput = byId('customerDataTableSearchInput');
    if (searchInput) searchInput.value = '';
    openModalHelper('customerDataTableModal');
    fetchCustomerDataTableRows(false);
}
