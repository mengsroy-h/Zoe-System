/**
 * ⛔ Supabase ៖ ថ្នាក់ដូច `ledger-replay-companion.test.ts` លើ adapter ៖ កែតម្លៃ (CAS ledger មុន · CAS history ក្រោយ) ក្រៅបណ្តាញ ➜
 *    reload ➜ row journal ២ (`sent` · uncertain) ➜ session បន្ទាប់ replay CAS នីមួយៗ **ដោយឯករាជ្យ** ➜ CAS មួយចុះ មួយទៀត conflict
 *    (ឧបករណ៍ផ្សេងសរសេរ) ➜ ពាក់កណ្តាលប្រតិបត្តិការ ៖ តម្លៃប្រែតែ ledger មិនប្រែ ឬផ្ទុយ។
 *    ច្បាប់ ៖ row CAS ledger ដែលមាន `intent.companion` មិន replay ជា op ដើមទេ ➜ ក្រោយ row ឯទៀត ➜ សម្រេចតាម barcode លើ server
 *    (`holds` ➜ transaction ថ្មីពី intent (idempotent តាម token) · `prior` + ចុះរួច ➜ ដកវិញ · ផ្សេង ➜ ទម្លាក់)។
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ledgerCompanionCopyState, ledgerCompanionState, ledgerDeltaCompanion, ledgerDeltaIntent, ledgerJournalUpdate, ledgerJournalWitness, ledgerOpRing, ledgerTagged } from '../src/domain/ledger';
import { SbNetworkError, SbRpcError, createSupabaseDatabase } from '../src/services/supabase-rtdb';

const DAY = '2026-10-14';
const LEDGER = 'zoew_daily_revenue_cod_dod/' + DAY;
const ITEM = 'zoew_scan_history_cod_dod/item1';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const item = (cod: number, extra: any = {}) => ({ id: 'item1', phone: '012000111', scanDate: DAY, barcodes: [{ code: 'B1', cod, dod: 0, isClosed: false }], ...extra });
const ledger = (cod: number, token: string) => ({ codDollar: cod, dodDollar: 0, totalCount: 2, op: token, ops: { [token]: 3 } });

function fakeServer() {
    let down = false;
    let seq = 0;
    const docs = new Map<string, any>();
    const done = new Map<string, any>();
    const writes: { opId: string; k: string; ok: boolean }[] = [];
    const docOf = (k: string) => (docs.has(k) ? docs.get(k) : null);
    const apply = (args: any) => {
        const prior = done.get(args.p_op_id);
        if (prior) return Object.assign({}, prior, { replayed: true, now: Date.now() });
        const op = args.p_ops[0];
        const k = op.p[0] + '/' + op.p[1];
        if (JSON.stringify(op.x === undefined ? null : op.x) !== JSON.stringify(docOf(k))) { writes.push({ opId: args.p_op_id, k, ok: false }); return { ok: false, conflict: true, now: Date.now(), value: docOf(k) }; }
        seq++;
        docs.set(k, op.v === undefined ? null : op.v);
        writes.push({ opId: args.p_op_id, k, ok: true });
        const result = { ok: true, seq, now: Date.now(), docs: [{ r: op.p[0], k: op.p[1], v: docs.get(k), s: seq }] };
        done.set(args.p_op_id, result);
        return result;
    };
    const rows = () => Array.from(docs.entries()).filter(([, v]) => v !== null).map(([k, v]) => ({ r: k.split('/')[0], k: k.split('/')[1], v, s: seq }));
    const transport = {
        rpc: async (fn: string, args: any) => {
            if (fn === 'zoe_pull') return { seq, more: false, reset: true, head: seq, tenant: 't1', now: Date.now(), rows: rows() };
            if (fn !== 'zoe_write') throw new Error('unexpected ' + fn);
            if (down) throw new SbNetworkError('network');
            return apply(args);
        },
        ping: async () => true,
        subscribe: () => () => {}
    };
    return { transport, writes, setDown: (d: boolean) => { down = d; }, set: (k: string, v: any) => { seq++; docs.set(k, v); }, get: (k: string) => docOf(k) };
}

const makeJournal = () => {
    const rows = new Map<string, any>();
    return { rows, put: (row: any) => { rows.set(row.opId, structuredClone(row)); return true; },
        list: (scope: string, topic: string) => [...rows.values()].filter((x) => x.scope === scope && x.topic === topic),
        remove: (_scope: string, _topic: string, id: string) => rows.delete(id) };
};

async function open(server: ReturnType<typeof fakeServer>, journal: any) {
    const db = createSupabaseDatabase(server.transport, { onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {} },
        { retryStepsMs: [5, 10, 600000], pollFallbackMs: 600000, rpcTimeoutMs: 1000, writeJournal: journal,
            ledgerCompanion: { state: ledgerCompanionState, copy: ledgerCompanionCopyState, witness: ledgerJournalWitness, update: ledgerJournalUpdate } });
    db.setTenantTopic('zoe:t1');
    db.setAuthed(true, 'scope');
    let fired = false;
    db.onValue(db.ref(LEDGER), () => { fired = true; });
    for (let i = 0; i < 200 && !fired; i++) await wait(5);
    expect(fired).toBe(true);
    return db;
}

/** session ១ ៖ កែតម្លៃ B1 10 ➜ 15 ក្រៅបណ្តាញ ៖ CAS ledger (+5 · intent + companion) រួច CAS history ➜ ទាំងពីរ uncertain ➜ «reload» (close) */
async function offlinePriceEdit(server: ReturnType<typeof fakeServer>, journal: any, createdAt?: number) {
    const db = await open(server, journal);
    server.setDown(true);
    const token = 'op_mine_token_1';
    const ledgerUpdater: any = Object.assign((v: any) => ledgerTagged({ ...v, codDollar: (v.codDollar || 0) + 5 }, token, ledgerOpRing(v, token)),
        { connectionIntent: { ...ledgerDeltaIntent('daily', DAY, 5, 0, 0, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0, createdAt)), token } });
    const ledgerTx = db.runTransaction(db.ref(LEDGER), ledgerUpdater).catch(() => 'ended');
    const historyTx = db.runTransaction(db.ref(ITEM), (it: any) => ({ ...it, barcodes: [{ ...it.barcodes[0], cod: 15 }] })).catch(() => 'ended');
    for (let i = 0; i < 200 && [...journal.rows.values()].filter((r) => r.uncertain).length < 2; i++) await wait(5);
    db.close('reload');
    await Promise.all([ledgerTx, historyTx]);
    server.setDown(false);
    return [...journal.rows.values()].map((r) => ({ stage: r.stage, uncertain: r.uncertain, path: r.ops[0].p.join('/') }));
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

it('⛔ ledger ផ្លាស់ប្តូរដោយឧបករណ៍ផ្សេង (CAS ledger conflict) · CAS history ចុះ ➜ delta ledger ត្រូវអនុវត្តតាម intent (មិនបាត់)', async () => {
    const server = fakeServer(); const journal = makeJournal();
    server.set(ITEM, item(10)); server.set(LEDGER, ledger(40, 'op_prior_day'));
    const rows = await offlinePriceEdit(server, journal);
    expect(rows.map((r) => r.uncertain)).toEqual([true, true]);
    server.set(LEDGER, ledger(50, 'op_other_dev'));
    const db = await open(server, journal);
    for (let i = 0; i < 200 && journal.rows.size; i++) await wait(5);
    const state = db.recoveryState(); db.close('test');
    expect({ rows: journal.rows.size, blocked: state.blocked, item: server.get(ITEM).barcodes[0].cod, ledger: server.get(LEDGER).codDollar })
        .toEqual({ rows: 0, blocked: 0, item: 15, ledger: 55 });
});

it('⛔ history ផ្លាស់ប្តូរដោយឧបករណ៍ផ្សេង (CAS history conflict · តម្លៃនៅចាស់) · CAS ledger មិនទាន់ចុះ ➜ delta ledger មិន replay', async () => {
    const server = fakeServer(); const journal = makeJournal();
    server.set(ITEM, item(10)); server.set(LEDGER, ledger(40, 'op_prior_day'));
    await offlinePriceEdit(server, journal);
    server.set(ITEM, item(10, { isCalled: true }));
    const db = await open(server, journal);
    for (let i = 0; i < 200 && journal.rows.size; i++) await wait(5);
    const state = db.recoveryState(); db.close('test');
    expect({ rows: journal.rows.size, blocked: state.blocked, item: server.get(ITEM).barcodes[0].cod, ledger: server.get(LEDGER).codDollar })
        .toEqual({ rows: 0, blocked: 0, item: 10, ledger: 40 });
});

it('CAS ledger ចុះរួចមុន reload (replay ឆ្លើយ replayed) · history conflict (តម្លៃនៅចាស់) ➜ ដកវិញម្តង · recovery ម្តងទៀតមិនដកស្ទួន', async () => {
    const server = fakeServer(); const journal = makeJournal();
    server.set(ITEM, item(10)); server.set(LEDGER, ledger(40, 'op_prior_day'));
    await offlinePriceEdit(server, journal);
    const ledgerRow = [...journal.rows.values()].find((r) => r.ops[0].p[0] === 'zoew_daily_revenue_cod_dod');
    server.set(LEDGER, ledgerRow.ops[0].v);
    server.set(ITEM, item(10, { isCalled: true }));
    const saved = structuredClone([...journal.rows.values()]);
    const db = await open(server, journal);
    for (let i = 0; i < 200 && journal.rows.size; i++) await wait(5);
    for (let i = 0; i < 40; i++) await wait(5);
    const first = { rows: journal.rows.size, blocked: db.recoveryState().blocked, ledger: server.get(LEDGER).codDollar, undoToken: Object.keys(server.get(LEDGER).ops || {}).some((t) => /^op_r/.test(t)) };
    db.close('test');
    expect(first).toEqual({ rows: 0, blocked: 0, ledger: 40, undoToken: true });
    saved.forEach((r) => journal.put(r));
    const again = await open(server, journal);
    for (let i = 0; i < 200 && journal.rows.size; i++) await wait(5);
    for (let i = 0; i < 40; i++) await wait(5);
    const second = { rows: journal.rows.size, ledger: server.get(LEDGER).codDollar };
    again.close('test');
    expect(second).toEqual({ rows: 0, ledger: 40 });
});

it('ទិសផ្ទុយ ៖ row CAS គ្មាន intent (history · ការកំណត់) replay ជា op ដើមដូចដើម', async () => {
    const server = fakeServer(); const journal = makeJournal();
    server.set(ITEM, item(10)); server.set(LEDGER, ledger(40, 'op_prior_day'));
    await offlinePriceEdit(server, journal);
    const db = await open(server, journal);
    for (let i = 0; i < 200 && journal.rows.size; i++) await wait(5);
    db.close('test');
    expect(server.writes.filter((w) => w.k === ITEM && w.ok).length).toBe(1);
    expect(server.get(ITEM).barcodes[0].cod).toBe(15);
});

it.each(['apply', 'undo'] as const)('បិទ session ក្រោយសម្រេច companion %s មុនផ្ញើ ledger ➜ reload បញ្ចប់តែម្តង', async (mode) => {
    const server = fakeServer(); const journal = makeJournal();
    const token = 'op_mine_token_1';
    const before = ledger(40, 'op_prior_day');
    const intent = { ...ledgerDeltaIntent('daily', DAY, 5, 0, 0, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0)), token };
    const after = ledgerJournalUpdate(before, intent);
    const saved = { v: 1, scope: 'scope', topic: 'zoe:t1', opId: 'operation_abcdefghijkl', stage: 'sent', uncertain: true,
        sentAfter: Date.now() - 1000, queuedAt: Date.now() - 1000, ops: [{ k: 'cas', p: LEDGER.split('/'), x: before, v: after }], intent };
    journal.put(saved);
    server.set(ITEM, item(mode === 'apply' ? 15 : 10));
    server.set(LEDGER, mode === 'apply' ? before : after);
    let stopped = false;
    const interrupted = createSupabaseDatabase(server.transport, { onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {},
        onWriteRecovery: () => { stopped = true; interrupted.close('reload'); } },
    { retryStepsMs: [5], pollFallbackMs: 600000, writeJournal: journal,
        ledgerCompanion: { state: ledgerCompanionState, copy: ledgerCompanionCopyState, witness: ledgerJournalWitness, update: ledgerJournalUpdate } });
    interrupted.setTenantTopic('zoe:t1'); interrupted.setAuthed(true, 'scope');
    for (let i = 0; i < 100 && !stopped; i++) await wait(5);
    interrupted.close('test');
    expect(stopped).toBe(true);
    expect(server.writes).toHaveLength(0);
    expect(journal.rows.size, 'ត្រូវរក្សា intent រហូតដល់ ledger ផ្ទៀងផ្ទាត់រួច').toBe(1);
    const resumed = await open(server, journal);
    try {
        for (let i = 0; i < 200 && journal.rows.size; i++) await wait(5);
        expect(journal.rows.size).toBe(0);
        expect(server.get(LEDGER).codDollar).toBe(mode === 'apply' ? 45 : 40);
    } finally { resumed.close('test'); }
    journal.put(saved);
    const repeated = await open(server, journal);
    try {
        for (let i = 0; i < 200 && journal.rows.size; i++) await wait(5);
        expect(journal.rows.size).toBe(0);
        expect(server.get(LEDGER).codDollar).toBe(mode === 'apply' ? 45 : 40);
    } finally { repeated.close('test'); }
});

it.each(['manual', 'online'] as const)('follow-up ត្រូវបដិសេធ ➜ intent នៅសល់ ហើយ retry %s បញ្ចប់ដោយមិនបូកស្ទួន', async (trigger) => {
    const server = fakeServer(); const journal = makeJournal();
    const before = ledger(40, 'op_prior_day');
    const intent = { ...ledgerDeltaIntent('daily', DAY, 5, 0, 0, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0)), token: 'op_mine_token_1' };
    journal.put({ v: 1, scope: 'scope', topic: 'zoe:t1', opId: 'operation_abcdefghijkl', stage: 'sent', uncertain: true,
        sentAfter: Date.now() - 1000, queuedAt: Date.now() - 1000,
        ops: [{ k: 'cas', p: LEDGER.split('/'), x: before, v: ledgerJournalUpdate(before, intent) }], intent });
    server.set(ITEM, item(15)); server.set(LEDGER, before);
    const rpc = server.transport.rpc;
    let rejected = false;
    server.transport.rpc = async (fn, args) => {
        if (fn === 'zoe_write' && !rejected) { rejected = true; throw new SbRpcError('refused', '42501', 403, ''); }
        return rpc(fn, args);
    };
    const db = await open(server, journal);
    try {
        for (let i = 0; i < 100 && !rejected; i++) await wait(5);
        expect(rejected).toBe(true);
        expect(server.get(LEDGER).codDollar).toBe(40);
        expect(journal.rows.size).toBe(1);
        expect(db.recoveryState()).toMatchObject({ blocked: 1, recovering: false });
        if (trigger === 'manual') await db.retryWriteRecovery();
        else { db.goOffline(); db.goOnline(); }
        for (let i = 0; i < 200 && journal.rows.size; i++) await wait(5);
        expect(journal.rows.size).toBe(0);
        expect(server.get(LEDGER).codDollar).toBe(45);
        expect(server.writes.filter((w) => w.ok)).toHaveLength(1);
        expect(db.recoveryState()).toMatchObject({ blocked: 0, recovering: false });
    } finally { db.close('test'); }
});

it('follow-up ចុះ server តែចម្លើយមកក្រោយ reload ➜ session ថ្មីសម្រេច intent ដោយបូកតែម្តង', async () => {
    const server = fakeServer(); const journal = makeJournal();
    const before = ledger(40, 'op_prior_day');
    const intent = { ...ledgerDeltaIntent('daily', DAY, 5, 0, 0, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0)), token: 'op_mine_token_1' };
    journal.put({ v: 1, scope: 'scope', topic: 'zoe:t1', opId: 'operation_abcdefghijkl', stage: 'sent', uncertain: true,
        sentAfter: Date.now() - 1000, queuedAt: Date.now() - 1000,
        ops: [{ k: 'cas', p: LEDGER.split('/'), x: before, v: ledgerJournalUpdate(before, intent) }], intent });
    server.set(ITEM, item(15)); server.set(LEDGER, before);
    const rpc = server.transport.rpc;
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => { release = resolve; });
    let held = false;
    server.transport.rpc = async (fn, args) => {
        const reply = await rpc(fn, args);
        if (fn === 'zoe_write' && !held) { held = true; await delayed; }
        return reply;
    };
    const first = await open(server, journal);
    let second: ReturnType<typeof createSupabaseDatabase> | null = null;
    try {
        for (let i = 0; i < 100 && !held; i++) await wait(5);
        expect(held).toBe(true);
        expect(server.get(LEDGER).codDollar).toBe(45);
        expect(journal.rows.has('operation_abcdefghijkl')).toBe(true);
        expect(first.recoveryState().recovering).toBe(true);
        first.close('reload');
        second = await open(server, journal);
        release();
        for (let i = 0; i < 200 && journal.rows.size; i++) await wait(5);
        expect(journal.rows.size).toBe(0);
        expect(server.get(LEDGER).codDollar).toBe(45);
        expect(server.writes.filter((w) => w.ok)).toHaveLength(1);
    } finally { release(); first.close('test'); second?.close('test'); }
});

it('session ដដែលចូលវិញមុន follow-up ចាស់បញ្ចប់ ➜ recovery ថ្មីមិនជាប់ owner ចាស់', async () => {
    const server = fakeServer(); const journal = makeJournal();
    const before = ledger(40, 'op_prior_day');
    const intent = { ...ledgerDeltaIntent('daily', DAY, 5, 0, 0, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0)), token: 'op_mine_token_1' };
    journal.put({ v: 1, scope: 'scope', topic: 'zoe:t1', opId: 'operation_abcdefghijkl', stage: 'sent', uncertain: true,
        sentAfter: Date.now() - 1000, queuedAt: Date.now() - 1000,
        ops: [{ k: 'cas', p: LEDGER.split('/'), x: before, v: ledgerJournalUpdate(before, intent) }], intent });
    server.set(ITEM, item(15)); server.set(LEDGER, before);
    const rpc = server.transport.rpc;
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => { release = resolve; });
    let releaseNext!: () => void;
    const delayedNext = new Promise<void>((resolve) => { releaseNext = resolve; });
    let held = false;
    let nextHeld = false;
    server.transport.rpc = async (fn, args) => {
        if (fn === 'zoe_write' && !held) {
            held = true; await delayed;
            throw new SbRpcError('session ended', '42501', 403, '');
        }
        const reply = await rpc(fn, args);
        if (fn === 'zoe_write') { nextHeld = true; await delayedNext; }
        return reply;
    };
    const db = await open(server, journal);
    try {
        for (let i = 0; i < 100 && !held; i++) await wait(5);
        expect(held).toBe(true);
        db.resetForSignOut(); db.setTenantTopic('zoe:t1'); db.setAuthed(true, 'scope');
        for (let i = 0; i < 100 && !db.isReady(); i++) await wait(5);
        expect(db.isReady()).toBe(true);
        release();
        for (let i = 0; i < 100 && !nextHeld; i++) await wait(5);
        expect(nextHeld).toBe(true);
        expect(db.recoveryState().recovering).toBe(true);
        expect((await db.discardPendingWrites()).count).toBe(0);
        expect(journal.rows.has('operation_abcdefghijkl')).toBe(true);
        releaseNext();
        db.goOnline();
        for (let i = 0; i < 200 && journal.rows.size; i++) await wait(5);
        expect(journal.rows.size).toBe(0);
        expect(server.get(LEDGER).codDollar).toBe(45);
        expect(db.recoveryState()).toMatchObject({ blocked: 0, recovering: false });
    } finally { release(); releaseNext(); db.close('test'); }
});

// Re-audit (money ②) ៖ the edit landed, then another device moved the barcode out of the row (Remove) before this device reopened ➜
// the row reads `absent`; the barcode's own copy in trash (same code + `createdAt`) holds the new price ➜ the delta still applies.
it('⛔ កែតម្លៃចុះ · barcode រំកិលទៅធុងសំរាមដោយតម្លៃថ្មីមុន reload · CAS ledger មិនទាន់ចុះ ➜ delta អនុវត្តតាមច្បាប់ចម្លង (មិនបាត់)', async () => {
    const CREATED = Date.UTC(2026, 9, 14, 3);
    const server = fakeServer(); const journal = makeJournal();
    server.set(ITEM, item(10)); server.set(LEDGER, ledger(40, 'op_prior_day'));
    await offlinePriceEdit(server, journal, CREATED);
    server.set(ITEM, item(10, { barcodes: [] }));
    server.set('zoew_recently_deleted_cod_dod/tr1', { id: 'tr1', trashReason: 'remove', barcodes: [{ code: 'B1', cod: 15, dod: 0, createdAt: CREATED, isDeducted: true }] });
    const db = await open(server, journal);
    for (let i = 0; i < 200 && journal.rows.size; i++) await wait(5);
    const state = db.recoveryState(); db.close('test');
    expect({ rows: journal.rows.size, blocked: state.blocked, ledger: server.get(LEDGER).codDollar }).toEqual({ rows: 0, blocked: 0, ledger: 45 });
});

it('control ៖ ច្បាប់ចម្លងក្នុងធុងសំរាមនៅតម្លៃចាស់ (ការកែមិនដែលចុះ) ➜ delta មិន replay', async () => {
    const CREATED = Date.UTC(2026, 9, 14, 3);
    const server = fakeServer(); const journal = makeJournal();
    server.set(ITEM, item(10)); server.set(LEDGER, ledger(40, 'op_prior_day'));
    await offlinePriceEdit(server, journal, CREATED);
    server.set(ITEM, item(10, { barcodes: [] }));
    server.set('zoew_recently_deleted_cod_dod/tr1', { id: 'tr1', trashReason: 'remove', barcodes: [{ code: 'B1', cod: 10, dod: 0, createdAt: CREATED, isDeducted: true }] });
    const db = await open(server, journal);
    for (let i = 0; i < 200 && journal.rows.size; i++) await wait(5);
    const state = db.recoveryState(); db.close('test');
    expect({ rows: journal.rows.size, blocked: state.blocked, ledger: server.get(LEDGER).codDollar }).toEqual({ rows: 0, blocked: 0, ledger: 40 });
});


// Recovery evidence belongs to a barcode lifecycle, even when the original customer path is reused.
const CREATED = Date.UTC(2026,9,28,3);
const cases = [
    {name:'old unsaved scan must not borrow same-path new lifecycle', birth:CREATED+1, price:15, applied:false, expected:40},
    {name:'new lifecycle prior price must not undo an applied old delta', birth:CREATED+1, price:10, applied:true, expected:45},
    {name:'timestamped intent cannot borrow item with no birth evidence', birth:undefined, price:15, applied:false, expected:40},
    {name:'same lifecycle still recovers delta', birth:CREATED, price:15, applied:false, expected:45},
    {name:'legacy intent without timestamp keeps existing semantics', birth:undefined, price:15, applied:false, legacy:true, expected:45},
    {name:'old lifecycle in trash remains evidence despite reused original path', birth:CREATED+1, price:10, applied:false, trash:true, expected:45},
];
it.each(cases)('$name', async ({birth,price,applied,legacy,trash,expected}:any) => {
    const server=fakeServer();const journal=makeJournal();
    const before=ledger(40,'op_prior_day');
    const companion=ledgerDeltaCompanion('item1','B1',15,0,10,0,legacy?undefined:CREATED);
    const intent={...ledgerDeltaIntent('daily',DAY,5,0,0,companion),token:'op_aba_probe_1'};
    const after=ledgerJournalUpdate(before,intent);
    const row={v:1,scope:'scope',topic:'zoe:t1',opId:'operation_abaprobe_00001',stage:'sent',uncertain:true,
        sentAfter:Date.now()-1000,queuedAt:Date.now()-1000,ops:[{k:'cas',p:LEDGER.split('/'),x:before,v:after}],intent};
    journal.put(row);
    server.set(LEDGER,applied?after:before);
    server.set(ITEM,item(price,{barcodes:[{code:'B1',cod:price,dod:0,createdAt:birth}]}));
    if(trash)server.set('zoew_recently_deleted_cod_dod/tr1',{barcodes:[{code:'B1',cod:15,dod:0,createdAt:CREATED}]});
    let complete:()=>void=()=>{};
    const retired=new Promise<void>(resolve=>{complete=resolve;});
    const remove=journal.remove;
    journal.remove=(s,t,id)=>{const result=remove(s,t,id);if(!journal.rows.size)complete();return result;};
    const db=createSupabaseDatabase(server.transport,{onListenerError:()=>{},onSynced:()=>{},onForbidden:()=>{},onTxOutcomeUnknown:()=>{}},
        {retryStepsMs:[5],pollFallbackMs:600000,rpcTimeoutMs:1000,writeJournal:journal,
            ledgerCompanion:{state:ledgerCompanionState,copy:ledgerCompanionCopyState,witness:ledgerJournalWitness,update:ledgerJournalUpdate}});
    try {
        db.setTenantTopic('zoe:t1');db.setAuthed(true,'scope');
        await retired;
        expect({ledger:server.get(LEDGER).codDollar,rows:journal.rows.size,itemBirth:server.get(ITEM).barcodes[0].createdAt})
            .toEqual({ledger:expected,rows:0,itemBirth:birth});
    } finally {db.close('test');}
});
