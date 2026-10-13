import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { dbListenerPendingPaths } from '../src/core/text';

const host = 'https://shop.firebaseio.com';
const turn = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
const records = () => Object.keys(localStorage).filter(k => k.startsWith('zoew_connection_writes_v1:')).map(k => JSON.parse(localStorage.getItem(k)!));
beforeEach(() => { localStorage.clear(); dbListenerPendingPaths.clear(); firebaseState.authGeneration++; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function lab(update: any, transaction?: any) {
  const app = { options: { databaseURL: host } }; const auth = { app, currentUser: { uid: 'A', getIdToken: async () => 'fake-token' } }; const db = { app };
  const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path = '') => ({ toString: () => host + '/' + path }),
    update, set: update, runTransaction: transaction || vi.fn(), deleteApp: async () => {} };
  const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
  Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
    isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
  return { sdk, db, app };
}
it('an acknowledged server value with a lost client completion is journaled and verified after recreation', async () => {
  let resolve!: (v: any) => void;
  const first = lab(() => new Promise(r => { resolve = r; }));
  const write = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4200);
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function')); const saved = records();
  await first.sdk.deleteApp(first.app);
  const fetches = vi.fn(async () => Response.json({ uid: 'A', hash: saved[0]?.hash, at: Date.now() })); vi.stubGlobal('fetch', fetches);
  const dispatched = vi.fn(async () => {}); const second = lab(dispatched);
  await second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4300);
  const remaining = records(); resolve(undefined); await write;
  expect(saved).toHaveLength(1); expect(fetches).toHaveBeenCalledTimes(1); expect(dispatched).toHaveBeenCalledTimes(1); expect(remaining).toEqual([]);
});
it('a mismatched Firebase receipt blocks new mutations instead of guessing its outcome', async () => {
  let resolve!: (v: any) => void; const first = lab(() => new Promise(r => { resolve = r; }));
  const write = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4200); await vi.waitFor(() => expect(resolve).toBeTypeOf('function')); await first.sdk.deleteApp(first.app);
  vi.stubGlobal('fetch', async () => Response.json({ uid: 'A', hash: 'f'.repeat(64), at: Date.now() }));
  const dispatched = vi.fn(async () => {}); const second = lab(dispatched);
  const verdict = await second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4300).then(() => 'sent', () => 'needs-verification');
  const saved = records(); resolve(undefined); await write;
  expect(verdict).toBe('needs-verification'); expect(dispatched).not.toHaveBeenCalled(); expect(saved).toHaveLength(1);
});
it('transaction journaling preserves the server basis when the updater mutates its argument', async () => {
  let resolve!: (v: any) => void;
  const native = lab(vi.fn(), (_ref: any, updater: any) => { updater({ codDollar: 10, op: 'op_prior_token' }); return new Promise(r => { resolve = r; }); });
  const write = native.sdk.runTransaction(native.sdk.ref(native.db, 'zoew_daily_revenue_cod_dod/day'), (value: any) => { value.codDollar += 5; value.op = 'op_current_token'; return value; });
  await turn(); const saved = records(); resolve({ committed: true, snapshot: { val: () => ({ codDollar: 15, op: 'op_current_token' }) } }); await write;
  expect(saved).toHaveLength(1); expect(saved[0].ops[0].x.codDollar).toBe(10); expect(saved[0].ops[0].v.codDollar).toBe(15); expect(records()).toEqual([]);
});
