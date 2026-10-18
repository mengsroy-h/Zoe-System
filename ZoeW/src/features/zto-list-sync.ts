import { viewState } from '../core/view-state';
import { ztoListGroupModel } from '../app/components/zto/model';
import { fieldValue, setFieldValue } from '../app/refs';
import { dataState, ztoState } from '../core/state';
import { getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { ZTO_LISTSYNC_KEY, ZTO_PALM_PAGES_KEY } from '../core/storage-keys';
import { shopScope } from '../core/shop-scope';
import { VIEW_NOT_MEASURABLE_NOTICE, VIEW_NOT_MEASURABLE_TEXT, ZTO_SYNC_VIEW_KEYS, normalizeStoredPhone, ztoExpectedTexts, ztoMismatchTexts, ztoTextWithCodePoints } from '../core/text';
import { getZoneDateKey, ztoScanStampMillis } from '../core/timezone';
import { barcodeAbandonIsRipe } from '../domain/barcode';
import { trashRetentionMs } from '../domain/cleanup';
import { pickupBarcodeKey } from '../domain/pickup';
import { claimBarcodeInRegistry, isBarcodeAlreadyUsed, releaseBarcodesInRegistry, releaseLateBarcodeClaim } from '../domain/registry';
import { ZTO_AUTO_LOOKUP_TIMEOUT_MS } from './auto-lookup';
import { applyBarcodeCloseChange } from './barcode-ops';
import { isPinFlowPending } from './config';
import { lookupApiIsPalm, safeLookupReason } from './customer-table-prefetch';
import { buildLookupRequestHeaders, ztoIdToken } from './lookup-api';
import { ztoIdentityTargetTrusted } from '../platform/native';
import { requestPinBeforeConfig } from './pin';
import { addOrUpdateEntry, dropOptimisticBarcode } from './scan-action';
import { autoCloseBarcodeFromZto, captureZtoSession, checkZtoStatusForBarcode, collectOpenBarcodesForZtoStatus, setZtoPickupVerdict, ztoAutoCloseEnabled, ztoFastModeIsOn, ztoStatusFeatureConfig, ztoStatusSecretIsLocked } from './zto-status';
import { removeReturnedZtoBarcodes, ztoReturnedTargets } from './zto-returned';
import { anyDbListenerViewIsStale } from '../services/db-listeners';
import { armLateWrite, fetchWithTimeout, withTimeout } from '../services/network';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { drawerAction } from '../ui/page-nav';
import { showToast } from '../ui/toast';
import { saveBarcodeOrigins } from './barcode-origin';
import { notePalmSiteName, noteZtoPalmSessionRejected, palmRefreshAvailable, palmSessionLostText, refreshZtoPalmSession } from './zto-palm-login';

export const ZTO_FAST_MODE_HINT = 'ℹ️ សូមគូស «Fast Mode សម្រាប់ ZTO Lookup» ក្នុង API ស្វែងរកជាមុនសិន';

export const ZTO_LIST_DEFAULT_DAYS = 4;

export const ZTO_LIST_CLIENT_MAX_PAGES = 3;

export const ZTO_PALM_LIST_MAX_PAGES = 1000;
export const ZTO_PALM_LIST_TABS = ['1', '4', '4d', '5'];
export const ZTO_PALM_LIST_CONCURRENCY = 8;
export const ZTO_PALM_LIST_PAGE_TRIES_MAX = 3;
export const ZTO_PALM_TRACK_BATCH = 30;
export const ZTO_PALM_TRACK_PASSES_MAX = 3;
export const ZTO_PALM_LIST_RETRY_MS = 1000;
export const ZTO_PALM_UNVERIFIED_SHOWN = 5;

export const ZTO_LIST_PREVIEW_ROWS = 12;

export const ZTO_LIST_IMPORT_MAX = 100;
export const ZTO_LIST_SERVER_CONFIG_REASONS = ['idtoken:aud', 'idtoken:iss', 'idtoken:project-unset'];

export const ZTO_LIST_IDENTITY_CODES = ['ZTO_IDENTITY_REQUIRED', 'ZTO_IDENTITY_UNAVAILABLE'];

export const ZTO_LIST_IDENTITY_SERVER_REASONS = ['idtoken:project-unset', 'idtoken:supabase-unset'];

export const ZTO_LIST_SIGNED_PROBE_MAX = 20;

export const ZTO_LIST_RANGE_MAX_DAYS = 31;

export const ZTO_SIGNED_DAY_CONCURRENCY = 3;
export const ZTO_SIGNED_SPLIT_MEMO_MS = 30 * 60 * 1000;

export const ZTO_LIST_PROBE_CONCURRENCY = 4;
export const ZTO_LIST_IMPORT_CONCURRENCY = 4;

export const ZTO_LIST_SKIP_TEXT = {
    'scan-type': 'មិនមែនស្កេន «មកដល់»',
    'too-old-open': 'ចាស់ជាងច្បាប់សម្អាត ហើយ ZTO មិនទាន់បិទបញ្ជី ➜ មិនបញ្ចូល (បញ្ចូល ➜ ចូលធុងសំរាមភ្លាម ➜ ដកលុយ)',
    'too-old-unknown': 'ចាស់ជាងច្បាប់សម្អាត ហើយវាស់ស្ថានភាព ZTO មិនបាន ➜ មិនបញ្ចូល (សូមសាកទាញម្តងទៀត)',
    'too-old-purged': 'ចាស់ជាងអាយុធុងសំរាម ➜ ពិនិត្យស្ទួនមិនបាន ➜ មិនបញ្ចូល (ការបញ្ចូល = ហានិភ័យលុយបូកស្ទួន)'
};

export const ztoListSignedProbe = new Map();

export const ztoListSignedEvidence = new Set();

export function ztoListReasonIsDefinitive(reason) {
    const text = String(reason === undefined || reason === null ? '' : reason);
    if (!text) return false;
    if (text.indexOf('idtoken:') !== 0) return true;
    return text === 'idtoken:supabase-unset' || ZTO_LIST_SERVER_CONFIG_REASONS.indexOf(text) !== -1;
}

export function ztoListSkipText(reason) {
    const key = String(reason === undefined || reason === null ? '' : reason);
    return Object.prototype.hasOwnProperty.call(ZTO_LIST_SKIP_TEXT, key) ? ZTO_LIST_SKIP_TEXT[key] : '';
}

export function ztoListSyncEnabled() {
    return ztoFastModeIsOn()
        && safeStoreGet(appLocalStore, ZTO_LISTSYNC_KEY) === '1';
}

export function refreshZtoListSyncUi() {
    const on = ztoListSyncEnabled();
    viewState.ztoListSyncText = on ? 'បើក' : 'បិទ';
    viewState.ztoListSyncOn = on;
    viewState.ztoListSyncDrawerVisible = ztoFastModeIsOn();
    viewState.ztoListSyncBtnVisible = !!(on && ztoStatusFeatureConfig());
}

export function drawerZtoListSyncFlow() {
    drawerAction(function () {
        if (!ztoFastModeIsOn()) {
            showToast(ZTO_FAST_MODE_HINT);
            return;
        }
        if (!ztoListSyncEnabled()) {
            safeStoreSet(appLocalStore, ZTO_LISTSYNC_KEY, '1');
            refreshZtoListSyncUi();
            showToast('✅ បើកការទាញបញ្ជីពី ZTO — សាខាមកពីគណនីដែលចូលប្រព័ន្ធ');
            return;
        }
        safeStoreSet(appLocalStore, ZTO_LISTSYNC_KEY, '0');
        refreshZtoListSyncUi();
        showToast('ℹ️ បិទរួច ៖ ប៊ូតុងបញ្ជី ZTO ត្រូវលាក់វិញ');
    });
}

export function ztoPickupVerdictOf(signed, detail, row) {
    if (signed === true) return true;
    if (typeof detail === 'boolean') return detail;
    if (typeof row === 'boolean') return row;
    return null;
}

export function ztoListSignedVerdict(raw, key) {
    return ztoPickupVerdictOf(!!key && ztoListSignedEvidence.has(key),
        key && ztoListSignedProbe.has(key) ? ztoListSignedProbe.get(key) : null,
        raw ? raw.ztoClosed : null);
}

export function noteZtoListSignedCodes(codes) {
    if (!Array.isArray(codes)) return 0;
    let added = 0;
    for (let i = 0; i < codes.length; i++) {
        const key = pickupBarcodeKey(codes[i]);
        if (!key || ztoListSignedEvidence.has(key)) continue;
        ztoListSignedEvidence.add(key);
        added++;
    }
    return added;
}

export function ztoListRowAgeState(stampMs, now) {
    if (!stampMs || !barcodeAbandonIsRipe({ isClosed: false }, stampMs, now)) return 'fresh';
    return now - stampMs > trashRetentionMs({ trashReason: 'pickup' }) ? 'purged' : 'old';
}

export function ztoListRowNeedsSignedProbe(raw, now) {
    if (!raw || raw.skip) return false;
    const key = pickupBarcodeKey(raw.barcode);
    if (!key || ztoListSignedVerdict(raw, key) !== null) return false;
    if (!normalizeStoredPhone(raw.phone)) return false;
    return ztoListRowAgeState(ztoScanStampMillis(raw.at), now) === 'old';
}

export async function resolveZtoListSignedVerdicts(cfg, rows) {
    const session = captureZtoSession();
    if (!cfg || !Array.isArray(rows)) return 0;
    const now = getServerNow();
    const seen = new Set();
    const pending = [];
    for (let i = 0; i < rows.length; i++) {
        if (!ztoListRowNeedsSignedProbe(rows[i], now)) continue;
        const key = pickupBarcodeKey(rows[i].barcode);
        if (seen.has(key)) continue;
        seen.add(key);
        pending.push({ key: key, code: String(rows[i].barcode) });
        if (pending.length >= ZTO_LIST_SIGNED_PROBE_MAX) break;
    }
    let measured = 0;
    let next = 0;
    let done = 0;
    let lost = false;
    const worker = async () => {
        while (next < pending.length) {
            if (!session.current() || (navigator.onLine as boolean) === false) return;
            const job = pending[next];
            next++;
            let verdict = null;
            try {
                const out = await checkZtoStatusForBarcode(cfg, job.code);
                verdict = out && typeof out.closed === 'boolean' ? out.closed : null;
            } catch (e) {
                verdict = null;
            }
            if (!session.current()) { lost = true; return; }
            done++;
            setZtoListSyncNote('⏳ កំពុងពិនិត្យស្ថានភាព ZTO ' + done + '/' + pending.length + '...');
            if (typeof verdict === 'boolean') {
                ztoListSignedProbe.set(job.key, verdict);
                measured++;
            }
        }
    };
    const workers = [];
    for (let w = 0; w < ZTO_LIST_PROBE_CONCURRENCY && w < pending.length; w++) workers.push(worker());
    await Promise.all(workers);
    return lost ? 0 : measured;
}

export function ztoListRowOf(raw, key) {
    const cod = Number(raw.cod);
    const dod = Number(raw.dod);
    const at = String(raw.at === undefined || raw.at === null ? '' : raw.at);
    return {
        barcode: String(raw.barcode === undefined || raw.barcode === null ? '' : raw.barcode),
        phone: normalizeStoredPhone(raw.phone),
        cod: isFinite(cod) ? cod : 0,
        dod: isFinite(dod) ? dod : 0,
        at: at,
        stampMs: ztoScanStampMillis(at),
        ztoClosed: ztoListSignedVerdict(raw, key),
        closedAtZto: false,
        skip: String(raw.skip === undefined || raw.skip === null ? '' : raw.skip),
        from: typeof raw.from === 'string' ? raw.from.slice(0, 64) : '',
        key: key,
        signedAt: '',
        signedOnly: false,
        arrivedBefore: '',
        returnedAt: '',
        misplaced: false,
        inZoew: false,
        openInZoew: false,
        removeInZoew: false,
        removeHeld: ''
    };
}

export function ztoListSignedRowIndex(signedRows) {
    const index = new Map();
    if (!Array.isArray(signedRows)) return index;
    for (let i = 0; i < signedRows.length; i++) {
        const raw = signedRows[i];
        if (!raw || typeof raw !== 'object' || typeof raw.at !== 'string') continue;
        const key = pickupBarcodeKey(raw.barcode);
        if (!key) continue;
        const prior = index.get(key);
        if (!prior || raw.at > prior.at) index.set(key, raw);
    }
    return index;
}

export function classifyZtoListRows(rows, historyList, trashList, signedRows?, range?, pickupData?) {
    const out = { fresh: [], existing: [], duplicate: [], skipped: [], returned: [] };
    const list = Array.isArray(rows) ? rows : [];
    const known = new Set();
    const addKnown = (items) => {
        if (!Array.isArray(items)) return;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item) continue;
            const codes = Array.isArray(item.barcodes) ? item.barcodes : null;
            if (codes) {
                for (let j = 0; j < codes.length; j++) {
                    const key = pickupBarcodeKey(codes[j] && codes[j].code);
                    if (key) known.add(key);
                }
            }
            const single = item.barcode ? pickupBarcodeKey(item.barcode) : '';
            if (single) known.add(single);
        }
    };
    addKnown(historyList);
    addKnown(trashList);

    const best = new Map();
    const order = [];
    const signedIndex = ztoListSignedRowIndex(signedRows);
    const arrivalKeys = new Set();
    for (let i = 0; i < list.length; i++) {
        const raw = list[i] || {};
        const key = pickupBarcodeKey(raw.barcode);
        if (key) arrivalKeys.add(key);
        const row = ztoListRowOf(raw, key);
        if (key && signedIndex.has(key)) row.signedAt = signedIndex.get(key).at;
        if (!key || !row.phone || row.skip) {
            out.skipped.push(row);
            continue;
        }
        const ageState = ztoListRowAgeState(row.stampMs, getServerNow());
        if (ageState === 'purged') {
            row.skip = 'too-old-purged';
            out.skipped.push(row);
            continue;
        }
        if (ageState === 'old' && row.ztoClosed !== true) {
            row.skip = row.ztoClosed === false ? 'too-old-open' : 'too-old-unknown';
            out.skipped.push(row);
            continue;
        }
        row.closedAtZto = row.ztoClosed === true;
        const prior = best.get(key);
        if (!prior) {
            best.set(key, row);
            order.push(key);
            continue;
        }
        if (row.at >= prior.at) {
            out.duplicate.push(prior);
            best.set(key, row);
        } else {
            out.duplicate.push(row);
        }
    }
    const returnedIndex = ztoListSignedRowIndex(range && range.returned);
    for (let i = 0; i < order.length; i++) {
        const row = best.get(order[i]);
        const back = returnedIndex.get(row.key);
        if (back && row.ztoClosed !== true && back.at >= row.at) {
            row.returnedAt = back.at;
            row.misplaced = back.misplaced === true;
            row.inZoew = known.has(row.key);
            out.returned.push(row);
        } else if (known.has(row.key)) out.existing.push(row);
        else out.fresh.push(row);
    }
    if (!range || typeof range.from !== 'string' || typeof range.to !== 'string') return out;
    const pickedUpBefore = new Set();
    if (pickupData && typeof pickupData === 'object') {
        Object.keys(pickupData).forEach((day) => {
            const marks = pickupData[day] && pickupData[day].pickedUpBarcodes;
            if (marks && typeof marks === 'object') Object.keys(marks).forEach((mark) => pickedUpBefore.add(mark));
        });
    }
    signedIndex.forEach((raw, key) => {
        if (arrivalKeys.has(key)) return;
        const row = ztoListRowOf(raw, key);
        const day = row.at.slice(0, 10);
        if (!row.stampMs || day < range.from || day > range.to) return;
        row.ztoClosed = true;
        row.signedOnly = true;
        row.signedAt = row.at;
        row.arrivedBefore = range.from;
        if (!row.phone) {
            out.skipped.push(row);
            return;
        }
        if (ztoListRowAgeState(row.stampMs, getServerNow()) === 'purged' || (!known.has(key) && pickedUpBefore.has(key))) {
            row.skip = 'too-old-purged';
            out.skipped.push(row);
            return;
        }
        row.closedAtZto = true;
        if (known.has(key)) out.existing.push(row);
        else out.fresh.push(row);
    });
    return out;
}

export function buildZtoListApiUrl(cfg, from, to, page, mode?, palm?) {
    if (!cfg || !cfg.url) return '';
    const raw = String(cfg.url).trim();
    const marker = '/.netlify/functions/zto-order-detail';
    const markerAt = raw.toLowerCase().indexOf(marker);
    const base = markerAt === -1 ? raw.split('?')[0] : raw.slice(0, markerAt) + marker;
    const extra = mode === 'signed' ? '&signed=1' : (mode === 'signedExact' ? '&signed=1&exact=1'
        : (mode === 'withSigned' ? '&withSigned=1' : (mode === 'returned' ? '&returned=1' : '')));
    const isPalm = lookupApiIsPalm(cfg);
    let palmExtra = '';
    if (isPalm && palm && palm.candidates === true) palmExtra += '&candidates=1';
    if (isPalm && palm && Array.isArray(palm.tabs) && palm.tabs.length) palmExtra += '&tabs=' + encodeURIComponent(palm.tabs.join(','));
    if (isPalm && palm && Array.isArray(palm.tracks) && palm.tracks.length) palmExtra += '&tracks=' + encodeURIComponent(palm.tracks.join(','));
    return base + (isPalm ? '?palm=1&list=1' : '?list=1')
        + '&from=' + encodeURIComponent(from)
        + '&to=' + encodeURIComponent(to) + '&page=' + encodeURIComponent(String(page)) + extra + palmExtra;
}

export async function fetchZtoListPage(cfg, from, to, page, mode?, palm?) {
    const session = captureZtoSession();
    const url = buildZtoListApiUrl(cfg, from, to, page, mode, palm);
    if (!url) return null;
    if (!ztoIdentityTargetTrusted(url)) {
        const untrusted: any = new Error('ZTO_LIST_NOT_CONFIGURED');
        untrusted.listReason = 'host:untrusted';
        untrusted.notConfigured = true;
        throw untrusted;
    }
    const headers = await buildLookupRequestHeaders(cfg);
    if (!session.current()) return null;
    const idToken = await ztoIdToken();
    if (!session.current()) return null;
    if (!idToken) {
        const missing: any = new Error('ZTO_LIST_NOT_CONFIGURED');
        missing.listReason = 'idtoken:missing';
        missing.notConfigured = true;
        throw missing;
    }
    headers['X-Zoe-Id-Token'] = idToken;
    const out = await fetchWithTimeout(url, { headers: headers, cache: 'no-store' },
        ZTO_AUTO_LOOKUP_TIMEOUT_MS, 'ZTO list timed out', (r) => r.json().catch(() => null));
    const body = out.body;
    if (!body || typeof body !== 'object') {
        throw new Error('ZTO_LIST_INVALID');
    }
    if (body.enabled === false) {
        const err: any = new Error('ZTO_LIST_NOT_CONFIGURED');
        err.listReason = safeLookupReason(body.reason);
        err.notConfigured = true;
        throw err;
    }
    const identityRefusal = ZTO_LIST_IDENTITY_CODES.indexOf(body.code) !== -1
        || (body.code === 'ZTO_CONFIG_INVALID' && ZTO_LIST_IDENTITY_SERVER_REASONS.indexOf(body.reason) !== -1);
    if (!out.res.ok && identityRefusal) {
        const refused: any = new Error('ZTO_LIST_NOT_CONFIGURED');
        refused.listReason = safeLookupReason(body.reason) || 'idtoken:invalid';
        refused.notConfigured = true;
        refused.transient = body.code === 'ZTO_IDENTITY_UNAVAILABLE';
        refused.httpStatus = out.res.status;
        throw refused;
    }
    if (!out.res.ok || !Array.isArray(body.rows)) {
        if (out.res.status === 401 && lookupApiIsPalm(cfg) && session.current()) noteZtoPalmSessionRejected(cfg);
        const err: any = new Error('ZTO_LIST_FAILED');
        err.httpStatus = out.res.status;
        err.upstreamReason = safeLookupReason(body.reason) || safeLookupReason(body.code);
        err.barcode = typeof body.barcode === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(body.barcode) ? body.barcode : '';
        throw err;
    }
    return body;
}

export function ztoListSiteText(siteName, site) {
    const name = String(siteName === undefined || siteName === null ? '' : siteName).trim();
    const code = String(site === undefined || site === null ? '' : site).trim();
    if (name && code) return name + ' · ' + code;
    return name || code;
}

export function ztoListPositiveCount(value) {
    const n = Number(value);
    return isFinite(n) && n > 0 ? n : 0;
}

export function absorbZtoListSigned(out, body) {
    if (!out.site && body.site) out.site = String(body.site);
    if (!out.siteName && body.siteName) out.siteName = String(body.siteName);
    if (Array.isArray(body.signed)) {
        for (let i = 0; i < body.signed.length; i++) out.signed.push(body.signed[i]);
    }
    if (Array.isArray(body.signedRows)) {
        for (let i = 0; i < body.signedRows.length; i++) {
            const row = body.signedRows[i];
            if (row && typeof row === 'object' && !Array.isArray(row)) out.signedRows.push(row);
        }
    }
}

export async function fetchZtoReturnedPages(cfg, from, to) {
    const out = { returned: [], state: 'failed' };
    const absorb = (body) => {
        const list = Array.isArray(body.returned) ? body.returned : [];
        for (let i = 0; i < list.length; i++) {
            const row = list[i];
            if (row && typeof row.barcode === 'string' && typeof row.at === 'string') out.returned.push({ barcode: row.barcode, at: row.at });
        }
    };
    let first = null;
    try {
        first = await fetchZtoListPage(cfg, from, to, 1, 'returned');
    } catch (_) {
        return out;
    }
    if (!first) return out;
    if (first.returned === null) {
        out.state = 'off';
        return out;
    }
    if (first.returnedOk !== true) return out;
    absorb(first);
    let pages = Number(first.pages);
    if (!isFinite(pages) || pages < 1) pages = 1;
    let open = first.pagesUnknown === true;
    let read = 1;
    for (;;) {
        const last = Math.min(pages, ZTO_LIST_CLIENT_MAX_PAGES);
        if (last <= read) break;
        const work = [];
        for (let page = read + 1; page <= last; page++) work.push(fetchZtoListPage(cfg, from, to, page, 'returned').catch(() => null));
        const more = await Promise.all(work);
        for (let i = 0; i < more.length; i++) {
            if (!more[i] || more[i].returnedOk !== true) {
                out.state = 'partial';
                return out;
            }
            absorb(more[i]);
        }
        read = last;
        if (!open) break;
        const tail = more[more.length - 1];
        const tailPages = Number(tail.pages);
        if (isFinite(tailPages) && tailPages > 0) pages = tailPages;
        open = tail.pagesUnknown === true;
        if (!open && pages <= read) break;
    }
    out.state = pages > ZTO_LIST_CLIENT_MAX_PAGES ? 'partial' : 'ok';
    return out;
}

export async function fetchZtoListAllPages(cfg, from, to) {
    if (lookupApiIsPalm(cfg)) return fetchZtoPalmListAllPages(cfg, from, to);
    const out = { rows: [], signed: [], signedRows: [], pages: 0, total: 0, pageLimit: ZTO_LIST_CLIENT_MAX_PAGES, site: '', siteName: '', otherScans: 0, signedMismatch: 0,
        signedMismatchTexts: [], signedDescExpected: [], signedState: 'none', returned: [], returnedState: 'failed' };
    const returnedRun = fetchZtoReturnedPages(cfg, from, to);
    let arrivalTotals = 0;
    const absorb = (body, arrival) => {
        if (!body) return;
        out.signedMismatch += ztoListPositiveCount(body.signedMismatch) + ztoListPositiveCount(body.signedListMismatch);
        ztoMismatchTexts(body.signedMismatchTexts, out.signedMismatchTexts);
        ztoMismatchTexts(body.signedListMismatchTexts, out.signedMismatchTexts);
        if (!out.signedDescExpected.length) out.signedDescExpected = ztoExpectedTexts(body.signedDescExpected);
        if (arrival) {
            for (let i = 0; i < body.rows.length; i++) out.rows.push(body.rows[i]);
            const reportedTotal = Number(body.total);
            if (isFinite(reportedTotal) && reportedTotal > out.total) out.total = reportedTotal;
            if (isFinite(reportedTotal) && reportedTotal > 0) arrivalTotals += reportedTotal;
            const other = Number(body.otherScans);
            if (isFinite(other) && other > 0) out.otherScans += other;
        }
        absorbZtoListSigned(out, body);
    };
    const first = await fetchZtoListPage(cfg, from, to, 1, 'withSigned');
    if (!first) return out;
    absorb(first, true);
    const settleReturned = async () => {
        const back = await returnedRun;
        out.returned = back.returned;
        out.returnedState = back.state;
    };
    const reported = Number(first.pages);
    out.pages = isFinite(reported) && reported > 0 ? reported : 1;
    const metaless = first.pagesUnknown === true;
    let arrivalOpen = metaless;
    let signedPages = Number(first.signedPages);
    if (first.signedOk !== true || !isFinite(signedPages)) signedPages = 0;
    let signedOpen = first.signedOk === true && first.signedPagesUnknown === true;
    let readArrival = 1;
    let readSigned = first.signedOk === true ? 1 : 0;
    let signedFailed = false;
    for (;;) {
        const last = Math.min(out.pages, ZTO_LIST_CLIENT_MAX_PAGES);
        const signedLast = signedFailed ? readSigned : Math.min(signedPages, ZTO_LIST_CLIENT_MAX_PAGES);
        if (last <= readArrival && signedLast <= readSigned) break;
        const signedFrom = Math.max(last, readSigned) + 1;
        const arrivalWork = [];
        for (let page = readArrival + 1; page <= last; page++) {
            arrivalWork.push(fetchZtoListPage(cfg, from, to, page, page > readSigned && page <= signedLast ? 'withSigned' : undefined));
        }
        const signedWork = [];
        for (let page = signedFrom; page <= signedLast; page++) {
            signedWork.push(fetchZtoListPage(cfg, from, to, page, 'signed').catch(() => null));
        }
        const signedSettled = Promise.all(signedWork);
        const more = await Promise.all(arrivalWork);
        const extraSigned = await signedSettled;
        let signedTail = null;
        for (let i = 0; i < more.length; i++) absorb(more[i], true);
        for (let i = 0; i < more.length; i++) {
            const page = readArrival + 1 + i;
            if (!more[i] || page <= readSigned || page > signedLast) continue;
            if (more[i].signedOk !== true) signedFailed = true;
            else if (page === signedLast) signedTail = { pages: more[i].signedPages, unknown: more[i].signedPagesUnknown === true };
        }
        for (let i = 0; i < extraSigned.length; i++) {
            if (!extraSigned[i] || extraSigned[i].signedOk !== true) signedFailed = true;
            else if (signedFrom + i === signedLast) signedTail = { pages: extraSigned[i].pages, unknown: extraSigned[i].pagesUnknown === true };
            absorb(extraSigned[i], false);
        }
        if (arrivalOpen) {
            const tail = more.length ? more[more.length - 1] : null;
            const tailPages = tail ? Number(tail.pages) : NaN;
            if (tail && isFinite(tailPages) && tailPages > 0) out.pages = tailPages;
            arrivalOpen = !!tail && tail.pagesUnknown === true;
        }
        if (signedOpen) {
            const tailPages = signedTail ? Number(signedTail.pages) : NaN;
            if (!signedFailed && isFinite(tailPages)) signedPages = tailPages;
            signedOpen = !signedFailed && !!signedTail && signedTail.unknown;
        }
        readArrival = Math.max(readArrival, last);
        readSigned = Math.max(readSigned, signedLast);
        if (!arrivalOpen && !signedOpen) break;
    }
    if (metaless) out.total = Math.max(out.total, arrivalTotals);
    if (first.signedOk === true) {
        out.signedState = signedFailed ? 'partial'
            : (signedPages > ZTO_LIST_CLIENT_MAX_PAGES ? 'partial' : 'ok');
    } else if (first.signed === null) {
        out.signedState = 'off';
    } else if (first.signedOk === false) {
        out.signedState = 'failed';
    }
    await settleReturned();
    return out;
}

export function ztoPalmPageRetryable(e) {
    if (!e || (e.notConfigured && !e.transient)) return false;
    const status = Number(e.httpStatus);
    if (!status) return true;
    return status === 429 || status >= 500;
}

function ztoPalmWait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchZtoPalmPage(cfg, from, to, page, palm, session) {
    let failure = null;
    for (let attempt = 1; attempt <= ZTO_PALM_LIST_PAGE_TRIES_MAX; attempt++) {
        if (attempt > 1) {
            await ztoPalmWait(ZTO_PALM_LIST_RETRY_MS * (attempt - 1));
            if (!session.current()) return null;
        }
        try {
            return await fetchZtoListPage(cfg, from, to, page, undefined, palm);
        } catch (e) {
            if (!ztoPalmPageRetryable(e) || (navigator.onLine as boolean) === false) throw e;
            failure = e;
        }
    }
    throw failure || new Error('ZTO_LIST_FAILED');
}

function ztoPalmCode(value) {
    const code = typeof value === 'string' ? value.trim() : '';
    return /^[A-Za-z0-9_-]{6,64}$/.test(code) ? code : '';
}

async function ztoPalmEach(items, limit, run) {
    let next = 0;
    let stop = null;
    const worker = async () => {
        while (!stop && next < items.length) {
            const item = items[next];
            next++;
            try {
                await run(item);
            } catch (e) {
                stop = stop || e;
            }
        }
    };
    const workers = [];
    for (let w = 0; w < limit && w < items.length; w++) workers.push(worker());
    await Promise.all(workers);
    if (stop) throw stop;
}

function ztoPalmPagesSite(cfg) {
    const site = cfg && cfg.palmAccount && typeof cfg.palmAccount.siteCode === 'string' ? cfg.palmAccount.siteCode : '';
    return site;
}

export function ztoPalmPageHint(cfg) {
    const out = {};
    try {
        const site = ztoPalmPagesSite(cfg);
        const raw = JSON.parse(safeStoreGet(appLocalStore, ZTO_PALM_PAGES_KEY) || 'null');
        if (!site || !raw || raw.shop !== shopScope() || raw.site !== site || !raw.pages || typeof raw.pages !== 'object') return out;
        for (let i = 0; i < ZTO_PALM_LIST_TABS.length; i++) {
            const pages = Math.floor(Number(raw.pages[ZTO_PALM_LIST_TABS[i]]));
            if (pages >= 2) out[ZTO_PALM_LIST_TABS[i]] = Math.min(pages, ZTO_PALM_LIST_MAX_PAGES);
        }
    } catch (e) {}
    return out;
}

function rememberZtoPalmPages(cfg, tabPages) {
    const site = ztoPalmPagesSite(cfg);
    if (!site) return;
    const pages = {};
    for (let i = 0; i < ZTO_PALM_LIST_TABS.length; i++) {
        const count = Math.floor(Number(tabPages[ZTO_PALM_LIST_TABS[i]]));
        pages[ZTO_PALM_LIST_TABS[i]] = count > 0 ? Math.min(count, ZTO_PALM_LIST_MAX_PAGES) : 0;
    }
    safeStoreSet(appLocalStore, ZTO_PALM_PAGES_KEY, JSON.stringify({ shop: shopScope(), site: site, pages: pages }));
}

export function ztoPalmTrackBatchSize(count, idle) {
    return Math.min(ZTO_PALM_TRACK_BATCH, Math.max(1, Math.ceil(count / Math.max(1, idle))));
}

export async function fetchZtoPalmListAllPages(cfg, from, to) {
    const session = captureZtoSession();
    const startedAt = Date.now();
    const out = { rows: [], signed: [], signedRows: [], pages: 0, total: 0, pageLimit: ZTO_PALM_LIST_MAX_PAGES, site: '', siteName: '', otherScans: 0,
        signedMismatch: 0, signedMismatchTexts: [], signedDescExpected: [], signedState: 'ok', unverified: [], failedPages: [], palm: true,
        candidates: 0, elapsedMs: 0, returned: [], returnedState: 'ok' };
    const tabPages = {};
    const candidates = new Map();
    const evidence = new Map();
    const queue = [];
    const progress = (text) => {
        if (session.current()) setZtoListSyncNote('⏳ កំពុងទាញបញ្ជីពី ZTO Palm ៖ ' + text + '...');
    };
    const absorbCandidates = (body, tabs) => {
        if (!out.site && body.site) out.site = String(body.site);
        if (!out.siteName && body.siteName) out.siteName = String(body.siteName);
        out.otherScans += ztoListPositiveCount(body.otherScans);
        const reported = body.tabPages && typeof body.tabPages === 'object' ? body.tabPages : null;
        for (let i = 0; i < tabs.length; i++) {
            const pages = Number(reported ? reported[tabs[i]] : body.pages);
            if (isFinite(pages) && pages >= 0) tabPages[tabs[i]] = Math.max(Number(tabPages[tabs[i]]) || 0, Math.floor(pages));
        }
        const list = Array.isArray(body.candidates) ? body.candidates : [];
        for (let i = 0; i < list.length; i++) {
            const raw = list[i];
            const code = ztoPalmCode(raw && raw.barcode);
            if (!code || candidates.has(code.toUpperCase())) continue;
            candidates.set(code.toUpperCase(), Object.assign({}, raw, { barcode: code }));
            queue.push(code);
        }
    };
    const lastPage = () => {
        let pages = 0;
        for (let i = 0; i < ZTO_PALM_LIST_TABS.length; i++) pages = Math.max(pages, Number(tabPages[ZTO_PALM_LIST_TABS[i]]) || 0);
        return Math.min(pages, ZTO_PALM_LIST_MAX_PAGES);
    };
    const trackBatch = async (batch) => {
        let body = null;
        try {
            body = await fetchZtoPalmPage(cfg, from, to, 1, { tracks: batch }, session);
        } catch (e) {
            if (!ztoPalmPageRetryable(e)) throw e;
        }
        if (!out.siteName && body && typeof body.siteName === 'string' && body.siteName) out.siteName = body.siteName;
        const list = body && Array.isArray(body.evidence) ? body.evidence : [];
        for (let i = 0; i < list.length; i++) {
            const code = ztoPalmCode(list[i] && list[i].barcode);
            if (code && batch.indexOf(code) !== -1) evidence.set(code.toUpperCase(), list[i]);
        }
    };
    const requested = new Map();
    const pageQueue = [];
    const pageFailures = [];
    const plan = (counts) => {
        let last = 0;
        for (let i = 0; i < ZTO_PALM_LIST_TABS.length; i++) last = Math.max(last, Number(counts[ZTO_PALM_LIST_TABS[i]]) || 0);
        last = Math.min(last, ZTO_PALM_LIST_MAX_PAGES);
        for (let page = 2; page <= last; page++) {
            const have = requested.get(page) || [];
            const tabs = ZTO_PALM_LIST_TABS.filter((tab) => (Number(counts[tab]) || 0) >= page && have.indexOf(tab) === -1);
            if (!tabs.length) continue;
            requested.set(page, have.concat(tabs));
            pageQueue.push({ page: page, tabs: tabs });
        }
    };
    let known = false;
    let pagesInFlight = 0;
    let busy = 0;
    let tracked = 0;
    let stop = null;
    let ended = false;
    let waiters = [];
    const wake = () => {
        const list = waiters;
        waiters = [];
        for (let i = 0; i < list.length; i++) list[i]();
    };
    const morePages = () => !known || pagesInFlight > 0 || pageQueue.length > 0;
    const pipelineNote = () => {
        progress((morePages() ? 'អានបញ្ជីកញ្ចប់ ' + candidates.size + ' · ' : '') + 'ផ្ទៀង track ' + tracked + '/' + candidates.size + ' កញ្ចប់');
    };
    const loadPage = async (entry) => {
        let body = null;
        try {
            body = await fetchZtoPalmPage(cfg, from, to, entry.page, entry.first ? { candidates: true } : { candidates: true, tabs: entry.tabs }, session);
        } catch (e) {
            if (entry.first || !ztoPalmPageRetryable(e)) throw e;
            pageFailures.push(entry);
            return;
        }
        if (!body) {
            if (entry.first) ended = true;
            return;
        }
        absorbCandidates(body, entry.tabs);
        if (entry.first) known = true;
        if (known) plan(tabPages);
    };
    const pipelineWorker = async () => {
        while (!stop && !ended && session.current()) {
            if (pageQueue.length) {
                const entry = pageQueue.shift();
                pagesInFlight++;
                busy++;
                try {
                    await loadPage(entry);
                } catch (e) {
                    stop = stop || e;
                } finally {
                    pagesInFlight--;
                    busy--;
                    wake();
                }
                pipelineNote();
                continue;
            }
            const pending = morePages();
            if (queue.length >= ZTO_PALM_TRACK_BATCH || (queue.length && !pending)) {
                const batch = queue.splice(0, pending ? ZTO_PALM_TRACK_BATCH : ztoPalmTrackBatchSize(queue.length, ZTO_PALM_LIST_CONCURRENCY - busy));
                busy++;
                try {
                    await trackBatch(batch);
                } catch (e) {
                    stop = stop || e;
                } finally {
                    busy--;
                    wake();
                }
                tracked += batch.length;
                pipelineNote();
                continue;
            }
            if (!pending) return;
            await new Promise((resolve) => waiters.push(resolve));
        }
    };
    progress('អានបញ្ជីកញ្ចប់');
    pageQueue.push({ page: 1, tabs: ZTO_PALM_LIST_TABS, first: true });
    plan(ztoPalmPageHint(cfg));
    const workers = [];
    for (let w = 0; w < ZTO_PALM_LIST_CONCURRENCY; w++) workers.push(pipelineWorker());
    await Promise.all(workers);
    if (stop) throw stop;
    if (ended || !session.current()) return out;
    out.pages = lastPage();
    out.candidates = candidates.size;
    for (let i = 0; i < pageFailures.length; i++) {
        const entry = pageFailures[i];
        const missing = entry.tabs.some((tab) => (Number(tabPages[tab]) || 0) >= entry.page);
        if (missing && out.failedPages.indexOf(entry.page) === -1) out.failedPages.push(entry.page);
    }
    let pending = Array.from(candidates.values()).map((c) => c.barcode).filter((code) => !evidence.has(code.toUpperCase()));
    for (let pass = 1; pending.length && pass < ZTO_PALM_TRACK_PASSES_MAX; pass++) {
        await ztoPalmWait(ZTO_PALM_LIST_RETRY_MS);
        if (!session.current()) return out;
        const size = ztoPalmTrackBatchSize(pending.length, ZTO_PALM_LIST_CONCURRENCY);
        const batches = [];
        for (let i = 0; i < pending.length; i += size) batches.push(pending.slice(i, i + size));
        const total = pending.length;
        let done = 0;
        progress('ផ្ទៀង track ម្តងទៀត 0/' + total + ' កញ្ចប់');
        await ztoPalmEach(batches, ZTO_PALM_LIST_CONCURRENCY, async (batch) => {
            if (!session.current()) return;
            await trackBatch(batch);
            done += batch.length;
            progress('ផ្ទៀង track ម្តងទៀត ' + done + '/' + total + ' កញ្ចប់');
        });
        if (!session.current()) return out;
        pending = pending.filter((code) => !evidence.has(code.toUpperCase()));
    }
    candidates.forEach((candidate, key) => {
        const found = evidence.get(key);
        if (!found) return;
        const from = typeof candidate.from === 'string' && candidate.from ? candidate.from : (typeof found.from === 'string' ? found.from : '');
        const base = { barcode: candidate.barcode, phone: candidate.phone, cod: candidate.cod, dod: candidate.dod };
        const arrivals = Array.isArray(found.arrivals) ? found.arrivals.filter((at) => typeof at === 'string' && at) : [];
        const closed = found.ztoClosed === true ? true : (found.ztoClosed === false ? false : null);
        for (let i = 0; i < arrivals.length; i++) out.rows.push(Object.assign({}, base, { at: arrivals[i], ztoClosed: closed, skip: '', from: from }));
        if (!arrivals.length) out.otherScans++;
        if (typeof found.signedAt === 'string' && found.signedAt) {
            out.signed.push(candidate.barcode);
            out.signedRows.push(Object.assign({}, base, { at: found.signedAt, from: from }));
        }
        if (typeof found.returnedAt === 'string' && found.returnedAt) out.returned.push({ barcode: candidate.barcode, at: found.returnedAt,
            misplaced: found.misplacedAt === found.returnedAt });
    });
    out.total = out.rows.length;
    out.unverified = pending;
    out.failedPages.sort((a, b) => a - b);
    if (!out.failedPages.length) rememberZtoPalmPages(cfg, tabPages);
    out.elapsedMs = elapsedSince(startedAt);
    return out;
}

export function ztoListSyncRangeFromInputs() {
    const fromValue = fieldValue('ztoListSyncFrom');
    const toValue = fieldValue('ztoListSyncTo');
    const from = fromValue ? String(fromValue).trim() : '';
    const to = toValue ? String(toValue).trim() : '';
    const shape = /^\d{4}-\d{2}-\d{2}$/;
    if (!shape.test(from) || !shape.test(to) || to < from) return null;
    return { from: from, to: to };
}

export function setZtoListSyncNote(text) {
    viewState.ztoListSyncNote = text;
}

export function renderZtoListSyncPreview() {
    const result = ztoState.ztoListSyncResult;
    if (!result) {
        ztoState.ztoListPreview = { empty: 'ជ្រើសជួរកាលបរិច្ឆេទ រួចចុច «📥 ទាញបញ្ជី» ដើម្បីមើលកញ្ចប់ពី ZTO។', groups: [] };
        ztoState.touch();
        return;
    }
    const groups = classifyZtoListRows(result.rows, dataState.scanHistory, dataState.deletedItems, result.signedRows, result, dataState.dailyPickupData);
    const closeTargets = ztoListCloseTargets(groups.existing);
    const closeKeys = new Set(closeTargets.map((entry) => entry.key));
    for (let i = 0; i < groups.existing.length; i++) {
        groups.existing[i].closeInZoew = closeKeys.has(groups.existing[i].key);
    }
    const openReturned = new Set();
    ztoReturnedTargets(result.returned, dataState.scanHistory, result.signed).forEach((target) => target.codes.forEach((code) => openReturned.add(pickupBarcodeKey(code))));
    const autoClose = ztoAutoCloseEnabled();
    const removeReturned = autoClose && result.signedState === 'ok';
    for (let i = 0; i < groups.returned.length; i++) {
        groups.returned[i].openInZoew = openReturned.has(groups.returned[i].key);
        groups.returned[i].removeInZoew = removeReturned && groups.returned[i].openInZoew;
        groups.returned[i].removeHeld = groups.returned[i].openInZoew && !removeReturned ? (autoClose ? 'signed' : 'switch') : '';
    }
    const misplacedCount = groups.returned.filter((row) => row.misplaced === true).length;
    const stale = anyDbListenerViewIsStale(ZTO_SYNC_VIEW_KEYS);
    const freshTitle = stale ? '🆕 ថ្មី ➜ ' + VIEW_NOT_MEASURABLE_TEXT : '🆕 ថ្មី (មិនទាន់មានក្នុង ZoeW)';
    const existingTitle = stale ? '✅ មានក្នុង ZoeW រួច ➜ ' + VIEW_NOT_MEASURABLE_TEXT : '✅ មានក្នុង ZoeW រួច';
    ztoState.ztoListPreview = {
        empty: null,
        groups: [
            ztoListGroupModel(freshTitle, groups.fresh, 'zto-list-fresh'),
            ztoListGroupModel(existingTitle, groups.existing, 'zto-list-existing'),
            ztoListGroupModel(misplacedCount ? '↩️ មានក្នុងបញ្ជី តែស្កេនត្រឡប់ ឬ 📍 បញ្ជូនចេញ (ខុសទីតាំង) រួច (រំលង · មិនបញ្ចូល)'
                : '↩️ មានក្នុងបញ្ជី តែស្កេនត្រឡប់រួច (រំលង · មិនបញ្ចូល)', groups.returned, 'zto-list-returned'),
            ztoListGroupModel('♻️ ស្ទួនក្នុងបញ្ជី ZTO', groups.duplicate, 'zto-list-dup'),
            ztoListGroupModel('⏭️ រំលង (មិនបញ្ចូល)', groups.skipped, 'zto-list-skip')
        ]
    };
    ztoState.touch();
    const truncated = result.truncated
        ? ' · ⚠️ បញ្ជីវែងជាង ' + (result.pageLimit || ZTO_LIST_CLIENT_MAX_PAGES) + ' ទំព័រ ➜ សូមបំបែកជួរកាលបរិច្ឆេទ'
        : '';
    const bornClosed = groups.fresh.filter((row) => row.closedAtZto === true && !row.signedOnly).length;
    const signedOnly = groups.fresh.filter((row) => row.signedOnly).length;
    const pulled = Number(result.total) > result.rows.length ? ' (ZTO រាយ ' + result.total + ')' : '';
    setZtoListSyncNote('ZTO ' + result.rows.length + ' ជួរ' + pulled
        + ' · ' + result.from + ' ➜ ' + result.to + truncated
        + ztoListSignedNote(result, bornClosed, closeTargets.length, signedOnly, groups.returned.length, removeReturned ? openReturned.size : 0, misplacedCount)
        + (stale ? ' · ' + VIEW_NOT_MEASURABLE_NOTICE : '')
        + ' · 👁️ មើលជាមុន');
}

export function ztoListSignedNote(result, bornClosed, closeCount, signedOnly = 0, returnedCount = 0, removedCount = 0, misplacedCount = 0) {
    const parts = [];
    const other = Number(result && result.otherScans);
    if (isFinite(other) && other > 0 && !(result && result.palm)) parts.push('⏭️ ស្កេនផ្សេង ' + other + ' មិនរាប់');
    if (bornClosed > 0) parts.push('🔒 ZTO បិទរួច ' + bornClosed + ' ➜ «យករួច»');
    if (signedOnly > 0) parts.push('✍️ ចុះហត្ថលេខា (មកដល់មុន ' + (result && result.from) + ') ' + signedOnly + ' ➜ «យករួច»');
    if (closeCount > 0) parts.push('🔒 មានក្នុង ZoeW ZTO បិទរួច ' + closeCount + ' ➜ បិទពេល «បញ្ចូល»');
    const misplaced = Math.max(0, Math.min(returnedCount, misplacedCount));
    if (returnedCount - misplaced > 0) parts.push('↩️ ស្កេនត្រឡប់រួច ' + (returnedCount - misplaced) + ' ➜ រំលង មិនបញ្ចូល');
    if (misplaced > 0) parts.push('📍 ខុសទីតាំង (បញ្ជូនចេញរួច) ' + misplaced + ' ➜ រំលង មិនបញ្ចូល');
    if (removedCount > 0) parts.push('🗑️ ដកកញ្ចប់' + (misplaced ? 'ត្រឡប់/ខុសទីតាំង' : 'ត្រឡប់') + 'ចេញពី ZoeW ' + removedCount + ' (ធុងសំរាម «' + (misplaced ? 'ត្រឡប់»/«ខុសទីតាំង' : 'ត្រឡប់') + '» · ដកលុយ)');
    const returnedState = result && result.returnedState;
    if (returnedState === 'failed' || returnedState === 'partial') parts.push('⚠️ ពិនិត្យកញ្ចប់ត្រឡប់ទៅវិញមិនបានគ្រប់ ➜ សូមទាញម្តងទៀត');
    const unverified = result && Array.isArray(result.unverified) ? result.unverified : [];
    if (unverified.length) {
        parts.push('⚠️ ZTO មិនឆ្លើយ track ' + unverified.length + ' កញ្ចប់ ('
            + unverified.slice(0, ZTO_PALM_UNVERIFIED_SHOWN).join(', ') + (unverified.length > ZTO_PALM_UNVERIFIED_SHOWN ? ', …' : '')
            + ') ➜ មិនទាន់នៅក្នុងបញ្ជី — សូមទាញម្តងទៀត');
    }
    const failedPages = result && Array.isArray(result.failedPages) ? result.failedPages : [];
    if (failedPages.length) parts.push('⚠️ ទាញមិនបាន ' + failedPages.length + ' ទំព័រ (ZTO មិនឆ្លើយ) ➜ បញ្ជីមិនទាន់ពេញ — សូមទាញម្តងទៀត');
    if (result && result.palm && ztoListPositiveCount(result.candidates) > 0) {
        parts.push('⏱ ' + (ztoListPositiveCount(result.elapsedMs) / 1000).toFixed(1) + ' វិ');
    }
    const state = result && result.signedState;
    if (state === 'partial') parts.push('⚠️ បញ្ជីចុះហត្ថលេខា ZTO ទាញបានមិនគ្រប់ ➜ ខ្លះនៅបើក (បិទតាម ZTO ស្វ័យប្រវត្តិ ពិនិត្យបន្ត)');
    else if (state === 'failed') parts.push('⚠️ ទាញបញ្ជីចុះហត្ថលេខា ZTO មិនបាន ➜ កញ្ចប់ថ្មីបញ្ចូលជា «មិនទាន់យក» (បិទតាម ZTO ស្វ័យប្រវត្តិ ពិនិត្យបន្ត)');
    const mismatch = ztoListPositiveCount(result && result.signedMismatch);
    if (mismatch > 0) {
        const seen = ztoMismatchTexts(result && result.signedMismatchTexts);
        const expected = ztoExpectedTexts(result && result.signedDescExpected);
        const detail = seen.length
            ? ' — Function ទទួលពី ZTO ' + seen.map(ztoTextWithCodePoints).join(' / ') + (expected.length ? ' ≠ Server រំពឹង ' + expected.map(ztoTextWithCodePoints).join(' / ') : '')
            : '';
        parts.push('⚠️ ZTO ផ្ញើជួរ «ចុះហត្ថលេខា» ' + mismatch + ' ជួរ ដែលអត្ថបទប្រភេទស្កេនខុសពីការកំណត់ Server ➜ មិនរាប់ជាភស្តុតាងបិទ'
            + detail + ' (សូមប្រាប់អ្នកគ្រប់គ្រងប្រព័ន្ធឲ្យពិនិត្យ ZTO_LIST_SIGNED_SCAN_DESC)');
    }
    return parts.length ? ' · ' + parts.join(' · ') : '';
}

export function ztoListCloseTargets(existingRows, dataToScan = dataState.scanHistory) {
    if (!Array.isArray(existingRows) || !existingRows.length || !ztoAutoCloseEnabled()) return [];
    const wanted = new Set();
    for (let i = 0; i < existingRows.length; i++) {
        const row = existingRows[i];
        if (row && row.key && row.ztoClosed === true) wanted.add(row.key);
    }
    if (!wanted.size) return [];
    return collectOpenBarcodesForZtoStatus(dataToScan).filter((entry) => wanted.has(entry.key));
}

export async function runZtoListSyncPreview() {
    const session = captureZtoSession();
    const cfg = ztoStatusFeatureConfig();
    if (!cfg) {
        showToast('⚠️ ត្រូវកំណត់ API ស្វែងរក ZTO ជាមុនសិន');
        return;
    }
    if (ztoStatusSecretIsLocked(cfg)) {
        showToast('🔒 សូមវាយ PIN ម្តងជាមុន ដើម្បីទាញបញ្ជីពី ZTO');
        if (!isPinFlowPending()) requestPinBeforeConfig(openZtoListSyncModal, 'ztoListSync');
        return;
    }
    if ((navigator.onLine as boolean) === false) {
        showToast('⚠️ ក្រៅបណ្ដាញ — មិនអាចទាញបញ្ជីពី ZTO បានទេ');
        return;
    }
    if (ztoState.ztoListSyncInFlight) {
        showToast('⏳ កំពុងទាញបញ្ជីពី ZTO រួចហើយ...');
        return;
    }
    const range = ztoListSyncRangeFromInputs();
    if (!range) {
        showToast('⚠️ ជួរកាលបរិច្ឆេទមិនត្រឹមត្រូវ — ថ្ងៃបញ្ចប់ត្រូវនៅក្រោយថ្ងៃចាប់ផ្តើម');
        return;
    }
    ztoState.ztoListSyncInFlight = true;
    setZtoListSyncNote('⏳ កំពុងទាញបញ្ជីពី ZTO...');
    ztoListSignedProbe.clear();
    ztoListSignedEvidence.clear();
    try {
        const pulled: any = await fetchZtoListAllPages(cfg, range.from, range.to);
        if (!session.current()) return;
        const rows = pulled.rows;
        noteZtoListSignedCodes(pulled.signed);
        await resolveZtoListSignedVerdicts(cfg, rows);
        if (!session.current()) return;
        if (pulled.siteName || pulled.site) viewState.ztoListSyncSite = ztoListSiteText(pulled.siteName, pulled.site);
        if (pulled.palm === true) notePalmSiteName(pulled.site, pulled.siteName);
        ztoState.ztoListSyncResult = {
            rows: rows,
            signedRows: pulled.signedRows,
            from: range.from,
            to: range.to,
            total: pulled.total || rows.length,
            truncated: pulled.pages > pulled.pageLimit,
            site: pulled.site,
            siteName: pulled.siteName,
            otherScans: pulled.otherScans,
            signedMismatch: pulled.signedMismatch,
            signedMismatchTexts: pulled.signedMismatchTexts,
            signedDescExpected: pulled.signedDescExpected,
            signedCount: ztoListSignedEvidence.size,
            signedState: pulled.signedState,
            pageLimit: pulled.pageLimit,
            palm: pulled.palm === true,
            unverified: Array.isArray(pulled.unverified) ? pulled.unverified : [],
            failedPages: Array.isArray(pulled.failedPages) ? pulled.failedPages : [],
            candidates: ztoListPositiveCount(pulled.candidates),
            elapsedMs: ztoListPositiveCount(pulled.elapsedMs),
            returned: Array.isArray(pulled.returned) ? pulled.returned : [],
            signed: Array.isArray(pulled.signed) ? pulled.signed : [],
            returnedState: pulled.returnedState
        };
        renderZtoListSyncPreview();
        if (ztoState.ztoListSyncResult.signedState === 'ok') removeReturnedZtoBarcodes(ztoState.ztoListSyncResult.returned, dataState.scanHistory, ztoState.ztoListSyncResult.signed);
        showToast('✅ ទាញបញ្ជីពី ZTO បាន ' + rows.length + ' ជួរដេក');
    } catch (e) {
        if (!session.current()) return;
        ztoState.ztoListSyncResult = null;
        ztoListSignedProbe.clear();
        ztoListSignedEvidence.clear();
        renderZtoListSyncPreview();
        if (e && e.notConfigured) {
            const reason = e.listReason || 'site:no-account';
            if (reason === 'idtoken:supabase-unset') {
                setZtoListSyncNote('⚠️ Server មិនទាន់កំណត់ SUPABASE_URL និង SUPABASE_PUBLISHABLE_KEY នៅ Netlify — សូមមើល ZTO-SETUP-KH.md ផ្នែក ៤គ');
                showToast('⚠️ មុខងារបញ្ជី ZTO មិនទាន់កំណត់នៅ server');
            } else if (reason === 'idtoken:supabase-unreachable') {
                setZtoListSyncNote('⚠️ ផ្ទៀងផ្ទាត់ហាងជាមួយ Server មិនបាន — សូមសាកម្ដងទៀត');
                showToast('⚠️ ទាញបញ្ជីពី ZTO មិនបាន — សូមសាកម្ដងទៀត');
            } else if (reason === 'site:palm-other-branch') {
                setZtoListSyncNote('🏢 គណនី ZoeW នេះជាសាខាផ្សេងពីគណនី ZTO Palm — សូម Login ZTO Palm របស់សាខានេះក្នុង «API ស្វែងរកអតិថិជន»');
                showToast('ℹ️ គណនី ZTO Palm ជាសាខាផ្សេងពីគណនី ZoeW នេះ');
            } else if (reason === 'site:palm-missing') {
                setZtoListSyncNote('🔑 គណនី ZTO Palm នេះគ្មានលេខសាខា — សូម Login ZTO Palm ម្តងទៀតក្នុង «API ស្វែងរកអតិថិជន»');
                showToast('ℹ️ គណនី ZTO Palm នេះគ្មានលេខសាខា');
            } else if (reason === 'site:tenant-expired' || reason === 'site:tenant-revoked') {
                setZtoListSyncNote(reason === 'site:tenant-expired' ? '🏢 ហាងនេះផុតកំណត់ — សូមទាក់ទងអ្នកលក់ដើម្បីពន្យារ' : '🏢 ហាងនេះត្រូវបានបិទ — សូមទាក់ទងអ្នកលក់');
                showToast('ℹ️ ហាងនេះមិនអាចទាញបញ្ជី ZTO បានទេ');
            } else if (reason.indexOf('site:') === 0) {
                setZtoListSyncNote('🏢 គណនីនេះគ្មានលេខសាខា ZTO — សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ');
                showToast('ℹ️ គណនីនេះមិនទាន់ភ្ជាប់នឹងសាខា ZTO ទេ');
            } else if (reason.indexOf('idtoken:') === 0 && ZTO_LIST_SERVER_CONFIG_REASONS.indexOf(reason) === -1) {
                setZtoListSyncNote('⚠️ ផ្ទៀងផ្ទាត់គណនីជាមួយ Server មិនបាន (' + reason + ') — សូមសាកម្ដងទៀត · នៅតែមិនបាន ➜ ចាកចេញ ហើយចូលប្រព័ន្ធវិញ');
                showToast('⚠️ ទាញបញ្ជីពី ZTO មិនបាន — សូមសាកម្ដងទៀត');
            } else {
                setZtoListSyncNote('⚠️ មុខងារបញ្ជីមិនទាន់កំណត់នៅ Netlify ('
                    + reason + ') — សូមមើល ZTO-SETUP-KH.md ផ្នែក ៤គ');
                showToast('⚠️ មុខងារបញ្ជី ZTO មិនទាន់កំណត់នៅ server');
            }
        } else if (e && e.httpStatus === 401 && lookupApiIsPalm(cfg) && palmRefreshAvailable(cfg)) {
            setZtoListSyncNote('🔄 Session ZTO Palm ផុតកំណត់ — កំពុង Login ឡើងវិញដោយស្វ័យប្រវត្តិ ➜ សូមទាញម្តងទៀតបន្តិចទៀត');
            showToast('ℹ️ កំពុង Login ZTO Palm ឡើងវិញ');
        } else if (e && e.httpStatus === 401 && lookupApiIsPalm(cfg)) {
            const lost = palmSessionLostText(cfg, e.upstreamReason);
            setZtoListSyncNote('🔑 ' + lost + ' — សូម Login ZTO Palm ម្តងទៀតក្នុង «API ស្វែងរកអតិថិជន» រួចទាញម្តងទៀត');
            showToast('⚠️ ' + lost + ' — សូម Login ZTO Palm ម្តងទៀត');
        } else {
            const detail = e && e.httpStatus ? ' (HTTP ' + e.httpStatus + (e.upstreamReason ? ' · ' + e.upstreamReason : '') + (e.barcode ? ' · Barcode ' + e.barcode : '') + ')' : '';
            setZtoListSyncNote('⚠️ ទាញបញ្ជីពី ZTO មិនបាន' + detail + ' — សូមសាកម្ដងទៀត');
            showToast('⚠️ ទាញបញ្ជីពី ZTO មិនបាន — សូមសាកម្ដងទៀត');
        }
    } finally {
        if (session.ownsLock()) ztoState.ztoListSyncInFlight = false;
        if (session.current() && lookupApiIsPalm(cfg)) refreshZtoPalmSession();
    }
}

export async function markZtoListRowPickedUp(code) {
    const item = dataState.scanHistory.find((i) => i && Array.isArray(i.barcodes)
        && i.barcodes.some((b) => b && b.code === code));
    if (!item || !item.id) return false;
    try {
        const done = (await applyBarcodeCloseChange(item.id, code, true,
            { silent: true, showModal: false })) === true;
        if (done) setZtoPickupVerdict(code, true);
        return done;
    } catch (e) {
        if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'money', context: 'markZtoListRowPickedUp', barcode: code });
        return false;
    }
}

export async function importZtoListRows() {
    const session = captureZtoSession();
    if (ztoState.ztoListSyncInFlight) {
        showToast('⏳ កំពុងដំណើរការរួចហើយ...');
        return;
    }
    const result = ztoState.ztoListSyncResult;
    if (!result || !Array.isArray(result.rows)
        || (!result.rows.length && !(Array.isArray(result.signedRows) && result.signedRows.length))) {
        showToast('⚠️ សូមទាញបញ្ជីជាមុនសិន');
        return;
    }
    if ((navigator.onLine as boolean) === false) {
        showToast('⚠️ ក្រៅបណ្ដាញ — មិនអាចបញ្ចូលបានទេ');
        return;
    }
    if (anyDbListenerViewIsStale(ZTO_SYNC_VIEW_KEYS)) {
        showToast('⏳ ' + VIEW_NOT_MEASURABLE_TEXT + ' — មិនអាចបញ្ចូលបានទេ');
        return;
    }
    const groups = classifyZtoListRows(result.rows, dataState.scanHistory, dataState.deletedItems, result.signedRows, result, dataState.dailyPickupData);
    const queue = groups.fresh.slice(0, ZTO_LIST_IMPORT_MAX);
    const closeTargets = ztoListCloseTargets(groups.existing);
    const originOf = (row) => ({ code: row.barcode, from: row.from });
    if (!queue.length && !closeTargets.length) {
        const filled = await saveBarcodeOrigins(groups.existing.map(originOf));
        if (!session.current()) return;
        showToast(filled ? '📍 បំពេញប្រភព ' + filled + ' កញ្ចប់' : 'ℹ️ គ្មានកញ្ចប់ថ្មីត្រូវបញ្ចូលទេ');
        return;
    }
    const capped = groups.fresh.length > queue.length
        ? ' (ពិដាន ' + ZTO_LIST_IMPORT_MAX + ' ក្នុងមួយដង)' : '';
    const noStamp = queue.filter((row) => !row.stampMs).length;
    const noStampNote = noStamp
        ? '\n⏱️ ' + noStamp + ' កញ្ចប់គ្មានម៉ោងស្កេនពី ZTO ➜ ប្រើម៉ោងបញ្ចូលជំនួស។'
        : '';
    const pickedUp = queue.filter((row) => row.closedAtZto === true).length;
    const pickedUpNote = pickedUp
        ? '\n🔒 ' + pickedUp + ' កញ្ចប់ដែល ZTO បិទបញ្ជីរួច ➜ បញ្ចូលជា «យករួច» (ចូលស្ថិតិយក ដូចបិទដោយដៃ) ➜ ចូលធុងសំរាមក្នុង ២ ម៉ោង (លុយមិនត្រូវដក)។'
        : '';
    const signedOnly = queue.filter((row) => row.signedOnly).length;
    const signedOnlyNote = signedOnly
        ? '\n✍️ ' + signedOnly + ' កញ្ចប់ក្នុងនោះ ZTO ចុះហត្ថលេខាក្នុងចន្លោះ តែមកដល់មុនថ្ងៃ ' + result.from
            + ' ➜ 📅 ថ្ងៃ និងម៉ោង = ពេល ZTO ស្កេនចុះហត្ថលេខា។'
        : '';
    const closeNote = closeTargets.length
        ? '\n🔒 ' + closeTargets.length + ' កញ្ចប់មានក្នុង ZoeW តែ ZTO បិទបញ្ជីរួច ➜ បិទជា «យករួច» (ដូចចុចបិទដោយដៃ)។'
        : '';
    const question = queue.length
        ? 'បញ្ចូល ' + queue.length + ' កញ្ចប់ថ្មីចូល ZoeW?' + capped
            + '\n\nវានឹងដើរដូចការស្កេនដោយដៃបេះបិទ ➜ ស្ថិតិប្រាក់នឹងឡើងតាម COD។'
            + '\n📅 កាលបរិច្ឆេទ និងម៉ោង យកតាមថ្ងៃស្កេនរបស់ ZTO ➜ លុយចុះលើថ្ងៃនោះ។'
            + noStampNote + pickedUpNote + signedOnlyNote + closeNote
        : 'បិទ ' + closeTargets.length + ' កញ្ចប់ក្នុង ZoeW ដែល ZTO បិទបញ្ជីរួច?' + closeNote;
    if (!confirm(question)) {
        return;
    }
    ztoState.ztoListSyncInFlight = true;
    let saved = 0;
    let taken = 0;
    let failed = 0;
    let pending = 0;
    let takenOver = 0;
    let notTried = 0;
    let closedInZoew = 0;
    let closeNotTried = 0;
    let stalled = false;
    const savedDates = new Set();
    const origins = groups.existing.map(originOf);
    try {
        const laneOf = new Map();
        for (let i = 0; i < queue.length; i++) {
            const row = queue[i];
            const laneKey = row.phone + '|' + getZoneDateKey(row.stampMs || getServerNow(), 0);
            if (!laneOf.has(laneKey)) laneOf.set(laneKey, []);
            laneOf.get(laneKey).push(row);
        }
        const lanes = Array.from(laneOf.values());
        let laneNext = 0;
        let started = 0;
        let finished = 0;
        let stop = false;
        const runRow = async (row) => {
            if (!session.current()) return 'lost';
            if (isBarcodeAlreadyUsed(row.barcode)) return 'next';
            const claimPromise = claimBarcodeInRegistry(row.barcode);
            let claim = 'unknown';
            try {
                claim = await withTimeout(claimPromise, 15000,
                    'Barcode claim timed out');
            } catch (e) {
                if (session.current()) releaseLateBarcodeClaim(claimPromise, row.barcode);
                claim = e && e.message === 'Barcode claim timed out' ? 'stalled' : 'unknown';
            }
            if (!session.current()) return 'lost';
            if (claim === 'taken') { taken++; return 'next'; }
            if (claim === 'stalled') { failed++; stalled = true; return 'stop'; }
            if (claim !== 'claimed') { failed++; return 'next'; }
            const rollbackImportedRow = () => {
                if (!session.current()) return;
                releaseBarcodesInRegistry([row.barcode]);
                dropOptimisticBarcode(row.barcode);
                refreshCurrentHistoryView();
            };
            const rowDateKey = getZoneDateKey(row.stampMs || getServerNow(), 0);
            const closedStampMs = row.closedAtZto === true ? getServerNow() : 0;
            const savePromise = addOrUpdateEntry(row.barcode, row.phone, row.cod, row.dod, 'N/A', row.stampMs, closedStampMs);
            try {
                const status = await withTimeout(savePromise, 15000, 'Save timed out');
                if (!session.current()) return 'lost';
                if (status === true || status === false) {
                    saved++;
                    savedDates.add(rowDateKey);
                    origins.push(originOf(row));
                    if (closedStampMs) {
                        takenOver += (await markZtoListRowPickedUp(row.barcode)) ? 1 : 0;
                    }
                }
                else failed++;
            } catch (e) {
                if (!session.current()) return 'lost';
                if (e && e.message === 'Save timed out') {
                    pending++;
                    savedDates.add(rowDateKey);
                    armLateWrite(savePromise, () => {
                        if (!session.current()) return undefined;
                        refreshCurrentHistoryView();
                        return closedStampMs ? markZtoListRowPickedUp(row.barcode) : undefined;
                    }, rollbackImportedRow, 'ZTO list import save');
                    stalled = true;
                    return 'stop';
                }
                failed++;
                rollbackImportedRow();
            }
            return 'next';
        };
        const worker = async () => {
            while (!stop && laneNext < lanes.length) {
                const lane = lanes[laneNext++];
                for (let j = 0; j < lane.length; j++) {
                    if (stop) return;
                    if ((navigator.onLine as boolean) === false) { stop = true; return; }
                    started++;
                    const verdict = await runRow(lane[j]);
                    finished++;
                    setZtoListSyncNote('⏳ កំពុងបញ្ចូល ' + finished + '/' + queue.length + '...');
                    if (verdict !== 'next') { stop = true; return; }
                }
            }
        };
        if (queue.length) setZtoListSyncNote('⏳ កំពុងបញ្ចូល 0/' + queue.length + '...');
        const workers = [];
        for (let w = 0; w < ZTO_LIST_IMPORT_CONCURRENCY && w < lanes.length; w++) workers.push(worker());
        await Promise.all(workers);
        if (!session.current()) return;
        if (stop) notTried = queue.length - started;
        for (let i = 0; i < closeTargets.length; i++) {
            if (!session.current()) return;
            if (stalled || notTried || (navigator.onLine as boolean) === false) { closeNotTried = closeTargets.length - i; break; }
            setZtoListSyncNote('⏳ កំពុងបិទតាម ZTO ' + (i + 1) + '/' + closeTargets.length + '...');
            const done = await autoCloseBarcodeFromZto(closeTargets[i], dataState.scanHistory);
            if (!session.current()) return;
            if (done === undefined) {
                pending++;
                closeNotTried = closeTargets.length - i - 1;
                break;
            }
            if (done) {
                closedInZoew++;
                setZtoPickupVerdict(closeTargets[i].code, true);
            }
        }
    } finally {
        if (session.ownsLock()) ztoState.ztoListSyncInFlight = false;
    }
    if (!session.current()) return;
    if (!notTried && !closeNotTried) {
        ztoState.ztoListSyncResult = null;
        ztoListSignedProbe.clear();
        ztoListSignedEvidence.clear();
    }
    renderZtoListSyncPreview();
    const parts = ['✅ បញ្ចូល ' + saved + ' កញ្ចប់'];
    if (takenOver) parts.push('🔒 យករួច ' + takenOver);
    if (closedInZoew) parts.push('🔒 បិទតាម ZTO ' + closedInZoew);
    if (closeNotTried) parts.push('⏸️ មិនទាន់បិទ ' + closeNotTried + ' (បណ្តាញមិនឆ្លើយ ➜ ឈប់)');
    if (taken) parts.push('♻️ ស្ទួន ' + taken);
    if (pending) parts.push('⏳ កំពុងរក្សាទុក ' + pending);
    if (failed) parts.push('⚠️ បរាជ័យ ' + failed);
    if (notTried) parts.push('⏸️ មិនទាន់បញ្ចូល ' + notTried + ' (បណ្តាញមិនឆ្លើយ ➜ ឈប់)');
    const dateKeys = Array.from(savedDates).sort();
    const dateNote = dateKeys.length
        ? ' — 📅 កញ្ចប់ចុះលើថ្ងៃស្កេន ZTO ៖ ' + dateKeys.join(' · ')
            + ' ➜ ប្ដូរតម្រងថ្ងៃ ដើម្បីមើលពួកវា'
        : '';
    showToast(parts.join(' · ') + (dateKeys.length ? ' · 📅 ' + dateKeys.join(' · ') : ''));
    saveBarcodeOrigins(origins).catch(() => 0);
    setZtoListSyncNote(parts.join(' · ') + dateNote + (notTried || closeNotTried
        ? ' — បញ្ជីនៅដដែល ➜ ចុច «បញ្ចូល» ម្តងទៀតពេលបណ្តាញល្អ (កញ្ចប់ដែលបញ្ចូលរួចមិនស្ទួន)។'
        : ' — សូមទាញបញ្ជីម្តងទៀត ដើម្បីពិនិត្យ។'));
}

export function openZtoListSyncModal() {
    const cfg = ztoStatusFeatureConfig();
    if (!cfg) {
        showToast('⚠️ ត្រូវកំណត់ API ស្វែងរក ZTO ជាមុនសិន');
        return;
    }
    if (!ztoFastModeIsOn()) {
        showToast(ZTO_FAST_MODE_HINT);
        return;
    }
    if (!ztoListSyncEnabled()) {
        showToast(ZTO_FAST_MODE_HINT);
        return;
    }
    if (ztoStatusSecretIsLocked(cfg)) {
        showToast('🔒 សូមវាយ PIN ម្តងជាមុន ដើម្បីទាញបញ្ជីពី ZTO');
        if (!isPinFlowPending()) requestPinBeforeConfig(openZtoListSyncModal, 'ztoListSync');
        return;
    }
    const now = getServerNow();
    if (!fieldValue('ztoListSyncFrom')) setFieldValue('ztoListSyncFrom', getZoneDateKey(now, -(ZTO_LIST_DEFAULT_DAYS - 1)));
    if (!fieldValue('ztoListSyncTo')) setFieldValue('ztoListSyncTo', getZoneDateKey(now, 0));
    ztoState.ztoListSyncResult = null;
    ztoListSignedProbe.clear();
    ztoListSignedEvidence.clear();
    renderZtoListSyncPreview();
    setZtoListSyncNote('🏢 សាខាមកពីគណនីដែលចូលប្រព័ន្ធ — ជ្រើសជួរកាលបរិច្ឆេទ រួចចុច «📥 ទាញបញ្ជី»');
    openModalHelper('ztoListSyncModal');
}

export function closeZtoListSyncModal() {
    ztoState.ztoListSyncResult = null;
    ztoListSignedProbe.clear();
    ztoListSignedEvidence.clear();
    closeModal('ztoListSyncModal');
}

export function ztoListDayKeys(from, to) {
    const out = [];
    const shape = /^\d{4}-\d{2}-\d{2}$/;
    const a = String(from === undefined || from === null ? '' : from);
    const b = String(to === undefined || to === null ? '' : to);
    if (!shape.test(a) || !shape.test(b) || b < a) return out;
    const start = Date.parse(a + 'T00:00:00Z');
    if (!isFinite(start)) return out;
    for (let i = 0; i < ZTO_LIST_RANGE_MAX_DAYS; i++) {
        const day = new Date(start + i * 86400000).toISOString().slice(0, 10);
        if (day > b) break;
        out.push(day);
    }
    return out;
}

export async function fetchZtoSignedCodes(cfg, from, to) {
    const session = captureZtoSession();
    const days = ztoListDayKeys(from, to);
    const split = days.length >= 2 && !!ztoState.ztoSignedSplitAt && elapsedSince(ztoState.ztoSignedSplitAt) < ZTO_SIGNED_SPLIT_MEMO_MS
        && String(from) <= ztoState.ztoSignedSplitFrom;
    let whole = null;
    if (!split) {
        whole = await fetchZtoSignedPages(cfg, from, to);
        if (!whole || !whole.measured || !whole.truncated) return whole;
        if (days.length < 2 || !session.current()) return whole;
        ztoState.ztoSignedSplitAt = Date.now();
        ztoState.ztoSignedSplitFrom = String(from);
    }
    const out = { measured: true, codes: whole ? whole.codes.slice() : [], truncated: false, partial: false, signedMismatch: 0 };
    let daysMismatch = 0;
    let measuredDays = 0;
    let unmeasuredDays = 0;
    let firstErr = null;
    let next = 0;
    const worker = async () => {
        while (next < days.length) {
            if (!session.current()) { out.partial = true; return; }
            const day = days[next];
            next++;
            let got = null;
            try {
                got = await fetchZtoSignedPages(cfg, day, day);
            } catch (e) {
                got = null;
                if (!whole && !firstErr) { firstErr = e; next = days.length; }
            }
            if (!got || !got.measured || got.partial) out.partial = true;
            if (!got) continue;
            if (got.measured) measuredDays++;
            else unmeasuredDays++;
            if (got.truncated) out.truncated = true;
            daysMismatch += ztoListPositiveCount(got.signedMismatch);
            for (let i = 0; i < got.codes.length; i++) out.codes.push(got.codes[i]);
        }
    };
    const workers = [];
    for (let w = 0; w < ZTO_SIGNED_DAY_CONCURRENCY && w < days.length; w++) workers.push(worker());
    await Promise.all(workers);
    if (!whole && firstErr && !measuredDays) throw firstErr;
    if (!whole && unmeasuredDays && !measuredDays) return { measured: false, codes: [], truncated: false, partial: false };
    out.signedMismatch = Math.max(whole ? ztoListPositiveCount(whole.signedMismatch) : 0, daysMismatch);
    return out;
}

export async function fetchZtoSignedPages(cfg, from, to) {
    const first = await fetchZtoListPage(cfg, from, to, 1, 'signedExact');
    if (!first) return null;
    if (first.signedOk !== true || !Array.isArray(first.signed)) return { measured: false, codes: [], truncated: false, partial: false };
    const codes = first.signed.slice();
    let signedMismatch = ztoListPositiveCount(first.signedMismatch);
    const reported = Number(first.pages);
    let pages = isFinite(reported) && reported > 0 ? reported : 1;
    let open = first.pagesUnknown === true;
    let read = 1;
    let partial = false;
    for (;;) {
        const last = Math.min(pages, ZTO_LIST_CLIENT_MAX_PAGES);
        if (last <= read) break;
        const work = [];
        for (let page = read + 1; page <= last; page++) work.push(fetchZtoListPage(cfg, from, to, page, 'signedExact').catch(() => null));
        const more = await Promise.all(work);
        for (let i = 0; i < more.length; i++) {
            if (more[i] && more[i].signedOk === true && Array.isArray(more[i].signed)) {
                for (let j = 0; j < more[i].signed.length; j++) codes.push(more[i].signed[j]);
                signedMismatch += ztoListPositiveCount(more[i].signedMismatch);
            } else {
                partial = true;
            }
        }
        read = last;
        const tail = more[more.length - 1];
        if (!open || partial || !tail) break;
        const tailPages = Number(tail.pages);
        if (isFinite(tailPages) && tailPages > 0) pages = tailPages;
        open = tail.pagesUnknown === true;
    }
    return { measured: true, codes: codes, truncated: pages > ZTO_LIST_CLIENT_MAX_PAGES, partial: partial, signedMismatch: signedMismatch };
}
