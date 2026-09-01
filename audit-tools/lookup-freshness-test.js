// ⛔ ថ្នាក់កំហុស៖ **ការនាំចូលជោគជ័យ តែទិន្នន័យអតិថិជនមិនមកដល់។**
//
// 🔴 របាយការណ៍អ្នកប្រើ (2026-08-29)៖ *«សម្រួលការបញ្ចូលទិន្នន័យចូល sheet
//   លឿនគួរសម តែនៅពេលបញ្ចូលជោគជ័យ ហើយ វាយូទាញចូលណាស់»*។
//
// មូលហេតុឫសគល់ **២** ដែលបូកគ្នា៖
//
//   ១. `runSheetImport()` ហៅ `clearCustomerDataTableCache()` ➜ តារាងអតិថិជន
//      ក្នុងសតិ **ត្រូវលុបចោល** ហើយ **គ្មានអ្វីបំពេញវាវិញទេ** ➜ រាល់ការស្កេន
//      ក្រោយនាំចូល ធ្លាក់ទៅផ្លូវ `?code=` មួយៗ។ ⛔ តែជួរដេកដែលទើបនាំចូល
//      **អង្គុយក្នុងសតិរបស់ App រួចស្រេច** (វាជាឯកសារ Excel ដែលអ្នកប្រើទើប
//      រើស) — ការលុបចោលនោះបោះបង់ចម្លើយដែលដឹងស្រាប់។
//
//   ២. Apps Script របស់ Lookup API cache ជួរដេកក្រោមកូនសោ **ថេរ**
//      (`customer_rows`) អស់ **៣០០ វិនាទី** ➜ សូម្បី `?code=` ក៏ត្រឡប់
//      `found: false` សម្រាប់ barcode ដែលទើបនាំចូល **រហូតដល់ ៥ នាទី**។
//      ការនាំចូលធ្វើដោយ script **ផ្សេង** (`zto-import/Code.gs`) ➜ CacheService
//      របស់វាដាច់ដោយឡែក ➜ **គ្មានអ្នកណាលុប cache នោះសោះ**។
//
// ដូច្នេះលទ្ធផលដែលអ្នកប្រើឃើញ ៖ «នាំចូលរួចរាល់ ✅» រួច **វាយដោយដៃទាំងអស់**
// អស់រយៈពេល ៥ នាទី។
//
// ⛔ ឧបករណ៍នេះអះអាង **២ ខាង** គ្រប់កន្លែង ៖
//   · ការបំពេញត្រូវ **កើតឡើង** ក្រោយនាំចូល **និង** ត្រូវ **មិនកើត** ក្រោយសម្អាត
//   · `fresh=1` ត្រូវ **មាន** ពេលបង្ខំ **និង** ត្រូវ **គ្មាន** ពេលធម្មតា
//     (បើមិនដូច្នេះ cache ៥ នាទីក្លាយជាគ្មានប្រយោជន៍ ➜ ការស្កេនយឺតជាងមុន)
//   · ការទាញឡើងវិញត្រូវ **ពន្យារពេលរវល់** **និង** ត្រូវ **បាញ់ពេលទំនេរ**
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.LOOKUPFRESH_APP_DIR ? path.resolve(process.env.LOOKUPFRESH_APP_DIR) : path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');
const INDEX_HTML = path.join(ROOT, 'ZoeW', 'index.html');
const SHEET_API = path.join(ROOT, 'zto-import', 'google-sheets-api', 'Code.gs');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

function readOr(file) {
    try { return fs.readFileSync(file, 'utf8'); } catch (e) { return ''; }
}

const SRC = readOr(APP_JS);
const HTML = readOr(INDEX_HTML);
const GS = readOr(SHEET_API);

// === ជាន់អប្បបរមា — «គ្មានលំនាំអាក្រក់» ពិតដោយស្វ័យប្រវត្តិលើ input ទទេ ===
ok('អាន ZoeW/app.js បាន (ជាន់អប្បបរមា)', SRC.length > 100000, SRC.length);
ok('អាន ZoeW/index.html បាន (ជាន់អប្បបរមា)', HTML.length > 20000, HTML.length);
ok('អាន google-sheets-api/Code.gs បាន (ជាន់អប្បបរមា)', GS.length > 1000, GS.length);

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

const FNS = [
    'elapsedSince', 'linkIsFrugal', 'customerTablePrefetchAllowed',
    'lookupApiIsZto', 'lookupApiSupportsList', 'setLookupStatus',
    'sheetImportCellToText', 'sheetImportToMoney',
    'normalizeImportedCustomerRows', 'seedCustomerTableFromImport',
    'rememberCustomerTableRow', 'findCustomerDataTableRow',
    'buildCustomerListApiUrl', 'customerTableNeedsRefresh',
    'clearCustomerTableSoonRefresh', 'scheduleCustomerTableSoonRefresh',
    'runCustomerTableSoonRefresh', 'clearCustomerTableRetry',
    'scheduleCustomerTableRetry', 'runCustomerTableRetry',
    'retryTransientLookupResponse', 'lookupResponseError', 'markLookupTimeoutNoRetry',
    'lookupFailureCooldownMs', 'lookupFailureIsDefinitive', 'safeLookupReason',
    'clearCustomerDataTableCache', 'getNestedField',
    'getFastLookupRow', 'setFastLookupRow',
    'dropAutoLookupQueueEntry', 'scheduleAutoLookupQueueRetry',
    'pumpAutoLookupQueue', 'clearAutoLookupQueueRetries',
    'completeAppUnlock', 'retryPendingLookupAfterUnlock',
    'prefetchCustomerDataTableRowsIfConfigured',
    'attemptAutoLookup', 'runSheetImport'
];
const src = {};
FNS.forEach((n) => { src[n] = sliceFn(n); ok('រកឃើញ function ' + n + '()', !!src[n]); });

const DECLS = [
    'CUSTOMER_TABLE_CACHE_MS', 'CUSTOMER_TABLE_FAIL_COOLDOWN_MS',
    'CUSTOMER_TABLE_RETRY_STEPS_MS', 'CUSTOMER_TABLE_RETRY_BUSY_MS',
    'CUSTOMER_TABLE_SOON_MS', 'CUSTOMER_TABLE_SOON_BUSY_MS', 'CUSTOMER_TABLE_SOON_MAX_WAIT_MS',
    'customerTableSoonTimer', 'customerTableSoonArmedAt', 'customerTableIsPartial',
    'customerDataTableRows', 'customerDataTableFetchedAt', 'customerDataTableFetchPromise',
    'customerDataTableSessionGeneration', 'customerDataTableLastFailedAt',
    'customerTableRetryTimer', 'customerTableFailStreak',
    'autoLookupFailureAt', 'AUTO_LOOKUP_FAIL_COOLDOWN_MS', 'AUTO_LOOKUP_TRANSIENT_COOLDOWN_MS',
    'AUTO_LOOKUP_FAILURE_MAX', 'AUTO_LOOKUP_MAX_IN_FLIGHT',
    'AUTO_LOOKUP_TIMEOUT_MS',
    'LOOKUP_FAST_CACHE_TTL_MS', 'LOOKUP_FAST_CACHE_MAX', 'lookupFastCache',
    'autoLookupInFlight', 'autoLookupQueueRetries',
    'AUTO_LOOKUP_QUEUE_RETRY_MS', 'AUTO_LOOKUP_QUEUE_MAX_WAIT_MS',
    'lookupLockedNoticeShown', 'SHEET_IMPORT_MAX_ROWS', 'sheetImportBusy',
    'sheetImportSignature'
];
const decls = [];
DECLS.forEach((n) => {
    const m = SRC.match(new RegExp('^ *(?:let|const) ' + n + '\\b.*$', 'm'));
    ok('រកឃើញការប្រកាស ' + n, !!m);
    if (m) decls.push(m[0]);
});
ok('Fast Mode checkbox មានក្នុង API modal', HTML.includes('id="lookupApiFastModeCheckbox"'));
ok('Fast Mode ត្រូវបានរក្សាទុកក្នុង config', SRC.includes('fastMode: fastModeCb ? fastModeCb.checked : false'));
ok('Fast Mode cache ត្រូវបានអានមុន customer table', src.attemptAutoLookup && src.attemptAutoLookup.indexOf('getFastLookupRow') < src.attemptAutoLookup.indexOf('findCustomerDataTableRow'));
ok('Fast Mode cache ត្រូវបានសម្អាតជាមួយ customer cache', src.clearCustomerDataTableCache && src.clearCustomerDataTableCache.includes('lookupFastCache.clear()'));
ok('Fast Mode cache មាន TTL', src.getFastLookupRow && src.getFastLookupRow.includes('LOOKUP_FAST_CACHE_TTL_MS'));
ok('Fast Mode cache មានពិដាន', src.setFastLookupRow && src.setFastLookupRow.includes('LOOKUP_FAST_CACHE_MAX'));
ok('ការដោះសោ App ដោះសោ Lookup Secret ផង', src.completeAppUnlock && src.completeAppUnlock.includes('lookupSecretKey = await deriveLookupSecretKey(pin)'));
ok('Lookup ដែលរង់ចាំត្រូវបានសាកល្បងឡើងវិញក្រោយវាយ PIN', src.retryPendingLookupAfterUnlock && src.retryPendingLookupAfterUnlock.includes('attemptAutoLookup(barcode)'));
ok('ស្កេនដំបូងបើក PIN ដោយស្វ័យប្រវត្តិពេល Secret នៅជាប់សោ', src.attemptAutoLookup && src.attemptAutoLookup.includes("requestPinBeforeConfig(retryPendingLookupAfterUnlock, 'lookupApi')"));

function makeClock() {
    let now = 1000000, seq = 0;
    const timers = new Map();
    return {
        now: () => now,
        setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + (ms || 0), fn: fn }); return id; },
        clearTimeout: (id) => { timers.delete(id); },
        advance(ms) {
            const target = now + ms;
            for (;;) {
                let pickId = null, pick = null;
                timers.forEach((t, id) => { if (t.at <= target && (!pick || t.at < pick.at)) { pick = t; pickId = id; } });
                if (!pick) break;
                timers.delete(pickId);
                now = pick.at;
                pick.fn();
            }
            now = target;
        },
        pending: () => timers.size
    };
}

// ⛔ `Date` ក្នុង sandbox ត្រូវជា **constructor ពិត** — `sheetImportCellToText()`
// ប្រើ `value instanceof Date` ➜ វត្ថុធម្មតា `{ now }` បោះ TypeError។
function makeFakeDate(clock) {
    function FakeDate() {}
    FakeDate.now = clock.now;
    return FakeDate;
}

const CFG_URL = 'https://script.google.com/macros/s/AKfy/exec?code={barcode}&key=k';

function build(opts) {
    const o = opts || {};
    const clock = makeClock();
    const net = { urls: [], lookups: 0 };
    const el = () => ({ value: '', textContent: '', innerHTML: '', disabled: false });
    const ctx = {
        console: { error: () => {}, log: () => {}, warn: () => {} },
        Object: Object, Array: Array, Promise: Promise, JSON: JSON, String: String,
        Number: Number, Math: Math, isNaN: isNaN, parseFloat: parseFloat, Infinity: Infinity,
        encodeURIComponent: encodeURIComponent, URL: URL, Set: Set, Map: Map, Error: Error,
        Date: makeFakeDate(clock),
        setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
        navigator: { onLine: o.onLine === undefined ? true : o.onLine, connection: null },
        auth: { currentUser: { uid: 'u1' } },
        isModalOpen: !!o.isModalOpen,
        pendingBarcode: null,
        lookupSecretKey: null,
        window: {},
        document: { getElementById: () => el(), querySelectorAll: () => [] },
        confirm: () => true,
        alert: () => {},
        showToast: () => {},
        getLookupApiConfig: () => ({ url: CFG_URL, enabled: true, fastMode: !!o.fastMode, phoneField: 'phone', codField: 'cod', dodField: 'dod' }),
        renderCustomerDataTableStatus: () => {},
        filterCustomerDataTable: () => {},
        applyLookupFillToModal: () => {},
        preconnectToLookupHost: () => {},
        setSheetImportMsg: () => {},
        setSheetImportFoot: () => {},
        sheetImportStatusText: () => '',
        currentSheetImportMapping: () => ({ barcode: 0, dod: 1, cod: 2, phone: 3 }),
        sheetImportMappedRows: () => (o.importRows || []).map((r) => r.slice()),
        callSheetImportApi: (action, extra) => {
            net.import = { action: action, extra: extra };
            return Promise.resolve(o.importResult || { added: 0, updated: 0, unchanged: 0, rowsAfter: 0, sheetName: 'Customers' });
        },
        retryAsync: (fn) => fn(),
        fetchWithTimeout: (url) => {
            net.urls.push(url);
            if (url.indexOf('list=1') !== -1) {
                return Promise.resolve({ res: { ok: true }, body: { rows: o.serverRows || [] } });
            }
            net.lookups++;
            return Promise.resolve({ res: { ok: true }, body: o.lookupBody === undefined ? { found: false } : o.lookupBody });
        },
        __net: net, __clock: clock
    };
    vm.createContext(ctx);
    decls.forEach((d) => { try { vm.runInContext(d, ctx); } catch (e) {} });
    // ⛔ កូដពិតត្រូវចាក់ **ក្រោយ** stub ➜ វាឈ្នះជានិច្ច។
    FNS.forEach((n) => { if (src[n]) { try { vm.runInContext(src[n], ctx); } catch (e) {} } });
    // `fetchCustomerDataTableRows` ជាកូដពិត តែវាធំ ➜ យើងចាក់វាចុងក្រោយ
    const fetchSrc = sliceFn('fetchCustomerDataTableRows');
    if (fetchSrc) { try { vm.runInContext(fetchSrc, ctx); } catch (e) {} }
    return ctx;
}

const pendingScenarios = [];
function scenario(label, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            pendingScenarios.push(out.catch((e) => ok(label + ' (គាំង)', false, e && e.message)));
        }
    } catch (e) { ok(label + ' (គាំង)', false, e && e.message); }
}

const FILE_ROWS = [
    ['BC-A', 1.5, 2.5, '012345678'],
    ['BC-B', 0, 4, '098765432'],
    ['bc-a', 9, 9, '011111111']
];

// === ក. ការបំពេញតារាងភ្លាមក្រោយនាំចូល (ខាងវិជ្ជមាន) ===
scenario('នាំចូល replace ➜ តារាងឆ្លើយភ្លាម', async () => {
    const ctx = build({
        importRows: FILE_ROWS,
        importResult: { added: 2, updated: 0, unchanged: 0, rowsAfter: 2, sheetName: 'Customers' }
    });
    vm.runInContext('document.getElementById = (id) => (id === "siModeSel" ? { value: "replace" } : { value: "", textContent: "", innerHTML: "", disabled: false });', ctx);
    await vm.runInContext('runSheetImport()', ctx);
    const hit = vm.runInContext('findCustomerDataTableRow("BC-A")', ctx);
    ok('barcode ដែលទើបនាំចូល ➜ រកឃើញ **ក្នុងសតិ**', !!hit && hit.phone === '011111111', hit);
    ok('ស្ទួនក្នុងឯកសារ ➜ ជួរដេកចុងក្រោយឈ្នះ (ដូច server)', !!hit && hit.dod === 9 && hit.cod === 9, hit);
    ok('ចំនួនជួរដេកត្រូវនឹង rowsAfter ➜ តារាងពេញលេញ', vm.runInContext('customerTableIsPartial === false', ctx));
    ok('គ្មានសំណើបណ្តាញណាមួយសម្រាប់ការបំពេញនោះ', ctx.__net.lookups === 0, ctx.__net);
    ok('តារាងចាត់ទុកជា **ស្រស់**', vm.runInContext('elapsedSince(customerDataTableFetchedAt) < CUSTOMER_TABLE_CACHE_MS', ctx));
});

scenario('នាំចូល upsert ➜ merge លើតារាងចាស់', () => {
    const ctx = build({
        importRows: [['BC-B', 7, 8, '099999999']],
        importResult: { added: 0, updated: 1, unchanged: 0, rowsAfter: 3, sheetName: 'Customers' }
    });
    vm.runInContext('customerDataTableRows = [{ barcode: "BC-OLD", dod: 1, cod: 1, phone: "010" }, { barcode: "BC-B", dod: 0, cod: 4, phone: "098" }];', ctx);
    vm.runInContext('seedCustomerTableFromImport([["BC-B", 7, 8, "099999999"]], "upsert", 3);', ctx);
    const old = vm.runInContext('findCustomerDataTableRow("BC-OLD")', ctx);
    const upd = vm.runInContext('findCustomerDataTableRow("BC-B")', ctx);
    ok('ជួរដេកចាស់ដែលមិនមានក្នុងឯកសារ ➜ **នៅដដែល**', !!old && old.phone === '010', old);
    ok('ជួរដេកដែលមានក្នុងឯកសារ ➜ តម្លៃថ្មីឈ្នះ', !!upd && upd.cod === 8 && upd.phone === '099999999', upd);
    ok('២ ជួរដេក តែ rowsAfter ៣ ➜ តារាង **មិនពេញលេញ**', vm.runInContext('customerTableIsPartial === true', ctx));
});

scenario('នាំចូល newOnly ➜ តម្លៃចាស់មិនត្រូវសរសេរជាន់', () => {
    const ctx = build({});
    vm.runInContext('customerDataTableRows = [{ barcode: "BC-B", dod: 0, cod: 4, phone: "098" }];', ctx);
    vm.runInContext('seedCustomerTableFromImport([["BC-B", 7, 8, "099"], ["BC-NEW", 1, 2, "077"]], "newOnly", 2);', ctx);
    const kept = vm.runInContext('findCustomerDataTableRow("BC-B")', ctx);
    const added = vm.runInContext('findCustomerDataTableRow("BC-NEW")', ctx);
    ok('newOnly ➜ barcode ដែលមានស្រាប់ **រក្សាតម្លៃចាស់**', !!kept && kept.cod === 4 && kept.phone === '098', kept);
    ok('newOnly ➜ barcode ថ្មីត្រូវបន្ថែម', !!added && added.cod === 2, added);
});

// === ខ. ទិសផ្ទុយ — ការសម្អាតមិនត្រូវរស់ឡើងវិញ ===
scenario('ទិសផ្ទុយ ៖ សម្អាត Sheet ➜ តារាងត្រូវទទេ', () => {
    ok('`runSheetImportClear()` ហៅ clearCustomerDataTableCache()',
        (sliceFn('runSheetImportClear') || '').indexOf('clearCustomerDataTableCache') !== -1);
    ok('⛔ `runSheetImportClear()` **មិន** ហៅ seedCustomerTableFromImport()',
        (sliceFn('runSheetImportClear') || 'x').indexOf('seedCustomerTableFromImport') === -1);
    ok('`runSheetImport()` ហៅ seedCustomerTableFromImport()',
        (src.runSheetImport || '').indexOf('seedCustomerTableFromImport') !== -1);
    const ctx = build({});
    vm.runInContext('customerDataTableRows = [{ barcode: "BC-A", dod: 1, cod: 1, phone: "010" }]; customerTableIsPartial = true; customerTableSoonTimer = setTimeout(() => {}, 5000);', ctx);
    vm.runInContext('clearCustomerDataTableCache();', ctx);
    ok('ចាកចេញ/សម្អាត ➜ គ្មានជួរដេកសល់', vm.runInContext('customerDataTableRows === null', ctx));
    ok('ចាកចេញ/សម្អាត ➜ ទង់ «មិនពេញលេញ» ត្រូវ reset', vm.runInContext('customerTableIsPartial === false', ctx));
    ok('ចាកចេញ/សម្អាត ➜ នាឡិកាទាញឡើងវិញត្រូវលុប', vm.runInContext('customerTableSoonTimer === null', ctx) && ctx.__clock.pending() === 0);
});

// === គ. `fresh=1` — អះអាង ២ ខាង ===
scenario('URL បង្ខំយក fresh=1 តែពេលស្នើ', () => {
    const ctx = build({});
    const plain = vm.runInContext('buildCustomerListApiUrl(getLookupApiConfig())', ctx);
    const fresh = vm.runInContext('buildCustomerListApiUrl(getLookupApiConfig(), true)', ctx);
    ok('URL ធម្មតាមាន list=1', typeof plain === 'string' && plain.indexOf('list=1') !== -1, plain);
    ok('⛔ URL ធម្មតា **គ្មាន** fresh=1 (cache ៥ នាទីត្រូវនៅមានប្រយោជន៍)',
        typeof plain === 'string' && plain.indexOf('fresh=') === -1, plain);
    ok('URL បង្ខំមាន fresh=1', typeof fresh === 'string' && fresh.indexOf('fresh=1') !== -1, fresh);
});

scenario('ការទាញបង្ខំបញ្ជូន fresh=1 ដល់បណ្តាញពិត', async () => {
    const ctx = build({ serverRows: [{ barcode: 'BC-Z', dod: 1, cod: 2, phone: '012' }] });
    await vm.runInContext('fetchCustomerDataTableRows(true, true)', ctx);
    ok('សំណើដែលចេញមាន fresh=1', ctx.__net.urls.length === 1 && ctx.__net.urls[0].indexOf('fresh=1') !== -1, ctx.__net.urls);
    const ctx2 = build({ serverRows: [] });
    await vm.runInContext('fetchCustomerDataTableRows(true)', ctx2);
    ok('⛔ ការទាញធម្មតា **មិន**បញ្ជូន fresh=1', ctx2.__net.urls.length === 1 && ctx2.__net.urls[0].indexOf('fresh=') === -1, ctx2.__net.urls);
});

scenario('ប៊ូតុង 🔄 ក្នុងតារាងអតិថិជនស្នើទិន្នន័យស្រស់', () => {
    const m = HTML.match(/data-act="fetchCustomerDataTableRows"[^>]*data-args='(\[[^']*\])'/);
    ok('រកឃើញប៊ូតុង 🔄', !!m, m && m[1]);
    let args = null;
    try { args = m ? JSON.parse(m[1]) : null; } catch (e) { args = null; }
    ok('ប៊ូតុង 🔄 បញ្ជូន [true, true] (បង្ខំ + ស្រស់)',
        Array.isArray(args) && args[0] === true && args[1] === true, args);
});

// === ឃ. ការទាញឡើងវិញពេលខកខាន — អះអាង ២ ខាង ===
scenario('ខកខាន ➜ តាំងម៉ោងទាញឡើងវិញ (ខាងវិជ្ជមាន)', () => {
    const ctx = build({});
    ok('តារាងទទេ ➜ ត្រូវការទាញឡើងវិញ', vm.runInContext('customerTableNeedsRefresh() === true', ctx));
    vm.runInContext('scheduleCustomerTableSoonRefresh();', ctx);
    ok('តាំងម៉ោងរួច', vm.runInContext('customerTableSoonTimer !== null', ctx));
    ctx.__clock.advance(vm.runInContext('CUSTOMER_TABLE_SOON_MS', ctx) + 1);
    ok('ទំនេរ ➜ ការទាញបាញ់ពិត', ctx.__net.urls.length === 1, ctx.__net.urls);
    ok('ការទាញនោះស្នើទិន្នន័យស្រស់', ctx.__net.urls.length === 1 && ctx.__net.urls[0].indexOf('fresh=1') !== -1, ctx.__net.urls);
});

scenario('ទិសផ្ទុយ ៖ តារាងស្រស់ និងពេញលេញ ➜ **មិន**ទាញឡើងវិញ', () => {
    const ctx = build({});
    vm.runInContext('customerDataTableRows = [{ barcode: "BC-A", dod: 1, cod: 1, phone: "010" }]; customerDataTableFetchedAt = Date.now(); customerTableIsPartial = false;', ctx);
    ok('តារាងស្រស់ ➜ មិនត្រូវការទាញឡើងវិញ', vm.runInContext('customerTableNeedsRefresh() === false', ctx));
    vm.runInContext('scheduleCustomerTableSoonRefresh();', ctx);
    ok('⛔ គ្មាននាឡិកាត្រូវតាំង (កុំវាយ Apps Script ឥតប្រយោជន៍)', vm.runInContext('customerTableSoonTimer === null', ctx));
    vm.runInContext('customerTableIsPartial = true; scheduleCustomerTableSoonRefresh();', ctx);
    ok('តារាងមិនពេញលេញ ➜ តាំងម៉ោងវិញ', vm.runInContext('customerTableSoonTimer !== null', ctx));
});

scenario('រវល់ ➜ ពន្យារ មិនមែនបោះបង់', () => {
    const ctx = build({ isModalOpen: true });
    vm.runInContext('scheduleCustomerTableSoonRefresh();', ctx);
    ctx.__clock.advance(vm.runInContext('CUSTOMER_TABLE_SOON_MS', ctx) + 1);
    ok('⛔ ខណៈប្រអប់បើក ➜ **មិន**បាញ់ចំពេលស្កេន', ctx.__net.urls.length === 0, ctx.__net.urls);
    ok('នៅតែមាននាឡិកាពន្យារ', vm.runInContext('customerTableSoonTimer !== null', ctx));
    vm.runInContext('isModalOpen = false;', ctx);
    ctx.__clock.advance(vm.runInContext('CUSTOMER_TABLE_SOON_BUSY_MS', ctx) + 1);
    ok('ប្រអប់បិទ ➜ បាញ់ភ្លាម', ctx.__net.urls.length === 1, ctx.__net.urls);
});

scenario('ការពន្យារមានពិដាន — មិនភ្ញាក់ជារៀងរហូត', () => {
    const ctx = build({ isModalOpen: true });
    vm.runInContext('scheduleCustomerTableSoonRefresh();', ctx);
    const maxWait = vm.runInContext('CUSTOMER_TABLE_SOON_MAX_WAIT_MS', ctx);
    ok('ពិដានរង់ចាំមានតម្លៃសមហេតុផល', typeof maxWait === 'number' && maxWait >= 30000 && maxWait <= 300000, maxWait);
    ctx.__clock.advance(maxWait + 10000);
    ok('ហួសពិដាន ➜ ឈប់ភ្ញាក់', ctx.__clock.pending() === 0, ctx.__clock.pending());
    ok('⛔ ហើយក៏មិនបាញ់សំណើខណៈរវល់ដែរ', ctx.__net.urls.length === 0, ctx.__net.urls);
});

// ⛔ ការទាញឡើងវិញមិនត្រូវរំលង cooldown ក្រោយបរាជ័យ — បើរំលង នោះការស្កេន
// ជាបន្តបន្ទាប់លើ server ដែលធ្លាក់ បង្កើតការទាញពេញ ២០ វិនាទីម្តងហើយម្តងទៀត
// ➜ **យឺតជាងមុន** ហើយជណ្តើរព្យាយាមវិញក្លាយជាគ្មានប្រយោជន៍។
scenario('ទើបធ្លាក់ ➜ ទុកឲ្យជណ្តើរធ្វើ មិនវាយម្តងទៀតភ្លាម', () => {
    const hot = build({});
    vm.runInContext('customerDataTableLastFailedAt = Date.now(); scheduleCustomerTableSoonRefresh(true);', hot);
    hot.__clock.advance(vm.runInContext('CUSTOMER_TABLE_SOON_MS', hot) + 1);
    ok('⛔ ក្នុង cooldown ➜ មិនវាយ Apps Script ម្តងទៀត', hot.__net.urls.length === 0, hot.__net.urls);
    const cool = build({});
    vm.runInContext('customerDataTableLastFailedAt = Date.now() - (CUSTOMER_TABLE_FAIL_COOLDOWN_MS + 1000); scheduleCustomerTableSoonRefresh(true);', cool);
    cool.__clock.advance(vm.runInContext('CUSTOMER_TABLE_SOON_MS', cool) + 1);
    ok('ទិសផ្ទុយ ៖ ហួស cooldown ➜ ទាញវិញធម្មតា', cool.__net.urls.length === 1, cool.__net.urls);
});

scenario('ការវាស់រយៈពេលឆ្លងកាត់ elapsedSince (នាឡិកាថយក្រោយ)', () => {
    const body = src.runCustomerTableSoonRefresh || '';
    ok('`runCustomerTableSoonRefresh()` ប្រើ elapsedSince()', body.indexOf('elapsedSince(') !== -1);
    ok('⛔ វាមិនប្រៀបធៀបនាឡិកាឆៅដោយផ្ទាល់', body.indexOf('Date.now() -') === -1, body.slice(0, 200));
});

// === ង. ការស្វែងរកតាមបណ្តាញ ត្រូវចិញ្ចឹមតារាងវិញ ===
scenario('ការស្វែងរកជោគជ័យ ➜ ចូលតារាង (រកម្តងទៀតឥតបណ្តាញ)', async () => {
    const ctx = build({ lookupBody: { found: true, barcode: 'BC-N', phone: '012999888', cod: 3, dod: 4 } });
    vm.runInContext('customerDataTableRows = []; customerDataTableFetchedAt = Date.now(); customerTableIsPartial = false; isModalOpen = true; pendingBarcode = "BC-N";', ctx);
    await vm.runInContext('attemptAutoLookup("BC-N")', ctx);
    ok('សំណើបណ្តាញ ១ ដង', ctx.__net.lookups === 1, ctx.__net);
    const row = vm.runInContext('findCustomerDataTableRow("BC-N")', ctx);
    ok('លទ្ធផលចូលតារាងក្នុងសតិ', !!row && row.phone === '012999888', row);
    await vm.runInContext('attemptAutoLookup("BC-N")', ctx);
    ok('⛔ ការស្កេនម្តងទៀត ➜ **គ្មានសំណើថ្មី**', ctx.__net.lookups === 1, ctx.__net);
});

scenario('ទិសផ្ទុយ ៖ រកមិនឃើញ ➜ មិនចាក់ជួរដេកទទេចូលតារាង', async () => {
    const ctx = build({ lookupBody: { found: false } });
    vm.runInContext('customerDataTableRows = []; customerDataTableFetchedAt = Date.now(); customerTableIsPartial = false;', ctx);
    await vm.runInContext('attemptAutoLookup("BC-MISSING")', ctx);
    ok('⛔ រកមិនឃើញ ➜ តារាងនៅទទេ', vm.runInContext('customerDataTableRows.length === 0', ctx),
        vm.runInContext('JSON.stringify(customerDataTableRows)', ctx));
});

scenario('ខកខានលើតារាងចាស់ ➜ តាំងម៉ោងទាញទាំងមូល', async () => {
    const ctx = build({ lookupBody: { found: false } });
    vm.runInContext('customerDataTableRows = null;', ctx);
    await vm.runInContext('attemptAutoLookup("BC-MISSING")', ctx);
    ok('ខកខានលើតារាងដែលមិនពេញលេញ ➜ តាំងម៉ោង', vm.runInContext('customerTableSoonTimer !== null', ctx));
});

// === ច. ការទាញជាមុនដែលត្រូវរំលងព្រោះរវល់ ត្រូវត្រឡប់មកវិញឆាប់ ===
scenario('ការទាញជាមុនខណៈរវល់ ➜ តាំងម៉ោងខ្លី មិនរង់ចាំ ៥ នាទី', () => {
    const ctx = build({ isModalOpen: true });
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', ctx);
    ok('រវល់ ➜ មិនបាញ់ភ្លាម', ctx.__net.urls.length === 0, ctx.__net.urls);
    ok('រវល់ ➜ តែតាំងម៉ោងទុក', vm.runInContext('customerTableSoonTimer !== null', ctx));
    const soon = vm.runInContext('CUSTOMER_TABLE_SOON_MS', ctx);
    const cache = vm.runInContext('CUSTOMER_TABLE_CACHE_MS', ctx);
    ok('ចន្លោះទាញឡើងវិញខ្លីជាង TTL ៥ នាទីច្រើន', soon < cache / 10, { soon: soon, cache: cache });
});

scenario('Fast Mode មិន cache លទ្ធផលរកមិនឃើញ', async () => {
    const miss = build({ fastMode: true, lookupBody: { found: false } });
    await vm.runInContext('attemptAutoLookup("BC-MISS")', miss);
    await vm.runInContext('attemptAutoLookup("BC-MISS")', miss);
    ok('រកមិនឃើញលើកទី១ ➜ លើកទី២នៅតែសួរ Server', miss.__net.lookups === 2, miss.__net);
    ok('គ្មាន negative cache ដែលបាំងទិន្នន័យថ្មី', vm.runInContext('lookupFastCache.size === 0', miss));

    const hit = build({ fastMode: true, lookupBody: { found: true, phone: '012', cod: 1, dod: 2 } });
    await vm.runInContext('attemptAutoLookup("BC-HIT")', hit);
    await vm.runInContext('attemptAutoLookup("BC-HIT")', hit);
    ok('ទិសផ្ទុយ៖ រកឃើញពិត ➜ Fast cache ទប់សំណើទី២', hit.__net.lookups === 1, hit.__net);
});

// === ឆ. ខាង server — Apps Script ===
function runSheetApi(options) {
    const o = options || {};
    const rows = o.rows || [];
    const calls = { get: [], put: [], ranges: 0 };
    const store = o.store || {};
    const cache = {
        get(key) { calls.get.push(key); return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
        put(key, value, ttl) { calls.put.push({ key: key, ttl: ttl }); store[key] = value; },
        remove(key) { delete store[key]; }
    };
    const sheet = {
        getLastRow: () => rows.length + 1,
        getRange: () => { calls.ranges++; return { getValues: () => rows.map((r) => r.slice()) }; }
    };
    const ctx = {
        PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'S' }) },
        SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
        CacheService: { getScriptCache: () => cache },
        Utilities: { newBlob: (v) => ({ getBytes: () => Array.from(Buffer.from(String(v), 'utf8')) }) },
        ContentService: {
            MimeType: { JSON: 'application/json' },
            createTextOutput: (v) => ({ value: v, setMimeType() { return this; } })
        }
    };
    vm.createContext(ctx);
    vm.runInContext(GS, ctx, { filename: 'Code.gs' });
    return {
        calls: calls, store: store,
        request: (params) => JSON.parse(ctx.doGet({ parameter: Object.assign({ key: 'S' }, params) }).value)
    };
}

scenario('Apps Script ៖ ចំនួនជួរដេកប្តូរ ➜ cache ខូចដោយស្វ័យប្រវត្តិ', () => {
    const store = {};
    const before = runSheetApi({ rows: [['OLD-1', 1, 2, '010']], store: store });
    before.request({ list: '1' });
    const keysBefore = Object.keys(store).slice();
    const after = runSheetApi({ rows: [['NEW-1', 1, 2, '011'], ['NEW-2', 3, 4, '012']], store: store });
    const out = after.request({ code: 'NEW-2' });
    ok('cache ចាស់មិនបាំង barcode ថ្មី', out.found === true && out.phone === '012', out);
    ok('កូនសោ cache ប្រែតាមចំនួនជួរដេក', Object.keys(store).length > keysBefore.length, Object.keys(store));
});

scenario('Apps Script ៖ fresh=1 រំលង cache ហើយសរសេរជាន់', () => {
    const store = {};
    const stale = runSheetApi({ rows: [['A', 1, 1, '010']], store: store });
    stale.request({ list: '1' });
    const key = Object.keys(store)[0];
    store[key] = JSON.stringify([['A', 9, 9, '099']]);
    const cachedRun = runSheetApi({ rows: [['A', 1, 1, '010']], store: store });
    const cachedOut = cachedRun.request({ code: 'A' });
    ok('⛔ ទិសផ្ទុយ ៖ គ្មាន fresh ➜ cache **នៅតែប្រើ**', cachedOut.phone === '099', cachedOut);
    ok('គ្មាន fresh ➜ មិនអានសន្លឹក', cachedRun.calls.ranges === 0, cachedRun.calls);
    const freshRun = runSheetApi({ rows: [['A', 1, 1, '010']], store: store });
    const freshOut = freshRun.request({ code: 'A', fresh: '1' });
    ok('fresh=1 ➜ អានសន្លឹកពិត', freshRun.calls.ranges === 1, freshRun.calls);
    ok('fresh=1 ➜ ទិន្នន័យពិតត្រឡប់មកវិញ', freshOut.phone === '010', freshOut);
    ok('fresh=1 ➜ សរសេរ cache ជាន់ឲ្យឧបករណ៍ដទៃ', JSON.parse(store[Object.keys(store)[0]])[0][3] === '010', store);
});

scenario('Apps Script ៖ ការហៅធម្មតានៅតែប្រើ cache (មិនធ្វើឲ្យយឺតជាងមុន)', () => {
    const store = {};
    const api = runSheetApi({ rows: [['A', 1, 1, '010']], store: store });
    api.request({ list: '1' });
    const first = api.calls.ranges;
    api.request({ code: 'A' });
    ok('ការហៅទី ២ មិនអានសន្លឹកម្តងទៀត', api.calls.ranges === first, api.calls);
});

Promise.all(pendingScenarios).then(() => {
    console.log('\n   ' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
}, (e) => {
    console.log('   FAIL  harness  ➜ ' + (e && e.message));
    process.exit(1);
});
