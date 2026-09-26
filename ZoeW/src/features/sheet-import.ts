import { uiState } from '../core/state';
import { emptySheetImportView } from '../app/components/sheet/model';
function patchSheetImportView(patch) {
    uiState.sheetImportView = Object.assign({}, uiState.sheetImportView || emptySheetImportView(), patch);
}

function sheetImportViewNow(): any {
    return uiState.sheetImportView || emptySheetImportView();
}

import { fieldValue, openFilePicker, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { sheetImportState } from '../core/state';
import { appLocalStore, safeStoreSet } from '../core/storage';
import { SHEET_IMPORT_SECRET_SALT, SHEET_IMPORT_STORE_KEY } from '../core/storage-keys';
import { clearCustomerDataTableCache, seedCustomerTableFromImport } from './customer-table';
import { scheduleCustomerTableSoonRefresh } from './customer-table-prefetch';
import { loadScriptOnce } from './export';
import { requestPinBeforeConfig } from './pin';
import { fetchWithTimeout } from '../services/network';
import { closeModal, openModalHelper } from '../ui/modal';
import { drawerAction } from '../ui/page-nav';
import { showToast } from '../ui/toast';

export const SHEET_IMPORT_TIMEOUT_MS = 30000;

export const SHEET_IMPORT_MAX_ROWS = 20000;

export const SHEET_IMPORT_PREVIEW_ROWS = 8;

export const SHEET_IMPORT_HEADER_SCAN_ROWS = 12;

export const SHEET_IMPORT_FIELD_SELECT_IDS = { barcode: 'siMapBarcode', dod: 'siMapDod', cod: 'siMapCod', phone: 'siMapPhone' };

export const SHEET_IMPORT_MSG_CLASSES = { ok: 'si-msg si-msg-ok', warn: 'si-msg si-msg-warn', bad: 'si-msg si-msg-bad' };

export const SHEET_IMPORT_CHIP_CLASSES = { ok: 'si-chip si-chip-ok', warn: 'si-chip si-chip-warn', bad: 'si-chip si-chip-bad' };

export async function deriveSheetImportKey(pin) {
    try {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
        return await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: enc.encode(SHEET_IMPORT_SECRET_SALT), iterations: 150000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    } catch (e) {
        return null;
    }
}

export async function encryptSheetImportSecret(plainText) {
    if (!sheetImportState.sheetImportKey || !plainText) return null;
    try {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sheetImportState.sheetImportKey, new TextEncoder().encode(plainText));
        return { iv: Array.from(iv), data: Array.from(new Uint8Array(cipherBuf)) };
    } catch (e) {
        return null;
    }
}

export async function decryptSheetImportSecret(encObj) {
    if (!sheetImportState.sheetImportKey || !encObj || !Array.isArray(encObj.iv) || !Array.isArray(encObj.data)) return '';
    try {
        const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(encObj.iv) }, sheetImportState.sheetImportKey, new Uint8Array(encObj.data));
        return new TextDecoder().decode(plainBuf);
    } catch (e) {
        return '';
    }
}

export function readSheetImportStoredConfig() {
    try {
        const raw = appLocalStore.getItem(SHEET_IMPORT_STORE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && parsed.u && parsed.p ? parsed : null;
    } catch (e) {
        return null;
    }
}

export function maskSheetImportUrl(url) {
    try {
        const parsed = new URL(url);
        const parts = parsed.pathname.split('/').filter(Boolean);
        const id = parts.length >= 3 ? parts[2] : '';
        const shortId = id.length > 10 ? id.slice(0, 6) + '…' + id.slice(-4) : id;
        return parsed.host + '/…/' + shortId + '/exec';
    } catch (e) {
        return 'URL មិនត្រឹមត្រូវ';
    }
}

export function setSheetImportMsg(hostId, text, kind?) {
    const msgs = Object.assign({}, sheetImportViewNow().msgs);
    msgs[hostId] = text ? { text: text, kind: kind || 'warn' } : null;
    patchSheetImportView({ msgs: msgs });
}

export function showSheetImportPart(id, on) {
    if (viewState.siParts[id] === !!on) return;
    viewState.siParts = Object.assign({}, viewState.siParts, { [id]: !!on });
}

export function sheetImportIsBinaryWorkbook(bytes) {
    if (!bytes || bytes.length < 8) return false;
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) return true;
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return true;
    return false;
}

export function sheetImportReadOptions(bytes) {
    const options: any = { type: 'array' };
    if (!sheetImportIsBinaryWorkbook(bytes)) options.raw = true;
    return options;
}

export function sheetImportCellToText(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return '';
    if (typeof value === 'number') return isFinite(value) ? String(value) : '';
    return String(value).trim();
}

export function sheetImportToMoney(value) {
    if (value === null || value === undefined || value === '') return 0;
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
    if (!isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
}

export const SHEET_IMPORT_COLUMN_LETTER_MAX = 12;

export function sheetImportColumnLetter(index) {
    let letter = '';
    let n = Math.floor(Number(index));
    if (!Number.isFinite(n) || n < 0) return '';
    while (n >= 0 && letter.length < SHEET_IMPORT_COLUMN_LETTER_MAX) {
        letter = String.fromCharCode(65 + (n % 26)) + letter;
        n = Math.floor(n / 26) - 1;
    }
    return letter;
}

export function clearSheetImportSession() {
    sheetImportState.sheetImportKey = null;
    sheetImportState.sheetImportUrl = '';
    sheetImportState.sheetImportPassword = '';
    sheetImportState.sheetImportWorkbook = null;
    sheetImportState.sheetImportSheetRows = [];
    sheetImportState.sheetImportHeaders = [];
    sheetImportState.sheetImportSignature = '';
    sheetImportState.sheetImportBusy = false;
    (['siApiUrlInput', 'siApiPasswordInput', 'siFileInput'] as const).forEach((id) => {
        setFieldValue(id, '');
    });
    viewState.siStatusFoot = '';
    uiState.sheetImportView = emptySheetImportView();
    ['siConfigMsg', 'siFileMsg', 'siMapMsg', 'siActionMsg', 'siClearMsg'].forEach((id) => setSheetImportMsg(id, ''));
    ['siConfigSummary', 'siConfigEditRow', 'siFileCard', 'siMapCard', 'siActionCard', 'siClearCard', 'siPreviewWrap'].forEach((id) => showSheetImportPart(id, false));
    showSheetImportPart('siConfigForm', true);
}

export function closeSheetImportModal() {
    clearSheetImportSession();
    closeModal('sheetImportModal');
}

export function drawerSheetImportFlow() {
    drawerAction(function () { requestPinBeforeConfig(openSheetImportModal, 'sheetImport'); });
}

export async function openSheetImportModal(pin) {
    clearSheetImportSession();
    openModalHelper('sheetImportModal');
    sheetImportState.sheetImportKey = await deriveSheetImportKey(pin);
    if (!sheetImportState.sheetImportKey) {
        setSheetImportMsg('siConfigMsg', 'បង្កើតកូនសោអ៊ិនគ្រីបមិនបានទេ! សូមប្រើ HTTPS រួចសាកល្បងម្តងទៀត។', 'bad');
        return;
    }
    const stored = readSheetImportStoredConfig();
    if (!stored) return;
    const url = await decryptSheetImportSecret(stored.u);
    const password = await decryptSheetImportSecret(stored.p);
    if (!url || !password) {
        setSheetImportMsg('siConfigMsg', 'ស្រាយការតភ្ជាប់មិនបានទេ — ប្រហែល Security PIN ត្រូវបានប្តូរ។ សូមកំណត់ការតភ្ជាប់ម្តងទៀត។', 'bad');
        return;
    }
    sheetImportState.sheetImportUrl = url;
    sheetImportState.sheetImportPassword = password;
    showSheetImportConfigSummary();
    await refreshSheetImportStatus();
}

export function showSheetImportConfigSummary() {
    showSheetImportPart('siConfigForm', false);
    showSheetImportPart('siConfigSummary', true);
    showSheetImportPart('siConfigEditRow', true);
    showSheetImportPart('siFileCard', true);
    showSheetImportPart('siClearCard', true);
    patchSheetImportView({ summary: { url: maskSheetImportUrl(sheetImportState.sheetImportUrl) } });
}

export function editSheetImportConfig() {
    setSheetImportMsg('siConfigMsg', '');
    showSheetImportPart('siConfigForm', true);
    showSheetImportPart('siConfigSummary', false);
    showSheetImportPart('siConfigEditRow', false);
    showSheetImportPart('siFileCard', false);
    showSheetImportPart('siClearCard', false);
    showSheetImportPart('siMapCard', false);
    showSheetImportPart('siActionCard', false);
}

export async function callSheetImportApi(action, extra, url?, password?) {
    const target = url || sheetImportState.sheetImportUrl;
    const secret = password === undefined ? sheetImportState.sheetImportPassword : password;
    if (!target) throw new Error('មិនទាន់កំណត់ URL ទេ');
    if ((navigator.onLine as boolean) === false) throw new Error('ឧបករណ៍ក្រៅបណ្ដាញ — សូមភ្ជាប់អ៊ីនធឺណិតជាមុនសិន');
    const payload = Object.assign({ action: action, password: secret }, extra || {});
    const out = await fetchWithTimeout(target, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
    }, SHEET_IMPORT_TIMEOUT_MS, 'សំណើអស់ពេល — សូមពិនិត្យបណ្តាញ', (r) => r.text());
    if (!out.res.ok) throw new Error('ម៉ាស៊ីនបម្រើឆ្លើយ ' + out.res.status);
    let parsed;
    try {
        parsed = JSON.parse(out.body);
    } catch (e) {
        throw new Error('ចម្លើយមិនមែនជា JSON — សូមពិនិត្យថា Deploy ជា Web app ហើយ «Who has access» ជា Anyone');
    }
    if (!parsed.ok) throw new Error(parsed.error || 'សំណើបរាជ័យ');
    return parsed.data;
}

export function setSheetImportFoot(text) {
    viewState.siStatusFoot = text;
}

export function sheetImportStatusText(spreadsheetName, sheetName, rowCount) {
    const head = spreadsheetName ? 'គោលដៅ៖ ' + spreadsheetName + ' ➜ tab «' + sheetName + '»' : 'គោលដៅ៖ tab «' + sheetName + '»';
    return head + ' · មាន ' + rowCount + ' ជួរដេក';
}

export async function refreshSheetImportStatus() {
    try {
        const status = await callSheetImportApi('status', {});
        setSheetImportFoot(sheetImportStatusText(status.spreadsheetName, status.sheetName, status.rowCount));
        return status;
    } catch (e) {
        setSheetImportMsg('siConfigMsg', e.message, 'bad');
        return null;
    }
}

export async function saveSheetImportConfig() {
    if (sheetImportState.sheetImportBusy) return;
    const url = fieldValue('siApiUrlInput').trim();
    const password = fieldValue('siApiPasswordInput').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(url)) {
        setSheetImportMsg('siConfigMsg', 'URL ត្រូវជា Web app URL របស់ Apps Script ដែលបញ្ចប់ដោយ /exec', 'bad');
        return;
    }
    if (!password) {
        setSheetImportMsg('siConfigMsg', 'សូមបញ្ចូលពាក្យសម្ងាត់នាំចូល', 'bad');
        return;
    }
    if (!sheetImportState.sheetImportKey) {
        setSheetImportMsg('siConfigMsg', 'សម័យ PIN បានផុតកំណត់! សូមបិទប្រអប់នេះ ហើយបើកម្តងទៀតដើម្បីវាយ PIN សាជាថ្មី។', 'bad');
        return;
    }
    sheetImportState.sheetImportBusy = true;
    viewState.siConfigSaving = true;
    setSheetImportMsg('siConfigMsg', 'កំពុងសាកល្បងការតភ្ជាប់...', 'warn');
    try {
        const status = await callSheetImportApi('status', {}, url, password);
        const stored = { v: 1, u: await encryptSheetImportSecret(url), p: await encryptSheetImportSecret(password) };
        if (!stored.u || !stored.p || !safeStoreSet(appLocalStore, SHEET_IMPORT_STORE_KEY, JSON.stringify(stored))) {
            setSheetImportMsg('siConfigMsg', 'រក្សាទុកមិនបានទេ — សូមពិនិត្យទំហំផ្ទុករបស់ browser', 'bad');
            return;
        }
        sheetImportState.sheetImportUrl = url;
        sheetImportState.sheetImportPassword = password;
        setFieldValue('siApiUrlInput', '');
        setFieldValue('siApiPasswordInput', '');
        setSheetImportMsg('siConfigMsg', '');
        showSheetImportConfigSummary();
        setSheetImportFoot(sheetImportStatusText(status.spreadsheetName, status.sheetName, status.rowCount));
        showToast('✅ ការតភ្ជាប់ត្រឹមត្រូវ!');
    } catch (e) {
        setSheetImportMsg('siConfigMsg', e.message, 'bad');
    } finally {
        viewState.siConfigSaving = false;
        sheetImportState.sheetImportBusy = false;
    }
}

export function pickSheetImportFile() {
    openFilePicker('siFileInput');
}

export function handleSheetImportFileInput(inputEl?) {
    const file = inputEl && inputEl.files ? inputEl.files[0] : null;
    handleSheetImportFile(file);
}

export function readSheetImportFileBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.onerror = () => reject(new Error('អានឯកសារមិនបានទេ'));
        reader.readAsArrayBuffer(file);
    });
}

export function sheetImportLibFailureMessage(e) {
    if (e && e.code === 'SCRIPT_LOAD_TIMEOUT') {
        return 'ផ្ទុកឯកសារអាន Excel យូរពេក (បណ្តាញឆ្លើយមិនចេញ) — សូមសាកម្តងទៀត';
    }
    if (e && e.code === 'SCRIPT_LOAD_FAILED') {
        return (navigator.onLine as boolean) === false
            ? 'ឧបករណ៍ក្រៅបណ្ដាញ ហើយឯកសារអាន Excel មិនទាន់ចូល cache ទេ'
            : 'ផ្ទុកឯកសារអាន Excel មិនបានទេ — សូម Refresh ទំព័រម្តង';
    }
    return e && e.message ? e.message : String(e);
}

export async function handleSheetImportFile(file) {
    if (!file) return;
    setSheetImportMsg('siFileMsg', 'កំពុងអានឯកសារ...', 'warn');
    let buffer;
    try {
        await loadScriptOnce('xlsx');
        buffer = await readSheetImportFileBuffer(file);
    } catch (e) {
        setSheetImportMsg('siFileMsg', 'អានឯកសារមិនបានទេ៖ ' + sheetImportLibFailureMessage(e), 'bad');
        return;
    }
    try {
        const sheetImportBytes = new Uint8Array(buffer);
        sheetImportState.sheetImportWorkbook = XLSX.read(sheetImportBytes, sheetImportReadOptions(sheetImportBytes));
        const names = sheetImportState.sheetImportWorkbook.SheetNames || [];
        if (!names.length) throw new Error('ឯកសារនេះគ្មាន tab ទេ');
        patchSheetImportView({ sheetNames: names, sheetValue: names[0] || '' });
        setSheetImportMsg('siFileMsg', 'អាន «' + file.name + '» រួចរាល់', 'ok');
        showSheetImportPart('siMapCard', true);
        showSheetImportPart('siActionCard', true);
        await loadSheetImportSelectedSheet();
    } catch (e) {
        setSheetImportMsg('siFileMsg', 'អានឯកសារមិនបានទេ៖ ' + (e && e.message ? e.message : e), 'bad');
    }
}

export async function loadSheetImportSelectedSheet() {
    if (!sheetImportState.sheetImportWorkbook) return;
    const ws = sheetImportState.sheetImportWorkbook.Sheets[sheetImportViewNow().sheetValue];
    if (!ws) return;
    sheetImportState.sheetImportSheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: false });
    let headerIndex = 0;
    for (let i = 0; i < Math.min(sheetImportState.sheetImportSheetRows.length, SHEET_IMPORT_HEADER_SCAN_ROWS); i++) {
        const filled = (sheetImportState.sheetImportSheetRows[i] || []).filter((v) => sheetImportCellToText(v) !== '');
        if (filled.length >= 2) {
            headerIndex = i;
            break;
        }
    }
    setFieldValue('siHeaderRowInput', String(headerIndex + 1));
    await applySheetImportHeaderRow();
}

export function sheetImportHeaderRowNumber() {
    const parsed = parseInt(fieldValue('siHeaderRowInput'), 10);
    return isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

export async function applySheetImportHeaderRow() {
    const index = sheetImportHeaderRowNumber() - 1;
    sheetImportState.sheetImportHeaders = (sheetImportState.sheetImportSheetRows[index] || []).map(sheetImportCellToText);
    if (!sheetImportState.sheetImportHeaders.length) {
        setSheetImportMsg('siMapMsg', 'ជួរដេកនេះទទេ — សូមប្តូរលេខជួរដេក header', 'bad');
        return;
    }
    fillSheetImportMappingSelects();
    setSheetImportMsg('siMapMsg', 'កំពុងរកការផ្គូផ្គង...', 'warn');
    try {
        const prepared = await callSheetImportApi('prepare', { headers: sheetImportState.sheetImportHeaders });
        sheetImportState.sheetImportSignature = prepared.signature;
        applySheetImportMapping(prepared.mapping);
        if (prepared.source === 'saved') {
            if (prepared.mode) setFieldValue('siModeSel', prepared.mode);
            setSheetImportMsg('siMapMsg', '✅ ប្រើការផ្គូផ្គងដែលរក្សាទុកពីលើកមុន', 'ok');
        } else if (prepared.source === 'auto') {
            setSheetImportMsg('siMapMsg', '✅ រកឃើញ Column ដោយស្វ័យប្រវត្តិ', 'ok');
        } else {
            setSheetImportMsg('siMapMsg', 'រកមិនឃើញ Column ដោយស្វ័យប្រវត្តិទេ — សូមជ្រើសដោយដៃ', 'warn');
        }
    } catch (e) {
        setSheetImportMsg('siMapMsg', e.message, 'bad');
    }
    renderSheetImportPreview();
}

export function fillSheetImportMappingSelects() {
    const options = sheetImportState.sheetImportHeaders.map((header, idx) => ({
        value: String(idx),
        label: sheetImportColumnLetter(idx) + ' · ' + (header || '(ទទេ)')
    }));
    const mapping = Object.assign({}, sheetImportViewNow().mapping);
    Object.keys(SHEET_IMPORT_FIELD_SELECT_IDS).forEach((field) => {
        const id = SHEET_IMPORT_FIELD_SELECT_IDS[field];
        const prev = mapping[id] ? mapping[id].value : '-1';
        mapping[id] = { options: options, value: prev, filled: true };
    });
    patchSheetImportView({ mapping: mapping });
}

export function applySheetImportMapping(mapping) {
    const next = Object.assign({}, sheetImportViewNow().mapping);
    Object.keys(SHEET_IMPORT_FIELD_SELECT_IDS).forEach((field) => {
        const id = SHEET_IMPORT_FIELD_SELECT_IDS[field];
        const value = mapping && typeof mapping[field] === 'number' ? mapping[field] : -1;
        next[id] = Object.assign({}, next[id] || { options: [], filled: false }, { value: String(value) });
    });
    patchSheetImportView({ mapping: next });
}

export function currentSheetImportMapping() {
    const view = sheetImportViewNow();
    const mapping = {};
    Object.keys(SHEET_IMPORT_FIELD_SELECT_IDS).forEach((field) => {
        const cfg = view.mapping[SHEET_IMPORT_FIELD_SELECT_IDS[field]];
        const parsed = parseInt(cfg ? cfg.value : '-1', 10);
        mapping[field] = isNaN(parsed) ? -1 : parsed;
    });
    return mapping;
}

export function sheetImportMappedRows() {
    const mapping: any = currentSheetImportMapping();
    const start = sheetImportHeaderRowNumber();
    const out = [];
    for (let i = start; i < sheetImportState.sheetImportSheetRows.length; i++) {
        const row = sheetImportState.sheetImportSheetRows[i] || [];
        out.push([
            mapping.barcode >= 0 ? sheetImportCellToText(row[mapping.barcode]) : '',
            mapping.dod >= 0 ? sheetImportToMoney(row[mapping.dod]) : 0,
            mapping.cod >= 0 ? sheetImportToMoney(row[mapping.cod]) : 0,
            mapping.phone >= 0 ? sheetImportCellToText(row[mapping.phone]) : ''
        ]);
    }
    return out;
}

export function addSheetImportChip(host, text, kind) {
    host.push({ text: text, kind: kind });
}

export function renderSheetImportPreview() {
    const rows = sheetImportMappedRows();
    const usable = rows.filter((r) => r[0] !== '');
    const seen = Object.create(null);
    let duplicates = 0;
    usable.forEach((r) => {
        const key = r[0].toUpperCase();
        if (seen[key]) duplicates++;
        seen[key] = true;
    });
    const chips = [];
    addSheetImportChip(chips, 'ជួរដេកក្នុងឯកសារ ' + rows.length, '');
    addSheetImportChip(chips, 'មាន Barcode ' + usable.length, usable.length ? 'ok' : 'bad');
    if (rows.length - usable.length > 0) addSheetImportChip(chips, 'រំលង ' + (rows.length - usable.length), 'warn');
    if (duplicates) addSheetImportChip(chips, 'ស្ទួនក្នុងឯកសារ ' + duplicates, 'warn');
    patchSheetImportView({
        chips: chips,
        previewRows: usable.slice(0, SHEET_IMPORT_PREVIEW_ROWS).map((r) => [r[0], r[1].toFixed(2), r[2].toFixed(2), r[3]])
    });
    showSheetImportPart('siPreviewWrap', usable.length > 0);
    viewState.siImportBtnDisabled = usable.length === 0;
}

export async function runSheetImport() {
    if (sheetImportState.sheetImportBusy) return;
    const rows = sheetImportMappedRows().filter((r) => r[0] !== '');
    if (!rows.length) {
        setSheetImportMsg('siActionMsg', 'គ្មានជួរដេកត្រូវនាំចូលទេ', 'bad');
        return;
    }
    if (rows.length > SHEET_IMPORT_MAX_ROWS) {
        setSheetImportMsg('siActionMsg', 'ឯកសារនេះមាន ' + rows.length + ' ជួរដេក ច្រើនជាងកម្រិត ' + SHEET_IMPORT_MAX_ROWS, 'bad');
        return;
    }
    const mode = fieldValue('siModeSel');
    if (mode === 'replace' && !confirm('ជួរដេកទាំងអស់ក្នុង Sheet នឹងត្រូវលុប រួចជំនួសដោយ ' + rows.length + ' ជួរដេកពីឯកសារនេះ។ តើបន្តទេ?')) return;
    sheetImportState.sheetImportBusy = true;
    viewState.siImportBtnDisabled = true;
    viewState.siImportBtnText = 'កំពុងនាំចូល...';
    setSheetImportMsg('siActionMsg', '');
    try {
        const result = await callSheetImportApi('import', {
            payload: { rows: rows, mode: mode, mapping: currentSheetImportMapping(), signature: sheetImportState.sheetImportSignature }
        });
        const parts = ['✅ រួចរាល់ — បន្ថែម ' + result.added, 'កែ ' + result.updated, 'ដដែល ' + result.unchanged];
        if (result.skippedNoBarcode) parts.push('រំលង ' + result.skippedNoBarcode);
        if (result.duplicatesInFile) parts.push('ស្ទួនក្នុងឯកសារ ' + result.duplicatesInFile);
        parts.push('សរុបក្នុង Sheet ' + result.rowsAfter + ' ជួរដេក');
        setSheetImportMsg('siActionMsg', parts.join(' · '), 'ok');
        setSheetImportFoot(sheetImportStatusText('', result.sheetName, result.rowsAfter));
        if (!seedCustomerTableFromImport(rows, mode, result.rowsAfter)) clearCustomerDataTableCache();
        scheduleCustomerTableSoonRefresh(true);
        showToast('✅ នាំចូលរួចរាល់ — ' + result.rowsAfter + ' ជួរដេកក្នុង Sheet');
    } catch (e) {
        setSheetImportMsg('siActionMsg', e.message, 'bad');
        showToast('❌ នាំចូលមិនបានទេ! ' + e.message);
    } finally {
        viewState.siImportBtnDisabled = false;
        viewState.siImportBtnText = 'នាំចូលទៅ Sheet';
        sheetImportState.sheetImportBusy = false;
    }
}

export async function runSheetImportClear() {
    if (sheetImportState.sheetImportBusy) return;
    if (!confirm('ជួរដេកទាំងអស់ក្នុង tab គោលដៅនឹងត្រូវលុប ដោយទុកតែជួរ header។ សកម្មភាពនេះមិនអាចដកវិញបានទេ។ តើបន្តទេ?')) return;
    sheetImportState.sheetImportBusy = true;
    viewState.siClearBtnBusy = true;
    setSheetImportMsg('siClearMsg', '');
    try {
        const result = await callSheetImportApi('clear', { confirm: 'CLEAR' });
        setSheetImportMsg('siClearMsg', '✅ សម្អាតរួចរាល់ — លុប ' + result.removed + ' ជួរដេក', 'ok');
        setSheetImportFoot(sheetImportStatusText('', result.sheetName, result.rowsAfter));
        clearCustomerDataTableCache();
        scheduleCustomerTableSoonRefresh(true);
        showToast('✅ សម្អាតរួចរាល់ — លុប ' + result.removed + ' ជួរដេក');
    } catch (e) {
        setSheetImportMsg('siClearMsg', e.message, 'bad');
        showToast('❌ សម្អាតមិនបានទេ! ' + e.message);
    } finally {
        viewState.siClearBtnBusy = false;
        sheetImportState.sheetImportBusy = false;
    }
}

export function resetSheetImportFileSelection() {
    sheetImportState.sheetImportWorkbook = null;
    sheetImportState.sheetImportSheetRows = [];
    sheetImportState.sheetImportHeaders = [];
    sheetImportState.sheetImportSignature = '';
    setFieldValue('siFileInput', '');
    patchSheetImportView({ chips: [] });
    showSheetImportPart('siMapCard', false);
    showSheetImportPart('siActionCard', false);
    showSheetImportPart('siPreviewWrap', false);
    ['siFileMsg', 'siMapMsg', 'siActionMsg'].forEach((id) => setSheetImportMsg(id, ''));
}

