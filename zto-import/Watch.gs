var WATCH_TRIGGER_FN = 'watchInboxFolder';
var WATCH_INTERVAL_MINUTES = 5;
var WATCH_MAX_FILES_PER_RUN = 10;
var WATCH_HEADER_SCAN_ROWS = 12;

var CONVERTIBLE_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/csv',
    'text/tab-separated-values',
    'text/plain'
];

function setupInboxWatch() {
    var props = scriptProps_();
    var root = folderByIdOrCreate_(readProp_(PROP_INBOX), 'ZTO-Inbox', null);
    var done = folderByIdOrCreate_(readProp_(PROP_DONE), 'ZTO-Done', root);
    var failed = folderByIdOrCreate_(readProp_(PROP_FAILED), 'ZTO-Failed', root);
    props.setProperty(PROP_INBOX, root.getId());
    props.setProperty(PROP_DONE, done.getId());
    props.setProperty(PROP_FAILED, failed.getId());

    removeInboxWatch();
    ScriptApp.newTrigger(WATCH_TRIGGER_FN).timeBased().everyMinutes(WATCH_INTERVAL_MINUTES).create();

    var message = 'រួចរាល់។ ទម្លាក់ឯកសារ Excel ចូល folder នេះ៖ ' + root.getUrl();
    Logger.log(message);
    return message;
}

function removeInboxWatch() {
    var triggers = ScriptApp.getProjectTriggers();
    var removed = 0;
    for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === WATCH_TRIGGER_FN) {
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

function watchInboxFolder() {
    var inboxId = readProp_(PROP_INBOX);
    if (!inboxId) return;
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(LOCK_WAIT_MS)) return;
    try {
        var inbox = DriveApp.getFolderById(inboxId);
        var done = DriveApp.getFolderById(readProp_(PROP_DONE) || inboxId);
        var failed = DriveApp.getFolderById(readProp_(PROP_FAILED) || inboxId);
        var files = inbox.getFiles();
        var handled = 0;
        var report = [];
        while (files.hasNext() && handled < WATCH_MAX_FILES_PER_RUN) {
            var file = files.next();
            handled++;
            if (CONVERTIBLE_MIME_TYPES.indexOf(file.getMimeType()) === -1 &&
                file.getMimeType() !== MimeType.GOOGLE_SHEETS) {
                continue;
            }
            try {
                var result = importDriveFile_(file);
                file.moveTo(done);
                report.push('✅ ' + file.getName() + ' — បន្ថែម ' + result.added +
                    ' · កែ ' + result.updated + ' · ដដែល ' + result.unchanged);
            } catch (err) {
                file.moveTo(failed);
                report.push('❌ ' + file.getName() + ' — ' + err.message);
            }
        }
        if (report.length) {
            Logger.log(report.join('\n'));
            notify_('ZoeAdmin — លទ្ធផលនាំចូលស្វ័យប្រវត្តិ', report.join('\n'));
        }
    } finally {
        lock.releaseLock();
    }
}

function importDriveFile_(file) {
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
    return writeToSheet_(rows, found.mode);
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
    for (var j = 0; j < limit; j++) {
        var row = (values[j] || []).map(cleanText_);
        if (!row.join('')) continue;
        var detected = detectMapping_(row);
        if (detected.barcode >= 0) {
            return { headerRow: j, mapping: detected, mode: 'upsert' };
        }
    }
    return null;
}

function readFileAsValues_(file) {
    if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        return firstSheetValues_(file.getId());
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
