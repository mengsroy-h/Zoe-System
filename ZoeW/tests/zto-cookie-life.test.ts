/**
 * ⛔ អាយុ Cookie ZTO (សំណើម្ចាស់គម្រោង ៖ «ធ្វើទាំង ៣ ចំណុចហ្នឹងទៅ» ➜ ចំណុច ៣ ៖ វាស់ថា Cookie នីមួយៗរស់បានប៉ុន្មាន)។
 *    សំណួរ ៖ «ហេតុអ្វី Cookie ពេលខ្លះប្រើបាន ១០–១៤ ម៉ោង ពេលខ្លះតែ ៣–៤ ម៉ោង?» ➜ មុននេះ Function ចាំតែ «ពេលប្រើបានចុងក្រោយ/បដិសេធ» ក្នុង container
 *    មួយ (បាត់ពេល container ចាប់ផ្តើមថ្មី) ➜ គ្មានទិន្នន័យវាស់។ ឥឡូវ Function កត់ក្នុង Blob (`cookie-life`) តាម `syncedAt` នៃការ Sync នីមួយៗ ៖ ពេល ZTO
 *    ទទួលចុងក្រោយ និងពេល ZTO បដិសេធ ➜ `?diag=1` `cookie.life` (លេខប៉ុណ្ណោះ) ➜ 🩺 បង្ហាញ «រស់ X · ទំនេរ Y មុនបដិសេធ» ៖ ទំនេរយូរ = ZTO ផុតដោយ
 *    គ្មានការប្រើ · ទំនេរខ្លី = ZTO បិទ session ពីខាងខ្លួន (ចូលម្តងទៀតកន្លែងផ្សេង · ZTO restart)។ Function ពិត + Blobs ក្លែង។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { ztoCookieLifeText } from '../src/features/health-check';

const req = createRequire(import.meta.url);
const fn = req('../netlify/functions/zto-order-detail.js');
const KEY = 'life-proxy-key-0123456789abcdef';
const BARCODE = '77130500000012';
const COOKIE_A = 'BOS-MAN-SESSION=life-cookie-a-1234; sidebarStatus=1';
const COOKIE_B = 'BOS-MAN-SESSION=life-cookie-b-5678; sidebarStatus=1';
const HOUR = 3600000;
const MIN = 60000;
const T0 = Date.UTC(2026, 9, 10, 1, 0, 0);
const ORDER = { code: '0', data: { billCode: BARCODE, consigneePhone: '0970008508', agentAmount: 6.55, arrivalServiceCharge: 1.25 } };
const ENV_NAMES = ['ZTO_PROXY_KEY', 'ZTO_COOKIE', 'ZTO_TOKEN', 'ZTO_AUTHORIZATION', 'ZTO_CACHE_TTL_MS', 'ZTO_NOT_FOUND_CACHE_TTL_MS', 'ZTO_UPSTREAM_RETRIES'];

type Entry = { value: string; etag: string; metadata: any };
let entries: Map<string, Entry>;
let writes: { key: string; value: string }[];
let hangKeys: Set<string>;
let raceLife: null | (() => void) = null;
let upstreamStatus = 200;

const etagOf = (value: string) => '"' + crypto.createHash('sha256').update(value).digest('hex') + '"';

function useBlobs() {
    entries = new Map();
    writes = [];
    hangKeys = new Set();
    const store = {
        async getWithMetadata(key: string) {
            if (hangKeys.has(key)) return new Promise(() => {});
            const e = entries.get(key);
            if (key === 'cookie-life' && raceLife) {
                const other = raceLife;
                raceLife = null;
                other();
            }
            return e ? { data: e.value, etag: e.etag, metadata: e.metadata || {} } : null;
        },
        async get(key: string) {
            if (hangKeys.has(key)) return new Promise(() => {});
            const e = entries.get(key);
            return e ? e.value : null;
        },
        async set(key: string, value: string, options: any) {
            if (hangKeys.has(key)) return new Promise(() => {});
            const e = entries.get(key);
            if (options && options.onlyIfMatch && (!e || e.etag !== options.onlyIfMatch)) return { modified: false };
            if (options && options.onlyIfNew && e) return { modified: false };
            writes.push({ key, value });
            entries.set(key, { value, etag: etagOf(value), metadata: options && options.metadata ? options.metadata : {} });
            return { modified: true, etag: etagOf(value) };
        }
    };
    fn.setBlobsModuleForTests({ connectLambda() {}, getStore() { return store; } });
}

function syncCookie(cookie: string, syncedAt: number) {
    entries.set('cookie', { value: cookie, etag: etagOf(cookie + syncedAt), metadata: { syncedAt } });
}

function call(query: Record<string, string>) {
    return fn.handler({
        httpMethod: 'GET',
        headers: { 'x-zoe-proxy-key': KEY, 'x-nf-site-id': 'site', 'x-nf-deploy-id': 'deploy' },
        queryStringParameters: query,
        blobs: Buffer.from(JSON.stringify({ url: 'https://blobs.netlify.test', token: 't' })).toString('base64')
    });
}

const lookup = () => call({ barcode: BARCODE });
async function life() {
    const res = await call({ diag: '1' });
    return JSON.parse(res.body).cookie.life;
}
const lifeWrites = () => writes.filter((w) => w.key !== 'cookie');
function newContainer() {
    fn.resetCachesForTests();
}
function at(ms: number) {
    vi.setSystemTime(ms);
}

beforeEach(() => {
    ENV_NAMES.forEach((name) => { delete process.env[name]; });
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_CACHE_TTL_MS = '0';
    process.env.ZTO_NOT_FOUND_CACHE_TTL_MS = '0';
    process.env.ZTO_UPSTREAM_RETRIES = '0';
    vi.useFakeTimers({ toFake: ['Date'] });
    at(T0);
    fn.resetCachesForTests();
    useBlobs();
    upstreamStatus = 200;
    vi.stubGlobal('fetch', vi.fn(async () => (upstreamStatus === 200
        ? new Response(JSON.stringify(ORDER), { status: 200, headers: { 'content-type': 'application/json' } })
        : new Response(JSON.stringify({ code: '401' }), { status: 401, headers: { 'content-type': 'application/json' } }))));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fn.setBlobsModuleForTests(null);
    fn.resetCachesForTests();
});

describe('អាយុ Cookie ZTO ក្នុង Blob', () => {
    it('⛔ ZTO ទទួល ➜ កត់ក្នុង Blob ➜ container ថ្មីនៅឃើញ (`cookie.life`)', async () => {
        syncCookie(COOKIE_A, T0 - 5 * HOUR);
        expect((await lookup()).statusCode).toBe(200);
        newContainer();
        const got = await life();
        expect(Array.isArray(got)).toBe(true);
        expect(got.length).toBe(1);
        expect(got[0]).toMatchObject({ syncAgeMs: 5 * HOUR, aliveMs: 5 * HOUR, rejectedAfterMs: null, idleMs: null, ended: false });
    });

    it('⛔ ZTO បដិសេធ ➜ «រស់ X · ទំនេរ Y មុនបដិសេធ» (ការទទួលចុងក្រោយពី container ផ្សេង)', async () => {
        syncCookie(COOKIE_A, T0);
        expect((await lookup()).statusCode).toBe(200);
        at(T0 + 3 * HOUR);
        newContainer();
        expect((await lookup()).statusCode).toBe(200);
        at(T0 + 9 * HOUR);
        newContainer();
        upstreamStatus = 401;
        const res = await lookup();
        expect(JSON.parse(res.body).code).toBe('ZTO_AUTH_EXPIRED');
        newContainer();
        const got = await life();
        expect(got[0]).toMatchObject({ aliveMs: 3 * HOUR, rejectedAfterMs: 9 * HOUR, idleMs: 6 * HOUR, ended: true });
    });

    it('⛔ ការទទួលចុងក្រោយច្បាស់ក្នុង container ដដែល (មិនខូចដោយគម្លាតសរសេរ)', async () => {
        syncCookie(COOKIE_A, T0);
        await lookup();
        at(T0 + 4 * MIN);
        await lookup();
        at(T0 + 9 * MIN);
        upstreamStatus = 401;
        await lookup();
        const got = await life();
        expect(got[0]).toMatchObject({ aliveMs: 4 * MIN, rejectedAfterMs: 9 * MIN, idleMs: 5 * MIN, ended: true });
    });

    it('⛔ ការសរសេរមានកម្រិត ៖ ទទួលញឹកញាប់ក្នុង ១០ នាទី ➜ សរសេរ ១ ដង · ក្រោយ ១០ នាទី ➜ សរសេរម្តងទៀត', async () => {
        syncCookie(COOKIE_A, T0);
        for (let i = 0; i < 20; i++) {
            at(T0 + i * 20000);
            await lookup();
        }
        expect(lifeWrites().length).toBe(1);
        at(T0 + 11 * MIN);
        await lookup();
        expect(lifeWrites().length).toBe(2);
    });

    it('⛔ បដិសេធម្តងៗ (ស្កេនបន្តពេល Cookie ស្លាប់) ➜ សរសេរ ១ ដង', async () => {
        syncCookie(COOKIE_A, T0);
        await lookup();
        upstreamStatus = 401;
        const before = lifeWrites().length;
        for (let i = 1; i <= 10; i++) {
            at(T0 + i * MIN);
            await lookup();
        }
        expect(lifeWrites().length - before).toBe(1);
    });

    it('ទិសផ្ទុយ ៖ បដិសេធមួយភ្លែត ហើយ ZTO ទទួលវិញ (Sync ដដែល) ➜ មិនរាប់ថាស្លាប់', async () => {
        syncCookie(COOKIE_A, T0);
        await lookup();
        at(T0 + HOUR);
        upstreamStatus = 401;
        await lookup();
        at(T0 + HOUR + MIN);
        upstreamStatus = 200;
        await lookup();
        newContainer();
        const got = await life();
        expect(got[0]).toMatchObject({ aliveMs: HOUR + MIN, ended: false });
    });

    it('⛔ Sync ថ្មី ➜ ជីវិតថ្មី · ជីវិតមុននៅ (ថ្មីមុន) · រក្សាត្រឹម ៨', async () => {
        for (let i = 0; i < 10; i++) {
            const start = T0 + i * 10 * HOUR;
            at(start);
            syncCookie(i % 2 ? COOKIE_B : COOKIE_A, start);
            newContainer();
            upstreamStatus = 200;
            await lookup();
            at(start + (i + 1) * HOUR);
            upstreamStatus = 401;
            await lookup();
        }
        const got = await life();
        expect(got.length).toBe(8);
        expect(got[0]).toMatchObject({ syncAgeMs: 10 * HOUR, rejectedAfterMs: 10 * HOUR, ended: true });
        expect(got[7]).toMatchObject({ rejectedAfterMs: 3 * HOUR, ended: true });
    });

    it('⛔ container ពីរសរសេរព្រមគ្នា (ETag) ➜ មិនជាន់គ្នា · ការសរសេររបស់យើងនៅចូល', async () => {
        syncCookie(COOKIE_A, T0);
        const older = JSON.stringify({ v: 1, lives: [{ s: T0 - 60 * HOUR, a: T0 - 50 * HOUR, r: T0 - 49 * HOUR }] });
        entries.set('cookie-life', { value: older, etag: etagOf(older), metadata: {} });
        const other = JSON.stringify({ v: 1, lives: [
            { s: T0 - 60 * HOUR, a: T0 - 50 * HOUR, r: T0 - 49 * HOUR },
            { s: T0 - 30 * HOUR, a: T0 - 20 * HOUR, r: T0 - 19 * HOUR }] });
        raceLife = () => entries.set('cookie-life', { value: other, etag: etagOf(other), metadata: {} });
        await lookup();
        expect(raceLife).toBeNull();
        const got = await life();
        expect(got.length).toBe(3);
        expect(got[0]).toMatchObject({ aliveMs: 0, ended: false });
        expect(got[1]).toMatchObject({ aliveMs: 10 * HOUR, rejectedAfterMs: 11 * HOUR, ended: true });
        expect(got[2]).toMatchObject({ aliveMs: 10 * HOUR, rejectedAfterMs: 11 * HOUR, idleMs: HOUR, ended: true });
    });

    it('⛔ Blob ផ្នែកអាយុជាប់គាំង ➜ ការស្វែងរកនៅឆ្លើយក្នុងថវិកា · diag នៅឆ្លើយ', async () => {
        syncCookie(COOKIE_A, T0);
        hangKeys.add('cookie-life');
        const started = performance.now();
        const res = await lookup();
        expect(res.statusCode).toBe(200);
        expect(performance.now() - started).toBeLessThan(2500);
        upstreamStatus = 401;
        const rejected = await lookup();
        expect(rejected.statusCode).toBe(401);
        const diag = await call({ diag: '1' });
        expect(diag.statusCode).toBe(200);
        expect(JSON.parse(diag.body).cookie.life).toBeNull();
    }, 15000);

    it('ទិសផ្ទុយ ៖ Cookie ពី env (គ្មាន Sync) ➜ មិនសរសេរ · ទិន្នន័យខូចក្នុង Blob ➜ មិនគាំង', async () => {
        process.env.ZTO_COOKIE = COOKIE_A;
        await lookup();
        expect(lifeWrites().length).toBe(0);
        entries.set('cookie-life', { value: '{"v":1,"lives":[{"s":"x"},5,null,{"s":1,"a":-3}]}', etag: '"bad"', metadata: {} });
        const got = await life();
        expect(got).toEqual([]);
    });
});

describe('🩺 អត្ថបទអាយុ Cookie', () => {
    it('⛔ បង្ហាញ Cookie ដែលស្លាប់ ៖ រស់ · ទំនេរមុនបដិសេធ · ត្រឹម ៣', () => {
        const life = [
            { syncAgeMs: 2 * HOUR, aliveMs: HOUR, rejectedAfterMs: null, idleMs: null, ended: false },
            { syncAgeMs: 20 * HOUR, aliveMs: 11 * HOUR, rejectedAfterMs: 14 * HOUR, idleMs: 3 * HOUR, ended: true },
            { syncAgeMs: 40 * HOUR, aliveMs: 3 * HOUR, rejectedAfterMs: 3 * HOUR + 5 * MIN, idleMs: 5 * MIN, ended: true },
            { syncAgeMs: 60 * HOUR, aliveMs: 4 * HOUR, rejectedAfterMs: 5 * HOUR, idleMs: HOUR, ended: true },
            { syncAgeMs: 80 * HOUR, aliveMs: 12 * HOUR, rejectedAfterMs: 13 * HOUR, idleMs: HOUR, ended: true }
        ];
        const text = ztoCookieLifeText({ cookie: { life } });
        expect(text).toContain('ប្រើបាន 11 ម៉ោង');
        expect(text).toContain('ទំនេរ 3 ម៉ោង');
        expect(text).toContain('ប្រើបាន 3 ម៉ោង');
        expect(text).toContain('ទំនេរ 5 នាទី');
        expect(text).not.toContain('12 ម៉ោង');
    });

    it('ទិសផ្ទុយ ៖ គ្មានទិន្នន័យ / ទិន្នន័យខូច ➜ គ្មានអត្ថបទ', () => {
        expect(ztoCookieLifeText({ cookie: { life: null } })).toBe('');
        expect(ztoCookieLifeText({ cookie: { life: [{ ended: false }] } })).toBe('');
        expect(ztoCookieLifeText({ cookie: { life: [{ ended: true, aliveMs: 'x' }] } })).toBe('');
        expect(ztoCookieLifeText(null)).toBe('');
    });
});
