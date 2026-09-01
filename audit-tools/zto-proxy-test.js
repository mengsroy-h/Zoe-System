'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const appDir = process.env.ZTOPROXY_APP_DIR || path.join(__dirname, '..');
const ztoSession = require(path.join(appDir, 'ZoeW/netlify/lib/zto-session.js'));
const proxy = require(path.join(appDir, 'ZoeW/netlify/functions/zto-order-detail.js'));

async function run() {
    const oldFetch = global.fetch;
    const envNames = [
        'ZTO_PROXY_KEY', 'ZTO_COOKIE', 'ZTO_TOKEN', 'ZTO_TOKEN_HEADER', 'ZTO_AUTHORIZATION',
        'ZTO_AUTO_LOGIN', 'ZTO_USERNAME', 'ZTO_PASSWORD', 'ZTO_SESSION_ENCRYPTION_KEY'
    ];
    const oldEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
    const oldGetAutoSessionCookie = ztoSession.getAutoSessionCookie;
    process.env.ZTO_PROXY_KEY = 'test-proxy-key';
    process.env.ZTO_COOKIE = 'BOS-MAN-SESSION=test-session';
    delete process.env.ZTO_TOKEN;
    delete process.env.ZTO_TOKEN_HEADER;
    delete process.env.ZTO_AUTHORIZATION;
    delete process.env.ZTO_AUTO_LOGIN;
    delete process.env.ZTO_USERNAME;
    delete process.env.ZTO_PASSWORD;
    delete process.env.ZTO_SESSION_ENCRYPTION_KEY;

    try {
        let captured = null;
        global.fetch = async (url, options) => {
            captured = { url, options };
            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({
                    success: true,
                    data: {
                        billCode: '77130527210012',
                        consigneePhone: '855000000000',
                        consigneeName: 'Test Customer',
                        agentAmount: 6.55,
                        arrivalServiceCharge: 1.25,
                        destinationSite: 'Test Site'
                    }
                })
            };
        };

        const unauthorized = await proxy.handler({
            httpMethod: 'GET',
            headers: {},
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(unauthorized.statusCode, 401);

        delete process.env.ZTO_COOKIE;
        const unconfigured = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(unconfigured.statusCode, 503);
        assert.strictEqual(JSON.parse(unconfigured.body).code, 'ZTO_AUTH_NOT_CONFIGURED');
        process.env.ZTO_COOKIE = 'BOS-MAN-SESSION=test-session';

        const result = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(result.statusCode, 200);
        const body = JSON.parse(result.body);
        assert.deepStrictEqual({ phone: body.phone, cod: body.cod, dod: body.dod }, {
            phone: '855000000000', cod: 6.55, dod: 1.25
        });
        assert.strictEqual(captured.url, 'https://aargus-api.ztoglobal.com/scan/get/order/detail');
        assert.strictEqual(captured.options.method, 'POST');
        assert.strictEqual(captured.options.headers.Origin, 'https://argus.ztoglobal.com');
        assert.strictEqual(captured.options.headers.Referer, 'https://argus.ztoglobal.com/');
        assert.strictEqual(captured.options.headers.Cookie, 'BOS-MAN-SESSION=test-session');
        assert.strictEqual(captured.options.redirect, 'manual');
        assert.deepStrictEqual(JSON.parse(captured.options.body), {
            billCode: '77130527210012', countryCode: 'KH'
        });

        global.fetch = async () => ({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ success: false, error: 'session expired', data: null })
        });
        const rejected = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(rejected.statusCode, 401);
        assert.strictEqual(JSON.parse(rejected.body).code, 'ZTO_AUTH_EXPIRED');

        let redirectJsonCalled = false;
        global.fetch = async () => ({
            ok: false,
            status: 302,
            headers: { get: (name) => name.toLowerCase() === 'location' ? 'https://argus.ztoglobal.com/login' : 'text/html' },
            json: async () => { redirectJsonCalled = true; throw new Error('must not parse login HTML'); }
        });
        const redirectedToLogin = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(redirectedToLogin.statusCode, 401);
        assert.strictEqual(JSON.parse(redirectedToLogin.body).code, 'ZTO_AUTH_EXPIRED');
        assert.strictEqual(redirectJsonCalled, false);

        global.fetch = async () => ({
            ok: true,
            status: 200,
            headers: { get: () => 'text/html; charset=utf-8' },
            json: async () => { throw new Error('must not parse login HTML'); }
        });
        const htmlLogin = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(htmlLogin.statusCode, 401);
        assert.strictEqual(JSON.parse(htmlLogin.body).code, 'ZTO_AUTH_EXPIRED');

        const ZTO_OAUTH_POINTER = 'https://iam-web.zto.com/oauth2?app_id=zt_Fh4PydiUoqS9a3ipJshcQ'
            + '&redirect_url=https%3A%2F%2Faargus-api.ztoglobal.com%2Flogin%3FredirectFrontURI%3DaHR0cHM6Ly9hcmd1cy56dG9nbG9iYWwuY29t';
        global.fetch = async () => ({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ error: ZTO_OAUTH_POINTER, code: 'ZTO_UPSTREAM_REJECTED' })
        });
        const oauthPointer = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(oauthPointer.statusCode, 401,
            '⛔ ZTO ប្រាប់ថា «មិនទាន់ចូល» ដោយឆ្លើយ **URL របស់ OAuth2 IdP** ក្នុងវាល error — នោះជាការបដិសេធ auth មិនមែនកំហុស upstream ទេ');
        assert.strictEqual(JSON.parse(oauthPointer.body).code, 'ZTO_AUTH_EXPIRED',
            'ការឆ្លើយបែបនោះត្រូវកេះការ login ឡើងវិញ មិនមែនបោះ URL ឆៅទៅអ្នកប្រើ');
        assert.ok(!oauthPointer.body.includes('iam-web.zto.com'),
            '⛔ URL របស់ IdP (មាន app_id និង redirect) មិនត្រូវហូរទៅ browser របស់អ្នកប្រើ');

        global.fetch = async () => ({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ success: true, data: { billCode: '77130527210012', consigneePhone: '0974158508' } })
        });
        const notALoginUrl = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(notALoginUrl.statusCode, 200,
            '⛔ ទិសផ្ទុយ ៖ ការឆ្លើយធម្មតាមិនត្រូវត្រូវច្រឡំជាការបដិសេធ auth');

        global.fetch = async () => ({
            ok: false,
            status: 429,
            headers: { get: () => 'application/json' },
            json: async () => ({ success: false, error: 'too many requests' })
        });
        const throttled = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(throttled.statusCode, 429);
        assert.strictEqual(JSON.parse(throttled.body).code, 'ZTO_RATE_LIMITED');

        process.env.ZTO_AUTHORIZATION = 'Bearer official-token';
        global.fetch = async (url, options) => {
            captured = { url, options };
            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ success: true, data: { billCode: '77130527210012' } })
            };
        };
        const officialToken = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(officialToken.statusCode, 200);
        assert.strictEqual(captured.options.headers.Authorization, 'Bearer official-token');
        assert.strictEqual(captured.options.headers.Cookie, undefined);
        delete process.env.ZTO_AUTHORIZATION;

        delete process.env.ZTO_COOKIE;
        process.env.ZTO_AUTO_LOGIN = 'true';
        let autoSessionCalls = 0;
        const blobsEvent = {
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key', 'x-nf-site-id': 'site-1' },
            blobs: 'eyJ1cmwiOiJodHRwczovL2V4YW1wbGUuaW52YWxpZCIsInRva2VuIjoidCJ9',
            queryStringParameters: { barcode: '77130527210012' }
        };
        ztoSession.getAutoSessionCookie = async (options) => {
            autoSessionCalls += 1;
            assert.ok(options && typeof options === 'object',
                'auto login must receive options carrying the Lambda event');
            assert.strictEqual(options.lambdaEvent, blobsEvent,
                'the Netlify Blobs context lives on the Lambda event — passing it is what lets connectLambda() run');
            return 'BOS-MAN-SESSION=auto-session';
        };
        global.fetch = async (url, options) => {
            captured = { url, options };
            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ success: true, data: { billCode: '77130527210012' } })
            };
        };
        const autoSessionResult = await proxy.handler(blobsEvent);
        assert.strictEqual(autoSessionResult.statusCode, 200);
        assert.strictEqual(autoSessionCalls, 1);
        assert.strictEqual(captured.options.headers.Cookie, 'BOS-MAN-SESSION=auto-session');

        process.env.ZTO_COOKIE = 'BOS-MAN-SESSION=expired-static';
        autoSessionCalls = 0;
        let refreshFetchCalls = 0;
        const refreshEvent = {
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key', 'x-nf-site-id': 'site-1' },
            blobs: 'eyJ1cmwiOiJodHRwczovL2V4YW1wbGUuaW52YWxpZCIsInRva2VuIjoidCJ9',
            queryStringParameters: { barcode: '77130527210012' }
        };
        ztoSession.getAutoSessionCookie = async (options) => {
            autoSessionCalls += 1;
            assert.deepStrictEqual(options, {
                forceRefresh: true,
                rejectedCookie: 'BOS-MAN-SESSION=expired-static',
                lambdaEvent: refreshEvent
            });
            return 'BOS-MAN-SESSION=refreshed-auto';
        };
        global.fetch = async (url, options) => {
            captured = { url, options };
            refreshFetchCalls += 1;
            if (refreshFetchCalls === 1) {
                return {
                    ok: false,
                    status: 401,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ error: 'expired' })
                };
            }
            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ success: true, data: { billCode: '77130527210012' } })
            };
        };
        const refreshedResult = await proxy.handler(refreshEvent);
        assert.strictEqual(refreshedResult.statusCode, 200);
        assert.strictEqual(refreshFetchCalls, 2);
        assert.strictEqual(autoSessionCalls, 1, 'expired cookie must trigger exactly one refresh');
        assert.strictEqual(captured.options.headers.Cookie, 'BOS-MAN-SESSION=refreshed-auto');

        process.env.ZTO_AUTHORIZATION = 'Bearer rejected-official-token';
        autoSessionCalls = 0;
        global.fetch = async () => ({
            ok: false,
            status: 401,
            headers: { get: () => 'application/json' },
            json: async () => ({ error: 'expired' })
        });
        const rejectedOfficial = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(rejectedOfficial.statusCode, 401);
        assert.strictEqual(JSON.parse(rejectedOfficial.body).code, 'ZTO_AUTH_EXPIRED');
        assert.strictEqual(autoSessionCalls, 0, 'official credentials must not fall back to browser login');
        delete process.env.ZTO_AUTHORIZATION;

        delete process.env.ZTO_COOKIE;
        ztoSession.getAutoSessionCookie = async () => {
            throw new ztoSession.ZtoSessionError('ZTO_LOGIN_CHALLENGE', 409);
        };
        const challenge = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(challenge.statusCode, 409);
        assert.strictEqual(JSON.parse(challenge.body).code, 'ZTO_LOGIN_CHALLENGE');

        assert.deepStrictEqual(Object.keys(body).sort(), ['barcode', 'cod', 'dod', 'phone', 'success']);

        const proxySource = fs.readFileSync(path.join(appDir, 'ZoeW/netlify/functions/zto-order-detail.js'), 'utf8');
        const appSource = fs.readFileSync(path.join(appDir, 'ZoeW/app.js'), 'utf8');
        const vm = require('vm');
        function sliceFn(name, source) {
            const start = source.indexOf('    async function ' + name + '(');
            const from = start !== -1 ? start : source.indexOf('    function ' + name + '(');
            assert.ok(from !== -1, 'រកមុខងារ ' + name + ' មិនឃើញ');
            let depth = 0, i = source.indexOf('{', from);
            for (let j = i; j < source.length; j++) {
                if (source[j] === '{') depth++;
                else if (source[j] === '}') { depth--; if (!depth) return source.slice(from, j + 1); }
            }
            assert.fail('កាត់មុខងារ ' + name + ' មិនបាន');
        }

        const upstreamTimeout = /const ZTO_UPSTREAM_TIMEOUT_MS = (\d+);/.exec(proxySource);
        const clientTimeout = /const AUTO_LOOKUP_TIMEOUT_MS = (\d+);/.exec(appSource);
        const ztoClientTimeout = /const ZTO_AUTO_LOOKUP_TIMEOUT_MS = (\d+);/.exec(appSource);
        assert.ok(upstreamTimeout && clientTimeout && ztoClientTimeout);
        assert.ok(Number(ztoClientTimeout[1]) >= Number(upstreamTimeout[1]) + 3000);
        const lookupStart = appSource.indexOf('async function attemptAutoLookup(');
        const lookupEnd = appSource.indexOf('\n    function openExchangeRateModal(', lookupStart);
        const lookupSource = appSource.slice(lookupStart, lookupEnd);
        assert.ok(lookupSource.includes("lookupError.lookupCode = data && data.code"));
        assert.ok(lookupSource.includes("e.lookupCode === 'ZTO_AUTH_EXPIRED'"));
        assert.ok(lookupSource.includes("e.lookupCode === 'ZTO_LOGIN_CHALLENGE'"));
        assert.ok(lookupSource.includes('ZTO session នៅតែមិនត្រឹមត្រូវ'));
        assert.ok(lookupSource.includes('lookupError.lookupReason = safeLookupReason(data && data.reason)'),
            '⛔ ផ្លូវស្កេនត្រូវយក `reason` ពី proxy — បើអត់ អ្នកប្រើឃើញតែ «ពិនិត្យ Netlify logs»');
        assert.ok(lookupSource.includes("e.lookupReason ? ' — ជាប់ត្រង់ '"),
            '⛔ សារកំហុសត្រូវបង្ហាញជំហានដែលជាប់ មិនមែនរុញអ្នកប្រើទៅអាន log');

        const reasonCtx = { console };
        reasonCtx.globalThis = reasonCtx;
        vm.createContext(reasonCtx);
        vm.runInContext(sliceFn('safeLookupReason', appSource).replace(/^\s{4}/gm, ''), reasonCtx);
        const reasonProbe = vm.runInContext('[' + [
            "safeLookupReason('login:wait-password@iam-web.zto.com:TimeoutError')",
            "safeLookupReason('getstore:MissingBlobsEnvironmentError')",
            "safeLookupReason('<img src=x onerror=alert(1)>')",
            "safeLookupReason('a b')",
            "safeLookupReason(null)",
            "safeLookupReason('x'.repeat(200))"
        ].join(',') + ']', reasonCtx);
        assert.deepStrictEqual(Array.from(reasonProbe), [
            'login:wait-password@iam-web.zto.com:TimeoutError',
            'getstore:MissingBlobsEnvironmentError',
            '', '', '', ''
        ], '⛔ `reason` មកពី server ➜ ត្រូវច្រោះមុនចូល DOM (ទិសផ្ទុយ ៖ តម្លៃត្រឹមត្រូវមិនត្រូវបោះចោល)');
        assert.ok(appSource.includes('const LOOKUP_MANUAL_FALLBACK_MS = 1800;'));
        assert.strictEqual(result.headers['X-Frame-Options'], 'DENY');
        assert.strictEqual(result.headers['Referrer-Policy'], 'no-referrer');

        const invalid = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '<bad>' }
        });
        assert.strictEqual(invalid.statusCode, 400);

        async function measureTestTimeout(url) {
            const seen = {};
            const ctx = {
                console,
                setTimeout: (fn) => { try { fn(); } catch (_) {} return 0; },
                clearTimeout: () => {},
                window: {},
                document: {
                    getElementById: (id) => ({
                        value: id === 'lookupApiUrlInput' ? url : '',
                        disabled: false
                    })
                },
                prompt: () => '11600099951614',
                alert: (text) => { seen.alert = String(text); },
                showToast: (msg) => { (seen.toasts = seen.toasts || []).push(String(msg)); },
                getLookupApiConfig: () => ({}),
                decryptLookupSecret: async () => '',
                fetchWithTimeout: async (target, init, timeoutMs, label) => {
                    seen.timeoutMs = timeoutMs;
                    seen.label = label;
                    const error = new Error(label);
                    throw error;
                },
                ZoeErrors: null
            };
            ctx.globalThis = ctx;
            vm.createContext(ctx);
            const consts = /const (?:AUTO_LOOKUP_TIMEOUT_MS|ZTO_AUTO_LOOKUP_TIMEOUT_MS|LOOKUP_TEST_TIMEOUT_MS|ZTO_TEST_TIMEOUT_MS) = \d+;/g;
            const declared = appSource.match(consts) || [];
            vm.runInContext(declared.join('\n').replace(/^\s+/gm, ''), ctx);
            vm.runInContext(sliceFn('lookupApiIsZto', appSource).replace(/^\s{4}/gm, ''), ctx);
            vm.runInContext(sliceFn('testLookupApiConfig', appSource).replace(/^\s{4}/gm, ''), ctx);
            await vm.runInContext('testLookupApiConfig(null)', ctx);
            return seen;
        }

        const sheetsTest = await measureTestTimeout('https://script.google.com/macros/s/AKfycbTEST/exec?code={barcode}');
        const ztoTest = await measureTestTimeout('/.netlify/functions/zto-order-detail?barcode={barcode}');
        assert.strictEqual(sheetsTest.timeoutMs, 20000,
            '⛔ ផ្លូវ Google Sheet/Apps Script ត្រូវនៅ ២០ វិនាទីដដែល — ការកែប៊ូតុងសាកល្បងមិនត្រូវប៉ះវា');
        assert.deepStrictEqual(sheetsTest.toasts, ['កំពុងសាកល្បង API...'],
            '⛔ ផ្លូវ Sheet ៖ សារ និងចំនួន toast នៅដដែល (គ្មាន toast វឌ្ឍនភាពបន្ថែម)');
        assert.ok(ztoTest.toasts.length === 3 && ztoTest.toasts.some((t) => t.indexOf('Chromium') !== -1),
            'ផ្លូវ ZTO ៖ ត្រូវបង្ហាញវឌ្ឍនភាព កុំឲ្យមើលទៅដូចជាប់', ztoTest.toasts);
        assert.ok(sheetsTest.alert && sheetsTest.alert.indexOf('Google Apps Script') !== -1,
            '⛔ ផ្លូវ Sheet ៖ សារបរាជ័យនៅដដែល', sheetsTest.alert);
        assert.strictEqual(ztoTest.timeoutMs, 30000,
            'ផ្លូវ ZTO ៖ ត្រូវអត់ធ្មត់ជាង ២០ វិ. (server ត្រូវការ ~២០ វិ. លើកដំបូង) តែមិនរង់ចាំដល់ ៥៨ វិ.');
        assert.ok(ztoTest.alert && ztoTest.alert.indexOf('ZTO') !== -1 && ztoTest.alert.indexOf('Google Apps Script') === -1,
            'ផ្លូវ ZTO ៖ សារបរាជ័យត្រូវនិយាយអំពី ZTO មិនមែនចោទ Apps Script', ztoTest.alert);
        assert.ok(Number(ztoClientTimeout[1]) > 30000,
            'ផ្លូវស្កេនពិតត្រូវអត់ធ្មត់ជាងប៊ូតុងសាកល្បង (វាមាន manual fallback ១.៨ វិ.)');

        process.env.ZTO_AUTO_LOGIN = 'true';
        process.env.ZTO_USERNAME = 'test-user@example.invalid';
        process.env.ZTO_PASSWORD = 'test-password-never-deploy';
        process.env.ZTO_SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
        delete process.env.ZTO_COOKIE;
        process.env.ZTO_LOGIN_BUDGET_MS = '5000';
        ztoSession.getAutoSessionCookie = () => new Promise(() => {});
        const budgetStart = Date.now();
        const budgetGuard = (promise, ms, label) => {
            let timer = null;
            return Promise.race([
                promise,
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })
            ]).finally(() => { if (timer) clearTimeout(timer); });
        };
        const budgetCapped = await budgetGuard(proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        }), 15000, '⛔ ការ login ដែលព្យួរមិនត្រូវបានកាត់ ➜ Netlify សម្លាប់ Function ➜ «Failed to fetch»');
        const budgetElapsed = Date.now() - budgetStart;
        assert.strictEqual(budgetCapped.statusCode, 504,
            '⛔ ការ login ដែលព្យួរត្រូវឆ្លើយជា JSON — បើអត់ Netlify សម្លាប់ Function ➜ browser ឃើញ «Failed to fetch»');
        const budgetBody = JSON.parse(budgetCapped.body);
        assert.strictEqual(budgetBody.code, 'ZTO_LOGIN_TIMEOUT');
        assert.strictEqual(budgetBody.reason, 'budget-exceeded',
            'ការធ្លាក់ត្រូវប្រាប់ថាវាឈានដល់ពិដានពេលវេលារបស់ Function');
        assert.ok(budgetElapsed < 15000, 'ច្រកទ្វារត្រូវបញ្ឈប់តាមថវិកា មិនរង់ចាំគ្មានទីបញ្ចប់', budgetElapsed);
        delete process.env.ZTO_LOGIN_BUDGET_MS;
        ztoSession.getAutoSessionCookie = oldGetAutoSessionCookie;

        console.log('zto-proxy-test: ok');
    } finally {
        global.fetch = oldFetch;
        ztoSession.getAutoSessionCookie = oldGetAutoSessionCookie;
        envNames.forEach((name) => {
            if (oldEnv[name] === undefined) delete process.env[name];
            else process.env[name] = oldEnv[name];
        });
    }
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
