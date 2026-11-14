'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const KID = 'audit-fixture-v1';
const SECRET = Buffer.from('5d'.repeat(32), 'hex');

async function seedPgRestorePolicy({ H, c, tenant, policy }) {
    const result = await H.as(c, { role: 'service_role' }, 'select public.zoe_admin_write($1,$2,$3::jsonb) as r',
        [tenant, 'restore_policy_' + crypto.randomUUID(), JSON.stringify([{ k: 'set', p: ['zoew_restore_policy', 'shop'], v: policy }])]);
    assert.equal(result.error, undefined, 'trusted fixture policy provisioning failed');
}

// Direct protocol fixture: the synthetic signer stands in for verified upstream
// status. HMAC verification, actor/session admission, CAS and writes are real PG.
async function authorizePgRestore({ H, c, tenant, actor, sourceId, token, targetId, generation = 0, action = 'authorize', verdict = 'allow' }) {
    await c.query('insert into private.zoe_restore_attestor_keys(kid,secret) values($1,$2) on conflict(kid) do nothing', [KID, SECRET]);
    assert.equal((await c.query('select secret=$2::bytea as matches from private.zoe_restore_attestor_keys where kid=$1', [KID, SECRET])).rows[0]?.matches, true);
    const context = await H.as(c, actor, 'select public.zoe_restore_context_v1($1,$2,$3,$4) as r', [sourceId, token, targetId, generation]);
    assert.equal(context.error, undefined, 'actual restore context rejected the declared fixture actor/source');
    const ctx = context.rows[0].r;
    if (ctx.kind === 'already_applied') return ctx;
    const body = { v: 1, kid: KID, action, tenantId: tenant, actorUid: actor.sub, sessionId: actor.extra.session_id,
        scope: ctx.scope, branch: ctx.branch, sourceId, token, targetId,
        attestationId: ctx.source.restoreAttestationId || crypto.randomBytes(24).toString('hex'),
        mode: ['palm', 'cookie'].includes(ctx.source.trashMode) ? ctx.source.trashMode : ctx.policy.mode,
        policyEpoch: ctx.policy.epoch, expectedRevision: ctx.expectedRevision, expectedSource: ctx.source,
        verdict, issuedAt: ctx.now, expiresAt: ctx.now + 120000 };
    const payload = JSON.stringify(body), signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    const applied = await H.as(c, actor, 'select public.zoe_restore_attest_v1($1,$2) as r', [payload, signature]);
    assert.equal(applied.error, undefined, 'actual restore attestation rejected a correctly signed fixture');
    return applied.rows[0].r;
}

module.exports = { seedPgRestorePolicy, authorizePgRestore };
