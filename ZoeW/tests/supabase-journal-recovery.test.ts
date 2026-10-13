import { afterEach, expect, it, vi } from 'vitest';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';
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

it('an uncertain write left by a sign-out is replayed by the same account and shop with its original op_id, then the session writes normally', async () => {
  const journal = makeJournal(); const seen: string[] = [];
  journal.put({ v: 1, scope: 'project|user', topic: 'zoe:A', stage: 'cancelled', uncertain: true, opId: 'operation_abcdefghijkl', sentAfter: Date.now() - 1000, ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }] });
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write') { seen.push(args.p_op_id); return { ok: true, docs: [], now: Date.now(), replayed: seen.length === 1 }; }
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, hooks(), { writeJournal: journal });
  db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
  const verdict = await verdictOf(db.set(db.ref('zoew_settings/exchange_rate'), 4200));
  const state = db.recoveryState(); db.close('test');
  expect({ verdict, first: seen[0], writes: seen.length, blocked: state.blocked, rows: journal.rows.size }).toEqual({ verdict: 'sent', first: 'operation_abcdefghijkl', writes: 2, blocked: 0, rows: 0 });
});

it('an uncertain sign-out write older than the server replay window stays blocked (control)', async () => {
  const journal = makeJournal();
  journal.put({ v: 1, scope: 'project|user', topic: 'zoe:A', stage: 'cancelled', uncertain: true, opId: 'operation_abcdefghijkl', sentAfter: Date.now() - 3 * 86400000, ops: [{ k: 'inc', p: ['zoew_daily_revenue_cod_dod', 'day', 'codDollar'], d: 10 }] });
  const writes: any[] = [];
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write') writes.push(args);
    return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
  } }, hooks(), { writeJournal: journal });
  db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
  const state = db.recoveryState(); db.close('test');
  expect({ writes: writes.length, blocked: state.blocked, rows: journal.rows.size }).toEqual({ writes: 0, blocked: 1, rows: 1 });
});

it('a write refused while recovery is blocked leaves no queued journal row behind (no phantom replay)', async () => {
  const journal = makeJournal();
  journal.put({ v: 1, scope: 'project|user', topic: 'zoe:A', stage: 'unresolved', opId: 'operation_abcdefghijkl', sentAfter: Date.now() - 1000, ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }] });
  const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string) => {
    if (fn === 'zoe_write') return { ok: true, docs: [], now: Date.now() };
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
