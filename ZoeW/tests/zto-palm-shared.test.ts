// @vitest-environment node
/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «អោយ ZTO Palm login ដំណើរការដូច Cookie blob 100%»។
 *    Login ZTO Palm ម្តង ➜ Function ទុក session Palm របស់ហាង (អ៊ិនគ្រីបដោយ `ZTO_PALM_SESSION_SECRET` · ចងនឹងសោភ្ជាប់) ក្នុង Netlify Blobs
 *    (`zto-auth` · `palm-session/<label>`) ➜ ទូរស័ព្ទគ្រប់គ្រឿងដែលមានសោភ្ជាប់ដដែលស្កេន · ទាញបញ្ជី · ពិនិត្យស្ថានភាព ដោយមិន Login ·
 *    ZTO បដិសេធ session ➜ Function Login ឡើងវិញដោយខ្លួនឯង (ម្តង · single-flight · CAS) ហើយសាកម្តងទៀត · ZTO បដិសេធគណនី ➜ ទុកសញ្ញា «បដិសេធ»
 *    ឲ្យគ្រប់ container ឈប់ Login · Blobs ធ្លាក់/គាំង ➜ memory នៅបម្រើ · ហាងផ្សេង (សោផ្សេង) មិនឃើញ session គ្នា។
 *    Function ពិត (`zto-order-detail.js` ➜ `_shared/zto-palm.js`) + Blobs ក្លែង (ETag ពិត) + ZTO Palm ក្លែង។
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const fn = require('../netlify/functions/zto-order-detail.js');
const KEY_A = 'shop-a-proxy-key-0123456789abcdef';
const KEY_B = 'shop-b-proxy-key-0123456789abcdef';
const CODE = '77130500000012';
const PASSWORD = 'shared-palm-password';
const USER = 'shared-palm-user';
const BLOBS = Buffer.from(JSON.stringify({ url: 'https://blobs.netlify.test', token: 't' })).toString('base64');

type Entry = { value: string; etag: string };
let entries: Map<string, Entry>;
let hangReads = false;
let failWrites = false;
let reads = 0;
let tokens = 0;
let logins: Array<Record<string, unknown>>;
let dead: Set<string>;
let loginAnswer: null | ((body: any) => Response | Promise<Response>);
let seen: string[];

const etagOf = (value: string) => '"' + createHash('sha256').update(value).digest('hex') + '"';

function respond(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function useBlobs() {
    entries = new Map();
    const store = {
        async getWithMetadata(key: string) {
            reads++;
            if (hangReads) return new Promise(() => {});
            const e = entries.get(key);
            return e ? { data: e.value, etag: e.etag, metadata: {} } : null;
        },
        async set(key: string, value: string, options: any) {
            if (failWrites) throw new Error('blobs down');
            const e = entries.get(key);
            if (options && options.onlyIfMatch && (!e || e.etag !== options.onlyIfMatch)) return { modified: false };
            if (options && options.onlyIfNew && e) return { modified: false };
            entries.set(key, { value, etag: etagOf(value + Math.random()) });
            return { modified: true, etag: entries.get(key)!.etag };
        },
        async delete(key: string) { entries.delete(key); }
    };
    fn.setBlobsModuleForTests({ connectLambda() {}, getStore(name: string) { expect(name).toBe('zto-auth'); return store; } });
}

function installZto() {
    vi.stubGlobal('fetch', vi.fn(async (url: any, init: any) => {
        const path = new URL(String(url)).pathname;
        const body = JSON.parse(String(init.body));
        const token = String(init.headers['x-token'] || '');
        if (path === '/zto/system/v1/doLogin') {
            logins.push(body);
            if (loginAnswer) return loginAnswer(body);
            tokens++;
            return respond({ status: true, result: { token: 'zto-token-' + tokens, countryCode: 'KH', siteCode: 'KH001', siteName: 'Test branch' } });
        }
        seen.push(token);
        if (dead.has(token)) return respond({ status: false, statusCode: 'token_expired' });
        if (path === '/zto/basic/v1/billInfoQuery') return respond({ status: true, result: { billCode: CODE, consigneeMobile: '012345678', cod: '6.55', dod: '1.25' } });
        if (path === '/zto/locus/v1/queryTrackInfo') return respond({ status: true, result: [] });
        return respond({}, 500);
    }));
}

function call(query: Record<string, string>, opts: { key?: string; session?: string; method?: string; body?: unknown; blobs?: boolean } = {}) {
    const headers: Record<string, string> = { 'x-zoe-proxy-key': opts.key || KEY_A };
    if (opts.session) headers['x-zoe-palm-token'] = opts.session;
    const event: any = { httpMethod: opts.method || (opts.body === undefined ? 'GET' : 'POST'), headers, queryStringParameters: query,
        body: opts.body === undefined ? '' : JSON.stringify(opts.body) };
    if (opts.blobs !== false) event.blobs = BLOBS;
    return fn.handler(event);
}

const login = (key = KEY_A, user = USER) => call({ palm: 'login' }, { key, body: { username: user, password: PASSWORD, deviceSn: 'zoew-owner-device' } });
const scan = (opts: { key?: string; session?: string; blobs?: boolean } = {}) => call({ palm: '1', barcode: CODE }, opts);
const parse = (res: any) => JSON.parse(res.body);

function coldContainer() {
    fn.resetCachesForTests();
}

beforeEach(() => {
    vi.stubEnv('ZTO_PROXY_KEY', '');
    vi.stubEnv('ZTO_PROXY_KEYS', 'shopa=' + KEY_A + ',shopb=' + KEY_B);
    vi.stubEnv('ZTO_PALM_SESSION_SECRET', 'synthetic-server-session-secret-at-least-32-characters');
    vi.stubEnv('ZTO_PALM_SIGN_KEY', 'synthetic-palm-sign-key');
    vi.stubEnv('ZTO_PALM_PASSWORD_KEY', 'zoew-test-aes-16');
    vi.stubEnv('ZTO_DETAIL_IDENTITY', '');
    vi.stubEnv('ZTO_DETAIL_BRANCH_PATHS', '');
    vi.stubEnv('FIREBASE_PROJECT_IDS', '');
    hangReads = false;
    failWrites = false;
    reads = 0;
    tokens = 0;
    logins = [];
    dead = new Set();
    loginAnswer = null;
    seen = [];
    useBlobs();
    installZto();
    coldContainer();
});

afterEach(() => {
    fn.setBlobsModuleForTests(null);
    coldContainer();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('ZTO Palm Login ម្តង ➜ session របស់ហាងនៅលើ Server (ដូច Cookie Blob)', () => {
    it('Login ទុក session អ៊ិនគ្រីបក្នុង Blob របស់សោនោះ ➜ ទូរស័ព្ទផ្សេង (គ្មាន session) ស្កេនបាន · container ថ្មីក៏ប្រើបាន', async () => {
        const res = await login();
        expect(res.statusCode).toBe(200);
        expect(parse(res)).toMatchObject({ success: true, shared: true, account: { siteCode: 'KH001', siteName: 'Test branch' } });
        expect([...entries.keys()]).toEqual(['palm-session/shopa']);
        const text = entries.get('palm-session/shopa')!.value;
        for (const secret of [PASSWORD, USER, 'zto-token-1', KEY_A]) expect(text, 'Blob គ្មានអក្សរច្បាស់ ' + secret).not.toContain(secret);
        const other = await scan();
        expect(other.statusCode).toBe(200);
        expect(parse(other)).toMatchObject({ found: true, phone: '012345678', cod: 6.55, dod: 1.25 });
        expect(seen).toEqual(['zto-token-1']);
        coldContainer();
        const cold = await scan();
        expect(cold.statusCode, 'container ថ្មីអាន Blob').toBe(200);
        expect(seen).toEqual(['zto-token-1', 'zto-token-1']);
        expect(logins).toHaveLength(1);
    });

    it('ហាងផ្សេង (សោភ្ជាប់ផ្សេង) មិនឃើញ session គ្នា ៖ 401 palm:no-session មិនផ្ញើទៅ ZTO', async () => {
        await login();
        const res = await scan({ key: KEY_B });
        expect(res.statusCode).toBe(401);
        expect(parse(res)).toMatchObject({ code: 'ZTO_AUTH_EXPIRED', reason: 'palm:no-session' });
        expect(seen).toEqual([]);
        expect(parse(await call({ palm: 'status' }, { key: KEY_B }))).toMatchObject({ success: true, shared: false });
        expect(parse(await call({ palm: 'status' }))).toMatchObject({ success: true, shared: true, account: { siteCode: 'KH001' } });
    });

    it('Blob របស់សោមួយ ផ្ទេរទៅសោផ្សេង (ចម្លង) ➜ បើកមិនបាន (ចងនឹងសោភ្ជាប់)', async () => {
        await login();
        entries.set('palm-session/shopb', entries.get('palm-session/shopa')!);
        coldContainer();
        const res = await scan({ key: KEY_B });
        expect(res.statusCode).toBe(401);
        expect(seen).toEqual([]);
    });

    it('ZTO បដិសេធ session ➜ Function Login ឡើងវិញម្តង (single-flight) ទោះស្កេនព្រមគ្នា ៥ · សរសេរ Blob ថ្មី · ស្កេនទាំងអស់ជោគជ័យ', async () => {
        await login();
        dead.add('zto-token-1');
        const results = await Promise.all(Array.from({ length: 5 }, () => scan()));
        expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200, 200, 200]);
        expect(logins, 'Login ZTO តែម្តង').toHaveLength(2);
        expect(logins[1]).toEqual(logins[0]);
        coldContainer();
        await scan();
        expect(seen[seen.length - 1], 'container ថ្មីអាន session ថ្មីពី Blob').toBe('zto-token-2');
        expect(logins).toHaveLength(2);
    });

    it('container ផ្សេង Login ឡើងវិញរួច ➜ container នេះអាន Blob ឃើញ token ថ្មី មិន Login ម្តងទៀត', async () => {
        await login();
        await scan();
        const own = entries.get('palm-session/shopa')!;
        coldContainer();
        await login();
        const renewed = entries.get('palm-session/shopa')!;
        entries.set('palm-session/shopa', own);
        coldContainer();
        await scan();
        entries.set('palm-session/shopa', renewed);
        dead.add('zto-token-1');
        const res = await scan();
        expect(res.statusCode).toBe(200);
        expect(logins, 'អាន Blob មុន Login').toHaveLength(2);
        expect(seen.slice(-2)).toEqual(['zto-token-1', 'zto-token-2']);
    });

    it('ZTO បដិសេធគណនីពេល Login ឡើងវិញ (ប្តូរពាក្យសម្ងាត់) ➜ សញ្ញាបដិសេធក្នុង Blob ➜ គ្រប់ container ឈប់ Login · ប្រាប់ឲ្យ Login ម្តងទៀត', async () => {
        await login();
        dead.add('zto-token-1');
        loginAnswer = () => respond({ status: false, statusCode: 'login_password_error' });
        const first = await scan();
        expect(first.statusCode).toBe(401);
        expect(parse(first)).toMatchObject({ code: 'ZTO_AUTH_EXPIRED', reason: 'palm:login-rejected' });
        expect(logins).toHaveLength(2);
        coldContainer();
        const later = await scan();
        expect(parse(later)).toMatchObject({ code: 'ZTO_AUTH_EXPIRED', reason: 'palm:login-rejected' });
        expect(logins, 'container ថ្មីមិន Login គណនីដែល ZTO បដិសេធ').toHaveLength(2);
        expect(parse(await call({ palm: 'status' }))).toMatchObject({ shared: false, rejected: true });
        loginAnswer = null;
        expect((await login()).statusCode).toBe(200);
        expect((await scan()).statusCode, 'Login ដោយដៃម្តងទៀត ➜ ប្រើបានវិញ').toBe(200);
    });

    it('Login ឡើងវិញធ្លាក់បណ្ដាញ ➜ 503 (សាកម្តងទៀត) មិនមែន 401 · មិនលុប session · មិន Login ញឹកញាប់', async () => {
        await login();
        dead.add('zto-token-1');
        loginAnswer = () => { throw new TypeError('fetch failed'); };
        const res = await scan();
        expect(res.statusCode).toBe(503);
        expect(parse(res)).toMatchObject({ code: 'ZTO_UNAVAILABLE', reason: 'palm:renewing' });
        const again = await scan();
        expect(again.statusCode).toBe(503);
        expect(logins, 'រង់ចាំ ៦០ វិនាទីមុនសាក Login ម្តងទៀត').toHaveLength(2);
        expect(entries.has('palm-session/shopa')).toBe(true);
    });

    it('session ចាស់ ≥ ៤ ម៉ោង ➜ ឆ្លើយភ្លាមដោយ token ចាស់ ហើយ Login ឡើងវិញនៅ background ម្តង', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-17T01:00:00Z'));
        await login();
        vi.setSystemTime(new Date('2026-10-17T05:00:01Z'));
        coldContainer();
        const res = await scan();
        expect(res.statusCode).toBe(200);
        expect(seen).toEqual(['zto-token-1']);
        await vi.waitFor(() => expect(logins).toHaveLength(2));
        await vi.waitFor(async () => {
            coldContainer();
            await scan();
            expect(seen[seen.length - 1]).toBe('zto-token-2');
        });
        expect(logins).toHaveLength(2);
    });

    it('session ចាស់ ≥ ៤ ម៉ោងលើ container ច្រើន ➜ Login ឡើងវិញតែ container មួយ (lease ក្នុង Blob ដោយ CAS) · ZTO មិនឃើញ Login ព្រមគ្នា', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-17T01:00:00Z'));
        await login();
        vi.setSystemTime(new Date('2026-10-17T05:30:00Z'));
        let release!: () => void;
        loginAnswer = () => new Promise<Response>((resolve) => { release = () => resolve(respond({ status: true, result: { token: 'aged-renewal', countryCode: 'KH', siteCode: 'KH001', siteName: 'Test branch' } })); });
        coldContainer();
        expect((await scan()).statusCode).toBe(200);
        await vi.waitFor(() => expect(logins).toHaveLength(2));
        for (let other = 0; other < 3; other++) {
            coldContainer();
            expect((await scan()).statusCode, 'container ' + other).toBe(200);
        }
        await new Promise((r) => setTimeout(r, 20));
        expect(logins, 'container ផ្សេងឃើញ lease ➜ មិន Login').toHaveLength(2);
        release();
        await vi.waitFor(async () => {
            coldContainer();
            await scan();
            expect(seen[seen.length - 1]).toBe('aged-renewal');
        });
        expect(logins).toHaveLength(2);
    });

    it('Login ដោយដៃខណៈ container ផ្សេងកំពុង Login ឡើងវិញ ➜ CAS មិនសរសេរជាន់ session ថ្មី', async () => {
        await login(KEY_A, 'old-user');
        dead.add('zto-token-1');
        let release!: () => void;
        loginAnswer = (body) => {
            if (body.userName !== 'old-user') return respond({ status: true, result: { token: 'manual-token', countryCode: 'KH', siteCode: 'KH001', siteName: 'Test branch' } });
            return new Promise<Response>((resolve) => { release = () => resolve(respond({ status: true, result: { token: 'renewal-token', countryCode: 'KH', siteCode: 'KH001', siteName: 'Test branch' } })); });
        };
        const pending = scan();
        await vi.waitFor(() => expect(logins).toHaveLength(2));
        expect((await login(KEY_A, 'new-user')).statusCode).toBe(200);
        release();
        await pending;
        coldContainer();
        await scan();
        expect(seen[seen.length - 1], 'session របស់ Login ដោយដៃនៅក្នុង Blob').toBe('manual-token');
    });

    it('Blobs គាំង ➜ memory នៅបម្រើ · Blobs ធ្លាក់ពេល Login ➜ shared:false (ទូរស័ព្ទទុក session ផ្ទាល់)', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        await login();
        await scan();
        hangReads = true;
        vi.setSystemTime(Date.now() + 61000);
        const res = await scan();
        expect(res.statusCode, 'memory នៅបម្រើពេល Blobs គាំង').toBe(200);
        hangReads = false;
        failWrites = true;
        coldContainer();
        const fallback = parse(await login(KEY_B));
        expect(fallback).toMatchObject({ success: true, shared: false });
        vi.useRealTimers();
        const device = await scan({ key: KEY_B, session: fallback.sessionToken });
        expect(device.statusCode, 'session ផ្ទាល់ទូរស័ព្ទនៅប្រើបាន').toBe(200);
    });

    it('session ផ្ទាល់ទូរស័ព្ទ (កំណែចាស់) + session ហាង ➜ ប្រើ session ហាង', async () => {
        coldContainer();
        const own = parse(await login(KEY_A, 'device-user'));
        entries.clear();
        coldContainer();
        await login(KEY_A, 'shop-user');
        coldContainer();
        await scan({ session: own.sessionToken });
        await scan({ session: own.sessionToken });
        expect(seen, 'ការស្កេនដំបូងប្រើ token ទូរស័ព្ទខណៈអាន Blob · បន្ទាប់ប្រើ token ហាង').toEqual(['zto-token-1', 'zto-token-2']);
    });

    it('ទូរស័ព្ទកំណែចាស់ refresh ➜ ចូលរួម session ហាង ដោយមិន Login ZTO', async () => {
        const own = parse(await login(KEY_A, 'device-user'));
        coldContainer();
        const res = await call({ palm: 'refresh' }, { body: { refreshToken: own.refreshToken } });
        expect(res.statusCode).toBe(200);
        expect(parse(res)).toMatchObject({ shared: true });
        expect(logins).toHaveLength(1);
        entries.clear();
        coldContainer();
        const seeded = await call({ palm: 'refresh' }, { body: { refreshToken: own.refreshToken } });
        expect(parse(seeded)).toMatchObject({ shared: true });
        expect(logins, 'Blob ទទេ ➜ Login ដោយគណនីទូរស័ព្ទ ហើយបង្កើត session ហាង').toHaveLength(2);
        expect(entries.has('palm-session/shopa')).toBe(true);
    });

    it('ផ្តាច់ (POST ?palm=logout) ➜ លុប Blob ➜ ស្កេនបន្ទាប់ 401 palm:no-session', async () => {
        await login();
        expect((await scan()).statusCode).toBe(200);
        const out = await call({ palm: 'logout' }, { method: 'POST' });
        expect(out.statusCode).toBe(200);
        expect(entries.size).toBe(0);
        const res = await scan();
        expect(res.statusCode).toBe(401);
        expect(parse(res).reason).toBe('palm:no-session');
        expect(parse(await call({ palm: 'status' }))).toMatchObject({ shared: false, rejected: false });
    });

    it('🩺 ?palm=1&diag=1 ប្រាប់ប្រភព session (ហាង · ទូរស័ព្ទ · គ្មាន) ដោយមិនទាមទារ session', async () => {
        expect(parse(await call({ palm: '1', diag: '1' }))).toMatchObject({ success: true, session: { source: 'none', shared: false } });
        await login();
        const diag = parse(await call({ palm: '1', diag: '1' }));
        expect(diag).toMatchObject({ success: true, session: { source: 'shared', shared: true, site: 'KH001' } });
        expect(JSON.stringify(diag)).not.toContain('zto-token');
    });

    it('ស្កេនធម្មតាមិនអាន Blob រាល់ដង (memory ៦០ វិ)', async () => {
        await login();
        reads = 0;
        for (let i = 0; i < 5; i++) await scan();
        expect(reads).toBe(0);
    });

    it('preflight ?palm=status · ?palm=logout ជា Palm (មិនអាន Cookie Argus) · POST logout អនុញ្ញាត', async () => {
        for (const palm of ['status', 'logout']) {
            reads = 0;
            const pre = await fn.handler({ httpMethod: 'OPTIONS', headers: { origin: 'https://localhost', 'access-control-request-method': 'POST' },
                queryStringParameters: { palm }, blobs: BLOBS });
            expect(pre.statusCode).toBe(204);
            expect(reads, palm).toBe(0);
        }
    });
});
