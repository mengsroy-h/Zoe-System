'use strict';

const crypto = require('node:crypto');

const ORIGIN = 'https://aargus-api.ztoglobal.net';
const PALM_HOST = new URL(ORIGIN).hostname;
const BILL_INFO_PATH = '/zto/basic/v1/billInfoQuery';
const TRACK_INFO_PATH = '/zto/locus/v1/queryTrackInfo';
const PALM_KEEP_ALIVE_MS = 60000;
const GLOBAL_DISPATCHER = Symbol.for('undici.globalDispatcher.1');
const STALE_SOCKET_CODES = new Set(['UND_ERR_SOCKET', 'ECONNRESET', 'EPIPE']);
let palmAgent = null;
const SESSION_HEADER = 'x-zoe-palm-token';
const SESSION_MS = 8 * 60 * 60 * 1000;
const BARCODE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const UPSTREAM_CODE_RE = /^[A-Za-z0-9_.:@-]{1,60}$/;
const AUTH_EXPIRED_RE = /^(?:401|403|not_login|token_expired|token_invalid|login_expired|login_required)$/i;
const DISPATCH_LIST_PATH = '/zto/dispatch/v1/queryDispatchList';
const SIGNED_STATUS = '5';
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

function palmDispatcher() {
    try {
        const current = globalThis[GLOBAL_DISPATCHER];
        const Agent = current ? current.constructor : null;
        if (typeof Agent !== 'function' || Agent.name !== 'Agent') return null;
        if (!palmAgent || palmAgent.Agent !== Agent) {
            palmAgent = { Agent, dispatcher: new Agent({ keepAliveTimeout: PALM_KEEP_ALIVE_MS, keepAliveMaxTimeout: PALM_KEEP_ALIVE_MS }) };
        }
        return palmAgent.dispatcher;
    } catch (_) { return null; }
}

function staleSocketError(error) {
    return !!error && error.name !== 'AbortError' && STALE_SOCKET_CODES.has(String((error.cause && error.cause.code) || ''));
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
    const dispatcher = palmDispatcher();
    if (dispatcher) init.dispatcher = dispatcher;
    const work = (async () => {
        let response = null;
        for (let attempt = 0; attempt < 2 && !response; attempt++) {
            try { response = await fetch(ORIGIN + path, init); }
            catch (error) {
                if (error?.name === 'AbortError') throw error;
                if (!retryStale || attempt > 0 || controller.signal.aborted || !staleSocketError(error)) throw new Error('upstream:unavailable');
            }
        }
        if (!response) throw new Error('upstream:unavailable');
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

function trackingVerdict(upstream, barcode, site) {
    const out = { ztoClosed: null, ztoArrivalAt: null, ztoSignedAt: null };
    if (!Array.isArray(upstream.result) || !trackingCode(site)) return out;
    const code = trackingCode(barcode);
    const rows = upstream.result.filter((row) => trackingCode(row?.mail?.mailNo) === code);
    if (rows.length !== 1 || !Array.isArray(rows[0].tracks)) return out;
    let arrival = '';
    let signed = '';
    let complete = true;
    for (const track of rows[0].tracks) {
        const at = trackingStamp(track?.time);
        if (!track || trackingCode(track.mailNo) !== code || !at
            || (typeof track.action !== 'string' && typeof track.action !== 'number')) { complete = false; continue; }
        if (trackingCode(track.siteCode) !== trackingCode(site)) continue;
        const action = String(track.action);
        if (action === '3' && at > arrival) arrival = at;
        if (action === '5' && at > signed) signed = at;
    }
    out.ztoArrivalAt = arrival || null;
    if (!complete) return out;
    if (rows[0].mail.isSign === 1 && signed && (!arrival || signed >= arrival)) {
        out.ztoClosed = true;
        out.ztoSignedAt = signed;
    } else if (rows[0].mail.isSign === 0 && arrival && (!signed || signed < arrival)) out.ztoClosed = false;
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
        if (query.diag === '1') {
            const body = { success: true, provider: 'zto-palm', configured: true };
            if (typeof deps.timingReport === 'function') body.upstreamTiming = deps.timingReport();
            if (typeof deps.runtimeReport === 'function') body.runtime = deps.runtimeReport();
            return json(200, body);
        }
        const barcode = String(query.barcode || '').trim();
        if (!BARCODE_RE.test(barcode)) return json(400, { code: 'ZTO_BARCODE_INVALID' });
        const access = await deps.lookupAccess();
        if (access && access.response) return access.response;
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
    } catch (error) {
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
}

function listRequest(range, page, deps) {
    return { billStatus: SIGNED_STATUS, signSiteDateFrom: range.start, signSiteDateTo: range.end, pageNum: page, pageSize: deps.listPageSize };
}

function signedListBody(page, session, result, keys, deps) {
    const container = result.result;
    if (!container || typeof container !== 'object' || !Array.isArray(container.list)) throw new Error('upstream:json');
    const signed = [];
    const seen = new Set();
    const signedRows = [];
    let otherScans = 0;
    let signedScans = 0;
    const raws = container.list.slice(0, LIST_ROW_MAX);
    for (let i = 0; i < raws.length; i++) {
        const raw = raws[i];
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { otherScans++; continue; }
        const barcode = String(raw.billCode === undefined || raw.billCode === null ? '' : raw.billCode).trim();
        const status = String(raw.billStatus === undefined || raw.billStatus === null ? '' : raw.billStatus).trim();
        if (!BARCODE_RE.test(barcode) || status !== SIGNED_STATUS) { otherScans++; continue; }
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
    const pages = Number(container.pages);
    const total = Number(container.total);
    const counted = otherScans + signedScans;
    const pagesKnown = Number.isFinite(pages) && pages >= 0;
    const pageFull = container.list.length >= deps.listPageSize;
    const body = {
        success: true, list: true, enabled: true, kind: 'signed', page,
        site: String(session.site || ''), siteName: String(session.siteName || ''),
        pages: pagesKnown ? pages : (pageFull ? page + 1 : (counted ? page : page - 1)),
        total: Number.isFinite(total) ? total : counted,
        rows: [], otherScans, signedScans, signedMismatch: 0,
        signed, signedOk: true, signedRows, provider: 'zto-palm'
    };
    if (!pagesKnown && pageFull) body.pagesUnknown = true;
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

function candidatePage(upstream, page, pageSize, kind) {
    const container = upstream.result;
    if (!container || typeof container !== 'object' || Array.isArray(container)) throw invalidPalmResponse('list-' + kind + '-result');
    const reported = Number(container.pages);
    const numericPages = typeof container.pages === 'number' || (typeof container.pages === 'string' && /^\d+$/.test(container.pages));
    const known = numericPages && Number.isInteger(reported) && reported >= 0;
    const zeroTotal = container.total === 0 || container.total === '0';
    const exhausted = known && page > reported;
    const empty = container.list == null && (zeroTotal || exhausted);
    const list = empty ? [] : container.list;
    if (!Array.isArray(list) || list.length > LIST_ROW_MAX) {
        const shape = list === null ? 'null' : Array.isArray(list) ? 'large' : typeof list;
        throw invalidPalmResponse('list-' + kind + '-items-' + shape + '-p' + page);
    }
    if (known && reported === 0 && list.length) throw invalidPalmResponse('list-' + kind + '-pages');
    const full = list.length >= pageSize;
    return { list, pages: known ? reported : (full ? page + 1 : (list.length ? page : page - 1)), unknown: !known && full };
}

function palmResponseError(upstream) {
    if (upstream.authRejected || AUTH_EXPIRED_RE.test(String(upstream.statusCode || ''))) {
        return json(401, { code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' });
    }
    return upstream.status === true ? null : json(502, { code: 'ZTO_UPSTREAM_REJECTED', reason: upstreamReason(upstream) });
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

function arrivalTrackRows(upstream, raw, barcode, site, range, keys, deps) {
    const code = trackingCode(barcode);
    if (!Array.isArray(upstream.result)) throw invalidPalmResponse('track-result', barcode);
    if (!upstream.result.length) throw invalidPalmResponse('track-empty', barcode);
    const groups = upstream.result.filter((row) => {
        const identity = trackingCode(row?.mail?.mailNo) || trackingCode(row?.mailNo);
        if (identity) return identity === code;
        return Array.isArray(row?.tracks) && row.tracks.length && row.tracks.every((track) => trackingCode(track?.mailNo) === code);
    });
    if (groups.length !== 1) throw invalidPalmResponse('track-identity', barcode);
    const group = groups[0];
    if (!Array.isArray(group.tracks)) throw invalidPalmResponse('track-items', barcode);
    if (!group.tracks.length) throw invalidPalmResponse('track-empty', barcode);
    const tracks = group.tracks;
    for (const track of tracks) {
        if (!track || trackingCode(track.mailNo) !== code) throw invalidPalmResponse('track-barcode', barcode);
        if (!trackingStamp(track.time)) throw invalidPalmResponse('track-time', barcode);
        if (typeof track.action !== 'string' && typeof track.action !== 'number') throw invalidPalmResponse('track-action', barcode);
    }
    const verdict = trackingVerdict(upstream, barcode, site);
    const fields = deps.project(raw);
    const base = { barcode, phone: phoneText(raw.consigneeMobile || raw.consigneePhone, keys),
        cod: fields.cod === null ? 0 : fields.cod, dod: fields.dod === null ? 0 : fields.dod };
    const from = palmOrigin(raw, tracks);
    const rows = [];
    const seen = new Set();
    for (const track of tracks) {
        if (String(track.action) !== '3' || trackingCode(track.siteCode) !== trackingCode(site)
            || track.time < range.start || track.time > range.end || seen.has(track.time)) continue;
        seen.add(track.time);
        rows.push({ ...base, at: track.time, ztoClosed: verdict.ztoClosed, skip: '', from });
    }
    return { rows, signed: verdict.ztoClosed === true ? { ...base, at: verdict.ztoSignedAt, from } : null };
}

async function palmArrivalList(range, page, session, keys, deps) {
    const pageSize = Math.min(5, deps.listPageSize);
    const signedRange = deps.listSignedRange(range);
    const requests = [
        { billStatus: '1', isIssue: '1', status: 0, pageNum: page, pageSize },
        { billStatus: '4', status: 0, pageNum: page, pageSize },
        { billStatus: '5', status: 0, signSiteDateFrom: range.start, signSiteDateTo: signedRange.end, pageNum: page, pageSize }
    ];
    const upstreams = await Promise.all(requests.map(async (payload) => {
        try { return await requestPalm(DISPATCH_LIST_PATH, payload, session.token, keys, deps.upstreamMs(), null, true); }
        catch (error) { error.palmReason = 'palm:list-' + payload.billStatus + '-response'; throw error; }
    }));
    for (const upstream of upstreams) {
        const response = palmResponseError(upstream);
        if (response) return response;
    }
    const pages = upstreams.map((upstream, index) => candidatePage(upstream, page, pageSize, requests[index].billStatus));
    const candidates = new Map();
    for (const current of pages) {
        for (const raw of current.list) {
            const barcode = typeof raw?.billCode === 'string' ? raw.billCode.trim() : '';
            if (BARCODE_RE.test(barcode)) candidates.set(trackingCode(barcode), { raw, barcode });
        }
    }
    const jobs = Array.from(candidates.values());
    const results = new Array(jobs.length);
    let next = 0;
    let stopped = false;
    const worker = async () => {
        try {
            while (!stopped && next < jobs.length) {
                if (typeof deps.remainingMs === 'function' && deps.remainingMs() < 1000) throw Object.assign(new Error('upstream:timeout'), { name: 'AbortError' });
                const index = next++;
                const job = jobs[index];
                let tracking;
                try { tracking = await palmTracking(job.barcode, session, keys, deps); }
                catch (error) { error.palmReason = 'palm:track-response'; error.palmBarcode = job.barcode; throw error; }
                if (tracking.response) throw Object.assign(new Error('upstream:tracking'), { palmResponse: tracking.response });
                results[index] = arrivalTrackRows(tracking.upstream, job.raw, job.barcode, session.site, range, keys, deps);
            }
        } catch (error) { stopped = true; throw error; }
    };
    const settled = await Promise.allSettled(Array.from({ length: Math.min(8, jobs.length) }, worker));
    const failed = settled.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
    const rows = results.flatMap((result) => result.rows);
    const signedRows = results.map((result) => result.signed).filter((row) => row && row.at >= range.start && row.at <= signedRange.end);
    const body = {
        success: true, list: true, enabled: true, kind: 'arrival', page,
        site: session.site, siteName: session.siteName || '', pages: Math.max(...pages.map((current) => current.pages)),
        total: rows.length, pageTotal: true, rows, otherScans: jobs.length - results.filter((result) => result.rows.length).length,
        signed: signedRows.map((row) => row.barcode), signedRows, signedOk: true, signedPages: pages[2].pages,
        signedMismatch: 0, provider: 'zto-palm'
    };
    if (pages.some((current) => current.unknown)) body.pagesUnknown = true;
    if (pages[2].unknown) body.signedPagesUnknown = true;
    return json(200, body);
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
        return await palmArrivalList(range, page, session, keys, deps);
    }
    const outcome = await palmSignedPage(query.exact === '1' ? range : deps.listSignedRange(range), page, session, keys, deps);
    return outcome.kind === 'ok' ? json(200, outcome.body) : listFailure(outcome);
}

function isPalmPreflight(query, requestedHeaders) {
    if (query && (query.palm === '1' || query.palm === 'login')) return true;
    return String(requestedHeaders || '').toLowerCase().split(',').some((name) => name.trim() === SESSION_HEADER);
}

module.exports = { handlePalm, isPalmPreflight, palmDispatcher, PALM_HOST, BILL_INFO_PATH };
