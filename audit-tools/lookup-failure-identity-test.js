// ⛔ ថ្នាក់កំហុស៖ **អត្តសញ្ញាណនៃការបរាជ័យ មិនរស់រានពីការព្យាយាមឡើងវិញ។**
//
// 🔴 វាស់បានលើ `origin/main` (2026-09-01)៖ `retryTransientLookupResponse()`
//   បោះ `new Error('HTTP ' + status)` **ទទេ** ➜ `lookupCode` របស់ proxy
//   (`ZTO_RATE_LIMITED` · `ZTO_TIMEOUT` · `ZTO_UPSTREAM_UNAVAILABLE`) **បាត់**
//   ➜ សាខា `e.lookupCode === '…'` ចំនួន ៣ ក្នុង `attemptAutoLookup()` ក្លាយជា
//   **កូដងាប់ដែលមិនអាចឈានដល់បាន** ➜ អ្នកប្រើឃើញសារទូទៅ «មិនអាចភ្ជាប់ ZTO បាន»
//   ជំនួសមូលហេតុពិត។
//
// ⛔ `zto-proxy-test.js` **បៃតងលើកូដនោះ** ព្រោះវាអះអាងត្រឹម
//   `lookupSource.indexOf("e.lookupCode === 'ZTO_RATE_LIMITED'") !== -1` —
//   នោះជាការវាស់ថា **អក្សរមានក្នុងឯកសារ** មិនមែនថា **សាខានោះឈានដល់បាន**។
//   នេះជាមេរៀន «checker ស្តាទិចចាក់សោ *ឈ្មោះ*; checker ឥរិយាបថចាក់សោ *លទ្ធផល*»
//   ក្នុងទម្រង់ថ្មី។ ឯកសារនេះរត់ **កូដពិត** រួចអានអត្ថបទស្ថានភាពដែលអ្នកប្រើឃើញ។
//
// ថ្នាក់ទី ២ ៖ **ការព្យាយាមឡើងវិញលើការបរាជ័យដែលចំណាយពេលរួចហើយ។**
//   `fetchWithTimeout` បញ្ចេញ «Auto lookup timed out» ក្រោយ ២០ វិនាទី ហើយ
//   `retryAsync(fn, 2, …)` ព្យាយាមម្តងទៀត ➜ **រហូតដល់ ៤០ វិនាទី** ខណៈសោ
//   `autoLookupInFlight` ជាប់ ➜ ពិដាន ២ ស្លុតពេញ ➜ **ការស្កេនទាំងអស់ជាប់**។
//   HTTP 429 ក៏ដូចគ្នា ៖ ការព្យាយាមឡើងវិញលើពិដានល្បឿន ធ្វើឲ្យវាអាក្រក់ជាង។
//
// ⛔ ការអះអាងទាំងអស់មាន **២ ខាង** ៖ អ្វីដែលមិនត្រូវព្យាយាមឡើងវិញ **និង**
//   អ្វីដែល **ត្រូវតែនៅតែព្យាយាមឡើងវិញ** (បណ្តាញញ័រពិត) — បើអះអាងតែខាងទប់
//   នោះ «ឈប់ព្យាយាមទាំងស្រុង» ក៏បៃតងដែរ ដែលជាការថយក្រោយ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { reactRuntime, renderedElement } = require('./react-view');

const ROOT = process.env.LOOKUPFAILURE_APP_DIR ? path.resolve(process.env.LOOKUPFAILURE_APP_DIR) : path.resolve(__dirname, '..');
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

const NEEDED = ['dropAutoLookupQueueEntry', 'scheduleAutoLookupQueueRetry',
    'pumpAutoLookupQueue', 'clearAutoLookupQueueRetries',
    'retryAsync', 'retryTransientLookupResponse', 'noteSheetScriptVersion', 'attemptAutoLookup', 'setLookupStatus',
    'safeLookupReason', 'lookupApiIsZto', 'lookupApiIsAppsScript', 'lookupApiSendsHeader',
    'retryPendingLookupAfterUnlock', 'elapsedSince',
    'lookupResponseError', 'markLookupTimeoutNoRetry', 'lookupFailureCooldownMs',
    'lookupFailureIsDefinitive'];
const src = {};
NEEDED.forEach((n) => {
    src[n] = sliceFn(n);
    // ⛔ កុំបញ្ឈប់ checker ពេលរកមិនឃើញ — ត្រូវ stub ជំនួស ដើម្បីឲ្យការអះអាង
    //    ឥរិយាបថខាងក្រោមនៅតែរត់ ហើយធ្លាក់ **ដោយមានឈ្មោះ**។
    ok('រកឃើញ function ' + n + '()', !!src[n]);
});

const TIMEOUT_MESSAGE = 'Auto lookup timed out';

// បង្កើតបរិស្ថានរត់កូដពិត។ `plan` ជាបញ្ជីលទ្ធផលក្នុងមួយការហៅ៖
//   { status, code, reason }  ឬ  { reject: 'timeout' | 'network' }
function buildRuntime(plan) {
    const calls = [];
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
        autoLookupInFlight: new Map(),
        autoLookupQueueRetries: new Map(),
        AUTO_LOOKUP_QUEUE_RETRY_MS: 400,
        AUTO_LOOKUP_QUEUE_MAX_WAIT_MS: 20000,
        autoLookupFailureAt: new Map(),
        lookupFastCache: new Map(),
        lookupLockedNoticeShown: false,
        lookupSecretKey: null,
        sheetScriptVersionSeen: null,
        pendingLookupUnlockBarcode: '',
        pendingLookupUnlockResolve: null,
        pendingBarcode: 'BC1',
        isModalOpen: true,
        customerDataTableSessionGeneration: 0,
        customerDataTableRows: null,
        customerDataTableFetchedAt: 0,
        customerDataTableLastFailedAt: 0,
        customerTableIsPartial: false,
        getFastLookupRow: () => null,
        setFastLookupRow: () => {},
        getLookupApiConfig: () => ({
            url: '/.netlify/functions/zto-order-detail?barcode={barcode}',
            enabled: true, fastMode: false, headerName: '', headerValueEnc: null,
            phoneField: 'phone', codField: 'cod', dodField: 'dod'
        }),
        findCustomerDataTableRow: () => null,
        scheduleCustomerTableSoonRefresh: () => {},
        rememberCustomerTableRow: () => {},
        applyLookupFillToModal: () => {},
        getNestedField: (d, k) => (d ? d[k] : null),
        showToast: () => {},
        decryptLookupSecret: () => Promise.resolve(''),
        isPinFlowPending: () => false,
        requestPinBeforeConfig: () => {},
        fetchWithTimeout: (url, opts, ms, timeoutMsg) => {
            const step = plan[Math.min(calls.length, plan.length - 1)];
            calls.push({ url, ms });
            if (step && step.reject === 'timeout') return Promise.reject(new Error(timeoutMsg || TIMEOUT_MESSAGE));
            if (step && step.reject === 'network') return Promise.reject(new TypeError('Failed to fetch'));
            const status = Number(step && step.status) || 200;
            const body = status >= 200 && status < 300
                ? { success: true, found: true, phone: '012345678', cod: 1, dod: 2 }
                : { error: 'x', code: step && step.code, reason: step && step.reason };
            return Promise.resolve({ res: { ok: status >= 200 && status < 300, status }, body });
        },
        document: { getElementById: (id) => (id === 'lookupStatus' ? statusEl : null) },
        ZoeErrors: { capture: () => {} },
        __calls: calls,
        __status: statusEl
    };
    ctx.window = ctx;
    ctx.queueMicrotask = queueMicrotask;
    vm.createContext(ctx);
    // ⛔ ZoeW ជា React ៖ ស្ថានភាព Lookup ជា `viewState.lookupStatus` ដែល `PhoneModal.tsx` គូរជា `#lookupStatus` ➜
    //    ស្រទាប់ React ពិតចូល sandbox ហើយ `__status` អានអត្ថបទពី **JSX ពិត**
    vm.runInContext(reactRuntime(SRC, { context: ctx }), ctx);
    Object.defineProperty(ctx, '__status', { configurable: true,
        value: renderedElement(ROOT, ctx, 'src/app/components/modals/PhoneModal.tsx', 'PhoneModal', 'lookupStatus') });
    ['elapsedSince', 'lookupApiIsZto', 'lookupApiIsAppsScript', 'lookupApiSendsHeader', 'safeLookupReason', 'setLookupStatus',
     'retryPendingLookupAfterUnlock', 'lookupResponseError', 'markLookupTimeoutNoRetry',
     'retryTransientLookupResponse', 'noteSheetScriptVersion', 'retryAsync', 'lookupFailureCooldownMs',
     'lookupFailureIsDefinitive', 'dropAutoLookupQueueEntry',
     'scheduleAutoLookupQueueRetry', 'pumpAutoLookupQueue',
     'clearAutoLookupQueueRetries'].forEach((n) => {
        if (src[n]) vm.runInContext(src[n].replace(/^\s{4}/gm, ''), ctx);
    });
    // ជាន់ការពារ ៖ បើ helper ថ្មីមិនទាន់មាន ត្រូវ stub ដើម្បីកុំឲ្យ
    // `ReferenceError` បិទបាំងការអះអាងឥរិយាបថទាំងអស់ខាងក្រោម។
    vm.runInContext('if (typeof lookupFailureCooldownMs !== "function") { globalThis.lookupFailureCooldownMs = function () { return AUTO_LOOKUP_FAIL_COOLDOWN_MS; }; }', ctx);
    if (src.attemptAutoLookup) vm.runInContext(src.attemptAutoLookup.replace(/^\s{4}/gm, ''), ctx);
    return ctx;
}

function run(plan) {
    const ctx = buildRuntime(plan);
    if (!src.attemptAutoLookup) return Promise.resolve({ calls: [], text: '', ctx });
    return vm.runInContext('attemptAutoLookup("BC1")', ctx)
        .then(() => ({ calls: ctx.__calls, text: ctx.__status.textContent, ctx }),
              () => ({ calls: ctx.__calls, text: ctx.__status.textContent, ctx }));
}

// កូដកំហុស ➜ HTTP status ដែល Function ZTO **ពិតជាផ្ញើ** (ស្រង់ពី `json(NNN, { … code: 'ZTO_…' })` ឬ `const body = { … code }` ➜ `json(NNN, body)`)
function functionErrorCodes() {
    let fnSrc = '';
    try { fnSrc = fs.readFileSync(path.join(ROOT, 'ZoeW', 'netlify', 'functions', 'zto-order-detail.js'), 'utf8'); } catch (e) { fnSrc = ''; }
    const out = new Map();
    const re = /code:\s*'(ZTO_[A-Z_]+)'/g;
    let m;
    while ((m = re.exec(fnSrc))) {
        const before = fnSrc.slice(Math.max(0, m.index - 160), m.index);
        const opened = before.lastIndexOf('json(');
        let status = opened !== -1 ? (/^json\((\d{3})\s*,/.exec(before.slice(opened)) || [])[1] : undefined;
        if (!status) status = (/json\((\d{3})\s*,\s*body\)/.exec(fnSrc.slice(m.index, m.index + 400)) || [])[1];
        if (status && !out.has(m[1])) out.set(m[1], Number(status));
    }
    return out;
}

const scenarios = [];
function scenario(label, fn) { scenarios.push({ label, fn }); }

// ── ១. អត្តសញ្ញាណនៃការបរាជ័យត្រូវរស់រាន ─────────────────────────────────
scenario('អត្តសញ្ញាណ lookupCode រស់រានដល់អត្ថបទដែលអ្នកប្រើឃើញ', async () => {
    // ⛔ 429 **នៅតែព្យាយាមឡើងវិញ** — ជាការសម្រេចដោយចេតនាពីជុំមុន
    //    («retry ដោយមិនបង្ខំអ្នកប្រើស្កេនឡើងវិញ»)។ អ្វីដែលជុំនេះកែគឺ
    //    **អត្តសញ្ញាណត្រូវរស់រាន** ➜ ក្រោយអស់ការព្យាយាម សារត្រូវប្រាប់ការពិត។
    const limited = await run([{ status: 429, code: 'ZTO_RATE_LIMITED' }]);
    ok('⛔ HTTP 429 អស់ការព្យាយាម ➜ សារប្រាប់ថា ZTO កំណត់ល្បឿន (មិនមែនសារទូទៅ)',
        limited.text.indexOf('🚦') !== -1, limited.text);
    ok('⛔ ទិសផ្ទុយ ៖ 429 នៅតែព្យាយាមឡើងវិញដដែល (សេចក្តីសម្រេចជុំមុន)',
        limited.calls.length === 2, limited.calls.length);

    const stalled = await run([{ status: 504, code: 'ZTO_TIMEOUT' }]);
    ok('⛔ ZTO_TIMEOUT ➜ សារប្រាប់ថាឆ្លើយយឺត',
        stalled.text.indexOf('⏱️') !== -1 && stalled.text.indexOf('ZTO') !== -1, stalled.text);
    ok('⛔ ZTO_TIMEOUT ➜ មិនព្យាយាមឡើងវិញ (proxy ចំណាយថវិកាពេលរបស់វារួចហើយ)',
        stalled.calls.length === 1, stalled.calls.length);
    const genericGateway = await run([{ status: 504 }, { status: 200 }]);
    ok('⛔ ទិសផ្ទុយ ៖ 504 ទទេ (គ្មានកូដរបស់ proxy) នៅតែព្យាយាមឡើងវិញ',
        genericGateway.calls.length === 2 && genericGateway.text.indexOf('✅') !== -1,
        { calls: genericGateway.calls.length, text: genericGateway.text });

    const down = await run([{ status: 502, code: 'ZTO_UPSTREAM_UNAVAILABLE' }]);
    ok('⛔ HTTP 502 ➜ សារប្រាប់ថា ZTO ឆ្លើយមិនចេញ (មិនមែនសារទូទៅ)',
        down.text.indexOf('ZTO') !== -1 && down.text.indexOf('មិនអាចភ្ជាប់') === -1, down.text);
});

// ── ២. ⛔ ទិសផ្ទុយ ៖ អ្វីដែលត្រូវនៅតែព្យាយាមឡើងវិញ ───────────────────────
scenario('⛔ ទិសផ្ទុយ ៖ បណ្តាញញ័រពិត ត្រូវនៅតែព្យាយាមឡើងវិញ', async () => {
    const flaky = await run([{ reject: 'network' }, { status: 200 }]);
    ok('⛔ បណ្តាញញ័រ ➜ ព្យាយាមឡើងវិញ ហើយជោគជ័យជុំទី ២',
        flaky.calls.length === 2 && flaky.text.indexOf('✅') !== -1, { calls: flaky.calls.length, text: flaky.text });

    const upstream = await run([{ status: 502, code: 'ZTO_UPSTREAM_UNAVAILABLE' }, { status: 200 }]);
    ok('⛔ 502 បណ្តោះអាសន្ន ➜ ព្យាយាមឡើងវិញ ហើយជោគជ័យជុំទី ២',
        upstream.calls.length === 2 && upstream.text.indexOf('✅') !== -1, { calls: upstream.calls.length, text: upstream.text });
});

// ── ៣. ការបរាជ័យដែលចំណាយពេលរួចហើយ មិនត្រូវចំណាយម្តងទៀត ────────────────
scenario('ការផុតកំណត់ខាង client មិនត្រូវព្យាយាមឡើងវិញ', async () => {
    const timedOut = await run([{ reject: 'timeout' }, { status: 200 }]);
    ok('⛔ «Auto lookup timed out» ➜ **មិនព្យាយាមឡើងវិញ** (បើអត់ ➜ រង់ចាំទ្វេដង)',
        timedOut.calls.length === 1, timedOut.calls.length);
    ok('⛔ សារត្រូវប្រាប់ថាឆ្លើយតបយឺតពេក',
        timedOut.text.indexOf('⏱️') !== -1, timedOut.text);
});

// ── ៤. សាលក្រមស្ថាពរនៅតែមិនព្យាយាមឡើងវិញ (ការការពារដែលមានស្រាប់) ──────
scenario('Config/auth ខុស ➜ សាលក្រមស្ថាពរ', async () => {
    const badConfig = await run([{ status: 503, code: 'ZTO_CONFIG_INVALID', reason: 'body:invalid-json' }]);
    ok('⛔ ZTO_CONFIG_INVALID ➜ មិនព្យាយាមឡើងវិញ', badConfig.calls.length === 1, badConfig.calls.length);
    ok('⛔ ZTO_CONFIG_INVALID ➜ សារបង្ហាញមូលហេតុដែលច្រោះរួច',
        badConfig.text.indexOf('body:invalid-json') !== -1, badConfig.text);

    const expired = await run([{ status: 401, code: 'ZTO_AUTH_EXPIRED' }]);
    ok('⛔ ZTO_AUTH_EXPIRED ➜ ប្រាប់ថា ZTO បដិសេធ ហើយឲ្យរត់ sync tool លើ Windows',
        expired.text.indexOf('ZTO Cookie Sync') !== -1 && expired.text.indexOf('Windows') !== -1
        && /បដិសេធ/.test(expired.text) && !/ផុតកំណត់/.test(expired.text),
        expired.text);
    ok('⛔ ZTO_AUTH_EXPIRED ➜ មិនប្រាប់ឲ្យដាក់ Cookie ក្នុង Netlify ដោយដៃ',
        expired.text.indexOf('ចូល Argus យក Cookie ថ្មី ដាក់ក្នុង Netlify') === -1,
        expired.text);
    ok('⛔ ZTO_AUTH_EXPIRED ➜ មិនព្យាយាមឡើងវិញ', expired.calls.length === 1, expired.calls.length);
});

// ── ៥. Cooldown ត្រូវនិយាយការពិត ────────────────────────────────────────
scenario('Cooldown ត្រូវឆ្លើយតបនឹងប្រភេទនៃការបរាជ័យ', async () => {
    const transient = await run([{ reject: 'timeout' }]);
    const transientWait = transient.ctx.autoLookupFailureAt.size === 1
        ? vm.runInContext('lookupFailureCooldownMs(__lastKind)', Object.assign(transient.ctx, { __lastKind: 'transient' }))
        : -1;
    ok('ការបរាជ័យបណ្តោះអាសន្នកត់ត្រាក្នុង cooldown map', transient.ctx.autoLookupFailureAt.size === 1);
    ok('⛔ cooldown បណ្តោះអាសន្នខ្លីជាង cooldown សាលក្រមស្ថាពរ',
        transientWait > 0 && transientWait < transient.ctx.AUTO_LOOKUP_FAIL_COOLDOWN_MS,
        { transientWait, definitive: transient.ctx.AUTO_LOOKUP_FAIL_COOLDOWN_MS });

    const definitive = vm.runInContext('lookupFailureCooldownMs("definitive")', transient.ctx);
    ok('⛔ ទិសផ្ទុយ ៖ សាលក្រមស្ថាពររក្សា cooldown វែងដដែល',
        definitive === transient.ctx.AUTO_LOOKUP_FAIL_COOLDOWN_MS, definitive);

    // ⛔ ផ្លូវពិត ៖ cooldown ដែល `attemptAutoLookup()` **កត់ត្រា** ត្រូវតាមប្រភេទកូដដែល Function **ពិតជាផ្ញើ** (ដេរីវេពី
    //    `zto-order-detail.js` មិនមែនបញ្ជីរឹង) ៖ សាលក្រម auth/config ➜ cooldown វែង · 429/5xx ផ្សេង ➜ cooldown ខ្លី។
    //    ⛔ ការអះអាងលើ `lookupFailureCooldownMs("definitive")` តែឯងមិនឃើញថា **កូដណា** ទៅដល់ «definitive» ទេ ៖ វាស់បាន (2.45.4)
    //    mutation «ដក `ZTO_AUTH_NOT_CONFIGURED` ពី `lookupFailureIsDefinitive()`» រស់រានលើ checker lookup ទាំង ៧ ព្រោះកូដនោះមកជាមួយ
    //    **HTTP 503** (មិនមែន 401/403) ➜ មានតែការពិនិត្យកូដទេដែលធ្វើឲ្យវាស្ថាពរ ➜ ស្កេនម្តងទៀតរាល់ ៦ វិ. ទៅ Cookie ដែលមិនទាន់កំណត់។
    //    ⚠️ `ZTO_AUTH_EXPIRED` មកជាមួយ **401** ➜ ការដកវាចេញពីបញ្ជីកូដ ជា equivalent mutant (សារ `HTTP 401` ធ្វើឲ្យវាស្ថាពរដដែល)។
    const fnCodes = functionErrorCodes();
    const DEFINITIVE_CODE_RE = /^ZTO_(?!LIST_)[A-Z_]*(AUTH|CONFIG)[A-Z_]*$/;
    const definitiveCodes = [...fnCodes.keys()].filter((c) => DEFINITIVE_CODE_RE.test(c));
    const transientCodes = [...fnCodes.keys()].filter((c) => !DEFINITIVE_CODE_RE.test(c) && !/^ZTO_LIST_/.test(c) && fnCodes.get(c) >= 429);
    ok('កូដកំហុសរបស់ Function ស្រង់បាន (ជាន់អប្បបរមា ៖ auth/config ≥ ៣ · បណ្តោះអាសន្ន ≥ ៣ · មាន 503 ≥ ១)',
        definitiveCodes.length >= 3 && transientCodes.length >= 3 && definitiveCodes.some((c) => fnCodes.get(c) === 503),
        { definitive: definitiveCodes.map((c) => c + ':' + fnCodes.get(c)), transient: transientCodes.map((c) => c + ':' + fnCodes.get(c)) });
    for (const code of definitiveCodes) {
        const r = await run([{ status: fnCodes.get(code), code }]);
        const entry = r.ctx.autoLookupFailureAt.get('BC1');
        const ms = entry && typeof entry === 'object' ? entry.ms : -1;
        ok('⛔ ' + code + ' (HTTP ' + fnCodes.get(code) + ') ➜ cooldown សាលក្រមស្ថាពរ', ms === r.ctx.AUTO_LOOKUP_FAIL_COOLDOWN_MS, ms);
    }
    for (const code of transientCodes) {
        const r = await run([{ status: fnCodes.get(code), code }]);
        const entry = r.ctx.autoLookupFailureAt.get('BC1');
        const ms = entry && typeof entry === 'object' ? entry.ms : -1;
        ok('⛔ ទិសផ្ទុយ ៖ ' + code + ' (HTTP ' + fnCodes.get(code) + ') ➜ cooldown បណ្តោះអាសន្ន (ខ្លីជាងសាលក្រមស្ថាពរ)',
            ms > 0 && ms < r.ctx.AUTO_LOOKUP_FAIL_COOLDOWN_MS, ms);
    }

    // អ្នកប្រើត្រូវដឹងថាត្រូវរង់ចាំប៉ុន្មាន — សារត្រូវផ្គូផ្គងនឹង cooldown ពិត
    const again = await run([{ reject: 'timeout' }]);
    again.ctx.autoLookupFailureAt.set('BC1', Date.now());
    const blocked = await new Promise((resolve) => {
        vm.runInContext('attemptAutoLookup("BC1")', again.ctx).then(
            () => resolve(again.ctx.__status.textContent), () => resolve(again.ctx.__status.textContent));
    });
    ok('⛔ ការស្កេនម្តងទៀតក្នុង cooldown ➜ សារប្រាប់វិនាទីដែលនៅសល់',
        /\d+\s*វិ\./.test(blocked), blocked);
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
