// @vitest-environment node
/**
 * Deep audit ៩ (owner request «កែអោយស្អាតត្រឹមត្រូវ» · locked ZTO files) ៖ the sign-list sweep is the evidence the 8-day `abandon` waits for.
 *  ① A full page whose `pages` is malformed (`null` · `''` · `false` · `0` beside rows) or served smaller than requested was answered as
 *     the last page (`pages: 0|1`, no `pagesUnknown`) ➜ the client read page 1 only, called the round complete, released the hold and the
 *     8-day rule deducted parcels whose Sign rows sat on the unread pages. The candidates reader of the same upstream query already
 *     refused these shapes; the sweep readers (Palm `signedListBody` · Cookie `listResponseBody`) follow the same rules now.
 *  ② An empty or beyond-the-end page (`list: null` with `total: 0`, or a page past `pages`) failed the whole read with 502 ➜ a branch
 *     with no signs, or the second page of a branch bound with a busier sibling, kept every sweep partial for good.
 *  ③ Returned · sent · problem list reads were metered as scans (🩺 «ZTO ឆ្លើយពេលស្កេន»).
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const fn = require('../netlify/functions/_shared/zto-order-detail-core.cjs');
const { tokenForSite, withCerts, TEST_PROJECT } = require('../../audit-tools/idtoken-fixture.js');
const KEY = 'audit-proxy-key-0123456789abcdef';
const R = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
const call = (query: any, headers: any = {}, body?: unknown) => fn.handler({ httpMethod: body === undefined ? 'GET' : 'POST',
    headers: { 'x-zoe-proxy-key': KEY, ...headers }, queryStringParameters: query, body: body === undefined ? '' : JSON.stringify(body),
    blobs: Buffer.from('{"url":"https://b.test","token":"t"}').toString('base64') });
const ID = () => ({ 'x-zoe-id-token': tokenForSite('12345') });
const range = { from: '2026-10-10', to: '2026-10-16' };
const sweep = (page = '1') => ({ palm: '1', list: '1', signed: '1', exact: '1', ...range, page });
let n = 0;

async function palmLogin(user = 'a') {
    const res = await call({ palm: 'login' }, {}, { username: user, password: 'p', deviceSn: 'zoew-test-device' });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body).sessionToken as string;
}
function zto(lists: (token: string, body: any) => unknown, argus?: () => unknown) {
    vi.stubGlobal('fetch', vi.fn(withCerts(async (url: any, init: any) => {
        const path = new URL(String(url)).pathname;
        const body = JSON.parse(String(init.body || '{}'));
        if (path === '/zto/system/v1/doLogin') return R({ status: true, result: { token: 'zto-token-' + (++n), countryCode: 'KH',
            siteCode: body.userName === 'b' ? 'KH002' : 'KH001', siteName: 'x' } });
        if (path === '/zto/dispatch/v1/queryDispatchList') return R(lists(String(init.headers['x-token']), body));
        if (path === '/getUserInfo') return R({ success: true, data: { siteCode: 'KH001' } });
        return R(argus ? argus() : { success: true, data: { result: [], total: 0 } });
    })));
}
const signedRows = (k: number) => Array.from({ length: k }, (_, i) => ({ billCode: 'KH' + (1000000000 + i), billStatus: '5' }));
const argusRows = (k: number) => Array.from({ length: k }, (_, i) => ({ scanBillCode: '7713050000' + (1000 + i), scanTypeCode: '05', scanTime: '2026-10-12 10:00:00' }));

beforeEach(() => {
    fn.resetCachesForTests();
    n = 0;
    const entries = new Map<string, any>();
    fn.setBlobsModuleForTests({ connectLambda() {}, getStore: () => ({
        async getWithMetadata(k: string) { return entries.get(k) || null; },
        async set(k: string, v: string, o: any) {
            const e = entries.get(k);
            if ((o?.onlyIfMatch && e?.etag !== o.onlyIfMatch) || (o?.onlyIfNew && e)) return { modified: false };
            const etag = '"' + createHash('sha256').update(v + Math.random()).digest('hex') + '"';
            entries.set(k, { data: v, etag, metadata: {} });
            return { modified: true, etag };
        } }) });
    for (const [k, v] of Object.entries({ ZTO_PROXY_KEY: KEY, ZTO_PALM_SESSION_SECRET: 'x'.repeat(40), ZTO_PALM_SIGN_KEY: 'k',
        ZTO_PALM_PASSWORD_KEY: 'zoew-test-aes-16', ZTO_COOKIE: 'BOS-MAN-SESSION=synthetic-1', ZTO_CACHE_TTL_MS: '0',
        ZTO_DETAIL_IDENTITY: '', ZTO_DETAIL_BRANCH_PATHS: '', FIREBASE_PROJECT_IDS: TEST_PROJECT })) vi.stubEnv(k, v);
});
afterEach(() => { fn.setBlobsModuleForTests(null); fn.resetCachesForTests(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each([undefined, null, '', false, 0])('① Palm sweep ៖ full page · pages=%j ➜ never the last page', async (pages) => {
    zto(() => ({}));
    const s = await palmLogin();
    zto(() => ({ status: true, result: { list: signedRows(100), ...(pages === undefined ? {} : { pages, total: null }) } }));
    const b = JSON.parse((await call(sweep(), { 'x-zoe-palm-token': s })).body);
    expect({ pages: b.pages, pagesUnknown: b.pagesUnknown, signed: b.signed.length }).toEqual({ pages: 2, pagesUnknown: true, signed: 100 });
});

it('① Palm sweep ៖ ZTO serves 20 rows (pageSize 20) without pages ➜ a full page (like the candidates reader)', async () => {
    zto(() => ({}));
    const s = await palmLogin();
    zto(() => ({ status: true, result: { list: signedRows(20), pageSize: 20 } }));
    const cand = JSON.parse((await call({ palm: '1', list: '1', candidates: '1', tabs: '5', ...range, page: '1' }, { 'x-zoe-palm-token': s })).body);
    expect(cand.tabPages).toEqual({ '5': 2 });
    const b = JSON.parse((await call(sweep(), { 'x-zoe-palm-token': s })).body);
    expect({ pages: b.pages, pagesUnknown: b.pagesUnknown }).toEqual({ pages: 2, pagesUnknown: true });
});

it('① control ៖ a real `pages` and a short page stay as ZTO says', async () => {
    zto(() => ({}));
    const s = await palmLogin();
    zto(() => ({ status: true, result: { list: signedRows(100), pages: 3, total: 250 } }));
    expect(JSON.parse((await call(sweep(), { 'x-zoe-palm-token': s })).body)).toMatchObject({ pages: 3, total: 250 });
    zto(() => ({ status: true, result: { list: signedRows(7) } }));
    const short = JSON.parse((await call(sweep(), { 'x-zoe-palm-token': s })).body);
    expect({ pages: short.pages, pagesUnknown: short.pagesUnknown }).toEqual({ pages: 1, pagesUnknown: undefined });
});

it.each([undefined, null, '', false, 0])('① Cookie sweep ៖ full page · pages=%j ➜ never the last page', async (pages) => {
    zto(() => ({}), () => ({ code: '0', data: { result: argusRows(100), ...(pages === undefined ? {} : { pages, total: null }) } }));
    const b = JSON.parse((await call({ list: '1', signed: '1', exact: '1', ...range, page: '1' }, ID())).body);
    expect({ pages: b.pages, pagesUnknown: b.pagesUnknown }).toEqual({ pages: 2, pagesUnknown: true });
});

it.each([[{ list: null, total: 0, pages: 0 }, '1'], [{ total: 0, pages: 1 }, '1'], [{ list: null, total: 7, pages: 1 }, '2']])(
    '② Palm %j page %s ➜ an empty page (200), like the candidates reader', async (result, page) => {
        zto(() => ({}));
        const s = await palmLogin();
        zto(() => ({ status: true, result }));
        expect((await call({ palm: '1', list: '1', candidates: '1', tabs: '5', ...range, page }, { 'x-zoe-palm-token': s })).statusCode).toBe(200);
        const r = await call(sweep(page), { 'x-zoe-palm-token': s });
        const body = JSON.parse(r.body);
        expect({ status: r.statusCode, code: body.code, signed: body.signed }).toEqual({ status: 200, code: undefined, signed: [] });
    });

it('② control ៖ a missing list on a page that should hold rows stays a failure', async () => {
    zto(() => ({}));
    const s = await palmLogin();
    zto(() => ({ status: true, result: { list: null, total: 250, pages: 3 } }));
    expect((await call(sweep('2'), { 'x-zoe-palm-token': s })).statusCode).toBe(502);
});

it('② two bound branches ៖ page 2 of the busier one reads while the other is past its end ➜ 200 with every sign', async () => {
    vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT + ':kh001|kh002');
    const codesB = signedRows(105);
    zto((token, body) => token === 'zto-token-1'
        ? { status: true, result: body.pageNum === 1 ? { list: signedRows(1), pages: 1, total: 1 } : { list: null, pages: 1, total: 1 } }
        : { status: true, result: { list: codesB.slice((body.pageNum - 1) * 100, body.pageNum * 100), pages: 2, total: 105 } });
    await palmLogin('a');
    await palmLogin('b');
    expect(JSON.parse((await call(sweep('1'), { 'x-zoe-palm-site': 'KH001' })).body)).toMatchObject({ pages: 2, signedOk: true });
    const p2 = await call(sweep('2'), { 'x-zoe-palm-site': 'KH001' });
    const body = JSON.parse(p2.body);
    expect({ status: p2.statusCode, code: body.code, signed: body.signed && body.signed.length }).toEqual({ status: 200, code: undefined, signed: 5 });
});

it('② Cookie ៖ `result: null` with total 0 ➜ an empty page (200)', async () => {
    zto(() => ({}), () => ({ success: true, data: { result: null, total: 0, pages: 0 } }));
    const r = await call({ list: '1', signed: '1', exact: '1', ...range, page: '1' }, ID());
    const body = JSON.parse(r.body);
    expect({ status: r.statusCode, code: body.code, signed: body.signed }).toEqual({ status: 200, code: undefined, signed: [] });
});

it('② Cookie control ៖ an answer without any list on a page that should hold rows stays a failure', async () => {
    zto(() => ({}), () => ({ success: true, data: { result: null, total: 250, pages: 3 } }));
    expect((await call({ list: '1', signed: '1', exact: '1', ...range, page: '2' }, ID())).statusCode).toBe(502);
});

it('③ returned · sent · problem list reads never count as scans (🩺 meter)', async () => {
    zto(() => ({}), () => ({ code: '0', data: { result: [], pages: 1, total: 0 } }));
    for (const kind of ['returned', 'sent', 'problem']) expect((await call({ list: '1', [kind]: '1', ...range, page: '1' }, ID())).statusCode).toBe(200);
    const timing = JSON.parse((await call({ diag: '1' })).body).upstreamTiming;
    expect({ scans: timing.detail.count, lists: timing.list.count }).toEqual({ scans: 0, lists: 3 });
});
