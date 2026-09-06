// ⛔ ថ្នាក់កំហុស៖ **App សរសេរតម្លៃដែល Firebase rules ពិត បដិសេធ។**
//
// `firebase-database.rules.json` ទាមទារ `newData.val() >= 0` លើ
// `zoew_daily_revenue_cod_dod/$date/{codDollar,dodDollar,totalCount}` ·
// `zoew_monthly_revenue_cod_dod/$month/…` និង
// `zoew_daily_pickup_cod_dod/$date/packagesPickedUp` (និង `> 0` លើ
// `pickedUpPhones/$phoneKey`)។
//
// ដូច្នេះ transaction ដែលគណនាលេខ **អវិជ្ជមាន** រួចត្រឡប់វា ➜ server
// បដិសេធ (`permission_denied`) ➜ `.catch()` ដើរផ្លូវ **revert** ➜ វាដក
// delta ចេញពីតម្លៃក្នុងសតិដែល **ត្រូវ clamp ជា 0 រួចហើយ** ➜ លទ្ធផល៖
// លេខក្នុងសតិ **ឡើងខ្ពស់ជាងមុន** ជំនួសការធ្លាក់ចុះ។
//
// វាស់បានលើ `origin/main` (2026-09-02)៖ ថ្ងៃមាន $50 ➜ អ្នកប្រើកែដោយដៃ
// `-100` ➜ សតិបង្ហាញ **$100** · server នៅ **$50** · monthly ជា **0**
// (ព្រោះ monthly *clamp*) ➜ ការបង្ហាញលុយបែកគ្នាទាំង ៣ កន្លែង។
//
// ⛔ **មូលហេតុដែល checker ១២៣ បៃតងទាំងអស់** ៖ fake SDK របស់ពួកវាទាំងអស់
// ទទួលយកការសរសេរ **ណាមួយ** — គ្មានមួយណាអនុវត្ត `.validate` សោះ។ នេះជា
// **សំណួរទី ៩** («តើ checker ដាក់ dependency ក្នុង *របៀបបរាជ័យ* ណា?»)
// ក្នុងទម្រង់ថ្មី៖ របៀបបរាជ័យ «server បដិសេធការសរសេរ» មិនដែលត្រូវសាកសោះ។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ៖
//   ១. ព្រំដែនត្រូវអានចេញពី **rules ពិត** មិនមែន literal ក្នុង checker
//      (បើមិនដូច្នេះ ការប្តូរ rules ធ្វើឲ្យ checker ចាក់សោការសន្មតចាស់)។
//   ២. ការធ្លាក់ចុះលើសសមតុល្យ ➜ **គ្មានការបដិសេធ** · សតិ == server · ទាំង ២ ជា 0។
//   ៣. ⛔ **ទិសផ្ទុយ** ៖ ការធ្លាក់ចុះធម្មតា ➜ តម្លៃពិតប្រាកដ គ្មានការ clamp មុនពេល។
//   ៤. គ្មានវាលដែល `$other: false` បដិសេធ ធ្លាក់ចូល node ស្ថិតិ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.REVCLAMP_APP_DIR || path.join(__dirname, '..');
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

let RULES = null;
try {
    RULES = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8')).rules;
} catch (e) {
    console.log('  FAIL   អាន firebase-database.rules.json មិនបាន ➜ ' + e.message);
    console.log('\n❌ ធ្លាក់ — rules ជាប្រភពការពិតរបស់តេស្តនេះ');
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
    'applyLedgerBucketDelta', 'commitRevenueBucketDelta',
    'ledgerZeroDelta', 'ledgerServerVerdict', 'ledgerMemoryCompensationClaimed', 'alignMonthlyLedgerToDaily', 'revertLedgerBucketOnServer', 'revertRevenueLedgerDelta', 'correctRevenueLedgerToActual',
    'addRevenueToDailyAndMonthlyRecord', 'commitDailyRevenueDelta', 'commitMonthlyRevenueDelta',
    'barcodeRegistryKey', 'pickupBarcodeKey', 'pickupSetSize', 'tallyPickupPhones',
    'legacyPickupPlaceholders', 'pickupSetFromRecord', 'buildPickupRecordFromSet', 'applyPickupMarksToSet',
    'applyPickupMarksInMemory', 'commitPickupMarks', 'markPickupBarcodes', 'revertPickupMarks', 'reapplyPickupMarks', 'getFormattedDate'
];
const fnSrc = {};
const missing = [];
for (const n of REQUIRED_FNS) {
    const s = sliceFn(n);
    if (s) fnSrc[n] = s; else missing.push(n);
}
ok('រក function ចាំបាច់ទាំង ' + REQUIRED_FNS.length + ' ឃើញ', missing.length === 0, missing);
for (const n of missing) fnSrc[n] = 'function ' + n + '() {}';

// ── ១. ព្រំដែនត្រូវអានចេញពី rules ពិត ─────────────────────────────────
console.log('\n=== ១. ព្រំដែនអានចេញពី rules ពិត (មិនមែន literal ក្នុង checker) ===');

// បម្លែង `.validate` ដែលជាទម្រង់ `newData.isNumber() && newData.val() >= N`
// ទៅជាមុខងារពិនិត្យ។ ⛔ ការមិនស្គាល់ទម្រង់ជា **ការធ្លាក់** មិនមែនការរំលងទេ។
function numericBound(node, label) {
    const raw = node && node['.validate'];
    if (typeof raw !== 'string') return { ok: false, why: 'គ្មាន .validate' };
    const m = /newData\.isNumber\(\)\s*&&\s*newData\.val\(\)\s*(>=|>)\s*(-?[0-9.]+)/.exec(raw);
    if (!m) return { ok: false, why: 'ទម្រង់មិនស្គាល់៖ ' + raw };
    return { ok: true, op: m[1], limit: parseFloat(m[2]), label };
}

const LEDGER_BOUNDS = [
    ['zoew_daily_revenue_cod_dod', '$date', 'codDollar'],
    ['zoew_daily_revenue_cod_dod', '$date', 'dodDollar'],
    ['zoew_daily_revenue_cod_dod', '$date', 'totalCount'],
    ['zoew_monthly_revenue_cod_dod', '$month', 'codDollar'],
    ['zoew_monthly_revenue_cod_dod', '$month', 'dodDollar'],
    ['zoew_monthly_revenue_cod_dod', '$month', 'totalCount'],
    ['zoew_daily_pickup_cod_dod', '$date', 'packagesPickedUp']
].map((p) => {
    let node = RULES;
    for (const seg of p) node = node && node[seg];
    return Object.assign(numericBound(node, p.join('/')), { path: p });
});

const badBounds = LEDGER_BOUNDS.filter((b) => !b.ok);
ok('rules ប្រកាសព្រំដែនលេខលើ node ស្ថិតិទាំង ' + LEDGER_BOUNDS.length,
    badBounds.length === 0, badBounds.map((b) => b.path.join('/') + ': ' + b.why));
ok('ព្រំដែនទាំងអស់ជា `>= 0` (បើប្តូរ ➜ តេស្តនេះត្រូវសរសេរឡើងវិញ)',
    LEDGER_BOUNDS.every((b) => b.ok && b.op === '>=' && b.limit === 0),
    LEDGER_BOUNDS.map((b) => b.path.join('/') + ' ' + b.op + ' ' + b.limit));

const phoneBound = numericBound(
    ((RULES.zoew_daily_pickup_cod_dod || {})['$date'] || {}).pickedUpPhones ? RULES.zoew_daily_pickup_cod_dod['$date'].pickedUpPhones['$phoneKey'] : null,
    'pickedUpPhones/$phoneKey');
ok('`pickedUpPhones/$phoneKey` ទាមទារ `> 0` (0 មិនត្រូវសរសេរ — ត្រូវលុប key)',
    phoneBound.ok && phoneBound.op === '>' && phoneBound.limit === 0, phoneBound);

// បញ្ជីវាលដែលអនុញ្ញាត — `$other: false` បដិសេធអ្វីៗផ្សេង
function allowedKeys(node) {
    if (!node) return null;
    return Object.keys(node).filter((k) => !k.startsWith('.') && k !== '$other');
}
const ALLOWED = {
    'zoew_daily_revenue_cod_dod': allowedKeys(RULES.zoew_daily_revenue_cod_dod['$date']),
    'zoew_monthly_revenue_cod_dod': allowedKeys(RULES.zoew_monthly_revenue_cod_dod['$month']),
    'zoew_daily_pickup_cod_dod': allowedKeys(RULES.zoew_daily_pickup_cod_dod['$date'])
};
ok('rules ប្រកាស `$other: false` លើ node ស្ថិតិទាំង ៣',
    RULES.zoew_daily_revenue_cod_dod['$date']['$other']['.validate'] === false
    && RULES.zoew_monthly_revenue_cod_dod['$month']['$other']['.validate'] === false
    && RULES.zoew_daily_pickup_cod_dod['$date']['$other']['.validate'] === false);

// ── ២. sandbox ដែល fake SDK **អនុវត្ត rules ពិត** ─────────────────────
const DENIED = 'PERMISSION_DENIED: Client doesn\'t have permission to access the desired data.';

function makeSandbox(seed) {
    const store = JSON.parse(JSON.stringify(seed || {}));
    const rejected = [];
    const accepted = [];

    function rootOf(pathStr) { return String(pathStr).split('/')[0]; }

    // អនុវត្ត `.validate` ដែល rules ពិតប្រកាស។
    function validateNode(rootKey, value) {
        const allow = ALLOWED[rootKey];
        if (!allow) return null;
        if (value === null || value === undefined) return null;
        if (typeof value !== 'object') return 'តម្លៃមិនមែនវត្ថុ';
        for (const key of Object.keys(value)) {
            if (allow.indexOf(key) === -1) return '$other បដិសេធវាល `' + key + '`';
            const v = value[key];
            if (key === 'pickedUpBarcodes') {
                if (v === null) continue;
                if (typeof v !== 'object') return 'pickedUpBarcodes មិនមែនវត្ថុ';
                for (const bk of Object.keys(v)) {
                    if (typeof v[bk] !== 'string' || !v[bk]) return 'pickedUpBarcodes/' + bk + ' មិនមែនខ្សែអក្សរ';
                    if (v[bk].length > 64) return 'pickedUpBarcodes/' + bk + ' វែងពេក';
                }
                continue;
            }
            if (key === 'pickedUpPhones') {
                if (v === null) continue;
                if (typeof v !== 'object') return 'pickedUpPhones មិនមែនវត្ថុ';
                for (const pk of Object.keys(v)) {
                    if (typeof v[pk] !== 'number' || !isFinite(v[pk])) return 'pickedUpPhones/' + pk + ' មិនមែនលេខ';
                    if (!(v[pk] > 0)) return 'pickedUpPhones/' + pk + ' = ' + v[pk] + ' (ត្រូវ > 0)';
                }
                continue;
            }
            if (typeof v !== 'number' || !isFinite(v)) return key + ' មិនមែនលេខ';
            if (v < 0) return key + ' = ' + v + ' (ត្រូវ >= 0)';
        }
        return null;
    }

    function getPath(p) {
        const parts = String(p).split('/').filter(Boolean);
        let cur = store;
        for (const seg of parts) {
            if (cur === null || cur === undefined || typeof cur !== 'object') return null;
            cur = cur[seg];
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

    const failWith = { reason: '' };
    const fb = {
        ref: (_db, p) => ({ path: p === undefined ? '' : String(p) }),
        increment: (n) => ({ __increment: n }),
        runTransaction: (r, fn) => {
            if (failWith.reason) {
                rejected.push({ path: r.path, why: failWith.reason });
                return Promise.reject(new Error(failWith.reason));
            }
            const cur = getPath(r.path);
            const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => getPath(r.path) } });
            const rootKey = rootOf(r.path);
            // node កម្រិតលើ (monthly) ➜ ពិនិត្យកូននីមួយៗ
            let why = null;
            if (String(r.path).indexOf('/') === -1 && ALLOWED[rootKey] && next && typeof next === 'object') {
                for (const child of Object.keys(next)) {
                    why = validateNode(rootKey, next[child]);
                    if (why) { why = child + ': ' + why; break; }
                }
            } else {
                why = validateNode(rootKey, next);
            }
            if (why) {
                rejected.push({ path: r.path, why: why, value: next });
                return Promise.reject(new Error(DENIED));
            }
            accepted.push({ path: r.path, value: next });
            setPath(r.path, next);
            return Promise.resolve({ committed: true, snapshot: { val: () => getPath(r.path) } });
        }
    };

    const ctx = {
        console, Math, JSON, parseFloat, parseInt, isNaN, isFinite, Date, Object, Array, String, Number, Promise, setTimeout,
        fb, db: {}, window: {},
        dbRefDailyRevenue: { path: 'zoew_daily_revenue_cod_dod' },
        dbRefMonthlyRevenue: { path: 'zoew_monthly_revenue_cod_dod' },
        dbRefDailyPickup: { path: 'zoew_daily_pickup_cod_dod' },
        dailyRevenueData: {}, monthlyRevenueData: {}, dailyPickupData: {},
        toasts: [], refreshes: 0,
        showToast: function (m) { ctx.toasts.push(m); },
        refreshCurrentHistoryView: function () { ctx.refreshes++; },
        getServerNow: () => Date.now(),
        __store: store, __rejected: rejected, __accepted: accepted, __failWith: failWith
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
        + fnSrc.commitMonthlyRevenueDelta + '\n'
        + fnSrc.alignMonthlyLedgerToDaily + '\n'
        + fnSrc.barcodeRegistryKey + '\n'
        + fnSrc.pickupBarcodeKey + '\n'
        + fnSrc.pickupSetSize + '\n'
        + fnSrc.tallyPickupPhones + '\n'
        + fnSrc.legacyPickupPlaceholders + '\n'
        + fnSrc.pickupSetFromRecord + '\n'
        + fnSrc.buildPickupRecordFromSet + '\n'
        + fnSrc.applyPickupMarksToSet + '\n'
        + fnSrc.applyPickupMarksInMemory + '\n'
        + fnSrc.commitPickupMarks + '\n'
        + fnSrc.markPickupBarcodes + '\n'
        + fnSrc.revertPickupMarks + '\n'
        + fnSrc.reapplyPickupMarks + '\n'
        + 'const PICKUP_LEGACY_KEY_PREFIX = "_lg_";\n'
        + 'const PICKUP_PHONE_KEY_MAX = 64;\n'
        + 'function mark(code, phone, closed) { return { key: pickupBarcodeKey(code), phoneKey: phone, closed: closed }; }\n',
        ctx);
    return ctx;
}

const DATE = '2026-06-05';
const MONTH = DATE.substring(0, 7);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

(async () => {
    // ── ២. ការធ្លាក់ចុះលើសសមតុល្យ (underflow) ────────────────────────
    console.log('\n=== ២. ការធ្លាក់ចុះលើសសមតុល្យ ➜ សតិ និង server ត្រូវស៊ីគ្នា ===');
    {
        const ctx = makeSandbox({
            zoew_daily_revenue_cod_dod: { [DATE]: { codDollar: 50, dodDollar: 10, totalCount: 3 } },
            zoew_monthly_revenue_cod_dod: { [MONTH]: { codDollar: 50, dodDollar: 10, totalCount: 3 } }
        });
        ctx.dailyRevenueData[DATE] = { codDollar: 50, dodDollar: 10, totalCount: 3 };
        ctx.monthlyRevenueData[MONTH] = { codDollar: 50, dodDollar: 10, totalCount: 3 };

        vm.runInContext('addRevenueToDailyAndMonthlyRecord("' + DATE + '", -100, -40, -9)', ctx);
        await settle(); await settle(); await settle();

        const srvDay = ctx.__store.zoew_daily_revenue_cod_dod[DATE] || {};
        const srvMon = (ctx.__store.zoew_monthly_revenue_cod_dod || {})[MONTH] || {};
        const memDay = ctx.dailyRevenueData[DATE];
        const memMon = ctx.monthlyRevenueData[MONTH];

        ok('គ្មានការសរសេរណាត្រូវ rules បដិសេធ', ctx.__rejected.length === 0, ctx.__rejected);
        ok('server ថ្ងៃ ៖ codDollar clamp ជា 0 (មិនអវិជ្ជមាន)', srvDay.codDollar === 0, srvDay);
        ok('server ថ្ងៃ ៖ dodDollar clamp ជា 0', srvDay.dodDollar === 0, srvDay);
        ok('server ថ្ងៃ ៖ totalCount clamp ជា 0', srvDay.totalCount === 0, srvDay);
        ok('សតិ ថ្ងៃ == server ថ្ងៃ (គ្មានការបែកគ្នា)',
            memDay.codDollar === srvDay.codDollar && memDay.dodDollar === srvDay.dodDollar && memDay.totalCount === srvDay.totalCount,
            { mem: memDay, srv: srvDay });
        ok('សតិ ថ្ងៃ មិន **ឡើងខ្ពស់ជាងមុន** (កំហុសពិត ៖ 50 ➜ 100)',
            memDay.codDollar <= 50, memDay);
        ok('សតិ ខែ == server ខែ', memMon.codDollar === srvMon.codDollar && memMon.totalCount === srvMon.totalCount,
            { mem: memMon, srv: srvMon });
        ok('ថ្ងៃ និងខែ មិនបែកគ្នា (ទាំង ២ ជា 0)',
            memDay.codDollar === memMon.codDollar && memDay.totalCount === memMon.totalCount,
            { day: memDay, month: memMon });
        ok('គ្មាន toast បរាជ័យ (អ្នកប្រើមិនត្រូវឃើញ «បរាជ័យក្នុងការ Save»)',
            !ctx.toasts.some((t) => /បរាជ័យ/.test(t)), ctx.toasts);
    }

    // ── ៣. ទិសផ្ទុយ ៖ ការធ្លាក់ចុះធម្មតាមិនត្រូវ clamp មុនពេល ─────────
    console.log('\n=== ៣. ⛔ ទិសផ្ទុយ ៖ ការដកធម្មតានៅតែពិតប្រាកដ ===');
    {
        const ctx = makeSandbox({
            zoew_daily_revenue_cod_dod: { [DATE]: { codDollar: 50, dodDollar: 10, totalCount: 3 } },
            zoew_monthly_revenue_cod_dod: { [MONTH]: { codDollar: 50, dodDollar: 10, totalCount: 3 } }
        });
        ctx.dailyRevenueData[DATE] = { codDollar: 50, dodDollar: 10, totalCount: 3 };
        ctx.monthlyRevenueData[MONTH] = { codDollar: 50, dodDollar: 10, totalCount: 3 };

        vm.runInContext('addRevenueToDailyAndMonthlyRecord("' + DATE + '", -12.5, -2.5, -1)', ctx);
        await settle(); await settle(); await settle();

        const srvDay = ctx.__store.zoew_daily_revenue_cod_dod[DATE];
        ok('គ្មានការបដិសេធ', ctx.__rejected.length === 0, ctx.__rejected);
        ok('ការដកធម្មតា ៖ 50 - 12.5 = 37.5 (មិន clamp)', srvDay.codDollar === 37.5, srvDay);
        ok('ការដកធម្មតា ៖ dod 10 - 2.5 = 7.5', srvDay.dodDollar === 7.5, srvDay);
        ok('ការដកធម្មតា ៖ count 3 - 1 = 2', srvDay.totalCount === 2, srvDay);
        ok('សតិ == server', ctx.dailyRevenueData[DATE].codDollar === srvDay.codDollar, { mem: ctx.dailyRevenueData[DATE], srv: srvDay });
    }

    // ── ៤. ការបូកចូលធម្មតា (ស្កេនថ្មី) ─────────────────────────────────
    console.log('\n=== ៤. ការបូកចូល (ស្កេនថ្មី) នៅដដែល ===');
    {
        const ctx = makeSandbox({});
        vm.runInContext('addRevenueToDailyAndMonthlyRecord("' + DATE + '", 12.5, 2.5, 1)', ctx);
        await settle(); await settle(); await settle();
        const srvDay = ctx.__store.zoew_daily_revenue_cod_dod[DATE];
        const srvMon = ctx.__store.zoew_monthly_revenue_cod_dod[MONTH];
        ok('គ្មានការបដិសេធពេលបង្កើត node ថ្មី', ctx.__rejected.length === 0, ctx.__rejected);
        ok('ថ្ងៃថ្មី ៖ 12.5 / 2.5 / 1', srvDay && srvDay.codDollar === 12.5 && srvDay.dodDollar === 2.5 && srvDay.totalCount === 1, srvDay);
        ok('ខែថ្មី ៖ 12.5 / 2.5 / 1', srvMon && srvMon.codDollar === 12.5 && srvMon.totalCount === 1, srvMon);
    }

    // ── ៥. ស្ថិតិយក ៖ ការបើក barcode ដែលមិនមានក្នុងសំណុំ = no-op ────────
    console.log('\n=== ៥. ស្ថិតិយក ៖ ការបើកលើសមិនត្រូវធ្វើឲ្យ server បដិសេធ ===');
    {
        const ctx = makeSandbox({
            zoew_daily_pickup_cod_dod: { [DATE]: { packagesPickedUp: 1, pickedUpPhones: { '0974158508': 1 }, pickedUpBarcodes: { P1: '0974158508' } } }
        });
        ctx.dailyPickupData[DATE] = { packagesPickedUp: 1, pickedUpPhones: { '0974158508': 1 }, pickedUpBarcodes: { P1: '0974158508' } };
        vm.runInContext('markPickupBarcodes("' + DATE + '", [mark("P1","0974158508",false), mark("P2","0974158508",false), mark("P3","0974158508",false)], null)', ctx);
        await settle(); await settle();
        const srv = ctx.__store.zoew_daily_pickup_cod_dod[DATE];
        ok('គ្មានការបដិសេធលើស្ថិតិយក', ctx.__rejected.length === 0, ctx.__rejected);
        ok('packagesPickedUp ធ្លាក់ដល់ 0 (គ្មានលេខអវិជ្ជមានឲ្យ clamp)', srv && srv.packagesPickedUp === 0, srv);
        ok('key ដែលធ្លាក់ដល់ 0 ត្រូវ **លុប** (rules ទាមទារ > 0)',
            srv && (!srv.pickedUpPhones || Object.keys(srv.pickedUpPhones).length === 0), srv);
        ok('សតិ == server', ctx.dailyPickupData[DATE].packagesPickedUp === srv.packagesPickedUp,
            { mem: ctx.dailyPickupData[DATE], srv: srv });
    }

    // ── ៦. គ្មានវាលចម្លែកចូល node ស្ថិតិ ──────────────────────────────
    console.log('\n=== ៦. គ្មានវាលដែល `$other: false` បដិសេធ ===');
    {
        const ctx = makeSandbox({});
        vm.runInContext('addRevenueToDailyAndMonthlyRecord("' + DATE + '", 5, 5, 1)', ctx);
        vm.runInContext('markPickupBarcodes("' + DATE + '", [mark("Q1","0977",true)], null)', ctx);
        await settle(); await settle(); await settle();
        const strayDaily = Object.keys(ctx.__store.zoew_daily_revenue_cod_dod[DATE] || {})
            .filter((k) => ALLOWED['zoew_daily_revenue_cod_dod'].indexOf(k) === -1);
        const strayPickup = Object.keys(ctx.__store.zoew_daily_pickup_cod_dod[DATE] || {})
            .filter((k) => ALLOWED['zoew_daily_pickup_cod_dod'].indexOf(k) === -1);
        ok('node ចំណូលថ្ងៃ គ្មានវាលចម្លែក', strayDaily.length === 0, strayDaily);
        ok('node ស្ថិតិយក គ្មានវាលចម្លែក', strayPickup.length === 0, strayPickup);
        ok('គ្មានការបដិសេធ', ctx.__rejected.length === 0, ctx.__rejected);
    }

    // ── ៧. ការសរសេរធ្លាក់ដោយហេតុផលបណ្តាញ ➜ revert ត្រូវជា **បញ្ច្រាសពិត** ──
    // ⛔ ថ្នាក់ ៖ ការ apply ក្នុងសតិ **clamp** រួច ចំណែក revert ដក delta
    // *ដែលស្នើ* ចេញវិញ ➜ delta ២ មិនស៊ីគ្នា ➜ លេខឡើងខ្ពស់ជាងមុនកែ។
    // ផ្លូវពិត ៖ ការចុច «📞 ខល» ផ្អាក PWA ➜ RTDB បដិសេធ transaction ដោយ
    // `disconnect` (មេរៀន 2.20.2) ➜ ផ្លូវ revert ដើរ។
    console.log('\n=== ៧. ការសរសេរធ្លាក់ (disconnect) ➜ revert ត្រូវស្តារតម្លៃដើមពិត ===');
    {
        const ctx = makeSandbox({});
        ctx.dailyRevenueData[DATE] = { codDollar: 50, dodDollar: 10, totalCount: 3 };
        ctx.monthlyRevenueData[MONTH] = { codDollar: 50, dodDollar: 10, totalCount: 3 };
        ctx.__failWith.reason = 'disconnect';
        vm.runInContext('addRevenueToDailyAndMonthlyRecord("' + DATE + '", -100, -40, -9)', ctx);
        await settle(); await settle(); await settle();
        const memDay = ctx.dailyRevenueData[DATE];
        const memMon = ctx.monthlyRevenueData[MONTH];
        ok('ថ្ងៃ ៖ revert ស្តារ 50 (មិនមែន 100)', memDay.codDollar === 50, memDay);
        ok('ថ្ងៃ ៖ revert ស្តារ dod 10', memDay.dodDollar === 10, memDay);
        ok('ថ្ងៃ ៖ revert ស្តារ count 3', memDay.totalCount === 3, memDay);
        ok('ខែ ៖ revert ស្តារ 50', memMon.codDollar === 50, memMon);
        ok('ខែ ៖ revert ស្តារ count 3', memMon.totalCount === 3, memMon);
    }
    {
        const ctx = makeSandbox({});
        ctx.dailyRevenueData[DATE] = { codDollar: 50, dodDollar: 10, totalCount: 3 };
        ctx.monthlyRevenueData[MONTH] = { codDollar: 50, dodDollar: 10, totalCount: 3 };
        ctx.__failWith.reason = 'disconnect';
        vm.runInContext('addRevenueToDailyAndMonthlyRecord("' + DATE + '", -12.5, -2.5, -1)', ctx);
        await settle(); await settle(); await settle();
        ok('⛔ ទិសផ្ទុយ ៖ ការដកធម្មតាដែលធ្លាក់ ក៏ស្តារ 50 វិញដដែល',
            ctx.dailyRevenueData[DATE].codDollar === 50, ctx.dailyRevenueData[DATE]);
        ok('⛔ ទិសផ្ទុយ ៖ count ស្តារ 3', ctx.dailyRevenueData[DATE].totalCount === 3, ctx.dailyRevenueData[DATE]);
    }
    {
        // ⛔ ការសរសេរស្ថិតិយកធ្លាក់ ៖ សតិ **មិនត្រូវត្រឡប់ទៅទិដ្ឋភាពចាស់** —
        // ទិដ្ឋភាពចាស់នោះហើយជាប្រភពនៃការផ្ទុះ 2.26.0–2.26.2។ អ្វីដែលត្រូវ
        // ធានាគឺ ៖ server មិនទទួលអ្វីសោះ · អ្នកប្រើដឹងថាការសរសេរធ្លាក់ ·
        // ហើយ snapshot បន្ទាប់ជាអ្នកព្យាបាល។
        const ctx = makeSandbox({});
        ctx.dailyPickupData[DATE] = { packagesPickedUp: 1, pickedUpPhones: { '0974158508': 1 }, pickedUpBarcodes: { W1: '0974158508' } };
        ctx.__failWith.reason = 'disconnect';
        vm.runInContext('markPickupBarcodes("' + DATE + '", [mark("W1","0974158508",false)], null)', ctx);
        await settle(); await settle();
        ok('ស្ថិតិយក ៖ ការសរសេរធ្លាក់ ➜ server មិនទទួលអ្វីសោះ',
            !(ctx.__store.zoew_daily_pickup_cod_dod || {})[DATE], ctx.__store.zoew_daily_pickup_cod_dod);
        ok('ស្ថិតិយក ៖ អ្នកប្រើទទួលសារបរាជ័យ',
            ctx.toasts.some((t) => /Daily Pickup/.test(t)), ctx.toasts);
        ok('⛔ សតិមិនត្រឡប់ទៅទិដ្ឋភាពចាស់ (គ្មានការផ្ទុះពីទិដ្ឋភាពចាស់)',
            ctx.dailyPickupData[DATE].packagesPickedUp === 0, ctx.dailyPickupData[DATE]);
    }

    // ── ៨. ⛔⛔ ស្ថិតិយក ៖ ការសរសេរជា **ស្ថានភាពរបស់ barcode** ──────────
    // ថ្នាក់ដែលបិទត្រង់នេះ ៖ 2.26.0 · 2.26.1 · 2.26.2 សុទ្ធតែជាការគណនា
    // **delta** ដែលធៀបនឹងទិដ្ឋភាពមូលដ្ឋាន *ចាស់* ➜ ការ «ជួសជុល» មួយបង្កើត
    // កញ្ចប់ពីអាកាសធាតុ។ ចាប់ពី 2.27.0 ស្ថិតិយករក្សា **សំណុំ barcode**
    // (`pickedUpBarcodes/$barcodeKey = phoneKey`) ➜ ការសរសេរជា **ស្ថានភាព
    // idempotent** ៖ barcode តែមួយកាន់កន្លែងតែមួយ ដូច្នេះការជាន់គ្នា ·
    // ការចូជួរក្រៅបណ្តាញ · និងការព្យាយាមឡើងវិញ **មិនអាចបូកលេខបានទេ**។
    console.log('\n=== ៨. ស្ថិតិយក ៖ ការសរសេរជា *ស្ថានភាព* មិនមែន delta ===');
    {
        // ⛔ ទិដ្ឋភាពមូលដ្ឋាន **ចាស់** ៖ ឧបករណ៍ផ្សេងបានបើកកញ្ចប់ទាំងអស់រួច។
        // ការបើក barcode មួយត្រូវជា no-op លើ server — មិនមែនការដក ៣។
        const ctx = makeSandbox({
            zoew_daily_pickup_cod_dod: { [DATE]: { packagesPickedUp: 0 } }
        });
        ctx.dailyPickupData[DATE] = { packagesPickedUp: 3, pickedUpPhones: { '0974158508': 3 },
            pickedUpBarcodes: { S1: '0974158508', S2: '0974158508', S3: '0974158508' } };
        vm.runInContext('globalThis.__applied = markPickupBarcodes("' + DATE + '", [mark("S1","0974158508",false)], null)', ctx);
        await settle(); await settle();
        const srv = ctx.__store.zoew_daily_pickup_cod_dod[DATE];
        ok('⛔ server នៅ 0 (barcode នោះមិនមានក្នុងសំណុំ ➜ គ្មានអ្វីត្រូវដក)',
            srv && srv.packagesPickedUp === 0, srv);
        ok('⛔ គ្មាន key លេខទូរស័ព្ទដែល server មិនធ្លាប់មាន',
            srv && (!srv.pickedUpPhones || Object.keys(srv.pickedUpPhones).length === 0), srv);
        ok('គ្មានការបដិសេធពី rules', ctx.__rejected.length === 0, ctx.__rejected);
    }
    {
        // ⛔ ទិសផ្ទុយ ១ ៖ សតិ និង server ស៊ីគ្នា ➜ ការបើក/revert ត្រូវពិតប្រាកដ
        const seedSet = { T1: '0974158508', T2: '0974158508', T3: '0974158508', T4: '0974158508', T5: '0974158508' };
        const ctx = makeSandbox({
            zoew_daily_pickup_cod_dod: { [DATE]: { packagesPickedUp: 5, pickedUpPhones: { '0974158508': 5 }, pickedUpBarcodes: { ...seedSet } } }
        });
        ctx.dailyPickupData[DATE] = { packagesPickedUp: 5, pickedUpPhones: { '0974158508': 5 }, pickedUpBarcodes: { ...seedSet } };
        vm.runInContext('globalThis.__applied = markPickupBarcodes("' + DATE + '", [mark("T1","0974158508",false), mark("T2","0974158508",false)], null)', ctx);
        await settle(); await settle();
        ok('ទិសផ្ទុយ ៖ ការបើក ២ ចុះដល់ 3 ពិត', ctx.__store.zoew_daily_pickup_cod_dod[DATE].packagesPickedUp === 3,
            ctx.__store.zoew_daily_pickup_cod_dod[DATE]);
        vm.runInContext('revertPickupMarks(__applied)', ctx);
        await settle(); await settle(); await settle();
        const srv = ctx.__store.zoew_daily_pickup_cod_dod[DATE];
        ok('⛔ ទិសផ្ទុយ ៖ revert ស្តារ server ទៅ 5 បេះបិទ', srv && srv.packagesPickedUp === 5, srv);
        ok('⛔ ទិសផ្ទុយ ៖ revert ស្តារ key លេខទូរស័ព្ទទៅ 5', srv && (srv.pickedUpPhones || {})['0974158508'] === 5, srv);
        ok('⛔ ទិសផ្ទុយ ៖ សតិក៏ស្តារទៅ 5 ដែរ', ctx.dailyPickupData[DATE].packagesPickedUp === 5, ctx.dailyPickupData[DATE]);
    }
    {
        // 🔴 រាយការណ៍ដោយអ្នកប្រើ (2026-09-04) ៖ A បិទ «យក» ➜ បិទ WiFi ➜
        // បើកវិញ (ចូជួរក្រៅបណ្តាញ) ➜ B បើកកញ្ចប់នោះមុន ➜ A ភ្ជាប់មកវិញ។
        // ⛔ ការសរសេរជាស្ថានភាព ៖ ទោះ A សរសេរប៉ុន្មានដងក៏ដោយ លទ្ធផលនៅ 0 —
        // ព្រោះ barcode តែមួយកាន់កន្លែងតែមួយ។
        const ctx = makeSandbox({ zoew_daily_pickup_cod_dod: { [DATE]: { packagesPickedUp: 0 } } });
        ctx.dailyPickupData[DATE] = { packagesPickedUp: 1, pickedUpPhones: { '0974158508': 1 }, pickedUpBarcodes: { U1: '0974158508' } };
        vm.runInContext('globalThis.__applied = markPickupBarcodes("' + DATE + '", [mark("U1","0974158508",false)], null)', ctx);
        await settle(); await settle();
        // «reconcile» ៖ សរសេរសាលក្រម server ម្តងទៀត (idempotent)
        vm.runInContext('markPickupBarcodes("' + DATE + '", [mark("U1","0974158508",false)], null)', ctx);
        await settle(); await settle();
        const srv = ctx.__store.zoew_daily_pickup_cod_dod[DATE];
        ok('⛔ reconcile ៖ server មិនត្រូវទទួលកញ្ចប់ដែលវាមិនធ្លាប់មាន (នៅ 0)',
            srv && srv.packagesPickedUp === 0, srv);
        ok('⛔ reconcile ៖ គ្មាន key លេខទូរស័ព្ទថ្មីលើ server',
            srv && (!srv.pickedUpPhones || Object.keys(srv.pickedUpPhones).length === 0), srv);
        ok('⛔ សតិក៏ចុះមក 0 ដែរ (មិនផ្ទុះ)', ctx.dailyPickupData[DATE].packagesPickedUp === 0, ctx.dailyPickupData[DATE]);
        ok('គ្មានការបដិសេធពី rules', ctx.__rejected.length === 0, ctx.__rejected);
    }
    {
        // ⛔ ការសរសេរដដែលៗពីឧបករណ៍ ២ ➜ barcode តែមួយ = កន្លែងតែមួយ
        const ctx = makeSandbox({ zoew_daily_pickup_cod_dod: {} });
        ctx.dailyPickupData[DATE] = { packagesPickedUp: 0, pickedUpPhones: {}, pickedUpBarcodes: {} };
        vm.runInContext('markPickupBarcodes("' + DATE + '", [mark("V1","0974158508",true)], null)', ctx);
        vm.runInContext('markPickupBarcodes("' + DATE + '", [mark("V1","0974158508",true)], null)', ctx);
        vm.runInContext('markPickupBarcodes("' + DATE + '", [mark("V1","0974158508",true)], null)', ctx);
        await settle(); await settle(); await settle();
        const srv = ctx.__store.zoew_daily_pickup_cod_dod[DATE];
        ok('⛔ idempotent ៖ បិទ barcode ដដែល ៣ ដង ➜ server = 1', srv && srv.packagesPickedUp === 1, srv);
        ok('⛔ idempotent ៖ អតិថិជន = 1', srv && (srv.pickedUpPhones || {})['0974158508'] === 1, srv);
        ok('អថេរ ៖ sum(pickedUpPhones) === packagesPickedUp',
            srv && Object.keys(srv.pickedUpPhones || {}).reduce((a, k) => a + srv.pickedUpPhones[k], 0) === srv.packagesPickedUp, srv);
    }

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail : '✅ គ្មានបញ្ហា') + ' — ok ' + pass);
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.log('  FAIL   តេស្តគាំង ➜ ' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
