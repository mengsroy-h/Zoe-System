// ⛔ ថ្នាក់កំហុស ៖ **«ស្ថានភាពនៅ ZTO» ដែលកុហក ឬដែលសម្លាប់ Lookup។**
//
// ZoeW បិទបញ្ជី «យករួច» ក្នុងខ្លួនវា ចំណែក Argus/ZTO បិទដោយ Palm app ដាច់
// ដោយឡែក ➜ កញ្ចប់ដែលបិទក្នុង ZoeW តែភ្លេចបិទក្នុង Palm **គ្មានអ្នកណាប្រាប់**។
// Function ទាញសាលក្រមនោះចេញពី `/detail` ដែលមានស្រាប់ (គ្មានការសរសេរទៅ ZTO)។
//
// ច្បាប់ ២ ដែលឯកសារនេះចាក់សោ ៖
//
// ១. ⛔ **សាលក្រមមាន ៣ មិនមែន ២** ៖ `true` · `false` · `null` («មិនទាន់វាស់»)។
//    វាលដែលរកមិនឃើញ ត្រូវជា `null` — បើវាក្លាយជា `false` នោះអ្នកប្រើនឹងឃើញ
//    «ZTO មិនទាន់បិទ» លើកញ្ចប់ដែល ZTO ពិតជាបិទរួច ➜ ការដាស់តឿនកុហក។
//
// ២. ⛔ **ការកំណត់ខុស មិនត្រូវសម្លាប់ Lookup** ៖ ខុសពី `ZTO_FIELD_PHONE`
//    (ដែលបោះ `ZtoConfigError` ➜ HTTP 503 ➜ **ស្កេនមិនបាន**), វាលស្ថានភាព
//    ជាវាល **ស្រេចចិត្ត** ➜ ការវាយខុសក្នុង Netlify env ត្រូវបិទតែមុខងារនេះ
//    ហើយប្រាប់មូលហេតុក្នុង `?diag=1`។ លេខទូរស័ព្ទ និងលុយសំខាន់ជាងស្លាក។
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.env.ZTOSIGNED_APP_DIR ? path.resolve(process.env.ZTOSIGNED_APP_DIR) : path.resolve(__dirname, '..');
const FUNCTION_JS = path.join(ROOT, 'ZoeW', 'netlify', 'functions', 'zto-order-detail.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

let FUNCTION_SRC = '';
try { FUNCTION_SRC = fs.readFileSync(FUNCTION_JS, 'utf8'); } catch (_) { FUNCTION_SRC = ''; }

// ជាន់អប្បបរមា ៖ ថតទទេ ➜ គ្មានការអះអាងណាបៃតងបានឡើយ។
ok('អាន Function បាន (ជាន់អប្បបរមា)', FUNCTION_SRC.length > 8000, FUNCTION_SRC.length);

let proxy = null;
let loadError = '';
try { proxy = require(FUNCTION_JS); } catch (e) { loadError = String(e && e.message); }
ok('Function ផ្ទុកបាន', !!(proxy && typeof proxy.handler === 'function'), loadError);

const KEY = 'signed-status-key-0123456789abcd';
const ENV_NAMES = [
    'ZTO_PROXY_KEY', 'ZTO_COOKIE', 'ZTO_TOKEN', 'ZTO_TOKEN_HEADER', 'ZTO_AUTHORIZATION',
    'ZTO_API_URL', 'ZTO_API_METHOD', 'ZTO_REQUEST_BODY_JSON', 'ZTO_REQUEST_QUERY_PARAM',
    'ZTO_REQUEST_HEADERS_JSON', 'ZTO_FIELD_PHONE', 'ZTO_FIELD_COD', 'ZTO_FIELD_DOD',
    'ZTO_FIELD_BARCODE', 'ZTO_FIELD_SIGNED', 'ZTO_SIGNED_VALUES',
    'ZTO_SEND_BROWSER_HEADERS', 'ZTO_UPSTREAM_TIMEOUT_MS', 'ZTO_REQUEST_BUDGET_MS',
    'ZTO_UPSTREAM_RETRIES', 'ZTO_CACHE_TTL_MS', 'ZTO_NOT_FOUND_CACHE_TTL_MS',
    'ZTO_USER_AGENT', 'ZTO_ACCEPT_LANGUAGE', 'ZTO_BROWSER_ORIGIN'
];
const SAVED_ENV = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
const SAVED_FETCH = global.fetch;

function resetEnv(extra) {
    ENV_NAMES.forEach((name) => { delete process.env[name]; });
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_AUTHORIZATION = 'Bearer test-token';
    Object.keys(extra || {}).forEach((name) => { process.env[name] = extra[name]; });
    if (proxy && typeof proxy.resetCachesForTests === 'function') proxy.resetCachesForTests();
}

function call(query) {
    return proxy.handler({
        httpMethod: 'GET',
        headers: { 'x-zoe-proxy-key': KEY },
        queryStringParameters: query
    });
}

function responder(payload) {
    return async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => payload
    });
}

const BASE_ORDER = { billCode: 'BAR0001', consigneePhone: '011222333', agentAmount: 4.5, arrivalServiceCharge: 0 };
const orderWith = (extra) => ({ success: true, data: Object.assign({}, BASE_ORDER, extra || {}) });

async function lookupBody(payload, env, barcode) {
    resetEnv(env);
    global.fetch = responder(payload);
    const res = await call({ barcode: barcode || 'BAR0001' });
    return { status: res.statusCode, body: JSON.parse(res.body) };
}

// ⛔ tree មុនកែគ្មានវាលទាំងនេះ ➜ ការអានផ្ទាល់បោះ `TypeError` ហើយ **បិទបាំង
// ការអះអាងខាងក្រោមទាំងអស់**។ helper នេះធ្វើឲ្យការធ្លាក់ **មានឈ្មោះ**។
function signedFields(body) {
    const fields = (body && body.fields) || {};
    return {
        signed: Array.isArray(fields.signed) ? fields.signed : null,
        signedValues: fields.signedValues,
        signedReason: fields.signedReason
    };
}

async function diagBody(env) {
    resetEnv(env);
    global.fetch = responder(orderWith());
    const res = await call({ diag: '1' });
    return { status: res.statusCode, body: JSON.parse(res.body), raw: res.body };
}

(async () => {
    if (!proxy || typeof proxy.handler !== 'function') {
        console.log('\nសរុប ៖ ' + pass + ' ok, ' + fail + ' FAIL');
        process.exit(fail ? 1 : 0);
    }

    // ─────────────────────────────────────────────────────────────────────
    // ១. លំនាំដើម ៖ មុខងារ **ដេកលក់** — គ្មាន env ➜ គ្មានសាលក្រម
    // ─────────────────────────────────────────────────────────────────────
    console.log('\n== ១. លំនាំដើម ៖ ដេកលក់ (មិនប៉ះអ្នកប្រើសោះ) ==');

    const dormant = await lookupBody(orderWith({ signStatus: '70' }), {});
    ok('គ្មានការកំណត់ ➜ Lookup ធម្មតា 200', dormant.status === 200 && dormant.body.found === true, dormant.body);
    ok('⛔ គ្មានការកំណត់ ➜ `ztoClosed` ជា `null` (មិនមែន `false`)',
        dormant.body.ztoClosed === null, dormant.body.ztoClosed);
    ok('គ្មានការកំណត់ ➜ លេខទូរស័ព្ទ និងលុយនៅដដែល',
        dormant.body.phone === '011222333' && dormant.body.cod === 4.5, dormant.body);

    const dormantDiag = await diagBody({});
    const dormantFields = signedFields(dormantDiag.body);
    ok('គ្មានការកំណត់ ➜ `?diag=1` រាយបញ្ជីទទេ',
        !!dormantFields.signed && dormantFields.signed.length === 0 && dormantFields.signedValues === 0,
        dormantDiag.body.fields);
    ok('គ្មានការកំណត់ ➜ គ្មានមូលហេតុកំហុស',
        dormantFields.signedReason === null, dormantFields.signedReason);

    // ─────────────────────────────────────────────────────────────────────
    // ២. សាលក្រម ៣ — `true` · `false` · `null`
    // ─────────────────────────────────────────────────────────────────────
    console.log('\n== ២. សាលក្រម ៣ ==');

    const CONFIGURED = { ZTO_FIELD_SIGNED: 'signStatus', ZTO_SIGNED_VALUES: '70,signed' };

    const closed = await lookupBody(orderWith({ signStatus: '70' }), CONFIGURED);
    ok('តម្លៃស្ថិតក្នុងបញ្ជី ➜ `ztoClosed === true`', closed.body.ztoClosed === true, closed.body);

    const openAtZto = await lookupBody(orderWith({ signStatus: '30' }), CONFIGURED);
    ok('តម្លៃក្រៅបញ្ជី ➜ `ztoClosed === false`', openAtZto.body.ztoClosed === false, openAtZto.body);

    const missing = await lookupBody(orderWith({}), CONFIGURED);
    ok('⛔ វាលរកមិនឃើញ ➜ `null` មិនមែន `false` («មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស»)',
        missing.body.ztoClosed === null, missing.body.ztoClosed);

    const emptyText = await lookupBody(orderWith({ signStatus: '   ' }), CONFIGURED);
    ok('⛔ វាលទទេ ➜ `null` មិនមែន `false`', emptyText.body.ztoClosed === null, emptyText.body.ztoClosed);

    const caseInsensitive = await lookupBody(orderWith({ signStatus: 'SIGNED' }), CONFIGURED);
    ok('តម្លៃមិនប្រកាន់អក្សរតូចធំ ➜ `true`', caseInsensitive.body.ztoClosed === true, caseInsensitive.body);

    const boolValue = await lookupBody(orderWith({ signStatus: true }),
        { ZTO_FIELD_SIGNED: 'signStatus', ZTO_SIGNED_VALUES: 'true' });
    ok('តម្លៃ boolean ➜ អានបាន', boolValue.body.ztoClosed === true, boolValue.body);

    const nested = await lookupBody(orderWith({ extra: { sign: { state: 'signed' } } }),
        { ZTO_FIELD_SIGNED: 'extra.sign.state', ZTO_SIGNED_VALUES: 'signed' });
    ok('ផ្លូវ dotted ជ្រៅ ➜ អានបាន', nested.body.ztoClosed === true, nested.body);

    const multiPath = await lookupBody(orderWith({ signState: '80' }),
        { ZTO_FIELD_SIGNED: 'signStatus,signState', ZTO_SIGNED_VALUES: '80' });
    ok('ផ្លូវច្រើន ➜ យកផ្លូវដែលមានតម្លៃ', multiPath.body.ztoClosed === true, multiPath.body);

    // ─────────────────────────────────────────────────────────────────────
    // ３. ⛔ ការកំណត់ខុស មិនត្រូវសម្លាប់ Lookup
    // ─────────────────────────────────────────────────────────────────────
    console.log('\n== ៣. ⛔ ការកំណត់ខុស មិនត្រូវសម្លាប់ Lookup ==');

    const BROKEN = [
        ['ផ្លូវមានចន្លោះ', { ZTO_FIELD_SIGNED: 'a b c', ZTO_SIGNED_VALUES: '70' }, 'paths:invalid'],
        ['ផ្លូវវែងពេក', { ZTO_FIELD_SIGNED: 'x'.repeat(200), ZTO_SIGNED_VALUES: '70' }, 'paths:invalid'],
        ['តម្លៃមានតួអក្សរហាម', { ZTO_FIELD_SIGNED: 'signStatus', ZTO_SIGNED_VALUES: 'a b,c' }, 'values:invalid'],
        ['មានផ្លូវ គ្មានតម្លៃ', { ZTO_FIELD_SIGNED: 'signStatus' }, 'values:missing'],
        ['មានតម្លៃ គ្មានផ្លូវ', { ZTO_SIGNED_VALUES: '70' }, 'paths:missing']
    ];

    for (const entry of BROKEN) {
        const label = entry[0];
        const broken = await lookupBody(orderWith({ signStatus: '70' }), entry[1]);
        ok('⛔ ' + label + ' ➜ Lookup នៅ 200 (មិនមែន 503)',
            broken.status === 200 && broken.body.found === true, broken.status);
        ok('⛔ ' + label + ' ➜ លេខទូរស័ព្ទនៅមកដល់ដដែល',
            broken.body.phone === '011222333', broken.body.phone);
        ok('⛔ ' + label + ' ➜ សាលក្រម `null` (មុខងារបិទ)',
            broken.body.ztoClosed === null, broken.body.ztoClosed);
        const brokenDiag = await diagBody(entry[1]);
        ok('⛔ ' + label + ' ➜ `?diag=1` ប្រាប់មូលហេតុ «' + entry[2] + '»',
            signedFields(brokenDiag.body).signedReason === entry[2], signedFields(brokenDiag.body).signedReason);
    }

    // ⛔ ទិសផ្ទុយ ៖ ការកំណត់ **ត្រឹមត្រូវ** មិនត្រូវរាយមូលហេតុកំហុស។
    const goodDiag = await diagBody(CONFIGURED);
    const goodFields = signedFields(goodDiag.body);
    ok('⛔ ទិសផ្ទុយ ៖ ការកំណត់ត្រឹមត្រូវ ➜ គ្មានមូលហេតុកំហុស',
        goodFields.signedReason === null, goodFields.signedReason);
    ok('ការកំណត់ត្រឹមត្រូវ ➜ `?diag=1` រាយឈ្មោះផ្លូវ',
        !!goodFields.signed && goodFields.signed.indexOf('signStatus') !== -1, goodFields.signed);

    // ─────────────────────────────────────────────────────────────────────
    // ៤. cache ត្រូវដាច់តាមការកំណត់
    // ─────────────────────────────────────────────────────────────────────
    console.log('\n== ៤. cache ត្រូវដាច់តាមការកំណត់ ==');

    resetEnv(CONFIGURED);
    global.fetch = responder(orderWith({ signStatus: '70' }));
    const first = JSON.parse((await call({ barcode: 'SAMEBAR' })).body);
    ok('ការហៅទី ១ ➜ `true`', first.ztoClosed === true, first);

    const cached = JSON.parse((await call({ barcode: 'SAMEBAR' })).body);
    ok('ការហៅទី ២ ➜ មកពី cache', cached.cached === true && cached.ztoClosed === true, cached);

    // ⛔ ប្តូរបញ្ជីតម្លៃ **ដោយមិនលុប cache** — កូនសោត្រូវប្រែតាម fingerprint។
    process.env.ZTO_SIGNED_VALUES = '99';
    const afterConfigChange = JSON.parse((await call({ barcode: 'SAMEBAR' })).body);
    ok('⛔ ប្តូរការកំណត់ ➜ cache ចាស់មិនត្រូវត្រឡប់មកវិញ',
        afterConfigChange.ztoClosed === false, afterConfigChange);

    // ─────────────────────────────────────────────────────────────────────
    // ៥. ⛔ តម្លៃដែលកំណត់ មិនត្រូវលេចក្នុង `?diag=1`
    // ─────────────────────────────────────────────────────────────────────
    console.log('\n== ៥. ⛔ តម្លៃមិនលេចក្នុងការវិនិច្ឆ័យ ==');

    const secretish = await diagBody({ ZTO_FIELD_SIGNED: 'signStatus', ZTO_SIGNED_VALUES: 'zoesecret70' });
    ok('⛔ `?diag=1` មិនបញ្ចេញ **តម្លៃ** ដែលកំណត់ (រាយតែចំនួន)',
        secretish.raw.indexOf('zoesecret70') === -1, secretish.raw.slice(0, 400));
    ok('`?diag=1` រាយចំនួនតម្លៃ', signedFields(secretish.body).signedValues === 1, secretish.body.fields);

    // ─────────────────────────────────────────────────────────────────────
    // ៦. ការបរាជ័យរបស់ ZTO មិនត្រូវក្លាយជា «មិនទាន់បិទ»
    // ─────────────────────────────────────────────────────────────────────
    console.log('\n== ៦. ការបរាជ័យ ≠ «មិនទាន់បិទ» ==');

    resetEnv(CONFIGURED);
    global.fetch = async () => ({
        ok: false, status: 502, headers: { get: () => 'application/json' }, json: async () => ({ success: false })
    });
    const upstreamBad = await call({ barcode: 'BAR0002' });
    const upstreamBody = JSON.parse(upstreamBad.body);
    ok('⛔ ZTO ធ្លាក់ ➜ គ្មានវាល `ztoClosed` សោះ (មិនមែន `false`)',
        upstreamBad.statusCode !== 200 && upstreamBody.ztoClosed === undefined, upstreamBody);

    resetEnv(CONFIGURED);
    global.fetch = responder({ success: true, data: {} });
    const notFound = await call({ barcode: 'BAR0003' });
    const notFoundBody = JSON.parse(notFound.body);
    ok('⛔ «រកមិនឃើញ» ➜ គ្មាន `ztoClosed === false`',
        notFoundBody.found === false && notFoundBody.ztoClosed === undefined, notFoundBody);

    ENV_NAMES.forEach((name) => {
        if (SAVED_ENV[name] === undefined) delete process.env[name];
        else process.env[name] = SAVED_ENV[name];
    });
    global.fetch = SAVED_FETCH;

    
// ⛔ ច្បាប់គម្រោង ៖ «លំនាំដើម និងលេខក្នុងឯកសារ ត្រូវអានចេញពីកូដពិត» —
// ចន្លោះនេះកើតឡើងពិតម្តងរួចហើយ (2026-09-03, `zto-negative-cache-test`)។
// ត្រង់នេះយើងទាមទារថា `ZTO-SETUP-KH.md` ពិពណ៌នា env ថ្មីទាំង ២ ត្រឹមត្រូវ ៖
// មូលហេតុទាំង ៤ · ពិដានចំនួន · និងវាល `?diag=1` ត្រូវអានចេញពី Function ពិត។
console.log('\n== ៧. ឯកសារត្រូវនឹងកូដ (ZTO-SETUP-KH.md) ==');
(function () {
    const DOC_PATH = path.join(ROOT, 'ZoeW', 'ZTO-SETUP-KH.md');
    let doc = '';
    try { doc = fs.readFileSync(DOC_PATH, 'utf8'); } catch (_) { doc = ''; }
    const khmerToLatin = (s) => s.replace(/[\u17E0-\u17E9]/g,
        (c) => String(c.charCodeAt(0) - 0x17E0));
    const docNum = khmerToLatin(doc);
    ok('ជាន់អប្បបរមា ៖ អាន ZTO-SETUP-KH.md បាន', doc.length > 2000, doc.length);
    ok('⛔ ឯកសារពន្យល់ការបើកមុខងារ (មិនត្រឹមជួរតារាង env)',
        doc.indexOf('ZTO_FIELD_SIGNED') !== -1
        && doc.indexOf('ZTO_SIGNED_VALUES') !== -1
        && /Network|DevTools|F12/.test(doc), doc.indexOf('F12'));

    const reasons = (FUNCTION_SRC.match(/'(paths|values):(missing|invalid)'/g) || [])
        .map((s) => s.replace(/'/g, ''));
    ok('ជាន់អប្បបរមា ៖ រកមូលហេតុក្នុង Function ពិត', reasons.length >= 4, reasons);
    const missingReasons = reasons.filter((r) => doc.indexOf(r) === -1);
    ok('⛔ រាល់មូលហេតុ `signedReason` ត្រូវមានក្នុងឯកសារ',
        missingReasons.length === 0, missingReasons);

    const capMatch = /SIGNED_VALUE_MAX\s*=\s*(\d+)/.exec(FUNCTION_SRC);
    ok('ជាន់អប្បបរមា ៖ រកពិដានចំនួនតម្លៃក្នុងកូដពិត', !!capMatch,
        capMatch ? capMatch[1] : null);
    if (capMatch) {
        const capPhrase = 'ច្រើនជាង ' + capMatch[1];
        ok('⛔ ពិដានចំនួនតម្លៃក្នុងឯកសារ ត្រូវស្មើកូដ (' + capMatch[1] + ')',
            docNum.indexOf(capPhrase) !== -1, capPhrase);
    }

    const diagKeys = ['signedReason', 'signedValues'];
    const missingKeys = diagKeys.filter((k) =>
        FUNCTION_SRC.indexOf(k) === -1 || doc.indexOf(k) === -1);
    ok('⛔ វាល `?diag=1` ត្រូវមានទាំងក្នុងកូដ ទាំងក្នុងឯកសារ',
        missingKeys.length === 0, missingKeys);

    // ⛔ ថ្នាក់កំហុសពិត (2.31.9) ៖ ឯកសារបង្ហាញឧទាហរណ៍ `data.signStatus`
    // ខណៈ `orderCandidates()` **ស្រាយសំបកចេញរួចហើយ** ➜ ផ្លូវ field ត្រូវ
    // រាបស្មើ ដូច `PHONE_PATHS`/`BARCODE_PATHS` ដទៃទាំងអស់។ ការដាក់ `data.`
    // ដើរដោយចៃដន្យ (root ជា candidate ចុងក្រោយ) តែធ្លាក់ពេល ZTO ដាក់
    // ទិន្នន័យក្រោម `result` ជំនួស។
    const flatDefaults = /const PHONE_PATHS = \[([^\]]*)\]/.exec(FUNCTION_SRC);
    ok('ជាន់អប្បបរមា ៖ រកបញ្ជីលំនាំដើមក្នុង Function ពិត', !!flatDefaults,
        flatDefaults ? flatDefaults[1].slice(0, 40) : null);
    ok('⛔ លំនាំដើមរបស់ Function រាបស្មើ (គ្មាន `data.` នាំមុខ)',
        !!flatDefaults && flatDefaults[1].indexOf('data.') === -1,
        flatDefaults ? flatDefaults[1].slice(0, 60) : null);

    const sampleRows = doc.split('\n').filter((l) =>
        l.indexOf('ZTO_FIELD_SIGNED') !== -1 && l.indexOf('|') !== -1);
    ok('ជាន់អប្បបរមា ៖ ឯកសារមានជួរឧទាហរណ៍ `ZTO_FIELD_SIGNED`',
        sampleRows.length >= 2, sampleRows.length);
    const badSample = sampleRows.filter((l) => /`[A-Za-z_$]+\.[A-Za-z_$]/.test(l));
    ok('⛔ ឧទាហរណ៍ក្នុងឯកសារត្រូវរាបស្មើដូចលំនាំដើម (គ្មាន `x.y`)',
        badSample.length === 0, badSample.map((l) => l.slice(0, 70)));

    ok('⛔ ឯកសារត្រូវពន្យល់ថា Function ស្រាយសំបកចេញ (`data`/`result`) ជាមុន',
        /ស្រាយសំបកចេញរួចហើយ/.test(doc), true);

    ok('⛔ ឯកសារត្រូវប្រាប់ថាតម្លៃមិនលេចក្នុង `?diag=1`',
        /មិនបង្ហាញក្នុង `\?diag=1`|រាយត្រឹម \*\*ចំនួន\*\*/.test(doc), true);
})();

console.log('\nសរុប ៖ ' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
