import { securityState } from '../core/state';
import { LOOKUP_KEY_DB_NAME } from '../core/storage-keys';
import { appLockShouldArm } from '../features/app-lock';

export async function hashPinLegacy(pin) {
    const enc = new TextEncoder().encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode('zoeadmin_pin_verify_v2'), iterations: 150000, hash: 'SHA-256' },
        keyMaterial,
        256
    );
    return 'pbkdf2:' + Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyStoredPin(enteredPin, savedHash) {
    if (!savedHash) return false;
    if (savedHash.startsWith('pbkdf2:')) return (await hashPin(enteredPin)) === savedHash;
    return (await hashPinLegacy(enteredPin)) === savedHash;
}

export async function deriveLookupSecretKey(pin) {
    try {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
        return await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: enc.encode('zoeadmin_lookup_api_secret_v1'), iterations: 150000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    } catch (e) {
        return null;
    }
}

export const LOOKUP_KEY_STORE = 'k';

export const LOOKUP_KEY_ID = 'lookupSecretKey';

export const LOOKUP_KEY_DB_TIMEOUT_MS = 3000;

export function lookupKeyDbFactory() {
    try {
        return window.indexedDB || null;
    } catch (e) {
        return null;
    }
}

export function lookupKeyDbDeadline(done) {
    try {
        setTimeout(() => done(null), LOOKUP_KEY_DB_TIMEOUT_MS);
        return true;
    } catch (e) {
        return false;
    }
}

export function openLookupKeyDb() {
    return new Promise((resolve) => {
        let settled = false;
        const done = (value) => { if (!settled) { settled = true; resolve(value); } };
        if (!lookupKeyDbDeadline(done)) { done(null); return; }
        try {
            const factory = lookupKeyDbFactory();
            if (!factory) { done(null); return; }
            const req = factory.open(LOOKUP_KEY_DB_NAME, 1);
            req.onupgradeneeded = () => {
                try {
                    const db = req.result;
                    if (db && !db.objectStoreNames.contains(LOOKUP_KEY_STORE)) db.createObjectStore(LOOKUP_KEY_STORE);
                } catch (e) { done(null); }
            };
            req.onsuccess = () => {
                if (settled) {
                    try { req.result.close(); } catch (e) { }
                    return;
                }
                done(req.result || null);
            };
            req.onerror = () => done(null);
            req.onblocked = () => done(null);
        } catch (e) {
            done(null);
        }
    });
}

export function lookupKeyDbRun(mode, action) {
    return new Promise((resolve) => {
        let settled = false;
        const done = (value) => { if (!settled) { settled = true; resolve(value); } };
        if (!lookupKeyDbDeadline(done)) { done(null); return; }
        openLookupKeyDb().then((db: any) => {
            if (!db) { done(null); return; }
            const finish = (value) => {
                try { db.close(); } catch (e) { }
                done(value);
            };
            try {
                const tx = db.transaction(LOOKUP_KEY_STORE, mode);
                const req = action(tx.objectStore(LOOKUP_KEY_STORE));
                tx.onabort = () => finish(null);
                tx.onerror = () => finish(null);
                if (!req) { tx.oncomplete = () => finish(true); return; }
                req.onsuccess = () => finish(req.result === undefined ? true : req.result);
                req.onerror = () => finish(null);
            } catch (e) {
                finish(null);
            }
        }, () => done(null));
    });
}

export function rememberLookupSecretKey(key) {
    if (!key) return Promise.resolve(false);
    try {
        return lookupKeyDbRun('readwrite', (store) => store.put(key, LOOKUP_KEY_ID)).then((r) => r !== null, () => false);
    } catch (e) {
        return Promise.resolve(false);
    }
}

export function forgetStoredLookupSecretKey() {
    try {
        return lookupKeyDbRun('readwrite', (store) => store.delete(LOOKUP_KEY_ID)).then(() => true, () => false);
    } catch (e) {
        return Promise.resolve(false);
    }
}

export function restoreLookupSecretKey() {
    if (securityState.lookupSecretKey) return Promise.resolve(true);
    try {
        if (appLockShouldArm()) return Promise.resolve(false);
        return lookupKeyDbRun('readonly', (store) => store.get(LOOKUP_KEY_ID)).then((stored) => {
            if (!stored || typeof stored !== 'object' || (stored as any).type !== 'secret') return false;
            securityState.lookupSecretKey = stored;
            return true;
        }, () => false);
    } catch (e) {
        return Promise.resolve(false);
    }
}

export async function encryptLookupSecret(plainText) {
    if (!securityState.lookupSecretKey || !plainText) return null;
    try {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, securityState.lookupSecretKey, new TextEncoder().encode(plainText));
        return { iv: Array.from(iv), data: Array.from(new Uint8Array(cipherBuf)) };
    } catch (e) {
        return null;
    }
}

export async function decryptLookupSecret(encObj) {
    if (!securityState.lookupSecretKey || !encObj || !Array.isArray(encObj.data) || !Array.isArray(encObj.iv)) return '';
    try {
        const iv = new Uint8Array(encObj.iv);
        const data = new Uint8Array(encObj.data);
        const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, securityState.lookupSecretKey, data);
        return new TextDecoder().decode(plainBuf);
    } catch (e) {
        return '';
    }
}
