/**
 * ⛔ «ព្យួរ ≠ ធ្លាក់» លើ transport Supabase ៖ supabase-js (auth) ហៅ fetch ដោយគ្មានពិដាន ➜ ការបន្តសម័យ (refresh token)
 *    ដែលព្យួរលើបណ្តាញ «ភ្ជាប់តែងាប់» ធ្វើឲ្យ `rpc()` រង់ចាំ token ជារៀងរហូត (ពិដាន `timeoutMs` គ្របតែ POST) ហើយ refresh តែមួយ
 *    ដែលព្យួរ រាំងរាល់ការស្នើ token បន្ទាប់។ តេស្តនេះរត់ supabase-js ពិតជាមួយ fetch ក្លែង (ព្យួរ ➜ គោរព `signal` ដូច browser)។
 */
import { describe, expect, it } from 'vitest';
import { SbNetworkError } from '../src/services/supabase-rtdb';
import { SB_AUTH_STORAGE_KEY, createSupabaseTransport } from '../src/services/supabase-transport';

const URL = 'https://abcdefghijklmnopqrst.supabase.co';

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

function session(expiresAt: number, token: string) {
    return { access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user: { id: 'u1', email: 'a@users.zoew.invalid', aud: 'authenticated' } };
}

function fakeNetwork() {
    const state = { hangAuth: true, aborted: 0, rpcAuth: [] as string[] };
    const fetch = (input: any, init: any) => {
        const u = String(input && input.url ? input.url : input);
        if (u.includes('/auth/v1/token')) {
            if (state.hangAuth) {
                return new Promise((_, reject) => {
                    const s = init && init.signal;
                    if (s) s.addEventListener('abort', () => { state.aborted++; reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); });
                });
            }
            const fresh = session(Math.floor(Date.now() / 1000) + 3600, 'fresh.token.x');
            return Promise.resolve(new Response(JSON.stringify(fresh), { status: 200, headers: { 'content-type': 'application/json' } }));
        }
        const headers = (init && init.headers) || {};
        state.rpcAuth.push(String(headers.Authorization || ''));
        return Promise.resolve(new Response('{"ok":1}', { status: 200, headers: { 'content-type': 'application/json' } }));
    };
    return { state, fetch };
}

function transportWith(net: ReturnType<typeof fakeNetwork>) {
    const local = memStore();
    const sess = memStore();
    const t = createSupabaseTransport({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' }, { fetch: net.fetch, localStorage: local, sessionStorage: sess, fetchTimeoutMs: 150 });
    const expired = JSON.stringify(session(Math.floor(Date.now() / 1000) - 3600, 'old.token.x'));
    local.setItem(SB_AUTH_STORAGE_KEY, expired);
    sess.setItem(SB_AUTH_STORAGE_KEY, expired);
    return t;
}

async function settle(p: Promise<any>, ms: number) {
    return Promise.race([
        p.then((value) => ({ state: 'resolved', value }), (error) => ({ state: 'rejected', error })),
        new Promise<any>((r) => setTimeout(() => r({ state: 'pending' }), ms))
    ]);
}

describe('transport Supabase ៖ token ព្យួរ ≠ ធ្លាក់', () => {
    it('ទិសផ្ទុយ ៖ refresh ឆ្លើយ ➜ rpc ផ្ញើ token ថ្មី', async () => {
        const net = fakeNetwork();
        net.state.hangAuth = false;
        const out = await settle(transportWith(net).rpc('zoe_pull', {}, 1000), 3000);
        expect(out.state).toBe('resolved');
        expect(net.state.rpcAuth).toEqual(['Bearer fresh.token.x']);
    });

    it('⛔ refresh ព្យួរ ➜ rpc បដិសេធជា SbNetworkError ក្នុងពិដានរបស់វា (មិនផ្ញើដោយគ្មាន token)', async () => {
        const net = fakeNetwork();
        const started = Date.now();
        const out = await settle(transportWith(net).rpc('zoe_pull', {}, 300), 3000);
        expect(out.state).toBe('rejected');
        expect(out.error).toBeInstanceOf(SbNetworkError);
        expect(Date.now() - started).toBeLessThan(1500);
        expect(net.state.rpcAuth).toEqual([]);
    });

    it('⛔ fetch របស់ supabase-js មានពិដាន ៖ refresh ដែលព្យួរត្រូវ abort ➜ បណ្តាញវិលមក ➜ rpc បន្ទាប់ជោគជ័យ', async () => {
        const net = fakeNetwork();
        const t = transportWith(net);
        const first = await settle(t.rpc('zoe_pull', {}, 300), 3000);
        expect(first.state).toBe('rejected');
        net.state.hangAuth = false;
        const second = await settle(t.rpc('zoe_pull', {}, 3000), 5000);
        expect(second.state).toBe('resolved');
        expect(net.state.aborted).toBeGreaterThan(0);
        expect(net.state.rpcAuth).toEqual(['Bearer fresh.token.x']);
    });

    it('⛔ ចូលប្រព័ន្ធលើបណ្តាញព្យួរ ➜ SbNetworkError ក្នុងពិដាន fetch (មិនព្យួរប្រអប់ចូល)', async () => {
        const net = fakeNetwork();
        const out = await settle(transportWith(net).signIn('a@users.zoew.invalid', 'secret-pass'), 3000);
        expect(out.state).toBe('rejected');
        expect(out.error).toBeInstanceOf(SbNetworkError);
        expect(net.state.aborted).toBe(1);
    });
});
