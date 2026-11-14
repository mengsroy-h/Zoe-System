// @vitest-environment node
// Production issuer/controller + actual PostgreSQL protocol and HMAC. The local
// PostgREST transport verifies a synthetic JWT; this is not a hosted Auth test.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '../../../..');
const { createPgHarness } = require(root + '/tools/audit-tools/supabase-pg.js');
const { createRestoreProofHandler } = require(root + '/ZoeW/netlify/functions/_shared/zto-restore-proof.cjs');
const { legacyRestoreVector } = require(root + '/tools/audit-tools/zto-restore-attestation-cases.cjs');
const PG = createPgHarness({ depsDirs: [root + '/supabase/node_modules'], shimDir: root + '/tools/audit-tools/supabase-shim', wantMajor: 17 });
const base = 'https://issuer-pg-fixture.invalid';
const secret = '22'.repeat(32), jwtKey = 'synthetic-local-jwt-authority';
const trash = 'zoew_recently_deleted_cod_dod', history = 'zoew_scan_history_cod_dod';
let c: any, sequence = 0, operation = 0;
const ops = (values: any) => Object.entries(values).map(([path, value]) => ({ k: 'set', p: path.split('/'), v: value }));

beforeAll(async () => {
    if (PG.unavailableReason()) throw new Error(PG.unavailableReason());
    await PG.start();
    c = (await PG.freshDb('no-default-grants')).c;
    for (const file of readdirSync(root + '/supabase/migrations').filter(name => name.endsWith('.sql')).sort()) {
        await c.query(readFileSync(root + '/supabase/migrations/' + file, 'utf8'));
    }
    await c.query("insert into private.zoe_restore_attestor_keys(kid,secret) values('restore-v1',decode($1,'hex'))", [secret]);
}, 30000);
afterAll(async () => { if (c) await c.end(); await PG.stop(); });

function signedJwt(claims: any) {
    const body = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url');
    return body + '.' + createHmac('sha256', jwtKey).update(body).digest('base64url');
}
function verifyJwt(token: string) {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('jwt');
    const signature = Buffer.from(parts[2], 'base64url');
    const expected = createHmac('sha256', jwtKey).update(parts.slice(0, 2).join('.')).digest();
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) throw new Error('jwt');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (claims.iss !== base + '/auth/v1' || claims.role !== 'authenticated' || claims.exp * 1000 <= Date.now()) throw new Error('jwt');
    return claims;
}
async function makeWorld() {
    const id = ++sequence, branch = String(id).padStart(6, '0');
    const tenant = (await c.query("insert into public.tenants(name,branch_code,expires_at) values($1,$2,now()+interval '1 day') returning id", ['issuer-' + id, branch])).rows[0].id;
    const uid = await PG.makeAuthUser(c, 'issuer-' + id + '@users.zoew.invalid');
    await c.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [uid, tenant, 'issuer_' + id]);
    const who = await PG.sessionClaims(c, { role: 'authenticated', sub: uid, extra: { exp: Math.floor(Date.now() / 1000) + 3600, iss: base + '/auth/v1' } });
    const vector = legacyRestoreVector('palm', 'issuer_' + id, uid);
    vector.consumption.scope = base + '#' + tenant;
    vector.prepared.restoreAddedCodes = JSON.stringify([vector.source.barcodes[0].code]);
    const input = { v: 1, action: 'authorize', sourceId: vector.source.id, token: vector.claim.token, targetId: vector.claim.targetId, expectedGeneration: 0 };
    const write = (values: any, op = 'issuer_write_' + String(++operation).padStart(12, '0')) =>
        PG.as(c, who, 'select public.zoe_write_v2($1,$2,$3::jsonb) r', [tenant, op, JSON.stringify(ops(values))]);
    const seed = async (values: any) => {
        const result = await PG.as(c, { role: 'service_role' }, 'select public.zoe_admin_write($1,$2,$3::jsonb) r',
            [tenant, 'issuer_seed_' + String(++operation).padStart(12, '0'), JSON.stringify(ops(values))]);
        expect(result.error).toBeUndefined();
    };
    await seed({ ['zoew_restore_policy/shop']: { v: 1, mode: 'palm', scope: base + '#' + tenant, branch, epoch: 1 },
        [trash + '/' + vector.source.id]: vector.source,
        ['zoew_daily_revenue_cod_dod/' + vector.day]: { codDollar: 0, dodDollar: 0, totalCount: 0 },
        ['zoew_monthly_revenue_cod_dod/' + vector.month]: { codDollar: 0, dodDollar: 0, totalCount: 0 } });
    let providerBody: (code: string) => any = code => ({ success: true, found: true, barcode: code, cached: false,
        verifiedForRestore: true, restoreTransitionsVerified: true, ztoClosed: false });
    let beforeApply: ((body: any) => Promise<void>) | undefined;
    let calls = 0;
    const handler = createRestoreProofHandler({ env: { SUPABASE_URL: base, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_key', ZOE_ZTO_RESTORE_ATTESTOR_SECRET: secret },
        lookup: async (event: any) => { calls++; return { statusCode: 200, body: JSON.stringify(providerBody(event.queryStringParameters.barcode)) }; },
        fetchImpl: async (url: string, init: any) => {
            expect(init.redirect).toBe('error');
            expect(new URL(url).origin).toBe(base);
            let claims;
            try { claims = verifyJwt(String(init.headers.Authorization).replace(/^Bearer /, '')); }
            catch { return Response.json({ code: 'PT401' }, { status: 401 }); }
            const caller = { role: 'authenticated', sub: claims.sub, extra: { session_id: claims.session_id, exp: claims.exp, iss: claims.iss } };
            const body = JSON.parse(init.body);
            let result;
            if (url.endsWith('/zoe_restore_context_v1')) result = await PG.as(c, caller,
                'select public.zoe_restore_context_v1($1,$2,$3,$4) r', [body.p_source_id, body.p_token, body.p_target_id, body.p_expected_generation]);
            else {
                expect(url.endsWith('/zoe_restore_attest_v1')).toBe(true);
                await beforeApply?.(body);
                result = await PG.as(c, caller, 'select public.zoe_restore_attest_v1($1,$2) r', [body.p_envelope, body.p_signature]);
            }
            if (result.error) return Response.json({ code: result.error.code }, { status: result.error.code === 'PT401' ? 401 : 409 });
            return Response.json(result.rows[0].r);
        }
    });
    const tokenClaims = { role: 'authenticated', sub: uid, ...who.extra, iss: base + '/auth/v1' };
    const request = (change: any = {}, claims: any = {}) => new Request('https://app.invalid/.netlify/functions/zto-restore-proof', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-zoe-id-token': signedJwt({ ...tokenClaims, ...claims }) },
        body: JSON.stringify({ ...input, ...change }) });
    const read = async (name: string, key: string) => (await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, name, key])).rows[0]?.value ?? null;
    const proof = async () => (await c.query('select body from private.zoe_restore_attestations where tenant_id=$1 and source_id=$2', [tenant, input.sourceId])).rows[0]?.body ?? null;
    return { handler, request, input, vector, tenant, uid, who, write, seed, read, proof, get calls() { return calls; },
        provider(body: typeof providerBody) { providerBody = body; }, beforeApply(fn: typeof beforeApply) { beforeApply = fn; } };
}

it('real issuer HMAC/context authorizes one financial effect, refreshes before commit and recovers exact lost ACK', async () => {
    const w = await makeWorld();
    const authorized = await w.handler(w.request());
    expect(authorized.status).toBe(200);
    const granted = await authorized.json();
    expect(granted.kind).toBe('allow');
    expect((await w.proof()).actorUid).toBe(w.uid);
    expect((await w.read(trash, w.input.sourceId)).restoreAttestationId).toBe(granted.attestationId);
    expect((await w.write({ [history + '/' + w.input.targetId]: w.vector.prepared })).error).toBeUndefined();
    expect((await w.handler(w.request({ action: 'refresh' }))).status).toBe(200);
    const operationId = 'issuer_final_' + w.input.sourceId;
    expect((await w.write(w.vector.finalPacket, operationId)).rows?.[0]?.r?.ok).toBe(true);
    const auditBeforeReplay = Number((await c.query('select count(*)::int n from public.zoe_business_audit where tenant_id=$1 and operation_id=$2', [w.tenant, operationId])).rows[0].n);
    expect((await w.write(w.vector.finalPacket, operationId)).rows?.[0]?.r?.ok).toBe(true);
    const auditAfterReplay = Number((await c.query('select count(*)::int n from public.zoe_business_audit where tenant_id=$1 and operation_id=$2', [w.tenant, operationId])).rows[0].n);
    expect(auditBeforeReplay).toBeGreaterThan(0);
    expect(auditAfterReplay).toBe(auditBeforeReplay);
    const recovered = await w.handler(w.request());
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).kind).toBe('already_applied');
    expect(w.calls).toBe(2);
    expect(await w.read('zoew_daily_revenue_cod_dod', w.vector.day)).toEqual(w.vector.money);
    expect(await w.read('zoew_monthly_revenue_cod_dod', w.vector.month)).toEqual(w.vector.money);
    expect(await w.read('zoew_trash_consumptions', w.input.sourceId)).toEqual(w.vector.consumption);
    expect(await w.read(trash, w.input.sourceId)).toBeNull();
    const live = await w.read(history, w.input.targetId);
    expect(live.count).toBe(1);
    expect(Object.values(live.barcodes).map((row: any) => row.code)).toEqual([w.vector.source.barcodes[0].code]);
    const events = (await c.query('select count(*)::int n from private.zoe_restore_attestation_events where tenant_id=$1', [w.tenant])).rows[0].n;
    expect(events).toBe(2);
    expect((await c.query('select count(*)::int n from public.zoe_ops where tenant_id=$1 and op_id=$2', [w.tenant, operationId])).rows[0].n).toBe(1);
    const exported = await PG.as(c, { role: 'service_role' }, 'select public.zoe_admin_export($1) r', [w.tenant]);
    expect(exported.error).toBeUndefined();
    expect(exported.rows[0].r.more).toBe(false);
    const records = new Map(exported.rows[0].r.rows.map((row: any) => [row.r + '/' + row.k, row.v]));
    expect(records.get(history + '/' + w.input.targetId)).toEqual(live);
    expect(records.get('zoew_trash_consumptions/' + w.input.sourceId)).toEqual(w.vector.consumption);
    expect(records.get('zoew_daily_revenue_cod_dod/' + w.vector.day)).toEqual(w.vector.money);
    expect(records.get('zoew_monthly_revenue_cod_dod/' + w.vector.month)).toEqual(w.vector.money);
    expect(records.has(trash + '/' + w.input.sourceId)).toBe(false);
});

it('real protocol replaces allow with HOLD on unknown provider evidence without changing money', async () => {
    const w = await makeWorld();
    expect((await w.handler(w.request())).status).toBe(200);
    w.provider(code => ({ success: false, found: false, code: 'ZTO_OTHER_BRANCH', barcode: code, cached: false,
        verifiedForRestore: true, restoreTransitionsVerified: true, ztoClosed: true }));
    const response = await w.handler(w.request({ action: 'refresh' }));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('ZTO_RESTORE_UNCONFIRMED');
    expect((await w.proof()).status).toBe('hold');
    expect((await w.proof()).verdict).toBe('unconfirmed');
    expect((await w.read(trash, w.input.sourceId)).restoreBlocked).not.toBe(true);
    expect(await w.read('zoew_daily_revenue_cod_dod', w.vector.day)).toEqual({ codDollar: 0, dodDollar: 0, totalCount: 0 });
    expect(await w.read('zoew_trash_consumptions', w.input.sourceId)).toBeNull();
});

it('real context rejects a foreign owned SID before upstream work', async () => {
    const w = await makeWorld();
    const other = await PG.makeAuthUser(c, 'issuer-foreign-' + sequence + '@users.zoew.invalid');
    const foreign = await PG.sessionClaims(c, { role: 'authenticated', sub: other });
    expect((await w.handler(w.request({}, { session_id: foreign.extra.session_id }))).status).toBe(401);
    expect(w.calls).toBe(0);
    expect(await w.proof()).toBeNull();
});

it('actual source changes after provider verification reject the signed stale snapshot', async () => {
    const w = await makeWorld();
    w.beforeApply(async () => { await w.seed({ [trash + '/' + w.input.sourceId]: { ...w.vector.source, phone: 'changed-owner' } }); });
    expect((await w.handler(w.request())).status).toBe(503);
    expect(await w.proof()).toBeNull();
    expect((await w.read(trash, w.input.sourceId)).phone).toBe('changed-owner');
    expect(await w.read('zoew_daily_revenue_cod_dod', w.vector.day)).toEqual({ codDollar: 0, dodDollar: 0, totalCount: 0 });
});
