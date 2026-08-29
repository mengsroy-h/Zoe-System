// ថ្នាក់កំហុស៖ លេខទូរស័ព្ទ និង Barcode ត្រូវចេញជា TEXT ក្នុងឯកសារ Excel។
// បើវាចេញជាលេខ Excel នឹងកាត់ 0 នាំមុខចោល (012345678 ➜ 12345678) ហើយបង្ហាញ
// Barcode វែងជា 1.23457E+11 ➜ ទិន្នន័យអតិថិជនខូចដោយស្ងាត់ៗ។
//
// CLAUDE.md៖ «កុំវិនិច្ឆ័យថ្នាក់កំហុសនេះពី cell object ក្នុងសតិ — ត្រូវពិនិត្យ XML
// ដែល emit ចេញ។» ដូច្នេះតេស្តនេះសរសេរឯកសារ .xlsx ពិត រួចអាន XML ខាងក្នុង។
let XLSX;
try { XLSX = require('xlsx'); } catch (e) { console.log('SKIP — ត្រូវការ xlsx (npm i xlsx@0.18.5)'); process.exit(0); }
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = process.env.EXPORT_APP_DIR || path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('  ok    ' + label); pass++; }
    else { console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + String(detail).slice(0, 400) : '')); fail++; }
}

function sliceFn(src, name) {
    let start = src.indexOf('function ' + name + '(');
    if (start === -1) return null;
    if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, started = false, i = src.indexOf('{', start);
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}

function sliceConst(src, name) {
    const m = src.match(new RegExp('^ *const ' + name + ' = .*$', 'm'));
    return m ? m[0] : null;
}

// អាន .xlsx (ជា zip) ដោយគ្មាន library បន្ថែម — យក entry មួយចេញមក
function unzipEntry(buf, wanted) {
    let offset = 0;
    while (offset < buf.length - 4) {
        if (buf.readUInt32LE(offset) !== 0x04034b50) { offset++; continue; }
        const method = buf.readUInt16LE(offset + 8);
        const compSize = buf.readUInt32LE(offset + 18);
        const nameLen = buf.readUInt16LE(offset + 26);
        const extraLen = buf.readUInt16LE(offset + 28);
        const name = buf.slice(offset + 30, offset + 30 + nameLen).toString('utf8');
        const dataStart = offset + 30 + nameLen + extraLen;
        if (name === wanted && compSize > 0) {
            const raw = buf.slice(dataStart, dataStart + compSize);
            return method === 8 ? zlib.inflateRawSync(raw).toString('utf8') : raw.toString('utf8');
        }
        offset = dataStart + (compSize || 1);
    }
    return null;
}

const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');

// បរិបទដែលរត់កូដ Export ពិតចេញពី app.js
const sandbox = {
    XLSX,
    console,
    scanHistory: [],
    currentFilterMode: 'all',
    customFilterDate: '',
    getServerNow: () => Date.now(),
    Math, String, Number, parseFloat, parseInt, Array, Object, JSON, Date, isNaN
};
vm.createContext(sandbox);
[sliceConst(src, 'EXPORT_HEADERS'), sliceConst(src, 'EXPORT_TEXT_COLUMN_INDEXES')].forEach((line) => {
    ok('រកឃើញ ' + (line || '').split(' ')[1] + ' ក្នុង app.js', !!line);
    if (line) vm.runInContext(line, sandbox);
});
// ⛔ `getFilteredDataByDate()` គណនាថ្ងៃតាមប្រតិទិនកម្ពុជា (2.20.5) ➜ ត្រូវ
// ផ្ទុក helper តំបន់ម៉ោងពិត បើមិនដូច្នេះវាធ្លាក់ដោយ ReferenceError។
['APP_TIME_ZONE', 'APP_TIME_ZONE_OFFSET_MINUTES'].forEach((name) => {
    const m = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);').exec(src);
    if (m) vm.runInContext('const ' + name + ' = ' + m[1] + ';', sandbox);
});
['appZoneParts', 'getZoneDateKey', 'getFormattedClockTime',
 'getFormattedDate', 'getFilteredDataByDate', 'buildExportRows', 'forceExportTextCells'].forEach((name) => {
    const fn = sliceFn(src, name);
    ok('រកឃើញ ' + name + '() ក្នុង app.js', !!fn);
    if (fn) vm.runInContext(fn, sandbox);
});

// ទិន្នន័យដែលបំបែកថ្នាក់កំហុសនេះ៖ 0 នាំមុខ, barcode វែងជាលេខសុទ្ធ, លេខពីរខ្សែ
sandbox.scanHistory = [
    { id: 'a', phone: '012345678', scanDate: '2026-08-22', time: '10:00', barcodes: [
        { code: '123456789012', cod: 5, dod: 0, locker: 'A1', isClosed: false, time: '10:00' }
    ] },
    { id: 'b', phone: '0968490421/012000111', scanDate: '2026-08-22', time: '10:05', barcodes: [
        { code: '0099887766', cod: 0, dod: 3.5, locker: 'B2', isClosed: true, time: '10:05' }
    ] },
    { id: 'c', phone: 'គ្មានលេខ', scanDate: '2026-08-22', time: '10:09', barcodes: [
        { code: 'ZTO0001234', cod: 1.25, dod: 0, locker: 'N/A', isClosed: false, time: '10:09' }
    ] },
    // RTDB អាចផ្ញើលេខមកជា number ពិត (មិនមែន string) — នេះជាករណីដែលបំបែកថ្នាក់នេះ
    { id: 'd', phone: 12345678, scanDate: '2026-08-22', time: '10:12', barcodes: [
        { code: 987654321098, cod: 2, dod: 0, locker: 'C3', isClosed: false, time: '10:12' }
    ] }
];

const rows = vm.runInContext('buildExportRows()', sandbox);
ok('buildExportRows() បញ្ចេញ ១ ជួរក្នុងមួយ barcode', rows.length === 4, rows.length);
ok('លេខទូរស័ព្ទដែលមកជា number ត្រូវក្លាយជា string', typeof rows[3].phone === 'string' && rows[3].phone === '12345678', JSON.stringify(rows[3].phone) + ' (' + typeof rows[3].phone + ')');
ok('Barcode ដែលមកជា number ត្រូវក្លាយជា string', typeof rows[3].barcode === 'string' && rows[3].barcode === '987654321098', JSON.stringify(rows[3].barcode) + ' (' + typeof rows[3].barcode + ')');
ok('លេខទូរស័ព្ទរក្សា 0 នាំមុខក្នុងជួរ', rows[0].phone === '012345678', rows[0].phone);
ok('«គ្មានលេខ» ចេញជាទទេ', rows[2].phone === '', JSON.stringify(rows[2].phone));

// សរសេរឯកសារ .xlsx ពិត ដូចផ្លូវ exportDataAsExcel
const aoa = [sandbox.EXPORT_HEADERS, ...rows.map((r) => [r.no, r.phone, r.barcode, r.locker, r.cod, r.dod, r.total, r.status, r.scanDate, r.time])];
const ws = XLSX.utils.aoa_to_sheet(aoa);
sandbox.__ws = ws;
sandbox.__rowCount = rows.length;
vm.runInContext('forceExportTextCells(__ws, __rowCount)', sandbox);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'ប្រវត្តិ');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', bookSST: true });

const sheetXml = unzipEntry(buf, 'xl/worksheets/sheet1.xml');
const sharedXml = unzipEntry(buf, 'xl/sharedStrings.xml');
ok('អាន xl/worksheets/sheet1.xml ចេញពី .xlsx ពិតបាន', !!sheetXml, sheetXml === null ? 'unzip បរាជ័យ' : '');
if (!sheetXml) {
    console.log('\n' + '❌ ធ្លាក់ ' + (fail || 1));
    process.exit(1);
}

// រាល់ cell ក្នុងជួរឈរ B (លេខទូរស័ព្ទ) និង C (Barcode) ត្រូវមាន t="s" (shared string)
// ឬ t="str"/t="inlineStr" — មិនត្រូវជាលេខ (គ្មាន t = numeric ក្នុង SheetML)។
function cellsOfColumn(xml, col) {
    const re = new RegExp('<c r="' + col + '(\\d+)"([^>]*)\\/?>', 'g');
    const out = [];
    let m;
    while ((m = re.exec(xml)) !== null) out.push({ row: parseInt(m[1], 10), attrs: m[2] });
    return out;
}

[['B', 'លេខទូរស័ព្ទ'], ['C', 'Barcode']].forEach(([col, label]) => {
    const cells = cellsOfColumn(sheetXml, col).filter((c) => c.row > 1);
    ok(label + '៖ រកឃើញ cell ក្នុង XML (តេស្តមិនទទេ)', cells.length === rows.length, cells.length + ' vs ' + rows.length);
    const numeric = cells.filter((c) => !/\bt="(s|str|inlineStr)"/.test(c.attrs));
    ok(label + '៖ គ្មាន cell ណាចេញជាលេខក្នុង XML', numeric.length === 0,
        numeric.map((c) => col + c.row + ' attrs=' + JSON.stringify(c.attrs)).join(' | '));
});

// តម្លៃពិតត្រូវនៅដដែល — 0 នាំមុខមិនត្រូវបាត់
const strings = sharedXml ? (sharedXml.match(/<t[^>]*>([^<]*)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')) : [];
ok('0 នាំមុខរបស់លេខទូរស័ព្ទនៅក្នុងឯកសារ', strings.indexOf('012345678') !== -1, strings.slice(0, 24).join(','));
ok('Barcode ដែលមាន 0 នាំមុខនៅដដែល', strings.indexOf('0099887766') !== -1, strings.slice(0, 24).join(','));
ok('Barcode វែងជាលេខសុទ្ធមិនក្លាយជា exponent', strings.indexOf('123456789012') !== -1 && !/1\.23457E\+11/i.test(sheetXml), strings.slice(0, 24).join(','));
ok('លេខទូរស័ព្ទពីរខ្សែ (/) នៅដដែល', strings.indexOf('0968490421/012000111') !== -1, strings.slice(0, 24).join(','));
ok('លេខដែលមកជា number ចេញជាអត្ថបទក្នុងឯកសារ', strings.indexOf('12345678') !== -1 && strings.indexOf('987654321098') !== -1, strings.slice(0, 24).join(','));

// index របស់ជួរឈរអត្ថបទ ត្រូវត្រូវនឹង EXPORT_HEADERS ពិត
// អថេរ const កម្រិត module មិនស្ថិតលើ sandbox object ទេ — ត្រូវអានតាមឈ្មោះទទេ
const headers = vm.runInContext('EXPORT_HEADERS', sandbox);
const idx = vm.runInContext('EXPORT_TEXT_COLUMN_INDEXES', sandbox);
ok('EXPORT_TEXT_COLUMN_INDEXES ចង្អុលទៅ «លេខទូរស័ព្ទ» និង «Barcode» ពិត',
    headers[idx[0]] === 'លេខទូរស័ព្ទ' && headers[idx[1]] === 'Barcode',
    JSON.stringify({ idx, at: idx.map((i) => headers[i]) }));

// ⛔ CSV formula injection — «ទីតាំង Locker» ជាអត្ថបទសេរីរបស់អ្នកប្រើ
// (`lockerEl.value.trim()`; rules ផ្ទៀងផ្ទាត់ត្រឹម `newData.isString()`) ➜
// ឈ្មោះទូដែលចាប់ផ្តើមដោយ `= + - @` ក្លាយជា **រូបមន្តរស់** ពេលបើកឯកសារ CSV
// ក្នុង Excel/Sheets (ឧ. `=HYPERLINK(…)` · `=cmd|'/c calc'!A0` ➜ DDE)។
// ⛔ **កុំដាក់ការណេយ្យកម្មនេះលើ `csvEscape` ទាំងមូល** — លទ្ធផលរបស់
// `sheetsText()` ចាប់ផ្តើមដោយ `=` **ដោយចេតនា** (ការបង្ខំជា TEXT) ➜ ការដាក់
// `'` ពីមុខវានឹងបំផ្លាញលេខទូរស័ព្ទ និង Barcode។ ដូច្នេះការណេយ្យកម្មត្រូវ
// ដាក់លើ **វាលអត្ថបទឆៅ** តែប៉ុណ្ណោះ។ តេស្តអះអាង **២ ខាង**។
const csvSrc = sliceFn(src, 'exportDataAsCsvForSheets') || '';
ok('រក `exportDataAsCsvForSheets` ឃើញ', csvSrc.length > 0,
    'បាត់ពី tree ➜ តេស្តនេះមិនបានពិនិត្យអ្វីសោះ');
if (csvSrc) {
    const csvCtx = { out: null };
    vm.createContext(csvCtx);
    const helper = csvSrc.slice(csvSrc.indexOf('const csvSafeText'), csvSrc.indexOf('const lines'));
    ok('`csvSafeText` មានវត្តមាន', helper.indexOf('csvSafeText') !== -1,
        'គ្មានការណេយ្យកម្មរូបមន្ត ➜ ឈ្មោះទូអាចក្លាយជារូបមន្តរស់');
    if (helper.indexOf('csvSafeText') !== -1) {
        vm.runInContext(helper + '\nout = { f: csvSafeText };', csvCtx);
        const f = csvCtx.out.f;
        ok('⛔ `=HYPERLINK(...)` ត្រូវបានណេយ្យកម្ម', f('=HYPERLINK("http://x","y")')[0] === "'", f('=HYPERLINK("h","y")'));
        ok('⛔ `+`, `-`, `@`, TAB, CR ក៏ត្រូវណេយ្យកម្មដែរ',
            ['+1', '-1', '@x', '\tx', '\rx'].every((v) => f(v)[0] === "'"),
            JSON.stringify(['+1', '-1', '@x'].map(f)));
        ok('⛔ ទិសផ្ទុយ ៖ អត្ថបទធម្មតាមិនត្រូវប្រែសោះ',
            f('A1') === 'A1' && f('ទូ ០១') === 'ទូ ០១' && f('N/A') === 'N/A' && f('') === '',
            JSON.stringify([f('A1'), f('ទូ ០១'), f('N/A')]));
    }
    // ការណេយ្យកម្មត្រូវអនុវត្តលើ locker ពិត មិនមែនត្រឹមប្រកាសទុក
    ok('⛔ `locker` ឆ្លងកាត់ `csvSafeText` ក្នុងជួរដេកពិត',
        /csvSafeText\(r\.locker\)/.test(csvSrc),
        'ប្រកាស helper តែមិនប្រើ = ការការពារដែលងាប់');
    ok('⛔ ទិសផ្ទុយ ៖ `sheetsText` នៅតែប្រើលើលេខទូរស័ព្ទ និង Barcode',
        /sheetsText\(r\.phone\)/.test(csvSrc) && /sheetsText\(r\.barcode\)/.test(csvSrc),
        'ការបង្ខំជា TEXT ត្រូវរក្សា — បើអត់ 0 នាំមុខបាត់');
}

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
