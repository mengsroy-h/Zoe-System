import { afterAll, beforeAll, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { webcrypto } from 'node:crypto';
import { pickupResetAttemptId } from '../../../../ZoeW/src/domain/pickup-reset-proof';

const ROOT = path.resolve(__dirname, '../../../..');
const require = createRequire(import.meta.url);
const { createPgHarness } = require(ROOT + '/tools/audit-tools/supabase-pg.js');
const PG = createPgHarness({ depsDirs: [ROOT + '/supabase/node_modules'], shimDir: ROOT + '/tools/audit-tools/supabase-shim', wantMajor: 17 });
const HIST = 'zoew_scan_history_cod_dod', TRASH = 'zoew_recently_deleted_cod_dod';
let engineBefore:any,engineAfter:any,hostedBaseline:any=null;
const performanceEvidence:any[]=[];
const engineMetadata=async()=> (await c.query("select pg_get_functiondef(p.oid) as definition,pg_get_userbyid(p.proowner) as owner,p.proacl::text as acl,p.prosecdef,p.proconfig,p.provolatile from pg_proc p where p.oid='private.zoe_apply_engine_v1(uuid,text,jsonb,boolean,boolean,jsonb)'::regprocedure")).rows[0];
let c: any, tenant: string, otherTenant: string, who: any, other: any, serial = 0;
const events = async (operation: string) => (await c.query('select * from public.zoe_business_audit where tenant_id=$1 and operation_id=$2 order by root,record_key,event_id', [tenant, operation])).rows;
const packet = (updates: any) => Object.entries(updates).map(([p, v]) => ({ k: 'set', p: p.split('/'), v }));
const write = (updates: any, operation = 'business_audit_' + String(++serial).padStart(12, '0')) => PG.as(c, who,
    'select public.zoe_write_v2($1,$2,$3::jsonb) as r', [tenant, operation, JSON.stringify(packet(updates))]);
const admin = (updates: any, operation = 'business_admin_' + String(++serial).padStart(12, '0')) => PG.as(c, { role: 'service_role' },
    'select public.zoe_admin_write($1,$2,$3::jsonb) as r', [tenant, operation, JSON.stringify(packet(updates))]);
const item = (id: string, extra: any = {}) => ({ id, phone: '012000000', createdAt: 1790000000000, scanDate: '2026-11-14',
    cod: 3, dod: 1, price: 4, count: 1, isClosed: false,
    barcodes: [{ code: 'AUDIT_' + id, cod: 3, dod: 1, createdAt: 1790000000000, isClosed: false }], ...extra });

beforeAll(async () => {
    if (PG.unavailableReason()) throw new Error(PG.unavailableReason());
    await PG.start(); c = (await PG.freshDb(process.env.SB_AUDIT_SEQUENCE_DEFAULT_GRANTS==='1'?'default-grants':'no-default-grants')).c;
    if(process.env.SB_AUDIT_SEQUENCE_DEFAULT_GRANTS==='1')await c.query('alter default privileges for role postgres in schema public grant all on sequences to anon,authenticated,service_role;alter default privileges for role postgres in schema public grant all on tables to anon,authenticated,service_role;alter default privileges for role postgres in schema public grant execute on functions to public,anon,authenticated,service_role');
    for (const file of fs.readdirSync(ROOT + '/supabase/migrations').filter(n => n.endsWith('.sql')).sort()) {
        if(file==='20261114042758_zoe_business_audit.sql')engineBefore=await engineMetadata();
        await c.query(fs.readFileSync(ROOT + '/supabase/migrations/' + file, 'utf8'));
        if(file==='20261114042758_zoe_business_audit.sql')engineAfter=await engineMetadata();
    }
    if(process.env.SB_AUDIT_HOSTED_BASELINE){const saved=JSON.parse(fs.readFileSync(process.env.SB_AUDIT_HOSTED_BASELINE,'utf8'));expect(saved.project_id).toBe('igqmfpmhrkvclzjafdov');expect(saved.backup.audit_table_absent).toBe(true);hostedBaseline=saved.backup.engine;expect(engineBefore.definition).toBe(hostedBaseline.definition);expect({owner:engineBefore.owner,acl:engineBefore.acl,config:engineBefore.proconfig,volatility:engineBefore.provolatile,security_definer:engineBefore.prosecdef}).toEqual(Object.fromEntries(Object.entries(hostedBaseline).filter(([key])=>key!=='definition')));}
    if(process.env.SB_AUDIT_MUTATION==='disable_trigger')await c.query('alter table public.zoe_docs disable trigger zoe_business_audit_capture');
    const tenants = (await c.query("insert into public.tenants(name,branch_code,expires_at) values('audit-one','AUDIT01',now()+interval '1 day'),('audit-two','AUDIT02',now()+interval '1 day') returning id")).rows;
    tenant = tenants[0].id; otherTenant = tenants[1].id;
    await c.query('alter table auth.sessions add column if not exists not_after timestamptz');
    for (const [branch, name] of [[tenant, 'one'], [otherTenant, 'two']]) {
        const uid = await PG.makeAuthUser(c, 'business-audit-' + name + '@users.zoew.invalid');
        await c.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [uid, branch, 'audit_' + name]);
        const actor = await PG.sessionClaims(c, { role: 'authenticated', sub: uid });
        if (name === 'one') who = actor; else other = actor;
    }
}, 30000);
afterAll(async () => { if(process.env.SB_AUDIT_EVIDENCE_FILE)fs.writeFileSync(process.env.SB_AUDIT_EVIDENCE_FILE,JSON.stringify({postgres:PG.pgBin?.version,performance:performanceEvidence,limits:['Local actual PostgreSQL; JWT/Auth claims simulated, no hosted or ZTO calls.','Projection is bounded selected business state, not a full payload archive or independent upstream attestation.']},null,2)+'\n');if (c) await c.end(); PG.stop(); });

it('a real committed business mutation has a dedicated durable server audit, independent of replay receipts', async () => {
    const result = await write({ [HIST + '/initial']: item('initial') }, 'business_audit_initial');
    expect(result.error).toBeUndefined(); expect(result.rows[0].r.ok).toBe(true);
    expect((await c.query("select to_regclass('public.zoe_business_audit') as audit")).rows[0].audit).toBe('zoe_business_audit');
    const rows = await events('business_audit_initial');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tenant_id: tenant, actor_uid: who.sub, actor_kind: 'user', operation_id: 'business_audit_initial', root: HIST, record_key: 'initial', action: 'create', status_source: 'stored_business_state' });
});

it('exact operation replay and concurrent devices produce one business effect and one audit event', async () => {
    const operation = 'business_audit_same_operation', updates = { [HIST + '/replay']: item('replay') };
    const first = await write(updates, operation), again = await write(updates, operation);
    expect(first.error).toBeUndefined(); expect(again.error).toBeUndefined(); expect(again.rows[0].r.replayed).toBe(true);
    expect(await events(operation)).toHaveLength(1);
    const before = (await c.query('select count(*)::int as n from public.zoe_business_audit where tenant_id=$1', [tenant])).rows[0].n;
    expect((await write(updates)).error).toBeUndefined();
    expect((await c.query('select count(*)::int as n from public.zoe_business_audit where tenant_id=$1', [tenant])).rows[0].n).toBe(before);
    const dbName = c.connectionParameters.database, peers = await Promise.all([PG.connect('postgres', dbName), PG.connect('postgres', dbName), PG.connect('postgres', dbName)]);
    try {
        const outcomes = await Promise.all(peers.map(peer => PG.as(peer, who, 'select public.zoe_write_v2($1,$2,$3::jsonb) as r', [tenant, 'business_audit_three_devices', JSON.stringify(packet({ [HIST + '/concurrent']: item('concurrent') }))])));
        expect(outcomes.every(outcome => !outcome.error && outcome.rows[0].r.ok)).toBe(true);
        expect(outcomes.filter(outcome => outcome.rows[0].r.replayed)).toHaveLength(2);
        expect(await events('business_audit_three_devices')).toHaveLength(1);
    } finally { await Promise.all(peers.map(peer => peer.end())); }
});

it.each(['delete', 'remove', 'pickup', 'returned'])('trash %s records the real before/after state and reason without equating pickup/closed to ZTO Sign', async reason => {
    const id = 'trash_' + reason, source: any = item(id, { trashReason: reason, trashMode: reason === 'pickup' ? 'palm' : 'cookie', deletedAt: 1790000001000, isFromDeletion: reason === 'delete' || reason === 'pickup', restoreBlocked: reason === 'pickup' });
    const operation = 'business_audit_trash_' + reason;
    expect((await write({ [TRASH + '/' + id]: source }, operation)).error).toBeUndefined();
    const [event] = await events(operation);
    expect(event).toMatchObject({ actor_uid: who.sub, reason, origin: 'app_engine', tenant_id: tenant, record_key: id });
    expect(event.previous_status).toEqual({ exists: false, location: 'absent' });
    expect(event.new_status).toMatchObject({ exists: true, location: 'trash', trashReason: reason, observedSignedCount: 0 });
    expect(event.after_value.barcodes.sample[0].code).toBe('AUDIT_' + id);
    expect(event.action).not.toBe('observed_zto_sign');
    expect(event.committed_at).toBeInstanceOf(Date);
});

it('real restore finalization keeps the original trash reason and explicit absent/live statuses in a permanent same-operation audit group', async () => {
    const source: any = item('restore_source', { trashReason: 'remove', trashMode: 'cookie', deletedAt: 1790000001000, isFromDeletion: false });
    source.barcodes[0].isDeducted = true;
    const claim = { token: 'token_business_audit_restore', targetId: 'restore_target', claimedAt: 1790000002000 };
    expect((await write({ [TRASH + '/' + source.id]: source })).error).toBeUndefined();
    expect((await write({ [TRASH + '/' + source.id + '/restoreClaim']: claim })).error).toBeUndefined();
    const prepared: any = { ...item(claim.targetId), barcodes: [{ ...source.barcodes[0], isDeducted: false }], restoreClaimId: source.id, restoreClaimToken: claim.token };
    expect((await write({ [HIST + '/' + claim.targetId]: prepared })).error).toBeUndefined();
    const live = { ...prepared }; delete live.restoreClaimId; delete live.restoreClaimToken;
    const updates = { [TRASH + '/' + source.id]: null, [HIST + '/' + claim.targetId]: live,
        ['zoew_restore_finalizations/' + source.id]: { token: claim.token, targetId: claim.targetId, finalizedAt: 1790000003000 },
        ['zoew_trash_consumptions/' + source.id]: { v: 1, sourceId: source.id, generation: 0, kind: 'restore', actorUid: who.sub, scope: 'audit-test', deletedAt: source.deletedAt, rowBirth: source.createdAt, token: claim.token, targetId: claim.targetId },
        'zoew_daily_revenue_cod_dod/2026-11-14': { codDollar: 3, dodDollar: 1, totalCount: 1 } };
    expect((await write(updates, 'business_audit_restore_final')).error).toBeUndefined();
    const rows = await events('business_audit_restore_final');
    expect(rows).toHaveLength(5); expect(rows.every(row => row.actor_uid === who.sub && row.operation_id === 'business_audit_restore_final')).toBe(true);
    const removed = rows.find(row => row.root === TRASH), consumed = rows.find(row => row.root === 'zoew_trash_consumptions');
    expect(removed.previous_status).toMatchObject({ location: 'trash', trashReason: 'remove', trashMode: 'cookie', deductedCount: 1 });
    expect(removed.new_status).toEqual({ exists: false, location: 'absent' });
    expect(consumed.action).toBe('restore'); expect(consumed.after_value).toMatchObject({ sourceId: source.id, targetId: claim.targetId, kind: 'restore', generation: 0 });
    expect(rows.find(row => row.root === HIST).action).toBe('update');
    expect(rows.find(row => row.root === 'zoew_daily_revenue_cod_dod').after_value).toMatchObject({ codDollar: 3, dodDollar: 1, totalCount: 1 });
    expect(JSON.stringify(rows)).not.toContain(claim.token);
    const count = rows.length;
    expect((await write(updates, 'business_audit_restore_final')).rows[0].r.replayed).toBe(true); expect(await events('business_audit_restore_final')).toHaveLength(count);
    expect((await write({ ['zoew_restore_finalizations/' + source.id]: null })).error).toBeUndefined();
    await c.query("delete from public.zoe_ops where tenant_id=$1 and op_id='business_audit_restore_final'", [tenant]);
    expect(await events('business_audit_restore_final')).toHaveLength(count);
});

it('all app mutation/tamper avenues and private helper execution are denied, including a transient accidental INSERT grant', async () => {
    const attempts = [
        'insert into public.zoe_business_audit(event_id) select event_id from public.zoe_business_audit limit 1',
        "update public.zoe_business_audit set action='forged' where tenant_id=$1",
        'delete from public.zoe_business_audit where tenant_id=$1',
        'truncate public.zoe_business_audit',
        "select private.zoe_audit_summary_v1('zoew_settings','{}'::jsonb)"
    ];
    for (const sql of attempts) expect((await PG.as(c, who, sql, sql.includes('$1') ? [tenant] : [])).error?.code).toBe('42501');
    expect((await PG.as(c, { role: 'service_role' }, attempts[0])).error?.code).toBe('42501');
    try {
        await c.query('grant insert on public.zoe_business_audit to authenticated');
        await c.query('grant usage on sequence public.zoe_business_audit_archive_seq_seq to authenticated');
        const denied = await PG.as(c, who, "insert into public.zoe_business_audit(event_id,schema_version,tenant_id,origin_tenant_id,operation_id,seq,actor_uid,actor_kind,origin,root,record_key,action,reason,status_source,previous_status,new_status,before_value,after_value,changed_fields,changed_fields_truncated,summary_unchanged,projection_scope,committed_at) select gen_random_uuid(),schema_version,tenant_id,origin_tenant_id,operation_id,seq,actor_uid,actor_kind,origin,root,record_key,action,reason,status_source,previous_status,new_status,before_value,after_value,changed_fields,changed_fields_truncated,summary_unchanged,projection_scope,committed_at from public.zoe_business_audit where tenant_id=$1 limit 1", [tenant]);
        expect(denied.error?.code).toBe('42501');
    } finally { await c.query('revoke insert on public.zoe_business_audit from authenticated');await c.query('revoke usage on sequence public.zoe_business_audit_archive_seq_seq from authenticated'); }
});

it('RLS admits only the actor current branch with a live owned session; forged branch metadata, missing, borrowed and expired SID fail closed', async () => {
    const visible = await PG.as(c, who, 'select distinct tenant_id from public.zoe_business_audit');
    expect(visible.error).toBeUndefined(); expect(visible.rows).toEqual([{ tenant_id: tenant }]);
    const foreign = await PG.as(c, other, 'select event_id from public.zoe_business_audit where tenant_id=$1', [tenant]);
    expect(foreign.error).toBeUndefined(); expect(foreign.rows).toEqual([]);
    const forged = { ...who, extra: { ...who.extra, tenant_id: otherTenant, user_metadata: { tenant_id: otherTenant }, app_metadata: { tenant_id: otherTenant } } };
    expect((await PG.as(c, forged, 'select distinct tenant_id from public.zoe_business_audit')).rows).toEqual([{ tenant_id: tenant }]);
    for (const actor of [{ role: 'authenticated', sub: who.sub }, { ...who, extra: { session_id: other.extra.session_id } }]) expect((await PG.as(c, actor, 'select * from public.zoe_business_audit')).error?.code).toBe('PT401');
    try {
        await c.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1", [who.extra.session_id]);
        expect((await PG.as(c, who, 'select * from public.zoe_business_audit')).error?.code).toBe('PT401');
    } finally { await c.query('update auth.sessions set not_after=null where id=$1', [who.extra.session_id]); }
});

it('an audit storage failure aborts the entire business mutation, its seq/bytes and its replay receipt', async () => {
    const state = (await c.query('select seq,bytes from public.zoe_tenant_state where tenant_id=$1', [tenant])).rows[0];
    try {
        await c.query("alter table public.zoe_business_audit add constraint synthetic_audit_failure check(operation_id <> 'business_audit_fail_atomic') not valid");
        const result = await write({ [HIST + '/atomic_a']: item('atomic_a'), [HIST + '/atomic_b']: item('atomic_b'), 'zoew_daily_revenue_cod_dod/2026-11-15': { codDollar: 9, dodDollar: 0, totalCount: 2 } }, 'business_audit_fail_atomic');
        expect(result.error?.code).toBe('23514');
        expect((await c.query('select seq,bytes from public.zoe_tenant_state where tenant_id=$1', [tenant])).rows[0]).toEqual(state);
        expect((await c.query("select count(*)::int as n from public.zoe_docs where tenant_id=$1 and key in('atomic_a','atomic_b','2026-11-15')", [tenant])).rows[0].n).toBe(0);
        expect((await c.query("select count(*)::int as n from public.zoe_ops where tenant_id=$1 and op_id='business_audit_fail_atomic'", [tenant])).rows[0].n).toBe(0);
        expect(await events('business_audit_fail_atomic')).toEqual([]);
    } finally { await c.query('alter table public.zoe_business_audit drop constraint synthetic_audit_failure'); }
});

it('secret/settings roots and customer PII never enter audit projections; huge real valid barcode groups remain bounded and explicitly sampled', async () => {
    const source: any = item('large_private', { phone: '012000999', name: 'SYNTHETIC_PRIVATE_NAME', address: 'SYNTHETIC_PRIVATE_ADDRESS', photo: 'SYNTHETIC_PRIVATE_PHOTO', password: 'SYNTHETIC_PRIVATE_PASSWORD', cookie: 'SYNTHETIC_PRIVATE_COOKIE' });
    source.cod=20000;source.dod=0;source.price=20000;source.count=20000;
    source.barcodes = Array.from({ length: 20000 }, (_, i) => ({ code: 'B' + i, cod: 1, dod: 0 }));
    expect(Buffer.byteLength(JSON.stringify(source))).toBeLessThan(1048576);
    const started = performance.now();
    expect((await admin({ [HIST + '/' + source.id]: source, 'zoew_settings/zto_cookie': { value: 'SYNTHETIC_SETTINGS_SECRET' }, 'unknown_auth_blob/session': { value: 'SYNTHETIC_UNKNOWN_SECRET' } }, 'business_audit_large_private')).error).toBeUndefined();
    const rows = await events('business_audit_large_private'); expect(rows).toHaveLength(1);
    const summary = rows[0].after_value;
    expect(summary.barcodes).toMatchObject({ total: 20000, truncated: true, sampleLimit: 20, closed: 0, signed: 0, cod: 20000 });
    expect(summary.barcodes.sample).toHaveLength(20); expect(summary.barcodes.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(Buffer.byteLength(JSON.stringify(rows))).toBeLessThan(131072);
    expect(JSON.stringify(rows)).not.toMatch(/SYNTHETIC_PRIVATE_|SYNTHETIC_SETTINGS_SECRET|SYNTHETIC_UNKNOWN_SECRET|012000999/);
    expect(performance.now()-started).toBeLessThan(8000);
});

it('direct privileged inserts, updates and deletes are captured with truthful server statement identity and preserve audit after tenant removal', async () => {
    await c.query('insert into public.zoe_docs(tenant_id,root,key,value,seq) values($1,$2,$3,$4::jsonb,1)', [otherTenant, HIST, 'direct', JSON.stringify(item('direct'))]);
    await c.query("update public.zoe_docs set value=jsonb_set(value,'{isClosed}','true') where tenant_id=$1 and root=$2 and key='direct'", [otherTenant, HIST]);
    await c.query("delete from public.zoe_docs where tenant_id=$1 and root=$2 and key='direct'", [otherTenant, HIST]);
    const rows = (await c.query("select * from public.zoe_business_audit where tenant_id=$1 and record_key='direct' order by committed_at,event_id", [otherTenant])).rows;
    expect(rows.map(row => row.action)).toEqual(['create','update','delete']); expect(rows.every(row => row.origin==='direct_sql' && row.actor_kind==='system' && row.actor_uid===null && row.operation_id.startsWith('sql_'))).toBe(true);
    const before = (await c.query('select count(*)::int as n from public.zoe_business_audit where tenant_id=$1', [otherTenant])).rows[0].n;
    await c.query('delete from public.tenant_members where tenant_id=$1', [otherTenant]);
    await c.query('delete from public.tenants where id=$1', [otherTenant]);
    expect((await c.query('select count(*)::int as n from public.zoe_business_audit where tenant_id=$1', [otherTenant])).rows[0].n).toBe(before);
});

it.each(['sent', 'misplaced', 'restored', 'closed'])('stored return evidence stays separate from effective current return for %s', async kind => {
    const source: any = item('return_' + kind, { createdAt: 100 });
    source.barcodes = [{ code: 'AUDIT_RETURN_' + kind, cod: 3, dod: 1, createdAt: 100, isClosed: kind==='closed', ztoReturnedAt: 200,
        ...(kind==='sent'?{ztoSentOutAt:200}:kind==='misplaced'?{ztoMisplacedAt:200}:kind==='restored'?{restoredAt:300}:{}) }];
    const operation='business_audit_return_' + kind;
    expect((await admin({ [HIST + '/' + source.id]: source },operation)).error).toBeUndefined();
    const [event]=await events(operation);
    expect(event.new_status).toMatchObject({ observedReturnEvidenceCount:1,effectiveReturnedCount:0,observedSignedCount:0 });
    expect(event.action).not.toBe('observed_zto_return');
    expect(event.after_value.barcodes.sample[0].ztoReturnedAt).toBe(200);
});

it('ZoeW close never attests ZTO Sign; actual stored positive Sign and later effective return are distinct observed events', async()=>{
    const source:any=item('status_separate',{createdAt:100});source.barcodes=[{code:'AUDIT_STATUS_SEPARATE',cod:3,dod:1,createdAt:100,isClosed:false}];
    expect((await admin({[HIST+'/'+source.id]:source})).error).toBeUndefined();
    expect((await admin({[HIST+'/'+source.id+'/barcodes/0/isClosed']:true},'business_audit_zoew_closed')).error).toBeUndefined();
    const [closed]=await events('business_audit_zoew_closed');expect(closed.new_status).toMatchObject({closedCount:1,observedSignedCount:0});expect(closed.action).toBe('update');
    expect((await admin({[HIST+'/'+source.id+'/barcodes/0/ztoSignedAt']:200},'business_audit_zto_signed')).error).toBeUndefined();
    const [signed]=await events('business_audit_zto_signed');expect(signed.action).toBe('observed_zto_sign');expect(signed.new_status.observedSignedCount).toBe(1);expect(signed.status_source).toBe('stored_business_state');
    expect((await admin({[HIST+'/'+source.id+'/barcodes/0/isClosed']:false,[HIST+'/'+source.id+'/barcodes/0/ztoReturnedAt']:300,[HIST+'/'+source.id+'/barcodes/0/ztoSentOutAt']:200},'business_audit_zto_returned')).error).toBeUndefined();
    const [returned]=await events('business_audit_zto_returned');expect(returned.action).toBe('observed_zto_return');expect(returned.new_status.effectiveReturnedCount).toBe(1);
});

it('claim/prepare/cancel correlation preserves business hashes and selected source identity without declaring a successful restore',async()=>{
    const target:any=item('marker_target',{restoreClaimId:'marker_source',restoreClaimToken:'BUSINESS_CORRELATION_ONLY',restoreAddedCodes:JSON.stringify(['AUDIT_marker_target'])});
    expect((await admin({[HIST+'/'+target.id]:target},'business_audit_prepare_marker')).error).toBeUndefined();
    const [prepared]=await events('business_audit_prepare_marker');expect(prepared.after_value).toMatchObject({restoreClaimId:'marker_source',restoreAddedCodes:{total:1,truncated:false}});
    expect(prepared.after_value.claimCorrelationHash).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(prepared)).not.toContain('BUSINESS_CORRELATION_ONLY');
    expect((await admin({[HIST+'/'+target.id+'/restoreClaimId']:null,[HIST+'/'+target.id+'/restoreClaimToken']:null,[HIST+'/'+target.id+'/restoreAddedCodes']:null},'business_audit_cancel_marker')).error).toBeUndefined();
    const [cancelled]=await events('business_audit_cancel_marker');expect(cancelled.action).toBe('update');expect(cancelled.before_value.claimCorrelationHash).toBe(prepared.after_value.claimCorrelationHash);expect(cancelled.after_value.claimCorrelationHash).toBeUndefined();
});

it('legacy zoe_write and old clients receive automatic audit; untrusted opcontext is overwritten and restored',async()=>{
    const operation='business_audit_legacy_client', forgedOperation='business_audit_forged_context';
    const result=await PG.as(c,who,"with configured as materialized(select set_config('zoe.audit_context',$1,true)) select public.zoe_write($2,$3::jsonb) as r from configured",[JSON.stringify({tenant:otherTenant,operation:forgedOperation,origin:'admin_engine'}),operation,JSON.stringify(packet({[HIST+'/legacy']:item('legacy')}))]);
    expect(result.error).toBeUndefined();
    const [event]=await events(operation);expect(event).toMatchObject({tenant_id:tenant,operation_id:operation,actor_uid:who.sub,origin:'app_engine'});
    expect(await events(forgedOperation)).toEqual([]);
});

it('typed pickup reset emits one server-linked audit event without changing correctness receipt shape',async()=>{
    const day='2026-11-16',before={pickupRevision:4,pickupResetEpoch:2,packagesPickedUp:3,pickedUpPhones:{'012000111':true},pickedUpBarcodes:{AUDIT_PICKUP:true}};
    expect((await admin({['zoew_daily_pickup_cod_dod/'+day]:before})).error).toBeUndefined();
    const context={v:1,scope:'audit-project#'+tenant,batchId:'audit_batch',batchHash:'a'.repeat(64),dayId:'audit_batch:'+day,day,nonce:'audit_nonce'};
    const casText=JSON.stringify({k:'cas',p:['zoew_daily_pickup_cod_dod',day],x:before,v:{pickupRevision:5,pickupResetEpoch:3,packagesPickedUp:0,pickedUpPhones:null,pickedUpBarcodes:null}});
    const originalCrypto=globalThis.crypto;Object.defineProperty(globalThis,'crypto',{configurable:true,value:webcrypto});
    let attempt:string;try{attempt=await pickupResetAttemptId(tenant,who.sub,context,casText);}finally{Object.defineProperty(globalThis,'crypto',{configurable:true,value:originalCrypto});}
    const reset=()=>PG.as(c,who,'select public.zoe_pickup_reset_execute_v1($1,$2,$3::jsonb,$4) as r',[tenant,attempt,JSON.stringify(context),casText]);
    const first=await reset();expect(first.error).toBeUndefined();expect(first.rows[0].r.reset).toMatchObject({actorUid:who.sub,tenant,attemptId:attempt,outcome:'applied'});
    const rows=await events(attempt);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({actor_uid:who.sub,origin:'app_engine',root:'zoew_daily_pickup_cod_dod',record_key:day});
    expect(rows[0].before_value).toMatchObject({pickupRevision:4,pickupResetEpoch:2,packagesPickedUp:3,pickedUpPhoneCount:1});
    expect(rows[0].after_value).toMatchObject({pickupRevision:5,pickupResetEpoch:3,packagesPickedUp:0,pickedUpPhoneCount:0});
    expect(JSON.stringify(rows)).not.toContain('012000111');
    expect((await reset()).rows[0].r.replayed).toBe(true);expect(await events(attempt)).toHaveLength(1);
});

it('a changed barcode outside the sample changes full-set evidence and totals while explicitly retaining sample truncation',async()=>{
    const before=(await events('business_audit_large_private'))[0].after_value;
    expect((await admin({[HIST+'/large_private/barcodes/19999/cod']:2},'business_audit_large_tail')).error).toBeUndefined();
    const [event]=await events('business_audit_large_tail');expect(event.after_value.barcodes.sample).toEqual(before.barcodes.sample);
    expect(event.after_value.barcodes).toMatchObject({total:20000,truncated:true,cod:20001});expect(event.after_value.barcodes.sha256).not.toBe(before.barcodes.sha256);
    expect(event.changed_fields).toContain('barcodes');expect(event.projection_scope).toBe('bounded_business_fields');
});

it('engine metadata/ACL are preserved and its business code differs only by exact audit opcontext capture/restoration',async()=>{
    const {definition:before,...metadataBefore}=engineBefore,{definition:after,...metadataAfter}=engineAfter;
    expect(metadataAfter).toEqual(metadataBefore);
    const normalized=after
        .replace("\n    prior_audit_context text := current_setting('zoe.audit_context', true);",'')
        .replace("\n    perform set_config('zoe.audit_context', jsonb_build_object('tenant',tenant,'operation',p_op_id,'origin',case when p_enforce then 'app_engine' else 'admin_engine' end)::text, true);",'')
        .replaceAll("\n    perform set_config('zoe.audit_context', coalesce(prior_audit_context, ''), true);",'');
    expect(normalized).toBe(before);
    const policy=(await c.query("select relrowsecurity from pg_class where oid='public.zoe_business_audit'::regclass")).rows[0];expect(policy.relrowsecurity).toBe(true);
    const helpers=(await c.query("select p.proname,p.prosecdef,p.proconfig,has_function_privilege('authenticated',p.oid,'EXECUTE') as auth,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('service_role',p.oid,'EXECUTE') as service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and (p.proname like 'zoe_audit_%' or p.proname='zoe_business_audit_capture_v1')")).rows;
    expect(helpers.length).toBeGreaterThanOrEqual(6);expect(helpers.every(row=>!row.auth&&!row.anon&&!row.service&&row.proconfig.includes('search_path=""'))).toBe(true);
});

it('rollback rehearsals restore the exact old engine metadata and keep the audit archive; reactivation resumes capture',async()=>{
    const beforeCount=(await c.query('select count(*)::int as n from public.zoe_business_audit')).rows[0].n;
    await c.query('begin');try{
        await c.query('drop trigger zoe_business_audit_capture on public.zoe_docs');await c.query(hostedBaseline?.definition||engineBefore.definition);
        expect(await engineMetadata()).toEqual(engineBefore);
    }finally{await c.query('rollback');}
    expect(await engineMetadata()).toEqual(engineAfter);
    try{
        await c.query('begin');await c.query('drop trigger zoe_business_audit_capture on public.zoe_docs');await c.query(hostedBaseline?.definition||engineBefore.definition);await c.query('commit');
        expect(await engineMetadata()).toEqual(engineBefore);expect((await c.query('select count(*)::int as n from public.zoe_business_audit')).rows[0].n).toBe(beforeCount);
    }finally{
        await c.query('rollback');await c.query(engineAfter.definition);await c.query('drop trigger if exists zoe_business_audit_capture on public.zoe_docs');
        await c.query('create trigger zoe_business_audit_capture after insert or update or delete on public.zoe_docs for each row execute function private.zoe_business_audit_capture_v1()');
    }
    if(hostedBaseline){
        const dir=path.join(ROOT,'tools/audit-tools/zoew/test-results/final-audit/hosted');
        const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
        const guard=(expected:string)=>"do $guard$ begin if encode(sha256(convert_to(pg_get_functiondef('private.zoe_apply_engine_v1(uuid,text,jsonb,boolean,boolean,jsonb)'::regprocedure),'UTF8')),'hex') <> '"+expected+"' then raise exception 'audit-engine-baseline-mismatch';end if;end $guard$;\n";
        fs.writeFileSync(path.join(dir,'business-audit-rollback.sql'),'begin;\n'+guard(digest(engineAfter.definition))+'drop trigger zoe_business_audit_capture on public.zoe_docs;\n'+hostedBaseline.definition+'\ncommit;\n',{mode:0o600});
        fs.writeFileSync(path.join(dir,'business-audit-reactivate.sql'),'begin;\n'+guard(digest(hostedBaseline.definition))+engineAfter.definition+'\ncreate trigger zoe_business_audit_capture after insert or update or delete on public.zoe_docs for each row execute function private.zoe_business_audit_capture_v1();\ncommit;\n',{mode:0o600});
        fs.writeFileSync(path.join(dir,'business-audit-rollback-rehearsal.json'),JSON.stringify({status:'PASS',environment:PG.pgBin.version,source:'actual saved hosted old engine definition/owner/ACL/config/volatility/security-definer',oldDefinitionSha256:digest(hostedBaseline.definition),candidateDefinitionSha256:digest(engineAfter.definition),transactionRollbackRestoresCandidate:true,transactionCommitRestoresExactBaseline:true,reactivationRestoresCandidate:true,archiveRowsPreserved:beforeCount,archiveTablePreserved:true,limits:['No hosted mutation; actual saved hosted engine replayed in isolated local PG.','Rollback deliberately leaves immutable archive/table/functions available; it pauses future capture and requires explicit root decision, never automatic fallback.','Backup audit archive using the service-only export API or pg_dump before any privileged fixture cleanup.']},null,2)+'\n',{mode:0o600});
    }
    expect(await engineMetadata()).toEqual(engineAfter);
    expect((await write({[HIST+'/reactivated']:item('reactivated')},'business_audit_reactivated')).error).toBeUndefined();expect(await events('business_audit_reactivated')).toHaveLength(1);
});

it('bounded local PG writes report round-trip percentiles and audit convergence under a small 24-operation sample',async()=>{
    const timings:number[]=[];const countBefore=(await c.query('select count(*)::int as n from public.zoe_business_audit where tenant_id=$1',[tenant])).rows[0].n;
    for(let i=0;i<24;i++){const started=performance.now();const result=await write({[HIST+'/sample_'+i]:item('sample_'+i)},'business_audit_sample_'+String(i).padStart(3,'0'));expect(result.error).toBeUndefined();timings.push(performance.now()-started);}
    const sorted=[...timings].sort((a,b)=>a-b),q=(p:number)=>sorted[Math.ceil(p*sorted.length)-1];
    const countAfter=(await c.query('select count(*)::int as n from public.zoe_business_audit where tenant_id=$1',[tenant])).rows[0].n;
    expect(countAfter-countBefore).toBe(24);expect((await c.query("select count(*)::int as n from public.zoe_docs where tenant_id=$1 and root=$2 and key like 'sample_%' and value is not null",[tenant,HIST])).rows[0].n).toBe(24);
    performanceEvidence.push({sample:'24 sequential actual PG transaction round trips, one synthetic tenant, no network API or concurrency capacity claim',operations:24,errors:0,retries:0,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),auditEvents:countAfter-countBefore});
});

const exportAudit=(branch=tenant,after='0',through:any=null,limit=200,maxBytes=1048576)=>PG.as(c,{role:'service_role'},'select public.zoe_admin_audit_export($1,$2,$3,$4,$5) as r',[branch,after,through,limit,maxBytes]);
const restoreAudit=(target:string,source:string,rows:any[])=>PG.as(c,{role:'service_role'},'select public.zoe_admin_audit_restore($1,$2,$3::jsonb) as r',[target,source,JSON.stringify(rows)]);
const newTenant=async(label:string)=>(await c.query("insert into public.tenants(name,branch_code,expires_at) values($1,$2,now()+interval '1 day') returning id",['audit_'+label,'AUDIT_'+(++serial)])).rows[0].id;

it('service-only bounded audit export traverses a stable snapshot, preserves bigint/time exactly and lists deleted-tenant archives',async()=>{
    for(const sql of ['select public.zoe_admin_audit_tenants(null,10)','select public.zoe_admin_audit_export($1)','select public.zoe_admin_audit_restore($1,$1,\'[]\'::jsonb)']){
        expect((await PG.as(c,who,sql,sql.includes('$1')?[tenant]:[])).error?.code).toBe('42501');expect((await PG.as(c,{role:'anon'},sql,sql.includes('$1')?[tenant]:[])).error?.code).toBe('42501');
    }
    let after='0',through:any=null;const all:any[]=[];
    for(let page=0;page<100;page++){
        const result=await exportAudit(tenant,after,through,3,65536);expect(result.error).toBeUndefined();const value=result.rows[0].r;
        expect(value.v).toBe(1);expect(value.tenant).toBe(tenant);expect(value.rows.length).toBeLessThanOrEqual(3);expect(value.through).toMatch(/^[0-9]+$/);if(through===null)through=value.through;else expect(value.through).toBe(through);
        all.push(...value.rows);if(!value.more){expect(value.next).toBeNull();break;}expect(BigInt(value.next)).toBeGreaterThan(BigInt(after));after=value.next;
    }
    const stored=(await c.query('select count(*)::int as n from public.zoe_business_audit where tenant_id=$1 and archive_seq<=$2',[tenant,through])).rows[0].n;expect(all).toHaveLength(stored);expect(new Set(all.map(row=>row.event_id)).size).toBe(all.length);
    expect(all.every(row=>typeof row.seq==='string'&&/^[1-9][0-9]*$/.test(row.seq)&&/T[0-9:.]{15}Z$/.test(row.committed_at)&&!('archive_seq'in row)&&!('archive_imported_at'in row))).toBe(true);
    expect((await write({[HIST+'/after_export']:item('after_export')},'business_audit_after_export')).error).toBeUndefined();
    const limited=(await exportAudit(tenant,'0',through,500)).rows[0].r;expect(limited.rows.some((row:any)=>row.operation_id==='business_audit_after_export')).toBe(false);
    const listed=await PG.as(c,{role:'service_role'},'select public.zoe_admin_audit_tenants(null,500) as r');expect(listed.error).toBeUndefined();expect(listed.rows[0].r.tenants).toContain(otherTenant);
    expect((await exportAudit(otherTenant)).rows[0].r.rows).toHaveLength(3);
});

it('same/new-tenant archive restore preserves historical actor/time/origin/event IDs and replays exactly without live business effects',async()=>{
    const rows=(await exportAudit(tenant,'0',null,500)).rows[0].r.rows,selected=rows.slice(0,4),target=await newTenant('archive_target');
    expect(selected).toHaveLength(4);
    const before=(await c.query('select count(*)::int as n from public.zoe_business_audit where tenant_id=$1',[tenant])).rows[0].n;
    expect((await restoreAudit(tenant,tenant,selected)).rows[0].r).toMatchObject({imported:0,replayed:4,total:4});
    const first=await restoreAudit(target,tenant,selected);expect(first.error).toBeUndefined();expect(first.rows[0].r).toMatchObject({imported:4,replayed:0,total:4});
    const copied=(await exportAudit(target)).rows[0].r.rows;
    expect(copied.map((row:any)=>({...row,tenant_id:tenant}))).toEqual(selected);
    expect(copied.every((row:any)=>row.origin_tenant_id===tenant)).toBe(true);
    const again=await restoreAudit(target,tenant,selected);expect(again.rows[0].r).toMatchObject({imported:0,replayed:4,total:4});
    expect((await c.query('select count(*)::int as n from public.zoe_docs where tenant_id=$1',[target])).rows[0].n).toBe(0);
    expect((await c.query('select seq,bytes from public.zoe_tenant_state where tenant_id=$1',[target])).rows[0]).toEqual({seq:'0',bytes:'0'});
    expect((await c.query('select count(*)::int as n from public.zoe_business_audit where tenant_id=$1',[tenant])).rows[0].n).toBe(before);
    const owners=(await c.query('select tenant_id from public.zoe_business_audit where event_id=$1',[selected[0].event_id])).rows.map((row:any)=>row.tenant_id);expect(owners).toContain(tenant);expect(owners).toContain(target);
});

it('archive collisions/malformed/foreign/secret-bearing rows fail closed with atomic batch rollback and no overwrite',async()=>{
    const selected=(await exportAudit(tenant,'0',null,500)).rows[0].r.rows.slice(0,2),target=await newTenant('archive_collision');
    expect((await restoreAudit(target,tenant,[selected[0]])).error).toBeUndefined();
    const conflict=structuredClone(selected[0]);conflict.after_value.cod=999;
    const result=await restoreAudit(target,tenant,[selected[1],conflict]);expect(result.error?.code).toBe('PT409');expect(result.error?.message).toBe('audit-event-conflict');
    expect((await exportAudit(target)).rows[0].r.rows).toEqual([{...selected[0],tenant_id:target}]);
    for(const mutate of [
        (row:any)=>{row.schema_version=2;},(row:any)=>{row.tenant_id=target;},(row:any)=>{row.root='zoew_settings';},
        (row:any)=>{row.after_value.password='SYNTHETIC_ARCHIVE_SECRET';},(row:any)=>{row.before_value.cookie='SYNTHETIC_ARCHIVE_COOKIE';},
        (row:any)=>{row.seq=Number(row.seq);},(row:any)=>{row.committed_at='2026-11-14 12:00:00';},(row:any)=>{row.extra='forbidden';}
    ]){const bad=structuredClone(selected[1]);mutate(bad);const rejected=await restoreAudit(target,tenant,[bad]);expect(rejected.error).toBeDefined();expect((await exportAudit(target)).rows[0].r.rows).toHaveLength(1);}
});

it('archive bigint sequencing and UTC timestamps never round through JavaScript or database session timezone',async()=>{
    const original=(await exportAudit(tenant,'0',null,1)).rows[0].r.rows[0],target=await newTenant('bigint_archive');
    const row={...original,event_id:'00000000-0000-4000-8000-000000000099',seq:'9007199254740993',committed_at:'2026-11-14T00:00:00.123456Z'};
    expect((await restoreAudit(target,tenant,[row])).error).toBeUndefined();
    await c.query("set time zone 'Asia/Phnom_Penh'");try{
        const exported=(await exportAudit(target)).rows[0].r.rows[0];expect(exported).toMatchObject({seq:row.seq,committed_at:row.committed_at,origin_tenant_id:tenant});
        expect((await restoreAudit(target,tenant,[row])).rows[0].r.replayed).toBe(1);
    }finally{await c.query("set time zone 'UTC'");}
});

it('typed registry purge appends actor/source/reason audit in the same engine transaction and exact replay adds nothing',async()=>{
    const id='audit_typed_purge',code='AUDIT_TYPED_PURGE',birth=1700000000000,deletedAt=1790000000000;
    const source={...item(id),createdAt:birth,deletedAt,trashReason:'remove',trashMode:'cookie',trashGeneration:1,isFromDeletion:false,cod:1,dod:0,price:1,count:1,barcodes:{0:{code,cod:1,dod:0,isClosed:false,createdAt:birth}}};
    const releaseId='release_'+createHash('sha256').update(id).digest('hex').slice(0,32),scope='audit-project#'+tenant;
    const release={v:2,generation:1,id:releaseId,kind:'legacy',actorUid:who.sub,releasedBy:who.sub,scope,code,registryKey:code,birth,trashId:id,slot:'0',deletedAt,rowBirth:birth,rowCount:1};
    const consumption={v:1,sourceId:id,generation:1,kind:'purge',actorUid:who.sub,scope,deletedAt,rowBirth:birth};
    expect((await admin({[TRASH+'/'+id]:source,['zoew_barcode_registry/'+code]:true})).error).toBeUndefined();
    const ops=packet({[TRASH+'/'+id]:null,['zoew_trash_consumptions/'+id]:consumption,['zoew_barcode_registry/'+code]:null,['zoew_registry_releases/'+releaseId]:release});
    const call=()=>PG.as(c,who,'select public.zoe_purge_execute_v1($1,$2,$3::jsonb) as r',[tenant,'business_audit_typed_purge',JSON.stringify(ops)]);
    const beforeMoney=(await c.query("select root,key,value from public.zoe_docs where tenant_id=$1 and root in('zoew_daily_revenue_cod_dod','zoew_monthly_revenue_cod_dod') order by root,key",[tenant])).rows;
    const first=await call();expect(first.error).toBeUndefined();expect(first.rows[0].r.purge).toMatchObject({outcome:'applied',actorUid:who.sub,tenant});
    const rows=await events('business_audit_typed_purge');expect(rows).toHaveLength(3);expect(rows.every(row=>row.actor_uid===who.sub&&row.origin==='app_engine')).toBe(true);
    expect(rows.find(row=>row.root===TRASH)).toMatchObject({reason:'remove',new_status:{exists:false,location:'absent'}});
    expect(rows.find(row=>row.root==='zoew_trash_consumptions')).toMatchObject({action:'purge',after_value:{sourceId:id,generation:1,kind:'purge'}});
    expect((await call()).rows[0].r.replayed).toBe(true);expect(await events('business_audit_typed_purge')).toHaveLength(3);
    expect((await c.query("select root,key,value from public.zoe_docs where tenant_id=$1 and root in('zoew_daily_revenue_cod_dod','zoew_monthly_revenue_cod_dod') order by root,key",[tenant])).rows).toEqual(beforeMoney);
});

it('500 valid business records retain one audit event each within the existing eight-second backend statement budget',async()=>{
    const updates=Object.fromEntries(Array.from({length:500},(_,i)=>[HIST+'/batch_'+i,item('batch_'+i)]));
    await c.query("set statement_timeout='8s'");const started=performance.now();let result:any;
    try{result=await write(updates,'business_audit_batch_500');}finally{await c.query('reset statement_timeout');}
    const elapsed=performance.now()-started;expect(result.error).toBeUndefined();expect(result.rows[0].r.ok).toBe(true);expect(await events('business_audit_batch_500')).toHaveLength(500);expect(elapsed).toBeLessThan(8000);
    performanceEvidence.push({sample:'One 500-record transaction, actual local PG17, original8s statement timeout',records:500,auditEvents:500,elapsedMs:elapsed,errors:0});
},10000);

it('audit tenant enumeration seeks bounded distinct UUID pages, including zero UUID and orphan archives without duplicates or omissions',async()=>{
    const zero='00000000-0000-0000-0000-000000000000';
    await c.query(`insert into public.zoe_business_audit(tenant_id,origin_tenant_id,operation_id,seq,actor_kind,origin,root,record_key,action,reason,previous_status,new_status,before_value,after_value,changed_fields,changed_fields_truncated,summary_unchanged)
        values($1,$1,'business_audit_zero_uuid',1,'system','direct_sql',$2,'zero_uuid','create','record_created','{"exists":false,"location":"absent"}'::jsonb,'{"exists":true,"location":"history"}'::jsonb,'{"exists":false,"location":"absent"}'::jsonb,'{"exists":true,"location":"history"}'::jsonb,array['exists','location'],false,false)`,[zero,HIST]);
    const expected=(await c.query('select distinct tenant_id from public.zoe_business_audit order by tenant_id')).rows.map((row:any)=>row.tenant_id),actual:string[]=[];
    let after:string|null=null;
    for(let page=0;page<50;page++){
        const result=await PG.as(c,{role:'service_role'},'select public.zoe_admin_audit_tenants($1,1) as r',[after]);expect(result.error).toBeUndefined();const value=result.rows[0].r;
        expect(value.tenants).toHaveLength(1);actual.push(...value.tenants);if(!value.more){expect(value.next).toBeNull();break;}expect(value.next).toBe(value.tenants[0]);if(after!==null)expect(value.next>after).toBe(true);after=value.next;
    }
    expect(actual[0]).toBe(zero);expect(actual).toEqual(expected);expect(new Set(actual).size).toBe(actual.length);
    expect((await PG.as(c,{role:'service_role'},'select public.zoe_admin_audit_tenants($1,500) as r',['ffffffff-ffff-ffff-ffff-ffffffffffff'])).rows[0].r).toEqual({tenants:[],more:false,next:null});
});

it('the audit identity sequence is server-only even under permissive default sequence grants, so a user cannot stop every branch by exhausting it',async()=>{
    const attack=await PG.as(c,who,"select setval('public.zoe_business_audit_archive_seq_seq',9223372036854775807,true)");
    const legitimate=await write({[HIST+'/sequence_guard']:item('sequence_guard')},'business_audit_sequence_guard');
    expect({attackCode:attack.error?.code,businessError:legitimate.error?.code}).toEqual({attackCode:'42501',businessError:undefined});
    expect(await events('business_audit_sequence_guard')).toHaveLength(1);
    for(const role of ['anon','authenticated','service_role']){
        const actor=role==='authenticated'?who:{role};
        for(const sql of ["select nextval('public.zoe_business_audit_archive_seq_seq')","select last_value from public.zoe_business_audit_archive_seq_seq","select setval('public.zoe_business_audit_archive_seq_seq',1,false)"])expect((await PG.as(c,actor,sql)).error?.code).toBe('42501');
        const privileges=(await c.query("select has_sequence_privilege($1,'public.zoe_business_audit_archive_seq_seq','USAGE') as usage,has_sequence_privilege($1,'public.zoe_business_audit_archive_seq_seq','SELECT') as read,has_sequence_privilege($1,'public.zoe_business_audit_archive_seq_seq','UPDATE') as update",[role])).rows[0];
        expect(privileges).toEqual({usage:false,read:false,update:false});
    }
});

it('a bounded 500-event archive batch imports and replays without creating business rows or changing historical identities',async()=>{
    const rows=(await c.query("select private.zoe_audit_export_row_v1(a) as event from public.zoe_business_audit a where tenant_id=$1 and operation_id='business_audit_batch_500' order by archive_seq",[tenant])).rows.map((row:any)=>row.event);
    expect(rows).toHaveLength(500);expect(Buffer.byteLength(JSON.stringify(rows))).toBeLessThan(4194304);
    const target=await newTenant('archive_500');await c.query("set statement_timeout='8s'");const started=performance.now();let first:any,replayed:any;let importMs:number,replayMs:number;
    try{first=await restoreAudit(target,tenant,rows);importMs=performance.now()-started;const next=performance.now();replayed=await restoreAudit(target,tenant,rows);replayMs=performance.now()-next;}finally{await c.query('reset statement_timeout');}
    expect(first.error).toBeUndefined();expect(first.rows[0].r).toMatchObject({imported:500,replayed:0,total:500});expect(replayed.error).toBeUndefined();expect(replayed.rows[0].r).toMatchObject({imported:0,replayed:500,total:500});
    expect((await c.query('select count(*)::int as n from public.zoe_business_audit where tenant_id=$1',[target])).rows[0].n).toBe(500);
    expect((await c.query('select count(*)::int as n from public.zoe_docs where tenant_id=$1',[target])).rows[0].n).toBe(0);
    expect(importMs).toBeLessThan(8000);expect(replayMs).toBeLessThan(8000);performanceEvidence.push({sample:'500 historical archive events actual local PG17, original8s SQL budget, no business-document effects',events:500,importMs,replayMs,businessRows:0,errors:0});
},20000);
