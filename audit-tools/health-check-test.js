// ⛔ ថ្នាក់កំហុស៖ **ឧបករណ៍វិនិច្ឆ័យដែលនិយាយមិនពិត។**
//
// ការពិនិត្យសុខភាពត្រូវជា **ការអានសុទ្ធសាធ** ៖ អ្នកប្រើបើកវាពេល App មាន
// បញ្ហារួចទៅហើយ ➜ វា **មិនត្រូវសរសេរអ្វី** · មិនត្រូវបង្ខំ PIN · និងមិនត្រូវ
// អះអាងលើសអ្វីដែលវាវាស់បាន។ ថ្នាក់ដែលឯកសារនេះបិទ ៖
//
//   ១. **«ពិនិត្យមិនបាន» ត្រូវរាយជា ⚠️ មិនមែន ❌។** ច្បាប់ដដែលនឹង
//      `license-verify.js` ៖ «មិនអាចផ្ទៀងផ្ទាត់» ≠ «ខុស»។ បើ getStatus()
//      បដិសេធ ឬក្រៅបណ្ដាញ ការរាយជា ❌ ធ្វើឲ្យអ្នកប្រើដេញតាមកំហុសដែលមិនមាន។
//   ២. **secret មិនត្រូវឡើងដល់ DOM។** តម្លៃ header របស់ ZTO ជា credential —
//      វាត្រូវទៅតែក្នុង request header មិនមែនក្នុងអត្ថបទដែលបង្ហាញ។
//   ៣. **Apps Script មិនត្រូវទទួល header ផ្ទាល់ខ្លួន** (preflight ➜ ស្លាប់) ➜
//      ផ្លូវនោះមិនត្រូវហៅបណ្ដាញសោះ។
//   ៤. **មិនបង្ខំ PIN** — សោដែលបិទ ➜ រាយមូលហេតុ មិនមែនបើកប្រអប់ PIN។
//   ៥. **គ្មានការសរសេរ** — ការវិនិច្ឆ័យមិនត្រូវប៉ះ Firebase ឬលុយ។
//
// ⛔ ការអះអាងមាន **២ ខាង** ៖ ករណីល្អត្រូវរាយ ✅ ពិត (បើអត់ «រាយ ⚠️ គ្រប់ពេល»
//    ក៏បៃតងដែរ ដែលជាឧបករណ៍ឥតប្រយោជន៍)។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { reactRuntime } = require('./react-view.js');

const ROOT = process.env.HEALTH_APP_DIR ? path.resolve(process.env.HEALTH_APP_DIR) : path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

let SRC = '';
try { SRC = fs.readFileSync(APP_JS, 'utf8'); } catch (e) { SRC = ''; }
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

const NEEDED = ['healthRowHtml', 'healthAgeText', 'healthNetworkRow', 'healthDatabaseRow',
    'healthClockRow', 'healthLicenseRow', 'healthCustomerTableRow', 'healthStorageRow',
    'healthServiceWorkerRow', 'healthLookupRow', 'ztoRenewalText', 'healthSheetScriptRow', 'clearCustomerDataTableCache', 'ztoDiagnosticsUrl', 'runHealthCheck',
    'openHealthCheck', 'safeLookupReason', 'lookupApiIsZto', 'lookupApiIsAppsScript',
    'sanitizeInput', 'elapsedSince', 'fetchWithTimeout', 'testLookupApiConfig',
    'attemptAutoLookup', 'lookupApiSendsHeader', 'retryAsync', 'lookupResponseError',
    'markLookupTimeoutNoRetry', 'lookupFailureCooldownMs', 'lookupFailureIsDefinitive',
    'retryTransientLookupResponse', 'noteSheetScriptVersion', 'getNestedField', 'dropAutoLookupQueueEntry',
    // ⛔ App React ៖ ជួរជា **model** (`healthRow()`) ដែល `HealthCheckList` គូរ មិនមែនខ្សែអក្សរ HTML
    'healthRow', 'healthPendingRow'];
const src = {};
NEEDED.forEach((n) => {
    src[n] = sliceFn(n);
    ok('រកឃើញ function ' + n + '()', !!src[n]);
});

const SECRET = 'super-secret-proxy-key-9911';

function buildRuntime(over) {
    const o = over || {};
    const fetches = [];
    const pinPrompts = [];
    const listEl = { innerHTML: '' };
    const btnEl = { disabled: false };
    const modalEl = { style: { display: 'flex' } };
    const alerts = [];
    const lookupStatuses = [];
    const fills = [];
    const inputs = {
        lookupApiUrlInput: { value: o.cfg && o.cfg.url || '' },
        lookupApiHeaderNameInput: { value: o.cfg && o.cfg.headerName || '' },
        lookupApiHeaderValueInput: { value: '' }
    };
    const ctx = {
        console: { error: () => {}, log: () => {} },
        Object, Array, Promise, JSON, String, Number, Math, Date, Error, Set, Map,
        isFinite, parseFloat, isNaN, URL, setTimeout, clearTimeout, queueMicrotask,
        navigator: { onLine: o.online !== false, serviceWorker: o.sw === false ? {} : { controller: {} } },
        window: { ZoeLicense: o.license === null ? null : { getStatus: o.license || (() => Promise.resolve({ state: 'active' })) } },
        ZoeLicense: o.license === null ? null : { getStatus: o.license || (() => Promise.resolve({ state: 'active' })) },
        LICENSE_APP_CODE: 'ZOE',
        ZTO_TEST_TIMEOUT_MS: o.testTimeoutMs || 11000,
        LOOKUP_TEST_TIMEOUT_MS: 20000,
        ZTO_AUTO_LOOKUP_TIMEOUT_MS: o.testTimeoutMs || 13000,
        AUTO_LOOKUP_TIMEOUT_MS: 16000,
        AUTO_LOOKUP_FAIL_COOLDOWN_MS: 30000,
        AUTO_LOOKUP_TRANSIENT_COOLDOWN_MS: 6000,
        AUTO_LOOKUP_FAILURE_MAX: 100,
        AUTO_LOOKUP_MAX_IN_FLIGHT: 2,
        autoLookupInFlight: new Map(),
        autoLookupFailureAt: new Map(),
        autoLookupQueueRetries: new Map(),
        customerDataTableSessionGeneration: 1,
        getFastLookupRow: () => null,
        findCustomerDataTableRow: () => null,
        scheduleCustomerTableSoonRefresh: () => {},
        pumpAutoLookupQueue: () => {},
        setLookupStatus: (barcode, kind, message) => lookupStatuses.push({ barcode, kind, message }),
        setFastLookupRow: () => {},
        rememberCustomerTableRow: () => {},
        applyLookupFillToModal: (...args) => fills.push(args),
        alert: (message) => alerts.push(message),
        prompt: () => 'ZTO-HEALTH-TEST-001',
        showToast: () => {},
        DB_LISTENER_KEYS: ['exchangeRate', 'dailyRevenue', 'monthlyRevenue', 'dailyPickup', 'history', 'deleted'],
        isDatabaseConnected: o.dbConnected !== false,
        hasEverConnectedToDatabase: true,
        serverClockTrusted: o.clockTrusted !== false,
        serverTimeOffsetMs: o.offset === undefined ? 0 : o.offset,
        appLocalStore: o.localStore === null ? null : {},
        appSessionStore: {},
        customerDataTableRows: o.rows === undefined ? null : o.rows,
        customerDataTableFetchedAt: 1,
        customerTableIsPartial: !!o.partial,
        lookupSecretKey: o.unlocked === false ? null : {},
        SHEET_SCRIPT_VERSION_EXPECTED: 1,
        sheetScriptVersionSeen: o.scriptSeen === undefined ? null : o.scriptSeen,
        dbListenerViewIsStale: () => !!o.stale,
        cleanupClockIsTrustworthy: () => o.cleanupOk !== false,
        getServerNow: () => 1770000000000,
        getLookupApiConfig: () => (o.cfg === undefined ? null : o.cfg),
        decryptLookupSecret: () => Promise.resolve(o.secretPlain === undefined ? SECRET : o.secretPlain),
        withTimeout: (p) => p,
        AbortController: typeof AbortController === 'function' ? AbortController : undefined,
        // ⛔ `fetchWithTimeout` ត្រូវជា **កូដពិត** ដែលស្រង់ចេញពី app.js ៖ វាដោះ
        //    ជា `{ res, body }` មិនមែន `Response` ទេ។ ជំនាន់មុននៃឯកសារនេះ
        //    **stub វា** ➜ ការហៅដែលអានវាជា `Response` (`res.ok` = undefined)
        //    ឆ្លងកាត់ការវាស់ ➜ ផលិតកម្មរាយ «HTTP undefined» ជា ❌ លើ Cookie
        //    ដែលដំណើរការធម្មតា។ **ការ stub ស្នាមភ្ជាប់ដែលកំពុងវាស់ = ការវាស់
        //    អ្វីផ្សេង។** ដូច្នេះឥឡូវ stub តែ `fetch` ប៉ុណ្ណោះ។
        fetch: (url, init) => {
            fetches.push({ url, headers: (init && init.headers) || {} });
            if (o.fetchImpl) return o.fetchImpl(url, init);
            const status = o.httpStatus || 200;
            const okRes = status >= 200 && status < 300;
            return Promise.resolve({
                ok: okRes,
                status: status,
                json: () => Promise.resolve(o.diagBody || {
                    ok: true, cookie: { source: 'blob', fingerprint: 'a1b2c3d4', ageMs: 600000, storeReason: 'env-fallback', authAcceptedAgeMs: 5000 }
                })
            });
        },
        closeSideDrawer: () => {},
        openModalHelper: () => {},
        requestPinBeforeConfig: (fn, key) => { pinPrompts.push(key); },
        document: { getElementById: (id) => (id === 'healthCheckList' ? listEl : id === 'healthRecheckBtn' ? btnEl : id === 'healthCheckModal' ? modalEl : inputs[id] || null) }
    };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    // ⛔ ស្រទាប់ React (ឃ្លាំង `uiState`/`viewState` · `fieldValue` · ប្រអប់) — កូដពិតពីទិដ្ឋភាព (`react-view.js`)
    vm.runInContext(reactRuntime(SRC, { exclude: NEEDED, context: ctx }), ctx);
    const code = NEEDED.map((n) => src[n]).filter(Boolean).join('\n')
        + "\nconst HEALTH_ICONS = { ok: '\\u2705', warn: '\\u26a0\\ufe0f', bad: '\\u274c', info: '\\u2139\\ufe0f' };"
        + '\nglobalThis.api = { runHealthCheck, healthLookupRow, healthLicenseRow, healthClockRow, healthDatabaseRow, healthStorageRow, healthCustomerTableRow, healthNetworkRow, healthServiceWorkerRow, healthSheetScriptRow, ztoDiagnosticsUrl, testLookupApiConfig, attemptAutoLookup };';
    vm.runInContext(code, ctx);
    // ⛔ ជួរ (model) ➜ markup ដដែលនឹងអ្វីដែល `HealthCheckList` គូរ (class · រូប · ស្លាក · ព័ត៌មាន) ➜ ការអះអាងលើ
    //    អត្ថបទដែលអ្នកប្រើឃើញ នៅដដែល។ ខ្សែអក្សរ (App ចាស់) ឆ្លងកាត់ត្រង់ៗ។
    const api = {};
    for (const [name, fn] of Object.entries(ctx.api)) {
        api[name] = typeof fn !== 'function' || !/^health.*Row$/.test(name) ? fn : (...args) => {
            const out = fn(...args);
            return out && typeof out.then === 'function' ? out.then(renderHealthRow) : renderHealthRow(out);
        };
    }
    return { api, ctx, fetches, pinPrompts, listEl, btnEl, alerts, lookupStatuses, fills };
}

function escapeText(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// markup ដដែលនឹង `HealthCheckList.tsx` ៖ `<div class={cls}><span health-ico>{icon}</span><span health-text><b>{label}</b>
// <span health-detail>{detail}</span></span></div>` (គ្មាន `.health-detail` ពេល `detail === null`)
function renderHealthRow(row) {
    if (!row || typeof row !== 'object') return row;
    return '<div class="' + escapeText(row.cls) + '"><span class="health-ico">' + escapeText(row.icon) + '</span>'
        + '<span class="health-text"><b>' + escapeText(row.label) + '</b>'
        + (row.detail === null ? '' : '<span class="health-detail">' + escapeText(row.detail) + '</span>') + '</span></div>';
}

const ZTO_CFG = { enabled: true, url: 'https://x.netlify.app/.netlify/functions/zto-order-detail?barcode={barcode}', headerName: 'X-Zoe-Proxy-Key', headerValueEnc: { data: [1], iv: [2] } };
const SHEET_CFG = { enabled: true, url: 'https://script.google.com/macros/s/AAA/exec', headerName: 'X-Key', headerValueEnc: { data: [1], iv: [2] } };

const state = (html) => (/health-bad/.test(html) ? 'bad' : /health-warn/.test(html) ? 'warn' : /health-ok/.test(html) ? 'ok' : 'info');

(async () => {
    {
        const rt = buildRuntime({ cfg: ZTO_CFG });
        const html = await rt.api.healthLookupRow();
        ok('ZTO ដែលមាន Cookie ➜ រាយ ✅ (ទិសវិជ្ជមាន)', state(html) === 'ok', state(html));
        ok('ZTO ៖ ហៅ diagnostics ពិត ១ ដង', rt.fetches.length === 1, rt.fetches.length);
        ok('ZTO ៖ URL បញ្ចប់ដោយ ?diag=1 លើផ្លូវ Function', /\/\.netlify\/functions\/zto-order-detail\?diag=1$/.test(rt.fetches[0].url), rt.fetches[0].url);
        ok('ZTO ៖ header សម្ងាត់ត្រូវផ្ញើក្នុង request', rt.fetches[0].headers['X-Zoe-Proxy-Key'] === SECRET);
        ok('⛔ ZTO ៖ តម្លៃសម្ងាត់មិនឡើងដល់អត្ថបទដែលបង្ហាញ', html.indexOf(SECRET) === -1);
        ok('ZTO ៖ បង្ហាញលេខសម្គាល់ Cookie ៨ តួ', html.indexOf('a1b2c3d4') !== -1);
        // 🔴 ការថយក្រោយពិត (រាយការណ៍ដោយអ្នកប្រើលើឧបករណ៍ពិត) ៖ កូដអាន
        //    លទ្ធផលរបស់ `fetchWithTimeout` ជា `Response` ➜ `res.ok` undefined
        //    ➜ **រាយ ❌ «HTTP undefined» លើ Cookie ដែលដំណើរការ**។
        ok('⛔ Cookie ដំណើរការ ➜ មិនត្រូវរាយ ❌ ដាច់ខាត', html.indexOf('health-bad') === -1, html.slice(0, 120));
        ok('⛔ គ្មានពាក្យ «undefined» ក្នុងអត្ថបទដែលអ្នកប្រើអាន', html.indexOf('undefined') === -1);
    }
    // 🔴 ការថយក្រោយពិត (រាយការណ៍ដោយអ្នកប្រើលើឧបករណ៍ពិត 2026-09-06) ៖
    //    health check រាយ **✅ «Cookie ពី blob · លេខសម្គាល់ 3ad3c71f»** ខណៈ
    //    ការស្កេនពិត **ក្នុងនាទីដដែល** ឆ្លើយ «🔒 Cookie ZTO ផុតកំណត់»។
    //
    // មូលហេតុ ៖ `healthLookupRow()` សម្រេច ✅ ត្រឹម **វត្តមាន** នៃ Cookie
    // (`source !== 'none' && fingerprint`) ដោយ **មិនដែលសួរថា ZTO ទទួលយកវាឬអត់**។
    // Function កត់សាលក្រមនោះរួចហើយ (`noteCookieRejected()` លើ 401 ·
    // `noteCookieAccepted()` លើជោគជ័យ) ហើយ **បង្ហាញវាក្នុង `?diag=1`** —
    // តែជួរ health **មិនអានវាសោះ**។
    //
    // នេះជាថ្នាក់ដដែលនឹងច្បាប់ «ការវិនិច្ឆ័យដែលនិយាយមិនពិត» តែ **ក្នុងទិស
    // ផ្ទុយ** ៖ ច្បាប់ចាស់ហាមរាយ ❌ លើអ្វីដែល *មិនបានវាស់*; ត្រង់នេះវារាយ
    // **✅** លើអ្វីដែល *មិនបានវាស់*។ ⛔ ✅ ក្លែងក្លាយលើផ្លូវ Lookup គឺ
    // **អាក្រក់ជាង** ❌ ក្លែងក្លាយ ព្រោះវាបញ្ជូនអ្នកប្រើទៅរកមូលហេតុខុស។
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, diagBody: { ok: true, cookie: {
            source: 'blob', fingerprint: '3ad3c71f', ageMs: 0, authRejectedAgeMs: 4000 } } });
        const html = await rt.api.healthLookupRow();
        ok('⛔ ZTO បដិសេធ Cookie (401) ➜ មិនត្រូវរាយ ✅ ដាច់ខាត',
            state(html) !== 'ok', state(html) + ' :: ' + html.slice(0, 160));
        ok('⛔ ZTO បដិសេធ Cookie ➜ ប្រាប់សាលក្រមបដិសេធពិត',
            /បដិសេធ/.test(html), html.slice(0, 200));
        ok('⛔ សាលក្រមបដិសេធមិនបញ្ជាក់ថា Cookie ផុតកំណត់តាមពេល',
            !/ផុតកំណត់/.test(html), html.slice(0, 200));
        ok('⛔ ZTO បដិសេធ Cookie ➜ ត្រូវប្រាប់វិធីដោះស្រាយ (sync-zto-cookie)',
            /sync-zto-cookie/.test(html), html.slice(0, 220));
    }
    // ⛔ ទិសផ្ទុយ ១ ៖ សាលក្រម **ទទួលយក** ពិត ➜ នៅតែត្រូវរាយ ✅
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, diagBody: { ok: true, cookie: {
            source: 'blob', fingerprint: 'a1b2c3d4', ageMs: 60000, authAcceptedAgeMs: 3000 } } });
        const html = await rt.api.healthLookupRow();
        ok('⛔ ទិសផ្ទុយ ៖ ZTO ទទួលយក Cookie ➜ រាយ ✅ ដដែល', state(html) === 'ok', state(html));
    }
    // ⛔ ទិសផ្ទុយ ២ ៖ Cookie មាន តែ **មិនទាន់ដែលប្រើ** លើ container នេះ ➜
    //    «ពិនិត្យមិនបាន» ➜ ⚠️ មិនមែន ✅ និង **មិនមែន ❌** (ច្បាប់គម្រោង)។
    //    `cookieState` ជារបស់ container នីមួយៗ ➜ diag អាចចុះលើ container ថ្មី
    //    ដែលមិនដែលឃើញ 401 ➜ ការរាយ ✅ នៅទីនោះជាការអះអាងលើអ្វីដែលមិនបានវាស់។
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, diagBody: { ok: true, cookie: {
            source: 'blob', fingerprint: 'a1b2c3d4', ageMs: 60000 } } });
        const html = await rt.api.healthLookupRow();
        ok('⛔ Cookie មាន តែមិនទាន់ដែលប្រើ ➜ ⚠️ «ពិនិត្យមិនបាន» មិនមែន ✅',
            state(html) === 'warn', state(html) + ' :: ' + html.slice(0, 160));
        ok('⛔ ករណីនោះមិនត្រូវរាយ ❌ (មិនអះអាងថាខូច)',
            state(html) !== 'bad', state(html));
    }
    // ── ការបន្តអាយុ Cookie ដោយស្វ័យប្រវត្តិ ────────────────────────────────
    // ⛔ ច្បាប់ដដែលនឹងសាលក្រម auth ៖ **«មិនបានវាស់» មិនត្រូវរាយជាសាលក្រម**។
    // `upstreamCookieSignal` ជារបស់ container នីមួយៗ ➜ diag អាចចុះលើ container
    // ត្រជាក់ដែល **មិនទាន់ហៅ ZTO ម្តងណា** ➜ `observed: false` **មិនមែន**
    // «Argus មិនផ្ញើ Set-Cookie» ទេ។ វាស់បានលើផលិតកម្មពិត (2026-09-09) ៖
    // `observed:false · cacheEntries:0 · authAccepted/Rejected: null` ស៊ីគ្នា
    // ទាំង ３ ➜ container ត្រជាក់ — មិនមែនភស្តុតាងអំពីការបន្តអាយុឡើយ។
    // ការវាស់ទី ２ លើ container ក្តៅ ➜ `observed:true · setCookie:false` ➜
    // នោះទើបជាភស្តុតាងថា Argus មិនផ្ញើ Cookie ថ្មី។
    //
    // ⛔ ការបន្ថែមនេះ **មិនត្រូវប្តូរសាលក្រម** ❌/⚠️/✅ ដែលជួរខាងលើចាក់សោ។
    {
        const base = { source: 'blob', fingerprint: 'a1b2c3d4', ageMs: 60000, authAcceptedAgeMs: 3000 };
        const rowFor = async (cookieExtra, sessionRenewal) => {
            const rt = buildRuntime({ cfg: ZTO_CFG, diagBody: { ok: true,
                cookie: Object.assign({}, base, cookieExtra), sessionRenewal: sessionRenewal } });
            return rt.api.healthLookupRow();
        };

        const coldHtml = await rowFor({ renewals: 0 }, { observed: false, setCookie: false, names: [], ageMs: null });
        ok('⛔ ការបន្តអាយុមិនទាន់វាស់ ➜ ប្រាប់ថា «មិនទាន់វាស់»',
            /មិនទាន់វាស់/.test(coldHtml), coldHtml.slice(0, 300));
        ok('⛔ មិនទាន់វាស់ ➜ **មិនត្រូវ**អះអាងថា ZTO មិនផ្ញើ Cookie ថ្មី',
            !/មិនផ្ញើ/.test(coldHtml), coldHtml.slice(0, 300));
        ok('⛔ ការបន្ថែមមិនត្រូវប្តូរសាលក្រម auth (នៅ ✅ ដដែល)',
            state(coldHtml) === 'ok', state(coldHtml));

        const noSetHtml = await rowFor({ renewals: 0 }, { observed: true, setCookie: false, names: [], ageMs: 1000 });
        ok('⛔ វាស់រួច · Argus មិនផ្ញើ ➜ ប្រាប់ត្រង់ៗ',
            /មិនផ្ញើ/.test(noSetHtml), noSetHtml.slice(0, 300));
        ok('⛔ ករណីនោះមិនត្រូវរាយថា «មិនទាន់វាស់»',
            !/មិនទាន់វាស់/.test(noSetHtml), noSetHtml.slice(0, 300));
        ok('⛔ ការបន្ថែមមិនត្រូវប្តូរសាលក្រម auth (នៅ ✅ ដដែល)',
            state(noSetHtml) === 'ok', state(noSetHtml));

        const canRenewHtml = await rowFor({ renewals: 0 }, { observed: true, setCookie: true, names: ['BOS-MAN-SESSION'], ageMs: 1000 });
        ok('⛔ Argus ផ្ញើ Cookie ថ្មី ➜ ប្រាប់ថាបន្តអាយុបាន',
            /បន្តអាយុ/.test(canRenewHtml) && !/មិនផ្ញើ/.test(canRenewHtml), canRenewHtml.slice(0, 300));

        const renewedHtml = await rowFor({ renewals: 7 }, { observed: true, setCookie: true, names: ['BOS-MAN-SESSION'], ageMs: 1000 });
        ok('⛔ បន្តអាយុពិត ➜ បង្ហាញចំនួនដង',
            /7/.test(renewedHtml) && /បន្តអាយុ/.test(renewedHtml), renewedHtml.slice(0, 300));

        ok('⛔ ឈ្មោះ cookie មិនត្រូវឡើងដល់ DOM',
            !/BOS-MAN-SESSION/.test(renewedHtml) && !/BOS-MAN-SESSION/.test(canRenewHtml), renewedHtml.slice(0, 300));

        for (const bad of [null, 'x', 42, [], { observed: 'yes' }]) {
            const junkHtml = await rowFor({ renewals: bad }, bad);
            ok('⛔ sessionRenewal ខូច (' + JSON.stringify(bad) + ') ➜ នៅតែរាយជួរបាន',
                state(junkHtml) === 'ok' && junkHtml.length > 40, state(junkHtml));
        }
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, testTimeoutMs: 20, fetchImpl: () => new Promise(() => {}) });
        await rt.api.testLookupApiConfig(rt.btnEl);
        const message = rt.alerts[rt.alerts.length - 1] || '';
        ok('⛔ សាក API ៖ សំណើព្យួរឆ្លង timeout ពិត ហើយបើកប៊ូតុងឡើងវិញ',
            rt.fetches.length === 1 && /Timeout/.test(message) && !rt.btnEl.disabled, message);
        ok('⛔ Timeout មិនមែនភស្តុតាងថា Cookie ផុតកំណត់',
            !/ផុតកំណត់/.test(message), message);
        ok('⛔ Timeout ប្រាប់ឲ្យសាកបណ្ដាញឡើងវិញ ដោយមិនបញ្ជូនទៅ Sync Cookie',
            /សាកល្បង/.test(message) && !/Cookie Sync|sync-zto-cookie/.test(message), message);
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, httpStatus: 401,
            diagBody: { code: 'ZTO_AUTH_EXPIRED', reason: 'upstream-auth-rejected' } });
        await rt.api.attemptAutoLookup('ZTO-HEALTH-TEST-002');
        const verdict = rt.lookupStatuses[rt.lookupStatuses.length - 1] || {};
        ok('⛔ Lookup ៖ HTTP 401 ពិតទៅដល់សារ auth ហើយមិន retry',
            rt.fetches.length === 1 && verdict.kind === 'error' && /Cookie/.test(verdict.message || ''), verdict);
        ok('⛔ Lookup ៖ ZTO_AUTH_EXPIRED រក្សា compatibility តែប្រាប់ថា ZTO បដិសេធ',
            /ZTO/.test(verdict.message || '') && /បដិសេធ/.test(verdict.message || ''), verdict);
        ok('⛔ Lookup ៖ សាលក្រមបដិសេធមិនអះអាងថាផុតកំណត់តាមពេល',
            !/ផុតកំណត់/.test(verdict.message || ''), verdict);
        ok('⛔ Lookup ៖ បដិសេធត្រូវផ្តល់វិធីស្តារ Cookie ហើយមិនបំពេញទិន្នន័យ',
            /Cookie Sync/.test(verdict.message || '') && rt.fills.length === 0, verdict);
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, testTimeoutMs: 20, fetchImpl: () => new Promise(() => {}) });
        await rt.api.attemptAutoLookup('ZTO-HEALTH-TEST-003');
        const verdict = rt.lookupStatuses[rt.lookupStatuses.length - 1] || {};
        ok('⛔ Lookup ៖ timeout ពិតប្រាប់ថាយឺត ដោយមិនប្រាប់ថា Cookie ខូច',
            rt.fetches.length === 1 && verdict.kind === 'error' && /យឺត/.test(verdict.message || '')
            && !/Cookie|ផុតកំណត់/.test(verdict.message || ''), verdict);
    }
    {
        const cfg = Object.assign({}, ZTO_CFG, { phoneField: 'phone', codField: 'cod', dodField: 'dod' });
        const rt = buildRuntime({ cfg, diagBody: { found: true, phone: '012345678', cod: 5, dod: 1 } });
        await rt.api.attemptAutoLookup('ZTO-HEALTH-TEST-004');
        const verdict = rt.lookupStatuses[rt.lookupStatuses.length - 1] || {};
        ok('⛔ ទិសផ្ទុយ ៖ Lookup ជោគជ័យពិត នៅតែបំពេញទិន្នន័យ និងបង្ហាញជោគជ័យ',
            rt.fetches.length === 1 && verdict.kind === 'success' && rt.fills.length === 1
            && rt.fills[0][1] === '012345678' && rt.fills[0][2] === 5 && rt.fills[0][3] === 1, verdict);
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, httpStatus: 500 });
        const html = await rt.api.healthLookupRow();
        ok('⛔ HTTP 500 ➜ ❌ ព្រមទាំង **លេខពិត** មិនមែន undefined',
            state(html) === 'bad' && /500/.test(html) && html.indexOf('undefined') === -1, html.slice(0, 140));
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, diagBody: { ok: true, cookie: { source: 'none', fingerprint: null } } });
        const html = await rt.api.healthLookupRow();
        ok('⛔ ZTO គ្មាន Cookie ➜ រាយ ❌ ព្រមទាំងវិធីដោះស្រាយ', state(html) === 'bad' && /sync-zto-cookie/.test(html), state(html));
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, online: false });
        const html = await rt.api.healthLookupRow();
        ok('⛔ ក្រៅបណ្ដាញ ➜ ⚠️ មិនមែន ❌ (មិនអះអាងលើអ្វីដែលមិនបានវាស់)', state(html) === 'warn', state(html));
        ok('⛔ ក្រៅបណ្ដាញ ➜ គ្មានការហៅបណ្ដាញសោះ', rt.fetches.length === 0, rt.fetches.length);
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, unlocked: false });
        const html = await rt.api.healthLookupRow();
        ok('⛔ សោមិនទាន់ដោះ ➜ ប្រាប់មូលហេតុ (ℹ️) មិនមែន ❌', state(html) === 'info', state(html));
        ok('⛔ សោមិនទាន់ដោះ ➜ **មិនបង្ខំប្រអប់ PIN**', rt.pinPrompts.length === 0, rt.pinPrompts);
        ok('⛔ សោមិនទាន់ដោះ ➜ គ្មានការហៅបណ្ដាញ', rt.fetches.length === 0, rt.fetches.length);
    }
    {
        const rt = buildRuntime({ cfg: SHEET_CFG });
        const html = await rt.api.healthLookupRow();
        ok('⛔ Apps Script ➜ គ្មានការហៅបណ្ដាញ (preflight នឹងសម្លាប់វា)', rt.fetches.length === 0, rt.fetches.length);
        ok('Apps Script ➜ រាយ ✅ ព្រមទាំងបញ្ជាក់ថាមិនផ្ញើ Header', state(html) === 'ok' && /Header/.test(html), state(html));
        ok('⛔ Apps Script ៖ សម្ងាត់មិនឡើងដល់អត្ថបទ', html.indexOf(SECRET) === -1);
    }
    {
        const rt = buildRuntime({ cfg: undefined });
        const html = await rt.api.healthLookupRow();
        ok('Lookup មិនទាន់បើក ➜ ℹ️ មិនមែនការធ្លាក់', state(html) === 'info', state(html));
    }
    {
        const rt = buildRuntime({ license: () => Promise.reject(new Error('boom')) });
        const html = await rt.api.healthLicenseRow();
        ok('⛔ អាជ្ញាប័ណ្ណពិនិត្យមិនបាន ➜ ⚠️ មិនមែន ❌ («មិនអាចផ្ទៀងផ្ទាត់» ≠ «ខុស»)', state(html) === 'warn', state(html));
        ok('⛔ សារត្រូវប្រាប់ថាវាមិនមែនមានន័យថា Key ខុស', /មិនមែនមានន័យថា/.test(html));
    }
    {
        const rt = buildRuntime({});
        const html = await rt.api.healthLicenseRow();
        ok('អាជ្ញាប័ណ្ណសកម្ម ➜ ✅ (ទិសវិជ្ជមាន)', state(html) === 'ok', state(html));
    }
    {
        const rt = buildRuntime({ dbConnected: false });
        ok('⛔ Firebase ដាច់ ➜ ❌', state(rt.api.healthDatabaseRow()) === 'bad');
        const rt2 = buildRuntime({ stale: true });
        ok('⛔ ភ្ជាប់រួច តែទិន្នន័យមិនមកដល់ ➜ ⚠️ («ភ្ជាប់រួច» ≠ «ទិន្នន័យមកដល់»)', state(rt2.api.healthDatabaseRow()) === 'warn');
        const rt3 = buildRuntime({});
        ok('Firebase ធម្មតា ➜ ✅ (ទិសវិជ្ជមាន)', state(rt3.api.healthDatabaseRow()) === 'ok');
    }
    {
        ok('⛔ នាឡិកាមិនទាន់ sync ➜ ⚠️', state(buildRuntime({ clockTrusted: false }).api.healthClockRow()) === 'warn');
        ok('⛔ ការសម្អាតផ្អាក ➜ ⚠️ ព្រមទាំងមូលហេតុ', state(buildRuntime({ cleanupOk: false }).api.healthClockRow()) === 'warn');
        const okHtml = buildRuntime({ offset: 4200 }).api.healthClockRow();
        ok('នាឡិកាធម្មតា ➜ ✅ ព្រមទាំងគម្លាតជាវិនាទី', state(okHtml) === 'ok' && /4 វិនាទី/.test(okHtml), okHtml);
    }
    {
        ok('⛔ storage ត្រូវបិទ ➜ ❌', state(buildRuntime({ localStore: null }).api.healthStorageRow()) === 'bad');
        ok('storage ធម្មតា ➜ ✅', state(buildRuntime({}).api.healthStorageRow()) === 'ok');
        ok('⛔ Service Worker មិនគ្រប់គ្រង ➜ ⚠️', state(buildRuntime({ sw: false }).api.healthServiceWorkerRow()) === 'warn');
        ok('⛔ តារាងមិនពេញលេញ ➜ ⚠️', state(buildRuntime({ rows: [1, 2], partial: true }).api.healthCustomerTableRow()) === 'warn');
        ok('តារាងពេញលេញ ➜ ✅', state(buildRuntime({ rows: [1, 2] }).api.healthCustomerTableRow()) === 'ok');
        ok('⛔ ក្រៅបណ្ដាញ ➜ ជួរអ៊ីនធឺណិតជា ❌', state(buildRuntime({ online: false }).api.healthNetworkRow()) === 'bad');
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG });
        await rt.api.runHealthCheck();
        // ⛔ App React ៖ `runHealthCheck()` សរសេរ `uiState.healthRows` (ជួរដែល `HealthCheckList` គូរ) និង
        //    `viewState.healthRecheckBusy` (`disabled` របស់ប៊ូតុង) ➜ អានប្រភពទាំងនោះ
        const liveRows = vm.runInContext('uiState.healthRows', rt.ctx) || [];
        const html = liveRows.map(renderHealthRow).join('');
        const rows = (html.match(/class="health-row/g) || []).length;
        ok('runHealthCheck() បង្ហាញជួរគ្រប់ ៩', rows === 9, rows);
        ok('⛔ លទ្ធផលទាំងមូលមិនផ្ទុកតម្លៃសម្ងាត់', html.indexOf(SECRET) === -1);
        ok('ប៊ូតុងពិនិត្យម្តងទៀតត្រូវដោះវិញក្រោយចប់', vm.runInContext('viewState.healthRecheckBusy', rt.ctx) === false);
    }
    {
        ok('⛔ Lookup មិនប្រើ Sheet ➜ ជួរកំណែ Script ជា ℹ️ (មិនពាក់ព័ន្ធ)',
            state(buildRuntime({ cfg: ZTO_CFG, scriptSeen: 1 }).api.healthSheetScriptRow()) === 'info');
        ok('⛔ មិនទាន់ឃើញកំណែសោះ ➜ ℹ️ ព្រមទាំងវិធីដឹង (មិនមែន ❌)',
            state(buildRuntime({ cfg: SHEET_CFG }).api.healthSheetScriptRow()) === 'info');
        const same = buildRuntime({ cfg: SHEET_CFG, scriptSeen: 1 }).api.healthSheetScriptRow();
        ok('កំណែត្រូវគ្នា ➜ ✅ (ទិសវិជ្ជមាន)', state(same) === 'ok', state(same));
        const older = buildRuntime({ cfg: SHEET_CFG, scriptSeen: 0 }).api.healthSheetScriptRow();
        ok('⛔ Script ដែល deploy ចាស់ជាង App ➜ ⚠️ ព្រមទាំងវិធីដោះស្រាយ',
            state(older) === 'warn' && /Deploy/.test(older), state(older));
        const newer = buildRuntime({ cfg: SHEET_CFG, scriptSeen: 9 }).api.healthSheetScriptRow();
        ok('⛔ ទិសផ្ទុយ ៖ Script ថ្មីជាង App ➜ ⚠️ ព្រមទាំងណែនាំទាញ App',
            state(newer) === 'warn' && /ទាញ App/.test(newer), state(newer));
        // ⛔ ប្តូរ config Lookup ➜ កំណែដែលឃើញត្រូវបាត់ បើមិនដូច្នេះជួរនេះបង្ហាញ
        //    កំណែរបស់ deployment **ចាស់** លើ URL ថ្មី ➜ ការវិនិច្ឆ័យកុហក។
        const srcAll = NEEDED.map((n) => src[n] || '').join('\n');
        ok('⛔ `clearCustomerDataTableCache()` លុបកំណែដែលឃើញចោល',
            /function clearCustomerDataTableCache\(\)\s*\{\s*sheetScriptVersionSeen = null;/.test(srcAll));
        ok('ស្លាកប្រាប់ច្បាស់ថាវាគ្របផ្លូវ Lookup (គម្រោងសរសេរចូលជាគម្រោងផ្សេង)',
            /កំណែ Apps Script \(Lookup\)/.test(same), same.slice(0, 90));
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG });
        ok('ztoDiagnosticsUrl() សាងផ្លូវពី URL ដែលកំណត់',
            rt.api.ztoDiagnosticsUrl(ZTO_CFG) === 'https://x.netlify.app/.netlify/functions/zto-order-detail?diag=1',
            rt.api.ztoDiagnosticsUrl(ZTO_CFG));
    }

    // ⛔ ការវិនិច្ឆ័យត្រូវជាការអានសុទ្ធសាធ — គ្មានផ្លូវសរសេរណាមួយ។
    const writeNames = ['dbOp(', 'runTransaction(', 'fb.set(', 'fb.update(', 'fb.remove(', 'commitDailyRevenueDelta', 'claimBarcodeInRegistry'];
    const healthSrc = NEEDED.filter((n) => n.indexOf('health') === 0 || n === 'runHealthCheck' || n === 'openHealthCheck')
        .map((n) => src[n] || '').join('\n');
    const writes = writeNames.filter((w) => healthSrc.indexOf(w) !== -1);
    ok('⛔ ការពិនិត្យសុខភាពគ្មានផ្លូវសរសេរណាមួយ', writes.length === 0, writes);
    ok('⛔ ការពិនិត្យសុខភាពមិនហៅ requestPinBeforeConfig()', healthSrc.indexOf('requestPinBeforeConfig') === -1);
    ok('ជាន់អប្បបរមា៖ កូដដែលស្កេនមិនទទេ', healthSrc.length > 2000, healthSrc.length);

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')' : '✅ គ្មានបញ្ហា — ok ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('  FAIL  ' + (e && e.stack || e)); process.exit(1); });
