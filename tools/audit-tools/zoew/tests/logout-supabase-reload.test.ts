import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const Buffer = createRequire(import.meta.url)('node:buffer').Buffer;
vi.mock('../../../../ZoeW/src/features/license', async original => ({ ...await original<any>(), proceedAfterLogin: vi.fn(async () => false) }));
const URL = 'https://logout-reload-synthetic.supabase.co';
const uid = 'synthetic-supabase-user';
const row = { tenant_id: 'synthetic-tenant', tenant_name: 'ហាងសាក', branch_code: '000001', username: 'synthetic', role: 'owner', status: 'active', expires_at: null };
let cleanup: (() => Promise<void>) | null = null;
const turn = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
afterEach(async () => { if (cleanup) await cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('Supabase SDK ពិត៖ storage removal បរាជ័យ និង logout 503 មិនបើក App ឡើងវិញដោយ SDK session ចាស់', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const data = new Map<string, string>();
    let refuseRemoval = false;
    const persisted = { get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null,
        getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); },
        removeItem: (key: string) => { if (refuseRemoval) throw new Error('synthetic storage removal rejected'); data.delete(key); } };
    const seconds = Math.floor(Date.now() / 1000);
    const token = Buffer.from('{"alg":"none"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: uid, role: 'authenticated',
        auth_time: seconds, session_id: '00000000-0000-4000-8000-000000000001', iat: seconds, exp: seconds + 3600 })).toString('base64url') + '.synthetic';
    persisted.setItem('zoew-sb-auth', JSON.stringify({ access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600,
        expires_at: seconds + 3600, user: { id: uid, email: 'synthetic@example.invalid', aud: 'authenticated' } }));
    persisted.setItem('zoew-sb-account', JSON.stringify({ uid, row }));
    const fetch = async (input: any) => {
        const url = String(input?.url || input);
        if (url.includes('/auth/v1/logout')) return new Response('{"message":"synthetic outage"}', { status: 503 });
        if (url.includes('/rest/v1/rpc/my_account')) return new Response(JSON.stringify([row]), { status: 200, headers: { 'content-type': 'application/json' } });
        throw new Error('Unexpected synthetic Supabase endpoint');
    };
    const boot = async () => {
        const { createSupabaseSdk } = await import('../../../../ZoeW/src/services/supabase-sdk');
        const { createSupabaseTransport } = await import('../../../../ZoeW/src/services/supabase-transport');
        const sdk = createSupabaseSdk(config => createSupabaseTransport(config, { fetch, localStorage: persisted, sessionStorage: persisted }), {
            onListenerError: () => {}, onAccountBlocked: () => {}, onSessionEnded: () => {}, onTxOutcomeUnknown: () => {}, docsCache: null
        });
        const app = sdk.initializeApp({ supabaseUrl: URL, supabaseKey: 'sb_publishable_synthetic' });
        const auth = sdk.getAuth(app);
        await vi.waitFor(() => expect(auth.currentUser?.uid).toBe(uid));
        return { sdk, app, auth };
    };
    const first = await boot();
    const { firebaseState } = await import('../../../../ZoeW/src/core/state');
    Object.assign(firebaseState, { auth: first.auth, fb: first.sdk, db: {}, firebaseConfig: { supabaseUrl: URL, supabaseKey: 'sb_publishable_synthetic' },
        authLoginOperation: null, sessionExpiryCheck: 'live', isInitializingFirebase: false });
    const { logoutApp } = await import('../../../../ZoeW/src/features/auth');
    refuseRemoval = true;
    await logoutApp();
    expect(firebaseState.sessionExpiryCheck).toBe('signed-out');
    expect(persisted.getItem('zoew-sb-auth')).not.toBeNull();
    await first.sdk.deleteApp(first.app);
    refuseRemoval = false;
    vi.resetModules();
    const second = await boot(); cleanup = () => second.sdk.deleteApp(second.app);
    const state = (await import('../../../../ZoeW/src/core/state')).firebaseState;
    Object.assign(state, { auth: second.auth, fb: second.sdk, db: {}, firebaseConfig: { supabaseUrl: URL, supabaseKey: 'sb_publishable_synthetic' },
        isInitializingFirebase: false, isDatabaseConnected: true, isDatabaseInitialized: true, dbListenersFailed: false });
    const { acceptServerClockOffset } = await import('../../../../ZoeW/src/core/clock');
    expect(acceptServerClockOffset(0, Object.freeze({ source: 'nonce', generation: 1, monotonicMs: performance.now(), wallMs: Date.now(),
        epochMs: Date.now(), uncertaintyMs: 0 }), true)).toBe(true);
    const { setupAuthListener } = await import('../../../../ZoeW/src/features/auth');
    setupAuthListener(); await turn();
    const { connectionFlowSnapshot } = await import('../../../../ZoeW/src/services/connection-flow');
    const { proceedAfterLogin } = await import('../../../../ZoeW/src/features/license');
    expect(state.sessionExpiryCheck).toBe('signed-out');
    expect(connectionFlowSnapshot().canWrite).toBe(false);
    expect(proceedAfterLogin).not.toHaveBeenCalled();
    state.authUnsubscribe?.();
});
