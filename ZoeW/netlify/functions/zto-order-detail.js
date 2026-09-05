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
// សាលក្រម «រកមិនឃើញ» មានអាយុខ្លីជាងលទ្ធផលពិតដោយចេតនា ៖ កញ្ចប់ដែល ZTO
// មិនទាន់បញ្ចូល អាចលេចឡើងក្នុងប៉ុន្មាននាទីក្រោយ Arrival Scan ➜ TTL វែង
// នឹងក្លាយជាការបដិសេធដែលកុហក។ ១៥ វិ. គ្រប់គ្រាន់ដើម្បីលេបការស្កេនម្តងទៀត
// របស់អ្នកប្រើ ដោយមិនបាំងការត្រួតពិនិត្យឡើងវិញដែលស្មោះត្រង់។
const NOT_FOUND_CACHE_TTL_DEFAULT_MS = 15000;
const resultCache = new Map();
const inFlight = new Map();

const COOKIE_NAME_RE = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]{1,128}$/;
const COOKIE_VALUE_RE = /^[\u0021-\u003a\u003c-\u007e]*$/;
const CONTROL_CHAR_TEST_RE = /[\u0000-\u001f\u007f]/;
const COOKIE_MAX_LENGTH = 8192;
const COOKIE_MAX_PAIRS = 64;
const SESSION_COOKIE_NAME = 'BOS-MAN-SESSION';
const COOKIE_STORE_NAME = 'zto-auth';
const COOKIE_STORE_KEY = 'cookie';
const COOKIE_CACHE_TTL_MS = 60000;
const COOKIE_STORE_TIMEOUT_MS = 3000;
const COOKIE_RENEW_MIN_GAP_MS = 60000;
const COOKIE_RENEW_WRITE_TIMEOUT_MS = 900;
const COOKIE_BUDGET_RESERVE_MS = 1200;
const COOKIE_READ_MIN_TIMEOUT_MS = 300;
const COOKIE_WRITE_MIN_TIMEOUT_MS = 200;
const COOKIE_REFRESH_RETRY_RESERVE_MS = 2500;

const upstreamCookieSignal = { seenAt: 0, setCookie: false, names: [] };
const cookieState = {
    value: '', source: '', at: 0, storeReason: '', renewAt: 0, renewals: 0, authRejectedAt: 0,
    mustRevalidate: false
};
let cookieRefreshInFlight = false;
let blobsModuleForTests = null;

function setCookieLines(response) {
    const headers = response && response.headers;
    if (!headers) return [];
    if (typeof headers.getSetCookie === 'function') return headers.getSetCookie() || [];
    if (typeof headers.get === 'function') {
        const single = headers.get('set-cookie');
        if (single) return [single];
    }
    return [];
}

function parseCookieHeader(raw) {
    const text = String(raw || '').trim();
    if (!text || text.length > COOKIE_MAX_LENGTH) return null;
    if (CONTROL_CHAR_TEST_RE.test(text)) return null;
    const parts = text.split(';');
    const pairs = [];
    for (let i = 0; i < parts.length; i++) {
        const pair = parts[i].trim();
        if (!pair) continue;
        if (pairs.length >= COOKIE_MAX_PAIRS) break;
        const at = pair.indexOf('=');
        if (at < 1) continue;
        const name = pair.slice(0, at).trim();
        const value = pair.slice(at + 1);
        if (!COOKIE_NAME_RE.test(name) || !COOKIE_VALUE_RE.test(value)) continue;
        pairs.push({ name: name, value: value });
    }
    return pairs.length ? pairs : null;
}

function serializeCookiePairs(pairs) {
    return pairs.map((pair) => pair.name + '=' + pair.value).join('; ');
}

function hasSessionCookie(pairs) {
    return pairs.some((pair) => pair.name === SESSION_COOKIE_NAME && pair.value.length >= 8);
}

function sanitizeStoredCookie(raw) {
    const pairs = parseCookieHeader(raw);
    if (!pairs || !hasSessionCookie(pairs)) return '';
    return serializeCookiePairs(pairs);
}

function sanitizeEnvCookie(raw) {
    const text = String(raw || '').trim();
    if (!text || text.length > COOKIE_MAX_LENGTH) return '';
    if (CONTROL_CHAR_TEST_RE.test(text)) return '';
    return text;
}

function mergeRenewedCookie(current, lines) {
    const base = parseCookieHeader(current);
    if (!base) return '';
    const order = [];
    const byName = new Map();
    base.forEach((pair) => {
        if (!byName.has(pair.name)) order.push(pair.name);
        byName.set(pair.name, pair.value);
    });
    let changed = false;
    for (let i = 0; i < lines.length; i++) {
        const head = String(lines[i]).split(';')[0];
        const at = head.indexOf('=');
        if (at < 1) continue;
        const name = head.slice(0, at).trim();
        const value = head.slice(at + 1).trim();
        if (!value || !COOKIE_NAME_RE.test(name) || !COOKIE_VALUE_RE.test(value)) continue;
        if (byName.get(name) === value) continue;
        if (!byName.has(name)) order.push(name);
        byName.set(name, value);
        changed = true;
    }
    if (!changed) return '';
    const merged = order.slice(0, COOKIE_MAX_PAIRS)
        .map((name) => ({ name: name, value: byName.get(name) }));
    if (!hasSessionCookie(merged)) return '';
    const text = serializeCookiePairs(merged);
    return text.length > COOKIE_MAX_LENGTH ? '' : text;
}

function cookieFingerprint(cookie) {
    if (!cookie) return '';
    return crypto.createHash('sha256').update(cookie).digest('hex').slice(0, 8);
}

function loadBlobsModule() {
    if (blobsModuleForTests) return blobsModuleForTests;
    return require('@netlify/blobs');
}

function openCookieStore(netlifyEvent) {
    if (!netlifyEvent || typeof netlifyEvent.blobs !== 'string' || !netlifyEvent.blobs) {
        return { store: null, reason: 'no-context' };
    }
    let blobs;
    try {
        blobs = loadBlobsModule();
    } catch (_) {
        return { store: null, reason: 'import' };
    }
    if (!blobs || typeof blobs.connectLambda !== 'function' || typeof blobs.getStore !== 'function') {
        return { store: null, reason: 'export' };
    }
    try {
        blobs.connectLambda(netlifyEvent);
    } catch (_) {
        return { store: null, reason: 'connect' };
    }
    try {
        return { store: blobs.getStore(COOKIE_STORE_NAME), reason: '' };
    } catch (_) {
        return { store: null, reason: 'getstore' };
    }
}

function settleWithin(run, timeoutMs, label) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        };
        const timer = setTimeout(() => finish({ ok: false, reason: label + ':timeout' }), timeoutMs);
        let pending;
        try {
            pending = run();
        } catch (_) {
            finish({ ok: false, reason: label + ':throw' });
            return;
        }
        Promise.resolve(pending).then(
            (value) => finish({ ok: true, value: value }),
            (error) => {
                const name = error && typeof error.name === 'string' && /^[A-Za-z]{1,40}$/.test(error.name)
                    ? error.name
                    : 'error';
                finish({ ok: false, reason: label + ':' + name });
            }
        );
    });
}

// ⛔ **Blobs មិនត្រូវជាចំណុចដាច់តែមួយ — ទាំងភាពអាចប្រើបាន ទាំងល្បឿន។**
// ក្រោយ TTL ៦០ វិនាទី ការអានចាស់ឈរ **លើផ្លូវឆ្លើយតប** ➜ រាល់ការស្កេនរង់ចាំ
// Netlify Blobs មុនហៅ ZTO ទោះបីជា Cookie ដដែលនៅក្នុងសតិក៏ដោយ។ ដូច្នេះពេលមាន
// តម្លៃក្នុងសតិរួច ៖ ឆ្លើយភ្លាម រួចធ្វើឲ្យស្រស់ **ខាងក្រោយ**។ ⛔ ក្រោយ 401
// (`invalidateCookieCache()`) ការអានត្រូវ **ទប់** វិញ — ទីនោះជាកន្លែងដែល
// ការអានតម្លៃថ្មីពិតជាចាំបាច់មុនហៅ upstream។
function refreshCookieInBackground(store) {
    if (cookieRefreshInFlight || !store) return;
    cookieRefreshInFlight = true;
    // ⛔ Netlify អាច **បង្កក** container ភ្លាមក្រោយការឆ្លើយតប ➜ ការអាននេះអាច
    // ដោះវិញយូរក្រោយមក ដោយកាន់ទិដ្ឋភាព **ចាស់**។ ខណៈនោះ Argus អាចបានប្តូរ
    // session ហើយ (`adoptRenewedCookie`) ➜ ការសរសេរជាន់ដោយទិដ្ឋភាពចាស់នឹង
    // បង្កើត 401 ដែលយើងទើបជៀសផុត។ ដូច្នេះអនុវត្តតែពេលសតិ **មិនប្រែ**។
    const seen = cookieState.value;
    settleWithin(
        () => store.get(COOKIE_STORE_KEY, { type: 'text' }),
        COOKIE_STORE_TIMEOUT_MS,
        'read'
    ).then((read) => {
        if (!read.ok) {
            cookieState.storeReason = read.reason;
            return;
        }
        const stored = sanitizeStoredCookie(read.value);
        if (!stored) {
            cookieState.storeReason = read.value ? 'invalid' : 'empty';
            return;
        }
        if (cookieState.value !== seen) return;
        cookieState.value = stored;
        cookieState.source = 'blob';
        cookieState.at = Date.now();
        cookieState.storeReason = '';
    }, () => {}).then(() => {
        cookieRefreshInFlight = false;
    }, () => {
        cookieRefreshInFlight = false;
    });
}

async function resolveCookieCredential(netlifyEvent, env, options) {
    if (env.ZTO_AUTHORIZATION || env.ZTO_TOKEN) {
        return { cookie: '', source: '', store: null, renewal: '' };
    }
    const skipCache = !!(options && options.fresh);
    const readTimeoutMs = (options && options.timeoutMs !== undefined)
        ? options.timeoutMs
        : COOKIE_STORE_TIMEOUT_MS;
    const opened = openCookieStore(netlifyEvent);
    // ⛔ មូលហេតុត្រូវរស់រានពី cache ។ ការសរសេរ `storeReason = opened.reason`
    // (ជា `''` ពេល store បើកបាន) មុនការពិនិត្យ cache លុបមូលហេតុនៃការអាន
    // ដែលធ្លាក់ ៖ វាស់បានលើ Windows ពិត (2026-09-02) — helper សួរ
    // `?diag=1` ១៤ ដង ហើយមើលឃើញ `source: env` ដោយ **គ្មានមូលហេតុ**។
    if (opened.reason) cookieState.storeReason = opened.reason;
    if (!skipCache && cookieState.value && elapsedSince(cookieState.at) < COOKIE_CACHE_TTL_MS) {
        return { cookie: cookieState.value, source: cookieState.source, store: opened.store, renewal: '' };
    }
    const blocking = !!(options && options.blocking);
    if (!skipCache && !blocking && !cookieState.mustRevalidate && cookieState.value && opened.store && readTimeoutMs > 0) {
        refreshCookieInBackground(opened.store);
        return { cookie: cookieState.value, source: cookieState.source, store: opened.store, renewal: '' };
    }
    if (opened.store && readTimeoutMs > 0) {
        const read = await settleWithin(
            () => opened.store.get(COOKIE_STORE_KEY, { type: 'text' }),
            readTimeoutMs,
            'read'
        );
        if (read.ok) {
            const stored = sanitizeStoredCookie(read.value);
            if (stored) {
                cookieState.value = stored;
                cookieState.source = 'blob';
                cookieState.at = Date.now();
                cookieState.storeReason = '';
                cookieState.mustRevalidate = false;
                return { cookie: stored, source: 'blob', store: opened.store, renewal: '' };
            }
            cookieState.storeReason = read.value ? 'invalid' : 'empty';
        } else {
            cookieState.storeReason = read.reason;
        }
    }
    if (opened.store && !(readTimeoutMs > 0)) cookieState.storeReason = 'budget';
    const envCookie = sanitizeEnvCookie(env.ZTO_COOKIE);
    cookieState.value = envCookie;
    cookieState.source = envCookie ? 'env' : '';
    cookieState.at = envCookie ? Date.now() : 0;
    cookieState.mustRevalidate = false;
    return { cookie: envCookie, source: cookieState.source, store: opened.store, renewal: '' };
}

function invalidateCookieCache() {
    cookieState.at = 0;
    cookieState.mustRevalidate = true;
}

function noteCookieRejected() {
    cookieState.authRejectedAt = Date.now();
}

function noteCookieAccepted() {
    cookieState.authRejectedAt = 0;
}

function noteCookieRenewal(session, response) {
    if (!session || !session.store || !session.cookie) return;
    const lines = setCookieLines(response);
    if (!lines.length) return;
    const merged = mergeRenewedCookie(session.cookie, lines);
    if (!merged || merged === session.cookie) return;
    session.renewal = merged;
}

// ⛔ ពិដានល្បឿន និងថវិកាពេល ការពារ **ការសរសេរទៅ Blobs** — មិនមែនការចងចាំទេ។
// Argus ទើបប្រគល់ session ថ្មីមកឲ្យយើងក្នុងសំណើនេះ ៖ ការបោះវាចោលទាំងស្រុង
// ធ្វើឲ្យសំណើបន្ទាប់នៃ instance ដដែលផ្ញើ Cookie **ចាស់** ➜ 401 ដែលអាចជៀសបាន
// ➜ អាន store ឡើងវិញ បូកការសាកម្តងទៀត (ថ្លៃមួយជុំពេញនៃថវិកា)។ ដូច្នេះការ
// ចងចាំកើតឡើង **ជានិច្ច** ចំណែកការសរសេរនៅតែស្ថិតក្រោមពិដានដដែល។
function adoptRenewedCookie(session, merged) {
    if (!merged) return;
    session.cookie = merged;
    if (cookieState.value === merged) return;
    cookieState.value = merged;
}

async function flushCookieRenewal(session, timeoutMs) {
    if (!session || !session.store || !session.renewal) return;
    const budgetedMs = timeoutMs === undefined ? COOKIE_RENEW_WRITE_TIMEOUT_MS : timeoutMs;
    const merged = session.renewal;
    session.renewal = '';
    adoptRenewedCookie(session, merged);
    if (!(budgetedMs > 0)) return;
    if (elapsedSince(cookieState.renewAt) < COOKIE_RENEW_MIN_GAP_MS) return;
    cookieState.renewAt = Date.now();
    const write = await settleWithin(
        () => session.store.set(COOKIE_STORE_KEY, merged),
        budgetedMs,
        'write'
    );
    if (!write.ok) {
        cookieState.storeReason = write.reason;
        return;
    }
    cookieState.source = 'blob';
    cookieState.at = Date.now();
    cookieState.storeReason = '';
    cookieState.renewals += 1;
}

function noteUpstreamSetCookie(response) {
    try {
        const lines = setCookieLines(response);
        upstreamCookieSignal.seenAt = Date.now();
        upstreamCookieSignal.setCookie = lines.length > 0;
        upstreamCookieSignal.names = lines
            .map((line) => String(line).split('=')[0].trim())
            .filter((name) => COOKIE_NAME_RE.test(name))
            .slice(0, 12);
    } catch (_) {}
}

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
        upstreamTimeoutMs: boundedInteger(env.ZTO_UPSTREAM_TIMEOUT_MS, 6000, 2000, 20000),
        budgetMs: boundedInteger(env.ZTO_REQUEST_BUDGET_MS, 9000, 4000, 24000),
        retries: boundedInteger(env.ZTO_UPSTREAM_RETRIES, 1, 0, 3),
        cacheTtlMs: boundedInteger(env.ZTO_CACHE_TTL_MS, 60000, 0, 600000)
    };

    // ⛔ TTL អវិជ្ជមានត្រូវ **មិនលើស** cache សរុប ➜ `ZTO_CACHE_TTL_MS=0`
    // បិទទាំង ២ ផ្លូវក្នុងកន្លែងតែមួយ។
    config.notFoundCacheTtlMs = Math.min(
        boundedInteger(env.ZTO_NOT_FOUND_CACHE_TTL_MS, NOT_FOUND_CACHE_TTL_DEFAULT_MS, 0, 120000),
        config.cacheTtlMs);

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

function applyAuthentication(headers, env, cookie) {
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
    const effectiveCookie = cookie || sanitizeEnvCookie(env.ZTO_COOKIE);
    if (effectiveCookie) {
        headers.Cookie = effectiveCookie;
        return 'cookie';
    }
    return '';
}

function buildHeaders(config, env, cookie) {
    const credential = {};
    const authKind = applyAuthentication(credential, env, cookie);
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

async function requestOnce(config, headers, barcode, timeoutMs, session) {
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
        noteUpstreamSetCookie(response);
        noteCookieRenewal(session, response);
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

async function fetchOrder(config, headers, barcode, startedAt, session) {
    let attempt = 0;
    let lastTransient = null;
    for (;;) {
        const remaining = config.budgetMs - elapsedSince(startedAt);
        if (remaining <= 1200) {
            return lastTransient || {
                kind: 'fatal',
                response: json(504, { error: 'ZTO request timed out', code: 'ZTO_TIMEOUT' })
            };
        }
        const timeoutMs = Math.max(1000, Math.min(config.upstreamTimeoutMs, remaining - 200));
        const outcome = await requestOnce(config, headers, barcode, timeoutMs, session);
        if (outcome.kind !== 'transient') return outcome;
        lastTransient = { kind: 'fatal', response: outcome.response };
        attempt += 1;
        if (attempt > config.retries) return lastTransient;
        const backoffMs = 250 * attempt;
        if (config.budgetMs - elapsedSince(startedAt) <= backoffMs + 1500) return lastTransient;
        await delay(backoffMs);
    }
}

function budgetLeftMs(config, startedAt) {
    return config.budgetMs - elapsedSince(startedAt);
}

function cookieReadTimeoutMs(config, startedAt) {
    const room = budgetLeftMs(config, startedAt) - COOKIE_BUDGET_RESERVE_MS - config.upstreamTimeoutMs;
    if (room < COOKIE_READ_MIN_TIMEOUT_MS) return 0;
    return Math.min(COOKIE_STORE_TIMEOUT_MS, room);
}

function cookieRenewTimeoutMs(config, startedAt) {
    const room = budgetLeftMs(config, startedAt) - COOKIE_BUDGET_RESERVE_MS;
    if (room < COOKIE_WRITE_MIN_TIMEOUT_MS) return 0;
    return Math.min(COOKIE_RENEW_WRITE_TIMEOUT_MS, room);
}

async function retryAfterAuthRejected(netlifyEvent, config, barcode, startedAt, previousCookie) {
    if (process.env.ZTO_AUTHORIZATION || process.env.ZTO_TOKEN) return null;
    if (budgetLeftMs(config, startedAt) < COOKIE_REFRESH_RETRY_RESERVE_MS) return null;
    const readMs = cookieReadTimeoutMs(config, startedAt);
    if (!(readMs > 0)) return null;
    let fresh;
    try {
        fresh = await resolveCookieCredential(netlifyEvent, process.env, { fresh: true, timeoutMs: readMs });
    } catch (_) {
        return null;
    }
    if (!fresh.cookie || fresh.cookie === previousCookie) {
        // ⛔ ការអានឡើងវិញ **ចាក់ cache ៦០ វិ. សាជាថ្មី** ជាផលរំខាន។ បើ
        // Cookie មិនប្រែ នោះវាពិតជាផុតកំណត់ ➜ ត្រូវលុប cache ម្តងទៀត
        // បើមិនដូច្នេះ Cookie ថ្មីដែល helper សរសេរក្រោយមក ត្រូវរង់ចាំ ៦០ វិ.
        invalidateCookieCache();
        return null;
    }
    let built;
    try {
        built = buildHeaders(config, process.env, fresh.cookie);
    } catch (_) {
        return null;
    }
    if (!built.authKind) return null;
    const flightKey = config.fingerprint + '|' + (cookieFingerprint(fresh.cookie) || '-') + '|' + barcode.toUpperCase();
    let outcome;
    try {
        outcome = await runSharedLookup(flightKey, config, built.headers, barcode, fresh, startedAt);
    } catch (_) {
        return null;
    }
    return { outcome: outcome, session: fresh };
}

function storeCachedBody(key, body, negative) {
    resultCache.delete(key);
    resultCache.set(key, { at: Date.now(), body, negative: !!negative });
    while (resultCache.size > CACHE_MAX) {
        resultCache.delete(resultCache.keys().next().value);
    }
}

// ⛔ សាលក្រម ២ ប្រភេទចែក cache តែមួយ តែ **អាយុខុសគ្នា** ៖ លទ្ធផលពិត
// រស់តាម `ttlMs`; «រកមិនឃើញ» រស់តាម `negativeTtlMs` ដែលខ្លីជាង។ ការវាស់
// អាយុឆ្លងកាត់ `elapsedSince()` ➜ នាឡិកាថយក្រោយ ➜ `Infinity` ➜ ធាតុផុត
// ភ្លាម (fail-open ក្នុងទិសសុវត្ថិភាព — ច្បាប់ `monotonic-gate-test`)។
function readCachedBody(key, ttlMs, negativeTtlMs) {
    const hit = resultCache.get(key);
    if (!hit) return null;
    const limit = hit.negative ? (negativeTtlMs || 0) : ttlMs;
    if (limit <= 0) {
        resultCache.delete(key);
        return null;
    }
    if (elapsedSince(hit.at) >= limit) {
        resultCache.delete(key);
        return null;
    }
    return hit.body;
}

function runSharedLookup(key, config, headers, barcode, session, startedAt) {
    const existing = inFlight.get(key);
    if (existing) return existing;
    const run = fetchOrder(config, headers, barcode, startedAt, session);
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

// ⛔ ការត្រៀម (OPTIONS) ឈរ **ក្រៅ** ផ្លូវស្កេន ➜ វាត្រូវ **បញ្ចប់** ការអាន
// ពិត មិនមែនត្រឹមតាំងវាខាងក្រោយ។ នោះជាចំណុចទាំងមូលរបស់ការត្រៀម ៖ បង់ថ្លៃ
// ការអាន Blobs នៅទីនេះ ដើម្បីកុំឲ្យការស្កេនបង់វា។
async function prewarmCookieCredential(netlifyEvent) {
    if (cookieState.value && elapsedSince(cookieState.at) < COOKIE_CACHE_TTL_MS) return;
    try {
        await resolveCookieCredential(netlifyEvent, process.env, { blocking: true });
    } catch (_) {}
}

function diagnosticsBody(config, headers, authKind, credential) {
    return {
        ok: true,
        code: 'ZTO_DIAG',
        auth: authKind || 'none',
        cookie: {
            source: (credential && credential.source) || 'none',
            fingerprint: cookieFingerprint(credential && credential.cookie) || null,
            ageMs: cookieState.at ? elapsedSince(cookieState.at) : null,
            storeReason: cookieState.storeReason || null,
            renewals: cookieState.renewals,
            authRejectedAgeMs: cookieState.authRejectedAt
                ? elapsedSince(cookieState.authRejectedAt)
                : null
        },
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
            cacheTtlMs: config.cacheTtlMs,
            notFoundCacheTtlMs: config.notFoundCacheTtlMs
        },
        cacheEntries: resultCache.size,
        sessionRenewal: {
            observed: upstreamCookieSignal.seenAt > 0,
            setCookie: upstreamCookieSignal.setCookie,
            names: upstreamCookieSignal.names,
            ageMs: upstreamCookieSignal.seenAt ? elapsedSince(upstreamCookieSignal.seenAt) : null
        }
    };
}

exports.handler = async function handler(event) {
    const startedAt = Date.now();
    if (event.httpMethod === 'OPTIONS') {
        await prewarmCookieCredential(event);
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
    try {
        config = readConfig(process.env);
    } catch (error) {
        return configErrorResponse(error);
    }

    const query = event.queryStringParameters || {};
    const wantsDiagnostics = String(query.diag || '') === '1';
    const wantsFreshCookie = wantsDiagnostics && String(query.fresh || '') === '1';
    const barcode = String(query.barcode || '').trim();
    if (!wantsDiagnostics && !BARCODE_RE.test(barcode)) {
        return json(400, { error: 'Invalid barcode', code: 'ZTO_BARCODE_INVALID' });
    }

    // ⛔ **កូនសោ cache មិនត្រូវផ្ទុក fingerprint នៃ Cookie ទេ។** លទ្ធផលរបស់
    // barcode មួយ ជាទិន្នន័យបញ្ជាទិញ — វា **មិនអាស្រ័យលើ session ណាដែលទៅយក**។
    // ការដាក់ Cookie ចូលកូនសោធ្វើឲ្យ **រាល់ការបន្តអាយុ Cookie បោះ cache
    // ទាំងមូលចោល** ហើយបង្ខំឲ្យអានឡើងវិញពី store មុនឆ្លើយ។ ការប្តូរ config
    // (endpoint · field · method) នៅតែផ្លាស់កូនសោដដែល តាម `config.fingerprint`។
    // ផលដែលវាស់បាន ៖ ការស្កេនដដែលក្នុង TTL ឆ្លើយ **ដោយមិនប៉ះ Netlify Blobs**។
    const cacheKey = config.fingerprint + '|' + barcode.toUpperCase();
    if (!wantsDiagnostics) {
        const early = readCachedBody(cacheKey, config.cacheTtlMs, config.notFoundCacheTtlMs);
        if (early) return json(200, Object.assign({}, early, { cached: true }));
    }

    let session;
    let headers;
    let authKind;
    try {
        session = await resolveCookieCredential(event, process.env, {
            fresh: wantsFreshCookie,
            timeoutMs: wantsDiagnostics ? COOKIE_STORE_TIMEOUT_MS : cookieReadTimeoutMs(config, startedAt)
        });
        const built = buildHeaders(config, process.env, session.cookie);
        headers = built.headers;
        authKind = built.authKind;
    } catch (error) {
        return configErrorResponse(error);
    }

    if (wantsDiagnostics) {
        return json(200, Object.assign(diagnosticsBody(config, headers, authKind, session), { fresh: wantsFreshCookie }));
    }

    if (!authKind) {
        return json(503, {
            error: 'ZTO authentication is not configured',
            code: 'ZTO_AUTH_NOT_CONFIGURED'
        });
    }

    // ⛔ ការចែក run (single-flight) នៅតែត្រូវ **ដាច់តាម Cookie** — សំណើ ២
    // ដែលកាន់ session ខុសគ្នា មិនត្រូវចែកលទ្ធផលនៃការហៅដែលកំពុងដំណើរការទេ។
    const flightKey = cacheKey + '|' + (cookieFingerprint(session.cookie) || '-');

    let outcome;
    try {
        outcome = await runSharedLookup(flightKey, config, headers, barcode, session, startedAt);
    } catch (_) {
        return json(502, { error: 'Unable to reach ZTO', code: 'ZTO_UNAVAILABLE' });
    }

    if (outcome.kind === 'authRejected') {
        session.renewal = '';
        invalidateCookieCache();
        noteCookieRejected();
        // ⛔ មូលហេតុទី ១ នៃ 401 គឺ **cache សតិ ៦០ វិ. របស់ instance នេះ**
        // ដែលនៅកាន់ Cookie ចាស់ ខណៈ helper ទើបសរសេរ Cookie ថ្មីចូល Blobs។
        // ដូច្នេះអានឡើងវិញដោយ `fresh` ១ ដង ហើយសាកម្តងទៀត **តែពេល
        // fingerprint ប្រែ** — បើមិនប្រែ វាជាការផុតកំណត់ពិត ➜ ឆ្លើយ 401
        // ភ្លាមដោយគ្មានការហៅ upstream ឥតប្រយោជន៍។
        const retried = await retryAfterAuthRejected(event, config, barcode, startedAt, session.cookie);
        if (!retried) {
            return json(401, { error: 'ZTO session or token expired', code: 'ZTO_AUTH_EXPIRED' });
        }
        session = retried.session;
        outcome = retried.outcome;
        if (outcome.kind === 'authRejected') {
            session.renewal = '';
            invalidateCookieCache();
            noteCookieRejected();
            return json(401, { error: 'ZTO session or token expired', code: 'ZTO_AUTH_EXPIRED' });
        }
    }

    if (outcome.kind === 'ok' || outcome.kind === 'notFound') noteCookieAccepted();

    await flushCookieRenewal(session, cookieRenewTimeoutMs(config, startedAt));

    if (outcome.kind === 'ok') {
        if (config.cacheTtlMs > 0) storeCachedBody(cacheKey, outcome.body);
        return json(200, Object.assign({}, outcome.body, { cached: false }));
    }
    if (outcome.kind === 'notFound') {
        // ⛔ រូបរាងត្រូវនៅដដែល ៖ `found:false` **គ្មានវាល `error`** — បើដាក់
        // `error` ចូល នោះ client បោះ «Lookup rejected» ➜ cooldown ៣០ វិ.
        // (មេរៀន 2.25.0)។ ការ cache ប៉ះតែ *ចំនួនសំណើ* មិនប៉ះរូបរាងទេ។
        const notFoundBody = { success: false, found: false, barcode, code: 'ZTO_NOT_FOUND' };
        if (config.notFoundCacheTtlMs > 0) storeCachedBody(cacheKey, notFoundBody, true);
        return json(200, Object.assign({}, notFoundBody, { cached: false }));
    }
    return outcome.response;
};

exports.expireCookieCacheForTests = function expireCookieCacheForTests() {
    if (cookieState.at) cookieState.at = 1;
};

exports.resetCachesForTests = function resetCachesForTests() {
    resultCache.clear();
    inFlight.clear();
    cookieRefreshInFlight = false;
    cookieState.mustRevalidate = false;
    cookieState.value = '';
    cookieState.source = '';
    cookieState.at = 0;
    cookieState.storeReason = '';
    cookieState.renewAt = 0;
    cookieState.renewals = 0;
    cookieState.authRejectedAt = 0;
};

exports.setBlobsModuleForTests = function setBlobsModuleForTests(blobsModule) {
    blobsModuleForTests = blobsModule || null;
};
