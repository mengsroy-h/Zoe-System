(function (global) {
    'use strict';

    const PUBLIC_KEYS_JWK = [
        {
            "key_ops": ["verify"],
            "ext": true,
            "kty": "EC",
            "x": "jxAByrOhnR-oWCdhyWt7hsJMpz2gzLjIYYVDhwg3ZLs",
            "y": "uZohHyeHFD3gAWST4Tc1vCKCkndzmwGPCUdhLAN1MM0",
            "crv": "P-256"
        }
    ];

    const KEY_PREFIX = 'ZOEKEY-';
    const OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
    const DEVICE_ID_KEY = 'zoe_license_device_id';
    const DEVICE_ID_RE = /^[0-9A-Z]{20,32}$/;

    let serverTimeOffsetMs = 0;
    let serverTimeSynced = false;
    function getServerNow() {
        return Date.now() + serverTimeOffsetMs;
    }

    let cachedPublicKeys = null;
    async function getPublicKeys() {
        if (cachedPublicKeys) return cachedPublicKeys;
        cachedPublicKeys = await Promise.all(PUBLIC_KEYS_JWK.map((jwk) => crypto.subtle.importKey(
            'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
        )));
        return cachedPublicKeys;
    }

    function b64urlToBytes(b64url) {
        const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
        const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    function bytesToB64url(bytes) {
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function bytesToBase32(bytes) {
        const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
        let bits = 0, value = 0, output = '';
        for (let i = 0; i < bytes.length; i++) {
            value = (value << 8) | bytes[i];
            bits += 8;
            while (bits >= 5) {
                output += alphabet[(value >>> (bits - 5)) & 31];
                bits -= 5;
            }
        }
        if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
        return output;
    }

    function randomKeyId() {
        const bytes = crypto.getRandomValues(new Uint8Array(15));
        return bytesToBase32(bytes);
    }

    function parseKeyString(keyString) {
        if (typeof keyString !== 'string') return null;
        const trimmed = keyString.trim();
        if (!trimmed.startsWith(KEY_PREFIX)) return null;
        const body = trimmed.slice(KEY_PREFIX.length);
        const parts = body.split('.');
        if (parts.length !== 2) return null;
        const [payloadB64, sigB64] = parts;
        let payload;
        try {
            payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
        } catch (e) {
            return null;
        }
        if (!payload || typeof payload !== 'object') return null;
        if (typeof payload.a !== 'string' || typeof payload.id !== 'string' ||
            typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
            return null;
        }
        let sigBytes;
        try {
            sigBytes = b64urlToBytes(sigB64);
        } catch (e) {
            return null;
        }
        return { payload, payloadB64, sigBytes };
    }

    async function verifySignature(payloadB64, sigBytes) {
        const pubKeys = await getPublicKeys();
        const data = new TextEncoder().encode(payloadB64);
        for (const pubKey of pubKeys) {
            if (await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, sigBytes, data)) {
                return true;
            }
        }
        return false;
    }

    async function verifySignatureAndScope(keyString, appCode) {
        const parsed = parseKeyString(keyString);
        if (!parsed) return { valid: false, reason: 'format' };
        let sigOk;
        try {
            sigOk = await verifySignature(parsed.payloadB64, parsed.sigBytes);
        } catch (e) {
            return { valid: false, reason: 'verify-unavailable', unverified: true, payload: parsed.payload };
        }
        if (!sigOk) return { valid: false, reason: 'signature' };
        if (parsed.payload.a !== appCode && parsed.payload.a !== 'ALL') {
            return { valid: false, reason: 'app-mismatch', payload: parsed.payload };
        }
        return { valid: true, payload: parsed.payload };
    }

    async function verifyKeyString(keyString, appCode) {
        const result = await verifySignatureAndScope(keyString, appCode);
        if (!result.valid) return result;
        if (getServerNow() > result.payload.exp * 1000) {
            return { valid: false, reason: 'expired', payload: result.payload };
        }
        return result;
    }

    function storageKey(appCode) {
        return 'zoe_license_activation_' + appCode;
    }

    function loadLocalRecord(appCode) {
        try {
            const raw = localStorage.getItem(storageKey(appCode));
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function saveLocalRecord(appCode, record) {
        try { localStorage.setItem(storageKey(appCode), JSON.stringify(record)); } catch (e) {}
    }

    function clearLocalRecord(appCode) {
        try { localStorage.removeItem(storageKey(appCode)); } catch (e) {}
    }

    function getDeviceId() {
        let existing = null;
        try { existing = localStorage.getItem(DEVICE_ID_KEY); } catch (e) { return null; }
        if (typeof existing === 'string' && DEVICE_ID_RE.test(existing)) return existing;
        let fresh;
        try { fresh = bytesToBase32(crypto.getRandomValues(new Uint8Array(15))); } catch (e) { return null; }
        try { localStorage.setItem(DEVICE_ID_KEY, fresh); } catch (e) { return null; }
        try { return localStorage.getItem(DEVICE_ID_KEY) === fresh ? fresh : null; } catch (e) { return null; }
    }

    async function activate(keyString, appCode) {
        const result = await verifySignatureAndScope(keyString, appCode);
        if (!result.valid) return result;
        const online = await checkOnline(appCode, result.payload.id, { priority: true, claimSeat: true });
        if (online.ok !== true) {
            return { valid: false, reason: online.reason || 'network', payload: result.payload };
        }
        if (!serverTimeSynced) await syncServerTime({ priority: true });
        if (!serverTimeSynced) {
            return { valid: false, reason: 'clock-unverified', payload: result.payload };
        }
        if (online.seat !== 'mine') {
            let seatReason = 'network';
            if (online.seat === 'no-device') seatReason = 'device-unverified';
            else if (online.seat === 'seat-unavailable') seatReason = 'seat-unavailable';
            return { valid: false, reason: seatReason, payload: result.payload };
        }
        const now = getServerNow();
        const ceiling = typeof online.expiresAt === 'number' ? online.expiresAt : result.payload.exp * 1000;
        if (now > ceiling) {
            return { valid: false, reason: 'expired', payload: result.payload };
        }
        const record = {
            keyString: keyString.trim(),
            id: result.payload.id,
            a: result.payload.a,
            iat: result.payload.iat,
            exp: result.payload.exp,
            note: result.payload.note || '',
            lastOnlineCheck: now,
            onlineExp: ceiling,
            seenMax: now
        };
        saveLocalRecord(appCode, record);
        return { valid: true, payload: result.payload };
    }

    const LICENSE_DB_URL = 'https://zoew-z1-default-rtdb.firebaseio.com';

    const NET_TIMEOUT_MS = 10000;
    const NET_MAX_IN_FLIGHT = 2;
    const netInFlight = new Map();

    function networkLooksDown() {
        return typeof navigator !== 'undefined' && navigator.onLine === false;
    }

    function sharedRequest(key, priority, run) {
        const existing = netInFlight.get(key);
        if (existing) return existing;
        if (!priority && netInFlight.size >= NET_MAX_IN_FLIGHT) return null;
        const started = run();
        netInFlight.set(key, started);
        const release = () => { netInFlight.delete(key); };
        started.then(release, release);
        return started;
    }

    async function fetchWithBodyTimeout(url, readBody, init) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), NET_TIMEOUT_MS);
        try {
            const res = await fetch(url, Object.assign({ cache: 'no-store' }, init || {}, { signal: controller.signal }));
            const body = readBody ? await readBody(res) : undefined;
            return { res: res, body: body };
        } finally {
            clearTimeout(timer);
        }
    }

    async function checkOnline(appCode, keyId, opts) {
        if (!LICENSE_DB_URL || LICENSE_DB_URL.indexOf('REPLACE_WITH') === 0) {
            return { ok: null, reason: 'not-configured' };
        }
        const priority = !!(opts && opts.priority);
        if (!priority && networkLooksDown()) return { ok: null, reason: 'network' };
        try {
            const url = LICENSE_DB_URL.replace(/\/+$/, '') + '/license_keys/' + appCode + '/' + keyId + '.json';
            const pending = sharedRequest('key:' + appCode + '/' + keyId, priority,
                () => fetchWithBodyTimeout(url, (r) => (r.ok ? r.json() : null)));
            if (!pending) return { ok: null, reason: 'network' };
            const out = await pending;
            const res = out.res;
            const dateHeader = res.headers.get('Date');
            if (dateHeader) {
                const serverMs = new Date(dateHeader).getTime();
                if (!isNaN(serverMs)) {
                    serverTimeOffsetMs = serverMs - Date.now();
                    serverTimeSynced = true;
                }
            }
            if (!res.ok) return { ok: null, reason: 'network' };
            const data = out.body;
            if (data === null || data === undefined) return { ok: false, reason: 'not-found' };
            if (data.revoked === true) return { ok: false, reason: 'revoked' };
            if (typeof data.expiresAt === 'number' && getServerNow() > data.expiresAt) {
                return { ok: false, reason: 'expired-server' };
            }
            const deviceId = getDeviceId();
            const seat = await readSeat(appCode, keyId, deviceId, priority);
            if (seat.ok === false) return { ok: false, reason: 'seat-taken' };
            if (seat.ok === true) return { ok: true, expiresAt: data.expiresAt, seat: 'mine' };
            if (seat.unclaimed && opts && opts.claimSeat) {
                const claimed = await claimSeat(appCode, keyId, deviceId, priority);
                if (claimed.ok === false) return { ok: false, reason: 'seat-taken' };
                if (claimed.ok === true) return { ok: true, expiresAt: data.expiresAt, seat: 'mine' };
            }
            const seatState = (seat.reason === 'no-device' || seat.reason === 'seat-unavailable') ? seat.reason : 'unknown';
            return { ok: true, expiresAt: data.expiresAt, seat: seatState };
        } catch (e) {
            return { ok: null, reason: 'network' };
        }
    }

    function licenseSeatUrl(appCode, keyId) {
        return LICENSE_DB_URL.replace(/\/+$/, '') + '/license_seats/' + appCode + '/' + keyId + '.json';
    }

    async function readSeat(appCode, keyId, deviceId, priority) {
        if (!deviceId) return { ok: null, reason: 'no-device' };
        try {
            const pending = sharedRequest('seat:' + appCode + '/' + keyId, priority,
                () => fetchWithBodyTimeout(licenseSeatUrl(appCode, keyId), (r) => (r.ok ? r.json() : null)));
            if (!pending) return { ok: null, reason: 'network' };
            const out = await pending;
            if (out.res.status === 401 || out.res.status === 403) return { ok: null, reason: 'seat-unavailable' };
            if (!out.res.ok) return { ok: null, reason: 'network' };
            const data = out.body;
            const holder = (data && typeof data.device === 'string') ? data.device : '';
            if (!holder) return { ok: null, reason: 'unclaimed', unclaimed: true };
            return holder === deviceId ? { ok: true } : { ok: false, reason: 'seat-taken' };
        } catch (e) {
            return { ok: null, reason: 'network' };
        }
    }

    async function claimSeat(appCode, keyId, deviceId, priority) {
        if (!deviceId) return { ok: null, reason: 'no-device' };
        const stamp = Math.round(getServerNow());
        const body = JSON.stringify({ device: deviceId, at: stamp > 0 ? stamp : 1 });
        try {
            const pending = sharedRequest('seat-claim:' + appCode + '/' + keyId, priority,
                () => fetchWithBodyTimeout(licenseSeatUrl(appCode, keyId), null, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: body
                }));
            if (!pending) return { ok: null, reason: 'network' };
            const out = await pending;
            if (out.res.ok) return { ok: true };
            if (out.res.status === 401 || out.res.status === 403) return { ok: false, reason: 'seat-taken' };
            return { ok: null, reason: 'network' };
        } catch (e) {
            return { ok: null, reason: 'network' };
        }
    }

    async function syncServerTime(opts) {
        if (!LICENSE_DB_URL || LICENSE_DB_URL.indexOf('REPLACE_WITH') === 0) return false;
        const priority = !!(opts && opts.priority);
        if (!priority && networkLooksDown()) return false;
        try {
            const pending = sharedRequest('time', priority,
                () => fetchWithBodyTimeout(LICENSE_DB_URL.replace(/\/+$/, '') + '/.json?shallow=true', (r) => r.text()));
            if (!pending) return false;
            const out = await pending;
            const res = out.res;
            const dateHeader = res.headers.get('Date');
            if (!dateHeader) return false;
            const serverMs = new Date(dateHeader).getTime();
            if (isNaN(serverMs)) return false;
            serverTimeOffsetMs = serverMs - Date.now();
            serverTimeSynced = true;
            return true;
        } catch (e) {
            return false;
        }
    }

    function setServerTimeOffset(ms) {
        if (typeof ms === 'number' && !isNaN(ms)) {
            serverTimeOffsetMs = ms;
            serverTimeSynced = true;
        }
    }

    function getServerTimeOffset() {
        return serverTimeSynced ? serverTimeOffsetMs : null;
    }

    function recordSeenMark(record) {
        return (record && typeof record.seenMax === 'number' && record.seenMax > 0) ? record.seenMax : 0;
    }

    function monotonicNow(record) {
        const raw = getServerNow();
        const mark = recordSeenMark(record);
        return raw > mark ? raw : mark;
    }


    const statusInFlight = new Map();

    function getStatus(appCode) {
        const record = loadLocalRecord(appCode);
        const requestKey = appCode + ':' + JSON.stringify(record);
        const existing = statusInFlight.get(requestKey);
        if (existing) return existing;
        const pending = checkLocalStatus(appCode, record, 0);
        statusInFlight.set(requestKey, pending);
        const release = () => { statusInFlight.delete(requestKey); };
        pending.then(release, release);
        return pending;
    }

    async function checkLocalStatus(appCode, record, retryCount) {
        if (!record) return { state: 'required' };
        const recordSnapshot = JSON.stringify(record);
        const maxRechecks = 2;
        const recheck = () => (retryCount || 0) < maxRechecks
            ? checkLocalStatus(appCode, loadLocalRecord(appCode), (retryCount || 0) + 1)
            : { state: 'required', reason: 'verify-unavailable' };

        const sigCheck = await verifySignatureAndScope(record.keyString, appCode);
        if (JSON.stringify(loadLocalRecord(appCode)) !== recordSnapshot) return recheck();
        if (!sigCheck.valid && !sigCheck.unverified) {
            clearLocalRecord(appCode);
            return { state: 'required', reason: sigCheck.reason };
        }

        const online = await checkOnline(appCode, record.id, { claimSeat: true });
        if (JSON.stringify(loadLocalRecord(appCode)) !== recordSnapshot) return recheck();
        if (online.ok === false) {
            clearLocalRecord(appCode);
            return { state: 'required', reason: online.reason };
        }

        let now = monotonicNow(record);
        if (online.ok === true) {
            if (serverTimeSynced) {
                now = getServerNow();
                record.seenMax = now;
            }
            record.lastOnlineCheck = now;
            record.onlineExp = online.expiresAt;
            saveLocalRecord(appCode, record);
        } else if (now > recordSeenMark(record)) {
            record.seenMax = now;
            saveLocalRecord(appCode, record);
        }

        const ceiling = typeof record.onlineExp === 'number' ? record.onlineExp : record.exp * 1000;

        if (now > ceiling) {
            if (online.ok === true) {
                clearLocalRecord(appCode);
                return { state: 'required', reason: 'expired' };
            }
            return { state: 'offline-grace-exceeded', exp: ceiling, note: record.note };
        }

        if (now - (record.lastOnlineCheck || 0) > OFFLINE_GRACE_MS) {
            return { state: 'offline-grace-exceeded', exp: ceiling, note: record.note };
        }

        return {
            state: 'active',
            exp: ceiling,
            note: record.note,
            daysLeft: Math.max(0, Math.ceil((ceiling - now) / 86400000))
        };
    }

    function deactivate(appCode) {
        clearLocalRecord(appCode);
    }

    async function importPrivateKey(privateJwk) {
        return crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    }

    async function signNewKey(privateKeyJwk, opts) {
        const appCode = opts.appCode;
        const days = opts.days;
        const note = opts.note;
        const id = randomKeyId();
        const now = Math.floor(getServerNow() / 1000);
        const exp = now + Math.round(days * 86400);
        const payload = { a: appCode, id: id, iat: now, exp: exp };
        if (note) payload.note = String(note).slice(0, 60);
        const payloadB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
        const privKey = await importPrivateKey(privateKeyJwk);
        const sigBuf = await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' }, privKey, new TextEncoder().encode(payloadB64)
        );
        const sigB64 = bytesToB64url(new Uint8Array(sigBuf));
        return { keyString: KEY_PREFIX + payloadB64 + '.' + sigB64, payload: payload };
    }

    async function generateKeyPair() {
        const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
        const publicKeyJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
        const privateKeyJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
        return { publicKeyJwk: publicKeyJwk, privateKeyJwk: privateKeyJwk };
    }

    global.ZoeLicense = {
        KEY_PREFIX: KEY_PREFIX,
        activate: activate,
        getStatus: getStatus,
        getDeviceId: getDeviceId,
        deactivate: deactivate,
        verifyKeyString: verifyKeyString,
        parseKeyString: parseKeyString,
        checkOnline: checkOnline,
        signNewKey: signNewKey,
        generateKeyPair: generateKeyPair,
        getServerNow: getServerNow,
        syncServerTime: syncServerTime,
        setServerTimeOffset: setServerTimeOffset,
        getServerTimeOffset: getServerTimeOffset
    };
})(window);
