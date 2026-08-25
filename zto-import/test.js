const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const sandbox = {
    console,
    Date,
    Math,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    String,
    Number,
    Object,
    Array,
    Error,
    Logger: { log() {} },
    Utilities: {
        DigestAlgorithm: { SHA_256: 'SHA_256' },
        Charset: { UTF_8: 'UTF_8' },
        computeDigest(_algo, value) {
            const bytes = [];
            let h = 5381;
            for (let i = 0; i < value.length; i++) {
                h = ((h * 33) ^ value.charCodeAt(i)) | 0;
            }
            for (let i = 0; i < 8; i++) {
                bytes.push(((h >> (i * 4)) & 0xff) - 128);
            }
            return bytes;
        }
    },
    PropertiesService: {
        getScriptProperties() {
            return {
                store: {},
                getProperty(key) { return this.store[key] || null; },
                setProperty(key, value) { this.store[key] = value; }
            };
        }
    },
    SpreadsheetApp: {},
    HtmlService: {},
    LockService: {},
    ScriptApp: {},
    DriveApp: {},
    Drive: {},
    MailApp: {},
    MimeType: { GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet' }
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), sandbox, { filename: 'Code.gs' });

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
    if (condition) {
        passed++;
    } else {
        failed++;
        failures.push(name + (detail ? ' — ' + detail : ''));
    }
}

function equal(name, actual, expected) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    check(name, a === b, 'បាន ' + a + ' រំពឹង ' + b);
}

const { detectMapping_, normalizeRecords_, planImport_, contiguousRuns_, toMoney_, cleanText_, sanitizeMapping_ } = sandbox;

equal('detect ZTO english headers',
    detectMapping_(['Waybill No', 'Receiver Phone', 'COD Amount', 'Freight', 'Remark']),
    { barcode: 0, dod: 3, cod: 2, phone: 1 });

equal('detect chinese headers',
    detectMapping_(['运单号', '收件人电话', '代收货款', '运费']),
    { barcode: 0, dod: 3, cod: 2, phone: 1 });

const ZTO_REAL_HEADERS = [
    'ស្កេនលេខបុងបញ្ញើ',
    'ទឹកប្រាក់ដែលទូទាត់នៅពេលទំនិញដល់គោលដៅ',
    'ប្រាក់ប្រមូលជំនួស',
    'លេខទូរស័ព្ទអ្នកទទួលទំនិញ'
];

equal('detect real ZTO khmer export headers',
    detectMapping_(ZTO_REAL_HEADERS),
    { barcode: 0, dod: 1, cod: 2, phone: 3 });

equal('khmer cod header does not steal the dod column',
    detectMapping_(ZTO_REAL_HEADERS).dod, 1);

equal('khmer receiver phone header wins over bare phone hint',
    detectMapping_(ZTO_REAL_HEADERS).phone, 3);

equal('detect zoeadmin own headers',
    detectMapping_(['Barcode', 'DOD($)', 'COD($)', 'Phone']),
    { barcode: 0, dod: 1, cod: 2, phone: 3 });

equal('unknown headers map to nothing',
    detectMapping_(['col1', 'col2', 'col3']),
    { barcode: -1, dod: -1, cod: -1, phone: -1 });

function assertUniqueColumns(name, mapping) {
    const used = Object.values(mapping).filter((v) => v >= 0);
    check(name, new Set(used).size === used.length, JSON.stringify(mapping));
}

assertUniqueColumns('two tracking columns stay unique',
    detectMapping_(['Tracking Number', 'Tracking', 'COD', 'Phone']));
assertUniqueColumns('one header matching cod and dod is claimed once',
    detectMapping_(['Waybill', 'COD/DOD Amount', 'Phone']));
assertUniqueColumns('one header matching phone and mobile is claimed once',
    detectMapping_(['Waybill No', 'Mobile Phone', 'COD']));
assertUniqueColumns('real ZTO headers each claim one column',
    detectMapping_(ZTO_REAL_HEADERS));

equal('an exact header beats a merely-containing one',
    detectMapping_(['Total COD Value', 'COD']).cod, 1);
equal('an exact header beats a merely-containing one, order reversed',
    detectMapping_(['COD', 'Total COD Value']).cod, 0);

equal('cod beats dod on a cod header', detectMapping_(['Waybill', 'COD($)']).cod, 1);
equal('dod not stolen by cod hint', detectMapping_(['Waybill', 'DOD($)']).dod, 1);

equal('money rounds to 2 decimals', toMoney_(2.5899999), 2.59);
equal('money parses currency text', toMoney_('$ 13.18'), 13.18);
equal('money on blank is zero', toMoney_(''), 0);
equal('money on junk is zero', toMoney_('abc'), 0);
equal('money keeps negative', toMoney_('-3.5'), -3.5);

equal('long barcode number keeps all digits', cleanText_(77130526882395), '77130526882395');
equal('text barcode is trimmed', cleanText_('  77130526882395 '), '77130526882395');
equal('phone with dash is untouched', cleanText_('855-070210071'), '855-070210071');
equal('not-a-number cell becomes blank', cleanText_(NaN), '');
equal('date cell becomes blank', cleanText_(new Date(2026, 0, 1)), '');

const normalized = normalizeRecords_([
    ['77130526882395', 0, 2.59, '85510852996'],
    ['', 0, 5, '855111'],
    ['77130526588457', 0, 2.26, '85590949280'],
    ['77130526882395', 0, 9.99, '855999999999']
]);
equal('normalize keeps unique records', normalized.records.length, 2);
equal('normalize counts blank barcode', normalized.skippedNoBarcode, 1);
equal('normalize counts in-file duplicates', normalized.duplicatesInFile, 1);
equal('in-file duplicate keeps last value', normalized.records[0].cod, 9.99);
equal('in-file duplicate keeps original position', normalized.records[0].barcode, '77130526882395');

const existing = [
    ['77130526882395', 0, 2.59, '85510852996'],
    ['77130526588457', 0, 2.26, '85590949280'],
    ['11600099026650', 0, 0, '855-070210071']
];

const upsert = planImport_(existing, normalizeRecords_([
    ['77130526882395', 0, 2.59, '85510852996'],
    ['77130526588457', 1.5, 7.77, '855700111222'],
    ['77130526999999', 0, 1.25, '855123456789']
]).records, 'upsert');
equal('upsert stats', upsert.stats, { added: 1, updated: 1, unchanged: 1 });
equal('upsert rewrites only the changed row', upsert.updatedRows, [1]);
equal('upsert leaves untouched row identical', upsert.rows[0], existing[0]);
equal('upsert leaves unmatched row identical', upsert.rows[2], existing[2]);
equal('upsert rewrites every changed field of the row',
    upsert.rows[1], ['77130526588457', 1.5, 7.77, '855700111222']);
equal('upsert appends the new barcode', upsert.appended, [['77130526999999', 0, 1.25, '855123456789']]);

const newOnly = planImport_(existing, normalizeRecords_([
    ['77130526588457', 0, 7.77, '85590949280'],
    ['77130526999999', 0, 1.25, '855123456789']
]).records, 'newOnly');
equal('newOnly stats', newOnly.stats, { added: 1, updated: 0, unchanged: 1 });
equal('newOnly never rewrites a row', newOnly.updatedRows, []);
equal('newOnly leaves existing block identical', newOnly.rows, existing);

const replace = planImport_(existing, normalizeRecords_([
    ['77130526999999', 0, 1.25, '855123456789']
]).records, 'replace');
equal('replace stats', replace.stats, { added: 1, updated: 0, unchanged: 0 });
equal('replace drops old rows', replace.rows, [['77130526999999', 0, 1.25, '855123456789']]);

const lowerIncoming = planImport_([['ABC123', 0, 1, '855']], normalizeRecords_([
    ['abc123', 0, 1, '855']
]).records, 'upsert');
equal('lowercase file matches uppercase sheet', lowerIncoming.stats, { added: 0, updated: 0, unchanged: 1 });

const upperIncoming = planImport_([['abc123', 0, 1, '855']], normalizeRecords_([
    ['ABC123', 0, 1, '855']
]).records, 'upsert');
equal('uppercase file matches lowercase sheet', upperIncoming.stats, { added: 0, updated: 0, unchanged: 1 });

const dupExisting = planImport_(
    [['X1', 0, 1, 'a'], ['X1', 0, 2, 'b']],
    normalizeRecords_([['X1', 0, 9, 'z']]).records,
    'upsert'
);
equal('duplicate rows in sheet update only the first', dupExisting.updatedRows, [0]);
equal('duplicate rows in sheet leave the second alone', dupExisting.rows[1], ['X1', 0, 2, 'b']);

const unknownMode = planImport_(existing, normalizeRecords_([['X9', 0, 1, 'a']]).records, 'nonsense');
equal('unknown mode falls back to upsert', unknownMode.mode, 'upsert');

equal('contiguous runs group neighbours', contiguousRuns_([0, 1, 2, 5, 7, 8]), [
    { start: 0, end: 2 }, { start: 5, end: 5 }, { start: 7, end: 8 }
]);
equal('contiguous runs on empty input', contiguousRuns_([]), []);

equal('sanitize drops out of range columns', sanitizeMapping_({ barcode: 0, dod: 9, cod: 2, phone: 3 }, 4),
    { barcode: 0, dod: -1, cod: 2, phone: 3 });
equal('sanitize drops non numeric', sanitizeMapping_({ barcode: 'x', dod: 1, cod: 2, phone: 3 }, 4),
    { barcode: -1, dod: 1, cod: 2, phone: 3 });

console.log('');
console.log('zto-import — ' + passed + ' assertions passed, ' + failed + ' failed');
if (failed) {
    failures.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
}
