import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseDatabase, SbIncrement, SbNetworkError } from '../src/services/supabase-rtdb';

const HOUR = 3600000;
const turn = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };

function world() {
    const journalRows = new Map<string, any>();
    const journal = {
        put: (row: any) => { journalRows.set(row.opId, structuredClone(row)); return true; },
        list: (scope: string, topic: string) => [...journalRows.values()].filter((row) => row.scope === scope && row.topic === topic),
        remove: (_scope: string, _topic: string, id: string) => journalRows.delete(id)
    };
    let value = 100;
    let seq = 1;
    let mode = 'ok';
    let clockOffset = 0;
    let clockResponse: Promise<number> | null = null;
    const now = () => Date.now() + clockOffset;
    const applied: string[] = [];
    const replies = new Map<string, any>();
    const writes: string[] = [];
    const transport = {
        subscribe: () => () => {},
        rpc: async (fn: string, args: any) => {
            if (mode === 'down') throw new SbNetworkError('offline', true);
            if (mode === 'clock-down') throw new SbNetworkError('clock unavailable');
            const doc = () => ({ r: 'ledger', k: 'day', v: { codDollar: value }, s: seq });
            if (fn === 'zoe_pull') return { seq, more: false, reset: true, tenant: 'A', now: now(), rows: [doc()] };
            if (fn === 'zoe_now') {
                if (clockResponse) { const response = clockResponse; clockResponse = null; return response; }
                return mode === 'bad-clock' ? null : now();
            }
            if (fn !== 'zoe_write') throw new Error('unexpected RPC ' + fn);
            writes.push(args.p_op_id);
            let result = replies.get(args.p_op_id);
            if (!result) {
                const op = args.p_ops[0];
                expect(op.p).toEqual(['ledger', 'day', 'codDollar']);
                value = op.k === 'inc' ? value + op.d : op.v;
                seq++;
                applied.push(args.p_op_id);
                result = { ok: true, seq, now: now(), docs: [doc()] };
                replies.set(args.p_op_id, result);
            }
            if (mode === 'drop') throw new SbNetworkError('lost ACK');
            return { ...result, now: now() };
        }
    };
    const db = createSupabaseDatabase(transport, {
        onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn()
    }, { writeJournal: journal, retryStepsMs: [10], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
    db.setTenantTopic('zoe:A');
    db.setAuthed(true, 'project|user');
    return { db, journalRows, writes, applied, value: () => value, mode: (next: string) => { mode = next; },
        clockOffset: (offset: number) => { clockOffset = offset; },
        holdClock: () => { let release!: (now: number) => void; clockResponse = new Promise((resolve) => { release = resolve; }); return release; },
        peerValue: (next: number) => { value = next; seq++; }, purge: () => replies.clear() };
}

afterEach(() => { vi.useRealTimers(); });

describe('Supabase ៖ write នៅក្នុង page ដដែលក្រោយ op_id ផុតរយៈរក្សា', () => {
    it.each(['inc', 'set'])('ACK បាត់លើ %s · ដាច់៣ថ្ងៃ · server purge ➜ រក្សា unresolved មិនផ្ញើស្ទួន', async (kind) => {
        vi.useFakeTimers();
        const w = world();
        try {
            await turn();
            w.mode('drop');
            let outcome: any = 'pending';
            const pending = w.db.set(w.db.ref('ledger/day/codDollar'), kind === 'inc' ? new SbIncrement(5) : 105)
                .then(() => { outcome = 'applied'; }, (error) => { outcome = error; });
            await turn();
            expect(w.value()).toBe(105);
            expect(w.applied).toHaveLength(1);
            expect([...w.journalRows.values()][0]).toMatchObject({ uncertain: true, stage: 'sent' });
            w.db.goOffline();
            w.mode('down');
            await vi.advanceTimersByTimeAsync(72 * HOUR);
            w.purge();
            if (kind === 'set') w.peerValue(120);
            w.mode('ok');
            w.db.goOnline();
            await vi.advanceTimersByTimeAsync(1000);
            expect(w.applied, 'op_id ចាស់មិនអាចអនុវត្តម្ដងទៀតក្រោយ purge').toHaveLength(1);
            expect(w.value()).toBe(kind === 'set' ? 120 : 105);
            expect(outcome).not.toBe('applied');
            expect(w.db.recoveryState().blocked).toBeGreaterThan(0);
            expect([...w.journalRows.values()][0]).toMatchObject({ uncertain: true, stage: 'unresolved' });
            w.db.close('test');
            await pending;
        } finally { w.db.close('test'); }
    });

    it('device clock rollback cannot make an expired uncertain increment replayable', async () => {
        vi.useFakeTimers();
        const w = world();
        try {
            await turn();
            w.mode('drop');
            const pending = w.db.set(w.db.ref('ledger/day/codDollar'), new SbIncrement(5)).catch((error) => error);
            await turn();
            w.db.goOffline();
            const before = Date.now();
            await vi.advanceTimersByTimeAsync(72 * HOUR);
            vi.setSystemTime(before - HOUR);
            w.clockOffset(73 * HOUR);
            w.purge();
            w.mode('ok');
            w.db.goOnline();
            await vi.advanceTimersByTimeAsync(1000);
            expect(await pending).toMatchObject({ txOutcome: 'unknown' });
            expect(w.applied).toHaveLength(1);
            expect(w.value()).toBe(105);
            expect([...w.journalRows.values()][0].stage).toBe('unresolved');
        } finally { w.db.close('test'); }
    });

    it('unreadable server time preserves unknown evidence and does not replay', async () => {
        vi.useFakeTimers();
        const w = world();
        try {
            await turn();
            w.mode('drop');
            const pending = w.db.set(w.db.ref('ledger/day/codDollar'), new SbIncrement(5)).catch((error) => error);
            await turn();
            w.mode('bad-clock');
            await vi.advanceTimersByTimeAsync(100);
            expect(await pending).toMatchObject({ txOutcome: 'unknown' });
            expect(w.applied).toHaveLength(1);
            expect(w.db.recoveryState().blocked).toBe(1);
            expect([...w.journalRows.values()][0].stage).toBe('unresolved');
        } finally { w.db.close('test'); }
    });

    it('known unsent offline queue may send after three days and replay its fresh lost ACK', async () => {
        vi.useFakeTimers();
        const w = world();
        try {
            await turn();
            w.mode('down');
            const pending = w.db.set(w.db.ref('ledger/day/codDollar'), new SbIncrement(5));
            await turn();
            expect([...w.journalRows.values()][0]).toMatchObject({ stage: 'queued' });
            w.db.goOffline();
            await vi.advanceTimersByTimeAsync(72 * HOUR);
            w.purge();
            w.mode('drop');
            w.db.goOnline();
            await turn();
            expect(w.applied).toHaveLength(1);
            w.mode('ok');
            await vi.advanceTimersByTimeAsync(1000);
            await pending;
            expect(w.applied).toHaveLength(1);
            expect(w.value()).toBe(105);
            expect(w.journalRows.size).toBe(0);
        } finally { w.db.close('test'); }
    });

    it('a failed clock read before the first write keeps the journal queued and can recover', async () => {
        vi.useFakeTimers();
        const w = world();
        try {
            await turn();
            w.db.goOffline();
            const pending = w.db.set(w.db.ref('ledger/day/codDollar'), new SbIncrement(5));
            await turn();
            w.mode('clock-down');
            w.db.goOnline();
            await vi.advanceTimersByTimeAsync(100);
            expect(w.writes).toHaveLength(0);
            expect([...w.journalRows.values()][0]).toMatchObject({ stage: 'queued' });
            expect([...w.journalRows.values()][0].uncertain).not.toBe(true);
            w.mode('ok');
            await vi.advanceTimersByTimeAsync(100);
            await pending;
            expect(w.applied).toHaveLength(1);
            expect(w.value()).toBe(105);
        } finally { w.db.close('test'); }
    });

    it('a delayed replay clock cannot send the old write into a new account or block its recovery', async () => {
        vi.useFakeTimers();
        const w = world();
        try {
            await turn();
            w.mode('drop');
            const pending = w.db.set(w.db.ref('ledger/day/codDollar'), new SbIncrement(5)).catch((error) => error);
            await turn();
            w.mode('ok');
            const releaseClock = w.holdClock();
            await vi.advanceTimersByTimeAsync(10);
            w.db.setAuthed(true, 'project|other-user');
            await turn();
            releaseClock(Date.now());
            await vi.advanceTimersByTimeAsync(100);
            expect(await pending).toMatchObject({ code: 'PERMISSION_DENIED' });
            expect(w.writes).toHaveLength(1);
            expect(w.db.recoveryState().blocked).toBe(0);
            expect([...w.journalRows.values()][0]).toMatchObject({ scope: 'project|user', uncertain: true });
        } finally { w.db.close('test'); }
    });

    it('ACK បាត់តែ៣ម៉ោង · op_id នៅ server ➜ replay បាន · បូកម្ដង', async () => {
        vi.useFakeTimers();
        const w = world();
        try {
            await turn();
            w.mode('drop');
            const pending = w.db.set(w.db.ref('ledger/day/codDollar'), new SbIncrement(5));
            await turn();
            expect(w.value()).toBe(105);
            w.db.goOffline();
            w.mode('down');
            await vi.advanceTimersByTimeAsync(3 * HOUR);
            w.mode('ok');
            w.db.goOnline();
            await vi.advanceTimersByTimeAsync(1000);
            await pending;
            expect(w.applied).toHaveLength(1);
            expect(w.value()).toBe(105);
            expect(w.journalRows.size).toBe(0);
        } finally { w.db.close('test'); }
    });
});
