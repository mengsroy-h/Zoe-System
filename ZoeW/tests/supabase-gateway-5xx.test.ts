/**
 * ⛔ gateway 5xx (502 · 503 · 504 · Cloudflare 52x) លើ Supabase ≠ ការបដិសេធចុងក្រោយ ៖ API gateway ឆ្លើយ 5xx ពេលបាត់ចម្លើយ PostgREST
 *    (instance restart · upstream timeout) — Postgres អាច commit រួចហើយ។ មុនកែ `rpc()` បោះ `SbRpcError` ➜ adapter ចាត់ជាការបដិសេធ ៖
 *    transaction ledger ដែល commit រួចក្លាយជា «មិនបានអនុវត្ត» (គ្មាន `txOutcome`) ➜ `ledgerRejectionVerdict()` = null ➜ reconcile សរសេរ
 *    delta ម្តងទៀត ➜ **ចំណូលរាប់ ២ ដង** · ការសរសេរធម្មតា (បិទកញ្ចប់ · ស្កេន) ត្រូវបោះចោលភ្លាម · `.info/connected` នៅ `true` ខណៈ
 *    ការសរសេរគ្រប់ធ្លាក់។ ឥឡូវ ៖ 5xx gateway = `SbNetworkError` ➜ op_id ដដែលផ្ញើម្តងទៀត (server dedupe) ➜ applied តែម្តង។
 *    ទិសផ្ទុយ ៖ កំហុស PostgREST ពិត (4xx · 500 JSON) នៅតែជាការបដិសេធចុងក្រោយ។
 */
import { describe, expect, it } from 'vitest';
import { SbNetworkError, SbRpcError, createSupabaseDatabase } from '../src/services/supabase-rtdb';
import { SB_AUTH_STORAGE_KEY, createSupabaseTransport } from '../src/services/supabase-transport';

const URL = 'https://abcdefghijklmnopqrst.supabase.co';
const GATEWAY_HTML = '<html><head><title>504 Gateway Time-out</title></head><body>upstream connect error or disconnect/reset before headers</body></html>';

function memStore() {
    const m = new Map<string, string>();
    return {
        getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
        setItem: (k: string, v: string) => { m.set(k, String(v)); },
        removeItem: (k: string) => { m.delete(k); },
        key: (i: number) => Array.from(m.keys())[i] ?? null,
        get length() { return m.size; }
    };
}

type Fault = { status: number; body: string; afterCommit: boolean };

function fakeBackend() {
    let seq = 0;
    const docs = new Map<string, any>();
    const done = new Map<string, any>();
    const applied: string[] = [];
    const faults: Fault[] = [];
    const calls: string[] = [];
    const reply = (body: any, status = 200, raw?: string) => Promise.resolve(new Response(raw !== undefined ? raw : JSON.stringify(body), { status, headers: { 'content-type': raw !== undefined ? 'text/html' : 'application/json' } }));
    const write = (args: any) => {
        const prior = done.get(args.p_op_id);
        if (prior) return Object.assign({}, prior, { replayed: true });
        const keyOf = (op: any) => (Array.isArray(op.p) ? op.p.join('/') : String(op.p));
        for (const op of args.p_ops) {
            if (op.k === 'cas') {
                const cur = docs.has(keyOf(op)) ? docs.get(keyOf(op)).v : null;
                if (JSON.stringify(op.x === undefined ? null : op.x) !== JSON.stringify(cur)) return { ok: false, conflict: true, value: cur };
            }
        }
        const out: any[] = [];
        for (const op of args.p_ops) {
            seq++;
            const parts = keyOf(op).split('/');
            const d = { r: parts[0], k: parts.slice(1).join('/'), v: op.v === undefined ? null : op.v, s: seq };
            docs.set(keyOf(op), d);
            out.push(d);
        }
        applied.push(args.p_op_id);
        const result = { ok: true, seq, docs: out };
        done.set(args.p_op_id, result);
        return result;
    };
    const fetch = async (input: any, init: any) => {
        const u = String(input && input.url ? input.url : input);
        const fn = (u.match(/\/rpc\/([a-z_]+)/) || [])[1] || u;
        calls.push(fn);
        const args = init && init.body ? JSON.parse(String(init.body)) : {};
        if (fn === 'zoe_pull') return reply({ seq, more: false, reset: true, head: seq, tenant: 't1', now: Date.now(), rows: Array.from(docs.values()) });
        if (fn === 'zoe_write') {
            const fault = faults.shift();
            if (fault && !fault.afterCommit) return reply(null, fault.status, fault.body);
            const res = write(args);
            if (fault) return reply(null, fault.status, fault.body);
            return reply(res);
        }
        if (fn === 'zoe_echo') {
            const fault = faults.shift();
            return fault ? reply(null, fault.status, fault.body) : reply({ ok: 1 });
        }
        return reply({ code: 'PGRST202', message: 'unexpected ' + fn }, 404);
    };
    return { fetch, faults, applied, calls, doc: (path: string) => (docs.has(path) ? docs.get(path).v : null) };
}

function transportFor(backend: ReturnType<typeof fakeBackend>) {
    const local = memStore();
    const exp = Math.floor(Date.now() / 1000) + 3600;
    local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify({ access_token: 'live.token.x', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: { id: 'u1', email: 'a@users.zoew.invalid', aud: 'authenticated' } }));
    return createSupabaseTransport({ supabaseUrl: URL, supabaseKey: 'sb_publishable_test' }, { fetch: backend.fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 2000 });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function openDb(backend: ReturnType<typeof fakeBackend>) {
    const transport = transportFor(backend);
    const connected: boolean[] = [];
    const unknown: string[] = [];
    const db = createSupabaseDatabase(transport, {
        onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: (p: string[]) => { unknown.push(p.join('/')); }
    }, { retryStepsMs: [5, 10, 20], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
    db.setAuthed(true, 'scope');
    db.onValue(db.ref('.info/connected'), (s: any) => { connected.push(!!s.val()); });
    let fired = false;
    db.onValue(db.ref('zoew_daily_revenue_cod_dod'), () => { fired = true; });
    for (let i = 0; i < 200 && !fired; i++) await sleep(5);
    expect(fired).toBe(true);
    return { db, connected, unknown };
}

describe('transport Supabase ៖ gateway 5xx ➜ បណ្តាញ (មិនមែនការបដិសេធ)', () => {
    for (const status of [502, 503, 504, 520, 524]) {
        it('⛔ HTTP ' + status + ' (gateway) ➜ SbNetworkError', async () => {
            const backend = fakeBackend();
            backend.faults.push({ status, body: GATEWAY_HTML, afterCommit: false });
            const err: any = await transportFor(backend).rpc('zoe_echo', {}, 5000).then(() => null, (e: any) => e);
            expect(err).toBeInstanceOf(SbNetworkError);
        });
    }

    it('ទិសផ្ទុយ ៖ កំហុស PostgREST ពិត (400 · 403 · 500 JSON) នៅតែជា SbRpcError (ចុងក្រោយ)', async () => {
        for (const [status, code] of [[400, '22023'], [403, '42501'], [500, 'XX000']] as Array<[number, string]>) {
            const backend = fakeBackend();
            backend.faults.push({ status, body: JSON.stringify({ code, message: 'pg ' + code, details: null }), afterCommit: false });
            const err: any = await transportFor(backend).rpc('zoe_echo', {}, 5000).then(() => null, (e: any) => e);
            expect(err).toBeInstanceOf(SbRpcError);
            expect(err.status).toBe(status);
        }
    });
});

describe('adapter Supabase ៖ commit រួច ➜ gateway 5xx ➜ op_id ដដែល ➜ applied តែម្តង', () => {
    it('⛔ transaction ledger ៖ commit ➜ 504 ➜ committed + applied · server កាត់/បូកតែម្តង', async () => {
        const backend = fakeBackend();
        const { db, unknown } = await openDb(backend);
        backend.faults.push({ status: 504, body: GATEWAY_HTML, afterCommit: true });
        const ref = db.ref('zoew_daily_revenue_cod_dod/2026-10-04');
        const res: any = await db.runTransaction(ref, (v: any) => ({ codDollar: ((v && v.codDollar) || 0) + 10, totalCount: ((v && v.totalCount) || 0) + 1 }))
            .then((r: any) => r, (e: any) => ({ rejected: e }));
        expect(res.rejected).toBeUndefined();
        expect(res.committed).toBe(true);
        expect(res.txOutcome).toBe('applied');
        expect(backend.applied.length).toBe(1);
        expect(backend.doc('zoew_daily_revenue_cod_dod/2026-10-04')).toEqual({ codDollar: 10, totalCount: 1 });
        expect(unknown).toEqual([]);
        db.close('test');
    });

    it('⛔ ការសរសេរធម្មតា ៖ commit ➜ 502 ➜ resolve (មិនបោះចោល) · server សរសេរតែម្តង', async () => {
        const backend = fakeBackend();
        const { db } = await openDb(backend);
        backend.faults.push({ status: 502, body: GATEWAY_HTML, afterCommit: true });
        const out = await db.set(db.ref('zoew_scan_history_cod_dod/p1'), { isClosed: true }).then(() => 'ok', (e: any) => e);
        expect(out).toBe('ok');
        expect(backend.applied.length).toBe(1);
        expect(backend.doc('zoew_scan_history_cod_dod/p1')).toEqual({ isClosed: true });
        db.close('test');
    });

    it('⛔ 503 មុន commit ២ ដង ➜ ការសរសេររង់ចាំ (`.info/connected` = false) ➜ រក្សាទុកពេល gateway មកវិញ', async () => {
        const backend = fakeBackend();
        const { db, connected } = await openDb(backend);
        backend.faults.push({ status: 503, body: GATEWAY_HTML, afterCommit: false }, { status: 503, body: GATEWAY_HTML, afterCommit: false });
        const out = await db.set(db.ref('zoew_scan_history_cod_dod/p2'), { isClosed: true }).then(() => 'ok', (e: any) => e);
        expect(out).toBe('ok');
        expect(backend.applied.length).toBe(1);
        expect(connected).toContain(false);
        db.close('test');
    });

    it('ទិសផ្ទុយ ៖ 400 JSON (PostgREST) ➜ ការសរសេរបដិសេធភ្លាម មិនផ្ញើម្តងទៀត', async () => {
        const backend = fakeBackend();
        const { db } = await openDb(backend);
        backend.faults.push({ status: 400, body: JSON.stringify({ code: '22023', message: 'invalid' }), afterCommit: false });
        const before = backend.calls.filter((c) => c === 'zoe_write').length;
        const out: any = await db.set(db.ref('zoew_scan_history_cod_dod/p3'), { isClosed: true }).then(() => 'ok', (e: any) => e);
        expect(out).not.toBe('ok');
        expect(backend.calls.filter((c) => c === 'zoe_write').length - before).toBe(1);
        expect(backend.applied.length).toBe(0);
        db.close('test');
    });
});
