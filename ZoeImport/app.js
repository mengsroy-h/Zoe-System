const APP_VERSION = '1.1.0';

const STORE_PIN_HASH = 'zoeimport_pin_hash';
const STORE_PIN_FAILS = 'zoeimport_pin_fail_count';
const STORE_PIN_LOCK = 'zoeimport_pin_lockout_until';
const STORE_CONFIG = 'zoeimport_config';

const PIN_SALT = 'zoeimport_pin_verify_v1';
const CONFIG_SALT = 'zoeimport_config_secret_v1';
const PBKDF2_ITERATIONS = 150000;
const PIN_MIN_LENGTH = 4;
const PIN_MAX_FAILS = 5;
const PIN_LOCKOUT_MS = 60000;

const REQUEST_TIMEOUT_MS = 30000;
const MAX_IMPORT_ROWS = 20000;
const PREVIEW_ROWS = 8;
const HEADER_SCAN_ROWS = 12;

const FIELD_SELECT_IDS = { barcode: 'mapBarcode', dod: 'mapDod', cod: 'mapCod', phone: 'mapPhone' };

let configKey = null;
let apiUrl = '';
let apiPassword = '';
let workbook = null;
let sheetRows = [];
let sheetHeaders = [];
let mappingSignature = '';
let isBusy = false;
let confirmResolver = null;

function $(id) {
    return document.getElementById(id);
}

function safeStoreGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (err) {
        return null;
    }
}

function safeStoreSet(key, value) {
    try {
        localStorage.setItem(key, String(value));
        return true;
    } catch (err) {
        return false;
    }
}

function safeStoreRemove(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (err) {
        return false;
    }
}

function show(id, on) {
    const el = $(id);
    if (el) el.classList.toggle('hidden', !on);
}

function setMsg(hostId, text, kind) {
    const host = $(hostId);
    if (!host) return;
    host.textContent = '';
    if (!text) return;
    const box = document.createElement('div');
    box.className = 'msg ' + (kind || 'warn');
    box.textContent = text;
    host.appendChild(box);
}

let toastTimer = null;

function toast(text, kind) {
    const el = $('toast');
    if (!el) return;
    el.textContent = text;
    el.className = 'toast ' + (kind || 'ok');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3600);
}

function bytesToHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin) {
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(PIN_SALT), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        material,
        256
    );
    return 'pbkdf2:' + bytesToHex(bits);
}

async function derivePinKey(pin) {
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode(CONFIG_SALT), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptWithKey(key, plainText) {
    if (!key || !plainText) return null;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plainText));
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(cipher)) };
}

async function decryptWithKey(key, box) {
    if (!key || !box || !Array.isArray(box.iv) || !Array.isArray(box.data)) return '';
    try {
        const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(box.iv) },
            key,
            new Uint8Array(box.data)
        );
        return new TextDecoder().decode(plain);
    } catch (err) {
        return '';
    }
}

function readStoredConfig() {
    const raw = safeStoreGet(STORE_CONFIG);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && parsed.u && parsed.p ? parsed : null;
    } catch (err) {
        return null;
    }
}

function hasStoredConfig() {
    return !!readStoredConfig();
}

function maskUrl(url) {
    try {
        const parsed = new URL(url);
        const parts = parsed.pathname.split('/').filter(Boolean);
        const id = parts.length >= 3 ? parts[2] : '';
        const shortId = id.length > 10 ? id.slice(0, 6) + '…' + id.slice(-4) : id;
        return parsed.host + '/…/' + shortId + '/exec';
    } catch (err) {
        return 'URL មិនត្រឹមត្រូវ';
    }
}

function lockoutSecondsLeft() {
    const until = parseInt(safeStoreGet(STORE_PIN_LOCK) || '0', 10) || 0;
    if (!until || Date.now() >= until) return 0;
    return Math.ceil((until - Date.now()) / 1000);
}

function registerPinFailure() {
    const fails = (parseInt(safeStoreGet(STORE_PIN_FAILS) || '0', 10) || 0) + 1;
    if (fails >= PIN_MAX_FAILS) {
        safeStoreSet(STORE_PIN_LOCK, String(Date.now() + PIN_LOCKOUT_MS));
        safeStoreSet(STORE_PIN_FAILS, '0');
        return 0;
    }
    safeStoreSet(STORE_PIN_FAILS, String(fails));
    return PIN_MAX_FAILS - fails;
}

function clearPinFailures() {
    safeStoreRemove(STORE_PIN_FAILS);
    safeStoreRemove(STORE_PIN_LOCK);
}

function clearSensitiveFields() {
    ['pinInput', 'pinNewInput', 'pinConfirmInput', 'apiUrlInput', 'apiPasswordInput'].forEach((id) => {
        const el = $(id);
        if (el) el.value = '';
    });
    const fileInput = $('fileInput');
    if (fileInput) fileInput.value = '';
    ['previewBody', 'chips', 'configSummary'].forEach((id) => {
        const el = $(id);
        if (el) el.textContent = '';
    });
    ['pinMsg', 'configMsg', 'fileMsg', 'mapMsg', 'actionMsg', 'clearMsg'].forEach((id) => setMsg(id, ''));
    const foot = $('statusFoot');
    if (foot) foot.textContent = '';
    Object.keys(FIELD_SELECT_IDS).forEach((field) => {
        const sel = $(FIELD_SELECT_IDS[field]);
        if (sel) sel.textContent = '';
    });
    const sheetSel = $('sheetSel');
    if (sheetSel) sheetSel.textContent = '';
}

function resetSessionState() {
    configKey = null;
    apiUrl = '';
    apiPassword = '';
    workbook = null;
    sheetRows = [];
    sheetHeaders = [];
    mappingSignature = '';
    clearSensitiveFields();
}

function lockApp() {
    resetSessionState();
    show('appMain', false);
    show('lockBtn', false);
    show('fileCard', false);
    show('mapCard', false);
    show('actionCard', false);
    show('previewWrap', false);
    show('pinGate', true);
    showPinBox();
}

function showPinBox() {
    const hasPin = !!safeStoreGet(STORE_PIN_HASH);
    show('pinSetupBox', !hasPin);
    show('pinVerifyBox', hasPin);
    const focusTarget = hasPin ? $('pinInput') : $('pinNewInput');
    if (focusTarget) focusTarget.focus();
}

async function setupPin() {
    if (isBusy) return;
    const pin = $('pinNewInput').value.trim();
    const confirmPin = $('pinConfirmInput').value.trim();
    if (pin.length < PIN_MIN_LENGTH) {
        setMsg('pinMsg', 'PIN ត្រូវមានយ៉ាងតិច ' + PIN_MIN_LENGTH + ' ខ្ទង់', 'bad');
        return;
    }
    if (pin !== confirmPin) {
        setMsg('pinMsg', 'PIN ទាំង ២ មិនដូចគ្នាទេ', 'bad');
        return;
    }
    isBusy = true;
    try {
        const hash = await hashPin(pin);
        if (!safeStoreSet(STORE_PIN_HASH, hash)) {
            setMsg('pinMsg', 'រក្សាទុក PIN មិនបាន — សូមពិនិត្យការកំណត់ browser', 'bad');
            return;
        }
        clearPinFailures();
        configKey = await derivePinKey(pin);
        $('pinNewInput').value = '';
        $('pinConfirmInput').value = '';
        setMsg('pinMsg', '');
        await enterApp();
    } catch (err) {
        setMsg('pinMsg', 'កំណត់ PIN មិនបាន — ត្រូវប្រើ HTTPS', 'bad');
    } finally {
        isBusy = false;
    }
}

async function verifyPin() {
    if (isBusy) return;
    const waitLeft = lockoutSecondsLeft();
    if (waitLeft > 0) {
        setMsg('pinMsg', 'វាយខុសច្រើនដងពេក — សូមរង់ចាំ ' + waitLeft + ' វិនាទី', 'bad');
        return;
    }
    const pin = $('pinInput').value.trim();
    $('pinInput').value = '';
    if (!pin) {
        setMsg('pinMsg', 'សូមវាយលេខកូដ PIN', 'bad');
        return;
    }
    isBusy = true;
    try {
        const saved = safeStoreGet(STORE_PIN_HASH);
        const entered = await hashPin(pin);
        if (!saved || entered !== saved) {
            const left = registerPinFailure();
            setMsg('pinMsg', left > 0
                ? 'លេខ PIN មិនត្រឹមត្រូវ — សល់ ' + left + ' ដងទៀត'
                : 'វាយខុសច្រើនដងពេក — ត្រូវរង់ចាំ ១ នាទី', 'bad');
            return;
        }
        clearPinFailures();
        configKey = await derivePinKey(pin);
        setMsg('pinMsg', '');
        await enterApp();
    } catch (err) {
        setMsg('pinMsg', 'ផ្ទៀងផ្ទាត់ PIN មិនបាន — ត្រូវប្រើ HTTPS', 'bad');
    } finally {
        isBusy = false;
    }
}

async function changePin() {
    const current = window.prompt('វាយ PIN ថ្មី (យ៉ាងតិច ' + PIN_MIN_LENGTH + ' ខ្ទង់)');
    if (current === null) return;
    const pin = current.trim();
    if (pin.length < PIN_MIN_LENGTH) {
        toast('PIN ខ្លីពេក', 'bad');
        return;
    }
    const again = window.prompt('វាយ PIN ថ្មីម្តងទៀត');
    if (again === null) return;
    if (again.trim() !== pin) {
        toast('PIN ទាំង ២ មិនដូចគ្នាទេ', 'bad');
        return;
    }
    try {
        const newKey = await derivePinKey(pin);
        if (apiUrl && apiPassword) {
            const stored = {
                v: 1,
                u: await encryptWithKey(newKey, apiUrl),
                p: await encryptWithKey(newKey, apiPassword)
            };
            if (!safeStoreSet(STORE_CONFIG, JSON.stringify(stored))) {
                toast('រក្សាទុកមិនបាន', 'bad');
                return;
            }
        }
        safeStoreSet(STORE_PIN_HASH, await hashPin(pin));
        clearPinFailures();
        configKey = newKey;
        toast('ប្តូរ PIN រួចរាល់', 'ok');
    } catch (err) {
        toast('ប្តូរ PIN មិនបាន', 'bad');
    }
}

async function forgetEverything() {
    const yes = await askConfirm('កំណត់ឡើងវិញទាំងស្រុង',
        'នេះនឹងលុប PIN និងការតភ្ជាប់ដែលរក្សាទុកលើឧបករណ៍នេះ។ ទិន្នន័យក្នុង Google Sheet មិនរងផលទេ។');
    if (!yes) return;
    safeStoreRemove(STORE_PIN_HASH);
    safeStoreRemove(STORE_CONFIG);
    clearPinFailures();
    resetSessionState();
    showPinBox();
    toast('លុបការកំណត់រួចរាល់', 'ok');
}

async function enterApp() {
    show('pinGate', false);
    show('appMain', true);
    show('lockBtn', true);
    const stored = readStoredConfig();
    if (!stored) {
        showConfigForm(true);
        return;
    }
    const url = await decryptWithKey(configKey, stored.u);
    const password = await decryptWithKey(configKey, stored.p);
    if (!url || !password) {
        setMsg('configMsg', 'ស្រាយការតភ្ជាប់មិនបាន — សូមកំណត់ម្តងទៀត', 'bad');
        showConfigForm(true);
        return;
    }
    apiUrl = url;
    apiPassword = password;
    showConfigForm(false);
    await refreshStatus();
}

function showConfigForm(editing) {
    show('configForm', editing);
    show('configSummary', !editing);
    show('configEditBtn', !editing);
    show('fileCard', !editing);
    show('clearCard', !editing);
    if (!editing) {
        const summary = $('configSummary');
        summary.textContent = '';
        const line = document.createElement('div');
        line.className = 'summary-line';
        line.textContent = '🔗 ' + maskUrl(apiUrl);
        const note = document.createElement('div');
        note.className = 'summary-note';
        note.textContent = 'URL និងពាក្យសម្ងាត់ត្រូវអ៊ិនគ្រីបដោយកូនសោដែលបង្កើតពី PIN';
        summary.appendChild(line);
        summary.appendChild(note);
        const editBtn = $('configEditBtn');
        if (editBtn) editBtn.classList.remove('hidden');
    }
}

async function fetchWithTimeout(url, options, timeoutMs, timeoutMessage) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
        const body = await res.text();
        return { res, body };
    } catch (err) {
        if (err && err.name === 'AbortError') throw new Error(timeoutMessage);
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

async function callApi(action, extra, url, password) {
    const target = url || apiUrl;
    const secret = password === undefined ? apiPassword : password;
    if (!target) throw new Error('មិនទាន់កំណត់ URL ទេ');
    const payload = Object.assign({ action: action, password: secret }, extra || {});
    const out = await fetchWithTimeout(target, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
    }, REQUEST_TIMEOUT_MS, 'សំណើអស់ពេល — សូមពិនិត្យបណ្តាញ');
    if (!out.res.ok) throw new Error('ម៉ាស៊ីនបម្រើឆ្លើយ ' + out.res.status);
    let parsed;
    try {
        parsed = JSON.parse(out.body);
    } catch (err) {
        throw new Error('ចម្លើយមិនមែនជា JSON — សូមពិនិត្យថា Deploy ជា Web app ហើយ «Who has access» ជា Anyone');
    }
    if (!parsed.ok) throw new Error(parsed.error || 'សំណើបរាជ័យ');
    return parsed.data;
}

async function refreshStatus() {
    try {
        const status = await callApi('status', {});
        const foot = $('statusFoot');
        if (foot) {
            foot.textContent = 'គោលដៅ៖ ' + status.spreadsheetName + ' ➜ tab «' + status.sheetName +
                '» · មាន ' + status.rowCount + ' ជួរដេក';
        }
        return status;
    } catch (err) {
        setMsg('configMsg', err.message, 'bad');
        return null;
    }
}

async function saveConfig() {
    if (isBusy) return;
    const url = $('apiUrlInput').value.trim();
    const password = $('apiPasswordInput').value.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(url)) {
        setMsg('configMsg', 'URL ត្រូវជា Web app URL របស់ Apps Script ដែលបញ្ចប់ដោយ /exec', 'bad');
        return;
    }
    if (!password) {
        setMsg('configMsg', 'សូមបញ្ចូលពាក្យសម្ងាត់នាំចូល', 'bad');
        return;
    }
    isBusy = true;
    setMsg('configMsg', 'កំពុងសាកល្បងការតភ្ជាប់...', 'warn');
    $('configSaveBtn').disabled = true;
    try {
        const status = await callApi('status', {}, url, password);
        const stored = {
            v: 1,
            u: await encryptWithKey(configKey, url),
            p: await encryptWithKey(configKey, password)
        };
        if (!stored.u || !stored.p || !safeStoreSet(STORE_CONFIG, JSON.stringify(stored))) {
            setMsg('configMsg', 'រក្សាទុកមិនបាន — សូមពិនិត្យទំហំផ្ទុករបស់ browser', 'bad');
            return;
        }
        apiUrl = url;
        apiPassword = password;
        $('apiUrlInput').value = '';
        $('apiPasswordInput').value = '';
        setMsg('configMsg', '');
        showConfigForm(false);
        const foot = $('statusFoot');
        if (foot) {
            foot.textContent = 'គោលដៅ៖ ' + status.spreadsheetName + ' ➜ tab «' + status.sheetName +
                '» · មាន ' + status.rowCount + ' ជួរដេក';
        }
        toast('ការតភ្ជាប់ត្រឹមត្រូវ', 'ok');
    } catch (err) {
        setMsg('configMsg', err.message, 'bad');
    } finally {
        $('configSaveBtn').disabled = false;
        isBusy = false;
    }
}

function cellToText(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return '';
    if (typeof value === 'number') return isFinite(value) ? String(value) : '';
    return String(value).trim();
}

function toMoney(value) {
    if (value === null || value === undefined || value === '') return 0;
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
    if (!isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
}

function columnLetter(index) {
    let letter = '';
    let n = index;
    while (n >= 0) {
        letter = String.fromCharCode(65 + (n % 26)) + letter;
        n = Math.floor(n / 26) - 1;
    }
    return letter;
}

function handleFile(file) {
    if (!file) return;
    setMsg('fileMsg', 'កំពុងអានឯកសារ...', 'warn');
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            workbook = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
            const names = workbook.SheetNames || [];
            if (!names.length) throw new Error('ឯកសារនេះគ្មាន tab ទេ');
            const sel = $('sheetSel');
            sel.textContent = '';
            names.forEach((name) => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                sel.appendChild(opt);
            });
            setMsg('fileMsg', 'អាន «' + file.name + '» រួចរាល់', 'ok');
            show('mapCard', true);
            show('actionCard', true);
            loadSelectedSheet();
        } catch (err) {
            setMsg('fileMsg', 'អានឯកសារមិនបាន៖ ' + (err && err.message ? err.message : err), 'bad');
        }
    };
    reader.onerror = () => setMsg('fileMsg', 'អានឯកសារមិនបាន', 'bad');
    reader.readAsArrayBuffer(file);
}

function loadSelectedSheet() {
    const ws = workbook.Sheets[$('sheetSel').value];
    sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: false });
    let headerIndex = 0;
    for (let i = 0; i < Math.min(sheetRows.length, HEADER_SCAN_ROWS); i++) {
        const filled = (sheetRows[i] || []).filter((v) => cellToText(v) !== '');
        if (filled.length >= 2) {
            headerIndex = i;
            break;
        }
    }
    $('headerRowInput').value = String(headerIndex + 1);
    applyHeaderRow();
}

async function applyHeaderRow() {
    let index = parseInt($('headerRowInput').value, 10) - 1;
    if (isNaN(index) || index < 0) index = 0;
    sheetHeaders = (sheetRows[index] || []).map(cellToText);
    if (!sheetHeaders.length) {
        setMsg('mapMsg', 'ជួរដេកនេះទទេ — សូមប្តូរលេខជួរដេក header', 'bad');
        return;
    }
    fillMappingSelects();
    setMsg('mapMsg', 'កំពុងរកការផ្គូផ្គង...', 'warn');
    try {
        const prepared = await callApi('prepare', { headers: sheetHeaders });
        mappingSignature = prepared.signature;
        applyMapping(prepared.mapping);
        if (prepared.source === 'saved') {
            if (prepared.mode) $('modeSel').value = prepared.mode;
            setMsg('mapMsg', '✅ ប្រើការផ្គូផ្គងដែលរក្សាទុកពីលើកមុន', 'ok');
        } else if (prepared.source === 'auto') {
            setMsg('mapMsg', '✅ រកឃើញ Column ដោយស្វ័យប្រវត្តិ', 'ok');
        } else {
            setMsg('mapMsg', 'រកមិនឃើញ Column ដោយស្វ័យប្រវត្តិទេ — សូមជ្រើសដោយដៃ', 'warn');
        }
    } catch (err) {
        setMsg('mapMsg', err.message, 'bad');
    }
    renderPreview();
}

function fillMappingSelects() {
    Object.keys(FIELD_SELECT_IDS).forEach((field) => {
        const sel = $(FIELD_SELECT_IDS[field]);
        const previous = sel.value;
        sel.textContent = '';
        const none = document.createElement('option');
        none.value = '-1';
        none.textContent = '— មិនប្រើ —';
        sel.appendChild(none);
        sheetHeaders.forEach((header, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx);
            opt.textContent = columnLetter(idx) + ' · ' + (header || '(ទទេ)');
            sel.appendChild(opt);
        });
        if (previous) sel.value = previous;
    });
}

function applyMapping(mapping) {
    Object.keys(FIELD_SELECT_IDS).forEach((field) => {
        const value = mapping && typeof mapping[field] === 'number' ? mapping[field] : -1;
        $(FIELD_SELECT_IDS[field]).value = String(value);
    });
}

function currentMapping() {
    const mapping = {};
    Object.keys(FIELD_SELECT_IDS).forEach((field) => {
        const parsed = parseInt($(FIELD_SELECT_IDS[field]).value, 10);
        mapping[field] = isNaN(parsed) ? -1 : parsed;
    });
    return mapping;
}

function mappedRows() {
    const mapping = currentMapping();
    let start = parseInt($('headerRowInput').value, 10);
    if (isNaN(start) || start < 1) start = 1;
    const out = [];
    for (let i = start; i < sheetRows.length; i++) {
        const row = sheetRows[i] || [];
        out.push([
            mapping.barcode >= 0 ? cellToText(row[mapping.barcode]) : '',
            mapping.dod >= 0 ? toMoney(row[mapping.dod]) : 0,
            mapping.cod >= 0 ? toMoney(row[mapping.cod]) : 0,
            mapping.phone >= 0 ? cellToText(row[mapping.phone]) : ''
        ]);
    }
    return out;
}

function addChip(host, text, kind) {
    const chip = document.createElement('span');
    chip.className = 'chip ' + (kind || '');
    chip.textContent = text;
    host.appendChild(chip);
}

function renderPreview() {
    const rows = mappedRows();
    const usable = rows.filter((r) => r[0] !== '');
    const seen = Object.create(null);
    let duplicates = 0;
    usable.forEach((r) => {
        const key = r[0].toUpperCase();
        if (seen[key]) duplicates++;
        seen[key] = true;
    });
    const chips = $('chips');
    chips.textContent = '';
    addChip(chips, 'ជួរដេកក្នុងឯកសារ ' + rows.length, '');
    addChip(chips, 'មាន Barcode ' + usable.length, usable.length ? 'ok' : 'bad');
    if (rows.length - usable.length > 0) addChip(chips, 'រំលង ' + (rows.length - usable.length), 'warn');
    if (duplicates) addChip(chips, 'ស្ទួនក្នុងឯកសារ ' + duplicates, 'warn');

    const body = $('previewBody');
    body.textContent = '';
    usable.slice(0, PREVIEW_ROWS).forEach((r) => {
        const tr = document.createElement('tr');
        [r[0], r[1].toFixed(2), r[2].toFixed(2), r[3]].forEach((value, idx) => {
            const td = document.createElement('td');
            if (idx === 1 || idx === 2) td.className = 'num';
            td.textContent = value;
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });
    show('previewWrap', usable.length > 0);
    $('importBtn').disabled = usable.length === 0;
}

function askConfirm(title, text) {
    return new Promise((resolve) => {
        $('confirmTitle').textContent = title;
        $('confirmText').textContent = text;
        show('confirmModal', true);
        confirmResolver = resolve;
    });
}

function settleConfirm(answer) {
    show('confirmModal', false);
    const resolver = confirmResolver;
    confirmResolver = null;
    if (resolver) resolver(answer);
}

async function runImport() {
    if (isBusy) return;
    const rows = mappedRows().filter((r) => r[0] !== '');
    if (!rows.length) {
        setMsg('actionMsg', 'គ្មានជួរដេកត្រូវនាំចូលទេ', 'bad');
        return;
    }
    if (rows.length > MAX_IMPORT_ROWS) {
        setMsg('actionMsg', 'ឯកសារនេះមាន ' + rows.length + ' ជួរដេក ច្រើនជាងកម្រិត ' + MAX_IMPORT_ROWS, 'bad');
        return;
    }
    const mode = $('modeSel').value;
    if (mode === 'replace') {
        const yes = await askConfirm('សម្អាតរួចដាក់ថ្មីជំនួស',
            'ជួរដេកទាំងអស់ក្នុង Sheet នឹងត្រូវលុប រួចជំនួសដោយ ' + rows.length + ' ជួរដេកពីឯកសារនេះ។');
        if (!yes) return;
    }
    isBusy = true;
    $('importBtn').disabled = true;
    $('importBtn').textContent = 'កំពុងនាំចូល...';
    setMsg('actionMsg', '');
    try {
        const result = await callApi('import', {
            payload: { rows: rows, mode: mode, mapping: currentMapping(), signature: mappingSignature }
        });
        const parts = ['✅ រួចរាល់ — បន្ថែម ' + result.added, 'កែ ' + result.updated, 'ដដែល ' + result.unchanged];
        if (result.skippedNoBarcode) parts.push('រំលង ' + result.skippedNoBarcode);
        if (result.duplicatesInFile) parts.push('ស្ទួនក្នុងឯកសារ ' + result.duplicatesInFile);
        parts.push('សរុបក្នុង Sheet ' + result.rowsAfter + ' ជួរដេក');
        setMsg('actionMsg', parts.join(' · '), 'ok');
        const foot = $('statusFoot');
        if (foot) foot.textContent = 'គោលដៅ៖ tab «' + result.sheetName + '» · មាន ' + result.rowsAfter + ' ជួរដេក';
        toast('នាំចូលរួចរាល់', 'ok');
    } catch (err) {
        setMsg('actionMsg', err.message, 'bad');
    } finally {
        $('importBtn').disabled = false;
        $('importBtn').textContent = 'នាំចូលទៅ Sheet';
        isBusy = false;
    }
}

async function runClear() {
    if (isBusy) return;
    const yes = await askConfirm('សម្អាតទិន្នន័យក្នុង Sheet',
        'ជួរដេកទាំងអស់ក្នុង tab គោលដៅនឹងត្រូវលុប ដោយទុកតែជួរ header។ សកម្មភាពនេះមិនអាចដកវិញបានទេ។');
    if (!yes) return;
    isBusy = true;
    $('clearBtn').disabled = true;
    $('clearBtn').textContent = 'កំពុងសម្អាត...';
    setMsg('clearMsg', '');
    try {
        const result = await callApi('clear', { confirm: 'CLEAR' });
        setMsg('clearMsg', '✅ សម្អាតរួចរាល់ — លុប ' + result.removed + ' ជួរដេក', 'ok');
        const foot = $('statusFoot');
        if (foot) foot.textContent = 'គោលដៅ៖ tab «' + result.sheetName + '» · មាន ' + result.rowsAfter + ' ជួរដេក';
        toast('សម្អាតរួចរាល់', 'ok');
    } catch (err) {
        setMsg('clearMsg', err.message, 'bad');
    } finally {
        $('clearBtn').disabled = false;
        $('clearBtn').textContent = 'សម្អាតទិន្នន័យក្នុង Sheet';
        isBusy = false;
    }
}

function resetFileSelection() {
    workbook = null;
    sheetRows = [];
    sheetHeaders = [];
    mappingSignature = '';
    $('fileInput').value = '';
    show('mapCard', false);
    show('actionCard', false);
    show('previewWrap', false);
    setMsg('fileMsg', '');
    setMsg('mapMsg', '');
    setMsg('actionMsg', '');
    $('chips').textContent = '';
}

function bindEvents() {
    $('pinSetupBtn').addEventListener('click', setupPin);
    $('pinVerifyBtn').addEventListener('click', verifyPin);
    $('pinForgotBtn').addEventListener('click', forgetEverything);
    $('pinChangeBtn').addEventListener('click', changePin);
    $('lockBtn').addEventListener('click', lockApp);
    $('configSaveBtn').addEventListener('click', saveConfig);
    $('configEditBtn').addEventListener('click', () => showConfigForm(true));
    $('drop').addEventListener('click', () => $('fileInput').click());
    $('drop').addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            $('fileInput').click();
        }
    });
    $('fileInput').addEventListener('change', (evt) => handleFile(evt.target.files[0]));
    $('sheetSel').addEventListener('change', loadSelectedSheet);
    $('headerRowInput').addEventListener('change', applyHeaderRow);
    Object.keys(FIELD_SELECT_IDS).forEach((field) => {
        $(FIELD_SELECT_IDS[field]).addEventListener('change', renderPreview);
    });
    $('importBtn').addEventListener('click', runImport);
    $('clearBtn').addEventListener('click', runClear);
    $('resetBtn').addEventListener('click', resetFileSelection);
    $('confirmYes').addEventListener('click', () => settleConfirm(true));
    $('confirmNo').addEventListener('click', () => settleConfirm(false));

    ['pinInput'].forEach((id) => {
        $(id).addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') verifyPin();
        });
    });
    $('pinConfirmInput').addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter') setupPin();
    });

    const drop = $('drop');
    ['dragenter', 'dragover'].forEach((name) => {
        drop.addEventListener(name, (evt) => {
            evt.preventDefault();
            drop.classList.add('hot');
        });
    });
    ['dragleave', 'drop'].forEach((name) => {
        drop.addEventListener(name, (evt) => {
            evt.preventDefault();
            drop.classList.remove('hot');
        });
    });
    drop.addEventListener('drop', (evt) => {
        if (evt.dataTransfer && evt.dataTransfer.files && evt.dataTransfer.files.length) {
            handleFile(evt.dataTransfer.files[0]);
        }
    });
}

const BOOT_SPLASH_MIN_MS = 380;
const BOOT_REVEAL_CLEANUP_MS = 760;
const bootSplashStartedAt = Date.now();

function hideBootSplash() {
    const splash = document.getElementById('bootSplash');
    if (!splash || splash.classList.contains('boot-splash-out')) return;
    splash.classList.add('boot-splash-out');
    document.body.classList.add('boot-reveal');
    setTimeout(() => {
        splash.classList.add('boot-splash-gone');
        document.body.classList.remove('boot-reveal');
    }, BOOT_REVEAL_CLEANUP_MS);
}

function revealAppAfterBoot() {
    const wait = Math.max(0, BOOT_SPLASH_MIN_MS - (Date.now() - bootSplashStartedAt));
    setTimeout(() => {
        requestAnimationFrame(() => requestAnimationFrame(hideBootSplash));
    }, wait);
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(() => {}, () => {});
    });
}

function boot() {
    const versionText = $('appVersionText');
    if (versionText) versionText.textContent = APP_VERSION;
    bindEvents();
    registerServiceWorker();
    if (!window.isSecureContext) {
        setMsg('pinMsg', 'ត្រូវបើកតាម HTTPS ទើប PIN និងការអ៊ិនគ្រីបដំណើរការ', 'bad');
    }
    showPinBox();
    revealAppAfterBoot();
}

boot();
