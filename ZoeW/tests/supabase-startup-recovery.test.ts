import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setImmediate } from 'node:timers';
import { createSupabaseSdk } from '../src/services/supabase-sdk';
import { SbRpcError } from '../src/services/supabase-rtdb';
import { createLocalWriteJournal } from '../src/services/write-journal';

const URL = 'https://abcdefghijklmnopqrst.supabase.co';
const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER = '33333333-3333-4333-8333-333333333333';
const UID = '22222222-2222-4222-8222-222222222222';
const SCOPE = URL + '|' + UID;
const TOPIC = 'zoe:' + TENANT;
const ORIGINAL_ID = 'startup_original_receipt_001';
const ORIGINAL_OPS = [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4111 }];
const MONEY = { codDollar: 37, dodDollar: 5, totalCount: 11 };
const clients: any[] = [];
const deferred = () => { let resolve: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve: () => resolve() }; };
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
async function drain() { for (let i = 0; i < 12; i++) await turn(); }
async function reached(check: () => boolean) {
    for (let i = 0; i < 200; i++) { if (check()) return; await turn(); }
    expect(check(), 'explicit synthetic startup stage').toBe(true);
}
function memory() {
    const rows = new Map<string, string>();
    return { get length() { return rows.size; }, key: (index: number) => [...rows.keys()][index] ?? null,
        getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, String(value)); },
        removeItem: (key: string) => rows.delete(key) };
}
function fixture(order: 'pull-first' | 'account-first', options: { noSession?: boolean; noTenant?: boolean; original?: 'sent' | 'unresolved' } = {}) {
    const account = deferred(), pull = deferred(), calls: any[] = [], events: string[] = [];
    const storage = memory(), journal = createLocalWriteJournal(storage);
    const state = { setting: options.original ? 4111 : 4100, money: structuredClone(MONEY), effects: options.original ? 1 : 0 };
    const original = options.original ? { v: 1, scope: SCOPE, topic: TOPIC, opId: ORIGINAL_ID, ops: structuredClone(ORIGINAL_OPS),
        writeProtocol: 2, stage: options.original, uncertain: true, sentAfter: Date.now() - 1000, queuedAt: Date.now() - 1000 } : null;
    if (original) expect(journal.put(original)).toBe(true);
    let pulls = 0;
    const replayOnly = (args: any) => {
        if (!original || Object.keys(args).length !== 3 || args.p_expected_tenant !== TENANT || args.p_op_id !== ORIGINAL_ID
            || JSON.stringify(args.p_ops) !== JSON.stringify(ORIGINAL_OPS)) throw new SbRpcError('original recovery binding rejected', 'PT409', 409, '');
        return { ok: true, seq: 1, now: Date.now(), docs: [], replayed: true };
    };
    const session = options.noSession ? null : { access_token: 'synthetic', user: { id: UID, email: 'startup@fixture.invalid' } };
    const transport = {
        restoreSession: async () => session, readAccount: () => null, writeAccount() {}, onSession: () => () => {},
        onForeignSession: () => () => {}, subscribe: () => ({ unsubscribe() {} }), ping: async () => {}, close() {},
        async rpc(fn: string, args: any) {
            calls.push({ fn, args: structuredClone(args) });
            if (fn === 'my_account') {
                if (order === 'pull-first') await account.promise;
                events.push('account-result');
                return [{ tenant_id: options.noTenant ? null : TENANT, status: 'active', username: 'synthetic' }];
            }
            if (fn === 'zoe_pull') {
                pulls++;
                if (order === 'account-first' && pulls === 1) await pull.promise;
                events.push('pull-result');
                return { seq: 1, now: Date.now(), tenant: TENANT, reset: true, more: false,
                    rows: [{ r: 'zoew_settings', k: 'exchange_rate', v: state.setting, s: 1 },
                        { r: 'zoew_daily_revenue_cod_dod', k: '2026-11-01', v: structuredClone(state.money), s: 1 }] };
            }
            if (fn === 'zoe_now') return Date.now();
            if (fn === 'zoe_read') {
                const setting = args.p_root === 'zoew_settings' && args.p_key === 'exchange_rate';
                const money = args.p_root === 'zoew_daily_revenue_cod_dod' && args.p_key === '2026-11-01';
                if (!setting && !money) throw new Error('Unexpected synthetic read path');
                return { seq: 1, now: Date.now(), docs: [{ r: args.p_root, k: args.p_key,
                    v: setting ? state.setting : structuredClone(state.money), s: 1 }] };
            }
            if (fn === 'zoe_write_v2') {
                if (original) return replayOnly(args);
                throw new SbRpcError('function unavailable', 'PGRST202', 404, '');
            }
            throw new Error('Unexpected synthetic RPC ' + fn);
        }
    };
    const sdk = createSupabaseSdk(() => transport, { docsCache: null, writeJournal: journal,
        onListenerError: vi.fn(), onAccountBlocked: vi.fn(), onSessionEnded: vi.fn(), onTenantChanged: vi.fn(),
        dbOptions: { pollFallbackMs: 600000, retryStepsMs: [10], rpcTimeoutMs: 5000 } });
    const app = sdk.initializeApp({ supabaseUrl: URL, supabaseKey: 'sb_publishable_synthetic' });
    const auth = sdk.getAuth(app), db = sdk.getDatabase(app);
    const row = { sdk, app, auth, db, journal, storage, account, pull, calls, events, state, original, replayOnly, get pulls() { return pulls; } };
    clients.push(row);
    return row;
}
async function ready(client: ReturnType<typeof fixture>, order: 'pull-first' | 'account-first') {
    if (order === 'pull-first') {
        await reached(() => client.db.isReady());
        expect(client.sdk.tenantScope(client.auth)).toBe('');
        client.account.resolve();
    } else {
        await reached(() => client.sdk.tenantScope(client.auth) === TENANT);
        expect(client.db.isReady()).toBe(false);
        client.pull.resolve();
    }
    await reached(() => client.db.isReady() && client.sdk.tenantScope(client.auth) === TENANT);
    await drain();
}
beforeEach(() => vi.stubGlobal('navigator', { onLine: true }));
afterEach(async () => {
    for (const client of clients.splice(0)) {
        client.account.resolve(); client.pull.resolve();
        await client.sdk.deleteApp(client.app);
    }
    vi.unstubAllGlobals();
});

it.each(['pull-first', 'account-first'] as const)('C04 startup %s៖ first setting write ចប់ដោយ original v2 តែមួយ មិនត្រូវ external sync', async order => {
    const client = fixture(order);
    await ready(client, order);
    const previousPulls = client.pulls;
    client.db.setTenantTopic(TOPIC); client.db.setTenantTopic(TOPIC);
    await drain();
    expect(client.pulls).toBe(previousPulls);
    expect(client.pulls).toBeLessThanOrEqual(2);
    let settled = false, failed = false;
    const pending = client.db.set(client.db.ref('zoew_settings/exchange_rate'), 4111).then(() => { settled = true; }, () => { settled = true; failed = true; });
    const original = client.journal.list(SCOPE, TOPIC)[0];
    try {
        await drain();
        const writes = client.calls.filter(row => row.fn === 'zoe_write_v2' || row.fn === 'zoe_write');
        expect(settled, JSON.stringify({ recovery: client.db.recoveryState(), events: client.events })).toBe(true);
        expect(failed).toBe(true);
        expect(writes).toHaveLength(1);
        expect(writes[0]).toEqual({ fn: 'zoe_write_v2', args: { p_expected_tenant: TENANT, p_op_id: original.opId,
            p_ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4111 }] } });
        expect(client.journal.list(SCOPE, TOPIC)).toEqual([]);
        expect(client.db.recoveryState().pending).toBe(0);
    } finally {
        await client.sdk.deleteApp(client.app);
        await pending;
    }
});

it.each(['scope', 'tenant'] as const)('C04 startup៖ queued original %s ផ្លាស់ មិនmint intent ឬផ្ញើហាងថ្មី', async change => {
    const client = fixture('account-first');
    await ready(client, 'account-first');
    const pending = client.db.set(client.db.ref('zoew_settings/exchange_rate'), 4111).then(() => false, () => true);
    const original = client.journal.list(SCOPE, TOPIC)[0];
    expect(original).toMatchObject({ scope: SCOPE, topic: TOPIC, awaitingRecovery: true });
    if (change === 'scope') client.db.setAuthed(true, URL + '|different-user');
    else client.db.setTenantTopic('zoe:' + OTHER);
    await drain();
    try {
        expect(await pending).toBe(true);
        expect(client.calls.filter(row => /zoe_write/.test(row.fn))).toEqual([]);
        expect(client.journal.list(SCOPE, TOPIC).every(row => row.opId === original.opId)).toBe(true);
        expect(client.journal.list(change === 'scope' ? URL + '|different-user' : SCOPE,
            change === 'tenant' ? 'zoe:' + OTHER : TOPIC)).toEqual([]);
        const retained = Array.from({ length: client.storage.length }, (_, index) => client.storage.key(index))
            .filter(key => key?.startsWith('zoew_connection_writes_v1:'))
            .map(key => JSON.parse(client.storage.getItem(key!)!));
        expect(retained.every(row => row.opId === original.opId && row.scope === SCOPE && row.topic === TOPIC)).toBe(true);
    } finally { await client.sdk.deleteApp(client.app); }
});

it.each(['session', 'tenant'] as const)('C04 startup៖ unknown %s មិនអនុញ្ញាត setting write', async unknown => {
    const client = fixture('pull-first', { noSession: unknown === 'session', noTenant: unknown === 'tenant' });
    client.account.resolve(); client.pull.resolve();
    await drain();
    await expect(client.db.set(client.db.ref('zoew_settings/exchange_rate'), 4111)).rejects.toBeTruthy();
    expect(client.calls.filter(row => /zoe_write/.test(row.fn))).toEqual([]);
    expect(client.journal.list(SCOPE, TOPIC)).toEqual([]);
});

it('C04 startup៖ close មុន account reply មិនចាប់ recovery ឬ write ថ្មី', async () => {
    const client = fixture('pull-first');
    await reached(() => client.db.isReady());
    const before = client.pulls;
    await client.sdk.deleteApp(client.app);
    client.account.resolve(); await drain();
    await expect(client.db.set(client.db.ref('zoew_settings/exchange_rate'), 4111)).rejects.toBeTruthy();
    expect(client.pulls).toBe(before);
    expect(client.calls.filter(row => /zoe_write/.test(row.fn))).toEqual([]);
});

it.each(['pull-first', 'account-first'] as const)('C04 startup %s៖ original lost-ACK journal សង្គ្រោះ receipt ដដែល មិនអនុវត្តម្ដងទៀត', async order => {
    const client = fixture(order, { original: 'sent' });
    const state = structuredClone(client.state);
    await ready(client, order);
    expect(client.journal.list(SCOPE, TOPIC)).toEqual([]);
    const writes = client.calls.filter(row => /zoe_write/.test(row.fn));
    expect(writes).toEqual([{ fn: 'zoe_write_v2', args: { p_expected_tenant: TENANT, p_op_id: ORIGINAL_ID, p_ops: ORIGINAL_OPS } }]);
    expect(client.state).toEqual(state);
    expect(client.state.effects).toBe(1);
    expect((await client.sdk.get(client.db.ref('zoew_settings/exchange_rate'))).val()).toBe(4111);
    expect((await client.sdk.get(client.db.ref('zoew_daily_revenue_cod_dod/2026-11-01'))).val()).toEqual(MONEY);
    const before = client.calls.length;
    client.db.setTenantTopic(TOPIC); client.db.setTenantTopic(TOPIC); await drain();
    expect(client.calls).toHaveLength(before);
    expect(client.journal.list(SCOPE, TOPIC)).toEqual([]);
    expect(client.state).toEqual(state);
    expect(() => client.replayOnly({ ...writes[0].args, p_op_id: 'fresh_identity_must_be_refused' })).toThrow();
    expect(() => client.replayOnly({ ...writes[0].args, p_ops: [{ ...ORIGINAL_OPS[0], v: 4112 }] })).toThrow();
    expect(client.state).toEqual(state);
});

it('C04 startup៖ literal unresolved original evidence នៅ HOLD ទោះ server មាន receipt ក៏ដោយ', async () => {
    const client = fixture('pull-first', { original: 'unresolved' });
    const original = structuredClone(client.original), state = structuredClone(client.state);
    const stored = () => Array.from({ length: client.storage.length }, (_, index) => client.storage.key(index))
        .map(key => [key, client.storage.getItem(key!)]);
    const raw = stored();
    await ready(client, 'pull-first');
    expect(client.journal.list(SCOPE, TOPIC)).toEqual([original]);
    expect(stored()).toEqual(raw);
    expect(client.db.recoveryState()).toMatchObject({ blocked: 1, pending: 0 });
    expect(client.calls.filter(row => /zoe_write/.test(row.fn))).toEqual([]);
    const before = client.calls.length;
    client.db.setTenantTopic(TOPIC); await drain();
    expect(client.calls).toHaveLength(before);
    expect(client.journal.list(SCOPE, TOPIC)).toEqual([original]);
    expect(stored()).toEqual(raw);
    expect(client.state).toEqual(state);
});
