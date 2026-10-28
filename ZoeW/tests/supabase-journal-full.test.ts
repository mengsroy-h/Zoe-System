// S6 (deep audit 8): the Supabase write journal lives in localStorage beside every other App store. When it cannot take a
// row (storage full on a big shop), the write is refused before the send — a transaction rejected as «WRITE JOURNAL
// UNAVAILABLE» (spaces) without `txOutcome`, a set/update as `WRITE_JOURNAL_UNAVAILABLE`. A write refused before the send
// carries one code and `txOutcome: 'not-applied'` on every path (Firebase parity), and nothing reaches the server.
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';

const H = 'zoew_scan_history_cod_dod';
const turn = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };

function openWithFullJournal() {
    const writes: any[] = [];
    const transport = {
        subscribe: () => () => {},
        ping: async () => true,
        rpc: async (fn: string, args: any) => {
            if (fn === 'zoe_write') { writes.push(args); return { ok: true, seq: 2, docs: [] }; }
            if (fn === 'zoe_pull') return { seq: 1, more: false, reset: true, tenant: 'A', head: 1, now: 1, rows: [] };
            if (fn === 'zoe_read') return { docs: [] };
            return { ok: true, docs: [], now: 1 };
        }
    };
    const journal = { list: () => [], put: () => false, remove: () => true, removeMany: () => true };
    const db: any = createSupabaseDatabase(transport, { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn(), onWriteRecovery: vi.fn() },
        { pollFallbackMs: 10 ** 9, writeJournal: journal });
    db.setTenantTopic('zoe:A');
    db.setAuthed(true, 'project|user');
    return { db, writes };
}

describe('S6 ៖ journal ពេញ ➜ បដិសេធមុនផ្ញើ ជាមួយ code តែមួយ និង txOutcome not-applied', () => {
    it('transaction and set alike', async () => {
        const { db, writes } = openWithFullJournal();
        await turn();
        const tx = await db.runTransaction(db.ref(H + '/it1'), () => ({ n: 1 })).then(() => null, (e: any) => e);
        const set = await db.set(db.ref(H + '/it2'), { n: 2 }).then(() => null, (e: any) => e);
        db.close('t');
        expect([tx && tx.code, tx && tx.txOutcome, set && set.code, set && set.txOutcome])
            .toEqual(['WRITE_JOURNAL_UNAVAILABLE', 'not-applied', 'WRITE_JOURNAL_UNAVAILABLE', 'not-applied']);
        expect(writes).toEqual([]);
    });
});
