// N2 (deep audit 8): a journaled Firebase transaction (ledger op token or intent) that failed in session added `blocked`
// for every error but a few, so one `maxretry` (the SDK's own «not applied» verdict) refused every later write of the shop
// until a reload or the PIN discard — and the refusal carried `CONNECTION_SCOPE_CHANGED`, the code callers read as a silent
// session switch. The SDK's abort reasons (`maxretry` · `set` · a server status) are definitive: the row is dropped. A
// `disconnect` is undecided: the row is kept and the recovery pass decides it now from the server (applied ➜ dropped), and a
// write refused while recovery is blocked answers `write_recovery_pending`.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { dbListenerPendingPaths } from '../src/core/text';
import { nativeWriteRecoveryState } from '../src/services/native-write-recovery';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';

const host = 'https://shop.firebaseio.com';
const DAY = 'zoew_daily_revenue_cod_dod/2026-10-27';
const TOKEN = 'op_livefail00000001';
const records = () => Object.keys(localStorage).filter((k) => k.startsWith('zoew_connection_writes_v1:'));
beforeEach(() => { localStorage.clear(); dbListenerPendingPaths.clear(); firebaseState.authGeneration++; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function lab(transaction: any, update?: any) {
  const app = { options: { databaseURL: host } }; const auth = { app, currentUser: { uid: 'A', getIdToken: async () => 'fake-token' } }; const db = { app };
  const sets: any[] = [];
  const write = update || (async (_ref: any, v: any) => { sets.push(v); });
  const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path = '') => ({ toString: () => host + '/' + path }),
    update: write, set: write, runTransaction: transaction, deleteApp: async () => {} };
  const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
  Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
    isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
  return { sdk, db, app, sets };
}
const ledgerUpdater = () => Object.assign((value: any) => ({ codDollar: ((value && value.codDollar) || 0) + 5, op: TOKEN, ops: { [TOKEN]: 1 } }),
  { txOutcomeWitness: (server: any) => (server && server.ops && server.ops[TOKEN] ? 'applied' : 'not-applied') });
const verdictOf = (p: Promise<any>) => p.then(() => 'sent', (e: any) => e.code || e.message);

it.each(['maxretry', 'set'])('the SDK aborts a ledger transaction (%s) ➜ its row is dropped and the next write of the shop goes through', async (reason) => {
  const l = lab(async (_ref: any, update: any) => { update({ codDollar: 10 }); throw new Error(reason); });
  vi.stubGlobal('fetch', async () => Response.json({ codDollar: 10 }));
  const failed = await verdictOf(l.sdk.runTransaction(l.sdk.ref(l.db, DAY), ledgerUpdater()));
  await vi.waitFor(() => expect(nativeWriteRecoveryState(l.db).recovering).toBe(false));
  const later = await verdictOf(l.sdk.set(l.sdk.ref(l.db, 'zoew_settings/exchange_rate'), 4300));
  expect({ failed: failed !== 'sent', rows: records().length, blocked: nativeWriteRecoveryState(l.db).blocked, later, sets: l.sets.length })
    .toEqual({ failed: true, rows: 0, blocked: 0, later: 'sent', sets: 1 });
});

it('a ledger transaction loses its reply (disconnect) but landed ➜ decided from the server at once · never blocks the shop', async () => {
  const l = lab(async (_ref: any, update: any) => { update({ codDollar: 10 }); throw new Error('disconnect'); });
  vi.stubGlobal('fetch', async () => Response.json({ codDollar: 15, op: TOKEN, ops: { [TOKEN]: 1 } }));
  const outcome = await l.sdk.runTransaction(l.sdk.ref(l.db, DAY), ledgerUpdater()).then((r: any) => r.txOutcome || 'committed', (e: any) => e.txOutcome || e.message);
  await vi.waitFor(() => expect(records()).toEqual([]));
  const later = await verdictOf(l.sdk.set(l.sdk.ref(l.db, 'zoew_settings/exchange_rate'), 4300));
  expect({ outcome, blocked: nativeWriteRecoveryState(l.db).blocked, later }).toEqual({ outcome: 'applied', blocked: 0, later: 'sent' });
});

it('a write refused while recovery is blocked says so (`write_recovery_pending`) — never the session-switch code', async () => {
  let resolve!: (v: any) => void;
  const first = lab(vi.fn(), () => new Promise((r) => { resolve = r; }));
  const write = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4200);
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  await first.sdk.deleteApp(first.app);
  vi.stubGlobal('fetch', async () => Response.json({ uid: 'A', hash: 'f'.repeat(64), at: Date.now() }));
  const second = lab(vi.fn());
  const verdict = await verdictOf(second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4300));
  const gated = await verdictOf(second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4400));
  resolve(undefined); await write.catch(() => {});
  expect({ verdict, gated, blocked: nativeWriteRecoveryState(second.db).blocked > 0, sets: second.sets.length })
    .toEqual({ verdict: 'write_recovery_pending', gated: 'write_recovery_pending', blocked: true, sets: 0 });
});
