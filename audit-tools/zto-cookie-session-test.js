'use strict';

// វាស់ handler ពិតជាមួយ Cookie ក្លែង និង Blobs ដែលអនុវត្ត ETag ពិតក្នុង fixture។
// នាឡិកាបញ្ជាអាយុ cache; promise បញ្ជាលំដាប់បណ្តាញ មិនចម្លងកូដ App។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const crypto = require('crypto');
const ROOT = path.resolve(process.env.ZTO_SESSION_APP_DIR || path.join(__dirname, '..'));
const FILE = path.join(ROOT, 'ZoeW/netlify/functions/zto-order-detail.js');
const KEY = 'synthetic-proxy-key-12345678901234567890';
const cookie = (value) => 'BOS-MAN-SESSION=synthetic-session-' + value;
const fingerprint = (value) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 8);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const defer = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
let passed = 0;
let failed = 0;
let source = '';
try { source = fs.readFileSync(FILE, 'utf8'); } catch (_) {}

function response(status, renewed) {
    return { status, ok: status === 200, headers: {
        get: () => 'application/json', getSetCookie: () => renewed ? [renewed + '; Path=/; HttpOnly'] : []
    }, json: async () => status === 200 ? { code: '0', data: {
        billCode: 'SYNTHETIC123', consigneePhone: '012345678', agentAmount: 1, arrivalServiceCharge: 0
    } } : {} };
}

function fixture(shared, environment) {
    assert.ok(source.length > 1000, 'មិនអាចអាន source ពិត');
    const state = shared || { value: cookie('A'), etag: '"etag-1"', serial: 1 };
    const hooks = { get: null, set: null, fetch: async () => response(200) };
    const calls = { get: 0, set: [], fetch: [] };
    let now = 1900000000000;
    class Clock extends Date { static now() { return now; } }
    const store = {
        async get() { const entry = await store.getWithMetadata(); return entry && entry.data; },
        async getWithMetadata() {
            calls.get++;
            if (hooks.get) return hooks.get();
            return state.value === null ? null : { data: state.value, etag: state.etag, metadata: {} };
        },
        async set(_key, value, options) {
            const record = { value, options };
            calls.set.push(record);
            const commit = () => {
                if (options && options.onlyIfMatch !== undefined && options.onlyIfMatch !== state.etag) return { modified: false };
                if (options && options.onlyIfNew && state.value !== null) return { modified: false };
                state.value = value;
                state.etag = '"etag-' + (++state.serial) + '"';
                return { modified: true, etag: state.etag };
            };
            return hooks.set ? hooks.set(record, commit) : commit();
        }
    };
    const exported = {};
    vm.runInNewContext(source, { exports: exported, require, Date: Clock,
        process: { env: Object.assign({ ZTO_PROXY_KEY: KEY, ZTO_CACHE_TTL_MS: '0', ZTO_UPSTREAM_RETRIES: '0' }, environment) },
        URL, AbortController, setTimeout, clearTimeout, Buffer,
        fetch: async (url, init) => { calls.fetch.push(init.headers.Cookie); return hooks.fetch(url, init); }
    }, { filename: FILE });
    exported.setBlobsModuleForTests({ connectLambda() {}, getStore() { return store; } });
    const call = (query) => exported.handler({ httpMethod: 'GET', blobs: 'synthetic-context',
        headers: { 'x-zoe-proxy-key': KEY }, queryStringParameters: query });
    return { state, hooks, calls, store, call,
        advance(ms) { now += ms; },
        sync(value) { state.value = value; state.etag = '"etag-' + (++state.serial) + '"'; },
        lookup(barcode = 'SYNTHETIC123') { return call({ barcode }); },
        async diag(fresh = false) { return JSON.parse((await call({ diag: '1', fresh: fresh ? '1' : '0' })).body); }
    };
}

async function scenario(label, run) {
    try { await run(); passed++; console.log('  PASS ' + label); }
    catch (error) { failed++; console.log('  FAIL ' + label + ': ' + String(error.message).split('\n')[0]); }
}

async function main() {
    await scenario('Cookie មិនប្តូរ៖ lookup និង verdict នៅត្រឹមត្រូវ', async () => {
        const f = fixture();
        assert.equal((await f.lookup()).statusCode, 200);
        const d = await f.diag();
        assert.equal(d.cookie.fingerprint, fingerprint(cookie('A')));
        assert.equal(d.cookie.authRejectedAgeMs, null);
        assert.equal(typeof d.cookie.authAcceptedAgeMs, 'number');
        assert.equal(f.calls.set.length, 0);
    });
    await scenario('Cookie ផុតពិត៖ verdict បដិសេធត្រូវនៅមាន', async () => {
        const f = fixture(); f.hooks.fetch = async () => response(401);
        assert.equal((await f.lookup()).statusCode, 401);
        assert.equal(typeof (await f.diag()).cookie.authRejectedAgeMs, 'number');
        assert.equal(f.calls.set.length, 0);
    });
    await scenario('ប្តូរ session ពីរដង៖ ក្រោយ ៦២ វិនាទីនៅប្រើ និងរក្សាទុក Cookie ថ្មី', async () => {
        const f = fixture(); let valid = cookie('A'); let count = 0;
        f.hooks.fetch = async (_url, init) => {
            if (init.headers.Cookie !== valid) return response(401);
            const next = ++count === 1 ? cookie('B') : count === 2 ? cookie('C') : null;
            if (next) valid = next;
            return response(200, next);
        };
        assert.equal((await f.lookup('SYNTHETIC001')).statusCode, 200);
        f.advance(1000);
        assert.equal((await f.lookup('SYNTHETIC002')).statusCode, 200);
        assert.equal(f.calls.set.length, 2, 'session ថ្មីត្រូវរក្សាទុកភ្លាមសម្រាប់ container ផ្សេង');
        const cold = fixture(f.state);
        cold.hooks.fetch = async (_url, init) => response(init.headers.Cookie === valid ? 200 : 401);
        assert.equal((await cold.lookup()).statusCode, 200);
        f.advance(61000);
        assert.equal((await f.lookup('SYNTHETIC003')).statusCode, 200);
        await tick();
        assert.equal((await f.lookup('SYNTHETIC004')).statusCode, 200);
        assert.equal(f.state.value, cookie('C'));
        assert.equal(f.calls.set.length, 2, 'មិនសរសេរដដែលបន្ត');
    });
    for (const oldStatus of [200, 401]) {
        await scenario('Sync Cookie ថ្មី៖ មិនយក verdict ' + oldStatus + ' របស់ Cookie ចាស់មកប្រើ', async () => {
            const f = fixture(); f.hooks.fetch = async () => response(oldStatus);
            await f.lookup(); f.sync(cookie('MANUAL'));
            const d = await f.diag(true);
            assert.equal(d.cookie.fingerprint, fingerprint(cookie('MANUAL')));
            assert.equal(d.cookie.authAcceptedAgeMs, null);
            assert.equal(d.cookie.authRejectedAgeMs, null);
        });
    }
    for (const oldStatus of [200, 401]) {
        await scenario('សំណើចាស់ ' + oldStatus + ' មកយឺត៖ មិនប្តូរ verdict Cookie ថ្មី', async () => {
            const f = fixture(); const late = defer(); const began = defer();
            f.hooks.fetch = async (_url, init) => {
                if (init.headers.Cookie === cookie('A')) { began.resolve(); return late.promise; }
                return response(oldStatus === 200 ? 401 : 200);
            };
            const first = f.lookup('SYNTHETIC001'); await began.promise;
            f.sync(cookie('MANUAL')); await f.diag(true); await f.lookup('SYNTHETIC002');
            f.advance(7000); late.resolve(response(oldStatus)); await first;
            const d = await f.diag();
            assert.equal(d.cookie.fingerprint, fingerprint(cookie('MANUAL')));
            if (oldStatus === 200) assert.equal(typeof d.cookie.authRejectedAgeMs, 'number');
            else { assert.equal(d.cookie.authRejectedAgeMs, null); assert.equal(typeof d.cookie.authAcceptedAgeMs, 'number'); }
        });
    }
    await scenario('Set-Cookie របស់សំណើចាស់មកយឺត៖ មិនជាន់ manual sync', async () => {
        const f = fixture(); const late = defer(); const began = defer();
        f.hooks.fetch = async () => { began.resolve(); return late.promise; };
        const first = f.lookup(); await began.promise;
        f.sync(cookie('MANUAL')); await f.diag(true);
        late.resolve(response(200, cookie('OLD-ROTATION'))); await first;
        assert.equal(f.state.value, cookie('MANUAL'));
        assert.equal((await f.diag()).cookie.fingerprint, fingerprint(cookie('MANUAL')));
    });
    await scenario('Manual sync នៅចន្លោះ write៖ conditional write មិនជាន់ Cookie ថ្មី', async () => {
        const f = fixture(); f.hooks.fetch = async () => response(200, cookie('B'));
        f.hooks.set = async (_record, commit) => { f.sync(cookie('MANUAL')); return commit(); };
        assert.equal((await f.lookup()).statusCode, 200);
        assert.equal(f.state.value, cookie('MANUAL'));
        assert.equal(f.calls.set.length, 1);
        assert.equal(f.calls.set[0].options.onlyIfMatch, '"etag-1"');
        assert.equal((await f.diag(true)).cookie.fingerprint, fingerprint(cookie('MANUAL')));
    });
    await scenario('Container ពីរ៖ renewal ចាស់មិនជាន់អ្នកសរសេរជោគជ័យមុន', async () => {
        const shared = { value: cookie('A'), etag: 'W/"etag-1"', serial: 1 };
        const first = fixture(shared); const second = fixture(shared);
        await first.diag(); await second.diag();
        first.hooks.fetch = async () => response(200, cookie('FIRST'));
        second.hooks.fetch = async () => response(200, cookie('SECOND'));
        await first.lookup(); await second.lookup();
        assert.equal(shared.value, cookie('FIRST'));
        assert.equal(first.calls.set[0].options.onlyIfMatch, 'W/"etag-1"');
        assert.equal(second.calls.set[0].options.onlyIfMatch, 'W/"etag-1"');
    });
    await scenario('Write ជោគជ័យ៖ GET ចាស់ពី replica មិនជាន់ session ដែលបានរក្សាទុកថ្មី', async () => {
        const f = fixture(); f.hooks.fetch = async () => response(200, cookie('B'));
        await f.lookup();
        f.hooks.fetch = async (_url, init) => response(init.headers.Cookie === cookie('B') ? 200 : 401);
        f.hooks.get = async () => ({ data: cookie('A'), etag: '"etag-1"', metadata: {} });
        f.advance(61000); await f.lookup('SYNTHETIC002'); await tick();
        assert.equal((await f.lookup('SYNTHETIC003')).statusCode, 200);
    });
    await scenario('Pending renewal៖ manual sync ត្រូវឈ្នះ ហើយ pending ចាស់មិនត្រូវសរសេរបន្ត', async () => {
        const f = fixture(); let count = 0;
        f.hooks.fetch = async () => response(200, ++count === 1 ? cookie('B') : count === 2 ? 'sidebarStatus=2' : null);
        await f.lookup(); f.advance(1000); await f.lookup('SYNTHETIC002');
        f.sync(cookie('MANUAL')); await f.diag(true); f.advance(61000); await f.lookup('SYNTHETIC003');
        assert.equal(f.state.value, cookie('MANUAL'));
        assert.equal(f.calls.set.length, 1);
    });
    await scenario('Write បោះ៖ pending ត្រូវសរសេរបន្តលើ lookup ក្រោយដោយគ្មាន Set-Cookie ថ្មី', async () => {
        const f = fixture(); f.hooks.fetch = async () => response(200, cookie('B'));
        f.hooks.set = async () => { throw new Error('synthetic-write-failure'); };
        assert.equal((await f.lookup()).statusCode, 200);
        f.hooks.fetch = async () => response(200); f.hooks.set = null;
        f.advance(61000); await f.lookup('SYNTHETIC002');
        assert.equal(f.state.value, cookie('B'));
        assert.equal(f.calls.set.length, 2);
    });
    await scenario('Write timeout រួច commit យឺត៖ មិនបំផ្លាញ pending ជំនាន់ក្រោយ', async () => {
        const f = fixture(); const pendingWrite = defer(); let commitLate; let count = 0;
        f.hooks.fetch = async () => response(200, ++count === 1 ? cookie('B') : count === 2 ? 'sidebarStatus=2' : null);
        f.hooks.set = async (_record, commit) => { commitLate = commit; return pendingWrite.promise; };
        const started = Date.now(); await f.lookup();
        assert.ok(Date.now() - started < 1800, 'write ព្យួរមិនត្រូវទប់ handler');
        f.advance(1000); await f.lookup('SYNTHETIC002');
        pendingWrite.resolve(commitLate()); await tick();
        f.hooks.set = null; f.advance(61000);
        await f.lookup('SYNTHETIC003'); await tick();
        assert.equal(f.state.value, cookie('B') + '; sidebarStatus=2');
        assert.equal((await f.diag()).cookie.fingerprint, fingerprint(cookie('B') + '; sidebarStatus=2'));
    });
    await scenario('Cookie ដដែល ETag ថ្មី៖ renewal ត្រូវប្រើ ETag ដែលអានថ្មី', async () => {
        const f = fixture(); await f.diag(); f.sync(cookie('A')); await f.diag(true);
        f.hooks.fetch = async () => response(200, cookie('B')); await f.lookup();
        assert.equal(f.state.value, cookie('B'));
        assert.equal(f.calls.set[0].options.onlyIfMatch, '"etag-2"');
    });
    await scenario('ETag បាត់៖ មិន fallback សរសេរជាន់ដោយគ្មានលក្ខខណ្ឌ', async () => {
        const f = fixture(); f.hooks.get = async () => ({ data: cookie('A'), metadata: {} });
        f.hooks.fetch = async () => response(200, cookie('B')); await f.lookup();
        assert.equal(f.calls.set.length, 0);
        assert.equal((await f.diag()).cookie.fingerprint, fingerprint(cookie('B')));
    });
    await scenario('ការប្តូរគូធម្មតា៖ throttle នៅដដែល និង pending សរសេរក្រោយ ៦០ វិនាទី', async () => {
        const f = fixture(); let count = 0;
        f.hooks.fetch = async () => response(200, ++count === 1 ? 'sidebarStatus=1' : count === 2 ? 'sidebarStatus=2' : null);
        await f.lookup(); f.advance(1000); await f.lookup('SYNTHETIC002');
        assert.equal(f.calls.set.length, 1);
        f.advance(61000); await f.lookup('SYNTHETIC003'); await tick();
        assert.equal(f.calls.set.length, 2);
        assert.equal(f.state.value, cookie('A') + '; sidebarStatus=2');
    });
    await scenario('SDK modified:true ប៉ុន្តែ ETag ទទេ៖ មិនប្រកាសថារក្សាទុកបាន', async () => {
        const f = fixture(); f.hooks.fetch = async () => response(200, cookie('B'));
        f.hooks.set = async () => ({ modified: true, etag: '' });
        await f.lookup();
        const d = await f.diag();
        assert.equal(d.cookie.renewals, 0);
        assert.equal(d.cookie.fingerprint, fingerprint(cookie('B')));
        f.hooks.set = null; f.hooks.fetch = async () => response(200);
        f.advance(61000); await f.lookup('SYNTHETIC002');
        assert.equal(f.state.value, cookie('B'));
    });
    await scenario('Diagnostics fresh អាន store បោះ៖ Cookie និង pending ល្អមិនត្រូវបាត់', async () => {
        const f = fixture(); f.hooks.fetch = async () => response(200, cookie('B'));
        f.hooks.set = async () => { throw new Error('synthetic-write-failure'); };
        await f.lookup(); f.hooks.get = async () => { throw new Error('synthetic-read-failure'); };
        const d = await f.diag(true);
        assert.equal(d.cookie.fingerprint, fingerprint(cookie('B')));
        assert.ok(d.cookie.storeReason);
        f.hooks.get = null; f.hooks.set = null; f.hooks.fetch = async () => response(200);
        f.advance(61000); await f.lookup('SYNTHETIC002');
        assert.equal(f.state.value, cookie('B'));
    });
    await scenario('ការអានចាស់បរាជ័យយឺត៖ មិនប្តូរស្ថានភាព Cookie ដែលទើប sync', async () => {
        const f = fixture(); await f.lookup();
        const began = defer(); const late = defer();
        f.hooks.get = async () => { began.resolve(); await late.promise; throw new Error('synthetic-late-read-failure'); };
        const oldRead = f.diag(true); await began.promise;
        f.hooks.get = null; f.sync(cookie('MANUAL')); await f.diag(true); await f.lookup('SYNTHETIC002');
        late.resolve(); const d = await oldRead;
        assert.equal(d.cookie.fingerprint, fingerprint(cookie('MANUAL')));
        assert.equal(typeof d.cookie.authAcceptedAgeMs, 'number');
        assert.equal(d.cookie.storeReason, null);
    });
    await scenario('ថវិកាសរសេរអស់៖ pending រស់ ហើយ request បន្ទាប់រក្សាទុកបាន', async () => {
        const f = fixture();
        f.hooks.fetch = async () => { f.advance(8000); return response(200, cookie('B')); };
        assert.equal((await f.lookup()).statusCode, 200);
        assert.equal(f.calls.set.length, 0);
        f.hooks.fetch = async () => response(200);
        assert.equal((await f.lookup('SYNTHETIC002')).statusCode, 200);
        assert.equal(f.state.value, cookie('B'));
        assert.equal(f.calls.set.length, 1);
    });
    await scenario('Write ថ្មីជោគជ័យមុន write ចាស់ដែល timeout៖ Cookie ថ្មីមិនត្រូវជាន់', async () => {
        const f = fixture(); const oldWrite = defer(); let commitOld; let count = 0;
        f.hooks.fetch = async () => response(200, ++count === 1 ? cookie('B') : count === 2 ? cookie('C') : null);
        f.hooks.set = async (_record, commit) => {
            if (f.calls.set.length === 1) { commitOld = commit; return oldWrite.promise; }
            return commit();
        };
        await f.lookup(); f.advance(1000); await f.lookup('SYNTHETIC002');
        oldWrite.resolve(commitOld()); await tick();
        assert.equal(f.state.value, cookie('C'));
        assert.equal((await f.diag()).cookie.fingerprint, fingerprint(cookie('C')));
    });
    await scenario('Write ចាស់ commit មុន៖ pending ថ្មីបន្ត CAS ពី ETag ថ្មីបាន', async () => {
        const f = fixture(); const oldWrite = defer(); const newWrite = defer(); const newBegan = defer();
        let commitOld; let commitNew; let count = 0;
        f.hooks.fetch = async () => response(200, ++count === 1 ? cookie('B') : count === 2 ? cookie('C') : null);
        f.hooks.set = async (_record, commit) => {
            if (f.calls.set.length === 1) { commitOld = commit; return oldWrite.promise; }
            if (f.calls.set.length === 2) { commitNew = commit; newBegan.resolve(); return newWrite.promise; }
            return commit();
        };
        await f.lookup(); f.advance(1000);
        const second = f.lookup('SYNTHETIC002');
        await Promise.race([newBegan.promise, second.then(() => {
            if (!commitNew) throw new Error('ការបន្ត session ទី២ មិនបានចាប់ផ្តើមរក្សាទុក');
        })]);
        oldWrite.resolve(commitOld()); await tick();
        newWrite.resolve(commitNew()); await second;
        assert.equal((await f.diag()).cookie.fingerprint, fingerprint(cookie('C')));
        await f.lookup('SYNTHETIC003');
        assert.equal(f.state.value, cookie('C'));
        assert.equal(f.calls.set.length, 3);
        assert.equal(f.calls.set[2].options.onlyIfMatch, '"etag-2"');
    });
    for (const invalid of ['sidebarStatus=1', null]) {
        await scenario('Cookie env ត្រឹមត្រូវ៖ ជួសជុល store ' + (invalid === null ? 'ទទេ' : 'ខូច') + ' ដោយ conditional write', async () => {
            const f = fixture({ value: invalid, etag: '"etag-1"', serial: 1 }, { ZTO_COOKIE: cookie('A') });
            f.hooks.fetch = async () => response(200, cookie('B'));
            assert.equal((await f.lookup()).statusCode, 200);
            assert.equal(f.state.value, cookie('B'));
            assert.equal(f.calls.set.length, 1);
            if (invalid === null) assert.equal(f.calls.set[0].options.onlyIfNew, true);
            else assert.equal(f.calls.set[0].options.onlyIfMatch, '"etag-1"');
        });
    }
    console.log('សរុប៖ ' + passed + ' PASS · ' + failed + ' FAIL');
    process.exitCode = failed ? 1 : 0;
}
main().catch((error) => { console.error(String(error.message)); process.exitCode = 1; });
