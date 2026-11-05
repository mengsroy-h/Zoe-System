// S3 (deep audit 8): a Supabase project restore (PITR · backup) moves the shop's seq head backwards. The adapter's cursor is
// then past the head ➜ the server answers a full `reset`. The swap kept every doc of the old view whose seq is above the new
// head, as if it were this device's write landing during the pull ➜ docs the restore removed stayed on every open tab (and in
// the docs cache), and real updates of those docs with a lower seq were ignored. When the head went backwards only this
// device's own write and read answers since the last complete pull survive the swap.
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';

const H = 'zoew_scan_history_cod_dod';
const turn = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const hooks = () => ({ onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() });

function restoredProject() {
    const state = { phase: 1, duringPull: null as null | (() => Promise<void>) };
    const transport = {
        subscribe: () => () => {},
        ping: async () => true,
        rpc: async (fn: string, args: any) => {
            if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe('A');
                const op = args.p_ops[0];
                return { ok: true, seq: 6, docs: [{ r: H, k: op.p[1], v: op.v, s: 6 }] };
            }
            if (fn !== 'zoe_pull') return { ok: true, docs: [], now: 1 };
            if (state.phase === 1) {
                return { seq: 10, more: false, reset: true, tenant: 'A', head: 10, now: 1, rows: [
                    { r: H, k: 'keep', v: { n: 1 }, s: 3 },
                    { r: H, k: 'zombie', v: { n: 2 }, s: 8 }] };
            }
            if (state.duringPull) { const run = state.duringPull; state.duringPull = null; await run(); }
            return { seq: 5, more: false, reset: true, tenant: 'A', head: 5, now: 2, rows: [{ r: H, k: 'keep', v: { n: 1 }, s: 3 }] };
        }
    };
    const db: any = createSupabaseDatabase(transport, hooks(), { pollFallbackMs: 10 ** 9 });
    return { db, state };
}

async function viewAfterRestore(writeDuringPull: boolean) {
    const { db, state } = restoredProject();
    db.setTenantTopic('zoe:A');
    db.setAuthed(true, 'project|user');
    await turn();
    state.phase = 2;
    if (writeDuringPull) state.duringPull = () => db.set(db.ref(H + '/mine'), { n: 'mine' });
    db.onBrowserOnline();
    await turn();
    let view: any = null;
    db.onValue(db.ref(H), (s: any) => { view = s.val(); });
    await turn();
    const cursor = db.cursor();
    db.close('t');
    return { cursor, keys: Object.keys(view || {}).sort() };
}

describe('S3 ៖ head ថយក្រោយ (ស្តារគម្រោង Supabase) ➜ គ្មាន doc ខ្មោច', () => {
    it('a doc the restore removed leaves the view', async () => {
        expect(await viewAfterRestore(false)).toEqual({ cursor: 5, keys: ['keep'] });
    });

    it('control ៖ this device\'s write landing during that pull stays', async () => {
        expect(await viewAfterRestore(true)).toEqual({ cursor: 5, keys: ['keep', 'mine'] });
    });
});
