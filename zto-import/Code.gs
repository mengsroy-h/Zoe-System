var SCRIPT_VERSION = 2;
var DEFAULT_SHEET_NAME = 'Customers';
var MAX_IMPORT_ROWS = 20000;
var MAX_SAVED_MAPPINGS = 12;
var LOCK_WAIT_MS = 30000;

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

function targetSheet_() {
    var id = readProp_(PROP_SHEET_ID);
    if (!id) {
        throw new Error('SHEET_ID មិនទាន់កំណត់ក្នុង Script Properties — មើលជំហានទី ២ ក្នុង README.md');
    }
    var name = readProp_(PROP_SHEET_NAME) || DEFAULT_SHEET_NAME;
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

function toMoney_(value) {
    if (value === null || value === undefined || value === '') return 0;
    var n;
    if (typeof value === 'number') {
        n = value;
    } else {
        var text = String(value).replace(/[^0-9.\-]/g, '');
        n = parseFloat(text);
    }
    if (!isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
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
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i] || [];
        var barcode = cleanText_(row[0]);
        if (!barcode) {
            skippedNoBarcode++;
            continue;
        }
        var record = {
            barcode: barcode,
            dod: toMoney_(row[1]),
            cod: toMoney_(row[2]),
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
    return { records: records, skippedNoBarcode: skippedNoBarcode, duplicatesInFile: duplicatesInFile };
}

function sameAsExisting_(current, record) {
    return toMoney_(current[1]) === record.dod &&
        toMoney_(current[2]) === record.cod &&
        cleanText_(current[3]) === record.phone;
}

function planImport_(existing, records, mode) {
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
            if (sameAsExisting_(current, record)) {
                stats.unchanged++;
                continue;
            }
            rows[at] = [current[0], record.dod, record.cod, record.phone];
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

function importRows(password, payload) {
    requirePassword_(password);
    var data = payload || {};
    var rows = data.rows || [];
    if (!rows.length) {
        throw new Error('គ្មានជួរដេកត្រូវនាំចូលទេ');
    }
    if (rows.length > MAX_IMPORT_ROWS) {
        throw new Error('ឯកសារនេះមាន ' + rows.length + ' ជួរដេក ច្រើនជាងកម្រិត ' + MAX_IMPORT_ROWS + ' — សូមបំបែកជាឯកសារតូចៗ');
    }
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(LOCK_WAIT_MS)) {
        throw new Error('មានការនាំចូលមួយផ្សេងកំពុងដំណើរការ — សូមព្យាយាមម្តងទៀតក្នុងមួយភ្លែត');
    }
    try {
        var result = writeToSheet_(rows, data.mode);
        if (data.signature) {
            rememberMapping_(data.signature, data.mapping, data.mode);
        }
        return result;
    } finally {
        lock.releaseLock();
    }
}

function writeToSheet_(rows, mode) {
    var sheet = targetSheet_();
    var normalized = normalizeRecords_(rows);
    if (!normalized.records.length) {
        throw new Error('រកមិនឃើញជួរដេកណាដែលមាន Barcode ទេ — សូមពិនិត្យការផ្គូផ្គង Column');
    }
    var lastRow = sheet.getLastRow();
    var existing = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 4).getValues() : [];
    var plan = planImport_(existing, normalized.records, mode);

    if (plan.mode === 'replace') {
        var replacementLastRow = plan.rows.length + 1;
        if (sheet.getMaxRows() < replacementLastRow) {
            sheet.insertRowsAfter(sheet.getMaxRows(), replacementLastRow - sheet.getMaxRows());
        }
        applyColumnFormats_(sheet, 2, plan.rows.length);
        sheet.getRange(2, 1, plan.rows.length, 4).setValues(plan.rows);
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
        }
        if (plan.appended.length) {
            var appendAt = Math.max(lastRow, 1) + 1;
            var needed = appendAt - 1 + plan.appended.length;
            if (sheet.getMaxRows() < needed) {
                sheet.insertRowsAfter(sheet.getMaxRows(), needed - sheet.getMaxRows());
            }
            applyColumnFormats_(sheet, appendAt, plan.appended.length);
            sheet.getRange(appendAt, 1, plan.appended.length, 4).setValues(plan.appended);
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
}

function clearRows(password, confirmToken) {
    requirePassword_(password);
    if (confirmToken !== 'CLEAR') {
        throw new Error('ការសម្អាតត្រូវការការបញ្ជាក់ — គ្មាន token បញ្ជាក់ទេ');
    }
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(LOCK_WAIT_MS)) {
        throw new Error('មានប្រតិបត្តិការមួយផ្សេងកំពុងដំណើរការ — សូមព្យាយាមម្តងទៀតក្នុងមួយភ្លែត');
    }
    try {
        var sheet = targetSheet_();
        var lastRow = sheet.getLastRow();
        var removed = Math.max(0, lastRow - 1);
        if (removed > 0) {
            sheet.getRange(2, 1, removed, 4).clearContent();
            SpreadsheetApp.flush();
        }
        return {
            ok: true,
            sheetName: sheet.getName(),
            removed: removed,
            rowsAfter: Math.max(0, sheet.getLastRow() - 1)
        };
    } finally {
        lock.releaseLock();
    }
}

function doPost(e) {
    var body;
    try {
        body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (err) {
        return jsonOut_({ ok: false, error: 'អានទិន្នន័យសំណើមិនបាន' });
    }
    try {
        return jsonOut_({ ok: true, data: runApiAction_(body) });
    } catch (err) {
        return jsonOut_({ ok: false, error: err && err.message ? err.message : String(err) });
    }
}

function runApiAction_(body) {
    var action = body && body.action;
    var password = body && body.password;
    if (action === 'status') return getStatus(password);
    if (action === 'prepare') return prepare(password, body.headers);
    if (action === 'import') return importRows(password, body.payload);
    if (action === 'clear') return clearRows(password, body.confirm);
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
        savedMappings: Object.keys(readSavedMappings_()).length
    };
}
