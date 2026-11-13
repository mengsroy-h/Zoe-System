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
function transactionalDatabase() {
    const data = new Map<string, any>();
    const state = { unavailable: false, failWrite: false, abortWrite: false, readFailure: false };
    const waiting: Array<() => void> = [];
    let busy = false;
    const next = () => { busy = false; const start = waiting.shift(); if (start) { busy = true; setImmediate(start); } };
    const db = {
        objectStoreNames: { contains: () => true }, close() {}, createObjectStore() {},
        transaction(_name: string, mode: string) {
            let working: Map<string, any>, stopped = false, running = false;
            const requests: Array<() => void> = [];
            const tx: any = { error: null, abort() {
                if (stopped) return;
                stopped = true;
                setImmediate(() => { tx.onabort?.(); next(); });
            } };
            const drain = () => {
                if (stopped) return;
                const request = requests.shift();
                if (request) { request(); setImmediate(drain); return; }
                stopped = true;
                if (mode === 'readwrite') { data.clear(); working.forEach((value, key) => data.set(key, value)); }
                tx.oncomplete?.(); next();
            };
            const request = (operation: () => any) => {
                const req: any = {};
                requests.push(() => {
                    try { req.result = operation(); req.onsuccess?.(); }
                    catch (error) { req.error = error; req.onerror?.(); tx.error = error; tx.onerror?.(); tx.abort(); }
                });
                return req;
            };
            tx.objectStore = () => ({
                get: (key: string) => request(() => { if (state.readFailure) throw Error('read-failure'); return structuredClone(working.get(key)); }),
                add: (value: any, key: string) => request(() => {
                    if (state.failWrite) throw Error('write-failure');
                    if (working.has(key)) throw Object.assign(Error('duplicate'), { name: 'ConstraintError' });
                    working.set(key, structuredClone(value)); return key;
                }),
                put: (value: any, key: string) => request(() => {
                    if (state.failWrite) throw Error('write-failure');
                    working.set(key, structuredClone(value));
                    if (state.abortWrite) { tx.error = Error('write-aborted'); tx.abort(); }
                    return key;
                })
            });
            const start = () => { if (running) return; running = true; working = new Map(data); drain(); };
            waiting.push(start); if (!busy) next();
            return tx;
        }
    };
    return { data, state, indexedDB: { open() {
        if (state.unavailable) throw Error('unavailable');
        const req: any = {}; queueMicrotask(() => { req.result = db; req.onsuccess?.(); }); return req;
    } } };
}
function client(db: any = database(), cryptoProvider: any = webcrypto) {
    const ctx: any = { crypto: cryptoProvider, indexedDB: db.indexedDB, Uint8Array, TextEncoder, TextDecoder, setTimeout, clearTimeout,
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
    it('ការពិនិត្យជួសជុលបដិសេធកូនសោល្អ ហើយចេញ token តែសម្រាប់កូនសោខូច', async () => {
        const c = client(); await c.api.createIdentity(app, keyId);
        await expect(c.api.inspectCorruptIdentity(app, keyId)).rejects.toThrow('identity-healthy');
        c.data.set(app + '/' + keyId, { corrupt: true });
        const token = await c.api.inspectCorruptIdentity(app, keyId);
        expect(token).toMatchObject({ app, keyId });
        await expect(c.api.repairIdentity({ ...token }, () => true)).rejects.toThrow('identity-repair-token');
        await expect(c.api.repairIdentity(token, () => false)).rejects.toThrow('identity-repair-stale');
        expect(c.data.get(app + '/' + keyId)).toEqual({ corrupt: true });
        c.state.unavailable = true;
        await expect(c.api.inspectCorruptIdentity(app, keyId)).rejects.toThrow('identity-storage-unavailable');
    });
    it('transaction ជួសជុលរក្សាកូនសោឈ្នះតែមួយ និងមិនប៉ះ scope ផ្សេង', async () => {
        const db = transactionalDatabase(), first = client(db), second = client(db);
        const other = await first.api.createIdentity(app, 'OTHERKEY1234567890');
        db.data.set(app + '/' + keyId, { corrupt: true });
        const a = await first.api.inspectCorruptIdentity(app, keyId), b = await second.api.inspectCorruptIdentity(app, keyId);
        const results = await Promise.allSettled([first.api.repairIdentity(a, () => true), second.api.repairIdentity(b, () => true)]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
        const winner = (results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
        expect((await first.api.loadIdentity(app, keyId)).publicKey).toEqual(winner.publicKey);
        expect((await first.api.loadIdentity(app, 'OTHERKEY1234567890')).publicKey).toEqual(other.publicKey);
        expect(db.data.size).toBe(2);
    });
    it('transaction abort និង transient storage មិនបាត់កូនសោខូច', async () => {
        for (const failure of ['failWrite', 'abortWrite', 'readFailure'] as const) {
            const db = transactionalDatabase(), c = client(db);
            db.data.set(app + '/' + keyId, { corrupt: true });
            const token = await c.api.inspectCorruptIdentity(app, keyId);
            db.state[failure] = true;
            await expect(c.api.repairIdentity(token, () => true)).rejects.toThrow();
            expect(db.data.get(app + '/' + keyId)).toEqual({ corrupt: true });
        }
    });
    it('crypto មិនឆ្លើយ ឬម្ចាស់ប្តូរមិនអាចប្តូរកូនសោល្អដោយ token ចាស់', async () => {
        const db = transactionalDatabase(), c = client(db);
        db.data.set(app + '/' + keyId, { corrupt: true });
        const token = await c.api.inspectCorruptIdentity(app, keyId);
        const identity = await c.api.repairIdentity(await c.api.inspectCorruptIdentity(app, keyId), () => true);
        await expect(c.api.repairIdentity(token, () => true)).rejects.toThrow('identity-healthy');
        expect((await c.api.loadIdentity(app, keyId)).publicKey).toEqual(identity.publicKey);
        const failingCrypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto), subtle: new Proxy(webcrypto.subtle, {
            get(target, property) {
                if (property === 'sign') return async () => { throw Error('crypto-unavailable'); };
                const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
            }
        }) };
        await expect(client(db, failingCrypto).api.inspectCorruptIdentity(app, keyId)).rejects.toThrow('crypto-unavailable');
        expect((await c.api.loadIdentity(app, keyId)).publicKey).toEqual(identity.publicKey);
    });
    it('crypto យឺតក្នុង transaction ត្រូវបញ្ចប់ក្នុងកំណត់ ហើយលទ្ធផលយឺតមិនប្តូរកូនសោ', async () => {
        const db = transactionalDatabase(), originalClient = client(db);
        const identity = await originalClient.api.createIdentity(app, keyId);
        let release!: () => void;
        let entered!: () => void;
        const enteredCrypto = new Promise<void>(resolve => { entered = resolve; });
        const gate = new Promise<void>(resolve => { release = resolve; });
        const cryptoProvider = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto), subtle: new Proxy(webcrypto.subtle, {
            get(target, property) {
                if (property === 'sign') return async (...args: any[]) => { entered(); await gate; return (target.sign as any).apply(target, args); };
                const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
            }
        }) };
        const c = client(db, cryptoProvider);
        db.data.set(app + '/' + keyId, { corrupt: true });
        const token = await c.api.inspectCorruptIdentity(app, keyId);
        db.data.set(app + '/' + keyId, identity);
        const pending = expect(c.api.repairIdentity(token, () => true)).rejects.toThrow('identity-storage-timeout');
        await enteredCrypto; await pending; release();
        expect((await originalClient.api.loadIdentity(app, keyId)).publicKey).toEqual(identity.publicKey);
    }, 10000);
    it('ម្ចាស់ប្តូរក្នុង transaction បោះបង់មុន put ទោះ crypto មិនទាន់ឆ្លើយ', async () => {
        const db = transactionalDatabase(), originalClient = client(db);
        const identity = await originalClient.api.createIdentity(app, keyId);
        const other = await originalClient.api.createIdentity(app, 'OTHERKEY1234567890');
        db.data.set(app + '/' + keyId, { ...identity, publicKey: other.publicKey });
        let release!: () => void, entered!: () => void, current = true;
        const enteredCrypto = new Promise<void>(resolve => { entered = resolve; });
        const gate = new Promise<void>(resolve => { release = resolve; });
        const cryptoProvider = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto), subtle: new Proxy(webcrypto.subtle, {
            get(target, property) {
                if (property === 'sign') return async (...args: any[]) => { entered(); await gate; return (target.sign as any).apply(target, args); };
                const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
            }
        }) };
        const token = await originalClient.api.inspectCorruptIdentity(app, keyId);
        const c = client(db, cryptoProvider);
        db.data.set(app + '/' + keyId, { corrupt: true });
        const ownedToken = await c.api.inspectCorruptIdentity(app, keyId);
        db.data.set(app + '/' + keyId, { ...identity, publicKey: other.publicKey });
        const pending = expect(c.api.repairIdentity(ownedToken, () => current)).rejects.toThrow('identity-repair-stale');
        await enteredCrypto; current = false; await pending; release();
        expect(db.data.get(app + '/' + keyId).publicKey).toEqual(other.publicKey);
        expect(token).toMatchObject({ app, keyId });
    });
    it('public key ខូចដែលផ្ទៀងផ្ទាត់បានច្បាស់អាចជួសជុលបាន', async () => {
        for (const publicKey of [null, { kty: 'EC', crv: 'P-256', x: 'broken', y: 'broken' }]) {
            const db = transactionalDatabase(), c = client(db);
            const identity = await c.api.createIdentity(app, keyId);
            db.data.set(app + '/' + keyId, { ...identity, publicKey });
            const repaired = await c.api.repairIdentity(await c.api.inspectCorruptIdentity(app, keyId), () => true);
            expect(repaired.publicKey).not.toEqual(identity.publicKey);
            expect((await c.api.loadIdentity(app, keyId)).publicKey).toEqual(repaired.publicKey);
        }
    });
    it('helper ទាំងពីរមាន bytes ដូចគ្នា', () => {
        expect(readFileSync('public/license-seat-client.js', 'utf8')).toBe(readFileSync('../ZoeKeyGen/license-seat-client.js', 'utf8'));
    });
});


describe('ការចុះហត្ថលេខាសំណើអញ្ជើញ', () => {
    it('ចងសំណើទៅលេខអញ្ជើញ ប្រភេទ App និង identity ដើម', async () => {
        const c = client(); const app = 'ZOE'; const keyId = 'ABCDEFGHIJKLMNOP'; const inviteId = keyId + '.0123456789ABCDEF';
        await c.api.createIdentity(app, keyId);
        const enrollment = await c.api.invitationEnrollmentRequest(app, keyId, inviteId, 'apk');
        const payload = JSON.parse(Buffer.from(enrollment.payload, 'base64url').toString());
        expect(payload).toMatchObject({ domain: 'zoe-license-enrollment-v1', app, keyId, inviteId, target: 'apk' });
        const command = { domain: 'zoe-license-invitation-v1', audience: 'https://zoew.netlify.app', app, keyId, inviteId, action: 'submit', expiresAt: Date.now() + 45000, enrollment };
        const signed = await c.api.signInvitationCommand(app, keyId, command);
        const decoded = JSON.parse(Buffer.from(signed.payload, 'base64url').toString());
        expect(decoded.publicKey).toEqual(payload.publicKey);
        await expect(c.api.signCommand(app, keyId, command)).rejects.toThrow();
        await expect(c.api.signInvitationCommand(app, keyId, { ...command, action: 'approve' })).rejects.toThrow();
        await expect(c.api.invitationEnrollmentRequest(app, keyId, inviteId, 'browser')).rejects.toThrow();
    });
});
