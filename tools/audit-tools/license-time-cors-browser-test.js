'use strict';
// REAL Chromium Fetch CORS filtering, local HTTP servers on separate origins.
// Transport mapping changes only destination; never mocks Response/headers/body.
// No live service, customer database or browser credentials are touched.
// Fixture HTTP ក្នុងស្រុកវាស់ CORS ពិត។ Route HTTPS preview វាស់ handler ពិត
// និងការមិនផ្ញើ credentials; route.fulfill មិនវាស់ការត្រង CORS របស់ browser ទេ។
// server-time-function-test.mjs វាស់ការបដិសេធ Origin ដែលផ្ញើជាក់លាក់។
const { chromium } = require('playwright-core');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const ROOT = path.resolve(process.env.LICENSETIME_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '../..'));
const ENDPOINT = 'https://zoew.netlify.app/.netlify/functions/server-time';
const files = ['ZoeW/public/license-verify.js', 'ZoeKeyGen/license-verify.js'];
const servers = [];
async function serve(handler) {
    const server = http.createServer(handler); servers.push(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return 'http://127.0.0.1:' + server.address().port;
}
let browser, failed = 0, passed = 0, unavailable = false;
async function check(label, run) {
    try { await run(); console.log('PASS ' + label); passed++; }
    catch (error) { console.error('FAIL ' + label + ': ' + error.message); failed++; }
}
(async () => {
    for (const file of files) assert.ok(fs.readFileSync(path.join(ROOT, file), 'utf8').length > 0);
    const allowedOrigins = new Set();
    const clockOrigin = await serve((req, res) => {
        if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Same-origin app</title>'); return; }
        const u = new URL(req.url, 'http://fixture');
        res.setHeader('Vary', 'Origin');
        if (req.headers.origin && !allowedOrigins.has(req.headers.origin)) { res.writeHead(403); res.end('{}'); return; }
        if (req.headers.origin && u.pathname !== '/no-cors') res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Date', 'Fri, 06 Nov 2026 10:00:42 GMT');
        res.setHeader('Content-Type', 'application/json');
        // Deliberately NO Access-Control-Expose-Headers: Date.
        if (u.pathname === '/redirect') { res.writeHead(302, { Location: '/json' }); res.end(); return; }
        if (u.pathname === '/firebase') { res.end('null'); return; }
        if (u.pathname === '/bad') { res.end('{'); return; }
        res.end(JSON.stringify({ now: Date.now() + 42000, nonce: u.pathname === '/wrong' ? 'a'.repeat(32) : u.searchParams.get('nonce') }));
    });
    const appOrigin = await serve((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>CORS regression app</title>'); });
    const keygenOrigin = await serve((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>CORS regression KeyGen</title>'); });
    const nativeOrigin = await serve((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Localhost WebView analogue</title>'); });
    const hostileOrigin = await serve((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Unapproved origin</title>'); });
    [clockOrigin, appOrigin, keygenOrigin, nativeOrigin].forEach(origin => allowedOrigins.add(origin));
    try { browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath()), args: ['--no-sandbox'] }); } catch (error) {
        unavailable = true;
        console.log('SKIP browser CORS: Chromium could not launch: ' + error.message.split('\n')[0]);
        return;
    }
    // Android uses https://localhost, not about:blank. A separate loopback HTTP
    // origin is only a browser CORS analogue, not an Android/device/TLS test.
    for (const [originName, origin] of [['same-origin app', clockOrigin], ['app cross-origin', appOrigin], ['KeyGen separate origin', keygenOrigin], ['localhost WebView analogue', nativeOrigin], ['unapproved origin', hostileOrigin]]) {
        const approved = allowedOrigins.has(origin);
        const sameOrigin = origin === clockOrigin;
        const context = await browser.newContext(); const page = await context.newPage(); await page.goto(origin);
        page.on('console', message => { if (message.type() === 'error') console.error('BROWSER ' + originName + ': ' + message.text()); });
        page.on('requestfailed', request => console.error('REQUEST FAILED ' + originName + ': ' + request.failure()?.errorText));
        await check(originName + ': browser response visibility', async () => {
            if (!approved) {
                const blocked = await page.evaluate(base => fetch(base + '/json?nonce=' + 'b'.repeat(32)).then(() => false, () => true), clockOrigin);
                assert.equal(blocked, true);
                return;
            }
            const result = await page.evaluate(async base => {
                const old = await fetch(base + '/firebase'); const next = await fetch(base + '/json?nonce=' + 'b'.repeat(32));
                return { oldStatus: old.status, oldDate: old.headers.get('Date'), newDate: next.headers.get('Date'), body: await next.json() };
            }, clockOrigin);
            assert.equal(result.oldStatus, 200); assert.equal(result.oldDate, sameOrigin ? 'Fri, 06 Nov 2026 10:00:42 GMT' : null); assert.equal(result.newDate, sameOrigin ? 'Fri, 06 Nov 2026 10:00:42 GMT' : null);
            assert.equal(result.body.nonce, 'b'.repeat(32)); assert.ok(Number.isSafeInteger(result.body.now));
        });
        for (const file of files) {
            for (const scenario of ['json', 'wrong', 'bad', 'redirect', ...(!sameOrigin ? ['no-cors'] : [])]) await check(originName + ' / ' + file + ' / ' + scenario, async () => {
                // Reload source in a fresh global so failed refresh cannot inherit trust.
                await page.evaluate(() => { if (window.__nativeFetch) window.fetch = window.__nativeFetch; });
                await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, file), 'utf8') });
                await page.evaluate(({ base, scenario, endpoint }) => {
                    window.__nativeFetch = window.__nativeFetch || window.fetch.bind(window);
                    window.__requests = [];
                    window.fetch = (url, init) => {
                        const u = new URL(url); window.__requests.push({ url: String(url), credentials: init.credentials, redirect: init.redirect });
                        // The old production Firebase request gets its real failure shape, not JSON disguised as Date.
                        const route = u.origin + u.pathname === endpoint ? '/' + scenario : '/firebase';
                        return window.__nativeFetch(base + route + u.search, init);
                    };
                }, { base: clockOrigin, scenario, endpoint: ENDPOINT });
                const result = await page.evaluate(async () => ({ success: await window.ZoeLicense.syncServerTime(), offset: window.ZoeLicense.getServerTimeOffset(), requests: window.__requests }));
                assert.equal(result.success, approved && scenario === 'json');
                if (approved && scenario === 'json') {
                    assert.ok(result.offset > 39000 && result.offset <= 43000);
                    assert.equal(new URL(result.requests[0].url).origin + new URL(result.requests[0].url).pathname, ENDPOINT);
                    assert.equal(result.requests[0].credentials, 'omit'); assert.equal(result.requests[0].redirect, 'error');
                } else assert.equal(result.offset, null);
            });
        }
        await context.close();
    }
    const { default: handler } = await import(pathToFileURL(path.join(ROOT, 'ZoeW/netlify/functions/server-time.mjs')));
    for (const origin of ['https://deploy-preview-400--zoew.netlify.app', 'https://deploy-preview-400--zoekeygen.netlify.app']) {
        for (const file of files) await check('preview អានម៉ោងពិតតាម browser ដោយគ្មាន credentials: ' + origin + ' / ' + file, async () => {
            const context = await browser.newContext();
            const calls = [], unexpected = [];
            try {
                await context.addCookies([{ name: 'fixture_session', value: 'synthetic-cookie', url: origin }]);
                await context.route('**/*', async route => {
                    const request = route.request(), url = new URL(request.url());
                    if (url.origin === origin && url.pathname === '/') {
                        await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Preview clock fixture</title>' });
                    } else if (url.origin === origin && url.pathname === '/favicon.ico') {
                        await route.fulfill({ status: 204 });
                    } else if (url.origin === origin && url.pathname === '/.netlify/functions/server-time') {
                        const headers = await request.allHeaders();
                        const response = await handler(new Request(request.url(), { method: request.method(), headers }));
                        calls.push({ url: request.url(), headers, status: response.status });
                        await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
                    } else {
                        unexpected.push(request.url()); await route.abort('blockedbyclient');
                    }
                });
                const page = await context.newPage();
                await page.goto(origin);
                await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, file), 'utf8') });
                const result = await page.evaluate(async () => ({
                    before: window.ZoeLicense.getTrustedServerNow(),
                    success: await window.ZoeLicense.syncServerTime(),
                    after: window.ZoeLicense.getTrustedServerNow()
                }));
                assert.equal(result.before, null); assert.equal(result.success, true, JSON.stringify({ result, calls: calls.map(({ url, status }) => ({ url, status })), unexpected }));
                assert.ok(Number.isFinite(result.after) && Math.abs(result.after - Date.now()) < 3000);
                assert.equal(calls.length, 1); assert.equal(calls[0].status, 200);
                assert.equal(new URL(calls[0].url).origin, origin);
                assert.equal(calls[0].headers.origin, undefined);
                assert.equal(calls[0].headers.cookie, undefined); assert.equal(calls[0].headers.authorization, undefined);
                assert.deepEqual(unexpected, []);
            } finally { await context.close(); }
        });
    }
})().catch(error => { failed++; console.error(error); }).finally(async () => {
    if (browser) await browser.close();
    for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (unavailable) {
        console.log('SKIP browser CORS: zero browser assertions ran; not a pass');
        process.exitCode = process.env.RUNALL_STRICT === '1' || process.env.LICENSETIME_BROWSER_STRICT === '1' ? 1 : 0;
    } else { console.log(`RESULT ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0; }
});
