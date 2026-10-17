// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const fn = require('../netlify/functions/zto-order-detail.js');
const KEY = 'sign-test-proxy-key-0123456789';
const CODE = '77130500000012';
const PHOTO = '/9j/AAECAwQF/9k=';
const reply = (result: unknown, status = true) => new Response(JSON.stringify({ status, result }));
const call = (palm: string, body: unknown, session = '') => fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': session }, queryStringParameters: { palm }, body: JSON.stringify(body) });
let session: string;
let requestId: string;
beforeEach(async () => {
    requestId = randomUUID();
    vi.stubEnv('ZTO_PROXY_KEY', KEY);
    vi.stubEnv('ZTO_PROXY_KEYS_JSON', '');
    vi.stubEnv('ZTO_PALM_SESSION_SECRET', 'synthetic-session-secret-at-least-32-characters');
    vi.stubEnv('ZTO_PALM_SIGN_KEY', 'synthetic-sign-key');
    vi.stubEnv('ZTO_PALM_PASSWORD_KEY', 'zoew-test-aes-16');
    vi.stubEnv('ZTO_DETAIL_IDENTITY', 'off');
    vi.stubEnv('ZTO_DETAIL_BRANCH_PATHS', '');
    vi.stubGlobal('fetch', vi.fn(async () => reply({ token: 'palm-token', countryCode: 'KH', siteCode: 'KH001' })));
    session = JSON.parse((await call('login', { username: 'test', password: 'test', deviceSn: 'zoew-sign-test' })).body).sessionToken;
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('khSignScanCheck')
        ? reply({ waybillResVo: { billCode: CODE, paymentStatus: 2 } })
        : String(url).endsWith('saveBillPic') ? reply(null) : reply([])));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const input = () => ({ barcode: CODE, signMan: 'សុខា', photo: PHOTO, requestId });
it('ផ្ញើរូប និង Sign ពិតតាម protocol APK', async () => {
    const res = await call('sign', input(), session);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ success: true, barcode: CODE, ztoClosed: true });
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.map(([url]) => new URL(String(url)).pathname)).toEqual(['/zto/scan/v1/khSignScanCheck', '/zto/basic/v1/saveBillPic', '/zto/basic/v1/uploadKhSignScan']);
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({ billCode: CODE, scanType: 5, dataFrom: 'Z10-VN-PDA' });
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({ fileName: PHOTO, picType: 1, billCode: CODE });
    const rows = JSON.parse(String(calls[2][1]?.body));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ billCode: CODE, signMan: 'សុខា', scanTypeCode: '05', zone: 'GMT+07:00', dataFrom: 'Z10-VN-PDA' });
    expect(rows[0].scanDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(calls[2][1]?.headers).toMatchObject({ 'x-token': 'palm-token' });
});
it('មិនចុះហត្ថលេខាពេល ZTO មិនបញ្ជាក់បង់ប្រាក់', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply({ waybillResVo: { billCode: CODE, paymentStatus: 0 } })));
    const res = await call('sign', input(), session);
    expect(JSON.parse(res.body).code).toBe('ZTO_PALM_SIGN_PAYMENT_REQUIRED');
    expect(fetch).toHaveBeenCalledTimes(1);
});
it('រូបបរាជ័យ ➜ មិនផ្ញើ Sign', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('khSignScanCheck') ? reply({ waybillResVo: { billCode: CODE, paymentStatus: 2 } }) : reply(null, false)));
    expect(JSON.parse((await call('sign', input(), session)).body).success).not.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
});
it('បញ្ជីលទ្ធផល APK ជាបញ្ជីបរាជ័យតាម barScannerId', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, init) => String(url).endsWith('khSignScanCheck') ? reply({ waybillResVo: { billCode: CODE, paymentStatus: 2 } }) : String(url).endsWith('saveBillPic') ? reply(null) : reply([{ barScannerId: JSON.parse(String(init?.body))[0].barScannerId, exceptionMessage: 'rejected' }])));
    expect(JSON.parse((await call('sign', input(), session)).body).code).toBe('ZTO_PALM_SIGN_REJECTED');
});
it.each([{ signMan: '' }, { photo: '' }, { barcode: '../bad' }, { requestId: '' }])('បដិសេធទិន្នន័យមិនគ្រប់គ្រាន់ %j', async (patch) => {
    expect((await call('sign', { ...input(), ...patch }, session)).statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
});
it('គ្មាន session ➜ មិនសរសេរ', async () => {
    expect((await call('sign', input())).statusCode).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
});
it('ចុចស្ទួនប្រើ requestId ដដែល ➜ upload តែម្តង', async () => {
    const body = input();
    const [a, b] = await Promise.all([call('sign', body, session), call('sign', body, session)]);
    expect(a.statusCode).toBe(200);
    expect(b.body).toBe(a.body);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect((await call('sign', { ...body, signMan: 'ផ្សេង' }, session)).statusCode).toBe(409);
    expect(fetch).toHaveBeenCalledTimes(3);
});
it('ចម្លើយ Sign បាត់ ➜ មិនបញ្ជាក់ជោគជ័យ ហើយមិនសាក upload ស្វ័យប្រវត្តិ', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
        if (String(url).endsWith('khSignScanCheck')) return reply({ waybillResVo: { billCode: CODE, paymentStatus: 2 } });
        if (String(url).endsWith('saveBillPic')) return reply(null);
        throw new Error('lost-response');
    }));
    const res = await call('sign', input(), session);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'ZTO_PALM_SIGN_UNCONFIRMED', uncertain: true });
    await call('sign', input(), session);
    expect(fetch).toHaveBeenCalledTimes(3);
});
it.each([{}, [{ barScannerId: 999 }]])('លទ្ធផល upload ខូច ឬអត្តសញ្ញាណខុស ➜ មិនបិទ', async (result) => {
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('khSignScanCheck') ? reply({ waybillResVo: { billCode: CODE, paymentStatus: 2 } }) : String(url).endsWith('saveBillPic') ? reply(null) : reply(result)));
    expect(JSON.parse((await call('sign', input(), session)).body).uncertain).toBe(true);
});
it('Sign ត្រូវការសាខា ZoeW ត្រូវគ្នា Palm', async () => {
    const { tokenForSite, withCerts, TEST_PROJECT } = require('../../audit-tools/idtoken-fixture.js');
    vi.stubEnv('ZTO_DETAIL_IDENTITY', 'require');
    vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT);
    const zto = vi.fn();
    vi.stubGlobal('fetch', withCerts(zto));
    const res = await fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': session, 'x-zoe-id-token': tokenForSite('12345') }, queryStringParameters: { palm: 'sign' }, body: JSON.stringify(input()) });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('ZTO_OTHER_BRANCH');
    expect(zto).not.toHaveBeenCalled();
});
it('native POST query header និង preflight Sign មិនអាន Cookie', async () => {
    const pre = await fn.handler({ httpMethod: 'OPTIONS', headers: { origin: 'https://localhost', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-zoe-palm-token' }, queryStringParameters: { palm: 'sign' } });
    expect(pre.headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(fetch).not.toHaveBeenCalled();
    const res = await fn.handler({ httpMethod: 'POST', headers: { origin: 'https://localhost', 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': session, 'x-zoe-query': 'palm=sign' }, body: JSON.stringify(input()) });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://localhost');
});
