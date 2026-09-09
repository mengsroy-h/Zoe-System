// ⛔ ថ្នាក់កំហុស ៖ **លេខលុយដែលអ្នកប្រើអានលើអេក្រង់** ខុស ខណៈ ledger លើ server ត្រឹមត្រូវ។
//
// ហេតុអ្វីឧបករណ៍នេះមាន (វាស់បាន 2026-09-09) ៖
//   ផ្លូវ **ledger** មានអ្នកយាម ៩ រួម `revenue-fuzz-test` (លំដាប់ចៃដន្យ) + emulator ពិត
//   ➜ ក្រោយការកែតាមរចនាសម្ព័ន្ធ (2.27.0) ថ្នាក់នោះ **ឈប់វិលមកវិញ**។
//   ផ្លូវ **បង្ហាញ** មានអ្នកយាម ៤ ដែល ៣ ក្នុង ៤ ប្រើតែ **ស្ថានភាពសរសេរដោយដៃ**
//   ➜ រាល់ជុំសរសេរសេណារីយ៉ូល្អជាងមុនបន្តិច ➜ រកឃើញកំហុសមួយទៀតក្នុងកូដដដែល
//   (2.31.6 · 2.31.7 សុទ្ធតែស្ថិតក្នុង ១៧៦ បន្ទាត់ដែលសរសេរនៅជុំ 2.30.0)។
//   ⛔ `revenue-fuzz-test` **មិនប៉ះផ្លូវបង្ហាញសោះ** (០ ការយោង)។
//
// ឧបករណ៍នេះសាងស្ថានភាពចៃដន្យ (រួមទាំង **ការឃ្លាតពិត** ៖ «កែទឹកប្រាក់» ដោយដៃ ·
// ការ purge · ledger ខែឃ្លាតពីថ្ងៃ · listener ដែលព្យួរ) រួចរត់អេក្រង់ **ពិត**
// (`openDailyStatsModal` · `openMonthlyStatsModal` · `buildMonthlyReport`) ក្នុង `vm`
// ហើយ **អានលេខចេញពី HTML ដែលអ្នកប្រើមើលឃើញ** រួចអះអាងអថេរ ៥ ៖
//
//   (ក) ថ្ងៃ ↔ ជួរដេករបាយការណ៍ខែ  — រូបមន្តតែមួយ កម្រិតតែមួយ
//   (ខ) ខែ = **ផលបូកថ្ងៃ**        — 🔴 ថ្នាក់ 2.31.6 (កម្រិតបូក)
//   (គ) វាស់មិនបាន ➜ `—` គ្រប់អេក្រង់ — 🔴 ថ្នាក់ 2.31.7 (សិទ្ធិវាស់)
//   (ឃ) ការពិត ៖ ចំណូល = Σ barcode `isClosed && !isDeducted` (លើស្ថានភាព **ស្អាត**)
//   (ង) ការអភិរក្ស ៖ ចំណូល + មិនទាន់យក = តម្លៃទាំងអស់ (លើរបាយការណ៍ខែ)
//
// ⛔ តម្លៃសាកល្បង **មានសេន** ដោយចេតនា — លេខមូលលាក់ mutation នៃការបង្គត់។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.COLLECTFUZZ_APP_DIR || path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');
const RUN0 = parseInt(process.env.CFUZZ_RUN0 || '0', 10);
const RUNS = parseInt(process.env.CFUZZ_RUNS || '160', 10);

let pass = 0, fail = 0;
const failSamples = [];
function ok(label, cond, detail) {
    if (cond) { pass++; return true; }
    fail++;
    if (failSamples.length < 12) failSamples.push('  FAIL  ' + label + (detail !== undefined ? '\n        ' + String(detail).slice(0, 400) : ''));
    return false;
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
function readKey(name, fallback) {
    const m = new RegExp('const\\s+' + name + "\\s*=\\s*'([^']+)'").exec(SRC);
    return m ? m[1] : fallback;
}

// ⛔ រកឈ្មោះមិនឃើញ ➜ **stub** មិនមែន exit (បើអត់ ការអះអាងខាងក្រោមត្រូវបិទបាំង)។
const WANT = ['sanitizeInput', 'ledgerNumber', 'statsMonthOf', 'statsPositive', 'statsMoney',
    'statsCount', 'countPickedUpCustomers', 'uncollectedBarcodeValue', 'uncollectedItemValue',
    'uncollectedValueByDate', 'collectedValueOf', 'collectedValueForMonth', 'collectedMoneyText',
    'collectedRielText', 'monthlyReportRiel', 'buildStatCardItem', 'buildMonthlyReport',
    'openDailyStatsModal', 'openMonthlyStatsModal', 'collectedValueIsMeasurable',
    'dbListenerViewIsStale',
    // ⛔ ឈ្មោះចាស់មុន 2.31.6 — ត្រូវស្រង់ដែរ ដើម្បីឲ្យ tree មុនកែ **រត់បាន រួចរាយលេខខុស**
    // (បើអត់ sandbox បាក់ដោយ ReferenceError ➜ យើងដឹងតែថា «ធ្លាក់» មិនដឹងថា *លេខប៉ុន្មាន*)
    'uncollectedValueForMonth'];
const missing = [];
const bodies = WANT.map((n) => {
    const body = sliceFn(SRC, n);
    if (body) return body;
    missing.push(n);
    return 'function ' + n + '() { return undefined; }';
}).join('\n');

function makeEl() {
    return { innerHTML: '', className: '', children: [], appendChild(c) { this.children.push(c); return c; } };
}
function moneyAfter(html, label) {
    const at = html.indexOf(label);
    if (at === -1) return null;
    const m = /(—|\$-?[\d,]+\.\d{2})/.exec(html.slice(at, at + 400));
    return m ? m[1] : null;
}
function countAfter(html) {
    const m = /កញ្ចប់សរុប៖ <strong>(-?[\d.]+)<\/strong>/.exec(html);
    return m ? m[1] : null;
}
const LBL_COLLECTED = 'ចំណូល (យករួច)';
const LBL_ALL = 'តម្លៃកញ្ចប់ទាំងអស់';
const LBL_PENDING = 'មិនទាន់យក';

function buildSandbox(state) {
    const containers = { dailyStatsContainer: makeEl(), monthlyStatsContainer: makeEl() };
    const sandbox = {
        console,
        scanHistory: state.scanHistory, deletedItems: state.deletedItems,
        dailyRevenueData: state.dailyRevenueData, dailyPickupData: state.dailyPickupData,
        monthlyRevenueData: state.monthlyRevenueData,
        exchangeRateRiel: 4100,
        PICKUP_DATE_KEY_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
        MONTHLY_REPORT_MONTH_PATTERN: /^\d{4}-\d{2}$/,
        MONTHLY_REPORT_UNKNOWN: '—',
        MONTHLY_REPORT_MONEY_TOLERANCE: 0.005,
        DB_LISTENER_KEY_HISTORY: readKey('DB_LISTENER_KEY_HISTORY', 'history'),
        DB_LISTENER_KEY_DELETED: readKey('DB_LISTENER_KEY_DELETED', 'deleted'),
        DB_LISTENER_KEY_MONTHLY_REVENUE: readKey('DB_LISTENER_KEY_MONTHLY_REVENUE', 'monthlyRevenue'),
        VIEW_NOT_MEASURABLE_TEXT: readKey('VIEW_NOT_MEASURABLE_TEXT', '\u0001none\u0001'),
        DB_LISTENER_KEY_DAILY_REVENUE: readKey('DB_LISTENER_KEY_DAILY_REVENUE', 'dailyRevenue'),
        dbListenerPendingPaths: new Set(state.pending || []),
        dbListenerFailedPaths: new Set(state.failed || []),
        getFormattedDate: () => '2026-09-30',
        openModalHelper: () => {},
        document: { getElementById: (id) => containers[id] || null, createElement: () => makeEl() },
        __containers: containers
    };
    vm.createContext(sandbox);
    vm.runInContext(bodies, sandbox);
    return sandbox;
}

// ------------------------------------------------------------------ ម៉ាស៊ីនចៃដន្យ
function rng(seed) {
    let s = (seed * 2654435761) >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const r2 = (n) => Math.round(n * 100) / 100;
const money = (n) => '$' + r2(n).toFixed(2);

const DAYS = ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03'];

// ⛔ តម្លៃ **មានសេន** ដោយចេតនា — លេខមូលលាក់ mutation នៃការបង្គត់
function cents(rand) { return r2(1 + rand() * 40 + Math.floor(rand() * 100) / 100); }

function genWorld(seed) {
    const rand = rng(seed);
    const scanHistory = [], deletedItems = [];
    const nItems = 2 + Math.floor(rand() * 6);
    for (let i = 0; i < nItems; i++) {
        const date = DAYS[Math.floor(rand() * DAYS.length)];
        const barcodes = [];
        const nb = 1 + Math.floor(rand() * 3);
        for (let j = 0; j < nb; j++) {
            const useCod = rand() < 0.6;
            barcodes.push({
                code: 'B' + i + '_' + j,
                cod: useCod ? cents(rand) : 0,
                dod: useCod ? 0 : cents(rand),
                isClosed: false, isDeducted: false
            });
        }
        const item = { id: 'i' + i, scanDate: date, phone: '01' + (100 + i), barcodes: barcodes };
        // សកម្មភាពចៃដន្យ ៖ បិទ «យក» · ដក (ដកលុយ) · លុប (មិនដកលុយ) · ផុតកំណត់ (ដកលុយ) · ស្តារ
        barcodes.forEach((b) => {
            const op = rand();
            if (op < 0.35) { b.isClosed = true; }                       // យករួច
            else if (op < 0.50) { b.isDeducted = true; }                 // ដក (ជួរ ៤)
            else if (op < 0.60) { b.isDeducted = true; b.isClosed = true; }
            else if (op < 0.68) { b.isClosed = true; b.isDeducted = false; } // ស្តារបើកវិញ
        });
        (rand() < 0.65 ? scanHistory : deletedItems).push(item);
    }
    return { scanHistory, deletedItems, rand };
}

// ledger ដេរីវេពីការពិត ៖ Σ barcode ដែល `!isDeducted`
function ledgerFromWorld(scanHistory, deletedItems) {
    const daily = {};
    [scanHistory, deletedItems].forEach((list) => list.forEach((item) => {
        const d = item.scanDate;
        const b = daily[d] || (daily[d] = { codDollar: 0, dodDollar: 0, totalCount: 0 });
        item.barcodes.forEach((bc) => {
            if (bc.isDeducted) return;
            b.codDollar += bc.cod; b.dodDollar += bc.dod; b.totalCount += 1;
        });
    }));
    Object.keys(daily).forEach((d) => {
        daily[d].codDollar = r2(daily[d].codDollar);
        daily[d].dodDollar = r2(daily[d].dodDollar);
    });
    return daily;
}
function monthlyFromDaily(daily) {
    const m = {};
    Object.keys(daily).forEach((d) => {
        const ym = d.slice(0, 7);
        const b = m[ym] || (m[ym] = { codDollar: 0, dodDollar: 0, totalCount: 0 });
        b.codDollar = r2(b.codDollar + daily[d].codDollar);
        b.dodDollar = r2(b.dodDollar + daily[d].dodDollar);
        b.totalCount += daily[d].totalCount;
    });
    return m;
}
// ការពិត ៖ ចំណូល = Σ barcode `isClosed && !isDeducted` (ក្នុងមួយថ្ងៃ · ក្នុងមួយរូបិយវត្ថុ)
function truthByDate(scanHistory, deletedItems) {
    const out = {};
    [scanHistory, deletedItems].forEach((list) => list.forEach((item) => {
        const d = item.scanDate;
        const b = out[d] || (out[d] = { cod: 0, dod: 0 });
        item.barcodes.forEach((bc) => {
            if (bc.isDeducted || !bc.isClosed) return;
            b.cod += bc.cod; b.dod += bc.dod;
        });
    }));
    Object.keys(out).forEach((d) => { out[d].cod = r2(out[d].cod); out[d].dod = r2(out[d].dod); });
    return out;
}

function cardsOf(sb, which) { return sb.__containers[which].children.map((c) => String(c.innerHTML || '')); }
function cardFor(cards, key) { return cards.find((h) => h.indexOf('៖ ' + key + '<') !== -1) || null; }

// ------------------------------------------------------------------
scenario('សំណុំ function ពិតត្រូវរកឃើញ (បើ stub ➜ ការវាស់ខាងក្រោមមិនមានន័យ)', () => {
    ok('⛔ ជាន់អប្បបរមា៖ រក function ស្ថិតិពិតបានយ៉ាងតិច 19',
        WANT.length - missing.length >= 19, 'បាត់៖ ' + missing.join(', '));
    ok('អេក្រង់ទាំង ៣ មានក្នុង app.js ពិត',
        ['openDailyStatsModal', 'openMonthlyStatsModal', 'buildMonthlyReport']
            .every((n) => missing.indexOf(n) === -1), 'បាត់៖ ' + missing.join(', '));
});

// ------------------------------------------------------------------
let cleanRuns = 0, driftRuns = 0, staleRuns = 0, monthCards = 0, dayCards = 0;

scenario('លំដាប់ចៃដន្យ ' + RUNS + ' ➜ អថេរ ៥ លើលេខដែលអ្នកប្រើអានពិត', () => {
    for (let run = RUN0; run < RUN0 + RUNS; run++) {
        const w = genWorld(run + 1);
        const rand = w.rand;
        const daily = ledgerFromWorld(w.scanHistory, w.deletedItems);
        let clean = true;

        // ⛔ ការឃ្លាតពិត ៖ «កែទឹកប្រាក់» ដោយដៃ (អ្នកប្រើសរសេរតួលេខផ្ទាល់ — ទទួលយកដោយចេតនា)
        if (rand() < 0.45) {
            const ks = Object.keys(daily);
            if (ks.length) {
                const d = ks[Math.floor(rand() * ks.length)];
                daily[d].codDollar = Math.max(0, r2(daily[d].codDollar + (rand() < 0.5 ? -1 : 1) * cents(rand)));
                clean = false;
            }
        }
        // ⛔ ការឃ្លាតពិត ២ ៖ ថ្ងៃដែលមានកញ្ចប់បើក តែគ្មានជួរ ledger សោះ
        if (rand() < 0.30) {
            const ks = Object.keys(daily);
            if (ks.length > 1) { delete daily[ks[Math.floor(rand() * ks.length)]]; clean = false; }
        }
        const monthly = monthlyFromDaily(daily);
        // ⛔ ការឃ្លាតពិត ៣ ៖ ledger ខែឃ្លាតពីផលបូកថ្ងៃ
        let aligned = true;
        if (rand() < 0.25) {
            const ms = Object.keys(monthly);
            if (ms.length) {
                const m = ms[Math.floor(rand() * ms.length)];
                monthly[m].codDollar = Math.max(0, r2(monthly[m].codDollar + cents(rand)));
                aligned = false; clean = false;
            }
        }
        // ⛔ listener ព្យួរ/ងាប់ ៖ ថ្នាក់ «សិទ្ធិវាស់»
        const pending = [], failed = [];
        let stale = false;
        if (rand() < 0.22) {
            const key = ['history', 'deleted', 'dailyRevenue'][Math.floor(rand() * 3)];
            (rand() < 0.5 ? pending : failed).push(key);
            stale = true; clean = false;
        }
        if (clean) cleanRuns++; else driftRuns++;
        if (stale) staleRuns++;

        const pickup = {};
        Object.keys(daily).forEach((d) => { pickup[d] = { packagesPickedUp: 0, pickedUpPhones: {} }; });

        const state = {
            scanHistory: w.scanHistory, deletedItems: w.deletedItems,
            dailyRevenueData: daily, monthlyRevenueData: monthly, dailyPickupData: pickup,
            pending, failed
        };
        // ច្បាប់ចម្លងជ្រៅ ៖ ធានាថាកូដបង្ហាញ **មិនអាចកែ** ពិភពដែលយើងយកទៅធៀបជាការពិត
        const sb = buildSandbox(JSON.parse(JSON.stringify(state)));

        sb.openDailyStatsModal();
        sb.openMonthlyStatsModal();
        const dayCardList = cardsOf(sb, 'dailyStatsContainer');
        const monCardList = cardsOf(sb, 'monthlyStatsContainer');
        dayCards += dayCardList.length; monthCards += monCardList.length;
        const months = Object.keys(monthly);
        const truth = truthByDate(w.scanHistory, w.deletedItems);

        // ---- (គ) សិទ្ធិវាស់ ៖ ទិដ្ឋភាពមិនគ្រប់ ➜ `—` គ្រប់អេក្រង់
        if (stale) {
            const bad = dayCardList.concat(monCardList).filter((h) =>
                moneyAfter(h, LBL_COLLECTED) !== '—' || moneyAfter(h, LBL_PENDING) !== '—');
            ok('run=' + run + ' (គ) វាស់មិនបាន ➜ «' + LBL_COLLECTED + '» និង «' + LBL_PENDING + '» ត្រូវជា «—»',
                bad.length === 0, 'pending=' + pending + ' failed=' + failed
                + ' · អាន=' + (bad[0] ? moneyAfter(bad[0], LBL_COLLECTED) + '/' + moneyAfter(bad[0], LBL_PENDING) : ''));
            months.forEach((ym) => {
                const rep = sb.buildMonthlyReport(ym);
                ok('run=' + run + ' (គ) របាយការណ៍ខែ ' + ym + ' រាយថាវាស់មិនបាន',
                    rep.totals.collectedMeasurable === false, 'measurable=true');
            });
            continue;
        }

        months.forEach((ym) => {
            const rep = sb.buildMonthlyReport(ym);
            const monCard = cardFor(monCardList, ym);
            if (!monCard) return;

            // ---- (ខ) 🔴 ខែ = ផលបូកថ្ងៃ (ថ្នាក់ 2.31.6)
            ok('run=' + run + ' (ខ) កាតខែ ' + ym + ' «' + LBL_COLLECTED + '» = ផលបូកថ្ងៃរបស់របាយការណ៍',
                moneyAfter(monCard, LBL_COLLECTED) === money(rep.totals.collectedTotal),
                'កាត=' + moneyAfter(monCard, LBL_COLLECTED) + ' · របាយការណ៍=' + money(rep.totals.collectedTotal));

            // ---- (ង) ការអភិរក្សលើរបាយការណ៍ខែ ៖ ចំណូល + មិនទាន់យក = តម្លៃទាំងអស់
            ok('run=' + run + ' (ង) របាយការណ៍ខែ ' + ym + ' ៖ ចំណូល + មិនទាន់យក = តម្លៃទាំងអស់',
                Math.abs((rep.totals.collectedTotal + rep.totals.pendingTotal) - rep.totals.total) < 0.005,
                rep.totals.collectedTotal + ' + ' + rep.totals.pendingTotal + ' ≠ ' + rep.totals.total);

            if (aligned) {
                ok('run=' + run + ' (ខ) កាតខែ ' + ym + ' «' + LBL_PENDING + '» = របាយការណ៍',
                    moneyAfter(monCard, LBL_PENDING) === money(rep.totals.pendingTotal),
                    'កាត=' + moneyAfter(monCard, LBL_PENDING) + ' · របាយការណ៍=' + money(rep.totals.pendingTotal));
                ok('run=' + run + ' (ខ) កាតខែ ' + ym + ' «' + LBL_ALL + '» = របាយការណ៍',
                    moneyAfter(monCard, LBL_ALL) === money(rep.totals.total),
                    'កាត=' + moneyAfter(monCard, LBL_ALL) + ' · របាយការណ៍=' + money(rep.totals.total));
                ok('run=' + run + ' (ខ) កាតខែ ' + ym + ' «កញ្ចប់សរុប» = របាយការណ៍',
                    countAfter(monCard) === String(rep.totals.count),
                    'កាត=' + countAfter(monCard) + ' · របាយការណ៍=' + rep.totals.count);
            }

            // ---- (ក) ថ្ងៃ ↔ ជួរដេករបស់របាយការណ៍ខែ
            rep.days.forEach((d) => {
                const dayCard = cardFor(dayCardList, d.date);
                if (!dayCard) return;
                ok('run=' + run + ' (ក) ថ្ងៃ ' + d.date + ' ↔ ជួរដេករបាយការណ៍ខែ',
                    moneyAfter(dayCard, LBL_COLLECTED) === money(d.collectedTotal),
                    'ថ្ងៃ=' + moneyAfter(dayCard, LBL_COLLECTED) + ' · របាយការណ៍=' + money(d.collectedTotal));

                // ---- (ឃ) ការពិត ៖ តែលើថ្ងៃដែល ledger មិនត្រូវឃ្លាត
                if (clean && truth[d.date]) {
                    const t = r2(truth[d.date].cod + truth[d.date].dod);
                    ok('run=' + run + ' (ឃ) ថ្ងៃ ' + d.date + ' ចំណូល = Σ barcode `isClosed && !isDeducted`',
                        Math.abs(d.collectedTotal - t) < 0.005,
                        'អេក្រង់=' + d.collectedTotal + ' · ការពិត=' + t);
                }
            });
        });
    }

    // ⛔ ជាន់អប្បបរមា ៖ បើមិនដល់ ស្ថានភាពមិនបានកេះផ្លូវពិត ➜ តេស្តទទេ
    ok('⛔ ជាន់អប្បបរមា៖ គូរកាតថ្ងៃយ៉ាងតិច 150', dayCards >= 150, 'dayCards=' + dayCards);
    ok('⛔ ជាន់អប្បបរមា៖ គូរកាតខែយ៉ាងតិច 60', monthCards >= 60, 'monthCards=' + monthCards);
    ok('⛔ ជាន់អប្បបរមា៖ ស្ថានភាព **ស្អាត** យ៉ាងតិច 30 (សម្រាប់អថេរ (ឃ))', cleanRuns >= 30, 'clean=' + cleanRuns);
    ok('⛔ ជាន់អប្បបរមា៖ ស្ថានភាព **ឃ្លាត** យ៉ាងតិច 40 (សម្រាប់អថេរ (ខ))', driftRuns >= 40, 'drift=' + driftRuns);
    ok('⛔ ជាន់អប្បបរមា៖ ស្ថានភាព listener **មិនគ្រប់** យ៉ាងតិច 15 (សម្រាប់អថេរ (គ))', staleRuns >= 15, 'stale=' + staleRuns);
});

// ------------------------------------------------------------------
// ⛔ probe ទិសផ្ទុយ ៖ ស្ថានភាពស្អាត + listener រស់ ➜ ត្រូវបង្ហាញ **លេខ** មិនមែន «—»
// (បើអត់ ការកែ «return `—` ជានិច្ច» នឹងបៃតងទាំងអស់ខាងលើ)
scenario('⛔ ទិសផ្ទុយ៖ ទិដ្ឋភាពគ្រប់ ➜ លេខពិត មិនមែន «—»', () => {
    const w = genWorld(7);
    const daily = ledgerFromWorld(w.scanHistory, w.deletedItems);
    const sb = buildSandbox({
        scanHistory: w.scanHistory, deletedItems: w.deletedItems,
        dailyRevenueData: daily, monthlyRevenueData: monthlyFromDaily(daily),
        dailyPickupData: {}, pending: [], failed: []
    });
    sb.openDailyStatsModal();
    const cards = cardsOf(sb, 'dailyStatsContainer');
    ok('⛔ ជាន់អប្បបរមា៖ គូរកាតថ្ងៃពិត', cards.length >= 1, 'cards=' + cards.length);
    const numeric = cards.filter((h) => {
        const v = moneyAfter(h, LBL_COLLECTED);
        return v !== null && v !== '—';
    });
    ok('ទិដ្ឋភាពគ្រប់ ➜ គ្រប់កាតបង្ហាញលេខ', numeric.length === cards.length,
        numeric.length + '/' + cards.length);
    const rep = sb.buildMonthlyReport('2026-09');
    ok('ទិដ្ឋភាពគ្រប់ ➜ របាយការណ៍ខែរាយថាវាស់បាន', rep.totals.collectedMeasurable === true);
});

console.log('');
console.log('ស្ថានភាព ៖ ស្អាត ' + cleanRuns + ' · ឃ្លាត ' + driftRuns + ' · listener មិនគ្រប់ ' + staleRuns
    + ' · កាតថ្ងៃ ' + dayCards + ' · កាតខែ ' + monthCards);
if (fail) {
    console.log('\nគំរូនៃការធ្លាក់ ៖');
    failSamples.forEach((s) => console.log(s));
    console.log('\n❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')');
    process.exit(1);
}
console.log('\n✅ ok ' + pass);
