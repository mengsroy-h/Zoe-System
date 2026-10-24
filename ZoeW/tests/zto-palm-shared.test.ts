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
const { tokenForSite, withCerts, TEST_PROJECT } = require('../../audit-tools/idtoken-fixture.js');
const KEY_A = 'shop-a-proxy-key-0123456789abcdef';
const KEY_B = 'shop-b-proxy-key-0123456789abcdef';
const CODE = '77130500000012';
const PASSWORD = 'shared-palm-password';
const USER = 'shared-palm-user';
const SLOT_A = 'palm-session/shopa/KH001';
const SLOT_B = 'palm-session/shopb/KH001';
const BLOBS = Buffer.from(JSON.stringify({ url: 'https://blobs.netlify.test', token: 't' })).toString('base64');

type Entry = { value: string; etag: string };
let entries: Map<string, Entry>;
let hangReads = false;
let blobReadGate: Promise<void> | null = null;
let failWrites = false;
let reads = 0;
let tokens = 0;
let logins: Array<Record<string, unknown>>;
let dead: Set<string>;
let deadCode: string;
let outage: string;
let ssoTokens: boolean;
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
            if (blobReadGate) await blobReadGate;
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

function palmToken(n: number) {
    if (!ssoTokens) return 'zto-token-' + n;
    const payload = Buffer.from(JSON.stringify({ sub: JSON.stringify({ accessToken: 'sso-token-' + n }) })).toString('base64url');
    return ['eyJhbGciOiJSUzI1NiJ9', payload, 'signature'].join('.');
}

function installZto() {
    vi.stubGlobal('fetch', vi.fn(async (url: any, init: any) => {
        const target = new URL(String(url));
        const path = target.pathname;
        if (target.hostname === 'aargus-api.ztoglobal.com') {
            const palm = /PDA_USER_COOKIE_01=([^;]+)/.exec(String(init.headers.Cookie || ''))?.[1] || '';
            seen.push(palm);
            if (dead.has(palm)) return respond({ success: false, code: 'not_login' });
            if (path === '/getUserInfo') return respond({ success: true, data: { siteCode: 'KH001' } });
            if (path === '/scan/page/scan') return respond({ success: true, data: { total: 0, result: [] } });
            return respond({}, 500);
        }
        const body = JSON.parse(String(init.body));
        const token = String(init.headers['x-token'] || '');
        if (path === '/zto/system/v1/doLogin') {
            logins.push(body);
            if (loginAnswer) return loginAnswer(body);
            tokens++;
            return respond({ status: true, result: { token: palmToken(tokens), countryCode: 'KH', siteCode: 'KH001', siteName: 'Test branch' } });
        }
        seen.push(token);
        if (outage) return respond({ status: false, statusCode: outage, message: 'system busy' });
        if (dead.has(token)) return respond({ status: false, statusCode: deadCode });
        if (path === '/zto/basic/v1/billInfoQuery') return respond({ status: true, result: { billCode: CODE, consigneeMobile: '012345678', cod: '6.55', dod: '1.25' } });
        if (path === '/zto/locus/v1/queryTrackInfo') return respond({ status: true, result: [] });
        if (path === '/zto/dispatch/v1/queryDispatchList') return respond({ status: true, result: { list: [], pages: 0, total: 0 } });
        return respond({}, 500);
    }));
}

function call(query: Record<string, string>, opts: { key?: string; session?: string; method?: string; body?: unknown; blobs?: boolean; site?: string } = {}) {
    const headers: Record<string, string> = { 'x-zoe-proxy-key': opts.key || KEY_A };
    if (opts.session) headers['x-zoe-palm-token'] = opts.session;
    if (opts.site) headers['x-zoe-palm-site'] = opts.site;
    const event: any = { httpMethod: opts.method || (opts.body === undefined ? 'GET' : 'POST'), headers, queryStringParameters: query,
        body: opts.body === undefined ? '' : JSON.stringify(opts.body) };
    if (opts.blobs !== false) event.blobs = BLOBS;
    return fn.handler(event);
}

const login = (key = KEY_A, user = USER) => call({ palm: 'login' }, { key, body: { username: user, password: PASSWORD, deviceSn: 'zoew-owner-device' } });
const scan = (opts: { key?: string; session?: string; blobs?: boolean; site?: string } = {}) => call({ palm: '1', barcode: CODE }, opts);
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
    blobReadGate = null;
    failWrites = false;
    reads = 0;
    tokens = 0;
    logins = [];
    dead = new Set();
    deadCode = 'token_expired';
    outage = '';
    ssoTokens = false;
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

describe('បញ្ជី Sign សាខាច្រើន អានព្រមគ្នាដោយរក្សាភាពពេញលេញ', () => {
    const signed = () => call({ palm: '1', list: '1', signed: '1', exact: '1', from: '2026-10-21', to: '2026-10-21', page: '1' }, { site: 'KH001' });
    const page = (codes: string[], extra: Record<string, unknown> = {}) => respond({ status: true, result: {
        list: codes.map((billCode) => ({ billCode, billStatus: '5' })), pages: 1, total: codes.length, ...extra
    } });
    async function setup() {
        vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT + ':kh001|kh002');
        loginAnswer = (body) => {
            tokens++;
            return respond({ status: true, result: { token: palmToken(tokens), countryCode: 'KH',
                siteCode: body.userName === 'branch-b-user' ? 'KH002' : 'KH001', siteName: 'Test branch' } });
        };
        await login();
        await login(KEY_A, 'branch-b-user');
    }
    function mockLists(run: (token: string) => Promise<Response> | Response) {
        const previous = globalThis.fetch;
        vi.stubGlobal('fetch', vi.fn((url: any, init: any) => new URL(String(url)).pathname === '/zto/dispatch/v1/queryDispatchList'
            ? run(String(init.headers['x-token'])) : previous(url, init)));
    }

    it('ចាប់ផ្តើមសាខា B មុនសាខា A ឆ្លើយ ហើយបញ្ចូល Sign ដោយគ្មានស្ទួន', async () => {
        await setup();
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        let siblingStarted = false;
        mockLists(async (token) => {
            if (token === 'zto-token-1') { await gate; return page([CODE]); }
            siblingStarted = true;
            return page([CODE, '77130500000013']);
        });
        const running = signed();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const overlapped = siblingStarted;
        release();
        const response = await running;
        expect(response.statusCode).toBe(200);
        expect(parse(response)).toMatchObject({ signed: [CODE, '77130500000013'], signedScans: 3, total: 3, pages: 1 });
        expect(overlapped).toBe(true);
    });

    it('token A ផុតកំណត់ ហើយសាខា B យឺត ៖ Login A ឡើងវិញភ្លាម ដោយមិនបាត់ថវិកាព្រោះ B', async () => {
        await setup();
        vi.useFakeTimers();
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '9000');
        vi.stubEnv('ZTO_UPSTREAM_TIMEOUT_MS', '6000');
        loginAnswer = async () => {
            await new Promise((resolve) => setTimeout(resolve, 150));
            tokens++;
            return respond({ status: true, result: { token: palmToken(tokens), countryCode: 'KH', siteCode: 'KH001', siteName: 'Test branch' } });
        };
        let siblingReads = 0;
        mockLists(async (token) => {
            if (token === 'zto-token-1') return respond({ status: false, statusCode: 'token_expired' });
            if (token === 'zto-token-2' && ++siblingReads === 1) await new Promise((resolve) => setTimeout(resolve, 5500));
            return page([CODE]);
        });
        const running = signed();
        await vi.advanceTimersByTimeAsync(5700);
        const response = await running;
        expect(response.statusCode).toBe(200);
        expect(parse(response)).toMatchObject({ signed: [CODE], signedOk: true });
        expect(logins.slice(2).map((entry: any) => entry.userName)).toEqual([USER]);
    });

    it.each(['auth', 'rejected', 'throw'])('សាខា A %s ៖ រក្សាកំហុស A ភ្លាម ហើយមិន Login B', async (failure) => {
        await setup();
        loginAnswer = () => respond({ status: false, statusCode: 'BAD_CREDENTIALS' });
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        mockLists(async (token) => {
            if (token === 'zto-token-1') {
                if (failure === 'throw') throw new Error('synthetic transport failure');
                return respond({ status: false, statusCode: failure === 'auth' ? 'token_expired' : 'BAD_REQUEST' });
            }
            await gate;
            return respond({ status: false, statusCode: 'token_expired' });
        });
        let settled = false;
        const running = signed().then((response) => { settled = true; return response; });
        await new Promise((resolve) => setTimeout(resolve, 20));
        const early = settled;
        release();
        const response = await running;
        expect(early).toBe(true);
        expect(response.statusCode).toBe(failure === 'auth' ? 401 : 502);
        expect(parse(response).code).toBe(failure === 'auth' ? 'ZTO_AUTH_EXPIRED' : failure === 'throw' ? 'ZTO_UNAVAILABLE' : 'ZTO_UPSTREAM_REJECTED');
        expect(logins.slice(2).map((entry: any) => entry.userName)).toEqual(failure === 'auth' ? [USER] : []);
    });

    it.each(['rejected', 'throw', 'malformed'])('សាខា B %s ៖ មិនប្រកាសបញ្ជី Sign ពេញលេញ', async (failure) => {
        await setup();
        mockLists((token) => {
            if (token === 'zto-token-1') return page([CODE]);
            if (failure === 'throw') throw new Error('synthetic transport failure');
            return failure === 'malformed' ? respond({ status: true, result: {} }) : respond({ status: false, statusCode: 'BAD_REQUEST' });
        });
        const response = await signed();
        expect(response.statusCode).toBe(503);
        expect(parse(response)).toMatchObject({ code: 'ZTO_UNAVAILABLE', reason: 'palm:branch-unread' });
        expect(logins).toHaveLength(2);
    });

    it('សាខា B ទំព័រពេញតែមិនប្រាប់ចំនួនទំព័រ ៖ ទុក pagesUnknown ហើយបន្តអាន', async () => {
        await setup();
        mockLists((token) => token === 'zto-token-1' ? page([CODE]) : page(
            Array.from({ length: 100 }, (_, index) => String(77130500100000 + index)), { pages: undefined }));
        const response = await signed();
        expect(response.statusCode).toBe(200);
        expect(parse(response)).toMatchObject({ pages: 2, pagesUnknown: true, signedScans: 101 });
        expect(parse(response).signed).toHaveLength(101);
    });
});

describe('ZTO Palm Login ម្តង ➜ session របស់ហាងនៅលើ Server (ដូច Cookie Blob)', () => {
    it('ស្កេនព្រមគ្នាក្នុង container ថ្មី ចែករំលែកការអាន Blob ម្តង ហើយទទួល session ដូចគ្នា', async () => {
        await login();
        coldContainer();
        reads = 0;
        let release!: () => void;
        blobReadGate = new Promise<void>((resolve) => { release = resolve; });
        const running = Array.from({ length: 6 }, () => scan({ site: 'KH001' }));
        await new Promise((resolve) => setTimeout(resolve, 20));
        const coldReads = reads;
        release();
        const responses = await Promise.all(running);
        expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200, 200, 200, 200]);
        expect(coldReads).toBe(1);
        expect(seen).toEqual(Array(6).fill('zto-token-1'));
    });

    it('ការអាន Blob រួមបរាជ័យ ៖ មិនរក្សា Promise ខូច ហើយការស្កេនបន្ទាប់អានឡើងវិញបាន', async () => {
        await login();
        coldContainer();
        reads = 0;
        let reject!: (error: Error) => void;
        blobReadGate = new Promise<void>((_, no) => { reject = no; });
        const running = Array.from({ length: 3 }, () => scan({ site: 'KH001' }));
        await new Promise((resolve) => setTimeout(resolve, 20));
        reject(new Error('synthetic Blob unavailable'));
        const responses = await Promise.all(running);
        expect(responses.map((response) => response.statusCode)).toEqual([401, 401, 401]);
        expect(reads).toBe(1);
        blobReadGate = null;
        expect((await scan({ site: 'KH001' })).statusCode).toBe(200);
        expect(reads).toBe(2);
    });

    it('អ្នករង់ចាំ Blob ម្នាក់ផុតថវិកា មិនពន្យារពេលគេ ហើយមិនផ្តាច់ការអានរបស់អ្នកដែលនៅមានថវិកា', async () => {
        await login();
        coldContainer();
        reads = 0;
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '4000');
        vi.stubEnv('ZTO_UPSTREAM_TIMEOUT_MS', '2000');
        vi.useFakeTimers();
        let release!: () => void;
        blobReadGate = new Promise<void>((resolve) => { release = resolve; });
        let firstDone = false;
        let secondDone = false;
        const first = scan({ site: 'KH001' }).then((response) => { firstDone = true; return response; });
        await vi.advanceTimersByTimeAsync(500);
        const second = scan({ site: 'KH001' }).then((response) => { secondDone = true; return response; });
        await vi.advanceTimersByTimeAsync(1850);
        expect([firstDone, secondDone]).toEqual([true, false]);
        expect((await first).statusCode).toBe(401);
        release();
        await vi.advanceTimersByTimeAsync(0);
        expect((await second).statusCode).toBe(200);
        expect(reads).toBe(1);
    });

    it('Login ទុក session អ៊ិនគ្រីបក្នុង Blob របស់សោនោះ ➜ ទូរស័ព្ទផ្សេង (គ្មាន session) ស្កេនបាន · container ថ្មីក៏ប្រើបាន', async () => {
        const res = await login();
        expect(res.statusCode).toBe(200);
        expect(parse(res)).toMatchObject({ success: true, shared: true, account: { siteCode: 'KH001', siteName: 'Test branch' } });
        expect([...entries.keys()].sort()).toEqual([SLOT_A, 'palm-sites/shopa']);
        expect(JSON.parse(entries.get('palm-sites/shopa')!.value)).toEqual({ v: 1, sites: ['KH001'] });
        const text = entries.get(SLOT_A)!.value;
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
        entries.set(SLOT_B, entries.get(SLOT_A)!);
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
        const own = entries.get(SLOT_A)!;
        coldContainer();
        await login();
        const renewed = entries.get(SLOT_A)!;
        entries.set(SLOT_A, own);
        coldContainer();
        await scan();
        entries.set(SLOT_A, renewed);
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
        expect(entries.has(SLOT_A)).toBe(true);
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
        expect(entries.has(SLOT_A)).toBe(true);
    });

    it('⛔ «ផ្តាច់ Palm» មិនមែនផ្លូវ Server (ម្ចាស់គម្រោង ៖ ទូរស័ព្ទមួយផ្តាច់ ទូរស័ព្ទផ្សេងលោត «ផុតកំណត់») ៖ POST ?palm=logout ➜ 405 · Blob នៅ · ទូរស័ព្ទផ្សេងស្កេនបាន', async () => {
        await login();
        expect((await scan()).statusCode).toBe(200);
        const before = new Map(entries);
        for (const site of [undefined, 'KH001']) {
            const out = await call({ palm: 'logout' }, { method: 'POST', site });
            expect(out.statusCode, 'logout ' + site).toBe(405);
        }
        expect(entries, 'Blob session និងបញ្ជីសាខាមិនប្រែ').toEqual(before);
        coldContainer();
        const res = await scan();
        expect(res.statusCode, 'ទូរស័ព្ទផ្សេងស្កេនបានដដែល').toBe(200);
        expect(parse(await call({ palm: 'status' }))).toMatchObject({ shared: true, account: { siteCode: 'KH001' } });
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

    it('preflight ?palm=status ជា Palm (មិនអាន Cookie Argus)', async () => {
        for (const palm of ['status']) {
            reads = 0;
            const pre = await fn.handler({ httpMethod: 'OPTIONS', headers: { origin: 'https://localhost', 'access-control-request-method': 'POST' },
                queryStringParameters: { palm }, blobs: BLOBS });
            expect(pre.statusCode).toBe(204);
            expect(reads, palm).toBe(0);
        }
    });

    it('សាខាផ្សេងគ្នាប្រើសោភ្ជាប់ដដែល ➜ សាខានីមួយៗមាន Login Palm ផ្ទាល់ខ្លួន (palm-session/<សោ>/<សាខា>) · ទូរស័ព្ទប្រើសាខារបស់ខ្លួន', async () => {
        loginAnswer = (body) => respond({ status: true, result: { token: 'token-of-' + body.userName, countryCode: 'KH',
            siteCode: body.userName === 'branch-b-user' ? 'KH002' : 'KH001', siteName: body.userName === 'branch-b-user' ? 'Branch B' : 'Branch A' } });
        expect(parse(await login(KEY_A, 'branch-a-user')).account).toEqual({ siteCode: 'KH001', siteName: 'Branch A' });
        expect(parse(await login(KEY_A, 'branch-b-user')).account).toEqual({ siteCode: 'KH002', siteName: 'Branch B' });
        expect(entries.has('palm-session/shopa/KH001') && entries.has('palm-session/shopa/KH002'), 'Login សាខា B មិនជាន់សាខា A').toBe(true);
        expect(JSON.parse(entries.get('palm-sites/shopa')!.value).sites).toEqual(['KH001', 'KH002']);
        coldContainer();
        expect((await scan({ site: 'KH001' })).statusCode).toBe(200);
        expect((await scan({ site: 'kh002' })).statusCode).toBe(200);
        expect(seen).toEqual(['token-of-branch-a-user', 'token-of-branch-b-user']);
        const unknown = await scan();
        expect(unknown.statusCode).toBe(401);
        expect(parse(unknown).reason, 'គ្មានសាខា ហើយសោមានច្រើនសាខា ➜ មិនទាយ').toBe('palm:branch-unknown');
        expect(seen).toHaveLength(2);
        expect(parse(await call({ palm: 'status' }))).toMatchObject({ shared: false, branchUnknown: true, sites: ['KH001', 'KH002'] });
        expect(parse(await call({ palm: 'status' }, { site: 'KH002' }))).toMatchObject({ shared: true, account: { siteCode: 'KH002', siteName: 'Branch B' } });
        expect((await call({ palm: 'logout' }, { method: 'POST', site: 'KH002' })).statusCode).toBe(405);
        expect(entries.has('palm-session/shopa/KH002') && entries.has('palm-session/shopa/KH001'), 'គ្មានផ្លូវលុប Login សាខាពី Server').toBe(true);
    });

    it('🔐 ZTO_DETAIL_IDENTITY=require ៖ ទូរស័ព្ទសាខា A ផ្ញើសាខា B ➜ មិនប្រើ session សាខា B', async () => {
        loginAnswer = (body) => respond({ status: true, result: { token: 'token-of-' + body.userName, countryCode: 'KH',
            siteCode: body.userName === 'branch-b-user' ? '67890' : '12345', siteName: '' } });
        await login(KEY_A, 'branch-a-user');
        await login(KEY_A, 'branch-b-user');
        vi.stubEnv('ZTO_DETAIL_IDENTITY', 'require');
        vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT);
        const zto = vi.mocked(fetch);
        vi.stubGlobal('fetch', withCerts(zto));
        coldContainer();
        const ownBranch = await fn.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': KEY_A, 'x-zoe-palm-site': '12345', 'x-zoe-id-token': tokenForSite('12345') },
            queryStringParameters: { palm: '1', barcode: CODE }, blobs: BLOBS });
        expect(parse(ownBranch)).toMatchObject({ found: true });
        const forged = await fn.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': KEY_A, 'x-zoe-palm-site': '67890', 'x-zoe-id-token': tokenForSite('12345') },
            queryStringParameters: { palm: '1', barcode: CODE }, blobs: BLOBS });
        expect(parse(forged)).toMatchObject({ found: false, code: 'ZTO_OTHER_BRANCH' });
        expect(seen).toEqual(['token-of-branch-a-user']);
        const status = await fn.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': KEY_A, 'x-zoe-id-token': tokenForSite('67890') },
            queryStringParameters: { palm: 'status' }, blobs: BLOBS });
        expect(parse(status), 'គណនី ZoeW សាខា B ➜ ស្ថានភាព Login សាខា B (មិនមែនបញ្ជីសាខា)').toMatchObject({ shared: true, account: { siteCode: '67890' } });
    });
});

describe('⛔ របាយការណ៍ម្ចាស់គម្រោង ៖ បិទ App មួយយប់ ➜ token ZTO របស់ហាងស្លាប់ ហើយ ZTO ឆ្លើយកូដដែលមិនមែន «ផុតកំណត់» (SYSTEM_ERROR · 502)', () => {
    const NIGHT_LOGIN = new Date('2026-10-21T10:00:00Z');
    const MORNING = new Date('2026-10-22T00:30:00Z');
    const verify = () => call({ palm: '1', diag: '1', verify: '1' });

    function overnight() {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NIGHT_LOGIN);
    }

    it('🩺 · «ប្រើ Login ZTO របស់ហាង» · ស្កេន ៖ Function Login ឡើងវិញដោយខ្លួនឯងម្តង ហើយសាកម្តងទៀត ➜ ✅ (មិនបាច់វាយពាក្យសម្ងាត់)', async () => {
        overnight();
        await login();
        dead.add('zto-token-1');
        deadCode = 'SYSTEM_ERROR';
        vi.setSystemTime(MORNING);
        coldContainer();
        expect(parse(await call({ palm: 'status' }))).toMatchObject({ success: true, shared: true, account: { siteCode: 'KH001' } });
        const health = await verify();
        expect(health.statusCode, '🩺 មិនមែន HTTP 502').toBe(200);
        expect(parse(health)).toMatchObject({ success: true, verified: true, session: { source: 'shared' } });
        expect(logins, 'Login ZTO ឡើងវិញតែម្តង').toHaveLength(2);
        expect(logins[1]).toEqual(logins[0]);
        expect(seen).toEqual(['zto-token-1', 'zto-token-2']);
        const res = await scan();
        expect(res.statusCode).toBe(200);
        expect(parse(res)).toMatchObject({ found: true, phone: '012345678' });
        coldContainer();
        expect((await scan()).statusCode, 'container ថ្មីអាន token ថ្មីពី Blob').toBe(200);
        expect(seen.slice(-2)).toEqual(['zto-token-2', 'zto-token-2']);
        expect(logins).toHaveLength(2);
    });

    it('ស្កេនដំបូងពេលព្រឹក (container ផ្សេងៗ ព្រមគ្នា ៥) ➜ Login តែម្តង · ស្កេនទាំងអស់ ✅', async () => {
        overnight();
        await login();
        dead.add('zto-token-1');
        deadCode = 'SYSTEM_ERROR';
        vi.setSystemTime(MORNING);
        coldContainer();
        const results = await Promise.all(Array.from({ length: 5 }, () => scan()));
        expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200, 200, 200]);
        expect(logins).toHaveLength(2);
    });

    it('បញ្ជីចុះហត្ថលេខា · បញ្ជីមកដល់ (SSO ឆ្លើយ success:false) · Sign ពិនិត្យស្ថានភាព ៖ token ស្លាប់ ➜ Login ឡើងវិញ ហើយសាកម្តងទៀត', async () => {
        overnight();
        ssoTokens = true;
        await login();
        const first = palmToken(1);
        dead.add(first);
        deadCode = 'SYSTEM_ERROR';
        vi.setSystemTime(MORNING);
        coldContainer();
        const signed = await call({ palm: '1', list: '1', signed: '1', exact: '1', from: '2026-10-21', to: '2026-10-21', page: '1' });
        expect(signed.statusCode, 'បញ្ជីចុះហត្ថលេខា').toBe(200);
        expect(parse(signed)).toMatchObject({ kind: 'signed', signedOk: true });
        expect(logins).toHaveLength(2);
        dead.add(palmToken(2));
        vi.setSystemTime(new Date(MORNING.getTime() + 20 * 60000));
        coldContainer();
        const arrival = await call({ palm: '1', list: '1', candidates: '1', tabs: '3', from: '2026-10-22', to: '2026-10-22', page: '1' });
        expect(arrival.statusCode, 'បញ្ជីមកដល់ (SSO)').toBe(200);
        expect(parse(arrival)).toMatchObject({ kind: 'candidates', candidates: [] });
        expect(logins).toHaveLength(3);
        dead.add(palmToken(3));
        vi.setSystemTime(new Date(MORNING.getTime() + 40 * 60000));
        coldContainer();
        const status = await call({ palm: 'sign' }, { body: { barcode: CODE, requestId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b', stage: 'status' } });
        expect(parse(status).code, 'Sign អានស្ថានភាពដោយ token ថ្មី (ZTO គ្មាន track ➜ មិនទាន់បញ្ជាក់) មិនមែន 502').toBe('ZTO_PALM_STATUS_UNCONFIRMED');
        expect(status.statusCode).toBe(409);
        expect(logins).toHaveLength(4);
        expect(seen[seen.length - 1]).toBe(palmToken(4));
    });

    it('ព្រំដែន ៖ token ទើប Login (< ១៥ នាទី) មិនសង្ស័យ ➜ ចម្លើយ ZTO ផ្ទាល់ (502 · palm:SYSTEM_ERROR) · គ្មាន Login', async () => {
        overnight();
        await login();
        dead.add('zto-token-1');
        deadCode = 'SYSTEM_ERROR';
        vi.setSystemTime(NIGHT_LOGIN.getTime() + 14 * 60000);
        const res = await scan();
        expect(res.statusCode).toBe(502);
        expect(parse(res)).toMatchObject({ code: 'ZTO_UPSTREAM_REJECTED', reason: 'palm:SYSTEM_ERROR' });
        expect(logins).toHaveLength(1);
        vi.setSystemTime(NIGHT_LOGIN.getTime() + 16 * 60000);
        expect((await scan()).statusCode, 'ផុត ១៥ នាទី ➜ សង្ស័យ ➜ Login ឡើងវិញ').toBe(200);
        expect(logins).toHaveLength(2);
    });

    it('ZTO ខ្លួនឯងមានបញ្ហា (token ថ្មីក៏ទទួល SYSTEM_ERROR) ➜ Login ម្តង ហើយឆ្លើយចម្លើយ ZTO ពិត · ≤ ១ Login ក្នុង ១៥ នាទី', async () => {
        overnight();
        await login();
        outage = 'SYSTEM_ERROR';
        vi.setSystemTime(MORNING);
        coldContainer();
        const res = await scan();
        expect(res.statusCode).toBe(502);
        expect(parse(res)).toMatchObject({ code: 'ZTO_UPSTREAM_REJECTED', reason: 'palm:SYSTEM_ERROR' });
        expect(seen).toEqual(['zto-token-1', 'zto-token-2']);
        expect(logins).toHaveLength(2);
        for (let i = 0; i < 4; i++) {
            vi.setSystemTime(MORNING.getTime() + (i + 1) * 3 * 60000);
            expect((await scan()).statusCode).toBe(502);
            expect((await verify()).statusCode).toBe(502);
        }
        expect(logins, 'មិន Login ញឹកញាប់ពេល ZTO មានបញ្ហា').toHaveLength(2);
        vi.setSystemTime(MORNING.getTime() + 16 * 60000);
        await scan();
        expect(logins).toHaveLength(3);
        outage = '';
        expect((await scan()).statusCode, 'ZTO ធូរ ➜ ប្រើបានវិញដោយខ្លួនឯង').toBe(200);
        expect(entries.has(SLOT_A)).toBe(true);
    });

    it('Login ឡើងវិញធ្លាក់បណ្ដាញ ➜ ឆ្លើយចម្លើយ ZTO ពិត (502 · palm:SYSTEM_ERROR) · session ហាងនៅ · មិន Login ម្តងទៀតក្នុង ៦០ វិ', async () => {
        overnight();
        await login();
        dead.add('zto-token-1');
        deadCode = 'SYSTEM_ERROR';
        vi.setSystemTime(MORNING);
        coldContainer();
        loginAnswer = () => { throw new TypeError('fetch failed'); };
        const res = await scan();
        expect(res.statusCode).toBe(502);
        expect(parse(res)).toMatchObject({ code: 'ZTO_UPSTREAM_REJECTED', reason: 'palm:SYSTEM_ERROR' });
        expect((await scan()).statusCode).toBe(502);
        expect(logins).toHaveLength(2);
        expect(parse(await call({ palm: 'status' }))).toMatchObject({ shared: true, rejected: false });
        loginAnswer = null;
        vi.setSystemTime(MORNING.getTime() + 61000);
        expect((await scan()).statusCode, 'បណ្ដាញវិញ ➜ Login ឡើងវិញ ➜ ✅').toBe(200);
        expect(logins).toHaveLength(3);
    });

    it('ZTO បដិសេធគណនីពេល Login ឡើងវិញ (ប្តូរពាក្យសម្ងាត់) ➜ សញ្ញាបដិសេធដូចផ្លូវ «ផុតកំណត់» ➜ 401 palm:login-rejected · មិន Login ម្តងទៀត', async () => {
        overnight();
        await login();
        dead.add('zto-token-1');
        deadCode = 'SYSTEM_ERROR';
        vi.setSystemTime(MORNING);
        coldContainer();
        loginAnswer = () => respond({ status: false, statusCode: 'login_password_error' });
        const res = await scan();
        expect(res.statusCode).toBe(401);
        expect(parse(res)).toMatchObject({ code: 'ZTO_AUTH_EXPIRED', reason: 'palm:login-rejected' });
        coldContainer();
        expect(parse(await scan())).toMatchObject({ code: 'ZTO_AUTH_EXPIRED', reason: 'palm:login-rejected' });
        expect(logins).toHaveLength(2);
        expect(parse(await call({ palm: 'status' }))).toMatchObject({ shared: false, rejected: true });
    });

    it('⛔ ZTO ខូចទាំងមូល (Lookup ក៏ Login ក៏ឆ្លើយ SYSTEM_ERROR) ➜ មិនសរសេរសញ្ញាបដិសេធ · ZTO ល្អវិញ ➜ Login ឡើងវិញដោយខ្លួនឯង (មិនបាច់វាយពាក្យសម្ងាត់)', async () => {
        overnight();
        await login();
        dead.add('zto-token-1');
        deadCode = 'SYSTEM_ERROR';
        vi.setSystemTime(MORNING);
        coldContainer();
        outage = 'SYSTEM_ERROR';
        loginAnswer = () => respond({ status: false, statusCode: 'SYSTEM_ERROR', message: 'system busy' });
        const res = await scan();
        expect(parse(res), 'ZTO ខូច ➜ ចម្លើយ ZTO ពិត មិនមែន «គណនីត្រូវបដិសេធ»').toMatchObject({ code: 'ZTO_UPSTREAM_REJECTED', reason: 'palm:SYSTEM_ERROR' });
        expect(res.statusCode).toBe(502);
        expect(logins).toHaveLength(2);
        expect(parse(await call({ palm: 'status' })), 'session ហាងនៅ · គ្មានសញ្ញាបដិសេធ').toMatchObject({ shared: true, rejected: false });
        coldContainer();
        expect(parse(await scan()), 'container ថ្មី ៖ មិនមែន 401 palm:login-rejected').toMatchObject({ code: 'ZTO_UPSTREAM_REJECTED' });
        outage = '';
        loginAnswer = null;
        vi.setSystemTime(MORNING.getTime() + 61000);
        const healed = await scan();
        expect(healed.statusCode, 'ZTO ល្អវិញ ➜ Login ឡើងវិញដោយខ្លួនឯង ➜ ✅').toBe(200);
        expect(parse(healed)).toMatchObject({ found: true, phone: '012345678' });
        expect(logins.length).toBeGreaterThanOrEqual(3);
    });

    it('⛔ Login ដោយដៃពេល ZTO ខូច (SYSTEM_ERROR) ➜ «ZTO មិនឆ្លើយ» មិនមែន «គណនី ឬពាក្យសម្ងាត់ខុស» · session ហាងចាស់នៅ', async () => {
        overnight();
        await login();
        vi.setSystemTime(MORNING);
        loginAnswer = () => respond({ status: false, statusCode: 'SYSTEM_ERROR', message: 'system busy' });
        const res = await login();
        expect(parse(res).code, 'មិនមែន ZTO_PALM_LOGIN_REJECTED').toBe('ZTO_UNAVAILABLE');
        expect(parse(res)).toMatchObject({ reason: 'palm:SYSTEM_ERROR' });
        expect(res.statusCode).toBe(502);
        expect(parse(await call({ palm: 'status' }))).toMatchObject({ shared: true, rejected: false });
        loginAnswer = () => respond({ status: false, statusCode: 'login_password_error' });
        const wrong = await login();
        expect(parse(wrong).code, 'ទិសផ្ទុយ ៖ ពាក្យសម្ងាត់ខុស ➜ LOGIN_REJECTED ដដែល').toBe('ZTO_PALM_LOGIN_REJECTED');
        expect(wrong.statusCode).toBe(401);
    });

    it('⛔ ហាងចងសាខាពីរ ៖ token សាខា B ក៏ស្លាប់ពេលយប់ ➜ ការអាន Sign ពេញលេញ (exact=1) របស់ទូរស័ព្ទសាខា A Login សាខា B ឡើងវិញ ហើយបានបញ្ជីពេញលេញ (មិនចាំទូរស័ព្ទសាខា B)', async () => {
        vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT + ':kh001|kh002');
        loginAnswer = (body) => {
            tokens++;
            return respond({ status: true, result: { token: palmToken(tokens), countryCode: 'KH', siteCode: body.userName === 'branch-b-user' ? 'KH002' : 'KH001', siteName: 'Test branch' } });
        };
        overnight();
        expect((await login()).statusCode).toBe(200);
        expect((await login(KEY_A, 'branch-b-user')).statusCode).toBe(200);
        dead.add('zto-token-1');
        dead.add('zto-token-2');
        deadCode = 'SYSTEM_ERROR';
        vi.setSystemTime(MORNING);
        coldContainer();
        const sweep = () => call({ palm: '1', list: '1', signed: '1', exact: '1', from: '2026-10-21', to: '2026-10-21', page: '1' }, { site: 'KH001' });
        const res = await sweep();
        expect(parse(res), 'បញ្ជី Sign ពេញលេញ មិនមែន 503 palm:branch-unread').toMatchObject({ kind: 'signed', signedOk: true });
        expect(res.statusCode).toBe(200);
        expect(logins, 'Login ឡើងវិញសាខា A ម្តង និងសាខា B ម្តង').toHaveLength(4);
        expect(logins.slice(2).map((b: any) => b.userName).sort()).toEqual(['branch-b-user', USER].sort());
        coldContainer();
        expect((await sweep()).statusCode, 'container ថ្មីអាន token ថ្មីទាំងពីរពី Blob').toBe(200);
        expect(logins).toHaveLength(4);
    });

    it('ទិសផ្ទុយ ៖ token សាខា B ទើប Login (< ១៥ នាទី) ហើយ ZTO បដិសេធ ➜ មិនសង្ស័យ ➜ មិន Login · បញ្ជីមិនពេញលេញ (503 palm:branch-unread)', async () => {
        vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT + ':kh001|kh002');
        loginAnswer = (body) => {
            tokens++;
            return respond({ status: true, result: { token: palmToken(tokens), countryCode: 'KH', siteCode: body.userName === 'branch-b-user' ? 'KH002' : 'KH001', siteName: 'Test branch' } });
        };
        overnight();
        await login();
        await login(KEY_A, 'branch-b-user');
        dead.add('zto-token-2');
        deadCode = 'SYSTEM_ERROR';
        vi.setSystemTime(NIGHT_LOGIN.getTime() + 5 * 60000);
        const res = await call({ palm: '1', list: '1', signed: '1', exact: '1', from: '2026-10-21', to: '2026-10-21', page: '1' }, { site: 'KH001' });
        expect(parse(res)).toMatchObject({ code: 'ZTO_UNAVAILABLE', reason: 'palm:branch-unread' });
        expect(logins).toHaveLength(2);
    });

    it('ទិសផ្ទុយ ៖ ចម្លើយដែលមិនមែន ZTO បដិសេធ (5xx · បណ្ដាញ · ជួរគ្មានទិន្នន័យអតិថិជន · Sign គ្មាន track) មិនមែនសញ្ញា token ស្លាប់ ➜ គ្មាន Login', async () => {
        overnight();
        await login();
        vi.setSystemTime(NIGHT_LOGIN.getTime() + 60 * 60000);
        coldContainer();
        const sign = await call({ palm: 'sign' }, { body: { barcode: CODE, requestId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b', stage: 'status' } });
        expect(sign.statusCode).toBe(409);
        expect(parse(sign).code).toBe('ZTO_PALM_STATUS_UNCONFIRMED');
        const zto = vi.mocked(fetch).getMockImplementation()!;
        let answer: (path: string) => Response = () => respond({ status: false }, 503);
        vi.stubGlobal('fetch', vi.fn(async (url: any, init: any) => {
            const path = new URL(String(url)).pathname;
            if (path === '/zto/system/v1/doLogin') return zto(url, init);
            seen.push(String(init.headers['x-token'] || ''));
            return answer(path);
        }));
        const down = await scan();
        expect(down.statusCode).toBe(502);
        expect(parse(down).code).toBe('ZTO_UNAVAILABLE');
        answer = () => respond({ status: true, result: { billCode: CODE } });
        const bare = await scan();
        expect(bare.statusCode).toBe(502);
        expect(parse(bare).code).toBe('ZTO_INVALID_RESPONSE');
        expect(seen.every((token) => token === 'zto-token-1')).toBe(true);
        expect(logins).toHaveLength(1);
    });
});

describe('⛔ ជុំ ៥ ៖ Login ឡើងវិញក្នុងសំណើ ចាប់ផ្តើមតែពេលនៅមានពេលរង់ចាំវា (Function ឈប់ ➜ Login ដែលរត់ក្រោយចម្លើយត្រូវផ្អាក)', () => {
    const slowZto = (path: string, ms: { value: number }) => {
        const zto = vi.mocked(fetch).getMockImplementation()!;
        vi.stubGlobal('fetch', vi.fn(async (url: any, init: any) => {
            if (new URL(String(url)).pathname === path && ms.value) await new Promise((r) => setTimeout(r, ms.value));
            return zto(url, init);
        }));
    };
    const settle = () => new Promise((r) => setTimeout(r, 1500));

    it('⛔ ស្កេន ៖ ZTO យឺតរហូតថវិកាសល់ < ១,៥ វិ. ពេល token ស្លាប់ ➜ មិនចាប់ផ្តើម Login ដែលគ្មានពេលរង់ចាំ (មុនកែ ៖ Login រត់ក្រោយចម្លើយ) · ស្កេនបន្ទាប់ Login ម្តង ហើយ ✅', async () => {
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '4500');
        vi.stubEnv('ZTO_UPSTREAM_TIMEOUT_MS', '3000');
        await login();
        dead.add('zto-token-1');
        coldContainer();
        const ms = { value: 2900 };
        slowZto('/zto/basic/v1/billInfoQuery', ms);
        const res = await scan();
        const atAnswer = logins.length;
        await settle();
        expect(parse(res), 'token ស្លាប់ ហើយគ្មានពេល Login ➜ 503 សាកម្តងទៀត').toMatchObject({ code: 'ZTO_UNAVAILABLE', reason: 'palm:renewing' });
        expect(res.statusCode).toBe(503);
        expect([atAnswer, logins.length], 'Login ក្នុង/ក្រោយចម្លើយ').toEqual([1, 1]);
        ms.value = 0;
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '9000');
        const next = await scan();
        expect(next.statusCode, 'ស្កេនបន្ទាប់មានពេល ➜ Login ហើយសាកម្តងទៀត').toBe(200);
        expect(logins).toHaveLength(2);
    }, 20000);

    it('⛔ Sign ពិនិត្យស្ថានភាព ៖ ZTO យឺតរហូតថវិកាសល់ < ១,៥ វិ. ពេល token ស្លាប់ ➜ មិនចាប់ផ្តើម Login ដែលគ្មានពេលរង់ចាំ · សំណើបន្ទាប់ Login ម្តង', async () => {
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '4500');
        vi.stubEnv('ZTO_UPSTREAM_TIMEOUT_MS', '3000');
        await login();
        dead.add('zto-token-1');
        coldContainer();
        const ms = { value: 2900 };
        slowZto('/zto/locus/v1/queryTrackInfo', ms);
        const status = () => call({ palm: 'sign' }, { body: { barcode: CODE, requestId: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b', stage: 'status' } });
        const res = await status();
        const atAnswer = logins.length;
        await settle();
        expect(seen, 'សំណើទៅដល់ ZTO ដោយ token ស្លាប់').toContain('zto-token-1');
        expect([atAnswer, logins.length], 'Login ក្នុង/ក្រោយចម្លើយ').toEqual([1, 1]);
        expect(res.statusCode).not.toBe(200);
        ms.value = 0;
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '9000');
        const next = await status();
        expect(parse(next).code, 'សំណើបន្ទាប់ Login ហើយអានដោយ token ថ្មី').toBe('ZTO_PALM_STATUS_UNCONFIRMED');
        expect(logins).toHaveLength(2);
        expect(seen[seen.length - 1]).toBe('zto-token-2');
    }, 20000);

    it('⛔ ការអាន Sign ពេញលេញ (exact=1) ហាងចងសាខាពីរ ៖ ZTO យឺតរហូតថវិកាសល់ < ១,៥ វិ. ➜ មិនចាប់ផ្តើម Login សាខា B ដែលគ្មានពេលរង់ចាំ · ការអានបន្ទាប់ Login សាខា B ហើយបានបញ្ជីពេញលេញ', async () => {
        vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT + ':kh001|kh002');
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '4000');
        vi.stubEnv('ZTO_UPSTREAM_TIMEOUT_MS', '2000');
        loginAnswer = (body) => {
            tokens++;
            return respond({ status: true, result: { token: palmToken(tokens), countryCode: 'KH', siteCode: body.userName === 'branch-b-user' ? 'KH002' : 'KH001', siteName: 'Test branch' } });
        };
        await login();
        await login(KEY_A, 'branch-b-user');
        dead.add('zto-token-2');
        coldContainer();
        const ms = { value: 1450 };
        slowZto('/zto/dispatch/v1/queryDispatchList', ms);
        const sweep = () => call({ palm: '1', list: '1', signed: '1', exact: '1', from: '2026-10-21', to: '2026-10-21', page: '1' }, { site: 'KH001' });
        const blobB = entries.get('palm-session/shopa/KH002')!.etag;
        const res = await sweep();
        const atAnswer = logins.length;
        await settle();
        expect(parse(res)).toMatchObject({ code: 'ZTO_UNAVAILABLE', reason: 'palm:branch-unread' });
        expect([atAnswer, logins.length], 'Login ក្នុង/ក្រោយចម្លើយ').toEqual([2, 2]);
        expect(entries.get('palm-session/shopa/KH002')!.etag, 'Blob សាខា B មិនប្រែក្រោយចម្លើយ').toBe(blobB);
        ms.value = 0;
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '9000');
        const next = await sweep();
        expect(next.statusCode).toBe(200);
        expect(parse(next)).toMatchObject({ kind: 'signed', signedOk: true });
        expect(logins.slice(2).map((b: any) => b.userName)).toEqual(['branch-b-user']);
    }, 20000);
});


describe('⛔ ជុំ ៦ ៖ Login ឡើងវិញក្នុងសំណើ ចាប់ផ្តើមតែពេលសំណើរង់ចាំបានយូរគ្រប់ Login មួយ (ពេលរង់ចាំខ្លីជាង Login ➜ Login រត់ក្រោយចម្លើយ ហើយ Function ផ្អាកវា)', () => {
    const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const slowZto = (path: string, ms: { value: number }) => {
        const zto = vi.mocked(fetch).getMockImplementation()!;
        vi.stubGlobal('fetch', vi.fn(async (url: any, init: any) => {
            if (new URL(String(url)).pathname === path && ms.value) await pause(ms.value);
            return zto(url, init);
        }));
    };
    const slowLogin = (ms = 1000) => {
        loginAnswer = async (body) => {
            if (ms) await pause(ms);
            tokens++;
            return respond({ status: true, result: { token: palmToken(tokens), countryCode: 'KH', siteCode: body.userName === 'branch-b-user' ? 'KH002' : 'KH001', siteName: 'Test branch' } });
        };
    };

    it.each([2000, 2500])('⛔ ស្កេន ៖ ZTO យឺត %i ms ពេល token ស្លាប់ ➜ ពេលរង់ចាំនៅសល់ (> 0) ខ្លីជាង Login (១ វិ.) ➜ មិនចាប់ផ្តើម Login · Blob មិនប្រែក្រោយចម្លើយ · ស្កេនបន្ទាប់ Login ម្តង ហើយ ✅', async (slow) => {
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '4500');
        vi.stubEnv('ZTO_UPSTREAM_TIMEOUT_MS', '3000');
        await login();
        dead.add('zto-token-1');
        coldContainer();
        slowLogin();
        const ms = { value: slow };
        slowZto('/zto/basic/v1/billInfoQuery', ms);
        const blob = entries.get(SLOT_A)!.etag;
        const res = await scan();
        const atAnswer = logins.length;
        await pause(1500);
        expect(parse(res), 'token ស្លាប់ ហើយរង់ចាំ Login មិនទាន់ ➜ 503 សាកម្តងទៀត').toMatchObject({ code: 'ZTO_UNAVAILABLE', reason: 'palm:renewing' });
        expect([atAnswer, logins.length], 'Login ក្នុង/ក្រោយចម្លើយ').toEqual([1, 1]);
        expect(entries.get(SLOT_A)!.etag, 'Blob មិនប្រែក្រោយចម្លើយ').toBe(blob);
        ms.value = 0;
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '9000');
        const next = await scan();
        expect(next.statusCode, 'ស្កេនបន្ទាប់មានពេល ➜ Login ហើយសាកម្តងទៀត').toBe(200);
        expect(logins).toHaveLength(2);
    }, 20000);

    it('⛔ ការអាន Sign ពេញលេញ (exact=1) ហាងចងសាខាពីរ ៖ ពេលរង់ចាំនៅសល់ខ្លីជាង Login សាខា B ➜ មិនចាប់ផ្តើម Login · Blob សាខា B មិនប្រែក្រោយចម្លើយ · ការអានបន្ទាប់ Login សាខា B ហើយបានបញ្ជីពេញលេញ', async () => {
        vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT + ':kh001|kh002');
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '4500');
        vi.stubEnv('ZTO_UPSTREAM_TIMEOUT_MS', '2000');
        slowLogin(0);
        await login();
        await login(KEY_A, 'branch-b-user');
        dead.add('zto-token-2');
        coldContainer();
        slowLogin();
        const ms = { value: 1000 };
        slowZto('/zto/dispatch/v1/queryDispatchList', ms);
        const sweep = () => call({ palm: '1', list: '1', signed: '1', exact: '1', from: '2026-10-21', to: '2026-10-21', page: '1' }, { site: 'KH001' });
        const blobB = entries.get('palm-session/shopa/KH002')!.etag;
        const res = await sweep();
        const atAnswer = logins.length;
        await pause(1500);
        expect(parse(res)).toMatchObject({ code: 'ZTO_UNAVAILABLE', reason: 'palm:branch-unread' });
        expect([atAnswer, logins.length], 'Login ក្នុង/ក្រោយចម្លើយ').toEqual([2, 2]);
        expect(entries.get('palm-session/shopa/KH002')!.etag, 'Blob សាខា B មិនប្រែក្រោយចម្លើយ').toBe(blobB);
        ms.value = 0;
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '9000');
        const next = await sweep();
        expect(next.statusCode).toBe(200);
        expect(parse(next)).toMatchObject({ kind: 'signed', signedOk: true });
        expect(logins.slice(2).map((b: any) => b.userName)).toEqual(['branch-b-user']);
    }, 20000);
});
