import { afterEach, describe, expect, it } from 'vitest';
import { SbNetworkError, createSupabaseDatabase } from '../src/services/supabase-rtdb';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { barcodeRegistryKey, claimBarcodeInRegistry } from '../src/domain/registry';
import { firebaseState } from '../src/core/state';

type Mode = 'ok' | 'drop' | 'down';

function fakeServer() {
    let mode: Mode = 'ok';
    let seq = 0;
    const docs = new Map<string, any>();
    const done = new Map<string, any>();
    const writes: string[] = [];
    const rowOf = (key: string) => {
        const [r, k] = key.split('|');
        return { r, k, v: docs.has(key) ? docs.get(key) : null, s: seq };
    };
    const apply = (args: any) => {
        const prior = done.get(args.p_op_id);
        if (prior) return Object.assign({}, prior, { replayed: true });
        const op = args.p_ops[0];
        const key = op.p[0] + '|' + op.p[1];
        const current = docs.has(key) ? docs.get(key) : null;
        if (JSON.stringify(op.x === undefined ? null : op.x) !== JSON.stringify(current)) return { ok: false, conflict: true, value: current };
        if (op.v === null) docs.delete(key); else docs.set(key, op.v);
        seq++;
        writes.push(args.p_op_id);
        const result = { ok: true, seq, docs: [rowOf(key)] };
        done.set(args.p_op_id, result);
        return result;
    };
    const transport = {
        rpc: async (fn: string, args: any) => {
            if (fn === 'zoe_pull') {
                if (mode !== 'ok') throw new SbNetworkError('network');
                return { seq, more: false, reset: true, head: seq, tenant: 't1', now: Date.now(), rows: [...docs.keys()].map(rowOf) };
            }
            if (fn !== 'zoe_write') throw new Error('unexpected ' + fn);
            if (mode === 'down') {
                mode = 'ok';
                throw new SbNetworkError('timeout');
            }
            const res = apply(args);
            if (mode === 'drop') {
                mode = 'ok';
                throw new SbNetworkError('timeout');
            }
            return res;
        },
        ping: async () => true,
        subscribe: () => () => {}
    };
    return {
        transport, writes,
        dropNextReply: () => { mode = 'drop'; },
        loseNextRequest: () => { mode = 'down'; },
        foreignClaim: (key: string) => { docs.set('zoew_barcode_registry|' + key, true); seq++; },
        valueOf: (key: string) => (docs.has('zoew_barcode_registry|' + key) ? docs.get('zoew_barcode_registry|' + key) : null)
    };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openSupabase(server: ReturnType<typeof fakeServer>) {
    const db: any = createSupabaseDatabase(server.transport, {
        onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {}
    }, { retryStepsMs: [5, 10, 20], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
    db.setAuthed(true, 'scope');
    let fired = false;
    db.onValue(db.ref('zoew_barcode_registry'), () => { fired = true; });
    for (let i = 0; i < 100 && !fired; i++) await sleep(5);
    expect(fired).toBe(true);
    const sdk = { ref: (d: any, path: string) => d.ref(path), runTransaction: (ref: any, fn: any) => ref._db.runTransaction(ref, fn) };
    firebaseState.db = db;
    firebaseState.fb = withTransactionOutcomeResolution(sdk) as any;
    firebaseState.authGeneration++;
    return db;
}

afterEach(() => {
    firebaseState.db = null as any;
    firebaseState.fb = null as any;
});

describe('registry claim after a lost reply (SUPABASE-2) ៖ an op_id-proven commit is «claimed», an unproven «applied» stays «unknown»', () => {
    it('1. Supabase · reply lost after the server committed ➜ resent op_id answers ok ➜ «claimed» · one write · key = true', async () => {
        const server = fakeServer();
        await openSupabase(server);
        server.dropNextReply();
        const verdict = await claimBarcodeInRegistry('ZT001');
        expect(verdict).toBe('claimed');
        expect(server.writes.length).toBe(1);
        expect(server.valueOf(barcodeRegistryKey('ZT001'))).toBe(true);
    });

    it('2. Supabase · request lost, another device claims meanwhile ➜ resend conflicts ➜ never «claimed» · the other device keeps the key', async () => {
        const server = fakeServer();
        await openSupabase(server);
        const key = barcodeRegistryKey('ZT002');
        server.loseNextRequest();
        const pending = claimBarcodeInRegistry('ZT002');
        server.foreignClaim(key);
        const verdict = await pending;
        expect(verdict).not.toBe('claimed');
        expect(server.writes.length).toBe(0);
        expect(server.valueOf(key)).toBe(true);
    });

    it('3. Supabase · normal reply ➜ «claimed» · key already held ➜ «taken»', async () => {
        const server = fakeServer();
        await openSupabase(server);
        expect(await claimBarcodeInRegistry('ZT003')).toBe('claimed');
        expect(await claimBarcodeInRegistry('ZT003')).toBe('taken');
    });

    it('4. reverse ៖ «applied» without proof (Firebase REST read of a constant true) stays «unknown»', async () => {
        const db = { name: 'fb' };
        firebaseState.db = db as any;
        firebaseState.fb = {
            ref: (_d: any, path: string) => ({ path }),
            runTransaction: async (_ref: any, fn: any) => {
                fn(null);
                return { committed: true, snapshot: { val: () => true, exists: () => true }, txOutcome: 'applied' };
            }
        } as any;
        firebaseState.authGeneration++;
        expect(await claimBarcodeInRegistry('ZT004')).toBe('unknown');
    });
});
