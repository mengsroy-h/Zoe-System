// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import licenseSeatStage from '../netlify/functions/license-seat-stage.mjs';
import { createSeatStageService, handleSeatStageRequest } from '../netlify/lib/license-seat-stage.mjs';
const now = 1800000000000;
async function keys() {
    const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    return { privateKey: pair.privateKey, publicKey: await webcrypto.subtle.exportKey('jwk', pair.publicKey) };
}
async function signed(key: webcrypto.CryptoKey, value: any) {
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
    const signature = Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(payload))).toString('base64url');
    return { payload, signature };
}
async function fixture() {
    const seller = await keys(), device = await keys(), impostor = await keys();
    let row: any = null, etag = 0;
    const store = {
        getWithMetadata: async () => row ? { data: structuredClone(row), etag: String(etag) } : null,
        setJSON: async (_key: string, value: any, opts: any) => {
            if ((opts.onlyIfNew && row) || (opts.onlyIfMatch && opts.onlyIfMatch !== String(etag))) return { modified: false };
            row = structuredClone(value); etag++; return { modified: true };
        }
    };
    const service = createSeatStageService({ store, publicKeys: [seller.publicKey], now: () => now, enabled: true });
    const base = { domain: 'zoe-license-seat-stage-v1', app: 'ZOE', keyId: 'SYNTHETICKEY123456789', expiresAt: now + 30000 };
    const request = async (who: any, action: string, revision: number, extra = {}) => service.execute(await signed(who.privateKey, { ...base, action, revision, ...extra }));
    const configure = () => request(seller, 'configure', 0, { licenseExpiresAt: now + 86400000, maxDevices: 1, revoked: false });
    const enroll = () => request(seller, 'enroll', 1, { slot: 'd1', publicKey: device.publicKey, releaseEpoch: 0 });
    return { service, seller, device, impostor, request, configure, enroll, row: () => row, store, base };
}
describe('ការចុះឈ្មោះ License ជាដំណាក់កាល', () => {
    it('បិទតាមលំនាំដើម ដោយមិនអានឬសរសេរទិន្នន័យ', async () => {
        const service = createSeatStageService({ store: { getWithMetadata: () => { throw Error('must not read'); } } });
        expect((await service.execute({})).status).toBe(503);
        expect((await handleSeatStageRequest(new Request('https://example.test', { method: 'POST', body: '{}' }), service)).status).toBe(503);
    });
    it('Netlify endpoint មិនបើកតាមតម្លៃ env ដែលមិនច្បាស់', async () => {
        const old = process.env.ZOE_LICENSE_SEAT_STAGE;
        try {
            for (const value of ['', 'true', '1', 'false']) {
                process.env.ZOE_LICENSE_SEAT_STAGE = value;
                const response = await licenseSeatStage(new Request('https://example.test'));
                expect(response.status).toBe(503);
                expect(await response.json()).toMatchObject({ reason: 'stage-disabled', grantsLicense: false });
                expect(response.headers.get('Cache-Control')).toBe('no-store');
            }
        } finally { if (old === undefined) delete process.env.ZOE_LICENSE_SEAT_STAGE; else process.env.ZOE_LICENSE_SEAT_STAGE = old; }
    });
    it('ទាមទារអ្នកលក់ចុះឈ្មោះ មិនជឿឧបករណ៍ដែលចម្លងលេខសម្គាល់', async () => {
        const f = await fixture(); expect((await f.configure()).status).toBe(200);
        expect((await f.request(f.device, 'enroll', 1, { slot: 'd1', publicKey: f.device.publicKey, releaseEpoch: 0 })).status).toBe(403);
        expect((await f.enroll()).status).toBe(200);
        expect((await f.request(f.impostor, 'prove', 2, { slot: 'd1', releaseEpoch: 0 })).status).toBe(403);
        const proof = await f.request(f.device, 'prove', 2, { slot: 'd1', releaseEpoch: 0 });
        expect(proof.status).toBe(200); expect(proof.body).toMatchObject({ staged: true, proofVerified: true, grantsLicense: false });
        expect((await f.request(f.device, 'prove', 2, { slot: 'd1', releaseEpoch: 0 })).status).toBe(409);
    });
    it('ពិដានឧបករណ៍ និងការដោះឧបករណ៍ សម្រេចតែម្តងនៅ Server', async () => {
        const f = await fixture(); await f.configure(); await f.enroll();
        expect((await f.request(f.seller, 'enroll', 2, { slot: 'd2', publicKey: f.impostor.publicKey, releaseEpoch: 0 })).status).toBe(409);
        const race = await Promise.all([f.request(f.device, 'prove', 2, { slot: 'd1', releaseEpoch: 0 }), f.request(f.seller, 'release', 2)]);
        expect(race.map(r => r.status).sort()).toEqual([200, 409]);
        const revision = f.row().revision; expect((await f.request(f.seller, 'release', revision)).status).toBe(200);
        expect((await f.request(f.device, 'prove', revision + 1, { slot: 'd1', releaseEpoch: 0 })).status).toBe(403);
        expect(f.row().seats).toEqual({}); expect(f.row().releaseEpoch).toBeGreaterThan(0);
    });
    it('បដិសេធសំណើផុតកំណត់ និងខុស domain', async () => {
        const f = await fixture();
        expect((await f.request(f.seller, 'configure', 0, { expiresAt: now - 1 })).status).toBe(400);
        expect((await f.request(f.seller, 'configure', 0, { domain: 'other' })).status).toBe(400);
        expect((await f.service.execute({ payload: 'not-json', signature: 'bad' })).status).toBe(400);
    });
    it('បដិសេធការកែសារចុះហត្ថលេខា និងការប្រើភស្តុតាងឆ្លង Key', async () => {
        const f = await fixture(); await f.configure(); await f.enroll();
        const proof = await signed(f.device.privateKey, { ...f.base, action: 'prove', revision: 2, slot: 'd1', releaseEpoch: 0 });
        const changed = { ...proof, payload: Buffer.from(JSON.stringify({ ...f.base, action: 'release', revision: 2 })).toString('base64url') };
        expect((await f.service.execute(changed)).status).toBe(403);
        const otherKey = { ...proof, payload: Buffer.from(JSON.stringify({ ...f.base, keyId: 'OTHERLICENSE123456789', action: 'prove', revision: 2, slot: 'd1', releaseEpoch: 0 })).toString('base64url') };
        expect((await f.service.execute(otherKey)).status).toBe(403);
        expect(f.device.privateKey.extractable).toBe(false);
        await expect(webcrypto.subtle.exportKey('jwk', f.device.privateKey)).rejects.toThrow();
        expect(f.row().revision).toBe(2);
    });
    it('Revoke និង expiry បិទភស្តុតាង ហើយមិនបង្ខំលុបកៅអីដែលមានម្ចាស់', async () => {
        const f = await fixture(); await f.configure(); await f.enroll();
        expect((await f.request(f.seller, 'enroll', 2, { slot: 'd1', releaseEpoch: 0, publicKey: f.impostor.publicKey })).status).toBe(409);
        expect((await f.request(f.seller, 'configure', 2, { maxDevices: 1, licenseExpiresAt: now + 5000, revoked: true })).status).toBe(200);
        expect((await f.request(f.device, 'prove', 3, { slot: 'd1', releaseEpoch: 0 })).status).toBe(403);
        expect((await f.request(f.seller, 'configure', 3, { maxDevices: 1, licenseExpiresAt: now - 1, revoked: false })).status).toBe(200);
        expect((await f.request(f.device, 'prove', 4, { slot: 'd1', releaseEpoch: 0 })).status).toBe(403);
    });
    it('បដិសេធ private key ហើយអ្នកលក់អាចអានស្ថានភាពក្រោយលទ្ធផលមិនប្រាកដ', async () => {
        const f = await fixture(); await f.configure();
        expect((await f.request(f.seller, 'enroll', 1, { slot: 'd1', releaseEpoch: 0, publicKey: { ...f.device.publicKey, d: 'secret' } })).status).toBe(400);
        const write = f.store.setJSON;
        f.store.setJSON = async (...args) => { await write(...args); throw Error('lost reply'); };
        expect((await f.enroll()).status).toBe(503);
        const inspected = await f.request(f.seller, 'inspect', 0);
        expect(inspected.status).toBe(200); expect(inspected.body.state.revision).toBe(2);
        expect(inspected.body.state.seats.d1.publicKey).not.toHaveProperty('d');
        expect((await f.enroll()).status).toBe(409);
    });
    it('សំណើ HTTP មានព្រំដែនទំហំ និងពេលវេលា', async () => {
        const f = await fixture();
        const post = (body: any, contentType = 'application/json') => new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': contentType }, body, duplex: 'half' } as any);
        expect((await handleSeatStageRequest(new Request('https://example.test'), f.service)).status).toBe(405);
        expect((await handleSeatStageRequest(post('{}', 'text/plain'), f.service)).status).toBe(415);
        expect((await handleSeatStageRequest(post('a'.repeat(8193)), f.service)).status).toBe(400);
        vi.useFakeTimers();
        try {
            const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{}')); } });
            const pending = handleSeatStageRequest(post(stream), f.service);
            await vi.advanceTimersByTimeAsync(5000);
            expect((await pending).status).toBe(400);
        } finally { vi.useRealTimers(); }
    });
});
