import { afterAll, beforeAll, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import Module, { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../..');
const { createPgHarness } = require(ROOT + '/tools/audit-tools/supabase-pg.js');
const PG = createPgHarness({ depsDirs: [ROOT + '/supabase/node_modules'], shimDir: ROOT + '/tools/audit-tools/supabase-shim', wantMajor: 17 });
const secret = randomBytes(32);
let c: any, tenant: string, actor: any, other: any, serial = 0, exportDdlBefore: string;
const baseline = new Map<string, any>();
const definitions = () => c.query("select proname,prosrc,proacl::text,proconfig,prosecdef,provolatile,pg_get_userbyid(proowner) as owner from pg_proc where (pronamespace='private'::regnamespace and proname in ('zoe_apply_engine_v1','zoe_snap_val','zoe_eval')) or (pronamespace='public'::regnamespace and proname='zoe_admin_export')");
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
// ចម្លង bytes ដើមពី cb8fc35d7c4cbe6bcc7208cda6f0d8f742ebcbf7:tools/firebase-backup/supabase.js។
// Git blob a3ffa20d9b6c81ac9813777ac8bb046880122efd; CI shallow មិនត្រូវការប្រវត្តិ Git។
const OLD_SUPABASE_CLI = {
    path: 'tools/audit-tools/fixtures/supabase-backup-before-restore-guards.source',
    sha256: 'e40e247f08afb75ff0ebec9ba17a4b62629287b31a9c6bafef8540e23e2bc208'
};
const TRASH = 'zoew_recently_deleted_cod_dod';
const source = (id: string) => ({ id, phone: '012000000', createdAt: Date.now() - 10000, deletedAt: Date.now() - 1000,
    trashMode: 'cookie', trashReason: 'remove', isFromDeletion: false, isClosed: false, scanDate: '2026-11-14',
    cod: 7, dod: 2, price: 9, count: 1, barcodes: [{ code: 'PROTO_' + id, cod: 7, dod: 2, isDeducted: true, createdAt: Date.now() - 10000 }] });
const seed = async (updates: any) => {
    const result = await PG.as(c, { role: 'service_role' }, 'select public.zoe_admin_write($1,$2,$3::jsonb) as r', [tenant,
        'protocol_seed_' + String(++serial).padStart(12, '0'), JSON.stringify(Object.entries(updates).map(([p, v]) => ({ k: 'set', p: p.split('/'), v })))]);
    expect(result.error).toBeUndefined();
};
const read = async (id: string) => (await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, TRASH, id])).rows[0]?.value;
const context = async (id: string, token = 'stable:legacy/token_' + id, target = 'target_' + id) => {
    const result = await PG.as(c, actor, 'select public.zoe_restore_context_v1($1,$2,$3,$4) as r', [id, token, target, 0]);
    expect(result.error).toBeUndefined();
    return result.rows[0].r;
};
const envelope = (ctx: any, id: string, verdict = 'allow', action = 'authorize') => ({ v: 1, kid: 'protocol-v1', action,
    tenantId: tenant, actorUid: actor.sub, sessionId: actor.extra.session_id, scope: ctx.scope, branch: ctx.branch,
    sourceId: id, token: 'stable:legacy/token_' + id, targetId: 'target_' + id, attestationId: ctx.source.restoreAttestationId || randomBytes(24).toString('hex'),
    mode: ctx.source.trashMode, policyEpoch: ctx.policy.epoch, expectedRevision: ctx.expectedRevision, expectedSource: ctx.source,
    verdict, issuedAt: ctx.now, expiresAt: ctx.now + 120000 });
const apply = async (value: any, signature?: string, who = actor) => {
    const raw = JSON.stringify(value);
    return PG.as(c, who, 'select public.zoe_restore_attest_v1($1,$2) as r', [raw, signature || createHmac('sha256', secret).update(raw).digest('hex')]);
};
const proof = async (id: string) => (await c.query('select revision,body,payload_hash from private.zoe_restore_attestations where tenant_id=$1 and source_id=$2', [tenant, id])).rows[0];

beforeAll(async () => {
    if (PG.unavailableReason()) throw new Error(PG.unavailableReason());
    await PG.start(); c = (await PG.freshDb('default-grants')).c;
    await c.query('create schema private;alter default privileges for role postgres in schema private grant all on tables to anon,authenticated,service_role;alter default privileges for role postgres in schema private grant execute on functions to public,anon,authenticated,service_role');
    for (const file of fs.readdirSync(ROOT + '/supabase/migrations').filter(n => n.endsWith('.sql')).sort()) {
        if (file === '20261114145911_zoe_restore_attestation.sql') {
            for (const row of (await definitions()).rows) baseline.set(row.proname, row);
            exportDdlBefore = (await c.query("select pg_get_functiondef('public.zoe_admin_export(uuid,bigint,text,text,bigint,integer,integer)'::regprocedure) ddl")).rows[0].ddl;
        }
        await c.query(fs.readFileSync(ROOT + '/supabase/migrations/' + file, 'utf8'));
    }
    if (process.env.ZTOATTEST_EXPORT_MUTATION === 'remove_guard') await c.query(exportDdlBefore);
    tenant = (await c.query("insert into public.tenants(name,branch_code,expires_at) values('protocol-fixture','PROTO01',now()+interval '1 day') returning id")).rows[0].id;
    for (const name of ['owner', 'peer']) {
        const uid = await PG.makeAuthUser(c, 'protocol-' + name + '@users.zoew.invalid');
        await c.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [uid, tenant, 'protocol_' + name]);
        const who = await PG.sessionClaims(c, { role: 'authenticated', sub: uid, extra: { exp: Math.floor(Date.now() / 1000) + 3600 } });
        if (name === 'owner') actor = who; else other = who;
    }
    await c.query('insert into private.zoe_restore_attestor_keys(kid,secret) values($1,$2)', ['protocol-v1', secret]);
    await seed({ 'zoew_restore_policy/shop': { v: 1, mode: 'cookie', branch: 'PROTO01', scope: 'https://protocol.invalid#' + tenant, epoch: 1 } });
}, 30000);
afterAll(async () => { if (c) await c.end(); await PG.stop(); });

it('ordinary service export refuses unsealed sticky denial and no archive publication follows; completed source-absent state remains exportable', async () => {
    const id = 'unsealed_returned_backup'; await seed({ [TRASH + '/' + id]: source(id) });
    const denied = await apply(envelope(await context(id), id, 'returned'));
    expect(denied.error).toBeUndefined(); expect((await read(id)).restoreAttestationId).toBeUndefined();
    expect((await proof(id)).body).toMatchObject({ status: 'deny', verdict: 'returned' });
    expect((await c.query('select count(*)::int n from private.zoe_restore_attestations where tenant_id=$1', [tenant])).rows[0].n).toBe(1);
    const ordinary = await PG.as(c, { role: 'service_role' }, 'select public.zoe_admin_export($1) r', [tenant]);
    expect(ordinary.error?.code).toBe('55000'); expect(ordinary.error?.message).toBe('private-restore-state-requires-database-backup');
    const oldCode = fs.readFileSync(path.join(ROOT, OLD_SUPABASE_CLI.path), 'utf8');
    expect(hash(oldCode)).toBe(OLD_SUPABASE_CLI.sha256);
    const oldModule = new (Module as any)(ROOT + '/tools/firebase-backup/supabase.js');
    oldModule.filename = ROOT + '/tools/firebase-backup/supabase.js'; oldModule.paths = (Module as any)._nodeModulePaths(ROOT + '/tools/firebase-backup');
    oldModule._compile(oldCode, oldModule.filename);
    let published = false;
    await expect((async () => {
        const exported = await oldModule.exports.exportTenant({ rpc: async (name: string, params: any) => {
            expect(name).toBe('zoe_admin_export'); expect(params.p_tenant).toBe(tenant);
            const reply = await PG.as(c, { role: 'service_role' }, 'select public.zoe_admin_export($1) r', [tenant]);
            if (reply.error) throw new Error(reply.error.message); return reply.rows[0].r;
        } }, tenant);
        oldModule.exports.buildArchive({ id: tenant }, exported, 'protocol.invalid'); published = true;
    })()).rejects.toThrow('private-restore-state-requires-database-backup');
    expect(published).toBe(false);
    const completed = (await c.query("insert into public.tenants(name,branch_code,expires_at) values('completed-export','EXPORT01',now()+interval '1 day') returning id")).rows[0].id;
    await c.query('insert into private.zoe_restore_attestations(tenant_id,source_id,revision,body,snapshot,payload_hash) select $1,source_id,revision,body,snapshot,payload_hash from private.zoe_restore_attestations where tenant_id=$2 and source_id=$3', [completed, tenant, id]);
    const exported = await PG.as(c, { role: 'service_role' }, 'select public.zoe_admin_export($1) r', [completed]);
    expect(exported.error).toBeUndefined(); expect(exported.rows[0].r).toMatchObject({ tenant: completed, rows: [], more: false });
});

it('actual context and HMAC apply bind the owned session and exact full source, with one idempotent freeze', async () => {
    const id = 'owned_freeze'; await seed({ [TRASH + '/' + id]: source(id) });
    const ctx = await context(id);
    expect(ctx).toMatchObject({ actorUid: actor.sub, sessionId: actor.extra.session_id, tenantId: tenant, branch: 'PROTO01', expectedRevision: 0 });
    expect(ctx.sessionCreatedAt).toBeGreaterThan(0); expect(ctx.sessionExpiresAt).toBeGreaterThan(ctx.now);
    const signed = envelope(ctx, id);
    expect((await apply(signed, '0'.repeat(64))).error?.code).toBe('42501');
    expect((await read(id)).restoreAttestationId).toBeUndefined();
    const result = await apply(signed);
    expect(result.error).toBeUndefined(); expect(result.rows[0].r.kind).toBe('allow');
    const stored = await read(id); const grant = await proof(id);
    expect(stored.restoreAttestationId).toBe(signed.attestationId);
    expect(stored.restoreClaim).toMatchObject({ token: signed.token, targetId: signed.targetId });
    expect(grant.body).toMatchObject({ id: signed.attestationId, actorUid: actor.sub, sessionId: actor.extra.session_id, generation: 0, status: 'allow' });
    expect(grant.body.codes).toEqual({ ['PROTO_' + id]: true });
    const replay = await apply(signed);
    expect(replay.error).toBeUndefined(); expect(replay.rows[0].r.source).toEqual(stored);
    expect((await proof(id)).revision).toBe(grant.revision);
    expect((await c.query('select count(*)::int n from private.zoe_restore_attestation_events where tenant_id=$1 and source_id=$2', [tenant, id])).rows[0].n).toBe(1);
});

it('another authenticated actor cannot apply the original signed authority', async () => {
    const id = 'wrong_actor'; await seed({ [TRASH + '/' + id]: source(id) }); const ctx = await context(id);
    expect((await apply(envelope(ctx, id), undefined, other)).error?.code).toBe('22023');
    expect((await read(id)).restoreAttestationId).toBeUndefined(); expect(await proof(id)).toBeUndefined();
});

it('a source mutation after upstream snapshot invalidates even a correctly signed packet', async () => {
    const id = 'source_changed'; await seed({ [TRASH + '/' + id]: source(id) }); const ctx = await context(id); const signed = envelope(ctx, id);
    await seed({ [TRASH + '/' + id + '/barcodes/0/code']: 'PROTO_DIFFERENT' });
    expect((await apply(signed)).error?.code).toBe('PT409'); expect(await proof(id)).toBeUndefined();
});

it('HOLD revokes old allow and sticky terminal denial cannot be overwritten by later unsigned or stale packets', async () => {
    const id = 'status_order'; await seed({ [TRASH + '/' + id]: source(id) });
    const initial = envelope(await context(id), id); expect((await apply(initial)).error).toBeUndefined();
    const hold = envelope(await context(id), id, 'unconfirmed', 'refresh');
    expect((await apply(hold)).rows[0].r.kind).toBe('hold'); expect((await proof(id)).body.status).toBe('hold');
    expect((await apply(initial)).error?.code).toBe('PT409');
    const allow = envelope(await context(id), id, 'allow', 'refresh'); expect((await apply(allow)).rows[0].r.kind).toBe('allow');
    const terminal = envelope(await context(id), id, 'signed', 'refresh'); expect((await apply(terminal)).rows[0].r.kind).toBe('deny');
    expect((await read(id)).restoreBlocked).toBe(true);
    const stale = envelope(await context(id), id, 'allow', 'refresh');
    expect((await apply(stale)).rows[0].r.kind).toBe('deny'); expect((await proof(id)).body.verdict).toBe('signed');
});

it('private signing keys, full snapshots and issuer events are inaccessible to all app/service roles', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) for (const table of ['zoe_restore_attestor_keys', 'zoe_restore_attestations', 'zoe_restore_attestation_events']) {
        const who = role === 'authenticated' ? actor : { role };
        expect((await PG.as(c, who, 'select * from private.' + table)).error?.code).toBe('42501');
    }
});

it('only the exact immutable consumption proves completion after ACK garbage collection and a new owned session', async () => {
    const id = 'committed_receipt'; const token = 'stable:legacy/token_' + id; const target = 'target_' + id;
    const policy = { v: 1, mode: 'cookie', branch: 'PROTO01', scope: 'https://protocol.invalid#' + tenant, epoch: 1 };
    const receipt = { v: 1, sourceId: id, generation: 2, kind: 'restore', actorUid: actor.sub, scope: policy.scope,
        deletedAt: Date.now() - 1000, rowBirth: Date.now() - 10000, token, targetId: target };
    const install = async (value: any) => {
        await seed({ 'zoew_restore_policy/shop': { ...policy, mode: 'local', branch: '' } });
        await seed({ ['zoew_trash_consumptions/' + id]: value });
        await seed({ 'zoew_restore_policy/shop': policy });
    };
    const request = (generation: number) => PG.as(c, actor, 'select public.zoe_restore_context_v1($1,$2,$3,$4) as r', [id, token, target, generation]);
    await install(receipt);
    const oldActor = actor;
    actor = await PG.sessionClaims(c, { role: 'authenticated', sub: actor.sub, extra: { exp: Math.floor(Date.now() / 1000) + 3600 } });
    expect((await request(2)).rows[0].r.kind).toBe('already_applied');
    expect((await request(1)).error?.code).toBe('PT409');
    for (const patch of [{ scope: 'foreign-scope' }, { sourceId: 'other_source' }, { v: 2 }, { kind: 'purge' }, { actorUid: other.sub }, { targetId: 'foreign_target' }, { rowBirth: -1 }]) {
        await install({ ...receipt, ...patch });
        expect((await request(2)).error?.code).toBe('PT409');
    }
    await install(receipt);
    await seed({ ['zoew_restore_finalizations/' + id]: { token: 'foreign', targetId: target, finalizedAt: Date.now() } });
    expect((await request(2)).error?.code).toBe('PT409');
    await seed({ ['zoew_restore_finalizations/' + id]: { token, targetId: target, finalizedAt: Date.now() } });
    expect((await request(2)).rows[0].r.kind).toBe('already_applied');
    await seed({ ['zoew_restore_finalizations/' + id]: null });
    expect((await request(2)).rows[0].r.kind).toBe('already_applied');
    actor = oldActor;
});

it('the issuer accepts absent or compatible targets and preserves incompatible or foreign prepared targets exactly', async () => {
    const id = 'target_binding'; const original = source(id); const targetId = 'target_' + id;
    const oldTarget = { id: targetId, phone: original.phone, scanDate: original.scanDate, createdAt: original.createdAt,
        isClosed: false, count: 1, barcodes: [{ code: 'EXISTING_OLD', cod: 1, dod: 0 }] };
    await seed({ [TRASH + '/' + id]: original });
    expect((await context(id)).target).toBeNull();
    for (const patch of [{ id: 'unrelated' }, { phone: '099999999' }, { scanDate: '2020-01-01' }, { isClosed: true },
        { clearClaim: { token: 'busy' } }, { restoreClaimId: 'foreign_source', restoreClaimToken: 'foreign' },
        { restoreClaimToken: 'foreign' }, { restoreAddedCodes: '["foreign"]' }]) {
        const badTarget = { ...oldTarget, ...patch };
        await seed({ 'zoew_restore_policy/shop': { v: 1, mode: 'local', scope: 'https://protocol.invalid#' + tenant, branch: '', epoch: 1 } });
        await seed({ ['zoew_scan_history_cod_dod/' + targetId]: badTarget });
        await seed({ 'zoew_restore_policy/shop': { v: 1, mode: 'cookie', scope: 'https://protocol.invalid#' + tenant, branch: 'PROTO01', epoch: 1 } });
        const persistedTarget = (await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, 'zoew_scan_history_cod_dod', targetId])).rows[0].value;
        const denied = await PG.as(c, actor, 'select public.zoe_restore_context_v1($1,$2,$3,$4) as r', [id, 'stable:legacy/token_' + id, targetId, 0]);
        expect(denied.error?.code).toBe('PT409');
        expect((await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, 'zoew_scan_history_cod_dod', targetId])).rows[0].value).toEqual(persistedTarget);
        expect(await proof(id)).toBeUndefined();
    }
    await seed({ ['zoew_scan_history_cod_dod/' + targetId]: oldTarget });
    const persistedCompatible = (await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, 'zoew_scan_history_cod_dod', targetId])).rows[0].value;
    const result = await apply(envelope(await context(id), id));
    expect(result.error).toBeUndefined();
    expect((await proof(id)).body.allowedTargetSlots).toEqual({ '0': 'EXISTING_OLD', '1': 'PROTO_' + id });
    expect((await proof(id)).body.codes).toEqual({ ['PROTO_' + id]: true });
    expect((await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, 'zoew_scan_history_cod_dod', targetId])).rows[0].value).toEqual(persistedCompatible);
});

it('the first-effect deferred check uses real commit time and rolls back source, authority and audit together on expiry', async () => {
    const id = 'expire_at_commit'; await seed({ [TRASH + '/' + id]: source(id) });
    const packet = envelope(await context(id), id); packet.expiresAt = packet.issuedAt + 1000;
    const raw = JSON.stringify(packet), signature = createHmac('sha256', secret).update(raw).digest('hex');
    const before = await read(id);
    const result = await PG.as(c, actor, `with applied as materialized(select public.zoe_restore_attest_v1($1,$2) as r)
        select r,pg_sleep(greatest(0,($3::numeric-private.zoe_now_ms())/1000)+0.03) from applied`, [raw, signature, packet.expiresAt]);
    expect(result.error?.code).toBe('42501');
    expect(result.error?.message).toBe('restore-attestation-expired-or-unowned');
    expect(await read(id)).toEqual(before); expect(await proof(id)).toBeUndefined();
    expect((await c.query('select count(*)::int n from private.zoe_restore_attestation_events where tenant_id=$1 and source_id=$2', [tenant, id])).rows[0].n).toBe(0);
    expect((await c.query('select count(*)::int n from public.zoe_business_audit where tenant_id=$1 and record_key=$2', [tenant, id])).rows[0].n).toBe(1);
});

it('preserves the existing engine/evaluator/snapshot bodies and metadata outside the four exact reviewed hooks', async () => {
    const additions: Record<string, string> = {
        zoe_admin_export: "    if exists (\n        select 1 from public.zoe_docs d\n        join private.zoe_restore_attestations a on a.tenant_id=d.tenant_id and a.source_id=d.key\n        where d.tenant_id=p_tenant and d.root='zoew_recently_deleted_cod_dod' and d.value is not null\n            and a.body->'generation'=coalesce(d.value->'trashGeneration','0'::jsonb)\n    ) then raise exception 'private-restore-state-requires-database-backup' using errcode='55000';end if;\n",
        zoe_apply_engine_v1: "        ctx := private.zoe_restore_rules_cache_v1(ctx) || jsonb_build_object('now',private.zoe_now_ms());\n",
        zoe_eval: "    when 'auth_claim' then\n        if p_expr->>'n' not in ('session_id','auth_time') then return 'null'::jsonb;end if;\n        return coalesce(auth.jwt()->(p_expr->>'n'),'null'::jsonb);\n",
        zoe_snap_val: "    if snap_path[1]='zoew_restore_attestations' then\n        doc:=coalesce(p_ctx->'restoreAuthorities','{}'::jsonb);\n        if depth=1 then return doc;end if;\n        return coalesce(doc#>snap_path[2:depth],'null'::jsonb);\n    end if;\n"
    };
    for (const row of (await definitions()).rows) {
        const old = baseline.get(row.proname); expect(old).toBeDefined();
        expect(row.prosrc.split(additions[row.proname])).toHaveLength(2);
        expect(hash(row.prosrc.replace(additions[row.proname], ''))).toBe(hash(old.prosrc));
        const metadata = ({ prosrc: _source, ...rest }: any) => rest;
        expect(metadata(row)).toEqual(metadata(old));
    }
    expect(baseline.size).toBe(4);
});

it('an absent legacy source id is canonicalized only by trusted freeze while conflicting ids are rejected', async () => {
    const id = 'legacy_missing_id', raw: any = source(id); delete raw.id;
    await seed({ [TRASH + '/' + id]: raw });
    await seed({ ['zoew_scan_history_cod_dod/target_' + id]: { phone: raw.phone, scanDate: raw.scanDate, isClosed: false, barcodes: { '3': { code: 'NEIGHBOR_OLD', cod: 1, dod: 0 } } } });
    const ctx = await context(id); expect(ctx.source.id).toBeUndefined();
    expect(ctx.target.id).toBeUndefined();
    const signed = envelope(ctx, id); expect((await apply(signed)).rows[0].r.source.id).toBe(id);
    expect((await read(id)).id).toBe(id);
    const badId = 'legacy_conflicting_id'; await seed({ [TRASH + '/' + badId]: { ...source(badId), id: 'another_record' } });
    const denied = await PG.as(c, actor, 'select public.zoe_restore_context_v1($1,$2,$3,$4) as r', [badId, 'token', 'target', 0]);
    expect(denied.error?.code).toBe('PT409'); expect(await proof(badId)).toBeUndefined();
});

it('a client transaction started before expiry cannot pass the grant after waiting past expiry on the tenant lock', async () => {
    const id = 'lock_then_expire'; await seed({ [TRASH + '/' + id]: source(id) });
    const packet = envelope(await context(id), id); packet.expiresAt = packet.issuedAt + 1000;
    expect((await apply(packet)).error).toBeUndefined();
    const frozen = await read(id), prepared: any = { ...frozen, id: packet.targetId,
        barcodes: { '0': { ...frozen.barcodes['0'], isDeducted: false } }, restoreClaimId: id, restoreClaimToken: packet.token };
    delete prepared.restoreClaim; delete prepared.restoreAttestationId; delete prepared.deletedAt;
    delete prepared.trashReason; delete prepared.trashMode;
    const blocker = await PG.connect('postgres', c.connectionParameters.database);
    let pending: Promise<any> | undefined;
    try {
        const blockedPid = (await c.query('select pg_backend_pid() pid')).rows[0].pid;
        await blocker.query('begin'); await blocker.query('select 1 from public.zoe_tenant_state where tenant_id=$1 for update', [tenant]);
        pending = PG.as(c, actor, 'select public.zoe_write_v2($1,$2,$3::jsonb) r', [tenant, 'lock_expire_prepared_0001',
            JSON.stringify([{ k: 'set', p: ['zoew_scan_history_cod_dod', packet.targetId], v: prepared }])]);
        let waiting = false;
        for (let i = 0; i < 100; i++) {
            if ((await blocker.query('select cardinality(pg_blocking_pids($1))>0 waiting', [blockedPid])).rows[0].waiting) { waiting = true; break; }
            await new Promise(resolve => setTimeout(resolve, 1));
        }
        expect(waiting).toBe(true);
        expect((await blocker.query('select private.zoe_now_ms()<$1 before_expiry', [packet.expiresAt])).rows[0].before_expiry).toBe(true);
        await blocker.query('select pg_sleep(greatest(0,($1::numeric-private.zoe_now_ms())/1000)+0.03)', [packet.expiresAt]);
        await blocker.query('commit');
        const denied = await pending; pending = undefined;
        expect(denied.error?.code).toBe('42501'); expect(denied.error?.message).toBe('permission_denied');
        expect((await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, 'zoew_scan_history_cod_dod', packet.targetId])).rows).toEqual([]);
        expect(await read(id)).toEqual(frozen);
    } finally { await blocker.query('rollback'); if (pending) await pending; await blocker.end(); }
});

it('a terminal observation from a concurrent pre-freeze context invalidates a later installed allow in the same source generation', async () => {
    const id = 'terminal_after_freeze'; await seed({ [TRASH + '/' + id]: source(id) });
    const observed = await context(id);
    const allowing = envelope(observed, id), terminal = envelope(observed, id, 'signed');
    expect((await apply(allowing)).error).toBeUndefined();
    const denied = await apply(terminal);
    expect(denied.error).toBeUndefined();
    expect((await proof(id)).body.status).toBe('deny');
    expect((await read(id)).restoreBlocked).toBe(true);
});

it('a foreign observer terminal packet preserves the current owner operation and signed dominates returned', async () => {
    const id = 'foreign_terminal_observer'; await seed({ [TRASH + '/' + id]: source(id) });
    const snapshot = await context(id), allow = envelope(snapshot, id);
    const returning = { ...envelope(snapshot, id, 'returned'), actorUid: other.sub, sessionId: other.extra.session_id,
        token: 'different_observer_token', targetId: 'different_observer_target' };
    expect((await apply(allow)).error).toBeUndefined();
    expect((await apply(returning, undefined, other)).error).toBeUndefined();
    let body = (await proof(id)).body;
    expect(body).toMatchObject({ status: 'deny', verdict: 'returned', id: allow.attestationId, token: allow.token,
        targetId: allow.targetId, actorUid: actor.sub, sessionId: actor.extra.session_id });
    expect((await read(id)).restoreBlocked).toBeUndefined();
    expect((await c.query('select actor_uid from private.zoe_restore_attestation_events where tenant_id=$1 and source_id=$2 order by revision desc limit 1', [tenant, id])).rows[0].actor_uid).toBe(other.sub);
    const stale = envelope(await context(id), id, 'allow', 'refresh');
    expect((await apply(stale)).rows[0].r.kind).toBe('deny');
    const signing = { ...returning, verdict: 'signed' };
    expect((await apply(signing, undefined, other)).error).toBeUndefined();
    body = (await proof(id)).body;
    expect(body).toMatchObject({ status: 'deny', verdict: 'signed', id: allow.attestationId, actorUid: actor.sub, token: allow.token });
    expect((await read(id)).restoreBlocked).toBe(true);
    const lateReturn = envelope(await context(id), id, 'returned', 'refresh');
    expect((await apply(lateReturn)).rows[0].r.code).toBe('ZTO_RESTORE_TERMINAL_SIGNED');
});

it('a terminal packet cannot rebase over a changed business/code snapshot', async () => {
    const id = 'terminal_business_changed'; await seed({ [TRASH + '/' + id]: source(id) });
    const old = envelope(await context(id), id, 'signed');
    await seed({ [TRASH + '/' + id + '/barcodes/0/code']: 'OTHER_BUSINESS_BARCODE' });
    expect((await apply(envelope(await context(id), id))).error).toBeUndefined();
    expect((await apply(old)).error?.code).toBe('PT409');
    expect((await proof(id)).body.status).toBe('allow');
});


it('trusted policy misconfiguration fails closed at both epoch bounds and the largest supported epoch still authorizes', async () => {
    const id = 'epoch_bounds'; await seed({ [TRASH + '/' + id]: source(id) });
    const policy = { v: 1, mode: 'cookie', scope: 'https://protocol.invalid#' + tenant, branch: 'PROTO01', epoch: 1 };
    for (const epoch of [0, -1, 0.5, 9007199254740991]) {
        await seed({ 'zoew_restore_policy/shop': { ...policy, epoch } });
        const result = await PG.as(c, actor, 'select public.zoe_restore_context_v1($1,$2,$3,$4) r', [id, 'stable:legacy/token_' + id, 'target_' + id, 0]);
        expect(result.error?.code).toBe('PT409'); expect(await proof(id)).toBeUndefined();
    }
    await seed({ 'zoew_restore_policy/shop': { ...policy, epoch: 9007199254740990 } });
    expect((await apply(envelope(await context(id), id))).error).toBeUndefined();
    expect((await proof(id)).body.policyEpoch).toBe(9007199254740990);
    await seed({ 'zoew_restore_policy/shop': policy });
});
