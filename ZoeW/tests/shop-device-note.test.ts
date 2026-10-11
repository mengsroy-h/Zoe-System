/**
 * ⛔ ហាង Supabase គ្មាន Activation Key ➜ គ្មានកៅអី License ដែលកត់ model · serial ឧបករណ៍ ➜ អ្នកលក់មិនដឹងថាហាងប្រើទូរស័ព្ទណាខ្លះ
 *    (សំណើម្ចាស់គម្រោង ៖ «ចង់អោយ Supabase រក្សា model និង serial id ដូច activate key ដែល»)។
 *    ច្បាប់ ៖ គណនីស្គាល់ហាង (`onTenantChanged` ➜ `noteShopDevice()`) ➜ RPC `note_my_device` (serial · model · ប្រព័ន្ធ ពី `loadDeviceInfo()`)
 *    ម្តងក្នុងមួយទំព័រ/គណនី/ព័ត៌មាន · ធ្លាក់ ➜ សាកម្តងទៀតក្រោយ `SHOP_DEVICE_RETRY_MS` (វដ្ត ៦០ វិ.) · ហាងនិងគណនីមកពី server (`auth.uid()`) ·
 *    ហាង Firebase ➜ គ្មានការហៅ (កៅអី License កត់រួច)។ ⛔ ការបង្ហាញតែប៉ុណ្ណោះ — មិនសម្រេចសិទ្ធិចូល។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { SHOP_DEVICE_RETRY_MS, noteShopDevice } from '../src/features/shop-device';
import { appSerialOf, loadDeviceInfo } from '../src/features/device-info';
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
const DEVICE_ID = 'zoe-device-0000-test';
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

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
    const state = { notes: [] as any[], fail: false, auth: [] as string[] };
    const json = (body: any, status: number) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    const fetch = async (input: any, init: any) => {
        const u = String(input && input.url ? input.url : input);
        if (u.includes('/auth/v1/logout')) return new Response(null, { status: 204 });
        if (u.includes('/rest/v1/rpc/my_account')) return json([row(tenant)], 200);
        if (u.includes('/rest/v1/rpc/note_my_device')) {
            state.auth.push(String(((init && init.headers) || {}).Authorization || ''));
            if (state.fail) return json({ code: 'XX000', message: 'boom' }, 500);
            state.notes.push(JSON.parse(String(init && init.body)));
            return json(true, 200);
        }
        return json({ code: 'PGRST202', message: 'not found' }, 404);
    };
    return { state, fetch };
}

async function advance(ms: number) {
    for (let t = 0; t < ms; t += 250) await vi.advanceTimersByTimeAsync(250);
}

let apps: { sdk: any; app: any }[] = [];

async function bootShop(tenant: string, uid = 'u1') {
    const net = fakeNetwork(tenant);
    const local = memStore();
    local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify({ access_token: 'live.token.' + uid, refresh_token: 'r', token_type: 'bearer', expires_in: 3600,
        expires_at: nowSec() + 3600, user: { id: uid, email: 'a@users.zoew.invalid', aud: 'authenticated' } }));
    local.setItem(SB_ACCOUNT_STORAGE_KEY, JSON.stringify({ uid, row: row(tenant) }));
    harness.fetch = net.fetch;
    harness.local = local;
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: SB_URL, supabaseKey: 'sb_publishable_test' }));
    const sdk: any = await loadSupabaseFb();
    const app = sdk.initializeApp({ supabaseUrl: SB_URL, supabaseKey: 'sb_publishable_test' });
    firebaseState.fb = sdk;
    firebaseState.auth = sdk.getAuth(app);
    apps.push({ sdk, app });
    return { sdk, app, net };
}

beforeEach(() => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    Object.defineProperty(window.navigator, 'userAgent', { value: UA, configurable: true });
    (window as any).ZoeLicense = { getDeviceId: () => DEVICE_ID, setDeviceMeta: () => null };
    appLocalStore.clear();
    firebaseState.fb = null as any;
    firebaseState.auth = null as any;
    apps = [];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
    for (const a of apps) await a.sdk.deleteApp(a.app).catch(() => {});
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (window as any).ZoeLicense;
    appLocalStore.clear();
    firebaseState.fb = null as any;
    firebaseState.auth = null as any;
});

describe('Supabase ៖ កត់ឧបករណ៍តាមហាង (`note_my_device`)', () => {
    it('⛔ បើក App ៖ គណនីស្គាល់ហាង ➜ ផ្ញើ serial · model · ប្រព័ន្ធ ម្តង (token គណនីនោះ) · ការហៅម្តងទៀតមិនផ្ញើស្ទួន', async () => {
        vi.useFakeTimers();
        const b = await bootShop('tenant-a');
        await advance(3000);
        const serial = await appSerialOf(DEVICE_ID);
        const info = await loadDeviceInfo();
        expect(serial).toMatch(/^[0-9a-f]{16}$/);
        expect(b.net.state.notes, 'ផ្ញើម្តងដោយ onTenantChanged').toEqual([{ p_serial: serial, p_model: info.model, p_platform: info.platform }]);
        expect(info.platform).toBe('Android 14');
        expect(b.net.state.auth[0]).toBe('Bearer live.token.u1');
        expect(await noteShopDevice()).toBe(true);
        expect(await noteShopDevice()).toBe(true);
        expect(b.net.state.notes.length, 'វដ្ត ៦០ វិ. មិនផ្ញើស្ទួន').toBe(1);
    });

    it('⛔ ធ្លាក់ (server 500) ➜ មិនសាករាល់វដ្ត · សាកម្តងទៀតក្រោយ SHOP_DEVICE_RETRY_MS ➜ ជោគជ័យ', async () => {
        vi.useFakeTimers();
        const b = await bootShop('tenant-b', 'u2');
        b.net.state.fail = true;
        await advance(3000);
        const tries = b.net.state.auth.length;
        expect(tries, 'សាកម្តង').toBeGreaterThanOrEqual(1);
        expect(await noteShopDevice()).toBe(false);
        expect(b.net.state.auth.length, 'ក្នុងគម្លាត ➜ មិនហៅ').toBe(tries);
        b.net.state.fail = false;
        await advance(SHOP_DEVICE_RETRY_MS + 1000);
        expect(await noteShopDevice()).toBe(true);
        expect(b.net.state.notes.length).toBe(1);
    });

    it('គណនីហាងផ្សេង (គណនីថ្មី) ➜ ផ្ញើម្តងទៀតសម្រាប់ហាងនោះ', async () => {
        vi.useFakeTimers();
        const first = await bootShop('tenant-c', 'u3');
        await advance(3000);
        expect(first.net.state.notes.length).toBe(1);
        const second = await bootShop('tenant-d', 'u4');
        await advance(3000);
        expect(second.net.state.notes.length, 'ហាង D ទទួលឧបករណ៍ដដែល').toBe(1);
        expect(second.net.state.auth[0]).toBe('Bearer live.token.u4');
    });

    it('ទិសផ្ទុយ ៖ ហាង Firebase · ហាងមិនទាន់ស្គាល់ · គ្មាន serial ➜ មិនហៅ', async () => {
        const calls: any[] = [];
        firebaseState.fb = { tenantScope: () => '', noteDevice: async (...a: any[]) => { calls.push(a); return true; } } as any;
        firebaseState.auth = { currentUser: { uid: 'u9' } } as any;
        expect(await noteShopDevice(), 'SDK Firebase (គ្មាន __supabase)').toBe(false);
        firebaseState.fb = { __supabase: true, tenantScope: () => '', noteDevice: async (...a: any[]) => { calls.push(a); return true; } } as any;
        expect(await noteShopDevice(), 'ហាងមិនទាន់ស្គាល់').toBe(false);
        expect(calls).toEqual([]);
    });
});
