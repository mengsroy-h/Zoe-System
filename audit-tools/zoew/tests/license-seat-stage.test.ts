// @vitest-environment node
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import licenseSeatStage from '../../../ZoeW/netlify/functions/license-seat-stage.mjs';
import { createSeatStageService, handleSeatStageRequest, seatKeyFingerprint } from '../../../ZoeW/netlify/lib/license-seat-stage.mjs';
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
async function fixture(receipts = false) {
    const seller = await keys(), device = await keys(), impostor = await keys();
    let row: any = null, etag = 0;
    const store = {
        getWithMetadata: async () => row ? { data: structuredClone(row), etag: String(etag) } : null,
        setJSON: async (_key: string, value: any, opts: any) => {
            if ((opts.onlyIfNew && row) || (opts.onlyIfMatch && opts.onlyIfMatch !== String(etag))) return { modified: false };
            row = structuredClone(value); etag++; return { modified: true };
        }
    };
    const receiptPair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const receiptPublicKey = await webcrypto.subtle.exportKey('jwk', receiptPair.publicKey);
    const receiptPrivateJwk = receipts ? await webcrypto.subtle.exportKey('jwk', receiptPair.privateKey) : null;
    const service = createSeatStageService({ store, publicKeys: [seller.publicKey], now: () => now, enabled: true, receiptPrivateJwk });
    const base = { domain: 'zoe-license-seat-stage-v1', audience: 'https://zoew.netlify.app', app: 'ZOE', keyId: 'SYNTHETICKEY123456789', expiresAt: now + 30000 };
    const request = async (who: any, action: string, revision: number, extra = {}) => service.execute(await signed(who.privateKey, { ...base, action, revision, ...extra }));
    const configure = () => request(seller, 'configure', 0, { licenseExpiresAt: now + 86400000, maxDevices: 1, revoked: false });
    const enroll = async () => request(seller, 'enroll', 1, { slot: 'd1', publicKey: device.publicKey, releaseEpoch: 0, enrollment: await signed(device.privateKey, { domain: 'zoe-license-enrollment-v1', audience: 'https://zoew.netlify.app', app: base.app, keyId: base.keyId, publicKey: device.publicKey, nonce: '0123456789abcdef0123456789abcdef' }) });
    return { service, seller, device, impostor, request, configure, enroll, row: () => row, store, base, receiptPublicKey };
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

describe('ការផ្ទេរ License ទៅសិទ្ធិថ្មី', () => {
    it('មិនអនុញ្ញាត cutover បើគ្មានកូនសោ receipt និងឧបករណ៍គ្រប់ចំនួន', async () => {
        const f = await fixture(); await f.configure(); await f.enroll();
        expect((await f.request(f.seller, 'cutover', 2, { expectedDevices: 1, receiptKeyFingerprint: '0'.repeat(64) })).status).toBe(503);
        expect(f.row().mode).toBe('staged');
    });
    it('ការចុះឈ្មោះត្រូវមានភស្តុតាង private key និងមិនទទួល public key តែឯង', async () => {
        const f = await fixture(); await f.configure();
        expect((await f.request(f.seller, 'enroll', 1, { slot: 'd1', releaseEpoch: 0, publicKey: f.device.publicKey })).status).toBe(400);
        expect(f.row().seats).toEqual({});
    });
});

async function activeFixture() {
    const f = await fixture(true); await f.configure(); await f.enroll();
    expect((await f.request(f.seller, 'cutover', 2, { expectedDevices: 1, receiptKeyFingerprint: seatKeyFingerprint(f.receiptPublicKey) })).status).toBe(200);
    return f;
}
describe('អាជ្ញាប័ណ្ណថ្មីផ្ទៀងផ្ទាត់ពីចុងដល់ចុង', () => {
    it('ចេញ signed receipt តែក្រោយ cutover និងបដិសេធ signer ខុស/ចំនួនឧបករណ៍ខុស', async () => {
        const f = await fixture(true); await f.configure(); await f.enroll();
        expect((await f.request(f.seller, 'cutover', 2, { expectedDevices: 2, receiptKeyFingerprint: seatKeyFingerprint(f.receiptPublicKey) })).status).toBe(409);
        expect((await f.request(f.seller, 'cutover', 2, { expectedDevices: 1, receiptKeyFingerprint: 'a'.repeat(64) })).status).toBe(409);
        expect((await f.request(f.device, 'prove', 2, { slot: 'd1', releaseEpoch: 0 })).body).not.toHaveProperty('receipt');
        await f.request(f.seller, 'cutover', 3, { expectedDevices: 1, receiptKeyFingerprint: seatKeyFingerprint(f.receiptPublicKey) });
        const proof = await f.request(f.device, 'prove', 4, { slot: 'd1', releaseEpoch: 0 });
        expect(proof.body).toMatchObject({ grantsLicense: true, staged: false });
        const payload = JSON.parse(Buffer.from(proof.body.receipt.payload, 'base64url').toString());
        expect(payload).toMatchObject({ domain: 'zoe-license-seat-receipt-v1', fingerprint: seatKeyFingerprint(f.device.publicKey), releaseEpoch: 0 });
        const pub = await webcrypto.subtle.importKey('jwk', f.receiptPublicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, Buffer.from(proof.body.receipt.signature, 'base64url'), Buffer.from(proof.body.receipt.payload))).toBe(true);
        expect((await f.request(f.device, 'prove', 4, { slot: 'd1', releaseEpoch: 0 })).status).toBe(409);
    });
    it('verifier ពិតបដិសេធចម្លង ID/receipt ហើយទុក offline grace តែជាមួយ private key ត្រឹមត្រូវ', async () => {
        const f = await activeFixture();
        const licenseEnvelope = await signed(f.seller.privateKey, { a: 'ZOE', id: f.base.keyId, iat: Math.floor(now / 1000), exp: Math.floor((now + 86400000) / 1000) });
        const licenseKey = 'ZOEKEY-' + licenseEnvelope.payload + '.' + licenseEnvelope.signature;
        let offline = false, legacySeatRequests = 0;
        const makeClient = (who: any, copied?: Map<string, string>, legacyPolicy: any = true) => {
            const store = new Map(copied || [['zoe_license_device_id', 'PUBLICCOPIEDID1234567890']]);
            const ctx: any = { Date, performance, setTimeout, clearTimeout, AbortController, TextEncoder, TextDecoder, Uint8Array, crypto: webcrypto,
                navigator: { onLine: true },
                atob: (s: string) => Buffer.from(s, 'base64').toString('binary'), btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
                localStorage: { getItem: (k: string) => store.get(k) || null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
                fetch: async (url: string, init: any) => {
                    if (offline) throw Error('offline');
                    if (url.includes('/license_seats/')) { legacySeatRequests++; throw Error('legacy forbidden'); }
                    if (url.includes('/license_keys/')) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ seatProtocol: 2, expiresAt: now - 1, revoked: true }) };
                    const reply = await f.service.execute(JSON.parse(init.body));
                    return { ok: reply.status === 200, status: reply.status, headers: { get: () => null }, json: async () => reply.body };
                }
            };
            ctx.window = ctx;
            vm.runInNewContext(readFileSync('public/license-seat-client.js', 'utf8'), ctx);
            ctx.ZoeSeatClient.loadIdentity = async () => who;
            ctx.ZoeSeatClient.signCommand = async (_app: string, _id: string, command: any) => signed(who.privateKey, command);
            ctx.ZoeSeatConfig = { audience: 'https://zoew.netlify.app', legacyProtocolEnabled: legacyPolicy, receiptPublicKeys: [f.receiptPublicKey] };
            if (legacyPolicy === 'missing') delete ctx.ZoeSeatConfig;
            if (legacyPolicy === 'inherited') { delete ctx.ZoeSeatConfig.legacyProtocolEnabled; Object.setPrototypeOf(ctx.ZoeSeatConfig, { legacyProtocolEnabled: true }); }
            const source = readFileSync('public/license-verify.js', 'utf8').replace(/const PUBLIC_KEYS_JWK = \[[\s\S]*?\];/, 'const PUBLIC_KEYS_JWK = [' + JSON.stringify(f.seller.publicKey) + '];');
            vm.runInNewContext(source, ctx); ctx.ZoeLicense.setServerTimeOffset(now - Date.now() + 10);
            return { api: ctx.ZoeLicense, store, ctx };
        };
        const owner = makeClient(f.device);
        expect((await owner.api.activate(licenseKey, 'ZOE')).valid).toBe(true);
        expect((await makeClient(f.impostor).api.activate(licenseKey, 'ZOE')).valid).toBe(false);
        offline = true;
        expect((await owner.api.getStatus('ZOE')).state).toBe('active');
        expect((await makeClient(f.impostor, owner.store).api.getStatus('ZOE')).state).not.toBe('active');
        const missingPins = makeClient(f.device, owner.store); missingPins.ctx.ZoeSeatConfig.receiptPublicKeys = [];
        expect((await missingPins.api.getStatus('ZOE')).state).not.toBe('active');
        const delayed = makeClient(f.device, owner.store);
        delayed.ctx.ZoeSeatClient.loadIdentity = async () => { delayed.api.setServerTimeOffset(now + 2 * 86400000 - Date.now()); return f.device; };
        expect((await delayed.api.getStatus('ZOE')).state).not.toBe('active');
        const strippedStore = new Map(owner.store);
        const recordKey = 'zoe_license_activation_ZOE';
        const stripped = JSON.parse(strippedStore.get(recordKey)!); delete stripped.seatProtocol; delete stripped.seatReceipt;
        strippedStore.set(recordKey, JSON.stringify(stripped));
        expect((await makeClient(f.impostor, strippedStore, true).api.getStatus('ZOE')).state).toBe('active');
        for (const policy of [false, 'missing', 'inherited', 'true', 1, null]) {
            expect((await makeClient(f.impostor, strippedStore, policy).api.getStatus('ZOE')).state).not.toBe('active');
        }
        expect(legacySeatRequests).toBe(0);
        offline = false;
        await f.request(f.seller, 'release', f.row().revision);
        expect((await owner.api.getStatus('ZOE')).state).toBe('required');
    });
});

describe('ការភ្ជាប់ជួសជុលកូនសោទៅអាជ្ញាប័ណ្ណដែលមានហត្ថលេខា', () => {
    async function repairFixture() {
        const seller = await keys();
        const envelope = await signed(seller.privateKey, { a: 'ZOE', id: 'SYNTHETICKEY123456789', iat: 1, exp: 2000000000 });
        const token = {};
        const inspectCorruptIdentity = vi.fn(async () => token);
        const repairIdentity = vi.fn(async () => ({}));
        const ctx: any = { crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, Date, performance, setTimeout, clearTimeout,
            atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
            ZoeSeatClient: { inspectCorruptIdentity, repairIdentity } };
        ctx.window = ctx;
        vm.runInNewContext(readFileSync('public/license-verify.js', 'utf8').replace(/const PUBLIC_KEYS_JWK = \[[\s\S]*?\];/, 'const PUBLIC_KEYS_JWK = [' + JSON.stringify(seller.publicKey) + '];'), ctx);
        return { api: ctx.ZoeLicense, keyString: 'ZOEKEY-' + envelope.payload + '.' + envelope.signature, token, inspectCorruptIdentity, repairIdentity };
    }
    it('ពិនិត្យហត្ថលេខា និង app មុនអានកូនសោ ហើយរក្សា key ID ត្រឹមត្រូវ', async () => {
        const f = await repairFixture();
        expect((await f.api.inspectSeatIdentity('ZOEKEY-invalid', 'ZOE')).valid).toBe(false);
        expect((await f.api.inspectSeatIdentity(f.keyString, 'OTHER')).valid).toBe(false);
        expect(f.inspectCorruptIdentity).not.toHaveBeenCalled();
        expect(await f.api.inspectSeatIdentity(f.keyString, 'ZOE')).toEqual({ valid: true, repairToken: f.token, keyId: 'SYNTHETICKEY123456789' });
        expect(f.inspectCorruptIdentity).toHaveBeenCalledWith('ZOE', 'SYNTHETICKEY123456789');
        expect(f.repairIdentity).not.toHaveBeenCalled();
    });
    it('កំហុស Storage ឬគ្មាន token មិនអនុញ្ញាតឱ្យជួសជុល', async () => {
        const f = await repairFixture(); f.inspectCorruptIdentity.mockRejectedValueOnce(Error('transient'));
        expect((await f.api.inspectSeatIdentity(f.keyString, 'ZOE')).valid).toBe(false);
        f.inspectCorruptIdentity.mockResolvedValueOnce(null as any);
        expect((await f.api.inspectSeatIdentity(f.keyString, 'ZOE')).valid).toBe(false);
        expect(f.repairIdentity).not.toHaveBeenCalled();
    });
    it('បញ្ជូន guard ដល់ helper ហើយបដិសេធម្ចាស់ចាស់', async () => {
        const f = await repairFixture();
        expect((await f.api.repairSeatIdentity(f.token, () => false)).valid).toBe(false);
        expect(f.repairIdentity).not.toHaveBeenCalled();
        const guard = () => true;
        expect(await f.api.repairSeatIdentity(f.token, guard)).toEqual({ valid: true });
        expect(f.repairIdentity).toHaveBeenCalledWith(f.token, guard);
    });
});
