/**
 * ⛔ Barcode ដែល Function ZTO បដិសេធ (`BARCODE_RE` ➜ 400 `ZTO_BARCODE_INVALID`, មិនហៅ ZTO) ត្រូវឈប់នៅ App ៖
 *    គ្មានការហៅបណ្ដាញ · គ្មាន cooldown · គ្មាន Sentry · សារប្រាប់ឲ្យបញ្ចូលដោយដៃ (មិនមែន «មិនអាចភ្ជាប់ ZTO»)។
 * ⛔ ច្រកបម្រុង ៖ បើ Function នៅតែឆ្លើយ `ZTO_BARCODE_INVALID` ➜ សារដដែល · សាលក្រមស្ថាពរ · គ្មាន Sentry។
 * ⛔ APK ៖ 400 ដែលពន្យល់ដោយ barcode ខ្លួនឯង មិនសាក URL ចាស់ (សំណើ ២ ដងក្នុងមួយការស្កេន)
 *    តែ 400 ពី Function ចាស់ (barcode ត្រឹមត្រូវ) នៅតែសាក URL ចាស់ ហើយចងចាំ។
 * ⛔ ទិសផ្ទុយ ៖ Apps Script · API ផ្ទាល់ខ្លួន មិនពិនិត្យទម្រង់ ZTO · cache នៅតែឈ្នះមុន។
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupState, scanState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import {
    AUTO_LOOKUP_FAIL_COOLDOWN_MS, attemptAutoLookup, autoLookupFailureAt, autoLookupInFlight, autoLookupQueueRetries,
    lookupFastCache, setFastLookupRow
} from '../src/features/auto-lookup';
import { ZTO_BARCODE_RE, ztoBarcodeShapeIsValid } from '../src/features/customer-table-prefetch';
import { fetchWithTimeout, lookupFailureIsDefinitive, ztoRequestBarcodeIsRefused } from '../src/services/network';

const ZTO_URL = 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}';
const SHAPE_TEXT = 'Barcode នេះមិនមែនទម្រង់ ZTO';
const BAD = ['AB12', 'ABC 12345', 'ABC.12345', 'ABC/12345', 'ក123456', 'A'.repeat(65), ''];
const GOOD = ['771305', 'ZTO123456', 'ab_cd-12', 'A'.repeat(64)];

function functionBarcodeRe(): RegExp {
    const src = fs.readFileSync(path.resolve(__dirname, '../netlify/functions/zto-order-detail.js'), 'utf8');
    const m = /const BARCODE_RE = \/(.+)\/([a-z]*);/.exec(src);
    if (!m) throw new Error('BARCODE_RE not found in zto-order-detail.js');
    return new RegExp(m[1], m[2]);
}

const capture = vi.fn();

function useConfig(url: string) {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({
        enabled: true, fastMode: true, url, phoneField: 'phone', codField: 'cod', dodField: 'dod'
    }));
}

function serve(status: number, body: unknown) {
    const calls: Array<[string, any]> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: any) => {
        calls.push([url, options]);
        return new Response(JSON.stringify(body), { status });
    }));
    return calls;
}

async function scan(barcode: string) {
    scanState.pendingBarcode = barcode;
    await attemptAutoLookup(barcode);
    return viewState.lookupStatus;
}

beforeEach(() => {
    appLocalStore.clear();
    useConfig(ZTO_URL);
    uiState.isModalOpen = true;
    autoLookupFailureAt.clear();
    autoLookupInFlight.clear();
    autoLookupQueueRetries.clear();
    lookupFastCache.clear();
    capture.mockReset();
    (window as any).ZoeErrors = { capture };
    viewState.lookupStatus = { kind: '', text: '' };
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    delete (window as any).ZoeErrors;
    delete (window as any).Capacitor;
    lookupState.nativeQueryHeaderUnsupported = false;
    uiState.isModalOpen = false;
    scanState.pendingBarcode = null as any;
    appLocalStore.clear();
});

describe('ទម្រង់ barcode ZTO ៖ App និង Function ប្រើច្បាប់តែមួយ', () => {
    it('ZTO_BARCODE_RE ស្មើ BARCODE_RE របស់ Function ទាំង ២ ទិស', () => {
        const fnRe = functionBarcodeRe();
        expect(ZTO_BARCODE_RE.source).toBe(fnRe.source);
        for (const code of [...BAD, ...GOOD]) expect(ZTO_BARCODE_RE.test(code)).toBe(fnRe.test(code));
    });

    it('ztoBarcodeShapeIsValid ៖ កាត់ចន្លោះដូច Function · គ្មានតម្លៃ ➜ ខុស', () => {
        expect(ztoBarcodeShapeIsValid(' 771305 ')).toBe(true);
        expect(ztoBarcodeShapeIsValid(undefined)).toBe(false);
        expect(ztoBarcodeShapeIsValid(null)).toBe(false);
        expect(ztoBarcodeShapeIsValid('ABC.12345')).toBe(false);
    });
});

describe('attemptAutoLookup ៖ barcode ក្រៅទម្រង់ ZTO មិនចេញទៅបណ្ដាញ', () => {
    it.each(BAD.filter(Boolean))('ZTO + %j ➜ 0 សំណើ · សារបញ្ចូលដោយដៃ · គ្មាន cooldown · គ្មាន Sentry', async (code) => {
        const calls = serve(200, { found: true, phone: '012345678' });
        const status = await scan(code);
        expect(calls.length).toBe(0);
        expect(status.text).toContain(SHAPE_TEXT);
        expect(status.kind).toBe('lookup-status-warn');
        expect(autoLookupFailureAt.size).toBe(0);
        expect(capture).not.toHaveBeenCalled();
        expect(autoLookupInFlight.size).toBe(0);
    });

    it('ជួររង់ចាំរបស់ barcode នោះត្រូវដកចេញ', async () => {
        serve(200, {});
        const timer = setTimeout(() => {}, 60000);
        autoLookupQueueRetries.set('ABC.12345', { timer, armedAt: Date.now() });
        await scan('ABC.12345');
        expect(autoLookupQueueRetries.has('ABC.12345')).toBe(false);
        clearTimeout(timer);
    });

    it('ពិនិត្យមុនច្រក offline និង cooldown', async () => {
        serve(200, {});
        autoLookupFailureAt.set('ABC.12345', { at: Date.now(), ms: AUTO_LOOKUP_FAIL_COOLDOWN_MS });
        expect((await scan('ABC.12345')).text).toContain(SHAPE_TEXT);
        vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => false);
        expect((await scan('XYZ.12345')).text).toContain(SHAPE_TEXT);
        expect((await scan('771305')).text).toContain('ក្រៅបណ្ដាញ');
    });

    it('ពិនិត្យមុនច្រក PIN ៖ barcode ក្រៅទម្រង់មិនសុំ PIN ដោះសោ Lookup', () => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({
            enabled: true, fastMode: true, url: ZTO_URL, headerName: 'X-Zoe-Proxy-Key', headerValueEnc: { iv: [1], data: [2] }
        }));
        serve(200, {});
        scanState.pendingBarcode = 'ABC.12345';
        void attemptAutoLookup('ABC.12345');
        expect(viewState.lookupStatus.text).toContain(SHAPE_TEXT);
        expect(lookupState.pendingLookupUnlockBarcode).not.toBe('ABC.12345');
    });

    it.each(GOOD)('ទិសផ្ទុយ ៖ ZTO + %j ➜ ហៅ Function ១ ដង', async (code) => {
        const calls = serve(200, { found: true, phone: '012345678' });
        const status = await scan(code);
        expect(calls.length).toBe(1);
        expect(status.text).not.toContain(SHAPE_TEXT);
    });

    it('ទិសផ្ទុយ ៖ cache ក្នុងឧបករណ៍នៅតែឈ្នះមុន', async () => {
        const calls = serve(200, {});
        setFastLookupRow('ABC.12345', '012345678', 1, 0, { fastMode: true });
        const status = await scan('ABC.12345');
        expect(calls.length).toBe(0);
        expect(status.kind).toBe('lookup-status-cache');
    });

    it.each([
        ['Apps Script', 'https://script.google.com/macros/s/x/exec?code={barcode}'],
        ['API ផ្ទាល់ខ្លួន', 'https://api.example.invalid/lookup?code={barcode}']
    ])('ទិសផ្ទុយ ៖ %s មិនពិនិត្យទម្រង់ ZTO', async (_label, url) => {
        useConfig(url);
        const calls = serve(200, { found: true, phone: '012345678' });
        const status = await scan('ABC.12345');
        expect(calls.length).toBe(1);
        expect(status.text).not.toContain(SHAPE_TEXT);
    });
});

describe('ច្រកបម្រុង ៖ Function ឆ្លើយ ZTO_BARCODE_INVALID', () => {
    it('សារបញ្ចូលដោយដៃ · សាលក្រមស្ថាពរ · គ្មាន Sentry', async () => {
        const calls = serve(400, { error: 'Invalid barcode', code: 'ZTO_BARCODE_INVALID' });
        const status = await scan('771305');
        expect(calls.length).toBe(1);
        expect(status.text).toContain(SHAPE_TEXT);
        expect(status.text).not.toContain('មិនអាចភ្ជាប់');
        expect(autoLookupFailureAt.get('771305')?.ms).toBe(AUTO_LOOKUP_FAIL_COOLDOWN_MS);
        expect(capture).not.toHaveBeenCalled();
    });

    it('lookupFailureIsDefinitive ទទួលស្គាល់ ZTO_BARCODE_INVALID', () => {
        expect(lookupFailureIsDefinitive({ lookupCode: 'ZTO_BARCODE_INVALID', message: 'HTTP 400' })).toBe(true);
        expect(lookupFailureIsDefinitive({ lookupCode: 'ZTO_UPSTREAM_UNAVAILABLE', message: 'HTTP 502' })).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ 400 គ្មានកូដ នៅតែជាសារទូទៅ ហើយផ្ញើ Sentry', async () => {
        serve(400, { error: 'x' });
        const status = await scan('771305');
        expect(status.text).not.toContain(SHAPE_TEXT);
        expect(capture).toHaveBeenCalledTimes(1);
    });
});

describe('APK ៖ 400 ដែល barcode ខ្លួនឯងពន្យល់ មិនសាក URL ចាស់', () => {
    const ORIGIN = 'https://zoew.example.app';
    const FN = '/.netlify/functions/zto-order-detail';
    const installBridge = () => {
        (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
        vi.stubEnv('VITE_NATIVE_WEB_ORIGIN', ORIGIN);
    };
    const refusal = { error: 'Invalid barcode', code: 'ZTO_BARCODE_INVALID' };
    const get = (query: string) => fetchWithTimeout(FN + '?' + query, { headers: { 'X-Zoe-Proxy-Key': 'k' } }, 2000, 't',
        (r: Response) => r.status);

    it.each(['barcode=ABC.12345', 'barcode=AB12', 'barcode=%E1%9E%80123456'])('%s ➜ សំណើ ១ · មិនចងចាំ', async (query) => {
        installBridge();
        const calls = serve(400, refusal);
        const out = await get(query);
        expect(out.body).toBe(400);
        expect(calls.length).toBe(1);
        expect(calls[0][0]).toBe(ORIGIN + FN);
        expect(lookupState.nativeQueryHeaderUnsupported).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ Function ចាស់ (barcode ត្រឹមត្រូវ ➜ 400 ZTO_BARCODE_INVALID) ➜ សាក URL ចាស់ ហើយចងចាំ', async () => {
        installBridge();
        const calls: string[] = [];
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            calls.push(url);
            return url.includes('?') ? new Response('{}', { status: 200 }) : new Response(JSON.stringify(refusal), { status: 400 });
        }));
        const out = await get('barcode=771305');
        expect(out.body).toBe(200);
        expect(calls).toEqual([ORIGIN + FN, ORIGIN + FN + '?barcode=771305']);
        expect(lookupState.nativeQueryHeaderUnsupported).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ សំណើបញ្ជី (list=1) និង diag ➜ ផ្លូវបម្រុងដដែល', async () => {
        installBridge();
        for (const query of ['list=1&from=2026-09-01&to=2026-09-01&page=1', 'diag=1']) {
            const calls = serve(400, refusal);
            await get(query);
            expect(calls.length).toBe(2);
        }
    });

    it('ztoRequestBarcodeIsRefused មិនបោះលើតម្លៃចម្លែក', () => {
        for (const raw of [undefined, null, NaN, {}, [], 'https://[bad/.netlify/functions/zto-order-detail?barcode=AB12']) {
            expect(ztoRequestBarcodeIsRefused(raw as any)).toBe(false);
        }
        expect(ztoRequestBarcodeIsRefused(ORIGIN + FN + '?barcode=AB12')).toBe(true);
        expect(ztoRequestBarcodeIsRefused(ORIGIN + FN + '?barcode=771305')).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ Function ផ្សេង (មិនមែន ZTO) ➜ ផ្លូវបម្រុងដដែល', async () => {
        installBridge();
        const calls = serve(400, refusal);
        await fetchWithTimeout('/.netlify/functions/other?barcode=AB12', { headers: { 'X-K': 'k' } }, 2000, 't');
        expect(calls.length).toBe(2);
    });
});
