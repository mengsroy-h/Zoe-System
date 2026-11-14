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
import { firebaseState, lookupState, sheetImportState } from '../core/state';
import { appLocalStore, safeStoreSet } from '../core/storage';
import { SHEET_IMPORT_SECRET_SALT, SHEET_IMPORT_STORE_KEY } from '../core/storage-keys';
import { shopOwnsSetting, shopScope } from '../core/shop-scope';
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

export const SHEET_IMPORT_VALUE_FIELDS = ['dod', 'cod', 'phone'];

export const SHEET_IMPORT_KEEP_UNMAPPED_VERSION = 3;

export const SHEET_IMPORT_UPSERT_UNMAPPED_TEXT = '⚠️ «បន្ថែមថ្មី + កែអ្វីដែលប្រែ» ដែលមាន Column «— មិនប្រើ —» ត្រូវការ Apps Script នាំចូលដែលរក្សាតម្លៃចាស់ក្នុង Column នោះ — Apps Script ដែលភ្ជាប់នេះមិនបានប្រាប់ថារក្សាទេ (វាអាចលុបតម្លៃចាស់ក្នុង Sheet)។ សូម Deploy Code.gs ថ្មីពីថត zto-import ឬជ្រើស Column DOD · COD · Phone ឲ្យគ្រប់ ឬប្រើ «បន្ថែមតែ Barcode ថ្មី»។';

export const SHEET_IMPORT_PREPARE_PENDING_TEXT = 'កំពុងរកការផ្គូផ្គង Column របស់ឯកសារនេះ — សូមរង់ចាំបន្តិច';

export const SHEET_IMPORT_UNKNOWN_TEXT = 'មិនទាន់ដឹងលទ្ធផលទេ — Sheet អាចបានទទួលរួច។ តារាងអតិថិជនក្នុងឧបករណ៍ត្រូវបានបោះចោល ហើយនឹងទាញថ្មី។ រក្សាប្រតិបត្តិការដើម ហើយផ្ទៀងផ្ទាត់ Sheet មុនប្រតិបត្តិការថ្មី។';

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
        return parsed && parsed.u && parsed.p && shopOwnsSetting(parsed, SHEET_IMPORT_STORE_KEY) ? parsed : null;
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
    sheetConfigOwner = null;
    sheetOperationGeneration++;
    sheetPrepareGeneration++;
    sheetFileGeneration++;
    sheetPreparePending = false;
    sheetWriterVersion = { url: '', version: 0 };
    sheetImportState.sheetImportKey = null;
    sheetImportState.sheetImportUrl = '';
    sheetImportState.sheetImportPassword = '';
    sheetImportState.sheetImportWorkbook = null;
    sheetImportState.sheetImportSheetRows = [];
    sheetImportState.sheetImportHeaders = [];
    sheetImportState.sheetImportSignature = '';
    sheetImportState.sheetImportBusy = false;
    viewState.siConfigSaving = false;
    viewState.siImportBtnDisabled = false;
    viewState.siImportBtnText = 'នាំចូលទៅ Sheet';
    viewState.siClearBtnBusy = false;
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
    const generation = sheetOperationGeneration;
    const shop = shopScope();
    const authEpoch = firebaseState.authGeneration;
    let openingKey = null;
    const current = () => generation === sheetOperationGeneration && shopScope() === shop
        && firebaseState.authGeneration === authEpoch && sheetImportState.sheetImportKey === openingKey;
    const key = await deriveSheetImportKey(pin);
    if (!current()) return;
    openingKey = key;
    sheetImportState.sheetImportKey = key;
    if (!sheetImportState.sheetImportKey) {
        setSheetImportMsg('siConfigMsg', 'បង្កើតកូនសោអ៊ិនគ្រីបមិនបានទេ! សូមប្រើ HTTPS រួចសាកល្បងម្តងទៀត។', 'bad');
        return;
    }
    const stored = readSheetImportStoredConfig();
    if (!stored) return;
    const url = await decryptSheetImportSecret(stored.u);
    if (!current()) return;
    const password = await decryptSheetImportSecret(stored.p);
    if (!current()) return;
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

async function preparedSheetWrite_(kind, payload, env) {
    var current = env.current || function () { return true; };
    var responseCurrent = env.responseCurrent || current;
    var fail = function (code, unknown = false) { return Object.assign(new Error(code), { outcomeUnknown: !!unknown }); };
    var hash = async function (value) {
        var bytes = await env.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
        return Array.from(new Uint8Array(bytes)).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    };
    var dispatched = false;
    var priorPending = false;
    try {
        if (!current()) throw fail('IMPORT_SESSION_CHANGED');
        if (!env.storage) throw fail('IMPORT_CLIENT_STORAGE_HOLD');
        var scopeHash = await hash({ scope: env.scope });
        var inputHash = await hash({ kind: kind, source: payload });
        if (!current()) throw fail('IMPORT_SESSION_CHANGED');
        for (var pendingIndex = 0; pendingIndex < env.storage.length; pendingIndex++) {
            var pendingKey = env.storage.key(pendingIndex);
            if (!pendingKey || pendingKey.indexOf('zoe_sheet_pending_v1_') !== 0) continue;
            var prior;
            try { prior = JSON.parse(env.storage.getItem(pendingKey)); } catch (err) { throw fail('IMPORT_CLIENT_STORAGE_HOLD'); }
            if (!prior || prior.v !== 1 || !prior.intent || ['pending', 'done'].indexOf(prior.state) < 0) throw fail('IMPORT_CLIENT_STORAGE_HOLD');
            if (prior.state === 'pending' && prior.scopeHash === scopeHash && prior.kind === kind && (!prior.inputHash || prior.inputHash === inputHash)) priorPending = true;
        }
        var status = await env.rpc('status');
        if (!current()) throw fail('IMPORT_SESSION_CHANGED');
        if (!status || status.writeProtocol !== 1 || !/^[a-f0-9]{64}$/.test(status.writeScope)) throw fail('IMPORT_UPGRADE_REQUIRED');
        var prefix = 'zoe_sheet_pending_v1_' + await hash({ scope: env.scope, writer: status.writeScope, kind: kind, source: payload }) + '_';
        if (!current()) throw fail('IMPORT_SESSION_CHANGED');
        var pending = [];
        for (var i = 0; i < env.storage.length; i++) {
            var key = env.storage.key(i);
            if (!key || key.indexOf(prefix) !== 0) continue;
            var raw = env.storage.getItem(key), saved;
            try { saved = JSON.parse(raw); } catch (err) { throw fail('IMPORT_CLIENT_STORAGE_HOLD'); }
            if (!saved || saved.v !== 1 || ['pending', 'done'].indexOf(saved.state) < 0 || saved.scopeHash !== scopeHash || saved.kind !== kind || saved.inputHash && saved.inputHash !== inputHash || !saved.intent || typeof saved.intent.id !== 'string' || key !== prefix + saved.intent.id) throw fail('IMPORT_CLIENT_STORAGE_HOLD');
            pending.push({ key: key, raw: raw, saved: saved });
        }
        pending.sort(function (a, b) { return a.saved.intent.preparedAt - b.saved.intent.preparedAt || a.saved.intent.id.localeCompare(b.saved.intent.id); });
        var entry = pending[0];
        if (!entry) {
            var prepared = await env.rpc('prepare', { kind: kind, payload: payload });
            if (!current()) throw fail('IMPORT_SESSION_CHANGED');
            if (!prepared || prepared.protocol !== 1 || !prepared.intent || prepared.intent.kind !== kind || !/^[0-9a-f-]{36}$/i.test(prepared.intent.id)) throw fail('IMPORT_PREPARE_UNREADABLE');
            var created = { v: 1, state: 'pending', scopeHash: scopeHash, inputHash: inputHash, kind: kind, intent: prepared.intent };
            entry = { key: prefix + prepared.intent.id, raw: JSON.stringify(created), saved: created };
            env.storage.setItem(entry.key, entry.raw);
            if (env.storage.getItem(entry.key) !== entry.raw) throw fail('IMPORT_CLIENT_STORAGE_HOLD');
        }
        if (!current()) throw fail('IMPORT_SESSION_CHANGED');
        if (env.storage.getItem(entry.key) !== entry.raw) throw fail('IMPORT_CLIENT_STORAGE_HOLD');
        dispatched = true;
        var result = await env.rpc('execute', { kind: kind, payload: payload, intent: entry.saved.intent });
        if (!responseCurrent()) throw fail('IMPORT_SESSION_CHANGED', true);
        var receipt = result && result.importReceipt;
        if (!receipt || receipt.v !== 1 || receipt.id !== entry.saved.intent.id || receipt.sourceHash !== entry.saved.intent.sourceHash || typeof receipt.revision !== 'string' || typeof receipt.current !== 'boolean' || result.importCurrent !== receipt.current) throw fail('IMPORT_REPLY_UNREADABLE', true);
        if (!receipt.current) {
            var fresh = await env.rpc('status');
            if (!responseCurrent()) throw fail('IMPORT_SESSION_CHANGED', true);
            result.currentStatus = fresh;
        }
        if (env.storage.getItem(entry.key) !== entry.raw) throw fail('IMPORT_CLIENT_STORAGE_HOLD', true);
        entry.saved.state = 'done';
        var completed = JSON.stringify(entry.saved);
        env.storage.setItem(entry.key, completed);
        if (env.storage.getItem(entry.key) !== completed) throw fail('IMPORT_CLIENT_STORAGE_HOLD', true);
        return result;
    } catch (err) {
        if (dispatched || priorPending) err.outcomeUnknown = true;
        var code = err && err.message ? err.message : String(err);
        var text = /^(?:Error: )?ពាក្យសម្ងាត់មិនត្រឹមត្រូវ$/.test(code) ? 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ'
            : !(err && err.outcomeUnknown) && code === 'ឧបករណ៍ក្រៅបណ្ដាញ — សូមភ្ជាប់អ៊ីនធឺណិតជាមុនសិន' ? 'ឧបករណ៍ក្រៅបណ្ដាញ — សូមភ្ជាប់អ៊ីនធឺណិតជាមុនសិន'
            : /STORAGE/.test(code) ? 'មិនអាចរក្សាភស្តុតាងសង្គ្រោះក្នុងឧបករណ៍។ បានផ្អាកការសរសេរ; សូមរក្សាទិន្នន័យ និងពិនិត្យការផ្ទុក។'
            : /STALE|SHEET_CHANGED|TARGET_CHANGED|SOURCE_CHANGED/.test(code) ? 'Sheet ឬឯកសារបានផ្លាស់ប្ដូរក្រោយការពិនិត្យ។ បានផ្អាកប្រតិបត្តិការដើម; សូមផ្ទៀងផ្ទាត់ទិន្នន័យមុនប្រតិបត្តិការថ្មី។'
            : /UPGRADE|INTENT_REQUIRED/.test(code) ? 'Apps Script នាំចូលត្រូវធ្វើបច្ចុប្បន្នភាពជាមួយ App មុនប្រើ។ មិនបានសរសេរទិន្នន័យ។'
            : 'លទ្ធផលប្រតិបត្តិការមុនមិនទាន់អាចផ្ទៀងផ្ទាត់បាន។ បានរក្សាភស្តុតាងដើម និងមិនសរសេរឡើងវិញ; សូមពិនិត្យ Sheet និងឯកសារដើម។';
        throw Object.assign(new Error(text), { code: code, outcomeUnknown: !!(err && err.outcomeUnknown) });
    }
}

async function forgetCompletedSheetWrites_(storage, scope, kind, cryptoApi, current) {
    if (!storage) throw new Error('IMPORT_CLIENT_STORAGE_HOLD');
    var bytes = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ scope: scope })));
    var scopeHash = Array.from(new Uint8Array(bytes)).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    if (current && !current()) throw new Error('IMPORT_SESSION_CHANGED');
    var remove = [];
    for (var i = 0; i < storage.length; i++) {
        var key = storage.key(i);
        if (!key || key.indexOf('zoe_sheet_pending_v1_') !== 0) continue;
        var raw = storage.getItem(key), saved;
        try { saved = JSON.parse(raw); } catch (err) { throw new Error('IMPORT_CLIENT_STORAGE_HOLD'); }
        if (saved && saved.v === 1 && saved.state === 'done' && saved.scopeHash === scopeHash && saved.kind === kind) remove.push({ key: key, raw: raw });
    }
    remove.forEach(function (entry) {
        if (storage.getItem(entry.key) !== entry.raw) throw new Error('IMPORT_CLIENT_STORAGE_HOLD');
        storage.removeItem(entry.key);
        if (storage.getItem(entry.key) !== null) throw new Error('IMPORT_CLIENT_STORAGE_HOLD');
    });
}

function sheetPendingScope_() { return shopScope() + '|' + (firebaseState.auth?.currentUser?.uid || '') + '|' + sheetImportState.sheetImportUrl; }

function runPreparedAppWrite_(kind, payload, current, responseCurrent = current) {
    const url = sheetImportState.sheetImportUrl, password = sheetImportState.sheetImportPassword;
    const scope = sheetPendingScope_();
    return preparedSheetWrite_(kind, payload, { storage: appLocalStore, crypto, scope, current, responseCurrent,
        rpc: (step, body?) => {
            if (step === 'status') return callSheetImportApi('status', {}, url, password);
            if (step === 'prepare') return callSheetImportApi('prepareWrite', { request: { kind: body.kind, payload: body.payload, confirm: 'CLEAR' } }, url, password);
            return body.kind === 'clear' ? callSheetImportApi('clear', { confirm: 'CLEAR', intent: body.intent }, url, password) : callSheetImportApi('import', { payload: { ...body.payload, intent: body.intent } }, url, password);
        } });
}

export async function callSheetImportApi(action, extra, url?, password?) {
    const target = url || sheetImportState.sheetImportUrl;
    const secret = password === undefined ? sheetImportState.sheetImportPassword : password;
    if (!target) throw new Error('មិនទាន់កំណត់ URL ទេ');
    if ((navigator.onLine as boolean) === false) throw new Error('ឧបករណ៍ក្រៅបណ្ដាញ — សូមភ្ជាប់អ៊ីនធឺណិតជាមុនសិន');
    const payload = Object.assign({ action: action, password: secret }, extra || {});
    const writes = action === 'import' || action === 'clear';
    const unknownOutcome = (err) => {
        if (writes) err.outcomeUnknown = true;
        return err;
    };
    let out;
    try {
        out = await fetchWithTimeout(target, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        }, SHEET_IMPORT_TIMEOUT_MS, 'សំណើអស់ពេល — សូមពិនិត្យបណ្តាញ', (r) => r.text());
    } catch (e) {
        const err: any = e instanceof Error ? e : new Error(String(e));
        err.outcomeUnknown = true;
        throw err;
    }
    if (!out.res.ok) throw unknownOutcome(new Error('ម៉ាស៊ីនបម្រើឆ្លើយ ' + out.res.status));
    let parsed;
    try {
        parsed = JSON.parse(out.body);
    } catch (e) {
        throw unknownOutcome(new Error('ចម្លើយមិនមែនជា JSON — សូមពិនិត្យថា Deploy ជា Web app ហើយ «Who has access» ជា Anyone'));
    }
    if (!parsed || typeof parsed !== 'object') throw unknownOutcome(new Error('សំណើបរាជ័យ'));
    sheetWriterVersion = { url: target, version: Number.isFinite(parsed.scriptVersion) ? parsed.scriptVersion : 0 };
    if (!parsed.ok) {
        const refused = new Error(parsed.error || 'សំណើបរាជ័យ');
        throw parsed.written === false ? refused : unknownOutcome(refused);
    }
    if (writes && (!parsed.data || typeof parsed.data !== 'object')) throw unknownOutcome(new Error('ចម្លើយគ្មានលទ្ធផល'));
    return parsed.data;
}

export function setSheetImportFoot(text) {
    viewState.siStatusFoot = text;
}

export function sheetImportStatusText(spreadsheetName, sheetName, rowCount) {
    const head = spreadsheetName ? 'គោលដៅ៖ ' + spreadsheetName + ' ➜ tab «' + sheetName + '»' : 'គោលដៅ៖ tab «' + sheetName + '»';
    return head + ' · មាន ' + rowCount + ' ជួរដេក';
}

let sheetOperationGeneration = 0;

let sheetWriterVersion = { url: '', version: 0 };

export function sheetImportWriterVersion() {
    return sheetWriterVersion.url && sheetWriterVersion.url === sheetImportState.sheetImportUrl ? sheetWriterVersion.version : 0;
}

function captureSheetImportData() {
    const shop = shopScope();
    const authEpoch = firebaseState.authGeneration;
    const tableSession = lookupState.customerDataTableSessionGeneration;
    const tableVersion = lookupState.customerDataTableFetchGeneration;
    return () => {
        if (shopScope() !== shop || firebaseState.authGeneration !== authEpoch) return null;
        return lookupState.customerDataTableSessionGeneration === tableSession && lookupState.customerDataTableFetchGeneration === tableVersion ? 'table' : 'shop';
    };
}

function captureSheetImportOperation() {
    const generation = ++sheetOperationGeneration;
    const shop = shopScope();
    const authEpoch = firebaseState.authGeneration;
    const key = sheetImportState.sheetImportKey;
    const url = sheetImportState.sheetImportUrl;
    const password = sheetImportState.sheetImportPassword;
    return () => generation === sheetOperationGeneration && shopScope() === shop
        && firebaseState.authGeneration === authEpoch && sheetImportState.sheetImportKey === key
        && sheetImportState.sheetImportUrl === url && sheetImportState.sheetImportPassword === password;
}

export async function refreshSheetImportStatus() {
    if (sheetImportState.sheetImportBusy) return null;
    const current = captureSheetImportOperation();
    try {
        const status = await callSheetImportApi('status', {});
        if (!current()) return null;
        setSheetImportFoot(sheetImportStatusText(status.spreadsheetName, status.sheetName, status.rowCount));
        return status;
    } catch (e) {
        if (!current()) return null;
        setSheetImportMsg('siConfigMsg', e.message, 'bad');
        return null;
    }
}

let sheetConfigOwner: object | null = null;

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
    const owner = {};
    sheetConfigOwner = owner;
    const operationCurrent = captureSheetImportOperation();
    const shop = shopScope();
    const authEpoch = firebaseState.authGeneration;
    const key = sheetImportState.sheetImportKey;
    const current = () => sheetConfigOwner === owner && operationCurrent() && shopScope() === shop
        && firebaseState.authGeneration === authEpoch && sheetImportState.sheetImportKey === key;
    sheetImportState.sheetImportBusy = true;
    viewState.siConfigSaving = true;
    setSheetImportMsg('siConfigMsg', 'កំពុងសាកល្បងការតភ្ជាប់...', 'warn');
    try {
        const status = await callSheetImportApi('status', {}, url, password);
        if (!current()) return;
        const stored: any = { v: 1, u: await encryptSheetImportSecret(url), p: await encryptSheetImportSecret(password) };
        if (!current()) return;
        if (shop) stored.shop = shop;
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
        if (!current()) return;
        setSheetImportMsg('siConfigMsg', e.message, 'bad');
    } finally {
        if (sheetConfigOwner === owner) {
            sheetConfigOwner = null;
            viewState.siConfigSaving = false;
            sheetImportState.sheetImportBusy = false;
        }
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

let sheetFileGeneration = 0;

export async function handleSheetImportFile(file) {
    if (!file) return;
    const incomingFileGeneration = ++sheetFileGeneration, incomingScope = sheetPendingScope_();
    try { await forgetCompletedSheetWrites_(appLocalStore, incomingScope, 'import', crypto, () => incomingFileGeneration === sheetFileGeneration && incomingScope === sheetPendingScope_()); } catch (err) { if (incomingFileGeneration !== sheetFileGeneration || incomingScope !== sheetPendingScope_()) return; setSheetImportMsg('siFileMsg', 'មិនអាចពិនិត្យភស្តុតាងសង្គ្រោះក្នុងឧបករណ៍; បានផ្អាកការនាំចូល។', 'bad'); return; }
    if (incomingFileGeneration !== sheetFileGeneration || incomingScope !== sheetPendingScope_()) return;
    const generation = incomingFileGeneration;
    resetSheetImportFileSelection();
    setSheetImportMsg('siFileMsg', 'កំពុងអានឯកសារ...', 'warn');
    let buffer;
    try {
        await loadScriptOnce('xlsx');
        buffer = await readSheetImportFileBuffer(file);
    } catch (e) {
        if (generation !== sheetFileGeneration) return;
        setSheetImportMsg('siFileMsg', 'អានឯកសារមិនបានទេ៖ ' + sheetImportLibFailureMessage(e), 'bad');
        return;
    }
    if (generation !== sheetFileGeneration) return;
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

let sheetPrepareGeneration = 0;

let sheetPreparePending = false;

export async function applySheetImportHeaderRow() {
    const generation = ++sheetPrepareGeneration;
    sheetPreparePending = true;
    viewState.siImportBtnDisabled = true;
    showSheetImportPart('siPreviewWrap', false);
    const index = sheetImportHeaderRowNumber() - 1;
    sheetImportState.sheetImportSignature = '';
    sheetImportState.sheetImportHeaders = (sheetImportState.sheetImportSheetRows[index] || []).map(sheetImportCellToText);
    if (!sheetImportState.sheetImportHeaders.length) {
        sheetPreparePending = false;
        applySheetImportMapping(null);
        setSheetImportMsg('siMapMsg', 'ជួរដេកនេះទទេ — សូមប្តូរលេខជួរដេក header', 'bad');
        return;
    }
    fillSheetImportMappingSelects();
    setSheetImportMsg('siMapMsg', 'កំពុងរកការផ្គូផ្គង...', 'warn');
    try {
        const prepared = await callSheetImportApi('prepare', { headers: sheetImportState.sheetImportHeaders });
        if (generation !== sheetPrepareGeneration) return;
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
        if (generation !== sheetPrepareGeneration) return;
        setSheetImportMsg('siMapMsg', e.message, 'bad');
    }
    sheetPreparePending = false;
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
        mapping[id] = { options: options, value: '-1', filled: true };
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
    viewState.siImportBtnDisabled = usable.length === 0 || sheetPreparePending;
}

export async function runSheetImport() {
    if (sheetImportState.sheetImportBusy) return;
    if (sheetPreparePending) {
        setSheetImportMsg('siActionMsg', SHEET_IMPORT_PREPARE_PENDING_TEXT, 'warn');
        return;
    }
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
    const mapping: any = currentSheetImportMapping();
    const unmapped = mode === 'upsert' ? SHEET_IMPORT_VALUE_FIELDS.filter((field) => mapping[field] < 0) : [];
    if (unmapped.length && sheetImportWriterVersion() < SHEET_IMPORT_KEEP_UNMAPPED_VERSION) {
        setSheetImportMsg('siActionMsg', SHEET_IMPORT_UPSERT_UNMAPPED_TEXT, 'bad');
        return;
    }
    const keep = unmapped.length ? { dod: mapping.dod < 0, cod: mapping.cod < 0, phone: mapping.phone < 0 } : null;
    if (mode === 'replace' && !confirm('ជួរដេកទាំងអស់ក្នុង Sheet នឹងត្រូវលុប រួចជំនួសដោយ ' + rows.length + ' ជួរដេកពីឯកសារនេះ។ តើបន្តទេ?')) return;
    const owner = {};
    sheetConfigOwner = owner;
    const current = captureSheetImportOperation();
    const dataCurrent = captureSheetImportData();
    sheetImportState.sheetImportBusy = true;
    viewState.siImportBtnDisabled = true;
    viewState.siImportBtnText = 'កំពុងនាំចូល...';
    setSheetImportMsg('siActionMsg', '');
    try {
        const result = await runPreparedAppWrite_('import', { rows, mode, mapping, signature: sheetImportState.sheetImportSignature }, current, dataCurrent);
        const data = dataCurrent();
        if (!data) return;
        if (!result.importCurrent) {
            clearCustomerDataTableCache();
            scheduleCustomerTableSoonRefresh(true);
            if (current()) {
                setSheetImportMsg('siActionMsg', 'ប្រតិបត្តិការមុនបានបញ្ជាក់។ Sheet មានការកែថ្មីជាងនេះ; បានទាញទិន្នន័យបច្ចុប្បន្នឡើងវិញ។', 'warn');
                if (result.currentStatus) setSheetImportFoot(sheetImportStatusText('', result.currentStatus.sheetName, result.currentStatus.rowCount));
            }
            return;
        }
        if (result.replayed || !result.importCurrent || data !== 'table' || !seedCustomerTableFromImport(rows, mode, result.rowsAfter, { added: result.added, keep: keep })) clearCustomerDataTableCache();
        scheduleCustomerTableSoonRefresh(true);
        showToast('✅ នាំចូលរួចរាល់ — ' + result.rowsAfter + ' ជួរដេកក្នុង Sheet');
        if (!current()) return;
        const parts = ['✅ រួចរាល់ — បន្ថែម ' + result.added, 'កែ ' + result.updated, 'ដដែល ' + result.unchanged];
        if (result.skippedNoBarcode) parts.push('រំលង ' + result.skippedNoBarcode);
        if (result.duplicatesInFile) parts.push('ស្ទួនក្នុងឯកសារ ' + result.duplicatesInFile);
        parts.push('សរុបក្នុង Sheet ' + result.rowsAfter + ' ជួរដេក');
        setSheetImportMsg('siActionMsg', parts.join(' · '), 'ok');
        setSheetImportFoot(sheetImportStatusText('', result.sheetName, result.rowsAfter));
    } catch (e) {
        if (!dataCurrent()) return;
        const text = e && e.message ? e.message : String(e);
        if (e && e.outcomeUnknown) {
            clearCustomerDataTableCache();
            scheduleCustomerTableSoonRefresh(true);
            showToast('⏳ នាំចូល ៖ ' + SHEET_IMPORT_UNKNOWN_TEXT);
            if (current()) setSheetImportMsg('siActionMsg', '⏳ ' + text + ' — ' + SHEET_IMPORT_UNKNOWN_TEXT, 'warn');
            return;
        }
        showToast('❌ នាំចូលមិនបានទេ! ' + text);
        if (current()) setSheetImportMsg('siActionMsg', text, 'bad');
    } finally {
        if (sheetConfigOwner === owner) {
            sheetConfigOwner = null;
            viewState.siImportBtnDisabled = sheetPreparePending;
            viewState.siImportBtnText = 'នាំចូលទៅ Sheet';
            sheetImportState.sheetImportBusy = false;
        }
    }
}

export async function runSheetImportClear() {
    if (sheetImportState.sheetImportBusy) return;
    if (!confirm('ជួរដេកទាំងអស់ក្នុង tab គោលដៅនឹងត្រូវលុប ដោយទុកតែជួរ header។ សកម្មភាពនេះមិនអាចដកវិញបានទេ។ តើបន្តទេ?')) return;
    const owner = {};
    sheetConfigOwner = owner;
    const current = captureSheetImportOperation();
    const dataCurrent = captureSheetImportData();
    sheetImportState.sheetImportBusy = true;
    viewState.siClearBtnBusy = true;
    setSheetImportMsg('siClearMsg', '');
    try {
        await forgetCompletedSheetWrites_(appLocalStore, sheetPendingScope_(), 'clear', crypto, current);
        const result = await runPreparedAppWrite_('clear', {}, current, dataCurrent);
        if (!dataCurrent()) return;
        clearCustomerDataTableCache();
        scheduleCustomerTableSoonRefresh(true);
        if (!result.importCurrent) {
            clearCustomerDataTableCache();
            scheduleCustomerTableSoonRefresh(true);
            if (current()) {
                setSheetImportMsg('siClearMsg', 'ប្រតិបត្តិការមុនបានបញ្ជាក់។ Sheet មានការកែថ្មីជាងនេះ; បានទាញទិន្នន័យបច្ចុប្បន្នឡើងវិញ។', 'warn');
                if (result.currentStatus) setSheetImportFoot(sheetImportStatusText('', result.currentStatus.sheetName, result.currentStatus.rowCount));
            }
            return;
        }
        showToast('✅ សម្អាតរួចរាល់ — លុប ' + result.removed + ' ជួរដេក');
        if (!current()) return;
        setSheetImportMsg('siClearMsg', '✅ សម្អាតរួចរាល់ — លុប ' + result.removed + ' ជួរដេក', 'ok');
        setSheetImportFoot(sheetImportStatusText('', result.sheetName, result.rowsAfter));
    } catch (e) {
        if (!dataCurrent()) return;
        const text = e && e.message ? e.message : String(e);
        if (e && e.outcomeUnknown) {
            clearCustomerDataTableCache();
            scheduleCustomerTableSoonRefresh(true);
            showToast('⏳ សម្អាត ៖ ' + SHEET_IMPORT_UNKNOWN_TEXT);
            if (current()) setSheetImportMsg('siClearMsg', '⏳ ' + text + ' — ' + SHEET_IMPORT_UNKNOWN_TEXT, 'warn');
            return;
        }
        showToast('❌ សម្អាតមិនបានទេ! ' + text);
        if (current()) setSheetImportMsg('siClearMsg', text, 'bad');
    } finally {
        if (sheetConfigOwner === owner) {
            sheetConfigOwner = null;
            viewState.siClearBtnBusy = false;
            sheetImportState.sheetImportBusy = false;
        }
    }
}

export function resetSheetImportFileSelection() {
    sheetPrepareGeneration++;
    sheetPreparePending = false;
    viewState.siImportBtnDisabled = true;
    applySheetImportMapping(null);
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

