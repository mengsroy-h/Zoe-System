import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { firebaseState, dataState } from '../src/core/state';
import { loadSupabaseFb } from '../src/services/firebase-init';
import { captureAuthDatabaseGuard } from '../src/features/exchange-rate';
import { createSupabaseSdk } from '../src/services/supabase-sdk';
const lab = vi.hoisted(() => ({ env: null as any }));
vi.mock('../src/services/supabase-backend', () => ({ createZoeSupabaseSdk: (env: any) => { lab.env = env; return { __supabase: true }; } }));
beforeEach(async () => {
  await loadSupabaseFb();
  firebaseState.authGeneration++;
  firebaseState.firebaseConfig = { supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co' };
  firebaseState.auth = { currentUser: { uid: 'same-user' }, _account: { tenant_id: 'B' } } as any;
  firebaseState.db = { shop: 'shared-project' } as any;
  firebaseState.fb = null;
  firebaseState.isDatabaseInitialized = true;
  dataState.scanHistory = [{ id: 'private-A', barcodes: [] }] as any;
  dataState.dailyRevenueData = { day: { codDollar: 9 } };
});
afterEach(() => { vi.clearAllTimers(); });
describe('actual App tenant-change handler invalidates previous async feature flows', () => {
  it('live A→B on the same UID/db invalidates previously captured auth/database guards', () => {
    const oldGuard = captureAuthDatabaseGuard();
    expect(oldGuard()).toBe(true);
    lab.env.onTenantChanged('A', 'B');
    expect(oldGuard()).toBe(false);
  });
  it('live A→B clears A business views while the B sync is still pending', () => {
    lab.env.onTenantChanged('A', 'B');
    expect(dataState.scanHistory).toEqual([]);
    expect(dataState.dailyRevenueData).toEqual({});
  });
  it('control: discovering the initial tenant does not invalidate a current feature guard', () => {
    firebaseState.isDatabaseInitialized = false;
    const guard = captureAuthDatabaseGuard();
    lab.env.onTenantChanged('', 'B');
    expect(guard()).toBe(true);
  });
  it('the real SDK supplies the old and new tenant IDs to the App handler', async () => {
    let tenant = 'A'; const changed = vi.fn();
    const transport = { restoreSession: async () => ({ accessToken: 'test-token', user: { id: 'same-user' } }),
      readAccount: () => ({ uid: 'same-user', row: { tenant_id: 'A', status: 'active' } }),
      writeAccount() {}, onSession: () => () => {}, rpc: async () => [{ tenant_id: tenant, status: 'active' }], close() {} };
    const sdk = createSupabaseSdk(() => transport, { onTenantChanged: changed, onListenerError: vi.fn(), docsCache: null });
    const app = sdk.initializeApp({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' });
    const auth = sdk.getAuth(app);
    for (let i = 0; i < 30; i++) await Promise.resolve();
    expect(auth._ready).toBe(true);
    changed.mockClear(); tenant = 'B'; await auth._verifyAccount();
    await sdk.deleteApp(app);
    expect(changed).toHaveBeenCalledWith('A', 'B');
  });
});
