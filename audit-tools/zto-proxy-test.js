'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const appDir = process.env.ZTOPROXY_APP_DIR || path.join(__dirname, '..');
const proxy = require(path.join(appDir, 'ZoeW/netlify/functions/zto-order-detail.js'));

async function run() {
    const oldFetch = global.fetch;
    const oldKey = process.env.ZTO_PROXY_KEY;
    process.env.ZTO_PROXY_KEY = 'test-proxy-key';

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
        assert.strictEqual(rejected.statusCode, 502);
        assert.strictEqual(JSON.parse(rejected.body).error, 'session expired');

        assert.deepStrictEqual(Object.keys(body).sort(), ['barcode', 'cod', 'dod', 'phone', 'success']);

        const proxySource = fs.readFileSync(path.join(appDir, 'ZoeW/netlify/functions/zto-order-detail.js'), 'utf8');
        const appSource = fs.readFileSync(path.join(appDir, 'ZoeW/app.js'), 'utf8');
        const upstreamTimeout = /const ZTO_UPSTREAM_TIMEOUT_MS = (\d+);/.exec(proxySource);
        const clientTimeout = /const AUTO_LOOKUP_TIMEOUT_MS = (\d+);/.exec(appSource);
        assert.ok(upstreamTimeout && clientTimeout);
        assert.ok(Number(clientTimeout[1]) >= Number(upstreamTimeout[1]) + 3000);

        const invalid = await proxy.handler({
            httpMethod: 'GET',
            headers: { 'x-zoe-proxy-key': 'test-proxy-key' },
            queryStringParameters: { barcode: '<bad>' }
        });
        assert.strictEqual(invalid.statusCode, 400);

        console.log('zto-proxy-test: ok');
    } finally {
        global.fetch = oldFetch;
        if (oldKey === undefined) delete process.env.ZTO_PROXY_KEY;
        else process.env.ZTO_PROXY_KEY = oldKey;
    }
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
