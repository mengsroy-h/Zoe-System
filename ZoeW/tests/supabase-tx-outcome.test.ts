/**
 * ⛔ transaction (CAS) លើ Supabase ពេលចម្លើយបាត់ ៖ លទ្ធផល *មិនទាន់ដឹង* មិនមែន *មិនអាចដឹង* — `zoe_ops` រក្សាលទ្ធផល op_id ២ ថ្ងៃ ➜
 *    adapter ផ្ញើ op_id ដដែលរហូតបានចម្លើយច្បាស់ (applied · not-applied) ទោះបណ្តាញដាច់យូរ។ `unknown` + `txServerUnread` នៅសល់តែពេល
 *    server **បដិសេធ** (មិនមែនបណ្តាញ) ក្រោយចម្លើយបាត់ ឬ adapter បិទ ➜ ledger reconcile មិនរាយ ok (`ledgerRejectionVerdict()`)។
 *    មុនកែ ៖ បោះបង់ក្រោយ ៦០ វិ. ➜ «ដក» ធ្វើឲ្យកញ្ចប់បាត់ · reconcile ដក ២ ដង (audit-tools/tx-outcome-test.js ផ្នែក ៤ឃ · ៦)។
 *    client ពិត + SQL ពិត ៖ audit-tools/emu/supabase-adapter-parity-test.js។
 */
import { describe, expect, it, vi } from 'vitest';
import { SbNetworkError, SbRpcError, createSupabaseDatabase } from '../src/services/supabase-rtdb';
import { txDisconnectResolving } from '../src/services/tx-disconnect';

type Mode = 'ok' | 'drop' | 'down' | 'forbidden';

function fakeServer() {
    let mode: Mode = 'ok';
    let seq = 0;
    let value: any = null;
    const done = new Map<string, any>();
    const writes: string[] = [];
    const doc = () => ({ r: 'tx', k: 'a', v: value === null ? null : { n: value }, s: seq });
    const apply = (args: any) => {
        const prior = done.get(args.p_op_id);
        if (prior) return Object.assign({}, prior, { replayed: true, now: Date.now() });
        const op = args.p_ops[0];
        const current = value === null ? null : { n: value };
        if (JSON.stringify(op.x === undefined ? null : op.x) !== JSON.stringify(current)) return { ok: false, conflict: true, now: Date.now(), value: current };
        value = op.v === null ? null : op.v.n;
        seq++;
        writes.push(args.p_op_id);
        const result = { ok: true, seq, now: Date.now(), docs: [doc()] };
        done.set(args.p_op_id, result);
        return result;
    };
    const transport = {
        rpc: async (fn: string, args: any) => {
            if (fn === 'zoe_pull') {
                if (mode === 'down' || mode === 'drop') throw new SbNetworkError('network');
                return { seq, more: false, reset: true, head: seq, tenant: 't1', now: Date.now(), rows: value === null ? [] : [doc()] };
            }
            if (fn !== 'zoe_write') throw new Error('unexpected ' + fn);
            if (mode === 'down') throw new SbNetworkError('network');
            if (mode === 'forbidden') throw new SbRpcError('forbidden', '42501', 403, '');
            const res = apply(args);
            if (mode === 'drop') throw new SbNetworkError('timeout');
            return res;
        },
        ping: async () => true,
        subscribe: () => () => {}
    };
    return {
        transport, writes,
        setMode: (m: Mode) => { mode = m; },
        value: () => value,
        foreignWrite: (n: number) => { value = n; seq++; }
    };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function open(server: ReturnType<typeof fakeServer>, wait: (ms: number) => Promise<unknown> = sleep) {
    const unknown: string[] = [];
    const db = createSupabaseDatabase(server.transport, {
        onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: (p: string[]) => { unknown.push(p.join('/')); }
    }, { retryStepsMs: [5, 10, 20], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
    db.setAuthed(true, 'scope');
    let fired = false;
    db.onValue(db.ref('tx'), () => { fired = true; });
    for (let i = 0; i < 100 && !fired; i++) await wait(5);
    expect(fired).toBe(true);
    return { db, unknown };
}

describe('Supabase CAS ៖ ចម្លើយបាត់ ➜ រង់ចាំលទ្ធផលពិត (op_id ដដែល)', () => {
    it('ចម្លើយបាត់ក្រោយ commit + server ធ្លាក់ ២ នាទី ➜ នៅរង់ចាំ (មិនបោះបង់) ➜ server មកវិញ ➜ applied តែម្តង', async () => {
        vi.useFakeTimers();
        try {
            const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);
            const server = fakeServer();
            const { db, unknown } = await open(server, wait);
            server.setMode('drop');
            let state: any = 'pending';
            const tx = db.runTransaction(db.ref('tx/a'), (v: any) => ({ n: ((v && v.n) || 0) + 1 }));
            tx.then((r: any) => { state = r; }, (e: any) => { state = e; });
            await wait(30);
            server.setMode('down');
            await wait(120000);
            expect(state).toBe('pending');
            expect(txDisconnectResolving.get(tx)).toBeTruthy();
            server.setMode('ok');
            await wait(60000);
            expect(state.committed).toBe(true);
            expect(state.txOutcome).toBe('applied');
            expect(server.value()).toBe(1);
            expect(server.writes.length).toBe(1);
            expect(unknown).toEqual([]);
            db.close('test');
        } finally {
            vi.useRealTimers();
        }
    });

    it('សំណើមិនដល់ server + អ្នកផ្សេងសរសេរ ➜ server មកវិញ ➜ conflict ➜ not-applied (មិនទាយ)', async () => {
        const server = fakeServer();
        const { db } = await open(server);
        server.setMode('down');
        const tx = db.runTransaction(db.ref('tx/a'), (v: any) => ({ n: ((v && v.n) || 0) + 1 })).then(() => null, (e: any) => e);
        await sleep(100);
        server.foreignWrite(5);
        server.setMode('ok');
        const err: any = await tx;
        expect(err && err.message).toBe('disconnect');
        expect(err.txOutcome).toBe('not-applied');
        expect(err.txServerUnread).toBeUndefined();
        expect(server.value()).toBe(5);
        db.close('test');
    });

    it('ចម្លើយបាត់ រួច server បដិសេធ (403) ➜ unknown + txServerUnread (ការសរសេរប្រហែលចុះរួច · មិនមែន permission_denied ធម្មតា)', async () => {
        const server = fakeServer();
        const { db, unknown } = await open(server);
        server.setMode('drop');
        const tx = db.runTransaction(db.ref('tx/a'), (v: any) => ({ n: ((v && v.n) || 0) + 1 })).then(() => null, (e: any) => e);
        await sleep(30);
        server.setMode('forbidden');
        const err: any = await tx;
        expect(err && err.txOutcome).toBe('unknown');
        expect(err.txServerUnread).toBe(true);
        expect(unknown).toEqual(['tx/a']);
        expect(server.value()).toBe(1);
        db.close('test');
    });

    it('adapter បិទខណៈរង់ចាំ ➜ unknown + txServerUnread', async () => {
        const server = fakeServer();
        const { db } = await open(server);
        server.setMode('down');
        const tx = db.runTransaction(db.ref('tx/a'), (v: any) => ({ n: ((v && v.n) || 0) + 1 })).then(() => null, (e: any) => e);
        await sleep(60);
        db.close('test');
        const err: any = await tx;
        expect(err && err.txOutcome).toBe('unknown');
        expect(err.txServerUnread).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ គ្មានបញ្ហាបណ្តាញ ➜ committed ធម្មតា គ្មាន txOutcome', async () => {
        const server = fakeServer();
        const { db } = await open(server);
        const res: any = await db.runTransaction(db.ref('tx/a'), (v: any) => ({ n: ((v && v.n) || 0) + 1 }));
        expect(res.committed).toBe(true);
        expect(res.txOutcome).toBeUndefined();
        expect(server.value()).toBe(1);
        db.close('test');
    });
});
