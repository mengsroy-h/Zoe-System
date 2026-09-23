// @vitest-environment node
/**
 * ⛔ App Android (origin `https://localhost`) ហៅ ZTO Function ជា cross-origin ➜
 *    ចម្លើយ **គ្រប់ប្រភេទ** (preflight · 200 · 401 · 503) ត្រូវមាន CORS បើមិន
 *    ដូច្នេះ WebView លាក់ `code` របស់កំហុស ហើយ App រាយ «Failed to fetch»។
 * ⛔ ទិសផ្ទុយ ៖ origin ផ្សេង និងសំណើ same-origin របស់ web **គ្មាន** CORS
 *    (ចម្លើយ web ដូចមុនបេះបិទ)។
 */
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const fn = require('../../netlify/functions/zto-order-detail.js');

const savedKey = process.env.ZTO_PROXY_KEY;
beforeEach(() => { delete process.env.ZTO_PROXY_KEY; });
afterEach(() => {
    if (savedKey === undefined) delete process.env.ZTO_PROXY_KEY;
    else process.env.ZTO_PROXY_KEY = savedKey;
});

function event(method: string, headers: Record<string, string>) {
    return { httpMethod: method, headers, queryStringParameters: { barcode: '771305000001' } };
}

describe('ZTO Function ៖ CORS សម្រាប់ App Android', () => {
    it('preflight ពី https://localhost ➜ អនុញ្ញាត origin និង header ដែលសុំ', async () => {
        const res = await fn.handler(event('OPTIONS', {
            origin: 'https://localhost',
            'access-control-request-method': 'GET',
            'access-control-request-headers': 'x-zoe-proxy-key, x-zoe-id-token'
        }));
        expect(res.statusCode).toBe(204);
        expect(res.headers['Access-Control-Allow-Origin']).toBe('https://localhost');
        expect(res.headers['Access-Control-Allow-Headers']).toBe('x-zoe-proxy-key, x-zoe-id-token');
        expect(res.headers['Access-Control-Allow-Methods']).toContain('GET');
        expect(res.headers.Vary).toBe('Origin');
    });

    it('ចម្លើយកំហុស (503) ពី https://localhost ក៏មាន CORS ដែរ', async () => {
        const res = await fn.handler(event('GET', { Origin: 'https://localhost' }));
        expect(res.statusCode).toBe(503);
        expect(res.headers['Access-Control-Allow-Origin']).toBe('https://localhost');
        expect(JSON.parse(res.body).code).toBe('ZTO_PROXY_NOT_CONFIGURED');
    });

    it('origin ផ្សេង ➜ គ្មាន CORS', async () => {
        const res = await fn.handler(event('GET', { origin: 'https://evil.example' }));
        expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
        const pre = await fn.handler(event('OPTIONS', { origin: 'http://localhost', 'access-control-request-headers': 'x-zoe-proxy-key' }));
        expect(pre.headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('web same-origin (គ្មាន Origin) ➜ header ដូចមុនបេះបិទ', async () => {
        const pre = await fn.handler(event('OPTIONS', {}));
        expect(pre.headers).toEqual({ Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' });
    });

    it('ឈ្មោះ header ចម្លែក ➜ មិនឆ្លុះបញ្ចាំង', async () => {
        const res = await fn.handler(event('OPTIONS', {
            origin: 'https://localhost',
            'access-control-request-headers': 'x-ok, bad header\r\nx: y'
        }));
        expect(res.headers['Access-Control-Allow-Origin']).toBe('https://localhost');
        expect(res.headers['Access-Control-Allow-Headers']).toBeUndefined();
    });
});
