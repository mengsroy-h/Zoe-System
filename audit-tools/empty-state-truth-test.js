// ⛔ ថ្នាក់កំហុស ៖ អេក្រង់អះអាងថា «គ្មានទិន្នន័យ» ខណៈការពិតគឺ «ទិន្នន័យមិនទាន់មកដល់»។
//
// នេះជាច្បាប់ដដែលនឹងកំណែ 2.31.7 (អេក្រង់ស្ថិតិរាយ $0.00 ជា «ចំណូល» ខណៈវាស់
// មិនបាន) និងនឹងជួរ ZTO ក្នុង 🩺 ពិនិត្យសុខភាព ៖
//     «ការរាយអ្វីមួយលើអ្វីដែល *មិនបានវាស់* អាក្រក់ជាងការរាយ ❌ ក្លែងក្លាយ
//      ព្រោះវាបញ្ជូនអ្នកប្រើទៅរកមូលហេតុខុស។»
//
// 🔴 វាស់បាន (2026-09-09, tree ដែល checker ១៦០ បៃតងទាំងអស់ · SKIP 0) ៖ ពេល
// listener `dailyRevenue` **មិនទាន់មកដល់** ឬ **ងាប់** ៖
//     dailyRevenueData = {}  ➜  📊 ស្ថិតិប្រចាំថ្ងៃ រាយ «គ្មានទិន្នន័យប្រចាំថ្ងៃទេ»
// ដែលជាអត្ថបទ **ដូចគ្នាបេះបិទ** នឹងករណីដែលអាជីវកម្មពិតជាគ្មានប្រតិបត្តិការ។
// ម្ចាស់ហាងដែលបើក 📊 ខណៈ listener ងាប់ អាន «គ្មានទិន្នន័យ» ➜ សន្និដ្ឋានថា
// **កំណត់ត្រាលុយបាត់**។ ដូចគ្នាសម្រាប់ ៖ ស្ថិតិ ៣ ខែ · របាយការណ៍ខែ ·
// ធុងសំរាម (អ្នកប្រើសម្រេចថាត្រូវស្តារឬអត់) · តារាងប្រវត្តិ (អេក្រង់មេ)។
//
// ⛔ តេស្តនេះរត់ **កូដពិត** របស់អេក្រង់ក្នុង `vm` ជាមួយ DOM ក្លែង រួច **អាន
// អត្ថបទដែលអ្នកប្រើមើលឃើញ** — មិនមែនអះអាងលើឈ្មោះ function ទេ។
// ⛔ ទិសផ្ទុយត្រូវរក្សា ៖ listener រស់ទាំងអស់ + ទិន្នន័យទទេពិត ➜ ត្រូវរាយ
// «គ្មានទិន្នន័យ» ដដែល (បើអត់ ការកែ «និយាយ រង់ចាំ ជានិច្ច» នឹងបៃតង)។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.EMPTYSTATE_APP_DIR || path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('  ok    ' + label); pass++; }
    else { console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + String(detail).slice(0, 400) : '')); fail++; }
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
function readConst(name, fallback) {
    const m = new RegExp('const\\s+' + name + "\\s*=\\s*'([^']*)'").exec(SRC);
    return m ? m[1] : fallback;
}
function readNumConst(name, fallback) {
    const m = new RegExp('const\\s+' + name + '\\s*=\\s*(\\d+)').exec(SRC);
    return m ? parseInt(m[1], 10) : fallback;
}

// ⛔ រកឈ្មោះមិនឃើញ ➜ **stub** មិនមែន exit (បើអត់ ការអះអាងខាងក្រោមត្រូវបិទបាំង)។
const WANT = ['sanitizeInput', 'ledgerNumber', 'statsMonthOf', 'statsPositive', 'statsMoney',
    'statsCount', 'countPickedUpCustomers', 'uncollectedBarcodeValue', 'uncollectedItemValue',
    'uncollectedValueByDate', 'collectedValueOf', 'collectedValueForMonth', 'collectedMoneyText',
    'collectedRielText', 'monthlyReportRiel', 'buildStatCardItem', 'buildMonthlyReport',
    'openDailyStatsModal', 'openMonthlyStatsModal', 'renderMonthlyReport',
    'monthlyReportMismatchNote', 'renderHistory', 'renderRecentlyDeleted',
    'buildTrashGroups', 'trashGroupMatchesQuery', 'renderTrashSummary', 'trashGroupRowHtml',
    'trashSummaryCardHtml', 'trashReasonOf', 'trashItemTotals', 'parseTimestampFromId',
    'trashGroupKeyOf', 'trashGroupSignature', 'trashItemCodes', 'trashItemPhone',
    'barcodeEntriesOf', 'formatScanStamp', 'buildHistoryRowContent', 'escapeAttr',
    'buildHistoryRowHtml',
    'collectedValueIsMeasurable', 'dbListenerViewIsStale',
    'anyDbListenerViewIsStale', 'emptyViewMessage',
    // ⛔ អេក្រង់ទី ៦ និងទី ៧ ៖ របា និងប្រអប់ «ZTO មិនទាន់បិទ» — ពួកវាកើតក្រោយ
    // ច្បាប់នេះ ហើយជុំមុន **stub ពួកវាចោល** ➜ ស្នាមភ្ជាប់គ្មានតេស្តសោះ។
    'barcodeRegistryKey', 'pickupBarcodeKey', 'loadZtoPickupStatusOnce',
    'ztoStatusTrashItemCounts', 'collectClosedBarcodesForZtoStatus',
    'ztoStatusPendingList', 'ztoStatusPendingCodes', 'ztoStatusUnmeasuredCount',
    'ztoStatusFeatureConfig', 'ztoSyncModalIsOpen',
    'renderZtoSyncBanner', 'renderZtoSyncModalList'];
const missing = [];
const bodies = WANT.map((n) => {
    const body = sliceFn(SRC, n);
    if (body) return body;
    missing.push(n);
    return 'function ' + n + '() { return undefined; }';
}).join('\n');

const NOT_MEASURABLE = readConst('VIEW_NOT_MEASURABLE_TEXT', '\u0001NO-SUCH-CONST\u0001');

// ⛔ ថេរដែលអេក្រង់អាន ត្រូវយកចេញពី app.js ពិត — កុំចាក់ literal ក្នុង checker
function sliceConstObject(name) {
    const at = SRC.indexOf('const ' + name + ' = {');
    if (at === -1) return 'const ' + name + ' = {};';
    let depth = 0, started = false, i = SRC.indexOf('{', at);
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') { depth++; started = true; }
        else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return SRC.slice(at, i) + ';';
}
const CONSTS = ['TRASH_REASON_META'].map(sliceConstObject).join('\n');

function makeEl() {
    return {
        innerHTML: '', innerText: '', className: '', value: '', dataset: {}, style: {},
        children: [],
        appendChild(child) { this.children.push(child); return child; },
        insertBefore(child, before) {
            const at = this.children.indexOf(before);
            if (at === -1) this.children.push(child); else this.children.splice(at, 0, child);
            return child;
        },
        removeChild(child) {
            const at = this.children.indexOf(child);
            if (at !== -1) this.children.splice(at, 1);
            return child;
        },
        setAttribute() {}, getAttribute() { return null; }, querySelector() { return null; },
        querySelectorAll() { return []; },
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
    };
}
function textOf(html) {
    return String(html === undefined || html === null ? '' : html)
        .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildSandbox(state) {
    const containers = {
        dailyStatsContainer: makeEl(), monthlyStatsContainer: makeEl(),
        monthlyReportBody: makeEl(), monthlyReportMonthSel: makeEl(),
        historyTableBody: makeEl(), count: makeEl(),
        deletedTableBody: makeEl(), trashSummaryBox: makeEl(),
        ztoSyncBanner: makeEl(), ztoSyncList: makeEl(), ztoSyncModalNote: makeEl()
    };
    const sandbox = {
        console, Set, Map, Array, Object, Math, JSON, String, Number,
        isNaN, parseFloat, parseInt, isFinite, Date,
        scanHistory: state.scanHistory || [],
        deletedItems: state.deletedItems || [],
        dailyRevenueData: state.dailyRevenueData || {},
        dailyPickupData: state.dailyPickupData || {},
        monthlyRevenueData: state.monthlyRevenueData || {},
        exchangeRateRiel: 4100,
        renderZtoSyncViews() {}, scheduleZtoStatusSweep() {},
        // ⛔ ម៉ូឌុល ZTO ៖ តម្លៃត្រូវអានចេញពី app.js ពិត — កុំចាក់ literal
        RegExp: RegExp,
        ztoPickupStatus: new Map(state.verdicts || []),
        ztoStatusLoaded: true,
        ztoStatusBannerSig: '', ztoStatusModalSig: '',
        ZTO_STATUS_BANNER_CODES: readNumConst('ZTO_STATUS_BANNER_CODES', 3),
        ZTO_STATUS_TTL_MS: 12 * 60 * 60 * 1000,
        ZTO_STATUS_STORE_KEY: readConst('ZTO_STATUS_STORE_KEY', 'zoew_zto_pickup_status_v1'),
        appLocalStore: null,
        elapsedSince: (m) => { if (!m) return Infinity; const d = Date.now() - m; return d >= 0 ? d : Infinity; },
        getLookupApiConfig: () => ({ enabled: true, url: 'https://x/.netlify/functions/zto-order-detail?code={barcode}' }),
        lookupApiIsZto: () => true,
        deletedSearchQuery: state.query || '',
        expandedTrashGroups: new Set(),
        DELETED_LIST_MAX_ROWS: 200,
        PICKUP_DATE_KEY_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
        MONTHLY_REPORT_MONTH_PATTERN: /^\d{4}-\d{2}$/,
        MONTHLY_REPORT_UNKNOWN: '—',
        MONTHLY_REPORT_MONEY_TOLERANCE: 0.005,
        MONTHLY_REPORT_HEADERS: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
        // ⛔ កូនសោ និងអត្ថបទត្រូវអានចេញពី app.js ពិត — កុំចាក់ literal
        DB_LISTENER_KEY_HISTORY: readConst('DB_LISTENER_KEY_HISTORY', 'history'),
        DB_LISTENER_KEY_DELETED: readConst('DB_LISTENER_KEY_DELETED', 'deleted'),
        DB_LISTENER_KEY_DAILY_REVENUE: readConst('DB_LISTENER_KEY_DAILY_REVENUE', 'dailyRevenue'),
        DB_LISTENER_KEY_MONTHLY_REVENUE: readConst('DB_LISTENER_KEY_MONTHLY_REVENUE', 'monthlyRevenue'),
        VIEW_NOT_MEASURABLE_TEXT: NOT_MEASURABLE,
        VIEW_NOT_MEASURABLE_NOTICE: '⏳ ' + NOT_MEASURABLE,
        dbListenerPendingPaths: new Set(state.pending || []),
        dbListenerFailedPaths: new Set(state.failed || []),
        monthlyReportMonth: state.month || '2026-09',
        getFormattedDate: () => '2026-09-09',
        getServerNow: () => Date.parse('2026-09-09T03:00:00Z'),
        openModalHelper: () => {},
        document: { getElementById: (id) => containers[id] || null, createElement: () => makeEl() },
        __containers: containers
    };
    sandbox.ZTO_SYNC_VIEW_KEYS = [sandbox.DB_LISTENER_KEY_HISTORY,
        sandbox.DB_LISTENER_KEY_DELETED];
    sandbox.STATS_DAILY_VIEW_KEYS = [sandbox.DB_LISTENER_KEY_DAILY_REVENUE,
        sandbox.DB_LISTENER_KEY_HISTORY, sandbox.DB_LISTENER_KEY_DELETED];
    sandbox.STATS_MONTHLY_VIEW_KEYS = [sandbox.DB_LISTENER_KEY_MONTHLY_REVENUE,
        sandbox.DB_LISTENER_KEY_DAILY_REVENUE, sandbox.DB_LISTENER_KEY_HISTORY,
        sandbox.DB_LISTENER_KEY_DELETED];
    vm.createContext(sandbox);
    vm.runInContext(CONSTS + '\n' + bodies, sandbox);
    return sandbox;
}

// អេក្រង់ទាំង ៥ ដែលអះអាង «គ្មានទិន្នន័យ» ៖ ឈ្មោះ · របៀបរត់ · កន្លែងអាន
const SCREENS = [
    { name: '📊 ស្ថិតិប្រចាំថ្ងៃ', run: (s) => s.openDailyStatsModal(), read: 'dailyStatsContainer',
        breaks: ['dailyRevenue', 'history', 'deleted'] },
    { name: '📊 ស្ថិតិ ៣ ខែ', run: (s) => s.openMonthlyStatsModal(), read: 'monthlyStatsContainer',
        breaks: ['monthlyRevenue', 'dailyRevenue', 'history', 'deleted'] },
    { name: '📊 របាយការណ៍ខែ', run: (s) => s.renderMonthlyReport(), read: 'monthlyReportBody',
        breaks: ['dailyRevenue', 'history', 'deleted'] },
    { name: '🗑️ ធុងសំរាម', run: (s) => s.renderRecentlyDeleted(), read: 'deletedTableBody',
        breaks: ['deleted'] },
    { name: '📦 តារាងប្រវត្តិ', run: (s) => s.renderHistory(s.scanHistory), read: 'historyTableBody',
        breaks: ['history'] },
    // ⛔ អេក្រង់ទី ៦ ៖ ប្រអប់ «ZTO មិនទាន់បិទ» — រូបមន្តអានប្រភព **២**
    // (`scanHistory` និង `deletedItems`) ➜ ច្រកទ្វារត្រូវគ្រប **២** ដែរ។
    { name: '🔄 ប្រអប់ ZTO មិនទាន់បិទ', run: (s) => s.renderZtoSyncModalList(), read: 'ztoSyncList',
        breaks: ['history', 'deleted'] }
];

// ⛔ សាលក្រម ZTO រស់ក្នុង localStorage ➜ វា **រស់រាន reload** ខណៈទិដ្ឋភាព
// Firebase មិនទាន់មកដល់ ➜ នោះជាលក្ខខណ្ឌដែលបង្កើតការអះអាង «✅ គ្មានកញ្ចប់ណា…»
// ខណៈការពិតគឺ «មិនទាន់ដឹង»។ រាល់សេណារីយ៉ូត្រូវចាប់ផ្តើមពីសាលក្រមទាំងនេះ។
const ZTO_VERDICTS = [['AAA111', { closed: false, at: Date.now() - 5000 }],
    ['BBB222', { closed: false, at: Date.now() - 5000 }]];
const ZTO_CLOSED_ITEM = { id: 'z1', phone: '011222333', scanDate: '2026-09-09',
    barcodes: [{ code: 'AAA111', cod: 10, dod: 0, isClosed: true,
        closedAt: Date.now() - 1000, isDeducted: false }] };
const ZTO_TRASHED_ITEM = { id: 'z2', phone: '012999888', scanDate: '2026-09-09',
    trashReason: 'pickup', isFromDeletion: true, deletedAt: Date.now() - 60000,
    barcodes: [{ code: 'BBB222', cod: 5, dod: 0, isClosed: true,
        closedAt: Date.now() - 70000, isDeducted: false }] };

const LIVE_ITEM = [{ id: 'a', scanDate: '2026-09-09', phone: '011', barcodes: [
    { code: 'A1', cod: 10, dod: 0, isClosed: false, isDeducted: false }] }];

function screenText(screen, state) {
    const sandbox = buildSandbox(Object.assign({ verdicts: ZTO_VERDICTS }, state));
    screen.run(sandbox);
    return textOf(sandbox.__containers[screen.read].innerHTML);
}

// ------------------------------------------------------------------
scenario('លក្ខខណ្ឌចាំបាច់៖ កូដពិតត្រូវរកឃើញ (បើ stub ➜ ការវាស់ខាងក្រោមទទេ)', () => {
    ok('⛔ ជាន់អប្បបរមា៖ រក function ពិតបានយ៉ាងតិច 40',
        WANT.length - missing.length >= 40, 'បាត់៖ ' + missing.join(', '));
    ok('អេក្រង់ទាំងអស់ និងច្រកទ្វារមានក្នុង app.js ពិត',
        ['openDailyStatsModal', 'openMonthlyStatsModal', 'renderMonthlyReport',
            'renderRecentlyDeleted', 'renderHistory', 'dbListenerViewIsStale',
            'renderZtoSyncModalList', 'renderZtoSyncBanner']
            .every((n) => missing.indexOf(n) === -1), 'បាត់៖ ' + missing.join(', '));
    ok('⛔ អត្ថបទ «វាស់មិនបាន» ត្រូវអានចេញពីថេរក្នុង app.js ពិត',
        NOT_MEASURABLE.length >= 8 && SRC.indexOf(NOT_MEASURABLE) !== -1, NOT_MEASURABLE);
});

// ------------------------------------------------------------------
// ⛔ ទិសផ្ទុយ ៖ គ្រប់ listener រស់ + ទិន្នន័យទទេពិត ➜ ត្រូវរាយ «គ្មានទិន្នន័យ»
scenario('⛔ ទិសផ្ទុយ៖ listener រស់ + ទទេពិត ➜ សារ «គ្មានទិន្នន័យ» ត្រូវនៅដដែល', () => {
    SCREENS.forEach((screen) => {
        const text = screenText(screen, { pending: [], failed: [] });
        ok(screen.name + ' ➜ រាយ «គ្មានទិន្នន័យ» មិនមែន «វាស់មិនបាន»',
            text.length > 0 && text.indexOf(NOT_MEASURABLE) === -1, text);
    });
});

// ------------------------------------------------------------------
// ⛔ ជាន់អប្បបរមា ៖ អេក្រង់ត្រូវ *ពិតជា* បង្ហាញអ្វីមួយក្នុងករណីទទេ
scenario('ជាន់អប្បបរមា៖ ករណីទទេត្រូវផលិតអត្ថបទពិត (មិនមែនទទេស្អាត)', () => {
    let produced = 0;
    SCREENS.forEach((screen) => {
        if (screenText(screen, { pending: [], failed: [] }).length >= 5) produced++;
    });
    ok('អេក្រង់ទាំងអស់ផលិតសារករណីទទេ', produced === SCREENS.length,
        'produced=' + produced + '/' + SCREENS.length);
});

// ------------------------------------------------------------------
// ថ្នាក់កំហុសពិត ៖ listener មិនទាន់មកដល់ (pending) ➜ មិនត្រូវអះអាង «គ្មានទិន្នន័យ»
scenario('⛔ listener មិនទាន់មកដល់ (pending) ➜ ត្រូវរាយ «វាស់មិនបាន»', () => {
    SCREENS.forEach((screen) => {
        screen.breaks.forEach((key) => {
            const text = screenText(screen, { pending: [key], failed: [], scanHistory: [] });
            ok(screen.name + ' · ' + key + ' pending ➜ មិនអះអាង «គ្មានទិន្នន័យ»',
                text.indexOf(NOT_MEASURABLE) !== -1, text);
        });
    });
});

// ------------------------------------------------------------------
// ថ្នាក់កំហុសពិត ៖ listener ងាប់ (failed) ➜ មិនត្រូវអះអាង «គ្មានទិន្នន័យ»
scenario('⛔ listener ងាប់ (failed) ➜ ត្រូវរាយ «វាស់មិនបាន»', () => {
    SCREENS.forEach((screen) => {
        screen.breaks.forEach((key) => {
            const text = screenText(screen, { pending: [], failed: [key], scanHistory: [] });
            ok(screen.name + ' · ' + key + ' failed ➜ មិនអះអាង «គ្មានទិន្នន័យ»',
                text.indexOf(NOT_MEASURABLE) !== -1, text);
        });
    });
});

// ------------------------------------------------------------------
// ⛔ ទិសផ្ទុយទី ២ ៖ ការស្វែងរកក្នុងធុងសំរាមដែល *រកមិនឃើញ* មិនមែនការវាស់មិនបាន
scenario('⛔ ទិសផ្ទុយ៖ តម្រងស្វែងរកធុងសំរាមរកមិនឃើញ ➜ សារ «រកមិនឃើញ» ដដែល', () => {
    const text = screenText(SCREENS[3], { pending: [], failed: [], query: 'zzz',
        deletedItems: [{ id: 'd1', scanDate: '2026-09-09', phone: '011', trashReason: 'remove',
            barcodes: [{ code: 'B1', cod: 1, dod: 0, isDeducted: true }] }] });
    ok('ធុងសំរាមមានធាតុ តែតម្រងមិនត្រូវ ➜ «រកមិនឃើញ» មិនមែន «វាស់មិនបាន»',
        text.length > 0 && text.indexOf(NOT_MEASURABLE) === -1, text);
});

// ------------------------------------------------------------------
// ⛔ listener ងាប់ តែមានទិន្នន័យបង្ហាញ ➜ បញ្ជីត្រូវបង្ហាញធម្មតា (មិនលាក់)
scenario('⛔ ទិសផ្ទុយ៖ listener ងាប់ តែបញ្ជីមិនទទេ ➜ បង្ហាញជួរដេកធម្មតា', () => {
    const sandbox = buildSandbox({ pending: [], failed: ['history'], scanHistory: LIVE_ITEM });
    sandbox.renderHistory(sandbox.scanHistory);
    const text = textOf(sandbox.__containers.historyTableBody.innerHTML);
    ok('ប្រវត្តិមានជួរដេក ➜ មិនត្រូវជំនួសដោយសារ «វាស់មិនបាន»',
        text.indexOf(NOT_MEASURABLE) === -1, text);
});

// ------------------------------------------------------------------
// 🔴 ថ្នាក់កំហុសពិត (វាស់បាន 2026-09-11, tree ដែល checker ១៦៦ បៃតង · SKIP 0) ៖
// របា និងប្រអប់ «ZTO មិនទាន់បិទ» អានប្រភព **២** (`scanHistory` ·
// `deletedItems`) តែមាន **ច្រកទ្វារ ០** ➜
//   listener ងាប់ទាំង ២ ➜ ប្រអប់រាយ «✅ គ្មានកញ្ចប់ណាដែល ZTO មិនទាន់បិទទេ»
//   `deleted` ងាប់ម្នាក់ឯង  ➜ របារាយ «1 កញ្ចប់» ខណៈការពិតគឺ «2»
// អ្នកប្រើអាន ✅ ➜ មិនបើក Palm ➜ កញ្ចប់នៅតែបើកក្នុង ZTO។
// ⛔ នេះជាច្បាប់ «✅ ក៏ត្រូវវាស់ដែរ» ដដែលនឹងជួរ ZTO ក្នុង 🩺 ពិនិត្យសុខភាព។
function ztoBannerText(state) {
    const sandbox = buildSandbox(Object.assign({ verdicts: ZTO_VERDICTS }, state));
    sandbox.renderZtoSyncBanner();
    return textOf(sandbox.__containers.ztoSyncBanner.innerHTML);
}
const ZTO_BOTH_LIVE = { scanHistory: [ZTO_CLOSED_ITEM], deletedItems: [ZTO_TRASHED_ITEM] };

scenario('⛔ របា ZTO ៖ លេខត្រូវនិយាយការពិត ពេលទិដ្ឋភាពមិនពេញ', () => {
    const live = ztoBannerText(Object.assign({ pending: [], failed: [] }, ZTO_BOTH_LIVE));
    ok('ជាន់អប្បបរមា៖ listener រស់ទាំង ២ ➜ របារាប់ ២ កញ្ចប់ពិត',
        live.indexOf('2') !== -1 && live.indexOf('AAA111') !== -1
        && live.indexOf('BBB222') !== -1, live);
    ok('⛔ ទិសផ្ទុយ៖ listener រស់ ➜ របាមិនត្រូវរាយ «វាស់មិនបាន»',
        live.indexOf(NOT_MEASURABLE) === -1, live);
    [['history', 'pending'], ['deleted', 'pending'],
        ['history', 'failed'], ['deleted', 'failed']].forEach((pair) => {
        const state = Object.assign({ pending: [], failed: [] }, ZTO_BOTH_LIVE);
        state[pair[1]] = [pair[0]];
        if (pair[0] === 'history') state.scanHistory = [];
        else state.deletedItems = [];
        const text = ztoBannerText(state);
        ok('របា · ' + pair[0] + ' ' + pair[1] + ' ➜ លេខខ្វះត្រូវមានសញ្ញា «វាស់មិនបាន»',
            text.length === 0 || text.indexOf(NOT_MEASURABLE) !== -1, text);
    });
});

scenario('⛔ ប្រអប់ ZTO ៖ កំណត់ចំណាំ (note) ក៏ជាការអះអាងដែរ', () => {
    const build = (state) => {
        const sandbox = buildSandbox(Object.assign({ verdicts: ZTO_VERDICTS }, state));
        sandbox.renderZtoSyncModalList();
        return String(sandbox.__containers.ztoSyncModalNote.innerText || '');
    };
    const live = build({ pending: [], failed: [] });
    ok('⛔ ទិសផ្ទុយ៖ listener រស់ + ទទេពិត ➜ «ត្រូវគ្នានឹង ZTO ទាំងអស់» ដដែល',
        live.length > 0 && live.indexOf(NOT_MEASURABLE) === -1, live);
    ['history', 'deleted'].forEach((key) => {
        const p = build({ pending: [key], failed: [] });
        ok('note · ' + key + ' pending ➜ មិនអះអាង «ត្រូវគ្នាទាំងអស់»',
            p.indexOf(NOT_MEASURABLE) !== -1, p);
        const f = build({ pending: [], failed: [key] });
        ok('note · ' + key + ' failed ➜ មិនអះអាង «ត្រូវគ្នាទាំងអស់»',
            f.indexOf(NOT_MEASURABLE) !== -1, f);
    });
    // 🔴 សាខា **ដែលមានធាតុ** ជាសាខាដាច់ដោយឡែក ៖ សេណារីយ៉ូខាងលើរត់លើបញ្ជីទទេ
    // ជានិច្ច ➜ វាមិនដែលដាក់ប្រព័ន្ធក្នុងស្ថានភាពដែលសាខានោះទប់សោះ។
    // (វាស់បាន ៖ mutation ដែលដកការអះអាងចេញពីសាខានោះ **រស់រាន** មុនការបន្ថែមនេះ។)
    const partial = build({ pending: [], failed: ['deleted'],
        scanHistory: [ZTO_CLOSED_ITEM], deletedItems: [] });
    ok('⛔ note · មានធាតុ + `deleted` ងាប់ ➜ ត្រូវប្រាប់ថាទិដ្ឋភាពមិនពេញ',
        partial.indexOf('AAA111') === -1 && partial.indexOf(NOT_MEASURABLE) !== -1, partial);
    const fullLive = build({ pending: [], failed: [],
        scanHistory: [ZTO_CLOSED_ITEM], deletedItems: [ZTO_TRASHED_ITEM] });
    ok('⛔ ទិសផ្ទុយ៖ មានធាតុ + listener រស់ ➜ note មិនមានសញ្ញា «វាស់មិនបាន»',
        fullLive.length > 0 && fullLive.indexOf(NOT_MEASURABLE) === -1, fullLive);
});

// ------------------------------------------------------------------
// 🔴 cache នៃការគូរ ៖ របា និងប្រអប់ចងចាំ signature ➜ **ការគូរទី ២ ត្រូវរំលង**
// បើ signature មិនប្រែ។ ដូច្នេះការដាក់សញ្ញា «វាស់មិនបាន» ចូលអត្ថបទ **មិន
// គ្រប់គ្រាន់** ៖ បើភាពមិនពេញនៃទិដ្ឋភាពមិនចូល signature ផង នោះទិដ្ឋភាព
// ដែល *ក្លាយជា* មិនពេញ (listener ងាប់ក្រោយ) នឹងរក្សាអត្ថបទចាស់រហូត។
// (វាស់បាន 2026-09-11 ៖ mutation «ដក stale ចេញពី signature របស់របា»
//  **រស់រាន** លើការអះអាងអត្ថបទតែម្យ៉ាង។)
scenario('⛔ cache ៖ ទិដ្ឋភាពដែលក្លាយជាមិនពេញ ត្រូវគូរឡើងវិញ', () => {
    const sandbox = buildSandbox({ verdicts: ZTO_VERDICTS,
        pending: [], failed: [], scanHistory: [ZTO_CLOSED_ITEM], deletedItems: [] });
    sandbox.renderZtoSyncBanner();
    const before = textOf(sandbox.__containers.ztoSyncBanner.innerHTML);
    ok('ជាន់អប្បបរមា៖ ការគូរទី ១ ផលិតរបាពិត',
        before.indexOf('AAA111') !== -1 && before.indexOf(NOT_MEASURABLE) === -1, before);
    // listener ងាប់ក្រោយមក — **បញ្ជីមិនប្រែ** ➜ មានតែ `stale` ដែលប្រែ
    sandbox.dbListenerFailedPaths.add(sandbox.DB_LISTENER_KEY_DELETED);
    sandbox.renderZtoSyncBanner();
    const after = textOf(sandbox.__containers.ztoSyncBanner.innerHTML);
    ok('⛔ របាត្រូវគូរឡើងវិញ ➜ សញ្ញា «វាស់មិនបាន» លេចចេញ',
        after.indexOf(NOT_MEASURABLE) !== -1, after);
    // ⛔ ទិសផ្ទុយ ៖ ត្រឡប់ទៅរស់វិញ ➜ សញ្ញាត្រូវ **បាត់**
    sandbox.dbListenerFailedPaths.delete(sandbox.DB_LISTENER_KEY_DELETED);
    sandbox.renderZtoSyncBanner();
    const back = textOf(sandbox.__containers.ztoSyncBanner.innerHTML);
    ok('⛔ ទិសផ្ទុយ៖ listener ត្រឡប់មករស់ ➜ សញ្ញាត្រូវបាត់វិញ',
        back.indexOf(NOT_MEASURABLE) === -1 && back.indexOf('AAA111') !== -1, back);
});

// ⛔ ច្រកទ្វារត្រូវ **ដេរីវេ** ពីបញ្ជីកូនសោតែមួយ មិនមែនចាក់ literal ២ ខាង
scenario('⛔ ច្រកទ្វារ ZTO ត្រូវគ្របប្រភពទាំង ២ របស់រូបមន្ត', () => {
    const keys = /const\s+ZTO_SYNC_VIEW_KEYS\s*=\s*\[([^\]]*)\]/.exec(SRC);
    ok('⛔ `ZTO_SYNC_VIEW_KEYS` មានក្នុង app.js ពិត', !!keys, keys && keys[1]);
    if (keys) {
        ok('⛔ វាគ្រប DB_LISTENER_KEY_HISTORY និង DB_LISTENER_KEY_DELETED',
            keys[1].indexOf('DB_LISTENER_KEY_HISTORY') !== -1
            && keys[1].indexOf('DB_LISTENER_KEY_DELETED') !== -1, keys[1]);
    }
    // ⛔ សារ toast របស់ការចុច 🔄 ជាការអះអាងទី ៣ នៃថ្នាក់ដដែល
    const recheck = /async function recheckZtoPickupStatus[\s\S]*?\n    \}/.exec(SRC);
    ok('⛔ ជាន់អប្បបរមា៖ រក `recheckZtoPickupStatus` ឃើញ', !!recheck);
    if (recheck) {
        ok('⛔ toast «ត្រូវគ្នានឹង ZTO ទាំងអស់» ត្រូវឆ្លងកាត់ `emptyViewMessage`',
            /emptyViewMessage\(\s*ZTO_SYNC_VIEW_KEYS/.test(recheck[0]), recheck[0].slice(-400));
    }
});

// ⛔ cache នៃការគូរមិនត្រូវបង្កកអត្ថបទចាស់ (ច្បាប់ដដែលនឹង 2.31.10 ៖ `waiting`
// ត្រូវចូល signature) — ឥឡូវ **ភាពមិនពេញនៃទិដ្ឋភាព** និង **meta ដែលគូរពិត**
// (លេខទូរស័ព្ទ · Locker) ក៏ត្រូវចូលដែរ បើមិនដូច្នេះការប្តូរពីឧបករណ៍ផ្សេង
// មិនដែលលេចលើអេក្រង់ទេ។
scenario('⛔ signature របស់ប្រអប់ត្រូវគ្រប់អ្វីដែលវាគូរ', () => {
    const body = /function renderZtoSyncModalList[\s\S]*?\n    \}/.exec(SRC);
    ok('⛔ ជាន់អប្បបរមា៖ រក `renderZtoSyncModalList` ឃើញ', !!body);
    if (!body) return;
    const sig = /const signature = ([^;]+);/.exec(body[0]);
    ok('⛔ រក signature ឃើញ', !!sig, sig && sig[1]);
    if (!sig) return;
    ['waiting', 'stale', 'phone', 'locker'].forEach((part) => {
        ok('signature ផ្ទុក «' + part + '»', sig[1].indexOf(part) !== -1, sig[1]);
    });
});

console.log('');
if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' / ok ' + pass); process.exit(1); }
console.log('✅ ជោគជ័យ ' + pass);
