// ⛔ ថ្នាក់កំហុស៖ **ការដកវិញបន្ទាប់ពីការអនុវត្តដែល *មិនដែលចុះដល់ server*
//         ➜ ចំណូលកើតឡើងពីអាកាសធាតុ។**
//
// 🔴 **កំហុសលុយពិត** (វាស់ 2026-09-06)។ រាល់ផ្លូវលុយសរសេរតាមគំរូ
// «អនុវត្តជាមុន ➜ ដកវិញពេលបរាជ័យ» ៖
//
//   deductionApplied = addRevenueToDailyAndMonthlyRecord(d, -4, 0, -1);
//   ...ការសរសេរធុងសំរាមធ្លាក់...
//   revertRevenueLedgerDelta(deductionApplied);
//
// `revertLedgerBucketOnServer()` សម្រេចថាត្រូវដកប៉ុន្មាន ដោយ ៖
//
//   const d = serverApplied || memoryApplied;
//
// ⛔ តែ `serverApplied === null` **មានន័យថា server មិនបានអនុវត្តអ្វីសោះ** ៖
// transaction បដិសេធ (`permission_denied` · បណ្តាញដាច់) ឬ `committed: false`។
// ការធ្លាក់ចុះទៅ `memoryApplied` ក្នុងករណីនោះ **ដកលេខដែលមិនដែលត្រូវបូក**។
//
// លំដាប់ដែលវាស់បាន (បណ្តាញដាច់ **មួយភ្លែត** — មិនមែនដាច់ជាប់) ៖
//
//   | ជំហាន | អ្វីកើតឡើង | server |
//   |---|---|---|
//   | មុន | ថ្ងៃមាន $10.00 · ២ កញ្ចប់ | 10.00 / 2 |
//   | ដក barcode $4 | ការសរសេរ ledger **បដិសេធ** (បណ្តាញដាច់មួយភ្លែត) | **10.00 / 2** |
//   | ការសរសេរធុងសំរាមធ្លាក់ | ➜ `revertRevenueLedgerDelta()` | |
//   | ដកវិញ `-(-4) = +4` | បណ្តាញត្រឡប់មកវិញ ➜ **ជោគជ័យ** | 🔴 **14.00 / 3** |
//
// ➜ **$4.00 និងកញ្ចប់ ១ កើតឡើងដោយគ្មានកញ្ចប់ណាមួយ** ។
//
// ⚠️ **ហេតុអ្វី checker ១៣៣ បៃតងទាំងអស់** ៖ សេណារីយ៉ូ «ដកវិញ» ទាំងអស់
// (`ledger-clamp-symmetry` ៖ cross-zero · away-from-zero · add-then-revert ·
// deep-clamp · memory-diverged; និង `emu/ledger-revert-emu-test` ដដែល)
// ចាប់ផ្តើមពី **ការអនុវត្តដែលជោគជ័យ**។ គ្មានឯកសារណាដាក់ការអនុវត្តក្នុង
// **របៀបបរាជ័យ** មុនកេះផ្លូវដកវិញសោះ។ នេះជា **សំណួរទី ៩** របស់ `CLAUDE.md`
// («តើ checker ដាក់ dependency ក្នុង *របៀបបរាជ័យ* ណា?») ៖ របៀប «បដិសេធ»
// ត្រូវបានសាកលើ *ការអនុវត្ត* រួចហើយ តែមិនដែលសាកជាមួយ *ការដកវិញ* ទេ។
//
// ⛔ ជាន់ទី ២ នៃថ្នាក់ដដែល ៖ **ការដកវិញក្នុងសតិត្រូវរត់តែម្តង**។
// `commitDailyRevenueDelta().catch()` ដក memory ត្រឡប់រួចហើយ ➜ ការដកវិញ
// របស់អ្នកហៅ ដកម្តងទៀត ➜ សតិ **ឡើងខ្ពស់ជាងមុន** ខណៈ server នៅដដែល។
//
// ⛔ ជាន់ទី ៣ ៖ **`correctRevenueLedgerToActual()` ដើរតាមមូលដ្ឋានដដែល** —
// ការកែតម្រូវទៅតម្លៃពិត គិតធៀបនឹង delta ដែល *សតិ* អនុវត្ត ➜ ពេលការសរសេរ
// ledger ធ្លាក់ តែ transaction ប្រវត្តិជោគជ័យ ការកែតម្រូវសរសេរលេខខុសចូល server។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ៖
//   ១. ការដកវិញលើ server ត្រូវដក **តែ delta ដែល server ត្រឡប់មកពិត** —
//      `null` (បដិសេធ · `committed:false`) មានន័យថា **គ្មានអ្វីត្រូវដក**។
//   ២. ការដកវិញក្នុងសតិត្រូវ **idempotent** ៖ ផ្លូវ `catch` របស់ commit
//      និងផ្លូវដកវិញរបស់អ្នកហៅ មិនត្រូវដកទ្វេដង (ទាំង ២ លំដាប់)។
//   ៣. ⛔ **ទិសផ្ទុយ** ៖ ការអនុវត្តដែល **ជោគជ័យ** ➜ ការដកវិញត្រូវនៅតែ
//      ត្រឡប់ server និងសតិមកតម្លៃដើម **ពិតប្រាកដ** (ការកែមិនត្រូវត្រឹមតែ
//      «បិទការដកវិញ» ចោល)។
//   ៤. ⛔ ករណី **គ្មាន `dbRef`** ៖ គ្មាន server សោះ ➜ សតិត្រូវនៅតែដកវិញ។
//   ៥. `correctRevenueLedgerToActual()` មិនត្រូវសរសេរការកែតម្រូវទៅ server
//      ពេលការអនុវត្តដើមមិនដែលចុះដល់ server។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.LEDGERFAIL_APP_DIR || path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

let SRC = '';
try {
    SRC = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
} catch (e) {
    console.log('  FAIL   អាន ZoeW/app.js មិនបាន ➜ ' + e.message);
    console.log('\n❌ ធ្លាក់ — កូដដែលតេស្តនេះការពារ បាត់ពី tree ដែលកំពុងពិនិត្យ');
    process.exit(1);
}

function sliceFn(name) {
    const at = SRC.search(new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('));
    if (at === -1) return null;
    let depth = 0;
    const start = SRC.indexOf('{', SRC.indexOf(')', at));
    for (let k = start; k < SRC.length; k++) {
        if (SRC[k] === '{') depth++;
        else if (SRC[k] === '}') { depth--; if (!depth) return SRC.slice(at, k + 1); }
    }
    return null;
}

// ── ០. ជាន់អប្បបរមា (checker នេះត្រូវអាចធ្លាក់បាន) ────────────────────
console.log('\n=== ០. ជាន់អប្បបរមា (checker នេះត្រូវអាចធ្លាក់បាន) ===');
ok('ZoeW/app.js មិនទទេ (>= 4000 បន្ទាត់)', SRC.split('\n').length >= 4000, SRC.split('\n').length);

const REQUIRED_FNS = [
    'ledgerNumber', 'ledgerAppliedDelta', 'ledgerDeltaWithClamp', 'revertLedgerRecordInMemory',
    'applyLedgerBucketDelta', 'commitRevenueBucketDelta', 'ledgerZeroDelta', 'ledgerServerVerdict', 'ledgerMemoryCompensationClaimed', 'revertLedgerBucketOnServer',
    'revertRevenueLedgerDelta', 'correctRevenueLedgerToActual', 'addRevenueToDailyAndMonthlyRecord',
    'commitDailyRevenueDelta', 'commitMonthlyRevenueDelta', 'getFormattedDate'
];
const fnSrc = {};
const missing = [];
for (const n of REQUIRED_FNS) {
    const s = sliceFn(n);
    if (s) fnSrc[n] = s; else missing.push(n);
}
// ⛔ កុំបញ្ឈប់ពេលរកឈ្មោះមិនឃើញ — stub ជំនួស ដើម្បីកុំបិទបាំងការអះអាងខាងក្រោម
ok('រក function ចាំបាច់ទាំង ' + REQUIRED_FNS.length + ' ឃើញ', missing.length === 0, missing);
for (const n of missing) fnSrc[n] = 'function ' + n + '() {}';

// ── sandbox ៖ server ក្លែងដែលអាចដាក់ក្នុង *របៀបបរាជ័យ* បាន ─────────────
// `txPlan` ជាបញ្ជីសាលក្រមក្នុងមួយការហៅ ៖ 'ok' · 'reject' · 'abort'។
// ធាតុចុងក្រោយត្រូវបានប្រើឡើងវិញសម្រាប់ការហៅបន្ថែម (ដូច្នេះ ['reject','ok']
// = «បណ្តាញដាច់មួយភ្លែត រួចត្រឡប់មកវិញ»)។
function makeSandbox(txPlan, opts) {
    const options = opts || {};
    const store = { zoew_daily_revenue_cod_dod: {}, zoew_monthly_revenue_cod_dod: {} };
    const calls = [];

    function getPath(p) {
        const parts = String(p).split('/').filter(Boolean);
        let cur = store;
        for (const part of parts) {
            if (cur === null || cur === undefined || typeof cur !== 'object') return null;
            cur = cur[part];
        }
        return cur === undefined ? null : cur;
    }
    function setPath(p, v) {
        const parts = String(p).split('/').filter(Boolean);
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        if (v === null) delete cur[parts[parts.length - 1]];
        else cur[parts[parts.length - 1]] = v;
    }

    const fb = {
        ref: (_db, p) => ({ path: p === undefined ? '' : String(p) }),
        increment: (n) => ({ __increment: n }),
        runTransaction: (r, fn) => {
            const verdict = txPlan[Math.min(calls.length, txPlan.length - 1)];
            calls.push({ path: r.path, verdict: verdict });
            if (verdict === 'reject') return Promise.reject(new Error('network blip'));
            const cur = getPath(r.path);
            const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            if (verdict === 'abort') return Promise.resolve({ committed: false, snapshot: { val: () => getPath(r.path) } });
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => getPath(r.path) } });
            setPath(r.path, next);
            return Promise.resolve({ committed: true, snapshot: { val: () => getPath(r.path) } });
        }
    };

    const ctx = {
        console, Math, JSON, parseFloat, parseInt, isNaN, isFinite, Date, Object, Array, String, Number, Promise, setTimeout,
        fb, db: {},
        dbRefDailyRevenue: options.noDbRef ? null : { path: 'zoew_daily_revenue_cod_dod' },
        dbRefMonthlyRevenue: options.noDbRef ? null : { path: 'zoew_monthly_revenue_cod_dod' },
        dailyRevenueData: {}, monthlyRevenueData: {},
        toasts: [],
        showToast: function (m) { ctx.toasts.push(m); },
        refreshCurrentHistoryView: function () {},
        getServerNow: () => Date.now(),
        __store: store, __calls: calls
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(
        fnSrc.getFormattedDate + '\n'
        + fnSrc.ledgerNumber + '\n'
        + fnSrc.ledgerAppliedDelta + '\n'
        + fnSrc.ledgerDeltaWithClamp + '\n'
        + fnSrc.revertLedgerRecordInMemory + '\n'
        + fnSrc.applyLedgerBucketDelta + '\n'
        + fnSrc.commitRevenueBucketDelta + '\n'
        + fnSrc.ledgerZeroDelta + '\n'
        + fnSrc.ledgerServerVerdict + '\n'
        + fnSrc.ledgerMemoryCompensationClaimed + '\n'
        + fnSrc.revertLedgerBucketOnServer + '\n'
        + fnSrc.revertRevenueLedgerDelta + '\n'
        + fnSrc.correctRevenueLedgerToActual + '\n'
        + fnSrc.addRevenueToDailyAndMonthlyRecord + '\n'
        + fnSrc.commitDailyRevenueDelta + '\n'
        + fnSrc.commitMonthlyRevenueDelta + '\n',
        ctx);
    return ctx;
}

const DATE = '2026-06-05';
const MONTH = DATE.substring(0, 7);
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

// ដាក់ថ្ងៃ និងខែ ឲ្យមានតម្លៃដើមដូចគ្នា ទាំង server ទាំងសតិ
function seed(ctx, cod, dod, count) {
    ctx.__store.zoew_daily_revenue_cod_dod[DATE] = { codDollar: cod, dodDollar: dod, totalCount: count };
    ctx.__store.zoew_monthly_revenue_cod_dod[MONTH] = { codDollar: cod, dodDollar: dod, totalCount: count };
    ctx.dailyRevenueData[DATE] = { codDollar: cod, dodDollar: dod, totalCount: count };
    ctx.monthlyRevenueData[MONTH] = { codDollar: cod, dodDollar: dod, totalCount: count };
}
const dailyServer = (ctx) => ctx.__store.zoew_daily_revenue_cod_dod[DATE] || null;
const monthlyServer = (ctx) => (ctx.__store.zoew_monthly_revenue_cod_dod || {})[MONTH] || null;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
    // ── ១. ⛔ ទិសផ្ទុយ ៖ ការអនុវត្តជោគជ័យ ➜ ការដកវិញនៅតែត្រូវដើរពេញលេញ ────
    console.log('\n=== ១. ⛔ ទិសផ្ទុយ ៖ អនុវត្តជោគជ័យ ➜ ដកវិញត្រូវត្រឡប់មកតម្លៃដើម ===');
    {
        const ctx = makeSandbox(['ok']);
        seed(ctx, 10, 0, 2);
        const applied = vm.runInContext('addRevenueToDailyAndMonthlyRecord', ctx)(DATE, -4, 0, -1);
        await settle();
        ok('អនុវត្ត ៖ server ចុះមក $6.00', same(dailyServer(ctx), { codDollar: 6, dodDollar: 0, totalCount: 1 }), dailyServer(ctx));
        vm.runInContext('revertRevenueLedgerDelta', ctx)(applied);
        await settle();
        ok('ដកវិញ ៖ server ត្រឡប់មក $10.00 · ២ កញ្ចប់ ពិតប្រាកដ',
            same(dailyServer(ctx), { codDollar: 10, dodDollar: 0, totalCount: 2 }), dailyServer(ctx));
        ok('ដកវិញ ៖ សតិត្រឡប់មក $10.00 · ២ កញ្ចប់ ពិតប្រាកដ',
            same(ctx.dailyRevenueData[DATE], { codDollar: 10, dodDollar: 0, totalCount: 2 }), ctx.dailyRevenueData[DATE]);
        ok('ដកវិញ ៖ ខែក៏ត្រឡប់មកតម្លៃដើមដែរ',
            same(monthlyServer(ctx), { codDollar: 10, dodDollar: 0, totalCount: 2 }), monthlyServer(ctx));
    }

    // ── ២. 🔴 ការអនុវត្ត **បដិសេធ** ➜ បណ្តាញត្រឡប់មក ➜ ការដកវិញជោគជ័យ ────
    console.log('\n=== ២. 🔴 អនុវត្តបដិសេធ (បណ្តាញដាច់មួយភ្លែត) ➜ ដកវិញជោគជ័យ ===');
    {
        // ការហៅ ២ ដំបូង = ថ្ងៃ + ខែ របស់ការអនុវត្ត ➜ បដិសេធទាំង ២
        // ការហៅបន្ទាប់ (ការដកវិញ) = ជោគជ័យ ព្រោះបណ្តាញត្រឡប់មកវិញ
        const ctx = makeSandbox(['reject', 'reject', 'ok']);
        seed(ctx, 10, 0, 2);
        const applied = vm.runInContext('addRevenueToDailyAndMonthlyRecord', ctx)(DATE, -4, 0, -1);
        await settle();
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ការអនុវត្តពិតជាមិនចុះដល់ server',
            same(dailyServer(ctx), { codDollar: 10, dodDollar: 0, totalCount: 2 }), dailyServer(ctx));
        vm.runInContext('revertRevenueLedgerDelta', ctx)(applied);
        await settle();
        ok('⛔ server មិនត្រូវប្រែសោះ — គ្មានអ្វីត្រូវដកវិញ (ថ្ងៃ)',
            same(dailyServer(ctx), { codDollar: 10, dodDollar: 0, totalCount: 2 }), dailyServer(ctx));
        ok('⛔ server មិនត្រូវប្រែសោះ — គ្មានអ្វីត្រូវដកវិញ (ខែ)',
            same(monthlyServer(ctx), { codDollar: 10, dodDollar: 0, totalCount: 2 }), monthlyServer(ctx));
        ok('⛔ សតិត្រូវស៊ីនឹង server (ការដកវិញក្នុងសតិមិនត្រូវរត់ទ្វេដង)',
            same(ctx.dailyRevenueData[DATE], { codDollar: 10, dodDollar: 0, totalCount: 2 }), ctx.dailyRevenueData[DATE]);
    }

    // ── ៣. 🔴 ការអនុវត្ត `committed: false` ➜ ការដកវិញជោគជ័យ ─────────────
    console.log('\n=== ៣. 🔴 អនុវត្ត committed:false ➜ ដកវិញជោគជ័យ ===');
    {
        const ctx = makeSandbox(['abort', 'abort', 'ok']);
        seed(ctx, 10, 0, 2);
        const applied = vm.runInContext('addRevenueToDailyAndMonthlyRecord', ctx)(DATE, -4, 0, -1);
        await settle();
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ការអនុវត្តពិតជាមិនចុះដល់ server',
            same(dailyServer(ctx), { codDollar: 10, dodDollar: 0, totalCount: 2 }), dailyServer(ctx));
        vm.runInContext('revertRevenueLedgerDelta', ctx)(applied);
        await settle();
        ok('⛔ server មិនត្រូវប្រែសោះ (ថ្ងៃ)',
            same(dailyServer(ctx), { codDollar: 10, dodDollar: 0, totalCount: 2 }), dailyServer(ctx));
        ok('⛔ server មិនត្រូវប្រែសោះ (ខែ)',
            same(monthlyServer(ctx), { codDollar: 10, dodDollar: 0, totalCount: 2 }), monthlyServer(ctx));
    }

    // ── ៤. ការដកវិញក្នុងសតិត្រូវ idempotent (ទាំង ២ លំដាប់) ──────────────
    console.log('\n=== ៤. ការដកវិញក្នុងសតិត្រូវរត់តែម្តង (ទាំង ២ លំដាប់) ===');
    {
        // លំដាប់ ក ៖ commit បដិសេធមុន (catch ដកសតិវិញ) ➜ ទើបអ្នកហៅដកវិញ
        const ctx = makeSandbox(['reject']);
        seed(ctx, 10, 0, 2);
        const applied = vm.runInContext('addRevenueToDailyAndMonthlyRecord', ctx)(DATE, -4, 0, -1);
        await settle();
        vm.runInContext('revertRevenueLedgerDelta', ctx)(applied);
        await settle();
        ok('លំដាប់ ក ៖ catch មុន ➜ ដកវិញក្រោយ ➜ សតិ = $10.00 · ២',
            same(ctx.dailyRevenueData[DATE], { codDollar: 10, dodDollar: 0, totalCount: 2 }), ctx.dailyRevenueData[DATE]);
        ok('លំដាប់ ក ៖ ខែក៏ = $10.00 · ២ ដែរ',
            same(ctx.monthlyRevenueData[MONTH], { codDollar: 10, dodDollar: 0, totalCount: 2 }), ctx.monthlyRevenueData[MONTH]);
    }
    {
        // លំដាប់ ខ ៖ អ្នកហៅដកវិញ **មុន** promise របស់ commit ដោះ
        const ctx = makeSandbox(['reject']);
        seed(ctx, 10, 0, 2);
        const applied = vm.runInContext('addRevenueToDailyAndMonthlyRecord', ctx)(DATE, -4, 0, -1);
        vm.runInContext('revertRevenueLedgerDelta', ctx)(applied);
        await settle();
        ok('លំដាប់ ខ ៖ ដកវិញមុន ➜ catch ក្រោយ ➜ សតិ = $10.00 · ២',
            same(ctx.dailyRevenueData[DATE], { codDollar: 10, dodDollar: 0, totalCount: 2 }), ctx.dailyRevenueData[DATE]);
        ok('លំដាប់ ខ ៖ ខែក៏ = $10.00 · ២ ដែរ',
            same(ctx.monthlyRevenueData[MONTH], { codDollar: 10, dodDollar: 0, totalCount: 2 }), ctx.monthlyRevenueData[MONTH]);
    }

    // ── ៥. ⛔ ករណីគ្មាន dbRef ៖ គ្មាន server សោះ ➜ សតិត្រូវនៅតែដកវិញ ─────
    console.log('\n=== ៥. ⛔ គ្មាន dbRef (មិនទាន់ភ្ជាប់ Firebase) ➜ សតិត្រូវដកវិញដដែល ===');
    {
        const ctx = makeSandbox(['ok'], { noDbRef: true });
        seed(ctx, 10, 0, 2);
        const applied = vm.runInContext('addRevenueToDailyAndMonthlyRecord', ctx)(DATE, -4, 0, -1);
        await settle();
        ok('លក្ខខណ្ឌចាំបាច់ ៖ សតិចុះមក $6.00 (គ្មាន server)',
            same(ctx.dailyRevenueData[DATE], { codDollar: 6, dodDollar: 0, totalCount: 1 }), ctx.dailyRevenueData[DATE]);
        vm.runInContext('revertRevenueLedgerDelta', ctx)(applied);
        await settle();
        ok('សតិត្រឡប់មក $10.00 · ២ ពិតប្រាកដ',
            same(ctx.dailyRevenueData[DATE], { codDollar: 10, dodDollar: 0, totalCount: 2 }), ctx.dailyRevenueData[DATE]);
        ok('គ្មានការហៅ transaction សោះ (dbRef ទទេ)', ctx.__calls.length === 0, ctx.__calls);
    }

    // ── ៦. ការដកវិញឆ្លងព្រំដែន 0 នៅតែជាគូបញ្ច្រាស (ការការពារចាស់) ────────
    console.log('\n=== ៦. ⛔ ទិសផ្ទុយ ៖ ការ clamp ឆ្លងព្រំដែន 0 នៅតែជាគូបញ្ច្រាស ===');
    {
        const ctx = makeSandbox(['ok']);
        seed(ctx, 3.25, 0, 1);
        const applied = vm.runInContext('addRevenueToDailyAndMonthlyRecord', ctx)(DATE, -4, 0, -1);
        await settle();
        ok('អនុវត្ត ៖ clamp ត្រឹម 0', same(dailyServer(ctx), { codDollar: 0, dodDollar: 0, totalCount: 0 }), dailyServer(ctx));
        vm.runInContext('revertRevenueLedgerDelta', ctx)(applied);
        await settle();
        ok('ដកវិញ ៖ ត្រឡប់មក $3.25 មិនមែន $4.00 (គ្មានលុយកើតឡើង)',
            same(dailyServer(ctx), { codDollar: 3.25, dodDollar: 0, totalCount: 1 }), dailyServer(ctx));
    }

    // ── ៧. 🔴 `correctRevenueLedgerToActual()` ក្រោយការអនុវត្តដែលធ្លាក់ ───
    console.log('\n=== ៧. 🔴 ការកែតម្រូវទៅតម្លៃពិត ក្រោយការអនុវត្តដែលមិនចុះដល់ server ===');
    {
        // ផ្លូវកែទឹកប្រាក់ ៖ អនុវត្ត +5 (ធ្លាក់) ➜ transaction ប្រវត្តិជោគជ័យ
        // ➜ តម្លៃពិតរបស់ server ក៏ជា +5 ដែរ ➜ ការកែតម្រូវត្រូវសរសេរ +5 ពេញ
        // (មិនមែន 0 ដោយសន្មតថាការអនុវត្តបានចុះរួច)។
        const ctx = makeSandbox(['reject', 'reject', 'ok']);
        seed(ctx, 10, 0, 2);
        const applied = vm.runInContext('addRevenueToDailyAndMonthlyRecord', ctx)(DATE, 5, 0, 0);
        await settle();
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ការអនុវត្តមិនចុះដល់ server',
            same(dailyServer(ctx), { codDollar: 10, dodDollar: 0, totalCount: 2 }), dailyServer(ctx));
        vm.runInContext('correctRevenueLedgerToActual', ctx)(DATE, applied, 5, 0, 0);
        await settle();
        ok('⛔ server ត្រូវឈានដល់ $15.00 (តម្លៃពិត) មិនមែននៅ $10.00',
            same(dailyServer(ctx), { codDollar: 15, dodDollar: 0, totalCount: 2 }), dailyServer(ctx));
    }

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail : '✅ គ្មានបញ្ហា') + ' — ok ' + pass);
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.log('  FAIL   តេស្តគាំង ➜ ' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
