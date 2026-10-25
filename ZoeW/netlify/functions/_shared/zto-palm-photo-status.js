'use strict';

function response(input, photoStatus, count, statusCode = 200, code) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ provider: 'zto-palm', barcode: input.barcode, requestId: input.requestId,
            stage: 'photo-status', photoStatus, count, ...(code ? { code } : {}) })
    };
}

async function photoStatus(input, request) {
    try {
        const upstream = await request('/zto/picture/v1/querySignPic', { billCode: input.barcode });
        if (upstream.authRejected || /^(401|403|not_login|token_expired|token_invalid|login_expired|login_required)$/i.test(String(upstream.statusCode || ''))) {
            return response(input, 'unknown', null, 401, 'ZTO_AUTH_EXPIRED');
        }
        const rows = upstream.result;
        if (upstream.status !== true || !Array.isArray(rows) || rows.length > 200
            || rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row)
                || typeof row.billCode !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(row.billCode)
                || typeof row.savePos !== 'string' || !row.savePos.trim()
                || row.aliasName != null && typeof row.aliasName !== 'string')) {
            return response(input, 'unknown', null, 502, 'ZTO_INVALID_RESPONSE');
        }
        if (!rows.length) return response(input, 'none_observed', 0);
        const count = rows.filter((row) => row.billCode === input.barcode).length;
        return count ? response(input, 'listed', count) : response(input, 'unknown', null, 502, 'ZTO_INVALID_RESPONSE');
    } catch (_) {
        return response(input, 'unknown', null, 502, 'ZTO_UNAVAILABLE');
    }
}

module.exports = { photoStatus };
