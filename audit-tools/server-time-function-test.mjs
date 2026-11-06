import { test as nodeTest, after } from 'node:test';
let registered = 0, completed = 0, failedTests = 0;
function test(name, run) {
    registered++;
    return nodeTest(name, async () => {
        try { await run(); } catch (error) { failedTests++; throw error; }
        finally { completed++; }
    });
}
after(() => { process.exitCode = registered > 0 && completed === registered && failedTests === 0 ? 0 : 1; });
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const ROOT = path.resolve(process.env.LICENSETIME_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const endpoint = 'https://zoew.netlify.app/.netlify/functions/server-time';
const nonce = '0123456789abcdef0123456789abcdef';
// Import failure is a hard failure, never a skip or false green.
const { default: handler } = await import(pathToFileURL(path.join(ROOT, 'ZoeW/netlify/functions/server-time.mjs')));
for (const origin of [undefined, 'https://zoew.netlify.app', 'https://zoekeygen.netlify.app', 'https://localhost']) {
    test('server-time GET and CORS for ' + origin, async () => {
        const start = Date.now();
        const result = await handler(new Request(endpoint + '?nonce=' + nonce, { headers: origin ? { Origin: origin } : {} }));
        assert.equal(result.status, 200); assert.match(result.headers.get('Content-Type'), /application\/json/);
        assert.match(result.headers.get('Cache-Control'), /no-store/);
        assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin || null);
        assert.equal(result.headers.get('Vary'), 'Origin');
        assert.equal(result.headers.get('Access-Control-Allow-Credentials'), null);
        const body = await result.json(); assert.deepEqual(Object.keys(body).sort(), ['nonce', 'now']);
        assert.equal(body.nonce, nonce); assert.ok(Number.isSafeInteger(body.now));
        assert.ok(body.now >= start && body.now <= Date.now());
    });
}
for (const query of ['', '?nonce=x', '?nonce=' + nonce.toUpperCase(), '?nonce=' + nonce + '0', '?nonce=%0A' + nonce, '?nonce=' + nonce + '%0A', '?nonce=' + nonce + '%0D', '?nonce=' + nonce + '&nonce=' + nonce]) {
    test('invalid nonce rejected: ' + query, async () => assert.equal((await handler(new Request(endpoint + query))).status, 400));
}
for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    test(method + ' cannot write data', async () => assert.equal((await handler(new Request(endpoint + '?nonce=' + nonce, { method }))).status, 405));
}

for (const origin of ['null', '', 'http://localhost', 'capacitor://localhost', 'https://evil.example', 'https://zoe-keygen.netlify.app', 'https://zoekeygen.netlify.app.evil.example', 'https://zoekeygen.netlify.app:8443', 'https://deploy-preview-1--zoekeygen.netlify.app']) {
    test('unapproved origin rejected: ' + JSON.stringify(origin), async () => {
        const result = await handler(new Request(endpoint + '?nonce=' + nonce, { headers: { Origin: origin } }));
        assert.equal(result.status, 403);
        assert.equal(result.headers.get('Access-Control-Allow-Origin'), null);
        assert.equal(result.headers.get('Access-Control-Allow-Credentials'), null);
        assert.equal(result.headers.get('Vary'), 'Origin');
        assert.deepEqual(await result.json(), {});
    });
}
for (const origin of ['https://zoew.netlify.app', 'https://zoekeygen.netlify.app', 'https://localhost']) {
    for (const method of ['GET', 'POST', 'OPTIONS']) {
        test('error response preserves exact CORS: ' + origin + ' ' + method, async () => {
            const result = await handler(new Request(endpoint + '?nonce=bad', { method, headers: { Origin: origin } }));
            assert.equal(result.status, method === 'GET' ? 400 : 405);
            assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin);
            assert.equal(result.headers.get('Access-Control-Allow-Credentials'), null);
            assert.equal(result.headers.get('Vary'), 'Origin');
            assert.match(result.headers.get('Cache-Control'), /no-store/);
        });
    }
}
