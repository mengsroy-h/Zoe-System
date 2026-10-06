// ⛔ ថ្នាក់កំហុស ៖ **ការទាញបញ្ជីកញ្ចប់ពី ZTO Argus ចូល ZoeW។**
//
// រហូតមកដល់ពេលនេះ ZoeW ស្គាល់ ZTO តាមផ្លូវ **តែមួយ** ៖ `/scan/get/order/detail`
// ដែលសួរ **barcode ម្តងមួយ**។ ការទាញ **បញ្ជី** (`/scan/page/scan`) ជាផ្លូវ
// ថ្មីទាំងស្រុង ៖ សំបកចម្លើយផ្សេង (array ក្នុង `data.result`) · វាល barcode
// ផ្សេង (`scanBillCode`) · ការបែងចែកទំព័រ · និងទិន្នន័យដែល **មិនមែនរបស់
// អតិថិជន** លាយចូល។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ ៖
//
// ១. ⛔ **ដំណាក់ ១ មិនសរសេរអ្វីសោះ** — ផ្លូវមើលជាមុនមិនត្រូវប៉ះ Firebase ·
//    មិនប៉ះ registry · មិនប៉ះលុយ។ បើថ្ងៃណាការសរសេរលេចចូល វាត្រូវឆ្លងកាត់
//    ទ្វារដដែលនឹងការស្កេន មិនមែនផ្លូវទី ២។
//
// ២. ⛔ **ការកំណត់បញ្ជីខុស មិនត្រូវសម្លាប់ការស្កេន** — ច្បាប់ដដែលនឹង
//    `ZTO_FIELD_SIGNED` ៖ បិទតែមុខងារបញ្ជី ហើយប្រាប់មូលហេតុក្នុង `?diag=1`។
//
// ៣. ⛔ **ការបញ្ចាំងនៅ server** — ជួរដេកដែលត្រឡប់មកត្រូវមានតែ
//    `barcode · phone · cod · dod · at`។ ឈ្មោះ · អាសយដ្ឋាន · `fcAmount`
//    (**ថ្លៃដឹក មិនមែន DOD**) មិនត្រូវឆ្លងកាត់ទេ។
//
// ៤. ⛔ **កូនសោ cache របស់បញ្ជីត្រូវផ្សេងពី barcode** — បើដូចគ្នា ការស្កេន
//    barcode នឹងទទួលចម្លើយបញ្ជី (ឬបញ្ច្រាស) ➜ លេខទូរស័ព្ទខុសអតិថិជន។
//
// ៥. ⛔ **ផ្លូវបណ្តាញត្រូវប្រើរួម** — abort · សាលក្រម auth · ជណ្តើរ retry
//    ត្រូវឆ្លងកាត់ `requestOnce()` ដដែល។ ការចម្លងវាបង្កើតផ្លូវទី ២ ដែល
//    គ្មានអ្នកយាម (`code-duplication-test` ចាប់ការចម្លងអក្សរ តែមិនចាប់
//    ផ្លូវ `fetch` ទី ២ ដែលសរសេរខុសបន្តិច)។
//
// ៦. ⛔ **ការចាត់ថ្នាក់ខាង client ត្រូវអភិរក្ស** — គ្រប់ជួរដេកត្រូវធ្លាក់
//    ចូលក្រុមតែ ១ ក្នុងចំណោម ៤ (ថ្មី · មានរួច · ស្ទួន · រំលង) ហើយផលបូក
//    ត្រូវស្មើចំនួនជួរដេកដើម។ ការបាត់ជួរដេកស្ងាត់ៗ = កញ្ចប់ដែលអ្នកប្រើ
//    មិនដែលដឹងថាមាន។
//
// ៧. ⛔ **barcode ស្ទួនក្នុងទំព័រតែមួយ ជាការវាស់ពិត** (2026-09-11) ៖
//    `77130533910996` លេច ២ ដងក្នុងទំព័រ ១០០ ជួរ (ZTO ស្កេន «មកដល់» ២ ថ្ងៃ)
//    ➜ បើបញ្ចូលទាំង ២ ➜ **លុយបូកស្ទួន $6.47**។ ការ de-dupe ត្រូវធ្វើ
//    **ក្នុងបញ្ជីជាមុន** មិនមែនពឹងលើ registry ខាង server។
//
// ៨. ⛔ **លេខសាខាមកពី *សំណើ* មិនមែនពី env** (សំណើម្ចាស់គម្រោង 2026-09-14) ៖
//    `ZTO_LIST_SITE_CODE` ក្នុង Netlify ចាក់សោ deploy ទាំងមូលចូលសាខាតែមួយ
//    ខណៈ ZoeW ត្រូវបម្រើ **សាខាច្រើន**។ ថ្នាក់កំហុសថ្មីដែលកើតពីវា ៖
//    (ក) **cache ជាន់សាខា** — instance តែមួយបម្រើសាខា ២ ➜ កូនសោគ្មានសាខា
//        ➜ សាខា ក ទទួលបញ្ជីរបស់សាខា ខ ➜ **COD របស់អតិថិជនអ្នកដទៃ** ចូល
//        ZoeW តាមប៊ូតុង «➕ បញ្ចូលកញ្ចប់ថ្មី»។
//    (ខ) **env ដែលសល់** — `ZTO_LIST_SITE_CODE` ចាស់ក្នុង Netlify មិនត្រូវ
//        បន្តចាក់សោសាខាដោយស្ងាត់ (បើវានៅដើរ អ្នកប្រើជឿថាបានដកវាចេញរួច)។
//    (គ) **ភាពស្ងាត់ខាង client** — គ្មានលេខសាខា ➜ ត្រូវ **បោះ** រួចបើក
//        ប្រអប់បំពេញ ⛔ មិនមែនឆ្លើយ «០ ជួរដេក» (បញ្ជីទទេកុហក)។
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = process.env.ZTOLIST_APP_DIR
    ? path.resolve(process.env.ZTOLIST_APP_DIR)
    : path.resolve(__dirname, '..');
const FUNCTION_JS = path.join(ROOT, 'ZoeW', 'netlify', 'functions', 'zto-order-detail.js');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');
const INDEX_HTML = path.join(ROOT, 'ZoeW', 'index.html');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

function readOr(file) {
    try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; }
}

const FUNCTION_SRC = readOr(FUNCTION_JS);
const APP_SRC = readOr(APP_JS);
const HTML_SRC = readOr(INDEX_HTML);

// ─── ជាន់អប្បបរមា ៖ ថតទទេ ➜ គ្មានការអះអាងណាបៃតងបានឡើយ ───────────────────
ok('ជាន់អប្បបរមា ៖ អាន Function បាន', FUNCTION_SRC.length > 8000, FUNCTION_SRC.length);
ok('ជាន់អប្បបរមា ៖ អាន app.js បាន', APP_SRC.length > 200000, APP_SRC.length);
ok('ជាន់អប្បបរមា ៖ អាន index.html បាន', HTML_SRC.length > 20000, HTML_SRC.length);

function sliceBalanced(src, from) {
    let depth = 0;
    for (let i = from; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) return src.slice(from, i + 1); }
    }
    return null;
}
function extractFn(src, name) {
    const re = new RegExp('\\n(\\s*)(async\\s+)?function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    const head = src.indexOf('function ' + name, m.index);
    const brace = src.indexOf('{', src.indexOf('(', head));
    const body = sliceBalanced(src, brace);
    if (!body) return null;
    return (m[2] ? 'async ' : '') + src.slice(head, brace) + body;
}
function extractConst(src, name) {
    const re = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);');
    const m = re.exec(src);
    return m ? 'const ' + name + ' = ' + m[1] + ';' : null;
}

// ⛔ ឈ្មោះដែលរកមិនឃើញត្រូវក្លាយជា **stub** មិនមែនការឈប់ ៖ `process.exit`
// ឬ sandbox ដែលបាក់ បិទបាំងការអះអាងទាំងអស់ខាងក្រោមវា ➜ tree មុនកែរាយ
// «FAIL ៤» ជំនួស **ការធ្លាក់ដែលមានឈ្មោះ**។
const FN_STUB_BODY = {
    ztoScanStampMillis: 'return 0;',
    appZoneWallClockToMillis: 'return 0;'
};
function fnOrStub(src, name) {
    const found = extractFn(src, name);
    if (found) return found;
    const body = Object.prototype.hasOwnProperty.call(FN_STUB_BODY, name)
        ? FN_STUB_BODY[name] : 'return undefined;';
    return 'function ' + name + '() { ' + body + ' }';
}
const CONST_STUB_VALUE = { ABANDON_AGE_MS: '7 * 24 * 60 * 60 * 1000' };
function constOrStub(src, name) {
    return extractConst(src, name)
        || ('const ' + name + ' = ' + (CONST_STUB_VALUE[name] || 'undefined') + ';');
}

let proxy = null;
let loadError = '';
try { proxy = require(FUNCTION_JS); } catch (e) { loadError = String(e && e.message); }
ok('ជាន់អប្បបរមា ៖ Function ផ្ទុកបាន', !!(proxy && typeof proxy.handler === 'function'), loadError);

const KEY = 'list-sync-key-0123456789abcdef';
const ENV_NAMES = [
    'ZTO_PROXY_KEY', 'ZTO_COOKIE', 'ZTO_TOKEN', 'ZTO_TOKEN_HEADER', 'ZTO_AUTHORIZATION',
    'ZTO_API_URL', 'ZTO_API_METHOD', 'ZTO_REQUEST_BODY_JSON', 'ZTO_REQUEST_QUERY_PARAM',
    'ZTO_REQUEST_HEADERS_JSON', 'ZTO_FIELD_PHONE', 'ZTO_FIELD_COD', 'ZTO_FIELD_DOD',
    'ZTO_FIELD_BARCODE', 'ZTO_FIELD_SIGNED', 'ZTO_SIGNED_VALUES',
    'ZTO_SEND_BROWSER_HEADERS', 'ZTO_UPSTREAM_TIMEOUT_MS', 'ZTO_REQUEST_BUDGET_MS',
    'ZTO_UPSTREAM_RETRIES', 'ZTO_CACHE_TTL_MS', 'ZTO_NOT_FOUND_CACHE_TTL_MS',
    'ZTO_USER_AGENT', 'ZTO_ACCEPT_LANGUAGE', 'ZTO_BROWSER_ORIGIN',
    'ZTO_LIST_SITE_CODE', 'ZTO_LIST_URL', 'ZTO_LIST_SCAN_TYPE',
    'ZTO_LIST_PAGE_SIZE', 'ZTO_LIST_MAX_PAGES', 'ZTO_LIST_SCAN_DESC',
    'ZTO_LIST_SIGNED_SCAN_TYPE', 'ZTO_LIST_SIGNED_SCAN_DESC',
    'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'
];
const SAVED_ENV = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
const SAVED_FETCH = global.fetch;

const { TEST_CERT_PEM, TEST_KID, TEST_PROJECT, CERTS_HOST,
    tokenFor, tokenForSite, withCerts } = require('./idtoken-fixture.js');

function resetEnv(extra) {
    ENV_NAMES.forEach((name) => { delete process.env[name]; });
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_AUTHORIZATION = 'Bearer test-token';
    process.env.FIREBASE_PROJECT_IDS = TEST_PROJECT;
    Object.keys(extra || {}).forEach((name) => {
        if (extra[name] === undefined) delete process.env[name];
        else process.env[name] = extra[name];
    });
    if (proxy && typeof proxy.resetCachesForTests === 'function') proxy.resetCachesForTests();
}

// ⛔ handler ដែល **បោះ** ត្រូវក្លាយជាការធ្លាក់ដែល **មានឈ្មោះ** មិនមែន
// ជាការ crash ដែលបិទបាំងការអះអាងខាងក្រោមទាំងអស់ (វាស់រួចលើ mutation ៖
// `config.list.url` ជា `null` ➜ `.href` បោះ ➜ checker ស្លាប់ត្រង់នោះ)។
async function call(query, extraHeaders) {
    // ⛔ សំណើបញ្ជីតម្រូវឲ្យមាន ID token ➜ ចេតនា «សុំសាខា X» ប្រែជា token
    // របស់អ្នកប្រើសាខានោះ។ header ដែលបញ្ជូនផ្ទាល់ ឈ្នះជានិច្ច។
    const auto = (query && query.list === '1'
        && !(extraHeaders && 'x-zoe-id-token' in extraHeaders))
        ? { 'x-zoe-id-token': tokenForSite(query.site) }
        : {};
    try {
        return await proxy.handler({
            httpMethod: 'GET',
            headers: Object.assign({ 'x-zoe-proxy-key': KEY }, auto, extraHeaders || {}),
            queryStringParameters: query
        });
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: 'handler threw', code: 'HANDLER_THREW', detail: String(e && e.message) }) };
    }
}

const seenRequests = [];


function responder(payload, status) {
    return async (href, init) => {
        // ⛔ ការផ្ទៀងផ្ទាត់ ID token ទាញវិញ្ញាបនបត្ររបស់ Google ➜ responder
        // ត្រូវឆ្លើយវាដែរ បើអត់ ការផ្ទៀងផ្ទាត់ធ្លាក់ដោយ **ហេតុផលខុស**។
        // ⛔ ការទាញវិញ្ញាបនបត្រ **មិនចូល `seenRequests`** ៖ រាល់ការអះអាង
        // ដែលរាប់សំណើ មានន័យថា «ការហៅ **ZTO**» ➜ ការបញ្ចូលវានឹងធ្វើឲ្យ
        // ការអះអាងទាំងនោះវាស់អ្វីផ្សេង។
        if (String(href).indexOf(CERTS_HOST) !== -1) {
            return { ok: true, status: 200, headers: { get: () => 'application/json' },
                json: async () => ({ [TEST_KID]: TEST_CERT_PEM }) };
        }
        seenRequests.push({ href: href, init: init });
        return {
            ok: (status || 200) < 400,
            status: status || 200,
            headers: { get: () => 'application/json' },
            json: async () => payload
        };
    };
}

// ─── គំរូជួរដេកពិត (វាស់លើទិន្នន័យផលិតកម្ម 2026-09-11) ────────────────────
function listRow(extra) {
    return Object.assign({
        scanBillCode: '77130533910996',
        consigneeMobile: '855963897345',
        consigneeName: 'ឈ្មោះអតិថិជន',
        consigneeAddress: '磅湛直营店KC-01',
        customerCodeDesc: 'taobao',
        scanTypeDesc: 'អីវ៉ាន់មកដល់',
        agentAmount: 6.47,
        fcAmount: 2.5,
        scanTime: '2026-09-10 09:10:16',
        barScannerId: 2198
    }, extra || {});
}
function listPayload(rows, meta) {
    return {
        success: true,
        error: null,
        data: Object.assign({ pageNum: 1, pages: 1, total: rows.length, result: rows }, meta || {})
    };
}

// ⛔ **env ទទេជាការកំណត់ត្រឹមត្រូវឥឡូវនេះ** ៖ អ្វីដែលបើកមុខងារបញ្ជីគឺ
// លេខសាខាក្នុង **សំណើ** — មិនមែន env ណាមួយ។
const GOOD_LIST_ENV = {};
const LIST_SITE = '100200';
const LIST_SITE_2 = '990211';
const RANGE = { from: '2026-09-08', to: '2026-09-11' };

// ⛔ `site: undefined` ក្នុង `extra` ត្រូវ **ដក** parameter នោះចេញពិត
// (ជំនួសការផ្ញើអក្សរ `"undefined"` ➜ វានឹងឆ្លង `LIST_SITE_CODE_RE` ➜
// សេណារីយ៉ូ «គ្មានលេខសាខា» មិនដែលត្រូវវាស់សោះ)។
function listQuery(extra) {
    const out = Object.assign({ list: '1', site: LIST_SITE }, RANGE, extra || {});
    Object.keys(out).forEach((name) => { if (out[name] === undefined) delete out[name]; });
    return out;
}

async function listCall(payload, env, query, status) {
    resetEnv(env);
    seenRequests.length = 0;
    global.fetch = responder(payload, status);
    const res = await call(listQuery(query));
    let body = null;
    try { body = JSON.parse(res.body); } catch (_) { body = null; }
    return { status: res.statusCode, body: body, requests: seenRequests.slice() };
}

const DETAIL_ORDER = {
    success: true,
    data: { billCode: 'BAR0001', consigneePhone: '011222333', agentAmount: 4.5, arrivalServiceCharge: 1.25 }
};

async function detailCall(env, barcode, payload) {
    resetEnv(env);
    global.fetch = responder(payload || DETAIL_ORDER);
    const res = await call({ barcode: barcode || 'BAR0001' });
    let body = null;
    try { body = JSON.parse(res.body); } catch (_) { body = null; }
    return { status: res.statusCode, body: body };
}

async function diagCall(env, query) {
    resetEnv(env);
    global.fetch = responder(DETAIL_ORDER);
    const res = await call(Object.assign({ diag: '1' }, query || {}));
    let body = null;
    try { body = JSON.parse(res.body); } catch (_) { body = null; }
    return { status: res.statusCode, body: body, raw: res.body };
}

// ⛔ ការអានវាលជ្រៅដោយផ្ទាល់បោះ `TypeError` លើ tree មុនកែ ហើយ **បិទបាំង
// ការអះអាងខាងក្រោមទាំងអស់** ➜ `0 ok, 1 FAIL` ជំនួសការធ្លាក់ដែលមានឈ្មោះ។
function listOf(body) { return (body && body.list) || {}; }
function rowsOf(body) { return (body && Array.isArray(body.rows)) ? body.rows : []; }
function codeOf(body) { return (body && body.code) || null; }
function bodyOf(res) {
    try { return JSON.parse(res.body); } catch (_) { return {}; }
}

function firstBody(requests) {
    if (!requests.length) return null;
    const init = requests[0].init || {};
    if (typeof init.body !== 'string') return null;
    try { return JSON.parse(init.body); } catch (_) { return null; }
}

(async () => {
    if (!proxy || typeof proxy.handler !== 'function' || !APP_SRC || !HTML_SRC) {
        console.log('\nសរុប ៖ ' + pass + ' ok, ' + fail + ' FAIL');
        process.exit(fail ? 1 : 0);
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ១. មុខងារបញ្ជី ៖ ដេកលក់ដោយលំនាំដើម ==');
    // ═════════════════════════════════════════════════════════════════════
    const dormant = await listCall(listPayload([listRow()]), {}, { site: undefined });
    ok('គ្មានលេខសាខាក្នុងសំណើ ➜ HTTP 200 (មិនមែន 500)',
        dormant.status === 200, dormant.status);
    ok('⛔ គ្មានលេខសាខា ➜ `enabled:false`',
        !!dormant.body && dormant.body.enabled === false, dormant.body);
    // ⛔ លេខសាខាលែងមកពី `?site=` ➜ «គ្មានលេខសាខា» មានន័យថា **គណនីគ្មានសាខា**
    ok('⛔ គណនីគ្មានលេខសាខា ➜ មូលហេតុ `site:no-account`',
        !!dormant.body && dormant.body.reason === 'site:no-account', dormant.body && dormant.body.reason);
    ok('⛔ «បិទ» មិនមែនកំហុស ➜ គ្មានវាល `error` (ច្បាប់ `found:false`)',
        !!dormant.body && dormant.body.error === undefined, dormant.body && dormant.body.error);
    ok('⛔ គ្មានលេខសាខា ➜ **មិនហៅ upstream សោះ**',
        dormant.requests.length === 0, dormant.requests.length);

    const blankSite = await listCall(listPayload([listRow()]), {}, { site: '   ' });
    ok('⛔ លេខសាខាជាចន្លោះទទេក្នុងសំណើ ➜ `site:no-account` (សំណើមិនសម្រេចទៀតទេ)',
        !!blankSite.body && blankSite.body.enabled === false
        && blankSite.body.reason === 'site:no-account', blankSite.body);

    // ⛔ **env ដែលសល់ក្នុង Netlify មិនត្រូវចាក់សោសាខាដោយស្ងាត់** ៖ ម្ចាស់
    // គម្រោងលុប `ZTO_LIST_SITE_CODE` ចេញ — បើកូដនៅអានវា នោះឧបករណ៍គ្រប់
    // សាខាបន្តទាញបញ្ជីសាខាចាស់ ខណៈអ្នកប្រើជឿថាបានដកវាចេញរួច។
    const staleEnv = await listCall(listPayload([listRow()]),
        { ZTO_LIST_SITE_CODE: LIST_SITE }, { site: undefined });
    ok('⛔ `ZTO_LIST_SITE_CODE` ដែលសល់ **មិនជំនួស** លេខសាខារបស់គណនី',
        !!staleEnv.body && staleEnv.body.enabled === false
        && staleEnv.body.reason === 'site:no-account', staleEnv.body);
    ok('⛔ env ដែលសល់ ➜ មិនហៅ upstream សោះ',
        staleEnv.requests.length === 0, staleEnv.requests.length);
    ok('⛔ ឈ្មោះ env នោះលែងលេចក្នុងកូដ Function ទៀត',
        FUNCTION_SRC.indexOf('env.ZTO_LIST_SITE_CODE') === -1,
        FUNCTION_SRC.indexOf('env.ZTO_LIST_SITE_CODE'));

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ២. ⛔ ការកំណត់បញ្ជីខុស មិនត្រូវសម្លាប់ការស្កេន ==');
    // ═════════════════════════════════════════════════════════════════════
    // ⛔ មូលហេតុមាន **២ ប្រភព** ឥឡូវនេះ ៖ រូបរាងផ្លូវ (env · រស់ក្នុង
    // `?diag=1`) និង **លេខសាខា** (សំណើ · ⛔ មិនលេចក្នុង `?diag=1` ព្រោះ
    // server មិនកាន់វា)។ ការធ្វើតេស្តត្រូវបែងចែកវា ២ បើមិនដូច្នេះការអះអាង
    // «diag រាយមូលហេតុដដែល» នឹងបង្ខំឲ្យលេខសាខាហូរចូលចម្លើយវិនិច្ឆ័យ។
    const BROKEN = [
        ['លេខសាខាហាមក្នុងសំណើ ➜ បោះចោល', {}, { site: 'a b#c' }, 'site:no-account', false],
        ['លេខសាខាវែងក្នុងសំណើ ➜ បោះចោល', {}, { site: 'x'.repeat(33) }, 'site:no-account', false],
        ['URL មិនមែន https', { ZTO_LIST_URL: 'http://x.example.com/a' }, {}, 'url:invalid', true],
        ['URL ខូច', { ZTO_LIST_URL: 'not-a-url' }, {}, 'url:invalid', true],
        ['scanType មានចន្លោះ', { ZTO_LIST_SCAN_TYPE: 'a b' }, {}, 'scan-type:invalid', true]
    ];
    for (const entry of BROKEN) {
        const label = entry[0];
        const scan = await detailCall(entry[1]);
        ok('⛔ ' + label + ' ➜ ការស្កេននៅ 200', scan.status === 200 && !!scan.body && scan.body.found === true, scan.status);
        ok('⛔ ' + label + ' ➜ លេខទូរស័ព្ទនៅមកដល់ដដែល',
            scan.body && scan.body.phone === '011222333', scan.body && scan.body.phone);
        const listed = await listCall(listPayload([listRow()]), entry[1], entry[2]);
        ok('⛔ ' + label + ' ➜ បញ្ជីបិទ ដោយមូលហេតុ «' + entry[3] + '»',
            listed.status === 200 && !!listed.body && listed.body.enabled === false
            && listed.body.reason === entry[3], listed.body);
        ok('⛔ ' + label + ' ➜ មិនហៅ upstream សោះ',
            listed.requests.length === 0, listed.requests.length);
        const diag = await diagCall(entry[1]);
        ok('⛔ ' + label + ' ➜ `?diag=1` ' + (entry[4] ? 'រាយមូលហេតុដដែល' : 'នៅស្អាត (មូលហេតុជារបស់សំណើ)'),
            listOf(diag.body).reason === (entry[4] ? entry[3] : null), listOf(diag.body));
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ៣. សំណើដែលចេញទៅ ZTO ==');
    // ═════════════════════════════════════════════════════════════════════
    const good = await listCall(listPayload([listRow()], { pages: 2, total: 115 }), GOOD_LIST_ENV);
    ok('ការកំណត់ត្រឹមត្រូវ ➜ HTTP 200 · `success:true`',
        good.status === 200 && !!good.body && good.body.success === true, good.body);
    ok('ការហៅ upstream កើតឡើងម្តង', good.requests.length === 1, good.requests.length);
    ok('⛔ URL ជា `ZTO_LIST_URL` លំនាំដើម (`/scan/page/scan`)',
        good.requests.length === 1 && /\/scan\/page\/scan$/.test(String(good.requests[0].href)),
        good.requests.length ? String(good.requests[0].href) : null);
    ok('⛔ method ជា POST', good.requests.length === 1 && good.requests[0].init.method === 'POST',
        good.requests.length ? good.requests[0].init.method : null);

    const sent = firstBody(good.requests);
    const cond = (sent && sent.condition) || {};
    ok('body មាន `condition` · `pageNum` · `pageSize`',
        !!sent && !!sent.condition && sent.pageNum === 1 && sent.pageSize === 100, sent);
    ok('⛔ `scanTypeCode` ជា `03` (តម្រងស្នូល «អីវ៉ាន់មកដល់»)',
        cond.scanTypeCode === '03', cond.scanTypeCode);
    ok('⛔ `scanSiteCode` ជាលេខសាខាដែល **សំណើ** នាំមក',
        cond.scanSiteCode === LIST_SITE, cond.scanSiteCode);
    ok('⛔ `scanStartTime` = ថ្ងៃចាប់ផ្តើម ០០:០០:០០',
        cond.scanStartTime === '2026-09-08 00:00:00', cond.scanStartTime);
    ok('⛔ `scanEndTime` = ថ្ងៃបញ្ចប់ ២៣:៥៩:៥៩',
        cond.scanEndTime === '2026-09-11 23:59:59', cond.scanEndTime);
    ok('⛔ `mailNos` ជា array ទទេ (ទាញតាមជួរកាលបរិច្ឆេទ)',
        Array.isArray(cond.mailNos) && cond.mailNos.length === 0, cond.mailNos);

    const customType = await listCall(listPayload([listRow()]),
        { ZTO_LIST_SCAN_TYPE: '05', ZTO_LIST_PAGE_SIZE: '50' });
    const customSent = firstBody(customType.requests);
    ok('`ZTO_LIST_SCAN_TYPE` និង `ZTO_LIST_PAGE_SIZE` ចូលជាធរមាន',
        !!customSent && customSent.condition.scanTypeCode === '05' && customSent.pageSize === 50, customSent);

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ៤. ⛔ ការបញ្ចាំងនៅ server (PII + ទំហំ) ==');
    // ═════════════════════════════════════════════════════════════════════
    const rows = rowsOf(good.body);
    ok('ចម្លើយមាន `rows` ជា array', rows.length === 1, rows);
    const row = rows[0] || {};
    ok('⛔ ជួរដេកមានតែវាលដែលត្រូវការ ៖ `barcode·phone·cod·dod·at·ztoClosed·skip·from`',
        JSON.stringify(Object.keys(row).sort())
        === JSON.stringify(['at', 'barcode', 'cod', 'dod', 'from', 'phone', 'skip', 'ztoClosed']),
        Object.keys(row).sort());
    // ⛔ **សាលក្រម «បិទរួច» លើផ្លូវបញ្ជី** — ច្រកទ្វារ «ចាស់ + បិទរួច ➜
    // បញ្ចូលជា យករួច» ខាង client ពឹងលើវា។ សាលក្រមមាន **៣** ដដែលនឹងផ្លូវស្កេន ៖
    // ⛔ env មិនកំណត់ ➜ `null` (**មិនទាន់វាស់**) មិនមែន `false` — បើវាធ្លាក់ចុះ
    // ទៅ `false` នោះ client នឹងរាយ «ZTO មិនទាន់បិទ» លើកញ្ចប់ដែលយករួចទាំងអស់។
    ok('⛔ `ztoClosed` = `null` ពេល `ZTO_FIELD_SIGNED` មិនកំណត់ (មិនទាន់វាស់)',
        row.ztoClosed === null, row.ztoClosed);
    const signedEnv = Object.assign({}, GOOD_LIST_ENV,
        { ZTO_FIELD_SIGNED: 'billStatus', ZTO_SIGNED_VALUES: '5' });
    const listSignedClosed = await listCall(listPayload([listRow({ billStatus: 5 })]), signedEnv);
    ok('⛔ `ztoClosed` = `true` ពេលតម្លៃត្រូវនឹង `ZTO_SIGNED_VALUES`',
        (rowsOf(listSignedClosed.body)[0] || {}).ztoClosed === true,
        rowsOf(listSignedClosed.body)[0]);
    const listSignedOpen = await listCall(listPayload([listRow({ billStatus: 4 })]), signedEnv);
    ok('⛔ ទិសផ្ទុយ ៖ `ztoClosed` = `false` ពេលតម្លៃមិនត្រូវ',
        (rowsOf(listSignedOpen.body)[0] || {}).ztoClosed === false,
        rowsOf(listSignedOpen.body)[0]);
    const listSignedMissing = await listCall(listPayload([listRow()]), signedEnv);
    ok('⛔ វាលអវត្តមានក្នុងជួរដេកបញ្ជី ➜ `null` (client ធ្លាក់ចុះទៅ `/detail`)',
        (rowsOf(listSignedMissing.body)[0] || {}).ztoClosed === null,
        rowsOf(listSignedMissing.body)[0]);
    ok('⛔ តម្លៃឆៅរបស់វាលមិនឡើងដល់ browser (ត្រឹមសាលក្រម)',
        JSON.stringify(listSignedClosed.body).indexOf('billStatus') === -1, true);
    ok('⛔ ឈ្មោះអតិថិជនមិនឆ្លងកាត់',
        JSON.stringify(good.body).indexOf('ឈ្មោះអតិថិជន') === -1, true);
    ok('⛔ អាសយដ្ឋានមិនឆ្លងកាត់',
        JSON.stringify(good.body).indexOf('磅湛直营店') === -1, true);
    ok('barcode អានចេញពី `scanBillCode`', row.barcode === '77130533910996', row.barcode);
    ok('phone អានចេញពី `consigneeMobile`', row.phone === '855963897345', row.phone);
    ok('cod អានចេញពី `agentAmount`', row.cod === 6.47, row.cod);
    // ⛔ `fcAmount` ជា **DOD** លើផ្លូវបញ្ជី (ការបញ្ជាក់របស់ម្ចាស់គម្រោង
    // 2026-09-11 លើ payload ពិត) — គំរូនេះមាន `fcAmount: 2.5`។
    ok('⛔ `fcAmount` ➜ DOD លើផ្លូវបញ្ជី', row.dod === 2.5, row.dod);
    ok('⛔ `fcAmount` មិនឆ្លងកាត់ជាវាលដាច់ដោយឡែក', row.fcAmount === undefined, row.fcAmount);
    ok('`at` អានចេញពី `scanTime`', row.at === '2026-09-10 09:10:16', row.at);
    ok('ចម្លើយរាយ `pages` និង `total` ពិតរបស់ ZTO',
        !!good.body && good.body.pages === 2 && good.body.total === 115,
        good.body && { pages: good.body.pages, total: good.body.total });

    // ⛔ **ករណីពិត (payload ផលិតកម្ម 2026-09-11)** ៖ barcode តែមួយ
    // (`77130529557463`) លេច **៣ ដង** ក្នុងចម្លើយតែមួយ ៖ `03` អីវ៉ាន់មកដល់ ·
    // `04` ការចែកចាយអីវ៉ាន់ · `05` ចុះហត្ថលេខា។ បើគ្មានជាន់ការពារ
    // `scanTypeDesc` នោះកញ្ចប់ ១ ក្លាយជា **៣ ជួរដេក** ➜ លុយ ៣ ដង។
    // ⛔ ហើយជួរដេកនោះ (`ztda` · COD 0 · លេខទូរស័ព្ទ **ពិត**) មាន
    // `fcAmount: 2.5` ដែលជា **DOD** — ⛔ មិនមែន «ថ្លៃដឹកដែលត្រូវរំលង» ទេ
    // (កែការយល់ដឹងចាស់ តាមការបញ្ជាក់របស់ម្ចាស់គម្រោង)។
    const LIFECYCLE = [
        listRow({ scanBillCode: '77130529557463', consigneeMobile: '078913186',
            customerCodeDesc: 'ztda', agentAmount: 0.0, fcAmount: 2.5,
            scanTime: '2026-09-11 15:11:48', scanTypeDesc: 'អីវ៉ាន់មកដល់' }),
        listRow({ scanBillCode: '77130529557463', consigneeMobile: '078913186',
            customerCodeDesc: 'ztda', agentAmount: 0.0, fcAmount: 2.5,
            scanTime: '2026-09-11 15:13:48', scanTypeDesc: 'ការចែកចាយអីវ៉ាន់' }),
        listRow({ scanBillCode: '77130529557463', consigneeMobile: '078913186',
            customerCodeDesc: 'ztda', agentAmount: 0.0, fcAmount: 2.5,
            scanTime: '2026-09-11 15:15:22', scanTypeDesc: 'ចុះហត្ថលេខា' })
    ];
    // ⛔ **សំណើម្ចាស់គម្រោង (ZoeW 2.50.0) ៖ «ទាញតែកញ្ចប់មកដល់»** — ជួរដេកដែលប្រភេទស្កេន **ខុសដោយវាស់បាន** មិនចេញជាជួរដេកទៀតទេ
    // (មុន ៖ ចេញជាជួរ «រំលង») ➜ ប៉ុន្តែ **មិនបាត់ស្ងាត់** ៖ រាប់ក្នុង `otherScans` · ជួរ «ចុះហត្ថលេខា» ក្លាយជា **ភស្តុតាង «ZTO បិទរួច»**
    // (`signed`) ➜ ការអភិរក្សខាង server ៖ `rows + otherScans + signedScans` = ជួរដេក upstream។
    const lifeOut = await listCall(listPayload(LIFECYCLE, { pages: 1, total: 3 }), GOOD_LIST_ENV);
    const lifeRows = rowsOf(lifeOut.body);
    const lifeBody = lifeOut.body || {};
    ok('⛔ ទាញតែ «អីវ៉ាន់មកដល់» ៖ វដ្តជីវិត ៣ ជួរ ➜ ជួរដេកបញ្ចូលបាន ១', lifeRows.length === 1, lifeRows.length);
    ok('⛔ `អីវ៉ាន់មកដល់` ➜ ប្រើបាន', lifeRows[0] && lifeRows[0].skip === '' && lifeRows[0].barcode === '77130529557463', lifeRows[0]);
    ok('⛔ `ការចែកចាយអីវ៉ាន់` ➜ មិនមែនជួរដេក (កុំឲ្យក្លាយជាកញ្ចប់ទី ២) តែរាប់ក្នុង `otherScans`',
        lifeBody.otherScans === 1, lifeBody.otherScans);
    ok('⛔ `ចុះហត្ថលេខា` ➜ មិនមែនជួរដេក ➜ ភស្តុតាង «ZTO បិទរួច» (`signed`)',
        lifeBody.signedScans === 1 && Array.isArray(lifeBody.signed) && lifeBody.signed[0] === '77130529557463',
        { signedScans: lifeBody.signedScans, signed: lifeBody.signed });
    ok('⛔ ការអភិរក្សខាង server ៖ `rows + otherScans + signedScans` = ជួរដេក upstream',
        lifeRows.length + (lifeBody.otherScans || 0) + (lifeBody.signedScans || 0) === LIFECYCLE.length,
        [lifeRows.length, lifeBody.otherScans, lifeBody.signedScans]);
    ok('⛔ **`fcAmount` ជា DOD លើផ្លូវបញ្ជី** (កញ្ចប់ `ztda` ៖ COD 0 · DOD 2.5)',
        lifeRows[0] && lifeRows[0].cod === 0 && lifeRows[0].dod === 2.5, lifeRows[0]);
    ok('⛔ តម្លៃអត្ថបទប្រភេទស្កេនមិនឡើងដល់ browser',
        JSON.stringify(lifeOut.body).indexOf('ចុះហត្ថលេខា') === -1, true);

    // ⛔ **ការកែ 2.35.1 ៖ `fcAmount` ជា DOD លើ *ផ្លូវទាំង ២*។**
    //
    // ជុំ 2.33.0 បន្ថែម `fcAmount` ចូល **តែផ្លូវបញ្ជី** ដោយចេតនា ៖ ផ្លូវស្កេន
    // កំពុងដំណើរការជាមួយលុយពិត ➜ មិនប៉ះដោយគ្មានការវាស់។ ⛔ **ការវាស់នោះមកដល់
    // ហើយ** (payload របស់ `/detail` ពិត ពីម្ចាស់គម្រោង 2026-09-15) ៖
    //
    //     agentAmount:          0.00   ← COD (ត្រឹមត្រូវ)
    //     arrivalServiceCharge: 0.00   ← វាលទី ១ នៃ `DOD_PATHS` — **មានជានិច្ច**
    //     fcAmount:             2.50   ← លុយពិតដែលអតិថិជនបង់ពេលទទួល
    //     dodAmount · arrivalCharge · serviceCharge · dod ← **គ្មានក្នុង ZTO សោះ**
    //
    // `pickNumber()` ត្រឡប់ **លេខដំបូងដែលរកឃើញ រួមទាំង `0`** ➜ ការស្វែងរក
    // **ឈប់ត្រឹម `arrivalServiceCharge`** ➜ ផ្លូវស្កេនឆ្លើយ **DOD 0 រាល់កញ្ចប់**
    // ហើយវាលបន្ទាប់ ៤ ជា **កូដងាប់**។ លេខ $2.50 ដែលអ្នកប្រើឃើញក្នុងតារាង
    // មកពី **ការទាញបញ្ជី** មិនមែនពីការស្កេនទេ។
    //
    // ⛔ **មូលហេតុដែល checker ១៧១ បៃតងលើវា** ៖ fixture `DETAIL_ORDER` ប្រើ
    // `arrivalServiceCharge: 1.25` ដែល **មិនដែលកើតលើផលិតកម្ម** ➜ សេណារីយ៉ូ
    // មិនដែលដាក់ប្រព័ន្ធក្នុងស្ថានភាពពិតសោះ (សំណួរទី ៨ នៃវិន័យឧបករណ៍)។
    const dodDefaultsLine = /const DOD_PATHS = \[([^\]]*)\]/.exec(FUNCTION_SRC);
    const dodDefaults = (dodDefaultsLine ? dodDefaultsLine[1] : '')
        .split(',').map((part) => part.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    ok('ជាន់អប្បបរមា ៖ អាន `DOD_PATHS` ចេញពី Function ពិត',
        dodDefaults.length >= 5, dodDefaults);
    ok('⛔ `fcAmount` ស្ថិតក្នុង `DOD_PATHS` (ផ្លូវស្កេនអានលុយពិត)',
        dodDefaults.indexOf('fcAmount') !== -1, dodDefaults);
    ok('⛔ ហើយវាឈរ *មុន* `arrivalServiceCharge` (វាលនោះមានជានិច្ចដោយ `0` ➜ វាបាំង)',
        dodDefaults.indexOf('fcAmount') !== -1
            && dodDefaults.indexOf('fcAmount') < dodDefaults.indexOf('arrivalServiceCharge'),
        dodDefaults);
    // ⛔ **អន្ទាក់ `freightFee`** ៖ លើ payload ពិតវាស្មើ `fcAmount` បេះបិទ
    // (ទាំង ២ ជា 2.50) ➜ គំរូតែមួយ **បែងចែកពួកវាមិនបានទេ**។ ភាពខុសគ្នាលេចឡើង
    // លើកញ្ចប់ **បង់មុន** ៖ `freightFee` នៅមិនមែន 0 (ថ្លៃដឹកពិតជាមាន) ខណៈ
    // `fcAmount` ជា **0** (គ្មានអ្វីត្រូវប្រមូល) ➜ ការយក `freightFee` =
    // **គិតលុយអតិថិជនលើថ្លៃដឹកដែលអ្នកផ្ញើបង់រួច**។
    ok('⛔ អន្ទាក់ ៖ `freightFee` **មិន**ស្ថិតក្នុង `DOD_PATHS` (វាជាថ្លៃដឹក*សរុប*)',
        dodDefaults.indexOf('freightFee') === -1, dodDefaults);
    // ⛔ **បញ្ជីវាល DOD ត្រូវមានតែមួយ** ៖ បន្ទាប់ពីការកែនេះ `LIST_DOD_PATHS`
    // ក្លាយជាលែងចាំបាច់ ➜ ការទុកវា = បញ្ជី ២ ដែលត្រូវស៊ីគ្នាជានិច្ច (ច្បាប់ ១២ ៖
    // ជុំក្រោយកែមួយ ភ្លេចមួយ ➜ ២ ផ្ទុយគ្នា)។
    ok('⛔ បញ្ជីវាល DOD មាន **តែមួយ** (`LIST_DOD_PATHS` លែងចាំបាច់)',
        FUNCTION_SRC.indexOf('LIST_DOD_PATHS') === -1, true);

    // ─── អាកប្បកិរិយា ៖ payload `/detail` តាមរូបរាងផលិតកម្មពិត ───
    const ZTDA_DETAIL = { success: true, error: null, data: {
        billCode: 'BAR0009', consigneePhone: '011222333',
        agentAmount: 0.00, agentServiceCharge: 0.00, arrivalServiceCharge: 0.00,
        fcAmount: 2.50, freightFee: 2.50, totalFee: 0.00, billStatus: 5, payType: 'CC' } };
    const ztdaScan = await detailCall(GOOD_LIST_ENV, 'BAR0009', ZTDA_DETAIL);
    ok('⛔ **កញ្ចប់ `ztda` ពិត ៖ ការស្កេនអាន DOD 2.5**',
        !!ztdaScan.body && ztdaScan.body.dod === 2.5, ztdaScan.body && ztdaScan.body.dod);
    ok('⛔ ហើយ COD នៅ 0 (ត្រឹមត្រូវ — `agentAmount: 0`)',
        !!ztdaScan.body && ztdaScan.body.cod === 0, ztdaScan.body && ztdaScan.body.cod);

    // ⛔ **ផ្លូវទាំង ២ ត្រូវឲ្យលេខដូចគ្នាលើទិន្នន័យតែមួយ** — ការអះអាងដេរីវេ
    // ពីលេខពិតរបស់ផ្លូវស្កេន ⛔ មិនមែន literal ២ ខាងឯករាជ្យ (នោះជាការស៊ីគ្នា
    // ដោយចៃដន្យ)។
    const twinRow = listRow({ scanBillCode: 'BAR0009', consigneeMobile: '011222333',
        agentAmount: 0.00, fcAmount: 2.50, arrivalServiceCharge: 0.00, freightFee: 2.50 });
    const twinList = rowsOf((await listCall(listPayload([twinRow]), GOOD_LIST_ENV)).body)[0] || {};
    ok('⛔ ផ្លូវស្កេន និងផ្លូវបញ្ជីឲ្យលេខ **ដូចគ្នា** លើទិន្នន័យតែមួយ',
        !!ztdaScan.body && twinList.cod === ztdaScan.body.cod && twinList.dod === ztdaScan.body.dod,
        { list: { cod: twinList.cod, dod: twinList.dod },
          scan: ztdaScan.body && { cod: ztdaScan.body.cod, dod: ztdaScan.body.dod } });

    // ⛔ **ទិសផ្ទុយ ៖ កញ្ចប់បង់មុន (Shopee)** — ការបន្ថែម `fcAmount` មិនត្រូវ
    // ធ្វើឲ្យ DOD លេចពីអាកាសធាតុ ហើយនេះជាអ្នកចាប់អន្ទាក់ `freightFee` ៖
    // ថ្លៃដឹក 3.00 មានពិត តែអ្នកផ្ញើបង់រួច ➜ DOD ត្រូវជា **0**។
    const SHOPEE_DETAIL = { success: true, error: null, data: {
        billCode: 'BAR0010', consigneePhone: '011222333',
        agentAmount: 6.47, arrivalServiceCharge: 0.00,
        fcAmount: 0.0, freightFee: 3.00, billStatus: 4 } };
    const shopeeScan = await detailCall(GOOD_LIST_ENV, 'BAR0010', SHOPEE_DETAIL);
    ok('⛔ ទិសផ្ទុយ ៖ កញ្ចប់ Shopee (`fcAmount: 0.0`) ➜ DOD **0**',
        !!shopeeScan.body && shopeeScan.body.dod === 0, shopeeScan.body && shopeeScan.body.dod);
    ok('⛔ **អន្ទាក់ `freightFee`** ៖ ថ្លៃដឹក 3.00 បង់មុនរួច ➜ DOD ⛔ មិនមែន 3.00',
        !!shopeeScan.body && shopeeScan.body.dod !== 3.00, shopeeScan.body && shopeeScan.body.dod);
    ok('⛔ ហើយ COD នៅត្រឹមត្រូវ (`agentAmount: 6.47`)',
        !!shopeeScan.body && shopeeScan.body.cod === 6.47, shopeeScan.body && shopeeScan.body.cod);

    // ⛔ **ថយក្រោយបាន** ៖ ទិន្នន័យចាស់ដែលគ្មាន `fcAmount` សោះ ត្រូវធ្លាក់ចុះទៅ
    // `arrivalServiceCharge` ដដែល ➜ ការបន្ថែមមិនកាត់ផ្តាច់ផ្លូវចាស់ទេ។
    const legacyScan = await detailCall(GOOD_LIST_ENV);
    ok('⛔ ថយក្រោយបាន ៖ គ្មាន `fcAmount` សោះ ➜ ធ្លាក់ចុះទៅ `arrivalServiceCharge`',
        !!legacyScan.body && legacyScan.body.dod === 1.25, legacyScan.body && legacyScan.body.dod);

    // ⛔ `ZTO_FIELD_DOD` ត្រូវឈ្នះលើ **ផ្លូវស្កេនដែរ** មិនត្រឹមផ្លូវបញ្ជីទេ ➜
    // ថ្ងៃណា ZTO ប្តូរឈ្មោះវាល ការកែនៅតែជា env តែម្យ៉ាង គ្មានការ deploy កូដ។
    const envScan = await detailCall({ ZTO_FIELD_DOD: 'arrivalFee' }, 'BAR0011', { success: true, data: {
        billCode: 'BAR0011', consigneePhone: '011222333', agentAmount: 0,
        arrivalServiceCharge: 0.00, fcAmount: 2.50, arrivalFee: 1.75 } });
    ok('⛔ `ZTO_FIELD_DOD` ឈ្នះលើផ្លូវស្កេនដែរ (បើកវាលថ្មីដោយគ្មានការកែកូដ)',
        !!envScan.body && envScan.body.dod === 1.75, envScan.body && envScan.body.dod);

    // ⛔ **លុយអវិជ្ជមានត្រូវ clamp ត្រឹម 0 — នៅ `pickNumber()` ដែលជាចំណុច
    // ច្របាច់តែមួយ** (សំណើម្ចាស់គម្រោង 2026-09-15)។
    //
    // ការបន្ថែម `fcAmount` នាំមកនូវការប៉ះពាល់ថ្មីលើផ្លូវស្កេន ៖ មុននេះ
    // `arrivalServiceCharge: 0.00` បាំងអ្វីៗទាំងអស់ ➜ លេខអវិជ្ជមានមិនដែល
    // ឈានដល់អ្នកប្រើ។ ឥឡូវវាឈានដល់ ➜ `fcAmount: -2.5` នឹងក្លាយជា **DOD
    // អវិជ្ជមាន** លើអេក្រង់។ ⛔ ផ្លូវបញ្ជីមានការប៉ះពាល់នេះ **តាំងពី 2.33.0**។
    //
    // ⛔ **house style គឺ clamp មិនមែន «រំលងទៅវាលបន្ទាប់»** (ច្បាប់ដដែលនឹង
    // `revenue-rules-clamp-test` ៖ «លេខអវិជ្ជមានត្រូវ clamp មុនសរសេរ») —
    // ការរំលងនឹងធ្វើឲ្យវាលអវិជ្ជមាន **លើកតម្លៃរបស់វាលផ្សេង** ឡើងជំនួសដោយ
    // ស្ងាត់ ➜ លេខដែលអ្នកប្រើឃើញ មិនមែនមកពីវាលដែលឯកសារសន្យា។
    //
    // ⛔ `pickNumber()` ប្រើ **តែសម្រាប់ COD និង DOD** (កន្លែងហៅ ៤ ទាំងអស់)
    // ➜ ការ clamp នៅទីនោះមិនប៉ះវាលមិនមែនលុបណាមួយឡើយ។
    const NEG_DETAIL = { success: true, error: null, data: {
        billCode: 'BAR0012', consigneePhone: '011222333',
        agentAmount: -6.47, arrivalServiceCharge: 0.00, fcAmount: -2.50 } };
    const negScan = await detailCall(GOOD_LIST_ENV, 'BAR0012', NEG_DETAIL);
    ok('⛔ `fcAmount` អវិជ្ជមាន ➜ DOD clamp ត្រឹម **0** (ផ្លូវស្កេន)',
        !!negScan.body && negScan.body.dod === 0, negScan.body && negScan.body.dod);
    ok('⛔ `agentAmount` អវិជ្ជមាន ➜ COD clamp ត្រឹម **0**',
        !!negScan.body && negScan.body.cod === 0, negScan.body && negScan.body.cod);
    const negList = rowsOf((await listCall(listPayload([listRow({
        agentAmount: -6.47, fcAmount: -2.50 })]), GOOD_LIST_ENV)).body)[0] || {};
    ok('⛔ ច្បាប់ដដែលអនុវត្តលើ **ផ្លូវបញ្ជី** (ចំណុចច្របាច់តែមួយ)',
        negList.dod === 0 && negList.cod === 0, negList);
    // ⛔ **ទិសផ្ទុយ ១ ៖ ការ clamp មិនត្រូវក្លាយជាការ *រំលង*** — លេខអវិជ្ជមាន
    // ត្រូវក្លាយជា `0` ហើយ **ឈប់ត្រឹមនោះ** ⛔ មិនមែនធ្លាក់ចុះទៅវាលបន្ទាប់
    // រួចលើកលេខផ្សេងឡើងជំនួសទេ។
    const negThenPos = await detailCall(GOOD_LIST_ENV, 'BAR0013', { success: true, data: {
        billCode: 'BAR0013', consigneePhone: '011222333', agentAmount: 0,
        fcAmount: -2.50, dodAmount: 3.00 } });
    ok('⛔ ទិសផ្ទុយ ៖ អវិជ្ជមាន ➜ `0` **មិនមែន**លើក `dodAmount: 3.00` ឡើងជំនួស',
        !!negThenPos.body && negThenPos.body.dod === 0, negThenPos.body && negThenPos.body.dod);
    // ⛔ **ទិសផ្ទុយ ២ ៖ `0` ជាចំនួនទឹកប្រាក់ *ត្រឹមត្រូវ* មិនមែន «គ្មានតម្លៃ»**
    // — កញ្ចប់ Shopee មាន `fcAmount: 0.0` ពិតៗ ➜ បើនរណាម្នាក់ «កែ» ការ clamp
    // ដោយរំលង `0` ដែរ នោះ DOD នឹងលោតទៅ `dodAmount` ➜ **លុយពីអាកាសធាតុ**។
    const zeroWins = await detailCall(GOOD_LIST_ENV, 'BAR0014', { success: true, data: {
        billCode: 'BAR0014', consigneePhone: '011222333', agentAmount: 8.49,
        fcAmount: 0.0, dodAmount: 3.00 } });
    ok('⛔ ទិសផ្ទុយ ៖ `fcAmount: 0.0` ឈ្នះ (មិនរំលងទៅ `dodAmount: 3.00`)',
        !!zeroWins.body && zeroWins.body.dod === 0, zeroWins.body && zeroWins.body.dod);
    ok('⛔ ហើយតម្លៃវិជ្ជមានឆ្លងកាត់មិនប្រែ (`agentAmount: 8.49`)',
        !!zeroWins.body && zeroWins.body.cod === 8.49, zeroWins.body && zeroWins.body.cod);
    // ⛔ **ព្រំដែនត្រូវជា `0` ពិត មិនមែន «អវិជ្ជមានធំ»** — mutation ដែលប្តូរ
    // ច្រកទ្វារទៅ `value < -1` **រស់រាន** ការអះអាងខាងលើ ព្រោះពួកវាប្រើតែ
    // `-2.5` និង `-6.47`។ សេនតែមួយដែលអវិជ្ជមាន ក៏ជាលុយអវិជ្ជមានដែរ។
    const tinyNeg = await detailCall(GOOD_LIST_ENV, 'BAR0015', { success: true, data: {
        billCode: 'BAR0015', consigneePhone: '011222333',
        agentAmount: -0.01, arrivalServiceCharge: 0.00, fcAmount: -0.01 } });
    ok('⛔ ព្រំដែន ៖ អវិជ្ជមាន **១ សេន** ក៏ត្រូវ clamp ដែរ (COD)',
        !!tinyNeg.body && tinyNeg.body.cod === 0, tinyNeg.body && tinyNeg.body.cod);
    ok('⛔ ព្រំដែន ៖ អវិជ្ជមាន **១ សេន** ក៏ត្រូវ clamp ដែរ (DOD)',
        !!tinyNeg.body && tinyNeg.body.dod === 0, tinyNeg.body && tinyNeg.body.dod);

    // ⛔ **DOD នៅតែបើកបានដោយ env ដោយ*គ្មានការកែកូដ*** ៖ ជួរដេកបញ្ជីអាន
    // `config.dodPaths` **ដដែល**នឹងផ្លូវស្កេន ➜ ថ្ងៃណាដែលរកឃើញវាល DOD ពិត
    // ក្នុង Argus គ្រាន់តែដាក់ `ZTO_FIELD_DOD=<ឈ្មោះវាល>` ➜ វាដើរភ្លាម។
    // ⛔ បើការអានប្តូរទៅបញ្ជីរឹងដាច់ដោយឡែក នោះការបើក DOD នឹងទាមទារ deploy
    // កូដថ្មី — នោះជាការថយក្រោយ។
    const dodByEnv = await listCall(
        listPayload([listRow({ arrivalFee: 1.75 })]),
        { ZTO_FIELD_DOD: 'arrivalFee' });
    ok('⛔ `ZTO_FIELD_DOD` បើក DOD លើផ្លូវបញ្ជី **ដោយគ្មានការកែកូដ**',
        (rowsOf(dodByEnv.body)[0] || {}).dod === 1.75, rowsOf(dodByEnv.body)[0]);
    // ⛔ ទិសផ្ទុយ ៖ វាលដែល **មិនស្ថិតក្នុងបញ្ជី** មិនត្រូវក្លាយជា DOD
    // ដោយចៃដន្យ (គំរូនេះគ្មាន `fcAmount` សោះ)។
    const noDodRow = listRow({ arrivalFee: 1.75 });
    delete noDodRow.fcAmount;
    const noDod = await listCall(listPayload([noDodRow]), GOOD_LIST_ENV);
    ok('⛔ ទិសផ្ទុយ ៖ គ្មាន env ➜ វាលមិនស្គាល់ **មិន**ក្លាយជា DOD',
        (rowsOf(noDod.body)[0] || {}).dod === 0, rowsOf(noDod.body)[0]);
    ok('⛔ ទិសផ្ទុយ ៖ គ្មាន `fcAmount` សោះ ➜ DOD 0 (កញ្ចប់ Shopee)',
        (rowsOf((await listCall(listPayload([Object.assign(listRow(), { fcAmount: 0.0 })]), GOOD_LIST_ENV)).body)[0] || {}).dod === 0,
        true);


    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ៥. ជួរដេកដែលមិនមែនរបស់អតិថិជន ==');
    // ═════════════════════════════════════════════════════════════════════
    const mixed = await listCall(listPayload([
        listRow({ scanBillCode: '77130500000001', consigneeMobile: '0', agentAmount: 0, fcAmount: 28.5 }),
        listRow({ scanBillCode: '77130500000002', consigneeMobile: '', agentAmount: 0 }),
        listRow({ scanBillCode: '77130500000003', consigneeMobile: '081684403', agentAmount: 0 })
    ]), GOOD_LIST_ENV);
    const mixedRows = rowsOf(mixed.body);
    ok('ជួរដេកទាំង ៣ ត្រឡប់មកវិញ (មិនទម្លាក់ស្ងាត់)', mixedRows.length === 3, mixedRows.length);
    ok('⛔ `consigneeMobile` ជា `"0"` ➜ phone ទទេ (ជាសញ្ញា «មិនមែនអតិថិជន»)',
        mixedRows[0] && mixedRows[0].phone === '', mixedRows[0]);
    ok('⛔ ជួរដេកឃ្លាំង ៖ `fcAmount: 28.5` ➜ DOD 28.5 តែ phone ទទេ ➜ រំលងខាង client',
        mixedRows[0] && mixedRows[0].dod === 28.5, mixedRows[0]);
    ok('⛔ `consigneeMobile` ទទេ ➜ phone ទទេ',
        mixedRows[1] && mixedRows[1].phone === '', mixedRows[1]);
    ok('⛔ ទិសផ្ទុយ ៖ លេខពិតដែល COD = 0 **នៅតែឆ្លងកាត់** (`taobao` បង់មុន)',
        mixedRows[2] && mixedRows[2].phone === '081684403' && mixedRows[2].cod === 0, mixedRows[2]);

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ៥ក. លេខដាក់កន្លែង ៖ ផ្លូវស្កេន (`/detail`) និងផ្លូវបញ្ជីយល់ស្របគ្នា ==');
    // ═════════════════════════════════════════════════════════════════════
    // ⛔ E7 k10 ៖ ផ្លូវបញ្ជីទម្លាក់ `"0"` · `"000"` ជា «មិនមែនអតិថិជន» តែផ្លូវស្កេនបញ្ជូនវាទៅ App ➜ App បំពេញ `0`
    // ➜ រក្សាទុកស្វ័យប្រវត្តិ ➜ `addOrUpdateEntry()` បញ្ចូលកញ្ចប់អ្នកដទៃចូលជួរ `0` តែមួយ (phone + scanDate)។
    // ច្បាប់ ៖ Function តែមួយ ➜ ការវិនិច្ឆ័យលេខដាក់កន្លែងតែមួយ ➜ phone ដូចគ្នាលើផ្លូវទាំង ២ ជានិច្ច។
    const PLACEHOLDER_PHONES = ['0', '000', '', '0-0', ' 0 ', '00 000 000'];
    const AGREEMENT_PHONES = PLACEHOLDER_PHONES.concat(['+855-0', '081684403', '855963897345']);
    let agreementMeasured = 0;
    for (const raw of AGREEMENT_PHONES) {
        const listed = await listCall(listPayload([
            listRow({ scanBillCode: '77130500000009', consigneeMobile: raw, agentAmount: 0 })
        ]), GOOD_LIST_ENV);
        const listPhone = (rowsOf(listed.body)[0] || {}).phone;
        const scanned = await detailCall({}, '77130500000009', {
            success: true,
            data: { billCode: '77130500000009', consigneeMobile: raw, agentAmount: 0 }
        });
        const scanPhone = scanned.body && scanned.body.found === true ? scanned.body.phone : undefined;
        if (typeof listPhone === 'string' && typeof scanPhone === 'string') agreementMeasured++;
        ok('⛔ phone ' + JSON.stringify(raw) + ' (COD 0) ➜ `/detail` ឆ្លើយ phone ដូចផ្លូវបញ្ជី',
            typeof listPhone === 'string' && scanPhone === listPhone, { list: listPhone, detail: scanned.body });
    }
    ok('ជាន់អប្បបរមា ៖ ការយល់ស្របវាស់លើផ្លូវទាំង ២ ពិតគ្រប់តម្លៃ',
        agreementMeasured === AGREEMENT_PHONES.length, agreementMeasured);
    for (const raw of PLACEHOLDER_PHONES) {
        const withCod = await detailCall({}, '77130500000010', {
            success: true,
            data: { billCode: '77130500000010', consigneeMobile: raw, agentAmount: 3.25, fcAmount: 1.5 }
        });
        ok('⛔ `/detail` phone ' + JSON.stringify(raw) + ' + COD ➜ `found:true` · phone ទទេ · COD/DOD នៅ (App មិនរក្សាទុកស្វ័យប្រវត្តិ)',
            !!withCod.body && withCod.body.found === true && withCod.body.phone === ''
            && withCod.body.cod === 3.25 && withCod.body.dod === 1.5, withCod.body);
        const bare = await detailCall({}, '77130500000011', {
            success: true,
            data: { billCode: '77130500000011', consigneeMobile: raw }
        });
        ok('⛔ `/detail` phone ' + JSON.stringify(raw) + ' គ្មាន COD/DOD ➜ «រកមិនឃើញ» (`found:false` · គ្មាន `error`)',
            bare.status === 200 && !!bare.body && bare.body.found === false
            && bare.body.code === 'ZTO_NOT_FOUND' && bare.body.error === undefined, { s: bare.status, b: bare.body });
    }
    const realBare = await detailCall({}, '77130500000012', {
        success: true,
        data: { billCode: '77130500000012', consigneeMobile: '081684403' }
    });
    ok('⛔ ទិសផ្ទុយ ៖ `/detail` លេខពិតគ្មាន COD/DOD ➜ `found:true` ហើយ phone ឆ្លងកាត់ដដែល',
        !!realBare.body && realBare.body.found === true && realBare.body.phone === '081684403'
        && realBare.body.cod === 0 && realBare.body.dod === 0, realBare.body);

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ៦. ជួរកាលបរិច្ឆេទ និងទំព័រ ==');
    // ═════════════════════════════════════════════════════════════════════
    const badRange = [
        ['ថ្ងៃខូច', { from: '2026-9-8', to: '2026-09-11' }],
        ['ថ្ងៃបញ្ចប់មុនថ្ងៃចាប់ផ្តើម', { from: '2026-09-11', to: '2026-09-08' }],
        ['អត្ថបទមិនមែនកាលបរិច្ឆេទ', { from: 'x', to: 'y' }],
        ['ជួរវែងពេក', { from: '2020-01-01', to: '2026-09-11' }]
    ];
    for (const entry of badRange) {
        const res = await listCall(listPayload([listRow()]), GOOD_LIST_ENV, entry[1]);
        ok('⛔ ' + entry[0] + ' ➜ 400 `ZTO_LIST_RANGE_INVALID`',
            res.status === 400 && codeOf(res.body) === 'ZTO_LIST_RANGE_INVALID', { s: res.status, b: res.body });
        ok('⛔ ' + entry[0] + ' ➜ មិនហៅ upstream', res.requests.length === 0, res.requests.length);
    }

    const page2 = await listCall(listPayload([listRow()], { pageNum: 2, pages: 2, total: 115 }),
        GOOD_LIST_ENV, { page: '2' });
    const page2Sent = firstBody(page2.requests);
    ok('`page=2` ➜ `pageNum: 2` ចេញទៅ ZTO', !!page2Sent && page2Sent.pageNum === 2, page2Sent);
    ok('`page=2` ➜ ចម្លើយរាយ `page: 2`', !!page2.body && page2.body.page === 2, page2.body && page2.body.page);

    const overPage = await listCall(listPayload([listRow()]), GOOD_LIST_ENV, { page: '9' });
    ok('⛔ `page` លើសពិដាន ➜ 400 `ZTO_LIST_PAGE_INVALID`',
        overPage.status === 400 && codeOf(overPage.body) === 'ZTO_LIST_PAGE_INVALID', overPage.body);
    ok('⛔ `page` លើសពិដាន ➜ មិនហៅ upstream', overPage.requests.length === 0, overPage.requests.length);

    const zeroPage = await listCall(listPayload([listRow()]), GOOD_LIST_ENV, { page: '0' });
    ok('⛔ `page=0` ➜ 400', zeroPage.status === 400, zeroPage.status);

    const maxPages = await listCall(listPayload([listRow()]), GOOD_LIST_ENV, { page: '3' });
    ok('ទិសផ្ទុយ ៖ `page=3` (ពិដានលំនាំដើម) ➜ 200', maxPages.status === 200, maxPages.status);

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ៧. ⛔ កូនសោ cache ត្រូវផ្សេងពី barcode ==');
    // ═════════════════════════════════════════════════════════════════════
    resetEnv(GOOD_LIST_ENV);
    seenRequests.length = 0;
    global.fetch = responder(listPayload([listRow()]));
    const c1 = bodyOf(await call(listQuery()));
    ok('សំណើបញ្ជីដំបូង ➜ `cached:false`', c1.cached === false, c1.cached);
    const c2 = bodyOf(await call(listQuery()));
    ok('សំណើបញ្ជីទី ២ ➜ `cached:true` (cache ដើរ)', c2.cached === true, c2.cached);
    ok('cache hit ➜ គ្មានការហៅ upstream ទី ២', seenRequests.length === 1, seenRequests.length);

    global.fetch = responder(DETAIL_ORDER);
    const afterList = bodyOf(await call({ barcode: 'BAR0001' }));
    ok('⛔ ការស្កេន barcode ក្រោយបញ្ជី ➜ ទទួលចម្លើយ **detail** មិនមែនបញ្ជី',
        afterList.found === true && afterList.phone === '011222333' && afterList.rows === undefined,
        afterList);

    // ⛔ រាល់សេណារីយ៉ូត្រូវចាប់ផ្តើមពី stub ដើម ៖ stub `DETAIL_ORDER` ខាងលើ
    // នឹងធ្វើឲ្យសំណើបញ្ជីធ្លាក់ 502 ➜ ការធ្លាក់ក្លែងក្លាយ។
    global.fetch = responder(listPayload([listRow()], { pageNum: 2, pages: 2, total: 115 }));
    const c3 = bodyOf(await call(listQuery({ page: '2' })));
    ok('⛔ ទំព័រផ្សេង ➜ កូនសោផ្សេង (មិនប្រគល់ទំព័រ ១ វិញ)',
        c3.page === 2, c3.page);

    global.fetch = responder(listPayload([listRow()]));
    const c4 = bodyOf(await call(listQuery({ from: '2026-09-01', to: '2026-09-02' })));
    ok('⛔ ជួរកាលបរិច្ឆេទផ្សេង ➜ កូនសោផ្សេង (មិន cache hit)',
        c4.cached === false, c4.cached);

    // ⛔ **ថ្នាក់លុយថ្មីនៃ 2.34.4** ៖ instance តែមួយបម្រើ **សាខាច្រើន** ➜
    // កូនសោដែលគ្មានលេខសាខា ប្រគល់បញ្ជីរបស់សាខាមុនទៅសាខាបន្ទាប់ ➜ អ្នកប្រើ
    // ចុច «➕ បញ្ចូលកញ្ចប់ថ្មី» ➜ **COD របស់អតិថិជនអ្នកដទៃ** ចូល ZoeW។
    resetEnv(GOOD_LIST_ENV);
    seenRequests.length = 0;
    global.fetch = responder(listPayload([listRow({ scanBillCode: '77130599990001' })]));
    const siteA = bodyOf(await call(listQuery()));
    global.fetch = responder(listPayload([listRow({ scanBillCode: '77130599990002' })]));
    const siteB = bodyOf(await call(listQuery({ site: LIST_SITE_2 })));
    ok('⛔ សាខាផ្សេង ➜ កូនសោផ្សេង (មិន cache hit)', siteB.cached === false, siteB.cached);
    ok('⛔ សាខាផ្សេង ➜ ហៅ upstream ពិត (ការហៅ ២)', seenRequests.length === 2, seenRequests.length);
    ok('⛔ សាខានីមួយៗទទួល **ជួរដេករបស់ខ្លួន** (មិនលាយគ្នា)',
        (rowsOf(siteA)[0] || {}).barcode === '77130599990001'
        && (rowsOf(siteB)[0] || {}).barcode === '77130599990002',
        [(rowsOf(siteA)[0] || {}).barcode, (rowsOf(siteB)[0] || {}).barcode]);
    const siteBodies = seenRequests.map((r) => {
        try { return JSON.parse(String((r.init || {}).body || '')); } catch (_) { return null; }
    });
    ok('⛔ លេខសាខាដែលចេញទៅ ZTO ត្រូវតាមសំណើនីមួយៗ',
        siteBodies.length === 2 && siteBodies[0] && siteBodies[1]
        && siteBodies[0].condition.scanSiteCode === LIST_SITE
        && siteBodies[1].condition.scanSiteCode === LIST_SITE_2,
        siteBodies.map((b) => b && b.condition && b.condition.scanSiteCode));
    const siteAAgain = bodyOf(await call(listQuery()));
    ok('⛔ ទិសផ្ទុយ ៖ សាខាដដែល ➜ `cached:true` (cache មិនត្រូវស្លាប់)',
        siteAAgain.cached === true, siteAAgain.cached);
    ok('⛔ ទិសផ្ទុយ ៖ cache hit របស់សាខាដដែល ➜ គ្មានការហៅទី ៣',
        seenRequests.length === 2, seenRequests.length);

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ៧ខ. ⛔ ការបើកមុខងារបញ្ជី មិនត្រូវប្តូរផ្លូវ *ការស្កេន* ==');
    // ═════════════════════════════════════════════════════════════════════
    // ⛔ **ចន្លោះដែល mutation បង្ហាញ** ៖ `requestOnce()` ឥឡូវទទួល `plan` ➜
    // ការជ្រើស URL និង method ក្លាយជាសាខា។ សាខាដែលសរសេរខុសបន្តិច (ឧ. អាន
    // `config.list.url` ជំនួស `plan`) ដើរ **ត្រឹមត្រូវលើ tree ដែលបញ្ជីបិទ**
    // ហើយបញ្ជូន **ការស្កេន barcode ទៅ endpoint បញ្ជី** ភ្លាមពេលអ្នកប្រើដាក់
    // `ZTO_LIST_SITE_CODE`។ `zto-proxy-test` មើលមិនឃើញ ព្រោះវាមិនដែលកំណត់
    // env នោះសោះ ➜ ការអះអាងត្រូវឈរ **ត្រង់នេះ**។
    const scanWhileListOn = await detailCall(GOOD_LIST_ENV);
    ok('ការស្កេនធម្មតា ខណៈបញ្ជីបើក ➜ 200', scanWhileListOn.status === 200,
        scanWhileListOn.status);
    // ⛔ URL ៖ ការស្កេនត្រូវទៅ endpoint **detail** មិនមែន `/scan/page/scan`
    resetEnv(GOOD_LIST_ENV);
    seenRequests.length = 0;
    global.fetch = responder(DETAIL_ORDER);
    await call({ barcode: 'BAR0001' });
    ok('⛔ ការស្កេន ខណៈបញ្ជីបើក ➜ **URL detail** មិនមែន URL បញ្ជី',
        seenRequests.length === 1 && String(seenRequests[0].href).indexOf('/scan/page/scan') === -1,
        seenRequests.length ? String(seenRequests[0].href) : null);
    ok('⛔ ការស្កេន ខណៈបញ្ជីបើក ➜ body ជា template របស់ barcode មិនមែន `condition`',
        seenRequests.length === 1 && String(seenRequests[0].init.body || '').indexOf('condition') === -1,
        seenRequests.length ? String(seenRequests[0].init.body || '').slice(0, 80) : null);
    // ⛔ method ៖ `ZTO_API_METHOD=GET` ត្រូវនៅជា GET ទោះបញ្ជីបើក
    resetEnv(Object.assign({ ZTO_API_METHOD: 'GET' }, GOOD_LIST_ENV));
    seenRequests.length = 0;
    global.fetch = responder(DETAIL_ORDER);
    await call({ barcode: 'BAR0001' });
    ok('⛔ `ZTO_API_METHOD=GET` ➜ ការស្កេននៅជា **GET** ទោះបញ្ជីបើក',
        seenRequests.length === 1 && seenRequests[0].init.method === 'GET',
        seenRequests.length ? seenRequests[0].init.method : null);
    ok('⛔ GET ➜ barcode ចូល query មិនមែន body',
        seenRequests.length === 1 && !seenRequests[0].init.body
        && String(seenRequests[0].href).indexOf('billCode=BAR0001') !== -1,
        seenRequests.length ? String(seenRequests[0].href) : null);
    // ⛔ ទិសផ្ទុយ ៖ ផ្លូវ **បញ្ជី** នៅតែជា POST ទោះ `ZTO_API_METHOD=GET`
    const listWhileGet = await listCall(listPayload([listRow()]),
        Object.assign({ ZTO_API_METHOD: 'GET' }, GOOD_LIST_ENV));
    ok('⛔ ទិសផ្ទុយ ៖ ផ្លូវបញ្ជីនៅជា **POST** ទោះ `ZTO_API_METHOD=GET`',
        listWhileGet.requests.length === 1 && listWhileGet.requests[0].init.method === 'POST',
        listWhileGet.requests.length ? listWhileGet.requests[0].init.method : null);
    ok('⛔ ទិសផ្ទុយ ៖ ផ្លូវបញ្ជីទៅ URL បញ្ជីដដែល',
        listWhileGet.requests.length === 1
        && /\/scan\/page\/scan$/.test(String(listWhileGet.requests[0].href)),
        listWhileGet.requests.length ? String(listWhileGet.requests[0].href) : null);

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ៨. ⛔ ផ្លូវបណ្តាញរួម (auth · timeout · សំបកខូច) ==');
    // ═════════════════════════════════════════════════════════════════════
    resetEnv(GOOD_LIST_ENV);
    global.fetch = withCerts(async () => ({
        ok: false, status: 401, headers: { get: () => 'application/json' }, json: async () => ({})
    }));
    const rejected = await call(listQuery());
    ok('⛔ 401 ពី ZTO ➜ 401 `ZTO_AUTH_EXPIRED` (សាលក្រម auth រួម)',
        rejected.statusCode === 401 && codeOf(bodyOf(rejected)) === 'ZTO_AUTH_EXPIRED',
        { s: rejected.statusCode, b: rejected.body });

    resetEnv(GOOD_LIST_ENV);
    global.fetch = withCerts(async () => ({
        ok: false, status: 503, headers: { get: () => 'application/json' }, json: async () => ({})
    }));
    const down = await call(listQuery());
    ok('⛔ 5xx ពី ZTO ➜ 502 (ជណ្តើរ retry រួម)', down.statusCode === 502, down.statusCode);

    resetEnv(GOOD_LIST_ENV);
    global.fetch = responder({ success: false, error: 'boom' });
    const refused = await listCall({ success: false, error: 'boom' }, GOOD_LIST_ENV);
    ok('⛔ `success:false` ពី ZTO ➜ 502 `ZTO_UPSTREAM_REJECTED`',
        refused.status === 502 && codeOf(refused.body) === 'ZTO_UPSTREAM_REJECTED', refused.body);

    const emptyList = await listCall(listPayload([], { total: 0, pages: 0 }), GOOD_LIST_ENV);
    ok('⛔ បញ្ជីទទេ ≠ កំហុស ➜ 200 · `rows: []`',
        emptyList.status === 200 && !!emptyList.body && Array.isArray(emptyList.body.rows) && emptyList.body.rows.length === 0,
        emptyList.body);

    const noArray = await listCall({ success: true, data: { result: 'nope' } }, GOOD_LIST_ENV);
    ok('⛔ `result` មិនមែន array ➜ 502 (មិនស្ងាត់ជា ០ ជួរ)',
        noArray.status === 502, { s: noArray.status, b: noArray.body });

    // ⛔ ផ្លូវបណ្តាញត្រូវ **តែមួយ** — `fetch(` ត្រូវលេចម្តងគត់ក្នុង Function
    const fetchCalls = (FUNCTION_SRC.match(/(?:^|[^.\w])fetch\s*\(/g) || []).length;
    // ⛔ ការហៅ `fetch(` មាន **៣** ៖ ផ្លូវ ZTO រួម (`requestOnce`) · ការទាញវិញ្ញាបនបត្ររបស់ **Google** · និង `my_account` របស់
    // **Supabase** (អត្តសញ្ញាណហាង) — upstream ផ្សេងគ្នាទាំងស្រុង។ អ្វីដែលច្បាប់នេះហាមគឺ **ការចម្លងផ្លូវ ZTO** ➜ អត្តសញ្ញាណ
    // ដេរីវេ ៖ ការហៅដែលមិនមែន ZTO ត្រូវទៅ URL ថេររបស់វា ហើយនៅសល់ **មួយគត់** សម្រាប់ ZTO។
    const fetchArgs = [];
    const fetchRe = /(?:^|[^.\w])fetch\s*\(([^,)]*)/g;
    let fm;
    while ((fm = fetchRe.exec(FUNCTION_SRC))) fetchArgs.push(fm[1].trim());
    const identityFetches = fetchArgs.filter((a) => a === 'FIREBASE_CERTS_URL' || /^identity\.base \+ '\/rest\/v1\/rpc\/my_account'$/.test(a));
    ok('⛔ `fetch(` លេចត្រឹម ៣ ដង (ZTO រួម + វិញ្ញាបនបត្រ Google + `my_account` របស់ Supabase) ហើយមានតែ ១ សម្រាប់ ZTO',
        fetchCalls === 3 && identityFetches.length === 2 && fetchArgs.length - identityFetches.length === 1, fetchArgs);

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ៩. `?diag=1` ៖ ស្ថានភាពបញ្ជី គ្មានតម្លៃសម្ងាត់ ==');
    // ═════════════════════════════════════════════════════════════════════
    const diagOn = await diagCall(GOOD_LIST_ENV);
    ok('`?diag=1` មានផ្នែក `list`', !!(diagOn.body && diagOn.body.list),
        diagOn.body ? Object.keys(diagOn.body) : null);
    ok('ការកំណត់ត្រឹមត្រូវ ➜ `list.enabled === true`',
        listOf(diagOn.body).enabled === true, listOf(diagOn.body));
    ok('ការកំណត់ត្រឹមត្រូវ ➜ គ្មានមូលហេតុកំហុស',
        listOf(diagOn.body).reason === null, listOf(diagOn.body).reason);
    // ⛔ ការសួរត្រូវនាំលេខសាខាមកជាមួយ ដើម្បីឲ្យការអះអាង «មិនលេច» វាស់អ្វី
    // មែនទែន — សំណើដែលគ្មានលេខសាខាសោះ ធ្វើឲ្យវាពិតដោយស្វ័យប្រវត្តិ។
    const diagWithSite = await diagCall({ ZTO_LIST_SITE_CODE: LIST_SITE }, { site: LIST_SITE });
    ok('⛔ **លេខសាខាមិនលេចក្នុង `?diag=1`** ទោះសំណើ និង env នាំវាមក',
        String(diagWithSite.raw || '').indexOf(LIST_SITE) === -1,
        String(diagWithSite.raw || '').slice(0, 200));

    const diagOff = await diagCall({});
    ok('⛔ server លែងកាន់លេខសាខា ➜ `?diag=1` ប្រកាស `siteFromRequest: true`',
        listOf(diagOff.body).siteFromRequest === true, listOf(diagOff.body));
    ok('⛔ គ្មាន env ➜ រូបរាងផ្លូវបញ្ជីនៅត្រឹមត្រូវ (អ្វីដែលបិទវាគឺសំណើគ្មានសាខា)',
        listOf(diagOff.body).enabled === true, listOf(diagOff.body));

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ១០. ខាង Client ៖ ការចាត់ថ្នាក់ ៤ ក្រុម ==');
    // ═════════════════════════════════════════════════════════════════════
    const NEEDED = ['classifyZtoListRows', 'barcodeRegistryKey', 'pickupBarcodeKey',
        'normalizeStoredPhone', 'normalizeOneStoredPhone',
        'ztoScanStampMillis', 'appZoneWallClockToMillis', 'appZoneParts',
        'barcodeAbandonIsRipe', 'barcodeAbandonBasis', 'itemAbandonRipeAt', 'trashRetentionMs', 'ztoPickupVerdictOf', 'ztoListSignedVerdict', 'ztoListRowAgeState'];
    const CLOCK_CONST_NAMES = ['APP_TIME_ZONE', 'APP_TIME_ZONE_OFFSET_MINUTES', 'ABANDON_AGE_MS',
        'EXPIRED_TRASH_RETENTION_MS', 'TRASH_RETENTION_MS', 'ZTO_LIST_SIGNED_PROBE_MAX'];
    const NEEDED_CONSTS = CLOCK_CONST_NAMES.map((name) => constOrStub(APP_SRC, name))
        .concat([extractConst(APP_SRC, 'ztoListSignedProbe')
            || 'const ztoListSignedProbe = new Map();',
        extractConst(APP_SRC, 'ztoListSignedEvidence')
            || 'const ztoListSignedEvidence = new Set();']);
    ok('⛔ ស្រង់ថេរនាឡិកា/ច្បាប់សម្អាតចេញពី `app.js` បាន',
        CLOCK_CONST_NAMES.every((name) => !!extractConst(APP_SRC, name)), NEEDED_CONSTS);
    const parts = [];
    const missing = [];
    NEEDED.forEach((name) => {
        if (!extractFn(APP_SRC, name)) missing.push(name);
        parts.push(fnOrStub(APP_SRC, name));
    });
    ok('⛔ ស្រង់ function ចាំបាច់ចេញពី `app.js` បាន', missing.length === 0, missing);

    let classify = null;
    {
        const sandbox = { console: console, getServerNow: () => sandbox.__now };
        sandbox.globalThis = sandbox;
        try {
            vm.createContext(sandbox);
            vm.runInContext(NEEDED_CONSTS.join('\n') + '\n' + parts.join('\n')
                + '\nglobalThis.__classify = classifyZtoListRows;'
                + '\nglobalThis.__stamp0 = ztoScanStampMillis;', sandbox);
            sandbox.__now = sandbox.__stamp0('2026-09-11 09:00:00');
            classify = sandbox.__classify;
        } catch (e) {
            ok('sandbox រត់បាន', false, String(e && e.message));
        }
    }
    ok('⛔ `classifyZtoListRows` រត់ក្នុង sandbox បាន', typeof classify === 'function', typeof classify);

    if (typeof classify === 'function') {
        const history = [{ id: 'a', phone: '0963897345', barcodes: [{ code: '77130500000111' }] }];
        const trash = [{ id: 'b', phone: '060633155', barcodes: [{ code: '77130500000222' }] }];
        const input = [
            { barcode: '77130500000999', phone: '855963897345', cod: 6.47, dod: 0, at: '2026-09-09 08:12:27' },
            { barcode: '77130500000999', phone: '855963897345', cod: 6.47, dod: 0, at: '2026-09-10 09:10:16' },
            { barcode: '77130500000111', phone: '855963897345', cod: 1, dod: 0, at: '2026-09-10 10:00:00' },
            { barcode: '77130500000222', phone: '85560633155', cod: 2, dod: 0, at: '2026-09-10 10:01:00' },
            { barcode: '77130500000333', phone: '', cod: 0, dod: 0, at: '2026-09-10 10:02:00' },
            { barcode: '', phone: '0999888777', cod: 3, dod: 0, at: '2026-09-10 10:03:00' }
        ];
        let out = null;
        try { out = classify(input, history, trash); } catch (e) { out = null; }
        const groups = ['fresh', 'existing', 'duplicate', 'skipped'];
        ok('⛔ `classifyZtoListRows` មិនបោះលើ input ពិត', !!out, true);
        if (!out) out = { fresh: [], existing: [], duplicate: [], skipped: [] };
        ok('⛔ លទ្ធផលមានក្រុមទាំង ៤', groups.every((g) => Array.isArray(out && out[g])), out && Object.keys(out));
        const total = groups.reduce((n, g) => n + ((out && out[g]) || []).length, 0);
        ok('⛔ **ការអភិរក្ស** ៖ ផលបូកក្រុមទាំង ៤ ស្មើចំនួនជួរដេកដើម',
            total === input.length, { total: total, input: input.length });
        ok('⛔ barcode ស្ទួនក្នុងបញ្ជី ➜ ១ ចូល `duplicate` (លុយមិនបូកស្ទួន)',
            out.duplicate.length === 1, out.duplicate);
        const winner = out.fresh.filter((r) => r.barcode === '77130500000999');
        ok('⛔ ស្ទួន ➜ **ធាតុចុងក្រោយឈ្នះ** («មកដល់ចុងក្រោយ»)',
            winner.length === 1 && winner[0].at === '2026-09-10 09:10:16', winner);
        ok('⛔ barcode ដែលមានក្នុងប្រវត្តិ ➜ `existing`',
            out.existing.some((r) => r.barcode === '77130500000111'), out.existing);
        ok('⛔ barcode ដែលមានក្នុង**ធុងសំរាម** ➜ `existing` ដែរ (registry នៅជាប់)',
            out.existing.some((r) => r.barcode === '77130500000222'), out.existing);
        ok('⛔ គ្មានលេខទូរស័ព្ទ ➜ `skipped`',
            out.skipped.some((r) => r.barcode === '77130500000333'), out.skipped);
        ok('⛔ គ្មាន barcode ➜ `skipped`', out.skipped.length === 2, out.skipped);
        ok('ជួរដេកថ្មីពិត ➜ `fresh`',
            out.fresh.length === 1 && out.fresh[0].barcode === '77130500000999', out.fresh);
        ok('⛔ លេខទូរស័ព្ទត្រូវបម្លែងទម្រង់ដូចការស្កេន (`855…` ➜ `0…`)',
            !!out.fresh[0] && out.fresh[0].phone === '0963897345', out.fresh[0]);

        let emptyOut = null;
        try { emptyOut = classify([], [], []); } catch (_) { emptyOut = {}; }
        emptyOut = emptyOut || {};
        groups.forEach((g) => { if (!Array.isArray(emptyOut[g])) emptyOut[g] = [{}]; });
        ok('ទិសផ្ទុយ ៖ បញ្ជីទទេ ➜ ក្រុមទាំង ៤ ទទេ',
            groups.every((g) => emptyOut[g].length === 0), emptyOut);
        let junkOut = null;
        try { junkOut = classify(null, null, null); } catch (_) { junkOut = null; }
        ok('ទិសផ្ទុយ ៖ input អាក្រក់ ➜ មិនបោះ',
            !!junkOut && groups.every((g) => Array.isArray(junkOut[g])), junkOut);
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ១១. ⛔ ដំណាក់ ១ មិនសរសេរអ្វីសោះ ==');
    // ═════════════════════════════════════════════════════════════════════
    const WRITERS = ['addOrUpdateEntry', 'claimBarcodeInRegistry', 'fb.set', 'fb.update',
        'fb.push', 'fb.remove', 'fb.runTransaction'];
    const previewFns = ['runZtoListSyncPreview', 'classifyZtoListRows', 'renderZtoListSyncPreview',
        'fetchZtoListPage'];
    const previewSrc = previewFns.map((name) => extractFn(APP_SRC, name) || '').join('\n');
    ok('ជាន់អប្បបរមា ៖ ស្រង់តួ function មើលជាមុនបាន', previewSrc.length > 600, previewSrc.length);
    const writersFound = WRITERS.filter((name) => previewSrc.indexOf(name) !== -1);
    ok('⛔ ផ្លូវមើលជាមុន **មិនហៅផ្លូវសរសេរណាមួយ**', writersFound.length === 0, writersFound);

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ១២. កុងតាក់ · PIN · ការតភ្ជាប់ UI ==');
    // ═════════════════════════════════════════════════════════════════════
    ok('កូនសោកុងតាក់ `zoew_zto_listsync_v1` មាន',
        APP_SRC.indexOf("'zoew_zto_listsync_v1'") !== -1, true);
    const enabledFn = extractFn(APP_SRC, 'ztoListSyncEnabled') || '';
    ok('⛔ កុងតាក់ **លំនាំដើមបិទ** (`=== \'1\'`)',
        /===\s*'1'/.test(enabledFn), enabledFn.slice(0, 200));

    const ALLOW = /const ACTION_ALLOWLIST = \[([\s\S]*?)\];/.exec(APP_SRC);
    ok('ជាន់អប្បបរមា ៖ រក `ACTION_ALLOWLIST`', !!ALLOW, !!ALLOW);
    const ACTIONS = ['drawerZtoListSyncFlow', 'openZtoListSyncModal', 'closeZtoListSyncModal',
        'runZtoListSyncPreview'];
    ACTIONS.forEach((name) => {
        ok('`' + name + '` ស្ថិតក្នុង `ACTION_ALLOWLIST`',
            !!ALLOW && ALLOW[1].indexOf('"' + name + '"') !== -1, true);
        ok('`' + name + '` ជា function ពិតក្នុង `app.js`',
            !!extractFn(APP_SRC, name), true);
    });

    const PIN_BLOCK = /const PIN_PROMPT_MESSAGES = \{([\s\S]*?)\n    \};/.exec(APP_SRC);
    ok('ជាន់អប្បបរមា ៖ រក `PIN_PROMPT_MESSAGES`', !!PIN_BLOCK, !!PIN_BLOCK);
    ok('⛔ សារ PIN ផ្ទាល់ខ្លួន `ztoListSync` មាន (មិនប្រើឡើងវិញនូវ `lookupApi`)',
        !!PIN_BLOCK && /\n\s*ztoListSync:\s*\{/.test(PIN_BLOCK[1]), true);
    const openFn = extractFn(APP_SRC, 'openZtoListSyncModal') || '';
    ok('⛔ ប្រអប់ឆ្លងកាត់ PIN gate ដោយកូនសោរបស់ខ្លួន',
        /requestPinBeforeConfig\([^)]*'ztoListSync'\)/.test(openFn), openFn.slice(0, 400));

    const clearFn = extractFn(APP_SRC, 'clearSensitiveModalFields') || '';
    ok('⛔ `clearSensitiveModalFields()` បិទប្រអប់បញ្ជី',
        clearFn.indexOf("closeModal('ztoListSyncModal')") !== -1, true);
    ok('⛔ `clearSensitiveModalFields()` លុបខ្លឹមសារបញ្ជីចេញពី DOM',
        clearFn.indexOf('ztoListSyncBody') !== -1, true);

    // HTML wiring — CSP ៖ គ្មាន `on*=`
    ['ztoListSyncModal', 'ztoListSyncBody', 'ztoListSyncBtn', 'ztoListSyncState',
        'ztoListSyncFrom', 'ztoListSyncTo'].forEach((id) => {
        ok('`index.html` មាន `#' + id + '`', HTML_SRC.indexOf('id="' + id + '"') !== -1, true);
    });
    ok('⛔ ប៊ូតុងបញ្ជីប្រើ `data-act` (គ្មាន `onclick=`)',
        /id="ztoListSyncBtn"[^>]*data-act="openZtoListSyncModal"/.test(HTML_SRC)
        || /data-act="openZtoListSyncModal"[^>]*id="ztoListSyncBtn"/.test(HTML_SRC), true);

    // ⛔ ប៊ូតុងលើរបាប្រវត្តិត្រូវលេចតែពេលកុងតាក់បើក
    const refreshFn = extractFn(APP_SRC, 'refreshZtoListSyncUi') || '';
    if (fs.existsSync(path.join(ROOT, 'ZoeW', 'react-render.cjs'))) {
        // App React ៖ `refreshZtoListSyncUi()` សរសេរ `viewState` ហើយ `PageData` (JSX ពិត) គូរ class `hidden` ➜ វាស់
        // **ប៊ូតុងដែលគូរ** ក្នុងស្ថានភាពកុងតាក់ ៣ (បិទ · បើក · បើកតែ Lookup មិនមែន ZTO) មិនមែនអត្ថបទ function
        const { reactRuntime, renderedElement } = require('./react-view');
        const state = { on: false, cfg: {} };
        const rctx = {
            console, queueMicrotask,
            ztoListSyncEnabled: () => state.on, ztoFastModeIsOn: () => true, ztoStatusFeatureConfig: () => state.cfg
        };
        rctx.globalThis = rctx;
        let seen = null;
        try {
            vm.createContext(rctx);
            vm.runInContext(reactRuntime(APP_SRC, { context: rctx }), rctx);
            vm.runInContext(refreshFn + '\nglobalThis.__refresh = refreshZtoListSyncUi;', rctx);
            const btn = renderedElement(ROOT, rctx, 'src/app/components/PageData.tsx', 'PageData', 'ztoListSyncBtn');
            const hiddenWhen = (on, cfg) => { state.on = on; state.cfg = cfg; rctx.__refresh(); return btn.classList.contains('hidden'); };
            seen = { off: hiddenWhen(false, {}), on: hiddenWhen(true, {}), onNoZto: hiddenWhen(true, null), offAgain: hiddenWhen(false, {}) };
        } catch (e) {
            seen = { error: String(e && e.message) };
        }
        ok('⛔ `refreshZtoListSyncUi()` លាក់/បង្ហាញប៊ូតុងតាមកុងតាក់ (JSX ពិត ៖ បិទ ➜ លាក់ · បើក ➜ បង្ហាញ · Lookup មិនមែន ZTO ➜ លាក់)',
            !!seen && seen.off === true && seen.on === false && seen.onNoZto === true && seen.offAgain === true, seen);
    } else {
        ok('⛔ `refreshZtoListSyncUi()` លាក់/បង្ហាញប៊ូតុងតាមកុងតាក់',
            refreshFn.indexOf('ztoListSyncBtn') !== -1 && /hidden/.test(refreshFn),
            refreshFn.slice(0, 300));
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ១៣. ⛔ ច្រកទ្វារ «វាស់បាន» · ពិដានពេល · secret ==');
    // ═════════════════════════════════════════════════════════════════════
    // ⛔ **ថ្នាក់ដដែលនឹង 2.32.1** ៖ ក្រុម «ថ្មី» ដេរីវេពី `scanHistory` និង
    // `deletedItems` ➜ listener ងាប់ ➜ កញ្ចប់ដែល**មានរួច** រាយជា «ថ្មី» ➜
    // អ្នកប្រើបញ្ចូលស្ទួននៅដំណាក់ ២ ➜ **លុយបូកស្ទួន**។ ការរាប់មិនមែនជា
    // ការពិត ទាល់តែទិដ្ឋភាពស្រស់។
    const renderFn = extractFn(APP_SRC, 'renderZtoListSyncPreview') || '';
    ok('ជាន់អប្បបរមា ៖ ស្រង់ `renderZtoListSyncPreview` បាន', renderFn.length > 200, renderFn.length);
    ok('⛔ ទិដ្ឋភាពមិនស្រស់ ➜ ប្រអប់ត្រូវប្រាប់ «វាស់មិនបាន» (មិនអះអាង «ថ្មី» ជាការពិត)',
        renderFn.indexOf('ZTO_SYNC_VIEW_KEYS') !== -1
        && /VIEW_NOT_MEASURABLE/.test(renderFn), renderFn.slice(0, 200));
    ok('⛔ ក្រុមទាំង ៤ ដេរីវេពី `classifyZtoListRows()` (រូបមន្តតែមួយ)',
        renderFn.indexOf('classifyZtoListRows(') !== -1, true);

    const fetchFn = extractFn(APP_SRC, 'fetchZtoListPage') || '';
    ok('ជាន់អប្បបរមា ៖ ស្រង់ `fetchZtoListPage` បាន', fetchFn.length > 200, fetchFn.length);
    ok('⛔ រាល់ `fetch` ត្រូវមានពិដានពេលពិត (`fetchWithTimeout`)',
        fetchFn.indexOf('fetchWithTimeout(') !== -1 && fetchFn.indexOf('await fetch(') === -1,
        fetchFn.slice(0, 200));
    ok('⛔ secret ត្រូវឆ្លងកាត់ `buildLookupRequestHeaders()` (មិនអាន plaintext)',
        fetchFn.indexOf('buildLookupRequestHeaders(') !== -1
        && fetchFn.indexOf('headerValue') === -1, true);

    // ⛔ ពិដានទំព័រខាង client មិនត្រូវលើសពិដានខាង server ៖ សំណើទំព័រទី ៤
    // នឹងធ្លាក់ 400 រាល់ដង ➜ ជុំទាញដែលចប់ដោយកំហុសរាល់ដងលើបញ្ជីវែង។
    const clientMax = /const ZTO_LIST_CLIENT_MAX_PAGES = (\d+);/.exec(APP_SRC);
    const serverMax = /out\.maxPages = boundedInteger\(env\.ZTO_LIST_MAX_PAGES, (\d+),/.exec(FUNCTION_SRC);
    ok('ជាន់អប្បបរមា ៖ អានពិដានទំព័រទាំង ២ ខាងចេញពីកូដពិត',
        !!clientMax && !!serverMax, { c: clientMax && clientMax[1], s: serverMax && serverMax[1] });
    ok('⛔ ពិដានទំព័រខាង client មិនលើសលំនាំដើមខាង server',
        !!clientMax && !!serverMax && Number(clientMax[1]) <= Number(serverMax[1]),
        { c: clientMax && clientMax[1], s: serverMax && serverMax[1] });

    // ⛔ ការចុចរបស់អ្នកប្រើឈ្នះ ៖ ជុំទាញជា **ចេតនាផ្ទាល់** មិនមែនការងារ
    // បណ្តាញស្រេចចិត្ត ➜ `linkIsFrugal()` មិនត្រូវទប់វា (បើទប់ ➜ toast រាយ
    // «សូមសាកម្ដងទៀត» ខណៈការសាកម្ដងទៀតធ្លាក់ដដែល = សារកុហក)។
    const runFn = extractFn(APP_SRC, 'runZtoListSyncPreview') || '';
    ok('⛔ ការចុចរបស់អ្នកប្រើមិនត្រូវទប់ដោយ `linkIsFrugal()`',
        runFn.indexOf('linkIsFrugal') === -1, true);
    ok('⛔ ក្រៅបណ្តាញ ➜ ប្រាប់ការពិត មិនព្យាយាមហៅ',
        /navigator\.onLine === false/.test(runFn), true);
    ok('⛔ សោ in-flight ត្រូវដោះក្នុង `finally`',
        /finally\s*\{[^}]*ztoListSyncInFlight = false/.test(runFn), true);

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ១៤. ⛔ ជាន់ការពារទី ២ ៖ `scanTypeDesc` = «អីវ៉ាន់មកដល់» ==');
    // ═════════════════════════════════════════════════════════════════════
    // ⛔ **សំណើអ្នកប្រើ (2026-09-11)** ៖ `scanTypeCode: "03"` ជាតម្រងដែល
    // **ZTO** អនុវត្ត — យើងមិនអាចផ្ទៀងផ្ទាត់វាបានទេ។ ជួរដេកដែលត្រឡប់មក
    // ផ្ទុក `scanTypeDesc` ជាអត្ថបទ ➜ វាជាជាន់ការពារ **ខាងយើង** ៖ បើ
    // លេខកូដប្រែ ឬ ZTO ត្រឡប់ប្រភេទស្កេនផ្សេង (ចេញដំណើរ · ប្រគល់) នោះ
    // កញ្ចប់ខុសនឹងចូល ZoeW ដោយស្ងាត់។
    //
    // ⛔ តែច្បាប់ «មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស» នៅដដែល ៖ ជួរដេកដែល **គ្មានវាល
    // នេះសោះ** មិនត្រូវរំលងទេ (ZTO អាចប្តូរឈ្មោះវាល ➜ ការរំលងទាំងអស់ =
    // បញ្ជីទទេកុហក)។ មានតែ «មានវាល ហើយវាខុស» ទើបរំលង។
    const DESC_ROWS = [
        listRow({ scanBillCode: '77130500000101' }),
        listRow({ scanBillCode: '77130500000102', scanTypeDesc: 'ចេញដំណើរ' }),
        listRow({ scanBillCode: '77130500000103', scanTypeDesc: '' }),
        (() => { const r = listRow({ scanBillCode: '77130500000104' }); delete r.scanTypeDesc; return r; })()
    ];
    const descOut = await listCall(listPayload(DESC_ROWS), GOOD_LIST_ENV);
    const descRows = rowsOf(descOut.body);
    const byCode = (code) => descRows.filter((r) => r.barcode === code)[0] || null;
    ok('ជាន់អប្បបរមា ៖ ជួរដេក ៣ ត្រឡប់មក + ១ រាប់ក្នុង `otherScans` (មិនទម្លាក់ស្ងាត់)',
        descRows.length === 3 && !!descOut.body && descOut.body.otherScans === 1,
        { rows: descRows.length, other: descOut.body && descOut.body.otherScans });
    ok('⛔ `scanTypeDesc` ត្រូវគ្នា ➜ ជួរដេកប្រើបាន',
        !!byCode('77130500000101') && byCode('77130500000101').skip === '',
        byCode('77130500000101'));
    ok('⛔ `scanTypeDesc` **ខុស** ➜ មិនមែនជួរដេក (ទាញតែ «អីវ៉ាន់មកដល់»)',
        byCode('77130500000102') === null, byCode('77130500000102'));
    ok('⛔ `scanTypeDesc` ទទេ ➜ **មិនរំលង** («មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស»)',
        !!byCode('77130500000103') && byCode('77130500000103').skip === '',
        byCode('77130500000103'));
    ok('⛔ វាលអវត្តមានទាំងស្រុង ➜ **មិនរំលង**',
        !!byCode('77130500000104') && byCode('77130500000104').skip === '',
        byCode('77130500000104'));
    ok('⛔ ជួរដេកមាន ៨ វាល (`skip` + `ztoClosed` + `from`) — នៅតែគ្មានឈ្មោះ/អាសយដ្ឋាន',
        JSON.stringify(Object.keys(descRows[0] || {}).sort())
        === JSON.stringify(['at', 'barcode', 'cod', 'dod', 'from', 'phone', 'skip', 'ztoClosed']),
        Object.keys(descRows[0] || {}).sort());
    ok('⛔ តម្លៃ `scanTypeDesc` មិនឆ្លងកាត់ទៅ browser (ត្រឹមសាលក្រម)',
        JSON.stringify(descOut.body).indexOf('ចេញដំណើរ') === -1, true);

    // ⛔ **សំណើអ្នកប្រើ (2026-09-11)** ៖ «អោយ sync តែ `scanTypeCode: "03"`
    // និង `scanTypeDesc: "អីវ៉ាន់មកដល់"`» ➜ ជាន់ការពារត្រូវពិនិត្យ **ទាំង ២**។
    // ⛔ ហេតុផលពិត ៖ `scanTypeDesc` ជា **អត្ថបទដែលបកប្រែ** ➜ វាអាចប្រែតាម
    // ភាសារបស់គណនី ខណៈ `scanTypeCode` ជា **កូដស្ថិរ**។ ការពឹងលើអត្ថបទតែម្យ៉ាង
    // ធ្វើឲ្យការប្តូរភាសា ក្លាយជា **បញ្ជីទទេកុហក**; ការពឹងលើកូដតែម្យ៉ាង ទុក
    // ចន្លោះពេលកូដប្រែអត្ថន័យ។ ⛔ ទាំង ២ គោរពច្បាប់ «វាលអវត្តមាន ➜ មិនរំលង»។
    const codeRows = [
        listRow({ scanBillCode: '77130500000301' }),
        listRow({ scanBillCode: '77130500000302', scanTypeCode: '04', scanTypeDesc: 'ការចែកចាយអីវ៉ាន់' }),
        listRow({ scanBillCode: '77130500000303', scanTypeCode: '05' }),
        listRow({ scanBillCode: '77130500000304', scanTypeCode: '' }),
        (() => { const r = listRow({ scanBillCode: '77130500000305' }); delete r.scanTypeCode; return r; })()
    ];
    const codeOut = await listCall(listPayload(codeRows), GOOD_LIST_ENV);
    const codeRowsOut = rowsOf(codeOut.body);
    const byCode2 = (c) => codeRowsOut.filter((r) => r.barcode === c)[0] || null;
    ok('ជាន់អប្បបរមា ៖ ជួរដេក ៣ ត្រឡប់មក + ២ រាប់ក្នុង `otherScans`',
        codeRowsOut.length === 3 && !!codeOut.body && codeOut.body.otherScans === 2,
        { rows: codeRowsOut.length, other: codeOut.body && codeOut.body.otherScans });
    ok('⛔ `scanTypeCode` = `03` និង desc ត្រូវគ្នា ➜ ប្រើបាន',
        !!byCode2('77130500000301') && byCode2('77130500000301').skip === '', byCode2('77130500000301'));
    ok('⛔ `scanTypeCode` = `04` ➜ មិនមែនជួរដេក',
        byCode2('77130500000302') === null, byCode2('77130500000302'));
    ok('⛔ **កូដខុស ទោះអត្ថបទត្រូវ** ➜ មិនមែនជួរដេក (ជាន់ ២ ឯករាជ្យ)',
        byCode2('77130500000303') === null, byCode2('77130500000303'));
    ok('⛔ **កូដ `05` តែអត្ថបទនិយាយ «មកដល់»** ➜ **មិនមែនភស្តុតាង «បិទរួច»** (ជាន់ ២ ផ្ទុយគ្នា ➜ មិនបិទ)',
        !!codeOut.body && Array.isArray(codeOut.body.signed) && codeOut.body.signed.length === 0,
        codeOut.body && codeOut.body.signed);
    ok('⛔ `scanTypeCode` ទទេ ➜ **មិនរំលង** («មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស»)',
        !!byCode2('77130500000304') && byCode2('77130500000304').skip === '',
        byCode2('77130500000304'));
    ok('⛔ វាល `scanTypeCode` អវត្តមាន ➜ **មិនរំលង**',
        !!byCode2('77130500000305') && byCode2('77130500000305').skip === '',
        byCode2('77130500000305'));
    const codeCustom = await listCall(
        listPayload([listRow({ scanTypeCode: '07', scanTypeDesc: 'X' })]),
        { ZTO_LIST_SCAN_TYPE: '07', ZTO_LIST_SCAN_DESC: 'X' });
    ok('⛔ `ZTO_LIST_SCAN_TYPE` ជាមូលដ្ឋាននៃការប្រៀបធៀបកូដ (មិនមែន `03` រឹង)',
        (rowsOf(codeCustom.body)[0] || {}).skip === '', rowsOf(codeCustom.body)[0]);
    ok('⛔ តម្លៃកូដមិនឡើងដល់ browser',
        JSON.stringify(codeOut.body).indexOf('"04"') === -1, true);

    // ⛔ អត្ថបទគោលអាចប្តូរតាម env — លំនាំដើមត្រូវអានចេញពីកូដពិត
    const descDefault = /const DEFAULT_LIST_SCAN_DESC = '([^']*)'/.exec(FUNCTION_SRC);
    ok('ជាន់អប្បបរមា ៖ រកលំនាំដើម `DEFAULT_LIST_SCAN_DESC` ក្នុង Function',
        !!descDefault, descDefault && descDefault[1]);
    ok('⛔ លំនាំដើមជា «អីវ៉ាន់មកដល់» (សំណើអ្នកប្រើ) + អត្ថបទដែល ZTO បកប្រែតាមភាសាគណនី («到件» · «arrived»)',
        !!descDefault && JSON.stringify(descDefault[1].split('|')) === '["អីវ៉ាន់មកដល់","到件","arrived"]', descDefault && descDefault[1]);
    const descCustom = await listCall(listPayload([listRow({ scanTypeDesc: 'Arrival Scan' })]),
        { ZTO_LIST_SCAN_DESC: 'Arrival Scan' });
    ok('`ZTO_LIST_SCAN_DESC` ជំនួសអត្ថបទគោលបាន',
        (rowsOf(descCustom.body)[0] || {}).skip === '', rowsOf(descCustom.body)[0]);
    const descOff = await listCall(listPayload([listRow({ scanTypeDesc: 'ចេញដំណើរ' })]),
        { ZTO_LIST_SCAN_DESC: '' });
    ok('⛔ `ZTO_LIST_SCAN_DESC=` (ទទេ) ➜ បិទជាន់នេះទាំងស្រុង',
        (rowsOf(descOff.body)[0] || {}).skip === '', rowsOf(descOff.body)[0]);

    // ⛔ ខាង client ៖ ជួរដេកដែល server សម្គាល់ ត្រូវចូលក្រុម «រំលង»
    if (typeof classify === 'function') {
        const marked = classify([
            { barcode: '77130500000201', phone: '0963897345', cod: 1, dod: 0, at: '2026-09-10 10:00:00', skip: 'scan-type' },
            { barcode: '77130500000202', phone: '0963897345', cod: 1, dod: 0, at: '2026-09-10 10:01:00', skip: '' }
        ], [], []);
        ok('⛔ client ៖ ជួរដេកដែលសម្គាល់ `skip` ➜ ក្រុម «រំលង»',
            marked.skipped.length === 1 && marked.skipped[0].barcode === '77130500000201',
            marked.skipped);
        ok('⛔ client ៖ ជួរដេកមិនសម្គាល់ ➜ នៅជា «ថ្មី»',
            marked.fresh.length === 1 && marked.fresh[0].barcode === '77130500000202',
            marked.fresh);
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ១៥. ⛔ ដំណាក់ ២ ៖ ការបញ្ចូលពិត ឆ្លងទ្វារដដែលនឹងការស្កេន ==');
    // ═════════════════════════════════════════════════════════════════════
    // ⛔ **ច្បាប់ស្នូល** ៖ ការបញ្ចូលពីបញ្ជីត្រូវដើរដូច **ការស្កេនដោយដៃ**
    // បេះបិទ ៖ `claimBarcodeInRegistry()` (សាលក្រម server តែមួយដែលទប់ការ
    // បូកលុយស្ទួន) ➜ `addOrUpdateEntry()` (merge តាម `phone`+`scanDate`)។
    // ⛔ ផ្លូវសរសេរទី ២ នឹងរំលងជាន់ការពារ ៥ របស់ barcode ស្ទួន។
    const importFn = extractFn(APP_SRC, 'importZtoListRows') || '';
    ok('ជាន់អប្បបរមា ៖ ស្រង់ `importZtoListRows` បាន', importFn.length > 400, importFn.length);
    ok('⛔ ឆ្លងកាត់ `claimBarcodeInRegistry()` (សាលក្រម server)',
        importFn.indexOf('claimBarcodeInRegistry(') !== -1, true);
    ok('⛔ ឆ្លងកាត់ `addOrUpdateEntry()` (ទ្វារសរសេរតែមួយ)',
        importFn.indexOf('addOrUpdateEntry(') !== -1, true);
    ok('⛔ **មិនសាងផ្លូវសរសេរទី ២** (គ្មាន `fb.set/update/push/runTransaction` ផ្ទាល់)',
        !/fb\.(set|update|push|remove|runTransaction)\s*\(/.test(importFn), true);
    ok('⛔ មិនប៉ះ `isDeducted` ដោយផ្ទាល់ (ច្បាប់មាស)',
        importFn.indexOf('isDeducted') === -1, true);
    ok('⛔ ការធ្លាក់ត្រូវដោះកូនសោ registry វិញ',
        importFn.indexOf('releaseBarcodesInRegistry(') !== -1, true);
    ok('⛔ សាលក្រមមិនមែន `claimed` ➜ **មិនរក្សាទុក** («ផ្ទៀងផ្ទាត់មិនបាន ≠ គ្មានស្ទួន»)',
        /claim\s*!==\s*'claimed'/.test(importFn), true);
    ok('⛔ រាល់ការហៅដែលឈរខាងក្រោយសោត្រូវមានពិដាន (`withTimeout`)',
        importFn.indexOf('withTimeout(') !== -1, true);
    ok('⛔ សោ in-flight ដោះក្នុង `finally`',
        /finally\s*\{[^}]*ztoListSyncInFlight = false/.test(importFn), true);
    ok('⛔ ច្រកទ្វារ «វាស់បាន» ៖ ទិដ្ឋភាពមិនស្រស់ ➜ **មិនបញ្ចូល**',
        importFn.indexOf('ZTO_SYNC_VIEW_KEYS') !== -1
        && importFn.indexOf('anyDbListenerViewIsStale') !== -1, importFn.slice(0, 300));
    ok('⛔ ក្រៅបណ្ដាញ ➜ មិនបញ្ចូល', /navigator\.onLine === false/.test(importFn), true);
    ok('⛔ ការបញ្ចូលជា **លំដាប់** មិនស្របគ្នា (គ្មាន `Promise.all`)',
        importFn.indexOf('Promise.all') === -1, true);
    ok('`importZtoListRows` ស្ថិតក្នុង `ACTION_ALLOWLIST`',
        !!ALLOW && ALLOW[1].indexOf('"importZtoListRows"') !== -1, true);
    ok('`index.html` មានប៊ូតុងបញ្ចូល `#ztoListSyncImportBtn`',
        HTML_SRC.indexOf('id="ztoListSyncImportBtn"') !== -1, true);
    ok('⛔ ប៊ូតុងបញ្ចូលប្រើ `data-act` (គ្មាន `onclick=`)',
        /id="ztoListSyncImportBtn"[^>]*data-act="importZtoListRows"/.test(HTML_SRC), true);

    // ⛔ ការវាស់ **ឥរិយាបថ** ៖ ស្រង់តួចូល sandbox រួចរាប់ការហៅពិត
    const IMPORT_NAMES = ['importZtoListRows', 'classifyZtoListRows', 'barcodeRegistryKey',
        'pickupBarcodeKey', 'normalizeStoredPhone', 'normalizeOneStoredPhone',
        'ztoScanStampMillis', 'appZoneWallClockToMillis', 'appZoneParts',
        'barcodeAbandonIsRipe', 'barcodeAbandonBasis', 'itemAbandonRipeAt'];
    IMPORT_NAMES.push('captureZtoSession', 'ztoListSkipText', 'getZoneDateKey', 'trashRetentionMs',
        'ztoPickupVerdictOf', 'ztoListSignedVerdict', 'ztoListRowAgeState', 'ztoListRowNeedsSignedProbe',
        'resolveZtoListSignedVerdicts', 'markZtoListRowPickedUp',
        'ztoListCloseTargets', 'autoCloseBarcodeFromZto', 'collectOpenBarcodesForZtoStatus', 'itemHasRestoreMarkers');
    const importParts = IMPORT_NAMES.map((name) => fnOrStub(APP_SRC, name));
    const CLOCK_CONSTS = CLOCK_CONST_NAMES.map((name) => constOrStub(APP_SRC, name))
        .concat([extractConst(APP_SRC, 'ZTO_LIST_SKIP_TEXT') || 'const ZTO_LIST_SKIP_TEXT = {};',
            extractConst(APP_SRC, 'ztoListSignedProbe') || 'const ztoListSignedProbe = new Map();',
            extractConst(APP_SRC, 'ztoListSignedEvidence') || 'const ztoListSignedEvidence = new Set();',
            constOrStub(APP_SRC, 'ZTO_LIST_PROBE_CONCURRENCY')]);
    const importOptional = ['armLateWrite', 'releaseLateBarcodeClaim']
        .map((name) => extractFn(APP_SRC, name) || '').filter(Boolean);
    const importMissing = IMPORT_NAMES.filter((name) => !extractFn(APP_SRC, name)).length;
    ok('ជាន់អប្បបរមា ៖ ស្រង់ function ចាំបាច់ទាំងអស់សម្រាប់ sandbox',
        importMissing === 0, importMissing);

    {
        const calls = { claim: [], save: [], release: [], toast: [], probe: [], close: [], verdict: [], origin: [] };
        const box = {
            console: console,
            db: {}, authGeneration: 0, ztoSessionGeneration: 0, customerDataTableSessionGeneration: 0,
            scanHistory: [], deletedItems: [],
            ztoListSyncInFlight: false,
            ztoListSyncResult: null,
            ZTO_SYNC_VIEW_KEYS: ['history', 'deleted'],
            navigator: { onLine: true },
            getServerNow: () => box.__now,
            anyDbListenerViewIsStale: () => box.__stale === true,
            isBarcodeAlreadyUsed: () => false,
            claimBarcodeInRegistry: (code) => {
                calls.claim.push(code);
                if (box.__claimRejects) return Promise.reject(new Error('permission_denied'));
                if (box.__claimHangs) { const d = deferred(); box.__claimDeferreds.push(d); return d.promise; }
                return Promise.resolve(box.__claim || 'claimed');
            },
            addOrUpdateEntry: (code, phone, cod, dod, locker, stampMs, closedAtMs) => {
                calls.save.push({ code, phone, cod, dod, locker, stampMs, closedAtMs });
                box.scanHistory.push({
                    id: 'it-' + code, phone: phone, scanDate: '2026-09-04',
                    isClosed: !!closedAtMs,
                    barcodes: [{ code: code, cod: cod, dod: dod, isClosed: !!closedAtMs }]
                });
                if (box.__saveHangs) { const d = deferred(); box.__saveDeferreds.push(d); return d.promise; }
                if (box.__saveThrows) return Promise.reject(new Error('save failed'));
                return Promise.resolve(box.__saveResult === undefined ? true : box.__saveResult);
            },
            releaseBarcodesInRegistry: (codes) => { calls.release.push(codes); },
            saveBarcodeOrigins: (entries) => { calls.origin.push(entries); return Promise.resolve(0); },
            checkZtoStatusForBarcode: (cfg, code) => {
                calls.probe.push(code);
                if (box.__probeThrows) return Promise.reject(new Error('probe failed'));
                const verdict = box.__probeVerdict;
                return Promise.resolve(verdict === undefined ? null : { closed: verdict });
            },
            applyBarcodeCloseChange: (itemId, code, closed, opts) => {
                calls.close.push({ itemId, code, closed, opts });
                if (box.__closeHangs) return Promise.resolve(undefined);
                return Promise.resolve(box.__closeOk !== false);
            },
            ztoAutoCloseEnabled: () => box.__autoClose !== false,
            setZtoPickupVerdict: (code, closed) => { calls.verdict.push({ code, closed }); },
            dropOptimisticBarcode: () => {},
            refreshCurrentHistoryView: () => {},
            renderZtoListSyncPreview: () => {},
            setZtoListSyncNote: () => {},
            showToast: (msg) => { calls.toast.push(String(msg)); },
            confirm: () => box.__confirm !== false,
            withTimeout: (promise, ms, msg) => {
                if (box.__timeoutLabel && String(msg) === box.__timeoutLabel) {
                    return Promise.reject(new Error(msg));
                }
                return promise;
            },
            VIEW_NOT_MEASURABLE_TEXT: 'ទិន្នន័យមិនទាន់មកដល់គ្រប់ ➜ វាស់មិនបាន',
            ZTO_LIST_IMPORT_MAX: 100
        };
        box.globalThis = box;
        box.window = box;
        let runImport = null;
        try {
            vm.createContext(box);
            vm.runInContext(CLOCK_CONSTS.join('\n') + '\n'
                + importParts.concat(importOptional).join('\n')
                + '\nglobalThis.__run = importZtoListRows;'
                + '\nglobalThis.__classify = classifyZtoListRows;'
                + '\nglobalThis.__stamp = ztoScanStampMillis;'
                + '\nglobalThis.__offsetMin = APP_TIME_ZONE_OFFSET_MINUTES;'
                + '\nglobalThis.__skipText = ztoListSkipText;'
                + '\nglobalThis.__abandonMs = ABANDON_AGE_MS;'
                + '\nglobalThis.__trashRetentionMs = trashRetentionMs;'
                + '\nglobalThis.__resolveSigned = resolveZtoListSignedVerdicts;'
                + '\nglobalThis.__signedProbe = ztoListSignedProbe;'
                + '\nglobalThis.__signedEvidence = ztoListSignedEvidence;'
                + '\nglobalThis.__probeMax = ZTO_LIST_SIGNED_PROBE_MAX;', box);
            runImport = box.__run;
        } catch (e) {
            ok('sandbox នៃការបញ្ចូលរត់បាន', false, String(e && e.message));
        }
        ok('⛔ `importZtoListRows` រត់ក្នុង sandbox បាន', typeof runImport === 'function', typeof runImport);

        if (typeof runImport === 'function') {
            const FRESH = [
                { barcode: '77130500000901', phone: '855963897345', cod: 6.47, dod: 0, at: '2026-09-10 10:00:00', skip: '', from: 'Shopee SHPE' },
                { barcode: '77130500000902', phone: '85560633155', cod: 2.44, dod: 0, at: '2026-09-10 10:01:00', skip: '' }
            ];
            const reset = () => {
                calls.claim.length = 0; calls.save.length = 0;
                calls.release.length = 0; calls.toast.length = 0;
                calls.probe.length = 0; calls.close.length = 0; calls.verdict.length = 0; calls.origin.length = 0;
                box.scanHistory.length = 0;
                if (box.__signedEvidence) box.__signedEvidence.clear();
                box.__autoClose = true;
                box.__closeHangs = false;
                box.__probeVerdict = undefined; box.__probeThrows = false;
                box.__closeOk = true;
                if (box.__signedProbe) box.__signedProbe.clear();
                box.ztoListSyncInFlight = false;
                box.__stale = false; box.__claim = 'claimed';
                box.__saveThrows = false; box.__saveResult = true; box.__confirm = true;
                box.__claimHangs = false; box.__saveHangs = false; box.__timeoutLabel = '';
                box.__claimRejects = false;
                box.__claimDeferreds = []; box.__saveDeferreds = [];
                box.navigator.onLine = true;
                box.__now = Date.UTC(2026, 8, 11, 9, 0, 0) - box.__offsetMin * 60000;
                box.ztoListSyncResult = { rows: FRESH.slice(), from: '2026-09-08', to: '2026-09-11', total: 2 };
            };

            reset();
            await runImport();
            ok('⛔ ផ្លូវធម្មតា ៖ claim ម្តងក្នុងមួយ barcode',
                calls.claim.length === 2, calls.claim);
            ok('⛔ ផ្លូវធម្មតា ៖ រក្សាទុកតាម `addOrUpdateEntry()` ម្តងក្នុងមួយ barcode',
                calls.save.length === 2, calls.save);
            ok('⛔ លេខទូរស័ព្ទដែលរក្សាទុក ត្រូវបម្លែងទម្រង់រួច',
                calls.save[0] && calls.save[0].phone === '0963897345', calls.save[0]);
            ok('⛔ COD ឆ្លងកាត់បេះបិទ · DOD ជា 0 (បញ្ជីគ្មាន DOD)',
                calls.save[0] && calls.save[0].cod === 6.47 && calls.save[0].dod === 0, calls.save[0]);
            ok('⛔ ផ្លូវជោគជ័យមិនដោះកូនសោ registry', calls.release.length === 0, calls.release);
            ok('⛔ សោដោះក្រោយចប់', box.ztoListSyncInFlight === false, box.ztoListSyncInFlight);
            ok('⛔ ប្រភពកញ្ចប់ ៖ ការសរសេរ `origins` ១ ដងក្រោយរក្សាទុក ជាមួយ barcode ដែលរក្សាទុក និង `from` របស់ជួរ (ជួរគ្មាន `from` ➜ ទទេ)',
                calls.origin.length === 1 && JSON.stringify(calls.origin[0])
                    === JSON.stringify([{ code: '77130500000901', from: 'Shopee SHPE' }, { code: '77130500000902', from: '' }]),
                calls.origin);

            reset();
            box.__stale = true;
            await runImport();
            ok('⛔ **ទិដ្ឋភាពមិនស្រស់ ➜ មិនបញ្ចូលសោះ**',
                calls.save.length === 0 && calls.claim.length === 0, calls);

            reset();
            box.navigator.onLine = false;
            await runImport();
            ok('⛔ ក្រៅបណ្ដាញ ➜ មិនបញ្ចូលសោះ',
                calls.save.length === 0 && calls.claim.length === 0, calls);

            reset();
            box.__claim = 'taken';
            await runImport();
            ok('⛔ `taken` ➜ **មិនរក្សាទុក** (ស្ទួន)', calls.save.length === 0, calls.save);

            reset();
            box.__claim = 'unknown';
            await runImport();
            ok('⛔ `unknown` ➜ **មិនរក្សាទុក** («ផ្ទៀងផ្ទាត់មិនបាន ≠ គ្មានស្ទួន»)',
                calls.save.length === 0, calls.save);
            ok('⛔ `unknown` ➜ មិនដោះកូនសោដែលមិនបានចាក់', calls.release.length === 0, calls.release);

            reset();
            box.__saveThrows = true;
            await runImport();
            ok('⛔ ការរក្សាទុកធ្លាក់ ➜ **ដោះកូនសោ registry វិញ**',
                calls.release.length === 2, calls.release);
            ok('⛔ ការរក្សាទុកធ្លាក់ ➜ សារប្រាប់ការពិត (មិនស្ងាត់)',
                calls.toast.some((m) => m.indexOf('⚠️') !== -1), calls.toast);

            reset();
            box.__confirm = false;
            await runImport();
            ok('⛔ អ្នកប្រើបដិសេធការបញ្ជាក់ ➜ មិនបញ្ចូល', calls.save.length === 0, calls.save);

            reset();
            box.ztoListSyncResult = null;
            await runImport();
            ok('⛔ គ្មានបញ្ជីទាញរួច ➜ មិនបញ្ចូល', calls.save.length === 0, calls.save);

            // ⛔ តែក្រុម «ថ្មី» ប៉ុណ្ណោះត្រូវបញ្ចូល
            reset();
            box.scanHistory = [{ id: 'x', phone: '0963897345', barcodes: [{ code: '77130500000901' }] }];
            box.ztoListSyncResult = {
                rows: FRESH.concat([
                    { barcode: '77130500000903', phone: '', cod: 1, dod: 0, at: '2026-09-10 10:02:00', skip: '' },
                    { barcode: '77130500000904', phone: '0999888777', cod: 1, dod: 0, at: '2026-09-10 10:03:00', skip: 'scan-type' }
                ]),
                from: '2026-09-08', to: '2026-09-11', total: 4
            };
            await runImport();
            ok('⛔ **តែក្រុម «ថ្មី»** ត្រូវបញ្ចូល (មានរួច · រំលង ➜ ទុកចោល)',
                calls.save.length === 1 && calls.save[0].code === '77130500000902', calls.save);
            box.scanHistory = [];

            console.log('\n== ៩. \u26d4 \u179a\u1794\u17c0\u1794\u1794\u179a\u17b6\u1787\u17d0\u1799 \u00ab\u1796\u17d2\u1799\u17bd\u179a\u00bb \u1793\u17b7\u1784 \u00ab\u1799\u17ba\u178f\u178f\u17c2\u1787\u17c4\u1782\u1787\u17d0\u1799\u00bb ==');
            const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
            const releasedCodes = () => calls.release.reduce((all, codes) => all.concat(codes), []);

            reset();
            box.__claimHangs = true;
            box.__timeoutLabel = 'Barcode claim timed out';
            await runImport();
            ok('⛔ ជាន់អប្បបរមា ៖ ផ្លូវ «claim ព្យួរ» ត្រូវបានឈានដល់ពិត',
                box.__claimDeferreds.length >= 1, box.__claimDeferreds.length);
            ok('⛔ **ការព្យួរដំបូង ➜ ឈប់** (ZTO-G4 ៖ បន្ត ➜ ជួរនីមួយៗរង់ចាំពិដាន ១៥ វិ. ➜ ១០០ ជួរ = សោជាប់ ~២៥ នាទី)',
                box.__claimDeferreds.length === 1 && calls.claim.length === 1, calls.claim);
            ok('⛔ claim ព្យួរ ➜ មិនរក្សាទុក', calls.save.length === 0, calls.save);
            ok('⛔ claim ព្យួរ ➜ មិនដោះមុនដឹងសាលក្រម', releasedCodes().length === 0, calls.release);
            ok('⛔ ឈប់ពេលព្យួរ ➜ សារប្រាប់ចំនួនជួរដែល **មិនទាន់បញ្ចូល** (ZTO-G5)',
                calls.toast.some((m) => m.indexOf('មិនទាន់បញ្ចូល 1') !== -1), calls.toast);
            ok('⛔ ឈប់ពេលព្យួរ ➜ **រក្សាបញ្ជី** ដើម្បីចុចបញ្ចូលម្តងទៀត (មិនសម្អាត preview)',
                !!box.ztoListSyncResult && box.ztoListSyncResult.rows.length === 2, box.ztoListSyncResult);
            ok('⛔ ឈប់ពេលព្យួរ ➜ សោដោះ', box.ztoListSyncInFlight === false, box.ztoListSyncInFlight);
            box.__claimDeferreds.forEach((d) => d.resolve('claimed'));
            await flush();
            ok('⛔ claim ដែលចុះ **យឺត** ជា `claimed` ➜ ត្រូវដោះវិញ (បើអត់ ➜ កូនសោ registry កំព្រា ➜ barcode ស្កេនចូលមិនបានជារៀងរហូត)',
                releasedCodes().length === 1, calls.release);

            reset();
            box.__claimHangs = true;
            box.__timeoutLabel = 'Barcode claim timed out';
            await runImport();
            box.__claimDeferreds.forEach((d) => d.resolve('taken'));
            await flush();
            ok('⛔ ទិសផ្ទុយ ៖ claim យឺតដែលជា `taken` **មិនត្រូវដោះ** (មិនមែនរបស់យើង)',
                releasedCodes().length === 0, calls.release);

            reset();
            box.__saveHangs = true;
            box.__timeoutLabel = 'Save timed out';
            await runImport();
            ok('⛔ ជាន់អប្បបរមា ៖ ផ្លូវ «ការសរសេរព្យួរ» ត្រូវបានឈានដល់ពិត',
                box.__saveDeferreds.length >= 1, box.__saveDeferreds.length);
            ok('⛔ ការសរសេរព្យួរដំបូង ➜ ឈប់ (មិនរង់ចាំពិដានលើជួរបន្ទាប់)',
                box.__saveDeferreds.length === 1 && calls.claim.length === 1, calls.claim);
            ok('⛔ ការសរសេរព្យួរ ➜ សារប្រាប់ «កំពុងរក្សាទុក» និង «មិនទាន់បញ្ចូល» · បញ្ជីនៅ',
                calls.toast.some((m) => m.indexOf('⏳') !== -1 && m.indexOf('មិនទាន់បញ្ចូល 1') !== -1)
                && !!box.ztoListSyncResult, calls.toast);
            ok('⛔ ការសរសេរព្យួរ ➜ **មិនដោះកូនសោ registry ភ្លាម** (RTDB ចាក់ជួរ ➜ commit យឺត ➜ ការដោះ = barcode ស្កេនចូលបាន ២ ដង ➜ **លុយបូកស្ទួន**)',
                releasedCodes().length === 0, calls.release);
            ok('⛔ សារមិនត្រូវអះអាងថា «បរាជ័យ» ខណៈការសរសេរនៅរស់',
                calls.toast.some((m) => m.indexOf('⏳') !== -1), calls.toast);
            box.__saveDeferreds.forEach((d) => d.resolve(true));
            await flush();
            ok('⛔ commit យឺត **ជោគជ័យ** ➜ នៅតែមិនដោះកូនសោ',
                releasedCodes().length === 0, calls.release);

            reset();
            box.__saveHangs = true;
            box.__timeoutLabel = 'Save timed out';
            await runImport();
            box.__saveDeferreds.forEach((d) => d.reject(new Error('write rejected')));
            await flush();
            ok('⛔ ទិសផ្ទុយ ៖ commit យឺតដែល **បដិសេធពិត** ➜ ត្រូវដោះកូនសោវិញ',
                releasedCodes().length === 1, calls.release);

            reset();
            box.__claimRejects = true;
            await runImport();
            ok('ទិសផ្ទុយ ៖ claim **បដិសេធ** (មិនមែនព្យួរ) ➜ បន្តជួរបន្ទាប់ (មិនមែនការព្យួរ)',
                calls.claim.length === 2 && calls.save.length === 0, calls.claim);

            reset();
            const saveImpl = box.addOrUpdateEntry;
            box.addOrUpdateEntry = (...args) => { box.navigator.onLine = false; return saveImpl(...args); };
            await runImport();
            box.addOrUpdateEntry = saveImpl;
            ok('⛔ បណ្តាញដាច់កណ្តាលការបញ្ចូល ➜ ឈប់ · សារប្រាប់ «មិនទាន់បញ្ចូល 1» · បញ្ជីនៅ (ZTO-G5)',
                calls.save.length === 1 && calls.toast.some((m) => m.indexOf('មិនទាន់បញ្ចូល 1') !== -1)
                && !!box.ztoListSyncResult, { save: calls.save.length, toast: calls.toast });

            reset();
            await runImport();
            ok('ទិសផ្ទុយ ៖ បញ្ចូលគ្រប់ជួរ ➜ សម្អាតបញ្ជី · គ្មាន «មិនទាន់បញ្ចូល»',
                box.ztoListSyncResult === null && !calls.toast.some((m) => m.indexOf('មិនទាន់បញ្ចូល') !== -1), calls.toast);
            reset();

            // ═════════════════════════════════════════════════════════════
            console.log('\n== ១៦. \u26d4 \u1780\u17b6\u179b\u1794\u179a\u17b7\u1785\u17d2\u1786\u17c1\u1791 = \u1790\u17d2\u1784\u17c3\u179f\u17d2\u1780\u17c1\u1793\u179a\u1794\u179f\u17cb ZTO ==');
            // ═════════════════════════════════════════════════════════════
            // ⛔ **ច្បាប់** ៖ ជួរដេកនីមួយៗត្រូវចុះក្នុង ZoeW តាម **ថ្ងៃស្កេន
            // របស់ ZTO** មិនមែនថ្ងៃ sync ➜ `scanDate` · `time` · `createdAt`
            // និង **ថ្ងៃរបស់ ledger** សុទ្ធតែដេរីវេពី `row.at`។
            //
            // ⛔ **ពាក់កណ្តាលទី ២ ៖ ច្បាប់ ៨ ថ្ងៃ** — `createdAt` ដែលចាស់ជាង
            // `ABANDON_AGE_MS` ធ្វើឲ្យកញ្ចប់ **ចូលធុងសំរាមភ្លាម ហើយដកលុយ**
            // (`claimAndCleanupItem('abandon')`) ➜ អ្នកប្រើឃើញ «បញ្ចូល N
            // កញ្ចប់» រួចវាបាត់ទាំងអស់។ ដូច្នេះជួរដេកបែបនោះត្រូវចូលក្រុម
            // «រំលង» **មុនការបញ្ចូល** ⛔ មិនមែនត្រូវបញ្ចូលរួចទុកឲ្យការសម្អាត
            // លុបវិញទេ។
            const classifyReal = box.__classify;
            const stampOf = box.__stamp;
            ok('ជាន់អប្បបរមា ៖ `ztoScanStampMillis` រត់ក្នុង sandbox បាន',
                typeof stampOf === 'function', typeof stampOf);
            ok('ជាន់អប្បបរមា ៖ `ABANDON_AGE_MS` អានចេញពីកូដពិត',
                box.__abandonMs === 7 * 24 * 60 * 60 * 1000, box.__abandonMs);

            if (typeof stampOf === 'function' && typeof classifyReal === 'function') {
                const NOW = Date.UTC(2026, 8, 11, 9, 0, 0) - box.__offsetMin * 60000;
                ok('⛔ `ztoScanStampMillis()` ត្រូវនឹង offset ក្នុងកូដពិត',
                    stampOf('2026-09-11 09:00:00') === NOW, stampOf('2026-09-11 09:00:00'));
                ok('⛔ ទម្រង់ `T` ក៏ទទួលដែរ', stampOf('2026-09-11T09:00:00') === NOW,
                    stampOf('2026-09-11T09:00:00'));
                ok('⛔ អត្ថបទដែលមិនមែនត្រា ➜ `0` (ធ្លាក់ចុះទៅម៉ោង sync)',
                    stampOf('') === 0 && stampOf('abc') === 0 && stampOf(null) === 0, true);
                ok('⛔ ត្រាដែលមិនអាចមាន ➜ `0` (⛔ មិនរំកិលចូលខែក្រោយស្ងាត់ៗ)',
                    stampOf('2026-13-10 10:00:00') === 0
                    && stampOf('2026-09-10 25:00:00') === 0
                    && stampOf('2026-09-00 10:00:00') === 0, true);

                box.__now = NOW;
                const AGE = box.__abandonMs;
                const old2 = new Date(NOW - AGE - 60000);
                const pad = (n) => String(n).padStart(2, '0');
                const zoneText = (ms) => {
                    const d = new Date(ms + box.__offsetMin * 60000);
                    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
                        + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
                };
                const graded = classifyReal([
                    { barcode: '77130500000801', phone: '0963897345', cod: 1, dod: 0, at: zoneText(NOW - AGE + 60000), skip: '' },
                    { barcode: '77130500000802', phone: '0963897345', cod: 1, dod: 0, at: zoneText(old2.getTime()), skip: '' },
                    { barcode: '77130500000803', phone: '0963897345', cod: 1, dod: 0, at: '', skip: '' }
                ], [], []);
                ok('⛔ ជួរដេកក្នុងព្រំដែន (ក្មេងជាង `ABANDON_AGE_MS`) ➜ នៅជា «ថ្មី»',
                    graded.fresh.some((r) => r.barcode === '77130500000801'), graded.fresh);
                ok('⛔ ចាស់ជាងច្បាប់សម្អាត ហើយ **គ្មានសាលក្រម ZTO** ➜ រំលង (`too-old-unknown`)',
                    graded.skipped.some((r) => r.barcode === '77130500000802' && r.skip === 'too-old-unknown'),
                    graded.skipped);
                ok('⛔ ជួរដេកគ្មានត្រា ZTO ➜ មិនត្រូវរំលង (ធ្លាក់ចុះទៅម៉ោង sync)',
                    graded.fresh.some((r) => r.barcode === '77130500000803'), graded.fresh);
                ok('⛔ ការអភិរក្សនៅដដែល ៖ ថ្មី+មានរួច+ស្ទួន+រំលង = ចំនួនជួរដេកដើម',
                    graded.fresh.length + graded.existing.length
                    + graded.duplicate.length + graded.skipped.length === 3,
                    [graded.fresh.length, graded.existing.length, graded.duplicate.length, graded.skipped.length]);
                ok('⛔ ជួរដេកផ្ទុក `stampMs` ដែលដេរីវេពី `at` (ស្នាមភ្ជាប់ទៅ `addOrUpdateEntry`)',
                    (graded.fresh.find((r) => r.barcode === '77130500000801') || {}).stampMs
                    === stampOf(zoneText(NOW - AGE + 60000)), graded.fresh[0]);

                // ⛔ អ្នកប្រើត្រូវដឹង **ហេតុអ្វី** ជួរដេកមួយត្រូវរំលង ៖ ក្រុម
                // «រំលង (N)» ដែលគ្មានមូលហេតុ = កញ្ចប់បាត់ដោយគ្មានការពន្យល់
                // ➜ អ្នកប្រើសន្និដ្ឋានថាមុខងារខូច។
                const skipTextFn = box.__skipText;
                ok('ជាន់អប្បបរមា ៖ `ztoListSkipText()` រត់ក្នុង sandbox បាន',
                    typeof skipTextFn === 'function', typeof skipTextFn);
                if (typeof skipTextFn === 'function') {
                    const SKIP_KEYS = ['scan-type', 'too-old-open', 'too-old-unknown', 'too-old-purged'];
                    ok('⛔ រាល់មូលហេតុរំលងមានអត្ថបទពន្យល់ដល់អ្នកប្រើ',
                        SKIP_KEYS.every((k) => String(skipTextFn(k) || '').length > 8),
                        SKIP_KEYS.map(skipTextFn));
                    ok('⛔ មូលហេតុនីមួយៗខុសគ្នា (មិនមែនអត្ថបទរួមកន្តុំ) — «មិនទាន់បិទ» ≠ «វាស់មិនបាន» ≠ «ចាស់ពេក»',
                        new Set(SKIP_KEYS.map((k) => skipTextFn(k))).size === SKIP_KEYS.length,
                        SKIP_KEYS.map(skipTextFn));
                    ok('⛔ កូនសោមិនស្គាល់ ➜ អត្ថបទទទេ (មិនធ្លាក់ចុះទៅ prototype)',
                        skipTextFn('') === '' && skipTextFn('constructor') === ''
                        && skipTextFn('toString') === '', [skipTextFn('constructor'), skipTextFn('toString')]);
                }
                const classifySrc = extractFn(APP_SRC, 'classifyZtoListRows') || '';
                // ⛔ ការអះអាងត្រូវ **ដេរីវេ** ៖ ការផ្លាស់ច្រកទ្វារចូល helper
                // **ត្រឹមត្រូវ** (ចំណុចច្របាច់តែមួយ) មិនត្រូវធ្វើឲ្យវាធ្លាក់ទេ —
                // តែការសរសេររូបមន្តព្រំដែនឡើងវិញ **ត្រូវធ្លាក់**។
                const AGE_GATE_FNS = ['classifyZtoListRows', 'ztoListRowAgeState'];
                const ripeOwners = AGE_GATE_FNS.filter((name) =>
                    /barcodeAbandonIsRipe\s*\(/.test(extractFn(APP_SRC, name) || ''));
                ok('⛔ ច្រកទ្វារ «ចាស់ពេក» ហៅ **អ្នកសម្រេចដដែល** នឹងការសម្អាត (`barcodeAbandonIsRipe`) ⛔ មិនមែនច្បាប់ចម្លងទី ៤ នៃរូបមន្តព្រំដែន',
                    ripeOwners.length === 1
                    && AGE_GATE_FNS.every((name) =>
                        (extractFn(APP_SRC, name) || '').indexOf('ABANDON_AGE_MS') === -1),
                    ripeOwners);
                ok('⛔ ហើយអ្នកចាត់ថ្នាក់ឈានដល់វា (ដោយផ្ទាល់ ឬតាមអ្នកសម្រេចអាយុ)',
                    ripeOwners.length === 1
                    && (ripeOwners[0] === 'classifyZtoListRows'
                        || new RegExp(ripeOwners[0] + '\\s*\\(').test(classifySrc)),
                    ripeOwners);
                // អ្នកសាងជួរមើលជាមុន ៖ `ztoListGroupHtml()` (App ដើម) ឬ `ztoListGroupModel()` (App React ➜ `ZtoListSyncBody`)
                const groupHtmlFn = extractFn(APP_SRC, 'ztoListGroupHtml') || extractFn(APP_SRC, 'ztoListGroupModel') || '';
                ok('⛔ ជួរដេកមើលជាមុនបង្ហាញមូលហេតុពិត (ស្នាមភ្ជាប់ទៅ `ZTO_LIST_SKIP_TEXT`)',
                    /ztoListSkipText\s*\(\s*row\.skip\s*\)/.test(groupHtmlFn), groupHtmlFn.slice(0, 200));

                // ═════════════════════════════════════════════════════════
                // ⛔ **ច្រកទ្វារ ៣ ផ្លូវ ៖ «ចាស់» មិនមែនជាអ្នកសម្រេចតែម្នាក់**
                // (សំណើអ្នកប្រើ 2026-09-12)
                // ═════════════════════════════════════════════════════════
                // កញ្ចប់ដែល ZTO **បិទបញ្ជីរួច** = អតិថិជនយករួច = **ជួរ ៧**
                // នៃតារាងសេណារីយ៉ូ (`pickup` ➜ លុយ **មិនប៉ះ**) ចំណែក «ផុត
                // កំណត់» = **ជួរ ៨** (`expired` ➜ **ដកលុយ**)។ អ្វីដែលបែងចែក
                // ពួកវាគឺ **អតិថិជនបានយកឬអត់** មិនមែនអាយុទេ។
                //
                // ⛔ ហើយសាលក្រមមាន **៣** ៖ `true` ➜ បញ្ចូលជា «យករួច»;
                // `false` ➜ រំលង; `null` (**វាស់មិនបាន**) ➜ រំលងដែរ — នេះជា
                // ច្បាប់ «មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស»។ ការចាត់ `null` ជា `true`
                // នឹងបញ្ចូលកញ្ចប់ដែល **មិនទាន់យក** ជា «យករួច» ➜ លុយចូល
                // ចំណូលខុស ហើយកញ្ចប់បាត់ពីបញ្ជីរង់ចាំ។
                const RET = box.__trashRetentionMs
                    ? box.__trashRetentionMs({ trashReason: 'pickup' }) : 0;
                ok('ជាន់អប្បបរមា ៖ `trashRetentionMs()` អានចេញពីកូដពិត',
                    RET === 30 * 24 * 60 * 60 * 1000, RET);
                const oldAt = zoneText(NOW - AGE - 60000);
                const gradeOne = (ztoClosed, at) => classifyReal([{
                    barcode: '77130500000821', phone: '0963897345', cod: 5, dod: 0,
                    at: at || oldAt, skip: '', ztoClosed: ztoClosed
                }], [], []);
                const closedOld = gradeOne(true);
                ok('⛔ ចាស់ + ZTO **បិទបញ្ជីរួច** ➜ ចូលក្រុម «ថ្មី» (មិនរំលងទៀត)',
                    closedOld.fresh.length === 1 && closedOld.skipped.length === 0, closedOld);
                ok('⛔ ហើយវាត្រូវសម្គាល់ `closedAtZto` ➜ ស្នាមភ្ជាប់ទៅ `addOrUpdateEntry()` (បញ្ចូលជា «យករួច» ⛔ មិនមែន «ផុតកំណត់»)',
                    closedOld.fresh[0] && closedOld.fresh[0].closedAtZto === true, closedOld.fresh[0]);
                const openOld = gradeOne(false);
                ok('⛔ ចាស់ + ZTO **មិនទាន់បិទ** ➜ រំលង (`too-old-open`) — សំណើអ្នកប្រើ ៖ «សូមកុំបញ្ចូល»',
                    openOld.skipped.length === 1 && openOld.skipped[0].skip === 'too-old-open',
                    openOld.skipped);
                const unknownOld = gradeOne(null);
                ok('⛔ ចាស់ + **វាស់មិនបាន** ➜ រំលង (`too-old-unknown`) ⛔ មិនមែនបញ្ចូល («មិនអាចផ្ទៀងផ្ទាត់ ≠ បិទរួច»)',
                    unknownOld.skipped.length === 1 && unknownOld.skipped[0].skip === 'too-old-unknown',
                    unknownOld.skipped);
                // ⛔ **ពិដានអាយុ ៖ បើគ្មាន ➜ លុយបូកស្ទួន។** ការ purge ធុងសំរាម
                // **ដោះកូនសោ registry វិញ** (`releaseBarcodesInRegistry` ក្នុង
                // `runAutomaticDeletedCleanup`) ➜ កញ្ចប់ដែលយករួច និងកត់ក្នុង
                // ZoeW រួច ➜ `pickup` ➜ purge នៅ `TRASH_RETENTION_MS` ➜ បាត់ពី
                // `deletedItems` **និង** បាត់ពី registry ➜ ជាន់ការពារស្ទួន
                // **ទាំង ២** ងាប់ ➜ ការ sync ជួរចាស់រាយវាជា «ថ្មី» ➜ **COD បូក
                // ចូលថ្ងៃចាស់ម្តងទៀត**។
                const purgedOld = gradeOne(true, zoneText(NOW - RET - 60000));
                ok('⛔ ចាស់ជាងអាយុធុងសំរាម ➜ រំលង (`too-old-purged`) ទោះ ZTO បិទរួច — ពិនិត្យស្ទួនមិនបាន ➜ **ហានិភ័យលុយបូកស្ទួន**',
                    purgedOld.skipped.length === 1 && purgedOld.skipped[0].skip === 'too-old-purged',
                    purgedOld.skipped);
                // ⛔ **ព្រំដែនអាយុត្រូវរស់នៅកន្លែងតែមួយ។** វាមានអ្នកអាន ២ ៖
                // អ្នកចាត់ថ្នាក់ និងអ្នកជ្រើសជួរដេកដែលត្រូវសួរ ZTO។ បើពួកវា
                // កាន់ច្បាប់ចម្លងៗ ជុំក្រោយកែមួយ ភ្លេចមួយ ➜ អ្នកសួរឈប់សួរ
                // ជួរដេកដែលអ្នកចាត់ថ្នាក់ចាត់ជា «ចាស់» ➜ **រំលងស្ងាត់ៗ**។
                // ⛔ ការអះអាងត្រូវ **ដេរីវេឈ្មោះ** មិនមែនចាក់ literal ទី ២។
                const BOUNDARY_READERS = ['classifyZtoListRows', 'ztoListRowAgeState',
                    'ztoListRowNeedsSignedProbe', 'resolveZtoListSignedVerdicts'];
                const boundaryOwners = BOUNDARY_READERS.filter((name) =>
                    /trashRetentionMs\s*\(/.test(extractFn(APP_SRC, name) || ''));
                ok('⛔ ព្រំដែនអាយុដេរីវេពី `trashRetentionMs()` ⛔ មិនមែនលេខថេរទី ២',
                    boundaryOwners.length === 1
                    && (extractFn(APP_SRC, boundaryOwners[0]) || '').indexOf('TRASH_RETENTION_MS') === -1,
                    boundaryOwners);
                if (boundaryOwners.length === 1) {
                    const decider = boundaryOwners[0];
                    const probeSrc = extractFn(APP_SRC, 'ztoListRowNeedsSignedProbe') || '';
                    const callsDecider = (src) => decider === 'classifyZtoListRows'
                        ? false : new RegExp(decider + '\\s*\\(').test(src);
                    ok('⛔ **អ្នកចាត់ថ្នាក់ និងអ្នកសួរ ហៅអ្នកសម្រេចដដែល** (រូបមន្តព្រំដែនមិនរស់នៅ ២ កន្លែង)',
                        callsDecider(classifySrc) && callsDecider(probeSrc),
                        { decider: decider, classify: callsDecider(classifySrc), probe: callsDecider(probeSrc) });
                }
                // ⛔ **សំណើម្ចាស់គម្រោង (ZoeW 2.50.0)** ៖ «បើប៉ះកញ្ចប់ដែលបិទរួច សូមបូកវាចូលស្ថិតិដូចបិទដោយដៃ ១០០%» ➜
                //    ជួរដេក **ក្មេង** ដែល ZTO បិទរួចក៏ត្រូវកើតមកជា «យករួច» (មុន ៖ តែជួរដេកចាស់ ➜ ក្មេងបញ្ចូលជា «មិនទាន់យក»
                //    ហើយរង់ចាំការបិទស្វ័យប្រវត្តិ ឬដៃ)។ ⛔ ទិសផ្ទុយនៅដដែល ៖ `false`/`null` (មិនទាន់វាស់) ➜ **មិនបិទ**។
                ok('⛔ ជួរដេក **ក្មេង** + ZTO **បិទរួច** ➜ សម្គាល់ `closedAtZto` (បញ្ចូលជា «យករួច» ដូចបិទដោយដៃ)',
                    (gradeOne(true, zoneText(NOW - AGE + 60000)).fresh[0] || {}).closedAtZto === true,
                    gradeOne(true, zoneText(NOW - AGE + 60000)).fresh[0]);
                ok('⛔ ទិសផ្ទុយ ៖ ជួរដេកក្មេង + ZTO **មិនទាន់បិទ** ឬ **វាស់មិនបាន** ➜ មិនសម្គាល់ `closedAtZto` («មិនអាចផ្ទៀងផ្ទាត់ ≠ បិទរួច»)',
                    (gradeOne(false, zoneText(NOW - AGE + 60000)).fresh[0] || {}).closedAtZto === false
                    && (gradeOne(null, zoneText(NOW - AGE + 60000)).fresh[0] || {}).closedAtZto === false,
                    [gradeOne(false, zoneText(NOW - AGE + 60000)).fresh[0], gradeOne(null, zoneText(NOW - AGE + 60000)).fresh[0]]);

                reset();
                box.__now = NOW;
                box.ztoListSyncResult = {
                    rows: [
                        { barcode: '77130500000801', phone: '0963897345', cod: 1, dod: 0, at: zoneText(NOW - AGE + 60000), skip: '' },
                        { barcode: '77130500000802', phone: '0963897345', cod: 1, dod: 0, at: zoneText(old2.getTime()), skip: '' }
                    ],
                    from: '2026-09-01', to: '2026-09-11', total: 2
                };
                await runImport();
                ok('⛔ ការបញ្ចូល ៖ ជួរដេកចាស់ពេក **មិនត្រូវសរសេរ**',
                    calls.save.length === 1 && calls.save[0].code === '77130500000801', calls.save);
                ok('⛔ ការបញ្ចូល ៖ ត្រា ZTO ត្រូវឡើងដល់ `addOrUpdateEntry()` ជាអាគុយម៉ង់ទី ៦',
                    calls.save[0] && calls.save[0].stampMs === stampOf(zoneText(NOW - AGE + 60000)),
                    calls.save[0]);

                // ⛔ **កញ្ចប់ត្រូវ *កើតមកជាបិទស្រាប់* — មិនមែន «បញ្ចូលរួចទើប
                // បិទ»។** `debouncedRenderAfterHistorySync` ជា debounce
                // **១២០ ms** ហើយវាហៅ `runAutomaticCleanupRules()` ដែលច្បាប់
                // abandon របស់វាឈរលើ `!item.isClosed && (now − createdAt >
                // ABANDON_AGE_MS)` ➜ ដោយសារ `createdAt` = ត្រា ZTO ចាស់
                // **ភ្លាមក្រោយ snapshot មកដល់ កញ្ចប់ចូលធុងសំរាមជា `expired`
                // ហើយ *ដកលុយ*** មុនជំហានបិទរត់ទាន់ផង។ ដូច្នេះស្ថានភាពបិទ
                // ត្រូវចុះក្នុង **ការសរសេរតែមួយដដែល** (អាគុយម៉ង់ទី ៧)។
                reset();
                box.__now = NOW;
                box.ztoListSyncResult = {
                    rows: [{ barcode: '77130500000831', phone: '0963897345', cod: 5, dod: 0, at: oldAt, skip: '', ztoClosed: true }],
                    from: '2026-09-01', to: '2026-09-11', total: 1
                };
                await runImport();
                ok('⛔ ចាស់ + បិទរួច ➜ **ត្រូវបញ្ចូល** (មិនរំលងទៀត)',
                    calls.save.length === 1 && calls.save[0].code === '77130500000831', calls.save);
                ok('⛔ លុយចុះលើ **ថ្ងៃស្កេន ZTO** ដដែល (អាគុយម៉ង់ទី ៦ មិនប្រែ)',
                    calls.save[0] && calls.save[0].stampMs === stampOf(oldAt), calls.save[0]);
                ok('⛔ **អាគុយម៉ង់ទី ៧ ជាត្រាបិទ** ➜ barcode កើតមកជាបិទ ➜ ច្បាប់ abandon មិនអាចបាញ់ (`!item.isClosed` ជាច្រកទ្វារ)',
                    calls.save[0] && typeof calls.save[0].closedAtMs === 'number'
                    && calls.save[0].closedAtMs > 0, calls.save[0]);
                ok('⛔ ត្រាបិទជា **ម៉ោងឥឡូវ** មិនមែនត្រា ZTO ➜ ច្បាប់ ២ ម៉ោងទុកបង្អួចឲ្យស្ថិតិយកចុះទាន់ (ការចូលធុងសំរាម *ភ្លាម* ជាការប្រណាំងទី ២)',
                    calls.save[0] && calls.save[0].closedAtMs === NOW, calls.save[0]);
                ok('⛔ ស្ថិតិយកត្រូវសរសេរតាម **ទ្វារតែមួយ** `applyBarcodeCloseChange()` ⛔ មិនមែនផ្លូវសរសេរទី ២',
                    calls.close.length === 1 && calls.close[0].code === '77130500000831'
                    && calls.close[0].closed === true, calls.close);
                ok('⛔ ហើយវាត្រូវស្ងាត់ និងមិនបើកប្រអប់ (ការបញ្ចូលជាក្រុម)',
                    calls.close[0] && calls.close[0].opts
                    && calls.close[0].opts.silent === true && calls.close[0].opts.showModal === false,
                    calls.close[0]);
                ok('⛔ **លុយមិនត្រូវដក** ៖ គ្មានផ្លូវណាប៉ះ `isDeducted` ក្នុងការបញ្ចូល',
                    (extractFn(APP_SRC, 'importZtoListRows') || '').indexOf('isDeducted') === -1, true);
                const lastPickupToast = calls.toast[calls.toast.length - 1] || '';
                ok('⛔ សារបញ្ចប់ត្រូវរាប់កញ្ចប់ «យករួច» ដាច់ដោយឡែក (អ្នកប្រើត្រូវដឹងថាវាមិនរង់ចាំក្នុងបញ្ជី)',
                    lastPickupToast.indexOf('🔒') !== -1, calls.toast);

                reset();
                box.__now = NOW;
                box.__closeOk = false;
                box.ztoListSyncResult = {
                    rows: [{ barcode: '77130500000832', phone: '0963897345', cod: 5, dod: 0, at: oldAt, skip: '', ztoClosed: true }],
                    from: '2026-09-01', to: '2026-09-11', total: 1
                };
                await runImport();
                ok('⛔ ទិសផ្ទុយ ៖ ស្ថិតិយកធ្លាក់ ➜ **មិនត្រូវដោះកូនសោ registry** (កញ្ចប់ចុះរួច ➜ ការដោះ = ស្កេនចូលបាន ២ ដង ➜ លុយបូកស្ទួន)',
                    calls.release.length === 0, calls.release);

                // ⛔ ជួរ «យករួច» ដែលការសរសេរ **commit យឺត** (លើសពិដាន ១៥ វិ.) ឬឆ្លើយ `false` (កញ្ចប់ចុះរួច · ស្ថិតិប្រាក់មិនទាន់បញ្ជាក់) ៖
                // ស្ថិតិយក (`pickedUpBarcodes`) និង mirror ចំណូលប្រចាំថ្ងៃ ត្រូវសរសេរតាម `applyBarcodeCloseChange()` ដដែល ពេល commit មកដល់ —
                // បើមិនដូច្នេះ កញ្ចប់បិទក្នុងប្រវត្តិ តែមិនដែលចូលស្ថិតិយក/ចំណូលប្រចាំថ្ងៃ (Late commit ៖ ការងារក្រោយ commit រត់ពេលវាមកដល់)
                const flushLate = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
                const lateRow = (code) => ({ rows: [{ barcode: code, phone: '0963897345', cod: 5, dod: 0, at: oldAt, skip: '', ztoClosed: true }],
                    from: '2026-09-01', to: '2026-09-11', total: 1 });
                reset();
                box.__now = NOW;
                box.__saveHangs = true;
                box.__timeoutLabel = 'Save timed out';
                box.ztoListSyncResult = lateRow('77130500000833');
                await runImport();
                ok('⛔ ជាន់អប្បបរមា ៖ ការសរសេរជួរ «យករួច» ព្យួរពិត ហើយមិនទាន់សរសេរស្ថិតិយក',
                    box.__saveDeferreds.length === 1 && calls.close.length === 0, { saves: box.__saveDeferreds.length, close: calls.close });
                box.__saveDeferreds.forEach((d) => d.resolve(true));
                await flushLate();
                ok('⛔ commit **យឺត** នៃជួរ «យករួច» ➜ ស្ថិតិយកត្រូវសរសេរពេល commit មកដល់ (`applyBarcodeCloseChange()` តែម្តង)',
                    calls.close.length === 1 && calls.close[0].code === '77130500000833' && calls.close[0].closed === true, calls.close);

                reset();
                box.__now = NOW;
                box.__saveResult = false;
                box.ztoListSyncResult = lateRow('77130500000834');
                await runImport();
                ok('⛔ រក្សាទុករួច តែស្ថិតិប្រាក់មិនទាន់បញ្ជាក់ (`false`) ➜ ស្ថិតិយកនៅតែត្រូវសរសេរ',
                    calls.close.length === 1 && calls.close[0].code === '77130500000834', calls.close);
                const falseToast = calls.toast[calls.toast.length - 1] || '';
                ok('⛔ ហើយសារបញ្ចប់មិនអះអាងថា «បរាជ័យ» (កញ្ចប់ចុះរួច · កូនសោ registry នៅ)',
                    falseToast.indexOf('បរាជ័យ') === -1 && calls.release.length === 0, { toast: calls.toast, release: calls.release });

                reset();
                box.__now = NOW;
                box.__saveHangs = true;
                box.__timeoutLabel = 'Save timed out';
                box.ztoListSyncResult = lateRow('77130500000835');
                await runImport();
                box.__saveDeferreds.forEach((d) => d.reject(new Error('write rejected')));
                await flushLate();
                ok('⛔ ទិសផ្ទុយ ៖ commit យឺតដែល **បដិសេធពិត** ➜ មិនសរសេរស្ថិតិយក (កញ្ចប់មិនមាន)',
                    calls.close.length === 0, calls.close);

                // ⛔ **ការធ្លាក់ចុះទៅ `/detail`** ៖ ជួរដេកបញ្ជីអាចគ្មានវាល
                // ស្ថានភាព (យើងផ្ទៀងផ្ទាត់ `billStatus` **តែលើ `/detail`**)
                // ➜ `resolveZtoListSignedVerdicts()` ជាអ្នកវាស់ជាន់ទី ២។
                const resolveSigned = box.__resolveSigned;
                ok('ជាន់អប្បបរមា ៖ `resolveZtoListSignedVerdicts()` រត់ក្នុង sandbox បាន',
                    typeof resolveSigned === 'function', typeof resolveSigned);
                if (typeof resolveSigned === 'function') {
                    const oldRow = { barcode: '77130500000841', phone: '0963897345', cod: 5, dod: 0, at: oldAt, skip: '' };
                    const youngRow = { barcode: '77130500000842', phone: '0963897345', cod: 5, dod: 0, at: zoneText(NOW - 86400000), skip: '' };
                    const purgedRow = { barcode: '77130500000843', phone: '0963897345', cod: 5, dod: 0, at: zoneText(NOW - RET - 60000), skip: '' };
                    const knownRow = { barcode: '77130500000844', phone: '0963897345', cod: 5, dod: 0, at: oldAt, skip: '', ztoClosed: false };

                    reset();
                    box.__now = NOW;
                    box.__probeVerdict = true;
                    await resolveSigned({ url: 'x' }, [oldRow, youngRow, purgedRow, knownRow]);
                    ok('⛔ សួរ `/detail` **តែជួរដេកចាស់ដែលវាស់មិនទាន់**',
                        calls.probe.length === 1 && calls.probe[0] === '77130500000841', calls.probe);
                    ok('⛔ សាលក្រមដែលវាស់បាន ត្រូវឈ្នះលើជួរដេកបញ្ជី ➜ ចាត់ថ្នាក់ជា «ថ្មី»',
                        classifyReal([oldRow], [], []).fresh.length === 1,
                        classifyReal([oldRow], [], []).skipped);

                    reset();
                    box.__now = NOW;
                    box.__probeThrows = true;
                    await resolveSigned({ url: 'x' }, [oldRow]);
                    ok('⛔ **ការធ្លាក់មិនត្រូវចងចាំជាសាលក្រម** ➜ ជួរដេកនៅជា «វាស់មិនបាន» ⛔ មិនមែន «មិនទាន់បិទ» (ការចងចាំ `false` ➜ ZTO ដាច់មួយភ្លែត = កញ្ចប់រំលងជារៀងរហូត)',
                        (classifyReal([oldRow], [], []).skipped[0] || {}).skip === 'too-old-unknown',
                        classifyReal([oldRow], [], []).skipped);

                    reset();
                    box.__now = NOW;
                    box.__probeVerdict = true;
                    const many = [];
                    for (let i = 0; i < box.__probeMax + 5; i++) {
                        many.push({ barcode: '7713050000' + (9000 + i), phone: '0963897345', cod: 1, dod: 0, at: oldAt, skip: '' });
                    }
                    await resolveSigned({ url: 'x' }, many);
                    ok('⛔ ការសួរមានពិដាន (`ZTO_LIST_SIGNED_PROBE_MAX`) ➜ បញ្ជីវែងមិនក្លាយជាការហៅរាប់រយ',
                        calls.probe.length === box.__probeMax, calls.probe.length);

                    reset();
                    box.__now = NOW;
                    box.__probeVerdict = true;
                    box.navigator.onLine = false;
                    await resolveSigned({ url: 'x' }, [oldRow]);
                    ok('⛔ ក្រៅបណ្ដាញ ➜ មិនសួរសោះ', calls.probe.length === 0, calls.probe);
                    box.navigator.onLine = true;
                    reset();
                    box.__now = NOW;
                }

                // ⛔ តម្រងលំនាំដើមជា «ថ្ងៃនេះ» ➜ កញ្ចប់ដែលចុះលើថ្ងៃ ZTO ចាស់
                // **មិនលេចក្នុងតារាង** ➜ អ្នកប្រើជឿថាការបញ្ចូលបរាជ័យ។ សារ
                // ត្រូវប្រាប់ថ្ងៃដែលវាចុះ ⛔ មិនមែនត្រឹមចំនួន។
                reset();
                box.__now = NOW;
                box.ztoListSyncResult = {
                    rows: [
                        { barcode: '77130500000811', phone: '0963897345', cod: 1, dod: 0, at: zoneText(NOW - 2 * 86400000), skip: '' },
                        { barcode: '77130500000813', phone: '0963897347', cod: 1, dod: 0, at: zoneText(NOW - 2 * 86400000 + 3600000), skip: '' },
                        { barcode: '77130500000812', phone: '0963897346', cod: 1, dod: 0, at: zoneText(NOW - 86400000), skip: '' }
                    ],
                    from: '2026-09-08', to: '2026-09-11', total: 3
                };
                await runImport();
                const lastToast = calls.toast[calls.toast.length - 1] || '';
                ok('⛔ សារបញ្ចប់ត្រូវរាយ **ថ្ងៃដែលកញ្ចប់ចុះ** (បើអត់ ➜ តម្រង «ថ្ងៃនេះ» បង្ហាញទទេ ➜ អ្នកប្រើជឿថាបរាជ័យ)',
                    lastToast.indexOf('2026-09-09') !== -1 && lastToast.indexOf('2026-09-10') !== -1,
                    lastToast);
                ok('⛔ ថ្ងៃត្រូវតម្រៀប និងមិនស្ទួន (កញ្ចប់ច្រើនក្នុងថ្ងៃដដែល ➜ ថ្ងៃម្តង)',
                    (lastToast.match(/2026-09-09/g) || []).length === 1
                    && lastToast.indexOf('2026-09-09') < lastToast.indexOf('2026-09-10'), lastToast);
                reset();

                // ═════════════════════════════════════════════════════════
                // ⛔ **ភស្តុតាង «ចុះហត្ថលេខា» (ZTO Palm) ➜ ស្ថិតិយកដូចបិទដោយដៃ ១០០%** (សំណើម្ចាស់គម្រោង ZoeW 2.50.0)
                // ═════════════════════════════════════════════════════════
                // ជួរដេក **ក្មេង** ដែល barcode ស្ថិតក្នុងបញ្ជី «ចុះហត្ថលេខា» ➜ កើតមកជាបិទ (អាគុយម៉ង់ទី ៧) ➜ ស្ថិតិយកតាម
                // `applyBarcodeCloseChange()` (ទ្វារដដែលនឹងការចុចបិទដោយដៃ) · កញ្ចប់ **មានក្នុង ZoeW ហើយនៅបើក** ➜ បិទតាមទ្វារដដែល
                // (គោរពកុងតាក់ «បិទតាម ZTO ស្វ័យប្រវត្តិ») · ⛔ គ្មាន claim/ការរក្សាទុកទី ២ · ⛔ កញ្ចប់បិទស្រាប់មិនប៉ះ។
                const evidence = box.__signedEvidence;
                ok('ជាន់អប្បបរមា ៖ `ztoListSignedEvidence` មានក្នុង `app.js` ពិត',
                    !!extractConst(APP_SRC, 'ztoListSignedEvidence'), !!extractConst(APP_SRC, 'ztoListSignedEvidence'));
                const youngAt = zoneText(NOW - 86400000);
                reset();
                box.__now = NOW;
                evidence.add('77130500000851');
                box.ztoListSyncResult = {
                    rows: [{ barcode: '77130500000851', phone: '0963897345', cod: 3, dod: 1, at: youngAt, skip: '', ztoClosed: null },
                        { barcode: '77130500000852', phone: '0963897345', cod: 2, dod: 0, at: youngAt, skip: '', ztoClosed: null }],
                    from: '2026-09-08', to: '2026-09-11', total: 2
                };
                await runImport();
                const savedSigned = calls.save.find((c) => c.code === '77130500000851') || {};
                const savedOpen = calls.save.find((c) => c.code === '77130500000852') || {};
                ok('⛔ ជួរដេកក្មេងដែល ZTO ចុះហត្ថលេខា ➜ **កើតមកជាបិទ** (ត្រាបិទ = ម៉ោងឥឡូវ)',
                    savedSigned.closedAtMs === NOW, savedSigned);
                ok('⛔ ទិសផ្ទុយ ៖ ជួរដេកក្រៅបញ្ជីចុះហត្ថលេខា ➜ **នៅបើក** («គ្មានភស្តុតាង ≠ បិទរួច»)',
                    savedOpen.closedAtMs === 0, savedOpen);
                ok('⛔ ស្ថិតិយកតាម **ទ្វារតែមួយ** `applyBarcodeCloseChange()` (ស្ងាត់ · មិនបើកប្រអប់) ➜ ដូចបិទដោយដៃ',
                    calls.close.length === 1 && calls.close[0].code === '77130500000851' && calls.close[0].closed === true
                    && !!calls.close[0].opts && calls.close[0].opts.silent === true && calls.close[0].opts.showModal === false,
                    calls.close);
                ok('⛔ លុយចុះលើថ្ងៃស្កេន ZTO ដដែល (COD/DOD ឆ្លងកាត់បេះបិទ)',
                    savedSigned.stampMs === stampOf(youngAt) && savedSigned.cod === 3 && savedSigned.dod === 1, savedSigned);
                // ⛔ E2 ៖ ភស្តុតាង «ចុះហត្ថលេខា» (ZTO Palm) = យករួច (ម្ចាស់គម្រោងបញ្ជាក់) ➜ ឈ្នះ `ztoClosed:false` របស់ជួរដេក និង `/detail` false
                //    ដូចជុំ «បិទតាម ZTO ស្វ័យប្រវត្តិ» (`closeZtoSignedBarcodes()` រត់មុនរង្វិល `/detail` · សាលក្រម false មិនទប់)។
                reset();
                box.__now = NOW;
                ['77130500000855', '77130500000856', '77130500000857', '77130500000859'].forEach((c) => evidence.add(c));
                box.__signedProbe.set('77130500000856', false);
                const e2Row = (code, at, ztoClosed) => ({ barcode: code, phone: '0963897345', cod: 1, dod: 0, at: at, skip: '', ztoClosed: ztoClosed });
                const e2 = classifyReal([
                    e2Row('77130500000855', youngAt, false),
                    e2Row('77130500000856', youngAt, null),
                    e2Row('77130500000857', oldAt, false),
                    e2Row('77130500000858', oldAt, false),
                    e2Row('77130500000859', zoneText(NOW - RET - 60000), false)
                ], [], []);
                const e2Fresh = (code) => e2.fresh.find((r) => r.barcode === code) || {};
                const e2Skip = (code) => (e2.skipped.find((r) => r.barcode === code) || {}).skip;
                ok('⛔ E2 ៖ ភស្តុតាងចុះហត្ថលេខា **ឈ្នះ** `ztoClosed:false` របស់ជួរដេក ➜ កើតមកជា «យករួច»',
                    e2Fresh('77130500000855').closedAtZto === true, e2Fresh('77130500000855'));
                ok('⛔ E2 ៖ ភស្តុតាងចុះហត្ថលេខា **ឈ្នះ** `/detail` false',
                    e2Fresh('77130500000856').closedAtZto === true, e2Fresh('77130500000856'));
                ok('⛔ E2 ៖ ជួរដេកចាស់ + false + ភស្តុតាង ➜ «ថ្មី» យករួច (មិនមែន `too-old-open`)',
                    e2Fresh('77130500000857').closedAtZto === true, e2.skipped);
                ok('⛔ E2 ទិសផ្ទុយ ៖ ចាស់ + false + **គ្មាន** ភស្តុតាង ➜ `too-old-open`',
                    e2Skip('77130500000858') === 'too-old-open', e2.skipped);
                ok('⛔ E2 ទិសផ្ទុយ ៖ ហួសអាយុធុងសំរាម ➜ `too-old-purged` **ទោះមានភស្តុតាង** (ពិនិត្យស្ទួនមិនបាន)',
                    e2Skip('77130500000859') === 'too-old-purged', e2.skipped);
                reset();
                box.__now = NOW;
                evidence.add('77130500000855');
                box.ztoListSyncResult = { rows: [e2Row('77130500000855', youngAt, false)], from: '2026-09-08', to: '2026-09-11', total: 1 };
                await runImport();
                ok('⛔ E2 ៖ ការបញ្ចូល ៖ false + ភស្តុតាង ➜ រក្សាទុកជាបិទ (ត្រាបិទ = ឥឡូវ) + ស្ថិតិយកតាម `applyBarcodeCloseChange()`',
                    calls.save.length === 1 && calls.save[0].closedAtMs === NOW
                    && calls.close.length === 1 && calls.close[0].code === '77130500000855', { save: calls.save, close: calls.close });
                reset();
                box.__now = NOW;
                evidence.add('77130500000865');
                box.scanHistory = [{ id: 'open-e2', phone: '0963897345', barcodes: [{ code: '77130500000865', isClosed: false }] }];
                box.ztoListSyncResult = { rows: [e2Row('77130500000865', youngAt, false)], from: '2026-09-08', to: '2026-09-11', total: 1 };
                await runImport();
                ok('⛔ E2 ៖ មានក្នុង ZoeW (បើក) + false + ភស្តុតាង ➜ «បញ្ចូល» បិទ (ទ្វារដូចជុំស្វ័យប្រវត្តិ)',
                    calls.close.length === 1 && calls.close[0].itemId === 'open-e2' && calls.save.length === 0, calls.close);

                reset();
                box.__now = NOW;
                evidence.add('77130500000861');
                evidence.add('77130500000862');
                box.scanHistory = [
                    { id: 'open-1', phone: '0963897345', barcodes: [{ code: '77130500000861', isClosed: false }] },
                    { id: 'done-1', phone: '0963897345', barcodes: [{ code: '77130500000862', isClosed: true }] }
                ];
                box.ztoListSyncResult = {
                    rows: [{ barcode: '77130500000861', phone: '0963897345', cod: 1, dod: 0, at: youngAt, skip: '' },
                        { barcode: '77130500000862', phone: '0963897345', cod: 1, dod: 0, at: youngAt, skip: '' }],
                    from: '2026-09-08', to: '2026-09-11', total: 2
                };
                await runImport();
                ok('⛔ កញ្ចប់ **មានក្នុង ZoeW ហើយនៅបើក** + ZTO ចុះហត្ថលេខា ➜ បិទតាម `applyBarcodeCloseChange()` (ដូចចុចបិទដោយដៃ)',
                    calls.close.length === 1 && calls.close[0].itemId === 'open-1' && calls.close[0].code === '77130500000861'
                    && calls.close[0].closed === true, calls.close);
                ok('⛔ មិនមែនការបញ្ចូលទី ២ ៖ គ្មាន claim · គ្មានការរក្សាទុក (កញ្ចប់មានរួច)',
                    calls.claim.length === 0 && calls.save.length === 0, { claim: calls.claim, save: calls.save });
                ok('⛔ សាលក្រម «ZTO បិទរួច» ត្រូវកត់ (ជុំពិនិត្យមិនសួរម្តងទៀត)',
                    calls.verdict.some((v) => v.code === '77130500000861' && v.closed === true), calls.verdict);
                ok('⛔ សារបញ្ចប់រាប់ «បិទតាម ZTO»', calls.toast.some((m) => m.indexOf('បិទតាម ZTO 1') !== -1), calls.toast);

                reset();
                box.__now = NOW;
                box.__autoClose = false;
                evidence.add('77130500000861');
                box.scanHistory = [{ id: 'open-1', phone: '0963897345', barcodes: [{ code: '77130500000861', isClosed: false }] }];
                box.ztoListSyncResult = {
                    rows: [{ barcode: '77130500000861', phone: '0963897345', cod: 1, dod: 0, at: youngAt, skip: '' }],
                    from: '2026-09-08', to: '2026-09-11', total: 1
                };
                await runImport();
                ok('⛔ ទិសផ្ទុយ ៖ កុងតាក់ «បិទតាម ZTO ស្វ័យប្រវត្តិ» បិទ ➜ មិនបិទកញ្ចប់ដែលមានស្រាប់',
                    calls.close.length === 0, calls.close);

                // ⛔ ថ្នាក់ដដែលនឹង ZTO-G4 ៖ ការបិទដែល **ព្យួរ** (`applyBarcodeCloseChange()` ➜ `undefined` = commit យឺតបានចាក់) ➜ ឈប់ភ្លាម
                //    (បន្ត ➜ កញ្ចប់នីមួយៗរង់ចាំពិដាន ១៥ វិ. ➜ សោ «⏳ កំពុងដំណើរការ» ជាប់យូរ) · សារប្រាប់ «⏳» + «មិនទាន់បិទ» · បញ្ជីនៅ
                reset();
                box.__now = NOW;
                box.__closeHangs = true;
                evidence.add('77130500000871');
                evidence.add('77130500000872');
                box.scanHistory = [
                    { id: 'open-a', phone: '0963897345', barcodes: [{ code: '77130500000871', isClosed: false }] },
                    { id: 'open-b', phone: '0963897345', barcodes: [{ code: '77130500000872', isClosed: false }] }
                ];
                box.ztoListSyncResult = {
                    rows: [{ barcode: '77130500000871', phone: '0963897345', cod: 1, dod: 0, at: youngAt, skip: '' },
                        { barcode: '77130500000872', phone: '0963897345', cod: 1, dod: 0, at: youngAt, skip: '' }],
                    from: '2026-09-08', to: '2026-09-11', total: 2
                };
                await runImport();
                ok('⛔ ការបិទព្យួរដំបូង ➜ **ឈប់** (មិនរង់ចាំពិដានលើកញ្ចប់បន្ទាប់)', calls.close.length === 1, calls.close);
                ok('⛔ ការបិទព្យួរ ➜ សារប្រាប់ «⏳» និង «មិនទាន់បិទ 1» · បញ្ជីនៅ',
                    calls.toast.some((m) => m.indexOf('⏳') !== -1 && m.indexOf('មិនទាន់បិទ 1') !== -1) && !!box.ztoListSyncResult,
                    calls.toast);
                ok('⛔ ការបិទព្យួរ ➜ សោដោះ', box.ztoListSyncInFlight === false, box.ztoListSyncInFlight);

                // ⛔ ថ្នាក់ដដែល ៖ ការរក្សាទុក/claim **ព្យួរលើជួរដេកថ្មីចុងក្រោយ** (គ្មាន «នៅសល់» ក្នុងរង្វិលបញ្ចូល) ក៏ជាសញ្ញាបណ្តាញព្យួរដែរ ➜
                //    រង្វិលបិទកញ្ចប់ដែលមានស្រាប់ត្រូវឈប់ភ្លាម (មិនសាកបិទ ➜ រង់ចាំពិដានម្តងទៀត) · សារប្រាប់ «មិនទាន់បិទ» · បញ្ជីនៅ ➜ ចុចម្តងទៀតបាន។
                const hangThenClose = async (label) => {
                    reset();
                    box.__now = NOW;
                    if (label === 'Save timed out') box.__saveHangs = true; else box.__claimHangs = true;
                    box.__timeoutLabel = label;
                    evidence.add('77130500000892');
                    box.scanHistory = [{ id: 'open-z', phone: '0963897345', barcodes: [{ code: '77130500000892', isClosed: false }] }];
                    box.ztoListSyncResult = {
                        rows: [{ barcode: '77130500000891', phone: '0963897345', cod: 1, dod: 0, at: youngAt, skip: '' },
                            { barcode: '77130500000892', phone: '0963897345', cod: 1, dod: 0, at: youngAt, skip: '' }],
                        from: '2026-09-08', to: '2026-09-11', total: 2
                    };
                    await runImport();
                    return { close: calls.close.slice(), toast: calls.toast.slice(), kept: !!box.ztoListSyncResult,
                        saved: calls.save.length, claimed: calls.claim.length, unlocked: box.ztoListSyncInFlight === false };
                };
                const saveHang = await hangThenClose('Save timed out');
                ok('ជាន់អប្បបរមា ៖ ជួរដេកថ្មីត្រូវ claim + រក្សាទុក (ការព្យួរកើតលើជួរដេកចុងក្រោយពិត)',
                    saveHang.claimed === 1 && saveHang.saved === 1, saveHang);
                ok('⛔ ការរក្សាទុក **ព្យួរលើជួរដេកថ្មីចុងក្រោយ** ➜ មិនសាកបិទកញ្ចប់ដែលមានស្រាប់ · «មិនទាន់បិទ 1» · បញ្ជីនៅ · សោដោះ',
                    saveHang.close.length === 0 && saveHang.toast.some((m) => m.indexOf('មិនទាន់បិទ 1') !== -1)
                    && saveHang.kept && saveHang.unlocked, saveHang);
                const claimHang = await hangThenClose('Barcode claim timed out');
                ok('⛔ claim **ព្យួរលើជួរដេកថ្មីចុងក្រោយ** ➜ មិនសាកបិទកញ្ចប់ដែលមានស្រាប់ · «មិនទាន់បិទ 1» · បញ្ជីនៅ',
                    claimHang.claimed === 1 && claimHang.close.length === 0
                    && claimHang.toast.some((m) => m.indexOf('មិនទាន់បិទ 1') !== -1) && claimHang.kept, claimHang);
                reset();
                box.__now = NOW;
                evidence.add('77130500000892');
                box.scanHistory = [{ id: 'open-z', phone: '0963897345', barcodes: [{ code: '77130500000892', isClosed: false }] }];
                box.ztoListSyncResult = {
                    rows: [{ barcode: '77130500000891', phone: '0963897345', cod: 1, dod: 0, at: youngAt, skip: '' },
                        { barcode: '77130500000892', phone: '0963897345', cod: 1, dod: 0, at: youngAt, skip: '' }],
                    from: '2026-09-08', to: '2026-09-11', total: 2
                };
                await runImport();
                ok('ទិសផ្ទុយ ៖ ជួរដេកថ្មីរក្សាទុកបានធម្មតា ➜ កញ្ចប់ដែលមានស្រាប់ត្រូវបិទ (ការឈប់កើតតែពេលព្យួរ)',
                    calls.close.length === 1 && calls.close[0].code === '77130500000892', calls.close);
                box.scanHistory = [];
                reset();
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ១៧. \u26d4 `addOrUpdateEntry()` \u1796\u17b7\u178f \u17d6 \u178f\u17d2\u179a\u17b6 ZTO \u1793\u17b6\u17c6\u179b\u17bb\u1799\u1791\u17c5\u1790\u17d2\u1784\u17c3\u178e\u17b6 ==');
    // ═════════════════════════════════════════════════════════════════════
    // ⛔ **នេះជាស្នាមភ្ជាប់ដែលប៉ះលុយ** ៖ `addOrUpdateEntry()` យក `dateString`
    // ទៅ `addRevenueToDailyAndMonthlyRecord()` ➜ ថ្ងៃណាដែលវាជ្រើស គឺជាថ្ងៃ
    // ដែល **លុយចុះ** និងជាថ្ងៃដែល **ledger ខែ** បូកចូល។ checker ដែលវាស់តែ
    // `importZtoListRows` មើលមិនឃើញថ្នាក់នេះទេ ព្រោះ sandbox របស់វា **stub
    // `addOrUpdateEntry` ចោល** ➜ ការបម្លែងត្រា ➜ ថ្ងៃ គ្មានអ្នកវាស់សោះ។
    const ENTRY_NAMES = ['addOrUpdateEntry', 'getZoneDateKey', 'getFormattedClockTime',
        'appZoneParts', 'appZoneWallClockToMillis', 'ztoScanStampMillis',
        'getFormattedDate', 'normalizeBarcodesOf', 'barcodeEntriesOf',
        'recalcItemMoneyFromBarcodes', 'applyBarcodeCloseState'];
    const entryParts = ENTRY_NAMES.map((name) => fnOrStub(APP_SRC, name));
    const entryMissingNames = ENTRY_NAMES.filter((name) => !extractFn(APP_SRC, name));
    ok('ជាន់អប្បបរមា ៖ ស្រង់ `addOrUpdateEntry` និងផ្លូវនាឡិកាពិតបាន',
        entryMissingNames.length === 0, entryMissingNames);
    const ENTRY_CONST_NAMES = ['APP_TIME_ZONE', 'APP_TIME_ZONE_OFFSET_MINUTES'];
    const entryConsts = ENTRY_CONST_NAMES.map((name) => constOrStub(APP_SRC, name));
    ok('ជាន់អប្បបរមា ៖ ថេរតំបន់ម៉ោងអានចេញពីកូដពិត',
        ENTRY_CONST_NAMES.every((name) => !!extractConst(APP_SRC, name)), entryConsts);

    {
        const seen = { ledgerDays: [], saved: [], merged: [] };
        const ebox = {
            console: console,
            scanHistory: [],
            getServerNow: () => ebox.__now,
            addRevenueToDailyAndMonthlyRecord: (dateStr, cod, dod, count) => {
                seen.ledgerDays.push(dateStr);
                return { scanDate: dateStr, cod, dod, count };
            },
            correctRevenueLedgerToActual: () => Promise.resolve({ ok: true }),
            revertRevenueLedgerDelta: () => {},
            generateUniqueId: () => 'id-' + (seen.saved.length + 1),
            mergeBarcodeIntoHistoryItem: (id, apply, item) => Promise.resolve(apply(item)),
            saveSingleHistoryItemToFirebase: (item) => { seen.saved.push(item); return Promise.resolve(item); },
            refreshCurrentHistoryView: () => {},
            showToast: () => {},
            updateRecentPhonesList: () => {}
        };
        ebox.globalThis = ebox;
        ebox.window = ebox;
        let runEntry = null;
        try {
            vm.createContext(ebox);
            vm.runInContext(entryConsts.join('\n') + '\n' + entryParts.join('\n')
                + '\nglobalThis.__entry = addOrUpdateEntry;'
                + '\nglobalThis.__stamp2 = ztoScanStampMillis;'
                + '\nglobalThis.__zoneOffsetMin = APP_TIME_ZONE_OFFSET_MINUTES;'
                + '\nglobalThis.__dayKey = getZoneDateKey;', ebox);
            runEntry = ebox.__entry;
        } catch (e) {
            ok('sandbox នៃ `addOrUpdateEntry` រត់បាន', false, String(e && e.message));
        }
        ok('⛔ `addOrUpdateEntry` រត់ក្នុង sandbox បាន', typeof runEntry === 'function', typeof runEntry);

        if (typeof runEntry === 'function') {
            // ⛔ ត្រាត្រូវគណនា **ដោយឯករាជ្យ** ពី `ztoScanStampMillis()` ៖ បើ
            // checker ប្រើវាជាទាំងប្រភព និងជាអ្វីដែលវាវាស់ នោះជាការស៊ីគ្នា
            // ដោយចៃដន្យ។ offset ដេរីវេពីថេរក្នុងកូដពិត មិនមែនលេខរឹង។
            const zoneMs = (y, mo, d, h, mi, se) =>
                Date.UTC(y, mo - 1, d, h, mi, se) - ebox.__zoneOffsetMin * 60000;
            const SYNC_AT = zoneMs(2026, 9, 12, 8, 30, 0);
            const ZTO_AT = zoneMs(2026, 9, 10, 14, 23, 11);
            ok('⛔ ផ្លូវបម្លែង ២ ឯករាជ្យឲ្យត្រាដដែល (`ztoScanStampMillis` ↔ offset ក្នុងកូដ)',
                ebox.__stamp2('2026-09-10 14:23:11') === ZTO_AT, ebox.__stamp2('2026-09-10 14:23:11'));
            ebox.__now = SYNC_AT;

            await runEntry('77130500000701', '0963897345', 6.47, 0, 'N/A', ZTO_AT);
            const first = seen.saved[0] || {};
            ok('⛔ **លុយចុះលើថ្ងៃស្កេន ZTO** មិនមែនថ្ងៃ sync',
                seen.ledgerDays[0] === '2026-09-10', seen.ledgerDays);
            ok('⛔ `scanDate` = ថ្ងៃស្កេន ZTO', first.scanDate === '2026-09-10', first.scanDate);
            ok('⛔ `time` = ម៉ោងស្កេន ZTO បេះបិទ (ទម្រង់រក្សាដដែល)',
                first.time === '14:23:11 (2026-09-10)', first.time);
            ok('⛔ `createdAt` = ត្រា ZTO (នាឡិកា ៨ ថ្ងៃដើរតាមវា)',
                first.createdAt === ZTO_AT, first.createdAt);
            ok('⛔ `barcodes[0].createdAt` ក៏ជាត្រា ZTO ដែរ',
                first.barcodes && first.barcodes[0] && first.barcodes[0].createdAt === ZTO_AT,
                first.barcodes && first.barcodes[0]);
            ok('⛔ `barcodes[0].time` ក៏ជាម៉ោង ZTO ដែរ',
                first.barcodes && first.barcodes[0] && first.barcodes[0].time === '14:23:11 (2026-09-10)',
                first.barcodes && first.barcodes[0]);

            // ⛔ ទិសផ្ទុយ ៖ ផ្លូវស្កេនដោយដៃ (គ្មានអាគុយម៉ង់ទី ៦) **មិនត្រូវប្រែ**
            seen.ledgerDays.length = 0; seen.saved.length = 0; ebox.scanHistory.length = 0;
            await runEntry('77130500000702', '0963897346', 1, 0, 'N/A');
            ok('⛔ ទិសផ្ទុយ ៖ គ្មានត្រា ➜ ថ្ងៃ sync ដដែល (ការស្កេនដោយដៃមិនប្រែ)',
                seen.ledgerDays[0] === '2026-09-12'
                && (seen.saved[0] || {}).createdAt === SYNC_AT, [seen.ledgerDays, (seen.saved[0] || {}).createdAt]);

            seen.ledgerDays.length = 0; seen.saved.length = 0; ebox.scanHistory.length = 0;
            await runEntry('77130500000703', '0963897347', 1, 0, 'N/A', 0);
            await runEntry('77130500000704', '0963897348', 1, 0, 'N/A', NaN);
            await runEntry('77130500000705', '0963897349', 1, 0, 'N/A', -5);
            ok('⛔ ត្រាមិនត្រឹមត្រូវ (`0` · `NaN` · អវិជ្ជមាន) ➜ ធ្លាក់ចុះទៅម៉ោង sync',
                seen.ledgerDays.join(',') === '2026-09-12,2026-09-12,2026-09-12', seen.ledgerDays);

            // ⛔ អតិថិជនម្នាក់ · ថ្ងៃ ZTO ២ ➜ ជួរដេក ២ · ថ្ងៃ ledger ២
            seen.ledgerDays.length = 0; seen.saved.length = 0; ebox.scanHistory.length = 0;
            await runEntry('77130500000706', '0963897350', 2, 0, 'N/A', zoneMs(2026, 9, 9, 8, 0, 0));
            await runEntry('77130500000707', '0963897350', 3, 0, 'N/A', zoneMs(2026, 9, 10, 8, 0, 0));
            ok('⛔ អតិថិជនតែម្នាក់ · ថ្ងៃស្កេន ZTO ២ ➜ **មិន merge** (កូនសោ merge = `phone`+`scanDate`)',
                seen.saved.length === 2, seen.saved.length);
            ok('⛔ ហើយលុយបែកចូល ledger **២ ថ្ងៃ** តាម ZTO',
                seen.ledgerDays.join(',') === '2026-09-09,2026-09-10', seen.ledgerDays);

            // ⛔ អតិថិជនម្នាក់ · ថ្ងៃ ZTO តែមួយ ➜ merge ចូលជួរដេកតែមួយ
            seen.ledgerDays.length = 0; seen.saved.length = 0; ebox.scanHistory.length = 0;
            await runEntry('77130500000708', '0963897351', 2, 0, 'N/A', zoneMs(2026, 9, 10, 8, 0, 0));
            await runEntry('77130500000709', '0963897351', 3, 0, 'N/A', zoneMs(2026, 9, 10, 19, 45, 0));
            ok('⛔ ថ្ងៃស្កេន ZTO ដដែល ➜ merge ចូលជួរដេកតែមួយ (`count` = 2)',
                ebox.scanHistory.length === 1 && ebox.scanHistory[0].count === 2,
                ebox.scanHistory.map((i) => i.count));
            ok('⛔ លុយសរុបរបស់ជួរដេក = ផលបូក barcodes ($5.00)',
                ebox.scanHistory[0] && ebox.scanHistory[0].cod === 5, ebox.scanHistory[0]);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    console.log('\n== ១៨. ⛔ client ៖ ផ្ញើ ID token · លែងផ្ញើ `?site=` ==');
    // ══════════════════════════════════════════════════════════════════════
    //
    // ជំនាន់មុននៃផ្នែកនេះវាស់ស្នាមភ្ជាប់ «លេខសាខាក្នុង ZoeW ↔ parameter
    // `site` របស់ Function»។ ស្នាមភ្ជាប់នោះ **ត្រូវដកចេញ** ៖ លេខសាខាដែល
    // ធ្វើដំណើរជា parameter ជាព្រំដែនក្លែងក្លាយ។ អ្វីដែលត្រូវចាក់សោឥឡូវគឺ
    // ទិសផ្ទុយ ៖ client **មិនត្រូវ** ផ្ញើលេខសាខា ហើយ **ត្រូវ** ផ្ញើ token។
    {
        const urlFn = extractFn(APP_SRC, 'buildZtoListApiUrl') || '';
        const fetchFn = extractFn(APP_SRC, 'fetchZtoListPage') || '';
        const enabledFn = extractFn(APP_SRC, 'ztoListSyncEnabled') || '';
        ok('⛔ ស្រង់ផ្លូវបញ្ជីខាង client ចេញពី `app.js` បាន',
            !!urlFn && !!fetchFn && !!enabledFn,
            { url: urlFn.length, fetch: fetchFn.length, enabled: enabledFn.length });

        ok('⛔ URL បញ្ជី **លែងផ្ទុក `site=`** (server បោះចោលវា ➜ ការផ្ញើ = ការកុហក)',
            urlFn.indexOf('site=') === -1, urlFn.slice(0, 200));
        ok('⛔ URL នៅផ្ទុក `list=1` · ជួរកាលបរិច្ឆេទ · ទំព័រ ដដែល',
            urlFn.indexOf('list=1') !== -1 && urlFn.indexOf('from=') !== -1
            && urlFn.indexOf('to=') !== -1 && urlFn.indexOf('page=') !== -1, urlFn.slice(0, 200));

        ok('⛔ `fetchZtoListPage` ភ្ជាប់ header `X-Zoe-Id-Token`',
            /X-Zoe-Id-Token/.test(fetchFn), fetchFn.slice(0, 260));
        ok('⛔ គ្មាន token ➜ **បោះ** `notConfigured` មុនប៉ះបណ្តាញ',
            /idtoken:missing/.test(fetchFn) && /notConfigured/.test(fetchFn), fetchFn.slice(0, 400));

        // ⛔ ទិសផ្ទុយ ៖ មុខងារលែងអាស្រ័យលើលេខសាខាក្នុងឧបករណ៍
        ok('⛔ `ztoListSyncEnabled()` លែងទាមទារលេខសាខាក្នុងឧបករណ៍',
            enabledFn.indexOf('ztoListSiteCode') === -1, enabledFn);

        // ⛔ **ផ្ទៃដែលកុហកត្រូវបាត់ទាំងស្រុង** ៖ វាលបញ្ចូលលេខសាខាដែលនៅរស់
        // ខណៈ server បោះចោលតម្លៃរបស់វា ជា UI ដែលកុហកអ្នកប្រើ។
        const dead = ['ztoListSiteCode', 'openZtoListSiteModal', 'saveZtoListSiteCode',
            'closeZtoListSiteModal', 'zoew_zto_list_site_v1'];
        const left = dead.filter((name) => APP_SRC.indexOf(name) !== -1);
        ok('⛔ ផ្ទៃបញ្ចូលលេខសាខាដោយដៃ ត្រូវដកចេញទាំងស្រុងពី `app.js`',
            left.length === 0, left.join(' · '));
        const leftHtml = ['ztoListSiteModal', 'ztoListSiteInput']
            .filter((name) => HTML_SRC.indexOf(name) !== -1);
        ok('⛔ ហើយប្រអប់របស់វាត្រូវដកចេញពី `index.html` ដែរ',
            leftHtml.length === 0, leftHtml.join(' · '));
    }

    // ========================================================================
    // ផ្នែក ១៩ — ⛔ **លេខសាខាមកពីអត្តសញ្ញាណ មិនមែនពី parameter របស់ client**
    // ========================================================================
    //
    // 🔴 ការវាស់របស់ម្ចាស់គម្រោង ៖ Cookie `BOS-MAN-SESSION` ផ្ទុកសិទ្ធិអាន
    // **ទូទាំងប្រទេស** មិនមែនត្រឹមសាខាដែល login ➜ ការអះអាងចាស់ «ZTO ជាអ្នក
    // បញ្ចាំងពិត» **ខុស**។ `listSiteCodeOf()` ត្រួតពិនិត្យតែ **រូបរាង** ➜
    // អ្នកកាន់ `ZTO_PROXY_KEY` (សោដែល **ចែករំលែក** ទៅគ្រប់ឧបករណ៍) អាចអាន
    // បញ្ជីរបស់សាខា **ណាក៏បាន** ដោយហៅ Function ដោយផ្ទាល់ — មិនបាច់បើក ZoeW ផង។
    //
    // ⛔ ដូច្នេះការចងលេខសាខានឹង email **ខាង client** មិនមែនជាការការពារទេ ៖
    // លេខនោះធ្វើដំណើរជា parameter ដែល client គ្រប់គ្រង។ អ្នកសម្រេចត្រូវផ្លាស់
    // ទៅ **server** ➜ Firebase **ID token** (ហត្ថលេខា RS256) ជាប្រភពតែមួយ។
    //
    // ⛔ ការវាស់ជាការរត់ handler **ពិត** ជាមួយ token ចុះហត្ថលេខាពិត។
    {
    const PROJECT = TEST_PROJECT;

    async function listTok(token, query, env) {
        resetEnv(env || {});
        seenRequests.length = 0;
        global.fetch = responder(listPayload([listRow()]));
        // ⛔ `''` ជាសញ្ញា «គ្មាន token ដោយចេតនា» ➜ ការបញ្ជូន header ទទេ
        // ទប់ការបំពេញស្វ័យប្រវត្តិរបស់ `call()`។
        const res = await call(listQuery(query), { 'x-zoe-id-token': token || '' });
        let body = null;
        try { body = JSON.parse(res.body); } catch (e) { body = null; }
        return { res: res, body: body };
    }

    const siteSent = () => {
        const hit = seenRequests[seenRequests.length - 1];
        if (!hit || !hit.init || !hit.init.body) return '';
        try {
            const b = JSON.parse(hit.init.body);
            return String((b && b.condition && b.condition.scanSiteCode) || b.scanSiteCode || '');
        } catch (e) { return ''; }
    };
    const ztoCalls = () => seenRequests.length;

    console.log('\n== ១៩. លេខសាខាមកពី ID token មិនមែនពី `?site=` ==');

    // ⛔ ការអះអាងស្នូល ៖ `?site=` ដែល client ផ្ញើ ត្រូវ **បោះចោល**
    const hijack = await listTok(tokenFor('sok@zoew881859.com'), { site: '999999' });
    ok('⛔ លេខសាខាមកពី email ក្នុង token មិនមែនពី `?site=` របស់ client',
        siteSent() === '881859', { sent: siteSent(), body: hijack.body });
    ok('⛔ ទិសផ្ទុយ ៖ `?site=` ដែលក្លែង **មិន**ឡើងដល់ ZTO សោះ',
        siteSent() !== '999999', siteSent());

    const noTok = await listTok(null, {});
    ok('⛔ គ្មាន ID token ➜ បញ្ជីបិទ (HTTP 200 · `enabled:false` · គ្មានវាល `error`)',
        noTok.res.statusCode === 200 && !!noTok.body && noTok.body.enabled === false
        && noTok.body.error === undefined, noTok.body);
    ok('⛔ គ្មាន token ➜ គ្មានការហៅ ZTO សោះ', ztoCalls() === 0, ztoCalls());

    const forged = await listTok(tokenFor('x@zoew770022.com', { forge: true }), {});
    ok('⛔ ហត្ថលេខាក្លែងក្លាយ ➜ បដិសេធ', !!forged.body && forged.body.enabled === false, forged.body);
    ok('⛔ ហត្ថលេខាក្លែង ➜ គ្មានការហៅ ZTO', ztoCalls() === 0, ztoCalls());

    const wrongAud = await listTok(tokenFor('x@zoew770022.com', { aud: 'someone-else' }), {});
    ok('⛔ token របស់ Project ផ្សេង ➜ បដិសេធ', !!wrongAud.body && wrongAud.body.enabled === false, wrongAud.body);

    const expired = await listTok(tokenFor('x@zoew770022.com',
        { claims: { exp: Math.floor(Date.now() / 1000) - 120 } }), {});
    ok('⛔ token ផុតកំណត់ ➜ បដិសេធ', !!expired.body && expired.body.enabled === false, expired.body);

    const noSite = await listTok(tokenFor('user@zoew.com'), {});
    ok('⛔ email គ្មានលេខសាខា ➜ បញ្ជីបិទ ដោយប្រាប់មូលហេតុ',
        !!noSite.body && noSite.body.enabled === false && /site/.test(String(noSite.body.reason || '')), noSite.body);

    const noEnv = await listTok(tokenFor('sok@zoew881859.com'), {}, { FIREBASE_PROJECT_IDS: undefined });
    ok('⛔ `FIREBASE_PROJECT_IDS` មិនទាន់ដាក់ ➜ បញ្ជីបិទ (fail-closed)',
        !!noEnv.body && noEnv.body.enabled === false, noEnv.body);

    // ⛔ ទិសផ្ទុយដ៏សំខាន់ ៖ **ការស្កេនមិនត្រូវការ token សោះ**
    // (ច្បាប់ផ្ទះ ៖ លេខទូរស័ព្ទ និងលុយសំខាន់ជាងបញ្ជី ➜ ការស្កេនមិនត្រូវធ្លាក់)
    resetEnv({ FIREBASE_PROJECT_IDS: PROJECT });
    seenRequests.length = 0;
    global.fetch = responder({ success: true, data: { consigneeMobile: "855963897345", agentAmount: 1 } });
    const scanNoTok = await call({ barcode: '77130533910996' });
    ok('⛔ ទិសផ្ទុយ ៖ ការស្កេន **មិនត្រូវការ** ID token', scanNoTok.statusCode === 200, scanNoTok.statusCode);

    // ⛔ សាខា ២ មិនត្រូវចែក cache គ្នា (កូនសោផ្ទុកសាខាដែល *ដេរីវេ*)
    await listTok(tokenFor('a@zoew881859.com'), {});
    const siteA = siteSent();
    await listTok(tokenFor('b@zoew770022.com'), {});
    const siteB = siteSent();
    ok('⛔ សាខា ២ ➜ ការហៅ ZTO ២ ផ្សេងគ្នា (cache មិនលេចឆ្លងសាខា)',
        siteA === '881859' && siteB === '770022', { siteA: siteA, siteB: siteB });

    // ⛔ **លេខសាខាមានខ្ទង់ផ្សេងៗគ្នា** (សំណើម្ចាស់គម្រោង ៖ «លេខកូដសាខាខ្លះ ៥ ខ្ទង់»)
    // ➜ ការចាប់ត្រូវ **មិនចងនឹងចំនួនខ្ទង់** ៖ បញ្ជីរឹងនៃប្រវែង = សាខាថ្មីដែល
    // ខ្ទង់ខុស នឹងរអិតចេញស្ងាត់ៗ ហើយអ្នកប្រើឃើញត្រឹម «គណនីគ្មានសាខា»។
    for (const code of ['5', '88185', '881859', '1234567890', '123456789012345']) {
        await listTok(tokenFor('u@zoew' + code + '.com'), {});
        ok('⛔ លេខសាខា ' + code.length + ' ខ្ទង់ ➜ ចាប់បានត្រឹមត្រូវ (' + code + ')',
            siteSent() === code, { want: code, got: siteSent() });
    }

    // ⛔ ទិសផ្ទុយ ៖ អ្វីដែល **មិនមែន** លេខសាខា មិនត្រូវចាប់ខុស
    for (const bad of ['u@zoew.com', 'u@zoewabc.com', 'u@notzoew881859.com',
        'u@zoew881859.com.evil.com', 'u@zoew881859.net']) {
        const out = await listTok(tokenFor(bad), {});
        ok('⛔ `' + bad + '` ➜ គ្មានសាខា (មិនចាប់ខុស)',
            !!out.body && out.body.enabled === false, { email: bad, body: out.body });
    }

    // ⛔ email និង token មិនត្រូវលេចក្នុងចម្លើយ
    const leak = JSON.stringify(hijack.body || {});
    ok('⛔ email និង token មិនត្រូវលេចក្នុងចម្លើយ',
        leak.indexOf('zoew881859.com') === -1 && leak.indexOf('eyJ') === -1, leak.slice(0, 160));

    // ========================================================================
    // ផ្នែក ២០ — ⛔ **អត្តសញ្ញាណ Supabase (Project តែមួយ · ហាងច្រើន)** ៖ សាខា = `branch_code` របស់ **ហាង (tenant)**
    // ដែលអ្នកលក់កំណត់ពេលបង្កើតហាង ➜ Function សួរ `my_account` លើ Supabase **ដោយ token របស់អ្នកប្រើផ្ទាល់** (Supabase ផ្ទៀងហត្ថលេខា
    // + RLS) ⛔ មិនជឿ claim ណាមួយក្នុង token · `?site=` បោះចោលដូចផ្លូវ Firebase · ហាងផុតកំណត់/បិទ ➜ បញ្ជីបិទ · Supabase មិនឆ្លើយ ➜
    // បិទ (fail-closed) តែ **មិនចងចាំ** · issuer របស់ Project ផ្សេង ➜ មិនសួរ Supabase ទាល់តែសោះ · Secret key ក្នុង env ➜ មិនប្រើ
    // ========================================================================
    console.log('\n== ២០. អត្តសញ្ញាណ Supabase ➜ សាខាពីហាង (tenant) ==');
    const SB_URL = 'https://abcd1234.supabase.co';
    const SB_KEY = 'sb_publishable_' + 'q'.repeat(24);
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const sbToken = (sub, extra) => b64({ alg: 'ES256', typ: 'JWT', kid: 'k1' }) + '.' + b64(Object.assign({
        iss: SB_URL + '/auth/v1', aud: 'authenticated', role: 'authenticated', sub: sub,
        exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000)
    }, extra || {})) + '.' + Buffer.from('sig-' + sub).toString('base64url');
    const ACCOUNTS = {};
    const sbCalls = [];
    let sbMode = 'ok';
    function withSupabase(inner) {
        return async (href, init) => {
            if (String(href).indexOf(SB_URL) === 0) {
                const headers = (init && init.headers) || {};
                sbCalls.push({ href: String(href), apikey: headers.apikey, auth: headers.Authorization });
                if (sbMode === 'down') throw new TypeError('fetch failed');
                const token = String(headers.Authorization || '').replace(/^Bearer /, '');
                const acct = headers.apikey === SB_KEY ? ACCOUNTS[token] : undefined;
                if (acct === undefined) return { ok: false, status: 401, headers: { get: () => 'application/json' }, json: async () => ({ code: 'PGRST301' }) };
                return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => acct };
            }
            return inner(href, init);
        };
    }
    async function sbList(token, query, env) {
        resetEnv(Object.assign({ SUPABASE_URL: SB_URL, SUPABASE_PUBLISHABLE_KEY: SB_KEY }, env || {}));
        seenRequests.length = 0;
        sbCalls.length = 0;
        global.fetch = withSupabase(responder(listPayload([listRow()])));
        const res = await call(listQuery(query), { 'x-zoe-id-token': token || '' });
        let body = null;
        try { body = JSON.parse(res.body); } catch (e) { body = null; }
        return { res: res, body: body };
    }
    const tokA = sbToken('user-a');
    ACCOUNTS[tokA] = [{ username: 'sokha', role: 'owner', tenant_id: 't-a', tenant_name: 'A', branch_code: '881859', status: 'active' }];
    const sbHijack = await sbList(tokA, { site: '999999' });
    ok('⛔ Supabase ៖ សាខាមកពីហាងរបស់គណនី (881859) មិនមែនពី `?site=`',
        siteSent() === '881859' && ztoCalls() === 1, { sent: siteSent(), body: sbHijack.body });
    ok('⛔ Supabase ៖ Function សួរ `my_account` ដោយ token ផ្ទាល់ + Publishable key (មិនមែន secret)',
        sbCalls.length === 1 && /\/rest\/v1\/rpc\/my_account$/.test(sbCalls[0].href) && sbCalls[0].apikey === SB_KEY
        && sbCalls[0].auth === 'Bearer ' + tokA, sbCalls);
    const sbLeak = JSON.stringify(sbHijack.body || {});
    ok('⛔ Supabase ៖ token មិនលេចក្នុងចម្លើយ', sbLeak.indexOf(tokA.split('.')[1]) === -1, sbLeak.slice(0, 160));

    resetEnv({ SUPABASE_URL: SB_URL, SUPABASE_PUBLISHABLE_KEY: SB_KEY });
    sbCalls.length = 0;
    seenRequests.length = 0;
    global.fetch = withSupabase(responder(listPayload([listRow()])));
    await call(listQuery({ page: '1' }), { 'x-zoe-id-token': tokA });
    await call(listQuery({ from: '2026-09-09' }), { 'x-zoe-id-token': tokA });
    ok('Supabase ៖ សាលក្រមចងចាំតាម token (សំណើទី ២ មិនសួរ Supabase ម្តងទៀត)', sbCalls.length === 1, sbCalls.length);

    const tokRevoked = sbToken('user-r');
    ACCOUNTS[tokRevoked] = [{ tenant_id: 't-r', branch_code: '770022', status: 'revoked' }];
    const revoked = await sbList(tokRevoked, {});
    ok('⛔ Supabase ៖ ហាងត្រូវបិទ ➜ បញ្ជីបិទ · គ្មានការហៅ ZTO',
        !!revoked.body && revoked.body.enabled === false && /tenant-revoked/.test(String(revoked.body.reason)) && ztoCalls() === 0, revoked.body);
    const tokExpiredShop = sbToken('user-e');
    ACCOUNTS[tokExpiredShop] = [{ tenant_id: 't-e', branch_code: '770022', status: 'expired' }];
    const expiredShop = await sbList(tokExpiredShop, {});
    ok('⛔ Supabase ៖ ហាងផុតកំណត់ ➜ បញ្ជីបិទ', !!expiredShop.body && /tenant-expired/.test(String(expiredShop.body.reason)) && ztoCalls() === 0, expiredShop.body);

    const tokNoShop = sbToken('user-n');
    ACCOUNTS[tokNoShop] = [];
    const noShop = await sbList(tokNoShop, {});
    ok('⛔ Supabase ៖ គណនីគ្មានហាង ➜ `site:no-account`', !!noShop.body && noShop.body.reason === 'site:no-account' && ztoCalls() === 0, noShop.body);

    const forgedSb = await sbList(sbToken('user-x'), {});
    ok('⛔ Supabase ៖ token ដែល Supabase បដិសេធ (401) ➜ បញ្ជីបិទ · គ្មានការហៅ ZTO',
        !!forgedSb.body && forgedSb.body.enabled === false && ztoCalls() === 0, forgedSb.body);

    const staleSb = await sbList(sbToken('user-a', { exp: Math.floor(Date.now() / 1000) - 600 }), {});
    ok('⛔ Supabase ៖ token ផុតកំណត់ ➜ បដិសេធមុនសួរ Supabase', !!staleSb.body && staleSb.body.reason === 'idtoken:expired' && sbCalls.length === 0, staleSb.body);

    const foreign = await sbList(sbToken('user-a', { iss: 'https://evil000.supabase.co/auth/v1' }), {});
    ok('⛔ Supabase ៖ issuer របស់ Project ផ្សេង ➜ មិនសួរ Supabase · បដិសេធ',
        !!foreign.body && foreign.body.enabled === false && sbCalls.length === 0 && ztoCalls() === 0, { body: foreign.body, calls: sbCalls.length });

    const tokDown = sbToken('user-d');
    ACCOUNTS[tokDown] = [{ tenant_id: 't-a', branch_code: '881859', status: 'active' }];
    sbMode = 'down';
    const down = await sbList(tokDown, {});
    ok('⛔ Supabase មិនឆ្លើយ ➜ បញ្ជីបិទ (fail-closed) · គ្មានការហៅ ZTO',
        !!down.body && down.body.reason === 'idtoken:supabase-unreachable' && ztoCalls() === 0, down.body);
    sbMode = 'ok';
    seenRequests.length = 0;
    await call(listQuery({}), { 'x-zoe-id-token': tokDown });
    ok('⛔ ការមិនឆ្លើយមិនត្រូវចងចាំ ➜ Supabase មកវិញ ➜ បញ្ជីដើរភ្លាម', siteSent() === '881859', siteSent());

    const unset = await sbList(tokA, {}, { SUPABASE_URL: undefined });
    ok('⛔ `SUPABASE_URL` មិនទាន់ដាក់ ➜ token Supabase បិទបញ្ជី ដោយប្រាប់មូលហេតុ',
        !!unset.body && unset.body.reason === 'idtoken:supabase-unset' && ztoCalls() === 0, unset.body);
    const secretEnv = await sbList(tokA, {}, { SUPABASE_PUBLISHABLE_KEY: 'sb_secret_' + 'z'.repeat(24) });
    ok('⛔ Secret key ក្នុង `SUPABASE_PUBLISHABLE_KEY` ➜ មិនប្រើវា (មិនផ្ញើទៅណាទាំងអស់)',
        !!secretEnv.body && secretEnv.body.enabled === false && sbCalls.length === 0, { body: secretEnv.body, calls: sbCalls });

    const fbStill = await sbList(tokenFor('sok@zoew881859.com'), {});
    ok('⛔ ទិសផ្ទុយ ៖ ដាក់ Supabase env ហើយ ID token Firebase នៅដើរ (សាខាពី email)', siteSent() === '881859' && sbCalls.length === 0, { sent: siteSent(), body: fbStill.body });
    }

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ២១. ⛔ បញ្ជី «ចុះហត្ថលេខា» (ZTO Palm) · ឈ្មោះសាខា · ទាញតែ «មកដល់» ==');
    // ═════════════════════════════════════════════════════════════════════
    // ⛔ **សំណើម្ចាស់គម្រោង (ZoeW 2.50.0)** ៖ ទាញបញ្ជីលឿន · ទាញតែកញ្ចប់មកដល់ · Sync បិទពី ZTO ពិត · បង្ហាញឈ្មោះសាខា (`scanSite`)។
    // ➜ `withSigned=1` ៖ Function សួរ `/scan/page/scan` **២ ស្របគ្នា** ក្នុងការហៅតែមួយ ៖ `03` (មកដល់) + `05` (ចុះហត្ថលេខា)
    //    លើជួរ `from` ➜ `max(to, ថ្ងៃនេះ)` (ការចុះហត្ថលេខាកើត **ក្រោយ** មកដល់) ➜ `signed` = barcode ដែល ZTO បិទរួច។
    // ⛔ ភស្តុតាងត្រូវ **វិជ្ជមាន** ៖ កូដ `05` ហើយអត្ថបទមិនផ្ទុយ · ឬគ្មានកូដ តែអត្ថបទ «ចុះហត្ថលេខា» ➜ ក្រៅពីនេះ ➜ មិនមែនភស្តុតាង
    //    (ការបិទខុស = កញ្ចប់មិនទាន់យកចូលស្ថិតិយក ➜ មិនដែលផុតកំណត់/ដកលុយ)។
    // ⛔ ការហៅចាស់ (គ្មាន `withSigned`) នៅ **១ សំណើ upstream** ដដែល ➜ App ចាស់មិនបង្កើនការហៅ ZTO។
    const todayKey = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const signedStart = (() => {
        const earliest = new Date(Date.parse(todayKey + 'T00:00:00Z') - 30 * 86400000).toISOString().slice(0, 10);
        return RANGE.from > earliest ? RANGE.from : earliest;
    })();
    const SIGNED_ROWS = [
        listRow({ scanBillCode: '77130500002101', scanTypeCode: '05', scanTypeDesc: 'ចុះហត្ថលេខា', scanSite: 'Mer SorChrey' }),
        listRow({ scanBillCode: '77130500002102', scanTypeCode: '05', scanTypeDesc: 'អីវ៉ាន់មកដល់' }),
        (() => { const r = listRow({ scanBillCode: '77130500002103', scanTypeDesc: 'ចុះហត្ថលេខា' }); return r; })(),
        listRow({ scanBillCode: '77130500002104', scanTypeCode: '04', scanTypeDesc: 'ការចែកចាយអីវ៉ាន់' }),
        (() => { const r = listRow({ scanBillCode: '77130500002105' }); delete r.scanTypeDesc; return r; })(),
        listRow({ scanBillCode: 'a b', scanTypeCode: '05', scanTypeDesc: 'ចុះហត្ថលេខា' }),
        listRow({ scanBillCode: '77130500002101', scanTypeCode: '05', scanTypeDesc: 'ចុះហត្ថលេខា' })
    ];
    const ARRIVAL_ROWS = [
        listRow({ scanBillCode: '77130500002101', scanTypeCode: '03', scanSite: 'Mer\u0007  SorChrey' }),
        listRow({ scanBillCode: '77130500002106', scanTypeCode: '03', scanSite: 'Mer SorChrey' })
    ];
    let signedStatus = 200;
    const byType = (code) => (code === '05' ? listPayload(SIGNED_ROWS, { pages: 1, total: SIGNED_ROWS.length })
        : listPayload(ARRIVAL_ROWS, { pages: 1, total: ARRIVAL_ROWS.length }));
    const typeOf = (init) => { try { return JSON.parse(String((init || {}).body || '')).condition.scanTypeCode; } catch (_) { return ''; } };
    const typedFetch = withCerts(async (href, init) => {
        seenRequests.push({ href: href, init: init });
        const type = typeOf(init);
        const status = type === '05' ? signedStatus : 200;
        return { ok: status < 400, status: status, headers: { get: () => 'application/json' }, json: async () => byType(type) };
    });
    async function typedCall(env, query) {
        resetEnv(env);
        seenRequests.length = 0;
        global.fetch = typedFetch;
        const res = await call(listQuery(query));
        return { status: res.statusCode, body: bodyOf(res), requests: seenRequests.slice() };
    }
    const bodyAt = (req) => { try { return JSON.parse(String((req.init || {}).body || '')); } catch (_) { return null; } };

    const both = await typedCall(GOOD_LIST_ENV, { withSigned: '1' });
    const bothTypes = both.requests.map((r) => typeOf(r.init)).sort();
    ok('⛔ `withSigned=1` ➜ upstream **២ សំណើ** (`03` + `05`) ក្នុងការហៅតែមួយ', JSON.stringify(bothTypes) === '["03","05"]', bothTypes);
    const signedReq = both.requests.find((r) => typeOf(r.init) === '05');
    const signedCond = (signedReq && bodyAt(signedReq) && bodyAt(signedReq).condition) || {};
    ok('⛔ សំណើ «ចុះហត្ថលេខា» ចងសាខាដដែល (មិនមែនសាខាផ្សេង)', signedCond.scanSiteCode === LIST_SITE, signedCond.scanSiteCode);
    ok('⛔ ជួរ «ចុះហត្ថលេខា» ចប់ **ថ្ងៃនេះ** (ការបិទកើតក្រោយមកដល់) · ចាប់ពី `from` (ពិដាន ៣១ ថ្ងៃ)',
        signedCond.scanEndTime === todayKey + ' 23:59:59' && signedCond.scanStartTime === signedStart + ' 00:00:00',
        [signedCond.scanStartTime, signedCond.scanEndTime]);
    ok('⛔ ចម្លើយ ៖ `signedOk:true` + barcode ដែលចុះហត្ថលេខា (មិនស្ទួន)',
        both.body.signedOk === true && Array.isArray(both.body.signed)
        && JSON.stringify(both.body.signed.slice().sort()) === '["77130500002101","77130500002103"]', both.body.signed);
    ok('⛔ ភស្តុតាងត្រូវ **វិជ្ជមាន** ៖ កូដ `05` + អត្ថបទ «មកដល់» · កូដ `04` · គ្មានទាំង ២ · barcode ខូច ➜ មិនមែនភស្តុតាង',
        Array.isArray(both.body.signed) && ['77130500002102', '77130500002104', '77130500002105', 'a b']
            .every((c) => both.body.signed.indexOf(c) === -1), both.body.signed);
    ok('⛔ `rows` មានតែ «អីវ៉ាន់មកដល់» (ជួរដេក `05` មិនក្លាយជាកញ្ចប់ថ្មី)',
        rowsOf(both.body).length === 2 && rowsOf(both.body).every((r) => r.skip === ''), rowsOf(both.body).map((r) => r.barcode));
    ok('⛔ ឈ្មោះសាខាពី `scanSite` (អក្សរបញ្ជាត្រូវដក · ចន្លោះត្រូវបង្រួម)', both.body.siteName === 'Mer SorChrey', both.body.siteName);
    ok('⛔ លេខសាខាឡើងជាមួយ (`site`)', both.body.site === LIST_SITE, both.body.site);
    ok('⛔ ឈ្មោះ/អាសយដ្ឋានអតិថិជននៅមិនឆ្លងកាត់', JSON.stringify(both.body).indexOf('ឈ្មោះអតិថិជន') === -1
        && JSON.stringify(both.body).indexOf('磅湛直营店') === -1, true);

    const plain = await typedCall(GOOD_LIST_ENV, {});
    ok('⛔ ទិសផ្ទុយ ៖ គ្មាន `withSigned` (App ចាស់) ➜ upstream **១ សំណើ** ដដែល', plain.requests.length === 1
        && typeOf(plain.requests[0].init) === '03', plain.requests.map((r) => typeOf(r.init)));
    ok('⛔ ទិសផ្ទុយ ៖ គ្មាន `withSigned` ➜ `signedOk` មិនមែន `true`', plain.body.signedOk !== true, plain.body.signedOk);

    resetEnv(GOOD_LIST_ENV);
    seenRequests.length = 0;
    global.fetch = typedFetch;
    bodyOf(await call(listQuery({ withSigned: '1' })));
    const cachedBoth = bodyOf(await call(listQuery({ withSigned: '1' })));
    const plainAfter = bodyOf(await call(listQuery()));
    ok('⛔ cache ៖ `withSigned` ដដែល ➜ `cached:true` · គ្មានការហៅ ZTO ថ្មី', cachedBoth.cached === true && cachedBoth.signedOk === true, cachedBoth.cached);
    ok('⛔ cache ៖ ការហៅធម្មតាមិនទទួលចម្លើយ `withSigned` (កូនសោផ្សេង)', plainAfter.cached === false && plainAfter.signedOk !== true, plainAfter.cached);

    signedStatus = 503;
    const failedSigned = await typedCall(GOOD_LIST_ENV, { withSigned: '1' });
    ok('⛔ សំណើ «ចុះហត្ថលេខា» ធ្លាក់ ➜ បញ្ជីមកដល់នៅ 200 · `signedOk:false` (មិនមែនកំហុសទាំងមូល)',
        failedSigned.status === 200 && rowsOf(failedSigned.body).length === 2 && failedSigned.body.signedOk === false,
        { status: failedSigned.status, signedOk: failedSigned.body.signedOk });
    resetEnv(GOOD_LIST_ENV);
    global.fetch = typedFetch;
    bodyOf(await call(listQuery({ withSigned: '1' })));
    const retrySigned = bodyOf(await call(listQuery({ withSigned: '1' })));
    ok('⛔ ការធ្លាក់មិនត្រូវ cache (សាកម្តងទៀត ➜ សួរពិត)', retrySigned.cached === false, retrySigned.cached);
    signedStatus = 200;

    const onlySigned = await typedCall(GOOD_LIST_ENV, { signed: '1' });
    ok('⛔ `signed=1` (ជុំបិទតាម ZTO ស្វ័យប្រវត្តិ) ➜ upstream ១ សំណើ `05`',
        onlySigned.requests.length === 1 && typeOf(onlySigned.requests[0].init) === '05', onlySigned.requests.map((r) => typeOf(r.init)));
    ok('⛔ `signed=1` ➜ `rows: []` · `signedOk:true` · barcode ចុះហត្ថលេខា',
        rowsOf(onlySigned.body).length === 0 && onlySigned.body.signedOk === true && Array.isArray(onlySigned.body.signed)
        && onlySigned.body.signed.indexOf('77130500002101') !== -1, onlySigned.body);
    // ⛔ E3 ៖ ជុំបិទតាម ZTO បំបែកបញ្ជីវែង (លើសពិដានទំព័រ) ជាថ្ងៃៗ ➜ `signed=1&exact=1` គោរពជួរដែលសុំ (មិនពង្រីកដល់ថ្ងៃនេះ)។
    // ⛔ F1 ៖ `signed=1` ធម្មតា (ទំព័រ «ចុះហត្ថលេខា» បន្ថែមរបស់ប្រអប់បញ្ជី) ពង្រីកដល់ថ្ងៃនេះ **ដូច companion** (`withSigned=1`) ➜ ទំព័រ ២–៣
    //    អានបញ្ជីដដែលនឹងទំព័រ ១។ មុនកែ ៖ ទំព័របន្ថែមអាន `from..to` (បញ្ជីផ្សេង) ➜ ភស្តុតាងក្រោយ `to` បាត់ស្ងាត់ពេល «ដល់ថ្ងៃ» < ថ្ងៃនេះ។
    const dayBefore = new Date(Date.parse(todayKey + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
    const oneDay = await typedCall(GOOD_LIST_ENV, { signed: '1', exact: '1', from: dayBefore, to: dayBefore });
    const oneDayCond = (oneDay.requests[0] && bodyAt(oneDay.requests[0]) && bodyAt(oneDay.requests[0]).condition) || {};
    ok('⛔ E3 ៖ `signed=1&exact=1` គោរពជួរថ្ងៃដែលសុំ (ការបំបែកតាមថ្ងៃ) ➜ មិនពង្រីកដល់ថ្ងៃនេះ',
        oneDay.requests.length === 1 && oneDayCond.scanStartTime === dayBefore + ' 00:00:00' && oneDayCond.scanEndTime === dayBefore + ' 23:59:59',
        [oneDayCond.scanStartTime, oneDayCond.scanEndTime]);
    const extended = await typedCall(GOOD_LIST_ENV, { signed: '1', from: dayBefore, to: dayBefore, page: '2' });
    const extendedCond = (extended.requests[0] && bodyAt(extended.requests[0]) && bodyAt(extended.requests[0]).condition) || {};
    ok('⛔ F1 ៖ `signed=1` (ទំព័របន្ថែមរបស់ប្រអប់បញ្ជី) ពង្រីកដល់ថ្ងៃនេះដូច companion ➜ ទំព័រទាំងអស់អានបញ្ជីដដែល',
        extended.requests.length === 1 && extendedCond.scanStartTime === dayBefore + ' 00:00:00' && extendedCond.scanEndTime === todayKey + ' 23:59:59',
        [extendedCond.scanStartTime, extendedCond.scanEndTime]);
    // ⛔ ល្បឿន «បិទតាម ZTO» (របាយការណ៍ម្ចាស់ ៖ «sync យឺត») ៖ cache `signed=1` ≤ LIST_SIGNED_CACHE_TTL_MAX_MS (១៥ វិ.) — ជុំរៀងរាល់ ២០ វិ.
    //    មិនត្រូវទទួលចម្លើយចាស់ ៦០ វិ. · ទិសផ្ទុយ ៖ ៥ វិ. ➜ នៅ cache (ឧបករណ៍ច្រើននៃសាខាតែមួយចែកគ្នា) · បញ្ជីធម្មតានៅ ៦០ វិ.។
    const twoBefore = new Date(Date.parse(todayKey + 'T00:00:00Z') - 2 * 86400000).toISOString().slice(0, 10);
    const ttlNow = Date.now;
    let ttlShift = 0;
    Date.now = () => ttlNow.call(Date) + ttlShift;
    let ttl = null;
    try {
        resetEnv(GOOD_LIST_ENV);
        global.fetch = typedFetch;
        const sq = listQuery({ signed: '1', from: twoBefore, to: twoBefore });
        const lq = listQuery({ from: twoBefore, to: twoBefore });
        const s1 = bodyOf(await call(sq));
        const l1 = bodyOf(await call(lq));
        ttlShift = 5000;
        const s2 = bodyOf(await call(sq));
        ttlShift = 16000;
        const s3 = bodyOf(await call(sq));
        const l2 = bodyOf(await call(lq));
        ttl = { s1: s1.cached, s2: s2.cached, s3: s3.cached, l1: l1.cached, l2: l2.cached };
    } finally {
        Date.now = ttlNow;
    }
    ok('⛔ ល្បឿន ៖ `signed=1` ➜ cache ផុតក្នុង ១៥ វិ. (ជុំ ២០ វិ. ទទួលចម្លើយថ្មី)', ttl.s1 === false && ttl.s3 === false, ttl);
    ok('ទិសផ្ទុយ ៖ `signed=1` ក្នុង ៥ វិ. ➜ cache នៅ (មិនបង្កើនការហៅ ZTO)', ttl.s2 === true, ttl);
    ok('ទិសផ្ទុយ ៖ បញ្ជីធម្មតា (`list=1`) នៅ cache ដដែល (១៦ វិ. ➜ cached)', ttl.l1 === false && ttl.l2 === true, ttl);

    const off = await typedCall(Object.assign({}, GOOD_LIST_ENV, { ZTO_LIST_SIGNED_SCAN_TYPE: 'off' }), { withSigned: '1' });
    ok('⛔ `ZTO_LIST_SIGNED_SCAN_TYPE=off` ➜ upstream ១ សំណើ (`03`) · `signed:null`',
        off.requests.length === 1 && off.body.signed === null && off.body.signedOk === false, { n: off.requests.length, signed: off.body.signed });
    const offOnly = await typedCall(Object.assign({}, GOOD_LIST_ENV, { ZTO_LIST_SIGNED_SCAN_TYPE: 'off' }), { signed: '1' });
    ok('⛔ បិទ ➜ `signed=1` មិនហៅ ZTO សោះ · `signedOk:false`', offOnly.requests.length === 0 && offOnly.body.signedOk === false, offOnly.body);
    const same = await typedCall(Object.assign({}, GOOD_LIST_ENV, { ZTO_LIST_SIGNED_SCAN_TYPE: '03' }), { withSigned: '1' });
    ok('⛔ ប្រភេទ «ចុះហត្ថលេខា» ស្មើ «មកដល់» ➜ បិទ (កញ្ចប់មកដល់មិនត្រូវចាត់ជា «បិទរួច»)',
        same.requests.length === 1 && same.body.signed === null, { n: same.requests.length, signed: same.body.signed });
    const customDesc = await typedCall(Object.assign({}, GOOD_LIST_ENV, { ZTO_LIST_SIGNED_SCAN_DESC: '' }), { withSigned: '1' });
    ok('⛔ `ZTO_LIST_SIGNED_SCAN_DESC=` ➜ ជាន់អត្ថបទបិទ ➜ ពឹងលើកូដ `05` តែម្យ៉ាង (គ្មានកូដ ➜ មិនមែនភស្តុតាង)',
        Array.isArray(customDesc.body.signed) && customDesc.body.signed.indexOf('77130500002102') !== -1
        && customDesc.body.signed.indexOf('77130500002103') === -1, customDesc.body.signed);

    const diagSigned = await diagCall(GOOD_LIST_ENV);
    ok('`?diag=1` ៖ `signedEnabled` + លំនាំដើម (`05` · «ចុះហត្ថលេខា»)',
        listOf(diagSigned.body).signedEnabled === true && listOf(diagSigned.body).signedTypeIsDefault === true
        && listOf(diagSigned.body).signedDescIsDefault === true, listOf(diagSigned.body));
    ok('`?diag=1` ៖ `signedCacheTtlMs` ≤ ១៥ វិ. និង ≤ `cacheTtlMs` (ល្បឿនបិទតាម ZTO)',
        listOf(diagSigned.body).signedCacheTtlMs === Math.min(15000, listOf(diagSigned.body).cacheTtlMs), listOf(diagSigned.body));
    const diagSame = await diagCall({ ZTO_LIST_SIGNED_SCAN_TYPE: '03' });
    ok('`?diag=1` ៖ ប្រភេទស្មើគ្នា ➜ មូលហេតុ `signed-type:same`', listOf(diagSame.body).signedReason === 'signed-type:same', listOf(diagSame.body));
    const defaults = /const DEFAULT_LIST_SIGNED_SCAN_TYPE = '([^']*)'/.exec(FUNCTION_SRC);
    ok('ជាន់អប្បបរមា ៖ លំនាំដើម «ចុះហត្ថលេខា» ជា `05` (វាស់លើ payload ពិត ៖ ០៣ មកដល់ · ០៤ ចែកចាយ · ០៥ ចុះហត្ថលេខា)',
        !!defaults && defaults[1] === '05', defaults && defaults[1]);

    // ⛔ **ការប្រណាំង Cookie** ៖ សំណើ «ចុះហត្ថលេខា» រត់ស្របគ្នាជាមួយបញ្ជីមកដល់ ហើយប្រើ `session` ដដែល ➜ បើវាឆ្លើយ **ក្រោយ**
    //    `flushCookieRenewal()` នោះ `Set-Cookie` របស់វា (BOS-MAN-SESSION ថ្មី) ចុះលើ `session.renewal` ហើយ **មិនដែលសរសេរ** ➜ Cookie
    //    ដែល ZTO បង្វិលរួចបាត់ ➜ ការហៅបន្ទាប់ផ្ញើ session ចាស់។ ការបង្វិលត្រូវសរសេរចូល store ទោះមកពីសំណើណាមួយ។
    {
        const raceRun = async (rotateOn, rotated, slowType) => {
            const setCookies = rotateOn && typeof rotateOn === 'object' ? rotateOn : { [rotateOn]: [rotated] };
            const slow = slowType || '05';
            const blobState = { value: 'BOS-MAN-SESSION=blob-cookie-value-9876; sidebarStatus=1', writes: [] };
            const etagOf = (v) => '"' + crypto.createHash('sha256').update(String(v || '')).digest('hex') + '"';
            const store = {
                get: async () => blobState.value,
                getWithMetadata: async () => ({ data: blobState.value, etag: etagOf(blobState.value), metadata: {} }),
                set: async (key, value, options) => {
                    blobState.writes.push(value);
                    if (options && options.onlyIfMatch && options.onlyIfMatch !== etagOf(blobState.value)) return { modified: false };
                    blobState.value = value;
                    return { modified: true, etag: etagOf(value) };
                }
            };
            if (typeof proxy.setBlobsModuleForTests === 'function') {
                proxy.setBlobsModuleForTests({ connectLambda() {}, getStore() { return store; } });
            }
            resetEnv(Object.assign({}, GOOD_LIST_ENV, { ZTO_AUTHORIZATION: undefined, ZTO_COOKIE: 'BOS-MAN-SESSION=env-cookie-value-1234; sidebarStatus=0' }));
            seenRequests.length = 0;
            global.fetch = withCerts(async (href, init) => {
                seenRequests.push({ href: href, init: init });
                const type = typeOf(init);
                if (type === slow) await new Promise((r) => setTimeout(r, 60));
                return {
                    ok: true, status: 200,
                    headers: {
                        get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null),
                        getSetCookie: () => (setCookies[type] || []).map((line) => line + '; Path=/; HttpOnly')
                    },
                    json: async () => byType(type)
                };
            });
            let res = null;
            try {
                res = await proxy.handler({
                    httpMethod: 'GET',
                    headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-id-token': tokenForSite(LIST_SITE), 'x-nf-site-id': 'site-for-tests', 'x-nf-deploy-id': 'deploy-for-tests' },
                    blobs: Buffer.from(JSON.stringify({ url: 'https://blobs.netlify.test', token: 'blob-token-for-tests' })).toString('base64'),
                    queryStringParameters: listQuery({ withSigned: '1' })
                });
            } catch (e) { res = { statusCode: 500, body: String(e && e.message) }; }
            if (typeof proxy.setBlobsModuleForTests === 'function') proxy.setBlobsModuleForTests(null);
            return { res: res, writes: blobState.writes, stored: blobState.value };
        };
        const probe = await raceRun('03', 'BOS-MAN-SESSION=rotated-by-arrival-555000');
        ok('ជាន់អប្បបរមា (probe ទិសផ្ទុយ) ៖ Cookie បង្វិលក្នុងចម្លើយ «មកដល់» ➜ សរសេរចូល store (ការរៀបចំសរសេរបានពិត)',
            !!probe.res && probe.res.statusCode === 200
            && probe.writes.some((v) => String(v).indexOf('rotated-by-arrival-555000') !== -1), probe.writes);
        const raced = await raceRun('05', 'BOS-MAN-SESSION=rotated-by-signed-777000');
        ok('ជាន់អប្បបរមា ៖ ការហៅជាមួយ Cookie store ឆ្លើយ 200 + `signedOk`',
            !!raced.res && raced.res.statusCode === 200 && bodyOf(raced.res).signedOk === true, raced.res && raced.res.statusCode);
        ok('⛔ Cookie ដែល ZTO បង្វិលក្នុងចម្លើយ «ចុះហត្ថលេខា» (មកក្រោយ) ត្រូវសរសេរចូល store (មិនបាត់)',
            raced.writes.some((v) => String(v).indexOf('rotated-by-signed-777000') !== -1), raced.writes);

        // ⛔ **ថង់ Cookie** ៖ ចម្លើយទាំង ២ (មកដល់ · ចុះហត្ថលេខា) ផ្ញើ Cookie ដដែល ហើយ `Set-Cookie` របស់វាត្រូវ **បូកតាមលំដាប់មកដល់**
        //    (ដូចថង់ Cookie របស់ browser)។ ចម្លើយទី ២ ដែលមានតែ Cookie បន្ទាប់បន្សំ (ឧ. `sidebarStatus`) មិនត្រូវលុប BOS-MAN-SESSION
        //    ដែល ZTO ទើបបង្វិលក្នុងចម្លើយទី ១ ឡើយ ➜ បើលុប ➜ store/អង្គចងចាំត្រឡប់ទៅ session ចាស់ ➜ ការហៅបន្ទាប់ផ្ញើ session ដែល ZTO បោះបង់។
        const jarLater = await raceRun({ '03': ['BOS-MAN-SESSION=rotated-by-arrival-818000'], '05': ['sidebarStatus=7'] });
        ok('ជាន់អប្បបរមា ៖ ការហៅ «ថង់ Cookie» (ការបង្វិលមុន · Cookie បន្ទាប់បន្សំក្រោយ) ឆ្លើយ 200',
            !!jarLater.res && jarLater.res.statusCode === 200, jarLater.res && jarLater.res.statusCode);
        ok('⛔ ចម្លើយក្រោយដែលមានតែ Cookie បន្ទាប់បន្សំ មិនលុប BOS-MAN-SESSION ដែលទើបបង្វិល (store ចុងក្រោយមាន session ថ្មី + `sidebarStatus=7`)',
            String(jarLater.stored).indexOf('rotated-by-arrival-818000') !== -1 && String(jarLater.stored).indexOf('sidebarStatus=7') !== -1,
            { stored: jarLater.stored, writes: jarLater.writes });
        const jarEarlier = await raceRun({ '05': ['BOS-MAN-SESSION=rotated-by-signed-828000'], '03': ['sidebarStatus=8'] }, null, '03');
        ok('⛔ ទិសផ្ទុយ ៖ ការបង្វិលក្នុងចម្លើយ «ចុះហត្ថលេខា» (មកមុន) នៅដដែល ពេល «មកដល់» (មកក្រោយ) មានតែ Cookie បន្ទាប់បន្សំ',
            String(jarEarlier.stored).indexOf('rotated-by-signed-828000') !== -1 && String(jarEarlier.stored).indexOf('sidebarStatus=8') !== -1,
            { stored: jarEarlier.stored, writes: jarEarlier.writes });
    }

    console.log('\n== ២២. ⛔ E8 ៖ payload ពិតពី ZTO Argus (ម្ចាស់គម្រោង ៖ កញ្ចប់យករួច ៣ ៖ ក្នុងស្រុក · ចិន · Shopee វៀតណាម) ==');
    // ⛔ ទម្រង់ពិតដែលម្ចាស់គម្រោងចម្លងពី Argus (2026-10-06) ៖ ឈ្មោះ · លេខទូរស័ព្ទ · អាសយដ្ឋាន · barcode · ឈ្មោះបុគ្គលិក ត្រូវប្តូរជាតម្លៃក្លែង
    //    (repo នឹងជាសាធារណៈ) តែ **ទម្រង់** (`+855-0…` · `855…` · `0…`) · វាល · កូដ/អត្ថបទស្កេន · លំដាប់ (តាម `id` ឡើង ៖ ស្កេនបញ្ហា `30` ដែល `scanTime`
    //    មុន `05` មកក្រោយ) · ចំនួនទឹកប្រាក់ ដូចពិត។ ការពិតដែលវាស់បាន ៖ ជួរដេកបញ្ជី **គ្មាន** `billStatus` ➜ សាលក្រមជួរដេក = `null` ➜ ភស្តុតាង 05 សម្រេច (E2)។
    const realRow = (code, mobile, type, desc, at, extra) => Object.assign({
        action: null, agentAmount: 0, barScannerId: '1', classCodeDesc: '', consigneeAddress: 'អាសយដ្ឋានក្លែង', consigneeMobile: mobile,
        consigneeName: 'Customer', countryCode: null, customerCode: '20000', customerCodeDesc: null, dataFrom: 'Astra-VN-IOS', destinationNo: null,
        destinationOutletName: 'Mer SorChrey', dispatchOrSendManName: 'បុគ្គលិក', fcAmount: 0, freeStatisticalResVO: null, goodsType: 'របស់របរទូទៅ',
        id: 1808096000000000000, isRefund: 0, isRefundDesc: 'ទេ', netWeight: 0.5, packageQty: 1, preOrNextStationCode: null, problemReason: '',
        recSite: 'ក្លែង', remark: '', scanBillCode: code, scanMan: 'បុគ្គលិក', scanSite: 'Mer SorChrey', scanSiteCode: LIST_SITE, scanSource: null,
        scanSourceDesc: null, scanTime: at, scanTypeCode: type, scanTypeDesc: desc, signMan: '', signName: null, signedBillCode: '', updateTime: at,
        volumeWeight: 0, weight: '0.0', zone: null
    }, extra || {});
    const REAL = [
        { name: 'ក្នុងស្រុក', code: '11600100008801', mobile: '+855-090000001', phone: '090000001', cod: 185, dod: 0, at03: '2026-10-06 15:34:22',
            from: 'ច្រមុះជ្រូកស្ទឹងមានជ័យ',
            rows: (c, m) => [
                realRow(c, m, '03', 'អីវ៉ាន់មកដល់', '2026-10-06 15:34:22', { agentAmount: 185.0, remark: '8.5', weight: '40.0', recSite: 'ច្រមុះជ្រូកស្ទឹងមានជ័យ' }),
                realRow(c, m, '04', 'ការចែកចាយអីវ៉ាន់', '2026-10-06 15:34:27', { agentAmount: 185.0 }),
                realRow(c, m, '05', 'ចុះហត្ថលេខា', '2026-10-06 15:37:15', { agentAmount: 185.0, signMan: 'S' })] },
        { name: 'ចិន (អន្តរជាតិ)', code: '77130500008802', mobile: '081000002', phone: '081000002', cod: 0, dod: 2.5, at03: '2026-10-06 14:07:16',
            from: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ',
            rows: (c, m) => [
                realRow(c, m, '03', 'អីវ៉ាន់មកដល់', '2026-10-06 14:07:16', { fcAmount: 2.5, customerCode: '888880001', customerCodeDesc: 'ztda', recSite: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ' }),
                realRow(c, m, '04', 'ការចែកចាយអីវ៉ាន់', '2026-10-06 14:07:28', { fcAmount: 2.5 }),
                realRow(c, m, '05', 'ចុះហត្ថលេខា', '2026-10-06 14:07:35', { fcAmount: 2.5, signMan: 'ស' })] },
        { name: 'Shopee វៀតណាម', code: '77130500008803', mobile: '855880000003', phone: '0880000003', cod: 3.16, dod: 0, at03: '2026-10-04 14:53:29',
            from: 'Shopee SHPE',
            rows: (c, m) => [
                realRow(c, m, '03', 'អីវ៉ាន់មកដល់', '2026-10-04 14:53:29', { agentAmount: 3.16, customerCode: 'KH803480001', customerCodeDesc: 'Shopee SHPE', recSite: 'Shopee SHPE' }),
                realRow(c, m, '04', 'ការចែកចាយអីវ៉ាន់', '2026-10-04 15:46:14', { agentAmount: 3.16 }),
                realRow(c, m, '05', 'ចុះហត្ថលេខា', '2026-10-05 10:48:07', { agentAmount: 3.16, signMan: 'ថ' }),
                realRow(c, m, '30', 'ការចុះឈ្មោះបញ្ហា', '2026-10-04 15:50:47', { agentAmount: 3.16, dataFrom: 'Z10-KH-PDA',
                    problemReason: 'បានធ្វើការចែកចាយ ប៉ុន្តែគ្មានអ្នកចាំទទួល/ ទាក់ទងអត់លើកឬអត់ចូល' })] }
    ];
    const phoneOf = (raw) => {
        try {
            return vm.runInNewContext(extractFn(APP_SRC, 'normalizeOneStoredPhone') + '\n' + extractFn(APP_SRC, 'normalizeStoredPhone')
                + '\nnormalizeStoredPhone(__raw);', { __raw: raw });
        } catch (e) { return 'ERR:' + (e && e.message); }
    };
    const PROD_SIGNED_ENV = { ZTO_FIELD_SIGNED: 'billStatus', ZTO_SIGNED_VALUES: '5' };
    for (const real of REAL) {
        const payload = listPayload(real.rows(real.code, real.mobile), { pages: 1, total: real.rows(real.code, real.mobile).length });
        resetEnv(PROD_SIGNED_ENV);
        seenRequests.length = 0;
        global.fetch = withCerts(async (href, init) => {
            seenRequests.push({ href: href, init: init });
            return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => payload };
        });
        const res = await call(listQuery({ withSigned: '1' }));
        const b = bodyOf(res);
        const rows = rowsOf(b);
        const r0 = rows[0] || {};
        const upstreamRows = payload.data.result.length;
        ok('⛔ E8 ' + real.name + ' ៖ ជួរដេក «មកដល់» តែមួយ (04 · 05 · 30 មិនក្លាយជាកញ្ចប់)',
            res.statusCode === 200 && rows.length === 1 && r0.barcode === real.code && r0.skip === '', { status: res.statusCode, rows: rows });
        ok('⛔ E8 ' + real.name + ' ៖ COD/DOD ពិត (`agentAmount` · `fcAmount` = DOD) · ម៉ោង = ស្កេន 03',
            r0.cod === real.cod && r0.dod === real.dod && r0.at === real.at03, r0);
        ok('⛔ E8 ' + real.name + ' ៖ ជួរដេកបញ្ជីគ្មាន `billStatus` ➜ `ztoClosed: null` (ទោះ `ZTO_FIELD_SIGNED=billStatus`)', r0.ztoClosed === null, r0.ztoClosed);
        ok('⛔ E8 ' + real.name + ' ៖ ភស្តុតាង «ចុះហត្ថលេខា» ពិត (05 + អត្ថបទលំនាំដើម) ➜ `signed` មាន barcode',
            b.signedOk === true && Array.isArray(b.signed) && b.signed.indexOf(real.code) !== -1, { signedOk: b.signedOk, signed: b.signed });
        ok('⛔ E8 ' + real.name + ' ៖ រាប់គ្រប់ ៖ rows + otherScans + signedScans = ជួរដេក upstream',
            rows.length + Number(b.otherScans) + Number(b.signedScans) === upstreamRows && Number(b.signedScans) === 1,
            { rows: rows.length, otherScans: b.otherScans, signedScans: b.signedScans, upstreamRows: upstreamRows });
        ok('⛔ E8 ' + real.name + ' ៖ ឈ្មោះសាខា `Mer SorChrey`', b.siteName === 'Mer SorChrey', b.siteName);
        ok('⛔ ប្រភពកញ្ចប់ ' + real.name + ' ៖ `from` = `recSite` («' + real.from + '»)', r0.from === real.from, r0.from);
        ok('⛔ E8 ' + real.name + ' ៖ លេខទូរស័ព្ទ (' + real.mobile + ') ➜ ទម្រង់ក្នុងស្រុក `' + real.phone + '` (កូនសោបញ្ចូលគ្នា)',
            phoneOf(r0.phone) === real.phone, { raw: r0.phone, normalized: phoneOf(r0.phone) });
        resetEnv(PROD_SIGNED_ENV);
        global.fetch = withCerts(async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => payload }));
        const only = bodyOf(await call(listQuery({ signed: '1' })));
        ok('⛔ E8 ' + real.name + ' ៖ `signed=1` (ជុំបិទតាម ZTO) ➜ barcode ក្នុង `signed` · គ្មានជួរដេក',
            only.signedOk === true && rowsOf(only).length === 0 && Array.isArray(only.signed) && only.signed.indexOf(real.code) !== -1, only);
    }

    // ⛔ ប្រភពកញ្ចប់ (សំណើម្ចាស់គម្រោង ៖ «ដឹងថាកញ្ចប់មកពីចិន វៀតណាម») ៖ ZTO គ្មានវាលប្រទេស (`countryCode: null` គ្រប់ payload ពិត) ➜ `from` = `recSite`
    //    (កន្លែង ZTO ទទួលកញ្ចប់ ៖ ឃ្លាំងក្វាងចូវអន្តរជាតិ · Shopee SHPE · សាខាក្នុងស្រុក) ➜ `customerCodeDesc` · ⛔ មិនទាយប្រទេស។
    const originOf = async (extra) => {
        const p = listPayload([realRow('77130500008805', '081000005', '03', 'អីវ៉ាន់មកដល់', '2026-10-06 09:00:00', extra)], { pages: 1, total: 1 });
        resetEnv(PROD_SIGNED_ENV);
        global.fetch = withCerts(async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => p }));
        const r = rowsOf(bodyOf(await call(listQuery({ from: '2026-10-06', to: '2026-10-06', page: '1' }))))[0] || {};
        return r.from;
    };
    const fallbackFrom = await originOf({ recSite: '', customerCodeDesc: 'Shopee SHPE' });
    ok('ប្រភព ៖ `recSite` ទទេ ➜ `customerCodeDesc`', fallbackFrom === 'Shopee SHPE', fallbackFrom);
    const noneFrom = await originOf({ recSite: null, customerCodeDesc: null });
    ok('ទិសផ្ទុយ ៖ គ្មានវាលទាំងពីរ ➜ `from: ""` (មិនទាយ)', noneFrom === '', noneFrom);
    const dirtyFrom = await originOf({ recSite: '  ZTO\u0000  ឃ្លាំង\n\nក្វាងចូវ ' + 'x'.repeat(200) });
    ok('⛔ ប្រភព ៖ តួអក្សរបញ្ជាដក · ចន្លោះបង្រួម · ≤ ៦៤ តួ', typeof dirtyFrom === 'string' && dirtyFrom.indexOf('\u0000') === -1
        && dirtyFrom.indexOf('\n') === -1 && dirtyFrom.indexOf('  ') === -1 && dirtyFrom.length <= 64 && dirtyFrom.indexOf('ZTO ឃ្លាំង') === 0, dirtyFrom);

    // ⛔ E8ខ ៖ payload ពិត «ត្រឡប់ការស្កេន» (ម្ចាស់គម្រោង ៖ កញ្ចប់ត្រឡប់ទៅសាខាកណ្តាលវិញ លើស ៧ ថ្ងៃ) ៖ `scanTypeCode: "-710"` · `scanTypeDesc: "ត្រឡប់ការស្កេន"` ·
    //    `isRefund: 1`។ កញ្ចប់នេះ **មិនបានយក** ➜ ⛔ មិនត្រូវក្លាយជាភស្តុតាង «ចុះហត្ថលេខា» (បើក្លាយ ➜ ZoeW បិទ «យករួច» ➜ ការសម្អាត ៧ ថ្ងៃមិនដកលុយ) ·
    //    មិនមែនជួរដេក «មកដល់» · ការសម្អាត ៧ ថ្ងៃ (`expired` · ដកលុយ) ជាផ្លូវត្រូវ (ច្បាប់អាជីវកម្ម ៖ កញ្ចប់មិនយកត្រឡប់ទៅសាខាកណ្តាល)។
    const RET_CODE = '77130500008804';
    const retRow = realRow(RET_CODE, '855960000004', '-710', 'ត្រឡប់ការស្កេន', '2026-10-06 11:49:23', { agentAmount: 8.76, customerCode: 'KH803480001',
        customerCodeDesc: 'Shopee SHPE', recSite: 'Shopee SHPE', isRefund: 1, isRefundDesc: 'ត្រូវហើយ', barScannerId: '465' });
    const retArrival = realRow(RET_CODE, '855960000004', '03', 'អីវ៉ាន់មកដល់', '2026-09-27 10:00:00', { agentAmount: 8.76, customerCodeDesc: 'Shopee SHPE' });
    for (const ret of [{ name: 'តែជួរ -710 (ដូចម្ចាស់ចម្លង · total 1)', rows: [retRow], arrivals: 0 },
        { name: 'មកដល់ 03 + ត្រឡប់ -710', rows: [retArrival, retRow], arrivals: 1 }]) {
        const payload = listPayload(ret.rows, { pages: 1, total: ret.rows.length });
        resetEnv(PROD_SIGNED_ENV);
        global.fetch = withCerts(async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => payload }));
        const res = await call(listQuery({ withSigned: '1', from: '2026-09-27', to: '2026-10-06' }));
        const b = bodyOf(res);
        const rows = rowsOf(b);
        ok('⛔ E8ខ ' + ret.name + ' ៖ «ត្រឡប់ការស្កេន» **មិនមែន** ភស្តុតាងចុះហត្ថលេខា (មិនបិទ «យករួច» ➜ ការសម្អាត ៧ ថ្ងៃដកលុយ)',
            res.statusCode === 200 && b.signedOk === true && Array.isArray(b.signed) && b.signed.indexOf(RET_CODE) === -1 && Number(b.signedScans) === 0,
            { status: res.statusCode, signedOk: b.signedOk, signed: b.signed, signedScans: b.signedScans });
        ok('⛔ E8ខ ' + ret.name + ' ៖ ជួរ -710 មិនមែនជួរដេក «មកដល់» (រាប់ក្នុង `otherScans`) · រាប់គ្រប់',
            rows.length === ret.arrivals && Number(b.otherScans) === 1 && rows.length + Number(b.otherScans) + Number(b.signedScans) === ret.rows.length
            && rows.every((r) => r.ztoClosed === null), { rows: rows, otherScans: b.otherScans });
        resetEnv(PROD_SIGNED_ENV);
        global.fetch = withCerts(async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => payload }));
        const only = bodyOf(await call(listQuery({ signed: '1', from: '2026-09-27', to: '2026-10-06' })));
        ok('⛔ E8ខ ' + ret.name + ' ៖ `signed=1` (ជុំបិទតាម ZTO) ➜ គ្មាន barcode ត្រឡប់', only.signedOk === true && Array.isArray(only.signed)
            && only.signed.indexOf(RET_CODE) === -1, only.signed);
    }
    // ជាន់កូដតែម្យ៉ាង (`ZTO_LIST_SIGNED_SCAN_DESC=` ➜ ជាន់អត្ថបទបិទ) ៖ កូដ `-710` ≠ `05` ត្រូវបដិសេធដោយខ្លួនឯង (ជាន់ទាំង ២ ឯករាជ្យ)។
    resetEnv(Object.assign({}, PROD_SIGNED_ENV, { ZTO_LIST_SIGNED_SCAN_DESC: '' }));
    global.fetch = withCerts(async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' },
        json: async () => listPayload([retRow], { pages: 1, total: 1 }) }));
    const retCodeOnly = bodyOf(await call(listQuery({ signed: '1', from: '2026-09-27', to: '2026-10-06' })));
    ok('⛔ E8ខ ជាន់កូដតែម្យ៉ាង ៖ `-710` មិនមែន `05` ➜ មិនមែនភស្តុតាង', retCodeOnly.signedOk === true && Array.isArray(retCodeOnly.signed)
        && retCodeOnly.signed.indexOf(RET_CODE) === -1, retCodeOnly.signed);

    // ⛔ E8 ៖ តារាង «📋 វាលដែល ZoeW អាន» ក្នុង `ZTO-SETUP-KH.md` ដេរីវេពីកូដ ៖ រាល់ឈ្មោះវាលក្នុងបញ្ជីផ្លូវរបស់ Function ត្រូវមានក្នុងផ្នែកនោះ
    //    (វាលថ្មីក្នុងកូដ ➜ ឯកសារចាស់ ➜ ធ្លាក់)។
    const setupDoc = readOr(path.join(ROOT, 'ZoeW', 'ZTO-SETUP-KH.md'));
    const fieldsAt = setupDoc.indexOf('### 📋 វាលដែល ZoeW អានពីជួរដេកបញ្ជី ZTO');
    const fieldsEnd = fieldsAt === -1 ? -1 : setupDoc.indexOf('\n### ', fieldsAt + 10);
    const fieldsDoc = fieldsAt === -1 ? '' : setupDoc.slice(fieldsAt, fieldsEnd === -1 ? undefined : fieldsEnd);
    const pathList = (name) => {
        const m = new RegExp('const ' + name + ' = (\\[[^\\]]*\\])').exec(FUNCTION_SRC);
        try { return m ? JSON.parse(m[1].replace(/'/g, '"')) : []; } catch (_) { return []; }
    };
    const docFields = [].concat(pathList('BARCODE_PATHS'), ['scanBillCode'], pathList('PHONE_PATHS'), pathList('LIST_TIME_PATHS'),
        pathList('LIST_SCAN_CODE_PATHS'), pathList('LIST_SCAN_DESC_PATHS'), pathList('LIST_SITE_NAME_PATHS'), pathList('LIST_ORIGIN_PATHS'),
        pathList('COD_PATHS').slice(0, 1), pathList('DOD_PATHS').slice(0, 1));
    ok('ជាន់អប្បបរមា ៖ ស្រង់បញ្ជីវាលពី Function បាន (≥ ២០) · ផ្នែក «📋 វាល» មានក្នុង ZTO-SETUP-KH.md', docFields.length >= 20 && fieldsDoc.length > 200,
        { fields: docFields.length, doc: fieldsDoc.length });
    ok('⛔ E8 ៖ រាល់វាលដែល Function អានពីជួរដេកបញ្ជី មានក្នុងតារាង «📋 វាល» របស់ ZTO-SETUP-KH.md',
        docFields.filter((f) => fieldsDoc.indexOf('`' + f + '`') === -1).length === 0,
        docFields.filter((f) => fieldsDoc.indexOf('`' + f + '`') === -1));

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ២៣. ⛔ សំណើ «ចុះហត្ថលេខា» ក្រោយ 401 ៖ Cookie ថ្មីពី store ត្រូវប្រើសម្រាប់ទាំង ២ (ZTO-E5) ==');
    // ═════════════════════════════════════════════════════════════════════
    // `withSigned=1` ចាប់ផ្តើមសំណើ «មកដល់» និង «ចុះហត្ថលេខា» ស្របគ្នាដោយ Cookie ក្នុងសតិដដែល។ Cookie នោះផុត ➜ ZTO បដិសេធទាំង ២
    // ➜ `retryAfterAuthRejected()` អាន store ឃើញ Cookie ថ្មី ហើយសាក «មកដល់» ម្តងទៀត។ 🔴 មុនកែ ៖ សំណើ «ចុះហត្ថលេខា» នៅជាប់
    // សាលក្រម 401 របស់ Cookie ចាស់ ➜ `mergeSignedCompanion()` ➜ `signedOk:false` ➜ App ចាត់ភស្តុតាង «ចុះហត្ថលេខា» ថាធ្លាក់ ទោះ Cookie
    // ថ្មីដើរ (ការបិទតាម ZTO រំលងជុំនោះ)។ ច្បាប់ ៖ ក្រោយការសាកឡើងវិញជោគជ័យ សំណើ «ចុះហត្ថលេខា» ដែលត្រូវបដិសេធ រត់ម្តងទៀតដោយ
    // Cookie ថ្មី (single-flight តាម fingerprint ថ្មី · ក្នុងថវិកា · ស្របគ្នាជាមួយ «មកដល់») ហើយត្រូវរង់ចាំ **មុន** `flushCookieRenewal()` ·
    // សំណើដែលជោគជ័យរួច មិនរត់ម្តងទៀតទេ · ចម្លើយ `signedOk:false` មិនដែលចូល cache។
    // ⛔ ការសម្រេច ៖ «មកដល់» ជោគជ័យ តែ «ចុះហត្ថលេខា» ត្រូវបដិសេធ ➜ Cookie ដដែលត្រូវ ZTO ទទួលរួច ➜ មិនមែនបញ្ហា Cookie ចាស់ ➜ មិនអាន store
    //    មិនសាកម្តងទៀត · `signedOk:false` (មិនចូល cache ➜ ជុំបន្ទាប់សួរពិត) — ដូចមុនកែ។
    {
        const OLD_COOKIE = 'BOS-MAN-SESSION=memory-cookie-old-110011; sidebarStatus=1';
        const FRESH_COOKIE = 'BOS-MAN-SESSION=store-cookie-fresh-220022; sidebarStatus=1';
        const SIGNED_EXPECTED = '["77130500002101","77130500002103"]';
        const RETRY_SLACK = 300;
        const TIGHT_ENV = { ZTO_REQUEST_BUDGET_MS: '4000', ZTO_UPSTREAM_TIMEOUT_MS: '2000' };
        const etagOf = (v) => '"' + crypto.createHash('sha256').update(String(v || '')).digest('hex') + '"';
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const signedOf = (body) => JSON.stringify((Array.isArray(body.signed) ? body.signed : []).slice().sort());
        const retryRun = async (opts) => {
            const o = opts || {};
            const blobState = { value: OLD_COOKIE, reads: 0, writes: [] };
            const store = {
                get: async () => blobState.value,
                getWithMetadata: async () => {
                    blobState.reads++;
                    return { data: blobState.value, etag: etagOf(blobState.value), metadata: {} };
                },
                set: async (key, value, options) => {
                    blobState.writes.push(value);
                    if (options && options.onlyIfMatch && options.onlyIfMatch !== etagOf(blobState.value)) return { modified: false };
                    blobState.value = value;
                    return { modified: true, etag: etagOf(value) };
                }
            };
            if (typeof proxy.setBlobsModuleForTests === 'function') {
                proxy.setBlobsModuleForTests({ connectLambda() {}, getStore() { return store; } });
            }
            resetEnv(Object.assign({}, GOOD_LIST_ENV, { ZTO_AUTHORIZATION: undefined, ZTO_COOKIE: undefined }, o.env || {}));
            const eventOf = (method, query) => ({
                httpMethod: method,
                headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-id-token': tokenForSite(LIST_SITE), 'x-nf-site-id': 'site-for-tests', 'x-nf-deploy-id': 'deploy-for-tests' },
                blobs: Buffer.from(JSON.stringify({ url: 'https://blobs.netlify.test', token: 'blob-token-for-tests' })).toString('base64'),
                queryStringParameters: query
            });
            const callOnce = async () => {
                try { return await proxy.handler(eventOf('GET', listQuery({ withSigned: '1' }))); }
                catch (e) { return { statusCode: 500, body: JSON.stringify({ code: 'HANDLER_THREW', detail: String(e && e.message) }) }; }
            };
            const sent = [];
            global.fetch = withCerts(async () => { throw new Error('ZTO must not be called during warm-up'); });
            let warmed = null;
            try { warmed = await proxy.handler(eventOf('OPTIONS')); } catch (_) { warmed = null; }
            blobState.value = o.storeValue || FRESH_COOKIE;
            const readsBefore = blobState.reads;
            const t0 = Date.now();
            global.fetch = withCerts(async (href, init) => {
                const type = typeOf(init);
                const cookie = String(((init || {}).headers || {}).Cookie || '');
                const fresh = cookie.indexOf('store-cookie-fresh-220022') !== -1;
                sent.push({ type: type, fresh: fresh, old: cookie.indexOf('memory-cookie-old-110011') !== -1, at: Date.now() - t0 });
                if (o.onSend) o.onSend(type, fresh);
                const wait = o.latency ? o.latency(type, fresh) : 5;
                if (wait) await sleep(wait);
                const verdict = o.accept ? o.accept(type, fresh) : fresh;
                const status = verdict === true ? 200 : (verdict === false ? 401 : verdict);
                const accepted = status === 200;
                const lines = accepted && o.setCookie ? (o.setCookie(type, fresh) || []) : [];
                return {
                    ok: accepted, status: status,
                    headers: {
                        get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null),
                        getSetCookie: () => lines.map((line) => line + '; Path=/; HttpOnly')
                    },
                    json: async () => (accepted ? byType(type) : { code: '401', message: 'unauthorized' })
                };
            });
            const joinAfter = o.joinAfterMs === undefined ? null : sleep(o.joinAfterMs).then(callOnce);
            const res = await callOnce();
            const ms = Date.now() - t0;
            const joined = joinAfter ? await joinAfter : null;
            const firstSent = sent.slice();
            let again = null;
            if (o.again) {
                const res2 = await callOnce();
                again = { body: bodyOf(res2), status: res2.statusCode, sent: sent.slice(firstSent.length) };
            }
            if (typeof proxy.setBlobsModuleForTests === 'function') proxy.setBlobsModuleForTests(null);
            return {
                warmed: warmed, res: res, status: res.statusCode, body: bodyOf(res), ms: ms, sent: firstSent, again: again,
                joined: joined && { status: joined.statusCode, body: bodyOf(joined) },
                readsAfterWarm: blobState.reads - readsBefore, stored: blobState.value, writes: blobState.writes
            };
        };
        const countOf = (sent, type, fresh) => sent.filter((s) => s.type === type && s.fresh === fresh).length;

        const main = await retryRun({ again: true });
        ok('ជាន់អប្បបរមា ៖ OPTIONS កំដៅ Cookie ចាស់ពី store ចូលសតិ (204 · គ្មានការហៅ ZTO)',
            !!main.warmed && main.warmed.statusCode === 204, main.warmed && main.warmed.statusCode);
        ok('ជាន់អប្បបរមា ៖ សំណើដំបូង «មកដល់» + «ចុះហត្ថលេខា» ផ្ញើ Cookie ចាស់ពីសតិ (ZTO បដិសេធ)',
            main.sent.length >= 2 && JSON.stringify(main.sent.slice(0, 2).map((s) => s.type).sort()) === '["03","05"]'
            && main.sent.slice(0, 2).every((s) => s.old && !s.fresh), main.sent);
        ok('ជាន់អប្បបរមា ៖ 401 ➜ អាន store ឡើងវិញ ➜ «មកដល់» សាកម្តងទៀតដោយ Cookie ថ្មី ➜ 200 · ២ ជួរ',
            main.status === 200 && rowsOf(main.body).length === 2 && countOf(main.sent, '03', true) === 1 && main.readsAfterWarm >= 1,
            { status: main.status, rows: rowsOf(main.body).length, sent: main.sent, reads: main.readsAfterWarm });
        ok('⛔ «ចុះហត្ថលេខា» ដែលត្រូវបដិសេធដោយ Cookie ចាស់ រត់ម្តងទៀតដោយ Cookie ថ្មី ➜ `signedOk:true` + barcode ដែលចុះហត្ថលេខា',
            main.body.signedOk === true && signedOf(main.body) === SIGNED_EXPECTED,
            { signedOk: main.body.signedOk, signed: main.body.signed, code: main.body.code });
        ok('⛔ ការរត់ម្តងទៀតមានតែ ១ ដងក្នុងមួយប្រភេទ (ZTO ៤ សំណើ ៖ ចាស់ ០៣ · ចាស់ ០៥ · ថ្មី ០៣ · ថ្មី ០៥)',
            main.sent.length === 4 && countOf(main.sent, '05', true) === 1 && countOf(main.sent, '05', false) === 1,
            main.sent.map((s) => s.type + (s.fresh ? ':fresh' : ':old')));
        ok('⛔ ចម្លើយ `signedOk:true` ក្រោយការសាកឡើងវិញចូល cache ➜ ការហៅដដែលបន្ទាប់ `cached:true` · គ្មានការហៅ ZTO',
            !!main.again && main.again.body.cached === true && main.again.body.signedOk === true && main.again.sent.length === 0,
            main.again && { cached: main.again.body.cached, signedOk: main.again.body.signedOk, sent: main.again.sent.length });
        ok('⛔ ការសាកឡើងវិញនៅក្នុងថវិកា (' + main.ms + ' ms ≤ 9000)', main.ms <= 9000, main.ms);

        // ⛔ k2 ៖ «មកដល់» សាកឡើងវិញធ្លាក់ (429) ➜ ចម្លើយកំហុសមិនរង់ចាំសំណើ «ចុះហត្ថលេខា» ថ្មីដែលលទ្ធផលត្រូវបោះចោល។
        const rateLimited = await retryRun({ env: TIGHT_ENV, accept: (type, fresh) => (fresh ? (type === '03' ? 429 : true) : false),
            latency: (type, fresh) => (fresh && type === '05' ? 1500 : 5) });
        ok('⛔ k2 ៖ «មកដល់» សាកឡើងវិញ 429 ➜ ឆ្លើយ 429 ភ្លាម (' + rateLimited.ms + ' ms < 1000 · មិនរង់ចាំ «ចុះហត្ថលេខា» ថ្មី ១៥០០ ms)',
            rateLimited.status === 429 && rateLimited.ms < 1000, { status: rateLimited.status, ms: rateLimited.ms, sent: rateLimited.sent });
        const kept = await retryRun({ accept: (type, fresh) => type === '05' || fresh });
        ok('ជាន់អប្បបរមា ៖ «មកដល់» ត្រូវបដិសេធ ហើយសាកម្តងទៀតដោយ Cookie ថ្មី ➜ 200',
            kept.status === 200 && rowsOf(kept.body).length === 2 && countOf(kept.sent, '03', true) === 1,
            { status: kept.status, sent: kept.sent });
        ok('⛔ ទិសផ្ទុយ ៖ «ចុះហត្ថលេខា» ដែលជោគជ័យរួច (ទោះ «មកដល់» ត្រូវបដិសេធ) មិនរត់ម្តងទៀតទេ ➜ ZTO ៣ សំណើ · `signedOk:true`',
            kept.body.signedOk === true && signedOf(kept.body) === SIGNED_EXPECTED
            && kept.sent.length === 3 && countOf(kept.sent, '05', true) === 0,
            { signedOk: kept.body.signedOk, sent: kept.sent.map((s) => s.type + (s.fresh ? ':fresh' : ':old')) });

        const still = await retryRun({ again: true, accept: (type, fresh) => type === '03' && fresh });
        ok('⛔ «ចុះហត្ថលេខា» ត្រូវបដិសេធទាំង Cookie ថ្មី ➜ បញ្ជីមកដល់នៅ 200 · `signedOk:false` (មិនមែនកំហុសទាំងមូល)',
            still.status === 200 && rowsOf(still.body).length === 2 && still.body.signedOk === false,
            { status: still.status, signedOk: still.body.signedOk });
        ok('⛔ ការរត់ម្តងទៀតមានព្រំដែន ៖ «ចុះហត្ថលេខា» ដោយ Cookie ថ្មីយ៉ាងច្រើន ១ ដង (គ្មានរង្វិលជុំ)',
            countOf(still.sent, '05', true) <= 1 && still.sent.length <= 4, still.sent.map((s) => s.type + (s.fresh ? ':fresh' : ':old')));
        ok('⛔ `signedOk:false` មិនចូល cache ➜ ការហៅបន្ទាប់សួរ ZTO ពិត',
            !!still.again && still.again.body.cached === false && still.again.sent.length >= 1,
            still.again && { cached: still.again.body.cached, sent: still.again.sent.length });

        const onlySignedRejected = await retryRun({ again: true, accept: (type, fresh) => type === '03' || fresh });
        ok('⛔ ការសម្រេច ៖ «មកដល់» ជោគជ័យ · «ចុះហត្ថលេខា» ត្រូវបដិសេធ ➜ 200 · ២ ជួរ · `signedOk:false`',
            onlySignedRejected.status === 200 && rowsOf(onlySignedRejected.body).length === 2 && onlySignedRejected.body.signedOk === false,
            { status: onlySignedRejected.status, signedOk: onlySignedRejected.body.signedOk });
        ok('⛔ ការសម្រេច ៖ Cookie ដែល «មកដល់» ទទួលរួច ➜ មិនអាន store · មិនសាកម្តងទៀត (ZTO ២ សំណើ)',
            onlySignedRejected.readsAfterWarm === 0 && onlySignedRejected.sent.length === 2,
            { reads: onlySignedRejected.readsAfterWarm, sent: onlySignedRejected.sent.map((s) => s.type + (s.fresh ? ':fresh' : ':old')) });
        ok('⛔ ការសម្រេច ៖ `signedOk:false` មិនចូល cache ➜ ការហៅបន្ទាប់សួរ ZTO ពិត',
            !!onlySignedRejected.again && onlySignedRejected.again.body.cached === false && onlySignedRejected.again.sent.length >= 1,
            onlySignedRejected.again && { cached: onlySignedRejected.again.body.cached, sent: onlySignedRejected.again.sent.length });

        const rotated = await retryRun({
            latency: (type, fresh) => (type === '05' && fresh ? 80 : 5),
            setCookie: (type, fresh) => (type === '05' && fresh ? ['BOS-MAN-SESSION=rotated-by-signed-retry-330033'] : [])
        });
        ok('ជាន់អប្បបរមា ៖ ការរត់ម្តងទៀតដែលបង្វិល Cookie ឆ្លើយ 200 + `signedOk:true`',
            rotated.status === 200 && rotated.body.signedOk === true, { status: rotated.status, signedOk: rotated.body.signedOk });
        ok('⛔ Cookie ដែល ZTO បង្វិលក្នុងការរត់ម្តងទៀត (មកក្រោយ «មកដល់») ត្រូវសរសេរចូល store (រង់ចាំមុន `flushCookieRenewal()`)',
            String(rotated.stored).indexOf('rotated-by-signed-retry-330033') !== -1, { stored: rotated.stored, writes: rotated.writes });

        const slowOld = await retryRun({ env: TIGHT_ENV, latency: (type, fresh) => (type === '05' && !fresh ? 1500 : 30) });
        ok('⛔ «ចុះហត្ថលេខា» ចាស់យឺត (1500 ms) តែថវិកានៅសល់ ➜ រត់ម្តងទៀត ➜ `signedOk:true` ក្នុងថវិកា ('
            + slowOld.ms + ' ms ≤ ' + (4000 + RETRY_SLACK) + ')',
            slowOld.status === 200 && slowOld.body.signedOk === true && slowOld.ms <= 4000 + RETRY_SLACK,
            { status: slowOld.status, signedOk: slowOld.body.signedOk, ms: slowOld.ms });

        const parallel = await retryRun({ env: TIGHT_ENV, latency: (type, fresh) => (fresh ? 1200 : 20) });
        ok('⛔ ការរត់ម្តងទៀតស្របគ្នាជាមួយ «មកដល់» (ZTO 1200 ms ម្នាក់ៗ ➜ ' + parallel.ms + ' ms < 2400 · `signedOk:true`)',
            parallel.status === 200 && parallel.body.signedOk === true && parallel.ms < 2400,
            { status: parallel.status, signedOk: parallel.body.signedOk, ms: parallel.ms });

        const notAuth = await retryRun({ accept: (type, fresh) => (fresh ? true : (type === '05' ? 503 : false)) });
        ok('⛔ «ចុះហត្ថលេខា» ធ្លាក់ដោយហេតុផលមិនមែន Cookie (ZTO 503) ➜ មិនរត់ម្តងទៀតដោយ Cookie ថ្មី (ZTO មិនត្រូវបង្ខំ) · `signedOk:false` · 200',
            notAuth.status === 200 && rowsOf(notAuth.body).length === 2 && notAuth.body.signedOk === false
            && countOf(notAuth.sent, '05', true) === 0 && countOf(notAuth.sent, '03', true) === 1,
            { status: notAuth.status, signedOk: notAuth.body.signedOk, sent: notAuth.sent.map((s) => s.type + (s.fresh ? ':fresh' : ':old')) });

        const joinedRun = await retryRun({ joinAfterMs: 150, latency: (type, fresh) => (fresh ? 300 : 5) });
        ok('ជាន់អប្បបរមា ៖ សំណើទី ២ (Cookie ថ្មីក្នុងសតិរួច) ចាប់ផ្តើមកំឡុងការរត់ម្តងទៀត ➜ ទាំង ២ ឆ្លើយ 200 + `signedOk:true`',
            joinedRun.status === 200 && joinedRun.body.signedOk === true && !!joinedRun.joined
            && joinedRun.joined.status === 200 && joinedRun.joined.body.signedOk === true,
            { first: [joinedRun.status, joinedRun.body.signedOk], second: joinedRun.joined });
        ok('⛔ single-flight តាម fingerprint Cookie ថ្មី ៖ សំណើទី ២ ចូលរួមការរត់ម្តងទៀត ➜ «ចុះហត្ថលេខា» ដោយ Cookie ថ្មីតែ ១ ដង',
            countOf(joinedRun.sent, '05', true) === 1 && countOf(joinedRun.sent, '03', true) === 1,
            joinedRun.sent.map((s) => s.type + (s.fresh ? ':fresh' : ':old')));

        // ⛔ **ការធ្លាក់ដែលបោះ** (dependency បោះ) ៖ `companionRun` ត្រូវតែឆ្លើយ (outcome ឬ `null`) មិនដែល reject ទេ — handler រង់ចាំវាដោយគ្មាន
        //    `try` ហើយផ្លូវ 401 ទុកវាចោល (reject ដែលគ្មានអ្នកចាប់ = Function គាំង)។ ចាក់ការបោះនៅ `new AbortController()` របស់ `requestOnce()`
        //    ៖ (ក) សំណើ «ចុះហត្ថលេខា» ដើម (ទទួល `null`) · (ខ) ការរត់ម្តងទៀតខ្លួនឯង។
        const RealAbortController = global.AbortController;
        let throwNextController = false;
        global.AbortController = class extends RealAbortController {
            constructor() {
                if (throwNextController) { throwNextController = false; throw new Error('AbortController injected failure'); }
                super();
            }
        };
        const unhandled = [];
        const onUnhandled = (reason) => { unhandled.push(String(reason && reason.message || reason)); };
        process.on('unhandledRejection', onUnhandled);
        let thrownPrior;
        let thrownRerun;
        try {
            thrownPrior = await retryRun({ onSend: (type, fresh) => { if (type === '03' && !fresh) throwNextController = true; } });
            thrownRerun = await retryRun({
                latency: (type, fresh) => (type === '05' && !fresh ? 60 : 5),
                onSend: (type, fresh) => { if (type === '03' && fresh) throwNextController = true; }
            });
            await sleep(50);
        } finally {
            global.AbortController = RealAbortController;
            throwNextController = false;
            process.removeListener('unhandledRejection', onUnhandled);
        }
        ok('⛔ ការចាក់ (ក) និង (ខ) ៖ គ្មាន promise reject ដែលគ្មានអ្នកចាប់ (Function មិនគាំង)', unhandled.length === 0, unhandled);
        ok('ជាន់អប្បបរមា ៖ ការចាក់ (ក) ធ្វើឲ្យ «ចុះហត្ថលេខា» ដើមមិនបានផ្ញើ (ZTO មិនឃើញ ០៥ ចាស់)',
            countOf(thrownPrior.sent, '05', false) === 0 && countOf(thrownPrior.sent, '03', true) === 1,
            thrownPrior.sent.map((s) => s.type + (s.fresh ? ':fresh' : ':old')));
        ok('⛔ (ក) «ចុះហត្ថលេខា» ដើមបោះ ➜ handler មិនបោះ · បញ្ជីមកដល់ 200 · `signedOk:false`',
            thrownPrior.status === 200 && rowsOf(thrownPrior.body).length === 2 && thrownPrior.body.signedOk === false,
            { status: thrownPrior.status, body: thrownPrior.body.code || thrownPrior.body.signedOk });
        ok('ជាន់អប្បបរមា ៖ ការចាក់ (ខ) ធ្វើឲ្យការរត់ម្តងទៀតមិនបានផ្ញើ (ZTO មិនឃើញ ០៥ ថ្មី)',
            countOf(thrownRerun.sent, '05', false) === 1 && countOf(thrownRerun.sent, '05', true) === 0,
            thrownRerun.sent.map((s) => s.type + (s.fresh ? ':fresh' : ':old')));
        ok('⛔ (ខ) ការរត់ម្តងទៀតបោះ ➜ handler មិនបោះ · បញ្ជីមកដល់ 200 · `signedOk:false`',
            thrownRerun.status === 200 && rowsOf(thrownRerun.body).length === 2 && thrownRerun.body.signedOk === false,
            { status: thrownRerun.status, body: thrownRerun.body.code || thrownRerun.body.signedOk });

        const exhausted = await retryRun({ env: TIGHT_ENV, latency: (type, fresh) => (type === '05' ? (fresh ? 2500 : 1800) : 30) });
        ok('⛔ ថវិកាមិនគ្រប់ ➜ ឆ្លើយក្នុងថវិកា (' + exhausted.ms + ' ms ≤ ' + (4000 + RETRY_SLACK) + ') · បញ្ជីមកដល់ 200 · `signedOk:false`',
            exhausted.status === 200 && rowsOf(exhausted.body).length === 2 && exhausted.body.signedOk === false
            && exhausted.ms <= 4000 + RETRY_SLACK,
            { status: exhausted.status, signedOk: exhausted.body.signedOk, ms: exhausted.ms });
    }

    // ⛔ client ៖ ទំព័រ ១ សុំ `withSigned=1` · ជុំបិទតាម ZTO សុំ `signed=1` (ស្នាមភ្ជាប់ទៅ Function)
    const urlFn = extractFn(APP_SRC, 'buildZtoListApiUrl') || '';
    ok('⛔ client ៖ URL បញ្ជីគាំទ្រ `withSigned=1` · `signed=1` · `signed=1&exact=1`',
        urlFn.indexOf("'&withSigned=1'") !== -1 && urlFn.indexOf("'&signed=1'") !== -1 && urlFn.indexOf("'&signed=1&exact=1'") !== -1, urlFn.slice(0, 300));
    const signedPagesFn = extractFn(APP_SRC, 'fetchZtoSignedPages') || '';
    ok('⛔ E3/F1 ៖ ការអានរបស់ជុំបិទតាម ZTO (`fetchZtoSignedPages`) សុំជួរពិត (`signedExact`) គ្រប់ទំព័រ · ទំព័របន្ថែមរបស់ប្រអប់បញ្ជីប្រើ `signed`',
        (signedPagesFn.match(/'signedExact'/g) || []).length === 2 && signedPagesFn.indexOf("'signed')") === -1, signedPagesFn.slice(0, 400));
    const allPagesFn = extractFn(APP_SRC, 'fetchZtoListAllPages') || '';
    ok('⛔ client ៖ ទំព័រ ១ ជាមួយ `withSigned` · ទំព័របន្ទាប់ស្របគ្នា (`Promise.all`)',
        /fetchZtoListPage\([^)]*1, 'withSigned'\)/.test(allPagesFn) && allPagesFn.indexOf('Promise.all(') !== -1, allPagesFn.slice(0, 200));

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ២២. ⛔ ជួរ «ចុះហត្ថលេខា» ដែលអត្ថបទផ្ទុយ ៖ រាប់ · ប្រាប់ក្នុង `?diag=1` (មិនបាត់ស្ងាត់) ==');
    // ═════════════════════════════════════════════════════════════════════
    // ⛔ ZTO-E4 ៖ `listRowIsSigned()` (ឥឡូវ `listRowSignedVerdict()`) បដិសេធជួរដែលមានកូដ `05` តែ `scanTypeDesc` ខុសពី `ZTO_LIST_SIGNED_SCAN_DESC`
    //    (ឧ. ZTO ប្តូរភាសាផ្ញើ «Delivered») ➜ ជួរនោះចូល `otherScans` ស្ងាត់ៗ ➜ **គ្មានភស្តុតាងបិទ** ➜ កញ្ចប់ដែលអតិថិជនយករួច
    //    នៅបើក ហើយ (ក្រោយ ៧ ថ្ងៃ) ត្រូវដកលុយជា «ផុតកំណត់» ➜ App មិននិយាយអ្វីសោះ។
    // ⛔ ច្បាប់ «ភស្តុតាងវិជ្ជមាន» នៅដដែល (ជួរទាំងនោះ **មិន** ក្លាយជាភស្តុតាង) — ការកែគឺ **រាប់** វាដាច់ដោយឡែក ៖
    //    `signedMismatch` = ជួរក្នុងទំព័រ upstream នេះដែលមានកូដ «ចុះហត្ថលេខា» តែអត្ថបទផ្ទុយ ⊆ `otherScans`
    //    (ការអភិរក្ស `rows + otherScans + signedScans` = ជួរ upstream នៅដដែល) · `withSigned` ➜ ចម្លើយបញ្ចូលគ្នាផ្ទុកចំនួនរបស់
    //    សំណើ «ចុះហត្ថលេខា» ក្នុង `signedListMismatch` (ដូច `signedPages` · `signedTotal`) · `?diag=1` ➜ `list.signedMismatch`
    //    (`observed` · `count` · `ageMs`)។ ⛔ ZTO-E9 (របាយការណ៍ម្ចាស់គម្រោង ៖ សារ ⚠️ «66 ជួរ» នៅដដែលទោះប្តូរ env · browser ឃើញ «ចុះហត្ថលេខា»
    //    ត្រឹមត្រូវ) ៖ គ្មានអត្ថបទ ➜ អ្នកគ្រប់គ្រងកែមិនបាន ➜ ចម្លើយ និង `?diag=1` ផ្ទុកអត្ថបទ **ជួរផ្ទុយតែប៉ុណ្ណោះ** (≤ ៥ ផ្សេងគ្នា · ≤ ៦៤ តួ ·
    //    តួអក្សរមើលមិនឃើញនៅដដែល) + អត្ថបទដែល Server រំពឹង · ⛔ មិនដែលមាន barcode ឬអត្ថបទជួរផ្សេង (04 · មកដល់)។
    {
        const MISMATCH_SIGNED = [
            listRow({ scanBillCode: '77130500002201', scanTypeCode: '05', scanTypeDesc: 'Delivered' }),
            listRow({ scanBillCode: '77130500002202', scanTypeCode: '05', scanTypeDesc: 'Delivered' }),
            listRow({ scanBillCode: '77130500002203', scanTypeCode: '05', scanTypeDesc: 'ចុះហត្ថលេខា' }),
            listRow({ scanBillCode: '77130500002204', scanTypeCode: '04', scanTypeDesc: 'Delivery' }),
            listRow({ scanBillCode: '77130500002205', scanTypeDesc: 'Delivered' })
        ];
        const MISMATCH_ARRIVAL = [
            listRow({ scanBillCode: '77130500002206', scanTypeCode: '03' }),
            listRow({ scanBillCode: '77130500002207', scanTypeCode: '05', scanTypeDesc: 'Delivered' })
        ];
        let signedRowsNow = MISMATCH_SIGNED;
        let arrivalRowsNow = MISMATCH_ARRIVAL;
        const mmFetch = withCerts(async (href, init) => {
            seenRequests.push({ href: href, init: init });
            const rows = typeOf(init) === '05' ? signedRowsNow : arrivalRowsNow;
            return { ok: true, status: 200, headers: { get: () => 'application/json' },
                json: async () => listPayload(rows, { pages: 1, total: rows.length }) };
        });
        const mmCall = async (env, query, keep) => {
            if (!keep) resetEnv(env);
            seenRequests.length = 0;
            global.fetch = mmFetch;
            const res = await call(listQuery(query));
            return { status: res.statusCode, body: bodyOf(res), requests: seenRequests.slice() };
        };
        const diagNow = async () => {
            global.fetch = mmFetch;
            const res = await call({ diag: '1' });
            return { body: bodyOf(res), raw: String(res.body || '') };
        };
        const mmOf = (body) => listOf(body).signedMismatch || {};

        const cold = await mmCall(GOOD_LIST_ENV, { signed: '1' });
        ok('ជាន់អប្បបរមា ៖ `signed=1` ឆ្លើយ 200 · `signedOk:true` · upstream ១ សំណើ `05`',
            cold.status === 200 && cold.body.signedOk === true && cold.requests.length === 1 && typeOf(cold.requests[0].init) === '05',
            { status: cold.status, signedOk: cold.body.signedOk, n: cold.requests.length });
        ok('⛔ ភស្តុតាងវិជ្ជមាននៅដដែល ៖ មានតែ `05` + «ចុះហត្ថលេខា» ក្លាយជា `signed` («Delivered» មិនមែនភស្តុតាង)',
            JSON.stringify(cold.body.signed) === '["77130500002203"]', cold.body.signed);
        ok('⛔ ជួរ `05` + អត្ថបទផ្ទុយ ➜ រាប់ក្នុង `signedMismatch` (= ២) · មិនរាប់កូដ `04` ឬជួរគ្មានកូដ',
            cold.body.signedMismatch === 2, cold.body.signedMismatch);
        ok('⛔ E9 ៖ ចម្លើយផ្ទុកអត្ថបទជួរផ្ទុយ (`signedMismatchTexts` = ["Delivered"]) + អត្ថបទដែល Server រំពឹង («ចុះហត្ថលេខា»)',
            JSON.stringify(cold.body.signedMismatchTexts) === '["Delivered"]' && JSON.stringify(cold.body.signedDescExpected) === '["ចុះហត្ថលេខា","签收","Signed"]',
            { texts: cold.body.signedMismatchTexts, expected: cold.body.signedDescExpected });
        ok('⛔ E9 ៖ អត្ថបទជួរមិនផ្ទុយ (04 «Delivery») មិនឆ្លងកាត់ទៅ browser',
            JSON.stringify(cold.body).indexOf('Delivery') === -1, true);
        ok('⛔ `signedMismatch` ⊆ `otherScans` · ការអភិរក្ស `rows + otherScans + signedScans` = ជួរ upstream នៅដដែល',
            cold.body.otherScans === 4 && cold.body.signedScans === 1 && cold.body.signedMismatch <= cold.body.otherScans
            && rowsOf(cold.body).length + cold.body.otherScans + cold.body.signedScans === MISMATCH_SIGNED.length,
            { rows: rowsOf(cold.body).length, other: cold.body.otherScans, signedScans: cold.body.signedScans, mismatch: cold.body.signedMismatch });

        const diagHot = await diagNow();
        ok('⛔ `?diag=1` ៖ `list.signedMismatch` ឃើញ (`observed:true` · `count:2` · `ageMs` ជាលេខ)',
            mmOf(diagHot.body).observed === true && mmOf(diagHot.body).count === 2
            && typeof mmOf(diagHot.body).ageMs === 'number' && mmOf(diagHot.body).ageMs >= 0, mmOf(diagHot.body));
        ok('⛔ E9 ៖ `?diag=1` `list.signedMismatch.texts` = ["Delivered"] · `expected` = ["ចុះហត្ថលេខា","签收","Signed"]',
            JSON.stringify(mmOf(diagHot.body).texts) === '["Delivered"]' && JSON.stringify(mmOf(diagHot.body).expected) === '["ចុះហត្ថលេខា","签收","Signed"]', mmOf(diagHot.body));
        ok('⛔ `?diag=1` គ្មាន barcode · គ្មានអត្ថបទជួរមិនផ្ទុយ («Delivery»)',
            diagHot.raw.indexOf('77130500002201') === -1 && diagHot.raw.indexOf('Delivery') === -1, diagHot.raw.slice(0, 200));

        const both = await mmCall(GOOD_LIST_ENV, { withSigned: '1' });
        ok('⛔ `withSigned=1` ៖ ចម្លើយបញ្ចូលគ្នាផ្ទុកចំនួនរបស់សំណើ «ចុះហត្ថលេខា» (`signedListMismatch` = ២)',
            both.status === 200 && both.body.signedOk === true && both.body.signedListMismatch === 2, both.body.signedListMismatch);
        ok('⛔ E9 ៖ `withSigned=1` ៖ អត្ថបទរបស់បញ្ជីមកដល់ (`signedMismatchTexts`) និងរបស់សំណើ «ចុះហត្ថលេខា» (`signedListMismatchTexts`) ដាច់ពីគ្នា',
            JSON.stringify(both.body.signedMismatchTexts) === '["Delivered"]' && JSON.stringify(both.body.signedListMismatchTexts) === '["Delivered"]'
            && JSON.stringify(both.body.signedDescExpected) === '["ចុះហត្ថលេខា","签收","Signed"]',
            { own: both.body.signedMismatchTexts, list: both.body.signedListMismatchTexts, expected: both.body.signedDescExpected });
        ok('⛔ `withSigned=1` ៖ `signedMismatch` របស់បញ្ជីមកដល់ = ជួររបស់វាផ្ទាល់ (= ១) ⊆ `otherScans` របស់វា',
            both.body.signedMismatch === 1 && both.body.otherScans === 1 && rowsOf(both.body).length === 1
            && rowsOf(both.body).length + both.body.otherScans + (both.body.signedScans || 0) === MISMATCH_ARRIVAL.length,
            { mismatch: both.body.signedMismatch, other: both.body.otherScans, rows: rowsOf(both.body).length });
        const diagBoth = await diagNow();
        ok('⛔ `?diag=1` រាប់ barcode ផ្សេងៗគ្នា (មកដល់ ១ ថ្មី + ចុះហត្ថលេខា ២ ដដែល = ៣ · មិនបូកស្ទួន)',
            mmOf(diagBoth.body).observed === true && mmOf(diagBoth.body).count === 3, mmOf(diagBoth.body));
        // ⛔ k1 ៖ ជុំបិទតាម ZTO អានបញ្ជីដដែលរៀងរាល់ ២០ វិ. ➜ ចំនួនមិនត្រូវកើនរហូត (🩺 «ZTO ផ្ញើ N កញ្ចប់» ត្រូវតែពិត)។
        const dayKey = (back) => new Date(Date.parse(todayKey + 'T00:00:00Z') - back * 86400000).toISOString().slice(0, 10);
        let repeatUpstream = 0;
        for (let i = 1; i <= 4; i++) {
            const r = await mmCall(GOOD_LIST_ENV, { signed: '1', from: dayKey(i), to: dayKey(i) }, true);
            repeatUpstream += r.requests.length;
        }
        const diagRepeat = await diagNow();
        ok('⛔ k1 ៖ អានបញ្ជីដដែល ៤ ដងទៀត (ជួរថ្ងៃផ្សេង ➜ upstream ពិត ៤) ➜ `count` នៅ ៣ (មិនមែន ១១)',
            repeatUpstream === 4 && mmOf(diagRepeat.body).count === 3, { upstream: repeatUpstream, diag: mmOf(diagRepeat.body) });
        const prevSigned = signedRowsNow;
        signedRowsNow = MISMATCH_SIGNED.concat([listRow({ scanBillCode: '77130500002210', scanTypeCode: '05', scanTypeDesc: 'Delivered' })]);
        await mmCall(GOOD_LIST_ENV, { signed: '1', from: dayKey(5), to: dayKey(5) }, true);
        signedRowsNow = prevSigned;
        const diagNew = await diagNow();
        ok('ទិសផ្ទុយ ៖ barcode ថ្មីមួយ ➜ `count` ៤', mmOf(diagNew.body).count === 4, mmOf(diagNew.body));
        const bothCached = await mmCall(GOOD_LIST_ENV, { withSigned: '1' }, true);
        ok('⛔ cache ៖ ចម្លើយ `withSigned` ពី cache នៅផ្ទុកចំនួនដដែល',
            bothCached.body.cached === true && bothCached.body.signedListMismatch === 2 && bothCached.body.signedMismatch === 1,
            { cached: bothCached.body.cached, list: bothCached.body.signedListMismatch, own: bothCached.body.signedMismatch });

        signedRowsNow = [listRow({ scanBillCode: '77130500002208', scanTypeCode: '05', scanTypeDesc: 'ចុះហត្ថលេខា' })];
        arrivalRowsNow = [listRow({ scanBillCode: '77130500002209', scanTypeCode: '03' })];
        const clean = await mmCall(GOOD_LIST_ENV, { withSigned: '1' });
        ok('ទិសផ្ទុយ E9 ៖ គ្មានអត្ថបទផ្ទុយ ➜ គ្មានវាល `signedMismatchTexts` · `signedListMismatchTexts` · `signedDescExpected`',
            !('signedMismatchTexts' in clean.body) && !('signedListMismatchTexts' in clean.body) && !('signedDescExpected' in clean.body),
            Object.keys(clean.body));
        ok('ទិសផ្ទុយ ៖ គ្មានអត្ថបទផ្ទុយ ➜ `signedMismatch:0` · `signedListMismatch:0` (លេខ មិនមែនបាត់)',
            clean.body.signedMismatch === 0 && clean.body.signedListMismatch === 0 && clean.body.signedOk === true,
            { own: clean.body.signedMismatch, list: clean.body.signedListMismatch });
        const diagClean = await diagNow();
        ok('ទិសផ្ទុយ ៖ គ្មានអត្ថបទផ្ទុយ ➜ `?diag=1` `observed:false` · `count:0` · `ageMs:null` · `texts:[]`',
            mmOf(diagClean.body).observed === false && mmOf(diagClean.body).count === 0 && mmOf(diagClean.body).ageMs === null
            && JSON.stringify(mmOf(diagClean.body).texts) === '[]',
            mmOf(diagClean.body));

        const ZW = 'Deliv\u200Bery';
        const LONG = 'ក'.repeat(80);
        signedRowsNow = ['Delivered', ZW, 'Sign', 'Received', 'Returned', 'Signed by agent', LONG].map((desc, i) =>
            listRow({ scanBillCode: '7713050000231' + i, scanTypeCode: '05', scanTypeDesc: desc }));
        const many = await mmCall(GOOD_LIST_ENV, { signed: '1' });
        const diagMany = await diagNow();
        ok('⛔ E9 ៖ អត្ថបទផ្ទុយ ៧ ប្រភេទ ➜ ចម្លើយផ្ទុក ៥ ដំបូង (លំដាប់ដែលឃើញ) · តួអក្សរមើលមិនឃើញ (U+200B) នៅដដែល',
            Array.isArray(many.body.signedMismatchTexts) && many.body.signedMismatchTexts.length === 5
            && many.body.signedMismatchTexts[1] === ZW && many.body.signedMismatch === 7,
            { texts: many.body.signedMismatchTexts });
        ok('⛔ E9 ៖ `?diag=1` ផ្ទុក ៥ ចុងក្រោយ (ចាស់ ➜ ថ្មី · អត្ថបទដែល ZTO ប្តូរចុងក្រោយមិនត្រូវបាំងដោយអត្ថបទចាស់)',
            JSON.stringify(mmOf(diagMany.body).texts) === JSON.stringify(['Sign', 'Received', 'Returned', 'Signed by agent', 'ក'.repeat(64)]),
            mmOf(diagMany.body).texts);
        signedRowsNow = [listRow({ scanBillCode: '77130500002320', scanTypeCode: '05', scanTypeDesc: LONG })];
        const longOne = await mmCall(GOOD_LIST_ENV, { signed: '1' });
        ok('⛔ E9 ៖ អត្ថបទវែង ➜ កាត់ត្រឹម ៦៤ តួ',
            Array.isArray(longOne.body.signedMismatchTexts) && longOne.body.signedMismatchTexts[0] === 'ក'.repeat(64),
            longOne.body.signedMismatchTexts && [...String(longOne.body.signedMismatchTexts[0])].length);

        // ⛔ ZTO-E10 (payload ពិតរបស់ម្ចាស់គម្រោង ៖ Argus ប្តូរភាសា ➜ ZTO បកប្រែអត្ថបទ ៖ 05 = ខ្មែរ «ចុះហត្ថលេខា» · ចិន «签收» · អង់គ្លេស «Signed» ·
        //    03 = «អីវ៉ាន់មកដល់» · «到件» · «arrived» (ជួរ 05 ទាំង ១៨/១៨ ក្នុងភាសានីមួយៗ) ➜ ជាន់អត្ថបទទទួលអត្ថបទច្រើន (`|`) ·
        //    លំនាំដើម ៣ ភាសា · `off` = ពឹងលើកូដតែម្យ៉ាង (Netlify មិនទទួលតម្លៃ env ទទេ)។
        signedRowsNow = [
            listRow({ scanBillCode: '77130500002401', scanTypeCode: '05', scanTypeDesc: '签收' }),
            listRow({ scanBillCode: '77130500002402', scanTypeCode: '05', scanTypeDesc: 'ចុះហត្ថលេខា' }),
            listRow({ scanBillCode: '77130500002403', scanTypeCode: '05', scanTypeDesc: 'Signed' }),
            listRow({ scanBillCode: '77130500002404', scanTypeDesc: '签收' }),
            listRow({ scanBillCode: '77130500002405', scanTypeCode: '04', scanTypeDesc: '签收' }),
            listRow({ scanBillCode: '77130500002406', scanTypeCode: '05', scanTypeDesc: 'Delivered' }),
            listRow({ scanBillCode: '77130500002407', scanTypeCode: '-710', scanTypeDesc: '退货扫描' })
        ];
        const zh = await mmCall(GOOD_LIST_ENV, { signed: '1' });
        ok('⛔ E10 ៖ លំនាំដើម ៖ `05` + «签收» · «ចុះហត្ថលេខា» · «Signed» ជាភស្តុតាង · គ្មានកូដ + «签收» ជាភស្តុតាង · «Delivered» ផ្ទុយ · `04` · `-710` «退货扫描» មិនមែន (ក៏មិនផ្ទុយ)',
            JSON.stringify(zh.body.signed) === '["77130500002401","77130500002402","77130500002403","77130500002404"]' && zh.body.signedMismatch === 1
            && JSON.stringify(zh.body.signedMismatchTexts) === '["Delivered"]'
            && JSON.stringify(zh.body.signedDescExpected) === '["ចុះហត្ថលេខា","签收","Signed"]',
            { signed: zh.body.signed, mismatch: zh.body.signedMismatch, texts: zh.body.signedMismatchTexts, expected: zh.body.signedDescExpected });
        const diagZh = await diagNow();
        ok('⛔ E10 ៖ `?diag=1` ៖ លំនាំដើម ➜ `signedDescIsDefault:true` · `scanDescIsDefault:true` · `expected` = ៣ ភាសា',
            listOf(diagZh.body).signedDescIsDefault === true && listOf(diagZh.body).scanDescIsDefault === true
            && JSON.stringify(mmOf(diagZh.body).expected) === '["ចុះហត្ថលេខា","签收","Signed"]',
            listOf(diagZh.body));
        const listEnv = await mmCall(Object.assign({}, GOOD_LIST_ENV, { ZTO_LIST_SIGNED_SCAN_DESC: ' Delivered | ចុះហត្ថលេខា |  | Delivered ' }), { signed: '1' });
        ok('⛔ E10 ៖ env «Delivered | ចុះហត្ថលេខា» (ដកឃ្លា · ទទេ · ស្ទួន រំលង) ➜ ទាំង ២ ជាភស្តុតាង · «签收» «Signed» ផ្ទុយ · `expected` = ["Delivered","ចុះហត្ថលេខា"]',
            JSON.stringify(listEnv.body.signed) === '["77130500002402","77130500002406"]' && listEnv.body.signedMismatch === 2
            && JSON.stringify(listEnv.body.signedDescExpected) === '["Delivered","ចុះហត្ថលេខា"]',
            { signed: listEnv.body.signed, mismatch: listEnv.body.signedMismatch, expected: listEnv.body.signedDescExpected });
        const offEnv = await mmCall(Object.assign({}, GOOD_LIST_ENV, { ZTO_LIST_SIGNED_SCAN_DESC: 'OFF' }), { signed: '1' });
        ok('⛔ E10 ៖ env `off` ➜ ពឹងលើកូដ `05` តែម្យ៉ាង (អត្ថបទណាក៏ភស្តុតាង · គ្មានកូដ ➜ មិនមែន · `04` មិនមែន)',
            JSON.stringify(offEnv.body.signed) === '["77130500002401","77130500002402","77130500002403","77130500002406"]' && offEnv.body.signedMismatch === 0,
            { signed: offEnv.body.signed, mismatch: offEnv.body.signedMismatch });
        signedRowsNow = MISMATCH_SIGNED;
        arrivalRowsNow = [
            listRow({ scanBillCode: '77130500002411', scanTypeCode: '03' }),
            listRow({ scanBillCode: '77130500002412', scanTypeCode: '03', scanTypeDesc: '到件' }),
            listRow({ scanBillCode: '77130500002413', scanTypeCode: '03', scanTypeDesc: 'arrived' }),
            listRow({ scanBillCode: '77130500002414', scanTypeDesc: '到件' }),
            listRow({ scanBillCode: '77130500002415', scanTypeCode: '03', scanTypeDesc: 'Delivery' }),
            listRow({ scanBillCode: '77130500002416', scanTypeCode: '-710', scanTypeDesc: '退货扫描' })
        ];
        const arrDefault = await mmCall(GOOD_LIST_ENV, {});
        const arrList = await mmCall(Object.assign({}, GOOD_LIST_ENV, { ZTO_LIST_SCAN_DESC: 'អីវ៉ាន់មកដល់|Delivery' }), {});
        const arrOff = await mmCall(Object.assign({}, GOOD_LIST_ENV, { ZTO_LIST_SCAN_DESC: 'off' }), {});
        ok('⛔ E10 ៖ «មកដល់» លំនាំដើម ៣ ភាសា («អីវ៉ាន់មកដល់» · «到件» · «arrived») ➜ ជួរដេក ៤ · `03` + «Delivery» ផ្ទុយ · `-710` «退货扫描» ➜ `otherScans`',
            rowsOf(arrDefault.body).length === 4 && arrDefault.body.otherScans === 2
            && rowsOf(arrDefault.body).every((r) => r.barcode !== '77130500002415' && r.barcode !== '77130500002416'),
            { rows: rowsOf(arrDefault.body).map((r) => r.barcode), other: arrDefault.body.otherScans });
        ok('⛔ E10 ៖ env «មកដល់» ទទួលអត្ថបទច្រើនដូចគ្នា (`|`) · `off` = បិទជាន់អត្ថបទ',
            rowsOf(arrList.body).length === 2 && arrList.body.otherScans === 4
            && rowsOf(arrOff.body).length === 5 && arrOff.body.otherScans === 1,
            { list: [rowsOf(arrList.body).length, arrList.body.otherScans], off: rowsOf(arrOff.body).length });
        arrivalRowsNow = MISMATCH_ARRIVAL;
        const envDoc = readOr(path.join(ROOT, 'ZoeW', 'ZTO-SETUP-KH.md'));
        const docDefaults = ['DEFAULT_LIST_SCAN_DESC', 'DEFAULT_LIST_SIGNED_SCAN_DESC'].map((name) => {
            const m = new RegExp('const ' + name + " = '([^']*)'").exec(FUNCTION_SRC);
            return m ? m[1] : '';
        });
        const docRow = (key) => (envDoc.split('\n').find((line) => line.indexOf('| `' + key + '` |') === 0) || '');
        ok('⛔ E10 ៖ តារាង env ក្នុង `ZTO-SETUP-KH.md` ៖ លំនាំដើមអត្ថបទ ២ = កូដពិត (`|` ក្នុងតារាងសរសេរ `\\|`) · ប្រាប់ `off` (Netlify មិនទទួលតម្លៃទទេ)',
            docDefaults.every((d) => d.split('|').length === 3)
            && docRow('ZTO_LIST_SCAN_DESC').indexOf('`' + docDefaults[0].split('|').join('\\|') + '`') !== -1
            && docRow('ZTO_LIST_SIGNED_SCAN_DESC').indexOf('`' + docDefaults[1].split('|').join('\\|') + '`') !== -1
            && docRow('ZTO_LIST_SCAN_DESC').indexOf('`off`') !== -1 && docRow('ZTO_LIST_SIGNED_SCAN_DESC').indexOf('`off`') !== -1,
            { defaults: docDefaults, rows: [docRow('ZTO_LIST_SCAN_DESC'), docRow('ZTO_LIST_SIGNED_SCAN_DESC')] });

        // ⛔ ZTO-E11 (ភស្តុតាងពិត ៖ សារ E9 លើ Deploy Preview របស់ម្ចាស់គម្រោង ៖ Function ទទួល «ចុះហត្ថលេខា» (U+1785 17BB 17C7 **200B** 17A0 …)
        //    ≠ Server រំពឹង (U+1785 17BB 17C7 17A0 …) ➜ ជួរ 05 ទាំង 66 «ផ្ទុយ»)។ ZTO ដាក់ ZERO WIDTH SPACE ចន្លោះពាក្យខ្មែរ ➜ មើលមិនឃើញ ·
        //    វាយក្នុង env មិនបាន ➜ ការប្រៀបធៀបអត្ថបទរំលងតួអក្សរទម្រង់មើលមិនឃើញ (Unicode Cf) ទាំងសងខាង · អក្សរមើលឃើញខុស ➜ នៅផ្ទុយ។
        const ZTO_SIGNED_REAL = 'ចុះ\u200Bហត្ថលេខា';
        signedRowsNow = [
            listRow({ scanBillCode: '77130500002501', scanTypeCode: '05', scanTypeDesc: ZTO_SIGNED_REAL }),
            listRow({ scanBillCode: '77130500002502', scanTypeDesc: ZTO_SIGNED_REAL }),
            listRow({ scanBillCode: '77130500002503', scanTypeCode: '05', scanTypeDesc: '\uFEFFចុះ\u200Cហត្ថ\u200Dលេខា\u2060\u00AD' }),
            listRow({ scanBillCode: '77130500002504', scanTypeCode: '05', scanTypeDesc: 'ចុះ\u200Bហត្ថលេខ' }),
            listRow({ scanBillCode: '77130500002505', scanTypeCode: '05', scanTypeDesc: 'ចុះ ហត្ថលេខា' })
        ];
        const zwDefault = await mmCall(GOOD_LIST_ENV, { signed: '1' });
        ok('⛔ E11 ៖ `05` + «ចុះ\u200Bហត្ថលេខា» (អត្ថបទពិតពី ZTO) ជាភស្តុតាង · គ្មានកូដ + អត្ថបទដដែល ជាភស្តុតាង · តួអក្សរ Cf ផ្សេង (FEFF · 200C · 200D · 2060 · 00AD) រំលង · '
            + 'អក្សរបាត់ («ហត្ថលេខ») ឬដកឃ្លាមើលឃើញ ➜ នៅផ្ទុយ',
            JSON.stringify(zwDefault.body.signed) === '["77130500002501","77130500002502","77130500002503"]' && zwDefault.body.signedMismatch === 2,
            { signed: zwDefault.body.signed, mismatch: zwDefault.body.signedMismatch, texts: zwDefault.body.signedMismatchTexts });
        const zwEnvPlain = await mmCall(Object.assign({}, GOOD_LIST_ENV, { ZTO_LIST_SIGNED_SCAN_DESC: 'ចុះហត្ថលេខា' }), { signed: '1' });
        const zwEnvZw = await mmCall(Object.assign({}, GOOD_LIST_ENV, { ZTO_LIST_SIGNED_SCAN_DESC: ZTO_SIGNED_REAL }), { signed: '1' });
        ok('⛔ E11 ៖ env «ចុះហត្ថលេខា» (ការកំណត់ពិតលើ Netlify ម្ចាស់គម្រោង) និង env ដែលមាន U+200B ទទួលជួរដូចគ្នា · `expected` គ្មាន U+200B',
            JSON.stringify(zwEnvPlain.body.signed) === '["77130500002501","77130500002502","77130500002503"]'
            && JSON.stringify(zwEnvZw.body.signed) === JSON.stringify(zwEnvPlain.body.signed)
            && JSON.stringify(zwEnvZw.body.signedDescExpected) === '["ចុះហត្ថលេខា"]',
            { plain: zwEnvPlain.body.signed, zw: zwEnvZw.body.signed, expected: zwEnvZw.body.signedDescExpected });
        signedRowsNow = MISMATCH_SIGNED;
        arrivalRowsNow = [
            listRow({ scanBillCode: '77130500002511', scanTypeCode: '03', scanTypeDesc: 'អីវ៉ាន់\u200Bមកដល់' }),
            listRow({ scanBillCode: '77130500002512', scanTypeCode: '03', scanTypeDesc: 'អីវ៉ាន់មក\u200Bដល' })
        ];
        const zwArrival = await mmCall(GOOD_LIST_ENV, {});
        ok('⛔ E11 ៖ «មកដល់» ៖ «អីវ៉ាន់\u200Bមកដល់» ➜ ជួរដេក · អក្សរបាត់ ➜ `otherScans`',
            rowsOf(zwArrival.body).length === 1 && rowsOf(zwArrival.body)[0].barcode === '77130500002511' && zwArrival.body.otherScans === 1,
            { rows: rowsOf(zwArrival.body).map((r) => r.barcode), other: zwArrival.body.otherScans });
        arrivalRowsNow = MISMATCH_ARRIVAL;

        signedRowsNow = MISMATCH_SIGNED;
        arrivalRowsNow = MISMATCH_ARRIVAL;
        const textOff = await mmCall(Object.assign({}, GOOD_LIST_ENV, { ZTO_LIST_SIGNED_SCAN_DESC: '' }), { signed: '1' });
        ok('ទិសផ្ទុយ ៖ `ZTO_LIST_SIGNED_SCAN_DESC=` (ជាន់អត្ថបទបិទ) ➜ គ្មានអត្ថបទអាចផ្ទុយ ➜ `signedMismatch:0` · «Delivered» ក្លាយជាភស្តុតាង',
            textOff.body.signedMismatch === 0 && Array.isArray(textOff.body.signed) && textOff.body.signed.indexOf('77130500002201') !== -1,
            { mismatch: textOff.body.signedMismatch, signed: textOff.body.signed });
        const english = await mmCall(Object.assign({}, GOOD_LIST_ENV, { ZTO_LIST_SIGNED_SCAN_DESC: 'Delivered' }), { signed: '1' });
        ok('⛔ `ZTO_LIST_SIGNED_SCAN_DESC=Delivered` ➜ «Delivered» ជាភស្តុតាង · ជួរ `05` + «ចុះហត្ថលេខា» ក្លាយជាអត្ថបទផ្ទុយ (= ១)',
            english.body.signedMismatch === 1 && Array.isArray(english.body.signed)
            && english.body.signed.indexOf('77130500002201') !== -1 && english.body.signed.indexOf('77130500002203') === -1,
            { mismatch: english.body.signedMismatch, signed: english.body.signed });
    }
    console.log('\nសរុប ៖ ' + pass + ' ok, ' + fail + ' FAIL');
    ENV_NAMES.forEach((name) => {
        if (SAVED_ENV[name] === undefined) delete process.env[name];
        else process.env[name] = SAVED_ENV[name];
    });
    global.fetch = SAVED_FETCH;
    process.exit(fail ? 1 : 0);
})();
