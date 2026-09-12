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
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    'ZTO_LIST_PAGE_SIZE', 'ZTO_LIST_MAX_PAGES', 'ZTO_LIST_SCAN_DESC'
];
const SAVED_ENV = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
const SAVED_FETCH = global.fetch;

function resetEnv(extra) {
    ENV_NAMES.forEach((name) => { delete process.env[name]; });
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_AUTHORIZATION = 'Bearer test-token';
    Object.keys(extra || {}).forEach((name) => {
        if (extra[name] === undefined) delete process.env[name];
        else process.env[name] = extra[name];
    });
    if (proxy && typeof proxy.resetCachesForTests === 'function') proxy.resetCachesForTests();
}

// ⛔ handler ដែល **បោះ** ត្រូវក្លាយជាការធ្លាក់ដែល **មានឈ្មោះ** មិនមែន
// ជាការ crash ដែលបិទបាំងការអះអាងខាងក្រោមទាំងអស់ (វាស់រួចលើ mutation ៖
// `config.list.url` ជា `null` ➜ `.href` បោះ ➜ checker ស្លាប់ត្រង់នោះ)។
async function call(query) {
    try {
        return await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': KEY },
            queryStringParameters: query
        });
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: 'handler threw', code: 'HANDLER_THREW', detail: String(e && e.message) }) };
    }
}

const seenRequests = [];
function responder(payload, status) {
    return async (href, init) => {
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

const GOOD_LIST_ENV = { ZTO_LIST_SITE_CODE: '881859' };
const RANGE = { from: '2026-09-08', to: '2026-09-11' };

async function listCall(payload, env, query, status) {
    resetEnv(env);
    seenRequests.length = 0;
    global.fetch = responder(payload, status);
    const res = await call(Object.assign({ list: '1' }, RANGE, query || {}));
    let body = null;
    try { body = JSON.parse(res.body); } catch (_) { body = null; }
    return { status: res.statusCode, body: body, requests: seenRequests.slice() };
}

const DETAIL_ORDER = {
    success: true,
    data: { billCode: 'BAR0001', consigneePhone: '011222333', agentAmount: 4.5, arrivalServiceCharge: 1.25 }
};

async function detailCall(env, barcode) {
    resetEnv(env);
    global.fetch = responder(DETAIL_ORDER);
    const res = await call({ barcode: barcode || 'BAR0001' });
    let body = null;
    try { body = JSON.parse(res.body); } catch (_) { body = null; }
    return { status: res.statusCode, body: body };
}

async function diagCall(env) {
    resetEnv(env);
    global.fetch = responder(DETAIL_ORDER);
    const res = await call({ diag: '1' });
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
    const dormant = await listCall(listPayload([listRow()]), {});
    ok('គ្មាន `ZTO_LIST_SITE_CODE` ➜ HTTP 200 (មិនមែន 500)',
        dormant.status === 200, dormant.status);
    ok('⛔ គ្មានការកំណត់ ➜ `enabled:false`',
        !!dormant.body && dormant.body.enabled === false, dormant.body);
    ok('⛔ គ្មានការកំណត់ ➜ មូលហេតុ `site:missing`',
        !!dormant.body && dormant.body.reason === 'site:missing', dormant.body && dormant.body.reason);
    ok('⛔ «បិទ» មិនមែនកំហុស ➜ គ្មានវាល `error` (ច្បាប់ `found:false`)',
        !!dormant.body && dormant.body.error === undefined, dormant.body && dormant.body.error);
    ok('⛔ គ្មានការកំណត់ ➜ **មិនហៅ upstream សោះ**',
        dormant.requests.length === 0, dormant.requests.length);

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ២. ⛔ ការកំណត់បញ្ជីខុស មិនត្រូវសម្លាប់ការស្កេន ==');
    // ═════════════════════════════════════════════════════════════════════
    const BROKEN = [
        ['site មានតួអក្សរហាម', { ZTO_LIST_SITE_CODE: 'a b#c' }, 'site:invalid'],
        ['URL មិនមែន https', { ZTO_LIST_SITE_CODE: '881859', ZTO_LIST_URL: 'http://x.example.com/a' }, 'url:invalid'],
        ['URL ខូច', { ZTO_LIST_SITE_CODE: '881859', ZTO_LIST_URL: 'not-a-url' }, 'url:invalid'],
        ['scanType មានចន្លោះ', { ZTO_LIST_SITE_CODE: '881859', ZTO_LIST_SCAN_TYPE: 'a b' }, 'scan-type:invalid']
    ];
    for (const entry of BROKEN) {
        const label = entry[0];
        const scan = await detailCall(entry[1]);
        ok('⛔ ' + label + ' ➜ ការស្កេននៅ 200', scan.status === 200 && !!scan.body && scan.body.found === true, scan.status);
        ok('⛔ ' + label + ' ➜ លេខទូរស័ព្ទនៅមកដល់ដដែល',
            scan.body && scan.body.phone === '011222333', scan.body && scan.body.phone);
        const listed = await listCall(listPayload([listRow()]), entry[1]);
        ok('⛔ ' + label + ' ➜ បញ្ជីបិទ ដោយមូលហេតុ «' + entry[2] + '»',
            listed.status === 200 && !!listed.body && listed.body.enabled === false
            && listed.body.reason === entry[2], listed.body);
        const diag = await diagCall(entry[1]);
        ok('⛔ ' + label + ' ➜ `?diag=1` រាយមូលហេតុដដែល',
            listOf(diag.body).reason === entry[2], listOf(diag.body));
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
    ok('⛔ `scanSiteCode` ជាសាខាដែលកំណត់', cond.scanSiteCode === '881859', cond.scanSiteCode);
    ok('⛔ `scanStartTime` = ថ្ងៃចាប់ផ្តើម ០០:០០:០០',
        cond.scanStartTime === '2026-09-08 00:00:00', cond.scanStartTime);
    ok('⛔ `scanEndTime` = ថ្ងៃបញ្ចប់ ២៣:៥៩:៥៩',
        cond.scanEndTime === '2026-09-11 23:59:59', cond.scanEndTime);
    ok('⛔ `mailNos` ជា array ទទេ (ទាញតាមជួរកាលបរិច្ឆេទ)',
        Array.isArray(cond.mailNos) && cond.mailNos.length === 0, cond.mailNos);

    const customType = await listCall(listPayload([listRow()]),
        { ZTO_LIST_SITE_CODE: '881859', ZTO_LIST_SCAN_TYPE: '05', ZTO_LIST_PAGE_SIZE: '50' });
    const customSent = firstBody(customType.requests);
    ok('`ZTO_LIST_SCAN_TYPE` និង `ZTO_LIST_PAGE_SIZE` ចូលជាធរមាន',
        !!customSent && customSent.condition.scanTypeCode === '05' && customSent.pageSize === 50, customSent);

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ៤. ⛔ ការបញ្ចាំងនៅ server (PII + ទំហំ) ==');
    // ═════════════════════════════════════════════════════════════════════
    const rows = rowsOf(good.body);
    ok('ចម្លើយមាន `rows` ជា array', rows.length === 1, rows);
    const row = rows[0] || {};
    ok('⛔ ជួរដេកមានតែវាលដែលត្រូវការ ៖ `barcode·phone·cod·dod·at·ztoClosed·skip`',
        JSON.stringify(Object.keys(row).sort())
        === JSON.stringify(['at', 'barcode', 'cod', 'dod', 'phone', 'skip', 'ztoClosed']),
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
    const lifeOut = await listCall(listPayload(LIFECYCLE, { pages: 1, total: 3 }), GOOD_LIST_ENV);
    const lifeRows = rowsOf(lifeOut.body);
    ok('ជាន់អប្បបរមា ៖ ជួរដេកវដ្តជីវិតទាំង ៣ ត្រឡប់មកវិញ', lifeRows.length === 3, lifeRows.length);
    ok('⛔ `អីវ៉ាន់មកដល់` ➜ ប្រើបាន', lifeRows[0] && lifeRows[0].skip === '', lifeRows[0]);
    ok('⛔ `ការចែកចាយអីវ៉ាន់` ➜ សម្គាល់ `scan-type` (កុំឲ្យក្លាយជាកញ្ចប់ទី ២)',
        lifeRows[1] && lifeRows[1].skip === 'scan-type', lifeRows[1]);
    ok('⛔ `ចុះហត្ថលេខា` ➜ សម្គាល់ `scan-type`',
        lifeRows[2] && lifeRows[2].skip === 'scan-type', lifeRows[2]);
    ok('⛔ **`fcAmount` ជា DOD លើផ្លូវបញ្ជី** (កញ្ចប់ `ztda` ៖ COD 0 · DOD 2.5)',
        lifeRows[0] && lifeRows[0].cod === 0 && lifeRows[0].dod === 2.5, lifeRows[0]);
    ok('⛔ តម្លៃអត្ថបទប្រភេទស្កេនមិនឡើងដល់ browser',
        JSON.stringify(lifeOut.body).indexOf('ចុះហត្ថលេខា') === -1, true);

    // ⛔ **ទិសផ្ទុយដ៏សំខាន់** ៖ ការបន្ថែម `fcAmount` ត្រូវប៉ះ **តែផ្លូវបញ្ជី**។
    // ផ្លូវស្កេន (`/detail`) កំពុងដំណើរការលើផលិតកម្មជាមួយលុយពិត ➜ ការប្តូរ
    // របៀបអាន DOD នៅទីនោះ **ប៉ះលុយដោយគ្មានការស្នើ**។
    const dodDefaultsLine = /const DOD_PATHS = \[([^\]]*)\]/.exec(FUNCTION_SRC);
    ok('⛔ ទិសផ្ទុយ ៖ `fcAmount` **មិន**ស្ថិតក្នុង `DOD_PATHS` (ផ្លូវស្កេនមិនប្រែ)',
        !!dodDefaultsLine && dodDefaultsLine[1].indexOf('fcAmount') === -1,
        dodDefaultsLine && dodDefaultsLine[1]);
    const detailDod = await detailCall(GOOD_LIST_ENV);
    ok('⛔ ទិសផ្ទុយ ៖ ការស្កេនធម្មតាអាន DOD តាមវាលចាស់ដដែល',
        detailDod.body && detailDod.body.dod === 1.25, detailDod.body && detailDod.body.dod);
    const listDodPaths = /const LIST_DOD_PATHS = \[([^\]]*)\]/.exec(FUNCTION_SRC);
    ok('⛔ `LIST_DOD_PATHS` ដេរីវេពី `DOD_PATHS` (ការបន្ថែម មិនមែនការចម្លង)',
        !!listDodPaths && /concat\s*\(\s*DOD_PATHS\s*\)/.test(FUNCTION_SRC),
        listDodPaths && listDodPaths[1]);

    // ⛔ **DOD នៅតែបើកបានដោយ env ដោយ*គ្មានការកែកូដ*** ៖ ជួរដេកបញ្ជីអាន
    // `config.dodPaths` **ដដែល**នឹងផ្លូវស្កេន ➜ ថ្ងៃណាដែលរកឃើញវាល DOD ពិត
    // ក្នុង Argus គ្រាន់តែដាក់ `ZTO_FIELD_DOD=<ឈ្មោះវាល>` ➜ វាដើរភ្លាម។
    // ⛔ បើការអានប្តូរទៅបញ្ជីរឹងដាច់ដោយឡែក នោះការបើក DOD នឹងទាមទារ deploy
    // កូដថ្មី — នោះជាការថយក្រោយ។
    const dodByEnv = await listCall(
        listPayload([listRow({ arrivalFee: 1.75 })]),
        { ZTO_LIST_SITE_CODE: '881859', ZTO_FIELD_DOD: 'arrivalFee' });
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
    const c1 = bodyOf(await call(Object.assign({ list: '1' }, RANGE)));
    ok('សំណើបញ្ជីដំបូង ➜ `cached:false`', c1.cached === false, c1.cached);
    const c2 = bodyOf(await call(Object.assign({ list: '1' }, RANGE)));
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
    const c3 = bodyOf(await call(Object.assign({ list: '1' }, RANGE, { page: '2' })));
    ok('⛔ ទំព័រផ្សេង ➜ កូនសោផ្សេង (មិនប្រគល់ទំព័រ ១ វិញ)',
        c3.page === 2, c3.page);

    global.fetch = responder(listPayload([listRow()]));
    const c4 = bodyOf(await call(Object.assign({ list: '1' }, { from: '2026-09-01', to: '2026-09-02' })));
    ok('⛔ ជួរកាលបរិច្ឆេទផ្សេង ➜ កូនសោផ្សេង (មិន cache hit)',
        c4.cached === false, c4.cached);

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
    global.fetch = async () => ({
        ok: false, status: 401, headers: { get: () => 'application/json' }, json: async () => ({})
    });
    const rejected = await call(Object.assign({ list: '1' }, RANGE));
    ok('⛔ 401 ពី ZTO ➜ 401 `ZTO_AUTH_EXPIRED` (សាលក្រម auth រួម)',
        rejected.statusCode === 401 && codeOf(bodyOf(rejected)) === 'ZTO_AUTH_EXPIRED',
        { s: rejected.statusCode, b: rejected.body });

    resetEnv(GOOD_LIST_ENV);
    global.fetch = async () => ({
        ok: false, status: 503, headers: { get: () => 'application/json' }, json: async () => ({})
    });
    const down = await call(Object.assign({ list: '1' }, RANGE));
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
    ok('⛔ `fetch(` លេចម្តងគត់ក្នុង Function (ផ្លូវបណ្តាញរួម មិនចម្លង)',
        fetchCalls === 1, fetchCalls);

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
    ok('⛔ **លេខសាខាមិនលេចក្នុង `?diag=1`**',
        String(diagOn.raw || '').indexOf('881859') === -1, String(diagOn.raw || '').slice(0, 200));

    const diagOff = await diagCall({});
    ok('គ្មានការកំណត់ ➜ `list.enabled === false` ក្នុង `?diag=1`',
        listOf(diagOff.body).enabled === false, listOf(diagOff.body));

    // ═════════════════════════════════════════════════════════════════════
    console.log('\n== ១០. ខាង Client ៖ ការចាត់ថ្នាក់ ៤ ក្រុម ==');
    // ═════════════════════════════════════════════════════════════════════
    const NEEDED = ['classifyZtoListRows', 'barcodeRegistryKey', 'pickupBarcodeKey',
        'normalizeStoredPhone', 'normalizeOneStoredPhone',
        'ztoScanStampMillis', 'appZoneWallClockToMillis', 'appZoneParts',
        'barcodeAbandonIsRipe', 'trashRetentionMs', 'ztoListSignedVerdict', 'ztoListRowAgeState'];
    const CLOCK_CONST_NAMES = ['APP_TIME_ZONE', 'APP_TIME_ZONE_OFFSET_MINUTES', 'ABANDON_AGE_MS',
        'EXPIRED_TRASH_RETENTION_MS', 'TRASH_RETENTION_MS', 'ZTO_LIST_SIGNED_PROBE_MAX'];
    const NEEDED_CONSTS = CLOCK_CONST_NAMES.map((name) => constOrStub(APP_SRC, name))
        .concat([extractConst(APP_SRC, 'ztoListSignedProbe')
            || 'const ztoListSignedProbe = new Map();']);
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
    ok('⛔ `refreshZtoListSyncUi()` លាក់/បង្ហាញប៊ូតុងតាមកុងតាក់',
        refreshFn.indexOf('ztoListSyncBtn') !== -1 && /hidden/.test(refreshFn),
        refreshFn.slice(0, 300));

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
    ok('ជាន់អប្បបរមា ៖ ជួរដេកទាំង ៤ ត្រឡប់មកវិញ (មិនទម្លាក់ស្ងាត់)',
        descRows.length === 4, descRows.length);
    ok('⛔ `scanTypeDesc` ត្រូវគ្នា ➜ ជួរដេកប្រើបាន',
        !!byCode('77130500000101') && byCode('77130500000101').skip === '',
        byCode('77130500000101'));
    ok('⛔ `scanTypeDesc` **ខុស** ➜ សម្គាល់ `skip: \'scan-type\'`',
        !!byCode('77130500000102') && byCode('77130500000102').skip === 'scan-type',
        byCode('77130500000102'));
    ok('⛔ `scanTypeDesc` ទទេ ➜ **មិនរំលង** («មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស»)',
        !!byCode('77130500000103') && byCode('77130500000103').skip === '',
        byCode('77130500000103'));
    ok('⛔ វាលអវត្តមានទាំងស្រុង ➜ **មិនរំលង**',
        !!byCode('77130500000104') && byCode('77130500000104').skip === '',
        byCode('77130500000104'));
    ok('⛔ ជួរដេកមាន ៧ វាល (`skip` + `ztoClosed`) — នៅតែគ្មានឈ្មោះ/អាសយដ្ឋាន',
        JSON.stringify(Object.keys(descRows[0] || {}).sort())
        === JSON.stringify(['at', 'barcode', 'cod', 'dod', 'phone', 'skip', 'ztoClosed']),
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
    ok('ជាន់អប្បបរមា ៖ ជួរដេកទាំង ៥ ត្រឡប់មកវិញ', codeRowsOut.length === 5, codeRowsOut.length);
    ok('⛔ `scanTypeCode` = `03` និង desc ត្រូវគ្នា ➜ ប្រើបាន',
        !!byCode2('77130500000301') && byCode2('77130500000301').skip === '', byCode2('77130500000301'));
    ok('⛔ `scanTypeCode` = `04` ➜ សម្គាល់ `scan-type`',
        !!byCode2('77130500000302') && byCode2('77130500000302').skip === 'scan-type',
        byCode2('77130500000302'));
    ok('⛔ **កូដខុស ទោះអត្ថបទត្រូវ** ➜ សម្គាល់ (ជាន់ ២ ឯករាជ្យ)',
        !!byCode2('77130500000303') && byCode2('77130500000303').skip === 'scan-type',
        byCode2('77130500000303'));
    ok('⛔ `scanTypeCode` ទទេ ➜ **មិនរំលង** («មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស»)',
        !!byCode2('77130500000304') && byCode2('77130500000304').skip === '',
        byCode2('77130500000304'));
    ok('⛔ វាល `scanTypeCode` អវត្តមាន ➜ **មិនរំលង**',
        !!byCode2('77130500000305') && byCode2('77130500000305').skip === '',
        byCode2('77130500000305'));
    const codeCustom = await listCall(
        listPayload([listRow({ scanTypeCode: '07', scanTypeDesc: 'X' })]),
        { ZTO_LIST_SITE_CODE: '881859', ZTO_LIST_SCAN_TYPE: '07', ZTO_LIST_SCAN_DESC: 'X' });
    ok('⛔ `ZTO_LIST_SCAN_TYPE` ជាមូលដ្ឋាននៃការប្រៀបធៀបកូដ (មិនមែន `03` រឹង)',
        (rowsOf(codeCustom.body)[0] || {}).skip === '', rowsOf(codeCustom.body)[0]);
    ok('⛔ តម្លៃកូដមិនឡើងដល់ browser',
        JSON.stringify(codeOut.body).indexOf('"04"') === -1, true);

    // ⛔ អត្ថបទគោលអាចប្តូរតាម env — លំនាំដើមត្រូវអានចេញពីកូដពិត
    const descDefault = /const DEFAULT_LIST_SCAN_DESC = '([^']*)'/.exec(FUNCTION_SRC);
    ok('ជាន់អប្បបរមា ៖ រកលំនាំដើម `DEFAULT_LIST_SCAN_DESC` ក្នុង Function',
        !!descDefault, descDefault && descDefault[1]);
    ok('⛔ លំនាំដើមជា «អីវ៉ាន់មកដល់» (សំណើអ្នកប្រើ)',
        !!descDefault && descDefault[1] === 'អីវ៉ាន់មកដល់', descDefault && descDefault[1]);
    const descCustom = await listCall(listPayload([listRow({ scanTypeDesc: 'Arrival Scan' })]),
        { ZTO_LIST_SITE_CODE: '881859', ZTO_LIST_SCAN_DESC: 'Arrival Scan' });
    ok('`ZTO_LIST_SCAN_DESC` ជំនួសអត្ថបទគោលបាន',
        (rowsOf(descCustom.body)[0] || {}).skip === '', rowsOf(descCustom.body)[0]);
    const descOff = await listCall(listPayload([listRow({ scanTypeDesc: 'ចេញដំណើរ' })]),
        { ZTO_LIST_SITE_CODE: '881859', ZTO_LIST_SCAN_DESC: '' });
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
        'barcodeAbandonIsRipe'];
    IMPORT_NAMES.push('ztoListSkipText', 'getZoneDateKey', 'trashRetentionMs',
        'ztoListSignedVerdict', 'ztoListRowAgeState', 'ztoListRowNeedsSignedProbe',
        'resolveZtoListSignedVerdicts', 'markZtoListRowPickedUp');
    const importParts = IMPORT_NAMES.map((name) => fnOrStub(APP_SRC, name));
    const CLOCK_CONSTS = CLOCK_CONST_NAMES.map((name) => constOrStub(APP_SRC, name))
        .concat([extractConst(APP_SRC, 'ZTO_LIST_SKIP_TEXT') || 'const ZTO_LIST_SKIP_TEXT = {};',
            extractConst(APP_SRC, 'ztoListSignedProbe') || 'const ztoListSignedProbe = new Map();']);
    const importOptional = ['armLateWrite', 'releaseLateBarcodeClaim']
        .map((name) => extractFn(APP_SRC, name) || '').filter(Boolean);
    const importMissing = IMPORT_NAMES.filter((name) => !extractFn(APP_SRC, name)).length;
    ok('ជាន់អប្បបរមា ៖ ស្រង់ function ចាំបាច់ទាំងអស់សម្រាប់ sandbox',
        importMissing === 0, importMissing);

    {
        const calls = { claim: [], save: [], release: [], toast: [], probe: [], close: [] };
        const box = {
            console: console,
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
                return Promise.resolve(true);
            },
            releaseBarcodesInRegistry: (codes) => { calls.release.push(codes); },
            checkZtoStatusForBarcode: (cfg, code) => {
                calls.probe.push(code);
                if (box.__probeThrows) return Promise.reject(new Error('probe failed'));
                const verdict = box.__probeVerdict;
                return Promise.resolve(verdict === undefined ? null : { closed: verdict });
            },
            applyBarcodeCloseChange: (itemId, code, closed, opts) => {
                calls.close.push({ itemId, code, closed, opts });
                return Promise.resolve(box.__closeOk !== false);
            },
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
                + '\nglobalThis.__probeMax = ZTO_LIST_SIGNED_PROBE_MAX;', box);
            runImport = box.__run;
        } catch (e) {
            ok('sandbox នៃការបញ្ចូលរត់បាន', false, String(e && e.message));
        }
        ok('⛔ `importZtoListRows` រត់ក្នុង sandbox បាន', typeof runImport === 'function', typeof runImport);

        if (typeof runImport === 'function') {
            const FRESH = [
                { barcode: '77130500000901', phone: '855963897345', cod: 6.47, dod: 0, at: '2026-09-10 10:00:00', skip: '' },
                { barcode: '77130500000902', phone: '85560633155', cod: 2.44, dod: 0, at: '2026-09-10 10:01:00', skip: '' }
            ];
            const reset = () => {
                calls.claim.length = 0; calls.save.length = 0;
                calls.release.length = 0; calls.toast.length = 0;
                calls.probe.length = 0; calls.close.length = 0;
                box.scanHistory.length = 0;
                box.__probeVerdict = undefined; box.__probeThrows = false;
                box.__closeOk = true;
                if (box.__signedProbe) box.__signedProbe.clear();
                box.ztoListSyncInFlight = false;
                box.__stale = false; box.__claim = 'claimed';
                box.__saveThrows = false; box.__confirm = true;
                box.__claimHangs = false; box.__saveHangs = false; box.__timeoutLabel = '';
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
                box.__claimDeferreds.length === 2, box.__claimDeferreds.length);
            ok('⛔ claim ព្យួរ ➜ មិនរក្សាទុក', calls.save.length === 0, calls.save);
            ok('⛔ claim ព្យួរ ➜ មិនដោះមុនដឹងសាលក្រម', releasedCodes().length === 0, calls.release);
            box.__claimDeferreds.forEach((d) => d.resolve('claimed'));
            await flush();
            ok('⛔ claim ដែលចុះ **យឺត** ជា `claimed` ➜ ត្រូវដោះវិញ (បើអត់ ➜ កូនសោ registry កំព្រា ➜ barcode ស្កេនចូលមិនបានជារៀងរហូត)',
                releasedCodes().length === 2, calls.release);

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
                box.__saveDeferreds.length === 2, box.__saveDeferreds.length);
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
                releasedCodes().length === 2, calls.release);
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
                const groupHtmlFn = extractFn(APP_SRC, 'ztoListGroupHtml') || '';
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
                ok('⛔ ទិសផ្ទុយ ៖ ជួរដេក **ក្មេង** មិនត្រូវសម្គាល់ `closedAtZto` (ការស្កេនធម្មតាមិនប្រែ)',
                    (gradeOne(true, zoneText(NOW - AGE + 60000)).fresh[0] || {}).closedAtZto === false,
                    gradeOne(true, zoneText(NOW - AGE + 60000)).fresh[0]);

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

    console.log('\nសរុប ៖ ' + pass + ' ok, ' + fail + ' FAIL');
    ENV_NAMES.forEach((name) => {
        if (SAVED_ENV[name] === undefined) delete process.env[name];
        else process.env[name] = SAVED_ENV[name];
    });
    global.fetch = SAVED_FETCH;
    process.exit(fail ? 1 : 0);
})();
