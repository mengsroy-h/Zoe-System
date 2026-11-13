var WATCH_TRIGGER_FN = 'watchInboxFolder_';
var WATCH_INTERVAL_MINUTES = 5;
var WATCH_MAX_FILES_PER_RUN = 10;
var WATCH_MAX_FILES_SCANNED = 200;
var WATCH_HEADER_SCAN_ROWS = 12;
var WATCH_RECEIPT_PREFIX = 'ZTO_WATCH_RECEIPT_V1_';

var CONVERTIBLE_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/csv',
    'text/tab-separated-values',
    'text/plain'
];

var TEXT_MIME_TYPES = ['text/csv', 'text/tab-separated-values', 'text/plain'];
var TEXT_DELIMITERS = [',', '\t', ';', '|'];

function setupInboxWatch_() {
    var props = scriptProps_();
    var root = folderByIdOrCreate_(readProp_(PROP_INBOX), 'ZTO-Inbox', null);
    var done = folderByIdOrCreate_(readProp_(PROP_DONE), 'ZTO-Done', root);
    var failed = folderByIdOrCreate_(readProp_(PROP_FAILED), 'ZTO-Failed', root);
    props.setProperty(PROP_INBOX, root.getId());
    props.setProperty(PROP_DONE, done.getId());
    props.setProperty(PROP_FAILED, failed.getId());

    removeInboxWatch_();
    ScriptApp.newTrigger(WATCH_TRIGGER_FN).timeBased().everyMinutes(WATCH_INTERVAL_MINUTES).create();

    var message = 'រួចរាល់។ ទម្លាក់ឯកសារ Excel ចូល folder នេះ៖ ' + root.getUrl();
    Logger.log(message);
    return message;
}

function removeInboxWatch_() {
    var triggers = ScriptApp.getProjectTriggers();
    var removed = 0;
    for (var i = 0; i < triggers.length; i++) {
        var handler = triggers[i].getHandlerFunction();
        if (handler === WATCH_TRIGGER_FN || handler === 'watchInboxFolder') {
            ScriptApp.deleteTrigger(triggers[i]);
            removed++;
        }
    }
    return removed;
}

function folderByIdOrCreate_(id, name, parent) {
    if (id) {
        try {
            return DriveApp.getFolderById(id);
        } catch (err) {
            Logger.log('folder ' + id + ' រកមិនឃើញ — បង្កើតថ្មី');
        }
    }
    if (parent) {
        var inParent = parent.getFoldersByName(name);
        if (inParent.hasNext()) return inParent.next();
        return parent.createFolder(name);
    }
    var atRoot = DriveApp.getFoldersByName(name);
    if (atRoot.hasNext()) return atRoot.next();
    return DriveApp.createFolder(name);
}

function watchInboxFolder_() {
    var inboxId = readProp_(PROP_INBOX);
    if (!inboxId) return;
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(LOCK_WAIT_MS)) return;
    try {
        var inbox = DriveApp.getFolderById(inboxId);
        var done = DriveApp.getFolderById(readProp_(PROP_DONE) || inboxId);
        var failed = DriveApp.getFolderById(readProp_(PROP_FAILED) || inboxId);
        var report = [];
        var files = oldestInboxFiles_(inbox, WATCH_MAX_FILES_PER_RUN);
        for (var f = 0; f < files.length; f++) {
            var file = files[f];
            var receipt = readWatchReceipt_(file, inboxId);
            if (receipt.state === 'done') {
                report.push('✅ ' + file.getName() + ' — បាននាំចូលរួច · សាកផ្លាស់ទីតែប៉ុណ្ណោះ' + moveCompletedWatchFile_(file, done, receipt, inboxId));
                continue;
            }
            if (receipt.state !== 'new') {
                report.push('⏸️ ' + file.getName() + ' — HOLD៖ ភស្តុតាងនាំចូលត្រូវការម្ចាស់ផ្ទៀងផ្ទាត់ · មិននាំចូលឡើងវិញ');
                continue;
            }
            if (CONVERTIBLE_MIME_TYPES.indexOf(file.getMimeType()) === -1 &&
                file.getMimeType() !== MimeType.GOOGLE_SHEETS) {
                report.push('❌ ' + file.getName() + ' — មិនមែនឯកសារ Excel · CSV · Google Sheets ទេ' + moveWatchFile_(file, failed));
                continue;
            }
            if (!writeWatchReceipt_(receipt, 'pending')) {
                report.push('⏸️ ' + file.getName() + ' — រក្សាទុក intent មិនបាន · គ្មានការនាំចូល ឬផ្លាស់ទី');
                break;
            }
            var result;
            try {
                result = importDriveFile_(file, receipt.value);
            } catch (err) {
                if (!writeWatchReceipt_(receipt, 'unknown')) {
                    report.push('⏸️ ' + file.getName() + ' — លទ្ធផលមិនទាន់បានផ្ទៀង · រក្សា pending សម្រាប់ម្ចាស់ · មិននាំចូលឡើងវិញ');
                    break;
                }
                report.push('⏸️ ' + file.getName() + ' — ' + err.message + ' · លទ្ធផលសរសេរមិនទាន់បានផ្ទៀង — សូមពិនិត្យ Sheet មុននាំចូលម្ដងទៀត' + moveWatchFile_(file, failed));
                continue;
            }
            if (!writeWatchReceipt_(receipt, 'done')) {
                report.push('⏸️ ' + file.getName() + ' — នាំចូលឆ្លើយរួច តែរក្សាទុកលទ្ធផលមិនបាន · រក្សា pending សម្រាប់ម្ចាស់');
                break;
            }
            report.push('✅ ' + file.getName() + ' — បន្ថែម ' + result.added +
                ' · កែ ' + result.updated + ' · ដដែល ' + result.unchanged + moveCompletedWatchFile_(file, done, receipt, inboxId));
        }
        if (report.length) {
            Logger.log(report.join('\n'));
            notify_('ZoeAdmin — លទ្ធផលនាំចូលស្វ័យប្រវត្តិ', report.join('\n'));
        }
    } finally {
        lock.releaseLock();
    }
}

function readWatchReceipt_(file, inboxId) {
    try {
        var fileId = file.getId();
        var sheetId = readProp_(PROP_SHEET_ID);
        if (typeof fileId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(fileId) || !sheetId) return { state: 'hold' };
        var value = { version: 1, fileId: fileId, sheetId: sheetId,
            sheetName: readProp_(PROP_SHEET_NAME) || DEFAULT_SHEET_NAME, inboxId: inboxId, state: 'pending' };
        var key = WATCH_RECEIPT_PREFIX + fileId;
        var raw = scriptProps_().getProperty(key);
        if (raw === null) return { key: key, value: value, raw: null, state: 'new' };
        var saved = JSON.parse(raw);
        if (!saved || saved.version !== value.version || saved.fileId !== fileId || saved.sheetId !== value.sheetId ||
            saved.sheetName !== value.sheetName || saved.inboxId !== inboxId ||
            ['pending', 'unknown', 'done'].indexOf(saved.state) === -1) return { state: 'hold' };
        return { key: key, value: saved, raw: raw, state: saved.state };
    } catch (err) {
        return { state: 'hold' };
    }
}

function writeWatchReceipt_(receipt, state) {
    try {
        var props = scriptProps_();
        if (props.getProperty(receipt.key) !== receipt.raw) return false;
        var value = Object.assign({}, receipt.value, { state: state });
        var raw = JSON.stringify(value);
        props.setProperty(receipt.key, raw);
        if (props.getProperty(receipt.key) !== raw) return false;
        receipt.value = value;
        receipt.raw = raw;
        receipt.state = state;
        return true;
    } catch (err) {
        return false;
    }
}

function moveCompletedWatchFile_(file, folder, receipt, inboxId) {
    var warning = moveWatchFile_(file, folder);
    if (warning || folder.getId() === inboxId) return warning;
    try {
        var props = scriptProps_();
        if (props.getProperty(receipt.key) !== receipt.raw) throw new Error('receipt changed');
        props.deleteProperty(receipt.key);
        if (props.getProperty(receipt.key) !== null) throw new Error('receipt remains');
        return '';
    } catch (err) {
        try {
            if (props && props.getProperty(receipt.key) === null) props.setProperty(receipt.key, receipt.raw);
        } catch (restoreErr) {}
        return ' · ⚠️ សម្អាត receipt មិនបាន — សូមម្ចាស់ផ្ទៀងផ្ទាត់ Script Properties';
    }
}

function oldestInboxFiles_(inbox, limit) {
    var all = [];
    var iterator = inbox.getFiles();
    while (iterator.hasNext() && all.length < WATCH_MAX_FILES_SCANNED) {
        all.push(iterator.next());
    }
    all.sort(function (a, b) { return a.getDateCreated().getTime() - b.getDateCreated().getTime(); });
    return all.slice(0, limit);
}

function moveWatchFile_(file, folder) {
    try {
        file.moveTo(folder);
        return '';
    } catch (err) {
        return ' · ⚠️ ផ្លាស់ទីឯកសារមិនបាន (' + err.message + ') — សូមផ្លាស់ទីដោយដៃ';
    }
}

function importDriveFile_(file, owner) {
    var values = readFileAsValues_(file);
    if (!values.length) {
        throw new Error('ឯកសារទទេ');
    }
    var found = resolveHeaderAndMapping_(values);
    if (!found) {
        throw new Error('រកមិនឃើញ Column Barcode ទេ — សូមនាំចូលឯកសារបែបនេះម្តងតាមទំព័រ Web មុនសិន');
    }
    var rows = [];
    for (var i = found.headerRow + 1; i < values.length; i++) {
        rows.push(pickMappedRow_(values[i], found.mapping));
    }
    if (!rows.length) {
        throw new Error('គ្មានជួរដេកទិន្នន័យក្រោមជួរ header ទេ');
    }
    if (rows.length > MAX_IMPORT_ROWS) {
        throw new Error('ជួរដេកច្រើនជាង ' + MAX_IMPORT_ROWS);
    }
    if (owner && (readProp_(PROP_SHEET_ID) !== owner.sheetId ||
        (readProp_(PROP_SHEET_NAME) || DEFAULT_SHEET_NAME) !== owner.sheetName || readProp_(PROP_INBOX) !== owner.inboxId)) {
        throw new Error('គោលដៅនាំចូលបានប្ដូរ — សូមម្ចាស់ផ្ទៀងផ្ទាត់');
    }
    return writeToSheet_(rows, found.mode, found.mapping, owner);
}

function pickMappedRow_(row, mapping) {
    var source = row || [];
    return [
        mapping.barcode >= 0 ? source[mapping.barcode] : '',
        mapping.dod >= 0 ? source[mapping.dod] : '',
        mapping.cod >= 0 ? source[mapping.cod] : '',
        mapping.phone >= 0 ? source[mapping.phone] : ''
    ];
}

function resolveHeaderAndMapping_(values) {
    var store = readSavedMappings_();
    var limit = Math.min(values.length, WATCH_HEADER_SCAN_ROWS);
    for (var i = 0; i < limit; i++) {
        var headers = (values[i] || []).map(cleanText_);
        if (!headers.join('')) continue;
        var signature = mappingSignature_(headers);
        var saved = store[signature];
        if (saved && saved.mapping) {
            var savedMapping = sanitizeMapping_(saved.mapping, headers.length);
            if (savedMapping.barcode >= 0) {
                return { headerRow: i, mapping: savedMapping, mode: IMPORT_MODE_OR_DEFAULT_(saved.mode) };
            }
        }
    }
    var barcodeOnly = null;
    for (var j = 0; j < limit; j++) {
        var row = (values[j] || []).map(cleanText_);
        if (!row.join('')) continue;
        var detected = detectMapping_(row);
        if (detected.barcode < 0) continue;
        if (detected.dod >= 0 || detected.cod >= 0 || detected.phone >= 0) {
            return { headerRow: j, mapping: detected, mode: 'upsert' };
        }
        if (!barcodeOnly) barcodeOnly = { headerRow: j, mapping: detected, mode: 'upsert' };
    }
    return barcodeOnly;
}

function readFileAsValues_(file) {
    if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        return firstSheetValues_(file.getId());
    }
    var text = delimitedTextOf_(file);
    if (text !== null) {
        return parseDelimitedText_(text, file.getMimeType());
    }
    var copy = Drive.Files.copy(
        { title: 'zto-temp-' + Date.now(), mimeType: MimeType.GOOGLE_SHEETS },
        file.getId(),
        { convert: true }
    );
    try {
        return firstSheetValues_(copy.id);
    } finally {
        try {
            Drive.Files.remove(copy.id);
        } catch (err) {
            Logger.log('លុបឯកសារបណ្តោះអាសន្នមិនបាន៖ ' + err.message);
        }
    }
}

function delimitedTextOf_(file) {
    var blob = file.getBlob();
    var bytes = blob.getBytes();
    var at = function (index) { return index < bytes.length ? bytes[index] & 0xff : -1; };
    var zip = at(0) === 0x50 && at(1) === 0x4b;
    var ole = at(0) === 0xd0 && at(1) === 0xcf && at(2) === 0x11 && at(3) === 0xe0;
    if (zip || ole) return null;
    var charset = at(0) === 0xff && at(1) === 0xfe ? 'UTF-16LE' : at(0) === 0xfe && at(1) === 0xff ? 'UTF-16BE' : 'UTF-8';
    var text = String(blob.getDataAsString(charset)).replace(/^\uFEFF/, '');
    if (TEXT_MIME_TYPES.indexOf(file.getMimeType()) === -1 && /^\s*</.test(text)) return null;
    return text;
}

function parseDelimitedText_(text, mimeType) {
    var body = String(text);
    var delimiter;
    var hint = /^sep=([^\r\n])(\r\n|\r|\n)/i.exec(body);
    if (hint) {
        delimiter = hint[1];
        body = body.slice(hint[0].length);
    } else if (mimeType === 'text/tab-separated-values') {
        delimiter = '\t';
    } else {
        delimiter = guessDelimiter_(body.slice(0, 4096));
    }
    var rows = [];
    var row = [];
    var cell = '';
    var quoted = false;
    for (var i = 0; i < body.length; i++) {
        var ch = body.charAt(i);
        if (quoted) {
            if (ch !== '"') {
                cell += ch;
            } else if (body.charAt(i + 1) === '"') {
                cell += '"';
                i++;
            } else {
                quoted = false;
            }
        } else if (ch === '"' && cell === '') {
            quoted = true;
        } else if (ch === delimiter) {
            row.push(excelTextCell_(cell));
            cell = '';
        } else if (ch === '\r' || ch === '\n') {
            if (ch === '\r' && body.charAt(i + 1) === '\n') i++;
            row.push(excelTextCell_(cell));
            rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += ch;
        }
    }
    if (cell !== '' || row.length) {
        row.push(excelTextCell_(cell));
        rows.push(row);
    }
    return rows.filter(function (values) { return values.join('').trim() !== ''; });
}

function excelTextCell_(cell) {
    var marked = /^="([\s\S]*)"$/.exec(cell);
    return marked ? marked[1].replace(/""/g, '"') : cell;
}

function guessDelimiter_(sample) {
    var counts = {};
    var quoted = false;
    for (var i = 0; i < sample.length; i++) {
        var ch = sample.charAt(i);
        if (ch === '"') {
            quoted = !quoted;
        } else if (!quoted && (ch === '\r' || ch === '\n')) {
            var found = mostUsedDelimiter_(counts);
            if (found) return found;
            counts = {};
        } else if (!quoted && TEXT_DELIMITERS.indexOf(ch) !== -1) {
            counts[ch] = (counts[ch] || 0) + 1;
        }
    }
    return mostUsedDelimiter_(counts) || ',';
}

function mostUsedDelimiter_(counts) {
    var best = '';
    for (var i = 0; i < TEXT_DELIMITERS.length; i++) {
        var candidate = TEXT_DELIMITERS[i];
        if ((counts[candidate] || 0) > (best ? counts[best] : 0)) best = candidate;
    }
    return best;
}

function firstSheetValues_(spreadsheetId) {
    var sheets = SpreadsheetApp.openById(spreadsheetId).getSheets();
    if (!sheets.length) return [];
    var sheet = sheets[0];
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 1 || lastCol < 1) return [];
    return sheet.getRange(1, 1, lastRow, lastCol).getValues();
}

function notify_(subject, body) {
    var to = readProp_(PROP_NOTIFY);
    if (!to) return;
    try {
        MailApp.sendEmail(to, subject, body);
    } catch (err) {
        Logger.log('ផ្ញើអ៊ីមែលមិនបាន៖ ' + err.message);
    }
}
