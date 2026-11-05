import { afterEach, expect, it, vi } from 'vitest';
import { withConnectionOwnership, captureConnectionOperation } from '../src/services/connection-flow';
import { createSupabaseSdk } from '../src/services/supabase-sdk';
import { firebaseState } from '../src/core/state';
import { fetchWithTimeout } from '../src/services/network';
const turn = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function shopLab(cachedAccount: any) {
  let account!: (v: any) => void; let seq = 1; const docs: any[] = [{ r: 'zoew_scan_history_cod_dod', k: 'i1', v: { phone: '012000111' }, s: 1 }];
  const transport: any = { restoreSession: async () => ({ accessToken: 'test-token', user: { id: 'same-user' } }),
    readAccount: () => cachedAccount, writeAccount() {}, onSession: () => () => {}, close() {}, subscribe: () => () => {}, ping: async () => {},
    rpc: async (fn: string, args: any) => {
      if (fn === 'my_account') return new Promise(r => { account = r; });
      if (fn === 'zoe_pull') return { seq, more: false, reset: args.p_since === 0, tenant: 'A', now: Date.now(), rows: docs.filter(d => d.s > (args.p_since || 0)) };
      if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe('A'); seq++; const row = { r: args.p_ops[0].p[0], k: args.p_ops[0].p[1], v: args.p_ops[0].v, s: seq }; docs.push(row); return { ok: true, docs: [row], now: Date.now() }; }
      return { ok: true };
    } };
  const sdk = withConnectionOwnership(createSupabaseSdk(() => transport, { onTenantChanged: vi.fn(), onListenerError: vi.fn(), docsCache: null, writeJournal: null }));
  const app = sdk.initializeApp({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' });
  return { sdk, app, auth: sdk.getAuth(app), db: sdk.getDatabase(app), account: (row: any) => account(row) };
}
for (const cached of [false, true]) {
  it((cached ? 'control: with a cached shop' : 'without a cached shop') + ' a data listener attached at sign-in keeps delivering after the shop is discovered', async () => {
    const l = shopLab(cached ? { uid: 'same-user', row: { tenant_id: 'A', status: 'active' } } : null);
    const seen: number[] = [];
    l.sdk.onAuthStateChanged(l.auth, (user: any) => { if (user) l.sdk.onValue(l.sdk.ref(l.db, 'zoew_scan_history_cod_dod'), (snap: any) => seen.push(Object.keys(snap.val() || {}).length)); });
    await turn(); await turn();
    l.account([{ tenant_id: 'A', status: 'active' }]); await turn(); await turn();
    await l.sdk.set(l.sdk.ref(l.db, 'zoew_scan_history_cod_dod/i2'), { phone: '012000222' }); await turn(); await turn();
    await l.sdk.deleteApp(l.app);
    expect(seen).toContain(2);
  });
}
it('shop discovery ends no lease, a shop change still does', () => {
  const auth: any = { currentUser: { uid: 'A' }, _account: null };
  Object.assign(firebaseState, { auth, db: {}, fb: {} });
  const lease = captureConnectionOperation();
  auth._account = { tenant_id: 'A' };
  const afterDiscovery = lease.current();
  const bound = captureConnectionOperation();
  auth._account = { tenant_id: 'B' };
  expect({ afterDiscovery, afterChange: bound.current() }).toEqual({ afterDiscovery: true, afterChange: false });
});
it('a page-level fetch (version feed) survives the boot auth restore while a session request is still ended', async () => {
  Object.assign(firebaseState, { auth: { currentUser: null }, db: {}, fb: {} });
  const answers: Array<(v: any) => void> = [];
  vi.stubGlobal('fetch', () => new Promise(r => { answers.push(r); }));
  const verdict = (p: Promise<any>) => p.then(() => 'ok', (e: any) => e.code || e.message);
  const feed = verdict(fetchWithTimeout('https://zoew.example/announcements.json', { cache: 'no-store', scope: 'page' }, 5000, 'slow', (r: any) => r.json()));
  const session = verdict(fetchWithTimeout('https://zoew.example/.netlify/functions/zto-order-detail', {}, 5000, 'slow', (r: any) => r.json()));
  await turn(); firebaseState.authGeneration++; firebaseState.auth = { currentUser: { uid: 'A' } } as any;
  await turn(); answers.forEach(r => r(Response.json({ items: [] })));
  expect({ feed: await feed, session: await session }).toEqual({ feed: 'ok', session: 'CONNECTION_SCOPE_CHANGED' });
});
it('a write refused before it is sent carries a definitive not-applied verdict, never unknown', async () => {
  const app = { options: { databaseURL: 'https://shop.firebaseio.com' } }; const auth = { app, currentUser: { uid: 'A' } }; const db = { app };
  const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path = '') => ({ toString: () => 'https://shop.firebaseio.com/' + path }), set: vi.fn(), update: vi.fn(), runTransaction: vi.fn() };
  const sdk = withConnectionOwnership(raw); sdk.getAuth(app); sdk.getDatabase(app);
  Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isInitializingFirebase: false, firebaseSdkUnavailable: false, sessionExpiryCheck: 'expired', authLoginOperation: null });
  const refused = await sdk.runTransaction(sdk.ref(db, 'zoew_daily_revenue_cod_dod/day'), (v: any) => v).catch((e: any) => e);
  expect({ code: refused.code, outcome: refused.txOutcome, sent: raw.runTransaction.mock.calls.length }).toEqual({ code: 'CONNECTION_SCOPE_CHANGED', outcome: 'not-applied', sent: 0 });
});
