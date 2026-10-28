// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { addSignJob, listSignJobs, openSignJob, replaceSignJob, sealSignJob, SIGN_OUTBOX_MAX, type SignEnvelope, type SignJob } from '../src/services/palm-sign-outbox-store';

// គំរូ transaction នេះដំណើរការ API រក្សាទុកពិត ដោយមិនបើក browser។
// វាមិនជំនួសតេស្ត IndexedDB ពិតក្នុង CI ទេ។
function database() {
    const committed = new Map<string, SignEnvelope>();
    let quota = false;
    const indexedDB = { open: () => {
        const request: any = {};
        queueMicrotask(() => {
            request.result = { close: () => {}, transaction: () => {
                const pending = new Map(structuredClone([...committed]));
                let aborted = false;
                let timer: ReturnType<typeof setTimeout>;
                const tx: any = { abort: () => {
                    if (aborted) return;
                    aborted = true; clearTimeout(timer); queueMicrotask(() => tx.onabort?.());
                } };
                const op = (read: () => unknown) => {
                    const result: any = {};
                    clearTimeout(timer);
                    queueMicrotask(() => {
                        if (aborted) return;
                        try { result.result = read(); result.onsuccess?.(); }
                        catch (error) { tx.error = error; tx.abort(); }
                        if (!aborted) timer = setTimeout(() => {
                            committed.clear(); for (const [id, value] of pending) committed.set(id, structuredClone(value));
                            tx.oncomplete?.();
                        }, 0);
                    });
                    return result;
                };
                const write = (row: SignEnvelope) => {
                    if (quota) throw new Error('QuotaExceededError');
                    pending.set(row.id, structuredClone(row));
                };
                tx.objectStore = () => ({ transaction: tx,
                    index: () => ({ count: (owner: string) => op(() => [...pending.values()].filter((row) => row.owner === owner).length),
                        getAll: (owner: string) => op(() => structuredClone([...pending.values()].filter((row) => row.owner === owner))) }),
                    get: (id: string) => op(() => structuredClone(pending.get(id))),
                    add: (row: SignEnvelope) => op(() => { if (pending.has(row.id)) throw new Error('ConstraintError'); write(row); }),
                    put: (row: SignEnvelope) => op(() => write(row)),
                    delete: (id: string) => op(() => pending.delete(id))
                });
                return tx;
            } };
            request.onsuccess?.();
        });
        return request;
    } };
    return { indexedDB, committed, setQuota: (value: boolean) => { quota = value; } };
}
let db: ReturnType<typeof database>;
let key: CryptoKey;
const owner = 'synthetic-shop/synthetic-user';
async function envelope(n: number) {
    const job: SignJob = { code: '7713050000' + String(n).padStart(4, '0'), itemId: 'item', requestId: crypto.randomUUID(),
        signMan: 'សុខា', photo: '/9j/AAECAwQF/9k=', dispatchProof: 'proof', signature: 'config', parcelIdentity: 'original', reservationProtocol: 'original-reservation-v1', originalFingerprint: 'f'.repeat(64), originalSHA256: 'e'.repeat(64),
        phase: 'queued', attempts: 0, message: '' };
    return sealSignJob(owner, key, job);
}
beforeEach(async () => {
    db = database(); vi.stubGlobal('indexedDB', db.indexedDB); vi.stubGlobal('crypto', webcrypto);
    key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as CryptoKey;
});
afterEach(() => { vi.unstubAllGlobals(); });
it('៤០ ការងារ៖ ការងារថ្មីបរាជ័យដោយមិនលុប ciphertext ឬរូបដើមចាស់', async () => {
    for (let n = 0; n < SIGN_OUTBOX_MAX; n++) expect(await addSignJob(await envelope(n), () => true)).toBe(true);
    const before = structuredClone([...db.committed]);
    await expect(addSignJob(await envelope(SIGN_OUTBOX_MAX), () => true)).rejects.toThrow();
    expect([...db.committed]).toEqual(before);
    expect(await listSignJobs(owner)).toHaveLength(40);
    expect((await Promise.all((await listSignJobs(owner)).map((row) => openSignJob(row, key)))).every((job) => job.photo === '/9j/AAECAwQF/9k=')).toBe(true);
});
it('quota បរាជ័យ៖ មិនសន្មតថា commit ហើយរូបដែលរក្សាទុករួចមិនប្រែ', async () => {
    expect(await addSignJob(await envelope(1), () => true)).toBe(true);
    const before = structuredClone([...db.committed]); db.setQuota(true);
    await expect(addSignJob(await envelope(2), () => true)).rejects.toThrow('QuotaExceededError');
    expect([...db.committed]).toEqual(before);
});
it('អានឡើងវិញ៖ រូបអ៊ិនគ្រីបនៅដដែល ហើយ CAS ចាស់/ម្ចាស់ចាស់មិនលុប', async () => {
    const row = await envelope(1); await addSignJob(row, () => true);
    const restored = (await listSignJobs(owner))[0];
    expect(await openSignJob(restored, key)).toMatchObject({ photo: '/9j/AAECAwQF/9k=' });
    expect(JSON.stringify(restored)).not.toContain('/9j/AAECAwQF/9k=');
    expect(await replaceSignJob(restored, { ...restored, due: 100 }, () => true)).toBe(true);
    expect(await replaceSignJob(restored, null, () => true)).toBe(false);
    const latest = (await listSignJobs(owner))[0];
    expect(await replaceSignJob(latest, null, () => false)).toBe(false);
    expect(await replaceSignJob({ ...latest, owner: 'foreign' }, null, () => true)).toBe(false);
    expect(await listSignJobs(owner)).toHaveLength(1);
    expect(await replaceSignJob(latest, null, () => true)).toBe(true);
    expect(await listSignJobs(owner)).toHaveLength(0);
});
it('CAS ABA៖ ការងារ barcode ដដែលបង្កើតថ្មី មិនអាចត្រូវលុបដោយ proof របស់ការងារចាស់', async () => {
    const first = await envelope(1); await addSignJob(first, () => true);
    await replaceSignJob(first, { ...first, due: 1 }, () => true);
    const old = (await listSignJobs(owner))[0];
    const originalOld = await openSignJob(old, key);
    expect(old.revision).toBe(2);
    expect(await replaceSignJob(old, null, () => true)).toBe(true);
    const second = await sealSignJob(owner, key, { ...originalOld, requestId: crypto.randomUUID(), photo: '/9j/AAECAwQG/9k=' });
    expect(second.id).toBe(old.id);
    await addSignJob(second, () => true);
    await replaceSignJob(second, { ...second, due: 2 }, () => true);
    const fresh = (await listSignJobs(owner))[0];
    expect(fresh.revision).toBe(old.revision);
    expect((await openSignJob(fresh, key)).requestId).not.toBe(originalOld.requestId);
    expect(await replaceSignJob(old, null, () => true)).toBe(false);
    expect(await replaceSignJob(old, { ...old, due: 3 }, () => true)).toBe(false);
    const kept = (await listSignJobs(owner))[0];
    expect(kept).toEqual(fresh);
    expect(await openSignJob(kept, key)).toMatchObject({ photo: '/9j/AAECAwQG/9k=' });
    expect(await replaceSignJob(fresh, null, () => true)).toBe(true);
});
it.each(['iv', 'cipher'] as const)('CAS ពិនិត្យ snapshot %s ទាំងមូល មិនត្រឹមតែលេខ revision', async field => {
    const row = await envelope(1); await addSignJob(row, () => true);
    const altered = structuredClone(db.committed.get(row.id)!);
    if (field === 'iv') altered.iv[0] ^= 1;
    else new Uint8Array(altered.cipher)[0] ^= 1;
    db.committed.set(row.id, altered);
    expect(await replaceSignJob(row, null, () => true)).toBe(false);
    expect((await listSignJobs(owner))[0]).toEqual(altered);
});
