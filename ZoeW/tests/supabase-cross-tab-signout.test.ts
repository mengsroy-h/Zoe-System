/**
 * ⛔ SUPABASE-1 ៖ ចាកចេញ (ឬចូលគណនីផ្សេង) ក្នុង tab មួយ ត្រូវទៅដល់ tab ផ្សេងរបស់ browser ដដែល (PC ប្រើរួម)។
 *
 * `signOut()` របស់ adapter លុប `zoew-sb-auth*` ពី storage ដោយខ្លួនឯង (⛔ មិនហៅ `client.auth.signOut()`) ➜ supabase-js មិនផ្សាយ
 *    SIGNED_OUT ទៅ tab ផ្សេងទេ ➜ មុនកែ ៖ tab B នៅបង្ហាញទិន្នន័យហាង · `rpc()` ផ្ញើសំណើអនាមិក (គ្មាន token) · tab A ចូលគណនីផ្សេង ➜ tab B
 *    អាន session ថ្មីពី localStorage ដែលចែករួម ➜ សរសេរ/អាន **ដោយ token គណនីផ្សេង** ខណៈអេក្រង់នៅជាគណនីចាស់។
 * ⛔ ច្រកពិត ៖ `storage` event (browser ផ្ញើទៅតែ tab ផ្សេង ៖ ការត្រាប់ខាងក្រោម) + ការការពារក្នុង `rpc()` ពេល tab ខកព្រឹត្តិការណ៍ (ផ្អាក/ងងុយ)។
 *    ⛔ មិនទុកចិត្ត BroadcastChannel (script ណាមួយក្នុង origin ផ្ញើក្លែងបាន) ➜ stub ជា undefined ដូចតេស្ត transport ផ្សេង។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseSdk } from '../src/services/supabase-sdk';
import { SB_ACCOUNT_STORAGE_KEY, SB_AUTH_STORAGE_KEY, createSupabaseTransport } from '../src/services/supabase-transport';

const URL = 'https://abcdefghijklmnopqrst.supabase.co';

beforeEach(() => { vi.stubGlobal('BroadcastChannel', undefined); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const nowSec = () => Math.floor(Date.now() / 1000);

function session(token: string, uid: string) {
    return { access_token: token, refresh_token: 'r-' + token, token_type: 'bearer', expires_in: 3600, expires_at: nowSec() + 3600, user: { id: uid, email: uid + '@users.zoew.invalid', aud: 'authenticated' } };
}

const ROW = { tenant_id: 't1', tenant_name: 'ហាង', branch_code: 'B1', username: 'a', role: 'owner', status: 'active', expires_at: null };

function sharedBrowser() {
    const data = new Map<string, string>();
    const tabs: { target: EventTarget; area: any }[] = [];
    const dispatchOthers = (from: any, key: string, oldValue: string | null, newValue: string | null) => {
        for (const t of tabs) {
            if (t.area === from) continue;
            const ev: any = new Event('storage');
            Object.assign(ev, { key, oldValue, newValue, storageArea: t.area, url: 'https://zoew.example/' });
            Promise.resolve().then(() => t.target.dispatchEvent(ev));
        }
    };
    const tab = () => {
        const area: any = {
            getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
            setItem: (k: string, v: string) => { const old = data.has(k) ? data.get(k)! : null; data.set(k, String(v)); if (old !== String(v)) dispatchOthers(area, k, old, String(v)); },
            removeItem: (k: string) => { if (!data.has(k)) return; const old = data.get(k)!; data.delete(k); dispatchOthers(area, k, old, null); },
            key: (i: number) => Array.from(data.keys())[i] ?? null,
            get length() { return data.size; }
        };
        const target = new EventTarget();
        tabs.push({ target, area });
        return { area, target };
    };
    return { data, tab };
}

function memStore() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); } };
}

type Sent = { tab: string; path: string; authz: string };

function network(sent: Sent[]) {
    const json = (body: any, status: number) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
    return (tabName: string) => (input: any, init: any) => {
        const u = String(input && input.url ? input.url : input);
        const headers = (init && init.headers) || {};
        const authz = String((typeof headers.get === 'function' ? headers.get('Authorization') : headers.Authorization) || '');
        const path = u.replace(URL, '').split('?')[0];
        sent.push({ tab: tabName, path, authz });
        if (u.includes('/auth/v1/logout')) return Promise.resolve(new Response(null, { status: 204 }));
        if (u.includes('/auth/v1/token') && u.includes('grant_type=password')) return json(session('u2.token.x', 'u2'), 200);
        if (u.includes('/auth/v1/token')) return json(session('u1.fresh.x', 'u1'), 200);
        if (u.includes('/rest/v1/rpc/')) {
            if (!authz) return json({ code: 'PGRST301', message: 'JWT required' }, 401);
            const uid = authz.includes('u2.') ? 'u2' : 'u1';
            return json([Object.assign({}, ROW, { username: uid })], 200);
        }
        return json({ code: 'PGRST202', message: 'not found' }, 404);
    };
}

function boot(name: string, browser: ReturnType<typeof sharedBrowser>, fetchFor: (n: string) => any) {
    const { area, target } = browser.tab();
    const seen = { ended: [] as string[] };
    const sdk = createSupabaseSdk((cfg: any) => createSupabaseTransport(cfg, { fetch: fetchFor(name), localStorage: area, sessionStorage: memStore(), fetchTimeoutMs: 2000, eventTarget: target }), {
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
    return { sdk, app, auth, calls, seen, area };
}

async function advance(ms: number) {
    for (let t = 0; t < ms; t += 250) await vi.advanceTimersByTimeAsync(250);
}

function seed(browser: ReturnType<typeof sharedBrowser>) {
    browser.data.set(SB_AUTH_STORAGE_KEY, JSON.stringify(session('u1.live.x', 'u1')));
    browser.data.set(SB_ACCOUNT_STORAGE_KEY, JSON.stringify({ uid: 'u1', row: ROW }));
}

describe('SUPABASE-1 ៖ ចាកចេញ/ចូលគណនីផ្សេងក្នុង tab មួយ ទៅដល់ tab ផ្សេង', () => {
    it('⛔ tab A ចាកចេញ ➜ tab B ចេញពីគណនី (សារ «សម័យចូលបានបញ្ចប់») · មិនផ្ញើ RPC អនាមិក', async () => {
        vi.useFakeTimers();
        const browser = sharedBrowser();
        seed(browser);
        const sent: Sent[] = [];
        const fetchFor = network(sent);
        const a = boot('A', browser, fetchFor);
        const b = boot('B', browser, fetchFor);
        await advance(2000);
        expect(a.auth.currentUser && a.auth.currentUser.uid).toBe('u1');
        expect(b.auth.currentUser && b.auth.currentUser.uid).toBe('u1');
        await a.sdk.signOut(a.auth);
        await advance(1000);
        expect(b.auth.currentUser).toBeNull();
        expect(b.calls[b.calls.length - 1]).toBeNull();
        expect(b.seen.ended.length).toBe(1);
        expect(a.seen.ended).toEqual([]);
        const from = sent.length;
        await b.app._transport.rpc('my_account', {}, 2000).catch(() => null);
        expect(sent.slice(from).filter((s) => s.tab === 'B' && s.path.startsWith('/rest/v1/rpc/') && !s.authz)).toEqual([]);
    });

    it('⛔ tab B ខក storage event (ផ្អាក) ➜ `rpc()` មិនផ្ញើ RPC អនាមិក ហើយបញ្ចប់សម័យក្នុង tab B', async () => {
        vi.useFakeTimers();
        const browser = sharedBrowser();
        seed(browser);
        const sent: Sent[] = [];
        const fetchFor = network(sent);
        const b = boot('B', browser, fetchFor);
        await advance(2000);
        expect(b.auth.currentUser && b.auth.currentUser.uid).toBe('u1');
        browser.data.delete(SB_AUTH_STORAGE_KEY);
        browser.data.delete(SB_ACCOUNT_STORAGE_KEY);
        const from = sent.length;
        const out = await b.app._transport.rpc('my_account', {}, 2000).then(() => 'resolved', (e: any) => 'rejected:' + (e && e.code));
        await advance(500);
        expect(sent.slice(from).filter((s) => s.path.startsWith('/rest/v1/rpc/'))).toEqual([]);
        expect(out.startsWith('rejected')).toBe(true);
        expect(b.auth.currentUser).toBeNull();
        expect(b.seen.ended.length).toBe(1);
    });

    it('⛔ tab A ចូលគណនីផ្សេង (u2) ➜ tab B (u1) ចេញពីគណនី · tab B មិនដែលផ្ញើ token របស់ u2', async () => {
        vi.useFakeTimers();
        const browser = sharedBrowser();
        seed(browser);
        const sent: Sent[] = [];
        const fetchFor = network(sent);
        const a = boot('A', browser, fetchFor);
        const b = boot('B', browser, fetchFor);
        await advance(2000);
        await a.sdk.signOut(a.auth);
        await a.sdk.signInWithEmailAndPassword(a.auth, 'b', 'pass-b-1234');
        await advance(1000);
        expect(a.auth.currentUser && a.auth.currentUser.uid).toBe('u2');
        expect(b.auth.currentUser).toBeNull();
        await b.app._transport.rpc('my_account', {}, 2000).catch(() => null);
        await advance(500);
        expect(sent.filter((s) => s.tab === 'B' && s.authz.includes('u2.'))).toEqual([]);
    });

    it('⛔ tab B ខក event ខណៈ tab A ចូល u2 ➜ `rpc()` របស់ B មិនផ្ញើ token u2 · បញ្ចប់សម័យ', async () => {
        vi.useFakeTimers();
        const browser = sharedBrowser();
        seed(browser);
        const sent: Sent[] = [];
        const fetchFor = network(sent);
        const b = boot('B', browser, fetchFor);
        await advance(2000);
        browser.data.set(SB_AUTH_STORAGE_KEY, JSON.stringify(session('u2.token.x', 'u2')));
        const idToken = await b.auth.currentUser.getIdToken();
        expect(String(idToken)).not.toContain('u2.');
        const out = await b.app._transport.rpc('my_account', {}, 2000).then(() => 'resolved', (e: any) => 'rejected:' + (e && e.code));
        await advance(500);
        expect(sent.filter((s) => s.tab === 'B' && s.authz.includes('u2.'))).toEqual([]);
        expect(out.startsWith('rejected')).toBe(true);
        expect(b.auth.currentUser).toBeNull();
        expect(b.seen.ended.length).toBe(1);
    });

    it('ទិសផ្ទុយ ៖ tab A ផ្លាស់ token គណនីដដែល (refresh) · key ផ្សេង ➜ tab B នៅក្នុងគណនី · គ្មានសារ · RPC ដើរ', async () => {
        vi.useFakeTimers();
        const browser = sharedBrowser();
        seed(browser);
        const sent: Sent[] = [];
        const fetchFor = network(sent);
        const a = boot('A', browser, fetchFor);
        const b = boot('B', browser, fetchFor);
        await advance(2000);
        a.area.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(session('u1.rotated.x', 'u1')));
        a.area.setItem('zoew_unrelated_key', '1');
        await advance(1000);
        expect(b.auth.currentUser && b.auth.currentUser.uid).toBe('u1');
        expect(b.seen.ended).toEqual([]);
        const row = await b.app._transport.rpc('my_account', {}, 2000);
        expect(Array.isArray(row) && row[0].username).toBe('u1');
    });
});
