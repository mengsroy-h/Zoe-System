// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function database() {
    const data = new Map<string, any>();
    const state = { unavailable: false, failWrite: false, abortWrite: false, pendingAbort: false, readsBeforeAbort: 0, aborts: 0 };
    const db = {
        objectStoreNames: { contains: () => true }, close() {}, createObjectStore() {},
        transaction(_name: string, mode: string) {
            if (mode === 'readonly' && state.pendingAbort) state.readsBeforeAbort++;
            const tx: any = { error: null, abort() { queueMicrotask(() => tx.onabort?.()); } };
            const request = (fn: () => any) => {
                const req: any = {};
                queueMicrotask(() => {
                    try {
                        req.result = fn(); req.onsuccess?.();
                        if (mode === 'readwrite' && state.abortWrite) {
                            data.delete(req.result);
                            tx.error = Object.assign(Error('aborted'), { name: 'AbortError' });
                            queueMicrotask(() => tx.onabort?.());
                        } else queueMicrotask(() => tx.oncomplete?.());
                    }
                    catch (error) {
                        req.error = error; state.pendingAbort = true;
                        req.onerror?.(); tx.onerror?.({ target: req });
                        queueMicrotask(() => { tx.error = error; state.pendingAbort = false; state.aborts++; tx.onabort?.(); });
                    }
                }); return req;
            };
            tx.objectStore = () => ({
                get: (key: string) => request(() => structuredClone(data.get(key))),
                add: (value: any, key: string) => request(() => {
                    if (mode !== 'readwrite' || state.failWrite) throw Error('storage');
                    if (data.has(key)) throw Object.assign(Error('duplicate'), { name: 'ConstraintError' });
                    data.set(key, structuredClone(value)); return key;
                })
            }); return tx;
        }
    };
    return { data, state, indexedDB: { open() {
        if (state.unavailable) throw Error('unavailable');
        const req: any = {};
        queueMicrotask(() => { req.result = db; req.onsuccess?.(); }); return req;
    } } };
}
function client(db = database()) {
    const ctx: any = { crypto: webcrypto, indexedDB: db.indexedDB, Uint8Array, TextEncoder, TextDecoder, setTimeout, clearTimeout,
        btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'), atob: (s: string) => Buffer.from(s, 'base64').toString('binary') };
    ctx.window = ctx;
    vm.runInNewContext(readFileSync('public/license-seat-client.js', 'utf8'), ctx);
    return { api: ctx.ZoeSeatClient, ...db };
}
const app = 'ZOE', keyId = 'SYNTHETICKEY123456789';

describe('អត្តសញ្ញាណឧបករណ៍ License', () => {
    it('កូនសោឯកជនមិនអាច export ហើយនៅដដែលក្រោយបើកទំព័រថ្មី', async () => {
        const c = client(), identity = await c.api.createIdentity(app, keyId);
        expect(identity.privateKey.extractable).toBe(false);
        await expect(webcrypto.subtle.exportKey('jwk', identity.privateKey)).rejects.toThrow();
        const second = client(c);
        expect((await second.api.loadIdentity(app, keyId)).publicKey).toEqual(identity.publicKey);
        expect(await c.api.fingerprint(identity.publicKey)).toMatch(/^[a-f0-9]{64}$/);
    });
    it('ពីរទំព័របង្កើតព្រមគ្នារក្សាកូនសោរបស់អ្នកឈ្នះតែមួយ', async () => {
        const db = database(), first = client(db), second = client(db);
        const [a, b] = await Promise.all([first.api.createIdentity(app, keyId), second.api.createIdentity(app, keyId)]);
        expect(a.publicKey).toEqual(b.publicKey); expect(db.data.size).toBe(1);
        expect(db.state.aborts).toBe(1); expect(db.state.readsBeforeAbort).toBe(0);
    });
    it('ភស្តុតាងចង app និង Key ហើយទាមទារកូនសោឯកជនពិត', async () => {
        const c = client(); await c.api.createIdentity(app, keyId);
        const request = await c.api.enrollmentRequest(app, keyId);
        const payload = JSON.parse(Buffer.from(request.payload, 'base64url').toString());
        expect(payload).toMatchObject({ domain: 'zoe-license-enrollment-v1', app, keyId });
        expect(payload.publicKey).not.toHaveProperty('d');
        const key = await webcrypto.subtle.importKey('jwk', payload.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(request.signature, 'base64url'), Buffer.from(request.payload))).toBe(true);
        const proof = await c.api.signCommand(app, keyId, { domain: 'zoe-license-seat-stage-v1', audience: 'https://zoew.netlify.app', app, keyId, action: 'prove', revision: 2 });
        expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(proof.signature, 'base64url'), Buffer.from(proof.payload))).toBe(true);
        await expect(c.api.signCommand(app, keyId, { domain: 'zoe-license-seat-stage-v1', audience: 'https://zoew.netlify.app', app, keyId: 'OTHERKEY1234567890' })).rejects.toThrow();
    });
    it('កូនសោបាត់ ឬខូចមិនបង្កើតជំនួសដោយស្វ័យប្រវត្តិ', async () => {
        const c = client();
        expect(await c.api.loadIdentity(app, keyId)).toBeNull();
        await expect(c.api.enrollmentRequest(app, keyId)).rejects.toThrow();
        await expect(c.api.signCommand(app, keyId, { domain: 'zoe-license-seat-stage-v1', audience: 'https://zoew.netlify.app', app, keyId })).rejects.toThrow();
        expect(c.data.size).toBe(0);
        await c.api.createIdentity(app, keyId);
        const storedKey = [...c.data.keys()][0]; c.data.set(storedKey, { corrupt: true });
        await expect(c.api.loadIdentity(app, keyId)).rejects.toThrow();
        await expect(c.api.createIdentity(app, keyId)).rejects.toThrow();
        expect(c.data.get(storedKey)).toEqual({ corrupt: true });
    });
    it('storage បដិសេធមិនផ្ដល់អត្តសញ្ញាណដែលមិនបានរក្សា', async () => {
        const c = client(); c.state.failWrite = true;
        await expect(c.api.createIdentity(app, keyId)).rejects.toThrow(); expect(c.data.size).toBe(0);
        c.state.unavailable = true;
        await expect(c.api.loadIdentity(app, keyId)).rejects.toThrow();
    });
    it('request success មុន transaction abort មិនមែនជាការរក្សាទុក ឬជាការប្រជែងកូនសោ', async () => {
        const c = client(); c.state.abortWrite = true;
        await expect(c.api.createIdentity(app, keyId)).rejects.toMatchObject({ name: 'AbortError' });
        expect(c.data.size).toBe(0); expect(await c.api.loadIdentity(app, keyId)).toBeNull();
    });
    it('receipt ត្រូវចុះហត្ថលេខាដោយ key ដែលបាន pin និងចងឧបករណ៍ពិត', async () => {
        const c = client(), device = await c.api.createIdentity(app, keyId);
        const fp = await c.api.fingerprint(device.publicKey);
        const server = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
        const pinned = await webcrypto.subtle.exportKey('jwk', server.publicKey);
        const now = 1800000000000;
        const value = { domain: 'zoe-license-seat-receipt-v1', audience: 'https://zoew.netlify.app', app, keyId, fingerprint: fp, issuedAt: now, validUntil: now + 60000, licenseExpiresAt: now + 86400000, releaseEpoch: 2 };
        const sign = async (data: any) => {
            const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
            const signature = Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, server.privateKey, Buffer.from(payload))).toString('base64url');
            return { payload, signature };
        };
        const receipt = await sign(value), expected = { app, keyId, fingerprint: fp, releaseEpoch: 2 };
        expect(await c.api.verifyReceipt(receipt, [pinned], expected, now)).toEqual(value);
        await expect(c.api.verifyReceipt(receipt, [device.publicKey], expected, now)).rejects.toThrow();
        for (const changed of [{ fingerprint: 'a'.repeat(64) }, { app: 'OTHER' }, { keyId: 'OTHERKEY1234567890' }, { issuedAt: now + 1 }, { validUntil: now - 1 }, { licenseExpiresAt: now - 1 }, { releaseEpoch: 3 }, { domain: 'other' }, { audience: 'https://other.test' }, { releaseEpoch: -1 }, { validUntil: now + 4 * 86400000, licenseExpiresAt: now + 5 * 86400000 }]) {
            await expect(c.api.verifyReceipt(await sign({ ...value, ...changed }), [pinned], expected, now)).rejects.toThrow();
        }
        await expect(c.api.verifyReceipt(receipt, [pinned], expected, NaN)).rejects.toThrow();
    });
    it('កូនសោ public និង private មិនត្រូវគ្នាមិនអាចប្រើបាន', async () => {
        const c = client(); await c.api.createIdentity(app, keyId);
        const other = await c.api.createIdentity(app, 'OTHERKEY1234567890');
        const storedKey = [...c.data.keys()][0], original = c.data.get(storedKey);
        c.data.set(storedKey, { ...original, publicKey: other.publicKey });
        await expect(c.api.loadIdentity(app, keyId)).rejects.toThrow();
        expect(c.data.get(storedKey).publicKey).toEqual(other.publicKey);
    });
    it('IndexedDB ដែលមិនឆ្លើយត្រូវបញ្ចប់ដោយមិនផ្ដល់អត្តសញ្ញាណ', async () => {
        vi.useFakeTimers();
        try {
            const db = database(); db.indexedDB.open = () => ({});
            const c = client(db);
            const pending = expect(c.api.loadIdentity(app, keyId)).rejects.toThrow('identity-storage-timeout');
            await vi.advanceTimersByTimeAsync(5000); await pending;
        } finally { vi.useRealTimers(); }
    });
    it('helper ទាំងពីរមាន bytes ដូចគ្នា', () => {
        expect(readFileSync('public/license-seat-client.js', 'utf8')).toBe(readFileSync('../ZoeKeyGen/license-seat-client.js', 'utf8'));
    });
});
