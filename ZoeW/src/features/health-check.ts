import { modalIsOpen } from '../core/modals';
import { healthPendingRow, healthRow } from '../app/components/health/model';
import { viewState } from '../core/view-state';
import { firebaseState, lookupState, securityState, uiState } from '../core/state';
import { cleanupClockIsTrustworthy } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { appLocalStore, appSessionStore } from '../core/storage';
import { DB_LISTENER_KEYS } from '../core/text';
import { sanitizeInput } from '../domain/barcode';
import { ZTO_TEST_TIMEOUT_MS } from './auto-lookup';
import { lookupApiIsZto, safeLookupReason } from './customer-table-prefetch';
import { LICENSE_APP_CODE } from './license';
import { lookupApiIsAppsScript } from './lookup-api';
import { getLookupApiConfig } from './lookup-config';
import { decryptLookupSecret } from '../services/crypto';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { fetchWithTimeout, withTimeout } from '../services/network';
import { openModalHelper } from '../ui/modal';
import { closeSideDrawer } from '../ui/page-nav';
import { isNativeApp } from '../platform/native';

export const SHEET_SCRIPT_VERSION_EXPECTED = 1;

export const HEALTH_ICONS = { ok: '✅', warn: '⚠️', bad: '❌', info: 'ℹ️' };

export function healthRowHtml(state, label, detail) {
    const icon = HEALTH_ICONS[state] || HEALTH_ICONS.info;
    const cls = 'health-row health-' + (HEALTH_ICONS[state] ? state : 'info');
    return '<div class="' + cls + '"><span class="health-ico">' + sanitizeInput(icon) + '</span>'
        + '<span class="health-text"><b>' + sanitizeInput(label) + '</b>'
        + '<span class="health-detail">' + sanitizeInput(detail) + '</span></span></div>';
}

export function healthAgeText(mark) {
    const ms = elapsedSince(mark);
    if (!isFinite(ms)) return 'មិនស្គាល់';
    const sec = Math.round(ms / 1000);
    if (sec < 60) return sec + ' វិនាទីមុន';
    const min = Math.round(sec / 60);
    if (min < 60) return min + ' នាទីមុន';
    return Math.round(min / 60) + ' ម៉ោងមុន';
}

export function healthNetworkRow() {
    return (navigator.onLine as boolean) === false
        ? healthRow('bad', 'អ៊ីនធឺណិត', 'ក្រៅបណ្ដាញ — ការស្កេនចូលនៅដំណើរការ តែ Lookup និងការសរសេរនឹងចូលជួររង់ចាំ')
        : healthRow('ok', 'អ៊ីនធឺណិត', 'ភ្ជាប់');
}

export function healthDatabaseRow() {
    if (!firebaseState.isDatabaseConnected) {
        return healthRow('bad', 'Firebase', firebaseState.hasEverConnectedToDatabase
            ? 'ដាច់ការតភ្ជាប់ — កំពុងព្យាយាមភ្ជាប់ឡើងវិញ'
            : 'មិនទាន់ភ្ជាប់ម្តងណាទេ — សូមពិនិត្យ Config');
    }
    const stale = DB_LISTENER_KEYS.filter((k) => dbListenerViewIsStale(k));
    if (stale.length) {
        return healthRow('warn', 'Firebase', 'ភ្ជាប់រួច តែទិន្នន័យ ' + stale.length
            + ' ផ្នែកមិនទាន់មកដល់ (' + stale.join(', ') + ')');
    }
    return healthRow('ok', 'Firebase', 'ភ្ជាប់ ហើយទិន្នន័យមកដល់គ្រប់ផ្នែក');
}

export function healthClockRow() {
    if (!firebaseState.serverClockTrusted) {
        return healthRow('warn', 'នាឡិកា Server', 'មិនទាន់ sync — ការសម្អាតស្វ័យប្រវត្តិត្រូវបានផ្អាកដោយចេតនា');
    }
    const drift = Math.round(Math.abs(firebaseState.serverTimeOffsetMs) / 1000);
    const cleanupReady = cleanupClockIsTrustworthy();
    return healthRow(cleanupReady ? 'ok' : 'warn', 'នាឡិកា Server',
        'sync រួច · គម្លាតនឹងនាឡិកាឧបករណ៍ ' + drift + ' វិនាទី'
        + (cleanupReady ? '' : ' · ការសម្អាតផ្អាកព្រោះការតភ្ជាប់មិនរស់'));
}

export async function healthLicenseRow() {
    if (!window.ZoeLicense || typeof ZoeLicense.getStatus !== 'function') {
        return healthRow('warn', 'អាជ្ញាប័ណ្ណ', 'ម៉ូឌុល License មិនទាន់ផ្ទុក');
    }
    try {
        const status = await withTimeout(ZoeLicense.getStatus(LICENSE_APP_CODE), 8000, 'License check timed out');
        if (status && status.state === 'active') {
            return healthRow('ok', 'អាជ្ញាប័ណ្ណ', 'សកម្ម');
        }
        const reason = safeLookupReason(status && status.reason);
        return healthRow('warn', 'អាជ្ញាប័ណ្ណ',
            'ស្ថានភាព ៖ ' + ((status && status.state) || 'មិនស្គាល់') + (reason ? ' (' + reason + ')' : ''));
    } catch (e) {
        return healthRow('warn', 'អាជ្ញាប័ណ្ណ', 'ពិនិត្យមិនបាន — មិនមែនមានន័យថា Key ខុសទេ');
    }
}

export function healthSheetScriptRow() {
    const cfg = getLookupApiConfig();
    if (!cfg || !cfg.enabled || !lookupApiIsAppsScript(cfg)) {
        return healthRow('info', 'កំណែ Apps Script (Lookup)', 'មិនពាក់ព័ន្ធ (Lookup មិនប្រើ Google Sheet)');
    }
    if (lookupState.sheetScriptVersionSeen === null) {
        return healthRow('info', 'កំណែ Apps Script (Lookup)',
            'មិនទាន់ដឹង — សូមស្កេនកញ្ចប់ ១ ដង ឬទាញតារាងអតិថិជន រួចពិនិត្យម្តងទៀត');
    }
    if (lookupState.sheetScriptVersionSeen === SHEET_SCRIPT_VERSION_EXPECTED) {
        return healthRow('ok', 'កំណែ Apps Script (Lookup)', 'កំណែ ' + lookupState.sheetScriptVersionSeen + ' — ត្រូវគ្នានឹង App');
    }
    if (lookupState.sheetScriptVersionSeen < SHEET_SCRIPT_VERSION_EXPECTED) {
        return healthRow('warn', 'កំណែ Apps Script (Lookup)',
            'Script ដែល deploy ជាកំណែ ' + lookupState.sheetScriptVersionSeen + ' តែ App រំពឹង '
            + SHEET_SCRIPT_VERSION_EXPECTED + ' — សូម copy Code.gs ថ្មីចូល script.google.com រួច Deploy ជាកំណែថ្មី');
    }
    return healthRow('warn', 'កំណែ Apps Script (Lookup)',
        'Script ជាកំណែ ' + lookupState.sheetScriptVersionSeen + ' ថ្មីជាង App (' + SHEET_SCRIPT_VERSION_EXPECTED
        + ') — សូមទាញ App ចុះឡើងវិញ');
}

export function healthCustomerTableRow() {
    if (!Array.isArray(lookupState.customerDataTableRows)) {
        return healthRow('info', 'តារាងអតិថិជន', 'មិនទាន់ទាញមកទេ');
    }
    const state = lookupState.customerTableIsPartial ? 'warn' : 'ok';
    return healthRow(state, 'តារាងអតិថិជន',
        lookupState.customerDataTableRows.length + ' ជួរដេក · ទាញនៅ ' + healthAgeText(lookupState.customerDataTableFetchedAt)
        + (lookupState.customerTableIsPartial ? ' · មិនពេញលេញ' : ''));
}

export function healthStorageRow() {
    const parts = [];
    if (!appLocalStore) parts.push('localStorage');
    if (!appSessionStore) parts.push('sessionStorage');
    return parts.length
        ? healthRow('bad', 'ការផ្ទុកក្នុងឧបករណ៍', parts.join(' និង ') + ' ត្រូវបានបិទ — Config និងសោនឹងមិនរស់រានក្រោយបិទ App')
        : healthRow('ok', 'ការផ្ទុកក្នុងឧបករណ៍', 'ដំណើរការធម្មតា');
}

export function healthServiceWorkerRow() {
    if (isNativeApp()) {
        return healthRow('ok', 'របៀបក្រៅបណ្ដាញ', 'App Android ៖ សំបក App ស្ថិតក្នុងកម្មវិធីរួចហើយ ➜ បើកបានពេលបណ្ដាញដាច់');
    }
    if (!('serviceWorker' in navigator)) {
        return healthRow('warn', 'របៀបក្រៅបណ្ដាញ', 'Browser នេះមិនគាំទ្រ Service Worker');
    }
    return navigator.serviceWorker.controller
        ? healthRow('ok', 'របៀបក្រៅបណ្ដាញ', 'សំបក App ត្រូវបាន cache ➜ បើកបានពេលបណ្ដាញដាច់')
        : healthRow('warn', 'របៀបក្រៅបណ្ដាញ', 'មិនទាន់គ្រប់គ្រងទំព័រនេះ — សូមទាញចុះ ១ ដងទៀត');
}

export function ztoDiagnosticsUrl(cfg) {
    const raw = String(cfg.url).trim();
    const marker = '/.netlify/functions/zto-order-detail';
    const markerAt = raw.toLowerCase().indexOf(marker);
    return (markerAt === -1 ? marker : raw.slice(0, markerAt) + marker) + '?diag=1';
}

export function ztoRenewalText(body) {
    const cookie = body && typeof body.cookie === 'object' ? body.cookie : null;
    const signal = body && typeof body.sessionRenewal === 'object' && body.sessionRenewal
        && !Array.isArray(body.sessionRenewal) ? body.sessionRenewal : null;
    const renewals = cookie && Number.isFinite(cookie.renewals)
        ? Math.max(0, Math.round(cookie.renewals)) : 0;
    if (renewals > 0) return ' · បន្តអាយុស្វ័យប្រវត្តិ ' + renewals + ' ដង';
    if (!signal || signal.observed !== true) return ' · ការបន្តអាយុមិនទាន់វាស់';
    return signal.setCookie === true
        ? ' · ZTO ផ្ញើ Cookie ថ្មី ➜ បន្តអាយុបាន'
        : ' · ZTO មិនផ្ញើ Cookie ថ្មី ➜ ត្រូវ Sync ដោយដៃពេលផុត';
}

export async function healthLookupRow() {
    const cfg = getLookupApiConfig();
    if (!cfg || !cfg.enabled || !cfg.url) {
        return healthRow('info', 'Lookup អតិថិជន', 'មិនទាន់បើក');
    }
    let host = '';
    try { host = new URL(String(cfg.url).trim()).hostname; } catch (e) { host = ''; }
    if (lookupApiIsAppsScript(cfg)) {
        return healthRow('ok', 'Lookup អតិថិជន (Google Sheet)',
            'បើករួច · ' + (host || 'script.google.com') + ' · មិនផ្ញើ Header ផ្ទាល់ខ្លួន (ត្រឹមត្រូវ)');
    }
    if (!lookupApiIsZto(cfg)) {
        return healthRow('info', 'Lookup អតិថិជន', 'បើករួច · ' + (host || 'មិនស្គាល់ host'));
    }
    if (cfg.headerValueEnc && !securityState.lookupSecretKey) {
        return healthRow('info', 'Lookup អតិថិជន (ZTO)',
            'បើករួច តែពិនិត្យមិនបាន — សូមវាយ PIN ម្តងជាមុន រួចពិនិត្យម្តងទៀត');
    }
    if ((navigator.onLine as boolean) === false) {
        return healthRow('warn', 'Lookup អតិថិជន (ZTO)', 'បើករួច — ពិនិត្យមិនបានខណៈក្រៅបណ្ដាញ');
    }
    const headers = {};
    if (cfg.headerName) {
        const value = cfg.headerValueEnc ? await decryptLookupSecret(cfg.headerValueEnc) : (cfg.headerValue || '');
        if (!value) {
            return healthRow('warn', 'Lookup អតិថិជន (ZTO)', 'បើករួច តែស្រាយសោមិនបាន — សូមកំណត់ Header ម្តងទៀត');
        }
        headers[cfg.headerName] = value;
    }
    try {
        const out = await fetchWithTimeout(ztoDiagnosticsUrl(cfg),
            { method: 'GET', headers, cache: 'no-store', credentials: 'same-origin' },
            ZTO_TEST_TIMEOUT_MS, 'ZTO diagnostics timed out',
            (r) => (r.ok ? r.json() : null));
        const res = out && out.res;
        if (!res || !res.ok) {
            const status = Number(res && res.status);
            return healthRow('bad', 'Lookup អតិថិជន (ZTO)',
                'Server ឆ្លើយ HTTP ' + (Number.isFinite(status) ? status : 'មិនស្គាល់'));
        }
        const body = out.body;
        const source = safeLookupReason(body && body.cookie && body.cookie.source) || 'none';
        const fingerprint = safeLookupReason(body && body.cookie && body.cookie.fingerprint);
        if (source === 'none' || !fingerprint) {
            return healthRow('bad', 'Lookup អតិថិជន (ZTO)',
                'គ្មាន Cookie ➜ ការស្វែងរកនឹងធ្លាក់។ សូមរត់ឧបករណ៍ sync-zto-cookie លើ Windows');
        }
        const ageMs = body && body.cookie && body.cookie.ageMs;
        const reason = safeLookupReason(body && body.cookie && body.cookie.storeReason);
        const rejectedAgeMs = body && body.cookie && body.cookie.authRejectedAgeMs;
        const acceptedAgeMs = body && body.cookie && body.cookie.authAcceptedAgeMs;
        const cookieText = 'Cookie ពី ' + source + ' · លេខសម្គាល់ ' + fingerprint
            + (typeof ageMs === 'number' ? ' · អាយុ ' + Math.round(ageMs / 60000) + ' នាទី' : '')
            + (reason ? ' · ' + reason : '')
            + ztoRenewalText(body);
        if (typeof rejectedAgeMs === 'number') {
            return healthRow('bad', 'Lookup អតិថិជន (ZTO)',
                'ZTO បដិសេធ Cookie នេះ — សូមចូល Argus ហើយរត់ឧបករណ៍ sync-zto-cookie លើ Windows '
                + 'ដើម្បីផ្ទៀងផ្ទាត់ និង Sync ម្ដងទៀត · ' + cookieText);
        }
        if (typeof acceptedAgeMs !== 'number') {
            return healthRow('warn', 'Lookup អតិថិជន (ZTO)',
                'មាន Cookie តែ ZTO មិនទាន់ដែលប្រើវា ➜ ពិនិត្យមិនបានថាវានៅសុពលភាព។ '
                + 'សូមស្កេនកញ្ចប់ ១ រួចពិនិត្យម្ដងទៀត · ' + cookieText);
        }
        return healthRow('ok', 'Lookup អតិថិជន (ZTO)', 'ZTO ទទួលយក · ' + cookieText);
    } catch (e) {
        return healthRow('bad', 'Lookup អតិថិជន (ZTO)', 'ភ្ជាប់ទៅ Server មិនបាន — ' + safeLookupReason(e && e.message));
    }
}

export function openHealthCheck() {
    closeSideDrawer();
    openModalHelper('healthCheckModal');
    runHealthCheck();
}

export async function runHealthCheck() {
    viewState.healthRecheckBusy = true;
    // ⛔ ជួរ «កំពុងពិនិត្យ…» ដូចដើមបេះបិទ ៖ រូប ⏳ · គ្មាន .health-detail
    uiState.healthRows = [healthPendingRow()];
    uiState.touch();
    const rows = [healthNetworkRow(), healthDatabaseRow(), healthClockRow(), healthStorageRow(), healthServiceWorkerRow(), healthCustomerTableRow(), healthSheetScriptRow()];
    const [licenseRow, lookupRow] = await Promise.all([healthLicenseRow(), healthLookupRow()]);
    rows.splice(3, 0, licenseRow);
    rows.push(lookupRow);
    // ⛔ លទ្ធផលយឺតមិនត្រូវគូរពេលប្រអប់បិទរួច (ច្បាប់ «ម្ចាស់ប្រអប់»)
    if (!modalIsOpen('healthCheckModal')) return;
    uiState.healthRows = rows;
    uiState.touch();
    viewState.healthRecheckBusy = false;
}
