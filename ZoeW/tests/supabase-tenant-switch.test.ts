import { describe, expect, it } from 'vitest';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';

type Row = { r: string; k: string; v: any; s: number };
const HIST = 'zoew_scan_history_cod_dod';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tenantServer(name: string, n: number) {
    const rows = new Map<string, Row>();
    let head = 0;
    const set = (k: string, v: any) => {
        head++;
        rows.set(k, { r: HIST, k, v, s: head });
    };
    for (let i = 1; i <= n; i++) set(name + '-i' + i, { shop: name, phone: '0' + i });
    return {
        name, rows, set, head: () => head,
        pull: (args: any) => {
            let since = Number(args.p_since) || 0;
            if (since < 0 || since > head) since = 0;
            const full = since === 0;
            const visible = Array.from(rows.values()).filter((x) => x.s > since).sort((a, b) => a.s - b.s);
            return { seq: head, head, more: false, reset: full, tenant: name, now: Date.now(), rows: visible.map((x) => Object.assign({}, x)) };
        }
    };
}

function open() {
    const A = tenantServer('A', 5);
    const B = tenantServer('B', 8);
    const state = { current: A };
    const calls: any[] = [];
    const transport = {
        rpc: async (fn: string, args: any) => {
            calls.push([fn, args.p_since]);
            if (fn !== 'zoe_pull') throw new Error(fn);
            return state.current.pull(args);
        },
        ping: async () => true,
        subscribe: () => () => {}
    };
    const store = new Map<string, any>();
    const cache = { load: async () => null, save: async (scope: string, rec: any) => { store.set(scope, structuredClone(rec)); return true; }, clear: async () => { store.clear(); return true; } };
    const db: any = createSupabaseDatabase(transport, { onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {} },
        { retryStepsMs: [10, 20], pollFallbackMs: 600000, docsCache: cache, docsCacheFirstSaveMs: 20, docsCacheMinIntervalMs: 20 });
    const seen: { view: any } = { view: null };
    db.onValue(db.ref(HIST), (s: any) => { seen.view = s.val(); });
    return { A, B, state, calls, store, db, seen };
}
const shopsOf = (view: any) => Array.from(new Set(Object.keys(view || {}).map((k) => view[k].shop))).sort();

describe('Supabase ៖ the signed-in account moves to another shop mid-session (SUPABASE-3) ➜ the view and cache hold only the new shop', () => {
    it('1. pull answers tenant B after A ➜ view = B only (8) · cache saved for B holds B docs only', async () => {
        const t = open();
        t.db.setAuthed(true, 'url|u1');
        t.db.setTenantTopic('zoe:A');
        await wait(40);
        expect(Object.keys(t.seen.view).length).toBe(5);
        t.state.current = t.B;
        t.db.setTenantTopic('zoe:B');
        t.db.onBrowserOnline();
        await wait(120);
        expect(shopsOf(t.seen.view)).toEqual(['B']);
        expect(Object.keys(t.seen.view).length).toBe(8);
        const saved = t.store.get('url|u1');
        expect(saved && saved.tenant).toBe('B');
        expect(Array.from(new Set(saved.docs.map((d: any) => d[2].shop)))).toEqual(['B']);
        t.db.close();
    });

    it('2. reverse ៖ same shop ➜ the next pull stays incremental (p_since = cursor) and keeps every doc', async () => {
        const t = open();
        t.db.setAuthed(true, 'url|u1');
        t.db.setTenantTopic('zoe:A');
        await wait(40);
        const cursor = t.db.cursor();
        t.A.set('A-i6', { shop: 'A', phone: '06' });
        const before = t.calls.length;
        t.db.onBrowserOnline();
        await wait(80);
        expect(t.calls.slice(before).every((c: any) => c[1] === cursor)).toBe(true);
        expect(Object.keys(t.seen.view).length).toBe(6);
        expect(shopsOf(t.seen.view)).toEqual(['A']);
        t.db.close();
    });
});
