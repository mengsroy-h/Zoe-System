// @vitest-environment node
import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const fn = require('../netlify/functions/_shared/zto-order-detail-core.cjs');
const KEY = 'photo-status-test-proxy-0123456789';
const CODE = '77130500000012';
const PATH = '/zto/picture/v1/querySignPic';
const requestId = randomUUID();
let session = '';
const reply = (result: unknown, status = true) => new Response(JSON.stringify({ status, result }));
const input = () => ({ barcode: CODE, requestId, stage: 'photo-status' });
const call = (body: unknown = input(), token = session, key = KEY) => fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': key, 'x-zoe-palm-token': token }, queryStringParameters: { palm: 'sign' }, body: JSON.stringify(body) });
const row = (billCode = CODE) => ({ billCode, aliasName: 'private-name', savePos: 'http://127.0.0.1/private?token=secret' });
const expectUnknown = (body: string) => expect(JSON.parse(body)).toMatchObject({ stage: 'photo-status', barcode: CODE, requestId, photoStatus: 'unknown', count: null });
beforeEach(async () => {
    fn.setBlobsModuleForTests(null);
    for (const [key, value] of Object.entries({ ZTO_PROXY_KEY: KEY, ZTO_PROXY_KEYS_JSON: '', ZTO_PALM_SESSION_SECRET: 'synthetic-session-secret-at-least-32-characters', ZTO_PALM_SIGN_KEY: 'synthetic-sign-key', ZTO_PALM_PASSWORD_KEY: 'zoew-test-aes-16', ZTO_DETAIL_IDENTITY: 'off', ZTO_DETAIL_BRANCH_PATHS: '' })) vi.stubEnv(key, value);
    vi.stubGlobal('fetch', vi.fn(async () => reply({ token: 'palm-token', countryCode: 'KH', siteCode: 'KH001' })));
    session = JSON.parse((await fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY }, queryStringParameters: { palm: 'login' }, body: JSON.stringify({ username: 'test-operator', password: 'test', deviceSn: 'zoew-photo-test' }) })).body).sessionToken;
    expect(session).toBeTruthy();
    vi.stubGlobal('fetch', vi.fn(async () => reply([row()])));
});
afterEach(() => { vi.useRealTimers(); fn.setBlobsModuleForTests(null); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('អានរូបតាមកិច្ចសន្យា APK មិនបង្ហាញ URL ឈ្មោះ ឬភស្តុតាង Sign', async () => {
    const out = await call();
    expect(out.statusCode).toBe(200);
    expect(JSON.parse(out.body)).toEqual({ provider: 'zto-palm', barcode: CODE, requestId, stage: 'photo-status', photoStatus: 'listed', count: 1 });
    expect(out.headers['Cache-Control']).toBe('no-store');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe('https://aargus-api.ztoglobal.net' + PATH);
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('manual');
    expect(JSON.parse(String(init?.body))).toEqual({ billCode: CODE });
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-language']).toBeUndefined();
    expect(headers['x-token']).toBe('palm-token');
    expect(headers['x-sign']).toBe(createHash('md5').update(String(init?.body) + 'synthetic-sign-key').digest('base64'));
});
it('បញ្ជីទទេជាស្ថានភាពពេលអាន មិនរក្សាចម្លើយចាស់', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply([])).mockResolvedValueOnce(reply([row(), row()]));
    expect(JSON.parse((await call()).body)).toMatchObject({ photoStatus: 'none_observed', count: 0 });
    expect(JSON.parse((await call()).body)).toMatchObject({ photoStatus: 'listed', count: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
});
it('រាប់តែ Barcode ដូចគ្នា ក្នុងបញ្ជីចម្រុះ', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply([row('OTHER123'), row()]));
    expect(JSON.parse((await call()).body)).toMatchObject({ photoStatus: 'listed', count: 1 });
});
it.each([null, {}, { list: [] }, '[]', [null], [row('OTHER123')], [{ ...row(), billCode: ' ' + CODE }], [{ ...row(), savePos: null }], [{ ...row(), savePos: '' }], [row(), {}]])('ទិន្នន័យមិនប្រាកដ %j មិនមានន័យថាគ្មានរូប', async (result) => {
    vi.mocked(fetch).mockResolvedValueOnce(reply(result));
    expectUnknown((await call()).body);
});
it.each([401, 403, 500, 429])('បរាជ័យ HTTP %s មិនមានន័យថាគ្មានរូប', async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status }));
    expectUnknown((await call()).body);
    expect(fetch).toHaveBeenCalledTimes(1);
});
it('បរាជ័យ status និង JSON មិនបង្ហាញទិន្នន័យឯកជន', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply({ secret: 'secret' }, false)).mockResolvedValueOnce(new Response('private-not-json'));
    expectUnknown((await call()).body); expectUnknown((await call()).body);
});
it('អានជាប់គាំងមានព្រំដែន និងមិនបញ្ជូនឡើងវិញ', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    const pending = call();
    await vi.advanceTimersByTimeAsync(10000);
    expectUnknown((await pending).body);
    expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([{ barcode: '../bad' }, { barcode: ' ' + CODE }, { barcode: 123456 }, { requestId: '' }])('បដិសេធ input ខុស %j មុនអាន', async (patch) => {
    expect((await call({ ...input(), ...patch })).statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
});
it('គ្មានសិទ្ធិ និង session មិនអាន', async () => {
    expect((await call(input(), '', KEY)).statusCode).toBe(401);
    expect((await call(input(), session, 'bad')).statusCode).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
});
it('សាខាខុសមិនអាន', async () => {
    const { tokenForSite, withCerts, TEST_PROJECT } = require('../../audit-tools/idtoken-fixture.js');
    vi.stubEnv('ZTO_DETAIL_IDENTITY', 'require'); vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT);
    const zto = vi.fn(); vi.stubGlobal('fetch', withCerts(zto));
    const res = await fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': session, 'x-zoe-id-token': tokenForSite('12345') }, queryStringParameters: { palm: 'sign' }, body: JSON.stringify(input()) });
    expect(res.statusCode).toBe(403); expect(zto).not.toHaveBeenCalled();
});
it('គ្មាន journal ឬ Blob សរសេរ ពេលអានជោគជ័យ និងបរាជ័យ', async () => {
    const set = vi.fn(() => { throw new Error('write forbidden'); });
    const del = vi.fn(() => { throw new Error('delete forbidden'); });
    fn.setBlobsModuleForTests({ connectLambda() {}, getStore: () => ({ getWithMetadata: async () => null, set, delete: del }) });
    vi.mocked(fetch).mockResolvedValueOnce(reply([row()])).mockResolvedValueOnce(new Response('{}', { status: 401 }));
    const invoke = () => fn.handler({ httpMethod: 'POST', blobs: 'synthetic-context', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': session }, queryStringParameters: { palm: 'sign' }, body: JSON.stringify(input()) });
    expect(JSON.parse((await invoke()).body).photoStatus).toBe('listed');
    expectUnknown((await invoke()).body);
    expect(set).not.toHaveBeenCalled(); expect(del).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([PATH, PATH]);
});
it('សំណើអានស្របគ្នាមិនប្រើចម្លើយរបស់ Barcode ផ្សេង', async () => {
    vi.mocked(fetch).mockImplementation(async (_url, init) => reply([row(JSON.parse(String(init?.body)).billCode)]));
    const codes = [CODE, 'OTHER123'];
    const out = await Promise.all(codes.map((barcode) => call({ ...input(), barcode })));
    out.forEach((res, i) => expect(JSON.parse(res.body)).toMatchObject({ barcode: codes[i], photoStatus: 'listed', count: 1 }));
    expect(fetch).toHaveBeenCalledTimes(2);
});
it('ទិន្នន័យច្រើនហួសព្រំដែនមិនសន្និដ្ឋាន', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply(Array.from({ length: 201 }, () => row())));
    expectUnknown((await call()).body);
});
it('កំហុស token នៅក្នុង envelope មិនមានន័យថាគ្មានរូប', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ status: false, statusCode: 'token_expired', result: [] })));
    expectUnknown((await call()).body);
    expect(fetch).toHaveBeenCalledTimes(1);
});
it('session ចែករំលែកផុតសិទ្ធិមិន renew ឬសរសេរ lease', async () => {
    const rows = new Map<string, { data: string; etag: string }>();
    const set = vi.fn(async (key: string, data: string) => { const etag = randomUUID(); rows.set(key, { data, etag }); return { modified: true, etag }; });
    const del = vi.fn();
    fn.setBlobsModuleForTests({ connectLambda() {}, getStore: () => ({ getWithMetadata: async (key: string) => rows.get(key) || null, set, delete: del }) });
    vi.mocked(fetch).mockResolvedValueOnce(reply({ token: 'shared-photo-token', countryCode: 'KH', siteCode: 'KH001' }));
    const login = await fn.handler({ httpMethod: 'POST', blobs: 'synthetic-context', headers: { 'x-zoe-proxy-key': KEY }, queryStringParameters: { palm: 'login' }, body: JSON.stringify({ username: 'test-operator', password: 'test', deviceSn: 'zoew-photo-test' }) });
    expect(JSON.parse(login.body).shared).toBe(true);
    expect(set.mock.calls.length).toBeGreaterThan(0);
    set.mockClear(); vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 401 }));
    const out = await fn.handler({ httpMethod: 'POST', blobs: 'synthetic-context', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-site': 'KH001' }, queryStringParameters: { palm: 'sign' }, body: JSON.stringify(input()) });
    expectUnknown(out.body);
    expect(set).not.toHaveBeenCalled(); expect(del).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>)['x-token']).toBe('shared-photo-token');
});
