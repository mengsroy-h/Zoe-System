// ⛔ ថ្នាក់កំហុស៖ **ledger ខែ ឃ្លាតពីផលបូក ledger ថ្ងៃ ➜ អេក្រង់ 📊 ស្ថិតិ ៣ ខែ
//         បង្ហាញលេខខុស ជារៀងរហូត ដោយគ្មានផ្លូវជួសជុល។**
//
// 🔴 **កំហុសលុយពិត** (វាស់ 2026-09-06)។ រាល់ផ្លូវលុយសរសេរ **ពីរ** ledger
// ដោយ delta **ដដែល** តែ **ដាច់ដោយឡែកពីគ្នា** ៖
//
//   addRevenueToDailyAndMonthlyRecord(d, -25, 0, -2)
//     ➜ commitDailyRevenueDelta('2026-09-01', -25, ...)   ← clamp ក្នុង *ថ្ងៃ*
//     ➜ commitMonthlyRevenueDelta('2026-09',  -25, ...)   ← clamp ក្នុង *ខែ*
//
// `ledgerDeltaWithClamp()` clamp ត្រឹម 0 **ក្នុងមួយធុង** (rules ពិតបដិសេធ
// លេខអវិជ្ជមាន)។ ⛔ តែធុងទាំង ២ **មិនមានទំហំដូចគ្នា** ៖ ខែធំជាងថ្ងៃជានិច្ច។
// ដូច្នេះការដកដែលធំជាង ledger *របស់ថ្ងៃ* ត្រូវ clamp ខាងថ្ងៃ តែ **មិន**
// clamp ខាងខែ ➜ ledger ទាំង ២ ឃ្លាតគ្នា **ជាអចិន្ត្រៃយ៍**។
//
// លំដាប់ដែលវាស់បាន ៖
//
//   | ជំហាន | ថ្ងៃ 09-01 | ថ្ងៃ 09-02 | ខែ 2026-09 |
//   |---|---|---|---|
//   | មុន | $10 / ១ | $40 / ៣ | $50 / ៤ |
//   | ដក $25 · ២ កញ្ចប់ ពីថ្ងៃ 09-01 | clamp ➜ **$0 / ០** | $40 / ៣ | **$25 / ២** |
//   | ផលបូកតាមថ្ងៃ | | | **$40 / ៣** |
//
// ➜ 📊 ស្ថិតិ ៣ ខែ បង្ហាញ **$25** ខណៈរបាយការណ៍ខែ (ដេរីវេពីថ្ងៃ) បង្ហាញ **$40**។
//
// ⚠️ **ហេតុអ្វី checker ១៣៦ បៃតងទាំងអស់** ៖ `revenue-fuzz-test.js` វាស់
// invariant ធៀបនឹង **`zoew_daily_revenue_cod_dod` តែម្យ៉ាង** (បន្ទាត់
// `const rev = (s.zoew_daily_revenue_cod_dod || {})[dateKey]`) ។ គ្មានឯកសារ
// ណាមួយក្នុង `audit-tools/` អះអាងថា **ខែ ត្រូវនឹងផលបូកនៃថ្ងៃ** សោះ —
// វាស់បាន ៖ `grep -l 'daily.*===.*monthly' audit-tools/*.js` ➜ **គ្មាន**។
// នេះជា **សំណួរទី ៧** របស់ `CLAUDE.md` («តើមានឧបករណ៍ណាឃើញ *ស្នាមភ្ជាប់*
// រវាងឯកសារ ២ ទេ?») អនុវត្តលើ node ២ ៖ ខាងថ្ងៃចាក់សោ · ខាងខែចាក់សោ ·
// តែគ្មាននរណាសួរថាពួកវានិយាយពីរឿងដដែលឬអត់។
//
// ⛔ ជាន់ទី ២ នៃថ្នាក់ដដែល ៖ **ការសរសេរដែលធ្លាក់ខាងម្ខាង**។ ថ្ងៃត្រូវបដិសេធ
// ខណៈខែជោគជ័យ (ឬផ្ទុយ) ➜ ឃ្លាតដដែល ដោយគ្មានផ្លូវជួសជុល។
//
// ⛔ ជាន់ទី ៣ ៖ **`commitMonthlyRevenueDelta()` កាត់ node ត្រឹម ៣ ខែ**
// (`Object.keys(months).sort().reverse().slice(0, 3)`) តែសាលក្រមដែលវាត្រឡប់
// គណនាពី `serverAfter` **មុនការកាត់** ➜ ខែដែលត្រូវកាត់ចោល នៅតែរាយការណ៍ថា
// «អនុវត្តរួច»។ សាលក្រមត្រូវអានចេញពី **អ្វីដែល server រក្សាទុកពិត**។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ៖
//   ១. ក្រោយរាល់ផ្លូវលុយ ៖ `monthly[M] === Σ daily[d ∈ M]` លើ **server**។
//   ២. ការ clamp ខាងថ្ងៃ ត្រូវទាញឲ្យខែតាមដោយស្វ័យប្រវត្តិ (មិនមែនឲ្យខែ
//      ដកលើសអ្វីដែលថ្ងៃដកបាន)។
//   ៣. សាលក្រម `monthlyServer` ត្រូវជា delta **សុទ្ធ** ដែលចុះដល់ server
//      ➜ ការដកវិញក្រោយ clamp ត្រូវត្រឡប់ ledger ទាំង ២ មកតម្លៃដើម **ពិតប្រាកដ**។
//   ៤. ⛔ **ទិសផ្ទុយ** ៖ ផ្លូវធម្មតា (គ្មាន clamp) ត្រូវ **មិនបន្ថែម**
//      ការសរសេរណាមួយ — ការកែមិនត្រូវបង់ថ្លៃលើផ្លូវក្តៅ។
//   ៥. សាលក្រមរបស់ខែដែលត្រូវកាត់ចេញ ត្រូវជា `0` មិនមែន delta ដែលស្នើ។
//   ៦. `correctRevenueLedgerToActual()` ត្រូវរក្សាអថេរដដែល។
//   ៧. ការស្តារ (`appendRestoreRevenueIncrements`) ត្រូវបូកជាលេខ ២ ខ្ទង់ —
//      ⛔ ការបូក float ឆៅចាក់ `0.30000000000000004` ចូល ledger។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.MONTHLYAGREE_APP_DIR || path.join(__dirname, '..');
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

console.log('\n=== ០. ជាន់អប្បបរមា (checker នេះត្រូវអាចធ្លាក់បាន) ===');
ok('ZoeW/app.js មិនទទេ (>= 4000 បន្ទាត់)', SRC.split('\n').length >= 4000, SRC.split('\n').length);

const REQUIRED_FNS = [
    'ledgerNumber', 'ledgerAppliedDelta', 'ledgerDeltaWithClamp', 'revertLedgerRecordInMemory',
    'applyLedgerBucketDelta', 'commitRevenueBucketDelta', 'ledgerZeroDelta', 'ledgerServerVerdict',
    'ledgerMemoryCompensationClaimed', 'revertLedgerBucketOnServer', 'revertRevenueLedgerDelta',
    'correctRevenueLedgerToActual', 'addRevenueToDailyAndMonthlyRecord',
    'commitDailyRevenueDelta', 'commitMonthlyRevenueDelta', 'appendRestoreRevenueIncrements',
    'getFormattedDate'
];
const fnSrc = {};
const missing = [];
for (const n of REQUIRED_FNS) {
    const s = sliceFn(n);
    if (s) fnSrc[n] = s; else missing.push(n);
}
// ⛔ កុំបញ្ឈប់ពេលរកឈ្មោះមិនឃើញ — stub ជំនួស
ok('រក function ចាំបាច់ទាំង ' + REQUIRED_FNS.length + ' ឃើញ', missing.length === 0, missing);
for (const n of missing) fnSrc[n] = 'function ' + n + '() { return null; }';

const ALIGN = sliceFn('alignMonthlyLedgerToDaily');
if (ALIGN) fnSrc.alignMonthlyLedgerToDaily = ALIGN;

// ── sandbox ៖ server ក្លែងដែលអនុវត្ត rule ពិត «លេខអវិជ្ជមាន ➜ បដិសេធ» ─────
function makeSandbox(opts) {
    const options = opts || {};
    const store = { zoew_daily_revenue_cod_dod: {}, zoew_monthly_revenue_cod_dod: {} };
    const writes = [];

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
    // rules ពិត ៖ codDollar/dodDollar/totalCount ត្រូវ >= 0
    function ruleDenies(node) {
        if (!node || typeof node !== 'object') return false;
        const bad = (rec) => rec && typeof rec === 'object'
            && (['codDollar', 'dodDollar', 'totalCount'].some((f) => typeof rec[f] === 'number' && rec[f] < 0));
        if (bad(node)) return true;
        return Object.keys(node).some((k) => bad(node[k]));
    }

    const fb = {
        ref: (_db, p) => ({ path: p === undefined ? '' : String(p) }),
        increment: (n) => ({ __increment: n }),
        runTransaction: (r, fn) => {
            const isDaily = String(r.path).indexOf('zoew_daily_revenue_cod_dod') === 0;
            const deny = isDaily ? options.denyDaily : options.denyMonthly;
            writes.push({ path: r.path, denied: !!deny });
            if (deny === 'reject') return Promise.reject(new Error('permission_denied'));
            const cur = getPath(r.path);
            const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            if (deny === 'abort' || next === undefined) {
                return Promise.resolve({ committed: false, snapshot: { val: () => getPath(r.path) } });
            }
            if (ruleDenies(next)) return Promise.reject(new Error('permission_denied (rules)'));
            setPath(r.path, next);
            return Promise.resolve({ committed: true, snapshot: { val: () => getPath(r.path) } });
        }
    };

    const ctx = {
        console, Math, JSON, parseFloat, parseInt, isNaN, isFinite, Date, Object, Array, String, Number, Promise, setTimeout,
        fb, db: {},
        dbRefDailyRevenue: { path: 'zoew_daily_revenue_cod_dod' },
        dbRefMonthlyRevenue: { path: 'zoew_monthly_revenue_cod_dod' },
        dailyRevenueData: {}, monthlyRevenueData: {},
        toasts: [],
        showToast: function (m) { ctx.toasts.push(m); },
        refreshCurrentHistoryView: function () {},
        getServerNow: () => Date.now(),
        __store: store, __writes: writes, __setPath: setPath
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    const order = ['getFormattedDate', 'ledgerNumber', 'ledgerAppliedDelta', 'ledgerDeltaWithClamp',
        'revertLedgerRecordInMemory', 'applyLedgerBucketDelta', 'ledgerZeroDelta', 'ledgerServerVerdict',
        'ledgerMemoryCompensationClaimed', 'commitDailyRevenueDelta', 'commitMonthlyRevenueDelta',
        'alignMonthlyLedgerToDaily', 'commitRevenueBucketDelta', 'revertLedgerBucketOnServer',
        'revertRevenueLedgerDelta', 'correctRevenueLedgerToActual', 'addRevenueToDailyAndMonthlyRecord',
        'appendRestoreRevenueIncrements'];
    vm.runInContext(order.filter((n) => fnSrc[n]).map((n) => fnSrc[n]).join('\n'), ctx);
    return ctx;
}

const M = '2026-09';
const D1 = '2026-09-01';
const D2 = '2026-09-02';

function seed(ctx, days, month) {
    ctx.__store.zoew_daily_revenue_cod_dod = JSON.parse(JSON.stringify(days));
    ctx.__store.zoew_monthly_revenue_cod_dod = JSON.parse(JSON.stringify(month));
    ctx.dailyRevenueData = JSON.parse(JSON.stringify(days));
    ctx.monthlyRevenueData = JSON.parse(JSON.stringify(month));
}

function serverSums(ctx, ym) {
    const days = ctx.__store.zoew_daily_revenue_cod_dod || {};
    const r2 = (n) => Math.round(n * 100) / 100;
    let cod = 0, dod = 0, count = 0;
    Object.keys(days).forEach((k) => {
        if (String(k).substring(0, 7) !== ym) return;
        cod += parseFloat(days[k].codDollar) || 0;
        dod += parseFloat(days[k].dodDollar) || 0;
        count += parseFloat(days[k].totalCount) || 0;
    });
    const mon = (ctx.__store.zoew_monthly_revenue_cod_dod || {})[ym] || { codDollar: 0, dodDollar: 0, totalCount: 0 };
    return {
        sum: { cod: r2(cod), dod: r2(dod), count: count },
        month: { cod: r2(parseFloat(mon.codDollar) || 0), dod: r2(parseFloat(mon.dodDollar) || 0), count: parseFloat(mon.totalCount) || 0 }
    };
}

function agrees(v) {
    return v.sum.cod === v.month.cod && v.sum.dod === v.month.dod && v.sum.count === v.month.count;
}

async function scenario(name, fn) {
    console.log('\n=== ' + name + ' ===');
    try { await fn(); }
    catch (e) { ok(name + ' រត់ដល់ចប់', false, (e && e.stack) || String(e)); }
}

(async function run() {
    // ── ១. clamp ខាងថ្ងៃ ➜ ខែត្រូវតាម ────────────────────────────────────
    await scenario('១. ការដកធំជាង ledger របស់ថ្ងៃ ➜ clamp ➜ ខែត្រូវនៅស៊ីនឹងផលបូកថ្ងៃ', async () => {
        const ctx = makeSandbox({});
        seed(ctx,
            { [D1]: { codDollar: 10, dodDollar: 0, totalCount: 1 }, [D2]: { codDollar: 40, dodDollar: 0, totalCount: 3 } },
            { [M]: { codDollar: 50, dodDollar: 0, totalCount: 4 } });
        const applied = ctx.addRevenueToDailyAndMonthlyRecord(D1, -25, 0, -2);
        await Promise.all([applied.dailyServer, applied.monthlyServer]);
        const v = serverSums(ctx, M);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ថ្ងៃ ' + D1 + ' ត្រូវ clamp ដល់ 0',
            (ctx.__store.zoew_daily_revenue_cod_dod[D1] || {}).codDollar === 0,
            ctx.__store.zoew_daily_revenue_cod_dod);
        ok('ខែ === ផលបូកថ្ងៃ ក្រោយ clamp', agrees(v), v);
    });

    // ── ២. ការដកវិញក្រោយ clamp ➜ ត្រឡប់មកតម្លៃដើមពិតប្រាកដ ──────────────
    await scenario('២. ដកវិញក្រោយ clamp ➜ ledger ទាំង ២ ត្រឡប់មកតម្លៃដើម', async () => {
        const ctx = makeSandbox({});
        const days0 = { [D1]: { codDollar: 10, dodDollar: 0, totalCount: 1 }, [D2]: { codDollar: 40, dodDollar: 0, totalCount: 3 } };
        const mon0 = { [M]: { codDollar: 50, dodDollar: 0, totalCount: 4 } };
        seed(ctx, days0, mon0);
        const applied = ctx.addRevenueToDailyAndMonthlyRecord(D1, -25, 0, -2);
        await Promise.all([applied.dailyServer, applied.monthlyServer]);
        ctx.revertRevenueLedgerDelta(applied);
        await new Promise((r) => setTimeout(r, 30));
        const v = serverSums(ctx, M);
        ok('ខែ === ផលបូកថ្ងៃ ក្រោយដកវិញ', agrees(v), v);
        ok('ថ្ងៃ ' + D1 + ' ត្រឡប់មក $10 វិញ',
            (ctx.__store.zoew_daily_revenue_cod_dod[D1] || {}).codDollar === 10,
            ctx.__store.zoew_daily_revenue_cod_dod);
        ok('ខែត្រឡប់មក $50 វិញ',
            (ctx.__store.zoew_monthly_revenue_cod_dod[M] || {}).codDollar === 50,
            ctx.__store.zoew_monthly_revenue_cod_dod);
    });

    // ── ៣. ការសរសេរខាងថ្ងៃធ្លាក់ ខណៈខែជោគជ័យ ─────────────────────────────
    await scenario('៣. ការសរសេរថ្ងៃត្រូវបដិសេធ ខណៈខែជោគជ័យ ➜ ខែមិនត្រូវឃ្លាត', async () => {
        const ctx = makeSandbox({ denyDaily: 'reject' });
        seed(ctx,
            { [D1]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
            { [M]: { codDollar: 10, dodDollar: 0, totalCount: 1 } });
        const applied = ctx.addRevenueToDailyAndMonthlyRecord(D1, -5, 0, -1);
        await Promise.all([applied.dailyServer.catch(() => null), applied.monthlyServer.catch(() => null)]);
        await new Promise((r) => setTimeout(r, 30));
        const v = serverSums(ctx, M);
        ok('ខែ === ផលបូកថ្ងៃ ពេលការសរសេរថ្ងៃធ្លាក់', agrees(v), v);
    });

    // ── ៤. ⛔ ទិសផ្ទុយ ៖ ផ្លូវធម្មតាត្រូវមិនបង់ថ្លៃការសរសេរបន្ថែម ─────────
    await scenario('៤. ⛔ ទិសផ្ទុយ ៖ ផ្លូវធម្មតា (គ្មាន clamp) ត្រូវនៅដដែល', async () => {
        const ctx = makeSandbox({});
        seed(ctx,
            { [D1]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
            { [M]: { codDollar: 10, dodDollar: 0, totalCount: 1 } });
        const applied = ctx.addRevenueToDailyAndMonthlyRecord(D1, 7.5, 2.5, 1);
        await Promise.all([applied.dailyServer, applied.monthlyServer]);
        const v = serverSums(ctx, M);
        ok('ខែ === ផលបូកថ្ងៃ លើផ្លូវធម្មតា', agrees(v), v);
        ok('ថ្ងៃឡើងដល់ $17.50 ពិតប្រាកដ',
            (ctx.__store.zoew_daily_revenue_cod_dod[D1] || {}).codDollar === 17.5,
            ctx.__store.zoew_daily_revenue_cod_dod);
        ok('ផ្លូវធម្មតាសរសេរត្រឹម ២ ដង (ថ្ងៃ ១ · ខែ ១) — គ្មានការសរសេរបន្ថែម',
            ctx.__writes.length === 2, ctx.__writes);
    });

    // ── ៥. សាលក្រមរបស់ខែដែលត្រូវកាត់ចេញ ត្រូវជា 0 ─────────────────────────
    await scenario('៥. ខែដែល node កាត់ចោល ➜ សាលក្រមត្រូវជា 0 មិនមែន delta ដែលស្នើ', async () => {
        const ctx = makeSandbox({});
        seed(ctx, {}, {
            '2026-12': { codDollar: 1, dodDollar: 0, totalCount: 1 },
            '2026-11': { codDollar: 1, dodDollar: 0, totalCount: 1 },
            '2026-10': { codDollar: 1, dodDollar: 0, totalCount: 1 }
        });
        const verdict = await ctx.commitMonthlyRevenueDelta('2026-06', 25, 0, 1, { cod: 25, dod: 0, count: 1 });
        const stored = ctx.__store.zoew_monthly_revenue_cod_dod['2026-06'];
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ខែ 2026-06 ពិតជាត្រូវកាត់ចេញពី node', !stored,
            Object.keys(ctx.__store.zoew_monthly_revenue_cod_dod));
        ok('សាលក្រមត្រូវជា 0 (server មិនបានរក្សាទុកអ្វី)',
            !!verdict && verdict.cod === 0 && verdict.dod === 0 && verdict.count === 0, verdict);
    });

    // ── ៦. correctRevenueLedgerToActual ត្រូវរក្សាអថេរដដែល ────────────────
    await scenario('៦. correctRevenueLedgerToActual ក្រោយ clamp ➜ ខែនៅស៊ីនឹងផលបូកថ្ងៃ', async () => {
        const ctx = makeSandbox({});
        seed(ctx,
            { [D1]: { codDollar: 2, dodDollar: 0, totalCount: 1 }, [D2]: { codDollar: 60, dodDollar: 0, totalCount: 4 } },
            { [M]: { codDollar: 62, dodDollar: 0, totalCount: 5 } });
        const applied = ctx.addRevenueToDailyAndMonthlyRecord(D1, -9, 0, 0);
        await Promise.all([applied.dailyServer, applied.monthlyServer]);
        ctx.correctRevenueLedgerToActual(D1, applied, -9, 0, 0);
        await new Promise((r) => setTimeout(r, 60));
        const v = serverSums(ctx, M);
        ok('ខែ === ផលបូកថ្ងៃ ក្រោយការកែតម្រូវ', agrees(v), v);
    });

    // ── ៧. ការស្តារ ៖ ការបូក float ឆៅមិនត្រូវចាក់ចូល ledger ───────────────
    await scenario('៧. ការស្តារត្រូវបូកជាលេខ ២ ខ្ទង់ (មិនមែន float ឆៅ)', async () => {
        const ctx = makeSandbox({});
        const cases = [
            { parts: [0.1, 0.2], want: 0.3 },
            { parts: [1.1, 2.2], want: 3.3 },
            { parts: [10.1, 20.2, 30.3], want: 60.6 },
            { parts: [0.07, 0.07, 0.07], want: 0.21 }
        ];
        cases.forEach((c) => {
            const updates = {};
            ctx.appendRestoreRevenueIncrements(updates, c.parts.map((x) => ({ scanDate: D1, cod: x, dod: 0, count: 1 })));
            const got = (updates['zoew_daily_revenue_cod_dod/' + D1 + '/codDollar'] || {}).__increment;
            ok('ការស្តារ ' + JSON.stringify(c.parts) + ' ➜ ' + c.want, got === c.want, got);
        });
    });

    console.log('\n' + (fail === 0
        ? '✅ បៃតង — ' + pass + ' ការអះអាង'
        : '❌ ធ្លាក់ ' + fail + ' / ជោគជ័យ ' + pass));
    process.exit(fail === 0 ? 0 : 1);
})();
