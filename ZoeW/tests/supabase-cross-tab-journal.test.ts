// S4b · S4 (deep audit 8): every tab of one account + shop shares the Supabase write journal (localStorage). Recovery and
// «លុបការសរសេររង់ចាំ» acted on every row this tab was not writing itself, so a second tab treated the first tab's live
// write as a crashed session: it undid a live price-edit ledger delta (revenue lost the delta), sent a queued write the
// first tab then reported as failed, or discarded a live row. A live journal row is held by its tab through the Web Lock
// `zoew-sb-write:<opId>` (Firebase holds `zoew-write:<opId>` the same way) ➜ another tab never sends, recovers or discards
// it; a row nobody holds (its tab closed) is still recovered.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ledgerCompanionState, ledgerDeltaCompanion, ledgerDeltaIntent, ledgerJournalUpdate, ledgerJournalWitness, ledgerOpRing, ledgerTagged } from '../src/domain/ledger';
import { SbNetworkError, createSupabaseDatabase } from '../src/services/supabase-rtdb';
import { createLocalWriteJournal } from '../src/services/write-journal';

const DAY = '2026-10-14';
const LEDGER = 'zoew_daily_revenue_cod_dod/' + DAY;
const ITEM = 'zoew_scan_history_cod_dod/item1';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const item = (cod: number) => ({ id: 'item1', phone: '012000111', scanDate: DAY, barcodes: [{ code: 'B1', cod, dod: 0, isClosed: false }] });
const ledger = (cod: number, token: string) => ({ codDollar: cod, dodDollar: 0, totalCount: 2, op: token, ops: { [token]: 3 } });

function sharedLocks() {
  const held = new Set<string>();
  const queues = new Map<string, Array<() => void>>();
  const request = (name: string, options: any, callback?: any) => {
    if (typeof options === 'function') { callback = options; options = {}; }
    const run = async () => {
      held.add(name);
      try { return await callback({ name }); } finally {
        held.delete(name);
        const next = queues.get(name)?.shift();
        if (next) next();
      }
    };
    if (!held.has(name) && !queues.get(name)?.length) return run();
    if (options && options.ifAvailable) return Promise.resolve().then(() => callback(null));
    return new Promise((resolve, reject) => {
      const queue = queues.get(name) || [];
      queue.push(() => { run().then(resolve, reject); });
      queues.set(name, queue);
    });
  };
  return { request, held };
}

function sharedStorage() {
  const area = new Map<string, string>();
  return { get length() { return area.size; }, key: (i: number) => [...area.keys()][i] ?? null,
    getItem: (k: string) => area.get(k) ?? null, setItem: (k: string, v: string) => { area.set(k, v); }, removeItem: (k: string) => { area.delete(k); }, area } as any;
}

function fakeServer() {
  let down = false; let loseNextReply = false; let seq = 0;
  const docs = new Map<string, any>(); const done = new Map<string, any>(); const sent: string[] = [];
  const docOf = (k: string) => (docs.has(k) ? docs.get(k) : null);
  const apply = (args: any) => {
    const prior = done.get(args.p_op_id);
    if (prior) return Object.assign({}, prior, { replayed: true, now: Date.now() });
    const results = [];
    for (const op of args.p_ops) {
      const k = op.p[0] + '/' + op.p[1];
      if (op.k === 'cas' && JSON.stringify(op.x === undefined ? null : op.x) !== JSON.stringify(docOf(k))) return { ok: false, conflict: true, now: Date.now(), value: docOf(k) };
      seq++;
      if (op.k === 'cas' || op.p.length === 2) docs.set(k, op.v === undefined ? null : op.v);
      else { const doc = { ...(docOf(k) || {}) }; doc[op.p[2]] = op.v; docs.set(k, doc); }
      results.push({ r: op.p[0], k: op.p[1], v: docs.get(k), s: seq });
    }
    const result = { ok: true, seq, now: Date.now(), docs: results };
    done.set(args.p_op_id, result); return result;
  };
  const rows = () => Array.from(docs.entries()).filter(([, v]) => v !== null).map(([k, v]) => ({ r: k.split('/')[0], k: k.split('/')[1], v, s: seq }));
  const transport = (name: string) => ({
    rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_now') return Date.now();
      if (fn === 'zoe_pull') return { seq, more: false, reset: true, head: seq, tenant: 't1', now: Date.now(), rows: rows() };
      if (fn !== 'zoe_write_v2') throw new Error('unexpected ' + fn);
      expect.soft(args.p_expected_tenant).toBe('t1');
      if (down && name === 'A') throw new SbNetworkError('network');
      sent.push(name + ':' + args.p_op_id);
      const res = apply(args);
      if (loseNextReply && name === 'A') { loseNextReply = false; down = true; throw new SbNetworkError('reply lost'); }
      return res;
    },
    ping: async () => true, subscribe: () => () => {}
  });
  return { transport, sent, setDown: (d: boolean) => { down = d; }, loseReply: () => { loseNextReply = true; },
    set: (k: string, v: any) => { seq++; docs.set(k, v); }, get: (k: string) => docOf(k) };
}

const lab = { locks: sharedLocks(), storage: sharedStorage() };
beforeEach(() => {
  lab.locks = sharedLocks(); lab.storage = sharedStorage();
  vi.stubGlobal('navigator', { onLine: true, locks: { request: lab.locks.request } });
});
afterEach(() => { vi.unstubAllGlobals(); });

async function openTab(server: any, name: string) {
  const db: any = createSupabaseDatabase(server.transport(name), { onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {}, onWriteRecovery: () => {} },
    { retryStepsMs: [5, 10, 20], pollFallbackMs: 600000, rpcTimeoutMs: 1000, writeJournal: createLocalWriteJournal(lab.storage),
      ledgerCompanion: { state: ledgerCompanionState, witness: ledgerJournalWitness, update: ledgerJournalUpdate } });
  db.setTenantTopic('zoe:t1'); db.setAuthed(true, 'scope');
  for (let i = 0; i < 200 && !db.isReady(); i++) await wait(5);
  return db;
}
const journalRows = () => [...lab.storage.area.values()].map((t: string) => { try { return JSON.parse(t); } catch { return null; } }).filter((r: any) => r && r.opId);

it('S4b: a second tab never undoes the first tab\'s live price-edit ledger delta (lost reply, still resending) ➜ item 15 · ledger 45', async () => {
  const server = fakeServer();
  server.set(ITEM, item(10)); server.set(LEDGER, ledger(40, 'op_prior_day'));
  const A = await openTab(server, 'A');
  server.loseReply();
  const token = 'op_mine_token_1';
  const ledgerUpdater: any = Object.assign((v: any) => ledgerTagged({ ...v, codDollar: (v.codDollar || 0) + 5 }, token, ledgerOpRing(v, token)),
    { connectionIntent: { ...ledgerDeltaIntent('daily', DAY, 5, 0, 0, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0)), token } });
  const priceEdit = (async () => {
    await A.runTransaction(A.ref(LEDGER), ledgerUpdater);
    await A.runTransaction(A.ref(ITEM), (it: any) => ({ ...it, barcodes: [{ ...it.barcodes[0], cod: 15 }] }));
  })().then(() => 'A ok', (e: any) => 'A failed ' + e.message);
  for (let i = 0; i < 100 && server.get(LEDGER).codDollar !== 45; i++) await wait(5);
  expect(server.get(LEDGER).codDollar, 'the ledger delta landed, its reply was lost').toBe(45);
  const B = await openTab(server, 'B');
  for (let i = 0; i < 60; i++) await wait(5);
  server.setDown(false);
  const outcome = await priceEdit;
  for (let i = 0; i < 40; i++) await wait(5);
  A.close('t'); B.close('t');
  const undo = Object.keys(server.get(LEDGER).ops || {}).filter((t) => /^op_r/.test(t));
  expect({ outcome, item: server.get(ITEM).barcodes[0].cod, ledger: server.get(LEDGER).codDollar, undo }).toEqual({ outcome: 'A ok', item: 15, ledger: 45, undo: [] });
});

it('S4: a write the first tab still holds is never sent by the second tab\'s recovery, and what the first tab answers is what landed', async () => {
  const server = fakeServer();
  let releasePull: () => void = () => {};
  const pullHeld = new Promise<void>((r) => { releasePull = r; });
  const transportA = server.transport('A');
  const slowA = { ...transportA, rpc: async (fn: string, args: any) => { if (fn === 'zoe_pull') await pullHeld; return transportA.rpc(fn, args); } };
  const A: any = createSupabaseDatabase(slowA, { onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {}, onWriteRecovery: () => {} },
    { retryStepsMs: [5, 10, 20], pollFallbackMs: 600000, writeJournal: createLocalWriteJournal(lab.storage) });
  A.setTenantTopic('zoe:t1'); A.setAuthed(true, 'scope');
  let verdict = 'pending';
  A.set(A.ref('zoew_scan_history_cod_dod/item1/phone'), '012000111').then(() => { verdict = 'sent'; }, (e: any) => { verdict = e.code || e.message; });
  for (let i = 0; i < 20; i++) await wait(1);
  const queued = journalRows().find((r: any) => r.stage === 'unresolved' && r.awaitingRecovery === true);
  expect(queued, 'tab A journals its write before it can send').toBeTruthy();
  const B = await openTab(server, 'B');
  for (let i = 0; i < 40; i++) await wait(5);
  expect(server.sent.filter((s) => s === 'B:' + queued.opId), 'tab B never sends tab A\'s live write').toEqual([]);
  releasePull();
  for (let i = 0; i < 100 && verdict === 'pending'; i++) await wait(5);
  A.close('t'); B.close('t');
  expect({ verdict, landed: server.sent.filter((s) => s.endsWith(queued.opId)) }).toEqual({ verdict: 'sent', landed: ['A:' + queued.opId] });
});

it('«លុបការសរសេររង់ចាំ» in a second tab keeps the first tab\'s live row and drops only rows nobody holds', async () => {
  const server = fakeServer();
  const journal = createLocalWriteJournal(lab.storage);
  journal.put({ v: 1, writeProtocol: 2, scope: 'scope', topic: 'zoe:t1', stage: 'unresolved', uncertain: true, opId: 'operation_dead_tab_0001', sentAfter: Date.now() - 1000, queuedAt: Date.now() - 2000, ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4000 }] });
  journal.put({ v: 1, writeProtocol: 2, scope: 'scope', topic: 'zoe:t1', stage: 'sent', uncertain: true, opId: 'operation_live_tab_0001', sentAfter: Date.now() - 1000, queuedAt: Date.now() - 2000, ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }] });
  let release: () => void = () => {};
  lab.locks.request('zoew-sb-write:operation_live_tab_0001', () => new Promise<void>((r) => { release = r; }));
  const B = await openTab(server, 'B');
  const result = await B.discardPendingWrites();
  B.close('t'); release();
  expect({ result, left: journalRows().map((r: any) => r.opId) })
    .toEqual({ result: { count: 1, paths: ['zoew_settings/exchange_rate'] }, left: ['operation_live_tab_0001'] });
});

it('control: a row its tab left behind (nobody holds it) is still recovered by the next tab', async () => {
  const server = fakeServer();
  createLocalWriteJournal(lab.storage).put({ v: 1, scope: 'scope', topic: 'zoe:t1', stage: 'queued', opId: 'operation_closed_tab_01', sentAfter: 0, queuedAt: Date.now() - 2000,
    ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4200 }] });
  const B = await openTab(server, 'B');
  for (let i = 0; i < 100 && journalRows().length; i++) await wait(5);
  B.close('t');
  expect({ sent: server.sent, left: journalRows().length, value: server.get('zoew_settings/exchange_rate') })
    .toEqual({ sent: ['B:operation_closed_tab_01'], left: 0, value: 4200 });
});
