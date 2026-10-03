/**
 * ⛔ ការទាញពេញជាទំព័រលើ Supabase (`zoe_pull`) ៖ ទំព័របន្តផ្ញើ `p_full_head` (head ពីទំព័រ reset) តែពេល server ឆ្លើយ `head` ·
 *    server ចាស់ (គ្មាន `head` · បដិសេធ argument ថ្មី) មិនដែលទទួល `p_full_head` · server ដែល reset រហូត ➜ ឈប់ក្រោយ
 *    `SB_PULL_MAX_RESTARTS` (មិនខាត egress · មិនបង្ហាញទិន្នន័យកន្លះជាពេញ) · ការទាញដែលដាច់កណ្តាលទី ➜ បន្តពី cursor (មិនចាប់ផ្តើមពីទំព័រ ១)។
 *    SQL ពិតវាស់ក្នុង audit-tools/supabase-datastore-test.js · client ពិត + SQL ពិតក្នុង emu/supabase-adapter-parity-test.js។
 */
import { describe, expect, it } from 'vitest';
import { SB_PULL_MAX_RESTARTS, SbNetworkError, SbRpcError, createSupabaseDatabase } from '../src/services/supabase-rtdb';
import { docsCacheRecordIsValid } from '../src/services/supabase-docs-cache';

type Row = { r: string; k: string; v: any; s: number };

const HIST = 'zoew_scan_history_cod_dod';

function fakeServer(opts: { fullHead: boolean; live: number; purge: boolean; tenant?: string }) {
    const rows = new Map<string, Row>();
    let head = 0;
    let purged = 0;
    const set = (k: string, v: any) => { head++; rows.set(k, { r: HIST, k, v, s: head }); };
    const purgeTombstones = () => {
        rows.forEach((row, k) => { if (row.v === null) { purged = Math.max(purged, row.s); rows.delete(k); } });
    };
    for (let i = 1; i <= opts.live; i++) set('i' + i, { n: i });
    for (let i = 1; i <= 5; i++) { set('x' + i, { gone: i }); set('x' + i, null); }
    if (opts.purge) purgeTombstones();
    const calls: any[] = [];
    let dropAt = -1;
    const pull = (args: any) => {
        calls.push(Object.assign({}, args));
        if (calls.length - 1 === dropAt) throw new SbNetworkError('network');
        if (!opts.fullHead && 'p_full_head' in args) throw new SbRpcError('Could not find the function', 'PGRST202', 404, '');
        let since = Number(args.p_since) || 0;
        let fh = opts.fullHead && typeof args.p_full_head === 'number' ? args.p_full_head : null;
        if (fh !== null && (since <= 0 || fh < purged || fh > head)) fh = null;
        if (since < 0 || since > head || (since > 0 && since < purged && fh === null)) since = 0;
        const full = since === 0;
        if (full) fh = head;
        const tombAfter = fh === null ? since : fh;
        const visible = Array.from(rows.values()).filter((x) => x.s > since && (x.v !== null || x.s > tombAfter)).sort((a, b) => a.s - b.s);
        const page = visible.slice(0, args.p_limit);
        const upper = page.length ? page[page.length - 1].s : since;
        const more = visible.length > page.length;
        const out: any = { seq: more ? upper : Math.max(upper, head), more, reset: full, now: Date.now(), rows: page.map((x) => Object.assign({}, x)) };
        if (opts.fullHead) out.head = head;
        if (opts.fullHead && opts.tenant !== undefined) out.tenant = opts.tenant;
        return out;
    };
    const transport = {
        rpc: async (fn: string, args: any) => {
            if (fn !== 'zoe_pull') throw new Error('unexpected ' + fn);
            return pull(args);
        },
        ping: async () => true,
        subscribe: () => () => {}
    };
    return {
        transport, calls, set, purgeTombstones, rows,
        head: () => head, purged: () => purged,
        dropNext: (n: number) => { dropAt = n; }
    };
}

function open(server: ReturnType<typeof fakeServer>, pullPage: number, retryStepsMs = [20, 40], extra: any = {}) {
    const events = { synced: 0, forbidden: 0, fired: 0 };
    const db = createSupabaseDatabase(server.transport, {
        onListenerError: () => {}, onSynced: () => { events.synced++; }, onForbidden: () => { events.forbidden++; }, onTxOutcomeUnknown: () => {}
    }, Object.assign({ pullPage, retryStepsMs, pollFallbackMs: 600000 }, extra));
    let view: any = 'unset';
    db.onValue(db.ref(HIST), (s: any) => { view = s.val(); events.fired++; });
    return { db, events, view: () => view };
}

function memCache() {
    const store = new Map<string, any>();
    const log: string[] = [];
    let hangLoad = false;
    return {
        store, log,
        hang: () => { hangLoad = true; },
        load: (scope: string) => { log.push('load ' + scope); return hangLoad ? new Promise(() => {}) : Promise.resolve(store.has(scope) ? structuredClone(store.get(scope)) : null); },
        save: (scope: string, rec: any) => { log.push('save ' + scope); store.clear(); store.set(scope, structuredClone(rec)); return Promise.resolve(true); },
        clear: () => { log.push('clear'); store.clear(); return Promise.resolve(true); }
    };
}

function cacheRecord(srv: ReturnType<typeof fakeServer>, scope: string, tenant: string, extraDocs: any[] = []) {
    const docs = Array.from(srv.rows.values()).filter((r) => r.v !== null).map((r) => [r.r, r.k, r.v, r.s]).concat(extraDocs);
    return { v: 1, scope, tenant, cursor: srv.head(), docs };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('zoe_pull ៖ ទាញពេញជាទំព័រ', () => {
    it('listener ចុះឈ្មោះមុនចូលប្រព័ន្ធ · ចូលប្រព័ន្ធក្នុងពេល ping ➜ ការទាញមិនបាត់ (មិនរង់ចាំ realtime/ព្រឹត្តិការណ៍ផ្សេង)', async () => {
        const srv = fakeServer({ fullHead: true, live: 3, purge: false });
        let releasePing: () => void = () => {};
        srv.transport.ping = () => new Promise<boolean>((r) => { releasePing = () => r(true); });
        const c = open(srv, 2000, [5000]);
        await wait(5);
        expect(srv.calls.length).toBe(0);
        c.db.setAuthed(true);
        releasePing();
        await wait(20);
        expect(srv.calls.length).toBe(1);
        expect(Object.keys(c.view() || {}).sort()).toEqual(['i1', 'i2', 'i3']);
        c.db.close();
    });

    it('server ថ្មី ៖ purged លើសព្រំទំព័រ ➜ ទំព័របន្តផ្ញើ p_full_head ➜ បញ្ចប់ក្នុងចំនួនទំព័រ', async () => {
        const srv = fakeServer({ fullHead: true, live: 9, purge: true });
        const c = open(srv, 2);
        c.db.setAuthed(true);
        await wait(50);
        expect(Object.keys(c.view() || {}).length).toBe(9);
        expect(srv.calls.length).toBe(5);
        expect(srv.calls[0].p_full_head).toBeUndefined();
        expect(srv.calls.slice(1).every((a) => a.p_full_head === srv.head())).toBe(true);
        expect(c.events.synced).toBe(1);
        c.db.close();
    });

    it('server ចាស់ (គ្មាន head) ដែល reset រហូត ➜ មិនផ្ញើ p_full_head · ឈប់ក្រោយ SB_PULL_MAX_RESTARTS · មិនបង្ហាញទិន្នន័យកន្លះ', async () => {
        const srv = fakeServer({ fullHead: false, live: 9, purge: true });
        const c = open(srv, 2, [5000]);
        c.db.setAuthed(true);
        await wait(40);
        const firstRound = srv.calls.length;
        c.db.close();
        expect(srv.calls.every((a) => !('p_full_head' in a))).toBe(true);
        expect(firstRound).toBe(SB_PULL_MAX_RESTARTS + 2);
        expect(c.view()).toBe('unset');
        expect(c.events.synced).toBe(0);
        expect(c.db.isReady()).toBe(false);
    });

    it('server ចាស់ ៖ purged = 0 ➜ ដំណើរការដូចមុន (គ្មាន p_full_head)', async () => {
        const srv = fakeServer({ fullHead: false, live: 9, purge: false });
        const c = open(srv, 2);
        c.db.setAuthed(true);
        await wait(50);
        expect(Object.keys(c.view() || {}).length).toBe(9);
        expect(srv.calls.every((a) => !('p_full_head' in a))).toBe(true);
        c.db.close();
    });

    it('ក្នុងសម័យ ៖ cursor ចាស់ជាង purge (doc ត្រូវលុប ហើយ tombstone ត្រូវ purge) ➜ reset ច្រើនទំព័រ ➜ គ្មាន doc ខ្មោចនៅសល់', async () => {
        const srv = fakeServer({ fullHead: true, live: 9, purge: false });
        const c = open(srv, 2);
        c.db.setAuthed(true);
        await wait(50);
        expect(Object.keys(c.view() || {}).length).toBe(9);
        srv.set('i8', null);
        srv.set('i10', { n: 10 });
        srv.set('i11', { n: 11 });
        srv.purgeTombstones();
        expect(c.db.cursor()).toBeLessThan(srv.purged());
        const before = srv.calls.length;
        c.db.onBrowserOnline();
        await wait(50);
        expect(srv.calls[before].p_since).toBeGreaterThan(0);
        expect(srv.calls.length - before).toBeGreaterThan(2);
        expect(Object.keys(c.view() || {}).sort()).toEqual(['i1', 'i10', 'i11', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i9']);
        c.db.close();
    });

    it('ការទាញពេញដាច់កណ្តាលទី (បណ្តាញ) ➜ ជុំបន្ទាប់បន្តពី cursor ជាមួយ p_full_head (មិនចាប់ផ្តើមពីទំព័រ ១)', async () => {
        const srv = fakeServer({ fullHead: true, live: 9, purge: true });
        srv.dropNext(2);
        const c = open(srv, 2);
        c.db.setAuthed(true);
        await wait(120);
        expect(Object.keys(c.view() || {}).length).toBe(9);
        const resumed = srv.calls[3];
        expect(resumed.p_since).toBe(4);
        expect(resumed.p_full_head).toBe(srv.head());
        expect(srv.calls.filter((a) => a.p_since === 0).length).toBe(1);
        c.db.close();
    });
});

describe('cache zoe_docs (IndexedDB) ៖ egress តែប៉ុណ្ណោះ', () => {
    const SCOPE = 'https://abcdefghijklmnopqrst.supabase.co|u1';

    it('cache + delta ៖ ទាញតែពី cursor ក្នុង cache · listener បាញ់ម្តង ក្រោយ server ឆ្លើយ · ទិដ្ឋភាពស្មើ server', async () => {
        const srv = fakeServer({ fullHead: true, live: 9, purge: false, tenant: 'T1' });
        const cache = memCache();
        cache.store.set(SCOPE, cacheRecord(srv, SCOPE, 'T1'));
        const cachedCursor = srv.head();
        srv.set('i3', null);
        srv.set('i10', { n: 10 });
        const c = open(srv, 2000, [20, 40], { docsCache: cache });
        c.db.setAuthed(true, SCOPE);
        await wait(40);
        expect(srv.calls[0].p_since).toBe(cachedCursor);
        expect(srv.calls.length).toBe(1);
        expect(Object.keys(c.view() || {}).sort()).toEqual(['i1', 'i10', 'i2', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9']);
        expect(c.events.fired).toBe(1);
        c.db.close();
    });

    it('server មិនទាន់ឆ្លើយ ➜ listener មិនបាញ់ពី cache (មិនបង្ហាញទិន្នន័យចាស់ជាការពិត)', async () => {
        const srv = fakeServer({ fullHead: true, live: 4, purge: false, tenant: 'T1' });
        const cache = memCache();
        cache.store.set(SCOPE, cacheRecord(srv, SCOPE, 'T1'));
        srv.transport.rpc = () => new Promise(() => {});
        const c = open(srv, 2000, [20, 40], { docsCache: cache });
        c.db.setAuthed(true, SCOPE);
        await wait(40);
        expect(cache.log).toEqual(['load ' + SCOPE]);
        expect(c.view()).toBe('unset');
        expect(c.db.isReady()).toBe(false);
        c.db.close();
    });

    it('⛔ cache ហាងផ្សេង (tenant ខុស) ➜ បោះចោល · ទាញពេញពី 0 · គ្មាន doc ពី cache លេចចេញ', async () => {
        const srv = fakeServer({ fullHead: true, live: 4, purge: false, tenant: 'T1' });
        const cache = memCache();
        cache.store.set(SCOPE, cacheRecord(srv, SCOPE, 'T-OTHER', [[HIST, 'leak', { phone: '012' }, 1]]));
        const c = open(srv, 2000, [20, 40], { docsCache: cache });
        c.db.setAuthed(true, SCOPE);
        await wait(40);
        expect(srv.calls.map((a) => a.p_since)).toEqual([srv.head(), 0]);
        expect(Object.keys(c.view() || {}).sort()).toEqual(['i1', 'i2', 'i3', 'i4']);
        c.db.close();
    });

    it('⛔ server ចាស់ (គ្មាន tenant) ➜ មិនទុកចិត្ត cache · ទាញពេញពី 0 · មិនរក្សាទុក cache', async () => {
        const srv = fakeServer({ fullHead: true, live: 4, purge: false });
        const cache = memCache();
        cache.store.set(SCOPE, cacheRecord(srv, SCOPE, 'T1', [[HIST, 'leak', { phone: '012' }, 1]]));
        const c = open(srv, 2000, [20, 40], { docsCache: cache, docsCacheFirstSaveMs: 5 });
        c.db.setAuthed(true, SCOPE);
        await wait(60);
        expect(srv.calls.map((a) => a.p_since)).toEqual([srv.head(), 0]);
        expect(Object.keys(c.view() || {}).sort()).toEqual(['i1', 'i2', 'i3', 'i4']);
        expect(cache.log.filter((x) => x.startsWith('save'))).toEqual([]);
        c.db.close();
    });

    it('cache ចាស់ជាង purge ➜ server reset ➜ doc ក្នុង cache ដែលលុបរួចមិនរស់ឡើងវិញ', async () => {
        const srv = fakeServer({ fullHead: true, live: 6, purge: false, tenant: 'T1' });
        const cache = memCache();
        cache.store.set(SCOPE, cacheRecord(srv, SCOPE, 'T1'));
        srv.set('i2', null);
        srv.set('i7', { n: 7 });
        srv.purgeTombstones();
        const c = open(srv, 2, [20, 40], { docsCache: cache });
        c.db.setAuthed(true, SCOPE);
        await wait(60);
        expect(srv.calls[0].p_since).toBeLessThan(srv.purged());
        expect(Object.keys(c.view() || {}).sort()).toEqual(['i1', 'i3', 'i4', 'i5', 'i6', 'i7']);
        c.db.close();
    });

    it('cache cursor លើស head (DB ស្តារ/ជំនួស · ហាងដដែល) ➜ reset ➜ doc ក្នុង cache មិនរស់ឡើងវិញ', async () => {
        const srv = fakeServer({ fullHead: true, live: 3, purge: false, tenant: 'T1' });
        const cache = memCache();
        const rec = cacheRecord(srv, SCOPE, 'T1', [[HIST, 'ghost', { phone: '012' }, srv.head() + 50]]);
        rec.cursor = srv.head() + 60;
        cache.store.set(SCOPE, rec);
        const c = open(srv, 2000, [20, 40], { docsCache: cache });
        c.db.setAuthed(true, SCOPE);
        await wait(40);
        expect(srv.calls.map((a) => a.p_since)).toEqual([srv.head() + 60]);
        expect(Object.keys(c.view() || {}).sort()).toEqual(['i1', 'i2', 'i3']);
        c.db.close();
    });

    it('រក្សាទុកក្រោយ sync ៖ scope · tenant ពី server · cursor · doc រស់តែប៉ុណ្ណោះ (tombstone ពី delta មិនចូល) · ផ្ទុកវិញបាន', async () => {
        const srv = fakeServer({ fullHead: true, live: 3, purge: false, tenant: 'T1' });
        const cache = memCache();
        const c = open(srv, 2000, [20, 40], { docsCache: cache, docsCacheFirstSaveMs: 5, docsCacheMinIntervalMs: 5 });
        c.db.setAuthed(true, SCOPE);
        await wait(40);
        srv.set('i2', null);
        c.db.onBrowserOnline();
        await wait(60);
        const rec = cache.store.get(SCOPE);
        expect(rec && rec.tenant).toBe('T1');
        expect(rec.cursor).toBe(srv.head());
        expect(rec.docs.map((d: any) => d[1]).sort()).toEqual(['i1', 'i3']);
        expect(docsCacheRecordIsValid(rec, SCOPE)).toBe(true);
        expect(cache.log.filter((x) => x.startsWith('save')).length).toBe(2);
        c.db.close();
    });

    it('⛔ ចាកចេញ ➜ លុប cache · ការរក្សាទុកដែលបានកំណត់ពេលត្រូវបោះបង់ · scope ថ្មីមិនទទួល cache ចាស់', async () => {
        const srv = fakeServer({ fullHead: true, live: 3, purge: false, tenant: 'T1' });
        const cache = memCache();
        const c = open(srv, 2000, [20, 40], { docsCache: cache, docsCacheFirstSaveMs: 30 });
        c.db.setAuthed(true, SCOPE);
        await wait(10);
        c.db.resetForSignOut();
        await wait(60);
        expect(cache.log).toEqual(['load ' + SCOPE, 'clear']);
        expect(cache.store.size).toBe(0);
        c.db.setAuthed(true, SCOPE.replace('u1', 'u2'));
        await wait(20);
        expect(cache.log[2]).toBe('load ' + SCOPE.replace('u1', 'u2'));
        c.db.close();
    });

    it('⛔ ការរក្សាទុកដែលចប់ក្រោយការចាកចេញ ➜ លុបម្តងទៀត (ទិន្នន័យមិនរស់ក្រោយចាកចេញ)', async () => {
        const srv = fakeServer({ fullHead: true, live: 3, purge: false, tenant: 'T1' });
        const cache = memCache();
        let releaseSave: () => void = () => {};
        const realSave = cache.save;
        cache.save = (scope: string, rec: any) => new Promise<boolean>((r) => { releaseSave = () => { realSave(scope, rec); r(true); }; });
        const c = open(srv, 2000, [20, 40], { docsCache: cache, docsCacheFirstSaveMs: 5 });
        c.db.setAuthed(true, SCOPE);
        await wait(40);
        c.db.resetForSignOut();
        releaseSave();
        await wait(10);
        expect(cache.store.size).toBe(0);
        expect(cache.log[cache.log.length - 1]).toBe('clear');
        c.db.close();
    });

    it('cache ព្យួរ ➜ ពិដាន ➜ ទាញពេញធម្មតា (cache មិនរាំង sync)', async () => {
        const srv = fakeServer({ fullHead: true, live: 3, purge: false, tenant: 'T1' });
        const cache = memCache();
        cache.hang();
        const c = open(srv, 2000, [20, 40], { docsCache: cache, docsCacheLoadMaxMs: 30 });
        c.db.setAuthed(true, SCOPE);
        await wait(10);
        expect(srv.calls.length).toBe(0);
        await wait(60);
        expect(srv.calls.map((a) => a.p_since)).toEqual([0]);
        expect(Object.keys(c.view() || {}).sort()).toEqual(['i1', 'i2', 'i3']);
        c.db.close();
    });
});
