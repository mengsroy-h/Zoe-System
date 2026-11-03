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

  it('S2 (A362/A375 parity) ៖ the same refusal on a journaled plain CAS ➜ unknown + money signal, but its row is dropped and never blocks the next session', async () => {
    expect(await lostThen('refused', false)).toEqual({ writes: true, verdict: { code: 'DISCONNECT', txOutcome: 'unknown' }, journaled: [], rows: [], unknownReported: 1, later: 'sent', blocked: 0 });
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

describe('boot recovery ៖ rows that never reached the server or that only a plain CAS decides never block the next session (A375 · «Transactions: disconnect»)', () => {
  const now = Date.now();
  const SCOPE = 'project|user', TOPIC = 'zoe:A';
  const set = [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }];
  const cas = [{ k: 'cas', p: ['zoew_settings', 'exchange_rate'], x: 4000, v: 4100 }];
  const boot = async (rows: any[]) => {
    const journal = makeJournal();
    for (const row of rows) journal.put(row);
    const writes: any[] = [];
    const db = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_now') return Date.now();
      if (fn === 'zoe_write' || fn === 'zoe_write_v2') { writes.push({ fn, op: args.p_op_id, tenant: args.p_expected_tenant }); return { ok: true, docs: [], now: Date.now() }; }
      return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
    } }, hooks(), { writeJournal: journal });
    db.setTenantTopic(TOPIC); db.setAuthed(true, SCOPE); await turn(); await turn();
    const later = await verdictOf(db.set(db.ref('zoew_settings/other'), 1));
    const out = { writes, blocked: db.recoveryState().blocked, journal: [...journal.rows.values()].map(r => r.stage), later };
    db.close('t');
    return out;
  };
  it.each([
    ['v2 plain CAS sent past the replay window', { v: 1, writeProtocol: 2, scope: SCOPE, topic: TOPIC, stage: 'sent', uncertain: true, opId: 'operation_abcdefghijkl', sentAfter: now - 3 * 86400000, ops: cas }],
    ['legacy plain CAS sent past the replay window', { v: 1, scope: SCOPE, topic: TOPIC, stage: 'sent', uncertain: true, opId: 'operation_abcdefghijkl', sentAfter: now - 3 * 86400000, ops: cas }],
    ['v2 plain CAS left unresolved', { v: 1, writeProtocol: 2, scope: SCOPE, topic: TOPIC, stage: 'unresolved', uncertain: true, opId: 'operation_abcdefghijkl', sentAfter: now - 1000, ops: cas }]
  ])('%s ➜ dropped without a write, the next write is sent', async (_name, row: any) => {
    const out = await boot([row]);
    expect(out.writes.filter((w: any) => w.op === row.opId)).toEqual([]);
    expect(out).toEqual({ writes: [{ fn: 'zoe_write_v2', op: expect.any(String), tenant: 'A' }], blocked: 0, journal: [], later: 'sent' });
  });
  it('control ៖ a never-sent dependent write stays held while an earlier row of the same session is blocked (order kept)', async () => {
    const held = { v: 1, writeProtocol: 2, scope: SCOPE, topic: TOPIC, stage: 'unresolved', uncertain: true, opId: 'operation_aaaaaaaaaaaa', sentAfter: now - 1000, ops: [{ k: 'inc', p: ['zoew_daily_revenue_cod_dod', 'day', 'codDollar'], d: 10, op: 'op_tok_aaaaaaaa' }] };
    const waiting = { v: 1, writeProtocol: 2, scope: SCOPE, topic: TOPIC, stage: 'unresolved', awaitingRecovery: true, opId: 'operation_bbbbbbbbbbbb', sentAfter: 0, queuedAt: now - 500, ops: set };
    const out = await boot([held, waiting]);
    expect(out.writes.filter((w: any) => w.op === 'operation_bbbbbbbbbbbb')).toEqual([]);
    expect(out.blocked).toBeGreaterThan(0);
    expect(out.later).toBe('WRITE_RECOVERY_PENDING');
  });
  it('control ៖ a row of the previous app version from another shop never replays and keeps blocking', async () => {
    const row = { v: 1, scope: SCOPE, topic: 'zoe:B', stage: 'sent', opId: 'operation_abcdefghijkl', sentAfter: now - 1000, ops: set };
    const journal = makeJournal(); journal.put(row);
    const writes: any[] = [];
    const db = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_now') return Date.now();
      if (fn === 'zoe_write' || fn === 'zoe_write_v2') { writes.push(args.p_op_id); return { ok: true, docs: [], now: Date.now() }; }
      return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
    } }, hooks(), { writeJournal: journal });
    db.setTenantTopic(TOPIC); db.setAuthed(true, SCOPE); await turn(); await turn();
    expect(writes).toEqual([]);
    expect([...journal.rows.values()].map(r => r.stage)).toEqual(['sent']);
    db.close('t');
  });
});

describe('session changes ៖ a write the caller was told failed is never sent later, and an admitted purge survives a sign-out', () => {
  it('a transaction whose only attempt never left the device is rejected on an account change and its row is removed, so the original account never replays it', async () => {
    const journal = makeJournal();
    let failFirst = true;
    const sent: any[] = [];
    const db = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_now') return Date.now();
      if (fn === 'zoe_write_v2') {
        if (failFirst) { failFirst = false; throw new SbNetworkError('auth-unavailable', true); }
        sent.push(args.p_op_id);
        return { ok: true, docs: [], now: Date.now() };
      }
      return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [{ r: 'zoew_barcode_registry', k: 'BC1', v: null, s: 1 }] };
    } }, hooks(), { writeJournal: journal, retryStepsMs: [400] });
    try {
      db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|u1'); await turn(); await turn();
      const tx = verdictOf(db.runTransaction(db.ref('zoew_barcode_registry/BC1'), (cur: any) => cur === null ? true : undefined));
      await turn(); await new Promise(r => setTimeout(r, 20));
      const opIds = [...journal.rows.values()].map(r => r.opId);
      expect(opIds).toHaveLength(1);
      db.resetForSignOut(); db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|u2');
      expect(await tx).toBe('PERMISSION_DENIED');
      expect(journal.list('project|u1', 'zoe:A')).toEqual([]);
      db.resetForSignOut(); db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|u1');
      for (let i = 0; i < 4; i++) { await turn(); await new Promise(r => setTimeout(r, 5)); }
      expect(sent.filter((op) => opIds.includes(op))).toEqual([]);
    } finally { db.close('t'); }
  });
  it('an admitted, unsent purge keeps its purge-queued stage across a sign-out of the same account', async () => {
    const journal = makeJournal();
    const db = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string) => {
      if (fn === 'zoe_now') return Date.now();
      return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
    } }, hooks(), { writeJournal: journal });
    try {
      db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|u1'); await turn(); await turn();
      journal.put({ v: 1, writeProtocol: 3, scope: 'project|u1', topic: 'zoe:A', stage: 'purge-queued', awaitingRecovery: false, opId: 'operation_purgequeued01', sentAfter: 0, queuedAt: Date.now(), ops: [] });
      journal.put({ v: 1, writeProtocol: 2, scope: 'project|u1', topic: 'zoe:A', stage: 'sent', uncertain: true, opId: 'operation_sentcontrol01', sentAfter: Date.now() - 1000, queuedAt: Date.now(), ops: [] });
      (db as any).resetForSignOut();
      expect(Object.fromEntries([...journal.rows.values()].map(r => [r.opId, r.stage]))).toEqual({ operation_purgequeued01: 'purge-queued', operation_sentcontrol01: 'cancelled' });
    } finally { db.close('t'); }
  });
});

it('an admitted purge whose status read fails on the network defers the recovery pass and completes on the next pass (never blocked until reload)', async () => {
  const journal = makeJournal();
  const receipt = { id: 'rel1', releasedBy: 'user', scope: 'project#A', generation: 1, deletedAt: 5, rowBirth: 1, rowCount: 1 };
  const registryPurge = { intent: (ops: any[]) => ops.some(o => o.p[0] === 'zoew_registry_releases') ? { sourceId: 'src1', receipts: [receipt] } : null, hash: async () => 'a'.repeat(64) };
  journal.put({ v: 1, writeProtocol: 3, scope: 'project|user', topic: 'zoe:A', opId: 'purge_row_000000000001', stage: 'purge-queued', awaitingRecovery: false, sentAfter: 0, queuedAt: Date.now(), purgeHash: 'a'.repeat(64), ops: [{ k: 'set', p: ['zoew_registry_releases', 'rel1'], v: { x: 1 } }] });
  let statusFails = 1; const calls: string[] = [];
  const db = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
    calls.push(fn);
    if (fn === 'zoe_now') return Date.now();
    if (fn === 'zoe_purge_status_v1' && statusFails-- > 0) throw new SbNetworkError('rpc timed out');
    if (fn === 'zoe_purge_status_v1' || fn === 'zoe_purge_execute_v1') {
      const ctx = { v: 1, tenant: 'A', actorUid: 'user', opId: args.p_op_id, hash: 'a'.repeat(64), sourceId: 'src1', generation: 1, deletedAt: 5, rowBirth: 1, rowCount: 1 };
      return fn === 'zoe_purge_status_v1' ? { ok: true, seq: 1, now: Date.now(), docs: [], purge: { ...ctx, outcome: 'unknown', proof: 'none' } }
        : { ok: true, seq: 2, now: Date.now(), docs: [], purge: { ...ctx, outcome: 'applied', proof: 'release-set' } };
    }
    if (fn === 'zoe_write_v2') return { ok: true, docs: [], now: Date.now() };
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, hooks(), { writeJournal: journal, registryPurge, retryStepsMs: [20] } as any);
  try {
    db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn(); await turn();
    for (let i = 0; i < 20 && journal.rows.size; i++) { await new Promise(r => setTimeout(r, 30)); await turn(); }
    const next = await verdictOf(db.set(db.ref('zoew_settings/other'), 1));
    expect({ blocked: db.recoveryState().blocked, executed: calls.filter(c => c === 'zoe_purge_execute_v1').length, rows: [...journal.rows.values()].map(r => r.stage), next })
      .toEqual({ blocked: 0, executed: 1, rows: [], next: 'sent' });
  } finally { db.close('t'); }
});

it.each([['queued', false], ['cancelled', true]])('a recovery resend (%s) refused by the data rules is a row-level refusal, not an account-forbidden outage', async (stage, uncertain) => {
  const journal = makeJournal(); const h = hooks(); const listenerErrors: string[] = []; let writes = 0; let seen = 0;
  journal.put({ v: 1, writeProtocol: 2, scope: 'project|user', topic: 'zoe:A', stage, uncertain, opId: 'operation_rulesrefused1', sentAfter: stage === 'queued' ? 0 : Date.now() - 1000,
    ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }] });
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string) => {
    if (fn === 'zoe_now') return Date.now();
    if (fn === 'zoe_write_v2') { writes++; throw new SbRpcError('permission_denied', '42501', 403, ''); }
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [{ r: 'zoew_settings', k: 'exchange_rate', v: 4000, s: 1 }] };
  } }, h, { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 600000 });
  try {
    db.onValue(db.ref('zoew_settings/exchange_rate'), () => { seen++; }, (error: any) => { listenerErrors.push(String(error?.code || error?.message)); });
    db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn(); await turn();
    expect(writes, 'the journal row was really resent').toBe(1);
    expect(h.onForbidden, 'a rules refusal of one replayed row is not an account-level refusal').not.toHaveBeenCalled();
    expect(listenerErrors, 'listeners stay attached').toEqual([]);
    expect(seen, 'data still reaches the view').toBeGreaterThan(0);
  } finally { db.close('test'); }
});

it('control ៖ a tenant forbidden answer during recovery still takes the account-forbidden path', async () => {
  const journal = makeJournal(); const h = hooks(); const listenerErrors: string[] = [];
  journal.put({ v: 1, writeProtocol: 2, scope: 'project|user', topic: 'zoe:A', stage: 'queued', uncertain: false, opId: 'operation_forbiddenacct', sentAfter: 0,
    ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }] });
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string) => {
    if (fn === 'zoe_now') return Date.now();
    if (fn === 'zoe_write_v2') throw new SbRpcError('forbidden', '42501', 403, '');
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, h, { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 600000 });
  try {
    db.onValue(db.ref('zoew_settings/exchange_rate'), () => {}, (error: any) => { listenerErrors.push(String(error?.code || error?.message)); });
    db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn(); await turn();
    expect(h.onForbidden).toHaveBeenCalled();
  } finally { db.close('test'); }
});

it.each([
  ['permission_denied', '42501', 'not-applied'],
  ['quota_exceeded', '22023', 'not-applied'],
  ['forbidden', '42501', 'unknown']
])('a lost reply then a resend refused with %s ➜ %s (the engine checks zoe_ops replay before rules and data)', async (message, code, expected) => {
  vi.useFakeTimers();
  const journal = makeJournal(); const h = hooks(); let writes = 0;
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string) => {
    if (fn === 'zoe_now') return Date.now();
    if (fn === 'zoe_write_v2') {
      writes++;
      if (writes === 1) throw new SbNetworkError('timeout');
      if (writes === 2) throw new SbRpcError(message, code, code === '42501' ? 403 : 400, '');
      return { ok: true, docs: [], now: Date.now() };
    }
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, h, { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 600000 });
  try {
    db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await vi.advanceTimersByTimeAsync(10);
    const outcome = db.set(db.ref('zoew_settings/exchange_rate'), 4200).then(() => 'sent', (error: any) => error.txOutcome || error.code);
    await vi.advanceTimersByTimeAsync(200);
    expect(writes, 'the same op_id was resent once').toBeGreaterThanOrEqual(2);
    expect(await outcome).toBe(expected);
    if (expected === 'not-applied') {
      expect(journal.rows.size, 'a proven not-applied row is dropped').toBe(0);
      expect(db.recoveryState().blocked, 'later writes are not blocked').toBe(0);
      expect(h.onTxOutcomeUnknown).not.toHaveBeenCalled();
    } else {
      expect(db.recoveryState().blocked, 'a state-dependent refusal stays held (control)').toBeGreaterThan(0);
    }
  } finally { db.close('test'); vi.useRealTimers(); }
});
