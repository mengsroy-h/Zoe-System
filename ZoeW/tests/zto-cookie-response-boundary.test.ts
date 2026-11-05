import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { firebaseState, scanState, securityState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { viewState } from '../src/core/view-state';
import { attemptAutoLookup, autoLookupFailureAt, autoLookupInFlight, autoLookupQueueRetries, lookupFastCache } from '../src/features/auto-lookup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { sealLookupHeader } from './helpers/sealed-lookup';

const CORE = process.env.ZTO_COOKIE_BINDING_SOURCE || path.resolve(__dirname, '../netlify/functions/_shared/zto-order-detail-core.cjs');
const core = createRequire(CORE)(CORE);
const CODE = 'SYNTHETIC1001', OTHER = 'SYNTHETIC2002', KEY = 'synthetic-cookie-binding-proxy-key';
const ZTO = 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}';
const SHEET = 'https://script.google.com/macros/s/synthetic/exec?code={barcode}';
const fields: Record<string, HTMLInputElement> = {};
let replyCode: string;
let upstreamCalls: number;

beforeEach(async () => {
    vi.stubGlobal('crypto', webcrypto);
    for (const name of Object.keys(process.env)) if (/^(?:ZTO_|SUPABASE_|FIREBASE_PROJECT_IDS$)/.test(name)) vi.stubEnv(name, '');
    for (const [name, value] of Object.entries({ ZTO_PROXY_KEY: KEY, ZTO_COOKIE: 'BOS-MAN-SESSION=synthetic-cookie-only',
        ZTO_DETAIL_IDENTITY: 'off', ZTO_CACHE_TTL_MS: '60000', ZTO_UPSTREAM_RETRIES: '0' })) vi.stubEnv(name, value);
    core.resetCachesForTests();
    core.setBlobsModuleForTests({ connectLambda() {}, getStore() { throw new Error('គ្មាន provider write ក្នុងតេស្តនេះ'); } });
    appLocalStore.clear();
    clearCustomerDataTableCache();
    autoLookupFailureAt.clear();
    autoLookupInFlight.clear();
    autoLookupQueueRetries.clear();
    lookupFastCache.clear();
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'synthetic-user' } } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'synthetic-id-token' }) } as any;
    uiState.isModalOpen = true;
    scanState.pendingBarcode = CODE;
    viewState.lookupStatus = { kind: '', text: '' };
    for (const name of ['modalPhoneInput', 'modalCodInput', 'modalDodInput']) {
        fields[name] = document.createElement('input');
        refTo(name as any)(fields[name]);
    }
    replyCode = OTHER;
    upstreamCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (target: string, init: RequestInit = {}) => {
        const url = new URL(String(target));
        if (url.hostname === 'example.invalid' && url.pathname === '/.netlify/functions/zto-order-detail') {
            const response = await core.handler({ httpMethod: 'GET', headers: Object.fromEntries(new Headers(init.headers)),
                queryStringParameters: Object.fromEntries(url.searchParams) });
            return new Response(response.body, { status: response.statusCode });
        }
        if (url.origin === 'https://aargus-api.ztoglobal.com' && url.pathname === '/scan/get/order/detail') {
            upstreamCalls++;
            return new Response(JSON.stringify({ success: true, data: { billCode: replyCode, phone: '012000111', cod: 9, dod: 1 } }),
                { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (url.hostname === 'script.google.com') return new Response(JSON.stringify({ barcode: OTHER, phone: '012000111', cod: 9, dod: 1 }));
        throw new Error('ការសាកល្បងហាមបណ្ដាញពិត និងច្រកផ្សេង');
    }));
    await configure(ZTO);
});

async function configure(url: string) {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(await sealLookupHeader({ enabled: true, fastMode: true,
        url, phoneField: 'phone', codField: 'cod', dodField: 'dod', headerName: 'X-Zoe-Proxy-Key' }, KEY)));
}

afterEach(() => {
    core.resetCachesForTests();
    core.setBlobsModuleForTests(null);
    clearCustomerDataTableCache();
    autoLookupFailureAt.clear();
    autoLookupInFlight.clear();
    autoLookupQueueRetries.clear();
    lookupFastCache.clear();
    appLocalStore.clear();
    securityState.lookupSecretKey = null;
    firebaseState.auth = null as any;
    firebaseState.fb = null as any;
    scanState.pendingBarcode = null as any;
    uiState.isModalOpen = false;
    for (const name of Object.keys(fields)) refTo(name as any)(null);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

it('Cookie public handler 502 ឆ្លង caller ពិតដោយគ្មាន foreign fields ឬ Fast Mode cache', async () => {
    await attemptAutoLookup(CODE);
    expect(Object.values(fields).map(field => field.value)).toEqual(['', '', '']);
    expect(viewState.lookupStatus.kind).toBe('lookup-status-error');
    expect(lookupFastCache.size).toBe(0);
    expect(autoLookupInFlight.size).toBe(0);
    expect(upstreamCalls).toBe(2);
});

it('Cookie matching response នៅតែបំពេញ fields និង Fast Mode cache តាម caller ពិត', async () => {
    replyCode = CODE.toLowerCase();
    await attemptAutoLookup(CODE);
    expect(Object.values(fields).map(field => field.value)).toEqual(['012000111', '9', '1']);
    expect(viewState.lookupStatus.kind).toBe('lookup-status-success');
    expect(lookupFastCache.size).toBe(1);
    expect(upstreamCalls).toBe(1);
});

it('Sheet response រក្សា generic lookup contract ដាច់ពី Cookie identity policy', async () => {
    await configure(SHEET);
    await attemptAutoLookup(CODE);
    expect(Object.values(fields).map(field => field.value)).toEqual(['012000111', '9', '1']);
    expect(viewState.lookupStatus.kind).toBe('lookup-status-success');
    expect(lookupFastCache.size).toBe(1);
    expect(upstreamCalls).toBe(0);
});
