import { afterAll, beforeAll, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHmac, randomBytes } from 'node:crypto';

const root = path.resolve(__dirname, '../../../..'), require = createRequire(import.meta.url);
const { createPgHarness } = require(root + '/tools/audit-tools/supabase-pg.js');
const { legacyRestoreVector } = require(root + '/tools/audit-tools/zto-restore-attestation-cases.cjs');
const archive = require(root + '/tools/firebase-backup/supabase.js');
const { terminalEnrichmentCases } = require(root + '/tools/audit-tools/fixtures/restore-terminal-enrichment.cjs');
const { sameTerminalBusiness } = require(root + '/ZoeW/netlify/functions/_shared/zto-restore-firebase.cjs');
const PG = createPgHarness({ depsDirs: [root + '/supabase/node_modules'], shimDir: root + '/tools/audit-tools/supabase-shim', wantMajor: 17 });
const secret = randomBytes(32), trash = 'zoew_recently_deleted_cod_dod';
let c: any, sequence = 0;
let functionMetadataBefore: any[];
const metadata = () => c.query("select proname,pg_get_function_identity_arguments(oid) signature,proacl::text,proconfig,prosecdef,provolatile,proparallel,pg_get_userbyid(proowner) owner from pg_proc where pronamespace='private'::regnamespace and proname in('zoe_restore_attest_v1','zoe_audit_fields_v1','zoe_audit_status_v1','zoe_audit_archive_summary_v1') order by proname");

beforeAll(async () => {
    await PG.start(); c = (await PG.freshDb('default-grants')).c;
    for (const file of fs.readdirSync(root + '/supabase/migrations').filter(name => name.endsWith('.sql')).sort()) {
        if (file.endsWith('_zoe_restore_terminal_decision.sql')) functionMetadataBefore = (await metadata()).rows;
        await c.query(fs.readFileSync(root + '/supabase/migrations/' + file, 'utf8'));
    }
    await c.query('insert into private.zoe_restore_attestor_keys(kid,secret) values($1,$2)', ['terminal-v1', secret]);
}, 30000);
afterAll(async () => { if (c) await c.end(); await PG.stop(); });

async function fixture(mode = 'cookie') {
    const id = 'terminal_' + (++sequence), branch = 'TERM' + sequence, tenant = (await c.query("insert into public.tenants(name,branch_code,expires_at) values($1,$2,now()+interval'1 day') returning id", [id, branch])).rows[0].id;
    const uid = await PG.makeAuthUser(c, id + '@users.zoew.invalid');
    await c.query('insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)', [uid, tenant, id]);
    const actor = await PG.sessionClaims(c, { role: 'authenticated', sub: uid });
    const vector = legacyRestoreVector(mode, id, uid), scope = 'https://terminal.invalid#' + tenant;
    vector.consumption.scope = scope;
    const write = (updates: any, admin = false) => PG.as(c, admin ? { role: 'service_role' } : actor,
        admin ? 'select public.zoe_admin_write($1,$2,$3::jsonb) r' : 'select public.zoe_write_v2($1,$2,$3::jsonb) r',
        [tenant, 'terminal_write_' + (++sequence), JSON.stringify(Object.entries(updates).map(([key, value]) => ({ k: 'set', p: key.split('/'), v: value })))]);
    expect((await write({ 'zoew_restore_policy/shop': { v: 1, mode: 'cookie', scope, branch, epoch: 1 }, [trash + '/' + id]: vector.source }, true)).error).toBeUndefined();
    const source = async () => (await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, trash, id])).rows[0].value;
    const context = async () => {
        const out = await PG.as(c, actor, 'select public.zoe_restore_context_v1($1,$2,$3,$4) r', [id, vector.claim.token, vector.claim.targetId, 0]);
        expect(out.error).toBeUndefined(); return out.rows[0].r;
    };
    const packet = (ctx: any, verdict: string, action = 'authorize') => ({ v: 1, kid: 'terminal-v1', action, tenantId: tenant, actorUid: uid,
        sessionId: actor.extra.session_id, scope, branch, sourceId: id, token: vector.claim.token, targetId: vector.claim.targetId,
        attestationId: ctx.source.restoreAttestationId || randomBytes(24).toString('hex'), mode: 'cookie', policyEpoch: 1,
        expectedSource: ctx.source, expectedRevision: ctx.expectedRevision, verdict, issuedAt: ctx.now, expiresAt: ctx.now + 120000 });
    const apply = async (value: any) => {
        const raw = JSON.stringify(value), signature = createHmac('sha256', secret).update(raw).digest('hex');
        return PG.as(c, actor, 'select public.zoe_restore_attest_v1($1,$2) r', [raw, signature]);
    };
    const grant = async () => (await c.query('select body from private.zoe_restore_attestations where tenant_id=$1 and source_id=$2', [tenant, id])).rows[0]?.body;
    const effects = async () => ({ docs: (await c.query('select root,key,value,seq from public.zoe_docs where tenant_id=$1 order by root,key', [tenant])).rows,
        state: (await c.query('select seq,bytes from public.zoe_tenant_state where tenant_id=$1', [tenant])).rows,
        ops: (await c.query('select op_id,result from public.zoe_ops where tenant_id=$1 order by op_id', [tenant])).rows,
        audit: (await c.query('select event_id from public.zoe_business_audit where tenant_id=$1 order by event_id', [tenant])).rows });
    return { id, tenant, uid, actor, scope, vector, source, write, context, packet, apply, grant, effects };
}

for (const verdict of ['signed', 'returned']) for (const released of [false, true]) it(verdict + ': trusted terminal metadata survives ' + (released ? 'release' : 'unprepared denial') + ' without financial or timestamp changes', async () => {
    const f = await fixture(), original = await f.source();
    if (released) expect((await f.apply(f.packet(await f.context(), 'allow'))).error).toBeUndefined();
    const terminal = f.packet(await f.context(), verdict, released ? 'refresh' : 'authorize');
    expect((await f.apply(terminal)).error).toBeUndefined();
    let source = await f.source(); expect(source.ztoTerminalDecision).toBe(verdict);
    const audit = (await c.query("select actor_uid,action,reason,previous_status,new_status,before_value,after_value,changed_fields from public.zoe_business_audit where tenant_id=$1 and record_key=$2 order by archive_seq desc limit 1", [f.tenant, f.id])).rows[0];
    expect(audit.actor_uid).toBe(f.uid); expect(audit.action).toBe('update'); expect(audit.reason).toBe(original.trashReason);
    expect(audit.new_status.ztoTerminalDecision).toBe(verdict); expect(audit.after_value.ztoTerminalDecision).toBe(verdict);
    expect(audit.changed_fields).toContain('ztoTerminalDecision');
    if (released) {
        expect((await f.apply(f.packet(await f.context(), 'unconfirmed', 'release'))).error).toBeUndefined();
        source = await f.source(); expect(source.restoreAttestationId).toBeUndefined(); expect(source.restoreClaim).toBeUndefined();
    }
    expect(source.ztoTerminalDecision).toBe(verdict); expect(source.trashReason).toBe(original.trashReason);
    for (const key of ['barcodes', 'cod', 'dod', 'price', 'count', 'deletedAt', 'createdAt']) expect(source[key]).toEqual(original[key]);
    expect(source.ztoSignedAt).toBeUndefined(); expect(source.ztoReturnedAt).toBeUndefined();
    const before = await f.effects();
    expect((await f.apply(f.packet(await f.context(), 'allow'))).rows[0].r.kind).toBe('deny');
    expect(await f.effects()).toEqual(before);
    expect((await c.query("select count(*)::int n from public.zoe_docs where tenant_id=$1 and root in('zoew_scan_history_cod_dod','zoew_trash_consumptions','zoew_daily_revenue_cod_dod','zoew_monthly_revenue_cod_dod')", [f.tenant])).rows[0].n).toBe(0);
});

it('ordinary clients cannot forge, downgrade or clear the terminal marker, including through whole-row writes', async () => {
    const f = await fixture(), before = await f.effects();
    for (const value of ['signed', 'returned', 'invalid', true]) {
        expect((await f.write({ [trash + '/' + f.id + '/ztoTerminalDecision']: value })).error?.code).toBe('42501');
        expect(await f.effects()).toEqual(before);
    }
    expect((await f.apply(f.packet(await f.context(), 'signed'))).error).toBeUndefined();
    const published = await f.effects(), source = await f.source(); delete source.ztoTerminalDecision;
    for (const updates of [{ [trash + '/' + f.id + '/ztoTerminalDecision']: null }, { [trash + '/' + f.id]: source }, { [trash + '/' + f.id + '/ztoTerminalDecision']: 'returned' }]) {
        expect((await f.write(updates)).error?.code).toBe('42501'); expect(await f.effects()).toEqual(published);
    }
});

it('concurrent metadata-only terminal observations allow Sign to dominate Return without rebasing changed business data', async () => {
    const f = await fixture(), observed = await f.context(), signing = f.packet(observed, 'signed');
    expect((await f.apply(f.packet(observed, 'returned'))).error).toBeUndefined();
    expect((await f.apply(signing)).error).toBeUndefined();
    expect((await f.source()).ztoTerminalDecision).toBe('signed'); expect((await f.grant()).verdict).toBe('signed');
    expect((await f.apply(f.packet(await f.context(), 'returned'))).rows[0].r.code).toBe('ZTO_RESTORE_TERMINAL_SIGNED');
    const before = await f.effects();
    const stale = f.packet(await f.context(), 'signed');
    await f.write({ [trash + '/' + f.id + '/barcodes/0/code']: 'DIFFERENT_BUSINESS_CODE' }, true);
    const changed = await f.effects(); expect(changed).not.toEqual(before);
    expect((await f.apply(stale)).error?.code).toBe('PT409'); expect(await f.effects()).toEqual(changed);
});

it('a trusted Returned decision cannot fall back to local financial restore after the shop policy changes', async () => {
    const f = await fixture('local');
    expect((await f.apply(f.packet(await f.context(), 'allow'))).error).toBeUndefined();
    expect((await f.apply(f.packet(await f.context(), 'returned', 'refresh'))).error).toBeUndefined();
    expect((await f.apply(f.packet(await f.context(), 'unconfirmed', 'release'))).error).toBeUndefined();
    expect((await f.source()).ztoTerminalDecision).toBe('returned');
    await f.write({ 'zoew_restore_policy/shop': { v: 1, mode: 'local', scope: f.scope, branch: '', epoch: 2 } }, true);
    const before = await f.effects();
    const claim = await f.write({ [trash + '/' + f.id + '/restoreClaim']: f.vector.claim });
    const prepared = await f.write({ ['zoew_scan_history_cod_dod/' + f.vector.claim.targetId]: f.vector.prepared });
    const finalized = await f.write(f.vector.finalPacket);
    expect([claim.error?.code, prepared.error?.code, finalized.error?.code]).toEqual(['42501', '42501', '42501']);
    expect(await f.effects()).toEqual(before);
});

it('the bounded decision survives SQL audit export, tool validation and audit-only retargeted restore', async () => {
    const f = await fixture(), target = await fixture();
    expect((await f.apply(f.packet(await f.context(), 'returned'))).error).toBeUndefined();
    const exported = await PG.as(c, { role: 'service_role' }, 'select public.zoe_admin_audit_export($1) r', [f.tenant]);
    expect(exported.error).toBeUndefined();
    const payload = { format: 'zoe-business-audit', version: 1, tenant: f.tenant,
        through: exported.rows[0].r.through, events: exported.rows[0].r.rows };
    expect(archive.validateAuditEnvelope(payload, f.tenant)).toEqual(payload);
    const event = payload.events.find((entry: any) => entry.new_status.ztoTerminalDecision === 'returned'); expect(event).toBeDefined();
    for (const invalid of ['allow', 'cookie', true, 1, null, {}, []]) {
        const changed = structuredClone(payload); changed.events.find((entry: any) => entry.event_id === event.event_id).new_status.ztoTerminalDecision = invalid;
        expect(() => archive.validateAuditEnvelope(changed, f.tenant)).toThrow();
        expect((await c.query('select private.zoe_audit_archive_summary_v1($1::jsonb) ok', [JSON.stringify({ exists: true, location: 'trash', ztoTerminalDecision: invalid })])).rows[0].ok).toBe(false);
    }
    const before = await target.effects();
    const imported = await PG.as(c, { role: 'service_role' }, 'select public.zoe_admin_audit_restore($1,$2,$3::jsonb) r', [target.tenant, f.tenant, JSON.stringify(payload.events)]);
    expect(imported.error).toBeUndefined();
    const after = await target.effects(); expect(after.docs).toEqual(before.docs); expect(after.state).toEqual(before.state); expect(after.ops).toEqual(before.ops);
    const restored = (await c.query('select actor_uid,origin_tenant_id,new_status from public.zoe_business_audit where tenant_id=$1 and event_id=$2', [target.tenant, event.event_id])).rows[0];
    expect(restored.actor_uid).toBe(f.uid); expect(restored.origin_tenant_id).toBe(f.tenant); expect(restored.new_status.ztoTerminalDecision).toBe('returned');
});

it('the actual SQL predicate accepts only the shared bounded terminal-enrichment vectors', async () => {
    const vectors = terminalEnrichmentCases(); expect(vectors.length).toBeGreaterThan(80);
    for (const vector of vectors) {
        const before = JSON.stringify([vector.before, vector.after]);
        const result = await c.query('select private.zoe_restore_terminal_business_v1($1::jsonb,$2::jsonb,$3) ok', [JSON.stringify(vector.before), JSON.stringify(vector.after), vector.sourceId]);
        expect(result.rows[0].ok, vector.name).toBe(vector.expected);
        expect(sameTerminalBusiness(vector.before, vector.after, vector.sourceId), vector.name).toBe(result.rows[0].ok);
        expect(JSON.stringify([vector.before, vector.after]), vector.name).toBe(before);
    }
    for (const role of ['anon', 'authenticated', 'service_role']) {
        const result = await PG.as(c, { role }, 'select private.zoe_restore_terminal_business_v1($1::jsonb,$2::jsonb,$3)', ['{}', '{}', 'source']);
        expect(PG.denied(result), role).toBe(true);
    }
});

it('the additive migration preserves existing function ownership, grants, execution mode and search paths', async () => {
    expect(functionMetadataBefore).toHaveLength(4);
    expect((await metadata()).rows).toEqual(functionMetadataBefore);
    const helper = (await c.query("select prosecdef,provolatile,proconfig,pg_get_userbyid(proowner) owner from pg_proc where oid='private.zoe_restore_terminal_business_v1(jsonb,jsonb,text)'::regprocedure")).rows[0];
    expect(helper).toEqual({ prosecdef: false, provolatile: 'i', proconfig: ['search_path=""'], owner: 'postgres' });
});

it('HMAC apply derives DENY from the stored marker even if the incoming verdict and private fact say allow', async () => {
    const f = await fixture();
    expect((await f.apply(f.packet(await f.context(), 'returned'))).error).toBeUndefined();
    await c.query("update private.zoe_restore_attestations set body=body||'{\"status\":\"allow\",\"verdict\":\"allow\"}'::jsonb where tenant_id=$1 and source_id=$2", [f.tenant, f.id]);
    const result = await f.apply(f.packet(await f.context(), 'allow'));
    expect(result.error).toBeUndefined(); expect(result.rows[0].r.kind).toBe('deny');
    expect((await f.grant()).verdict).toBe('returned'); expect((await f.source()).ztoTerminalDecision).toBe('returned');
});
