'use strict';

// Cookie ដែលទើបសរសេរចូល Blobs មិនបញ្ជាក់ថា ZTO ទទួលយក session នោះទេ។
const assert = require('assert/strict');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');
const ROOT = process.env.ZTO_CAPTURE_APP_DIR
    ? path.resolve(process.env.ZTO_CAPTURE_APP_DIR) : path.resolve(__dirname, '..');
let api;
try { api = require(path.join(ROOT, 'tools/zto-cookie-sync-windows/sync-zto-cookie.js')); }
catch (_) { api = null; }
const TARGET = 'https://aargus-api.ztoglobal.com/scan/get/order/detail';
const OLD = 'BOS-MAN-SESSION=synthetic-old-session';
const NEW = 'BOS-MAN-SESSION=synthetic-renewed-session';
const GOOD = { success: true, data: { billCode: 'synthetic-parcel' } };
let pass = 0;
let fail = 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function deferred() {
    let resolve;
    return { promise: new Promise((done) => { resolve = done; }), resolve: (value) => resolve(value) };
}
async function scenario(name, run) {
    try { assert.ok(api, 'source unavailable'); await run(); pass++; console.log('   ok    ' + name); }
    catch (error) { fail++; console.log('  FAIL   ' + name + ': ' + error.name); }
}
function context() {
    const ctx = new EventEmitter();
    ctx.setCookieLines = [NEW + '; HttpOnly; Secure; Path=/'];
    ctx.cookieReads = [];
    return ctx;
}
function emit(ctx, options) {
    const config = options || {};
    const url = config.url || TARGET;
    const request = {
        url: () => url,
        method: () => config.method || 'POST',
        allHeaders: async () => ({ cookie: config.cookie || OLD })
    };
    const response = {
        url: () => url,
        request: () => request,
        status: () => config.status === undefined ? 200 : config.status,
        allHeaders: async () => ({ 'content-type': config.contentType || 'application/json' }),
        headerValues: async (name) => {
            assert.equal(name, 'set-cookie');
            if (ctx.headerError) throw new Error('synthetic response header failure');
            ctx.cookieReads.push(url);
            return ctx.setCookieLines;
        },
        body: () => config.body || Promise.resolve(Buffer.from(JSON.stringify(config.payload === undefined ? GOOD : config.payload)))
    };
    ctx.emit('request', request);
    ctx.emit('response', response);
    return response;
}
function waiting(ctx, timeoutMs = 250, responseTimeoutMs = 40) {
    let settled = false;
    const promise = api.waitForOrderCookie(ctx, timeoutMs, { responseTimeoutMs });
    promise.then(() => { settled = true; }, () => { settled = true; });
    return { promise, settled: () => settled };
}
function assertClean(ctx) {
    assert.equal(ctx.listenerCount('request'), 0);
    assert.equal(ctx.listenerCount('response'), 0);
    assert.equal(ctx.listenerCount('close'), 0);
}
async function rejectedThenAccepted(options) {
    const ctx = context();
    const task = waiting(ctx);
    try {
        emit(ctx, options);
        await delay(15);
        assert.equal(task.settled(), false);
        assert.equal(ctx.cookieReads.length, 0);
        emit(ctx);
        assert.equal(await task.promise, NEW);
        assertClean(ctx);
    } finally { ctx.emit('close'); await task.promise.catch(() => {}); }
}
function diag(info) {
    return api.verifyCookieLive(OLD, {
        siteUrl: 'https://synthetic.test', proxyKey: 'synthetic-proxy-key', maxAttempts: 1,
        fetchImpl: async () => ({ ok: true, status: 200,
            text: async () => JSON.stringify({ auth: 'cookie', cookie: Object.assign({
                source: 'blob', fingerprint: api.cookieFingerprint(OLD)
            }, info) }) })
    });
}

async function main() {
    await scenario('API path ផ្សេង ➜ រង់ចាំ Order Detail ពិត', () => rejectedThenAccepted({ url: 'https://aargus-api.ztoglobal.com/user/info' }));
    await scenario('GET/OPTIONS មិនអាចជំនួស POST ដែលបានផ្ទៀងផ្ទាត់', () => rejectedThenAccepted({ method: 'OPTIONS' }));
    for (const status of [401, 403, 302, 500]) {
        await scenario('HTTP ' + status + ' ➜ មិនចាប់ session មុន Login ថ្មី', () => rejectedThenAccepted({ status }));
    }
    for (const payload of [
        { success: false, code: 'not_login' },
        { success: true, code: 401 },
        { success: true, message: 'https://synthetic-iam.example/login?ticket=synthetic' },
        { success: true, message: 'session expired' },
        { success: false, code: 500 },
        {}
    ]) {
        await scenario('JSON មិនបញ្ជាក់ auth ជោគជ័យ #' + String(pass + fail + 1), () => rejectedThenAccepted({ payload }));
    }
    await scenario('HTML login page ➜ មិនរាយ capture ជោគជ័យ', () => rejectedThenAccepted({ contentType: 'text/html', body: Promise.resolve(Buffer.from('<html>Login</html>')) }));
    await scenario('JSON ខូច ➜ browser បន្តរង់ចាំ', () => rejectedThenAccepted({ body: Promise.resolve(Buffer.from('{')) }));
    await scenario('body លើស 1 MB ➜ មិនយក session', () => rejectedThenAccepted({ body: Promise.resolve(Buffer.alloc(1024 * 1024 + 1, 32)) }));
    await scenario('រង់ចាំ response ចប់ និងចាប់ Cookie ក្រោយ renewal', async () => {
        const ctx = context();
        const body = deferred();
        const task = waiting(ctx);
        try {
            emit(ctx, { body: body.promise });
            await delay(10);
            assert.equal(task.settled(), false);
            assert.equal(ctx.cookieReads.length, 0);
            body.resolve(Buffer.from(JSON.stringify(GOOD)));
            assert.equal(await task.promise, NEW);
            assert.deepEqual(ctx.cookieReads, [TARGET]);
            assertClean(ctx);
        } finally { ctx.emit('close'); await task.promise.catch(() => {}); }
    });
    await scenario('Set-Cookie អានមិនបាន ➜ មិនត្រឡប់ទៅ Cookie ចាស់', async () => {
        const ctx = context();
        ctx.headerError = true;
        const task = waiting(ctx);
        try {
            emit(ctx);
            await delay(15);
            assert.equal(task.settled(), false);
            ctx.headerError = false;
            emit(ctx);
            assert.equal(await task.promise, NEW);
        } finally { ctx.emit('close'); await task.promise.catch(() => {}); }
    });
    await scenario('response លុប session ➜ មិនស្ដារ Cookie ចាស់ឡើងវិញ', async () => {
        const ctx = context();
        ctx.setCookieLines = ['BOS-MAN-SESSION=; Max-Age=0; Path=/'];
        const task = waiting(ctx);
        try {
            emit(ctx);
            await delay(15);
            assert.equal(task.settled(), false);
            ctx.setCookieLines = [NEW + '; Path=/'];
            emit(ctx);
            assert.equal(await task.promise, NEW);
        } finally { ctx.emit('close'); await task.promise.catch(() => {}); }
    });
    for (const [label, lines, expected] of [
        ['គ្មាន renewal', [], OLD],
        ['domain ឪពុក + HttpOnly', [NEW + '; Domain=.ztoglobal.com; HttpOnly; Secure'], NEW],
        ['domain ផ្សេង', [NEW + '; Domain=evil.test'], OLD],
        ['path ផ្សេង', [NEW + '; Path=/unrelated'], OLD],
        ['path prefix មិនគ្រប់', [NEW + '; Path=/scan/get/order/det'], OLD],
        ['Expires ដែលមាន comma', [NEW + '; Expires=Wed, 01 Jan 2099 00:00:00 GMT'], NEW],
        ['Max-Age ឈ្នះ Expires ចាស់', [NEW + '; Max-Age=300; Expires=Wed, 01 Jan 1997 00:00:00 GMT'], NEW],
        ['គូ analytics ខូច តែ session ត្រឹមត្រូវ', [NEW + '; Path=/', '_ga_ref=Mozilla 5.0; Path=/'], NEW]
    ]) {
        await scenario('Set-Cookie ' + label + ' ➜ header ត្រឹមត្រូវ', async () => {
            const ctx = context();
            ctx.setCookieLines = lines;
            const task = waiting(ctx);
            try { emit(ctx); assert.equal(await task.promise, expected); assertClean(ctx); }
            finally { ctx.emit('close'); await task.promise.catch(() => {}); }
        });
    }
    for (const payload of [{ code: '0', data: {} }, { code: 200, data: null }, { status: true }, { result: true }]) {
        await scenario('ទម្រង់ success ផ្សេងរបស់ ZTO ➜ capture ដដែល', async () => {
            const ctx = context();
            const task = waiting(ctx);
            try { emit(ctx, { payload }); assert.equal(await task.promise, NEW); assertClean(ctx); }
            finally { ctx.emit('close'); await task.promise.catch(() => {}); }
        });
    }
    for (const lines of [[NEW + '; Expires=Wed, 01 Jan 1997 00:00:00 GMT'], ['BOS-MAN-SESSION=invalid session; Path=/'], [NEW + '\r\nInjected=synthetic']]) {
        await scenario('renewal ខូច ឬ expired ➜ មិនចាប់ Cookie ចាស់ឡើងវិញ', async () => {
            const ctx = context();
            ctx.setCookieLines = lines;
            const task = waiting(ctx);
            try {
                emit(ctx);
                await delay(15);
                assert.equal(task.settled(), false);
                ctx.setCookieLines = [NEW + '; Path=/'];
                emit(ctx);
                assert.equal(await task.promise, NEW);
                assertClean(ctx);
            } finally { ctx.emit('close'); await task.promise.catch(() => {}); }
        });
    }
    await scenario('body ព្យួរមិនបិទផ្លូវ response ល្អបន្ទាប់', async () => {
        const ctx = context();
        const late = deferred();
        const task = waiting(ctx, 250, 20);
        try {
            emit(ctx, { body: late.promise });
            await delay(30);
            assert.equal(task.settled(), false);
            emit(ctx);
            assert.equal(await task.promise, NEW);
            late.resolve(Buffer.from(JSON.stringify(GOOD)));
            await delay(10);
            assert.equal(ctx.cookieReads.length, 1);
            assertClean(ctx);
        } finally { ctx.emit('close'); await task.promise.catch(() => {}); }
    });
    await scenario('capture timeout ពិត ➜ listener ទាំងអស់ចេញ', async () => {
        const ctx = context();
        const task = waiting(ctx, 35);
        await assert.rejects(task.promise, (error) => error.code === 'CAPTURE_TIMEOUT');
        assertClean(ctx);
    });
    await scenario('បិទ browser ពេល body ព្យួរ ➜ settle និងមិនអាន jar យឺត', async () => {
        const ctx = context();
        const body = deferred();
        const task = waiting(ctx);
        emit(ctx, { body: body.promise });
        ctx.emit('close');
        await assert.rejects(task.promise, (error) => error.code === 'BROWSER_CLOSED');
        body.resolve(Buffer.from(JSON.stringify(GOOD)));
        await delay(10);
        assert.equal(ctx.cookieReads.length, 0);
        assertClean(ctx);
    });
    await scenario('fingerprint ត្រូវគ្នា តែ rejected ➜ មិនរាយ live', async () => {
        const value = await diag({ authRejectedAgeMs: 1000, authAcceptedAgeMs: 2000 });
        assert.equal(value.status, 'rejected');
        assert.equal(value.validity, 'rejected');
    });
    await scenario('fingerprint ត្រូវគ្នា គ្មានសាលក្រម ➜ match តែ unknown', async () => {
        const value = await diag({});
        assert.equal(value.status, 'match');
        assert.equal(value.validity, 'unknown');
    });
    await scenario('fingerprint ត្រូវគ្នា មាន accepted ➜ validity accepted', async () => {
        const value = await diag({ authRejectedAgeMs: null, authAcceptedAgeMs: 1000 });
        assert.equal(value.status, 'match');
        assert.equal(value.validity, 'accepted');
    });
    await scenario('unknown health ➜ មិនបើក browser ស្វ័យប្រវត្តិ និងសារមិនរាយ OK', async () => {
        const health = await api.checkCookieHealth({
            siteUrl: 'https://synthetic.test', proxyKey: 'synthetic-proxy-key',
            fetchImpl: async () => ({ ok: true, status: 200,
                text: async () => JSON.stringify({ auth: 'cookie', cookie: { source: 'blob', fingerprint: 'synthetic' } }) })
        });
        assert.equal(health.healthy, null);
        assert.equal(api.shouldRefreshInAuto(health), false);
        assert.match(api.describeHealth(health), /not yet verified/i);
    });
    // ⛔ **ចំណុចចាប់ផ្តើមរបស់ helper** ៖ `argus.ztoglobal.com` ទាមទារ login
    // **រាល់ដង** ចំណែក `gate.ztoglobal.com` រក្សា session (វាស់ដោយម្ចាស់
    // គម្រោង 2026-09-09 ៖ gate homepage មានកាត «ប្រព័ន្ធប្រតិបត្តិការប្រើ
    // សម្រាប់សាខា» ➜ ចុច ➜ ចូល Argus ភ្លាមដោយមិនវាយ password)។
    // ⛔ ការចាប់ Cookie នៅតែកើតលើ `aargus-api` ដដែល — មានតែ **ទំព័រដែល
    // helper បើក** ដែលប្តូរ។
    await scenario('helper ចាប់ផ្តើមពី gate (session នៅ) មិនមែន argus (login រាល់ដង)', async () => {
        const src = fs.readFileSync(path.join(ROOT, 'tools/zto-cookie-sync-windows/sync-zto-cookie.js'), 'utf8');
        const m = /const PORTAL_URL = '([^']+)';/.exec(src);
        assert.ok(m, 'រកការប្រកាស PORTAL_URL មិនឃើញ');
        assert.equal(m[1], 'https://gate.ztoglobal.com/');
        assert.ok(/page\.goto\(PORTAL_URL/.test(src), 'browser ត្រូវបើក PORTAL_URL');
        assert.ok(!/ARGUS_URL/.test(src), 'ថេរចាស់មិនត្រូវនៅសល់');
    });
    await scenario('⛔ ការចាប់នៅតែចង់ទៅ aargus-api ដដែល (gate មិនប្តូរគោលដៅ)', async () => {
        assert.equal(api.isTargetApiUrl(TARGET), true);
        assert.equal(api.isTargetApiUrl('https://gate.ztoglobal.com/scan/get/order/detail'), false);
        assert.equal(api.isTargetApiUrl('https://argus.ztoglobal.com/scan/get/order/detail'), false);
    });
    await scenario('⛔ ការណែនាំលើអេក្រង់ cmd ជា ASCII ហើយប្រាប់ជំហាន gate', async () => {
        const src = fs.readFileSync(path.join(ROOT, 'tools/zto-cookie-sync-windows/sync-zto-cookie.js'), 'utf8');
        const lines = src.split('\n').filter((l) => /console\.log\('/.test(l));
        assert.ok(lines.length > 10, 'ជាន់អប្បបរមា ៖ សារ console មិនទទេ');
        const nonAscii = lines.filter((l) => /[^\x00-\x7F]/.test(l));
        assert.deepEqual(nonAscii, [], 'សារ cmd ត្រូវជា ASCII');
        assert.ok(/Branch Operations/.test(src), 'ត្រូវប្រាប់ថាចុចកាតណា');
        assert.ok(/gate usually keeps your session/.test(src), 'ត្រូវប្រាប់ថា gate រក្សា session');
    });
    console.log('\n' + pass + ' PASS / ' + fail + ' FAIL / 0 SKIP');
    process.exitCode = fail ? 1 : 0;
}
main().catch((error) => { console.error('FAIL ' + error.name); process.exitCode = 1; });
