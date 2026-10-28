'use strict';
const crypto = require('node:crypto');
const AGE_MS = 900000;
const TOKEN_MS = 300000;
const ALLOWED = new Set(['reserved', 'claimed', 'image-sending', 'photo', 'sending', 'warning', 'blocked'].map(p => 'reservation-v1:' + p));
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function restartSign(input, key, proof, state, write, inspect, reply) {
    let saved = state().saved;
    const binding = { barcode: input.barcode, requestId: input.requestId, restartFromRequestId: input.restartFromRequestId,
        photoProtocol: input.photoProtocol, originalSHA256: input.originalSHA256,
        reservationProtocol: input.reservationProtocol, originalFingerprint: input.originalFingerprint };
    const result = (code, extra = {}, status = 409) => reply(status, { code, stage: 'receipt-restart-check', ...binding, ...extra });
    const blocked = reason => result('ZTO_PALM_SIGN_RESTART_BLOCKED', { reason });
    const unavailable = () => result('ZTO_PALM_SIGN_RESTART_UNAVAILABLE', {}, 503);
    const ready = () => result('ZTO_PALM_SIGN_RESUME_READY', { stage: 'receipt', restarted: true,
        reservationOwner: saved.owner, reservationToken: proof.seal({ kind: 'sign-reservation', scope: key,
            protocol: 'original-reservation-v1', owner: saved.owner, attempt: saved.attempt, barcode: input.barcode,
            requestId: saved.requestId, originalSHA256: saved.originalSHA256, originalFingerprint: saved.fingerprint, expiresAt: Date.now() + TOKEN_MS }) });
    if (!saved) return blocked('missing_journal');
    if (saved.restartAudit?.fromRequestId === input.restartFromRequestId && saved.requestId === input.requestId
        && saved.fingerprint === input.originalFingerprint && saved.originalSHA256 === input.originalSHA256) {
        if (saved.phase !== 'reservation-v1:reserved' || saved.photoAccepted || saved.leaseUntil) return blocked('conflict');
        const observed = await inspect();
        if (!observed) return unavailable();
        if (observed.ztoClosed) return blocked('signed');
        if (!observed.restartEligible) return blocked('ineligible');
        return ready();
    }
    if (!ALLOWED.has(saved.phase) || saved.requestId === input.requestId || input.restartFromRequestId === input.requestId) return blocked('not_restartable');
    if (saved.leaseUntil > Date.now()) return blocked('active');
    const confirmed = input.stage === 'receipt-restart-confirm';
    let token;
    if (confirmed) {
        try { token = proof.open(input.restartToken); } catch (_) { return blocked('conflict'); }
        if (!input.restartConsent || !token || token.kind !== 'sign-restart' || token.scope !== key
            || token.etag !== state().etag || token.owner !== saved.owner || token.previousRequestId !== saved.requestId
            || token.binding !== digest(binding) || !Number.isFinite(token.expiresAt) || token.expiresAt <= Date.now()) return blocked('conflict');
    }
    const observed = await inspect();
    if (!observed) return unavailable();
    if (observed.ztoClosed) return blocked('signed');
    if (!observed.restartEligible) return blocked('ineligible');
    const now = Date.now();
    const metadataAt = state().at;
    const at = Number.isFinite(metadataAt) && metadataAt > 0 && metadataAt <= now ? metadataAt : metadataAt == null ? saved.restartQuarantineAt : null;
    const trustworthy = Number.isFinite(at) && at > 0 && at <= now;
    if (!trustworthy) {
        if (confirmed) return blocked('conflict');
        await write({ ...saved, restartQuarantineAt: now });
        return result('ZTO_PALM_SIGN_RESTART_WAIT', { serverNow: now, retryAfterMs: AGE_MS });
    }
    if (now - at < AGE_MS) return result('ZTO_PALM_SIGN_RESTART_WAIT', { serverNow: now, retryAfterMs: AGE_MS - (now - at) });
    if (!confirmed) return result('ZTO_PALM_SIGN_RESTART_CONFIRM_REQUIRED', { expiresAt: now + TOKEN_MS,
        restartToken: proof.seal({ kind: 'sign-restart', scope: key, etag: state().etag, owner: saved.owner,
            previousRequestId: saved.requestId, binding: digest(binding), expiresAt: now + TOKEN_MS }) });
    const predecessor = { owner: saved.owner.slice(0, 256), requestId: saved.requestId.slice(0, 128), phase: saved.phase,
        fingerprint: saved.fingerprint.slice(0, 128), originalSHA256: String(saved.originalSHA256 || '').slice(0, 128), photoAccepted: saved.photoAccepted,
        leaseUntil: saved.leaseUntil, updatedAt: at, priorAuditHash: saved.restartAudit ? digest(saved.restartAudit) : '' };
    await write({ kind: 'sign-journal', owner: crypto.randomUUID(), requestId: input.requestId, fingerprint: input.originalFingerprint,
        originalSHA256: input.originalSHA256, photoProtocol: input.photoProtocol, reservationProtocol: input.reservationProtocol,
        phase: 'reservation-v1:reserved', attempt: crypto.randomUUID(), photoAccepted: false, leaseUntil: 0, originalValidated: false,
        restartAudit: { at: now, fromRequestId: input.restartFromRequestId, consent: 'explicit-uncertain-restart-v1', predecessor } });
    saved = state().saved;
    return ready();
}
module.exports = { restartSign };
