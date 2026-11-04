import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createSupabaseDatabase, SB_OP_REPLAY_SAFE_MS, SB_REPLAY_REFUSAL_PROOFS, SbNetworkError, SbRpcError, sbReplayRefusalProvesUnsent } from '../src/services/supabase-rtdb';
import { createLocalWriteJournal } from '../src/services/write-journal';
import { firebaseState } from '../src/core/state';
import { commitDailyRevenueDelta, commitLedgerEventStep, commitMonthlyRevenueDelta, ledgerJournalUpdate } from '../src/domain/ledger';

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
  async function lostThen(after: 'refused' | 'close' | 'late-conflict', advisory: boolean, witness?: () => string, value: () => any = () => Date.now(), path = MARK) {
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
      db.runTransaction(db.ref(path), updater).then(() => { verdict = 'sent'; }, (e: any) => { verdict = { code: e.code || e.message, txOutcome: e.txOutcome }; });
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

  it('control (A497) ៖ the same refusal on a CAS of the whole monthly root whose month record carries the ledger token stays unresolved like the daily record', async () => {
    expect(await lostThen('refused', false, undefined, () => ({ '2026-11': { codDollar: 5, dodDollar: 0, totalCount: 1, op: 'op_ledger_token_1', ops: { op_ledger_token_1: 1 } } }), 'zoew_monthly_revenue_cod_dod'))
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

const REPLAY_REFUSALS = [
  { refusal: 'a rules refusal (permission_denied · raised only after the zoe_ops replay lookup)', error: () => new SbRpcError('permission_denied', '42501', 403, 'zoew_settings/exchange_rate'), proven: true },
  { refusal: 'the shop quota (quota_exceeded/bytes · only after the lookup)', error: () => new SbRpcError('quota_exceeded', '22023', 400, 'bytes'), proven: true },
  { refusal: 'an invalid path (invalid_path · only after the lookup)', error: () => new SbRpcError('invalid_path', '22023', 400, ''), proven: true },
  { refusal: 'overlapping paths (invalid_op/overlap · only after the lookup)', error: () => new SbRpcError('invalid_op', '22023', 400, 'overlap'), proven: true },
  { refusal: 'a root that is not an object (invalid_data/root · only after the lookup)', error: () => new SbRpcError('invalid_data', '22023', 400, 'root'), proven: true },
  { refusal: 'a size limit (invalid_data/size · the payload cap is checked before the lookup)', error: () => new SbRpcError('invalid_data', '22023', 400, 'size'), proven: false },
  { refusal: 'an op shape check (invalid_op · also raised before the lookup)', error: () => new SbRpcError('invalid_op', '22023', 400, ''), proven: false },
  { refusal: 'the op id check of zoe_write_v2 (invalid-op-id · before the lookup)', error: () => new SbRpcError('invalid-op-id', '22023', 400, ''), proven: false },
  { refusal: 'a tenant mismatch (PT409 · before the lookup)', error: () => new SbRpcError('tenant-mismatch', 'PT409', 409, ''), proven: false },
  { refusal: 'a 42501 refusal under another text', error: () => new SbRpcError('new row violates rules', '42501', 403, ''), proven: false },
  { refusal: 'a 22023 refusal under an unknown text', error: () => new SbRpcError('invalid_payload', '22023', 400, ''), proven: false }
].map((c) => ({ ...c, live: c.proven ? 'not-applied · row dropped · not blocked' : 'unknown · row unresolved · blocked',
  recovery: c.proven ? 'row dropped · not blocked · the next write sends' : 'row unresolved · blocked · the next write waits' }));

it.each([
  ...REPLAY_REFUSALS,
  { refusal: 'the account forbidden answer', error: () => new SbRpcError('forbidden', '42501', 403, ''), proven: false, live: 'unknown · row unresolved · blocked' }
])('live ៖ a lost reply, then a resend refused with $refusal ➜ $live', async ({ error, proven }) => {
  vi.useFakeTimers();
  const journal = makeJournal(); const h = hooks(); let writes = 0;
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string) => {
    if (fn === 'zoe_now') return Date.now();
    if (fn === 'zoe_write_v2') {
      writes++;
      if (writes === 1) throw new SbNetworkError('timeout');
      if (writes === 2) throw error();
      return { ok: true, docs: [], now: Date.now() };
    }
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, h, { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 600000 });
  try {
    db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await vi.advanceTimersByTimeAsync(10);
    const outcome = db.set(db.ref('zoew_settings/exchange_rate'), 4200).then(() => 'sent', (e: any) => e.txOutcome || e.code);
    await vi.advanceTimersByTimeAsync(200);
    expect({ resent: writes >= 2, outcome: await outcome, rows: [...journal.rows.values()].map((r) => r.stage), blocked: db.recoveryState().blocked,
      unknownReported: h.onTxOutcomeUnknown.mock.calls.length }).toEqual(proven
      ? { resent: true, outcome: 'not-applied', rows: [], blocked: 0, unknownReported: 0 }
      : { resent: true, outcome: 'unknown', rows: ['unresolved'], blocked: 1, unknownReported: 1 });
  } finally { db.close('test'); vi.useRealTimers(); }
});

it.each(REPLAY_REFUSALS)('recovery ៖ an uncertain journal row whose resend is refused with $refusal ➜ $recovery', async ({ error, proven }) => {
  const journal = makeJournal(); const h = hooks(); let writes = 0;
  journal.put({ v: 1, writeProtocol: 2, scope: 'project|user', topic: 'zoe:A', stage: 'cancelled', uncertain: true, opId: 'operation_replayproof01', sentAfter: Date.now() - 1000,
    ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }] });
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string) => {
    if (fn === 'zoe_now') return Date.now();
    if (fn === 'zoe_write_v2') { if (++writes === 1) throw error(); return { ok: true, docs: [], now: Date.now() }; }
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, h, { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 600000 });
  try {
    db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user');
    await vi.waitFor(() => expect(writes).toBe(1));
    await vi.waitFor(() => expect(db.recoveryState().recovering).toBe(false));
    const recovered = { rows: [...journal.rows.values()].map((r) => r.stage), blocked: db.recoveryState().blocked };
    const later = await verdictOf(db.set(db.ref('zoew_settings/exchange_rate'), 4200));
    expect({ ...recovered, later, forbidden: h.onForbidden.mock.calls.length }).toEqual(proven
      ? { rows: [], blocked: 0, later: 'sent', forbidden: 0 }
      : { rows: ['unresolved'], blocked: 1, later: 'WRITE_RECOVERY_PENDING', forbidden: 0 });
  } finally { db.close('test'); }
});

describe('replay refusal proof ↔ the live write engine (A521) ៖ only an error the SQL raises after its zoe_ops replay lookup proves a lost-reply op never applied', () => {
  const dir = path.resolve(__dirname, '../../supabase/migrations');
  const sql = fs.readdirSync(dir).filter((n) => n.endsWith('.sql')).sort().map((n) => fs.readFileSync(path.join(dir, n), 'utf8')).join('\n');
  const body = (name: string) => {
    let start = -1;
    for (const m of sql.matchAll(new RegExp('create (?:or replace )?function ' + name.replace(/\./g, '\\.') + '\\(', 'gi'))) start = m.index!;
    if (start < 0) return null;
    const tag = /\bas\s+(\$[A-Za-z_]*\$)/.exec(sql.slice(start))!;
    const open = start + tag.index + tag[0].length;
    return sql.slice(open, sql.indexOf(tag[1], open));
  };
  const CHAIN = ['private.zoe_write_v2', 'private.zoe_apply', 'private.zoe_apply_engine_v1'];
  type Raise = { message: string, code: string, detail: string | null };
  const raisesOf = (text: string, seen = new Set<string>()): Raise[] => {
    const own = [...text.matchAll(/raise exception '([^']+)' using errcode = '([0-9A-Z]{5})'(?:\s*,\s*detail = ('([^']*)'|[^;]+))?/g)]
      .map((m) => ({ message: m[1], code: m[2], detail: m[3] === undefined ? '' : m[4] !== undefined ? m[4] : null }));
    const called = [...text.matchAll(/\bprivate\.(\w+)\(/g)].map((m) => 'private.' + m[1]).filter((n) => !CHAIN.includes(n) && !seen.has(n));
    return own.concat(called.flatMap((n) => { seen.add(n); const b = body(n); return b ? raisesOf(b, seen) : []; }));
  };
  const engine = body('private.zoe_apply_engine_v1') || '';
  const lookup = engine.search(/select o\.result into prior from public\.zoe_ops o where o\.tenant_id = tenant and o\.op_id = p_op_id;\s*if found then\s*return prior/);
  const tenantInsertTriggers = [...sql.matchAll(/create (?:or replace )?trigger \w+\s+(?:before|after)\s+([\s\S]*?)\s+on public\.zoe_tenant_state\b[\s\S]*?execute (?:function|procedure) private\.(\w+)\(/gi)]
    .filter((m) => /\binsert\b/i.test(m[1])).map((m) => body('private.' + m[2]) || '');
  const before = [body('private.zoe_write_v2') || '', body('private.zoe_apply') || '', engine.slice(0, Math.max(lookup, 0)), ...tenantInsertTriggers].flatMap((t) => raisesOf(t));
  const after = raisesOf(engine.slice(Math.max(lookup, 0)));
  const sample = (r: Raise) => new SbRpcError(r.message, r.code, r.code === '42501' ? 403 : 400, r.detail === null ? 'zoew_settings/exchange_rate' : r.detail);
  const covers = (proof: any, r: Raise) => proof.code === r.code && proof.message === r.message && (proof.detail === null || r.detail === null || proof.detail === r.detail);

  it('the client path ends in the engine, whose replay lookup runs under the tenant lock', () => {
    expect(body('private.zoe_write_v2')).toContain('private.zoe_apply(');
    expect(body('private.zoe_apply')).toContain('private.zoe_apply_engine_v1(');
    expect(lookup, 'the zoe_ops replay lookup that returns the prior result').toBeGreaterThan(0);
    expect(engine.slice(0, lookup)).toMatch(/from public\.zoe_tenant_state s where s\.tenant_id = tenant for update;\s*$/);
    expect(before.length, 'raises found before the lookup').toBeGreaterThanOrEqual(8);
    expect(after.length, 'raises found after the lookup').toBeGreaterThanOrEqual(8);
  });

  it('no error the SQL can raise before the replay lookup is read as proof (the engine may have changed since the first send)', () => {
    const misread = before.filter((r) => sbReplayRefusalProvesUnsent(sample(r)) || sbReplayRefusalProvesUnsent(new SbRpcError(r.message, r.code, 400, '')));
    expect(misread).toEqual([]);
  });

  it('every proof the client accepts is raised after the lookup and never before it', () => {
    expect(SB_REPLAY_REFUSAL_PROOFS.map((p: any) => p.message)).toEqual(expect.arrayContaining(['permission_denied', 'quota_exceeded']));
    for (const proof of SB_REPLAY_REFUSAL_PROOFS) {
      expect(after.some((r) => covers(proof, r)), proof.message + ' is raised after the lookup').toBe(true);
      expect(before.filter((r) => covers(proof, r)), proof.message + ' is never raised before the lookup').toEqual([]);
      expect(sbReplayRefusalProvesUnsent(new SbRpcError(proof.message, proof.code, 400, proof.detail ?? 'zoew_settings/exchange_rate'))).toBe(true);
    }
    const accepted = [...before, ...after].filter((r) => sbReplayRefusalProvesUnsent(sample(r)));
    expect(accepted.every((r) => SB_REPLAY_REFUSAL_PROOFS.some((proof: any) => covers(proof, r)))).toBe(true);
  });
});

describe('ledger rows (A497) ៖ a CAS of the whole monthly root decides exactly like the daily record ⛔ a ledger row is never dropped as plain CAS («Durable writes» · A375 · A483)', () => {
  const DAY = '2026-11-03', MONTH = '2026-11', TRASH = 'trash_ledgerhold01', AT = 1793750400000;
  const SCOPE = 'project|user', TOPIC = 'zoe:A';
  const SEED = [
    { r: 'zoew_daily_revenue_cod_dod', k: DAY, v: { codDollar: 40, dodDollar: 2, totalCount: 4 }, s: 1 },
    { r: 'zoew_monthly_revenue_cod_dod', k: MONTH, v: { codDollar: 400, dodDollar: 20, totalCount: 40 }, s: 1 }
  ];
  const pull = () => ({ seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: structuredClone(SEED) });
  const KEYS = ['fb', 'db', 'dbRefDailyRevenue', 'dbRefMonthlyRevenue'];
  let saved: any = {};
  beforeEach(() => { saved = Object.fromEntries(KEYS.map((key) => [key, (firebaseState as any)[key]])); });
  afterEach(() => { Object.assign(firebaseState, saved); vi.useRealTimers(); });
  const attach = (db: any) => Object.assign(firebaseState, {
    fb: { __supabase: true, ref: (d: any, p: string) => d.ref(p), runTransaction: (r: any, fn: any) => r._db.runTransaction(r, fn) },
    db, dbRefDailyRevenue: db.ref('zoew_daily_revenue_cod_dod'), dbRefMonthlyRevenue: db.ref('zoew_monthly_revenue_cod_dod') });
  const amounts = { cod: 5, dod: 0, count: 1 };
  const writers: Record<string, () => Promise<any>> = {
    'daily revenue delta': () => commitDailyRevenueDelta(DAY, -5, 0, -1, null, true),
    'monthly revenue delta': () => commitMonthlyRevenueDelta(MONTH, -5, 0, -1, null, true),
    'daily keyed cleanup deduction': () => commitLedgerEventStep('daily', DAY, TRASH, AT, 'deduct', amounts, null),
    'monthly keyed cleanup deduction': () => commitLedgerEventStep('monthly', DAY, TRASH, AT, 'deduct', amounts, null),
    'plain CAS (registry claim)': () => firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, 'zoew_barcode_registry/BC1'), (v: any) => (v === null ? true : undefined))
  };
  const ledgerWriters = Object.keys(writers).filter((name) => !name.startsWith('plain'));
  const refusals: Record<string, () => Error> = {
    'PT401 session revoked': () => new SbRpcError('session-revoked', 'PT401', 401, ''),
    '42501 membership removed': () => new SbRpcError('forbidden', '42501', 403, '')
  };
  const unknownVerdict = (writer: string) => (writer.includes('cleanup') ? { state: 'unknown' }
    : writer.startsWith('plain') ? { code: 'DISCONNECT', txOutcome: 'unknown' } : { cod: 0, dod: 0, count: 0, unknown: true });

  async function lostThenRefused(writer: string, refusal: string) {
    vi.useFakeTimers();
    const journal = makeJournal(); const hook = hooks(); const sent: string[] = [];
    const db: any = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_now') return Date.now();
      if (fn === 'zoe_write_v2') {
        expect.soft(args.p_expected_tenant).toBe('A');
        sent.push(args.p_op_id);
        if (sent.length === 1) throw new SbNetworkError('rpc timed out');
        throw refusals[refusal]();
      }
      return pull();
    } }, hook, { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 600000 });
    let verdict: any = 'pending';
    try {
      db.setTenantTopic(TOPIC); db.setAuthed(true, SCOPE); await vi.advanceTimersByTimeAsync(10);
      attach(db);
      writers[writer]().then((v: any) => { verdict = v; }, (e: any) => { verdict = { code: e.code || e.message, txOutcome: e.txOutcome }; });
      await vi.advanceTimersByTimeAsync(200);
    } finally { db.close('test'); vi.useRealTimers(); }
    const rows = [...journal.rows.values()];
    const resent: string[] = [];
    const db2: any = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_now') return Date.now();
      if (fn === 'zoe_write_v2') { resent.push(args.p_op_id); return { ok: true, docs: [], now: Date.now() }; }
      return pull();
    } }, hooks(), { writeJournal: journal });
    db2.setTenantTopic(TOPIC); db2.setAuthed(true, SCOPE); await turn(); await turn();
    const later = await verdictOf(db2.set(db2.ref('zoew_settings/exchange_rate'), 4200));
    const blocked = db2.recoveryState().blocked; db2.close('test');
    return { rows, out: { sameOpResent: sent.length >= 2 && new Set(sent).size === 1, verdict, journaled: rows.map((r) => r.stage),
      unknownReported: hook.onTxOutcomeUnknown.mock.calls.length, replayed: resent.filter((op) => sent.includes(op)), later, blocked,
      kept: [...journal.rows.values()].map((r) => r.stage) } };
  }

  it.each(ledgerWriters.flatMap((writer) => Object.keys(refusals).map((refusal) => [writer, refusal])))('real %s ៖ lost reply, then %s ➜ unknown · the row stays unresolved · the next session is blocked and never replays it', async (writer, refusal) => {
    const { out } = await lostThenRefused(writer, refusal);
    expect(out).toEqual({ sameOpResent: true, verdict: unknownVerdict(writer), journaled: ['unresolved'], unknownReported: 1, replayed: [],
      later: 'WRITE_RECOVERY_PENDING', blocked: 1, kept: ['unresolved'] });
  });

  it.each(Object.keys(refusals))('control ៖ a true plain CAS (no ledger token · no ledger intent) with the same lost reply and %s is still dropped (A375)', async (refusal) => {
    const { out } = await lostThenRefused('plain CAS (registry claim)', refusal);
    expect(out).toEqual({ sameOpResent: true, verdict: unknownVerdict('plain'), journaled: [], unknownReported: 1, replayed: [], later: 'sent', blocked: 0, kept: [] });
  });

  it.each(ledgerWriters)('real %s ៖ its journal row keeps the ledger intent as Firebase does (kind · bucket · key · token, no companion)', async (writer) => {
    const { rows } = await lostThenRefused(writer, 'PT401 session revoked');
    const monthly = writer.startsWith('monthly');
    expect(rows).toHaveLength(1);
    expect(rows[0].intent).toMatchObject({ kind: writer.includes('cleanup') ? 'ledger-event' : 'revenue-delta', bucket: monthly ? 'monthly' : 'daily',
      key: monthly ? MONTH : DAY, token: expect.stringMatching(/^op_/) });
    expect(rows[0].intent.companion).toBeUndefined();
  });

  const casOf = (bucket: 'daily' | 'monthly') => {
    const base: any = bucket === 'daily' ? structuredClone(SEED[0].v) : { [MONTH]: structuredClone(SEED[1].v) };
    const intent = { kind: 'revenue-delta', bucket, key: bucket === 'daily' ? DAY : MONTH, cod: -5, dod: 0, count: -1, token: 'op_ledgerhold_' + bucket };
    return [{ k: 'cas', p: bucket === 'daily' ? ['zoew_daily_revenue_cod_dod', DAY] : ['zoew_monthly_revenue_cod_dod'], x: base,
      v: ledgerJournalUpdate(structuredClone(base), intent) }];
  };
  const now = Date.now();
  const shapes: Record<string, any> = {
    'v2 row sent past the replay window': { writeProtocol: 2, stage: 'sent', uncertain: true, sentAfter: now - 3 * 86400000 },
    'v2 row left by a sign-out past the replay window': { writeProtocol: 2, stage: 'cancelled', uncertain: true, sentAfter: now - 3 * 86400000 },
    'v2 row left unresolved': { writeProtocol: 2, stage: 'unresolved', uncertain: true, sentAfter: now - 1000 },
    'legacy row (no writeProtocol) sent': { stage: 'sent', uncertain: true, sentAfter: now - 1000 },
    'legacy row (no writeProtocol) sent past the replay window': { stage: 'sent', uncertain: true, sentAfter: now - 3 * 86400000 }
  };
  const bootWith = async (row: any, reply = (): any => ({ ok: true, docs: [], now: Date.now() })) => {
    const journal = makeJournal(); journal.put(row);
    const writes: string[] = [];
    const db: any = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_now') return Date.now();
      if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe('A'); writes.push(args.p_op_id); return reply(); }
      return pull();
    } }, hooks(), { writeJournal: journal });
    db.setTenantTopic(TOPIC); db.setAuthed(true, SCOPE); await turn(); await turn();
    const later = await verdictOf(db.set(db.ref('zoew_settings/other'), 1));
    const out = { replayed: writes.filter((op) => op === row.opId).length, blocked: db.recoveryState().blocked, journal: [...journal.rows.values()].map((r) => r.stage), later };
    db.close('t');
    return out;
  };

  it.each(Object.keys(shapes).flatMap((shape) => ['daily', 'monthly'].map((bucket) => [shape, bucket])))('boot ៖ %s (%s ledger CAS without intent, as an older client wrote it) ➜ held, never dropped and never replayed', async (shape, bucket) => {
    const row = { v: 1, scope: SCOPE, topic: TOPIC, opId: 'operation_ledgerhold01', queuedAt: now - 5000, ops: casOf(bucket as any), ...shapes[shape] };
    expect(await bootWith(row)).toEqual({ replayed: 0, blocked: 1, journal: [row.stage], later: 'WRITE_RECOVERY_PENDING' });
  });

  it.each(['daily', 'monthly'])('boot ៖ a %s ledger row replayed inside the window whose conflict reply lands past it is no proof ➜ held', async (bucket) => {
    const row = { v: 1, writeProtocol: 2, scope: SCOPE, topic: TOPIC, opId: 'operation_ledgerhold02', queuedAt: now - 5000, ops: casOf(bucket as any),
      stage: 'sent', uncertain: true, sentAfter: Date.now() - SB_OP_REPLAY_SAFE_MS + 60000 };
    expect(await bootWith(row, () => ({ ok: false, conflict: true, now: Date.now() + 120000, value: null })))
      .toEqual({ replayed: 1, blocked: 1, journal: ['sent'], later: 'WRITE_RECOVERY_PENDING' });
  });

  it.each(['daily', 'monthly'])('control ៖ a %s ledger row carrying its non-companion intent, sent inside the window, still replays once with its own op_id and settles', async (bucket) => {
    const ops = casOf(bucket as any);
    const row = { v: 1, writeProtocol: 2, scope: SCOPE, topic: TOPIC, opId: 'operation_ledgerhold04', queuedAt: now - 5000, ops,
      intent: { kind: 'revenue-delta', bucket, key: bucket === 'daily' ? DAY : MONTH, cod: -5, dod: 0, count: -1, token: 'op_ledgerhold_' + bucket, keyed: false },
      stage: 'sent', uncertain: true, sentAfter: Date.now() - 1000 };
    expect(await bootWith(row)).toEqual({ replayed: 1, blocked: 0, journal: [], later: 'sent' });
  });

  it('control ៖ a true plain CAS replayed inside the window whose conflict reply lands past it is still dropped (A375)', async () => {
    const row = { v: 1, writeProtocol: 2, scope: SCOPE, topic: TOPIC, opId: 'operation_ledgerhold03', queuedAt: now - 5000,
      ops: [{ k: 'cas', p: ['zoew_settings', 'exchange_rate'], x: 4000, v: 4100 }], stage: 'sent', uncertain: true, sentAfter: Date.now() - SB_OP_REPLAY_SAFE_MS + 60000 };
    expect(await bootWith(row, () => ({ ok: false, conflict: true, now: Date.now() + 120000, value: 4050 })))
      .toEqual({ replayed: 1, blocked: 0, journal: [], later: 'sent' });
  });
});

describe('live ledger transaction ៖ a resend whose conflict lands past the replay window and whose witness settles the outcome removes its journal row (A498) ⛔ a known outcome never blocks the next session', () => {
  const DAY = '2026-11-04', MONTH = '2026-11', TRASH = 'trash_ledgerfollow1', AT = 1793836800000;
  const SCOPE = 'project|user', TOPIC = 'zoe:A';
  const PRIOR = { codDollar: 40, dodDollar: 2, totalCount: 4, op: 'op_seed_prior01', ops: { op_seed_prior01: 1 } };
  const FOREIGN = { codDollar: 41, dodDollar: 2, totalCount: 5, op: 'op_seed_foreign1', ops: { op_seed_prior01: 1, op_seed_foreign1: 2 } };
  const LATER = 3 * 86400000;
  const KEYS = ['fb', 'db', 'dbRefDailyRevenue', 'dbRefMonthlyRevenue'];
  let saved: any = {};
  beforeEach(() => { saved = Object.fromEntries(KEYS.map((key) => [key, (firebaseState as any)[key]])); });
  afterEach(() => { Object.assign(firebaseState, saved); vi.useRealTimers(); });
  const seed = () => [
    { r: 'zoew_daily_revenue_cod_dod', k: DAY, v: structuredClone(PRIOR), s: 1 },
    { r: 'zoew_monthly_revenue_cod_dod', k: MONTH, v: structuredClone(PRIOR), s: 1 }
  ];
  const writers: Record<string, () => Promise<any>> = {
    'daily revenue delta': () => commitDailyRevenueDelta(DAY, -5, 0, -1, null, true),
    'monthly revenue delta': () => commitMonthlyRevenueDelta(MONTH, -5, 0, -1, null, true),
    'daily keyed cleanup deduction': () => commitLedgerEventStep('daily', DAY, TRASH, AT, 'deduct', { cod: 5, dod: 0, count: 1 }, null),
    'monthly keyed cleanup deduction': () => commitLedgerEventStep('monthly', DAY, TRASH, AT, 'deduct', { cod: 5, dod: 0, count: 1 }, null)
  };
  const valueFor = (writer: string, record: any) => (writer.startsWith('monthly') ? { [MONTH]: record } : record);

  async function lostThenLateConflict(writer: string, decided: 'applied' | 'not-applied' | 'undecided') {
    vi.useFakeTimers();
    const journal = makeJournal(); const hook = hooks(); const sent: any[] = [];
    const db: any = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_now') return Date.now();
      if (fn === 'zoe_write_v2') {
        expect.soft(args.p_expected_tenant).toBe('A');
        sent.push(structuredClone(args));
        if (sent.length === 1) throw new SbNetworkError('rpc timed out');
        if (args.p_op_id !== sent[0].p_op_id) return { ok: true, docs: [], now: Date.now() + LATER };
        const mine = args.p_ops[0].v;
        const value = decided === 'applied' ? mine : decided === 'not-applied' ? valueFor(writer, structuredClone(FOREIGN))
          : valueFor(writer, { codDollar: 41, dodDollar: 2, totalCount: 5, op: 'op_seed_unrelated', ops: { op_seed_unrelated: 9 } });
        return { ok: false, conflict: true, now: Date.now() + LATER, value };
      }
      return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: seed() };
    } }, hook, { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 600000 });
    let verdict: any = 'pending';
    try {
      db.setTenantTopic(TOPIC); db.setAuthed(true, SCOPE); await vi.advanceTimersByTimeAsync(10);
      Object.assign(firebaseState, {
        fb: { __supabase: true, ref: (d: any, p: string) => d.ref(p), runTransaction: (r: any, fn: any) => r._db.runTransaction(r, fn) },
        db, dbRefDailyRevenue: db.ref('zoew_daily_revenue_cod_dod'), dbRefMonthlyRevenue: db.ref('zoew_monthly_revenue_cod_dod') });
      writers[writer]().then((v: any) => { verdict = v; }, (e: any) => { verdict = { code: e.code || e.message, txOutcome: e.txOutcome }; });
      await vi.advanceTimersByTimeAsync(200);
    } finally { db.close('test'); vi.useRealTimers(); }
    const left = [...journal.rows.values()].map((r) => ({ opId: r.opId, stage: r.stage }));
    const resent: string[] = [];
    const db2: any = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_now') return Date.now() + LATER;
      if (fn === 'zoe_write_v2') { resent.push(args.p_op_id); return { ok: true, docs: [], now: Date.now() + LATER }; }
      return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now() + LATER, rows: seed() };
    } }, hooks(), { writeJournal: journal });
    db2.setTenantTopic(TOPIC); db2.setAuthed(true, SCOPE); await turn(); await turn();
    const later = await verdictOf(db2.set(db2.ref('zoew_settings/exchange_rate'), 4200));
    const blocked = db2.recoveryState().blocked; db2.close('test');
    return { verdict, sends: sent.map((s) => s.p_op_id === sent[0].p_op_id ? 'first' : 'new'), unknownReported: hook.onTxOutcomeUnknown.mock.calls.length,
      left: left.map((r) => r.stage), replayed: resent.filter((op) => sent.some((s) => s.p_op_id === op)), later, blocked };
  }

  const settledVerdict = (writer: string) => (writer.includes('cleanup') ? expect.objectContaining({ state: 'applied' }) : { cod: -5, dod: 0, count: -1 });

  it.each(Object.keys(writers))('real %s ៖ lost reply, then a resend conflict past the window whose witness proves it applied ➜ applied once · its row is removed · the next session writes', async (writer) => {
    expect(await lostThenLateConflict(writer, 'applied')).toEqual({ verdict: settledVerdict(writer), sends: ['first', 'first'], unknownReported: 0,
      left: [], replayed: [], later: 'sent', blocked: 0 });
  });

  it.each(Object.keys(writers))('real %s ៖ lost reply, then a resend conflict past the window whose witness proves it never landed ➜ resent once under a new op_id · the old row is removed · the next session writes', async (writer) => {
    expect(await lostThenLateConflict(writer, 'not-applied')).toEqual({ verdict: settledVerdict(writer), sends: ['first', 'first', 'new'], unknownReported: 0,
      left: [], replayed: [], later: 'sent', blocked: 0 });
  });

  it.each(Object.keys(writers))('control ៖ real %s whose late conflict no witness decides ➜ unknown · the row stays and the next session is blocked (never replayed)', async (writer) => {
    const out = await lostThenLateConflict(writer, 'undecided');
    expect(out).toEqual({ verdict: writer.includes('cleanup') ? { state: 'unknown' } : { cod: 0, dod: 0, count: 0, unknown: true }, sends: ['first', 'first'],
      unknownReported: 1, left: ['sent'], replayed: [], later: 'WRITE_RECOVERY_PENDING', blocked: 1 });
  });
});
