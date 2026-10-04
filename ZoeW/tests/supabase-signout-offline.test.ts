/**
 * ⛔ ចាកចេញលើហាង Supabase ពេល Server មិនឆ្លើយ ៖ supabase-js `signOut()` អាន session ជាមុន ➜ token ផុត ➜ refresh បរាជ័យបណ្តោះអាសន្ន ➜ ត្រឡប់
 *    error **មុនលុប session** ➜ មុនកែ ៖ ប៊ូតុងចាកចេញជាប់រហូតការសាក refresh អស់ · session នៅក្នុង storage ➜ អ្នកបើក App បន្ទាប់ (ទូរស័ព្ទរួម) ចូលជា
 *    គណនីមុន · token នៅមាន ➜ ការលុបចោលនៅ Server បរាជ័យ ➜ error ➜ សារ «មិនអាចបញ្ជាក់ថាបានចាកចេញពី Firebase»។ ឥឡូវ ៖ ការចាកចេញក្នុងឧបករណ៍មិនពឹង
 *    បណ្តាញ (ដូច Firebase) ៖ ការលុបចោលនៅ Server ជា best-effort ក្រោមពិដាន `SB_SIGN_OUT_CEILING_MS` ➜ លុប `zoew-sb-auth*` + គណនីក្នុង storage ដោយខ្លួនឯង។
 *    ទិសផ្ទុយ ៖ បណ្តាញល្អ ➜ Server លុបចោល session ដដែល (token ថ្មីក្រោយ refresh) · refresh ដែលកំពុងរត់មកដល់ក្រោយ ➜ មិនស្តារ session ឡើងវិញ · ចូលវិញបាន។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseSdk } from '../src/services/supabase-sdk';
import { SB_ACCOUNT_STORAGE_KEY, SB_AUTH_STORAGE_KEY, createSupabaseTransport } from '../src/services/supabase-transport';

const URL = 'https://abcdefghijklmnopqrst.supabase.co';
const STUCK_BUTTON_MS = 5000;

beforeEach(() => { vi.stubGlobal('BroadcastChannel', undefined); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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

function session(expiresAt: number, token: string, uid = 'u1') {
    return { access_token: token, refresh_token: 'r-' + token, token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user: { id: uid, email: uid + '@users.zoew.invalid', aud: 'authenticated' } };
}

const ROW = { tenant_id: 't1', tenant_name: 'ហាង', branch_code: 'B1', username: 'a', role: 'owner', status: 'active', expires_at: null };

type Mode = 'offline' | 'ok' | 'down' | 'invalid';

function fakeNetwork(mode: Mode) {
    const state = { mode, refreshes: 0, logouts: [] as string[], refreshHold: null as null | ((v: any) => void) };
    const json = (body: any, status: number) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
    const fetch = (input: any, init: any) => {
        const u = String(input && input.url ? input.url : input);
        const headers = (init && init.headers) || {};
        const authz = String((typeof headers.get === 'function' ? headers.get('Authorization') : headers.Authorization) || '');
        if (state.mode === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
        if (u.includes('/auth/v1/logout')) {
            if (state.mode === 'down') return json({ message: 'upstream unavailable' }, 503);
            state.logouts.push(authz);
            return Promise.resolve(new Response(null, { status: 204 }));
        }
        if (u.includes('/auth/v1/token') && u.includes('grant_type=password')) {
            if (state.mode === 'down') return json({ message: 'upstream unavailable' }, 503);
            return json(session(nowSec() + 3600, 'signin.token.x', 'u2'), 200);
        }
        if (u.includes('/auth/v1/token')) {
            state.refreshes++;
            if (state.mode === 'down') return json({ message: 'upstream unavailable' }, 503);
            if (state.mode === 'invalid') return json({ code: 'refresh_token_not_found', error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }, 400);
            return json(session(nowSec() + 3600, 'fresh.token.x'), 200);
        }
        if (u.includes('/rest/v1/rpc/my_account')) {
            if (!authz) return json({ code: 'PGRST301', message: 'JWT required' }, 401);
            const uid = authz.includes('signin') ? 'u2' : 'u1';
            return json([Object.assign({}, ROW, { username: uid })], 200);
        }
        return json({ code: 'PGRST202', message: 'not found' }, 404);
    };
    return { state, fetch };
}

function boot(net: ReturnType<typeof fakeNetwork>, local: ReturnType<typeof memStore>) {
    const seen = { ended: [] as string[] };
    const sdk = createSupabaseSdk((cfg: any) => createSupabaseTransport(cfg, { fetch: net.fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 2000 }), {
        onListenerError: () => {},
        onAccountBlocked: () => {},
        onSessionEnded: (m: string) => { seen.ended.push(m); },
        onTxOutcomeUnknown: () => {},
        docsCache: null
    });
    const app = sdk.initializeApp({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' });
    const auth = sdk.getAuth(app);
    const calls: (string | null)[] = [];
    sdk.onAuthStateChanged(auth, (user: any) => { calls.push(user ? user.uid : null); });
    return { sdk, app, auth, calls, seen };
}

function storeWith(kind: 'expired' | 'live') {
    const local = memStore();
    const s = kind === 'expired' ? session(nowSec() - 3600, 'old.token.x') : session(nowSec() + 3600, 'live.token.x');
    local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(s));
    local.setItem(SB_ACCOUNT_STORAGE_KEY, JSON.stringify({ uid: 'u1', row: ROW }));
    return local;
}

async function advance(ms: number) {
    for (let t = 0; t < ms; t += 250) await vi.advanceTimersByTimeAsync(250);
}

async function settle(p: Promise<any>, totalMs: number) {
    let out: any = { state: 'pending', at: -1 };
    const t0 = Date.now();
    p.then((value) => { out = { state: 'resolved', value, at: Date.now() - t0 }; }, (error) => { out = { state: 'rejected', error, at: Date.now() - t0 }; });
    for (let t = 0; t < totalMs && out.state === 'pending'; t += 250) await vi.advanceTimersByTimeAsync(250);
    return out;
}

describe('Supabase ៖ ចាកចេញពេល Server មិនឆ្លើយ', () => {
    it('⛔ token ផុត + ក្រៅបណ្តាញ ➜ ចាកចេញលឿន · session ចេញពី storage · អ្នកបើក App បន្ទាប់មិនចូលជាគណនីមុន', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('offline');
        const local = storeWith('expired');
        const a = boot(net, local);
        await advance(40000);
        expect(a.auth.currentUser && a.auth.currentUser.uid).toBe('u1');
        const out = await settle(a.sdk.signOut(a.auth), 60000);
        expect(out.state).toBe('resolved');
        expect(out.at).toBeLessThan(STUCK_BUTTON_MS);
        expect(a.auth.currentUser).toBeNull();
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).toBeNull();
        expect(local.getItem(SB_ACCOUNT_STORAGE_KEY)).toBeNull();
        expect(a.seen.ended).toEqual([]);
        net.state.mode = 'ok';
        const b = boot(net, local);
        await advance(5000);
        expect(b.calls).toEqual([null]);
        expect(b.auth.currentUser).toBeNull();
    });

    it('⛔ ចូលពេលមានបណ្តាញ ➜ បណ្តាញងាប់ ២ ម៉ោង (token ផុត) ➜ ចាកចេញលឿន · session ចេញពី storage · អ្នកបើក App បន្ទាប់មិនចូលជាគណនីមុន', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('ok');
        const local = storeWith('live');
        const a = boot(net, local);
        await advance(2000);
        expect(a.auth.currentUser && a.auth.currentUser.uid).toBe('u1');
        net.state.mode = 'offline';
        await advance(2 * 3600 * 1000 / 20);
        vi.setSystemTime(Date.now() + 2 * 3600 * 1000);
        await advance(40000);
        expect(a.auth.currentUser && a.auth.currentUser.uid).toBe('u1');
        const out = await settle(a.sdk.signOut(a.auth), 120000);
        expect(out.at).toBeLessThan(STUCK_BUTTON_MS);
        expect(out.state).toBe('resolved');
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).toBeNull();
        net.state.mode = 'ok';
        const b = boot(net, local);
        await advance(5000);
        expect(b.calls).toEqual([null]);
    });

    it('⛔ token នៅមាន + ក្រៅបណ្តាញ ➜ ចាកចេញជោគជ័យ (មិនបដិសេធ) ហើយ session ចេញពី storage', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('offline');
        const local = storeWith('live');
        const a = boot(net, local);
        await advance(1000);
        expect(a.auth.currentUser && a.auth.currentUser.uid).toBe('u1');
        const out = await settle(a.sdk.signOut(a.auth), 60000);
        expect(out.state).toBe('resolved');
        expect(out.at).toBeLessThan(STUCK_BUTTON_MS);
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).toBeNull();
    });

    it('⛔ GoTrue 503 ➜ ចាកចេញក្នុងឧបករណ៍ជោគជ័យ ហើយ session ចេញពី storage', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('down');
        const local = storeWith('expired');
        const a = boot(net, local);
        await advance(40000);
        const out = await settle(a.sdk.signOut(a.auth), 60000);
        expect(out.state).toBe('resolved');
        expect(out.at).toBeLessThan(STUCK_BUTTON_MS);
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).toBeNull();
    });

    it('⛔ refresh ដែលកំពុងរត់ពេលចាកចេញ ជោគជ័យក្រោយ ➜ មិនស្តារ session ឡើងវិញ · ចូលវិញដោយគណនីថ្មីបាន', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('offline');
        const local = storeWith('expired');
        const a = boot(net, local);
        await advance(40000);
        const out = await settle(a.sdk.signOut(a.auth), 60000);
        expect(out.state).toBe('resolved');
        net.state.mode = 'ok';
        await advance(120000);
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).toBeNull();
        expect(a.auth.currentUser).toBeNull();
        expect(a.calls[a.calls.length - 1]).toBeNull();
        const cred = await settle(a.sdk.signInWithEmailAndPassword(a.auth, 'b', 'pass-b-1234'), 30000);
        expect(cred.state).toBe('resolved');
        expect(a.auth.currentUser && a.auth.currentUser.uid).toBe('u2');
        expect(JSON.parse(local.getItem(SB_AUTH_STORAGE_KEY) || '{}').access_token).toBe('signin.token.x');
    });

    it('⛔ refresh ត្រូវ Server បដិសេធ (400) កំឡុងការចាកចេញដោយខ្លួនឯង ➜ គ្មានសារ «សម័យចូលបានបញ្ចប់»', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('ok');
        const local = storeWith('live');
        const a = boot(net, local);
        await advance(2000);
        expect(a.auth.currentUser && a.auth.currentUser.uid).toBe('u1');
        net.state.mode = 'invalid';
        vi.setSystemTime(Date.now() + 2 * 3600 * 1000);
        const out = await settle(a.sdk.signOut(a.auth), 30000);
        expect(out.state).toBe('resolved');
        expect(net.state.refreshes).toBeGreaterThan(0);
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).toBeNull();
        expect(a.auth.currentUser).toBeNull();
        expect(a.seen.ended).toEqual([]);
    });

    it('⛔ storage លុប session មិនចេញ ➜ មិនអះអាងថាចាកចេញរួច (បដិសេធ ➜ App ប្រាប់អ្នកប្រើ)', async () => {
        const net = fakeNetwork('ok');
        const local = storeWith('live');
        const stuck = Object.assign({}, local, { removeItem: () => {}, getItem: local.getItem, setItem: local.setItem });
        const seen = { ended: [] as string[] };
        const sdk = createSupabaseSdk((cfg: any) => createSupabaseTransport(cfg, { fetch: net.fetch, localStorage: stuck, sessionStorage: memStore(), fetchTimeoutMs: 2000 }), {
            onListenerError: () => {}, onAccountBlocked: () => {}, onSessionEnded: (m: string) => { seen.ended.push(m); }, onTxOutcomeUnknown: () => {}, docsCache: null
        });
        const app = sdk.initializeApp({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' });
        const auth = sdk.getAuth(app);
        await vi.waitFor(() => expect(auth.currentUser).not.toBeNull());
        const out = await sdk.signOut(auth).then(() => 'resolved', () => 'rejected');
        expect(out).toBe('rejected');
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).not.toBeNull();
    });

    it('ទិសផ្ទុយ ៖ បណ្តាញល្អ + token នៅមាន ➜ Server លុបចោល session ដដែល (Bearer token នោះ) ម្តង', async () => {
        const net = fakeNetwork('ok');
        const local = storeWith('live');
        const a = boot(net, local);
        await vi.waitFor(() => expect(a.auth.currentUser).not.toBeNull());
        await a.sdk.signOut(a.auth);
        expect(net.state.logouts).toEqual(['Bearer live.token.x']);
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).toBeNull();
        expect(a.seen.ended).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ បណ្តាញល្អ + token ផុត ➜ refresh ហើយ Server លុបចោលដោយ token ថ្មី', async () => {
        const net = fakeNetwork('ok');
        const local = storeWith('expired');
        const a = boot(net, local);
        await vi.waitFor(() => expect(a.auth.currentUser).not.toBeNull());
        await a.sdk.signOut(a.auth);
        expect(net.state.logouts).toEqual(['Bearer fresh.token.x']);
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).toBeNull();
    });
});
