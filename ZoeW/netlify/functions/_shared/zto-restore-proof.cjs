'use strict';

const crypto = require('crypto');
const { RestoreFailure, deadlineBudget, fetchJson, configuredOrigin, requestJson } = require('./zto-restore-http.cjs');
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const BRANCH = /^[A-Za-z0-9_-]{1,32}$/;
const CODE = /^[A-Za-z0-9_-]{6,64}$/;
const ACTIONS = ['authorize', 'refresh', 'rebind', 'release'];
const PROOF_TTL_MS = 120000;

function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function integer(value) { return Number.isSafeInteger(value) && value >= 0 && value <= 9007199254740990; }
function json(status, body, headers = {}) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', ...headers } });
}
function parseRequest(body) {
    const keys = ['v', 'action', 'sourceId', 'token', 'targetId', 'expectedGeneration'];
    if (!plain(body) || Object.keys(body).length !== keys.length || !keys.every(key => Object.hasOwn(body, key))
        || body.v !== 1 || !ACTIONS.includes(body.action) || typeof body.sourceId !== 'string' || !ID.test(body.sourceId)
        || typeof body.targetId !== 'string' || !ID.test(body.targetId)
        || typeof body.token !== 'string' || body.token.length < 1 || body.token.length > 2048
        || /[\u0000-\u001f\u007f]/.test(body.token) || !integer(body.expectedGeneration)) {
        throw new RestoreFailure('ZTO_RESTORE_INVALID_REQUEST', 400);
    }
    return body;
}
function routingClaims(token) {
    if (typeof token !== 'string' || token.length > 16384) throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401);
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401);
    try {
        const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (!plain(claims)) throw new Error('claims');
        return claims;
    } catch (_) { throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401); }
}

function supabaseBackend(env, token, claims, budget, fetchImpl, resolveOrigin = configuredOrigin, now = Date.now) {
    const base = resolveOrigin(env.SUPABASE_URL, 'supabase');
    const key = String(env.SUPABASE_PUBLISHABLE_KEY || '');
    const secret = String(env.ZOE_ZTO_RESTORE_ATTESTOR_SECRET || '');
    const kid = String(env.ZOE_ZTO_RESTORE_ATTESTOR_KEY_ID || 'restore-v1');
    let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
    if (!publicKey) {
        try { publicKey = routingClaims(key).role === 'anon'; } catch (_) {  }
    }
    if (!publicKey || key.length > 4096 || !/^[a-f0-9]{64}$/.test(secret) || !/^[A-Za-z0-9_-]{1,32}$/.test(kid)) {
        throw new RestoreFailure('ZTO_RESTORE_NOT_CONFIGURED');
    }
    if (claims.iss !== base + '/auth/v1' || claims.role !== 'authenticated' || !UUID.test(claims.sub)
        || !UUID.test(claims.session_id) || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now()) {
        throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401);
    }
    const headers = { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' };
    async function rpc(name, body) {
        const result = await fetchJson(base + '/rest/v1/rpc/' + name, { method: 'POST', headers, body: JSON.stringify(body) }, budget, { fetchImpl });
        if (!plain(result.value)) throw new RestoreFailure('ZTO_RESTORE_INVALID_RESPONSE');
        return result.value;
    }
    return {
        async context(input) {
            const context = await rpc('zoe_restore_context_v1', { p_source_id: input.sourceId, p_token: input.token,
                p_target_id: input.targetId, p_expected_generation: input.expectedGeneration });
            if (context.v !== 1 || context.actorUid !== claims.sub || context.sessionId !== claims.session_id
                || !UUID.test(context.tenantId) || typeof context.branch !== 'string' || !BRANCH.test(context.branch) || typeof context.scope !== 'string' || !context.scope
                || context.scope !== base + '#' + context.tenantId || !integer(context.expectedRevision)
                || !Number.isSafeInteger(context.now)) throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401);
            if (!Number.isSafeInteger(context.sessionCreatedAt) || context.sessionCreatedAt <= 0
                || !Number.isSafeInteger(context.sessionExpiresAt) || context.sessionExpiresAt <= now()
                || context.sessionCreatedAt + 4 * 3600000 <= now()) {
                throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401);
            }
            const clockSkew = context.now - now();
            if (Math.abs(clockSkew) > 10000) throw new RestoreFailure('ZTO_RESTORE_CLOCK_UNCONFIRMED');
            return { ...context, clockSkew, backend: 'supabase', expiresAt: Math.min(claims.exp * 1000, context.sessionExpiresAt, context.sessionCreatedAt + 4 * 3600000) };
        },
        async apply(input, context, verdict, attestationId) {
            budget.assert();
            const issuedAt = now();
            const expiresAt = Math.min(issuedAt + PROOF_TTL_MS, (context.verifiedAt ?? issuedAt) + PROOF_TTL_MS, context.expiresAt);
            if (expiresAt <= issuedAt || Math.abs(context.clockSkew) > 10000) throw new RestoreFailure('ZTO_RESTORE_CLOCK_UNCONFIRMED');
            const envelope = { v: 1, kid, action: input.action, tenantId: context.tenantId,
                actorUid: context.actorUid, sessionId: context.sessionId, scope: context.scope, branch: context.branch, sourceId: input.sourceId,
                token: input.token, targetId: input.targetId, attestationId, mode: effectiveMode(context), policyEpoch: context.policy.epoch,
                expectedSource: context.source, expectedRevision: context.expectedRevision,
                verdict, issuedAt, expiresAt };
            if (!integer(envelope.expectedRevision)) throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
            const text = JSON.stringify(envelope);
            const signature = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(text, 'utf8').digest('hex');
            return rpc('zoe_restore_attest_v1', { p_envelope: text, p_signature: signature });
        }
    };
}

function effectiveMode(context) {
    if (!plain(context.policy) || context.policy.v !== 1 || !['local', 'palm', 'cookie'].includes(context.policy.mode)
        || context.policy.scope !== context.scope || context.policy.branch !== context.branch || !integer(context.policy.epoch) || context.policy.epoch < 1) {
        throw new RestoreFailure('ZTO_RESTORE_POLICY_UNCONFIRMED');
    }
    return ['palm', 'cookie'].includes(context.source?.trashMode) ? context.source.trashMode : context.policy.mode;
}
function sourceCodes(source, now = Date.now) {
    if (!plain(source) || !plain(source.barcodes) && !Array.isArray(source.barcodes)) throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED');
    const rows = Object.keys(source.barcodes).map(key => {
        if (!/^(?:0|[1-9][0-9]*)$/.test(key)) throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED');
        return source.barcodes[key];
    }).filter(row => row !== null && row !== undefined);
    const codes = new Map();
    for (const row of rows) {
        if (!plain(row) || typeof row.code !== 'string' || !CODE.test(row.code)) throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED');
        const code = row.code.toUpperCase();
        for (const value of [row.createdAt, source.createdAt, row.restoredAt, source.restoredAt]) {
            if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED');
        }
        const basis = Math.max(Number(row.createdAt) || Number(source.createdAt) || 0,
            Number(row.restoredAt) || 0, Number(source.restoredAt) || 0);
        if (!Number.isSafeInteger(basis) || basis <= 0 || basis > now()) throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED');
        if (!codes.has(code) || codes.get(code) < basis) codes.set(code, basis);
    }
    if (!codes.size) throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED');
    return [...codes].map(([code, basis]) => ({ code, basis }));
}
function terminalDecisionRank(source) {
    if (!plain(source)) throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED');
    if (!Object.hasOwn(source, 'ztoTerminalDecision')) return 0;
    if (source.ztoTerminalDecision === 'returned') return 1;
    if (source.ztoTerminalDecision === 'signed') return 2;
    throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED');
}
function terminalSource(source) {
    const decision = terminalDecisionRank(source);
    const rows = Object.values(source?.barcodes || {});
    if (decision === 2 || source?.restoreBlocked === true || source?.trashMode === 'palm' && source?.trashReason === 'pickup'
        || rows.some(row => Number.isFinite(row?.ztoSignedAt) && row.ztoSignedAt > 0)) return 'signed';
    if (decision === 1 || source?.trashReason === 'returned' && rows.some(row => Number.isFinite(row?.ztoReturnedAt) && row.ztoReturnedAt > 0
        && row.ztoReturnedAt !== row.ztoMisplacedAt && row.ztoReturnedAt !== row.ztoSentOutAt)) return 'returned';
    return '';
}
function completedTuple(input, owner, state = owner) {
    const receipt = state.consumption, finalization = state.finalization;
    return state.source === null && plain(receipt) && Object.keys(receipt).length === 10
        && receipt.v === 1 && receipt.kind === 'restore' && receipt.sourceId === input.sourceId
        && receipt.generation === input.expectedGeneration && receipt.token === input.token && receipt.targetId === input.targetId
        && receipt.actorUid === owner.actorUid && receipt.scope === owner.scope && integer(receipt.deletedAt) && receipt.deletedAt > 0
        && integer(receipt.rowBirth) && (finalization === null || finalization === undefined
            || plain(finalization) && Object.keys(finalization).length === 3 && finalization.token === input.token
                && finalization.targetId === input.targetId && integer(finalization.finalizedAt) && finalization.finalizedAt > 0);
}

function createRestoreProofHandler({ lookup, firebaseBackend, env = process.env, fetchImpl = fetch, now = Date.now, resolveOrigin = configuredOrigin } = {}) {
    async function handle(request) {
        if (request.method !== 'POST') return json(405, { v: 1, success: false, code: 'ZTO_RESTORE_METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
        const budget = deadlineBudget(request.signal, 45000, now);
        try {
            const input = parseRequest(await requestJson(request, 8192, budget));
            const token = request.headers.get('x-zoe-id-token') || '';
            const claims = routingClaims(token);
            const backend = /\/auth\/v1$/.test(claims.iss || '')
                ? supabaseBackend(env, token, claims, budget, fetchImpl, resolveOrigin, now)
                : firebaseBackend ? await firebaseBackend({ env, token, claims, budget, fetchImpl, now })
                    : (() => { throw new RestoreFailure('ZTO_RESTORE_NOT_CONFIGURED'); })();
            const context = await backend.context(input);
            budget.assert();
            if (context.kind === 'already_applied') {
                if (!completedTuple(input, context)) throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                return json(200, { v: 1, success: true, kind: 'already_applied', source: null });
            }
            if (!plain(context.source) || Object.hasOwn(context.source, 'id') && context.source.id !== input.sourceId
                || (context.source.trashGeneration ?? 0) !== input.expectedGeneration) throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
            const mode = effectiveMode(context);
            if (mode === 'local') throw new RestoreFailure('ZTO_RESTORE_LOCAL_POLICY', 409);
            const existing = context.source.restoreAttestationId || context.reservedAttestationId;
            const attestationId = typeof existing === 'string' && ID.test(existing) ? existing : crypto.randomBytes(24).toString('hex');
            context.verifiedAt = now();
            let verdict = terminalSource(context.source);
            if (context.attestation?.status === 'deny' && context.attestation.generation === input.expectedGeneration
                && ['signed', 'returned'].includes(context.attestation.verdict)) {
                verdict = verdict === 'signed' || context.attestation.verdict === 'signed' ? 'signed' : 'returned';
            }
            if (input.action === 'release') verdict = 'unconfirmed';
            else if (!verdict) {
                try {
                    const codes = sourceCodes(context.source, now);
                    let cursor = 0;
                    let terminalSeen = false;
                    const outcomes = [];
                    const workers = Array.from({ length: Math.min(3, codes.length) }, async () => {
                        for (;;) {
                            budget.assert();
                            if (terminalSeen) return;
                            const index = cursor++;
                            if (index >= codes.length) return;
                            const { code, basis } = codes[index];
                            const headers = { 'x-zoe-id-token': token };
                            for (const name of ['x-zoe-proxy-key', 'x-zoe-palm-token']) {
                                const value = request.headers.get(name); if (value) headers[name] = value;
                            }
                            if (mode === 'palm') headers['x-zoe-palm-site'] = context.branch;
                            const event = { httpMethod: 'GET', headers, queryStringParameters: { barcode: code, restore: '1', ...(mode === 'palm' ? { palm: '1' } : {}) } };
                            const response = await lookup(event, { uid: context.actorUid, scope: context.scope,
                                branch: context.branch, expiresAt: Math.min(context.expiresAt, now() + budget.remaining()), basis, signal: request.signal });
                            budget.assert();
                            let body;
                            try { body = JSON.parse(response.body); } catch (_) { throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED'); }
                            const ownedRecord = plain(body) && (body.success === true && body.found === true && body.code === undefined
                                || body.success === false && body.found === false && body.code === 'ZTO_NO_CUSTOMER_DATA');
                            if (response.statusCode !== 200 || !ownedRecord || typeof body.barcode !== 'string' || !CODE.test(body.barcode)
                                || body.barcode.toUpperCase() !== code || body.cached !== false
                                || body.verifiedForRestore !== true || body.restoreTransitionsVerified !== true || typeof body.ztoClosed !== 'boolean') {
                                throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED');
                            }
                            if (body.ztoClosed === true) { outcomes[index] = 'signed'; terminalSeen = true; }
                            else if (body.ztoReturnedAt && body.ztoReturnedAt !== body.ztoMisplacedAt && body.ztoReturnedAt !== body.ztoSentOutAt) {
                                outcomes[index] = 'returned'; terminalSeen = true;
                            }
                            else if (body.verifiedForRestore === true && body.ztoClosed === false && body.restoreTransitionsVerified === true) outcomes[index] = 'allow';
                            else throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED');
                        }
                    });
                    const settled = await Promise.allSettled(workers);
                    if (outcomes.includes('signed')) verdict = 'signed';
                    else if (outcomes.includes('returned')) verdict = 'returned';
                    else if (settled.some(result => result.status === 'rejected') || outcomes.length !== codes.length || outcomes.some(outcome => outcome !== 'allow')) verdict = 'unconfirmed';
                    else verdict = 'allow';
                } catch (_) { verdict = 'unconfirmed'; }
            }
            budget.assert();
            const applied = await backend.apply(input, context, verdict, attestationId);
            budget.assert();
            if (!plain(applied) || applied.v !== 1 || applied.success !== true || !['allow', 'deny', 'hold', 'released', 'already_applied'].includes(applied.kind)) {
                throw new RestoreFailure('ZTO_RESTORE_INVALID_RESPONSE');
            }
            if (applied.kind === 'already_applied') {
                if (!completedTuple(input, context, applied)) throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                return json(200, { v: 1, success: true, kind: 'already_applied', source: null });
            }
            if (applied.kind === 'hold' || verdict === 'unconfirmed' && input.action !== 'release') return json(503, { v: 1, success: false, code: 'ZTO_RESTORE_UNCONFIRMED' });
            if (input.action === 'release' && !['released', 'already_applied'].includes(applied.kind)
                || input.action !== 'release' && verdict === 'allow' && !['allow', 'already_applied'].includes(applied.kind)
                || ['signed', 'returned'].includes(verdict) && applied.kind !== 'deny') throw new RestoreFailure('ZTO_RESTORE_INVALID_RESPONSE');
            if (applied.kind === 'allow' && (applied.attestationId !== attestationId || !plain(applied.source)
                || applied.source.id !== input.sourceId || applied.source.restoreAttestationId !== attestationId
                || applied.source.restoreClaim?.token !== input.token || applied.source.restoreClaim?.targetId !== input.targetId
                || !Number.isSafeInteger(applied.expiresAt) || applied.expiresAt <= now() || applied.expiresAt > now() + PROOF_TTL_MS)) {
                throw new RestoreFailure('ZTO_RESTORE_INVALID_RESPONSE');
            }
            return json(200, { v: 1, success: true, kind: applied.kind, attestationId: applied.attestationId,
                expiresAt: applied.expiresAt, source: applied.source ?? null,
                ...(['ZTO_RESTORE_TERMINAL_SIGNED', 'ZTO_RESTORE_TERMINAL_RETURNED'].includes(applied.code) && applied.kind === 'deny'
                    ? { code: applied.code } : verdict === 'signed' || verdict === 'returned' ? { code: 'ZTO_RESTORE_TERMINAL_' + verdict.toUpperCase() } : {}) });
        } catch (error) {
            return json(error instanceof RestoreFailure ? error.status : 503, { v: 1, success: false,
                code: error instanceof RestoreFailure ? error.code : 'ZTO_RESTORE_UNCONFIRMED' });
        }
    }
    return async function restoreProof(request) {
        const origin = request.headers.get('origin');
        const native = origin === 'https://localhost';
        const headers = native ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
        if (origin && origin !== new URL(request.url).origin && !native) return json(403, { v: 1, success: false, code: 'ZTO_RESTORE_ORIGIN_DENIED' });
        if (request.method === 'OPTIONS') {
            const method = request.headers.get('access-control-request-method');
            const names = String(request.headers.get('access-control-request-headers') || '').split(',').map(name => name.trim().toLowerCase()).filter(Boolean);
            if (method !== 'POST' || names.some(name => !['content-type', 'x-zoe-id-token', 'x-zoe-proxy-key', 'x-zoe-palm-token', 'x-zoe-palm-site'].includes(name))) {
                return json(403, { v: 1, success: false, code: 'ZTO_RESTORE_ORIGIN_DENIED' }, headers);
            }
            return new Response(null, { status: 204, headers: { ...headers, 'Cache-Control': 'no-store',
                'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': names.join(', '), 'Access-Control-Max-Age': '7200' } });
        }
        const response = await handle(request);
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        return response;
    };
}

module.exports = { createRestoreProofHandler, parseRequest, routingClaims, sourceCodes, effectiveMode, terminalSource, terminalDecisionRank, completedTuple, supabaseBackend, PROOF_TTL_MS };
