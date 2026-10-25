'use strict';

const crypto = require('node:crypto');
const PHASES = ['claimed', 'photo', 'sending', 'signed', 'retry', 'rejected'];

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
    const statusOnly = input.stage === 'receipt-status';
    const retry = () => reply(409, { code: 'ZTO_PALM_SIGN_RETRY_READY', barcode: input.barcode, retryable: true });
    const pending = () => reply(409, { code: 'ZTO_PALM_SIGN_UNCONFIRMED', barcode: input.barcode, stage: 'receipt', uncertain: true });
    const unavailable = () => reply(503, { code: 'ZTO_PALM_SIGN_STORE_UNAVAILABLE', barcode: input.barcode, retryable: true });
    let store;
    try { store = deps.blobStore?.()?.store; } catch (_) {}
    if (!store || !deps.keyLabel) return unavailable();
    const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
    const key = 'palm-sign-v1/' + digest(JSON.stringify([deps.keyLabel, session.site.toUpperCase(), input.barcode.toUpperCase()]));
    const fingerprint = digest(JSON.stringify([input.barcode, input.requestId, input.signMan, input.photo]));
    let etag = '';
    let saved = null;
    const read = async () => {
        const found = await limited(() => store.getWithMetadata(key, { type: 'text' }));
        if (!found) { etag = ''; saved = null; return; }
        if (!found.etag || typeof found.data !== 'string') throw new Error('journal:shape');
        const value = proof.open(found.data);
        if (!value || value.kind !== 'sign-journal' || !PHASES.includes(value.phase) || typeof value.requestId !== 'string'
            || typeof value.fingerprint !== 'string' || typeof value.owner !== 'string' || !Number.isFinite(value.leaseUntil)
            || typeof value.photoAccepted !== 'boolean') throw new Error('journal:shape');
        etag = found.etag;
        saved = value;
    };
    const write = async (next) => {
        const out = await limited(() => store.set(key, proof.seal(next), { ...(etag ? { onlyIfMatch: etag } : { onlyIfNew: true }), metadata: { at: Date.now() } }));
        if (out?.modified !== true || !out.etag) throw new Error('journal:conflict');
        etag = out.etag;
        saved = next;
    };
    const rejected = () => reply(409, { code: 'ZTO_PALM_SIGN_REPORTED_REJECTED', barcode: input.barcode,
        requestId: saved.requestId, stage: 'receipt', verificationRequired: true, photoAccepted: saved.requestId === input.requestId && saved.photoAccepted });
    const success = async () => {
        if (saved.requestId !== input.requestId) return reply(409, { code: 'ZTO_PALM_SIGN_OTHER_REQUEST', barcode: input.barcode, stage: 'receipt', ztoClosed: true, photoAccepted: false });
        const verified = saved.originalSHA256 === input.originalSHA256 && await checkPhoto();
        return reply(200, { success: true, provider: 'zto-palm', barcode: input.barcode, requestId: input.requestId, stage: 'receipt', ztoClosed: true, scanCompleted: true, photoAccepted: true, photoProtocol: input.photoProtocol,
            ...(verified ? { photoProof: { protocol: input.photoProtocol, barcode: input.barcode, requestId: input.requestId, originalSHA256: saved.originalSHA256, verified: true } } : {}) });
    };
    try {
        await read();
        if (saved && saved.requestId === input.requestId) {
            if (saved.originalSHA256) {
                if (saved.originalSHA256 !== input.originalSHA256) return reply(409, { code: 'ZTO_PALM_SIGN_INVALID', barcode: input.barcode });
            } else {
                if (!input.photo) return reply(409, { code: 'ZTO_PALM_SIGN_PHOTO_BIND_REQUIRED', barcode: input.barcode, requestId: input.requestId, uncertain: true });
                if (saved.fingerprint !== fingerprint || digest(Buffer.from(input.photo, 'base64')) !== input.originalSHA256) return reply(409, { code: 'ZTO_PALM_SIGN_INVALID', barcode: input.barcode });
                await write({ ...saved, originalSHA256: input.originalSHA256 });
            }
            if (input.photo && saved.fingerprint !== fingerprint) return reply(409, { code: 'ZTO_PALM_SIGN_INVALID', barcode: input.barcode });
        }
        if (saved && !saved.photoProtocol && !['sending', 'signed', 'rejected'].includes(saved.phase)) return pending();
        if (saved?.phase === 'rejected') {
            if (!saved.photoAccepted) return unavailable();
            if (!statusOnly && saved.requestId === input.requestId && saved.fingerprint !== fingerprint) return reply(409, { code: 'ZTO_PALM_SIGN_INVALID', barcode: input.barcode });
            return rejected();
        }
        if (saved?.phase === 'sending' || saved?.phase === 'signed') {
            if (!saved.photoAccepted) return unavailable();
            if (!statusOnly && saved.requestId === input.requestId && saved.fingerprint !== fingerprint) return reply(409, { code: 'ZTO_PALM_SIGN_INVALID', barcode: input.barcode });
            if (saved.phase === 'signed' && saved.requestId === input.requestId) return success();
            const status = await checkStatus();
            const body = JSON.parse(status.body);
            if (status.statusCode !== 200 || body.success !== true || body.barcode !== input.barcode || typeof body.ztoClosed !== 'boolean') return pending();
            if (body.ztoClosed) {
                await write({ ...saved, phase: 'signed', leaseUntil: 0 });
                return success();
            }
            return pending();
        } else if (saved && saved.phase !== 'retry' && saved.leaseUntil > Date.now()) {
            return pending();
        }
        if (statusOnly) return retry();
        await write({ kind: 'sign-journal', owner: crypto.randomUUID(), requestId: input.requestId, fingerprint,
            phase: 'claimed', photoAccepted: false, originalSHA256: input.originalSHA256, photoProtocol: input.photoProtocol, leaseUntil: Date.now() + 90000 });
    } catch (_) { return unavailable(); }
    const hooks = {
        rejected: async () => {
            if (saved.phase !== 'sending' || !saved.photoAccepted) throw new Error('journal:phase');
            await write({ ...saved, phase: 'rejected', leaseUntil: 0 });
            return rejected();
        },
        photo: async () => { await write({ ...saved, phase: 'photo', photoAccepted: true }); },
        sending: async () => {
            if (!saved.photoAccepted) throw new Error('journal:photo');
            await write({ ...saved, phase: 'sending' });
        }
    };
    try {
        const result = await run(hooks);
        if (result.statusCode === 200) {
            if (!saved.photoAccepted || saved.phase !== 'sending') return unavailable();
            await write({ ...saved, phase: 'signed', leaseUntil: 0 });
            return success();
        }
        if (saved.phase !== 'sending' && saved.phase !== 'rejected') {
            try { await write({ ...saved, phase: 'retry', leaseUntil: 0 }); } catch (_) {}
        }
        return result;
    } catch (_) {
        if (saved.phase === 'rejected') return rejected();
        if (saved.phase === 'sending') return pending();
        try { await write({ ...saved, phase: 'retry', leaseUntil: 0 }); } catch (_) {}
        return unavailable();
    }
}

module.exports = { withSignJournal };
