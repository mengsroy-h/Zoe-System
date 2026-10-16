'use strict';

const crypto = require('node:crypto');

const ORIGIN = 'https://aargus-api.ztoglobal.net';
const SESSION_HEADER = 'x-zoe-palm-token';
const SESSION_MS = 8 * 60 * 60 * 1000;
const BARCODE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const UPSTREAM_CODE_RE = /^[A-Za-z0-9_.:@-]{1,60}$/;
const AUTH_EXPIRED_RE = /^(?:401|403|not_login|token_expired|token_invalid|login_expired|login_required)$/i;

function json(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function configError(reason) {
    return Object.assign(new Error('palm:config'), { reason });
}

function sessionKey(env) {
    const secret = String(env.ZTO_PALM_SESSION_SECRET || '');
    if (secret.length < 32) throw configError('palm:session-secret');
    return crypto.createHash('sha256').update('zoew:palm:v1:').update(secret).digest();
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

function sealSession(value, proxyKey, env) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey(env), iv);
    cipher.setAAD(binding(proxyKey));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

function openSession(value, proxyKey, env) {
    const key = sessionKey(env);
    if (!/^[A-Za-z0-9_-]{40,8192}$/.test(value)) throw new Error('session:invalid');
    try {
        const raw = Buffer.from(value, 'base64url');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
        decipher.setAAD(binding(proxyKey));
        decipher.setAuthTag(raw.subarray(12, 28));
        const data = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'));
        if (typeof data.token !== 'string' || !data.token || /[\r\n]/.test(data.token)
            || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) throw new Error('invalid');
        return data;
    } catch (_) { throw new Error('session:invalid'); }
}

function passwordCipher(password, keys) {
    const cipher = crypto.createCipheriv('aes-128-ecb', keys.password, null);
    return Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]).toString('base64');
}

function upstreamReason(result) {
    const code = String(result.statusCode === undefined || result.statusCode === null ? '' : result.statusCode).trim();
    return UPSTREAM_CODE_RE.test(code) ? 'palm:' + code : 'palm:status';
}

async function requestPalm(path, payload, token, keys, timeoutMs) {
    const body = JSON.stringify(payload);
    const headers = {
        'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json',
        'User-Agent': 'PDA', 'x-language': 'km_KH',
        'x-sign': crypto.createHash('md5').update(body + keys.sign, 'utf8').digest('base64')
    };
    if (token) headers['x-token'] = token;
    const controller = new AbortController();
    let timeout;
    const budget = new Promise((_, reject) => {
        timeout = setTimeout(() => {
            controller.abort();
            reject(Object.assign(new Error('upstream:timeout'), { name: 'AbortError' }));
        }, timeoutMs);
    });
    const work = (async () => {
        let response;
        try { response = await fetch(ORIGIN + path, { method: 'POST', headers, body, redirect: 'manual', signal: controller.signal }); }
        catch (error) { if (error?.name === 'AbortError') throw error; throw new Error('upstream:unavailable'); }
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
    } finally { clearTimeout(timeout); }
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

function lookupBody(result, barcode, keys, deps) {
    const row = result.result;
    if (row === null || row === undefined) return { success: false, found: false, barcode, code: 'ZTO_NOT_FOUND' };
    if (typeof row !== 'object' || Array.isArray(row)) throw new Error('upstream:json');
    const billCode = row.billCode === undefined || row.billCode === null ? '' : String(row.billCode).trim();
    if (billCode && billCode.toUpperCase() !== barcode.toUpperCase()) throw new Error('upstream:barcode');
    const phone = phoneText(row.consigneeMobile || row.consigneePhone || row.phone, keys);
    const fields = deps.project(row);
    if (!phone && fields.cod === null && fields.dod === null) throw new Error('upstream:json');
    const body = {
        success: true, found: true, barcode, phone,
        cod: fields.cod === null ? 0 : fields.cod, dod: fields.dod === null ? 0 : fields.dod,
        ztoClosed: null, provider: 'zto-palm'
    };
    if (fields.branches) body.branches = fields.branches;
    return body;
}

async function handlePalm(event, query, proxyKey, deps, env = process.env) {
    try {
        sessionKey(env);
        const keys = protocolKeys(env);
        if (event.httpMethod === 'POST' && query.palm === 'login') {
            if (event.isBase64Encoded || typeof event.body !== 'string' || Buffer.byteLength(event.body) > 4096) {
                return json(400, { code: 'ZTO_PALM_LOGIN_INVALID' });
            }
            let input;
            try { input = JSON.parse(event.body); } catch (_) { return json(400, { code: 'ZTO_PALM_LOGIN_INVALID' }); }
            const username = typeof input?.username === 'string' ? input.username.trim() : '';
            const password = typeof input?.password === 'string' ? input.password : '';
            const deviceSn = typeof input?.deviceSn === 'string' ? input.deviceSn : '';
            if (!username || username.length > 128 || !password || password.length > 256 || /[\u0000-\u001f]/.test(username)
                || !/^[A-Za-z0-9-]{8,80}$/.test(deviceSn)) return json(400, { code: 'ZTO_PALM_LOGIN_INVALID' });
            const access = await deps.loginAccess();
            if (access && access.response) return access.response;
            const upstream = await requestPalm('/zto/system/v1/doLogin', {
                password: passwordCipher(password, keys), equipment: 'ZoeW', timeZone: 'GMT+07:00',
                userName: username, deviceSn, version: '2.9.92'
            }, '', keys, deps.upstreamMs());
            if (upstream.authRejected) return json(401, { code: 'ZTO_PALM_LOGIN_REJECTED', reason: 'palm:http-auth' });
            if (upstream.statusCode === 'risk_control_account_captcha_err') {
                return json(401, { code: 'ZTO_PALM_VERIFICATION_REQUIRED' });
            }
            if (upstream.status !== true) return json(401, { code: 'ZTO_PALM_LOGIN_REJECTED', reason: upstreamReason(upstream) });
            const account = upstream.result;
            if (!account || typeof account.token !== 'string' || !account.token || account.token.length > 4096 || /[\r\n]/.test(account.token)) {
                throw new Error('upstream:json');
            }
            if (account.countryCode !== 'KH') return json(403, { code: 'ZTO_PALM_COUNTRY_UNSUPPORTED' });
            const expiresAt = Date.now() + SESSION_MS;
            return json(200, {
                success: true, provider: 'zto-palm', expiresAt,
                sessionToken: sealSession({ token: account.token, expiresAt }, proxyKey, env),
                account: { siteCode: String(account.siteCode || '').slice(0, 64), siteName: String(account.siteName || '').slice(0, 120) }
            });
        }
        if (event.httpMethod !== 'GET') return json(405, { code: 'ZTO_PALM_METHOD_INVALID' });
        const session = openSession(deps.headerOf(event, SESSION_HEADER), proxyKey, env);
        if (query.list === '1') return json(200, { success: false, list: true, enabled: false, code: 'ZTO_LIST_NOT_CONFIGURED', reason: 'palm:lookup-only' });
        if (query.diag === '1') return json(200, { success: true, provider: 'zto-palm', configured: true });
        const barcode = String(query.barcode || '').trim();
        if (!BARCODE_RE.test(barcode)) return json(400, { code: 'ZTO_BARCODE_INVALID' });
        const access = await deps.lookupAccess();
        if (access && access.response) return access.response;
        const upstream = await requestPalm('/zto/basic/v1/billInfoQuery', { billCode: barcode }, session.token, keys, deps.upstreamMs());
        if (upstream.authRejected || AUTH_EXPIRED_RE.test(String(upstream.statusCode || ''))) {
            return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' });
        }
        if (upstream.status !== true) return json(502, { code: 'ZTO_UPSTREAM_REJECTED', reason: upstreamReason(upstream) });
        return json(200, deps.finish(access, lookupBody(upstream, barcode, keys, deps), barcode));
    } catch (error) {
        const reason = error?.message;
        if (reason === 'palm:config') return json(503, { code: 'ZTO_PALM_NOT_CONFIGURED', reason: error.reason });
        if (reason === 'session:invalid') return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' });
        if (reason === 'upstream:rate') return json(429, { code: 'ZTO_RATE_LIMITED' });
        if (error?.name === 'AbortError') return json(504, { code: 'ZTO_TIMEOUT' });
        return json(502, { code: reason === 'upstream:unavailable' ? 'ZTO_UNAVAILABLE' : 'ZTO_INVALID_RESPONSE' });
    }
}

function isPalmPreflight(query, requestedHeaders) {
    if (query && (query.palm === '1' || query.palm === 'login')) return true;
    return String(requestedHeaders || '').toLowerCase().split(',').some((name) => name.trim() === SESSION_HEADER);
}

module.exports = { handlePalm, isPalmPreflight };
