import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.env.SUPABASE_ONBOARDING_APP_DIR || fileURLToPath(new URL('../..', import.meta.url)));
const source = relative => import(pathToFileURL(path.join(root, relative)));
const { handleRegister } = await source('supabase/functions/_shared/account-core.ts');
const { adminDeps } = await source('supabase/functions/_shared/admin-deps.ts');
const protocol = 'zoe-registration-v1';
const projectRef = 'abcdefghijklmnopqrst';
const publishableKey = 'sb_publishable_' + 'a'.repeat(32);
const origin = 'https://fixture.netlify.app';
const options = { projectRef, publishableKey, origin, prepareSql: true, confirmProject: projectRef,
    confirmAuthSettings: true, confirmNoLegacyRequests: true };
const settings = { disable_signup: true };
const probe = ready => ({ ok: true, code: 'registration-protocol', protocol, ready });

test('probe របស់ handler ពិតអាន readiness ដោយមិនប៉ះ Auth កូដ ឬសមាជិក', async () => {
    const calls = [];
    const deps = new Proxy({ registrationReady: async () => { calls.push('readiness'); return false; } }, {
        get(target, key) { return key in target ? target[key] : () => { throw Error('unexpected write/read: ' + String(key)); }; }
    });
    assert.deepEqual(await handleRegister({ registrationProtocol: protocol }, deps), { status: 200, body: probe(false) });
    assert.deepEqual(calls, ['readiness']);
});

test('readiness ខ្វះ ខុសទម្រង់ ឬបដិសេធ ត្រូវបិទដោយសុវត្ថិភាព', async () => {
    for (const ready of [null, undefined, 'true', 1, {}, []]) {
        const result = await handleRegister({ registrationProtocol: protocol }, { registrationReady: async () => ready });
        assert.equal(result.status, 503);
        assert.equal(result.body.ok, false);
    }
    assert.equal((await handleRegister({ registrationProtocol: protocol }, {})).status, 503);
    assert.equal((await handleRegister({ registrationProtocol: protocol }, { registrationReady: async () => { throw Error('private details'); } })).status, 503);
    for (const body of [{ registrationProtocol: 'old' }, { registrationProtocol: protocol, invite: 'AAAAAAAAAAAAAAAAAAAA' }]) {
        assert.equal((await handleRegister(body, {})).status, 400);
    }
});

test('readiness RPC នៅ server អានតែប៉ុណ្ណោះ មានពិដាន និងផ្ទៀង shape', async () => {
    for (const data of [null, {}, [], true, { protocol: 'old', ready: true }, { protocol, ready: 'true' }]) {
        const deps = adminDeps({ rpc: async () => ({ data, error: null }) }, 5);
        assert.equal(await deps.registrationReady(), null);
    }
    for (const ready of [false, true]) {
        const calls = [];
        const deps = adminDeps({ rpc: async (...args) => { calls.push(args); return { data: { protocol, ready }, error: null }; } });
        assert.equal(await deps.registrationReady(), ready);
        assert.deepEqual(calls, [['registration_capability_v1']]);
    }
    assert.equal(await adminDeps({ rpc: () => new Promise(() => {}) }, 5).registrationReady(), null);
    assert.equal(await adminDeps({ rpc: async () => { throw Error('secret'); } }, 5).registrationReady(), null);
});

async function tool() { return source('supabase/scripts/registration-onboarding.mjs'); }
function transport(over = {}) {
    const calls = [];
    return { calls, fetch: async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify(url.endsWith('/settings') ? (over.settings ?? settings) : (over.probe ?? probe(false))), {
            status: over.status || 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': over.cors ?? origin }
        });
    } };
}

test('ត្រៀម SQL ប្រើ target ជាក់លាក់ public key គ្មាន redirect និងគ្មានសំណើសរសេរ', async () => {
    const { prepareActivation } = await tool(), t = transport();
    const result = await prepareActivation(options, t.fetch);
    assert.equal(result.ready, false);
    assert.match(result.sql, /abcdefghijklmnopqrst/);
    assert.match(result.sql, /registration_capability_v1/);
    assert.equal(t.calls.length, 2);
    assert.deepEqual(t.calls.map(c => c.url), ['https://' + projectRef + '.supabase.co/auth/v1/settings', 'https://' + projectRef + '.supabase.co/functions/v1/register']);
    assert.deepEqual(t.calls.map(c => c.init.method), ['GET', 'POST']);
    assert.deepEqual(JSON.parse(t.calls[1].init.body), { registrationProtocol: protocol });
    for (const c of t.calls) {
        assert.equal(c.init.redirect, 'error');
        assert.equal(c.init.headers.apikey, publishableKey);
        assert.ok(c.init.signal instanceof AbortSignal);
    }
    assert.equal(result.sql.includes(publishableKey), false);
});

test('target ខុស secret ឬខ្វះការបញ្ជាក់ មិនផ្ញើសំណើ', async () => {
    const { prepareActivation } = await tool();
    for (const over of [{ projectRef: 'https://attacker.test' }, { projectRef: '../evil' }, { publishableKey: 'sb_secret_private' },
        { publishableKey: 'eyJ.service-role' }, { origin: 'http://attacker.test' }, { origin: origin + '/path' },
        { confirmProject: 'wrong' }, { confirmAuthSettings: false }, { confirmNoLegacyRequests: false }]) {
        const t = transport();
        await assert.rejects(prepareActivation({ ...options, ...over }, t.fetch));
        assert.equal(t.calls.length, 0);
    }
});

test('Auth settings probe CORS ឬ HTTP មិនត្រឹមត្រូវ មិនត្រៀម SQL', async () => {
    const { prepareActivation } = await tool();
    for (const settings of [{}, { disable_signup: false }, { disable_signup: 'true' }]) {
        const t = transport({ settings });
        await assert.rejects(prepareActivation(options, t.fetch));
        assert.equal(t.calls.length, 1);
    }
    for (const override of [{ probe: {} }, { probe: { ...probe(false), protocol: 'old' } },
        { probe: { ...probe(false), ready: 'false' } }, { probe: { ...probe(false), ok: false } },
        { probe: { ...probe(false), code: 'invite-invalid' } }, { cors: '*' }, { status: 500 }]) {
        await assert.rejects(prepareActivation(options, transport(override).fetch));
    }
    await assert.rejects(prepareActivation(options, async () => new Response('{broken', { status: 200 })));
    await assert.rejects(prepareActivation(options, async () => { throw Error('transport secret'); }), e => !e.message.includes('transport secret'));
});

test('ពិនិត្យតែអានមិនត្រូវការ attestation និង gate បើករួចមិនចេញ SQL', async () => {
    const { prepareActivation } = await tool();
    const check = await prepareActivation({ projectRef, publishableKey, origin }, transport().fetch);
    assert.equal(check.sql, null);
    assert.equal(check.ready, false);
    const already = await prepareActivation(options, transport({ probe: probe(true) }).fetch);
    assert.equal(already.ready, true);
    assert.equal(already.sql, null);
});

test('ចម្លើយធំពេក ឬ UTF-8 ខូច មិនអាចជាភស្តុតាង preflight', async () => {
    const { prepareActivation } = await tool();
    for (const body of [' '.repeat(16385), new Uint8Array([0xff, 0xff])]) {
        await assert.rejects(prepareActivation(options, async () => new Response(body)));
    }
    await assert.rejects(prepareActivation(options, async () => new Response(new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(16385)); }, cancel() { return new Promise(() => {}); }
    }))));
});

test('SQL មានពិដានសុពលភាព និងមិនជំនួស project/key ពីអត្ថបទមិនទុកចិត្ត', async () => {
    const { activationSql } = await tool();
    const sql = activationSql(projectRef, Date.UTC(2026, 10, 7));
    assert.match(sql, /2026-11-07T00:05:00\.000Z/);
    assert.equal(sql.includes('__PREFLIGHT_EXPIRES__'), false);
    assert.match(sql, /begin;[\s\S]*lock table private\.registration_protocol, auth\.users, public\.tenants,[\s\S]*public\.tenant_invites, public\.tenant_members, public\.platform_admins[\s\S]*in share row exclusive mode;/);
    assert.match(sql, /set local lock_timeout = '5s';/);
    assert.match(sql, /set local statement_timeout = '15s';/);
    assert.ok(sql.indexOf('registration-new-project-only') < sql.indexOf('set accepting = true'));
    assert.ok(sql.indexOf('registration-database-not-ready') < sql.indexOf('\ncommit;'));
    assert.doesNotMatch(sql, /\b(delete from|grant |create (?:or replace )?function|alter table)\b/i);
    for (const value of [undefined, null, NaN, -1, {}, []]) assert.throws(() => activationSql(projectRef, value));
    assert.throws(() => activationSql("';commit;--", Date.now()));
});
