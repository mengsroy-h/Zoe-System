import { openIdbStore } from '../core/idb-store';

export const SB_DOCS_CACHE_DB = 'zoew_sb_docs_v1';
export const SB_DOCS_CACHE_STORE = 'c';
export const SB_DOCS_CACHE_VERSION = 1;
export const SB_DOCS_CACHE_TIMEOUT_MS = 3000;

export function docsCacheRecordIsValid(rec, scope) {
    if (!rec || typeof rec !== 'object' || rec.v !== SB_DOCS_CACHE_VERSION || rec.scope !== scope) return false;
    if (typeof rec.tenant !== 'string' || !rec.tenant) return false;
    if (typeof rec.cursor !== 'number' || !Number.isFinite(rec.cursor) || rec.cursor <= 0) return false;
    if (!Array.isArray(rec.docs)) return false;
    for (const d of rec.docs) {
        if (!Array.isArray(d) || d.length !== 4) return false;
        if (typeof d[0] !== 'string' || !d[0] || typeof d[1] !== 'string' || !d[1]) return false;
        if (d[2] === null || d[2] === undefined) return false;
        if (typeof d[3] !== 'number' || !Number.isFinite(d[3]) || d[3] <= 0) return false;
    }
    return true;
}

function docsCacheFactory() {
    try {
        return typeof indexedDB !== 'undefined' && indexedDB ? indexedDB : null;
    } catch (e) {
        return null;
    }
}

function docsCacheSettle(run) {
    return new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const done = (value) => {
            if (settled) return false;
            settled = true;
            if (timer !== null) { try { clearTimeout(timer); } catch (e) {} }
            resolve(value);
            return true;
        };
        try {
            timer = setTimeout(() => done(null), SB_DOCS_CACHE_TIMEOUT_MS);
        } catch (e) {
            done(null);
            return;
        }
        try {
            run(done);
        } catch (e) {
            done(null);
        }
    });
}

function armDocsCacheDeadline(done) {
    try {
        setTimeout(() => done(null), SB_DOCS_CACHE_TIMEOUT_MS);
        return true;
    } catch (e) {
        return false;
    }
}

function openDocsCacheDb() {
    return openIdbStore(SB_DOCS_CACHE_DB, SB_DOCS_CACHE_STORE, docsCacheFactory, armDocsCacheDeadline);
}

function runDocsCache(mode, action) {
    return docsCacheSettle((done) => {
        openDocsCacheDb().then((db: any) => {
            if (!db) { done(null); return; }
            const finish = (value) => {
                try { db.close(); } catch (e) {}
                done(value);
            };
            try {
                const tx = db.transaction(SB_DOCS_CACHE_STORE, mode);
                let result;
                tx.oncomplete = () => finish(result === undefined ? true : result);
                tx.onabort = () => finish(null);
                tx.onerror = () => finish(null);
                const req = action(tx.objectStore(SB_DOCS_CACHE_STORE));
                if (req) req.onsuccess = () => { result = req.result; };
            } catch (e) {
                finish(null);
            }
        }, () => done(null));
    });
}

export function createIdbDocsCache() {
    return {
        load: (scope) => runDocsCache('readonly', (store) => store.get(scope))
            .then((rec) => (docsCacheRecordIsValid(rec, scope) ? rec : null), () => null),
        save: (scope, rec) => runDocsCache('readwrite', (store) => {
            store.clear();
            return store.put(rec, scope);
        }).then((r) => r !== null, () => false),
        clear: () => runDocsCache('readwrite', (store) => store.clear()).then((r) => r !== null, () => false)
    };
}

export function forgetSupabaseDocsCache() {
    return docsCacheSettle((done) => {
        const factory = docsCacheFactory();
        if (!factory) { done(false); return; }
        const req = factory.deleteDatabase(SB_DOCS_CACHE_DB);
        req.onsuccess = () => done(true);
        req.onerror = () => done(false);
        req.onblocked = () => done(false);
    }).then((r) => r === true, () => false);
}
