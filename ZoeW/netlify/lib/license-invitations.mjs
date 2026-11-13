import crypto from 'node:crypto';
import { LICENSE_PUBLIC_KEYS_JWK, parseLicenseKey, licenseSignatureValid } from './push-core.mjs';
import { SEAT_AUDIENCE, publicKey, verifies, decode, validState, receiptSigner, enrollmentMatches, seatKeyFingerprint, boundedBody } from './license-seat-stage.mjs';
export const INVITATION_DOMAIN = 'zoe-license-invitation-v1';
const locator = /^[A-Z0-9]{16,40}\.[0-9A-HJKMNP-TV-Z]{16}$/;
const out = (status, reason, extra = {}) => ({ status, body: { reason, ...extra } });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export function createInvitationService({ store, enabled = false, encryptionKey, publicKeys = LICENSE_PUBLIC_KEYS_JWK, receiptPrivateJwk = null, now = Date.now } = {}) {
    let secret;
    try {
        secret = decode(encryptionKey);
        if (secret.length !== 32)
            secret = null;
    }
    catch {
        secret = null;
    }
    const signer = receiptSigner(receiptPrivateJwk);
    const ready = enabled === true && !!secret && !!signer;
    const aad = (id, inv) => Buffer.from(JSON.stringify(['ZOE', id.split('.')[0], id, inv.expiresAt, inv.target, inv.releaseEpoch]));
    function seal(text, id, inv) {
        const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', secret, iv);
        c.setAAD(aad(id, inv));
        return { iv: iv.toString('base64url'), data: Buffer.concat([c.update(text, 'utf8'), c.final()]).toString('base64url'), tag: c.getAuthTag().toString('base64url') };
    }
    function unseal(id, inv) {
        const c = crypto.createDecipheriv('aes-256-gcm', secret, decode(inv.cipher.iv));
        c.setAAD(aad(id, inv));
        c.setAuthTag(decode(inv.cipher.tag));
        return Buffer.concat([c.update(decode(inv.cipher.data)), c.final()]).toString('utf8');
    }
    return { enabled: ready, async execute(envelope, target = null) {
            if (!ready)
                return out(503, 'invitation-disabled');
            let c, seller = false;
            const time = now();
            try {
                if (JSON.stringify(envelope).length > 8192)
                    return out(400, 'request-invalid');
                if (envelope.action === 'open')
                    c = { action: 'open', inviteId: envelope.inviteId, keyId: String(envelope.inviteId).split('.')[0] };
                else {
                    c = JSON.parse(decode(envelope.payload).toString('utf8'));
                    if (c.domain !== INVITATION_DOMAIN || c.audience !== SEAT_AUDIENCE || c.app !== 'ZOE' || !Number.isSafeInteger(c.expiresAt) || c.expiresAt <= time || c.expiresAt > time + 60000)
                        return out(400, 'request-invalid');
                    seller = ['create', 'list', 'approve', 'reject', 'cancel'].includes(c.action);
                    if (!(seller ? publicKeys.some(k => verifies(k, envelope.payload, decode(envelope.signature))) : verifies(c.publicKey, envelope.payload, decode(envelope.signature))))
                        return out(403, 'proof-invalid');
                }
                if (!/^[A-Z0-9]{16,40}$/.test(c.keyId) || (c.action !== 'list' && (!locator.test(c.inviteId) || c.inviteId.split('.')[0] !== c.keyId)))
                    return out(400, 'request-invalid');
                const path = 'ZOE/' + c.keyId, current = await store.getWithMetadata(path, { type: 'json' });
                if (!current || !validState(current.data) || !current.etag)
                    return out(409, 'state-unavailable');
                if (c.action !== 'open' && now() >= c.expiresAt)
                    return out(409, 'request-expired');
                const state = current.data, next = structuredClone(state);
                next.invitations ||= {};
                if (typeof next.invitations !== 'object' || Array.isArray(next.invitations) || Object.keys(next.invitations).length > 5 || Object.entries(next.invitations).some(([id, i]) => !locator.test(id) || !i || !Number.isSafeInteger(i.expiresAt) || !Number.isSafeInteger(i.releaseEpoch) || !['pwa', 'apk'].includes(i.target) || !['open', 'approved', 'cancelled'].includes(i.status) || !i.requests || typeof i.requests !== 'object' || Array.isArray(i.requests) || Object.keys(i.requests).length > 5 || Object.entries(i.requests).some(([rid, r]) => !r || rid !== r.requestId || !/^[a-f0-9]{64}$/.test(rid) || !['pending', 'approved', 'rejected'].includes(r.status))))
                    return out(503, 'state-unavailable');
                let cleaned = false;
                if (seller)
                    for (const [id, inv] of Object.entries(next.invitations))
                        if (inv.expiresAt <= time || inv.releaseEpoch !== state.releaseEpoch || inv.status === 'cancelled') {
                            delete next.invitations[id];
                            cleaned = true;
                        }
                const inv = next.invitations[c.inviteId];
                const view = (id, i) => ({ inviteId: id, target: i.target, expiresAt: i.expiresAt, releaseEpoch: i.releaseEpoch, status: i.status, requests: Object.values(i.requests) });
                const commit = async (extra) => {
                    if (now() >= c.expiresAt || (c.action !== 'list' && (now() >= next.licenseExpiresAt || (next.invitations[c.inviteId] && now() >= next.invitations[c.inviteId].expiresAt))))
                        return out(409, 'request-expired');
                    next.revision++;
                    const written = await store.setJSON(path, next, { onlyIfMatch: current.etag });
                    return written?.modified === true ? out(200, 'invitation-recorded', { revision: next.revision, releaseEpoch: next.releaseEpoch, ...extra }) : out(409, 'revision-changed');
                };
                if (c.action === 'list') {
                    const data = { invitations: Object.entries(next.invitations).map(([id, i]) => view(id, i)), receiptKeyFingerprint: signer.fingerprint };
                    return cleaned ? commit(data) : out(200, 'invitation-list', { revision: state.revision, releaseEpoch: state.releaseEpoch, ...data });
                }
                if (state.revoked || state.licenseExpiresAt <= time)
                    return out(403, 'license-unavailable');
                if (c.action === 'create') {
                    if (inv)
                        return out(200, 'invitation-existing', { scope: view(c.inviteId, inv), revision: state.revision });
                    if (c.revision !== state.revision || c.releaseEpoch !== state.releaseEpoch)
                        return out(409, 'revision-changed');
                    const key = parseLicenseKey(c.keyString);
                    if (!key || key.payload.a !== 'ZOE' || key.payload.id !== c.keyId || !licenseSignatureValid(key, publicKeys))
                        return out(403, 'key-invalid');
                    if (!['pwa', 'apk'].includes(c.target) || !Number.isSafeInteger(c.invitationExpiresAt) || c.invitationExpiresAt <= time || c.invitationExpiresAt > Math.min(time + 86400000, state.licenseExpiresAt) || Object.keys(next.invitations).length >= 5)
                        return out(400, 'invitation-invalid');
                    const i = { target: c.target, expiresAt: c.invitationExpiresAt, releaseEpoch: state.releaseEpoch, status: 'open', requests: {} };
                    i.cipher = seal(c.keyString, c.inviteId, i);
                    next.invitations[c.inviteId] = i;
                    return commit({ scope: view(c.inviteId, i) });
                }
                if (!inv || inv.expiresAt <= now() || state.licenseExpiresAt <= now() || inv.releaseEpoch !== state.releaseEpoch || inv.status === 'cancelled')
                    return out(410, 'invitation-unavailable');
                if (c.action === 'open')
                    return out(200, 'invitation-scope', { scope: { inviteId: c.inviteId, target: inv.target, expiresAt: inv.expiresAt, releaseEpoch: inv.releaseEpoch } });
                if (['submit', 'status'].includes(c.action) && target && target !== inv.target)
                    return out(403, 'target-mismatch');
                if (c.action === 'submit') {
                    const key = publicKey(c.publicKey), e = JSON.parse(decode(c.enrollment.payload).toString('utf8'));
                    if (!enrollmentMatches(c.enrollment, key, { app: 'ZOE', keyId: c.keyId }) || e.inviteId !== c.inviteId || e.target !== inv.target)
                        return out(403, 'enrollment-invalid');
                    const enrollmentHash = hash(JSON.stringify({ payload: c.enrollment.payload, signature: c.enrollment.signature })), requestId = enrollmentHash;
                    if (inv.requests[requestId])
                        return out(200, 'request-existing', inv.requests[requestId]);
                    if (inv.status !== 'open' || Object.keys(inv.requests).length >= 5)
                        return out(409, 'request-limit');
                    const r = { requestId, enrollmentHash, enrollment: c.enrollment, fingerprint: seatKeyFingerprint(key), publicKey: key, verificationCode: String(BigInt('0x' + enrollmentHash) % 100000000n).padStart(8, '0'), status: 'pending' };
                    inv.requests[requestId] = r;
                    return commit(r);
                }
                const r = inv.requests[c.requestId];
                if (c.action === 'status') {
                    if (!r || r.fingerprint !== seatKeyFingerprint(c.publicKey))
                        return out(403, 'proof-invalid');
                    if (r.status !== 'approved')
                        return out(200, 'request-status', { status: r.status, requestId: r.requestId, verificationCode: r.verificationCode });
                    if (state.mode !== 'active' || !Object.values(state.seats).some(s => seatKeyFingerprint(s.publicKey) === r.fingerprint))
                        return out(410, 'seat-unavailable');
                    return out(200, 'request-status', { status: r.status, requestId: r.requestId, verificationCode: r.verificationCode, keyString: unseal(c.inviteId, inv) });
                }
                if (!seller)
                    return out(400, 'action-invalid');
                if (c.action === 'approve' && r?.status === 'approved' && r.fingerprint === c.fingerprint && r.enrollmentHash === c.enrollmentHash && c.releaseEpoch === state.releaseEpoch)
                    return out(200, 'request-existing', { status: r.status, revision: state.revision });
                if (c.revision !== state.revision || c.releaseEpoch !== state.releaseEpoch)
                    return out(409, 'revision-changed');
                if (c.action === 'cancel') {
                    inv.status = 'cancelled';
                    delete inv.cipher;
                    return commit({ status: 'cancelled' });
                }
                if (!r || r.status !== 'pending')
                    return out(409, 'request-unavailable');
                if (c.action === 'reject') {
                    r.status = 'rejected';
                    return commit({ status: r.status, requestId: r.requestId, verificationCode: r.verificationCode });
                }
                if (c.action !== 'approve' || c.fingerprint !== r.fingerprint || c.enrollmentHash !== r.enrollmentHash || c.receiptKeyFingerprint !== signer.fingerprint)
                    return out(409, 'approval-mismatch');
                const slots = Array.from({ length: state.maxDevices }, (_, i) => 'd' + (i + 1));
                const slot = slots.find(s => state.seats[s] && seatKeyFingerprint(state.seats[s].publicKey) === r.fingerprint) || slots.find(s => !state.seats[s]);
                if (!slot)
                    return out(409, 'seat-limit');
                next.seats[slot] = { publicKey: r.publicKey };
                next.mode = 'active';
                r.status = 'approved';
                inv.status = 'approved';
                for (const other of Object.values(inv.requests))
                    if (other.status === 'pending')
                        other.status = 'rejected';
                return commit({ status: 'approved', slot });
            }
            catch {
                return out(503, 'outcome-unverified');
            }
        } };
}
export async function handleInvitationRequest(request, service) {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    const origin = request.headers.get('Origin');
    if (origin && ![SEAT_AUDIENCE, 'https://zoekeygen.netlify.app', 'https://localhost'].includes(origin))
        return new Response('{}', { status: 403, headers });
    if (origin) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers.Vary = 'Origin';
    }
    if (request.method === 'OPTIONS')
        return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
    let result;
    if (!service.enabled)
        result = out(503, 'invitation-disabled');
    else if (request.method !== 'POST')
        result = out(405, 'method');
    else if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || ''))
        result = out(415, 'content-type');
    else {
        let timer;
        try {
            result = await Promise.race([boundedBody(request).then(body => service.execute(body, origin === 'https://localhost' ? 'apk' : 'pwa')), new Promise(resolve => { timer = setTimeout(() => resolve(out(503, 'outcome-unverified')), 5000); })]);
        }
        catch {
            result = out(400, 'request-invalid');
        }
        finally {
            clearTimeout(timer);
        }
    }
    return new Response(JSON.stringify(result.body), { status: result.status, headers });
}
