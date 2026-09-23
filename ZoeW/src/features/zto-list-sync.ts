import { viewState } from '../core/view-state';
import { ztoListGroupModel } from '../app/components/zto/model';
import { fieldValue, setFieldValue } from '../app/refs';
import { dataState, ztoState } from '../core/state';
import { getServerNow } from '../core/clock';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { ZTO_LISTSYNC_KEY } from '../core/storage-keys';
import { VIEW_NOT_MEASURABLE_NOTICE, VIEW_NOT_MEASURABLE_TEXT, ZTO_SYNC_VIEW_KEYS, normalizeStoredPhone } from '../core/text';
import { getZoneDateKey, ztoScanStampMillis } from '../core/timezone';
import { barcodeAbandonIsRipe, sanitizeInput } from '../domain/barcode';
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
import { checkZtoStatusForBarcode, ztoFastModeIsOn, ztoStatusFeatureConfig, ztoStatusSecretIsLocked } from './zto-status';
import { anyDbListenerViewIsStale } from '../services/db-listeners';
import { armLateWrite, fetchWithTimeout, withTimeout } from '../services/network';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { drawerAction } from '../ui/page-nav';
import { showToast } from '../ui/toast';

export const ZTO_FAST_MODE_HINT = 'ℹ️ សូមគូស «Fast Mode សម្រាប់ ZTO Lookup» ក្នុង API ស្វែងរកជាមុនសិន';

export const ZTO_LIST_DEFAULT_DAYS = 4;

export const ZTO_LIST_CLIENT_MAX_PAGES = 3;

export const ZTO_LIST_PREVIEW_ROWS = 12;

export const ZTO_LIST_IMPORT_MAX = 100;

export const ZTO_LIST_SIGNED_PROBE_MAX = 20;

export const ZTO_LIST_SKIP_TEXT = {
    'scan-type': 'មិនមែនស្កេន «មកដល់»',
    'too-old-open': 'ចាស់ជាងច្បាប់សម្អាត ហើយ ZTO មិនទាន់បិទបញ្ជី ➜ មិនបញ្ចូល (បញ្ចូល ➜ ចូលធុងសំរាមភ្លាម ➜ ដកលុយ)',
    'too-old-unknown': 'ចាស់ជាងច្បាប់សម្អាត ហើយវាស់ស្ថានភាព ZTO មិនបាន ➜ មិនបញ្ចូល (សូមសាកទាញម្តងទៀត)',
    'too-old-purged': 'ចាស់ជាងអាយុធុងសំរាម ➜ ពិនិត្យស្ទួនមិនបាន ➜ មិនបញ្ចូល (ការបញ្ចូល = ហានិភ័យលុយបូកស្ទួន)'
};

export const ztoListSignedProbe = new Map();

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

export function ztoListSignedVerdict(raw, key) {
    if (key && ztoListSignedProbe.has(key)) return ztoListSignedProbe.get(key);
    return raw && typeof raw.ztoClosed === 'boolean' ? raw.ztoClosed : null;
}

export function ztoListRowAgeState(stampMs, now) {
    if (!stampMs || !barcodeAbandonIsRipe({ isClosed: false }, stampMs, now)) return 'fresh';
    return now - stampMs > trashRetentionMs({ trashReason: 'pickup' }) ? 'purged' : 'old';
}

export function ztoListRowNeedsSignedProbe(raw, now) {
    if (!raw || raw.skip) return false;
    if (typeof raw.ztoClosed === 'boolean') return false;
    const key = pickupBarcodeKey(raw.barcode);
    if (!key || ztoListSignedProbe.has(key)) return false;
    if (!normalizeStoredPhone(raw.phone)) return false;
    return ztoListRowAgeState(ztoScanStampMillis(raw.at), now) === 'old';
}

export async function resolveZtoListSignedVerdicts(cfg, rows) {
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
    for (let i = 0; i < pending.length; i++) {
        if ((navigator.onLine as boolean) === false) break;
        setZtoListSyncNote('⏳ កំពុងពិនិត្យស្ថានភាព ZTO ' + (i + 1) + '/' + pending.length + '...');
        let verdict = null;
        try {
            const out = await checkZtoStatusForBarcode(cfg, pending[i].code);
            verdict = out && typeof out.closed === 'boolean' ? out.closed : null;
        } catch (e) {
            verdict = null;
        }
        if (typeof verdict === 'boolean') {
            ztoListSignedProbe.set(pending[i].key, verdict);
            measured++;
        }
    }
    return measured;
}

export function classifyZtoListRows(rows, historyList, trashList) {
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
    for (let i = 0; i < list.length; i++) {
        const raw = list[i] || {};
        const key = pickupBarcodeKey(raw.barcode);
        const phone = normalizeStoredPhone(raw.phone);
        const cod = Number(raw.cod);
        const dod = Number(raw.dod);
        const at = String(raw.at === undefined || raw.at === null ? '' : raw.at);
        const stampMs = ztoScanStampMillis(at);
        const row = {
            barcode: String(raw.barcode === undefined || raw.barcode === null ? '' : raw.barcode),
            phone: phone,
            cod: isFinite(cod) ? cod : 0,
            dod: isFinite(dod) ? dod : 0,
            at: at,
            stampMs: stampMs,
            ztoClosed: ztoListSignedVerdict(raw, key),
            closedAtZto: false,
            skip: String(raw.skip === undefined || raw.skip === null ? '' : raw.skip),
            key: key
        };
        if (!key || !phone || row.skip) {
            out.skipped.push(row);
            continue;
        }
        const ageState = ztoListRowAgeState(stampMs, getServerNow());
        if (ageState === 'purged') {
            row.skip = 'too-old-purged';
            out.skipped.push(row);
            continue;
        }
        if (ageState === 'old') {
            if (row.ztoClosed !== true) {
                row.skip = row.ztoClosed === false ? 'too-old-open' : 'too-old-unknown';
                out.skipped.push(row);
                continue;
            }
            row.closedAtZto = true;
        }
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
    return out;
}

export function buildZtoListApiUrl(cfg, from, to, page) {
    if (!cfg || !cfg.url) return '';
    const raw = String(cfg.url).trim();
    const marker = '/.netlify/functions/zto-order-detail';
    const markerAt = raw.toLowerCase().indexOf(marker);
    const base = markerAt === -1 ? raw.split('?')[0] : raw.slice(0, markerAt) + marker;
    return base + '?list=1'
        + '&from=' + encodeURIComponent(from)
        + '&to=' + encodeURIComponent(to) + '&page=' + encodeURIComponent(String(page));
}

export async function fetchZtoListPage(cfg, from, to, page) {
    const url = buildZtoListApiUrl(cfg, from, to, page);
    if (!url) return null;
    const headers = await buildLookupRequestHeaders(cfg);
    const idToken = await ztoIdToken();
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

export function ztoListGroupHtml(title, rows, toneClass) {
    const shown = rows.slice(0, ZTO_LIST_PREVIEW_ROWS);
    const groupMoreHtml = rows.length > shown.length
        ? '<div class="zto-list-more">' + sanitizeInput('និង ' + (rows.length - shown.length) + ' ទៀត') + '</div>'
        : '';
    const groupRowsHtml = shown.length
        ? shown.map((row) => {
            const money = [
                row.cod ? 'COD $' + row.cod.toFixed(2) : '',
                row.dod ? 'DOD $' + row.dod.toFixed(2) : ''
            ].filter(Boolean).join(' · ');
            const meta = [row.phone || '—', money, row.at,
                row.closedAtZto === true ? '🔒 ZTO បិទបញ្ជីរួច ➜ បញ្ចូលជា «យករួច»' : '',
                ztoListSkipText(row.skip)].filter(Boolean).join(' · ');
            return '<div class="zto-list-row">'
                + '<span class="zto-list-code">' + sanitizeInput(row.barcode || '—') + '</span>'
                + '<span class="zto-list-meta">' + sanitizeInput(meta) + '</span></div>';
        }).join('')
        : '<div class="zto-list-row zto-list-row-none">' + sanitizeInput('— គ្មាន —') + '</div>';
    return `<div class="zto-list-group ${sanitizeInput(toneClass)}">`
        + '<div class="zto-list-group-head">' + sanitizeInput(title + ' (' + rows.length + ')') + '</div>'
        + groupRowsHtml + groupMoreHtml + '</div>';
}

export function renderZtoListSyncPreview() {
    const result = ztoState.ztoListSyncResult;
    if (!result) {
        ztoState.ztoListPreview = { empty: 'ជ្រើសជួរកាលបរិច្ឆេទ រួចចុច «📥 ទាញបញ្ជី» ដើម្បីមើលកញ្ចប់ពី ZTO។', groups: [] };
        ztoState.touch();
        return;
    }
    const groups = classifyZtoListRows(result.rows, dataState.scanHistory, dataState.deletedItems);
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
    setZtoListSyncNote('ZTO រាយ ' + result.total + ' ជួរដេក · ទាញបាន ' + result.rows.length
        + ' · ' + result.from + ' ➜ ' + result.to + truncated
        + (stale ? ' · ' + VIEW_NOT_MEASURABLE_NOTICE : '')
        + ' — ⛔ ជុំនេះជាការមើលជាមុន ៖ គ្មានអ្វីត្រូវបញ្ចូលទេ។');
}

export async function runZtoListSyncPreview() {
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
    const rows = [];
    let pages = 1;
    let total = 0;
    try {
        for (let page = 1; page <= ZTO_LIST_CLIENT_MAX_PAGES; page++) {
            const body = await fetchZtoListPage(cfg, range.from, range.to, page);
            if (!body) break;
            for (let i = 0; i < body.rows.length; i++) rows.push(body.rows[i]);
            const reported = Number(body.pages);
            pages = isFinite(reported) && reported > 0 ? reported : page;
            const reportedTotal = Number(body.total);
            if (isFinite(reportedTotal)) total = reportedTotal;
            if (page >= pages) break;
        }
        await resolveZtoListSignedVerdicts(cfg, rows);
        ztoState.ztoListSyncResult = {
            rows: rows,
            from: range.from,
            to: range.to,
            total: total || rows.length,
            truncated: pages > ZTO_LIST_CLIENT_MAX_PAGES
        };
        renderZtoListSyncPreview();
        showToast('✅ ទាញបញ្ជីពី ZTO បាន ' + rows.length + ' ជួរដេក');
    } catch (e) {
        ztoState.ztoListSyncResult = null;
        ztoListSignedProbe.clear();
        renderZtoListSyncPreview();
        if (e && e.notConfigured) {
            const reason = e.listReason || 'site:no-account';
            if (reason.indexOf('site:') === 0 || reason.indexOf('idtoken:') === 0) {
                setZtoListSyncNote('🏢 គណនីនេះគ្មានលេខសាខា ZTO — សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ');
                showToast('ℹ️ គណនីនេះមិនទាន់ភ្ជាប់នឹងសាខា ZTO ទេ');
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
        ztoState.ztoListSyncInFlight = false;
    }
}

export async function markZtoListRowPickedUp(code) {
    const item = dataState.scanHistory.find((i) => i && Array.isArray(i.barcodes)
        && i.barcodes.some((b) => b && b.code === code));
    if (!item || !item.id) return false;
    try {
        return (await applyBarcodeCloseChange(item.id, code, true,
            { silent: true, showModal: false })) === true;
    } catch (e) {
        if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'money', context: 'markZtoListRowPickedUp', barcode: code });
        return false;
    }
}

export async function importZtoListRows() {
    if (ztoState.ztoListSyncInFlight) {
        showToast('⏳ កំពុងដំណើរការរួចហើយ...');
        return;
    }
    const result = ztoState.ztoListSyncResult;
    if (!result || !Array.isArray(result.rows) || !result.rows.length) {
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
    const groups = classifyZtoListRows(result.rows, dataState.scanHistory, dataState.deletedItems);
    const queue = groups.fresh.slice(0, ZTO_LIST_IMPORT_MAX);
    if (!queue.length) {
        showToast('ℹ️ គ្មានកញ្ចប់ថ្មីត្រូវបញ្ចូលទេ');
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
        ? '\n🔒 ' + pickedUp + ' កញ្ចប់ចាស់ដែល ZTO បិទបញ្ជីរួច ➜ បញ្ចូលជា «យករួច» ➜ ចូលធុងសំរាមក្នុង ២ ម៉ោង (លុយមិនត្រូវដក)។'
        : '';
    if (!confirm('បញ្ចូល ' + queue.length + ' កញ្ចប់ថ្មីចូល ZoeW?' + capped
        + '\n\nវានឹងដើរដូចការស្កេនដោយដៃបេះបិទ ➜ ស្ថិតិប្រាក់នឹងឡើងតាម COD។'
        + '\n📅 កាលបរិច្ឆេទ និងម៉ោង យកតាមថ្ងៃស្កេនរបស់ ZTO ➜ លុយចុះលើថ្ងៃនោះ។'
        + noStampNote + pickedUpNote)) {
        return;
    }
    ztoState.ztoListSyncInFlight = true;
    let saved = 0;
    let taken = 0;
    let failed = 0;
    let pending = 0;
    let takenOver = 0;
    const savedDates = new Set();
    try {
        for (let i = 0; i < queue.length; i++) {
            const row = queue[i];
            setZtoListSyncNote('⏳ កំពុងបញ្ចូល ' + (i + 1) + '/' + queue.length + '...');
            if ((navigator.onLine as boolean) === false) break;
            if (isBarcodeAlreadyUsed(row.barcode)) continue;
            const claimPromise = claimBarcodeInRegistry(row.barcode);
            let claim = 'unknown';
            try {
                claim = await withTimeout(claimPromise, 15000,
                    'Barcode claim timed out');
            } catch (e) {
                releaseLateBarcodeClaim(claimPromise, row.barcode);
                claim = 'unknown';
            }
            if (claim === 'taken') { taken++; continue; }
            if (claim !== 'claimed') { failed++; continue; }
            const rollbackImportedRow = () => {
                releaseBarcodesInRegistry([row.barcode]);
                dropOptimisticBarcode(row.barcode);
                refreshCurrentHistoryView();
            };
            const rowDateKey = getZoneDateKey(row.stampMs || getServerNow(), 0);
            const closedStampMs = row.closedAtZto === true ? getServerNow() : 0;
            const savePromise = addOrUpdateEntry(row.barcode, row.phone, row.cod, row.dod, 'N/A', row.stampMs, closedStampMs);
            try {
                const status = await withTimeout(savePromise, 15000, 'Save timed out');
                if (status === true) {
                    saved++;
                    savedDates.add(rowDateKey);
                    if (closedStampMs) {
                        takenOver += (await markZtoListRowPickedUp(row.barcode)) ? 1 : 0;
                    }
                }
                else failed++;
            } catch (e) {
                if (e && e.message === 'Save timed out') {
                    pending++;
                    savedDates.add(rowDateKey);
                    armLateWrite(savePromise, refreshCurrentHistoryView, rollbackImportedRow,
                        'ZTO list import save');
                } else {
                    failed++;
                    rollbackImportedRow();
                }
            }
        }
    } finally {
        ztoState.ztoListSyncInFlight = false;
    }
    ztoState.ztoListSyncResult = null;
    ztoListSignedProbe.clear();
    renderZtoListSyncPreview();
    const parts = ['✅ បញ្ចូល ' + saved + ' កញ្ចប់'];
    if (takenOver) parts.push('🔒 យករួច ' + takenOver);
    if (taken) parts.push('♻️ ស្ទួន ' + taken);
    if (pending) parts.push('⏳ កំពុងរក្សាទុក ' + pending);
    if (failed) parts.push('⚠️ បរាជ័យ ' + failed);
    const dateKeys = Array.from(savedDates).sort();
    const dateNote = dateKeys.length
        ? ' — 📅 កញ្ចប់ចុះលើថ្ងៃស្កេន ZTO ៖ ' + dateKeys.join(' · ')
            + ' ➜ ប្ដូរតម្រងថ្ងៃ ដើម្បីមើលពួកវា'
        : '';
    showToast(parts.join(' · ') + (dateKeys.length ? ' · 📅 ' + dateKeys.join(' · ') : ''));
    setZtoListSyncNote(parts.join(' · ') + dateNote + ' — សូមទាញបញ្ជីម្តងទៀត ដើម្បីពិនិត្យ។');
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
    renderZtoListSyncPreview();
    setZtoListSyncNote('🏢 សាខាមកពីគណនីដែលចូលប្រព័ន្ធ — ជ្រើសជួរកាលបរិច្ឆេទ រួចចុច «📥 ទាញបញ្ជី»');
    openModalHelper('ztoListSyncModal');
}

export function closeZtoListSyncModal() {
    ztoState.ztoListSyncResult = null;
    ztoListSignedProbe.clear();
    closeModal('ztoListSyncModal');
}
