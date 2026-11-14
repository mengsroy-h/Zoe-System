// @vitest-environment node
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { createServer } from 'node:http';
import { expect, it, vi } from 'vitest';

const root = resolve(import.meta.dirname, '../../../..');
const corePath = resolve(root, 'ZoeW/netlify/functions/_shared/zto-order-detail-core.cjs');
const require = createRequire(import.meta.url);
const { createRestoreProofHandler, parseRequest, sourceCodes, supabaseBackend } = require(resolve(root, 'ZoeW/netlify/functions/_shared/zto-restore-proof.cjs'));
const { deadlineBudget, fetchJson, configuredOrigin } = require(resolve(root, 'ZoeW/netlify/functions/_shared/zto-restore-http.cjs'));

it('trusted restore authentication retains the verified Firebase actor and original login expiry', async () => {
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const now = Date.now();
    const claims = { aud: 'restore-proof-test', iss: 'https://securetoken.google.com/restore-proof-test',
        sub: 'owned-actor', email: 'test@zoew001.com', iat: Math.floor(now / 1000),
        exp: Math.floor(now / 1000) + 3600, auth_time: Math.floor(now / 1000) - 60 };
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const content = encode({ alg: 'RS256', kid: 'owned-key' }) + '.' + encode(claims);
    const token = content + '.' + sign('RSA-SHA256', Buffer.from(content), pair.privateKey).toString('base64url');
    const context = vm.createContext({ require: createRequire(corePath), module: { exports: {} }, exports: {},
        Buffer, URL, URLSearchParams, AbortController, Date, setTimeout, clearTimeout, process: { env: {} } });
    vm.runInContext(readFileSync(corePath, 'utf8') + '\nmodule.exports.verifyActor = verifyIdToken;\nmodule.exports.installKeys = (keys) => { certsState.keys=keys; certsState.at=Date.now(); };', context);
    context.module.exports.installKeys({ 'owned-key': pair.publicKey.export({ type: 'spki', format: 'pem' }) });
    const actor = await context.module.exports.verifyActor(token, ['restore-proof-test'], 1000);
    expect(actor.ok).toBe(true);
    expect(actor.uid).toBe('owned-actor');
    expect(actor.expiresAt).toBe(claims.exp * 1000);
    expect(actor.authTime).toBe(claims.auth_time * 1000);
    expect((await context.module.exports.verifyActor(token.slice(0, -3) + 'bad', ['restore-proof-test'], 1000)).ok).toBe(false);
});

const uid = 'f843c456-c820-4c3d-8da0-a1cb9208b50f';
const sid = 'f7bbc496-f0fb-485c-b7dd-447515e303f7';
const tenant = 'bfb1fc37-f87a-4d8a-9c2c-bfca85a92148';
const scope = 'https://restore-fixture.invalid#' + tenant;
const input = { v: 1, action: 'authorize', sourceId: 'trash-source', token: 'stable-attempt', targetId: 'history-target', expectedGeneration: 0 };
function makeToken(claims: unknown) {
    return 'e30.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.c2ln';
}
function fixture(overrides: Record<string, unknown> = {}, options: { lookupBody?: (code: string) => any; applyResult?: any; onLookup?: () => void } = {}) {
    const applies: any[] = [], reads: any[] = [], rpcCalls: string[] = [];
    let requestedInput = input;
    const source = { id: input.sourceId, deletedAt: Date.now() - 500, createdAt: Date.now() - 10000, trashMode: 'palm',
        barcodes: [{ code: 'TEST0001' }, { code: 'TEST0002' }] };
    const context = { v: 1, now: Date.now(), expectedRevision: 0, sessionCreatedAt: Date.now() - 60000, sessionExpiresAt: Date.now() + 3600000, tenantId: tenant, actorUid: uid, sessionId: sid, scope, branch: '001',
        policy: { v: 1, mode: 'palm', scope, branch: '001', epoch: 1 }, source, ...overrides };
    const handler = createRestoreProofHandler({ env: { SUPABASE_URL: 'https://restore-fixture.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_key',
        ZOE_ZTO_RESTORE_ATTESTOR_SECRET: '11'.repeat(32) },
        fetchImpl: async (url: string, init: any) => {
            rpcCalls.push(url);
            expect(init.redirect).toBe('error');
            if (url.endsWith('/zoe_restore_context_v1')) {
                expect(JSON.parse(init.body)).toEqual({ p_source_id: input.sourceId, p_token: input.token,
                    p_target_id: input.targetId, p_expected_generation: requestedInput.expectedGeneration });
                return Response.json(context);
            }
            expect(url.endsWith('/zoe_restore_attest_v1')).toBe(true);
            const signed = JSON.parse(init.body);
            const envelope = JSON.parse(signed.p_envelope);
            applies.push({ envelope, signature: signed.p_signature, raw: signed.p_envelope });
            return Response.json(options.applyResult || { v: 1, success: true, kind: envelope.verdict === 'allow' ? 'allow' : 'deny',
                attestationId: envelope.attestationId, expiresAt: envelope.expiresAt,
                source: { ...source, restoreAttestationId: envelope.attestationId, restoreClaim: { token: input.token, targetId: input.targetId, claimedAt: Date.now() } } });
        },
        lookup: async (event: any, identity: any) => {
            options.onLookup?.();
            reads.push({ event, identity });
            const code = event.queryStringParameters.barcode;
            return { statusCode: 200, body: JSON.stringify(options.lookupBody ? options.lookupBody(code) : { success: true, found: true, barcode: code, cached: false,
                verifiedForRestore: true, ztoClosed: false, restoreTransitionsVerified: true }) };
        }
    });
    const request = (body = input, claims: any = {}) => {
        requestedInput = body;
        return new Request('https://app.invalid/.netlify/functions/zto-restore-proof', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-zoe-proxy-key': 'synthetic-proxy-key',
            'x-zoe-id-token': makeToken({ iss: 'https://restore-fixture.invalid/auth/v1', sub: uid, session_id: sid,
                exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', ...claims }) }, body: JSON.stringify(body)
        });
    };
    return { handler, request, context, applies, reads, rpcCalls };
}

it('authorizes all server source codes and signs the exact actor/scope/snapshot, never request authority', async () => {
    const world = fixture();
    const response = await world.handler(world.request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.kind).toBe('allow');
    expect(world.reads.map((read: any) => read.event.queryStringParameters.barcode).sort()).toEqual(['TEST0001', 'TEST0002']);
    expect(world.reads.every((read: any) => read.identity.uid === uid && read.identity.scope === scope && read.identity.branch === '001')).toBe(true);
    expect(world.applies).toHaveLength(1);
    expect(world.applies[0].envelope.expectedSource).toEqual(world.context.source);
    expect(world.applies[0].envelope.actorUid).toBe(uid);
    expect(world.applies[0].envelope.sessionId).toBe(sid);
    expect(world.applies[0].envelope.targetId).toBe(input.targetId);
    expect(world.applies[0].envelope.scope).toBe(scope);
    expect(world.applies[0].envelope.expectedRevision).toBe(0);
    expect(Object.keys(world.applies[0].envelope).sort()).toEqual(['v', 'kid', 'action', 'tenantId', 'actorUid', 'sessionId', 'scope', 'branch',
        'sourceId', 'token', 'targetId', 'attestationId', 'mode', 'policyEpoch', 'expectedRevision', 'expectedSource', 'verdict', 'issuedAt', 'expiresAt'].sort());
    expect(world.applies[0].envelope.expiresAt - world.applies[0].envelope.issuedAt).toBeLessThanOrEqual(120000);
    const { createHmac } = await import('node:crypto');
    expect(world.applies[0].signature).toBe(createHmac('sha256', Buffer.from('11'.repeat(32), 'hex')).update(world.applies[0].raw).digest('hex'));
    expect(body).not.toHaveProperty('signature');
    expect(body).not.toHaveProperty('expectedSource');
});

it.each(['actorUid', 'sessionId'])('rejects a verified backend context for a different %s', async key => {
    const world = fixture({ [key]: '0c88aed4-ecc4-4ca9-a6d0-307c040eaf05' });
    expect((await world.handler(world.request())).status).toBe(401);
    expect(world.reads).toHaveLength(0);
    expect(world.applies).toHaveLength(0);
});
it.each([{ override: { branch: '002' }, status: 503 }, { override: { scope: 'other-scope' }, status: 401 },
    { override: { policy: null }, status: 503 }])('rejects unknown/mismatched trusted policy before upstream', async ({ override, status }) => {
    const world = fixture(override);
    expect((await world.handler(world.request())).status).toBe(status);
    expect(world.reads).toHaveLength(0);
    expect(world.applies).toHaveLength(0);
});
it('rejects a stale generation before any status read or grant', async () => {
    const world = fixture();
    expect((await world.handler(world.request({ ...input, expectedGeneration: 1 }))).status).toBe(409);
    expect(world.reads).toHaveLength(0);
    expect(world.applies).toHaveLength(0);
});
it('refuses expired tokens before retrieving source data', async () => {
    const world = fixture();
    expect((await world.handler(world.request(input, { exp: Math.floor(Date.now() / 1000) - 1 }))).status).toBe(401);
    expect(world.applies).toHaveLength(0);
    expect(world.reads).toHaveLength(0);
    expect(world.rpcCalls).toHaveLength(0);
});
it.each([{ barcodes: ['TEST0001'] }, { tenantId: tenant }, { mode: 'local' }, { expectedGeneration: -1 }, { action: 'sign' },
    { sourceId: null }, { targetId: 123 }])('rejects client authority/invalid attempts %j', override => {
    expect(() => parseRequest({ ...input, ...override })).toThrow('ZTO_RESTORE_INVALID_REQUEST');
});
it('rejects malformed or uncovered source codes instead of selecting a valid subset', () => {
    expect(() => sourceCodes({ createdAt: Date.now() - 1000, barcodes: [{ code: 'TEST0001' }, { code: 'bad' }] })).toThrow('ZTO_RESTORE_UNCONFIRMED');
});
it.each([
    { cached: true }, { verifiedForRestore: false }, { restoreTransitionsVerified: false }, { barcode: 'OTHER0001' }, { ztoClosed: null }
])('invalidates a prior allow and holds when any barcode lacks fresh complete evidence %j', async override => {
    const world = fixture({}, { lookupBody: code => ({ success: true, found: true, barcode: code, cached: false, verifiedForRestore: true,
        ztoClosed: false, restoreTransitionsVerified: true, ...(code === 'TEST0002' ? override : {}) }) });
    const response = await world.handler(world.request());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('ZTO_RESTORE_UNCONFIRMED');
    expect(world.applies).toHaveLength(1);
    expect(world.applies[0].envelope.verdict).toBe('unconfirmed');
    expect(world.reads).toHaveLength(2);
});
it.each(['signed', 'returned'])('persists a %s denial before returning its terminal response', async verdict => {
    const world = fixture({}, { lookupBody: code => ({ success: true, found: true, barcode: code, cached: false, verifiedForRestore: true,
        ztoClosed: verdict === 'signed' && code === 'TEST0002', restoreTransitionsVerified: true,
        ...(verdict === 'returned' && code === 'TEST0002' ? { ztoReturnedAt: '2026-11-14 12:00:00' } : {}) }) });
    const response = await world.handler(world.request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.kind).toBe('deny');
    expect(body.code).toBe('ZTO_RESTORE_TERMINAL_' + verdict.toUpperCase());
    expect(world.applies[0].envelope.verdict).toBe(verdict);
});
it('rejects a backend response that attempts to turn a terminal denial into allow', async () => {
    const world = fixture({}, { lookupBody: code => ({ success: true, found: true, barcode: code, cached: false,
        verifiedForRestore: true, restoreTransitionsVerified: true, ztoClosed: true }),
        applyResult: { v: 1, success: true, kind: 'allow' } });
    expect((await world.handler(world.request())).status).toBe(503);
    expect(world.applies[0].envelope.verdict).toBe('signed');
});
it.each([{ found: false }, { success: false }, { success: false, found: false, code: 'ZTO_OTHER_BRANCH' },
    { success: undefined }, { found: undefined }, { success: false, found: false, code: 'ZTO_OTHER_BRANCH', ztoClosed: true },
    { success: false, found: false, code: 'ZTO_OTHER_BRANCH', ztoReturnedAt: '2026-11-14 12:00:00' }
])('failed or foreign provider envelope cannot mint allow or false terminal denial %j', async bad => {
    const world = fixture({}, { lookupBody: code => ({ success: true, found: true, barcode: code, cached: false,
        verifiedForRestore: true, ztoClosed: false, restoreTransitionsVerified: true, ...bad }) });
    expect((await world.handler(world.request())).status).toBe(503);
    expect(world.applies).toHaveLength(1);
    expect(world.applies[0].envelope.verdict).toBe('unconfirmed');
});
it('accepts exact NO_CUSTOMER_DATA only with the complete fresh owned-branch contract', async () => {
    const world = fixture({}, { lookupBody: code => ({ success: false, found: false, code: 'ZTO_NO_CUSTOMER_DATA', barcode: code,
        cached: false, verifiedForRestore: true, ztoClosed: false, restoreTransitionsVerified: true }) });
    expect((await world.handler(world.request())).status).toBe(200);
    expect(world.applies[0].envelope.verdict).toBe('allow');
});
it('matches the provider canonical barcode identity while preserving the raw source snapshot', async () => {
    const world = fixture({}, { lookupBody: code => ({ success: true, found: true, barcode: code.toLowerCase(), cached: false,
        verifiedForRestore: true, ztoClosed: false, restoreTransitionsVerified: true }) });
    expect((await world.handler(world.request())).status).toBe(200);
    expect(world.applies[0].envelope.expectedSource).toEqual(world.context.source);
});
it('a legitimate 15-second provider read does not become database clock skew', async () => {
    vi.useFakeTimers();
    try {
        let delayed = false;
        const world = fixture({}, { onLookup: () => { if (!delayed) { delayed = true; vi.advanceTimersByTime(15000); } } });
        const response = await world.handler(world.request());
        expect(response.status).toBe(200);
        expect(world.applies).toHaveLength(1);
        expect(world.applies[0].envelope.verdict).toBe('allow');
        expect(world.applies[0].envelope.issuedAt - world.context.now).toBe(15000);
    } finally { vi.useRealTimers(); }
});
it('a genuine database/server clock skew still holds before granting', async () => {
    const world = fixture({ now: Date.now() + 20000 });
    const response = await world.handler(world.request());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('ZTO_RESTORE_CLOCK_UNCONFIRMED');
    expect(world.applies).toHaveLength(0);
});
it('a known terminal verdict stops new barcode scheduling and settles the three started reads', async () => {
    const source = { id: input.sourceId, deletedAt: Date.now() - 500, createdAt: Date.now() - 10000, trashMode: 'palm',
        barcodes: ['TEST0001', 'TEST0002', 'TEST0003', 'TEST0004'].map(code => ({ code })) };
    const world = fixture({ source }, { lookupBody: code => ({ success: true, found: true, barcode: code,
        cached: false, verifiedForRestore: true, restoreTransitionsVerified: true, ztoClosed: code === 'TEST0001' }) });
    const response = await world.handler(world.request());
    expect(response.status).toBe(200);
    expect((await response.json()).kind).toBe('deny');
    expect(world.applies[0].envelope.verdict).toBe('signed');
    expect(world.reads).toHaveLength(3);
    expect(world.reads.some((read: any) => read.event.queryStringParameters.barcode === 'TEST0004')).toBe(false);
});
function completedContext(extra: any = {}) {
    return { kind: 'already_applied', source: null, consumption: { v: 1, sourceId: input.sourceId, generation: 0, kind: 'restore',
        actorUid: uid, scope, deletedAt: Date.now() - 1000, rowBirth: Date.now() - 10000, token: input.token, targetId: input.targetId },
        finalization: { token: input.token, targetId: input.targetId, finalizedAt: Date.now() - 500 }, ...extra };
}
it('already-applied recovery verifies the exact committed business tuple without new upstream work', async () => {
    const world = fixture(completedContext());
    const response = await world.handler(world.request());
    expect(response.status).toBe(200);
    expect((await response.json()).kind).toBe('already_applied');
    expect(world.reads).toHaveLength(0);
    expect(world.applies).toHaveLength(0);
});
it.each(['generation', 'scope', 'targetId', 'actorUid'])('already-applied recovery rejects a mismatched receipt %s', async key => {
    const complete = completedContext();
    complete.consumption[key] = key === 'generation' ? 1 : 'foreign-value';
    const world = fixture(complete);
    expect((await world.handler(world.request())).status).toBe(409);
    expect(world.reads).toHaveLength(0);
    expect(world.applies).toHaveLength(0);
});
it('already-applied recovery rejects a present but mismatched finalization', async () => {
    const world = fixture(completedContext({ finalization: { token: 'foreign-token', targetId: input.targetId, finalizedAt: Date.now() } }));
    expect((await world.handler(world.request())).status).toBe(409);
    expect(world.reads).toHaveLength(0);
    expect(world.applies).toHaveLength(0);
});
it('an exact committed consumption remains recoverable after post-ACK finalization cleanup', async () => {
    const world = fixture(completedContext({ finalization: null }));
    const response = await world.handler(world.request());
    expect(response.status).toBe(200);
    expect((await response.json()).kind).toBe('already_applied');
    expect(world.reads).toHaveLength(0);
    expect(world.applies).toHaveLength(0);
});
it('a concurrently committed exact receipt wins over a later unconfirmed lookup', async () => {
    const world = fixture({}, { lookupBody: code => ({ success: false, found: false, code: 'ZTO_OTHER_BRANCH', barcode: code,
        cached: false, verifiedForRestore: true, ztoClosed: false, restoreTransitionsVerified: true }),
        applyResult: { v: 1, success: true, ...completedContext() } });
    const response = await world.handler(world.request());
    expect(response.status).toBe(200);
    expect((await response.json()).kind).toBe('already_applied');
    expect(world.applies).toHaveLength(1);
});
it('backend HOLD is retryable uncertainty rather than an invalid success envelope', async () => {
    const world = fixture({}, { lookupBody: code => ({ success: true, found: true, barcode: code, cached: false,
        verifiedForRestore: true, ztoClosed: null, restoreTransitionsVerified: false }), applyResult: { v: 1, success: true, kind: 'hold' } });
    const response = await world.handler(world.request());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('ZTO_RESTORE_UNCONFIRMED');
});
it('a refreshed JWT cannot extend the original four-hour authenticated session', async () => {
    const world = fixture({ sessionCreatedAt: Date.now() - 4 * 3600000 - 1, sessionExpiresAt: Date.now() + 3600000 });
    expect((await world.handler(world.request())).status).toBe(401);
    expect(world.reads).toHaveLength(0);
    expect(world.applies).toHaveLength(0);
});
it.each([32, 33])('attestor key ID length %d matches the database key schema', length => {
    const open = () => supabaseBackend({ SUPABASE_URL: 'https://restore-fixture.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_key',
        ZOE_ZTO_RESTORE_ATTESTOR_SECRET: '11'.repeat(32), ZOE_ZTO_RESTORE_ATTESTOR_KEY_ID: 'k'.repeat(length) }, 'synthetic-unused',
        { iss: 'https://restore-fixture.invalid/auth/v1', role: 'authenticated', sub: uid, session_id: sid, exp: Math.floor(Date.now() / 1000) + 3600 }, deadlineBudget(),
        async () => { throw new Error('no request expected'); });
    if (length === 32) expect(open).not.toThrow();
    else expect(open).toThrow('ZTO_RESTORE_NOT_CONFIGURED');
});
it.each(['signed', 'returned'])('reuses only a trusted generation terminal %s denial while the provider is unavailable', async verdict => {
    const world = fixture({ attestation: { v: 1, id: 'server-existing-proof', status: 'deny', verdict, generation: 0,
        sourceId: input.sourceId, token: input.token, targetId: input.targetId, actorUid: uid, scope, branch: '001' } },
    { lookupBody: () => { throw new Error('provider offline'); } });
    Object.assign(world.context.source, { restoreAttestationId: 'server-existing-proof',
        restoreClaim: { token: input.token, targetId: input.targetId, claimedAt: Date.now() } });
    world.context.expectedRevision = 1;
    const response = await world.handler(world.request({ ...input, action: 'refresh' }));
    expect(response.status).toBe(200);
    expect((await response.json()).kind).toBe('deny');
    expect(world.reads).toHaveLength(0);
    expect(world.applies[0].envelope.verdict).toBe(verdict);
});

it.each([{ restoreBlocked: true }, { ztoTerminalDecision: 'signed' }])('a current Signed source outranks a private Returned denial (%j)', async sourceMark => {
    const world = fixture({ attestation: { status: 'deny', verdict: 'returned', generation: 0 } });
    Object.assign(world.context.source, sourceMark);
    const response = await world.handler(world.request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ kind: 'deny', code: 'ZTO_RESTORE_TERMINAL_SIGNED' });
    expect(world.applies[0].envelope.verdict).toBe('signed');
    expect(world.reads).toHaveLength(0);
});
it('a private Signed denial outranks a returned source decision without querying providers', async () => {
    const world = fixture({ attestation: { status: 'deny', verdict: 'signed', generation: 0 } });
    Object.assign(world.context.source, { ztoTerminalDecision: 'returned' });
    const response = await world.handler(world.request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ code: 'ZTO_RESTORE_TERMINAL_SIGNED' });
    expect(world.applies[0].envelope.verdict).toBe('signed');
    expect(world.reads).toHaveLength(0);
});

it.each(['unknown', 'Signed', null, false, 0, {}, []])('malformed terminal decision %j holds before provider or authority writes', async marker => {
    const world = fixture();
    Object.assign(world.context.source, { ztoTerminalDecision: marker });
    const response = await world.handler(world.request());
    expect(response.status).toBe(503);
    expect(world.reads).toHaveLength(0);
    expect(world.applies).toHaveLength(0);
});
it('cancelling the request settles started lookups and publishes no private grant', async () => {
    const abort = new AbortController();
    const world = fixture({}, { onLookup: () => abort.abort() });
    const request = new Request(world.request(), { signal: abort.signal });
    const response = await world.handler(request);
    expect(response.status).toBe(499);
    expect(world.applies).toHaveLength(0);
    expect(world.rpcCalls).toHaveLength(1);
    expect(world.reads.every((read: any) => read.identity.signal === request.signal)).toBe(true);
});
it.each([0, -1, 1.5, 9007199254740991])('policy epoch %s is refused before provider work or proof write', async epoch => {
    const world = fixture({ policy: { v: 1, mode: 'palm', scope, branch: '001', epoch } });
    expect((await world.handler(world.request())).status).toBe(503);
    expect(world.reads).toHaveLength(0);
    expect(world.applies).toHaveLength(0);
});
it.each([1, 9007199254740990])('positive reserved-safe policy epoch %s remains valid', async epoch => {
    const world = fixture({ policy: { v: 1, mode: 'palm', scope, branch: '001', epoch } });
    expect((await world.handler(world.request())).status).toBe(200);
    expect(world.applies[0].envelope.policyEpoch).toBe(epoch);
});
it('a higher-priority applied Sign determines the terminal response code', async () => {
    const world = fixture({}, { lookupBody: code => ({ success: true, found: true, barcode: code, cached: false,
        verifiedForRestore: true, restoreTransitionsVerified: true, ztoClosed: false, ztoReturnedAt: '2026-11-14 12:00:00' }),
        applyResult: { v: 1, success: true, kind: 'deny', code: 'ZTO_RESTORE_TERMINAL_SIGNED', source: null } });
    const response = await world.handler(world.request());
    expect(response.status).toBe(200);
    expect((await response.json()).code).toBe('ZTO_RESTORE_TERMINAL_SIGNED');
});
it('native preflight is read only and never loads credentials/source or refreshes a session', async () => {
    const world = fixture();
    const response = await world.handler(new Request('https://app.invalid/.netlify/functions/zto-restore-proof', { method: 'OPTIONS',
        headers: { origin: 'https://localhost', 'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type,x-zoe-id-token,x-zoe-palm-token' } }));
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://localhost');
    expect(world.applies).toHaveLength(0);
    expect(world.reads).toHaveLength(0);
    expect(world.rpcCalls).toHaveLength(0);
});
it('rejects foreign browser origins before any business read', async () => {
    const world = fixture();
    const original = world.request();
    original.headers.set('origin', 'https://foreign.invalid');
    expect((await world.handler(original)).status).toBe(403);
    expect(world.applies).toHaveLength(0);
    expect(world.reads).toHaveLength(0);
});

it.each(['http://example.invalid', 'https://user:pass@example.invalid', 'https://example.invalid/path', 'https://example.invalid/?url=x', 'https://example.invalid/#fragment'])('rejects unsafe configured origin %s', url => {
    expect(() => configuredOrigin(url, 'supabase')).toThrow('ZTO_RESTORE_NOT_CONFIGURED');
});
it('rejects a body that exceeds the streaming limit before parsing', async () => {
    await expect(fetchJson('https://fixed.invalid', {}, deadlineBudget(), { maximumBytes: 5,
        fetchImpl: async () => Response.json({ data: 'too large' }) })).rejects.toMatchObject({ code: 'ZTO_RESTORE_RESPONSE_TOO_LARGE' });
});
it('bounds a response body that stalls after headers and cancels its reader', async () => {
    let cancelled = 0;
    await expect(fetchJson('https://fixed.invalid', {}, deadlineBudget(), { timeoutMs: 15,
        fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'Content-Type': 'application/json' } })
    })).rejects.toMatchObject({ code: 'ZTO_RESTORE_TIMEOUT' });
    expect(cancelled).toBe(1);
});
it('never forwards an actor token across a real HTTP redirect', async () => {
    let foreignRequests = 0;
    let firstAuthenticatedRequests = 0;
    const receiver = createServer((_req, res) => { foreignRequests++; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); });
    const redirector = createServer((req, res) => {
        if (req.headers.authorization === 'Bearer synthetic-only') firstAuthenticatedRequests++;
        res.writeHead(307, { Location: 'http://127.0.0.1:' + (receiver.address() as any).port }); res.end();
    });
    await new Promise<void>(resolve => receiver.listen(0, '127.0.0.1', resolve));
    await new Promise<void>(resolve => redirector.listen(0, '127.0.0.1', resolve));
    try {
        await expect(fetchJson('http://127.0.0.1:' + (redirector.address() as any).port,
            { headers: { Authorization: 'Bearer synthetic-only' } }, deadlineBudget())).rejects.toMatchObject({ code: 'ZTO_RESTORE_BACKEND_UNAVAILABLE' });
        expect(foreignRequests).toBe(0);
        expect(firstAuthenticatedRequests).toBe(1);
    } finally {
        redirector.closeAllConnections(); receiver.closeAllConnections();
        await Promise.all([new Promise<void>(resolve => redirector.close(() => resolve())), new Promise<void>(resolve => receiver.close(() => resolve()))]);
    }
});
