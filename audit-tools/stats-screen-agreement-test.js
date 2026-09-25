// ⛔ ថ្នាក់កំហុស ៖ អេក្រង់ស្ថិតិ ៣ បង្ហាញ «ចំណូល (យករួច)» ខុសគ្នា លើទិន្នន័យតែមួយ។
//
// ច្បាប់ក្នុង CLAUDE.md ៖ «អេក្រង់ស្ថិតិទាំង ៣ ប្រើ helper ដដែល» និង
// «របាយការណ៍ខែ ⛔ ដេរីវេពី **ថ្ងៃ** · មូលដ្ឋានដូចអេក្រង់ដើម»។
//
// ⛔ ការប្រើ helper ដដែល **មិនគ្រប់គ្រាន់** — សំខាន់គឺ *កម្រិតបូក* ៖
//   ថ្ងៃ  ៖ Σ_d max(0, cod_d − open_d)      ← clamp ក្នុងមួយថ្ងៃ
//   ខែ    ៖ max(0, Σcod_d − Σopen_d)        ← clamp តែម្តងនៅកម្រិតខែ
// លេខ ២ នេះ **មិនស្មើគ្នា** ពេលថ្ងៃណាមួយមាន open_d > cod_d ៖ ថ្ងៃនោះ
// «ស៊ី» ចំណូលពិតរបស់ថ្ងៃដទៃ ➜ ស្ថិតិ ៣ ខែ បង្ហាញលេខ **ទាបជាងការពិត**
// ខណៈរបាយការណ៍ខែបង្ហាញលេខត្រឹមត្រូវ។
//
// ព្រំដែន open_d > cod_d កើតឡើងពិត ៖ ការ reconcile ledger មិន commit
// (toast «បានរក្សាទុក ប៉ុន្តែស្ថិតិប្រាក់មិនទាន់ Sync») · «កែទឹកប្រាក់» ដោយដៃ ·
// ថ្ងៃដែលមានកញ្ចប់បើក តែគ្មានជួរក្នុង `zoew_daily_revenue_cod_dod` សោះ។
//
// ⛔ តេស្តនេះរត់ **កូដពិត** របស់អេក្រង់ (`openDailyStatsModal` ·
// `buildMonthlyReport`) ក្នុង `vm` ជាមួយ DOM ក្លែង រួច **អាន HTML ដែល
// អ្នកប្រើមើលឃើញ** — មិនមែនអះអាងលើឈ្មោះ function ទេ។
//
// ⛔ **កំណែ 2.34.0 ដកអេក្រង់ «ស្ថិតិ ៣ ខែ» ចេញ** (សំណើអ្នកប្រើ) ➜ អ្នកយាម
// នេះប្តូរឧបករណ៍វាស់ ៖ ជំនួសឲ្យ «កាតខែ ធៀប របាយការណ៍ខែ» វាឥឡូវប្រៀប
// **ផលបូកកាតថ្ងៃពិត** ធៀបនឹង **សរុបរបស់របាយការណ៍ខែ** — ជាការវាស់ដដែល
// នៃ *កម្រិតបូក* តែលើផ្ទៃដែល **នៅ ship ពិត**។ ⛔ ការលុបអ្នកយាមចោល
// ជំនួសនឹងបានបើកថ្នាក់កំហុសនោះឡើងវិញ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { reactRuntime, renderedContainer } = require('./react-view');

const ROOT = process.env.STATSAGREE_APP_DIR || path.join(__dirname, '..');
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
    'uncollectedValueByDate', 'collectedValueOf',
    'collectedMoneyText', 'collectedRielText', 'monthlyReportRiel', 'buildStatCardItem',
    'buildMonthlyReport', 'openDailyStatsModal',
    'dbListenerViewIsStale', 'anyDbListenerViewIsStale', 'emptyViewMessage'];
function readAppConst(name) {
    const m = new RegExp('const\\s+' + name + "\\s*=\\s*'([^']*)'").exec(SRC);
    return m ? m[1] : '\u0001none\u0001';
}
const missing = [];
const bodies = WANT.map((n) => {
    const body = sliceFn(SRC, n);
    if (body) return body;
    missing.push(n);
    return 'function ' + n + '() { return undefined; }';
}).join('\n');

function cardTexts(container) {
    return container.children.map((c) => String(c.innerHTML || ''));
}
function moneyAfter(html, label) {
    const at = html.indexOf(label);
    if (at === -1) return null;
    const m = /(—|\$-?[\d,]+\.\d{2})/.exec(html.slice(at, at + 400));
    return m ? m[1] : null;
}

function buildSandbox(state) {
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
        VIEW_NOT_MEASURABLE_TEXT: readAppConst('VIEW_NOT_MEASURABLE_TEXT'),
        VIEW_NOT_MEASURABLE_NOTICE: '\u23f3 ' + readAppConst('VIEW_NOT_MEASURABLE_TEXT'),
        DB_LISTENER_KEY_HISTORY: readAppConst('DB_LISTENER_KEY_HISTORY'),
        DB_LISTENER_KEY_DELETED: readAppConst('DB_LISTENER_KEY_DELETED'),
        DB_LISTENER_KEY_DAILY_REVENUE: readAppConst('DB_LISTENER_KEY_DAILY_REVENUE'),
        DB_LISTENER_KEY_MONTHLY_REVENUE: readAppConst('DB_LISTENER_KEY_MONTHLY_REVENUE'),
        STATS_DAILY_VIEW_KEYS: [readAppConst('DB_LISTENER_KEY_DAILY_REVENUE'), readAppConst('DB_LISTENER_KEY_HISTORY'), readAppConst('DB_LISTENER_KEY_DELETED')],
        dbListenerPendingPaths: new Set(state.pending || []),
        dbListenerFailedPaths: new Set(state.failed || []),
        MONTHLY_REPORT_MONEY_TOLERANCE: 0.005,
        collectedValueIsMeasurable: () => state.measurable !== false,
        getFormattedDate: () => '2026-09-30',
        openModalHelper: () => {},
        document: { getElementById: () => null },
        queueMicrotask
    };
    vm.createContext(sandbox);
    // ⛔ ZoeW ជា React ៖ អេក្រង់សរសេរ view model ក្នុង `uiState` ➜ ឃ្លាំងពិតចូល sandbox មុនមុខងារ ហើយ «ធាតុផ្ទុក»
    //    គូរ **JSX ពិត** (`StatsCards.tsx`) ពីស្ថានភាពរបស់ sandbox រាល់ការអាន
    vm.runInContext(reactRuntime(SRC, { exclude: WANT, context: sandbox }), sandbox);
    vm.runInContext(bodies, sandbox);
    sandbox.__containers = {
        dailyStatsContainer: renderedContainer(ROOT, sandbox, 'src/app/components/stats/StatsCards.tsx', 'DailyStatsCards'),
        collectedStatsContainer: renderedContainer(ROOT, sandbox, 'src/app/components/stats/StatsCards.tsx', 'CollectedStatsCards')
    };
    return sandbox;
}

const LBL_COLLECTED = 'ចំណូល (យករួច)';
const LBL_ALL = 'តម្លៃកញ្ចប់ទាំងអស់';
const LBL_PENDING = 'មិនទាន់យក';

function money(n) { return '$' + (Math.round(n * 100) / 100).toFixed(2); }
function moneyValue(text) {
    const m = /^\$(-?\d+(?:\.\d+)?)$/.exec(String(text || '').trim());
    return m ? parseFloat(m[1]) : NaN;
}
// ⛔ ផ្ទៃទី ២ ដែលនៅសល់ជា **កាតថ្ងៃ** ➜ ការបូកពួកវាដោយអ្នកយាម ជាអ្វីដែល
// អ្នកប្រើធ្វើដោយភ្នែក ➜ វាត្រូវស្មើសរុបរបស់របាយការណ៍ខែ **បេះបិទ**។
function dayScreenMonthTotals(s, ym) {
    s.openDailyStatsModal();
    const cards = cardTexts(s.__containers.dailyStatsContainer).filter((h) => h.indexOf(ym) !== -1);
    let collected = 0;
    let pending = 0;
    let cod = 0;
    let dod = 0;
    let measurable = true;
    cards.forEach((html) => {
        const c = moneyValue(moneyAfter(html, LBL_COLLECTED));
        const p = moneyValue(moneyAfter(html, LBL_PENDING));
        const cc = moneyValue(moneyAfter(html, 'COD:'));
        const dd = moneyValue(moneyAfter(html, 'DOD:'));
        if (!isFinite(c) || !isFinite(p)) { measurable = false; return; }
        collected += c;
        pending += p;
        if (isFinite(cc)) cod += cc;
        if (isFinite(dd)) dod += dd;
    });
    return {
        cards: cards,
        collected: measurable ? money(collected) : '—',
        pending: measurable ? money(pending) : '—',
        cod: measurable ? money(cod) : '—',
        dod: measurable ? money(dod) : '—'
    };
}

// ------------------------------------------------------------------
scenario('សំណុំ function ពិតត្រូវរកឃើញ (បើ stub ➜ ការវាស់ខាងក្រោមមិនមានន័យ)', () => {
    ok('⛔ ជាន់អប្បបរមា៖ រក function ស្ថិតិពិតបានយ៉ាងតិច 18',
        WANT.length - missing.length >= 18, 'បាត់៖ ' + missing.join(', '));
    ok('អេក្រង់ទាំង ២ ដែលនៅសល់ មានក្នុង app.js ពិត',
        missing.indexOf('openDailyStatsModal') === -1
        && missing.indexOf('buildMonthlyReport') === -1, 'បាត់៖ ' + missing.join(', '));
    ok('⛔ ទិសផ្ទុយ ៖ អេក្រង់ «ស្ថិតិ ៣ ខែ» ត្រូវបានដកចេញពិត (គ្មានផ្ទៃទី ៣ ទៀតទេ)',
        SRC.indexOf('openMonthlyStatsModal') === -1 && SRC.indexOf('collectedValueForMonth') === -1,
        'នៅសល់ក្នុង app.js');
});

// ------------------------------------------------------------------
// ស្ថានភាព A ៖ ថ្ងៃមួយមាន open > ledger (ledger តូចជាងតម្លៃកញ្ចប់បើក)
//   2026-09-01 ៖ ledger $5 · កញ្ចប់បើក $10
//   2026-09-02 ៖ ledger $20 · គ្មានកញ្ចប់បើក
// ➜ ថ្ងៃ ៖ 0 + 20 = $20.00 ; ខែ (បូកមុន clamp) ៖ max(0, 25 − 10) = $15.00
const stateA = {
    dailyRevenueData: {
        '2026-09-01': { codDollar: 5, dodDollar: 0, totalCount: 2 },
        '2026-09-02': { codDollar: 20, dodDollar: 0, totalCount: 1 }
    },
    monthlyRevenueData: { '2026-09': { codDollar: 25, dodDollar: 0, totalCount: 3 } },
    dailyPickupData: {},
    scanHistory: [{ id: 'a', scanDate: '2026-09-01', phone: '011', barcodes: [
        { code: 'A1', cod: 10, dod: 0, isClosed: false, isDeducted: false }] }],
    deletedItems: []
};

scenario('ថ្ងៃណាមួយមាន «មិនទាន់យក» ធំជាង ledger របស់ថ្ងៃនោះ', () => {
    const s = buildSandbox(stateA);
    const report = s.buildMonthlyReport('2026-09');
    const dayTotals = dayScreenMonthTotals(s, '2026-09');
    ok('ស្ថិតិប្រចាំថ្ងៃ គូរកាតគ្រប់ថ្ងៃរបស់ខែ 2026-09', dayTotals.cards.length === 2,
        'cards=' + dayTotals.cards.length);

    const reportCollected = money(report.totals.collectedTotal);
    ok('⛔ ផលបូកកាតថ្ងៃ «' + LBL_COLLECTED + '» ត្រូវស្មើរបាយការណ៍ខែ',
        dayTotals.collected === reportCollected,
        'ថ្ងៃ=' + dayTotals.collected + ' · របាយការណ៍=' + reportCollected);

    const reportPending = money(report.totals.pendingTotal);
    ok('⛔ ផលបូកកាតថ្ងៃ «' + LBL_PENDING + '» ត្រូវស្មើរបាយការណ៍ខែ',
        dayTotals.pending === reportPending,
        'ថ្ងៃ=' + dayTotals.pending + ' · របាយការណ៍=' + reportPending);

    ok('⛔ ជាន់អប្បបរមា៖ ស្ថានភាពនេះពិតជាកេះ clamp ក្នុងមួយថ្ងៃ (បើអត់ តេស្តទទេ)',
        report.days.length === 2 && report.days[0].collectedTotal === 0
        && report.days[1].collectedTotal === 20,
        JSON.stringify(report.days.map(d => [d.date, d.collectedTotal])));

    const naiveOpen = (() => {
        const map = s.uncollectedValueByDate();
        const out = { cod: 0, dod: 0 };
        Object.keys(map).forEach((d) => { if (d.slice(0, 7) === '2026-09') { out.cod += map[d].cod; out.dod += map[d].dod; } });
        return out;
    })();
    const naive = money(s.collectedValueOf(25, 0, naiveOpen).total);
    ok('⛔ ទិសផ្ទុយ៖ ការបូកមុន clamp ពិតជាឲ្យលេខផ្សេង (បើដូចគ្នា ➜ ស្ថានភាពមិនបែងចែក)',
        naive !== reportCollected, 'ការបូកមុន clamp = ' + naive);

    const dayCards = (() => { s.openDailyStatsModal(); return cardTexts(s.__containers.dailyStatsContainer); })();
    const daySep1 = dayCards.find((h) => h.indexOf('2026-09-01') !== -1) || '';
    ok('ស្ថិតិប្រចាំថ្ងៃ 2026-09-01 ស្មើជួរដេករបស់របាយការណ៍ខែ',
        moneyAfter(daySep1, LBL_COLLECTED) === money(report.days[0].collectedTotal),
        'ថ្ងៃ=' + moneyAfter(daySep1, LBL_COLLECTED) + ' · របាយការណ៍=' + money(report.days[0].collectedTotal));
});

// ------------------------------------------------------------------
// ស្ថានភាព B ៖ ថ្ងៃមានកញ្ចប់បើក តែ **គ្មានជួរ ledger សោះ**
//   របាយការណ៍ខែ មិនរាប់ថ្ងៃនោះ (វាដេរីវេពី ledger/pickup) ➜ កាតក៏មិនត្រូវរាប់ដែរ
const stateB = {
    dailyRevenueData: { '2026-08-10': { codDollar: 30, dodDollar: 0, totalCount: 2 } },
    monthlyRevenueData: { '2026-08': { codDollar: 30, dodDollar: 0, totalCount: 2 } },
    dailyPickupData: {},
    scanHistory: [{ id: 'b', scanDate: '2026-08-11', phone: '012', barcodes: [
        { code: 'B1', cod: 12, dod: 0, isClosed: false, isDeducted: false }] }],
    deletedItems: []
};

scenario('ថ្ងៃដែលមានកញ្ចប់បើក តែគ្មានជួរក្នុង ledger ថ្ងៃ', () => {
    const s = buildSandbox(stateB);
    const report = s.buildMonthlyReport('2026-08');
    const dayTotalsB = dayScreenMonthTotals(s, '2026-08');
    ok('⛔ ជាន់អប្បបរមា៖ របាយការណ៍ខែពិតជាមិនរាប់ថ្ងៃ 2026-08-11',
        report.days.length === 1 && report.days[0].date === '2026-08-10',
        JSON.stringify(report.days.map(d => d.date)));
    ok('⛔ ផលបូកកាតថ្ងៃ «' + LBL_COLLECTED + '» ត្រូវស្មើរបាយការណ៍ខែ (ថ្ងៃគ្មាន ledger)',
        dayTotalsB.collected === money(report.totals.collectedTotal),
        'ថ្ងៃ=' + dayTotalsB.collected + ' · របាយការណ៍=' + money(report.totals.collectedTotal));
});

// ------------------------------------------------------------------
// ស្ថានភាព C ៖ ធម្មតា (គ្មានថ្ងៃណា clamp) ➜ អេក្រង់ទាំង ៣ ត្រូវនៅតែស្មើគ្នា
const stateC = {
    dailyRevenueData: {
        '2026-07-01': { codDollar: 12.5, dodDollar: 3.25, totalCount: 3 },
        '2026-07-02': { codDollar: 8, dodDollar: 0, totalCount: 2 }
    },
    monthlyRevenueData: { '2026-07': { codDollar: 20.5, dodDollar: 3.25, totalCount: 5 } },
    dailyPickupData: { '2026-07-01': { packagesPickedUp: 2, pickedUpPhones: { '011': 2 } } },
    scanHistory: [{ id: 'c', scanDate: '2026-07-01', phone: '011', barcodes: [
        { code: 'C1', cod: 4.5, dod: 1.25, isClosed: false, isDeducted: false }] }],
    deletedItems: [{ id: 'd', scanDate: '2026-07-02', phone: '012', trashReason: 'delete',
        isFromDeletion: true, barcodes: [{ code: 'D1', cod: 3, dod: 0, isClosed: false, isDeducted: false }] }]
};

scenario('ដំណើរការធម្មតា — អេក្រង់ទាំង ២ ត្រូវនៅតែស្មើគ្នា (ទិសផ្ទុយ)', () => {
    const s = buildSandbox(stateC);
    const report = s.buildMonthlyReport('2026-07');
    const dayTotalsC = dayScreenMonthTotals(s, '2026-07');
    ok('⛔ ជាន់អប្បបរមា៖ ស្ថានភាពនេះមានចំណូលពិត (មិនមែន 0)',
        report.totals.collectedTotal > 0, report.totals.collectedTotal);
    ok('ផលបូកកាតថ្ងៃ ស្មើរបាយការណ៍ខែ (ធម្មតា)',
        dayTotalsC.collected === money(report.totals.collectedTotal),
        'ថ្ងៃ=' + dayTotalsC.collected + ' · របាយការណ៍=' + money(report.totals.collectedTotal));
    const dayCards = dayTotalsC.cards;
    ok('ស្ថិតិប្រចាំថ្ងៃមានកាតគ្រប់ថ្ងៃ', dayCards.length === 2, dayCards.length);
    report.days.forEach((d) => {
        const html = dayCards.find((h) => h.indexOf(d.date) !== -1) || '';
        ok('ថ្ងៃ ' + d.date + ' ស្មើជួរដេករបស់របាយការណ៍ខែ',
            moneyAfter(html, LBL_COLLECTED) === money(d.collectedTotal),
            'ថ្ងៃ=' + moneyAfter(html, LBL_COLLECTED) + ' · របាយការណ៍=' + money(d.collectedTotal));
    });
});

// ------------------------------------------------------------------
// ស្ថានភាព D ៖ COD/DOD ត្រូវ clamp **ក្នុងមួយរូបិយវត្ថុ** ក្នុងមួយថ្ងៃដែរ
const stateD = {
    dailyRevenueData: {
        '2026-06-01': { codDollar: 2, dodDollar: 40, totalCount: 3 },
        '2026-06-02': { codDollar: 40, dodDollar: 2, totalCount: 3 }
    },
    monthlyRevenueData: { '2026-06': { codDollar: 42, dodDollar: 42, totalCount: 6 } },
    dailyPickupData: {},
    scanHistory: [
        { id: 'e', scanDate: '2026-06-01', phone: '011', barcodes: [
            { code: 'E1', cod: 9, dod: 0, isClosed: false, isDeducted: false }] },
        { id: 'f', scanDate: '2026-06-02', phone: '012', barcodes: [
            { code: 'F1', cod: 0, dod: 9, isClosed: false, isDeducted: false }] }
    ],
    deletedItems: []
};

scenario('clamp ក្នុងមួយរូបិយវត្ថុ ក្នុងមួយថ្ងៃ (COD មិនត្រូវត្រូវ DOD ស៊ី)', () => {
    const s = buildSandbox(stateD);
    const report = s.buildMonthlyReport('2026-06');
    const dayTotalsD = dayScreenMonthTotals(s, '2026-06');
    ok('⛔ ជាន់អប្បបរមា៖ ថ្ងៃទាំង ២ ពិតជា clamp ម្ខាងៗ',
        report.days.length === 2 && report.days[0].collectedCod === 0 && report.days[1].collectedDod === 0,
        JSON.stringify(report.days.map(d => [d.date, d.collectedCod, d.collectedDod])));
    ok('⛔ ផលបូកកាតថ្ងៃ «' + LBL_COLLECTED + '» ត្រូវស្មើរបាយការណ៍ខែ (clamp ២ រូបិយវត្ថុ)',
        dayTotalsD.collected === money(report.totals.collectedTotal),
        'ថ្ងៃ=' + dayTotalsD.collected + ' · របាយការណ៍=' + money(report.totals.collectedTotal));
    ok('COD (យករួច) ៖ ផលបូកកាតថ្ងៃ ស្មើរបាយការណ៍ខែ',
        dayTotalsD.cod === money(report.totals.collectedCod),
        'ថ្ងៃ=' + dayTotalsD.cod + ' · របាយការណ៍=' + money(report.totals.collectedCod));
});

// ------------------------------------------------------------------
// ស្ថានភាព E ៖ **សេន** — ចំណូលរបស់ខែមិនមែនលេខគត់
// ⛔ បើគ្មានស្ថានភាពនេះ mutation «បង្គត់ត្រឹមដុល្លារ» នឹង **រស់រាន**
// (វាស់បាន 2026-09-09 ៖ M6 រស់រានលើសំណុំដំបូង ព្រោះថ្ងៃទាំងអស់បូកជាលេខគត់)។
const stateE = {
    dailyRevenueData: {
        '2026-04-01': { codDollar: 10.10, dodDollar: 0, totalCount: 2 },
        '2026-04-02': { codDollar: 5.33, dodDollar: 1.11, totalCount: 2 },
        '2026-04-03': { codDollar: 0, dodDollar: 4.44, totalCount: 1 }
    },
    monthlyRevenueData: { '2026-04': { codDollar: 15.43, dodDollar: 5.55, totalCount: 5 } },
    dailyPickupData: {},
    scanHistory: [
        { id: 'g', scanDate: '2026-04-01', phone: '011', barcodes: [
            { code: 'G1', cod: 2.05, dod: 0, isClosed: false, isDeducted: false }] },
        { id: 'h', scanDate: '2026-04-02', phone: '012', barcodes: [
            { code: 'H1', cod: 0, dod: 0.07, isClosed: false, isDeducted: false }] }
    ],
    deletedItems: []
};

scenario('សេន ៖ លេខមិនត្រូវបង្គត់ត្រឹមដុល្លារ', () => {
    const s = buildSandbox(stateE);
    const report = s.buildMonthlyReport('2026-04');
    const dayTotalsE = dayScreenMonthTotals(s, '2026-04');
    ok('⛔ ជាន់អប្បបរមា៖ ចំណូលរបស់ខែពិតជាមានសេន (មិនមែនលេខគត់)',
        Math.abs(report.totals.collectedTotal - Math.round(report.totals.collectedTotal)) > 0.004,
        report.totals.collectedTotal);
    ok('⛔ ជាន់អប្បបរមា៖ COD និង DOD ក៏មានសេនដែរ',
        Math.abs(report.totals.collectedCod - Math.round(report.totals.collectedCod)) > 0.004
        && Math.abs(report.totals.collectedDod - Math.round(report.totals.collectedDod)) > 0.004,
        report.totals.collectedCod + ' / ' + report.totals.collectedDod);
    ok('⛔ ផលបូកកាតថ្ងៃ «' + LBL_COLLECTED + '» ត្រូវស្មើរបាយការណ៍ខែ ដល់សេន',
        dayTotalsE.collected === money(report.totals.collectedTotal),
        'ថ្ងៃ=' + dayTotalsE.collected + ' · របាយការណ៍=' + money(report.totals.collectedTotal));
    ok('COD និង DOD (យករួច) ៖ ផលបូកកាតថ្ងៃ ស្មើរបាយការណ៍ខែ ដល់សេន',
        dayTotalsE.cod === money(report.totals.collectedCod)
        && dayTotalsE.dod === money(report.totals.collectedDod),
        'ថ្ងៃ=' + dayTotalsE.cod + ' / ' + dayTotalsE.dod
        + ' · របាយការណ៍=' + money(report.totals.collectedCod) + ' / ' + money(report.totals.collectedDod));
    ok('⛔ «' + LBL_PENDING + '» ក៏ត្រូវស្មើដល់សេនដែរ',
        dayTotalsE.pending === money(report.totals.pendingTotal),
        'ថ្ងៃ=' + dayTotalsE.pending + ' · របាយការណ៍=' + money(report.totals.pendingTotal));
});

// ------------------------------------------------------------------
scenario('ទិដ្ឋភាពមិនគ្រប់ ➜ អេក្រង់ដែលនៅសល់ត្រូវរាយ «—» ដូចគ្នា', () => {
    const s = buildSandbox({ ...stateA, measurable: false });
    s.openDailyStatsModal();
    const dayCard = (cardTexts(s.__containers.dailyStatsContainer)[0]) || '';
    const report = s.buildMonthlyReport('2026-09');
    ok('ស្ថិតិប្រចាំថ្ងៃ រាយ «—» ពេលវាស់មិនបាន', moneyAfter(dayCard, LBL_COLLECTED) === '—', moneyAfter(dayCard, LBL_COLLECTED));
    ok('របាយការណ៍ខែ ក៏សម្គាល់ថាវាស់មិនបានដែរ',
        report.totals.collectedMeasurable === false, report.totals.collectedMeasurable);
    ok('«' + LBL_ALL + '» នៅតែបង្ហាញលេខ (ledger វាស់បានជានិច្ច)',
        dayCard.indexOf(LBL_ALL + '៖ $') !== -1, dayCard.slice(0, 300));
});

console.log('');
if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')'); process.exit(1); }
console.log('✅ គ្មានបញ្ហា — ok ' + pass);
