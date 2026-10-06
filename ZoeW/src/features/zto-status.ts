import { modalIsOpen } from '../core/modals';
import { viewState } from '../core/view-state';
import { dataState, firebaseState, lookupState, securityState, uiState, ztoState } from '../core/state';
import { getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { appLocalStore, safeStoreGet, safeStoreRemove, safeStoreSet } from '../core/storage';
import { ZTO_AUTOCLOSE_KEY, ZTO_STATUS_STORE_KEY } from '../core/storage-keys';
import { VIEW_NOT_MEASURABLE_NOTICE, VIEW_NOT_MEASURABLE_TEXT, ZTO_SYNC_VIEW_KEYS } from '../core/text';
import { getZoneDateKey } from '../core/timezone';
import { itemHasRestoreMarkers, sanitizeInput } from '../domain/barcode';
import { pickupBarcodeKey } from '../domain/pickup';
import { ZTO_AUTO_LOOKUP_TIMEOUT_MS, autoLookupInFlight } from './auto-lookup';
import { applyBarcodeCloseChange } from './barcode-ops';
import { isPinFlowPending } from './config';
import { lookupApiIsZto } from './customer-table-prefetch';
import { buildLookupRequestHeaders, lookupApiSendsHeader } from './lookup-api';
import { getLookupApiConfig } from './lookup-config';
import { requestPinBeforeConfig } from './pin';
import { trashReasonOf } from './trash';
import { ZTO_FAST_MODE_HINT, fetchZtoSignedCodes, ztoListSignedEvidence, ztoListSignedProbe } from './zto-list-sync';
import { anyDbListenerViewIsStale, emptyViewMessage } from '../services/db-listeners';
import { fetchWithTimeout, linkIsFrugal } from '../services/network';
import { closeModal, openModalHelper } from '../ui/modal';
import { drawerAction } from '../ui/page-nav';
import { showToast } from '../ui/toast';

export const ZTO_STATUS_TTL_MS = 12 * 60 * 60 * 1000;

export const ZTO_STATUS_MAX = 300;

export const ZTO_STATUS_SWEEP_DELAY_MS = 1500;

export const ZTO_STATUS_SWEEP_GAP_MS = 20000;

export const ZTO_STATUS_FAIL_BACKOFF_MS = [20000, 60000, 180000, 600000];

export const ZTO_STATUS_SWEEP_BATCH = 10;

export const ZTO_STATUS_BANNER_CODES = 3;

export const ZTO_OPEN_RECHECK_MS = 60 * 60 * 1000;

export const ZTO_SIGNED_SWEEP_GAP_MS = 2 * 60 * 1000;

export const ZTO_SIGNED_SWEEP_IDLE_MS = 30 * 60 * 1000;

export const ZTO_SIGNED_SWEEP_LOOKBACK_DAYS = 7;

export const ZTO_SIGNED_SWEEP_RECENT_MS = 12 * 60 * 60 * 1000;

export const ztoPickupStatus = new Map();

export function captureZtoSession() {
    const generation = ztoState.ztoSessionGeneration;
    const capturedAuthGeneration = firebaseState.authGeneration;
    const lookupGeneration = lookupState.customerDataTableSessionGeneration;
    const capturedDatabase = firebaseState.db;
    return {
        ownsLock: () => generation === ztoState.ztoSessionGeneration,
        current: () => generation === ztoState.ztoSessionGeneration
            && capturedAuthGeneration === firebaseState.authGeneration
            && lookupGeneration === lookupState.customerDataTableSessionGeneration
            && capturedDatabase === firebaseState.db
    };
}

export function loadZtoPickupStatusOnce() {
    if (ztoState.ztoStatusLoaded) return;
    ztoState.ztoStatusLoaded = true;
    let parsed = null;
    try {
        const raw = appLocalStore ? appLocalStore.getItem(ZTO_STATUS_STORE_KEY) : null;
        parsed = raw ? JSON.parse(raw) : null;
    } catch (e) {
        parsed = null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    Object.keys(parsed).forEach((key) => {
        const entry = parsed[key];
        if (!entry || typeof entry !== 'object') return;
        if (entry.closed !== true && entry.closed !== false && entry.closed !== null) return;
        const at = parseFloat(entry.at);
        if (!isFinite(at) || elapsedSince(at) > ZTO_STATUS_TTL_MS) return;
        ztoPickupStatus.set(key, { closed: entry.closed, at: at });
    });
}

export function saveZtoPickupStatus() {
    const out = {};
    ztoPickupStatus.forEach((entry, key) => { out[key] = { closed: entry.closed, at: entry.at }; });
    safeStoreSet(appLocalStore, ZTO_STATUS_STORE_KEY, JSON.stringify(out));
}

export function clearZtoPickupStatusStore() {
    ztoState.ztoSessionGeneration++;
    clearTimeout(ztoState.ztoStatusSweepTimer);
    ztoState.ztoStatusSweepTimer = null;
    ztoState.ztoStatusInFlight = false;
    ztoState.ztoStatusLastSweepAt = 0;
    ztoState.ztoStatusSweepCursor = 0;
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    ztoState.ztoListPreview = null;
    ztoListSignedProbe.clear();
    ztoListSignedEvidence.clear();
    viewState.ztoListSyncSite = '';
    ztoState.ztoSignedSweepAt = 0;
    ztoState.ztoSignedSweepOkAt = 0;
    ztoState.ztoSignedSweepWaitMs = 0;
    ztoPickupStatus.clear();
    ztoState.ztoStatusBannerSig = '';
    ztoState.ztoStatusModalSig = '';
    ztoState.ztoStatusFailStreak = 0;
    safeStoreRemove(appLocalStore, ZTO_STATUS_STORE_KEY);
    renderZtoSyncBanner();
}

export function evictOneZtoPickupVerdict(protectedKey) {
    let victim = null;
    ztoPickupStatus.forEach((entry, key) => {
        if (victim !== null || key === protectedKey) return;
        if (!entry || entry.closed !== false) victim = key;
    });
    if (victim === null) {
        ztoPickupStatus.forEach((entry, key) => {
            if (victim !== null || key === protectedKey) return;
            victim = key;
        });
    }
    if (victim === null) return false;
    ztoPickupStatus.delete(victim);
    return true;
}

export function setZtoPickupVerdict(code, closed) {
    const key = pickupBarcodeKey(code);
    if (!key) return;
    if (closed !== true && closed !== false && closed !== null) return;
    loadZtoPickupStatusOnce();
    ztoPickupStatus.delete(key);
    ztoPickupStatus.set(key, { closed: closed, at: Date.now() });
    while (ztoPickupStatus.size > ZTO_STATUS_MAX) {
        if (!evictOneZtoPickupVerdict(key)) break;
    }
    saveZtoPickupStatus();
}

export function rotateZtoSweepQueue(list, cursor) {
    if (!Array.isArray(list) || list.length <= 1) return list || [];
    const at = ((cursor % list.length) + list.length) % list.length;
    if (!at) return list;
    return list.slice(at).concat(list.slice(0, at));
}

export function ztoStatusFeatureConfig() {
    const cfg = getLookupApiConfig();
    if (!cfg || !cfg.enabled || !cfg.url || !lookupApiIsZto(cfg)) return null;
    return cfg;
}

export function ztoFastModeIsOn() {
    const cfg = getLookupApiConfig();
    return !!(cfg && cfg.fastMode);
}

export function ztoStatusTrashItemCounts(item) {
    if (!item || trashReasonOf(item) !== 'pickup') return false;
    const deletedAt = parseFloat(item.deletedAt);
    if (!isFinite(deletedAt) || deletedAt <= 0) return false;
    return (getServerNow() - deletedAt) <= ZTO_STATUS_TTL_MS;
}

export function collectClosedBarcodesForZtoStatus(dataToScan = dataState.scanHistory, trashToScan = dataState.deletedItems) {
    const out = [];
    const seen = new Set();
    const addFrom = (list, trashSide) => {
        if (!Array.isArray(list)) return;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (trashSide && !ztoStatusTrashItemCounts(item)) continue;
            const codes = item && Array.isArray(item.barcodes) ? item.barcodes : null;
            if (!codes) continue;
            for (let j = 0; j < codes.length; j++) {
                const b = codes[j];
                if (!b || !b.isClosed) continue;
                const key = pickupBarcodeKey(b.code);
                if (!key || seen.has(key)) continue;
                seen.add(key);
                out.push({
                    key: key,
                    code: String(b.code || ''),
                    phone: String((item && item.phone) || ''),
                    locker: String((b && b.locker) || (item && item.locker) || '')
                });
            }
        }
    };
    addFrom(dataToScan, false);
    addFrom(trashToScan, true);
    return out;
}

export function ztoAutoCloseEnabled() {
    return ztoFastModeIsOn() && safeStoreGet(appLocalStore, ZTO_AUTOCLOSE_KEY) !== '0';
}

export function refreshZtoAutoCloseUi() {
    const on = ztoAutoCloseEnabled();
    viewState.ztoAutoCloseText = on ? 'បើក' : 'បិទ';
    viewState.ztoAutoCloseOn = on;
    viewState.ztoAutoCloseVisible = ztoFastModeIsOn();
}

export function drawerZtoAutoCloseFlow() {
    drawerAction(function () {
        if (!ztoFastModeIsOn()) {
            showToast(ZTO_FAST_MODE_HINT);
            return;
        }
        const next = !ztoAutoCloseEnabled();
        safeStoreSet(appLocalStore, ZTO_AUTOCLOSE_KEY, next ? '1' : '0');
        refreshZtoAutoCloseUi();
        showToast(next
            ? '✅ បើករួច ៖ កញ្ចប់ដែល ZTO បិទរួច នឹងបិទក្នុង ZoeW ដោយស្វ័យប្រវត្តិ'
            : 'ℹ️ បិទរួច ៖ ត្រូវចុចបិទ «យក» ដោយដៃវិញ');
        if (next) scheduleZtoStatusSweep(ZTO_STATUS_SWEEP_DELAY_MS);
    });
}

export function ztoOpenRecheckIsDue(entry) {
    if (!entry) return true;
    return elapsedSince(entry.at) > ZTO_OPEN_RECHECK_MS;
}

export function collectOpenBarcodesForZtoStatus(dataToScan = dataState.scanHistory) {
    const out = [];
    const seen = new Set();
    if (!Array.isArray(dataToScan)) return out;
    for (let i = 0; i < dataToScan.length; i++) {
        const item = dataToScan[i];
        if (!item || !item.id) continue;
        if (item.clearClaim || itemHasRestoreMarkers(item)) continue;
        const codes = Array.isArray(item.barcodes) ? item.barcodes : null;
        if (!codes) continue;
        for (let j = 0; j < codes.length; j++) {
            const b = codes[j];
            if (!b || b.isClosed) continue;
            const key = pickupBarcodeKey(b.code);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push({ key: key, code: String(b.code || ''), itemId: String(item.id), open: true });
        }
    }
    return out;
}

export async function autoCloseBarcodeFromZto(entry, dataToScan) {
    if (!entry || !ztoAutoCloseEnabled()) return false;
    const list = Array.isArray(dataToScan) ? dataToScan : dataState.scanHistory;
    const item = list.find((i) => i && i.id === entry.itemId);
    if (!item || !Array.isArray(item.barcodes)) return false;
    const b = item.barcodes.find((x) => x && x.code === entry.code);
    if (!b || b.isClosed) return false;
    const done = await applyBarcodeCloseChange(entry.itemId, entry.code, true,
        { silent: true, showModal: false });
    return done === undefined ? undefined : done === true;
}

export function ztoSignedSweepIsDue(force) {
    if (force || !ztoState.ztoSignedSweepAt) return true;
    return elapsedSince(ztoState.ztoSignedSweepAt) >= (ztoState.ztoSignedSweepWaitMs || ZTO_SIGNED_SWEEP_GAP_MS);
}

export function ztoSignedSweepRange() {
    const now = getServerNow();
    const recent = ztoState.ztoSignedSweepOkAt
        && elapsedSince(ztoState.ztoSignedSweepOkAt) < ZTO_SIGNED_SWEEP_RECENT_MS;
    return { from: getZoneDateKey(now, recent ? -1 : -ZTO_SIGNED_SWEEP_LOOKBACK_DAYS), to: getZoneDateKey(now, 0) };
}

export function ztoSignedCloseIsHeld(key, force) {
    if (force) return false;
    const verdict = ztoPickupStatus.get(key);
    return !!(verdict && verdict.closed === true && !ztoOpenRecheckIsDue(verdict));
}

export async function closeZtoSignedBarcodes(cfg, entries, dataToScan, force?) {
    const session = captureZtoSession();
    const out = { closed: 0, more: false, keys: new Set() };
    if (!Array.isArray(entries) || !entries.length) return out;
    ztoState.ztoSignedSweepAt = Date.now();
    const range = ztoSignedSweepRange();
    let signed = null;
    try {
        signed = await fetchZtoSignedCodes(cfg, range.from, range.to);
    } catch (e) {
        if (!session.current()) return out;
        const grown = (ztoState.ztoSignedSweepWaitMs || ZTO_SIGNED_SWEEP_GAP_MS) * 2;
        ztoState.ztoSignedSweepWaitMs = e && e.notConfigured
            ? ZTO_SIGNED_SWEEP_IDLE_MS
            : Math.min(ZTO_SIGNED_SWEEP_IDLE_MS, grown);
        return out;
    }
    if (!session.current()) return out;
    if (!signed || !signed.measured) {
        ztoState.ztoSignedSweepWaitMs = ZTO_SIGNED_SWEEP_IDLE_MS;
        return out;
    }
    ztoState.ztoSignedSweepOkAt = Date.now();
    ztoState.ztoSignedSweepWaitMs = ZTO_SIGNED_SWEEP_GAP_MS;
    const signedKeys = new Set();
    for (let i = 0; i < signed.codes.length; i++) {
        const key = pickupBarcodeKey(signed.codes[i]);
        if (key) signedKeys.add(key);
    }
    let tried = 0;
    for (let i = 0; i < entries.length; i++) {
        if (!signedKeys.has(entries[i].key) || ztoSignedCloseIsHeld(entries[i].key, force)) continue;
        if (tried >= ZTO_STATUS_SWEEP_BATCH) {
            out.more = true;
            ztoState.ztoSignedSweepWaitMs = 1;
            break;
        }
        if ((navigator.onLine as boolean) === false) break;
        tried++;
        const done = await autoCloseBarcodeFromZto(entries[i], dataToScan);
        if (!session.current()) return { closed: 0, more: false, keys: new Set() };
        if (done === undefined) break;
        if (done) {
            out.closed++;
            out.keys.add(entries[i].key);
            setZtoPickupVerdict(entries[i].code, true);
        }
    }
    return out;
}

export function ztoStatusPendingList(dataToScan = dataState.scanHistory, trashToScan = dataState.deletedItems) {
    loadZtoPickupStatusOnce();
    let hasOpenVerdict = false;
    ztoPickupStatus.forEach((entry) => { if (entry && entry.closed === false) hasOpenVerdict = true; });
    if (!hasOpenVerdict) return [];
    const out = [];
    collectClosedBarcodesForZtoStatus(dataToScan, trashToScan).forEach((entry) => {
        const verdict = ztoPickupStatus.get(entry.key);
        if (verdict && verdict.closed === false) out.push(entry);
    });
    return out;
}

export function ztoStatusPendingCodes(dataToScan = dataState.scanHistory, trashToScan = dataState.deletedItems) {
    return ztoStatusPendingList(dataToScan, trashToScan).map((entry) => entry.code);
}

export function ztoStatusUnmeasuredCount(dataToScan = dataState.scanHistory, trashToScan = dataState.deletedItems) {
    let n = 0;
    collectClosedBarcodesForZtoStatus(dataToScan, trashToScan).forEach((entry) => {
        if (!ztoPickupStatus.get(entry.key)) n++;
    });
    return n;
}

export function renderZtoSyncBanner(dataToScan = dataState.scanHistory, trashToScan = dataState.deletedItems) {
    const pending = ztoStatusPendingCodes(dataToScan, trashToScan);
    const codes = pending.length && ztoStatusFeatureConfig() ? pending : [];
    const waiting = codes.length ? ztoStatusUnmeasuredCount(dataToScan, trashToScan) : 0;
    const stale = anyDbListenerViewIsStale(ZTO_SYNC_VIEW_KEYS);
    const signature = codes.length + '|' + waiting + '|' + (stale ? '1' : '0') + '|'
        + codes.slice(0, ZTO_STATUS_BANNER_CODES).join(',');
    if (signature === ztoState.ztoStatusBannerSig) return;
    ztoState.ztoStatusBannerSig = signature;
    if (!codes.length) {
        ztoState.ztoBannerView = null;
        ztoState.touch();
        return;
    }
    const more = codes.length > ZTO_STATUS_BANNER_CODES
        ? ' · និង ' + (codes.length - ZTO_STATUS_BANNER_CODES) + ' ទៀត' : '';
    const waitingNote = waiting ? ' · កំពុងពិនិត្យបន្ត ' + waiting + ' ទៀត' : '';
    const staleNote = stale ? ' · ' + VIEW_NOT_MEASURABLE_TEXT : '';
    ztoState.ztoBannerView = {
        headline: codes.length + ' កញ្ចប់បិទក្នុង ZoeW តែ ZTO មិនទាន់បិទ',
        detail: codes.slice(0, ZTO_STATUS_BANNER_CODES).join(' · ') + more + waitingNote
            + staleNote + ' — ចុចដើម្បីពិនិត្យម្តងទៀត'
    };
    ztoState.touch();
}

export const CODE128_PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
    '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
    '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
    '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
    '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
    '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
    '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
    '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
    '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
    '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
    '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
    '211214', '211232', '2331112'
];

export const CODE128_START_B = 104;

export const CODE128_START_C = 105;

export const CODE128_STOP = 106;

export const CODE128_QUIET = 10;

export const CODE128_HEIGHT = 60;

export function code128Values(text) {
    const raw = String(text == null ? '' : text);
    if (!raw) return null;
    if (/^[0-9]+$/.test(raw) && raw.length % 2 === 0) {
        const digits = [CODE128_START_C];
        for (let i = 0; i < raw.length; i += 2) digits.push(parseInt(raw.substr(i, 2), 10));
        return digits;
    }
    const chars = [CODE128_START_B];
    for (let i = 0; i < raw.length; i++) {
        const c = raw.charCodeAt(i);
        if (c < 32 || c > 126) return null;
        chars.push(c - 32);
    }
    return chars;
}

export function code128Bars(text) {
    const values = code128Values(text);
    if (!values) return null;
    let sum = values[0];
    for (let i = 1; i < values.length; i++) sum += values[i] * i;
    const seq = values.concat([sum % 103, CODE128_STOP]);
    let widths = '';
    for (let i = 0; i < seq.length; i++) widths += CODE128_PATTERNS[seq[i]];
    const bars = [];
    let x = CODE128_QUIET;
    let isBar = true;
    for (let i = 0; i < widths.length; i++) {
        const w = parseInt(widths.charAt(i), 10);
        if (isBar) bars.push([x, w]);
        x += w;
        isBar = !isBar;
    }
    return { bars: bars, width: x + CODE128_QUIET };
}

export function ztoSyncModalIsOpen() {
    return modalIsOpen('ztoSyncModal');
}

export function renderZtoSyncModalList(dataToScan = dataState.scanHistory, trashToScan = dataState.deletedItems) {
    const entries = ztoStatusFeatureConfig()
        ? ztoStatusPendingList(dataToScan, trashToScan) : [];
    const waiting = ztoStatusUnmeasuredCount(dataToScan, trashToScan);
    const stale = anyDbListenerViewIsStale(ZTO_SYNC_VIEW_KEYS);
    const signature = waiting + '|' + (stale ? '1' : '0') + '|'
        + entries.map((entry) => entry.code + '~' + entry.phone + '~' + entry.locker).join(',');
    if (signature === ztoState.ztoStatusModalSig) return;
    ztoState.ztoStatusModalSig = signature;
    {
        const waitingNote = waiting ? ' កំពុងពិនិត្យបន្ត ' + waiting + ' ទៀត។' : '';
        viewState.ztoSyncModalNote = entries.length
            ? 'ស្កេនលេខខាងក្រោមចូល ZTO Palm ដើម្បីបិទ។' + waitingNote
                + (stale ? ' ' + VIEW_NOT_MEASURABLE_NOTICE : '')
            : emptyViewMessage(ZTO_SYNC_VIEW_KEYS, 'កញ្ចប់ដែលពិនិត្យរួច ត្រូវគ្នានឹង ZTO ទាំងអស់។') + waitingNote;
    }
    ztoState.ztoSyncListView = entries.length
        ? { empty: null, entries: entries }
        : { empty: emptyViewMessage(ZTO_SYNC_VIEW_KEYS, '✅ គ្មានកញ្ចប់ណាដែល ZTO មិនទាន់បិទទេ'), entries: [] };
    ztoState.touch();
}

export function renderZtoSyncViews(dataToScan = dataState.scanHistory, trashToScan = dataState.deletedItems) {
    renderZtoSyncBanner(dataToScan, trashToScan);
    if (ztoSyncModalIsOpen()) renderZtoSyncModalList(dataToScan, trashToScan);
}

export function openZtoSyncModal(dataToScan = dataState.scanHistory, trashToScan = dataState.deletedItems) {
    if (!ztoStatusFeatureConfig()) return;
    ztoState.ztoStatusModalSig = '';
    renderZtoSyncModalList(dataToScan, trashToScan);
    openModalHelper('ztoSyncModal');
}

export function closeZtoSyncModal() {
    closeModal('ztoSyncModal');
}

export function ztoStatusSecretIsLocked(cfg) {
    return !!(cfg && lookupApiSendsHeader(cfg) && cfg.headerValueEnc && !securityState.lookupSecretKey);
}

export function ztoStatusNetworkAllowed(userAsked) {
    if ((navigator.onLine as boolean) === false) return false;
    if (!userAsked && linkIsFrugal()) return false;
    if (!userAsked && uiState.isModalOpen) return false;
    return autoLookupInFlight.size === 0;
}

export function ztoStatusSweepGapMs() {
    const idx = Math.min(ztoState.ztoStatusFailStreak, ZTO_STATUS_FAIL_BACKOFF_MS.length - 1);
    const step = ZTO_STATUS_FAIL_BACKOFF_MS[idx];
    return step > ZTO_STATUS_SWEEP_GAP_MS ? step : ZTO_STATUS_SWEEP_GAP_MS;
}

export function ztoStatusBlockIsTransient() {
    if ((navigator.onLine as boolean) === false) return false;
    if (linkIsFrugal()) return false;
    if (uiState.isModalOpen) return false;
    return true;
}

export function resumeZtoStatusSweep() {
    if (!ztoState.ztoStatusSweepTimer) return;
    clearTimeout(ztoState.ztoStatusSweepTimer);
    ztoState.ztoStatusSweepTimer = null;
    scheduleZtoStatusSweep(ZTO_STATUS_SWEEP_DELAY_MS);
}

export function scheduleZtoStatusSweep(delayMs?) {
    if (ztoState.ztoStatusSweepTimer || ztoState.ztoStatusInFlight) return;
    if (!delayMs && ztoState.ztoStatusLastSweepAt
        && elapsedSince(ztoState.ztoStatusLastSweepAt) < ztoStatusSweepGapMs()) return;
    if (!ztoStatusFeatureConfig()) return;
    ztoState.ztoStatusSweepTimer = setTimeout(() => {
        ztoState.ztoStatusSweepTimer = null;
        runZtoStatusSweep(false);
    }, delayMs || ZTO_STATUS_SWEEP_DELAY_MS);
}

export async function checkZtoStatusForBarcode(cfg, code) {
    const session = captureZtoSession();
    const targetUrl = cfg.url.replace('{barcode}', encodeURIComponent(code));
    const headers = await buildLookupRequestHeaders(cfg);
    if (!session.current()) return null;
    const out = await fetchWithTimeout(targetUrl, { headers }, ZTO_AUTO_LOOKUP_TIMEOUT_MS,
        'ZTO status timed out', (r) => r.json().catch(() => null));
    if (!out.res.ok) return null;
    const data = out.body;
    if (!data || typeof data !== 'object') return null;
    return { closed: typeof data.ztoClosed === 'boolean' ? data.ztoClosed : null };
}

export async function runZtoStatusSweep(force, dataToScan = dataState.scanHistory, trashToScan = dataState.deletedItems) {
    const session = captureZtoSession();
    const cfg = ztoStatusFeatureConfig();
    if (!cfg) return 0;
    if (ztoStatusSecretIsLocked(cfg)) return 0;
    if (ztoState.ztoStatusInFlight) return 0;
    if (!ztoStatusNetworkAllowed(force)) {
        if (ztoStatusBlockIsTransient()) scheduleZtoStatusSweep(ztoStatusSweepGapMs());
        return 0;
    }
    if (!force && elapsedSince(ztoState.ztoStatusLastSweepAt) < ztoStatusSweepGapMs()) return 0;
    loadZtoPickupStatusOnce();
    ztoState.ztoStatusLastSweepAt = Date.now();
    const closedWork = collectClosedBarcodesForZtoStatus(dataToScan, trashToScan)
        .filter((entry) => {
            const verdict = ztoPickupStatus.get(entry.key);
            if (!verdict) return true;
            if (verdict.closed === true) return false;
            return force;
        });
    const openWork = ztoAutoCloseEnabled()
        ? collectOpenBarcodesForZtoStatus(dataToScan)
            .filter((entry) => force || ztoOpenRecheckIsDue(ztoPickupStatus.get(entry.key)))
        : [];
    const queue = closedWork.concat(openWork);
    const work = rotateZtoSweepQueue(queue, ztoState.ztoStatusSweepCursor).slice(0, ZTO_STATUS_SWEEP_BATCH);
    const signedEntries = ztoAutoCloseEnabled() && ztoSignedSweepIsDue(force)
        ? collectOpenBarcodesForZtoStatus(dataToScan) : [];
    if (!work.length && !signedEntries.length) return 0;
    ztoState.ztoStatusInFlight = true;
    let measured = 0;
    let autoClosed = 0;
    let recorded = 0;
    let attempted = 0;
    let signedMore = false;
    let signedKeys = new Set();
    try {
        if (signedEntries.length) {
            const signed = await closeZtoSignedBarcodes(cfg, signedEntries, dataToScan, force);
            if (!session.current()) return 0;
            autoClosed += signed.closed;
            measured += signed.closed;
            signedMore = signed.more;
            signedKeys = signed.keys;
            if (signed.closed) renderZtoSyncViews(dataToScan, trashToScan);
        }
        for (let i = 0; i < work.length; i++) {
            if (work[i].open && signedKeys.has(work[i].key)) continue;
            if (!session.current() || !ztoStatusNetworkAllowed(force)) break;
            let answer = null;
            attempted++;
            try {
                answer = await checkZtoStatusForBarcode(cfg, work[i].code);
            } catch (e) {
                answer = null;
            }
            if (!session.current()) return 0;
            if (!answer) continue;
            recorded++;
            setZtoPickupVerdict(work[i].code, answer.closed);
            if (typeof answer.closed === 'boolean') {
                measured++;
                if (work[i].open && answer.closed === true) {
                    if (await autoCloseBarcodeFromZto(work[i], dataToScan)) autoClosed++;
                    if (!session.current()) return 0;
                }
                renderZtoSyncViews(dataToScan, trashToScan);
            }
        }
    } finally {
        if (session.ownsLock()) ztoState.ztoStatusInFlight = false;
        if (session.current()) ztoState.ztoStatusSweepCursor += attempted || work.length;
    }
    if (!session.current()) return 0;
    if (autoClosed > 0) {
        showToast('✅ ZTO បិទរួច ➜ បិទ ' + autoClosed + ' កញ្ចប់ក្នុង ZoeW ដោយស្វ័យប្រវត្តិ');
    }
    if (recorded > 0) ztoState.ztoStatusFailStreak = 0;
    else if (attempted > 0) ztoState.ztoStatusFailStreak++;
    renderZtoSyncViews(dataToScan, trashToScan);
    if ((recorded > 0 && work.length === ZTO_STATUS_SWEEP_BATCH) || signedMore) {
        scheduleZtoStatusSweep(ztoStatusSweepGapMs() + 500);
    }
    return measured;
}

export async function recheckZtoPickupStatus() {
    const session = captureZtoSession();
    const cfg = ztoStatusFeatureConfig();
    if (!cfg) return;
    if (ztoStatusSecretIsLocked(cfg)) {
        showToast('🔒 សូមវាយ PIN ម្តងជាមុន ដើម្បីពិនិត្យស្ថានភាពនៅ ZTO');
        if (!isPinFlowPending()) requestPinBeforeConfig(recheckZtoPickupStatus, 'ztoStatus');
        return;
    }
    if ((navigator.onLine as boolean) === false) {
        showToast('⚠️ ក្រៅបណ្ដាញ — មិនអាចពិនិត្យស្ថានភាពនៅ ZTO បានទេ');
        return;
    }
    if (ztoState.ztoStatusInFlight) {
        showToast('⏳ កំពុងពិនិត្យស្ថានភាពនៅ ZTO រួចហើយ...');
        return;
    }
    showToast('🔄 កំពុងពិនិត្យស្ថានភាពនៅ ZTO...');
    const measured = await runZtoStatusSweep(true);
    if (!session.current()) return;
    if (!measured) {
        showToast('⚠️ ពិនិត្យស្ថានភាពនៅ ZTO មិនបាន — សូមសាកម្ដងទៀត');
        return;
    }
    const left = ztoStatusPendingCodes().length;
    if (ztoSyncModalIsOpen()) renderZtoSyncModalList();
    const leftIsPartial = anyDbListenerViewIsStale(ZTO_SYNC_VIEW_KEYS);
    showToast(left
        ? '🔄 នៅសល់ ' + left + ' កញ្ចប់ដែល ZTO មិនទាន់បិទ'
            + (leftIsPartial ? ' · ' + VIEW_NOT_MEASURABLE_TEXT : '')
        : emptyViewMessage(ZTO_SYNC_VIEW_KEYS, '✅ កញ្ចប់ដែលពិនិត្យរួច ត្រូវគ្នានឹង ZTO ទាំងអស់'));
}
