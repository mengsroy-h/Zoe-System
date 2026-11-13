import crypto from 'node:crypto';
import { LICENSE_PUBLIC_KEYS_JWK } from './push-core.mjs';

export const SEAT_STAGE_STORE = 'zoew-license-seat-stage-v1';
export const SEAT_STAGE_DOMAIN = 'zoe-license-seat-stage-v1';
export const SEAT_AUDIENCE = 'https://zoew.netlify.app';
const RECEIPT_GRACE_MS = 3 * 86400000;
const MAX_BODY = 8192;
const SLOTS = ['d1', 'd2', 'd3', 'd4', 'd5'];
const result = (status, reason, extra = {}) => ({ status, body: { staged: true, grantsLicense: false, reason, ...extra } });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const decode = value => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error('encoding');
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.toString('base64url') !== value) throw Error('encoding');
    return bytes;
};
function publicKey(value) {
    if (!object(value) || value.kty !== 'EC' || value.crv !== 'P-256' || Object.hasOwn(value, 'd')) throw Error('key');
    if (decode(value.x).length !== 32 || decode(value.y).length !== 32) throw Error('key');
    const key = { kty: 'EC', crv: 'P-256', x: value.x, y: value.y };
    crypto.createPublicKey({ key, format: 'jwk' });
    return key;
}
function verifies(key, payload, signature) {
    try {
        return crypto.verify('sha256', Buffer.from(payload), { key: crypto.createPublicKey({ key: publicKey(key), format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, signature);
    } catch { return false; }
}
export function seatKeyFingerprint(key) {
    return crypto.createHash('sha256').update(JSON.stringify(publicKey(key))).digest('hex');
}
export function seatDisplay(value) {
    if (!object(value)) return null;
    const clean = (text, max) => typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim().slice(0, max).trim() : '';
    const model = clean(value.model, 80), platform = clean(value.platform, 40);
    return model || platform ? { model, platform } : null;
}
function enrollmentMatches(enrollment, key, command) {
    try {
        const body = JSON.parse(decode(enrollment.payload).toString('utf8'));
        return body.domain === 'zoe-license-enrollment-v1' && body.audience === SEAT_AUDIENCE && body.app === command.app && body.keyId === command.keyId &&
            typeof body.nonce === 'string' && /^[A-Za-z0-9_-]{32,64}$/.test(body.nonce) && seatKeyFingerprint(body.publicKey) === seatKeyFingerprint(key) &&
            verifies(key, enrollment.payload, decode(enrollment.signature));
    } catch { return false; }
}
function receiptSigner(jwk) {
    try {
        if (!object(jwk) || typeof jwk.d !== 'string') return null;
        const key = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
        const pub = crypto.createPublicKey(key).export({ format: 'jwk' });
        if (pub.crv !== 'P-256') return null;
        return { key, fingerprint: seatKeyFingerprint(pub) };
    } catch { return null; }
}
function signedReceipt(signer, command, state, time) {
    const payload = Buffer.from(JSON.stringify({ domain: 'zoe-license-seat-receipt-v1', audience: SEAT_AUDIENCE,
        app: command.app, keyId: command.keyId, fingerprint: seatKeyFingerprint(state.seats[command.slot].publicKey),
        releaseEpoch: state.releaseEpoch, issuedAt: time, validUntil: Math.min(time + RECEIPT_GRACE_MS, state.licenseExpiresAt),
        licenseExpiresAt: state.licenseExpiresAt })).toString('base64url');
    return { payload, signature: crypto.sign('sha256', Buffer.from(payload), { key: signer.key, dsaEncoding: 'ieee-p1363' }).toString('base64url') };
}
function validState(state) {
    return object(state) && state.schema === 1 && Number.isSafeInteger(state.revision) && state.revision >= 1 &&
        Number.isSafeInteger(state.releaseEpoch) && state.releaseEpoch >= 0 &&
        Number.isSafeInteger(state.maxDevices) && state.maxDevices >= 1 && state.maxDevices <= 5 &&
        Number.isSafeInteger(state.licenseExpiresAt) && state.licenseExpiresAt > 0 && typeof state.revoked === 'boolean' &&
        (!state.mode || state.mode === 'staged' || state.mode === 'active') && object(state.seats) && Object.entries(state.seats).every(([slot, seat]) => SLOTS.indexOf(slot) >= 0 && SLOTS.indexOf(slot) < state.maxDevices && object(seat) && object(seat.publicKey));
}
export function createSeatStageService({ store, enabled = false, publicKeys = LICENSE_PUBLIC_KEYS_JWK, now = Date.now, receiptPrivateJwk = null } = {}) {
    const signer = receiptSigner(receiptPrivateJwk);
    return {
        enabled: enabled === true,
        async execute(envelope) {
            if (enabled !== true) return result(503, 'stage-disabled');
            let command, signature;
            const time = now();
            try {
                if (!object(envelope) || JSON.stringify(envelope).length > MAX_BODY) return result(400, 'request-invalid');
                command = JSON.parse(decode(envelope.payload).toString('utf8'));
                signature = decode(envelope.signature);
                if (signature.length !== 64 || !object(command) || command.domain !== SEAT_STAGE_DOMAIN || command.audience !== SEAT_AUDIENCE || command.app !== 'ZOE' ||
                    typeof command.keyId !== 'string' || !/^[A-Z0-9]{16,40}$/.test(command.keyId) ||
                    !Number.isSafeInteger(command.revision) || command.revision < 0 || command.revision >= Number.MAX_SAFE_INTEGER ||
                    !Number.isSafeInteger(command.expiresAt) || command.expiresAt <= time || command.expiresAt > time + 60000 ||
                    !['configure', 'enroll', 'release', 'prove', 'inspect', 'device-state', 'cutover'].includes(command.action)) return result(400, 'request-invalid');
            } catch { return result(400, 'request-invalid'); }
            const seller = command.action !== 'prove' && command.action !== 'device-state';
            if (seller && !publicKeys.some(key => verifies(key, envelope.payload, signature))) return result(403, 'proof-invalid');
            const path = command.app + '/' + command.keyId;
            try {
                const current = await store.getWithMetadata(path, { type: 'json' });
                if (current && (!validState(current.data) || typeof current.etag !== 'string' || !current.etag)) return result(503, 'state-unavailable');
                const state = current ? current.data : { schema: 1, revision: 0, releaseEpoch: 0, mode: 'staged', seats: {} };
                if (!seller) {
                    if (command.action === 'device-state') {
                        let fingerprint;
                        try { fingerprint = seatKeyFingerprint(command.publicKey); } catch { return result(403, 'proof-invalid'); }
                        command.slot = Object.keys(state.seats).find(slot => seatKeyFingerprint(state.seats[slot].publicKey) === fingerprint);
                    }
                    const seat = state.seats[command.slot];
                    if (!seat || !verifies(seat.publicKey, envelope.payload, signature)) return result(403, 'proof-invalid');
                }
                if (command.action === 'inspect') return result(200, 'stage-state', { state: { ...state, mode: state.mode || 'staged' }, receiptKeyFingerprint: signer ? signer.fingerprint : null });
                if (command.action === 'device-state') return result(200, 'device-state', { revision: state.revision, releaseEpoch: state.releaseEpoch, slot: command.slot, mode: state.mode || 'staged' });
                if (command.revision !== state.revision) return result(409, 'revision-changed', { revision: state.revision });
                const next = structuredClone(state);
                if (command.action === 'cutover') {
                    if (!signer) return result(503, 'receipt-key-unavailable');
                    if (command.receiptKeyFingerprint !== signer.fingerprint) return result(409, 'receipt-key-mismatch');
                    if (!current || state.mode === 'active' || !Number.isInteger(command.expectedDevices) || command.expectedDevices < 1 ||
                        command.expectedDevices !== Object.keys(state.seats).length || state.revoked || state.licenseExpiresAt <= time) return result(409, 'cutover-not-ready');
                    next.mode = 'active';
                } else if (command.action === 'configure') {
                    if (!Number.isSafeInteger(command.maxDevices) || command.maxDevices < 1 || command.maxDevices > 5 ||
                        !Number.isSafeInteger(command.licenseExpiresAt) || command.licenseExpiresAt <= 0 || typeof command.revoked !== 'boolean') return result(400, 'config-invalid');
                    if (Object.keys(state.seats).some(slot => SLOTS.indexOf(slot) >= command.maxDevices)) return result(409, 'occupied-slot');
                    next.maxDevices = command.maxDevices; next.licenseExpiresAt = command.licenseExpiresAt; next.revoked = command.revoked;
                } else {
                    if (!current) return result(409, 'seller-enrollment-required');
                    if (command.action === 'release') {
                        if (state.releaseEpoch >= Number.MAX_SAFE_INTEGER) return result(503, 'state-unavailable');
                        next.releaseEpoch++; next.seats = {};
                    } else {
                        if (state.revoked) return result(403, 'license-revoked');
                        if (state.licenseExpiresAt <= time) return result(403, 'license-expired');
                        if (command.releaseEpoch !== state.releaseEpoch) return result(403, 'seat-released');
                        if (!SLOTS.slice(0, state.maxDevices).includes(command.slot)) return result(409, 'seat-limit');
                        if (command.action === 'enroll') {
                            if (state.seats[command.slot]) return result(409, 'occupied-slot');
                            let key;
                            try { key = publicKey(command.publicKey); } catch { return result(400, 'key-invalid'); }
                            if (!enrollmentMatches(command.enrollment, key, command)) return result(400, 'enrollment-proof-invalid');
                            if (Object.values(state.seats).some(seat => seat.publicKey.x === key.x && seat.publicKey.y === key.y)) return result(409, 'already-enrolled');
                            next.seats[command.slot] = { publicKey: key };
                            const display = seatDisplay(JSON.parse(decode(command.enrollment.payload).toString('utf8')).display);
                            if (display) next.seats[command.slot].display = display;
                        }
                    }
                }
                if (command.action === 'prove') {
                    const display = seatDisplay(command.display);
                    if (display) next.seats[command.slot].display = display;
                }
                if (command.action === 'prove' && state.mode === 'active' && !signer) return result(503, 'receipt-key-unavailable');
                next.mode = next.mode || 'staged';
                next.revision++;
                if (now() >= command.expiresAt) return result(409, 'request-expired');
                const written = await store.setJSON(path, next, current ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
                if (!written || written.modified !== true) return result(409, 'revision-changed');
                if (command.action === 'prove' && next.mode === 'active' && now() >= next.licenseExpiresAt) return result(403, 'license-expired');
                const receipt = command.action === 'prove' && next.mode === 'active' ? signedReceipt(signer, command, next, time) : null;
                return result(200, 'stage-recorded', { revision: next.revision, releaseEpoch: next.releaseEpoch, mode: next.mode, proofVerified: command.action === 'prove',
                    staged: next.mode !== 'active', grantsLicense: !!receipt, ...(receipt ? { receipt } : {}) });
            } catch { return result(503, 'outcome-unverified'); }
        }
    };
}
async function boundedBody(request) {
    if (!request.body) throw Error('body');
    const reader = request.body.getReader();
    const chunks = []; let total = 0, expired = false;
    const timer = setTimeout(() => { expired = true; reader.cancel().catch(() => {}); }, 5000);
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.length;
            if (total > MAX_BODY) throw Error('size');
            chunks.push(Buffer.from(value));
        }
        if (expired) throw Error('timeout');
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { clearTimeout(timer); reader.cancel().catch(() => {}); }
}
export async function handleSeatStageRequest(request, service) {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    const origin = request.headers.get('Origin');
    const allowed = new Set(['https://zoew.netlify.app', 'https://zoekeygen.netlify.app', 'https://localhost']);
    const ownPreview = origin && /^https:\/\/deploy-preview-[1-9]\d*--(?:zoew|zoekeygen)\.netlify\.app$/.test(origin) && origin === new URL(request.url).origin;
    if (origin && !allowed.has(origin) && !ownPreview) return new Response('{}', { status: 403, headers });
    if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers.Vary = 'Origin'; }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
    let out;
    if (!service.enabled) out = result(503, 'stage-disabled');
    else if (request.method !== 'POST') out = result(405, 'method');
    else if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) out = result(415, 'content-type');
    else {
        let timer;
        try {
            const body = await boundedBody(request);
            out = await Promise.race([service.execute(body), new Promise(resolve => { timer = setTimeout(() => resolve(result(503, 'outcome-unverified')), 5000); })]);
        } catch { out = result(400, 'request-invalid'); }
        finally { clearTimeout(timer); }
    }
    return new Response(JSON.stringify(out.body), { status: out.status, headers });
}

export { publicKey, verifies, decode, validState, receiptSigner, enrollmentMatches, boundedBody };
