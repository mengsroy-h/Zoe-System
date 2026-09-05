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
let XLSX = null;
try { XLSX = require('xlsx'); } catch (e) { XLSX = null; }
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = process.env.MREPORT_APP_DIR || path.join(__dirname, '..');

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
function sliceConst(src, name) {
    const m = src.match(new RegExp('^ *(?:const|let) ' + name + ' = .*$', 'm'));
    return m ? m[0] : null;
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
    Math, String, Number, Object, Array, JSON, Date, isFinite, isNaN, parseFloat, parseInt, RegExp,
    exchangeRateRiel: 4100,
    dailyRevenueData: {},
    monthlyRevenueData: {},
    dailyPickupData: {},
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
    'MONTHLY_REPORT_MONEY_TOLERANCE', 'EXPORT_TEXT_COLUMN_INDEXES'];
CONSTS.forEach((name) => {
    const line = sliceConst(src, name);
    ok('រកឃើញ ' + name + ' ក្នុង app.js', !!line);
    if (line) vm.runInContext(line, sandbox);
});
vm.runInContext('let monthlyReportMonth = "";', sandbox);

const FNS = ['appZoneParts', 'getZoneDateKey', 'ledgerNumber', 'countPickedUpCustomers',
    'monthlyReportMonthOf', 'monthlyReportPositive', 'monthlyReportMoney', 'monthlyReportCount',
    'monthlyReportAvailableMonths', 'buildMonthlyReport', 'monthlyReportRiel',
    'monthlyReportFilenameBase', 'monthlyReportRows', 'forceSheetTextCells'];
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
    if (!XLSX) { ok('⛔ ត្រូវការ package xlsx ដើម្បីវាស់ថ្នាក់នេះ (npm i xlsx)', false, 'xlsx មិនបានដំឡើង'); return; }
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
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', bookSST: true });
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
    ok('ស្រង់ function យ៉ាងតិច ១៤ ចេញពី app.js ពិត', FNS.every((n) => !!sliceFn(src, n)),
        FNS.filter((n) => !sliceFn(src, n)).join(', '));
    ok('ការវាស់លើសពី ៤០ assertion', pass + fail >= 40, pass + fail);
});

console.log('');
if (fail) {
    console.log('❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')');
    process.exit(1);
}
console.log('✅ ok ' + pass);
