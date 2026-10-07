// ⛔ ថ្នាក់កំហុស៖ **ការហៅ Firebase ដែល *ព្យួរ* (មិនឆ្លើយ មិនបដិសេធ) ធ្វើឲ្យ
// សោ in-flight ជាប់ជារៀងរហូត ➜ មុខងារងាប់ស្ងាត់ៗរហូតដល់បិទបើក App។**
//
// នេះជា **មេរៀន 2.22.4 (សំណួរទី ៩ — «តើ checker ដាក់ dependency ក្នុង
// *របៀបបរាជ័យ* ណា?») ដែលអនុវត្តលើ Firebase SDK ជំនួស `fetch`**។
//
// RTDB **មិនបដិសេធការសរសេរពេលក្រៅបណ្តាញទេ** — វាចាក់ជួរក្នុងឧបករណ៍ ហើយ
// promise ដោះ **តែពេល server ឆ្លើយតប**។ ដូច្នេះលើតំណ «ភ្ជាប់តែស្លាប់»
// (WiFi សាធារណៈមុន login · តំបន់សេវាអន់ · proxy ដែលទទួល TCP រួចស្ងាត់)
// រាល់ `await fb.runTransaction(...)` ដែលគ្មានពិដាន **ព្យួរអស់កល្ប**។
//
// វាស់បានលើ tree មុនកែ (stub ដែលព្យួរ)៖
//   · `resetPickupStats`        ➜ `pickupResetInFlight` ជាប់ `true` · **គ្មាន toast**
//     ➜ ប៊ូតុង «♻️ Reset ចំនួនយករួច» **ងាប់ស្ងាត់ៗ** រហូតដល់បិទបើក App
//   · `clearHistory`            ➜ `clearHistoryInFlight` ជាប់ដដែល
//   · `flushPendingHistoryPatches` ➜ `historyPatchFlushInFlight` ជាប់ ➜
//     **ជួរព្យាយាមវិញនៃការសម្គាល់ការខល (2.20.2) ងាប់ទាំងស្រុង**
//   · `repairPickupLedgerOnce`  ➜ `pickupLedgerRepairRunning` ជាប់
//   · `patchHistoryItemFields`  ➜ ព្យួរ ➜ **ការសម្គាល់ការខលបាត់ស្ងាត់ៗ**
//     (ថ្នាក់ដដែលនឹង 2.20.2 ដែលវិលមកតាមទ្វារផ្សេង ៖ ការព្យួរ **មិនបោះ
//     កំហុស** ➜ `historyPatchErrorIsDisconnect()` មិនដែលត្រូវហៅ ➜ មិនចូលជួរ)
//
// ⛔ **គ្មាន checker ណាក្នុងចំណោម ២៥ ដែល stub `runTransaction` ដាក់វាក្នុង
// របៀបព្យួរសោះ** — ទាំងអស់ធ្វើឲ្យវា **ឆ្លើយ ឬបដិសេធ** ➜ ថ្នាក់នេះមើលមិនឃើញ។
// (`slow-write-test.js` ពន្យារការសរសេរ តែលើ **ផ្លូវស្កេន** ដែលការពារ
// ដោយ `withTimeout` រួចស្រាប់ — មិនមែនផ្លូវ admin ទេ។)
//
// ⚠️ **ZoeKeyGen ដោះស្រាយថ្នាក់នេះរួចហើយ** (`withTimeout` លើ `fb.get`/`fb.update`
// ក្នុង `refreshKeyList` · `revokeKey` · `extendKey` · migration) ➜ ការកែ
// ត្រឹមតែនាំ ZoeW មកតាមទម្លាប់ដដែលរបស់គម្រោង។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ៖
//   ១. **គ្មាន `await fb.<dataOp>(…)` ដោយផ្ទាល់** — ត្រូវឆ្លងកាត់ពិដាន។
//   ២. ការព្យួរត្រូវ **ដោះសោ** ក្នុងពេលកំណត់ (មិនមែនរង់ចាំអស់កល្ប)។
//   ៣. ការព្យួរត្រូវ **ប្រាប់ការពិត** — ⛔ មិនត្រូវអះអាងជោគជ័យ។
//   ៤. ⛔ **ទិសផ្ទុយត្រូវរក្សា** — បណ្តាញធម្មតា ➜ ជោគជ័យដដែល, សោដោះ,
//      ការសរសេរត្រឹមត្រូវ។ («ធ្វើឲ្យវាធ្លាក់ជានិច្ច» ក៏ដោះសោបានដែរ។)
//   ៥. ពិដានត្រូវស្ថិតក្នុងជួរសមហេតុផល (៥–៦០ វិ.) — ១ms ក៏បំផ្លាញការប្រើពិត។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let acorn;
try { acorn = require('acorn'); } catch (e) {

    console.log('SKIP — ត្រូវការ acorn (npm i acorn)');
    process.exit(0);
}

// ⛔ **stub ledger ត្រូវស៊ីនឹងកិច្ចសន្យាពិត។** `addRevenueToDailyAndMonthlyRecord()`
// ពិត clamp ត្រឹម 0 ហើយ **ត្រឡប់ delta ដែលអនុវត្តពិត** ដែល
// `revertRevenueLedgerDelta()` ត្រូវការ។ stub ដែលត្រឡប់ `undefined` ឬលទ្ធផល
// របស់ `.push()` (ជា *លេខ*) ធ្វើឲ្យផ្លូវដកវិញក្លាយជា **no-op ស្ងាត់** ➜
// checker បៃតងខណៈវាមើលមិនឃើញការដកវិញសោះ (វាស់បាន 2026-09-03)។
// ជាគូ ៖ ការអនុវត្ត និងការដកវិញត្រូវចែក ledger **តែមួយ** បើមិនដូច្នេះ
// ការដកវិញមិនប៉ះអ្វីដែលការអនុវត្តបានធ្វើទេ ➜ ការវាស់ក្លាយជាការក្លែង។
function makeLedgerStub(onEntry) {
    const buckets = {};
    const add = function (d, cod, dod, count) {
        if (onEntry) onEntry(d, cod, dod, count);
        const b = buckets[d] || (buckets[d] = { codDollar: 0, dodDollar: 0, totalCount: 0 });
        const before = { codDollar: b.codDollar, dodDollar: b.dodDollar, totalCount: b.totalCount };
        b.codDollar = Math.round((b.codDollar + (parseFloat(cod) || 0)) * 100) / 100;
        b.dodDollar = Math.round((b.dodDollar + (parseFloat(dod) || 0)) * 100) / 100;
        b.totalCount = b.totalCount + (parseFloat(count) || 0);
        if (b.codDollar < 0) b.codDollar = 0;
        if (b.dodDollar < 0) b.dodDollar = 0;
        if (b.totalCount < 0) b.totalCount = 0;
        const applied = {
            cod: Math.round((b.codDollar - before.codDollar) * 100) / 100,
            dod: Math.round((b.dodDollar - before.dodDollar) * 100) / 100,
            count: b.totalCount - before.totalCount
        };
        return { scanDate: d, daily: applied, monthly: applied, dailyServer: Promise.resolve(applied), monthlyServer: Promise.resolve(applied) };
    };
    const revert = function (applied) {
        if (!applied || !applied.scanDate || !applied.daily) return null;
        const dd = applied.daily;
        if (!dd.cod && !dd.dod && !dd.count) return applied;
        add(applied.scanDate, -dd.cod, -dd.dod, -dd.count);
        return applied;
    };
    const addPickup = function (d, key, cust, pkg) {
        return { scanDate: d, phoneKey: key || null, packages: parseFloat(pkg) || 0, customer: parseFloat(cust) || 0 };
    };
    const revertPickup = function (applied) {
        if (!applied || !applied.scanDate) return null;
        if (!applied.packages && !applied.customer) return applied;
        return applied;
    };
    return { add: add, revert: revert, addPickup: addPickup, revertPickup: revertPickup, buckets: buckets };
}

const ROOT = process.env.DBSTALL_APP_DIR || path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(label) { pass++; console.log('   ok    ' + label); }
function bad(label, detail) {
    fail++;
    console.log('  FAIL   ' + label + (detail !== undefined
        ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
}
function check(cond, label, detail) { cond ? ok(label) : bad(label, detail); }

const DATA_OPS = ['runTransaction', 'update', 'get', 'set', 'remove'];
const GUARD_NAMES = ['withTimeout', 'dbOp'];

// ⛔ បញ្ជីលើកលែង — **រាល់ធាតុត្រូវមានហេតុផលសរសេរជាប់** (ទម្លាប់គម្រោង)។
// ធាតុទាំងនេះជាកម្មសិទ្ធិរបស់ **ផ្លូវស្កេន-រក្សាទុក** ដែលមានការរចនា
// ពិដានពេញលេញរួចហើយនៅ **កន្លែងហៅ** ៖
//     const claimPromise = claimBarcodeInRegistry(...);
//     claim = await withTimeout(claimPromise, 15000, 'Barcode claim timed out');
//     catch: claimPromise.then((lateClaim) => { … releaseBarcodesInRegistry(…) });
// ⛔ **ការដាក់ពិដានខាងក្នុងនឹងបំផ្លាញការរាយការណ៍យឺតនោះ** ៖ promise នឹង
// **បដិសេធ** នៅ ១៥ វិ. ជំនួសការដោះយឺតជា `'claimed'` ➜ barcode ដែល claim
// ជោគជ័យយឺត **មិនដែលត្រូវដោះចេញពី `zoew_barcode_registry`** ➜ barcode នោះ
// **ស្កេនចូលមិនបានទៀតជារៀងរហូត** (ថ្នាក់ដដែលនឹងមេរៀន «claim ងាប់» 2.18.0)។
const STALL_GUARD_EXEMPT = {
    ZoeW: ['claimBarcodeInRegistry']
};

function readApp(name) {
    try { return fs.readFileSync(path.join(ROOT, name, 'app.js'), 'utf8'); }
    catch (e) { return null; }
}

// ── ១. ស្តាទិច ៖ គ្មាន `await fb.<dataOp>(…)` ដែលគ្មានពិដាន ────────────────
function unwrappedAwaits(src, label) {
    let ast;
    try { ast = acorn.parse(src, { ecmaVersion: 2022, locations: true }); }
    catch (e) { return { parseError: e.message, hits: [], total: 0 }; }

    const hits = [];
    let total = 0;

    // ដោះខ្សែសង្វាក់ `.then(…)` / `.catch(…)` ចេញ ដើម្បីរកការហៅ **ខាងក្នុងបំផុត**
    function unchain(node) {
        while (node && node.type === 'CallExpression'
            && node.callee.type === 'MemberExpression'
            && !node.callee.computed
            && ['then', 'catch', 'finally'].indexOf(node.callee.property.name) !== -1) {
            node = node.callee.object;
        }
        return node;
    }
    function isFbDataCall(node) {
        return node && node.type === 'CallExpression'
            && node.callee.type === 'MemberExpression'
            && !node.callee.computed
            && node.callee.object.type === 'Identifier'
            && node.callee.object.name === 'fb'
            && DATA_OPS.indexOf(node.callee.property.name) !== -1;
    }
    function isGuardCall(node) {
        return node && node.type === 'CallExpression'
            && node.callee.type === 'Identifier'
            && GUARD_NAMES.indexOf(node.callee.name) !== -1;
    }

    const exempt = STALL_GUARD_EXEMPT[label] || [];
    const exemptSeen = new Set();

    (function walk(node, fnName) {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'FunctionDeclaration' && node.id) fnName = node.id.name;
        if (node.type === 'CallExpression' && isFbDataCall(node)) total++;
        if (node.type === 'AwaitExpression') {
            const inner = unchain(node.argument);
            if (isFbDataCall(inner)) {
                if (exempt.indexOf(fnName) !== -1) exemptSeen.add(fnName);
                else hits.push({ op: inner.callee.property.name, line: node.loc.start.line, fn: fnName });
            }
        }
        for (const key of Object.keys(node)) {
            if (key === 'loc' || key === 'start' || key === 'end') continue;
            const v = node[key];
            if (Array.isArray(v)) v.forEach((c) => walk(c, fnName));
            else if (v && typeof v.type === 'string') walk(v, fnName);
        }
    })(ast, '<top>');

    const deadExempt = exempt.filter((n) => !exemptSeen.has(n));
    return { parseError: null, hits, total, deadExempt };
}

console.log('== ១. ស្តាទិច ៖ រាល់ `await fb.<dataOp>(…)` ត្រូវមានពិដាន ==');

let totalFbCalls = 0;
let scannedApps = 0;
for (const app of ['ZoeW', 'ZoeKeyGen']) {
    const src = readApp(app);
    if (src === null) { bad(`${app}/app.js អានបាន`, 'ឯកសារបាត់ពី tree ដែលពិនិត្យ'); continue; }
    scannedApps++;
    const res = unwrappedAwaits(src, app);
    if (res.parseError) { bad(`${app}/app.js parse បាន`, res.parseError); continue; }
    totalFbCalls += res.total;
    check(res.hits.length === 0,
        `${app} ៖ គ្មាន await លើ fb.<dataOp> ដែលគ្មានពិដាន`,
        res.hits.length ? `ធ្លាក់ ${res.hits.length} កន្លែង ➜ `
            + res.hits.slice(0, 12).map(h => `${h.line} ${h.fn}(fb.${h.op})`).join(', ')
            + (res.hits.length > 12 ? ' …' : '') : undefined);
    // ⛔ បញ្ជីលើកលែងគ្មានធាតុងាប់ — ធាតុដែលលែងប្រើនឹងលាក់កំហុសបន្ទាប់
    check(res.deadExempt.length === 0, `${app} ៖ បញ្ជីលើកលែងគ្មានធាតុងាប់`,
        res.deadExempt.length ? 'ធាតុដែលលែងត្រូវនឹងកូដ ៖ ' + res.deadExempt.join(', ') : undefined);
}

// ជាន់អប្បបរមា ៖ ថតទទេ ឬការប្តូរឈ្មោះមិនត្រូវឆ្លងកាត់ស្ងាត់ៗ
check(scannedApps === 2, 'ជាន់អប្បបរមា ៖ ស្កេន App ទាំង ២', `ស្កេនបាន ${scannedApps}`);
check(totalFbCalls >= 20, 'ជាន់អប្បបរមា ៖ រកឃើញការហៅ fb.<dataOp> >= 20',
    `រកឃើញត្រឹម ${totalFbCalls} ➜ checker នេះប្រហែលមិនបានឃើញកូដពិត`);

// ── ២. ពិដានត្រូវសមហេតុផល ───────────────────────────────────────────────
console.log('\n== ២. ពិដានស្ថិតក្នុងជួរសមហេតុផល ==');
const zoewSrc = readApp('ZoeW') || '';
const capMatch = zoewSrc.match(/const\s+DB_OP_TIMEOUT_MS\s*=\s*(\d+)\s*;/);
check(!!capMatch, 'ZoeW ប្រកាស DB_OP_TIMEOUT_MS',
    capMatch ? undefined : 'រកមិនឃើញ ➜ គ្មានពិដានរួមសម្រាប់ការហៅ Firebase');
if (capMatch) {
    const ms = parseInt(capMatch[1], 10);
    check(ms >= 5000 && ms <= 60000, `DB_OP_TIMEOUT_MS (${ms}ms) ស្ថិតក្នុង ៥–៦០ វិ.`,
        'ពិដានតូចពេកបំផ្លាញការប្រើពិត; ធំពេកស្មើនឹងការព្យួរ');
}

// ── ៣. ឥរិយាបថ ៖ រត់កូដពិតជាមួយ stub ដែល **ព្យួរ** ─────────────────────
function sliceFrom(src, name) {
    const at = src.search(new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('));
    if (at === -1) return null;
    let depth = 0;
    const start = src.indexOf('{', src.indexOf(')', at));
    for (let k = start; k < src.length; k++) {
        if (src[k] === '{') depth++;
        else if (src[k] === '}') { depth--; if (!depth) return src.slice(at, k + 1); }
    }
    return null;
}
function sliceConst(src, name) {
    const m = src.match(new RegExp('const\\s+' + name + '\\s*=\\s*[^;]+;'));
    return m ? m[0] : '';
}

// នាឡិកាមាត្រដ្ឋាន ៖ ពិដាន ១៥ វិ. ក្លាយជា ~៣០០ms ➜ តេស្តលឿន តែកូដពិតមិនប្រែ
const TIME_SCALE = 50;
function scaledTimers() {
    const timers = new Set();
    return {
        setTimeout: (fn, ms, ...a) => {
            const t = setTimeout(fn, Math.max(0, Math.round((ms || 0) / TIME_SCALE)), ...a);
            timers.add(t);
            return t;
        },
        clearTimeout: (t) => { timers.delete(t); return clearTimeout(t); },
        dispose: () => { timers.forEach(clearTimeout); timers.clear(); }
    };
}

function baseSandbox(extra) {
    const timers = scaledTimers();
    const box = Object.assign({
        console, Date, JSON, Math, Object, Set, Map, Array, String, Number, Boolean,
        parseFloat, parseInt, isNaN, Promise, RegExp, Intl, Error,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
        __timers: timers,
        window: {},
        ZoeErrors: null
    }, extra || {});
    return box;
}

function loadCommon(ctx, src) {
    vm.runInContext(sliceConst(src, 'APP_TIME_ZONE'), ctx);
    vm.runInContext(sliceConst(src, 'APP_TIME_ZONE_OFFSET_MINUTES'), ctx);
    for (const fn of ['appZoneParts', 'getZoneDateKey', 'getFormattedDate', 'elapsedSince', 'withTimeout', 'dbOp', 'dbOpStalled']) {
        const s = sliceFrom(src, fn);
        if (s) vm.runInContext(s, ctx);
    }
    // ⛔ `dbOp` ពិតហៅ `probeDatabaseLiveness()` ពេលព្យួរ (ការវាស់ភាពរស់ ៖ `emu/app-network-e2e-test`) ➜ stub «មិនវាស់»
    vm.runInContext('var probeDatabaseLiveness = function () { return Promise.resolve(null); };', ctx);
    const cap = sliceConst(src, 'DB_OP_TIMEOUT_MS');
    if (cap) vm.runInContext(cap, ctx);
}

// ---- ៣ក. resetPickupStats ------------------------------------------------
function runResetPickup(mode, opts) {
    opts = opts || {};
    const toasts = [];
    const writes = [];
    const hang = mode === 'hang';
    const box = baseSandbox({
        confirm: () => true,
        showToast: (m) => toasts.push(String(m)),
        refreshCurrentHistoryView: () => {},
        getCurrentFilterLabel: () => 'ថ្ងៃនេះ',
        countPickedUpCustomers: (b) => (b && b.pickedUpPhones) ? Object.keys(b.pickedUpPhones).length : 0,
        getServerNow: () => Date.now(),
        db: {}, dbRefDailyPickup: {},
        fb: {
            ref: (_db, p) => ({ path: p }),
            runTransaction: (ref, fn) => {
                const value = fn(null);
                writes.push({ path: ref.path, value });
                if (hang) return new Promise(() => {});
                return Promise.resolve({ committed: true });
            }
        }
    });
    const ctx = vm.createContext(box);
    loadCommon(ctx, zoewSrc);
    vm.runInContext(sliceConst(zoewSrc, 'PICKUP_DATE_KEY_PATTERN')
        || 'const PICKUP_DATE_KEY_PATTERN=/^\\d{4}-\\d{2}-\\d{2}$/;', ctx);
    vm.runInContext('let pickupResetInFlight = false;', ctx);
    vm.runInContext('let currentFilterMode = ' + JSON.stringify(opts.filterMode || 'today') + ';', ctx);
    vm.runInContext("let customFilterDate = '';", ctx);
    for (const fn of ['getFilterTargetDateKey', 'getPickupResetTargetDates', 'resetPickupStats']) {
        const s = sliceFrom(zoewSrc, fn);
        if (!s) return { missing: fn };
        vm.runInContext(s, ctx);
    }
    const day = vm.runInContext('getFilterTargetDateKey()', ctx);
    let ledger = { [day]: { packagesPickedUp: 3, pickedUpPhones: { '0974158508': 3 } } };
    if (opts.days && opts.days > 1) {
        ledger = {};
        for (let i = 0; i < opts.days; i++) {
            const d = vm.runInContext('getZoneDateKey(' + Date.now() + ', ' + (-i) + ')', ctx);
            ledger[d] = { packagesPickedUp: 2, pickedUpPhones: { '0974158508': 2 } };
        }
    }
    vm.runInContext('let dailyPickupData = ' + JSON.stringify(ledger) + ';', ctx);
    vm.runInContext('resetPickupStats();', ctx);

    return new Promise((resolve) => {
        setTimeout(() => {
            const locked = vm.runInContext('pickupResetInFlight', ctx);
            box.__timers.dispose();
            resolve({ locked, toasts, writes, day });
        }, 1200);
    });
}

// ---- ៣ខ. patchHistoryItemFields -----------------------------------------
function runPatch(mode) {
    const toasts = [];
    const hang = mode === 'hang';
    const item = { id: 'id_abc', callMark: 'called' };
    const box = baseSandbox({
        showToast: (m) => toasts.push(String(m)),
        refreshCurrentHistoryView: () => {},
        normalizeBarcodesOf: (o) => o,
        getServerNow: () => Date.now(),
        db: {}, dbRefHistory: {}, authGeneration: 0,
        fb: {
            ref: (_db, p) => ({ path: p }),
            runTransaction: (ref, fn) => {
                if (hang) return new Promise(() => {});
                const cur = { id: 'id_abc', barcodes: [] };
                const out = fn(cur);
                return Promise.resolve({ committed: true, snapshot: { val: () => out } });
            }
        }
    });
    const ctx = vm.createContext(box);
    loadCommon(ctx, zoewSrc);
    vm.runInContext(sliceConst(zoewSrc, 'HISTORY_PATCH_RETRY_MAX') || 'const HISTORY_PATCH_RETRY_MAX = 5;', ctx);
    vm.runInContext(sliceConst(zoewSrc, 'HISTORY_PATCH_QUEUE_MAX') || 'const HISTORY_PATCH_QUEUE_MAX = 50;', ctx);
    vm.runInContext('const pendingHistoryPatches = new Map();', ctx);
    vm.runInContext('let scanHistory = [' + JSON.stringify(item) + '];', ctx);
    vm.runInContext(sliceConst(zoewSrc, 'txDisconnectResolving') || 'const txDisconnectResolving = new WeakMap();', ctx);
    for (const fn of ['historyPatchErrorIsDisconnect', 'queueHistoryPatchRetry', 'transactionDisconnectPending', 'patchHistoryItemFields']) {
        const s = sliceFrom(zoewSrc, fn);
        if (!s) return Promise.resolve({ missing: fn });
        vm.runInContext(s, ctx);
    }
    box.__settled = null;
    vm.runInContext(
        'patchHistoryItemFields(scanHistory[0], { callMark: "noanswer" }, { callMark: "called" }, null, {})'
        + '.then((v) => { __settled = { ok: true, value: v }; }, (e) => { __settled = { ok: false, err: String(e && e.message || e) }; });',
        ctx);

    return new Promise((resolve) => {
        setTimeout(() => {
            const settled = vm.runInContext('__settled', ctx);
            const reverted = vm.runInContext('scanHistory[0].callMark', ctx);
            box.__timers.dispose();
            resolve({ settled, reverted, toasts });
        }, 1200);
    });
}


// ---- ៣គ. ⛔ លុយ ៖ ការសម្អាតស្វ័យប្រវត្តិ ៨ ថ្ងៃ (ផ្លូវតែមួយក្នុងការសម្អាត
//        ដែលប៉ះលុយ) មិនត្រូវកាត់លុយពេលតំណស្លាប់ ------------------------
// ⛔ សំណួរដែលអ្នកប្រើសួរដោយផ្ទាល់ ៖ «តើពិដានថ្មីធ្វើឲ្យលុយកាត់ខុសទេ?»
// ចម្លើយត្រូវជា **ការវាស់** មិនមែនការអះអាង ៖ ការកាត់លុយកើតឡើង **ក្រោយ**
// transaction ដោះ ➜ ការព្យួរ ➜ គ្មានការកាត់សោះ ➜ លុយមិនប្រែ។
const CLEANUP_FNS = ['barcodeEntriesOf', 'normalizeBarcodesOf', 'applyBarcodeCloseState',
    'barcodeCloseIsRipe', 'barcodeAbandonIsRipe', 'barcodeAbandonBasis', 'itemAbandonRipeAt', 'normalizeBarcodeCloseStamps', 'itemHasRestoreMarkers',
    'stripHistoryOnlyMarkers', 'parseTimestampFromId', 'generateUniqueId', 'retryAsync',
    'cloneRestoreItem', 'saveSingleDeletedItemToFirebase', 'isActiveRestoreClaim',
    'recalcItemMoneyFromBarcodes', 'armLateCommit', 'notifyIfSlow', 'settleLockWithin',
    'ledgerNumber', 'ledgerZeroDelta', 'ledgerRejectionVerdict', 'ledgerMarkUnknown', 'ledgerServerVerdict', 'alignMonthlyLedgerToDaily',
    'correctRevenueLedgerToActual', 'cleanupTrashCodes', 'cleanupLedgerDeducted', 'markCleanupTrashDeducted', 'cleanupBarcodesBackInHistory', 'applyCleanupRevenue', 'settleCleanupDeduction', 'resolveCleanupSlot', 'claimAndCleanupItem'];

function runAbandonCleanup(mode) {
    const revenueLog = [];
    const errors = [];
    const ledger = makeLedgerStub((d, cod, dod, c) => revenueLog.push({ d, cod, dod, c }));
    ledger.buckets['2026-08-21'] = { codDollar: 5, dodDollar: 2, totalCount: 1 };
    const writes = [];
    const store = {};
    const hang = mode === 'hang';
    const NOW = Date.UTC(2026, 7, 29, 6, 0, 0);
    const fb = {
        ref: (_d, p) => ({ path: p }),
        runTransaction: (ref, fn) => {
            const cur = store[ref.path] ? JSON.parse(JSON.stringify(store[ref.path])) : null;
            const out = fn(cur);
            if (hang) return new Promise(() => {});
            if (out === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => cur } });
            store[ref.path] = out;
            writes.push(ref.path);
            return Promise.resolve({ committed: true, snapshot: { val: () => out } });
        },
        update: (ref, upd) => {
            if (hang) return new Promise(() => {});
            Object.keys(upd).forEach((k) => writes.push((ref.path ? ref.path + '/' : '') + k));
            return Promise.resolve();
        },
        get: () => (hang ? new Promise(() => {}) : Promise.resolve({ exists: () => false, val: () => null }))
    };
    const box = baseSandbox({
        db: {}, fb,
        dbRefDeleted: { path: 'zoew_recently_deleted_cod_dod' },
        dbRefHistory: { path: 'zoew_scan_history_cod_dod' },
        getServerNow: () => NOW,
        getFormattedDate: () => '2026-08-21',
        addRevenueToDailyAndMonthlyRecord: ledger.add,
        revertRevenueLedgerDelta: ledger.revert,
        console: { ...console, error: (...args) => { errors.push(args.map(String).join(' ')); console.error(...args); } },
        commitRevenueBucketDelta: () => { throw new Error('Unexpected ledger correction'); },
        commitMonthlyRevenueDelta: () => { throw new Error('Unexpected monthly correction'); },
        showToast: () => {},
        releaseBarcodesInRegistry: () => Promise.resolve(),
        scanHistory: [], deletedItems: []
    });
    const ctx = vm.createContext(box);
    loadCommon(ctx, zoewSrc);
    const parts = [
        sliceConst(zoewSrc, 'TWO_HOURS_MS'), sliceConst(zoewSrc, 'ABANDON_AGE_MS'),
        sliceConst(zoewSrc, 'TRASH_WRITE_SLOW_NOTICE_MS'),
        sliceConst(zoewSrc, 'LOCK_STALL_RELEASE_MS'),
        'let serverClockTrusted = true, isDatabaseConnected = true;',
        sliceFrom(zoewSrc, 'cleanupClockIsTrustworthy'),
        'const cleanupInFlight = new Set();', 'const activeRestoreClaims = new Map();',
        // ⛔ journal នៃការសម្អាត (2.37.2) ៖ ការហៅរបស់វា fail-open ➜ បើ sandbox
        //    ខ្វះឈ្មោះ វា **លាក់** ReferenceError ក្នុង `console.error` ➜ ផ្នែក
        //    «dependency បាត់» របស់ checker នេះចាប់វា។ ដូច្នេះត្រូវផ្ទុកពិត។
        sliceConst(zoewSrc, 'CLEANUP_JOURNAL_KEY') || "const CLEANUP_JOURNAL_KEY = 'zoew_cleanup_journal_v1';",
        sliceConst(zoewSrc, 'CLEANUP_JOURNAL_MAX') || 'const CLEANUP_JOURNAL_MAX = 200;',
        sliceConst(zoewSrc, 'CLEANUP_STAGE_MOVED') || "const CLEANUP_STAGE_MOVED = 'moved';",
        sliceConst(zoewSrc, 'CLEANUP_STAGE_LEDGER') || "const CLEANUP_STAGE_LEDGER = 'ledger';",
        sliceConst(zoewSrc, 'CLEANUP_STAGE_FLIP') || "const CLEANUP_STAGE_FLIP = 'flip';",
        sliceConst(zoewSrc, 'CLEANUP_STAGE_SLOT') || "const CLEANUP_STAGE_SLOT = 'slot';",
        'const appLocalStore = (function () { const d = {}; return { getItem: (k) => (Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; })();',
        sliceFrom(zoewSrc, 'safeStoreGet') || 'function safeStoreGet(store, key) { try { return store ? store.getItem(key) : null; } catch (e) { return null; } }',
        sliceFrom(zoewSrc, 'safeStoreSet') || 'function safeStoreSet(store, key, value) { try { return store ? (store.setItem(key, String(value)), true) : false; } catch (e) { return false; } }',
        sliceFrom(zoewSrc, 'safeStoreRemove') || 'function safeStoreRemove(store, key) { try { return store ? (store.removeItem(key), true) : false; } catch (e) { return false; } }',
        sliceFrom(zoewSrc, 'cleanupJournalScope') || "function cleanupJournalScope() { return ''; }",
        sliceFrom(zoewSrc, 'cleanupJournalScopeMismatch') || 'function cleanupJournalScopeMismatch() { return false; }',
        sliceFrom(zoewSrc, 'readCleanupJournal') || 'function readCleanupJournal() { return []; }',
        sliceFrom(zoewSrc, 'writeCleanupJournal') || 'function writeCleanupJournal() {}',
        sliceFrom(zoewSrc, 'noteCleanupJournalEntry') || 'function noteCleanupJournalEntry() {}',
        sliceFrom(zoewSrc, 'markCleanupJournalStage') || 'function markCleanupJournalStage() {}',
        sliceFrom(zoewSrc, 'clearCleanupJournalEntry') || 'function clearCleanupJournalEntry() {}'
    ];
    for (const fn of CLEANUP_FNS) {
        const body = sliceFrom(zoewSrc, fn);
        if (!body) return Promise.resolve({ missing: fn });
        parts.push(body);
    }
    parts.push('globalThis.__inflight = () => cleanupInFlight.size;');
    vm.runInContext(parts.join('\n\n'), ctx);

    // កញ្ចប់ហួស ៨ ថ្ងៃ ហើយ **មិនទាន់យក** ➜ ផ្លូវ `abandon` = ដកលុយ
    const item = {
        id: 'id_abandon', phone: '0974158508', scanDate: '2026-08-21', isClosed: false,
        createdAt: NOW - 9 * 24 * 3600 * 1000,
        barcodes: [{ code: 'BC1', cod: 5, dod: 2, isClosed: false, isDeducted: false, isFromDeletion: false }]
    };
    store['zoew_scan_history_cod_dod/id_abandon'] = JSON.parse(JSON.stringify(item));
    box.scanHistory.push(JSON.parse(JSON.stringify(item)));
    vm.runInContext("claimAndCleanupItem('id_abandon', 'abandon');", ctx);

    return new Promise((resolve) => {
        setTimeout(() => {
            const inflight = vm.runInContext('__inflight()', ctx);
            box.__timers.dispose();
            resolve({ revenueLog, writes, inflight, errors, ledger: ledger.buckets['2026-08-21'], trash: box.deletedItems });
        }, 1200);
    });
}

(async () => {
    console.log('\n== ៣. ឥរិយាបថ ៖ `resetPickupStats` លើតំណដែលព្យួរ ==');
    const hung = await runResetPickup('hang');
    if (hung.missing) {
        bad('រក function ' + hung.missing + ' ឃើញ', 'checker មិនអាចវាស់ឥរិយាបថបានទេ');
    } else {
        check(hung.writes.length >= 1, 'ការសរសេរត្រូវបានព្យាយាមពិត (stub ត្រូវបានហៅ)',
            'ការវាស់មិនបានឈានដល់ផ្លូវសរសេរសោះ ➜ លទ្ធផលមិនមានន័យ');
        check(hung.locked === false, '⛔ ការព្យួរ ➜ `pickupResetInFlight` ត្រូវដោះវិញ',
            'សោជាប់ `true` ➜ ប៊ូតុង «♻️ Reset ចំនួនយករួច» ងាប់រហូតដល់បិទបើក App');
        const said = hung.toasts.join(' | ');
        check(hung.toasts.length >= 1, '⛔ ការព្យួរ ➜ ត្រូវប្រាប់អ្នកប្រើ',
            'គ្មានសារសោះ ➜ អ្នកប្រើមិនដឹងថាមានអ្វីកើតឡើង');
        check(!/បានលុប|ជោគជ័យ|✅/.test(said) , '⛔ ការព្យួរ ➜ មិនត្រូវអះអាងជោគជ័យ', said);
    }

    console.log('\n== ៤. ទិសផ្ទុយ ៖ បណ្តាញធម្មតាមិនត្រូវប្រែ ==');
    const fine = await runResetPickup('fast');
    if (!fine.missing) {
        check(fine.locked === false, 'បណ្តាញធម្មតា ➜ សោដោះ');
        check(fine.writes.length === 1 && fine.writes[0].value
            && fine.writes[0].value.packagesPickedUp === 0,
            'បណ្តាញធម្មតា ➜ សរសេរ `{ packagesPickedUp: 0 }` ដដែល', fine.writes);
        check(/Reset/i.test(fine.toasts.join(' | ')) || fine.toasts.length >= 1,
            'បណ្តាញធម្មតា ➜ មានសាររបាយការណ៍', fine.toasts);
    }

    console.log('\n== ៤ខ. រង្វិលជុំត្រូវបោះបង់ភ្លាមពេលតំណស្លាប់ ==');
    // ⛔ បើគ្មានការបោះបង់ ការ Reset «ទាំងអស់» លើ ៥ ថ្ងៃ = ៥ × ១៥ វិ. = ៧៥ វិ.
    // ដែលសោជាប់ពេញរយៈពេលនោះ ➜ អ្នកប្រើគិតថា App គាំង។
    const many = await runResetPickup('hang', { filterMode: 'all', days: 5 });
    if (!many.missing) {
        check(many.writes.length >= 1, 'ការវាស់ឈានដល់ផ្លូវសរសេរពិត', many.writes.length);
        check(many.writes.length === 1,
            '⛔ តំណស្លាប់ ➜ បោះបង់ក្រោយការព្យួរ **ដំបូង** (មិនមែន N × ពិដាន)',
            `ព្យាយាមសរសេរ ${many.writes.length} ដង ➜ សោជាប់ ${many.writes.length} × ១៥ វិ.`);
        check(many.locked === false, 'តំណស្លាប់ ➜ សោដោះវិញ (ពហុថ្ងៃ)');
        check(/បណ្តាញ|ឆ្លើយមិនចេញ/.test(many.toasts.join(' | ')),
            'តំណស្លាប់ ➜ សារប្រាប់មូលហេតុពិត (បណ្តាញ)', many.toasts);
    }
    const manyFine = await runResetPickup('fast', { filterMode: 'all', days: 5 });
    if (!manyFine.missing) {
        check(manyFine.writes.length === 5,
            '⛔ ទិសផ្ទុយ ៖ បណ្តាញធម្មតា ➜ Reset គ្រប់ ៥ ថ្ងៃដដែល',
            `សរសេរ ${manyFine.writes.length}/៥ ➜ ការបោះបង់មិនត្រូវប៉ះការរត់ធម្មតា`);
    }

    console.log('\n== ៤គ. ⛔ លុយ ៖ ការសម្អាត ៨ ថ្ងៃ លើតំណដែលព្យួរ ==');
    const abHang = await runAbandonCleanup('hang');
    const abFine = await runAbandonCleanup('ok');
    if (abHang.missing || abFine.missing) {
        bad('រក function ' + (abHang.missing || abFine.missing) + ' ឃើញ',
            'checker មិនអាចវាស់ផ្លូវលុយបានទេ');
    } else {
        check(abFine.errors.length === 0 && abHang.errors.length === 0,
            'កូដសម្អាតទាំងពីរផ្លូវគ្មាន dependency បាត់ ឬកំហុសដែលត្រូវលាក់',
            { fast: abFine.errors, hang: abHang.errors });
        check(JSON.stringify(abFine.ledger) === JSON.stringify({ codDollar: 0, dodDollar: 0, totalCount: 0 }),
            'ទិសផ្ទុយ ៖ បណ្តាញធម្មតាកាត់លុយពី ledger ដែលបាន seed ពិត', abFine.ledger);
        check(JSON.stringify(abHang.ledger) === JSON.stringify({ codDollar: 5, dodDollar: 2, totalCount: 1 }),
            'តំណព្យួរ ៖ ledger ដែលមានប្រាក់ដើមរក្សាដដែល', abHang.ledger);
        check(abFine.writes.some(p => p.includes('zoew_recently_deleted_cod_dod')) && abFine.trash.length === 1,
            'ទិសផ្ទុយ ៖ បណ្តាញធម្មតាសរសេរធុងសំរាមពិតមួយធាតុ', { writes: abFine.writes, trash: abFine.trash });
        check(abFine.revenueLog.length === 1,
            'ជាន់អប្បបរមា ៖ បណ្តាញធម្មតា ➜ ផ្លូវ `abandon` ពិតជាកាត់លុយ ១ ដង',
            'បើ 0 នោះការវាស់មិនបានឈានដល់ផ្លូវលុយសោះ ➜ លទ្ធផលគ្មានន័យ');
        check(abHang.revenueLog.length === 0,
            '⛔ តំណព្យួរ ➜ **មិនកាត់លុយសោះ** (`isDeducted` មិនត្រូវប៉ះ)',
            JSON.stringify(abHang.revenueLog));
        check(abHang.writes.length === 0,
            '⛔ តំណព្យួរ ➜ គ្មានការសរសេរទៅធុងសំរាម',
            JSON.stringify(abHang.writes));
        check(abHang.inflight === 0,
            '⛔ តំណព្យួរ ➜ `cleanupInFlight` ត្រូវដោះវិញ',
            'សោជាប់ ➜ កញ្ចប់នោះលែងត្រូវសម្អាតពេញវគ្គ');
    }

    console.log('\n== ៥. ឥរិយាបថ ៖ `patchHistoryItemFields` (ការសម្គាល់ការខល) ==');
    const p = await runPatch('hang');
    if (p.missing) {
        bad('រក function ' + p.missing + ' ឃើញ');
    } else {
        check(p.settled !== null && p.settled !== undefined,
            '⛔ ការព្យួរ ➜ promise ត្រូវដោះ (មិនរង់ចាំអស់កល្ប)',
            'promise មិនដែលដោះ ➜ អ្នកហៅ (`flushPendingHistoryPatches`) ជាប់សោជារៀងរហូត');
        check(p.toasts.length >= 1, '⛔ ការព្យួរ ➜ ត្រូវប្រាប់អ្នកប្រើ', p.toasts);
    }
    const p2 = await runPatch('fast');
    if (!p2.missing) {
        check(p2.settled && p2.settled.ok, 'ទិសផ្ទុយ ៖ បណ្តាញធម្មតា ➜ ការសម្គាល់ជោគជ័យដដែល', p2.settled);
    }

    console.log('\n' + (fail ? `❌ ធ្លាក់ ${fail} (ok ${pass})` : `✅ ជោគជ័យទាំងអស់ (${pass})`));
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.log('  FAIL   checker បោះកំហុស ➜ ' + (e && e.stack || e));
    process.exit(1);
});
