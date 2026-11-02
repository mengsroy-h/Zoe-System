// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CORE = process.env.ZTO_COOKIE_BINDING_SOURCE || fileURLToPath(new URL('../netlify/functions/_shared/zto-order-detail-core.cjs', import.meta.url));
const require = createRequire(CORE);
const CODE = 'SYNTHETIC1001', OTHER = 'SYNTHETIC2002';
const KEY = 'synthetic-cookie-binding-proxy-key';
const ARGUS = 'https://aargus-api.ztoglobal.com', PALM = 'https://aargus-api.ztoglobal.net';
let core: any;
let reply: any;
let calls: Array<{ url: URL; init: RequestInit }>;

function order(barcode: unknown = CODE) {
    return { success: true, data: { billCode: barcode, phone: '012000111', cod: 9, dod: 1, signed: '1' } };
}

function upstream(body: unknown) {
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function call(flags: Record<string, string> = {}, barcode = CODE, session = '', input?: unknown) {
    return core.handler({ httpMethod: input === undefined ? 'GET' : 'POST',
        headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': session },
        queryStringParameters: { barcode, ...flags }, body: input === undefined ? '' : JSON.stringify(input) });
}

async function result(flags: Record<string, string> = {}, barcode = CODE) {
    const response = await call(flags, barcode);
    return { response, body: JSON.parse(response.body) };
}

function refused({ response, body }: any) {
    expect(response.statusCode).toBe(502);
    expect(body).toEqual({ error: expect.any(String), code: 'ZTO_INVALID_RESPONSE' });
    expect(response.body).not.toContain('012000111');
    expect(response.body).not.toContain(OTHER);
}

beforeEach(() => {
    for (const name of Object.keys(process.env)) if (/^(?:ZTO_|SUPABASE_|FIREBASE_PROJECT_IDS$)/.test(name)) vi.stubEnv(name, '');
    for (const [name, value] of Object.entries({ ZTO_PROXY_KEY: KEY, ZTO_COOKIE: 'BOS-MAN-SESSION=synthetic-cookie-only',
        ZTO_DETAIL_IDENTITY: 'off', ZTO_CACHE_TTL_MS: '60000', ZTO_UPSTREAM_RETRIES: '2',
        ZTO_FIELD_SIGNED: 'signed', ZTO_SIGNED_VALUES: '1',
        ZTO_PALM_SESSION_SECRET: 'synthetic-cookie-binding-session-secret-at-least-32',
        ZTO_PALM_SIGN_KEY: 'synthetic-sign-key', ZTO_PALM_PASSWORD_KEY: '1234567890abcdef' })) vi.stubEnv(name, value);
    reply = order();
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (target: string, init: RequestInit) => {
        const url = new URL(String(target));
        calls.push({ url, init });
        if (url.origin === ARGUS && url.pathname === '/scan/get/order/detail') return upstream(reply);
        if (url.origin === PALM && url.pathname === '/zto/system/v1/doLogin') return upstream({ status: true, result: {
            token: 'synthetic-palm-session-only', countryCode: 'KH', siteCode: 'AUDIT', siteName: 'Synthetic' } });
        if (url.origin === PALM && url.pathname === '/zto/basic/v1/billInfoQuery') return upstream({ status: true,
            result: { ...reply.data, consigneeMobile: reply.data.phone } });
        throw new Error('ការសាកល្បងហាមបណ្ដាញពិត និងច្រកផ្សេង');
    }));
    const sandbox = { exports: {} as any, require, process, Buffer, URL, URLSearchParams, AbortController,
        setTimeout, clearTimeout, fetch: globalThis.fetch };
    vm.runInNewContext(readFileSync(CORE, 'utf8') + '\nexports.inspectResultCache = () => resultCache;', sandbox, { filename: CORE });
    core = sandbox.exports;
    core.resetCachesForTests();
    core.setBlobsModuleForTests({ connectLambda() {}, getStore() { throw new Error('គ្មាន provider write ក្នុងតេស្តនេះ'); } });
});

afterEach(() => {
    core.resetCachesForTests();
    core.setBlobsModuleForTests(null);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('Cookie៖ ចង effective barcode មុនបញ្ចេញទិន្នន័យ និង cache', () => {
    it.each([{}, { status: '1' }, { restore: '1' }])('barcode ផ្សេងត្រូវបដិសេធជាកំហុសមិនមែន not-found (%j)', async (flags) => {
        reply = order(OTHER);
        refused(await result(flags));
        expect(calls).toHaveLength(1);
        expect(core.inspectResultCache().size).toBe(0);
        expect(calls[0].url.origin).toBe(ARGUS);
        expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ billCode: CODE });
    });

    it.each([{}, { status: '1' }, { restore: '1' }])('record ផ្សេងដែលគ្មាន customer fields មិនមែន not-found (%j)', async (flags) => {
        reply = { success: true, data: { billCode: OTHER, signed: '1' } };
        refused(await result(flags));
        expect(calls).toHaveLength(1);
        expect(core.inspectResultCache().size).toBe(0);
    });

    it.each([CODE, CODE.toLowerCase(), '  ' + CODE.toLowerCase() + '  '])('barcode ត្រូវគ្នារក្សា spelling និង fields (%j)', async (barcode) => {
        reply = order(barcode);
        const { response, body } = await result({ restore: '1' });
        expect(response.statusCode).toBe(200);
        expect(body).toMatchObject({ success: true, found: true, barcode: barcode.trim(), phone: '012000111',
            cod: 9, dod: 1, ztoClosed: true, verifiedForRestore: true, cached: false });
        expect(calls).toHaveLength(1);
    });

    it.each([undefined, null, '', '   ', {}, [], true, false])('missing/មិនបានជ្រើស identifier រក្សា ordinary fallback តែគ្មាន restore proof (%j)', async (barcode) => {
        reply = order(barcode);
        if (barcode === undefined) delete reply.data.billCode;
        expect((await result()).body).toMatchObject({ found: true, barcode: CODE, phone: '012000111', cod: 9, dod: 1 });
        expect((await result({ restore: '1' })).body).toMatchObject({ found: true, barcode: CODE, cached: false });
        expect((await result({ restore: '1' })).body.verifiedForRestore).toBeUndefined();
        expect(calls).toHaveLength(3);
    });

    it.each(['SHORT', 'ABC.DEF123', 'ABC DEF123', 'ក123456', 'A'.repeat(65), '\u0000', '\n', '\t', CODE + '\u0000', '\n' + CODE,
        CODE + '\n', CODE.slice(0, 4) + '\u007f' + CODE.slice(4), 12345, 'NaN'])('selected malformed identifier មិនអាច scrub/truncate ទៅជា match (%j)', async (barcode) => {
        reply = order(barcode);
        refused(await result());
        expect(core.inspectResultCache().size).toBe(0);
        expect(calls).toHaveLength(1);
    });

    it('requested prefix ៦៤ តួមិនផ្ទៀង identifier ដែលមាន suffix ផ្សេង', async () => {
        const barcode = 'A'.repeat(64);
        reply = order(barcode + 'FOREIGN');
        refused(await result({ restore: '1' }, barcode));
        expect(core.inspectResultCache().size).toBe(0);
    });

    it.each([
        { data: { billCode: OTHER, waybillNo: CODE } },
        { data: { billCode: OTHER }, result: { billCode: CODE } }
    ])('មិនរើស alternate field/candidate ដែល match ជំនួស selected foreign identifier (%j)', async (fields) => {
        reply = { success: true, ...fields, data: { phone: '012000111', cod: 9, ...fields.data } };
        refused(await result());
    });

    it('configured field priority ឈ្នះ default field តាម candidate ដដែល', async () => {
        vi.stubEnv('ZTO_FIELD_BARCODE', 'parcel.id');
        reply = order(OTHER);
        reply.data.parcel = { id: CODE.toLowerCase() };
        expect((await result({ restore: '1' })).body).toMatchObject({ barcode: CODE.toLowerCase(), found: true, verifiedForRestore: true });
        core.resetCachesForTests();
        reply = order(CODE);
        reply.data.parcel = { id: OTHER };
        refused(await result());
    });

    it('configured malformed field មិនត្រូវរំលងទៅ default matching field', async () => {
        vi.stubEnv('ZTO_FIELD_BARCODE', 'parcel.id');
        reply.data.parcel = { id: CODE + '\u0000' };
        refused(await result());
    });

    it('control-only selected field មិនត្រូវរំលងទៅ lower-priority matching field', async () => {
        reply.data.billCode = '\u0000';
        reply.data.waybillNo = CODE;
        refused(await result());
    });

    it('candidate priority នៅមុន configured field នៃ candidate បន្ទាប់', async () => {
        vi.stubEnv('ZTO_FIELD_BARCODE', 'parcel.id');
        reply = { success: true, data: { billCode: OTHER, phone: '012000111' }, result: { parcel: { id: CODE } } };
        refused(await result());
    });

    it('failure មិន poison positive/negative cache ហើយ healthy retry រក្សា case និង cache', async () => {
        reply = order(OTHER);
        refused(await result());
        reply = order(CODE.toLowerCase());
        expect((await result()).body).toMatchObject({ found: true, barcode: CODE.toLowerCase(), cached: false });
        expect((await result()).body).toMatchObject({ found: true, barcode: CODE.toLowerCase(), cached: true });
        expect(calls).toHaveLength(2);
    });

    it.each([OTHER, CODE + '\u0000', 'A'.repeat(65)])('positive cache ដែលមាន identifier ខុសត្រូវ evict តែ key នោះ (%j)', async (bad) => {
        expect((await result()).body.cached).toBe(false);
        reply = order(OTHER);
        expect((await result({}, OTHER)).body.found).toBe(true);
        const entries = Array.from(core.inspectResultCache().entries()) as Array<[string, any]>;
        expect(entries).toHaveLength(2);
        const [key, hit] = entries.find(([, entry]) => entry.body.barcode === CODE)!;
        hit.body.barcode = bad;
        refused(await result());
        expect(core.inspectResultCache().has(key)).toBe(false);
        expect(core.inspectResultCache().size).toBe(1);
        expect(calls).toHaveLength(2);
        expect((await result({}, OTHER)).body.cached).toBe(true);
        reply = order();
        expect((await result()).body).toMatchObject({ found: true, cached: false });
        expect((await result()).body.cached).toBe(true);
        expect(calls).toHaveLength(3);
    });

    it('matching no-customer record រក្សា status/restore verdict និង ordinary negative cache', async () => {
        reply = { success: true, data: { billCode: CODE, signed: '1' } };
        expect((await result()).body).toMatchObject({ found: false, code: 'ZTO_NOT_FOUND', cached: false });
        expect((await result()).body).toMatchObject({ code: 'ZTO_NOT_FOUND', cached: true });
        for (const flags of [{ status: '1' }, { restore: '1' }]) {
            const { response, body } = await result(flags);
            expect(response.statusCode).toBe(200);
            expect(body).toMatchObject({ found: false, code: 'ZTO_NO_CUSTOMER_DATA', ztoClosed: true, cached: false });
            expect(body.verifiedForRestore).toBeUndefined();
        }
        expect(calls).toHaveLength(3);
    });
});

it.each([CODE, OTHER])('Palm public handler រក្សា matching/mismatch contract ដាច់ពី Cookie (%s)', async (barcode) => {
    const login = await call({ palm: 'login' }, CODE, '', { username: 'synthetic-user', password: 'synthetic-only', deviceSn: 'synthetic-device' });
    expect(login.statusCode).toBe(200);
    const session = JSON.parse(login.body).sessionToken;
    expect(session).toEqual(expect.any(String));
    reply = order(barcode);
    const response = await call({ palm: '1' }, CODE, session);
    const body = JSON.parse(response.body);
    if (barcode === CODE) {
        expect(response.statusCode).toBe(200);
        expect(body).toMatchObject({ barcode: CODE, found: true, phone: '012000111', cod: 9, dod: 1, provider: 'zto-palm' });
    } else {
        expect(response.statusCode).toBe(502);
        expect(body.code).toBe('ZTO_INVALID_RESPONSE');
        expect(body.phone).toBeUndefined();
    }
    expect(calls).toHaveLength(2);
    expect(calls.every(({ url }) => url.origin === PALM)).toBe(true);
});
