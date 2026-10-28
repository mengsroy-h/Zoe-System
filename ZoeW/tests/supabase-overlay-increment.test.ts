// Checker audit (deep audit 8 · C11): while a Supabase write is in flight the adapter shows its own optimistic overlay
// (Firebase parity: a local write is visible at once). `increment()` must add to the value shown, never overwrite it ➜ a
// stats increment of 5 on a ledger of 10 shows 15, not 5, until the server answers. Tests asserted only the ops sent.
import { describe, expect, it, vi } from 'vitest';
import * as rtdb from '../src/services/supabase-rtdb';

const D = 'zoew_daily_revenue_cod_dod';
const turn = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };

describe('C11 ៖ overlay របស់ increment() បូក មិនជំនួស', () => {
    it('ledger 10 + increment(5) in flight ➜ the view shows 15', async () => {
        let release: (v: any) => void = () => {};
        const transport = {
            subscribe: () => () => {},
            ping: async () => true,
            rpc: async (fn: string) => {
                if (fn === 'zoe_pull') return { seq: 1, more: false, reset: true, tenant: 'A', head: 1, now: 1, rows: [{ r: D, k: '2026-10-20', v: { codDollar: 10 }, s: 1 }] };
                if (fn === 'zoe_write') return new Promise((resolve) => { release = resolve; });
                return { ok: true, docs: [], now: 1 };
            }
        };
        const db: any = rtdb.createSupabaseDatabase(transport, { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() }, { pollFallbackMs: 10 ** 9 });
        db.setTenantTopic('zoe:A');
        db.setAuthed(true, 'project|user');
        await turn();
        let view: any = null;
        db.onValue(db.ref(D + '/2026-10-20'), (s: any) => { view = s.val(); });
        await turn();
        expect(view).toEqual({ codDollar: 10 });
        const inc = db.increment ? db.increment(5) : new (rtdb as any).SbIncrement(5);
        const write = db.update(db.ref(D + '/2026-10-20'), { codDollar: inc }).catch(() => null);
        await turn();
        expect(view).toEqual({ codDollar: 15 });
        release({ ok: true, seq: 2, docs: [{ r: D, k: '2026-10-20', v: { codDollar: 15 }, s: 2 }] });
        await write;
        db.close('t');
    });
});
