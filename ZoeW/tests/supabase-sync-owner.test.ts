import { afterEach, describe, it, expect, vi } from 'vitest';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';
const HIST = 'zoew_scan_history_cod_dod';
const turn = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = <T>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
afterEach(() => { vi.restoreAllMocks(); });
describe('pull sync owns tenant and authenticated scope across awaits', () => {
  for (const mode of ['tenant', 'scope']) {
    it('pending A pull cannot publish in B after ' + mode + ' change', async () => {
      const replyA = deferred<any>(), replyB = deferred<any>();
      let calls = 0;
      const hooks = { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() };
      const db = createSupabaseDatabase({ rpc: async () => (++calls === 1 ? replyA.promise : replyB.promise), subscribe: () => () => {} }, hooks);
      db.setTenantTopic('zoe:A'); db.setAuthed(true, 'scope-A');
      const seen: any[] = [];
      db.onValue(db.ref(HIST), (snap: any) => seen.push(snap.val()));
      await turn(); expect(calls).toBe(1);
      if (mode === 'tenant') db.setTenantTopic('zoe:B'); else db.setAuthed(true, 'scope-B');
      replyA.resolve({ seq: 90, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [{ r: HIST, k: 'private-A', v: { shop: 'A' }, s: 90 }] });
      await turn();
      const leaked = JSON.stringify(seen).includes('private-A') || HIST + '/private-A' in db.snapshotState().docs;
      const callsBeforeB = calls;
      replyB.resolve({ seq: 1, more: false, reset: true, tenant: 'B', now: Date.now(), rows: [{ r: HIST, k: 'private-B', v: { shop: 'B' }, s: 1 }] });
      await turn();
      const result = db.snapshotState(); db.close('test');
      expect(leaked).toBe(false);
      expect(callsBeforeB).toBeGreaterThan(1);
      expect(result.docs[HIST + '/private-B'].v).toEqual({ shop: 'B' });
      expect(result.docs[HIST + '/private-A']).toBeUndefined();
    });
  }
  it('an offline A write cannot be sent to B when only the tenant changes', async () => {
    let tenant = 'A';
    const writes: any[] = [];
    const db = createSupabaseDatabase({ rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe(tenant); writes.push({ tenant, ops: args.p_ops }); return { ok: true, docs: [] }; }
      return { seq: 1, more: false, reset: true, tenant, now: Date.now(), rows: [] };
    }, subscribe: () => () => {} }, { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() });
    db.setTenantTopic('zoe:A'); db.setAuthed(true, 'same-user'); await turn(); db.goOffline();
    const write = db.set(db.ref(HIST + '/private-A'), { shop: 'A' }).then(() => 'committed', () => 'refused');
    await turn(); tenant = 'B'; db.setTenantTopic('zoe:B'); db.goOnline();
    await turn(); const verdict = await write; db.close('test');
    expect(writes).toEqual([]); expect(verdict).toBe('refused');
  });
  it('a CAS conflict from A cannot trigger a retry write in tenant B', async () => {
    let tenant = 'A'; const first = deferred<any>(); const writes: string[] = [];
    const db = createSupabaseDatabase({ rpc: async (fn: string, args: any) => {
      if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe(tenant); writes.push(tenant); return writes.length === 1 ? first.promise : { ok: true, docs: [] }; }
      return { seq: 1, more: false, reset: true, tenant, now: Date.now(), rows: [] };
    }, subscribe: () => () => {} }, { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() });
    db.setTenantTopic('zoe:A'); db.setAuthed(true, 'same-user'); await turn();
    const tx = db.runTransaction(db.ref(HIST + '/private-A'), () => ({ shop: 'A' })).then(() => 'committed', () => 'refused');
    await turn(); expect(writes).toEqual(['A']);
    tenant = 'B'; db.setTenantTopic('zoe:B'); first.resolve({ conflict: true, value: { prior: 'A' } });
    await turn(); const verdict = await tx; db.close('test');
    expect(writes).toEqual(['A']); expect(verdict).toBe('refused');
  });
  for (const transaction of [false, true]) {
    it('acknowledged A ' + (transaction ? 'CAS' : 'write') + ' stays successful without publishing A into B', async () => {
      let tenant = 'A'; const sent = deferred<any>(); let writes = 0;
      const db = createSupabaseDatabase({ rpc: async (fn: string, args: any) => {
        if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe(tenant); writes++; return sent.promise; }
        return { seq: 1, more: false, reset: true, tenant, now: Date.now(), rows: [] };
      }, subscribe: () => () => {} }, { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() });
      db.setTenantTopic('zoe:A'); db.setAuthed(true, 'same-user'); await turn();
      const ref = db.ref(HIST + '/private-A');
      const running = transaction ? db.runTransaction(ref, () => ({ shop: 'A' })) : db.set(ref, { shop: 'A' });
      await turn(); expect(writes).toBe(1);
      tenant = 'B'; db.setTenantTopic('zoe:B'); await turn();
      sent.resolve({ ok: true, docs: [{ r: HIST, k: 'private-A', v: { shop: 'A' }, s: 90 }] });
      const verdict = await running; await turn(); const snapshot = db.snapshotState(); db.close('test');
      if (transaction) expect(verdict.committed).toBe(true);
      expect(snapshot.docs[HIST + '/private-A']).toBeUndefined();
    });
  }
});
