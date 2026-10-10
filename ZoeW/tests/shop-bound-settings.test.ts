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

import { firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { SHEET_IMPORT_STORE_KEY } from '../src/core/storage-keys';
import { getLookupApiConfig, saveLookupApiConfig } from '../src/features/lookup-config';
import { readSheetImportStoredConfig } from '../src/features/sheet-import';

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
