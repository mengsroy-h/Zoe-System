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
        ztoSession.getAutoSessionCookie = async (options) => {
            autoSessionCalls += 1;
            assert.strictEqual(options, undefined);
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
        const autoSessionResult = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
        assert.strictEqual(autoSessionResult.statusCode, 200);
        assert.strictEqual(autoSessionCalls, 1);
        assert.strictEqual(captured.options.headers.Cookie, 'BOS-MAN-SESSION=auto-session');

        process.env.ZTO_COOKIE = 'BOS-MAN-SESSION=expired-static';
        autoSessionCalls = 0;
        let refreshFetchCalls = 0;
        ztoSession.getAutoSessionCookie = async (options) => {
            autoSessionCalls += 1;
            assert.deepStrictEqual(options, {
                forceRefresh: true,
                rejectedCookie: 'BOS-MAN-SESSION=expired-static'
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
        const refreshedResult = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '77130527210012' }
        });
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
        assert.ok(appSource.includes('const LOOKUP_MANUAL_FALLBACK_MS = 1800;'));
        assert.strictEqual(result.headers['X-Frame-Options'], 'DENY');
        assert.strictEqual(result.headers['Referrer-Policy'], 'no-referrer');

        const invalid = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '<bad>' }
        });
        assert.strictEqual(invalid.statusCode, 400);

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
