'use strict';

const crypto = require('node:crypto');
const MAX_PHOTO_BYTES = 900000;
const runs = new Map();

function json(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function readInput(event) {
    if (event.isBase64Encoded || typeof event.body !== 'string' || Buffer.byteLength(event.body) > 1250000) return null;
    let input;
    try { input = JSON.parse(event.body); } catch (_) { return null; }
    const { barcode, signMan, photo, requestId } = input || {};
    if (typeof barcode !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(barcode)
        || typeof signMan !== 'string' || !signMan.trim() || signMan.length > 120 || /[\u0000-\u001f\u007f]/.test(signMan)
        || typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)
        || typeof photo !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo) || photo.length % 4 !== 0) return null;
    const bytes = Buffer.from(photo, 'base64');
    if (bytes.length < 8 || bytes.length > MAX_PHOTO_BYTES || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255
        || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217 || bytes.toString('base64') !== photo) return null;
    return { barcode, signMan: signMan.trim(), photo, requestId };
}

function failure(upstream, code) {
    if (upstream.authRejected || /^(401|403|not_login|token_expired|token_invalid|login_expired|login_required)$/i.test(String(upstream.statusCode || ''))) {
        return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' });
    }
    if (upstream.status !== true) return json(502, { code });
    return null;
}

function localStamp() {
    return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
}

async function submit(input, session, request) {
    const { barcode, signMan, photo, requestId } = input;
    const checked = await request('/zto/scan/v1/khSignScanCheck', { billCode: barcode, scanType: 5, dataFrom: 'Z10-VN-PDA' });
    const rejected = failure(checked, 'ZTO_PALM_SIGN_CHECK_REJECTED');
    if (rejected) return rejected;
    const check = checked.result;
    if (!check || typeof check !== 'object' || check.errorMessage || check.waybillResVo?.billCode !== barcode) {
        return json(409, { code: 'ZTO_PALM_SIGN_CHECK_REJECTED', barcode });
    }
    if (check.waybillResVo.paymentStatus !== 2) return json(409, { code: 'ZTO_PALM_SIGN_PAYMENT_REQUIRED', barcode });
    const image = await request('/zto/basic/v1/saveBillPic', { fileName: photo, picType: 1, billCode: barcode });
    const imageFailure = failure(image, 'ZTO_PALM_SIGN_PHOTO_REJECTED');
    if (imageFailure) return imageFailure;
    const barScannerId = Number.parseInt(crypto.createHash('sha256').update(requestId + '|' + barcode).digest('hex').slice(0, 12), 16);
    const payload = [{ barScannerId, billCode: barcode, signMan, scanTypeCode: '05', scanDate: localStamp(), zone: 'GMT+07:00',
        dataFrom: 'Z10-VN-PDA', dataType: 0, goodsHigh: 0, goodsLong: 0, goodsWidth: 0, volumeWeight: 0, weight: 0, isLaPackage: false }];
    try {
        const signed = await request('/zto/basic/v1/uploadKhSignScan', payload);
        const signFailure = failure(signed, 'ZTO_PALM_SIGN_REJECTED');
        if (signFailure) return signFailure;
        if (signed.result !== null && signed.result !== undefined && !Array.isArray(signed.result)) throw new Error('sign:result');
        const errors = signed.result || [];
        if (errors.some((row) => !row || Number(row.barScannerId) !== barScannerId)) throw new Error('sign:identity');
        if (errors.length) return json(409, { code: 'ZTO_PALM_SIGN_REJECTED', barcode });
        return json(200, { success: true, provider: 'zto-palm', barcode, ztoClosed: true });
    } catch (_) {
        return json(504, { code: 'ZTO_PALM_SIGN_UNCONFIRMED', barcode, uncertain: true });
    }
}

async function signPalm(event, session, deps, request) {
    const input = readInput(event);
    if (!input) return json(400, { code: 'ZTO_PALM_SIGN_INVALID' });
    const access = await deps.lookupAccess();
    if (access?.response) return access.response;
    if (!session.site || (access?.verified && String(access.site).trim().toUpperCase() !== session.site.trim().toUpperCase())) {
        return json(403, { code: 'ZTO_OTHER_BRANCH' });
    }
    const key = crypto.createHash('sha256').update(session.token + '|' + input.requestId + '|' + input.barcode).digest('hex');
    const fingerprint = crypto.createHash('sha256').update(input.signMan + '|' + input.photo).digest('hex');
    for (const [id, entry] of runs) if (entry.at < Date.now() - 600000 && !entry.active) runs.delete(id);
    const old = runs.get(key);
    if (old) return old.fingerprint === fingerprint ? old.promise : json(409, { code: 'ZTO_PALM_SIGN_INVALID' });
    if (runs.size >= 256) return json(429, { code: 'ZTO_RATE_LIMITED' });
    const entry = { fingerprint, at: Date.now(), active: true, promise: null };
    entry.promise = submit(input, session, request).then((response) => {
        entry.active = false;
        if (response.statusCode !== 200 && !JSON.parse(response.body).uncertain) runs.delete(key);
        return response;
    }, (error) => { runs.delete(key); throw error; });
    runs.set(key, entry);
    return entry.promise;
}

module.exports = { signPalm };
