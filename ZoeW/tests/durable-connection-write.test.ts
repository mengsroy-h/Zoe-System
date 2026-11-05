import { afterEach, expect, it, vi } from 'vitest';
import { createSupabaseDatabase, SbNetworkError, SbIncrement } from '../src/services/supabase-rtdb';

const turn = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
const hooks = () => ({ onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() });
const makeJournal = () => {
  const rows = new Map<string, any>();
  return { rows, put: (row: any) => { rows.set(row.opId, structuredClone(row)); return true; },
    list: (scope: string, topic: string) => [...rows.values()].filter(x => x.scope === scope && x.topic === topic),
    remove: (_scope: string, _topic: string, id: string) => rows.delete(id) };
};
afterEach(() => { vi.useRealTimers(); });

it('an applied increment with a lost reply survives database recreation and uses the same operation ID', async () => {
  vi.useFakeTimers(); const journal = makeJournal(); const ids: string[] = []; const receipts = new Map<string, any>();
  let total = 0; let lose = true;
  const transport = { subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn !== 'zoe_write_v2') return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
    ids.push(args.p_op_id);
    if (!receipts.has(args.p_op_id)) { total += args.p_ops[0].d; receipts.set(args.p_op_id, { ok: true, docs: [], now: Date.now() }); }
    if (lose) { lose = false; throw new SbNetworkError('reply lost'); }
    return { ...receipts.get(args.p_op_id), replayed: true };
  } };
  const first = createSupabaseDatabase(transport, hooks(), { writeJournal: journal });
  first.setTenantTopic('zoe:A'); first.setAuthed(true, 'project|user'); await turn();
  const pending = first.set(first.ref('zoew_daily_revenue_cod_dod/day/codDollar'), new SbIncrement(10)).catch(() => {});
  await turn(); expect(total).toBe(10); first.close('reload'); await vi.advanceTimersByTimeAsync(5000); await pending;
  const second = createSupabaseDatabase(transport, hooks(), { writeJournal: journal });
  second.setTenantTopic('zoe:A'); second.setAuthed(true, 'project|user'); await turn();
  const savedCount = journal.rows.size; second.close('test');
  expect(ids).toHaveLength(2); expect(ids[1]).toBe(ids[0]); expect(total).toBe(10); expect(savedCount).toBe(0);
});

it('persisted A writes are not replayed by a B tenant on the same UID', async () => {
  const journal = makeJournal(); journal.put({ v: 1, writeProtocol: 2, scope: 'project|user', topic: 'zoe:A', stage: 'sent', opId: 'operation_abcdefghijkl', sentAfter: Date.now(), ops: [{ k: 'inc', p: ['zoew_daily_revenue_cod_dod', 'day', 'codDollar'], d: 10 }] });
  const writes: any[] = []; const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write_v2') writes.push(args);
    return { seq: 1, more: false, reset: true, tenant: 'B', now: Date.now(), rows: [] };
  } }, hooks(), { writeJournal: journal });
  db.setTenantTopic('zoe:B'); db.setAuthed(true, 'project|user'); await turn(); db.close('test');
  expect(writes).toEqual([]); expect(journal.rows.size).toBe(1);
});

it('durability storage failure refuses the write before dispatch', async () => {
  const writes: any[] = []; const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe('A'); writes.push(args); return { ok: true, docs: [] }; }
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, hooks(), { writeJournal: { list: () => [], put: () => false, remove: () => {} } });
  db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
  const verdict = await db.set(db.ref('zoew_settings/exchange_rate'), 4100).then(() => 'sent', () => 'refused'); db.close('test');
  expect(verdict).toBe('refused'); expect(writes).toEqual([]);
});

it('an offline intent survives reload and is applied before a new write to the same path', async () => {
  const journal = makeJournal(); let rate = 4000; const values: number[] = [];
  const transport = { subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe('A'); rate = args.p_ops[0].v; values.push(rate); return { ok: true, docs: [], now: Date.now() }; }
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } };
  const first = createSupabaseDatabase(transport, hooks(), { writeJournal: journal }); first.setTenantTopic('zoe:A'); first.setAuthed(true, 'project|user'); await turn(); first.goOffline();
  const old = first.set(first.ref('zoew_settings/exchange_rate'), 4100).catch(() => {}); await turn(); first.close('reload'); await old;
  const persisted = journal.rows.size;
  const second = createSupabaseDatabase(transport, hooks(), { writeJournal: journal }); second.setTenantTopic('zoe:A'); second.setAuthed(true, 'project|user');
  await second.set(second.ref('zoew_settings/exchange_rate'), 4200); second.close('test');
  expect(persisted).toBe(1); expect(values).toEqual([4100, 4200]); expect(rate).toBe(4200); expect(journal.rows.size).toBe(0);
});
it('a sent operation older than the server replay window is retained without dispatch', async () => {
  const journal = makeJournal(); journal.put({ v: 1, writeProtocol: 2, scope: 'project|user', topic: 'zoe:A', stage: 'sent', opId: 'operation_abcdefghijkl', sentAfter: Date.now() - 3 * 86400000, ops: [{ k: 'inc', p: ['zoew_daily_revenue_cod_dod', 'day', 'codDollar'], d: 10 }] });
  const writes: any[] = []; const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write_v2') writes.push(args);
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, hooks(), { writeJournal: journal }); db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
  const state = typeof db.recoveryState === 'function' ? db.recoveryState() : { blocked: 0 }; db.close('test');
  expect(writes).toEqual([]); expect(journal.rows.size).toBe(1); expect(state.blocked).toBe(1);
});

it('a replay conflict after the receipt window elapsed during the request keeps the uncertain intent blocked', async () => {
  const journal = makeJournal(); const now = Date.now();
  journal.put({ v: 1, writeProtocol: 2, scope: 'project|user', topic: 'zoe:A', stage: 'sent', uncertain: true, opId: 'operation_abcdefghijkl', sentAfter: now - 1000,
    ops: [{ k: 'cas', p: ['zoew_daily_revenue_cod_dod', 'day'], x: { codDollar: 10 }, v: { codDollar: 15, op: 'op_current_token' } }] });
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string) => fn === 'zoe_write_v2'
    ? { conflict: true, now: now + 3 * 86400000 }
    : { seq: 1, more: false, reset: true, tenant: 'A', now, rows: [] } }, hooks(), { writeJournal: journal });
  db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
  const state = db.recoveryState(); db.close('test');
  expect(journal.rows.size).toBe(1); expect(state.blocked).toBe(1);
});

it('an unsent replay attempt preserves uncertainty from an earlier dispatched attempt', async () => {
  const journal = makeJournal(); const now = Date.now();
  journal.put({ v: 1, writeProtocol: 2, scope: 'project|user', topic: 'zoe:A', stage: 'sent', uncertain: true, opId: 'operation_abcdefghijkl', sentAfter: now - 1000,
    ops: [{ k: 'inc', p: ['zoew_daily_revenue_cod_dod', 'day', 'codDollar'], d: 10 }] });
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe('A'); const error = new SbNetworkError('token failed before replay'); error.unsent = true; throw error; }
    return { seq: 1, more: false, reset: true, tenant: 'A', now, rows: [] };
  } }, hooks(), { writeJournal: journal });
  db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
  db.close('test'); const row = [...journal.rows.values()][0];
  expect(row.stage).toBe('sent'); expect(row.uncertain).toBe(true); expect(row.sentAfter).toBe(now - 1000);
});
