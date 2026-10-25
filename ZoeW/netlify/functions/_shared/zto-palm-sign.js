'use strict';

const crypto = require('node:crypto');
const { withSignJournal } = require('./zto-palm-sign-journal');
const PHOTO_PROTOCOL = 'original-sha256-v1';
const MAX_PHOTO_BYTES = 900000;
const RUNS_MAX = 256;
const runs = new Map();

function json(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function readInput(event) {
    if (event.isBase64Encoded || typeof event.body !== 'string' || Buffer.byteLength(event.body) > 1250000) return null;
    let input;
    try { input = JSON.parse(event.body); } catch (_) { return null; }
    const { barcode, signMan = '', photo, requestId, stage, dispatchProof = '', confirmationToken = '' } = input || {};
    const photoFields = { photoProtocol: input?.photoProtocol, originalSHA256: input?.originalSHA256, reservationProtocol: input?.reservationProtocol, originalFingerprint: input?.originalFingerprint, reservationOwner: input?.reservationOwner, reservationToken: input?.reservationToken, refreshRequestId: input?.refreshRequestId };
    if ((input?.refreshRequestId !== undefined || ['receipt-warning-refresh', 'receipt-prewrite-refresh'].includes(stage))
        && (typeof input?.refreshRequestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.refreshRequestId))) return null;
    if (input?.reservationProtocol !== undefined && (input.reservationProtocol !== 'original-reservation-v1' || typeof input.originalFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(input.originalFingerprint)
        || input.reservationOwner !== undefined && (typeof input.reservationOwner !== 'string' || input.reservationOwner.length > 256)
        || input.reservationToken !== undefined && (typeof input.reservationToken !== 'string' || input.reservationToken.length > 8192))) return null;
    if (stage === 'receipt-status' || stage === 'receipt-cancel') {
        if (typeof barcode !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(barcode) || typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) return null;
        if (photo !== undefined) {
            const original = readInput({ body: JSON.stringify({ ...input, stage: 'receipt' }) });
            return original ? { ...original, stage } : null;
        }
        return typeof confirmationToken === 'string' && confirmationToken.length <= 8192 ? { barcode, requestId, stage, ...photoFields, confirmationToken } : null;
    }
    if (stage === 'status' || stage === 'photo-status') return typeof barcode === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(barcode)
        && typeof requestId === 'string' && /^[a-f0-9-]{36}$/i.test(requestId) ? { barcode, requestId, stage } : null;
    if (typeof barcode !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(barcode)
        || !['dispatch', 'receipt', 'receipt-check', 'receipt-warning-refresh', 'receipt-prewrite-refresh'].includes(stage) || typeof dispatchProof !== 'string' || dispatchProof.length > 4096
        || typeof confirmationToken !== 'string' || confirmationToken.length > 8192
        || typeof signMan !== 'string' || signMan.length > 120 || /[\u0000-\u001f\u007f]/.test(signMan)
        || typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) return null;
    if (stage === 'dispatch' && (photo === undefined || photo === '')) return { barcode, signMan: signMan.trim(), photo: '', requestId, stage, dispatchProof, confirmationToken };
    if (stage === 'receipt-check') return typeof input.photoHash === 'string' && /^[a-f0-9]{64}$/.test(input.photoHash)
        ? { barcode, signMan: signMan.trim(), photo: '', photoHash: input.photoHash, ...photoFields, requestId, stage: 'receipt', checkOnly: true, dispatchProof, confirmationToken, background: true }
        : null;
    if (typeof photo !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo) || photo.length % 4 !== 0) return null;
    const bytes = Buffer.from(photo, 'base64');
    if (bytes.length < 8 || bytes.length > MAX_PHOTO_BYTES || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255
        || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217 || bytes.toString('base64') !== photo) return null;
    return { barcode, signMan: signMan.trim(), photo, ...photoFields, requestId, stage, dispatchProof, confirmationToken, background: input.background === true };
}

function failure(upstream, code) {
    if (upstream.authRejected || /^(401|403|not_login|token_expired|token_invalid|login_expired|login_required)$/i.test(String(upstream.statusCode || ''))) {
        return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' });
    }
    if (upstream.status !== true) return json(502, { code });
    return null;
}

function receiptPrewriteFailure(upstream) {
    const result = failure(upstream, 'ZTO_PALM_SIGN_CHECK_REJECTED');
    if (result?.statusCode === 502 && upstream.status === false) return json(409, { code: 'ZTO_PALM_SIGN_CHECK_REJECTED' });
    return result;
}

function localStamp() {
    return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
}

function hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function confirmationBinding(input, session) {
    return hash(JSON.stringify([session.token, input.barcode, input.stage, input.requestId, input.signMan,
        input.background ? input.photoHash || hash(input.photo) : input.photo, input.dispatchProof]));
}

async function submit(input, session, request, proof, journal) {
    const { barcode, photo, requestId, stage } = input;
    const scanType = stage === 'dispatch' ? 4 : 5;
    let confirmation;
    if (input.confirmationToken) {
        try { confirmation = proof.open(input.confirmationToken); } catch (_) {}
        if (!confirmation || confirmation.kind !== 'scan-confirm' || confirmation.binding !== confirmationBinding(input, session)
            || !Number.isFinite(confirmation.expiresAt) || confirmation.expiresAt <= Date.now()) {
            return json(409, { code: 'ZTO_PALM_SIGN_INVALID', barcode });
        }
    }
    const signMan = input.signMan;
    if (stage === 'receipt') {
        let receipt;
        try { receipt = proof.open(input.dispatchProof); } catch (_) {}
        if (!receipt || receipt.kind !== 'dispatch' || receipt.barcode !== barcode || receipt.requestId !== requestId
            || receipt.tokenHash !== crypto.createHash('sha256').update(session.token).digest('hex') || receipt.expiresAt <= Date.now()) {
            return json(409, { code: 'ZTO_PALM_DISPATCH_REQUIRED', barcode });
        }
        const order = await request('/zto/collect/v1/queryPreOrderByBillCode', { billCode: barcode });
        const orderFailure = receiptPrewriteFailure(order);
        if (orderFailure) return orderFailure;
        if (!order.result || typeof order.result !== 'object' || order.result.billCode !== barcode) {
            return json(409, { code: 'ZTO_PALM_SIGN_CHECK_REJECTED', barcode });
        }
        if (!signMan || signMan.length > 120 || /[\u0000-\u001f\u007f]/.test(signMan)) return json(409, { code: 'ZTO_PALM_SIGN_NAME_REQUIRED', barcode });
    }
    if (stage === 'dispatch' && !session.operator) return json(401, { code: 'ZTO_PALM_RELOGIN_REQUIRED' });
    const checked = await request('/zto/basic/v2/newBusinessCheck', {
        billCode: barcode, scanType, dataFrom: 'Z10-VN-PDA', ignoreCodBacklog: 0, ignoreDispSiteId: 0,
        ...(session.provinceCode ? { provinceCode: session.provinceCode } : {}), ...(stage === 'receipt' ? { billCodeLists: [] } : {})
    });
    const rejected = stage === 'receipt' ? receiptPrewriteFailure(checked) : failure(checked, 'ZTO_PALM_SIGN_CHECK_REJECTED');
    if (rejected) return rejected;
    if (checked.result) {
        const result = checked.result;
        if (typeof result !== 'object' || Array.isArray(result)
            || result.message != null && typeof result.message !== 'string'
            || result.whetherForce !== undefined && typeof result.whetherForce !== 'boolean') {
            return json(409, { code: 'ZTO_PALM_SIGN_CHECK_REJECTED', barcode });
        }
        if (result.message) {
            const message = result.message;
            if (message.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) {
                return json(409, { code: 'ZTO_PALM_SIGN_CHECK_REJECTED', barcode });
            }
            if (result.whetherForce === true || /90187|90189/.test(message)) {
                return json(409, { code: 'ZTO_PALM_SIGN_CHECK_REJECTED', barcode, message });
            }
            if (!confirmation || confirmation.warningHash !== hash(message)) {
                return json(409, { code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode, stage, message,
                    confirmationToken: proof.seal({ kind: 'scan-confirm', binding: confirmationBinding(input, session),
                        warningHash: hash(message), expiresAt: Date.now() + 300000 }) });
            }
        }
    }
    if (input.checkOnly) return json(200, { success: true, barcode, stage: 'receipt-check', ready: true });
    const scanDate = localStamp();
    if (stage === 'receipt') {
        const log = await request('/zto/sign/log/v1/add', { billCode: barcode, actionTime: scanDate });
        const logFailure = receiptPrewriteFailure(log);
        if (logFailure) return logFailure;
        if (!journal?.skipPhoto) {
            if (journal?.imageSending) await journal.imageSending();
            const image = await request('/zto/basic/v1/saveBillPic', { fileName: photo, picType: 1, billCode: barcode });
            const imageFailure = failure(image, 'ZTO_PALM_SIGN_PHOTO_REJECTED');
            if (imageFailure) return imageFailure;
            if (journal) await journal.photo();
        }
    }
    const barScannerId = Number.parseInt(crypto.createHash('sha256').update(requestId + '|' + stage + '|' + barcode).digest('hex').slice(0, 12), 16);
    const payload = [{ barScannerId, billCode: barcode, scanTypeCode: stage === 'dispatch' ? '04' : '05', scanDate, zone: 'GMT+07:00',
        ...(stage === 'dispatch' ? { dispatchOrSendManCode: session.operator } : { signMan }),
        dataFrom: 'Z10-VN-PDA', dataType: 0, goodsHigh: 0, goodsLong: 0, goodsWidth: 0, volumeWeight: 0, weight: 0, isLaPackage: false }];
    if (journal) await journal.sending();
    try {
        const uploaded = await request('/zto/basic/v1/saveScanInfo', payload);
        const uploadFailure = failure(uploaded, 'ZTO_PALM_SIGN_REJECTED');
        if (uploadFailure) return uploadFailure;
        if (uploaded.result !== null && uploaded.result !== undefined && !Array.isArray(uploaded.result)) throw new Error('scan:result');
        const errors = uploaded.result || [];
        if (errors.some((row) => !row || Number(row.barScannerId) !== barScannerId)) throw new Error('scan:identity');
        if (errors.length) return journal ? await journal.rejected() : json(409, { code: 'ZTO_PALM_SIGN_REJECTED', barcode });
        if (stage === 'dispatch') return json(200, { success: true, provider: 'zto-palm', barcode, stage, ztoClosed: false,
            dispatchProof: proof.seal({ kind: 'dispatch', barcode, requestId, tokenHash: crypto.createHash('sha256').update(session.token).digest('hex'), expiresAt: Date.now() + 3600000 }) });
        try { await request('/zto/sign/log/v1/deleteByBillCode', { billCodeList: [barcode] }); } catch (_) {}
        return json(200, { success: true, provider: 'zto-palm', barcode, stage, ztoClosed: true });
    } catch (_) {
        return json(504, { code: 'ZTO_PALM_SIGN_UNCONFIRMED', barcode, stage, uncertain: true });
    }
}

function dispatchProof(input, session, proof) {
    return proof.seal({ kind: 'dispatch', barcode: input.barcode, requestId: input.requestId,
        tokenHash: crypto.createHash('sha256').update(session.token).digest('hex'), expiresAt: Date.now() + 3600000 });
}

async function status(input, session, request, proof) {
    const upstream = await request('/zto/locus/v1/queryTrackInfo', { mailType: 1, mailNos: input.barcode });
    const rejected = failure(upstream, 'ZTO_PALM_STATUS_UNCONFIRMED');
    if (rejected) return rejected;
    const code = input.barcode.toUpperCase();
    const matches = Array.isArray(upstream.result) ? upstream.result.filter((row) => String(row?.mail?.mailNo || '').trim().toUpperCase() === code) : [];
    if (matches.length !== 1 || !Array.isArray(matches[0].tracks)) return json(409, { code: 'ZTO_PALM_STATUS_UNCONFIRMED' });
    let dispatched = '';
    let reset = '';
    let problemScan;
    let problemAt = '';
    for (const track of matches[0].tracks) {
        const at = proof.stamp(track?.time);
        if (!track || String(track.mailNo || '').trim().toUpperCase() !== code || !at || !String(track.siteCode || '').trim()
            || (typeof track.action !== 'string' && typeof track.action !== 'number')) return json(409, { code: 'ZTO_PALM_STATUS_UNCONFIRMED' });
        const action = String(track.action);
        if (['1', '2', '3', '5', '-710', '32', '9'].includes(action) && at > reset) reset = at;
        if (String(track.siteCode).trim().toUpperCase() === session.site.trim().toUpperCase() && at > problemAt
            && (['29', '-579'].includes(action) || [track.msgLoc, track.msgEng, track.message].some((value) => typeof value === 'string'
                && /【(?:问题件|កញ្ចប់អីវ៉ាន់មានបញ្ហា)】|\[problem piece\]/i.test(value)))) {
            const text = [track.msgLoc, track.msgEng, track.actionName].find((value) => typeof value === 'string' && value.trim()
                && value.length <= 4000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value));
            problemScan = { action, time: track.time, message: text || (action === '-579' ? 'ទាក់ទងអតិថិជនមិនបាន' : 'មានស្កេនកញ្ចប់បញ្ហា') };
            problemAt = at;
        }
        if ((action === '4' || ['-71', '-588'].includes(action) && track.preOrNextID === '04') && String(track.siteCode).trim().toUpperCase() === session.site.trim().toUpperCase() && at > dispatched) dispatched = at;
    }
    const verdict = proof.verdict(upstream, input.barcode, session.site);
    if (verdict.ztoClosed === true) return json(200, { success: true, barcode: input.barcode, stage: 'status', ztoClosed: true, dispatched: true });
    if (matches[0].mail.isSign !== 0) return json(409, { code: 'ZTO_PALM_STATUS_UNCONFIRMED' });
    const done = !!dispatched && dispatched > reset;
    return json(200, { success: true, barcode: input.barcode, stage: 'status', ztoClosed: false, dispatched: done,
        ...(problemScan && problemAt >= reset ? { problemScan } : {}),
        ...(done ? { dispatchProof: dispatchProof(input, session, proof) } : {}) });
}

async function receiptPhotoProof(input, request) {
    try {
        const upstream = await request('/zto/picture/v1/querySignPic', { billCode: input.barcode });
        if (failure(upstream, 'ZTO_INVALID_RESPONSE')) return { verified: false, reason: 'upstream_unavailable' };
        if (!Array.isArray(upstream.result)) return { verified: false, reason: 'unsupported_schema', manualReview: true };
        if (!upstream.result.length) return { verified: false, reason: 'empty' };
        if (upstream.result.length > 4) return { verified: false, reason: 'reference_limit', manualReview: true };
        if (upstream.result.some(row => !row || typeof row !== 'object' || Array.isArray(row) || row.billCode !== input.barcode
            || Object.prototype.hasOwnProperty.call(row, 'picType') && row.picType !== 1
            || typeof row.savePos !== 'string' || !row.savePos.trim() || row.aliasName != null && typeof row.aliasName !== 'string')) return { verified: false, reason: 'unsupported_schema', manualReview: true };
        const result = await require('./zto-receipt-photo-readback').verifyReceiptPhoto({ authenticated: true, barcode: input.barcode,
            expectedSha256: input.originalSHA256, receiptRefs: upstream.result.map(row => ({ source: 'palm', barcode: row.billCode, kind: 'receipt', picType: 1, url: row.savePos })) });
        return { verified: result.verified === true, reason: result.reason,
            ...(['invalid_input', 'invalid_reference', 'body_limit', 'unsupported_content_type', 'invalid_image'].includes(result.reason) ? { manualReview: true } : {}) };
    } catch (_) { return { verified: false, reason: 'upstream_unavailable' }; }
}

async function signPalm(event, session, deps, request, proof) {
    const input = readInput(event);
    if (!input) return json(400, { code: 'ZTO_PALM_SIGN_INVALID' });
    const access = await deps.lookupAccess();
    if (access?.response) return access.response;
    if (!session.site || (access?.verified && String(access.site).trim().toUpperCase() !== session.site.trim().toUpperCase())) {
        return json(403, { code: 'ZTO_OTHER_BRANCH' });
    }
    if (['receipt', 'receipt-status', 'receipt-cancel', 'receipt-warning-refresh', 'receipt-prewrite-refresh'].includes(input.stage) && (input.photoProtocol !== PHOTO_PROTOCOL || !/^[a-f0-9]{64}$/.test(input.originalSHA256 || ''))) return json(409, { code: 'ZTO_PALM_SIGN_PROTOCOL_REQUIRED', barcode: input.barcode });
    if (['receipt-cancel', 'receipt-warning-refresh', 'receipt-prewrite-refresh'].includes(input.stage) && input.reservationProtocol !== 'original-reservation-v1') return json(409, { code: 'ZTO_PALM_SIGN_PROTOCOL_REQUIRED', barcode: input.barcode });
    if (input.photo && ['receipt', 'receipt-warning-refresh', 'receipt-prewrite-refresh'].includes(input.stage) && !input.checkOnly && hash(Buffer.from(input.photo, 'base64')) !== input.originalSHA256) return json(409, { code: 'ZTO_PALM_SIGN_INVALID', barcode: input.barcode });
    if (input.reservationProtocol && input.photo && hash(JSON.stringify([input.barcode, input.requestId, input.signMan, input.photo])) !== input.originalFingerprint) return json(409, { code: 'ZTO_PALM_SIGN_INVALID', barcode: input.barcode });
    if (input.stage === 'photo-status') return require('./zto-palm-photo-status').photoStatus(input, request);
    if (input.stage === 'status') return status(input, session, request, proof);
    if (input.checkOnly) return submit(input, session, request, proof);
    const submission = ['receipt-warning-refresh', 'receipt-prewrite-refresh'].includes(input.stage) ? { ...input, stage: 'receipt', checkOnly: true, confirmationToken: '' } : input;
    if (['receipt-status', 'receipt-cancel', 'receipt-warning-refresh', 'receipt-prewrite-refresh'].includes(input.stage) || input.background && input.stage === 'receipt') return withSignJournal(input, session, deps, proof,
        (journal) => submit(submission, session, request, proof, journal), () => status(input, session, request, proof), () => receiptPhotoProof(input, request));
    const key = crypto.createHash('sha256').update(session.token + '|' + input.requestId + '|' + input.stage + '|' + input.barcode).digest('hex');
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify([input.signMan, input.photo, input.dispatchProof, input.confirmationToken])).digest('hex');
    for (const [id, entry] of runs) if (entry.at < Date.now() - 600000 && !entry.active) runs.delete(id);
    const old = runs.get(key);
    if (old) return old.fingerprint === fingerprint ? old.promise : json(409, { code: 'ZTO_PALM_SIGN_INVALID' });
    for (const [id, entry] of runs) {
        if (runs.size < RUNS_MAX) break;
        if (!entry.active) runs.delete(id);
    }
    if (runs.size >= RUNS_MAX) return json(429, { code: 'ZTO_RATE_LIMITED' });
    const entry = { fingerprint, at: Date.now(), active: true, promise: null };
    entry.promise = (input.stage === 'receipt'
        ? withSignJournal(input, session, deps, proof, (journal) => submit(submission, session, request, proof, journal), () => status(input, session, request, proof), () => receiptPhotoProof(input, request))
        : submit(input, session, request, proof)).then((response) => {
        entry.active = false;
        if (response.statusCode !== 200 && !JSON.parse(response.body).uncertain) runs.delete(key);
        return response;
    }, (error) => { runs.delete(key); throw error; });
    runs.set(key, entry);
    return entry.promise;
}

module.exports = { signPalm, isStatusRequest: (event) => ['status', 'receipt-status', 'receipt-cancel', 'receipt-warning-refresh', 'receipt-prewrite-refresh'].includes(readInput(event)?.stage) };
