/**
 * ⛔ សំណើម្ចាស់គម្រោង (ជម្រើស ៣ · ៤) ៖ `/detail` របស់ Function ZTO ចងអត្តសញ្ញាណ និងសាខាដូច `?list=1` ៖ App ផ្ញើ `X-Zoe-Id-Token`
 *    លើរាល់សំណើ `/detail` (ស្កេន · ពិនិត្យស្ថានភាព ZTO) ➜ Function (`ZTO_DETAIL_IDENTITY=require`) បដិសេធសំណើគ្មានគណនី។
 * ⛔ ច្បាប់ ៖ token ទៅតែ Function ZTO (`lookupApiIsZto()`) ⛔ មិនដែលទៅ API ស្វែងរកផ្សេង (Apps Script · API ផ្ទាល់ខ្លួន) ·
 *    គ្មាន token (មិនទាន់ចូល · យកមិនបាន) ➜ សំណើនៅតែចេញ (Function សម្រេច) · សារ ៖ `ZTO_IDENTITY_REQUIRED` ➜ ចូលម្តងទៀត ·
 *    `ZTO_IDENTITY_UNAVAILABLE` ➜ សាកម្តងទៀត (503 ➜ retry) · `ZTO_OTHER_BRANCH` ➜ «សាខាផ្សេង» មិនមែន «រកមិនឃើញ»។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, lookupState, scanState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { attemptAutoLookup, autoLookupFailureAt, autoLookupInFlight, autoLookupQueueRetries, lookupFastCache } from '../src/features/auto-lookup';
import { checkZtoStatusForBarcode } from '../src/features/zto-status';
import { healthLookupRow } from '../src/features/health-check';

const ZTO_URL = 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}';
const OTHER_URL = 'https://api.example.invalid/lookup?code={barcode}';
const BARCODE = '77130527210012';

function useConfig(url: string) {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({
        enabled: true, fastMode: true, url, phoneField: 'phone', codField: 'cod', dodField: 'dod',
        headerName: 'X-Zoe-Proxy-Key', headerValue: 'shop-a-key-0123456789abcdef'
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

function headerOf(call: [string, any] | undefined, name: string) {
    const headers = (call && call[1] && call[1].headers) || {};
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : undefined;
}

async function scan(barcode = BARCODE) {
    scanState.pendingBarcode = barcode;
    await attemptAutoLookup(barcode);
    return viewState.lookupStatus;
}

function signIn(token: string | null) {
    firebaseState.authGeneration++;
    firebaseState.auth = token === null ? ({ currentUser: null } as any) : ({ currentUser: { uid: 'audit-user' } } as any);
    firebaseState.fb = { getIdTokenResult: async () => ({ token }) } as any;
}

beforeEach(() => {
    appLocalStore.clear();
    useConfig(ZTO_URL);
    uiState.isModalOpen = true;
    autoLookupFailureAt.clear();
    autoLookupInFlight.clear();
    autoLookupQueueRetries.clear();
    lookupFastCache.clear();
    (window as any).ZoeErrors = { capture: vi.fn() };
    viewState.lookupStatus = { kind: '', text: '' };
    signIn('audit-id-token');
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
    lookupState.nativeQueryHeaderUnsupported = false;
    uiState.isModalOpen = false;
    scanState.pendingBarcode = null as any;
    firebaseState.fb = null as any;
    firebaseState.auth = null as any;
    appLocalStore.clear();
});

describe('ZTO /detail ៖ App ផ្ញើ ID token តែទៅ Function ZTO', () => {
    it('⛔ ស្កេន ➜ សំណើ /detail មាន `X-Zoe-Id-Token` + សោហាង', async () => {
        const calls = serve(200, { success: true, found: true, phone: '0974158508', cod: 6.55, dod: 0 });
        const status = await scan();
        expect(calls.length).toBe(1);
        expect(headerOf(calls[0], 'X-Zoe-Id-Token')).toBe('audit-id-token');
        expect(headerOf(calls[0], 'X-Zoe-Proxy-Key')).toBe('shop-a-key-0123456789abcdef');
        expect(status.text).toContain('រកឃើញ');
    });

    it('⛔ ពិនិត្យស្ថានភាព ZTO (`checkZtoStatusForBarcode`) ➜ មាន `X-Zoe-Id-Token`', async () => {
        const calls = serve(200, { success: true, found: true, ztoClosed: true });
        const cfg = JSON.parse(appLocalStore.getItem('zoew_lookup_api_config') as string);
        const out = await checkZtoStatusForBarcode(cfg, BARCODE);
        expect(out).toEqual({ closed: true });
        expect(headerOf(calls[0], 'X-Zoe-Id-Token')).toBe('audit-id-token');
    });

    it('⛔ ទិសផ្ទុយ ៖ API ស្វែងរកផ្សេង (មិនមែន Function ZTO) ➜ មិនដែលទទួល ID token', async () => {
        useConfig(OTHER_URL);
        const calls = serve(200, { phone: '0974158508', cod: 6.55, dod: 0 });
        await scan();
        expect(calls.length).toBe(1);
        expect(headerOf(calls[0], 'X-Zoe-Id-Token')).toBeUndefined();
        expect(headerOf(calls[0], 'X-Zoe-Proxy-Key')).toBe('shop-a-key-0123456789abcdef');
    });

    it('ទិសផ្ទុយ ៖ គ្មានគណនីចូល ➜ សំណើនៅតែចេញ (គ្មាន token · Function សម្រេច)', async () => {
        signIn(null);
        const calls = serve(200, { success: true, found: true, phone: '0974158508', cod: 1, dod: 0 });
        await scan();
        expect(calls.length).toBe(1);
        expect(headerOf(calls[0], 'X-Zoe-Id-Token')).toBeUndefined();
    });

    it('⛔ `ZTO_OTHER_BRANCH` ➜ សារ «សាខាផ្សេង» (មិនមែន «រកមិនឃើញ»)', async () => {
        serve(200, { success: false, found: false, barcode: BARCODE, code: 'ZTO_OTHER_BRANCH' });
        const status = await scan();
        expect(status.text).toContain('សាខាផ្សេង');
        expect(status.text).not.toContain('មិនឃើញទិន្នន័យ');
    });

    it('⛔ 401 `ZTO_IDENTITY_REQUIRED` ➜ ប្រាប់ឲ្យចូលគណនីម្តងទៀត (មិនមែន «Secret មិនត្រឹមត្រូវ»)', async () => {
        serve(401, { error: 'Identity required', code: 'ZTO_IDENTITY_REQUIRED', reason: 'idtoken:missing' });
        const status = await scan();
        expect(status.text).toContain('ចូលគណនីម្តងទៀត');
        expect(status.text).not.toContain('Secret');
    });

    it('⛔ 503 `ZTO_IDENTITY_UNAVAILABLE` ➜ សាកម្តងទៀតដោយស្វ័យប្រវត្តិ · សារ «ផ្ទៀងផ្ទាត់គណនីមិនបាន»', async () => {
        const calls = serve(503, { error: 'Identity check unavailable', code: 'ZTO_IDENTITY_UNAVAILABLE', reason: 'idtoken:certs' });
        const status = await scan();
        expect(calls.length).toBe(2);
        expect(status.text).toContain('ផ្ទៀងផ្ទាត់គណនី');
    });

    it('(២) 🩺 ជួរ Lookup ZTO បង្ហាញឈ្មោះសោហាង និងរបៀបផ្ទៀងគណនីពី `?diag=1` (មិនមែនតម្លៃសោ)', async () => {
        const calls = serve(200, {
            ok: true, code: 'ZTO_DIAG', auth: 'cookie',
            cookie: { source: 'blob', fingerprint: 'abcd1234', ageMs: 1000, authAcceptedAgeMs: 5000 },
            access: { keyLabel: 'shop-pp1', keys: 2, invalidKeys: 0, identity: 'require' }
        });
        const row: any = await healthLookupRow();
        const text = JSON.stringify(row);
        expect(calls.length).toBe(1);
        expect(text).toContain('សោហាង shop-pp1');
        expect(text).toContain('ផ្ទៀងគណនី require');
        expect(text).not.toContain('shop-a-key-0123456789abcdef');
    });
});
