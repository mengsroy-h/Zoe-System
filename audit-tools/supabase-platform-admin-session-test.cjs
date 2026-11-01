'use strict';

process.exitCode = 1;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = process.env.SUPABASE_ADMIN_SESSION_APP_DIR ? path.resolve(process.env.SUPABASE_ADMIN_SESSION_APP_DIR) : path.resolve(__dirname, '..');
const output = process.env.SUPABASE_ADMIN_SESSION_RESULT;
const baseline = process.env.SUPABASE_ADMIN_SESSION_BASELINE === '1';
const migration = '20261101071206_zoe_platform_admin_active_session.sql';
const candidate = path.join(root, 'supabase/migrations', migration);
const { createPgHarness } = require(path.join(root, 'audit-tools/supabase-pg.js'));
const h = createPgHarness({ depsDirs: [path.join(root, 'supabase/node_modules')], shimDir: path.join(root, 'audit-tools/supabase-shim'), wantMajor: 17 });
const cases = [];
const loaded = [];
const uid = '10000000-0000-4000-8000-000000000001';
const member = '10000000-0000-4000-8000-000000000002';
const other = '10000000-0000-4000-8000-000000000003';
const sid = '20000000-0000-4000-8000-000000000001';
const otherSid = '20000000-0000-4000-8000-000000000003';
const tenant = '30000000-0000-4000-8000-000000000001';
let c;
let authAdmin;
let database;
let beforeAcl;

function check(label, condition, actual, kind = 'behavior') {
    cases.push({ label, pass: !!condition, actual, kind });
    console.log((condition ? 'PASS ' : 'FAIL ') + label + (condition ? '' : ' ' + JSON.stringify(actual)));
}

async function scenario(label, action) {
    try { await action(); }
    catch (e) { check(label + ': infrastructure', false, { message: e.message, code: e.code }, 'infrastructure'); }
}

function sqlFile(name) {
    const text = fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');
    loaded.push({ name, sha256: crypto.createHash('sha256').update(text).digest('hex') });
    return text;
}

function claims(extra = {}, sub = uid, role = 'authenticated') {
    return { role, sub, extra: { session_id: sid, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), ...extra } };
}

function isRevoked(r) { return !!r.error && r.error.code === 'PT401' && r.error.message === 'session-revoked'; }

async function session(id = sid, user = uid, after = null) {
    await authAdmin.query('insert into auth.sessions (id,user_id,created_at,updated_at) values ($1,$2,now(),now()) on conflict (id) do update set user_id=excluded.user_id', [id, user]);
    if (after !== undefined && await hasNotAfter()) await authAdmin.query('update auth.sessions set not_after=$2::timestamptz where id=$1', [id, after]);
}

async function hasNotAfter() {
    return (await authAdmin.query("select exists(select 1 from information_schema.columns where table_schema='auth' and table_name='sessions' and column_name='not_after') as present")).rows[0].present;
}

async function aclSnapshot() {
    return (await c.query(`select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args,
        p.proowner::regrole::text as owner,p.proacl::text as acl,p.prosecdef,p.provolatile,p.proconfig,
        has_function_privilege('anon',p.oid,'execute') as anon,
        has_function_privilege('authenticated',p.oid,'execute') as authenticated,
        has_function_privilege('service_role',p.oid,'execute') as service_role
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in ('private','public') order by n.nspname,p.proname,args`)).rows;
}

async function loadFocusedSchema() {
    await c.query(sqlFile('20260930120000_zoe_tenancy.sql'));
    const move = sqlFile('20261002000100_zoe_definer_private.sql');
    const adminOnly = move
        .replace(/,\s*'zoe_write\(text, jsonb\)'/, '')
        .replace(/create or replace function public\.zoe_write\([\s\S]*?\$\$;\s*/, '')
        .replace(/,\s*private\.zoe_write\(text, jsonb\)/g, '')
        .replace(/,\s*public\.zoe_write\(text, jsonb\)/g, '');
    if (/zoe_write/.test(adminOnly)) throw new Error('unrelated datastore statement remains');
    await c.query(adminOnly);
    await c.query(sqlFile('20261003160000_zoe_admin_races.sql'));
    await c.query(sqlFile('20261010140000_zoe_member_devices.sql'));
    await c.query('create table public.zoe_tenant_state (tenant_id uuid primary key, seq bigint not null default 0)');
    const sync = sqlFile('20261028110114_zoe_session_console_sync.sql');
    const match = sync.match(/^(create or replace function private\.current_tenant_id\(\)[\s\S]*?\$\$;\s*create or replace function public\.revoke_user_sessions\(p_user_id uuid\)[\s\S]*?\$\$;)/);
    if (!match) throw new Error('session console auth slice absent');
    await c.query(match[1]);
    await c.query('insert into auth.users (id,email) values ($1,$2),($3,$4),($5,$6)', [uid,'admin@example.invalid',member,'member@example.invalid',other,'other@example.invalid']);
    await c.query('insert into public.platform_admins (user_id) values ($1)', [uid]);
    await c.query("insert into public.tenants (id,name,branch_code,expires_at) values ($1,'R1 local shop','R1_LOCAL',now()+interval '30 days')", [tenant]);
    await c.query("insert into public.tenant_members (user_id,tenant_id,username,role) values ($1,$2,'r1_member','member')", [member,tenant]);
    await c.query("insert into public.member_devices (tenant_id,serial,user_id) values ($1,'abcdef0123456789',$2)", [tenant,member]);
    await c.query("insert into public.tenant_invites (code_hash,tenant_id,role,max_uses,expires_at) values (repeat('a',64),$1,'member',1,now()+interval '1 day')", [tenant]);
    await c.query("insert into public.member_reset_codes (code_hash,user_id,expires_at) values (repeat('b',64),$1,now()+interval '1 day')", [member]);
    await session();
    await session(otherSid, other);
}

async function main() {
    const candidateSql = baseline ? null : fs.readFileSync(candidate, 'utf8');
    if (h.unavailableReason()) throw new Error(h.unavailableReason());
    await h.start();
    ({ c, name: database } = await h.freshDb('no-default-grants'));
    authAdmin = await h.connect('supabase_auth_admin', database);
    await loadFocusedSchema();
    beforeAcl = await aclSnapshot();
    if (!baseline) await c.query(candidateSql);
    const helper = () => h.as(c, claims(), 'select private.is_platform_admin() as allowed');

    await scenario('fresh fixtures', async () => {
        const r = await authAdmin.query('select id,user_id,created_at > now()-interval \'1 minute\' as fresh from auth.sessions order by id');
        check('fixture has two fresh real session rows with distinct user owners', r.rows.length === 2 && r.rows.every(x => x.fresh) && r.rows[0].user_id !== r.rows[1].user_id, r.rows);
    });
    await scenario('active helper', async () => {
        const r = await helper();
        check('active matching admin session accepted', r.rows?.[0]?.allowed === true, r);
    });
    await scenario('active RPC controls', async () => {
        const r = await h.as(c, claims(), "select (public.admin_create_tenant('R1 local create','R1_CREATE',now()+interval '1 day')).id as id");
        check('active admin can create tenant via public invoker wrapper', !!r.rows?.[0]?.id, r);
        const read = await h.as(c, claims(), 'select count(*)::int as n from public.member_devices');
        check('active admin reads member_devices through RLS', read.rows?.[0]?.n === 1, read);
        const expiry = (await c.query('select expires_at::text from public.tenants where id=$1',[tenant])).rows[0].expires_at;
        const extended = await h.as(c, claims(), 'select (public.admin_extend_tenant($1,1,$2::timestamptz)).id as id',[tenant,expiry]);
        check('active admin can extend tenant with exact current expiry', extended.rows?.[0]?.id === tenant, extended);
    });
    await scenario('ordinary member', async () => {
        const r = await h.as(c, claims({session_id:otherSid,user_metadata:{platform_admin:true,role:'service_role'}},member), 'select private.is_platform_admin() as allowed');
        check('ordinary member cannot gain admin via metadata', r.rows?.[0]?.allowed === false, r);
        const rpc = await h.as(c, claims({},member), "select public.admin_revoke_invite(repeat('a',64))");
        check('ordinary member admin RPC remains forbidden', rpc.error?.code === '42501' && rpc.error?.message === 'forbidden', rpc);
    });
    for (const [label, extra] of [
        ['missing session claim',{session_id:undefined}],
        ['legacy token without session claim',{session_id:undefined,iat:1}],
        ['null session claim',{session_id:null}],
        ['empty session claim',{session_id:''}],
        ['malformed session claim',{session_id:'not-a-uuid'}],
        ['object session claim',{session_id:{id:sid}}],
        ['session belongs to wrong uid',{session_id:otherSid}]
    ]) await scenario(label, async () => {
        const r = await h.as(c, claims(extra), 'select private.is_platform_admin() as allowed');
        check(label + ' fails closed with relogin signal', isRevoked(r), r);
    });
    await scenario('malformed uid', async () => {
        const r = await h.as(c, claims({},'not-a-uuid'), 'select private.is_platform_admin() as allowed');
        check('malformed uid fails closed with relogin signal', isRevoked(r), r);
    });
    await scenario('missing uid', async () => {
        const r = await h.as(c, {role:'authenticated',extra:{session_id:sid}}, 'select private.is_platform_admin() as allowed');
        check('session claim alone without uid cannot authorize admin', r.rows?.[0]?.allowed === false, r);
    });
    await scenario('revocation', async () => {
        check('precondition active session authorized before revoke', (await helper()).rows?.[0]?.allowed === true);
        const r = await h.as(c, {role:'service_role',extra:{}}, 'select public.revoke_user_sessions($1) as removed', [uid]);
        check('existing service-only revoke works without human session', r.rows?.[0]?.removed === 1, r);
        check('revocation row absent before next authorization', (await authAdmin.query('select count(*)::int as n from auth.sessions where id=$1',[sid])).rows[0].n === 0);
        check('revoked access token denied on next helper authorization', isRevoked(await helper()));
    });
    const revokedExtendExpiry = (await c.query('select expires_at::text from public.tenants where id=$1',[tenant])).rows[0].expires_at;
    for (const [label, sql, args] of [
        ['admin_create_tenant',"select public.admin_create_tenant('R1 blocked','R1_BLOCKED',now()+interval '1 day')",[]],
        ['admin_update_tenant','select public.admin_update_tenant($1, $2)',[tenant,'R1 blocked']],
        ['admin_issue_invite','select * from public.admin_issue_invite($1)',[tenant]],
        ['admin_revoke_invite',"select public.admin_revoke_invite(repeat('a',64))",[]],
        ['admin_issue_reset_code',"select * from public.admin_issue_reset_code('r1_member')",[]],
        ['admin_extend_tenant','select (public.admin_extend_tenant($1,1,$2::timestamptz)).id as id',[tenant,revokedExtendExpiry]]
    ]) await scenario('revoked RPC ' + label, async () => {
        const r = await h.as(c, claims(), sql, args);
        check('revoked session denied by ' + label, isRevoked(r), r);
    });
    for (const table of ['tenants','tenant_members','tenant_invites','member_reset_codes','member_devices']) await scenario('revoked RLS '+table, async () => {
        const r = await h.as(c, claims(), 'select * from public.'+table);
        check('revoked session denied through '+table+' admin RLS', isRevoked(r), r);
    });
    await scenario('preserved contracts', async () => {
        await c.query("insert into public.tenant_invites (code_hash,tenant_id,role,max_uses,expires_at) values (repeat('c',64),$1,'member',1,now()+interval '1 day')", [tenant]);
        const r = await h.as(c, {role:'service_role',extra:{}}, "select public.invite_is_usable(repeat('c',64)) as usable");
        check('service-only invite maintenance works without human session', r.rows?.[0]?.usable === true, r);
        const denied = await h.as(c, claims(), 'select public.revoke_user_sessions($1)', [other]);
        check('authenticated role gains no access to backend session revoke', denied.error?.code === '42501', denied);
        const helperDenied = await h.as(c, {role:'service_role',extra:{}}, 'select private.is_platform_admin()');
        check('service_role gains no execute access to human admin helper', helperDenied.error?.code === '42501', helperDenied);
        await c.query('insert into public.platform_admins (user_id) values ($1)', [other]);
        check('trusted database bootstrap insert still works', (await c.query('select exists(select 1 from public.platform_admins where user_id=$1) as yes',[other])).rows[0].yes);
        const rawHuman = await h.as(c, {role:'authenticated',sub:other,extra:{}}, 'select private.is_platform_admin() as allowed');
        check('bootstrap membership alone cannot replace human session', isRevoked(rawHuman), rawHuman);
        check('all existing function owners flags search paths and ACLs preserved', JSON.stringify(beforeAcl) === JSON.stringify(await aclSnapshot()));
    });
    await scenario('restore and temporal bounds', async () => {
        await session();
        check('fresh login session restores authorization after revoke', (await helper()).rows?.[0]?.allowed === true);
        await authAdmin.query('alter table auth.sessions add column not_after timestamptz');
        check('modern sessions with null not_after remain active', (await helper()).rows?.[0]?.allowed === true);
        await session(sid,uid,new Date(Date.now()+3600000).toISOString());
        check('modern sessions with future not_after remain active', (await helper()).rows?.[0]?.allowed === true);
        await session(sid,uid,new Date(Date.now()-1000).toISOString());
        check('expired auth session not_after denied before deletion', isRevoked(await helper()));
        await session(sid,uid,new Date(Date.now()+3600000).toISOString());
    });
    await scenario('visibility semantics', async () => {
        const tx = await h.connect('postgres',database);
        await tx.query('begin isolation level repeatable read');
        await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:uid,role:'authenticated',session_id:sid})]);
        await tx.query('set local role authenticated');
        const pre = await tx.query('select private.is_platform_admin() as allowed');
        await authAdmin.query('delete from auth.sessions where id=$1',[sid]);
        const during = await tx.query('select private.is_platform_admin() as allowed');
        check('already established repeatable-read snapshot may retain authorization', pre.rows[0].allowed && during.rows[0].allowed);
        await tx.query('commit');
        await tx.end();
        check('fresh statement after revocation denies same token', isRevoked(await helper()));
    });
}

const ceiling = setTimeout(() => { console.error('FAIL local PG ceiling exceeded'); h.stop(); process.exit(1); }, 90000);
main().catch(e => { check('harness setup',false,{message:e.message,code:e.code},'infrastructure'); }).finally(async () => {
    if (authAdmin) await authAdmin.end();
    if (c) await c.end();
    h.stop();
    clearTimeout(ceiling);
    const result = {mode:baseline?'baseline':'candidate',postgres:h.pgBin?.version,repo:root,candidate:baseline?null:candidate,migration,loaded,
        scope:'focused auth/admin schema; no generated rules, real Auth service, hosted service, browser or full migration chain',
        pass:cases.filter(x=>x.pass).length,fail:cases.filter(x=>!x.pass).length,
        skipped:0,infrastructureFailures:cases.filter(x=>x.kind==='infrastructure').length,cases};
    if (output) fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({mode:result.mode,pass:result.pass,fail:result.fail,skipped:result.skipped,infrastructureFailures:result.infrastructureFailures}));
    process.exitCode = cases.length > 0 && result.fail === 0 ? 0 : 1;
});
