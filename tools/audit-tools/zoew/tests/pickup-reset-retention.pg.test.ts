import { afterAll, beforeAll, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { pickupResetAttemptId, pickupResetBatchHash, pickupResetCasText } from '../../../../ZoeW/src/domain/pickup-reset-proof';

const root = path.resolve(__dirname, '../../../..');
const require = createRequire(import.meta.url);
const { createPgHarness } = require('../../supabase-pg.js');
const harness = createPgHarness({ depsDirs: [path.join(root, 'supabase/node_modules')],
    shimDir: path.join(root, 'tools/audit-tools/supabase-shim'), wantMajor: 17 });
const day = '2026-11-01', pickup = 'zoew_daily_pickup_cod_dod';
let connection: any;
let serial = 0;

beforeAll(async () => {
    const unavailable = harness.unavailableReason();
    if (unavailable) throw new Error(unavailable);
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    await harness.start();
    connection = (await harness.freshDb()).c;
    const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();
    for (const name of migrations) await connection.query(fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8'));
}, 60000);

afterAll(async () => {
    if (connection) await connection.end();
    await harness.stop();
});

async function fixture() {
    const number = ++serial;
    const actor = await harness.makeAuthUser(connection, 'reset-retention-' + number + '@u.zoe.test');
    const tenant = (await connection.query("insert into public.tenants(name,branch_code,expires_at) values($1,$2,now()+interval '30 days') returning id",
        ['reset retention ' + number, 'retain_' + number])).rows[0].id;
    await connection.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [actor, tenant, 'retain_' + number]);
    const who = await harness.sessionClaims(connection, { role: 'authenticated', sub: actor });
    const value = { pickupRevision: 5, pickupResetEpoch: 2, packagesPickedUp: 1, pickedUpPhones: { PHONE: 1 }, pickedUpBarcodes: { CODE: 'PHONE' } };
    await connection.query('insert into public.zoe_docs(tenant_id,root,key,value,seq) values($1,$2,$3,$4,1)', [tenant, pickup, day, value]);
    const scope = 'https://retention.invalid#' + tenant, batchId = 'retention-batch-' + number;
    const context = { v: 1, scope, batchId, batchHash: await pickupResetBatchHash(tenant, scope, actor, batchId, [day]),
        dayId: batchId + ':' + day, day, nonce: 'retention-nonce-' + number };
    const casText = pickupResetCasText(day, value,
        { pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0, pickedUpPhones: null, pickedUpBarcodes: null });
    const attemptId = await pickupResetAttemptId(tenant, actor, context, casText);
    return { actor, tenant, who, context, casText, attemptId };
}

async function call(kind: 'execute' | 'status', request: Awaited<ReturnType<typeof fixture>>, actor = request.who) {
    const result = await harness.as(connection, actor, 'select public.zoe_pickup_reset_' + kind + '_v1($1,$2,$3::jsonb,$4) as value',
        [request.tenant, request.attemptId, JSON.stringify(request.context), request.casText]);
    return result.rows ? result.rows[0].value : result;
}

async function ageAndCollect(request: Awaited<ReturnType<typeof fixture>>) {
    await connection.query("update public.zoe_ops set created_at=now()-interval '3 days' where tenant_id=$1", [request.tenant]);
    await connection.query('select private.zoe_housekeeping($1)', [request.tenant]);
}

async function snapshot(tenant: string) {
    return (await connection.query(`select jsonb_build_object(
        'state',(select to_jsonb(s) from public.zoe_tenant_state s where s.tenant_id=$1),
        'docs',(select coalesce(jsonb_agg(to_jsonb(d) order by root,key),'[]') from public.zoe_docs d where d.tenant_id=$1),
        'ops',(select coalesce(jsonb_agg(to_jsonb(o) order by op_id),'[]') from public.zoe_ops o where o.tenant_id=$1)) as value`, [tenant])).rows[0].value;
}

it('Reset ៖ housekeeping រក្សា original typed receipt ហើយ status/replay មិន Reset pickup ថ្មីម្ដងទៀត', async () => {
    const request = await fixture(), applied = await call('execute', request);
    expect(applied.ok).toBe(true); expect(applied.reset.outcome).toBe('applied');
    const newer = { pickupRevision: 7, pickupResetEpoch: 3, packagesPickedUp: 1, pickedUpPhones: { AFTER: 1 }, pickedUpBarcodes: { AFTER: 'AFTER' } };
    await connection.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4', [newer, request.tenant, pickup, day]);
    await ageAndCollect(request);
    const before = await snapshot(request.tenant);
    expect(before.ops.map((row: any) => row.op_id)).toContain(request.attemptId);
    expect((await call('status', request)).reset).toEqual(applied.reset);
    expect(await call('execute', request)).toMatchObject({ ok: true, replayed: true, docs: [], reset: applied.reset });
    expect(await snapshot(request.tenant)).toEqual(before);
});

it('Reset ៖ receipt រក្សាយូរនៅគិត quota ហើយ housekeeping នៅលុប ordinary receipt ដូចមុន', async () => {
    const request = await fixture(), applied = await call('execute', request);
    expect(applied.ok).toBe(true);
    const ordinaryId = 'ordinary_receipt_' + serial;
    await connection.query('insert into public.zoe_ops(tenant_id,op_id,result) values($1,$2,$3)', [request.tenant, ordinaryId, { ok: true }]);
    await connection.query('update public.zoe_tenant_state set bytes=bytes+private.zoe_op_bytes($2,$3) where tenant_id=$1',
        [request.tenant, ordinaryId, { ok: true }]);
    await ageAndCollect(request);
    const rows = (await snapshot(request.tenant)).ops;
    expect(rows.map((row: any) => row.op_id)).toEqual([request.attemptId]);
    const counted = (await connection.query(`select s.bytes::text as charged,
        (coalesce((select sum(private.zoe_doc_bytes(d.root,d.key,d.value)) from public.zoe_docs d where d.tenant_id=$1),0)
        +coalesce((select sum(private.zoe_op_bytes(o.op_id,o.result)) from public.zoe_ops o where o.tenant_id=$1),0))::text as actual
        from public.zoe_tenant_state s where s.tenant_id=$1`, [request.tenant])).rows[0];
    expect(counted.charged).toBe(counted.actual);
});

it.each(['tenant', 'attempt', 'proof', 'shape'])('Reset ៖ receipt %s ខុសមិនអាចរារាំង housekeeping', async fault => {
    const request = await fixture(), applied = await call('execute', request);
    expect(applied.ok).toBe(true);
    const malformed = structuredClone(applied);
    if (fault === 'tenant') malformed.reset.tenant = '00000000-0000-0000-0000-000000000000';
    if (fault === 'attempt') malformed.reset.attemptId = malformed.reset.intentHash = 'f'.repeat(64);
    if (fault === 'proof') malformed.reset.proof = 'native-day';
    if (fault === 'shape') malformed.reset.extra = true;
    await connection.query('update public.zoe_ops set result=$1 where tenant_id=$2 and op_id=$3', [malformed, request.tenant, request.attemptId]);
    await ageAndCollect(request);
    expect((await snapshot(request.tenant)).ops).toEqual([]);
    expect((await call('status', request)).reset).toMatchObject({ outcome: 'unknown', proof: 'none' });
});

it('Reset ៖ proof SQL ដែលបាត់ពិតនៅ UNKNOWN ទោះ native-day mirror ដូចគ្នា', async () => {
    const request = await fixture(), applied = await call('execute', request);
    expect(applied.ok).toBe(true);
    await connection.query('delete from public.zoe_ops where tenant_id=$1 and op_id=$2', [request.tenant, request.attemptId]);
    await connection.query("update public.zoe_docs set value=value||jsonb_build_object('pickupResetApplied',$1::jsonb) where tenant_id=$2 and root=$3 and key=$4",
        [{ ...applied.reset, proof: 'native-day' }, request.tenant, pickup, day]);
    const before = await snapshot(request.tenant);
    expect((await call('status', request)).reset).toMatchObject({ outcome: 'unknown', proof: 'none' });
    expect(await snapshot(request.tenant)).toEqual(before);
});
