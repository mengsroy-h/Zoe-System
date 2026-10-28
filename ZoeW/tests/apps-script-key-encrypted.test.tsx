/**
 * ⛔ X4 (ការសម្រេចម្ចាស់ A401 ៖ «អនុញ្ញាតកែ») ៖ key របស់ Google Apps Script (`&key=` ក្នុង URL Lookup) ស្ថិតក្នុង storage ជាអក្សរធម្មតា
 *    ខណៈ Header ត្រូវបានអ៊ិនគ្រីបក្រោម PIN ➜ អ្នកណាអាន localStorage បាន (devtools · ឧបករណ៍ខ្ចី) យក key អាន Sheet អតិថិជនទាំងមូលបាន។
 *    ច្បាប់ ៖ key រក្សាទុកអ៊ិនគ្រីបក្រោម PIN (`urlKeyEnc`) · URL ដែលរក្សាទុក ឬបង្ហាញក្នុងប្រអប់គ្មាន key · សំណើ (ស្កេន · តារាង · 🧪 សាកល្បង)
 *    ភ្ជាប់ key ពេលផ្ញើ (`lookupKeyedUrl()`) · PIN មិនទាន់ដោះ ➜ មិនផ្ញើ (សុំ PIN) · config ចាស់ដែលមាន key ធម្មតា ➜ ផ្លាស់ចូល `urlKeyEnc` ពេល PIN មាន។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fieldValue, refTo, setFieldChecked, setFieldValue } from '../src/app/refs';
import { scanState, securityState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { viewState } from '../src/core/view-state';
import { attemptAutoLookup, cancelPendingLookupUnlock } from '../src/features/auto-lookup';
import { clearCustomerDataTableCache, fetchCustomerDataTableRows } from '../src/features/customer-table';
import { migrateLookupSecretIfNeeded, openLookupApiConfigModal, saveLookupApiConfig, testLookupApiConfig } from '../src/features/lookup-config';
import { decryptLookupSecret, deriveLookupSecretKey, encryptLookupSecret } from '../src/services/crypto';
import { LookupApiConfigModal } from '../src/app/components/modals/LookupApiConfigModal';
import { byId, mount, step, unmount } from './native/react-harness';

const SCRIPT = 'https://script.google.com/macros/s/AKfyX/exec?code={barcode}';
const KEY = 'SHEET+KEY/9';
const KEYED = (url: string) => url + '&key=' + encodeURIComponent(KEY);
const stored = () => JSON.parse(appLocalStore.getItem('zoew_lookup_api_config') || 'null');
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const modalFields = ['modalPhoneInput', 'modalCodInput', 'modalDodInput'] as const;

async function storeSealed(extra: object = {}) {
    const urlKeyEnc = await encryptLookupSecret(KEY);
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, url: SCRIPT, urlKeyEnc, phoneField: 'phone', codField: 'cod', dodField: 'dod', ...extra }));
}
function stubFetch() {
    const fetch = vi.fn(async (url: string) => (String(url).indexOf('list=1') !== -1 ? json({ success: true, rows: [] }) : json({ success: true, phone: '012345678', cod: 1, dod: 0 })));
    vi.stubGlobal('fetch', fetch);
    return () => fetch.mock.calls.map((call) => String(call[0]));
}

beforeEach(async () => {
    appLocalStore.clear();
    clearCustomerDataTableCache();
    securityState.lookupSecretKey = await deriveLookupSecretKey('654321');
    vi.stubGlobal('alert', vi.fn());
    viewState.lookupStatus = null as any;
    for (const name of modalFields) refTo(name)(document.createElement('input'));
    mount(<LookupApiConfigModal />);
});

afterEach(() => {
    cancelPendingLookupUnlock();
    unmount();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearCustomerDataTableCache();
    for (const name of modalFields) refTo(name)(null);
    scanState.pendingBarcode = '';
    uiState.isModalOpen = false;
    securityState.lookupSecretKey = null;
    appLocalStore.clear();
});

describe('X4 ៖ key Apps Script អ៊ិនគ្រីបក្រោម PIN', () => {
    it('រក្សាទុក URL ដែលមាន key ➜ URL គ្មាន key · `urlKeyEnc` ស្រាយបាន key · storage គ្មាន key ធម្មតា · បើកប្រអប់វិញ URL គ្មាន key + កំណត់ចំណាំ', async () => {
        stubFetch();
        step(() => openLookupApiConfigModal());
        step(() => { setFieldChecked('lookupApiEnabledCheckbox', true); setFieldValue('lookupApiUrlInput', KEYED(SCRIPT)); });
        await saveLookupApiConfig();
        const cfg = stored();
        expect(cfg.url).toBe(SCRIPT);
        expect(appLocalStore.getItem('zoew_lookup_api_config')).not.toMatch(/SHEET|KEY%2F9/);
        expect(await decryptLookupSecret(cfg.urlKeyEnc)).toBe(KEY);
        step(() => openLookupApiConfigModal());
        expect(fieldValue('lookupApiUrlInput')).toBe(SCRIPT);
        expect(byId('lookupApiUrlKeyNote').textContent).toContain('អ៊ិនគ្រីប');
    });

    it('រក្សាទុកម្តងទៀតដោយ URL គ្មាន key ➜ key ចាស់នៅ · ប្តូរទៅ API មិនមែន Apps Script ➜ key ចេញ', async () => {
        stubFetch();
        await storeSealed();
        step(() => openLookupApiConfigModal());
        step(() => setFieldValue('lookupApiUrlInput', SCRIPT));
        await saveLookupApiConfig();
        expect(await decryptLookupSecret(stored().urlKeyEnc)).toBe(KEY);
        step(() => setFieldValue('lookupApiUrlInput', 'https://api.example.com/lookup?code={barcode}'));
        await saveLookupApiConfig();
        expect(stored().urlKeyEnc).toBeUndefined();
        step(() => openLookupApiConfigModal());
        expect(document.getElementById('lookupApiUrlKeyNote')).toBe(null);
    });

    it('ស្កេន ➜ សំណើភ្ជាប់ key ដែលស្រាយ · តារាងអតិថិជន ➜ សំណើ list ភ្ជាប់ key', async () => {
        const urls = stubFetch();
        await storeSealed();
        scanState.pendingBarcode = 'B1';
        uiState.isModalOpen = true;
        await attemptAutoLookup('B1');
        expect(urls()).toContain(KEYED('https://script.google.com/macros/s/AKfyX/exec?code=B1'));
        await fetchCustomerDataTableRows(true);
        expect(urls()).toContain(KEYED('https://script.google.com/macros/s/AKfyX/exec?list=1'));
        expect(urls().filter((url) => url.indexOf('script.google.com') !== -1 && url.indexOf('key=') === -1)).toEqual([]);
    });

    it('⛔ PIN មិនទាន់ដោះ ➜ ស្កេនសុំ PIN គ្មានសំណើ · តារាងមិនទាញ', async () => {
        const urls = stubFetch();
        await storeSealed();
        securityState.lookupSecretKey = null;
        scanState.pendingBarcode = 'B2';
        uiState.isModalOpen = true;
        void attemptAutoLookup('B2');
        await vi.waitFor(() => expect(String(viewState.lookupStatus && viewState.lookupStatus.text)).toContain('🔒'));
        await fetchCustomerDataTableRows(true);
        expect(viewState.customerTableStatus).toContain('🔒');
        expect(urls()).toEqual([]);
    });

    it('🧪 សាកល្បង URL គ្មាន key ➜ ប្រើ key ដែលរក្សាទុក', async () => {
        const urls = stubFetch();
        await storeSealed();
        vi.stubGlobal('prompt', vi.fn(() => 'B3'));
        step(() => openLookupApiConfigModal());
        await testLookupApiConfig();
        expect(urls()).toContain(KEYED('https://script.google.com/macros/s/AKfyX/exec?code=B3'));
    });

    it('config ចាស់មាន key ធម្មតាក្នុង URL ➜ ផ្លាស់ចូល `urlKeyEnc` ពេល PIN មាន · គ្មាន PIN ➜ មិនប៉ះ', async () => {
        const plain = JSON.stringify({ enabled: true, url: KEYED(SCRIPT), phoneField: 'phone', codField: 'cod', dodField: 'dod' });
        appLocalStore.setItem('zoew_lookup_api_config', plain);
        securityState.lookupSecretKey = null;
        expect(await migrateLookupSecretIfNeeded()).toBe(false);
        expect(appLocalStore.getItem('zoew_lookup_api_config')).toBe(plain);
        securityState.lookupSecretKey = await deriveLookupSecretKey('654321');
        expect(await migrateLookupSecretIfNeeded()).toBe(true);
        const cfg = stored();
        expect(cfg.url).toBe(SCRIPT);
        expect(appLocalStore.getItem('zoew_lookup_api_config')).not.toMatch(/SHEET|KEY%2F9/);
        expect(await decryptLookupSecret(cfg.urlKeyEnc)).toBe(KEY);
    });
});
