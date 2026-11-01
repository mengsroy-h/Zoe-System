const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.env.ZTO_IMPORT_APP_DIR ? path.resolve(process.env.ZTO_IMPORT_APP_DIR) : __dirname;
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
    const file = (name, created, mime) => ({ getName: () => name, getDateCreated: () => new Date(created), getMimeType: () => mime || 'text/csv', moved: null, moveTo(folder) { this.moved = folder; } });
    const files = [file('new.csv', 3000), file('photo.png', 1000, 'image/png'), file('old.csv', 2000)];
    const inbox = { getFiles() { let i = 0; return { hasNext: () => i < files.length, next: () => files[i++] }; } };
    equal('Watch ៖ ឯកសារចាស់មុន ថ្មីក្រោយ (ថ្មីឈ្នះ)', watch.oldestInboxFiles_(inbox, 10).map((f) => f.getName()), ['photo.png', 'old.csv', 'new.csv']);
    watch.readProp_ = (name) => ({ INBOX_FOLDER_ID: 'in', DONE_FOLDER_ID: 'done', FAILED_FOLDER_ID: 'failed' })[name] || '';
    watch.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
    watch.DriveApp = { getFolderById: (id) => (id === 'in' ? inbox : id) };
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

function watcherAccessFixture(handlers, options) {
    const settings = options || {};
    const state = {
        effects: [],
        serviceCalls: [],
        rows: [['Barcode', 'DOD($)', 'COD($)', 'Phone'], ['SYNTHETIC-OLD', 0, 1, '000']],
        moved: '',
        releases: 0,
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
        getId: () => 'synthetic-source', getName: () => 'synthetic-sheet',
        getDateCreated: () => new Date(1), getMimeType: () => 'application/vnd.google-apps.spreadsheet',
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
                setProperty(key, value) { state.effects.push('property'); properties[key] = value; }
            };
        } },
        LockService: { getScriptLock() {
            service('lock');
            return { tryLock: () => !settings.lockBusy, releaseLock() { state.releases++; } };
        } },
        DriveApp: { getFolderById(id) { service('folder'); if (!folders[id]) throw new Error('synthetic-folder'); return folders[id]; } },
        Drive: { Files: { copy() { throw new Error('unexpected-conversion'); }, remove() { throw new Error('unexpected-conversion'); } } },
        MailApp: { sendEmail() { service('mail'); state.effects.push('mail'); } },
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
                if (id !== 'synthetic-source') throw new Error('synthetic-spreadsheet');
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

console.log('');
console.log('zto-import — ' + passed + ' assertions passed, ' + failed + ' failed');
if (failed) {
    failures.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
}
