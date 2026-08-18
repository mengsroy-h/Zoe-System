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

    let serverTimeOffsetMs = 0;
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
        try {
            const pubKeys = await getPublicKeys();
            const data = new TextEncoder().encode(payloadB64);
            for (const pubKey of pubKeys) {
                if (await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, sigBytes, data)) {
                    return true;
                }
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    async function verifySignatureAndScope(keyString, appCode) {
        const parsed = parseKeyString(keyString);
        if (!parsed) return { valid: false, reason: 'format' };
        const sigOk = await verifySignature(parsed.payloadB64, parsed.sigBytes);
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

    async function activate(keyString, appCode) {
        const result = await verifyKeyString(keyString, appCode);
        if (!result.valid) return result;
        const record = {
            keyString: keyString.trim(),
            id: result.payload.id,
            a: result.payload.a,
            iat: result.payload.iat,
            exp: result.payload.exp,
            note: result.payload.note || '',
            lastOnlineCheck: getServerNow(),
            onlineExp: result.payload.exp * 1000
        };
        saveLocalRecord(appCode, record);
        return { valid: true, payload: result.payload };
    }

    const LICENSE_DB_URL = 'https://zoew-z1-default-rtdb.firebaseio.com';

    async function checkOnline(appCode, keyId) {
        if (!LICENSE_DB_URL || LICENSE_DB_URL.indexOf('REPLACE_WITH') === 0) {
            return { ok: null, reason: 'not-configured' };
        }
        try {
            const url = LICENSE_DB_URL.replace(/\/+$/, '') + '/license_keys/' + appCode + '/' + keyId + '.json';
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            let res;
            try {
                res = await fetch(url, { cache: 'no-store', signal: controller.signal });
            } finally {
                clearTimeout(timer);
            }
            if (!res.ok) return { ok: null, reason: 'network' };
            const dateHeader = res.headers.get('Date');
            if (dateHeader) {
                const serverMs = new Date(dateHeader).getTime();
                if (!isNaN(serverMs)) serverTimeOffsetMs = serverMs - Date.now();
            }
            const data = await res.json();
            if (data === null || data === undefined) return { ok: false, reason: 'not-found' };
            if (data.revoked === true) return { ok: false, reason: 'revoked' };
            if (typeof data.expiresAt === 'number' && getServerNow() > data.expiresAt) {
                return { ok: false, reason: 'expired-server' };
            }
            return { ok: true, expiresAt: data.expiresAt };
        } catch (e) {
            return { ok: null, reason: 'network' };
        }
    }

    async function syncServerTime() {
        if (!LICENSE_DB_URL || LICENSE_DB_URL.indexOf('REPLACE_WITH') === 0) return false;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            let res;
            try {
                res = await fetch(LICENSE_DB_URL.replace(/\/+$/, '') + '/.json?shallow=true', { cache: 'no-store', signal: controller.signal });
            } finally {
                clearTimeout(timer);
            }
            const dateHeader = res.headers.get('Date');
            if (!dateHeader) return false;
            const serverMs = new Date(dateHeader).getTime();
            if (isNaN(serverMs)) return false;
            serverTimeOffsetMs = serverMs - Date.now();
            return true;
        } catch (e) {
            return false;
        }
    }

    function setServerTimeOffset(ms) {
        if (typeof ms === 'number' && !isNaN(ms)) serverTimeOffsetMs = ms;
    }

    async function getStatus(appCode) {
        const record = loadLocalRecord(appCode);
        if (!record) return { state: 'required' };

        const sigCheck = await verifySignatureAndScope(record.keyString, appCode);
        if (!sigCheck.valid) {
            clearLocalRecord(appCode);
            return { state: 'required', reason: sigCheck.reason };
        }

        const now = getServerNow();

        const online = await checkOnline(appCode, record.id);
        if (online.ok === true) {
            record.lastOnlineCheck = now;
            record.onlineExp = online.expiresAt;
            saveLocalRecord(appCode, record);
        } else if (online.ok === false) {
            clearLocalRecord(appCode);
            return { state: 'required', reason: online.reason };
        }

        const ceiling = typeof record.onlineExp === 'number' ? record.onlineExp : record.exp * 1000;

        if (now > ceiling) {
            clearLocalRecord(appCode);
            return { state: 'required', reason: 'expired' };
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
        deactivate: deactivate,
        verifyKeyString: verifyKeyString,
        parseKeyString: parseKeyString,
        checkOnline: checkOnline,
        signNewKey: signNewKey,
        generateKeyPair: generateKeyPair,
        getServerNow: getServerNow,
        syncServerTime: syncServerTime,
        setServerTimeOffset: setServerTimeOffset
    };
})(window);
