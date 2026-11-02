'use strict';
process.exitCode = 1;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { isDeepStrictEqual } = require('util');
const ROOT = process.env.SUPABASE_RESET_APP_DIR ? path.resolve(process.env.SUPABASE_RESET_APP_DIR) : path.join(__dirname, '..');
const MIGRATION = '20261101151500_zoe_pickup_reset_applied.sql';
const BASELINE = process.env.SUPABASE_RESET_BASELINE === '1';
const SHARED_VECTORS = [{"name":"legacy-ascii","tenant":"demo-f09","actorUid":"owner","dates":["2026-10-30"],"context":{"v":1,"scope":"https://f09.invalid","batchId":"batch-a","batchHash":"ced74c01c77bcdb25de6ff8f3f3b315cd7b55339540a1382bc84760cad8227e9","dayId":"batch-a:2026-10-30","day":"2026-10-30","nonce":"nonce-original"},"casText":"{\"k\":\"cas\",\"p\":[\"zoew_daily_pickup_cod_dod\",\"2026-10-30\"],\"x\":null,\"v\":{\"pickupRevision\":1,\"pickupResetEpoch\":1,\"packagesPickedUp\":0,\"pickedUpPhones\":null,\"pickedUpBarcodes\":null}}","batchPreimage":"[\"zoew-pickup-reset-batch-v1\",1,\"demo-f09\",\"https://f09.invalid\",\"owner\",\"batch-a\",[\"2026-10-30\"]]","batchHash":"ced74c01c77bcdb25de6ff8f3f3b315cd7b55339540a1382bc84760cad8227e9","attemptPreimage":"[\"zoew-pickup-reset-attempt-v1\",1,\"demo-f09\",\"owner\",\"https://f09.invalid\",\"batch-a\",\"ced74c01c77bcdb25de6ff8f3f3b315cd7b55339540a1382bc84760cad8227e9\",\"batch-a:2026-10-30\",\"2026-10-30\",\"nonce-original\",\"{\\\"k\\\":\\\"cas\\\",\\\"p\\\":[\\\"zoew_daily_pickup_cod_dod\\\",\\\"2026-10-30\\\"],\\\"x\\\":null,\\\"v\\\":{\\\"pickupRevision\\\":1,\\\"pickupResetEpoch\\\":1,\\\"packagesPickedUp\\\":0,\\\"pickedUpPhones\\\":null,\\\"pickedUpBarcodes\\\":null}}\"]","attemptId":"b9da1664a37f020c6fc2b841a54b0fe4428819c59a848d6ae5ba84bfd8b0985f"},{"name":"unicode-escaped","tenant":"tenant-uuid","actorUid":"owner \\\"\t\ud83d\ude00","dates":["2026-10-29","2026-10-30"],"context":{"v":1,"scope":"https://\u4f8b\u3048.invalid/\u5e97\\\n","batchId":"batch-b","batchHash":"0455236daeb826dbb353ac041bc189e97957a17f445dafb5875aca8006fcd4d7","dayId":"batch-b:2026-10-30","day":"2026-10-30","nonce":"nonce-original"},"casText":"{\"k\":\"cas\",\"p\":[\"zoew_daily_pickup_cod_dod\",\"2026-10-30\"],\"x\":{\"pickupRevision\":3,\"pickupResetEpoch\":1,\"packagesPickedUp\":1,\"pickedUpBarcodes\":{\"STRASSE\ud83d\ude00\":\"0001\"}},\"v\":{\"pickupRevision\":4,\"pickupResetEpoch\":2,\"packagesPickedUp\":0,\"pickedUpPhones\":null,\"pickedUpBarcodes\":null}}","batchPreimage":"[\"zoew-pickup-reset-batch-v1\",1,\"tenant-uuid\",\"https://\u4f8b\u3048.invalid/\u5e97\\\\\\n\",\"owner \\\\\\\"\\t\ud83d\ude00\",\"batch-b\",[\"2026-10-29\",\"2026-10-30\"]]","batchHash":"0455236daeb826dbb353ac041bc189e97957a17f445dafb5875aca8006fcd4d7","attemptPreimage":"[\"zoew-pickup-reset-attempt-v1\",1,\"tenant-uuid\",\"owner \\\\\\\"\\t\ud83d\ude00\",\"https://\u4f8b\u3048.invalid/\u5e97\\\\\\n\",\"batch-b\",\"0455236daeb826dbb353ac041bc189e97957a17f445dafb5875aca8006fcd4d7\",\"batch-b:2026-10-30\",\"2026-10-30\",\"nonce-original\",\"{\\\"k\\\":\\\"cas\\\",\\\"p\\\":[\\\"zoew_daily_pickup_cod_dod\\\",\\\"2026-10-30\\\"],\\\"x\\\":{\\\"pickupRevision\\\":3,\\\"pickupResetEpoch\\\":1,\\\"packagesPickedUp\\\":1,\\\"pickedUpBarcodes\\\":{\\\"STRASSE\ud83d\ude00\\\":\\\"0001\\\"}},\\\"v\\\":{\\\"pickupRevision\\\":4,\\\"pickupResetEpoch\\\":2,\\\"packagesPickedUp\\\":0,\\\"pickedUpPhones\\\":null,\\\"pickedUpBarcodes\\\":null}}\"]","attemptId":"1a88cdd6c7c0e0ec6e45ab4a2a9e8429c604e461e15cf67b6b8f0ad52844e46d"},{"name":"exact-cas-number-text","tenant":"tenant-uuid","actorUid":"owner","dates":["2026-10-30"],"context":{"v":1,"scope":"scope","batchId":"batch-c","batchHash":"d62eb4ea5b14d444a11ed2ace26bc22c7fd38c39327fc2599be82ac9889216de","dayId":"batch-c:2026-10-30","day":"2026-10-30","nonce":"nonce-original"},"casText":"{ \"k\":\"cas\", \"p\":[\"zoew_daily_pickup_cod_dod\",\"2026-10-30\"], \"x\":{\"pickupRevision\":3,\"pickupResetEpoch\":1,\"packagesPickedUp\":1.000,\"legacyRatio\":1e-7}, \"v\":{\"pickupRevision\":4,\"pickupResetEpoch\":2,\"packagesPickedUp\":0,\"pickedUpPhones\":null,\"pickedUpBarcodes\":null} }","batchPreimage":"[\"zoew-pickup-reset-batch-v1\",1,\"tenant-uuid\",\"scope\",\"owner\",\"batch-c\",[\"2026-10-30\"]]","batchHash":"d62eb4ea5b14d444a11ed2ace26bc22c7fd38c39327fc2599be82ac9889216de","attemptPreimage":"[\"zoew-pickup-reset-attempt-v1\",1,\"tenant-uuid\",\"owner\",\"scope\",\"batch-c\",\"d62eb4ea5b14d444a11ed2ace26bc22c7fd38c39327fc2599be82ac9889216de\",\"batch-c:2026-10-30\",\"2026-10-30\",\"nonce-original\",\"{ \\\"k\\\":\\\"cas\\\", \\\"p\\\":[\\\"zoew_daily_pickup_cod_dod\\\",\\\"2026-10-30\\\"], \\\"x\\\":{\\\"pickupRevision\\\":3,\\\"pickupResetEpoch\\\":1,\\\"packagesPickedUp\\\":1.000,\\\"legacyRatio\\\":1e-7}, \\\"v\\\":{\\\"pickupRevision\\\":4,\\\"pickupResetEpoch\\\":2,\\\"packagesPickedUp\\\":0,\\\"pickedUpPhones\\\":null,\\\"pickedUpBarcodes\\\":null} }\"]","attemptId":"a113402088e6a69f14e1dd3af0be959dc144bf838a565e60f44074cfcde736f6"}];
const { createPgHarness } = require('./supabase-pg.js');
const H = createPgHarness({ depsDirs: [path.join(ROOT, 'supabase/node_modules')], shimDir: path.join(__dirname, 'supabase-shim'), wantMajor: 17 });
const DAY = '2026-11-01', OTHER = '2026-10-31', PICKUP = 'zoew_daily_pickup_cod_dod';
let passed = 0, failed = 0, serial = 0;
const cases = [];
let catalogEvidence = null;
let codecEvidence = null;
const concurrencyEvidence = [];
const callCounts = { execute: 0, status: 0 };
const sha = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
function check(label, condition, detail) {
    cases.push({ label, pass: !!condition, kind: 'behavior' });
    if (condition) { passed++; console.log('  ok    ' + label); }
    else { failed++; console.log('  FAIL  ' + label + (detail === undefined ? '' : '\n        ' + JSON.stringify(detail).slice(0, 1100))); }
}
const prior = () => ({ pickupRevision: 5, pickupResetEpoch: 2, packagesPickedUp: 1, pickedUpPhones: { PHONE: 1 }, pickedUpBarcodes: { CODE: 'PHONE' } });
const cleared = value => ({ pickupRevision: (value?.pickupRevision || 0) + 1, pickupResetEpoch: (value?.pickupResetEpoch || 0) + 1,
    packagesPickedUp: 0, pickedUpPhones: null, pickedUpBarcodes: null });
function request(tenant, actorUid, basis = prior(), options = {}) {
    const batchId = options.batchId || 'reset_batch_' + (++serial);
    const scope = 'https://reset-fixture.invalid#' + tenant;
    const batchHash = sha(JSON.stringify(['zoew-pickup-reset-batch-v1', 1, tenant, scope, actorUid, batchId, [DAY, OTHER]]));
    const context = { v: 1, scope, batchId, batchHash, dayId: batchId + ':' + DAY, day: DAY, nonce: options.nonce || 'nonce_' + serial };
    const operation = { k: 'cas', p: [PICKUP, DAY], x: basis, v: cleared(basis) };
    const casText = options.casText || JSON.stringify(operation);
    const attemptId = sha(JSON.stringify(['zoew-pickup-reset-attempt-v1', 1, tenant, actorUid, context.scope,
        context.batchId, context.batchHash, context.dayId, context.day, context.nonce, casText]));
    return { tenant, actorUid, context, operation, casText, attemptId };
}
async function main() {
    if (H.unavailableReason()) throw new Error(H.unavailableReason());
    await H.start();
    const { c, name: dbName } = await H.freshDb('no-default-grants');
    try {
        const files = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();
        const catalog = async () => ({
            relations: (await c.query(`select n.nspname as schema,c.relname as name,c.relkind as kind,c.relrowsecurity as rls,
                c.relforcerowsecurity as forced_rls,c.relacl::text as acl,
                coalesce((select jsonb_agg(jsonb_build_array(a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull) order by a.attnum)
                    from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'[]'::jsonb) as columns,
                case when c.relkind in ('i','I') then pg_get_indexdef(c.oid) else null end as index_definition
                from pg_class c join pg_namespace n on n.oid=c.relnamespace
                where n.nspname not like 'pg_%' and n.nspname<>'information_schema' and c.relkind in ('r','p','m','S','i','I')
                order by n.nspname,c.relname`)).rows,
            engine: (await c.query(`select pg_get_functiondef('private.zoe_apply(uuid,text,jsonb,boolean,boolean)'::regprocedure) as wrapper,
                pg_get_functiondef('private.zoe_apply_engine_v1(uuid,text,jsonb,boolean,boolean,jsonb)'::regprocedure) as core`)).rows[0]
        });
        let beforeCatalog = null;
        for (const file of files) {
            if (file === MIGRATION) beforeCatalog = await catalog();
            if (!(BASELINE && file === MIGRATION)) await c.query(fs.readFileSync(path.join(ROOT, 'supabase/migrations', file), 'utf8'));
        }
        const uid = await H.makeAuthUser(c, 'reset-proof@u.zoe.test'), uidB = await H.makeAuthUser(c, 'reset-other@u.zoe.test');
        const ids = (await c.query("insert into public.tenants(name,branch_code,expires_at) values('reset A','reset_a',now()+interval '30 days'),('reset B','reset_b',now()+interval '30 days') returning id")).rows;
        const A = ids[0].id, B = ids[1].id, who = { role: 'authenticated', sub: uid };
        await c.query("insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,'reset_a'),($3,$4,'reset_b')", [uid, A, uidB, B]);
        const seed = async (value = prior()) => {
            for (const day of [DAY, OTHER]) await c.query(`insert into public.zoe_docs(tenant_id,root,key,value,seq) values($1,$2,$3,$4,1)
                on conflict(tenant_id,root,key) do update set value=excluded.value`, [A, PICKUP, day, value]);
        };
        const valueOf = async (tenant = A, day = DAY) => (await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, PICKUP, day])).rows[0]?.value;
        const snapshot = async (tenant = A) => (await c.query(`select jsonb_build_object('state',(select to_jsonb(s) from public.zoe_tenant_state s where tenant_id=$1),
            'docs',(select coalesce(jsonb_agg(to_jsonb(d) order by root,key),'[]') from public.zoe_docs d where tenant_id=$1),
            'ops',(select coalesce(jsonb_agg(to_jsonb(o) order by op_id),'[]') from public.zoe_ops o where tenant_id=$1)) as value`, [tenant])).rows[0].value;
        const call = async (kind, req, actor = who, connection = c) => {
            callCounts[kind]++;
            const result = await H.as(connection, actor, 'select public.zoe_pickup_reset_' + kind + '_v1($1,$2,$3::jsonb,$4) as value',
                [req.tenant, req.attemptId, JSON.stringify(req.context), req.casText]);
            return result.rows ? result.rows[0].value : result;
        };
        await seed();
        const legacy = request(A, uid), legacyId = 'legacy_reset_before_binding_001';
        const old = await H.as(c, who, 'select public.zoe_write_v2($1,$2,$3::jsonb) as value', [A, legacyId, JSON.stringify([legacy.operation])]);
        check('legacy actual CAS control increments once without changing another target day', old.rows?.[0]?.value?.ok === true
            && (await valueOf()).pickupRevision === 6 && isDeepStrictEqual(await valueOf(A, OTHER), prior()), old);
        const legacyReceipt = (await c.query('select result from public.zoe_ops where tenant_id=$1 and op_id=$2', [A, legacyId])).rows[0]?.result;
        check('legacy generic receipt remains explicitly untyped, never invented original Reset proof', legacyReceipt?.ok === true && !legacyReceipt.reset, legacyReceipt);
        await seed();
        const first = request(A, uid), firstResult = await call('execute', first);
        check('new typed execute availability and original batch/day/attempt binding', firstResult.ok === true && firstResult.reset?.outcome === 'applied'
            && firstResult.reset.attemptId === first.attemptId && firstResult.reset.batchId === first.context.batchId
            && firstResult.reset.scope === first.context.scope && firstResult.reset.nonce === first.context.nonce
            && firstResult.reset.actorUid === uid && firstResult.reset.tenant === A, firstResult);
        if (BASELINE) {
            check('baseline unavailable new RPC has no reset effects', firstResult.error?.code === '42883' && isDeepStrictEqual(await valueOf(), prior()), firstResult);
            return;
        }
        const ts = require(path.join(ROOT, 'supabase/node_modules/typescript'));
        const codecPath = path.join(ROOT, 'ZoeW/src/domain/pickup-reset-proof.ts');
        const codecText = fs.readFileSync(codecPath, 'utf8'), codecSourceHash = sha(codecText);
        const compiled = ts.transpileModule(codecText, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
        const module = { exports: {} };
        vm.runInNewContext(compiled, { module, exports: module.exports, crypto: crypto.webcrypto, TextEncoder }, { filename: codecPath });
        const codec = module.exports;
        codecEvidence = { sourceHash: codecSourceHash, reference: 'embedded3 immutable independent Python vectors', vectors: [] };
        for (const vector of SHARED_VECTORS) {
            const jsBatch = codec.pickupResetBatchPreimage(vector.tenant, vector.context.scope, vector.actorUid, vector.context.batchId, vector.dates);
            const jsPreimage = codec.pickupResetAttemptPreimage(vector.tenant, vector.actorUid, vector.context, vector.casText);
            const jsHash = await codec.pickupResetAttemptId(vector.tenant, vector.actorUid, vector.context, vector.casText);
            const sql = (await c.query(`with encoded as(select private.zoe_purge_compact_v1($1::jsonb) as value)
                select value,encode(sha256(convert_to(value,'UTF8')),'hex') as hash from encoded`, [JSON.stringify(JSON.parse(vector.attemptPreimage))])).rows[0];
            check('shared codec vector ' + vector.name + ' exact JS/Python/SQL envelope bytes and SHA', jsBatch === vector.batchPreimage
                && await codec.pickupResetBatchHash(vector.tenant, vector.context.scope, vector.actorUid, vector.context.batchId, vector.dates) === vector.batchHash
                && jsPreimage === vector.attemptPreimage && jsHash === vector.attemptId && sql.value === vector.attemptPreimage && sql.hash === vector.attemptId,
                { jsPreimage, jsHash, sql });
            const context = clone(vector.context);
            context.batchHash = await codec.pickupResetBatchHash(A, context.scope, uid, context.batchId, vector.dates);
            const attemptId = await codec.pickupResetAttemptId(A, uid, context, vector.casText);
            const operation = JSON.parse(vector.casText);
            if (operation.x === null) await c.query('delete from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [A, PICKUP, context.day]);
            else await c.query(`insert into public.zoe_docs(tenant_id,root,key,value,seq) values($1,$2,$3,$4,1)
                on conflict(tenant_id,root,key) do update set value=excluded.value`, [A, PICKUP, context.day, operation.x]);
            const req = { tenant: A, actorUid: uid, context, attemptId, casText: vector.casText, operation };
            const result = await call('execute', req);
            const expected = codec.pickupResetAppliedReceipt(A, uid, context, attemptId, vector.casText, 'operation');
            check('shared vector ' + vector.name + ' real UUID authenticated execute binds unchanged original CAS text', result.ok === true
                && isDeepStrictEqual(result.reset, clone(expected)), result);
            codecEvidence.vectors.push({ name: vector.name, goldenId: vector.attemptId, goldenSQLHash: sql.hash, rebasedAttemptId: attemptId,
                rebasedApplied: result.reset?.outcome === 'applied', casTextHash: sha(vector.casText) });
        }
        check('fresh typed CAS writes exact canonical3-field day and preserves other day', isDeepStrictEqual(await valueOf(),
            { pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0 }) && isDeepStrictEqual(await valueOf(A, OTHER), prior()), firstResult);
        const row = (await c.query('select result from public.zoe_ops where tenant_id=$1 and op_id=$2', [A, first.attemptId])).rows[0]?.result;
        const accounted = (await c.query(`select s.bytes::text,
            (coalesce((select sum(private.zoe_doc_bytes(root,key,value)) from public.zoe_docs where tenant_id=$1),0)
            +coalesce((select sum(private.zoe_op_bytes(op_id,result)) from public.zoe_ops where tenant_id=$1),0))::text as real
            from public.zoe_tenant_state s where s.tenant_id=$1`, [A])).rows[0];
        check('typed operation proof charged in same accounting as actual docs+receipts', isDeepStrictEqual(row?.reset, firstResult.reset) && accounted.bytes === accounted.real, accounted);
        const later = { pickupRevision: 7, pickupResetEpoch: 3, packagesPickedUp: 1, pickedUpPhones: { NEW: 1 }, pickedUpBarcodes: { NEW: 'NEW' } };
        await c.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4', [later, A, PICKUP, DAY]);
        const lateBefore = await snapshot(), replay = await call('execute', first), status = await call('status', first);
        check('same original attempt replay/status APPLIED never project old zero over later pickup', replay.reset?.outcome === 'applied' && replay.docs?.length === 0
            && status.reset?.outcome === 'applied' && status.docs?.length === 0 && isDeepStrictEqual(await snapshot(), lateBefore), { replay, status });
        const altered = clone(first); altered.context.nonce += '_changed';
        const alteredBefore = await snapshot(), alteredResult = await call('execute', altered);
        check('same attemptID changed immutable intent rejected before effects', alteredResult.error?.code === 'PT409'
            && isDeepStrictEqual(await snapshot(), alteredBefore), alteredResult);
        const foreign = await call('status', first, { role: 'authenticated', sub: uidB });
        check('foreign authenticated tenant cannot read original proof', foreign.error?.code === 'PT409', foreign);
        await c.query("update public.zoe_ops set created_at=now()-interval '3 days' where tenant_id=$1 and op_id=$2", [A, first.attemptId]);
        await c.query('select private.zoe_housekeeping($1)', [A]);
        const expiredBefore = await snapshot(), expired = await call('status', first), staleExecute = await call('execute', first);
        check('expired receipt UNKNOWN and delayed original CAS cannot reset newer pickup', expired.reset?.outcome === 'unknown' && expired.reset.proof === 'none'
            && expired.docs?.length === 0 && staleExecute.conflict === true && isDeepStrictEqual(await snapshot(), expiredBefore), { expired, staleExecute });
        const rebound = clone(first); rebound.casText = JSON.stringify({ ...rebound.operation, x: later, v: cleared(later) });
        const reboundResult = await call('execute', rebound);
        check('content-addressed identity rejects changed body even AFTER receipt GC', reboundResult.error?.code === 'PT409', reboundResult);
        const live = request(A, uid, later), liveResult = await call('execute', live);
        check('new legitimate explicit attempt after definitive conflict resets latest basis', liveResult.reset?.outcome === 'applied'
            && (await valueOf()).pickupRevision === 8 && (await valueOf()).pickupResetEpoch === 4, liveResult);
        await seed();
        const conflict = request(A, uid, { ...prior(), pickupRevision: 4 }), conflictBefore = await snapshot(), conflictResult = await call('execute', conflict);
        check('known CAS false returns original binding, no receipt/seq/quota mutation', conflictResult.conflict === true && conflictResult.ok === false
            && conflictResult.reset?.outcome === 'unknown' && conflictResult.reset.attemptId === conflict.attemptId
            && isDeepStrictEqual(await snapshot(), conflictBefore), conflictResult);
        const freshAfterConflict = request(A, uid), freshResult = await call('execute', freshAfterConflict);
        check('known false permits fresh nonce/attempt with latest CAS, not confirmed revision policy', freshAfterConflict.attemptId !== conflict.attemptId
            && freshResult.reset?.outcome === 'applied', freshResult);
        await seed();
        const collision = request(A, uid);
        await c.query("insert into public.zoe_ops(tenant_id,op_id,result) values($1,$2,'{\"ok\":true}'::jsonb)", [A, collision.attemptId]);
        const collisionBefore = await snapshot(), collisionResult = await call('execute', collision);
        check('untyped generic collision cannot be promoted to original Reset APPLIED', collisionResult.error?.code === 'PT409'
            && isDeepStrictEqual(await snapshot(), collisionBefore), collisionResult);
        for (const mutate of ['extra-context', 'wrong-date', 'non-reset-value', 'partial-metadata', 'changed-actor']) {
            const bad = request(A, mutate === 'changed-actor' ? uidB : uid);
            if (mutate === 'extra-context') bad.context.extra = true;
            if (mutate === 'wrong-date') bad.context.day = OTHER;
            if (mutate === 'non-reset-value') { bad.operation.v.packagesPickedUp = 9; bad.casText = JSON.stringify(bad.operation); }
            if (mutate === 'partial-metadata') { delete bad.operation.x.pickupResetEpoch; bad.casText = JSON.stringify(bad.operation); }
            const before = await snapshot(), result = await call('execute', bad);
            check('strict immutable reset intent ' + mutate + ' cannot mutate data', !!result.error && isDeepStrictEqual(await snapshot(), before), result);
        }
        const quotaFixture = async (label, basis) => {
            const name = 'quota_' + (++serial), actor = await H.makeAuthUser(c, name + '@u.zoe.test');
            const tenant = (await c.query("insert into public.tenants(name,branch_code,expires_at) values($1,$2,now()+interval '30 days') returning id", [name, name])).rows[0].id;
            await c.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [actor, tenant, name]);
            await c.query('insert into public.zoe_docs(tenant_id,root,key,value,seq) values($1,$2,$3,$4,1)', [tenant, PICKUP, DAY, basis]);
            return { label, tenant, actor, who: { role: 'authenticated', sub: actor }, req: request(tenant, actor, basis) };
        };
        const empty = { pickupRevision: 5, pickupResetEpoch: 2, packagesPickedUp: 0 };
        const quota = await quotaFixture('positive final proof growth', empty);
        const quotaState = (await c.query('select bytes from public.zoe_tenant_state where tenant_id=$1', [quota.tenant])).rows[0];
        let baseGrowth;
        await c.query('begin');
        try {
            await c.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'authenticated', sub: quota.actor })]);
            await c.query('set local role authenticated');
            const base = (await c.query('select public.zoe_write_v2($1,$2,$3::jsonb) as value', [quota.tenant, quota.req.attemptId, JSON.stringify([quota.req.operation])])).rows[0].value;
            await c.query('reset role');
            baseGrowth = BigInt((await c.query('select bytes from public.zoe_tenant_state where tenant_id=$1', [quota.tenant])).rows[0].bytes) - BigInt(quotaState.bytes);
            check('quota fixture proves old untyped CAS fits independently before typed-delta test', base.ok === true && baseGrowth > 0n, base);
        } finally { await c.query('rollback'); }
        await c.query('update public.zoe_tenant_state set quota_bytes=$1 where tenant_id=$2', [(BigInt(quotaState.bytes) + baseGrowth).toString(), quota.tenant]);
        const quotaBefore = await snapshot(quota.tenant), quotaResult = await call('execute', quota.req, quota.who);
        check('typed delta quota failure rolls back actual Reset+base receipt+proof+seq+bytes', quotaResult.error?.message === 'quota_exceeded'
            && isDeepStrictEqual(await snapshot(quota.tenant), quotaBefore), quotaResult);
        const largeSet = Object.fromEntries(Array.from({ length: 200 }, (_, i) => ['CODE_' + i, 'PHONE']));
        const negative = await quotaFixture('net negative over quota', { pickupRevision: 5, pickupResetEpoch: 2, packagesPickedUp: 200,
            pickedUpPhones: { PHONE: 200 }, pickedUpBarcodes: largeSet });
        await c.query('update public.zoe_tenant_state set quota_bytes=1 where tenant_id=$1', [negative.tenant]);
        const negativeBefore = BigInt((await c.query('select bytes from public.zoe_tenant_state where tenant_id=$1', [negative.tenant])).rows[0].bytes);
        const negativeResult = await call('execute', negative.req, negative.who);
        const negativeAccount = (await c.query(`select s.bytes::text,
            (coalesce((select sum(private.zoe_doc_bytes(root,key,value)) from public.zoe_docs where tenant_id=$1),0)
            +coalesce((select sum(private.zoe_op_bytes(op_id,result)) from public.zoe_ops where tenant_id=$1),0))::text as real
            from public.zoe_tenant_state s where s.tenant_id=$1`, [negative.tenant])).rows[0];
        check('existing net-negative over-quota policy preserved with FULL typed proof charged', negativeResult.reset?.outcome === 'applied'
            && BigInt(negativeAccount.bytes) < negativeBefore && BigInt(negativeAccount.bytes) > 1n && negativeAccount.bytes === negativeAccount.real, { negativeResult, negativeAccount });
        const masked = await quotaFixture('GC cannot mask positive full growth', empty);
        let chosen = null;
        for (let count = 1; count <= 100; count++) {
            const basis = { pickupRevision: 5, pickupResetEpoch: 2, packagesPickedUp: count, pickedUpPhones: { PHONE: count },
                pickedUpBarcodes: Object.fromEntries(Array.from({ length: count }, (_, i) => ['K' + i, 'PHONE'])) };
            const req = request(masked.tenant, masked.actor, basis);
            const metrics = (await c.query(`with proof as (select private.zoe_pickup_reset_intent_v1($1,$2,$3,$4::jsonb,$5)->'reset' as value),
                base as (select jsonb_build_object('ok',true,'seq',64,'docs',jsonb_build_array(jsonb_build_object('r',$6::text,'k',$7::text,'s',64))) as value),
                delta as (select private.zoe_doc_bytes($6,$7,$8::jsonb)-private.zoe_doc_bytes($6,$7,$9::jsonb) as doc)
                select doc+private.zoe_op_bytes($3,base.value) as base_growth,
                    doc+private.zoe_op_bytes($3,base.value||jsonb_build_object('reset',proof.value)) as final_growth from proof,base,delta`,
                [masked.tenant, masked.actor, req.attemptId, JSON.stringify(req.context), req.casText, PICKUP, DAY,
                    JSON.stringify({ pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0 }), JSON.stringify(basis)])).rows[0];
            if (BigInt(metrics.base_growth) <= 0n && BigInt(metrics.final_growth) > 0n) { chosen = { basis, req, metrics }; break; }
        }
        if (!chosen) throw new Error('could not construct GC/net-growth quota control');
        await c.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4', [chosen.basis, masked.tenant, PICKUP, DAY]);
        const oldId = 'expired_accounted_reset_fixture';
        await c.query("insert into public.zoe_ops(tenant_id,op_id,result,created_at) values($1,$2,jsonb_build_object('pad',repeat('x',4096)),now()-interval '3 days')", [masked.tenant, oldId]);
        await c.query('update public.zoe_tenant_state set bytes=bytes+(select private.zoe_op_bytes(op_id,result) from public.zoe_ops where tenant_id=$1 and op_id=$2),seq=63,quota_bytes=1 where tenant_id=$1', [masked.tenant, oldId]);
        const maskedBefore = await snapshot(masked.tenant), maskedResult = await call('execute', chosen.req, masked.who);
        check('seq64 housekeeping cannot disguise positive FULL growth; entire GC+Reset rolls back', maskedResult.error?.message === 'quota_exceeded'
            && isDeepStrictEqual(await snapshot(masked.tenant), maskedBefore), { metrics: chosen.metrics, result: maskedResult });
        const waitForLock = async (pid, label) => {
            let activity = null;
            for (let i = 0; i < 100; i++) {
                await c.query('select pg_stat_clear_snapshot()');
                activity = (await c.query('select wait_event_type,wait_event,query from pg_stat_activity where pid=$1', [pid])).rows[0];
                if (activity?.wait_event_type === 'Lock') break;
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            concurrencyEvidence.push({ label, pid, activity });
            return activity?.wait_event_type === 'Lock';
        };
        const beginApplied = async (connection, req, actor) => {
            await connection.query('begin');
            await connection.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'authenticated', sub: actor.sub })]);
            await connection.query('set local role authenticated');
            callCounts.execute++;
            const result = (await connection.query('select public.zoe_pickup_reset_execute_v1($1,$2,$3::jsonb,$4) as value',
                [req.tenant, req.attemptId, JSON.stringify(req.context), req.casText])).rows[0].value;
            await connection.query('reset role');
            return result;
        };
        const competing = await quotaFixture('same attempt concurrent serialization', prior());
        const originalWriter = await H.connect('postgres', dbName), replayer = await H.connect('postgres', dbName), changer = await H.connect('postgres', dbName);
        let repeated;
        try {
            const before = await snapshot(competing.tenant), original = await beginApplied(originalWriter, competing.req, competing.who);
            const changed = clone(competing.req); changed.context.nonce += '_changed_while_pending';
            const rejected = await call('execute', changed, competing.who, changer);
            check('pending original CAS cannot admit sameID changed intent before original commit', original.ok === true && rejected.error?.code === 'PT409'
                && isDeepStrictEqual(await snapshot(competing.tenant), before), rejected);
            const pid = (await replayer.query('select pg_backend_pid() as pid')).rows[0].pid;
            repeated = call('execute', competing.req, competing.who, replayer);
            const blocked = await waitForLock(pid, 'same-attempt waits original tenantstate');
            check('identical concurrent attempt really waits for original tenantstate transaction', blocked);
            await originalWriter.query('commit');
            const replayed = await repeated, after = await snapshot(competing.tenant);
            check('identical concurrent attempt commits once then returns empty historical replay', blocked && replayed.replayed === true
                && replayed.reset?.outcome === 'applied' && replayed.docs?.length === 0 && after.ops.length === 1
                && Number(after.state.seq) === Number(before.state.seq) + 1 && (await valueOf(competing.tenant)).pickupRevision === 6,
                { replayed, state: after.state });
        } finally {
            try { await originalWriter.query('rollback'); } catch (e) {}
            if (repeated) await repeated;
            await originalWriter.end(); await replayer.end(); await changer.end();
        }
        const moved = await quotaFixture('member move first', prior());
        const moving = await H.connect('postgres', dbName), oldWriter = await H.connect('postgres', dbName);
        let oldWrite;
        try {
            await moving.query('begin');
            await moving.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [B, moved.actor]);
            const before = await snapshot(moved.tenant), bBefore = await snapshot(B);
            const pid = (await oldWriter.query('select pg_backend_pid() as pid')).rows[0].pid;
            oldWrite = call('execute', moved.req, moved.who, oldWriter);
            const blocked = await waitForLock(pid, 'original tenant waits privileged member move');
            check('original reset physically waits membership FOR SHARE behind privileged move', blocked);
            await moving.query('commit');
            const denied = await oldWrite;
            check('member move commits first then old tenant intent rejects with no A or B effects', blocked && denied.error?.code === 'PT409'
                && isDeepStrictEqual(await snapshot(moved.tenant), before) && isDeepStrictEqual(await snapshot(B), bBefore), denied);
        } finally {
            try { await moving.query('rollback'); } catch (e) {}
            if (oldWrite) await oldWrite;
            await moving.end(); await oldWriter.end();
            await c.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [moved.tenant, moved.actor]);
        }
        const statusRace = await quotaFixture('status and move after original', prior());
        const statusWriter = await H.connect('postgres', dbName), statusReader = await H.connect('postgres', dbName), laterMover = await H.connect('postgres', dbName);
        let waitingStatus, laterMove;
        try {
            const applied = await beginApplied(statusWriter, statusRace.req, statusRace.who);
            const statusPid = (await statusReader.query('select pg_backend_pid() as pid')).rows[0].pid;
            waitingStatus = call('status', statusRace.req, statusRace.who, statusReader);
            const statusBlocked = await waitForLock(statusPid, 'status waits pending original state');
            const moverPid = (await laterMover.query('select pg_backend_pid() as pid')).rows[0].pid;
            laterMove = laterMover.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [B, statusRace.actor]);
            const moveBlocked = await waitForLock(moverPid, 'later move waits original and status member locks');
            check('uncommitted original holds state while read status and later member move both block', applied.ok === true && statusBlocked && moveBlocked);
            await statusWriter.query('commit');
            const observed = await waitingStatus; await laterMove;
            check('waiting status observes exact committed original proof without historical docs', observed.reset?.outcome === 'applied'
                && observed.reset.attemptId === statusRace.req.attemptId && observed.docs?.length === 0, observed);
            const before = await snapshot(statusRace.tenant), forbidden = await call('status', statusRace.req, statusRace.who);
            check('after move original status fails original tenant fence without mutating old state', forbidden.error?.code === 'PT409'
                && isDeepStrictEqual(await snapshot(statusRace.tenant), before), forbidden);
        } finally {
            try { await statusWriter.query('rollback'); } catch (e) {}
            if (waitingStatus) await waitingStatus;
            if (laterMove) await laterMove;
            await statusWriter.end(); await statusReader.end(); await laterMover.end();
            await c.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [statusRace.tenant, statusRace.actor]);
        }
        const pickupRace = await quotaFixture('ordinary pickup commits before reset', prior());
        const pickupController = await H.connect('postgres', dbName), pickupWriter = await H.connect('postgres', dbName);
        let waitingReset;
        try {
            await pickupController.query('begin');
            await pickupController.query('select seq from public.zoe_tenant_state where tenant_id=$1 for update', [pickupRace.tenant]);
            const pid = (await pickupWriter.query('select pg_backend_pid() as pid')).rows[0].pid;
            waitingReset = call('execute', pickupRace.req, pickupRace.who, pickupWriter);
            const blocked = await waitForLock(pid, 'reset waits ordinary pickup state transaction');
            const latest = { pickupRevision: 6, pickupResetEpoch: 2, packagesPickedUp: 2, pickedUpPhones: { PHONE: 2 }, pickedUpBarcodes: { CODE: 'PHONE', CODE2: 'PHONE' } };
            await pickupController.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'authenticated', sub: pickupRace.actor })]);
            await pickupController.query('set local role authenticated');
            const pickup = (await pickupController.query('select public.zoe_write_v2($1,$2,$3::jsonb) as value', [pickupRace.tenant,
                'ordinary_pickup_before_reset_' + serial, JSON.stringify([{ k: 'cas', p: [PICKUP, DAY], x: prior(), v: latest }])])).rows[0].value;
            await pickupController.query('reset role');
            await pickupController.query('commit');
            const conflictResult = await waitingReset;
            check('concurrent actual pickup wins and original CAS is definitive false without a receipt', blocked && pickup.ok === true
                && conflictResult.conflict === true && isDeepStrictEqual(await valueOf(pickupRace.tenant), latest)
                && Number((await c.query('select count(*) as count from public.zoe_ops where tenant_id=$1 and op_id=$2', [pickupRace.tenant, pickupRace.req.attemptId])).rows[0].count) === 0,
                conflictResult);
            const fresh = request(pickupRace.tenant, pickupRace.actor, latest, { batchId: pickupRace.req.context.batchId, nonce: pickupRace.req.context.nonce + '_known_false' });
            const retried = await call('execute', fresh, pickupRace.who);
            check('only known false creates new same-batch nonce and resets latest record once', fresh.attemptId !== pickupRace.req.attemptId
                && fresh.context.batchHash === pickupRace.req.context.batchHash && fresh.context.dayId === pickupRace.req.context.dayId
                && retried.reset?.outcome === 'applied' && (await valueOf(pickupRace.tenant)).pickupRevision === 7
                && (await valueOf(pickupRace.tenant)).pickupResetEpoch === 3, retried);
        } finally {
            try { await pickupController.query('rollback'); } catch (e) {}
            if (waitingReset) await waitingReset;
            await pickupController.end(); await pickupWriter.end();
        }
        const lostAck = await quotaFixture('committed ACK discarded', prior());
        await call('execute', lostAck.req, lostAck.who).then(() => undefined);
        const afterReset = { pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0 };
        const newPickup = { pickupRevision: 7, pickupResetEpoch: 3, packagesPickedUp: 1, pickedUpPhones: { NEW: 1 }, pickedUpBarcodes: { NEW: 'NEW' } };
        const pickupAfterAck = await H.as(c, lostAck.who, 'select public.zoe_write_v2($1,$2,$3::jsonb) as value', [lostAck.tenant,
            'new_pickup_after_lost_reset_ack_' + serial, JSON.stringify([{ k: 'cas', p: [PICKUP, DAY], x: afterReset, v: newPickup }])]);
        const beforeRead = await snapshot(lostAck.tenant), executesBeforeRead = callCounts.execute;
        const proven = await call('status', lostAck.req, lostAck.who);
        check('discarded actual commit ACK resolves original APPLIED by status only preserving later pickup', pickupAfterAck.rows?.[0]?.value?.ok === true
            && proven.reset?.outcome === 'applied' && proven.reset.attemptId === lostAck.req.attemptId && proven.docs?.length === 0
            && callCounts.execute === executesBeforeRead && isDeepStrictEqual(await snapshot(lostAck.tenant), beforeRead), proven);
        await c.query("update public.zoe_ops set created_at=now()-interval '3 days' where tenant_id=$1 and op_id=$2", [lostAck.tenant, lostAck.req.attemptId]);
        await c.query('select private.zoe_housekeeping($1)', [lostAck.tenant]);
        const unknownBefore = await snapshot(lostAck.tenant), executesBeforeUnknown = callCounts.execute;
        const missingOne = await call('status', lostAck.req, lostAck.who), missingTwo = await call('status', lostAck.req, lostAck.who);
        check('postGC UNKNOWN probes remain read-only and never dispatch recovery execute in direct API control', missingOne.reset?.outcome === 'unknown'
            && missingTwo.reset?.outcome === 'unknown' && missingOne.reset.proof === 'none' && missingTwo.reset.proof === 'none'
            && callCounts.execute === executesBeforeUnknown && isDeepStrictEqual(await snapshot(lostAck.tenant), unknownBefore), { missingOne, missingTwo });
        const concurrentQuota = await quotaFixture('concurrent quota rollback', empty);
        const quotaBeforeState = (await c.query('select bytes from public.zoe_tenant_state where tenant_id=$1', [concurrentQuota.tenant])).rows[0];
        let exactBaseGrowth;
        await c.query('begin');
        try {
            await c.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'authenticated', sub: concurrentQuota.actor })]);
            await c.query('set local role authenticated');
            await c.query('select public.zoe_write_v2($1,$2,$3::jsonb)', [concurrentQuota.tenant, concurrentQuota.req.attemptId, JSON.stringify([concurrentQuota.req.operation])]);
            await c.query('reset role');
            exactBaseGrowth = BigInt((await c.query('select bytes from public.zoe_tenant_state where tenant_id=$1', [concurrentQuota.tenant])).rows[0].bytes) - BigInt(quotaBeforeState.bytes);
        } finally { await c.query('rollback'); }
        await c.query('update public.zoe_tenant_state set quota_bytes=$1 where tenant_id=$2', [(BigInt(quotaBeforeState.bytes) + exactBaseGrowth).toString(), concurrentQuota.tenant]);
        const quotaController = await H.connect('postgres', dbName), quotaWriter = await H.connect('postgres', dbName);
        let quotaPending;
        try {
            const before = await snapshot(concurrentQuota.tenant);
            await quotaController.query('begin');
            await quotaController.query("insert into public.zoe_ops(tenant_id,op_id,result) values($1,$2,'{\"ok\":true}'::jsonb)", [concurrentQuota.tenant, concurrentQuota.req.attemptId]);
            const pid = (await quotaWriter.query('select pg_backend_pid() as pid')).rows[0].pid;
            quotaPending = call('execute', concurrentQuota.req, concurrentQuota.who, quotaWriter);
            const blocked = await waitForLock(pid, 'reset waits uncommitted unique op insertion after CAS effects');
            check('uncommitted original Reset effects remain invisible while op insert is actually blocked', blocked
                && isDeepStrictEqual(await snapshot(concurrentQuota.tenant), before), concurrencyEvidence.at(-1));
            await quotaController.query('rollback');
            const rejected = await quotaPending;
            check('after concurrent insertion releases typed quota failure rolls back all original effects', rejected.error?.message === 'quota_exceeded'
                && isDeepStrictEqual(await snapshot(concurrentQuota.tenant), before), rejected);
        } finally {
            try { await quotaController.query('rollback'); } catch (e) {}
            if (quotaPending) await quotaPending;
            await quotaController.end(); await quotaWriter.end();
        }
        for (const role of ['anon', 'service_role']) {
            const result = await call('status', first, { role });
            check('new status ACL excludes ' + role, H.denied(result), result);
        }
        const helper = await H.as(c, who, 'select private.zoe_pickup_reset_intent_v1($1,$2,$3,$4::jsonb,$5)', [A, uid, first.attemptId, JSON.stringify(first.context), first.casText]);
        check('authenticated cannot directly invoke trusted reset helper', H.denied(helper), helper);
        check('actual JS codec source remains byte-stable throughout matched SQL run', sha(fs.readFileSync(codecPath)) === codecSourceHash);
        const afterCatalog = await catalog();
        catalogEvidence = { before: beforeCatalog, after: afterCatalog,
            existingResetTables: beforeCatalog.relations.filter(row => row.kind === 'r' && row.name.includes('reset')).map(row => row.schema + '.' + row.name) };
        check('no new reset persistence tables or lifetime quota namespace', beforeCatalog !== null
            && isDeepStrictEqual(afterCatalog, beforeCatalog) && catalogEvidence.existingResetTables.includes('public.member_reset_codes'), catalogEvidence);
        // F09 native-day composition regression begin.
        {
            const nativeRules = files.filter(name => /_zoe_rules\.sql$/.test(name)).at(-1);
            const { compileRules, rulesSql } = await import(require('url').pathToFileURL(path.join(ROOT, 'supabase/scripts/rtdb-rules.mjs')).href);
            const compiledRules = compileRules(JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8')));
            const canonicalTree = value => Array.isArray(value) ? value.map(canonicalTree) : value && typeof value === 'object'
                ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalTree(value[key])])) : value;
            const policyHash = value => sha(JSON.stringify(canonicalTree(value)));
            const installedRules = (await c.query('select private.zoe_rules() as value')).rows[0].value;
            const composition = { migrationCount: files.length, nativeRules,
                nativeRulesHash: sha(fs.readFileSync(path.join(ROOT, 'supabase/migrations', nativeRules))),
                canonicalGeneratedFresh: fs.readFileSync(path.join(ROOT, 'supabase/migrations', nativeRules), 'utf8') === rulesSql(compiledRules),
                installedCanonicalEqual: isDeepStrictEqual(installedRules, compiledRules),
                f03LegacyPolicyHash: policyHash(compiledRules.c.zoew_registry_releases),
                f09DailyPolicyHash: policyHash(compiledRules.c.zoew_daily_pickup_cod_dod),
                nativeEngine: 'UNRUN', rawCasImmutable: true, observations: [] };
            codecEvidence.composition = composition;
            check('composition uses all current migrations including native-day compiled preservation', files.includes(nativeRules)
                && files.at(-1) === nativeRules && files.length >= 47
                && files.length >= 50 && nativeRules > '20261101222215_zoe_rules.sql'
                && composition.canonicalGeneratedFresh && composition.installedCanonicalEqual
                && composition.f03LegacyPolicyHash === '240c2cac550e3f20988b1e06b3c83339c8be27416e63685ff41448f4a0f98740'
                && composition.f09DailyPolicyHash === 'c3280874e9c28bb0b01a97b7c82d892c88ce434428fcc4b9142607e1087d2049', composition);
            const composedFixture = async (basis, label) => {
                const name = 'compose_' + (++serial), actor = await H.makeAuthUser(c, name + '@u.zoe.test');
                const tenant = (await c.query("insert into public.tenants(name,branch_code,expires_at) values($1,$2,now()+interval '30 days') returning id", [name, name])).rows[0].id;
                await c.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [actor, tenant, name]);
                const ops = [{ k: 'set', p: [PICKUP, DAY], v: basis }, { k: 'set', p: [PICKUP, OTHER], v: prior() },
                    { k: 'set', p: ['zoew_daily_revenue_cod_dod', DAY], v: { codDollar: 37, dodDollar: 5, totalCount: 11 } },
                    { k: 'set', p: ['zoew_daily_collected_cod_dod', DAY], v: { codDollar: 7, dodDollar: 2 } }];
                const seeded = await H.as(c, { role: 'service_role' }, 'select public.zoe_admin_write($1,$2,$3::jsonb,false) as value',
                    [tenant, 'compose_import_' + String(serial).padStart(8, '0'), JSON.stringify(ops)]);
                if (seeded.rows?.[0]?.value?.ok !== true) throw new Error('composition admin import failed: ' + JSON.stringify(seeded));
                return { tenant, actor, label, who: { role: 'authenticated', sub: actor } };
            };
            const composedRequest = async (fixture, basis, label, proofTenant = fixture.tenant) => {
                const scope = 'https://reset-composition.invalid#' + proofTenant, batchId = label + '_' + (++serial);
                const batchHash = await codec.pickupResetBatchHash(proofTenant, scope, fixture.actor, batchId, [DAY]);
                const context = { v: 1, scope, batchId, batchHash, dayId: batchId + ':' + DAY, day: DAY, nonce: 'nonce_' + serial };
                const casText = codec.pickupResetCasText(DAY, basis, cleared(basis));
                const attemptId = await codec.pickupResetAttemptId(proofTenant, fixture.actor, context, casText);
                if (!attemptId || !casText) throw new Error('actual codec refused composition request: ' + label);
                return { tenant: proofTenant, actorUid: fixture.actor, context, casText, attemptId, operation: JSON.parse(casText) };
            };
            const composedGeneric = async (fixture, basis, desired, label, actor = fixture.who) => {
                const result = await H.as(c, actor, 'select public.zoe_write_v2($1,$2,$3::jsonb) as value', [fixture.tenant,
                    'compose_' + label + '_' + String(++serial).padStart(8, '0'), JSON.stringify([{ k: 'cas', p: [PICKUP, DAY], x: basis, v: desired }])]);
                return result.rows?.[0]?.value || result;
            };
            const composedRetained = async fixture => (await c.query('select root,key,value from public.zoe_docs where tenant_id=$1 and not(root=$2 and key=$3) order by root,key',
                [fixture.tenant, PICKUP, DAY])).rows;
            const composedAccounting = async fixture => (await c.query(`select s.bytes::text,s.seq::text,
                (coalesce((select sum(private.zoe_doc_bytes(root,key,value)) from public.zoe_docs where tenant_id=$1),0)
                +coalesce((select sum(private.zoe_op_bytes(op_id,result)) from public.zoe_ops where tenant_id=$1),0))::text as real,
                (select count(*) from public.zoe_ops where tenant_id=$1)::text as op_count
                from public.zoe_tenant_state s where s.tenant_id=$1`, [fixture.tenant])).rows[0];
            const fixture = await composedFixture(prior(), 'authenticated native-like admission');
            const retainedBefore = clone(await composedRetained(fixture));
            const nativeRequest = await composedRequest(fixture, await valueOf(fixture.tenant), 'native_admit', 'demo-f09-native-project');
            const nativeProof = clone(await codec.pickupResetBoundReceipt(nativeRequest.tenant, fixture.actor, nativeRequest.context,
                nativeRequest.attemptId, nativeRequest.casText, 'native-day'));
            const nativeAdmission = await composedGeneric(fixture, nativeRequest.operation.x,
                { ...nativeRequest.operation.v, pickupResetApplied: nativeProof }, 'native_admit');
            check('actual authenticated generic CAS admits complete codec native-like receipt with reset effect', nativeAdmission.ok === true
                && isDeepStrictEqual((await valueOf(fixture.tenant)).pickupResetApplied, nativeProof)
                && isDeepStrictEqual(await composedRetained(fixture), retainedBefore), nativeAdmission);
            let basis = await valueOf(fixture.tenant);
            const firstPickup = { ...basis, pickupRevision: basis.pickupRevision + 1, packagesPickedUp: 1,
                pickedUpPhones: { PHONE: 1 }, pickedUpBarcodes: { NATIVE_PICKUP: 'PHONE' } };
            const pickupOne = await composedGeneric(fixture, basis, firstPickup, 'same_owner');
            check('actual ordinary pickup preserves all native-day fields and epoch for original actor', pickupOne.ok === true
                && isDeepStrictEqual(await valueOf(fixture.tenant), firstPickup) && isDeepStrictEqual(await composedRetained(fixture), retainedBefore), pickupOne);
            const otherActor = await H.makeAuthUser(c, 'compose_other_' + (++serial) + '@u.zoe.test');
            await c.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [otherActor, fixture.tenant, 'compose_other_' + serial]);
            basis = await valueOf(fixture.tenant);
            const otherPickup = { ...basis, pickupRevision: basis.pickupRevision + 1, packagesPickedUp: 2,
                pickedUpPhones: { PHONE: 2 }, pickedUpBarcodes: { NATIVE_PICKUP: 'PHONE', OTHER_PICKUP: 'PHONE' } };
            const pickupTwo = await composedGeneric(fixture, basis, otherPickup, 'other_owner', { role: 'authenticated', sub: otherActor });
            check('actual second same-tenant pickup actor preserves original receipt creator', pickupTwo.ok === true
                && isDeepStrictEqual(await valueOf(fixture.tenant), otherPickup) && isDeepStrictEqual(await composedRetained(fixture), retainedBefore), pickupTwo);
            for (const kind of ['drop', 'tamper']) {
                basis = await valueOf(fixture.tenant);
                const desired = { ...basis, pickupRevision: basis.pickupRevision + 1 };
                if (kind === 'drop') delete desired.pickupResetApplied;
                else desired.pickupResetApplied = { ...basis.pickupResetApplied, nonce: 'tampered_nonce' };
                const before = await snapshot(fixture.tenant), result = await composedGeneric(fixture, basis, desired, kind);
                check('compiled ordinary-writer ' + kind + ' denial rolls back entire receipt/day/seq/bytes', result.error?.code === '42501'
                    && isDeepStrictEqual(await snapshot(fixture.tenant), before), result);
            }
            basis = await valueOf(fixture.tenant);
            const typedRequest = await composedRequest(fixture, basis, 'typed_composition');
            const rawCasBefore = typedRequest.casText, attemptBefore = typedRequest.attemptId;
            const expectedOperation = clone(await codec.pickupResetBoundReceipt(fixture.tenant, fixture.actor, typedRequest.context,
                typedRequest.attemptId, typedRequest.casText, 'operation'));
            const expectedDayProof = { ...expectedOperation, proof: 'native-day' };
            const expectedDay = { pickupRevision: basis.pickupRevision + 1, pickupResetEpoch: basis.pickupResetEpoch + 1,
                packagesPickedUp: 0, pickupResetApplied: expectedDayProof };
            const beforeTyped = await snapshot(fixture.tenant), beforeAccount = await composedAccounting(fixture);
            const typedResult = await call('execute', typedRequest, fixture.who);
            composition.observations.push({ label: 'typed on native-day basis', request: typedRequest, result: typedResult });
            check('typed SQL Reset atomically composes exact original BASE CAS with new native-day proof', typedResult.ok === true
                && isDeepStrictEqual(typedResult.reset, expectedOperation) && isDeepStrictEqual(await valueOf(fixture.tenant), expectedDay)
                && typedRequest.casText === rawCasBefore && typedRequest.attemptId === attemptBefore
                && !Object.prototype.hasOwnProperty.call(JSON.parse(rawCasBefore).v, 'pickupResetApplied')
                && isDeepStrictEqual(await composedRetained(fixture), retainedBefore), typedResult);
            const account = await composedAccounting(fixture);
            const opRows = (await c.query('select result from public.zoe_ops where tenant_id=$1 and op_id=$2', [fixture.tenant, typedRequest.attemptId])).rows;
            check('composed Reset consumes one epoch/seq and one fully charged typed operation receipt', account.bytes === account.real
                && BigInt(account.seq) === BigInt(beforeAccount.seq) + 1n && BigInt(account.op_count) === BigInt(beforeAccount.op_count) + 1n
                && opRows.length === 1 && isDeepStrictEqual(opRows[0].result.reset, expectedOperation), { beforeAccount, account, opRows });
            const sameBasis = await composedRequest(fixture, basis, 'same_basis_known_false');
            const beforeConflict = await snapshot(fixture.tenant), sameBasisResult = await call('execute', sameBasis, fixture.who);
            check('competing new attempt on identical original CAS basis cannot replace applied day proof', sameBasisResult.conflict === true
                && sameBasisResult.ok === false && isDeepStrictEqual(await snapshot(fixture.tenant), beforeConflict), sameBasisResult);
            const currentDay = await valueOf(fixture.tenant);
            const newerPickup = { ...currentDay, pickupRevision: currentDay.pickupRevision + 1, packagesPickedUp: 1,
                pickedUpPhones: { LATER: 1 }, pickedUpBarcodes: { LATER: 'LATER' } };
            const afterTypedPickup = await composedGeneric(fixture, currentDay, newerPickup, 'after_typed_pickup');
            const beforeReplay = await snapshot(fixture.tenant), replayed = await call('execute', typedRequest, fixture.who);
            const status = await call('status', typedRequest, fixture.who);
            check('composed receipt-only replay/status preserve later pickup and original APPLIED binding', afterTypedPickup.ok === true
                && replayed.replayed === true && replayed.docs?.length === 0 && status.docs?.length === 0
                && isDeepStrictEqual(replayed.reset, expectedOperation) && isDeepStrictEqual(status.reset, expectedOperation)
                && isDeepStrictEqual(await snapshot(fixture.tenant), beforeReplay), { replayed, status });
            await c.query("update public.zoe_ops set created_at=now()-interval '3 days' where tenant_id=$1 and op_id=$2", [fixture.tenant, typedRequest.attemptId]);
            await c.query('select private.zoe_housekeeping($1)', [fixture.tenant]);
            const gcBefore = await snapshot(fixture.tenant), gcExecutes = callCounts.execute;
            const gcOne = await call('status', typedRequest, fixture.who), gcTwo = await call('status', typedRequest, fixture.who);
            check('postGC matching embedded day proof NEVER substitutes for missing SQL operation receipt',
                isDeepStrictEqual((await valueOf(fixture.tenant)).pickupResetApplied, expectedDayProof)
                && gcOne.reset?.outcome === 'unknown' && gcTwo.reset?.outcome === 'unknown'
                && gcOne.reset.proof === 'none' && gcTwo.reset.proof === 'none' && gcOne.docs?.length === 0 && gcTwo.docs?.length === 0
                && callCounts.execute === gcExecutes && isDeepStrictEqual(await snapshot(fixture.tenant), gcBefore), { gcOne, gcTwo });
            const replacementBasis = await valueOf(fixture.tenant), replacement = await composedRequest(fixture, replacementBasis, 'replacement', 'demo-f09-native-project');
            const replacementProof = clone(await codec.pickupResetBoundReceipt(replacement.tenant, fixture.actor, replacement.context,
                replacement.attemptId, replacement.casText, 'native-day'));
            const replacementResult = await composedGeneric(fixture, replacementBasis,
                { ...replacement.operation.v, pickupResetApplied: replacementProof }, 'new_holder');
            check('fresh generic native-like Reset replaces day proof and consumes original CAS once', replacementResult.ok === true
                && isDeepStrictEqual((await valueOf(fixture.tenant)).pickupResetApplied, replacementProof)
                && (await valueOf(fixture.tenant)).pickupResetEpoch === replacementBasis.pickupResetEpoch + 1, replacementResult);
            const holderBefore = await snapshot(fixture.tenant), stale = await call('execute', typedRequest, fixture.who);
            check('explicit stale original CAS after GC cannot overwrite newer holder or recreate operation proof', stale.conflict === true
                && stale.ok === false && isDeepStrictEqual(await snapshot(fixture.tenant), holderBefore), stale);
            const quotaBasis = { ...clone(await valueOf(fixture.tenant)), packagesPickedUp: 0 };
            delete quotaBasis.pickedUpPhones; delete quotaBasis.pickedUpBarcodes;
            const composedQuota = await composedFixture(quotaBasis, 'full composed receipt quota rollback');
            const quotaReq = await composedRequest(composedQuota, await valueOf(composedQuota.tenant), 'composed_quota');
            const quotaAccount = await composedAccounting(composedQuota);
            await c.query('update public.zoe_tenant_state set quota_bytes=bytes where tenant_id=$1', [composedQuota.tenant]);
            const quotaSnapshot = await snapshot(composedQuota.tenant), quotaDenied = await call('execute', quotaReq, composedQuota.who);
            check('composed positive receipt growth quota refusal retains old proof and rolls back all effects', quotaDenied.error?.message === 'quota_exceeded'
                && isDeepStrictEqual(await snapshot(composedQuota.tenant), quotaSnapshot), { quotaAccount, quotaDenied });
            const exported = await H.as(c, { role: 'service_role' }, 'select public.zoe_admin_export($1) as value', [fixture.tenant]);
            const exportDay = exported.rows?.[0]?.value?.rows?.find(row => row.r === PICKUP && row.k === DAY)?.v;
            check('supported document archive export retains complete latest day proof unchanged',
                isDeepStrictEqual(exportDay, await valueOf(fixture.tenant)), exported);
            const restored = await composedFixture(exportDay, 'document restore with original proof');
            const restoreBasis = await valueOf(restored.tenant), restoreRetained = clone(await composedRetained(restored));
            check('supported admin document restore preserves original native-day identity without invented SQL receipt',
                isDeepStrictEqual(restoreBasis, exportDay) && isDeepStrictEqual(restoreBasis.pickupResetApplied, replacementProof)
                && Number((await c.query('select count(*) as count from public.zoe_ops where tenant_id=$1 and op_id=$2',
                    [restored.tenant, replacementProof.attemptId])).rows[0].count) === 0, restoreBasis);
            const restorePickup = { ...restoreBasis, pickupRevision: restoreBasis.pickupRevision + 1, packagesPickedUp: 1,
                pickedUpPhones: { RESTORED: 1 }, pickedUpBarcodes: { RESTORED: 'RESTORED' } };
            const restorePicked = await composedGeneric(restored, restoreBasis, restorePickup, 'restored_pickup');
            check('ordinary writer after restore preserves foreign-origin creator proof without claiming APPLIED', restorePicked.ok === true
                && isDeepStrictEqual((await valueOf(restored.tenant)).pickupResetApplied, replacementProof), restorePicked);
            const restoreReq = await composedRequest(restored, await valueOf(restored.tenant), 'restore_reset');
            const restoreBefore = await snapshot(restored.tenant), restoreStatus = await call('status', restoreReq, restored.who);
            check('restored embedded metadata alone cannot certify a newly bound SQL Reset attempt', restoreStatus.reset?.outcome === 'unknown'
                && restoreStatus.docs?.length === 0 && isDeepStrictEqual(await snapshot(restored.tenant), restoreBefore), restoreStatus);
            const restoreExpected = clone(await codec.pickupResetBoundReceipt(restored.tenant, restored.actor, restoreReq.context,
                restoreReq.attemptId, restoreReq.casText, 'operation'));
            const restoredResult = await call('execute', restoreReq, restored.who);
            check('genuine typed Reset after restore binds current tenant/actor and atomically replaces old proof',
                isDeepStrictEqual(restoredResult.reset, restoreExpected)
                && isDeepStrictEqual((await valueOf(restored.tenant)).pickupResetApplied, { ...restoreExpected, proof: 'native-day' })
                && isDeepStrictEqual(await composedRetained(restored), restoreRetained), restoredResult);
            composition.observations.push({ beforeTyped, finalAccounting: await composedAccounting(fixture),
                restoreAccounting: await composedAccounting(restored), quotaRefusal: quotaDenied });
            check('actual codec remains unchanged after full composed/imported receipt scenarios', sha(fs.readFileSync(codecPath)) === codecSourceHash);
        }
        // F09 native-day composition regression end.
        // F09 additive paired SQL profiles begin.
        {
            const TAIL = '2026-11-02', DAILY = 'zoew_daily_revenue_cod_dod', MONTHLY = 'zoew_monthly_revenue_cod_dod', HISTORY = 'zoew_scan_history_cod_dod';
            const matchedPrior = { pickupRevision: 5, pickupResetEpoch: 2, packagesPickedUp: 2,
                pickedUpPhones: { PHONE: 2 }, pickedUpBarcodes: { CODE_A: 'PHONE', CODE_B: 'PHONE' } };
            const matchedSeed = { [PICKUP]: { [DAY]: clone(matchedPrior), [OTHER]: clone(matchedPrior), [TAIL]: clone(matchedPrior) },
                [DAILY]: { [DAY]: { codDollar: 37, dodDollar: 5, totalCount: 11 } },
                [MONTHLY]: { '2026-11': { codDollar: 37, dodDollar: 5, totalCount: 11 } },
                [HISTORY]: { retained: { id: 'retained', isClosed: true, count: 1, cod: 37, dod: 5 } } };
            const paired = { dataset: clone(matchedSeed), scope: 'SQL only; common logical seed does not establish actual native parity', observations: [] };
            codecEvidence.paired = paired;
            const pairedFixture = async label => {
                const name = 'paired_' + (++serial), actor = await H.makeAuthUser(c, name + '@u.zoe.test');
                const tenant = (await c.query("insert into public.tenants(name,branch_code,expires_at) values($1,$2,now()+interval '30 days') returning id", [name, name])).rows[0].id;
                await c.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [actor, tenant, name]);
                const ops = Object.entries(matchedSeed).flatMap(([root, records]) => Object.entries(records).map(([key, value]) => ({ k: 'set', p: [root, key], v: value })));
                const imported = await H.as(c, { role: 'service_role' }, 'select public.zoe_admin_write($1,$2,$3::jsonb,false) as value',
                    [tenant, 'paired_seed_' + String(serial).padStart(8, '0'), JSON.stringify(ops)]);
                if (imported.rows?.[0]?.value?.ok !== true) throw new Error('paired synthetic seed was not admitted: ' + JSON.stringify(imported));
                const actual = (await c.query('select root,key,value from public.zoe_docs where tenant_id=$1 order by root,key', [tenant])).rows;
                const expected = ops.map(op => ({ root: op.p[0], key: op.p[1], value: op.v })).sort((a, b) => a.root.localeCompare(b.root) || a.key.localeCompare(b.key));
                if (!isDeepStrictEqual(actual, expected)) throw new Error('paired synthetic seed differs from declared common dataset');
                return { label, tenant, actor, who: { role: 'authenticated', sub: actor } };
            };
            const pairedRequest = async (fixture, basis, label) => {
                const scope = 'https://paired-reset.invalid#' + fixture.tenant, batchId = label + '_' + (++serial);
                const batchHash = await codec.pickupResetBatchHash(fixture.tenant, scope, fixture.actor, batchId, [DAY]);
                const context = Object.freeze({ v: 1, scope, batchId, batchHash, dayId: batchId + ':' + DAY, day: DAY, nonce: 'nonce_' + serial });
                const casText = codec.pickupResetCasText(DAY, basis, cleared(basis));
                const attemptId = await codec.pickupResetAttemptId(fixture.tenant, fixture.actor, context, casText);
                if (!casText || !attemptId) throw new Error('actual codec rejected paired request: ' + label);
                return Object.freeze({ tenant: fixture.tenant, actorUid: fixture.actor, context, casText, attemptId });
            };
            const pairedRetained = async fixture => (await c.query('select root,key,value from public.zoe_docs where tenant_id=$1 and not(root=$2 and key=$3) order by root,key', [fixture.tenant, PICKUP, DAY])).rows;
            const pairedGeneric = async (fixture, operation, label) => {
                const result = await H.as(c, fixture.who, 'select public.zoe_write_v2($1,$2,$3::jsonb) as value',
                    [fixture.tenant, 'paired_' + label + '_' + String(++serial).padStart(8, '0'), JSON.stringify([operation])]);
                return result.rows?.[0]?.value || result;
            };
            const race = await pairedFixture('distinct original Reset attempts');
            const requests = await Promise.all([pairedRequest(race, matchedPrior, 'race_a'), pairedRequest(race, matchedPrior, 'race_b')]);
            const before = await snapshot(race.tenant), retained = clone(await pairedRetained(race));
            const controller = await H.connect('postgres', dbName), first = await H.connect('postgres', dbName), second = await H.connect('postgres', dbName);
            let one, two;
            try {
                const controllerPid = (await controller.query('select pg_backend_pid() as pid')).rows[0].pid;
                const pids = [(await first.query('select pg_backend_pid() as pid')).rows[0].pid, (await second.query('select pg_backend_pid() as pid')).rows[0].pid];
                await controller.query('begin');
                await controller.query('select seq from public.zoe_tenant_state where tenant_id=$1 for update', [race.tenant]);
                one = call('execute', requests[0], race.who, first); two = call('execute', requests[1], race.who, second);
                const blocked = await Promise.all(pids.map((pid, index) => waitForLock(pid, 'paired distinct Reset ' + index + ' waits original state')));
                const activities = (await c.query('select pid,wait_event_type,wait_event,query,pg_blocking_pids(pid) as blockers from pg_stat_activity where pid=any($1::int[]) order by pid', [pids])).rows;
                const reachesController = (pid, seen = new Set()) => {
                    if (pid === controllerPid) return true;
                    if (seen.has(pid)) return false;
                    seen.add(pid);
                    return activities.find(row => row.pid === pid)?.blockers.some(blocker => reachesController(blocker, new Set(seen))) || false;
                };
                check('paired distinct Reset IDs are concurrently blocked before original effects', requests[0].attemptId !== requests[1].attemptId
                    && requests[0].casText === requests[1].casText && blocked.every(Boolean) && activities.length === 2
                    && activities.every(row => row.wait_event_type === 'Lock' && row.query.includes('public.zoe_pickup_reset_execute_v1') && reachesController(row.pid))
                    && isDeepStrictEqual(await snapshot(race.tenant), before), { controllerPid, activities });
                await controller.query('commit');
                const outcomes = await Promise.all([one, two]), winner = outcomes.findIndex(result => result.ok === true && result.reset?.outcome === 'applied');
                const loser = winner < 0 ? -1 : 1 - winner, expected = winner < 0 ? null : clone(await codec.pickupResetBoundReceipt(race.tenant, race.actor,
                    requests[winner].context, requests[winner].attemptId, requests[winner].casText, 'operation'));
                const after = await snapshot(race.tenant);
                check('paired distinct Reset IDs apply one fixed attempt and hold the losing original identity', outcomes.filter(result => result.ok === true && result.reset?.outcome === 'applied').length === 1
                    && loser >= 0 && outcomes[loser].ok === false && outcomes[loser].conflict === true && outcomes[loser].reset?.outcome === 'unknown'
                    && outcomes[loser].reset?.attemptId === requests[loser].attemptId && outcomes[loser].reset?.proof === 'none'
                    && isDeepStrictEqual(outcomes[winner].reset, expected) && isDeepStrictEqual(await valueOf(race.tenant), { pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0 })
                    && isDeepStrictEqual(await pairedRetained(race), retained), outcomes);
                const account = (await c.query(`select s.bytes::text,(coalesce((select sum(private.zoe_doc_bytes(root,key,value)) from public.zoe_docs where tenant_id=$1),0)
                    +coalesce((select sum(private.zoe_op_bytes(op_id,result)) from public.zoe_ops where tenant_id=$1),0))::text as real from public.zoe_tenant_state s where tenant_id=$1`, [race.tenant])).rows[0];
                const newOps = after.ops.filter(op => !before.ops.some(old => old.op_id === op.op_id));
                check('paired distinct Reset race consumes one epoch sequence and fully charged winner receipt only', winner >= 0
                    && Number(after.state.seq) === Number(before.state.seq) + 1 && newOps.length === 1 && newOps[0].op_id === requests[winner].attemptId
                    && isDeepStrictEqual(newOps[0].result.reset, expected) && !after.ops.some(op => op.op_id === requests[loser].attemptId)
                    && account.bytes === account.real, { beforeState: before.state, afterState: after.state, account, newOps });
                const settled = await snapshot(race.tenant);
                const replay = winner < 0 ? null : await call('execute', requests[winner], race.who);
                const wonStatus = winner < 0 ? null : await call('status', requests[winner], race.who);
                const lostStatus = loser < 0 ? null : await call('status', requests[loser], race.who);
                check('paired race winner replays receipt only while losing status stays UNKNOWN without effects', replay?.replayed === true && replay.docs?.length === 0
                    && isDeepStrictEqual(replay.reset, expected) && isDeepStrictEqual(wonStatus?.reset, expected) && wonStatus?.docs?.length === 0
                    && lostStatus?.reset?.outcome === 'unknown' && lostStatus?.reset?.proof === 'none' && lostStatus?.docs?.length === 0
                    && isDeepStrictEqual(await snapshot(race.tenant), settled), { replay, wonStatus, lostStatus });
                paired.observations.push({ label: 'P1 distinct-ID race', requests, controllerPid, activities, outcomes, before, after, account, replay, wonStatus, lostStatus });
            } finally {
                try { await controller.query('rollback'); } catch (error) {}
                if (one) await one; if (two) await two;
                await controller.end(); await first.end(); await second.end();
            }
            const old = await pairedFixture('old BASE5 Reset cannot drop proof');
            const admissionRequest = await pairedRequest(old, matchedPrior, 'protected_admission');
            const proof = clone(await codec.pickupResetBoundReceipt(old.tenant, old.actor, admissionRequest.context,
                admissionRequest.attemptId, admissionRequest.casText, 'native-day'));
            const admissionOperation = JSON.parse(admissionRequest.casText); admissionOperation.v.pickupResetApplied = proof;
            const admitted = await pairedGeneric(old, admissionOperation, 'protected_admission');
            const protectedDay = await valueOf(old.tenant), oldRetained = clone(await pairedRetained(old));
            check('paired old Reset prestate is an actual authenticated receipt-bearing canonical commit', admitted.ok === true
                && isDeepStrictEqual(protectedDay, { pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0, pickupResetApplied: proof }), admitted);
            const oldRequest = await pairedRequest(old, protectedDay, 'old_base5'), operation = JSON.parse(oldRequest.casText);
            const oldBefore = await snapshot(old.tenant), refused = await pairedGeneric(old, operation, 'old_base5');
            const oldAfterRefusal = await snapshot(old.tenant);
            check('paired old BASE5 epoch Reset cannot erase protected proof or mutate money sequence bytes', refused.error?.code === '42501'
                && isDeepStrictEqual(Object.keys(operation.v).sort(), ['packagesPickedUp', 'pickedUpBarcodes', 'pickedUpPhones', 'pickupResetEpoch', 'pickupRevision'].sort())
                && operation.v.pickupRevision === 7 && operation.v.pickupResetEpoch === 4 && operation.v.packagesPickedUp === 0
                && operation.v.pickedUpPhones === null && operation.v.pickedUpBarcodes === null
                && isDeepStrictEqual(oldAfterRefusal, oldBefore) && isDeepStrictEqual(await pairedRetained(old), oldRetained), refused);
            const awareDay = { ...protectedDay, pickupRevision: 7, packagesPickedUp: 1,
                pickedUpPhones: { PHONE_B: 1 }, pickedUpBarcodes: { MATCHED_NEW: 'PHONE_B' } };
            const aware = await pairedGeneric(old, { k: 'cas', p: [PICKUP, DAY], x: protectedDay, v: awareDay }, 'proof_aware');
            check('paired proof-preserving ordinary writer remains allowed after old Reset refusal', admitted.ok === true && aware.ok === true
                && isDeepStrictEqual(await valueOf(old.tenant), awareDay) && isDeepStrictEqual(awareDay.pickupResetApplied, proof)
                && isDeepStrictEqual(await pairedRetained(old), oldRetained), aware);
            paired.observations.push({ label: 'P2 exact old BASE5 epoch Reset', admissionRequest, admitted, protectedDay, oldRequest, operation, oldBefore, oldAfterRefusal, refused, aware,
                afterAware: await snapshot(old.tenant) });
        }
        // F09 additive paired SQL profiles end.
    } finally { await c.end(); await H.stop(); }
}
function report(infrastructureFailures) {
    const migrationPath = path.join(ROOT, 'supabase/migrations', MIGRATION);
    const result = { pass: passed, fail: failed, skipped: 0, infrastructureFailures, cases, catalogEvidence, codecEvidence, concurrencyEvidence, callCounts, mode: BASELINE ? 'baseline-new-RPC-availability-only' : 'current',
        migration: MIGRATION, sourceHash: fs.existsSync(migrationPath) ? sha(fs.readFileSync(migrationPath)) : null, driverHash: sha(fs.readFileSync(__filename)) };
    console.log('\n' + passed + ' PASS · ' + failed + ' FAIL · infrastructure ' + infrastructureFailures);
    if (process.env.SUPABASE_RESET_RESULT) fs.writeFileSync(process.env.SUPABASE_RESET_RESULT, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
}
main().then(() => { report(0); process.exitCode = failed ? 1 : 0; })
    .catch(async error => { console.error(error.stack || error); try { await H.stop(); } catch (e) {} report(1); process.exitCode = 1; });
