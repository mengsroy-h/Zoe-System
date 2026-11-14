(function (global) {
    'use strict';
    const DB_NAME = 'zoe-license-seat-identities-v1';
    const STORE_NAME = 'identities';
    const DEADLINE_MS = 5000;
    const DOMAIN = 'zoe-license-seat-stage-v1';
    const AUDIENCE = 'https://zoew.netlify.app';
    const repairTokens = new WeakMap();

    function scope(app, keyId) {
        if (app !== 'ZOE' || typeof keyId !== 'string' || !/^[A-Z0-9]{16,40}$/.test(keyId)) throw new Error('identity-scope');
        return app + '/' + keyId;
    }

    function encode(bytes) {
        let binary = '';
        new Uint8Array(bytes).forEach((value) => { binary += String.fromCharCode(value); });
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function decode(value) {
        if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('identity-encoding');
        const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        if (encode(bytes) !== value) throw new Error('identity-encoding');
        return bytes;
    }

    function canonicalPublicKey(key) {
        if (!key || typeof key !== 'object' || key.kty !== 'EC' || key.crv !== 'P-256' || Object.prototype.hasOwnProperty.call(key, 'd') ||
            typeof key.x !== 'string' || typeof key.y !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key.x) || !/^[A-Za-z0-9_-]{43}$/.test(key.y)) throw new Error('identity-key');
        if (decode(key.x).length !== 32 || decode(key.y).length !== 32) throw new Error('identity-key');
        return { kty: 'EC', crv: 'P-256', x: key.x, y: key.y };
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            let request, done = false;
            const finish = (error, db) => {
                if (done) { if (db) db.close(); return; }
                done = true; clearTimeout(timer);
                if (error) reject(error); else resolve(db);
            };
            const timer = setTimeout(() => {
                try { if (request && request.transaction) request.transaction.abort(); } catch (e) {}
                finish(new Error('identity-storage-timeout'));
            }, DEADLINE_MS);
            try {
                request = global.indexedDB.open(DB_NAME, 1);
                request.onupgradeneeded = () => {
                    if (done) { try { request.transaction.abort(); } catch (e) {} return; }
                    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
                };
                request.onsuccess = () => finish(null, request.result);
                request.onerror = () => finish(new Error('identity-storage-unavailable'));
                request.onblocked = () => finish(new Error('identity-storage-blocked'));
            } catch (e) { finish(new Error('identity-storage-unavailable')); }
        });
    }

    async function storedIdentity(key, value) {
        const db = await openDatabase();
        try {
            return await new Promise((resolve, reject) => {
                let tx, result, requestError = null, done = false;
                const finish = (error) => {
                    if (done) return;
                    done = true; clearTimeout(timer);
                    if (error) reject(error); else resolve(result);
                };
                const timer = setTimeout(() => {
                    try { if (tx) tx.abort(); } catch (e) {}
                    finish(new Error('identity-storage-timeout'));
                }, DEADLINE_MS);
                try {
                    tx = db.transaction(STORE_NAME, value === undefined ? 'readonly' : 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    const request = value === undefined ? store.get(key) : store.add(value, key);
                    request.onsuccess = () => { result = request.result; };
                    request.onerror = () => { requestError = request.error; };
                    tx.oncomplete = () => finish(null);
                    tx.onabort = () => finish(requestError || tx.error || new Error('identity-storage-aborted'));
                    tx.onerror = () => { if (!requestError && tx.error) requestError = tx.error; };
                } catch (e) { finish(e); }
            });
        } finally { db.close(); }
    }

    async function validateIdentity(identity, app, keyId) {
        if (!identity || identity.version !== 1 || identity.app !== app || identity.keyId !== keyId) throw new Error('identity-corrupt');
        const privateKey = identity.privateKey;
        if (!privateKey || privateKey.type !== 'private' || privateKey.extractable !== false || !privateKey.algorithm ||
            privateKey.algorithm.name !== 'ECDSA' || privateKey.algorithm.namedCurve !== 'P-256' ||
            !privateKey.usages || privateKey.usages.length !== 1 || privateKey.usages[0] !== 'sign') throw new Error('identity-corrupt');
        let publicKey;
        try { publicKey = canonicalPublicKey(identity.publicKey); } catch (e) { throw new Error('identity-corrupt'); }
        const verifyKey = await crypto.subtle.importKey('jwk', publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, challenge);
        if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, signature, challenge)) throw new Error('identity-corrupt');
        return { version: 1, app: app, keyId: keyId, privateKey: privateKey, publicKey: publicKey };
    }

    async function loadIdentity(app, keyId) {
        const stored = await storedIdentity(scope(app, keyId));
        return stored === undefined ? null : validateIdentity(stored, app, keyId);
    }

    async function createIdentity(app, keyId) {
        const key = scope(app, keyId);
        const existing = await loadIdentity(app, keyId);
        if (existing) return existing;
        const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
        const publicKey = canonicalPublicKey(await crypto.subtle.exportKey('jwk', pair.publicKey));
        const identity = { version: 1, app: app, keyId: keyId, privateKey: pair.privateKey, publicKey: publicKey };
        try { await storedIdentity(key, identity); }
        catch (error) { if (!error || error.name !== 'ConstraintError') throw error; }
        const winner = await loadIdentity(app, keyId);
        if (!winner) throw new Error('identity-storage-unverified');
        return winner;
    }

    async function requireCorruptIdentity(identity, app, keyId) {
        if (identity === undefined) throw new Error('identity-missing');
        try { await validateIdentity(identity, app, keyId); }
        catch (error) {
            if (error && error.message === 'identity-corrupt') return;
            throw error;
        }
        throw new Error('identity-healthy');
    }

    async function inspectCorruptIdentity(app, keyId) {
        const key = scope(app, keyId);
        await requireCorruptIdentity(await storedIdentity(key), app, keyId);
        const token = Object.freeze({ app: app, keyId: keyId });
        repairTokens.set(token, { app: app, keyId: keyId });
        return token;
    }

    async function repairIdentity(token, isCurrent) {
        const target = token && repairTokens.get(token);
        if (!target) throw new Error('identity-repair-token');
        repairTokens.delete(token);
        const owned = () => typeof isCurrent === 'function' && isCurrent() === true;
        if (!owned()) throw new Error('identity-repair-stale');
        const key = scope(target.app, target.keyId);
        const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
        if (!owned()) throw new Error('identity-repair-stale');
        const publicKey = canonicalPublicKey(await crypto.subtle.exportKey('jwk', pair.publicKey));
        if (!owned()) throw new Error('identity-repair-stale');
        const replacement = { version: 1, app: target.app, keyId: target.keyId, privateKey: pair.privateKey, publicKey: publicKey };
        const db = await openDatabase();
        try {
            if (!owned()) throw new Error('identity-repair-stale');
            await new Promise((resolve, reject) => {
                let tx, abortTimer, done = false, stopping = false, ready = false, failure = null, inspecting = false, wrote = false;
                const finish = (error) => {
                    if (done) return;
                    done = true; clearTimeout(timer); clearTimeout(abortTimer);
                    if (error) reject(error); else resolve();
                };
                const abort = (error) => {
                    if (done || stopping) return;
                    stopping = true; failure = error;
                    if (!tx) { finish(error); return; }
                    abortTimer = setTimeout(() => finish(new Error('identity-storage-unverified')), DEADLINE_MS);
                    try { tx.abort(); } catch (e) { finish(new Error('identity-storage-unverified')); }
                };
                const timer = setTimeout(() => abort(new Error('identity-storage-timeout')), DEADLINE_MS);
                try {
                    tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    tx.oncomplete = () => finish(wrote && !failure ? null : new Error('identity-storage-unverified'));
                    tx.onabort = () => finish(failure || tx.error || new Error('identity-storage-aborted'));
                    tx.onerror = () => { if (!failure && tx.error) failure = tx.error; };
                    const pump = () => {
                        if (done || stopping) return;
                        try {
                            if (!owned()) { abort(new Error('identity-repair-stale')); return; }
                            const request = store.get(key);
                            request.onerror = () => abort(request.error || new Error('identity-storage-unavailable'));
                            request.onsuccess = () => {
                                if (done || stopping) return;
                                try {
                                    if (!owned()) { abort(new Error('identity-repair-stale')); return; }
                                    if (failure) { abort(failure); return; }
                                    if (ready) {
                                        const write = store.put(replacement, key);
                                        write.onerror = () => abort(write.error || new Error('identity-storage-unavailable'));
                                        write.onsuccess = () => {
                                            try { if (!owned()) abort(new Error('identity-repair-stale')); else wrote = true; }
                                            catch (error) { abort(error); }
                                        };
                                        return;
                                    }
                                    if (!inspecting) {
                                        inspecting = true;
                                        requireCorruptIdentity(request.result, target.app, target.keyId).then(() => { ready = true; }, (error) => { failure = error; });
                                    }
                                    pump();
                                } catch (error) { abort(error); }
                            };
                        } catch (error) { abort(error); }
                    };
                    pump();
                } catch (error) { abort(error); }
            });
        } finally { db.close(); }
        if (!owned()) throw new Error('identity-repair-stale');
        const winner = await loadIdentity(target.app, target.keyId);
        if (!owned()) throw new Error('identity-repair-stale');
        if (!winner) throw new Error('identity-storage-unverified');
        return winner;
    }

    async function fingerprint(publicKey) {
        const key = canonicalPublicKey(publicKey);
        await crypto.subtle.importKey('jwk', key, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(key)));
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    async function signed(identity, command) {
        const payload = encode(new TextEncoder().encode(JSON.stringify(command)));
        const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, identity.privateKey, new TextEncoder().encode(payload));
        return { payload: payload, signature: encode(signature) };
    }

    function addDeviceDisplay(command) {
        try {
            const license = global.ZoeLicense;
            const value = license && typeof license.getDeviceDisplay === 'function' ? license.getDeviceDisplay() : null;
            if (!value || typeof value !== 'object') return;
            const clean = (text, max) => typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim().slice(0, max).trim() : '';
            const model = clean(value.model, 80), platform = clean(value.platform, 40);
            if (model || platform) command.display = { model: model, platform: platform };
        } catch (e) {}
    }

    async function signCommand(app, keyId, command) {
        scope(app, keyId);
        const snapshot = JSON.parse(JSON.stringify(command));
        if (!snapshot || snapshot.domain !== DOMAIN || snapshot.audience !== AUDIENCE || snapshot.app !== app || snapshot.keyId !== keyId) throw new Error('identity-scope');
        const identity = await loadIdentity(app, keyId);
        if (!identity) throw new Error('identity-missing');
        if (snapshot.action === 'prove') addDeviceDisplay(snapshot);
        return signed(identity, snapshot);
    }

    async function enrollmentRequest(app, keyId) {
        const identity = await loadIdentity(app, keyId);
        if (!identity) throw new Error('identity-missing');
        const command = { domain: 'zoe-license-enrollment-v1', audience: AUDIENCE, app: app, keyId: keyId, publicKey: identity.publicKey, nonce: encode(crypto.getRandomValues(new Uint8Array(24))) };
        addDeviceDisplay(command);
        const envelope = await signed(identity, command);
        envelope.fingerprint = await fingerprint(identity.publicKey);
        return envelope;
    }

    async function invitationEnrollmentRequest(app, keyId, inviteId, target) {
        scope(app, keyId);
        if (typeof inviteId !== 'string' || !new RegExp('^' + keyId + '\\.[0-9A-HJKMNP-TV-Z]{16}$').test(inviteId) || !['pwa', 'apk'].includes(target)) throw new Error('invitation-scope');
        const identity = await loadIdentity(app, keyId);
        if (!identity) throw new Error('identity-missing');
        const command = { domain: 'zoe-license-enrollment-v1', audience: AUDIENCE, app: app, keyId: keyId, publicKey: identity.publicKey, nonce: encode(crypto.getRandomValues(new Uint8Array(24))), inviteId: inviteId, target: target };
        addDeviceDisplay(command);
        const envelope = await signed(identity, command);
        envelope.fingerprint = await fingerprint(identity.publicKey);
        return envelope;
    }

    async function signInvitationCommand(app, keyId, command) {
        scope(app, keyId);
        const snapshot = JSON.parse(JSON.stringify(command));
        if (!snapshot || snapshot.domain !== 'zoe-license-invitation-v1' || snapshot.audience !== AUDIENCE || snapshot.app !== app || snapshot.keyId !== keyId ||
            !['submit', 'status'].includes(snapshot.action) || typeof snapshot.inviteId !== 'string' || !new RegExp('^' + keyId + '\\.[0-9A-HJKMNP-TV-Z]{16}$').test(snapshot.inviteId) ||
            !Number.isSafeInteger(snapshot.expiresAt) || snapshot.expiresAt <= 0) throw new Error('invitation-scope');
        const identity = await loadIdentity(app, keyId);
        if (!identity) throw new Error('identity-missing');
        snapshot.publicKey = identity.publicKey;
        return signed(identity, snapshot);
    }

    async function verifyReceipt(receipt, pinnedPublicKeys, expected, now) {
        if (!receipt || typeof receipt.payload !== 'string' || receipt.payload.length > 8192 || !expected ||
            !Number.isSafeInteger(now) || now <= 0 || !Array.isArray(pinnedPublicKeys) || !pinnedPublicKeys.length) throw new Error('receipt-invalid');
        scope(expected.app, expected.keyId);
        if (typeof expected.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(expected.fingerprint)) throw new Error('receipt-invalid');
        const bytes = decode(receipt.payload), signature = decode(receipt.signature);
        if (signature.length !== 64) throw new Error('receipt-invalid');
        let verified = false;
        for (let i = 0; i < pinnedPublicKeys.length; i++) {
            try {
                const key = await crypto.subtle.importKey('jwk', canonicalPublicKey(pinnedPublicKeys[i]), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
                if (await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, new TextEncoder().encode(receipt.payload))) { verified = true; break; }
            } catch (e) {}
        }
        if (!verified) throw new Error('receipt-signature');
        const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        if (!payload || payload.domain !== 'zoe-license-seat-receipt-v1' || payload.audience !== AUDIENCE || payload.app !== expected.app || payload.keyId !== expected.keyId ||
            payload.fingerprint !== expected.fingerprint || !Number.isSafeInteger(payload.issuedAt) || payload.issuedAt <= 0 || payload.issuedAt > now ||
            !Number.isSafeInteger(payload.validUntil) || payload.validUntil < now || payload.validUntil < payload.issuedAt || payload.validUntil > payload.issuedAt + 3 * 24 * 60 * 60 * 1000 ||
            !Number.isSafeInteger(payload.licenseExpiresAt) || payload.licenseExpiresAt < now || payload.validUntil > payload.licenseExpiresAt ||
            !Number.isSafeInteger(payload.releaseEpoch) || payload.releaseEpoch < 0 ||
            (expected.releaseEpoch !== undefined && payload.releaseEpoch !== expected.releaseEpoch)) throw new Error('receipt-invalid');
        return payload;
    }

    global.ZoeSeatClient = { invitationEnrollmentRequest: invitationEnrollmentRequest, signInvitationCommand: signInvitationCommand, loadIdentity: loadIdentity, createIdentity: createIdentity, inspectCorruptIdentity: inspectCorruptIdentity, repairIdentity: repairIdentity, enrollmentRequest: enrollmentRequest, signCommand: signCommand, fingerprint: fingerprint, verifyReceipt: verifyReceipt };
})(window);
