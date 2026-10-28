'use strict';

const crypto = require('node:crypto');
const { withReservation, RESERVATION_PHASES } = require('./zto-palm-sign-reservation');

function reply(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function limited(work) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('journal:timeout')), 2500);
        Promise.resolve().then(work).then(resolve, reject).finally(() => clearTimeout(timer));
    });
}

async function withSignJournal(input, session, deps, proof, run, checkStatus, checkPhoto) {
    const manual = (reason, extra = {}) => reply(409, { code: 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED', manualReview: true, reason, stage: 'receipt', barcode: input.barcode, requestId: input.requestId, photoProtocol: input.photoProtocol, originalSHA256: input.originalSHA256, ...extra });
    const pending = () => reply(409, { code: 'ZTO_PALM_SIGN_UNCONFIRMED', barcode: input.barcode, stage: 'receipt', uncertain: true });
    const unavailable = () => reply(503, { code: 'ZTO_PALM_SIGN_STORE_UNAVAILABLE', barcode: input.barcode, retryable: true });
    if (!input.reservationProtocol) return reply(409, { code: 'ZTO_PALM_SIGN_PROTOCOL_REQUIRED', barcode: input.barcode });
    let store;
    try { store = deps.blobStore?.()?.store; } catch (_) {}
    if (!store || !deps.keyLabel) return unavailable();
    const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
    const key = 'palm-sign-v1/' + digest(JSON.stringify([deps.keyLabel, session.site.toUpperCase(), input.barcode.toUpperCase()]));
    let etag = '';
    let saved = null;
    let at = null;
    const read = async () => {
        const found = await limited(() => store.getWithMetadata(key, { type: 'text', consistency: 'strong' }));
        if (!found) { etag = ''; saved = null; return; }
        if (!found.etag || typeof found.data !== 'string') throw new Error('journal:shape');
        const value = proof.open(found.data);
        if (!value || value.kind !== 'sign-journal' || !RESERVATION_PHASES.includes(value.phase) || typeof value.requestId !== 'string'
            || typeof value.fingerprint !== 'string' || typeof value.owner !== 'string' || !Number.isFinite(value.leaseUntil)
            || typeof value.photoAccepted !== 'boolean') throw new Error('journal:shape');
        etag = found.etag;
        at = found.metadata?.at;
        saved = value;
    };
    const write = async (next) => {
        const out = await limited(() => store.set(key, proof.seal(next), { ...(etag ? { onlyIfMatch: etag } : { onlyIfNew: true }), metadata: { at: Date.now() } }));
        if (out?.modified !== true || !out.etag) throw new Error('journal:conflict');
        etag = out.etag;
        saved = next;
        at = Date.now();
    };
    const rejected = () => reply(409, { code: 'ZTO_PALM_SIGN_REPORTED_REJECTED', barcode: input.barcode,
        requestId: saved.requestId, stage: 'receipt', verificationRequired: true, photoAccepted: saved.requestId === input.requestId && saved.photoAccepted });
    const success = async () => {
        if (saved.requestId !== input.requestId) return manual('different_request', { ztoClosed: true, photoAccepted: false });
        const photo = saved.originalSHA256 === input.originalSHA256 ? await checkPhoto() : { verified: false, reason: 'hash_mismatch' };
        const verified = photo?.verified === true;
        return reply(200, { success: true, provider: 'zto-palm', barcode: input.barcode, requestId: input.requestId, stage: 'receipt', ztoClosed: true, scanCompleted: true, photoAccepted: saved.photoAccepted, ...(saved.phase === 'reservation-v1:closed-observed' ? { closureObserved: true } : {}), photoProtocol: input.photoProtocol, originalSHA256: input.originalSHA256, reservationProtocol: input.reservationProtocol, originalFingerprint: input.originalFingerprint,
            ...(!verified ? { photoStatusReason: photo.reason, ...(photo.manualReview ? { manualReview: true, code: 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED', reason: 'unsupported_photo' } : {}) } : {}),
            ...(verified ? { photoProof: { protocol: input.photoProtocol, barcode: input.barcode, requestId: input.requestId, originalSHA256: saved.originalSHA256, verified: true } } : {}) });
    };
    try {
        await read();
        if (['receipt-restart-check', 'receipt-restart-confirm'].includes(input.stage)) {
            return await require('./zto-palm-sign-restart').restartSign(input, key, proof, () => ({ saved, etag, at }), write, async () => {
                const out = await checkStatus();
                const body = JSON.parse(out.body);
                return out.statusCode === 200 && body.success === true && body.barcode === input.barcode
                    && typeof body.ztoClosed === 'boolean' && typeof body.restartEligible === 'boolean' ? body : null;
            }, reply);
        }
        return await withReservation(input, key, proof, () => saved, write, run, checkStatus, { reply, pending, unavailable, success, rejected, checkPhoto });
    } catch (_) { return unavailable(); }
}

module.exports = { withSignJournal };
