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
for (const origin of [undefined, 'https://zoew.netlify.app', 'https://zoe-keygen.netlify.app', 'https://localhost', 'http://localhost', 'capacitor://localhost', 'null']) {
    test('server-time GET and CORS for ' + origin, async () => {
        const start = Date.now();
        const result = await handler(new Request(endpoint + '?nonce=' + nonce, { headers: origin ? { Origin: origin } : {} }));
        assert.equal(result.status, 200); assert.match(result.headers.get('Content-Type'), /application\/json/);
        assert.match(result.headers.get('Cache-Control'), /no-store/);
        if (origin) assert.ok(['*', origin].includes(result.headers.get('Access-Control-Allow-Origin')));
        assert.notEqual(result.headers.get('Access-Control-Allow-Credentials'), 'true');
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
