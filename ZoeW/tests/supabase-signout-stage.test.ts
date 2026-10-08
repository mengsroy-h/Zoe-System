import { describe, expect, it } from 'vitest';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';

const HIST = 'zoew_scan_history_cod_dod';
const SCOPE = 'https://abcdefghijklmnopqrst.supabase.co|u1';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeServer(live: number) {
    const rows = new Map<string, any>();
    let head = 0;
    const purged = 0;
    const set = (k: string, v: any) => { head++; rows.set(k, { r: HIST, k, v, s: head }); };
    for (let i = 1; i <= live; i++) set('i' + i, { n: i });
    const calls: any[] = [];
    let gate: null | ((v?: any) => void) = null;
    let hangNextAt = -1;
    const pull = (args: any) => {
        let since = Number(args.p_since) || 0;
        let fh = typeof args.p_full_head === 'number' ? args.p_full_head : null;
        if (fh !== null && (since <= 0 || fh < purged || fh > head)) fh = null;
        if (since < 0 || since > head || (since > 0 && since < purged && fh === null)) since = 0;
        const full = since === 0;
        if (full) fh = head;
        const tombAfter = fh === null ? since : fh;
        const visible = Array.from(rows.values()).filter((x) => x.s > since && (x.v !== null || x.s > tombAfter)).sort((a, b) => a.s - b.s);
        const page = visible.slice(0, args.p_limit);
        const upper = page.length ? page[page.length - 1].s : since;
        const more = visible.length > page.length;
        return { seq: more ? upper : Math.max(upper, head), more, reset: full, head, tenant: 'T1', now: Date.now(), rows: page.map((x) => ({ ...x })) };
    };
    const transport = {
        rpc: async (fn: string, args: any) => {
            calls.push({ ...args });
            if (calls.length - 1 === hangNextAt) {
                const out = pull(args);
                await new Promise((r) => { gate = r; });
                return out;
            }
            return pull(args);
        },
        ping: async () => true,
        subscribe: () => () => {}
    };
    return { transport, calls, rows, head: () => head, hangAt: (n: number) => { hangNextAt = n; }, release: () => gate && gate() };
}

function memCache() {
    const store = new Map<string, any>();
    const log: string[] = [];
    return {
        store, log,
        load: (scope: string) => { log.push('load'); return Promise.resolve(store.has(scope) ? structuredClone(store.get(scope)) : null); },
        save: (scope: string, rec: any) => { log.push('save:' + rec.docs.length); store.clear(); store.set(scope, structuredClone(rec)); return Promise.resolve(true); },
        clear: () => { log.push('clear'); store.clear(); return Promise.resolve(true); }
    };
}

function open(srv: ReturnType<typeof fakeServer>, cache: ReturnType<typeof memCache>, ev: { synced: number }) {
    const db: any = createSupabaseDatabase(srv.transport, { onListenerError: () => {}, onSynced: () => { ev.synced++; }, onForbidden: () => {}, onTxOutcomeUnknown: () => {} },
        { pullPage: 2, retryStepsMs: [20, 40], pollFallbackMs: 600000, docsCache: cache, docsCacheFirstSaveMs: 5, docsCacheMinIntervalMs: 5 });
    const seen: { view: any } = { view: 'unset' };
    db.onValue(db.ref(HIST), (s: any) => { seen.view = s.val(); });
    return { db, seen };
}

describe('sign-out during a staged full pull (SUPABASE-4) ៖ the next session never adopts the old stage', () => {
    it('1. sign-out mid page 2 ➜ re-login with a valid docs cache (cursor = head) ➜ view and saved cache hold all 9 parcels', async () => {
        const srv = fakeServer(9);
        const cache = memCache();
        const ev = { synced: 0 };
        const { db, seen } = open(srv, cache, ev);
        srv.hangAt(1);
        db.setAuthed(true, SCOPE);
        await wait(20);
        db.resetForSignOut();
        srv.release();
        await wait(20);
        const docs = Array.from(srv.rows.values()).map((r: any) => [r.r, r.k, r.v, r.s]);
        cache.store.set(SCOPE, { v: 1, scope: SCOPE, tenant: 'T1', cursor: srv.head(), docs });
        db.setAuthed(true, SCOPE);
        await wait(120);
        expect(Object.keys(seen.view || {}).length).toBe(9);
        expect(db.isReady()).toBe(true);
        expect((cache.store.get(SCOPE) || { docs: [] }).docs.length).toBe(9);
        db.close();
    });

    it('2. reverse ៖ the same interrupted page without sign-out continues the staged pull ➜ 9 parcels', async () => {
        const srv = fakeServer(9);
        const cache = memCache();
        const ev = { synced: 0 };
        const { db, seen } = open(srv, cache, ev);
        srv.hangAt(1);
        db.setAuthed(true, SCOPE);
        await wait(20);
        expect(seen.view).toBe('unset');
        srv.release();
        await wait(120);
        expect(Object.keys(seen.view || {}).length).toBe(9);
        expect(db.isReady()).toBe(true);
        db.close();
    });
});
