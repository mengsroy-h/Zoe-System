'use strict';

// Cookie ដែលទើបសរសេរចូល Blobs មិនបញ្ជាក់ថា ZTO ទទួលយក session នោះទេ។
const assert = require('assert/strict');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
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
// ⛔ callback របស់ `page.evaluate` រត់ **ក្នុង browser** ➜ ការ stub តម្លៃ
// ត្រឡប់ ធ្វើឲ្យតក្កវិជ្ជាជ្រើសតំណ **គ្មានតេស្តសោះ**។ ដូច្នេះយើងរត់ callback
// **ពិត** ក្នុង `vm` ជាមួយ DOM ក្លែង ➜ mutation លើការផ្គូផ្គង host ចាប់បាន។
function portal(options) {
    const cfg = options || {};
    const state = { opened: [], newPages: 0, settles: 0 };
    const page = {
        url: () => cfg.url || 'https://gate.ztoglobal.com/',
        waitForLoadState: async () => {
            state.settles++;
            if (cfg.settleThrows) throw new Error('synthetic settle timeout');
        }
    };
    const pages = (cfg.pages || ['https://gate.ztoglobal.com/']).map((url) => ({ url: () => url }));
    const ctx = {
        pages: () => pages,
        newPage: async () => {
            state.newPages++;
            if (cfg.newPageThrows) throw new Error('synthetic newPage failure');
            return { goto: async (url) => {
                state.opened.push(url);
                if (cfg.gotoThrows) throw new Error('synthetic goto timeout');
            } };
        }
    };
    return { page, ctx, state };
}
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
        { success: true, code: 0, statusCode: 401 },
        { success: true, code: 'OK', errorCode: 403 },
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
    // ⛔ **ចំណុចចាប់ផ្តើមរបស់ helper** ៖ `argus.ztoglobal.com` សុំ Login
    // **រាល់ដង** ចំណែក `gate.ztoglobal.com` រក្សា session ➜ ចុចកាតសាខា ➜
    // Argus បើកដោយមិនវាយ password (វាស់ដោយម្ចាស់គម្រោង)។ ⛔ ការសាកលើកមុន
    // (a59d139) ធ្លាក់ ព្រោះជុំនោះ `isTargetApiUrl` ទាមទារ path
    // `/scan/get/order/detail` ➜ ការចូល Argus តែម្យ៉ាងមិនគ្រប់គ្រាន់។ ជុំ
    // 6c82ea9 ដក path នោះចេញរួចហើយ ➜ ច្រកទ្វារឥឡូវជា **host** សុទ្ធសាធ។
    await scenario('helper បើក gate (session នៅ) មិនមែន argus (Login រាល់ដង)', async () => {
        const src = fs.readFileSync(path.join(ROOT, 'tools/zto-cookie-sync-windows/sync-zto-cookie.js'), 'utf8');
        const portal = /const PORTAL_URL = '([^']+)';/.exec(src);
        assert.ok(portal, 'រកការប្រកាស PORTAL_URL មិនឃើញ');
        assert.equal(new URL(portal[1]).hostname, 'gate.ztoglobal.com');
        assert.ok(/page\.goto\(PORTAL_URL/.test(src), 'browser ត្រូវបើក PORTAL_URL');
        assert.ok(!/page\.goto\(ARGUS_URL/.test(src), 'មិនត្រូវបើក argus ជាចំណុចចាប់ផ្តើម');
    });
    // ⛔ **ទិសផ្ទុយ** ៖ ការដក argus ចេញទាំងស្រុង ជាការថយក្រោយ — ថ្ងៃណាដែល
    // gate បើកមិនកើត អ្នកប្រើនៅតែត្រូវការ URL ផ្ទាល់នៅលើអេក្រង់។
    await scenario('⛔ argus នៅតែបោះពុម្ពជាផ្លូវបម្រុង (កុំកាត់ផ្លូវចេញ)', async () => {
        const src = fs.readFileSync(path.join(ROOT, 'tools/zto-cookie-sync-windows/sync-zto-cookie.js'), 'utf8');
        const argus = /const ARGUS_URL = '([^']+)';/.exec(src);
        assert.ok(argus, 'ថេរ ARGUS_URL ត្រូវនៅ');
        assert.equal(new URL(argus[1]).hostname, 'argus.ztoglobal.com');
        assert.ok(/console\.log\([^\n]*ARGUS_URL/.test(src), 'ARGUS_URL ត្រូវលេចលើអេក្រង់ cmd');
    });
    // ⛔ ចំណុចចាប់ផ្តើមប្តូរ **មិនត្រូវ** ទាញគោលដៅចាប់ទៅតាមវាទេ ៖ Cookie
    // ដែលត្រូវការជារបស់ `aargus-api` ដដែល។
    await scenario('⛔ ការចាប់នៅតែសំដៅ aargus-api (gate មិនប្តូរគោលដៅ)', async () => {
        assert.equal(api.isTargetApiUrl(TARGET), true);
        assert.equal(api.isTargetApiUrl('https://aargus-api.ztoglobal.com/any/other/path'), true);
        assert.equal(api.isTargetApiUrl('https://gate.ztoglobal.com/scan/get/order/detail'), false);
        assert.equal(api.isTargetApiUrl('https://argus.ztoglobal.com/scan/get/order/detail'), false);
    });
    // ⛔ ជុំ 2026-09-09 ដកចំណុចចាប់ផ្តើម gate ចេញវិញដោយ **មូលហេតុមិនទាន់
    // វាស់** ៖ helper ចេញត្រឹមពាក្យ «អស់ម៉ោង» ដោយមិនប្រាប់ថា browser ទៅដល់ណា។
    // អ្នករាប់នេះបំពេញចន្លោះនោះ — ហើយវាត្រូវឈរ **ក្រៅ** ផ្លូវចាប់ ៖ រាល់ការ
    // អានរុំក្នុង try ➜ getter ដែលបោះ មិនអាចកាត់ផ្តាច់ការចាប់បាន។
    await scenario('រង្វាស់ពេលអស់ម៉ោង ៖ រាប់តែ aargus-api និងបែងចែក 2xx/401', async () => {
        const ctx = context();
        const watcher = api.watchApiTraffic(ctx);
        assert.deepEqual(watcher.tally(), { seen: 0, ok: 0, denied: 0, other: 0 });
        assert.match(watcher.summary().join(' '), /never called the ZTO API/i);
        emit(ctx, { url: 'https://gate.ztoglobal.com/home' });
        emit(ctx, { url: 'https://argus.ztoglobal.com/' });
        assert.deepEqual(watcher.tally(), { seen: 0, ok: 0, denied: 0, other: 0 });
        emit(ctx, { status: 401 });
        assert.deepEqual(watcher.tally(), { seen: 1, ok: 0, denied: 1, other: 0 });
        assert.match(watcher.summary().join(' '), /refused every call/i);
        emit(ctx, { status: 503 });
        emit(ctx, {});
        assert.deepEqual(watcher.tally(), { seen: 3, ok: 1, denied: 1, other: 1 });
        assert.match(watcher.summary().join(' '), /no signed-in success/i);
        assert.ok(watcher.summary().every((line) => /^[\x20-\x7e]*$/.test(line)), 'សារ cmd ត្រូវជា ASCII');
        watcher.stop();
        assert.equal(ctx.listenerCount('response'), 0);
        emit(ctx, {});
        assert.equal(watcher.tally().seen, 3);
    });
    await scenario('⛔ អ្នករាប់ដែលបោះ មិនត្រូវសម្លាប់ការចាប់', async () => {
        const ctx = context();
        const task = waiting(ctx);
        const watcher = api.watchApiTraffic(ctx);
        try {
            ctx.emit('response', {
                url: () => 'https://aargus-api.ztoglobal.com/x',
                request: () => null,
                status: () => { throw new Error('synthetic status getter'); }
            });
            assert.deepEqual(watcher.tally(), { seen: 1, ok: 0, denied: 0, other: 0 });
            emit(ctx);
            assert.equal(await task.promise, NEW);
        } finally { watcher.stop(); ctx.emit('close'); await task.promise.catch(() => {}); }
    });
    // ⛔ **អត្តសញ្ញាណ host មិនមែន `endsWith` ធូរ** — `aargus-api.ztoglobal.com`
    // មិនមែន Argus ហើយ `argus.ztoglobal.com.evil.test` ក៏មិនមែនដែរ។
    await scenario('⛔ ច្រកទ្វារ host របស់ Argus ៖ ៤ ទិស', async () => {
        assert.equal(api.isArgusHost('argus.ztoglobal.com'), true);
        assert.equal(api.isArgusHost('bos.argus.ztoglobal.com'), true);
        assert.equal(api.isArgusHost('aargus-api.ztoglobal.com'), false);
        assert.equal(api.isArgusHost('argus.ztoglobal.com.evil.test'), false);
        assert.equal(api.isArgusHost('notargus.ztoglobal.com'), false);
        assert.equal(api.isArgusHost('ARGUS.ZTOGLOBAL.COM'), true);
        assert.equal(api.isArgusHost(''), false);
    });
    // ⛔ **សំណើអ្នកប្រើ (2026-09-11)** ៖ *«វាអត់ auto click ទៅ argus ផង»* ➜
    // ឧបករណ៍ចុចជំនួស ដោយដើរតាម **តំណដែលសំដៅ host របស់ Argus** មិនមែនតាម
    // *លំដាប់កាត* ឬ *ពាក្យក្នុងចំណងជើង* (ទំព័រ gate ប្តូរភាសាបាន)។
    // ⛔ **វាស់បាន (2026-09-11 · ការថតអេក្រង់)** ៖ កាតសាខាបើក **tab ថ្មី**
    // ត្រង់ `https://argus.ztoglobal.com/#/` **គ្មាន token** ➜ អ្វីដែលផ្តល់សិទ្ធិ
    // គឺការផ្ទុកទំព័រ gate មុន មិនមែនតួកាត ➜ helper បើក tab ថ្មីដោយផ្ទាល់។
    await scenario('ក្រោយ gate ស្ថិតស្ថេរ ➜ បើក tab ថ្មីទៅ Argus', async () => {
        const p = portal({});
        const out = await api.openArgusFromPortal(p.ctx, p.page, () => false, { settleMs: 5, openMs: 5 });
        assert.deepEqual(out, { opened: true, reason: 'tab' });
        assert.equal(p.state.newPages, 1);
        assert.equal(p.state.opened.length, 1);
        assert.equal(api.isArgusHost(new URL(p.state.opened[0]).hostname), true);
        assert.equal(p.state.settles, 1, 'ត្រូវរង់ចាំ SSO handshake មុនបើក');
    });
    // ⛔ **កុំបើកស្ទួន** ៖ អ្នកប្រើចុចមុន ➜ tab មួយឈរលើ Argus រួច ➜ មិនបើកទៀត។
    await scenario('⛔ Argus បើករួច ➜ មិនបើក tab ស្ទួន', async () => {
        const p = portal({ pages: ['https://gate.ztoglobal.com/', 'https://argus.ztoglobal.com/#/index'] });
        assert.deepEqual(await api.openArgusFromPortal(p.ctx, p.page, () => false, { settleMs: 5, openMs: 5 }),
            { opened: false, reason: 'already' });
        assert.equal(p.state.newPages, 0);
        const near = portal({ pages: ['https://aargus-api.ztoglobal.com/scan'] });
        assert.equal((await api.openArgusFromPortal(near.ctx, near.page, () => false, { settleMs: 5, openMs: 5 })).opened,
            true, 'aargus-api មិនមែន Argus');
    });
    // ⛔ **fail-open ទាំងស្រុង** ៖ newPage ធ្លាក់ · goto យឺត · settle ធ្លាក់ ·
    // ការចាប់ចប់មុន ➜ មិនបោះចេញ ហើយ tab ដែលបើករួចត្រូវទុកចោល។
    await scenario('⛔ newPage ធ្លាក់ · goto យឺត · settle ធ្លាក់ ➜ fail-open', async () => {
        const dead = portal({ newPageThrows: true });
        assert.deepEqual(await api.openArgusFromPortal(dead.ctx, dead.page, () => false, { settleMs: 5, openMs: 5 }),
            { opened: false, reason: 'failed' });
        const slow = portal({ gotoThrows: true });
        assert.deepEqual(await api.openArgusFromPortal(slow.ctx, slow.page, () => false, { settleMs: 5, openMs: 5 }),
            { opened: true, reason: 'tab-slow' });
        const stuck = portal({ settleThrows: true });
        assert.equal((await api.openArgusFromPortal(stuck.ctx, stuck.page, () => false, { settleMs: 5, openMs: 5 })).opened,
            true, 'settle ធ្លាក់ មិនត្រូវបញ្ឈប់ការបើក');
        const done = portal({});
        assert.deepEqual(await api.openArgusFromPortal(done.ctx, done.page, () => true, { settleMs: 5, openMs: 5 }),
            { opened: false, reason: 'done' });
        assert.equal(done.state.newPages, 0);
    });
    // ⛔ លេខលំនាំដើមត្រូវអានចេញពីកូដពិត មិនមែនចាក់ literal ក្នុង checker។
    await scenario('⛔ ពិដានបើកស្វ័យប្រវត្តិ ៖ លំនាំដើមពិត និងការហៅ fail-open', async () => {
        const src = fs.readFileSync(path.join(ROOT, 'tools/zto-cookie-sync-windows/sync-zto-cookie.js'), 'utf8');
        const timeout = /const PORTAL_OPEN_TIMEOUT_MS = ([^;]+);/.exec(src);
        const settle = /const PORTAL_SETTLE_MS = ([^;]+);/.exec(src);
        assert.ok(timeout && settle, 'រកថេរពិដានមិនឃើញ');
        const openMs = vm.runInNewContext(timeout[1]);
        const settleMs = vm.runInNewContext(settle[1]);
        assert.ok(openMs >= 20000, 'ពិដានបើក Argus ខ្លីពេក ៖ ' + openMs);
        assert.ok(settleMs >= 3000 && settleMs <= openMs, 'ការរង់ចាំ SSO handshake មិនសម');
        assert.ok(/tab\.goto\(ARGUS_URL/.test(src), 'tab ថ្មីត្រូវទៅ ARGUS_URL');
        const call = src.indexOf('await openArgusFromPortal(context, page');
        assert.ok(call > 0, 'captureCookieHeader ត្រូវហៅវា');
        const tryAt = src.lastIndexOf('try {', call);
        const catchAt = src.indexOf('} catch (_) {', call);
        assert.ok(tryAt > 0 && catchAt > call, 'ការហៅត្រូវឈរក្នុង try');
        assert.match(src.slice(catchAt, catchAt + 220), /Could not open Argus automatically/,
            'catch ត្រូវ fail-open ជាសារ មិនមែនបោះចេញ');
    });
    console.log('\n' + pass + ' PASS / ' + fail + ' FAIL / 0 SKIP');
    process.exitCode = fail ? 1 : 0;
}
main().catch((error) => { console.error('FAIL ' + error.name); process.exitCode = 1; });
