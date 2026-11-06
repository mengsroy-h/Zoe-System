'use strict';
// Contract tests run each unmodified shipping copy, never a copied implementation.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { test: nodeTest, after } = require('node:test');
let registered = 0, completed = 0, failedTests = 0;
function test(name, run) {
    registered++;
    return nodeTest(name, async () => {
        try { await run(); } catch (error) { failedTests++; throw error; }
        finally { completed++; }
    });
}
// Explicit final verdict for the audit preload; incomplete/cancelled work cannot go green.
after(() => { process.exitCode = registered > 0 && completed === registered && failedTests === 0 ? 0 : 1; });
const ROOT = path.resolve(process.env.LICENSETIME_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '..'));
const FILES = ['ZoeW/public/license-verify.js', 'ZoeKeyGen/license-verify.js'];
const ENDPOINT = 'https://zoew.netlify.app/.netlify/functions/server-time';
const NOW = 1793959200000;
class FixedDate extends Date { static now() { return NOW; } }
function fixture(file, responder, overrides = {}) {
    const calls = [], pendingTimers = new Map();
    const savedActivation = JSON.stringify({ keyString: "existing-activation", id: "existing-id", exp: 2000000000 });
    const storage = new Map([["zoe_license_activation_ZOE", savedActivation]]);
    let id = 0;
    const sandbox = { console, Date: FixedDate, crypto: webcrypto, URL, AbortController, TextEncoder, TextDecoder,
        navigator: { onLine: true },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        setTimeout(fn, delay) { pendingTimers.set(++id, { fn, delay }); return id; },
        clearTimeout(key) { pendingTimers.delete(key); },
        async fetch(url, init) { calls.push({ url: String(url), init }); return responder(new URL(url), init); }
    };
    Object.assign(sandbox, overrides);
    sandbox.atob = value => Buffer.from(value, 'base64').toString('binary');
    sandbox.btoa = value => Buffer.from(value, 'binary').toString('base64');
    sandbox.window = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox);
    return { api: sandbox.ZoeLicense, calls, pendingTimers, storage, savedActivation, abort() { for (const { fn } of [...pendingTimers.values()]) fn(); } };
}
function reply(url, patch = {}, options = {}) {
    const body = { now: NOW + 42000, nonce: url.searchParams.get('nonce'), ...patch };
    return { ok: (options.status || 200) === 200, status: options.status || 200,
        redirected: !!options.redirected, type: 'cors',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => body, text: async () => JSON.stringify(body) };
}
const drain = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
for (const file of FILES) {
    test(file + ': readable JSON without Date establishes trust; request has no customer data', async () => {
        const e = fixture(file, url => reply(url));
        assert.equal(e.api.getServerTimeOffset(), null);
        assert.equal(await e.api.syncServerTime(), true);
        assert.equal(e.api.getServerTimeOffset(), 42000);
        assert.equal(e.api.getServerNow(), NOW + 42000);
        const { url, init } = e.calls[0], u = new URL(url);
        assert.equal(u.origin + u.pathname, ENDPOINT);
        assert.deepEqual([...u.searchParams.keys()], ['nonce']);
        assert.match(u.searchParams.get('nonce'), /^[a-f0-9]{32}$/);
        assert.equal(init.method || 'GET', 'GET');
        assert.equal(init.credentials, 'omit'); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error');
        assert.equal(init.body, undefined); assert.deepEqual(Object.keys(init.headers || {}), []);
        assert.ok(init.signal instanceof AbortSignal);
        assert.equal(e.pendingTimers.size, 0);
        assert.equal(e.storage.get("zoe_license_activation_ZOE"), e.savedActivation);
        assert.equal(await e.api.syncServerTime(), true);
        assert.notEqual(new URL(e.calls[1].url).searchParams.get('nonce'), u.searchParams.get('nonce'));
    });
    for (const offset of [-42000, 0, 42000]) test(file + ': accepts signed offset ' + offset, async () => {
        const e = fixture(file, url => reply(url, { now: NOW + offset }));
        assert.equal(await e.api.syncServerTime(), true); assert.equal(e.api.getServerTimeOffset(), offset);
    });
    const cases = [
        ...['text/html', 'text/plain', ''].map(mime => ['invalid MIME ' + mime, url => ({ ...reply(url), headers: new Headers(mime ? { 'Content-Type': mime } : {}) })]),
        ['nonce mismatch', url => reply(url, { nonce: 'a'.repeat(32) })],
        ['nonce missing', url => reply(url, { nonce: undefined })],
        ['nonce non-string', url => reply(url, { nonce: 123 })],
        ...[null, '1793959200000', 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(now => ['invalid now ' + now, url => reply(url, { now })]),
        ['null JSON', url => ({ ...reply(url), json: async () => null, text: async () => 'null' })],
        ['malformed JSON', url => ({ ...reply(url), json: async () => { throw Error('invalid JSON'); }, text: async () => '{' })],
        ...[401, 403, 404, 500].map(status => ['HTTP ' + status, url => reply(url, {}, { status })]),
        ['redirect response', url => reply(url, {}, { redirected: true })],
        ['redirect rejected', () => { throw new TypeError('redirect disallowed'); }],
        ['network rejected', () => { throw new TypeError('Failed to fetch'); }]
    ];
    for (const [name, responder] of cases) test(file + ': ' + name + ' cannot establish or replace trust', async () => {
        const e = fixture(file, responder);
        assert.equal(await e.api.syncServerTime(), false); assert.equal(e.api.getServerTimeOffset(), null);
        e.api.setServerTimeOffset(-30000); // Existing trusted backend fallback must survive a failed refresh.
        assert.equal(await e.api.syncServerTime(), false); assert.equal(e.api.getServerTimeOffset(), -30000);
        assert.equal(e.pendingTimers.size, 0);
        assert.equal(e.storage.get("zoe_license_activation_ZOE"), e.savedActivation);
    });
    for (const stage of ['fetch', 'body']) test(file + ': ' + stage + ' timeout releases request and permits retry', async () => {
        let attempt = 0;
        const e = fixture(file, (url, init) => {
            if (++attempt > 1) return reply(url);
            const hang = () => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
            return stage === 'fetch' ? hang() : { ...reply(url), json: hang, text: hang };
        });
        const work = e.api.syncServerTime(); await drain();
        assert.equal(e.pendingTimers.size, 1);
        assert.ok([...e.pendingTimers.values()][0].delay <= 10000);
        e.abort(); assert.equal(await work, false); assert.equal(e.api.getServerTimeOffset(), null);
        assert.equal(e.pendingTimers.size, 0);
        assert.equal(e.storage.get("zoe_license_activation_ZOE"), e.savedActivation);
        assert.equal(await e.api.syncServerTime(), true);
    });
    for (const stage of ['fetch', 'body']) test(file + ': ignores late non-cooperative ' + stage + ' after deadline', async () => {
        let release, firstUrl, attempt = 0;
        const e = fixture(file, url => {
            if (++attempt > 1) return reply(url, { now: NOW - 30000 });
            firstUrl = url;
            const hanging = new Promise(resolve => { release = resolve; });
            return stage === 'fetch' ? hanging : { ...reply(url), json: () => hanging };
        });
        let settled = false, result;
        e.api.syncServerTime().then(value => { settled = true; result = value; }); await drain();
        e.abort(); await drain(); assert.equal(settled, true); assert.equal(result, false);
        assert.equal(e.api.getServerTimeOffset(), null);
        assert.equal(await e.api.syncServerTime(), true); assert.equal(e.api.getServerTimeOffset(), -30000);
        release(stage === 'fetch' ? reply(firstUrl) : { now: NOW + 42000, nonce: firstUrl.searchParams.get('nonce') });
        await drain(); assert.equal(e.api.getServerTimeOffset(), -30000);
        assert.equal(e.pendingTimers.size, 0);
    });
    for (const goodTime of [true, false]) test(file + ': activate requires trusted JSON; getStatus preserves untrusted existing activation (' + goodTime + ')', async () => {
        const device = 'A'.repeat(24); let exp = (NOW + 86400000) / 1000;
        const payload = { a: 'ZOE', id: 'existing-id', iat: (NOW - 86400000) / 1000, exp };
        const key = 'ZOEKEY-' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + Buffer.from('signature').toString('base64url');
        const e = fixture(file, url => {
            if (url.pathname.includes('/server-time')) return reply(url, goodTime ? {} : { nonce: 'bad' });
            const data = url.pathname.includes('/license_keys/') ? { expiresAt: exp * 1000, maxDevices: 1 } : { d1: { device } };
            return { ok: true, status: 200, headers: new Headers(), json: async () => data };
        }, { crypto: { getRandomValues: bytes => webcrypto.getRandomValues(bytes), subtle: { importKey: async () => ({}), verify: async () => true } } });
        e.storage.set('zoe_license_device_id', device);
        const existing = JSON.stringify({ keyString: key, id: payload.id, a: 'ZOE', iat: payload.iat, exp, activatedAt: NOW, seenMax: NOW, lastOnlineCheck: NOW, releaseEpoch: 0 });
        e.storage.set('zoe_license_activation_ZOE', existing);
        const activation = await e.api.activate(key, 'ZOE');
        assert.equal(activation.valid, goodTime);
        if (!goodTime) { assert.equal(activation.reason, 'clock-unverified'); assert.equal(e.storage.get('zoe_license_activation_ZOE'), existing); }
        assert.equal(e.api.getServerTimeOffset(), goodTime ? 42000 : null);
        const status = await e.api.getStatus('ZOE');
        assert.equal(status.state, 'active');
        assert.equal(JSON.parse(e.storage.get('zoe_license_activation_ZOE')).keyString, key);
        if (!goodTime) assert.equal(JSON.parse(e.storage.get('zoe_license_activation_ZOE')).lastOnlineCheck, NOW);
        exp = (NOW - 1000) / 1000;
        const expiredPayload = { ...payload, exp };
        const expiredKey = 'ZOEKEY-' + Buffer.from(JSON.stringify(expiredPayload)).toString('base64url') + '.' + Buffer.from('signature').toString('base64url');
        e.storage.set('zoe_license_activation_ZOE', JSON.stringify({ ...JSON.parse(existing), keyString: expiredKey, exp }));
        const expiredStatus = await e.api.getStatus('ZOE');
        assert.equal(expiredStatus.state, goodTime ? 'required' : 'offline-grace-exceeded');
        if (goodTime) assert.equal(e.storage.has('zoe_license_activation_ZOE'), false);
        else assert.equal(JSON.parse(e.storage.get('zoe_license_activation_ZOE')).keyString, expiredKey);

    });
    test(file + ': concurrent calls share network, later sync gets new nonce', async () => {
        let release;
        const e = fixture(file, url => new Promise(resolve => { release = () => resolve(reply(url)); }));
        const work = Array.from({ length: 10 }, () => e.api.syncServerTime()); await drain();
        assert.equal(e.calls.length, 1); release();
        assert.deepEqual(await Promise.all(work), Array(10).fill(true));
    });
}
test('both production license copies are byte-identical', () => assert.equal(...FILES.map(file => fs.readFileSync(path.join(ROOT, file), 'utf8'))));

test('audit baseline source routing survives measured BASE; negative control detects wrong tree', () => {
    const { spawnSync } = require('node:child_process');
    const runner = fs.readFileSync(path.join(ROOT, 'audit-tools/run-all.sh'), 'utf8');
    for (const name of ['license-time-json-test.js', 'server-time-function-test.mjs', 'license-time-cors-browser-test.js']) {
        const line = runner.split('\n').find(line => line.includes('LICENSETIME_APP_DIR=') && line.includes('node audit-tools/' + name));
        assert.ok(line, name + ' has baseline command');
        assert.ok(line.includes('LICENSETIME_APP_DIR="$IMPORTPAIRED_BASE_SOURCE"'), name + ' uses source, not measured tree');
        const run = command => spawnSync('bash', ['-c', 'node() { printf "%s\\n" "$LICENSETIME_APP_DIR"; }; ' + command], {
            encoding: 'utf8', env: { ...process.env, BASE: '/fixture/measured-tree', IMPORTPAIRED_BASE_SOURCE: '/fixture/source-tree' }
        });
        const positive = run(line); assert.equal(positive.status, 0); assert.ok(positive.stdout.includes('/fixture/source-tree'));
        const negative = run(line.replace('$IMPORTPAIRED_BASE_SOURCE', '$BASE'));
        assert.equal(negative.status, 0); assert.ok(negative.stdout.includes('/fixture/measured-tree'));
        assert.equal(negative.stdout.includes('/fixture/source-tree'), false);
    }
});
