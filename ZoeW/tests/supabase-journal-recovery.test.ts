import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseDatabase, SbNetworkError, SbRpcError } from '../src/services/supabase-rtdb';
import { createLocalWriteJournal } from '../src/services/write-journal';

const turn = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
const hooks = () => ({ onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() });
const makeJournal = () => {
  const rows = new Map<string, any>();
  return { rows, put: (row: any) => { rows.set(row.opId, structuredClone(row)); return true; },
    list: (scope: string, topic: string) => [...rows.values()].filter(x => x.scope === scope && x.topic === topic),
    remove: (_scope: string, _topic: string, id: string) => rows.delete(id) };
};
const verdictOf = (p: Promise<any>) => p.then(() => 'sent', (e: any) => e.code || e.message);
afterEach(() => { vi.restoreAllMocks(); });

it.each([[null], [{}], [[]], [{ ok: 'true' }]])('ចម្លើយសរសេរមិនច្បាស់ %j រួច auth ដាច់ មិនប្ដូរ journal ទៅ queued ដែលអាច replay ស្ទួន', async (reply) => {
  vi.useFakeTimers();
  const journal = makeJournal();
  let writes = 0;
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_now') return Date.now();
    if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe('A');
      if (++writes === 1) return reply;
      throw new SbNetworkError('auth-unavailable', true);
    }
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, hooks(), { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 600000 });
  try {
    db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
    const pending = db.set(db.ref('zoew_settings/exchange_rate'), 4200);
    pending.catch(() => {});
    await vi.advanceTimersByTimeAsync(50);
    expect(writes).toBeGreaterThanOrEqual(2);
    expect([...journal.rows.values()]).toHaveLength(1);
    expect([...journal.rows.values()][0]).toMatchObject({ uncertain: true, stage: 'sent' });
  } finally { db.close('test'); vi.useRealTimers(); }
});

it('an uncertain write left by a sign-out is replayed by the same account and shop with its original op_id, then the session writes normally', async () => {
  const journal = makeJournal(); const seen: string[] = [];
  journal.put({ v: 1, writeProtocol: 2, scope: 'project|user', topic: 'zoe:A', stage: 'cancelled', uncertain: true, opId: 'operation_abcdefghijkl', sentAfter: Date.now() - 1000, ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }] });
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe('A'); seen.push(args.p_op_id); return { ok: true, docs: [], now: Date.now(), replayed: seen.length === 1 }; }
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, hooks(), { writeJournal: journal });
  db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
  const verdict = await verdictOf(db.set(db.ref('zoew_settings/exchange_rate'), 4200));
  const state = db.recoveryState(); db.close('test');
  expect({ verdict, first: seen[0], writes: seen.length, blocked: state.blocked, rows: journal.rows.size }).toEqual({ verdict: 'sent', first: 'operation_abcdefghijkl', writes: 2, blocked: 0, rows: 0 });
});

it('an uncertain sign-out write older than the server replay window stays blocked (control)', async () => {
  const journal = makeJournal();
  journal.put({ v: 1, writeProtocol: 2, scope: 'project|user', topic: 'zoe:A', stage: 'cancelled', uncertain: true, opId: 'operation_abcdefghijkl', sentAfter: Date.now() - 3 * 86400000, ops: [{ k: 'inc', p: ['zoew_daily_revenue_cod_dod', 'day', 'codDollar'], d: 10 }] });
  const writes: any[] = [];
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write_v2') writes.push(args);
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, hooks(), { writeJournal: journal });
  db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
  const state = db.recoveryState(); db.close('test');
  expect({ writes: writes.length, blocked: state.blocked, rows: journal.rows.size }).toEqual({ writes: 0, blocked: 1, rows: 1 });
});

it('a write refused while recovery is blocked leaves no queued journal row behind (no phantom replay)', async () => {
  const journal = makeJournal();
  journal.put({ v: 1, writeProtocol: 2, scope: 'project|user', topic: 'zoe:A', stage: 'unresolved', opId: 'operation_abcdefghijkl', sentAfter: Date.now() - 1000, ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }] });
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe('A'); return { ok: true, docs: [], now: Date.now() }; }
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, hooks(), { writeJournal: journal });
  db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
  const verdict = await verdictOf(db.set(db.ref('zoew_settings/exchange_rate'), 4200));
  db.close('test');
  expect({ verdict, rows: [...journal.rows.values()].map(r => r.stage) }).toEqual({ verdict: 'WRITE_RECOVERY_PENDING', rows: ['unresolved'] });
});

it('one malformed journal entry never poisons the whole scope', () => {
  const area = new Map<string, string>();
  const storage: any = { get length() { return area.size; }, key: (i: number) => [...area.keys()][i] ?? null,
    getItem: (k: string) => area.get(k) ?? null, setItem: (k: string, v: string) => { area.set(k, v); }, removeItem: (k: string) => { area.delete(k); } };
  const journal = createLocalWriteJournal(storage);
  journal.put({ v: 1, scope: 's', topic: 't', opId: 'operation_abcdefghijkl', sentAfter: 5, ops: [{ k: 'set', p: ['a'], v: 1 }] });
  storage.setItem('zoew_connection_writes_v1:s:t:broken', '{not json');
  storage.setItem('zoew_connection_writes_v1:s:t:other_version_aaaaaaa', JSON.stringify({ v: 2, scope: 's', topic: 't', opId: 'other_version_aaaaaaa', ops: [] }));
  expect(journal.available()).toBe(true);
  expect(journal.list('s', 't').map(r => r.opId)).toEqual(['operation_abcdefghijkl']);
});

describe('advisory transactions (`txAdvisory`) ៖ never journaled · a refusal or a close after a lost reply never blocks the next session', () => {
  const MARK = 'zoew_settings/zto_trash_mode/palm/abcdefgh12345678';
  async function lostThen(after: 'refused' | 'close' | 'late-conflict', advisory: boolean, witness?: () => string, value: () => any = () => Date.now()) {
    vi.useFakeTimers();
    const journal = makeJournal();
    const hook = hooks();
    let writes = 0;
    const transport = { subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe('A');
        if (++writes === 1) throw new SbNetworkError('rpc timed out');
        if (after === 'refused') throw new SbRpcError('new row violates rules', '42501', 403, '');
        if (after === 'late-conflict') return { ok: false, conflict: true, now: Date.now() + 3 * 86400000, value: 5 };
        throw new SbNetworkError('rpc timed out');
      }
      return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
    } };
    const db: any = createSupabaseDatabase(transport, hook, { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 600000 });
    let verdict: any = null;
    try {
      db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
      const updater: any = Object.assign(() => value(), advisory ? { txAdvisory: true } : {}, witness ? { txOutcomeWitness: witness } : {});
      db.runTransaction(db.ref(MARK), updater).then(() => { verdict = 'sent'; }, (e: any) => { verdict = { code: e.code || e.message, txOutcome: e.txOutcome }; });
      await vi.advanceTimersByTimeAsync(after === 'close' ? 3 : 100);
      if (after === 'close') { db.close('test'); await vi.advanceTimersByTimeAsync(50); }
    } finally { db.close('test'); vi.useRealTimers(); }
    const journaled = [...journal.rows.values()].map((r) => r.stage);
    const db2: any = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe('A'); return { ok: true, docs: [], now: Date.now() }; }
      return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
    } }, hooks(), { writeJournal: journal });
    db2.setTenantTopic('zoe:A'); db2.setAuthed(true, 'project|user'); await turn();
    const later = await verdictOf(db2.set(db2.ref('zoew_settings/exchange_rate'), 4200));
    const blocked = db2.recoveryState().blocked; db2.close('test');
    return { writes: writes >= 2, verdict, journaled, rows: [...journal.rows.values()].map((r) => r.stage), unknownReported: hook.onTxOutcomeUnknown.mock.calls.length, later, blocked };
  }

  it('lost reply, then the rules refuse the resend ➜ a refusal (not unknown) · no journal row · no money signal · the next session writes', async () => {
    expect(await lostThen('refused', true)).toEqual({ writes: true, verdict: { code: 'PERMISSION_DENIED', txOutcome: undefined }, journaled: [], rows: [], unknownReported: 0, later: 'sent', blocked: 0 });
  });

  it('S2 (C04) ៖ refusal after a lost reply on a journaled plain CAS ➜ unknown + money signal · unresolved evidence blocks the next session', async () => {
    expect(await lostThen('refused', false)).toEqual({ writes: true, verdict: { code: 'DISCONNECT', txOutcome: 'unknown' }, journaled: ['unresolved'], rows: ['unresolved'], unknownReported: 1, later: 'WRITE_RECOVERY_PENDING', blocked: 1 });
  });

  it('control ៖ the same refusal on a transaction carrying a ledger token stays unresolved and blocks the next session', async () => {
    expect(await lostThen('refused', false, undefined, () => ({ codDollar: 5, op: 'op_ledger_token_1', ops: { op_ledger_token_1: 1 } })))
      .toEqual({ writes: true, verdict: { code: 'DISCONNECT', txOutcome: 'unknown' }, journaled: ['unresolved'], rows: ['unresolved'], unknownReported: 1, later: 'WRITE_RECOVERY_PENDING', blocked: 1 });
  });

  it('lost reply, then the adapter closes ➜ unknown without a money signal and nothing left to block', async () => {
    const out = await lostThen('close', true);
    expect(out).toMatchObject({ verdict: { txOutcome: 'unknown' }, journaled: [], rows: [], unknownReported: 0, later: 'sent', blocked: 0 });
    const control = await lostThen('close', false);
    expect(control).toMatchObject({ verdict: { txOutcome: 'unknown' }, unknownReported: 1 });
    expect(control.journaled, 'control ៖ a journaled transaction leaves its row').toHaveLength(1);
  });

  it('lost reply, then a conflict past the replay window that no witness decides ➜ no money signal for an advisory write', async () => {
    expect(await lostThen('late-conflict', true)).toMatchObject({ verdict: { txOutcome: 'unknown' }, journaled: [], rows: [], unknownReported: 0, later: 'sent', blocked: 0 });
    expect(await lostThen('late-conflict', false)).toMatchObject({ verdict: { txOutcome: 'unknown' }, unknownReported: 1 });
    expect(await lostThen('late-conflict', true, () => 'not-applied')).toMatchObject({ verdict: { txOutcome: 'not-applied' }, unknownReported: 0 });
  });
});
