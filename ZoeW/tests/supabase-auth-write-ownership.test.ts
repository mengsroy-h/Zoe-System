import { afterEach, it, expect, vi } from 'vitest';
import { createSupabaseTransport, SB_AUTH_STORAGE_KEY, SB_RESTORE_CEILING_MS, SB_SIGN_OUT_CEILING_MS } from '../src/services/supabase-transport';
const turn = async () => { for (let i = 0; i < 35; i++) await Promise.resolve(); };
const deferred = <T>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const session = (uid: string) => ({ access_token: uid + '.token.x', refresh_token: 'r-' + uid, token_type: 'bearer',
  expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user: { id: uid, aud: 'authenticated', email: uid + '@users.zoew.invalid' } });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
for (const mode of ['logout', 'replacement']) {
  it('real supabase-js: a late sign-in A cannot publish auth storage after ' + mode, async () => {
    vi.useFakeTimers(); vi.stubGlobal('BroadcastChannel', undefined);
    const rows = new Map<string, string>();
    const sessionRows = new Map<string, string>();
    const storage = { getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => rows.set(k, v), removeItem: (k: string) => rows.delete(k) };
    const sessionStorage = { getItem: (k: string) => sessionRows.get(k) ?? null, setItem: (k: string, v: string) => sessionRows.set(k, v), removeItem: (k: string) => sessionRows.delete(k) };
    const old = deferred<Response>(); let started = false;
    const transport = createSupabaseTransport({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' },
      { localStorage: storage, sessionStorage, eventTarget: new EventTarget(), fetch: async (url: any, init: any) => {
        if (String(url).includes('/auth/v1/token')) {
          const input = JSON.parse(init.body);
          if (input.email.startsWith('A@')) { started = true; return old.promise; }
          return new Response(JSON.stringify(session('B')), { status: 200 });
        }
        return new Response(null, { status: 204 });
      } });
    await transport.restoreSession();
    const loginA = transport.signIn('A@users.zoew.invalid', 'test-A-secret').catch(() => null);
    await turn(); expect(started).toBe(true);
    if (mode === 'logout') {
      const logout = transport.signOut(); await vi.advanceTimersByTimeAsync(SB_SIGN_OUT_CEILING_MS + 1); await logout;
      expect(rows.get(SB_AUTH_STORAGE_KEY)).toBeUndefined();
    } else {
      await transport.signIn('B@users.zoew.invalid', 'test-B-secret');
      expect(JSON.parse(rows.get(SB_AUTH_STORAGE_KEY)!).user.id).toBe('B');
    }
    old.resolve(new Response(JSON.stringify(session('A')), { status: 200 }));
    await loginA; await turn();
    const stored = rows.get(SB_AUTH_STORAGE_KEY); transport.close();
    if (mode === 'logout') expect(stored).toBeUndefined();
    else expect(JSON.parse(stored!).user.id).toBe('B');
  });
}
it('real supabase-js: a refresh pending beyond cached restoration can still replace the expired token', async () => {
  vi.useFakeTimers(); vi.stubGlobal('BroadcastChannel', undefined);
  const expired = { ...session('A'), expires_at: Math.floor(Date.now() / 1000) - 3600 };
  const rows = new Map([[SB_AUTH_STORAGE_KEY, JSON.stringify(expired)]]);
  const storage = { getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => rows.set(k, v), removeItem: (k: string) => rows.delete(k) };
  const emptyStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const refresh = deferred<Response>(); let started = false;
  const transport = createSupabaseTransport({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' },
    { localStorage: storage, sessionStorage: emptyStorage, eventTarget: new EventTarget(), fetch: async () => { started = true; return refresh.promise; } });
  const restored = transport.restoreSession();
  await turn(); expect(started).toBe(true);
  await vi.advanceTimersByTimeAsync(SB_RESTORE_CEILING_MS + 1);
  expect((await restored)?.user.id).toBe('A');
  const fresh = { ...session('A'), access_token: 'fresh.token.x' };
  refresh.resolve(new Response(JSON.stringify(fresh), { status: 200 }));
  await turn();
  const stored = JSON.parse(rows.get(SB_AUTH_STORAGE_KEY)!); transport.close();
  expect(stored.access_token).toBe(fresh.access_token);
});
