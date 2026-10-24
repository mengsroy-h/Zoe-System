import { PALM_SIGN_OUTBOX_DB_NAME } from '../core/storage-keys';

export type SignJob = {
    code: string; itemId: string; requestId: string; signMan: string; photo: string; dispatchProof: string;
    signature: string; parcelIdentity: string; confirmationToken?: string; warningToken?: string; autoConfirm?: boolean; message: string;
    phase: 'queued' | 'checking' | 'confirmed' | 'action'; attempts: number;
};
export type SignEnvelope = { id: string; owner: string; revision: number; leaseUntil: number; due: number; iv: Uint8Array<ArrayBuffer>; cipher: ArrayBuffer };
export type StoredSignJob = { row: SignEnvelope; job: SignJob };
const STORE = 'jobs';
export const SIGN_OUTBOX_MAX = 40;
export const SIGN_OUTBOX_LEASE_MS = 90000;
const DEADLINE_MS = 5000;

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let db: IDBDatabase;
        let tx: IDBTransaction;
        let done = false;
        let value: T;
        const finish = (error?: unknown) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (error) { try { tx?.abort(); } catch {} }
            db?.close();
            if (error) reject(error); else resolve(value);
        };
        const timer = setTimeout(() => finish(new Error('outbox:timeout')), DEADLINE_MS);
        try {
            const req = indexedDB.open(PALM_SIGN_OUTBOX_DB_NAME, 1);
            req.onupgradeneeded = () => {
                const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
                store.createIndex('owner', 'owner');
            };
            req.onerror = () => finish(req.error || new Error('outbox:open'));
            req.onblocked = () => finish(new Error('outbox:blocked'));
            req.onsuccess = () => {
                db = req.result;
                if (done) { db.close(); return; }
                try {
                    tx = db.transaction(STORE, mode, mode === 'readwrite' ? { durability: 'strict' } : undefined);
                    tx.oncomplete = () => finish();
                    tx.onabort = () => finish(tx.error || new Error('outbox:aborted'));
                    tx.onerror = () => finish(tx.error || new Error('outbox:write'));
                    action(tx.objectStore(STORE), (next) => { value = next; });
                } catch (error) { finish(error); }
            };
        } catch (error) { finish(error); }
    });
}

export async function sealSignJob(owner: string, key: CryptoKey, job: SignJob): Promise<SignEnvelope> {
    const bytes = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', bytes.encode(owner + '\n' + job.code.toUpperCase()));
    const id = Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, '0')).join('');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: bytes.encode(owner + '\n' + id) }, key, bytes.encode(JSON.stringify(job)));
    return { id, owner, iv, cipher, revision: 1, leaseUntil: 0, due: 0 };
}

export async function openSignJob(row: SignEnvelope, key: CryptoKey): Promise<SignJob> {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: row.iv, additionalData: new TextEncoder().encode(row.owner + '\n' + row.id) }, key, row.cipher);
    const job = JSON.parse(new TextDecoder().decode(plain));
    if (!job || !['queued', 'checking', 'confirmed', 'action'].includes(job.phase) || !job.code || !job.itemId || !job.requestId
        || !job.photo || typeof job.signature !== 'string' || typeof job.parcelIdentity !== 'string' || !Number.isFinite(job.attempts)
        || job.autoConfirm !== undefined && typeof job.autoConfirm !== 'boolean') throw new Error('outbox:shape');
    return job;
}

export function listSignJobs(owner: string): Promise<SignEnvelope[]> {
    return transact('readonly', (store, result) => {
        const request = store.index('owner').getAll(owner);
        request.onsuccess = () => result(request.result);
    });
}

export function addSignJob(row: SignEnvelope, current: () => boolean): Promise<boolean> {
    return transact('readwrite', (store, result) => {
        const count = store.index('owner').count(row.owner);
        count.onsuccess = () => {
            if (!current() || count.result >= SIGN_OUTBOX_MAX) { store.transaction.abort(); return; }
            const request = store.get(row.id);
            request.onsuccess = () => {
                if (!current()) { store.transaction.abort(); return; }
                if (request.result) { result(false); return; }
                store.add(row);
                result(true);
            };
        };
    });
}

export function replaceSignJob(previous: SignEnvelope, next: SignEnvelope | null, current: () => boolean): Promise<boolean> {
    return transact('readwrite', (store, result) => {
        const request = store.get(previous.id);
        request.onsuccess = () => {
            const row = request.result as SignEnvelope | undefined;
            if (!current() || !row || row.owner !== previous.owner || row.revision !== previous.revision) { result(false); return; }
            if (next) store.put({ ...next, id: row.id, owner: row.owner, revision: row.revision + 1 });
            else store.delete(row.id);
            result(true);
        };
    });
}
