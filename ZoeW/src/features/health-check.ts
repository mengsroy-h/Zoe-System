import { healthDatabaseRead } from './health-database-read';
import { healthLicenseStatus } from './health-license-status';
import { loadDeviceInfo } from './device-info';
import { modalIsOpen } from '../core/modals';
import { healthPendingRow, healthRow } from '../app/components/health/model';
import { viewState } from '../core/view-state';
import { firebaseState, lookupState, securityState, uiState } from '../core/state';
import { cleanupClockIsTrustworthy, getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { getZoneDateKey } from '../core/timezone';
import { appLocalStore, appSessionStore, safeStoreGet } from '../core/storage';
import { DB_LISTENER_KEYS, ztoExpectedTexts, ztoMismatchTexts, ztoTextWithCodePoints } from '../core/text';
import { ZTO_TEST_TIMEOUT_MS } from './auto-lookup';
import { lookupApiIsPalm, lookupApiIsZto, safeLookupReason } from './customer-table-prefetch';
import { licenseFailureMessage } from './license';
import { addPalmSessionHeader, addZtoIdentityHeader, lookupApiIsAppsScript } from './lookup-api';
import { getLookupApiConfig } from './lookup-config';
import { decryptLookupSecret } from '../services/crypto';
import { DB_LIVENESS_PROBE_TIMEOUT_MS } from '../services/connection';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { fetchWithTimeout, withTimeout } from '../services/network';
import { openModalHelper } from '../ui/modal';
import { captureConnectionOperation, connectionFlowSnapshot } from '../services/connection-flow';
import { closeSideDrawer } from '../ui/page-nav';
import { isNativeApp } from '../platform/native';
import { HEALTH_ADVICE_LABELS, HEALTH_NO_BACKEND_TEXT, buildHealthAdvice } from './health-advice';
import { isSupabaseConfig } from '../services/supabase-config';

export const SHEET_SCRIPT_VERSION_EXPECTED = 2;

export const HEALTH_ICONS = { ok: '✅', warn: '⚠️', bad: '❌', info: 'ℹ️' };

export function healthBackendKind() {
    const saved = safeStoreGet(appLocalStore, 'zoew_firebase_config');
    if (!saved) return 'none';
    try { return isSupabaseConfig(JSON.parse(saved)) ? 'supabase' : 'firebase'; } catch (e) {}
    return viewState.backendKind === 'supabase' ? 'supabase' : 'firebase';
}

export function databaseHealthLabel() {
    const kind = healthBackendKind();
    return kind === 'none' ? HEALTH_ADVICE_LABELS.backend : kind === 'supabase' ? 'Supabase' : 'Firebase';
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

export function healthNetworkRow(serverVerified = false) {
    return (navigator.onLine as boolean) === false
        ? healthRow('bad', 'អ៊ីនធឺណិត', 'ក្រៅបណ្ដាញ — ការស្កេនចូលនៅដំណើរការ តែ Lookup និងការសរសេរនឹងចូលជួររង់ចាំ')
        : serverVerified === true
            ? healthRow('ok', 'អ៊ីនធឺណិត', 'ភ្ជាប់បាន — Server បានឆ្លើយក្នុងការពិនិត្យនេះ · សេវាទិន្នន័យ និង Lookup មានលទ្ធផលដាច់ដោយឡែកខាងក្រោម')
            : healthRow('info', 'អ៊ីនធឺណិត', 'ភ្ជាប់បណ្ដាញឧបករណ៍ តែមិនទាន់ផ្ទៀងផ្ទាត់ Server — នេះជាព័ត៌មាន មិនមែនកំហុស');
}

export async function healthNetworkLiveRow() {
    if ((navigator.onLine as boolean) === false) return healthNetworkRow();
    try {
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, '0')).join('');
        const out = await fetchWithTimeout('/.netlify/functions/health?nonce=' + nonce,
            { method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error' },
            4000, 'Network health timed out', (res) => res.ok && !res.redirected ? res.json() : null);
        return healthNetworkRow(!!out && out.res.ok && !out.res.redirected && out.body?.nonce === nonce);
    } catch (e) { return healthNetworkRow(); }
}

export function healthDatabaseRow() {
    if (healthBackendKind() === 'none') return healthRow('bad', HEALTH_ADVICE_LABELS.backend, HEALTH_NO_BACKEND_TEXT);
    if (!firebaseState.isDatabaseConnected) {
        return healthRow('bad', databaseHealthLabel(), firebaseState.hasEverConnectedToDatabase
            ? 'ដាច់ការតភ្ជាប់ — កំពុងព្យាយាមភ្ជាប់ឡើងវិញ'
            : 'មិនទាន់ភ្ជាប់ម្តងណាទេ — សូមពិនិត្យ Config');
    }
    const phase = connectionFlowSnapshot().phase;
    if (phase !== 'ready') return healthRow('warn', databaseHealthLabel(),
        phase === 'signed-out' || phase === 'expired' ? 'សូមចូលគណនី ដើម្បីផ្ទៀងផ្ទាត់ការតភ្ជាប់ និងទិន្នន័យ'
            : 'ការតភ្ជាប់ និងទិន្នន័យមិនទាន់រួចរាល់ — សូមរង់ចាំ ហើយពិនិត្យម្តងទៀត');
    const stale = DB_LISTENER_KEYS.filter((k) => dbListenerViewIsStale(k));
    if (stale.length) {
        return healthRow('warn', databaseHealthLabel(), 'ភ្ជាប់រួច តែទិន្នន័យ ' + stale.length
            + ' ផ្នែកមិនទាន់មកដល់ (' + stale.join(', ') + ')');
    }
    return healthRow('ok', databaseHealthLabel(), 'ភ្ជាប់ ហើយទិន្នន័យមកដល់គ្រប់ផ្នែក');
}

export function healthDatabaseWriteRow() {
    const flow = connectionFlowSnapshot(); const phase = flow.phase;
    if (phase === 'blocked') return healthRow('warn', databaseHealthLabel(), 'មានការសរសេរមិនទាន់ផ្ទៀងផ្ទាត់ — មិនទាន់អនុវត្តឡើងវិញ ដើម្បីការពារប្រាក់ស្ទួន។ សូមពិនិត្យទិន្នន័យ និងចុចពិនិត្យម្តងទៀត ឬលុបវាតាម ☰ ឧបករណ៍ ➜ «លុបការសរសេររង់ចាំ» (PIN)។');
    if (flow.pendingWrites) return healthRow('warn', databaseHealthLabel(), 'មានការសរសេរ ' + flow.pendingWrites + ' កំពុងដំណើរការ — សូមរង់ចាំលទ្ធផល។');
    return null;
}

export async function healthDatabaseLiveRow() {
    const owner = captureConnectionOperation();
    const unverified = () => healthRow('warn', databaseHealthLabel(), 'មិនទាន់អាចផ្ទៀងផ្ទាត់ការតភ្ជាប់ Server ក្នុងគណនីនេះ — សូមពិនិត្យម្តងទៀត');
    if (!owner.current()) return unverified();
    const writes = healthDatabaseWriteRow();
    if (writes) return writes;
    const base = healthDatabaseRow();
    if (base.state !== 'ok') return base;
    const alive = await healthDatabaseRead();
    if (!owner.current()) return unverified();
    const pending = healthDatabaseWriteRow();
    if (pending) return pending;
    const current = healthDatabaseRow();
    if (current.state !== 'ok') return current;
    if (alive === false) {
        return healthRow('bad', databaseHealthLabel(), 'ភ្ជាប់តែ Server មិនឆ្លើយក្នុង ' + Math.round(DB_LIVENESS_PROBE_TIMEOUT_MS / 1000)
            + ' វិនាទី — សូមពិនិត្យបណ្ដាញ ហើយសាកម្តងទៀត');
    }
    return alive === true ? current : unverified();
}

export function healthClockRow() {
    if (!firebaseState.serverClockTrusted || !Number.isFinite(firebaseState.serverTimeOffsetMs)) {
        return healthRow('warn', 'នាឡិកា Server', 'មិនទាន់ sync — ការសម្អាតស្វ័យប្រវត្តិត្រូវបានផ្អាកដោយចេតនា');
    }
    const drift = Math.round(Math.abs(firebaseState.serverTimeOffsetMs) / 1000);
    const cleanupReady = cleanupClockIsTrustworthy();
    return healthRow(cleanupReady ? 'ok' : 'warn', 'នាឡិកា Server',
        'sync រួច · គម្លាតនឹងនាឡិកាឧបករណ៍ ' + drift + ' វិនាទី'
        + (cleanupReady ? '' : ' · ការសម្អាតផ្អាកព្រោះការតភ្ជាប់មិនរស់'));
}

export function healthTenantRow(account?, verified = false) {
    if (!account || !account.tenant_id) return healthRow('warn', 'ហាង (Supabase)', 'មិនទាន់ដឹងស្ថានភាពហាង — សូមចូលប្រព័ន្ធ ហើយភ្ជាប់អ៊ីនធឺណិត');
    const until = Date.parse(String(account.expires_at || ''));
    const untilText = Number.isFinite(until) ? getZoneDateKey(until, 0) : '—';
    const label = 'ហាង «' + String(account.tenant_name || '') + '» · សាខា ' + String(account.branch_code || '—') + ' · ផុត ' + untilText;
    if (!verified) return healthRow('info', 'ហាង (Supabase)', label + ' — ព័ត៌មានចុងក្រោយ មិនទាន់ផ្ទៀងផ្ទាត់ជាមួយ Server');
    if (account.status === 'revoked' || account.status === 'expired') return healthRow('bad', 'ហាង (Supabase)', label + ' — ' + (account.status === 'revoked' ? 'ត្រូវបានបិទ' : 'ផុតកំណត់'));
    if (account.status !== 'active' || !Number.isFinite(until) || (!firebaseState.serverClockTrusted || !Number.isFinite(getServerNow()))) return healthRow('warn', 'ហាង (Supabase)', label + ' — ស្ថានភាព ឬពេលផុតមិនទាន់ផ្ទៀងផ្ទាត់បាន');
    return healthRow(until > getServerNow() ? 'ok' : 'bad', 'ហាង (Supabase)', label + (until > getServerNow() ? ' — Server បានបញ្ជាក់ក្នុងការពិនិត្យនេះ' : ' — ផុតកំណត់'));
}

export async function healthTenantLiveRow() {
    const owner = captureConnectionOperation();
    const account = firebaseState.fb && typeof firebaseState.fb.accountOf === 'function' ? firebaseState.fb.accountOf(firebaseState.auth) : null;
    const transport = firebaseState.auth?._transport;
    if (!firebaseState.auth?.currentUser || !transport || typeof transport.rpc !== 'function' || (navigator.onLine as boolean) === false) return healthTenantRow(account);
    try {
        const rows = await withTimeout(transport.rpc('my_account', {}, 8000), 8000, 'Shop health timed out');
        if (!owner.current()) return healthTenantRow();
        const row = Array.isArray(rows) ? rows[0] : null;
        if (account?.tenant_id && row?.tenant_id !== account.tenant_id) return healthTenantRow();
        return healthTenantRow(row, true);
    } catch (e) { return owner.current() ? healthTenantRow(account) : healthTenantRow(); }
}

export const LICENSE_NEAR_EXPIRY_DAYS = 7;

export const LICENSE_DEFINITIVE_REASONS = ['expired', 'expired-server', 'revoked', 'not-found', 'signature', 'app-mismatch', 'seat-taken', 'format'];

export function healthKeyValidityText(status) {
    const exp = Number(status && status.exp);
    if (!Number.isFinite(exp) || exp <= 0) return '';
    const days = Number(status.daysLeft);
    return 'ផុត ' + getZoneDateKey(exp, 0) + (Number.isFinite(days) && days >= 0 ? ' (នៅសល់ ' + days + ' ថ្ងៃ)' : '');
}

export async function healthLicenseRow() {
    const backend = healthBackendKind();
    if (backend === 'none') return healthRow('info', HEALTH_ADVICE_LABELS.license, 'អាស្រ័យលើ Server ៖ Firebase ➜ Activation Key ពីអ្នកលក់ · Supabase ➜ ស្ថានភាពហាង (គ្មាន Key) — កំណត់ Config សិន');
    if (backend === 'supabase') return healthTenantLiveRow();
    if (!window.ZoeLicense || typeof ZoeLicense.checkOnline !== 'function') {
        return healthRow('warn', 'អាជ្ញាប័ណ្ណ', 'ម៉ូឌុល License មិនទាន់ផ្ទុក');
    }
    try {
        const status = await withTimeout(healthLicenseStatus(), 8000, 'License check timed out');
        const validity = healthKeyValidityText(status);
        if (status && status.state === 'active') {
            const days = Number(status.daysLeft);
            if (Number.isFinite(days) && days <= LICENSE_NEAR_EXPIRY_DAYS) {
                return healthRow('warn', 'អាជ្ញាប័ណ្ណ', 'Key សកម្ម · ' + validity + ' — ជិតផុតកំណត់ សូមទាក់ទងអ្នកលក់ដើម្បីពន្យារ');
            }
            return healthRow('ok', 'អាជ្ញាប័ណ្ណ', validity ? 'Key សកម្ម · ' + validity : 'Key សកម្ម');
        }
        if (status && status.state === 'offline-grace-exceeded') {
            return healthRow('warn', 'អាជ្ញាប័ណ្ណ', 'Key ត្រូវភ្ជាប់អ៊ីនធឺណិតដើម្បីផ្ទៀងផ្ទាត់ម្តងទៀត' + (validity ? ' · ' + validity : ''));
        }
        const reason = safeLookupReason(status && status.reason);
        if (status && status.state === 'required' && !reason) {
            return healthRow('bad', 'អាជ្ញាប័ណ្ណ', 'ឧបករណ៍នេះមិនទាន់មាន Activation Key');
        }
        if (status && status.state === 'required' && LICENSE_DEFINITIVE_REASONS.indexOf(reason) !== -1) {
            return healthRow('bad', 'អាជ្ញាប័ណ្ណ', licenseFailureMessage(reason));
        }
        return healthRow('warn', 'អាជ្ញាប័ណ្ណ', reason
            ? 'ផ្ទៀងផ្ទាត់ Key មិនបាន — ' + licenseFailureMessage(reason) + ' (មិនមែនមានន័យថា Key ខុសទេ)'
            : 'ស្ថានភាព ៖ ' + ((status && status.state) || 'មិនស្គាល់'));
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
        return healthRow('ok', 'កំណែ Apps Script (Lookup)', 'ចម្លើយ Lookup ចុងក្រោយ៖ កំណែ ' + lookupState.sheetScriptVersionSeen + ' — ត្រូវគ្នានឹង App');
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

export function healthStorageWritable(store) {
    if (!store) return false;
    const key = '__zoew_health_' + Math.random().toString(36).slice(2);
    let started = false;
    try {
        if (store.getItem(key) !== null) return false;
        started = true;
        store.setItem(key, key);
        if (store.getItem(key) !== key) return false;
        store.removeItem(key);
        return store.getItem(key) === null;
    } catch (e) { return false; }
    finally { if (started) { try { store.removeItem(key); } catch (e) {} } }
}

export function healthStorageRow() {
    const parts = [];
    if (!healthStorageWritable(appLocalStore)) parts.push('localStorage');
    if (!healthStorageWritable(appSessionStore)) parts.push('sessionStorage');
    return parts.length
        ? healthRow('bad', 'ការផ្ទុកក្នុងឧបករណ៍', parts.join(' និង ') + ' អាន/សរសេរមិនបាន — សូមពិនិត្យទំហំទំនេរ និងការអនុញ្ញាតផ្ទុករបស់ Browser')
        : healthRow('ok', 'ការផ្ទុកក្នុងឧបករណ៍', 'បានផ្ទៀងផ្ទាត់ការអាន និងសរសេរ');
}

export function healthServiceWorkerRow() {
    if (isNativeApp()) {
        return healthRow('ok', 'របៀបក្រៅបណ្ដាញ', 'App Android ៖ សំបក App ស្ថិតក្នុងកម្មវិធីរួចហើយ ➜ បើកបានពេលបណ្ដាញដាច់');
    }
    if (!('serviceWorker' in navigator)) {
        return healthRow('warn', 'របៀបក្រៅបណ្ដាញ', 'Browser នេះមិនគាំទ្រ Service Worker');
    }
    return navigator.serviceWorker.controller
        ? healthRow('info', 'របៀបក្រៅបណ្ដាញ', 'Service Worker គ្រប់គ្រងទំព័រនេះ តែមិនទាន់ផ្ទៀងផ្ទាត់សំបក App ក្នុង cache — នេះជាព័ត៌មាន មិនមែនកំហុស')
        : healthRow('warn', 'របៀបក្រៅបណ្ដាញ', 'មិនទាន់គ្រប់គ្រងទំព័រនេះ — សូមទាញចុះ ១ ដងទៀត');
}

export async function healthServiceWorkerLiveRow() {
    const base = healthServiceWorkerRow();
    if (base.state !== 'info' || typeof MessageChannel !== 'function') return base;
    const controller = navigator.serviceWorker.controller;
    try {
        return await new Promise<ReturnType<typeof healthRow>>((resolve) => {
            const channel = new MessageChannel();
            let settled = false;
            const finish = (row: ReturnType<typeof healthRow>) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                channel.port1.onmessage = null;
                channel.port1.close();
                channel.port2.close();
                resolve(row);
            };
            const timer = setTimeout(() => finish(base), 2000);
            channel.port1.onmessage = (event) => {
                const data = event.data;
                if (navigator.serviceWorker.controller !== controller || !data
                    || data.type !== 'ZOEW_HEALTH_SHELL' || data.version !== __CACHE_VERSION__
                    || typeof data.ready !== 'boolean') { finish(base); return; }
                finish(data.ready
                    ? healthRow('ok', 'របៀបក្រៅបណ្ដាញ', 'បានផ្ទៀងផ្ទាត់សំបក App ក្នុង cache — ការទាញ និងផ្ញើទិន្នន័យទៅ Server នៅត្រូវការបណ្ដាញ')
                    : healthRow('warn', 'របៀបក្រៅបណ្ដាញ', 'សំបក App ក្នុង cache មិនទាន់ពេញលេញ — សូមបើក App ខណៈមានបណ្ដាញ រួចពិនិត្យម្តងទៀត'));
            };
            try { controller.postMessage({ type: 'ZOEW_HEALTH_SHELL' }, [channel.port2]); }
            catch (e) { finish(base); }
        });
    } catch (e) { return base; }
}

export function ztoDiagnosticsUrl(cfg) {
    const raw = String(cfg.url).trim();
    const marker = '/.netlify/functions/zto-order-detail';
    const markerAt = raw.toLowerCase().indexOf(marker);
    return (markerAt === -1 ? marker : raw.slice(0, markerAt) + marker) + (lookupApiIsPalm(cfg) ? '?palm=1&diag=1' : '?diag=1');
}

export function durationText(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '';
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'មិនដល់ ១ នាទី';
    if (min < 60) return min + ' នាទី';
    const hours = Math.floor(min / 60);
    if (hours < 48) return hours + ' ម៉ោង';
    return Math.floor(hours / 24) + ' ថ្ងៃ';
}

export function ztoBlobAgeText(cookie) {
    if (!cookie || cookie.source !== 'blob') return '';
    const synced = durationText(cookie.blobSyncAgeMs);
    const renewed = durationText(cookie.blobRenewAgeMs);
    if (!synced && !renewed) return ' · អាយុក្នុង Blob ៖ មិនទាន់ស្គាល់ (Sync ម្តងទៀតដើម្បីវាស់)';
    return (synced ? ' · Sync ចូល Blob ' + synced + 'មុន' : '') + (renewed ? ' · បន្តអាយុចុងក្រោយ ' + renewed + 'មុន' : '');
}

function lifeDurationText(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '';
    const min = Math.floor(ms / 60000);
    if (min < 60) return durationText(ms);
    const rest = min % 60;
    return Math.floor(min / 60) + ' ម៉ោង' + (rest ? ' ' + rest + ' នាទី' : '');
}

export function ztoCookieLifeText(body) {
    const life = body && body.cookie && Array.isArray(body.cookie.life) ? body.cookie.life : [];
    const parts = [];
    for (let i = 0; i < life.length && i < 8 && parts.length < 3; i++) {
        const entry = life[i];
        if (!entry || entry.ended !== true) continue;
        const alive = lifeDurationText(entry.aliveMs);
        const rejected = lifeDurationText(entry.rejectedAfterMs);
        if (!alive && !rejected) continue;
        const idle = lifeDurationText(entry.idleMs);
        parts.push((alive ? 'ប្រើបាន ' + alive : 'មិនដែលប្រើបាន') + (rejected ? ' ➜ បដិសេធនៅ ' + rejected : '')
            + (idle ? ' (ទំនេរ ' + idle + ' មុនបដិសេធ)' : ''));
    }
    return parts.length ? ' · អាយុ Cookie ក្រោយ Sync ៖ ' + parts.join(' / ') : '';
}

function upstreamMs(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function upstreamSeconds(ms) {
    return (ms / 1000).toFixed(2) + ' វិនាទី';
}

export function ztoUpstreamTimingText(body, palm) {
    const timing = body && typeof body.upstreamTiming === 'object' ? body.upstreamTiming : null;
    if (!timing) return '';
    const scan = palm ? (timing.palm && timing.palm.detail) : timing.detail;
    const count = scan && typeof scan.count === 'number' && Number.isFinite(scan.count) ? Math.max(0, Math.round(scan.count)) : 0;
    const avg = scan ? upstreamMs(scan.avgMs) : null;
    const last = scan ? upstreamMs(scan.lastMs) : null;
    if (!count || avg === null || last === null) return ' · ពេល ZTO ឆ្លើយ ៖ ស្កេនកញ្ចប់ ១ រួចពិនិត្យម្តងទៀតដើម្បីឃើញ';
    let text = ' · ZTO ឆ្លើយពេលស្កេន ៖ មធ្យម ' + upstreamSeconds(avg) + ' · ចុងក្រោយ ' + upstreamSeconds(last) + ' (' + count + ' ដង)';
    const timeouts = typeof scan.timeouts === 'number' && Number.isFinite(scan.timeouts) ? Math.round(scan.timeouts) : 0;
    if (timeouts > 0) text += ' · ហួសពេល ' + timeouts + ' ដង';
    const conn = timing.connections && typeof timing.connections === 'object'
        ? (palm ? timing.connections.palm : timing.connections.argus) : null;
    const connCount = conn && typeof conn.count === 'number' && Number.isFinite(conn.count) ? Math.max(0, Math.round(conn.count)) : 0;
    const connAvg = conn ? upstreamMs(conn.avgMs) : null;
    if (connCount > 0) text += ' · ភ្ជាប់ថ្មីទៅ ZTO ' + connCount + ' ដង' + (connAvg === null ? '' : ' (មធ្យម ' + upstreamSeconds(connAvg) + ')');
    return text + ztoScanConnectionText(timing.scans && typeof timing.scans === 'object' ? (palm ? timing.scans.palm : timing.scans.argus) : null)
        + ztoRuntimeText(body.runtime);
}

function upstreamCount(value) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function ztoScanConnectionText(side) {
    if (!side || typeof side !== 'object') return '';
    let text = '';
    for (const [key, label] of [['fresh', 'ស្កេនលើការភ្ជាប់ថ្មី'], ['reused', 'ស្កេនលើការភ្ជាប់ដែលបើករួច']]) {
        const bucket = side[key];
        const count = bucket ? upstreamCount(bucket.count) : 0;
        const avg = bucket ? upstreamMs(bucket.avgMs) : null;
        if (count && avg !== null) text += ' · ' + label + ' មធ្យម ' + upstreamSeconds(avg) + ' (' + count + ' ដង)';
    }
    if (!text) return '';
    if (upstreamCount(side.closes) > 0) return text + ' · ZTO បិទការភ្ជាប់ក្រោយឆ្លើយ';
    const keepAlive = upstreamCount(side.keepAliveSec);
    return text + (keepAlive > 0 ? ' · ZTO ទុកការភ្ជាប់ ' + keepAlive + ' វិនាទី' : ' · ZTO មិនប្រាប់រយៈទុកការភ្ជាប់');
}

function ztoRuntimeText(runtime) {
    const region = runtime && typeof runtime.region === 'string' ? runtime.region : '';
    return /^[a-z]{2}(?:-[a-z]+)+-\d{1,2}$/.test(region) ? ' · Function នៅ ' + region : '';
}

function ztoAccessText(body) {
    const access = body && body.access;
    if (!access || typeof access !== 'object') return '';
    const label = safeLookupReason(access.keyLabel);
    const mode = safeLookupReason(access.identity);
    return (label ? ' · សោហាង ' + label : '') + (mode && mode !== 'off' ? ' · ផ្ទៀងគណនី ' + mode : '');
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

export function ztoSignedMismatchText(body) {
    const signal = body && body.list && body.list.signedMismatch;
    const count = signal && signal.observed === true && Number.isFinite(signal.count) && signal.count > 0 ? signal.count : 0;
    if (!count) return '';
    const age = durationText(signal.ageMs);
    const seen = ztoMismatchTexts(signal.texts);
    const expected = ztoExpectedTexts(signal.expected);
    return ' · ⚠️ បញ្ជី «ចុះហត្ថលេខា» ៖ ZTO ផ្ញើ ' + count + ' កញ្ចប់ ដែលអត្ថបទប្រភេទស្កេនខុសពី ZTO_LIST_SIGNED_SCAN_DESC'
        + (age ? ' (ចុងក្រោយ ' + age + 'មុន)' : '')
        + (seen.length ? ' — Function ទទួល ' + seen.map(ztoTextWithCodePoints).join(' / ') + (expected.length ? ' ≠ Server រំពឹង ' + expected.map(ztoTextWithCodePoints).join(' / ') : '') : '')
        + ' ➜ មិនរាប់ជាភស្តុតាងបិទ — សូមកែអត្ថបទនោះនៅ Netlify';
}

export async function healthLookupRow() {
    const cfg = getLookupApiConfig();
    if (!cfg || !cfg.enabled || !cfg.url) {
        return healthRow('info', 'Lookup អតិថិជន', 'មិនទាន់បើក');
    }
    let host = '';
    try { host = new URL(String(cfg.url).trim()).hostname; } catch (e) { host = ''; }
    if (lookupApiIsAppsScript(cfg)) {
        return healthRow('info', 'Lookup អតិថិជន (Google Sheet)',
            'បើករួច · ' + (host || 'script.google.com') + ' · មិនផ្ញើ Header ផ្ទាល់ខ្លួន · នេះជាការកំណត់ មិនមែនលទ្ធផលវាស់សេវាផ្ទាល់');
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
    if (lookupApiIsPalm(cfg)) return healthPalmLookupRow(cfg, headers);
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
        const mismatchText = ztoSignedMismatchText(body);
        const cookieText = 'Cookie ពី ' + source + ' · លេខសម្គាល់ ' + fingerprint
            + ztoBlobAgeText(body && body.cookie)
            + (typeof ageMs === 'number' ? ' · Server អានចុងក្រោយ ' + (durationText(ageMs) || '0 នាទី') + 'មុន' : '')
            + (reason ? ' · ' + reason : '')
            + ztoRenewalText(body)
            + ztoCookieLifeText(body)
            + ztoAccessText(body)
            + ztoUpstreamTimingText(body, false)
            + mismatchText;
        if (typeof rejectedAgeMs === 'number' && Number.isFinite(rejectedAgeMs) && rejectedAgeMs >= 0) {
            return healthRow('bad', 'Lookup អតិថិជន (ZTO)',
                'ZTO បដិសេធ Cookie នេះ — សូមចូល Argus ហើយរត់ឧបករណ៍ sync-zto-cookie លើ Windows '
                + 'ដើម្បីផ្ទៀងផ្ទាត់ និង Sync ម្ដងទៀត · ' + cookieText);
        }
        if (typeof acceptedAgeMs !== 'number' || !Number.isFinite(acceptedAgeMs) || acceptedAgeMs < 0) {
            return healthRow('warn', 'Lookup អតិថិជន (ZTO)',
                'មាន Cookie តែ ZTO មិនទាន់ដែលប្រើវា ➜ ពិនិត្យមិនបានថាវានៅសុពលភាព។ '
                + 'សូមស្កេនកញ្ចប់ ១ រួចពិនិត្យម្ដងទៀត · ' + cookieText);
        }
        return healthRow(mismatchText ? 'warn' : 'info', 'Lookup អតិថិជន (ZTO)', 'ZTO ធ្លាប់ទទួលយក ' + durationText(acceptedAgeMs) + 'មុន — សុពលភាពឥឡូវមិនទាន់ផ្ទៀងផ្ទាត់ · ' + cookieText);
    } catch (e) {
        return healthRow('bad', 'Lookup អតិថិជន (ZTO)', 'ភ្ជាប់ទៅ Server មិនបាន — ' + safeLookupReason(e && e.message));
    }
}

async function healthPalmLookupRow(cfg, headers) {
    const title = 'Lookup អតិថិជន (ZTO)';
    try {
        const identityHeaders = {};
        await Promise.all([addPalmSessionHeader(cfg, headers), addZtoIdentityHeader(cfg, identityHeaders)]);
        Object.assign(headers, identityHeaders);
    } catch (e) {
        return healthRow('warn', title, 'មិនទាន់មាន session ZTO — សូម Login ZTO ក្នុង «API ស្វែងរកអតិថិជន»');
    }
    try {
        const out = await fetchWithTimeout(ztoDiagnosticsUrl(cfg) + '&verify=1',
            { method: 'GET', headers, cache: 'no-store', credentials: 'same-origin' },
            ZTO_TEST_TIMEOUT_MS, 'ZTO diagnostics timed out',
            (r) => r.json().catch(() => null));
        const res = out && out.res;
        const body = out && out.body;
        const code = body && typeof body.code === 'string' ? body.code : '';
        const reason = safeLookupReason(body && body.reason);
        if (res && res.ok && body && body.provider === 'zto-palm') {
            const session = body.session && typeof body.session === 'object' ? body.session : null;
            if (session && session.source === 'none') {
                return healthRow('warn', title, session.rejected
                    ? 'ZTO បដិសេធ Login ZTO របស់ហាង — សូម Login ZTO ម្តងទៀតក្នុង «API ស្វែងរកអតិថិជន»'
                    : 'មិនទាន់មាន session ZTO — សូម Login ZTO ក្នុង «API ស្វែងរកអតិថិជន»');
            }
            if (body.success === true && body.configured === true && body.verified === true
                && session && (session.source === 'shared' || session.source === 'device') && session.rejected !== true) {
                return healthRow('ok', title, 'ZTO ទទួលយក session ZTO' + (session.source === 'shared' ? ' របស់ហាងលើ Server' : '') + ztoUpstreamTimingText(body, true));
            }
            if (Object.prototype.hasOwnProperty.call(body, 'verified') || body.success !== true || body.configured !== true) {
                return healthRow('warn', title, 'ចម្លើយពិនិត្យ Session ZTO មិនច្បាស់ — សូមពិនិត្យម្តងទៀត។');
            }
            return healthRow('info', title, (session && session.source === 'shared' ? 'មាន session ZTO របស់ហាងលើ Server' : 'មាន session ZTO')
                + ' — សូមស្កេនកញ្ចប់ ដើម្បីផ្ទៀងផ្ទាត់ជាមួយ ZTO' + ztoUpstreamTimingText(body, true));
        }
        if (code === 'ZTO_AUTH_EXPIRED') {
            return healthRow('warn', title, 'Session ZTO ផុតកំណត់ — សូម Login ZTO ម្តងទៀតក្នុង «API ស្វែងរកអតិថិជន»');
        }
        if (code === 'ZTO_OTHER_BRANCH') return healthRow('warn', title, 'Session ZTO ជាសាខាផ្សេង — សូម Login ZTO ដោយគណនីរបស់សាខានេះ។');
        if (code === 'ZTO_RATE_LIMITED') return healthRow('warn', title, 'ZTO កំណត់ល្បឿន — សូមរង់ចាំបន្តិច ហើយពិនិត្យម្តងទៀត។');
        if (code === 'ZTO_PALM_NOT_CONFIGURED' || code === 'ZTO_CONFIG_INVALID' || code === 'ZTO_PROXY_NOT_CONFIGURED') {
            return healthRow('bad', title, 'Server មិនទាន់កំណត់ ZTO នៅ Netlify' + (reason ? ' — ជាប់ត្រង់ ' + reason : ''));
        }
        const status = Number(res && res.status);
        return healthRow('bad', title, 'Server ឆ្លើយ HTTP ' + (Number.isFinite(status) ? status : 'មិនស្គាល់'));
    } catch (e) {
        return healthRow('bad', title, 'ភ្ជាប់ទៅ Server មិនបាន — ' + safeLookupReason(e && e.message));
    }
}

export function openHealthCheck() {
    const alreadyOpen = modalIsOpen('healthCheckModal');
    closeSideDrawer();
    openModalHelper('healthCheckModal');
    loadDeviceInfo();
    runHealthCheck(!alreadyOpen);
}

let healthActiveRun = 0;
let healthCompletedRun = 0;

export function resetHealthCheck() {
    ++uiState.healthRunSeq;
    healthActiveRun = 0;
    healthCompletedRun = 0;
    healthCheckTask = null;
    viewState.healthRecheckBusy = false;
    uiState.healthRows = null;
    uiState.healthAdvice = null;
}

export function healthCheckResultIsCurrent() {
    return healthCompletedRun > 0 && healthCompletedRun === uiState.healthRunSeq && uiState.healthRows !== null;
}

interface HealthCheckTask {
    run: number;
    owner: ReturnType<typeof captureConnectionOperation>;
    worker: ServiceWorker | null | undefined;
    lookupConfig: string | null;
    promise: Promise<void>;
}

let healthCheckTask: HealthCheckTask | null = null;

export function runHealthCheck(force = false): Promise<void> {
    const worker = navigator.serviceWorker?.controller;
    const lookupConfig = safeStoreGet(appLocalStore, 'zoew_lookup_api_config');
    const previous = healthCheckTask;
    if (force !== true && previous && previous.run === uiState.healthRunSeq && previous.owner.current()
        && previous.worker === worker && previous.lookupConfig === lookupConfig && modalIsOpen('healthCheckModal')) return previous.promise;
    const task: HealthCheckTask = { run: ++uiState.healthRunSeq, owner: captureConnectionOperation(), worker, lookupConfig, promise: Promise.resolve() };
    healthCheckTask = task;
    task.promise = runHealthCheckRound(task).finally(() => { if (healthCheckTask === task) healthCheckTask = null; });
    return task.promise;
}

async function runHealthCheckRound(task: HealthCheckTask) {
    const { run, owner, worker, lookupConfig } = task;
    healthActiveRun = run;
    viewState.healthRecheckBusy = true;
    uiState.healthRows = [healthPendingRow()];
    uiState.healthAdvice = null;
    uiState.touch();
    try {
        const [databaseRow, licenseRow, lookupRow, offlineRow, networkRow] = await Promise.all([healthDatabaseLiveRow(), healthLicenseRow(), healthLookupRow(), healthServiceWorkerLiveRow(), healthNetworkLiveRow()]);
        const rows = [healthNetworkRow(owner.current() && networkRow.state === 'ok'), healthClockRow(), healthStorageRow(), healthServiceWorkerRow(), healthCustomerTableRow(), healthSheetScriptRow()];
        rows[3] = worker === navigator.serviceWorker?.controller ? offlineRow : healthServiceWorkerRow();
        const currentDatabase = healthDatabaseRow();
        rows.splice(1, 0, healthDatabaseWriteRow() || (currentDatabase.state === 'ok' ? databaseRow : currentDatabase));
        rows.splice(3, 0, licenseRow);
        rows.push(lookupRow);
        if (run !== uiState.healthRunSeq || !owner.current() || lookupConfig !== safeStoreGet(appLocalStore, 'zoew_lookup_api_config') || !modalIsOpen('healthCheckModal')) return;
        uiState.healthRows = rows;
        healthCompletedRun = run;
        uiState.healthAdvice = buildHealthAdvice(rows);
        uiState.touch();
    } catch (e) {
        if (run === uiState.healthRunSeq && modalIsOpen('healthCheckModal')) {
            uiState.healthRows = [healthRow('warn', 'ពិនិត្យសុខភាព', 'ពិនិត្យមិនបានពេញលេញ — សូមពិនិត្យម្តងទៀត')];
            healthCompletedRun = run;
            uiState.healthAdvice = null;
        }
    } finally {
        if (healthActiveRun === run) viewState.healthRecheckBusy = false;
    }
}
