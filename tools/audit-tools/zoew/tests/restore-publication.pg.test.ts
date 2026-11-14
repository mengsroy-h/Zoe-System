import { afterAll, beforeAll, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(__dirname, '../../../..');
const require = createRequire(import.meta.url);
const { createPgHarness } = require(root + '/tools/audit-tools/supabase-pg.js');
const { legacyRestoreVector } = require(root + '/tools/audit-tools/zto-restore-attestation-cases.cjs');
const PG = createPgHarness({ depsDirs: [root + '/supabase/node_modules'], shimDir: root + '/tools/audit-tools/supabase-shim', wantMajor: 17 });
const trash = 'zoew_recently_deleted_cod_dod';
let c: any, serial = 0;

beforeAll(async () => {
    await PG.start(); c = (await PG.freshDb('default-grants')).c;
    for (const file of fs.readdirSync(root + '/supabase/migrations').filter(name => name.endsWith('.sql')).sort())
        await c.query(fs.readFileSync(root + '/supabase/migrations/' + file, 'utf8'));
}, 30000);
afterAll(async () => { if (c) await c.end(); await PG.stop(); });

async function fixture(publication?: unknown) {
    const id = 'publication_' + (++serial), tenant = (await c.query("insert into public.tenants(name,branch_code,expires_at) values($1,$1,now()+interval'1 day') returning id", [id])).rows[0].id;
    const uid = await PG.makeAuthUser(c, id + '@users.zoew.invalid');
    await c.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [uid, tenant, id]);
    const who = await PG.sessionClaims(c, { role: 'authenticated', sub: uid });
    const vector = legacyRestoreVector('local', id, uid);
    const source = publication === undefined ? vector.source : { ...vector.source, restorePublication: publication };
    const write = (updates: any, admin = false) => PG.as(c, admin ? { role: 'service_role' } : who,
        admin ? 'select public.zoe_admin_write($1,$2,$3::jsonb) as r' : 'select public.zoe_write_v2($1,$2,$3::jsonb) as r',
        [tenant, 'publication_op_' + (++serial), JSON.stringify(Object.entries(updates).map(([key, value]) => ({ k: 'set', p: key.split('/'), v: value })))]);
    const read = async () => (await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, trash, id])).rows[0]?.value ?? null;
    const effects = async () => ({
        docs: (await c.query('select root,key,value,seq,updated_at from public.zoe_docs where tenant_id=$1 order by root,key', [tenant])).rows,
        state: (await c.query('select seq,bytes from public.zoe_tenant_state where tenant_id=$1', [tenant])).rows,
        ops: (await c.query('select op_id,result from public.zoe_ops where tenant_id=$1 order by op_id', [tenant])).rows,
        audit: (await c.query('select event_id,operation_id from public.zoe_business_audit where tenant_id=$1 order by event_id', [tenant])).rows
    });
    expect((await write({ 'zoew_restore_policy/shop': { v: 1, mode: 'local', scope: 'qa_restore_attestation', branch: '', epoch: 1 },
        [trash + '/' + id]: source }, true)).error).toBeUndefined();
    return { tenant, id, vector, source, write, read, effects };
}

it('ordinary creation cannot inject a publication counter; a legacy absent-counter source remains valid', async () => {
    const f = await fixture(), source = await f.read(), target = 'new_publication_source';
    const before = await f.effects();
    for (const counter of [1, 0, 0.5, -1, '1', true, 9007199254740991]) {
        const result = await f.write({ [trash + '/' + target]: { ...source, id: target, restorePublication: counter } });
        expect(result.error?.code).toBe('42501'); expect(await f.effects()).toEqual(before);
    }
    expect((await f.write({ [trash + '/' + target]: { ...source, id: target } })).error).toBeUndefined();
});

it('a trusted publication cannot be cleared through a leaf delete or a whole-record replacement', async () => {
    for (const wholeRecord of [false, true]) {
        const f = await fixture(1), before = await f.effects(), source = await f.read();
        delete source.restorePublication;
        const updates = wholeRecord ? { [trash + '/' + f.id]: source } : { [trash + '/' + f.id + '/restorePublication']: null };
        expect((await f.write(updates)).error?.code).toBe('42501');
        expect(await f.effects()).toEqual(before); expect((await f.read()).restorePublication).toBe(1);
    }
});

it('the committed pre-fence Rules reproduce the erased-counter effect and the canonical function is restored', async () => {
    const f = await fixture(1);
    const current = (await c.query("select pg_get_functiondef('private.zoe_rules()'::regprocedure) definition,private.zoe_rules() tree")).rows[0];
    try {
        // Only this test's fresh local database changes; no source migration is edited.
        await c.query(fs.readFileSync(root + '/supabase/migrations/20261114161533_zoe_rules.sql', 'utf8'));
        expect((await f.read()).restorePublication).toBe(1);
        const result = await f.write({ [trash + '/' + f.id + '/restorePublication']: null });
        expect(result.error).toBeUndefined(); expect(result.rows[0].r.ok).toBe(true);
        expect((await f.read()).restorePublication).toBeUndefined();
    } finally {
        await c.query(current.definition);
    }
    expect((await c.query('select private.zoe_rules() tree')).rows[0].tree).toEqual(current.tree);
});

it('clients cannot change the trusted counter or replace it with malformed values', async () => {
    const f = await fixture(1), before = await f.effects();
    for (const counter of [2, 0, -1, 0.5, '1', true, 9007199254740991]) {
        expect((await f.write({ [trash + '/' + f.id + '/restorePublication']: counter })).error?.code).toBe('42501');
        expect(await f.effects()).toEqual(before);
    }
});

it('normal legacy and published-row edits preserve the counter, including the safe-integer upper boundary', async () => {
    for (const counter of [undefined, 1, 9007199254740990]) {
        const f = await fixture(counter);
        expect((await f.write({ [trash + '/' + f.id + '/phone']: '012111111' })).error).toBeUndefined();
        const source = await f.read(); source.phone = '012222222';
        expect((await f.write({ [trash + '/' + f.id]: source })).error).toBeUndefined();
        expect((await f.read()).restorePublication).toBe(counter);
    }
});

it('a malformed privileged counter cannot be propagated through an otherwise valid whole-row edit', async () => {
    for (const counter of [0, -1, 0.5, '1', true, 9007199254740991]) {
        const f = await fixture(counter), before = await f.effects(), source = await f.read();
        source.phone = '012333333';
        expect((await f.write({ [trash + '/' + f.id]: source })).error?.code).toBe('42501');
        expect(await f.effects()).toEqual(before);
    }
});

it('a local restore consumes a published source once without copying the server fence into history', async () => {
    const f = await fixture(1), vector = f.vector;
    expect((await f.write({ [trash + '/' + f.id + '/restoreClaim']: vector.claim })).error).toBeUndefined();
    expect((await f.write({ ['zoew_scan_history_cod_dod/' + vector.claim.targetId]: vector.prepared })).error).toBeUndefined();
    expect((await f.read()).restorePublication).toBe(1);
    expect((await f.write(vector.finalPacket)).rows?.[0]?.r?.ok).toBe(true); expect(await f.read()).toBeNull();
    const rows = (await c.query("select root,value from public.zoe_docs where tenant_id=$1 and root in('zoew_daily_revenue_cod_dod','zoew_monthly_revenue_cod_dod','zoew_scan_history_cod_dod','zoew_trash_consumptions') order by root", [f.tenant])).rows;
    expect(rows).toHaveLength(4);
    for (const row of rows.filter((entry: any) => entry.root.includes('revenue'))) expect(row.value).toEqual(vector.money);
    expect(rows.find((entry: any) => entry.root === 'zoew_scan_history_cod_dod').value.restorePublication).toBeUndefined();
    expect(rows.find((entry: any) => entry.root === 'zoew_trash_consumptions').value).toMatchObject(vector.consumption);
});
