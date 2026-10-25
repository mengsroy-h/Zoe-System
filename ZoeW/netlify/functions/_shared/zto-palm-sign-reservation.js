'use strict';

const crypto = require('node:crypto');
const PROTOCOL = 'original-reservation-v1';
const PREFIX = 'reservation-v1:';
const PHASES = ['reserved', 'claimed', 'image-sending', 'photo', 'sending', 'signed', 'warning', 'blocked', 'rejected', 'cancelled'].map(value => PREFIX + value);
const TOKEN_MS = 300000;
const LEASE_MS = 90000;

async function withReservation(input, key, proof, state, write, run, checkStatus, replies) {
    const { reply, pending, unavailable, success, rejected } = replies;
    const manual = (reason, extra = {}) => reply(409, { code: 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED', manualReview: true, reason, stage: 'receipt', barcode: input.barcode, requestId: input.requestId, photoProtocol: input.photoProtocol, originalSHA256: input.originalSHA256, reservationProtocol: input.reservationProtocol, originalFingerprint: input.originalFingerprint, refreshRequestId: input.refreshRequestId, ...(saved?.owner ? { reservationOwner: saved.owner } : {}), ...extra });
    const invalid = () => manual('reservation_conflict');
    const statusOnly = input.stage === 'receipt-status';
    const cancelOnly = input.stage === 'receipt-cancel';
    const warningRefresh = input.stage === 'receipt-warning-refresh';
    const prewriteRefresh = input.stage === 'receipt-prewrite-refresh';
    const digest = value => crypto.createHash('sha256').update(value).digest('hex');
    let saved = state();
    const update = async patch => { await write({ ...saved, ...patch }); saved = state(); };
    const phase = name => saved?.phase === PREFIX + name;
    const validToken = (allowExpired, currentAttempt = true) => {
        let token;
        try { token = proof.open(input.reservationToken); } catch (_) { return false; }
        return token && token.kind === 'sign-reservation' && token.scope === key && token.protocol === PROTOCOL
            && token.owner === saved.owner && input.reservationOwner === saved.owner && token.barcode === input.barcode
            && token.requestId === saved.requestId && token.originalSHA256 === saved.originalSHA256 && token.originalFingerprint === saved.fingerprint
            && (!currentAttempt || token.attempt === saved.attempt) && Number.isFinite(token.expiresAt) && (allowExpired || token.expiresAt > Date.now());
    };
    const validWarning = (allowExpired = false) => {
        if (!saved.warning || input.confirmationToken !== saved.warning.confirmationToken) return false;
        let token;
        try { token = proof.open(input.confirmationToken); } catch (_) { return false; }
        return token && token.kind === 'scan-confirm' && token.binding === saved.warningBinding
            && Number.isFinite(token.expiresAt) && (allowExpired || token.expiresAt > Date.now());
    };
    const capability = () => ({ code: 'ZTO_PALM_SIGN_RESUME_READY', barcode: input.barcode, requestId: input.requestId, stage: 'receipt',
        photoProtocol: input.photoProtocol, originalSHA256: saved.originalSHA256, originalFingerprint: saved.fingerprint,
        reservationProtocol: PROTOCOL, reservationOwner: saved.owner,
        reservationToken: proof.seal({ kind: 'sign-reservation', scope: key, protocol: PROTOCOL, owner: saved.owner, attempt: saved.attempt, barcode: input.barcode,
            requestId: saved.requestId, originalSHA256: saved.originalSHA256, originalFingerprint: saved.fingerprint, expiresAt: Date.now() + TOKEN_MS }) });
    const ready = (extra = {}) => reply(409, { ...capability(), ...extra });
    const refreshResult = () => saved.refreshDecision === 'blocked'
        ? manual('blocked', { refreshRequestId: saved.refreshRequestId, reservationToken: capability().reservationToken, continuationAllowed: canContinue() })
        : saved.refreshDecision === 'changed'
            ? reply(409, { ...capability(), ...saved.warning, refreshRequestId: saved.refreshRequestId, warningRefreshed: true, warningChanged: true })
            : ready({ refreshRequestId: saved.refreshRequestId, warningRefreshed: true, confirmationToken: saved.refreshDecision === 'clear' ? '' : saved.warning.confirmationToken });
    const canContinue = () => phase('blocked') && saved.photoAccepted === false && typeof saved.attempt === 'string' && !!saved.attempt
        && Number.isFinite(saved.leaseStartedAt) && saved.leaseStartedAt > 0;
    if (input.reservationProtocol !== PROTOCOL || !/^[a-f0-9]{64}$/.test(input.originalFingerprint || '')) return invalid();
    if (!saved || phase('cancelled') && saved.requestId !== input.requestId && statusOnly && !input.reservationToken && !input.reservationOwner) {
        if (!statusOnly || input.reservationToken || input.reservationOwner) return manual('missing_journal');
        await write({ kind: 'sign-journal', owner: crypto.randomUUID(), requestId: input.requestId, fingerprint: input.originalFingerprint,
            originalSHA256: input.originalSHA256, photoProtocol: input.photoProtocol, reservationProtocol: PROTOCOL,
            phase: PREFIX + 'reserved', attempt: crypto.randomUUID(), photoAccepted: false, leaseUntil: 0 });
        saved = state();
        return ready();
    }
    if (!PHASES.includes(saved.phase)) return manual('legacy_journal');
    if (saved.reservationProtocol !== PROTOCOL || !/^[a-f0-9]{64}$/.test(saved.originalSHA256 || '') || !/^[a-f0-9]{64}$/.test(saved.fingerprint || '')) return unavailable();
    if (saved.requestId !== input.requestId) return manual('different_request');
    if (saved.fingerprint !== input.originalFingerprint || saved.originalSHA256 !== input.originalSHA256
        || input.reservationOwner && input.reservationOwner !== saved.owner) return invalid();
    if ((statusOnly || warningRefresh || prewriteRefresh) && ['same', 'changed', 'clear', 'blocked'].includes(saved.refreshDecision) && input.refreshRequestId === saved.refreshRequestId
        && (phase('warning') || phase('reserved') || phase('blocked')) && validToken(true, false)
        && digest(input.reservationToken) === saved.refreshFromTokenHash
        && digest(input.confirmationToken || '') === saved.refreshFromConfirmationHash) return refreshResult();
    if (warningRefresh || prewriteRefresh) {
        if (saved.refreshDecision && input.refreshRequestId === saved.refreshRequestId) return invalid();
        if (!validToken(true) || (warningRefresh ? !phase('warning') || !validWarning(true) : !canContinue())) return invalid();
        if (!input.photo || digest(JSON.stringify([input.barcode, input.requestId, input.signMan, input.photo])) !== saved.fingerprint
            || digest(Buffer.from(input.photo, 'base64')) !== saved.originalSHA256) return invalid();
        const previous = saved;
        const result = await run();
        const body = JSON.parse(result.body);
        if (body.code === 'ZTO_PALM_DISPATCH_REQUIRED') return reply(result.statusCode, { ...body, requestId: input.requestId });
        if (result.statusCode === 401 || result.statusCode >= 500) return result;
        const provenance = { refreshRequestId: input.refreshRequestId, refreshFromTokenHash: digest(input.reservationToken), refreshFromConfirmationHash: digest(input.confirmationToken || '') };
        if (result.statusCode === 200 && body.success === true && body.stage === 'receipt-check' && body.ready === true) {
            await update({ ...provenance, phase: PREFIX + 'reserved', attempt: crypto.randomUUID(), leaseUntil: 0, refreshDecision: 'clear', warning: null, warningBinding: '' });
            return refreshResult();
        }
        if (result.statusCode === 409 && body.code === 'ZTO_PALM_SIGN_CONFIRM_REQUIRED') {
            const token = proof.open(body.confirmationToken);
            if (!token || token.kind !== 'scan-confirm' || !Number.isFinite(token.expiresAt) || token.expiresAt <= Date.now()) return pending();
            const same = warningRefresh && previous.warning?.message === body.message;
            await update({ ...provenance, phase: PREFIX + 'warning', attempt: crypto.randomUUID(), leaseUntil: 0,
                refreshDecision: same ? 'same' : 'changed', warning: body, warningBinding: token.binding });
            return refreshResult();
        }
        await update({ ...provenance, phase: PREFIX + 'blocked', attempt: crypto.randomUUID(), leaseUntil: 0, blocked: { statusCode: result.statusCode, body }, refreshDecision: 'blocked' });
        return refreshResult();
    }
    if (cancelOnly) {
        if (!validToken(true) || !validWarning(true)) return invalid();
        if (!phase('cancelled')) {
            if (!phase('warning') || saved.photoAccepted) return manual('preimage_uncertain');
            await update({ phase: PREFIX + 'cancelled', leaseUntil: 0, cancelledAt: Date.now() });
        }
        return reply(200, { success: true, cancelled: true, stage: 'receipt-cancel', barcode: input.barcode, requestId: input.requestId,
            photoProtocol: input.photoProtocol, originalSHA256: saved.originalSHA256, reservationProtocol: PROTOCOL,
            originalFingerprint: saved.fingerprint, reservationOwner: saved.owner, reservationToken: input.reservationToken });
    }
    if (phase('cancelled')) return manual('blocked');
    if (phase('signed')) return saved.photoAccepted ? success() : unavailable();
    if (phase('rejected')) return saved.photoAccepted ? rejected() : unavailable();
    if (phase('sending')) {
        if (!saved.photoAccepted) return unavailable();
        const result = await checkStatus();
        const body = JSON.parse(result.body);
        if (result.statusCode === 200 && body.success === true && body.barcode === input.barcode && body.ztoClosed === true) {
            await update({ phase: PREFIX + 'signed', leaseUntil: 0 });
            return success();
        }
        return pending();
    }
    if (phase('claimed') || phase('photo') || phase('image-sending')) {
        const issuedLease = typeof saved.attempt === 'string' && saved.attempt.length > 0 && Number.isFinite(saved.leaseStartedAt) && saved.leaseStartedAt > 0
            && Number.isFinite(saved.leaseUntil) && saved.leaseUntil - saved.leaseStartedAt === LEASE_MS;
        if (!issuedLease) return manual('preimage_uncertain');
        if (saved.leaseUntil > Date.now()) return pending();
        if (!statusOnly || !validToken(true)) return invalid();
        let photoAccepted = saved.photoAccepted;
        if (phase('image-sending')) {
            const observed = await replies.checkPhoto();
            if (observed?.verified !== true) return manual(observed?.manualReview ? 'unsupported_photo' : 'photo_unverified');
            photoAccepted = true;
        }
        if (phase('photo') && !photoAccepted) return manual('preimage_uncertain');
        await update({ phase: PREFIX + 'reserved', attempt: crypto.randomUUID(), photoAccepted, leaseUntil: 0, leaseStartedAt: 0 });
        return ready();
    }
    if (phase('blocked')) return manual('blocked', { continuationAllowed: canContinue() });
    if (phase('reserved')) {
        if (statusOnly) {
            if (input.reservationToken && !validToken(true, false)) return invalid();
            if (!saved.attempt) await update({ attempt: crypto.randomUUID() });
            return ready();
        }
        if (!validToken(false)) return invalid();
    } else if (phase('warning')) {
        if (validToken(true) && validWarning(true) && (!validToken(false) || !validWarning())) return reply(409, { ...capability(), code: 'ZTO_PALM_SIGN_WARNING_REFRESH_REQUIRED', warningRefreshRequired: true, reservationToken: input.reservationToken, confirmationToken: saved.warning.confirmationToken, message: saved.warning.message });
        if (!validToken(false) || !validWarning()) return saved.warning ? reply(409, saved.warning) : pending();
        if (statusOnly) return ready();
    } else return pending();
    if (!input.photo || digest(JSON.stringify([input.barcode, input.requestId, input.signMan, input.photo])) !== saved.fingerprint
        || digest(Buffer.from(input.photo, 'base64')) !== saved.originalSHA256) return invalid();
    const leaseStartedAt = Date.now();
    await update({ phase: PREFIX + 'claimed', leaseStartedAt, leaseUntil: leaseStartedAt + LEASE_MS, warning: null, warningBinding: '', refreshDecision: '', refreshRequestId: '', refreshFromTokenHash: '', refreshFromConfirmationHash: '' });
    const hooks = {
        skipPhoto: saved.photoAccepted === true,
        imageSending: async () => {
            if (!phase('claimed') || saved.photoAccepted) throw new Error('journal:phase');
            const leaseStartedAt = Date.now();
            await update({ phase: PREFIX + 'image-sending', leaseStartedAt, leaseUntil: leaseStartedAt + LEASE_MS });
        },
        photo: async () => {
            if (!phase('image-sending')) throw new Error('journal:phase');
            const leaseStartedAt = Date.now();
            await update({ phase: PREFIX + 'photo', photoAccepted: true, leaseStartedAt, leaseUntil: leaseStartedAt + LEASE_MS });
        },
        sending: async () => {
            if ((!phase('photo') && !phase('claimed')) || !saved.photoAccepted) throw new Error('journal:phase');
            await update({ phase: PREFIX + 'sending' });
        },
        rejected: async () => {
            if (!phase('sending') || !saved.photoAccepted) throw new Error('journal:phase');
            await update({ phase: PREFIX + 'rejected' });
            return rejected();
        }
    };
    try {
        const result = await run(hooks);
        if (result.statusCode === 200) {
            if (!phase('sending') || !saved.photoAccepted) return unavailable();
            await update({ phase: PREFIX + 'signed' });
            return success();
        }
        if (phase('claimed')) {
            const body = JSON.parse(result.body);
            if (result.statusCode === 409 && body.code === 'ZTO_PALM_SIGN_CONFIRM_REQUIRED') {
                const token = proof.open(body.confirmationToken);
                if (!token || token.kind !== 'scan-confirm' || !Number.isFinite(token.expiresAt) || token.expiresAt <= Date.now()) return pending();
                await update({ phase: PREFIX + 'warning', leaseUntil: 0, warning: body, warningBinding: token.binding });
            } else await update({ phase: PREFIX + 'blocked', blocked: { statusCode: result.statusCode, body } });
        }
        return result;
    } catch (_) {
        if (phase('rejected')) return rejected();
        return pending();
    }
}

module.exports = { withReservation, RESERVATION_PHASES: PHASES };
