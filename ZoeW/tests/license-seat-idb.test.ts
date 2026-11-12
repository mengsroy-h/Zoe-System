// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

let browser: Browser;
const origin = 'http://127.0.0.1:38136/';
const keyId = 'BROWSERLICENSE123456789';
const helper = readFileSync('public/license-seat-client.js', 'utf8');
const verifier = readFileSync('public/license-verify.js', 'utf8');
beforeAll(async () => {
    browser = await chromium.launch({ executablePath: process.env.ZOEW_TEST_BROWSER || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
}, 30000);
afterAll(async () => { await browser?.close(); });
async function load(page: Page) {
    await page.route('**/*', route => route.request().url().startsWith(origin)
        ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>License identity test</title>' }) : route.abort());
    await page.goto(origin);
    await page.addScriptTag({ content: helper });
}
async function sign(key: webcrypto.CryptoKey, body: unknown) {
    const payload = Buffer.from(JSON.stringify(body)).toString('base64url');
    return { payload, signature: Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(payload))).toString('base64url') };
}

it('IndexedDB ពិត៖ reload រក្សា private key ដែលមិនអាច export និង tab ពីរទទួលម្ចាស់តែមួយ', async () => {
    const context = await browser.newContext();
    try {
        let arrivals = 0;
        let release!: () => void;
        const bothReady = new Promise<void>(resolve => { release = resolve; });
        await context.exposeBinding('seatCreationReady', async () => { if (++arrivals === 2) release(); await bothReady; });
        const first = await context.newPage(), second = await context.newPage();
        await Promise.all([load(first), load(second)]);
        const create = (page: Page) => page.evaluate(async id => {
            const api = (window as any).ZoeSeatClient;
            const nativeGenerate = crypto.subtle.generateKey;
            const nativeAdd = IDBObjectStore.prototype.add;
            let adds = 0, duplicates = 0;
            (crypto.subtle as any).generateKey = async (...args: any[]) => {
                await (window as any).seatCreationReady();
                return (nativeGenerate as any).apply(crypto.subtle, args);
            };
            IDBObjectStore.prototype.add = function (...args: Parameters<typeof nativeAdd>) {
                adds++;
                const request = nativeAdd.apply(this, args);
                request.addEventListener('error', () => { if (request.error?.name === 'ConstraintError') duplicates++; });
                return request;
            };
            try {
                const identity = await api.createIdentity('ZOE', id);
                return { fingerprint: await api.fingerprint(identity.publicKey), extractable: identity.privateKey.extractable, adds, duplicates };
            } finally { crypto.subtle.generateKey = nativeGenerate; IDBObjectStore.prototype.add = nativeAdd; }
        }, keyId);
        const [a, b] = await Promise.all([create(first), create(second)]);
        expect(arrivals).toBe(2); expect(a.fingerprint).toBe(b.fingerprint);
        expect([a.extractable, b.extractable]).toEqual([false, false]);
        expect(a.adds + b.adds).toBe(2); expect(a.duplicates + b.duplicates).toBe(1);
        await first.reload(); await first.addScriptTag({ content: helper });
        const restored = await first.evaluate(async id => {
            const api = (window as any).ZoeSeatClient;
            const identity = await api.loadIdentity('ZOE', id);
            let exported = false;
            try { await crypto.subtle.exportKey('jwk', identity.privateKey); exported = true; } catch {}
            const command = { domain: 'zoe-license-seat-stage-v1', audience: 'https://zoew.netlify.app', app: 'ZOE', keyId: id, action: 'device-state', revision: 0, expiresAt: Date.now() + 30000 };
            const proof = await api.signCommand('ZOE', id, command);
            const pub = await crypto.subtle.importKey('jwk', identity.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
            const sig = Uint8Array.from(atob(proof.signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
            const verified = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, sig, new TextEncoder().encode(proof.payload));
            return { fingerprint: await api.fingerprint(identity.publicKey), extractable: identity.privateKey.extractable, exported, verified };
        }, keyId);
        expect(restored).toEqual({ fingerprint: a.fingerprint, extractable: false, exported: false, verified: true });
    } finally { await context.close(); }
}, 30000);

it('IndexedDB ពិត៖ copied receipt មិនផ្តល់សិទ្ធិក្រោយលុប private key ឬនៅ browser ផ្សេង', async () => {
    const ownerContext = await browser.newContext(), copiedContext = await browser.newContext();
    try {
        const owner = await ownerContext.newPage(), copied = await copiedContext.newPage();
        await Promise.all([load(owner), load(copied)]);
        const fingerprint = await owner.evaluate(async id => {
            const api = (window as any).ZoeSeatClient;
            const identity = await api.createIdentity('ZOE', id);
            return api.fingerprint(identity.publicKey);
        }, keyId);
        const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
        const publicKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
        const now = Date.now(), until = now + 86400000;
        const license = await sign(pair.privateKey, { a: 'ZOE', id: keyId, iat: Math.floor(now / 1000), exp: Math.floor(until / 1000) });
        const receipt = await sign(pair.privateKey, { domain: 'zoe-license-seat-receipt-v1', audience: 'https://zoew.netlify.app', app: 'ZOE', keyId, fingerprint, releaseEpoch: 0, issuedAt: now, validUntil: until, licenseExpiresAt: until });
        const activation = { keyString: 'ZOEKEY-' + license.payload + '.' + license.signature, id: keyId, exp: Math.floor(until / 1000), activatedAt: now, lastOnlineCheck: now, onlineExp: until, seenMax: now, seatProtocol: 2, seatReceipt: receipt, releaseEpoch: 0 };
        const source = verifier.replace(/const PUBLIC_KEYS_JWK = \[[\s\S]*?\];/, 'const PUBLIC_KEYS_JWK = [' + JSON.stringify(publicKey) + '];');
        expect(source).not.toBe(verifier);
        for (const page of [owner, copied]) {
            await page.evaluate(({ publicKey, activation }) => {
                (window as any).ZoeSeatConfig = { audience: 'https://zoew.netlify.app', legacyProtocolEnabled: false, receiptPublicKeys: [publicKey] };
                localStorage.setItem('zoe_license_activation_ZOE', JSON.stringify(activation));
            }, { publicKey, activation });
            await page.addScriptTag({ content: source });
            await page.evaluate(() => (window as any).ZoeLicense.setServerTimeOffset(0));
        }
        const status = (page: Page) => page.evaluate(async () => (await (window as any).ZoeLicense.getStatus('ZOE')).state);
        expect(await status(owner)).toBe('active');
        expect(await status(copied)).not.toBe('active');
        await corrupt(owner);
        await owner.evaluate(async id => {
            const api = (window as any).ZoeSeatClient;
            await api.repairIdentity(await api.inspectCorruptIdentity('ZOE', id), () => true);
        }, keyId);
        expect(await status(owner)).not.toBe('active');
        const removed = await owner.evaluate(async id => {
            await new Promise<void>((resolve, reject) => {
                const request = indexedDB.deleteDatabase('zoe-license-seat-identities-v1');
                request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
                request.onblocked = () => reject(new Error('Identity database unexpectedly held open'));
            });
            const api = (window as any).ZoeSeatClient;
            let signed = false;
            try { await api.signCommand('ZOE', id, { domain: 'zoe-license-seat-stage-v1', audience: 'https://zoew.netlify.app', app: 'ZOE', keyId: id, action: 'device-state', revision: 0, expiresAt: Date.now() + 30000 }); signed = true; } catch {}
            return { missing: await api.loadIdentity('ZOE', id) === null, signed };
        }, keyId);
        expect(removed).toEqual({ missing: true, signed: false });
        expect(await status(owner)).not.toBe('active');
        await copied.evaluate(async id => { await (window as any).ZoeSeatClient.createIdentity('ZOE', id); }, keyId);
        expect(await status(copied)).not.toBe('active');
    } finally { await ownerContext.close(); await copiedContext.close(); }
}, 30000);

async function corrupt(page: Page, id = keyId) {
    await page.evaluate(async id => {
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.open('zoe-license-seat-identities-v1', 1);
            request.onsuccess = () => {
                const db = request.result, tx = db.transaction('identities', 'readwrite');
                tx.objectStore('identities').put({ corrupt: true }, 'ZOE/' + id);
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onabort = () => { db.close(); reject(tx.error); };
            };
            request.onerror = () => reject(request.error);
        });
    }, id);
}

it('ជួសជុលកូនសោខូចតែមួយដោយមិនប្តូរកូនសោល្អ ឬទិន្នន័យផ្សេង និងត្រូវការសិទ្ធិម្ចាស់បច្ចុប្បន្ន', async () => {
    const context = await browser.newContext();
    try {
        const page = await context.newPage(); await load(page);
        await page.evaluate(async id => { await (window as any).ZoeSeatClient.createIdentity('ZOE', id); }, keyId);
        await corrupt(page);
        const result = await page.evaluate(async id => {
            const api = (window as any).ZoeSeatClient;
            const otherId = 'OTHERKEY1234567890';
            const other = await api.createIdentity('ZOE', otherId);
            localStorage.setItem('pending-business-journal', 'preserve');
            const rejects = async (fn: () => Promise<any>) => { try { await fn(); return false; } catch { return true; } };
            const invalidToken = await rejects(() => api.repairIdentity({ app: 'ZOE', keyId: id }, () => true));
            const token = await api.inspectCorruptIdentity('ZOE', id);
            const cancelled = await rejects(() => api.repairIdentity(token, () => false));
            const stillCorrupt = await rejects(() => api.loadIdentity('ZOE', id));
            const repaired = await api.repairIdentity(await api.inspectCorruptIdentity('ZOE', id), () => true);
            const healthyRefused = await rejects(() => api.inspectCorruptIdentity('ZOE', id));
            const proof = await api.enrollmentRequest('ZOE', id);
            return { invalidToken, cancelled, stillCorrupt, healthyRefused,
                fingerprint: await api.fingerprint(repaired.publicKey), proof: proof.fingerprint,
                other: JSON.stringify(other.publicKey) === JSON.stringify((await api.loadIdentity('ZOE', otherId)).publicKey),
                journal: localStorage.getItem('pending-business-journal'), extractable: repaired.privateKey.extractable };
        }, keyId);
        expect(result).toMatchObject({ invalidToken: true, cancelled: true, stillCorrupt: true, healthyRefused: true, other: true, journal: 'preserve', extractable: false });
        expect(result.fingerprint).toBe(result.proof);
    } finally { await context.close(); }
}, 30000);

it('ការជួសជុលពីរទំព័រមិនប្តូរកូនសោអ្នកឈ្នះ និងការប្តូរម្ចាស់ក្រោយ await បោះបង់ transaction', async () => {
    const context = await browser.newContext();
    try {
        const first = await context.newPage(), second = await context.newPage();
        await Promise.all([load(first), load(second)]);
        await first.evaluate(async id => { await (window as any).ZoeSeatClient.createIdentity('ZOE', id); }, keyId);
        await corrupt(first);
        for (const page of [first, second]) await page.evaluate(async id => { (window as any).repairToken = await (window as any).ZoeSeatClient.inspectCorruptIdentity('ZOE', id); }, keyId);
        const repair = (page: Page) => page.evaluate(async () => {
            const api = (window as any).ZoeSeatClient;
            try { return { fingerprint: await api.fingerprint((await api.repairIdentity((window as any).repairToken, () => true)).publicKey) }; }
            catch (error) { return { error: String(error) }; }
        });
        const results = await Promise.all([repair(first), repair(second)]);
        expect(results.filter(r => r.fingerprint)).toHaveLength(1);
        expect(results.filter(r => r.error)).toHaveLength(1);
        const winner = results.find(r => r.fingerprint)!.fingerprint;
        expect(await first.evaluate(async id => { const api = (window as any).ZoeSeatClient; return api.fingerprint((await api.loadIdentity('ZOE', id)).publicKey); }, keyId)).toBe(winner);
        await corrupt(first);
        expect(await first.evaluate(async id => {
            const api = (window as any).ZoeSeatClient, token = await api.inspectCorruptIdentity('ZOE', id);
            const native = crypto.subtle.generateKey; let current = true;
            (crypto.subtle as any).generateKey = async (...args: any[]) => { const pair = await (native as any).apply(crypto.subtle, args); current = false; return pair; };
            try { await api.repairIdentity(token, () => current); return false; } catch { return true; }
            finally { crypto.subtle.generateKey = native; }
        }, keyId)).toBe(true);
        expect(await first.evaluate(async id => { try { await (window as any).ZoeSeatClient.loadIdentity('ZOE', id); return false; } catch { return true; } }, keyId)).toBe(true);
    } finally { await context.close(); }
}, 30000);


it('ការផ្ទុក ឬ crypto មិនអាចផ្ទៀងផ្ទាត់មិនអនុញ្ញាតជួសជុល ហើយ token ចាស់មិនប្តូរកូនសោល្អ', async () => {
    const context = await browser.newContext();
    try {
        const page = await context.newPage(); await load(page);
        await page.evaluate(async id => { await (window as any).ZoeSeatClient.createIdentity('ZOE', id); }, keyId);
        expect(await page.evaluate(async id => {
            const api = (window as any).ZoeSeatClient, original = await api.loadIdentity('ZOE', id);
            const native = crypto.subtle.sign;
            (crypto.subtle as any).sign = async () => { throw new DOMException('unavailable', 'OperationError'); };
            let refused = false;
            try { await api.inspectCorruptIdentity('ZOE', id); } catch { refused = true; }
            finally { crypto.subtle.sign = native; }
            return refused && JSON.stringify(original.publicKey) === JSON.stringify((await api.loadIdentity('ZOE', id)).publicKey);
        }, keyId)).toBe(true);
        await corrupt(page);
        expect(await page.evaluate(async id => {
            const api = (window as any).ZoeSeatClient;
            const stale = await api.inspectCorruptIdentity('ZOE', id);
            const fresh = await api.repairIdentity(await api.inspectCorruptIdentity('ZOE', id), () => true);
            let refused = false;
            try { await api.repairIdentity(stale, () => true); } catch { refused = true; }
            return refused && JSON.stringify(fresh.publicKey) === JSON.stringify((await api.loadIdentity('ZOE', id)).publicKey);
        }, keyId)).toBe(true);
        await corrupt(page);
        expect(await page.evaluate(async id => {
            const api = (window as any).ZoeSeatClient, token = await api.inspectCorruptIdentity('ZOE', id);
            const native = IDBDatabase.prototype.transaction;
            IDBDatabase.prototype.transaction = function (...args: Parameters<typeof native>) {
                if (args[1] === 'readwrite') throw new DOMException('unavailable', 'UnknownError');
                return native.apply(this, args);
            };
            let refused = false;
            try { await api.repairIdentity(token, () => true); } catch { refused = true; }
            finally { IDBDatabase.prototype.transaction = native; }
            let corrupt = false;
            try { await api.loadIdentity('ZOE', id); } catch { corrupt = true; }
            return refused && corrupt;
        }, keyId)).toBe(true);
    } finally { await context.close(); }
}, 30000);
