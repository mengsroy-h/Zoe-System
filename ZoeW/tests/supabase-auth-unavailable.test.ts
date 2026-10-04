/**
 * ⛔ «ចូលប្រព័ន្ធមិនបានបណ្តោះអាសន្ន ≠ គ្មានសិទ្ធិ» លើ transport Supabase ៖ token ផុត (ទូរស័ព្ទដេកលើស ១ ម៉ោង) + GoTrue ដាច់/5xx លើសរយៈ
 *    ដែល supabase-js សាកឡើងវិញ (~២៥-៣០ វិ.) ➜ `getSession()` ឲ្យ `session: null` ខណៈ session នៅក្នុង storage ➜ `rpc()` មុនកែផ្ញើ **ដោយគ្មាន
 *    Authorization** ➜ 401 ➜ adapter ចាត់ជា permission_denied ចុងក្រោយ ៖ ការបិទកញ្ចប់ពេលក្រៅបណ្តាញត្រូវបោះចោល · listener ទាំងអស់ធ្លាក់ ·
 *    transaction ដែលចម្លើយបាត់ក្លាយជា `unknown`។ ឥឡូវ ៖ session នៅ ➜ `SbNetworkError('auth-unavailable')` (បណ្តោះអាសន្ន ➜ សាកឡើងវិញ)។
 *    session ត្រូវ supabase-js លុប (refresh token មិនត្រឹមត្រូវ) ➜ ឥរិយាបថដើម (គ្មាន token ➜ 401 ➜ ចាកចេញ)។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SbNetworkError, SbRpcError } from '../src/services/supabase-rtdb';
import { SB_AUTH_STORAGE_KEY, createSupabaseTransport } from '../src/services/supabase-transport';

const URL = 'https://abcdefghijklmnopqrst.supabase.co';

afterEach(() => { vi.useRealTimers(); });

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

type AuthMode = 'down' | 'invalid' | 'ok';

function fakeNetwork(auth: AuthMode, restStatus = 200) {
    const state = { auth, restStatus, refreshes: 0, rpcAuth: [] as string[] };
    const json = (body: any, status: number) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
    const fetch = (input: any, init: any) => {
        const u = String(input && input.url ? input.url : input);
        if (u.includes('/auth/v1/token')) {
            state.refreshes++;
            if (state.auth === 'down') return json({ message: 'upstream unavailable' }, 503);
            if (state.auth === 'invalid') return json({ code: 'refresh_token_not_found', error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }, 400);
            return json(session(Math.floor(Date.now() / 1000) + 3600, 'fresh.token.x'), 200);
        }
        const headers = (init && init.headers) || {};
        const authz = String(headers.Authorization || '');
        state.rpcAuth.push(authz);
        if (!authz) return json({ code: 'PGRST301', message: 'JWT required' }, 401);
        return json({ ok: 1 }, state.restStatus);
    };
    return { state, fetch };
}

function transportWith(net: ReturnType<typeof fakeNetwork>, withSession = true) {
    const local = memStore();
    const t = createSupabaseTransport({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' }, { fetch: net.fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 2000 });
    if (withSession) local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(session(Math.floor(Date.now() / 1000) - 3600, 'old.token.x')));
    return { t, local };
}

async function drive(p: Promise<any>, totalMs: number) {
    let out: any = { state: 'pending' };
    p.then((value) => { out = { state: 'resolved', value }; }, (error) => { out = { state: 'rejected', error }; });
    for (let t = 0; t < totalMs && out.state === 'pending'; t += 500) await vi.advanceTimersByTimeAsync(500);
    return out;
}

describe('transport Supabase ៖ token ផុត + GoTrue មិនឆ្លើយ ➜ បណ្តោះអាសន្ន មិនមែនគ្មានសិទ្ធិ', () => {
    it('⛔ GoTrue 503 លើសរយៈសាកឡើងវិញ ➜ rpc បដិសេធជា SbNetworkError ហើយមិនផ្ញើដោយគ្មាន token', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('down');
        const { t, local } = transportWith(net);
        const out = await drive(t.rpc('zoe_write', { p_op_id: 'x' }, 60000), 90000);
        expect(net.state.refreshes).toBeGreaterThan(1);
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).not.toBeNull();
        expect(out.state).toBe('rejected');
        expect(out.error).toBeInstanceOf(SbNetworkError);
        expect(net.state.rpcAuth.filter((a) => !a)).toEqual([]);
    });

    it('⛔ ក្នុងរយៈ cooldown ក្រោយ refresh បរាជ័យ ➜ rpc បន្ទាប់ក៏ជា SbNetworkError ដែរ ➜ GoTrue មកវិញ ➜ rpc ជោគជ័យដោយ token ថ្មី', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('down');
        const { t } = transportWith(net);
        await drive(t.rpc('zoe_pull', {}, 20000), 25000);
        await vi.advanceTimersByTimeAsync(10000);
        const again = await drive(t.rpc('zoe_pull', {}, 20000), 5000);
        expect(again.state).toBe('rejected');
        expect(again.error).toBeInstanceOf(SbNetworkError);
        net.state.auth = 'ok';
        await vi.advanceTimersByTimeAsync(65000);
        const later = await drive(t.rpc('zoe_pull', {}, 20000), 120000);
        expect(later.state).toBe('resolved');
        expect(net.state.rpcAuth.filter((a) => !a)).toEqual([]);
        expect(net.state.rpcAuth[net.state.rpcAuth.length - 1]).toBe('Bearer fresh.token.x');
    });

    it('ទិសផ្ទុយ ៖ refresh token មិនត្រឹមត្រូវ (400) ➜ supabase-js លុប session ➜ 401 ជា SbRpcError (ចាកចេញពិត)', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('invalid');
        const { t, local } = transportWith(net);
        const out = await drive(t.rpc('zoe_pull', {}, 20000), 30000);
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).toBeNull();
        expect(out.state).toBe('rejected');
        expect(out.error).toBeInstanceOf(SbRpcError);
        expect(out.error.status).toBe(401);
    });

    it('ទិសផ្ទុយ ៖ គ្មាន session (មិនទាន់ចូល) ➜ rpc ផ្ញើតាមធម្មតា ហើយ 401 ជា SbRpcError', async () => {
        const net = fakeNetwork('ok');
        const { t } = transportWith(net, false);
        const out = await t.rpc('zoe_pull', {}, 5000).then((v: any) => ({ state: 'resolved', v }), (e: any) => ({ state: 'rejected', error: e }));
        expect(out.state).toBe('rejected');
        expect((out as any).error).toBeInstanceOf(SbRpcError);
        expect(net.state.rpcAuth).toEqual(['']);
    });
});
