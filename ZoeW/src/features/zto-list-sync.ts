import { viewState } from '../core/view-state';
import { ztoListGroupModel } from '../app/components/zto/model';
import { fieldValue, setFieldValue } from '../app/refs';
import { dataState, ztoState } from '../core/state';
import { getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { ZTO_LISTSYNC_KEY } from '../core/storage-keys';
import { VIEW_NOT_MEASURABLE_NOTICE, VIEW_NOT_MEASURABLE_TEXT, ZTO_SYNC_VIEW_KEYS, normalizeStoredPhone, ztoExpectedTexts, ztoMismatchTexts, ztoTextWithCodePoints } from '../core/text';
import { getZoneDateKey, ztoScanStampMillis } from '../core/timezone';
import { barcodeAbandonIsRipe } from '../domain/barcode';
import { trashRetentionMs } from '../domain/cleanup';
import { pickupBarcodeKey } from '../domain/pickup';
import { claimBarcodeInRegistry, isBarcodeAlreadyUsed, releaseBarcodesInRegistry, releaseLateBarcodeClaim } from '../domain/registry';
import { ZTO_AUTO_LOOKUP_TIMEOUT_MS } from './auto-lookup';
import { applyBarcodeCloseChange } from './barcode-ops';
import { isPinFlowPending } from './config';
import { safeLookupReason } from './customer-table-prefetch';
import { buildLookupRequestHeaders, ztoIdToken } from './lookup-api';
import { requestPinBeforeConfig } from './pin';
import { addOrUpdateEntry, dropOptimisticBarcode } from './scan-action';
import { autoCloseBarcodeFromZto, captureZtoSession, checkZtoStatusForBarcode, collectOpenBarcodesForZtoStatus, setZtoPickupVerdict, ztoAutoCloseEnabled, ztoFastModeIsOn, ztoStatusFeatureConfig, ztoStatusSecretIsLocked } from './zto-status';
import { anyDbListenerViewIsStale } from '../services/db-listeners';
import { armLateWrite, fetchWithTimeout, withTimeout } from '../services/network';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { drawerAction } from '../ui/page-nav';
import { showToast } from '../ui/toast';
import { saveBarcodeOrigins } from './barcode-origin';

export const ZTO_FAST_MODE_HINT = 'ℹ️ សូមគូស «Fast Mode សម្រាប់ ZTO Lookup» ក្នុង API ស្វែងរកជាមុនសិន';

export const ZTO_LIST_DEFAULT_DAYS = 4;

export const ZTO_LIST_CLIENT_MAX_PAGES = 3;

export const ZTO_LIST_PREVIEW_ROWS = 12;

export const ZTO_LIST_IMPORT_MAX = 100;
export const ZTO_LIST_SERVER_CONFIG_REASONS = ['idtoken:aud', 'idtoken:iss', 'idtoken:project-unset'];

export const ZTO_LIST_SIGNED_PROBE_MAX = 20;

export const ZTO_LIST_RANGE_MAX_DAYS = 31;

export const ZTO_SIGNED_DAY_CONCURRENCY = 3;
export const ZTO_SIGNED_SPLIT_MEMO_MS = 30 * 60 * 1000;

export const ZTO_LIST_PROBE_CONCURRENCY = 4;

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
        arrivedBefore: ''
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

export function classifyZtoListRows(rows, historyList, trashList, signedRows?, range?) {
    const out = { fresh: [], existing: [], duplicate: [], skipped: [] };
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
    for (let i = 0; i < order.length; i++) {
        const row = best.get(order[i]);
        if (known.has(row.key)) out.existing.push(row);
        else out.fresh.push(row);
    }
    if (!range || typeof range.from !== 'string' || typeof range.to !== 'string') return out;
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
        if (ztoListRowAgeState(row.stampMs, getServerNow()) === 'purged') {
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

export function buildZtoListApiUrl(cfg, from, to, page, mode?) {
    if (!cfg || !cfg.url) return '';
    const raw = String(cfg.url).trim();
    const marker = '/.netlify/functions/zto-order-detail';
    const markerAt = raw.toLowerCase().indexOf(marker);
    const base = markerAt === -1 ? raw.split('?')[0] : raw.slice(0, markerAt) + marker;
    const extra = mode === 'signed' ? '&signed=1' : (mode === 'signedExact' ? '&signed=1&exact=1' : (mode === 'withSigned' ? '&withSigned=1' : ''));
    return base + '?list=1'
        + '&from=' + encodeURIComponent(from)
        + '&to=' + encodeURIComponent(to) + '&page=' + encodeURIComponent(String(page)) + extra;
}

export async function fetchZtoListPage(cfg, from, to, page, mode?) {
    const session = captureZtoSession();
    const url = buildZtoListApiUrl(cfg, from, to, page, mode);
    if (!url) return null;
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
    if (!out.res.ok || !Array.isArray(body.rows)) {
        const err: any = new Error('ZTO_LIST_FAILED');
        err.httpStatus = out.res.status;
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

export async function fetchZtoListAllPages(cfg, from, to) {
    const out = { rows: [], signed: [], signedRows: [], pages: 0, total: 0, site: '', siteName: '', otherScans: 0, signedMismatch: 0,
        signedMismatchTexts: [], signedDescExpected: [], signedState: 'none' };
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
            const other = Number(body.otherScans);
            if (isFinite(other) && other > 0) out.otherScans += other;
        }
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
    };
    const first = await fetchZtoListPage(cfg, from, to, 1, 'withSigned');
    if (!first) return out;
    absorb(first, true);
    const reported = Number(first.pages);
    out.pages = isFinite(reported) && reported > 0 ? reported : 1;
    const last = Math.min(out.pages, ZTO_LIST_CLIENT_MAX_PAGES);
    const signedPages = Number(first.signedPages);
    const signedLast = first.signedOk === true && isFinite(signedPages)
        ? Math.min(signedPages, ZTO_LIST_CLIENT_MAX_PAGES) : 0;
    const arrivalWork = [];
    for (let page = 2; page <= last; page++) {
        arrivalWork.push(fetchZtoListPage(cfg, from, to, page, page <= signedLast ? 'withSigned' : undefined));
    }
    const signedWork = [];
    for (let page = last + 1; page <= signedLast; page++) {
        signedWork.push(fetchZtoListPage(cfg, from, to, page, 'signed').catch(() => null));
    }
    const signedSettled = Promise.all(signedWork);
    const more = await Promise.all(arrivalWork);
    const extraSigned = await signedSettled;
    for (let i = 0; i < more.length; i++) absorb(more[i], true);
    let signedFailed = false;
    for (let i = 0; i < more.length; i++) {
        if (more[i] && i + 2 <= signedLast && more[i].signedOk !== true) signedFailed = true;
    }
    for (let i = 0; i < extraSigned.length; i++) {
        if (!extraSigned[i] || extraSigned[i].signedOk !== true) signedFailed = true;
        absorb(extraSigned[i], false);
    }
    if (first.signedOk === true) {
        out.signedState = signedFailed ? 'partial'
            : (isFinite(signedPages) && signedPages > ZTO_LIST_CLIENT_MAX_PAGES ? 'partial' : 'ok');
    } else if (first.signed === null) {
        out.signedState = 'off';
    } else if (first.signedOk === false) {
        out.signedState = 'failed';
    }
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
    const groups = classifyZtoListRows(result.rows, dataState.scanHistory, dataState.deletedItems, result.signedRows, result);
    const closeTargets = ztoListCloseTargets(groups.existing);
    const closeKeys = new Set(closeTargets.map((entry) => entry.key));
    for (let i = 0; i < groups.existing.length; i++) {
        groups.existing[i].closeInZoew = closeKeys.has(groups.existing[i].key);
    }
    const stale = anyDbListenerViewIsStale(ZTO_SYNC_VIEW_KEYS);
    const freshTitle = stale ? '🆕 ថ្មី ➜ ' + VIEW_NOT_MEASURABLE_TEXT : '🆕 ថ្មី (មិនទាន់មានក្នុង ZoeW)';
    const existingTitle = stale ? '✅ មានក្នុង ZoeW រួច ➜ ' + VIEW_NOT_MEASURABLE_TEXT : '✅ មានក្នុង ZoeW រួច';
    ztoState.ztoListPreview = {
        empty: null,
        groups: [
            ztoListGroupModel(freshTitle, groups.fresh, 'zto-list-fresh'),
            ztoListGroupModel(existingTitle, groups.existing, 'zto-list-existing'),
            ztoListGroupModel('♻️ ស្ទួនក្នុងបញ្ជី ZTO', groups.duplicate, 'zto-list-dup'),
            ztoListGroupModel('⏭️ រំលង (មិនបញ្ចូល)', groups.skipped, 'zto-list-skip')
        ]
    };
    ztoState.touch();
    const truncated = result.truncated
        ? ' · ⚠️ បញ្ជីវែងជាង ' + ZTO_LIST_CLIENT_MAX_PAGES + ' ទំព័រ ➜ សូមបំបែកជួរកាលបរិច្ឆេទ'
        : '';
    const bornClosed = groups.fresh.filter((row) => row.closedAtZto === true && !row.signedOnly).length;
    const signedOnly = groups.fresh.filter((row) => row.signedOnly).length;
    setZtoListSyncNote('ZTO រាយ ' + result.total + ' ជួរដេក · ទាញបាន ' + result.rows.length
        + ' · ' + result.from + ' ➜ ' + result.to + truncated
        + ztoListSignedNote(result, bornClosed, closeTargets.length, signedOnly)
        + (stale ? ' · ' + VIEW_NOT_MEASURABLE_NOTICE : '')
        + ' — ⛔ ជុំនេះជាការមើលជាមុន ៖ គ្មានអ្វីត្រូវបញ្ចូលទេ។');
}

export function ztoListSignedNote(result, bornClosed, closeCount, signedOnly = 0) {
    const parts = [];
    const other = Number(result && result.otherScans);
    if (isFinite(other) && other > 0) parts.push('⏭️ ស្កេនប្រភេទផ្សេង ' + other + ' ជួរ មិនរាប់ (ទាញតែ «អីវ៉ាន់មកដល់»)');
    if (bornClosed > 0) parts.push('🔒 ថ្មីដែល ZTO បិទរួច ' + bornClosed + ' ➜ បញ្ចូលជា «យករួច»');
    if (signedOnly > 0) parts.push('✍️ ZTO ចុះហត្ថលេខាក្នុងចន្លោះ តែមកដល់មុនថ្ងៃ ' + (result && result.from) + ' ' + signedOnly
        + ' ➜ បញ្ចូលជា «យករួច» លើថ្ងៃចុះហត្ថលេខា');
    if (closeCount > 0) parts.push('🔒 មានក្នុង ZoeW តែ ZTO បិទរួច ' + closeCount + ' ➜ បិទពេលចុច «បញ្ចូល»');
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
        const pulled = await fetchZtoListAllPages(cfg, range.from, range.to);
        if (!session.current()) return;
        const rows = pulled.rows;
        noteZtoListSignedCodes(pulled.signed);
        await resolveZtoListSignedVerdicts(cfg, rows);
        if (!session.current()) return;
        if (pulled.siteName || pulled.site) viewState.ztoListSyncSite = ztoListSiteText(pulled.siteName, pulled.site);
        ztoState.ztoListSyncResult = {
            rows: rows,
            signedRows: pulled.signedRows,
            from: range.from,
            to: range.to,
            total: pulled.total || rows.length,
            truncated: pulled.pages > ZTO_LIST_CLIENT_MAX_PAGES,
            site: pulled.site,
            siteName: pulled.siteName,
            otherScans: pulled.otherScans,
            signedMismatch: pulled.signedMismatch,
            signedMismatchTexts: pulled.signedMismatchTexts,
            signedDescExpected: pulled.signedDescExpected,
            signedCount: ztoListSignedEvidence.size,
            signedState: pulled.signedState
        };
        renderZtoListSyncPreview();
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
        } else {
            setZtoListSyncNote('⚠️ ទាញបញ្ជីពី ZTO មិនបាន — សូមសាកម្ដងទៀត');
            showToast('⚠️ ទាញបញ្ជីពី ZTO មិនបាន — សូមសាកម្ដងទៀត');
        }
    } finally {
        if (session.ownsLock()) ztoState.ztoListSyncInFlight = false;
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
    const groups = classifyZtoListRows(result.rows, dataState.scanHistory, dataState.deletedItems, result.signedRows, result);
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
        for (let i = 0; i < queue.length; i++) {
            if (!session.current()) return;
            const row = queue[i];
            setZtoListSyncNote('⏳ កំពុងបញ្ចូល ' + (i + 1) + '/' + queue.length + '...');
            if ((navigator.onLine as boolean) === false) { notTried = queue.length - i; break; }
            if (isBarcodeAlreadyUsed(row.barcode)) continue;
            const claimPromise = claimBarcodeInRegistry(row.barcode);
            let claim = 'unknown';
            try {
                claim = await withTimeout(claimPromise, 15000,
                    'Barcode claim timed out');
            } catch (e) {
                if (session.current()) releaseLateBarcodeClaim(claimPromise, row.barcode);
                claim = e && e.message === 'Barcode claim timed out' ? 'stalled' : 'unknown';
            }
            if (!session.current()) return;
            if (claim === 'taken') { taken++; continue; }
            if (claim === 'stalled') { failed++; stalled = true; notTried = queue.length - i - 1; break; }
            if (claim !== 'claimed') { failed++; continue; }
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
                if (!session.current()) return;
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
                if (!session.current()) return;
                if (e && e.message === 'Save timed out') {
                    pending++;
                    savedDates.add(rowDateKey);
                    armLateWrite(savePromise, () => {
                        if (!session.current()) return undefined;
                        refreshCurrentHistoryView();
                        return closedStampMs ? markZtoListRowPickedUp(row.barcode) : undefined;
                    }, rollbackImportedRow, 'ZTO list import save');
                    stalled = true;
                    notTried = queue.length - i - 1;
                    break;
                } else {
                    failed++;
                    rollbackImportedRow();
                }
            }
        }
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
    const pages = isFinite(reported) && reported > 0 ? reported : 1;
    const last = Math.min(pages, ZTO_LIST_CLIENT_MAX_PAGES);
    const work = [];
    for (let page = 2; page <= last; page++) work.push(fetchZtoListPage(cfg, from, to, page, 'signedExact').catch(() => null));
    const more = await Promise.all(work);
    let partial = false;
    for (let i = 0; i < more.length; i++) {
        if (more[i] && more[i].signedOk === true && Array.isArray(more[i].signed)) {
            for (let j = 0; j < more[i].signed.length; j++) codes.push(more[i].signed[j]);
            signedMismatch += ztoListPositiveCount(more[i].signedMismatch);
        } else {
            partial = true;
        }
    }
    return { measured: true, codes: codes, truncated: pages > last, partial: partial, signedMismatch: signedMismatch };
}
