/**
 * @vitest-environment node
 *
 * 🔬 realtime websocket ពិត ៖ realtime-js ពិត (តាម supabase-js) + transport ពិត + adapter ពិត ទល់នឹង server Phoenix ក្លែង (`ws` ពិត · protocol
 *    vsn 2.0.0 ៖ `[join_ref, ref, topic, event, payload]`)។ fake Supabase របស់ audit-tools បិទ upgrade ➜ realtime មិនដែលត្រូវវាស់ពីចុងដល់ចុង។
 *    សេណារីយ៉ូ ៖ (ក) broadcast `seq` ➜ ការទាញ · (ខ) server ផ្តាច់ socket ➜ realtime-js ភ្ជាប់វិញ ➜ join ម្តងទៀត ➜ broadcast នៅមក · គ្មានវដ្ត join ·
 *    (គ) server បិទ channel (`phx_close` ដូចពេល token ផុត) ➜ adapter subscribe ម្តងទៀត (SBD-6) · (ឃ) server បដិសេធ join ➜ ការសាកឡើងវិញមានព្រំ ➜
 *    ទទួលវិញពេល server អនុញ្ញាត។
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';
import { SB_AUTH_STORAGE_KEY, createSupabaseTransport } from '../src/services/supabase-transport';

const { WebSocketServer } = createRequire(import.meta.url)('ws');

type Frame = [string | null, string | null, string, string, any];

function memStore() {
    const m = new Map<string, string>();
    return {
        getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
        setItem: (k: string, v: string) => { m.set(k, String(v)); },
        removeItem: (k: string) => { m.delete(k); }
    };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(fn: () => boolean, ms: number) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        if (fn()) return true;
        await sleep(20);
    }
    return fn();
}

function fakeSupabase() {
    const state = { pulls: 0, joins: 0, tokens: [] as string[], pushedTokens: [] as string[], refreshes: 0, rejectJoins: false, sockets: new Set<any>(), channels: new Map<any, { topic: string; joinRef: string }>() };
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
            if (req.url && req.url.indexOf('/auth/v1/token') !== -1) {
                state.refreshes++;
                const exp = Math.floor(Date.now() / 1000) + 3600;
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ access_token: 'refreshed.token.' + state.refreshes, refresh_token: 'r' + state.refreshes, token_type: 'bearer', expires_in: 3600, expires_at: exp, user: { id: 'u1', email: 'a@users.zoew.invalid', aud: 'authenticated' } }));
                return;
            }
            if (req.url && req.url.indexOf('/rest/v1/rpc/zoe_pull') !== -1) {
                state.pulls++;
                const args = body ? JSON.parse(body) : {};
                const since = Number(args.p_since) || 0;
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ seq: 1 + state.pulls, head: 1 + state.pulls, more: false, reset: since === 0, tenant: 't1', now: Date.now(), rows: [] }));
                return;
            }
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end('{}');
        });
    });
    const wss = new WebSocketServer({ server });
    wss.on('connection', (ws: any) => {
        state.sockets.add(ws);
        ws.on('close', () => { state.sockets.delete(ws); state.channels.delete(ws); });
        ws.on('message', (raw: any) => {
            let msg: Frame;
            try { msg = JSON.parse(String(raw)); } catch { return; }
            const [joinRef, ref, topic, event, payload] = msg;
            const reply = (status: string, response: any) => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status, response }]));
            if (topic === 'phoenix' && event === 'heartbeat') { reply('ok', {}); return; }
            if (event === 'phx_join') {
                state.joins++;
                state.tokens.push(String(payload && payload.access_token || ''));
                if (state.rejectJoins) { reply('error', { reason: 'Unauthorized' }); return; }
                state.channels.set(ws, { topic, joinRef: String(joinRef) });
                reply('ok', { postgres_changes: [] });
                return;
            }
            if (event === 'phx_leave') { state.channels.delete(ws); reply('ok', {}); return; }
            if (event === 'access_token') { state.pushedTokens.push(String(payload && payload.access_token || '')); return; }
            if (ref) reply('ok', {});
        });
    });
    const broadcastSeq = (seq: number) => {
        state.channels.forEach((ch, ws) => ws.send(JSON.stringify([null, null, ch.topic, 'broadcast', { type: 'broadcast', event: 'seq', payload: { seq } }])));
    };
    const closeChannels = () => {
        state.channels.forEach((ch, ws) => {
            ws.send(JSON.stringify([ch.joinRef, null, ch.topic, 'system', { status: 'error', message: 'Token has expired 0 seconds ago', extension: 'system', channel: ch.topic }]));
            ws.send(JSON.stringify([ch.joinRef, null, ch.topic, 'phx_close', {}]));
        });
        state.channels.clear();
    };
    const dropSockets = () => { state.sockets.forEach((ws) => { try { ws.terminate(); } catch {} }); };
    return new Promise<any>((resolve) => server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as any).port;
        resolve({ state, url: 'http://127.0.0.1:' + port, broadcastSeq, closeChannels, dropSockets, close: () => new Promise((r) => { wss.close(); server.close(() => r(null)); }) });
    }));
}

function session() {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    return { access_token: 'live.token.' + exp, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: { id: 'u1', email: 'a@users.zoew.invalid', aud: 'authenticated' } };
}

const opened: any[] = [];

afterEach(async () => {
    while (opened.length) {
        const o = opened.pop();
        try { o.db.close('test'); } catch {}
        try { o.transport.close(); } catch {}
        await o.srv.close();
    }
});

async function open() {
    const srv = await fakeSupabase();
    const local = memStore();
    local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(session()));
    const transport = createSupabaseTransport({ supabaseUrl: srv.url, supabaseKey: 'sb_publishable_test' }, { localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 3000 });
    const db = createSupabaseDatabase(transport, {
        onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {}
    }, { pollFallbackMs: 600000, retryStepsMs: [200, 400] });
    db.setAuthed(true, 'scope');
    db.setTenantTopic('zoe:t1');
    db.onValue(db.ref('x'), () => {});
    const o = { srv, transport, db, local };
    opened.push(o);
    expect(await until(() => srv.state.channels.size === 1, 8000)).toBe(true);
    return o;
}

describe('realtime websocket ពិត', () => {
    it('(ក) join ជាមួយ token ពិត ➜ broadcast seq ➜ adapter ទាញ', async () => {
        const { srv } = await open();
        expect(srv.state.tokens[0]).toMatch(/^live\.token\./);
        const before = srv.state.pulls;
        srv.broadcastSeq(999);
        expect(await until(() => srv.state.pulls > before, 3000)).toBe(true);
    }, 20000);

    it('(ខ) server ផ្តាច់ socket ➜ ភ្ជាប់វិញ ➜ join ម្តងទៀត ➜ broadcast មកដល់ · គ្មានវដ្ត join', async () => {
        const { srv } = await open();
        srv.dropSockets();
        expect(await until(() => srv.state.channels.size === 1 && srv.state.joins >= 2, 15000)).toBe(true);
        const before = srv.state.pulls;
        srv.broadcastSeq(1000);
        expect(await until(() => srv.state.pulls > before, 3000)).toBe(true);
        const joins = srv.state.joins;
        await sleep(12000);
        expect(srv.state.joins - joins).toBe(0);
    }, 45000);

    it('(គ) server បិទ channel (token ផុត) ➜ adapter subscribe ម្តងទៀត ➜ broadcast មកដល់', async () => {
        const { srv } = await open();
        srv.closeChannels();
        expect(await until(() => srv.state.channels.size === 1 && srv.state.joins >= 2, 15000)).toBe(true);
        const before = srv.state.pulls;
        srv.broadcastSeq(1001);
        expect(await until(() => srv.state.pulls > before, 3000)).toBe(true);
    }, 30000);

    it('(ង) token ផុត ➜ refresh ពេល channel រស់ ➜ token ថ្មីទៅដល់ channel (access_token) · មិន join ម្តងទៀត', async () => {
        const { srv, transport, local } = await open();
        const stale = JSON.parse(local.getItem(SB_AUTH_STORAGE_KEY)!);
        stale.expires_at = Math.floor(Date.now() / 1000) - 10;
        local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(stale));
        const joins = srv.state.joins;
        await transport.rpc('zoe_pull', { p_since: 1, p_limit: 10 }, 5000);
        expect(srv.state.refreshes).toBeGreaterThan(0);
        expect(await until(() => srv.state.pushedTokens.some((t: string) => t.indexOf('refreshed.token.') === 0), 3000)).toBe(true);
        expect(srv.state.joins).toBe(joins);
    }, 20000);

    it('(ឃ) server បដិសេធ join ➜ ការសាកឡើងវិញមានព្រំ ➜ server អនុញ្ញាតវិញ ➜ SUBSCRIBED', async () => {
        const { srv } = await open();
        srv.state.rejectJoins = true;
        srv.closeChannels();
        await sleep(20000);
        const tried = srv.state.joins;
        expect(tried).toBeGreaterThan(1);
        expect(tried).toBeLessThanOrEqual(12);
        srv.state.rejectJoins = false;
        expect(await until(() => srv.state.channels.size === 1, 30000)).toBe(true);
    }, 70000);
});
