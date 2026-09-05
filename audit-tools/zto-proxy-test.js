// ⛔ ថ្នាក់កំហុស ៖ **ZTO lookup ដែលយឺត មិនស្ថិតស្ថេរ និង auto-login ដែលមិនដែលដើរ។**
//
// 🔴 វាស់ពីផលិតកម្មពិត (របាយការណ៍អ្នកប្រើ 2026-09-01, រូបភាព ៥)៖
//   `ZTO_SESSION_STORE_UNAVAILABLE` · `login:TimeoutError` ·
//   **`login:wait-password@argus.ztoglobal.com:TimeoutError`** · `Failed to fetch`។
//   ជួរទី ៣ ជាភស្តុតាងសម្រេច ៖ `@argus.ztoglobal.com` មានន័យថា browser
//   **មិនត្រូវបានបញ្ជូនទៅ `iam-web.zto.com` ផង** ➜ IDaaS OAuth2 មិនបើកឲ្យ IP
//   របស់ Netlify ➜ auto-login **មិនអាចដំណើរការបានទេ** មិនមែនត្រឹមមានកំហុសទេ។
//
// ដូច្នេះកំណែ 2.25.0 **ដក auto-login ចេញទាំងស្រុង** ហើយឯកសារនេះ **ចាក់សោការដក
// នោះ** (ច្បាប់ទី ១៣ ៖ រកឃើញកំហុស ➜ សាងឧបករណ៍ ➜ ទើបកែ)។ បើជុំក្រោយនាំ
// Chromium/Blobs ត្រឡប់មកវិញ ឯកសារនេះធ្លាក់ភ្លាម។
//
// វាក៏ចាក់សោ **ការត្រៀមសម្រាប់ API ផ្លូវការ** ដែរ ៖ endpoint · method · body ·
// header · ឈ្មោះ field ត្រូវកំណត់បានតាម env **ដោយមិនកែកូដ**, ហើយ
// ⛔ **header ក្លែងរបស់ browser (`Origin`/`Referer`) មិនត្រូវផ្ញើទៅ API ផ្លូវការ**
// ព្រោះ WAF/CORS អាចបដិសេធសំណើ។ ការអះអាងធ្វើ **២ ខាង** គ្រប់កន្លែង។
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.ZTOPROXY_APP_DIR ? path.resolve(process.env.ZTOPROXY_APP_DIR) : path.resolve(__dirname, '..');
const FUNCTION_JS = path.join(ROOT, 'ZoeW', 'netlify', 'functions', 'zto-order-detail.js');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');
const PACKAGE_JSON = path.join(ROOT, 'ZoeW', 'package.json');
const NETLIFY_TOML = path.join(ROOT, 'ZoeW', 'netlify.toml');
const LEGACY_SESSION_JS = path.join(ROOT, 'ZoeW', 'netlify', 'lib', 'zto-session.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

function readOr(file, fallback) {
    try { return fs.readFileSync(file, 'utf8'); } catch (_) { return fallback; }
}

const FUNCTION_SRC = readOr(FUNCTION_JS, '');
const APP_SRC = readOr(APP_JS, '');
const PACKAGE_SRC = readOr(PACKAGE_JSON, '');
const TOML_SRC = readOr(NETLIFY_TOML, '');

// ជាន់អប្បបរមា ៖ ថតទទេ ➜ គ្មានការអះអាងណាបៃតងបានឡើយ។
ok('អាន Function បាន (ជាន់អប្បបរមា)', FUNCTION_SRC.length > 8000, FUNCTION_SRC.length);
ok('អាន ZoeW/app.js បាន (ជាន់អប្បបរមា)', APP_SRC.length > 100000, APP_SRC.length);
ok('អាន package.json បាន', PACKAGE_SRC.length > 20, PACKAGE_SRC.length);
ok('អាន netlify.toml បាន', TOML_SRC.length > 200, TOML_SRC.length);

let proxy = null;
let loadError = '';
try { proxy = require(FUNCTION_JS); } catch (e) { loadError = String(e && e.message); }
ok('Function ផ្ទុកបាន', proxy && typeof proxy.handler === 'function', loadError);

// ────────────────────────────────────────────────────────────────────────────
// ១. Auto-login ត្រូវបាត់ទាំងស្រុង (រចនាសម្ព័ន្ធ)
// ────────────────────────────────────────────────────────────────────────────
console.log('\n== ១. auto-login ត្រូវបាត់ទាំងស្រុង ==');

ok('⛔ `netlify/lib/zto-session.js` លែងមាន', !fs.existsSync(LEGACY_SESSION_JS));
ok('⛔ Function មិន require ម៉ូឌុល session', FUNCTION_SRC.indexOf('zto-session') === -1);

const FORBIDDEN_IN_FUNCTION = [
    'puppeteer', 'chromium',
    'ZTO_AUTO_LOGIN', 'ZTO_USERNAME', 'ZTO_PASSWORD', 'ZTO_SESSION_ENCRYPTION_KEY',
    'ZTO_LOGIN_PROXY', 'lambdaEvent'
];
FORBIDDEN_IN_FUNCTION.forEach((needle) => {
    ok('⛔ Function គ្មាន `' + needle + '`', FUNCTION_SRC.indexOf(needle) === -1);
});

let packageJson = null;
try { packageJson = JSON.parse(PACKAGE_SRC); } catch (_) { packageJson = null; }
ok('package.json ជា JSON ត្រឹមត្រូវ', !!packageJson);
// ⛔ dependency តែមួយដែលអនុញ្ញាត ៖ `@netlify/blobs` សម្រាប់ Cookie store។
// បញ្ជីនេះជាការចាក់សោ ៖ `puppeteer-core`/`@sparticuz/chromium` (2GB cold
// start) មិនអាចវិលមកតាមទ្វារ package.json បានទេ។
const ALLOWED_DEPENDENCIES = ['@netlify/blobs'];
const declaredDependencies = Object.keys((packageJson && packageJson.dependencies) || {}).sort();
ok('⛔ Function មាន dependency តែ «@netlify/blobs» (cold start លឿន)',
    JSON.stringify(declaredDependencies) === JSON.stringify(ALLOWED_DEPENDENCIES),
    declaredDependencies);
ok('⛔ ម៉ូឌុល Blobs ត្រូវចាក់សោកំណែច្បាស់លាស់',
    !!(packageJson && packageJson.dependencies
        && /^\d+\.\d+\.\d+$/.test(String(packageJson.dependencies['@netlify/blobs']))),
    packageJson && packageJson.dependencies);
ok('⛔ netlify.toml គ្មាន `external_node_modules`', TOML_SRC.indexOf('external_node_modules') === -1);
ok('⛔ netlify.toml គ្មាន memory 2gb សម្រាប់ Chromium', TOML_SRC.indexOf('2gb') === -1);

const LEGACY_CLIENT_CODES = ['ZTO_LOGIN_', 'ZTO_SESSION_', 'ZTO_AUTO_LOGIN'];
LEGACY_CLIENT_CODES.forEach((needle) => {
    ok('⛔ app.js គ្មានផ្លូវ `' + needle + '` ទៀត', APP_SRC.indexOf(needle) === -1);
});
ok('⛔ app.js លែងនិយាយអំពី Chromium', APP_SRC.indexOf('Chromium') === -1);

// ────────────────────────────────────────────────────────────────────────────
// ២. ឥរិយាបថពិតរបស់ Function
// ────────────────────────────────────────────────────────────────────────────
const KEY = 'proxy-key-for-tests-0123456789ab';
const ENV_NAMES = [
    'ZTO_PROXY_KEY', 'ZTO_COOKIE', 'ZTO_TOKEN', 'ZTO_TOKEN_HEADER', 'ZTO_AUTHORIZATION',
    'ZTO_API_URL', 'ZTO_API_METHOD', 'ZTO_REQUEST_BODY_JSON', 'ZTO_REQUEST_QUERY_PARAM',
    'ZTO_REQUEST_HEADERS_JSON', 'ZTO_FIELD_PHONE', 'ZTO_FIELD_COD', 'ZTO_FIELD_DOD',
    'ZTO_FIELD_BARCODE', 'ZTO_SEND_BROWSER_HEADERS', 'ZTO_UPSTREAM_TIMEOUT_MS',
    'ZTO_REQUEST_BUDGET_MS', 'ZTO_UPSTREAM_RETRIES', 'ZTO_CACHE_TTL_MS',
    'ZTO_USER_AGENT', 'ZTO_ACCEPT_LANGUAGE', 'ZTO_BROWSER_ORIGIN',
    'ZTO_PROBE_BARCODE', 'ZTO_PROBE_MIN_GAP_MS', 'ZTO_NOT_FOUND_CACHE_TTL_MS'
];
const SAVED_ENV = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
const SAVED_FETCH = global.fetch;

function resetEnv(extra) {
    ENV_NAMES.forEach((name) => { delete process.env[name]; });
    process.env.ZTO_PROXY_KEY = KEY;
    Object.keys(extra || {}).forEach((name) => { process.env[name] = extra[name]; });
    if (proxy && typeof proxy.resetCachesForTests === 'function') proxy.resetCachesForTests();
}

function call(query, headers) {
    return proxy.handler({
        httpMethod: 'GET',
        headers: Object.assign({ 'x-zoe-proxy-key': KEY }, headers || {}),
        queryStringParameters: query
    });
}

function jsonResponder(payload, status, contentType) {
    return async (url, options) => {
        jsonResponder.last = { url, options };
        jsonResponder.calls = (jsonResponder.calls || 0) + 1;
        return {
            ok: (status || 200) < 400,
            status: status || 200,
            headers: { get: () => contentType || 'application/json' },
            json: async () => payload
        };
    };
}

// ⛔ ក្រុមត្រូវរត់ **តាមលំដាប់** — ពួកវាចែក `process.env` និង `global.fetch`
//    ដូច្នេះការរត់ស្របគ្នាបង្កើត **ការធ្លាក់ក្លែងក្លាយ** (មេរៀន 2026-08-29)។
let queue = Promise.resolve();
function group(label, fn) {
    queue = queue.then(() => Promise.resolve().then(fn).catch((e) => {
        ok(label + ' — ក្រុមនេះបោះកំហុស', false, String(e && e.message));
    }));
}

const ORDER = {
    success: true,
    data: {
        billCode: '77130527210012',
        consigneePhone: '0974158508',
        consigneeName: 'Test Customer',
        agentAmount: 6.55,
        arrivalServiceCharge: 1.25
    }
};

group('ច្រកទ្វារសោ', async () => {
    console.log('\n== ២. ច្រកទ្វារសោ និងការផ្ទៀងផ្ទាត់ចូល ==');
    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t' });
    global.fetch = jsonResponder(ORDER);

    const noKey = await proxy.handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { barcode: '77130527210012' } });
    ok('គ្មានសោ ➜ 401', noKey.statusCode === 401, noKey.statusCode);

    delete process.env.ZTO_PROXY_KEY;
    const unconfigured = await call({ barcode: '77130527210012' });
    ok('គ្មាន ZTO_PROXY_KEY ➜ 503 ZTO_PROXY_NOT_CONFIGURED',
        unconfigured.statusCode === 503 && JSON.parse(unconfigured.body).code === 'ZTO_PROXY_NOT_CONFIGURED',
        unconfigured.body);
    process.env.ZTO_PROXY_KEY = KEY;

    delete process.env.ZTO_COOKIE;
    const noAuth = await call({ barcode: '77130527210012' });
    ok('គ្មាន Cookie/Token ➜ 503 ZTO_AUTH_NOT_CONFIGURED',
        noAuth.statusCode === 503 && JSON.parse(noAuth.body).code === 'ZTO_AUTH_NOT_CONFIGURED',
        noAuth.body);

    process.env.ZTO_COOKIE = 'BOS-MAN-SESSION=t';
    const badBarcode = await call({ barcode: '<bad>' });
    ok('Barcode មិនត្រឹមត្រូវ ➜ 400', badBarcode.statusCode === 400, badBarcode.statusCode);

    const post = await proxy.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY }, queryStringParameters: {} });
    ok('Method ក្រៅ GET ➜ 405', post.statusCode === 405, post.statusCode);

    const options = await proxy.handler({ httpMethod: 'OPTIONS', headers: {}, queryStringParameters: {} });
    ok('OPTIONS (warmup) ➜ 204 ថោក', options.statusCode === 204, options.statusCode);
});

group('Cookie ធៀបនឹង API ផ្លូវការ', async () => {
    console.log('\n== ៣. Cookie ធៀបនឹង API ផ្លូវការ (២ ខាង) ==');
    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t' });
    global.fetch = jsonResponder(ORDER);

    const cookieRun = await call({ barcode: '77130527210012' });
    const cookieBody = JSON.parse(cookieRun.body);
    ok('Cookie ➜ 200', cookieRun.statusCode === 200, cookieRun.body);
    ok('Cookie ➜ បំពេញ phone/cod/dod ត្រឹមត្រូវ',
        cookieBody.phone === '0974158508' && cookieBody.cod === 6.55 && cookieBody.dod === 1.25, cookieBody);
    ok('រូបរាងចម្លើយថេរ',
        JSON.stringify(Object.keys(cookieBody).sort()) === JSON.stringify(['barcode', 'cached', 'cod', 'dod', 'found', 'phone', 'success']),
        Object.keys(cookieBody).sort());
    ok('⛔ ឈ្មោះអតិថិជនមិនហូរទៅ browser', cookieRun.body.indexOf('Test Customer') === -1);

    const cookieHeaders = jsonResponder.last.options.headers;
    ok('Cookie ➜ ផ្ញើ Cookie ពិត', cookieHeaders.Cookie === 'BOS-MAN-SESSION=t', cookieHeaders.Cookie);
    ok('Cookie ➜ ផ្ញើ Origin របស់ Argus (ត្រាប់ browser)',
        cookieHeaders.Origin === 'https://argus.ztoglobal.com', cookieHeaders.Origin);
    ok('Cookie ➜ ផ្ញើ Referer របស់ Argus', cookieHeaders.Referer === 'https://argus.ztoglobal.com/', cookieHeaders.Referer);
    ok('POST ➜ តួសំណើលំនាំដើម',
        JSON.stringify(JSON.parse(jsonResponder.last.options.body)) === JSON.stringify({ billCode: '77130527210012', countryCode: 'KH' }),
        jsonResponder.last.options.body);
    ok('URL លំនាំដើមនៅដដែល',
        jsonResponder.last.url === 'https://aargus-api.ztoglobal.com/scan/get/order/detail', jsonResponder.last.url);
    // ⛔ វាស់ពី DevTools លើ Argus ពិត (2026-09-02) ៖ Request Method **POST** ·
    // Content-Type `application/json` · Content-Length **៤៨** សម្រាប់ barcode
    // ១៤ តួ។ ការប្តូរ method ឬ template ដោយស្ងាត់ ធ្វើឲ្យ lookup ស្លាប់លើ
    // ផលិតកម្ម ខណៈ stub ក្នុងតេស្តជោគជ័យទាំងអស់។
    ok('POST ➜ method ពិតជា POST (វាស់ពី Argus)',
        jsonResponder.last.options.method === 'POST', jsonResponder.last.options.method);
    ok('POST ➜ Content-Type ជា application/json (វាស់ពី Argus)',
        /^application\/json/.test(String(jsonResponder.last.options.headers['Content-Type'] || '')),
        jsonResponder.last.options.headers['Content-Type']);
    ok('POST ➜ តួសំណើ ៤៨ byte សម្រាប់ barcode ១៤ តួ (ត្រូវនឹង Content-Length ពិត)',
        Buffer.byteLength(String(jsonResponder.last.options.body)) === 48,
        Buffer.byteLength(String(jsonResponder.last.options.body)));
    ok('redirect: manual (login redirect ជាការបដិសេធ auth)', jsonResponder.last.options.redirect === 'manual');

    resetEnv({ ZTO_AUTHORIZATION: 'Bearer official-token' });
    global.fetch = jsonResponder(ORDER);
    const officialRun = await call({ barcode: '77130527210012' });
    const officialHeaders = jsonResponder.last.options.headers;
    ok('Authorization ➜ 200', officialRun.statusCode === 200, officialRun.body);
    ok('Authorization ➜ ផ្ញើ header ពិត', officialHeaders.Authorization === 'Bearer official-token');
    ok('⛔ API ផ្លូវការ ➜ **គ្មាន** Cookie', officialHeaders.Cookie === undefined);
    ok('⛔ API ផ្លូវការ ➜ **គ្មាន** Origin ក្លែងរបស់ Argus', officialHeaders.Origin === undefined, officialHeaders.Origin);
    ok('⛔ API ផ្លូវការ ➜ **គ្មាន** Referer ក្លែង', officialHeaders.Referer === undefined, officialHeaders.Referer);
    ok('⛔ API ផ្លូវការ ➜ **គ្មាន** User-Language ក្លែង', officialHeaders['User-Language'] === undefined);

    resetEnv({ ZTO_AUTHORIZATION: 'Bearer official-token', ZTO_SEND_BROWSER_HEADERS: 'true' });
    global.fetch = jsonResponder(ORDER);
    await call({ barcode: '77130527210012' });
    ok('ទិសផ្ទុយ ៖ បង្ខំបាន ដោយ ZTO_SEND_BROWSER_HEADERS=true',
        jsonResponder.last.options.headers.Origin === 'https://argus.ztoglobal.com');

    resetEnv({ ZTO_TOKEN: 'tok-123', ZTO_TOKEN_HEADER: 'X-Zto-Token' });
    global.fetch = jsonResponder(ORDER);
    await call({ barcode: '77130527210012' });
    ok('Token ➜ ផ្ញើតាម header ដែលកំណត់', jsonResponder.last.options.headers['X-Zto-Token'] === 'tok-123',
        jsonResponder.last.options.headers);

    resetEnv({ ZTO_AUTHORIZATION: 'Bearer a', ZTO_TOKEN: 'b', ZTO_COOKIE: 'c=d' });
    global.fetch = jsonResponder(ORDER);
    await call({ barcode: '77130527210012' });
    ok('លំដាប់អាទិភាព ៖ Authorization ឈ្នះ',
        jsonResponder.last.options.headers.Authorization === 'Bearer a'
        && jsonResponder.last.options.headers.Cookie === undefined);
});

group('ទម្រង់ API ណាក៏បាន', async () => {
    console.log('\n== ៤. ការត្រៀមសម្រាប់ API ផ្លូវការ (ទម្រង់ណាក៏បាន) ==');

    const shapes = [
        ['data ធម្មតា', { success: true, data: { billCode: 'A1', consigneePhone: '011', agentAmount: 2, arrivalServiceCharge: 1 } }],
        ['code:"0" + ឈ្មោះ field ផ្សេង', { code: '0', data: { waybillNo: 'A1', receiverMobile: '011', codAmount: '2', dodAmount: 1 } }],
        ['result:true + data.data', { result: true, data: { data: { mailNo: 'A1', recipientPhone: '011', collectionAmount: 2 } } }],
        ['data ជា array', { success: true, data: [{ billCode: 'A1', consigneeMobile: '011', cod: 2 }] }],
        ['root ផ្ទាល់ (គ្មាន wrapper)', { billCode: 'A1', phone: '011', cod: 2, dod: 1 }],
        ['code:"000000"', { code: '000000', data: { billCode: 'A1', consigneeTel: '011', codFee: 2 } }]
    ];
    for (const entry of shapes) {
        resetEnv({ ZTO_AUTHORIZATION: 'Bearer x' });
        global.fetch = jsonResponder(entry[1]);
        const res = await call({ barcode: 'A1B2C3D4' });
        const body = JSON.parse(res.body);
        ok('ស្គាល់ទម្រង់ ៖ ' + entry[0], res.statusCode === 200 && body.found === true && body.phone === '011', res.body);
    }

    resetEnv({ ZTO_AUTHORIZATION: 'Bearer x', ZTO_FIELD_PHONE: 'contact.tel' });
    global.fetch = jsonResponder({ success: true, data: { billCode: 'A1', contact: { tel: '077' }, agentAmount: 1 } });
    const nested = await call({ barcode: 'A1B2C3D4' });
    ok('ZTO_FIELD_PHONE ➜ ផ្លូវ dotted ដើរ', JSON.parse(nested.body).phone === '077', nested.body);

    resetEnv({ ZTO_AUTHORIZATION: 'Bearer x', ZTO_FIELD_PHONE: 'nothing.here' });
    global.fetch = jsonResponder(ORDER);
    const fallbackField = await call({ barcode: '77130527210012' });
    ok('⛔ ZTO_FIELD_* ខុស ➜ ធ្លាក់ទៅបញ្ជីលំនាំដើម (មិនស្លាប់)',
        JSON.parse(fallbackField.body).phone === '0974158508', fallbackField.body);

    resetEnv({
        ZTO_AUTHORIZATION: 'Bearer x',
        ZTO_API_URL: 'https://openapi.zto.com/v1/order/detail',
        ZTO_API_METHOD: 'GET',
        ZTO_REQUEST_QUERY_PARAM: 'waybillNo',
        ZTO_REQUEST_HEADERS_JSON: '{"X-App-Key":"app-1"}'
    });
    global.fetch = jsonResponder({ success: true, data: { waybillNo: 'A1', receiverPhone: '011', codAmount: 3 } });
    const getMode = await call({ barcode: 'A1B2C3D4' });
    ok('GET mode ➜ 200', getMode.statusCode === 200, getMode.body);
    ok('GET mode ➜ URL និង query param ត្រឹមត្រូវ',
        jsonResponder.last.url === 'https://openapi.zto.com/v1/order/detail?waybillNo=A1B2C3D4', jsonResponder.last.url);
    ok('GET mode ➜ គ្មានតួសំណើ', jsonResponder.last.options.body === undefined);
    ok('GET mode ➜ គ្មាន Content-Type ឥតប្រយោជន៍', jsonResponder.last.options.headers['Content-Type'] === undefined);
    ok('ZTO_REQUEST_HEADERS_JSON ➜ header បន្ថែមឆ្លងកាត់',
        jsonResponder.last.options.headers['X-App-Key'] === 'app-1');

    resetEnv({ ZTO_AUTHORIZATION: 'Bearer x', ZTO_REQUEST_BODY_JSON: '{"no":"{barcode}","src":"zoew"}' });
    global.fetch = jsonResponder(ORDER);
    await call({ barcode: '77130527210012' });
    ok('ZTO_REQUEST_BODY_JSON ➜ template ជំនួស {barcode}',
        JSON.stringify(JSON.parse(jsonResponder.last.options.body)) === JSON.stringify({ no: '77130527210012', src: 'zoew' }),
        jsonResponder.last.options.body);

    resetEnv({ ZTO_AUTHORIZATION: 'Bearer x', ZTO_REQUEST_HEADERS_JSON: '{"Cookie":"stolen=1","Authorization":"Bearer evil"}' });
    global.fetch = jsonResponder(ORDER);
    await call({ barcode: '77130527210012' });
    ok('⛔ header បន្ថែមមិនអាចសរសេរជាន់ Cookie/Authorization',
        jsonResponder.last.options.headers.Cookie === undefined
        && jsonResponder.last.options.headers.Authorization === 'Bearer x',
        jsonResponder.last.options.headers);
});

group('Config ខុស ➜ ធ្លាក់ដែលមានឈ្មោះ', async () => {
    console.log('\n== ៥. Config ខុស ➜ ការធ្លាក់ដែលមានឈ្មោះ ==');
    const cases = [
        ['api-url:not-https', { ZTO_API_URL: 'http://openapi.zto.com/x' }],
        ['api-url:invalid', { ZTO_API_URL: 'not a url' }],
        ['method:unsupported', { ZTO_API_METHOD: 'DELETE' }],
        ['body:invalid-json', { ZTO_REQUEST_BODY_JSON: '{oops' }],
        ['headers:invalid-json', { ZTO_REQUEST_HEADERS_JSON: '{oops' }],
        ['query-param:invalid', { ZTO_API_METHOD: 'GET', ZTO_REQUEST_QUERY_PARAM: 'bad param!' }],
        ['field:phone', { ZTO_FIELD_PHONE: 'a b c' }]
    ];
    for (const entry of cases) {
        resetEnv(Object.assign({ ZTO_AUTHORIZATION: 'Bearer x' }, entry[1]));
        global.fetch = jsonResponder(ORDER);
        const res = await call({ barcode: '77130527210012' });
        const body = JSON.parse(res.body);
        ok('Config ខុស ➜ 503 `' + entry[0] + '`',
            res.statusCode === 503 && body.code === 'ZTO_CONFIG_INVALID' && body.reason === entry[0], res.body);
    }
});

group('ការបដិសេធ auth', async () => {
    console.log('\n== ៦. ការបដិសេធ auth (២ ខាង) ==');
    const rejections = [
        ['HTTP 401', jsonResponder({ error: 'expired' }, 401)],
        ['HTTP 302 ទៅ login', jsonResponder({}, 302)],
        ['HTML ជំនួស JSON', jsonResponder({}, 200, 'text/html; charset=utf-8')],
        ['សារ session expired', jsonResponder({ success: false, error: 'session expired' })],
        ['URL របស់ IdP ក្នុងវាល error', jsonResponder({
            error: 'https://iam-web.zto.com/oauth2?app_id=zt_Fh4PydiUoqS9a3ipJshcQ&redirect_url=x'
        })]
    ];
    for (const entry of rejections) {
        resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t' });
        global.fetch = entry[1];
        const res = await call({ barcode: '77130527210012' });
        ok('ការបដិសេធ ៖ ' + entry[0] + ' ➜ 401 ZTO_AUTH_EXPIRED',
            res.statusCode === 401 && JSON.parse(res.body).code === 'ZTO_AUTH_EXPIRED', res.body);
        ok('⛔ URL របស់ IdP មិនហូរទៅ browser', res.body.indexOf('iam-web.zto.com') === -1);
    }

    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t' });
    global.fetch = jsonResponder(ORDER);
    const normal = await call({ barcode: '77130527210012' });
    ok('⛔ ទិសផ្ទុយ ៖ ចម្លើយធម្មតាមិនត្រូវច្រឡំជាការបដិសេធ auth', normal.statusCode === 200, normal.body);
});

group('រកមិនឃើញ ធៀបនឹងកំហុស', async () => {
    console.log('\n== ៧. «រកមិនឃើញ» មិនមែនកំហុសទេ ==');
    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t' });
    global.fetch = jsonResponder({ success: true, data: null });
    const notFound = await call({ barcode: 'ZZ99999999' });
    const nfBody = JSON.parse(notFound.body);
    ok('Barcode ដែល ZTO មិនស្គាល់ ➜ HTTP 200 (មិនកេះ cooldown ៣០ វិ.)', notFound.statusCode === 200, notFound.statusCode);
    ok('➜ found:false', nfBody.found === false && nfBody.code === 'ZTO_NOT_FOUND', nfBody);
    ok('⛔ ➜ **គ្មានវាល `error`** (បើមាន client បោះ «Lookup rejected»)',
        !Object.prototype.hasOwnProperty.call(nfBody, 'error'), nfBody);

    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t' });
    global.fetch = jsonResponder({ success: false, code: 'E42', msg: 'system busy' });
    const rejected = await call({ barcode: 'ZZ99999999' });
    ok('ZTO បដិសេធពិត ➜ 502 ZTO_UPSTREAM_REJECTED',
        rejected.statusCode === 502 && JSON.parse(rejected.body).code === 'ZTO_UPSTREAM_REJECTED', rejected.body);
    ok('សារពិតរបស់ ZTO ឆ្លងកាត់', JSON.parse(rejected.body).error === 'system busy', rejected.body);

    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t' });
    global.fetch = jsonResponder({}, 429);
    const throttled = await call({ barcode: 'ZZ99999999' });
    ok('HTTP 429 ➜ ZTO_RATE_LIMITED',
        throttled.statusCode === 429 && JSON.parse(throttled.body).code === 'ZTO_RATE_LIMITED', throttled.body);
});

group('ល្បឿន ៖ cache និង single-flight', async () => {
    console.log('\n== ៨. ល្បឿន ៖ cache · single-flight · retry (២ ខាង) ==');
    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t' });
    let calls = 0;
    global.fetch = async () => {
        calls++;
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ORDER };
    };
    const first = await call({ barcode: '77130527210012' });
    const second = await call({ barcode: '77130527210012' });
    ok('ស្កេនដដែលលើកទី ២ ➜ 200', second.statusCode === 200, second.body);
    ok('⛔ Cache ➜ upstream call តែ **១**', calls === 1, calls);
    ok('cached:false លើកទី ១', JSON.parse(first.body).cached === false);
    ok('cached:true លើកទី ២', JSON.parse(second.body).cached === true);

    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t', ZTO_CACHE_TTL_MS: '0' });
    calls = 0;
    await call({ barcode: '77130527210012' });
    await call({ barcode: '77130527210012' });
    ok('⛔ ទិសផ្ទុយ ៖ ZTO_CACHE_TTL_MS=0 ➜ បិទ cache (២ call)', calls === 2, calls);

    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t' });
    calls = 0;
    global.fetch = async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 40));
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ORDER };
    };
    const parallel = await Promise.all([
        call({ barcode: '77130527210012' }),
        call({ barcode: '77130527210012' }),
        call({ barcode: '77130527210012' })
    ]);
    ok('⛔ Single-flight ➜ សំណើស្របគ្នា ៣ ➜ upstream call តែ **១**', calls === 1, calls);
    ok('ទាំង ៣ ទទួលចម្លើយ 200', parallel.every((r) => r.statusCode === 200));

    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t', ZTO_CACHE_TTL_MS: '0' });
    calls = 0;
    global.fetch = async () => {
        calls++;
        if (calls === 1) throw new TypeError('fetch failed');
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ORDER };
    };
    const retried = await call({ barcode: '77130527210012' });
    ok('បណ្តាញដាច់មួយភ្លែត ➜ ព្យាយាមឡើងវិញ ➜ 200', retried.statusCode === 200, retried.body);
    ok('ព្យាយាមឡើងវិញពិត (២ call)', calls === 2, calls);

    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t', ZTO_CACHE_TTL_MS: '0', ZTO_UPSTREAM_RETRIES: '0' });
    calls = 0;
    global.fetch = async () => { calls++; throw new TypeError('fetch failed'); };
    const noRetry = await call({ barcode: '77130527210012' });
    ok('⛔ ទិសផ្ទុយ ៖ ZTO_UPSTREAM_RETRIES=0 ➜ call តែ ១', calls === 1, calls);
    ok('➜ ឆ្លើយជា JSON មិនមែនព្យួរ',
        noRetry.statusCode === 502 && JSON.parse(noRetry.body).code === 'ZTO_UNAVAILABLE', noRetry.body);

    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t', ZTO_CACHE_TTL_MS: '0' });
    calls = 0;
    global.fetch = async () => { calls++; return { ok: false, status: 503, headers: { get: () => 'application/json' }, json: async () => ({}) }; };
    const upstream5xx = await call({ barcode: '77130527210012' });
    ok('HTTP 5xx ➜ ព្យាយាមឡើងវិញ រួចឆ្លើយជា JSON', calls === 2 && upstream5xx.statusCode === 502, { calls, status: upstream5xx.statusCode });
});

group('ស្ថេរភាព ៖ បណ្តាញព្យួរ', async () => {
    console.log('\n== ៩. ស្ថេរភាព ៖ បណ្តាញ «ភ្ជាប់តែស្លាប់» ==');
    resetEnv({
        ZTO_COOKIE: 'BOS-MAN-SESSION=t',
        ZTO_CACHE_TTL_MS: '0',
        ZTO_UPSTREAM_TIMEOUT_MS: '2000',
        ZTO_REQUEST_BUDGET_MS: '4000',
        ZTO_UPSTREAM_RETRIES: '0'
    });
    // ⛔ `fetch` ដែល **ព្យួរ ហើយមិនគោរព signal សោះ** — នេះជាថ្នាក់ដែល checker
    //    ទាំងអស់ខកខាន (មេរៀន 2.22.4)។ ការ settle ត្រូវធានាដោយ **រចនាសម្ព័ន្ធ**។
    global.fetch = () => new Promise(() => {});
    const startedAt = Date.now();
    const stalled = await Promise.race([
        call({ barcode: '77130527210012' }),
        new Promise((resolve) => setTimeout(() => resolve({ statusCode: 0, body: '{"code":"HUNG"}' }), 9000))
    ]);
    const elapsed = Date.now() - startedAt;
    ok('⛔ fetch ដែលព្យួរ ➜ Function **នៅតែឆ្លើយជា JSON**', stalled.statusCode === 504, stalled.body);
    ok('➜ ក្នុងថវិកាពេល (មិនរង់ចាំគ្មានទីបញ្ចប់)', elapsed < 6000, elapsed);
    ok('➜ code ZTO_TIMEOUT', JSON.parse(stalled.body).code === 'ZTO_TIMEOUT', stalled.body);

    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t', ZTO_CACHE_TTL_MS: '0' });
    global.fetch = jsonResponder('not json at all');
    global.fetch = async () => ({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => { throw new SyntaxError('Unexpected token'); }
    });
    const badJson = await call({ barcode: '77130527210012' });
    ok('ចម្លើយមិនមែន JSON ➜ 502 ZTO_INVALID_RESPONSE',
        badJson.statusCode === 502 && JSON.parse(badJson.body).code === 'ZTO_INVALID_RESPONSE', badJson.body);
});

// ⛔ **ថវិកាពេលត្រូវរស់រានពីនាឡិកាដែលថយក្រោយ។** ច្បាប់ `monotonic-gate-test`
//   (2.20.7) អនុវត្តខាង server ដែរ ៖ `deadlineAt - Date.now()` ក្លាយជា **ធំជាង**
//   ពេលនាឡិកាថយក្រោយ (NTP កែធំ · ការផ្លាស់ host) ➔ ច្រកទ្វារថវិកា **បើកចំហ**
//   ➔ ការព្យាយាមឡើងវិញបន្តរហូតលើសពិដាន ➔ **Netlify សម្លាប់ Function មុនវាឆ្លើយ**
//   ➔ អ្នកប្រើឃើញ `Failed to fetch` ជំនួស JSON ដែលមានឈ្មោះ។
//   ការវាស់ត្រូវជា **ឥរិយាបថ** (រាប់ការហៅ upstream ពិត) មិនមែនការអានកូដ។
group('ថវិកាពេល ៖ នាឡិកាថយក្រោយ', async () => {
    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=abcdefgh12345678', ZTO_UPSTREAM_RETRIES: '3' });
    const realNow = Date.now;
    let calls = 0;
    global.fetch = async () => {
        calls++;
        // រាល់ការហៅបន្ទាប់ ➔ នាឡិកាលោតថយក្រោយ ១ ម៉ោង
        if (calls === 1) Date.now = () => realNow.call(Date) - 3600000;
        return {
            ok: false, status: 503,
            headers: { get: () => 'application/json' },
            json: async () => ({ message: 'upstream down' })
        };
    };
    let res;
    try {
        res = await call({ barcode: 'ZTOCLK0001' });
    } finally {
        Date.now = realNow;
    }
    // ⛔ នាឡិកាថយក្រោយ ➔ `elapsedSince()` ត្រឡប់ Infinity ➔ ថវិកាអស់ភ្លាម
    //   ➔ បោះបង់ឆាប់ (fail-open ក្នុងទិសសុវត្ថិភាព ៖ ឆ្លើយមុនត្រូវសម្លាប់)។
    ok('⛔ នាឡិកាថយក្រោយ មិនត្រូវពន្លាថវិកា (ការហៅ upstream ត្រូវទប់)',
        calls <= 2, { upstreamCalls: calls, retriesConfigured: 3 });
    ok('⛔ នៅតែឆ្លើយជា JSON ដែលមានឈ្មោះ មិនមែនព្យួរ',
        !!res && res.statusCode >= 500 && /ZTO_/.test(String(res.body)),
        res && { status: res.statusCode, body: String(res.body).slice(0, 120) });

    // ទិសផ្ទុយ ៖ នាឡិកាធម្មតា ➔ ការព្យាយាមឡើងវិញនៅតែដើរដដែល
    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=abcdefgh12345678', ZTO_UPSTREAM_RETRIES: '3' });
    let normalCalls = 0;
    global.fetch = async () => {
        normalCalls++;
        return {
            ok: false, status: 503,
            headers: { get: () => 'application/json' },
            json: async () => ({ message: 'upstream down' })
        };
    };
    await call({ barcode: 'ZTOCLK0002' });
    ok('⛔ ទិសផ្ទុយ ៖ នាឡិកាធម្មតា ➔ នៅតែព្យាយាមឡើងវិញដដែល',
        normalCalls >= 3, { upstreamCalls: normalCalls });
});

group('ការវិនិច្ឆ័យ ?diag=1', async () => {
    console.log('\n== ១០. ការវិនិច្ឆ័យ ?diag=1 (បញ្ជាក់ថា API ផ្លូវការភ្ជាប់រួច) ==');
    resetEnv({ ZTO_AUTHORIZATION: 'Bearer super-secret-official-token', ZTO_API_URL: 'https://openapi.zto.com/v1/x' });
    global.fetch = jsonResponder(ORDER);
    const diag = await call({ diag: '1' });
    const diagBody = JSON.parse(diag.body);
    ok('?diag=1 ➜ 200', diag.statusCode === 200, diag.statusCode);
    ok('ប្រាប់ថាកំពុងប្រើ auth ណា', diagBody.auth === 'authorization', diagBody.auth);
    ok('ប្រាប់ host និង method ពិត',
        diagBody.endpoint && diagBody.endpoint.host === 'openapi.zto.com' && diagBody.endpoint.method === 'POST', diagBody.endpoint);
    ok('ប្រាប់ **ឈ្មោះ** header ដែលផ្ញើ',
        Array.isArray(diagBody.requestHeaders) && diagBody.requestHeaders.indexOf('Authorization') !== -1, diagBody.requestHeaders);
    ok('⛔ **តម្លៃសម្ងាត់មិនចេញសោះ**', diag.body.indexOf('super-secret-official-token') === -1, diag.body);
    ok('ប្រាប់ថាមិនផ្ញើ header ក្លែងរបស់ browser', diagBody.browserHeaders === false, diagBody.browserHeaders);
    ok('ប្រាប់ថវិកាពេលពិត',
        diagBody.timing && diagBody.timing.budgetMs > 0 && diagBody.timing.upstreamTimeoutMs > 0, diagBody.timing);

    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=super-secret-cookie' });
    const diagCookie = await call({ diag: '1' });
    ok('ទិសផ្ទុយ ៖ Cookie mode ➜ auth:"cookie" និង browserHeaders:true',
        JSON.parse(diagCookie.body).auth === 'cookie' && JSON.parse(diagCookie.body).browserHeaders === true, diagCookie.body);
    ok('⛔ តម្លៃ Cookie មិនចេញសោះ', diagCookie.body.indexOf('super-secret-cookie') === -1);

    resetEnv({});
    const diagNone = await call({ diag: '1' });
    ok('គ្មាន auth ➜ ?diag=1 នៅតែឆ្លើយ (ជួយរកមូលហេតុ)',
        diagNone.statusCode === 200 && JSON.parse(diagNone.body).auth === 'none', diagNone.body);
    const diagNoKey = await proxy.handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { diag: '1' } });
    ok('⛔ ?diag=1 នៅតែត្រូវការសោ', diagNoKey.statusCode === 401, diagNoKey.statusCode);
});

group('ការស្ទង់សកម្ម ?probe=1', async () => {
    // ⛔ **សំណើអ្នកប្រើ (2026-09-05)** ៖ *«ធ្វើអោយដឹងថា cookie អស់សុពលភាព
    // ភ្លាម»*។ សាលក្រមធម្មតាជា **ប្រតិកម្ម** (ត្រូវការការស្កេនពិត ១ ធ្លាក់)។
    // ការស្ទង់សកម្មលុបចន្លោះនោះ — តែវាបន្ថែម **ចរាចរណ៍ពិតទៅ ZTO** ➜ វា
    // ត្រូវសាងដោយព្រំដែន ៤ ដែលចាក់សោនៅទីនេះ ៖
    //   ក. ship **អសកម្ម** ៖ គ្មាន ZTO_PROBE_BARCODE ➜ មិនហៅ ZTO សោះ
    //   ខ. «វាស់មិនបាន» ≠ «ស្លាប់» ➜ 5xx/បណ្តាញធ្លាក់ ត្រូវឆ្លើយ alive:null
    //   គ. ពិដានល្បឿនខាង **server** ➜ ចរាចរណ៍មានពិដានតាមរចនាសម្ព័ន្ធ
    //   ឃ. មិនប៉ះ cache លទ្ធផល និងមិនបញ្ចេញទិន្នន័យអតិថិជន
    console.log('\n== ១០ខ. ការស្ទង់សកម្ម ?probe=1 ==');

    // ក. ship អសកម្ម — នេះជាព្រំដែនសំខាន់បំផុត ៖ អ្នកប្រើបើកវាដោយចេតនា។
    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t' });
    global.fetch = jsonResponder(ORDER);
    jsonResponder.calls = 0;
    const off = await call({ probe: '1' });
    const offBody = JSON.parse(off.body);
    ok('⛔ គ្មាន ZTO_PROBE_BARCODE ➜ 200 ជាមួយ alive:null (ship អសកម្ម)',
        off.statusCode === 200 && offBody.alive === null, off.body);
    ok('⛔ គ្មាន ZTO_PROBE_BARCODE ➜ **មិនហៅ ZTO សោះ**',
        (jsonResponder.calls || 0) === 0, jsonResponder.calls);

    // ខ. ZTO ទទួល ➜ alive:true
    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t', ZTO_PROBE_BARCODE: '77130527210012', ZTO_PROBE_MIN_GAP_MS: '0' });
    global.fetch = jsonResponder(ORDER);
    jsonResponder.calls = 0;
    const aliveRun = await call({ probe: '1' });
    const aliveBody = JSON.parse(aliveRun.body);
    ok('ZTO ទទួល ➜ alive:true', aliveRun.statusCode === 200 && aliveBody.alive === true, aliveRun.body);
    ok('ការស្ទង់ហៅ ZTO ពិត ១ ដង', (jsonResponder.calls || 0) === 1, jsonResponder.calls);
    ok('⛔ ចម្លើយការស្ទង់ **មិនបញ្ចេញទិន្នន័យអតិថិជន**',
        aliveRun.body.indexOf('0974158508') === -1
        && aliveRun.body.indexOf('Test Customer') === -1
        && aliveRun.body.indexOf('6.55') === -1, aliveRun.body);

    // ⛔ ការស្ទង់មិនត្រូវពុល cache ៖ ការស្កេនពិតបន្ទាប់ត្រូវហៅ ZTO ដដែល។
    jsonResponder.calls = 0;
    const afterProbe = await call({ barcode: '77130527210012' });
    ok('⛔ ការស្ទង់មិនពុល cache លទ្ធផល (ការស្កេនពិតនៅតែហៅ ZTO)',
        (jsonResponder.calls || 0) === 1 && JSON.parse(afterProbe.body).cached === false,
        jsonResponder.calls);

    // ⛔ ហើយផ្ទុយមកវិញ ៖ cache ដែលមានស្រាប់មិនត្រូវបំពេញការស្ទង់ — បើអត់
    // ការស្ទង់នឹងឆ្លើយ «alive» ដោយមិនបានសាក session សោះ = ការវាស់ក្លែងក្លាយ។
    jsonResponder.calls = 0;
    const probeAfterCache = await call({ probe: '1' });
    ok('⛔ ការស្ទង់រំលង cache ជានិច្ច (បើអត់ ➜ សាលក្រមក្លែងក្លាយ)',
        (jsonResponder.calls || 0) === 1 && JSON.parse(probeAfterCache.body).alive === true,
        jsonResponder.calls);

    // គ. ZTO បដិសេធ ➜ alive:false ហើយត្រូវ **ចាក់ស្ថានភាពដដែល** នឹងការស្កេនពិត
    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t', ZTO_PROBE_BARCODE: '77130527210012', ZTO_PROBE_MIN_GAP_MS: '0' });
    global.fetch = jsonResponder({ error: 'unauthorized' }, 401);
    const dead = await call({ probe: '1' });
    ok('ZTO បដិសេធ ➜ alive:false', JSON.parse(dead.body).alive === false, dead.body);
    const diagAfterDead = JSON.parse((await call({ diag: '1' })).body);
    ok('⛔ ការស្ទង់ចាក់ស្ថានភាពដដែលនឹងការស្កេនពិត (--auto ដឹងភ្លាមដោយមិនកែ)',
        diagAfterDead.cookie && diagAfterDead.cookie.authRejectedAgeMs !== null,
        diagAfterDead.cookie);

    // ឃ. «វាស់មិនបាន» ≠ «ស្លាប់» — ច្បាប់មាសរបស់គម្រោង អនុវត្តលើអ័ក្សនេះដែរ។
    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t', ZTO_PROBE_BARCODE: '77130527210012', ZTO_PROBE_MIN_GAP_MS: '0' });
    global.fetch = jsonResponder({ error: 'boom' }, 500);
    ok('⛔ ZTO ធ្លាក់ 5xx ➜ alive:null មិនមែន false',
        JSON.parse((await call({ probe: '1' })).body).alive === null);
    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t', ZTO_PROBE_BARCODE: '77130527210012', ZTO_PROBE_MIN_GAP_MS: '0' });
    global.fetch = async () => { throw new Error('network down'); };
    ok('⛔ បណ្តាញដាច់ ➜ alive:null (កុំបើក browser ដោយ ZTO ដាច់)',
        JSON.parse((await call({ probe: '1' })).body).alive === null);

    // ង. ពិដានល្បឿនខាង server ៖ ចរាចរណ៍ត្រូវមានពិដាន **តាមរចនាសម្ព័ន្ធ**
    // មិនមែនដោយសង្ឃឹមថាឧបករណ៍ខាង client សួរមិនញឹក។
    resetEnv({ ZTO_COOKIE: 'BOS-MAN-SESSION=t', ZTO_PROBE_BARCODE: '77130527210012', ZTO_PROBE_MIN_GAP_MS: '600000' });
    global.fetch = jsonResponder(ORDER);
    jsonResponder.calls = 0;
    const first = JSON.parse((await call({ probe: '1' })).body);
    const second = JSON.parse((await call({ probe: '1' })).body);
    ok('ការស្ទង់ទី ១ ហៅ ZTO', (jsonResponder.calls || 0) === 1, jsonResponder.calls);
    ok('⛔ ការស្ទង់ទី ២ ក្នុងពិដាន ➜ **មិនហៅ ZTO** តែឆ្លើយសាលក្រមចាស់',
        (jsonResponder.calls || 0) === 1 && second.alive === first.alive && second.throttled === true,
        { calls: jsonResponder.calls, second });

    // ច. ច្រកទ្វារ ៖ សោ និងអ្នកហៅ
    const probeNoKey = await proxy.handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { probe: '1' } });
    ok('⛔ ?probe=1 ត្រូវការសោ', probeNoKey.statusCode === 401, probeNoKey.statusCode);
});

// ⛔ **ការស្ទង់ជារបស់ឧបករណ៍ Windows ប៉ុណ្ណោះ។** បើ App ហៅវា នោះរាល់សំណើ
// ដែលធ្លាក់នឹងក្លាយជា **error event ក្នុង Sentry** ➜ វាបំពេញ Sentry ហើយ
// **បាំង alert លុយ** (ថ្នាក់ដែល `docs/HISTORY.md` កត់ត្រារួច)។ នេះជាព្រំដែន
// ដែលធ្វើឲ្យការស្ទង់សុវត្ថិភាព — ចាក់សោវាទាំង ២ ខាង។
queue.then(() => {
    console.log('\n== ១០គ. ការស្ទង់មិនត្រូវចេញពី App ==');
    ok('⛔ app.js មិនហៅ ?probe=1 សោះ (Sentry មិនត្រូវទទួល event ពីការស្ទង់)',
        APP_SRC.indexOf('probe=1') === -1 && APP_SRC.indexOf("probe: '1'") === -1);
    ok('⛔ Function គាំទ្រ probe ពិត (ជាន់អប្បបរមា ៖ កុំឲ្យការស្កេនខាងលើទទេ)',
        FUNCTION_SRC.indexOf('ZTO_PROBE_BARCODE') !== -1 && FUNCTION_SRC.indexOf('probe') !== -1);
    ok('⛔ ឧបករណ៍ Windows ជាអ្នកហៅតែម្នាក់',
        readOr(path.join(ROOT, 'tools', 'zto-cookie-sync-windows', 'sync-zto-cookie.js'), '')
            .indexOf('probe=1') !== -1);
});

// ────────────────────────────────────────────────────────────────────────────
// ១១. ពិដានពេលខាង client ត្រូវស៊ីនឹងថវិកាខាង server
// ────────────────────────────────────────────────────────────────────────────
queue.then(() => {
    console.log('\n== ១១. ពិដានពេលខាង client ==');
    const budget = /const budgetMs = |ZTO_REQUEST_BUDGET_MS, (\d+),/.exec(FUNCTION_SRC);
    const serverBudget = budget ? Number(budget[1]) : 0;
    const clientZto = /const ZTO_AUTO_LOOKUP_TIMEOUT_MS = (\d+);/.exec(APP_SRC);
    const clientTest = /const ZTO_TEST_TIMEOUT_MS = (\d+);/.exec(APP_SRC);
    const clientApi = /const AUTO_LOOKUP_TIMEOUT_MS = (\d+);/.exec(APP_SRC);
    ok('រកឃើញថវិកា server លំនាំដើម', serverBudget > 0, serverBudget);
    ok('រកឃើញពិដានខាង client', !!(clientZto && clientTest && clientApi));
    if (clientZto && clientTest && clientApi && serverBudget) {
        ok('ពិដានស្កេន ZTO >= ថវិកា server + ៣ វិ.',
            Number(clientZto[1]) >= serverBudget + 3000, { client: Number(clientZto[1]), server: serverBudget });
        ok('⛔ ពិដានស្កេន ZTO លែងរង់ចាំ Chromium (<= ៣០ វិ.)',
            Number(clientZto[1]) <= 30000, Number(clientZto[1]));
        ok('⛔ ប៊ូតុងសាកល្បងលឿនជាងផ្លូវស្កេន',
            Number(clientTest[1]) < Number(clientZto[1]), { test: Number(clientTest[1]), scan: Number(clientZto[1]) });
        ok('ផ្លូវ Apps Script នៅដដែល (១៦ វិ.)', Number(clientApi[1]) === 16000, Number(clientApi[1]));
    }

    const lookupStart = APP_SRC.indexOf('async function attemptAutoLookup(');
    const lookupEnd = APP_SRC.indexOf('\n    function openExchangeRateModal(', lookupStart);
    const lookupSource = lookupStart === -1 ? '' : APP_SRC.slice(lookupStart, lookupEnd);
    // ⛔ `lookupResponseError()` ជាអ្នកសាងកំហុស lookup **តែមួយ** — វាភ្ជាប់
    //    `lookupCode`/`lookupReason` ទាំងផ្លូវដែលឆ្លងកាត់ `retryAsync()` និង
    //    ផ្លូវឆ្លើយតបមិន ok។ ⚠️ ការអះអាងខាងក្រោមជា **ការវាស់ឈ្មោះ** ប៉ុណ្ណោះ;
    //    ការវាស់ថាសាខាសារ **ឈានដល់បានពិត** នៅក្នុង
    //    `lookup-failure-identity-test.js` (រត់កូដពិត)។
    const errorBuilder = APP_SRC.indexOf('function lookupResponseError(') === -1 ? ''
        : APP_SRC.slice(APP_SRC.indexOf('function lookupResponseError('), APP_SRC.indexOf('function lookupResponseError(') + 400);
    ok('ផ្លូវស្កេនយក `code` ពី proxy', errorBuilder.indexOf('error.lookupCode = body && body.code') !== -1);
    ok('ផ្លូវស្កេនយក `reason` ពី proxy', errorBuilder.indexOf('error.lookupReason = safeLookupReason(body && body.reason)') !== -1);
    ok('⛔ ការឆ្លើយតបមិន ok ប្រើអ្នកសាងកំហុសដដែល (អត្តសញ្ញាណមិនបាត់)',
        lookupSource.indexOf('throw lookupResponseError(out.res.status, data, false)') !== -1);
    ok('សារ ZTO_AUTH_EXPIRED ប្រាប់ឲ្យយក Cookie ថ្មី',
        lookupSource.indexOf("e.lookupCode === 'ZTO_AUTH_EXPIRED'") !== -1 && lookupSource.indexOf('Cookie ZTO ផុតកំណត់') !== -1);
    // ⛔ **សារដែលចាស់ គឺជាសារខុស។** មុនមានឧបករណ៍ស្វ័យប្រវត្តិ សារនេះប្រាប់
    // អ្នកប្រើឲ្យ «ចូល Argus យក Cookie ថ្មី ដាក់ក្នុង Netlify» — ការណែនាំនោះ
    // ឥឡូវ **ខុស ២ កន្លែង** ៖ ការដាក់ក្នុង Netlify លែងជាជំហានទៀតហើយ
    // (helper សរសេរចូល Blobs ដោយផ្ទាល់) ហើយ Task ជួសជុលវាក្នុងប្រហែល ១ នាទី
    // ➜ អ្នកប្រើចំណាយ ៥ នាទីធ្វើអ្វីដែលនឹងរួចដោយខ្លួនឯង។
    ok('⛔ សារលែងប្រាប់ឲ្យដាក់ Cookie ក្នុង Netlify ដោយដៃ',
        lookupSource.indexOf('ដាក់ក្នុង Netlify') === -1,
        'ជំហាននោះលែងមានទៀតហើយ — helper សរសេរចូល Blobs ដោយផ្ទាល់');
    ok('⛔ សារប្រាប់ឲ្យស្កេនម្ដងទៀត និងផ្លូវចេញពេលនៅតែធ្លាក់',
        /ស្កេនម្[ដ]?ងទៀត/.test(lookupSource) && lookupSource.indexOf('ZTO Cookie Sync') !== -1,
        'សារត្រូវពិតទាំងពេលមាន Task និងពេលគ្មាន Task');
    ok('សារ ZTO_CONFIG_INVALID មាន', lookupSource.indexOf("e.lookupCode === 'ZTO_CONFIG_INVALID'") !== -1);
    ok('សារ ZTO_RATE_LIMITED មាន', lookupSource.indexOf("e.lookupCode === 'ZTO_RATE_LIMITED'") !== -1);

    const retryStart = APP_SRC.indexOf('function retryTransientLookupResponse(');
    const retrySource = retryStart === -1 ? '' : APP_SRC.slice(retryStart, retryStart + 600);
    ok('⛔ Config ខុសមិនត្រូវព្យាយាមឡើងវិញ (503 ជាសាលក្រមស្ថាពរ)',
        retrySource.indexOf('ZTO_CONFIG_INVALID') !== -1 && retrySource.indexOf('ZTO_PROXY_NOT_CONFIGURED') !== -1,
        retrySource.slice(0, 300));

    // ការច្រោះ `reason` មុនចូល DOM នៅដដែល
    const ctx = { console };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    const safeStart = APP_SRC.indexOf('    function safeLookupReason(');
    if (safeStart !== -1) {
        let depth = 0, end = APP_SRC.indexOf('{', safeStart);
        for (let i = end; i < APP_SRC.length; i++) {
            if (APP_SRC[i] === '{') depth++;
            else if (APP_SRC[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
        }
        vm.runInContext(APP_SRC.slice(safeStart, end).replace(/^\s{4}/gm, ''), ctx);
        const probe = vm.runInContext('[' + [
            "safeLookupReason('api-url:not-https')",
            "safeLookupReason('body:invalid-json')",
            "safeLookupReason('<img src=x onerror=alert(1)>')",
            "safeLookupReason(null)"
        ].join(',') + ']', ctx);
        ok('⛔ `reason` ត្រូវច្រោះមុនចូល DOM (២ ខាង)',
            JSON.stringify(Array.from(probe)) === JSON.stringify(['api-url:not-https', 'body:invalid-json', '', '']),
            Array.from(probe));
    } else {
        ok('រកឃើញ safeLookupReason()', false);
    }

    global.fetch = SAVED_FETCH;
    ENV_NAMES.forEach((name) => {
        if (SAVED_ENV[name] === undefined) delete process.env[name];
        else process.env[name] = SAVED_ENV[name];
    });

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
});
