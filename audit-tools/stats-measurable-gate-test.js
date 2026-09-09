// ⛔ ថ្នាក់កំហុស ៖ អេក្រង់ស្ថិតិរាយ **លេខ** លើអ្វីដែល *វាស់មិនបាន*។
//
// រូបមន្ត «ចំណូល (យករួច)» ជាការ **ដក** ៖
//     collected = ledger − open
//        ledger ← `zoew_daily_revenue_cod_dod`  (listener `dailyRevenue`)
//        open   ← `scanHistory` + `deletedItems` (listener `history` · `deleted`)
//
// ច្បាប់ក្នុង CLAUDE.md ៖ «⛔ ត្រូវការទិដ្ឋភាព *ពេញលេញ* ... មិនគ្រប់ ➜ បង្ហាញ
// **`—`** មិនមែនលេខ (ប្រវត្តិទទេ ➜ ចំណូល = ledger **ដោយខុស**)»។
//
// ⛔ ហេតុផលនោះឈរ **ទាំងសងខាង** នៃការដក — តែ `collectedValueIsMeasurable()`
// ពិនិត្យតែខាង `open` ប៉ុណ្ណោះ។ ខាង `ledger` គ្មានអ្នកយាម ➜ ពេល listener
// `dailyRevenue` **ព្យួរ ឬងាប់** ខណៈ `history`/`deleted` នៅរស់ ៖
//     collected = max(0, ledger_ចាស់ − open_ថ្មី) ➜ អ្នកប្រើអាន **$0.00**
// ដែលជាលេខ **កុហក** មិនមែន «—»។ នេះជាច្បាប់ដដែលនឹង 🩺 ពិនិត្យសុខភាព ៖
// «ការរាយ ✅ លើអ្វីដែលមិនបានវាស់ អាក្រក់ជាង ❌ ក្លែងក្លាយ»។
//
// ⛔ តេស្តនេះរត់ **កូដពិត** របស់អេក្រង់ក្នុង `vm` ជាមួយ DOM ក្លែង រួច **អាន
// HTML ដែលអ្នកប្រើមើលឃើញ** — មិនមែនអះអាងលើឈ្មោះ function ទេ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.STATSGATE_APP_DIR || path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('  ok    ' + label); pass++; }
    else { console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + String(detail).slice(0, 500) : '')); fail++; }
}
function scenario(name, fn) {
    console.log('\n=== ' + name + ' ===');
    try { fn(); } catch (e) { ok(name + ' រត់ដល់ចប់', false, (e && e.stack) || e); }
}

if (!fs.existsSync(APP_JS)) {
    console.log('  FAIL  រកមិនឃើញ ' + APP_JS + ' ➜ គ្មានអ្វីត្រូវពិនិត្យ');
    console.log('\n❌ ធ្លាក់ 1');
    process.exit(1);
}
const SRC = fs.readFileSync(APP_JS, 'utf8');

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

// ⛔ រកឈ្មោះមិនឃើញ ➜ **stub** មិនមែន exit (បើអត់ ការអះអាងខាងក្រោមត្រូវបិទបាំង)។
const WANT = ['sanitizeInput', 'ledgerNumber', 'statsMonthOf', 'statsPositive', 'statsMoney',
    'statsCount', 'countPickedUpCustomers', 'uncollectedBarcodeValue', 'uncollectedItemValue',
    'uncollectedValueByDate', 'collectedValueOf', 'collectedValueForMonth', 'collectedMoneyText',
    'collectedRielText', 'monthlyReportRiel', 'buildStatCardItem', 'buildMonthlyReport',
    'openDailyStatsModal', 'openMonthlyStatsModal', 'collectedValueIsMeasurable',
    'dbListenerViewIsStale'];
const missing = [];
const bodies = WANT.map((n) => {
    const body = sliceFn(SRC, n);
    if (body) return body;
    missing.push(n);
    return 'function ' + n + '() { return undefined; }';
}).join('\n');

function makeEl() {
    return {
        innerHTML: '', className: '', children: [],
        appendChild(child) { this.children.push(child); return child; }
    };
}
function moneyAfter(html, label) {
    const at = html.indexOf(label);
    if (at === -1) return null;
    const m = /(—|\$-?[\d,]+\.\d{2})/.exec(html.slice(at, at + 400));
    return m ? m[1] : null;
}

// state.pending / state.failed ជាឈ្មោះ path របស់ listener ដែលមិនទាន់មក / ងាប់
function buildSandbox(state) {
    const containers = { dailyStatsContainer: makeEl(), monthlyStatsContainer: makeEl() };
    const sandbox = {
        console,
        scanHistory: state.scanHistory || [],
        deletedItems: state.deletedItems || [],
        dailyRevenueData: state.dailyRevenueData || {},
        dailyPickupData: state.dailyPickupData || {},
        monthlyRevenueData: state.monthlyRevenueData || {},
        exchangeRateRiel: 4100,
        PICKUP_DATE_KEY_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
        MONTHLY_REPORT_MONTH_PATTERN: /^\d{4}-\d{2}$/,
        MONTHLY_REPORT_UNKNOWN: '—',
        MONTHLY_REPORT_MONEY_TOLERANCE: 0.005,
        // ⛔ កូនសោត្រូវយកចេញពី app.js ពិត — កុំចាក់ literal
        DB_LISTENER_KEY_HISTORY: readKey('DB_LISTENER_KEY_HISTORY', 'history'),
        DB_LISTENER_KEY_DELETED: readKey('DB_LISTENER_KEY_DELETED', 'deleted'),
        DB_LISTENER_KEY_DAILY_REVENUE: readKey('DB_LISTENER_KEY_DAILY_REVENUE', 'dailyRevenue'),
        dbListenerPendingPaths: new Set(state.pending || []),
        dbListenerFailedPaths: new Set(state.failed || []),
        getFormattedDate: () => '2026-09-30',
        openModalHelper: () => {},
        document: {
            getElementById: (id) => containers[id] || null,
            createElement: () => makeEl()
        },
        __containers: containers
    };
    vm.createContext(sandbox);
    vm.runInContext(bodies, sandbox);
    return sandbox;
}

function readKey(name, fallback) {
    const m = new RegExp('const\\s+' + name + "\\s*=\\s*'([^']+)'").exec(SRC);
    return m ? m[1] : fallback;
}

const LBL_COLLECTED = 'ចំណូល (យករួច)';
const LBL_PENDING = 'មិនទាន់យក';

// ថ្ងៃ 2026-09-01 ៖ ledger ក្នុងឧបករណ៍ = $15 (ចាស់ · listener ងាប់តាំងពី ៩ ម៉ោង)
// ខណៈប្រវត្តិបន្តមកដល់ ➜ កញ្ចប់បើកសរុប $35 ▸ ការពិត ៖ យករួច $10
// ➜ ការបង្ហាញ ៖ max(0, 15 − 35) = **$0.00** (លេខកុហក) ជំនួស «—»
function staleLedgerState(pending, failed) {
    return {
        pending: pending, failed: failed,
        dailyRevenueData: { '2026-09-01': { codDollar: 15, dodDollar: 0, totalCount: 2 } },
        monthlyRevenueData: { '2026-09': { codDollar: 15, dodDollar: 0, totalCount: 2 } },
        dailyPickupData: { '2026-09-01': { packagesPickedUp: 1, pickedUpPhones: { '011': 1 } } },
        scanHistory: [{ id: 'a', scanDate: '2026-09-01', phone: '011', barcodes: [
            { code: 'A1', cod: 10, dod: 0, isClosed: true, isDeducted: false },
            { code: 'A2', cod: 5, dod: 0, isClosed: false, isDeducted: false },
            { code: 'A3', cod: 12, dod: 0, isClosed: false, isDeducted: false },
            { code: 'A4', cod: 18, dod: 0, isClosed: false, isDeducted: false }] }],
        deletedItems: []
    };
}

function cardsOf(sandbox, which) {
    return sandbox.__containers[which].children.map((c) => String(c.innerHTML || ''));
}

// ------------------------------------------------------------------
scenario('សំណុំ function ពិតត្រូវរកឃើញ (បើ stub ➜ ការវាស់ខាងក្រោមមិនមានន័យ)', () => {
    ok('⛔ ជាន់អប្បបរមា៖ រក function ស្ថិតិពិតបានយ៉ាងតិច 19',
        WANT.length - missing.length >= 19, 'បាត់៖ ' + missing.join(', '));
    ok('ច្រកទ្វារវាស់បាន និងអេក្រង់ទាំង ៣ មានក្នុង app.js ពិត',
        ['collectedValueIsMeasurable', 'dbListenerViewIsStale', 'openDailyStatsModal',
            'openMonthlyStatsModal', 'buildMonthlyReport'].every((n) => missing.indexOf(n) === -1),
        'បាត់៖ ' + missing.join(', '));
});

// ------------------------------------------------------------------
// លក្ខខណ្ឌចាំបាច់ ៖ ច្រកទ្វារពិតជាដើរលើខាង `open` (បើអត់ តេស្តខាងក្រោមទទេ)
scenario('លក្ខខណ្ឌចាំបាច់៖ ច្រកទ្វារបិទពិត ពេលខាង «open» មិនគ្រប់', () => {
    const s1 = buildSandbox(staleLedgerState(['history'], []));
    ok('history ព្យួរ ➜ វាស់មិនបាន', s1.collectedValueIsMeasurable() === false);
    const s2 = buildSandbox(staleLedgerState([], ['deleted']));
    ok('deleted ងាប់ ➜ វាស់មិនបាន', s2.collectedValueIsMeasurable() === false);
});

// ------------------------------------------------------------------
// ⛔ ទិសផ្ទុយ ៖ គ្រប់ listener រស់ ➜ ត្រូវបង្ហាញ **លេខពិត** មិនមែន «—»
// (បើអត់ ការកែ «return false ជានិច្ច» នឹងបៃតង)
scenario('⛔ ទិសផ្ទុយ៖ listener រស់ទាំងអស់ ➜ បង្ហាញលេខ មិនមែន «—»', () => {
    const s = buildSandbox(staleLedgerState([], []));
    ok('គ្រប់ listener រស់ ➜ វាស់បាន', s.collectedValueIsMeasurable() === true);
    s.openDailyStatsModal();
    const card = cardsOf(s, 'dailyStatsContainer').find((h) => h.indexOf('2026-09-01') !== -1) || '';
    const collected = moneyAfter(card, LBL_COLLECTED);
    ok('ស្ថិតិប្រចាំថ្ងៃបង្ហាញលេខពិត (មិនមែន «—») ពេលទិដ្ឋភាពគ្រប់',
        collected !== null && collected !== '—', 'អាន=' + collected);
    const report = s.buildMonthlyReport('2026-09');
    ok('របាយការណ៍ខែរាយថាវាស់បាន ពេលទិដ្ឋភាពគ្រប់',
        report.totals.collectedMeasurable === true);
});

// ------------------------------------------------------------------
// 🔴 ខាង `ledger` ៖ listener `dailyRevenue` **ព្យួរ** (មិនទាន់មកដល់)
scenario('🔴 listener ledger ព្យួរ ➜ លេខ «ចំណូល» ត្រូវជា «—»', () => {
    const s = buildSandbox(staleLedgerState(['dailyRevenue'], []));
    ok('⛔ ledger មិនទាន់មកដល់ ➜ «ចំណូល» វាស់មិនបាន',
        s.collectedValueIsMeasurable() === false,
        'collectedValueIsMeasurable()=' + s.collectedValueIsMeasurable());
    const report = s.buildMonthlyReport('2026-09');
    ok('⛔ របាយការណ៍ខែត្រូវរាយថា វាស់មិនបាន',
        report.totals.collectedMeasurable === false);
});

// ------------------------------------------------------------------
// 🔴 ខាង `ledger` ៖ listener `dailyRevenue` **ងាប់** ខណៈប្រវត្តិបន្តមកដល់
scenario('🔴 listener ledger ងាប់ ➜ អេក្រង់មិនត្រូវរាយ $0.00 ជាការពិត', () => {
    const s = buildSandbox(staleLedgerState([], ['dailyRevenue']));

    // ជាន់អប្បបរមា ៖ ស្ថានភាពនេះពិតជាផលិតលេខកុហក បើគ្មានច្រកទ្វារ
    const naive = s.collectedValueOf(15, 0, { cod: 35, dod: 0 });
    ok('⛔ ជាន់អប្បបរមា៖ ស្ថានភាពនេះពិតជាកេះ clamp ➜ $0.00 (បើអត់ តេស្តទទេ)',
        naive.total === 0, JSON.stringify(naive));

    ok('⛔ ledger ងាប់ ➜ «ចំណូល» វាស់មិនបាន',
        s.collectedValueIsMeasurable() === false,
        'collectedValueIsMeasurable()=' + s.collectedValueIsMeasurable());

    s.openDailyStatsModal();
    const dayCard = cardsOf(s, 'dailyStatsContainer').find((h) => h.indexOf('2026-09-01') !== -1) || '';
    ok('⛔ ស្ថិតិប្រចាំថ្ងៃ «' + LBL_COLLECTED + '» = «—»',
        moneyAfter(dayCard, LBL_COLLECTED) === '—', 'អាន=' + moneyAfter(dayCard, LBL_COLLECTED));
    ok('⛔ ស្ថិតិប្រចាំថ្ងៃ «' + LBL_PENDING + '» = «—»',
        moneyAfter(dayCard, LBL_PENDING) === '—', 'អាន=' + moneyAfter(dayCard, LBL_PENDING));

    s.openMonthlyStatsModal();
    const monCard = cardsOf(s, 'monthlyStatsContainer').find((h) => h.indexOf('2026-09') !== -1) || '';
    ok('⛔ ស្ថិតិ ៣ ខែ «' + LBL_COLLECTED + '» = «—»',
        moneyAfter(monCard, LBL_COLLECTED) === '—', 'អាន=' + moneyAfter(monCard, LBL_COLLECTED));
    ok('⛔ ស្ថិតិ ៣ ខែ «' + LBL_PENDING + '» = «—»',
        moneyAfter(monCard, LBL_PENDING) === '—', 'អាន=' + moneyAfter(monCard, LBL_PENDING));

    const report = s.buildMonthlyReport('2026-09');
    ok('⛔ របាយការណ៍ខែត្រូវរាយថា វាស់មិនបាន',
        report.totals.collectedMeasurable === false);
});

// ------------------------------------------------------------------
// ⛔ កូនសោត្រូវជាថេរចែករំលែក — មិនមែនខ្សែអក្សរឆៅក្នុងច្រកទ្វារ
scenario('⛔ កូនសោ listener ត្រូវរស់នៅជាថេរតែមួយ', () => {
    const gate = sliceFn(SRC, 'collectedValueIsMeasurable') || '';
    ok('`collectedValueIsMeasurable()` មិនចាក់ខ្សែអក្សរ path ឆៅ',
        !/'(history|deleted|dailyRevenue)'/.test(gate) && !/"(history|deleted|dailyRevenue)"/.test(gate),
        gate.replace(/\s+/g, ' '));
    ok('ថេរកូនសោ ledger ប្រកាសក្នុង app.js ពិត',
        /const\s+DB_LISTENER_KEY_DAILY_REVENUE\s*=/.test(SRC));
    const keysDecl = /const\s+DB_LISTENER_KEYS\s*=\s*\[([^\]]*)\]/.exec(SRC);
    ok('កូនសោ ledger ស្ថិតក្នុង DB_LISTENER_KEYS ពិត',
        !!keysDecl && keysDecl[1].indexOf(readKey('DB_LISTENER_KEY_DAILY_REVENUE', 'dailyRevenue')) !== -1,
        keysDecl && keysDecl[1]);
});

console.log('');
if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')'); process.exit(1); }
console.log('✅ ok ' + pass);
