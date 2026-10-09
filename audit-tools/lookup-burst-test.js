// ⛔ ថ្នាក់កំហុស៖ **ការស្កេនលឿនធ្វើឲ្យកញ្ចប់បាត់ការបំពេញស្វ័យប្រវត្តិ ជាស្ថាពរ។**
//
// 🔴 វាស់បានលើ `origin/main` (2026-09-01) ដោយរត់ `attemptAutoLookup()` **ពិត**
//   ៥ ដងជាប់ៗគ្នា (រាល់ ២០០ms) ខណៈ ZTO ឆ្លើយក្នុង ៤ វិនាទី៖
//
//   | កញ្ចប់ | លទ្ធផលមុនកែ |
//   |---|---|
//   | ១ · ២ | ✅ បំពេញបាន |
//   | ៣ · ៤ · ៥ | 🔴 «⏳ Lookup កំពុងរវល់» ➜ **`return` ស្ងាត់ គ្មានការព្យាយាមឡើងវិញ** |
//
//   ➜ អ្នកប្រើត្រូវវាយលេខទូរស័ព្ទ · COD · DOD **ដោយដៃ** សម្រាប់ ៣ កញ្ចប់ក្នុង ៥
//   ទោះបី ZTO មានទិន្នន័យរួច ហើយប្រអប់នៅបើកចាំ។
//
// ⛔ **មូលហេតុឫសគល់មិនមែនត្រឹមពិដាន `AUTO_LOOKUP_MAX_IN_FLIGHT` ទេ។**
//   lookup ដែលប្រអប់របស់វា **បិទរួច** (អ្នកប្រើរក្សាទុករួច) នៅតែកាន់សោ
//   រហូតដល់បណ្តាញឆ្លើយ — ខណៈវា **លែងអាចបំពេញអ្វីបានទៀត** ព្រោះ
//   `applyLookupFillToModal()` ត្រឡប់ `false` ពេល `pendingBarcode !== barcode`។
//   ដូច្នេះសោត្រូវកាន់ដោយការងារដែល **គ្មានប្រយោជន៍**។
//
// ⛔ ថ្នាក់ដដែលនឹងមេរៀន 2.20.2 («រវល់ពេលដល់ម៉ោង ➜ តាំងម៉ោងឡើងវិញ មិនបោះបង់»)
//   ដែលត្រូវអនុវត្តលើ `customerTablePrefetchAllowed()` រួច — តែ **ផ្លូវ lookup
//   ក្នុងមួយកញ្ចប់រអិលកាត់**។ វាជាថ្នាក់ «ការការពារដែលបោះបង់ស្ងាត់»។
//
// ⛔ ហេតុអ្វី checker ១២១ **បៃតងទាំងអស់** លើកូដនោះ៖ គ្មានមួយណាស្កេន
//   **ច្រើនកញ្ចប់ជាប់ៗគ្នាខណៈបណ្តាញយឺត** សោះ។ `lookup-failure-identity-test.js`
//   ស្កេន **១ កញ្ចប់**; `network-pressure-test.js` វាស់ **ចំនួនសំណើ** មិនមែន
//   **ចំនួនកញ្ចប់ដែលទទួលចម្លើយ**។ នេះជា **សំណួរទី ៨** ៖ «តើ checker ដាក់
//   ប្រព័ន្ធក្នុង *ស្ថានភាព* ណា មុនអះអាង?» — ស្ថានភាពពិតរបស់អ្នកប្រើគឺ
//   **ការស្កេនជាបន្តបន្ទាប់** មិនមែនការស្កេនតែមួយទេ។
//
// ⛔ ការអះអាងមាន **២ ខាង** ៖ គ្រប់កញ្ចប់ត្រូវទទួលការបំពេញ **និង** ពិដាន
//   ស្របគ្នាត្រូវ **នៅតែទប់** (ការលុបពិដានចោលក៏ធ្វើឲ្យខាងទី ១ បៃតងដែរ
//   ដែលជាការថយក្រោយ ៖ សម្ពាធលើ ZTO គ្មានដែនកំណត់)។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.LOOKUPBURST_APP_DIR ? path.resolve(process.env.LOOKUPBURST_APP_DIR) : path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

let SRC = '';
try { SRC = fs.readFileSync(APP_JS, 'utf8'); } catch (e) { SRC = ''; }

// ជាន់អប្បបរមា — ថតទទេ ឬឯកសារខូច ត្រូវធ្លាក់ មិនមែនបៃតង
ok('អាន ZoeW/app.js បាន (ជាន់អប្បបរមា)', SRC.length > 100000, SRC.length);

function sliceFn(name) {
    let start = SRC.indexOf('function ' + name + '(');
    if (start === -1) return null;
    if (SRC.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = SRC.indexOf('{', start), started = false;
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') { depth++; started = true; }
        else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return SRC.slice(start, i);
}

const NEEDED = ['elapsedSince', 'retryAsync', 'lookupResponseError', 'markLookupTimeoutNoRetry',
    'lookupFailureCooldownMs', 'lookupFailureIsDefinitive', 'retryTransientLookupResponse', 'noteSheetScriptVersion',
    'safeLookupReason', 'lookupApiIsZto', 'lookupApiIsAppsScript', 'lookupApiSendsHeader',
    'getFastLookupRow', 'setFastLookupRow', 'ztoBarcodeShapeIsValid', 'ztoIdToken', 'addZtoIdentityHeader',
    'attemptAutoLookup'];
// ⛔ ថេរដែល `attemptAutoLookup()` ពិតប្រើ (ច្រកទម្រង់ barcode ZTO) ➜ ស្រង់ពីកូដពិត
const CONSTS = ['ZTO_BARCODE_RE', 'ZTO_BARCODE_SHAPE_TEXT', 'ZTO_ID_TOKEN_TIMEOUT_MS', 'ZTO_ID_TOKEN_LOOKUP_TIMEOUT_MS'].map((n) => {
    const m = SRC.match(new RegExp('^ *const ' + n + ' = .*$', 'm'));
    return m ? m[0] : '';
}).filter(Boolean);
// ជាន់អប្បបរមាទី ២ ៖ ចំនួន function ដែលស្រង់បាន — refactor ដែលដក function
// ចេញមិនត្រូវធ្វើឲ្យ checker បៃតងដោយស្ងាត់
const OPTIONAL = ['scheduleAutoLookupQueueRetry', 'clearAutoLookupQueueRetries',
    'dropAutoLookupQueueEntry', 'pumpAutoLookupQueue'];
const src = {};
NEEDED.forEach((n) => {
    src[n] = sliceFn(n);
    // ⛔ កុំបញ្ឈប់ checker — stub ជំនួស ដើម្បីឲ្យការអះអាងឥរិយាបថនៅតែរត់
    ok('រកឃើញ function ' + n + '()', !!src[n]);
});
OPTIONAL.forEach((n) => { src[n] = sliceFn(n); });

function buildRuntime(opts) {
    const o = opts || {};
    const statuses = [];
    const filled = [];
    const statusEl = { className: 'lookup-status', textContent: '', hidden: true };
    const ctx = {
        console: { error: () => {}, log: () => {} },
        Object, Array, Promise, JSON, String, Number, Math, Date, Error, TypeError, Set, Map,
        parseFloat, isNaN, encodeURIComponent, setTimeout, clearTimeout,
        navigator: { onLine: true },
        AUTO_LOOKUP_FAIL_COOLDOWN_MS: 30000,
        AUTO_LOOKUP_TRANSIENT_COOLDOWN_MS: 6000,
        AUTO_LOOKUP_FAILURE_MAX: 100,
        AUTO_LOOKUP_MAX_IN_FLIGHT: 2,
        AUTO_LOOKUP_TIMEOUT_MS: 16000,
        ZTO_AUTO_LOOKUP_TIMEOUT_MS: 20000,
        AUTO_LOOKUP_QUEUE_RETRY_MS: 120,
        AUTO_LOOKUP_QUEUE_MAX_WAIT_MS: 20000,
        LOOKUP_FAST_CACHE_TTL_MS: 600000,
        LOOKUP_FAST_CACHE_MAX: 300,
        autoLookupInFlight: new Map(),
        autoLookupFailureAt: new Map(),
        autoLookupQueueRetries: new Map(),
        lookupFastCache: new Map(),
        lookupLockedNoticeShown: false,
        lookupSecretKey: null,
        sheetScriptVersionSeen: null,
        pendingLookupUnlockBarcode: '',
        pendingLookupUnlockResolve: null,
        pendingBarcode: '',
        isModalOpen: true,
        customerDataTableSessionGeneration: 0,
        customerDataTableRows: null,
        getLookupApiConfig: () => ({
            url: '/.netlify/functions/zto-order-detail?barcode={barcode}',
            enabled: true, fastMode: true, headerName: '', headerValueEnc: null,
            phoneField: 'phone', codField: 'cod', dodField: 'dod'
        }),
        findCustomerDataTableRow: () => null,
        scheduleCustomerTableSoonRefresh: () => {},
        rememberCustomerTableRow: () => {},
        getNestedField: (d, k) => (d ? d[k] : null),
        showToast: () => {},
        decryptLookupSecret: () => Promise.resolve(''),
        isPinFlowPending: () => false,
        requestPinBeforeConfig: () => {},
        retryPendingLookupAfterUnlock: () => {},
        document: { getElementById: (id) => (id === 'lookupStatus' ? statusEl : null) },
        ZoeErrors: { capture: () => {} },
        __statuses: statuses,
        __filled: filled,
        __net: 0
    };
    ctx.setLookupStatus = function (barcode, kind, text) {
        // ចម្លងឥរិយាបថពិត ៖ ស្ថានភាពសរសេរតែសម្រាប់កញ្ចប់ដែលប្រអប់កំពុងបង្ហាញ
        if (barcode && (ctx.pendingBarcode !== barcode || !ctx.isModalOpen)) return false;
        statuses.push({ bc: barcode, kind, text: String(text || '') });
        statusEl.textContent = String(text || '');
        return true;
    };
    ctx.applyLookupFillToModal = function (barcode) {
        if (ctx.pendingBarcode !== barcode || !ctx.isModalOpen) return false;
        filled.push(barcode);
        return true;
    };
    ctx.fetchWithTimeout = function () {
        ctx.__net++;
        return new Promise((resolve) => setTimeout(() => resolve({
            res: { ok: true, status: 200 },
            body: { success: true, found: true, phone: '0974158508', cod: 5, dod: 0 }
        }), o.netDelayMs === undefined ? 300 : o.netDelayMs));
    };
    vm.createContext(ctx);
    const body = CONSTS.concat(NEEDED.concat(OPTIONAL).map((n) => src[n]).filter(Boolean)).join('\n');
    vm.runInContext(body, ctx);
    return ctx;
}

const scenarios = [];
function scenario(label, fn) { scenarios.push({ label, fn }); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── ១. ស្នូល ៖ ការស្កេនលឿនមិនត្រូវបាត់កញ្ចប់ ─────────────────────────────
scenario('⛔ ស្នូល ៖ ស្កេន ៥ កញ្ចប់ខណៈបណ្តាញយឺត ➜ គ្រប់កញ្ចប់ត្រូវបំពេញ', async () => {
    const ctx = buildRuntime({ netDelayMs: 400 });
    const codes = ['ZTOB0001', 'ZTOB0002', 'ZTOB0003', 'ZTOB0004', 'ZTOB0005'];

    // ចម្លងលំហូរពិត ៖ ស្កេន ➜ ប្រអប់បើកសម្រាប់កញ្ចប់នោះ ➜ lookup ចាប់ផ្តើម
    // កញ្ចប់មុនៗ **មិនត្រូវលុបចោលទេ** — សោរបស់ពួកវានៅតែកាន់រហូតបណ្តាញឆ្លើយ
    for (const c of codes) {
        ctx.pendingBarcode = c;
        ctx.isModalOpen = true;
        vm.runInContext('attemptAutoLookup(' + JSON.stringify(c) + ')', ctx);
        await sleep(60);
    }
    // រង់ចាំឲ្យជួរដំណើរការចប់
    await sleep(3000);

    const lastCode = codes[codes.length - 1];
    const busy = ctx.__statuses.filter((s) => /រវល់/.test(s.text));

    // ⛔ ខាងទី ១ ៖ កញ្ចប់ចុងក្រោយ (ដែលប្រអប់នៅបើក) **ត្រូវទទួលការបំពេញ**
    ok('កញ្ចប់ចុងក្រោយដែលប្រអប់នៅបើក ត្រូវបំពេញបាន',
        ctx.__filled.indexOf(lastCode) !== -1,
        { filled: ctx.__filled, statuses: ctx.__statuses.map((s) => s.bc + ':' + s.kind) });

    // ⛔ សារ «រវល់» ដែលបញ្ចប់ដំណើរការជាស្ថាពរ គឺជាការបោះបង់ស្ងាត់
    ok('⛔ គ្មានកញ្ចប់ណាបញ្ចប់ត្រឹមសារ «រវល់» ជាស្ថាពរ',
        busy.every((b) => ctx.__filled.indexOf(b.bc) !== -1),
        busy.map((b) => b.bc).filter((bc) => ctx.__filled.indexOf(bc) === -1));
});

// ── ២. ទិសផ្ទុយ ៖ ពិដានស្របគ្នាត្រូវនៅតែទប់ ──────────────────────────────
scenario('⛔ ទិសផ្ទុយ ៖ ពិដានស្របគ្នាត្រូវនៅតែទប់ (កុំលុបចោល)', async () => {
    const ctx = buildRuntime({ netDelayMs: 600 });
    const codes = ['ZTOC0001', 'ZTOC0002', 'ZTOC0003', 'ZTOC0004', 'ZTOC0005'];
    let peak = 0;
    const watch = setInterval(() => {
        if (ctx.autoLookupInFlight.size > peak) peak = ctx.autoLookupInFlight.size;
    }, 5);
    for (const c of codes) {
        ctx.pendingBarcode = c;
        ctx.isModalOpen = true;
        vm.runInContext('attemptAutoLookup(' + JSON.stringify(c) + ')', ctx);
        await sleep(30);
    }
    await sleep(3000);
    clearInterval(watch);
    ok('⛔ ចំនួនស្របគ្នាមិនលើសពិដាន ' + ctx.AUTO_LOOKUP_MAX_IN_FLIGHT,
        peak <= ctx.AUTO_LOOKUP_MAX_IN_FLIGHT, { peak });
    ok('⛔ ពិដានពិតជាត្រូវបានប៉ះ (សេណារីយ៉ូមានន័យ)', peak >= 2, { peak });
});

// ── ៣. ប្រអប់បិទ ➜ ការព្យាយាមឡើងវិញត្រូវឈប់ (កុំស៊ីបណ្តាញឥតប្រយោជន៍) ────
scenario('⛔ ប្រអប់បិទ ➜ ការព្យាយាមឡើងវិញត្រូវឈប់', async () => {
    const ctx = buildRuntime({ netDelayMs: 500 });
    // ស្កេន ៣ ➜ កញ្ចប់ទី ៣ ជាប់ជួរ
    for (const c of ['ZTOD0001', 'ZTOD0002', 'ZTOD0003']) {
        ctx.pendingBarcode = c;
        ctx.isModalOpen = true;
        vm.runInContext('attemptAutoLookup(' + JSON.stringify(c) + ')', ctx);
        await sleep(20);
    }
    // អ្នកប្រើបិទប្រអប់ភ្លាម (ចុច ✖️ ឬរក្សាទុក)
    ctx.isModalOpen = false;
    ctx.pendingBarcode = '';
    const netAtClose = ctx.__net;
    await sleep(2500);
    // ⛔ តឹង ៖ **គ្មានសំណើថ្មីសោះ**។ ពិដានធូរ (`+ 1`) ធ្វើឲ្យ mutation ដែលដក
    //   ការពិនិត្យ `pendingBarcode !== barcode` ចេញ **រស់រាន** — វាស់រួច។
    ok('⛔ ក្រោយប្រអប់បិទ ➜ គ្មានសំណើថ្មីសម្រាប់កញ្ចប់ដែលរង់ចាំ',
        ctx.__net === netAtClose, { netAtClose, netNow: ctx.__net });
    ok('⛔ គ្មានតួរម៉ោងជួររស់សល់ (កុំឲ្យស៊ីថ្ម)',
        !ctx.autoLookupQueueRetries || ctx.autoLookupQueueRetries.size === 0,
        ctx.autoLookupQueueRetries ? ctx.autoLookupQueueRetries.size : 'គ្មាន Map');
});

// ── ៤. បណ្តាញលឿន ៖ ឥរិយាបថដើមមិនត្រូវប្រែ ───────────────────────────────
scenario('⛔ ទិសផ្ទុយ ៖ បណ្តាញលឿន ➜ គ្មានការពន្យារបន្ថែម', async () => {
    const ctx = buildRuntime({ netDelayMs: 10 });
    const codes = ['ZTOE0001', 'ZTOE0002', 'ZTOE0003'];
    const startedAt = Date.now();
    for (const c of codes) {
        ctx.pendingBarcode = c;
        ctx.isModalOpen = true;
        await vm.runInContext('attemptAutoLookup(' + JSON.stringify(c) + ')', ctx);
    }
    const took = Date.now() - startedAt;
    ok('បណ្តាញលឿន ➜ គ្រប់កញ្ចប់បំពេញបាន', ctx.__filled.length === codes.length, ctx.__filled);
    ok('បណ្តាញលឿន ➜ គ្មានការពន្យារបន្ថែម (< 1500ms)', took < 1500, took + 'ms');
    ok('បណ្តាញលឿន ➜ សំណើ ១ ក្នុងមួយកញ្ចប់ (គ្មានការស្ទួន)',
        ctx.__net === codes.length, ctx.__net);
});

// ── ៥. ការដាស់ជួរភ្លាម ៖ កញ្ចប់ដែលរង់ចាំមិនត្រូវរង់ចាំតួរម៉ោងពេញ ─────────
// ⛔ ការវាស់នេះចាក់សោ `pumpAutoLookupQueue()`។ វិធីវាស់ ៖ ដាក់តួរម៉ោងជួរ
//   **៥ វិនាទី** ក្នុង sandbox — បើការដាស់ដំណើរការ កញ្ចប់ដែលរង់ចាំចាប់ផ្តើម
//   **ភ្លាមពេល lookup មុនចប់** (~200ms); បើគ្មានការដាស់ វាត្រូវរង់ចាំតួរម៉ោង
//   ពេញ។ គម្លាត **៥ ដង** ➜ ការវាស់មិនងាយមិនស្ថិតស្ថេរលើម៉ាស៊ីនយឺត។
scenario('⛔ ការដាស់ជួរ ៖ កញ្ចប់រង់ចាំចាប់ផ្តើមភ្លាមពេលមានកន្លែងទំនេរ', async () => {
    const ctx = buildRuntime({ netDelayMs: 100 });
    ctx.AUTO_LOOKUP_QUEUE_RETRY_MS = 5000;
    const codes = ['ZTOF0001', 'ZTOF0002', 'ZTOF0003'];
    const startedAt = Date.now();
    for (const c of codes) {
        ctx.pendingBarcode = c;
        ctx.isModalOpen = true;
        vm.runInContext('attemptAutoLookup(' + JSON.stringify(c) + ')', ctx);
    }
    // រង់ចាំ ១ វិនាទី — តិចជាងតួរម៉ោង ៥ វិនាទីច្រើន
    await sleep(1000);
    const lastCode = codes[codes.length - 1];
    ok('កញ្ចប់ដែលរង់ចាំបំពេញក្នុង ១ វិនាទី (តួរម៉ោង ៥ វិ.)',
        ctx.__filled.indexOf(lastCode) !== -1,
        { filled: ctx.__filled, took: (Date.now() - startedAt) + 'ms' });
});

// ── ៦. ពិដានពេលរង់ចាំ ៖ ជួរមិនត្រូវរស់អស់កល្ប ─────────────────────────
// ⛔ ជួរដែលគ្មានពិដានពេល ជាការស៊ីថ្មសុទ្ធសាធពេលបណ្តាញដាច់យូរ — ថ្នាក់ដដែល
//   នឹងមេរៀន `CUSTOMER_TABLE_SOON_MAX_WAIT_MS` (2.23.0)។ Sandbox បន្ថយពិដាន
//   ដើម្បីវាស់បានលឿន; កូដ ship ប្រើ ២០ វិនាទី។
scenario('⛔ ជួរត្រូវបោះបង់ក្រោយពិដានពេល (កុំរស់អស់កល្ប)', async () => {
    const ctx = buildRuntime({ netDelayMs: 3000 });
    ctx.AUTO_LOOKUP_QUEUE_MAX_WAIT_MS = 250;
    ctx.AUTO_LOOKUP_QUEUE_RETRY_MS = 80;
    for (const c of ['ZTOG0001', 'ZTOG0002', 'ZTOG0003']) {
        ctx.pendingBarcode = c;
        ctx.isModalOpen = true;
        vm.runInContext('attemptAutoLookup(' + JSON.stringify(c) + ')', ctx);
    }
    await sleep(900);
    ok('⛔ ជួរត្រូវទទេក្រោយពិដានពេល',
        ctx.autoLookupQueueRetries.size === 0, ctx.autoLookupQueueRetries.size);
    const last = ctx.__statuses[ctx.__statuses.length - 1];
    ok('⛔ អ្នកប្រើត្រូវដឹងថាត្រូវស្កេនម្ដងទៀត',
        !!last && /ស្កេនម្ដងទៀត/.test(last.text), last && last.text);
});

// ── ៧. ស្តាទិច ៖ ជួរត្រូវសម្អាតពេលចាកចេញ / ប្តូរ Config ────────────────
// ⛔ `autoLookupQueueRetries` ជា **`const` Map** ➜ វាស្ថិត **ក្រៅវិសាលភាព**
//   របស់ `state-hygiene.js` (ដែលស្កេនតែអថេរ `let` កម្រិត module) ដូច
//   `autoLookupInFlight` និង `lookupFastCache` ដែរ។ ដូច្នេះការចងភ្ជាប់នេះ
//   ត្រូវអះអាងនៅទីនេះ បើមិនដូច្នេះ **គ្មានឧបករណ៍ណាឃើញវាទេ** — វាស់រួច ៖
//   mutation ដែលដក `clearAutoLookupQueueRetries()` ចេញ **រស់រាន**។
scenario('⛔ ស្តាទិច ៖ ការសម្អាត cache ត្រូវសម្អាតជួរដែរ', () => {
    const cleaner = sliceFn('clearCustomerDataTableCache');
    ok('រកឃើញ clearCustomerDataTableCache()', !!cleaner);
    ok('⛔ clearCustomerDataTableCache() ហៅ clearAutoLookupQueueRetries()',
        !!cleaner && cleaner.indexOf('clearAutoLookupQueueRetries()') !== -1);
    // ទិសផ្ទុយ ៖ អ្នកសម្អាតត្រូវនៅតែសម្អាតសោ in-flight និង cache ដដែល
    ok('⛔ ទិសផ្ទុយ ៖ នៅតែសម្អាត autoLookupInFlight',
        !!cleaner && cleaner.indexOf('autoLookupInFlight.clear()') !== -1);
    ok('⛔ ទិសផ្ទុយ ៖ នៅតែសម្អាត lookupFastCache',
        !!cleaner && cleaner.indexOf('lookupFastCache.clear()') !== -1);
});

// ── ៨. ⛔ ធាតុជួរកំព្រា មិនត្រូវបំពុលការស្កេនម្តងក្រោយ ───────
// 🔴 **កំហុសពិត** (វាស់បាន 2026-09-02) ៖ `attemptAutoLookup()` ចេញមុនពេល
//   មានកន្លែង (cache ហិត · តារាងអតិថិជន · PIN · ក្រៅបណ្តាញ · cooldown)
//   ក្រោយពីធាតុចូជួររួច ➔ ធាតុនោះ **មិនត្រូវបានលុបចេញ** ៖
//   វានៅក្នុង Map ជាមួយ `armedAt` ចាស់ជានិច្ច។
//   ➔ ការស្កេន barcode ដដែលម្តងក្រោយ (នាទីឬម៉ោងក្រោយ) ឃើញ `elapsedSince(armedAt)`
//   លើសពិដាន ➔ **បដិសេធភ្លាម។** អ្នកប្រើឃើញ «⏳ Lookup រវល់យូរពេក»
//   ខណៈពុំមានការរង់ចាំណាមួយកើតឡើង ➔ **កញ្ចប់មិនបំពេញស្វ័យប្រវត្តិ ១ ដង**។
//
// ⛔ ការអៈអាងមាន **២ ខាង** ៖ ធាតុកំព្រាមិនបំពុល (ខាងនេះ) **និង**
//   ពិដានពេលនៅតែទប់លើការរង់ចាំពិត (សេណារីយ៉ូ៦ ខាងលើ)។
scenario('⛔ ធាតុជួរកំព្រា មិនត្រូវបំពុលការស្កេនម្តងក្រោយ', async () => {
    const ctx = buildRuntime({ netDelayMs: 1200 });
    ctx.AUTO_LOOKUP_QUEUE_MAX_WAIT_MS = 300;
    ctx.AUTO_LOOKUP_QUEUE_RETRY_MS = 60;
    const X = 'ZTOH0001';
    let tableRow = null;
    ctx.findCustomerDataTableRow = (bc) => (tableRow && tableRow.code === bc ? tableRow : null);

    for (const c of ['ZTOH9001', 'ZTOH9002']) {
        ctx.pendingBarcode = c;
        vm.runInContext('attemptAutoLookup(' + JSON.stringify(c) + ')', ctx);
    }
    ctx.pendingBarcode = X;
    vm.runInContext('attemptAutoLookup(' + JSON.stringify(X) + ')', ctx);
    await sleep(20);
    ok('កញ្ចប់ទី ៣ ចូលជួរដូចគ្នា', ctx.autoLookupQueueRetries.has(X));

    tableRow = { code: X, phone: '0974158508', cod: 1, dod: 0 };
    await sleep(160);
    ok('⛔ cache ហិត ➔ ធាតុជួរត្រូវលុបចេញ (កុំទុកកំព្រា)',
        !ctx.autoLookupQueueRetries.has(X), [...ctx.autoLookupQueueRetries.keys()]);

    await sleep(400);
    tableRow = null;
    ctx.autoLookupInFlight.clear();
    ctx.__statuses.length = 0;
    for (const c of ['ZTOH9101', 'ZTOH9102']) {
        ctx.pendingBarcode = c;
        vm.runInContext('attemptAutoLookup(' + JSON.stringify(c) + ')', ctx);
    }
    ctx.pendingBarcode = X;
    vm.runInContext('attemptAutoLookup(' + JSON.stringify(X) + ')', ctx);
    await sleep(30);
    const mine = ctx.__statuses.filter((st) => st.bc === X);
    ok('⛔ ការស្កេនថ្មីមិនត្រូវបដិសេធដោយ armedAt ចាស់',
        mine.some((st) => /រង់ចាំជួរ/.test(st.text))
        && !mine.some((st) => /រវល់យូរពេក/.test(st.text)),
        mine.map((st) => st.text));
});

// ── ៩. ⛔ ទូទៅ ៖ **រាល់** ផ្លូវចេញមុន ត្រូវដោះធាតុជួរ ─────────────
// ⛔ សេណារីយ៉ូ ៨ វាស់តែផ្លូវ «cache ហិត» ។ វាស់រួច (mutation) ៖ ការដក
//   `dropAutoLookupQueueEntry()` ចេញពីផ្លូវ **ក្រៅបណ្តាញ** ឬ **cooldown**
//   **រស់រាន** ➔ ចន្លោះក្នុងឧបករណ៍ខ្លួនវា។ ដូច្នេះការអៈអាងត្រូវជា
//   **លក្ខណៈទូទៅ** ៖ ក្រោយផ្លូវចេញមុនណាមួយ ធាតុជួរត្រូវលែងមាន។
const EARLY_EXITS = [
    { name: 'ក្រៅបណ្តាញ', arm: (ctx) => { ctx.navigator.onLine = false; } },
    { name: 'cooldown ក្រោយបរាជ័យ', arm: (ctx, code) => {
        ctx.autoLookupFailureAt.set(code.toUpperCase(), { at: Date.now(), ms: 30000 });
    } },
    { name: 'Config បិទ', arm: (ctx) => {
        ctx.getLookupApiConfig = () => ({ enabled: false, url: '' });
    } },
    { name: 'cache លឿនក្នុងឧបករណ៍', arm: (ctx, code) => {
        vm.runInContext('setFastLookupRow(' + JSON.stringify(code)
            + ', "0974158508", 5, 0, getLookupApiConfig())', ctx);
    } }
];
EARLY_EXITS.forEach((exit, i) => {
    scenario('⛔ ផ្លូវចេញមុន «' + exit.name + '» ត្រូវដោះធាតុជួរ', async () => {
        const ctx = buildRuntime({ netDelayMs: 1500 });
        ctx.AUTO_LOOKUP_QUEUE_MAX_WAIT_MS = 400;
        ctx.AUTO_LOOKUP_QUEUE_RETRY_MS = 50;
        const X = 'ZTOJ' + String(1000 + i);
        for (const c of ['ZTOJ90' + i + '1', 'ZTOJ90' + i + '2']) {
            ctx.pendingBarcode = c;
            vm.runInContext('attemptAutoLookup(' + JSON.stringify(c) + ')', ctx);
        }
        ctx.pendingBarcode = X;
        vm.runInContext('attemptAutoLookup(' + JSON.stringify(X) + ')', ctx);
        await sleep(15);
        ok('ធាតុចូជួររួច (មុនវាស់)', ctx.autoLookupQueueRetries.has(X));

        exit.arm(ctx, X);
        await sleep(140);
        ok('⛔ ក្រោយផ្លូវចេញមុន ➔ ធាតុជួរលែងមាន',
            !ctx.autoLookupQueueRetries.has(X), [...ctx.autoLookupQueueRetries.keys()]);
    });
});

(async () => {
    for (const s of scenarios) {
        console.log('\n-- ' + s.label + ' --');
        try { await s.fn(); }
        catch (e) { ok(s.label + ' (រត់មិនចប់)', false, String(e && e.message || e)); }
    }
    console.log('\n' + pass + ' ok, ' + fail + ' fail');
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.log('   FAIL  ការរត់ខូច ➜ ' + String(e && e.message || e));
    process.exit(1);
});
