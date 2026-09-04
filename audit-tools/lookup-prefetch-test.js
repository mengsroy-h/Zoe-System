// ⛔ ថ្នាក់កំហុស៖ **ការទាញតារាងជាមុនដែលធ្លាក់ ទុកឲ្យរាល់ការស្កេនឆ្លងបណ្តាញ។**
//
// 🔴 វាស់ពី Sentry ពិត (2026-08-27, កំណែ 2.20.1)៖
//   `?list=1` ធ្លាក់ ២ ដង (២០ វិ. + ២០ វិ. ចំពិដានបេះបិទ) ➜ `customerDataTableRows`
//   នៅ `null` ➜ `attemptAutoLookup()` លែងមាន cache ➜ **រាល់ការស្កេនហៅ `?code=`**។
//   វាស់បាន៖ ១២ កញ្ចប់ / ៧២ វិនាទី = **~៦.៦ វិនាទី/កញ្ចប់** នៃការរង់ចាំសុទ្ធ
//   ហើយមួយក្នុងចំណោមនោះ timeout ➜ «Auto lookup timed out»។
//   មុនកែ ការព្យាយាមវិញរង់ចាំដល់ prefetch ជុំក្រោយ ➜ **រហូតដល់ ១៥ នាទី**។
//
// ⚠️ ការទាញជាមុននោះថ្លៃ ហើយវាទៅ **deployment Apps Script ដដែល** នឹង `?code=`
//   (`buildCustomerListApiUrl()` សាងពី `cfg.url` ដដែល) ➜ ការព្យាយាមវិញញឹកញាប់
//   **មិនត្រូវបាញ់ចំពេលអ្នកប្រើកំពុងស្កេន** បើមិនដូច្នេះការកែនេះនឹងធ្វើឲ្យ
//   auto lookup **យឺតជាងមុន** — ជាការជួញដូរដែលអ្នកប្រើសួរដោយផ្ទាល់។
//
// ឧបករណ៍នេះអះអាង **២ ខាង** គ្រប់កន្លែង៖ ច្រកទ្វារត្រូវទប់ពេលរវល់ **និង**
// ត្រូវ **អនុញ្ញាតពេលទំនេរ** — បើអះអាងតែខាងទប់ នោះ «មិនទាញសោះ» ក៏បៃតងដែរ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.LOOKUPPREFETCH_APP_DIR ? path.resolve(process.env.LOOKUPPREFETCH_APP_DIR) : path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');
const INDEX_HTML = path.join(ROOT, 'ZoeW', 'index.html');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

let SRC = '';
try { SRC = fs.readFileSync(APP_JS, 'utf8'); } catch (e) { SRC = ''; }
let HTML = '';
try { HTML = fs.readFileSync(INDEX_HTML, 'utf8'); } catch (e) { HTML = ''; }

ok('អាន ZoeW/app.js បាន (ជាន់អប្បបរមា)', SRC.length > 100000, SRC.length);
ok('រកឃើញផ្លូវទាញតារាងអតិថិជន', SRC.indexOf('fetchCustomerDataTableRows') !== -1);
ok('រកឃើញផ្លូវស្វែងរកស្វ័យប្រវត្តិ', SRC.indexOf('attemptAutoLookup') !== -1);

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

const FNS = ['dropAutoLookupQueueEntry', 'scheduleAutoLookupQueueRetry',
    'pumpAutoLookupQueue', 'clearAutoLookupQueueRetries',
    'elapsedSince', 'linkIsFrugal', 'customerTablePrefetchAllowed', 'preconnectToOrigin', 'preconnectToLookupHost',
    'lookupApiIsZto', 'lookupApiIsAppsScript', 'lookupApiSendsHeader', 'lookupApiSupportsList', 'warmZtoLookupProxyIfConfigured', 'warmZtoLookupProxyNow', 'buildCustomerListApiUrl',
    'prefetchCustomerDataTableRowsIfConfigured',
    'customerTableNeedsRefresh', 'clearCustomerTableSoonRefresh',
    'scheduleCustomerTableSoonRefresh', 'runCustomerTableSoonRefresh',
    'clearCustomerTableRetry', 'scheduleCustomerTableRetry', 'runCustomerTableRetry',
    'clearZtoWarmSoon', 'scheduleZtoWarmSoon', 'runZtoWarmSoon',
    'lookupIsWorkingOn', 'armLookupFocus'];
const src = {};
FNS.forEach((n) => { src[n] = sliceFn(n); ok('រកឃើញ function ' + n + '()', !!src[n]); });

const DECLS = ['CUSTOMER_TABLE_CACHE_MS', 'CUSTOMER_TABLE_FAIL_COOLDOWN_MS', 'CUSTOMER_TABLE_RETRY_STEPS_MS',
    'CUSTOMER_TABLE_RETRY_BUSY_MS', 'customerTableRetryTimer', 'customerTableFailStreak',
    'CUSTOMER_TABLE_SOON_MS', 'CUSTOMER_TABLE_SOON_BUSY_MS', 'CUSTOMER_TABLE_SOON_MAX_WAIT_MS',
    'customerTableSoonTimer', 'customerTableSoonArmedAt', 'customerTableIsPartial',
    'customerDataTableRows', 'customerDataTableFetchedAt',
    'ZTO_WARMUP_COOLDOWN_MS', 'ztoWarmupAt', 'ztoWarmupInFlight',
    'ztoWarmSoonTimer', 'ztoWarmSoonArmedAt',
    'LOOKUP_FOCUS_GRACE_MS', 'LOOKUP_MANUAL_FALLBACK_MS', 'LOOKUP_FOCUS_MAX_WAIT_MS',
    'AUTO_LOOKUP_TIMEOUT_MS', 'ZTO_AUTO_LOOKUP_TIMEOUT_MS', 'AUTO_LOOKUP_QUEUE_MAX_WAIT_MS',
    'autoLookupInFlight', 'autoLookupQueueRetries', 'pendingLookupUnlockBarcode'];
const decls = [];
DECLS.forEach((n) => {
    const m = SRC.match(new RegExp('^ *(?:let|const) ' + n + ' = .*$', 'm'));
    ok('រកឃើញការប្រកាស ' + n, !!m);
    if (m) decls.push(m[0]);
});

function makeClock() {
    let now = 0, seq = 0;
    const timers = new Map();
    return {
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
        pending: () => timers.size,
        now: () => now
    };
}

function build(opts) {
    const o = opts || {};
    const clock = makeClock();
    const calls = [];
    const warmCalls = [];
    const ctx = {
        console: { error: () => {}, log: () => {} },
        Object: Object, Array: Array, Promise: Promise, JSON: JSON, String: String, Math: Math,
        Date: o.dateNow ? { now: o.dateNow } : Date, Infinity: Infinity,
        setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
        navigator: { onLine: o.onLine === undefined ? true : o.onLine, connection: o.connection || null },
        auth: o.noAuth ? null : { currentUser: { uid: 'u1' } },
        isModalOpen: !!o.isModalOpen,
        pendingBarcode: o.pendingBarcode === undefined ? 'BC1' : o.pendingBarcode,
        getLookupApiConfig: () => (o.noCfg ? null : (o.cfg || { url: 'https://x/exec?code={barcode}&key=k', enabled: true })),
        URL: URL, Array: Array,
        document: { querySelectorAll: () => [], createElement: () => ({}), head: { appendChild: () => {} } },
        fetchCustomerDataTableRows: (force) => { calls.push(!!force); return Promise.resolve(); },
        fetchWithTimeout: (url, options) => { warmCalls.push({ url: url, options: options }); return Promise.resolve({ res: { ok: true, status: 204 } }); },
        isPinFlowPending: () => !!o.pinPending,
        __calls: calls, __warmCalls: warmCalls, __clock: clock, __opts: o
    };
    vm.createContext(ctx);
    decls.forEach((d) => { try { vm.runInContext(d, ctx); } catch (e) {} });
    FNS.forEach((n) => { if (src[n]) { try { vm.runInContext(src[n], ctx); } catch (e) {} } });
    if (o.inFlight) vm.runInContext('if (typeof autoLookupInFlight.set === "function") autoLookupInFlight.set("BC9", {}); else autoLookupInFlight.add("BC9");', ctx);
    if (o.lookupInFlight) vm.runInContext('if (typeof autoLookupInFlight.set === "function") autoLookupInFlight.set("BC1", {}); else autoLookupInFlight.add("BC1");', ctx);
    if (o.lookupQueued) vm.runInContext('autoLookupQueueRetries.set("BC1", { timer: null, armedAt: 0 });', ctx);
    if (o.lookupWaitingPin) vm.runInContext('pendingLookupUnlockBarcode = "BC1";', ctx);
    return ctx;
}

// ⛔ scenario ដែលត្រឡប់ promise ត្រូវ **រង់ចាំ** — បើអត់ ការអះអាងខាងក្នុង
// មិនដែលរត់ ហើយឯកសារចេញ exit 0 ➜ បៃតងក្លែងក្លាយ (ថ្នាក់ដដែលនឹងមេរៀន
// `sheet-import-test.js` ដែល try តែមួយគ្របទាំងអស់)។
const pendingScenarios = [];
function scenario(label, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            pendingScenarios.push(out.catch((e) => ok(label + ' (គាំង)', false, e && e.message)));
        }
    } catch (e) { ok(label + ' (គាំង)', false, e && e.message); }
}

// === ច្រកទ្វារ — អះអាង ២ ខាង ===
scenario('ច្រកទ្វារទាញជាមុន', () => {
    const idle = build({});
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', idle);
    ok('ទំនេរ ➜ ការទាញជាមុន **ដំណើរការ** (ខាងវិជ្ជមាន)', idle.__calls.length === 1, idle.__calls);

    const cases = [
        ['ប្រអប់លេខទូរស័ព្ទបើក (auto confirm កំពុងរង់ចាំ)', { isModalOpen: true }],
        ['មានការស្វែងរកកំពុងដំណើរការ', { inFlight: true }],
        ['ក្រៅបណ្តាញ', { onLine: false }],
        ['មិនទាន់ចូលប្រព័ន្ធ', { noAuth: true }],
        ['Data Saver', { connection: { saveData: true } }],
        ['តំណ 2G', { connection: { effectiveType: '2g' } }]
    ];
    cases.forEach((c) => {
        const ctx = build(c[1]);
        vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', ctx);
        ok('រវល់៖ ' + c[0] + ' ➜ មិនទាញជាមុន', ctx.__calls.length === 0, ctx.__calls);
    });
});

scenario('ZTO មិនគាំទ្រការទាញតារាង list=1', () => {
    const ztoCfg = { url: '/.netlify/functions/zto-order-detail?barcode={barcode}', enabled: true };
    const zto = build({ cfg: ztoCfg });
    ok('សម្គាល់ ZTO proxy បាន', vm.runInContext('lookupApiIsZto(getLookupApiConfig())', zto) === true);
    ok('ZTO ត្រូវប្រកាសថាមិនគាំទ្រ list', vm.runInContext('lookupApiSupportsList(getLookupApiConfig())', zto) === false);
    ok('ZTO list URL ត្រូវជា null មិនមែន ?list=1', vm.runInContext('buildCustomerListApiUrl(getLookupApiConfig())', zto) === null);
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', zto);
    ok('ZTO មិនបាញ់ list request ពេល prefetch', zto.__calls.length === 0, zto.__calls);
    ok('ZTO មិនតាំង timer list ដែលនឹងប្រជែង lookup', zto.__clock.pending() === 0, zto.__clock.pending());
    ok('ZTO ត្រូវ warm proxy មុន scan ដំបូង', zto.__warmCalls.length === 1, zto.__warmCalls);
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', zto);
    ok('warmup ដដែលមិនបាញ់ស្ទួនក្នុង cooldown', zto.__warmCalls.length === 1, zto.__warmCalls);
    ok('warmup ប្រើ OPTIONS មិនផ្ញើ Barcode ឬ Secret', zto.__warmCalls[0] && zto.__warmCalls[0].options.method === 'OPTIONS' && zto.__warmCalls[0].url.indexOf('{barcode}') === -1, zto.__warmCalls[0]);

    const ztoTrailingSlash = build({ cfg: { url: 'https://example.net/.netlify/functions/zto-order-detail/?barcode={barcode}', enabled: true } });
    ok('ZTO URL ដែលមាន slash ខាងចុង នៅតែត្រូវសម្គាល់ជា ZTO',
        vm.runInContext('lookupApiIsZto(getLookupApiConfig())', ztoTrailingSlash) === true);
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', ztoTrailingSlash);
    ok('ZTO URL ដែលមាន slash ខាងចុង មិនបាញ់ list=1',
        ztoTrailingSlash.__calls.length === 0 && ztoTrailingSlash.__warmCalls.length === 1,
        [ztoTrailingSlash.__calls, ztoTrailingSlash.__warmCalls]);

    // ⛔ warm-up តាម **ចេតនារបស់អ្នកប្រើ** មិនមែនតាមវដ្ត ៥ នាទីតែម្យ៉ាង។
    // វដ្តនោះអាចបាញ់ចុងក្រោយ ៩ នាទីមុន ➜ Lambda ត្រជាក់វិញ ➜ ការស្កេន
    // **ដំបូង** ចំណាយ cold start បូកការអាន Netlify Blobs។ ការបើកទំព័រ
    // «បញ្ចូលទិន្នន័យ» និងការបើកកាមេរ៉ា ជាសញ្ញាច្បាស់ថាការស្កេនជិតមកដល់។
    const intent = build({ cfg: ztoCfg });
    ok('warmZtoLookupProxyNow() warm ភ្លាមតាមចេតនា',
        vm.runInContext('warmZtoLookupProxyNow()', intent) === true && intent.__warmCalls.length === 1,
        intent.__warmCalls);
    ok('⛔ ការហៅភ្លាមៗម្តងទៀត មិនបាញ់ស្ទួន (cooldown ១០ នាទី)',
        vm.runInContext('warmZtoLookupProxyNow()', intent) === false && intent.__warmCalls.length === 1,
        intent.__warmCalls);

    const busyIntent = build({ cfg: ztoCfg, isModalOpen: true });
    ok('⛔ ប្រអប់បើក (កំពុងស្កេន) ➜ warm-up មិនជាន់ការស្កេន',
        vm.runInContext('warmZtoLookupProxyNow()', busyIntent) === false && busyIntent.__warmCalls.length === 0,
        busyIntent.__warmCalls);
    // ⛔ ទ្វារទី ២ នៃថ្នាក់ដដែល ៖ ការត្រៀមតាម **ចេតនា** (ត្រឡប់មក App ·
    //   ប្តូរទៅទំព័របញ្ចូល · បើកកាមេរ៉ា) ក៏មិនត្រូវបោះបង់ស្ងាត់ពេលរវល់ដែរ។
    ok('⛔ ចេតនាពេលរវល់ ➜ **តាំងម៉ោងឡើងវិញ** មិនបោះបង់',
        busyIntent.__clock.pending() >= 1, busyIntent.__clock.pending());
    vm.runInContext('isModalOpen = false;', busyIntent);
    busyIntent.__clock.advance(vm.runInContext('CUSTOMER_TABLE_SOON_BUSY_MS', busyIntent) + 1);
    ok('⛔ ចេតនា ➜ ទំនេរវិញ ➜ ការត្រៀមកើតឡើងពិត',
        busyIntent.__warmCalls.length === 1, busyIntent.__warmCalls);

    const busyApiIntent = build({ isModalOpen: true });
    vm.runInContext('warmZtoLookupProxyNow()', busyApiIntent);
    ok('⛔ ទិសផ្ទុយ ៖ API ធម្មតាពេលរវល់ ➜ មិនតាំងម៉ោងត្រៀម ZTO',
        busyApiIntent.__clock.pending() === 0 && busyApiIntent.__warmCalls.length === 0,
        busyApiIntent.__clock.pending() + '/' + busyApiIntent.__warmCalls.length);
    const offlineIntent = build({ cfg: ztoCfg, onLine: false });
    ok('⛔ ក្រៅបណ្តាញ ➜ warm-up មិនបាញ់',
        vm.runInContext('warmZtoLookupProxyNow()', offlineIntent) === false && offlineIntent.__warmCalls.length === 0,
        offlineIntent.__warmCalls);
    const apiIntent = build({});
    ok('⛔ Apps Script (មិនមែន ZTO) ➜ warm-up មិនបាញ់ OPTIONS',
        vm.runInContext('warmZtoLookupProxyNow()', apiIntent) === false && apiIntent.__warmCalls.length === 0,
        apiIntent.__warmCalls);

    // ស្នាមភ្ជាប់ ៖ warm-up ត្រូវ **ឈានដល់បាន** ពីផ្លូវចេតនាទាំង ២
    const fnBody = (name) => {
        const at = SRC.search(new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('));
        if (at === -1) return '';
        let depth = 0;
        const start = SRC.indexOf('{', SRC.indexOf(')', at));
        for (let k = start; k < SRC.length; k++) {
            if (SRC[k] === '{') depth++;
            else if (SRC[k] === '}') { depth--; if (!depth) return SRC.slice(at, k + 1); }
        }
        return '';
    };
    ok('⛔ ការបើកទំព័រ «បញ្ចូលទិន្នន័យ» ហៅ warm-up',
        fnBody('switchAppPage').indexOf('warmZtoLookupProxyNow()') !== -1);
    ok('⛔ ការបើកកាមេរ៉ាហៅ warm-up',
        fnBody('requestCameraPermission').indexOf('warmZtoLookupProxyNow()') !== -1);

    const generic = build({});
    const genericUrl = vm.runInContext('buildCustomerListApiUrl(getLookupApiConfig())', generic);
    ok('ទិសផ្ទុយ៖ API តារាងធម្មតានៅតែមាន list=1', typeof genericUrl === 'string' && genericUrl.indexOf('list=1') !== -1, genericUrl);

    const ztoOffline = build({ cfg: ztoCfg, onLine: false });
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', ztoOffline);
    ok('ក្រៅបណ្ដាញ ➜ មិន warm', ztoOffline.__warmCalls.length === 0, ztoOffline.__warmCalls);
    const ztoSaver = build({ cfg: ztoCfg, connection: { saveData: true } });
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', ztoSaver);
    ok('Data Saver ➜ មិន warm', ztoSaver.__warmCalls.length === 0, ztoSaver.__warmCalls);

    const ztoDisabled = build({ cfg: Object.assign({}, ztoCfg, { enabled: false }) });
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', ztoDisabled);
    ok('ZTO ដែលបិទ ➜ មិន warm និងមិនបាញ់ request',
        ztoDisabled.__warmCalls.length === 0 && ztoDisabled.__calls.length === 0,
        [ztoDisabled.__warmCalls, ztoDisabled.__calls]);
});

// === ⛔ ការត្រៀមតំណទៅ Lookup API ===
// Lookup API ត្រូវហៅ **រាល់ការស្កេន** ហើយ CLAUDE.md វាស់រួចថាល្បឿនរបស់វា
// កំណត់ចង្វាក់ការងារអ្នកប្រើដោយផ្ទាល់។ សំណើដំបូងក្នុងវគ្គមួយត្រូវបង់ថ្លៃ
// **DNS + TCP + TLS** ទាំងស្រុង (២០០–៦០០ms លើ 4G អន់) — ថ្លៃនោះកាត់បាន
// ដោយ `<link rel="preconnect">` ។ `index.html` ធ្វើវារួចសម្រាប់ gstatic ·
// fonts · identitytoolkit · securetoken តែ **មិនធ្វើសម្រាប់ host នៃ
// Lookup API** ដែលជា host ដែលប៉ះលំហូរការងារខ្លាំងជាងគេ។
// ⛔ វាត្រូវធ្វើ **តាមលក្ខខណ្ឌ** ៖ អ្នកប្រើដែលមិនកំណត់ Lookup API មិនត្រូវ
// បង់ថ្លៃ handshake ឥតប្រយោជន៍ទេ (ថ្នាក់ដដែលនឹង `linkIsFrugal()`)។
scenario('ការត្រៀមតំណទៅ Lookup API', () => {
    const fnSrc = sliceFn('preconnectToLookupHost');
    ok('រកឃើញ function preconnectToLookupHost()', !!fnSrc);
    if (!fnSrc) return;

    function buildPre(o) {
        const added = [];
        const ctx = {
            console: { error: () => {}, log: () => {} },
            URL: URL, Array: Array, String: String, Object: Object,
            getLookupApiConfig: () => o.cfg,
            document: {
                querySelectorAll: () => o.existing || [],
                createElement: () => ({}),
                head: { appendChild: (el) => added.push(el) }
            },
            __added: added
        };
        vm.createContext(ctx);
        vm.runInContext(sliceFn('preconnectToOrigin'), ctx);
        vm.runInContext(fnSrc, ctx);
        return ctx;
    }

    const withCfg = buildPre({ cfg: { url: 'https://script.google.com/macros/s/AKfy/exec?code={barcode}', enabled: true } });
    vm.runInContext('preconnectToLookupHost();', withCfg);
    ok('មាន Config ➜ បន្ថែម <link rel=preconnect> ១',
        withCfg.__added.length === 1, withCfg.__added.length);
    ok('ហើយវាចង្អុលទៅ **origin** មិនមែន URL ពេញ (គ្មាន path ឬ query)',
        withCfg.__added[0] && withCfg.__added[0].href === 'https://script.google.com',
        withCfg.__added[0] && withCfg.__added[0].href);
    ok('⛔ ហើយវាមិនបញ្ចេញ deployment ID ចេញក្រៅតាម attribute ណាមួយ',
        JSON.stringify(withCfg.__added[0] || {}).indexOf('AKfy') === -1, withCfg.__added[0]);

    const noCfg = buildPre({ cfg: null });
    vm.runInContext('preconnectToLookupHost();', noCfg);
    ok('⛔ ទិសផ្ទុយ ៖ គ្មាន Config ➜ **មិនបង់ថ្លៃ handshake** សោះ',
        noCfg.__added.length === 0, noCfg.__added.length);

    const disabled = buildPre({ cfg: { url: 'https://script.google.com/macros/s/x/exec', enabled: false } });
    vm.runInContext('preconnectToLookupHost();', disabled);
    ok('⛔ Config បិទ ➜ **មិនបង់ថ្លៃ handshake** សោះ',
        disabled.__added.length === 0, disabled.__added.length);

    const badUrl = buildPre({ cfg: { url: 'មិនមែន URL', enabled: true } });
    vm.runInContext('preconnectToLookupHost();', badUrl);
    ok('⛔ URL មិនត្រឹមត្រូវ ➜ មិនគាំង និងមិនបន្ថែមអ្វី',
        badUrl.__added.length === 0, badUrl.__added.length);

    const dup = buildPre({ cfg: { url: 'https://script.google.com/macros/s/x/exec', enabled: true },
                           existing: [{ href: 'https://script.google.com' }] });
    vm.runInContext('preconnectToLookupHost();', dup);
    ok('⛔ មានរួចហើយ ➜ មិនបន្ថែមស្ទួន', dup.__added.length === 0, dup.__added.length);
});

// === ⛔ ការស្វែងរកស្វ័យប្រវត្តិ ខណៈក្រៅបណ្តាញ ===
// ថ្នាក់កំហុស ៖ រាល់ផ្លូវបណ្តាញផ្សេងទៀតរបស់ App មានច្រកទ្វារ
// `navigator.onLine === false` (`customerTablePrefetchAllowed()` ·
// `callSheetImportApi()` · `networkLooksDown()` ក្នុង license-verify) —
// **តែ `attemptAutoLookup()` គ្មានទេ**។ ផល ៖ រាល់ការស្កេនខណៈក្រៅបណ្តាញ
// បាញ់សំណើដែលដឹងស្រាប់ថាធ្លាក់ រួច **រាយការណ៍ទៅ Sentry** ជារៀងរាល់ដង។
// ការស្កេនក្រៅបណ្តាញជាករណីធម្មតារបស់អាជីវកម្មនេះ ➜ សំឡេងរំខានក្នុង Sentry
// បាំងកំហុសពិត ហើយការស្កេនក៏យឺតដោយឥតប្រយោជន៍ដែរ។
let buildAutoRuntime = null;
scenario('ការស្វែងរកស្វ័យប្រវត្តិ ខណៈក្រៅបណ្តាញ', () => {
    const autoSrc = sliceFn('attemptAutoLookup');
    ok('រកឃើញ function attemptAutoLookup()', !!autoSrc);
    if (!autoSrc) return;

    function buildAuto(o) {
        const fetches = [];
        const captures = [];
        const filled = [];
        const unlockActions = [];
        const deferreds = [];
        const fetchOptions = [];
        const statusEl = { className: 'lookup-status', textContent: '', hidden: true };
        const modals = {
            phoneModal: { style: { display: 'none' } },
            editPhoneModal: { style: { display: 'none' } },
            callMarkModal: { style: { display: 'none' } },
            pinModal: { style: { display: 'none' } },
            pinSetupModal: { style: { display: 'none' } }
        };
        const inputs = { securityPinInput: { value: '' }, modalPhoneInput: { value: '', focus: () => {} } };
        const storeData = { zoew_security_pin_hash: 'pbkdf2:x' };
        const ctx = {
            console: { error: () => {}, log: () => {} },
            Object: Object, Array: Array, Promise: Promise, JSON: JSON, String: String, Number: Number,
            Math: Math, Date: Date, Error: Error, Set: Set, Map: Map, parseFloat: parseFloat, isNaN: isNaN,
            encodeURIComponent: encodeURIComponent,
            URL: URL,
            setTimeout: setTimeout, clearTimeout: clearTimeout,
            navigator: { onLine: o.onLine === undefined ? true : o.onLine },
            AUTO_LOOKUP_FAIL_COOLDOWN_MS: 30000,
            AUTO_LOOKUP_TRANSIENT_COOLDOWN_MS: 6000,
            AUTO_LOOKUP_FAILURE_MAX: 100,
            AUTO_LOOKUP_MAX_IN_FLIGHT: 2,
            AUTO_LOOKUP_TIMEOUT_MS: 16000,
            ZTO_AUTO_LOOKUP_TIMEOUT_MS: 58000,
            autoLookupInFlight: /const autoLookupInFlight = new Map\(\)/.test(SRC) ? new Map() : new Set(),
            autoLookupFailureAt: new Map(),
            autoLookupQueueRetries: new Map(),
            AUTO_LOOKUP_QUEUE_RETRY_MS: 400,
            AUTO_LOOKUP_QUEUE_MAX_WAIT_MS: 20000,
            lookupFastCache: new Map(),
            lookupLockedNoticeShown: false,
            lookupSecretKey: null,
            pendingLookupUnlockBarcode: '',
            pendingLookupUnlockResolve: null,
            pendingBarcode: 'BC1',
            isModalOpen: true,
            customerDataTableSessionGeneration: 0,
            customerDataTableRows: null,
            customerDataTableFetchedAt: 0,
            customerDataTableFetchPromise: null,
            customerDataTableLastFailedAt: 0,
            customerTableIsPartial: false,
            elapsedSince: (m) => (m ? Date.now() - m : Infinity),
            getFastLookupRow: () => null,
            setFastLookupRow: () => {},
            getLookupApiConfig: () => ({ url: o.appsScript
                                            ? 'https://script.google.com/macros/s/AKfycb/exec?code={barcode}&key=k'
                                            : (o.zto ? '/.netlify/functions/zto-order-detail?barcode={barcode}' : 'https://x/exec?code={barcode}'), enabled: true,
                                         fastMode: !!o.fastMode,
                                         headerName: o.locked ? 'X-Zoe-Proxy-Key' : '',
                                         headerValueEnc: o.locked ? { iv: [1], data: [2] } : null,
                                         phoneField: 'phone', codField: 'cod', dodField: 'dod' }),
            findCustomerDataTableRow: (bc) => (o.cached ? { phone: '012', cod: 1, dod: 2 } : null),
            scheduleCustomerTableSoonRefresh: () => {},
            clearCustomerTableRetry: () => {},
            clearCustomerTableSoonRefresh: () => {},
            rememberCustomerTableRow: () => {},
            applyLookupFillToModal: (bc, p2) => filled.push(p2),
            getNestedField: (d, k) => (d ? d[k] : null),
            showToast: () => {},
            decryptLookupSecret: () => Promise.resolve(o.secretPlain === undefined ? 'secret-value-123' : o.secretPlain),
            isPinFlowPending: () => false,
            requestPinBeforeConfig: (action) => unlockActions.push(action),
            retryAsync: (fn) => fn(),
            fetchWithTimeout: (url, options) => {
                fetches.push(url);
                fetchOptions.push(options || {});
                if (o.deferred) {
                    return new Promise((resolve, reject) => deferreds.push({ resolve: resolve, reject: reject }));
                }
                if (Array.isArray(o.httpPlan)) {
                    const status = Number(o.httpPlan[fetches.length - 1] || 200);
                    return Promise.resolve({
                        res: { ok: status >= 200 && status < 300, status: status },
                        body: status >= 200 && status < 300 ? { phone: '012', cod: 1, dod: 2, success: true } : null
                    });
                }
                const plan = Array.isArray(o.fetchPlan) ? o.fetchPlan[fetches.length - 1] : o.fetchSuccess;
                if (plan) return Promise.resolve({ res: { ok: true, status: 200 }, body: { phone: '012', cod: 1, dod: 2, success: true } });
                return Promise.reject(new TypeError('Failed to fetch'));
            },
            document: {
                getElementById: (id) => (id === 'lookupStatus' ? statusEl : (modals[id] || inputs[id] || null)),
                querySelectorAll: (sel) => (sel === '.modal' ? Object.keys(modals).map((k) => modals[k]) : []),
                body: { style: {} }
            },
            editingItemId: null,
            markingItemId: null,
            pinTargetAction: null,
            appLocalStore: { getItem: (k) => storeData[k] || null, setItem: (k, v) => { storeData[k] = v; }, removeItem: (k) => { delete storeData[k]; } },
            safeStoreGet: (store, k) => storeData[k] || null,
            safeStoreSet: (store, k, v) => { storeData[k] = v; },
            safeStoreRemove: (store, k) => { delete storeData[k]; },
            hashPin: () => Promise.resolve('pbkdf2:x'),
            deriveLookupSecretKey: () => Promise.resolve({ unlocked: true }),
            migrateLookupSecretIfNeeded: () => Promise.resolve(),
            openConfigModal: () => {},
            applyPinPromptText: () => {},
            refreshBiometricUi: () => {},
            isBiometricEnabled: () => false,
            runBiometricUnlock: () => {},
            showAppChrome: () => {},
            hidePhoneSuggestions: () => {},
            safeFocusScanner: () => {},
            resumeScanVideo: () => {},
            ZoeErrors: { capture: (e, c) => captures.push(c && c.context) },
            __fetches: fetches, __captures: captures, __filled: filled, __unlockActions: unlockActions,
            __status: statusEl, __deferreds: deferreds, __modals: modals, __store: storeData,
            __fetchOptions: fetchOptions,
            __modalIds: modals
        };
        ctx.window = ctx;
        vm.createContext(ctx);
        vm.runInContext(sliceFn('lookupApiIsZto'), ctx);
        vm.runInContext(sliceFn('lookupApiIsAppsScript') || 'function lookupApiIsAppsScript() { return false; }', ctx);
        vm.runInContext(sliceFn('lookupApiSendsHeader') || 'function lookupApiSendsHeader(cfg) { return !!(cfg && cfg.headerName); }', ctx);
        vm.runInContext(sliceFn('safeLookupReason'), ctx);
        vm.runInContext(sliceFn('setLookupStatus'), ctx);
        vm.runInContext(sliceFn('retryPendingLookupAfterUnlock'), ctx);
        vm.runInContext(sliceFn('lookupResponseError'), ctx);
        vm.runInContext(sliceFn('markLookupTimeoutNoRetry'), ctx);
        vm.runInContext(sliceFn('lookupFailureCooldownMs'), ctx);
        vm.runInContext(sliceFn('lookupFailureIsDefinitive'), ctx);
        vm.runInContext(sliceFn('retryTransientLookupResponse'), ctx);
        vm.runInContext(sliceFn('dropAutoLookupQueueEntry'), ctx);
        vm.runInContext(sliceFn('scheduleAutoLookupQueueRetry'), ctx);
        vm.runInContext(sliceFn('pumpAutoLookupQueue'), ctx);
        vm.runInContext(sliceFn('clearAutoLookupQueueRetries'), ctx);
        if (o.realModals) {
            ['clearLookupStatus', 'openModalHelper', 'closeModal', 'isPinFlowPending',
                'requestPinBeforeConfig', 'completePinUnlock'].forEach((n) => {
                const fnSrc = sliceFn(n);
                ok('រកឃើញ function ' + n + '() សម្រាប់ខ្សែសង្វាក់ PIN', !!fnSrc);
                if (fnSrc) vm.runInContext(fnSrc, ctx);
            });
        }
        if (o.realRetry) vm.runInContext(sliceFn('retryAsync'), ctx);
        if (o.loadClear) {
            // ⛔ រាល់ឈ្មោះដែល sandbox *ហៅ* ត្រូវមានក្នុង sandbox
            vm.runInContext('let ztoWarmSoonTimer = null; let ztoWarmSoonArmedAt = 0;', ctx);
            vm.runInContext(sliceFn('clearZtoWarmSoon') || 'function clearZtoWarmSoon() {}', ctx);
            vm.runInContext(sliceFn('clearCustomerDataTableCache'), ctx);
        }
        vm.runInContext(autoSrc, ctx);
        return ctx;
    }
    buildAutoRuntime = buildAuto;

    // ខាងវិជ្ជមាន — មានបណ្តាញ ➜ សំណើត្រូវចេញធម្មតា
    const online = buildAuto({});
    return vm.runInContext('attemptAutoLookup("BC1")', online).then(() => {
        ok('⛔ ទិសផ្ទុយ ៖ មានបណ្តាញ ➜ សំណើស្វែងរកចេញធម្មតា',
            online.__fetches.length === 1, online.__fetches);

        // ខាងអវិជ្ជមាន — ក្រៅបណ្តាញ ➜ មិនបាញ់សំណើ និងមិនរាយការណ៍ទៅ Sentry
        const offline = buildAuto({ onLine: false });
        return vm.runInContext('attemptAutoLookup("BC1")', offline).then(() => {
            ok('⛔ ក្រៅបណ្តាញ ➜ **មិនបាញ់សំណើស្វែងរកសោះ**',
                offline.__fetches.length === 0, offline.__fetches);
            ok('⛔ ក្រៅបណ្តាញ ➜ មិនរាយការណ៍កំហុសទៅ Sentry (សំឡេងរំខានបាំងកំហុសពិត)',
                offline.__captures.length === 0, offline.__captures);
            ok('⛔ ក្រៅបណ្តាញ ➜ សោស្វែងរកមិនជាប់ (មិនបន្សល់ធាតុក្នុង autoLookupInFlight)',
                offline.autoLookupInFlight.size === 0, offline.autoLookupInFlight.size);

            // ⛔ ទិសផ្ទុយទី ២ ៖ cache ក្នុងសតិត្រូវនៅតែបំពេញ **ទោះក្រៅបណ្តាញ**
            // (ការកែមិនត្រូវបិទផ្លូវដែលមិនត្រូវការបណ្តាញសោះ)
            const cachedOffline = buildAuto({ onLine: false, cached: true });
            return vm.runInContext('attemptAutoLookup("BC1")', cachedOffline).then(() => {
                ok('⛔ ទិសផ្ទុយ ៖ ក្រៅបណ្តាញ តែមានក្នុង cache ➜ **នៅតែបំពេញភ្លាម**',
                    cachedOffline.__filled.length === 1, cachedOffline.__filled);
            });
        });
    });
});

ok('Phone modal មានតំបន់ស្ថានភាព Lookup', HTML.indexOf('id="lookupStatus"') !== -1);
ok('ស្ថានភាព Lookup ប្រកាសទៅ screen reader', /id="lookupStatus"[^>]*role="status"[^>]*aria-live="polite"/.test(HTML));
const lookupStatusFn = sliceFn('setLookupStatus') || '';
ok('ស្ថានភាពប្រើ textContent ការពារ XSS', lookupStatusFn.indexOf('textContent') !== -1 && lookupStatusFn.indexOf('innerHTML') === -1);

scenario('ស្ថានភាព ZTO និង cooldown តាម Barcode មួយៗ', async () => {
    const ctx = buildAutoRuntime({ zto: true, fetchPlan: [false, true] });
    const first = vm.runInContext('attemptAutoLookup("BC1")', ctx);
    ok('ចាប់ផ្ដើមភ្លាម ➜ បង្ហាញថាកំពុងស្វែងរក ZTO', ctx.__status.textContent.indexOf('កំពុងស្វែងរកពី ZTO') !== -1, ctx.__status.textContent);
    await first;
    ok('បរាជ័យ ➜ បង្ហាញស្ថានភាព មិនមែនស្ងាត់', ctx.__status.hidden === false && ctx.__status.className.indexOf('error') !== -1, ctx.__status);
    vm.runInContext('pendingBarcode = "BC2";', ctx);
    await vm.runInContext('attemptAutoLookup("BC2")', ctx);
    ok('BC1 ខូច មិនរាំង BC2', ctx.__fetches.length === 2, ctx.__fetches);
    ok('BC2 ជោគជ័យ ➜ បង្ហាញស្ថានភាពរកឃើញ', ctx.__status.className.indexOf('success') !== -1, ctx.__status);
    vm.runInContext('pendingBarcode = "BC1";', ctx);
    await vm.runInContext('attemptAutoLookup("BC1")', ctx);
    ok('BC1 ដដែលក្នុង cooldown ➜ មិនបាញ់សំណើស្ទួន', ctx.__fetches.length === 2, ctx.__fetches);
    ok('cooldown ដដែលមានពេលរង់ចាំមើលឃើញ', ctx.__status.textContent.indexOf('ក្រោយ') !== -1, ctx.__status.textContent);
});

scenario('ស្ថានភាព API ធម្មតាមិនត្រូវហៅខុសថា ZTO', async () => {
    const ctx = buildAutoRuntime({ fetchSuccess: false });
    await vm.runInContext('attemptAutoLookup("BC1")', ctx);
    ok('API ធម្មតាបរាជ័យ ➜ សារប្រើ API មិនមែន ZTO',
        ctx.__status.textContent.indexOf('API') !== -1 && ctx.__status.textContent.indexOf('ZTO') === -1,
        ctx.__status.textContent);
});

scenario('HTTP បណ្ដោះអាសន្នត្រូវ retry តែ HTTP អចិន្ត្រៃយ៍មិនត្រូវបាញ់ស្ទួន', async () => {
    const transient = buildAutoRuntime({ zto: true, realRetry: true, httpPlan: [503, 200] });
    await vm.runInContext('attemptAutoLookup("BC1")', transient);
    ok('ZTO 503 ម្តង ➜ retry ហើយសំណើទី ២ ជោគជ័យ',
        transient.__fetches.length === 2 && transient.__status.className.indexOf('success') !== -1,
        [transient.__fetches.length, transient.__status.textContent]);

    const throttled = buildAutoRuntime({ zto: true, realRetry: true, httpPlan: [429, 200] });
    await vm.runInContext('attemptAutoLookup("BC1")', throttled);
    ok('ZTO 429 ម្តង ➜ retry ដោយមិនបង្ខំអ្នកប្រើស្កេនឡើងវិញ',
        throttled.__fetches.length === 2 && throttled.__status.className.indexOf('success') !== -1,
        [throttled.__fetches.length, throttled.__status.textContent]);

    const unauthorized = buildAutoRuntime({ zto: true, realRetry: true, httpPlan: [401, 200] });
    await vm.runInContext('attemptAutoLookup("BC1")', unauthorized);
    ok('⛔ HTTP 401 ➜ មិន retry ជាមួយ Secret ខុស',
        unauthorized.__fetches.length === 1 && unauthorized.__status.textContent.indexOf('Secret') !== -1,
        [unauthorized.__fetches.length, unauthorized.__status.textContent]);
});

scenario('ការទាញតារាង API ធម្មតាក៏ retry HTTP បណ្ដោះអាសន្ន', async () => {
    const listSrc = sliceFn('fetchCustomerDataTableRows');
    ok('រកឃើញ function fetchCustomerDataTableRows()', !!listSrc);
    if (!listSrc) return;

    function buildList(httpPlan) {
        const fetches = [];
        const rows = [{ barcode: 'BC1', phone: '012', cod: 1, dod: 2 }];
        const statusEl = { textContent: '' };
        const ctx = {
            console: { error: () => {} }, Promise, Array, Object, String, Number, Error, Math, Date,
            setTimeout: (fn) => { fn(); return 1; }, clearTimeout: () => {},
            getLookupApiConfig: () => ({ url: 'https://x/exec?code={barcode}', enabled: true }),
            customerDataTableRows: null, customerDataTableFetchedAt: 0,
            customerDataTableFetchPromise: null, customerDataTableLastFailedAt: 0,
            customerDataTableSessionGeneration: 0, customerTableIsPartial: false,
            CUSTOMER_TABLE_CACHE_MS: 300000, CUSTOMER_TABLE_FAIL_COOLDOWN_MS: 60000,
            elapsedSince: (mark) => (mark ? Date.now() - mark : Infinity),
            document: { getElementById: () => statusEl },
            decryptLookupSecret: () => Promise.resolve(''),
            clearCustomerTableRetry: () => {}, clearCustomerTableSoonRefresh: () => {},
            scheduleCustomerTableRetry: () => {}, renderCustomerDataTableStatus: () => {},
            filterCustomerDataTable: () => {},
            fetchWithTimeout: () => {
                const status = Number(httpPlan[fetches.length] || 200);
                fetches.push(status);
                return Promise.resolve({
                    res: { ok: status >= 200 && status < 300, status: status },
                    body: status >= 200 && status < 300 ? { rows: rows } : null
                });
            },
            ZoeErrors: { capture: () => {} }, __fetches: fetches, __rows: rows, __status: statusEl
        };
        ctx.window = ctx;
        vm.createContext(ctx);
        ['lookupApiIsZto', 'lookupApiIsAppsScript', 'lookupApiSendsHeader',
            'lookupApiSupportsList', 'buildCustomerListApiUrl',
            'retryTransientLookupResponse', 'retryAsync'].forEach((name) => {
            vm.runInContext(sliceFn(name), ctx);
        });
        vm.runInContext(listSrc, ctx);
        return ctx;
    }

    const transient = buildList([503, 200]);
    await vm.runInContext('fetchCustomerDataTableRows(true)', transient);
    ok('តារាង HTTP 503 ម្តង ➜ retry ហើយទទួល rows ពេញលេញ',
        transient.__fetches.length === 2
        && transient.customerDataTableRows === transient.__rows,
        [transient.__fetches, transient.customerDataTableRows]);

    const unauthorized = buildList([401, 200]);
    await vm.runInContext('fetchCustomerDataTableRows(true)', unauthorized);
    ok('តារាង HTTP 401 ➜ មិន retry ជាមួយ Secret ខុស',
        unauthorized.__fetches.length === 1, unauthorized.__fetches);
});

scenario('លទ្ធផលចាស់មិនសរសេរជាន់ Barcode ថ្មី', () => {
    const ctx = buildAutoRuntime({ zto: true, fetchSuccess: true });
    vm.runInContext('pendingBarcode = "BC2"; setLookupStatus("BC2", "loading", "ថ្មី");', ctx);
    const changed = vm.runInContext('setLookupStatus("BC1", "error", "ចាស់")', ctx);
    ok('status របស់ BC1 ចាស់ត្រូវបានបដិសេធ', changed === false, changed);
    ok('status BC2 ថ្មីនៅដដែល', ctx.__status.textContent === 'ថ្មី', ctx.__status.textContent);
});

scenario('Lookup ចាស់មិនត្រូវដោះសោរបស់ Lookup ថ្មីក្រោយប្តូរ Config', async () => {
    const ctx = buildAutoRuntime({ zto: true, deferred: true, loadClear: true });
    const oldLookup = vm.runInContext('attemptAutoLookup("BC1")', ctx);
    ok('សំណើចាស់កំពុងដំណើរការ', ctx.__fetches.length === 1 && ctx.autoLookupInFlight.has('BC1'));

    vm.runInContext('clearCustomerDataTableCache()', ctx);
    const freshLookup = vm.runInContext('attemptAutoLookup("BC1")', ctx);
    ok('ប្តូរ Config ➜ សំណើថ្មីអាចចាប់ផ្តើមភ្លាម', ctx.__fetches.length === 2 && ctx.autoLookupInFlight.has('BC1'));

    ctx.__deferreds[0].resolve({ res: { ok: true, status: 200 }, body: { phone: 'old', success: true } });
    await oldLookup;
    ok('⛔ សំណើចាស់ចប់ ➜ សោរបស់សំណើថ្មីនៅតែជាប់',
        ctx.autoLookupInFlight.has('BC1'), ctx.autoLookupInFlight.size);

    const duplicateLookup = vm.runInContext('attemptAutoLookup("BC1")', ctx);
    ok('⛔ ខណៈសំណើថ្មីនៅរង់ចាំ ➜ មិនបាញ់សំណើទី ៣ ស្ទួន', ctx.__fetches.length === 2, ctx.__fetches.length);

    ctx.__deferreds[1].resolve({ res: { ok: true, status: 200 }, body: { phone: 'new', success: true } });
    if (ctx.__deferreds[2]) ctx.__deferreds[2].resolve({ res: { ok: true, status: 200 }, body: { phone: 'duplicate', success: true } });
    await Promise.all([freshLookup, duplicateLookup]);
});

scenario('PIN និង Lookup មិនប្រជែង Keyboard', () => {
    const locked = buildAutoRuntime({ locked: true, fetchSuccess: true });
    let settled = false;
    const lookup = vm.runInContext('attemptAutoLookup("BC1")', locked).then(() => { settled = true; });
    return Promise.resolve().then(() => {
        ok('Secret នៅជាប់សោ ➜ Lookup Promise នៅរង់ចាំ PIN', settled === false, settled);
        ok('ស្នើ PIN តែម្តង', locked.__unlockActions.length === 1, locked.__unlockActions.length);
        locked.lookupSecretKey = { unlocked: true };
        locked.__unlockActions[0]();
        return lookup.then(() => {
            ok('វាយ PIN រួច ➜ បន្ត ZTO Lookup ដដែល', locked.__fetches.length === 1, locked.__fetches);
            ok('ZTO ចប់រួច ➜ ទើប Lookup Promise ចប់', settled === true, settled);
        });
    });
});

// === ⛔ ខ្សែសង្វាក់ពិត ៖ ប្រអប់ PIN ជាន់លើប្រអប់កញ្ចប់ ===
// 🔴 របាយការណ៍អ្នកប្រើ (2026-09-04) ៖ «បើក App ដំបូង ស្កេនកញ្ចប់ ➜ លោតសុំ PIN
//   ➜ វាយត្រូវហើយ តែ Lookup នៅតែថាមិនទាន់ដោះសោ ➜ ត្រូវចុច ✖ ហើយស្កេនម្ដងទៀត
//   ទើបដំណើរការ»។
// មូលហេតុ ៖ `closeModal()` លុប `pendingBarcode` **គ្រប់ប្រអប់** — ដូច្នេះការបិទ
//   ប្រអប់ PIN (ដែលឈរ *ជាន់លើ* ប្រអប់កញ្ចប់) លុប Barcode របស់ប្រអប់ដែលនៅបើក
//   ➜ `retryPendingLookupAfterUnlock()` ឃើញ `pendingBarcode !== barcode`
//   ➜ បោះបង់ស្ងាត់។
// ⛔ មេរៀន ៖ តេស្តចាស់ **stub ស្នាមភ្ជាប់នេះ** (ហៅ `__unlockActions[0]()` ដោយផ្ទាល់)
//   ➜ ស្នាមភ្ជាប់ `closeModal ↔ pendingBarcode` គ្មានអ្នកវាស់សោះ។ ដូច្នេះ
//   សេណារីយ៉ូខាងក្រោមរត់ `completePinUnlock()` **ពិត** ដែលហៅ `closeModal()` ពិត។
scenario('⛔ បិទប្រអប់ PIN ➜ Lookup បន្តភ្លាម (មិនចាំស្កេនម្ដងទៀត)', () => {
    const ctx = buildAutoRuntime({ locked: true, fetchSuccess: true, realModals: true });
    vm.runInContext('openModalHelper("phoneModal"); pendingBarcode = "BC1";', ctx);
    let settled = false;
    const lookup = vm.runInContext('attemptAutoLookup("BC1")', ctx).then(() => { settled = true; });
    return Promise.resolve().then(() => {
        ok('លក្ខខណ្ឌចាំបាច់ ៖ Lookup ជាប់សោ ➜ ប្រអប់ PIN បើកពិត',
            ctx.__modals.pinModal.style.display === 'flex', ctx.__modals.pinModal.style.display);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ស្ថានភាពប្រាប់ឲ្យវាយ PIN',
            ctx.__status.textContent.indexOf('PIN') !== -1, ctx.__status.textContent);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ មិនទាន់បាញ់សំណើ Lookup', ctx.__fetches.length === 0, ctx.__fetches);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ Lookup Promise នៅរង់ចាំ PIN', settled === false, settled);
        return vm.runInContext('completePinUnlock("123456")', ctx);
    }).then(() => lookup).then(() => {
        ok('⛔ បិទប្រអប់ PIN ➜ Barcode របស់ប្រអប់ដែលនៅបើក **មិនត្រូវបាត់**',
            ctx.pendingBarcode === 'BC1', ctx.pendingBarcode);
        ok('⛔ វាយ PIN ត្រូវ ➜ Lookup បន្តភ្លាម ដោយ**មិនចាំស្កេនម្ដងទៀត**',
            ctx.__fetches.length === 1, ctx.__fetches);
        ok('⛔ ស្ថានភាពលែងជាប់នៅ «សូមវាយ PIN»',
            ctx.__status.textContent.indexOf('សូមវាយ PIN') === -1, ctx.__status.textContent);
        ok('ប្រអប់កញ្ចប់នៅតែបើក ➜ ការចាក់សោរមូរនៅដដែល',
            ctx.isModalOpen === true && ctx.document.body.style.overflow === 'hidden',
            [ctx.isModalOpen, ctx.document.body.style.overflow]);
        ok('Lookup Promise ចប់ក្រោយ ZTO ឆ្លើយ', settled === true, settled);
    });
});

// ⛔ ទិសផ្ទុយ ៖ ការកែមិនត្រូវក្លាយជា «មិនសម្អាតអ្វីសោះ» — ស្ថានភាពរបស់
//   ប្រអប់ណា ត្រូវសម្អាតពេលប្រអប់ **នោះ** បិទ ហើយពេលជង់ប្រអប់ទទេទាំងស្រុង។
// ⛔ ផ្លូវចាកចេញ ៖ `showLoginModalWithPrefill()` បិទប្រអប់ **ទាំងអស់** ជាវដ្ត។
//   ក្រោយការកែ ការសម្អាតជា «ម្ចាស់ ឬ ជង់ទទេ» ➜ ត្រូវបញ្ជាក់ថាវដ្តនោះនៅតែ
//   សម្អាតគ្រប់យ៉ាង បើមិនដូច្នេះទិន្នន័យអតិថិជននឹងរស់រានក្រោយចាកចេញ។
scenario('⛔ ចាកចេញ ៖ បិទប្រអប់ទាំងអស់ជាវដ្ត ➜ សម្អាតគ្រប់ស្ថានភាព', () => {
    const ctx = buildAutoRuntime({ realModals: true });
    vm.runInContext('openModalHelper("phoneModal"); openModalHelper("editPhoneModal"); openModalHelper("callMarkModal");', ctx);
    vm.runInContext('pendingBarcode = "BC1"; editingItemId = "E1"; markingItemId = "M1";', ctx);
    ok('លក្ខខណ្ឌចាំបាច់ ៖ ប្រអប់ ៣ បើកពិត',
        ctx.__modals.phoneModal.style.display === 'flex'
        && ctx.__modals.editPhoneModal.style.display === 'flex'
        && ctx.__modals.callMarkModal.style.display === 'flex');
    // ធ្វើត្រាប់តាមវដ្តរបស់ showLoginModalWithPrefill()
    vm.runInContext('Object.keys(__modalIds).forEach(function (id) { if (id !== "loginModal") closeModal(id); });', ctx);
    ok('⛔ ចាកចេញ ➜ pendingBarcode ត្រូវសម្អាត', ctx.pendingBarcode === '', ctx.pendingBarcode);
    ok('⛔ ចាកចេញ ➜ editingItemId ត្រូវសម្អាត', ctx.editingItemId === null, ctx.editingItemId);
    ok('⛔ ចាកចេញ ➜ markingItemId ត្រូវសម្អាត', ctx.markingItemId === null, ctx.markingItemId);
    ok('⛔ ចាកចេញ ➜ ដោះការចាក់សោរមូរ', ctx.document.body.style.overflow === '', ctx.document.body.style.overflow);
});

scenario('⛔ ទិសផ្ទុយ ៖ បិទប្រអប់ម្ចាស់ ➜ ស្ថានភាពត្រូវសម្អាតពិត', () => {
    const ctx = buildAutoRuntime({ realModals: true });
    vm.runInContext('openModalHelper("phoneModal"); pendingBarcode = "BC1"; editingItemId = "E1"; markingItemId = "M1";', ctx);
    vm.runInContext('closeModal("phoneModal");', ctx);
    ok('បិទប្រអប់កញ្ចប់ ➜ pendingBarcode ត្រូវសម្អាត', ctx.pendingBarcode === '', ctx.pendingBarcode);
    ok('ជង់ប្រអប់ទទេ ➜ សម្អាត editingItemId និង markingItemId',
        ctx.editingItemId === null && ctx.markingItemId === null, [ctx.editingItemId, ctx.markingItemId]);
    ok('គ្មានប្រអប់ណាបើក ➜ ដោះការចាក់សោរមូររបស់ body',
        ctx.document.body.style.overflow === '', ctx.document.body.style.overflow);

    const nested = buildAutoRuntime({ realModals: true });
    vm.runInContext('openModalHelper("editPhoneModal"); editingItemId = "E1"; openModalHelper("pinModal");', nested);
    vm.runInContext('closeModal("pinModal");', nested);
    ok('⛔ ប្រអប់ជាន់លើបិទ ➜ ស្ថានភាពប្រអប់កែលេខ **មិនបាត់**',
        nested.editingItemId === 'E1', nested.editingItemId);
    vm.runInContext('closeModal("editPhoneModal");', nested);
    ok('បិទប្រអប់កែលេខពិត ➜ editingItemId ត្រូវសម្អាត',
        nested.editingItemId === null, nested.editingItemId);
});

// === ⛔ Header ផ្ទាល់ខ្លួន ➜ preflight ➜ Apps Script ស្លាប់ ===
// 🔴 វាស់ពី Sentry ផលិតកម្មពិត (2026-09-04) ៖
//   09:55:42  GET ?list=1&key=…  200 ✅
//   09:56:54  អ្នកប្រើកែវាល «ឈ្មោះ Header» រួចរក្សាទុក
//   09:56:54  GET ?list=1&key=…  ❌ TypeError: Failed to fetch
// មូលហេតុ ៖ header ផ្ទាល់ខ្លួន ➜ browser ផ្ញើ **preflight OPTIONS** ➜
//   **Apps Script មិនឆ្លើយ OPTIONS** ➜ សំណើស្លាប់ទាំងស្រុង។
// ⛔ ហើយវា **គ្មានប្រយោជន៍សោះ** ៖ `Code.gs` អានសោពី `e.parameter` (URL) —
//   Apps Script **មើលមិនឃើញ header ទាល់តែសោះ**។
// ច្បាប់នេះមានក្នុង CLAUDE.md សម្រាប់ផ្លូវ **នាំចូល** រួចហើយ (`callSheetImportApi`
//   ផ្ញើតែ `text/plain`) — តែ **ផ្លូវ Lookup ខ្វះវា**។
scenario('⛔ Apps Script ➜ មិនផ្ញើ header ផ្ទាល់ខ្លួន (preflight សម្លាប់សំណើ)', () => {
    const ctx = buildAutoRuntime({ appsScript: true, locked: true, fetchSuccess: true });
    ctx.lookupSecretKey = { unlocked: true };
    return vm.runInContext('attemptAutoLookup("BC1")', ctx).then(() => {
        ok('លក្ខខណ្ឌចាំបាច់ ៖ សំណើចេញពិត', ctx.__fetches.length === 1, ctx.__fetches);
        const sent = (ctx.__fetchOptions[0] || {}).headers || {};
        ok('⛔ Apps Script ➜ **គ្មាន header ផ្ទាល់ខ្លួន** (បើមាន ➜ preflight ➜ Failed to fetch)',
            Object.keys(sent).length === 0, sent);
    });
});

scenario('⛔ ទិសផ្ទុយ ៖ API ដែលមិនមែន Apps Script ➜ header ត្រូវផ្ញើដដែល', () => {
    const ctx = buildAutoRuntime({ locked: true, fetchSuccess: true });
    ctx.lookupSecretKey = { unlocked: true };
    return vm.runInContext('attemptAutoLookup("BC1")', ctx).then(() => {
        const sent = (ctx.__fetchOptions[0] || {}).headers || {};
        ok('⛔ ទិសផ្ទុយ ៖ API ធម្មតា ➜ header នៅតែផ្ញើ (ការកែមិនកាត់សុវត្ថិភាព)',
            sent['X-Zoe-Proxy-Key'] !== undefined, sent);
    });
});

// ⛔ កុំ `await` promise របស់ផ្លូវជាប់សោ ៖ វា **មិនដែលដោះ** រហូតដល់ PIN
//   ត្រូវដោះ ➜ `Promise.all(pendingScenarios)` ព្យួរ ➜ សរុបមិនបោះពុម្ព
//   ➜ **បៃតងក្លែងក្លាយ** (អន្ទាក់ដែលឯកសារនេះព្រមានផ្ទាល់)។
scenario('⛔ Apps Script ➜ មិនត្រូវសុំ PIN សម្រាប់ header ដែលមិនដែលផ្ញើ', () => {
    const ctx = buildAutoRuntime({ appsScript: true, locked: true, fetchSuccess: true });
    ctx.lookupSecretKey = null;
    vm.runInContext('attemptAutoLookup("BC1")', ctx);
    return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
        ok('⛔ Apps Script + សោជាប់ ➜ **មិនសុំ PIN** (header នោះគ្មានប្រយោជន៍)',
            ctx.__unlockActions.length === 0, ctx.__unlockActions.length);
        ok('⛔ Apps Script + សោជាប់ ➜ ការស្វែងរកបន្តធម្មតា មិនព្យួរ',
            ctx.__fetches.length === 1, ctx.__fetches);
    });
});

scenario('⛔ ទិសផ្ទុយ ៖ ZTO ដែលសោជាប់ ➜ នៅតែសុំ PIN', () => {
    const ctx = buildAutoRuntime({ zto: true, locked: true, fetchSuccess: true });
    ctx.lookupSecretKey = null;
    vm.runInContext('attemptAutoLookup("BC1")', ctx);
    return Promise.resolve().then(() => {
        ok('⛔ ទិសផ្ទុយ ៖ ZTO ➜ ការសុំ PIN នៅដដែល', ctx.__unlockActions.length === 1, ctx.__unlockActions.length);
        ok('⛔ ទិសផ្ទុយ ៖ ZTO ➜ មិនបាញ់សំណើមុនដោះសោ', ctx.__fetches.length === 0, ctx.__fetches);
    });
});

// ⛔ «គ្មានការទម្លាក់ស្ងាត់» ៖ ការមិនផ្ញើ header ត្រូវប្រាប់អ្នកប្រើ ដើម្បី
//   កុំឲ្យគាត់ជឿថាសោនោះកំពុងការពារអ្វីមួយ។
// ⛔ ថ្នាក់ដដែលមាន **ទ្វារ ៤** ៖ header របស់តារាង · header របស់ lookup ·
//   ផ្លូវ PIN · និង **ប៊ូតុង «សាកល្បង»** ដែលសង់ header ដោយឡែក។ បើកែតែ ៣
//   នោះ «សាកល្បង» ធ្លាក់ ខណៈមុខងារពិតដើរ ➜ អ្នកប្រើជឿថា Config ខូច។
const testCfgFn = sliceFn('testLookupApiConfig') || '';
ok('ប៊ូតុង «សាកល្បង» ក៏ឆ្លងកាត់ច្រកទ្វារដដែល (ទ្វារទី ៤)',
    testCfgFn.indexOf('lookupApiSendsHeader(') !== -1, testCfgFn.length);

const saveCfgFn = sliceFn('saveLookupApiConfig') || '';
ok('រក្សាទុក Config ជាមួយ Apps Script + Header ➜ ប្រាប់អ្នកប្រើ (មិនទម្លាក់ស្ងាត់)',
    /lookupApiIsAppsScript\(cfg\)/.test(saveCfgFn) && /showToast\(/.test(saveCfgFn),
    saveCfgFn.length);

scenario('សម្គាល់ URL របស់ Apps Script', () => {
    const ctx = build({ cfg: { url: 'https://script.google.com/macros/s/AKfycb/exec?code={barcode}&key=k', enabled: true } });
    ok('សម្គាល់ script.google.com', vm.runInContext('lookupApiIsAppsScript(getLookupApiConfig())', ctx) === true);
    const uc = build({ cfg: { url: 'https://script.googleusercontent.com/macros/echo?x=1', enabled: true } });
    ok('សម្គាល់ script.googleusercontent.com ដែរ', vm.runInContext('lookupApiIsAppsScript(getLookupApiConfig())', uc) === true);
    const zto = build({ cfg: { url: '/.netlify/functions/zto-order-detail?barcode={barcode}', enabled: true } });
    ok('⛔ ទិសផ្ទុយ ៖ ZTO មិនមែន Apps Script', vm.runInContext('lookupApiIsAppsScript(getLookupApiConfig())', zto) === false);
    const fake = build({ cfg: { url: 'https://script.google.com.evil.example/exec', enabled: true } });
    ok('⛔ domain ក្លែង (script.google.com.evil…) មិនត្រូវរាប់ជា Apps Script',
        vm.runInContext('lookupApiIsAppsScript(getLookupApiConfig())', fake) === false);
});

// === ជណ្តើរព្យាយាមវិញ ===
scenario('ជណ្តើរព្យាយាមវិញ', () => {
    const ctx = build({});
    const steps = vm.runInContext('CUSTOMER_TABLE_RETRY_STEPS_MS', ctx);
    const cooldown = vm.runInContext('CUSTOMER_TABLE_FAIL_COOLDOWN_MS', ctx);
    ok('ជណ្តើរមានយ៉ាងតិច ៣ ជំហាន', Array.isArray(steps) && steps.length >= 3, steps);
    let rising = Array.isArray(steps);
    if (Array.isArray(steps)) for (let i = 1; i < steps.length; i++) if (steps[i] <= steps[i - 1]) rising = false;
    ok('ជណ្តើរឡើងជាលំដាប់ (backoff ពិត មិនមែនវាយដដែលៗ)', rising, steps);
    // ⛔ ជំហានទី ១ ត្រូវ **វែងជាង** cooldown បើមិនដូច្នេះការព្យាយាមវិញត្រូវ
    // cooldown លេប ➜ ជណ្តើរងាប់ (ថ្នាក់ដដែលនឹង FIREBASE_SDK_RETRY_MIN_GAP_MS)។
    ok('ជំហានទី ១ វែងជាង cooldown ➜ ការព្យាយាមវិញមិនត្រូវលេប',
        Array.isArray(steps) && typeof cooldown === 'number' && steps[0] > cooldown, [steps && steps[0], cooldown]);

    vm.runInContext('scheduleCustomerTableRetry();', ctx);
    ok('ការធ្លាក់ ➜ តាំងម៉ោងព្យាយាមវិញ', ctx.__clock.pending() === 1);
    ctx.__clock.advance(steps[0] - 1);
    ok('មុនដល់ពេល ➜ មិនទាន់ទាញ', ctx.__calls.length === 0, ctx.__calls);
    ctx.__clock.advance(2);
    ok('ដល់ពេល ➜ ទាញឡើងវិញ', ctx.__calls.length === 1, ctx.__calls);
    ok('ការព្យាយាមវិញប្រើ force=true (រំលង cooldown ដែលខ្លួនវាជំនួស)', ctx.__calls[0] === true);

    // ⛔ រវល់ពេលដល់ម៉ោង ➜ ត្រូវ **តាំងម៉ោងឡើងវិញ** មិនមែនបោះបង់
    const busy = build({});
    vm.runInContext('scheduleCustomerTableRetry();', busy);
    busy.__clock.advance(steps[0] + 1);
    vm.runInContext('isModalOpen = true;', busy);
    // ជុំដំបូងបានទាញរួច; សាកជុំបន្ទាប់ខណៈរវល់
    const before = busy.__calls.length;
    vm.runInContext('scheduleCustomerTableRetry();', busy);
    busy.__clock.advance(steps[1] + 1);
    ok('រវល់ពេលដល់ម៉ោង ➜ មិនទាញ', busy.__calls.length === before, busy.__calls);
    ok('រវល់ពេលដល់ម៉ោង ➜ **តាំងម៉ោងឡើងវិញ** (មិនបោះបង់)', busy.__clock.pending() === 1);
    vm.runInContext('isModalOpen = false;', busy);
    busy.__clock.advance(vm.runInContext('CUSTOMER_TABLE_RETRY_BUSY_MS', busy) + 1);
    ok('ទំនេរវិញ ➜ ទាញបាន', busy.__calls.length === before + 1, busy.__calls);

    const cleared = build({});
    vm.runInContext('scheduleCustomerTableRetry(); clearCustomerTableRetry();', cleared);
    ok('ជោគជ័យ ➜ លុបម៉ោង និង reset streak', cleared.__clock.pending() === 0 &&
        vm.runInContext('customerTableFailStreak', cleared) === 0);
});

// === ⛔ ការត្រៀម ZTO ៖ រវល់ពេលដល់ម៉ោង ➜ តាំងម៉ោងឡើងវិញ មិនបោះបង់ ===
// 🔴 ចន្លោះពិត ៖ វដ្ត ៥ នាទីត្រៀម Lambda របស់ ZTO តាមរយៈ
//   `prefetchCustomerDataTableRowsIfConfigured()` — តែសាខា ZTO របស់វា
//   **បោះបង់ស្ងាត់** ពេល `customerTablePrefetchAllowed()` ជា false
//   (ប្រអប់កញ្ចប់បើក ឬមាន lookup កំពុងដំណើរការ)។ ក្នុងហាងដែលស្កេនជាប់ៗ
//   ប្រអប់បើកស្ទើររាល់ពេល ➜ ការត្រៀមអាចខកខានច្រើនវដ្តជាប់គ្នា ➜ Lambda
//   ត្រជាក់វិញ ➜ ការស្កេនក្រោយពេលស្ងៀម បង់ថ្លៃ cold start។
// ⛔ ផ្លូវតារាងអតិថិជនមានច្បាប់នេះរួចហើយ (`scheduleCustomerTableSoonRefresh`)
//   — សាខា ZTO ត្រូវមានដូចគ្នា។ ⛔ ទិសផ្ទុយ ៖ ការតាំងម៉ោងឡើងវិញត្រូវ
//   **បោះបង់ក្រោយពិដាន** មិនមែនភ្ញាក់រហូត។
scenario('ការត្រៀម ZTO ៖ រវល់ ➜ តាំងម៉ោងឡើងវិញ', () => {
    const ztoCfg = { url: '/.netlify/functions/zto-order-detail?barcode={barcode}', enabled: true };
    const busy = build({ cfg: ztoCfg, isModalOpen: true });
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', busy);
    ok('លក្ខខណ្ឌចាំបាច់ ៖ រវល់ ➜ មិនត្រៀមភ្លាម', busy.__warmCalls.length === 0, busy.__warmCalls);
    ok('⛔ រវល់ ➜ **តាំងម៉ោងឡើងវិញ** (មិនបោះបង់ស្ងាត់)', busy.__clock.pending() >= 1, busy.__clock.pending());

    const busyMs = vm.runInContext('CUSTOMER_TABLE_SOON_BUSY_MS', busy);
    busy.__clock.advance(busyMs + 1);
    ok('⛔ នៅរវល់ ➜ តាំងម៉ោងបន្តទៀត មិនត្រៀមកាត់ការស្កេន',
        busy.__warmCalls.length === 0 && busy.__clock.pending() >= 1,
        busy.__warmCalls.length + '/' + busy.__clock.pending());

    vm.runInContext('isModalOpen = false;', busy);
    busy.__clock.advance(busyMs + 1);
    ok('⛔ ទំនេរវិញ ➜ ការត្រៀមកើតឡើងពិត', busy.__warmCalls.length === 1, busy.__warmCalls);
    ok('ត្រៀមរួច ➜ លែងបន្សល់ម៉ោង', busy.__clock.pending() === 0, busy.__clock.pending());

    // ⛔ ទិសផ្ទុយ ១ ៖ ការរង់ចាំមានពិដាន — មិនភ្ញាក់រហូតខណៈអ្នកប្រើរវល់
    // ⚠️ អន្ទាក់ harness ៖ នាឡិកាក្លែងមិនរំកិល `Date.now()` ➜ `elapsedSince()`
    //    នៅ ~0 ជារៀងរហូត ➜ ពិដានមិនដែលដល់។ ត្រូវប្រើ Date និម្មិត និង epoch ពិត។
    let stuckNow = 1700000000000;
    const stuck = build({ cfg: ztoCfg, isModalOpen: true, dateNow: () => stuckNow });
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', stuck);
    const maxWait = vm.runInContext('CUSTOMER_TABLE_SOON_MAX_WAIT_MS', stuck);
    let guard = 0;
    while (stuck.__clock.pending() > 0 && guard < 400) {
        guard++;
        stuckNow += busyMs + 1;
        stuck.__clock.advance(busyMs + 1);
    }
    ok('⛔ រវល់យូរពេក ➜ បោះបង់ (វដ្ត ៥ នាទីនឹងសាកម្ដងទៀត)',
        stuck.__clock.pending() === 0 && stuck.__warmCalls.length === 0,
        stuck.__clock.pending() + '/' + stuck.__warmCalls.length);
    ok('ពិដានរង់ចាំសមហេតុផល (<= ២ នាទី)', typeof maxWait === 'number' && maxWait <= 120000, maxWait);

    // ⛔ ទិសផ្ទុយ ២ ៖ ទំនេរតាំងពីដើម ➜ ត្រៀមភ្លាម គ្មានម៉ោងបន្សល់
    const idle = build({ cfg: ztoCfg });
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', idle);
    ok('⛔ ទិសផ្ទុយ ៖ ទំនេរ ➜ ត្រៀមភ្លាម មិនពន្យារ',
        idle.__warmCalls.length === 1 && idle.__clock.pending() === 0,
        idle.__warmCalls.length + '/' + idle.__clock.pending());

    // ⛔ ទិសផ្ទុយ ៣ ៖ API ធម្មតា (មិនមែន ZTO) មិនត្រូវប្រើផ្លូវនេះ
    const api = build({ isModalOpen: true });
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', api);
    ok('⛔ ទិសផ្ទុយ ៖ API ធម្មតា ➜ មិនកេះការត្រៀម ZTO',
        api.__warmCalls.length === 0, api.__warmCalls);

    // ⛔ ការលុបម៉ោងដោយផ្ទាល់ ➜ គ្មាន timer កំព្រា
    const cleared = build({ cfg: ztoCfg, isModalOpen: true });
    vm.runInContext('prefetchCustomerDataTableRowsIfConfigured();', cleared);
    const armed = cleared.__clock.pending();
    vm.runInContext('clearZtoWarmSoon();', cleared);
    ok('⛔ លុបម៉ោងត្រៀម ZTO ➜ គ្មាន timer កំព្រា',
        armed >= 1 && cleared.__clock.pending() === 0, armed + '/' + cleared.__clock.pending());
});

// === TTL cache ===
scenario('TTL cache', () => {
    const ctx = build({});
    const ttl = vm.runInContext('CUSTOMER_TABLE_CACHE_MS', ctx);
    ok('TTL cache ក្នុងសតិ <= ៥ នាទី (ស៊ីនឹង cache ៥ នាទីរបស់ Apps Script)',
        typeof ttl === 'number' && ttl <= 5 * 60 * 1000, ttl);
    ok('TTL cache មិនតូចជ្រុល (>= ១ នាទី)', typeof ttl === 'number' && ttl >= 60 * 1000, ttl);
});

// === focus grace ===
function focusCase(label, opts, expectFocused) {
    scenario(label, () => {
        const ctx = build({ pinPending: !!opts.pinPending });
        let focused = 0;
        const input = { value: opts.typed || '', focus: () => { focused++; } };
        ctx.__input = input;
        if (opts.modalClosed) vm.runInContext('isModalOpen = false;', ctx);
        else vm.runInContext('isModalOpen = true;', ctx);
        if (opts.otherBarcode) vm.runInContext('pendingBarcode = "BC2";', ctx);
        let settle;
        ctx.__promise = new Promise((r) => { settle = r; });
        vm.runInContext('armLookupFocus(__input, "BC1", __promise);', ctx);
        const grace = vm.runInContext('LOOKUP_FOCUS_GRACE_MS', ctx);
        const fallback = vm.runInContext('LOOKUP_MANUAL_FALLBACK_MS', ctx);
        ctx.__clock.advance(fallback - 1);
        ok('មុនដល់ពិដាន Lookup ➜ Keyboard មិនលោត', focused === 0, focused);
        ctx.__clock.advance(2);
        ok(label + ' (ពេល API យឺត)', (focused > 0) === expectFocused, focused);
        settle();
        return Promise.resolve().then(() => {
            ctx.__clock.advance(grace + 1);
            ok(label + ' (ក្រោយ API ចប់)', (focused > 0) === expectFocused, focused);
        });
    });
}
focusCase('Lookup យឺត ➜ manual auto-fallback នៅដដែល', {}, true);
focusCase('អ្នកប្រើវាយរួច ➜ **មិន** focus (មិនរំខានការវាយ)', { typed: '012345678' }, false);
focusCase('ប្រអប់បិទរួច ➜ **មិន** focus', { modalClosed: true }, false);
focusCase('ស្កេនកញ្ចប់បន្ទាប់រួច ➜ **មិន** focus លើកញ្ចប់ចាស់', { otherBarcode: true }, false);
focusCase('PIN កំពុងបើក ➜ **មិន** focus នៅពីក្រោយ PIN', { pinPending: true }, false);

scenario('បិទ PIN រួច ➜ manual fallback ចាប់ពេលពេញម្តងទៀត', () => {
    const opts = { pinPending: true };
    const ctx = build(opts);
    let focused = 0;
    ctx.__input = { value: '', focus: () => { focused++; } };
    let settle;
    ctx.__promise = new Promise((r) => { settle = r; });
    vm.runInContext('isModalOpen = true;', ctx);
    vm.runInContext('armLookupFocus(__input, "BC1", __promise);', ctx);
    const grace = vm.runInContext('LOOKUP_FOCUS_GRACE_MS', ctx);
    const fallback = vm.runInContext('LOOKUP_MANUAL_FALLBACK_MS', ctx);
    ctx.__clock.advance(fallback + grace + 1);
    ok('PIN នៅបើកយូរ ➜ Keyboard មិនលេចពីក្រោយ', focused === 0, focused);
    opts.pinPending = false;
    ctx.__clock.advance(grace + 1);
    ok('ទើបបិទ PIN ➜ មិន focus ភ្លាម', focused === 0, focused);
    ctx.__clock.advance(fallback - grace - 2);
    ok('ទើបបិទ PIN ➜ រង់ចាំពិដាន fallback ពេញ មិន focus ភ្លាម', focused === 0, focused);
    ctx.__clock.advance(grace + 3);
    ok('បិទ PIN ហើយ ZTO នៅយឺត ➜ manual fallback ត្រឡប់មកពេញលេញ', focused === 1, focused);
    settle();
    return Promise.resolve();
});

scenario('focus តែម្តង', () => {
    const ctx = build({});
    let focused = 0;
    ctx.__input = { value: '', focus: () => { focused++; } };
    let settle;
    ctx.__promise = new Promise((r) => { settle = r; });
    vm.runInContext('isModalOpen = true;', ctx);
    vm.runInContext('armLookupFocus(__input, "BC1", __promise);', ctx);
    settle();
    return Promise.resolve().then(() => {
        ctx.__clock.advance(vm.runInContext('LOOKUP_FOCUS_GRACE_MS', ctx) + 1);
        ctx.__clock.advance(vm.runInContext('LOOKUP_FOCUS_GRACE_MS', ctx) + 1);
        ok('Lookup ចប់ ➜ focus តែម្តងគត់', focused === 1, focused);
    });
});

scenario('ពិដាន grace', () => {
    const ctx = build({});
    const g = vm.runInContext('LOOKUP_FOCUS_GRACE_MS', ctx);
    const fallback = vm.runInContext('LOOKUP_MANUAL_FALLBACK_MS', ctx);
    ok('grace <= ១ វិនាទី', typeof g === 'number' && g > 0 && g <= 1000, g);
    ok('manual fallback នៅចន្លោះ ១–៣ វិនាទី', typeof fallback === 'number' && fallback >= 1000 && fallback <= 3000, fallback);
});

// === ⛔ Keyboard មិនត្រូវលោតកាត់ ខណៈ Lookup **កំពុងស្វែងរក** ===
// 🔴 របាយការណ៍អ្នកប្រើ (2026-09-04) ៖ «ប្រសិនបើ lookup កំពុងស្វែងរក កុំឲ្យ
//   keyboard fallback មក — ចាំ lookup មិនឃើញទិន្នន័យ ចាំ fallback»។
// មុនកែ ៖ `armLookupFocus()` រាប់តែម៉ោង (១.៨ វិ.) ➜ Keyboard លោតឡើងកាត់
//   ចំពេល ZTO នៅឆ្លើយមិនទាន់ចេញ ➜ ផ្ទាំងគ្របតារាង ហើយអ្នកប្រើវាយលេខដោយដៃ
//   ខណៈចម្លើយកំពុងមកដល់។
// ⛔ ទិសផ្ទុយត្រូវរក្សា ៖ ពេលគ្មានការស្វែងរកកំពុងដំណើរការ (ZTO ឆ្លើយថា
//   «រកមិនឃើញ» · ធ្លាក់ · ឬគ្មាន Lookup សោះ) Keyboard **ត្រូវមកភ្លាម** —
//   បើមិនដូច្នេះការកែនេះក្លាយជាការទប់ការវាយដោយដៃ។
function workingCase(label, opts, clearJs) {
    scenario(label, () => {
        const ctx = build(opts);
        let focused = 0;
        ctx.__input = { value: '', focus: () => { focused++; } };
        let settle;
        ctx.__promise = new Promise((r) => { settle = r; });
        vm.runInContext('isModalOpen = true;', ctx);
        ok(label + ' ៖ លក្ខខណ្ឌចាំបាច់ — កូដយល់ថា Lookup កំពុងធ្វើការ',
            vm.runInContext('lookupIsWorkingOn("BC1")', ctx) === true);
        vm.runInContext('armLookupFocus(__input, "BC1", __promise);', ctx);
        const grace = vm.runInContext('LOOKUP_FOCUS_GRACE_MS', ctx);
        const fallback = vm.runInContext('LOOKUP_MANUAL_FALLBACK_MS', ctx);
        ctx.__clock.advance(fallback + grace + 1);
        ok(label + ' ➜ **Keyboard មិនលោតកាត់**', focused === 0, focused);
        ctx.__clock.advance(fallback * 3);
        ok(label + ' ➜ រង់ចាំបន្ត មិនមែនគ្រាន់តែពន្យារ', focused === 0, focused);
        vm.runInContext(clearJs, ctx);
        ok(label + ' ៖ ការស្វែងរកចប់ ➜ កូដយល់ថាលែងធ្វើការ',
            vm.runInContext('lookupIsWorkingOn("BC1")', ctx) === false);
        settle();
        return Promise.resolve().then(() => {
            ctx.__clock.advance(grace + 1);
            ok(label + ' ➜ ចប់ហើយ ➜ Keyboard មកភ្លាម (ក្នុង grace)', focused === 1, focused);
        });
    });
}
workingCase('សំណើ Lookup កំពុងដំណើរការ', { lookupInFlight: true },
    'if (typeof autoLookupInFlight.delete === "function") autoLookupInFlight.delete("BC1");');
workingCase('Lookup កំពុងរង់ចាំជួរ', { lookupQueued: true }, 'autoLookupQueueRetries.delete("BC1");');
workingCase('Lookup កំពុងរង់ចាំការដោះសោ PIN', { lookupWaitingPin: true }, 'pendingLookupUnlockBarcode = "";');

scenario('⛔ ទិសផ្ទុយ ៖ គ្មានការស្វែងរក ➜ Keyboard មិនត្រូវត្រូវទប់', () => {
    const ctx = build({});
    ok('គ្មានធាតុណាកំពុងធ្វើការ ➜ lookupIsWorkingOn() ត្រូវជា false',
        vm.runInContext('lookupIsWorkingOn("BC1")', ctx) === false);
    ok('Barcode ទទេ ➜ មិនរាប់ជាការធ្វើការ (មិនទប់ជារៀងរហូត)',
        vm.runInContext('lookupIsWorkingOn("")', ctx) === false);
    const other = build({ lookupInFlight: true });
    ok('⛔ ការស្វែងរកកញ្ចប់ **ផ្សេង** មិនត្រូវទប់ Keyboard របស់កញ្ចប់នេះ',
        vm.runInContext('lookupIsWorkingOn("BC2")', other) === false);
});

scenario('⛔ ការរង់ចាំ Lookup ត្រូវមានពិដាន (គ្មានការរង់ចាំគ្មានទីបញ្ចប់)', () => {
    const startedAt = 1700000000000;
    let now = startedAt;
    const ctx = build({ lookupInFlight: true, dateNow: () => now });
    let focused = 0;
    ctx.__input = { value: '', focus: () => { focused++; } };
    ctx.__promise = new Promise(() => {});
    vm.runInContext('isModalOpen = true;', ctx);
    vm.runInContext('armLookupFocus(__input, "BC1", __promise);', ctx);
    const grace = vm.runInContext('LOOKUP_FOCUS_GRACE_MS', ctx);
    const max = vm.runInContext('LOOKUP_FOCUS_MAX_WAIT_MS', ctx);
    const ztoTimeout = vm.runInContext('ZTO_AUTO_LOOKUP_TIMEOUT_MS', ctx);
    // ⛔ ពិដានត្រូវ **វែងជាងការសាកមួយជុំពេញរបស់ ZTO** ➜ ការស្វែងរកធម្មតា
    //   (ZTO ឆ្លើយក្នុង ~១–៩ វិ.) មិនដែលត្រូវកាត់ ហើយ Keyboard មិនលោតកាត់។
    ok('ពិដានវែងជាងការសាកមួយជុំពេញរបស់ ZTO ➜ មិនកាត់ការស្វែងរកធម្មតា',
        typeof max === 'number' && max >= ztoTimeout, [max, ztoTimeout]);
    // ⛔ តែវាត្រូវ **ខ្លីល្មម** ៖ អ្នកប្រើស្នើដោយផ្ទាល់ថា «កុំឲ្យ fallback
    //   រង់ចាំយូរពេក»។ ការព្យាយាមឡើងវិញ (retryAsync ២ ជុំ) អាចលាតដល់ ~២៦ វិ.
    //   ➜ បើគ្មានពិដាននេះ អ្នកប្រើអង្គុយគ្មាន Keyboard ពេញរយៈពេលនោះ។
    ok('ពិដានមិនវែងជាង ២០ វិនាទី (កុំឲ្យរង់ចាំយូរពេក)',
        typeof max === 'number' && max <= 20000, max);
    let guard = 0;
    while (focused === 0 && guard < 4000) { guard++; now += grace + 1; ctx.__clock.advance(grace + 1); }
    ok('សំណើជាប់រហូត (សោលេច) ➜ Keyboard នៅតែមកដល់', focused === 1, focused);
    ok('តែវាមកក្រោយពិដាន មិនមែនកាត់ការស្វែងរក', now - startedAt >= max, [now - startedAt, max]);
});

scenario('⛔ នាឡិកាថយក្រោយ ➜ fail-open (Keyboard មិនជាប់អន្ទាក់)', () => {
    let now = 5000000;
    const ctx = build({ lookupInFlight: true, dateNow: () => now });
    let focused = 0;
    ctx.__input = { value: '', focus: () => { focused++; } };
    ctx.__promise = new Promise(() => {});
    vm.runInContext('isModalOpen = true;', ctx);
    vm.runInContext('armLookupFocus(__input, "BC1", __promise);', ctx);
    const grace = vm.runInContext('LOOKUP_FOCUS_GRACE_MS', ctx);
    const fallback = vm.runInContext('LOOKUP_MANUAL_FALLBACK_MS', ctx);
    now -= 3600000;
    ctx.__clock.advance(fallback + grace + 1);
    ok('នាឡិកាថយក្រោយ ➜ elapsedSince() ➜ Infinity ➜ Keyboard មិនត្រូវទប់', focused === 1, focused);
});

// === ការអះអាងស្តាទិច ៖ ខ្សែសង្វាក់ត្រូវភ្ជាប់ពិត ===
const fetchFn = sliceFn('fetchCustomerDataTableRows') || '';
ok('ការធ្លាក់ ➜ ហៅ scheduleCustomerTableRetry()', fetchFn.indexOf('scheduleCustomerTableRetry()') !== -1);
ok('ជោគជ័យ ➜ ហៅ clearCustomerTableRetry()', fetchFn.indexOf('clearCustomerTableRetry()') !== -1);
const scanFn = SRC.indexOf('armLookupFocus(modalPhoneInput');
ok('ផ្លូវស្កេនប្រើ armLookupFocus()', scanFn !== -1);
const cacheClear = sliceFn('clearCustomerDataTableCache') || '';
ok('ការចាកចេញ/ប្តូរ Config ➜ លុបម៉ោងព្យាយាមវិញ', cacheClear.indexOf('clearCustomerTableRetry()') !== -1);
// ⛔ ការចាកចេញ/ប្តូរ Config ត្រូវលុប **គ្រប់ម៉ោង** — timer ត្រៀម ZTO ដែល
//   នៅរស់ក្រោយចាកចេញ គឺជាការភ្ញាក់ដែលគ្មានម្ចាស់។
ok('ការចាកចេញ/ប្តូរ Config ➜ លុបម៉ោងត្រៀម ZTO ដែរ', cacheClear.indexOf('clearZtoWarmSoon()') !== -1);

Promise.all(pendingScenarios).then(() => new Promise((r) => setTimeout(r, 10))).then(() => {
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
});
