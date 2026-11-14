import { afterAll, beforeAll, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(__dirname, '../../../..');
const require = createRequire(import.meta.url);
const { createPgHarness } = require(ROOT + '/tools/audit-tools/supabase-pg.js');
const PG = createPgHarness({ depsDirs: [ROOT + '/supabase/node_modules'], shimDir: ROOT + '/tools/audit-tools/supabase-shim', wantMajor: 17 });
let c: any, uid: string, other: string, tenant: string, session: string, foreign: string;
let counter = 0;

beforeAll(async () => {
    if (PG.unavailableReason()) throw new Error(PG.unavailableReason());
    await PG.start();
    c = (await PG.freshDb('no-default-grants')).c;
    for (const file of fs.readdirSync(ROOT + '/supabase/migrations').filter(n => n.endsWith('.sql')).sort()) {
        await c.query(fs.readFileSync(ROOT + '/supabase/migrations/' + file, 'utf8'));
    }
    await c.query('alter table auth.sessions add column if not exists not_after timestamptz');
    tenant = (await c.query("insert into public.tenants(name,branch_code,expires_at) values('session-policy','000002',now()+interval '1 day') returning id")).rows[0].id;
    uid = await PG.makeAuthUser(c, 'data-session@users.zoew.invalid');
    other = await PG.makeAuthUser(c, 'data-session-other@users.zoew.invalid');
    await c.query("insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,'data_session')", [uid, tenant]);
    session = (await c.query('insert into auth.sessions(id,user_id,created_at) values(gen_random_uuid(),$1,now()) returning id', [uid])).rows[0].id;
    foreign = (await c.query('insert into auth.sessions(id,user_id,created_at) values(gen_random_uuid(),$1,now()) returning id', [other])).rows[0].id;
}, 30000);

afterAll(async () => { if (c) await c.end(); PG.stop(); });

const claims = (sessionId: any) => ({ role: 'authenticated', sub: uid, extra: sessionId === undefined ? {} : { session_id: sessionId } });
const queries = () => [
    ['select public.zoe_read($1,null)', ['zoew_settings']],
    ['select public.zoe_pull(0,10)', []],
    ['select public.zoe_write_v2($1,$2,$3::jsonb)', [tenant, 'session_policy_' + String(++counter).padStart(12, '0'), JSON.stringify([{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }])]],
    ['select value from public.zoe_docs limit 1', []]
] as const;
const assertDenied = async (sessionId: any) => {
    const before = (await c.query('select root,key,value,seq from public.zoe_docs where tenant_id=$1 order by root,key', [tenant])).rows;
    for (const [query, args] of queries()) {
        const result = await PG.as(c, claims(sessionId), query, args);
        expect(result.error, query).toMatchObject({ code: 'PT401', message: 'session-revoked' });
    }
    expect((await c.query('select root,key,value,seq from public.zoe_docs where tenant_id=$1 order by root,key', [tenant])).rows).toEqual(before);
};

it('វគ្គរស់របស់គណនីអនុញ្ញាត read/pull/write/RLS', async () => {
    for (const [query, args] of queries()) expect((await PG.as(c, claims(session), query, args)).error, query).toBeUndefined();
});
for (const [label, sid] of [['បាត់', undefined], ['null', null], ['ទទេ', ''], ['ខុសទ្រង់ទ្រាយ', 'not-a-session'], ['object', {}], ['មិនមានក្នុង DB', '20000000-0000-4000-8000-000000000099']] as const) {
    it('វគ្គ ' + label + ' មិនអាចអាន ឬសរសេរទិន្នន័យ', () => assertDenied(sid));
}
it('session របស់គណនីផ្សេង មិនអាចប្រើជំនួស session ដែលដក', () => assertDenied(foreign));
it('session ផុត not_after ត្រូវបដិសេធភ្លាមទោះ JWT នៅរស់', async () => {
    await c.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1", [session]);
    await assertDenied(session);
    await c.query("update auth.sessions set not_after=now()+interval '1 day' where id=$1", [session]);
    for (const [query, args] of queries()) expect((await PG.as(c, claims(session), query, args)).error, query).toBeUndefined();
});

it('independent review ៖ SECURITY DEFINER បិទ search_path ហើយរក្សា ACL authenticated និងបដិសេធ anon/PUBLIC', async () => {
    const definition = (await c.query("select p.prosecdef,p.provolatile,p.proconfig from pg_proc p where p.oid='private.current_tenant_id()'::regprocedure")).rows[0];
    expect(definition).toMatchObject({ prosecdef: true, provolatile: 's' });
    expect(definition.proconfig).toContain('search_path=""');
    const grants = (await c.query("select has_function_privilege('authenticated','private.current_tenant_id()','EXECUTE') as member,has_function_privilege('anon','private.current_tenant_id()','EXECUTE') as anon,exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='private.current_tenant_id()'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE') as public_access")).rows[0];
    expect(grants).toEqual({ member: true, anon: false, public_access: false });
});

it.each([undefined, '', 'not-a-uuid', {}])('independent review ៖ UID %j មិនអាចខ្ចី SID របស់គណនីរស់', async sub => {
    const result = await PG.as(c, { role: 'authenticated', extra: { session_id: session, ...(sub === undefined ? {} : { sub }) } }, 'select private.current_tenant_id()');
    expect(result.error).toMatchObject({ code: 'PT401', message: 'session-revoked' });
});

it('independent review ៖ session រស់ ប៉ុន្តែគ្មាន membership មិនបង្កើត tenant scope', async () => {
    const result = await PG.as(c, { role: 'authenticated', sub: other, extra: { session_id: foreign } }, 'select private.current_tenant_id() as tenant');
    expect(result.error).toBeUndefined(); expect(result.rows).toEqual([{ tenant: null }]);
    const read = await PG.as(c, { role: 'authenticated', sub: other, extra: { session_id: foreign } }, 'select public.zoe_read($1,null)', ['zoew_settings']);
    expect(read.error).toMatchObject({ code: '42501', message: 'forbidden' });
});

it.each(['expired', 'revoked'])('independent review ៖ tenant %s ផ្អាក scope ទោះ session នៅរស់', async kind => {
    try {
        await c.query(kind === 'expired' ? "update public.tenants set expires_at=now()-interval '1 second' where id=$1" : 'update public.tenants set revoked=true where id=$1', [tenant]);
        const scope = await PG.as(c, claims(session), 'select private.current_tenant_id() as tenant');
        expect(scope.error).toBeUndefined(); expect(scope.rows).toEqual([{ tenant: null }]);
        const read = await PG.as(c, claims(session), 'select public.zoe_read($1,null)', ['zoew_settings']);
        expect(read.error).toMatchObject({ code: '42501', message: 'forbidden' });
    } finally {
        await c.query("update public.tenants set expires_at=now()+interval '1 day',revoked=false where id=$1", [tenant]);
    }
});

it('independent review ៖ tenant claim ក្នុង metadata មិនឈ្នះ membership ហើយ RLS លាក់សាខាផ្សេង', async () => {
    const elsewhere = (await c.query("insert into public.tenants(name,branch_code,expires_at) values('independent-other','000003',now()+interval '1 day') returning id")).rows[0].id;
    await c.query("insert into public.zoe_docs(tenant_id,root,key,value,seq) values($1,'zoew_settings','exchange_rate','4200',1)", [elsewhere]);
    const who = { ...claims(session), extra: { ...claims(session).extra, tenant_id: elsewhere, user_metadata: { tenant_id: elsewhere }, app_metadata: { tenant_id: elsewhere } } };
    const scope = await PG.as(c, who, 'select private.current_tenant_id() as tenant');
    expect(scope.error).toBeUndefined(); expect(scope.rows).toEqual([{ tenant }]);
    const direct = await PG.as(c, who, 'select value from public.zoe_docs where tenant_id=$1', [elsewhere]);
    expect(direct.error).toBeUndefined(); expect(direct.rows).toEqual([]);
});

it('session ដែលដក មិនអាចអាន ឬសរសេរជាមួយ JWT ចាស់', async () => {
    await c.query('delete from auth.sessions where id=$1', [session]);
    await assertDenied(session);
});
