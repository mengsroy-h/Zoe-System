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
        const first = await context.newPage(), second = await context.newPage();
        await Promise.all([load(first), load(second)]);
        const create = (page: Page) => page.evaluate(async id => {
            const api = (window as any).ZoeSeatClient;
            const identity = await api.createIdentity('ZOE', id);
            return { fingerprint: await api.fingerprint(identity.publicKey), extractable: identity.privateKey.extractable };
        }, keyId);
        const [a, b] = await Promise.all([create(first), create(second)]);
        expect(a).toEqual(b); expect(a.extractable).toBe(false);
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
        expect(restored).toEqual({ ...a, exported: false, verified: true });
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
