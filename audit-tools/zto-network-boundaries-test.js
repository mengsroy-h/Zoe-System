'use strict';

// តេស្តកូដពិត៖ HTTP headers មកដល់ តែ body ព្យួរ និង Cookie ប្រែកណ្តាលសំណើស្របគ្នា។
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const ROOT = process.env.ZTO_BOUNDARIES_APP_DIR
    ? path.resolve(process.env.ZTO_BOUNDARIES_APP_DIR) : path.resolve(__dirname, '..');
const sync = require(path.join(ROOT, 'tools/zto-cookie-sync-windows/sync-zto-cookie.js'));
const proxy = require(path.join(ROOT, 'ZoeW/netlify/functions/zto-order-detail.js'));
const TOKEN = 'synthetic-token-for-tests-only';
const COOKIE = 'BOS-MAN-SESSION=synthetic-old-session';
const FRESH = 'BOS-MAN-SESSION=synthetic-new-session';
let pass = 0;
let fail = 0;

function bounded(pending, ms = 700) {
    let timer;
    return Promise.race([pending, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('TEST_WATCHDOG')), ms);
    })]).finally(() => clearTimeout(timer));
}

async function scenario(name, run) {
    try { await run(); pass++; console.log('   ok    ' + name); }
    catch (error) { fail++; console.log('  FAIL   ' + name + ': ' + error.message); }
}

function event(query) {
    return { httpMethod: 'GET', headers: { 'x-zoe-proxy-key': TOKEN },
        queryStringParameters: query, blobs: 'synthetic-context' };
}

function response(status, data) {
    return { ok: status === 200, status,
        headers: { get: () => 'application/json', getSetCookie: () => [] },
        json: async () => data };
}

async function main() {
    const nativeFetch = global.fetch;
    const requests = [];
    const server = http.createServer((req, res) => {
        requests.push(req.url);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (req.url === '/large') res.write('x'.repeat(1024 * 1024 + 64));
        else if (req.url === '/ok') res.end('{"account_id":"synthetic-account"}');
        else {
            res.write('{"account_id":');
            if (req.url === '/drop') setTimeout(() => res.destroy(), 15);
        }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const controllers = [];
    let aborts = 0;
    function controls(endpoint, timeoutMs = 100) {
        return { timeoutMs, fetchImpl: (_url, init) => {
            const rescue = new AbortController();
            controllers.push(rescue);
            init.signal.addEventListener('abort', () => { aborts++; rescue.abort(); }, { once: true });
            return nativeFetch(origin + endpoint, Object.assign({}, init, { signal: rescue.signal }));
        } };
    }
    try {
        await scenario('HTTP body ព្យួរ ➜ timeout និង abort ពិត', async () => {
            const before = aborts;
            await assert.rejects(bounded(sync.getNetlifySite('test-site', TOKEN, controls('/stall'))),
                (error) => error.code === 'NETLIFY_TIMEOUT' && error.transient === true);
            assert.ok(aborts > before);
            assert.ok(requests.includes('/stall'));
        });
        await scenario('ទិសផ្ទុយ៖ body ពេញលេញ ➜ JSON ត្រឹមត្រូវ', async () => {
            const result = await bounded(sync.getNetlifySite('test-site', TOKEN, controls('/ok', 500)));
            assert.deepEqual(result, { accountId: 'synthetic-account' });
        });
        await scenario('ការតភ្ជាប់ដាច់កណ្តាល body ➜ អនុញ្ញាត retry', async () => {
            await assert.rejects(bounded(sync.getNetlifySite('test-site', TOKEN, controls('/drop', 500))),
                (error) => error.code === 'NETLIFY_NETWORK' && error.transient === true);
            assert.ok(requests.includes('/drop'));
        });
        await scenario('body លើសពិដាន ➜ បដិសេធមុនរង់ចាំ EOF', async () => {
            await assert.rejects(bounded(sync.getNetlifySite('test-site', TOKEN, controls('/large', 2000))),
                (error) => error.code === 'NETLIFY_SITE_INVALID_RESPONSE');
            assert.ok(requests.includes('/large'));
        });
        await scenario('signed URL body ព្យួរ ➜ retry ហើយ upload ជោគជ័យ', async () => {
            let calls = 0;
            let late;
            const options = {
                siteId: 'test-site', token: TOKEN, timeoutMs: 25,
                retryAttempts: 2, sleepImpl: async () => {},
                fetchImpl: async (_url, init) => {
                    calls++;
                    if (calls === 1) return { ok: true, status: 200,
                        text: () => new Promise((resolve) => { late = resolve; }) };
                    if (calls === 2) return { ok: true, status: 200,
                        text: async () => JSON.stringify({ url: 'https://blob.synthetic.test/upload' }) };
                    assert.equal(init.body, COOKIE);
                    assert.equal(init.headers.Authorization, undefined);
                    return { ok: true, status: 200, body: { cancel: async () => {} } };
                }
            };
            try {
                await bounded(sync.syncNetlifyCookie(COOKIE, options));
                assert.equal(calls, 3);
            } finally {
                if (late) late(JSON.stringify({ url: 'https://blob.synthetic.test/expired' }));
            }
            await new Promise((resolve) => setImmediate(resolve));
            assert.equal(calls, 3, 'body ចាស់មកយឺត មិនត្រូវបាញ់ upload ថ្មី');
        });
        await scenario('diagnostics body ព្យួរ ➜ ស្ថានភាព unreachable', async () => {
            const result = await bounded(sync.checkCookieHealth({ siteUrl: 'https://synthetic.test',
                proxyKey: TOKEN, timeoutMs: 20,
                fetchImpl: async () => ({ ok: true, text: () => new Promise(() => {}) }) }));
            assert.equal(result.status, 'unreachable');
            assert.equal(result.healthy, false);
        });
        for (const status of [401, 403]) {
            for (const cancelMode of ['hang', 'reject']) {
            await scenario('HTTP ' + status + ' និង cancel ' + cancelMode + ' ➜ មិន retry', async () => {
                let calls = 0;
                let cancels = 0;
                let reads = 0;
                await assert.rejects(bounded(sync.syncNetlifyCookie(COOKIE, {
                    siteId: 'test-site', token: TOKEN, timeoutMs: 20,
                    retryAttempts: 2, sleepImpl: async () => {},
                    fetchImpl: async () => {
                        calls++;
                        return { ok: false, status,
                            text: async () => { reads++; return ''; },
                            body: { cancel: () => {
                                cancels++;
                                return cancelMode === 'hang' ? new Promise(() => {})
                                    : Promise.reject(new Error('synthetic-cancel-rejected'));
                            } } };
                    }
                })), (error) => error.code === 'NETLIFY_BLOB_URL_FAILED' && error.transient === false);
                assert.equal(calls, 1);
                assert.equal(cancels, 1);
                assert.equal(reads, 0);
            });
            }
        }
        await scenario('Cookie ថ្មី៖ auth retry និង lookup ធម្មតា ចែកសំណើតែមួយ', async () => {
            const savedEnv = Object.assign({}, process.env);
            let finishLookup;
            let freshLookupStarted;
            const began = new Promise((resolve) => { freshLookupStarted = resolve; });
            let stored = COOKIE;
            let freshCalls = 0;
            let oldCalls = 0;
            try {
                for (const key of Object.keys(process.env)) if (key.startsWith('ZTO_')) delete process.env[key];
                Object.assign(process.env, { ZTO_PROXY_KEY: TOKEN, ZTO_UPSTREAM_TIMEOUT_MS: '2000',
                    ZTO_REQUEST_BUDGET_MS: '9000', ZTO_CACHE_TTL_MS: '0' });
                proxy.resetCachesForTests();
                proxy.setBlobsModuleForTests({ connectLambda() {}, getStore() {
                    return { get: async () => stored, set: async () => {} };
                } });
                await proxy.handler(event({ diag: '1' }));
                stored = FRESH;
                const success = response(200, { code: '0', data: {
                    billCode: 'SYNTHETIC123', consigneePhone: '012345678', agentAmount: 2,
                    arrivalServiceCharge: 0.5 } });
                const pendingFresh = new Promise((resolve) => { finishLookup = () => resolve(success); });
                global.fetch = async (_url, init) => {
                    if (init.headers.Cookie === COOKIE) { oldCalls++; return response(401, {}); }
                    assert.equal(init.headers.Cookie, FRESH);
                    freshCalls++; freshLookupStarted();
                    return pendingFresh;
                };
                const recovering = proxy.handler(event({ barcode: 'SYNTHETIC123' }));
                await bounded(began);
                const normal = proxy.handler(event({ barcode: 'SYNTHETIC123' }));
                await new Promise((resolve) => setImmediate(resolve));
                finishLookup();
                const outcomes = await bounded(Promise.all([recovering, normal]));
                assert.ok(outcomes.every((outcome) => outcome.statusCode === 200));
                assert.equal(oldCalls, 1);
                assert.equal(freshCalls, 1, 'Cookie ថ្មី និង barcode ដូចគ្នា មិនត្រូវហៅ upstream ស្ទួន');
            } finally {
                if (finishLookup) finishLookup();
                global.fetch = nativeFetch;
                proxy.resetCachesForTests();
                proxy.setBlobsModuleForTests(null);
                for (const key of Object.keys(process.env)) if (key.startsWith('ZTO_')) delete process.env[key];
                for (const [key, value] of Object.entries(savedEnv)) if (key.startsWith('ZTO_')) process.env[key] = value;
            }
        });
    } finally {
        for (const controller of controllers) controller.abort();
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        global.fetch = nativeFetch;
    }
    console.log((fail ? '❌ ធ្លាក់ ' + fail : '✅ ជោគជ័យ') + ' · ជោគជ័យ ' + pass);
    process.exitCode = fail ? 1 : 0;
}
main().catch((error) => { console.log('  FAIL   ' + error.message); process.exitCode = 1; });
