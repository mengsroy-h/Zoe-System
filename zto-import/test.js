const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.env.ZTO_IMPORT_APP_DIR ? path.resolve(process.env.ZTO_IMPORT_APP_DIR) : __dirname;
const scriptPropertyStore = {};
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
                store: scriptPropertyStore,
                getProperty(key) { return this.store[key] || null; },
                setProperty(key, value) { this.store[key] = String(value); },
                deleteProperty(key) { delete this.store[key]; }
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

// ទឹកប្រាក់ជាអត្ថបទ ៖ «,» ឬ «.» ដែលមានតែមួយខ្ទង់ ១-២ ខាងក្រោយ ជាចុចទសភាគជានិច្ច · ក្រុម ៣ ខ្ទង់ច្រើនក្រុម ជាសញ្ញាបំបែកខ្ទង់ ·
// ក្រុមតែមួយ (1.234 · 1,234) ទាយមិនបាន ➜ សម្រេចតាមភស្តុតាងក្នុងឯកសារដដែល បើគ្មាន ➜ null (បដិសេធ)
const MONEY_TEXT_CASES = [
    ['5,50', '', 5.5], ['5,5', '', 5.5], ['0,75', '', 0.75], ['1234,5', '', 1234.5], ['5.50', '', 5.5], ['$ 13.18', '', 13.18],
    ['1.234,50', '', 1234.5], ['1,234.50', '', 1234.5], ['1.234.567', '', 1234567], ['1,234,567', '', 1234567], ['1 234,50', '', 1234.5],
    ['="5,50"', '', 5.5], ['-3,5', '', -3.5], ['12', '', 12], ['abc', '', 0], ['', '', 0],
    ['1.234', '', null], ['1,234', '', null], ['5,500', '', null], ['1.234', ',', 1234], ['1.234', '.', 1.23], ['1,234', '.', 1234], ['1,234', ',', 1.23],
    ['1,23,456', '', null], ['5-6', '', null], ['1.234,5.6', '', null]
];
for (const [cell, mark, expected] of MONEY_TEXT_CASES) {
    equal('money text «' + cell + '» (ចុចទសភាគក្នុងឯកសារ «' + mark + '»)', toMoney_(cell, mark), expected);
}
equal('money number stays a number (no text rule)', toMoney_(1234.567, ''), 1234.57);
const markOf = (cells) => (typeof sandbox.moneyDecimalMark_ === 'function' ? sandbox.moneyDecimalMark_(cells) : 'missing');
equal('decimal mark ៖ 5,50 ➜ «,»', markOf(['5,50', '20', '']), ',');
equal('decimal mark ៖ 1.234,50 ➜ «,»', markOf(['1.234,50']), ',');
equal('decimal mark ៖ 15.5 · 1,234,567 ➜ «.»', markOf(['15.5', '1,234,567', 7]), '.');
equal('decimal mark ៖ គ្មានភស្តុតាង (1.234 · 20) ➜ មិនដឹង', markOf(['1.234', '20']), '');
equal('decimal mark ៖ ភស្តុតាងផ្ទុយគ្នា (5,50 · 5.50) ➜ មិនដឹង', markOf(['5,50', '5.50']), '');
equal('normalizeRecords_ ៖ ឯកសារ «,» ➜ 1.234 = 1234 · 5,50 = 5.5', (() => {
    try { return normalizeRecords_([['A1', '1.234', '5,50', '0']]).records.map((r) => [r.dod, r.cod]); } catch (error) { return 'threw: ' + error.message; }
})(), [[1234, 5.5]]);
let ambiguousError = null;
try { normalizeRecords_([['A1', '1.234', '20', '0'], ['', '9,999', '', '']]); } catch (error) { ambiguousError = error; }
check('normalizeRecords_ ៖ ទឹកប្រាក់មិនច្បាស់ (1.234 គ្មានភស្តុតាង) ➜ បដិសេធ ហើយប្រាប់ Barcode និងតម្លៃ', !!ambiguousError
    && /អានមិនច្បាស់/.test(ambiguousError.message) && /A1/.test(ambiguousError.message) && /1\.234/.test(ambiguousError.message),
    ambiguousError && ambiguousError.message);
check('normalizeRecords_ ៖ ជួរដែលគ្មាន Barcode មិនបដិសេធឯកសារ', (() => { try { return normalizeRecords_([['A1', '2', '3', '0'], ['', '9,999', '', '']]).records.length === 1; } catch (_) { return false; } })());

// ករណី CSV ពេញ (ផ្លូវ Watch និងទំព័រ Web ត្រូវឲ្យលទ្ធផលដូចគ្នា) ៖ [ឈ្មោះ, ឯកសារ, អត្ថបទ, ជួរដេកដែលសរសេរ (null = បដិសេធ)]
const MONEY_CSV_CASES = [
    ['CSV ; + «,» ទសភាគ ៖ 5,50 = 5.50 · 1,5 = 1.5 · សូន្យខាងមុខនៅដដែល', 'eu.csv',
        'Barcode;Phone;COD($);DOD($)\n00888;011000444;5,50;1,5\n0099;012000111;12;0,75\n',
        [['00888', 1.5, 5.5, '011000444'], ['0099', 0.75, 12, '012000111']]],
    ['CSV ; ៖ 1.234,50 (ក្រុមខ្ទង់ «.») = 1234.50', 'eu-group.csv', 'Barcode;COD($)\n0012;1.234,50\n', [['0012', 0, 1234.5, '']]],
    ['CSV ; ៖ 1.234 សម្រេចដោយភស្តុតាង 5,50 ក្នុងឯកសារ ➜ 1234', 'eu-resolved.csv', 'Barcode;COD($);DOD($)\n0012;1.234;5,50\n', [['0012', 5.5, 1234, '']]],
    ['CSV , ៖ "1,234" សម្រេចដោយភស្តុតាង 15.5 ➜ 1234 (control ៖ ក្រុមខ្ទង់ «,» នៅដដែល)', 'us.csv',
        'Barcode,COD($),DOD($)\n0034,"1,234",15.5\n', [['0034', 15.5, 1234, '']]],
    ['CSV ; ៖ 1.234 គ្មានភស្តុតាង', 'eu-ambiguous.csv', 'Barcode;COD($)\n0012;1.234\n0013;20\n', null],
    ['CSV ; ៖ 5,500 គ្មានភស្តុតាង', 'eu-ambiguous2.csv', 'Barcode;COD($)\n0012;5,500\n', null]
];

equal('long barcode number keeps all digits', cleanText_(77130500002395), '77130500002395');
equal('text barcode is trimmed', cleanText_('  77130500002395 '), '77130500002395');
equal('phone with dash is untouched', cleanText_('855-070000071'), '855-070000071');
equal('not-a-number cell becomes blank', cleanText_(NaN), '');
equal('date cell becomes blank', cleanText_(new Date(2026, 0, 1)), '');

const normalized = normalizeRecords_([
    ['77130500002395', 0, 2.59, '85510000996'],
    ['', 0, 5, '855111'],
    ['77130500008457', 0, 2.26, '85590000280'],
    ['77130500002395', 0, 9.99, '855999999999']
]);
equal('normalize keeps unique records', normalized.records.length, 2);
equal('normalize counts blank barcode', normalized.skippedNoBarcode, 1);
equal('normalize counts in-file duplicates', normalized.duplicatesInFile, 1);
equal('in-file duplicate keeps last value', normalized.records[0].cod, 9.99);
equal('in-file duplicate keeps original position', normalized.records[0].barcode, '77130500002395');

const existing = [
    ['77130500002395', 0, 2.59, '85510000996'],
    ['77130500008457', 0, 2.26, '85590000280'],
    ['11600000006650', 0, 0, '855-070000071']
];

const upsert = planImport_(existing, normalizeRecords_([
    ['77130500002395', 0, 2.59, '85510000996'],
    ['77130500008457', 1.5, 7.77, '855700111222'],
    ['77130526999999', 0, 1.25, '855123456789']
]).records, 'upsert');
equal('upsert stats', upsert.stats, { added: 1, updated: 1, unchanged: 1 });
equal('upsert rewrites only the changed row', upsert.updatedRows, [1]);
equal('upsert leaves untouched row identical', upsert.rows[0], existing[0]);
equal('upsert leaves unmatched row identical', upsert.rows[2], existing[2]);
equal('upsert rewrites every changed field of the row',
    upsert.rows[1], ['77130500008457', 1.5, 7.77, '855700111222']);
equal('upsert appends the new barcode', upsert.appended, [['77130526999999', 0, 1.25, '855123456789']]);

const newOnly = planImport_(existing, normalizeRecords_([
    ['77130500008457', 0, 7.77, '85590000280'],
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

// រត់ច្រក importRows ពិត ជាមួយ grid មានពិដាន និងការបដិសេធសរសេរ។
function importFixture(initial, capacity, options) {
    const settings = options || {};
    const state = { rows: JSON.parse(JSON.stringify(initial)), capacity, releases: 0, clears: 0 };
    const sheet = {
        getName: () => 'Customers',
        getMaxRows: () => state.capacity,
        getLastRow: () => {
            let length = state.rows.length;
            while (length && state.rows[length - 1].every((value) => value === '')) length--;
            return length;
        },
        insertRowsAfter(at, count) {
            if (settings.failResize) throw new Error('synthetic-resize-rejected');
            if (at !== state.capacity) throw new Error('synthetic-invalid-insert');
            state.capacity += count;
        },
        getRange(start, col, count, width) {
            if (start + count - 1 > state.capacity) throw new Error('synthetic-grid-overflow');
            return {
                getValues: () => Array.from({ length: count }, (_, i) =>
                    (state.rows[start - 1 + i] || ['', '', '', '']).slice(col - 1, col - 1 + width)),
                setNumberFormat() {},
                clearContent() {
                    if (settings.failClear) throw new Error('synthetic-clear-rejected');
                    state.clears++;
                    for (let i = 0; i < count; i++) state.rows[start - 1 + i] = ['', '', '', ''];
                },
                setValues(values) {
                    if (settings.failWrite) throw new Error('synthetic-write-rejected');
                    for (let i = 0; i < count; i++) state.rows[start - 1 + i] = Array.from(values[i]);
                }
            };
        }
    };
    const context = vm.createContext({
        PropertiesService: { getScriptProperties: () => ({
            getProperty: (key) => ({ IMPORT_PASSWORD: 'synthetic-password', SHEET_ID: 'synthetic-sheet' })[key],
            setProperty() { if (settings.failMappingStore) throw new Error('synthetic-properties-quota'); }
        }) },
        SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush() { if (settings.failFlush) throw new Error('synthetic-flush-rejected'); } },
        LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() { state.releases++; } }) },
        ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ text, setMimeType() { return this; } }) }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), context);
    const postRaw = (contents) => JSON.parse(context.doPost({ postData: { contents } }).text);
    const post = (body) => postRaw(JSON.stringify(body));
    return { state, run: (rows) => context.importRows('synthetic-password', { rows, mode: 'replace' }), post, postRaw };
}

const originalRows = [['barcode', 'dod', 'cod', 'phone'], ['OLD001', 1, 2, '012345678']];
const incomingRows = [['NEW001', 1, 3, '012345678'], ['NEW002', 1, 4, '012345679']];
for (const rows of [[], [['', 0, 0, '']]]) {
    const fixture = importFixture(originalRows, 5);
    let rejected = false;
    try { fixture.run(rows); } catch (_) { rejected = true; }
    check('replace គ្មាន Barcode ប្រើបាន ➜ បដិសេធ', rejected);
    equal('replace គ្មាន Barcode ប្រើបាន ➜ ទិន្នន័យដើមនៅដដែល', fixture.state.rows, originalRows);
    check('replace គ្មាន Barcode ប្រើបាន ➜ មិនលុបជួរ', fixture.state.clears === 0);
}
{
    const fixture = importFixture(originalRows, 2);
    let result;
    try { result = fixture.run(incomingRows); } catch (_) {}
    check('replace ធំជាង grid ➜ ពង្រីកជាមុន ហើយសរសេរពេញលេញ',
        result && result.rowsAfter === 2 && fixture.state.capacity >= 3);
    equal('replace ធំជាង grid ➜ ទិន្នន័យត្រូវគ្នាពិត', fixture.state.rows.slice(1), incomingRows);
    check('replace ធំជាង grid ➜ ដោះសោវិញ', fixture.state.releases === 1);
}
for (const failure of ['failWrite', 'failResize']) {
    const fixture = importFixture(originalRows, failure === 'failWrite' ? 5 : 2, { [failure]: true });
    let rejected = false;
    try { fixture.run(incomingRows); } catch (_) { rejected = true; }
    check('replace ' + failure + ' ➜ ប្រាប់ការបរាជ័យ', rejected);
    equal('replace ' + failure + ' ➜ ទិន្នន័យដើមមិនបាត់', fixture.state.rows, originalRows);
    check('replace ' + failure + ' ➜ មិនលុបមុនសរសេរជោគជ័យ', fixture.state.clears === 0);
    check('replace ' + failure + ' ➜ ដោះសោវិញ', fixture.state.releases === 1);
}
{
    const fixture = importFixture([originalRows[0], ...incomingRows], 5);
    const result = fixture.run([incomingRows[0]]);
    check('replace តូចជាងមុន ➜ លុបតែជួរចាស់លើស និងមិនទុកសំណល់',
        result.rowsAfter === 1 && fixture.state.rows[2].every((value) => value === ''));
    equal('replace តូចជាងមុន ➜ ក្បាលតារាងនៅដដែល', fixture.state.rows[0], originalRows[0]);
}

{
    const { keptFields_ } = sandbox;
    const existingRows = [['K1', 2.5, 10, '012'], ['K2', 1, 4, '013']];
    const fileRows = normalizeRecords_([['K1', '', 11, ''], ['K3', '', 5, '']]).records;
    const keep = keptFields_({ barcode: 0, dod: -1, cod: 1, phone: -1 });
    equal('Column ដែល «មិនប្រើ» ➜ keep', keep, { dod: true, cod: false, phone: true });
    const plan = planImport_(existingRows, fileRows, 'upsert', keep);
    equal('upsert មិនលុប DOD · Phone ចាស់ពេល Column មិនបានផ្គូផ្គង', plan.rows[0], ['K1', 2.5, 11, '012']);
    check('upsert ជួរថ្មី ➜ បន្ថែម', plan.appended.length === 1 && plan.appended[0][0] === 'K3');
    equal('upsert COD ដដែល + Column ផ្សេងមិនផ្គូផ្គង ➜ ដដែល', planImport_(existingRows, normalizeRecords_([['K2', '', 4, '']]).records, 'upsert', keep).stats, { added: 0, updated: 0, unchanged: 1 });
    equal('គ្មាន mapping (អ្នកហៅចាស់) ➜ ឥរិយាបថដដែល', keptFields_(undefined), { dod: false, cod: false, phone: false });
    equal('mapping ពេញ ➜ សរសេរគ្រប់ Column', planImport_(existingRows, fileRows, 'upsert', keptFields_({ barcode: 0, dod: 1, cod: 2, phone: 3 })).rows[0], ['K1', 0, 11, '']);
}
function zoewSheetImportConst(name) {
    const files = [path.join(root, '..', 'ZoeW', 'src', 'features', 'sheet-import.ts'), path.join(root, '..', 'ZoeW', 'app.js')];
    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        const found = new RegExp('const ' + name + '\\s*=\\s*(\\d+)\\s*;').exec(fs.readFileSync(file, 'utf8'));
        if (found) return Number(found[1]);
    }
    return null;
}
{
    const codeGs = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8');
    const declared = /var\s+LOCK_WAIT_MS\s*=\s*(\d+)\s*;/.exec(codeGs);
    const timeout = zoewSheetImportConst('SHEET_IMPORT_TIMEOUT_MS');
    check('LOCK_WAIT_MS ខ្លីជាងពេលរង់ចាំ ZoeW ➜ ការនាំចូលដែលចាប់ផ្ដើមសរសេរ មិនត្រូវ ZoeW រាយការណ៍ថាបរាជ័យ',
        !!declared && timeout !== null && Number(declared[1]) + 5000 <= timeout,
        timeout === null ? 'វាស់មិនបាន ៖ រកមិនឃើញ SHEET_IMPORT_TIMEOUT_MS ក្នុង ZoeW/src ឬ ZoeW/app.js' : (declared && declared[1]) + ' vs ' + timeout);
    const version = /var\s+SCRIPT_VERSION\s*=\s*(\d+)\s*;/.exec(codeGs);
    const keepVersion = zoewSheetImportConst('SHEET_IMPORT_KEEP_UNMAPPED_VERSION');
    check('កំណែអ្នកសរសេរដែលរក្សា Column «មិនប្រើ» (keptFields_) ≥ កំណែដែល ZoeW ទុកចិត្តឲ្យ upsert ដោយ Column «មិនប្រើ»',
        !!version && keepVersion !== null && /function keptFields_\(/.test(codeGs) && Number(version[1]) >= keepVersion,
        keepVersion === null ? 'វាស់មិនបាន ៖ រកមិនឃើញ SHEET_IMPORT_KEEP_UNMAPPED_VERSION' : (version && version[1]) + ' vs ' + keepVersion);
}
{
    const header = ['barcode', 'dod', 'cod', 'phone'];
    const upsert = (rows) => ({ action: 'import', password: 'synthetic-password', payload: { rows, mode: 'upsert', mapping: { barcode: 0, dod: 1, cod: 2, phone: 3 }, signature: 'sig' } });
    const updateThenAppend = importFixture([header, ['BC1', 0, 1, '012']], 2, { failResize: true });
    const partial = updateThenAppend.post(upsert([['BC1', 0, 3, '012'], ['NEW1', 0, 4, '013']]));
    check('upsert ៖ កែជួរចាស់រួច ទើបបន្ថែមបរាជ័យ ➜ ok:false + written:true (ZoeW ចាត់ទុក «មិនទាន់ដឹងលទ្ធផល»)',
        partial.ok === false && partial.written === true && updateThenAppend.state.rows[1][2] === 3, JSON.stringify(partial));
    const flushFails = importFixture([header, ['BC1', 0, 1, '012']], 5, { failFlush: true });
    const flushed = flushFails.post(upsert([['BC1', 0, 3, '012']]));
    check('upsert ៖ សរសេររួច flush បរាជ័យ ➜ written:true', flushed.ok === false && flushed.written === true, JSON.stringify(flushed));
    const replaceResize = importFixture([header, ['OLD1', 0, 1, '012']], 2, { failResize: true });
    const refusedResize = replaceResize.post({ action: 'import', password: 'synthetic-password', payload: { rows: [['N1', 0, 1, '1'], ['N2', 0, 2, '2']], mode: 'replace' } });
    check('replace ៖ ពង្រីក grid បរាជ័យមុនសរសេរ ➜ written:false (ZoeW បង្ហាញ ❌ ច្បាស់)', refusedResize.ok === false && refusedResize.written === false, JSON.stringify(refusedResize));
    const wrongPassword = importFixture([header, ['BC1', 0, 1, '012']], 5).post(Object.assign(upsert([['BC1', 0, 3, '012']]), { password: 'wrong' }));
    check('ពាក្យសម្ងាត់ខុស ➜ written:false', wrongPassword.ok === false && wrongPassword.written === false, JSON.stringify(wrongPassword));
    const unreadable = importFixture([header], 5).postRaw('{not json');
    check('សំណើអានមិនបាន ➜ written:false', unreadable.ok === false && unreadable.written === false, JSON.stringify(unreadable));
    const mappingStore = importFixture([header, ['BC1', 0, 1, '012']], 5, { failMappingStore: true });
    const stored = mappingStore.post(upsert([['BC1', 0, 3, '012']]));
    check('រក្សា mapping បរាជ័យក្រោយសរសេររួច ➜ ok:true (mappingSaved:false) មិនមែនការបរាជ័យ',
        stored.ok === true && stored.data && stored.data.mappingSaved === false && mappingStore.state.rows[1][2] === 3, JSON.stringify(stored));
    const clearAfter = importFixture([header, ['BC1', 0, 1, '012']], 5, { failFlush: true });
    const cleared = clearAfter.post({ action: 'clear', password: 'synthetic-password', confirm: 'CLEAR' });
    check('clear ៖ លុបរួច flush បរាជ័យ ➜ written:true', cleared.ok === false && cleared.written === true, JSON.stringify(cleared));
    const clearRefused = importFixture([header, ['BC1', 0, 1, '012']], 5, { failClear: true });
    const notCleared = clearRefused.post({ action: 'clear', password: 'synthetic-password', confirm: 'CLEAR' });
    check('clear ៖ clearContent បរាជ័យ ➜ written:false · ជួរនៅដដែល', notCleared.ok === false && notCleared.written === false && clearRefused.state.rows[1][0] === 'BC1', JSON.stringify(notCleared));
    const ok = importFixture([header, ['BC1', 0, 1, '012']], 5).post(upsert([['BC1', 0, 3, '012']]));
    check('ចម្លើយជោគជ័យមាន scriptVersion ជាលេខ (ZoeW អានកំណែអ្នកសរសេរ)', ok.ok === true && Number.isFinite(ok.scriptVersion), JSON.stringify(ok));
}
{
    const watch = Object.assign({}, sandbox);
    vm.createContext(watch);
    vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), watch, { filename: 'Code.gs' });
    vm.runInContext(fs.readFileSync(path.join(root, 'Watch.gs'), 'utf8'), watch, { filename: 'Watch.gs' });
    const found = watch.resolveHeaderAndMapping_([
        ['Waybill Details 2026-10-20', '', ''],
        ['Waybill No', 'Receiver Phone', 'COD Amount'],
        ['ZT000001', '012000111', 5]
    ]);
    check('Watch ៖ ជួរចំណងជើង (Barcode តែម្ដង) មិនឈ្នះជួរ header ពិត', found && found.headerRow === 1 && found.mapping.cod === 2 && found.mapping.phone === 1, JSON.stringify(found));
    const file = (name, created, mime) => ({ getId: () => name.replace(/\./g, '-'), getName: () => name, getDateCreated: () => new Date(created), getMimeType: () => mime || 'text/csv', moved: null, moveTo(folder) { this.moved = folder.getId(); } });
    const files = [file('new.csv', 3000), file('photo.png', 1000, 'image/png'), file('old.csv', 2000)];
    const inbox = { getFiles() { let i = 0; return { hasNext: () => i < files.length, next: () => files[i++] }; } };
    equal('Watch ៖ ឯកសារចាស់មុន ថ្មីក្រោយ (ថ្មីឈ្នះ)', watch.oldestInboxFiles_(inbox, 10).map((f) => f.getName()), ['photo.png', 'old.csv', 'new.csv']);
    watch.readProp_ = (name) => ({ SHEET_ID: 'target', INBOX_FOLDER_ID: 'in', DONE_FOLDER_ID: 'done', FAILED_FOLDER_ID: 'failed' })[name] || '';
    watch.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
    watch.DriveApp = { getFolderById: (id) => (id === 'in' ? inbox : { getId: () => id }) };
    const imported = [];
    watch.importDriveFile_ = (f) => { imported.push(f.getName()); if (f.getName() === 'old.csv') { f.moveTo = () => { throw new Error('quota'); }; } return { added: 1, updated: 0, unchanged: 0 }; };
    let mail = '';
    watch.notify_ = (_subject, body) => { mail = body; };
    let watchError;
    try { watch[watch.WATCH_TRIGGER_FN](); } catch (error) { watchError = error; }
    check('Watch ៖ handler ពិតអាចរត់ចប់', !watchError, watchError && watchError.message);
    equal('Watch ៖ នាំចូលតាមលំដាប់', imported, ['old.csv', 'new.csv']);
    check('Watch ៖ ឯកសារមិនមែន Excel ចេញពីប្រអប់ (មិនស្ទះ)', files[1].moved === 'failed');
    check('Watch ៖ ផ្លាស់ទីបរាជ័យមិនបញ្ឈប់រង្វិល · អ៊ីមែលនៅតែផ្ញើ', /new\.csv/.test(mail) && /ផ្លាស់ទីឯកសារមិនបាន/.test(mail), mail);
}

function blobOfBytes(buffer) {
    return {
        getBytes: () => Array.from(buffer, (byte) => (byte > 127 ? byte - 256 : byte)),
        getDataAsString(charset) {
            const name = String(charset || 'UTF-8').toUpperCase();
            if (name === 'UTF-16LE') return buffer.toString('utf16le');
            if (name === 'UTF-16BE') return Buffer.from(buffer).swap16().toString('utf16le');
            return buffer.toString('utf8');
        }
    };
}

// គំរូការបំលែង CSV ➜ Google Sheets របស់ Drive (`convert: true`) ៖ Sheets បំលែងអត្ថបទដែលមើលទៅដូចលេខ ទៅជាលេខ
// (លំនាំដើមរបស់ការនាំចូល CSV) ➜ សូន្យខាងមុខ និង + បាត់ ⛔ មិនមែនកូដរបស់ Watch.gs ទេ
function sheetsCsvConversionModel(text, delimiter) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
        } else if (ch === '"' && cell === '') quoted = true;
        else if (ch === delimiter) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map((r) => r.map((value) => (/^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/.test(value) ? Number(value) : value)));
}

function watcherAccessFixture(handlers, options) {
    const settings = options || {};
    const source = settings.source || null;
    const state = {
        effects: [],
        serviceCalls: [],
        rows: [['Barcode', 'DOD($)', 'COD($)', 'Phone'], ['SYNTHETIC-OLD', 0, 1, '000']],
        moved: '',
        releases: 0,
        conversions: 0,
        removedCopies: [],
        converted: {},
        triggers: (handlers || []).map((name) => ({ getHandlerFunction: () => name }))
    };
    const properties = {
        SHEET_ID: 'synthetic-target', IMPORT_PASSWORD: 'synthetic-password',
        INBOX_FOLDER_ID: 'in', DONE_FOLDER_ID: 'done', FAILED_FOLDER_ID: 'failed',
        NOTIFY_EMAIL: 'synthetic@example.invalid'
    };
    if (settings.passwordMissing) delete properties.IMPORT_PASSWORD;
    const service = (name) => state.serviceCalls.push(name);
    const sourceRows = [['Barcode', 'DOD($)', 'COD($)', 'Phone'], ['SYNTHETIC-NEW', 2, 3, '001']];
    const file = {
        getId: () => 'synthetic-source', getName: () => (source ? source.name : 'synthetic-sheet'),
        getDateCreated: () => new Date(1), getMimeType: () => (source ? source.mime : 'application/vnd.google-apps.spreadsheet'),
        getBlob() { service('blob'); return blobOfBytes(source ? source.bytes : Buffer.alloc(0)); },
        moveTo(folder) { state.effects.push('move'); state.moved = folder.getId(); }
    };
    const folders = {};
    for (const id of ['in', 'done', 'failed']) {
        folders[id] = {
            getId: () => id, getUrl: () => 'https://example.invalid/' + id,
            getFiles() {
                const files = state.moved ? [] : [file];
                let index = 0;
                return { hasNext: () => index < files.length, next: () => files[index++] };
            }
        };
    }
    const sheet = {
        getName: () => 'Customers', getParent: () => ({ getName: () => 'Synthetic target' }),
        getLastRow: () => state.rows.length, getMaxRows: () => 20,
        getRange(start, col, count, width) {
            service('sheet-range');
            return {
                getValues: () => Array.from({ length: count }, (_, index) => (state.rows[start - 1 + index] || ['', '', '', '']).slice(col - 1, col - 1 + width)),
                setNumberFormat() {},
                setValues(values) {
                    state.effects.push('write');
                    for (let index = 0; index < count; index++) state.rows[start - 1 + index] = Array.from(values[index]);
                },
                clearContent() {
                    state.effects.push('clear');
                    for (let index = 0; index < count; index++) state.rows[start - 1 + index] = ['', '', '', ''];
                }
            };
        }
    };
    const context = vm.createContext({
        Logger: { log() { service('log'); } },
        Utilities: {
            DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
            computeDigest(_algorithm, value) { service('digest'); return Array.from(require('crypto').createHash('sha256').update(value).digest(), (byte) => byte > 127 ? byte - 256 : byte); }
        },
        PropertiesService: { getScriptProperties() {
            service('properties');
            return {
                getProperty: (key) => properties[key] || null,
                setProperty(key, value) { state.effects.push('property'); properties[key] = String(value); },
                deleteProperty(key) { state.effects.push('property-delete'); delete properties[key]; }
            };
        } },
        LockService: { getScriptLock() {
            service('lock');
            return { tryLock: () => !settings.lockBusy, releaseLock() { state.releases++; } };
        } },
        DriveApp: { getFolderById(id) { service('folder'); if (!folders[id]) throw new Error('synthetic-folder'); return folders[id]; } },
        Drive: { Files: {
            copy(resource, id, copyOptions) {
                if (!source || id !== 'synthetic-source' || !copyOptions || copyOptions.convert !== true) throw new Error('unexpected-conversion');
                service('convert');
                state.conversions++;
                const copyId = 'synthetic-converted-' + state.conversions;
                state.converted[copyId] = source.converted ? source.converted()
                    : sheetsCsvConversionModel(source.bytes.toString('utf8'), source.mime === 'text/tab-separated-values' ? '\t' : ',');
                return { id: copyId };
            },
            remove(id) {
                if (!source || !state.converted[id]) throw new Error('unexpected-conversion');
                state.removedCopies.push(id);
            }
        } },
        MailApp: { sendEmail(_to, _subject, body) { service('mail'); state.effects.push('mail'); state.mail = String(body); } },
        MimeType: { GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet' },
        ScriptApp: {
            getProjectTriggers() { service('list-triggers'); return state.triggers.slice(); },
            deleteTrigger(trigger) { service('delete-trigger'); state.effects.push('delete-trigger'); state.triggers = state.triggers.filter((item) => item !== trigger); },
            newTrigger(name) {
                service('new-trigger');
                let minutes;
                const builder = {
                    timeBased() { return this; }, everyMinutes(value) { minutes = value; return this; },
                    create() { state.effects.push('create-trigger'); state.triggers.push({ getHandlerFunction: () => name, minutes }); }
                };
                return builder;
            }
        },
        SpreadsheetApp: {
            openById(id) {
                service('spreadsheet');
                if (id === 'synthetic-target') return { getSheetByName: () => sheet };
                if (state.converted[id]) {
                    const values = state.converted[id];
                    return { getSheets: () => [{ getLastRow: () => values.length, getLastColumn: () => Math.max(0, ...values.map((row) => row.length)),
                        getRange: () => ({ getValues: () => values.map((row) => row.slice()) }) }] };
                }
                if (id !== 'synthetic-source' || source) throw new Error('synthetic-spreadsheet');
                return { getSheets: () => [{ getLastRow: () => sourceRows.length, getLastColumn: () => sourceRows[0].length, getRange: () => ({ getValues: () => sourceRows }) }] };
            },
            flush() { service('flush'); }
        }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), context, { filename: 'Code.gs' });
    const codeGlobals = new Set(Object.keys(context));
    vm.runInContext(fs.readFileSync(path.join(root, 'Watch.gs'), 'utf8'), context, { filename: 'Watch.gs' });
    const watchFunctions = Object.keys(context).filter((name) => !codeGlobals.has(name) && typeof context[name] === 'function');
    const publicFunctions = Object.keys(context).filter((name) => typeof context[name] === 'function' && !name.endsWith('_'));
    function scriptRunner(success, failure) {
        const runner = {
            withSuccessHandler: (next) => scriptRunner(next, failure),
            withFailureHandler: (next) => scriptRunner(success, next)
        };
        for (const name of publicFunctions) {
            runner[name] = (...args) => {
                let result;
                try { result = context[name](...args); } catch (error) { if (failure) failure(error); else throw error; return; }
                if (success) success(result);
            };
        }
        return runner;
    }
    const google = { script: { run: scriptRunner() } };
    function browser(name, args) {
        const outcome = {};
        const runner = google.script.run.withSuccessHandler((value) => { outcome.value = value; outcome.ok = true; })
            .withFailureHandler((error) => { outcome.error = error; outcome.ok = false; });
        try { runner[name](...(args || [])); } catch (error) { outcome.error = error; outcome.ok = false; }
        return outcome;
    }
    return { context, state, watchFunctions, publicFunctions, google, browser };
}

{
    const fixture = watcherAccessFixture();
    equal('Watch ៖ ផ្ទៃ function សាធារណៈមានតែច្រក Web និង API ដែលបានកំណត់', fixture.publicFunctions.sort(), ['clearRows', 'doGet', 'doPost', 'getStatus', 'importRows', 'prepare']);
    check('Watch ៖ វាស់ helper ពិតគ្រប់គ្រាន់ ហើយទាំងអស់ជាឯកជន', fixture.watchFunctions.length >= 12 && fixture.watchFunctions.every((name) => name.endsWith('_')), fixture.watchFunctions.join(', '));
    equal('Watch ៖ google.script.run បង្ហាញតែ function សាធារណៈដូចឯកសារ Google', Object.keys(fixture.google.script.run).filter((name) => !name.startsWith('with')).sort(), fixture.publicFunctions.sort());
    const names = new Set([...fixture.watchFunctions, 'setupInboxWatch', 'removeInboxWatch', 'watchInboxFolder', 'setupInboxWatch_', 'removeInboxWatch_', 'watchInboxFolder_']);
    for (const name of names) {
        const attempt = watcherAccessFixture(['watchInboxFolder', 'watchInboxFolder_', 'unrelatedJob']);
        const outcome = attempt.browser(name);
        check('Watch browser ៖ ' + name + ' ត្រូវបដិសេធ', outcome.ok === false);
        equal('Watch browser ៖ ' + name + ' មិនប៉ះ service ណាមួយ', attempt.state.serviceCalls, []);
        equal('Watch browser ៖ ' + name + ' មិនសរសេរ ឬកែ trigger', attempt.state.effects, []);
    }
}
{
    const fixture = watcherAccessFixture(['watchInboxFolder', 'watchInboxFolder_', 'unrelatedJob', 'watchInboxFolder']);
    let result;
    try { result = fixture.context.setupInboxWatch_(); } catch (_) {}
    check('Watch owner ៖ private setup អាចរត់ក្នុង editor', typeof result === 'string' && result.includes('https://example.invalid/in'));
    equal('Watch owner ៖ setup ជំនួស trigger ចាស់និងថ្មី ដោយរក្សា job ផ្សេង', fixture.state.triggers.map((trigger) => trigger.getHandlerFunction()).sort(), ['unrelatedJob', 'watchInboxFolder_']);
    const trigger = fixture.state.triggers.find((item) => item.getHandlerFunction() === 'watchInboxFolder_');
    check('Watch owner ៖ trigger ថ្មីភ្ជាប់ private worker និងចន្លោះពេលតាម source', !!trigger && typeof fixture.context[trigger.getHandlerFunction()] === 'function' && trigger.minutes === fixture.context.WATCH_INTERVAL_MINUTES);
    try { fixture.context.setupInboxWatch_(); } catch (_) {}
    equal('Watch owner ៖ setup ម្តងទៀតមិនបង្កើត job ស្ទួន', fixture.state.triggers.map((item) => item.getHandlerFunction()).sort(), ['unrelatedJob', 'watchInboxFolder_']);
    let removed;
    try { removed = fixture.context.removeInboxWatch_(); } catch (_) {}
    equal('Watch owner ៖ private remove លុប current job មួយ', removed, 1);
    equal('Watch owner ៖ remove រក្សា job ផ្សេង', fixture.state.triggers.map((item) => item.getHandlerFunction()), ['unrelatedJob']);
    const legacy = watcherAccessFixture(['watchInboxFolder', 'watchInboxFolder_', 'unrelatedJob']);
    try { removed = legacy.context.removeInboxWatch_(); } catch (_) { removed = undefined; }
    equal('Watch owner ៖ remove ស្គាល់ persistent handler ចាស់និងថ្មី', removed, 2);
    equal('Watch owner ៖ legacy cleanup មិនប៉ះ job ផ្សេង', legacy.state.triggers.map((item) => item.getHandlerFunction()), ['unrelatedJob']);
}
{
    const fixture = watcherAccessFixture();
    let error;
    try { fixture.context[fixture.context.WATCH_TRIGGER_FN](); } catch (caught) { error = caught; }
    check('Watch schedule ៖ handler អាចរត់ដោយគ្មាន browser password', !error && fixture.state.rows.some((row) => row[0] === 'SYNTHETIC-NEW'), error && error.message);
    check('Watch schedule ៖ ឯកសាររួចចូល Done ហើយដោះសោ', fixture.state.moved === 'done' && fixture.state.releases === 1 && fixture.state.effects.includes('mail'));
    const busy = watcherAccessFixture([], { lockBusy: true });
    try { busy.context[busy.context.WATCH_TRIGGER_FN](); } catch (_) {}
    equal('Watch schedule ៖ lock កំពុងប្រើ មិនសរសេរ ឬផ្លាស់ទី', busy.state.effects, []);
}
{
    // ឯកសារអត្ថបទ (CSV · TSV · .txt) ត្រូវអានជាអត្ថបទដូចទំព័រ Web (raw) ➜ សូន្យខាងមុខរបស់ Barcode/លេខទូរស័ព្ទ និង + មិនបាត់
    const runSource = (name, mime, bytes, converted) => {
        const fixture = watcherAccessFixture([], { source: { name, mime, bytes, converted } });
        let error;
        try { fixture.context[fixture.context.WATCH_TRIGGER_FN](); } catch (caught) { error = caught; }
        return { state: fixture.state, error, added: fixture.state.rows.slice(2).map((row) => row.slice()) };
    };
    const csv = runSource('zto.csv', 'text/csv', Buffer.from('Barcode,DOD($),COD($),Phone\n0012300456,1.5,2,012345678\nZT0002,0,3.25,+85512345678\n'));
    equal('Watch CSV ៖ សូន្យខាងមុខរបស់ Barcode និងលេខទូរស័ព្ទ · + នៅដដែល', csv.added,
        [['0012300456', 1.5, 2, '012345678'], ['ZT0002', 0, 3.25, '+85512345678']]);
    check('Watch CSV ៖ អានជាអត្ថបទ (មិនបំលែងតាម Drive) · ឯកសារចូល Done', !csv.error && csv.state.conversions === 0 && csv.state.moved === 'done',
        JSON.stringify({ error: csv.error && csv.error.message, conversions: csv.state.conversions, moved: csv.state.moved }));
    const quoted = runSource('quoted.csv', 'text/csv', Buffer.from('﻿Waybill No,Receiver Phone,COD Amount,Remark\r\n'
        + '"ZT-B1","012 000 111","5","say ""hi"", then\r\nleave"\r\n\r\nZT-B2,0970000222,7.5,plain\r\n', 'utf8'));
    equal('Watch CSV ៖ cell មាន , · ចុះបន្ទាត់ · "" ក្នុងសញ្ញាដកស្រង់ · CRLF · BOM · ជួរទទេ', quoted.added,
        [['ZT-B1', 0, 5, '012 000 111'], ['ZT-B2', 0, 7.5, '0970000222']]);
    const tsv = runSource('zto.tsv', 'text/tab-separated-values', Buffer.from('Barcode\tPhone\tCOD($)\n00777\t010000333\t4\n'));
    equal('Watch TSV ៖ បំបែកដោយ tab · សូន្យខាងមុខនៅដដែល', tsv.added, [['00777', 0, 4, '010000333']]);
    const semicolon = runSource('zto.txt', 'text/plain', Buffer.from('Barcode;Phone;COD($)\n00888;011000444;2.5\n'));
    equal('Watch .txt ៖ រកសញ្ញាបំបែក (;) ពីជួរ header · សូន្យខាងមុខនៅដដែល', semicolon.added, [['00888', 0, 2.5, '011000444']]);
    const unicodeText = runSource('unicode.txt', 'text/plain',
        Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Barcode\tPhone\r\n00999\t012000555\r\n', 'utf16le')]));
    equal('Watch «Unicode Text» របស់ Excel (UTF-16LE + BOM · tab) ៖ អានបាន · សូន្យខាងមុខនៅដដែល', unicodeText.added, [['00999', 0, 0, '012000555']]);
    const labelled = runSource('export.csv', 'application/vnd.ms-excel', Buffer.from('Barcode,Phone\n000111,016000666\n'));
    equal('Watch ៖ CSV ដែល Drive ដាក់ប្រភេទ Excel (upload ពី Windows) នៅអានជាអត្ថបទ', labelled.added, [['000111', 0, 0, '016000666']]);
    check('Watch ៖ CSV ប្រភេទ Excel មិនបំលែងតាម Drive', labelled.state.conversions === 0, String(labelled.state.conversions));
    const hinted = runSource('hint.csv', 'text/csv', Buffer.from('sep=;\nBarcode;Phone\n="000222";="017000888"\n'));
    equal('Watch CSV ៖ បន្ទាត់ sep= · cell ="…" របស់ Excel ជាអត្ថបទ', hinted.added, [['000222', 0, 0, '017000888']]);
    const blank = runSource('blank.csv', 'text/csv', Buffer.from('\r\n\r\n  \r\n'));
    check('Watch CSV ៖ មានតែជួរទទេ ➜ «ឯកសារទទេ» · ចូល Failed', blank.state.moved === 'failed' && /ឯកសារទទេ/.test(blank.state.mail || ''),
        JSON.stringify({ moved: blank.state.moved, mail: blank.state.mail }));
    const xlsx = runSource('zto.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        Buffer.from('PK\u0003\u0004synthetic-xlsx', 'latin1'), () => [['Barcode', 'Phone'], ['ZTX1', '012000777']]);
    equal('control ៖ xlsx (ZIP) នៅបំលែងតាម Drive', xlsx.added, [['ZTX1', 0, 0, '012000777']]);
    check('control ៖ xlsx ➜ Drive.Files.copy ១ ដង · លុបឯកសារបណ្តោះអាសន្ន', xlsx.state.conversions === 1 && xlsx.state.removedCopies.length === 1,
        JSON.stringify({ conversions: xlsx.state.conversions, removed: xlsx.state.removedCopies }));
    const ole = runSource('zto.xls', 'application/vnd.ms-excel', Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
        () => [['Barcode', 'Phone'], ['ZTX2', '012000888']]);
    const html = runSource('table.xls', 'application/vnd.ms-excel', Buffer.from('  <html><table><tr><td>Barcode</td></tr></table></html>'),
        () => [['Barcode', 'Phone'], ['ZTX3', '012000999']]);
    check('control ៖ xls (OLE) និង HTML ដែលដាក់ឈ្មោះ .xls នៅបំលែងតាម Drive', ole.state.conversions === 1 && html.state.conversions === 1
        && JSON.stringify(ole.added) === JSON.stringify([['ZTX2', 0, 0, '012000888']]) && JSON.stringify(html.added) === JSON.stringify([['ZTX3', 0, 0, '012000999']]),
        JSON.stringify({ ole: ole.added, html: html.added }));

    // CSV ពីតំបន់ដែលប្រើ «,» ជាចុចទសភាគ (Excel ក្នុងតំបន់នោះបំបែក column ដោយ ;) ➜ 5,50 = 5.50 មិនមែន 550 · ទឹកប្រាក់ដែលនៅមិនច្បាស់ ➜ បដិសេធ មិនទាយ
    for (const [label, name, text, expected] of MONEY_CSV_CASES) {
        const run = runSource(name, 'text/csv', Buffer.from(text));
        if (expected) {
            equal('Watch ' + label, run.added, expected);
        } else {
            check('Watch ' + label + ' ៖ បដិសេធ (Failed · អ៊ីមែលប្រាប់តម្លៃ) · មិនសរសេរ Sheet', run.state.moved === 'failed' && !run.state.effects.includes('write')
                && /អានមិនច្បាស់/.test(run.state.mail || '') && /1\.234|5,500/.test(run.state.mail || ''),
                JSON.stringify({ moved: run.state.moved, effects: run.state.effects, mail: run.state.mail, added: run.added }));
        }
    }
}
{
    for (const password of [undefined, '', 'wrong']) {
        for (const name of ['getStatus', 'prepare', 'importRows', 'clearRows']) {
            const fixture = watcherAccessFixture();
            const result = fixture.browser(name, [password, name === 'prepare' ? ['Barcode'] : name === 'clearRows' ? 'CLEAR' : { rows: [['SYNTHETIC-NEW', 2, 3, '001']] }]);
            check('Web password ៖ ' + name + ' បដិសេធ ' + String(password), result.ok === false);
            equal('Web password ៖ ' + name + ' មិនសរសេរពេលពាក្យសម្ងាត់ខុស/បាត់ ' + String(password), fixture.state.effects, []);
        }
    }
    const missing = watcherAccessFixture([], { passwordMissing: true });
    check('Web password ៖ មិនកំណត់ IMPORT_PASSWORD ត្រូវបដិសេធ', missing.browser('importRows', ['synthetic-password', { rows: [['SYNTHETIC-NEW', 2, 3, '001']] }]).ok === false);
    equal('Web password ៖ property បាត់ មិនសរសេរ', missing.state.effects, []);
    const fixture = watcherAccessFixture();
    check('Web password ៖ getStatus ទទួលពាក្យសម្ងាត់ត្រឹមត្រូវ', fixture.browser('getStatus', ['synthetic-password']).ok === true);
    const result = fixture.browser('importRows', ['synthetic-password', { rows: [['SYNTHETIC-NEW', 2, 3, '001']], mode: 'replace' }]);
    check('Web password ៖ ការនាំចូលធម្មតានៅដំណើរការតាម google.script.run', result.ok === true && result.value && result.value.rowsAfter === 1);
    equal('Web password ៖ import សរសេរទិន្នន័យសិប្បនិម្មិតពិត', fixture.state.rows[1], ['SYNTHETIC-NEW', 2, 3, '001']);
}

// ទំព័រ Web (Index.html ពិត + SheetJS ពិតដែលទំព័រផ្ទុក + google.script.run ➜ Code.gs ពិត) ៖ CSV ដដែលត្រូវឲ្យទឹកប្រាក់ដូចផ្លូវ Watch
function sheetJsLibrary() {
    const repo = path.resolve(root, '..');
    const html = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
    const integrity = (/xlsx\.full\.min\.js"\s+integrity="(sha384-[^"]+)"/.exec(html) || [])[1] || '';
    for (const rel of ['ZoeW/vendor/xlsx.full.min.js', 'ZoeW/public/vendor/xlsx.full.min.js']) {
        const file = path.join(repo, rel);
        if (!fs.existsSync(file)) continue;
        const bytes = fs.readFileSync(file);
        const sri = 'sha384-' + require('crypto').createHash('sha384').update(bytes).digest('base64');
        return { XLSX: sri === integrity ? require(file) : null, sri, integrity, file };
    }
    return { XLSX: null, sri: '', integrity, file: '' };
}

function webPageFixture(XLSX) {
    const fixture = watcherAccessFixture();
    const html = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
    const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((text) => text.trim()).join('\n');
    const elements = new Map();
    const node = () => {
        const item = { value: '', disabled: false, textContent: '', className: '', children: [], listeners: {},
            classList: { toggle() {}, add() {}, remove() {} },
            appendChild(child) { this.children.push(child); if (child.value && !this.value) this.value = child.value; },
            addEventListener(name, fn) { this.listeners[name] = fn; }, click() {} };
        Object.defineProperty(item, 'innerHTML', { get: () => '', set: () => { item.children = []; } });
        return item;
    };
    const el = (id) => { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); };
    const calls = [];
    const run = {
        withSuccessHandler: (success) => ({ withFailureHandler: (failure) => new Proxy({}, { get: (_, name) => (...args) => {
            calls.push({ name, args: JSON.parse(JSON.stringify(args)) });
            fixture.google.script.run.withSuccessHandler(success).withFailureHandler(failure)[name](...args);
        } }) })
    };
    class Reader {
        readAsArrayBuffer(file) { Promise.resolve().then(() => this.onload({ target: { result: Uint8Array.from(file.bytes).buffer } })); }
    }
    const context = vm.createContext({ console, Promise, Uint8Array, FileReader: Reader, XLSX, window: { confirm: () => true },
        localStorage: { removeItem() {} }, document: { getElementById: el, createElement: () => node() }, google: { script: { run } } });
    vm.runInContext(script, context, { filename: 'Index.html' });
    context.state.password = 'synthetic-password';
    const texts = (id) => el(id).children.map((child) => child.textContent).join(' | ');
    return { fixture, context, el, calls, texts };
}

async function settle() {
    for (let i = 0; i < 6; i++) await new Promise((resolve) => setImmediate(resolve));
}

async function webMoneyTests() {
    const lib = sheetJsLibrary();
    check('Web ៖ SheetJS ក្នុង repo គឺឯកសារដដែលដែលទំព័រផ្ទុក (SRI របស់ Index.html)', !!lib.XLSX && lib.sri === lib.integrity, JSON.stringify(lib));
    if (!lib.XLSX) return;
    for (const [label, name, text, expected] of MONEY_CSV_CASES) {
        const web = webPageFixture(lib.XLSX);
        web.context.handleFile({ name, bytes: Buffer.from(text) });
        await settle();
        web.context.runImport();
        await settle();
        const imports = web.calls.filter((call) => call.name === 'importRows');
        const added = web.fixture.state.rows.slice(2).map((row) => row.slice());
        if (expected) {
            equal('Web ' + label, added, expected);
            equal('Web ' + label + ' ៖ payload ដែលផ្ញើទៅ importRows', imports.length === 1 ? imports[0].args[1].rows : imports.length, expected);
        } else {
            const shown = web.texts('chips') + ' | ' + web.texts('goMsg');
            check('Web ' + label + ' ៖ បដិសេធ (គ្មាន importRows · មិនសរសេរ Sheet · ប្រាប់ «អានមិនច្បាស់»)', imports.length === 0
                && !web.fixture.state.effects.includes('write') && web.el('importBtn').disabled === true && /អានមិនច្បាស់/.test(shown),
                JSON.stringify({ imports: imports.length, effects: web.fixture.state.effects, disabled: web.el('importBtn').disabled, shown, added }));
        }
    }
    const web = webPageFixture(lib.XLSX);
    const pageToMoney = web.context.toMoney;
    const pageMark = web.context.moneyDecimalMark;
    const sameAsServer = MONEY_TEXT_CASES.filter(([cell, mark]) => typeof pageToMoney !== 'function' || JSON.stringify(pageToMoney(cell, mark)) !== JSON.stringify(toMoney_(cell, mark)));
    check('Web ↔ Code.gs ៖ toMoney() របស់ទំព័រ = toMoney_() របស់ server គ្រប់ករណី', typeof pageToMoney === 'function' && sameAsServer.length === 0,
        JSON.stringify(sameAsServer.map(([cell, mark]) => [cell, mark, typeof pageToMoney === 'function' ? pageToMoney(cell, mark) : 'missing', toMoney_(cell, mark)])));
    const markSets = [['5,50', '20'], ['15.5', '1,234,567'], ['1.234', '20'], ['5,50', '5.50'], ['1.234,50'], [3, '', '7']];
    check('Web ↔ Code.gs ៖ moneyDecimalMark() ដូចគ្នា', typeof pageMark === 'function' && markSets.every((cells) => pageMark(cells) === markOf(cells)),
        JSON.stringify(markSets.map((cells) => [typeof pageMark === 'function' ? pageMark(cells) : 'missing', markOf(cells)])));
}

function watcherReceiptFixture(mode, options) {
    const settings = options || {};
    const header = ['Barcode', 'DOD', 'COD', 'Phone'];
    const props = { SHEET_ID: 'target', INBOX_FOLDER_ID: 'in', DONE_FOLDER_ID: 'done', FAILED_FOLDER_ID: 'failed' };
    const state = { rows: [header.slice()], otherRows: [header.slice(), ['FOREIGN-ROW', 0, 777, '000']],
        writes: 0, writtenTargets: [], clears: 0, moves: [], logs: [], releases: 0, properties: props };
    const files = [];
    const receiptKey = id => 'ZTO_WATCH_RECEIPT_V1_' + id;
    const propertyService = {
        getProperty(key) {
            if (settings.failRead && key.startsWith('ZTO_WATCH_RECEIPT_')) throw new Error('synthetic-property-read');
            return props[key] === undefined ? null : props[key];
        },
        setProperty(key, value) {
            const receipt = key.startsWith('ZTO_WATCH_RECEIPT_') ? JSON.parse(value) : null;
            if (receipt && settings.failState === receipt.state) throw new Error('synthetic-property-quota');
            if (receipt && settings.dropState === receipt.state) return;
            props[key] = String(value);
            if (receipt && settings.failAfterState === receipt.state) throw new Error('synthetic-property-reply-lost');
        },
        deleteProperty(key) {
            if (settings.failDelete) throw new Error('synthetic-property-delete');
            delete props[key];
            if (settings.failDeleteAfterApply) throw new Error('synthetic-property-delete-reply-lost');
        }
    };
    const rowCount = rows => {
        let end = rows.length;
        while (end && !rows[end - 1].some(value => value !== '')) end--;
        return end;
    };
    const lastRow = () => rowCount(state.rows);
    const sheetFor = (id, name) => ({
        getName: () => name, getLastRow: () => rowCount(id === 'target' ? state.rows : state.otherRows), getMaxRows: () => 100,
        getRange(start, col, count, width) {
            const rows = id === 'target' ? state.rows : state.otherRows;
            return {
                getValues: () => Array.from({ length: count }, (_, i) => (rows[start - 1 + i] || ['', '', '', '']).slice(col - 1, col - 1 + width)),
                setNumberFormat() {},
                setValues(values) {
                    state.writes++;
                    state.writtenTargets.push([id, name]);
                    values.forEach((row, i) => { rows[start - 1 + i] = Array.from(row); });
                    if (settings.failWriteAfterApply) throw new Error('synthetic-write-reply-lost');
                },
                clearContent() { state.clears++; for (let i = 0; i < count; i++) rows[start - 1 + i] = ['', '', '', '']; }
            };
        }
    });
    const add = (id, amount, created, extra) => {
        const file = {
            folder: 'in', modified: created,
            rows: [header.slice(), ['SHARED-123', 0, amount, '000'], [extra, 0, 1, '001']],
            getId: () => id, getName: () => id + '.sheet', getDateCreated: () => new Date(created), getLastUpdated() { return new Date(this.modified); },
            getMimeType: () => 'application/vnd.google-apps.spreadsheet',
            moveTo(folder) {
                state.moves.push([id, folder.getId()]);
                if (settings.failMoveIds?.includes(id)) throw new Error('synthetic-move-quota');
                this.folder = folder.getId();
            }
        };
        files.push(file);
        return file;
    };
    const old = add('old-file', 5, 1, 'OLD-ONLY');
    const newer = settings.single ? null : add('new-file', 99, 2, 'NEW-ONLY');
    const folders = Object.fromEntries(['in', 'done', 'failed'].map(id => [id, { getId: () => id, getFiles() {
        const pending = files.filter(file => file.folder === 'in'); let index = 0;
        return { hasNext: () => index < pending.length, next: () => pending[index++] };
    } }]));
    const context = vm.createContext({
        PropertiesService: { getScriptProperties: () => propertyService },
        LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() { state.releases++; } }) },
        DriveApp: { getFolderById: id => folders[id] }, MimeType: { GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet' },
        Utilities: { DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
            computeDigest(_a, text) { return Array.from(require('crypto').createHash('sha256').update(text).digest(), byte => byte > 127 ? byte - 256 : byte); } },
        Logger: { log: value => state.logs.push(String(value)) },
        SpreadsheetApp: {
            openById(id) {
                if (id === 'target' || id === 'other-target') return { getSheetByName: name => sheetFor(id, name) };
                const file = files.find(candidate => candidate.getId() === id);
                if (!file) throw new Error('synthetic-source-missing');
                return { getSheets: () => [{ getLastRow: () => file.rows.length, getLastColumn: () => 4, getRange: () => ({ getValues: () => file.rows.map(row => row.slice()) }) }] };
            },
            flush() { if (settings.failFlush) throw new Error('synthetic-flush-reply-lost'); }
        }
    });
    for (const name of ['Code.gs', 'Watch.gs']) vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });
    if (mode === 'replace') context.rememberMapping_(context.mappingSignature_(header), { barcode: 0, dod: 1, cod: 2, phone: 3 }, mode);
    if (settings.flipTargetAtLookup) {
        const actualTargetSheet = context.targetSheet_;
        context.targetSheet_ = function (...args) {
            props.SHEET_ID = 'other-target'; props.SHEET_NAME = 'Other';
            return actualTargetSheet(...args);
        };
    }
    const seed = (stateName, changes) => {
        const receipt = Object.assign({ version: 1, fileId: old.getId(), sheetId: props.SHEET_ID,
            sheetName: props.SHEET_NAME || 'Customers', inboxId: props.INBOX_FOLDER_ID, state: stateName }, changes);
        props[receiptKey(old.getId())] = JSON.stringify(receipt);
        return props[receiptKey(old.getId())];
    };
    return { context, state, props, settings, old, newer, files, add, seed, key: receiptKey(old.getId()), run: () => context.watchInboxFolder_(),
        rows: () => state.rows.slice(0, lastRow()).map(row => row.slice()) };
}

for (const mode of ['upsert', 'replace']) {
    const f = watcherReceiptFixture(mode, { failMoveIds: ['old-file'] });
    f.run();
    const first = f.rows(), writes = f.state.writes;
    check('Watch ' + mode + ' ៖ ជុំដំបូងបន្តទៅ file ថ្មីទោះ move ចាស់បរាជ័យ', first.find(row => row[0] === 'SHARED-123')[2] === 99 && f.newer.folder === 'done');
    f.run();
    equal('Watch ' + mode + ' ៖ ជុំទីពីរមិនសរសេរ file ចាស់ជាន់ថ្មី', f.rows(), first);
    check('Watch ' + mode + ' ៖ ជុំទីពីរសាកតែ move និងរក្សា receipt', f.state.writes === writes && f.old.folder === 'in' && !!f.props[f.key]);
    check('Watch ' + mode + ' ៖ ដោះ script lock រាល់ជុំ', f.state.releases === 2);
}
for (const fault of ['failRead', 'pending', 'pending-readback', 'pending-reply-lost']) {
    const options = { single: true };
    if (fault === 'failRead') options.failRead = true;
    else if (fault === 'pending') options.failState = 'pending';
    else if (fault === 'pending-readback') options.dropState = 'pending';
    else options.failAfterState = 'pending';
    const f = watcherReceiptFixture('replace', options); f.run();
    check('Watch receipt ' + fault + ' ៖ មុន intent durable មិនសរសេរ ឬផ្លាស់ទី', f.state.writes === 0 && f.state.moves.length === 0);
    if (fault === 'pending-reply-lost') {
        const pending = f.props[f.key]; f.settings.failAfterState = ''; f.run();
        check('Watch receipt pending reply បាត់ ៖ ជុំបន្ទាប់ HOLD មិនសន្មតថាមិនធ្លាប់សរសេរ', !!pending && f.props[f.key] === pending && f.state.writes === 0 && f.state.moves.length === 0);
    }
}
{
    const f = watcherReceiptFixture('replace', { failAfterState: 'done', failMoveIds: ['old-file'] }); f.run();
    check('Watch done reply បាត់ ៖ មិនបន្ត file ថ្មីនៅជុំដែលមិនទាន់ផ្ទៀង', f.state.writes === 1 && f.newer.folder === 'in');
    f.settings.failAfterState = ''; f.run(); const latest = f.rows(), writes = f.state.writes; f.run();
    check('Watch done reply បាត់ ៖ receipt ដែលចុះពិតអនុញ្ញាតតែ move', latest.find(row => row[0] === 'SHARED-123')[2] === 99 && f.state.writes === writes);
}
{
    const f = watcherReceiptFixture('replace', { single: true, failWriteAfterApply: true, failState: 'unknown' }); f.run();
    const raw = f.props[f.key], written = f.rows();
    check('Watch unknown receipt សរសេរមិនបាន ៖ រក្សា pending និង file ដើម', !!raw && JSON.parse(raw).state === 'pending' && f.old.folder === 'in');
    f.settings.failState = ''; f.settings.failWriteAfterApply = false; f.run();
    equal('Watch unknown receipt សរសេរមិនបាន ៖ ជុំបន្ទាប់មិន replay ផលប៉ះពាល់ដើម', f.rows(), written);
    check('Watch unknown receipt សរសេរមិនបាន ៖ មិនបំផ្លាញ pending', f.props[f.key] === raw && f.state.writes === 1);
}
{
    const f = watcherReceiptFixture('replace', { failState: 'done' }); f.run();
    const pending = f.props[f.key];
    check('Watch receipt done រក្សាទុកមិនបាន ៖ ផ្អាកមុន file ថ្មី និងរក្សា pending', f.state.writes === 1 && f.newer.folder === 'in' && !!pending && JSON.parse(pending).state === 'pending');
    f.settings.failState = ''; f.run(); const latest = f.rows(), writes = f.state.writes;
    f.run();
    check('Watch receipt pending ក្រោយ write ៖ មិន replay ហើយ file ថ្មីនៅឈ្នះ', latest.find(row => row[0] === 'SHARED-123')[2] === 99 && f.state.writes === writes && f.props[f.key] === pending);
}
for (const stateName of ['pending', 'unknown', 'done']) {
    const f = watcherReceiptFixture('replace', { single: true, failMoveIds: ['old-file'] });
    const saved = f.seed(stateName); f.state.rows = [['Barcode', 'DOD', 'COD', 'Phone'], ['AFTER-CRASH', 0, 123, '000']];
    const before = f.rows(); f.run();
    equal('Watch ' + stateName + ' ក្រោយ restart ៖ មិនសរសេរឡើងវិញ', f.rows(), before);
    check('Watch ' + stateName + ' ក្រោយ restart ៖ រក្សា receipt ដើម', f.props[f.key] === saved && f.state.writes === 0);
    check('Watch ' + stateName + ' ក្រោយ restart ៖ សាក move តែ known done', f.state.moves.length === (stateName === 'done' ? 1 : 0));
}
for (const malformed of ['json', 'schema', 'state', 'sheet', 'tab', 'inbox', 'identity']) {
    const f = watcherReceiptFixture('replace', { single: true });
    f.seed('done'); const receipt = JSON.parse(f.props[f.key]);
    if (malformed === 'schema') receipt.version = 99;
    if (malformed === 'state') receipt.state = 'applied-maybe';
    if (malformed === 'sheet') receipt.sheetId = 'foreign-sheet';
    if (malformed === 'tab') receipt.sheetName = 'foreign-tab';
    if (malformed === 'inbox') receipt.inboxId = 'foreign-inbox';
    if (malformed === 'identity') receipt.fileId = 'foreign-file';
    f.props[f.key] = malformed === 'json' ? '{' : JSON.stringify(receipt);
    const raw = f.props[f.key]; f.run();
    check('Watch receipt ' + malformed + ' ៖ HOLD មិនលុប evidence ឬប៉ះ Sheet/file', f.props[f.key] === raw && f.state.writes === 0 && f.state.moves.length === 0);
}
for (const failMove of [false, true]) {
    const f = watcherReceiptFixture('replace', { single: true, failWriteAfterApply: true, failMoveIds: failMove ? ['old-file'] : [] });
    f.run();
    check('Watch write reply បាត់ ៖ សាររក្សាលទ្ធផលជាមិនទាន់ផ្ទៀង មិនប្រកាសបរាជ័យ · move បរាជ័យ=' + failMove,
        f.state.logs.some(line => line.startsWith('⏸️ ') && line.includes('មិនទាន់បានផ្ទៀង')) && !f.state.logs.some(line => line.startsWith('❌ ')));
    check('Watch write reply បាត់ ទោះ written:false ៖ រក្សា unknown · move បរាជ័យ=' + failMove,
        f.state.writes === 1 && !!f.props[f.key] && JSON.parse(f.props[f.key]).state === 'unknown');
    const raw = f.props[f.key], written = f.rows(); f.old.folder = 'in'; f.settings.failWriteAfterApply = false; f.run();
    equal('Watch write reply បាត់ ៖ មិន replay ក្នុងជុំក្រោយ · move បរាជ័យ=' + failMove, f.rows(), written);
    check('Watch write reply បាត់ ៖ unknown evidence មិនលុប · move បរាជ័យ=' + failMove, f.props[f.key] === raw && f.state.writes === 1);
}
{
    const f = watcherReceiptFixture('replace', { single: true, failFlush: true }); f.run();
    check('Watch flush បរាជ័យក្រោយសរសេរ ៖ unknown មិនអះអាងគ្មាន effect', f.state.writes === 1 && !!f.props[f.key] && JSON.parse(f.props[f.key]).state === 'unknown');
}
{
    const f = watcherReceiptFixture('replace', { failMoveIds: ['old-file'] }); f.run();
    f.context.SCRIPT_VERSION += 100; f.old.modified += 86400000;
    const writes = f.state.writes, first = f.rows(); f.run();
    equal('Watch version/modified time ប្រែ ៖ មិនអនុញ្ញាត replay file ID ដដែល', f.rows(), first);
    check('Watch version/modified time ប្រែ ៖ សូន្យ write ថ្មី', f.state.writes === writes);
    f.add('copy-file', 123, 3, 'COPY-ONLY'); f.run();
    check('Watch upload/copy ID ថ្មី ៖ អាចនាំចូល ទោះ file ចាស់នៅរង់ចាំ move', f.rows().find(row => row[0] === 'SHARED-123')[2] === 123 && f.files.at(-1).folder === 'done');
}
{
    const f = watcherReceiptFixture('replace', { single: true, failDelete: true }); f.run();
    check('Watch move រួច តែលុប receipt បរាជ័យ ៖ រក្សា known done', f.old.folder === 'done' && !!f.props[f.key] && JSON.parse(f.props[f.key]).state === 'done');
    const writes = f.state.writes; f.settings.failDelete = false; f.old.folder = 'in'; f.run();
    check('Watch receipt ចាស់ក្រោយ move ៖ សាក move តែម្ដង និងសម្អាតបន្ទាប់ពីបញ្ជាក់ចេញ Inbox', f.state.writes === writes && f.old.folder === 'done' && !f.props[f.key]);
}
{
    const f = watcherReceiptFixture('replace', { single: true, failDeleteAfterApply: true }); f.run();
    check('Watch delete receipt reply បាត់ ៖ ស្ដារ known done ក្រោយ read ថាខ្វះ', f.old.folder === 'done' && !!f.props[f.key] && JSON.parse(f.props[f.key]).state === 'done');
    const writes = f.state.writes; f.settings.failDeleteAfterApply = false; f.old.folder = 'in'; f.run();
    check('Watch delete receipt reply បាត់ ៖ evidence ដែលរក្សាអនុញ្ញាតតែ move', f.state.writes === writes && f.old.folder === 'done');
}
{
    const f = watcherReceiptFixture('replace', { single: true }); f.props.DONE_FOLDER_ID = 'in'; f.run();
    const writes = f.state.writes; f.run();
    check('Watch Done=Inbox ៖ មិនលុប receipt ឬនាំចូលម្តងទៀត', f.old.folder === 'in' && f.state.writes === writes && !!f.props[f.key]);
}
{
    const f = watcherReceiptFixture('replace', { single: true, flipTargetAtLookup: true });
    const foreign = f.state.otherRows.map(row => row.slice()); f.run();
    check('Watch ប្តូរ Script Properties ក្រោយ guard ៖ មិនសរសេរចូល Sheet/tab ថ្មី', f.state.writtenTargets.every(([id, tab]) => id === 'target' && tab === 'Customers'));
    equal('Watch target lookup race ៖ ទិន្នន័យ Sheet ថ្មីនៅដដែល', f.state.otherRows, foreign);
}

webMoneyTests().catch((error) => check('Web money tests ៖ រត់ចប់ដោយគ្មាន exception', false, error && error.stack)).then(() => {
    console.log('');
    console.log('zto-import — ' + passed + ' assertions passed, ' + failed + ' failed');
    if (failed) {
        failures.forEach((f) => console.log('  ✗ ' + f));
        process.exit(1);
    }
    process.exitCode = 0;
});
