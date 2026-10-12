/**
 * ⛔ ការកំណត់ដែលជារបស់ហាង (សំណើម្ចាស់គម្រោង ៖ «ធ្វើទាំង ៣ ចំណុចហ្នឹងទៅ» ➜ ចងទៅហាង) ៖ API ស្វែងរកអតិថិជន / តារាងអតិថិជន (`zoew_lookup_api_config`)
 *    និងការតភ្ជាប់ Excel ➜ Sheet (`zoew_sheet_import_config`) រក្សាទុកក្នុងឧបករណ៍ ➜ ឧបករណ៍មួយដែលចូលហាងច្រើន (Supabase ៖ គណនីហាងផ្សេងក្នុង
 *    Project ដដែល · Firebase ៖ Reconfig ទៅ Project ផ្សេង) ធ្លាប់ប្រើ Lookup · តារាងអតិថិជន · Sheet របស់ហាងមុន។ ឥឡូវការកំណត់កត់ហាងដែលវាជារបស់
 *    (`shop` = `shopScope()`) ➜ ហាងផ្សេង (ឬហាងមិនទាន់ស្គាល់) ➜ មិនប្រើ · ការកំណត់ចាស់គ្មាន `shop` ➜ ចងទៅហាងដែលអានវាដំបូង។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fields = vi.hoisted(() => ({ values: {} as Record<string, string>, checks: {} as Record<string, boolean> }));
vi.mock('../src/app/refs', async (importOriginal) => {
    const real: any = await importOriginal();
    return Object.assign({}, real, {
        fieldValue: (name: string) => fields.values[name] || '',
        setFieldValue: (name: string, value: string) => { fields.values[name] = value; },
        fieldChecked: (name: string) => !!fields.checks[name],
        setFieldChecked: (name: string, value: boolean) => { fields.checks[name] = value; }
    });
});

import { firebaseState, securityState, sheetImportState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { shopScope } from '../src/core/shop-scope';
import { SHEET_IMPORT_STORE_KEY } from '../src/core/storage-keys';
import * as lookupCrypto from '../src/services/crypto';
import { getLookupApiConfig, migrateLookupSecretIfNeeded, saveLookupApiConfig, testLookupApiConfig } from '../src/features/lookup-config';
import * as customerTable from '../src/features/customer-table';
import { viewState } from '../src/core/view-state';
import * as network from '../src/services/network';
import { deriveSheetImportKey, readSheetImportStoredConfig, saveSheetImportConfig, refreshSheetImportStatus, runSheetImportClear } from '../src/features/sheet-import';

const SB_URL = 'https://abcd.supabase.co';
const FB_A = 'https://shop-a.firebaseio.com';
const FB_B = 'https://shop-b.firebaseio.com';
const LOOKUP = { enabled: true, url: 'https://script.google.com/macros/s/AKfy-a/exec?code={barcode}&key=shop-a-secret', phoneField: 'phone', codField: 'cod', dodField: 'dod' };
const SHEET = { v: 1, u: 'enc-url-shop-a', p: 'enc-pass-shop-a' };

function useSupabaseTenant(tenant: string) {
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: SB_URL, supabaseKey: 'sb_publishable_x' }));
    firebaseState.fb = { tenantScope: (auth: any) => (auth && auth._account && auth._account.tenant_id ? String(auth._account.tenant_id) : '') } as any;
    firebaseState.auth = (tenant ? { currentUser: { uid: 'u-' + tenant }, _account: { tenant_id: tenant } } : { currentUser: null, _account: null }) as any;
}
function useFirebase(url: string) {
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: url, apiKey: 'k', projectId: 'p' }));
    firebaseState.fb = {} as any;
    firebaseState.auth = { currentUser: { uid: 'u1' } } as any;
}
function stored(key: string) {
    return JSON.parse(appLocalStore.getItem(key) || 'null');
}

beforeEach(() => {
    appLocalStore.clear();
    fields.values = {};
    fields.checks = {};
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    vi.stubGlobal('alert', () => undefined);
});

afterEach(() => {
    vi.unstubAllGlobals();
    firebaseState.auth = null as any;
    firebaseState.fb = null as any;
});

describe('API ស្វែងរកអតិថិជន / តារាងអតិថិជន ៖ ជារបស់ហាង', () => {
    it('⛔ Supabase ៖ ហាង A កំណត់ ➜ ហាង B (Project ដដែល) មិនប្រើ · ត្រឡប់ទៅ A ➜ ប្រើបានវិញ', () => {
        useSupabaseTenant('tenant-a');
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(LOOKUP));
        expect(getLookupApiConfig()).toMatchObject({ url: LOOKUP.url });
        useSupabaseTenant('tenant-b');
        expect(getLookupApiConfig()).toBeNull();
        useSupabaseTenant('tenant-a');
        expect(getLookupApiConfig()).toMatchObject({ url: LOOKUP.url });
    });

    it('⛔ Supabase ៖ ចាកចេញ (មិនទាន់ស្គាល់ហាង) ➜ ការកំណត់ដែលចងរួចមិនប្រើ', () => {
        useSupabaseTenant('tenant-a');
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(LOOKUP));
        expect(getLookupApiConfig()).not.toBeNull();
        useSupabaseTenant('');
        expect(getLookupApiConfig()).toBeNull();
    });

    it('⛔ Firebase ៖ Reconfig ទៅ Project ហាងផ្សេង ➜ មិនប្រើការកំណត់ហាងមុន', () => {
        useFirebase(FB_A);
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(LOOKUP));
        expect(getLookupApiConfig()).not.toBeNull();
        useFirebase(FB_B);
        expect(getLookupApiConfig()).toBeNull();
    });

    it('⛔ រក្សាទុកពីប្រអប់ ➜ កត់ហាង ➜ ហាងផ្សេងមិនប្រើ', async () => {
        useSupabaseTenant('tenant-b');
        fields.values.lookupApiUrlInput = 'https://script.google.com/macros/s/AKfy-b/exec?code={barcode}';
        fields.checks.lookupApiEnabledCheckbox = true;
        await saveLookupApiConfig();
        expect(stored('zoew_lookup_api_config')).toMatchObject({ url: fields.values.lookupApiUrlInput });
        expect(getLookupApiConfig()).not.toBeNull();
        useSupabaseTenant('tenant-a');
        expect(getLookupApiConfig()).toBeNull();
    });

    it('ទិសផ្ទុយ ៖ ហាងដដែល · URL មាន `/` ចុង ➜ នៅប្រើបាន · ការកំណត់ចាស់ (គ្មានហាង) នៅប្រើបានពេលមិនទាន់ស្គាល់ហាង', () => {
        useFirebase(FB_A);
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(LOOKUP));
        expect(getLookupApiConfig()).not.toBeNull();
        useFirebase(FB_A + '/');
        expect(getLookupApiConfig()).not.toBeNull();
        appLocalStore.clear();
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(LOOKUP));
        useSupabaseTenant('');
        expect(getLookupApiConfig()).toMatchObject({ url: LOOKUP.url });
    });
});

describe('ការតភ្ជាប់ Excel ➜ Sheet ៖ ជារបស់ហាង', () => {
    it('⛔ ហាង A ➜ ហាង B មិនទទួលការតភ្ជាប់ Sheet របស់ A (ការនាំចូលមិនសរសេរចូល Sheet ហាងផ្សេង)', () => {
        useSupabaseTenant('tenant-a');
        appLocalStore.setItem(SHEET_IMPORT_STORE_KEY, JSON.stringify(SHEET));
        expect(readSheetImportStoredConfig()).toMatchObject({ u: SHEET.u });
        useSupabaseTenant('tenant-b');
        expect(readSheetImportStoredConfig()).toBeNull();
        useSupabaseTenant('tenant-a');
        expect(readSheetImportStoredConfig()).toMatchObject({ u: SHEET.u });
    });
});


describe('Deep audit ៖ លទ្ធផល encrypt ចាស់មិនឆ្លងហាង', () => {
    afterEach(() => { vi.restoreAllMocks(); securityState.lookupSecretKey = null; });

    it('migration សោហាង A ពន្យារ ➜ ហាង B កំណត់ថ្មី ➜ A មិនជាន់ B', async () => {
        useSupabaseTenant('tenant-a');
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...LOOKUP, headerValue: 'old-a' }));
        securityState.lookupSecretKey = {} as CryptoKey;
        let finish!: (value: any) => void;
        vi.spyOn(lookupCrypto, 'encryptLookupSecret').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
        const task = migrateLookupSecretIfNeeded();
        useSupabaseTenant('tenant-b');
        const next = { ...LOOKUP, url: 'https://b.example/?code={barcode}', shop: SB_URL + '#tenant-b' };
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(next));
        finish({ iv: 'a', ct: 'a' });
        expect(await task).toBe(false);
        expect(stored('zoew_lookup_api_config')).toEqual(next);
    });

    it('Save ចាប់ផ្តើមហាង A ➜ ប្តូរហាងក្នុង encrypt ➜ មិនរក្សាទុកក្នុង B', async () => {
        useSupabaseTenant('tenant-a');
        fields.values.lookupApiUrlInput = 'https://a.example/?code={barcode}';
        fields.values.lookupApiHeaderValueInput = 'a-secret';
        securityState.lookupSecretKey = {} as CryptoKey;
        let finish!: (value: any) => void;
        vi.spyOn(lookupCrypto, 'encryptLookupSecret').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
        const task = saveLookupApiConfig();
        useSupabaseTenant('tenant-b');
        finish({ iv: 'a', ct: 'a' });
        await task;
        expect(stored('zoew_lookup_api_config')).toBeNull();
    });

    it('Save ចាស់មកក្រោយ Save ថ្មីក្នុងហាងដដែល ➜ ថ្មីឈ្នះ', async () => {
        useFirebase(FB_A);
        securityState.lookupSecretKey = {} as CryptoKey;
        const pending: ((value: any) => void)[] = [];
        vi.spyOn(lookupCrypto, 'encryptLookupSecret').mockImplementation(() => new Promise((resolve) => { pending.push(resolve); }));
        fields.values.lookupApiUrlInput = 'https://old.example/?code={barcode}';
        fields.values.lookupApiHeaderValueInput = 'old-secret';
        const old = saveLookupApiConfig();
        fields.values.lookupApiUrlInput = 'https://new.example/?code={barcode}';
        fields.values.lookupApiHeaderValueInput = 'new-secret';
        const latest = saveLookupApiConfig();
        pending[1]({ iv: 'new', ct: 'new' });
        await latest;
        pending[0]({ iv: 'old', ct: 'old' });
        await old;
        expect(stored('zoew_lookup_api_config')).toMatchObject({ url: 'https://new.example/?code={barcode}', headerValueEnc: { iv: 'new', ct: 'new' } });
    });
});


describe('Deep audit ៖ សំណើចាស់ក្រោយប្តូរហាង', () => {
    afterEach(() => { vi.restoreAllMocks(); securityState.lookupSecretKey = null; sheetImportState.sheetImportKey = null; sheetImportState.sheetImportBusy = false; });

    it('Test API ហាង A កំពុង decrypt ➜ ប្តូរទៅ B ➜ មិនផ្ញើ Header A ជាមួយគណនី B', async () => {
        useSupabaseTenant('tenant-a');
        fields.values.lookupApiUrlInput = 'https://a.example/?code={barcode}';
        fields.values.lookupApiHeaderNameInput = 'X-Shop-Key';
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...LOOKUP, headerValueEnc: { iv: 'a', ct: 'a' } }));
        let finish!: (value: string) => void;
        vi.spyOn(lookupCrypto, 'decryptLookupSecret').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
        vi.stubGlobal('prompt', () => '123456');
        const task = testLookupApiConfig();
        useSupabaseTenant('tenant-b');
        finish('a-secret');
        await task;
        expect(fetch).not.toHaveBeenCalled();
    });

    it('រក្សាទុក Sheet ហាង A កំពុងសាក API ➜ ប្តូរទៅ B ➜ មិនចង A ទៅ B', async () => {
        useFirebase(FB_A);
        fields.values.siApiUrlInput = 'https://script.google.com/macros/s/A/exec';
        fields.values.siApiPasswordInput = 'a-password';
        sheetImportState.sheetImportKey = await deriveSheetImportKey('123456');
        let finish!: (value: any) => void;
        vi.spyOn(network, 'fetchWithTimeout').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
        const task = saveSheetImportConfig();
        useFirebase(FB_B);
        finish({ res: { ok: true }, body: JSON.stringify({ ok: true, data: { spreadsheetName: 'A', sheetName: 'A', rowCount: 0 } }) });
        await task;
        expect(stored(SHEET_IMPORT_STORE_KEY)).toBeNull();
    });
});


describe('Deep audit ៖ ទិសផ្ទុយនៃ migration សោ', () => {
    afterEach(() => { vi.restoreAllMocks(); securityState.lookupSecretKey = null; });
    it('ហាង/សម័យដដែល ➜ migrate secret ចាស់បាន និងរក្សា shop', async () => {
        useFirebase(FB_A);
        securityState.lookupSecretKey = {} as CryptoKey;
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...LOOKUP, headerValue: 'a-secret' }));
        vi.spyOn(lookupCrypto, 'encryptLookupSecret').mockResolvedValue({ iv: [1], data: [2] });
        expect(await migrateLookupSecretIfNeeded()).toBe(true);
        expect(stored('zoew_lookup_api_config')).toMatchObject({ shop: FB_A, headerValueEnc: { iv: [1], data: [2] } });
        expect(stored('zoew_lookup_api_config')).not.toHaveProperty('headerValue');
    });
    it('Storage បោះ SecurityError ➜ migration false មិន reject', async () => {
        const read = vi.spyOn(Object.getPrototypeOf(appLocalStore), 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
        try { await expect(migrateLookupSecretIfNeeded()).resolves.toBe(false); }
        finally { read.mockRestore(); }
    });
});


describe('Deep audit ៖ លទ្ធផល Sheet មិនប៉ះ cache/UI ហាងថ្មី', () => {
    afterEach(() => { vi.restoreAllMocks(); sheetImportState.sheetImportBusy = false; });
    it('Clear ហាង A ត្រឡប់ក្រោយប្តូរទៅ B ➜ មិនសម្អាត cache B', async () => {
        useFirebase(FB_A);
        sheetImportState.sheetImportUrl = 'https://script.google.com/macros/s/A/exec';
        sheetImportState.sheetImportPassword = 'a';
        vi.stubGlobal('confirm', () => true);
        const cleared = vi.spyOn(customerTable, 'clearCustomerDataTableCache').mockImplementation(() => {});
        let finish!: (value: any) => void;
        vi.spyOn(network, 'fetchWithTimeout').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
        const task = runSheetImportClear();
        expect(shopScope()).toBe(FB_A);
        useFirebase(FB_B);
        expect(shopScope()).toBe(FB_B);
        finish({ res: { ok: true }, body: JSON.stringify({ ok: true, data: { removed: 5, sheetName: 'A', rowsAfter: 0 } }) });
        await task;
        expect(cleared).not.toHaveBeenCalled();
    });
    it('Status ហាង A យឺត ➜ ហាង B បង្ហាញគោលដៅថ្មី ➜ A មិនជាន់ footer', async () => {
        useFirebase(FB_A);
        sheetImportState.sheetImportUrl = 'https://script.google.com/macros/s/A/exec';
        let finish!: (value: any) => void;
        vi.spyOn(network, 'fetchWithTimeout').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
        const task = refreshSheetImportStatus();
        expect(shopScope()).toBe(FB_A);
        useFirebase(FB_B);
        expect(shopScope()).toBe(FB_B);
        viewState.siStatusFoot = 'ហាង B';
        finish({ res: { ok: true }, body: JSON.stringify({ ok: true, data: { spreadsheetName: 'A', sheetName: 'A', rowCount: 5 } }) });
        await task;
        expect(viewState.siStatusFoot).toBe('ហាង B');
    });
});
