import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createSupabaseSdk } from '../src/services/supabase-sdk';
import { createSupabaseTransport, SB_AUTH_STORAGE_KEY, SB_AUTH_OWNER_KEY } from '../src/services/supabase-transport';
import { createLocalWriteJournal } from '../src/services/write-journal';

const ROOT = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);
const { createPgHarness } = require(ROOT + '/audit-tools/supabase-pg.js');
const PG = createPgHarness({ depsDirs: [ROOT + '/supabase/node_modules'], shimDir: ROOT + '/audit-tools/supabase-shim', wantMajor: 17 });
const URL = 'https://abcdefghijklmnopqrst.supabase.co';
const evidence: any[] = [];
let admin: any;
let dbName: string;
let serial = 0;
let contractBefore: any = null, contractAfter: any = null;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve: (value?: any) => void; const promise = new Promise(r => { resolve = r; }); return { promise, resolve: resolve! }; };
const memory = () => {
    const rows = new Map<string, string>();
    return { getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => { rows.set(k, String(v)); },
        removeItem: (k: string) => { rows.delete(k); }, get length() { return rows.size; }, key: (i: number) => [...rows.keys()][i] ?? null };
};
const until = async (check: () => boolean) => { for (let i = 0; i < 500 && !check(); i++) await sleep(5); expect(check()).toBe(true); };
const waitLocked = async (pid: number) => {
    let locked = false;
    for (let i = 0; i < 100 && !locked; i++) {
        locked = (await admin.query('select wait_event_type from pg_stat_activity where pid=$1', [pid])).rows[0]?.wait_event_type === 'Lock';
        if (!locked) await sleep(5);
    }
    expect(locked).toBe(true);
};
const settingsOp = (value: number) => [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: value }];
const persistenceContract = async () => ({
    relations: (await admin.query(`select n.nspname as schema, c.relname as name, c.relkind as kind,
        c.relrowsecurity as rls, c.relforcerowsecurity as force_rls, c.relacl::text as acl,
        coalesce((select jsonb_agg(jsonb_build_array(a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull) order by a.attnum)
            from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'[]'::jsonb) as columns,
        case when c.relkind in ('i','I') then pg_get_indexdef(c.oid) else null end as index_definition
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname not like 'pg_%' and n.nspname<>'information_schema' and c.relkind in ('r','p','m','S','i','I')
        order by n.nspname,c.relname`)).rows,
    functions: (await admin.query(`select pg_get_functiondef('private.zoe_apply(uuid,text,jsonb,boolean,boolean)'::regprocedure) as apply,
        pg_get_functiondef('private.zoe_housekeeping(uuid)'::regprocedure) as housekeeping,
        pg_get_functiondef('public.zoe_write(text,jsonb)'::regprocedure) as legacy_write`)).rows[0],
    receiptConstraints: (await admin.query(`select pg_get_constraintdef(oid) as definition from pg_constraint
        where conrelid='public.zoe_ops'::regclass order by conname`)).rows
});

beforeAll(async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    await PG.start();
    const db = await PG.freshDb('default-grants');
    admin = db.c; dbName = db.name;
    for (const file of fs.readdirSync(ROOT + '/supabase/migrations').filter(n => n.endsWith('.sql')).sort()) {
        if (file === '20261101071233_zoe_write_original_tenant.sql') contractBefore = await persistenceContract();
        await admin.query(fs.readFileSync(ROOT + '/supabase/migrations/' + file, 'utf8'));
        if (file === '20261101071233_zoe_write_original_tenant.sql') contractAfter = await persistenceContract();
    }
}, 30000);

afterAll(async () => {
    if (admin) await admin.end();
    PG.stop(); vi.unstubAllGlobals();
    if (process.env.C04_EVIDENCE_FILE) fs.writeFileSync(process.env.C04_EVIDENCE_FILE, JSON.stringify({
        provider: PG.pgBin?.version, sourceRoot: ROOT, evidence,
        limits: ['PostgREST routing and JWT issuance simulated; real authenticated PostgreSQL and actual SDK/transport execute.',
            'Privileged membership maintenance is synthetic. No hosted services, credentials, customer data or Firebase used.']
    }, null, 2) + '\n');
});

async function fixture() {
    const name = 'c04_' + (++serial);
    const tenants = (await admin.query("insert into public.tenants(name,branch_code,expires_at) values($1,$2,now()+interval'1 day'),($3,$4,now()+interval'1 day') returning id", [name + 'A', name + 'A', name + 'B', name + 'B'])).rows;
    const A = tenants[0].id, B = tenants[1].id;
    const uid = await PG.makeAuthUser(admin, name + '@users.zoew.invalid');
    await admin.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [uid, A, name]);
    const sid = (await admin.query('insert into auth.sessions(id,user_id,created_at) values(gen_random_uuid(),$1,now()) returning id', [uid])).rows[0].id;
    const who = { role: 'authenticated', sub: uid, extra: { session_id: sid } };
    for (const [tenant, value] of [[A, 4100], [B, 4200]]) {
        const result = await PG.as(admin, { role: 'service_role' }, 'select public.zoe_admin_write($1,$2,$3::jsonb) as r', [tenant, 'seed_c04_original_' + name + '_' + value, JSON.stringify(settingsOp(value as number))]);
        expect(result.error).toBeUndefined();
    }
    const move = () => admin.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [B, uid]);
    const values = async () => {
        const rows = (await admin.query("select tenant_id,value from public.zoe_docs where root='zoew_settings' and key='exchange_rate' and tenant_id in($1,$2)", [A, B])).rows;
        return { A: rows.find((r: any) => r.tenant_id === A)?.value, B: rows.find((r: any) => r.tenant_id === B)?.value };
    };
    const write = async (tenant: string, opId: string, ops: any[] = settingsOp(4111), c: any = admin) =>
        PG.as(c, who, 'select public.zoe_write_v2($1,$2,$3::jsonb) as r', [tenant, opId, JSON.stringify(ops)]);
    return { name, A, B, uid, sid, who, move, values, write };
}

async function openClient(f: Awaited<ReturnType<typeof fixture>>, options: any = {}) {
    const store = options.store || memory(), sessionStore = memory();
    const journal = createLocalWriteJournal(store), calls: any[] = [], outcomes: any[] = [];
    const committed = deferred(), release = deferred();
    let writes = 0, movedAfterPull = false, currentApp: any = null;
    const session = { access_token: 'mock.' + f.uid + '.signature', refresh_token: 'refresh-' + f.uid,
        expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: { id: f.uid, email: f.name + '@users.zoew.invalid', aud: 'authenticated' } };
    store.setItem(SB_AUTH_STORAGE_KEY, JSON.stringify(session)); store.setItem(SB_AUTH_OWNER_KEY, URL);
    const fetch = async (input: any, init: any) => {
        const requestUrl = String(input), fn = (requestUrl.match(/\/rpc\/([^?]+)/) || [])[1];
        const args = init?.body ? JSON.parse(init.body) : {};
        const topicAtStart = currentApp?._tenantTopic;
        calls.push({ fn, args });
        if (requestUrl.includes('/auth/v1/token')) return new Response(JSON.stringify(session), { status: 200 });
        if (requestUrl.includes('/auth/v1/logout')) return new Response(null, { status: 204 });
        const c = await PG.connect('postgres', dbName);
        let result: any;
        try {
            if (fn === 'my_account') result = await PG.as(c, f.who, 'select * from public.my_account()');
            else if (fn === 'zoe_pull') result = await PG.as(c, f.who, 'select public.zoe_pull($1,$2,$3) as r', [args.p_since, args.p_limit, args.p_full_head ?? null]);
            else if (fn === 'zoe_now') result = await PG.as(c, f.who, 'select public.zoe_now() as r');
            else if (fn === 'zoe_read') result = await PG.as(c, f.who, 'select public.zoe_read($1,$2) as r', [args.p_root, args.p_key]);
            else if (fn === 'zoe_write' || fn === 'zoe_write_v2') {
                writes++;
                if (options.unsupported && fn === 'zoe_write_v2') result = { error: { code: 'PGRST202', message: 'function unavailable' } };
                else if (fn === 'zoe_write_v2') result = await f.write(args.p_expected_tenant, args.p_op_id, args.p_ops, c);
                else result = await PG.as(c, f.who, 'select public.zoe_write($1,$2::jsonb) as r', [args.p_op_id, JSON.stringify(args.p_ops)]);
            } else throw new Error('Unexpected RPC ' + fn);
        } finally { await c.end(); }
        if (fn === 'zoe_pull' && topicAtStart === 'zoe:' + f.A && options.moveAfterFirstPull && !movedAfterPull && !result.error) {
            movedAfterPull = true; await f.move();
        }
        if ((fn === 'zoe_write' || fn === 'zoe_write_v2') && writes === 1 && !result.error) {
            committed.resolve();
            if (options.firstReply === 'lost') throw new TypeError('synthetic reply lost after commit');
            if (options.firstReply === 'lost-held') { await release.promise; throw new TypeError('synthetic reply lost after commit'); }
            if (options.firstReply === 'late') await release.promise;
        }
        return result.error ? new Response(JSON.stringify(result.error), { status: result.error.code === '42501' ? 403 : result.error.code === 'PT401' ? 401
            : result.error.code === 'PT409' ? 409 : result.error.code === 'PGRST202' ? 404 : 400, headers: { 'content-type': 'application/json' } })
            : new Response(JSON.stringify(fn === 'my_account' ? result.rows : result.rows[0]?.r), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const sdk = createSupabaseSdk((cfg: any) => createSupabaseTransport(cfg, { fetch, localStorage: store, sessionStorage: sessionStore, eventTarget: new EventTarget(), fetchTimeoutMs: 5000 }),
        { onListenerError: () => {}, onAccountBlocked: () => {}, onSessionEnded: () => {}, onTenantChanged: () => {},
            onTxOutcomeUnknown: (...args: any[]) => outcomes.push(args), docsCache: null, writeJournal: journal,
            dbOptions: { pollFallbackMs: 600000, retryStepsMs: [10], rpcTimeoutMs: 5000 } });
    const app = sdk.initializeApp({ supabaseUrl: URL, supabaseKey: 'sb_publishable_fixture' });
    currentApp = app;
    const auth: any = sdk.getAuth(app), db: any = sdk.getDatabase(app);
    await until(() => db.isReady() && sdk.tenantScope(auth) === (options.expectedTenant || f.A));
    if (options.moveAfterFirstPull && !movedAfterPull) db.goOnline();
    const close = () => sdk.deleteApp(app);
    return { sdk, auth, db, calls, journal, store, close, committed, release, outcomes,
        writeCalls: () => calls.filter(row => row.fn === 'zoe_write' || row.fn === 'zoe_write_v2') };
}

it('C04 control៖ ហាងដដែល ទទួលការសរសេរតែមួយ', async () => {
    const f = await fixture(), c = await openClient(f);
    try {
        await c.db.set(c.db.ref('zoew_settings/exchange_rate'), 4111);
        expect(await f.values()).toEqual({ A: 4111, B: 4200 });
        expect(c.writeCalls()).toHaveLength(1);
    } finally { await c.close(); }
});

it('C04 RED៖ ចេតនា A ក្នុងជួរ មិនសរសេរ B ក្រោយសមាជិកផ្លាស់នៅ server', async () => {
    const f = await fixture(), c = await openClient(f);
    try {
        c.db.goOffline();
        const pending = c.db.set(c.db.ref('zoew_settings/exchange_rate'), 4111).then(() => 'success', () => 'refused');
        await until(() => c.journal.list(URL + '|' + f.uid, 'zoe:' + f.A).some(r => r.stage === 'queued'));
        await f.move(); c.db.goOnline();
        const verdict = await pending;
        evidence.push({ scenario: 'queued-original-A-after-server-move', verdict, calls: c.writeCalls(), values: await f.values() });
        expect(await f.values()).toEqual({ A: 4100, B: 4200 });
        expect(verdict).toBe('refused');
        expect(c.writeCalls().every(r => r.fn === 'zoe_write_v2' && r.args.p_expected_tenant === f.A)).toBe(true);
    } finally { await c.close(); }
});

it('C04 control៖ គណនីទទួល B ច្បាស់ហើយ ចេតនា B ថ្មីដំណើរការ', async () => {
    const f = await fixture(), c = await openClient(f);
    try {
        c.db.goOffline();
        const prior = c.db.set(c.db.ref('zoew_settings/exchange_rate'), 4111).then(() => 'success', () => 'refused');
        await until(() => c.journal.list(URL + '|' + f.uid, 'zoe:' + f.A).some(r => r.stage === 'queued'));
        await f.move(); await c.auth._verifyAccount(); c.db.goOnline();
        expect(await prior).toBe('refused');
        await until(() => c.db.isReady());
        await c.db.set(c.db.ref('zoew_settings/exchange_rate'), 4222);
        expect(await f.values()).toEqual({ A: 4100, B: 4222 });
    } finally { await c.close(); }
});

it('C04៖ journal queued ដែលមិនធ្លាប់ផ្ញើ ចង A ពេលសង្គ្រោះ', async () => {
    const f = await fixture(), store = memory(), opId = 'queued_original_tenant_001';
    createLocalWriteJournal(store).put({ v: 1, scope: URL + '|' + f.uid, topic: 'zoe:' + f.A, opId, ops: settingsOp(4111), stage: 'queued', sentAfter: 0, queuedAt: Date.now() });
    const c = await openClient(f, { store });
    try {
        await until(() => c.writeCalls().length === 1);
        expect(c.writeCalls()[0].args.p_expected_tenant).toBe(f.A);
        expect(await f.values()).toEqual({ A: 4111, B: 4200 });
    } finally { await c.close(); }
});

it.each(['queued', 'sent'])('C04៖ recovery %s ផ្ញើ tenant A ដើម ទោះ membership ប្រែក្រោយ pull', async stage => {
    const f = await fixture(), store = memory(), journal = createLocalWriteJournal(store), opId = 'recovery_pull_race_' + stage;
    const ops = [{ k: 'inc', p: ['zoew_settings', 'exchange_rate'], d: 1 }];
    if (stage === 'sent') expect((await f.write(f.A, opId, ops)).error).toBeUndefined();
    journal.put({ v: 1, scope: URL + '|' + f.uid, topic: 'zoe:' + f.A, opId, ops,
        ...(stage === 'sent' ? { writeProtocol: 2, uncertain: true } : {}), stage,
        sentAfter: stage === 'sent' ? Date.now() : 0, queuedAt: Date.now() });
    const c = await openClient(f, { store, moveAfterFirstPull: true });
    try {
        await until(() => c.writeCalls().length === 1);
        await until(() => !c.db.recoveryState().recovering && (stage === 'sent'
            ? journal.list(URL + '|' + f.uid, 'zoe:' + f.A)[0]?.stage === 'unresolved'
            : journal.list(URL + '|' + f.uid, 'zoe:' + f.A).length === 0));
        expect(c.writeCalls()).toHaveLength(1);
        expect(c.writeCalls()[0].fn).toBe('zoe_write_v2');
        expect(c.writeCalls()[0].args).toEqual({ p_expected_tenant: f.A, p_op_id: opId, p_ops: ops });
        expect(await f.values()).toEqual({ A: stage === 'sent' ? 4101 : 4100, B: 4200 });
        const retained = journal.list(URL + '|' + f.uid, 'zoe:' + f.A);
        if (stage === 'sent') { expect(retained).toHaveLength(1); expect(retained[0].stage).toBe('unresolved'); }
        else expect(retained).toEqual([]);
    } finally { await c.close(); }
});

it('C04៖ journal v2 បាត់ ACK សង្គ្រោះ receipt ដើម ដោយមិនបន្ថែមផលប៉ះពាល់', async () => {
    const f = await fixture(), store = memory(), opId = 'v2_recovery_original_001';
    const ops = [{ k: 'inc', p: ['zoew_settings', 'exchange_rate'], d: 1 }];
    expect((await f.write(f.A, opId, ops)).error).toBeUndefined();
    createLocalWriteJournal(store).put({ v: 1, scope: URL + '|' + f.uid, topic: 'zoe:' + f.A, opId,
        ops, writeProtocol: 2, stage: 'sent', uncertain: true, sentAfter: Date.now(), queuedAt: Date.now() });
    const c = await openClient(f, { store });
    try {
        await until(() => !c.db.recoveryState().recovering);
        expect(c.writeCalls()).toHaveLength(1);
        expect(c.writeCalls()[0].args).toEqual({ p_expected_tenant: f.A, p_op_id: opId, p_ops: ops });
        expect(await f.values()).toEqual({ A: 4101, B: 4200 });
        expect(c.journal.list(URL + '|' + f.uid, 'zoe:' + f.A)).toEqual([]);
    } finally { await c.close(); }
});

it('C04៖ journal A រក្សាបៃដដែលពេលចូល B ហើយចេតនា B ថ្មីនៅតែអាចដំណើរការ', async () => {
    const f = await fixture(), store = memory(), journal = createLocalWriteJournal(store);
    const row = { v: 1, scope: URL + '|' + f.uid, topic: 'zoe:' + f.A, opId: 'stale_other_tenant_001', ops: settingsOp(4111),
        writeProtocol: 2, stage: 'sent', uncertain: true, sentAfter: Date.now(), queuedAt: Date.now() };
    journal.put(row); await f.move();
    const c = await openClient(f, { store, expectedTenant: f.B });
    try {
        await c.db.set(c.db.ref('zoew_settings/exchange_rate'), 4222);
        expect(c.journal.list(row.scope, row.topic)).toEqual([row]);
        expect(c.writeCalls()).toHaveLength(1);
        expect(c.writeCalls()[0].args.p_expected_tenant).toBe(f.B);
        expect(await f.values()).toEqual({ A: 4100, B: 4222 });
    } finally { await c.close(); }
});

it.each([
    { stage: 'sent', uncertain: false, sentAfter: 1 },
    { stage: 'sent', uncertain: true, sentAfter: 1 },
    { stage: 'cancelled', uncertain: true, sentAfter: 1 },
    { stage: 'unresolved', uncertain: true, sentAfter: 1 },
    { stage: 'queued', uncertain: false, sentAfter: 1 }
])('C04៖ journal ចាស់ដែលបានផ្ញើ រក្សា HOLD $stage $uncertain', async state => {
    const f = await fixture(), store = memory(), opId = 'legacy_uncertain_tenant_001';
    const row = { v: 1, scope: URL + '|' + f.uid, topic: 'zoe:' + f.A, opId, ops: settingsOp(4111), queuedAt: Date.now(), ...state, sentAfter: Date.now() };
    createLocalWriteJournal(store).put(row);
    const c = await openClient(f, { store });
    try {
        await until(() => !c.db.recoveryState().recovering);
        expect(c.writeCalls()).toEqual([]);
        expect(c.db.recoveryState().blocked).toBe(1);
        expect(c.journal.list(row.scope, row.topic)).toEqual([row]);
        expect(await f.values()).toEqual({ A: 4100, B: 4200 });
    } finally { await c.close(); }
});

it('C04៖ v2 មិនមាន មិនត្រឡប់ទៅ v1', async () => {
    const f = await fixture(), c = await openClient(f, { unsupported: true });
    try {
        await expect(c.db.set(c.db.ref('zoew_settings/exchange_rate'), 4111)).rejects.toBeTruthy();
        expect(c.writeCalls().map(r => r.fn)).toEqual(['zoe_write_v2']);
        expect(await f.values()).toEqual({ A: 4100, B: 4200 });
    } finally { await c.close(); }
});

it('C04៖ transaction បាត់ ACK សរសេរម្តង និងរក្សា opId ដើម', async () => {
    const f = await fixture(), c = await openClient(f, { firstReply: 'lost' });
    let updaterCalls = 0;
    try {
        const result = await c.db.runTransaction(c.db.ref('zoew_settings/exchange_rate'), (value: number) => { updaterCalls++; return value + 1; });
        expect(result.committed).toBe(true); expect(updaterCalls).toBe(1);
        expect(await f.values()).toEqual({ A: 4101, B: 4200 });
        expect(c.writeCalls().length).toBeGreaterThanOrEqual(2);
        expect(new Set(c.writeCalls().map(r => r.args.p_op_id)).size).toBe(1);
        expect(c.writeCalls().every(r => r.args.p_expected_tenant === f.A)).toBe(true);
    } finally { await c.close(); }
});

it.each(['active', 'revoked', 'removed'])('C04៖ បាត់ ACK រួចផ្លាស់សិទ្ធិ %s រក្សា unknown និង journal ពេលចូល A ឡើងវិញ', async mode => {
    const f = await fixture(), c = await openClient(f, { firstReply: 'lost-held' });
    try {
        const result = c.db.runTransaction(c.db.ref('zoew_settings/exchange_rate'), (value: number) => value + 1).then(() => null, (e: any) => e);
        await c.committed.promise; await f.move();
        if (mode === 'revoked') await admin.query('update public.tenants set revoked=true where id=$1', [f.B]);
        if (mode === 'removed') await admin.query('delete from public.tenant_members where user_id=$1', [f.uid]);
        c.release.resolve();
        expect((await result)?.txOutcome).toBe('unknown');
        expect(await f.values()).toEqual({ A: 4101, B: 4200 });
        expect(new Set(c.writeCalls().map(r => r.args.p_op_id)).size).toBe(1);
        const rows = c.journal.list(URL + '|' + f.uid, 'zoe:' + f.A);
        expect(rows).toHaveLength(1); expect(rows[0].stage).toBe('unresolved');
        await c.close();
        if (mode === 'removed') await admin.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [f.uid, f.A, f.name]);
        else await admin.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [f.A, f.uid]);
        const next = await openClient(f, { store: c.store });
        try {
            await until(() => !next.db.recoveryState().recovering);
            expect(next.writeCalls()).toEqual([]);
            expect(next.db.recoveryState().blocked).toBe(1);
            expect(next.journal.list(URL + '|' + f.uid, 'zoe:' + f.A)).toEqual(rows);
        } finally { await next.close(); }
        evidence.push({ scenario: 'lost-ACK-then-authority-' + mode + '-and-return', calls: c.writeCalls(), rows, values: await f.values() });
    } finally { c.release.resolve(); await c.close(); }
});

it('C04៖ journal v2 ផុតចន្លោះ replay រក្សា unknown និងមិនបង្កើត opId ថ្មី', async () => {
    const f = await fixture(), store = memory(), journal = createLocalWriteJournal(store);
    const row = { v: 1, scope: URL + '|' + f.uid, topic: 'zoe:' + f.A, opId: 'expired_unknown_cas_001',
        ops: [{ k: 'cas', p: ['zoew_settings', 'exchange_rate'], x: 4100, v: 4101 }],
        writeProtocol: 2, stage: 'sent', uncertain: true, sentAfter: Date.now() - 25 * 60 * 60 * 1000, queuedAt: Date.now() };
    journal.put(row);
    const c = await openClient(f, { store });
    try {
        await until(() => !c.db.recoveryState().recovering);
        expect(c.writeCalls()).toEqual([]); expect(c.db.recoveryState().blocked).toBe(1);
        expect(journal.list(row.scope, row.topic)).toEqual([row]);
    } finally { await c.close(); }
});

it('C04៖ ACK យឺតរបស់ A មិនដាក់ snapshot A ក្នុងគណនី B', async () => {
    const f = await fixture(), c = await openClient(f, { firstReply: 'late' });
    try {
        const pending = c.db.set(c.db.ref('zoew_settings/exchange_rate'), 4111);
        await c.committed.promise; await f.move(); await c.auth._verifyAccount();
        await until(() => c.db.isReady() && c.sdk.tenantScope(c.auth) === f.B);
        c.release.resolve(); await pending;
        expect((await c.db.get(c.db.ref('zoew_settings/exchange_rate'))).val()).toBe(4200);
        expect(await f.values()).toEqual({ A: 4111, B: 4200 });
        expect(c.journal.list(URL + '|' + f.uid, 'zoe:' + f.A)).toEqual([]);
    } finally { c.release.resolve(); await c.close(); }
});

it('C04 SQL៖ ID ដូចគ្នាមិនប្ដូរ original A expectation ហើយ explicit B ជា tenant identity ផ្សេង', async () => {
    const f = await fixture(), opId = 'same_id_original_tenant_001';
    expect((await f.write(f.A, opId)).error).toBeUndefined();
    await admin.query('delete from public.zoe_ops where tenant_id=$1 and op_id=$2', [f.A, opId]);
    await f.move();
    expect((await f.write(f.A, opId, settingsOp(4222))).error?.message).toBe('tenant-mismatch');
    expect(await f.values()).toEqual({ A: 4111, B: 4200 });
    expect((await f.write(f.B, opId, settingsOp(4222))).error).toBeUndefined();
    expect((await admin.query('select tenant_id from public.zoe_ops where op_id=$1', [opId])).rows).toEqual([{ tenant_id: f.B }]);
    expect(await f.values()).toEqual({ A: 4111, B: 4222 });
});

it('C04 scope៖ request A ដែលបដិសេធគ្មាន receipt ឬផលប៉ះពាល់ ហើយ caller ជ្រើស explicit B បាន', async () => {
    const f = await fixture(), opId = 'first_rejected_scope_001'; await f.move();
    expect((await f.write(f.A, opId)).error?.message).toBe('tenant-mismatch');
    expect((await admin.query('select count(*)::int as n from public.zoe_ops where tenant_id in($1,$2) and op_id=$3', [f.A, f.B, opId])).rows[0].n).toBe(0);
    expect(await f.values()).toEqual({ A: 4100, B: 4200 });
    expect((await f.write(f.B, opId, settingsOp(4222))).error).toBeUndefined();
    expect(await f.values()).toEqual({ A: 4100, B: 4222 });
    evidence.push({ scenario: 'rejected-original-A-no-effect-explicit-B-distinct-tenant-identity', values: await f.values() });
});

it('C04 SQL៖ v1 receipt ដូចគ្នានៅ A ត្រូវបាន v2 replay ម្តង ហើយ v1 ក្រោយផ្លាស់ B នៅតែមិនការពារ', async () => {
    const f = await fixture(), opId = 'legacy_and_v2_sameid_001';
    const ops = [{ k: 'inc', p: ['zoew_settings', 'exchange_rate'], d: 1 }];
    const first = await PG.as(admin, f.who, 'select public.zoe_write($1,$2::jsonb) as r', [opId, JSON.stringify(ops)]);
    expect(first.error).toBeUndefined();
    const replay = await f.write(f.A, opId, ops);
    expect(replay.rows[0].r.replayed).toBe(true);
    expect(await f.values()).toEqual({ A: 4101, B: 4200 });
    await f.move();
    const legacy = await PG.as(admin, f.who, 'select public.zoe_write($1,$2::jsonb) as r', [opId, JSON.stringify(ops)]);
    expect(legacy.error).toBeUndefined();
    expect(await f.values()).toEqual({ A: 4101, B: 4201 });
});

it('C04 SQL៖ receipt namespace នៅតែ tenant និង opId មិនបន្ថែម UID uniqueness', async () => {
    const f = await fixture(), other = await fixture(), opId = 'two_users_same_id_001';
    expect((await f.write(f.A, opId)).error).toBeUndefined();
    expect((await other.write(other.A, opId)).error).toBeUndefined();
    const rows = (await admin.query('select tenant_id from public.zoe_ops where op_id=$1 order by tenant_id', [opId])).rows;
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row: any) => row.tenant_id))).toEqual(new Set([f.A, other.A]));
    await admin.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [f.A, other.uid]);
    const replay = await PG.as(admin, other.who, 'select public.zoe_write_v2($1,$2,$3::jsonb) as r', [f.A, opId, JSON.stringify(settingsOp(4222))]);
    expect(replay.error).toBeUndefined(); expect(replay.rows[0].r.replayed).toBe(true);
    expect(await f.values()).toEqual({ A: 4111, B: 4200 });
});

it('C04 SQL៖ ដកនិងបញ្ចូល membership នៅ B មិនអនុញ្ញាត original A intent', async () => {
    const f = await fixture(), opId = 'membership_reinsert_001';
    expect((await f.write(f.A, opId)).error).toBeUndefined();
    await admin.query('delete from public.tenant_members where user_id=$1', [f.uid]);
    await admin.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [f.uid, f.B, f.name]);
    expect((await f.write(f.A, opId)).error?.message).toBe('tenant-mismatch');
    expect((await admin.query('select tenant_id from public.zoe_ops where op_id=$1', [opId])).rows).toEqual([{ tenant_id: f.A }]);
    expect(await f.values()).toEqual({ A: 4111, B: 4200 });
});

it('C04 SQL៖ null tenant និង opId ខុស មិនបង្កើត receipt ឬផលប៉ះពាល់', async () => {
    const f = await fixture();
    expect((await f.write(null as any, 'invalid_null_tenant_001')).error?.message).toBe('tenant-mismatch');
    expect((await f.write(f.A, 'short')).error?.code).toBe('22023');
    expect((await admin.query('select count(*)::int as n from public.zoe_ops where tenant_id=$1 and op_id=any($2::text[])', [f.A, ['invalid_null_tenant_001', 'short']])).rows[0].n).toBe(0);
    expect(await f.values()).toEqual({ A: 4100, B: 4200 });
});

it('C04 SQL៖ receipt និងផលប៉ះពាល់ rollback ជាមួយគ្នា', async () => {
    const f = await fixture(), opId = 'atomic_binding_abort_001';
    expect((await f.write(f.A, opId, [{ k: 'set', p: ['unknown_root', 'x'], v: 1 }])).error).toBeTruthy();
    expect((await admin.query('select count(*)::int as n from public.zoe_ops where tenant_id=$1 and op_id=$2', [f.A, opId])).rows[0].n).toBe(0);
    expect(await f.values()).toEqual({ A: 4100, B: 4200 });
    expect((await f.write(f.A, opId)).error).toBeUndefined();
});

it('C04 SQL៖ write មុន move កាន់ lock រហូត commit ហើយ move ថ្មីទើបដំណើរការ', async () => {
    const f = await fixture(), writer = await PG.connect('postgres', dbName), mover = await PG.connect('postgres', dbName);
    try {
        await writer.query('begin');
        await writer.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'authenticated', sub: f.uid, session_id: f.sid })]);
        await writer.query('set local role authenticated');
        await writer.query('select public.zoe_write_v2($1,$2,$3::jsonb)', [f.A, 'write_before_move_001', JSON.stringify(settingsOp(4111))]);
        const moverPid = (await mover.query('select pg_backend_pid() as pid')).rows[0].pid;
        let moved = false;
        const moving = mover.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [f.B, f.uid]).then(() => { moved = true; });
        await waitLocked(moverPid); expect(moved).toBe(false);
        await writer.query('commit'); await moving;
        expect(moved).toBe(true); expect(await f.values()).toEqual({ A: 4111, B: 4200 });
    } finally { await writer.query('rollback'); await writer.end(); await mover.end(); }
});

it('C04 SQL៖ move មុន write រារាំងចេតនា A ក្រោយ lock ដោះ', async () => {
    const f = await fixture(), writer = await PG.connect('postgres', dbName), mover = await PG.connect('postgres', dbName);
    try {
        await mover.query('begin'); await mover.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [f.B, f.uid]);
        const writerPid = (await writer.query('select pg_backend_pid() as pid')).rows[0].pid;
        let settled = false;
        const writing = f.write(f.A, 'move_before_write_001', settingsOp(4111), writer).then((r: any) => { settled = true; return r; });
        await waitLocked(writerPid); expect(settled).toBe(false);
        await mover.query('commit');
        expect((await writing).error?.message).toBe('tenant-mismatch');
        expect(await f.values()).toEqual({ A: 4100, B: 4200 });
    } finally { await mover.query('rollback'); await mover.end(); await writer.end(); }
});

it('C04 SQL៖ v2 RPC ACL បិទ anon និង service_role ហើយ public wrapper ជា invoker', async () => {
    const f = await fixture();
    for (const role of ['anon', 'service_role']) {
        const result = await PG.as(admin, { role }, 'select public.zoe_write_v2($1,$2,$3::jsonb)', [f.A, 'unauthorized_role_001', JSON.stringify(settingsOp(4111))]);
        expect(PG.denied(result)).toBe(true);
    }
    const flags = (await admin.query("select n.nspname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='zoe_write_v2' order by n.nspname")).rows;
    expect(flags).toEqual([{ nspname: 'private', prosecdef: true }, { nspname: 'public', prosecdef: false }]);
});

it('C04 minimum៖ schema និង receipt/quota/retention contract ដដែល គ្មាន persistence table ថ្មី', async () => {
    expect(contractBefore).not.toBeNull(); expect(contractAfter).toEqual(contractBefore);
    const names = contractAfter.relations.filter((row: any) => row.kind === 'r').map((row: any) => row.schema + '.' + row.name);
    for (const name of ['public.tenants', 'public.tenant_members', 'public.zoe_docs', 'public.zoe_ops', 'public.zoe_tenant_state']) expect(names).toContain(name);
    expect(contractAfter.receiptConstraints).toContainEqual({ definition: 'PRIMARY KEY (tenant_id, op_id)' });
    expect((await admin.query("select to_regclass('private.zoe_write_tenants') as binding")).rows[0].binding).toBeNull();
});

it('C04 minimum៖ CAS conflicts គ្មាន metadata ថ្មី ហើយ no-op ប្រើ receipt/quota ដើមតែប៉ុណ្ណោះ', async () => {
    const f = await fixture();
    const before = (await admin.query('select seq,bytes from public.zoe_tenant_state where tenant_id=$1', [f.A])).rows[0];
    for (let i = 0; i < 8; i++) {
        const result = await f.write(f.A, 'minimal_cas_conflict_' + i, [{ k: 'cas', p: ['zoew_settings', 'exchange_rate'], x: 9999, v: 4111 }]);
        expect(result.error).toBeUndefined(); expect(result.rows[0].r.conflict).toBe(true);
    }
    expect((await admin.query('select seq,bytes from public.zoe_tenant_state where tenant_id=$1', [f.A])).rows[0]).toEqual(before);
    expect((await admin.query("select count(*)::int as n from public.zoe_ops where tenant_id=$1 and op_id like 'minimal_cas_conflict_%'", [f.A])).rows[0].n).toBe(0);
    for (let i = 0; i < 3; i++) expect((await f.write(f.A, 'minimal_existing_noop_' + i, settingsOp(4100))).error).toBeUndefined();
    expect((await admin.query("select count(*)::int as n from public.zoe_ops where tenant_id=$1 and op_id like 'minimal_existing_noop_%'", [f.A])).rows[0].n).toBe(3);
    expect(Number((await admin.query('select bytes from public.zoe_tenant_state where tenant_id=$1', [f.A])).rows[0].bytes)).toBeGreaterThan(Number(before.bytes));
    expect((await admin.query("select to_regclass('private.zoe_write_tenants') as binding")).rows[0].binding).toBeNull();
    expect(await persistenceContract()).toEqual(contractAfter);
    expect(await f.values()).toEqual({ A: 4100, B: 4200 });
});

it('C04 legacy៖ v1 នៅតែដំណើរការ ប៉ុន្តែមិនមាន original tenant ក្នុង protocol', async () => {
    const f = await fixture(); await f.move();
    const result = await PG.as(admin, f.who, 'select public.zoe_write($1,$2::jsonb) as r', ['legacy_compatibility_001', JSON.stringify(settingsOp(4222))]);
    expect(result.error).toBeUndefined(); expect(result.rows[0].r.ok).toBe(true);
    expect(await f.values()).toEqual({ A: 4100, B: 4222 });
    evidence.push({ scenario: 'legacy-v1-explicitly-unprotected', values: await f.values() });
});
