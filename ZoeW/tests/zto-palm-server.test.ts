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

    it('🧪 អាន queryTrackInfo ពេញដោយ session Palm និងរក្សា lookup ធម្មតា', async () => {
        const { sessionToken: session } = await login();
        const tracks = { status: true, result: [{ mailNo: CODE, tracks: [{ action: '03', message: 'ក'.repeat(4000), siteCode: 'KH001', time: '2026-10-16 15:30:00', extra: { keep: true } }] }] };
        vi.stubGlobal('fetch', vi.fn(async (url) => upstream(String(url).endsWith('/queryTrackInfo')
            ? tracks : { status: true, result: { billCode: CODE, cod: 2 } })));
        const ordinary = JSON.parse((await call({ palm: '1', barcode: CODE }, session)).body);
        expect(ordinary).toMatchObject({ found: true, cod: 2, ztoClosed: null });
        expect(ordinary.queryTrackInfo).toBeUndefined();
        expect(fetch).toHaveBeenCalledTimes(1);
        vi.mocked(fetch).mockClear();
        const res = await call({ palm: '1', barcode: CODE, track: '1' }, session);
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ found: true, cod: 2, ztoClosed: null, queryTrackInfo: tracks });
        expect(res.headers['Cache-Control']).toBe('no-store');
        expect(fetch).toHaveBeenCalledTimes(2);
        const [url, init] = vi.mocked(fetch).mock.calls[1];
        expect(url).toBe('https://aargus-api.ztoglobal.net/zto/locus/v1/queryTrackInfo');
        expect(JSON.parse(String(init?.body))).toEqual({ mailType: 1, mailNos: CODE });
        expect(init?.headers).toMatchObject({ 'x-token': TOKEN, 'User-Agent': 'PDA' });
        const { createHash } = require('node:crypto');
        expect(init?.headers?.['x-sign']).toBe(createHash('md5').update(String(init?.body) + SIGN_KEY).digest('base64'));
        expect(res.body).not.toContain(TOKEN);
    });

    it('🧪 អាន field ដើមរបស់ Palm ទោះ mapping Cookie មិនស្គាល់', async () => {
        const { sessionToken: session } = await login();
        vi.stubEnv('ZTO_FIELD_COD', 'cookieOnlyCod');
        vi.stubEnv('ZTO_FIELD_DOD', 'cookieOnlyDod');
        const bill = { status: true, result: { billCode: CODE, palmAmount: 4.5, palmFreight: 1.25 } };
        const tracks = { status: true, result: [{ tracks: [] }] };
        vi.stubGlobal('fetch', vi.fn(async (url) => upstream(String(url).endsWith('/queryTrackInfo') ? tracks : bill)));
        const res = await call({ palm: '1', barcode: CODE, track: '1' }, session);
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ billInfoQuery: bill, queryTrackInfo: tracks });
        const ordinary = await call({ palm: '1', barcode: CODE }, session);
        expect(ordinary.statusCode).toBe(502);
    });

    it.each([401, 429, 500])('🧪 queryTrackInfo ផ្តល់ស្ថានភាពកំហុស HTTP %s', async (status) => {
        const { sessionToken: session } = await login();
        vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('/queryTrackInfo')
            ? upstream({}, status) : upstream({ status: true, result: { billCode: CODE, cod: 2 } })));
        const res = await call({ palm: '1', barcode: CODE, track: '1' }, session);
        expect(res.statusCode).toBe(status === 500 ? 502 : status);
        expect(JSON.parse(res.body).queryTrackInfo).toBeUndefined();
    });

    it.each([
        [0, [{ action: '4', at: '2026-10-16 08:02:24' }, { action: '-579', at: '2026-10-16 08:02:44' }], false, null],
        [1, [{ action: '5', at: '2026-10-16 09:40:57' }], true, '2026-10-16 09:40:57'],
        [0, [{ action: '5', at: '2026-10-14 09:40:57' }], false, null],
        [0, [{ action: '5', at: '2026-10-16 09:40:57' }], null, null],
        [1, [{ action: '5', at: '2026-10-16 09:40:57', site: 'OTHER' }], null, null],
        [1, [{ action: '5', at: '2026-10-14 09:40:57' }], null, null],
        ['1', [{ action: '5', at: '2026-10-16 09:40:57' }], null, null]
    ])('Palm ស្ថានភាព track ផ្ទៀងសាខា និង lifecycle (%s · %j)', async (isSign, extra, closed, signedAt) => {
        const { sessionToken: session } = await login();
        const tracks = [
            { action: '3', siteCode: 'KH001', mailNo: CODE, time: '2026-10-06 14:32:02' },
            { action: '3', siteCode: 'OTHER', mailNo: CODE, time: '2026-10-16 15:30:00' },
            { action: '3', siteCode: 'KH001', mailNo: CODE, time: '2026-10-15 08:03:42' },
            ...extra.map((t: any) => ({ action: t.action, siteCode: t.site || 'KH001', mailNo: CODE, time: t.at }))
        ].reverse();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: [{ mail: { mailNo: CODE, isSign }, tracks }] })));
        const res = await call({ palm: '1', barcode: CODE, status: '1' }, session);
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ found: true, provider: 'zto-palm', ztoClosed: closed,
            ztoArrivalAt: '2026-10-15 08:03:42', ztoSignedAt: signedAt });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://aargus-api.ztoglobal.net/zto/locus/v1/queryTrackInfo');
        expect(res.body).not.toContain(TOKEN);
        expect(JSON.parse(res.body).queryTrackInfo).toBeUndefined();
    });

    it.each([
        [],
        [{ mail: { mailNo: 'OTHER123456', isSign: 1 }, tracks: [{ action: '5', siteCode: 'KH001', mailNo: CODE, time: '2026-10-16 09:40:57' }] }],
        [{ mail: { mailNo: CODE, isSign: 1 }, tracks: [{ action: '5', siteCode: 'KH001', mailNo: 'OTHER123456', time: '2026-10-16 09:40:57' }] }],
        [{ mail: { mailNo: CODE, isSign: 1 }, tracks: [{ action: '5', siteCode: 'KH001', mailNo: CODE, time: '2026-02-30 09:40:57' }] }],
        [{ mail: { mailNo: CODE, isSign: 0 }, tracks: [] }],
        [{ mail: { mailNo: CODE, isSign: 0 }, tracks: null }],
        [{ mail: { mailNo: CODE, isSign: 0 }, tracks: [{ action: '3', siteCode: 'KH001', mailNo: CODE, time: '2026-10-15 08:03:42' }, null] }]
    ])('Palm track ទទេ/Barcode ខុស/ថ្ងៃខុស/ខូច ➜ unknown (%j)', async (...result) => {
        const { sessionToken: session } = await login();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result })));
        const res = await call({ palm: '1', barcode: CODE, status: '1' }, session);
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).ztoClosed).toBeNull();
    });

    it('Palm អាន cod និង dod ផ្ទាល់ ដោយមិនយក mapping Cookie មកជំនួស', async () => {
        const { sessionToken: session } = await login();
        vi.stubEnv('ZTO_FIELD_COD', 'cookieCod');
        vi.stubEnv('ZTO_FIELD_DOD', 'cookieDod');
        for (const [cod, dod] of [['2.49', '0.00'], ['4.90', '1.25'], ['0.00', '0.00']]) {
            vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: {
                consigneeMobile: '012345678', cod, dod, cookieCod: 999, cookieDod: 888
            } })));
            const body = JSON.parse((await call({ palm: '1', barcode: CODE }, session)).body);
            expect(body).toMatchObject({ found: true, cod: Number(cod), dod: Number(dod) });
        }
    });

    it('decrypts Palm phone data rather than passing ciphertext to the scan form', async () => {
        const { sessionToken: session } = await login();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: { consigneeMobile: 'BmhbP/Cn4387fL0qAljyew==', cod: 3, dod: 0.5 } })));
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

    it('never falls back to Argus list endpoints or the Argus Cookie with a Palm session', async () => {
        const { sessionToken: session } = await login();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: { list: [], pages: 0, total: 0 } })));
        const res = await call({ palm: '1', list: '1', signed: '1', from: '2026-10-10', to: '2026-10-16', page: '1' }, session);
        expect(res.statusCode).toBe(200);
        expect(vi.mocked(fetch).mock.calls.map((c) => String(c[0]))).toEqual(['https://aargus-api.ztoglobal.net/zto/dispatch/v1/queryDispatchList']);
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

    it('អាន cod/dod Palm ផ្ទាល់ និងរក្សាច្បាប់លេខ', async () => {
        const { sessionToken: session } = await login();
        const cases: Array<[Record<string, unknown>, number, number]> = [
            [{ ...CODE_ROW, cod: 0, agentAmount: 4.5, dod: 0, fcAmount: 1.25 }, 0, 0],
            [{ ...CODE_ROW, cod: true, codAmount: '2.5', dod: false, dodAmount: '0.75' }, 0, 0],
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

    it('status=1 ផ្ទៀងគណនី ZoeW ជាមួយសាខា session មុនអាន track', async () => {
        const { sessionToken: session } = await login();
        vi.stubEnv('ZTO_DETAIL_IDENTITY', 'require');
        vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT + ':12345|99999');
        const palm = vi.fn();
        vi.stubGlobal('fetch', withCerts(palm));
        const missing = await callWith({ palm: '1', barcode: CODE, status: '1' }, { 'x-zoe-palm-token': session });
        expect(missing.statusCode).toBe(401);
        const other = await callWith({ palm: '1', barcode: CODE, status: '1' },
            { 'x-zoe-palm-token': session, 'x-zoe-id-token': tokenForSite('12345') });
        expect(JSON.parse(other.body)).toMatchObject({ found: false, code: 'ZTO_OTHER_BRANCH' });
        expect(palm).not.toHaveBeenCalled();
    });

    it('🧪 មិនអាន track ពេលកញ្ចប់ជាសាខាផ្សេង ឬគ្មានសាខា', async () => {
        const { sessionToken: session } = await login();
        vi.stubEnv('ZTO_DETAIL_IDENTITY', 'require');
        vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT + ':12345|99999');
        vi.stubEnv('ZTO_DETAIL_BRANCH_PATHS', 'dispSiteCode');
        const headers = { 'x-zoe-palm-token': session, 'x-zoe-id-token': tokenForSite('12345') };
        for (const dispSiteCode of ['99999', undefined]) {
            const palm = vi.fn(async () => upstream({ status: true, result: { billCode: CODE, cod: 2, dispSiteCode } }));
            vi.stubGlobal('fetch', withCerts(palm));
            const res = await callWith({ palm: '1', barcode: CODE, track: '1' }, headers);
            expect(JSON.parse(res.body)).toMatchObject({ code: 'ZTO_OTHER_BRANCH' });
            expect(JSON.parse(res.body).queryTrackInfo).toBeUndefined();
            expect(palm).toHaveBeenCalledTimes(1);
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

describe('Palm list: sign list (billStatus 5) with the Argus list contract · no arrival list (A180)', () => {
    const READ_ONLY = new Set(['/zto/system/v1/doLogin', '/zto/basic/v1/billInfoQuery', '/zto/dispatch/v1/queryDispatchList', '/zto/locus/v1/queryTrackInfo']);
    const item = (billCode: string, billStatus: string, extra: Record<string, unknown> = {}) => ({
        billCode, billStatus, consigneeMobile: 'BmhbP/Cn4387fL0qAljyew==', cod: '2.5', dod: '0', dispEmpDate: '2026-10-15 09:30:00', ...extra
    });
    const page = (list: unknown[], extra: Record<string, unknown> = {}) => upstream({ status: true, result: { list, pages: 1, total: list.length, isLastPage: true, ...extra } });
    function serve(byStatus: Record<string, () => Response>) {
        const sent: Array<{ path: string; body: any }> = [];
        vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
            const path = new URL(String(url)).pathname;
            const body = JSON.parse(String(init.body));
            sent.push({ path, body });
            expect(READ_ONLY.has(path)).toBe(true);
            return (byStatus[path.endsWith('/queryTrackInfo') ? 'track:' + body.mailNos : body.billStatus] || (() => upstream({}, 500)))();
        }));
        return sent;
    }
    const listQuery = (extra: Record<string, string> = {}) => ({ palm: '1', list: '1', signed: '1', from: '2026-10-10', to: '2026-10-16', page: '1', ...extra });

    it('Palm ទាញបញ្ជីពេញ ៖ ច្រោះតាម action 3 ត្រូវសាខា និងថ្ងៃ · រួមកញ្ចប់ចុះហត្ថលេខា', async () => {
        const { sessionToken: session } = await login();
        const track = (code: string, isSign: number, scans: Array<[string, string, string]>) => () => upstream({ status: true,
            result: [{ mail: { mailNo: code, isSign }, tracks: scans.map(([action, siteCode, time]) => ({ action, siteCode, time, mailNo: code })) }] });
        const sent = serve({
            '1': () => page([item('KH0000000002', '1')]),
            '4': () => page([item('KH0000000001', '4'), item('KH0000000002', '4'), item('KH0000000003', '4')], { pages: 2 }),
            '5': () => page([item('KH0000000009', '5')]),
            'track:KH0000000001': track('KH0000000001', 0, [['2', 'OTHER', '2026-10-12 09:00:00']]),
            'track:KH0000000002': track('KH0000000002', 0, [['3', 'OTHER', '2026-10-13 09:00:00'], ['3', 'KH001', '2026-10-12 09:00:00'], ['4', 'KH001', '2026-10-15 09:00:00']]),
            'track:KH0000000003': track('KH0000000003', 0, [['3', 'KH001', '2026-10-11 09:00:00'], ['3', 'KH001', '2026-10-18 09:00:00']]),
            'track:KH0000000009': track('KH0000000009', 1, [['3', 'KH001', '2026-10-10 09:00:00'], ['5', 'KH001', '2026-10-16 09:40:57']])
        });
        const res = await call({ palm: '1', list: '1', withSigned: '1', from: '2026-10-10', to: '2026-10-16', page: '1' }, session);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toMatchObject({ enabled: true, kind: 'arrival', pages: 2, signedOk: true, site: 'KH001', signed: ['KH0000000009'] });
        expect(body.rows.map((r: any) => [r.barcode, r.at, r.ztoClosed])).toEqual([
            ['KH0000000002', '2026-10-12 09:00:00', false],
            ['KH0000000003', '2026-10-11 09:00:00', false],
            ['KH0000000009', '2026-10-10 09:00:00', true]
        ]);
        expect(body.rows[0]).toMatchObject({ phone: '012345678', cod: 2.5, dod: 0 });
        expect(body.signedRows[0]).toMatchObject({ barcode: 'KH0000000009', at: '2026-10-16 09:40:57' });
        expect(sent.filter((r) => r.path.endsWith('/queryTrackInfo'))).toHaveLength(4);
        const dispatch = sent.find((r) => r.body.billStatus === '4')!.body;
        expect(dispatch).toMatchObject({ pageNum: 1, pageSize: 5 });
        expect(dispatch.dispEmpDateFrom).toBeUndefined();
        expect(dispatch.dispEmpDateTo).toBeUndefined();
    });

    it.each([
        ['Shopee SHPE', '虾皮 SHPE', 'The pickup is【Shopee SHPE】', '', {}],
        ['ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ', '广州国际仓', '', '【ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ】បានស្កែនទទួល', {}],
        ['សាខាផ្សេង', 'សាខាផ្សេង', '', '', {}],
        ['Cookie origin', 'សាខាផ្សេង', '', '', { recSite: 'Cookie origin', customerCodeDesc: 'fallback' }],
        ['Other origin', 'សាខាផ្សេង', '', '', { recSite: '', customerCodeDesc: 'Other origin' }],
        ['', '', '', '', {}]
    ])('Palm រក្សាប្រភពដើម %s សម្រាប់មកដល់ និងចុះហត្ថលេខា', async (expected, siteName, msgEng, msgLoc, extra) => {
        const { sessionToken: session } = await login();
        const code = 'KH0000000001';
        const scan = (action: string, time: string, fields = {}) => ({ action, mailNo: code, time, siteCode: 'KH001', ...fields });
        const pickup = siteName ? [scan('1', '2026-10-09 09:00:00', { siteCode: 'ORIGIN', siteName, msgEng, msgLoc, countryCode: 'KH' })] : [];
        serve({ '1': () => page([]), '4': () => page([]), '5': () => page([item(code, '5', extra)]),
            ['track:' + code]: () => upstream({ status: true, result: [{ mail: { mailNo: code, isSign: 1 }, tracks: [
                scan('5', '2026-10-16 09:40:57'), scan('3', '2026-10-15 08:00:00'),
                scan('2', '2026-10-14 09:00:00', { siteCode: 'TRANSIT', siteName: 'Transit branch', preOrNextID: 'KH001' }), ...pickup
            ] }] }) });
        const res = await call(listQuery({ signed: '0' }), session);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.rows).toHaveLength(1);
        expect(body.rows[0].from).toBe(expected);
        expect(body.signedRows[0].from).toBe(expected);
    });

    it('Palm បញ្ជីច្រើន និង track យឺត ១.៥ វិនាទី ➜ ទំព័រត្រូវបញ្ចប់ក្នុងថវិកា Function', async () => {
        const { sessionToken: session } = await login();
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
            const payload = JSON.parse(init.body);
            const isTrack = String(url).endsWith('/queryTrackInfo');
            await new Promise((resolve) => setTimeout(resolve, 1500));
            if (!isTrack) return page(Array.from({ length: payload.pageSize }, (_, i) => item('KH' + payload.billStatus + String(i).padStart(10, '0'), payload.billStatus)), { pages: 10 });
            return upstream({ status: true, result: [{ mail: { mailNo: payload.mailNos, isSign: 0 }, tracks: [
                { action: '3', siteCode: 'KH001', time: '2026-10-16 09:00:00', mailNo: payload.mailNos }
            ] }] });
        }));
        const pending = call(listQuery({ signed: '0' }), session);
        await vi.advanceTimersByTimeAsync(12000);
        const response = await pending;
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).rows).toHaveLength(15);
    });

    it('Palm track ខ្វះឬបរាជ័យ ➜ មិនឆ្លើយជាបញ្ជីពេញហើយបាត់កញ្ចប់ស្ងាត់', async () => {
        const { sessionToken: session } = await login();
        serve({ '1': () => page([]), '4': () => page([item('KH0000000001', '4')]), '5': () => page([]),
            'track:KH0000000001': () => upstream({ status: true, result: [] }) });
        const res = await call({ palm: '1', list: '1', from: '2026-10-10', to: '2026-10-16', page: '1' }, session);
        expect(res.statusCode).toBe(502);
        expect(JSON.parse(res.body).rows).toBeUndefined();
    });

    it('sign list ➜ billStatus 5 over signSiteDate · only rows whose billStatus is 5 are evidence · Argus contract', async () => {
        const { sessionToken: session } = await login();
        const sent = serve({ '5': () => page([item('KH0000000009', '5'), item('KH0000000010', '4'), item('KH0000000009', '5'), item('bad code', '5'), null], { pages: 3, total: 41 }) });
        const body = JSON.parse((await call(listQuery(), session)).body);
        expect(sent).toHaveLength(1);
        expect(sent[0].path).toBe('/zto/dispatch/v1/queryDispatchList');
        expect(Object.keys(sent[0].body)).toEqual(['billStatus', 'signSiteDateFrom', 'signSiteDateTo', 'pageNum', 'pageSize']);
        expect(sent[0].body).toMatchObject({ billStatus: '5', signSiteDateFrom: '2026-10-10 00:00:00', pageNum: 1, pageSize: 100 });
        expect(sent[0].body.signSiteDateTo.endsWith(' 23:59:59')).toBe(true);
        expect(body).toMatchObject({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 3, total: 41,
            site: 'KH001', siteName: 'Test branch', rows: [], signedOk: true, signed: ['KH0000000009'], signedScans: 2, otherScans: 3, provider: 'zto-palm' });
        expect(body.signedRows).toEqual([{ barcode: 'KH0000000009', phone: '012345678', cod: 2.5, dod: 0, at: '', from: '' }]);
    });

    it('signed=1&exact=1 reads exactly the requested days; signed=1 alone reads the companion range', async () => {
        const { sessionToken: session } = await login();
        const sent = serve({ '5': () => page([item('KH0000000009', '5')]) });
        const exact = JSON.parse((await call(listQuery({ exact: '1', from: '2026-10-12', to: '2026-10-12' }), session)).body);
        expect(sent[0].body).toMatchObject({ billStatus: '5', signSiteDateFrom: '2026-10-12 00:00:00', signSiteDateTo: '2026-10-12 23:59:59' });
        expect(exact).toMatchObject({ kind: 'signed', signedOk: true, signed: ['KH0000000009'], rows: [] });
        await call(listQuery({ from: '2026-10-12', to: '2026-10-12' }), session);
        expect(sent[1].body.signSiteDateTo >= '2026-10-12 23:59:59').toBe(true);
    });

    it('expired session · ZTO refusal · bad range or page ➜ the same codes the App knows', async () => {
        const { sessionToken: session } = await login();
        serve({ '5': () => upstream({}, 401) });
        expect((await call(listQuery(), session)).statusCode).toBe(401);
        serve({ '5': () => upstream({ status: false, statusCode: 'SYS_BUSY' }) });
        expect(JSON.parse((await call(listQuery(), session)).body)).toEqual({ code: 'ZTO_UPSTREAM_REJECTED', reason: 'palm:SYS_BUSY' });
        serve({});
        expect(JSON.parse((await call(listQuery({ from: '2026-10-16', to: '2026-10-10' }), session)).body).code).toBe('ZTO_LIST_RANGE_INVALID');
        expect(JSON.parse((await call(listQuery({ page: '9' }), session)).body).code).toBe('ZTO_LIST_PAGE_INVALID');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('a full page without ZTO pages is never the last page (pagesUnknown)', async () => {
        const { sessionToken: session } = await login();
        const full = Array.from({ length: 100 }, (_, i) => item('KH' + String(1000000000 + i), '5'));
        serve({ '5': () => upstream({ status: true, result: { list: full } }) });
        const body = JSON.parse((await call(listQuery(), session)).body);
        expect(body).toMatchObject({ pages: 2, pagesUnknown: true });
    });

    it('a verified ZoeW account of another branch cannot read this Palm account\'s lists', async () => {
        const { sessionToken: session } = await login({ ...ACCOUNT, siteCode: '12345' });
        vi.stubEnv('ZTO_DETAIL_IDENTITY', 'require');
        vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT);
        const palm = vi.fn(async () => page([]));
        vi.stubGlobal('fetch', withCerts(palm));
        const other = await fn.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': session, 'x-zoe-id-token': tokenForSite('99999') },
            queryStringParameters: listQuery() });
        expect(JSON.parse(other.body)).toMatchObject({ enabled: false, code: 'ZTO_LIST_NOT_CONFIGURED', reason: 'site:palm-other-branch' });
        expect(palm).not.toHaveBeenCalled();
        const same = await fn.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': session, 'x-zoe-id-token': tokenForSite('12345') },
            queryStringParameters: listQuery() });
        expect(JSON.parse(same.body)).toMatchObject({ enabled: true, site: '12345' });
    });
});

describe('Palm keeps its ZTO connection between scans (owner: Palm on a new connection 0.91 s · reused 0.22 s · ZTO sends no Keep-Alive)', () => {
    const GLOBAL_DISPATCHER = Symbol.for('undici.globalDispatcher.1');
    const scanOk = () => upstream({ status: true, result: { billCode: CODE, consigneeMobile: '012345678', cod: '1', dod: '0' } });
    const stale = () => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' }) });
    let saved: unknown;
    beforeEach(() => { saved = (globalThis as any)[GLOBAL_DISPATCHER]; });
    afterEach(() => { (globalThis as any)[GLOBAL_DISPATCHER] = saved; });

    it('every Palm request goes through one Agent of the runtime\'s own HTTP client that keeps an idle connection 60 s', async () => {
        const built: any[] = [];
        class Agent { options: any; constructor(options: any) { this.options = options; built.push(this); } }
        (globalThis as any)[GLOBAL_DISPATCHER] = new Agent({});
        built.length = 0;
        const session = (await login()).sessionToken;
        vi.stubGlobal('fetch', vi.fn(async () => scanOk()));
        await call({ palm: '1', barcode: CODE }, session);
        await call({ palm: '1', barcode: CODE }, session);
        const inits = vi.mocked(fetch).mock.calls.map((c: any[]) => c[1]);
        expect(built).toHaveLength(1);
        expect(built[0].options).toEqual({ keepAliveTimeout: 60000, keepAliveMaxTimeout: 60000 });
        expect(inits.every((init: any) => init.dispatcher === built[0])).toBe(true);
    });

    it('fail-open: no runtime dispatcher yet, or one that is not a plain Agent ➜ the default client, exactly as before', async () => {
        const session = (await login()).sessionToken;
        for (const value of [undefined, new (class ProxyAgent {})(), { constructor: null }]) {
            (globalThis as any)[GLOBAL_DISPATCHER] = value;
            vi.stubGlobal('fetch', vi.fn(async () => scanOk()));
            expect((await call({ palm: '1', barcode: CODE }, session)).statusCode).toBe(200);
            expect((vi.mocked(fetch).mock.calls[0] as any[])[1].dispatcher).toBeUndefined();
        }
    });

    it('a kept connection ZTO already closed (UND_ERR_SOCKET) ➜ the scan and the list retry once on a new connection', async () => {
        const session = (await login()).sessionToken;
        let n = 0;
        vi.stubGlobal('fetch', vi.fn(async () => { n++; if (n === 1) throw stale(); return scanOk(); }));
        expect(JSON.parse((await call({ palm: '1', barcode: CODE }, session)).body)).toMatchObject({ found: true, phone: '012345678' });
        expect(fetch).toHaveBeenCalledTimes(2);
        n = 0;
        vi.stubGlobal('fetch', vi.fn(async () => { n++; if (n === 1) throw stale(); return upstream({ status: true, result: { list: [], pages: 1, total: 0 } }); }));
        expect((await call({ palm: '1', list: '1', signed: '1', from: '2026-10-15', to: '2026-10-16', page: '1' }, session)).statusCode).toBe(200);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('reverse: only once · never for Login · never for other failures', async () => {
        const session = (await login()).sessionToken;
        vi.stubGlobal('fetch', vi.fn(async () => { throw stale(); }));
        expect(JSON.parse((await call({ palm: '1', barcode: CODE }, session)).body).code).toBe('ZTO_UNAVAILABLE');
        expect(fetch).toHaveBeenCalledTimes(2);
        vi.stubGlobal('fetch', vi.fn(async () => { throw stale(); }));
        const result = await call({ palm: 'login' }, '', KEY, { username: 'palm-user', password: PASSWORD, deviceSn: 'zoew-test-device' });
        expect(JSON.parse(result.body).code).toBe('ZTO_UNAVAILABLE');
        expect(fetch).toHaveBeenCalledTimes(1);
        vi.stubGlobal('fetch', vi.fn(async () => { throw Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' }) }); }));
        expect(JSON.parse((await call({ palm: '1', barcode: CODE }, session)).body).code).toBe('ZTO_UNAVAILABLE');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('real HTTP client: a server without Keep-Alive (like ZTO) ➜ the default pool reconnects after 4 s idle, the Palm Agent reuses the connection', async () => {
        const diagnostics = require('node:diagnostics_channel');
        const http = require('node:http');
        const connects: Record<string, number> = {};
        const onConnect = (m: any) => { const port = String(m.connectParams.port); connects[port] = (connects[port] || 0) + 1; };
        diagnostics.channel('undici:client:connected').subscribe(onConnect);
        const serve = () => new Promise<any>((resolve) => {
            const server = http.createServer((req: any, res: any) => { req.resume(); req.on('end', () => { res.setHeader('Content-Length', '2'); res.end('ok'); }); });
            server.keepAliveTimeout = 0;
            server.listen(0, '127.0.0.1', () => resolve(server));
        });
        const plain = await serve();
        const palm = await serve();
        vi.unstubAllGlobals();
        try {
            const post = (server: any, init: object = {}) => fetch('http://127.0.0.1:' + server.address().port + '/x', { method: 'POST', body: '{}', ...init }).then((r) => r.text());
            await post(plain);
            const dispatcher = require('../netlify/functions/_shared/zto-palm').palmDispatcher();
            expect(dispatcher).toBeTruthy();
            await post(palm, { dispatcher });
            await new Promise((resolve) => setTimeout(resolve, 4600));
            const head = await fetch('http://127.0.0.1:' + plain.address().port + '/x', { method: 'POST', body: '{}' });
            expect(head.headers.get('keep-alive')).toBeNull();
            await head.text();
            await post(palm, { dispatcher });
            expect(connects[String(plain.address().port)]).toBe(2);
            expect(connects[String(palm.address().port)]).toBe(1);
        } finally {
            diagnostics.channel('undici:client:connected').unsubscribe(onConnect);
            plain.close();
            palm.close();
        }
    }, 20000);
});
