'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.SUPABASE_ACCOUNT_SESSION_APP_DIR ? path.resolve(process.env.SUPABASE_ACCOUNT_SESSION_APP_DIR) : path.resolve(__dirname, '..');
const baseline = process.env.SUPABASE_ACCOUNT_SESSION_BASELINE === '1';
const { createPgHarness } = require(path.join(root, 'audit-tools/supabase-pg'));
const h = createPgHarness({ depsDirs: [path.join(root, 'supabase/node_modules')], shimDir: path.join(root, 'audit-tools/supabase-shim'), wantMajor: 17, unixSockets: false });
const uid = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const sid = '20000000-0000-4000-8000-000000000001';
const tenant = '30000000-0000-4000-8000-000000000001';
let c, authAdmin;
let failures = 0;
let passes = 0;
let infrastructureFailures = 0;
const sql = name => fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');
async function check(label, fn) {
    try { await fn(); passes++; console.log('PASS ' + label); }
    catch (e) { failures++; console.error('FAIL ' + label + ': ' + e.message); }
}
const claims = extra => ({ role: 'authenticated', sub: uid, extra: { session_id: sid, exp: Math.floor(Date.now()/1000)+3600, ...extra } });
const account = extra => h.as(c, claims(extra), 'select * from public.my_account()');
const denied = async extra => { const r = await account(extra); assert.equal(r.error?.code, 'PT401'); assert.equal(r.error?.message, 'session-revoked'); };
async function main() {
    if (h.unavailableReason()) throw new Error(h.unavailableReason());
    await h.start();
    const db = await h.freshDb('no-default-grants'); c = db.c;
    authAdmin = await h.connect('supabase_auth_admin', db.name);
    await c.query(sql('20260930120000_zoe_tenancy.sql'));
    // ផ្ទុក wrapper ពិត ដោយមិនទាមទារ datastore ដែលមិនពាក់ព័ន្ធ។
    const move = sql('20261002000100_zoe_definer_private.sql')
        .replace(/,\s*'zoe_write\(text, jsonb\)'/, '')
        .replace(/create or replace function public\.zoe_write\([\s\S]*?\$\$;\s*/, '')
        .replace(/,\s*private\.zoe_write\(text, jsonb\)/g, '')
        .replace(/,\s*public\.zoe_write\(text, jsonb\)/g, '');
    assert.equal(/zoe_write/.test(move), false);
    await c.query(move);
    await authAdmin.query('alter table auth.sessions add column not_after timestamptz');
    await c.query('insert into auth.users (id,email) values ($1,$2),($3,$4)', [uid,'member@example.invalid',other,'other@example.invalid']);
    await c.query("insert into public.tenants (id,name,branch_code,expires_at) values ($1,'local','881859',now()+interval '30 days')", [tenant]);
    await c.query("insert into public.tenant_members (user_id,tenant_id,username,role) values ($1,$2,'member','member')", [uid,tenant]);
    await authAdmin.query('insert into auth.sessions (id,user_id) values ($1,$2)', [sid,uid]);
    const aclSql = "select n.nspname,p.proacl::text,p.proowner,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='my_account' order by n.nspname";
    const before = (await c.query(aclSql)).rows;
    if (!baseline) {
        const migrations = fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>n.endsWith('_zoe_account_active_session.sql'));
        assert.equal(migrations.length, 1);
        await c.query(sql(migrations[0]));
    }
    await check('active session returns tenant and branch', async()=> { const r=await account(); assert.equal(r.rows?.[0]?.tenant_id,tenant); assert.equal(r.rows[0].branch_code,'881859'); assert.equal(r.rows[0].status,'active'); });
    await check('function owner, definer and grants preserved', async()=>assert.deepEqual((await c.query(aclSql)).rows,before));
    for(const [label,value] of [['missing',undefined],['null',null],['empty',''],['malformed','not-a-uuid'],['object',{}],['absent row','20000000-0000-4000-8000-000000000099']]) {
        await check(label+' session fails closed',()=>denied({session_id:value}));
    }
    await authAdmin.query('update auth.sessions set user_id=$1 where id=$2',[other,sid]);
    await check('wrong owner fails closed',()=>denied());
    await authAdmin.query("update auth.sessions set user_id=$1,not_after=now()-interval '1 second' where id=$2",[uid,sid]);
    await check('expired session fails closed',()=>denied());
    await authAdmin.query('update auth.sessions set not_after=null where id=$1',[sid]);
    await authAdmin.query("update auth.sessions set not_after=now()+interval '1 day' where id=$1",[sid]);
    await check('future session expiry remains authorized',async()=>assert.equal((await account()).rows?.[0]?.status,'active'));
    await check('missing uid fails closed',async()=>assert.equal((await h.as(c,{role:'authenticated',extra:{session_id:sid}},'select * from public.my_account()')).error?.code,'PT401'));
    await check('malformed uid fails closed',async()=>assert.equal((await h.as(c,{role:'authenticated',sub:'invalid',extra:{session_id:sid}},'select * from public.my_account()')).error?.code,'PT401'));
    await check('anonymous role retains no execute privilege',async()=>assert.equal((await h.as(c,{role:'anon',extra:{}},'select * from public.my_account()')).error?.code,'42501'));
    await c.query('update public.tenants set revoked=true where id=$1',[tenant]);
    await check('revoked tenant still returns status for active session',async()=>assert.equal((await account()).rows?.[0]?.status,'revoked'));
    await c.query("update public.tenants set revoked=false,expires_at=now()-interval '1 second' where id=$1",[tenant]);
    await check('expired tenant still returns status for active session',async()=>assert.equal((await account()).rows?.[0]?.status,'expired'));
    await c.query("update public.tenants set expires_at=now()+interval '1 day' where id=$1",[tenant]);
    await check('warm precondition authorized',async()=>assert.equal((await account()).rows?.[0]?.status,'active'));
    await authAdmin.query('delete from auth.sessions where id=$1',[sid]);
    await check('same old JWT rejected immediately after revocation',()=>denied());
    await check('repeated old JWT rejected without prior active result',()=>denied());
}
main().catch(e => { infrastructureFailures++; console.error(e.message); }).finally(async () => {
    try {
        if (authAdmin) await authAdmin.end();
        if (c) await c.end();
    } catch (e) {
        infrastructureFailures++;
        console.error(e.message);
    } finally {
        h.stop();
    }
    console.log(JSON.stringify({ mode: baseline ? 'baseline' : 'candidate', pass: passes, fail: failures, skipped: 0, infrastructureFailures }));
    process.exitCode = passes > 0 && failures === 0 && infrastructureFailures === 0 ? 0 : 1;
});
