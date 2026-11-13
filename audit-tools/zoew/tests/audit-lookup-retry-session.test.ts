import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { refTo } from '../../../ZoeW/src/app/refs';
import { firebaseState, lookupState, scanState, securityState, uiState } from '../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../ZoeW/src/core/storage';
import { viewState } from '../../../ZoeW/src/core/view-state';
import { attemptAutoLookup, autoLookupFailureAt, autoLookupInFlight, autoLookupQueueRetries, lookupFastCache } from '../../../ZoeW/src/features/auto-lookup';
import { clearCustomerDataTableCache, fetchCustomerDataTableRows } from '../../../ZoeW/src/features/customer-table';
import { sealLookupHeader } from './helpers/sealed-lookup';

const CODE = 'SYNTHETIC1001', KEY = 'synthetic-cookie-binding-proxy-key';
const ZTO = 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}';
const SHEET = 'https://script.google.com/macros/s/synthetic/exec?code={barcode}';
const fields: Record<string, HTMLInputElement> = {};

beforeEach(async () => {
    vi.stubGlobal('crypto', webcrypto);
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
    await configure(ZTO);
});

async function configure(url: string) {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(await sealLookupHeader({ enabled: true, fastMode: true,
        url, phoneField: 'phone', codField: 'cod', dodField: 'dod', headerName: 'X-Zoe-Proxy-Key' }, KEY)));
}

afterEach(() => {
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
    vi.unstubAllGlobals();
});

it('ចាកចេញនៅចន្លោះ retry ➜ មិនផ្ញើ credential វគ្គចាស់ទៀត', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response(JSON.stringify({ code: 'TEMPORARY_ERROR' }), { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    try {
        const running = attemptAutoLookup(CODE);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        // Let the first response finish and place the retry in its backoff window.
        await vi.advanceTimersByTimeAsync(0);
        firebaseState.authGeneration++;
        firebaseState.auth = { currentUser: null } as any;
        clearCustomerDataTableCache();
        await vi.advanceTimersByTimeAsync(2000);
        await running;
        expect(new Headers(fetch.mock.calls[0][1]?.headers).get('X-Zoe-Proxy-Key')).toBe(KEY);
        if (fetch.mock.calls.length > 1) expect(new Headers(fetch.mock.calls[1][1]?.headers).get('X-Zoe-Proxy-Key')).toBe(KEY);
        expect(fetch, 'No request may reuse old identity/proxy headers after sign-out').toHaveBeenCalledTimes(1);
    } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});

it('តារាងអតិថិជន៖ ចាកចេញនៅចន្លោះ retry ➜ មិនផ្ញើសំណើវគ្គចាស់', async () => {
    await configure(SHEET);
    vi.useFakeTimers();
    const fetch = vi.fn(async () => new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    try {
        const running = fetchCustomerDataTableRows(true);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        await vi.advanceTimersByTimeAsync(0);
        firebaseState.authGeneration++;
        firebaseState.auth = { currentUser: null } as any;
        clearCustomerDataTableCache();
        await vi.advanceTimersByTimeAsync(3000);
        await running;
        expect(fetch, 'Customer-table retry must retain original session ownership').toHaveBeenCalledTimes(1);
    } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});

for (const caller of ['lookup', 'table']) {
    it.each(['session', 'config', 'key'])(caller + ' credential កំពុងដោះសោ៖ %s ប្តូរ ➜ មិនផ្ញើ', async (change) => {
        if (caller === 'table') await configure('https://example.invalid/custom-api?barcode={barcode}');
        const originalDecrypt = webcrypto.subtle.decrypt.bind(webcrypto.subtle);
        let release!: () => void;
        const gate = new Promise<void>((yes) => { release = yes; });
        const decrypt = vi.spyOn(webcrypto.subtle, 'decrypt').mockImplementation(async (...args: Parameters<typeof originalDecrypt>) => {
            await gate;
            return originalDecrypt(...args);
        });
        const fetch = vi.fn(async () => new Response(JSON.stringify({ success: true, phone: '012000111', rows: [] })));
        vi.stubGlobal('fetch', fetch);
        try {
            const running = caller === 'lookup' ? attemptAutoLookup(CODE) : fetchCustomerDataTableRows(true);
            await vi.waitFor(() => expect(decrypt).toHaveBeenCalledOnce());
            if (change === 'session') {
                firebaseState.authGeneration++;
                firebaseState.auth = { currentUser: { uid: 'replacement-user' } } as any;
            } else if (change === 'key') securityState.lookupSecretKey = null;
            else appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: false, url: SHEET }));
            clearCustomerDataTableCache();
            release();
            await running;
            expect(fetch, 'Credential preparation cannot transfer work into a replacement scope').not.toHaveBeenCalled();
        } finally { release(); decrypt.mockRestore(); }
    });

    it(caller + ' lookup config ប្តូរនៅចន្លោះ retry ➜ មិនផ្ញើចាស់', async () => {
        if (caller === 'table') await configure('https://example.invalid/custom-api?barcode={barcode}');
        vi.useFakeTimers();
        const fetch = vi.fn(async () => new Response('{}', { status: 503 }));
        vi.stubGlobal('fetch', fetch);
        try {
            const running = caller === 'lookup' ? attemptAutoLookup(CODE) : fetchCustomerDataTableRows(true);
            await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
            await vi.advanceTimersByTimeAsync(0);
            appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: false, url: SHEET }));
            clearCustomerDataTableCache();
            await vi.advanceTimersByTimeAsync(3000);
            await running;
            expect(fetch).toHaveBeenCalledTimes(1);
        } finally { vi.clearAllTimers(); vi.useRealTimers(); }
    });
}

for (const caller of ['lookup', 'table']) {
    it(caller + ' config ប្តូរដោយផ្ទាល់ពេលចម្លើយយឺត ➜ មិនបំពេញ view ឬ cache', async () => {
        if (caller === 'table') await configure('https://example.invalid/custom-api?barcode={barcode}');
        let resolve!: (response: Response) => void;
        const pending = new Promise<Response>((yes) => { resolve = yes; });
        const fetch = vi.fn(() => pending);
        vi.stubGlobal('fetch', fetch);
        const running = caller === 'lookup' ? attemptAutoLookup(CODE) : fetchCustomerDataTableRows(true);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: false, url: SHEET }));
        // No cache-reset helper: model the stored configuration changing in another tab.
        resolve(new Response(JSON.stringify({ success: true, phone: '012000111', cod: 9, rows: [{ barcode: CODE, phone: '012000111' }], scriptVersion: 9876 })));
        await running;
        expect(fields.modalPhoneInput.value).toBe('');
        expect(lookupFastCache.size).toBe(0);
        expect(lookupState.customerDataTableRows).toBeNull();
        expect(lookupState.sheetScriptVersionSeen).not.toBe(9876);
        if (caller === 'lookup') expect(viewState.lookupStatus.kind).not.toBe('lookup-status-loading');
        else expect(viewState.customerTableStatus).not.toBe('កំពុងទាញយកទិន្នន័យ...');
    });
}

it.each(['lookup', 'table'])('%s៖ ចម្លើយចាស់មិនអាចប្តូរស្ថានភាពថ្មីដែលសម្រេចរួច', async (caller) => {
    if (caller === 'table') await configure('https://example.invalid/custom-api?barcode={barcode}');
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((yes) => { resolve = yes; });
    const fetch = vi.fn().mockImplementationOnce(() => pending).mockImplementationOnce(async () => new Response(JSON.stringify({ success: true, phone: '012999888', rows: [] })));
    vi.stubGlobal('fetch', fetch);
    const old = caller === 'lookup' ? attemptAutoLookup(CODE) : fetchCustomerDataTableRows(true);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await configure(caller === 'lookup' ? ZTO : 'https://example.invalid/custom-api?barcode={barcode}');
    clearCustomerDataTableCache();
    await (caller === 'lookup' ? attemptAutoLookup(CODE) : fetchCustomerDataTableRows(true));
    expect(fetch).toHaveBeenCalledTimes(2);
    const status = caller === 'lookup' ? viewState.lookupStatus : viewState.customerTableStatus;
    resolve(new Response(JSON.stringify({ success: true, phone: '012000111', rows: [] })));
    await old;
    expect(caller === 'lookup' ? viewState.lookupStatus : viewState.customerTableStatus).toBe(status);
    if (caller === 'lookup') expect(fields.modalPhoneInput.value).toBe('012999888');
});

it('ZTO ID token កំពុងរង់ចាំ៖ session ប្តូរ ➜ មិនផ្ញើព័ត៌មានវគ្គចាស់', async () => {
    await configure(window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}');
    let resolve!: (value: { token: string }) => void;
    const token = new Promise<{ token: string }>((yes) => { resolve = yes; });
    const getToken = vi.fn(() => token);
    firebaseState.fb = { getIdTokenResult: getToken } as any;
    const fetch = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const running = attemptAutoLookup(CODE);
    await vi.waitFor(() => expect(getToken).toHaveBeenCalledOnce());
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'replacement-user' } } as any;
    resolve({ token: 'old-synthetic-token' });
    await running;
    expect(fetch).not.toHaveBeenCalled();
});

it('តារាងគ្មាន credential await៖ config ប្តូរមុនផ្ញើ ➜ បញ្ចប់ដោយគ្មាន TDZ ឬ promise ជាប់', async () => {
    await configure(SHEET);
    const original = appLocalStore.getItem.bind(appLocalStore);
    let reads = 0;
    const getItem = vi.spyOn(appLocalStore, 'getItem').mockImplementation((key) => {
        if (key === 'zoew_lookup_api_config' && ++reads === 4) appLocalStore.setItem(key, JSON.stringify({ enabled: false, url: SHEET }));
        return original(key);
    });
    const fetch = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    try {
        await expect(fetchCustomerDataTableRows(true)).resolves.toBeUndefined();
        expect(fetch).not.toHaveBeenCalled();
        expect(lookupState.customerDataTableFetchPromise).toBeNull();
    } finally { getItem.mockRestore(); }
});

it.each(['lookup', 'table'])('%s៖ legacy shop binding មិនត្រូវបោះបង់ការទាញលើកដំបូង', async (caller) => {
    if (caller === 'table') await configure('https://example.invalid/custom-api?barcode={barcode}');
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://synthetic.firebaseio.com' }));
    const fetch = vi.fn(async () => new Response(JSON.stringify({ success: true, rows: [] })));
    vi.stubGlobal('fetch', fetch);
    await (caller === 'lookup' ? attemptAutoLookup(CODE) : fetchCustomerDataTableRows(true));
    expect(fetch).toHaveBeenCalledTimes(1);
});

it.each(['lookup', 'table'])('%s៖ legacy binding storage បដិសេធ ➜ មិនរារាំង lookup', async (caller) => {
    if (caller === 'table') await configure('https://example.invalid/custom-api?barcode={barcode}');
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://synthetic.firebaseio.com' }));
    const original = appLocalStore.setItem.bind(appLocalStore);
    const setItem = vi.spyOn(appLocalStore, 'setItem').mockImplementation((key, value) => {
        if (key === 'zoew_lookup_api_config') throw new Error('QuotaExceededError');
        return original(key, value);
    });
    const fetch = vi.fn(async () => new Response(JSON.stringify({ success: true, rows: [] })));
    vi.stubGlobal('fetch', fetch);
    try {
        await (caller === 'lookup' ? attemptAutoLookup(CODE) : fetchCustomerDataTableRows(true));
        expect(fetch).toHaveBeenCalledTimes(1);
    } finally { setItem.mockRestore(); }
});

it('lookup ស្ទួនពេលរង់ចាំ៖ config ប្តូរ ➜ មិនទុក loading ជាប់', async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((yes) => { resolve = yes; });
    const fetch = vi.fn(() => pending);
    vi.stubGlobal('fetch', fetch);
    const running = attemptAutoLookup(CODE);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await attemptAutoLookup(CODE);
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: false, url: SHEET }));
    resolve(new Response('{}'));
    await running;
    expect(autoLookupInFlight.size).toBe(0);
    expect(viewState.lookupStatus.kind).not.toBe('lookup-status-loading');
});
