// @vitest-environment node
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const fn = require('../netlify/functions/zto-order-detail.js');
const KEY = 'palm-proxy-key-0123456789abcdef';
const OTHER_KEY = 'palm-other-key-0123456789abcdef';
const CODE = '77130500000012';
const PASSWORD = 'palm-test-password';
const TOKEN = 'synthetic-palm-token-do-not-expose';
const ACCOUNT = { token: TOKEN, accessToken: 'unused-sso-token', countryCode: 'KH', siteCode: 'KH001', siteName: 'Test branch' };
const SIGN_KEY = 'synthetic-palm-sign-key';
const PASSWORD_KEY = 'zoew-test-aes-16';
const { tokenFor, tokenForSite, withCerts, TEST_PROJECT } = require('../../audit-tools/idtoken-fixture.js');

function upstream(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function call(query: Record<string, string>, session = '', key = KEY, input?: unknown) {
    return fn.handler({
        httpMethod: input === undefined ? 'GET' : 'POST',
        headers: { 'x-zoe-proxy-key': key, 'x-zoe-palm-token': session }, queryStringParameters: query,
        body: input === undefined ? '' : JSON.stringify(input)
    });
}

async function login(account = ACCOUNT) {
    vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: account })));
    const result = await call({ palm: 'login' }, '', KEY, { username: 'palm-user', password: PASSWORD, deviceSn: 'zoew-test-device' });
    expect(result.statusCode).toBe(200);
    return JSON.parse(result.body);
}

beforeEach(() => {
    vi.stubEnv('ZTO_PROXY_KEY', KEY);
    vi.stubEnv('ZTO_PROXY_KEYS_JSON', '');
    vi.stubEnv('ZTO_PALM_SESSION_SECRET', 'synthetic-server-session-secret-at-least-32-characters');
    vi.stubEnv('ZTO_PALM_SIGN_KEY', SIGN_KEY);
    vi.stubEnv('ZTO_PALM_PASSWORD_KEY', PASSWORD_KEY);
    vi.stubEnv('ZTO_DETAIL_IDENTITY', '');
    vi.stubEnv('ZTO_DETAIL_BRANCH_PATHS', '');
    vi.stubEnv('FIREBASE_PROJECT_IDS', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Palm login and lookup through the real Netlify handler', () => {
    it('matches Java AES/ECB/PKCS5Padding and preserves the Palm login shape', async () => {
        const result = await login();
        const [url, init] = vi.mocked(fetch).mock.calls[0];
        expect(url).toBe('https://aargus-api.ztoglobal.net/zto/system/v1/doLogin');
        const body = JSON.parse(String(init?.body));
        // Oracle: `openssl enc -aes-128-ecb -K <hex of PASSWORD_KEY> -nosalt -base64` (PKCS#7 = Java PKCS5Padding).
        expect(body.password).toBe('k86Gx+eujsY2SXdIaqRQdnt+uFfnq4ZO35iOQQk3GnY=');
        expect(Object.keys(body)).toEqual(['password', 'equipment', 'timeZone', 'userName', 'deviceSn', 'version']);
        expect(body.userName).toBe('palm-user');
        expect(body.deviceSn).toBe('zoew-test-device');
        expect(body.timeZone).toBe('GMT+07:00');
        expect(init?.redirect).toBe('manual');
        expect((init?.headers as Record<string, string>)['x-token']).toBeUndefined();
        expect(JSON.stringify(result)).not.toContain(TOKEN);
        expect(JSON.stringify(result)).not.toContain('unused-sso-token');
        expect(JSON.stringify(result)).not.toContain(PASSWORD);
        expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('uses Palm x-token and the Java MD5/Base64 digest for a bill lookup', async () => {
        const { sessionToken: session } = await login();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: { billCode: CODE, consigneeMobile: '012345678', cod: '6.55', dod: '1.25' } })));
        const response = await call({ palm: '1', barcode: CODE }, session);
        expect(JSON.parse(response.body)).toMatchObject({ found: true, barcode: CODE, phone: '012345678', cod: 6.55, dod: 1.25, ztoClosed: null });
        const [url, init] = vi.mocked(fetch).mock.calls[0];
        expect(url).toBe('https://aargus-api.ztoglobal.net/zto/basic/v1/billInfoQuery');
        expect(init?.body).toBe('{"billCode":"77130500000012"}');
        // Oracle: `openssl dgst -md5 -binary | base64` over body + SIGN_KEY.
        expect(init?.headers).toMatchObject({ 'x-token': TOKEN, 'x-sign': 'LaeYkd9ZlmYuklzrORdjkg==', 'x-language': 'km_KH', 'User-Agent': 'PDA' });
        expect(response.headers['Cache-Control']).toBe('no-store');
    });

    it('decrypts Palm phone data rather than passing ciphertext to the scan form', async () => {
        const { sessionToken: session } = await login();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: { consigneeMobile: 'BmhbP/Cn4387fL0qAljyew==', agentAmount: 3, fcAmount: 0.5 } })));
        expect(JSON.parse((await call({ palm: '1', barcode: CODE }, session)).body)).toMatchObject({ phone: '012345678', cod: 3, dod: 0.5 });
    });

    it('keeps simultaneous account sessions separate', async () => {
        const a = await login();
        const b = await login({ ...ACCOUNT, token: 'other-palm-token' });
        const tokens: string[] = [];
        vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
            tokens.push(init.headers['x-token']);
            return upstream({ status: true, result: { consigneeMobile: '012345678', cod: 1, dod: 0 } });
        }));
        await call({ palm: '1', barcode: CODE }, a.sessionToken);
        await call({ palm: '1', barcode: CODE }, b.sessionToken);
        await call({ palm: '1', barcode: CODE }, a.sessionToken);
        expect(tokens).toEqual([TOKEN, 'other-palm-token', TOKEN]);
    });

    it.each(['missing', 'tampered', 'expired', 'other-proxy-key'])('refuses %s sessions before sending upstream', async (kind) => {
        const { sessionToken: session } = await login();
        if (kind === 'expired') { vi.useFakeTimers(); vi.setSystemTime(Date.now() + 8 * 3600000 + 1); }
        if (kind === 'other-proxy-key') vi.stubEnv('ZTO_PROXY_KEY', OTHER_KEY);
        vi.stubGlobal('fetch', vi.fn());
        const res = await call({ palm: '1', barcode: CODE }, kind === 'missing' ? '' : kind === 'tampered' ? session.slice(0, -8) + 'AAAAAAAA' : session, kind === 'other-proxy-key' ? OTHER_KEY : KEY);
        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body).code).toBe('ZTO_AUTH_EXPIRED');
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each([false, null])('rejects unsuccessful or empty login result (%s)', async (status) => {
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status, result: ACCOUNT })));
        const res = await call({ palm: 'login' }, '', KEY, { username: 'u', password: PASSWORD, deviceSn: 'zoew-test-device' });
        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body).sessionToken).toBeUndefined();
    });

    it('reports a verification challenge without attempting to bypass it', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: false, statusCode: 'risk_control_account_captcha_err' })));
        const res = await call({ palm: 'login' }, '', KEY, { username: 'u', password: PASSWORD, deviceSn: 'zoew-test-device' });
        expect(JSON.parse(res.body).code).toBe('ZTO_PALM_VERIFICATION_REQUIRED');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('limits the adapter to KH accounts so other currencies do not become USD', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: { ...ACCOUNT, countryCode: 'VN' } })));
        const res = await call({ palm: 'login' }, '', KEY, { username: 'u', password: PASSWORD, deviceSn: 'zoew-test-device' });
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body).sessionToken).toBeUndefined();
    });

    it('requires proxy authentication and a server session key', async () => {
        vi.stubGlobal('fetch', vi.fn());
        expect((await call({ palm: 'login' }, '', 'bad-key', {})).statusCode).toBe(401);
        vi.stubEnv('ZTO_PALM_SESSION_SECRET', '');
        const res = await call({ palm: 'login' }, '', KEY, {});
        expect(res.statusCode).toBe(503);
        expect(JSON.parse(res.body).code).toBe('ZTO_PALM_NOT_CONFIGURED');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects oversized or malformed login inputs before upstream', async () => {
        vi.stubGlobal('fetch', vi.fn());
        for (const input of [null, {}, { username: 'u', password: 'x'.repeat(5000), deviceSn: 'zoew-test-device' }]) {
            expect((await call({ palm: 'login' }, '', KEY, input)).statusCode).toBe(400);
        }
        expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects a barcode mismatch or a row without any usable field instead of filling the wrong values', async () => {
        const { sessionToken: session } = await login();
        for (const row of [{ billCode: 'OTHER123', cod: 1 }, { cod: 'bad' }, { cod: true, dod: {} }]) {
            vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: row })));
            const res = await call({ palm: '1', barcode: CODE }, session);
            expect(res.statusCode).toBe(502);
        }
    });

    it('distinguishes missing bills from upstream authentication failure', async () => {
        const { sessionToken: session } = await login();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: null })));
        expect(JSON.parse((await call({ palm: '1', barcode: CODE }, session)).body).code).toBe('ZTO_NOT_FOUND');
        vi.stubGlobal('fetch', vi.fn(async () => upstream({}, 401)));
        expect(JSON.parse((await call({ palm: '1', barcode: CODE }, session)).body).code).toBe('ZTO_AUTH_EXPIRED');
    });

    it('does not fall back to Argus list/signed endpoints using a Palm session', async () => {
        const { sessionToken: session } = await login();
        vi.stubGlobal('fetch', vi.fn());
        const res = await call({ palm: '1', list: '1' }, session);
        expect(JSON.parse(res.body)).toMatchObject({ enabled: false, reason: 'palm:lookup-only' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each(['fetch', 'body'])('settles a hung %s even when abort is ignored', async (phase) => {
        const { sessionToken: session } = await login();
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn(() => phase === 'fetch' ? new Promise(() => {})
            : Promise.resolve({ status: 200, ok: true, json: () => new Promise(() => {}) })));
        const pending = call({ palm: '1', barcode: CODE }, session);
        await vi.advanceTimersByTimeAsync(10000);
        const res = await pending;
        expect(res.statusCode).toBe(504);
        expect(JSON.parse(res.body).code).toBe('ZTO_TIMEOUT');
    });

    it('preserves rate limiting without treating it as a bad password', async () => {
        const { sessionToken: session } = await login();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({}, 429)));
        expect((await call({ palm: '1', barcode: CODE }, session)).statusCode).toBe(429);
    });

    it('supports native GET query headers and POST login preflight', async () => {
        const { sessionToken: session } = await login();
        const res = await fn.handler({ httpMethod: 'GET', headers: { origin: 'https://localhost', 'x-zoe-proxy-key': KEY,
            'x-zoe-palm-token': session, 'x-zoe-query': 'palm=1&diag=1' } });
        expect(JSON.parse(res.body).provider).toBe('zto-palm');
        expect(res.headers['Access-Control-Allow-Origin']).toBe('https://localhost');
        const pre = await fn.handler({ httpMethod: 'OPTIONS', headers: { origin: 'https://localhost',
            'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-zoe-proxy-key' }, queryStringParameters: { palm: 'login' } });
        expect(pre.headers['Access-Control-Allow-Methods']).toContain('POST');
    });
});

describe('Palm follows the same server rules as /detail', () => {
    const CODE_ROW = { billCode: CODE, consigneeMobile: '012345678' };

    function callWith(query: Record<string, string>, extra: Record<string, string>, method = 'GET', input?: unknown) {
        return fn.handler({
            httpMethod: method, headers: { 'x-zoe-proxy-key': KEY, ...extra }, queryStringParameters: query,
            body: input === undefined ? '' : JSON.stringify(input)
        });
    }

    it.each([['ZTO_PALM_SIGN_KEY', 'palm:sign-key'], ['ZTO_PALM_PASSWORD_KEY', 'palm:password-key']])(
        'reads the ZTO protocol keys only from server env (%s unset ➜ 503, nothing sent)', async (name, reason) => {
            vi.stubEnv(name, '');
            vi.stubGlobal('fetch', vi.fn());
            const res = await call({ palm: 'login' }, '', KEY, { username: 'u', password: PASSWORD, deviceSn: 'zoew-test-device' });
            expect(res.statusCode).toBe(503);
            expect(JSON.parse(res.body)).toMatchObject({ code: 'ZTO_PALM_NOT_CONFIGURED', reason });
            expect(fetch).not.toHaveBeenCalled();
        });

    it('refuses a password key that is not 16 bytes', async () => {
        vi.stubEnv('ZTO_PALM_PASSWORD_KEY', 'short');
        vi.stubGlobal('fetch', vi.fn());
        const res = await call({ palm: 'login' }, '', KEY, { username: 'u', password: PASSWORD, deviceSn: 'zoew-test-device' });
        expect(JSON.parse(res.body)).toMatchObject({ code: 'ZTO_PALM_NOT_CONFIGURED', reason: 'palm:password-key' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('picks COD/DOD with the Argus field order and number rules', async () => {
        const { sessionToken: session } = await login();
        const cases: Array<[Record<string, unknown>, number, number]> = [
            [{ ...CODE_ROW, cod: 0, agentAmount: 4.5, dod: 0, fcAmount: 1.25 }, 4.5, 1.25],
            [{ ...CODE_ROW, cod: true, codAmount: '2.5', dod: false, dodAmount: '0.75' }, 2.5, 0.75],
            [{ ...CODE_ROW, agentAmount: -3, fcAmount: -1 }, 0, 0],
            [{ ...CODE_ROW, cod: '6.55', dod: '1.25' }, 6.55, 1.25]
        ];
        for (const [row, cod, dod] of cases) {
            vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: row })));
            const res = await call({ palm: '1', barcode: CODE }, session);
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body)).toMatchObject({ found: true, cod, dod });
        }
    });

    it('accepts the bill code ZTO sends back in another letter case', async () => {
        const { sessionToken: session } = await login();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: { billCode: ' KHAB123456 ', consigneeMobile: '012345678', cod: 1 } })));
        const res = await call({ palm: '1', barcode: 'khab123456' }, session);
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ found: true, phone: '012345678', cod: 1 });
    });

    it('reports the ZTO status code it did not recognise instead of a bare rejection', async () => {
        const { sessionToken: session } = await login();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: false, statusCode: 'TOKEN_EXPIRE', message: 'x' })));
        expect(JSON.parse((await call({ palm: '1', barcode: CODE }, session)).body)).toEqual({ code: 'ZTO_UPSTREAM_REJECTED', reason: 'palm:TOKEN_EXPIRE' });
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: false, statusCode: 'VERSION_TOO_LOW' })));
        const res = await call({ palm: 'login' }, '', KEY, { username: 'u', password: PASSWORD, deviceSn: 'zoew-test-device' });
        expect(JSON.parse(res.body)).toEqual({ code: 'ZTO_PALM_LOGIN_REJECTED', reason: 'palm:VERSION_TOO_LOW' });
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: false, statusCode: 'bad code\nwith newline' })));
        const odd = await call({ palm: 'login' }, '', KEY, { username: 'u', password: PASSWORD, deviceSn: 'zoew-test-device' });
        expect(JSON.parse(odd.body).reason).toBe('palm:status');
    });

    it('keeps the account name out of the login answer', async () => {
        const body = await login();
        expect(body.account).toEqual({ siteCode: 'KH001', siteName: 'Test branch' });
        expect(JSON.stringify(body)).not.toContain('palm-user');
    });

    it('ZTO_DETAIL_IDENTITY=require refuses Palm login and lookup without an account, before ZTO', async () => {
        const { sessionToken: session } = await login();
        vi.stubEnv('ZTO_DETAIL_IDENTITY', 'require');
        vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT);
        const palm = vi.fn(async () => upstream({ status: true, result: { ...CODE_ROW, cod: 1 } }));
        vi.stubGlobal('fetch', withCerts(palm));
        const lookup = await callWith({ palm: '1', barcode: CODE }, { 'x-zoe-palm-token': session });
        expect(lookup.statusCode).toBe(401);
        expect(JSON.parse(lookup.body)).toMatchObject({ code: 'ZTO_IDENTITY_REQUIRED', reason: 'idtoken:missing' });
        const relay = await callWith({ palm: 'login' }, {}, 'POST', { username: 'u', password: PASSWORD, deviceSn: 'zoew-test-device' });
        expect(JSON.parse(relay.body).code).toBe('ZTO_IDENTITY_REQUIRED');
        const forged = await callWith({ palm: '1', barcode: CODE }, { 'x-zoe-palm-token': session, 'x-zoe-id-token': tokenFor('u@zoew12345.com', { forge: true }) });
        expect(forged.statusCode).toBe(401);
        expect(palm).not.toHaveBeenCalled();
        const ok = await callWith({ palm: '1', barcode: CODE }, { 'x-zoe-palm-token': session, 'x-zoe-id-token': tokenForSite('12345') });
        expect(ok.statusCode).toBe(200);
        expect(JSON.parse(ok.body)).toMatchObject({ found: true, phone: '012345678' });
        expect(palm).toHaveBeenCalledTimes(1);
    });

    it('applies ZTO_DETAIL_BRANCH_PATHS to Palm rows (other branch or missing field ➜ no phone, no COD)', async () => {
        const { sessionToken: session } = await login();
        vi.stubEnv('ZTO_DETAIL_IDENTITY', 'require');
        vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT + ':12345|99999');
        vi.stubEnv('ZTO_DETAIL_BRANCH_PATHS', 'dispSiteCode');
        const headers = { 'x-zoe-palm-token': session, 'x-zoe-id-token': tokenForSite('12345') };
        for (const [row, found] of [[{ ...CODE_ROW, cod: 2, dispSiteCode: '12345' }, true], [{ ...CODE_ROW, cod: 2, dispSiteCode: '99999' }, false], [{ ...CODE_ROW, cod: 2 }, false]] as const) {
            vi.stubGlobal('fetch', withCerts(vi.fn(async () => upstream({ status: true, result: row }))));
            const body = JSON.parse((await callWith({ palm: '1', barcode: CODE }, headers)).body);
            expect(body.found).toBe(found);
            expect(body.branches).toBeUndefined();
            if (!found) {
                expect(body).toMatchObject({ code: 'ZTO_OTHER_BRANCH' });
                expect(body.phone).toBeUndefined();
                expect(body.cod).toBeUndefined();
            }
        }
    });

    it('settles a hung ZTO request inside the Function budget (ZTO_UPSTREAM_TIMEOUT_MS)', async () => {
        const { sessionToken: session } = await login();
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
        const pending = call({ palm: '1', barcode: CODE }, session);
        await vi.advanceTimersByTimeAsync(6000);
        const res = await pending;
        expect(JSON.parse(res.body).code).toBe('ZTO_TIMEOUT');
    });

    it('a Palm preflight never reads the Argus Cookie from Blobs; an Argus preflight still does', async () => {
        const reads: string[] = [];
        fn.setBlobsModuleForTests({
            connectLambda() {},
            getStore() { return { getWithMetadata: async () => { reads.push('read'); return null; }, get: async () => { reads.push('read'); return null; } }; }
        });
        try {
            fn.resetCachesForTests();
            await fn.handler({ httpMethod: 'OPTIONS', blobs: 'e30=', headers: { origin: 'https://localhost', 'access-control-request-headers': 'x-zoe-palm-token,x-zoe-proxy-key,x-zoe-query' } });
            await fn.handler({ httpMethod: 'OPTIONS', blobs: 'e30=', headers: { origin: 'https://localhost', 'access-control-request-headers': 'content-type,x-zoe-proxy-key' }, queryStringParameters: { palm: 'login' } });
            expect(reads).toEqual([]);
            await fn.handler({ httpMethod: 'OPTIONS', blobs: 'e30=', headers: { origin: 'https://localhost', 'access-control-request-headers': 'x-zoe-proxy-key,x-zoe-query' } });
            expect(reads.length).toBeGreaterThan(0);
        } finally {
            fn.setBlobsModuleForTests(null);
            fn.resetCachesForTests();
        }
    });
});
