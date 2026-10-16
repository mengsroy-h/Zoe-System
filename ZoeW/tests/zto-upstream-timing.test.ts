// @vitest-environment node
import { createRequire } from 'node:module';
import diagnostics from 'node:diagnostics_channel';
import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const fn = require('../netlify/functions/zto-order-detail.js');
const KEY = 'timing-proxy-key-0123456789abcdef';
const CODE = '77130500000012';
const ACCOUNT = { token: 'synthetic-palm-token-timing', countryCode: 'KH', siteCode: 'KH001', siteName: 'Test branch' };
const PALM_HOST = 'aargus-api.ztoglobal.net';
const ARGUS_HOST = 'aargus-api.ztoglobal.com';

function upstream(body: unknown) {
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function call(query: Record<string, string>, session = '', input?: unknown) {
    return fn.handler({
        httpMethod: input === undefined ? 'GET' : 'POST',
        headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-palm-token': session }, queryStringParameters: query,
        body: input === undefined ? '' : JSON.stringify(input)
    });
}

function slow(body: unknown, ms = 40) {
    return vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return upstream(body);
    });
}

async function login() {
    vi.stubGlobal('fetch', vi.fn(async () => upstream({ status: true, result: ACCOUNT })));
    const result = await call({ palm: 'login' }, '', { username: 'palm-user', password: 'synthetic-password', deviceSn: 'zoew-test-device' });
    expect(result.statusCode).toBe(200);
    return JSON.parse(result.body).sessionToken as string;
}

async function argusTiming() {
    return JSON.parse((await call({ diag: '1' })).body).upstreamTiming;
}

function connect(hostname: string, waitMs: number, failed = false) {
    const connectParams = { hostname, host: hostname, port: '443', protocol: 'https:', servername: hostname };
    diagnostics.channel('undici:client:beforeConnect').publish({ connectParams, connector: () => {} });
    return new Promise<void>((resolve) => setTimeout(() => {
        diagnostics.channel(failed ? 'undici:client:connectError' : 'undici:client:connected')
            .publish({ connectParams, connector: () => {}, socket: {}, error: failed ? new Error('refused') : undefined });
        resolve();
    }, waitMs));
}

function numbersOnly(value: unknown): boolean {
    if (value === null || typeof value === 'number') return true;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.values(value).every(numbersOnly);
}

beforeEach(() => {
    fn.resetCachesForTests();
    vi.stubEnv('ZTO_PROXY_KEY', KEY);
    vi.stubEnv('ZTO_PROXY_KEYS_JSON', '');
    vi.stubEnv('ZTO_COOKIE', 'BOS-MAN-SESSION=t');
    vi.stubEnv('ZTO_CACHE_TTL_MS', '0');
    vi.stubEnv('ZTO_PALM_SESSION_SECRET', 'synthetic-server-session-secret-at-least-32-characters');
    vi.stubEnv('ZTO_PALM_SIGN_KEY', 'synthetic-palm-sign-key');
    vi.stubEnv('ZTO_PALM_PASSWORD_KEY', 'zoew-test-aes-16');
    vi.stubEnv('ZTO_DETAIL_IDENTITY', '');
    vi.stubEnv('ZTO_DETAIL_BRANCH_PATHS', '');
    vi.stubEnv('FIREBASE_PROJECT_IDS', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('?diag=1 measures how long ZTO Palm takes to answer, apart from Argus (owner report: Palm lookup slower than Cookie)', () => {
    it('a Palm scan is metered under upstreamTiming.palm.detail ➜ Palm ?diag=1 and Argus ?diag=1 both show it', async () => {
        const session = await login();
        vi.stubGlobal('fetch', slow({ status: true, result: { billCode: CODE, consigneeMobile: '012345678', cod: '1', dod: '0' } }));
        expect((await call({ palm: '1', barcode: CODE }, session)).statusCode).toBe(200);
        const palmDiag = JSON.parse((await call({ palm: '1', diag: '1' }, session)).body);
        expect(palmDiag.provider).toBe('zto-palm');
        const timing = palmDiag.upstreamTiming;
        expect(timing.palm.detail).toMatchObject({ count: 1, timeouts: 0 });
        expect(timing.palm.detail.lastMs).toBeGreaterThanOrEqual(35);
        expect(timing.palm.detail.avgMs).toBeGreaterThanOrEqual(35);
        expect(timing.palm.list.count).toBe(0);
        expect(timing.detail.count).toBe(0);
        expect((await argusTiming()).palm.detail.count).toBe(1);
    });

    it('Palm list pages are metered as palm.list (arrival) and palm.signed (sign list), never as Argus kinds', async () => {
        const session = await login();
        vi.stubGlobal('fetch', slow({ status: true, result: { list: [], pages: 1, total: 0, isLastPage: true } }, 20));
        const day = '2026-10-15';
        const res = await call({ palm: '1', list: '1', from: day, to: day, withSigned: '1' }, session);
        expect(res.statusCode).toBe(200);
        const timing = await argusTiming();
        expect(timing.palm.list.count).toBe(1);
        expect(timing.palm.signed.count).toBe(1);
        expect(timing.palm.signed.lastMs).toBeGreaterThanOrEqual(15);
        expect(timing.list.count).toBe(0);
        expect(timing.signed.count).toBe(0);
        expect(timing.palm.detail.count).toBe(0);
    });

    it('a hung Palm request counts as a timeout', async () => {
        vi.stubEnv('ZTO_UPSTREAM_TIMEOUT_MS', '1000');
        vi.stubEnv('ZTO_REQUEST_BUDGET_MS', '2500');
        const session = await login();
        vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        })));
        expect((await call({ palm: '1', barcode: CODE }, session)).statusCode).toBe(504);
        const timing = await argusTiming();
        expect(timing.palm.detail).toMatchObject({ count: 1, timeouts: 1 });
        expect(timing.palm.detail.lastMs).toBeGreaterThanOrEqual(900);
    });

    it('counts each new connection (TCP + TLS) to the Palm and Argus hosts with its handshake time; other hosts are not counted', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => upstream({ data: { phone: '012345678', cod: 1 } })));
        await call({ barcode: CODE });
        await connect(PALM_HOST, 30);
        await connect(PALM_HOST, 10);
        await connect(ARGUS_HOST, 20);
        await connect('blobs.netlify.com', 5);
        await connect('www.googleapis.com', 5);
        await connect(PALM_HOST, 5, true);
        const { connections } = await argusTiming();
        expect(connections.palm).toMatchObject({ count: 2, errors: 1 });
        expect(connections.palm.maxMs).toBeGreaterThanOrEqual(25);
        expect(connections.palm.lastMs).toBeGreaterThanOrEqual(5);
        expect(connections.argus).toMatchObject({ count: 1, errors: 0 });
        expect(connections.argus.lastMs).toBeGreaterThanOrEqual(15);
    });

    it('measures a connection the real fetch (undici) makes: its two events carry different objects, so the handshake is paired by host', async () => {
        const server = http.createServer((_req, res) => { res.setHeader('Content-Length', '2'); res.end('ok'); });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        try {
            const port = (server.address() as { port: number }).port;
            await (await fetch(`http://localhost:${port}/other`)).text();
            fn.noteArgusUpstreamHostForTests('127.0.0.1');
            await (await fetch(`http://127.0.0.1:${port}/a`)).text();
            const { connections } = await argusTiming();
            expect(connections.argus.count).toBe(1);
            expect(connections.argus.lastMs).not.toBeNull();
            expect(connections.argus.avgMs).toBeGreaterThanOrEqual(0);
            expect(connections.palm.count).toBe(0);
        } finally {
            server.close();
        }
    });

    it('a connection before any Argus request is not guessed as Argus (the Argus host is learned from the request itself)', async () => {
        await connect(ARGUS_HOST, 5);
        expect((await argusTiming()).connections.argus.count).toBe(0);
    });

    it('malformed channel messages never throw into the HTTP client', () => {
        for (const name of ['undici:client:beforeConnect', 'undici:client:connected', 'undici:client:connectError']) {
            expect(() => diagnostics.channel(name).publish(null)).not.toThrow();
            expect(() => diagnostics.channel(name).publish({})).not.toThrow();
            expect(() => diagnostics.channel(name).publish({ connectParams: 'x' })).not.toThrow();
        }
    });

    it('upstreamTiming holds only numbers or null (no host, URL, token or Cookie)', async () => {
        const session = await login();
        vi.stubGlobal('fetch', slow({ status: true, result: { billCode: CODE, consigneeMobile: '012345678', cod: '1', dod: '0' } }, 5));
        await call({ palm: '1', barcode: CODE }, session);
        await connect(PALM_HOST, 5);
        const timing = await argusTiming();
        expect(numbersOnly(timing)).toBe(true);
        const palmDiag = (await call({ palm: '1', diag: '1' }, session)).body;
        expect(palmDiag).not.toContain(PALM_HOST);
        expect(palmDiag).not.toContain(ACCOUNT.token);
    });
});
