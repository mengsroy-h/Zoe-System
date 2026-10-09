/**
 * ⛔ Supabase ៖ `zoe_ops` រក្សាលទ្ធផល `op_id` តែ ២ ថ្ងៃ (`private.zoe_housekeeping()`) ➜ ចម្លើយ CAS ដែលបាត់ ហើយ adapter ផ្ញើ
 *    op_id ដដែលម្តងទៀតក្រោយ op ត្រូវ purge ៖ server វាយតម្លៃ CAS ថ្មីលើតម្លៃដែលការសរសេរដំបូងបានប្តូររួច ➜ `conflict`។ conflict នោះ
 *    **មិនមែនភស្តុតាង** ថាមិនបានអនុវត្តទេ។ មុនកែ ៖ adapter ឆ្លើយ `not-applied` ➜ `runLedgerTransaction()` សាកឡើងវិញ ➜ ledger
 *    ត្រូវកាត់ **ពីរដង**។ ក្រោយកែ ៖ ក្រោយ `SB_OP_REPLAY_SAFE_MS` conflict សម្រេចដោយ witness (ring `ops`) ឬ `unknown` (មិនទាយ)។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { firebaseState } from '../src/core/state';
import { runLedgerTransaction } from '../src/domain/ledger';
import * as rtdb from '../src/services/supabase-rtdb';
import { SbNetworkError, createSupabaseDatabase } from '../src/services/supabase-rtdb';

type Mode = 'ok' | 'drop' | 'down';

function fakeServer() {
    let mode: Mode = 'ok';
    let seq = 0;
    let clockShift = 0;
    let conflictNow = true;
    const now = () => Date.now() + clockShift;
    const docs = new Map<string, any>();
    const done = new Map<string, any>();
    const applied: string[] = [];
    const docOf = (k: string) => (docs.has(k) ? docs.get(k) : null);
    const apply = (args: any) => {
        const prior = done.get(args.p_op_id);
        if (prior) return Object.assign({}, prior, { replayed: true, now: now() });
        const op = args.p_ops[0];
        const k = op.p[0] + '/' + op.p[1];
        const current = docOf(k);
        if (JSON.stringify(op.x === undefined ? null : op.x) !== JSON.stringify(current)) return conflictNow ? { ok: false, conflict: true, now: now(), value: current } : { ok: false, conflict: true, value: current };
        seq++;
        docs.set(k, op.v === undefined ? null : op.v);
        applied.push(args.p_op_id);
        const result = { ok: true, seq, now: now(), docs: [{ r: op.p[0], k: op.p[1], v: docs.get(k), s: seq }] };
        done.set(args.p_op_id, result);
        return result;
    };
    const rows = () => Array.from(docs.entries()).filter(([, v]) => v !== null).map(([k, v]) => ({ r: k.split('/')[0], k: k.split('/')[1], v, s: seq }));
    const transport = {
        rpc: async (fn: string, args: any) => {
            if (fn === 'zoe_pull') {
                if (mode !== 'ok') throw new SbNetworkError('network');
                return { seq, more: false, reset: true, head: seq, tenant: 't1', now: now(), rows: rows() };
            }
            if (fn !== 'zoe_write') throw new Error('unexpected ' + fn);
            if (mode === 'down') throw new SbNetworkError('network');
            const res = apply(args);
            if (mode === 'drop') throw new SbNetworkError('timeout');
            return res;
        },
        ping: async () => true,
        subscribe: () => () => {}
    };
    return {
        transport, applied,
        setMode: (m: Mode) => { mode = m; },
        set: (k: string, v: any) => { seq++; docs.set(k, v); },
        get: (k: string) => docOf(k),
        purgeOps: () => done.clear(),
        deviceClockBack: (ms: number) => { vi.setSystemTime(Date.now() - ms); clockShift += ms; },
        deviceClockForward: (ms: number) => { vi.setSystemTime(Date.now() + ms); clockShift -= ms; },
        dropConflictNow: () => { conflictNow = false; }
    };
}

async function open(server: ReturnType<typeof fakeServer>, wait: (ms: number) => Promise<unknown>) {
    const unknown: string[] = [];
    const db = createSupabaseDatabase(server.transport, {
        onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: (p: string[]) => { unknown.push(p.join('/')); }
    }, { retryStepsMs: [5, 10, 600000], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
    db.setAuthed(true, 'scope');
    let fired = false;
    db.onValue(db.ref('ledger'), () => { fired = true; });
    for (let i = 0; i < 100 && !fired; i++) await wait(5);
    expect(fired).toBe(true);
    return { db, unknown };
}

const HOUR = 60 * 60 * 1000;
const saved = firebaseState.fb;
afterEach(() => { firebaseState.fb = saved; vi.useRealTimers(); });

const deduct = (current: any, op: any, ring: any) => {
    const base = current || { codDollar: 0, dodDollar: 0, totalCount: 0 };
    const next: any = { codDollar: base.codDollar - 5, dodDollar: base.dodDollar, totalCount: base.totalCount - 1 };
    if (op) next.op = op;
    if (ring) next.ops = ring;
    return next;
};

async function lostLedgerWrite(gapMs: number, purge: boolean, deviceClockBackMs = 0, conflictWithoutNow = false, deviceClockForwardBeforeSendMs = 0) {
    vi.useFakeTimers();
    const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);
    const server = fakeServer();
    server.set('ledger/2026-10-08', { codDollar: 100, dodDollar: 0, totalCount: 10, op: 'op_firstwriter0', ops: { op_firstwriter0: 1 } });
    const { db, unknown } = await open(server, wait);
    firebaseState.fb = db as any;
    if (deviceClockForwardBeforeSendMs) server.deviceClockForward(deviceClockForwardBeforeSendMs);
    server.setMode('drop');
    let state: any = 'pending';
    runLedgerTransaction(db.ref('ledger/2026-10-08'), deduct).then((r: any) => { state = r; }, (e: any) => { state = e; });
    await wait(30);
    server.setMode('down');
    await wait(gapMs);
    expect(state).toBe('pending');
    if (deviceClockBackMs) server.deviceClockBack(deviceClockBackMs);
    if (conflictWithoutNow) server.dropConflictNow();
    if (purge) server.purgeOps();
    server.setMode('ok');
    await wait(1200000);
    db.close('test');
    return { state, server, unknown };
}

describe('Supabase ៖ CAS ដែលចម្លើយបាត់ ហើយផ្ញើវិញក្រោយ zoe_ops purge', () => {
    it('ព្រំដែនរបស់ adapter ខ្លីជាងការរក្សា zoe_ops ក្នុង SQL (ទាញពី migration ពិត)', () => {
        const dir = path.resolve(__dirname, '../../supabase/migrations');
        const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n');
        const kept = /delete from public\.zoe_ops o where[^;]*created_at < now\(\) - interval '(\d+) days'/g;
        let m;
        let days = 0;
        while ((m = kept.exec(sql))) days = Number(m[1]);
        expect(days).toBeGreaterThan(0);
        const safe = (rtdb as any).SB_OP_REPLAY_SAFE_MS;
        expect(typeof safe).toBe('number');
        expect(safe).toBeGreaterThan(0);
        expect(safe).toBeLessThanOrEqual(days * 24 * HOUR / 2);
    });

    it('⛔ ledger ៖ ផ្ញើវិញក្រោយ ៣ ថ្ងៃ + op ត្រូវ purge ➜ conflict មិនមែន not-applied ➜ កាត់តែម្តង (witness ring)', async () => {
        const { state, server } = await lostLedgerWrite(72 * HOUR, true);
        expect(server.applied.length).toBe(1);
        expect(server.get('ledger/2026-10-08')).toMatchObject({ codDollar: 95, totalCount: 9 });
        expect(state && state.committed).toBe(true);
        expect(state.txOutcome).toBe('applied');
    });

    it('⛔ នាឡិកាឧបករណ៍ថយក្រោយ ៣០ ម៉ោងក្នុងការដាច់ ៥០ ម៉ោង + op ត្រូវ purge ➜ មិនមែន not-applied ➜ កាត់តែម្តង (អាយុវាស់តាមនាឡិកា server)', async () => {
        const { state, server } = await lostLedgerWrite(50 * HOUR, true, 30 * HOUR);
        expect(server.applied.length).toBe(1);
        expect(server.get('ledger/2026-10-08')).toMatchObject({ codDollar: 95, totalCount: 9 });
        expect(state && state.committed).toBe(true);
        expect(state.txOutcome).toBe('applied');
    });

    it('⛔ conflict គ្មាន `now` (អាយុវាស់មិនបាន) ➜ មិនទាយ not-applied ➜ witness ➜ កាត់តែម្តង (Claude ២ ៖ mutant `!(age > …)` រស់មុន)', async () => {
        const { state, server } = await lostLedgerWrite(3 * HOUR, true, 0, true);
        expect(server.applied.length).toBe(1);
        expect(server.get('ledger/2026-10-08')).toMatchObject({ codDollar: 95, totalCount: 9 });
        expect(state && state.committed).toBe(true);
        expect(state.txOutcome).toBe('applied');
    });

    it('⛔ នាឡិកាឧបករណ៍លោតទៅមុខ ៣០ ម៉ោង ក្រោយចម្លើយ server ចុងក្រោយ មុនផ្ញើ + ដាច់ ៥០ ម៉ោង + op ត្រូវ purge ➜ មិនមែន not-applied ➜ កាត់តែម្តង (ព្រំក្រោមមកពីចម្លើយ server មិនមែននាឡិកាឧបករណ៍ · Claude ២ ៖ mutant `Date.now() + serverOffset` រស់មុន)', async () => {
        const { state, server } = await lostLedgerWrite(50 * HOUR, true, 0, false, 30 * HOUR);
        expect(server.applied.length).toBe(1);
        expect(server.get('ledger/2026-10-08')).toMatchObject({ codDollar: 95, totalCount: 9 });
        expect(state && state.committed).toBe(true);
        expect(state.txOutcome).toBe('applied');
    });

    it('ទិសផ្ទុយ ៖ នាឡិកាឧបករណ៍ថយក្រោយ ៣០ ម៉ោងក្នុងការដាច់ ៣ ម៉ោង (op នៅ) ➜ replay ➜ applied តែម្តង', async () => {
        const { state, server, unknown } = await lostLedgerWrite(3 * HOUR, false, 30 * HOUR);
        expect(server.applied.length).toBe(1);
        expect(state && state.committed).toBe(true);
        expect(state.txOutcome).toBe('applied');
        expect(unknown).toEqual([]);
    });

    it('⛔ CAS គ្មាន witness ➜ ផ្ញើវិញក្រោយ purge ➜ unknown (មិនទាយ not-applied) + រាយការណ៍', async () => {
        vi.useFakeTimers();
        const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);
        const server = fakeServer();
        const { db, unknown } = await open(server, wait);
        server.setMode('drop');
        let state: any = 'pending';
        db.runTransaction(db.ref('ledger/x'), (v: any) => ({ n: ((v && v.n) || 0) + 1 })).then((r: any) => { state = r; }, (e: any) => { state = e; });
        await wait(30);
        server.setMode('down');
        await wait(72 * HOUR);
        server.purgeOps();
        server.setMode('ok');
        await wait(1200000);
        db.close('test');
        expect(server.applied.length).toBe(1);
        expect(state && state.message).toBe('disconnect');
        expect(state.txOutcome).toBe('unknown');
        expect(state.txServerUnread).toBeUndefined();
        expect(unknown).toEqual(['ledger/x']);
    });

    it('ទិសផ្ទុយ ៖ ផ្ញើវិញក្នុងបង្អួចសុវត្ថិភាព (op នៅ) ➜ replay ➜ applied តែម្តង', async () => {
        const { state, server, unknown } = await lostLedgerWrite(3 * HOUR, false);
        expect(server.applied.length).toBe(1);
        expect(state && state.committed).toBe(true);
        expect(state.txOutcome).toBe('applied');
        expect(unknown).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ សំណើមិនដែលចុះ (down តាំងពីដំបូង) + ឧបករណ៍ផ្សេងសរសេរ ➜ conflict ក្នុងបង្អួច ➜ not-applied ➜ ledger សាកឡើងវិញ ➜ កាត់តែម្តង', async () => {
        vi.useFakeTimers();
        const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);
        const server = fakeServer();
        server.set('ledger/2026-10-08', { codDollar: 100, dodDollar: 0, totalCount: 10 });
        const { db } = await open(server, wait);
        firebaseState.fb = db as any;
        server.setMode('down');
        let state: any = 'pending';
        runLedgerTransaction(db.ref('ledger/2026-10-08'), deduct).then((r: any) => { state = r; }, (e: any) => { state = e; });
        await wait(HOUR);
        expect(server.applied.length).toBe(0);
        server.set('ledger/2026-10-08', { codDollar: 200, dodDollar: 0, totalCount: 20 });
        server.setMode('ok');
        await wait(1200000);
        db.close('test');
        expect(state && state.committed).toBe(true);
        expect(server.get('ledger/2026-10-08')).toMatchObject({ codDollar: 195, totalCount: 19 });
    });
});
