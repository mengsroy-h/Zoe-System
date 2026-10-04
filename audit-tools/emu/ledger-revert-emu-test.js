// ថ្នាក់៖ **«អនុវត្ត ➜ ដកវិញ» ត្រូវជាគូបញ្ច្រាសពិត — វាស់លើ RTDB emulator
// ពិត ជាមួយ `firebase-database.rules.json` ពិត។**
//
//   java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
//   node audit-tools/emu/ledger-revert-emu-test.js
//
// ⛔ **ហេតុអ្វីតេស្តនេះចាំបាច់ ៖ checker ដទៃប្រើ fake SDK។** ការវាស់
// (2026-09-03) បង្ហាញថា ក្នុងចំណោម checker ១៣ ដែលប៉ះ ledger មានតែ **២**
// ដែលចាប់បានពេលដកផ្លូវដកវិញចេញ — ឯទៀត **ងងឹត** ព្រោះសេណារីយ៉ូរបស់ពួកវា
// មិនដែលធ្វើឲ្យការសរសេរធ្លាក់។ ដូច្នេះ «ការកែត្រឹមត្រូវឬអត់» មិនអាចឆ្លើយ
// ដោយ checker ទាំងនោះទេ — វាត្រូវឆ្លើយដោយ **ការវាស់លើ server ពិត**។
//
// អ្វីដែលវាចាក់សោ ៖ ledger លើ RTDB ពិត ត្រូវត្រឡប់ទៅ **តម្លៃដើមបេះបិទ**
// ក្រោយ «អនុវត្ត ➜ ដកវិញ» ទោះ delta ធំជាងតម្លៃដើម (ការ clamp ឆ្លងព្រំដែន 0)
// ដែលជាកន្លែងកំហុសរស់នៅ។ rules ពិតបដិសេធតម្លៃអវិជ្ជមាន ➜ ការ clamp ជា
// ការចាំបាច់ មិនមែនជាជម្រើសទេ។
const fs = require('fs');
const path = require('path');
const http = require('http');
const { emuNamespace } = require('./ns.js');
const vm = require('vm');

const ROOT = process.env.LEDGEREMU_APP_DIR ? path.resolve(process.env.LEDGEREMU_APP_DIR) : path.join(__dirname, '..', '..');
const BASE = { host: '127.0.0.1', port: parseInt(process.env.LEDGEREMU_PORT || '9000', 10) };
const NS = 'ns=' + emuNamespace('demo-zoe-ledger');
const AUTH = 'auth_variable_override=' + encodeURIComponent(JSON.stringify({ uid: 'userA' }));
const DATE = '2026-08-26';
const MONTH = DATE.substring(0, 7);

let pass = 0, fail = 0;
const check = (c, label, detail) => {
    if (c) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : '')); }
};

function req(method, urlPath, body, extraHeaders) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const headers = Object.assign({ 'Authorization': 'Bearer owner' },
            payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
            extraHeaders || {});
        const r = http.request({ ...BASE, method, path: urlPath, headers }, (res) => {
            let d = '';
            res.on('data', (c) => d += c);
            res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
        });
        r.on('error', reject);
        if (payload) r.write(payload);
        r.end();
    });
}
const q = (p) => p + (p.includes('?') ? '&' : '?') + NS + '&' + AUTH;
const owner = (m, p, b) => req(m, p + (p.includes('?') ? '&' : '?') + NS, b);

// ── transaction ពិតលើ REST ៖ អាន ETag ➜ សរសេរដោយ if-match ➜ ព្យាយាមវិញ
//    ពេលប៉ះទង្គិច។ នេះជាការ compare-and-set ពិត មិនមែនការក្លែងទេ។
async function restTransaction(nodePath, updater) {
    for (let attempt = 0; attempt < 8; attempt++) {
        const readRes = await req('GET', q(nodePath + '.json'), undefined, { 'X-Firebase-ETag': 'true' });
        const etag = readRes.headers && readRes.headers.etag;
        let current = null;
        try { current = JSON.parse(readRes.body); } catch (e) { current = null; }
        const next = updater(current);
        if (next === undefined) return { committed: false, snapshot: { val: () => current, exists: () => current !== null } };
        const writeRes = await req('PUT', q(nodePath + '.json'), next, etag ? { 'if-match': etag } : {});
        if (writeRes.status === 200) {
            return { committed: true, snapshot: { val: () => next, exists: () => next !== null } };
        }
        if (writeRes.status === 412) continue;           // ប៉ះទង្គិច ➜ ព្យាយាមវិញ
        const err = new Error('WRITE_REJECTED ' + writeRes.status + ' ' + writeRes.body.slice(0, 120));
        err.code = 'PERMISSION_DENIED';
        throw err;                                        // rules បដិសេធ ➜ ជាកំហុសពិត
    }
    throw new Error('TRANSACTION_RETRY_EXHAUSTED');
}

function extractFn(src, name) {
    const sig = 'function ' + name + '(';
    const start = src.indexOf(sig);
    if (start === -1) throw new Error('រកមិនឃើញ function: ' + name);
    let depth = 0, quote = null, esc = false;
    for (let i = start + sig.length - 1; i < src.length; i++) {
        const c = src[i];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (quote) { if (c === quote) quote = null; continue; }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    }
    throw new Error('function មិនបានបិទ: ' + name);
}

const FNS = ['ledgerNumber', 'ledgerAppliedDelta', 'ledgerDeltaWithClamp', 'revertLedgerRecordInMemory',
    'applyLedgerBucketDelta',
    'runLedgerTransaction', 'commitDailyRevenueDelta', 'commitMonthlyRevenueDelta', 'alignMonthlyLedgerToDaily', 'commitRevenueBucketDelta',
    'ledgerZeroDelta', 'ledgerRejectionVerdict', 'ledgerMarkUnknown', 'ledgerServerVerdict', 'ledgerMemoryCompensationClaimed', 'revertLedgerBucketOnServer', 'revertRevenueLedgerDelta', 'correctRevenueLedgerToActual',
    'addRevenueToDailyAndMonthlyRecord'];

async function readLedger() {
    const d = await owner('GET', `/zoew_daily_revenue_cod_dod/${DATE}.json`);
    const m = await owner('GET', `/zoew_monthly_revenue_cod_dod/${MONTH}.json`);
    return { daily: JSON.parse(d.body || 'null'), monthly: JSON.parse(m.body || 'null') };
}

async function seed(daily, monthly) {
    await owner('PUT', '/.json', null);
    await owner('PUT', `/zoew_daily_revenue_cod_dod/${DATE}.json`, daily);
    await owner('PUT', `/zoew_monthly_revenue_cod_dod/${MONTH}.json`, monthly);
}

function buildContext() {
    const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8').replace(/\r\n?/g, '\n');
    const ctx = {
        console, Object, Math, parseFloat, isFinite, Promise, JSON, String, Number,
        dailyRevenueData: {}, monthlyRevenueData: {},
        dbRefDailyRevenue: { path: 'zoew_daily_revenue_cod_dod' },
        dbRefMonthlyRevenue: { path: 'zoew_monthly_revenue_cod_dod' },
        db: {},
        window: {},
        getFormattedDate: () => DATE,
        showToast: (m) => { ctx.toasts.push(m); },
        refreshCurrentHistoryView: () => {},
        toasts: [],
        fb: {
            ref: (d, p) => ({ path: p === undefined ? '' : String(p) }),
            // ⛔ transaction ពិតលើ emulator ៖ rules ពិតវិនិច្ឆ័យរាល់ការសរសេរ
            runTransaction: (ref, fn) => restTransaction('/' + ref.path, fn)
        }
    };
    ctx.authGeneration = 0;
    vm.createContext(ctx);
    // ⛔ tree ចាស់គ្មាន helper ថ្មី ➜ ត្រូវធ្លាក់ **ដោយមានឈ្មោះ** មិនមែន
    // ដោយ stack trace ដែលមើលទៅដូចកំហុសឧបករណ៍ (មេរៀន «ការធ្លាក់ក្លែងក្លាយ»)។
    const missing = FNS.filter((n) => src.indexOf('function ' + n + '(') === -1);
    if (missing.length) {
        throw new Error('⛔ ផ្លូវដកវិញតាម delta ដែលអនុវត្តពិត មិនមានក្នុង tree នេះ: ' + missing.join(', ')
            + '\n        (ឥរិយាបថចាស់ ៖ ដកវិញតាម delta ដែល *ស្នើ* ➜ ការ clamp បង្កើតចំណូល)');
    }
    vm.runInContext(FNS.map((n) => extractFn(src, n)).join('\n'), ctx);
    return ctx;
}

async function scenario(label, seedDaily, seedMonthly, delta, memoryDaily) {
    await seed(seedDaily, seedMonthly);
    const ctx = buildContext();
    // ⛔ `memoryDaily` អនុញ្ញាតឲ្យ **សតិ ឃ្លាតពី server** — ស្ថានភាពពិតពេល
    // ឧបករណ៍ផ្សេងសរសេរ ខណៈ listener យើងមិនទាន់ដឹង។ បើគ្មានវា ការដកវិញ
    // ដែលប្រើ delta របស់ *សតិ* មើលទៅដូចត្រឹមត្រូវ ➜ mutation រស់រាន។
    ctx.dailyRevenueData[DATE] = { ...(memoryDaily || seedDaily) };
    ctx.monthlyRevenueData[MONTH] = { ...(memoryDaily || seedMonthly) };

    const applied = await vm.runInContext(
        `addRevenueToDailyAndMonthlyRecord(${JSON.stringify(DATE)}, ${delta.cod}, ${delta.dod}, ${delta.count})`, ctx);
    await applied.dailyServer;
    await applied.monthlyServer;
    const mid = await readLedger();

    await vm.runInContext('revertRevenueLedgerDelta', ctx)(applied);
    await new Promise((r) => setTimeout(r, 400));
    const after = await readLedger();
    return { mid, after, applied };
}

(async () => {
    const probe = await owner('GET', '/.json').catch(() => null);
    if (!probe || probe.status >= 500) {
        // ⛔ SKIP ត្រឹមត្រូវត្រង់នេះ ៖ emulator ជា dependency **បរិស្ថាន**
        // មិនមែនឯកសាររបស់ repo ទេ។ CI ដាក់ `MONEYGUARD_STRICT=1` ក្នុង job
        // ដែលមាន emulator ➜ SKIP នោះក្លាយជាការធ្លាក់នៅទីនោះ។
        console.log('SKIP — គ្មាន RTDB emulator នៅ 127.0.0.1:' + BASE.port);
        process.exit(0);
    }
    // rules ពិត
    const rules = fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8');
    const put = await req('PUT', '/.settings/rules.json?' + NS, JSON.parse(rules));
    if (put.status !== 200) { console.log('  FAIL  upload rules មិនបាន: ' + put.status + ' ' + put.body.slice(0, 100)); process.exit(1); }

    // ០. បញ្ជាក់ថា rules ពិតជាបដិសេធតម្លៃអវិជ្ជមាន — បើអត់ តេស្តទាំងមូលគ្មានន័យ
    await seed({ codDollar: 5, dodDollar: 5, totalCount: 1 }, { codDollar: 5, dodDollar: 5, totalCount: 1 });
    const negative = await req('PUT', q(`/zoew_daily_revenue_cod_dod/${DATE}.json`), { codDollar: -1, dodDollar: 0, totalCount: 0 });
    check(negative.status >= 400, '⛔ លក្ខខណ្ឌចាំបាច់ ៖ rules ពិតបដិសេធ codDollar អវិជ្ជមាន', negative.status);

    // ១. ឆ្លងព្រំដែន 0 — កន្លែងកំហុសរស់នៅ
    {
        const r = await scenario('cross-zero', { codDollar: 0, dodDollar: 3.25, totalCount: 1 }, { codDollar: 0, dodDollar: 3.25, totalCount: 1 }, { cod: 0, dod: -4, count: 0 });
        check(r.mid.daily && r.mid.daily.dodDollar === 0, 'អនុវត្ត −4 លើ 3.25 ➜ server clamp ត្រឹម 0 (rules ទាមទារ >= 0)', r.mid.daily);
        check(r.after.daily && r.after.daily.dodDollar === 3.25, '⛔ ដកវិញ ➜ ថ្ងៃត្រឡប់ទៅ 3.25 បេះបិទ (មិនមែន 4)', r.after.daily);
        check(r.after.monthly && r.after.monthly.dodDollar === 3.25, '⛔ ដកវិញ ➜ ខែត្រឡប់ទៅ 3.25 បេះបិទ', r.after.monthly);
    }

    // ២. ⛔ ទិសផ្ទុយ ៖ ឆ្ងាយពីសូន្យ ➜ គូបញ្ច្រាសធម្មតាត្រូវនៅដដែល
    {
        const r = await scenario('away-from-zero', { codDollar: 50, dodDollar: 20, totalCount: 9 }, { codDollar: 50, dodDollar: 20, totalCount: 9 }, { cod: -12.5, dod: -2.5, count: -1 });
        check(r.mid.daily.codDollar === 37.5, 'ឆ្ងាយពីសូន្យ ៖ អនុវត្តចុះដល់ 37.5 ពិត', r.mid.daily);
        check(r.after.daily.codDollar === 50 && r.after.daily.dodDollar === 20 && r.after.daily.totalCount === 9,
            '⛔ ទិសផ្ទុយ ៖ ដកវិញត្រឡប់ទៅ 50 / 20 / 9 បេះបិទ', r.after.daily);
    }

    // ៣. ⛔ ទិសផ្ទុយ ៖ ការបូកចូលធម្មតា ➜ ដកវិញត្រូវលុបចោលទាំងស្រុង
    {
        const r = await scenario('add-then-revert', { codDollar: 10, dodDollar: 0, totalCount: 2 }, { codDollar: 10, dodDollar: 0, totalCount: 2 }, { cod: 7.25, dod: 1.5, count: 1 });
        check(r.mid.daily.codDollar === 17.25, 'បូកចូល ➜ 17.25 ពិត', r.mid.daily);
        check(r.after.daily.codDollar === 10 && r.after.daily.dodDollar === 0 && r.after.daily.totalCount === 2,
            '⛔ ទិសផ្ទុយ ៖ ដកវិញក្រោយបូក ➜ ត្រឡប់ទៅ 10 / 0 / 2', r.after.daily);
    }

    // ៤. ដកលើសទាំងស្រុង ➜ clamp 0 ហើយដកវិញនៅតែត្រឡប់ដើមវិញ
    {
        const r = await scenario('deep-clamp', { codDollar: 2, dodDollar: 1, totalCount: 1 }, { codDollar: 2, dodDollar: 1, totalCount: 1 }, { cod: -100, dod: -40, count: -9 });
        check(r.mid.daily.codDollar === 0 && r.mid.daily.totalCount === 0, 'ដកលើសទាំងស្រុង ➜ clamp 0 (rules មិនបដិសេធ)', r.mid.daily);
        check(r.after.daily.codDollar === 2 && r.after.daily.dodDollar === 1 && r.after.daily.totalCount === 1,
            '⛔ ដកវិញក្រោយ clamp ជ្រៅ ➜ ត្រឡប់ទៅ 2 / 1 / 1 បេះបិទ', r.after.daily);
    }

    // ៥. ⛔ សតិ ឃ្លាតពី server (ឧបករណ៍ផ្សេងសរសេរ) ➜ ការដកវិញត្រូវផ្អែកលើ
    //    **សាលក្រម server** មិនមែនលើលេខក្នុងសតិ។ បើគោរពសតិ ៖ server ដក
    //    −(−4) = +4 លើ 0 ➜ 4 ខណៈតម្លៃដើមរបស់ server ជា 3.25។
    {
        const r = await scenario('memory-diverged',
            { codDollar: 0, dodDollar: 3.25, totalCount: 1 },
            { codDollar: 0, dodDollar: 3.25, totalCount: 1 },
            { cod: 0, dod: -4, count: 0 },
            { codDollar: 0, dodDollar: 7.25, totalCount: 1 });
        check(r.after.daily && r.after.daily.dodDollar === 3.25,
            '⛔ សតិឃ្លាតពី server ➜ ដកវិញនៅតែត្រឡប់ទៅ 3.25 (សាលក្រម server ឈ្នះ)', r.after.daily);
        check(r.after.monthly && r.after.monthly.dodDollar === 3.25,
            '⛔ សតិឃ្លាតពី server ➜ ខែក៏ត្រឡប់ទៅ 3.25 ដែរ', r.after.monthly);
    }

    if (pass + fail < 11) { console.log('  FAIL  ការអះអាងតិចជាងជាន់អប្បបរមា (' + (pass + fail) + ' < 11)'); fail++; }
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')' : '✅ គ្មានបញ្ហា — ok ' + pass));
    if (fail) console.log('  namespace: ' + NS);
    else await owner('PUT', '/.json', null);
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('  FAIL  ' + (e && e.message || e)); process.exit(1); });
