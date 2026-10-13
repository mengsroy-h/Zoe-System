import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { NATIVE_RECOVERY_RETRY_GAP_MS, nativeWriteRecoveryState } from '../src/services/native-write-recovery';
import { dbListenerPendingPaths } from '../src/core/text';

const host = 'https://shop.firebaseio.com';
const turn = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
const records = () => Object.keys(localStorage).filter(k => k.startsWith('zoew_connection_writes_v1:')).map(k => JSON.parse(localStorage.getItem(k)!));
beforeEach(() => { localStorage.clear(); dbListenerPendingPaths.clear(); firebaseState.authGeneration++; });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function lab(update: any, transaction?: any) {
  const app = { options: { databaseURL: host } }; const auth = { app, currentUser: { uid: 'A', getIdToken: async () => 'fake-token' } }; const db = { app };
  const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path = '') => ({ toString: () => host + '/' + path }),
    update, set: update, runTransaction: transaction || vi.fn(), deleteApp: async () => {} };
  const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
  Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
    isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
  return { sdk, db, app };
}
const verdictOf = (p: Promise<any>) => p.then(() => 'sent', (e: any) => e.code || e.message);

for (const serverAfter of ['unchanged', 'foreign']) {
  it('an interrupted plain history transaction (' + serverAfter + ' server value) is dropped and never blocks later writes', async () => {
    const prior = { id: 'item1', phone: '012000111', barcodes: [{ code: 'B1', isClosed: false }] };
    let resolve!: (v: any) => void;
    const first = lab(vi.fn(), (_ref: any, updater: any) => { updater(structuredClone(prior)); return new Promise(r => { resolve = r; }); });
    const write = first.sdk.runTransaction(first.sdk.ref(first.db, 'zoew_scan_history_cod_dod/item1'), (item: any) => { item.barcodes[0].isClosed = true; return item; });
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function')); await turn();
    expect(records()).toHaveLength(1);
    await first.sdk.deleteApp(first.app);
    const server = serverAfter === 'unchanged' ? prior : { ...prior, phone: '012000222' };
    vi.stubGlobal('fetch', async () => Response.json(server));
    const dispatched = vi.fn(async () => {}); const second = lab(dispatched);
    const verdict = await verdictOf(second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4300));
    const left = records(); resolve({ committed: false, snapshot: { val: () => prior } }); await write.catch(() => {});
    expect({ verdict, dispatched: dispatched.mock.calls.length, journalRows: left.length, blocked: nativeWriteRecoveryState(second.db).blocked })
      .toEqual({ verdict: 'sent', dispatched: 1, journalRows: 0, blocked: 0 });
  });
}

it('control: an interrupted ledger transaction whose witness cannot decide still blocks', async () => {
  const prior = { codDollar: 24, dodDollar: 0, totalCount: 1, op: 'op_prior_token', ops: { op_prior_token: 1 } };
  let resolve!: (v: any) => void;
  const first = lab(vi.fn(), (_ref: any, updater: any) => { updater(structuredClone(prior)); return new Promise(r => { resolve = r; }); });
  const write = first.sdk.runTransaction(first.sdk.ref(first.db, 'zoew_daily_revenue_cod_dod/day'), (v: any) => ({ ...v, codDollar: 14, op: 'op_mine_token', ops: { op_mine_token: 2 } }));
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function')); await turn();
  await first.sdk.deleteApp(first.app);
  vi.stubGlobal('fetch', async () => Response.json({ codDollar: 30, dodDollar: 0, totalCount: 2, op: 'op_other_token', ops: { op_other_token: 7 } }));
  const dispatched = vi.fn(async () => {}); const second = lab(dispatched);
  const verdict = await verdictOf(second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4300));
  const left = records(); resolve({ committed: false, snapshot: { val: () => prior } }); await write.catch(() => {});
  expect({ verdict, dispatched: dispatched.mock.calls.length, journalRows: left.length }).toEqual({ verdict: 'write_recovery_pending', dispatched: 0, journalRows: 1 });
});

it('a receipt read that fails on the network defers verification instead of blocking; the write proceeds once the read answers', async () => {
  vi.useFakeTimers();
  let resolve!: (v: any) => void; const first = lab(() => new Promise(r => { resolve = r; }));
  const write = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4200);
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function')); const saved = records();
  await first.sdk.deleteApp(first.app);
  let network = false;
  vi.stubGlobal('fetch', async () => { if (!network) throw new TypeError('Failed to fetch'); return Response.json(null); });
  const dispatched = vi.fn(async () => {}); const second = lab(dispatched);
  let settled: string | null = null;
  const pending = verdictOf(second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4300)).then(v => { settled = v; return v; });
  let deferred = false;
  for (let i = 0; i < 200 && !deferred; i++) { await vi.advanceTimersByTimeAsync(10); deferred = nativeWriteRecoveryState(second.db).deferred; }
  await vi.advanceTimersByTimeAsync(NATIVE_RECOVERY_RETRY_GAP_MS * 3);
  const whileDown = { settled, blocked: nativeWriteRecoveryState(second.db).blocked, deferred };
  network = true;
  await vi.advanceTimersByTimeAsync(NATIVE_RECOVERY_RETRY_GAP_MS + 50);
  const verdict = await pending;
  resolve(undefined); await write;
  expect(whileDown).toEqual({ settled: null, blocked: 0, deferred: true });
  expect({ verdict, dispatched: dispatched.mock.calls.length, saved: saved.length, left: records().length }).toEqual({ verdict: 'sent', dispatched: 2, saved: 1, left: 0 });
});

it('a shop whose rules still refuse receipts keeps writing through the plain SDK path and stays unblocked without Web Locks', async () => {
  vi.stubGlobal('navigator', { onLine: true });
  const reads = vi.fn(async () => Response.json(null)); vi.stubGlobal('fetch', reads);
  const sent: any[] = [];
  const native = lab(async (_ref: any, value: any) => {
    if (value && typeof value === 'object' && Object.keys(value).some(k => k.startsWith('zoew_write_receipts/'))) throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
    sent.push(value);
  });
  const verdict = await verdictOf(native.sdk.set(native.sdk.ref(native.db, 'zoew_settings/exchange_rate'), 4200));
  expect({ verdict, sent, reads: reads.mock.calls.length, blocked: nativeWriteRecoveryState(native.db).blocked, rows: records().length })
    .toEqual({ verdict: 'sent', sent: [4200], reads: 0, blocked: 0, rows: 0 });
});

it('a journaled write whose receipt cannot be read because rules refuse it is dropped, not kept blocking', async () => {
  let resolve!: (v: any) => void; const first = lab(() => new Promise(r => { resolve = r; }));
  const write = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4200);
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function')); await first.sdk.deleteApp(first.app);
  vi.stubGlobal('fetch', async () => new Response('{"error":"Permission denied"}', { status: 401 }));
  const dispatched = vi.fn(async () => {}); const second = lab(dispatched);
  const verdict = await verdictOf(second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4300));
  resolve(undefined); await write;
  expect({ verdict, dispatched: dispatched.mock.calls.length, rows: records().length, blocked: nativeWriteRecoveryState(second.db).blocked }).toEqual({ verdict: 'sent', dispatched: 1, rows: 0, blocked: 0 });
});

it('blocked browser storage keeps writes working without a journal (fail-open like every other journal)', async () => {
  const realStorage = window.localStorage;
  Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    const dispatched = vi.fn(async () => {}); const native = lab(dispatched);
    const verdict = await verdictOf(native.sdk.set(native.sdk.ref(native.db, 'zoew_settings/exchange_rate'), 4200));
    const tx = await native.sdk.runTransaction(native.sdk.ref(native.db, 'zoew_scan_history_cod_dod/item1'), (v: any) => v).then(() => 'ran', (e: any) => e.code || e.message);
    expect({ verdict, dispatched: dispatched.mock.calls.length, tx }).toEqual({ verdict: 'sent', dispatched: 1, tx: 'ran' });
  } finally {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { return realStorage; } });
  }
});
