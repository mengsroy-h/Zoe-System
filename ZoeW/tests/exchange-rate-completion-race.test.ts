import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { firebaseState, dataState } from '../src/core/state';
import { saveExchangeRate } from '../src/features/exchange-rate';
import { createSupabaseDatabase, SbRpcError } from '../src/services/supabase-rtdb';
import { DB_OP_TIMEOUT_MS } from '../src/services/network';

const turn = async () => { for (let i = 0; i < 35; i++) await Promise.resolve(); };
const deferred = <T>() => { let resolve!: (v: T) => void, reject!: (e: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const hooks = { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() };
const ack = { ok: true, docs: [{ r: 'zoew_settings', k: 'exchange_rate', v: 4100, s: 2 }] };
beforeEach(() => { vi.useFakeTimers(); dataState.exchangeRateSaveInFlight = false; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
function database(name: string, reply: Promise<any>) {
  const db = createSupabaseDatabase({ rpc: async (fn: string) => fn === 'zoe_write' ? reply : { seq: 1, more: false, reset: true, tenant: name, now: Date.now(), rows: [] },
    subscribe: () => () => {} }, hooks);
  db.setTenantTopic('zoe:' + name); db.setAuthed(true, name); return db;
}
function attach(db: any, name: string, set: any) {
  firebaseState.db = db; firebaseState.fb = { set } as any;
  firebaseState.auth = { currentUser: { uid: name } } as any;
  firebaseState.dbRefExchangeRate = db.ref('zoew_settings/exchange_rate');
  firebaseState.authGeneration++;
  dataState.exchangeRateSaveInFlight = false;
}
for (const mode of ['ack', 'reject', 'late-ack']) {
  it('old Supabase app ' + mode + ' cannot release the new backend rate write lock', async () => {
    const old = deferred<any>(), next = deferred<any>();
    const dbA = database('A', old.promise), dbB = database('B', next.promise);
    const set = vi.fn((ref: any, value: any) => ref._db.set(ref, value));
    attach(dbA, 'A', set); await turn();
    const writeA = saveExchangeRate(); await turn();
    if (mode === 'late-ack') {
      await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
      expect(await writeA).toBe('pending');
    }
    dbA.close('old app deleted');
    attach(dbB, 'B', set);
    const writeB = saveExchangeRate(); await turn();
    expect(dataState.exchangeRateSaveInFlight).toBe(true);
    if (mode === 'reject') old.reject(new SbRpcError('denied', '42501', 403, '')); else old.resolve(ack);
    await writeA; await turn();
    const stayedLocked = dataState.exchangeRateSaveInFlight;
    const third = saveExchangeRate(); await turn();
    const sends = set.mock.calls.length;
    next.resolve(ack); await writeB; await third; await turn(); dbB.close('done');
    expect(stayedLocked).toBe(true);
    expect(sends).toBe(2);
    expect(dataState.exchangeRateSaveInFlight).toBe(false);
  });
}
