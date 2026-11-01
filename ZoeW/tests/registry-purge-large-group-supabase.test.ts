import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as purgeProof from '../src/domain/registry-purge-proof';
import { createSupabaseDatabase, SbNetworkError, SbRpcError } from '../src/services/supabase-rtdb';
import { createLocalWriteJournal, WRITE_JOURNAL_MAX_BYTES } from '../src/services/write-journal';

const url = 'https://purge-large.supabase.co';
const scope = url + '|user';
const topic = 'zoe:A';
const helpers = { intent: (ops: any) => (purgeProof as any).boundedRegistryPurgeIntent(ops),
    hash: (ops: any) => (purgeProof as any).registryPurgeBindingHash(ops) };
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const turn = async () => { for (let i = 0; i < 120; i++) await Promise.resolve(); };
const operations = (count: number) => {
    const entries: any[] = [{ k: 'set', p: ['zoew_recently_deleted_cod_dod', 'trash1'], v: null },
        { k: 'set', p: ['zoew_trash_consumptions', 'trash1'], v: { v: 1, sourceId: 'trash1', generation: 2,
            kind: 'purge', actorUid: 'user', scope: url + '#A', deletedAt: 2000, rowBirth: 900 } }];
    for (let i = 0; i < count; i++) {
        const code = 'LARGE' + i;
        const id = 'scan_' + (i + 1).toString(16).padStart(32, '0');
        entries.push({ k: 'set', p: ['zoew_registry_releases', id], v: { v: 2, id, kind: 'scan', actorUid: 'scanner',
            releasedBy: 'user', scope: url + '#A', code, registryKey: code, birth: 1000 + i, trashId: 'trash1',
            slot: String(i), deletedAt: 2000, rowBirth: 900, rowCount: count, generation: 2 } },
        { k: 'set', p: ['zoew_barcode_registry', code], v: null });
    }
    return entries;
};
const patch = (ops: any[]) => Object.fromEntries(ops.map(op => [op.p.join('/'), copy(op.v)]));
const binding = async (ops: any[], opId: string, outcome = 'applied', proof = 'operation') => {
    const intent = helpers.intent(ops), first = intent.receipts[0];
    return { v: 1, outcome, tenant: 'A', actorUid: 'user', opId, hash: await helpers.hash(ops), sourceId: intent.sourceId,
        generation: first.generation, deletedAt: first.deletedAt, rowBirth: first.rowBirth, rowCount: first.rowCount, proof };
};
const retained = async (count: number, changes: any = {}) => {
    const ops = operations(count);
    return { v: 1, scope, topic, opId: 'operation_purge_atomic_0001', ops, writeProtocol: 3, purgeHash: await helpers.hash(ops),
        stage: 'unresolved', uncertain: true, sentAfter: Date.now() - 3 * 86400000, queuedAt: Date.now() - 3 * 86400000, ...changes };
};
const settledRecovery = async (db: any) => vi.waitFor(() => {
    expect(db.isReady()).toBe(true); expect(db.recoveryState().recovering).toBe(false);
}, { timeout: 3000, interval: 5 });
const open = async (options: any = {}) => {
    const calls: any[] = [], errors: any[] = [], journal = options.journal || createLocalWriteJournal();
    const transport = { subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
        calls.push({ fn, args: copy(args) });
        if (options.rpc) { const custom = await options.rpc(fn, args); if (custom !== undefined) return custom; }
        if (fn === 'zoe_now') return Date.now();
        if (fn === 'zoe_write_v2') return { ok: true, seq: 1, docs: [], now: Date.now() };
        if (fn === 'zoe_purge_execute_v1' || fn === 'zoe_purge_status_v1') return { ok: true, seq: 1, docs: [], now: Date.now(),
            purge: await binding(args.p_ops, args.p_op_id, fn === 'zoe_purge_execute_v1' ? 'applied' : 'unknown', fn === 'zoe_purge_execute_v1' ? 'operation' : 'none') };
        if (fn === 'zoe_read') return { docs: [], now: Date.now() };
        return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: options.rows || [] };
    } };
    const db = createSupabaseDatabase(transport, { onListenerError: (e: any) => errors.push(e), onSynced: vi.fn(), onForbidden: vi.fn(),
        onTxOutcomeUnknown: vi.fn(), onWriteRecovery: vi.fn() }, { writeJournal: journal, registryPurge: helpers,
        retryStepsMs: [1], pollFallbackMs: 600000, ...options.dbOptions });
    db.setTenantTopic(topic); db.setAuthed(true, scope); await turn();
    return { db, calls, journal, errors };
};

beforeEach(() => { localStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('កញ្ចប់ transport 250 barcode ពេញលេញ ត្រូវបញ្ជូន atomic តាម purge RPC តែមួយ មិនបំបែក generic', async () => {
    const { db, calls, journal } = await open();
    try {
        await db.update(db.ref(), patch(operations(250)));
        const writes = calls.filter(call => /zoe_(?:write|purge_execute)/.test(call.fn));
        expect(writes.map(call => call.fn)).toEqual(['zoe_purge_execute_v1']);
        expect(writes.map(call => call.args.p_ops.length)).toEqual([502]);
        expect(writes[0].args.p_expected_tenant).toBe('A');
        expect(journal.list(scope, topic)).toEqual([]);
    } finally { db.close('test'); }
});

it.each([1, 2, 249, 251])('ក្រុម %i barcode តូចឬធំ ប្រើផ្លូវ versioned ដូចគ្នា និងរក្សា full journal មុនផ្ញើ', async count => {
    let seen: any;
    const journal = createLocalWriteJournal();
    const { db, calls } = await open({ journal, rpc: (fn: string) => {
        if (fn === 'zoe_purge_execute_v1') seen = journal.list(scope, topic)[0];
    } });
    try {
        const ops = operations(count);
        await db.update(db.ref(), patch(ops));
        const writes = calls.filter(call => /zoe_(?:write|purge_execute)/.test(call.fn));
        expect(writes).toHaveLength(1); expect(writes[0].fn).toBe('zoe_purge_execute_v1');
        expect(writes[0].args.p_ops).toEqual(ops); expect(writes[0].args.p_expected_tenant).toBe('A');
        expect(seen).toMatchObject({ v: 1, writeProtocol: 3, ops, stage: 'sent', awaitingRecovery: false, purgeHash: await helpers.hash(ops) });
        expect(seen.sentAfter).toBeGreaterThan(0); expect(journal.list(scope, topic)).toEqual([]);
    } finally { db.close('test'); }
});

it('generic 501 state paths នៅតែ500+1 ហើយមិនប្រើ purge RPC', async () => {
    const { db, calls } = await open();
    try {
        await db.update(db.ref('zoew_settings'), Object.fromEntries(Array.from({ length: 501 }, (_, i) => ['K' + i, i])));
        expect(calls.filter(call => call.fn === 'zoe_write_v2').map(call => call.args.p_ops.length)).toEqual([500, 1]);
        expect(calls.filter(call => call.fn.startsWith('zoe_purge'))).toEqual([]);
    } finally { db.close('test'); }
});

it.each(['missing', 'generation', 'extra', 'v1', 'scope', 'actor', 'nul'])('កញ្ចប់ purge %s ខុស ត្រូវបដិសេធមុន generic chunk និងមុន effect', async fault => {
    const { db, calls, journal } = await open();
    try {
        const ops = operations(250);
        if (fault === 'missing') ops.pop();
        if (fault === 'generation') ops[2].v.generation++;
        if (fault === 'extra') ops.push({ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4000 });
        if (fault === 'v1') { ops[2].v.v = 1; delete ops[2].v.generation; }
        if (fault === 'scope') { for (const op of ops) if (op.v && op.v.scope) op.v.scope = url + '#B'; }
        if (fault === 'actor') { for (const op of ops) if (op.v) { if (op.v.releasedBy) op.v.releasedBy = 'other'; else op.v.actorUid = 'other'; } }
        if (fault === 'nul') ops[2].v.actorUid = 'scan\u0000ner';
        const error = await Promise.resolve().then(() => db.update(db.ref(), patch(ops))).then(() => null, e => e);
        expect(error).toBeTruthy();
        expect(calls.filter(call => /zoe_(?:write|purge_execute)/.test(call.fn))).toEqual([]);
        expect(journal.list(scope, topic)).toEqual([]);
    } finally { db.close('test'); }
});

it.each(['absent', 'first-put', 'admit-put', 'wrapper'])('journal %s មិនអាចរក្សា full intent ត្រូវគ្មាន dispatch', async failure => {
    const actual = createLocalWriteJournal(); let puts = 0;
    const journal = failure === 'absent' ? null : { ...actual, put: (row: any) => {
        puts++; return failure === 'first-put' || failure === 'admit-put' && puts === 2 ? false : actual.put(row);
    } };
    const { db, calls } = await open({ dbOptions: { writeJournal: journal } });
    try {
        const ops = operations(failure === 'wrapper' ? 2000 : 2);
        if (failure === 'wrapper') {
            const receipts = ops.filter(op => op.v?.kind === 'scan');
            const target = WRITE_JOURNAL_MAX_BYTES - 128;
            const width = Math.floor((target - JSON.stringify(ops).length) / receipts.length) + 7;
            for (const op of receipts) op.v.actorUid = 's'.repeat(width);
            let left = target - JSON.stringify(ops).length;
            for (const op of receipts) { const add = Math.min(left, 2048 - op.v.actorUid.length); op.v.actorUid += 's'.repeat(add); left -= add; }
            expect(left).toBe(0); expect(JSON.stringify(ops)).toHaveLength(target); expect(helpers.intent(ops)).toBeTruthy();
        }
        const error = await Promise.resolve().then(() => db.update(db.ref(), patch(ops))).then(() => null, e => e);
        expect(error?.code).toBe('WRITE_JOURNAL_UNAVAILABLE');
        expect(error?.txOutcome).toBe('not-applied');
        expect(calls.filter(call => /zoe_(?:write|purge_execute)/.test(call.fn))).toEqual([]);
    } finally { db.close('test'); }
});

it('journal រក្សា UTF16 units contract ដើម៖ packet ASCII លើស2Mi និងក្រោម4Mi អាចផ្ញើបានពេល storage ទទួល', async () => {
    const { db, calls, journal } = await open();
    try {
        const ops = operations(1800);
        for (const op of ops) if (op.v?.kind === 'scan') op.v.actorUid = 's'.repeat(1200);
        const length = new TextEncoder().encode(JSON.stringify(ops)).byteLength;
        expect(length).toBeGreaterThan(2 * 1024 * 1024); expect(length).toBeLessThan(4 * 1024 * 1024);
        await db.update(db.ref(), patch(ops));
        const writes = calls.filter(call => /zoe_(?:write|purge_execute)/.test(call.fn));
        expect(writes).toHaveLength(1); expect(writes[0].fn).toBe('zoe_purge_execute_v1');
        expect(writes[0].args.p_ops).toEqual(ops); expect(journal.list(scope, topic)).toEqual([]);
    } finally { db.close('test'); }
});

it.each(['tenant', 'actorUid', 'opId', 'hash', 'sourceId', 'generation', 'deletedAt', 'rowBirth', 'rowCount', 'missing', 'proof', 'unknown', 'extra-doc', 'wrong-value'])('reply %s មិនមែន proof ត្រូវរក្សា pending មិនជោគជ័យក្លែងក្លាយ', async fault => {
    const { db, calls, journal } = await open({ rpc: async (fn: string, args: any) => {
        if (fn !== 'zoe_purge_execute_v1') return;
        const proof: any = await binding(args.p_ops, args.p_op_id);
        if (['tenant', 'actorUid', 'opId', 'hash', 'sourceId'].includes(fault)) proof[fault] += '_other';
        if (['generation', 'deletedAt', 'rowBirth', 'rowCount'].includes(fault)) proof[fault]++;
        if (fault === 'proof') proof.proof = 'none';
        if (fault === 'unknown') { proof.outcome = 'unknown'; proof.proof = 'none'; }
        let docs: any[] = [];
        if (fault === 'extra-doc') docs = [{ r: 'zoew_settings', k: 'exchange_rate', v: 1, s: 1 }];
        if (fault === 'wrong-value') docs = args.p_ops.map((op: any, i: number) => ({ r: op.p[0], k: op.p[1], v: i === 0 ? { wrong: true } : op.v, s: 1 }));
        return { ok: true, seq: 1, docs, now: Date.now(), ...(fault === 'missing' ? {} : { purge: proof }) };
    } });
    try {
        const error = await db.update(db.ref(), patch(operations(2))).then(() => null, e => e);
        expect(error?.txOutcome).toBe('unknown'); expect(error?.code).toBe('WRITE_RECOVERY_PENDING');
        expect(journal.list(scope, topic)).toHaveLength(1);
        expect(journal.list(scope, topic)[0]).toMatchObject({ writeProtocol: 3, uncertain: true });
        expect(calls.filter(call => call.fn === 'zoe_purge_execute_v1')).toHaveLength(1);
        expect(calls.filter(call => call.fn.startsWith('zoe_write'))).toEqual([]);
    } finally { db.close('test'); }
});

it.each(['unsupported', 'permission', 'context'])('RPC %s ត្រូវ HOLD ដោយមិន fallback និងមិនលុប journal', async fault => {
    const { db, calls, journal } = await open({ rpc: (fn: string) => {
        if (fn === 'zoe_purge_execute_v1') throw new SbRpcError(fault, fault === 'permission' ? '42501' : fault === 'context' ? 'PT409' : 'PGRST202', fault === 'permission' ? 403 : 404, '');
    } });
    try {
        const error = await db.update(db.ref(), patch(operations(1))).then(() => null, e => e);
        expect(error?.txOutcome).toBe('unknown'); expect(journal.list(scope, topic)).toHaveLength(1);
        expect(calls.filter(call => call.fn.startsWith('zoe_write'))).toEqual([]);
    } finally { db.close('test'); }
});

it.each(['operation', 'release-set'])('restart លើសបីថ្ងៃ proof %s អាចបញ្ចប់ដោយគ្មាន replay/null projection លើ holder ថ្មី', async proof => {
    const row = await retained(251), journal = createLocalWriteJournal(); journal.put(row);
    const newHolder = { id: 'new-holder', birth: 9999 };
    const { db, calls } = await open({ journal, rows: [{ r: 'zoew_barcode_registry', k: 'LARGE0', v: newHolder, s: 10 }], rpc: async (fn: string, args: any) => {
        if (fn === 'zoe_purge_status_v1') return { ok: true, seq: 10, docs: [], now: Date.now(), purge: await binding(args.p_ops, args.p_op_id, 'applied', proof) };
    } });
    try {
        await settledRecovery(db);
        const values: any[] = []; const off = db.onValue(db.ref('zoew_barcode_registry/LARGE0'), (snap: any) => values.push(snap.val())); await turn(); off();
        expect(values.at(-1)).toEqual(newHolder); expect(values).not.toContain(null);
        expect(journal.list(scope, topic)).toEqual([]); expect(db.recoveryState().blocked).toBe(0);
        expect(calls.filter(call => /zoe_(?:write|purge_execute)/.test(call.fn))).toEqual([]);
        expect(calls.filter(call => call.fn === 'zoe_purge_status_v1').map(call => call.args.p_ops.length)).toEqual([504]);
    } finally { db.close('test'); }
});

it.each(['unknown', 'hash', 'scope', 'actor', 'ops', 'protocol', 'status-permission'])('restart %s មិនពេញលេញ ត្រូវ pending ដដែល និងគ្មាន write', async fault => {
    const row: any = await retained(250), journal = createLocalWriteJournal();
    if (fault === 'hash') row.purgeHash = '0'.repeat(64);
    if (fault === 'scope') { for (const op of row.ops) if (op.v?.scope) op.v.scope = url + '#B'; row.purgeHash = await helpers.hash(row.ops); }
    if (fault === 'actor') { for (const op of row.ops) if (op.v?.releasedBy) op.v.releasedBy = 'other'; else if (op.v?.kind === 'purge') op.v.actorUid = 'other'; row.purgeHash = await helpers.hash(row.ops); }
    if (fault === 'ops') row.ops.pop();
    if (fault === 'protocol') row.writeProtocol = 4;
    journal.put(row);
    const { db, calls } = await open({ journal, rpc: (fn: string) => { if (fn === 'zoe_purge_status_v1' && fault === 'status-permission') throw new SbRpcError('permission', '42501', 403, ''); } });
    try {
        await settledRecovery(db);
        expect(db.recoveryState().blocked).toBe(1); expect(journal.list(scope, topic)).toHaveLength(1);
        expect(calls.filter(call => /zoe_(?:write|purge_execute)/.test(call.fn))).toEqual([]);
    } finally { db.close('test'); }
});

it('restart មុន dispatch ត្រូវរក្សា opId/full packet ហើយប្រើតែ versioned RPC', async () => {
    const row = await retained(250, { stage: 'purge-queued', sentAfter: 0, uncertain: false }), journal = createLocalWriteJournal(); journal.put(row);
    const { db, calls } = await open({ journal });
    try {
        await settledRecovery(db);
        const writes = calls.filter(call => /zoe_(?:write|purge_execute)/.test(call.fn));
        expect(writes).toHaveLength(1); expect(writes[0]).toMatchObject({ fn: 'zoe_purge_execute_v1', args: { p_op_id: row.opId, p_ops: row.ops, p_expected_tenant: 'A' } });
        expect(journal.list(scope, topic)).toEqual([]);
    } finally { db.close('test'); }
});

it('ACK បាត់ ត្រូវផ្ទៀង status ដោយ opId ដើម មុន retry ហើយជោគជ័យតែម្តង', async () => {
    let committed: any;
    const { db, calls, journal } = await open({ rpc: async (fn: string, args: any) => {
        if (fn === 'zoe_purge_execute_v1') { committed = copy(args); throw new SbNetworkError('ACK lost'); }
        if (fn === 'zoe_purge_status_v1' && committed) return { ok: true, seq: 1, docs: [], now: Date.now(), purge: await binding(args.p_ops, args.p_op_id) };
    } });
    try {
        await db.update(db.ref(), patch(operations(250)));
        const execute = calls.filter(call => call.fn === 'zoe_purge_execute_v1'), status = calls.filter(call => call.fn === 'zoe_purge_status_v1');
        expect(execute).toHaveLength(1); expect(status).toHaveLength(1);
        expect(status[0].args).toEqual(execute[0].args); expect(journal.list(scope, topic)).toEqual([]);
        expect(calls.filter(call => call.fn.startsWith('zoe_write'))).toEqual([]);
    } finally { db.close('test'); }
});

it.each(['all', 'partial'])('protocol2 full purge %s release proof ត្រូវ read-only មិនបម្លែង unknown ជា intent ថ្មី', async mode => {
    const row = await retained(251, { writeProtocol: 2 }), journal = createLocalWriteJournal(); delete (row as any).purgeHash; journal.put(row);
    const { db, calls } = await open({ journal, rpc: (fn: string, args: any) => {
        if (fn === 'zoe_read') {
            const receipt = row.ops.find(op => op.p[0] === 'zoew_registry_releases' && op.p[1] === args.p_key)?.v;
            return { docs: mode === 'partial' && args.p_key.endsWith('01') ? [] : [{ k: args.p_key, v: receipt, s: 1 }], now: Date.now() };
        }
    } });
    try {
        await settledRecovery(db);
        expect(journal.list(scope, topic)).toHaveLength(mode === 'all' ? 0 : 1);
        expect(db.recoveryState().blocked).toBe(mode === 'all' ? 0 : 1);
        expect(calls.filter(call => call.fn === 'zoe_read')).toHaveLength(251);
        expect(calls.filter(call => /zoe_(?:write|purge_)/.test(call.fn))).toEqual([]);
    } finally { db.close('test'); }
});

it.each(['queued', 'sent', 'expired', 'unresolved'])('protocol2 ក្រុមតូច %s រក្សា same-intent recovery fences ដើម', async stage => {
    const row: any = await retained(2, { writeProtocol: 2, stage: stage === 'expired' ? 'sent' : stage,
        sentAfter: stage === 'queued' ? 0 : Date.now() - (stage === 'expired' ? 3 * 86400000 : 1000), uncertain: stage !== 'queued' });
    delete row.purgeHash;
    const journal = createLocalWriteJournal(); journal.put(row);
    const { db, calls } = await open({ journal });
    try {
        await settledRecovery(db);
        const eligible = stage === 'queued' || stage === 'sent';
        const writes = calls.filter(call => /zoe_(?:write|purge_)/.test(call.fn));
        expect(writes).toHaveLength(eligible ? 1 : 0);
        if (eligible) expect(writes[0]).toMatchObject({ fn: 'zoe_write_v2', args: { p_op_id: row.opId, p_ops: row.ops, p_expected_tenant: 'A' } });
        expect(journal.list(scope, topic)).toHaveLength(eligible ? 0 : 1);
        expect(db.recoveryState().blocked).toBe(eligible ? 0 : 1);
        expect(calls.filter(call => call.fn === 'zoe_read')).toHaveLength(2);
    } finally { db.close('test'); }
});

it('operation proof ទទួល per-doc s=0 ហើយមិនជាន់ holder ថ្មីដែល sequence ខ្ពស់ជាង', async () => {
    const newHolder = { id: 'new-holder', birth: 9999 };
    const { db, journal } = await open({ rows: [{ r: 'zoew_barcode_registry', k: 'LARGE0', v: newHolder, s: 10 }], rpc: async (fn: string, args: any) => {
        if (fn === 'zoe_purge_execute_v1') return { ok: true, seq: 2, now: Date.now(), purge: await binding(args.p_ops, args.p_op_id),
            docs: args.p_ops.map((op: any) => ({ r: op.p[0], k: op.p[1], v: op.v, s: op.p[0] === 'zoew_barcode_registry' ? 0 : 2 })) };
    } });
    try {
        await db.update(db.ref(), patch(operations(2)));
        const values: any[] = []; const off = db.onValue(db.ref('zoew_barcode_registry/LARGE0'), (snap: any) => values.push(snap.val())); await turn(); off();
        expect(values.at(-1)).toEqual(newHolder); expect(values).not.toContain(null);
        expect(journal.list(scope, topic)).toEqual([]);
    } finally { db.close('test'); }
});

it('actor ប្តូរពេល purge កំពុងរង់ចាំ reply ត្រូវមិនបញ្ចប់ក្នុង session ថ្មី ឬលុប journal ដើម', async () => {
    let release: () => void = () => {}, started: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; }), sent = new Promise<void>(resolve => { started = resolve; });
    const { db, calls, journal } = await open({ rpc: async (fn: string, args: any) => {
        if (fn !== 'zoe_purge_execute_v1') return;
        started(); await gate;
        return { ok: true, seq: 1, docs: [], now: Date.now(), purge: await binding(args.p_ops, args.p_op_id) };
    } });
    try {
        const result = db.update(db.ref(), patch(operations(2))).then(() => null, e => e);
        await sent; db.setAuthed(true, url + '|other'); release();
        const error = await result;
        expect(error?.txOutcome).toBe('unknown'); expect(journal.list(scope, topic)).toHaveLength(1);
        expect(calls.filter(call => call.fn === 'zoe_purge_execute_v1')).toHaveLength(1);
        expect(calls.filter(call => call.fn.startsWith('zoe_write'))).toEqual([]);
    } finally { release(); db.close('test'); }
});

it('hash រង់ចាំ admission ពេល external durable cancel ត្រូវមិនបង្កើត intent ដែលបោះបង់រួចឡើងវិញ', async () => {
    let release: () => void = () => {}, started: () => void = () => {}, hashes = 0;
    const gate = new Promise<void>(resolve => { release = resolve; }), hashing = new Promise<void>(resolve => { started = resolve; });
    const journal = createLocalWriteJournal();
    const { db, calls } = await open({ journal, dbOptions: { registryPurge: { intent: helpers.intent, hash: async (ops: any) => {
        if (++hashes === 1) { started(); await gate; } return helpers.hash(ops);
    } } } });
    try {
        const result = db.update(db.ref(), patch(operations(2))).then(() => null, e => e);
        await hashing;
        const row = journal.list(scope, topic)[0];
        expect(row).toMatchObject({ writeProtocol: 3, stage: 'purge-queued', awaitingRecovery: true });
        expect(journal.put({ ...row, stage: 'unresolved', discarded: true })).toBe(true);
        release(); const error = await result;
        expect(error?.txOutcome).toBe('unknown');
        expect(calls.filter(call => /zoe_(?:write|purge_execute)/.test(call.fn))).toEqual([]);
        expect(journal.list(scope, topic)[0]).toMatchObject({ discarded: true, stage: 'unresolved' });
    } finally { release(); db.close('test'); }
});

it('hash រង់ចាំ dispatch ពេល journal ក្លាយជា unknown ផុតរយៈពេល ត្រូវ HOLD មុន effect', async () => {
    let release: () => void = () => {}, started: () => void = () => {}, hashes = 0;
    const gate = new Promise<void>(resolve => { release = resolve; }), hashing = new Promise<void>(resolve => { started = resolve; });
    const journal = createLocalWriteJournal();
    const { db, calls } = await open({ journal, dbOptions: { registryPurge: { intent: helpers.intent, hash: async (ops: any) => {
        if (++hashes === 2) { started(); await gate; } return helpers.hash(ops);
    } } } });
    try {
        const result = db.update(db.ref(), patch(operations(2))).then(() => null, e => e);
        await hashing;
        const row = journal.list(scope, topic)[0];
        expect(row).toMatchObject({ writeProtocol: 3, stage: 'purge-queued', awaitingRecovery: false });
        expect(journal.put({ ...row, stage: 'unresolved', uncertain: true, sentAfter: Date.now() - 3 * 86400000 })).toBe(true);
        release(); const error = await result;
        expect(error?.txOutcome).toBe('unknown');
        expect(calls.filter(call => /zoe_(?:write|purge_execute)/.test(call.fn))).toEqual([]);
        expect(journal.list(scope, topic)[0]).toMatchObject({ stage: 'unresolved', uncertain: true });
    } finally { release(); db.close('test'); }
});

it.each(['tenant', 'missing'])('purge status %s មិនអាចបំពុល clock ដើម្បី replay increment ចាស់ក្រោយ op GC', async fault => {
    const old = Date.now() - 3 * 86400000;
    const purge = await retained(2, { queuedAt: old - 1, sentAfter: old });
    const increment = { v: 1, scope, topic, opId: 'operation_old_increment_0001', writeProtocol: 2, stage: 'sent', uncertain: true,
        sentAfter: old, queuedAt: old, ops: [{ k: 'inc', p: ['zoew_settings', 'counter'], d: 1 }] };
    const journal = createLocalWriteJournal(); journal.put(purge); journal.put(increment);
    const { db, calls } = await open({ journal, rpc: async (fn: string, args: any) => {
        if (fn !== 'zoe_purge_status_v1') return;
        const proof = await binding(args.p_ops, args.p_op_id, 'unknown', 'none');
        if (fault === 'tenant') proof.tenant = 'B';
        return { ok: true, seq: 1, docs: [], now: old + 1000, ...(fault === 'missing' ? {} : { purge: proof }) };
    } });
    try {
        await settledRecovery(db);
        expect.soft(calls.filter(call => call.fn.startsWith('zoe_write'))).toEqual([]);
        expect.soft(journal.list(scope, topic).map(row => row.opId)).toEqual([purge.opId, increment.opId]);
        expect.soft(db.recoveryState().blocked).toBe(2);
        expect(calls.filter(call => call.fn === 'zoe_purge_execute_v1')).toEqual([]);
    } finally { db.close('test'); }
});

it('purge status ស្រប typed binding នៅតែអាចកែ clock ហើយ unknown នៅតែ HOLD', async () => {
    const row = await retained(2), journal = createLocalWriteJournal(); journal.put(row);
    const { db, calls } = await open({ journal, rpc: async (fn: string, args: any) => {
        if (fn === 'zoe_purge_status_v1') return { ok: true, seq: 1, docs: [], now: Date.now() + 2000, purge: await binding(args.p_ops, args.p_op_id, 'unknown', 'none') };
    } });
    try {
        await settledRecovery(db);
        const values: number[] = []; const off = db.onValue(db.ref('.info/serverTimeOffset'), (snap: any) => values.push(snap.val())); await turn(); off();
        expect(values.at(-1)).toBeGreaterThan(1000); expect(values.at(-1)).toBeLessThan(3000);
        expect(db.recoveryState().blocked).toBe(1); expect(journal.list(scope, topic)).toHaveLength(1);
        expect(calls.filter(call => /zoe_(?:write|purge_execute)/.test(call.fn))).toEqual([]);
    } finally { db.close('test'); }
});
