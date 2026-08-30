'use strict';

const ZTO_ENDPOINT = 'https://aargus-api.ztoglobal.com/scan/get/order/detail';
const BARCODE_RE = /^[A-Za-z0-9_-]{6,64}$/;

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
        },
        body: JSON.stringify(body)
    };
}

function timingSafeEqualText(left, right) {
    const a = Buffer.from(String(left || ''));
    const b = Buffer.from(String(right || ''));
    if (a.length !== b.length) return false;
    return require('crypto').timingSafeEqual(a, b);
}

function parseExtraHeaders(raw) {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return {};
        const safe = {};
        Object.keys(parsed).forEach((name) => {
            if (/^[A-Za-z0-9-]{1,80}$/.test(name) && typeof parsed[name] === 'string') {
                safe[name] = parsed[name];
            }
        });
        return safe;
    } catch (_) {
        return {};
    }
}

exports.handler = async function handler(event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' }, body: '' };
    }
    if (event.httpMethod !== 'GET') {
        return json(405, { error: 'Method not allowed' });
    }

    const proxyKey = process.env.ZTO_PROXY_KEY || '';
    const suppliedKey = (event.headers && (event.headers['x-zoe-proxy-key'] || event.headers['X-Zoe-Proxy-Key'])) || '';
    if (!proxyKey) {
        return json(503, { error: 'ZTO proxy is not configured' });
    }
    if (!timingSafeEqualText(proxyKey, suppliedKey)) {
        return json(401, { error: 'Invalid proxy key' });
    }

    const barcode = String((event.queryStringParameters && event.queryStringParameters.barcode) || '').trim();
    if (!BARCODE_RE.test(barcode)) {
        return json(400, { error: 'Invalid barcode' });
    }

    const headers = Object.assign({
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8'
    }, parseExtraHeaders(process.env.ZTO_REQUEST_HEADERS_JSON));

    if (process.env.ZTO_AUTHORIZATION) headers.Authorization = process.env.ZTO_AUTHORIZATION;
    if (process.env.ZTO_COOKIE) headers.Cookie = process.env.ZTO_COOKIE;
    if (process.env.ZTO_TOKEN) headers[process.env.ZTO_TOKEN_HEADER || 'X-Access-Token'] = process.env.ZTO_TOKEN;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(ZTO_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({ billCode: barcode, countryCode: 'KH' }),
            signal: controller.signal
        });

        let upstream;
        try {
            upstream = await response.json();
        } catch (_) {
            return json(502, { error: 'ZTO returned a non-JSON response' });
        }

        if (!response.ok || !upstream || upstream.success === false || !upstream.data) {
            const message = upstream && upstream.error
                ? (typeof upstream.error === 'string' ? upstream.error : 'ZTO rejected the request')
                : ('ZTO HTTP ' + response.status);
            return json(response.status === 401 || response.status === 403 ? 502 : response.status, { error: message });
        }

        const order = upstream.data;
        return json(200, {
            phone: order.consigneePhone || order.consigneeMobile || '',
            cod: Number(order.agentAmount) || 0,
            dod: Number(order.arrivalServiceCharge) || 0,
            barcode: order.billCode || barcode,
            customerName: order.consigneeName || '',
            destination: order.destinationSite || '',
            success: true
        });
    } catch (error) {
        return json(502, { error: error && error.name === 'AbortError' ? 'ZTO request timed out' : 'Unable to reach ZTO' });
    } finally {
        clearTimeout(timer);
    }
};
