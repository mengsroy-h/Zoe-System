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

for (const origin of [
    'https://deploy-preview-1--zoew.netlify.app', 'https://deploy-preview-400--zoew.netlify.app',
    'https://deploy-preview-1--zoekeygen.netlify.app', 'https://deploy-preview-400--zoekeygen.netlify.app'
]) {
    for (const explicitOrigin of [false, true]) test('preview អានម៉ោងពីខ្លួនដោយ Origin ' + explicitOrigin + ': ' + origin, async () => {
        const start = Date.now();
        const result = await handler(new Request(origin + '/.netlify/functions/server-time?nonce=' + nonce, {
            headers: explicitOrigin ? { Origin: origin } : {}
        }));
        assert.equal(result.status, 200);
        assert.equal(result.headers.get('Access-Control-Allow-Origin'), explicitOrigin ? origin : null);
        assert.equal(result.headers.get('Access-Control-Allow-Credentials'), null);
        for (const header of ['Cache-Control', 'CDN-Cache-Control', 'Netlify-CDN-Cache-Control']) assert.equal(result.headers.get(header), 'no-store');
        assert.equal(result.headers.get('Vary'), 'Origin');
        const body = await result.json();
        assert.deepEqual(Object.keys(body).sort(), ['nonce', 'now']); assert.equal(body.nonce, nonce);
        assert.ok(Number.isSafeInteger(body.now) && body.now >= start && body.now <= Date.now());
    });
    for (const [method, query, status] of [['GET', '?nonce=bad', 400], ['GET', '?nonce=' + nonce + '&nonce=' + nonce, 400], ['POST', '?nonce=' + nonce, 405]]) {
        test('preview កំហុសនៅរក្សា CORS ត្រឹមត្រូវ: ' + origin + ' ' + method + ' ' + query, async () => {
            const result = await handler(new Request(origin + '/.netlify/functions/server-time' + query, { method, headers: { Origin: origin } }));
            assert.equal(result.status, status); assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin);
            assert.equal(result.headers.get('Access-Control-Allow-Credentials'), null); assert.equal(result.headers.get('Cache-Control'), 'no-store');
            assert.deepEqual(await result.json(), {});
        });
    }
}
for (const [origin, destination] of [
    ['https://deploy-preview-400--zoew.netlify.app', 'https://zoew.netlify.app'],
    ['https://deploy-preview-400--zoekeygen.netlify.app', 'https://zoew.netlify.app'],
    ['https://deploy-preview-1--zoew.netlify.app', 'https://deploy-preview-400--zoew.netlify.app'],
    ['https://deploy-preview-400--zoew.netlify.app', 'https://deploy-preview-400--zoekeygen.netlify.app'],
    ...['https://deploy-preview-0--zoew.netlify.app', 'https://deploy-preview-0400--zoew.netlify.app',
        'http://deploy-preview-400--zoew.netlify.app', 'https://deploy-preview-400--zoew.netlify.app:8443',
        'https://deploy-preview-400--other.netlify.app', 'https://deploy-preview-400--zoew.netlify.app.evil.example',
        'https://branch--zoew.netlify.app', 'https://0123456789abcdef01234567--zoew.netlify.app']
        .map(origin => [origin, origin]),
    ['null', 'https://deploy-preview-400--zoew.netlify.app'], ['', 'https://deploy-preview-400--zoew.netlify.app']
]) test('preview មិនអនុញ្ញាត Origin ខុសឬក្រៅវិសាលភាព: ' + origin + ' → ' + destination, async () => {
    const result = await handler(new Request(destination + '/.netlify/functions/server-time?nonce=' + nonce, { headers: { Origin: origin } }));
    assert.equal(result.status, 403); assert.equal(result.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(result.headers.get('Access-Control-Allow-Credentials'), null); assert.equal(result.headers.get('Vary'), 'Origin');
    assert.deepEqual(await result.json(), {});
});
