// @vitest-environment node
import crypto from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { createInvitationService, handleInvitationRequest, INVITATION_DOMAIN } from '../../../../ZoeW/netlify/lib/license-invitations.mjs';
import { seatKeyFingerprint } from '../../../../ZoeW/netlify/lib/license-seat-stage.mjs';
import licenseInvitations from '../../../../ZoeW/netlify/functions/license-invitations.mjs';
import { getStore } from '@netlify/blobs';
vi.mock('@netlify/blobs', () => ({ getStore: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());
const keys = () => { const p = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }); return { privateKey: p.privateKey, publicKey: p.publicKey.export({ format: 'jwk' }) }; };
const sign = (key: any, c: any) => { const payload = Buffer.from(JSON.stringify(c)).toString('base64url'); return { payload, signature: crypto.sign('sha256', Buffer.from(payload), { key: key.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url') }; };
it('បិទនៅពេលគ្មានការកំណត់សម្ងាត់', async () => { expect((await createInvitationService({ enabled: true }).execute({})).status).toBe(503); });
async function fixture(display?: any) {
    const seller = keys(), device = keys(), receipt = keys(), stranger = keys();
    let time = 1800000000000, etag = 1;
    let row: any = { schema: 1, revision: 1, releaseEpoch: 0, maxDevices: 1, licenseExpiresAt: time + 86400000, revoked: false, mode: 'staged', seats: {} };
    const store = { getWithMetadata: async () => ({ data: structuredClone(row), etag: String(etag) }), setJSON: async (_: any, v: any, o: any) => {
            if (o.onlyIfMatch !== String(etag))
                return { modified: false };
            row = structuredClone(v);
            etag++;
            return { modified: true };
        } };
    const service = createInvitationService({ store, enabled: true, encryptionKey: crypto.randomBytes(32).toString('base64url'), publicKeys: [seller.publicKey], receiptPrivateJwk: receipt.privateKey.export({ format: 'jwk' }), now: () => time });
    const keyId = 'SYNTHETICKEY123456789', inviteId = keyId + '.0123456789ABCDEF';
    const base = { domain: INVITATION_DOMAIN, audience: 'https://zoew.netlify.app', app: 'ZOE', keyId, inviteId, releaseEpoch: 0 };
    const call = (who: any, action: string, extra: any = {}) => service.execute(sign(who, { ...base, action, expiresAt: time + 30000, publicKey: who.publicKey, ...extra }));
    const license = sign(seller, { a: 'ZOE', id: keyId, iat: time, exp: time + 86400000 });
    const keyString = 'ZOEKEY-' + license.payload + '.' + license.signature;
    const enrollment = sign(device, { domain: 'zoe-license-enrollment-v1', audience: base.audience, app: 'ZOE', keyId, inviteId, target: 'pwa', nonce: '0123456789abcdef0123456789abcdef', publicKey: device.publicKey, ...(display ? { display } : {}) });
    const create = () => call(seller, 'create', { revision: 1, target: 'pwa', invitationExpiresAt: time + 60000, keyString });
    return { service, store, seller, device, receipt, stranger, base, call, keyString, enrollment, create, row: () => row, advance: (ms = 70000) => { time += ms; } };
}
it('រក្សាសោអ៊ិនគ្រីប ហើយផ្តល់តែឧបករណ៍ដែលបានអនុម័ត', async () => {
    const f = await fixture();
    const { seller, device, stranger, receipt, call, enrollment, keyString } = f;
    await f.create();
    expect(JSON.stringify(f.row())).not.toContain(keyString);
    const submitted = await call(device, 'submit', { enrollment });
    expect(submitted.status).toBe(200);
    const { requestId, fingerprint, enrollmentHash } = submitted.body;
    expect((await call(device, 'status', { requestId })).body.keyString).toBeUndefined();
    expect((await call(seller, 'approve', { requestId, fingerprint, enrollmentHash, revision: f.row().revision, receiptKeyFingerprint: seatKeyFingerprint(receipt.publicKey) })).status).toBe(200);
    expect((await call(stranger, 'status', { requestId })).status).toBe(403);
    expect((await call(device, 'status', { requestId })).body.keyString).toBe(keyString);
    f.row().releaseEpoch++;
    expect((await call(device, 'status', { requestId })).status).toBe(410);
});
it('ការស្នើម្តងទៀតរក្សាលេខដដែល និងបញ្ជីមិនប្តូរកំណែ', async () => {
    const f = await fixture();
    await f.create();
    const revision = f.row().revision;
    expect((await f.call(f.seller, 'list')).body.revision).toBe(revision);
    expect((await f.create()).status).toBe(200);
    expect(f.row().revision).toBe(revision);
    const results = await Promise.all([f.call(f.device, 'submit', { enrollment: f.enrollment }), f.call(f.device, 'submit', { enrollment: f.enrollment })]);
    expect(results.some(r => r.status === 200)).toBe(true);
    const retry = await f.call(f.device, 'submit', { enrollment: f.enrollment });
    expect(retry.status).toBe(200);
    expect(Object.keys(f.row().invitations[f.base.inviteId].requests)).toHaveLength(1);
    const approval = { requestId: retry.body.requestId, fingerprint: retry.body.fingerprint, enrollmentHash: retry.body.enrollmentHash, revision: f.row().revision, receiptKeyFingerprint: seatKeyFingerprint(f.receipt.publicKey) };
    expect((await f.call(f.seller, 'approve', approval)).status).toBe(200);
    expect((await f.call(f.seller, 'approve', approval)).status).toBe(200);
    const list = await f.call(f.seller, 'list');
    expect(JSON.stringify(list)).not.toContain(f.keyString);
    expect(JSON.stringify(list)).not.toContain('cipher');
});
it('ការបដិសេធ និងបោះបង់មិនផ្តល់សោ', async () => {
    const f = await fixture();
    await f.create();
    const r = await f.call(f.device, 'submit', { enrollment: f.enrollment });
    expect((await f.call(f.seller, 'reject', { requestId: r.body.requestId, revision: f.row().revision })).status).toBe(200);
    expect((await f.call(f.device, 'status', { requestId: r.body.requestId })).body.status).toBe('rejected');
    expect((await f.call(f.seller, 'cancel', { revision: f.row().revision })).status).toBe(200);
    expect(f.row().invitations[f.base.inviteId].cipher).toBeUndefined();
});
it('សំណើដែលផុតកំណត់ ឬអាជ្ញាបណ្ណត្រូវដក មិនផ្តល់សោ', async () => {
    const f = await fixture();
    await f.create();
    f.row().revoked = true;
    expect((await f.call(f.device, 'submit', { enrollment: f.enrollment })).status).toBe(403);
    f.row().revoked = false;
    f.advance();
    expect((await f.call(f.device, 'submit', { enrollment: f.enrollment })).status).toBe(410);
    await f.call(f.seller, 'list');
    expect(f.row().invitations).toEqual({});
});
it('កំណែ សញ្ញាឧបករណ៍ និងកម្រិតកៅអីត្រូវផ្គូផ្គង', async () => {
    const f = await fixture();
    await f.create();
    const r = await f.call(f.device, 'submit', { enrollment: f.enrollment });
    const approval = { requestId: r.body.requestId, fingerprint: r.body.fingerprint, enrollmentHash: r.body.enrollmentHash, revision: 1, receiptKeyFingerprint: seatKeyFingerprint(f.receipt.publicKey) };
    expect((await f.call(f.seller, 'approve', approval)).status).toBe(409);
    approval.revision = f.row().revision;
    f.row().seats.d1 = { publicKey: f.stranger.publicKey };
    expect((await f.call(f.seller, 'approve', approval)).body.reason).toBe('seat-limit');
    delete f.row().seats.d1;
    approval.enrollmentHash = '0'.repeat(64);
    expect((await f.call(f.seller, 'approve', approval)).body.reason).toBe('approval-mismatch');
    const mismatch = sign(f.device, { ...f.base, action: 'submit', expiresAt: 1800000030000, publicKey: f.device.publicKey, enrollment: f.enrollment });
    expect((await f.service.execute(mismatch, 'apk')).body.reason).toBe('target-mismatch');
});
it('ការអានយឺតឆ្លងផុតកំណត់មិនបង្ហាញសោ', async () => {
    const f = await fixture();
    await f.create();
    const read = f.store.getWithMetadata;
    f.store.getWithMetadata = async () => { const r = await read(); f.advance(); return r; };
    expect((await f.service.execute({ action: 'open', inviteId: f.base.inviteId })).status).toBe(410);
});
it('សំណើត្រឹមត្រូវត្រូវបានកំណត់ត្រឹមប្រាំ', async () => {
    const f = await fixture();
    await f.create();
    for (let i = 0; i < 6; i++) {
        const e = JSON.parse(Buffer.from(f.enrollment.payload, 'base64url').toString());
        e.nonce = String(i).padStart(32, '0');
        const r = await f.call(f.device, 'submit', { enrollment: sign(f.device, e) });
        expect(r.status).toBe(i < 5 ? 200 : 409);
    }
});
it('សំណើផុតកំណត់ក្រោយការអានមិនផ្តល់សោ', async () => {
    const f = await fixture();
    await f.create();
    const r = await f.call(f.device, 'submit', { enrollment: f.enrollment });
    const approval = { requestId: r.body.requestId, fingerprint: r.body.fingerprint, enrollmentHash: r.body.enrollmentHash, revision: f.row().revision, receiptKeyFingerprint: seatKeyFingerprint(f.receipt.publicKey) };
    const read = f.store.getWithMetadata;
    f.store.getWithMetadata = async () => { const v = await read(); f.advance(31000); return v; };
    expect((await f.call(f.seller, 'approve', approval)).body.reason).toBe('request-expired');
    expect(f.row().seats).toEqual({});
});
it('runtime បិទបើបរិបទ ឬសោមិនគ្រប់គ្រាន់', async () => {
    const receipt = keys();
    const valid = { ZOE_LICENSE_INVITATIONS: 'enabled', ZOE_LICENSE_SEAT_STAGE: 'enabled', ZOE_LICENSE_INVITE_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64url'), ZOE_LICENSE_SEAT_RECEIPT_PRIVATE_JWK: JSON.stringify(receipt.privateKey.export({ format: 'jwk' })) };
    for (const [name, value] of Object.entries(valid))
        vi.stubEnv(name, value);
    vi.mocked(getStore).mockReset();
    vi.mocked(getStore).mockReturnValue({} as any);
    const production = { deploy: { context: 'production' } };
    for (const context of [{}, { deploy: { context: 'deploy-preview' } }, { deploy: { context: 'dev' } }]) {
        expect((await licenseInvitations(new Request('https://zoew.netlify.app'), context)).status).toBe(503);
        expect(getStore).not.toHaveBeenCalled();
    }
    for (const name of Object.keys(valid)) {
        vi.stubEnv(name, '');
        expect((await licenseInvitations(new Request('https://zoew.netlify.app'), production)).status).toBe(503);
        expect(getStore).not.toHaveBeenCalled();
        vi.stubEnv(name, valid[name as keyof typeof valid]);
    }
    expect((await licenseInvitations(new Request('https://example.test'), production)).status).toBe(503);
    expect(getStore).not.toHaveBeenCalled();
    expect((await licenseInvitations(new Request('https://zoew.netlify.app'), production)).status).toBe(405);
    expect(getStore).toHaveBeenCalledOnce();
});
it('HTTP កំណត់ប្រភព ប្រភេទទិន្នន័យ និងការរក្សាទុក', async () => {
    const f = await fixture();
    await f.create();
    const request = (origin: string, method = 'POST', type = 'application/json', body: any = { action: 'open', inviteId: f.base.inviteId }) => new Request('https://zoew.netlify.app/.netlify/functions/license-invitations', { method, headers: { Origin: origin, 'Content-Type': type }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
    expect((await handleInvitationRequest(request('https://example.test'), f.service)).status).toBe(403);
    expect((await handleInvitationRequest(request('https://zoew.netlify.app', 'GET'), f.service)).status).toBe(405);
    expect((await handleInvitationRequest(request('https://zoew.netlify.app', 'POST', 'text/plain'), f.service)).status).toBe(415);
    const response = await handleInvitationRequest(request('https://zoew.netlify.app'), f.service);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Netlify-CDN-Cache-Control')).toBe('no-store');
    const signed = sign(f.device, { ...f.base, action: 'submit', expiresAt: 1800000030000, publicKey: f.device.publicKey, enrollment: f.enrollment });
    expect((await handleInvitationRequest(request('https://localhost', 'POST', 'application/json', signed), f.service)).status).toBe(403);
    expect((await handleInvitationRequest(request('https://localhost', 'OPTIONS'), f.service)).headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
});

it('ការអនុម័តរក្សាព័ត៌មានបង្ហាញរបស់ឧបករណ៍', async () => {
    const f = await fixture({ model: ' Pixel 9 ', platform: 'Android 16' });
    await f.create();
    const submitted = await f.call(f.device, 'submit', { enrollment: f.enrollment });
    const { requestId, fingerprint, enrollmentHash } = submitted.body;
    expect((await f.call(f.seller, 'approve', { requestId, fingerprint, enrollmentHash, revision: f.row().revision, receiptKeyFingerprint: seatKeyFingerprint(f.receipt.publicKey) })).status).toBe(200);
    expect(f.row().seats.d1.display).toEqual({ model: 'Pixel 9', platform: 'Android 16' });
});

it('ការអនុម័តសំណើចាស់រក្សាព័ត៌មានបង្ហាញដែលមាន', async () => {
    const f = await fixture();
    await f.create();
    const submitted = await f.call(f.device, 'submit', { enrollment: f.enrollment });
    f.row().seats.d1 = { publicKey: f.device.publicKey, display: { model: 'Pixel 9', platform: 'Android 16' } };
    const { requestId, fingerprint, enrollmentHash } = submitted.body;
    expect((await f.call(f.seller, 'approve', { requestId, fingerprint, enrollmentHash, revision: f.row().revision, receiptKeyFingerprint: seatKeyFingerprint(f.receipt.publicKey) })).status).toBe(200);
    expect(f.row().seats.d1.display).toEqual({ model: 'Pixel 9', platform: 'Android 16' });
});
