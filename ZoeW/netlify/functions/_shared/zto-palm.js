'use strict';

const crypto = require('node:crypto');

const ORIGIN = 'https://aargus-api.ztoglobal.net';
const SESSION_HEADER = 'x-zoe-palm-token';
const SESSION_MS = 8 * 60 * 60 * 1000;
const BARCODE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const UPSTREAM_CODE_RE = /^[A-Za-z0-9_.:@-]{1,60}$/;
const AUTH_EXPIRED_RE = /^(?:401|403|not_login|token_expired|token_invalid|login_expired|login_required)$/i;
const DISPATCH_LIST_PATH = '/zto/dispatch/v1/queryDispatchList';
const ARRIVAL_STATUS = '4';
const SIGNED_STATUS = '5';
const LIST_TIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;
const LIST_ROW_MAX = 200;

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
            const site = String(account.siteCode || '').slice(0, 64);
            const siteName = String(account.siteName || '').slice(0, 120);
            return json(200, {
                success: true, provider: 'zto-palm', expiresAt,
                sessionToken: sealSession({ token: account.token, expiresAt, site, siteName }, proxyKey, env),
                account: { siteCode: site, siteName }
            });
        }
        if (event.httpMethod !== 'GET') return json(405, { code: 'ZTO_PALM_METHOD_INVALID' });
        const session = openSession(deps.headerOf(event, SESSION_HEADER), proxyKey, env);
        if (query.list === '1') return await palmList(query, session, keys, deps);
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

function listRequest(kind, range, page, deps) {
    const body = kind === 'signed'
        ? { billStatus: SIGNED_STATUS, signSiteDateFrom: range.start, signSiteDateTo: range.end }
        : { billStatus: ARRIVAL_STATUS, dispEmpDateFrom: range.start, dispEmpDateTo: range.end };
    body.pageNum = page;
    body.pageSize = deps.listPageSize;
    return body;
}

function listRowOf(raw, keys, deps) {
    const barcode = String(raw.billCode === undefined || raw.billCode === null ? '' : raw.billCode).trim();
    const status = String(raw.billStatus === undefined || raw.billStatus === null ? '' : raw.billStatus).trim();
    const fields = deps.project(raw);
    const at = String(raw.dispEmpDate || '').trim();
    return {
        barcode, status,
        phone: phoneText(raw.consigneeMobile || raw.consigneePhone, keys),
        cod: fields.cod === null ? 0 : fields.cod,
        dod: fields.dod === null ? 0 : fields.dod,
        at: LIST_TIME_RE.test(at) ? at.slice(0, 19) : ''
    };
}

function palmListBody(kind, page, session, result, keys, deps) {
    const container = result.result;
    if (!container || typeof container !== 'object' || !Array.isArray(container.list)) throw new Error('upstream:json');
    const rows = [];
    const signed = [];
    const seen = new Set();
    const signedRows = [];
    let otherScans = 0;
    let signedScans = 0;
    const raws = container.list.slice(0, LIST_ROW_MAX);
    for (let i = 0; i < raws.length; i++) {
        const raw = raws[i];
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { otherScans++; continue; }
        const row = listRowOf(raw, keys, deps);
        if (!BARCODE_RE.test(row.barcode)) { otherScans++; continue; }
        if (row.status === SIGNED_STATUS) {
            signedScans++;
            if (!seen.has(row.barcode)) {
                seen.add(row.barcode);
                signed.push(row.barcode);
                signedRows.push({ barcode: row.barcode, phone: row.phone, cod: row.cod, dod: row.dod, at: '', from: '' });
            }
            continue;
        }
        if (kind === 'signed' || row.status !== ARRIVAL_STATUS) { otherScans++; continue; }
        rows.push({ barcode: row.barcode, phone: row.phone, cod: row.cod, dod: row.dod, at: row.at, ztoClosed: false, skip: '', from: '' });
    }
    const pages = Number(container.pages);
    const total = Number(container.total);
    const counted = rows.length + otherScans + signedScans;
    const pagesKnown = Number.isFinite(pages) && pages >= 0;
    const pageFull = container.list.length >= deps.listPageSize;
    const body = {
        success: true, list: true, enabled: true, kind, page,
        site: String(session.site || ''), siteName: String(session.siteName || ''),
        pages: pagesKnown ? pages : (pageFull ? page + 1 : (counted ? page : page - 1)),
        total: Number.isFinite(total) ? total : counted,
        rows, otherScans, signedScans, signedMismatch: 0,
        signed, signedOk: kind === 'signed', signedRows, provider: 'zto-palm'
    };
    if (!pagesKnown && pageFull) body.pagesUnknown = true;
    return body;
}

async function palmListPage(kind, range, page, session, keys, deps) {
    const upstream = await requestPalm(DISPATCH_LIST_PATH, listRequest(kind, range, page, deps), session.token, keys, deps.upstreamMs());
    if (upstream.authRejected || AUTH_EXPIRED_RE.test(String(upstream.statusCode || ''))) return { kind: 'auth' };
    if (upstream.status !== true) return { kind: 'rejected', reason: upstreamReason(upstream) };
    return { kind: 'ok', body: palmListBody(kind, page, session, upstream, keys, deps) };
}

function listFailure(outcome) {
    if (outcome.kind === 'auth') return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' });
    return json(502, { code: 'ZTO_UPSTREAM_REJECTED', reason: outcome.reason });
}

async function palmList(query, session, keys, deps) {
    const range = deps.listRange(query.from, query.to);
    if (!range) return json(400, { error: 'Invalid list date range', code: 'ZTO_LIST_RANGE_INVALID' });
    const page = Number(String(query.page || '1').trim());
    if (!Number.isInteger(page) || page < 1 || page > deps.listMaxPages) {
        return json(400, { error: 'Invalid list page', code: 'ZTO_LIST_PAGE_INVALID' });
    }
    const access = await deps.lookupAccess();
    if (access && access.response) return access.response;
    const accountSite = access && access.verified ? String(access.site || '').trim().toLowerCase() : '';
    if (accountSite && session.site && accountSite !== String(session.site).trim().toLowerCase()) {
        return json(200, { success: false, list: true, enabled: false, code: 'ZTO_LIST_NOT_CONFIGURED', reason: 'site:palm-other-branch' });
    }
    const signedOnly = query.signed === '1';
    const signedRange = signedOnly && query.exact === '1' ? range : deps.listSignedRange(range);
    if (signedOnly) {
        const outcome = await palmListPage('signed', signedRange, page, session, keys, deps);
        return outcome.kind === 'ok' ? json(200, outcome.body) : listFailure(outcome);
    }
    const companion = query.withSigned === '1'
        ? palmListPage('signed', signedRange, page, session, keys, deps).catch(() => null)
        : null;
    const outcome = await palmListPage('arrival', range, page, session, keys, deps);
    const companionOutcome = companion ? await companion : null;
    if (outcome.kind !== 'ok') return listFailure(outcome);
    return json(200, companion ? deps.mergeCompanion(outcome.body, companionOutcome) : outcome.body);
}

function isPalmPreflight(query, requestedHeaders) {
    if (query && (query.palm === '1' || query.palm === 'login')) return true;
    return String(requestedHeaders || '').toLowerCase().split(',').some((name) => name.trim() === SESSION_HEADER);
}

module.exports = { handlePalm, isPalmPreflight };
