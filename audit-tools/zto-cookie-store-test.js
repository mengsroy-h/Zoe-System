// ⛔ ចាក់សោការផ្លាស់ Cookie ZTO **ដោយគ្មាន redeploy** ៖ Function ត្រូវអាន
// Cookie ពី Netlify Blobs, ត្រូវធ្លាក់ចុះទៅ `ZTO_COOKIE` env ពេល store ដាច់
// (Blobs មិនត្រូវជាចំណុចដាច់តែមួយ — ច្បាប់ 2.24.2), ត្រូវ settle ពេល store
// ព្យួរ (ច្បាប់ stall-guard), ហើយត្រូវសរសេរ Cookie ដែល Argus បន្តអាយុតាម
// `Set-Cookie` ត្រឡប់ចូល store វិញ។
//
// ⚠️ វារត់ `exports.handler` **ពិត** ជាមួយម៉ូឌុល `@netlify/blobs` **ក្លែង**
// ដែលចាក់តាម `setBlobsModuleForTests()` ➜ លំដាប់ `connectLambda(event)` ➜
// `getStore()` ត្រូវបានវាស់ពិត។ នេះជាមេរៀន «ស្នាមភ្ជាប់ត្រូវបាន stub ក្នុង
// គ្រប់តេស្ត ➜ ស្នាមភ្ជាប់នោះគ្មានតេស្តសោះ» (សំណួរទី ៧)។
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.ZTOSTORE_APP_DIR
    ? path.resolve(process.env.ZTOSTORE_APP_DIR)
    : path.resolve(__dirname, '..');
const FUNCTION_JS = path.join(ROOT, 'ZoeW', 'netlify', 'functions', 'zto-order-detail.js');

const KEY = 'proxy-key-for-tests-0123456789ab';
const BARCODE = '77130500000012';
const ENV_COOKIE = 'BOS-MAN-SESSION=env-cookie-value-1234; sidebarStatus=0';
const BLOB_COOKIE = 'BOS-MAN-SESSION=blob-cookie-value-9876; sidebarStatus=1';
const STORE_NAME = 'zto-auth';
const STORE_KEY = 'cookie';

let pass = 0;
let fail = 0;

function ok(label, condition, detail) {
    if (condition) {
        pass++;
        console.log('   ok    ' + label);
    } else {
        fail++;
        console.log('  FAIL   ' + label + (detail === undefined ? '' : '\n         ' + detail));
    }
}

function readOr(file, fallback) {
    try { return fs.readFileSync(file, 'utf8'); } catch (_) { return fallback; }
}

const FUNCTION_SRC = readOr(FUNCTION_JS, '');

// ជាន់អប្បបរមា ៖ ថតទទេ ➜ គ្មានការអះអាងណាបៃតងបានឡើយ។
ok('អាន Function បាន (ជាន់អប្បបរមា)', FUNCTION_SRC.length > 8000, FUNCTION_SRC.length);

let proxy = null;
let loadError = '';
try { proxy = require(FUNCTION_JS); } catch (e) { loadError = String(e && e.message); }
ok('Function ផ្ទុកបាន', !!(proxy && typeof proxy.handler === 'function'), loadError);
ok('Function បើកផ្លូវចាក់ម៉ូឌុល Blobs សម្រាប់តេស្ត',
    !!(proxy && typeof proxy.setBlobsModuleForTests === 'function'),
    proxy && typeof proxy.setBlobsModuleForTests);

const ENV_NAMES = [
    'ZTO_PROXY_KEY', 'ZTO_COOKIE', 'ZTO_TOKEN', 'ZTO_AUTHORIZATION', 'ZTO_API_URL',
    'ZTO_API_METHOD', 'ZTO_CACHE_TTL_MS', 'ZTO_UPSTREAM_RETRIES'
];
const SAVED_ENV = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
const SAVED_FETCH = global.fetch;

function resetEnv(extra) {
    ENV_NAMES.forEach((name) => { delete process.env[name]; });
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_CACHE_TTL_MS = '0';
    process.env.ZTO_UPSTREAM_RETRIES = '0';
    Object.keys(extra || {}).forEach((name) => { process.env[name] = extra[name]; });
    if (proxy && typeof proxy.resetCachesForTests === 'function') proxy.resetCachesForTests();
}

// ── ម៉ូឌុល `@netlify/blobs` ក្លែង ────────────────────────────────────────────
// វាកត់ត្រា **លំដាប់ការហៅពិត** ដូច្នេះ `connectLambda` ដែលបាត់ ឬដែលហៅ
// ក្រោយ `getStore` ក្លាយជាការធ្លាក់ដែលមានឈ្មោះ។
function makeBlobs(behavior) {
    const state = Object.assign({ value: BLOB_COOKIE }, behavior || {});
    const calls = [];
    const etagOf = (value) => '"' + crypto.createHash('sha256').update(String(value || '')).digest('hex') + '"';
    const store = {
        get(key, options) {
            calls.push({ fn: 'get', key, options });
            if (state.readThrows) return Promise.reject(new Error('read failed'));
            if (state.readHangs) return new Promise(() => {});
            // ⛔ ការអានពិតយក **ទិដ្ឋភាព** នៅពេលចាប់ផ្តើម — មិនមែនតម្លៃថ្មីបំផុត
            // នៅពេលដោះទេ។ នេះជាអ្វីដែលធ្វើឲ្យការអានយឺតអាចជាន់តម្លៃថ្មីជាង។
            const snapshot = state.value;
            if (state.readDelayMs) {
                return new Promise((resolve) => setTimeout(() => resolve(snapshot), state.readDelayMs));
            }
            return Promise.resolve(snapshot);
        },
        async getWithMetadata(key, options) {
            const value = await store.get(key, options);
            return value === null ? null : { data: value, etag: etagOf(value), metadata: state.metadata || {} };
        },
        set(key, value, options) {
            calls.push({ fn: 'set', key, value, metadata: options && options.metadata });
            if (state.writeThrows) return Promise.reject(new Error('write failed'));
            if (options && options.onlyIfMatch && options.onlyIfMatch !== etagOf(state.value)) return Promise.resolve({ modified: false });
            if (options && options.onlyIfNew && state.value !== null) return Promise.resolve({ modified: false });
            state.value = value;
            state.metadata = options && options.metadata ? options.metadata : {};
            return Promise.resolve({ modified: true, etag: etagOf(value) });
        }
    };
    return {
        state,
        calls,
        names() { return calls.map((call) => call.fn).join(','); },
        module: {
            connectLambda(event) {
                calls.push({ fn: 'connectLambda', hasBlobs: typeof event.blobs === 'string' && !!event.blobs });
                if (state.connectThrows) throw new Error('connect failed');
            },
            getStore(name) {
                calls.push({ fn: 'getStore', name });
                if (state.getStoreThrows) throw new Error('getStore failed');
                return store;
            }
        }
    };
}

function useBlobs(behavior) {
    const fake = makeBlobs(behavior);
    proxy.setBlobsModuleForTests(fake.module);
    return fake;
}

function call(query, options) {
    const config = options || {};
    const event = {
        httpMethod: config.method || 'GET',
        headers: Object.assign({ 'x-zoe-proxy-key': KEY }, config.headers || {}),
        queryStringParameters: query
    };
    if (config.blobs !== false) {
        event.blobs = Buffer.from(JSON.stringify({
            url: 'https://blobs.netlify.test',
            token: 'blob-token-for-tests'
        })).toString('base64');
        event.headers['x-nf-site-id'] = 'site-for-tests';
        event.headers['x-nf-deploy-id'] = 'deploy-for-tests';
    }
    return proxy.handler(event);
}

const ORDER = {
    code: '0',
    data: { billCode: BARCODE, consigneePhone: '0970008508', agentAmount: 6.55, arrivalServiceCharge: 1.25 }
};

// stub `fetch` ដែលកត់ត្រា header ពិតដែលចេញទៅ ZTO និងអាចត្រឡប់ `Set-Cookie`។
function upstream(setCookieLines) {
    const responder = async (url, options) => {
        responder.last = { url, options };
        const lines = typeof setCookieLines === 'function' ? setCookieLines() : setCookieLines;
        return {
            ok: true,
            status: 200,
            headers: {
                get(name) { return String(name).toLowerCase() === 'content-type' ? 'application/json' : null; },
                getSetCookie() { return lines || []; }
            },
            json: async () => ORDER
        };
    };
    responder.last = null;
    global.fetch = responder;
    return responder;
}

function unauthorizedUpstream() {
    const responder = async (url, options) => {
        responder.last = { url, options };
        return {
            ok: false,
            status: 401,
            headers: { get() { return 'application/json'; }, getSetCookie() { return []; } },
            json: async () => ({ code: '401' })
        };
    };
    global.fetch = responder;
    return responder;
}

function sentCookie(responder) {
    return responder.last && responder.last.options && responder.last.options.headers
        ? responder.last.options.headers.Cookie
        : undefined;
}

async function run() {
    if (!proxy || typeof proxy.handler !== 'function' || typeof proxy.setBlobsModuleForTests !== 'function') {
        // ⛔ គ្មានផ្លូវចាក់ម៉ូឌុល ➜ រាល់ការអះអាងឥរិយាបថត្រូវរាយជាការធ្លាក់
        // **ដែលមានឈ្មោះ** មិនមែនបញ្ឈប់ checker ទេ (ច្បាប់ផ្នែក ៣ របស់
        // `checker-coverage.js`)។
        const labels = [
            'Blobs ឈ្នះលើ env', 'connectLambda រត់មុន getStore', 'ឈ្មោះ store និង key ត្រឹមត្រូវ',
            'API ផ្លូវការ ➜ មិនប៉ះ store សោះ', 'គ្មាន event.blobs ➜ ស្ងាត់',
            'getStore បោះ ➜ ធ្លាក់ចុះទៅ env', 'ការអានបោះ ➜ ធ្លាក់ចុះទៅ env',
            'ការអានព្យួរ ➜ settle រួចធ្លាក់ចុះទៅ env', 'blob ខូចទម្រង់ ➜ មិនផ្ញើទៅ ZTO',
            'blob ទទេ ➜ ធ្លាក់ចុះទៅ env', 'គ្មាន blob គ្មាន env ➜ 503',
            'cache ក្នុងសតិ ➜ មិនអានស្ទួន', 'Cookie ផុត ➜ អាន store ឡើងវិញ',
            'Set-Cookie ➜ សរសេរតម្លៃថ្មីចូល store', 'តម្លៃដែលសរសេររក្សា session',
            'ពិដានល្បឿននៃការសរសេរឡើងវិញ', 'Set-Cookie ដដែល ➜ មិនសរសេរ',
            'Set-Cookie ដែលលុប session ➜ មិនសរសេរ', 'ការសរសេរធ្លាក់ ➜ lookup នៅជោគជ័យ',
            'diag ប្រាប់ប្រភព', 'diag មិនបញ្ចេញតម្លៃ Cookie',
            'blob ទទេ ➜ diag ប្រាប់មូលហេតុ', 'មូលហេតុមិនបាត់ក្រោយ cache',
            'ការអានធ្លាក់ ➜ មូលហេតុនៅមើលឃើញ', 'blob ដើរធម្មតា ➜ គ្មានមូលហេតុសល់',
            'diag ប្រាប់ថា Cookie ត្រូវ ZTO បដិសេធពេលណា',
            'diag ប្រាប់អាយុពិតរបស់ Cookie ក្នុង Blob (metadata syncedAt)', 'ការបន្តអាយុរក្សា syncedAt + បោះ renewedAt',
            'OPTIONS ➜ 204 ដដែល', 'OPTIONS មិនបញ្ចេញតម្លៃ Cookie',
            'warm-up អាន store ជាមុន', 'ការស្កេនដំបូងក្រោយ warm-up មិនអានស្ទួន',
            'warm-up ក្នុង cache មិនអានម្តងទៀត', 'store ព្យួរ ➜ OPTIONS នៅ 204',
            'គ្មាន event.blobs ➜ warm-up ស្ងាត់', 'API ផ្លូវការ ➜ warm-up មិនប៉ះ store'
        ];
        labels.forEach((label) => ok(label, false, 'Function មិនគាំទ្រ Blobs (' + loadError + ')'));
        return;
    }

    // ── ១. អាទិភាព ៖ blob ➜ env ─────────────────────────────────────────────
    console.log('\n== ១. អាទិភាពនៃប្រភព Cookie ==');
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    let blobs = useBlobs();
    let net = upstream();
    let res = await call({ barcode: BARCODE });
    ok('Blobs ឈ្នះលើ env', res.statusCode === 200 && sentCookie(net) === BLOB_COOKIE, sentCookie(net));
    ok('connectLambda រត់មុន getStore',
        blobs.names().indexOf('connectLambda,getStore') === 0, blobs.names());
    ok('connectLambda ទទួល event.blobs ពិត',
        blobs.calls[0] && blobs.calls[0].hasBlobs === true, blobs.calls[0]);
    ok('ឈ្មោះ store និង key ត្រឹមត្រូវ',
        blobs.calls[1].name === STORE_NAME && blobs.calls[2].key === STORE_KEY,
        blobs.calls[1].name + '/' + blobs.calls[2].key);

    resetEnv({ ZTO_COOKIE: ENV_COOKIE, ZTO_AUTHORIZATION: 'Bearer official-token' });
    blobs = useBlobs();
    net = upstream();
    res = await call({ barcode: BARCODE });
    ok('API ផ្លូវការ ➜ មិនប៉ះ store សោះ (លឿនជាង)',
        res.statusCode === 200 && blobs.calls.length === 0, blobs.names());

    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    blobs = useBlobs();
    net = upstream();
    res = await call({ barcode: BARCODE }, { blobs: false });
    ok('គ្មាន event.blobs ➜ ស្ងាត់ ហើយប្រើ env',
        res.statusCode === 200 && blobs.calls.length === 0 && sentCookie(net) === ENV_COOKIE,
        blobs.names() + ' / ' + sentCookie(net));

    // ── ២. Blobs មិនត្រូវជាចំណុចដាច់តែមួយ ──────────────────────────────────
    console.log('\n== ២. Blobs មិនត្រូវជាចំណុចដាច់តែមួយ ==');
    const failures = [
        ['connectLambda បោះ', { connectThrows: true }],
        ['getStore បោះ', { getStoreThrows: true }],
        ['ការអានបោះ', { readThrows: true }],
        ['blob ទទេ', { value: '' }],
        ['blob គ្មាន BOS-MAN-SESSION', { value: 'sidebarStatus=0; theme=dark' }],
        ['blob មានតួអក្សរគ្រប់គ្រង', { value: 'BOS-MAN-SESSION=abc\r\nX-Injected: 1' }],
        ['blob ខូចទម្រង់', { value: 'not-a-cookie-at-all' }]
    ];
    for (const [label, behavior] of failures) {
        resetEnv({ ZTO_COOKIE: ENV_COOKIE });
        useBlobs(behavior);
        net = upstream();
        res = await call({ barcode: BARCODE });
        ok(label + ' ➜ ធ្លាក់ចុះទៅ env (lookup នៅដើរ)',
            res.statusCode === 200 && sentCookie(net) === ENV_COOKIE,
            res.statusCode + ' / ' + sentCookie(net));
    }

    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    useBlobs({ value: 'BOS-MAN-SESSION=abc\r\nX-Injected: 1' });
    net = upstream();
    res = await call({ barcode: BARCODE });
    ok('⛔ តម្លៃ blob ខូចមិនហូរចូល header សោះ',
        JSON.stringify(net.last.options.headers).indexOf('X-Injected') === -1,
        JSON.stringify(net.last.options.headers));

    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    useBlobs({ readHangs: true });
    net = upstream();
    const hangStart = Date.now();
    res = await call({ barcode: BARCODE });
    const hangMs = Date.now() - hangStart;
    ok('ការអានព្យួរ ➜ settle រួចធ្លាក់ចុះទៅ env',
        res.statusCode === 200 && sentCookie(net) === ENV_COOKIE, res.statusCode);
    ok('ការអានព្យួរ ➜ មានពិដានពេលពិត (< ១០ វិ.)', hangMs < 10000, hangMs + 'ms');

    resetEnv({});
    useBlobs({ value: '' });
    net = upstream();
    res = await call({ barcode: BARCODE });
    ok('គ្មាន blob គ្មាន env ➜ 503 ZTO_AUTH_NOT_CONFIGURED',
        res.statusCode === 503 && JSON.parse(res.body).code === 'ZTO_AUTH_NOT_CONFIGURED', res.body);

    // ── ៣. cache ក្នុងសតិ និងការលុបវាពេល Cookie ផុត ────────────────────────
    console.log('\n== ៣. cache ក្នុងសតិ ↔ ការផុតកំណត់ ==');
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    blobs = useBlobs();
    net = upstream();
    await call({ barcode: BARCODE });
    await call({ barcode: '77130500000013' });
    ok('cache ក្នុងសតិ ➜ អាន store តែម្តង',
        blobs.calls.filter((c) => c.fn === 'get').length === 1,
        blobs.names());

    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    blobs = useBlobs();
    unauthorizedUpstream();
    res = await call({ barcode: BARCODE });
    ok('Cookie ផុត ➜ 401 ZTO_AUTH_EXPIRED',
        res.statusCode === 401 && JSON.parse(res.body).code === 'ZTO_AUTH_EXPIRED', res.body);
    blobs.state.value = 'BOS-MAN-SESSION=rotated-value-000111; sidebarStatus=1';
    net = upstream();
    res = await call({ barcode: BARCODE });
    ok('⛔ Cookie ផុត ➜ អាន store ឡើងវិញភ្លាម (មិនរង់ចាំ ៦០ វិ.)',
        sentCookie(net) === blobs.state.value, sentCookie(net));

    // ── ៣ខ. ⛔ cache ផុត TTL ➜ ការអាន store មិនត្រូវឈរលើផ្លូវឆ្លើយតប ──────────
    // 🔴 ថ្នាក់កំហុសល្បឿន ៖ ក្រោយ ៦០ វិនាទី រាល់ការស្កេន **ទប់** រង់ចាំការអាន
    //   Netlify Blobs មុននឹងហៅ ZTO — ទោះបីជា Cookie ដដែលនៅក្នុងសតិស្រាប់ក៏ដោយ។
    //   ពេល Blobs យឺត ឬព្យួរ ការស្កេនទាំងអស់រងផលតាមវា ➜ ផ្ទុយនឹងច្បាប់
    //   «⛔ Blobs មិនត្រូវជាចំណុចដាច់តែមួយ»។ ដំណោះស្រាយ ៖ ឆ្លើយពីសតិភ្លាម
    //   រួចធ្វើឲ្យស្រស់ **ខាងក្រោយ**។
    console.log('\n== ៣ខ. cache ផុត TTL ➜ ឆ្លើយពីសតិ រួចធ្វើឲ្យស្រស់ខាងក្រោយ ==');
    ok('Function បើកផ្លូវធ្វើឲ្យ cookie cache ចាស់ សម្រាប់តេស្ត',
        !!(proxy && typeof proxy.expireCookieCacheForTests === 'function'),
        proxy && typeof proxy.expireCookieCacheForTests);
    if (proxy && typeof proxy.expireCookieCacheForTests === 'function') {
        resetEnv({ ZTO_COOKIE: ENV_COOKIE });
        blobs = useBlobs();
        net = upstream();
        await call({ barcode: BARCODE });
        const firstCookie = sentCookie(net);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ការអានដំបូងយក Cookie ពី blob',
            firstCookie === BLOB_COOKIE, firstCookie);

        proxy.expireCookieCacheForTests();
        blobs.state.readHangs = true;
        net = upstream();
        const swrStart = Date.now();
        res = await call({ barcode: '77130500000021' });
        const swrMs = Date.now() - swrStart;
        ok('⛔ cache ផុត + Blobs ព្យួរ ➜ lookup នៅតែឆ្លើយ (មិនទប់)',
            res.statusCode === 200 && JSON.parse(res.body).found === true, res.statusCode);
        ok('⛔ cache ផុត + Blobs ព្យួរ ➜ ប្រើ Cookie ក្នុងសតិ មិនធ្លាក់ទៅ env',
            sentCookie(net) === BLOB_COOKIE, sentCookie(net));
        ok('⛔ cache ផុត + Blobs ព្យួរ ➜ លឿន (< ១ វិនាទី មិនរង់ចាំពិដានអាន)',
            swrMs < 1000, swrMs + 'ms');

        // ⛔ ទិសផ្ទុយ ១ ៖ គ្មានតម្លៃក្នុងសតិសោះ ➜ **ត្រូវ** អាន store ជាមុន
        resetEnv({ ZTO_COOKIE: ENV_COOKIE });
        blobs = useBlobs();
        net = upstream();
        await call({ barcode: BARCODE });
        ok('⛔ ទិសផ្ទុយ ៖ សតិទទេ ➜ នៅតែអាន store មុនហៅ ZTO',
            blobs.calls.filter((c) => c.fn === 'get').length === 1
            && sentCookie(net) === BLOB_COOKIE,
            blobs.names() + '/' + sentCookie(net));

        // ⛔ ទិសផ្ទុយ ២ ៖ ការធ្វើឲ្យស្រស់ខាងក្រោយត្រូវ **កើតឡើងពិត**
        resetEnv({ ZTO_COOKIE: ENV_COOKIE });
        blobs = useBlobs();
        net = upstream();
        await call({ barcode: BARCODE });
        proxy.expireCookieCacheForTests();
        blobs.state.value = 'BOS-MAN-SESSION=swr-refreshed-value-4242; sidebarStatus=1';
        net = upstream();
        await call({ barcode: '77130500000022' });
        await new Promise((resolve) => setTimeout(resolve, 30));
        ok('⛔ ការធ្វើឲ្យស្រស់ខាងក្រោយកើតឡើងពិត (អាន store លើកទី ២)',
            blobs.calls.filter((c) => c.fn === 'get').length === 2, blobs.names());
        net = upstream();
        await call({ barcode: '77130500000023' });
        ok('⛔ សំណើបន្ទាប់ប្រើតម្លៃថ្មីដែលទើបធ្វើឲ្យស្រស់',
            sentCookie(net) === blobs.state.value, sentCookie(net));

        // ⛔ container បង្កក ➜ ការអានខាងក្រោយដោះយូរក្រោយមក ដោយកាន់ទិដ្ឋភាព
        //   **ចាស់** ➜ វាមិនត្រូវសរសេរជាន់ session ថ្មីដែល Argus ទើបប្រគល់។
        resetEnv({ ZTO_COOKIE: ENV_COOKIE });
        blobs = useBlobs();
        net = upstream();
        await call({ barcode: BARCODE });
        proxy.expireCookieCacheForTests();
        blobs.state.readDelayMs = 60;
        net = upstream(['BOS-MAN-SESSION=renewed-during-refresh-5150; Path=/']);
        await call({ barcode: '77130500000026' });
        await new Promise((resolve) => setTimeout(resolve, 140));
        net = upstream();
        await call({ barcode: '77130500000027' });
        ok('⛔ ការអានខាងក្រោយដែលយឺត មិនត្រូវសរសេរជាន់ session ថ្មីជាង',
            String(sentCookie(net) || '').indexOf('renewed-during-refresh-5150') !== -1,
            sentCookie(net));
        blobs.state.readDelayMs = 0;

        // ⛔ ទិសផ្ទុយ ៤ ៖ ការត្រៀម (OPTIONS) ឈរក្រៅផ្លូវស្កេន ➜ វាត្រូវ
        //   **បញ្ចប់** ការអានពិត មិនមែនត្រឹមតាំងវាខាងក្រោយ។
        resetEnv({ ZTO_COOKIE: ENV_COOKIE });
        blobs = useBlobs();
        net = upstream();
        await call({ barcode: BARCODE });
        proxy.expireCookieCacheForTests();
        blobs.state.value = 'BOS-MAN-SESSION=warmed-value-8888; sidebarStatus=1';
        await call({}, { method: 'OPTIONS' });
        net = upstream();
        await call({ barcode: '77130500000025' });
        ok('⛔ ការត្រៀម (OPTIONS) ➜ បញ្ចប់ការអាន ➜ ការស្កេនបន្ទាប់ប្រើតម្លៃថ្មីភ្លាម',
            sentCookie(net) === blobs.state.value, sentCookie(net));

        // ⛔ ទិសផ្ទុយ ៣ ៖ ក្រោយ 401 ការអានត្រូវ **ទប់** មិនមែន SWR
        resetEnv({ ZTO_COOKIE: ENV_COOKIE });
        blobs = useBlobs();
        unauthorizedUpstream();
        res = await call({ barcode: BARCODE });
        ok('លក្ខខណ្ឌចាំបាច់ ៖ Cookie ផុត ➜ 401',
            res.statusCode === 401, res.statusCode);
        blobs.state.value = 'BOS-MAN-SESSION=rotated-after-401-777; sidebarStatus=1';
        net = upstream();
        await call({ barcode: '77130500000024' });
        ok('⛔ ក្រោយ 401 ➜ អាន store ភ្លាម (មិនប្រើសតិចាស់តាម SWR)',
            sentCookie(net) === blobs.state.value, sentCookie(net));
    } else {
        for (let i = 0; i < 10; i++) ok('SWR cookie cache #' + (i + 1), false);
    }

    // ── ៤. ការបន្តអាយុ Cookie តាម Set-Cookie ───────────────────────────────
    console.log('\n== ៤. Argus បន្តអាយុ Cookie ➜ សរសេរចូល store ==');
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    blobs = useBlobs();
    net = upstream(['BOS-MAN-SESSION=renewed-value-55667788; Path=/; HttpOnly']);
    res = await call({ barcode: BARCODE });
    let written = blobs.calls.filter((c) => c.fn === 'set');
    ok('Set-Cookie ថ្មី ➜ សរសេរចូល store', written.length === 1, blobs.names());
    ok('តម្លៃដែលសរសេរផ្ទុក session ថ្មី',
        written.length === 1 && written[0].value.indexOf('BOS-MAN-SESSION=renewed-value-55667788') !== -1,
        written[0] && written[0].value);
    ok('តម្លៃដែលសរសេររក្សា pair ចាស់ដែលមិនប្រែ',
        written.length === 1 && written[0].value.indexOf('sidebarStatus=1') !== -1,
        written[0] && written[0].value);
    ok('តម្លៃដែលសរសេរគ្មានតួអក្សរគ្រប់គ្រង និងគ្មាន attribute',
        written.length === 1
            && !/[\u0000-\u001f\u007f]/.test(written[0].value)
            && !/path=|httponly|max-age|expires=|secure/i.test(written[0].value),
        written[0] && written[0].value);
    ok('lookup នៅជោគជ័យដដែល', res.statusCode === 200, res.statusCode);

    net = upstream(['BOS-MAN-SESSION=renewed-again-99887766; Path=/']);
    await call({ barcode: '77130500000014' });
    ok('⛔ Session ប្តូរពិត ➜ រក្សាទុកភ្លាម ទោះក្នុង ៦០ វិនាទី',
        blobs.calls.filter((c) => c.fn === 'set').length === 2, blobs.names());

    // ⛔ BOS-MAN-SESSION ថ្មីត្រូវរក្សាទុកភ្លាម និងប្រើបន្តក្នុងសតិ។
    // ការប្តូរគូធម្មតានៅគោរព throttle; zto-cookie-session-test វាស់ឆ្លង TTL។
    net = upstream();
    await call({ barcode: '77130500000015' });
    ok('⛔ Session ថ្មីត្រូវប្រើបន្តក្នុងសតិ',
        String(sentCookie(net) || '').indexOf('renewed-again-99887766') !== -1, sentCookie(net));
    ok('⛔ ទិសផ្ទុយ ៖ ការប្រើក្នុងសតិមិនត្រូវក្លាយជាការសរសេរស្ទួន',
        blobs.calls.filter((c) => c.fn === 'set').length === 2, blobs.names());

    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    blobs = useBlobs();
    net = upstream(['sidebarStatus=1']);
    await call({ barcode: BARCODE });
    ok('Set-Cookie ដដែល ➜ មិនសរសេរ',
        blobs.calls.filter((c) => c.fn === 'set').length === 0, blobs.names());

    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    blobs = useBlobs();
    net = upstream(['BOS-MAN-SESSION=; Max-Age=0']);
    await call({ barcode: BARCODE });
    ok('⛔ Set-Cookie ដែលលុប session ➜ មិនសរសេរ',
        blobs.calls.filter((c) => c.fn === 'set').length === 0, blobs.names());

    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    blobs = useBlobs({ writeThrows: true });
    net = upstream(['BOS-MAN-SESSION=renewed-value-55667788; Path=/']);
    res = await call({ barcode: BARCODE });
    ok('⛔ ការសរសេរធ្លាក់ ➜ lookup នៅជោគជ័យ (best-effort)',
        res.statusCode === 200 && JSON.parse(res.body).found === true, res.body);
    net = upstream();
    await call({ barcode: '77130500000016' });
    ok('⛔ ការសរសេរធ្លាក់ ➜ session ថ្មីនៅតែប្រើក្នុងសតិ (មិនត្រឡប់ទៅចាស់)',
        String(sentCookie(net) || '').indexOf('renewed-value-55667788') !== -1, sentCookie(net));

    // ── ៤ខ. jar ពិតរបស់ Argus ➜ ស្នាមភ្ជាប់នឹង helper (វាស់ 2026-09-02) ──────
    console.log('\n== ៤ខ. jar ដែលមានគូចម្លែក មិនត្រូវទម្លាក់ Cookie ថ្មី ==');
    // 🔴 helper រំលងគូខូចរួចសរសេរ jar ស្អាត។ តែ Cookie ដែលសរសេរដោយជំនាន់ចាស់
    // (ឬដោយដៃ) អាចមានគូចម្លែក ➜ sanitizeStoredCookie ត្រឡប់ '' ➜ ធ្លាក់ទៅ env
    // **ស្ងាត់** ➜ អ្នកប្រើយក Cookie ថ្មីរួច តែការស្កេននៅប្រើតម្លៃចាស់។
    const ODD_SESSION = 'BOS-MAN-SESSION=blob-cookie-value-9876';
    for (const [label, jar, expectDrop] of [
        ['តម្លៃមានចន្លោះ', ODD_SESSION + '; _ga_ref=Mozilla 5.0', '_ga_ref'],
        ['flag គ្មាន =', ODD_SESSION + '; justaflag', 'justaflag'],
        ['៨០ គូ', ODD_SESSION + '; ' + Array.from({ length: 80 },
            (_, i) => 'c' + i + '=v').join('; '), 'c79']
    ]) {
        resetEnv({ ZTO_COOKIE: ENV_COOKIE });
        useBlobs({ value: jar });
        const oddNet = upstream();
        const oddRes = await call({ barcode: BARCODE });
        const sent = sentCookie(oddNet);
        ok('jar ' + label + ' ➜ នៅតែប្រើ Cookie ពី blob',
            oddRes.statusCode === 200 && typeof sent === 'string'
            && sent.indexOf(ODD_SESSION) === 0, sent);
        ok('jar ' + label + ' ➜ ⛔ គូខូចមិនត្រូវផ្ញើទៅ ZTO',
            typeof sent === 'string' && sent.indexOf(expectDrop) === -1, sent);
    }
    // ⛔ ទិសផ្ទុយ ៖ ការការពារពិតនៅដដែល
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    useBlobs({ value: 'a=1; b=2' });
    const noSessNet = upstream();
    await call({ barcode: BARCODE });
    ok('⛔ blob គ្មាន BOS-MAN-SESSION ➜ ធ្លាក់ទៅ env ដដែល',
        sentCookie(noSessNet) === ENV_COOKIE, sentCookie(noSessNet));
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    useBlobs({ value: ODD_SESSION + '; x=a\r\nSet-Cookie: evil=1' });
    const injNet = upstream();
    await call({ barcode: BARCODE });
    ok('⛔ blob មាន CR/LF ➜ បដិសេធទាំងស្រុង ធ្លាក់ទៅ env',
        sentCookie(injNet) === ENV_COOKIE, sentCookie(injNet));

    // ── ៥. ការវិនិច្ឆ័យ ?diag=1 ────────────────────────────────────────────
    console.log('\n== ៥. ?diag=1 ប្រាប់ប្រភពពិត ==');
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    useBlobs();
    upstream();
    let diag = JSON.parse((await call({ diag: '1' })).body);
    ok('diag ប្រាប់ថាកំពុងប្រើ blob', diag.cookie && diag.cookie.source === 'blob', diag.cookie);
    ok('Blob គ្មាន metadata (Sync ដោយឧបករណ៍ចាស់) ➜ អាយុក្នុង Blob = null (មិនទាយ)',
        diag.cookie && diag.cookie.blobSyncAgeMs === null && diag.cookie.blobRenewAgeMs === null, diag.cookie);

    // ⛔ សំណើម្ចាស់គម្រោង ៖ 🩺 បង្ហាញ **អាយុពិត** របស់ Cookie ក្នុង Blob (ពេល Sync) — មិនមែនអាយុ cache ក្នុង container (`ageMs`)។
    //    ឧបករណ៍ Sync សរសេរ metadata `{ syncedAt }` · Function អានតាម `getWithMetadata()` · ការបន្តអាយុរក្សា `syncedAt` ហើយបោះ `renewedAt`។
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    const syncedAt = Date.now() - 3 * 3600000;
    blobs = useBlobs({ metadata: { syncedAt: syncedAt } });
    upstream();
    diag = JSON.parse((await call({ diag: '1' })).body);
    ok('diag ប្រាប់អាយុពិតរបស់ Cookie ក្នុង Blob (metadata syncedAt ➜ ~3 ម៉ោង)',
        diag.cookie && typeof diag.cookie.blobSyncAgeMs === 'number'
            && Math.abs(diag.cookie.blobSyncAgeMs - 3 * 3600000) < 60000 && diag.cookie.blobRenewAgeMs === null,
        diag.cookie);
    ok('⛔ អាយុក្នុង Blob ≠ អាយុ cache ក្នុង container (ageMs ទើបអាន ➜ តូច)',
        diag.cookie && typeof diag.cookie.ageMs === 'number' && diag.cookie.ageMs < 60000, diag.cookie);
    net = upstream(['BOS-MAN-SESSION=renewed-value-55667788; Path=/; HttpOnly']);
    await call({ barcode: BARCODE });
    const renewWrite = blobs.calls.filter((c) => c.fn === 'set')[0];
    ok('ការបន្តអាយុរក្សា syncedAt + បោះ renewedAt',
        !!renewWrite && renewWrite.metadata && renewWrite.metadata.syncedAt === syncedAt
            && typeof renewWrite.metadata.renewedAt === 'number' && Date.now() - renewWrite.metadata.renewedAt < 60000,
        renewWrite && renewWrite.metadata);
    upstream();
    diag = JSON.parse((await call({ diag: '1' })).body);
    ok('ក្រោយបន្តអាយុ ➜ diag ប្រាប់អាយុការបន្ត (តូច) ហើយ Sync នៅ ~3 ម៉ោង',
        diag.cookie && typeof diag.cookie.blobRenewAgeMs === 'number' && diag.cookie.blobRenewAgeMs < 60000
            && Math.abs(diag.cookie.blobSyncAgeMs - 3 * 3600000) < 60000, diag.cookie);
    for (const bad of [{ syncedAt: 'yesterday' }, { syncedAt: Date.now() + 7 * 86400000 }, { syncedAt: 5 }, []]) {
        resetEnv({ ZTO_COOKIE: ENV_COOKIE });
        useBlobs({ metadata: bad });
        upstream();
        diag = JSON.parse((await call({ diag: '1' })).body);
        ok('metadata ខូច ' + JSON.stringify(bad) + ' ➜ null (មិនបង្ហាញអាយុក្លែង)', diag.cookie && diag.cookie.blobSyncAgeMs === null, diag.cookie);
    }
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    useBlobs({ getStoreThrows: true, metadata: { syncedAt: syncedAt } });
    upstream();
    diag = JSON.parse((await call({ diag: '1' })).body);
    ok('ទិសផ្ទុយ ៖ Cookie ពី env ➜ គ្មានអាយុក្នុង Blob', diag.cookie && diag.cookie.source === 'env' && diag.cookie.blobSyncAgeMs === null, diag.cookie);

    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    useBlobs();
    upstream();
    diag = JSON.parse((await call({ diag: '1' })).body);
    ok('diag មាន fingerprint សម្រាប់ផ្ទៀងផ្ទាត់',
        !!(diag.cookie && diag.cookie.fingerprint && diag.cookie.fingerprint.length >= 6),
        diag.cookie);
    ok('⛔ diag មិនបញ្ចេញតម្លៃ Cookie សោះ',
        JSON.stringify(diag).indexOf('blob-cookie-value-9876') === -1, JSON.stringify(diag).slice(0, 200));

    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    useBlobs({ getStoreThrows: true });
    upstream();
    diag = JSON.parse((await call({ diag: '1' })).body);
    ok('diag ប្រាប់ថាកំពុងប្រើ env ពេល store ដាច់',
        diag.cookie && diag.cookie.source === 'env', diag.cookie);
    ok('diag ប្រាប់មូលហេតុរបស់ store ដែលដាច់',
        !!(diag.cookie && diag.cookie.storeReason), diag.cookie);

    // ⛔ **`?diag=1&fresh=1` ត្រូវរំលង cache ៦០ វិនាទី។** បើមិនដូច្នេះ helper
    // ដែលទើបសរសេរ Cookie ថ្មី ត្រូវរង់ចាំរហូតដល់ cache ផុតកំណត់មុនឃើញវា ➜
    // ការផ្ទៀងផ្ទាត់អូសបន្លាយដល់ ៧៥ វិនាទី (វាស់រួច 2026-09-02)។
    // ⛔ វាទទួលស្គាល់តែជាមួយ `diag=1` — ផ្លូវ lookup មិនអាចត្រូវបង្ខំឲ្យអាន
    //    blob រាល់ការស្កេនបានឡើយ (នោះនឹងបន្ថែមពេលទៅរាល់កញ្ចប់)។
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    const freshStore = useBlobs();
    upstream();
    const beforeFresh = JSON.parse((await call({ diag: '1' })).body);
    const readsAfterFirst = freshStore.calls.filter((c) => c.fn === 'get').length;
    const cachedAgain = JSON.parse((await call({ diag: '1' })).body);
    ok('diag ធម្មតាទី ២ ➜ ប្រើ cache (គ្មានការអាន blob ថ្មី)',
        freshStore.calls.filter((c) => c.fn === 'get').length === readsAfterFirst, { reads: freshStore.calls.filter((c) => c.fn === 'get').length, readsAfterFirst });
    const freshDiag = JSON.parse((await call({ diag: '1', fresh: '1' })).body);
    ok('⛔ `fresh=1` ➜ អាន blob ថ្មីពិត (រំលង cache)',
        freshStore.calls.filter((c) => c.fn === 'get').length > readsAfterFirst, { reads: freshStore.calls.filter((c) => c.fn === 'get').length, readsAfterFirst });
    ok('`fresh=1` ឆ្លើយ fingerprint ដដែល (មិនប្តូរអត្ថន័យ)',
        freshDiag.cookie && freshDiag.cookie.fingerprint === beforeFresh.cookie.fingerprint,
        { fresh: freshDiag.cookie, before: beforeFresh.cookie });
    ok('`fresh=1` ត្រូវរាយក្នុងចម្លើយ ➜ helper ដឹងថា Function គាំទ្រវា',
        freshDiag.fresh === true && cachedAgain.fresh === false,
        { fresh: freshDiag.fresh, cached: cachedAgain.fresh });
    const beforeLookupReads = freshStore.calls.filter((c) => c.fn === 'get').length;
    await call({ barcode: 'ZTO900111', fresh: '1' });
    await call({ barcode: 'ZTO900222', fresh: '1' });
    ok('⛔ ទិសផ្ទុយ ៖ `fresh=1` លើផ្លូវ lookup ត្រូវ **មិនអើពើ** (cache នៅដដែល)',
        freshStore.calls.filter((c) => c.fn === 'get').length === beforeLookupReads, { reads: freshStore.calls.filter((c) => c.fn === 'get').length, beforeLookupReads });

    // ⛔ **មូលហេតុត្រូវរស់រានពី cache។** `resolveCookieCredential()` សរសេរ
    // `storeReason = opened.reason` (ជា `''` ពេល store បើកបាន) **មុន** ការ
    // ពិនិត្យ cache ➜ ការអានដែលធ្លាក់/ទទេ កំណត់មូលហេតុលើការហៅ **ទី ១**
    // ប៉ុណ្ណោះ រួច env ត្រូវ cache ៦០ វិ. ➜ ការហៅបន្ទាប់លុបមូលហេតុនោះចោល។
    // វាស់បានលើ Windows ពិត (2026-09-02) ៖ helper សួរ `?diag=1` **១៤ ដង**
    // ហើយឃើញ `source: env` ដោយ **គ្មានមូលហេតុ** ➜ អ្នកប្រើកែមិនបាន។
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    useBlobs({ value: '' });
    upstream();
    const emptyFirst = JSON.parse((await call({ diag: '1' })).body);
    const emptySecond = JSON.parse((await call({ diag: '1' })).body);
    ok('blob ទទេ ➜ diag ប្រាប់មូលហេតុភ្លាម',
        emptyFirst.cookie && emptyFirst.cookie.source === 'env'
        && emptyFirst.cookie.storeReason === 'empty',
        JSON.stringify(emptyFirst.cookie));
    ok('⛔ មូលហេតុមិនត្រូវបាត់ក្រោយ env ចូល cache (helper សួរច្រើនដង)',
        emptySecond.cookie && emptySecond.cookie.storeReason === 'empty',
        JSON.stringify(emptySecond.cookie));

    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    useBlobs({ readThrows: true });
    upstream();
    await call({ diag: '1' });
    const readFailSecond = JSON.parse((await call({ diag: '1' })).body);
    ok('⛔ ការអានធ្លាក់ ➜ មូលហេតុនៅមើលឃើញលើការសួរបន្ទាប់',
        !!(readFailSecond.cookie && /^read:/.test(String(readFailSecond.cookie.storeReason))),
        JSON.stringify(readFailSecond.cookie));

    // ⛔ **ទិសផ្ទុយ** ៖ ការចងចាំមូលហេតុមិនត្រូវក្លាយជាមូលហេតុ **ចាស់ដែល
    // មិនរលត់** — store ដែលដើរធម្មតាត្រូវឆ្លើយ `storeReason: null`។
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    useBlobs();
    upstream();
    const healthyFirst = JSON.parse((await call({ diag: '1' })).body);
    const healthySecond = JSON.parse((await call({ diag: '1' })).body);
    ok('⛔ ទិសផ្ទុយ ៖ blob ដើរធម្មតា ➜ គ្មានមូលហេតុសល់',
        healthyFirst.cookie && healthyFirst.cookie.source === 'blob'
        && healthyFirst.cookie.storeReason === null
        && healthySecond.cookie.storeReason === null,
        JSON.stringify(healthySecond.cookie));

    // ── ៦. សញ្ញាសុខភាព ៖ តើ Cookie ត្រូវ ZTO បដិសេធថ្មីៗឬទេ? ──────────────
    // ⛔ វាជាមូលដ្ឋានរបស់របៀប --auto លើ Windows ៖ បើគ្មានការបដិសេធថ្មីៗ
    // នោះការបើក browser ដើម្បីយក Cookie ថ្មី គឺជាការខ្ជះខ្ជាយ។
    console.log('\n== ៦. សញ្ញាសុខភាព authRejectedAgeMs ==');
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    useBlobs();
    upstream();
    diag = JSON.parse((await call({ diag: '1' })).body);
    ok('ដំបូង ➜ គ្មានការបដិសេធ (null)',
        diag.cookie && diag.cookie.authRejectedAgeMs === null, diag.cookie);

    unauthorizedUpstream();
    await call({ barcode: BARCODE });
    diag = JSON.parse((await call({ diag: '1' })).body);
    ok('ក្រោយ 401 ➜ diag ប្រាប់អាយុនៃការបដិសេធ',
        !!(diag.cookie && typeof diag.cookie.authRejectedAgeMs === 'number'
            && diag.cookie.authRejectedAgeMs >= 0),
        diag.cookie);

    upstream();
    const recovered = await call({ barcode: BARCODE });
    diag = JSON.parse((await call({ diag: '1' })).body);
    ok('ការស្វែងរកជោគជ័យ ➜ សញ្ញាបដិសេធត្រូវលុប',
        recovered.statusCode === 200 && diag.cookie && diag.cookie.authRejectedAgeMs === null,
        diag.cookie);

    // ── ៧. warm-up (OPTIONS) ត្រូវរៀបចំ Cookie ជាមុន ────────────────────────
    // ⛔ ថ្នាក់ ៖ ការស្កេន **ដំបូង** ក្រោយ Lambda ត្រជាក់ ចំណាយទាំង cold start
    // **និង** ការអាន Netlify Blobs (ពិដាន ៣ វិ.) ➜ អ្នកប្រើរង់ចាំពីរដង។
    // warm-up របស់ client ជា `OPTIONS` ដែលធ្លាប់ត្រឡប់ 204 **មុនប៉ះ Cookie សោះ**
    // ➜ វា warm តែ container មិន warm ព័ត៌មានសម្ងាត់ទេ។
    console.log('\n== ៧. warm-up (OPTIONS) រៀបចំ Cookie ជាមុន ==');
    const warmEvent = (withBlobs) => {
        const event = { httpMethod: 'OPTIONS', headers: {}, queryStringParameters: null };
        if (withBlobs !== false) {
            event.blobs = Buffer.from(JSON.stringify({
                url: 'https://blobs.netlify.test', token: 'blob-token-for-tests'
            })).toString('base64');
            event.headers['x-nf-site-id'] = 'site-for-tests';
            event.headers['x-nf-deploy-id'] = 'deploy-for-tests';
        }
        return proxy.handler(event);
    };
    const reads = (fake) => fake.calls.filter((c) => c.fn === 'get').length;

    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    blobs = useBlobs();
    let warm = await warmEvent();
    ok('OPTIONS ➜ 204 ដដែល (កិច្ចសន្យាមិនប្រែ)', warm.statusCode === 204, warm.statusCode);
    ok('⛔ OPTIONS មិនបញ្ចេញតម្លៃ Cookie សោះ',
        String(warm.body || '').indexOf('BOS-MAN-SESSION') === -1
        && JSON.stringify(warm.headers || {}).indexOf('BOS-MAN-SESSION') === -1, warm);
    ok('⛔ ស្នូល ៖ warm-up អាន store ជាមុន (រៀបចំ cache)', reads(blobs) === 1, blobs.names());

    const readsAfterWarm = reads(blobs);
    net = upstream();
    res = await call({ barcode: BARCODE });
    ok('⛔ ស្នូល ៖ ការស្កេនដំបូងក្រោយ warm-up **មិនអាន store ស្ទួន**',
        reads(blobs) === readsAfterWarm, blobs.names());
    ok('ការស្កេននោះប្រើ Cookie ពី blob ពិត',
        res.statusCode === 200 && sentCookie(net) === BLOB_COOKIE, sentCookie(net));

    await warmEvent();
    ok('⛔ warm-up ដដែលក្នុង cache ៦០ វិ. ➜ មិនអាន store ម្តងទៀត (មិនវាយ Blobs)',
        reads(blobs) === readsAfterWarm, blobs.names());

    // ⛔ ទិសផ្ទុយ ៖ store ព្យួរ ➜ OPTIONS នៅតែត្រូវ settle ជា 204
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    blobs = useBlobs({ readHangs: true });
    warm = await warmEvent();
    ok('⛔ store ព្យួរ ➜ OPTIONS នៅតែឆ្លើយ 204 (settle ដោយរចនាសម្ព័ន្ធ)',
        warm.statusCode === 204, warm.statusCode);

    // ⛔ គ្មាន event.blobs ➜ មិនប៉ះ store សោះ
    resetEnv({ ZTO_COOKIE: ENV_COOKIE });
    blobs = useBlobs();
    warm = await warmEvent(false);
    ok('គ្មាន event.blobs ➜ warm-up ស្ងាត់ទាំងស្រុង',
        warm.statusCode === 204 && blobs.calls.length === 0, blobs.names());

    // ⛔ API ផ្លូវការ ➜ warm-up មិនត្រូវប៉ះ store ឡើយ (វាលឿនរួចហើយ)
    resetEnv({ ZTO_COOKIE: ENV_COOKIE, ZTO_AUTHORIZATION: 'Bearer official-token' });
    blobs = useBlobs();
    warm = await warmEvent();
    ok('API ផ្លូវការ ➜ warm-up មិនប៉ះ store',
        warm.statusCode === 204 && blobs.calls.length === 0, blobs.names());
}

run().then(() => {
    ENV_NAMES.forEach((name) => {
        if (SAVED_ENV[name] === undefined) delete process.env[name];
        else process.env[name] = SAVED_ENV[name];
    });
    global.fetch = SAVED_FETCH;
    if (proxy && typeof proxy.setBlobsModuleForTests === 'function') proxy.setBlobsModuleForTests(null);
    console.log('\n' + (fail
        ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'
        : '✅ ជោគជ័យ ' + pass));
    process.exitCode = fail ? 1 : 0;
}, (error) => {
    console.log('  FAIL   checker បោះកំហុស: ' + (error && error.message || 'unknown'));
    process.exitCode = 1;
});
