/**
 * ⛔ ប៊ូតុង «📥 បញ្ជី ZTO» (និងក្រុម ZTO ក្នុង ☰) គណនាពី API ZTO ដែលចងហាង (`shopOwnsSetting()`)។ ហាង Supabase ស្គាល់តែពេលគណនីមកដល់
 *    (`tenantScope()`) ➜ ពេលបើក App ការគណនាក្នុង boot (`startCoreServices()`) រត់មុន SDK និងគណនី ➜ «មិនមែនហាងនេះ» ➜ ប៊ូតុងលាក់ ហើយគ្មានអ្វី
 *    គណនាឡើងវិញ រហូតបើក ☰ (`openSideDrawer()`) ➜ ប៊ូតុងលេចភ្លាម (របាយការណ៍ម្ចាស់ក្រោយ merge PR309 · Firebase ស្គាល់ហាងពី `databaseURL` ជានិច្ច)។
 *    ច្បាប់ ៖ UI ដែលមកពីការកំណត់ចងហាងគណនាឡើងវិញគ្រប់ពេលហាងស្គាល់ ឬប្តូរ (`refreshShopBoundUi()`) ៖ ចូលប្រព័ន្ធ/ស្តារ (`proceedAfterLogin()`) ·
 *    គណនី Supabase មកដល់ ប្តូរ ឬបាត់ (`onTenantChanged` របស់ adapter ➜ env របស់ App) ⛔ មិនមែនតែពេលបើក ☰។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { ZTO_LISTSYNC_KEY } from '../src/core/storage-keys';
import { cancelActivationRetry, proceedAfterLogin } from '../src/features/license';
import { refreshZtoListSyncUi } from '../src/features/zto-list-sync';
import { refreshZtoAutoCloseUi } from '../src/features/zto-status';
import { loadSupabaseFb } from '../src/services/firebase-init';
import { SB_ACCOUNT_STORAGE_KEY, SB_AUTH_STORAGE_KEY } from '../src/services/supabase-transport';

const harness: { fetch: any; local: any } = { fetch: null, local: null };

vi.mock('../src/services/supabase-backend', async () => {
    const sdkMod: any = await vi.importActual('../src/services/supabase-sdk');
    const transportMod: any = await vi.importActual('../src/services/supabase-transport');
    return {
        createZoeSupabaseSdk: (env: any) => sdkMod.createSupabaseSdk(
            (cfg: any) => transportMod.createSupabaseTransport(cfg, { fetch: harness.fetch, localStorage: harness.local, sessionStorage: memStore(), fetchTimeoutMs: 2000 }),
            Object.assign({}, env, { docsCache: null })
        )
    };
});

const SB_URL = 'https://abcdefghijklmnopqrst.supabase.co';
const ZTO_URL = 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}';
const SHOP_A = 'https://shop-a-default-rtdb.firebaseio.com';
const SHOP_B = 'https://shop-b-default-rtdb.firebaseio.com';

function memStore() {
    const m = new Map<string, string>();
    return {
        getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
        setItem: (k: string, v: string) => { m.set(k, String(v)); },
        removeItem: (k: string) => { m.delete(k); },
        key: (i: number) => Array.from(m.keys())[i] ?? null,
        get length() { return m.size; }
    };
}

const nowSec = () => Math.floor(Date.now() / 1000);

function row(tenant: string) {
    return { tenant_id: tenant, tenant_name: 'ហាង', branch_code: 'B1', username: 'a', role: 'owner', status: 'active', expires_at: null };
}

function fakeNetwork(tenant: string) {
    const state = { accountCalls: 0, release: null as null | (() => void) };
    let gate = new Promise<void>((resolve) => { state.release = resolve; });
    const json = (body: any, status: number) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    const fetch = async (input: any) => {
        const u = String(input && input.url ? input.url : input);
        if (u.includes('/auth/v1/logout')) return new Response(null, { status: 204 });
        if (u.includes('/rest/v1/rpc/my_account')) {
            state.accountCalls++;
            await gate;
            return json([row(tenant)], 200);
        }
        return json({ code: 'PGRST202', message: 'not found' }, 404);
    };
    return { state, fetch, open: () => { gate = Promise.resolve(); if (state.release) state.release(); } };
}

function ztoSetting(shop: string) {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ shop, enabled: true, fastMode: true, url: ZTO_URL }));
    appLocalStore.setItem(ZTO_LISTSYNC_KEY, '1');
}

function bootRefresh() {
    refreshZtoAutoCloseUi();
    refreshZtoListSyncUi();
}

async function advance(ms: number) {
    for (let t = 0; t < ms; t += 250) await vi.advanceTimersByTimeAsync(250);
}

async function bootSupabase(cachedTenant: string, serverTenant: string) {
    const net = fakeNetwork(serverTenant);
    const local = memStore();
    local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify({ access_token: 'live.token.x', refresh_token: 'r', token_type: 'bearer', expires_in: 3600,
        expires_at: nowSec() + 3600, user: { id: 'u1', email: 'a@users.zoew.invalid', aud: 'authenticated' } }));
    if (cachedTenant) local.setItem(SB_ACCOUNT_STORAGE_KEY, JSON.stringify({ uid: 'u1', row: row(cachedTenant) }));
    harness.fetch = net.fetch;
    harness.local = local;
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: SB_URL, supabaseKey: 'sb_publishable_test' }));
    bootRefresh();
    const sdk: any = await loadSupabaseFb();
    const app = sdk.initializeApp({ supabaseUrl: SB_URL, supabaseKey: 'sb_publishable_test' });
    firebaseState.fb = sdk;
    firebaseState.auth = sdk.getAuth(app);
    return { sdk, app, net };
}

let apps: { sdk: any; app: any }[] = [];

beforeEach(() => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    appLocalStore.clear();
    firebaseState.fb = null as any;
    firebaseState.auth = null as any;
    firebaseState.db = null as any;
    viewState.ztoListSyncBtnVisible = false;
    viewState.ztoAutoCloseVisible = false;
    apps = [];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
    for (const a of apps) await a.sdk.deleteApp(a.app).catch(() => {});
    cancelActivationRetry();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (window as any).ZoeLicense;
    appLocalStore.clear();
    firebaseState.fb = null as any;
    firebaseState.auth = null as any;
    firebaseState.isDatabaseInitialized = false;
});

describe('Supabase ៖ adapter ពិត + env របស់ App (`loadSupabaseFb()`)', () => {
    it('⛔ បើក App ៖ session + គណនីក្នុង cache ➜ ប៊ូតុងបញ្ជី ZTO លេចពេលស្តាររួច ដោយមិនបើក ☰', async () => {
        vi.useFakeTimers();
        ztoSetting(SB_URL + '#tenant-a');
        const b = await bootSupabase('tenant-a', 'tenant-a');
        apps.push(b);
        expect(viewState.ztoListSyncBtnVisible, 'boot ៖ SDK/គណនីមិនទាន់មក ➜ ហាងមិនទាន់ស្គាល់ ➜ លាក់ (លក្ខខណ្ឌដើម)').toBe(false);
        await advance(2000);
        expect(b.sdk.tenantScope(firebaseState.auth)).toBe('tenant-a');
        expect(viewState.ztoListSyncBtnVisible, 'គណនីពី cache ➜ ហាងស្គាល់ ➜ ប៊ូតុងលេច').toBe(true);
        expect(viewState.ztoAutoCloseVisible, 'ក្រុម ZTO ក្នុង ☰ ក៏គណនាឡើងវិញ').toBe(true);
    });

    it('⛔ គណនីមកដល់យឺត (គ្មាន cache · `my_account()` ឆ្លើយក្រោយ) ➜ ប៊ូតុងលេចពេលគណនីមកដល់', async () => {
        vi.useFakeTimers();
        ztoSetting(SB_URL + '#tenant-a');
        const b = await bootSupabase('', 'tenant-a');
        apps.push(b);
        await advance(2000);
        expect(b.net.state.accountCalls, 'កំពុងសួរគណនី').toBeGreaterThan(0);
        expect(viewState.ztoListSyncBtnVisible, 'គណនីមិនទាន់ឆ្លើយ ➜ លាក់').toBe(false);
        b.net.open();
        await advance(2000);
        expect(b.sdk.tenantScope(firebaseState.auth)).toBe('tenant-a');
        expect(viewState.ztoListSyncBtnVisible, 'គណនីមកដល់ ➜ ប៊ូតុងលេច').toBe(true);
    });

    it('ទិសផ្ទុយ ៖ ចាកចេញ ➜ ហាងលែងស្គាល់ ➜ ប៊ូតុងលាក់វិញ', async () => {
        vi.useFakeTimers();
        ztoSetting(SB_URL + '#tenant-a');
        const b = await bootSupabase('tenant-a', 'tenant-a');
        apps.push(b);
        await advance(2000);
        expect(viewState.ztoListSyncBtnVisible).toBe(true);
        await b.sdk.signOut(firebaseState.auth);
        expect(b.sdk.tenantScope(firebaseState.auth)).toBe('');
        expect(viewState.ztoListSyncBtnVisible, 'គ្មានហាងបើក ➜ លាក់').toBe(false);
    });

    it('ទិសផ្ទុយ ៖ API ZTO ចងហាង A · គណនីហាង B ➜ ប៊ូតុងនៅលាក់', async () => {
        vi.useFakeTimers();
        ztoSetting(SB_URL + '#tenant-a');
        const b = await bootSupabase('tenant-b', 'tenant-b');
        apps.push(b);
        b.net.open();
        await advance(2000);
        expect(b.sdk.tenantScope(firebaseState.auth)).toBe('tenant-b');
        expect(viewState.ztoListSyncBtnVisible).toBe(false);
    });
});

describe('ចូលប្រព័ន្ធ / ស្តារ (`proceedAfterLogin()`)', () => {
    const user = { uid: 'u1' };

    it('⛔ Supabase ៖ boot មុនហាងស្គាល់ ➜ លាក់ · auth ឆ្លើយ (ហាងស្គាល់) ➜ ប៊ូតុងលេច', async () => {
        ztoSetting(SB_URL + '#tenant-a');
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: SB_URL, supabaseKey: 'sb_publishable_test' }));
        bootRefresh();
        expect(viewState.ztoListSyncBtnVisible, 'លក្ខខណ្ឌដើម').toBe(false);
        viewState.backendKind = 'supabase';
        firebaseState.fb = { tenantScope: (auth: any) => (auth && auth._account ? String(auth._account.tenant_id) : '') } as any;
        firebaseState.auth = { currentUser: user, _account: { tenant_id: 'tenant-a' } } as any;
        firebaseState.isDatabaseInitialized = true;
        firebaseState.authGeneration++;
        await proceedAfterLogin(user, firebaseState.authGeneration);
        expect(viewState.ztoListSyncBtnVisible).toBe(true);
    });

    it('⛔ Firebase Reconfig ហាង A ➜ ហាង B ៖ ប៊ូតុងរបស់ហាង A លាក់ពេលចូលហាង B (មិនរង់ចាំបើក ☰)', async () => {
        ztoSetting(SHOP_A);
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: SHOP_A, apiKey: 'k', projectId: 'a' }));
        bootRefresh();
        expect(viewState.ztoListSyncBtnVisible, 'Firebase ៖ ហាងស្គាល់តាំងពី boot ➜ លេច (ផ្លូវដែលធ្លាប់ត្រូវ)').toBe(true);
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: SHOP_B, apiKey: 'k', projectId: 'b' }));
        viewState.backendKind = 'firebase';
        (window as any).ZoeLicense = { getStatus: async () => ({ state: 'active' }) };
        firebaseState.fb = {} as any;
        firebaseState.auth = { currentUser: user } as any;
        firebaseState.isDatabaseInitialized = true;
        firebaseState.authGeneration++;
        await proceedAfterLogin(user, firebaseState.authGeneration);
        expect(viewState.ztoListSyncBtnVisible, 'ហាង B ៖ API ZTO របស់ហាង A មិនប្រើ').toBe(false);
    });
});
