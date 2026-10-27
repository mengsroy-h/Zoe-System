// S1 · S1b (deep audit 8): a device frozen in the background or offline for more than a day sends its first write with a
// server-time bound (`sentAfter`) that is a day old. A first-send CAS conflict is definitive (the op never applied) but its
// journal row stayed `sent` and blocked every write after the next reload; a `set()` whose reply was lost seconds after the
// send looked 30 hours old and was held as `unknown` (money alarm + blocked). A first-send conflict removes its row, and a
// first send refreshes the server time when the last one seen is older than `SB_SERVER_NOW_FRESH_MS` (device elapsed time).
import { expect, it, vi } from 'vitest';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';

const turn = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const hooks = () => ({ onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn(), onWriteRecovery: vi.fn() });
const makeJournal = () => {
  const rows = new Map<string, any>();
  return { rows, put: (row: any) => { rows.set(row.opId, structuredClone(row)); return true; },
    list: (scope: string, topic: string) => [...rows.values()].filter(x => x.scope === scope && x.topic === topic),
    remove: (_s: string, _t: string, id: string) => rows.delete(id) };
};
const H = 3600 * 1000;
const T0 = 1_800_000_000_000;

it('S1: a definitive first-send CAS conflict with a >24h-old serverNowSeen leaves a journal row that blocks every write after reload', async () => {
  const journal = makeJournal();
  let serverNow = T0;
  let writes = 0;
  const transport = { subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write') {
      writes++;
      if (writes === 1) return { ok: false, conflict: true, now: serverNow, value: { n: 2 } };
      return { ok: true, seq: 3, now: serverNow, docs: [{ r: 'zoew_scan_history_cod_dod', k: 'item1', v: args.p_ops[0].v, s: 3 }] };
    }
    if (fn === 'zoe_now') return serverNow;
    return { seq: 1, more: false, reset: true, tenant: 'A', head: 1, now: serverNow, rows: [{ r: 'zoew_scan_history_cod_dod', k: 'item1', v: { n: 1 }, s: 1 }] };
  } };
  const db: any = createSupabaseDatabase(transport, hooks(), { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 10 * 24 * H });
  db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
  expect(db.isReady()).toBe(true);
  // device suspended / offline for 30 hours: no server reply seen meanwhile
  serverNow = T0 + 30 * H;
  const res = await db.runTransaction(db.ref('zoew_scan_history_cod_dod/item1'), (cur: any) => ({ n: ((cur && cur.n) || 0) + 1 }));
  db.close('test');
  const leftover = [...journal.rows.values()].map(r => ({ stage: r.stage, uncertain: !!r.uncertain }));
  // a fresh session (reload / PTR) with the same journal
  const writes2: any[] = [];
  const db2: any = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write') { writes2.push(args); return { ok: true, seq: 9, now: serverNow, docs: [] }; }
    if (fn === 'zoe_now') return serverNow;
    return { seq: 3, more: false, reset: true, tenant: 'A', head: 3, now: serverNow, rows: [] };
  } }, hooks(), { writeJournal: journal });
  db2.setTenantTopic('zoe:A'); db2.setAuthed(true, 'project|user'); await turn();
  const later = await db2.set(db2.ref('zoew_settings/exchange_rate'), 4200).then(() => 'sent', (e: any) => e.code || e.message);
  const blocked = db2.recoveryState().blocked; db2.close('test');
    // desired behaviour: a definitive conflict on the first send leaves nothing behind
  expect({ committed: res.committed, leftover, later, blocked }).toEqual({ committed: true, leftover: [], later: 'sent', blocked: 0 });
});

it('S1b: a set() sent with a >24h-old serverNowSeen whose reply is lost is held as unknown (money alarm + blocked) although it was sent seconds ago', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(T0);
  const journal = makeJournal();
  const hook = hooks();
  let serverNow = T0;
  let writes = 0;
  const landed: string[] = [];
  const transport = { subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
    if (fn === 'zoe_write') {
      writes++;
      if (writes === 1) { landed.push(args.p_op_id); throw new (await import('../src/services/supabase-rtdb')).SbNetworkError('rpc timed out'); }
      return { ok: true, seq: 3, now: serverNow, replayed: landed.includes(args.p_op_id), docs: [] };
    }
    if (fn === 'zoe_now') return serverNow;
    return { seq: 1, more: false, reset: true, tenant: 'A', head: 1, now: serverNow, rows: [] };
  } };
  const db: any = createSupabaseDatabase(transport, hook, { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 10 * 24 * H });
  try {
    db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
    serverNow = T0 + 30 * H; // app resumed after 30h in background, no offline event
    vi.setSystemTime(serverNow);
    let verdict: any = 'pending';
    db.set(db.ref('zoew_settings/exchange_rate'), 4200).then(() => { verdict = 'sent'; }, (e: any) => { verdict = { code: e.code, txOutcome: e.txOutcome }; });
    await vi.advanceTimersByTimeAsync(200);
    const out = { verdict, writes, unknownReported: hook.onTxOutcomeUnknown.mock.calls.length, blocked: db.recoveryState().blocked, rows: [...journal.rows.values()].map(r => r.stage) };
        // desired: the op was sent seconds ago (server time), resend with the same op_id is safe ➜ 'sent'
    expect(out).toMatchObject({ verdict: 'sent', unknownReported: 0, blocked: 0 });
  } finally { db.close('test'); vi.useRealTimers(); }
});
