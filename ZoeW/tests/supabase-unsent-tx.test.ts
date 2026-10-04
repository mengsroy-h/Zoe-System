/**
 * ⛔ G3 ៖ សំណើដែល **មិនទាន់ផ្ញើ** ≠ ចម្លើយបាត់។ `rpc()` បោះ `SbNetworkError` មុន POST ពេល token មិនទាន់បាន (`auth-unavailable` · ពិដាន `sbWithin`
 *    លើជំហាន token · refresh ក្រោយ 401) ➜ មុនកែ adapter ចាត់ជា «ចម្លើយបាត់» ➜ adapter បិទ ➜ `unknown` + `txServerUnread` + Sentry `zone: money`
 *    ក្លែង · reconcile ledger មិនរាយ ✅ · conflict ក្រោយមក ➜ `not-applied` (ការសរសេរដែលមិនដែលចេញ ក្លាយជាការបដិសេធ) ។ ឥឡូវ ៖ transport ដាក់ `unsent`
 *    លើកំហុសមុន POST ➜ adapter សាកឡើងវិញដោយមិនដាក់ `lost` ➜ បិទ ➜ `disconnect` ធម្មតា · conflict ➜ សាកម្តងទៀតលើតម្លៃថ្មី (CAS ធម្មតា)។
 *    ទិសផ្ទុយ ៖ សំណើដែលអាចបានផ្ញើ (timeout ក្រោយ POST · បណ្តាញ · gateway 5xx) នៅជា «ចម្លើយបាត់» ដដែល (`unknown` ពេលបិទ)។
 * ⛔ SBD-6 ៖ channel realtime `CLOSED` (ឧ. token ផុត ➜ Server បិទ channel) ➜ មុនកែ `startRealtime()` មិនដែលបង្កើតម្តងទៀត (`unsubscribeRealtime` នៅ)
 *    ➜ ទាញរៀងរាល់ `SB_POLL_FALLBACK_MS` ជារៀងរហូត។ ឥឡូវ ៖ channel មិនរស់ ➜ subscribe ម្តងទៀតតាមជំហាន (ឈប់ពេល `SUBSCRIBED`)។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SbNetworkError, SB_POLL_FALLBACK_MS, SB_POLL_REALTIME_MS, createSupabaseDatabase } from '../src/services/supabase-rtdb';
import { SB_AUTH_STORAGE_KEY, createSupabaseTransport } from '../src/services/supabase-transport';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function memStore() {
    const m = new Map<string, string>();
    return {
        getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
        setItem: (k: string, v: string) => { m.set(k, String(v)); },
        removeItem: (k: string) => { m.delete(k); }
    };
}

const unsent = (msg: string) => Object.assign(new SbNetworkError(msg), { unsent: true });

type Mode = 'ok' | 'unsent' | 'maybe-sent';

function fakeServer() {
    let mode: Mode = 'ok';
    let seq = 0;
    let value: any = null;
    const sent: string[] = [];
    const doc = () => ({ r: 'tx', k: 'a', v: value === null ? null : { n: value }, s: seq });
    const transport = {
        rpc: async (fn: string, args: any) => {
            if (mode === 'unsent') throw unsent('auth-unavailable');
            if (fn === 'zoe_pull') {
                if (mode === 'maybe-sent') throw new SbNetworkError('network');
                return { seq, more: false, reset: true, head: seq, tenant: 't1', now: Date.now(), rows: value === null ? [] : [doc()] };
            }
            sent.push(args.p_op_id);
            if (mode === 'maybe-sent') throw new SbNetworkError('timeout');
            const op = args.p_ops[0];
            const current = value === null ? null : { n: value };
            if (JSON.stringify(op.x === undefined ? null : op.x) !== JSON.stringify(current)) return { ok: false, conflict: true, value: current };
            value = op.v === null ? null : op.v.n;
            seq++;
            return { ok: true, seq, docs: [doc()] };
        },
        ping: async () => true,
        subscribe: () => () => {}
    };
    return { transport, sent, setMode: (m: Mode) => { mode = m; }, value: () => value, foreignWrite: (n: number) => { value = n; seq++; } };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function open(transport: any) {
    const unknown: string[] = [];
    const db = createSupabaseDatabase(transport, {
        onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: (p: string[]) => { unknown.push(p.join('/')); }
    }, { retryStepsMs: [5, 10, 20], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
    db.setAuthed(true, 'scope');
    let fired = false;
    db.onValue(db.ref('tx'), () => { fired = true; });
    for (let i = 0; i < 100 && !fired; i++) await sleep(5);
    expect(fired).toBe(true);
    return { db, unknown };
}

const inc = (v: any) => ({ n: ((v && v.n) || 0) + 1 });

describe('G3 ៖ សំណើមិនទាន់ផ្ញើ ≠ ចម្លើយបាត់ (adapter)', () => {
    it('⛔ token មិនទាន់បាន ➜ adapter បិទ ➜ disconnect ធម្មតា · គ្មាន unknown · គ្មាន Sentry លុយ', async () => {
        const server = fakeServer();
        const { db, unknown } = await open(server.transport);
        server.setMode('unsent');
        const tx = db.runTransaction(db.ref('tx/a'), inc).then(() => null, (e: any) => e);
        await sleep(80);
        db.close('test');
        const err: any = await tx;
        expect(err && err.code).toBe('DISCONNECT');
        expect(err.txOutcome).toBeUndefined();
        expect(err.txServerUnread).toBeUndefined();
        expect(unknown).toEqual([]);
        expect(server.sent).toEqual([]);
    });

    it('⛔ token មិនទាន់បាន + ឧបករណ៍ផ្សេងសរសេរ ➜ token មកវិញ ➜ CAS សាកលើតម្លៃថ្មី ហើយ commit (មិនមែន not-applied)', async () => {
        const server = fakeServer();
        const { db, unknown } = await open(server.transport);
        server.setMode('unsent');
        const tx = db.runTransaction(db.ref('tx/a'), inc).then((r: any) => r, (e: any) => e);
        await sleep(60);
        server.foreignWrite(5);
        server.setMode('ok');
        const out: any = await tx;
        expect(out && out.committed).toBe(true);
        expect(out.txOutcome).toBeUndefined();
        expect(server.value()).toBe(6);
        expect(unknown).toEqual([]);
        db.close('test');
    });

    it('ទិសផ្ទុយ ៖ សំណើអាចបានផ្ញើ (timeout ក្រោយ POST) ➜ adapter បិទ ➜ unknown + txServerUnread ដដែល', async () => {
        const server = fakeServer();
        const { db, unknown } = await open(server.transport);
        server.setMode('maybe-sent');
        const tx = db.runTransaction(db.ref('tx/a'), inc).then(() => null, (e: any) => e);
        await sleep(80);
        db.close('test');
        const err: any = await tx;
        expect(err && err.txOutcome).toBe('unknown');
        expect(err.txServerUnread).toBe(true);
        expect(unknown).toEqual(['tx/a']);
    });

    it('ទិសផ្ទុយ ៖ ចម្លើយបាត់ម្តង រួចកំហុសមិនទាន់ផ្ញើ ➜ នៅជាចម្លើយបាត់ (បិទ ➜ unknown)', async () => {
        const server = fakeServer();
        const { db, unknown } = await open(server.transport);
        server.setMode('maybe-sent');
        const tx = db.runTransaction(db.ref('tx/a'), inc).then(() => null, (e: any) => e);
        await sleep(40);
        server.setMode('unsent');
        await sleep(60);
        db.close('test');
        const err: any = await tx;
        expect(err && err.txOutcome).toBe('unknown');
        expect(unknown).toEqual(['tx/a']);
    });
});

function sessionAt(expiresAt: number) {
    return { access_token: 'old.token.x', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user: { id: 'u1', email: 'a@users.zoew.invalid', aud: 'authenticated' } };
}

describe('G3 ៖ transport ដាក់ unsent តែលើកំហុសមុន POST', () => {
    it('⛔ token ផុត + GoTrue 503 ➜ SbNetworkError unsent · គ្មាន POST ទៅ /rest', async () => {
        vi.stubGlobal('BroadcastChannel', undefined);
        vi.useFakeTimers();
        const rest: string[] = [];
        const fetch = (input: any) => {
            const u = String(input && input.url ? input.url : input);
            if (u.includes('/auth/v1/')) return Promise.resolve(new Response(JSON.stringify({ message: 'down' }), { status: 503, headers: { 'content-type': 'application/json' } }));
            rest.push(u);
            return Promise.resolve(new Response('{}', { status: 200 }));
        };
        const local = memStore();
        local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(sessionAt(Math.floor(Date.now() / 1000) - 3600)));
        const t = createSupabaseTransport({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' }, { fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 2000 });
        let out: any = 'pending';
        t.rpc('zoe_write', { p_op_id: 'x' }, 60000).then((v: any) => { out = v; }, (e: any) => { out = e; });
        for (let i = 0; i < 360 && out === 'pending'; i++) await vi.advanceTimersByTimeAsync(250);
        expect(out).toBeInstanceOf(SbNetworkError);
        expect(out.unsent).toBe(true);
        expect(rest).toEqual([]);
    });

    it('⛔ ជំហាន token ព្យួរ (GoTrue មិនឆ្លើយ) លើសពិដាន rpc ➜ SbNetworkError unsent · គ្មាន POST', async () => {
        vi.stubGlobal('BroadcastChannel', undefined);
        vi.useFakeTimers();
        const rest: string[] = [];
        const fetch = (input: any) => {
            const u = String(input && input.url ? input.url : input);
            if (u.includes('/auth/v1/')) return new Promise(() => {});
            rest.push(u);
            return Promise.resolve(new Response('{}', { status: 200 }));
        };
        const local = memStore();
        local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(sessionAt(Math.floor(Date.now() / 1000) - 3600)));
        const t = createSupabaseTransport({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' }, { fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 20000 });
        let out: any = 'pending';
        t.rpc('zoe_write', { p_op_id: 'x' }, 1500).then((v: any) => { out = v; }, (e: any) => { out = e; });
        for (let i = 0; i < 20 && out === 'pending'; i++) await vi.advanceTimersByTimeAsync(250);
        expect(out).toBeInstanceOf(SbNetworkError);
        expect(out.unsent).toBe(true);
        expect(rest).toEqual([]);
    });

    it('⛔ POST ទទួល 401 (JWT មិនទទួល ➜ មិនបានអនុវត្ត) + refresh បរាជ័យបណ្តោះអាសន្ន ➜ SbNetworkError unsent', async () => {
        vi.stubGlobal('BroadcastChannel', undefined);
        vi.useFakeTimers();
        const rest: string[] = [];
        const fetch = (input: any) => {
            const u = String(input && input.url ? input.url : input);
            if (u.includes('/auth/v1/')) return Promise.resolve(new Response(JSON.stringify({ message: 'down' }), { status: 503, headers: { 'content-type': 'application/json' } }));
            rest.push(u);
            return Promise.resolve(new Response(JSON.stringify({ code: 'PGRST303', message: 'JWT expired' }), { status: 401, headers: { 'content-type': 'application/json' } }));
        };
        const local = memStore();
        local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(sessionAt(Math.floor(Date.now() / 1000) + 3600)));
        const t = createSupabaseTransport({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' }, { fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 2000 });
        let out: any = 'pending';
        t.rpc('zoe_write', { p_op_id: 'x' }, 60000).then((v: any) => { out = v; }, (e: any) => { out = e; });
        for (let i = 0; i < 360 && out === 'pending'; i++) await vi.advanceTimersByTimeAsync(250);
        expect(rest.length).toBe(1);
        expect(out).toBeInstanceOf(SbNetworkError);
        expect(out.unsent).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ POST ព្យួរលើសពិដាន ➜ SbNetworkError ដែលអាចបានផ្ញើ (គ្មាន unsent)', async () => {
        vi.stubGlobal('BroadcastChannel', undefined);
        vi.useFakeTimers();
        const fetch = (input: any) => {
            const u = String(input && input.url ? input.url : input);
            if (u.includes('/rest/v1/')) return new Promise(() => {});
            return Promise.resolve(new Response('{}', { status: 200 }));
        };
        const local = memStore();
        local.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(sessionAt(Math.floor(Date.now() / 1000) + 3600)));
        const t = createSupabaseTransport({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' }, { fetch, localStorage: local, sessionStorage: memStore(), fetchTimeoutMs: 2000 });
        let out: any = 'pending';
        t.rpc('zoe_write', { p_op_id: 'x' }, 3000).then((v: any) => { out = v; }, (e: any) => { out = e; });
        for (let i = 0; i < 40 && out === 'pending'; i++) await vi.advanceTimersByTimeAsync(250);
        expect(out).toBeInstanceOf(SbNetworkError);
        expect(out.unsent).toBeUndefined();
    });
});

describe('SBD-6 ៖ channel realtime CLOSED ➜ subscribe ម្តងទៀត', () => {
    function realtimeServer(opts: { subscribedAfterMs?: number; closeOnUnsubscribe?: boolean } = {}) {
        const state = { subscribes: 0, pulls: 0, statuses: [] as ((s: string) => void)[], unsubscribed: 0, subscribedAfterMs: opts.subscribedAfterMs || 0 };
        const transport = {
            rpc: async (fn: string) => {
                if (fn === 'zoe_pull') { state.pulls++; return { seq: 1, more: false, reset: true, head: 1, tenant: 't1', now: Date.now(), rows: [] }; }
                throw new Error('unexpected ' + fn);
            },
            ping: async () => true,
            subscribe: (_topic: string, _onEvent: any, onStatus: (s: string) => void) => {
                state.subscribes++;
                state.statuses.push(onStatus);
                if (state.subscribedAfterMs) setTimeout(() => onStatus('SUBSCRIBED'), state.subscribedAfterMs);
                else Promise.resolve().then(() => onStatus('SUBSCRIBED'));
                return () => { state.unsubscribed++; if (opts.closeOnUnsubscribe) setTimeout(() => onStatus('CLOSED'), 100); };
            }
        };
        return { state, transport };
    }

    it('⛔ CLOSED ក្រោយ SUBSCRIBED ➜ subscribe ម្តងទៀត ➜ ការទាញត្រឡប់ទៅចន្លោះ realtime (មិនមែន ៣០ វិ. ជារៀងរហូត)', async () => {
        vi.useFakeTimers();
        const s = realtimeServer();
        const db = createSupabaseDatabase(s.transport, {
            onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {}
        }, {});
        db.setAuthed(true, 'scope');
        db.setTenantTopic('zoe:t1');
        db.onValue(db.ref('tx'), () => {});
        await vi.advanceTimersByTimeAsync(1000);
        expect(s.state.subscribes).toBe(1);
        s.state.statuses[0]('CLOSED');
        await vi.advanceTimersByTimeAsync(120000);
        expect(s.state.subscribes).toBeGreaterThan(1);
        expect(s.state.unsubscribed).toBeGreaterThan(0);
        const pullsBefore = s.state.pulls;
        await vi.advanceTimersByTimeAsync(SB_POLL_FALLBACK_MS * 4);
        expect(s.state.pulls - pullsBefore).toBeLessThanOrEqual(Math.ceil((SB_POLL_FALLBACK_MS * 4) / SB_POLL_REALTIME_MS) + 1);
        db.close('test');
    });

    it('⛔ subscribe បរាជ័យជាប់ (CHANNEL_ERROR ពី transport) ➜ សាកឡើងវិញតាមជំហាន មិនញឹកជាង ១ ដង / ៥ វិ.', async () => {
        vi.useFakeTimers();
        const s = realtimeServer();
        s.transport.subscribe = (_t: string, _e: any, onStatus: (st: string) => void) => {
            s.state.subscribes++;
            Promise.resolve().then(() => onStatus('CHANNEL_ERROR'));
            return () => { s.state.unsubscribed++; };
        };
        const db = createSupabaseDatabase(s.transport, {
            onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {}
        }, {});
        db.setAuthed(true, 'scope');
        db.setTenantTopic('zoe:t1');
        db.onValue(db.ref('tx'), () => {});
        await vi.advanceTimersByTimeAsync(300000);
        expect(s.state.subscribes).toBeGreaterThan(2);
        expect(s.state.subscribes).toBeLessThanOrEqual(300000 / 5000 + 1);
        db.close('test');
    });

    const openRealtime = (s: any) => {
        const db = createSupabaseDatabase(s.transport, {
            onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {}
        }, {});
        db.setAuthed(true, 'scope');
        db.setTenantTopic('zoe:t1');
        db.onValue(db.ref('tx'), () => {});
        return db;
    };

    it('⛔ subscribe ម្តងទៀតជោគជ័យ ➜ ជំហានត្រឡប់ទៅដើម (CLOSED លើកក្រោយ ➜ សាកក្នុង ៥ វិ. ម្តងទៀត)', async () => {
        vi.useFakeTimers();
        const s = realtimeServer();
        const db = openRealtime(s);
        await vi.advanceTimersByTimeAsync(1000);
        for (let round = 0; round < 4; round++) {
            const before = s.state.subscribes;
            s.state.statuses[s.state.statuses.length - 1]('CLOSED');
            await vi.advanceTimersByTimeAsync(5500);
            expect(s.state.subscribes).toBe(before + 1);
        }
        db.close('test');
    });

    it('⛔ CHANNEL_ERROR ហើយ realtime-js ភ្ជាប់ channel ដដែលវិញខ្លួនឯង (SUBSCRIBED) ➜ មិនរុះ channel ដែលរស់', async () => {
        vi.useFakeTimers();
        const s = realtimeServer();
        const db = openRealtime(s);
        await vi.advanceTimersByTimeAsync(1000);
        s.state.statuses[0]('CHANNEL_ERROR');
        await vi.advanceTimersByTimeAsync(2000);
        s.state.statuses[0]('SUBSCRIBED');
        await vi.advanceTimersByTimeAsync(120000);
        expect(s.state.subscribes).toBe(1);
        expect(s.state.unsubscribed).toBe(0);
        db.close('test');
    });

    it('⛔ CLOSED ២ ដងលើ channel តែមួយ ➜ timer សាកឡើងវិញតែមួយ (មិនរុះ channel ថ្មីដែលកំពុងភ្ជាប់)', async () => {
        vi.useFakeTimers();
        const s = realtimeServer();
        const db = openRealtime(s);
        await vi.advanceTimersByTimeAsync(1000);
        s.state.subscribedAfterMs = 20000;
        s.state.statuses[0]('CLOSED');
        s.state.statuses[0]('CLOSED');
        await vi.advanceTimersByTimeAsync(19000);
        expect(s.state.subscribes).toBe(2);
        db.close('test');
    });

    it('⛔ channel ចាស់ផ្ញើ CLOSED យឺតក្រោយត្រូវរុះ (ដូច removeChannel) ➜ មិនបង្កើតវដ្ត subscribe ឥតឈប់', async () => {
        vi.useFakeTimers();
        const s = realtimeServer({ closeOnUnsubscribe: true });
        const db = openRealtime(s);
        await vi.advanceTimersByTimeAsync(1000);
        s.state.statuses[0]('CLOSED');
        await vi.advanceTimersByTimeAsync(600000);
        expect(s.state.subscribes).toBe(2);
        db.close('test');
    });

    it('⛔ goOffline/goOnline ពេលកំពុងរង់ចាំសាកឡើងវិញ ➜ timer ចាស់មិនរុះ channel ថ្មីដែលកំពុងភ្ជាប់', async () => {
        vi.useFakeTimers();
        const s = realtimeServer();
        const db = openRealtime(s);
        await vi.advanceTimersByTimeAsync(1000);
        s.state.statuses[0]('CLOSED');
        s.state.subscribedAfterMs = 8000;
        await vi.advanceTimersByTimeAsync(1000);
        db.goOffline();
        db.goOnline();
        await vi.advanceTimersByTimeAsync(10000);
        expect(s.state.subscribes).toBe(2);
        db.close('test');
    });

    it('⛔ transport.subscribe បោះ (sync) ➜ សាកឡើងវិញតាមជំហាន', async () => {
        vi.useFakeTimers();
        const s = realtimeServer();
        const original = s.transport.subscribe;
        let throws = 1;
        s.transport.subscribe = (...args: any[]) => {
            if (throws-- > 0) { s.state.subscribes++; throw new Error('boom'); }
            return (original as any)(...args);
        };
        const db = openRealtime(s);
        await vi.advanceTimersByTimeAsync(6000);
        expect(s.state.subscribes).toBe(2);
        db.close('test');
    });

    it('ទិសផ្ទុយ ៖ SUBSCRIBED នៅរស់ ➜ មិន subscribe ម្តងទៀត · stopRealtime ខ្លួនឯង (goOffline) មិនបង្កើតឡើងវិញ', async () => {
        vi.useFakeTimers();
        const s = realtimeServer();
        const db = createSupabaseDatabase(s.transport, {
            onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {}
        }, {});
        db.setAuthed(true, 'scope');
        db.setTenantTopic('zoe:t1');
        db.onValue(db.ref('tx'), () => {});
        await vi.advanceTimersByTimeAsync(600000);
        expect(s.state.subscribes).toBe(1);
        db.goOffline();
        await vi.advanceTimersByTimeAsync(600000);
        expect(s.state.subscribes).toBe(1);
        db.close('test');
    });
});
