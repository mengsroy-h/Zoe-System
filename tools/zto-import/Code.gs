var SCRIPT_VERSION = 7;
var DEFAULT_SHEET_NAME = 'Customers';
var MAX_IMPORT_ROWS = 20000;
var MAX_SAVED_MAPPINGS = 12;
var LOCK_WAIT_MS = 20000;
var MAX_IMPORT_RECEIPTS = 200;
var MAX_IMPORT_RECORD_BYTES = 8192;

var PROP_SHEET_ID = 'SHEET_ID';
var PROP_PASSWORD = 'IMPORT_PASSWORD';
var PROP_SHEET_NAME = 'SHEET_NAME';
var PROP_MAPPING = 'COLUMN_MAPPING';
var PROP_INBOX = 'INBOX_FOLDER_ID';
var PROP_DONE = 'DONE_FOLDER_ID';
var PROP_FAILED = 'FAILED_FOLDER_ID';
var PROP_NOTIFY = 'NOTIFY_EMAIL';
var PROP_WATCH_MODE = 'WATCH_MODE';

var FIELDS = ['barcode', 'dod', 'cod', 'phone'];

var HEADER_HINTS = {
    barcode: ['barcode', 'bar code', 'waybill', 'waybillno', 'waybill no', 'waybillnumber', 'waybill number',
        'billcode', 'bill code', 'billno', 'tracking', 'trackingno', 'tracking no', 'trackingnumber',
        'tracking number', 'orderno', 'order no', 'ordernumber', 'expressno', 'express no',
        '运单号', '运单编号', '快递单号', '单号',
        'ស្កេនលេខបុងបញ្ញើ', 'លេខបុងបញ្ញើ', 'បុងបញ្ញើ', 'លេខកញ្ចប់', 'បាកូដ'],
    cod: ['cod', 'cod$', 'cod amount', 'codamount', 'cod fee', 'codfee', 'cash on delivery',
        'collect on delivery', 'collection', 'collectamount', '代收货款', '代收金额', '代收',
        'ប្រាក់ប្រមូលជំនួស', 'ប្រមូលជំនួស'],
    dod: ['dod', 'dod$', 'dod amount', 'dodamount', 'deliver on demand', 'delivery fee', 'deliveryfee',
        'freight', 'freightfee', 'shipping fee', 'shippingfee', '运费', '派费',
        'ទឹកប្រាក់ដែលទូទាត់នៅពេលទំនិញដល់គោលដៅ', 'ទូទាត់នៅពេលទំនិញដល់គោលដៅ', 'ទំនិញដល់គោលដៅ'],
    phone: ['phone', 'phone number', 'phoneno', 'phone no', 'mobile', 'mobileno', 'mobile no',
        'mobile number', 'tel', 'telephone', 'receiver phone', 'receiverphone', 'receiver mobile',
        'consignee phone', 'consigneephone', 'contact', 'contactno', 'contact number',
        '收件人电话', '收件人手机', '收件人联系电话', '电话', '手机',
        'លេខទូរស័ព្ទអ្នកទទួលទំនិញ', 'ទូរស័ព្ទអ្នកទទួល', 'លេខទូរស័ព្ទ', 'ទូរស័ព្ទ']
};

function doGet() {
    return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('នាំចូល Excel ➜ ZoeAdmin')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function scriptProps_() {
    return PropertiesService.getScriptProperties();
}

function readProp_(name) {
    var v = scriptProps_().getProperty(name);
    return v ? String(v).trim() : '';
}

function requirePassword_(password) {
    var expected = readProp_(PROP_PASSWORD);
    if (!expected) {
        throw new Error('IMPORT_PASSWORD មិនទាន់កំណត់ក្នុង Script Properties — មើលជំហានទី ២ ក្នុង README.md');
    }
    if (String(password == null ? '' : password) !== expected) {
        throw new Error('ពាក្យសម្ងាត់មិនត្រឹមត្រូវ');
    }
}

function targetSheet_(owner) {
    var id = owner ? owner.sheetId : readProp_(PROP_SHEET_ID);
    if (!id) {
        throw new Error('SHEET_ID មិនទាន់កំណត់ក្នុង Script Properties — មើលជំហានទី ២ ក្នុង README.md');
    }
    var name = owner ? owner.sheetName : readProp_(PROP_SHEET_NAME) || DEFAULT_SHEET_NAME;
    var ss = SpreadsheetApp.openById(id);
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
        throw new Error('រកមិនឃើញ tab «' + name + '» ក្នុង Sheet នេះទេ');
    }
    return sheet;
}

function cleanText_(value) {
    if (value === null || value === undefined) return '';
    if (Object.prototype.toString.call(value) === '[object Date]') return '';
    if (typeof value === 'number') return isFinite(value) ? String(value) : '';
    return String(value).trim();
}

function moneyShape_(value) {
    var text = String(value).replace(/[^0-9.,\-]/g, '');
    var negative = text.charAt(0) === '-';
    var body = negative ? text.slice(1) : text;
    if (!/[0-9]/.test(body)) return { text: '0', mark: '', negative: false };
    if (body.indexOf('-') !== -1) return null;
    var commas = body.split(',').length - 1;
    var dots = body.split('.').length - 1;
    var shape = null;
    if (!commas && !dots) {
        shape = { text: body, mark: '' };
    } else if (!commas || !dots) {
        var sep = commas ? ',' : '.';
        var parts = body.split(sep);
        if (parts.length === 2) {
            var whole = parts[0];
            var fraction = parts[1];
            if (/^[0-9]{1,3}$/.test(whole) && /^[0-9]{3}$/.test(fraction)) {
                shape = sep === '.'
                    ? { dot: whole + '.' + fraction, comma: whole + fraction }
                    : { dot: whole + fraction, comma: whole + '.' + fraction };
            } else {
                shape = { text: (whole || '0') + '.' + (fraction || '0'), mark: fraction ? sep : '' };
            }
        } else if (/^[0-9]{1,3}$/.test(parts[0]) && parts.slice(1).every(function (part) { return /^[0-9]{3}$/.test(part); })) {
            shape = { text: parts.join(''), mark: sep === '.' ? ',' : '.' };
        }
    } else {
        var decimal = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',';
        var groups = body.slice(0, body.lastIndexOf(decimal)).split(decimal === '.' ? ',' : '.');
        var tail = body.slice(body.lastIndexOf(decimal) + 1);
        if (/^[0-9]{1,3}$/.test(groups[0]) && groups.slice(1).every(function (part) { return /^[0-9]{3}$/.test(part); }) && /^[0-9]*$/.test(tail)) {
            shape = { text: groups.join('') + '.' + (tail || '0'), mark: decimal };
        }
    }
    if (shape) shape.negative = negative;
    return shape;
}

function toMoney_(value, decimalMark) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return isFinite(value) ? Math.round(value * 100) / 100 : 0;
    var shape = moneyShape_(value);
    if (!shape) return null;
    var text = shape.text;
    if (text === undefined) text = decimalMark === '.' ? shape.dot : decimalMark === ',' ? shape.comma : undefined;
    if (text === undefined) return null;
    var n = parseFloat(text);
    if (!isFinite(n)) return 0;
    return Math.round((shape.negative ? -n : n) * 100) / 100;
}

function moneyDecimalMark_(values) {
    var seen = '';
    for (var i = 0; i < values.length; i++) {
        if (typeof values[i] !== 'string' || values[i] === '') continue;
        var shape = moneyShape_(values[i]);
        var mark = shape ? shape.mark : '';
        if (!mark) continue;
        if (seen && seen !== mark) return '';
        seen = mark;
    }
    return seen;
}

function unclearMoneyText_(unclear) {
    var first = unclear[0];
    return 'ទឹកប្រាក់អានមិនច្បាស់ ' + unclear.length + ' ជួរដេក (ឧ. ជួរទិន្នន័យទី ' + first.row + ' Barcode ' + first.barcode +
        ' តម្លៃ «' + first.value + '») — មិនដឹងថា «,» ឬ «.» ជាចុចទសភាគ ឬទម្រង់មិនត្រឹមត្រូវ។ ' +
        'សូមកែទឹកប្រាក់ក្នុងឯកសារឲ្យច្បាស់ (ឧ. 1234 ឬ 12.34) រួចនាំចូលម្តងទៀត — មិនទាន់សរសេរអ្វីទេ';
}

function normalizeHeader_(value) {
    return String(value === null || value === undefined ? '' : value)
        .toLowerCase()
        .replace(/[\s_\-.()\[\]{}:;,\/\\*#]/g, '')
        .trim();
}

function scoreHeader_(header, hints) {
    var norm = normalizeHeader_(header);
    if (!norm) return 0;
    var best = 0;
    for (var i = 0; i < hints.length; i++) {
        var hint = normalizeHeader_(hints[i]);
        if (!hint) continue;
        var score = 0;
        if (norm === hint) score = 100 + hint.length;
        else if (norm.indexOf(hint) === 0) score = 70 + hint.length;
        else if (norm.indexOf(hint) !== -1) score = 50 + hint.length;
        else if (hint.indexOf(norm) === 0 && norm.length >= 3) score = 40 + norm.length;
        if (score > best) best = score;
    }
    return best;
}

function detectMapping_(headers) {
    var mapping = { barcode: -1, dod: -1, cod: -1, phone: -1 };
    if (!headers || !headers.length) return mapping;
    var candidates = [];
    for (var f = 0; f < FIELDS.length; f++) {
        var field = FIELDS[f];
        for (var c = 0; c < headers.length; c++) {
            var score = scoreHeader_(headers[c], HEADER_HINTS[field]);
            if (score > 0) candidates.push({ field: field, col: c, score: score });
        }
    }
    candidates.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        if (a.col !== b.col) return a.col - b.col;
        return FIELDS.indexOf(a.field) - FIELDS.indexOf(b.field);
    });
    var usedCols = {};
    for (var i = 0; i < candidates.length; i++) {
        var cand = candidates[i];
        if (mapping[cand.field] !== -1) continue;
        if (usedCols[cand.col]) continue;
        mapping[cand.field] = cand.col;
        usedCols[cand.col] = true;
    }
    return mapping;
}

function mappingSignature_(headers) {
    var joined = (headers || []).map(normalizeHeader_).join('|');
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, joined, Utilities.Charset.UTF_8);
    var hex = '';
    for (var i = 0; i < bytes.length && i < 8; i++) {
        var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
        hex += (b < 16 ? '0' : '') + b.toString(16);
    }
    return hex;
}

function readSavedMappings_() {
    var raw = readProp_(PROP_MAPPING);
    if (!raw) return {};
    try {
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
        return {};
    }
}

function writeSavedMappings_(store) {
    var keys = Object.keys(store);
    if (keys.length > MAX_SAVED_MAPPINGS) {
        keys.sort(function (a, b) {
            return (store[a].savedAt || 0) - (store[b].savedAt || 0);
        });
        while (keys.length > MAX_SAVED_MAPPINGS) {
            delete store[keys.shift()];
        }
    }
    scriptProps_().setProperty(PROP_MAPPING, JSON.stringify(store));
}

function sanitizeMapping_(mapping, columnCount) {
    var out = { barcode: -1, dod: -1, cod: -1, phone: -1 };
    if (!mapping) return out;
    for (var i = 0; i < FIELDS.length; i++) {
        var field = FIELDS[i];
        var idx = parseInt(mapping[field], 10);
        if (isNaN(idx) || idx < 0) continue;
        if (typeof columnCount === 'number' && idx >= columnCount) continue;
        out[field] = idx;
    }
    return out;
}

function prepare(password, headers) {
    requirePassword_(password);
    var list = headers || [];
    var signature = mappingSignature_(list);
    var store = readSavedMappings_();
    var saved = store[signature];
    if (saved && saved.mapping) {
        return {
            signature: signature,
            mapping: sanitizeMapping_(saved.mapping, list.length),
            source: 'saved',
            mode: IMPORT_MODE_OR_DEFAULT_(saved.mode)
        };
    }
    var detected = detectMapping_(list);
    return {
        signature: signature,
        mapping: detected,
        source: detected.barcode === -1 ? 'none' : 'auto',
        mode: 'upsert'
    };
}

function IMPORT_MODE_OR_DEFAULT_(mode) {
    return mode === 'replace' || mode === 'newOnly' ? mode : 'upsert';
}

function rememberMapping_(signature, mapping, mode) {
    if (!signature) return;
    var store = readSavedMappings_();
    store[signature] = { mapping: sanitizeMapping_(mapping), mode: IMPORT_MODE_OR_DEFAULT_(mode), savedAt: Date.now() };
    writeSavedMappings_(store);
}

function normalizeRecords_(rows) {
    var records = [];
    var seen = {};
    var skippedNoBarcode = 0;
    var duplicatesInFile = 0;
    var unclear = [];
    var moneyCells = [];
    for (var m = 0; m < rows.length; m++) {
        var cells = rows[m] || [];
        moneyCells.push(cells[1], cells[2]);
    }
    var mark = moneyDecimalMark_(moneyCells);
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i] || [];
        var barcode = cleanText_(row[0]);
        if (!barcode) {
            skippedNoBarcode++;
            continue;
        }
        var dod = toMoney_(row[1], mark);
        var cod = toMoney_(row[2], mark);
        if (dod === null || cod === null) {
            unclear.push({ row: i + 1, barcode: barcode.slice(0, 40), value: cleanText_(dod === null ? row[1] : row[2]).slice(0, 40) });
            continue;
        }
        var record = {
            barcode: barcode,
            dod: dod,
            cod: cod,
            phone: cleanText_(row[3])
        };
        var key = barcode.toUpperCase();
        if (Object.prototype.hasOwnProperty.call(seen, key)) {
            duplicatesInFile++;
            records[seen[key]] = record;
        } else {
            seen[key] = records.length;
            records.push(record);
        }
    }
    if (unclear.length) {
        throw new Error(unclearMoneyText_(unclear));
    }
    return { records: records, skippedNoBarcode: skippedNoBarcode, duplicatesInFile: duplicatesInFile };
}

function keptFields_(mapping) {
    var keep = { dod: false, cod: false, phone: false };
    if (!mapping || typeof mapping !== 'object') return keep;
    ['dod', 'cod', 'phone'].forEach(function (field) {
        keep[field] = !(typeof mapping[field] === 'number' && mapping[field] >= 0);
    });
    return keep;
}

function sameAsExisting_(current, record, keep) {
    var kept = keep || {};
    return (kept.dod || toMoney_(current[1]) === record.dod) &&
        (kept.cod || toMoney_(current[2]) === record.cod) &&
        (kept.phone || cleanText_(current[3]) === record.phone);
}

function planImport_(existing, records, mode, keep) {
    var kept = keep || {};
    var resolved = IMPORT_MODE_OR_DEFAULT_(mode);
    var stats = { added: 0, updated: 0, unchanged: 0 };
    if (resolved === 'replace') {
        var replacement = [];
        for (var r = 0; r < records.length; r++) {
            replacement.push([records[r].barcode, records[r].dod, records[r].cod, records[r].phone]);
        }
        stats.added = replacement.length;
        return { mode: resolved, rows: replacement, appended: [], updatedRows: [], stats: stats };
    }
    var rows = [];
    for (var e = 0; e < existing.length; e++) {
        var source = existing[e] || [];
        rows.push([source[0], source[1], source[2], source[3]]);
    }
    var index = {};
    for (var i = 0; i < rows.length; i++) {
        var existingKey = cleanText_(rows[i][0]).toUpperCase();
        if (existingKey && !Object.prototype.hasOwnProperty.call(index, existingKey)) {
            index[existingKey] = i;
        }
    }
    var appended = [];
    var updatedRows = [];
    for (var j = 0; j < records.length; j++) {
        var record = records[j];
        var key = record.barcode.toUpperCase();
        if (Object.prototype.hasOwnProperty.call(index, key)) {
            if (resolved === 'newOnly') {
                stats.unchanged++;
                continue;
            }
            var at = index[key];
            var current = rows[at];
            if (sameAsExisting_(current, record, kept)) {
                stats.unchanged++;
                continue;
            }
            rows[at] = [current[0], kept.dod ? current[1] : record.dod, kept.cod ? current[2] : record.cod, kept.phone ? current[3] : record.phone];
            if (updatedRows.indexOf(at) === -1) updatedRows.push(at);
            stats.updated++;
        } else {
            index[key] = rows.length + appended.length;
            appended.push([record.barcode, record.dod, record.cod, record.phone]);
            stats.added++;
        }
    }
    updatedRows.sort(function (a, b) { return a - b; });
    return { mode: resolved, rows: rows, appended: appended, updatedRows: updatedRows, stats: stats };
}

function contiguousRuns_(sortedIndexes) {
    var runs = [];
    for (var i = 0; i < sortedIndexes.length; i++) {
        var value = sortedIndexes[i];
        if (runs.length && value === runs[runs.length - 1].end + 1) {
            runs[runs.length - 1].end = value;
        } else {
            runs.push({ start: value, end: value });
        }
    }
    return runs;
}

function applyColumnFormats_(sheet, startRow, rowCount) {
    if (rowCount <= 0) return;
    sheet.getRange(startRow, 1, rowCount, 1).setNumberFormat('@');
    sheet.getRange(startRow, 2, rowCount, 2).setNumberFormat('0.00');
    sheet.getRange(startRow, 4, rowCount, 1).setNumberFormat('@');
}



function writtenError_(err) {
    var out = new Error(err && err.message ? err.message : String(err));
    out.written = true;
    return out;
}

function writeToSheetRaw_(rows, mode, mapping, owner) {
    var sheet = targetSheet_(owner);
    var normalized = normalizeRecords_(rows);
    if (!normalized.records.length) {
        throw new Error('រកមិនឃើញជួរដេកណាដែលមាន Barcode ទេ — សូមពិនិត្យការផ្គូផ្គង Column');
    }
    var lastRow = sheet.getLastRow();
    var existing = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 4).getValues() : [];
    var plan = planImport_(existing, normalized.records, mode, keptFields_(mapping));
    var written = false;
    try {
        if (plan.mode === 'replace') {
            var replacementLastRow = plan.rows.length + 1;
            if (sheet.getMaxRows() < replacementLastRow) {
                sheet.insertRowsAfter(sheet.getMaxRows(), replacementLastRow - sheet.getMaxRows());
            }
            applyColumnFormats_(sheet, 2, plan.rows.length);
            sheet.getRange(2, 1, plan.rows.length, 4).setValues(plan.rows);
            written = true;
            if (lastRow > replacementLastRow) {
                sheet.getRange(replacementLastRow + 1, 1, lastRow - replacementLastRow, 4).clearContent();
            }
        } else {
            var runs = contiguousRuns_(plan.updatedRows);
            for (var i = 0; i < runs.length; i++) {
                var run = runs[i];
                var count = run.end - run.start + 1;
                var slice = plan.rows.slice(run.start, run.end + 1);
                applyColumnFormats_(sheet, run.start + 2, count);
                sheet.getRange(run.start + 2, 1, count, 4).setValues(slice);
                written = true;
            }
            if (plan.appended.length) {
                var appendAt = Math.max(lastRow, 1) + 1;
                var needed = appendAt - 1 + plan.appended.length;
                if (sheet.getMaxRows() < needed) {
                    sheet.insertRowsAfter(sheet.getMaxRows(), needed - sheet.getMaxRows());
                }
                applyColumnFormats_(sheet, appendAt, plan.appended.length);
                sheet.getRange(appendAt, 1, plan.appended.length, 4).setValues(plan.appended);
                written = true;
            }
        }
        SpreadsheetApp.flush();
        return {
            ok: true,
            mode: plan.mode,
            sheetName: sheet.getName(),
            fileRows: rows.length,
            usableRows: normalized.records.length,
            added: plan.stats.added,
            updated: plan.stats.updated,
            unchanged: plan.stats.unchanged,
            skippedNoBarcode: normalized.skippedNoBarcode,
            duplicatesInFile: normalized.duplicatesInFile,
            rowsAfter: Math.max(0, sheet.getLastRow() - 1)
        };
    } catch (err) {
        throw written ? writtenError_(err) : err;
    }
}



function doPost(e) {
    var body;
    try {
        body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (err) {
        return jsonOut_({ ok: false, error: 'អានទិន្នន័យសំណើមិនបាន', written: false });
    }
    try {
        return jsonOut_({ ok: true, data: runApiAction_(body) });
    } catch (err) {
        return jsonOut_({ ok: false, error: err && err.message ? err.message : String(err), written: !!(err && err.written) });
    }
}

function runApiAction_(body) {
    var action = body && body.action;
    var password = body && body.password;
    if (action === 'status') return getStatus(password);
    if (action === 'prepare') return prepare(password, body.headers);
    if (action === 'import') return importRows(password, body.payload);
    if (action === 'clear') return clearRows(password, body.confirm, body.intent);
    if (action === 'prepareWrite') return prepareWrite(password, body.request);
    throw new Error('សកម្មភាពមិនស្គាល់');
}

function jsonOut_(payload) {
    var body = payload || {};
    body.scriptVersion = SCRIPT_VERSION;
    return ContentService.createTextOutput(JSON.stringify(body))
        .setMimeType(ContentService.MimeType.JSON);
}

function getStatus(password) {
    requirePassword_(password);
    var sheet = targetSheet_();
    return {
        spreadsheetName: sheet.getParent().getName(),
        sheetName: sheet.getName(),
        rowCount: Math.max(0, sheet.getLastRow() - 1),
        watchEnabled: !!readProp_(PROP_INBOX),
        savedMappings: Object.keys(readSavedMappings_()).length,
        writeProtocol: 1,
        writeScope: importHash_({ script: ScriptApp.getScriptId() })
    };
}

function importRows(password, payload) {
    requirePassword_(password);
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(LOCK_WAIT_MS)) throw new Error('IMPORT_BUSY');
    try { return executePreparedWrite_('import', payload || {}, payload && payload.intent); }
    finally { lock.releaseLock(); }
}

function clearRows(password, confirmToken, intent) {
    requirePassword_(password);
    if (confirmToken !== 'CLEAR') throw new Error('CLEAR_CONFIRM_REQUIRED');
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(LOCK_WAIT_MS)) throw new Error('IMPORT_BUSY');
    try { return executePreparedWrite_('clear', {}, intent); }
    finally { lock.releaseLock(); }
}

function prepareWrite(password, request) {
    requirePassword_(password);
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(LOCK_WAIT_MS)) throw new Error('IMPORT_BUSY');
    try {
        if (!request || ['import', 'clear'].indexOf(request.kind) < 0) throw new Error('IMPORT_KIND_INVALID');
        if (request.kind === 'clear' && request.confirm !== 'CLEAR') throw new Error('CLEAR_CONFIRM_REQUIRED');
        return prepareWrite_(request.kind, request.payload || {});
    } finally { lock.releaseLock(); }
}

function importCanonical_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]') return JSON.stringify(value.toISOString());
    if (Array.isArray(value)) return '[' + value.map(importCanonical_).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + importCanonical_(value[key]); }).join(',') + '}';
    return JSON.stringify(value);
}

function importHash_(value) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, importCanonical_(value), Utilities.Charset.UTF_8).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function importTarget_(owner) {
    var capture = { sheetId: owner ? owner.sheetId : readProp_(PROP_SHEET_ID), sheetName: owner ? owner.sheetName : readProp_(PROP_SHEET_NAME) || DEFAULT_SHEET_NAME };
    var sheet = targetSheet_(capture);
    capture.tabId = sheet.getSheetId();
    return { owner: capture, sheet: sheet, hash: importHash_(capture) };
}

function importSnapshot_(target) {
    var count = Math.max(1, target.sheet.getLastRow());
    var range = target.sheet.getRange(1, 1, count, 4);
    return { values: range.getValues(), formulas: range.getFormulas() };
}

function importTrimRows_(rows) {
    var copy = rows.slice();
    while (copy.length && copy[copy.length - 1].every(function (cell) { return cell === ''; })) copy.pop();
    return copy;
}

function importPostHash_(target, values) {
    return importHash_({ target: target.owner, values: importTrimRows_(values) });
}

function importReceiptKey_(id) {
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('IMPORT_INTENT_REQUIRED');
    return 'ZTO_IMPORT_RECEIPT_V1_' + id;
}

function importRead_(key) {
    var raw = scriptProps_().getProperty(key);
    if (raw === null) return null;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (err) { throw new Error('IMPORT_RECEIPT_HOLD'); }
    if (!parsed || parsed.v !== 1 || typeof parsed !== 'object') throw new Error('IMPORT_RECEIPT_HOLD');
    return parsed;
}

function importStore_(key, value) {
    var raw = JSON.stringify(value);
    if (encodeURIComponent(raw).replace(/%[0-9a-f]{2}|./gi, 'x').length > MAX_IMPORT_RECORD_BYTES) throw new Error('IMPORT_RECORD_SIZE_HOLD');
    scriptProps_().setProperty(key, raw);
    if (scriptProps_().getProperty(key) !== raw) throw new Error('IMPORT_STORAGE_HOLD');
}

function importFence_(target) {
    var value = importRead_('ZTO_IMPORT_FENCE_V1_' + target.hash);
    if (value && (value.targetHash !== target.hash || typeof value.revision !== 'string' || typeof value.requestId !== 'string')) throw new Error('IMPORT_FENCE_HOLD');
    return value;
}

function importUnknown_() {
    return writtenError_(new Error('IMPORT_OUTCOME_UNKNOWN_HOLD'));
}

function recoverPreparedWrite_(target, record, fence) {
    if (!fence || fence.requestId !== record.intent.id || fence.revision !== record.revision || record.state !== 'pending') throw importUnknown_();
    if (importPostHash_(target, importSnapshot_(target).values) !== record.expectedPostHash) throw importUnknown_();
    record.state = 'done';
    record.result = Object.assign({}, record.result, { reconciled: true, mappingSaved: false });
    importStore_(importReceiptKey_(record.intent.id), record);
    return record;
}

function settleImportFence_(target) {
    var fence = importFence_(target);
    if (!fence) return null;
    var record = importRead_(importReceiptKey_(fence.requestId));
    if (!record || !record.intent || record.intent.targetHash !== target.hash || record.revision !== fence.revision) throw new Error('IMPORT_FENCE_HOLD');
    if (record.state === 'pending') recoverPreparedWrite_(target, record, fence);
    else if (record.state !== 'done') throw new Error('IMPORT_FENCE_HOLD');
    return fence;
}

function pruneImportReceipts_() {
    var props = scriptProps_(), all = props.getProperties();
    var saved = Object.keys(all).filter(function (key) { return key.indexOf('ZTO_IMPORT_RECEIPT_V1_') === 0; }).map(function (key) {
        var record = importRead_(key);
        return { key: key, record: record };
    });
    if (saved.length < MAX_IMPORT_RECEIPTS) return;
    var protectedIds = Object.keys(all).filter(function (key) { return key.indexOf('ZTO_IMPORT_FENCE_V1_') === 0; }).map(function (key) { var fence = importRead_(key); return fence && fence.requestId; });
    var removable = saved.filter(function (entry) { return ['prepared', 'done'].indexOf(entry.record.state) >= 0 && protectedIds.indexOf(entry.record.intent.id) < 0; }).sort(function (a, b) { return a.record.intent.preparedAt - b.record.intent.preparedAt; });
    while (saved.length >= MAX_IMPORT_RECEIPTS && removable.length) {
        var next = removable.shift();
        props.deleteProperty(next.key);
        if (props.getProperty(next.key) !== null) throw new Error('IMPORT_STORAGE_HOLD');
        saved.pop();
    }
    if (saved.length >= MAX_IMPORT_RECEIPTS) throw new Error('IMPORT_RECEIPT_CAPACITY_HOLD');
}

function importPlan_(kind, data, target, snapshot) {
    if (kind === 'clear') return { sourceHash: importHash_({ kind: kind }), rows: [], result: { ok: true, sheetName: target.owner.sheetName, removed: Math.max(0, snapshot.values.length - 1), rowsAfter: 0 } };
    if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > MAX_IMPORT_ROWS) throw new Error('IMPORT_ROWS_INVALID');
    var normalized = normalizeRecords_(data.rows);
    if (!normalized.records.length) throw new Error('IMPORT_ROWS_INVALID');
    var mode = IMPORT_MODE_OR_DEFAULT_(data.mode), keep = keptFields_(data.mapping);
    var plan = planImport_(snapshot.values.slice(1), normalized.records, mode, keep);
    var rows = plan.rows.concat(plan.appended);
    return { sourceHash: importHash_({ kind: kind, records: normalized.records, mode: mode, keep: keep, fileRows: data.rows.length, skippedNoBarcode: normalized.skippedNoBarcode, duplicatesInFile: normalized.duplicatesInFile, signature: data.signature || '' }), rows: rows,
        result: { ok: true, mode: mode, sheetName: target.owner.sheetName, fileRows: data.rows.length, usableRows: normalized.records.length, added: plan.stats.added, updated: plan.stats.updated, unchanged: plan.stats.unchanged, skippedNoBarcode: normalized.skippedNoBarcode, duplicatesInFile: normalized.duplicatesInFile, rowsAfter: importTrimRows_(rows).length } };
}

function prepareWrite_(kind, data, owner) {
    var target = importTarget_(owner), fence = settleImportFence_(target), snapshot = importSnapshot_(target), plan = importPlan_(kind, data, target, snapshot);
    pruneImportReceipts_();
    var intent = { v: 1, id: Utilities.getUuid(), kind: kind, target: target.owner, targetHash: target.hash, sourceHash: plan.sourceHash, beforeHash: importHash_({ target: target.owner, snapshot: snapshot }), baseRevision: fence ? fence.revision : 'initial', preparedAt: Date.now() };
    importStore_(importReceiptKey_(intent.id), { v: 1, state: 'prepared', intent: intent });
    return { intent: intent, protocol: 1 };
}

function executePreparedWrite_(kind, data, intent) {
    if (!intent || intent.v !== 1 || intent.kind !== kind) throw new Error('IMPORT_INTENT_REQUIRED');
    var record = importRead_(importReceiptKey_(intent.id));
    if (!record || !record.intent) throw importUnknown_();
    if (importCanonical_(record.intent) !== importCanonical_(intent)) throw new Error('IMPORT_INTENT_CHANGED');
    var target = importTarget_();
    if (target.hash !== intent.targetHash || importCanonical_(target.owner) !== importCanonical_(intent.target)) throw new Error('IMPORT_TARGET_CHANGED');
    var snapshot = importSnapshot_(target), plan = importPlan_(kind, data, target, snapshot);
    if (plan.sourceHash !== intent.sourceHash) throw new Error('IMPORT_SOURCE_CHANGED');
    var fence = importFence_(target);
    if (record.state === 'pending') record = recoverPreparedWrite_(target, record, fence);
    if (record.state === 'done') return importResult_(record, !!fence && fence.revision === record.revision && importPostHash_(target, snapshot.values) === record.expectedPostHash, true);
    if (record.state !== 'prepared') throw new Error('IMPORT_RECEIPT_HOLD');
    fence = settleImportFence_(target);
    if (intent.baseRevision !== (fence ? fence.revision : 'initial')) throw new Error('IMPORT_STALE_REVISION');
    if (importHash_({ target: target.owner, snapshot: snapshot }) !== intent.beforeHash) throw new Error('IMPORT_SHEET_CHANGED');
    record.state = 'pending';
    record.revision = Utilities.getUuid();
    record.expectedPostHash = importPostHash_(target, [snapshot.values[0]].concat(plan.rows));
    record.result = plan.result;
    importStore_(importReceiptKey_(intent.id), record);
    importStore_('ZTO_IMPORT_FENCE_V1_' + target.hash, { v: 1, targetHash: target.hash, requestId: intent.id, revision: record.revision });
    var result;
    try {
        if (kind === 'clear') {
            if (snapshot.values.length > 1) target.sheet.getRange(2, 1, snapshot.values.length - 1, 4).clearContent();
            SpreadsheetApp.flush();
            result = plan.result;
        } else {
            result = writeToSheetRaw_(data.rows, data.mode, data.mapping, target.owner);
            if (data.signature) {
                try { rememberMapping_(data.signature, data.mapping, data.mode); } catch (err) { result.mappingSaved = false; }
            }
        }
        if (importPostHash_(target, importSnapshot_(target).values) !== record.expectedPostHash) throw importUnknown_();
        record.state = 'done'; record.result = result;
        importStore_(importReceiptKey_(intent.id), record);
    } catch (err) { throw importUnknown_(); }
    return importResult_(record, true, false);
}

function writeToSheet_(rows, mode, mapping, owner) {
    var payload = { rows: rows, mode: mode, mapping: mapping };
    var prepared = prepareWrite_('import', payload, owner);
    return executePreparedWrite_('import', payload, prepared.intent);
}

function importResult_(record, current, replayed) {
    return Object.assign({}, record.result, { replayed: replayed, importCurrent: current, importRevision: record.revision, importReceipt: { v: 1, id: record.intent.id, sourceHash: record.intent.sourceHash, baseRevision: record.intent.baseRevision, revision: record.revision, current: current } });
}
