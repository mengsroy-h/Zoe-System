// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const fn = require('../netlify/functions/zto-order-detail.js');
const KEY = 'sign-test-proxy-key-0123456789';
const CODE = '77130500000012';
const PHOTO = '/9j/AAECAwQF/9k=';
const reply = (result: unknown, status = true) => new Response(JSON.stringify({ status, result }));
const call = (body: unknown, token = session) => fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': token }, queryStringParameters: { palm: 'sign' }, blobs: 'synthetic-context', body: JSON.stringify(body) });
let session: string;
let requestId: string;
function upstream(url: unknown) {
    if (String(url).endsWith('queryPreOrderByBillCode')) return reply({ billCode: CODE, consigneeName: 'សុខា', agentAmount: 10, fcAmount: 2 });
    if (String(url).endsWith('newBusinessCheck')) return reply(null);
    if (String(url).endsWith('/add')) return reply('log-id');
    return reply(String(url).endsWith('saveScanInfo') ? [] : null);
}
beforeEach(async () => {
    const rows = new Map<string, { data: string; etag: string }>();
    let revision = 0;
    const store = {
        getWithMetadata: async (key: string) => rows.get(key) || null,
        set: async (key: string, data: string, options: any) => {
            const previous = rows.get(key);
            if (options?.onlyIfNew && previous || options?.onlyIfMatch && previous?.etag !== options.onlyIfMatch) return { modified: false };
            const etag = String(++revision); rows.set(key, { data, etag }); return { modified: true, etag };
        }
    };
    fn.setBlobsModuleForTests({ connectLambda() {}, getStore: () => store });
    requestId = randomUUID();
    for (const [key, value] of Object.entries({ ZTO_PROXY_KEY: KEY, ZTO_PROXY_KEYS_JSON: '', ZTO_PALM_SESSION_SECRET: 'synthetic-session-secret-at-least-32-characters', ZTO_PALM_SIGN_KEY: 'synthetic-sign-key', ZTO_PALM_PASSWORD_KEY: 'zoew-test-aes-16', ZTO_DETAIL_IDENTITY: 'off', ZTO_DETAIL_BRANCH_PATHS: '' })) vi.stubEnv(key, value);
    vi.stubGlobal('fetch', vi.fn(async () => reply({ token: 'palm-token', countryCode: 'KH', siteCode: 'KH001' })));
    session = JSON.parse((await fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY }, queryStringParameters: { palm: 'login' }, body: JSON.stringify({ username: 'test-operator', password: 'test', deviceSn: 'zoew-sign-test' }) })).body).sessionToken;
    vi.stubGlobal('fetch', vi.fn(async (url) => upstream(url)));
});
afterEach(() => { fn.setBlobsModuleForTests(null); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const input = () => ({ photoProtocol: 'original-sha256-v1', originalSHA256: createHash('sha256').update(Buffer.from(PHOTO, 'base64')).digest('hex'), barcode: CODE, signMan: 'សុខា', photo: PHOTO, requestId, stage: 'dispatch' });
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
    expect(calls.slice(2).map(([url]) => new URL(String(url)).pathname)).toEqual(['/zto/collect/v1/queryPreOrderByBillCode', '/zto/basic/v2/newBusinessCheck', '/zto/sign/log/v1/add', '/zto/basic/v1/saveBillPic', '/zto/basic/v1/saveScanInfo', '/zto/sign/log/v1/deleteByBillCode', '/zto/picture/v1/querySignPic']);
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
it.each([{ photo: 'not-a-jpeg' }, { photo: 7 }, { stage: 'receipt', photo: '' }, { stage: 'receipt', photo: undefined }, { barcode: '../bad' }, { requestId: '' }, { stage: 'sign' }])('ទិន្នន័យខុស %j ➜ មិនសរសេរ', async (patch) => {
    expect((await call({ ...input(), ...patch })).statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
});
it.each([{ photo: undefined }, { photo: '' }])('ចែកចាយគ្មានរូប %j ➜ ទទួល (APK មិនភ្ជាប់រូបចែកចាយ · client មិនផ្ញើរូបធំ)', async (patch) => {
    const out = await call({ ...input(), ...patch });
    expect(JSON.parse(out.body)).toMatchObject({ success: true, stage: 'dispatch', ztoClosed: false });
    expect(vi.mocked(fetch).mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual(['/zto/basic/v2/newBusinessCheck', '/zto/basic/v1/saveScanInfo']);
});
it('Container មួយ Sign ច្រើនជាង ២៥៦ ក្នុង ១០ នាទី (ហាងច្រើន) ➜ មិនបដិសេធ 429 · ចម្លើយចាស់ដែលចប់ត្រូវជម្រះ', async () => {
    for (let i = 0; i < 300; i++) {
        const out = await call({ ...input(), requestId: randomUUID() });
        expect(out.statusCode).toBe(200);
    }
    const body = input();
    const first = await call(body);
    vi.mocked(fetch).mockClear();
    expect((await call(body)).body).toBe(first.body);
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
it('កញ្ចប់មានបញ្ហា៖ បង្ហាញបញ្ជាក់ មុនផ្ញើទទួល និងរូប', async () => {
    const body = await receipt();
    const message = 'ទំនិញនេះគឺជាទំនិញដែលមានបញ្ហា សូមបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ';
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('newBusinessCheck') ? reply({ message, whetherForce: false }) : upstream(url)));
    const first = JSON.parse((await call(body)).body);
    expect(first).toMatchObject({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: CODE, stage: 'receipt', message });
    expect(first.confirmationToken).toEqual(expect.any(String));
    expect(vi.mocked(fetch).mock.calls.some(([url]) => /saveBillPic|saveScanInfo|\/add$/.test(String(url)))).toBe(false);
    const accepted = await call({ ...body, confirmationToken: first.confirmationToken });
    expect(JSON.parse(accepted.body)).toMatchObject({ success: true, ztoClosed: true });
});
it.each([true, 'false', null])('ZTO ហាមឬ flag ខូច %j ➜ មិនមានការបញ្ជាក់ឆ្លង', async (whetherForce) => {
    const body = await receipt();
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('newBusinessCheck') ? reply({ message: 'warning', whetherForce }) : upstream(url)));
    const out = JSON.parse((await call({ ...body, confirmed: true })).body);
    expect(out.code).toBe('ZTO_PALM_SIGN_CHECK_REJECTED');
    expect(out.confirmationToken).toBeUndefined();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => /saveBillPic|saveScanInfo|\/add$/.test(String(url)))).toBe(false);
});
it.each(['90187|COD warning', '90189|site warning'])('សារត្រូវការផ្លូវ retry ផ្សេង %s ➜ មិនប្តូរ ignore ដោយខ្លួនឯង', async (message) => {
    const body = await receipt();
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('newBusinessCheck') ? reply({ message, whetherForce: false }) : upstream(url)));
    expect(JSON.parse((await call({ ...body, confirmed: true })).body).code).toBe('ZTO_PALM_SIGN_CHECK_REJECTED');
    const check = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('newBusinessCheck'))!;
    expect(JSON.parse(String(check[1]?.body))).toMatchObject({ ignoreCodBacklog: 0, ignoreDispSiteId: 0 });
});
it('ចែកចាយកញ្ចប់មានបញ្ហា (ដូច ZTO Palm ពិត) ៖ សួរបញ្ជាក់មុន 04 · គ្មានរូប គ្មានឈ្មោះ · បញ្ជាក់ ➜ 04 តែម្តង · token ចែកចាយមិនប្រើសម្រាប់ទទួល', async () => {
    const message = 'ទំនិញនេះគឺជាទំនិញដែលមានបញ្ហា សូមបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ';
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('newBusinessCheck') ? reply({ message, whetherForce: false }) : upstream(url)));
    const body = { barcode: CODE, signMan: '', requestId, stage: 'dispatch' };
    const first = JSON.parse((await call(body)).body);
    expect(first).toMatchObject({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: CODE, stage: 'dispatch', message });
    expect(vi.mocked(fetch).mock.calls.some(([url]) => /saveBillPic|saveScanInfo|\/add$/.test(String(url)))).toBe(false);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({ scanType: 4 });
    expect(JSON.parse((await call({ ...input(), ...body, stage: 'receipt', signMan: 'សុខា', photo: PHOTO, confirmationToken: first.confirmationToken })).body).code)
        .toBe('ZTO_PALM_SIGN_INVALID');
    const [a, b] = await Promise.all([call({ ...body, confirmationToken: first.confirmationToken }), call({ ...body, confirmationToken: first.confirmationToken })]);
    expect(JSON.parse(a.body)).toMatchObject({ success: true, stage: 'dispatch', ztoClosed: false, dispatchProof: expect.stringMatching(/^.{8,}$/) });
    expect(b.body).toBe(a.body);
    const saves = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('saveScanInfo'));
    expect(saves).toHaveLength(1);
    expect(JSON.parse(String(saves[0][1]?.body))[0]).toMatchObject({ scanTypeCode: '04', billCode: CODE, dispatchOrSendManCode: 'test-operator' });
    expect(JSON.parse(String(saves[0][1]?.body))[0].signMan).toBeUndefined();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => /saveBillPic|\/add$/.test(String(url)))).toBe(false);
});
it('flag មិនផ្ញើមានលំនាំដើម false ដូច APK · បញ្ជាក់ស្ទួនផ្ញើតែម្តង', async () => {
    const body = await receipt();
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('newBusinessCheck') ? reply({ message: 'Problem parcel' }) : upstream(url)));
    const pending = JSON.parse((await call(body)).body);
    expect(pending.code).toBe('ZTO_PALM_SIGN_CONFIRM_REQUIRED');
    const accepted = { ...body, confirmationToken: pending.confirmationToken };
    const [a, b] = await Promise.all([call(accepted), call(accepted)]);
    expect(a.statusCode).toBe(200);
    expect(b.body).toBe(a.body);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('saveScanInfo'))).toHaveLength(1);
});
it('បញ្ជាក់ចងឈ្មោះ រូប Barcode request និង session · token ក្លែងនិងផុតកំណត់មិនសរសេរ', async () => {
    const body = await receipt();
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('newBusinessCheck') ? reply({ message: 'Problem parcel', whetherForce: false }) : upstream(url)));
    const pending = JSON.parse((await call(body)).body);
    for (const patch of [{ signMan: 'Changed' }, { photo: '/9j/AAECAwQG/9k=' }, { barcode: CODE + '1' }, { requestId: randomUUID() }, { stage: 'dispatch' }, { dispatchProof: 'other' }, { confirmationToken: 'forged' }]) {
        expect(JSON.parse((await call({ ...body, confirmationToken: pending.confirmationToken, ...patch })).body).code).toBe('ZTO_PALM_SIGN_INVALID');
    }
    const transport = vi.mocked(fetch);
    vi.stubGlobal('fetch', vi.fn(async () => reply({ token: 'other-palm-token', countryCode: 'KH', siteCode: 'KH001' })));
    const other = JSON.parse((await fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY }, queryStringParameters: { palm: 'login' }, body: JSON.stringify({ username: 'other-operator', password: 'test', deviceSn: 'zoew-sign-test' }) })).body).sessionToken;
    vi.stubGlobal('fetch', transport);
    expect(JSON.parse((await call({ ...body, confirmationToken: pending.confirmationToken }, other)).body).code).toBe('ZTO_PALM_SIGN_INVALID');
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 300001);
    try { expect(JSON.parse((await call({ ...body, confirmationToken: pending.confirmationToken })).body).code).toBe('ZTO_PALM_SIGN_INVALID'); }
    finally { clock.mockRestore(); }
    expect(vi.mocked(fetch).mock.calls.some(([url]) => /saveBillPic|saveScanInfo|\/add$/.test(String(url)))).toBe(false);
});
it('សារ ZTO ប្តូរ ត្រូវបញ្ជាក់ម្តងទៀត · ប្រែហាម មិនអាចបន្ត', async () => {
    const body = await receipt();
    let message = 'First warning';
    let whetherForce = false;
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('newBusinessCheck') ? reply({ message, whetherForce }) : upstream(url)));
    const first = JSON.parse((await call(body)).body);
    message = 'Second warning';
    const second = JSON.parse((await call({ ...body, confirmationToken: first.confirmationToken })).body);
    expect(second).toMatchObject({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', message });
    whetherForce = true;
    expect(JSON.parse((await call({ ...body, confirmationToken: second.confirmationToken })).body).code).toBe('ZTO_PALM_SIGN_CHECK_REJECTED');
    expect(vi.mocked(fetch).mock.calls.some(([url]) => /saveBillPic|saveScanInfo|\/add$/.test(String(url)))).toBe(false);
});
it('ក្រោយបញ្ជាក់ ចម្លើយ upload បាត់ មិនផ្ញើស្ទួន និងមិនបិទ', async () => {
    const body = await receipt();
    vi.stubGlobal('fetch', vi.fn(async (url) => {
        if (String(url).endsWith('newBusinessCheck')) return reply({ message: 'Problem parcel', whetherForce: false });
        if (String(url).endsWith('saveScanInfo')) throw new Error('lost');
        return upstream(url);
    }));
    const pending = JSON.parse((await call(body)).body);
    const accepted = { ...body, confirmationToken: pending.confirmationToken };
    expect(JSON.parse((await call(accepted)).body).uncertain).toBe(true);
    const count = vi.mocked(fetch).mock.calls.length;
    await call(accepted);
    await call(body);
    expect(fetch).toHaveBeenCalledTimes(count);
});

it('upstream បរាជ័យ មិនបម្លែងទៅផ្ទាំងអនុម័ត', async () => {
    const body = await receipt();
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('newBusinessCheck') ? reply({ message: 'warning', whetherForce: false }, false) : upstream(url)));
    const result = JSON.parse((await call(body)).body);
    expect(result.code).toBe('ZTO_PALM_SIGN_CHECK_REJECTED');
    expect(result.confirmationToken).toBeUndefined();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => /saveBillPic|saveScanInfo|\/add$/.test(String(url)))).toBe(false);
});
it.each([null, ''])('message ទទេ %j ដូច APK មិនទាមទារបញ្ជាក់', async (message) => {
    const body = await receipt();
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).endsWith('newBusinessCheck') ? reply({ message, whetherForce: false }) : upstream(url)));
    expect(JSON.parse((await call(body)).body).ztoClosed).toBe(true);
});
it('tracking -579 សម្គាល់ស្កេនបញ្ហាមុន Sign ដោយមិនអនុម័តជំនួស ZTO', async () => {
    const problem = { ...track('-579', '10:00:00'), msgLoc: 'ស្កេនកញ្ចប់មានបញ្ហា៖ ទាក់ទងអតិថិជនមិនបាន' };
    vi.stubGlobal('fetch', vi.fn(async () => reply(tracks([track('3', '08:00:00'), track('4', '09:00:00'), problem]))));
    const status = JSON.parse((await call({ ...input(), stage: 'status' })).body);
    expect(status).toMatchObject({ dispatched: true, ztoClosed: false, problemScan: { action: '-579', message: problem.msgLoc, time: problem.time } });
    expect(status.confirmationToken).toBeUndefined();
    expect(fetch).toHaveBeenCalledOnce();
});
it.each([
    { action: '-579', site: 'OTHER', later: '3' },
    { action: '-579', site: 'KH001', later: '3' },
    { action: '-579', site: 'KH001', later: '-710' },
    { action: '-71', site: 'KH001', later: '' },
    { action: '-588', site: 'KH001', later: '' }
])('មិនដាក់ស្លាកបញ្ហាខុសសាខា វដ្តចាស់ ឬស្កេនចែកចាយ %j', async ({ action, site, later }) => {
    const rows = [track('3', '08:00:00'), track(action, '09:00:00', site), ...(later ? [track(later, '10:00:00')] : [])];
    vi.stubGlobal('fetch', vi.fn(async () => reply(tracks(rows))));
    expect(JSON.parse((await call({ ...input(), stage: 'status' })).body).problemScan).toBeUndefined();
});
it('បញ្ហាច្រើនយកស្កេនថ្មីបំផុត មិនពឹងលំដាប់ជួរ', async () => {
    const rows = [{ ...track('29', '10:00:00'), msgLoc: 'បញ្ហាថ្មី' }, track('3', '08:00:00'), { ...track('-579', '09:00:00'), msgLoc: 'បញ្ហាចាស់' }];
    vi.stubGlobal('fetch', vi.fn(async () => reply(tracks(rows))));
    expect(JSON.parse((await call({ ...input(), stage: 'status' })).body).problemScan.message).toBe('បញ្ហាថ្មី');
});
it('ប្រភេទបញ្ហាផ្សេងមាន marker ពិតពី ZTO សម្រាប់បង្ហាញ មិនមែនភស្តុតាង Sign', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(tracks([track('3', '08:00:00'), { ...track('-999', '09:00:00'), msgEng: 'Scanned for [problem piece]' }]))));
    const result = JSON.parse((await call({ ...input(), stage: 'status' })).body);
    expect(result.problemScan.message).toBe('Scanned for [problem piece]');
    expect(result.ztoClosed).toBe(false);
    expect(result.confirmationToken).toBeUndefined();
});
it.each(['-71', '-588'])('ស្កេនចែកចាយស្ទួន %s ដែល ZTO ចងប្រភេទ 04 អាចរំលងជំហានទី១', async (action) => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(tracks([track('3', '08:00:00'), { ...track(action, '09:00:00'), preOrNextID: '04' }, track('-579', '10:00:00')]))));
    expect(JSON.parse((await call({ ...input(), stage: 'status' })).body)).toMatchObject({ dispatched: true, ztoClosed: false, dispatchProof: expect.any(String) });
});
it('ធ្លាប់បញ្ហា តែទទួលរួច មិនបង្ហាញជាបញ្ហាបច្ចុប្បន្ន', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(tracks([track('3', '08:00:00'), track('-579', '09:00:00'), track('5', '10:00:00')], 1))));
    const out = JSON.parse((await call({ ...input(), stage: 'status' })).body);
    expect(out.ztoClosed).toBe(true);
    expect(out.problemScan).toBeUndefined();
});

it.each([
    { site: 'OTHER', preOrNextID: '04', later: '' },
    { site: 'KH001', preOrNextID: '', later: '' },
    { site: 'KH001', preOrNextID: '04', later: '3' }
])('រំលងចែកចាយស្ទួនត្រូវភស្តុតាង 04 ត្រូវសាខានិងវដ្ត %j', async ({ site, preOrNextID, later }) => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(tracks([track('3', '08:00:00'), { ...track('-71', '09:00:00', site), preOrNextID }, ...(later ? [track(later, '10:00:00')] : [])]))));
    expect(JSON.parse((await call({ ...input(), stage: 'status' })).body).dispatched).toBe(false);
});

it('socket ZTO បិទស្ងាត់ (UND_ERR_SOCKET / ECONNRESET) ៖ status សាកម្តងទៀតដូច Lookup · ⛔ saveScanInfo និង saveBillPic មិនសាកស្ទួន', async () => {
    const stale = (code = 'UND_ERR_SOCKET') => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('other side closed'), { code }) });
    for (const code of ['UND_ERR_SOCKET', 'ECONNRESET']) {
        let statusTries = 0;
        vi.stubGlobal('fetch', vi.fn(async () => {
            statusTries++;
            if (statusTries === 1) throw stale(code);
            return reply(tracks([track('3', '08:00:00'), track('4', '09:00:00')]));
        }));
        const statusRes = await call({ ...input(), stage: 'status' });
        expect(statusRes.statusCode).toBe(200);
        expect(JSON.parse(statusRes.body)).toMatchObject({ success: true, dispatched: true, ztoClosed: false });
        expect(statusTries).toBe(2);
    }

    vi.stubGlobal('fetch', vi.fn(async (url) => upstream(url)));
    const receiptBody = await receipt();
    const writeCalls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        const path = new URL(url).pathname;
        writeCalls.push(path);
        if (path.endsWith('saveScanInfo')) throw stale();
        return upstream(url);
    }));
    const dispatchRes = await call({ ...input(), requestId: randomUUID(), stage: 'dispatch', signMan: '' });
    expect(dispatchRes.statusCode).not.toBe(200);
    expect(writeCalls.filter((p) => p.endsWith('saveScanInfo'))).toHaveLength(1);

    writeCalls.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        const path = new URL(url).pathname;
        writeCalls.push(path);
        if (path.endsWith('saveBillPic')) throw stale();
        return upstream(url);
    }));
    const receiptRes = await call(receiptBody);
    expect(receiptRes.statusCode).not.toBe(200);
    expect(writeCalls.filter((p) => p.endsWith('saveBillPic'))).toHaveLength(1);
});

it.each(['photo-fetch', 'photo-json', 'scan-fetch'])('សាកល្បង៖ %s hang មិនគោរព abort ហើយ ACK មកក្រោយ timeout មិនបន្តសរសេរ', async (kind) => {
    const body = await receipt();
    let release!: (value: any) => void; let entered!: () => void;
    const held = new Promise<any>((r) => { release = r; });
    const reached = new Promise<void>((r) => { entered = r; });
    const path = kind.startsWith('photo') ? 'saveBillPic' : 'saveScanInfo';
    vi.stubGlobal('fetch', vi.fn(async (url) => {
        if (!String(url).endsWith(path)) return upstream(url);
        entered();
        return kind === 'photo-json' ? { ok: true, status: 200, json: () => held } : held;
    }));
    vi.useFakeTimers();
    try {
        const work = call(body);
        await reached;
        await vi.advanceTimersByTimeAsync(50000);
        const out = await work;
        expect(out.statusCode).not.toBe(200);
        expect(JSON.parse(out.body).success).not.toBe(true);
        expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('saveScanInfo'))).toHaveLength(kind.startsWith('photo') ? 0 : 1);
        if (kind === 'scan-fetch') expect(JSON.parse(out.body).uncertain).toBe(true);
        const count = vi.mocked(fetch).mock.calls.length;
        release(kind === 'photo-json' ? { status: true, result: null } : reply(kind === 'scan-fetch' ? [] : null));
        await vi.advanceTimersByTimeAsync(1);
        expect(vi.mocked(fetch).mock.calls).toHaveLength(count);
    } finally { release(reply(null)); vi.useRealTimers(); }
});

async function reservedReceipt(originalPhoto = PHOTO) {
    const body = { ...await receipt(), background: true, reservationProtocol: 'original-reservation-v1', refreshRequestId: randomUUID(), originalFingerprint: '' };
    body.photo = originalPhoto;
    body.originalSHA256 = createHash('sha256').update(Buffer.from(originalPhoto, 'base64')).digest('hex');
    body.originalFingerprint = createHash('sha256').update(JSON.stringify([body.barcode, body.requestId, body.signMan, body.photo])).digest('hex');
    const status = { ...body, stage: 'receipt-status', photo: undefined, signMan: undefined };
    const ready = JSON.parse((await call(status)).body);
    expect(ready).toMatchObject({ code: 'ZTO_PALM_SIGN_RESUME_READY', reservationProtocol: body.reservationProtocol, originalFingerprint: body.originalFingerprint, originalSHA256: body.originalSHA256, requestId: body.requestId });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    return { body: { ...body, reservationOwner: ready.reservationOwner, reservationToken: ready.reservationToken }, status: { ...status, reservationOwner: ready.reservationOwner, reservationToken: ready.reservationToken } };
}
it('handler ពិត៖ sealed reservation capability ចាំបាច់មុនរូប និង05', async () => {
    const { body } = await reservedReceipt();
    expect(JSON.parse((await call({ ...body, reservationToken: body.reservationToken.slice(0, -2) + '00' })).body).success).not.toBe(true);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    const signed = JSON.parse((await call(body)).body); expect(signed.scanCompleted).toBe(true);
    await call(body);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('saveBillPic'))).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('saveScanInfo'))).toHaveLength(1);
});
it('handler ពិត៖ preimage takeover ប្តូរ sealed capability និង stale worker មិន upload', async () => {
    const { body, status } = await reservedReceipt(); let release!: () => void; let entered!: () => void;
    const held = new Promise<void>(done => { release = done; }); const reached = new Promise<void>(done => { entered = done; }); let first = true;
    vi.stubGlobal('fetch', vi.fn(async url => { if (String(url).endsWith('queryPreOrderByBillCode') && first) { first = false; entered(); await held; } return upstream(url); }));
    const old = call(body); let now: ReturnType<typeof vi.spyOn> | undefined;
    try {
        await reached; now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120000);
        const ready = JSON.parse((await call(status)).body); expect(ready.code).toBe('ZTO_PALM_SIGN_RESUME_READY'); expect(ready.reservationOwner).toBe(body.reservationOwner);
        const stale = JSON.parse((await call(body)).body); expect(stale.code).toBe('ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED');
        expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('saveBillPic'))).toBe(false);
        expect(JSON.parse((await call({ ...body, reservationToken: ready.reservationToken })).body).scanCompleted).toBe(true);
    } finally { release(); await old; now?.mockRestore(); }
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('saveBillPic'))).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('saveScanInfo'))).toHaveLength(1);
});
it('handler ពិត៖ warning cancel ត្រូវ sealed currenttoken ហើយ ACK ឆ្លើយតែមុនរូប', async () => {
    const { body } = await reservedReceipt();
    vi.stubGlobal('fetch', vi.fn(async url => String(url).endsWith('newBusinessCheck') ? reply({ message: 'សូមបញ្ជាក់', whetherForce: false }) : upstream(url)));
    const warning = JSON.parse((await call(body)).body); expect(warning.code).toBe('ZTO_PALM_SIGN_CONFIRM_REQUIRED');
    const cancelBody = { ...body, stage: 'receipt-cancel', photo: undefined, confirmationToken: warning.confirmationToken };
    expect(JSON.parse((await call({ ...cancelBody, confirmationToken: 'invalid' })).body).cancelled).not.toBe(true);
    const cancelled = await call(cancelBody);
    expect(JSON.parse(cancelled.body)).toMatchObject({ success: true, cancelled: true, stage: 'receipt-cancel', requestId: body.requestId, originalSHA256: body.originalSHA256, originalFingerprint: body.originalFingerprint, reservationOwner: body.reservationOwner, reservationToken: body.reservationToken });
    expect((await call(cancelBody)).body).toBe(cancelled.body);
    await call({ ...body, confirmationToken: warning.confirmationToken });
    expect(vi.mocked(fetch).mock.calls.some(([url]) => /saveBillPic|saveScanInfo/.test(String(url)))).toBe(false);
});
it('handler ពិត៖ expired warning readonly refresh ផ្តល់តែ fresh sealed challenge មុន05', async () => {
    const { body, status } = await reservedReceipt();
    vi.stubGlobal('fetch', vi.fn(async url => String(url).endsWith('newBusinessCheck') ? reply({ message: 'សូមបញ្ជាក់', whetherForce: false }) : upstream(url)));
    const warning = JSON.parse((await call(body)).body); const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600000);
    try {
        const trigger = JSON.parse((await call({ ...status, confirmationToken: warning.confirmationToken })).body); expect(trigger.code).toBe('ZTO_PALM_SIGN_WARNING_REFRESH_REQUIRED');
        const fresh = JSON.parse((await call({ ...body, stage: 'receipt-warning-refresh', confirmationToken: warning.confirmationToken })).body); expect(fresh).toMatchObject({ code: 'ZTO_PALM_SIGN_RESUME_READY', warningRefreshed: true });
        expect(vi.mocked(fetch).mock.calls.some(([url]) => /saveBillPic|saveScanInfo|\/add$/.test(String(url)))).toBe(false);
        const outcome = JSON.parse((await call({ ...body, reservationToken: fresh.reservationToken, confirmationToken: fresh.confirmationToken })).body); expect(outcome.scanCompleted).toBe(true);
        expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('saveScanInfo'))).toHaveLength(1);
    } finally { now.mockRestore(); }
});

function boundaryJPEG(size: number) {
    const bytes = Buffer.alloc(size);
    Buffer.from([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0]).copy(bytes);
    bytes[size - 2] = 255; bytes[size - 1] = 217;
    return bytes.toString('base64');
}
it.each([900000, 900001])('handler ពិត៖ original %s bytes reserve→receipt គោរពព្រំដែន', async size => {
    const { body } = await reservedReceipt(boundaryJPEG(size));
    expect(Buffer.from(body.photo, 'base64')).toHaveLength(size);
    expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThanOrEqual(1250000);
    expect(Object.values(body).filter(value => value === body.photo)).toHaveLength(1);
    const result = await call(body);
    if (size === 900000) {
        expect(JSON.parse(result.body).scanCompleted).toBe(true);
        expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('saveBillPic'))).toHaveLength(1);
        expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('saveScanInfo'))).toHaveLength(1);
    } else { expect(result.statusCode).toBe(400); expect(fetch).not.toHaveBeenCalled(); }
});
it.each(['receipt-warning-refresh', 'receipt-prewrite-refresh'])('handler ពិត៖ %s ទទួល900000 បដិសេធ900001 ដោយគ្មានwrite', async stage => {
    const { body } = await reservedReceipt(boundaryJPEG(900000));
    vi.stubGlobal('fetch', vi.fn(async url => stage === 'receipt-warning-refresh' && String(url).endsWith('newBusinessCheck') ? reply({ message: 'សូមបញ្ជាក់', whetherForce: false }) : stage === 'receipt-prewrite-refresh' && String(url).endsWith('queryPreOrderByBillCode') ? reply(null, false) : upstream(url)));
    const held = JSON.parse((await call(body)).body);
    expect(held.code).toBe(stage === 'receipt-warning-refresh' ? 'ZTO_PALM_SIGN_CONFIRM_REQUIRED' : 'ZTO_PALM_SIGN_CHECK_REJECTED');
    vi.stubGlobal('fetch', vi.fn(async url => upstream(url)));
    const request = { ...body, stage, confirmationToken: held.confirmationToken || '' };
    expect(Buffer.byteLength(JSON.stringify(request))).toBeLessThanOrEqual(1250000);
    expect(Object.values(request).filter(value => value === body.photo)).toHaveLength(1);
    const oversized = { ...request, photo: boundaryJPEG(900001) };
    expect(Buffer.byteLength(JSON.stringify(oversized))).toBeLessThanOrEqual(1250000);
    expect((await call(oversized)).statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse((await call(request)).body).code).toBe('ZTO_PALM_SIGN_RESUME_READY');
    expect(vi.mocked(fetch).mock.calls.some(([url]) => /saveBillPic|saveScanInfo|\/add$/.test(String(url)))).toBe(false);
});
