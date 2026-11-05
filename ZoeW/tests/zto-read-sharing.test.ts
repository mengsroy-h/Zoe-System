/** សំណើម្ចាស់គម្រោង 2026-10-24៖ វាស់ និងបង្កើនល្បឿន Cookie/Blob និង ZTO Login ដោយរក្សាការផ្ទៀងផ្ទាត់អត្តសញ្ញាណ និងការរក្សាទុកដដែល។ */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const req = createRequire(import.meta.url);
const fn = req('../netlify/functions/_shared/zto-order-detail-core.cjs');
const KEY = 'read-sharing-proxy-0123456789';
const COOKIE = 'BOS-MAN-SESSION=synthetic-cookie-a-1234';
const NEW_COOKIE = 'BOS-MAN-SESSION=synthetic-cookie-b-1234';
const BARCODE = 'SYNTHETIC0001';
const listQuery = { list: '1', from: '2026-10-24', to: '2026-10-24', page: '1', withSigned: '1' };
const savedEnv: Record<string, string | undefined> = {};
const envNames = ['ZTO_PROXY_KEY', 'ZTO_COOKIE', 'ZTO_TOKEN', 'ZTO_AUTHORIZATION', 'ZTO_CACHE_TTL_MS', 'ZTO_UPSTREAM_RETRIES', 'ZTO_UPSTREAM_TIMEOUT_MS', 'ZTO_REQUEST_BUDGET_MS', 'ZTO_DETAIL_IDENTITY', 'ZTO_DETAIL_BRANCH_PATHS', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'];
const etag = (value: string) => '"' + crypto.createHash('sha256').update(value).digest('hex') + '"';
const entry = (data = COOKIE, synced = false) => ({ data, etag: etag(data), metadata: synced ? { syncedAt: Date.now() - 3600000 } : {} });
const token = (sub = 'synthetic-user') => [ { alg: 'HS256', typ: 'JWT' }, { iss: 'https://audit.invalid/auth/v1', role: 'authenticated', sub, exp: Math.floor(Date.now() / 1000) + 3600 } ].map((v) => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.') + '.signature';
function deferred<T = any>() { let resolve!: (v: T) => void; let reject!: (e: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const ticks = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const response = (data: any, status = 200, cookie = '') => {
    const out = new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    Object.defineProperty(out.headers, 'getSetCookie', { value: () => cookie ? [cookie + '; Path=/'] : [] });
    return out;
};
const order = () => response({ code: '0', data: { billCode: BARCODE, consigneePhone: '012345678', agentAmount: 5, arrivalServiceCharge: 1 } });
const list = (cookie = '') => response({ code: '0', data: { records: [], pages: 1, total: 0 } }, 200, cookie);
const identity = () => response([{ status: 'active', branch_code: '700001' }]);
function call(query: Record<string, string> = { barcode: BARCODE }, id = token(), blobs = 'synthetic-context') {
    return fn.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-id-token': id, 'x-nf-site-id': 'site-a', 'x-nf-deploy-id': 'deploy-a' }, queryStringParameters: query, blobs });
}
function useStore(get: any, set: any = vi.fn(async () => ({ modified: true, etag: 'next' }))) {
    fn.setBlobsModuleForTests({ connectLambda() {}, getStore() { return { getWithMetadata: get, set }; } });
    return { get, set };
}

beforeEach(() => {
    envNames.forEach((key) => { savedEnv[key] = process.env[key]; delete process.env[key]; });
    Object.assign(process.env, { ZTO_PROXY_KEY: KEY, ZTO_CACHE_TTL_MS: '0', ZTO_UPSTREAM_RETRIES: '0', SUPABASE_URL: 'https://audit.invalid', SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable-key' });
    fn.resetCachesForTests();
});
afterEach(() => {
    fn.resetCachesForTests(); fn.setBlobsModuleForTests(null); vi.useRealTimers(); vi.unstubAllGlobals();
    envNames.forEach((key) => { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key]; });
});

describe('ការអាន ZTO ចែករំលែកតែសំណើកំពុងរង់ចាំ ហើយរក្សាព្រំដែនសំណើនីមួយៗ', () => {
    it('ស្កេនដំបូង ៨ ព្រមគ្នា អាន Cookie ម្តង និងសួរ ZTO ម្តងសម្រាប់កញ្ចប់ដដែល', async () => {
        const pending = deferred(); const get = vi.fn(() => pending.promise); useStore(get);
        const fetch = vi.fn(async () => order()); vi.stubGlobal('fetch', fetch);
        const runs = Array.from({ length: 8 }, () => call()); await ticks();
        expect.soft(get).toHaveBeenCalledTimes(1);
        pending.resolve(entry()); const results = await Promise.all(runs);
        expect(results.every((r) => JSON.parse(r.body).found === true)).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('បញ្ជីមកដល់ ត្រឡប់ និងបញ្ជូនចេញ ប្រើការផ្ទៀងផ្ទាត់រួមម្តងសម្រាប់ token ដូចគ្នា', async () => {
        const pending = deferred(); const rpc = vi.fn(() => pending.promise);
        useStore(vi.fn(async () => entry()));
        vi.stubGlobal('fetch', vi.fn((url: string) => url.startsWith('https://audit.invalid/') ? rpc() : Promise.resolve(list())));
        const sharedToken = token();
        const runs = [call(listQuery, sharedToken), call({ ...listQuery, withSigned: '0', returned: '1' }, sharedToken), call({ ...listQuery, withSigned: '0', sent: '1' }, sharedToken)];
        await ticks(); expect.soft(rpc).toHaveBeenCalledTimes(1); pending.resolve(identity());
        expect((await Promise.all(runs)).every((r) => JSON.parse(r.body).success)).toBe(true);
    });

    it('token ឬ publishable key ខុសគ្នា មិនចែករំលែកសំណើផ្ទៀងផ្ទាត់ដែលកំពុងរង់ចាំ', async () => {
        const pending = deferred(); const rpc = vi.fn(() => pending.promise.then(() => identity()));
        useStore(vi.fn(async () => entry()));
        vi.stubGlobal('fetch', vi.fn((url: string) => url.startsWith('https://audit.invalid/') ? rpc() : Promise.resolve(list())));
        const a = call(listQuery, token('a')); const b = call(listQuery, token('b')); await ticks();
        process.env.SUPABASE_PUBLISHABLE_KEY = 'second-publishable-key';
        const c = call(listQuery, token('a')); await ticks(); expect(rpc).toHaveBeenCalledTimes(3);
        pending.resolve(null); expect((await Promise.all([a, b, c])).every((r) => JSON.parse(r.body).success)).toBe(true);
    });

    it('បរិបទ Blob ខុសគ្នា មិនចែករំលែកការអាន Cookie ដែលកំពុងរង់ចាំ', async () => {
        const pending = deferred(); const get = vi.fn(() => pending.promise); useStore(get); vi.stubGlobal('fetch', vi.fn(async () => order()));
        const a = call(undefined, undefined, 'context-a'); const b = call(undefined, undefined, 'context-b'); await ticks();
        expect(get).toHaveBeenCalledTimes(2); pending.resolve(entry()); await Promise.all([a, b]);
    });

    it('Diagnostics fresh អាន Cookie ថ្មីដោយឡែក ហើយចម្លើយចាស់មកយឺតមិនជាន់ Cookie ថ្មី', async () => {
        const old = deferred(); const get = vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValue(entry(NEW_COOKIE)); useStore(get);
        const cookies: string[] = []; vi.stubGlobal('fetch', vi.fn(async (_url, init) => { cookies.push(init.headers.Cookie); return order(); }));
        const lookup = call(); await ticks(); const fresh = await call({ diag: '1', fresh: '1' }); expect(fresh.statusCode).toBe(200);
        old.resolve(entry()); await lookup; expect(get.mock.calls.filter(([key]) => key === 'cookie')).toHaveLength(2); expect(cookies).toEqual([NEW_COOKIE]);
    });

    it('ការអាន Cookie រួមបរាជ័យ ត្រូវដកចេញ ដើម្បីឱ្យស្កេនបន្ទាប់អានឡើងវិញបាន', async () => {
        const pending = deferred(); const get = vi.fn().mockImplementationOnce(() => pending.promise).mockResolvedValue(entry()); useStore(get);
        vi.stubGlobal('fetch', vi.fn(async () => order()));
        const runs = [call(), call()]; await ticks(); pending.reject(new Error('synthetic store outage'));
        expect((await Promise.all(runs)).every((r) => r.statusCode === 503)).toBe(true);
        expect(JSON.parse((await call()).body).found).toBe(true); expect(get).toHaveBeenCalledTimes(2);
    });

    it('ការផ្ទៀងផ្ទាត់រួមបរាជ័យ ត្រូវដកចេញ ហើយមិនរក្សាទុកថាជាគណនីបានផ្ទៀងផ្ទាត់', async () => {
        const pending = deferred(); const rpc = vi.fn().mockImplementationOnce(() => pending.promise).mockResolvedValue(identity());
        useStore(vi.fn(async () => entry())); vi.stubGlobal('fetch', vi.fn((url: string) => url.startsWith('https://audit.invalid/') ? rpc() : Promise.resolve(list())));
        const runs = [call(listQuery), call(listQuery)]; await ticks(); pending.reject(new Error('synthetic identity outage'));
        expect((await Promise.all(runs)).every((r) => JSON.parse(r.body).reason === 'idtoken:supabase-unreachable')).toBe(true);
        expect(JSON.parse((await call(listQuery)).body).success).toBe(true); expect(rpc).toHaveBeenCalledTimes(2);
    });

    it('សំណើថវិកាពេលខ្លី មិនផ្តាច់ការផ្ទៀងផ្ទាត់រួមរបស់អ្នករង់ចាំដែលនៅមានពេល', async () => {
        vi.useFakeTimers(); const rpc = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve(identity()), 2000)));
        useStore(vi.fn(async () => entry())); vi.stubGlobal('fetch', vi.fn((url: string) => url.startsWith('https://audit.invalid/') ? rpc() : Promise.resolve(list())));
        process.env.ZTO_REQUEST_BUDGET_MS = '4000'; process.env.ZTO_UPSTREAM_TIMEOUT_MS = '2500'; const short = call(listQuery);
        await ticks(); process.env.ZTO_REQUEST_BUDGET_MS = '9000'; const long = call(listQuery); await ticks();
        await vi.advanceTimersByTimeAsync(1600); expect(JSON.parse((await short).body).reason).toBe('idtoken:supabase-unreachable');
        await vi.advanceTimersByTimeAsync(500); expect(JSON.parse((await long).body).success).toBe(true); expect(rpc).toHaveBeenCalledTimes(1);
    });

    it('ការផ្ទៀងផ្ទាត់ព្យួរ ត្រូវដកចេញនៅពិដានពេល ហើយចម្លើយយឺតមិនជាន់អត្តសញ្ញាណដែលបានអានថ្មី', async () => {
        vi.useFakeTimers(); const hung = deferred(); const rpc = vi.fn().mockImplementationOnce(() => hung.promise).mockImplementation(async () => identity());
        useStore(vi.fn(async () => entry())); vi.stubGlobal('fetch', vi.fn((url: string) => url.startsWith('https://audit.invalid/') ? rpc() : Promise.resolve(list())));
        const first = call(listQuery); await vi.advanceTimersByTimeAsync(3100);
        expect(JSON.parse((await first).body).reason).toBe('idtoken:supabase-unreachable');
        expect(JSON.parse((await call(listQuery)).body).success).toBe(true); expect(rpc).toHaveBeenCalledTimes(2);
        hung.resolve(response([{ status: 'revoked', branch_code: '999999' }])); await ticks();
        expect(JSON.parse((await call(listQuery)).body).site).toBe('700001'); expect(rpc).toHaveBeenCalledTimes(2);
    });

    it('ការអាន Cookie ព្យួរ ត្រូវដកចេញនៅពិដានពេល ហើយ Cookie ចាស់មកយឺតមិនជាន់លទ្ធផលថ្មី', async () => {
        vi.useFakeTimers(); const hung = deferred(); const get = vi.fn().mockImplementationOnce(() => hung.promise).mockResolvedValue(entry(NEW_COOKIE));
        useStore(get); const cookies: string[] = []; vi.stubGlobal('fetch', vi.fn(async (_url, init) => { cookies.push(init.headers.Cookie); return order(); }));
        const first = call(); await vi.advanceTimersByTimeAsync(3100); expect((await first).statusCode).toBe(503);
        expect(JSON.parse((await call()).body).found).toBe(true); expect(get).toHaveBeenCalledTimes(2);
        hung.resolve(entry()); await ticks(); await call(); expect(cookies).toEqual([NEW_COOKIE, NEW_COOKIE]);
    });

    it('ការកត់អាយុ Cookie ចាំបញ្ជី Sign ឆ្លើយ ហើយសំណើនៅរង់ចាំការកត់មុនឆ្លើយ', async () => {
        const signed = deferred(); const persisted = deferred(); const get = vi.fn(async (key) => key === 'cookie' ? entry(COOKIE, true) : null);
        const set = vi.fn(() => persisted.promise); useStore(get, set);
        vi.stubGlobal('fetch', vi.fn(async (url, init) => url.startsWith('https://audit.invalid/') ? identity() : JSON.parse(init.body).condition.scanTypeCode === '05' ? signed.promise : list()));
        let done = false; const result = call(listQuery).then((r) => { done = true; return r; }); await ticks();
        expect(get.mock.calls.filter(([key]) => key === 'cookie-life')).toHaveLength(0); expect(set).not.toHaveBeenCalled(); expect(done).toBe(false);
        signed.resolve(list()); await ticks();
        expect(get.mock.calls.filter(([key]) => key === 'cookie-life')).toHaveLength(1); expect(set).toHaveBeenCalledTimes(1); expect(done).toBe(false);
        persisted.resolve({ modified: true, etag: 'saved' }); expect(JSON.parse((await result).body).success).toBe(true);
    });

    it('សំណើមួយទៀតបដិសេធ Cookie ពេលបញ្ជី Sign នៅរង់ចាំ មិនត្រូវបាត់ត្រាបដិសេធក្នុង Blob', async () => {
        vi.useFakeTimers(); vi.setSystemTime(Date.UTC(2026, 9, 24, 3));
        const entries = new Map<string, any>([['cookie', entry(COOKIE, true)]]);
        const get = vi.fn(async (key: string) => entries.get(key) || null);
        const set = vi.fn(async (key: string, value: string, options: any) => {
            await new Promise((resolve) => setTimeout(resolve, 80));
            const prior = entries.get(key);
            if (options.onlyIfNew && prior || options.onlyIfMatch && options.onlyIfMatch !== prior?.etag) return { modified: false };
            const next = { data: value, etag: etag(value), metadata: options.metadata || {} };
            entries.set(key, next);
            return { modified: true, etag: next.etag };
        });
        useStore(get, set);
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            if (url.startsWith('https://audit.invalid/')) return identity();
            const request = JSON.parse(init.body);
            if (!request.condition) return response({ code: '401' }, 401);
            if (request.condition.scanTypeCode === '05') await new Promise((resolve) => setTimeout(resolve, 200));
            return list();
        }));
        const accepted = call(listQuery);
        await vi.advanceTimersByTimeAsync(15);
        const rejected = call();
        await vi.advanceTimersByTimeAsync(300);
        expect((await accepted).statusCode).toBe(200);
        expect((await rejected).statusCode).toBe(401);
        const saved = JSON.parse(entries.get('cookie-life').data).lives[0];
        expect(saved.r).toBeGreaterThan(saved.a);
    });

    it('ការសួរ ZTO ចម្បងបរាជ័យ មិនកត់ថា Cookie ត្រូវបានទទួល', async () => {
        const get = vi.fn(async () => entry(COOKIE, true)); const { set } = useStore(get);
        vi.stubGlobal('fetch', vi.fn(async () => response({}, 500)));
        expect((await call()).statusCode).toBe(502); expect(set).not.toHaveBeenCalled(); expect(get).toHaveBeenCalledTimes(1);
    });

    it('Cookie ថ្មីពីបញ្ជី Sign ត្រូវរក្សាទុកក្រោយបញ្ជីនោះឆ្លើយ ជាមួយការកត់អាយុ', async () => {
        const signed = deferred(); const get = vi.fn(async (key) => key === 'cookie' ? entry(COOKIE, true) : null);
        const set = vi.fn(async (_key: string, _value: string, _options: any) => ({ modified: true, etag: 'saved' })); useStore(get, set);
        vi.stubGlobal('fetch', vi.fn(async (url, init) => url.startsWith('https://audit.invalid/') ? identity() : JSON.parse(init.body).condition.scanTypeCode === '05' ? signed.promise : list()));
        const result = call(listQuery); await ticks(); expect(set.mock.calls.filter(([key]) => key === 'cookie')).toHaveLength(0);
        signed.resolve(list(NEW_COOKIE)); await result;
        expect(set.mock.calls.filter(([key]) => key === 'cookie')).toHaveLength(1);
        expect(set.mock.calls.find(([key]) => key === 'cookie')?.[1]).toBe(NEW_COOKIE);
    });
});
