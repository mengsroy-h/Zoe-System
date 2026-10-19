'use strict';

const crypto = require('node:crypto');
const PHASES = ['claimed', 'photo', 'sending', 'signed', 'retry'];

function reply(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function limited(work) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('journal:timeout')), 2500);
        Promise.resolve().then(work).then(resolve, reject).finally(() => clearTimeout(timer));
    });
}

async function withSignJournal(input, session, deps, proof, run, checkStatus) {
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
    const success = () => saved.requestId !== input.requestId
        ? reply(409, { code: 'ZTO_PALM_SIGN_OTHER_REQUEST', barcode: input.barcode, stage: 'receipt', ztoClosed: true, photoAccepted: false })
        : reply(200, { success: true, provider: 'zto-palm', barcode: input.barcode, requestId: input.requestId, stage: 'receipt', ztoClosed: true, photoAccepted: true });
    try {
        await read();
        if (saved?.phase === 'sending' || saved?.phase === 'signed') {
            if (!saved.photoAccepted) return unavailable();
            if (!statusOnly && saved.requestId === input.requestId && saved.fingerprint !== fingerprint) return reply(409, { code: 'ZTO_PALM_SIGN_INVALID', barcode: input.barcode });
            if (saved.phase === 'signed' && saved.requestId === input.requestId) return success();
            const status = await checkStatus();
            const body = JSON.parse(status.body);
            if (status.statusCode !== 200 || body.success !== true || body.barcode !== input.barcode || typeof body.ztoClosed !== 'boolean') return pending();
            if (body.ztoClosed) {
                try { await write({ ...saved, phase: 'signed', leaseUntil: 0 }); } catch (_) {}
                return success();
            }
            if (saved.phase === 'sending' || !body.dispatched) return pending();
        } else if (saved && saved.phase !== 'retry' && saved.leaseUntil > Date.now()) {
            return pending();
        }
        if (statusOnly) return retry();
        await write({ kind: 'sign-journal', owner: crypto.randomUUID(), requestId: input.requestId, fingerprint,
            phase: 'claimed', photoAccepted: false, leaseUntil: Date.now() + 90000 });
    } catch (_) { return unavailable(); }
    const hooks = {
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
            try { await write({ ...saved, phase: 'signed', leaseUntil: 0 }); } catch (_) {}
            return success();
        }
        if (saved.phase !== 'sending') {
            try { await write({ ...saved, phase: 'retry', leaseUntil: 0 }); } catch (_) {}
        }
        return result;
    } catch (_) {
        if (saved.phase === 'sending') return pending();
        try { await write({ ...saved, phase: 'retry', leaseUntil: 0 }); } catch (_) {}
        return unavailable();
    }
}

module.exports = { withSignJournal };
