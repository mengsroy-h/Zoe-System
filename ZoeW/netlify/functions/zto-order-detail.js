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
const SIGNED_VALUE_RE = /^[A-Za-z0-9_.:@-]{1,40}$/;
const SIGNED_PATH_MAX = 8;
const SIGNED_VALUE_MAX = 16;
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]+/g;
const SUCCESS_CODE_RE = /^(?:0+|200|success|succeed|ok|true)$/;
const LOGIN_REDIRECT_RE = /https?:\/\/[^\s"']*(?:oauth|\/login\b|\/signin\b|sso[.\/]|iam[-.])/i;

const PHONE_PATHS = ['consigneePhone', 'consigneeMobile', 'consigneeTel', 'receiverPhone', 'receiverMobile', 'recipientPhone', 'recipientMobile', 'phone', 'mobile'];
const COD_PATHS = ['agentAmount', 'codAmount', 'collectionAmount', 'codFee', 'cod'];
const DOD_PATHS = ['fcAmount', 'arrivalServiceCharge', 'dodAmount', 'arrivalCharge', 'serviceCharge', 'dod'];
const BARCODE_PATHS = ['billCode', 'waybillNo', 'waybillCode', 'mailNo', 'barcode'];

const DEFAULT_LIST_URL = 'https://aargus-api.ztoglobal.com/scan/page/scan';
const DEFAULT_LIST_SCAN_TYPE = '03';
const DEFAULT_LIST_SCAN_DESC = 'អីវ៉ាន់មកដល់';
const LIST_SCAN_DESC_PATHS = ['scanTypeDesc', 'scanTypeName', 'scanDesc'];
const LIST_SCAN_CODE_PATHS = ['scanTypeCode', 'scanType'];
const LIST_SITE_CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;
const LIST_SCAN_TYPE_RE = /^[A-Za-z0-9_-]{1,8}$/;
const LIST_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LIST_TIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;
const LIST_RANGE_MAX_DAYS = 31;
const LIST_ROW_MAX = 200;
const LIST_CACHE_TTL_MAX_MS = 60000;
const LIST_SIGNED_CACHE_TTL_MAX_MS = 15000;
const LIST_BARCODE_PATHS = ['scanBillCode'].concat(BARCODE_PATHS);
const LIST_TIME_PATHS = ['scanTime', 'scanDate', 'createTime', 'operateTime'];
const DEFAULT_LIST_SIGNED_SCAN_TYPE = '05';
const DEFAULT_LIST_SIGNED_SCAN_DESC = 'ចុះហត្ថលេខា';
const LIST_SITE_NAME_PATHS = ['scanSite', 'scanSiteName'];
const LIST_ORIGIN_PATHS = ['recSite', 'customerCodeDesc'];
const LIST_ZONE_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 86400000;

const FIELD_SEPARATOR = '|';
const CACHE_MAX = 200;
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
const COOKIE_COLD_UPSTREAM_RESERVE_MS = 1500;

const upstreamCookieSignal = { seenAt: 0, setCookie: false, names: [] };
const upstreamRejectSignal = { at: 0, status: 0, code: '', count: 0 };
const signedMismatchSignal = { at: 0, count: 0 };
const cookieState = {
    value: '', source: '', at: 0, storeReason: '', renewAt: 0, renewals: 0, authRejectedAt: 0,
    authAcceptedAt: 0,
    authIdentity: '', version: 0, storeCookie: '', storeEtag: '', storeMissing: false,
    blobSyncedAt: 0, blobRenewedAt: 0,
    renewAttemptValue: '', renewAttemptEtag: '',
    pendingRenewal: null, obsolete: new Set(), mustRevalidate: false
};
let cookieRefreshInFlight = false;
let cookieWriteInFlight = null;
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

function cookieCredentialIdentity(cookie) {
    const value = process.env.ZTO_AUTHORIZATION || process.env.ZTO_TOKEN || cookie || '';
    return value ? crypto.createHash('sha256').update(value).digest('hex') : '';
}

function sessionCookieValue(cookie) {
    const pairs = parseCookieHeader(cookie);
    const pair = pairs && pairs.find((entry) => entry.name === SESSION_COOKIE_NAME);
    return pair ? pair.value : '';
}

function currentCookieCredential(store) {
    return { cookie: cookieState.value, source: cookieState.source, store: store, renewal: '',
        version: cookieState.version, identity: cookieCredentialIdentity(cookieState.value) };
}

function cookieSessionIsCurrent(session) {
    if (!session || session.identity !== cookieCredentialIdentity(cookieState.value)) return false;
    if (process.env.ZTO_AUTHORIZATION || process.env.ZTO_TOKEN) return !session.cookie;
    return session.cookie === cookieState.value && session.version === cookieState.version;
}

function replaceCookieValue(value) {
    if (cookieState.value === value) return;
    if (cookieState.value) cookieState.obsolete.add(cookieState.value);
    while (cookieState.obsolete.size > 32) cookieState.obsolete.delete(cookieState.obsolete.values().next().value);
    cookieState.value = value;
    cookieState.version += 1;
    cookieState.authIdentity = '';
    cookieState.authRejectedAt = 0;
    cookieState.authAcceptedAt = 0;
}

const BLOB_STAMP_MIN_MS = Date.UTC(2020, 0, 1);

function blobStamp(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < BLOB_STAMP_MIN_MS || n > Date.now() + 86400000) return 0;
    return Math.floor(n);
}

function noteBlobStamps(metadata) {
    const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
    cookieState.blobSyncedAt = blobStamp(meta.syncedAt);
    cookieState.blobRenewedAt = blobStamp(meta.renewedAt);
}

function blobStampAgeMs(stamp) {
    if (!stamp) return null;
    return Math.max(0, Date.now() - stamp);
}

function adoptStoredCookie(stored, etag, version, metadata) {
    if (version !== cookieState.version) return false;
    const pending = cookieState.pendingRenewal;
    if (pending && (stored === pending.baseCookie || pending.ancestors.has(stored))) {
        if (etag) {
            pending.baseCookie = stored;
            pending.etag = etag;
            pending.missing = false;
            cookieState.storeCookie = stored;
            cookieState.storeEtag = etag;
            cookieState.storeMissing = false;
            noteBlobStamps(metadata);
        }
        return false;
    }
    if (stored !== cookieState.value && cookieState.obsolete.has(stored) && !cookieState.mustRevalidate) return false;
    replaceCookieValue(stored);
    cookieState.source = 'blob';
    cookieState.at = Date.now();
    cookieState.storeReason = '';
    cookieState.storeCookie = stored;
    cookieState.storeEtag = etag || '';
    cookieState.storeMissing = false;
    noteBlobStamps(metadata);
    cookieState.pendingRenewal = null;
    cookieState.mustRevalidate = false;
    return true;
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

function refreshCookieInBackground(store) {
    if (cookieRefreshInFlight || !store) return;
    cookieRefreshInFlight = true;
    const seen = cookieState.version;
    settleWithin(
        () => store.getWithMetadata(COOKIE_STORE_KEY, { type: 'text' }),
        COOKIE_STORE_TIMEOUT_MS,
        'read'
    ).then((read) => {
        if (!read.ok) {
            cookieState.storeReason = read.reason;
            return;
        }
        const entry = read.value;
        const stored = sanitizeStoredCookie(entry && entry.data);
        if (!stored) {
            cookieState.storeReason = entry && entry.data ? 'invalid' : 'empty';
            return;
        }
        adoptStoredCookie(stored, entry.etag, seen, entry.metadata);
    }, () => {}).then(() => {
        cookieRefreshInFlight = false;
    }, () => {
        cookieRefreshInFlight = false;
    });
}

async function resolveCookieCredential(netlifyEvent, env, options) {
    if (env.ZTO_AUTHORIZATION || env.ZTO_TOKEN) {
        return { cookie: '', source: '', store: null, renewal: '', identity: cookieCredentialIdentity('') };
    }
    const skipCache = !!(options && options.fresh);
    const readTimeoutMs = (options && options.timeoutMs !== undefined)
        ? options.timeoutMs
        : COOKIE_STORE_TIMEOUT_MS;
    let storeWitness = null;
    const opened = openCookieStore(netlifyEvent);
    if (opened.reason) cookieState.storeReason = opened.reason;
    if (!skipCache && cookieState.value && elapsedSince(cookieState.at) < COOKIE_CACHE_TTL_MS) {
        return currentCookieCredential(opened.store);
    }
    const blocking = !!(options && options.blocking);
    if (!skipCache && !blocking && !cookieState.mustRevalidate && cookieState.value && opened.store) {
        refreshCookieInBackground(opened.store);
        return currentCookieCredential(opened.store);
    }
    if (opened.store && readTimeoutMs > 0) {
        const version = cookieState.version;
        const read = await settleWithin(
            () => opened.store.getWithMetadata(COOKIE_STORE_KEY, { type: 'text' }),
            readTimeoutMs,
            'read'
        );
        if (version !== cookieState.version) return currentCookieCredential(opened.store);
        if (read.ok) {
            const entry = read.value;
            const stored = sanitizeStoredCookie(entry && entry.data);
            if (stored) {
                adoptStoredCookie(stored, entry.etag, version, entry.metadata);
                return currentCookieCredential(opened.store);
            }
            storeWitness = { cookie: entry && typeof entry.data === 'string' ? entry.data : '',
                etag: entry && typeof entry.etag === 'string' ? entry.etag : '', missing: entry === null };
            cookieState.storeReason = entry && entry.data ? 'invalid' : 'empty';
        } else {
            cookieState.storeReason = read.reason;
        }
    }
    if (opened.store && !(readTimeoutMs > 0)) cookieState.storeReason = 'budget';
    if (!cookieState.mustRevalidate && cookieState.value) {
        return currentCookieCredential(opened.store);
    }
    const envCookie = sanitizeEnvCookie(env.ZTO_COOKIE);
    replaceCookieValue(envCookie);
    cookieState.source = envCookie ? 'env' : '';
    cookieState.at = envCookie ? Date.now() : 0;
    cookieState.storeCookie = storeWitness ? storeWitness.cookie : '';
    cookieState.storeEtag = storeWitness ? storeWitness.etag : '';
    cookieState.storeMissing = !!(storeWitness && storeWitness.missing);
    noteBlobStamps(null);
    cookieState.pendingRenewal = null;
    cookieState.mustRevalidate = false;
    return currentCookieCredential(opened.store);
}

function invalidateCookieCache(session) {
    if (session && !cookieSessionIsCurrent(session)) return;
    cookieState.at = 0;
    cookieState.mustRevalidate = true;
}

function noteCookieRejected(session) {
    if (!cookieSessionIsCurrent(session)) return;
    cookieState.authIdentity = session.identity;
    cookieState.authRejectedAt = Date.now();
    if (cookieState.pendingRenewal && cookieState.pendingRenewal.value === session.cookie) cookieState.pendingRenewal = null;
}

function noteCookieAccepted(session) {
    if (!cookieSessionIsCurrent(session)) return;
    cookieState.authIdentity = session.identity;
    cookieState.authRejectedAt = 0;
    cookieState.authAcceptedAt = Date.now();
}

function noteCookieRenewal(session, response) {
    if (!session || !session.store || !session.cookie) return;
    const lines = setCookieLines(response);
    if (!lines.length) return;
    const merged = mergeRenewedCookie(session.renewal || session.cookie, lines);
    if (!merged) return;
    session.renewal = merged === session.cookie ? '' : merged;
}

function adoptRenewedCookie(session, merged) {
    if (!merged || !cookieSessionIsCurrent(session)) return;
    const pending = cookieState.pendingRenewal;
    const baseCookie = pending ? pending.baseCookie : cookieState.storeCookie;
    const etag = pending ? pending.etag : cookieState.storeEtag;
    const ancestors = new Set(pending ? pending.ancestors : []);
    ancestors.add(session.cookie);
    while (ancestors.size > 32) ancestors.delete(ancestors.values().next().value);
    replaceCookieValue(merged);
    session.cookie = merged;
    session.version = cookieState.version;
    session.identity = cookieCredentialIdentity(merged);
    cookieState.pendingRenewal = { value: merged, baseCookie: baseCookie, etag: etag,
        missing: cookieState.storeMissing, version: cookieState.version, ancestors: ancestors };
}

async function flushCookieRenewal(session, timeoutMs) {
    if (!session || !session.store) return;
    const budgetedMs = timeoutMs === undefined ? COOKIE_RENEW_WRITE_TIMEOUT_MS : timeoutMs;
    if (session.renewal) {
        const merged = session.renewal;
        session.renewal = '';
        adoptRenewedCookie(session, merged);
    }
    const pending = cookieState.pendingRenewal;
    if (!pending || !(budgetedMs > 0) || cookieWriteInFlight) return;
    const criticalRotation = sessionCookieValue(pending.value) !== sessionCookieValue(pending.baseCookie);
    const sameAttempt = pending.value === cookieState.renewAttemptValue && pending.etag === cookieState.renewAttemptEtag;
    if (elapsedSince(cookieState.renewAt) < COOKIE_RENEW_MIN_GAP_MS && (!criticalRotation || sameAttempt)) return;
    if (!pending.etag && !pending.missing) {
        cookieState.storeReason = 'write:no-etag';
        return;
    }
    cookieState.renewAt = Date.now();
    cookieState.renewAttemptValue = pending.value;
    cookieState.renewAttemptEtag = pending.etag;
    const baseCookie = pending.baseCookie;
    const baseEtag = pending.etag;
    const renewedAt = Date.now();
    const metadata = cookieState.blobSyncedAt ? { syncedAt: cookieState.blobSyncedAt, renewedAt: renewedAt } : { renewedAt: renewedAt };
    const options = baseEtag ? { onlyIfMatch: baseEtag, metadata: metadata } : { onlyIfNew: true, metadata: metadata };
    const run = Promise.resolve().then(() => session.store.set(COOKIE_STORE_KEY, pending.value, options)).then((result) => {
        if (cookieState.storeCookie !== baseCookie || cookieState.storeEtag !== baseEtag) return;
        if (!result || result.modified !== true || typeof result.etag !== 'string' || !result.etag) {
            cookieState.storeReason = result && result.modified === false ? 'write:conflict' : 'write:unconfirmed';
            cookieState.at = 0;
            cookieState.mustRevalidate = true;
            return;
        }
        cookieState.storeCookie = pending.value;
        cookieState.storeEtag = result.etag;
        cookieState.storeMissing = false;
        noteBlobStamps(metadata);
        const current = cookieState.pendingRenewal;
        if (current === pending) cookieState.pendingRenewal = null;
        else if (current && current.baseCookie === baseCookie && current.etag === baseEtag) {
            current.baseCookie = pending.value;
            current.etag = result.etag;
            current.missing = false;
        }
        cookieState.source = 'blob';
        if (cookieState.value === pending.value) cookieState.at = Date.now();
        cookieState.storeReason = '';
        cookieState.renewals += 1;
    });
    cookieWriteInFlight = run;
    const write = await settleWithin(() => run, budgetedMs, 'write');
    if (cookieWriteInFlight === run) cookieWriteInFlight = null;
    if (!write.ok) {
        if (cookieState.pendingRenewal && cookieState.pendingRenewal.baseCookie === baseCookie) cookieState.storeReason = write.reason;
    }
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

function readSignedConfig(env) {
    const out = { paths: [], values: [], reason: '' };
    const rawPaths = String(env.ZTO_FIELD_SIGNED || '').trim();
    const rawValues = String(env.ZTO_SIGNED_VALUES || '').trim();
    if (!rawPaths && !rawValues) return out;
    if (!rawPaths || !rawValues) {
        out.reason = rawPaths ? 'values:missing' : 'paths:missing';
        return out;
    }
    const paths = rawPaths.split(',').map((part) => part.trim()).filter(Boolean);
    if (!paths.length || paths.length > SIGNED_PATH_MAX
        || paths.some((part) => part.length > 120 || !FIELD_PATH_RE.test(part))) {
        out.reason = 'paths:invalid';
        return out;
    }
    const values = rawValues.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
    if (!values.length || values.length > SIGNED_VALUE_MAX
        || values.some((part) => !SIGNED_VALUE_RE.test(part))) {
        out.reason = 'values:invalid';
        return out;
    }
    out.paths = paths;
    out.values = values;
    return out;
}

function readListConfig(env) {
    const out = {
        enabled: false, url: null, scanType: DEFAULT_LIST_SCAN_TYPE,
        pageSize: 100, maxPages: 3, reason: '', fingerprint: '',
        signedType: '', signedDesc: '', signedReason: ''
    };
    let url;
    try {
        url = new URL(String(env.ZTO_LIST_URL || '').trim() || DEFAULT_LIST_URL);
    } catch (_) {
        out.reason = 'url:invalid';
        return out;
    }
    if (url.protocol !== 'https:') { out.reason = 'url:invalid'; return out; }
    const scanType = String(env.ZTO_LIST_SCAN_TYPE || '').trim() || DEFAULT_LIST_SCAN_TYPE;
    if (!LIST_SCAN_TYPE_RE.test(scanType)) { out.reason = 'scan-type:invalid'; return out; }
    out.enabled = true;
    out.url = url;
    out.scanType = scanType;
    out.scanDesc = env.ZTO_LIST_SCAN_DESC === undefined
        ? DEFAULT_LIST_SCAN_DESC
        : String(env.ZTO_LIST_SCAN_DESC).trim();
    out.pageSize = boundedInteger(env.ZTO_LIST_PAGE_SIZE, 100, 10, 100);
    out.maxPages = boundedInteger(env.ZTO_LIST_MAX_PAGES, 3, 1, 20);
    readListSignedConfig(env, out);
    out.fingerprint = crypto.createHash('sha256')
        .update(url.href).update(FIELD_SEPARATOR)
        .update(scanType).update(FIELD_SEPARATOR)
        .update(out.scanDesc).update(FIELD_SEPARATOR)
        .update(String(out.pageSize)).update(FIELD_SEPARATOR)
        .update(out.signedType).update(FIELD_SEPARATOR)
        .update(out.signedDesc)
        .digest('base64url')
        .slice(0, 16);
    return out;
}

function readListSignedConfig(env, out) {
    out.signedType = '';
    out.signedReason = '';
    out.signedDesc = env.ZTO_LIST_SIGNED_SCAN_DESC === undefined
        ? DEFAULT_LIST_SIGNED_SCAN_DESC
        : String(env.ZTO_LIST_SIGNED_SCAN_DESC).trim();
    const raw = String(env.ZTO_LIST_SIGNED_SCAN_TYPE || '').trim();
    if (/^off$/i.test(raw)) { out.signedReason = 'signed:off'; return; }
    const type = raw || DEFAULT_LIST_SIGNED_SCAN_TYPE;
    if (!LIST_SCAN_TYPE_RE.test(type)) { out.signedReason = 'signed-type:invalid'; return; }
    if (type === out.scanType) { out.signedReason = 'signed-type:same'; return; }
    out.signedType = type;
}

const ID_TOKEN_HEADER = 'x-zoe-id-token';
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const FIREBASE_CERTS_TTL_MS = 60 * 60 * 1000;
const FIREBASE_CERTS_MIN_TIMEOUT_MS = 1200;
const FIREBASE_CERTS_MAX_TIMEOUT_MS = 3000;
const ID_TOKEN_SKEW_MS = 60 * 1000;
const PROJECT_ID_RE = /^[a-z0-9][a-z0-9-]{2,62}$/;
const PROJECT_ID_MAX = 16;
const SITE_EMAIL_PREFIX_RE = /^[a-z0-9-]{1,32}$/;
const SITE_EMAIL_PREFIX_DEFAULT = 'zoew';

const certsState = { at: 0, keys: null, inFlight: null };

const SUPABASE_ACCOUNT_TTL_MS = 5 * 60 * 1000;
const SUPABASE_ACCOUNT_CACHE_MAX = 500;
const supabaseAccountCache = new Map();

function readSupabaseIdentity(env) {
    const rawUrl = String((env && env.SUPABASE_URL) || '').trim();
    const key = String((env && env.SUPABASE_PUBLISHABLE_KEY) || '').trim();
    if (!rawUrl || !key || /^sb_secret_/i.test(key)) return null;
    let url;
    try { url = new URL(rawUrl); } catch (_) { return null; }
    const local = url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
    if (url.protocol !== 'https:' && !local) return null;
    if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) return null;
    return { base: url.origin, issuer: url.origin + '/auth/v1', key: key };
}

function tokenIssuer(token) {
    const parsed = decodeIdToken(token);
    return parsed && typeof parsed.payload.iss === 'string' ? parsed.payload.iss : '';
}

function rememberSupabaseVerdict(cacheKey, verdict, until) {
    if (supabaseAccountCache.size >= SUPABASE_ACCOUNT_CACHE_MAX) {
        const oldest = supabaseAccountCache.keys().next();
        if (!oldest.done) supabaseAccountCache.delete(oldest.value);
    }
    supabaseAccountCache.set(cacheKey, { verdict: verdict, until: until });
}

async function verifySupabaseToken(token, identity, timeoutMs) {
    const parsed = decodeIdToken(token);
    if (!parsed) return { ok: false, reason: 'idtoken:malformed' };
    if (parsed.payload.iss !== identity.issuer) return { ok: false, reason: 'idtoken:iss' };
    const now = Date.now();
    const exp = Number(parsed.payload.exp) * 1000;
    if (!Number.isFinite(exp) || exp + ID_TOKEN_SKEW_MS < now) return { ok: false, reason: 'idtoken:expired' };
    if (parsed.payload.role !== 'authenticated' || typeof parsed.payload.sub !== 'string' || !parsed.payload.sub) {
        return { ok: false, reason: 'idtoken:sub' };
    }
    const cacheKey = crypto.createHash('sha256').update(identity.issuer + '|' + token).digest('hex');
    const hit = supabaseAccountCache.get(cacheKey);
    if (hit && hit.until > now) return hit.verdict;
    if (hit) supabaseAccountCache.delete(cacheKey);
    const out = await settleWithin(async () => {
        const res = await fetch(identity.base + '/rest/v1/rpc/my_account', {
            method: 'POST',
            headers: { apikey: identity.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: '{}'
        });
        if (!res) throw new Error('supabase:http');
        if (res.status === 401 || res.status === 403) return { denied: true };
        if (!res.ok) throw new Error('supabase:http');
        return { rows: await res.json() };
    }, timeoutMs, 'supabase');
    if (!out.ok || !out.value) return { ok: false, reason: 'idtoken:supabase-unreachable' };
    const until = Math.min(exp, now + SUPABASE_ACCOUNT_TTL_MS);
    let verdict;
    if (out.value.denied) {
        verdict = { ok: false, reason: 'idtoken:signature' };
    } else {
        const rows = Array.isArray(out.value.rows) ? out.value.rows : [];
        const row = rows.length === 1 && rows[0] && typeof rows[0] === 'object' ? rows[0] : null;
        if (!row) verdict = { ok: true, siteCode: '', reason: '' };
        else if (row.status !== 'active') verdict = { ok: false, reason: 'site:tenant-' + (row.status === 'expired' ? 'expired' : 'revoked') };
        else verdict = { ok: true, siteCode: typeof row.branch_code === 'string' ? row.branch_code : '', reason: '' };
    }
    rememberSupabaseVerdict(cacheKey, verdict, until);
    return verdict;
}

async function resolveListIdentity(idToken, config, startedAt, env) {
    const supabase = readSupabaseIdentity(env);
    const issuer = idToken ? tokenIssuer(idToken) : '';
    if (supabase && issuer === supabase.issuer) {
        const auth = await verifySupabaseToken(idToken, supabase, certsTimeoutMs(config, startedAt));
        return { auth: auth, site: auth.ok ? listSiteCodeOf(auth.siteCode) : { code: '', reason: auth.reason } };
    }
    if (!supabase && /\/auth\/v1$/.test(issuer)) {
        const auth = { ok: false, reason: 'idtoken:supabase-unset' };
        return { auth: auth, site: { code: '', reason: auth.reason } };
    }
    const auth = await verifyIdToken(idToken, readProjectIds(env), certsTimeoutMs(config, startedAt));
    return { auth: auth, site: auth.ok ? listSiteCodeOf(siteCodeFromEmail(auth.email, siteEmailPrefix(env))) : { code: '', reason: auth.reason } };
}

function readProjectIds(env) {
    const raw = String((env && env.FIREBASE_PROJECT_IDS) || '').trim();
    if (!raw) return [];
    const parts = raw.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
    if (!parts.length || parts.length > PROJECT_ID_MAX) return [];
    if (parts.some((part) => !PROJECT_ID_RE.test(part))) return [];
    return parts;
}

function siteEmailPrefix(env) {
    const raw = String((env && env.ZTO_SITE_EMAIL_PREFIX) || '').trim().toLowerCase();
    return SITE_EMAIL_PREFIX_RE.test(raw) ? raw : SITE_EMAIL_PREFIX_DEFAULT;
}

function siteCodeFromEmail(email, prefix) {
    const text = String(email || '').trim().toLowerCase();
    const re = new RegExp('@' + prefix + '([0-9]{1,32})\\.com$');
    const hit = re.exec(text);
    return hit ? hit[1] : '';
}

function b64urlBuf(text) {
    const raw = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
    if (!/^[A-Za-z0-9+/]*$/.test(raw)) return null;
    const pad = raw.length % 4;
    try { return Buffer.from(raw + (pad ? '===='.slice(pad) : ''), 'base64'); } catch (_) { return null; }
}

function decodeIdToken(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const headBuf = b64urlBuf(parts[0]);
    const bodyBuf = b64urlBuf(parts[1]);
    const sig = b64urlBuf(parts[2]);
    if (!headBuf || !bodyBuf || !sig || !sig.length) return null;
    let header, payload;
    try {
        header = JSON.parse(headBuf.toString('utf8'));
        payload = JSON.parse(bodyBuf.toString('utf8'));
    } catch (_) { return null; }
    if (!header || typeof header !== 'object' || Array.isArray(header)) return null;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    return { header: header, payload: payload, signed: parts[0] + '.' + parts[1], signature: sig };
}

async function firebaseCerts(timeoutMs) {
    if (certsState.keys && elapsedSince(certsState.at) < FIREBASE_CERTS_TTL_MS) return certsState.keys;
    if (certsState.inFlight) return certsState.inFlight;
    certsState.inFlight = (async () => {
        const out = await settleWithin(async () => {
            const res = await fetch(FIREBASE_CERTS_URL, { method: 'GET' });
            if (!res || !res.ok) throw new Error('certs:http');
            return await res.json();
        }, timeoutMs, 'certs');
        certsState.inFlight = null;
        if (!out.ok || !out.value || typeof out.value !== 'object') return certsState.keys;
        const keys = {};
        Object.keys(out.value).forEach((kid) => {
            const pem = out.value[kid];
            if (typeof pem === 'string' && pem.indexOf('BEGIN CERTIFICATE') !== -1) keys[kid] = pem;
        });
        if (!Object.keys(keys).length) return certsState.keys;
        certsState.keys = keys;
        certsState.at = Date.now();
        return keys;
    })();
    return certsState.inFlight;
}

async function verifyIdToken(token, projectIds, timeoutMs) {
    if (!token) return { ok: false, reason: 'idtoken:missing' };
    if (!projectIds.length) return { ok: false, reason: 'idtoken:project-unset' };
    const parsed = decodeIdToken(token);
    if (!parsed) return { ok: false, reason: 'idtoken:malformed' };
    if (parsed.header.alg !== 'RS256') return { ok: false, reason: 'idtoken:alg' };
    const kid = typeof parsed.header.kid === 'string' ? parsed.header.kid : '';
    if (!kid) return { ok: false, reason: 'idtoken:kid' };

    const aud = typeof parsed.payload.aud === 'string' ? parsed.payload.aud.toLowerCase() : '';
    if (!aud || projectIds.indexOf(aud) === -1) return { ok: false, reason: 'idtoken:aud' };
    if (parsed.payload.iss !== 'https://securetoken.google.com/' + aud) return { ok: false, reason: 'idtoken:iss' };

    const now = Date.now();
    const exp = Number(parsed.payload.exp) * 1000;
    const iat = Number(parsed.payload.iat) * 1000;
    if (!Number.isFinite(exp) || exp + ID_TOKEN_SKEW_MS < now) return { ok: false, reason: 'idtoken:expired' };
    if (!Number.isFinite(iat) || iat - ID_TOKEN_SKEW_MS > now) return { ok: false, reason: 'idtoken:future' };
    if (typeof parsed.payload.sub !== 'string' || !parsed.payload.sub) return { ok: false, reason: 'idtoken:sub' };

    const keys = await firebaseCerts(timeoutMs);
    if (!keys) return { ok: false, reason: 'idtoken:certs' };
    const pem = keys[kid];
    if (!pem) return { ok: false, reason: 'idtoken:kid-unknown' };

    let good = false;
    try {
        good = crypto.verify('RSA-SHA256', Buffer.from(parsed.signed), crypto.createPublicKey(pem), parsed.signature);
    } catch (_) { good = false; }
    if (!good) return { ok: false, reason: 'idtoken:signature' };

    const email = typeof parsed.payload.email === 'string' ? parsed.payload.email : '';
    return { ok: true, email: email, reason: '' };
}

function listSiteCodeOf(raw) {
    const text = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!text) return { code: '', reason: 'site:missing' };
    if (!LIST_SITE_CODE_RE.test(text)) return { code: '', reason: 'site:invalid' };
    return { code: text, reason: '' };
}

function listDateIsValid(text) {
    if (!LIST_DATE_RE.test(text)) return false;
    const at = Date.parse(text + 'T00:00:00Z');
    if (!Number.isFinite(at)) return false;
    return new Date(at).toISOString().slice(0, 10) === text;
}

function listRange(fromText, toText) {
    const from = String(fromText || '').trim();
    const to = String(toText || '').trim();
    if (!listDateIsValid(from) || !listDateIsValid(to)) return null;
    const a = Date.parse(from + 'T00:00:00Z');
    const b = Date.parse(to + 'T00:00:00Z');
    if (b < a) return null;
    if ((b - a) / 86400000 > LIST_RANGE_MAX_DAYS - 1) return null;
    return { from: from, to: to, start: from + ' 00:00:00', end: to + ' 23:59:59' };
}

function listTodayKey() {
    return new Date(Date.now() + LIST_ZONE_OFFSET_MS).toISOString().slice(0, 10);
}

function listSignedRange(range) {
    const today = listTodayKey();
    const to = range.to > today ? range.to : today;
    const earliest = new Date(Date.parse(to + 'T00:00:00Z') - (LIST_RANGE_MAX_DAYS - 1) * DAY_MS)
        .toISOString().slice(0, 10);
    const from = range.from > earliest ? range.from : earliest;
    return { from: from, to: to, start: from + ' 00:00:00', end: to + ' 23:59:59' };
}

function listRequestBody(listConfig, siteCode, range, page, scanType) {
    return {
        condition: {
            dispatchOrSendManCode: null,
            mailNos: [],
            preOrNextStationCode: null,
            scanEndTime: range.end,
            scanManCode: null,
            scanSiteCode: siteCode,
            scanStartTime: range.start,
            scanTypeCode: scanType || listConfig.scanType,
            signMan: null
        },
        pageNum: page,
        pageSize: listConfig.pageSize
    };
}

function listPlan(config, siteCode, range, page, kind) {
    const scanType = kind === 'signed' ? config.list.signedType : config.list.scanType;
    return {
        href: config.list.url.href,
        body: listRequestBody(config.list, siteCode, range, page, scanType),
        extract: (upstream) => {
            const container = listContainerOf(upstream);
            return container ? listResponseBody(config, container, page, siteCode, kind) : null;
        },
        cacheKey: config.fingerprint + '|L|' + config.list.fingerprint + '|' + kind
            + '|' + siteCode + '|' + range.from + '|' + range.to + '|' + page,
        cacheTtlMs: kind === 'signed' ? Math.min(config.listCacheTtlMs, LIST_SIGNED_CACHE_TTL_MAX_MS) : config.listCacheTtlMs
    };
}

function listContainerOf(upstream) {
    if (!upstream || typeof upstream !== 'object') return null;
    const roots = [upstream.data, upstream.result, upstream.data && upstream.data.data,
        upstream.body, upstream];
    const keys = ['result', 'rows', 'list', 'records', 'items'];
    for (let i = 0; i < roots.length; i++) {
        const node = roots[i];
        if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
        for (let j = 0; j < keys.length; j++) {
            if (Array.isArray(node[keys[j]])) return { rows: node[keys[j]], meta: node };
        }
    }
    for (let i = 0; i < roots.length; i++) {
        if (Array.isArray(roots[i])) return { rows: roots[i], meta: {} };
    }
    return null;
}

function listPhoneIsPlaceholder(text) {
    const digits = String(text || '').replace(/[^0-9]/g, '');
    return !digits || /^0+$/.test(digits);
}

function listScanTypeSkip(listConfig, candidates) {
    const code = pickText(candidates, LIST_SCAN_CODE_PATHS);
    if (code && code !== listConfig.scanType) return 'scan-type';
    if (!listConfig.scanDesc) return '';
    const desc = pickText(candidates, LIST_SCAN_DESC_PATHS);
    if (!desc) return '';
    return desc === listConfig.scanDesc ? '' : 'scan-type';
}

function listRowSignedVerdict(listConfig, candidates) {
    if (!listConfig.signedType) return '';
    const code = pickText(candidates, LIST_SCAN_CODE_PATHS);
    const desc = pickText(candidates, LIST_SCAN_DESC_PATHS);
    if (code && code !== listConfig.signedType) return '';
    if (listConfig.signedDesc && desc && desc !== listConfig.signedDesc) return code ? 'mismatch' : '';
    if (code) return 'signed';
    return listConfig.signedDesc && desc ? 'signed' : '';
}

function listSiteNameOf(candidates) {
    return pickText(candidates, LIST_SITE_NAME_PATHS).replace(/\s+/g, ' ');
}

function projectListRow(config, row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const candidates = [row];
    const phone = pickText(candidates, config.phonePaths);
    const cod = pickNumber(candidates, config.codPaths);
    const dod = pickNumber(candidates, config.dodPaths);
    const at = pickText(candidates, LIST_TIME_PATHS);
    return {
        barcode: pickText(candidates, LIST_BARCODE_PATHS),
        phone: listPhoneIsPlaceholder(phone) ? '' : phone,
        cod: cod === null ? 0 : cod,
        dod: dod === null ? 0 : dod,
        at: LIST_TIME_RE.test(at) ? at.slice(0, 19) : '',
        ztoClosed: pickSignedVerdict(candidates, config.signed),
        skip: listScanTypeSkip(config.list, candidates),
        from: pickText(candidates, LIST_ORIGIN_PATHS).replace(/\s+/g, ' ')
    };
}

function listResponseBody(config, container, page, siteCode, kind) {
    const rows = [];
    const signed = [];
    const seenSigned = new Set();
    let otherScans = 0;
    let signedScans = 0;
    let signedMismatch = 0;
    let siteName = '';
    const raws = container.rows.slice(0, LIST_ROW_MAX);
    for (let i = 0; i < raws.length; i++) {
        const raw = raws[i];
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const candidates = [raw];
        if (!siteName) siteName = listSiteNameOf(candidates);
        const verdict = listRowSignedVerdict(config.list, candidates);
        if (verdict === 'signed') {
            signedScans++;
            const code = pickText(candidates, LIST_BARCODE_PATHS);
            if (BARCODE_RE.test(code) && !seenSigned.has(code)) {
                seenSigned.add(code);
                signed.push(code);
            }
            continue;
        }
        if (verdict === 'mismatch') { signedMismatch++; otherScans++; continue; }
        if (kind === 'signed') { otherScans++; continue; }
        const row = projectListRow(config, raw);
        if (row.skip === 'scan-type') { otherScans++; continue; }
        rows.push(row);
    }
    if (signedMismatch > 0) {
        signedMismatchSignal.at = Date.now();
        signedMismatchSignal.count += signedMismatch;
    }
    const meta = container.meta || {};
    const pages = Number(meta.pages);
    const total = Number(meta.total);
    const counted = rows.length + otherScans + signedScans;
    return {
        success: true,
        list: true,
        enabled: true,
        kind: kind,
        page: page,
        site: String(siteCode || ''),
        siteName: siteName,
        pages: Number.isFinite(pages) ? pages : (counted ? 1 : 0),
        total: Number.isFinite(total) ? total : counted,
        rows: rows,
        otherScans: otherScans,
        signedScans: signedScans,
        signedMismatch: signedMismatch,
        signed: config.list.signedType ? signed : null,
        signedOk: kind === 'signed' && !!config.list.signedType
    };
}

function mergeSignedCompanion(body, outcome) {
    const out = Object.assign({}, body);
    const companion = outcome && outcome.kind === 'ok' ? outcome.body : null;
    if (!companion || !Array.isArray(companion.signed)) {
        out.signedOk = false;
        return out;
    }
    const merged = Array.isArray(out.signed) ? out.signed.slice() : [];
    const seen = new Set(merged);
    companion.signed.forEach((code) => {
        if (!seen.has(code)) { seen.add(code); merged.push(code); }
    });
    out.signed = merged;
    out.signedOk = true;
    out.signedPages = companion.pages;
    out.signedTotal = companion.total;
    out.signedListMismatch = companion.signedMismatch;
    if (!out.siteName && companion.siteName) out.siteName = companion.siteName;
    return out;
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
        signed: readSignedConfig(env),
        list: readListConfig(env),
        upstreamTimeoutMs: boundedInteger(env.ZTO_UPSTREAM_TIMEOUT_MS, 6000, 2000, 20000),
        budgetMs: boundedInteger(env.ZTO_REQUEST_BUDGET_MS, 9000, 4000, 24000),
        retries: boundedInteger(env.ZTO_UPSTREAM_RETRIES, 1, 0, 3),
        cacheTtlMs: boundedInteger(env.ZTO_CACHE_TTL_MS, 60000, 0, 600000)
    };

    config.notFoundCacheTtlMs = Math.min(
        boundedInteger(env.ZTO_NOT_FOUND_CACHE_TTL_MS, NOT_FOUND_CACHE_TTL_DEFAULT_MS, 0, 120000),
        config.cacheTtlMs);

    config.listCacheTtlMs = Math.min(config.cacheTtlMs, LIST_CACHE_TTL_MAX_MS);

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
        .update(FIELD_SEPARATOR)
        .update(config.signed.paths.join(',') + '|' + config.signed.values.join(','))
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

function buildHeaders(config, env, cookie, wantsPost) {
    const credential = {};
    const authKind = applyAuthentication(credential, env, cookie);
    const headers = {
        Accept: 'application/json',
        'Accept-Language': config.acceptLanguage,
        'User-Agent': config.userAgent
    };
    if (config.method === 'POST' || wantsPost) headers['Content-Type'] = 'application/json;charset=UTF-8';
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
    const codes = upstream ? [upstream.code, upstream.errorCode, upstream.statusCode] : [];
    const raw = upstreamMessage(upstream, '');
    const message = raw.toLowerCase();
    if (codes.some((code) => /^(?:401|403|unauthorized|forbidden|not[_-]?login|login[_-]?required)$/.test(String(code ?? '').trim().toLowerCase()))) return true;
    if (LOGIN_REDIRECT_RE.test(raw)) return true;
    return /(?:session|token|cookie|login|auth).{0,32}(?:expired|invalid|required|missing|failed)|(?:expired|invalid).{0,16}(?:session|token|cookie)|not\s+(?:logged|signed)\s+in|unauthori[sz]ed|未登录|登录失效|登录过期/.test(message);
}

function upstreamCodeText(upstream) {
    if (!upstream || typeof upstream !== 'object' || Array.isArray(upstream)) return '';
    let raw = '';
    if (upstream.code !== undefined && upstream.code !== null) raw = upstream.code;
    else if (upstream.errorCode !== undefined && upstream.errorCode !== null) raw = upstream.errorCode;
    else if (upstream.statusCode !== undefined && upstream.statusCode !== null) raw = upstream.statusCode;
    return String(raw).trim().toLowerCase();
}

function upstreamSucceeded(upstream) {
    if (!upstream || typeof upstream !== 'object' || Array.isArray(upstream)) return false;
    if (upstream.success === false || upstream.status === false || upstream.result === false) return false;
    if (upstream.success === true || upstream.status === true || upstream.result === true) return true;
    const code = upstreamCodeText(upstream);
    if (!code) return true;
    return SUCCESS_CODE_RE.test(code);
}

function noteUpstreamReject(status, upstream) {
    upstreamRejectSignal.at = Date.now();
    upstreamRejectSignal.count++;
    upstreamRejectSignal.status = Number(status) || 0;
    const code = upstreamCodeText(upstream);
    upstreamRejectSignal.code = SAFE_REASON_RE.test(code) ? code : (code ? 'unsafe' : '');
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
            if (Number.isFinite(value)) return value < 0 ? 0 : value;
        }
    }
    return null;
}

function pickSignedVerdict(candidates, signed) {
    if (!signed || !signed.paths.length || !signed.values.length) return null;
    for (let i = 0; i < candidates.length; i++) {
        for (let j = 0; j < signed.paths.length; j++) {
            const raw = getPath(candidates[i], signed.paths[j]);
            if (raw === null || raw === undefined || typeof raw === 'object') continue;
            const text = String(raw).replace(CONTROL_CHAR_RE, '').trim().toLowerCase();
            if (!text) continue;
            return signed.values.indexOf(text) !== -1;
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
        dod: dod === null ? 0 : dod,
        signed: pickSignedVerdict(candidates, config.signed)
    };
}

function abortError() {
    const error = new Error('ZTO_UPSTREAM_TIMEOUT');
    error.name = 'AbortError';
    return error;
}

async function requestOnce(config, headers, barcode, timeoutMs, session, plan) {
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
        const target = new URL(plan ? plan.href : config.endpoint.href);
        const init = {
            method: plan ? 'POST' : config.method,
            headers,
            signal: controller.signal,
            redirect: 'manual'
        };
        if (plan) {
            init.body = JSON.stringify(plan.body);
        } else if (config.method === 'POST') {
            init.body = JSON.stringify(fillTemplate(config.bodyTemplate, barcode, 0));
        } else {
            target.searchParams.set(config.queryParam, barcode);
        }

        const response = await fetch(target.href, init);
        if (controller.signal.aborted) throw abortError();
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
                    error: 'ZTO returned non-JSON (HTTP ' + response.status + ')',
                    code: 'ZTO_INVALID_RESPONSE'
                })
            };
        }

        if (ztoAuthRejected(response, upstream)) return { kind: 'authRejected' };
        if (!response.ok || !upstreamSucceeded(upstream)) {
            noteUpstreamReject(response.status, upstream);
            return {
                kind: 'fatal',
                response: json(502, {
                    error: 'ZTO rejected the request (HTTP ' + response.status + ')',
                    code: 'ZTO_UPSTREAM_REJECTED'
                })
            };
        }

        if (plan) {
            const built = plan.extract(upstream);
            if (!built) {
                return {
                    kind: 'fatal',
                    response: json(502, {
                        error: 'ZTO list response has no rows',
                        code: 'ZTO_UPSTREAM_REJECTED'
                    })
                };
            }
            return { kind: 'ok', body: built };
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
                dod: order.dod,
                ztoClosed: order.signed
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

async function fetchOrder(config, headers, barcode, startedAt, session, plan) {
    let attempt = 0;
    let lastTransient = null;
    for (;;) {
        const remaining = config.budgetMs - elapsedSince(startedAt);
        if (remaining <= 1200) return lastTransient || budgetTimeoutOutcome();
        const timeoutMs = Math.max(1000, Math.min(config.upstreamTimeoutMs, remaining - 200));
        const outcome = await requestOnce(config, headers, barcode, timeoutMs, session, plan);
        if (outcome.kind !== 'transient') return outcome;
        lastTransient = { kind: 'fatal', response: outcome.response };
        attempt += 1;
        if (attempt > config.retries) return lastTransient;
        const backoffMs = 250 * attempt;
        if (config.budgetMs - elapsedSince(startedAt) <= backoffMs + 1500) return lastTransient;
        await delay(backoffMs);
    }
}

function budgetTimeoutOutcome() {
    return { kind: 'fatal', response: json(504, { error: 'ZTO request timed out', code: 'ZTO_TIMEOUT' }) };
}

function joinWithinBudget(run, config, startedAt) {
    const left = budgetLeftMs(config, startedAt) - 200;
    if (!(left > 0)) return Promise.resolve(budgetTimeoutOutcome());
    let timer = null;
    const guard = new Promise((resolve) => { timer = setTimeout(() => resolve(budgetTimeoutOutcome()), left); });
    return Promise.race([run, guard]).finally(() => clearTimeout(timer));
}

function budgetLeftMs(config, startedAt) {
    return config.budgetMs - elapsedSince(startedAt);
}

function certsTimeoutMs(config, startedAt) {
    const left = budgetLeftMs(config, startedAt) - config.upstreamTimeoutMs;
    if (left >= FIREBASE_CERTS_MAX_TIMEOUT_MS) return FIREBASE_CERTS_MAX_TIMEOUT_MS;
    return left > FIREBASE_CERTS_MIN_TIMEOUT_MS ? left : FIREBASE_CERTS_MIN_TIMEOUT_MS;
}

function cookieReadTimeoutMs(config, startedAt) {
    const left = budgetLeftMs(config, startedAt);
    if (!cookieState.value) {
        const cold = Math.min(COOKIE_STORE_TIMEOUT_MS,
            left - COOKIE_BUDGET_RESERVE_MS - COOKIE_COLD_UPSTREAM_RESERVE_MS);
        if (cold >= COOKIE_READ_MIN_TIMEOUT_MS) return cold;
        const floor = Math.min(COOKIE_READ_MIN_TIMEOUT_MS, left - COOKIE_BUDGET_RESERVE_MS);
        return floor > 0 ? floor : 0;
    }
    const room = left - COOKIE_BUDGET_RESERVE_MS - config.upstreamTimeoutMs;
    if (room >= COOKIE_READ_MIN_TIMEOUT_MS) return Math.min(COOKIE_STORE_TIMEOUT_MS, room);
    return 0;
}

function cookieRenewTimeoutMs(config, startedAt) {
    const room = budgetLeftMs(config, startedAt) - COOKIE_BUDGET_RESERVE_MS;
    if (room < COOKIE_WRITE_MIN_TIMEOUT_MS) return 0;
    return Math.min(COOKIE_RENEW_WRITE_TIMEOUT_MS, room);
}

async function retryAfterAuthRejected(netlifyEvent, config, barcode, startedAt, previousCookie, plan) {
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
        invalidateCookieCache(fresh);
        return null;
    }
    let built;
    try {
        built = buildHeaders(config, process.env, fresh.cookie, !!plan);
    } catch (_) {
        return null;
    }
    if (!built.authKind) return null;
    const flightKey = (plan ? plan.cacheKey : config.fingerprint + '|' + barcode.toUpperCase())
        + '|' + (cookieFingerprint(fresh.cookie) || '-');
    let outcome;
    try {
        outcome = await runSharedLookup(flightKey, config, built.headers, barcode, fresh, startedAt, plan);
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

function runSharedLookup(key, config, headers, barcode, session, startedAt, plan) {
    const existing = inFlight.get(key);
    if (existing) return joinWithinBudget(existing, config, startedAt);
    const run = fetchOrder(config, headers, barcode, startedAt, session, plan);
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

async function prewarmCookieCredential(netlifyEvent) {
    if (cookieState.value && elapsedSince(cookieState.at) < COOKIE_CACHE_TTL_MS) return;
    try {
        await resolveCookieCredential(netlifyEvent, process.env, { blocking: true });
    } catch (_) {}
}

function diagnosticsBody(config, headers, authKind, credential) {
    const verdictMatches = credential && credential.identity === cookieState.authIdentity;
    return {
        ok: true,
        code: 'ZTO_DIAG',
        auth: authKind || 'none',
        cookie: {
            source: (credential && credential.source) || 'none',
            fingerprint: cookieFingerprint(credential && credential.cookie) || null,
            ageMs: cookieState.at ? elapsedSince(cookieState.at) : null,
            blobSyncAgeMs: credential && credential.source === 'blob' ? blobStampAgeMs(cookieState.blobSyncedAt) : null,
            blobRenewAgeMs: credential && credential.source === 'blob' ? blobStampAgeMs(cookieState.blobRenewedAt) : null,
            storeReason: cookieState.storeReason || null,
            renewals: cookieState.renewals,
            authRejectedAgeMs: verdictMatches && cookieState.authRejectedAt
                ? elapsedSince(cookieState.authRejectedAt)
                : null,
            authAcceptedAgeMs: verdictMatches && cookieState.authAcceptedAt
                ? elapsedSince(cookieState.authAcceptedAt)
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
            barcode: config.barcodePaths.slice(0, 4),
            signed: config.signed.paths.slice(0, 4),
            signedValues: config.signed.values.length,
            signedReason: config.signed.reason || null
        },
        list: {
            enabled: config.list.enabled,
            siteFromRequest: true,
            reason: config.list.reason || null,
            host: config.list.url ? config.list.url.hostname : null,
            path: config.list.url ? config.list.url.pathname : null,
            pageSize: config.list.pageSize,
            maxPages: config.list.maxPages,
            scanTypeIsDefault: config.list.scanType === DEFAULT_LIST_SCAN_TYPE,
            scanDescIsDefault: config.list.scanDesc === DEFAULT_LIST_SCAN_DESC,
            scanDescEnforced: !!config.list.scanDesc,
            signedEnabled: !!config.list.signedType,
            signedReason: config.list.signedReason || null,
            signedTypeIsDefault: config.list.signedType === DEFAULT_LIST_SIGNED_SCAN_TYPE,
            signedDescIsDefault: config.list.signedDesc === DEFAULT_LIST_SIGNED_SCAN_DESC,
            signedMismatch: {
                observed: signedMismatchSignal.count > 0,
                count: signedMismatchSignal.count,
                ageMs: signedMismatchSignal.at ? elapsedSince(signedMismatchSignal.at) : null
            },
            cacheTtlMs: config.listCacheTtlMs,
            signedCacheTtlMs: Math.min(config.listCacheTtlMs, LIST_SIGNED_CACHE_TTL_MAX_MS)
        },
        timing: {
            upstreamTimeoutMs: config.upstreamTimeoutMs,
            budgetMs: config.budgetMs,
            retries: config.retries,
            cacheTtlMs: config.cacheTtlMs,
            notFoundCacheTtlMs: config.notFoundCacheTtlMs
        },
        cacheEntries: resultCache.size,
        upstreamReject: {
            observed: upstreamRejectSignal.count > 0,
            count: upstreamRejectSignal.count,
            status: upstreamRejectSignal.status || null,
            code: upstreamRejectSignal.code || null,
            ageMs: upstreamRejectSignal.at ? elapsedSince(upstreamRejectSignal.at) : null
        },
        sessionRenewal: {
            observed: upstreamCookieSignal.seenAt > 0,
            setCookie: upstreamCookieSignal.setCookie,
            names: upstreamCookieSignal.names,
            ageMs: upstreamCookieSignal.seenAt ? elapsedSince(upstreamCookieSignal.seenAt) : null
        }
    };
}

const NATIVE_APP_ORIGINS = new Set(['https://localhost']);
const CORS_HEADER_NAME_RE = /^[A-Za-z0-9-]{1,64}$/;
const QUERY_HEADER = 'x-zoe-query';
const QUERY_HEADER_MAX = 2048;

function headerOf(event, name) {
    const headers = (event && event.headers) || {};
    const lower = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) return String(headers[key] || '');
    }
    return '';
}

function corsHeadersFor(event) {
    const origin = headerOf(event, 'origin');
    if (!NATIVE_APP_ORIGINS.has(origin)) return null;
    const out = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Max-Age': '7200',
        Vary: 'Origin'
    };
    const requested = headerOf(event, 'access-control-request-headers')
        .split(',').map((h) => h.trim()).filter(Boolean);
    if (requested.length && requested.length <= 12 && requested.every((h) => CORS_HEADER_NAME_RE.test(h))) {
        out['Access-Control-Allow-Headers'] = requested.join(', ');
    }
    return out;
}

function requestQuery(event) {
    const direct = event && event.queryStringParameters;
    if (direct && typeof direct === 'object' && Object.keys(direct).length) return direct;
    const raw = headerOf(event, QUERY_HEADER);
    if (!raw || raw.length > QUERY_HEADER_MAX) return direct || {};
    const out = Object.create(null);
    try {
        for (const [key, value] of new URLSearchParams(raw)) {
            if (!(key in out)) out[key] = value;
        }
    } catch (_) {
        return direct || {};
    }
    return out;
}

function withCors(event, response) {
    const cors = corsHeadersFor(event);
    if (!cors || !response || typeof response !== 'object') return response;
    response.headers = Object.assign({}, response.headers || {}, cors);
    return response;
}

exports.handler = async function handler(event) {
    return withCors(event, await handleRequest(event));
};

async function handleRequest(event) {
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

    const query = requestQuery(event);
    const wantsDiagnostics = String(query.diag || '') === '1';
    const wantsFreshCookie = wantsDiagnostics && String(query.fresh || '') === '1';
    const barcode = String(query.barcode || '').trim();

    const wantsList = !wantsDiagnostics && String(query.list || '') === '1';
    let plan = null;
    let companion = null;
    if (wantsList) {
        const idToken = (event.headers && (event.headers[ID_TOKEN_HEADER] || event.headers['X-Zoe-Id-Token'])) || '';
        const identity = await resolveListIdentity(idToken, config, startedAt, process.env);
        const auth = identity.auth;
        const site = identity.site;
        if (!auth.ok && site.reason === auth.reason) {
            return json(200, {
                success: false, list: true, enabled: false,
                code: 'ZTO_LIST_NOT_CONFIGURED', reason: auth.reason
            });
        }
        if (auth.ok && site.reason) {
            return json(200, {
                success: false, list: true, enabled: false,
                code: 'ZTO_LIST_NOT_CONFIGURED', reason: 'site:no-account'
            });
        }
        if (!config.list.enabled || site.reason) {
            return json(200, {
                success: false,
                list: true,
                enabled: false,
                code: 'ZTO_LIST_NOT_CONFIGURED',
                reason: config.list.reason || site.reason
            });
        }
        const range = listRange(query.from, query.to);
        if (!range) {
            return json(400, {
                error: 'Invalid list date range',
                code: 'ZTO_LIST_RANGE_INVALID'
            });
        }
        const page = Number(String(query.page || '1').trim());
        if (!Number.isInteger(page) || page < 1 || page > config.list.maxPages) {
            return json(400, { error: 'Invalid list page', code: 'ZTO_LIST_PAGE_INVALID' });
        }
        const signedOnly = String(query.signed || '') === '1';
        if (signedOnly && !config.list.signedType) {
            return json(200, {
                success: true, list: true, enabled: true, kind: 'signed', page: page,
                site: site.code, siteName: '', pages: 0, total: 0, rows: [],
                otherScans: 0, signedScans: 0, signed: null, signedOk: false,
                reason: config.list.signedReason || 'signed:off'
            });
        }
        plan = signedOnly
            ? listPlan(config, site.code, range, page, 'signed')
            : listPlan(config, site.code, range, page, 'arrival');
        if (!signedOnly && config.list.signedType && String(query.withSigned || '') === '1') {
            companion = listPlan(config, site.code, listSignedRange(range), page, 'signed');
            plan.cacheKey += '|S';
        }
    }

    if (!wantsDiagnostics && !plan && !BARCODE_RE.test(barcode)) {
        return json(400, { error: 'Invalid barcode', code: 'ZTO_BARCODE_INVALID' });
    }

    const cacheKey = plan ? plan.cacheKey : config.fingerprint + '|' + barcode.toUpperCase();
    if (!wantsDiagnostics) {
        const early = plan
            ? readCachedBody(cacheKey, plan.cacheTtlMs, 0)
            : readCachedBody(cacheKey, config.cacheTtlMs, config.notFoundCacheTtlMs);
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
        const built = buildHeaders(config, process.env, session.cookie, !!plan);
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

    const flightKey = cacheKey + '|' + (cookieFingerprint(session.cookie) || '-');

    let outcome;
    let companionRun = null;
    try {
        const primaryRun = runSharedLookup(flightKey, config, headers, barcode, session, startedAt, plan);
        if (companion) {
            companionRun = runSharedLookup(companion.cacheKey + '|' + (cookieFingerprint(session.cookie) || '-'),
                config, headers, barcode, session, startedAt, companion).catch(() => null);
        }
        outcome = await primaryRun;
    } catch (_) {
        return json(502, { error: 'Unable to reach ZTO', code: 'ZTO_UNAVAILABLE' });
    }

    if (outcome.kind === 'authRejected') {
        session.renewal = '';
        invalidateCookieCache(session);
        noteCookieRejected(session);
        const retried = await retryAfterAuthRejected(event, config, barcode, startedAt, session.cookie, plan);
        if (!retried) {
            return json(401, { error: 'ZTO authentication rejected', code: 'ZTO_AUTH_EXPIRED' });
        }
        session = retried.session;
        outcome = retried.outcome;
        if (outcome.kind === 'authRejected') {
            session.renewal = '';
            invalidateCookieCache(session);
            noteCookieRejected(session);
            return json(401, { error: 'ZTO authentication rejected', code: 'ZTO_AUTH_EXPIRED' });
        }
    }

    if (outcome.kind === 'ok' || outcome.kind === 'notFound') noteCookieAccepted(session);

    const companionOutcome = companionRun ? await companionRun : null;

    await flushCookieRenewal(session, cookieRenewTimeoutMs(config, startedAt));

    if (outcome.kind === 'ok') {
        let body = outcome.body;
        if (companion) body = mergeSignedCompanion(body, companionOutcome);
        const ttlMs = plan ? plan.cacheTtlMs : config.cacheTtlMs;
        if (ttlMs > 0 && (!companion || body.signedOk)) storeCachedBody(cacheKey, body);
        return json(200, Object.assign({}, body, { cached: false }));
    }
    if (outcome.kind === 'notFound') {
        const notFoundBody = { success: false, found: false, barcode, code: 'ZTO_NOT_FOUND' };
        if (config.notFoundCacheTtlMs > 0) storeCachedBody(cacheKey, notFoundBody, true);
        return json(200, Object.assign({}, notFoundBody, { cached: false }));
    }
    return outcome.response;
}

exports.expireCookieCacheForTests = function expireCookieCacheForTests() {
    if (cookieState.at) cookieState.at = 1;
};

exports.resetCachesForTests = function resetCachesForTests() {
    resultCache.clear();
    inFlight.clear();
    certsState.at = 0;
    certsState.keys = null;
    certsState.inFlight = null;
    supabaseAccountCache.clear();
    signedMismatchSignal.at = 0;
    signedMismatchSignal.count = 0;
    cookieRefreshInFlight = false;
    cookieWriteInFlight = null;
    cookieState.mustRevalidate = false;
    cookieState.value = '';
    cookieState.source = '';
    cookieState.at = 0;
    cookieState.storeReason = '';
    cookieState.renewAt = 0;
    cookieState.renewals = 0;
    cookieState.authRejectedAt = 0;
    cookieState.authAcceptedAt = 0;
    cookieState.authIdentity = '';
    cookieState.version += 1;
    cookieState.storeCookie = '';
    cookieState.storeEtag = '';
    cookieState.storeMissing = false;
    cookieState.blobSyncedAt = 0;
    cookieState.blobRenewedAt = 0;
    cookieState.pendingRenewal = null;
    cookieState.obsolete.clear();
    cookieState.renewAttemptValue = '';
    cookieState.renewAttemptEtag = '';
};

exports.cookieReadWindowForTests = function cookieReadWindowForTests(config, startedAt, hasMemoryCookie) {
    const saved = cookieState.value;
    cookieState.value = hasMemoryCookie ? 'probe=1' : '';
    try {
        return cookieReadTimeoutMs(config, startedAt);
    } finally {
        cookieState.value = saved;
    }
};

exports.setBlobsModuleForTests = function setBlobsModuleForTests(blobsModule) {
    blobsModuleForTests = blobsModule || null;
};
