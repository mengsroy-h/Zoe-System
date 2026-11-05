'use strict';

const crypto = require('node:crypto');

const ORIGIN = 'https://aargus-api.ztoglobal.net';
const PALM_HOST = new URL(ORIGIN).hostname;
const BILL_INFO_PATH = '/zto/basic/v1/billInfoQuery';
const TRACK_INFO_PATH = '/zto/locus/v1/queryTrackInfo';
const SSO_SCAN_ORIGIN = 'https://aargus-api.ztoglobal.com';
const ZTO_KEEP_ALIVE_MS = 60000;
const GLOBAL_DISPATCHER = Symbol.for('undici.globalDispatcher.1');
const STALE_SOCKET_CODES = new Set(['UND_ERR_SOCKET', 'ECONNRESET', 'EPIPE']);
let ztoAgent = null;
const SESSION_HEADER = 'x-zoe-palm-token';
const SESSION_MS = 8 * 60 * 60 * 1000;
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
const BARCODE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const UPSTREAM_CODE_RE = /^[A-Za-z0-9_.:@-]{1,60}$/;
const AUTH_EXPIRED_RE = /^(?:401|403|not_login|token_expired|token_invalid|login_expired|login_required)$/i;
const DISPATCH_LIST_PATH = '/zto/dispatch/v1/queryDispatchList';
const SIGNED_STATUS = '5';
const RETURN_ACTION = '-710';

const SEND_OUT_ACTION = '2';
const MISPLACED_REASONS = ['ទីតាំងមិនត្រឹមត្រូវ', '地址不详', 'Incorrect location'];
const LIST_ROW_MAX = 200;
const LIST_TABS = ['3', '5'];
const PALM_TRACK_CONCURRENCY = 8;
const PALM_TRACKS_MAX = 30;
const PALM_READ_ATTEMPTS = 2;
const PALM_EMPTY_TRACK_READS = 2;
const PALM_RETRY_GAP_MS = 250;
const PALM_RETRY_MIN_MS = 1500;
const PALM_TRACK_MIN_MS = 1000;
const PALM_TRACK_TIMEOUT_MS = 3000;
const PALM_REASONS_MAX = 5;
const SHARED_KEY_PREFIX = 'palm-session/';
const SHARED_INDEX_PREFIX = 'palm-sites/';
const SHARED_SITES_MAX = 32;
const SITE_HEADER = 'x-zoe-palm-site';
const SHARED_SEAL_LABEL = 'zoew:palm:shared:v1:';
const SHARED_TEXT_MAX = 16384;
const SHARED_CACHE_TTL_MS = 60000;
const SHARED_MISSING_TTL_MS = 10000;
const SHARED_READ_TIMEOUT_MS = 3000;
const SHARED_WRITE_TIMEOUT_MS = 3000;
const SHARED_RENEW_AGE_MS = 4 * 60 * 60 * 1000;
const SHARED_SUSPECT_AGE_MS = 15 * 60 * 1000;
const SUSPECT_CODES = ['ZTO_UPSTREAM_REJECTED', 'ZTO_PALM_STATUS_UNCONFIRMED'];
const SUSPECT_SSO_REASON_RE = /^palm:(?:identity|arrival)-rejected$/;
const PALM_OUTAGE_CODES = ['SYSTEM_ERROR'];
const SHARED_RENEW_GAP_MS = 60000;
const SHARED_RENEW_CEILING_MS = 15000;
const SHARED_LOGIN_TIMEOUT_MS = 6000;
const SHARED_RETRY_MIN_MS = 2500;
const SHARED_RENEW_MIN_WAIT_MS = 2500;
const SHARED_LEASE_MS = 30000;
const PALM_FINAL_LOGIN_CODES = ['ZTO_PALM_LOGIN_REJECTED', 'ZTO_PALM_VERIFICATION_REQUIRED', 'ZTO_PALM_COUNTRY_UNSUPPORTED'];
const sharedSessions = new Map();
const sharedRenewals = new Map();
const sharedRenewFailedAt = new Map();
const sharedReading = new Set();
const sharedLoads = new Map();
const sharedIndexes = new Map();

function json(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function configError(reason) {
    return Object.assign(new Error('palm:config'), { reason });
}

function sessionKey(env, label = 'zoew:palm:v1:') {
    const secret = String(env.ZTO_PALM_SESSION_SECRET || '');
    if (secret.length < 32) throw configError('palm:session-secret');
    return crypto.createHash('sha256').update(label).update(secret).digest();
}

function refreshKey(env) {
    return sessionKey(env, 'zoew:palm:refresh:v1:');
}

function protocolKeys(env) {
    const sign = String(env.ZTO_PALM_SIGN_KEY || '');
    const password = Buffer.from(String(env.ZTO_PALM_PASSWORD_KEY || ''), 'utf8');
    if (!sign || sign.length > 256 || /[\r\n]/.test(sign)) throw configError('palm:sign-key');
    if (password.length !== 16) throw configError('palm:password-key');
    return { sign, password };
}

function binding(proxyKey) {
    return crypto.createHash('sha256').update(proxyKey).digest();
}

function sealSession(value, proxyKey, env, key = sessionKey(env)) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(binding(proxyKey));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

function openSealed(value, proxyKey, key, max = 8192) {
    if (typeof value !== 'string' || value.length > max || !/^[A-Za-z0-9_-]{40,}$/.test(value)) return null;
    try {
        const raw = Buffer.from(value, 'base64url');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
        decipher.setAAD(binding(proxyKey));
        decipher.setAuthTag(raw.subarray(12, 28));
        const data = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'));
        return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch (_) { return null; }
}

function openSession(value, proxyKey, env) {
    const data = openSealed(value, proxyKey, sessionKey(env));
    if (!data || typeof data.token !== 'string' || !data.token || /[\r\n]/.test(data.token)
        || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) throw new Error('session:invalid');
    return data;
}

function openRefresh(value, proxyKey, env) {
    const data = openSealed(value, proxyKey, refreshKey(env));
    if (!data || data.kind !== 'refresh' || typeof data.u !== 'string' || !data.u || data.u.length > 128 || /[\u0000-\u001f]/.test(data.u)
        || typeof data.p !== 'string' || !data.p || data.p.length > 1024 || typeof data.d !== 'string' || !/^[A-Za-z0-9-]{8,80}$/.test(data.d)
        || !Number.isFinite(data.exp) || data.exp <= Date.now()) return null;
    return data;
}

function passwordCipher(password, keys) {
    const cipher = crypto.createCipheriv('aes-128-ecb', keys.password, null);
    return Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]).toString('base64');
}

function upstreamReason(result) {
    const code = String(result.statusCode === undefined || result.statusCode === null ? '' : result.statusCode).trim();
    return UPSTREAM_CODE_RE.test(code) ? 'palm:' + code : 'palm:status';
}

function ztoDispatcher() {
    try {
        const current = globalThis[GLOBAL_DISPATCHER];
        const Agent = current ? current.constructor : null;
        if (typeof Agent !== 'function' || Agent.name !== 'Agent') return null;
        if (!ztoAgent || ztoAgent.Agent !== Agent) {
            ztoAgent = { Agent, dispatcher: new Agent({ keepAliveTimeout: ZTO_KEEP_ALIVE_MS, keepAliveMaxTimeout: ZTO_KEEP_ALIVE_MS }) };
        }
        return ztoAgent.dispatcher;
    } catch (_) { return null; }
}

function staleSocketError(error) {
    return !!error && error.name !== 'AbortError' && STALE_SOCKET_CODES.has(String((error.cause && error.cause.code) || ''));
}

async function ztoFetch(url, init, retryStale) {
    const dispatcher = ztoDispatcher();
    const sent = dispatcher ? Object.assign({}, init, { dispatcher }) : init;
    for (let attempt = 0; attempt < 2; attempt++) {
        try { return await fetch(url, sent); }
        catch (error) {
            if (error?.name === 'AbortError') throw error;
            if (!retryStale || attempt > 0 || (sent.signal && sent.signal.aborted) || !staleSocketError(error)) throw new Error('upstream:unavailable');
        }
    }
    throw new Error('upstream:unavailable');
}

function meterFor(deps, kind) {
    if (!deps || typeof deps.noteTiming !== 'function') return null;
    return (startedAt, timedOut) => {
        try { deps.noteTiming(kind, startedAt, timedOut); } catch (_) {}
    };
}

async function requestPalm(path, payload, token, keys, timeoutMs, meter, retryStale) {
    const body = JSON.stringify(payload);
    const headers = {
        'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json',
        'User-Agent': 'PDA', 'x-language': 'km_KH',
        'x-sign': crypto.createHash('md5').update(body + keys.sign, 'utf8').digest('base64')
    };
    if (['/zto/picture/v1/querySignPic', '/zto/basic/v1/saveBillPic', '/zto/basic/v1/saveScanInfo', '/zto/collect/v1/queryPreOrderByBillCode'].includes(path)) delete headers['x-language'];
    if (token) headers['x-token'] = token;
    const controller = new AbortController();
    const startedAt = Date.now();
    let timeout;
    const budget = new Promise((_, reject) => {
        timeout = setTimeout(() => {
            controller.abort();
            reject(Object.assign(new Error('upstream:timeout'), { name: 'AbortError' }));
        }, timeoutMs);
    });
    const init = { method: 'POST', headers, body, redirect: 'manual', signal: controller.signal };
    const work = (async () => {
        const response = await ztoFetch(ORIGIN + path, init, retryStale);
        if (response.status === 401 || response.status === 403) return { authRejected: true };
        if (response.status === 429) throw new Error('upstream:rate');
        if (response.status >= 500) throw new Error('upstream:unavailable');
        if (!response.ok) throw new Error('upstream:http');
        let result;
        try { result = await response.json(); } catch (_) { throw new Error('upstream:json'); }
        if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('upstream:json');
        return result;
    })();
    work.catch(() => {});
    try {
        return await Promise.race([work, budget]);
    } finally {
        clearTimeout(timeout);
        if (meter) meter(startedAt, controller.signal.aborted);
    }
}

function phoneText(raw, keys) {
    let value = String(raw || '').trim();
    if (!/^\+?[0-9 ()-]{6,32}$/.test(value)) {
        try {
            if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length > 256) return '';
            const decipher = crypto.createDecipheriv('aes-128-ecb', keys.password, null);
            value = Buffer.concat([decipher.update(Buffer.from(value, 'base64')), decipher.final()]).toString('utf8').trim();
        } catch (_) { return ''; }
    }
    return /^\+?[0-9 ()-]{6,32}$/.test(value) && !/^0+$/.test(value.replace(/\D/g, '')) ? value : '';
}

function lookupBody(result, barcode, keys, deps, diagnostic = false) {
    const row = result.result;
    if (row === null || row === undefined) return { success: false, found: false, barcode, code: 'ZTO_NOT_FOUND' };
    if (typeof row !== 'object' || Array.isArray(row)) throw new Error('upstream:json');
    const billCode = row.billCode === undefined || row.billCode === null ? '' : String(row.billCode).trim();
    if (billCode && billCode.toUpperCase() !== barcode.toUpperCase()) throw new Error('upstream:barcode');
    const phone = phoneText(row.consigneeMobile || row.consigneePhone || row.phone, keys);
    const fields = deps.project(row);
    if (!diagnostic && !phone && fields.cod === null && fields.dod === null) throw new Error('upstream:json');
    const body = {
        success: true, found: true, barcode, phone,
        cod: fields.cod === null ? 0 : fields.cod, dod: fields.dod === null ? 0 : fields.dod,
        ztoClosed: null, provider: 'zto-palm'
    };
    if (fields.branches) body.branches = fields.branches;
    return body;
}

function trackingStamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return '';
    const stamp = new Date(value.replace(' ', 'T') + 'Z');
    return Number.isFinite(stamp.getTime()) && stamp.toISOString().slice(0, 19).replace('T', ' ') === value ? value : '';
}

function trackingCode(value) {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function misplacedReason(value) {
    return typeof value === 'string' && MISPLACED_REASONS.includes(value.replace(/\p{Cf}/gu, '').trim());
}

function trackingVerdict(upstream, barcode, site) {
    const out = { ztoClosed: null, ztoArrivalAt: null, ztoSignedAt: null, ztoReturnedAt: null, ztoMisplacedAt: null, ztoSentOutAt: null };
    if (!Array.isArray(upstream.result) || !trackingCode(site)) return out;
    const code = trackingCode(barcode);
    const rows = upstream.result.filter((row) => trackingCode(row?.mail?.mailNo) === code);
    if (rows.length !== 1 || !Array.isArray(rows[0].tracks)) return out;
    let arrival = '';
    let signed = '';
    let returned = '';
    let sentOut = '';
    const problems = [];
    let complete = true;
    for (const track of rows[0].tracks) {
        const at = trackingStamp(track?.time);
        if (!track || trackingCode(track.mailNo) !== code || !at
            || (typeof track.action !== 'string' && typeof track.action !== 'number')) { complete = false; continue; }
        if (trackingCode(track.siteCode) !== trackingCode(site)) continue;
        const action = String(track.action);
        if (action === '3' && at > arrival) arrival = at;
        if (action === '5' && at > signed) signed = at;
        if (action === RETURN_ACTION && at > returned) returned = at;
        if (action === SEND_OUT_ACTION && at > sentOut) sentOut = at;
        if (misplacedReason(track.problemReason)) problems.push(at);
    }
    out.ztoArrivalAt = arrival || null;
    if (!complete) return out;
    if (rows[0].mail.isSign === 1 && signed && (!arrival || signed >= arrival)) {
        out.ztoClosed = true;
        out.ztoSignedAt = signed;
    } else if (rows[0].mail.isSign === 0 && arrival && (!signed || signed < arrival)) out.ztoClosed = false;
    if (returned && returned >= arrival && (!signed || returned > signed) && out.ztoClosed !== true) out.ztoReturnedAt = returned;
    else if (sentOut && arrival && sentOut >= arrival && (!signed || sentOut > signed) && out.ztoClosed !== true) {
        out.ztoReturnedAt = sentOut;
        if (problems.some((at) => at >= arrival && at <= sentOut)) out.ztoMisplacedAt = sentOut;
        else out.ztoSentOutAt = sentOut;
    }
    return out;
}

async function palmTracking(barcode, session, keys, deps) {
    const upstream = await requestPalm(TRACK_INFO_PATH, { mailType: 1, mailNos: barcode }, session.token, keys, deps.upstreamMs(), null, true);
    if (upstream.authRejected || AUTH_EXPIRED_RE.test(String(upstream.statusCode || ''))) {
        return { response: json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' }) };
    }
    if (upstream.status !== true) return { response: json(502, { code: 'ZTO_UPSTREAM_REJECTED', reason: upstreamReason(upstream) }) };
    return { upstream, verdict: trackingVerdict(upstream, barcode, session.site) };
}

function settleWithin(run, timeoutMs) {
    return new Promise((resolve) => {
        let done = false;
        let timer = null;
        const finish = (value) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(value);
        };
        timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), Math.max(0, timeoutMs));
        let pending;
        try { pending = run(); } catch (_) { finish({ ok: false, reason: 'throw' }); return; }
        Promise.resolve(pending).then((value) => finish({ ok: true, value }), () => finish({ ok: false, reason: 'error' }));
    });
}

function renewalWithinBudget(deps, run) {
    const waitMs = remainingOf(deps) - 1500;
    return waitMs >= SHARED_RENEW_MIN_WAIT_MS ? settleWithin(run, waitMs) : Promise.resolve({ ok: false, reason: 'budget' });
}

async function palmUpstreamLogin(credential, keys, timeoutMs) {
    const upstream = await requestPalm('/zto/system/v1/doLogin', {
        password: credential.cipher, equipment: 'ZoeW', timeZone: 'GMT+07:00',
        userName: credential.username, deviceSn: credential.deviceSn, version: '2.9.92'
    }, '', keys, timeoutMs);
    if (upstream.authRejected) return { final: 'ZTO_PALM_LOGIN_REJECTED', status: 401, reason: 'palm:http-auth' };
    if (upstream.statusCode === 'risk_control_account_captcha_err') return { final: 'ZTO_PALM_VERIFICATION_REQUIRED', status: 401 };
    if (upstream.status !== true && PALM_OUTAGE_CODES.includes(String(upstream.statusCode || ''))) {
        throw Object.assign(new Error('upstream:unavailable'), { palmReason: upstreamReason(upstream) });
    }
    if (upstream.status !== true) return { final: 'ZTO_PALM_LOGIN_REJECTED', status: 401, reason: upstreamReason(upstream) };
    const account = upstream.result;
    if (!account || typeof account.token !== 'string' || !account.token || account.token.length > 4096 || /[\r\n]/.test(account.token)) {
        throw new Error('upstream:json');
    }
    if (account.countryCode !== 'KH') return { final: 'ZTO_PALM_COUNTRY_UNSUPPORTED', status: 403 };
    return { ok: true, token: account.token, site: String(account.siteCode || '').slice(0, 64), siteName: String(account.siteName || '').slice(0, 120) };
}

function loginRefusal(login) {
    const body = { code: login.final };
    if (login.reason) body.reason = login.reason;
    return json(login.status, body);
}

function sharedStoreOf(deps) {
    if (!deps || typeof deps.blobStore !== 'function' || !deps.keyLabel) return null;
    try {
        const opened = deps.blobStore();
        return opened && opened.store ? opened.store : null;
    } catch (_) { return null; }
}

function openShared(text, proxyKey, env) {
    const data = openSealed(text, proxyKey, sessionKey(env, SHARED_SEAL_LABEL), SHARED_TEXT_MAX);
    if (!data) return null;
    const site = String(data.site || '').slice(0, 64);
    if (data.kind === 'rejected') return PALM_FINAL_LOGIN_CODES.includes(data.code) ? { kind: 'rejected', code: data.code, site, siteName: '' } : null;
    if (data.kind !== 'shared' || typeof data.token !== 'string' || !data.token || data.token.length > 4096 || /[\r\n]/.test(data.token)
        || !Number.isFinite(data.loginAt) || typeof data.u !== 'string' || !data.u || data.u.length > 128 || /[\u0000-\u001f]/.test(data.u)
        || typeof data.p !== 'string' || !data.p || data.p.length > 1024
        || typeof data.d !== 'string' || !/^[A-Za-z0-9-]{8,80}$/.test(data.d)) return null;
    const out = { kind: 'shared', token: data.token, site, siteName: String(data.siteName || '').slice(0, 120), loginAt: data.loginAt, u: data.u, p: data.p, d: data.d };
    if (Number.isFinite(data.leaseUntil)) out.leaseUntil = data.leaseUntil;
    return out;
}

function sharedView(data) {
    return { token: data.token, site: data.site, siteName: data.siteName, loginAt: data.loginAt, operator: data.u, source: 'shared' };
}

function rememberShared(label, data, etag, missing) {
    const prior = sharedSessions.get(label);
    const entry = { data, etag: etag || '', missing: !!missing, readAt: Date.now(), version: (prior ? prior.version : 0) + 1 };
    sharedSessions.set(label, entry);
    return entry;
}

function sharedEntryFresh(entry) {
    if (!entry) return false;
    const age = Date.now() - entry.readAt;
    return age >= 0 && age < (entry.data && entry.data.kind === 'shared' ? SHARED_CACHE_TTL_MS : SHARED_MISSING_TTL_MS);
}

async function readShared(label, store, proxyKey, env, timeoutMs) {
    const prior = sharedSessions.get(label);
    const version = prior ? prior.version : 0;
    const read = await settleWithin(() => store.getWithMetadata(SHARED_KEY_PREFIX + label, { type: 'text' }), timeoutMs);
    const current = sharedSessions.get(label) || null;
    if (!read.ok) return { ok: false, entry: current };
    if ((current ? current.version : 0) !== version) return { ok: true, entry: current };
    const raw = read.value;
    const text = raw && typeof raw.data === 'string' ? raw.data : '';
    return { ok: true, entry: rememberShared(label, text ? openShared(text, proxyKey, env) : null, raw && raw.etag, !raw) };
}

function refreshSharedInBackground(label, store, proxyKey, env) {
    if (sharedReading.has(label)) return;
    sharedReading.add(label);
    readShared(label, store, proxyKey, env, SHARED_READ_TIMEOUT_MS).catch(() => {}).then(() => sharedReading.delete(label));
}

function sharedReadTimeout(deps) {
    return Math.max(300, Math.min(SHARED_READ_TIMEOUT_MS, remainingOf(deps) - 1500));
}

async function sharedEntry(label, proxyKey, env, deps, canWait) {
    const store = sharedStoreOf(deps);
    const cached = sharedSessions.get(label) || null;
    if (!store || sharedEntryFresh(cached)) return cached;
    if (!canWait || (cached && cached.data && cached.data.kind === 'shared')) {
        refreshSharedInBackground(label, store, proxyKey, env);
        return cached;
    }
    const flightKey = label + '\0' + proxyKey;
    let loading = sharedLoads.get(flightKey);
    if (!loading) {
        loading = readShared(label, store, proxyKey, env, SHARED_READ_TIMEOUT_MS).finally(() => {
            if (sharedLoads.get(flightKey) === loading) sharedLoads.delete(flightKey);
        });
        sharedLoads.set(flightKey, loading);
    }
    const read = await settleWithin(() => loading, sharedReadTimeout(deps));
    return read.ok ? read.value.entry : sharedSessions.get(label) || null;
}

async function writeShared(label, data, store, proxyKey, env, condition) {
    const text = sealSession(data, proxyKey, env, sessionKey(env, SHARED_SEAL_LABEL));
    const options = { metadata: { at: Date.now() } };
    if (condition && condition.etag) options.onlyIfMatch = condition.etag;
    else if (condition && condition.fresh) options.onlyIfNew = true;
    const out = await settleWithin(() => store.set(SHARED_KEY_PREFIX + label, text, options), SHARED_WRITE_TIMEOUT_MS);
    if (!out.ok) return 'failed';
    if (out.value && out.value.modified === false) return 'conflict';
    rememberShared(label, openShared(text, proxyKey, env), out.value && typeof out.value.etag === 'string' ? out.value.etag : '', false);
    return 'ok';
}

async function runRenewShared(label, failedToken, store, proxyKey, keys, env, leased) {
    let entry = sharedSessions.get(label) || null;
    if (store) {
        const read = await readShared(label, store, proxyKey, env, SHARED_READ_TIMEOUT_MS);
        if (!read.ok && !entry) return { transient: 'palm:store' };
        if (leased && !read.ok) return { transient: 'palm:store' };
        entry = read.entry;
    }
    const data = entry && entry.data;
    if (!data) return { final: entry && entry.missing ? 'palm:no-session' : 'palm:unreadable' };
    if (data.kind === 'rejected') return { final: 'palm:login-rejected' };
    if (failedToken && data.token !== failedToken) return { session: sharedView(data) };
    if (leased) {
        if (!store || (Number.isFinite(data.leaseUntil) && data.leaseUntil > Date.now())) return { transient: 'palm:renew-leased' };
        const lease = Object.assign({}, data, { leaseUntil: Date.now() + SHARED_LEASE_MS });
        if (await writeShared(label, lease, store, proxyKey, env, { etag: entry.etag }) !== 'ok') return { transient: 'palm:renew-leased' };
        entry = sharedSessions.get(label);
    }
    const login = await palmUpstreamLogin({ username: data.u, cipher: data.p, deviceSn: data.d }, keys, SHARED_LOGIN_TIMEOUT_MS);
    const next = login.ok
        ? { kind: 'shared', token: login.token, site: login.site || data.site, siteName: login.siteName || data.siteName, loginAt: Date.now(), u: data.u, p: data.p, d: data.d }
        : { kind: 'rejected', code: login.final, site: data.site, at: Date.now() };
    const written = store ? await writeShared(label, next, store, proxyKey, env, { etag: entry.etag }) : 'failed';
    if (written === 'conflict') {
        const again = await readShared(label, store, proxyKey, env, SHARED_READ_TIMEOUT_MS);
        const theirs = again.entry && again.entry.data;
        if (theirs && theirs.kind === 'shared' && theirs.token !== failedToken) return { session: sharedView(theirs) };
        if (again.ok && !theirs) return { final: 'palm:no-session' };
        if (theirs && theirs.kind === 'rejected') return { final: 'palm:login-rejected' };
    } else if (written === 'failed') {
        rememberShared(label, next.kind === 'shared' ? next : { kind: 'rejected', code: next.code, site: next.site, siteName: '' }, entry.etag, false);
    }
    return login.ok ? { session: sharedView(next) } : { final: 'palm:login-rejected' };
}

function renewShared(label, failedToken, proxyKey, keys, env, deps, leased) {
    const flightKey = label + (leased ? '#age' : '#auth');
    const running = sharedRenewals.get(flightKey);
    if (running) return running;
    const failedAt = sharedRenewFailedAt.get(flightKey) || 0;
    const sinceFail = Date.now() - failedAt;
    if (failedAt && sinceFail >= 0 && sinceFail < SHARED_RENEW_GAP_MS) return Promise.resolve({ transient: 'palm:renew-wait' });
    const store = sharedStoreOf(deps);
    const flight = settleWithin(() => runRenewShared(label, failedToken, store, proxyKey, keys, env, leased), SHARED_RENEW_CEILING_MS).then((out) => {
        if (sharedRenewals.get(flightKey) === flight) sharedRenewals.delete(flightKey);
        const result = out.ok ? out.value : { transient: 'palm:renew-' + out.reason };
        if (result.transient) sharedRenewFailedAt.set(flightKey, Date.now());
        else sharedRenewFailedAt.delete(flightKey);
        return result;
    });
    sharedRenewals.set(flightKey, flight);
    return flight;
}

function slotSite(value) {
    const code = trackingCode(value);
    return /^[A-Z0-9_-]{1,32}$/.test(code) ? code : '';
}

function slotOf(deps, site) {
    const code = slotSite(site);
    return deps.keyLabel && code ? deps.keyLabel + '/' + code : '';
}

function indexSites(raw) {
    let parsed = null;
    try { parsed = JSON.parse(String(raw || '')); } catch (_) { parsed = null; }
    const out = [];
    for (const site of (parsed && Array.isArray(parsed.sites) ? parsed.sites : [])) {
        const code = slotSite(site);
        if (code && !out.includes(code) && out.length < SHARED_SITES_MAX) out.push(code);
    }
    return out;
}

async function readSiteIndex(label, store, timeoutMs, force) {
    const cached = sharedIndexes.get(label) || null;
    const age = cached ? Date.now() - cached.readAt : -1;
    if (!force && cached && age >= 0 && age < SHARED_CACHE_TTL_MS) return Object.assign({ ok: true }, cached);
    if (!force && cached && store && cached.sites.length) {
        if (!sharedReading.has('#' + label)) {
            sharedReading.add('#' + label);
            readSiteIndex(label, store, SHARED_READ_TIMEOUT_MS, true).catch(() => {}).then(() => sharedReading.delete('#' + label));
        }
        return Object.assign({ ok: true }, cached);
    }
    const read = store ? await settleWithin(() => store.getWithMetadata(SHARED_INDEX_PREFIX + label, { type: 'text' }), timeoutMs) : { ok: false };
    if (!read.ok) return cached ? Object.assign({ ok: !force }, cached) : { ok: false, sites: [], etag: '', missing: false };
    const entry = { sites: indexSites(read.value && read.value.data), etag: read.value && typeof read.value.etag === 'string' ? read.value.etag : '',
        missing: !read.value, readAt: Date.now() };
    sharedIndexes.set(label, entry);
    return Object.assign({ ok: true }, entry);
}

async function addSiteIndex(label, store, site, prefetched) {
    const code = slotSite(site);
    if (!store || !label || !code) return false;
    const cached = sharedIndexes.get(label);
    if (cached && !cached.missing && cached.sites.includes(code)) return true;
    for (let attempt = 0; attempt < 3; attempt++) {
        const current = attempt === 0 && prefetched ? await prefetched : await readSiteIndex(label, store, SHARED_READ_TIMEOUT_MS, true);
        if (!current.ok) return false;
        if (current.sites.includes(code)) return true;
        const sites = current.sites.concat(code).slice(-SHARED_SITES_MAX);
        const options = current.missing ? { onlyIfNew: true } : (current.etag ? { onlyIfMatch: current.etag } : {});
        const out = await settleWithin(() => store.set(SHARED_INDEX_PREFIX + label, JSON.stringify({ v: 1, sites }), options), SHARED_WRITE_TIMEOUT_MS);
        if (!out.ok) return false;
        if (out.value && out.value.modified === false) continue;
        sharedIndexes.set(label, { sites, etag: out.value && typeof out.value.etag === 'string' ? out.value.etag : '', missing: false, readAt: Date.now() });
        return true;
    }
    return false;
}

async function singleIndexedSite(deps, store) {
    if (!store || !deps.keyLabel) return { site: '', sites: [] };
    const index = await readSiteIndex(deps.keyLabel, store, sharedReadTimeout(deps), false);
    return { site: index.sites.length === 1 ? index.sites[0] : '', sites: index.sites };
}

async function resolvePalmSession(event, proxyKey, env, deps) {
    const header = deps.headerOf(event, SESSION_HEADER);
    let own = null;
    if (header) {
        try { own = Object.assign(openSession(header, proxyKey, env), { source: 'device' }); } catch (_) { own = null; }
    }
    const store = sharedStoreOf(deps);
    let site = slotSite(deps.headerOf(event, SITE_HEADER)) || (own ? slotSite(own.site) : '');
    let sites = [];
    if (!site && !own) ({ site, sites } = await singleIndexedSite(deps, store));
    const slot = slotOf(deps, site);
    const entry = slot ? await sharedEntry(slot, proxyKey, env, deps, !own) : null;
    const data = entry && entry.data;
    if (data && data.kind === 'shared') return { session: sharedView(data), entry, slot };
    if (own) return { session: own, entry, slot };
    const reason = data && data.kind === 'rejected' ? 'palm:login-rejected' : (!site && sites.length > 1 ? 'palm:branch-unknown' : 'palm:no-session');
    return { reason, entry, slot };
}

function clearRenewFailures(label) {
    sharedRenewFailedAt.delete(label + '#age');
    sharedRenewFailedAt.delete(label + '#auth');
}

function sessionReport(resolved) {
    const session = resolved.session;
    const data = resolved.entry && resolved.entry.data;
    return {
        source: session ? session.source : 'none',
        shared: !!(data && data.kind === 'shared'),
        rejected: !!(data && data.kind === 'rejected'),
        site: session ? String(session.site || '') : '',
        loginAgeMs: session && session.source === 'shared' ? Math.max(0, Date.now() - session.loginAt) : null
    };
}

function authExpired(response) {
    if (!response || response.statusCode !== 401) return false;
    try { return JSON.parse(response.body).code === 'ZTO_AUTH_EXPIRED'; } catch (_) { return false; }
}

function tokenSuspected(response, session) {
    const age = Date.now() - session.loginAt;
    if (!response || response.statusCode !== 502 || (age >= 0 && age < SHARED_SUSPECT_AGE_MS)) return false;
    let body;
    try { body = JSON.parse(response.body); } catch (_) { return false; }
    return !!body && (SUSPECT_CODES.includes(body.code) || (body.code === 'ZTO_INVALID_RESPONSE' && SUSPECT_SSO_REASON_RE.test(String(body.reason || ''))));
}

function sessionResponse(data, credential, proxyKey, env, shared) {
    const expiresAt = Date.now() + SESSION_MS;
    const refresh = { kind: 'refresh', u: credential.username, p: credential.cipher, d: credential.deviceSn, exp: Date.now() + REFRESH_MS };
    return json(200, {
        success: true, provider: 'zto-palm', expiresAt, shared,
        sessionToken: sealSession({ token: data.token, expiresAt, site: data.site, siteName: data.siteName, operator: data.u }, proxyKey, env),
        refreshToken: sealSession(refresh, proxyKey, env, refreshKey(env)),
        account: { siteCode: data.site, siteName: data.siteName }
    });
}

function otherBranch(access, site) {
    return !!(access && access.verified && trackingCode(access.site) && trackingCode(access.site) !== trackingCode(site));
}

function writeCondition(read) {
    if (!read || !read.ok) return null;
    return read.entry && !read.entry.missing ? { etag: read.entry.etag } : { fresh: true };
}

async function palmLogin(event, credential, proxyKey, keys, deps, env, joining) {
    const access = await deps.loginAccess();
    if (access && access.response) return access.response;
    const store = sharedStoreOf(deps);
    let readSlot = '';
    let read = null;
    if (store && joining) {
        readSlot = slotOf(deps, slotSite(deps.headerOf(event, SITE_HEADER)) || (await singleIndexedSite(deps, store)).site);
        if (readSlot) {
            read = await readShared(readSlot, store, proxyKey, env, sharedReadTimeout(deps));
            const data = read.ok && read.entry ? read.entry.data : null;
            if (data && data.kind === 'shared' && !otherBranch(access, data.site)) return sessionResponse(data, credential, proxyKey, env, true);
        }
    }
    const login = await palmUpstreamLogin(credential, keys, deps.upstreamMs());
    if (login.final) return loginRefusal(login);
    if (otherBranch(access, login.site)) return json(403, { code: 'ZTO_OTHER_BRANCH', reason: 'site:palm-other-branch' });
    const data = { kind: 'shared', token: login.token, site: login.site, siteName: login.siteName, loginAt: Date.now(),
        u: credential.username, p: credential.cipher, d: credential.deviceSn };
    const slot = slotOf(deps, login.site);
    let shared = false;
    if (store && slot) {
        const siteCode = slotSite(login.site);
        const cachedIndex = deps.keyLabel ? sharedIndexes.get(deps.keyLabel) : null;
        const indexKnown = !!(cachedIndex && !cachedIndex.missing && siteCode && cachedIndex.sites.includes(siteCode));
        const indexRead = !joining && deps.keyLabel && siteCode && !indexKnown
            ? readSiteIndex(deps.keyLabel, store, SHARED_READ_TIMEOUT_MS, true) : null;
        const condition = joining ? writeCondition(slot === readSlot && read ? read : await readShared(slot, store, proxyKey, env, sharedReadTimeout(deps))) : {};
        if (condition) shared = await writeShared(slot, data, store, proxyKey, env, condition) === 'ok';
        if (shared) {
            clearRenewFailures(slot);
            await addSiteIndex(deps.keyLabel, store, login.site, indexRead);
        }
    }
    return sessionResponse(data, credential, proxyKey, env, shared);
}

async function palmStatus(event, proxyKey, deps, env) {
    const access = await deps.loginAccess();
    if (access && access.response) return access.response;
    const store = sharedStoreOf(deps);
    if (!store) return json(503, { code: 'ZTO_PALM_STORE_UNAVAILABLE' });
    const identity = access && access.verified ? access.site : (typeof deps.identitySite === 'function' ? await deps.identitySite() : '');
    let site = slotSite(identity) || slotSite(deps.headerOf(event, SITE_HEADER));
    let sites = [];
    if (!site) {
        const index = await readSiteIndex(deps.keyLabel, store, sharedReadTimeout(deps), true);
        if (!index.ok) return json(503, { code: 'ZTO_PALM_STORE_UNAVAILABLE' });
        sites = index.sites;
        if (sites.length === 1) site = sites[0];
    }
    const body = { success: true, provider: 'zto-palm', shared: false, rejected: false };
    if (!site) {
        if (sites.length > 1) Object.assign(body, { branchUnknown: true, sites });
        return json(200, body);
    }
    const read = await readShared(slotOf(deps, site), store, proxyKey, env, sharedReadTimeout(deps));
    const data = read.entry && read.entry.data;
    if (!read.ok && !data) return json(503, { code: 'ZTO_PALM_STORE_UNAVAILABLE' });
    body.shared = !!(data && data.kind === 'shared');
    body.rejected = !!(data && data.kind === 'rejected');
    body.account = { siteCode: data ? data.site : site, siteName: data && data.siteName ? data.siteName : '' };
    if (body.shared) body.loginAgeMs = Math.max(0, Date.now() - data.loginAt);
    if (otherBranch(access, body.account.siteCode)) body.otherBranch = true;
    return json(200, body);
}

async function palmPost(event, query, proxyKey, keys, deps, env) {
    if (event.isBase64Encoded || typeof event.body !== 'string' || Buffer.byteLength(event.body) > 4096) {
        return json(400, { code: 'ZTO_PALM_LOGIN_INVALID' });
    }
    let input;
    try { input = JSON.parse(event.body); } catch (_) { return json(400, { code: 'ZTO_PALM_LOGIN_INVALID' }); }
    if (query.palm === 'refresh') {
        const sealed = openRefresh(input?.refreshToken, proxyKey, env);
        if (!sealed) return json(401, { code: 'ZTO_PALM_REFRESH_INVALID' });
        return await palmLogin(event, { username: sealed.u, cipher: sealed.p, deviceSn: sealed.d }, proxyKey, keys, deps, env, true);
    }
    const username = typeof input?.username === 'string' ? input.username.trim() : '';
    const password = typeof input?.password === 'string' ? input.password : '';
    const deviceSn = typeof input?.deviceSn === 'string' ? input.deviceSn : '';
    if (!username || username.length > 128 || !password || password.length > 256 || /[\u0000-\u001f]/.test(username)
        || !/^[A-Za-z0-9-]{8,80}$/.test(deviceSn)) return json(400, { code: 'ZTO_PALM_LOGIN_INVALID' });
    return await palmLogin(event, { username, cipher: passwordCipher(password, keys), deviceSn }, proxyKey, keys, deps, env, false);
}

async function palmHealth(session, keys, deps) {
    const access = await deps.lookupAccess();
    if (access && access.response) return access.response;
    if (otherBranch(access, session.site)) return json(403, { code: 'ZTO_OTHER_BRANCH', provider: 'zto-palm' });
    const upstream = await requestPalm(DISPATCH_LIST_PATH, { billStatus: '1', status: 0, pageNum: 1, pageSize: 1 }, session.token, keys,
        deps.upstreamMs(), null, true);
    if (upstream.authRejected || AUTH_EXPIRED_RE.test(String(upstream.statusCode || ''))) return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' });
    if (upstream.status !== true) return json(502, { code: 'ZTO_UPSTREAM_REJECTED', reason: upstreamReason(upstream) });
    return json(200, { success: true, provider: 'zto-palm', verified: true });
}

async function palmGet(query, session, keys, deps) {
    if (query.health === '1') return await palmHealth(session, keys, deps);
    if (query.list === '1') return await palmList(query, session, keys, deps);
    const barcode = String(query.barcode || '').trim();
    if (!BARCODE_RE.test(barcode)) return json(400, { code: 'ZTO_BARCODE_INVALID' });
    const access = await deps.lookupAccess();
    if (access && access.response) return access.response;
    if (otherBranch(access, session.site) && query.status !== '1') {
        return json(200, { success: false, found: false, barcode, code: 'ZTO_OTHER_BRANCH', reason: 'branch:palm-other-branch' });
    }
    if (query.status === '1') {
        if (access?.verified && trackingCode(access.site) !== trackingCode(session.site)) {
            return json(200, { success: false, found: false, barcode, code: 'ZTO_OTHER_BRANCH', reason: 'branch:other' });
        }
        const tracking = await palmTracking(barcode, session, keys, deps);
        if (tracking.response) return tracking.response;
        return json(200, { success: true, found: true, barcode, provider: 'zto-palm', ...tracking.verdict });
    }
    const upstream = await requestPalm(BILL_INFO_PATH, { billCode: barcode }, session.token, keys, deps.upstreamMs(),
        meterFor(deps, 'palmDetail'), true);
    if (upstream.authRejected || AUTH_EXPIRED_RE.test(String(upstream.statusCode || ''))) {
        return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' });
    }
    if (upstream.status !== true) return json(502, { code: 'ZTO_UPSTREAM_REJECTED', reason: upstreamReason(upstream) });
    const diagnostic = query.track === '1';
    const body = deps.finish(access, lookupBody(upstream, barcode, keys, deps, diagnostic), barcode);
    if (!diagnostic || body.found !== true) return json(200, body);
    const tracking = await palmTracking(barcode, session, keys, deps);
    if (tracking.response) return tracking.response;
    return json(200, { ...body, ...tracking.verdict, billInfoQuery: upstream, queryTrackInfo: tracking.upstream });
}

function palmSessionSso(session) {
    try {
        if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(session.token)) return '';
        const parts = session.token.split('.');
        if (parts.length !== 3) return '';
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        const subject = typeof payload.sub === 'string' ? JSON.parse(payload.sub) : payload.sub;
        const token = subject && subject.accessToken;
        return typeof token === 'string' && /^[A-Za-z0-9._~-]{8,2048}$/.test(token) ? token : '';
    } catch (_) { return ''; }
}

async function palmSsoRead(path, method, payload, session, sso, deps) {
    const timeoutMs = Math.min(3000, remainingOf(deps));
    if (timeoutMs < 500) return { state: 'budget' };
    const controller = new AbortController();
    try {
        const read = await settleWithin(async () => {
            const headers = { Accept: 'application/json', 'Content-Type': 'application/json', 'Accept-Language': 'km', 'User-Language': 'km',
                Cookie: 'PDA_USER_COOKIE_01=' + session.token + '; PDA_SSO_COOKIE_01=' + sso };
            const init = { method, headers, redirect: 'manual', signal: controller.signal };
            if (payload) init.body = JSON.stringify(payload);
            const response = await ztoFetch(SSO_SCAN_ORIGIN + path, init, true);
            if (!response.ok) return { state: 'http', httpStatus: response.status };
            const text = await response.text();
            if (text.length > 1048576) return { state: 'oversize' };
            let parsed;
            try { parsed = JSON.parse(text); } catch (_) { return { state: 'invalid-json' }; }
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { state: 'invalid-json' };
            if (parsed.success !== true) return { state: 'rejected' };
            return { state: 'ok', body: parsed };
        }, timeoutMs);
        return read.ok ? read.value : { state: read.reason === 'timeout' ? 'timeout' : 'unavailable' };
    } finally { controller.abort(); }
}

function palmSsoFailure(read, stage) {
    const auth = read.httpStatus === 401 || read.httpStatus === 403 || read.state === 'session-sso-missing';
    const timeout = read.state === 'timeout' || read.state === 'budget';
    const rate = read.httpStatus === 429;
    return { response: json(auth ? 401 : timeout ? 504 : rate ? 429 : 502, {
        code: auth ? 'ZTO_AUTH_EXPIRED' : timeout ? 'ZTO_TIMEOUT' : rate ? 'ZTO_RATE_LIMITED' : 'ZTO_INVALID_RESPONSE',
        provider: 'zto-palm', reason: 'palm:' + stage + '-' + read.state
    }) };
}

async function palmArrivalPage(range, page, session, keys, deps) {
    const sso = palmSessionSso(session);
    if (!sso) return palmSsoFailure({ state: 'session-sso-missing' }, 'arrival');
    const identity = await palmSsoRead('/getUserInfo', 'GET', null, session, sso, deps);
    if (identity.state !== 'ok') return palmSsoFailure(identity, 'identity');
    const account = identity.body.data;
    if (!account || typeof account !== 'object' || trackingCode(account.siteCode) !== trackingCode(session.site)) {
        return palmSsoFailure({ state: 'unverified' }, 'identity');
    }
    const plan = deps.arrivalPlan(session.site, range, page);
    let scan;
    for (let attempt = 0; attempt < PALM_READ_ATTEMPTS; attempt++) {
        scan = await palmSsoRead('/scan/page/scan', 'POST', plan.body, session, sso, deps);
        if (scan.state === 'ok' || scan.httpStatus === 401 || scan.httpStatus === 403 || scan.httpStatus === 429) break;
        if (remainingOf(deps) < PALM_RETRY_MIN_MS + PALM_RETRY_GAP_MS) break;
        if (attempt + 1 < PALM_READ_ATTEMPTS) await pause(PALM_RETRY_GAP_MS);
    }
    if (scan.state !== 'ok') return palmSsoFailure(scan, 'arrival');
    const data = scan.body.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw invalidPalmResponse('list-3-result');
    if (data.total != null && !(typeof data.total === 'number' && Number.isSafeInteger(data.total) && data.total >= 0
        || typeof data.total === 'string' && /^\d+$/.test(data.total) && Number.isSafeInteger(Number(data.total)))) throw invalidPalmResponse('list-3-total');
    if (Object.hasOwn(data, 'total') && data.total === null) throw invalidPalmResponse('list-3-total');
    if (data.pageNum != null && Number(data.pageNum) !== page) throw invalidPalmResponse('list-3-page');
    const current = candidatePage({ result: { ...data, list: data.result } }, page, plan.body.pageSize, '3');
    if (data.total != null) {
        const served = Number(data.pageSize);
        const size = Number.isInteger(served) && served > 0 && served < plan.body.pageSize ? served : plan.body.pageSize;
        const total = Number(data.total);
        const expected = Math.max(0, Math.min(size, total - (page - 1) * size));
        if (current.list.length < expected) throw invalidPalmResponse('list-3-truncated');
        current.pages = Math.max(current.pages, Math.ceil(total / size));
    }
    if (current.list.some((row) => row && row.scanSiteCode && trackingCode(row.scanSiteCode) !== trackingCode(session.site))) {
        throw invalidPalmResponse('list-3-site');
    }
    const projected = plan.extract({ ...scan.body, data: { ...data, result: current.list } });
    if (!projected || !Array.isArray(projected.rows)) throw invalidPalmResponse('list-3-result');
    const clean = (value) => typeof value === 'string' ? value.split(session.token).join('').split(sso).join('') : value;
    const list = projected.rows.map((row) => ({ barcode: clean(row.barcode), phone: phoneText(clean(row.phone), keys),
        cod: row.cod, dod: row.dod, from: originText(clean(row.from)) }));
    return { kind: 'ok', list, pages: current.pages, otherScans: projected.otherScans + projected.signedScans };
}

function palmFailure(error) {
    if (error?.palmResponse) return error.palmResponse;
    const reason = error?.message;
    if (reason === 'palm:config') return json(503, { code: 'ZTO_PALM_NOT_CONFIGURED', reason: error.reason });
    if (reason === 'session:invalid') return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' });
    if (reason === 'upstream:rate') return json(429, { code: 'ZTO_RATE_LIMITED' });
    if (error?.name === 'AbortError') return json(504, { code: 'ZTO_TIMEOUT' });
    const diagnostic = error?.palmReason ? { reason: error.palmReason } : {};
    if (BARCODE_RE.test(error?.palmBarcode || '')) diagnostic.barcode = error.palmBarcode;
    return json(502, { code: reason === 'upstream:unavailable' ? 'ZTO_UNAVAILABLE' : 'ZTO_INVALID_RESPONSE', ...diagnostic });
}

function branchDeps(proxyKey, keys, deps, env) {
    return Object.assign({}, deps, {
        branchSession: async (site) => {
            const slot = slotOf(deps, site);
            const entry = slot ? await sharedEntry(slot, proxyKey, env, deps, true) : null;
            return entry && entry.data && entry.data.kind === 'shared' ? sharedView(entry.data) : null;
        },
        renewBranch: async (site, token) => {
            const slot = slotOf(deps, site);
            if (!slot) return null;
            const waited = await renewalWithinBudget(deps, () => renewShared(slot, token, proxyKey, keys, env, deps));
            return waited.ok ? waited.value : null;
        }
    });
}

async function palmGetShared(query, resolved, proxyKey, keys, rawDeps, env) {
    const session = resolved.session;
    const deps = branchDeps(proxyKey, keys, rawDeps, env);
    let response;
    try { response = await palmGet(query, session, keys, deps); } catch (error) { response = palmFailure(error); }
    if (session.source !== 'shared') return response;
    const label = resolved.slot;
    const expired = authExpired(response);
    if (!expired && !tokenSuspected(response, session)) {
        const age = Date.now() - session.loginAt;
        if (age >= SHARED_RENEW_AGE_MS || age < 0) renewShared(label, session.token, proxyKey, keys, env, deps, true).catch(() => {});
        return response;
    }
    const waited = await renewalWithinBudget(deps, () => renewShared(label, session.token, proxyKey, keys, env, deps));
    const renewed = waited.ok ? waited.value : { transient: 'palm:renewing' };
    if (renewed.session && remainingOf(deps) >= SHARED_RETRY_MIN_MS) return await palmGet(query, renewed.session, keys, deps);
    if (!expired && !renewed.session && !renewed.final) return response;
    if (renewed.final) return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm', reason: renewed.final });
    return json(503, { code: 'ZTO_UNAVAILABLE', provider: 'zto-palm', reason: renewed.session ? 'palm:renewed' : 'palm:renewing' });
}

async function handlePalm(event, query, proxyKey, deps, env = process.env) {
    try {
        sessionKey(env);
        const keys = protocolKeys(env);
        if (event.httpMethod === 'POST' && query.palm === 'sign') {
            const resolved = await resolvePalmSession(event, proxyKey, env, deps);
            if (!resolved.session) return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm', reason: resolved.reason });
            const sign = require('./zto-palm-sign');
            const run = (session) => sign.signPalm(event, session, deps,
                (path, payload) => requestPalm(path, payload, session.token, keys, deps.upstreamMs(), null, path === TRACK_INFO_PATH),
                { seal: (value) => sealSession(value, proxyKey, env), open: (value) => openSealed(value, proxyKey, sessionKey(env)), stamp: trackingStamp, verdict: trackingVerdict });
            const response = await run(resolved.session);
            if (resolved.session.source !== 'shared' || !sign.isStatusRequest(event)
                || !(authExpired(response) || tokenSuspected(response, resolved.session))) return response;
            const waited = await renewalWithinBudget(deps, () => renewShared(resolved.slot, resolved.session.token, proxyKey, keys, env, deps));
            const renewed = waited.ok ? waited.value : null;
            return renewed && renewed.session && remainingOf(deps) >= SHARED_RETRY_MIN_MS ? await run(renewed.session) : response;
        }
        if (event.httpMethod === 'POST' && isPalmPost(query)) return await palmPost(event, query, proxyKey, keys, deps, env);
        if (event.httpMethod !== 'GET') return json(405, { code: 'ZTO_PALM_METHOD_INVALID' });
        if (query.palm === 'status') return await palmStatus(event, proxyKey, deps, env);
        const resolved = await resolvePalmSession(event, proxyKey, env, deps);
        if (query.diag === '1') {
            if (query.verify === '1') {
                if (!resolved.session) return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm', reason: resolved.reason });
                const checked = await palmGetShared({ health: '1' }, resolved, proxyKey, keys, deps, env);
                if (checked.statusCode !== 200) return checked;
            }
            const body = { success: true, provider: 'zto-palm', configured: true, session: sessionReport(resolved) };
            if (query.verify === '1') body.verified = true;
            if (typeof deps.timingReport === 'function') body.upstreamTiming = deps.timingReport();
            if (typeof deps.runtimeReport === 'function') body.runtime = deps.runtimeReport();
            return json(200, body);
        }
        if (!resolved.session) return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm', reason: resolved.reason });
        return await palmGetShared(query, resolved, proxyKey, keys, deps, env);
    } catch (error) {
        return palmFailure(error);
    }
}

function isPalmPost(query) {
    return !!query && (query.palm === 'login' || query.palm === 'refresh' || query.palm === 'sign');
}

function isPalmQuery(query) {
    return !!query && (query.palm === '1' || query.palm === 'status' || isPalmPost(query));
}

function resetSharedForTests() {
    sharedIndexes.clear();
    sharedSessions.clear();
    sharedRenewals.clear();
    sharedRenewFailedAt.clear();
    sharedReading.clear();
    sharedLoads.clear();
}

function listRequest(range, page, deps) {
    return { billStatus: SIGNED_STATUS, signSiteDateFrom: range.start, signSiteDateTo: range.end, pageNum: page, pageSize: deps.listPageSize };
}

function numericCount(value) {
    if (typeof value === 'number') return Number.isInteger(value) && value >= 0 ? value : null;
    return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null;
}

function pageIsPastEnd(page, pages, total, size) {
    if (total !== null) return (page - 1) * size >= total;
    return pages !== null && page > pages;
}

function signedListBody(page, session, result, keys, deps) {
    const container = result.result;
    if (!container || typeof container !== 'object' || Array.isArray(container)) throw new Error('upstream:json');
    const reported = numericCount(container.pages);
    const reportedTotal = numericCount(container.total);
    const servedSize = Number(container.pageSize);
    const pageSize = Number.isInteger(servedSize) && servedSize > 0 && servedSize < deps.listPageSize ? servedSize : deps.listPageSize;
    const empty = container.list == null && pageIsPastEnd(page, reported, reportedTotal, pageSize);
    const list = empty ? [] : container.list;
    if (!Array.isArray(list) || list.length > LIST_ROW_MAX) throw new Error('upstream:json');
    if (!list.length && reportedTotal !== null && !pageIsPastEnd(page, reported, reportedTotal, pageSize)) throw new Error('upstream:json');
    const signed = [];
    const seen = new Set();
    const signedRows = [];
    let otherScans = 0;
    let signedScans = 0;
    for (let i = 0; i < list.length; i++) {
        const raw = list[i];
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('upstream:json');
        const barcode = String(raw.billCode === undefined || raw.billCode === null ? '' : raw.billCode).trim();
        const status = String(raw.billStatus === undefined || raw.billStatus === null ? '' : raw.billStatus).trim();
        if (!BARCODE_RE.test(barcode)) throw new Error('upstream:json');
        if (status !== SIGNED_STATUS) { otherScans++; continue; }
        signedScans++;
        if (seen.has(barcode)) continue;
        seen.add(barcode);
        signed.push(barcode);
        const fields = deps.project(raw);
        signedRows.push({
            barcode, phone: phoneText(raw.consigneeMobile || raw.consigneePhone, keys),
            cod: fields.cod === null ? 0 : fields.cod, dod: fields.dod === null ? 0 : fields.dod, at: '', from: ''
        });
    }
    const counted = otherScans + signedScans;
    const pagesKnown = reported !== null && !(list.length && page > reported) && !(reportedTotal !== null && reportedTotal > reported * pageSize);
    const readOn = list.length >= pageSize || (reportedTotal !== null && reportedTotal > (page - 1) * pageSize + list.length);
    const body = {
        success: true, list: true, enabled: true, kind: 'signed', page,
        site: String(session.site || ''), siteName: String(session.siteName || ''),
        pages: pagesKnown ? reported : (readOn ? page + 1 : (counted ? page : page - 1)),
        total: reportedTotal !== null ? reportedTotal : counted,
        rows: [], otherScans, signedScans, signedMismatch: 0,
        signed, signedOk: true, signedRows, provider: 'zto-palm'
    };
    if (!pagesKnown && readOn) body.pagesUnknown = true;
    return body;
}

async function palmSignedPage(range, page, session, keys, deps) {
    const upstream = await requestPalm(DISPATCH_LIST_PATH, listRequest(range, page, deps), session.token, keys, deps.upstreamMs(),
        meterFor(deps, 'palmSigned'), true);
    if (upstream.authRejected || AUTH_EXPIRED_RE.test(String(upstream.statusCode || ''))) return { kind: 'auth' };
    if (upstream.status !== true) return { kind: 'rejected', reason: upstreamReason(upstream) };
    return { kind: 'ok', body: signedListBody(page, session, upstream, keys, deps) };
}

function listFailure(outcome) {
    if (outcome.kind === 'auth') return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' });
    return json(502, { code: 'ZTO_UPSTREAM_REJECTED', reason: outcome.reason });
}

function invalidPalmResponse(reason, barcode) {
    return Object.assign(new Error('upstream:json'), { palmReason: 'palm:' + reason, palmBarcode: barcode || '' });
}

function candidatePage(upstream, page, requestedSize, kind) {
    const container = upstream.result;
    if (!container || typeof container !== 'object' || Array.isArray(container)) throw invalidPalmResponse('list-' + kind + '-result');
    const servedSize = Number(container.pageSize);
    const pageSize = Number.isInteger(servedSize) && servedSize > 0 && servedSize < requestedSize ? servedSize : requestedSize;
    const reported = numericCount(container.pages);
    const total = numericCount(container.total);
    const empty = container.list == null && pageIsPastEnd(page, reported, total, pageSize);
    const list = empty ? [] : container.list;
    if (!Array.isArray(list) || list.length > LIST_ROW_MAX) {
        const shape = list === null ? 'null' : Array.isArray(list) ? 'large' : typeof list;
        throw invalidPalmResponse('list-' + kind + '-items-' + shape + '-p' + page);
    }
    if (reported === 0 && list.length) throw invalidPalmResponse('list-' + kind + '-pages');
    if (!list.length && total !== null && !pageIsPastEnd(page, reported, total, pageSize)) throw invalidPalmResponse('list-' + kind + '-count');
    const known = reported !== null && !(list.length && page > reported) && !(total !== null && total > reported * pageSize);
    const readOn = list.length >= pageSize || (total !== null && total > (page - 1) * pageSize + list.length);
    return { list, pages: known ? reported : (readOn ? page + 1 : (list.length ? page : page - 1)), unknown: !known && readOn };
}

function remainingOf(deps) {
    return typeof deps.remainingMs === 'function' ? deps.remainingMs() : Infinity;
}

function pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function readFailureReason(error) {
    if (error?.name === 'AbortError') return 'palm:timeout';
    if (error?.message === 'upstream:rate') return 'palm:rate';
    if (error?.message === 'upstream:json') return 'palm:json';
    if (error?.message === 'upstream:http') return 'palm:http';
    return 'palm:unavailable';
}

async function palmRead(path, payload, session, keys, deps, tally, maxTimeoutMs) {
    let last = null;
    for (let attempt = 0; attempt < PALM_READ_ATTEMPTS; attempt++) {
        if (attempt > 0) {
            if (remainingOf(deps) < PALM_RETRY_MIN_MS + PALM_RETRY_GAP_MS) break;
            await pause(PALM_RETRY_GAP_MS);
        }
        const startedAt = Date.now();
        const timeoutMs = maxTimeoutMs ? Math.min(maxTimeoutMs, deps.upstreamMs()) : deps.upstreamMs();
        try {
            const upstream = await requestPalm(path, payload, session.token, keys, timeoutMs, null, true);
            if (upstream.authRejected || AUTH_EXPIRED_RE.test(String(upstream.statusCode || ''))) return { kind: 'auth' };
            if (upstream.status === true) return { kind: 'ok', upstream };
            last = { kind: 'rejected', reason: upstreamReason(upstream) };
        } catch (error) {
            last = { kind: 'failed', reason: readFailureReason(error) };
        } finally {
            if (tally) {
                tally.calls++;
                tally.waitMs += Math.max(0, Date.now() - startedAt);
            }
        }
    }
    return last || { kind: 'failed', reason: 'palm:budget' };
}

function listReadFailure(outcome, tab) {
    if (outcome.kind === 'auth') return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' });
    if (outcome.kind === 'rejected') return json(502, { code: 'ZTO_UPSTREAM_REJECTED', reason: outcome.reason });
    if (outcome.reason === 'palm:rate') return json(429, { code: 'ZTO_RATE_LIMITED' });
    const detail = 'palm:list-' + tab + '-' + outcome.reason.slice(5);
    if (outcome.reason === 'palm:timeout' || outcome.reason === 'palm:budget') return json(504, { code: 'ZTO_TIMEOUT', reason: detail });
    return json(502, { code: outcome.reason === 'palm:unavailable' ? 'ZTO_UNAVAILABLE' : 'ZTO_INVALID_RESPONSE', reason: detail });
}

function originText(raw) {
    return typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) : '';
}

function palmOrigin(raw, tracks) {
    const direct = originText(raw.recSite) || originText(raw.customerCodeDesc);
    if (direct) return direct;
    const pickups = tracks.filter((track) => String(track.action) === '1').sort((a, b) => a.time.localeCompare(b.time));
    const pickup = pickups[0];
    if (!pickup) return '';
    for (const field of ['msgLoc', 'msgEng']) {
        const label = typeof pickup[field] === 'string' ? pickup[field].match(/【([^【】]+)】/) : null;
        const text = label ? originText(label[1]) : '';
        if (text) return text;
    }
    return originText(pickup.siteName);
}

function trackGroupCode(group) {
    return trackingCode(group?.mail?.mailNo) || trackingCode(group?.mailNo);
}

function listTrackStamp(value) {
    const match = typeof value === 'string' ? /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d{1,6})?$/.exec(value.trim()) : null;
    return match ? trackingStamp(match[1] + ' ' + match[2]) : '';
}

function trackSignFlag(groups) {
    for (const group of groups) {
        const value = group?.mail?.isSign;
        if (value === 1 || value === '1') return 1;
        if (value === 0 || value === '0') return 0;
    }
    return null;
}

function trackEvidence(upstream, barcode, site) {
    if (!Array.isArray(upstream.result)) return { kind: 'invalid', reason: 'palm:track-result' };
    const code = trackingCode(barcode);
    const groups = upstream.result.filter((group) => group && typeof group === 'object' && Array.isArray(group.tracks));
    let own = groups.filter((group) => trackGroupCode(group) === code);
    if (!own.length) own = groups.filter((group) => !trackGroupCode(group) && group.tracks.some((track) => trackingCode(track?.mailNo) === code));
    if (!own.length) return upstream.result.length ? { kind: 'invalid', reason: 'palm:track-identity' } : { kind: 'empty' };
    const here = trackingCode(site);
    const tracks = [];
    let malformed = '';
    for (const group of own) {
        const identity = trackGroupCode(group);
        for (const track of group.tracks) {
            if (!track || typeof track !== 'object' || Array.isArray(track)) continue;
            const mailNo = trackingCode(track.mailNo);
            if (mailNo ? mailNo !== code : identity !== code) continue;
            const time = listTrackStamp(track.time);
            if (!time) { malformed = malformed || 'palm:track-time'; continue; }
            if (typeof track.action !== 'string' && typeof track.action !== 'number') { malformed = malformed || 'palm:track-action'; continue; }
            tracks.push({ track, time, action: String(track.action).trim(), here: !!here && trackingCode(track.siteCode) === here });
        }
    }
    if (!tracks.length) return malformed ? { kind: 'invalid', reason: malformed } : { kind: 'empty' };
    let arrival = '';
    let signed = '';
    let returned = '';
    let sentOut = '';
    const problems = [];
    let siteName = '';
    let siteNameAt = '';
    for (const entry of tracks) {
        if (!entry.here) continue;
        if (entry.action === '3' && entry.time > arrival) arrival = entry.time;
        if (entry.action === '5' && entry.time > signed) signed = entry.time;
        if (entry.action === RETURN_ACTION && entry.time > returned) returned = entry.time;
        if (entry.action === SEND_OUT_ACTION && entry.time > sentOut) sentOut = entry.time;
        if (misplacedReason(entry.track.problemReason)) problems.push(entry.time);
        const name = originText(entry.track.siteName).slice(0, 120);
        if (name && entry.time >= siteNameAt) {
            siteName = name;
            siteNameAt = entry.time;
        }
    }
    const flag = trackSignFlag(own);
    let ztoClosed = null;
    if (signed && (!arrival || signed >= arrival)) {
        if (flag !== 0) ztoClosed = true;
    } else if (arrival && flag === 0) {
        ztoClosed = false;
    }
    const back = returned && returned >= arrival && (!signed || returned > signed) ? returned : '';
    const leftAt = !back && sentOut && arrival && sentOut >= arrival && (!signed || sentOut > signed) && ztoClosed !== true ? sentOut : '';
    const sentOutAt = leftAt && !problems.some((at) => at >= arrival && at <= leftAt) ? leftAt : '';
    return { kind: 'ok', tracks, ztoClosed, signedAt: ztoClosed === true ? signed : '', siteName,
        returnedAt: back || leftAt, misplacedAt: sentOutAt ? '' : leftAt, sentOutAt };
}

async function palmTrackJob(barcode, session, keys, deps, tally) {
    for (let round = 0; round < PALM_EMPTY_TRACK_READS; round++) {
        if (round > 0 && remainingOf(deps) < PALM_RETRY_MIN_MS) break;
        const read = await palmRead(TRACK_INFO_PATH, { mailType: 1, mailNos: barcode }, session, keys, deps, tally, PALM_TRACK_TIMEOUT_MS);
        if (read.kind !== 'ok') return read;
        const evidence = trackEvidence(read.upstream, barcode, session.site);
        if (evidence.kind === 'ok') return { kind: 'ok', evidence };
        if (evidence.kind === 'invalid') return { kind: 'invalid', reason: evidence.reason };
    }
    return { kind: 'invalid', reason: 'palm:track-empty' };
}


function listBillCode(raw) {
    const value = raw && typeof raw === 'object' ? raw.billCode : null;
    return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

async function palmCandidates(range, page, session, keys, deps, tabs) {
    const outcomes = await Promise.all(tabs.map(async (tab) => {
        if (tab === '3') return await palmArrivalPage(range, page, session, keys, deps);
        const read = await palmRead(DISPATCH_LIST_PATH, listRequest(deps.listSignedRange(range), page, deps), session, keys, deps);
        if (read.kind !== 'ok') return { response: listReadFailure(read, tab) };
        const current = candidatePage(read.upstream, page, deps.listPageSize, tab);
        return { kind: 'ok', pages: current.pages, otherScans: 0, list: current.list.map((raw) => {
            const fields = deps.project(raw);
            return { barcode: listBillCode(raw), phone: phoneText(raw && (raw.consigneeMobile || raw.consigneePhone), keys),
                cod: fields.cod === null ? 0 : fields.cod, dod: fields.dod === null ? 0 : fields.dod,
                from: originText(raw && raw.recSite) || originText(raw && raw.customerCodeDesc) };
        }) };
    }));
    const failure = outcomes.find((outcome) => outcome.response && outcome.response.statusCode === 401)
        || outcomes.find((outcome) => outcome.response);
    if (failure) return failure.response;
    const tabPages = {};
    const candidates = [];
    const seen = new Set();
    let otherScans = 0;
    outcomes.forEach((outcome, index) => {
        tabPages[tabs[index]] = outcome.pages;
        otherScans += outcome.otherScans;
        for (const row of outcome.list) {
            const code = trackingCode(row.barcode);
            if (seen.has(code)) continue;
            seen.add(code);
            if (!BARCODE_RE.test(row.barcode)) { otherScans++; continue; }
            candidates.push(row);
        }
    });
    return json(200, {
        success: true, list: true, enabled: true, kind: 'candidates', page,
        site: session.site, siteName: session.siteName || '', pages: Math.max(0, ...Object.values(tabPages)), tabPages,
        candidates, rows: [], otherScans, provider: 'zto-palm'
    });
}

async function eachLimited(items, limit, run) {
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            await run(items[index], index);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function trackReport(evidence, barcode, range, signedEnd) {
    const arrivals = [];
    for (const entry of evidence.tracks) {
        if (!entry.here || entry.action !== '3' || entry.time < range.start || entry.time > range.end || arrivals.includes(entry.time)) continue;
        arrivals.push(entry.time);
    }
    const signedAt = evidence.ztoClosed === true && evidence.signedAt >= range.start && evidence.signedAt <= signedEnd ? evidence.signedAt : '';
    return { barcode, arrivals, ztoClosed: evidence.ztoClosed, signedAt, returnedAt: evidence.returnedAt,
        misplacedAt: evidence.misplacedAt, sentOutAt: evidence.sentOutAt,
        from: palmOrigin({}, evidence.tracks.map((entry) => ({ ...entry.track, time: entry.time }))) };
}

async function palmTracks(range, codes, session, keys, deps) {
    const signedRange = deps.listSignedRange(range);
    const found = new Map();
    const tally = { calls: 0, waitMs: 0 };
    const unverified = [];
    const reasons = new Set();
    let authLost = false;
    await eachLimited(codes, PALM_TRACK_CONCURRENCY, async (code) => {
        if (authLost) return;
        if (remainingOf(deps) < PALM_TRACK_MIN_MS) {
            unverified.push(code);
            reasons.add('palm:budget');
            return;
        }
        const outcome = await palmTrackJob(code, session, keys, deps, tally);
        if (outcome.kind === 'auth') { authLost = true; return; }
        if (outcome.kind === 'ok') found.set(code, outcome.evidence);
        else { unverified.push(code); reasons.add(outcome.reason); }
    });
    if (authLost) return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' });
    const seen = codes.find((code) => found.has(code) && found.get(code).siteName);
    return json(200, {
        success: true, list: true, enabled: true, kind: 'tracks', site: session.site,
        siteName: session.siteName || (seen ? found.get(seen).siteName : ''),
        rows: [], evidence: codes.filter((code) => found.has(code)).map((code) => trackReport(found.get(code), code, range, signedRange.end)),
        unverified: codes.filter((code) => unverified.includes(code)), unverifiedReasons: Array.from(reasons).slice(0, PALM_REASONS_MAX),
        trackCalls: tally.calls, trackWaitMs: tally.waitMs, provider: 'zto-palm'
    });
}

function listTabs(text) {
    if (text === undefined || text === null || text === '') return LIST_TABS.slice();
    const parts = String(text).split(',').map((part) => part.trim());
    if (!parts.length || parts.some((part) => !LIST_TABS.includes(part)) || new Set(parts).size !== parts.length) return null;
    return LIST_TABS.filter((tab) => parts.includes(tab));
}

function listTrackCodes(text) {
    if (typeof text !== 'string' || !text) return null;
    const parts = text.split(',').map((part) => part.trim());
    if (parts.length > PALM_TRACKS_MAX || parts.some((part) => !BARCODE_RE.test(part))
        || new Set(parts.map(trackingCode)).size !== parts.length) return null;
    return parts;
}

async function palmList(query, session, keys, deps) {
    const range = deps.listRange(query.from, query.to);
    if (!range) return json(400, { error: 'Invalid list date range', code: 'ZTO_LIST_RANGE_INVALID' });
    const page = Number(String(query.page || '1').trim());
    if (!Number.isInteger(page) || page < 1 || page > (query.signed === '1' ? deps.listMaxPages : 1000)) {
        return json(400, { error: 'Invalid list page', code: 'ZTO_LIST_PAGE_INVALID' });
    }
    const access = await deps.lookupAccess();
    if (access && access.response) return access.response;
    const accountSite = access && access.verified ? String(access.site || '').trim().toLowerCase() : '';
    if (accountSite && session.site && accountSite !== String(session.site).trim().toLowerCase()) {
        return json(200, { success: false, list: true, enabled: false, code: 'ZTO_LIST_NOT_CONFIGURED', reason: 'site:palm-other-branch' });
    }
    if (query.signed !== '1') {
        if (!trackingCode(session.site)) return json(200, { success: false, list: true, enabled: false, code: 'ZTO_LIST_NOT_CONFIGURED', reason: 'site:palm-missing' });
        if (query.candidates === '1') {
            const tabs = listTabs(query.tabs);
            if (tabs) return await palmCandidates(range, page, session, keys, deps, tabs);
        } else {
            const codes = listTrackCodes(query.tracks);
            if (codes) return await palmTracks(range, codes, session, keys, deps);
        }
        return json(400, { error: 'Invalid list request', code: 'ZTO_LIST_PAGE_INVALID' });
    }
    const signedRange = query.exact === '1' ? range : deps.listSignedRange(range);
    const siblings = query.exact === '1' && typeof deps.siblingBranches === 'function' ? deps.siblingBranches(session.site) : [];
    const primary = palmSignedPage(signedRange, page, session, keys, deps);
    const siblingDeps = typeof deps.renewBranch !== 'function' ? deps : Object.assign({}, deps, {
        renewBranch: async (site, token) => {
            let outcome;
            try { outcome = await primary; } catch (_) { return null; }
            return outcome.kind === 'ok' ? await deps.renewBranch(site, token) : null;
        }
    });
    const siblingsRun = Promise.allSettled(siblings.map((site) => siblingSignedPage(site, signedRange, page, keys, siblingDeps)));
    const outcome = await primary;
    if (outcome.kind !== 'ok') return listFailure(outcome);
    if (!siblings.length) return json(200, outcome.body);
    const extraReads = await siblingsRun;
    const failed = extraReads.find((read) => read.status === 'rejected');
    if (failed) throw failed.reason;
    const extras = extraReads.map((read) => read.value);
    if (extras.some((extra) => !extra)) return json(503, { code: 'ZTO_UNAVAILABLE', provider: 'zto-palm', reason: 'palm:branch-unread' });
    return json(200, mergeSiblingSigned(outcome.body, extras));
}

async function siblingSignedPage(site, range, page, keys, deps) {
    let sibling = null;
    try { sibling = typeof deps.branchSession === 'function' ? await deps.branchSession(site) : null; } catch (_) { sibling = null; }
    if (!sibling) return null;
    let outcome;
    try { outcome = await palmSignedPage(range, page, sibling, keys, deps); } catch (_) { return null; }
    if (outcome.kind === 'ok') return outcome.body;
    const age = Date.now() - sibling.loginAt;
    const suspected = outcome.kind === 'rejected' && !(age >= 0 && age < SHARED_SUSPECT_AGE_MS);
    if ((outcome.kind !== 'auth' && !suspected) || typeof deps.renewBranch !== 'function') return null;
    const renewed = await deps.renewBranch(site, sibling.token);
    if (!renewed || !renewed.session || remainingOf(deps) < SHARED_RETRY_MIN_MS) return null;
    try { outcome = await palmSignedPage(range, page, renewed.session, keys, deps); } catch (_) { return null; }
    return outcome.kind === 'ok' ? outcome.body : null;
}

function mergeSiblingSigned(body, extras) {
    const out = Object.assign({}, body);
    const signed = out.signed.slice();
    const seen = new Set(signed);
    extras.forEach((extra) => {
        extra.signed.forEach((code) => { if (!seen.has(code)) { seen.add(code); signed.push(code); } });
        out.signedScans += extra.signedScans;
        out.otherScans += extra.otherScans;
        out.total += extra.total;
        if (extra.pages > out.pages) out.pages = extra.pages;
        if (extra.pagesUnknown === true) out.pagesUnknown = true;
    });
    out.signed = signed;
    return out;
}

function isPalmPreflight(query, requestedHeaders) {
    if (isPalmQuery(query)) return true;
    return String(requestedHeaders || '').toLowerCase().split(',').some((name) => name.trim() === SESSION_HEADER);
}

module.exports = { handlePalm, isPalmPreflight, isPalmPost, isPalmQuery, ztoDispatcher, ztoFetch, resetSharedForTests, PALM_HOST, BILL_INFO_PATH, MISPLACED_REASONS };
