/**
 * A415 (ម្ចាស់គម្រោង ៖ ប្តូរពាក្យសម្ងាត់រួច ឧបករណ៍ចាស់នៅប្រើបាន) ៖ Server បដិសេធ session ដែលដក (`PT401` `session-revoked` = HTTP 401)
 * ប៉ុន្តែ supabase-js **រក្សា** session ពេល refresh ត្រូវបដិសេធ ខណៈ access token មិនទាន់ផុតកំណត់ (ហើយ cache ការបដិសេធ) ➜ transport មុនកែ
 * ឆ្លើយ `auth-unavailable` (សាកឡើងវិញ) ជារៀងរហូតរហូត token ផុត (~១ ម៉ោង)។ ឥឡូវ ៖ ចម្លើយ `PT401` + refresh ត្រូវបដិសេធ (4xx ក្រៅ 429)
 * ➜ លុប session ដែលផ្ទុក · ផ្លូវ session បញ្ចប់ (foreign) ➜ adapter ចាកចេញ + `SB_SESSION_ENDED_TEXT`។ refresh បរាជ័យបណ្តោះអាសន្ន ឬ 401 ផ្សេង ➜ ដដែល។
 */
import { describe, expect, it } from 'vitest';
import { SbNetworkError, SbRpcError } from '../src/services/supabase-rtdb';
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

const json = (body: any, status: number) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
const REVOKED = { code: 'PT401', message: 'session-revoked', details: null, hint: null };
const EXPIRED = { code: 'PGRST303', message: 'JWT expired', details: null, hint: null };
const REFRESH_REFUSED = { code: 'refresh_token_not_found', error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' };

function liveSession(token: string) {
    return { access_token: token, refresh_token: 'r1', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3000,
        user: { id: 'u1', email: 'a@users.zoew.invalid', aud: 'authenticated' } };
}

async function run(rpcReply: any, refreshStatus: number, rpcTimeoutMs = 5000) {
    const calls = { refresh: 0, rpc: [] as string[] };
    const fetch = (input: any, init: any) => {
        const u = String(input && input.url ? input.url : input);
        if (u.includes('/auth/v1/token')) {
            calls.refresh++;
            if (refreshStatus === 200) return json(liveSession('fresh.token.x'), 200);
            return json(refreshStatus === 400 ? REFRESH_REFUSED : { message: 'unavailable' }, refreshStatus);
        }
        const authz = String(((init && init.headers) || {}).Authorization || '');
        calls.rpc.push(authz);
        if (authz === 'Bearer fresh.token.x') return json({ seq: 7, rows: [] }, 200);
        return json(rpcReply, 401);
    };
    const local = memStore();
    local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(liveSession('live.token.x')));
    const t: any = createSupabaseTransport({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' }, { fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 2000 });
    let ended = 0;
    t.onForeignSession(() => { ended++; });
    await t.restoreSession();
    let result: any = null;
    let error: any = null;
    try { result = await t.rpc('zoe_pull', { p_since: 0, p_limit: 10 }, rpcTimeoutMs); } catch (e) { error = e; }
    return { calls, ended, result, error, stored: local.getItem(SB_AUTH_STORAGE_KEY) };
}

describe('A415 ៖ session ដែល Server ដក ➜ transport បញ្ចប់ session ខ្លួនឯង', () => {
    it('PT401 session-revoked + refresh ត្រូវបដិសេធ (400) ➜ session ដែលផ្ទុកបាត់ · ផ្លូវ session បញ្ចប់ម្តង · កំហុស session-ended', async () => {
        const out = await run(REVOKED, 400);
        expect(out.calls.refresh).toBe(1);
        expect(out.error).toBeInstanceOf(SbRpcError);
        expect(out.error.code).toBe('session-ended');
        expect(out.stored).toBeNull();
        expect(out.ended).toBe(1);
    });

    it.each([503, 429])('PT401 + refresh បរាជ័យបណ្តោះអាសន្ន (%s) ➜ កំហុសបណ្តាញ (សាកឡើងវិញ) · session នៅ · មិនបញ្ចប់', async (status) => {
        const out = await run(REVOKED, status, 1500);
        expect(out.calls.refresh).toBeGreaterThanOrEqual(1);
        expect(out.error).toBeInstanceOf(SbNetworkError);
        expect(out.stored).not.toBeNull();
        expect(out.ended).toBe(0);
    }, 15000);

    it('401 ផ្សេង (JWT expired) + refresh ត្រូវបដិសេធ ➜ auth-unavailable ដដែល · session នៅ · មិនបញ្ចប់', async () => {
        const out = await run(EXPIRED, 400);
        expect(out.error).toBeInstanceOf(SbNetworkError);
        expect(out.error.message).toBe('auth-unavailable');
        expect(out.stored).not.toBeNull();
        expect(out.ended).toBe(0);
    });

    it('PT401 + refresh បានសម្រេច ➜ សំណើម្តងទៀតដោយ token ថ្មី · session នៅ', async () => {
        const out = await run(REVOKED, 200);
        expect(out.error).toBeNull();
        expect(out.result).toEqual({ seq: 7, rows: [] });
        expect(out.calls.rpc).toEqual(['Bearer live.token.x', 'Bearer fresh.token.x']);
        expect(out.ended).toBe(0);
    });
});
