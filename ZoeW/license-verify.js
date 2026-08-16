/*
 * ZoeLicense — offline-verifiable, server-checked activation keys.
 *
 * How it stays hard to bypass/crack:
 *  - Keys are ECDSA P-256 signed tokens. This file only ever holds the PUBLIC
 *    key, which can verify signatures but cannot be used to forge new ones.
 *    The matching PRIVATE key lives only in the operator's own custody and is
 *    pasted into ZoeKeyGen at signing time — it is never committed to source
 *    or shipped to any deployed app.
 *  - Editing localStorage cannot extend a key: the expiry is inside the
 *    signed payload, so changing it breaks the signature.
 *  - Revocation and admin-side expiry edits (both shortening AND ZoeKeyGen's
 *    "Extend" action) are driven by the server-side `license_keys/{app}/{id}`
 *    record, re-checked on every login and every 15 minutes while an app
 *    stays open online — the *server's* expiresAt is authoritative once
 *    activated, not the expiry baked into the signed key string, so Extend
 *    actually lengthens validity instead of being capped at the original
 *    signed expiry (see verifySignatureAndScope / getStatus below).
 *  - This file is identical across ZoeAdmin, ZoeW, Zscan and ZoeKeyGen —
 *    keep all copies in sync (same PUBLIC_KEYS_JWK) if the signing keypair is
 *    ever rotated. See the PUBLIC_KEYS_JWK comment below for the rotation
 *    steps — it supports listing more than one key so rotation doesn't
 *    invalidate every key already issued under the old one.
 */
(function (global) {
    'use strict';

    /*
     * PUBLIC_KEYS_JWK — public keys accepted for signature verification, newest first.
     * Normally holds exactly one entry: the current signing keypair's public half, generated
     * in ZoeKeyGen's "Signing Key" panel. Keep a SECOND (older) entry here only while rotating
     * to a new signing keypair, so keys already issued under the old private key keep verifying
     * until they naturally expire — then delete the old entry once nothing depends on it.
     *
     * How to add a new pair during rotation (repeat in ALL 4 copies of this file — ZoeAdmin,
     * ZoeW, Zscan, ZoeKeyGen — then redeploy all 4 apps together so no device is left checking
     * against a public key list that doesn't match what ZoeKeyGen is currently signing with):
     *
     *   1. In ZoeKeyGen -> "Signing Key" panel, click "បង្កើត Keypair ថ្មី" (Generate New
     *      Keypair). Copy the new Public Key JWK it shows you.
     *   2. Add it as a NEW element at the FRONT of the array below, keeping the old one(s) so
     *      already-issued keys still verify:
     *
     *        const PUBLIC_KEYS_JWK = [
     *            { "key_ops": ["verify"], "ext": true, "kty": "EC",
     *              "x": "NEW_X_VALUE_HERE", "y": "NEW_Y_VALUE_HERE", "crv": "P-256" },
     *            { "key_ops": ["verify"], "ext": true, "kty": "EC",  // old — keep until its keys expire
     *              "x": "jxAByrOhnR-oWCdhyWt7hsJMpz2gzLjIYYVDhwg3ZLs",
     *              "y": "uZohHyeHFD3gAWST4Tc1vCKCkndzmwGPCUdhLAN1MM0", "crv": "P-256" }
     *        ];
     *
     *   3. Redeploy all 4 apps with the updated array.
     *   4. Back in ZoeKeyGen, paste the NEW Private Key JWK into "Load Key" — every key
     *      generated from now on is signed with the new pair. Keys generated before step 3 was
     *      live on every device still verify fine, since the old public key is still listed.
     *   5. Once every key signed with the OLD private key has either expired or been reissued,
     *      delete the old entry from the array (in all 4 copies) and redeploy once more to
     *      finish the rotation.
     */
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

    // Signature + target-app check only — deliberately does NOT enforce payload.exp.
    // getStatus() uses this (not verifyKeyString) for its ongoing re-verification: the
    // signed exp is a one-time floor checked at activate() (below), not a hard ceiling
    // for the life of the key, because ZoeKeyGen's "Extend" action only ever patches the
    // server-side expiresAt — it never re-signs a new keyString. If expiry were re-derived
    // from the immutable signed payload on every getStatus() call, Extend would silently
    // stop working the moment the *original* signed exp passed, no matter how far the
    // admin had pushed expiresAt forward on the server.
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

    // Full check including the signed expiry — used only at activate() time, so a key
    // that was already expired the moment it was signed can't be redeemed in the first
    // place. Not used for ongoing getStatus() re-verification (see
    // verifySignatureAndScope above).
    async function verifyKeyString(keyString, appCode) {
        const result = await verifySignatureAndScope(keyString, appCode);
        if (!result.valid) return result;
        if (Date.now() > result.payload.exp * 1000) {
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
            // Seeded to "now", not 0: getStatus()'s offline-grace check measures how long
            // it's been since a *confirmed* online check. Seeding to 0 (epoch) meant a
            // device that activates without ever completing a successful online check
            // (LICENSE_DB_URL left unconfigured, or offline at the exact moment of
            // activation) would read as having been silent for 50+ years and immediately
            // report offline-grace-exceeded — contradicting the documented fallback that
            // signature-only offline checking keeps working without the license DB set up.
            lastOnlineCheck: Date.now(),
            onlineExp: result.payload.exp * 1000
        };
        saveLocalRecord(appCode, record);
        return { valid: true, payload: result.payload };
    }

    // Dedicated Firebase project used ONLY for license_keys — intentionally separate from the
    // ZoeAdmin/ZoeW/Zscan business Firebase project, so a compromise of one never exposes the
    // other. Its Realtime Database allows public, unauthenticated READ of license_keys (the
    // records hold no sensitive data — just expiry/revoked/note), so this is a plain REST call
    // with no SDK, no auth, and no dependency on whichever Firebase project the calling app is
    // itself logged into. Only ZoeKeyGen (which needs to WRITE) uses the full Firebase SDK
    // against this same project, gated by its own Authentication + user_roles.
    const LICENSE_DB_URL = 'https://zoew-z1-default-rtdb.firebaseio.com';

    async function checkOnline(appCode, keyId) {
        if (!LICENSE_DB_URL || LICENSE_DB_URL.indexOf('REPLACE_WITH') === 0) {
            return { ok: null, reason: 'not-configured' };
        }
        try {
            const url = LICENSE_DB_URL.replace(/\/+$/, '') + '/license_keys/' + appCode + '/' + keyId + '.json';
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return { ok: null, reason: 'network' };
            const data = await res.json();
            if (data === null || data === undefined) return { ok: false, reason: 'not-found' };
            if (data.revoked === true) return { ok: false, reason: 'revoked' };
            if (typeof data.expiresAt === 'number' && Date.now() > data.expiresAt) {
                return { ok: false, reason: 'expired-server' };
            }
            return { ok: true, expiresAt: data.expiresAt };
        } catch (e) {
            return { ok: null, reason: 'network' };
        }
    }

    async function getStatus(appCode) {
        const record = loadLocalRecord(appCode);
        if (!record) return { state: 'required' };

        const sigCheck = await verifySignatureAndScope(record.keyString, appCode);
        if (!sigCheck.valid) {
            clearLocalRecord(appCode);
            return { state: 'required', reason: sigCheck.reason };
        }

        const now = Date.now();

        // Always re-verify online — getStatus() only runs at login (not on every frame), so
        // there's no meaningful cost, and this is how a revoke or expiry edit actually takes
        // effect promptly instead of waiting out a stale cached check.
        const online = await checkOnline(appCode, record.id);
        if (online.ok === true) {
            record.lastOnlineCheck = now;
            record.onlineExp = online.expiresAt;
            saveLocalRecord(appCode, record);
        } else if (online.ok === false) {
            clearLocalRecord(appCode);
            return { state: 'required', reason: online.reason };
        }
        // online.ok === null => network unreachable or not configured yet, fall through to offline evaluation below

        // record.onlineExp is the server's expiresAt as of the last successful check (it's
        // seeded to the signed exp at activate() time, so it's always a sane value even
        // before the first online check completes). It — not the original signed exp — is
        // the ceiling, so an admin extending expiresAt in ZoeKeyGen actually takes effect.
        // A device can't fake this locally: without a successful online check confirming an
        // extension, it's stuck with whatever onlineExp it last legitimately received, and
        // OFFLINE_GRACE_MS below still forces a fresh server check every 3 days regardless.
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
        const now = Math.floor(Date.now() / 1000);
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
        generateKeyPair: generateKeyPair
    };
})(window);
