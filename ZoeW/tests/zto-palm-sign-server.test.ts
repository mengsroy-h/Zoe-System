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
const call = (body: unknown, token = session) => fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': token }, queryStringParameters: { palm: 'sign' }, body: JSON.stringify(body) });
let session: string;
let requestId: string;
function upstream(url: unknown) {
    if (String(url).endsWith('queryPreOrderByBillCode')) return reply({ billCode: CODE, consigneeName: 'សុខា', agentAmount: 10, fcAmount: 2 });
    if (String(url).endsWith('newBusinessCheck')) return reply(null);
    if (String(url).endsWith('/add')) return reply('log-id');
    return reply(String(url).endsWith('saveScanInfo') ? [] : null);
}
beforeEach(async () => {
    requestId = randomUUID();
    for (const [key, value] of Object.entries({ ZTO_PROXY_KEY: KEY, ZTO_PROXY_KEYS_JSON: '', ZTO_PALM_SESSION_SECRET: 'synthetic-session-secret-at-least-32-characters', ZTO_PALM_SIGN_KEY: 'synthetic-sign-key', ZTO_PALM_PASSWORD_KEY: 'zoew-test-aes-16', ZTO_DETAIL_IDENTITY: 'off', ZTO_DETAIL_BRANCH_PATHS: '' })) vi.stubEnv(key, value);
    vi.stubGlobal('fetch', vi.fn(async () => reply({ token: 'palm-token', countryCode: 'KH', siteCode: 'KH001' })));
    session = JSON.parse((await fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY }, queryStringParameters: { palm: 'login' }, body: JSON.stringify({ username: 'test-operator', password: 'test', deviceSn: 'zoew-sign-test' }) })).body).sessionToken;
    vi.stubGlobal('fetch', vi.fn(async (url) => upstream(url)));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const input = () => ({ barcode: CODE, signMan: 'សុខា', photo: PHOTO, requestId, stage: 'dispatch' });
async function receipt() {
    const out = await call(input());
    expect(out.statusCode).toBe(200);
    const dispatchProof = JSON.parse(out.body).dispatchProof;
    vi.mocked(fetch).mockClear();
    return { ...input(), stage: 'receipt', dispatchProof };
}
it('APK ចែកចាយ 04 ➜ ទទួល 05 ប្រើ saveScanInfo និងរូបទទួល picType 1', async () => {
    const first = JSON.parse((await call(input())).body);
    expect(first).toMatchObject({ success: true, barcode: CODE, stage: 'dispatch', ztoClosed: false });
    const firstCalls = vi.mocked(fetch).mock.calls;
    expect(firstCalls.map(([url]) => new URL(String(url)).pathname)).toEqual(['/zto/basic/v2/newBusinessCheck', '/zto/basic/v1/saveScanInfo']);
    expect(JSON.parse(String(firstCalls[0][1]?.body))).toMatchObject({ scanType: 4, ignoreCodBacklog: 0, ignoreDispSiteId: 0 });
    expect(JSON.parse(String(firstCalls[1][1]?.body))[0]).toMatchObject({ scanTypeCode: '04', dispatchOrSendManCode: 'test-operator', billCode: CODE });
    const res = await call({ ...input(), stage: 'receipt', dispatchProof: first.dispatchProof });
    expect(JSON.parse(res.body)).toMatchObject({ success: true, barcode: CODE, stage: 'receipt', ztoClosed: true });
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.slice(2).map(([url]) => new URL(String(url)).pathname)).toEqual(['/zto/collect/v1/queryPreOrderByBillCode', '/zto/basic/v2/newBusinessCheck', '/zto/sign/log/v1/add', '/zto/basic/v1/saveBillPic', '/zto/basic/v1/saveScanInfo', '/zto/sign/log/v1/deleteByBillCode']);
    expect(JSON.parse(String(calls[5][1]?.body))).toEqual({ fileName: PHOTO, picType: 1, billCode: CODE });
    expect(JSON.parse(String(calls[6][1]?.body))[0]).toMatchObject({ billCode: CODE, signMan: 'សុខា', scanTypeCode: '05', zone: 'GMT+07:00', dataFrom: 'Z10-VN-PDA' });
    expect(calls.some(([url]) => /khSign|uploadKh|payment/i.test(String(url)))).toBe(false);
});
it.each(['', 'tampered'])('គ្មានភស្តុតាងចែកចាយ %s ➜ មិនទទួល', async (dispatchProof) => {
    expect(JSON.parse((await call({ ...input(), stage: 'receipt', dispatchProof })).body).code).toBe('ZTO_PALM_DISPATCH_REQUIRED');
    expect(fetch).not.toHaveBeenCalled();
});
it('ភស្តុតាងចែកចាយចងនឹង Barcode និង requestId', async () => {
    const body = await receipt();
    for (const patch of [{ barcode: CODE + '1' }, { requestId: randomUUID() }]) expect(JSON.parse((await call({ ...body, ...patch })).body).code).toBe('ZTO_PALM_DISPATCH_REQUIRED');
    expect(fetch).not.toHaveBeenCalled();
});
it.each([4, 5])('newBusinessCheck បដិសេធ scanType %s ➜ មិន upload', async (scanType) => {
    const body = scanType === 5 ? await receipt() : input();
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('newBusinessCheck') ? reply({ whetherForce: true, message: 'denied' }) : upstream(url)));
    expect(JSON.parse((await call(body)).body).code).toBe('ZTO_PALM_SIGN_CHECK_REJECTED');
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('saveScanInfo'))).toBe(false);
});
it('រូបទទួលបរាជ័យ ➜ មិនផ្ញើ 05', async () => {
    const body = await receipt();
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('saveBillPic') ? reply(null, false) : upstream(url)));
    expect(JSON.parse((await call(body)).body).code).toBe('ZTO_PALM_SIGN_PHOTO_REJECTED');
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('saveScanInfo'))).toBe(false);
});
it('បញ្ជី upload ជាបញ្ជីបរាជ័យតាម barScannerId', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, init) => String(url).endsWith('saveScanInfo') ? reply([{ barScannerId: JSON.parse(String(init?.body))[0].barScannerId }]) : upstream(url)));
    expect(JSON.parse((await call(input())).body).code).toBe('ZTO_PALM_SIGN_REJECTED');
});
it.each([{ photo: '' }, { barcode: '../bad' }, { requestId: '' }, { stage: 'sign' }])('ទិន្នន័យខុស %j ➜ មិនសរសេរ', async (patch) => {
    expect((await call({ ...input(), ...patch })).statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
});
it('គ្មាន session ➜ មិនសរសេរ', async () => {
    expect((await call(input(), '')).statusCode).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
});
it('ចុចស្ទួនប្រើ requestId ដដែល ➜ upload តែម្តង', async () => {
    const body = input();
    const [a, b] = await Promise.all([call(body), call(body)]);
    expect(a.statusCode).toBe(200);
    expect(b.body).toBe(a.body);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await call({ ...body, signMan: 'ផ្សេង' })).statusCode).toBe(409);
});
it.each(['dispatch', 'receipt'])('ចម្លើយ %s បាត់ ➜ មិនជោគជ័យ និងមិន upload ស្ទួន', async (stage) => {
    const body = stage === 'receipt' ? await receipt() : input();
    vi.stubGlobal('fetch', vi.fn(async (url) => { if (String(url).endsWith('saveScanInfo')) throw new Error('lost'); return upstream(url); }));
    expect(JSON.parse((await call(body)).body).uncertain).toBe(true);
    const count = vi.mocked(fetch).mock.calls.length;
    await call(body);
    expect(fetch).toHaveBeenCalledTimes(count);
});
it.each([{}, [{ barScannerId: 999 }]])('upload ខូច ឬអត្តសញ្ញាណខុស ➜ មិនបិទ', async (result) => {
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('saveScanInfo') ? reply(result) : upstream(url)));
    expect(JSON.parse((await call(input())).body).uncertain).toBe(true);
});
it('សាខា ZoeW ខុស Palm ➜ មិនសរសេរ', async () => {
    const { tokenForSite, withCerts, TEST_PROJECT } = require('../../audit-tools/idtoken-fixture.js');
    vi.stubEnv('ZTO_DETAIL_IDENTITY', 'require');
    vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT);
    const zto = vi.fn();
    vi.stubGlobal('fetch', withCerts(zto));
    const res = await fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': session, 'x-zoe-id-token': tokenForSite('12345') }, queryStringParameters: { palm: 'sign' }, body: JSON.stringify(input()) });
    expect(res.statusCode).toBe(403);
    expect(zto).not.toHaveBeenCalled();
});
it('native POST និង preflight មិនអាន Cookie', async () => {
    const pre = await fn.handler({ httpMethod: 'OPTIONS', headers: { origin: 'https://localhost', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-zoe-palm-token' }, queryStringParameters: { palm: 'sign' } });
    expect(pre.headers['Access-Control-Allow-Methods']).toContain('POST');
    const res = await fn.handler({ httpMethod: 'POST', headers: { origin: 'https://localhost', 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': session, 'x-zoe-query': 'palm=sign' }, body: JSON.stringify(input()) });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://localhost');
});
const track = (action: string, time: string, siteCode = 'KH001') => ({ mailNo: CODE, action, time: '2026-10-17 ' + time, siteCode });
const tracks = (rows: unknown[], isSign = 0) => [{ mail: { mailNo: CODE, isSign }, tracks: rows }];
it.each([
    { rows: [track('3', '08:00:00'), track('4', '09:00:00')], dispatched: true },
    { rows: [track('4', '08:00:00'), track('3', '09:00:00')], dispatched: false },
    { rows: [track('3', '08:00:00'), track('4', '09:00:00', 'OTHER')], dispatched: false },
    { rows: [track('4', '08:00:00'), track('-710', '09:00:00')], dispatched: false },
    { rows: [track('4', '08:00:00'), track('3', '09:00:00', 'OTHER')], dispatched: false }
])('ពិនិត្យ tracking មុនរំលងចែកចាយ %j', async ({ rows, dispatched }) => {
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('queryTrackInfo') ? reply(tracks(rows)) : upstream(url)));
    const status = JSON.parse((await call({ ...input(), stage: 'status', dispatched: true })).body);
    expect(status).toMatchObject({ success: true, dispatched, ztoClosed: false });
    expect(!!status.dispatchProof).toBe(dispatched);
    expect(fetch).toHaveBeenCalledOnce();
    if (dispatched) {
        expect(JSON.parse((await call({ ...input(), stage: 'receipt', dispatchProof: status.dispatchProof })).body).ztoClosed).toBe(true);
        expect(vi.mocked(fetch).mock.calls.filter(([url, init]) => String(url).endsWith('saveScanInfo') && JSON.parse(String(init?.body))[0].scanTypeCode === '04')).toHaveLength(0);
    }
});
it.each([[], tracks([{ ...track('4', '09:00:00'), mailNo: 'OTHER' }]), tracks([{ ...track('4', '09:00:00'), time: 'bad' }]), tracks([null])])('tracking មិនគ្រប់ឬខុស ➜ មិនរំលង %j', async (result) => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(result)));
    expect(JSON.parse((await call({ ...input(), stage: 'status' })).body).code).toBe('ZTO_PALM_STATUS_UNCONFIRMED');
});
it('ZTO ទទួលរួចត្រូវមានហត្ថលេខានៅសាខាដដែល', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(tracks([track('3', '08:00:00'), track('5', '09:00:00')], 1))));
    expect(JSON.parse((await call({ ...input(), stage: 'status' })).body)).toMatchObject({ ztoClosed: true });
    vi.stubGlobal('fetch', vi.fn(async () => reply(tracks([track('5', '09:00:00', 'OTHER')], 1))));
    expect(JSON.parse((await call({ ...input(), stage: 'status' })).body).code).toBe('ZTO_PALM_STATUS_UNCONFIRMED');
});
it('ទទួលត្រូវមានឈ្មោះ ហើយមិនបង្កើតឈ្មោះអតិថិជនដោយខ្លួនឯង', async () => {
    const body = await receipt();
    const out = await call({ ...body, signMan: '' });
    expect(JSON.parse(out.body).code).toBe('ZTO_PALM_SIGN_NAME_REQUIRED');
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('saveScanInfo') || String(url).endsWith('/add'))).toBe(false);
});
it('ទូរស័ព្ទ B ប្រើ session សាខា ដោយគ្មាន token ក្នុងទូរស័ព្ទ', async () => {
    const values = new Map<string, string>();
    const store = { getWithMetadata: async (key: string) => values.has(key) ? { data: values.get(key), etag: 'tag', metadata: {} } : null,
        set: async (key: string, value: string) => { values.set(key, value); return { modified: true, etag: 'tag' }; } };
    fn.setBlobsModuleForTests({ connectLambda() {}, getStore: () => store });
    const blobs = Buffer.from(JSON.stringify({ url: 'https://blobs.test', token: 't' })).toString('base64');
    const invoke = (palm: string, body: unknown) => fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-site': 'KH001' }, queryStringParameters: { palm }, blobs, body: JSON.stringify(body) });
    try {
        vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('doLogin') ? reply({ token: 'shared-sign-token', countryCode: 'KH', siteCode: 'KH001' }) : upstream(url)));
        expect(JSON.parse((await invoke('login', { username: 'shared-operator', password: 'test', deviceSn: 'zoew-sign-test' })).body).shared).toBe(true);
        vi.mocked(fetch).mockClear();
        const out = await invoke('sign', input());
        expect(out.statusCode).toBe(200);
        const save = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('saveScanInfo'))!;
        expect(save[1]?.headers).toMatchObject({ 'x-token': 'shared-sign-token' });
        expect(JSON.parse(String(save[1]?.body))[0].dispatchOrSendManCode).toBe('shared-operator');
    } finally { fn.setBlobsModuleForTests(null); require('../netlify/functions/_shared/zto-palm.js').resetSharedForTests(); }
});
