'use strict';

const crypto = require('crypto');

const DEFAULT_API_URL = 'https://aargus-api.ztoglobal.com/scan/get/order/detail';
const DEFAULT_BROWSER_ORIGIN = 'https://argus.ztoglobal.com';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
const DEFAULT_BODY_TEMPLATE = '{"billCode":"{barcode}","countryCode":"KH"}';
const DEFAULT_QUERY_PARAM = 'billCode';
const DEFAULT_ACCEPT_LANGUAGE = 'km';

const BARCODE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const HEADER_NAME_RE = /^[A-Za-z0-9-]{1,80}$/;
const FORBIDDEN_FORWARD_HEADER_RE = /^(?:authorization|connection|content-length|cookie|host|transfer-encoding)$/i;
const FIELD_PATH_RE = /^[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*$/;
const QUERY_PARAM_RE = /^[A-Za-z0-9_.-]{1,40}$/;
const SAFE_REASON_RE = /^[A-Za-z0-9_.:@-]{1,80}$/;
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]+/g;
const SUCCESS_CODE_RE = /^(?:0+|200|success|succeed|ok|true)$/;
const LOGIN_REDIRECT_RE = /https?:\/\/[^\s"']*(?:oauth|\/login\b|\/signin\b|sso[.\/]|iam[-.])/i;

const PHONE_PATHS = ['consigneePhone', 'consigneeMobile', 'consigneeTel', 'receiverPhone', 'receiverMobile', 'recipientPhone', 'recipientMobile', 'phone', 'mobile'];
const COD_PATHS = ['agentAmount', 'codAmount', 'collectionAmount', 'codFee', 'cod'];
const DOD_PATHS = ['arrivalServiceCharge', 'dodAmount', 'arrivalCharge', 'serviceCharge', 'dod'];
const BARCODE_PATHS = ['billCode', 'waybillNo', 'waybillCode', 'mailNo', 'barcode'];

const FIELD_SEPARATOR = '|';
const CACHE_MAX = 200;
const resultCache = new Map();
const inFlight = new Map();

class ZtoConfigError extends Error {
    constructor(reason) {
        super('ZTO_CONFIG_INVALID');
        this.name = 'ZtoConfigError';
        this.reason = String(reason || '');
    }
}

function elapsedSince(mark) {
    if (!mark) return Infinity;
    const delta = Date.now() - mark;
    return delta < 0 ? Infinity : delta;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    return crypto.timingSafeEqual(a, b);
}

function boundedInteger(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function boolEnv(value, fallback) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (!text) return fallback;
    if (/^(?:1|true|yes|on)$/i.test(text)) return true;
    if (/^(?:0|false|no|off)$/i.test(text)) return false;
    return fallback;
}

function parseExtraHeaders(raw) {
    if (!raw) return {};
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (_) {
        throw new ZtoConfigError('headers:invalid-json');
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new ZtoConfigError('headers:not-object');
    }
    const safe = {};
    Object.keys(parsed).forEach((name) => {
        if (HEADER_NAME_RE.test(name) && !FORBIDDEN_FORWARD_HEADER_RE.test(name) && typeof parsed[name] === 'string') {
            safe[name] = parsed[name];
        }
    });
    return safe;
}

function readFieldPaths(raw, defaults, label) {
    const text = String(raw || '').trim();
    if (!text) return defaults;
    const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return defaults;
    parts.forEach((part) => {
        if (part.length > 120 || !FIELD_PATH_RE.test(part)) throw new ZtoConfigError('field:' + label);
    });
    const merged = parts.slice();
    defaults.forEach((part) => { if (merged.indexOf(part) === -1) merged.push(part); });
    return merged.slice(0, 24);
}

function readHttpsUrl(raw, label) {
    let url;
    try {
        url = new URL(String(raw));
    } catch (_) {
        throw new ZtoConfigError(label + ':invalid');
    }
    if (url.protocol !== 'https:') throw new ZtoConfigError(label + ':not-https');
    return url;
}

function readBodyTemplate(raw) {
    const text = String(raw || '').trim() || DEFAULT_BODY_TEMPLATE;
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (_) {
        throw new ZtoConfigError('body:invalid-json');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new ZtoConfigError('body:not-object');
    }
    return parsed;
}

function fillTemplate(value, barcode, depth) {
    if (depth > 6) return value;
    if (typeof value === 'string') return value.split('{barcode}').join(barcode);
    if (Array.isArray(value)) return value.map((item) => fillTemplate(item, barcode, depth + 1));
    if (value && typeof value === 'object') {
        const out = {};
        Object.keys(value).forEach((key) => { out[key] = fillTemplate(value[key], barcode, depth + 1); });
        return out;
    }
    return value;
}

function readConfig(env) {
    const endpoint = readHttpsUrl(String(env.ZTO_API_URL || '').trim() || DEFAULT_API_URL, 'api-url');
    const method = String(env.ZTO_API_METHOD || 'POST').trim().toUpperCase();
    if (method !== 'GET' && method !== 'POST') throw new ZtoConfigError('method:unsupported');

    const queryParam = String(env.ZTO_REQUEST_QUERY_PARAM || DEFAULT_QUERY_PARAM).trim();
    if (!QUERY_PARAM_RE.test(queryParam)) throw new ZtoConfigError('query-param:invalid');

    const browserOrigin = readHttpsUrl(String(env.ZTO_BROWSER_ORIGIN || '').trim() || DEFAULT_BROWSER_ORIGIN, 'browser-origin');
    const acceptLanguage = String(env.ZTO_ACCEPT_LANGUAGE || DEFAULT_ACCEPT_LANGUAGE).trim().slice(0, 60) || DEFAULT_ACCEPT_LANGUAGE;
    if (!/^[A-Za-z0-9,;=*.\- ]+$/.test(acceptLanguage)) throw new ZtoConfigError('accept-language:invalid');

    const config = {
        endpoint,
        method,
        queryParam,
        bodyTemplate: method === 'POST' ? readBodyTemplate(env.ZTO_REQUEST_BODY_JSON) : null,
        extraHeaders: parseExtraHeaders(env.ZTO_REQUEST_HEADERS_JSON),
        userAgent: String(env.ZTO_USER_AGENT || DEFAULT_USER_AGENT).replace(CONTROL_CHAR_RE, ' ').slice(0, 300),
        acceptLanguage,
        browserOrigin: browserOrigin.origin,
        sendBrowserHeaders: boolEnv(env.ZTO_SEND_BROWSER_HEADERS, null),
        phonePaths: readFieldPaths(env.ZTO_FIELD_PHONE, PHONE_PATHS, 'phone'),
        codPaths: readFieldPaths(env.ZTO_FIELD_COD, COD_PATHS, 'cod'),
        dodPaths: readFieldPaths(env.ZTO_FIELD_DOD, DOD_PATHS, 'dod'),
        barcodePaths: readFieldPaths(env.ZTO_FIELD_BARCODE, BARCODE_PATHS, 'barcode'),
        upstreamTimeoutMs: boundedInteger(env.ZTO_UPSTREAM_TIMEOUT_MS, 8000, 2000, 20000),
        budgetMs: boundedInteger(env.ZTO_REQUEST_BUDGET_MS, 14000, 4000, 24000),
        retries: boundedInteger(env.ZTO_UPSTREAM_RETRIES, 1, 0, 3),
        cacheTtlMs: boundedInteger(env.ZTO_CACHE_TTL_MS, 60000, 0, 600000)
    };

    config.budgetMs = Math.min(24000, Math.max(config.budgetMs, config.upstreamTimeoutMs + 1500));
    config.upstreamTimeoutMs = Math.min(config.upstreamTimeoutMs, config.budgetMs - 1000);

    config.fingerprint = crypto.createHash('sha256')
        .update(config.endpoint.href).update(FIELD_SEPARATOR)
        .update(config.method).update(FIELD_SEPARATOR)
        .update(JSON.stringify(config.bodyTemplate || {})).update(FIELD_SEPARATOR)
        .update(String(env.ZTO_AUTHORIZATION || '')).update(FIELD_SEPARATOR)
        .update(String(env.ZTO_TOKEN || '')).update(FIELD_SEPARATOR)
        .update(String(env.ZTO_COOKIE || '')).update(FIELD_SEPARATOR)
        .update(config.phonePaths.join(',') + config.codPaths.join(',') + config.dodPaths.join(','))
        .digest('base64url')
        .slice(0, 22);

    return config;
}

function applyAuthentication(headers, env) {
    if (env.ZTO_AUTHORIZATION) {
        headers.Authorization = env.ZTO_AUTHORIZATION;
        return 'authorization';
    }
    if (env.ZTO_TOKEN) {
        const tokenHeader = String(env.ZTO_TOKEN_HEADER || 'X-Access-Token').trim();
        if (!HEADER_NAME_RE.test(tokenHeader) || FORBIDDEN_FORWARD_HEADER_RE.test(tokenHeader)) {
            throw new ZtoConfigError('token-header:invalid');
        }
        headers[tokenHeader] = env.ZTO_TOKEN;
        return 'token';
    }
    if (env.ZTO_COOKIE) {
        headers.Cookie = env.ZTO_COOKIE;
        return 'cookie';
    }
    return '';
}

function buildHeaders(config, env) {
    const credential = {};
    const authKind = applyAuthentication(credential, env);
    const headers = {
        Accept: 'application/json',
        'Accept-Language': config.acceptLanguage,
        'User-Agent': config.userAgent
    };
    if (config.method === 'POST') headers['Content-Type'] = 'application/json;charset=UTF-8';
    const wantsBrowserHeaders = config.sendBrowserHeaders === null
        ? authKind === 'cookie'
        : config.sendBrowserHeaders === true;
    if (wantsBrowserHeaders) {
        headers.Origin = config.browserOrigin;
        headers.Referer = config.browserOrigin + '/';
        headers['User-Language'] = config.acceptLanguage;
    }
    Object.assign(headers, config.extraHeaders);
    Object.assign(headers, credential);
    return { headers, authKind };
}

function upstreamMessage(upstream, fallback) {
    const raw = upstream && (upstream.error || upstream.message || upstream.msg || upstream.errorMsg);
    if (typeof raw !== 'string') return fallback;
    const safe = raw.replace(CONTROL_CHAR_RE, ' ').trim().slice(0, 180);
    return safe || fallback;
}

function ztoAuthRejected(response, upstream) {
    if (response && (response.status === 401 || response.status === 403)) return true;
    const code = String(upstream && (upstream.code || upstream.errorCode) || '').toLowerCase();
    const raw = upstreamMessage(upstream, '');
    const message = raw.toLowerCase();
    if (/^(?:401|403|unauthorized|forbidden|not[_-]?login|login[_-]?required)$/.test(code)) return true;
    if (LOGIN_REDIRECT_RE.test(raw)) return true;
    return /(?:session|token|cookie|login|auth).{0,32}(?:expired|invalid|required|missing|failed)|(?:expired|invalid).{0,16}(?:session|token|cookie)|not\s+(?:logged|signed)\s+in|unauthori[sz]ed|未登录|登录失效|登录过期/.test(message);
}

function upstreamSucceeded(upstream) {
    if (!upstream || typeof upstream !== 'object' || Array.isArray(upstream)) return false;
    if (upstream.success === false || upstream.status === false || upstream.result === false) return false;
    if (upstream.success === true || upstream.status === true || upstream.result === true) return true;
    let raw = '';
    if (upstream.code !== undefined && upstream.code !== null) raw = upstream.code;
    else if (upstream.errorCode !== undefined && upstream.errorCode !== null) raw = upstream.errorCode;
    else if (upstream.statusCode !== undefined && upstream.statusCode !== null) raw = upstream.statusCode;
    const code = String(raw).trim().toLowerCase();
    if (!code) return true;
    return SUCCESS_CODE_RE.test(code);
}

function orderCandidates(upstream) {
    const found = [];
    function push(value) {
        if (!value || typeof value !== 'object' || found.length >= 8) return;
        if (Array.isArray(value)) {
            if (value.length) push(value[0]);
            return;
        }
        if (found.indexOf(value) === -1) found.push(value);
    }
    if (upstream && typeof upstream === 'object') {
        push(upstream.data);
        push(upstream.result);
        push(upstream.data && upstream.data.data);
        push(upstream.result && upstream.result.data);
        push(upstream.body);
        push(upstream.rows);
        push(upstream);
    }
    return found;
}

function getPath(root, pathText) {
    const parts = pathText.split('.');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
        if (!node || typeof node !== 'object') return undefined;
        node = node[parts[i]];
    }
    return node;
}

function pickText(candidates, paths) {
    for (let i = 0; i < candidates.length; i++) {
        for (let j = 0; j < paths.length; j++) {
            const raw = getPath(candidates[i], paths[j]);
            if (raw === null || raw === undefined || typeof raw === 'object' || typeof raw === 'boolean') continue;
            const text = String(raw).replace(CONTROL_CHAR_RE, '').trim();
            if (text) return text.slice(0, 64);
        }
    }
    return '';
}

function pickNumber(candidates, paths) {
    for (let i = 0; i < candidates.length; i++) {
        for (let j = 0; j < paths.length; j++) {
            const raw = getPath(candidates[i], paths[j]);
            if (raw === null || raw === undefined || raw === '' || typeof raw === 'object' || typeof raw === 'boolean') continue;
            const value = Number(raw);
            if (Number.isFinite(value)) return value;
        }
    }
    return null;
}

function extractOrder(config, upstream) {
    const candidates = orderCandidates(upstream);
    if (!candidates.length) return null;
    const phone = pickText(candidates, config.phonePaths);
    const cod = pickNumber(candidates, config.codPaths);
    const dod = pickNumber(candidates, config.dodPaths);
    if (!phone && cod === null && dod === null) return null;
    return {
        barcode: pickText(candidates, config.barcodePaths),
        phone,
        cod: cod === null ? 0 : cod,
        dod: dod === null ? 0 : dod
    };
}

function abortError() {
    const error = new Error('ZTO_UPSTREAM_TIMEOUT');
    error.name = 'AbortError';
    return error;
}

async function requestOnce(config, headers, barcode, timeoutMs) {
    const controller = new AbortController();
    let timer = null;
    const settleGuard = new Promise((_, reject) => {
        timer = setTimeout(() => {
            try { controller.abort(); } catch (_) {}
            reject(abortError());
        }, timeoutMs);
    });
    settleGuard.catch(() => {});

    async function attempt() {
        const target = new URL(config.endpoint.href);
        const init = {
            method: config.method,
            headers,
            signal: controller.signal,
            redirect: 'manual'
        };
        if (config.method === 'POST') {
            init.body = JSON.stringify(fillTemplate(config.bodyTemplate, barcode, 0));
        } else {
            target.searchParams.set(config.queryParam, barcode);
        }

        const response = await fetch(target.href, init);
        const contentType = response.headers && response.headers.get
            ? (response.headers.get('content-type') || '')
            : '';

        if (response.status === 401 || response.status === 403
            || (response.status >= 300 && response.status < 400)
            || (response.ok && /^text\/html\b/i.test(contentType))) {
            return { kind: 'authRejected' };
        }
        if (response.status === 429) {
            return {
                kind: 'fatal',
                response: json(429, { error: 'ZTO rate limit reached', code: 'ZTO_RATE_LIMITED' })
            };
        }
        if (response.status >= 500) {
            return {
                kind: 'transient',
                response: json(502, { error: 'ZTO HTTP ' + response.status, code: 'ZTO_UPSTREAM_UNAVAILABLE' })
            };
        }

        let upstream;
        try {
            upstream = await response.json();
        } catch (_) {
            return {
                kind: 'fatal',
                response: json(502, {
                    error: 'ZTO returned non-JSON (HTTP ' + response.status + ', ' + (contentType || 'unknown').split(';')[0] + ')',
                    code: 'ZTO_INVALID_RESPONSE'
                })
            };
        }

        if (ztoAuthRejected(response, upstream)) return { kind: 'authRejected' };
        if (!response.ok || !upstreamSucceeded(upstream)) {
            return {
                kind: 'fatal',
                response: json(502, {
                    error: upstreamMessage(upstream, 'ZTO HTTP ' + response.status),
                    code: 'ZTO_UPSTREAM_REJECTED'
                })
            };
        }

        const order = extractOrder(config, upstream);
        if (!order) return { kind: 'notFound' };
        return {
            kind: 'ok',
            body: {
                success: true,
                found: true,
                barcode: order.barcode || barcode,
                phone: order.phone,
                cod: order.cod,
                dod: order.dod
            }
        };
    }

    const work = attempt();
    work.catch(() => {});
    try {
        return await Promise.race([work, settleGuard]);
    } catch (error) {
        if (error && error.name === 'AbortError') {
            return {
                kind: 'transient',
                response: json(504, { error: 'ZTO request timed out', code: 'ZTO_TIMEOUT' })
            };
        }
        return {
            kind: 'transient',
            response: json(502, { error: 'Unable to reach ZTO', code: 'ZTO_UNAVAILABLE' })
        };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function fetchOrder(config, headers, barcode, deadlineAt) {
    let attempt = 0;
    let lastTransient = null;
    for (;;) {
        const remaining = deadlineAt - Date.now();
        if (remaining <= 1200) {
            return lastTransient || {
                kind: 'fatal',
                response: json(504, { error: 'ZTO request timed out', code: 'ZTO_TIMEOUT' })
            };
        }
        const timeoutMs = Math.max(1000, Math.min(config.upstreamTimeoutMs, remaining - 200));
        const outcome = await requestOnce(config, headers, barcode, timeoutMs);
        if (outcome.kind !== 'transient') return outcome;
        lastTransient = { kind: 'fatal', response: outcome.response };
        attempt += 1;
        if (attempt > config.retries) return lastTransient;
        const backoffMs = 250 * attempt;
        if (deadlineAt - Date.now() <= backoffMs + 1500) return lastTransient;
        await delay(backoffMs);
    }
}

function storeCachedBody(key, body) {
    resultCache.delete(key);
    resultCache.set(key, { at: Date.now(), body });
    while (resultCache.size > CACHE_MAX) {
        resultCache.delete(resultCache.keys().next().value);
    }
}

function readCachedBody(key, ttlMs) {
    if (ttlMs <= 0) return null;
    const hit = resultCache.get(key);
    if (!hit) return null;
    if (elapsedSince(hit.at) >= ttlMs) {
        resultCache.delete(key);
        return null;
    }
    return hit.body;
}

function runSharedLookup(key, config, headers, barcode) {
    const existing = inFlight.get(key);
    if (existing) return existing;
    const run = fetchOrder(config, headers, barcode, Date.now() + config.budgetMs);
    inFlight.set(key, run);
    run.then(() => {}, () => {}).then(() => {
        if (inFlight.get(key) === run) inFlight.delete(key);
    });
    return run;
}

function configErrorResponse(error) {
    const body = { error: 'ZTO proxy configuration is invalid', code: 'ZTO_CONFIG_INVALID' };
    const reason = error instanceof ZtoConfigError ? error.reason : '';
    if (reason && SAFE_REASON_RE.test(reason)) body.reason = reason;
    return json(503, body);
}

function diagnosticsBody(config, headers, authKind) {
    return {
        ok: true,
        code: 'ZTO_DIAG',
        auth: authKind || 'none',
        endpoint: {
            host: config.endpoint.hostname,
            path: config.endpoint.pathname,
            method: config.method
        },
        requestHeaders: Object.keys(headers).sort(),
        browserHeaders: Object.prototype.hasOwnProperty.call(headers, 'Origin'),
        fields: {
            phone: config.phonePaths.slice(0, 4),
            cod: config.codPaths.slice(0, 4),
            dod: config.dodPaths.slice(0, 4),
            barcode: config.barcodePaths.slice(0, 4)
        },
        timing: {
            upstreamTimeoutMs: config.upstreamTimeoutMs,
            budgetMs: config.budgetMs,
            retries: config.retries,
            cacheTtlMs: config.cacheTtlMs
        },
        cacheEntries: resultCache.size
    };
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
        return json(503, { error: 'ZTO proxy is not configured', code: 'ZTO_PROXY_NOT_CONFIGURED' });
    }
    if (!timingSafeEqualText(proxyKey, suppliedKey)) {
        return json(401, { error: 'Invalid proxy key' });
    }

    let config;
    let headers;
    let authKind;
    try {
        config = readConfig(process.env);
        const built = buildHeaders(config, process.env);
        headers = built.headers;
        authKind = built.authKind;
    } catch (error) {
        return configErrorResponse(error);
    }

    const query = event.queryStringParameters || {};
    if (String(query.diag || '') === '1') {
        return json(200, diagnosticsBody(config, headers, authKind));
    }

    if (!authKind) {
        return json(503, {
            error: 'ZTO authentication is not configured',
            code: 'ZTO_AUTH_NOT_CONFIGURED'
        });
    }

    const barcode = String(query.barcode || '').trim();
    if (!BARCODE_RE.test(barcode)) {
        return json(400, { error: 'Invalid barcode', code: 'ZTO_BARCODE_INVALID' });
    }

    const cacheKey = config.fingerprint + '|' + barcode.toUpperCase();
    const cached = readCachedBody(cacheKey, config.cacheTtlMs);
    if (cached) return json(200, Object.assign({}, cached, { cached: true }));

    let outcome;
    try {
        outcome = await runSharedLookup(cacheKey, config, headers, barcode);
    } catch (_) {
        return json(502, { error: 'Unable to reach ZTO', code: 'ZTO_UNAVAILABLE' });
    }

    if (outcome.kind === 'ok') {
        if (config.cacheTtlMs > 0) storeCachedBody(cacheKey, outcome.body);
        return json(200, Object.assign({}, outcome.body, { cached: false }));
    }
    if (outcome.kind === 'notFound') {
        return json(200, { success: false, found: false, barcode, code: 'ZTO_NOT_FOUND' });
    }
    if (outcome.kind === 'authRejected') {
        return json(401, { error: 'ZTO session or token expired', code: 'ZTO_AUTH_EXPIRED' });
    }
    return outcome.response;
};

exports.resetCachesForTests = function resetCachesForTests() {
    resultCache.clear();
    inFlight.clear();
};
