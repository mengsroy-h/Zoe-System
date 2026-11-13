import { expect, it, vi } from 'vitest';
import { createSupabaseDatabase, SbRpcError } from '../../../ZoeW/src/services/supabase-rtdb';

const ROOT = 'zoew_daily_pickup_cod_dod';
const turn = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };

it('delta pickup រក្សា barcode ចាស់ · កែ metadata · លុប barcode · full reset នៅតែជំនួសពេញ', async () => {
    let round = 0;
    const calls: string[] = [];
    const replies = [
        { seq: 1, reset: true, rows: [{ r: ROOT, k: '2026-11-05', s: 1, v: { packagesPickedUp: 1, pickedUpBarcodes: { A: '0970000001' } } }] },
        { seq: 2, reset: false, rows: [{ r: ROOT, k: '2026-11-05', s: 2, d: [{ p: ['packagesPickedUp'], v: 2 }, { p: ['pickedUpBarcodes', 'B'], v: '0970000002' }] }] },
        { seq: 3, reset: false, rows: [{ r: ROOT, k: '2026-11-05', s: 3, d: [{ p: ['packagesPickedUp'], v: 1 }, { p: ['pickedUpBarcodes', 'A'], v: null }] }] },
        { seq: 4, reset: true, rows: [{ r: ROOT, k: '2026-11-05', s: 4, v: { packagesPickedUp: 0 } }] }
    ];
    const db = createSupabaseDatabase({ rpc: async (fn: string) => { calls.push(fn); return { ...replies[round], more: false, now: Date.now() }; }, subscribe: () => () => {} },
        { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() }, { deltaPull: true, pollFallbackMs: 600000 });
    let view: any;
    db.setAuthed(true, 'scope');
    db.onValue(db.ref(ROOT), (s: any) => { view = s.val(); });
    try {
        await turn();
        round++; db.onBrowserOnline(); await turn();
        expect(view['2026-11-05']).toEqual({ packagesPickedUp: 2, pickedUpBarcodes: { A: '0970000001', B: '0970000002' } });
        round++; db.onBrowserOnline(); await turn();
        expect(view['2026-11-05']).toEqual({ packagesPickedUp: 1, pickedUpBarcodes: { B: '0970000002' } });
        round++; db.onBrowserOnline(); await turn();
        expect(view['2026-11-05']).toEqual({ packagesPickedUp: 0 });
        expect(calls.every((fn) => fn === 'zoe_pull_delta')).toBe(true);
    } finally { db.close('test'); }
});

it('server ចាស់គ្មាន delta RPC ➜ អានពេញដោយ zoe_pull ចាស់', async () => {
    const calls: string[] = [];
    const db = createSupabaseDatabase({ rpc: async (fn: string) => {
        calls.push(fn);
        if (fn === 'zoe_pull_delta') throw new SbRpcError('function missing', 'PGRST202', 404, '');
        return { seq: 1, reset: true, more: false, rows: [], now: Date.now() };
    }, subscribe: () => () => {} }, { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() }, { deltaPull: true });
    try { db.setAuthed(true, 'scope'); await turn(); expect(calls).toEqual(['zoe_pull_delta', 'zoe_pull']); }
    finally { db.close('test'); }
});

it('delta គ្មាន basis មិនបោះបង់ snapshot ចាស់ ហើយការអានបន្ទាប់សុំ full snapshot', async () => {
    const cursors: number[] = [];
    let releaseFull!: () => void;
    const fullReady = new Promise<void>((resolve) => { releaseFull = resolve; });
    const replies = [
        { seq: 1, reset: true, rows: [{ r: ROOT, k: 'old', s: 1, v: { packagesPickedUp: 1 } }] },
        { seq: 2, reset: false, rows: [{ r: ROOT, k: 'missing', s: 2, d: [{ p: ['packagesPickedUp'], v: 2 }] }] },
        { seq: 2, reset: true, rows: [{ r: ROOT, k: 'missing', s: 2, v: { packagesPickedUp: 2 } }] }
    ];
    const db = createSupabaseDatabase({ rpc: async (_fn, args) => {
        const index = cursors.length; cursors.push(args.p_since);
        if (index >= 2) await fullReady;
        const reply = replies[Math.min(index, 2)];
        return { ...reply, more: false, now: Date.now() };
    }, subscribe: () => () => {} }, { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() },
    { deltaPull: true, pollFallbackMs: 600000, retryStepsMs: [600000] });
    let view: any;
    try {
        db.setAuthed(true, 'scope'); db.onValue(db.ref(ROOT), (s: any) => { view = s.val(); }); await turn();
        db.onBrowserOnline(); await turn();
        expect(view).toEqual({ old: { packagesPickedUp: 1 } });
        expect(cursors).toContain(1);
        expect(cursors.at(-1)).toBe(0);
        releaseFull(); await turn();
        expect(view).toEqual({ missing: { packagesPickedUp: 2 } });
    } finally { db.close('test'); }
});

it('delta RPC 401 មិន fallback ទៅ API ចាស់', async () => {
    const forbidden = vi.fn(), calls: string[] = [];
    const db = createSupabaseDatabase({ rpc: async (fn) => {
        calls.push(fn); throw new SbRpcError('revoked', '401', 401, '');
    }, subscribe: () => () => {} }, { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: forbidden, onTxOutcomeUnknown: vi.fn() }, { deltaPull: true });
    try { db.setAuthed(true, 'scope'); await turn(); expect(calls).toEqual(['zoe_pull_delta']); expect(forbidden).toHaveBeenCalledOnce(); }
    finally { db.close('test'); }
});
