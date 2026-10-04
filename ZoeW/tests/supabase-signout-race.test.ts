/**
 * ⛔ ចាកចេញខណៈការទាញ (`zoe_pull`) កំពុងរត់ ៖ ចម្លើយដែលមកក្រោយ `resetForSignOut()` ជារបស់សម័យចូលប្រព័ន្ធចាស់ ➜ មិនត្រូវប៉ះ cursor ·
 *    ឯកសារ · `ready` របស់សម័យថ្មីទេ។ ករណីពិត ៖ បើក App ក្រោយ ៤ ម៉ោង (token ផុត ➜ refresh) ➜ adapter យកពី cache ហើយទាញ delta ➜ ការផុតកំណត់
 *    ៤ ម៉ោងចាកចេញកណ្តាលផ្លូវ ➜ ចម្លើយ delta ចាស់ដាក់ cursor = head លើទិន្នន័យទទេ ➜ ចូលវិញ (ពាក្យសម្ងាត់ដែលចងចាំ) ទាញតែអ្វីដែលប្រែក្រោយ head ➜
 *    «គ្មានទិន្នន័យ» ឬ «តែ ២-៣ កញ្ចប់» ខណៈស្ថានភាពបៃតង។ App ពិត + Postgres ពិត ៖ audit-tools/supabase-app-network-e2e-test.js ផ្នែក ជ។
 */
import { describe, expect, it } from 'vitest';
import { SbNetworkError, createSupabaseDatabase } from '../src/services/supabase-rtdb';

const HIST = 'zoew_scan_history_cod_dod';
const N = 12;

type Row = { r: string; k: string; v: any; s: number };

function fakeServer() {
    const rows = new Map<string, Row>();
    let head = 0;
    const set = (k: string, v: any) => { head++; rows.set(k, { r: HIST, k, v, s: head }); };
    for (let i = 1; i <= N; i++) set('i' + i, { n: i });
    const calls: any[] = [];
    let hold: { release: () => void; started: Promise<void> } | null = null;
    const pull = (args: any) => {
        const since = Number(args.p_since) || 0;
        const visible = Array.from(rows.values()).filter((x) => x.s > since).sort((a, b) => a.s - b.s);
        return { seq: head, head, more: false, reset: since === 0, tenant: 't1', now: Date.now(), rows: visible.map((x) => Object.assign({}, x)) };
    };
    const transport = {
        rpc: async (fn: string, args: any) => {
            if (fn !== 'zoe_pull') throw new Error('unexpected ' + fn);
            calls.push(Object.assign({}, args));
            const answer = pull(args);
            const h = hold;
            if (h) {
                hold = null;
                await new Promise<void>((resolve) => {
                    h.release = resolve;
                    (h as any).markStarted();
                });
            }
            return answer;
        },
        ping: async () => true,
        subscribe: () => () => {}
    };
    return {
        transport, calls, set,
        head: () => head,
        holdNext: () => {
            let markStarted!: () => void;
            const started = new Promise<void>((resolve) => { markStarted = resolve; });
            const h: any = { release: () => {}, started, markStarted };
            hold = h;
            return h as { release: () => void; started: Promise<void> };
        }
    };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function open(server: ReturnType<typeof fakeServer>) {
    const db = createSupabaseDatabase(server.transport, {
        onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {}
    }, { retryStepsMs: [5, 10, 20], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
    return db;
}

function watch(db: any) {
    const seen: any = { value: undefined, fired: 0 };
    const off = db.onValue(db.ref(HIST), (snap: any) => { seen.fired++; seen.value = snap.val(); });
    return { seen, off };
}

const count = (v: any) => (v && typeof v === 'object' ? Object.keys(v).length : 0);

async function until(fn: () => boolean, ms = 2000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        if (fn()) return true;
        await sleep(5);
    }
    return fn();
}

describe('Supabase ៖ ចាកចេញខណៈការទាញកំពុងរត់ ➜ ចម្លើយចាស់មិនប៉ះសម័យថ្មី', () => {
    it('ចម្លើយ delta (គ្មានជួរថ្មី) មកក្រោយចាកចេញ ➜ ចូលវិញទាញពីដើម ហើយឃើញទិន្នន័យគ្រប់', async () => {
        const server = fakeServer();
        const db = open(server);
        db.setAuthed(true, 'scope-a');
        const first = watch(db);
        expect(await until(() => count(first.seen.value) === N)).toBe(true);
        expect(db.cursor()).toBe(server.head());

        const h = server.holdNext();
        db.onBrowserOnline();
        await h.started;
        expect(server.calls[server.calls.length - 1].p_since).toBe(server.head());

        first.off();
        db.resetForSignOut();
        expect(db.cursor()).toBe(0);
        h.release();
        await sleep(30);
        expect(db.cursor()).toBe(0);

        const callsBefore = server.calls.length;
        db.setAuthed(true, 'scope-a');
        const second = watch(db);
        expect(await until(() => count(second.seen.value) === N)).toBe(true);
        const relogin = server.calls.slice(callsBefore);
        expect(relogin.length).toBeGreaterThan(0);
        expect(relogin[0].p_since).toBe(0);
        db.close('test');
    });

    it('ចម្លើយ delta មាន ២ ជួរថ្មី មកក្រោយចាកចេញ ➜ ចូលវិញមិនឃើញតែ ២ កញ្ចប់', async () => {
        const server = fakeServer();
        const db = open(server);
        db.setAuthed(true, 'scope-a');
        const first = watch(db);
        expect(await until(() => count(first.seen.value) === N)).toBe(true);

        server.set('i3', { n: 3, edited: true });
        server.set('new1', { n: 101 });
        const h = server.holdNext();
        db.onBrowserOnline();
        await h.started;
        first.off();
        db.resetForSignOut();
        h.release();
        await sleep(30);

        db.setAuthed(true, 'scope-a');
        const second = watch(db);
        expect(await until(() => count(second.seen.value) === N + 1)).toBe(true);
        expect(second.seen.value.i3).toEqual({ n: 3, edited: true });
        db.close('test');
    });

    it('ប្តូរគណនី (ហាងផ្សេង) ក្រោយចាកចេញ ➜ ចម្លើយចាស់របស់ហាងមុនមិនលេចក្នុងហាងថ្មី', async () => {
        const shopA = fakeServer();
        const shopB = fakeServer();
        let current = shopA;
        const transport = {
            rpc: (fn: string, args: any) => current.transport.rpc(fn, args).then((res: any) => (current === shopB ? Object.assign({}, res, { tenant: 't2' }) : res)),
            ping: async () => true,
            subscribe: () => () => {}
        };
        const db = createSupabaseDatabase(transport, {
            onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {}
        }, { retryStepsMs: [5, 10, 20], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
        db.setAuthed(true, 'scope-a');
        const first = watch(db);
        expect(await until(() => count(first.seen.value) === N)).toBe(true);
        shopA.set('secretA', { phone: '011111111' });
        const h = shopA.holdNext();
        db.onBrowserOnline();
        await h.started;
        first.off();
        db.resetForSignOut();
        current = shopB;
        shopB.set('onlyB', { n: 7 });
        h.release();
        await sleep(30);
        db.setAuthed(true, 'scope-b');
        const second = watch(db);
        expect(await until(() => count(second.seen.value) === N + 1)).toBe(true);
        expect(second.seen.value.secretA).toBeUndefined();
        expect(second.seen.value.onlyB).toEqual({ n: 7 });
        db.close('test');
    });

    it('ទិសផ្ទុយ ៖ គ្មានការចាកចេញ ➜ ចម្លើយដែលមកយឺតនៅតែអនុវត្ត (cursor ទៅមុខ)', async () => {
        const server = fakeServer();
        const db = open(server);
        db.setAuthed(true, 'scope-a');
        const w = watch(db);
        expect(await until(() => count(w.seen.value) === N)).toBe(true);
        server.set('late', { n: 200 });
        const h = server.holdNext();
        db.onBrowserOnline();
        await h.started;
        await sleep(20);
        h.release();
        expect(await until(() => count(w.seen.value) === N + 1)).toBe(true);
        expect(db.cursor()).toBe(server.head());
        db.close('test');
    });
});

function twoShops() {
    let down = false;
    let shop = 'A';
    const sent: any[] = [];
    const docs: any = { A: { kA: { n: 1, shop: 'A' } }, B: { kB: { n: 5, shop: 'B' } } };
    const seq: any = { A: 1, B: 1 };
    const transport = {
        rpc: async (fn: string, args: any) => {
            if (down) throw new SbNetworkError('network');
            if (fn === 'zoe_pull') {
                const rows = Object.keys(docs[shop]).map((k) => ({ r: 'h', k, v: docs[shop][k], s: seq[shop] }));
                return { seq: seq[shop], head: seq[shop], more: false, reset: true, tenant: 't' + shop, now: Date.now(), rows };
            }
            if (fn === 'zoe_write') {
                sent.push({ shop, ops: JSON.parse(JSON.stringify(args.p_ops)) });
                const op = args.p_ops[0];
                const key = op.p[1];
                if (op.k === 'cas') {
                    const cur = docs[shop][key] === undefined ? null : docs[shop][key];
                    if (JSON.stringify(op.x === undefined ? null : op.x) !== JSON.stringify(cur)) return { ok: false, conflict: true, value: cur };
                }
                seq[shop]++;
                docs[shop][key] = op.v;
                return { ok: true, seq: seq[shop], docs: [{ r: 'h', k: key, v: op.v, s: seq[shop] }] };
            }
            throw new Error('unexpected ' + fn);
        },
        ping: async () => { if (down) throw new SbNetworkError('network'); return true; },
        subscribe: () => () => {}
    };
    const db: any = createSupabaseDatabase(transport, {
        onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {}
    }, { retryStepsMs: [40, 40, 40], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
    return { db, sent, docs, setDown: (v: boolean) => { down = v; }, setShop: (v: string) => { shop = v; } };
}

describe('Supabase ៖ ការសរសេរ/transaction ក្នុងជួរ ជាប់នឹងគណនីដែលបង្កើតវា', () => {
    it('ការសរសេរក្នុងជួរពេលក្រៅបណ្តាញ ➜ ចាកចេញ ➜ ហាងផ្សេងចូល ➜ មិនផ្ញើទៅហាងថ្មី · មិនលេចក្នុងទិដ្ឋភាពហាងថ្មី', async () => {
        const t = twoShops();
        t.db.setAuthed(true, 'scope-a');
        await sleep(30);
        t.setDown(true);
        const result = t.db.set(t.db.ref('h/fromA'), { secret: 'A-parcel' }).then(() => 'resolved', (e: any) => 'rejected:' + (e && e.message));
        await sleep(20);
        t.db.resetForSignOut();
        t.setShop('B');
        t.db.setAuthed(true, 'scope-b');
        const views: any[] = [];
        t.db.onValue(t.db.ref('h'), (snap: any) => { views.push(snap.val()); });
        t.setDown(false);
        const outcome = await Promise.race([result, sleep(1500).then(() => 'pending')]);
        await sleep(100);
        expect(t.sent.filter((x: any) => x.shop === 'B')).toEqual([]);
        expect(t.docs.B.fromA).toBeUndefined();
        expect(String(outcome).startsWith('rejected')).toBe(true);
        expect(views.some((v) => v && v.fromA)).toBe(false);
        expect(views.length > 0 && views[views.length - 1].kB).toEqual({ n: 5, shop: 'B' });
        t.db.close('test');
    });

    it('ទិសផ្ទុយ ៖ គណនីដដែលចូលវិញ ➜ ការសរសេរក្នុងជួរនៅតែដល់ server ម្តង (ការងារពេលក្រៅបណ្តាញមិនបាត់)', async () => {
        const t = twoShops();
        t.db.setAuthed(true, 'scope-a');
        await sleep(30);
        t.setDown(true);
        const result = t.db.set(t.db.ref('h/fromA'), { closed: true }).then(() => 'resolved', (e: any) => 'rejected:' + (e && e.message));
        await sleep(20);
        t.db.resetForSignOut();
        await sleep(60);
        t.db.setAuthed(true, 'scope-a');
        t.setDown(false);
        const outcome = await Promise.race([result, sleep(1500).then(() => 'pending')]);
        expect(outcome).toBe('resolved');
        expect(t.sent.filter((x: any) => x.ops[0].p[1] === 'fromA').length).toBe(1);
        expect(t.docs.A.fromA).toEqual({ closed: true });
        t.db.close('test');
    });

    it('transaction ក្នុងជួរ ➜ ចាកចេញ ➜ ហាងផ្សេងចូល ➜ មិនគណនាលើទិន្នន័យហាងថ្មី ហើយមិនសរសេរទៅហាងថ្មី', async () => {
        const t = twoShops();
        t.db.setAuthed(true, 'scope-a');
        const first: any[] = [];
        const off = t.db.onValue(t.db.ref('h'), (snap: any) => { first.push(snap.val()); });
        expect(await until(() => first.length > 0)).toBe(true);
        off();
        t.setDown(true);
        const seenBases: any[] = [];
        const result = t.db.runTransaction(t.db.ref('h/kB'), (cur: any) => {
            seenBases.push(cur);
            return { n: ((cur && cur.n) || 0) + 100, from: 'A' };
        }).then(() => 'resolved', (e: any) => 'rejected:' + (e && e.message));
        await sleep(20);
        t.db.resetForSignOut();
        t.setShop('B');
        t.db.setAuthed(true, 'scope-b');
        t.setDown(false);
        const outcome = await Promise.race([result, sleep(1500).then(() => 'pending')]);
        await sleep(100);
        expect(t.docs.B.kB).toEqual({ n: 5, shop: 'B' });
        expect(t.sent.filter((x: any) => x.shop === 'B')).toEqual([]);
        expect(seenBases.some((b) => b && b.shop === 'B')).toBe(false);
        expect(String(outcome).startsWith('rejected')).toBe(true);
        t.db.close('test');
    });
});
