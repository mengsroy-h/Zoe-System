import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { pickupResetAttemptId, pickupResetBoundReceipt, pickupResetCasOf, pickupResetReceiptMatches } from '../src/domain/pickup-reset-proof';
import { createSupabaseDatabase, SbNetworkError, SbRpcError } from '../src/services/supabase-rtdb';
import { createSupabaseSdk } from '../src/services/supabase-sdk';

const url = 'https://reset-adapter.supabase.co';
const authScope = url + '|user';
const day = '2026-11-01';
const path = ['zoew_daily_pickup_cod_dod', day];
const before = { pickupRevision: 4, pickupResetEpoch: 2, packagesPickedUp: 3, pickedUpPhones: { p1: true }, pickedUpBarcodes: { B1: true } };
const next = { pickupRevision: 5, pickupResetEpoch: 3, packagesPickedUp: 0 };
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const helpers = { boundReceipt: pickupResetBoundReceipt, receiptMatches: pickupResetReceiptMatches, cas: pickupResetCasOf };
const turn = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const deferred = () => { let resolve: (value?: any) => void; const promise = new Promise<any>(res => { resolve = res; }); return { promise, resolve: (...args: any[]) => resolve(args[0]) }; };
const request = async (nonce = 'attempt-nonce') => {
    const context = { v: 1, scope: url + '#A', batchId: 'batch-one', batchHash: 'a'.repeat(64), dayId: 'batch-one:' + day, day, nonce };
    const casText = JSON.stringify({ k: 'cas', p: path, x: before, v: { ...next, pickedUpPhones: null, pickedUpBarcodes: null } }, null, 1);
    return { tenant: 'A', actorUid: 'user', context, attemptId: await pickupResetAttemptId('A', 'user', context, casText), casText };
};
const receipt = async (req: any, unknown = false) => {
    const expected = await pickupResetBoundReceipt(req.tenant, req.actorUid, req.context, req.attemptId, req.casText, 'operation');
    return unknown ? { ...expected, outcome: 'unknown', proof: 'none' } : expected;
};
const reply = async (req: any, changes: any = {}) => ({ ok: true, seq: 2,
    docs: [{ r: path[0], k: day, v: next, s: 2 }], now: Date.now(), reset: await receipt(req), ...changes });
const open = async (options: any = {}) => {
    const calls: any[] = [], errors: any[] = [], snapshots: any[] = [];
    const onTxOutcomeUnknown = vi.fn();
    const state = { value: copy(before) as any, seq: 1, effects: 0 };
    const transport = { subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
        calls.push({ fn, args: copy(args) });
        const changed = await options.rpc?.(fn, args, state);
        if (changed !== undefined) return changed;
        if (fn === 'zoe_now') return Date.now();
        if (fn === 'zoe_pickup_reset_execute_v1' || fn === 'zoe_pickup_reset_status_v1') {
            const req = { tenant: args.p_expected_tenant, actorUid: 'user', context: args.p_context, attemptId: args.p_attempt_id, casText: args.p_cas_text };
            if (fn.endsWith('status_v1')) return reply(req, { docs: [], reset: await receipt(req, options.unknown === true) });
            const expected = JSON.parse(args.p_cas_text).x;
            if (JSON.stringify(state.value) !== JSON.stringify(expected)) return reply(req, { ok: false, conflict: true, value: copy(state.value), docs: [], reset: await receipt(req, true) });
            state.value = copy(next); state.seq = 2; state.effects++;
            return reply(req);
        }
        if (fn === 'zoe_read') return { now: Date.now(), docs: [{ r: path[0], k: day, v: copy(state.value), s: state.seq }] };
        if (/zoe_write/.test(fn)) throw new Error('generic writer forbidden in fixed-attempt regression');
        return { seq: state.seq, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [{ r: path[0], k: day, v: copy(state.value), s: state.seq }] };
    } };
    const db = createSupabaseDatabase(transport, { onListenerError: (error: any) => errors.push(error), onSynced: vi.fn(), onForbidden: vi.fn(),
        onTxOutcomeUnknown, onWriteRecovery: vi.fn() }, { pickupReset: helpers, docsCache: null, writeJournal: null,
        pollFallbackMs: 600000, ...options.dbOptions });
    db.setTenantTopic('zoe:A'); db.setAuthed(true, authScope); await turn();
    const ref = db.ref(path.join('/'));
    db.onValue(ref, (snap: any) => snapshots.push(snap.val())); await turn();
    return { db, ref, calls, errors, state, snapshots, transport, onTxOutcomeUnknown };
};
const resetCalls = (calls: any[]) => calls.filter(call => call.fn.startsWith('zoe_pickup_reset_'));

beforeEach(() => { localStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('Reset ប្រើ fixed attempt RPC តែមួយ ជាមួយ receipt និង snapshot ពិត', async () => {
    const req = await request(), { db, ref, calls, state } = await open();
    try {
        const result = await db.executePickupReset(ref, req);
        expect(result.committed).toBe(true); expect(result.snapshot.val()).toEqual(next);
        expect(result.pickupReset).toEqual(await receipt(req)); expect(state.effects).toBe(1);
        expect(resetCalls(calls)).toEqual([{ fn: 'zoe_pickup_reset_execute_v1', args: { p_expected_tenant: 'A', p_attempt_id: req.attemptId, p_context: req.context, p_cas_text: req.casText } }]);
        expect(calls.filter(call => /zoe_write/.test(call.fn))).toEqual([]);
    } finally { db.close('test'); }
});

it.each([false, true])('status applied/unknown=%s ជា read-only ដោយគ្មាន historical projection', async unknown => {
    const req = await request(), { db, ref, calls, state, snapshots } = await open({ unknown });
    try {
        const result = await db.pickupResetStatus(ref, req);
        expect(result).toEqual({ outcome: unknown ? 'unknown' : 'applied', pickupReset: unknown ? null : await receipt(req) });
        await turn(); expect(state.effects).toBe(0); expect(snapshots.at(-1)).toEqual(before);
        expect(resetCalls(calls).map(call => call.fn)).toEqual(['zoe_pickup_reset_status_v1']);
        expect(calls.filter(call => /zoe_write|execute/.test(call.fn))).toEqual([]);
    } finally { db.close('test'); }
});

it('replayed receipt មិនបង្កើត snapshot សូន្យចាស់ និងមិនប៉ះ current view', async () => {
    const req = await request(), { db, ref, state, snapshots } = await open({ rpc: async (fn: string) => fn.endsWith('execute_v1') ? reply(req, { replayed: true, docs: [] }) : undefined });
    try {
        const result = await db.executePickupReset(ref, req);
        expect(result.committed).toBe(true); expect(result.pickupReset).toEqual(await receipt(req));
        expect(result.snapshot).toBeUndefined(); expect(state.effects).toBe(0); await turn(); expect(snapshots.at(-1)).toEqual(before);
    } finally { db.close('test'); }
});

it('CAS conflict មាន proof binding ពេញលេញ ត្រឡប់ false ហើយមិន retry', async () => {
    const req = await request(), changed = { ...before, packagesPickedUp: 9, pickupRevision: 6 };
    const { db, ref, calls, state } = await open({ rpc: async (fn: string) => fn.endsWith('execute_v1') ? reply(req, { ok: false, conflict: true, value: changed, docs: [], reset: await receipt(req, true) }) : undefined });
    try {
        const result = await db.executePickupReset(ref, req);
        expect(result.committed).toBe(false); expect(result.snapshot.val()).toEqual(changed);
        expect(result.pickupReset).toBeUndefined(); expect(state.effects).toBe(0); expect(resetCalls(calls)).toHaveLength(1);
    } finally { db.close('test'); }
});

it.each(['tenant', 'actor', 'scope', 'day', 'attempt', 'cas', 'extra', 'ref', 'owner'])('invalid %s មិនផ្ញើ RPC និងគ្មាន effect', async fault => {
    const req: any = await request(), { db, ref, calls, state } = await open();
    try {
        if (fault === 'tenant') req.tenant = 'B';
        if (fault === 'actor') req.actorUid = 'other';
        if (fault === 'scope') req.context.scope = url + '#B';
        if (fault === 'day') req.context.day = '2026-11-02';
        if (fault === 'attempt') req.attemptId = 'b'.repeat(64);
        if (fault === 'cas') req.casText = req.casText.replace('"packagesPickedUp": 0', '"packagesPickedUp": 7');
        if (fault === 'extra') req.extra = true;
        const target = fault === 'ref' ? db.ref('zoew_settings/key') : ref;
        const error = await Promise.resolve().then(() => db.executePickupReset(target, req, () => fault !== 'owner')).then(() => null, error => error);
        expect(error).toMatchObject({ txOutcome: 'not-applied', noRetry: true });
        expect(resetCalls(calls)).toEqual([]); expect(state.effects).toBe(0);
    } finally { db.close('test'); }
});

it.each(['tenant', 'actor', 'epoch', 'owner'])('hash await ក្រោយ %s ផ្លាស់ មិនផ្ញើ attempt', async fault => {
    const req = await request(), entered = deferred(), release = deferred(); let owner = true;
    const boundReceipt = vi.fn(async (...args: any[]) => { entered.resolve(); await release.promise; return (helpers.boundReceipt as any)(...args); });
    const { db, ref, calls, state } = await open({ dbOptions: { pickupReset: { ...helpers, boundReceipt } } });
    try {
        const result = db.executePickupReset(ref, req, () => owner).catch((error: any) => error); await entered.promise;
        if (fault === 'tenant') db.setTenantTopic('zoe:B');
        if (fault === 'actor') db.setAuthed(true, url + '|other');
        if (fault === 'epoch') { db.resetForSignOut(); db.setTenantTopic('zoe:A'); db.setAuthed(true, authScope); }
        if (fault === 'owner') owner = false;
        release.resolve(); expect(await result).toMatchObject({ txOutcome: 'not-applied', noRetry: true });
        expect(resetCalls(calls)).toEqual([]); expect(state.effects).toBe(0);
    } finally { release.resolve(); db.close('test'); }
});

it('caller កែ request ក្រោយ hash ចាប់ផ្ដើម មិនប្ដូរ original attempt', async () => {
    const req = await request(), original = copy(req), entered = deferred(), release = deferred();
    const { db, ref, calls } = await open({ dbOptions: { pickupReset: { ...helpers, boundReceipt: async (...args: any[]) => { entered.resolve(); await release.promise; return (helpers.boundReceipt as any)(...args); } } } });
    try {
        const promise = db.executePickupReset(ref, req); await entered.promise;
        req.context.nonce = 'changed'; req.casText = '{}'; req.tenant = 'B'; release.resolve();
        const result = await promise; expect(result.pickupReset).toEqual(await receipt(original));
        expect(resetCalls(calls)[0].args).toEqual({ p_expected_tenant: original.tenant, p_attempt_id: original.attemptId, p_context: original.context, p_cas_text: original.casText });
    } finally { release.resolve(); db.close('test'); }
});

it.each(['network', 'unsent', 'permission', 'context', 'malformed', 'foreign', 'native-proof', 'extra-proof', 'wrong-doc', 'extra-doc', 'old-seq', 'unknown', 'replay-doc', 'untyped-conflict'])('execute reply %s គឺ UNKNOWN មិន retry ឬប្រើ generic fallback', async fault => {
    const req = await request();
    const { db, ref, calls, state, snapshots } = await open({ rpc: async (fn: string) => {
        if (!fn.endsWith('execute_v1')) return;
        if (fault === 'network') throw new SbNetworkError('lost acknowledgement');
        if (fault === 'unsent') throw new SbNetworkError('offline before fetch', true);
        if (fault === 'permission') throw new SbRpcError('permission denied', '42501', 403, '');
        if (fault === 'context') throw new SbRpcError('reset-context-conflict', 'PT409', 409, '');
        const value: any = await reply(req);
        if (fault === 'malformed') return { ok: true };
        if (fault === 'foreign') value.reset.actorUid = 'other';
        if (fault === 'native-proof') value.reset.proof = 'native-day';
        if (fault === 'extra-proof') value.reset.extra = true;
        if (fault === 'wrong-doc') value.docs[0].v = { ...next, packagesPickedUp: 7 };
        if (fault === 'extra-doc') value.docs.push({ r: 'zoew_settings', k: 'key', v: 1, s: 2 });
        if (fault === 'old-seq') value.docs[0].s = 1;
        if (fault === 'unknown') value.reset = await receipt(req, true);
        if (fault === 'replay-doc') value.replayed = true;
        if (fault === 'untyped-conflict') return { ok: false, conflict: true, value: before, seq: 2, docs: [], now: Date.now() };
        return value;
    } });
    try {
        const error = await db.executePickupReset(ref, req).then(() => null, (error: any) => error);
        expect(error).toMatchObject({ txOutcome: 'unknown', noRetry: true });
        expect(resetCalls(calls)).toHaveLength(1); expect(calls.filter(call => /zoe_write/.test(call.fn))).toEqual([]);
        expect(state.effects).toBe(0); await turn(); expect(snapshots.at(-1)).toEqual(before);
    } finally { db.close('test'); }
});

it.each(['network', 'foreign', 'docs', 'conflict', 'extra-proof'])('status %s មិនផ្ដល់ false applied និងមិនប៉ះ view', async fault => {
    const req = await request(), { db, ref, calls, state, snapshots } = await open({ rpc: async (fn: string) => {
        if (!fn.endsWith('status_v1')) return;
        if (fault === 'network') throw new SbNetworkError('status unavailable');
        const value: any = await reply(req, { docs: [] });
        if (fault === 'foreign') value.reset.tenant = 'B';
        if (fault === 'docs') value.docs = [{ r: path[0], k: day, v: next, s: 2 }];
        if (fault === 'conflict') { value.ok = false; value.conflict = true; }
        if (fault === 'extra-proof') value.reset.extra = true;
        return value;
    } });
    try {
        expect(await db.pickupResetStatus(ref, req)).toEqual({ outcome: 'unknown', pickupReset: null });
        expect(resetCalls(calls)).toHaveLength(1); expect(state.effects).toBe(0); await turn(); expect(snapshots.at(-1)).toEqual(before);
    } finally { db.close('test'); }
});

it('late reply ក្រោយ owner ផ្លាស់ មាន actual commit តែ local outcome UNKNOWN', async () => {
    const req = await request(), entered = deferred(), release = deferred(); let owner = true;
    const { db, ref, calls, state, snapshots } = await open({ rpc: async (fn: string, _args: any, current: any) => {
        if (!fn.endsWith('execute_v1')) return;
        current.value = copy(next); current.effects++; entered.resolve(); await release.promise; return reply(req);
    } });
    try {
        const promise = db.executePickupReset(ref, req, () => owner).catch((error: any) => error); await entered.promise;
        owner = false; release.resolve(); expect(await promise).toMatchObject({ txOutcome: 'unknown', noRetry: true });
        expect(state.effects).toBe(1); expect(resetCalls(calls)).toHaveLength(1); await turn(); expect(snapshots.at(-1)).toEqual(before);
    } finally { release.resolve(); db.close('test'); }
});

it('SDK បញ្ជូន execute/status និង owner callback ដោយរក្សា request ដដែល', async () => {
    const req = await request(), owner = () => true, execute = vi.fn().mockResolvedValue({ committed: false }), status = vi.fn().mockResolvedValue({ outcome: 'unknown', pickupReset: null });
    const sdk = createSupabaseSdk(() => ({}), {}), ref = { _db: { executePickupReset: execute, pickupResetStatus: status } };
    expect(await sdk.executePickupReset(ref, req, owner)).toEqual({ committed: false });
    expect(await sdk.pickupResetStatus(ref, req, owner)).toEqual({ outcome: 'unknown', pickupReset: null });
    expect(execute).toHaveBeenCalledExactlyOnceWith(ref, req, owner); expect(status).toHaveBeenCalledExactlyOnceWith(ref, req, owner);
});

it('actual commit ដែលបាត់ ACK អាចបញ្ជាក់តាម status ដោយមិន execute ម្ដងទៀត', async () => {
    const req = await request(), { db, ref, calls, state } = await open({ rpc: async (fn: string, _args: any, current: any) => {
        if (!fn.endsWith('execute_v1')) return;
        current.value = copy(next); current.seq = 2; current.effects++; throw new SbNetworkError('committed response lost');
    } });
    try {
        const error = await db.executePickupReset(ref, req).then(() => null, (error: any) => error);
        expect(error).toMatchObject({ txOutcome: 'unknown', noRetry: true }); expect(state.effects).toBe(1);
        expect(await db.pickupResetStatus(ref, req)).toEqual({ outcome: 'applied', pickupReset: await receipt(req) });
        expect(resetCalls(calls).map(call => call.fn)).toEqual(['zoe_pickup_reset_execute_v1', 'zoe_pickup_reset_status_v1']);
        expect(resetCalls(calls).map(call => call.args.p_attempt_id)).toEqual([req.attemptId, req.attemptId]); expect(state.effects).toBe(1);
    } finally { db.close('test'); }
});

it('attempt ពីរ ជា queue លើថ្ងៃដដែល ដោយ conflict មិនត្រូវបង្កើត CAS ថ្មី', async () => {
    const first = await request('first'), second = await request('second'), entered = deferred(), release = deferred(); let executions = 0;
    const { db, ref, calls, state } = await open({ rpc: async (fn: string) => {
        if (fn.endsWith('execute_v1') && ++executions === 1) { entered.resolve(); await release.promise; }
    } });
    try {
        const one = db.executePickupReset(ref, first); await entered.promise;
        const two = db.executePickupReset(ref, second); await turn(); expect(executions).toBe(1);
        release.resolve(); expect((await one).committed).toBe(true);
        const result = await two; expect(result.committed).toBe(false); expect(result.snapshot.val()).toEqual(next);
        expect(state.effects).toBe(1); expect(resetCalls(calls).map(call => call.args.p_attempt_id)).toEqual([first.attemptId, second.attemptId]);
        expect(resetCalls(calls).map(call => call.args.p_cas_text)).toEqual([first.casText, second.casText]); expect(executions).toBe(2);
    } finally { release.resolve(); db.close('test'); }
});

it('status អានបានពេល generic write recovery HOLD ហើយ execute មិនអាចបន្ត', async () => {
    const req = await request(), row = { v: 1, scope: authScope, topic: 'zoe:A', opId: 'legacy_unknown_operation', ops: [{ k: 'set', p: ['zoew_settings', 'key'], v: 1 }], stage: 'unresolved', sentAfter: 0, queuedAt: Date.now() };
    const journal = { list: () => [copy(row)], put: vi.fn().mockReturnValue(true), remove: vi.fn().mockReturnValue(false) };
    const { db, ref, calls, state } = await open({ dbOptions: { writeJournal: journal } });
    try {
        await vi.waitFor(() => { expect(db.recoveryState().recovering).toBe(false); expect(db.recoveryState().blocked).toBe(1); });
        expect(await db.pickupResetStatus(ref, req)).toEqual({ outcome: 'applied', pickupReset: await receipt(req) });
        const error = await db.executePickupReset(ref, req).then(() => null, (error: any) => error);
        expect(error).toMatchObject({ txOutcome: 'not-applied', noRetry: true });
        expect(resetCalls(calls).map(call => call.fn)).toEqual(['zoe_pickup_reset_status_v1']); expect(state.effects).toBe(0);
        expect(journal.remove).not.toHaveBeenCalled(); expect(journal.put).not.toHaveBeenCalled();
    } finally { db.close('test'); }
});

it('fresh ACK មិនជាន់ view ថ្មីជាងដែលអានមកមុន ACK', async () => {
    const req = await request(), entered = deferred(), release = deferred();
    const { db, ref, state, snapshots } = await open({ rpc: async (fn: string) => {
        if (fn.endsWith('execute_v1')) { entered.resolve(); await release.promise; return reply(req); }
    } });
    try {
        const pending = db.executePickupReset(ref, req); await entered.promise;
        const newer = { ...next, pickupRevision: 6, packagesPickedUp: 1, pickedUpBarcodes: { NEW: true } };
        state.value = copy(newer); state.seq = 3; await db.get(ref); await turn();
        release.resolve(); const result = await pending; expect(result.committed).toBe(true); expect(result.snapshot.val()).toEqual(newer);
        expect(result.pickupReset).toEqual(await receipt(req)); await turn(); expect(snapshots.at(-1)).toEqual(newer);
    } finally { release.resolve(); db.close('test'); }
});

it.each(['execute', 'status'])('foreign %s reply មិនកែ trusted clock', async mode => {
    const req = await request(), { db, ref } = await open({ rpc: async (fn: string) => {
        if (!fn.startsWith('zoe_pickup_reset_')) return;
        const invalid: any = await reply(req, { docs: mode === 'status' ? [] : [{ r: path[0], k: day, v: next, s: 2 }], now: Date.now() + 100 * 86400000 });
        invalid.reset.scope = url + '#B'; return invalid;
    } });
    try {
        const offset = (await db.get(db.ref('.info/serverTimeOffset'))).val();
        if (mode === 'execute') expect(await db.executePickupReset(ref, req).catch((error: any) => error)).toMatchObject({ txOutcome: 'unknown' });
        else expect(await db.pickupResetStatus(ref, req)).toEqual({ outcome: 'unknown', pickupReset: null });
        expect((await db.get(db.ref('.info/serverTimeOffset'))).val()).toBe(offset);
    } finally { db.close('test'); }
});

it('SDK getDatabase បញ្ជូន codec ពិត ដល់ fixed-attempt adapter', async () => {
    const req = await request(), calls: string[] = [];
    const transport = { close: vi.fn(), subscribe: () => () => {}, rpc: async (fn: string) => {
        calls.push(fn);
        if (fn.endsWith('status_v1')) return reply(req, { docs: [] });
        return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
    } };
    const sdk = createSupabaseSdk(() => transport, { pickupReset: helpers, docsCache: null, writeJournal: null,
        onListenerError: vi.fn(), onWriteRecovery: vi.fn(), dbOptions: { pollFallbackMs: 600000 } });
    const app = sdk.initializeApp({ supabaseUrl: url });
    app._auth = { currentUser: { uid: 'user' }, _account: { tenant_id: 'A' }, _close: vi.fn() }; app._tenantTopic = 'zoe:A';
    try {
        const db = sdk.getDatabase(app); await turn();
        expect(await sdk.pickupResetStatus(sdk.ref(db, path.join('/')), req)).toEqual({ outcome: 'applied', pickupReset: await receipt(req) });
        expect(calls.filter(fn => fn.startsWith('zoe_pickup_reset_'))).toEqual(['zoe_pickup_reset_status_v1']);
    } finally { await sdk.deleteApp(app); }
});

it.each(['tenant', 'owner', 'missing-codec', 'day', 'ref', 'cas'])('status preflight %s មិនអាចបដិសេធ original commit ដែលបាត់ ACK', async fault => {
    const req = await request(), original = await open({ rpc: async (fn: string, _args: any, state: any) => {
        if (!fn.endsWith('execute_v1')) return;
        state.value = copy(next); state.seq = 2; state.effects++; throw new SbNetworkError('original applied response lost');
    } });
    let unavailable: any;
    try {
        expect(await original.db.executePickupReset(original.ref, req).catch((error: any) => error)).toMatchObject({ txOutcome: 'unknown' });
        expect(original.state.effects).toBe(1);
        const invalid = copy(req);
        if (fault === 'tenant') invalid.tenant = 'B';
        if (fault === 'day') invalid.context.day = '2026-11-02';
        if (fault === 'cas') invalid.casText = '{}';
        if (fault === 'missing-codec') unavailable = await open({ dbOptions: { pickupReset: null } });
        const target = unavailable || original;
        const ref = fault === 'ref' ? target.db.ref('zoew_settings/key') : target.ref;
        const readCount = resetCalls(target.calls).length;
        const result = await target.db.pickupResetStatus(ref, invalid, () => fault !== 'owner').catch((error: any) => error);
        expect(result).toEqual({ outcome: 'unknown', pickupReset: null });
        expect(result.txOutcome).toBeUndefined(); expect(resetCalls(target.calls)).toHaveLength(readCount);
        expect(original.state.effects).toBe(1);
        expect(await original.db.pickupResetStatus(original.ref, req)).toEqual({ outcome: 'applied', pickupReset: await receipt(req) });
        expect(resetCalls(original.calls).map(call => call.fn)).toEqual(['zoe_pickup_reset_execute_v1', 'zoe_pickup_reset_status_v1']);
        expect(original.state.effects).toBe(1);
    } finally { unavailable?.db.close('test'); original.db.close('test'); }
});

it.each(['applied', 'foreign', 'malformed', 'conflict'])('captured old-session ACK %s មិនប៉ះ actor ថ្មី ហើយបញ្ជាក់តែ original receipt', async outcome => {
    const req = await request(), entered = deferred(), release = deferred(); let currentActor = 'user', owner = true;
    const newer = { ...next, pickupRevision: 6, packagesPickedUp: 9, pickedUpBarcodes: { NEW: true } };
    const { db, ref, calls, state, snapshots, onTxOutcomeUnknown } = await open({ rpc: async (fn: string, _args: any, backend: any) => {
        if (fn.endsWith('execute_v1')) {
            if (outcome !== 'conflict') { backend.value = copy(next); backend.seq = 2; backend.effects++; }
            entered.resolve(); await release.promise;
            const response: any = await reply(req, { now: Date.now() + 100 * 86400000 });
            if (outcome === 'foreign') response.reset.actorUid = 'other';
            if (outcome === 'malformed') delete response.reset.intentHash;
            if (outcome === 'conflict') return reply(req, { ok: false, conflict: true, value: before, docs: [], reset: await receipt(req, true) });
            return response;
        }
        if (fn === 'zoe_pull' && currentActor === 'new-user') return { seq: 3, more: false, reset: true, tenant: 'A', now: Date.now(),
            rows: [{ r: path[0], k: day, v: newer, s: 3 }] };
    } });
    try {
        const pending = db.executePickupReset(ref, req, () => owner).catch((error: any) => error); await entered.promise;
        currentActor = 'new-user'; owner = false; db.setAuthed(true, url + '|new-user'); await turn();
        const current = snapshots.at(-1), offset = (await db.get(db.ref('.info/serverTimeOffset'))).val(), count = calls.length;
        expect(current).toEqual(newer);
        release.resolve(); const result = await pending; await turn();
        if (outcome === 'applied') {
            expect(result).toEqual({ committed: true, pickupReset: await receipt(req) });
            expect(result.snapshot).toBeUndefined();
        } else expect(result).toMatchObject({ txOutcome: 'unknown', noRetry: true });
        expect(state.effects).toBe(outcome === 'conflict' ? 0 : 1); expect(snapshots.at(-1)).toEqual(current);
        expect((await db.get(db.ref('.info/serverTimeOffset'))).val()).toBe(offset);
        expect(calls).toHaveLength(count); expect(resetCalls(calls)).toHaveLength(1);
        expect(resetCalls(calls)[0].args.p_attempt_id).toBe(req.attemptId); expect(calls.filter(call => /zoe_write/.test(call.fn))).toEqual([]);
        expect(onTxOutcomeUnknown).not.toHaveBeenCalled();
    } finally { release.resolve(); db.close('test'); }
});

const importedNativeReset = async (priorProof: 'native-day' | 'operation' = 'native-day') => {
    const context = { v: 1, scope: 'https://native-origin.invalid', batchId: 'native-batch', batchHash: 'c'.repeat(64),
        dayId: 'native-batch:' + day, day, nonce: 'native-original' };
    const oldCasText = JSON.stringify({ k: 'cas', p: path, x: { pickupRevision: 2, pickupResetEpoch: 1, packagesPickedUp: 1 },
        v: { pickupRevision: 3, pickupResetEpoch: 2, packagesPickedUp: 0, pickedUpPhones: null, pickedUpBarcodes: null } });
    const oldId = await pickupResetAttemptId('original-native-project', 'original-native-actor', context, oldCasText);
    const old = await pickupResetBoundReceipt('original-native-project', 'original-native-actor', context, oldId, oldCasText, priorProof);
    const basis = { ...copy(before), pickupResetApplied: old }, req = await request('reset-imported-native-marker');
    req.casText = JSON.stringify({ k: 'cas', p: path, x: basis, v: { ...next, pickedUpPhones: null, pickedUpBarcodes: null } });
    req.attemptId = await pickupResetAttemptId(req.tenant, req.actorUid, req.context, req.casText);
    const physical = { ...copy(next), pickupResetApplied: { ...await receipt(req), proof: 'native-day' } };
    return { basis, req, physical, old };
};

it.each(['native-day', 'operation'] as const)('privileged imported prior %s មាន physical proof ថ្មី តែ wire/hash នៅ original BASE5', async priorProof => {
    const { basis, req, physical } = await importedNativeReset(priorProof);
    const { db, ref, calls, state } = await open({ rpc: async (fn: string, _args: any, backend: any) => {
        if (fn === 'zoe_pull') { backend.value = copy(basis); return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [{ r: path[0], k: day, v: basis, s: 1 }] }; }
        if (fn.endsWith('execute_v1')) { backend.value = copy(physical); backend.seq = 2; backend.effects++; return reply(req, { docs: [{ r: path[0], k: day, v: physical, s: 2 }] }); }
    } });
    try {
        expect(pickupResetCasOf(req.casText)).toBeTruthy(); expect(JSON.parse(req.casText).v).not.toHaveProperty('pickupResetApplied');
        const result = await db.executePickupReset(ref, req).catch((error: any) => error);
        expect(result).toMatchObject({ committed: true, pickupReset: await receipt(req) }); expect(result.snapshot.val()).toEqual(physical);
        expect(state.effects).toBe(1); expect(resetCalls(calls)).toHaveLength(1);
        expect(resetCalls(calls)[0].args).toEqual({ p_expected_tenant: 'A', p_attempt_id: req.attemptId, p_context: req.context, p_cas_text: req.casText });
        expect(await pickupResetAttemptId(req.tenant, req.actorUid, req.context, req.casText)).toBe(req.attemptId);
        expect(calls.filter(call => /zoe_write/.test(call.fn))).toEqual([]);
    } finally { db.close('test'); }
});

it.each(['missing', 'old', 'foreign', 'extra', 'operation-proof', 'missing-field', 'new-without-prior'])('physical native marker %s មិនអាចផ្ដល់ APPLIED ដោយ contract ខុស', async fault => {
    const imported = await importedNativeReset(), req = fault === 'new-without-prior' ? await request() : imported.req;
    const basis = fault === 'new-without-prior' ? before : imported.basis;
    const physical: any = { ...copy(next), pickupResetApplied: { ...await receipt(req), proof: 'native-day' } };
    if (fault === 'missing') delete physical.pickupResetApplied;
    if (fault === 'old') physical.pickupResetApplied = copy(imported.old);
    if (fault === 'foreign') physical.pickupResetApplied.tenant = 'B';
    if (fault === 'extra') physical.pickupResetApplied.extra = true;
    if (fault === 'operation-proof') physical.pickupResetApplied.proof = 'operation';
    if (fault === 'missing-field') delete physical.pickupResetApplied.intentHash;
    const { db, ref, calls, state, snapshots } = await open({ rpc: async (fn: string, _args: any, backend: any) => {
        if (fn === 'zoe_pull') { backend.value = copy(basis); return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [{ r: path[0], k: day, v: basis, s: 1 }] }; }
        if (fn.endsWith('execute_v1')) return reply(req, { docs: [{ r: path[0], k: day, v: physical, s: 2 }] });
    } });
    try {
        const result = await db.executePickupReset(ref, req).catch((error: any) => error);
        expect(result).toMatchObject({ txOutcome: 'unknown', noRetry: true }); expect(state.effects).toBe(0);
        await turn(); expect(snapshots.at(-1)).toEqual(basis); expect(resetCalls(calls)).toHaveLength(1);
        expect(calls.filter(call => /zoe_write/.test(call.fn))).toEqual([]);
    } finally { db.close('test'); }
});

it('physical native marker តែមួយ ក្រោយ operation proof បាត់ រក្សា status UNKNOWN ដោយគ្មាន replay', async () => {
    const { req, physical } = await importedNativeReset();
    const { db, ref, calls, state, snapshots } = await open({ rpc: async (fn: string, _args: any, backend: any) => {
        if (fn === 'zoe_pull') { backend.value = copy(physical); return { seq: 2, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [{ r: path[0], k: day, v: physical, s: 2 }] }; }
        if (fn.endsWith('status_v1')) return reply(req, { seq: 2, docs: [], reset: await receipt(req, true) });
    } });
    try {
        expect(await db.pickupResetStatus(ref, req)).toEqual({ outcome: 'unknown', pickupReset: null });
        expect(state.effects).toBe(0); await turn(); expect(snapshots.at(-1)).toEqual(physical);
        expect(resetCalls(calls).map(call => call.fn)).toEqual(['zoe_pickup_reset_status_v1']);
        expect(calls.filter(call => call.fn === 'zoe_read' || /zoe_write/.test(call.fn))).toEqual([]);
    } finally { db.close('test'); }
});

it('imported prior marker មិនប្ដូរ cached operation replay/status receipt contract', async () => {
    const { req, basis } = await importedNativeReset();
    const { db, ref, calls, snapshots } = await open({ rpc: async (fn: string, _args: any, backend: any) => {
        if (fn === 'zoe_pull') { backend.value = copy(basis); return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [{ r: path[0], k: day, v: basis, s: 1 }] }; }
        if (fn.endsWith('execute_v1')) return reply(req, { docs: [], replayed: true });
        if (fn.endsWith('status_v1')) return reply(req, { docs: [] });
    } });
    try {
        const result = await db.executePickupReset(ref, req);
        expect(result).toEqual({ committed: true, pickupReset: await receipt(req) }); expect(result.snapshot).toBeUndefined();
        expect(await db.pickupResetStatus(ref, req)).toEqual({ outcome: 'applied', pickupReset: await receipt(req) });
        await turn(); expect(snapshots.at(-1)).toEqual(basis);
        expect(resetCalls(calls).map(call => call.fn)).toEqual(['zoe_pickup_reset_execute_v1', 'zoe_pickup_reset_status_v1']);
    } finally { db.close('test'); }
});
