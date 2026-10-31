import { describe, it, expect, vi, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';
import { createSupabaseSdk } from '../src/services/supabase-sdk';
import { createSupabaseTransport, SB_AUTH_STORAGE_KEY } from '../src/services/supabase-transport';
import { sheetImportState, firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { openSheetImportModal, closeSheetImportModal, deriveSheetImportKey, encryptSheetImportSecret } from '../src/features/sheet-import';
import { SHEET_IMPORT_STORE_KEY } from '../src/core/storage-keys';

const turn = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const until = async (fn: () => boolean) => {
  for (let i = 0; i < 100; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 5)); }
  throw new Error('probe never reached the intended race');
};
const deferred = <T>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const HIST = 'zoew_scan_history_cod_dod';
const hooks = { onListenerError: (e: any) => { throw e; }, onSynced() {}, onForbidden() {}, onTxOutcomeUnknown() {} };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); appLocalStore.clear(); closeSheetImportModal(); });

describe('Supabase read lifecycle on actual adapter', () => {
  it('control: a current read reaches the snapshot and its live listener', async () => {
    const db = createSupabaseDatabase({ rpc: async () => ({ docs: [{ r: HIST, k: 'parcel', v: { shop: 'A' }, s: 1 }] }) }, hooks);
    db.setAuthed(true, 'scope-A');
    const snap = await db.get(db.ref(HIST + '/parcel'));
    expect(snap.val()).toEqual({ shop: 'A' });
    expect(db.snapshotState().docs[HIST + '/parcel'].v).toEqual({ shop: 'A' });
    db.close('test');
  });
  it('a read from A arriving after logout must leave the cleared adapter empty', async () => {
    const reply = deferred<any>();
    const transport = { rpc: (fn: string) => fn === 'zoe_read' ? reply.promise : new Promise(() => {}) };
    const db = createSupabaseDatabase(transport, hooks);
    db.setAuthed(true, 'scope-A');
    const oldRead = db.get(db.ref(HIST + '/parcel-A'));
    await turn();
    db.resetForSignOut();
    reply.resolve({ docs: [{ r: HIST, k: 'parcel-A', v: { shop: 'A', phone: '012345678' }, s: 90 }] });
    await oldRead.catch(() => null);
    const result = db.snapshotState();
    db.close('test');
    expect(result.docs).toEqual({});
  });
  it('a late A read must not overwrite the listener for a newly logged-in B', async () => {
    const reply = deferred<any>();
    let tenant = 'A';
    const transport = {
      rpc: (fn: string) => fn === 'zoe_read' ? reply.promise : Promise.resolve({ tenant, seq: 2, head: 2, reset: true, more: false,
        rows: [{ r: HIST, k: 'parcel', v: { shop: tenant, cod: tenant === 'A' ? 90 : 2 }, s: 2 }] }),
      subscribe: () => () => {}, ping: async () => true
    };
    const db = createSupabaseDatabase(transport, hooks);
    let live: any;
    db.setAuthed(true, 'scope-A');
    db.onValue(db.ref(HIST), (s: any) => { live = s.val(); });
    await until(() => live?.parcel?.shop === 'A');
    const oldRead = db.get(db.ref(HIST + '/parcel'));
    db.resetForSignOut(); tenant = 'B';
    db.setAuthed(true, 'scope-B');
    await until(() => live?.parcel?.shop === 'B');
    reply.resolve({ docs: [{ r: HIST, k: 'parcel', v: { shop: 'A', cod: 90 }, s: 90 }] });
    await oldRead.catch(() => null);
    const actual = live;
    db.close('test');
    expect(actual).toEqual({ parcel: { shop: 'B', cod: 2 } });
  });
});

describe('Supabase authentication lifecycle on actual SDK', () => {
  it('control: deleting the app closes its transport', async () => {
    const close = vi.fn();
    const sdk = createSupabaseSdk(() => ({ close }), {});
    await sdk.deleteApp(sdk.initializeApp({ supabaseUrl: 'https://a.supabase.co' }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(sdk.getApps()).toEqual([]);
  });
  it('a revoked-account reply after deleteApp must not sign out or write shared storage', async () => {
    const account = deferred<any>();
    const signOut = vi.fn(async () => {});
    const writeAccount = vi.fn();
    const session = { accessToken: 'old-token', user: { id: 'user-A', email: 'a@users.zoew.invalid' } };
    const transport = { close() {}, restoreSession: async () => session, onSession: () => () => {}, onForeignSession: () => () => {},
      readAccount: () => null, writeAccount, rpc: vi.fn(() => account.promise), signOut };
    const env = { onListenerError: vi.fn(), onAccountBlocked: vi.fn(), onTenantChanged: vi.fn(), docsCache: null };
    const sdk = createSupabaseSdk(() => transport, env);
    const app = sdk.initializeApp({ supabaseUrl: 'https://a.supabase.co' });
    sdk.getAuth(app);
    await until(() => transport.rpc.mock.calls.length === 1);
    await sdk.deleteApp(app);
    writeAccount.mockClear();
    account.resolve([{ tenant_id: 'A', status: 'revoked' }]);
    await turn();
    expect(signOut).not.toHaveBeenCalled();
    expect(writeAccount).not.toHaveBeenCalled();
    expect(env.onAccountBlocked).not.toHaveBeenCalled();
  });
  it('deleteApp unsubscribes both auth sources and ignores a late initial restoration', async () => {
    const restore = deferred<any>();
    const offSession = vi.fn(), offForeign = vi.fn(), rpc = vi.fn(async () => [{ tenant_id: 'A', status: 'active' }]);
    const writeAccount = vi.fn();
    const transport = { close() {}, restoreSession: () => restore.promise, onSession: () => offSession,
      onForeignSession: () => offForeign, readAccount: () => ({ uid: 'A', row: { tenant_id: 'A', status: 'active' } }), writeAccount, rpc };
    const sdk = createSupabaseSdk(() => transport, { onListenerError() {}, onTenantChanged() {}, docsCache: null });
    const app = sdk.initializeApp({ supabaseUrl: 'https://a.supabase.co' });
    const auth = sdk.getAuth(app);
    const callback = vi.fn();
    sdk.onAuthStateChanged(auth, callback);
    await sdk.deleteApp(app);
    await sdk.deleteApp(app);
    restore.resolve({ accessToken: 'A-token', user: { id: 'A', email: 'a@users.zoew.invalid' } });
    await turn();
    expect(offSession).toHaveBeenCalledOnce();
    expect(offForeign).toHaveBeenCalledOnce();
    expect(auth.currentUser).toBeNull();
    expect(writeAccount).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });
  it('closing real supabase-js disposes its BroadcastChannel across repeated app lifecycles', async () => {
    const channels: any[] = [];
    class Channel {
      closed = false;
      constructor(public name: string) { channels.push(this); }
      addEventListener() {}
      postMessage() {}
      close() { this.closed = true; }
    }
    vi.stubGlobal('BroadcastChannel', Channel);
    for (let i = 0; i < 50; i++) {
      const storage = { getItem: () => null, setItem() {}, removeItem() {} };
      const transport = createSupabaseTransport({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' },
        { localStorage: storage, sessionStorage: storage, eventTarget: new EventTarget(), fetch: async () => new Response(null, { status: 204 }) });
      await transport.restoreSession();
      expect(channels.filter(c => !c.closed)).toHaveLength(1);
      transport.close();
      await turn();
      expect(channels.filter(c => !c.closed)).toHaveLength(0);
    }
    expect(channels.length).toBe(50);
    expect(channels.every(c => c.closed)).toBe(true);
  });
  it('50 real client lifecycles leave no SDK window listeners and preserve unrelated listeners after every close', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const active = new Set<any>();
    const events = new Set(['visibilitychange', 'pagehide', 'pageshow']);
    const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type: any, listener: any, options: any) => {
      if (events.has(type)) active.add(listener);
      add(type, listener, options);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type: any, listener: any, options: any) => {
      if (events.has(type)) active.delete(listener);
      remove(type, listener, options);
    });
    const unrelated = vi.fn();
    window.addEventListener('pagehide', unrelated);
    let peak = 0;
    try {
      for (let i = 0; i < 50; i++) {
        const storage = { getItem: () => null, setItem() {}, removeItem() {} };
        const transport = createSupabaseTransport({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' },
          { localStorage: storage, sessionStorage: storage, eventTarget: new EventTarget(), fetch: async () => new Response(null, { status: 204 }) });
        await transport.restoreSession();
        if (i === 0) peak = active.size;
        expect(peak).toBeGreaterThan(1);
        expect(active.size).toBe(peak);
        transport.close();
        await turn();
        expect(Array.from(active)).toEqual([unrelated]);
      }
      expect(Array.from(active)).toEqual([unrelated]);
      window.dispatchEvent(new Event('pagehide'));
      expect(unrelated).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('pagehide', unrelated);
    }
  });
  it('initializing auth after transport close cannot reattach a visibility listener', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const refresh = deferred<Response>();
    const shared = new Map<string, string>();
    const storage = { getItem: (k: string) => shared.get(k) ?? null, setItem: (k: string, v: string) => shared.set(k, v), removeItem: (k: string) => shared.delete(k) };
    const session = { access_token: 'A.token.x', refresh_token: 'refresh-A', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) - 3600, user: { id: 'A', aud: 'authenticated' } };
    shared.set(SB_AUTH_STORAGE_KEY, JSON.stringify(session));
    const active = new Set<any>();
    const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type: any, listener: any, options: any) => {
      if (type === 'visibilitychange') active.add(listener);
      add(type, listener, options);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type: any, listener: any, options: any) => {
      if (type === 'visibilitychange') active.delete(listener);
      remove(type, listener, options);
    });
    let started = false;
    const transport = createSupabaseTransport({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' },
      { localStorage: storage, sessionStorage: storage, eventTarget: new EventTarget(), fetch: async () => { started = true; return refresh.promise; } });
    const restore = transport.restoreSession();
    await until(() => started);
    transport.close();
    shared.set(SB_AUTH_STORAGE_KEY, 'replacement-B');
    refresh.resolve(new Response(JSON.stringify({ ...session, access_token: 'refreshed.token.x', expires_in: 3600 }), { status: 200 }));
    await restore;
    await turn();
    expect(shared.get(SB_AUTH_STORAGE_KEY)).toBe('replacement-B');
    expect(active.size).toBe(0);
  });
  it('a pending transport logout cannot delete a replacement session after close', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const logout = deferred<Response>();
    const shared = new Map<string, string>();
    const storage = { getItem: (k: string) => shared.get(k) ?? null, setItem: (k: string, v: string) => shared.set(k, v), removeItem: (k: string) => shared.delete(k) };
    shared.set(SB_AUTH_STORAGE_KEY, JSON.stringify({ access_token: 'A.token.x', refresh_token: 'refresh-A', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'A', aud: 'authenticated' } }));
    let logoutStarted = false;
    const transport = createSupabaseTransport({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' },
      { localStorage: storage, sessionStorage: storage, eventTarget: new EventTarget(), fetch: async () => { logoutStarted = true; return logout.promise; } });
    await transport.restoreSession();
    const pending = transport.signOut();
    await until(() => logoutStarted);
    transport.close();
    shared.set(SB_AUTH_STORAGE_KEY, 'new-B-session');
    logout.resolve(new Response(null, { status: 204 }));
    await pending;
    expect(shared.get(SB_AUTH_STORAGE_KEY)).toBe('new-B-session');
  });
  it('real supabase-js and transport: an old revoked reply must preserve new stored login B', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const account = deferred<Response>();
    const shared = new Map<string, string>();
    const storage = { getItem: (k: string) => shared.get(k) ?? null, setItem: (k: string, v: string) => shared.set(k, v), removeItem: (k: string) => shared.delete(k) };
    const sessionOf = (uid: string) => ({ access_token: uid + '.token.x', refresh_token: 'r-' + uid, token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user: { id: uid, email: uid + '@users.zoew.invalid', aud: 'authenticated' } });
    shared.set(SB_AUTH_STORAGE_KEY, JSON.stringify(sessionOf('A')));
    let oldRequestStarted = false;
    const fetch = async (url: any) => {
      if (String(url).includes('/rest/v1/rpc/my_account')) { oldRequestStarted = true; return account.promise; }
      return new Response(null, { status: 204 });
    };
    const sdk = createSupabaseSdk((cfg: any) => createSupabaseTransport(cfg, { localStorage: storage, sessionStorage: storage, fetch, eventTarget: new EventTarget() }),
      { onListenerError() {}, onAccountBlocked() {}, onTenantChanged() {}, docsCache: null });
    const app = sdk.initializeApp({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' });
    sdk.getAuth(app);
    await until(() => oldRequestStarted);
    await sdk.deleteApp(app);
    shared.set(SB_AUTH_STORAGE_KEY, JSON.stringify(sessionOf('B')));
    account.resolve(new Response(JSON.stringify([{ tenant_id: 'A', status: 'revoked' }]), { status: 200 }));
    await turn();
    await new Promise(r => setTimeout(r, 30));
    expect(storage.getItem(SB_AUTH_STORAGE_KEY)).not.toBeNull();
  });
});

describe('Sheet opening lifecycle with real WebCrypto', () => {
  it('a key derivation finishing after close must not restore the cleared key', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const deriving = deferred<any>();
    const derive = vi.spyOn(webcrypto.subtle, 'deriveKey').mockImplementation(() => deriving.promise);
    const oldOpen = openSheetImportModal('123456');
    await until(() => derive.mock.calls.length === 1);
    closeSheetImportModal();
    deriving.resolve(key);
    await oldOpen;
    expect(sheetImportState.sheetImportKey).toBeNull();
  });
  it('late decryption from shop A must not restore its plaintext URL/password after switching to B', async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { rowCount: 1, sheetName: 'A' } }))));
    const configOf = (name: string) => JSON.stringify({ databaseURL: 'https://shop-' + name + '.firebaseio.com', apiKey: 'k' });
    appLocalStore.setItem('zoew_firebase_config', configOf('a'));
    sheetImportState.sheetImportKey = await deriveSheetImportKey('123456');
    const u = await encryptSheetImportSecret('https://script.google.com/macros/s/shop-a/exec');
    const p = await encryptSheetImportSecret('shop-a-private-password');
    appLocalStore.setItem(SHEET_IMPORT_STORE_KEY, JSON.stringify({ u, p, shop: 'https://shop-a.firebaseio.com' }));
    const decryptReal = webcrypto.subtle.decrypt.bind(webcrypto.subtle);
    const lastDecrypt = deferred<any>();
    let passwordStarted = false;
    const decrypt = vi.spyOn(webcrypto.subtle, 'decrypt').mockImplementation(async (...args: any[]) => {
      const plain = await decryptReal(args[0], args[1], args[2]);
      if (decrypt.mock.calls.length === 2) { passwordStarted = true; await lastDecrypt.promise; }
      return plain;
    });
    const task = openSheetImportModal('123456');
    await until(() => passwordStarted);
    closeSheetImportModal();
    appLocalStore.setItem('zoew_firebase_config', configOf('b'));
    firebaseState.authGeneration++;
    await openSheetImportModal('123456');
    lastDecrypt.resolve(null);
    await task;
    const actual = { url: sheetImportState.sheetImportUrl, password: sheetImportState.sheetImportPassword };
    expect(actual).toEqual({ url: '', password: '' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
