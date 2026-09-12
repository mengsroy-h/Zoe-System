// ⛔ ថ្នាក់កំហុស ៖ របាយការណ៍អាជីវកម្មប្រចាំខែ (កំណែ 2.29.0)។
//
// ហេតុអ្វីវាត្រូវការឧបករណ៍ដាច់ដោយឡែក ៖ របាយការណ៍នេះជាលេខ **លុយ** ដែល
// ម្ចាស់អាជីវកម្មយកទៅសម្រេចចិត្ត ➜ លេខខុសមួយថ្លៃជាងកំហុស UI ទាំងអស់។
// ហើយវាមានអន្ទាក់ ៣ ដែលការអានកូដមើលមិនឃើញ ៖
//
// ១. **មូលដ្ឋានតែមួយ** — `zoew_monthly_revenue_cod_dod` រក្សាតែ **៣ ខែ
//    ចុងក្រោយ** (`commitMonthlyRevenueDelta` កាត់ `slice(0, 3)`) ចំណែក
//    `zoew_daily_revenue_cod_dod` រក្សា **រាល់ថ្ងៃជានិច្ច**។ ដូច្នេះ
//    របាយការណ៍ត្រូវដេរីវេពី **ថ្ងៃ** បើមិនដូច្នេះខែទី ៤ ឡើងទៅ **បាត់ស្ងាត់**។
// ២. **អានសុទ្ធសាធ** — វាមិនត្រូវប៉ះសតិ ledger សោះ (ច្បាប់ «ដក/លុប» ៖
//    មានតែ `isDeducted` ទេដែលកំណត់លុយ; របាយការណ៍មិនមែនផ្លូវលុយទេ)។
// ៣. **រូបរាងឆៅ** — RTDB អាចផ្ញើ `null` · ខ្សែអក្សរ · object · លេខអវិជ្ជមាន
//    ➜ ការបូកត្រូវមិនបោះ និងមិនបញ្ចេញ `NaN` ចូលរបាយការណ៍លុយ។
//
// ⛔ តេស្តនេះស្រង់ function **ពិត** ចេញពី `app.js` មករត់ក្នុង `vm` —
// មិនសរសេរតក្កវិជ្ជាចម្លងទេ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.resolve(process.env.MREPORT_APP_DIR || path.join(__dirname, '..'));
let XLSX;
try { XLSX = require(path.join(ROOT, 'ZoeW', 'vendor', 'xlsx.full.min.js')); }
catch (e) { console.log('FAIL — មិនអាចផ្ទុក SheetJS ពិតពី target tree'); process.exit(1); }

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('  ok    ' + label); pass++; }
    else { console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + String(detail).slice(0, 400) : '')); fail++; }
}
function scenario(name, fn) {
    console.log('\n=== ' + name + ' ===');
    try { fn(); } catch (e) { ok(name + ' រត់ដល់ចប់', false, (e && e.stack) || e); }
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
// ⛔ ការប្រកាសដែលរុំច្រើនបន្ទាត់ ធ្វើឲ្យ regex បន្ទាត់តែមួយស្រង់ចេញ **ពាក់កណ្តាល**
// ➜ `vm` បោះ SyntaxError ➜ checker **ងាប់មុនអះអាងអ្វីសោះ** (វាស់បាន 2.30.0)។
// ➜ ត្រូវរាប់តង្កៀបឲ្យស៊ី រួចឈប់ត្រឹម `;` នៅជម្រៅ 0។
function sliceConst(src, name) {
    const m = new RegExp('^ *(?:const|let) ' + name + ' = ', 'm').exec(src);
    if (!m) return null;
    let i = m.index + m[0].length, depth = 0, quote = null;
    for (; i < src.length; i++) {
        const c = src[i];
        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') quote = c;
        else if (c === '[' || c === '{' || c === '(') depth++;
        else if (c === ']' || c === '}' || c === ')') depth--;
        else if (c === ';' && depth === 0) { i++; break; }
        else if (c === '\n' && depth === 0) break;
    }
    return src.slice(m.index, i);
}
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

const appFile = path.join(ROOT, 'ZoeW', 'app.js');
if (!fs.existsSync(appFile)) {
    console.log('  FAIL  រក ZoeW/app.js មិនឃើញនៅ ' + ROOT);
    console.log('\n❌ ធ្លាក់ 1');
    process.exit(1);
}
const src = fs.readFileSync(appFile, 'utf8');

// ⛔ ការសរសេរណាមួយត្រូវធ្វើឲ្យ scenario «អានសុទ្ធសាធ» ធ្លាក់
const writes = [];
const sandbox = {
    console,
    Math, String, Number, Object, Array, JSON, Date, Set, isFinite, isNaN, parseFloat, parseInt, RegExp,
    exchangeRateRiel: 4100,
    dailyRevenueData: {},
    monthlyRevenueData: {},
    dailyPickupData: {},
    scanHistory: [],
    deletedItems: [],
    dbListenerPendingPaths: new Set(),
    dbListenerFailedPaths: new Set(),
    getServerNow: () => Date.UTC(2026, 8, 5, 3, 0, 0),
    fb: {
        update: (...a) => { writes.push(['update', a]); return Promise.resolve(); },
        set: (...a) => { writes.push(['set', a]); return Promise.resolve(); },
        runTransaction: (...a) => { writes.push(['runTransaction', a]); return Promise.resolve(); }
    }
};
vm.createContext(sandbox);

const CONSTS = ['APP_TIME_ZONE', 'APP_TIME_ZONE_OFFSET_MINUTES', 'PICKUP_DATE_KEY_PATTERN',
    'MONTHLY_REPORT_MONTH_PATTERN', 'MONTHLY_REPORT_HEADERS', 'MONTHLY_REPORT_TEXT_COLUMN_INDEXES',
    'MONTHLY_REPORT_MONEY_TOLERANCE', 'MONTHLY_REPORT_UNKNOWN', 'EXPORT_TEXT_COLUMN_INDEXES',
    'DB_LISTENER_KEY_HISTORY', 'DB_LISTENER_KEY_DELETED', 'DB_LISTENER_KEY_DAILY_REVENUE',
    'DB_LISTENER_KEY_MONTHLY_REVENUE', 'VIEW_NOT_MEASURABLE_TEXT'];
CONSTS.forEach((name) => {
    const line = sliceConst(src, name);
    ok('រកឃើញ ' + name + ' ក្នុង app.js', !!line);
    if (line) vm.runInContext(line, sandbox);
});
vm.runInContext('let monthlyReportMonth = "";', sandbox);

const FNS = ['appZoneParts', 'getZoneDateKey', 'ledgerNumber', 'countPickedUpCustomers',
    'statsMonthOf', 'statsPositive', 'statsMoney', 'statsCount',
    'monthlyReportAvailableMonths', 'buildMonthlyReport', 'monthlyReportRiel',
    'monthlyReportFilenameBase', 'monthlyReportRows', 'forceSheetTextCells',
    'dbListenerViewIsStale', 'uncollectedBarcodeValue', 'uncollectedItemValue',
    'uncollectedValueByDate', 'collectedValueOf',
    'collectedValueIsMeasurable', 'collectedMoneyText', 'collectedRielText'];
FNS.forEach((name) => {
    const fn = sliceFn(src, name);
    ok('រកឃើញ ' + name + '() ក្នុង app.js', !!fn);
    if (fn) vm.runInContext(fn, sandbox);
    else vm.runInContext('function ' + name + '() { throw new Error("' + name + ' បាត់ពី app.js"); }', sandbox);
});

function setData(daily, pickup, monthly) {
    sandbox.dailyRevenueData = daily || {};
    sandbox.dailyPickupData = pickup || {};
    sandbox.monthlyRevenueData = monthly || {};
    setLive([], []);
}
function setLive(history, trash) {
    sandbox.scanHistory = history || [];
    sandbox.deletedItems = trash || [];
    sandbox.dbListenerPendingPaths.clear();
    sandbox.dbListenerFailedPaths.clear();
}
// ⛔ `bc()` សាង barcode ដែលកំណត់ `isDeducted` **ច្បាស់លាស់** —
// «មិនកំណត់» និង «false» ត្រូវប្រព្រឹត្តដូចគ្នា (លុយនៅក្នុង ledger)។
function bc(cod, dod, closed, deducted) {
    const b = { code: 'C' + cod + '_' + dod, cod: cod, dod: dod, isClosed: !!closed };
    if (deducted !== undefined) b.isDeducted = deducted;
    return b;
}
function item(scanDate, barcodes) {
    return { id: 'i' + scanDate + barcodes.length, scanDate: scanDate, phone: '012000111', barcodes: barcodes };
}
function build(ym) {
    sandbox.__ym = ym;
    return vm.runInContext('buildMonthlyReport(__ym)', sandbox);
}

scenario('មូលដ្ឋានតែមួយ ៖ ខែចាស់ជាង ៣ ខែនៅតែមាន (ដេរីវេពីថ្ងៃ)', () => {
    setData({
        '2026-01-04': { codDollar: 12.5, dodDollar: 7.5, totalCount: 4 },
        '2026-01-05': { codDollar: 10, dodDollar: 0, totalCount: 2 },
        '2026-09-01': { codDollar: 3, dodDollar: 1, totalCount: 1 }
    }, {}, {
        '2026-07': { codDollar: 0, dodDollar: 0, totalCount: 0 },
        '2026-08': { codDollar: 0, dodDollar: 0, totalCount: 0 },
        '2026-09': { codDollar: 3, dodDollar: 1, totalCount: 1 }
    });
    const months = vm.runInContext('monthlyReportAvailableMonths()', sandbox);
    ok('⛔ ខែ 2026-01 (គ្មានក្នុង node ខែ) នៅតែជ្រើសបាន', months.indexOf('2026-01') !== -1, JSON.stringify(months));
    ok('បញ្ជីខែតម្រៀបថ្មីមុនគេ', months[0] === '2026-09', JSON.stringify(months));
    const r = build('2026-01');
    ok('ខែចាស់មាន ២ ថ្ងៃ', r.days.length === 2, r.days.length);
    ok('ចំណូល COD ខែចាស់ = 22.5', r.totals.cod === 22.5, r.totals.cod);
    ok('ចំណូលសរុបខែចាស់ = 30', r.totals.total === 30, r.totals.total);
    ok('កញ្ចប់ខែចាស់ = 6', r.totals.count === 6, r.totals.count);
    ok('⛔ ទិសផ្ទុយ ៖ ខែដែលមានទិន្នន័យមិនត្រូវរាយថាទទេ', r.days.length > 0 && r.totals.total > 0);
});

scenario('ការត្រងខែត្រូវច្បាស់ (មិនប្រមូលខែជិតខាង)', () => {
    setData({
        '2026-09-30': { codDollar: 5, dodDollar: 0, totalCount: 1 },
        '2026-10-01': { codDollar: 99, dodDollar: 99, totalCount: 99 },
        '2026-08-31': { codDollar: 77, dodDollar: 0, totalCount: 7 },
        '2026-09-1': { codDollar: 55, dodDollar: 0, totalCount: 5 },
        'bogus': { codDollar: 44, dodDollar: 0, totalCount: 4 }
    }, {}, {});
    const r = build('2026-09');
    ok('យកតែថ្ងៃក្នុងខែ 2026-09', r.days.length === 1, JSON.stringify(r.days.map((d) => d.date)));
    ok('⛔ ខែជិតខាងមិនលេចចូល', r.totals.cod === 5, r.totals.cod);
    ok('⛔ កូនសោមិនត្រូវទម្រង់ត្រូវរំលង', r.totals.count === 1, r.totals.count);
    const months = vm.runInContext('monthlyReportAvailableMonths()', sandbox);
    ok('⛔ កូនសោមិនត្រូវទម្រង់មិនចូលបញ្ជីខែ', months.indexOf('bogus') === -1 && months.length === 3, JSON.stringify(months));
    const bad = build('2026-9');
    ok('⛔ ខែទម្រង់ខុសត្រឡប់របាយការណ៍ទទេ', bad.month === '' && bad.days.length === 0);
});

scenario('រូបរាងឆៅពី RTDB មិនត្រូវបញ្ចេញ NaN ឬលេខអវិជ្ជមាន', () => {
    setData({
        '2026-09-01': null,
        '2026-09-02': { codDollar: '4.25', dodDollar: null, totalCount: '3' },
        '2026-09-03': { codDollar: -9, dodDollar: -1, totalCount: -5 },
        '2026-09-04': { codDollar: { a: 1 }, dodDollar: [1, 2], totalCount: 'abc' },
        '2026-09-05': 7
    }, {
        '2026-09-02': { packagesPickedUp: '2', pickedUpPhones: { '012': 2 } },
        '2026-09-03': { packagesPickedUp: -4, pickedUpPhones: null },
        '2026-09-04': 5
    }, {});
    const r = build('2026-09');
    ok('គ្រប់ថ្ងៃត្រូវរាប់ ៥', r.days.length === 5, r.days.length);
    const finite = r.days.every((d) => [d.cod, d.dod, d.total, d.count, d.picked, d.customers].every((n) => Number.isFinite(n)));
    ok('⛔ គ្មានលេខ NaN/Infinity ក្នុងជួរណាមួយ', finite, JSON.stringify(r.days));
    const nonNeg = r.days.every((d) => d.cod >= 0 && d.dod >= 0 && d.count >= 0 && d.picked >= 0 && d.customers >= 0);
    ok('⛔ គ្មានលេខអវិជ្ជមាន (rules ពិតបដិសេធវា)', nonNeg, JSON.stringify(r.days));
    ok('ខ្សែអក្សរលេខត្រូវអានជាលេខ', r.totals.cod === 4.25, r.totals.cod);
    ok('កញ្ចប់យករួចអានពី packagesPickedUp', r.totals.picked === 2, r.totals.picked);
    // ⛔ តម្លៃឆៅដែលមិនមែនលេខឆ្លងកាត់ `ledgerNumber()` ដដែលនឹងផ្លូវលុយទាំងអស់
    // ➜ ការអះអាងត្រូវជា **អថេរពិត** (ផលបូក = ផលបូកនៃថ្ងៃ) មិនមែនលេខថេរ
    // ដែលចាក់ចេញពីរបៀបបំប្លែងរបស់ `parseFloat` ទេ។
    const dayTotal = Math.round(r.days.reduce((s, d) => s + d.total, 0) * 100) / 100;
    ok('សរុបទាំងអស់ជាលេខកំណត់ ហើយស្មើផលបូកនៃថ្ងៃ',
        Number.isFinite(r.totals.total) && r.totals.total === dayTotal, r.totals.total + ' ធៀប ' + dayTotal);
});

scenario('⛔ ផ្លូវរបាយការណ៍មិនត្រូវបោះលើ map ដែលមិនមែន object', () => {
    // `onValue` សរសេរ `snapshot.val() || {}` ➜ តាមទ្រឹស្តី map មិនអាចជា null ទេ
    // តែ **ការបោះនៅដើមផ្លូវនេះសម្លាប់ប្រអប់ទាំងមូល** ➜ ច្រកទ្វារត្រូវឈរ។
    const junk = [[null, null, null], ['nope', 5, []], [undefined, undefined, undefined],
        [{ 'x': 1, '2026-09-01': 'oops' }, null, 'nope']];
    let threw = 0, ran = 0;
    junk.forEach((set) => {
        setData(set[0], set[1], set[2]);
        sandbox.dailyRevenueData = set[0];
        sandbox.dailyPickupData = set[1];
        sandbox.monthlyRevenueData = set[2];
        ['monthlyReportAvailableMonths()', 'buildMonthlyReport("2026-09")'].forEach((call) => {
            ran++;
            try { vm.runInContext(call, sandbox); } catch (e) { threw++; console.log('        បោះ ៖ ' + call + ' — ' + e.message); }
        });
    });
    ok('⛔ ' + ran + ' ការហៅលើ map សំរាម ➜ បោះ ' + threw, threw === 0);
    ok('⛔ ជាន់អប្បបរមា ៖ សាកយ៉ាងតិច ៨ ការហៅ', ran >= 8, ran);
});

scenario('អត្រាយក ៖ ការចែកនឹងសូន្យមិនត្រូវផ្តល់ NaN', () => {
    setData({ '2026-09-01': { codDollar: 0, dodDollar: 0, totalCount: 0 } },
        { '2026-09-01': { packagesPickedUp: 0 } }, {});
    const zero = build('2026-09');
    ok('⛔ កញ្ចប់ 0 ➜ pickupRate ជា null មិនមែន NaN', zero.totals.pickupRate === null, zero.totals.pickupRate);
    setData({ '2026-09-01': { codDollar: 0, dodDollar: 0, totalCount: 8 } },
        { '2026-09-01': { packagesPickedUp: 2 } }, {});
    const rate = build('2026-09');
    ok('អត្រាយក 2/8 = 25%', rate.totals.pickupRate === 25, rate.totals.pickupRate);
});

scenario('ការបូកលុយត្រូវជិតបំផុត (ជៀសកំហុសអណ្តែត)', () => {
    const daily = {};
    for (let i = 1; i <= 10; i++) daily['2026-09-' + String(i).padStart(2, '0')] = { codDollar: 0.1, dodDollar: 0.2, totalCount: 1 };
    setData(daily, {}, {});
    const r = build('2026-09');
    ok('ផលបូក 0.1×10 = 1 គត់', r.totals.cod === 1, r.totals.cod);
    ok('ផលបូក 0.2×10 = 2 គត់', r.totals.dod === 2, r.totals.dod);
    ok('សរុប = 3 គត់', r.totals.total === 3, r.totals.total);
    ok('ថ្ងៃមានប្រតិបត្តិការ = 10', r.totals.activeDays === 10, r.totals.activeDays);
});

scenario('សញ្ញាភាពស្មោះត្រង់ ៖ node ខែមិនត្រូវនឹងផលបូកតាមថ្ងៃ', () => {
    const daily = { '2026-09-01': { codDollar: 10, dodDollar: 5, totalCount: 3 } };
    setData(daily, {}, { '2026-09': { codDollar: 10, dodDollar: 5, totalCount: 3 } });
    const same = build('2026-09');
    ok('ត្រូវគ្នា ➜ គ្មានទង់ព្រមាន', same.mismatch === false && same.ledger !== null);
    setData(daily, {}, { '2026-09': { codDollar: 40, dodDollar: 5, totalCount: 3 } });
    const diff = build('2026-09');
    ok('⛔ ខុសគ្នា ➜ ទង់ព្រមានឡើង', diff.mismatch === true);
    ok('⛔ ទោះខុសគ្នា របាយការណ៍នៅប្រើ *លេខតាមថ្ងៃ* ជាមូលដ្ឋាន', diff.totals.cod === 10, diff.totals.cod);
    setData(daily, {}, { '2026-09': { codDollar: 10, dodDollar: 5, totalCount: 9 } });
    ok('⛔ ចំនួនកញ្ចប់ខុសក៏ត្រូវឡើងទង់ដែរ', build('2026-09').mismatch === true);
    setData(daily, {}, {});
    const none = build('2026-09');
    ok('គ្មាន node ខែ ➜ គ្មានទង់ ហើយ ledger ជា null', none.mismatch === false && none.ledger === null);
});

scenario('⛔ អានសុទ្ធសាធ ៖ របាយការណ៍មិនប៉ះទិន្នន័យ ឬលុយ', () => {
    const daily = {
        '2026-09-01': { codDollar: 10, dodDollar: 5, totalCount: 3 },
        '2026-09-02': { codDollar: -2, dodDollar: 0, totalCount: 1 }
    };
    const pickup = { '2026-09-01': { packagesPickedUp: 2, pickedUpPhones: { '012': 2 } } };
    const monthly = { '2026-09': { codDollar: 99, dodDollar: 0, totalCount: 0 } };
    setData(daily, pickup, monthly);
    const before = JSON.stringify([daily, pickup, monthly]);
    writes.length = 0;
    build('2026-09');
    vm.runInContext('monthlyReportAvailableMonths()', sandbox);
    ok('⛔ សតិ ledger មិនត្រូវប្តូរសោះ', JSON.stringify([daily, pickup, monthly]) === before,
        'មុន=' + before + '\n        ក្រោយ=' + JSON.stringify([daily, pickup, monthly]));
    ok('⛔ គ្មានការសរសេរទៅ Firebase សោះ', writes.length === 0, JSON.stringify(writes.map((w) => w[0])));
    const noWriteNames = ['commitDailyRevenueDelta', 'commitMonthlyRevenueDelta', 'addRevenueToDailyAndMonthlyRecord',
        'applyLedgerBucketDelta', 'runTransaction', 'fb.update', 'fb.set'];
    const body = (sliceFn(src, 'buildMonthlyReport') || '') + (sliceFn(src, 'monthlyReportAvailableMonths') || '')
        + (sliceFn(src, 'renderMonthlyReport') || '') + (sliceFn(src, 'monthlyReportRows') || '');
    const touched = noWriteNames.filter((n) => body.indexOf(n) !== -1);
    ok('⛔ កូដរបាយការណ៍មិនហៅផ្លូវសរសេរលុយណាមួយ', touched.length === 0, touched.join(', '));
});

scenario('មូលដ្ឋានតែមួយជាមួយអេក្រង់ដើម (packagesPickedUp + pickedUpPhones)', () => {
    const stats = sliceFn(src, 'updateDailyScheduleStats') || '';
    ok('⛔ អេក្រង់ដើមអាន packagesPickedUp', stats.indexOf('packagesPickedUp') !== -1);
    ok('⛔ អេក្រង់ដើមរាប់អតិថិជនតាម countPickedUpCustomers()', stats.indexOf('countPickedUpCustomers') !== -1);
    const report = sliceFn(src, 'buildMonthlyReport') || '';
    ok('⛔ របាយការណ៍ប្រើមូលដ្ឋានដដែល (packagesPickedUp)', report.indexOf('packagesPickedUp') !== -1);
    ok('⛔ របាយការណ៍ប្រើមូលដ្ឋានដដែល (countPickedUpCustomers)', report.indexOf('countPickedUpCustomers') !== -1);
    setData({ '2026-09-01': { codDollar: 1, dodDollar: 0, totalCount: 5 } },
        { '2026-09-01': { packagesPickedUp: 3, pickedUpPhones: { '012': 2, '011': 1 } } }, {});
    const r = build('2026-09');
    ok('កញ្ចប់យករួច = 3 ដូចអេក្រង់', r.days[0].picked === 3, r.days[0].picked);
    ok('អតិថិជនយក = 2 ដូចអេក្រង់', r.days[0].customers === 2, r.days[0].customers);
});

// ⛔ ថ្នាក់កំហុស ៖ «ចំណូល» ដែលរាប់កញ្ចប់ដែលអតិថិជន *មិនទាន់យក* (កំណែ 2.30.0)។
//
// អាជីវកម្មពិត ៖ កញ្ចប់ដែលអតិថិជនមិនយកក្នុង ៧ ថ្ងៃ ➜ `claimAndCleanupItem('abandon')`
// ➜ `trashReason: 'expired'` · `isDeducted: true` · **ដកលុយចេញ** ➜ កញ្ចប់ត្រឡប់
// ទៅសាខាកណ្តាល។ ដូច្នេះ ledger ប្រចាំថ្ងៃ **មិនមែនលុយដែលទទួលបានទេ** — វាជា
// «យករួច + កំពុងរង់ចាំ + លុបដោយដៃ» ➜ វា **ប៉ោង** រហូតដល់កញ្ចប់ដោះស្រាយចប់។
//
// ច្បាប់មាស ៖ **`isDeducted` ជាវាលតែមួយគត់ដែលកំណត់លុយ** ➜ «តម្លៃមិនទាន់យក»
// រាប់តែ barcode ដែល `!isDeducted` (លុយនៅក្នុង ledger) **និង** `!isClosed`
// (មិនទាន់យក)។ ច្រឡំវាលណាមួយ ➜ លេខលុយខុសភ្លាម ៖
//   · រាប់ barcode `isDeducted: true` ➜ ដកស្ទួន ➜ ចំណូល **តូចជាងការពិត**
//   · រំលង barcode បើកក្នុងធុងសំរាម «លុប» (លុយមិនប៉ះ) ➜ **ធំជាងការពិត**
//   · រាប់ barcode ដែលបិទរួច ➜ ដកលុយដែលទើបតែទទួល ➜ **តូចជាងការពិត**
scenario('ចំណូល ៖ `isDeducted` និង `isClosed` ជាច្រកទ្វារតែ ២', () => {
    const one = (barcodes) => vm.runInContext('uncollectedItemValue(__item)',
        Object.assign(sandbox, { __item: item('2026-09-01', barcodes) }));
    ok('barcode បើក មិនទាន់ដកលុយ ➜ រាប់ជា «មិនទាន់យក»',
        JSON.stringify(one([bc(10, 5, false, false)])) === JSON.stringify({ cod: 10, dod: 5 }),
        JSON.stringify(one([bc(10, 5, false, false)])));
    ok('⛔ barcode បិទរួច (យករួច) មិនរាប់',
        one([bc(10, 5, true, false)]).cod === 0);
    ok('⛔ barcode ដែលដកលុយរួច (ផុតកំណត់/ដក) មិនរាប់',
        one([bc(10, 5, false, true)]).cod === 0);
    ok('barcode គ្មានវាល isDeducted = មិនទាន់ដក ➜ រាប់',
        one([bc(10, 0, false, undefined)]).cod === 10);
    ok('⛔ ទិសផ្ទុយ ៖ barcode ច្រើនត្រូវបូកគ្នា',
        one([bc(10, 0, false, false), bc(4, 1, false, false), bc(99, 0, true, false)]).cod === 14);

    setData({ '2026-09-01': { codDollar: 100, dodDollar: 0, totalCount: 10 } },
        { '2026-09-01': { packagesPickedUp: 7, pickedUpPhones: { '012': 7 } } }, {});
    setLive([item('2026-09-01', [bc(10, 0, false, false), bc(11, 0, false, false), bc(9, 0, false, false),
        bc(50, 0, false, true), bc(25, 0, true, false)])], []);
    const r = build('2026-09');
    ok('ledger 100 ដក មិនទាន់យក 30 ➜ ចំណូល (យករួច) 70', r.days[0].collectedTotal === 70, r.days[0].collectedTotal);
    ok('«មិនទាន់យក» = 30', r.days[0].pendingTotal === 30, r.days[0].pendingTotal);
    ok('⛔ តម្លៃកញ្ចប់ទាំងអស់នៅដដែល 100 (មូលដ្ឋាន ledger មិនត្រូវបាត់)', r.days[0].total === 100, r.days[0].total);
    ok('ចំណូល + មិនទាន់យក = តម្លៃទាំងអស់', r.days[0].collectedTotal + r.days[0].pendingTotal === r.days[0].total);
    ok('សរុបប្រចាំខែ ៖ ចំណូល 70', r.totals.collectedTotal === 70, r.totals.collectedTotal);
    ok('សរុបប្រចាំខែ ៖ តម្លៃទាំងអស់ 100', r.totals.total === 100, r.totals.total);
});

scenario('ចំណូល ៖ COD និង DOD ត្រូវដកដាច់ដោយឡែក', () => {
    setData({ '2026-09-01': { codDollar: 60, dodDollar: 40, totalCount: 10 } }, {}, {});
    setLive([item('2026-09-01', [bc(10, 0, false, false), bc(0, 25, false, false)])], []);
    const d = build('2026-09').days[0];
    ok('COD យករួច = 60 − 10 = 50', d.collectedCod === 50, d.collectedCod);
    ok('DOD យករួច = 40 − 25 = 15', d.collectedDod === 15, d.collectedDod);
    ok('⛔ COD មិនត្រូវលេប DOD (ផលបូក = 65)', d.collectedTotal === 65, d.collectedTotal);
    ok('⛔ ទិសផ្ទុយ ៖ ledger COD/DOD នៅដដែល', d.cod === 60 && d.dod === 40, d.cod + '/' + d.dod);

    // ⛔ clamp ត្រូវឈរ **ក្នុងមួយរូបិយវត្ថុ** ៖ DOD មិនទាន់យក ធំជាង DOD ledger
    // មិនត្រូវទៅកាត់ COD ដែលទទួលបានពិត (ទិន្នន័យចាស់អាចមិនស៊ីគ្នា)។
    setData({ '2026-09-01': { codDollar: 60, dodDollar: 0, totalCount: 6 } }, {}, {});
    setLive([item('2026-09-01', [bc(10, 5, false, false)])], []);
    const skew = build('2026-09').days[0];
    ok('⛔ DOD មិនទាន់យក លើស ledger ➜ DOD យករួច clamp 0', skew.collectedDod === 0, skew.collectedDod);
    ok('⛔ ហើយវាមិនត្រូវកាត់ COD យករួច (នៅ 50)', skew.collectedCod === 50, skew.collectedCod);
});

scenario('ចំណូល ៖ ធុងសំរាមដែល *រក្សា* លុយត្រូវដកចេញដែរ', () => {
    setData({ '2026-09-02': { codDollar: 60, dodDollar: 0, totalCount: 6 } }, {}, {});
    setLive([], [item('2026-09-02', [bc(20, 0, false, false)])]);
    ok('ធាតុ «លុប» (លុយមិនប៉ះ) ត្រូវដកចេញ ➜ 40',
        build('2026-09').days[0].collectedTotal === 40, build('2026-09').days[0].collectedTotal);
    setLive([], [item('2026-09-02', [bc(20, 0, false, true)])]);
    ok('⛔ ធាតុ «ដក/ផុតកំណត់» ដកលុយរួច ➜ មិនដកម្តងទៀត ➜ 60',
        build('2026-09').days[0].collectedTotal === 60, build('2026-09').days[0].collectedTotal);
    setLive([], [item('2026-09-02', [bc(20, 0, true, false)])]);
    ok('ធាតុ «យករួច» ក្នុងធុងសំរាម ➜ ចំណូលនៅ 60',
        build('2026-09').days[0].collectedTotal === 60, build('2026-09').days[0].collectedTotal);
    setLive([item('2026-09-02', [bc(10, 0, false, false)])], [item('2026-09-02', [bc(15, 0, false, false)])]);
    ok('⛔ ប្រវត្តិ និងធុងសំរាមរាប់ជា *ផលបូក* មិនមែនជំនួសគ្នា ➜ 35',
        build('2026-09').days[0].collectedTotal === 35, build('2026-09').days[0].collectedTotal);
});

scenario('ចំណូល ៖ ខែដែលដោះស្រាយចប់ ➜ ចំណូល = តម្លៃទាំងអស់', () => {
    // ⛔ មូលហេតុដែលការ **ដក** ត្រូវជាងការបូកតម្លៃ barcode ដែលបិទ ៖ ធុងសំរាម
    // រក្សាតែ ៣០ ថ្ងៃ (ធាតុ `expired` ត្រឹម ២ ថ្ងៃ) តែ ledger រក្សា **ជានិច្ច**។
    setData({
        '2026-01-04': { codDollar: 12.5, dodDollar: 7.5, totalCount: 4 },
        '2026-01-05': { codDollar: 10, dodDollar: 0, totalCount: 2 }
    }, { '2026-01-04': { packagesPickedUp: 4, pickedUpPhones: { '012': 4 } } }, {});
    const r = build('2026-01');
    ok('គ្មានកញ្ចប់រង់ចាំទៀត ➜ ចំណូល = តម្លៃទាំងអស់', r.totals.collectedTotal === r.totals.total, r.totals.collectedTotal);
    ok('ចំណូលខែចាស់ = 30', r.totals.collectedTotal === 30, r.totals.collectedTotal);
    ok('មិនទាន់យក = 0', r.totals.pendingTotal === 0, r.totals.pendingTotal);
});

scenario('ចំណូល ៖ ការត្រងខែ និងថ្ងៃត្រូវច្បាស់', () => {
    setData({ '2026-09-01': { codDollar: 50, dodDollar: 0, totalCount: 5 },
        '2026-09-02': { codDollar: 50, dodDollar: 0, totalCount: 5 } }, {}, {});
    setLive([item('2026-08-31', [bc(40, 0, false, false)]), item('2026-10-01', [bc(40, 0, false, false)]),
        item('2026-09-02', [bc(20, 0, false, false)]),
        { id: 'bogus', scanDate: 'nope', barcodes: [bc(77, 0, false, false)] }], []);
    const r = build('2026-09');
    const d1 = r.days.filter((d) => d.date === '2026-09-01')[0];
    const d2 = r.days.filter((d) => d.date === '2026-09-02')[0];
    ok('⛔ ខែជិតខាងមិនកាត់ចំណូល', d1.collectedTotal === 50, d1.collectedTotal);
    ok('⛔ តម្លៃមិនទាន់យកចុះលើ *ថ្ងៃស្កេន* របស់វា', d2.collectedTotal === 30, d2.collectedTotal);
    ok('សរុប = 80', r.totals.collectedTotal === 80, r.totals.collectedTotal);
    const map = vm.runInContext('uncollectedValueByDate()', sandbox);
    ok('⛔ កូនសោថ្ងៃមិនត្រូវទម្រង់ត្រូវរំលង', map['nope'] === undefined, JSON.stringify(Object.keys(map)));
    sandbox.__map = map;
    // ⛔ ចំណូលរបស់ខែត្រូវដេរីវេពី **ថ្ងៃ** (clamp ក្នុងមួយថ្ងៃ) មិនមែនបូកមុន clamp។
    // ⛔ កំណែ 2.34.0 ដក `collectedValueForMonth()` ចេញជាមួយអេក្រង់ «ស្ថិតិ ៣ ខែ»
    // ➜ អ្នកកាន់ច្បាប់នេះឥឡូវជា **`buildMonthlyReport()` ខ្លួនវា** (វាបូកថ្ងៃ
    // មួយៗចូល `totals`) ➜ ការអះអាងត្រូវវាស់ **កូដដែល ship ពិត**។
    const daySum = r.days.reduce((sum, d) => sum + d.collectedTotal, 0);
    ok('សរុបខែ ស្មើផលបូកចំណូលតាមថ្ងៃ (clamp ក្នុងមួយថ្ងៃ)',
        Math.abs(r.totals.collectedTotal - daySum) < 0.0001,
        r.totals.collectedTotal + ' ធៀប ' + daySum);
    const emptyMonth = vm.runInContext('buildMonthlyReport("2025-01")', sandbox);
    ok('⛔ ខែគ្មានទិន្នន័យ ➜ សូន្យ មិនមែន NaN',
        emptyMonth.totals.collectedTotal === 0 && emptyMonth.days.length === 0,
        JSON.stringify(emptyMonth.totals.collectedTotal));
});

scenario('ចំណូល ៖ រូបរាងឆៅ · clamp · មិនបោះ', () => {
    setData({ '2026-09-01': { codDollar: 10, dodDollar: 0, totalCount: 1 } }, {}, {});
    setLive([item('2026-09-01', [bc(999, 0, false, false)])], []);
    const over = build('2026-09');
    ok('⛔ មិនទាន់យក ធំជាង ledger ➜ clamp ត្រឹម 0 (មិនអវិជ្ជមាន)',
        over.days[0].collectedTotal === 0 && over.totals.collectedTotal === 0, over.days[0].collectedTotal);
    ok('⛔ «មិនទាន់យក» ក៏មិនត្រូវលើសតម្លៃទាំងអស់', over.days[0].pendingTotal === 10, over.days[0].pendingTotal);

    setData({ '2026-09-01': { codDollar: 20, dodDollar: 0, totalCount: 2 } }, {}, {});
    setLive([{ id: 'legacy', scanDate: '2026-09-01', cod: '5', dod: null, isClosed: false }], []);
    ok('ធាតុចាស់ (គ្មានជួរ barcodes) ក៏រាប់ដែរ ➜ 15',
        build('2026-09').days[0].collectedTotal === 15, build('2026-09').days[0].collectedTotal);
    setLive([item('2026-09-01', [bc(-30, 0, false, false)])], []);
    ok('⛔ តម្លៃ barcode អវិជ្ជមានមិនត្រូវធ្វើឲ្យចំណូលធំជាង ledger',
        build('2026-09').days[0].collectedTotal === 20, build('2026-09').days[0].collectedTotal);
    setLive([item('2026-09-01', [bc(-30, 0, false, false), bc(5, 0, false, false)])], []);
    ok('⛔ barcode អវិជ្ជមានមិនត្រូវលុបតម្លៃរបស់បងប្អូន',
        build('2026-09').days[0].collectedTotal === 15, build('2026-09').days[0].collectedTotal);

    let bad = 0, ran = 0;
    const junk = [[null, null], [[null, undefined, 5, 'x'], [{ scanDate: '2026-09-01' }]],
        ['nope', { a: 1 }], [[{ scanDate: '2026-09-01', barcodes: 'nope' }],
            [{ scanDate: '2026-09-01', barcodes: [null, { cod: {}, dod: [] }] }]]];
    junk.forEach((set) => {
        sandbox.scanHistory = set[0];
        sandbox.deletedItems = set[1];
        ran++;
        try {
            const r = build('2026-09');
            const finite = r.days.every((d) => [d.collectedCod, d.collectedDod, d.collectedTotal, d.pendingTotal]
                .every((n) => Number.isFinite(n) && n >= 0));
            if (!finite) { bad++; console.log('        NaN/អវិជ្ជមាន ៖ ' + JSON.stringify(r.days)); }
        } catch (e) { bad++; console.log('        បោះ ៖ ' + e.message); }
    });
    ok('⛔ ' + ran + ' ទិដ្ឋភាពសំរាម ➜ បោះ ឬ NaN ' + bad + ' ដង', bad === 0);
    ok('⛔ ជាន់អប្បបរមា ៖ សាកយ៉ាងតិច ៤ ទិដ្ឋភាព', ran >= 4, ran);
});

scenario('⛔ ភាពស្មោះត្រង់ ៖ ទិដ្ឋភាពមិនទាន់មកដល់ ➜ មិនអះអាងលេខលុយ', () => {
    // ការដក «តម្លៃមិនទាន់យក» ត្រូវការទិដ្ឋភាព **ពេញលេញ** ៖ បើ listener ប្រវត្តិ
    // ឬធុងសំរាមមិនទាន់មកដល់ នោះ `scanHistory` ទទេ ➜ ចំណូល = តម្លៃទាំងអស់
    // **ដោយខុស** ➜ ត្រូវរាយថា «វាស់មិនបាន» មិនមែនលេខក្លែងក្លាយ។
    setData({ '2026-09-01': { codDollar: 100, dodDollar: 0, totalCount: 10 } }, {}, {});
    setLive([item('2026-09-01', [bc(30, 0, false, false)])], []);
    ok('ទិដ្ឋភាពគ្រប់ ➜ វាស់បាន', build('2026-09').totals.collectedMeasurable === true);
    sandbox.dbListenerPendingPaths.add(vm.runInContext('DB_LISTENER_KEY_HISTORY', sandbox));
    ok('⛔ listener ប្រវត្តិមិនទាន់មកដល់ ➜ collectedMeasurable = false',
        build('2026-09').totals.collectedMeasurable === false);
    sandbox.dbListenerPendingPaths.clear();
    sandbox.dbListenerFailedPaths.add(vm.runInContext('DB_LISTENER_KEY_DELETED', sandbox));
    ok('⛔ listener ធុងសំរាមងាប់ ➜ collectedMeasurable = false',
        build('2026-09').totals.collectedMeasurable === false);
    sandbox.dbListenerFailedPaths.clear();
    ok('⛔ ទិសផ្ទុយ ៖ ដោះស្រាយរួច ➜ វាស់បានវិញ', build('2026-09').totals.collectedMeasurable === true);
    ok('⛔ ច្រកទ្វារឆ្លងកាត់ dbListenerViewIsStale() (មូលដ្ឋានតែមួយ)',
        (sliceFn(src, 'collectedValueIsMeasurable') || '').indexOf('dbListenerViewIsStale') !== -1);
});

scenario('ចំណូល ៖ អត្ថបទបង្ហាញ (ជា $ និង ៛)', () => {
    // ⛔ អ្នកប្រើសុំ **ទាំង $ ទាំង ៛** ➜ វាស់ជា *ឥរិយាបថ* មិនមែនស្កេនឈ្មោះអថេរ។
    sandbox.__v = 549.64;
    ok('បង្ហាញជាដុល្លារ', vm.runInContext('collectedMoneyText(__v, true)', sandbox) === '$549.64');
    const riel = vm.runInContext('collectedRielText(__v, true)', sandbox);
    ok('បង្ហាញជារៀល (អត្រា 4100)', riel.indexOf('៛') !== -1 && /2[,.]253[,.]524/.test(riel), riel);
    const marker = vm.runInContext('MONTHLY_REPORT_UNKNOWN', sandbox);
    const unknown = vm.runInContext('collectedMoneyText(__v, false)', sandbox);
    ok('⛔ វាស់មិនបាន ➜ មិនត្រូវបង្ហាញលេខលុយ',
        unknown === marker && unknown.indexOf('549') === -1, unknown);
    ok('⛔ វាស់មិនបាន ➜ បន្ទាត់រងក៏មិនបង្ហាញរៀល',
        vm.runInContext('collectedRielText(__v, false)', sandbox).indexOf('៛') === -1);
    sandbox.__v = -5;
    ok('⛔ តម្លៃអវិជ្ជមានមិនត្រូវឡើងដល់អេក្រង់',
        vm.runInContext('collectedMoneyText(__v, true)', sandbox) === '$0.00');
    sandbox.__v = 'abc';
    ok('⛔ តម្លៃមិនមែនលេខមិនត្រូវក្លាយជា NaN លើអេក្រង់',
        vm.runInContext('collectedMoneyText(__v, true)', sandbox) === '$0.00');
});

scenario('⛔ មូលដ្ឋានតែមួយ ៖ ម៉ូឌុលស្ថិតិទាំង ៣ ប្រើ helper ដដែល', () => {
    // ⛔ ច្បាប់ចម្លងទី ២ នៃការគណនាលុយ = ជុំក្រោយកែមួយ ភ្លេចមួយ ➜ លេខ ២ ផ្ទុយគ្នា
    //
    // ⛔ ការស្កេនត្រូវដើរតាម **ផ្លូវហៅ ១ ជាន់** មិនមែនត្រឹមតួផ្ទាល់ ៖ កំណែ
    // 2.30.2 រួបរួមកាតស្ថិតិថ្ងៃ/ខែទៅ `buildStatCardItem()` ➜ ការហៅ
    // `collectedValueOf()` ផ្លាស់ចូល helper នោះ។ ការស្កេនតួផ្ទាល់តែម្យ៉ាង
    // នឹងធ្លាក់លើការរួបរួមដែលត្រឹមត្រូវ។ ⛔ តែវា **មិនត្រូវខ្សោយដល់ថ្នាក់**
    // «`collectedValueOf` នៅកន្លែងណាមួយក្នុងឯកសារ» ទេ — ត្រូវមានផ្លូវហៅពិត។
    const CALL_RE = /\b([a-zA-Z_$][\w$]*)\s*\(/g;
    const bodyWithCallees = (name) => {
        const own = sliceFn(src, name) || '';
        let out = own;
        const seen = new Set([name]);
        let m;
        CALL_RE.lastIndex = 0;
        while ((m = CALL_RE.exec(own))) {
            const callee = m[1];
            if (seen.has(callee)) continue;
            seen.add(callee);
            const sub = sliceFn(src, callee);
            if (sub) out += '\n' + sub;
        }
        return out;
    };
    const users = ['buildMonthlyReport', 'openDailyStatsModal'];
    users.forEach((name) => {
        const body = bodyWithCallees(name);
        ok(name + '() ហៅ collectedValueOf()', body.indexOf('collectedValueOf') !== -1);
        ok(name + '() ហៅ collectedValueIsMeasurable()', body.indexOf('collectedValueIsMeasurable') !== -1);
        ok(name + '() អានតម្លៃមិនទាន់យកពី uncollectedValue*()', /uncollectedValue(ByDate|ForMonth)/.test(body), name);
    });
    ok('⛔ ជាន់អប្បបរមា ៖ វាស់លើឯកសារ ១ ដែលមាន function ទាំង ២',
        users.every((n) => !!sliceFn(src, n)), users.filter((n) => !sliceFn(src, n)).join(', '));
    const daily = bodyWithCallees('openDailyStatsModal');
    ok('⛔ ម៉ូឌុលថ្ងៃមិនបង្ហាញ ledger ជា «ចំណូល» ទៀត', daily.indexOf('ចំណូល (យករួច)') !== -1);
    ok('⛔ ម៉ូឌុលថ្ងៃនៅតែបង្ហាញតម្លៃទាំងអស់ដែរ (តម្លាភាព)',
        daily.indexOf('តម្លៃកញ្ចប់ទាំងអស់') !== -1);
    ok('⛔ អេក្រង់ «ស្ថិតិ ៣ ខែ» ត្រូវបានដកចេញពិត ➜ គ្មានផ្ទៃទី ៣ ដែលអាចឃ្លាតទៀតទេ',
        src.indexOf('openMonthlyStatsModal') === -1 && src.indexOf('collectedValueForMonth') === -1);
});

// 🔴 វាស់បាន (2026-09-09) ៖ mutation ដែលប្តូរជួរឈរ «COD យករួច ($)» ➜ `d.total`
// **រស់រាន** លើ checker ១៦០ ទាំងអស់ — ព្រោះសេណារីយ៉ូខាងក្រោមអះអាងតែជួរឈរ ៣
// (ចំណូល · មិនទាន់យក · ទាំងអស់) ហើយ **មិនដែលមើលជួរឈរ COD/DOD សោះ**។
// ⛔ ការអះអាងត្រូវ **ដេរីវេពីចំណងជើង** មិនមែនចាក់លេខ literal។
scenario('⛔ ជួរឈរនាំចេញ **គ្រប់ជួរ** ត្រូវផ្ទុកវាលរបស់របាយការណ៍ដែលត្រូវគ្នា', () => {
    const headers = vm.runInContext('MONTHLY_REPORT_HEADERS', sandbox);
    // ចំណងជើង ➜ វាលក្នុង report.days[i] (ថ្ងៃ) និង report.totals (សរុប)
    const MAP = {
        'កញ្ចប់ចូល': 'count', 'COD យករួច ($)': 'collectedCod', 'DOD យករួច ($)': 'collectedDod',
        'ចំណូលយករួច ($)': 'collectedTotal', 'មិនទាន់យក ($)': 'pendingTotal',
        'តម្លៃទាំងអស់ ($)': 'total', 'កញ្ចប់យករួច': 'picked', 'អតិថិជនយក': 'customers'
    };
    const mapped = Object.keys(MAP).filter((h) => headers.indexOf(h) !== -1);
    ok('⛔ ជាន់អប្បបរមា៖ ចំណងជើងត្រូវគ្របវាលយ៉ាងតិច ៨', mapped.length >= 8,
        JSON.stringify(headers));

    // ⛔ តម្លៃ **មានសេន** និង **ខុសគ្នាទាំងអស់** ➜ ការប្តូរជួរឈរណាមួយត្រូវចាប់បាន
    setData({ '2026-09-02': { codDollar: 17.31, dodDollar: 9.42, totalCount: 5 } },
        { '2026-09-02': { packagesPickedUp: 4, pickedUpPhones: { '012': 3, '013': 1 } } }, {});
    setLive([item('2026-09-02', [bc(3.11, 0, false, false), bc(0, 1.22, false, false)])], []);
    sandbox.__report = build('2026-09');
    const rep = sandbox.__report;
    const rows = vm.runInContext('monthlyReportRows(__report)', sandbox);
    ok('⛔ លក្ខខណ្ឌចាំបាច់៖ របាយការណ៍មានជួរដេកថ្ងៃ ១ និងជួរសរុប',
        rep.days.length === 1 && rows.length === 2, rows.length);

    const dayVals = mapped.map((h) => rep.days[0][MAP[h]]);
    ok('⛔ ជាន់អប្បបរមា៖ តម្លៃសាកល្បង **ខុសគ្នាទាំងអស់** (បើដូចគ្នា ការប្តូរជួរឈរលាក់បាន)',
        new Set(dayVals).size === dayVals.length, JSON.stringify(dayVals));
    ok('⛔ ជាន់អប្បបរមា៖ លុយសាកល្បង **មានសេន** (លេខមូលលាក់ mutation នៃការបង្គត់)',
        [rep.days[0].collectedCod, rep.days[0].collectedDod, rep.days[0].total]
            .some((v) => Math.round(v * 100) % 100 !== 0),
        JSON.stringify([rep.days[0].collectedCod, rep.days[0].collectedDod, rep.days[0].total]));

    mapped.forEach((h) => {
        const i = headers.indexOf(h);
        ok('ជួរដេកថ្ងៃ ៖ ជួរឈរ «' + h + '» = report.days[0].' + MAP[h],
            rows[0][i] === rep.days[0][MAP[h]],
            'នាំចេញ=' + rows[0][i] + ' · របាយការណ៍=' + rep.days[0][MAP[h]]);
        ok('ជួរសរុប ៖ ជួរឈរ «' + h + '» = report.totals.' + MAP[h],
            rows[1][i] === rep.totals[MAP[h]],
            'នាំចេញ=' + rows[1][i] + ' · របាយការណ៍=' + rep.totals[MAP[h]]);
    });
    ok('ជួរដេកទី ១ ចាប់ផ្តើមដោយថ្ងៃ · ជួរចុងក្រោយដោយ «សរុប»',
        rows[0][0] === rep.days[0].date && rows[1][0] === 'សរុប',
        JSON.stringify([rows[0][0], rows[1][0]]));
});

scenario('ចំណូល ៖ ជួរឈរនាំចេញ', () => {
    const headers = vm.runInContext('MONTHLY_REPORT_HEADERS', sandbox);
    const iCollected = headers.indexOf('ចំណូលយករួច ($)');
    const iPending = headers.indexOf('មិនទាន់យក ($)');
    const iAll = headers.indexOf('តម្លៃទាំងអស់ ($)');
    ok('⛔ ចំណងជើងមានជួរឈរ «ចំណូលយករួច ($)»', iCollected !== -1, JSON.stringify(headers));
    ok('⛔ ចំណងជើងមានជួរឈរ «មិនទាន់យក ($)»', iPending !== -1, JSON.stringify(headers));
    ok('⛔ ចំណងជើងនៅរក្សាជួរឈរ «តម្លៃទាំងអស់ ($)» (តម្លាភាព)', iAll !== -1, JSON.stringify(headers));
    setData({ '2026-09-01': { codDollar: 40, dodDollar: 0, totalCount: 4 } },
        { '2026-09-01': { packagesPickedUp: 3, pickedUpPhones: { '012': 3 } } }, {});
    setLive([item('2026-09-01', [bc(10, 0, false, false)])], []);
    sandbox.__report = build('2026-09');
    const rows = vm.runInContext('monthlyReportRows(__report)', sandbox);
    ok('ចំនួនជួរឈរស៊ីនឹងចំណងជើង', rows[0].length === headers.length, rows[0].length + ' ធៀប ' + headers.length);
    ok('ជួរថ្ងៃ ៖ ចំណូល 30 · មិនទាន់យក 10 · ទាំងអស់ 40',
        rows[0][iCollected] === 30 && rows[0][iPending] === 10 && rows[0][iAll] === 40, JSON.stringify(rows[0]));
    ok('ជួរសរុបផ្ទុកលេខដដែល',
        rows[1][iCollected] === 30 && rows[1][iAll] === 40, JSON.stringify(rows[1]));
    sandbox.dbListenerPendingPaths.add(vm.runInContext('DB_LISTENER_KEY_HISTORY', sandbox));
    sandbox.__report = build('2026-09');
    const dash = vm.runInContext('monthlyReportRows(__report)', sandbox);
    const marker = vm.runInContext('MONTHLY_REPORT_UNKNOWN', sandbox);
    ok('⛔ វាស់មិនបាន ➜ ជួរឈរចំណូលនាំចេញជា «—»',
        dash[0][iCollected] === marker && dash[1][iCollected] === marker, JSON.stringify(dash[0]));
    ok('⛔ តែជួរឈរ «តម្លៃទាំងអស់» នៅតែជាលេខ (វាមិនអាស្រ័យលើប្រវត្តិ)',
        dash[0][iAll] === 40, JSON.stringify(dash[0]));
    sandbox.dbListenerPendingPaths.clear();
});

scenario('ឈ្មោះឯកសារ និងជួរដេកនាំចេញ', () => {
    setData({ '2026-09-01': { codDollar: 1.5, dodDollar: 2.25, totalCount: 4 } },
        { '2026-09-01': { packagesPickedUp: 1, pickedUpPhones: { '012': 1 } } }, {});
    vm.runInContext('monthlyReportMonth = "2026-09";', sandbox);
    const name = vm.runInContext('monthlyReportFilenameBase()', sandbox);
    ok('ឈ្មោះឯកសារមានតែតួអក្សរសុវត្ថិភាព', /^[A-Za-z0-9_\-]+$/.test(name), name);
    ok('ឈ្មោះឯកសារផ្ទុកខែ', name.indexOf('2026-09') !== -1, name);
    sandbox.__report = build('2026-09');
    const rows = vm.runInContext('monthlyReportRows(__report)', sandbox);
    ok('ជួរដេក = ថ្ងៃ + ជួរសរុប', rows.length === 2, rows.length);
    ok('ជួរសរុបឈរចុងក្រោយ', rows[rows.length - 1][0] === 'សរុប', JSON.stringify(rows[rows.length - 1]));
    ok('ជួរសរុបផ្ទុកលេខត្រឹមត្រូវ', rows[1][4] === 3.75 && rows[1][1] === 4, JSON.stringify(rows[1]));
    const headers = vm.runInContext('MONTHLY_REPORT_HEADERS', sandbox);
    ok('ចំនួនជួរឈរស៊ីនឹងចំណងជើង', rows[0].length === headers.length, rows[0].length + ' ធៀប ' + headers.length);
});

scenario('Excel ៖ ជួរឈរថ្ងៃត្រូវជា TEXT ក្នុង XML ពិត', () => {
    setData({
        '2026-09-01': { codDollar: 1.5, dodDollar: 2.25, totalCount: 4 },
        '2026-09-02': { codDollar: 0, dodDollar: 1, totalCount: 1 }
    }, {}, {});
    sandbox.XLSX = XLSX;
    sandbox.__report = build('2026-09');
    const rows = vm.runInContext('monthlyReportRows(__report)', sandbox);
    const headers = vm.runInContext('MONTHLY_REPORT_HEADERS', sandbox);
    const aoa = [headers].concat(rows);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    sandbox.__ws = ws;
    sandbox.__rowCount = rows.length;
    vm.runInContext('forceSheetTextCells(__ws, __rowCount, MONTHLY_REPORT_TEXT_COLUMN_INDEXES)', sandbox);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'report');
    const buf = Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx', bookSST: true }));
    const sheetXml = unzipEntry(buf, 'xl/worksheets/sheet1.xml');
    ok('អាន sheet1.xml ចេញពី .xlsx ពិតបាន', !!sheetXml);
    if (!sheetXml) return;
    const cellA = (ref) => {
        const m = new RegExp('<c r="' + ref + '"([^>]*)>').exec(sheetXml);
        return m ? m[1] : null;
    };
    ['A2', 'A3', 'A4'].forEach((ref) => {
        const attrs = cellA(ref);
        ok('កោសិកា ' + ref + ' ជា TEXT (t="s") មិនមែនកាលបរិច្ឆេទ', !!attrs && /t="s"/.test(attrs), String(attrs));
    });
    ok('⛔ ជួរសរុបក៏ជា TEXT ដែរ', /t="s"/.test(String(cellA('A4'))), String(cellA('A4')));
    // SheetJS មិនដាក់ attribute `t` លើកោសិកាលេខសោះ ➜ attrs ជាខ្សែអក្សរទទេ
    // (មិនមែន null) ➜ ត្រូវប្រៀបធៀបនឹង `null` មិនមែនតម្លៃពិត/មិនពិត
    const b2 = cellA('B2');
    ok('⛔ ទិសផ្ទុយ ៖ ជួរឈរលេខមិនត្រូវក្លាយជា TEXT', b2 !== null && !/t="s"/.test(b2), JSON.stringify(b2));
    const idx = vm.runInContext('MONTHLY_REPORT_TEXT_COLUMN_INDEXES', sandbox);
    ok('MONTHLY_REPORT_TEXT_COLUMN_INDEXES ចង្អុលទៅជួរឈរ «ថ្ងៃ»',
        Array.isArray(idx) && idx.length === 1 && idx[0] === 0 && headers[0] === 'ថ្ងៃ', JSON.stringify(idx));
});

scenario('CSP ៖ ប៊ូតុងទាំងអស់ឆ្លងកាត់ ACTION_ALLOWLIST', () => {
    const html = fs.readFileSync(path.join(ROOT, 'ZoeW', 'index.html'), 'utf8');
    const allowStart = src.indexOf('const ACTION_ALLOWLIST');
    const allow = src.slice(allowStart, src.indexOf('];', allowStart));
    ['renderMonthlyReport', 'exportMonthlyReportAsExcel', 'exportMonthlyReportAsPDF', 'moreMenuMonthlyReport'].forEach((name) => {
        ok('ACTION_ALLOWLIST មាន ' + name, allow.indexOf('"' + name + '"') !== -1);
    });
    ok('ប្រអប់ monthlyReportModal មានក្នុង index.html', html.indexOf('id="monthlyReportModal"') !== -1);
    ok('ប្រអប់មានកន្លែងបង្ហាញ monthlyReportBody', html.indexOf('id="monthlyReportBody"') !== -1);
    ok('⛔ ការជ្រើសខែឆ្លងកាត់ data-act (គ្មាន onchange=)',
        /id="monthlyReportMonthSel"[^>]*data-act="renderMonthlyReport"[^>]*data-on="change"/.test(html)
        && !/onchange=/.test(html));
    ok('⛔ ការសម្អាតពេលចាកចេញគ្រប monthlyReportBody',
        (sliceFn(src, 'clearSensitiveModalFields') || '').indexOf('monthlyReportBody') !== -1);
    ok('⛔ ការសម្អាតពេលចាកចេញ reset ខែដែលជ្រើស',
        /monthlyReportMonth\s*=\s*''/.test(sliceFn(src, 'clearSensitiveModalFields') || ''));
});

scenario('⛔ ជាន់អប្បបរមា ៖ ការវាស់មិនត្រូវទទេ', () => {
    ok('ស្រង់ function យ៉ាងតិច ២៣ ចេញពី app.js ពិត', FNS.every((n) => !!sliceFn(src, n)),
        FNS.filter((n) => !sliceFn(src, n)).join(', '));
    ok('ការវាស់លើសពី ១០០ assertion', pass + fail >= 100, pass + fail);
});

console.log('');
if (fail) {
    console.log('❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')');
    process.exit(1);
}
console.log('✅ ok ' + pass);
