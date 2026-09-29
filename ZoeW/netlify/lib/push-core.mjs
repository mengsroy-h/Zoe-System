import crypto from 'node:crypto';

export const PUSH_STORE_NAME = 'zoew-push';
export const LICENSE_APP_CODE = 'ZOE';
export const LICENSE_KEY_PREFIX = 'ZOEKEY-';
export const LICENSE_DB_URL_DEFAULT = 'https://zoew-z1-default-rtdb.firebaseio.com';
export const LICENSE_PUBLIC_KEYS_JWK = [
    { kty: 'EC', crv: 'P-256', x: 'jxAByrOhnR-oWCdhyWt7hsJMpz2gzLjIYYVDhwg3ZLs', y: 'uZohHyeHFD3gAWST4Tc1vCKCkndzmwGPCUdhLAN1MM0' }
];

export const PUSH_NOTICE_KINDS = ['notice', 'maintenance'];
export const PUSH_NOTICE_READ_LIMIT = 5;
export const PUSH_NOTICE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const PUSH_NOTICE_PER_RUN_MAX = 3;
export const PUSH_EXPIRY_HOUR = 8;
export const PUSH_EXPIRY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const PUSH_SCHEDULE_MAX_AGE_MS = 48 * 60 * 60 * 1000;
export const PUSH_SCHEDULE_MAX_TIMES = 2000;
export const PUSH_SCHEDULE_HORIZON_MS = 9 * 24 * 60 * 60 * 1000;
export const PUSH_SUBS_PER_KEY_MAX = 10;
export const PUSH_SUBS_TOTAL_MAX = 5000;
export const PUSH_SEND_CONCURRENCY = 16;
export const PUSH_SEND_TIMEOUT_MS = 6000;
export const PUSH_READ_TIMEOUT_MS = 4000;
export const PUSH_RUN_BUDGET_MS = 20000;
export const PUSH_LICENSE_CACHE_MS = 10 * 60 * 1000;
export const PUSH_TTL_SECONDS = 24 * 60 * 60;
export const PUSH_TITLE_MAX = 120;
export const PUSH_BODY_MAX = 240;
export const APP_ZONE_OFFSET_MS = 7 * 60 * 60 * 1000;
export const FCM_CHANNEL_ID = 'zoew_notify';
export const PUSH_OPEN_URL = './?notify=1';

const WEB_PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
const FCM_TOKEN_RE = /^[A-Za-z0-9_:\-]{20,4096}$/;
const KEY_ID_RE = /^[0-9A-Z]{16,40}$/;
const NOTICE_ID_RE = /^n[0-9]{13}[a-z0-9]{6}$/;

export function b64urlEncode(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(text) {
    const raw = String(text == null ? '' : text).replace(/-/g, '+').replace(/_/g, '/');
    if (!/^[A-Za-z0-9+/]*$/.test(raw)) return null;
    const pad = raw.length % 4;
    if (pad === 1) return null;
    return Buffer.from(raw + (pad ? '===='.slice(pad) : ''), 'base64');
}

export function elapsedSince(mark, now) {
    if (!mark) return Infinity;
    const delta = now - mark;
    return delta < 0 ? Infinity : delta;
}

export function settleWithin(run, timeoutMs) {
    return new Promise((resolve) => {
        let done = false;
        const timer = setTimeout(() => { if (!done) { done = true; resolve({ ok: false, reason: 'timeout' }); } }, timeoutMs);
        Promise.resolve().then(run).then((value) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({ ok: true, value: value });
        }, (err) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({ ok: false, reason: 'error', error: err });
        });
    });
}

export function readPushConfig(env) {
    const e = env || {};
    const cfg = { vapid: null, fcm: null, licenseDbUrl: LICENSE_DB_URL_DEFAULT, reasons: [] };
    const pub = b64urlDecode(String(e.VAPID_PUBLIC_KEY || '').trim());
    const priv = b64urlDecode(String(e.VAPID_PRIVATE_KEY || '').trim());
    if (pub && priv && pub.length === 65 && pub[0] === 4 && priv.length === 32) {
        const subjectRaw = String(e.VAPID_SUBJECT || e.URL || '').trim();
        const subject = /^mailto:[^\s@]+@[^\s@]+$/.test(subjectRaw) || /^https:\/\/[^\s/]+/.test(subjectRaw) ? subjectRaw : '';
        if (subject) {
            cfg.vapid = { publicKey: b64urlEncode(pub), privateKey: b64urlEncode(priv), subject: subject };
        } else {
            cfg.reasons.push('vapid:subject');
        }
    } else if (e.VAPID_PUBLIC_KEY || e.VAPID_PRIVATE_KEY) {
        cfg.reasons.push('vapid:invalid');
    } else {
        cfg.reasons.push('vapid:unset');
    }
    const saRaw = String(e.FCM_SERVICE_ACCOUNT || '').trim();
    if (saRaw) {
        let sa = null;
        try {
            sa = JSON.parse(saRaw.charAt(0) === '{' ? saRaw : Buffer.from(saRaw, 'base64').toString('utf8'));
        } catch (_) { sa = null; }
        if (sa && typeof sa.project_id === 'string' && /^[a-z0-9][a-z0-9-]{2,62}$/.test(sa.project_id)
            && typeof sa.client_email === 'string' && typeof sa.private_key === 'string' && sa.private_key.indexOf('PRIVATE KEY') !== -1) {
            cfg.fcm = { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key };
        } else {
            cfg.reasons.push('fcm:invalid');
        }
    } else {
        cfg.reasons.push('fcm:unset');
    }
    const dbRaw = String(e.LICENSE_DB_URL || '').trim().replace(/\/+$/, '');
    if (dbRaw && /^https:\/\/[a-z0-9-]+\.(firebaseio\.com|[a-z0-9-]+\.firebasedatabase\.app)$/.test(dbRaw)) cfg.licenseDbUrl = dbRaw;
    return cfg;
}

export function encryptWebPushPayload(payload, uaPublicB64, authSecretB64, options) {
    const opts = options || {};
    const uaPublic = b64urlDecode(uaPublicB64);
    const authSecret = b64urlDecode(authSecretB64);
    if (!uaPublic || uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('webpush:p256dh');
    if (!authSecret || authSecret.length !== 16) throw new Error('webpush:auth');
    const ecdh = crypto.createECDH('prime256v1');
    if (opts.asPrivateKey) ecdh.setPrivateKey(b64urlDecode(opts.asPrivateKey));
    else ecdh.generateKeys();
    const asPublic = ecdh.getPublicKey();
    const shared = ecdh.computeSecret(uaPublic);
    const salt = opts.salt ? b64urlDecode(opts.salt) : crypto.randomBytes(16);
    const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
    const prkKey = hmac(authSecret, shared);
    const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), uaPublic, asPublic, Buffer.from([1])]);
    const ikm = hmac(prkKey, keyInfo);
    const prk = hmac(salt, ikm);
    const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), Buffer.from([1])])).subarray(0, 16);
    const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0', 'utf8'), Buffer.from([1])])).subarray(0, 12);
    const plain = Buffer.concat([Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8'), Buffer.from([2])]);
    const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
    const rs = Buffer.alloc(4);
    rs.writeUInt32BE(4096, 0);
    return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, encrypted]);
}

export function vapidPrivateKeyObject(vapid) {
    const pub = b64urlDecode(vapid.publicKey);
    return crypto.createPrivateKey({
        key: { kty: 'EC', crv: 'P-256', d: vapid.privateKey, x: b64urlEncode(pub.subarray(1, 33)), y: b64urlEncode(pub.subarray(33, 65)) },
        format: 'jwk'
    });
}

export function vapidAuthorization(endpoint, vapid, nowMs) {
    const aud = new URL(endpoint).origin;
    const header = b64urlEncode(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const body = b64urlEncode(Buffer.from(JSON.stringify({ aud: aud, exp: Math.floor(nowMs / 1000) + 12 * 60 * 60, sub: vapid.subject })));
    const signed = header + '.' + body;
    const sig = crypto.sign('sha256', Buffer.from(signed), { key: vapidPrivateKeyObject(vapid), dsaEncoding: 'ieee-p1363' });
    return 'vapid t=' + signed + '.' + b64urlEncode(sig) + ', k=' + vapid.publicKey;
}

export function webPushEndpointAllowed(endpoint) {
    let url;
    try { url = new URL(String(endpoint || '')); } catch (_) { return false; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return WEB_PUSH_HOSTS.some((re) => re.test(url.hostname));
}

export function normalizeSubscription(raw) {
    if (!raw || typeof raw !== 'object') return { ok: false, reason: 'sub:shape' };
    if (raw.kind === 'web') {
        const endpoint = String(raw.endpoint || '');
        if (endpoint.length > 1024 || !webPushEndpointAllowed(endpoint)) return { ok: false, reason: 'sub:endpoint' };
        const keys = raw.keys && typeof raw.keys === 'object' ? raw.keys : {};
        const p256 = b64urlDecode(keys.p256dh);
        const auth = b64urlDecode(keys.auth);
        if (!p256 || p256.length !== 65 || p256[0] !== 4 || !auth || auth.length !== 16) return { ok: false, reason: 'sub:keys' };
        return { ok: true, sub: { kind: 'web', endpoint: endpoint, p256dh: b64urlEncode(p256), auth: b64urlEncode(auth) } };
    }
    if (raw.kind === 'fcm') {
        const token = String(raw.token || '');
        if (!FCM_TOKEN_RE.test(token)) return { ok: false, reason: 'sub:token' };
        return { ok: true, sub: { kind: 'fcm', token: token } };
    }
    return { ok: false, reason: 'sub:kind' };
}

export function subscriptionKey(sub) {
    const id = sub.kind === 'web' ? sub.endpoint : sub.token;
    return 'sub/' + crypto.createHash('sha256').update(sub.kind + '|' + id).digest('hex').slice(0, 40);
}

export function parseLicenseKey(keyString) {
    if (typeof keyString !== 'string') return null;
    const trimmed = keyString.trim();
    if (!trimmed.startsWith(LICENSE_KEY_PREFIX) || trimmed.length > 2048) return null;
    const parts = trimmed.slice(LICENSE_KEY_PREFIX.length).split('.');
    if (parts.length !== 2) return null;
    const payloadBuf = b64urlDecode(parts[0]);
    const sig = b64urlDecode(parts[1]);
    if (!payloadBuf || !sig || sig.length !== 64) return null;
    let payload;
    try { payload = JSON.parse(payloadBuf.toString('utf8')); } catch (_) { return null; }
    if (!payload || typeof payload !== 'object' || typeof payload.a !== 'string' || typeof payload.id !== 'string'
        || typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return null;
    if (!KEY_ID_RE.test(payload.id)) return null;
    return { payload: payload, signed: parts[0], sig: sig };
}

export function licenseSignatureValid(parsed, publicKeys) {
    const keys = publicKeys || LICENSE_PUBLIC_KEYS_JWK;
    for (const jwk of keys) {
        try {
            const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
            if (crypto.verify('sha256', Buffer.from(parsed.signed), { key: key, dsaEncoding: 'ieee-p1363' }, parsed.sig)) return true;
        } catch (_) {}
    }
    return false;
}

export function createPushService(deps) {
    const d = deps || {};
    const env = d.env || {};
    const cfg = d.config || readPushConfig(env);
    const store = d.store;
    const fetchImpl = d.fetch || globalThis.fetch;
    const now = d.now || (() => Date.now());
    const publicKeys = d.publicKeys || LICENSE_PUBLIC_KEYS_JWK;
    const licenseCache = d.licenseCache || new Map();
    const fcmToken = d.fcmTokenState || { token: '', exp: 0, inFlight: null };

    async function fetchJson(url, init, timeoutMs) {
        const out = await settleWithin(async () => {
            const res = await fetchImpl(url, init || {});
            const text = await res.text();
            let body = null;
            try { body = text ? JSON.parse(text) : null; } catch (_) { body = undefined; }
            return { status: res.status, ok: res.ok, body: body };
        }, timeoutMs || PUSH_READ_TIMEOUT_MS);
        return out.ok ? out.value : { status: 0, ok: false, body: undefined, reason: out.reason };
    }

    async function verifyLicense(keyString) {
        const parsed = parseLicenseKey(keyString);
        if (!parsed) return { ok: false, status: 403, reason: 'license:format' };
        if (!licenseSignatureValid(parsed, publicKeys)) return { ok: false, status: 403, reason: 'license:signature' };
        if (parsed.payload.a !== LICENSE_APP_CODE && parsed.payload.a !== 'ALL') return { ok: false, status: 403, reason: 'license:app' };
        const keyId = parsed.payload.id;
        const cached = licenseCache.get(keyId);
        if (cached && elapsedSince(cached.at, now()) < PUSH_LICENSE_CACHE_MS) return cached.verdict;
        const res = await fetchJson(cfg.licenseDbUrl + '/license_keys/' + LICENSE_APP_CODE + '/' + keyId + '.json', { method: 'GET' });
        if (!res.ok || res.body === undefined) return { ok: false, status: 503, reason: 'license:unverified' };
        const rec = res.body;
        let verdict;
        if (!rec || typeof rec !== 'object') verdict = { ok: false, status: 403, reason: 'license:unknown' };
        else if (rec.revoked === true) verdict = { ok: false, status: 403, reason: 'license:revoked' };
        else {
            const expiresAt = typeof rec.expiresAt === 'number' && rec.expiresAt > 0 ? rec.expiresAt : parsed.payload.exp * 1000;
            verdict = expiresAt > now() ? { ok: true, keyId: keyId } : { ok: false, status: 403, reason: 'license:expired' };
        }
        licenseCache.set(keyId, { at: now(), verdict: verdict });
        return verdict;
    }

    async function readJson(key) {
        const out = await store.getWithMetadata(key, { type: 'json' });
        return out ? { data: out.data, etag: out.etag } : null;
    }

    async function updateIndex(keyId, mutate) {
        for (let attempt = 0; attempt < 4; attempt++) {
            const cur = await readJson('bykey/' + keyId);
            const list = cur && cur.data && Array.isArray(cur.data.subs) ? cur.data.subs.filter((s) => typeof s === 'string') : [];
            const next = mutate(list.slice());
            const opts = cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true };
            const res = await store.setJSON('bykey/' + keyId, { subs: next }, opts);
            if (res && res.modified) return next;
        }
        return null;
    }

    async function subscribe(licenseKey, rawSub, platform) {
        const lic = await verifyLicense(licenseKey);
        if (!lic.ok) return lic;
        const norm = normalizeSubscription(rawSub);
        if (!norm.ok) return { ok: false, status: 400, reason: norm.reason };
        if (norm.sub.kind === 'web' && !cfg.vapid) return { ok: false, status: 503, reason: 'vapid:unset' };
        if (norm.sub.kind === 'fcm' && !cfg.fcm) return { ok: false, status: 503, reason: 'fcm:unset' };
        const key = subscriptionKey(norm.sub);
        const existing = await readJson(key);
        if (!existing) {
            const listed = await store.list({ prefix: 'sub/' });
            if (listed && Array.isArray(listed.blobs) && listed.blobs.length >= PUSH_SUBS_TOTAL_MAX) return { ok: false, status: 507, reason: 'subs:full' };
        }
        const at = now();
        const record = Object.assign({}, norm.sub, {
            keyId: lic.keyId,
            platform: /^(android|ios|web|native)$/.test(String(platform || '')) ? String(platform) : 'web',
            createdAt: existing && existing.data && existing.data.createdAt ? existing.data.createdAt : at,
            seenAt: at
        });
        await store.setJSON(key, record);
        const dropped = [];
        const index = await updateIndex(lic.keyId, (list) => {
            const next = list.filter((k) => k !== key).concat(key);
            while (next.length > PUSH_SUBS_PER_KEY_MAX) dropped.push(next.shift());
            return next;
        });
        if (!index) return { ok: false, status: 503, reason: 'index:busy' };
        await Promise.all(dropped.map((k) => store.delete(k).catch(() => {})));
        if (existing && existing.data && existing.data.keyId && existing.data.keyId !== lic.keyId) {
            await updateIndex(existing.data.keyId, (list) => list.filter((k) => k !== key));
        }
        return { ok: true, status: 200 };
    }

    async function unsubscribe(rawSub) {
        const norm = normalizeSubscription(rawSub);
        if (!norm.ok) return { ok: false, status: 400, reason: norm.reason };
        const key = subscriptionKey(norm.sub);
        const existing = await readJson(key);
        await store.delete(key);
        if (existing && existing.data && KEY_ID_RE.test(String(existing.data.keyId || ''))) {
            await updateIndex(existing.data.keyId, (list) => list.filter((k) => k !== key));
        }
        return { ok: true, status: 200 };
    }

    async function saveSchedule(licenseKey, times) {
        const lic = await verifyLicense(licenseKey);
        if (!lic.ok) return lic;
        if (!Array.isArray(times) || times.length > PUSH_SCHEDULE_MAX_TIMES) return { ok: false, status: 400, reason: 'schedule:shape' };
        const at = now();
        const clean = [];
        for (const t of times) {
            if (typeof t !== 'number' || !isFinite(t)) return { ok: false, status: 400, reason: 'schedule:time' };
            if (t > at && t <= at + PUSH_SCHEDULE_HORIZON_MS) clean.push(Math.floor(t));
        }
        clean.sort((a, b) => a - b);
        await store.setJSON('sched/' + lic.keyId, { times: clean, at: at });
        return { ok: true, status: 200, count: clean.length };
    }

    function fcmAccessToken() {
        if (fcmToken.token && fcmToken.exp - 5 * 60 * 1000 > now()) return Promise.resolve(fcmToken.token);
        if (fcmToken.inFlight) return fcmToken.inFlight;
        fcmToken.inFlight = fetchFcmAccessToken().finally(() => { fcmToken.inFlight = null; });
        return fcmToken.inFlight;
    }

    async function fetchFcmAccessToken() {
        const iat = Math.floor(now() / 1000);
        const header = b64urlEncode(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
        const claims = b64urlEncode(Buffer.from(JSON.stringify({
            iss: cfg.fcm.clientEmail,
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
            aud: 'https://oauth2.googleapis.com/token',
            iat: iat,
            exp: iat + 3600
        })));
        const signed = header + '.' + claims;
        const sig = crypto.sign('RSA-SHA256', Buffer.from(signed), cfg.fcm.privateKey);
        const body = 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + signed + '.' + b64urlEncode(sig);
        const res = await fetchJson('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        }, PUSH_SEND_TIMEOUT_MS);
        if (!res.ok || !res.body || typeof res.body.access_token !== 'string') return '';
        fcmToken.token = res.body.access_token;
        fcmToken.exp = now() + (Number(res.body.expires_in) || 3600) * 1000;
        return fcmToken.token;
    }

    async function sendWeb(record, message) {
        if (!cfg.vapid) return 'skip';
        let body;
        try {
            body = encryptWebPushPayload(Buffer.from(JSON.stringify(message), 'utf8'), record.p256dh, record.auth);
        } catch (_) {
            return 'gone';
        }
        const out = await settleWithin(async () => {
            const res = await fetchImpl(record.endpoint, {
                method: 'POST',
                headers: {
                    Authorization: vapidAuthorization(record.endpoint, cfg.vapid, now()),
                    TTL: String(PUSH_TTL_SECONDS),
                    Urgency: message.urgency || 'normal',
                    Topic: String(message.tag || 'zoew').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'zoew',
                    'Content-Encoding': 'aes128gcm',
                    'Content-Type': 'application/octet-stream'
                },
                body: body
            });
            try { await res.text(); } catch (_) {}
            return res.status;
        }, PUSH_SEND_TIMEOUT_MS);
        if (!out.ok) return 'fail';
        if (out.value === 404 || out.value === 410) return 'gone';
        return out.value >= 200 && out.value < 300 ? 'sent' : 'fail';
    }

    async function sendFcm(record, message) {
        if (!cfg.fcm) return 'skip';
        const token = await fcmAccessToken();
        if (!token) return 'fail';
        const res = await fetchJson('https://fcm.googleapis.com/v1/projects/' + cfg.fcm.projectId + '/messages:send', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: {
                    token: record.token,
                    notification: { title: message.title, body: message.body },
                    data: { kind: String(message.kind || ''), url: String(message.url || PUSH_OPEN_URL), tag: String(message.tag || '') },
                    android: {
                        priority: 'HIGH',
                        ttl: PUSH_TTL_SECONDS + 's',
                        notification: {
                            channel_id: FCM_CHANNEL_ID,
                            tag: String(message.tag || 'zoew'),
                            sound: 'default',
                            default_vibrate_timings: true,
                            notification_priority: 'PRIORITY_HIGH'
                        }
                    }
                }
            })
        }, PUSH_SEND_TIMEOUT_MS);
        if (res.ok) return 'sent';
        const status = res.body && res.body.error && res.body.error.status;
        const details = JSON.stringify((res.body && res.body.error && res.body.error.details) || []);
        if (res.status === 404 || status === 'NOT_FOUND' || details.indexOf('UNREGISTERED') !== -1) return 'gone';
        if (res.status === 400 && details.indexOf('INVALID_ARGUMENT') !== -1 && /token/i.test(JSON.stringify(res.body))) return 'gone';
        if (res.status === 401) fcmToken.token = '';
        return 'fail';
    }

    async function sendToKeys(keys, message, startedAt) {
        const tally = { sent: 0, gone: 0, fail: 0, skip: 0, cut: 0 };
        let i = 0;
        async function worker() {
            while (i < keys.length) {
                if (elapsedSince(startedAt, now()) > PUSH_RUN_BUDGET_MS) { tally.cut += keys.length - i; i = keys.length; return; }
                const key = keys[i++];
                let rec = null;
                try { rec = await readJson(key); } catch (_) { rec = null; }
                if (!rec || !rec.data) { tally.skip++; continue; }
                let verdict = 'fail';
                try {
                    verdict = rec.data.kind === 'fcm' ? await sendFcm(rec.data, message) : await sendWeb(rec.data, message);
                } catch (_) { verdict = 'fail'; }
                tally[verdict] = (tally[verdict] || 0) + 1;
                if (verdict === 'gone') {
                    await store.delete(key).catch(() => {});
                    if (KEY_ID_RE.test(String(rec.data.keyId || ''))) await updateIndex(rec.data.keyId, (list) => list.filter((k) => k !== key)).catch(() => null);
                }
            }
        }
        const workers = [];
        for (let w = 0; w < Math.min(PUSH_SEND_CONCURRENCY, keys.length); w++) workers.push(worker());
        await Promise.all(workers);
        return tally;
    }

    async function allSubscriptionKeys() {
        const listed = await store.list({ prefix: 'sub/' });
        return listed && Array.isArray(listed.blobs) ? listed.blobs.map((b) => b.key).filter((k) => typeof k === 'string') : [];
    }

    async function readNotices() {
        const url = cfg.licenseDbUrl + '/license_announcements/' + LICENSE_APP_CODE + '.json?orderBy=%22%24key%22&limitToLast=' + PUSH_NOTICE_READ_LIMIT;
        const res = await fetchJson(url, { method: 'GET' });
        if (!res.ok || res.body === undefined) return null;
        if (res.body === null) return [];
        if (typeof res.body !== 'object' || Array.isArray(res.body)) return null;
        return Object.keys(res.body).filter((id) => NOTICE_ID_RE.test(id)).sort().map((id) => ({ id: id, value: res.body[id] }));
    }

    function noticeMessage(notice) {
        const v = notice.value && typeof notice.value === 'object' ? notice.value : {};
        const kind = PUSH_NOTICE_KINDS.indexOf(v.kind) === -1 ? 'notice' : v.kind;
        const title = String(v.title || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, PUSH_TITLE_MAX);
        const body = String(v.body || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, PUSH_BODY_MAX);
        return {
            kind: kind,
            title: (kind === 'maintenance' ? '🛠️ ' : '📢 ') + (title || 'ZoeW'),
            body: body || (kind === 'maintenance' ? 'ការថែទាំប្រព័ន្ធ' : 'សេចក្តីប្រកាសថ្មី'),
            tag: 'notice-' + notice.id,
            url: PUSH_OPEN_URL,
            urgency: 'high'
        };
    }

    async function dispatchNotices() {
        const startedAt = now();
        const notices = await readNotices();
        if (!notices) return { ok: false, reason: 'notices:read' };
        const latest = notices.length ? notices[notices.length - 1].id : '';
        const ledger = await readJson('state/notices');
        if (!ledger) {
            await store.setJSON('state/notices', { lastId: latest, at: startedAt }, { onlyIfNew: true });
            return { ok: true, reason: 'baseline', sent: 0 };
        }
        const lastId = ledger.data && typeof ledger.data.lastId === 'string' ? ledger.data.lastId : '';
        const fresh = notices.filter((n) => n.id > lastId);
        if (!fresh.length) return { ok: true, reason: 'none', sent: 0 };
        const claim = await store.setJSON('state/notices', { lastId: fresh[fresh.length - 1].id, at: startedAt }, { onlyIfMatch: ledger.etag });
        if (!claim || !claim.modified) return { ok: true, reason: 'race', sent: 0 };
        const due = fresh.filter((n) => {
            const at = n.value && typeof n.value.at === 'number' ? n.value.at : Number(n.id.slice(1, 14));
            return elapsedSince(at, startedAt) <= PUSH_NOTICE_MAX_AGE_MS;
        }).slice(-PUSH_NOTICE_PER_RUN_MAX);
        if (!due.length) return { ok: true, reason: 'stale', sent: 0 };
        const keys = await allSubscriptionKeys();
        const total = { sent: 0, gone: 0, fail: 0, skip: 0, cut: 0, notices: due.length };
        for (const notice of due) {
            const tally = await sendToKeys(keys, noticeMessage(notice), startedAt);
            Object.keys(tally).forEach((k) => { total[k] = (total[k] || 0) + tally[k]; });
        }
        return Object.assign({ ok: true, reason: 'sent' }, total);
    }

    function zoneParts(ms) {
        const d = new Date(ms + APP_ZONE_OFFSET_MS);
        const pad = (n) => String(n).padStart(2, '0');
        return {
            day: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()),
            hour: d.getUTCHours(),
            clock: pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()),
            short: pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1)
        };
    }

    function expiryMessage(count, scheduleAt) {
        const when = zoneParts(scheduleAt);
        return {
            kind: 'expiry',
            title: '📦 ' + count + ' កញ្ចប់ជិតផុតកំណត់',
            body: 'នឹងផុតកំណត់ក្នុង ២៤ ម៉ោង ➜ ប្រព័ន្ធដកចេញ (ដកលុយ) បើមិនទាន់យក · តាមទិន្នន័យម៉ោង ' + when.clock + ' ' + when.short,
            tag: 'expiry',
            url: PUSH_OPEN_URL,
            urgency: 'normal'
        };
    }

    async function dispatchExpiry() {
        const startedAt = now();
        const zone = zoneParts(startedAt);
        if (zone.hour !== PUSH_EXPIRY_HOUR) return { ok: true, reason: 'not-hour', sent: 0 };
        const listed = await store.list({ prefix: 'sched/' });
        const scheds = listed && Array.isArray(listed.blobs) ? listed.blobs.map((b) => b.key) : [];
        const total = { ok: true, reason: 'done', sent: 0, gone: 0, fail: 0, skip: 0, cut: 0, keys: 0 };
        for (const schedKey of scheds) {
            if (elapsedSince(startedAt, now()) > PUSH_RUN_BUDGET_MS) { total.cut++; continue; }
            const keyId = schedKey.slice('sched/'.length);
            if (!KEY_ID_RE.test(keyId)) continue;
            const sched = await readJson(schedKey);
            if (!sched || !sched.data || !Array.isArray(sched.data.times)) continue;
            if (elapsedSince(sched.data.at, startedAt) > PUSH_SCHEDULE_MAX_AGE_MS) continue;
            const count = sched.data.times.filter((t) => typeof t === 'number' && t > startedAt && t <= startedAt + PUSH_EXPIRY_WINDOW_MS).length;
            if (!count) continue;
            const ledgerKey = 'state/expiry/' + keyId;
            const ledger = await readJson(ledgerKey);
            if (ledger && ledger.data && ledger.data.day === zone.day) continue;
            const claim = await store.setJSON(ledgerKey, { day: zone.day, at: startedAt }, ledger ? { onlyIfMatch: ledger.etag } : { onlyIfNew: true });
            if (!claim || !claim.modified) continue;
            const index = await readJson('bykey/' + keyId);
            const keys = index && index.data && Array.isArray(index.data.subs) ? index.data.subs.filter((k) => typeof k === 'string') : [];
            if (!keys.length) continue;
            total.keys++;
            const tally = await sendToKeys(keys, expiryMessage(count, sched.data.at), startedAt);
            Object.keys(tally).forEach((k) => { total[k] = (total[k] || 0) + tally[k]; });
        }
        return total;
    }

    return {
        config: cfg,
        verifyLicense: verifyLicense,
        subscribe: subscribe,
        unsubscribe: unsubscribe,
        saveSchedule: saveSchedule,
        dispatchNotices: dispatchNotices,
        dispatchExpiry: dispatchExpiry,
        noticeMessage: noticeMessage,
        expiryMessage: expiryMessage,
        sendToKeys: sendToKeys
    };
}

export const PUSH_CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '7200'
};

export function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status: status,
        headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, PUSH_CORS_HEADERS)
    });
}

const kickState = { at: 0, inFlight: null };
export const PUSH_KICK_MIN_GAP_MS = 5000;

export async function handlePushRequest(req, service, nowFn) {
    const now = nowFn || (() => Date.now());
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: PUSH_CORS_HEADERS });
    const url = new URL(req.url);
    const op = url.searchParams.get('op') || '';
    if (req.method === 'GET' && op === 'config') {
        return jsonResponse(200, {
            vapidPublicKey: service.config.vapid ? service.config.vapid.publicKey : '',
            web: !!service.config.vapid,
            fcm: !!service.config.fcm
        });
    }
    if (req.method !== 'POST') return jsonResponse(405, { ok: false, reason: 'method' });
    if (op === 'kick') {
        if (kickState.inFlight) return jsonResponse(202, { ok: true, reason: 'busy' });
        if (elapsedSince(kickState.at, now()) < PUSH_KICK_MIN_GAP_MS) return jsonResponse(202, { ok: true, reason: 'throttled' });
        kickState.at = now();
        kickState.inFlight = service.dispatchNotices().catch(() => ({ ok: false, reason: 'error' }));
        try {
            const out = await kickState.inFlight;
            return jsonResponse(200, { ok: !!out.ok, reason: out.reason, sent: out.sent || 0 });
        } finally {
            kickState.inFlight = null;
        }
    }
    let body = null;
    try {
        const text = await req.text();
        if (text.length > 64 * 1024) return jsonResponse(413, { ok: false, reason: 'body:size' });
        body = text ? JSON.parse(text) : null;
    } catch (_) { body = null; }
    if (!body || typeof body !== 'object') return jsonResponse(400, { ok: false, reason: 'body:json' });
    let out;
    if (op === 'subscribe') out = await service.subscribe(body.license, body.sub, body.platform);
    else if (op === 'unsubscribe') out = await service.unsubscribe(body.sub);
    else if (op === 'schedule') out = await service.saveSchedule(body.license, body.times);
    else return jsonResponse(404, { ok: false, reason: 'op' });
    return jsonResponse(out.status || (out.ok ? 200 : 400), { ok: !!out.ok, reason: out.reason || '' });
}

export function resetPushStateForTests() {
    kickState.at = 0;
    kickState.inFlight = null;
}
