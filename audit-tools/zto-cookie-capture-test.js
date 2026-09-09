'use strict';

// Cookie ដែលទើបសរសេរចូល Blobs មិនបញ្ជាក់ថា ZTO ទទួលយក session នោះទេ។
const assert = require('assert/strict');
const { EventEmitter } = require('events');
const path = require('path');
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

async function captured(options, expected) {
    const ctx = context();
    const task = waiting(ctx);
    try {
        emit(ctx, options);
        assert.equal(await task.promise, expected === undefined ? NEW : expected);
        assertClean(ctx);
    } finally { ctx.emit('close'); await task.promise.catch(() => {}); }
}

async function main() {
    // ⛔ Cookie ជារបស់ **domain** មិនមែន path ➜ ការទាមទារ `/scan/get/order/detail`
    // បង្ខំអ្នកប្រើឲ្យស្កេនកញ្ចប់មួយរាល់ដង ខណៈវាមិនបន្ថែមការការពារអ្វីទេ ៖
    // អ្វីដែលបញ្ជាក់ថា ZTO ទទួលយក session គឺ **ចម្លើយ** (2xx · JSON ·
    // envelope ជោគជ័យ) ដែលអះអាងក្នុងសេណារីយ៉ូខាងក្រោម។
    await scenario('API path ផ្សេងដែលឆ្លើយជោគជ័យ ➜ ចាប់បានភ្លាមក្រោយ Login',
        () => captured({ url: 'https://aargus-api.ztoglobal.com/user/info' }));
    await scenario('GET ជោគជ័យលើ path ផ្សេង ➜ ចាប់បានដដែល',
        () => captured({ url: 'https://aargus-api.ztoglobal.com/sys/menu/list', method: 'GET' }));
    // ⛔ ទិសផ្ទុយ ៖ ការបើក path មិនត្រូវធ្វើឲ្យច្រកទ្វារ *ចម្លើយ* ខ្សោយឡើយ។
    await scenario('path ផ្សេង តែ JSON ប្រាប់ថាមិនទាន់ Login ➜ មិនចាប់',
        () => rejectedThenAccepted({ url: 'https://aargus-api.ztoglobal.com/user/info', payload: { success: false, code: 'not_login' } }));
    await scenario('path ផ្សេង តែ HTTP 401 ➜ មិនចាប់',
        () => rejectedThenAccepted({ url: 'https://aargus-api.ztoglobal.com/user/info', status: 401 }));
    await scenario('host ផ្សេង ទោះឆ្លើយជោគជ័យ ➜ មិនចាប់',
        () => rejectedThenAccepted({ url: 'https://argus.ztoglobal.com/user/info' }));
    await scenario('OPTIONS/HEAD មិនអាចជំនួសការហៅដែលមាន session', async () => {
        await rejectedThenAccepted({ method: 'OPTIONS' });
        await rejectedThenAccepted({ method: 'HEAD' });
    });
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
    console.log('\n' + pass + ' PASS / ' + fail + ' FAIL / 0 SKIP');
    process.exitCode = fail ? 1 : 0;
}
main().catch((error) => { console.error('FAIL ' + error.name); process.exitCode = 1; });
