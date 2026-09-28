/**
 * ⛔ App Android (origin `https://localhost`) ហៅ Function ZTO ជា cross-origin ជាមួយ header ផ្ទាល់ខ្លួន ➜ WebView ផ្ញើ
 *    preflight OPTIONS ហើយ cache របស់ preflight ចងនឹង **URL ពេញ** ➜ barcode ក្នុង query = preflight **រាល់ការស្កេន**
 *    (វាស់បានក្នុង Chromium ៖ ៥ សំណើ ➜ OPTIONS ៥ · URL ថេរ + query ក្នុង header ➜ OPTIONS ១)។ ម្ចាស់គម្រោងវាស់លើទូរស័ព្ទ ៖
 *    PWA ០.៦–០.៧ វិ. ធៀប APK ១.២–១.៧ វិ.។
 * ⛔ ទិសផ្ទុយ ៖ web · សំណើគ្មាន header (simple request) · method ក្រៅ GET (warm-up `OPTIONS`) · origin ផ្សេង ➜ **មិនប្រែ**។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NATIVE_QUERY_HEADER, nativeFunctionRequest } from '../../src/platform/native';
import { fetchWithTimeout } from '../../src/services/network';
import { lookupState } from '../../src/core/state';

const ORIGIN = 'https://zoew.example.app';
const FN = '/.netlify/functions/zto-order-detail';

function installBridge() {
    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
    vi.stubEnv('VITE_NATIVE_WEB_ORIGIN', ORIGIN);
}

afterEach(() => {
    lookupState.nativeQueryHeaderUnsupported = false;
    delete (window as any).Capacitor;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('nativeFunctionRequest ៖ query ➜ header លើ APK តែប៉ុណ្ណោះ', () => {
    it('web ៖ URL និង header ដដែលបេះបិទ', () => {
        vi.stubEnv('VITE_NATIVE_WEB_ORIGIN', ORIGIN);
        const options = { headers: { 'X-Zoe-Proxy-Key': 'k' } };
        const out = nativeFunctionRequest(FN + '?barcode=771305', options);
        expect(out.url).toBe(FN + '?barcode=771305');
        expect(out.options).toBe(options);
    });

    it('APK ៖ URL ថេរ · query ក្នុង X-Zoe-Query · header ដើមនៅដដែល · options ដើមមិនប្រែ', () => {
        installBridge();
        const options = { headers: { 'X-Zoe-Proxy-Key': 'k' }, signal: undefined };
        const out = nativeFunctionRequest(FN + '?barcode=771305&fresh=1#x', options);
        expect(out.url).toBe(ORIGIN + FN);
        expect(out.options.headers).toEqual({ 'X-Zoe-Proxy-Key': 'k', [NATIVE_QUERY_HEADER]: 'barcode=771305&fresh=1' });
        expect(options.headers).toEqual({ 'X-Zoe-Proxy-Key': 'k' });
    });

    it('APK ៖ URL ពេញរបស់ origin ដដែល ➜ ប្រែដូចគ្នា · barcode ពីរ ➜ URL តែមួយ', () => {
        installBridge();
        const a = nativeFunctionRequest(ORIGIN + FN + '?barcode=1', { headers: { 'X-Zoe-Proxy-Key': 'k' } });
        const b = nativeFunctionRequest(ORIGIN + FN + '?barcode=2', { headers: { 'X-Zoe-Proxy-Key': 'k' } });
        expect(a.url).toBe(ORIGIN + FN);
        expect(b.url).toBe(a.url);
    });

    it('ទិសផ្ទុយ ៖ គ្មាន header · warm-up OPTIONS · origin ផ្សេង · Apps Script · query វែងពេក · Headers object ➜ មិនប្រែ', () => {
        installBridge();
        const keep = (url: string, options: any) => {
            const out = nativeFunctionRequest(url, options);
            expect(out.options).toBe(options);
            return out.url;
        };
        expect(keep(FN + '?barcode=1', {})).toBe(ORIGIN + FN + '?barcode=1');
        expect(keep(FN + '?barcode=1', { headers: {} })).toBe(ORIGIN + FN + '?barcode=1');
        expect(keep(FN, { method: 'OPTIONS', cache: 'no-store' })).toBe(ORIGIN + FN);
        expect(keep('https://other.example/.netlify/functions/zto-order-detail?barcode=1', { headers: { 'X-K': 'k' } }))
            .toBe('https://other.example/.netlify/functions/zto-order-detail?barcode=1');
        expect(keep('https://script.google.com/macros/s/x/exec?code=1', { headers: { 'X-K': 'k' } }))
            .toBe('https://script.google.com/macros/s/x/exec?code=1');
        const long = FN + '?barcode=1&pad=' + 'a'.repeat(3000);
        expect(keep(long, { headers: { 'X-K': 'k' } })).toBe(ORIGIN + long);
        expect(keep(FN + '?barcode=1', { headers: new Headers({ 'X-K': 'k' }) })).toBe(ORIGIN + FN + '?barcode=1');
    });
});

describe('fetchWithTimeout ៖ ច្រកតែមួយទៅ fetch ប្រើ nativeFunctionRequest', () => {
    const capture = () => {
        const calls: Array<[string, any]> = [];
        vi.stubGlobal('fetch', (url: string, options: any) => {
            calls.push([url, options]);
            return Promise.resolve(new Response('{}', { status: 200 }));
        });
        return calls;
    };

    it('APK ៖ fetch ទទួល URL ថេរ និង X-Zoe-Query', async () => {
        installBridge();
        const calls = capture();
        await fetchWithTimeout(FN + '?barcode=771305', { headers: { 'X-Zoe-Proxy-Key': 'k' } }, 2000, 't');
        expect(calls.length).toBe(1);
        expect(calls[0][0]).toBe(ORIGIN + FN);
        expect(calls[0][1].headers[NATIVE_QUERY_HEADER]).toBe('barcode=771305');
        expect(calls[0][1].signal).toBeTruthy();
    });

    it('web ៖ fetch ទទួល URL ដើម (query នៅក្នុង URL · គ្មាន header បន្ថែម)', async () => {
        const calls = capture();
        await fetchWithTimeout(FN + '?barcode=771305', { headers: { 'X-Zoe-Proxy-Key': 'k' } }, 2000, 't');
        expect(calls[0][0]).toBe(FN + '?barcode=771305');
        expect(calls[0][1].headers[NATIVE_QUERY_HEADER]).toBeUndefined();
    });
});

describe('ផ្លូវបម្រុង ៖ APK ថ្មី ➜ Function ចាស់ (មិនស្គាល់ X-Zoe-Query)', () => {
    const serve = (answer: (url: string, options: any) => number) => {
        const calls: Array<[string, any]> = [];
        vi.stubGlobal('fetch', (url: string, options: any) => {
            calls.push([url, options]);
            return Promise.resolve(new Response('{}', { status: answer(url, options) }));
        });
        return calls;
    };
    const lookup = (code: string) => fetchWithTimeout(FN + '?barcode=' + code, { headers: { 'X-Zoe-Proxy-Key': 'k' } }, 2000, 't',
        (r: Response) => r.status);

    it('Function ចាស់ ៖ header ➜ 400 · URL ចាស់ ➜ 200 ➜ ចម្លើយ 200 · ចងចាំ ➜ ការស្កេនបន្ទាប់ទៅ URL ចាស់ត្រង់', async () => {
        installBridge();
        const calls = serve((url) => (url.includes('?') ? 200 : 400));
        const first = await lookup('771305');
        expect(first.body).toBe(200);
        expect(calls.map((c) => c[0])).toEqual([ORIGIN + FN, ORIGIN + FN + '?barcode=771305']);
        expect(lookupState.nativeQueryHeaderUnsupported).toBe(true);
        await lookup('771306');
        expect(calls.length).toBe(3);
        expect(calls[2][0]).toBe(ORIGIN + FN + '?barcode=771306');
    });

    it('Function ថ្មី + barcode ខុសពិត (400 ទាំង ២) ➜ មិនចងចាំ ➜ ការស្កេនបន្ទាប់នៅផ្លូវ header', async () => {
        installBridge();
        const calls = serve(() => 400);
        const first = await lookup('<bad>');
        expect(first.body).toBe(400);
        expect(lookupState.nativeQueryHeaderUnsupported).toBe(false);
        await lookup('771305');
        expect(calls[calls.length - 2][0]).toBe(ORIGIN + FN);
    });

    it('Function ថ្មី ៖ 200 លើកដំបូង ➜ សំណើតែ ១ (គ្មានការសាកស្ទួន)', async () => {
        installBridge();
        const calls = serve(() => 200);
        await lookup('771305');
        expect(calls.length).toBe(1);
    });

    it('web ៖ 400 មិនសាកស្ទួន (ផ្លូវបម្រុងមានតែលើ APK)', async () => {
        const calls = serve(() => 400);
        await lookup('771305');
        expect(calls.length).toBe(1);
    });
});
