'use strict';

const ztoSession = require('../lib/zto-session.js');

const ZTO_ENDPOINT = 'https://aargus-api.ztoglobal.com/scan/get/order/detail';
const BARCODE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const ZTO_UPSTREAM_TIMEOUT_MS = 12000;
const FORBIDDEN_FORWARD_HEADER_RE = /^(?:authorization|connection|content-length|cookie|host|origin|referer|transfer-encoding)$/i;

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'no-referrer'
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
            if (/^[A-Za-z0-9-]{1,80}$/.test(name) && !FORBIDDEN_FORWARD_HEADER_RE.test(name) && typeof parsed[name] === 'string') {
                safe[name] = parsed[name];
            }
        });
        return safe;
    } catch (_) {
        return {};
    }
}

function applyStaticZtoAuthentication(headers) {
    if (process.env.ZTO_AUTHORIZATION) {
        headers.Authorization = process.env.ZTO_AUTHORIZATION;
        return 'authorization';
    }
    if (process.env.ZTO_TOKEN) {
        const tokenHeader = process.env.ZTO_TOKEN_HEADER || 'X-Access-Token';
        if (!/^[A-Za-z0-9-]{1,80}$/.test(tokenHeader) || FORBIDDEN_FORWARD_HEADER_RE.test(tokenHeader)) return '';
        headers[tokenHeader] = process.env.ZTO_TOKEN;
        return 'token';
    }
    if (process.env.ZTO_COOKIE) {
        headers.Cookie = process.env.ZTO_COOKIE;
        return 'cookie';
    }
    return '';
}

const SAFE_AUTO_LOGIN_CODES = new Set([
    'ZTO_AUTO_LOGIN_NOT_CONFIGURED',
    'ZTO_SESSION_KEY_INVALID',
    'ZTO_SESSION_STORE_UNAVAILABLE',
    'ZTO_LOGIN_CHALLENGE',
    'ZTO_LOGIN_REJECTED',
    'ZTO_LOGIN_TIMEOUT',
    'ZTO_LOGIN_UNAVAILABLE',
    'ZTO_LOGIN_NO_SESSION',
    'ZTO_LOGIN_BUSY'
]);

const SAFE_REASON_RE = /^[A-Za-z0-9_.:@-]{1,80}$/;

function autoLoginErrorResponse(error) {
    const code = error instanceof ztoSession.ZtoSessionError && SAFE_AUTO_LOGIN_CODES.has(error.code)
        ? error.code
        : 'ZTO_LOGIN_UNAVAILABLE';
    const statusCode = error instanceof ztoSession.ZtoSessionError
        && [401, 409, 502, 503, 504].includes(Number(error.statusCode))
        ? Number(error.statusCode)
        : 503;
    const messages = {
        ZTO_AUTO_LOGIN_NOT_CONFIGURED: 'ZTO auto login is not configured',
        ZTO_SESSION_KEY_INVALID: 'ZTO session encryption key is invalid',
        ZTO_SESSION_STORE_UNAVAILABLE: 'ZTO session store is unavailable',
        ZTO_LOGIN_CHALLENGE: 'ZTO requires CAPTCHA or additional verification',
        ZTO_LOGIN_REJECTED: 'ZTO rejected the login credentials',
        ZTO_LOGIN_TIMEOUT: 'ZTO login timed out',
        ZTO_LOGIN_UNAVAILABLE: 'Unable to complete ZTO login',
        ZTO_LOGIN_NO_SESSION: 'ZTO login did not create a session',
        ZTO_LOGIN_BUSY: 'Another ZTO login is still running'
    };
    const body = { error: messages[code], code };
    const reason = error instanceof ztoSession.ZtoSessionError ? String(error.reason || '') : '';
    if (reason && SAFE_REASON_RE.test(reason)) body.reason = reason;
    return json(statusCode, body);
}

function upstreamMessage(upstream, fallback) {
    const raw = upstream && (upstream.error || upstream.message || upstream.msg);
    if (typeof raw !== 'string') return fallback;
    const safe = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 180);
    return safe || fallback;
}

const LOGIN_REDIRECT_RE = /https?:\/\/[^\s"']*(?:oauth|\/login\b|\/signin\b|sso[.\/]|iam[-.])/i;

function ztoAuthRejected(response, upstream) {
    if (response && (response.status === 401 || response.status === 403)) return true;
    const code = String(upstream && (upstream.code || upstream.errorCode) || '').toLowerCase();
    const raw = upstreamMessage(upstream, '');
    const message = raw.toLowerCase();
    if (/^(?:401|403|unauthorized|forbidden|not[_-]?login|login[_-]?required)$/.test(code)) return true;
    if (LOGIN_REDIRECT_RE.test(raw)) return true;
    return /(?:session|token|cookie|login|auth).{0,32}(?:expired|invalid|required|missing|failed)|(?:expired|invalid).{0,16}(?:session|token|cookie)|not\s+(?:logged|signed)\s+in|unauthori[sz]ed|未登录|登录失效|登录过期/.test(message);
}

function authExpiredResponse() {
    return json(401, {
        error: 'ZTO session or token expired',
        code: 'ZTO_AUTH_EXPIRED'
    });
}

async function requestZtoOrder(headers, barcode) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ZTO_UPSTREAM_TIMEOUT_MS);

    try {
        const response = await fetch(ZTO_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({ billCode: barcode, countryCode: 'KH' }),
            signal: controller.signal,
            redirect: 'manual'
        });

        const contentType = response.headers && response.headers.get
            ? (response.headers.get('content-type') || '')
            : '';
        if (response.status === 401 || response.status === 403
            || (response.status >= 300 && response.status < 400)
            || (response.ok && /^text\/html\b/i.test(contentType))) {
            return { authRejected: true };
        }

        let upstream;
        try {
            upstream = await response.json();
        } catch (_) {
            return {
                response: json(502, {
                    error: 'ZTO returned non-JSON (HTTP ' + response.status + ', ' + (contentType || 'unknown').split(';')[0] + ')',
                    code: 'ZTO_INVALID_RESPONSE'
                })
            };
        }

        if (ztoAuthRejected(response, upstream)) return { authRejected: true };

        if (response.status === 429) {
            return {
                response: json(429, {
                    error: 'ZTO rate limit reached',
                    code: 'ZTO_RATE_LIMITED'
                })
            };
        }

        if (!response.ok || !upstream || upstream.success === false || !upstream.data) {
            return {
                response: json(502, {
                    error: upstreamMessage(upstream, 'ZTO HTTP ' + response.status),
                    code: 'ZTO_UPSTREAM_REJECTED'
                })
            };
        }

        const order = upstream.data;
        return {
            response: json(200, {
                phone: order.consigneePhone || order.consigneeMobile || '',
                cod: Number(order.agentAmount) || 0,
                dod: Number(order.arrivalServiceCharge) || 0,
                barcode: order.billCode || barcode,
                success: true
            })
        };
    } catch (error) {
        if (error && error.name === 'AbortError') {
            return { response: json(504, { error: 'ZTO request timed out', code: 'ZTO_TIMEOUT' }) };
        }
        return { response: json(502, { error: 'Unable to reach ZTO', code: 'ZTO_UNAVAILABLE' }) };
    } finally {
        clearTimeout(timer);
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
        'Content-Type': 'application/json;charset=UTF-8',
        Origin: 'https://argus.ztoglobal.com',
        Referer: 'https://argus.ztoglobal.com/',
        'Accept-Language': 'km',
        'User-Language': 'km',
        'User-Agent': ztoSession.ZTO_USER_AGENT
    }, parseExtraHeaders(process.env.ZTO_REQUEST_HEADERS_JSON));

    const autoLoginEnabled = ztoSession.isAutoLoginEnabled(process.env);
    let authenticationKind = applyStaticZtoAuthentication(headers);
    if (!authenticationKind && autoLoginEnabled) {
        try {
            headers.Cookie = await ztoSession.getAutoSessionCookie({ lambdaEvent: event });
            authenticationKind = 'auto-cookie';
        } catch (error) {
            return autoLoginErrorResponse(error);
        }
    }

    if (!authenticationKind) {
        return json(503, {
            error: 'ZTO authentication is not configured',
            code: 'ZTO_AUTH_NOT_CONFIGURED'
        });
    }

    let lookup = await requestZtoOrder(headers, barcode);
    if (!lookup.authRejected) return lookup.response;

    const officialCredential = authenticationKind === 'authorization' || authenticationKind === 'token';
    if (!autoLoginEnabled || officialCredential) return authExpiredResponse();

    try {
        const rejectedCookie = String(headers.Cookie || '');
        headers.Cookie = await ztoSession.getAutoSessionCookie({
            forceRefresh: true,
            rejectedCookie,
            lambdaEvent: event
        });
    } catch (error) {
        return autoLoginErrorResponse(error);
    }

    lookup = await requestZtoOrder(headers, barcode);
    return lookup.authRejected ? authExpiredResponse() : lookup.response;
};
