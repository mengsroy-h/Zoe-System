'use strict';

const crypto = require('crypto');

const NETLIFY_API_BASE = 'https://api.netlify.com/api/v1';
const DEFAULT_TARGET_KEY = 'ZTO_COOKIE';
const TARGET_KEY_RE = /^[A-Z][A-Z0-9_]{2,63}$/;
const ACCOUNT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/;
const SITE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,63}$/;

const COOKIE_NAME_RE = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]{1,128}$/;
const COOKIE_VALUE_RE = /^[\x21-\x3a\x3c-\x7e]{0,4096}$/;

const COOKIE_MIN_LENGTH = 8;
const COOKIE_MAX_LENGTH = 8192;
const BODY_MAX_LENGTH = 16384;
const COOKIE_MAX_PAIRS = 64;

const ALLOWED_ORIGINS = [
    'https://argus.ztoglobal.com',
    'https://aargus-api.ztoglobal.com'
];

function elapsedSince(mark) {
    if (!mark) return Infinity;
    const delta = Date.now() - mark;
    return delta < 0 ? Infinity : delta;
}

function boundedInteger(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function corsHeaders(origin) {
    const headers = { Vary: 'Origin' };
    if (origin && ALLOWED_ORIGINS.indexOf(origin) !== -1) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type';
        headers['Access-Control-Max-Age'] = '600';
    }
    return headers;
}

function json(statusCode, body, origin) {
    return {
        statusCode,
        headers: Object.assign({
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'no-referrer'
        }, corsHeaders(origin)),
        body: JSON.stringify(body)
    };
}

function timingSafeEqualText(left, right) {
    const a = Buffer.from(String(left || ''));
    const b = Buffer.from(String(right || ''));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function requestOrigin(event) {
    const headers = (event && event.headers) || {};
    return String(headers.origin || headers.Origin || '').trim();
}

function readBodyText(event) {
    const raw = (event && event.body) || '';
    if (!raw) return '';
    if (event.isBase64Encoded) {
        try { return Buffer.from(raw, 'base64').toString('utf8'); } catch (_) { return ''; }
    }
    return String(raw);
}

function validateCookie(raw) {
    const text = String(raw || '').trim();
    if (!text) return { error: 'cookie:empty' };
    if (text.length < COOKIE_MIN_LENGTH) return { error: 'cookie:too-short' };
    if (text.length > COOKIE_MAX_LENGTH) return { error: 'cookie:too-long' };
    if (/[\r\n\x00]/.test(text)) return { error: 'cookie:control-char' };

    const parts = text.split(';').map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return { error: 'cookie:no-pairs' };
    if (parts.length > COOKIE_MAX_PAIRS) return { error: 'cookie:too-many-pairs' };

    const names = [];
    for (let i = 0; i < parts.length; i++) {
        const eq = parts[i].indexOf('=');
        if (eq < 1) return { error: 'cookie:pair-shape' };
        const name = parts[i].slice(0, eq);
        const value = parts[i].slice(eq + 1);
        if (!COOKIE_NAME_RE.test(name)) return { error: 'cookie:name-shape' };
        if (!COOKIE_VALUE_RE.test(value)) return { error: 'cookie:value-shape' };
        names.push(name);
    }
    return { cookie: parts.join('; '), names };
}

function readNetlifyConfig(env) {
    const token = String(env.NETLIFY_AUTH_TOKEN || '').trim();
    const accountId = String(env.NETLIFY_ACCOUNT_ID || '').trim();
    const siteId = String(env.NETLIFY_SITE_ID || '').trim();
    const targetKey = String(env.ZTO_COOKIE_TARGET_KEY || DEFAULT_TARGET_KEY).trim();

    if (!token) return { error: 'netlify:missing-token' };
    if (!ACCOUNT_ID_RE.test(accountId)) return { error: 'netlify:account-id' };
    if (!SITE_ID_RE.test(siteId)) return { error: 'netlify:site-id' };
    if (!TARGET_KEY_RE.test(targetKey)) return { error: 'netlify:target-key' };

    return {
        token,
        accountId,
        siteId,
        targetKey,
        timeoutMs: boundedInteger(env.ZTO_COOKIE_API_TIMEOUT_MS, 10000, 2000, 20000),
        budgetMs: boundedInteger(env.ZTO_COOKIE_BUDGET_MS, 22000, 6000, 26000),
        triggerDeploy: String(env.ZTO_COOKIE_TRIGGER_DEPLOY || '') !== '0'
    };
}

async function timedFetch(url, init, timeoutMs) {
    const controller = new AbortController();
    let timer = null;
    const guard = new Promise((_, reject) => {
        timer = setTimeout(() => {
            try { controller.abort(); } catch (_) {}
            const error = new Error('NETLIFY_API_TIMEOUT');
            error.name = 'AbortError';
            reject(error);
        }, timeoutMs);
    });
    guard.catch(() => {});
    try {
        return await Promise.race([
            fetch(url, Object.assign({}, init, { signal: controller.signal })),
            guard
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function setEnvVarValue(config, cookie) {
    const url = NETLIFY_API_BASE
        + '/accounts/' + encodeURIComponent(config.accountId)
        + '/env/' + encodeURIComponent(config.targetKey)
        + '?site_id=' + encodeURIComponent(config.siteId);
    return timedFetch(url, {
        method: 'PATCH',
        headers: {
            Authorization: 'Bearer ' + config.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ context: 'all', value: cookie })
    }, config.timeoutMs);
}

async function triggerSiteBuild(config) {
    const url = NETLIFY_API_BASE + '/sites/' + encodeURIComponent(config.siteId) + '/builds';
    return timedFetch(url, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + config.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clear_cache: false })
    }, config.timeoutMs);
}

exports.handler = async function handler(event) {
    const origin = requestOrigin(event);

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: Object.assign({ Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' }, corsHeaders(origin)),
            body: ''
        };
    }
    if (event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed', code: 'ZTO_COOKIE_METHOD' }, origin);
    }

    const updateKey = process.env.ZTO_COOKIE_UPDATE_KEY || '';
    if (!updateKey) {
        return json(503, {
            error: 'Cookie updater is not configured',
            code: 'ZTO_COOKIE_NOT_CONFIGURED'
        }, origin);
    }

    const bodyText = readBodyText(event);
    if (bodyText.length > BODY_MAX_LENGTH) {
        return json(413, { error: 'Body too large', code: 'ZTO_COOKIE_BODY_TOO_LARGE' }, origin);
    }

    let payload;
    try {
        payload = JSON.parse(bodyText || '{}');
    } catch (_) {
        return json(400, { error: 'Body must be JSON', code: 'ZTO_COOKIE_BODY_INVALID' }, origin);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return json(400, { error: 'Body must be a JSON object', code: 'ZTO_COOKIE_BODY_INVALID' }, origin);
    }

    if (!timingSafeEqualText(updateKey, String(payload.key || ''))) {
        return json(401, { error: 'Invalid update key', code: 'ZTO_COOKIE_KEY_INVALID' }, origin);
    }

    const checked = validateCookie(payload.cookie);
    if (checked.error) {
        return json(400, {
            error: 'Cookie value rejected',
            code: 'ZTO_COOKIE_REJECTED',
            reason: checked.error
        }, origin);
    }

    const config = readNetlifyConfig(process.env);
    if (config.error) {
        return json(503, {
            error: 'Netlify API is not configured',
            code: 'ZTO_COOKIE_NOT_CONFIGURED',
            reason: config.error
        }, origin);
    }

    const startedAt = Date.now();

    let envResponse;
    try {
        envResponse = await setEnvVarValue(config, checked.cookie);
    } catch (error) {
        const stalled = error && error.name === 'AbortError';
        return json(504, {
            error: stalled ? 'Netlify API timed out' : 'Unable to reach the Netlify API',
            code: stalled ? 'ZTO_COOKIE_API_TIMEOUT' : 'ZTO_COOKIE_API_UNREACHABLE'
        }, origin);
    }

    if (!envResponse || !envResponse.ok) {
        const status = (envResponse && envResponse.status) || 0;
        return json(status === 401 || status === 403 ? 401 : 502, {
            error: 'Netlify rejected the environment variable update (HTTP ' + status + ')',
            code: 'ZTO_COOKIE_ENV_REJECTED',
            status
        }, origin);
    }

    const result = {
        ok: true,
        code: 'ZTO_COOKIE_UPDATED',
        key: config.targetKey,
        cookieNames: checked.names,
        pairs: checked.names.length,
        deployTriggered: false
    };

    if (!config.triggerDeploy) {
        result.note = 'Deploy trigger disabled (ZTO_COOKIE_TRIGGER_DEPLOY=0)';
        return json(200, result, origin);
    }

    if (elapsedSince(startedAt) >= config.budgetMs - config.timeoutMs) {
        result.note = 'Environment variable updated, but no time left to trigger a deploy';
        return json(200, result, origin);
    }

    let buildResponse;
    try {
        buildResponse = await triggerSiteBuild(config);
    } catch (error) {
        const stalled = error && error.name === 'AbortError';
        return json(502, {
            error: 'Cookie saved, but the deploy could not be triggered - trigger it in Netlify',
            code: stalled ? 'ZTO_COOKIE_DEPLOY_TIMEOUT' : 'ZTO_COOKIE_DEPLOY_UNREACHABLE',
            envUpdated: true,
            key: config.targetKey
        }, origin);
    }

    if (!buildResponse || !buildResponse.ok) {
        return json(502, {
            error: 'Cookie saved, but Netlify refused the deploy - trigger it manually',
            code: 'ZTO_COOKIE_DEPLOY_REJECTED',
            envUpdated: true,
            key: config.targetKey,
            status: (buildResponse && buildResponse.status) || 0
        }, origin);
    }

    result.deployTriggered = true;
    return json(200, result, origin);
};

exports.internalsForTests = {
    validateCookie,
    readNetlifyConfig,
    ALLOWED_ORIGINS
};
