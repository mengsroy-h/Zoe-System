// @vitest-environment node
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const CORE = fileURLToPath(new URL('../netlify/functions/_shared/zto-order-detail-core.cjs', import.meta.url));
const ENTRY = fileURLToPath(new URL('../netlify/functions/zto-order-detail.mjs', import.meta.url));
const require = createRequire(CORE);
const core = require(CORE);
const sdk = require('@netlify/blobs');
const { withLambda } = await import(pathToFileURL(require.resolve('@netlify/aws-lambda-compat')).href);
const entry = await import(pathToFileURL(ENTRY).href);
const KEY = 'modern-entry-test-proxy-key-0123456789';
const context = { requestId: 'local-modern-test' };

function isolatedCore() {
    const sandbox = { exports: {} as any, require, process, Buffer, URL, URLSearchParams, setTimeout, clearTimeout, fetch: globalThis.fetch };
    vm.runInNewContext(readFileSync(CORE, 'utf8')
        + '\nexports.inspectStore = openCookieStore; exports.replaceRequest = fn => { handleRequest = fn; };', sandbox, { filename: CORE });
    return sandbox.exports;
}

function call(method = 'GET', query = '', headers: Record<string, string> = {}, body?: string) {
    return entry.default(new Request('https://zoew.invalid/.netlify/functions/zto-order-detail' + query,
        { method, headers, body }), context);
}

beforeEach(() => {
    core.resetCachesForTests();
    core.setBlobsModuleForTests(null);
    for (const [key, value] of Object.entries({ ZTO_PROXY_KEY: KEY, ZTO_PROXY_KEYS_JSON: '', ZTO_TOKEN: '', ZTO_AUTHORIZATION: '',
        ZTO_COOKIE: '', ZTO_DETAIL_IDENTITY: 'off', ZTO_DETAIL_BRANCH_PATHS: '', NETLIFY_BLOBS_CONTEXT: '',
        ZTO_PALM_SESSION_SECRET: 'synthetic-modern-session-secret-32-characters', ZTO_PALM_SIGN_KEY: 'synthetic-sign-key',
        ZTO_PALM_PASSWORD_KEY: 'zoew-test-aes-16' })) vi.stubEnv(key, value);
    vi.stubGlobal('netlifyBlobsContext', undefined);
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('ការសាកល្បងហាមបណ្ដាញពិត'); }));
});

afterEach(() => {
    core.setBlobsModuleForTests(null);
    core.resetCachesForTests();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

it('ច្រកដាក់ប្រើមាន default តែមួយ ហើយគ្មានឯកសារ js ឈ្មោះដូចគ្នា', () => {
    expect(Object.keys(entry)).toEqual(['default']);
    expect(existsSync(ENTRY.replace(/\.mjs$/, '.js'))).toBe(false);
    expect(readFileSync(ENTRY, 'utf8')).toContain("import * as blobs from '@netlify/blobs'");
});

it('សោមិនត្រឹមត្រូវត្រូវបដិសេធមុនបណ្ដាញ និងរក្សា CORS សម្រាប់ APK', async () => {
    const response = await call('GET', '?barcode=KH1000000001', { Origin: 'https://localhost', 'X-Zoe-Proxy-Key': 'wrong' });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'Invalid proxy key' });
    expect(response.headers.get('access-control-allow-origin')).toBe('https://localhost');
    expect(fetch).not.toHaveBeenCalled();
});

it('OPTIONS Palm ឆ្លង official Response ជា 204 គ្មាន body និងរក្សា CORS', async () => {
    const response = await call('OPTIONS', '?palm=1', { Origin: 'https://localhost',
        'Access-Control-Request-Headers': 'x-zoe-proxy-key, x-zoe-palm-token' });
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(await response.text()).toBe('');
    expect(response.headers.get('access-control-allow-headers')).toBe('x-zoe-proxy-key, x-zoe-palm-token');
    expect(response.headers.get('allow')).toBe('GET, POST, OPTIONS');
    expect(fetch).not.toHaveBeenCalled();
});

it('origin មិនអនុញ្ញាតគ្មាន CORS ហើយ method ខុសរក្សា 405', async () => {
    const response = await call('DELETE', '', { Origin: 'https://untrusted.invalid', 'X-Zoe-Proxy-Key': KEY });
    expect(response.status).toBe(405);
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
});

it.each([
    ['application/json', JSON.stringify({ username: 'ក'.repeat(1500), password: 'test', deviceSn: 'zoew-modern-test' })],
    ['application/octet-stream', JSON.stringify({ username: 'operator', password: 'test', deviceSn: 'zoew-modern-test' })],
    ['application/json', '{broken']
])('Login body ត្រូវពិនិត្យក្រោយ adapter (%s)', async (contentType, body) => {
    const response = await call('POST', '?palm=login', { 'X-Zoe-Proxy-Key': KEY, 'Content-Type': contentType }, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'ZTO_PALM_LOGIN_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
});

it('x-zoe-query ឆ្លង adapter ដល់ទ្វារ Login ដូច query string', async () => {
    const response = await call('POST', '', { 'X-Zoe-Proxy-Key': KEY, 'X-Zoe-Query': 'palm=login', 'Content-Type': 'application/json' }, '{}');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'ZTO_PALM_LOGIN_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
});

it.each([204, 205, 304])('bodyless %s ត្រូវបម្លែងតែក្នុង modern handler', async (statusCode) => {
    const isolated = isolatedCore();
    const result = { statusCode, body: '', headers: { 'Cache-Control': 'no-store' }, isBase64Encoded: true };
    isolated.replaceRequest(async () => result);
    const event = { httpMethod: 'OPTIONS' };
    expect((await isolated.handler(event)).body).toBe('');
    const response = await withLambda(isolated.createModernHandler(sdk))(new Request('https://zoew.invalid/'), context);
    expect(response.status).toBe(statusCode);
    expect(response.body).toBeNull();
    expect(result.body).toBe('');
});

it('official adapter រក្សា binary body ទាំងសំណើ និងចម្លើយ', async () => {
    const isolated = isolatedCore();
    const bytes = Buffer.from([0, 255, 1, 128, 13, 10]);
    isolated.replaceRequest(async (event: any) => {
        expect(event.isBase64Encoded).toBe(true);
        expect(event.body).toBe(bytes.toString('base64'));
        return { statusCode: 200, body: event.body, isBase64Encoded: true, headers: { 'Content-Type': 'application/octet-stream' } };
    });
    const response = await withLambda(isolated.createModernHandler(sdk))(new Request('https://zoew.invalid/',
        { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes }), context);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
});

it('សញ្ញាឯកជនកាន់ SDK ថេរ មិនទទួល event fields ឬ test-module override ហើយដកចេញក្រោយចប់', async () => {
    const isolated = isolatedCore();
    const store = {};
    const getStore = vi.fn(() => store);
    const sourceSDK = { getStore, connectLambda: vi.fn(() => { throw new Error('មិនត្រូវ connect'); }) };
    const modern = isolated.createModernHandler(sourceSDK);
    const malicious = vi.fn(() => { throw new Error('មិនត្រូវប្ដូរ SDK'); });
    sourceSDK.getStore = malicious;
    isolated.setBlobsModuleForTests({ getStore: malicious, connectLambda: malicious });
    const event = { httpMethod: 'GET', modern: true, modernBlobs: sourceSDK, blobsModule: sourceSDK,
        netlifyBlobsContext: 'request-context', context: { blobs: sourceSDK } };
    expect(isolated.inspectStore(event)).toMatchObject({ store: null, reason: 'no-context' });
    isolated.replaceRequest(async (incoming: unknown) => {
        expect(incoming).toBe(event);
        expect(isolated.inspectStore(incoming).store).toBe(store);
        expect(isolated.inspectStore({ ...event })).toMatchObject({ store: null, reason: 'no-context' });
        return { statusCode: 200, body: 'ok' };
    });
    expect((await modern(event)).body).toBe('ok');
    expect(getStore).toHaveBeenCalledExactlyOnceWith('zto-auth');
    expect(malicious).not.toHaveBeenCalled();
    expect(sourceSDK.connectLambda).not.toHaveBeenCalled();
    expect(isolated.inspectStore(event)).toMatchObject({ store: null, reason: 'no-context' });
    isolated.replaceRequest(async (incoming: unknown) => {
        expect(isolated.inspectStore(incoming)).toMatchObject({ store: null, reason: 'no-context' });
        return { statusCode: 503, body: 'unavailable' };
    });
    expect((await isolated.handler(event)).statusCode).toBe(503);
    expect(globalThis).not.toHaveProperty('netlifyBlobsContext', 'request-context');
});

it('សញ្ញាឯកជនត្រូវដកចេញ ទោះ handler បោះកំហុស', async () => {
    const isolated = isolatedCore();
    const event = {};
    isolated.replaceRequest(async () => { throw new Error('synthetic-handler-failure'); });
    await expect(isolated.createModernHandler(sdk)(event)).rejects.toThrow('synthetic-handler-failure');
    expect(isolated.inspectStore(event)).toMatchObject({ store: null, reason: 'no-context' });
    isolated.replaceRequest(async (incoming: unknown) => {
        expect(isolated.inspectStore(incoming)).toMatchObject({ store: null, reason: 'no-context' });
        return { statusCode: 503, body: 'unavailable' };
    });
    expect((await isolated.handler(event)).statusCode).toBe(503);
});

it.each([undefined, null, NaN, {}, []])('modern helper input %j មិនបើកផ្លូវ request context', async (event) => {
    const isolated = isolatedCore();
    const modern = isolated.createModernHandler(sdk);
    if (event && typeof event === 'object') {
        expect((await modern(event)).statusCode).toBe(405);
        expect(isolated.inspectStore(event)).toMatchObject({ store: null, reason: 'no-context' });
    } else {
        await expect(modern(event)).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
});

it.each(['global', 'env'])('SDK ពិត strong read ប្រើ uncached context (%s) ដោយមិន connectLambda ឬចម្លង global context', async (source) => {
    const isolated = isolatedCore();
    const encoded = Buffer.from(JSON.stringify({ edgeURL: 'https://cached.blobs.invalid', uncachedEdgeURL: 'https://strong.blobs.invalid',
        token: 'synthetic-blob-token', siteID: 'test-site', deployID: 'test-deploy' })).toString('base64');
    if (source === 'global') vi.stubGlobal('netlifyBlobsContext', encoded);
    else vi.stubEnv('NETLIFY_BLOBS_CONTEXT', encoded);
    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
        expect(new URL(input instanceof Request ? input.url : String(input)).origin).toBe('https://strong.blobs.invalid');
        return new Response(JSON.stringify({ state: 'authoritative' }), { headers: { etag: '"test-etag"' } });
    }));
    isolated.replaceRequest(async (event: unknown) => {
        const opened = isolated.inspectStore(event);
        const value = await opened.store.getWithMetadata('journal-test', { type: 'json', consistency: 'strong' });
        return { statusCode: 200, body: JSON.stringify(value) };
    });
    const response = await withLambda(isolated.createModernHandler(sdk))(new Request('https://zoew.invalid/'), context);
    expect(await response.json()).toMatchObject({ data: { state: 'authoritative' }, etag: '"test-etag"' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((globalThis as any).netlifyBlobsContext).toBe(source === 'global' ? encoded : undefined);
    expect(process.env.NETLIFY_BLOBS_CONTEXT).toBe(source === 'env' ? encoded : '');
});

it('SDK ពិតបាត់ context បដិសេធដោយគ្មានបណ្ដាញ ទោះ event ដាក់ endpoints', async () => {
    const isolated = isolatedCore();
    const event = { blobs: Buffer.from(JSON.stringify({ url: 'https://injected.invalid', token: 'injected' })).toString('base64'),
        headers: { 'x-nf-site-id': 'injected', 'x-nf-deploy-id': 'injected' }, uncachedEdgeURL: 'https://injected.invalid' };
    isolated.replaceRequest(async (incoming: unknown) => {
        expect(isolated.inspectStore(incoming)).toMatchObject({ store: null, reason: 'getstore' });
        return { statusCode: 503, body: 'unavailable' };
    });
    expect((await isolated.createModernHandler(sdk)(event)).statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
});
