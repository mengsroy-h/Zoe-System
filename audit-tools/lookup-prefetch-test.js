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

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

let SRC = '';
try { SRC = fs.readFileSync(APP_JS, 'utf8'); } catch (e) { SRC = ''; }

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

const FNS = ['elapsedSince', 'linkIsFrugal', 'customerTablePrefetchAllowed', 'preconnectToOrigin', 'preconnectToLookupHost',
    'prefetchCustomerDataTableRowsIfConfigured',
    'customerTableNeedsRefresh', 'clearCustomerTableSoonRefresh',
    'scheduleCustomerTableSoonRefresh', 'runCustomerTableSoonRefresh',
    'clearCustomerTableRetry', 'scheduleCustomerTableRetry', 'runCustomerTableRetry', 'armLookupFocus'];
const src = {};
FNS.forEach((n) => { src[n] = sliceFn(n); ok('រកឃើញ function ' + n + '()', !!src[n]); });

const DECLS = ['CUSTOMER_TABLE_CACHE_MS', 'CUSTOMER_TABLE_FAIL_COOLDOWN_MS', 'CUSTOMER_TABLE_RETRY_STEPS_MS',
    'CUSTOMER_TABLE_RETRY_BUSY_MS', 'customerTableRetryTimer', 'customerTableFailStreak',
    'CUSTOMER_TABLE_SOON_MS', 'CUSTOMER_TABLE_SOON_BUSY_MS', 'CUSTOMER_TABLE_SOON_MAX_WAIT_MS',
    'customerTableSoonTimer', 'customerTableSoonArmedAt', 'customerTableIsPartial',
    'customerDataTableRows', 'customerDataTableFetchedAt',
    'LOOKUP_FOCUS_GRACE_MS', 'autoLookupInFlight'];
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
        pending: () => timers.size
    };
}

function build(opts) {
    const o = opts || {};
    const clock = makeClock();
    const calls = [];
    const ctx = {
        console: { error: () => {}, log: () => {} },
        Object: Object, Array: Array, Promise: Promise, JSON: JSON, String: String, Math: Math,
        Date: Date, Infinity: Infinity,
        setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
        navigator: { onLine: o.onLine === undefined ? true : o.onLine, connection: o.connection || null },
        auth: o.noAuth ? null : { currentUser: { uid: 'u1' } },
        isModalOpen: !!o.isModalOpen,
        pendingBarcode: o.pendingBarcode === undefined ? 'BC1' : o.pendingBarcode,
        getLookupApiConfig: () => (o.noCfg ? null : { url: 'https://x/exec?code={barcode}&key=k', enabled: true }),
        URL: URL, Array: Array,
        document: { querySelectorAll: () => [], createElement: () => ({}), head: { appendChild: () => {} } },
        fetchCustomerDataTableRows: (force) => { calls.push(!!force); return Promise.resolve(); },
        __calls: calls, __clock: clock
    };
    vm.createContext(ctx);
    decls.forEach((d) => { try { vm.runInContext(d, ctx); } catch (e) {} });
    FNS.forEach((n) => { if (src[n]) { try { vm.runInContext(src[n], ctx); } catch (e) {} } });
    if (o.inFlight) vm.runInContext('autoLookupInFlight.add("BC9");', ctx);
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

    const withCfg = buildPre({ cfg: { url: 'https://script.google.com/macros/s/AKfy/exec?code={barcode}' } });
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

    const badUrl = buildPre({ cfg: { url: 'មិនមែន URL' } });
    vm.runInContext('preconnectToLookupHost();', badUrl);
    ok('⛔ URL មិនត្រឹមត្រូវ ➜ មិនគាំង និងមិនបន្ថែមអ្វី',
        badUrl.__added.length === 0, badUrl.__added.length);

    const dup = buildPre({ cfg: { url: 'https://script.google.com/macros/s/x/exec' },
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
scenario('ការស្វែងរកស្វ័យប្រវត្តិ ខណៈក្រៅបណ្តាញ', () => {
    const autoSrc = sliceFn('attemptAutoLookup');
    ok('រកឃើញ function attemptAutoLookup()', !!autoSrc);
    if (!autoSrc) return;

    function buildAuto(o) {
        const fetches = [];
        const captures = [];
        const filled = [];
        const ctx = {
            console: { error: () => {}, log: () => {} },
            Object: Object, Array: Array, Promise: Promise, JSON: JSON, String: String,
            Math: Math, Date: Date, Error: Error, encodeURIComponent: encodeURIComponent,
            setTimeout: setTimeout, clearTimeout: clearTimeout,
            navigator: { onLine: o.onLine === undefined ? true : o.onLine },
            AUTO_LOOKUP_FAIL_COOLDOWN_MS: 30000,
            AUTO_LOOKUP_MAX_IN_FLIGHT: 2,
            autoLookupInFlight: new Set(),
            autoLookupLastFailedAt: 0,
            lookupLockedNoticeShown: false,
            lookupSecretKey: null,
            customerDataTableSessionGeneration: 0,
            elapsedSince: (m) => (m ? Date.now() - m : Infinity),
            getLookupApiConfig: () => ({ url: 'https://x/exec?code={barcode}', enabled: true,
                                         phoneField: 'phone', codField: 'cod', dodField: 'dod' }),
            findCustomerDataTableRow: (bc) => (o.cached ? { phone: '012', cod: 1, dod: 2 } : null),
            scheduleCustomerTableSoonRefresh: () => {},
            rememberCustomerTableRow: () => {},
            applyLookupFillToModal: (bc, p2) => filled.push(p2),
            getNestedField: (d, k) => (d ? d[k] : null),
            showToast: () => {},
            decryptLookupSecret: () => Promise.resolve(''),
            retryAsync: (fn) => fn(),
            fetchWithTimeout: (url) => {
                fetches.push(url);
                return Promise.reject(new TypeError('Failed to fetch'));
            },
            ZoeErrors: { capture: (e, c) => captures.push(c && c.context) },
            __fetches: fetches, __captures: captures, __filled: filled
        };
        ctx.window = ctx;
        vm.createContext(ctx);
        vm.runInContext(autoSrc, ctx);
        return ctx;
    }

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
        const ctx = build({});
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
        ctx.__clock.advance(grace + 1);
        ok(label, (focused > 0) === expectFocused, focused);
        settle();
    });
}
focusCase('lookup យឺត + ប្រអប់ទទេ ➜ focus ក្រោយ grace', {}, true);
focusCase('អ្នកប្រើវាយរួច ➜ **មិន** focus (មិនរំខានការវាយ)', { typed: '012345678' }, false);
focusCase('ប្រអប់បិទរួច ➜ **មិន** focus', { modalClosed: true }, false);
focusCase('ស្កេនកញ្ចប់បន្ទាប់រួច ➜ **មិន** focus លើកញ្ចប់ចាស់', { otherBarcode: true }, false);

scenario('focus តែម្តង', () => {
    const ctx = build({});
    let focused = 0;
    ctx.__input = { value: '', focus: () => { focused++; } };
    let settle;
    ctx.__promise = new Promise((r) => { settle = r; });
    vm.runInContext('isModalOpen = true;', ctx);
    vm.runInContext('armLookupFocus(__input, "BC1", __promise);', ctx);
    ctx.__clock.advance(vm.runInContext('LOOKUP_FOCUS_GRACE_MS', ctx) + 1);
    settle();
    return Promise.resolve().then(() => {
        ok('grace + finally ➜ focus តែម្តងគត់', focused === 1, focused);
    });
});

scenario('ពិដាន grace', () => {
    const ctx = build({});
    const g = vm.runInContext('LOOKUP_FOCUS_GRACE_MS', ctx);
    ok('grace <= ១ វិនាទី', typeof g === 'number' && g > 0 && g <= 1000, g);
});

// === ការអះអាងស្តាទិច ៖ ខ្សែសង្វាក់ត្រូវភ្ជាប់ពិត ===
const fetchFn = sliceFn('fetchCustomerDataTableRows') || '';
ok('ការធ្លាក់ ➜ ហៅ scheduleCustomerTableRetry()', fetchFn.indexOf('scheduleCustomerTableRetry()') !== -1);
ok('ជោគជ័យ ➜ ហៅ clearCustomerTableRetry()', fetchFn.indexOf('clearCustomerTableRetry()') !== -1);
const scanFn = SRC.indexOf('armLookupFocus(modalPhoneInput');
ok('ផ្លូវស្កេនប្រើ armLookupFocus()', scanFn !== -1);
const cacheClear = sliceFn('clearCustomerDataTableCache') || '';
ok('ការចាកចេញ/ប្តូរ Config ➜ លុបម៉ោងព្យាយាមវិញ', cacheClear.indexOf('clearCustomerTableRetry()') !== -1);

Promise.all(pendingScenarios).then(() => new Promise((r) => setTimeout(r, 10))).then(() => {
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
});
