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

    it.each([
        ['ត្រឡប់ក្រោយមកដល់ (លំដាប់ពិត ៖ 3 ➜ 4 ➜ -579 ➜ -585 ➜ -710 ➜ 2)', [['3', 'KH001', '2026-10-16 15:29:45'], ['4', 'KH001', '2026-10-16 15:30:16'],
            ['-579', 'KH001', '2026-10-16 15:32:44'], ['-585', 'KH001', '2026-10-17 07:57:13'], ['-710', 'KH001', '2026-10-17 08:00:34'],
            ['2', 'KH001', '2026-10-17 08:05:40']], '2026-10-17 08:00:34'],
        ['ត្រឡប់ហើយមកដល់ម្តងទៀត', [['3', 'KH001', '2026-10-14 09:00:00'], ['-710', 'KH001', '2026-10-14 12:00:00'], ['3', 'KH001', '2026-10-16 09:00:00']], null],
        ['-710 នៅសាខាផ្សេង', [['3', 'KH001', '2026-10-16 09:00:00'], ['-710', 'OTHER', '2026-10-17 09:00:00']], null]
    ])('↩️ status=1 ៖ %s ➜ `ztoReturnedAt`', async (_name, scans: any, returnedAt) => {
        const { sessionToken: session } = await login();
        const tracks = (scans as string[][]).map(([action, site, time]) => ({ action, siteCode: site, mailNo: CODE, time })).reverse();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: [{ mail: { mailNo: CODE, isSign: 0 }, tracks }] })));
        const res = await call({ palm: '1', barcode: CODE, status: '1' }, session);
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ found: true, ztoClosed: false, ztoReturnedAt: returnedAt });
    });

    it('↩️ status=1 ៖ ZTO ចុះហត្ថលេខា (`isSign: 1`) ក្រោយមកដល់ ➜ បិទ · មិនមែនត្រឡប់ ទោះមាន -710', async () => {
        const { sessionToken: session } = await login();
        const tracks = [['3', '2026-10-16 09:00:00'], ['-710', '2026-10-16 12:00:00'], ['5', '2026-10-17 09:00:00']]
            .map(([action, time]) => ({ action, siteCode: 'KH001', mailNo: CODE, time })).reverse();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: [{ mail: { mailNo: CODE, isSign: 1 }, tracks }] })));
        const res = await call({ palm: '1', barcode: CODE, status: '1' }, session);
        expect(JSON.parse(res.body)).toMatchObject({ ztoClosed: true, ztoReturnedAt: null });
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

    const candidatesQuery = (extra: Record<string, string> = {}) => listQuery({ signed: '0', candidates: '1', ...extra });
    const tracksQuery = (codes: string[], extra: Record<string, string> = {}) => listQuery({ signed: '0', tracks: codes.join(','), ...extra });
    const scansOf = (code: string, mail: Record<string, unknown>, scans: Array<[string, string, string]>) => ({ mail: { mailNo: code, ...mail },
        tracks: scans.map(([action, siteCode, time]) => ({ action, siteCode, time, mailNo: code })) });
    const track = (code: string, isSign: number, scans: Array<[string, string, string]>) => () => upstream({ status: true, result: [scansOf(code, { isSign }, scans)] });

    it('Palm បេក្ខភាព ៖ tab បញ្ហា · បញ្ជូន · ចុះហត្ថលេខា ១០០ ជួរក្នុងមួយទំព័រ · លេខទូរស័ព្ទ/COD/DOD · គ្មាន track', async () => {
        const { sessionToken: session } = await login();
        const sent = serve({
            '1': () => page([item('KH0000000002', '1')]),
            '4': () => page([item('KH0000000001', '4'), item('KH0000000002', '4'), item('KH0000000003', '4'), item('bad code', '4')], { pages: 2 }),
            '5': () => page([item('KH0000000009', '5', { recSite: 'Cookie origin' })])
        });
        const res = await call(candidatesQuery({ withSigned: '1' }), session);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toMatchObject({ enabled: true, kind: 'candidates', pages: 2, tabPages: { '1': 1, '4': 2, '4d': 2, '5': 1 }, site: 'KH001', rows: [], otherScans: 1 });
        expect(body.candidates.map((c: any) => c.barcode)).toEqual(['KH0000000002', 'KH0000000001', 'KH0000000003', 'KH0000000009']);
        expect(body.candidates[0]).toEqual({ barcode: 'KH0000000002', phone: '012345678', cod: 2.5, dod: 0, from: '' });
        expect(body.candidates[3].from).toBe('Cookie origin');
        expect(sent.filter((r) => r.path.endsWith('/queryTrackInfo'))).toHaveLength(0);
        const dispatches = sent.filter((r) => r.body.billStatus === '4').map((r) => r.body);
        expect(dispatches, 'tab «បញ្ជូន» ២ ៖ គ្មានថ្ងៃ (កញ្ចប់ចាត់មុនចន្លោះ) · តាម `dispEmpDate` ដូច App Palm (ម្ចាស់គម្រោង ៖ កញ្ចប់មកដល់រសៀលខ្វះ)').toHaveLength(2);
        const undated = dispatches.find((b) => b.dispEmpDateFrom === undefined)!;
        expect(undated).toMatchObject({ pageNum: 1, pageSize: 100 });
        expect(undated.dispEmpDateTo).toBeUndefined();
        const signedBody = sent.find((r) => r.body.billStatus === '5')!.body;
        expect(signedBody).toMatchObject({ signSiteDateFrom: '2026-10-10 00:00:00' });
        expect(dispatches.find((b) => b.dispEmpDateFrom !== undefined)).toMatchObject({ pageNum: 1, pageSize: 100,
            dispEmpDateFrom: '2026-10-10 00:00:00', dispEmpDateTo: signedBody.signSiteDateTo });
    });

    it('Palm track ៖ ច្រោះ action 3 ត្រូវសាខា និងថ្ងៃ · ចុះហត្ថលេខាក្នុងចន្លោះ · ពេល ZTO ឆ្លើយ track ម្តងមួយលេខ', async () => {
        const { sessionToken: session } = await login();
        const sent = serve({
            'track:KH0000000001': track('KH0000000001', 0, [['2', 'OTHER', '2026-10-12 09:00:00']]),
            'track:KH0000000002': track('KH0000000002', 0, [['3', 'OTHER', '2026-10-13 09:00:00'], ['3', 'KH001', '2026-10-12 09:00:00'], ['4', 'KH001', '2026-10-15 09:00:00']]),
            'track:KH0000000003': track('KH0000000003', 0, [['3', 'KH001', '2026-10-11 09:00:00'], ['3', 'KH001', '2026-10-18 09:00:00']]),
            'track:KH0000000009': track('KH0000000009', 1, [['3', 'KH001', '2026-10-10 09:00:00'], ['5', 'KH001', '2026-10-16 09:40:57']])
        });
        const codes = ['KH0000000001', 'KH0000000002', 'KH0000000003', 'KH0000000009'];
        const body = JSON.parse((await call(tracksQuery(codes), session)).body);
        expect(body).toMatchObject({ enabled: true, kind: 'tracks', rows: [], unverified: [], unverifiedReasons: [] });
        expect(body.evidence.map((e: any) => [e.barcode, e.arrivals, e.ztoClosed, e.signedAt])).toEqual([
            ['KH0000000001', [], null, ''],
            ['KH0000000002', ['2026-10-12 09:00:00'], false, ''],
            ['KH0000000003', ['2026-10-11 09:00:00'], false, ''],
            ['KH0000000009', ['2026-10-10 09:00:00'], true, '2026-10-16 09:40:57']
        ]);
        expect(JSON.stringify(body)).not.toContain('012345678');
        const tracks = sent.filter((r) => r.path.endsWith('/queryTrackInfo'));
        expect(tracks.map((r) => r.body.mailNos).sort()).toEqual(codes);
        expect(tracks.every((r) => typeof r.body.mailNos === 'string' && r.body.mailType === 1)).toBe(true);
        expect(body.trackCalls).toBe(4);
        expect(body.trackWaitMs).toBeGreaterThanOrEqual(0);
    });

    it('Palm track ផ្ញើម្តងមួយ Barcode ជានិច្ច (ZTO មិនឆ្លើយ mailNos ច្រើនលេខ) ៖ សំណើមិនលើស Barcode · ស្របគ្នា ≤ ៨', async () => {
        const { sessionToken: session } = await login();
        const codes = Array.from({ length: 30 }, (_, i) => 'KH' + String(3000000000 + i));
        let inFlight = 0;
        let peak = 0;
        const sent: string[] = [];
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
            const payload = JSON.parse(init.body);
            sent.push(String(payload.mailNos));
            inFlight++;
            peak = Math.max(peak, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 5));
            inFlight--;
            return upstream({ status: true, result: [scansOf(payload.mailNos, { isSign: 0 }, [['3', 'KH001', '2026-10-12 09:00:00']])] });
        }));
        const body = JSON.parse((await call(tracksQuery(codes), session)).body);
        expect(sent.slice().sort()).toEqual(codes);
        expect(sent.every((m) => !m.includes(','))).toBe(true);
        expect(peak).toBe(8);
        expect(body.trackCalls).toBe(30);
        expect(body.evidence).toHaveLength(30);
    });

    it.each([
        ['Shopee SHPE', '虾皮 SHPE', 'The pickup is【Shopee SHPE】', ''],
        ['ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ', '广州国际仓', '', '【ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ】បានស្កែនទទួល'],
        ['សាខាផ្សេង', 'សាខាផ្សេង', '', ''],
        ['', '', '', '']
    ])('Palm track រក្សាប្រភពដើម %s (កន្លែងទទួលដើម action 1 · មិនមែនសាខាដឹកបន្ត)', async (expected, siteName, msgEng, msgLoc) => {
        const { sessionToken: session } = await login();
        const code = 'KH0000000001';
        const scan = (action: string, time: string, fields = {}) => ({ action, mailNo: code, time, siteCode: 'KH001', ...fields });
        const pickup = siteName ? [scan('1', '2026-10-09 09:00:00', { siteCode: 'ORIGIN', siteName, msgEng, msgLoc, countryCode: 'KH' })] : [];
        serve({ ['track:' + code]: () => upstream({ status: true, result: [{ mail: { mailNo: code, isSign: 1 }, tracks: [
            scan('5', '2026-10-16 09:40:57'), scan('3', '2026-10-15 08:00:00'),
            scan('2', '2026-10-14 09:00:00', { siteCode: 'TRANSIT', siteName: 'Transit branch', preOrNextID: 'KH001' }), ...pickup
        ] }] }) });
        const body = JSON.parse((await call(tracksQuery([code]), session)).body);
        expect(body.evidence[0]).toMatchObject({ from: expected, arrivals: ['2026-10-15 08:00:00'], ztoClosed: true, signedAt: '2026-10-16 09:40:57' });
    });

    it.each([{}, { mailNo: 'KH0000000001' }, { mail: { mailNo: 'KH0000000001' } },
        { mail: { mailNo: 'KH0000000001', isSign: null } }])('Palm track មានភស្តុតាងមកដល់ តែ metadata ចុះហត្ថលេខាអវត្តមាន ➜ មិនបិទបញ្ជី (%j)', async (metadata) => {
        const { sessionToken: session } = await login();
        serve({ 'track:KH0000000001': () => upstream({ status: true, result: [{ ...metadata, tracks: [
            { action: '3', siteCode: 'KH001', time: '2026-10-16 09:00:00', mailNo: 'KH0000000001' }
        ] }] }) });
        const body = JSON.parse((await call(tracksQuery(['KH0000000001']), session)).body);
        expect(body.evidence).toMatchObject([{ barcode: 'KH0000000001', arrivals: ['2026-10-16 09:00:00'], ztoClosed: null, signedAt: '' }]);
    });

    it('Palm បញ្ជីទទេមាន total=0/pages=0 និង list=null ➜ ទំព័រទទេត្រឹមត្រូវ', async () => {
        const { sessionToken: session } = await login();
        serve({ '1': () => upstream({ status: true, result: { list: null, total: 0, pages: 0 } }), '4': () => page([]), '5': () => page([]) });
        const response = await call(candidatesQuery(), session);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({ candidates: [], tabPages: { '1': 0, '4': 1, '5': 1 } });
    });

    it.each([
        [{ list: null, total: 2, pages: 1 }, '2'],
        [{ total: 2, pages: 1 }, '2'],
        [{ list: null, total: 0, pages: 1 }, '1'],
        [{ total: 0, pages: 1 }, '1'],
        [{ list: null, total: '0', pages: '1' }, '1']
    ])('Palm tab អស់ទំព័រមុន ➜ list ទទេមិនបិទការទាញ (%j)', async (result, requestedPage) => {
        const { sessionToken: session } = await login();
        serve({ '1': () => page([]), '4': () => page([item('KH0000000001', '4')], { pages: 4 }), '5': () => upstream({ status: true, result }) });
        const response = await call(candidatesQuery({ page: requestedPage }), session);
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toMatchObject({ pages: 4, candidates: [{ barcode: 'KH0000000001' }] });
    });

    it.each([false, ''])('Palm pagination ខូច (%j) មិនត្រូវចាត់ទុកជា pages=0 ហើយបាត់បញ្ជី', async (pages) => {
        const { sessionToken: session } = await login();
        serve({ '1': () => page([]), '4': () => page([]), '5': () => upstream({ status: true, result: { list: null, pages, total: 2 } }) });
        const response = await call(candidatesQuery(), session);
        expect(response.statusCode).toBe(502);
        expect(JSON.parse(response.body).reason).toBe('palm:list-5-items-null-p1');
    });

    it('ZTO បម្រើតិចជាង pageSize ដែលស្នើ (pageSize 20 · គ្មាន pages) ➜ ទំព័រពេញមិនមែនទំព័រចុងក្រោយ', async () => {
        const { sessionToken: session } = await login();
        const twenty = Array.from({ length: 20 }, (_, i) => item('KH' + String(1000000000 + i), '4'));
        serve({ '1': () => page([]), '5': () => page([]), '4': () => upstream({ status: true, result: { list: twenty, pageSize: 20 } }) });
        const body = JSON.parse((await call(candidatesQuery(), session)).body);
        expect(body.tabPages['4']).toBe(2);
        expect(body.candidates).toHaveLength(20);
    });

    it.each([
        [[], 'palm:track-empty'],
        [[{ mail: { mailNo: 'OTHER0000001', isSign: 0 }, tracks: [] }], 'palm:track-identity'],
        [[{ mail: { mailNo: 'KH0000000001', isSign: 0 }, tracks: [
            { action: '3', siteCode: 'KH001', time: null, mailNo: 'KH0000000001' }
        ] }], 'palm:track-time']
    ])('Palm track មួយកញ្ចប់ខូច ➜ track ផ្សេងនៅតែមក · Barcode នោះ «ផ្ទៀងមិនបាន» ជាមួយកូដមូលហេតុ (%s)', async (result, reason) => {
        const { sessionToken: session } = await login();
        serve({ 'track:KH0000000001': () => upstream({ status: true, result }),
            'track:KH0000000002': track('KH0000000002', 0, [['3', 'KH001', '2026-10-16 09:00:00']]) });
        const response = await call(tracksQuery(['KH0000000001', 'KH0000000002']), session);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.evidence.map((e: any) => e.barcode)).toEqual(['KH0000000002']);
        expect(body).toMatchObject({ unverified: ['KH0000000001'], unverifiedReasons: [reason] });
    });

    it('Palm list ខូច ➜ ប្រាប់ប្រភេទបញ្ជី និង field ខូច ដោយមិនបង្ហាញ response ដើម', async () => {
        const { sessionToken: session } = await login();
        serve({ '1': () => upstream({ status: true, result: { total: 2, list: null } }), '4': () => page([]), '5': () => page([]) });
        const response = await call(candidatesQuery(), session);
        expect(response.statusCode).toBe(502);
        expect(JSON.parse(response.body)).toEqual({ code: 'ZTO_INVALID_RESPONSE', reason: 'palm:list-1-items-null-p1' });
    });

    it('Palm track ៣០ កញ្ចប់ និង ZTO យឺត ១.៥ វិនាទី ➜ ចប់ក្នុងថវិកា Function (ស្របគ្នា)', async () => {
        const { sessionToken: session } = await login();
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
            const payload = JSON.parse(init.body);
            await new Promise((resolve) => setTimeout(resolve, 1500));
            return upstream({ status: true, result: [scansOf(payload.mailNos, { isSign: 0 }, [['3', 'KH001', '2026-10-16 09:00:00']])] });
        }));
        const codes = Array.from({ length: 30 }, (_, i) => 'KH' + String(2000000000 + i));
        const pending = call(tracksQuery(codes), session);
        await vi.advanceTimersByTimeAsync(9000);
        const response = await pending;
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).evidence).toHaveLength(30);
    });

    it('🏢 ឈ្មោះសាខា ៖ Login ឆ្លើយ siteName ទទេ ➜ tracks ឆ្លើយឈ្មោះពីស្កេនសាខាខ្លួន (ដូច scanSite របស់ Cookie) · មិនយកសាខាផ្សេង', async () => {
        const { sessionToken: session } = await login({ ...ACCOUNT, siteName: '' });
        const code = 'KH0000000007';
        serve({ ['track:' + code]: () => upstream({ status: true, result: [{ mail: { mailNo: code, isSign: 0 }, tracks: [
            { action: '2', mailNo: code, time: '2026-10-15 07:00:00', siteCode: 'HUB', siteName: 'មជ្ឈមណ្ឌលដឹកបន្ត' },
            { action: '3', mailNo: code, time: '2026-10-16 09:00:00', siteCode: 'KH001', siteName: '  សាខាភ្នំពេញ ១ ' }
        ] }] }) });
        const body = JSON.parse((await call(tracksQuery([code]), session)).body);
        expect(body.siteName).toBe('សាខាភ្នំពេញ ១');
        const other = 'KH0000000008';
        serve({ ['track:' + other]: () => upstream({ status: true, result: [{ mail: { mailNo: other, isSign: 0 }, tracks: [
            { action: '2', mailNo: other, time: '2026-10-15 07:00:00', siteCode: 'HUB', siteName: 'មជ្ឈមណ្ឌលដឹកបន្ត' }
        ] }] }) });
        expect(JSON.parse((await call(tracksQuery([other]), session)).body).siteName).toBe('');
        const named = await login();
        serve({ ['track:' + code]: () => upstream({ status: true, result: [{ mail: { mailNo: code, isSign: 0 }, tracks: [
            { action: '3', mailNo: code, time: '2026-10-16 09:00:00', siteCode: 'KH001', siteName: 'ឈ្មោះផ្សេង' }
        ] }] }) });
        expect(JSON.parse((await call(tracksQuery([code]), named.sessionToken)).body).siteName, 'ឈ្មោះពី Login នៅមុន').toBe('Test branch');
    });

    it('Palm track ខ្វះឬបរាជ័យ ➜ មិនបាត់កញ្ចប់ស្ងាត់ ៖ Barcode ក្នុង unverified · ZTO 5xx សាកម្តងទៀតមួយដង', async () => {
        const { sessionToken: session } = await login();
        const sent = serve({ 'track:KH0000000001': () => upstream({}, 502) });
        const res = await call(tracksQuery(['KH0000000001']), session);
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ evidence: [], unverified: ['KH0000000001'], unverifiedReasons: ['palm:unavailable'], trackCalls: 2 });
        expect(sent.filter((r) => r.path.endsWith('/queryTrackInfo'))).toHaveLength(2);
    });

    it('Palm tabs=4 អានតែប្រភេទដែលនៅមានទំព័រ · tracks អានតែ Barcode ដែលស្នើ · តម្លៃខុស ➜ 400 មុនហៅ ZTO', async () => {
        const { sessionToken: session } = await login();
        const sent = serve({ '4': () => page([item('KH0000000001', '4'), item('KH0000000002', '4')], { pages: 3 }),
            'track:KH0000000002': track('KH0000000002', 0, [['3', 'KH001', '2026-10-16 09:00:00']]) });
        const body = JSON.parse((await call(candidatesQuery({ page: '2', tabs: '4' }), session)).body);
        expect(sent.map((r) => r.body.billStatus)).toEqual(['4']);
        expect(body).toMatchObject({ tabPages: { '4': 3 }, pages: 3 });
        sent.length = 0;
        await call(tracksQuery(['KH0000000002']), session);
        expect(sent.map((r) => r.body.mailNos)).toEqual(['KH0000000002']);
        sent.length = 0;
        const thirtyOne = Array.from({ length: 31 }, (_, i) => 'KH' + String(3000000000 + i)).join(',');
        for (const bad of [{ candidates: '1', tabs: '4,9' }, { candidates: '1', tabs: '4,4' }, { tracks: 'bad code' }, { tracks: 'KH0000000001,kh0000000001' },
            { tracks: thirtyOne }, { tracks: '' }, {}]) {
            expect((await call(listQuery({ signed: '0', ...bad }), session)).statusCode).toBe(400);
        }
        expect(sent).toEqual([]);
    });

    it('Palm សញ្ញាចុះហត្ថលេខា ៖ ស្កេន 5 សាខាខ្លួនក្រោយមកដល់ = បិទ (ដូចបញ្ជី 05 របស់ Cookie) · isSign=0 ផ្ទុយ ➜ null · សាខាផ្សេង ➜ មិនបិទ', async () => {
        const { sessionToken: session } = await login();
        const at = (code: string, mail: Record<string, unknown>, scans: Array<[string, string, string]>) => () => upstream({ status: true, result: [scansOf(code, mail, scans)] });
        serve({
            'track:KH0000000001': at('KH0000000001', {}, [['3', 'KH001', '2026-10-15 09:00:00'], ['5', 'KH001', '2026-10-16 09:00:00']]),
            'track:KH0000000002': at('KH0000000002', { isSign: 0 }, [['3', 'KH001', '2026-10-15 09:00:00'], ['5', 'KH001', '2026-10-16 09:00:00']]),
            'track:KH0000000003': at('KH0000000003', { isSign: 1 }, [['3', 'KH001', '2026-10-15 09:00:00'], ['5', 'OTHER', '2026-10-16 09:00:00']]),
            'track:KH0000000004': at('KH0000000004', { isSign: '0' }, [['3', 'KH001', '2026-10-15 09:00:00']]) });
        const codes = ['KH0000000001', 'KH0000000002', 'KH0000000003', 'KH0000000004'];
        const body = JSON.parse((await call(tracksQuery(codes), session)).body);
        expect(body.evidence.map((e: any) => [e.barcode, e.ztoClosed, e.signedAt])).toEqual([
            ['KH0000000001', true, '2026-10-16 09:00:00'], ['KH0000000002', null, ''], ['KH0000000003', null, ''], ['KH0000000004', false, '']]);
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

describe('Palm Login ឡើងវិញនៅ background (សំណើម្ចាស់គម្រោង ៖ «អោយ Palm login នៅ background ខ្លួនឯងពេលបើក app ZoeW ដើម្បីការពារ session»)', () => {
    const refresh = (refreshToken: unknown, key = KEY, extra: Record<string, string> = {}) => fn.handler({
        httpMethod: 'POST', headers: { 'x-zoe-proxy-key': key, ...extra }, queryStringParameters: { palm: 'refresh' },
        body: JSON.stringify({ refreshToken })
    });
    const loginBody = () => JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));

    it('Login ផ្តល់ refreshToken ដែល Server បិទ (AES-GCM) ៖ គ្មានពាក្យសម្ងាត់ · ឈ្មោះគណនី · token ZTO អានបាន', async () => {
        const body = await login();
        expect(body.refreshToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
        const raw = Buffer.from(body.refreshToken, 'base64url').toString('latin1');
        for (const secret of [PASSWORD, 'palm-user', TOKEN, 'zoew-test-device', loginBody().password]) {
            expect(body.refreshToken).not.toContain(secret);
            expect(raw).not.toContain(secret);
        }
    });

    it('refreshToken ➜ Login ZTO ដោយគណនីដដែល (ពាក្យសម្ងាត់អ៊ិនគ្រីបដូច Login · deviceSn ដដែល) ➜ session ថ្មីប្រើបាន · refreshToken ថ្មី', async () => {
        const first = await login();
        const sentAtLogin = loginBody();
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: { ...ACCOUNT, token: 'renewed-palm-token' } })));
        const res = await refresh(first.refreshToken);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        const sent = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
        expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://aargus-api.ztoglobal.net/zto/system/v1/doLogin');
        expect(sent).toEqual(sentAtLogin);
        expect(body).toMatchObject({ success: true, account: { siteCode: 'KH001', siteName: 'Test branch' } });
        expect(body.refreshToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
        expect(body.refreshToken).not.toBe(first.refreshToken);
        expect(JSON.stringify(body)).not.toContain('renewed-palm-token');
        expect(JSON.stringify(body)).not.toContain('palm-user');
        const tokens: string[] = [];
        vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
            tokens.push(init.headers['x-token']);
            return upstream({ status: true, result: { consigneeMobile: '012345678', cod: 1, dod: 0 } });
        }));
        expect((await call({ palm: '1', barcode: CODE }, body.sessionToken)).statusCode).toBe(200);
        expect(tokens).toEqual(['renewed-palm-token']);
    });

    it('refreshToken ថ្មីពន្យារអាយុ ៣០ ថ្ងៃ ៖ ប្រើបន្តបានរហូតពេលប្រើយ៉ាងហោចម្តងក្នុង ៣០ ថ្ងៃ', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
        let token = (await login()).refreshToken;
        for (let day = 1; day <= 3; day++) {
            vi.setSystemTime(new Date(Date.parse('2026-10-01T00:00:00Z') + day * 29 * 86400000));
            vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: ACCOUNT })));
            const res = await refresh(token);
            expect(res.statusCode, 'ថ្ងៃ ' + day * 29).toBe(200);
            token = JSON.parse(res.body).refreshToken;
        }
        vi.setSystemTime(new Date(Date.now() + 30 * 86400000 + 1));
        vi.stubGlobal('fetch', vi.fn());
        const stale = await refresh(token);
        expect(stale.statusCode).toBe(401);
        expect(JSON.parse(stale.body).code).toBe('ZTO_PALM_REFRESH_INVALID');
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each(['other-proxy-key', 'tampered', 'session-token', 'missing', 'rotated-secret'])('refreshToken %s ➜ 401 ZTO_PALM_REFRESH_INVALID មុនផ្ញើទៅ ZTO', async (kind) => {
        const body = await login();
        let token = body.refreshToken;
        let key = KEY;
        if (kind === 'other-proxy-key') { vi.stubEnv('ZTO_PROXY_KEYS', 'other=' + OTHER_KEY); key = OTHER_KEY; }
        if (kind === 'tampered') token = token.slice(0, -8) + 'AAAAAAAA';
        if (kind === 'session-token') token = body.sessionToken;
        if (kind === 'missing') token = undefined;
        if (kind === 'rotated-secret') vi.stubEnv('ZTO_PALM_SESSION_SECRET', 'another-server-session-secret-at-least-32-characters');
        vi.stubGlobal('fetch', vi.fn());
        const res = await refresh(token, key);
        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body).code).toBe('ZTO_PALM_REFRESH_INVALID');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('refreshToken មិនមែនជា session ៖ ប្រើជា X-Zoe-Palm-Token ➜ 401 ZTO_AUTH_EXPIRED មុនផ្ញើទៅ ZTO', async () => {
        const body = await login();
        vi.stubGlobal('fetch', vi.fn());
        const res = await call({ palm: '1', barcode: CODE }, body.refreshToken);
        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body).code).toBe('ZTO_AUTH_EXPIRED');
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each([
        [{ status: false, statusCode: 'login_password_error' }, 401, 'ZTO_PALM_LOGIN_REJECTED'],
        [{ status: false, statusCode: 'risk_control_account_captcha_err' }, 401, 'ZTO_PALM_VERIFICATION_REQUIRED'],
        [{ status: true, result: { ...ACCOUNT, countryCode: 'VN' } }, 403, 'ZTO_PALM_COUNTRY_UNSUPPORTED']
    ])('ZTO បដិសេធពេល Login ឡើងវិញ (ឧ. ប្តូរពាក្យសម្ងាត់) ➜ កូដដដែលនឹង Login (%j)', async (answer, status, code) => {
        const body = await login();
        vi.stubGlobal('fetch', vi.fn(async () => upstream(answer)));
        const res = await refresh(body.refreshToken);
        expect(res.statusCode).toBe(status);
        expect(JSON.parse(res.body).code).toBe(code);
        expect(JSON.parse(res.body).sessionToken).toBeUndefined();
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('ZTO_DETAIL_IDENTITY=require ៖ Login ឡើងវិញត្រូវការគណនី ZoeW ដែលកំពុងចូល មុនផ្ញើទៅ ZTO (ដូច Login)', async () => {
        const body = await login();
        vi.stubEnv('ZTO_DETAIL_IDENTITY', 'require');
        vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT);
        const palm = vi.fn(async () => upstream({ status: true, result: { ...ACCOUNT, siteCode: '12345' } }));
        vi.stubGlobal('fetch', withCerts(palm));
        const refused = await refresh(body.refreshToken);
        expect(JSON.parse(refused.body)).toMatchObject({ code: 'ZTO_IDENTITY_REQUIRED', reason: 'idtoken:missing' });
        expect(palm).not.toHaveBeenCalled();
        const ok = await refresh(body.refreshToken, KEY, { 'x-zoe-id-token': tokenForSite('12345') });
        expect(ok.statusCode).toBe(200);
        expect(palm).toHaveBeenCalledTimes(1);
        const other = await refresh(body.refreshToken, KEY, { 'x-zoe-id-token': tokenForSite('67890') });
        expect(other.statusCode, 'គណនី Palm ជាសាខាផ្សេងពីគណនី ZoeW ➜ មិនចេញ session').toBe(403);
        expect(JSON.parse(other.body)).toMatchObject({ code: 'ZTO_OTHER_BRANCH', reason: 'site:palm-other-branch' });
        expect(JSON.parse(other.body).sessionToken).toBeUndefined();
    });

    it('preflight ?palm=refresh ជា Palm ៖ មិនអាន Cookie Argus ពី Blobs · អនុញ្ញាត POST', async () => {
        const reads: string[] = [];
        fn.setBlobsModuleForTests({
            connectLambda() {},
            getStore() { return { getWithMetadata: async () => { reads.push('read'); return null; }, get: async () => { reads.push('read'); return null; } }; }
        });
        try {
            fn.resetCachesForTests();
            const pre = await fn.handler({ httpMethod: 'OPTIONS', blobs: 'e30=', headers: { origin: 'https://localhost',
                'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-zoe-proxy-key' }, queryStringParameters: { palm: 'refresh' } });
            expect(pre.headers['Access-Control-Allow-Methods']).toContain('POST');
            expect(reads).toEqual([]);
        } finally {
            fn.setBlobsModuleForTests(null);
            fn.resetCachesForTests();
        }
    });

    it('?palm=refresh តែ POST · តួធំពេក ➜ បដិសេធមុនផ្ញើទៅ ZTO', async () => {
        const body = await login();
        vi.stubGlobal('fetch', vi.fn());
        const get = await fn.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': KEY }, queryStringParameters: { palm: 'refresh' }, body: '' });
        expect(get.statusCode).toBe(401);
        expect(JSON.parse(get.body).sessionToken).toBeUndefined();
        const big = await fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY }, queryStringParameters: { palm: 'refresh' },
            body: JSON.stringify({ refreshToken: body.refreshToken, pad: 'x'.repeat(5000) }) });
        expect(big.statusCode).toBe(400);
        expect(fetch).not.toHaveBeenCalled();
    });
});
