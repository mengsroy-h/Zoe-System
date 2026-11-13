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
    const LEGACY_PROTOCOL_ENABLED = !!(global.ZoeSeatConfig && Object.prototype.hasOwnProperty.call(global.ZoeSeatConfig, 'legacyProtocolEnabled') && global.ZoeSeatConfig.legacyProtocolEnabled === true);
    const OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
    const DEVICE_ID_KEY = 'zoe_license_device_id';
    const DEVICE_ID_RE = /^[0-9A-Z]{20,32}$/;

    let serverTimeOffsetMs = 0;
    let serverTimeSynced = false;
    let serverTimeAnchor = null;
    let serverTimeGeneration = 0;
    let serverTimeObservation = 0;
    let serverTimeExternalSample = null;
    const CLOCK_DIVERGENCE_MS = 2000;

    function readClock() {
        let mono;
        try { mono = performance.now(); } catch (e) { return null; }
        const wall = Date.now();
        return Number.isFinite(mono) && Number.isFinite(wall) ? { mono: mono, wall: wall } : null;
    }

    function resetServerTime() {
        serverTimeAnchor = null;
        serverTimeSynced = false;
        serverTimeOffsetMs = 0;
        serverTimeGeneration++;
        serverTimeObservation++;
    }

    function clockElapsed(start, end) {
        if (!start || !end) return null;
        const mono = end.mono - start.mono;
        const wall = end.wall - start.wall;
        return mono >= 0 && wall >= 0 && Math.abs(mono - wall) <= CLOCK_DIVERGENCE_MS ? Math.max(mono, wall) : null;
    }

    function trustedClock() {
        if (!serverTimeAnchor) return null;
        const clock = readClock();
        const age = clockElapsed(serverTimeAnchor, clock);
        if (age === null || age > OFFLINE_GRACE_MS) {
            resetServerTime();
            return null;
        }
        const lowerAge = Math.min(clock.mono - serverTimeAnchor.mono, clock.wall - serverTimeAnchor.wall);
        return { now: serverTimeAnchor.epoch + lowerAge, uncertainty: serverTimeAnchor.uncertainty + age - lowerAge, clock: clock };
    }

    function getTrustedServerNow() {
        const current = trustedClock();
        return current ? current.now : null;
    }

    function getServerTimeGeneration() {
        trustedClock();
        return serverTimeGeneration;
    }

    function getServerTimeSample() {
        if (!trustedClock()) return null;
        return serverTimeAnchor.sample;
    }

    function acceptServerTime(epoch, clock, uncertainty, source) {
        if (!Number.isFinite(epoch) || epoch <= 0 || epoch > 8640000000000000 || !clock || !Number.isFinite(uncertainty) || uncertainty < 0) return false;
        const previous = trustedClock();
        const currentClock = readClock();
        const age = clockElapsed(clock, currentClock);
        if (age === null || age > OFFLINE_GRACE_MS) return false;
        const lowerAge = Math.min(currentClock.mono - clock.mono, currentClock.wall - clock.wall);
        if (previous && (epoch + lowerAge > previous.now + previous.uncertainty + CLOCK_DIVERGENCE_MS || epoch + uncertainty + age < previous.now - CLOCK_DIVERGENCE_MS)) resetServerTime();
        serverTimeAnchor = { epoch: epoch, mono: clock.mono, wall: clock.wall, uncertainty: uncertainty, source: source };
        serverTimeOffsetMs = epoch - clock.wall;
        serverTimeSynced = true;
        serverTimeObservation++;
        serverTimeAnchor.sample = Object.freeze({ epochMs: epoch, monotonicMs: clock.mono, wallMs: clock.wall,
            uncertaintyMs: uncertainty, generation: serverTimeGeneration, observation: serverTimeObservation, source: source });
        return true;
    }

    function getServerNow() {
        const now = getTrustedServerNow();
        return now === null ? Date.now() : now;
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

    function activationKeyString(appCode) {
        const record = loadLocalRecord(appCode);
        return record && typeof record.keyString === 'string' ? record.keyString : '';
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

    const activationInFlight = new Map();

    async function activate(keyString, appCode, isOwnerCurrent, requiredSeatProtocol) {
        const startedAt = readClock();
        const owner = {};
        const identityOf = (record) => JSON.stringify(record && [record.keyString, record.id, record.a, record.iat, record.exp, record.activationId]);
        const snapshot = identityOf(loadLocalRecord(appCode));
        activationInFlight.set(appCode, owner);
        const isCurrent = () => (typeof isOwnerCurrent !== 'function' || isOwnerCurrent() === true) && activationInFlight.get(appCode) === owner && identityOf(loadLocalRecord(appCode)) === snapshot;
        try {
            const result = await verifySignatureAndScope(keyString, appCode);
            if (!isCurrent()) return { valid: false, reason: 'verify-unavailable' };
            if (!result.valid) return result;
            const online = await checkOnline(appCode, result.payload.id, { priority: true, claimSeat: true });
            if (!isCurrent()) return { valid: false, reason: 'verify-unavailable' };
            if (requiredSeatProtocol === 2 && online.protocol !== 2) return { valid: false, reason: 'device-unverified' };
            if (online.ok !== true) {
                return { valid: false, reason: online.reason || 'network', payload: result.payload };
            }
            if (getTrustedServerNow() === null) await syncServerTime({ priority: true });
            if (!isCurrent()) return { valid: false, reason: 'verify-unavailable' };
            if (getTrustedServerNow() === null) {
                return { valid: false, reason: 'clock-unverified', payload: result.payload };
            }
            if (online.seat !== 'mine') {
                let seatReason = 'network';
                if (online.seat === 'no-device') seatReason = 'device-unverified';
                else if (online.seat === 'seat-unavailable') seatReason = 'seat-unavailable';
                return { valid: false, reason: seatReason, payload: result.payload };
            }
            const current = trustedClock();
            if (!current) return { valid: false, reason: 'clock-unverified', payload: result.payload };
            const now = current.now;
            const ceiling = typeof online.expiresAt === 'number' ? online.expiresAt : result.payload.exp * 1000;
            if (now > ceiling) {
                return { valid: false, reason: 'expired', payload: result.payload };
            }
            if (now + current.uncertainty > ceiling) return { valid: false, reason: 'clock-unverified', payload: result.payload };
            const elapsed = clockElapsed(startedAt, current.clock);
            const record = {
                activationId: bytesToBase32(crypto.getRandomValues(new Uint8Array(15))),
                keyString: keyString.trim(),
                id: result.payload.id,
                a: result.payload.a,
                iat: result.payload.iat,
                exp: result.payload.exp,
                activatedAt: elapsed === null ? now : now - elapsed,
                releaseEpoch: online.releaseEpoch,
                ...(online.protocol === 2 ? { seatProtocol: 2, seatReceipt: online.receipt } : {}),
                lastOnlineCheck: now,
                onlineExp: ceiling,
                seenMax: now
            };
            if (!isCurrent()) return { valid: false, reason: 'verify-unavailable' };
            saveLocalRecord(appCode, record);
            return { valid: true, payload: result.payload };
        } finally {
            if (activationInFlight.get(appCode) === owner) activationInFlight.delete(appCode);
        }
    }

    const LICENSE_SEAT_SLOTS = ['d1', 'd2', 'd3', 'd4', 'd5'];
    const LICENSE_SEAT_CLAIM_TRIES = 2;
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
        const startedAt = readClock();
        const observation = serverTimeObservation;
        const controller = new AbortController();
        let timer;
        const timeout = new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                controller.abort();
                reject(new Error('network timeout'));
            }, NET_TIMEOUT_MS);
        });
        try {
            return await Promise.race([timeout, (async () => {
                const res = await fetch(url, Object.assign({ cache: 'no-store' }, init || {}, { signal: controller.signal }));
                const receivedAt = readClock();
                const body = readBody ? await readBody(res) : undefined;
                const endedAt = readClock();
                const elapsed = clockElapsed(startedAt, endedAt);
                if (elapsed === null || elapsed > NET_TIMEOUT_MS) throw new Error('network timeout');
                return { res: res, body: body, startedAt: startedAt, receivedAt: receivedAt, endedAt: endedAt, elapsed: elapsed, observation: observation };
            })()]);
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
                const current = readClock();
                const elapsed = clockElapsed(out.startedAt, current);
                const bodyElapsed = clockElapsed(out.receivedAt, current);
                if (elapsed !== null && elapsed <= NET_TIMEOUT_MS && bodyElapsed !== null && out.observation === serverTimeObservation) {
                    const lowerBodyElapsed = Math.min(current.mono - out.receivedAt.mono, current.wall - out.receivedAt.wall);
                    acceptServerTime(serverMs + lowerBodyElapsed, current, elapsed + 1000, 'http-date');
                }
            }
            if (!res.ok) return { ok: null, reason: 'network' };
            const data = out.body;
            if (data === null || data === undefined) return { ok: false, reason: 'not-found' };
            if (data.seatProtocol === 2) return checkSecureSeat(appCode, keyId, priority);
            if (!LEGACY_PROTOCOL_ENABLED) return { ok: null, protocol: 2, reason: 'seat-unavailable' };
            if (data.revoked === true) return { ok: false, reason: 'revoked' };
            if (typeof data.expiresAt === 'number' && !Number.isFinite(data.expiresAt)) return { ok: null, reason: 'network' };
            const trustedNow = getTrustedServerNow();
            if (typeof data.expiresAt === 'number' && trustedNow !== null && trustedNow > data.expiresAt) {
                return { ok: false, reason: 'expired-server' };
            }
            let claimReleaseEpoch = typeof data.releasedAt === 'number' ? data.releasedAt : 0;
            const wasReleased = (epoch) => opts && (typeof opts.releaseEpoch === 'number'
                ? epoch > opts.releaseEpoch
                : typeof opts.activatedAt === 'number' && epoch > 0 && epoch >= opts.activatedAt);
            if (wasReleased(claimReleaseEpoch)) return { ok: false, reason: 'seat-released' };
            const deviceId = getDeviceId();
            const mine = (slot, record) => {
                if (opts && opts.claimSeat) {
                    try { noteSeatMeta(appCode, keyId, slot, record); } catch (e) {}
                }
                return { ok: true, expiresAt: data.expiresAt, seat: 'mine', releaseEpoch: claimReleaseEpoch };
            };
            let seat = await readSeat(appCode, keyId, deviceId, priority, data.maxDevices);
            if (seat.ok === false) return { ok: false, reason: 'seat-taken' };
            if (seat.ok === true) return mine(seat.slot, seat.record);
            if (seat.unclaimed && opts && opts.claimSeat) {
                if (typeof opts.activatedAt === 'number') {
                    const again = sharedRequest('key-fresh:' + appCode + '/' + keyId, priority,
                        () => fetchWithBodyTimeout(url, (r) => (r.ok ? r.json() : null)));
                    const fresh = again ? await again : null;
                    if (!fresh || !fresh.res.ok) return { ok: true, expiresAt: data.expiresAt, seat: 'unknown' };
                    if (fresh.body === null || fresh.body === undefined) return { ok: false, reason: 'not-found' };
                    claimReleaseEpoch = typeof fresh.body.releasedAt === 'number' ? fresh.body.releasedAt : 0;
                }
                if (wasReleased(claimReleaseEpoch)) {
                    return { ok: false, reason: 'seat-released' };
                }
                for (let attempt = 0; attempt < LICENSE_SEAT_CLAIM_TRIES; attempt++) {
                    const claimed = await claimSeat(appCode, keyId, deviceId, priority, seat.slot, claimReleaseEpoch);
                    if (claimed.ok === true) return mine(seat.slot, null);
                    if (claimed.ok !== false) break;
                    if (typeof opts.activatedAt === 'number') {
                        const again = sharedRequest('key-fresh:' + appCode + '/' + keyId, priority,
                            () => fetchWithBodyTimeout(url, (r) => (r.ok ? r.json() : null)));
                        const fresh = again ? await again : null;
                        if (!fresh || !fresh.res.ok) return { ok: true, expiresAt: data.expiresAt, seat: 'unknown' };
                        if (fresh.body === null || fresh.body === undefined) return { ok: false, reason: 'not-found' };
                        claimReleaseEpoch = typeof fresh.body.releasedAt === 'number' ? fresh.body.releasedAt : 0;
                        if (wasReleased(claimReleaseEpoch)) return { ok: false, reason: 'seat-released' };
                    }
                    seat = await readSeat(appCode, keyId, deviceId, priority, data.maxDevices);
                    if (seat.ok === true) return mine(seat.slot, seat.record);
                    if (seat.ok === false) return { ok: false, reason: 'seat-taken' };
                    if (!seat.unclaimed) break;
                }
            }
            const seatState = (seat.reason === 'no-device' || seat.reason === 'seat-unavailable') ? seat.reason : 'unknown';
            return { ok: true, expiresAt: data.expiresAt, seat: seatState };
        } catch (e) {
            return { ok: null, reason: 'network' };
        }
    }

    function licenseSeatUrl(appCode, keyId, slot, child) {
        return LICENSE_DB_URL.replace(/\/+$/, '') + '/license_seats/' + appCode + '/' + keyId
            + (slot ? '/' + slot : '') + (slot && child ? '/' + child : '') + '.json';
    }

    const SEAT_AUDIENCE = 'https://zoew.netlify.app';

    async function createSeatEnrollment(keyString, appCode) {
        try {
            const checked = await verifySignatureAndScope(keyString, appCode);
            if (!checked.valid) return checked;
            if (!global.ZoeSeatClient) return { valid: false, reason: 'device-unverified' };
            await global.ZoeSeatClient.createIdentity(appCode, checked.payload.id);
            const enrollment = await global.ZoeSeatClient.enrollmentRequest(appCode, checked.payload.id);
            return { valid: true, enrollment: enrollment };
        } catch (e) { return { valid: false, reason: 'device-unverified' }; }
    }

    async function inspectSeatIdentity(keyString, appCode) {
        try {
            const checked = await verifySignatureAndScope(keyString, appCode);
            if (!checked.valid) return checked;
            const client = global.ZoeSeatClient;
            if (!client || typeof client.inspectCorruptIdentity !== 'function') return { valid: false, reason: 'device-unverified' };
            const token = await client.inspectCorruptIdentity(appCode, checked.payload.id);
            if (!token) return { valid: false, reason: 'device-unverified' };
            return { valid: true, repairToken: token, keyId: checked.payload.id };
        } catch (e) { return { valid: false, reason: 'device-unverified' }; }
    }

    async function repairSeatIdentity(token, isCurrent) {
        try {
            const client = global.ZoeSeatClient;
            if (!client || typeof client.repairIdentity !== 'function' || typeof isCurrent !== 'function' || !isCurrent()) return { valid: false, reason: 'device-unverified' };
            await client.repairIdentity(token, isCurrent);
            if (!isCurrent()) return { valid: false, reason: 'device-unverified' };
            return { valid: true };
        } catch (e) { return { valid: false, reason: 'device-unverified' }; }
    }

    async function validateSeatReceipt(appCode, keyId, receipt, time, releaseEpoch) {
        const client = global.ZoeSeatClient;
        const config = global.ZoeSeatConfig;
        if (!client || !config || config.audience !== SEAT_AUDIENCE || !Array.isArray(config.receiptPublicKeys) || !config.receiptPublicKeys.length) throw new Error('seat-trust-unavailable');
        const identity = await client.loadIdentity(appCode, keyId);
        if (!identity) throw new Error('seat-identity-missing');
        const fingerprint = await client.fingerprint(identity.publicKey);
        const proof = await client.verifyReceipt(receipt, config.receiptPublicKeys, { app: appCode, keyId: keyId, fingerprint: fingerprint,
            ...(typeof releaseEpoch === 'number' ? { releaseEpoch: releaseEpoch } : {}) }, Math.ceil(time));
        const live = trustedClock();
        const verifiedAt = live ? Math.max(Math.ceil(time), Math.ceil(live.now + live.uncertainty)) : Infinity;
        if (proof.validUntil < verifiedAt || proof.licenseExpiresAt < verifiedAt) throw new Error('seat-receipt-expired');
        return proof;
    }

    async function checkSecureSeat(appCode, keyId, priority) {
        const uncertain = (reason) => ({ ok: null, protocol: 2, reason: reason || 'verify-unavailable' });
        try {
            const pending = sharedRequest('secure-seat:' + appCode + '/' + keyId, priority, async () => {
                const client = global.ZoeSeatClient;
                if (!client) return uncertain('device-unverified');
                if (!global.ZoeSeatConfig || !Array.isArray(global.ZoeSeatConfig.receiptPublicKeys) || !global.ZoeSeatConfig.receiptPublicKeys.length) return uncertain('seat-unavailable');
                const identity = await client.loadIdentity(appCode, keyId);
                if (!identity) return uncertain('device-unverified');
                if (getTrustedServerNow() === null) await syncServerTime({ priority: true });
                if (getTrustedServerNow() === null) return uncertain('clock-unverified');
                const send = async (command) => {
                    const time = getTrustedServerNow();
                    if (time === null) throw new Error('clock-unverified');
                    const envelope = await client.signCommand(appCode, keyId, Object.assign({ domain: 'zoe-license-seat-stage-v1',
                        audience: SEAT_AUDIENCE, app: appCode, keyId: keyId, expiresAt: Math.floor(time + 45000) }, command));
                    return fetchWithBodyTimeout(SEAT_AUDIENCE + '/.netlify/functions/license-seat-stage', (r) => r.json(), {
                        method: 'POST', credentials: 'omit', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(envelope)
                    });
                };
                for (let attempt = 0; attempt < 2; attempt++) {
                    const state = await send({ action: 'device-state', revision: 0, publicKey: identity.publicKey });
                    if (state.res.status === 403) return { ok: false, protocol: 2, reason: 'seat-released' };
                    if (!state.res.ok || !state.body || state.body.mode !== 'active') return uncertain();
                    const proof = await send({ action: 'prove', revision: state.body.revision, releaseEpoch: state.body.releaseEpoch, slot: state.body.slot });
                    if (proof.res.status === 409) continue;
                    if (proof.res.status === 403) return { ok: false, protocol: 2, reason: proof.body && proof.body.reason === 'license-expired' ? 'expired-server' : proof.body && proof.body.reason === 'license-revoked' ? 'revoked' : 'seat-released' };
                    if (!proof.res.ok || !proof.body || proof.body.grantsLicense !== true || proof.body.staged !== false || !proof.body.receipt) return uncertain();
                    const current = trustedClock();
                    if (!current) return uncertain('clock-unverified');
                    const receipt = await validateSeatReceipt(appCode, keyId, proof.body.receipt, current.now + current.uncertainty, state.body.releaseEpoch);
                    return { ok: true, protocol: 2, seat: 'mine', expiresAt: receipt.licenseExpiresAt, releaseEpoch: receipt.releaseEpoch, receipt: proof.body.receipt };
                }
                return uncertain();
            });
            return pending ? await pending : uncertain();
        } catch (e) { return uncertain('device-unverified'); }
    }

    function announcementsUrl(appCode, limit) {
        if (!LICENSE_DB_URL || LICENSE_DB_URL.indexOf('REPLACE_WITH') === 0) return '';
        if (!/^[A-Z]{2,8}$/.test(String(appCode || ''))) return '';
        const n = Math.floor(Number(limit));
        const cap = isFinite(n) && n >= 1 ? Math.min(n, 50) : 20;
        return LICENSE_DB_URL.replace(/\/+$/, '') + '/license_announcements/' + appCode
            + '.json?orderBy=%22%24key%22&limitToLast=' + cap;
    }

    function seatLimitOf(maxDevices) {
        const n = Math.floor(Number(maxDevices));
        if (!isFinite(n) || n < 1) return 1;
        return n > LICENSE_SEAT_SLOTS.length ? LICENSE_SEAT_SLOTS.length : n;
    }

    function seatHolderOf(entry) {
        return (entry && typeof entry === 'object' && typeof entry.device === 'string') ? entry.device : '';
    }

    async function readSeat(appCode, keyId, deviceId, priority, maxDevices) {
        if (!deviceId) return { ok: null, reason: 'no-device' };
        try {
            const pending = sharedRequest('seat:' + appCode + '/' + keyId, priority,
                () => fetchWithBodyTimeout(licenseSeatUrl(appCode, keyId), (r) => (r.ok ? r.json() : null)));
            if (!pending) return { ok: null, reason: 'network' };
            const out = await pending;
            if (out.res.status === 401 || out.res.status === 403) return { ok: null, reason: 'seat-unavailable' };
            if (!out.res.ok) return { ok: null, reason: 'network' };
            const data = out.body;
            const slots = LICENSE_SEAT_SLOTS.slice(0, seatLimitOf(maxDevices));
            let free = '';
            for (let i = 0; i < slots.length; i++) {
                const holder = seatHolderOf(data && data[slots[i]]);
                if (holder === deviceId) return { ok: true, slot: slots[i], record: data[slots[i]] };
                if (!holder && !free) free = slots[i];
            }
            if (free) return { ok: null, reason: 'unclaimed', unclaimed: true, slot: free };
            return { ok: false, reason: 'seat-taken' };
        } catch (e) {
            return { ok: null, reason: 'network' };
        }
    }

    const SEAT_META_LIMITS = { model: 80, platform: 40, serial: 64 };
    const seatMetaState = { meta: null, refused: false };

    function cleanMetaText(value, max) {
        if (typeof value !== 'string') return '';
        const text = value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u2060\ufeff]/g, '').replace(/\s+/g, ' ').trim();
        return text.length > max ? text.slice(0, max).trim() : text;
    }

    function setDeviceMeta(meta) {
        const src = (meta && typeof meta === 'object') ? meta : {};
        const next = {
            model: cleanMetaText(src.model, SEAT_META_LIMITS.model),
            platform: cleanMetaText(src.platform, SEAT_META_LIMITS.platform),
            serial: cleanMetaText(src.serial, SEAT_META_LIMITS.serial)
        };
        seatMetaState.meta = (next.model || next.platform || next.serial) ? next : null;
        return seatMetaState.meta ? { model: next.model, platform: next.platform, serial: next.serial } : null;
    }

    function getDeviceDisplay() {
        const meta = seatMetaState.meta;
        return meta && (meta.model || meta.platform) ? { model: meta.model, platform: meta.platform } : null;
    }

    function seatMetaSame(record, meta) {
        const cur = (record && typeof record === 'object' && record.meta && typeof record.meta === 'object') ? record.meta : null;
        return !!cur && cur.model === (meta.model || '-') && cur.platform === (meta.platform || '-') && cur.serial === (meta.serial || '-');
    }

    function noteSeatMeta(appCode, keyId, slot, record) {
        const meta = seatMetaState.meta;
        if (!meta || seatMetaState.refused || LICENSE_SEAT_SLOTS.indexOf(slot) === -1 || seatMetaSame(record, meta)) return null;
        if (netInFlight.size > 0) return null;
        const stamp = Math.round(getServerNow());
        const body = JSON.stringify({ model: meta.model || '-', platform: meta.platform || '-', serial: meta.serial || '-', at: stamp > 0 ? stamp : 1 });
        const pending = sharedRequest('seat-meta:' + appCode + '/' + keyId + '/' + slot, false,
            () => fetchWithBodyTimeout(licenseSeatUrl(appCode, keyId, slot, 'meta'), null, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: body
            }));
        if (!pending) return null;
        return pending.then((out) => {
            if (out.res.status === 401 || out.res.status === 403) seatMetaState.refused = true;
            return !!out.res.ok;
        }, () => false);
    }

    async function claimSeat(appCode, keyId, deviceId, priority, slot, releaseEpoch) {
        if (!deviceId) return { ok: null, reason: 'no-device' };
        if (LICENSE_SEAT_SLOTS.indexOf(slot) === -1) return { ok: null, reason: 'network' };
        const stamp = Math.round(getServerNow());
        const body = JSON.stringify({ device: deviceId, at: stamp > 0 ? stamp : 1, releaseEpoch: typeof releaseEpoch === 'number' ? releaseEpoch : 0 });
        try {
            const pending = sharedRequest('seat-claim:' + appCode + '/' + keyId + '/' + slot, priority,
                () => fetchWithBodyTimeout(licenseSeatUrl(appCode, keyId, slot), null, {
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
        const priority = !!(opts && opts.priority);
        if (!priority && networkLooksDown()) return false;
        try {
            const pending = sharedRequest('time', priority, async () => {
                const bytes = crypto.getRandomValues(new Uint8Array(16));
                const nonce = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
                const origin = typeof location !== 'undefined' ? location.origin : '';
                const base = typeof origin === 'string' && /^https:\/\/deploy-preview-[1-9]\d*--(?:zoew|zoekeygen)\.netlify\.app$/.test(origin)
                    ? origin : 'https://zoew.netlify.app';
                const url = base + '/.netlify/functions/server-time?nonce=' + nonce;
                const out = await fetchWithBodyTimeout(url, (res) => {
                    if (res.status !== 200 || !res.ok || res.redirected ||
                        !/^application\/json(?:\s*;|$)/i.test(res.headers.get('Content-Type') || '')) return null;
                    return res.json();
                }, { method: 'GET', credentials: 'omit', redirect: 'error' });
                const body = out.body;
                if (!body || body.nonce !== nonce || !Number.isSafeInteger(body.now) ||
                    body.now <= 0 || body.now > 8640000000000000) return null;
                return { epoch: body.now, out: out };
            });
            if (!pending) return false;
            const sample = await pending;
            if (sample === null) return false;
            if (sample.acceptedObservation !== undefined) return sample.acceptedObservation === serverTimeObservation && getTrustedServerNow() !== null;
            const current = readClock();
            const elapsed = clockElapsed(sample.out.startedAt, current);
            if (elapsed === null || elapsed > NET_TIMEOUT_MS || sample.out.observation !== serverTimeObservation) return false;
            const accepted = acceptServerTime(sample.epoch, current, elapsed, 'nonce');
            if (accepted) sample.acceptedObservation = serverTimeObservation;
            return accepted;
        } catch (e) {
            return false;
        }
    }

    function setServerTimeSample(sample) {
        if (!sample || !Object.isFrozen(sample) || sample.source !== 'supabase-rpc'
            || !Number.isFinite(sample.epochMs) || sample.epochMs <= 0 || sample.epochMs > 8640000000000000
            || !Number.isFinite(sample.monotonicMs) || sample.monotonicMs < 0 || !Number.isFinite(sample.wallMs)
            || !Number.isFinite(sample.uncertaintyMs) || sample.uncertaintyMs < 0) return false;
        if (sample === serverTimeExternalSample) return !!trustedClock() && serverTimeAnchor.externalSample === sample;
        if (serverTimeExternalSample && sample.monotonicMs < serverTimeExternalSample.monotonicMs) return false;
        const current = trustedClock();
        if (current && sample.monotonicMs < serverTimeAnchor.mono) return false;
        if (!acceptServerTime(sample.epochMs, { mono: sample.monotonicMs, wall: sample.wallMs }, sample.uncertaintyMs, 'supabase-rpc')) return false;
        serverTimeExternalSample = sample;
        serverTimeAnchor.externalSample = sample;
        return true;
    }

    function setServerTimeOffset(ms) {
        const clock = readClock();
        if (Number.isFinite(ms) && clock) acceptServerTime(clock.wall + ms, clock, 0, 'offset');
    }

    function getServerTimeOffset() {
        const current = trustedClock();
        return current ? current.now - current.clock.wall : null;
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

        const signed = sigCheck.payload && typeof sigCheck.payload === 'object' && typeof sigCheck.payload.id === 'string' ? sigCheck.payload : null;
        const online = await checkOnline(appCode, signed ? signed.id : record.id, { claimSeat: true, activatedAt: typeof record.activatedAt === 'number' ? record.activatedAt : 0, releaseEpoch: record.releaseEpoch });
        if (JSON.stringify(loadLocalRecord(appCode)) !== recordSnapshot) return recheck();
        if (online.ok === false) {
            clearLocalRecord(appCode);
            return { state: 'required', reason: online.reason };
        }

        if (online.ok === true && getTrustedServerNow() === null) {
            await syncServerTime();
            if (JSON.stringify(loadLocalRecord(appCode)) !== recordSnapshot) return recheck();
        }
        let current = trustedClock();
        const ceilingBeforeRefresh = Number.isFinite(record.onlineExp) ? record.onlineExp : (signed ? signed.exp : record.exp) * 1000;
        if (!current) return { state: 'offline-grace-exceeded', exp: ceilingBeforeRefresh, reason: 'clock-unverified' };
        let now = Math.max(current.now, recordSeenMark(record));
        if (!LEGACY_PROTOCOL_ENABLED || online.protocol === 2 || record.seatProtocol === 2) {
            try {
                const receipt = online.ok === true && online.protocol === 2 ? online.receipt : record.seatReceipt;
                const proof = await validateSeatReceipt(appCode, signed ? signed.id : record.id, receipt, now + current.uncertainty,
                    online.ok === true && online.protocol === 2 ? online.releaseEpoch : undefined);
                if (JSON.stringify(loadLocalRecord(appCode)) !== recordSnapshot) return recheck();
                current = trustedClock();
                if (!current) throw new Error('clock-unverified');
                now = Math.max(current.now, recordSeenMark(record));
                record.seatProtocol = 2;
                record.seatReceipt = receipt;
                record.onlineExp = proof.licenseExpiresAt;
            } catch (e) {
                return { state: 'offline-grace-exceeded', exp: ceilingBeforeRefresh, reason: 'device-unverified' };
            }
        }

        if (online.ok === true) {
            now = current.now;
            record.seenMax = now;
            if (online.seat !== 'unknown' && online.seat !== 'seat-unavailable') record.lastOnlineCheck = now;
            record.onlineExp = online.expiresAt;
            saveLocalRecord(appCode, record);
        } else if (now > recordSeenMark(record)) {
            record.seenMax = now;
            saveLocalRecord(appCode, record);
        }

        const ceiling = typeof record.onlineExp === 'number' ? record.onlineExp : (signed && typeof signed.exp === 'number' ? signed.exp : record.exp) * 1000;

        if (now > ceiling) {
            if (online.ok === true) {
                clearLocalRecord(appCode);
                return { state: 'required', reason: 'expired' };
            }
            return { state: 'offline-grace-exceeded', exp: ceiling };
        }

        if (now + current.uncertainty > ceiling) return { state: 'offline-grace-exceeded', exp: ceiling, reason: 'clock-unverified' };

        if (!(online.ok === true && online.seat !== 'unknown' && online.seat !== 'seat-unavailable') && now + current.uncertainty - (record.lastOnlineCheck || 0) > OFFLINE_GRACE_MS) {
            return online.ok === true && online.seat === 'seat-unavailable'
                ? { state: 'offline-grace-exceeded', exp: ceiling, reason: 'seat-unavailable' }
                : { state: 'offline-grace-exceeded', exp: ceiling };
        }

        return {
            state: 'active',
            exp: ceiling,
            daysLeft: Math.max(0, Math.ceil((ceiling - now) / 86400000))
        };
    }

    function deactivate(appCode) {
        activationInFlight.delete(appCode);
        clearLocalRecord(appCode);
    }

    async function importPrivateKey(privateJwk) {
        return crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    }

    async function signNewKey(privateKeyJwk, opts) {
        const appCode = opts.appCode;
        const days = opts.days;
        const id = randomKeyId();
        const issuedAt = opts.issuedAt === undefined ? getServerNow() : opts.issuedAt;
        if (!Number.isFinite(issuedAt) || issuedAt <= 0) throw new Error('clock-unverified');
        const now = Math.floor(issuedAt / 1000);
        const exp = now + Math.round(days * 86400);
        const payload = { a: appCode, id: id, iat: now, exp: exp };
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
        createSeatEnrollment: createSeatEnrollment,
        inspectSeatIdentity: inspectSeatIdentity,
        repairSeatIdentity: repairSeatIdentity,
        getStatus: getStatus,
        getDeviceId: getDeviceId,
        setDeviceMeta: setDeviceMeta,
        getDeviceDisplay: getDeviceDisplay,
        deactivate: deactivate,
        verifyKeyString: verifyKeyString,
        parseKeyString: parseKeyString,
        checkOnline: checkOnline,
        announcementsUrl: announcementsUrl,
        activationKeyString: activationKeyString,
        signNewKey: signNewKey,
        generateKeyPair: generateKeyPair,
        getServerNow: getServerNow,
        getTrustedServerNow: getTrustedServerNow,
        getServerTimeGeneration: getServerTimeGeneration,
        getServerTimeSample: getServerTimeSample,
        resetServerTime: resetServerTime,
        syncServerTime: syncServerTime,
        setServerTimeOffset: setServerTimeOffset,
        setServerTimeSample: setServerTimeSample,
        getServerTimeOffset: getServerTimeOffset
    };
})(window);
