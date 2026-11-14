'use strict';

const crypto = require('crypto');
const { RestoreFailure, fetchJson, configuredOrigin } = require('./zto-restore-http.cjs');
const { sourceCodes, effectiveMode, completedTuple, PROOF_TTL_MS } = require('./zto-restore-proof.cjs');
const SOURCE_ROOT = 'zoew_recently_deleted_cod_dod';
const HISTORY_ROOT = 'zoew_scan_history_cod_dod';
const PROOF_ROOT = 'zoew_restore_attestations';
const CERTS = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= 9007199254740990;
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);

function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (plain(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    return JSON.stringify(value);
}
function hash(value) { return crypto.createHash('sha256').update(canonical(value)).digest('hex'); }
function rows(value) {
    if (!plain(value) && !Array.isArray(value)) throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED');
    return Object.keys(value).filter(key => value[key] !== null && value[key] !== undefined).sort((a, b) => Number(a) - Number(b)).map(key => {
        if (!/^(?:0|[1-9][0-9]*)$/.test(key) || !plain(value[key])) throw new RestoreFailure('ZTO_RESTORE_UNCONFIRMED');
        return value[key];
    });
}
function allowedTargetSlots(source, target, sourceId = source.id) {
    const sourceRows = rows(source.barcodes);
    const prepared = target && target.restoreClaimId === sourceId;
    const combined = target ? rows(target.barcodes) : sourceRows.slice();
    if (target && !prepared) {
        for (const row of sourceRows) if (!combined.some(existing => existing.code === row.code)) combined.push(row);
    }
    const codes = new Set(sourceRows.map(row => row.code));
    const out = {};
    combined.forEach((row, index) => {
        if (typeof row.code !== 'string' || !row.code || row.code.length > 2048) throw new RestoreFailure('ZTO_RESTORE_TARGET_CHANGED', 409);
        out[index] = row.code;
    });
    if (!prepared && [...codes].some(code => !Object.values(out).includes(code))) throw new RestoreFailure('ZTO_RESTORE_TARGET_CHANGED', 409);
    return out;
}
function appliedConsumption(input, actor, scope, source, consumption, finalization) {
    return completedTuple(input, { actorUid: actor.uid, scope }, { source, consumption, finalization });
}
function sameTerminalBusiness(before, current, sourceId) {
    if (!plain(before) || !plain(current)) return false;
    if (Object.hasOwn(before, 'id') ? before.id !== sourceId || current.id !== before.id
        : Object.hasOwn(current, 'id') && current.id !== sourceId) return false;
    if (canonical(before.restoreBlocked) !== canonical(current.restoreBlocked) && current.restoreBlocked !== true) return false;
    const strip = value => {
        const out = { ...value };
        for (const key of ['restoreAttestationId', 'restoreClaim', 'restoreBlocked', 'id']) delete out[key];
        return out;
    };
    return canonical(strip(before)) === canonical(strip(current));
}

function createFirebaseBackend({ verifyActor, resolveOrigin = configuredOrigin }) {
    return async function firebaseBackend({ env, token, budget, fetchImpl, now = Date.now }) {
        const readCerts = async () => {
            const result = await fetchJson(CERTS, { method: 'GET' }, budget, { fetchImpl, maximumBytes: 131072, timeoutMs: 3000 });
            if (!plain(result.value)) throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401);
            return result.value;
        };
        const actor = await verifyActor(token, env, readCerts, Math.min(3000, budget.remaining()));
        if (!actor.ok || actor.backend !== 'firebase' || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(actor.aud) || !actor.uid || !actor.branch) {
            throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401);
        }
        const targetName = 'ZOE_ZTO_RESTORE_FIREBASE_TARGET_' + actor.aud.replace(/-/g, '_').toUpperCase();
        const targetRaw = env[targetName];
        let account, rawDatabaseURL;
        try {
            if (targetRaw !== undefined) {
                if (typeof targetRaw !== 'string' || targetRaw.length > 32768) throw new Error('target');
                const target = JSON.parse(targetRaw);
                if (!plain(target) || Object.keys(target).length !== 2 || !Object.hasOwn(target, 'databaseURL') || !Object.hasOwn(target, 'serviceAccount')) throw new Error('target');
                account = target.serviceAccount;
                rawDatabaseURL = target.databaseURL;
            } else {
                account = JSON.parse(String(env.FCM_SERVICE_ACCOUNT || ''));
                rawDatabaseURL = env.ZOE_ZTO_RESTORE_FIREBASE_DATABASE_URL;
            }
        } catch (_) { throw new RestoreFailure('ZTO_RESTORE_NOT_CONFIGURED'); }
        if (!plain(account) || account.project_id !== actor.aud || typeof account.client_email !== 'string'
            || !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/i.test(account.client_email)
            || !account.client_email.endsWith('@' + actor.aud + '.iam.gserviceaccount.com')
            || typeof account.private_key !== 'string' || account.private_key.length > 16384) throw new RestoreFailure('ZTO_RESTORE_NOT_CONFIGURED');
        const databaseURL = resolveOrigin(rawDatabaseURL, 'firebase');
        const databasePath = path => {
            const url = new URL(databaseURL);
            url.pathname = '/' + path + '.json';
            return url.href;
        };
        const iat = Math.floor(now() / 1000);
        const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
        const assertion = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({ iss: account.client_email,
            scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/identitytoolkit',
            aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 300 });
        let signature;
        try { signature = crypto.sign('RSA-SHA256', Buffer.from(assertion), account.private_key).toString('base64url'); }
        catch (_) { throw new RestoreFailure('ZTO_RESTORE_NOT_CONFIGURED'); }
        const access = await fetchJson('https://oauth2.googleapis.com/token', { method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: assertion + '.' + signature }).toString()
        }, budget, { fetchImpl, maximumBytes: 65536 });
        if (!plain(access.value) || typeof access.value.access_token !== 'string' || !/^[A-Za-z0-9._~+/-]{1,4096}={0,2}$/.test(access.value.access_token)
            || !Number.isFinite(access.value.expires_in) || access.value.expires_in <= 0) throw new RestoreFailure('ZTO_RESTORE_BACKEND_UNAVAILABLE');
        const serviceHeaders = { Authorization: 'Bearer ' + access.value.access_token, 'Content-Type': 'application/json', Accept: 'application/json' };
        async function currentActor() {
            budget.assert();
            if (actor.expiresAt <= now()) throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401);
            const lookup = await fetchJson('https://identitytoolkit.googleapis.com/v1/projects/' + encodeURIComponent(actor.aud) + '/accounts:lookup', {
                method: 'POST', headers: serviceHeaders, body: JSON.stringify({ localId: [actor.uid] })
            }, budget, { fetchImpl, maximumBytes: 65536 });
            const user = plain(lookup.value) && Array.isArray(lookup.value.users) && lookup.value.users.length === 1 ? lookup.value.users[0] : null;
            if (!plain(user) || user.localId !== actor.uid || user.disabled === true || typeof user.validSince !== 'string'
                || !/^\d+$/.test(user.validSince) || Number(user.validSince) * 1000 > actor.authTime
                || user.email !== actor.email) throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401);
        }
        async function read(path, etag = false) {
            budget.assert();
            return fetchJson(databasePath(path), { method: 'GET',
                headers: { ...serviceHeaders, ...(etag ? { 'X-Firebase-ETag': 'true' } : {}) }
            }, budget, { fetchImpl });
        }
        async function put(path, value, etag) {
            budget.assert();
            if (actor.expiresAt <= now()) throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401);
            if (typeof etag !== 'string' || !/^(?:[A-Za-z0-9+/_=-]{1,256}|"[A-Za-z0-9+/_=-]{1,256}")$/.test(etag)) {
                throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
            }
            const conditionalFetch = async (url, init) => {
                const response = await fetchImpl(url, init);
                if (response.status === 412) {
                    if (response.body) Promise.resolve(response.body.cancel()).catch(() => {});
                    const error = new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                    error.conditionalConflict = true;
                    throw error;
                }
                return response;
            };
            return fetchJson(databasePath(path), { method: 'PUT',
                headers: { ...serviceHeaders, 'if-match': etag }, body: JSON.stringify(value)
            }, budget, { fetchImpl: conditionalFetch });
        }
        async function applyTerminal(input, context, observed, proposedId) {
            for (let attempt = 0; attempt < 3; attempt++) {
                await currentActor();
                const [policyRead, sourceRead, proofRead] = await Promise.all([
                    read('zoew_restore_policy/shop'), read(SOURCE_ROOT + '/' + input.sourceId, true), read(PROOF_ROOT + '/' + input.sourceId, true)
                ]);
                const source = sourceRead.value, policy = policyRead.value, prior = proofRead.value;
                if (canonical(policy) !== canonical(context.policy)) throw new RestoreFailure('ZTO_RESTORE_POLICY_UNCONFIRMED');
                if (source === null) {
                    const [receipt, finalization] = await Promise.all([read('zoew_trash_consumptions/' + input.sourceId), read('zoew_restore_finalizations/' + input.sourceId)]);
                    if (appliedConsumption(input, actor, databaseURL, source, receipt.value, finalization.value)) {
                        return { v: 1, success: true, kind: 'already_applied', source, consumption: receipt.value, finalization: finalization.value };
                    }
                    throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                }
                if (!sameTerminalBusiness(context.source, source, input.sourceId)
                    || (source.trashGeneration ?? 0) !== input.expectedGeneration) throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                const mode = effectiveMode({ ...context, source, policy });
                const sameGeneration = prior && prior.generation === input.expectedGeneration;
                let owner = null, claim = null, released = false;
                if (sameGeneration) {
                    if (!plain(prior) || prior.v !== 1 || prior.sourceId !== input.sourceId || !integer(prior.revision) || prior.revision < 1
                        || typeof prior.id !== 'string' || !ID.test(prior.id) || typeof prior.token !== 'string' || !prior.token || !ID.test(prior.targetId)
                        || typeof prior.actorUid !== 'string' || !prior.actorUid || prior.sessionId != null || !integer(prior.authTime) || prior.authTime <= 0
                        || prior.scope !== databaseURL || prior.branch !== actor.branch || prior.mode !== mode || prior.policyEpoch !== policy.epoch
                        || prior.deletedAt !== source.deletedAt || prior.rowBirth !== (source.createdAt ?? 0)
                        || !['allow', 'hold', 'deny'].includes(prior.status) || prior.status === 'deny' && !['signed', 'returned'].includes(prior.verdict)
                        || !plain(prior.snapshot) || prior.sourceHash !== hash(prior.snapshot)
                        || !sameTerminalBusiness(prior.snapshot, source, input.sourceId)) throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                    if (Object.hasOwn(source, 'restoreAttestationId')) {
                        if (source.restoreAttestationId !== prior.id || !plain(source.restoreClaim)
                            || source.restoreClaim.token !== prior.token || source.restoreClaim.targetId !== prior.targetId
                            || !integer(source.restoreClaim.claimedAt) || source.restoreClaim.claimedAt <= 0) throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                        claim = { ...source.restoreClaim };
                    } else if (prior.status === 'deny' && !Object.hasOwn(source, 'restoreClaim')) released = true;
                    else {
                        if (canonical(source.restoreClaim) !== canonical(prior.snapshot.restoreClaim)
                            || !integer(prior.issuedAt) || prior.issuedAt <= 0) throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                        claim = { token: prior.token, targetId: prior.targetId, claimedAt: prior.issuedAt };
                    }
                    owner = prior;
                } else {
                    if (Object.hasOwn(source, 'restoreAttestationId') || canonical(source.restoreClaim) !== canonical(context.source.restoreClaim)) {
                        throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                    }
                    owner = { id: proposedId, token: input.token, targetId: input.targetId, actorUid: actor.uid, sessionId: null, authTime: actor.authTime };
                    claim = plain(source.restoreClaim) && source.restoreClaim.token === input.token && source.restoreClaim.targetId === input.targetId
                        ? { ...source.restoreClaim } : { token: input.token, targetId: input.targetId, claimedAt: now() };
                }
                const verdict = observed === 'signed' || sameGeneration && prior.status === 'deny' && prior.verdict === 'signed' ? 'signed' : 'returned';
                const revision = prior ? prior.revision + 1 : 1;
                if (!integer(revision) || revision < 1) throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                const issuedAt = now(), expiresAt = Math.min(issuedAt + PROOF_TTL_MS, actor.expiresAt);
                const grant = { ...(sameGeneration ? prior : {}), v: 1, id: owner.id, revision, sourceId: input.sourceId,
                    generation: input.expectedGeneration, deletedAt: source.deletedAt, rowBirth: source.createdAt ?? 0,
                    token: owner.token, targetId: owner.targetId, actorUid: owner.actorUid, sessionId: owner.sessionId ?? null, authTime: owner.authTime,
                    scope: databaseURL, branch: actor.branch, mode, policyEpoch: policy.epoch, issuedAt, expiresAt, status: 'deny', verdict,
                    sourceHash: hash(source), codeSetHash: sameGeneration ? prior.codeSetHash : hash([]), snapshot: source,
                    codes: sameGeneration ? prior.codes || {} : {}, allowedTargetSlots: sameGeneration ? prior.allowedTargetSlots || {} : {} };
                const next = { ...source, id: input.sourceId, ...(released ? {} : { restoreAttestationId: owner.id, restoreClaim: claim }),
                    ...(verdict === 'signed' ? { restoreBlocked: true } : {}) };
                try {
                    await put(PROOF_ROOT + '/' + input.sourceId, grant, proofRead.etag);
                    const committed = await put(SOURCE_ROOT + '/' + input.sourceId, next, sourceRead.etag);
                    return { v: 1, success: true, kind: 'deny', attestationId: owner.id, expiresAt, source: committed.value,
                        code: 'ZTO_RESTORE_TERMINAL_' + verdict.toUpperCase() };
                } catch (error) {
                    if (!error.conditionalConflict || attempt === 2) throw error;
                }
            }
            throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
        }
        await currentActor();
        return {
            async context(input) {
                const [policy, source, consumption, finalization, target, attestation] = await Promise.all([
                    read('zoew_restore_policy/shop'), read(SOURCE_ROOT + '/' + input.sourceId, true),
                    read('zoew_trash_consumptions/' + input.sourceId), read('zoew_restore_finalizations/' + input.sourceId),
                    read(HISTORY_ROOT + '/' + input.targetId, true), read(PROOF_ROOT + '/' + input.sourceId, true)
                ]);
                if (!plain(policy.value) || policy.value.scope !== databaseURL || policy.value.branch !== actor.branch) {
                    throw new RestoreFailure('ZTO_RESTORE_POLICY_UNCONFIRMED');
                }
                const context = { v: 1, now: now(), actorUid: actor.uid, sessionId: null, authTime: actor.authTime,
                    backend: 'firebase', scope: databaseURL, branch: actor.branch, policy: policy.value,
                    source: source.value, consumption: consumption.value, finalization: finalization.value, target: target.value,
                    attestation: attestation.value, expiresAt: actor.expiresAt,
                    expectedRevision: attestation.value === null ? 0 : attestation.value.revision,
                    sourceEtag: source.etag, targetEtag: target.etag, attestationEtag: attestation.etag };
                if (appliedConsumption(input, actor, databaseURL, source.value, consumption.value, finalization.value)) {
                    return { ...context, kind: 'already_applied' };
                }
                if (!plain(source.value) || Object.hasOwn(source.value, 'id') && source.value.id !== input.sourceId || (source.value.trashGeneration ?? 0) !== input.expectedGeneration
                    || !integer(source.value.deletedAt) || source.value.deletedAt <= 0 || !integer(source.value.createdAt ?? 0)) {
                    throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                }
                const previous = consumption.value;
                if (previous !== null && (!plain(previous) || previous.sourceId !== input.sourceId
                    || !integer(previous.generation) || previous.generation + 1 !== input.expectedGeneration
                    || source.value.deletedAt <= previous.deletedAt) || previous === null && input.expectedGeneration > 1) {
                    throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                }
                const proof = attestation.value;
                if (proof !== null && (!plain(proof) || proof.v !== 1 || proof.sourceId !== input.sourceId || !integer(proof.revision))) {
                    throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                }
                const claim = source.value.restoreClaim;
                if (source.value.restoreAttestationId && (!proof || proof.id !== source.value.restoreAttestationId)) throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                if (claim) {
                    if (!plain(claim) || typeof claim.token !== 'string' || !ID.test(claim.targetId) || !integer(claim.claimedAt)) throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                    if (claim.token === input.token && proof && proof.actorUid !== actor.uid) throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401);
                    if (claim.token !== input.token || claim.targetId !== input.targetId) {
                        const oldTarget = claim.targetId === input.targetId ? target.value : (await read(HISTORY_ROOT + '/' + claim.targetId)).value;
                        if (oldTarget?.restoreClaimId === input.sourceId || claim.token !== input.token && claim.claimedAt + PROOF_TTL_MS > now()
                            || claim.token === input.token && input.action !== 'rebind') throw new RestoreFailure('ZTO_RESTORE_IN_PROGRESS', 409);
                    }
                } else if (input.action !== 'authorize') throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                if (target.value !== null) {
                    const prepared = target.value?.restoreClaimId === input.sourceId;
                    const hasRestoreMarker = ['restoreClaimId', 'restoreClaimToken', 'restoreAddedCodes'].some(key => Object.hasOwn(target.value, key));
                    if (!plain(target.value) || Object.hasOwn(target.value, 'id') && target.value.id !== input.targetId || target.value.clearClaim
                        || hasRestoreMarker && (!prepared || !proof || proof.actorUid !== actor.uid || proof.token !== input.token
                            || proof.targetId !== input.targetId || source.value.restoreAttestationId !== proof.id)
                        || prepared && target.value.restoreClaimToken !== input.token
                        || !prepared && (source.value.phone === 'គ្មានលេខ' || target.value.phone !== source.value.phone
                            || target.value.scanDate !== source.value.scanDate || target.value.isClosed)) {
                        throw new RestoreFailure('ZTO_RESTORE_TARGET_CHANGED', 409);
                    }
                }
                effectiveMode(context);
                return context;
            },
            async apply(input, context, verdict, attestationId) {
                const retainedTerminal = context.attestation?.generation === input.expectedGeneration && context.attestation?.status === 'deny'
                    && ['signed', 'returned'].includes(context.attestation.verdict) ? context.attestation.verdict : '';
                if (input.action !== 'release' && (['signed', 'returned'].includes(verdict) || retainedTerminal)) {
                    return applyTerminal(input, context, verdict === 'signed' || retainedTerminal === 'signed' ? 'signed' : 'returned', attestationId);
                }
                await currentActor();
                const policy = (await read('zoew_restore_policy/shop')).value;
                if (canonical(policy) !== canonical(context.policy)) throw new RestoreFailure('ZTO_RESTORE_POLICY_UNCONFIRMED');
                const currentProof = context.attestation;
                const terminal = currentProof && currentProof.generation === input.expectedGeneration && currentProof.status === 'deny';
                if (terminal) verdict = currentProof.verdict;
                const revision = currentProof ? currentProof.revision + 1 : 1;
                if (!integer(revision)) throw new RestoreFailure('ZTO_RESTORE_SOURCE_CHANGED', 409);
                const issuedAt = now();
                const expiresAt = Math.min(issuedAt + PROOF_TTL_MS, (context.verifiedAt ?? issuedAt) + PROOF_TTL_MS, actor.expiresAt);
                const allowing = verdict === 'allow' && input.action !== 'release';
                const codes = allowing ? sourceCodes(context.source, now) : [];
                const codeKeys = allowing ? Object.create(null) : currentProof?.codes || {};
                if (allowing) rows(context.source.barcodes).forEach(row => { codeKeys[row.code] = true; });
                const grant = { v: 1, id: attestationId, revision, sourceId: input.sourceId, generation: input.expectedGeneration,
                    deletedAt: context.source.deletedAt, rowBirth: context.source.createdAt ?? 0, token: input.token,
                    targetId: input.targetId, actorUid: actor.uid, sessionId: null, authTime: actor.authTime,
                    scope: databaseURL, branch: actor.branch, mode: effectiveMode(context), policyEpoch: policy.epoch,
                    issuedAt, expiresAt, status: verdict === 'allow' ? 'allow' : verdict === 'unconfirmed' ? 'hold' : 'deny',
                    verdict, sourceHash: hash(context.source), codeSetHash: hash(codes.map(row => row.code).sort()),
                    snapshot: context.source, codes: codeKeys,
                    allowedTargetSlots: allowing ? allowedTargetSlots(context.source, context.target, input.sourceId) : currentProof?.allowedTargetSlots || {} };
                if (input.action === 'release') {
                    const target = (await read(HISTORY_ROOT + '/' + input.targetId)).value;
                    if (target?.restoreClaimId === input.sourceId) throw new RestoreFailure('ZTO_RESTORE_IN_PROGRESS', 409);
                    grant.status = terminal ? 'deny' : 'hold';
                }
                await put(PROOF_ROOT + '/' + input.sourceId, grant, context.attestationEtag);
                if (input.action === 'release') {
                    const target = (await read(HISTORY_ROOT + '/' + input.targetId)).value;
                    if (target?.restoreClaimId === input.sourceId) throw new RestoreFailure('ZTO_RESTORE_IN_PROGRESS', 409);
                }
                let next = { ...context.source, id: input.sourceId, restoreAttestationId: attestationId,
                    restoreClaim: { token: input.token, targetId: input.targetId, claimedAt: issuedAt } };
                if (grant.status === 'deny' && verdict === 'signed') next.restoreBlocked = true;
                if (input.action === 'release') {
                    delete next.restoreClaim;
                    delete next.restoreAttestationId;
                }
                const committed = await put(SOURCE_ROOT + '/' + input.sourceId, next, context.sourceEtag);
                return { v: 1, success: true, kind: input.action === 'release' ? 'released' : grant.status === 'allow' ? 'allow' : 'deny',
                    attestationId, expiresAt, source: committed.value };
            }
        };
    };
}

module.exports = { createFirebaseBackend, canonical, hash, allowedTargetSlots, appliedConsumption };
