import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { txRestUrl, withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { dbListenerPendingPaths } from '../src/core/text';
import { createLocalWriteJournal } from '../src/services/write-journal';
import { commitDailyRevenueDelta, ledgerOpRing } from '../src/domain/ledger';

async function recoveryState(db: any) {
  const modulePath = '../src/services/native-write-recovery';
  try { return (await import(modulePath)).nativeWriteRecoveryState(db); } catch { return { blocked: 0 }; }
}

const host = 'https://shop.firebaseio.com';
const turn = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
const records = () => Object.keys(localStorage).filter(k => k.startsWith('zoew_connection_writes_v1:')).map(k => JSON.parse(localStorage.getItem(k)!));
beforeEach(() => { localStorage.clear(); dbListenerPendingPaths.clear(); firebaseState.authGeneration++; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixtureEndpoint(databaseURL: string) {
  return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(databaseURL) ? databaseURL : 'https://' + databaseURL);
}

function lab(update: any, transaction?: any, databaseURL = host, rootHost = fixtureEndpoint(databaseURL).origin) {
  const app = { options: { databaseURL } }; const auth = { app, currentUser: { uid: 'A', getIdToken: async () => 'fake-token' } }; const db = { app };
  const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path = '') => ({ toString: () => rootHost + '/' + path }),
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

it('an advisory transaction in flight is never journaled, so a page that dies mid-flight leaves no row to defer the next session', async () => {
  for (const advisory of [true, false]) {
    localStorage.clear();
    let resolve!: (v: any) => void;
    const native = lab(vi.fn(), (_ref: any, updater: any) => { updater({ palmAt: 1 }); return new Promise(r => { resolve = r; }); });
    const updater = Object.assign((v: any) => ({ ...(v || {}), palmAt: 2 }), advisory ? { txAdvisory: true } : {});
    const write = native.sdk.runTransaction(native.sdk.ref(native.db, 'zoew_settings/zto_trash_mode'), updater);
    await turn(); const saved = records();
    resolve({ committed: true, snapshot: { val: () => ({ palmAt: 2 }) } }); await write;
    if (advisory) expect(saved, 'advisory ➜ no journal row while in flight').toEqual([]);
    else expect(saved, 'control ➜ a plain CAS row while in flight').toHaveLength(1);
    expect(records()).toEqual([]);
  }
});

it('a legacy ledger receives an identity anchor without changing money before its first deduction', async () => {
  let value: any = { codDollar: 24, dodDollar: 0, totalCount: 1 }; const writes: any[] = [];
  const native = lab(vi.fn(), async (_ref: any, updater: any) => {
    const next = updater(structuredClone(value));
    if (next === undefined) return { committed: false, snapshot: { val: () => value } };
    writes.push(structuredClone(next)); value = next;
    return { committed: true, snapshot: { val: () => value } };
  });
  firebaseState.dbRefDailyRevenue = native.sdk.ref(native.db, 'zoew_daily_revenue_cod_dod');
  const delta = await commitDailyRevenueDelta('day', -10, 0, 0, null, true);
  expect(writes.some(v => v.codDollar === 24 && typeof v.op === 'string' && v.ops?.[v.op] > 0)).toBe(true);
  expect(value.codDollar).toBe(14); expect(delta.cod).toBe(-10); expect(records()).toEqual([]);
});

it('a lost deduction on a legacy ledger resolves against a foreign writer and deducts exactly once', async () => {
  let value: any = { codDollar: 24, dodDollar: 0, totalCount: 1 }; let lose = true;
  const native = lab(vi.fn(), async (_ref: any, updater: any) => {
    const next = updater(structuredClone(value));
    if (next === undefined) return { committed: false, snapshot: { val: () => value } };
    if (lose && next.codDollar !== value.codDollar) {
      lose = false; value = { ...value, codDollar: value.codDollar + 6, op: 'op_foreign_token', ops: ledgerOpRing(value, 'op_foreign_token') };
      throw new Error('disconnect');
    }
    value = next; return { committed: true, snapshot: { val: () => value } };
  });
  vi.stubGlobal('fetch', async () => Response.json(value));
  firebaseState.dbRefDailyRevenue = native.sdk.ref(native.db, 'zoew_daily_revenue_cod_dod');
  const delta = await commitDailyRevenueDelta('day', -10, 0, 0, null, true);
  expect(value.codDollar).toBe(20); expect(delta.cod).toBe(-10);
  expect((await recoveryState(native.db)).blocked).toBe(0); expect(records()).toEqual([]);
});

it('a fresh atomic write denied while holding its operation lock preserves the definitive SDK rejection once its receipt is absent', async () => {
  vi.stubGlobal('navigator', { onLine: true, locks: { request: async (_name: any, _options: any, callback: any) => callback({}) } });
  const reads = vi.fn(async () => Response.json(null)); vi.stubGlobal('fetch', reads);
  const native = lab(async () => { throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }); });
  const error = await native.sdk.set(native.sdk.ref(native.db, 'zoew_settings/exchange_rate'), 4200).catch((e: any) => e);
  expect(error.code).toBe('PERMISSION_DENIED'); expect(reads).toHaveBeenCalledTimes(1);
  expect((await recoveryState(native.db)).blocked).toBe(0); expect(records()).toEqual([]);
});

it('a persisted payload that no longer matches its receipt hash is retained without replay', async () => {
  let resolve!: (v: any) => void; const first = lab(() => new Promise(r => { resolve = r; }));
  const write = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4200);
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  expect(records()).toHaveLength(1);
  const key = Object.keys(localStorage).find(k => k.startsWith('zoew_connection_writes_v1:'))!;
  const row = JSON.parse(localStorage.getItem(key)!); row.ops[0].v = 9900; localStorage.setItem(key, JSON.stringify(row));
  await first.sdk.deleteApp(first.app); vi.stubGlobal('fetch', async () => Response.json(null));
  const dispatched = vi.fn(async () => {}); const second = lab(dispatched);
  const verdict = await second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4300).then(() => 'sent', () => 'blocked');
  expect(verdict).toBe('blocked'); expect(dispatched).not.toHaveBeenCalled(); expect(records()).toHaveLength(1);
  resolve(undefined); await write;
});

it('a money intent survives recreation while its harmless legacy identity preparation is awaiting acknowledgement', async () => {
  vi.stubGlobal('navigator', { onLine: true, locks: { request: async (_name: any, _options: any, callback: any) => callback({}) } });
  let value: any = { codDollar: 24, dodDollar: 0, totalCount: 1 }; let resolveAnchor!: (v: any) => void;
  const apply = async (_ref: any, updater: any) => {
    const next = updater(structuredClone(value));
    if (next === undefined) return { committed: false, snapshot: { val: () => value } };
    value = next; return { committed: true, snapshot: { val: () => value } };
  };
  const first = lab(vi.fn(), async (ref: any, updater: any) => {
    const before = value.codDollar; const result = await apply(ref, updater);
    if (result.committed && value.codDollar === before) return new Promise(r => { resolveAnchor = r; });
    return result;
  });
  firebaseState.dbRefDailyRevenue = first.sdk.ref(first.db, 'zoew_daily_revenue_cod_dod');
  const pending = commitDailyRevenueDelta('day', -10, 0, 0, null, true);
  await vi.waitFor(() => expect(resolveAnchor).toBeTypeOf('function'));
  expect(records()).toHaveLength(1); expect(records()[0].stage).toBe('prepared');
  await first.sdk.deleteApp(first.app); vi.stubGlobal('fetch', async () => Response.json(value));
  const second = lab(vi.fn(async () => {}), apply);
  await second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4300);
  expect(value.codDollar).toBe(14); expect(records()).toEqual([]);
  resolveAnchor({ committed: true, snapshot: { val: () => value } }); await pending;
  expect(value.codDollar).toBe(14);
});


for (const [a, b, rootHost] of [
  ['http://127.0.0.1:9000?ns=branch-a', 'http://127.0.0.1:9000?ns=branch-b'],
  ['https://branch-a.firebaseio.com', 'https://branch-b.firebaseio.com'],
  ['https://branch-a.firebaseio.com', 'https://branch-b.firebaseio.com', 'http://127.0.0.1:9000'],
  ['http://127.0.0.1:9000?ns=shared&ns=branch-a', 'http://127.0.0.1:9000?ns=shared&ns=branch-b'],
  ['127.0.0.1:9000?ns=branch-a', '127.0.0.1:9000?ns=branch-b', 'https://127.0.0.1:9000'],
  ['branch-a.firebaseio.com', 'branch-b.firebaseio.com', 'http://127.0.0.1:9000'],
  ['branch-a.firebaseio.com', 'branch-b.firebaseio.com']
]) it('journal A មិន replay ចូល B ទោះ UID ដូចគ្នា ៖ ' + a, async () => {
  let completeA!: (v: any) => void;
  const first = lab(() => new Promise(resolve => { completeA = resolve; }), undefined, a, rootHost);
  const pending = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4201);
  await vi.waitFor(() => expect(completeA).toBeTypeOf('function'));
  const saved = records(); expect(saved).toHaveLength(1);
  if (!rootHost && !fixtureEndpoint(a).searchParams.has('ns')) expect(saved[0].scope).toBe(fixtureEndpoint(a).origin + '/|A');
  expect(saved[0].ops).toEqual([{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4201 }]);
  await first.sdk.deleteApp(first.app);
  const receiptReads = vi.fn(async () => Response.json(null)); vi.stubGlobal('fetch', receiptReads);
  const writesB = vi.fn(async () => {}); const second = lab(writesB, undefined, b, rootHost);
  await second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4301);
  expect(writesB.mock.calls.map(call => (call as any[])[1]['zoew_settings/exchange_rate'])).toEqual([4301]);
  expect(receiptReads).not.toHaveBeenCalled();
  expect(records()).toEqual(saved);
  await second.sdk.deleteApp(second.app);
  const sameEndpoint = !rootHost || rootHost === fixtureEndpoint(a).origin;
  if (sameEndpoint) {
    vi.stubGlobal('fetch', async () => Response.json(null));
    const writesA = vi.fn(async () => {}); const returned = lab(writesA, undefined, a, rootHost);
    await returned.sdk.set(returned.sdk.ref(returned.db, 'zoew_settings/exchange_rate'), 4401);
    expect(writesA.mock.calls.map(call => (call as any[])[1]['zoew_settings/exchange_rate'])).toEqual([4201, 4401]);
    expect(records()).toEqual([]);
  }
  completeA(undefined); await pending;
  if (!sameEndpoint) expect(records()).toEqual([]);
});


it('journal shared-host ចាស់ដែលបាត់ namespace ត្រូវរក្សាទុក ដោយមិន adopt ចូល namespace បច្ចុប្បន្ន', async () => {
  let completeA!: (value: any) => void;
  const first = lab(() => new Promise(resolve => { completeA = resolve; }), undefined, 'http://127.0.0.1:9000?ns=branch-a');
  const pending = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4201);
  await vi.waitFor(() => expect(completeA).toBeTypeOf('function'));
  const legacy = { ...records()[0], scope: 'http://127.0.0.1:9000/|A' };
  localStorage.clear(); expect(createLocalWriteJournal().put(legacy)).toBe(true);
  await first.sdk.deleteApp(first.app);
  const reads = vi.fn(async () => Response.json(null)); vi.stubGlobal('fetch', reads);
  const writes = vi.fn(async () => {}); const second = lab(writes, undefined, 'http://127.0.0.1:9000?ns=branch-b');
  await second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4301);
  expect(writes.mock.calls.map(call => (call as any[])[1]['zoew_settings/exchange_rate'])).toEqual([4301]);
  expect(reads).not.toHaveBeenCalled(); expect(records()).toEqual([legacy]);
  completeA(undefined); await pending; expect(records()).toEqual([legacy]);
});


for (const [configured, rootHost, namespace] of [
  ['http://127.0.0.1:9000?ns=shared&ns=branch-a', 'http://127.0.0.1:9000', 'branch-a'],
  ['127.0.0.1:9000?ns=branch-a', 'https://127.0.0.1:9000', 'branch-a'],
  ['http://127.0.0.1:9000?ns=branch+a', 'http://127.0.0.1:9000', 'branch+a'],
  ['http://127.0.0.1:9000?ns=branch-a&ns=ignored=tail', 'http://127.0.0.1:9000', 'branch-a']
]) it('receipt REST namespace ត្រូវដូច SDK ៖ ' + configured, () => {
  const native = lab(vi.fn(), undefined, configured, rootHost);
  const endpoint = txRestUrl(native.sdk.ref(native.db, 'zoew_write_receipts/synthetic'));
  expect(endpoint).not.toBe('');
  const url = new URL(endpoint);
  expect(url.origin).toBe(rootHost);
  expect(url.pathname).toBe('/zoew_write_receipts/synthetic.json');
  expect(url.searchParams.getAll('ns')).toEqual([namespace]);
});

it('receipt REST នៅតែបដិសេធ host ខុស និង host ខាងក្រៅ whitelist', () => {
  for (const [configured, rootHost] of [
    ['https://branch-a.firebaseio.com', 'https://branch-b.firebaseio.com'],
    ['https://untrusted.invalid', 'https://untrusted.invalid'],
    ['http://branch-a.firebaseio.com', 'http://branch-a.firebaseio.com']
  ]) {
    const native = lab(vi.fn(), undefined, configured, rootHost);
    expect(txRestUrl(native.sdk.ref(native.db, 'zoew_write_receipts/synthetic'))).toBe('');
  }
});


it('config មិនអាចបកស្រាយបាន មិនត្រឡប់ទៅ journal scope ទូលាយ', async () => {
  const writes = vi.fn(async () => {});
  const native = lab(writes, undefined, 'http://%?ns=branch-a', 'http://127.0.0.1:9000');
  await expect(Promise.resolve().then(() => native.sdk.set(native.sdk.ref(native.db, 'zoew_settings/exchange_rate'), 4201)))
    .rejects.toThrow('Database recovery scope unavailable');
  expect(writes).not.toHaveBeenCalled(); expect(records()).toEqual([]);
});
