/**
 * ⛔ G6 ៖ នាឡិកាទូរស័ព្ទលឿន ~១ ម៉ោង ៖ GoTrue ឲ្យ `expires_at` តាមម៉ោង Server ➜ supabase-js ប្រៀបជាមួយ `Date.now()` របស់ទូរស័ព្ទ ➜ token
 *    មើលទៅ «ផុត» រាល់ពេល ➜ refresh ស្ទើររាល់ RPC ➜ GoTrue កំណត់ល្បឿន (429) ➜ 429 មិនមែន retryable សម្រាប់ supabase-js ➜ `_removeSession`
 *    ➜ **ចាកចេញ**។ ឥឡូវ ៖ 429 លើ refresh = បណ្តោះអាសន្ន (session នៅ · RPC = `auth-unavailable` ➜ សាកឡើងវិញ) · adapter វាស់គម្លាតម៉ោងពី `now`
 *    របស់ Server ➜ ព្រមានម្តង (`onClockSkew`)។ ទិសផ្ទុយ ៖ refresh token មិនត្រឹមត្រូវ (400) នៅចាកចេញ · ម៉ោងត្រូវ ➜ គ្មានការព្រមាន។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SbNetworkError, SB_CLOCK_SKEW_WARN_MS, createSupabaseDatabase } from '../src/services/supabase-rtdb';
import { createSupabaseSdk } from '../src/services/supabase-sdk';
import { SB_AUTH_STORAGE_KEY, createSupabaseTransport } from '../src/services/supabase-transport';

const URL = 'https://abcdefghijklmnopqrst.supabase.co';
const SKEW_MS = 65 * 60 * 1000;

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function memStore() {
    const m = new Map<string, string>();
    return {
        getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
        setItem: (k: string, v: string) => { m.set(k, String(v)); },
        removeItem: (k: string) => { m.delete(k); }
    };
}

const serverSec = () => Math.floor((Date.now() - SKEW_MS) / 1000);

function session(token: string) {
    return { access_token: token, refresh_token: 'r-' + token, token_type: 'bearer', expires_in: 3600, expires_at: serverSec() + 3600, user: { id: 'u1', email: 'a@users.zoew.invalid', aud: 'authenticated' } };
}

function fakeGoTrue() {
    const state = { refreshes: 0, rpcs: 0, limit: Infinity, invalid: false };
    const json = (body: any, status: number) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
    const fetch = (input: any, init: any) => {
        const u = String(input && input.url ? input.url : input);
        if (u.includes('/auth/v1/token')) {
            state.refreshes++;
            if (state.invalid) return json({ code: 'refresh_token_not_found', error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }, 400);
            if (state.refreshes > state.limit) return json({ code: 'over_request_rate_limit', error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' }, 429);
            return json(session('fresh' + state.refreshes), 200);
        }
        const authz = String(((init && init.headers) || {}).Authorization || '');
        if (!authz) return json({ code: 'PGRST301', message: 'JWT required' }, 401);
        state.rpcs++;
        return json({ ok: 1, now: Date.now() - SKEW_MS }, 200);
    };
    return { state, fetch };
}

async function drive(p: Promise<any>, ms: number) {
    let out: any = { state: 'pending' };
    p.then((value) => { out = { state: 'resolved', value }; }, (error) => { out = { state: 'rejected', error }; });
    for (let t = 0; t < ms && out.state === 'pending'; t += 250) await vi.advanceTimersByTimeAsync(250);
    return out;
}

describe('G6 ៖ នាឡិកាទូរស័ព្ទលឿន ~១ ម៉ោង', () => {
    function boot(net: ReturnType<typeof fakeGoTrue>) {
        vi.stubGlobal('BroadcastChannel', undefined);
        vi.useFakeTimers();
        const local = memStore();
        local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(session('first')));
        const t = createSupabaseTransport({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' }, { fetch: net.fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 2000 });
        return { t, local };
    }

    it('វាស់ ៖ token «ផុត» តាមនាឡិកាទូរស័ព្ទ ➜ refresh ស្ទើររាល់ RPC', async () => {
        const net = fakeGoTrue();
        const { t } = boot(net);
        await vi.advanceTimersByTimeAsync(1000);
        const before = net.state.refreshes;
        for (let i = 0; i < 5; i++) {
            const out = await drive(t.rpc('zoe_pull', {}, 20000), 20000);
            expect(out.state).toBe('resolved');
            await vi.advanceTimersByTimeAsync(1000);
        }
        expect(net.state.refreshes - before).toBeGreaterThanOrEqual(4);
    });

    it('⛔ GoTrue 429 លើ refresh ➜ session នៅ (មិនចាកចេញ) · RPC = SbNetworkError (សាកឡើងវិញ)', async () => {
        const net = fakeGoTrue();
        const { t, local } = boot(net);
        await vi.advanceTimersByTimeAsync(1000);
        net.state.limit = net.state.refreshes;
        const out = await drive(t.rpc('zoe_pull', {}, 60000), 90000);
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).not.toBeNull();
        expect(out.state).toBe('rejected');
        expect(out.error).toBeInstanceOf(SbNetworkError);
        net.state.limit = Infinity;
        await vi.advanceTimersByTimeAsync(70000);
        const later = await drive(t.rpc('zoe_pull', {}, 60000), 90000);
        expect(later.state).toBe('resolved');
    });

    it('ទិសផ្ទុយ ៖ ចូលប្រព័ន្ធ (grant_type=password) ទទួល 429 ➜ នៅជា 429 (សារ «ព្យាយាមញឹកពេក») មិនប្តូរជា 503', async () => {
        vi.stubGlobal('BroadcastChannel', undefined);
        const fetch = () => Promise.resolve(new Response(JSON.stringify({ code: 'over_request_rate_limit', error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' }), { status: 429, headers: { 'content-type': 'application/json' } }));
        const t = createSupabaseTransport({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' }, { fetch, localStorage: memStore(), sessionStorage: memStore(), fetchTimeoutMs: 2000 });
        const err: any = await t.signIn('a@users.zoew.invalid', 'pw-123456').then(() => null, (e: any) => e);
        expect(err && err.status).toBe(429);
    });

    it('ទិសផ្ទុយ ៖ refresh token មិនត្រឹមត្រូវ (400) ➜ session ត្រូវលុប (ចាកចេញពិត)', async () => {
        const net = fakeGoTrue();
        const { t, local } = boot(net);
        await vi.advanceTimersByTimeAsync(1000);
        net.state.invalid = true;
        await drive(t.rpc('zoe_pull', {}, 60000), 90000);
        expect(local.getItem(SB_AUTH_STORAGE_KEY)).toBeNull();
    });
});

describe('G6 ៖ adapter ព្រមានពេលម៉ោងទូរស័ព្ទខុសពី Server', () => {
    function open(serverOffsetMs: number) {
        const skews: number[] = [];
        const transport = {
            rpc: async (fn: string) => {
                if (fn !== 'zoe_pull') throw new Error('unexpected ' + fn);
                return { seq: 1, head: 1, more: false, reset: true, tenant: 't1', now: Date.now() + serverOffsetMs, rows: [] };
            },
            ping: async () => true,
            subscribe: () => () => {}
        };
        const db = createSupabaseDatabase(transport, {
            onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {},
            onClockSkew: (ms: number) => { skews.push(ms); }
        }, { retryStepsMs: [5, 10], pollFallbackMs: 30 });
        db.setAuthed(true, 'scope');
        db.onValue(db.ref('x'), () => {});
        return { db, skews };
    }

    it('⛔ ទូរស័ព្ទលឿន ៦៥ នាទី ➜ onClockSkew ម្តង (គម្លាត ≈ -៦៥ នាទី) ទោះទាញច្រើនដង', async () => {
        const { db, skews } = open(-SKEW_MS);
        await new Promise((r) => setTimeout(r, 150));
        expect(skews.length).toBe(1);
        expect(Math.abs(skews[0] + SKEW_MS)).toBeLessThan(2000);
        db.close('test');
    });

    it('ទិសផ្ទុយ ៖ គម្លាតតិចជាងព្រំ ➜ គ្មានការព្រមាន', async () => {
        const { db, skews } = open(-(SB_CLOCK_SKEW_WARN_MS - 60000));
        await new Promise((r) => setTimeout(r, 150));
        expect(skews).toEqual([]);
        db.close('test');
    });
});

describe('G6 ៖ SDK បញ្ជូនការព្រមានម៉ោងទៅ App', () => {
    it('⛔ adapter វាស់គម្លាត ➜ env.onClockSkew ទទួលអត្ថបទខ្មែរ («លឿន» · នាទី)', async () => {
        const messages: string[] = [];
        const transport: any = {
            url: URL,
            restoreSession: async () => ({ accessToken: 'tok', user: { id: 'u1', email: '' } }),
            onSession: () => () => {},
            signOut: async () => {},
            setPersistence: () => {},
            accessToken: async () => 'tok',
            rpc: async (fn: string) => {
                if (fn === 'zoe_pull') return { seq: 1, head: 1, more: false, reset: true, tenant: 't1', now: Date.now() - SKEW_MS, rows: [] };
                if (fn === 'my_account') return [{ tenant_id: 't1', status: 'active' }];
                throw new Error('unexpected ' + fn);
            },
            readAccount: () => null,
            writeAccount: () => {},
            ping: async () => true,
            subscribe: () => () => {},
            close: () => {}
        };
        const sdk = createSupabaseSdk(() => transport, {
            onListenerError: () => {}, onAccountBlocked: () => {}, onSessionEnded: () => {}, onTxOutcomeUnknown: () => {},
            onClockSkew: (m: string) => { messages.push(m); }, docsCache: null, dbOptions: { pollFallbackMs: 600000 }
        });
        const app = sdk.initializeApp({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' });
        const auth = sdk.getAuth(app);
        await vi.waitFor(() => expect(auth.currentUser).not.toBeNull());
        const db = sdk.getDatabase(app);
        db.onValue(db.ref('x'), () => {});
        await vi.waitFor(() => expect(messages.length).toBe(1));
        expect(messages[0]).toContain('លឿន');
        expect(messages[0]).toContain('65');
        await sdk.deleteApp(app);
    });
});
