/**
 * ⛔ បើក App ពេលក្រៅបណ្តាញ + token ផុត (ទូរស័ព្ទទុកលើស ១ ម៉ោង) ៖ session នៅក្នុង storage តែ supabase-js សាក refresh ឡើងវិញ ~២៥-៣០ វិ.
 *    មុន `getSession()` ឆ្លើយ `null` ➜ មុនកែ ៖ adapter មិនឆ្លើយ `onAuthStateChanged` ក្នុង ៨ វិ. ➜ App reload ខ្លួនឯង (`attemptAuthStorageRecovery`)
 *    ➜ ប្រអប់ចូលលេច ហើយនៅជាប់ ទោះបណ្តាញត្រឡប់ ហើយ refresh ជោគជ័យ (`TOKEN_REFRESHED` ពេល `currentUser` ទទេ ត្រូវមិនអើពើ)។
 *    ឥឡូវ ៖ ការស្តារមានពិដាន (`SB_RESTORE_CEILING_MS`) ➜ refresh បរាជ័យបណ្តោះអាសន្ន ឬយឺត ➜ ស្តារគណនីពី session ក្នុង storage (ដូច Firebase
 *    ស្តារអ្នកប្រើពី persistence ពេលក្រៅបណ្តាញ) ➜ refresh ជោគជ័យក្រោយ ➜ token ថ្មី · ពិនិត្យស្ថានភាពហាងដែលរំលងពេលក្រៅបណ្តាញ។
 *    ទិសផ្ទុយ ៖ refresh token មិនត្រឹមត្រូវ ➜ ចាកចេញ ហើយប្រាប់មូលហេតុ · ចាកចេញដោយខ្លួនឯង ➜ គ្មានសារមូលហេតុ · គ្មាន session ➜ `null` ភ្លាម។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SbNetworkError } from '../src/services/supabase-rtdb';
import { SB_SESSION_ENDED_TEXT, createSupabaseSdk } from '../src/services/supabase-sdk';
import { SB_ACCOUNT_STORAGE_KEY, SB_AUTH_STORAGE_KEY, createSupabaseTransport } from '../src/services/supabase-transport';

const URL = 'https://abcdefghijklmnopqrst.supabase.co';
const RECOVERY_TIMER_MS = 8000;

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

function session(expiresAt: number, token: string) {
    return { access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user: { id: 'u1', email: 'a@users.zoew.invalid', aud: 'authenticated' } };
}

const ROW = { tenant_id: 't1', tenant_name: 'ហាង', branch_code: 'B1', username: 'a', role: 'owner', status: 'active', expires_at: null };

type Mode = 'offline' | 'ok' | 'invalid' | 'down';

function fakeNetwork(mode: Mode) {
    const state = { mode, status: 'active', refreshes: 0, accountCalls: 0, logouts: 0 };
    const json = (body: any, status: number) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
    const fetch = (input: any, init: any) => {
        const u = String(input && input.url ? input.url : input);
        if (state.mode === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
        if (u.includes('/auth/v1/logout')) { state.logouts++; return Promise.resolve(new Response(null, { status: 204 })); }
        if (u.includes('/auth/v1/token')) {
            state.refreshes++;
            if (state.mode === 'down') return json({ message: 'upstream unavailable' }, 503);
            if (state.mode === 'invalid') return json({ code: 'refresh_token_not_found', error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }, 400);
            return json(session(nowSec() + 3600, 'fresh.token.x'), 200);
        }
        if (u.includes('/rest/v1/rpc/my_account')) {
            const authz = String(((init && init.headers) || {}).Authorization || '');
            if (!authz) return json({ code: 'PGRST301', message: 'JWT required' }, 401);
            state.accountCalls++;
            return json([Object.assign({}, ROW, { status: state.status })], 200);
        }
        return json({ code: 'PGRST202', message: 'not found' }, 404);
    };
    return { state, fetch };
}

function boot(net: ReturnType<typeof fakeNetwork>, stored: 'expired' | 'fresh' | 'none' = 'expired') {
    const local = memStore();
    if (stored !== 'none') {
        const s = stored === 'expired' ? session(nowSec() - 3600, 'old.token.x') : session(nowSec() + 3600, 'live.token.x');
        local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(s));
        local.setItem(SB_ACCOUNT_STORAGE_KEY, JSON.stringify({ uid: 'u1', row: ROW }));
    }
    const seen = { blocked: [] as string[], ended: [] as string[] };
    const sdk = createSupabaseSdk((cfg: any) => createSupabaseTransport(cfg, { fetch: net.fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 2000 }), {
        onListenerError: () => {},
        onAccountBlocked: (m: string) => { seen.blocked.push(m); },
        onSessionEnded: (m: string) => { seen.ended.push(m); },
        onTxOutcomeUnknown: () => {},
        docsCache: null
    });
    const app = sdk.initializeApp({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' });
    const auth = sdk.getAuth(app);
    const calls: { at: number; uid: string | null }[] = [];
    const t0 = Date.now();
    sdk.onAuthStateChanged(auth, (user: any) => { calls.push({ at: Date.now() - t0, uid: user ? user.uid : null }); });
    return { sdk, app, auth, local, calls, seen };
}

async function advance(ms: number) {
    for (let t = 0; t < ms; t += 250) await vi.advanceTimersByTimeAsync(250);
}

describe('Supabase ៖ បើក App ពេលក្រៅបណ្តាញ + token ផុត', () => {
    it('⛔ ស្តារគណនីពី storage មុនពិដាន ៨ វិ. របស់ App (មិន reload · មិនលេចប្រអប់ចូល) ហើយមិនលុប session', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('offline');
        const b = boot(net);
        await advance(RECOVERY_TIMER_MS - 500);
        expect(b.calls.length).toBeGreaterThan(0);
        expect(b.calls[0].uid).toBe('u1');
        expect(b.calls[0].at).toBeLessThan(RECOVERY_TIMER_MS);
        expect(b.sdk.tenantScope(b.auth)).toBe('t1');
        await advance(40000);
        expect(b.calls.map((c) => c.uid)).toEqual(['u1']);
        expect(b.local.getItem(SB_AUTH_STORAGE_KEY)).not.toBeNull();
        expect(b.seen.ended).toEqual([]);
    });

    it('⛔ បណ្តាញត្រឡប់ ➜ refresh ជោគជ័យ ➜ នៅក្នុងប្រព័ន្ធដោយ token ថ្មី ហើយពិនិត្យស្ថានភាពហាងដែលរំលងពេលក្រៅបណ្តាញ', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('offline');
        const b = boot(net);
        await advance(40000);
        expect(net.state.accountCalls).toBe(0);
        net.state.mode = 'ok';
        await advance(120000);
        expect(b.auth.currentUser && b.auth.currentUser.uid).toBe('u1');
        expect(b.auth.currentUser._session.accessToken).toBe('fresh.token.x');
        expect(await b.auth.currentUser.getIdToken()).toBe('fresh.token.x');
        expect(b.calls.every((c) => c.uid === 'u1')).toBe(true);
        expect(net.state.accountCalls).toBeGreaterThan(0);
    });

    it('⛔ ហាងត្រូវបិទខណៈក្រៅបណ្តាញ ➜ ការពិនិត្យក្រោយបណ្តាញត្រឡប់ចាកចេញ ហើយប្រាប់មូលហេតុហាង', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('offline');
        const b = boot(net);
        await advance(40000);
        net.state.status = 'revoked';
        net.state.mode = 'ok';
        await advance(120000);
        expect(b.auth.currentUser).toBeNull();
        expect(b.calls[b.calls.length - 1].uid).toBeNull();
        expect(b.seen.blocked.length).toBe(1);
        expect(b.seen.ended).toEqual([]);
    });

    it('⛔ GoTrue 503 លើសរយៈសាកឡើងវិញ ➜ ស្តារពី storage ដូចក្រៅបណ្តាញ (បណ្តោះអាសន្ន ≠ ចាកចេញ)', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('down');
        const b = boot(net);
        await advance(RECOVERY_TIMER_MS - 500);
        expect(b.calls.map((c) => c.uid)).toEqual(['u1']);
        await advance(40000);
        expect(b.calls.map((c) => c.uid)).toEqual(['u1']);
        expect(b.local.getItem(SB_AUTH_STORAGE_KEY)).not.toBeNull();
    });

    it('ទិសផ្ទុយ ៖ refresh token មិនត្រឹមត្រូវ (400) ➜ មិនស្តារ · ចាកចេញ ហើយប្រាប់មូលហេតុម្តង', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('invalid');
        const b = boot(net);
        await advance(20000);
        expect(b.auth.currentUser).toBeNull();
        expect(b.calls.length).toBeGreaterThan(0);
        expect(b.calls.every((c) => c.uid === null)).toBe(true);
        expect(b.local.getItem(SB_AUTH_STORAGE_KEY)).toBeNull();
        expect(b.seen.ended.length).toBe(1);
    });

    it('ទិសផ្ទុយ ៖ refresh token ត្រូវ Server បដិសេធពេលកំពុងប្រើ ➜ ចាកចេញ ហើយប្រាប់មូលហេតុម្តង', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('offline');
        const b = boot(net);
        await advance(40000);
        expect(b.calls.map((c) => c.uid)).toEqual(['u1']);
        net.state.mode = 'invalid';
        await advance(120000);
        expect(b.auth.currentUser).toBeNull();
        expect(b.calls[b.calls.length - 1].uid).toBeNull();
        expect(b.seen.ended.length).toBe(1);
    });

    it('⛔ ច្បាប់ ៤ ម៉ោងនៅរស់ពេលក្រៅបណ្តាញ ៖ getIdTokenResult ឲ្យ authTime ពី token ចាស់ ក្នុងពិដាន ១៥ វិ. របស់ការពិនិត្យ', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('offline');
        const authSec = nowSec() - 5 * 3600;
        const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
        const jwt = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'u1', exp: nowSec() - 3600, iat: nowSec() - 7200, amr: [{ method: 'password', timestamp: authSec }] }) + '.sig';
        const local = memStore();
        local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(session(nowSec() - 3600, jwt)));
        const sdk = createSupabaseSdk((cfg: any) => createSupabaseTransport(cfg, { fetch: net.fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 2000 }), {
            onListenerError: () => {}, onAccountBlocked: () => {}, onSessionEnded: () => {}, onTxOutcomeUnknown: () => {}, docsCache: null
        });
        const app = sdk.initializeApp({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' });
        const auth = sdk.getAuth(app);
        await advance(40000);
        expect(auth.currentUser && auth.currentUser.uid).toBe('u1');
        let out: any = null;
        sdk.getIdTokenResult(auth.currentUser).then((r: any) => { out = r; });
        for (let t = 0; t < 15000 && !out; t += 250) await vi.advanceTimersByTimeAsync(250);
        expect(out).not.toBeNull();
        expect(Math.abs(new Date(out.authTime).getTime() - authSec * 1000)).toBeLessThan(1000);
    });

    it('ទិសផ្ទុយ ៖ ចាកចេញដោយខ្លួនឯង ➜ គ្មានសារមូលហេតុ', async () => {
        const net = fakeNetwork('ok');
        const b = boot(net, 'fresh');
        await vi.waitFor(() => expect(b.calls.length).toBeGreaterThan(0));
        expect(b.calls[0].uid).toBe('u1');
        await b.sdk.signOut(b.auth);
        expect(b.auth.currentUser).toBeNull();
        expect(b.seen.ended).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ គ្មាន session ➜ null ភ្លាម (មិនរង់ចាំពិដាន) · គ្មានសារ', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('offline');
        const b = boot(net, 'none');
        await advance(500);
        expect(b.calls.map((c) => c.uid)).toEqual([null]);
        expect(b.seen.ended).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ បណ្តាញល្អ + token ផុត ➜ ឆ្លើយដោយ session ថ្មីពី Server (មិនមែន token ចាស់)', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('ok');
        const b = boot(net);
        await advance(1000);
        expect(b.calls.map((c) => c.uid)).toEqual(['u1']);
        expect(b.auth.currentUser._session.accessToken).toBe('fresh.token.x');
    });
});

describe('transport.restoreSession() ៖ getSession ឆ្លើយ error មុនពិដាន', () => {
    it('⛔ refresh បរាជ័យបណ្តោះអាសន្ន (session នៅក្នុង storage) ➜ ស្តារពី storage មិនមែន null', async () => {
        vi.useFakeTimers();
        const net = fakeNetwork('down');
        const local = memStore();
        local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(session(nowSec() - 3600, 'old.token.x')));
        const t = createSupabaseTransport({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' }, { fetch: net.fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 2000 });
        let out: any = 'pending';
        t.restoreSession(120000).then((v: any) => { out = v; });
        for (let i = 0; i < 480 && out === 'pending'; i++) await vi.advanceTimersByTimeAsync(250);
        expect(net.state.refreshes).toBeGreaterThan(1);
        expect(out).not.toBe('pending');
        expect(out && out.user.id).toBe('u1');
        expect(out.accessToken).toBe('old.token.x');
    });
});

function fakeTransport(opts: { accountDown?: boolean } = {}) {
    const state = { accountDown: !!opts.accountDown, accountCalls: 0, status: 'active', emit: null as any, resolveRestore: null as any };
    const restoreP = new Promise((resolve) => { state.resolveRestore = resolve; });
    const transport: any = {
        url: URL,
        restoreSession: () => restoreP,
        onSession: (cb: any) => { state.emit = cb; return () => {}; },
        signOut: async () => { state.emit('SIGNED_OUT', null); },
        setPersistence: () => {},
        accessToken: async () => 'tok',
        rpc: async (fn: string) => {
            if (fn === 'my_account') {
                if (state.accountDown) throw new SbNetworkError('auth-unavailable');
                state.accountCalls++;
                return [Object.assign({}, ROW, { status: state.status })];
            }
            if (fn === 'zoe_pull') return { seq: 1, head: 1, more: false, reset: true, tenant: 't1', now: Date.now(), rows: [] };
            throw new Error('unexpected ' + fn);
        },
        readAccount: () => ({ uid: 'u1', row: ROW }),
        writeAccount: () => {},
        ping: async () => true,
        subscribe: () => () => {},
        close: () => {}
    };
    const seen = { blocked: [] as string[], ended: [] as string[] };
    const sdk = createSupabaseSdk(() => transport, {
        onListenerError: () => {},
        onAccountBlocked: (m: string) => { seen.blocked.push(m); },
        onSessionEnded: (m: string) => { seen.ended.push(m); },
        onTxOutcomeUnknown: () => {},
        docsCache: null,
        dbOptions: { retryStepsMs: [5, 10, 20], pollFallbackMs: 600000, rpcTimeoutMs: 1000 }
    });
    const app = sdk.initializeApp({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' });
    const auth = sdk.getAuth(app);
    const calls: (string | null)[] = [];
    sdk.onAuthStateChanged(auth, (user: any) => { calls.push(user ? user.uid : null); });
    return { sdk, app, auth, state, seen, calls };
}

const stale = { accessToken: 'old.token.x', user: { id: 'u1', email: 'a@users.zoew.invalid' } };

describe('adapter ៖ ការស្តារ ↔ ព្រឹត្តិការណ៍ supabase-js', () => {
    it('⛔ SIGNED_OUT មកមុនការស្តារចប់ (session ត្រូវលុប) ➜ មិនស្តារ session ចាស់ · ប្រាប់មូលហេតុម្តង', async () => {
        const f = fakeTransport();
        f.state.emit('SIGNED_OUT', null);
        f.state.resolveRestore(stale);
        await vi.waitFor(() => expect(f.calls.length).toBeGreaterThan(0));
        expect(f.calls).toEqual([null]);
        expect(f.auth.currentUser).toBeNull();
        expect(f.seen.ended).toEqual([SB_SESSION_ENDED_TEXT]);
    });

    it('⛔ ការពិនិត្យហាងរំលងពេលក្រៅបណ្តាញ ➜ ការទាញជោគជ័យ (onSynced) ពិនិត្យម្តងទៀត ទោះមាន tenant ពី cache', async () => {
        const f = fakeTransport({ accountDown: true });
        f.state.resolveRestore(stale);
        await vi.waitFor(() => expect(f.auth._accountUnverified).toBe(true));
        expect(f.sdk.tenantScope(f.auth)).toBe('t1');
        f.state.accountDown = false;
        f.state.status = 'expired';
        f.sdk.getDatabase(f.app);
        await vi.waitFor(() => expect(f.seen.blocked.length).toBe(1));
        expect(f.auth.currentUser).toBeNull();
        expect(f.seen.ended).toEqual([]);
    });

    it('⛔ ការពិនិត្យហាងស្របគ្នា ២ ➜ សួរ Server ម្តង · សារហាងបិទម្តង', async () => {
        const f = fakeTransport();
        f.state.resolveRestore(stale);
        await vi.waitFor(() => expect(f.state.accountCalls).toBe(1));
        f.state.status = 'revoked';
        await Promise.all([f.auth._verifyAccount(), f.auth._verifyAccount()]);
        expect(f.state.accountCalls).toBe(2);
        expect(f.seen.blocked.length).toBe(1);
        expect(f.seen.ended).toEqual([]);
    });
});
