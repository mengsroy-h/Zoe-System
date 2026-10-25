// @vitest-environment node
import { beforeAll, afterAll, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { build } from 'esbuild';
import path from 'node:path';
let browser: Browser;
let bundle = '';
beforeAll(async () => {
    const built = await build({ entryPoints: [path.resolve('src/services/palm-sign-outbox-store.ts')], bundle: true, write: false, format: 'iife', globalName: 'outbox' });
    bundle = built.outputFiles[0].text;
    browser = await chromium.launch({ executablePath: process.env.ZOEW_TEST_BROWSER || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
}, 30000);
afterAll(async () => { await browser?.close(); });
async function load(page: Page) {
    await page.route('http://127.0.0.1:38131/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Sign outbox</title>' }));
    await page.goto('http://127.0.0.1:38131/');
    await page.addScriptTag({ content: bundle });
}
it('IndexedDB ពិត ៖ commit មុន ACK · encrypt រូប · reload · CAS ពីរ tab · abort មិនបានសន្មតថារក្សាទុក', async () => {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    try {
        await load(page);
        const first = await page.evaluate(async () => {
            const w = window as any; const api = w.outbox;
            const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
            const db = await new Promise<IDBDatabase>((resolve) => {
                const req = indexedDB.open('synthetic-test-key', 1); req.onupgradeneeded = () => req.result.createObjectStore('keys'); req.onsuccess = () => resolve(req.result);
            });
            await new Promise<void>((resolve) => { const tx = db.transaction('keys', 'readwrite'); tx.objectStore('keys').put(key, 'key'); tx.oncomplete = () => resolve(); }); db.close();
            const job = (n: number) => ({ code: '7713050000001' + n, itemId: 'same-phone-item', requestId: crypto.randomUUID(), signMan: 'សុខា', photo: 'distinct-photo-' + n, dispatchProof: 'proof', signature: 'config', parcelIdentity: 'original', phase: 'queued', attempts: 0, message: 'pending' });
            const added = [];
            for (let i = 0; i < 3; i++) added.push(await api.addSignJob(await api.sealSignJob('shop-a/user-a', key, job(i)), () => true));
            const rows = await api.listSignJobs('shop-a/user-a');
            const foreign = await api.listSignJobs('shop-b/user-a');
            const wrongKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
            let refused = false; try { await api.openSignJob(rows[0], wrongKey); } catch { refused = true; }
            const plain = await Promise.all(rows.map((r: any) => api.openSignJob(r, key)));
            const replay = await api.addSignJob(await api.sealSignJob('shop-a/user-a', key, { ...plain[0], photo: 'wrong replacement' }), () => true);
            return { added, count: rows.length, foreign: foreign.length, refused, replay, photos: plain.map((j: any) => j.photo).sort(), plaintext: JSON.stringify(rows).includes('distinct-photo') };
        });
        expect(first).toEqual({ added: [true, true, true], count: 3, foreign: 0, refused: true, replay: false, photos: ['distinct-photo-0', 'distinct-photo-1', 'distinct-photo-2'], plaintext: false });
        await page.reload(); await page.addScriptTag({ content: bundle });
        const restored = await page.evaluate(async () => {
            const api = (window as any).outbox;
            const db = await new Promise<IDBDatabase>((resolve) => { const req = indexedDB.open('synthetic-test-key', 1); req.onsuccess = () => resolve(req.result); });
            const key = await new Promise<CryptoKey>((resolve) => { const r = db.transaction('keys').objectStore('keys').get('key'); r.onsuccess = () => resolve(r.result); }); db.close();
            const rows = await api.listSignJobs('shop-a/user-a');
            return (await Promise.all(rows.map((r: any) => api.openSignJob(r, key)))).map((j: any) => [j.code, j.photo]).sort();
        });
        expect(restored).toEqual([0, 1, 2].map((n) => ['7713050000001' + n, 'distinct-photo-' + n]));
        const other = await ctx.newPage(); await load(other);
        const rowId = await page.evaluate(async () => (await (window as any).outbox.listSignJobs('shop-a/user-a'))[0].id);
        const claim = (p: Page) => p.evaluate(async (id) => {
            const api = (window as any).outbox;
            const row = (await api.listSignJobs('shop-a/user-a')).find((r: any) => r.id === id);
            return api.replaceSignJob({ ...row, revision: 1 }, { ...row, leaseUntil: Date.now() + 90000 }, () => true);
        }, rowId);
        expect((await Promise.all([claim(page), claim(other)])).sort()).toEqual([false, true]);
        const aborted = await page.evaluate(async () => {
            const api = (window as any).outbox; const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
            const row = await api.sealSignJob('abort-owner', key, { code: '77130500000999', itemId: 'item', requestId: crypto.randomUUID(), signMan: 'name', photo: 'photo', dispatchProof: '', signature: 'cfg', phase: 'queued', attempts: 0, message: '' });
            const add = IDBObjectStore.prototype.add;
            IDBObjectStore.prototype.add = function (...args: any[]) {
                const request = add.apply(this, args as any); const tx = this.transaction;
                request.addEventListener('success', () => tx.abort()); return request;
            };
            let rejected = false;
            try { await api.addSignJob(row, () => true); } catch { rejected = true; }
            finally { IDBObjectStore.prototype.add = add; }
            return { rejected, rows: (await api.listSignJobs('abort-owner')).length };
        });
        expect(aborted).toEqual({ rejected: true, rows: 0 });
    } finally { await ctx.close(); }
}, 30000);

it('សង្គ្រោះ IndexedDB ពិត៖ បិទ browser/បើកវិញ រូបនិងអត្តសញ្ញាណនៅដដែល · barcode ដូចគ្នាលើឧបករណ៍ពីរមិនច្របល់', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises'); const { tmpdir } = await import('node:os');
    const profile = await mkdtemp(path.join(tmpdir(), 'zoe-recovery-profile-'));
    const options = { executablePath: process.env.ZOEW_TEST_BROWSER || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] };
    let ctx = await chromium.launchPersistentContext(profile, options);
    try {
        const page = await ctx.newPage(); await load(page);
        const first = await page.evaluate(async () => {
            const api = (window as any).outbox; const owner = 'recovery-shop/recovery-user';
            const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
            const db = await new Promise<IDBDatabase>(resolve => { const req = indexedDB.open('recovery-key', 1); req.onupgradeneeded = () => req.result.createObjectStore('keys'); req.onsuccess = () => resolve(req.result); });
            await new Promise<void>((resolve, reject) => { const tx = db.transaction('keys', 'readwrite', { durability: 'strict' }); tx.objectStore('keys').put(key, 'key'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
            const job = { code: '77130500000012', itemId: 'item', requestId: crypto.randomUUID(), signMan: 'សុខា', photo: 'device-one-original',
                dispatchProof: 'original-dispatch', reservationOwner: 'original-owner', reservationToken: 'original-token', signature: 'cfg', parcelIdentity: 'life-one', phase: 'queued', attempts: 2, message: 'សារដើម' };
            const row = await api.sealSignJob(owner, key, job); await api.addSignJob(row, () => true);
            const recovery = { archivedAt: Date.now(), previousPhase: job.phase, previousMessage: job.message, dismissed: true };
            const sealed = await api.sealSignJob(owner, key, { ...job, recovery, phase: 'action', message: 'រក្សារូបដើម', readOnlyProbe: true });
            if (!await api.replaceSignJob(row, sealed, () => true)) throw new Error('archive CAS failed');
            return { owner, id: row.id, job, recovery };
        });
        await ctx.close(); ctx = await chromium.launchPersistentContext(profile, options);
        const restoredPage = await ctx.newPage(); await load(restoredPage);
        const restored = await restoredPage.evaluate(async owner => {
            const api = (window as any).outbox;
            const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('recovery-key', 1); r.onsuccess = () => resolve(r.result); });
            const key = await new Promise<CryptoKey>(resolve => { const r = db.transaction('keys').objectStore('keys').get('key'); r.onsuccess = () => resolve(r.result); }); db.close();
            const rows = await api.listSignJobs(owner); const job = await api.openSignJob(rows[0], key);
            const duplicate = await api.sealSignJob(owner, key, { ...job, requestId: crypto.randomUUID(), photo: 'replacement' });
            return { count: rows.length, job, duplicateAdded: await api.addSignJob(duplicate, () => true), cleartext: JSON.stringify(rows).includes(job.photo), lease: rows[0].leaseUntil, due: rows[0].due };
        }, first.owner);
        expect(restored).toMatchObject({ count: 1, duplicateAdded: false, cleartext: false, lease: 0, due: 0,
            job: { ...first.job, phase: 'action', message: 'រក្សារូបដើម', recovery: first.recovery } });
        const other = await browser.newContext();
        try {
            const page = await other.newPage(); await load(page);
            const second = await page.evaluate(async ({ owner, job }) => {
                const api = (window as any).outbox; const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
                const previous = await api.listSignJobs(owner);
                const ownJob = { ...job, requestId: crypto.randomUUID(), photo: 'device-two-original' };
                const row = await api.sealSignJob(owner, key, ownJob); await api.addSignJob(row, () => true);
                return { previous: previous.length, id: row.id, job: await api.openSignJob((await api.listSignJobs(owner))[0], key) };
            }, first);
            expect(second.previous).toBe(0); expect(second.id).toBe(first.id); expect(second.job.requestId).not.toBe(first.job.requestId);
            expect(second.job.photo).toBe('device-two-original'); expect(restored.job.photo).toBe('device-one-original');
        } finally { await other.close(); }
    } finally { await ctx.close(); await rm(profile, { recursive: true, force: true }); }
}, 30000);
