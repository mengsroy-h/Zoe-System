import { firebaseState } from '../core/state';
import { dbListenerPendingPaths } from '../core/text';
import { createNativeWriteRecovery, nativeWriteRecoveryState } from './native-write-recovery';
import { appLocalStore, safeStoreGet } from '../core/storage';

const connectionLeases = new Set<any>();
let stopConnectionLeaseObserver: (() => void) | null = null;

export function captureConnectionOperation() {
    const leaseAuth = firebaseState.auth; const leaseDb = firebaseState.db; const sdk = firebaseState.fb;
    const epoch = firebaseState.authGeneration; const uid = leaseAuth && leaseAuth.currentUser && leaseAuth.currentUser.uid;
    const tenant = leaseAuth && leaseAuth._account && leaseAuth._account.tenant_id;
    const config = safeStoreGet(appLocalStore, 'zoew_firebase_config');
    const current = () => leaseAuth === firebaseState.auth && leaseDb === firebaseState.db && sdk === firebaseState.fb
        && epoch === firebaseState.authGeneration && uid === (leaseAuth && leaseAuth.currentUser && leaseAuth.currentUser.uid)
        && tenant === (leaseAuth && leaseAuth._account && leaseAuth._account.tenant_id)
        && config === safeStoreGet(appLocalStore, 'zoew_firebase_config');
    return {
        current,
        watch(onEnd) {
            if (!current()) { onEnd(); return () => {}; }
            const row = { current, onEnd }; connectionLeases.add(row);
            if (!stopConnectionLeaseObserver) {
                const changed = () => { for (const lease of [...connectionLeases]) if (!lease.current()) lease.onEnd(); };
                const unsubscribe = typeof firebaseState.subscribe === 'function' ? firebaseState.subscribe(changed) : () => {};
                if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('storage', changed);
                stopConnectionLeaseObserver = () => {
                    unsubscribe();
                    if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('storage', changed);
                };
            }
            return () => {
                connectionLeases.delete(row);
                if (!connectionLeases.size && stopConnectionLeaseObserver) { stopConnectionLeaseObserver(); stopConnectionLeaseObserver = null; }
            };
        }
    };
}

export type ConnectionPhase = 'unconfigured' | 'initializing' | 'signed-out' | 'authenticating' | 'syncing' | 'ready' | 'offline' | 'recovering' | 'expired' | 'unavailable' | 'blocked';

export function connectionFlowSnapshot() {
    let phase: ConnectionPhase;
    if (firebaseState.firebaseSdkUnavailable) phase = 'unavailable';
    else if (firebaseState.isInitializingFirebase) phase = 'initializing';
    else if (!firebaseState.fb || !firebaseState.db) phase = 'unconfigured';
    else if (firebaseState.sessionExpiryCheck === 'expired') phase = 'expired';
    else if (firebaseState.authLoginOperation) phase = 'authenticating';
    else if (!firebaseState.auth || !firebaseState.auth.currentUser) phase = 'signed-out';
    else if (nativeWriteRecoveryState(firebaseState.db).blocked) phase = 'blocked';
    else if (nativeWriteRecoveryState(firebaseState.db).recovering || nativeWriteRecoveryState(firebaseState.db).external) phase = 'recovering';
    else if (firebaseState.db && typeof firebaseState.db.recoveryState === 'function' && firebaseState.db.recoveryState().blocked) phase = 'blocked';
    else if (typeof navigator !== 'undefined' && navigator.onLine === false) phase = 'offline';
    else if (!firebaseState.isDatabaseConnected || firebaseState.dbListenersFailed) phase = 'recovering';
    else if (!firebaseState.isDatabaseInitialized || dbListenerPendingPaths.size) phase = 'syncing';
    else phase = 'ready';
    return { phase, epoch: firebaseState.authGeneration, pendingViews: dbListenerPendingPaths.size,
        canWrite: phase === 'ready' || phase === 'syncing' || phase === 'recovering' || phase === 'offline' };
}

export function withConnectionOwnership(sdk) {
    if (!sdk || sdk.__connectionOwned || typeof Proxy !== 'function') return sdk;
    const apps = new WeakMap<object, any>();
    const refs = new WeakMap<object, any>();
    const databases = new WeakMap<object, any>();
    const streams = new Set<any>();
    let report = () => {};
    const entryFor = (app) => {
        if (!app || typeof app !== 'object') return null;
        let entry = apps.get(app);
        if (!entry) { entry = { app, auth: null, epoch: 0, closed: false }; apps.set(app, entry); }
        return entry;
    };
    const ended = () => Object.assign(new Error('Connection session changed'), { code: 'CONNECTION_SCOPE_CHANGED', noRetry: true, txOutcome: 'unknown' });
    const scopeOf = (entry) => {
        const ownerAuth = entry && entry.auth;
        return ownerAuth && ownerAuth._account && ownerAuth._account.tenant_id || '';
    };
    const capture = (entry, bound = true) => {
        const ownerAuth = entry && entry.auth;
        const uid = ownerAuth && ownerAuth.currentUser && ownerAuth.currentUser.uid;
        const epoch = entry && entry.epoch;
        const tenant = scopeOf(entry);
        const appEpoch = ownerAuth && ownerAuth === firebaseState.auth ? firebaseState.authGeneration : null;
        const config = appEpoch !== null ? safeStoreGet(appLocalStore, 'zoew_firebase_config') : null;
        return () => !entry || (!entry.closed && (!bound || (entry.epoch === epoch && scopeOf(entry) === tenant
            && (entry.auth && entry.auth.currentUser && entry.auth.currentUser.uid) === uid
            && (appEpoch === null || firebaseState.auth === ownerAuth && firebaseState.authGeneration === appEpoch
                && config === safeStoreGet(appLocalStore, 'zoew_firebase_config')))));
    };
    const stop = (row) => {
        if (!row.active) return;
        row.active = false;
        streams.delete(row);
        if (typeof row.off === 'function') { try { row.off(); } catch (e) {} }
    };
    const nativeRecovery = (entry, ownedDb) => {
        if (sdk.__supabase || !entry || !entry.auth || entry.auth !== firebaseState.auth || ownedDb !== firebaseState.db || !entry.auth.currentUser) return null;
        const uid = entry.auth.currentUser.uid;
        if (!entry.recovery || entry.recovery.uid !== uid || !entry.recovery.current()) entry.recovery = createNativeWriteRecovery(sdk, entry.auth, ownedDb, capture(entry), () => report(), captureConnectionOperation);
        return entry.recovery;
    };
    const listen = (entry, path, callback, start, bound = true) => {
        for (const row of [...streams]) if (row.entry === entry && row.path === path && row.callback === callback) stop(row);
        const row: any = { entry, path, callback, active: true, off: null };
        const current = capture(entry, bound);
        streams.add(row);
        try { row.off = start((...args) => { if (row.active && current()) callback(...args); }, () => row.active && current(), () => stop(row)); }
        catch (e) { stop(row); throw e; }
        if (!row.active && typeof row.off === 'function') { try { row.off(); } catch (e) {} }
        return () => stop(row);
    };
    return new Proxy(sdk, {
        get(target, prop) {
            if (prop === '__connectionOwned') return true;
            if (prop === 'setConnectionFlowReporter') return (callback) => { report = typeof callback === 'function' ? callback : () => {}; };
            if (prop === 'connectionEpoch') return (ref) => {
                const entry = refs.get(ref)?.entry;
                return entry && typeof entry.transportConnected === 'boolean' ? entry.transportEpoch || 0 : null;
            };
            if (prop === 'retryWriteRecovery') return (db) => {
                if (target.__supabase) return typeof db.retryWriteRecovery === 'function' ? db.retryWriteRecovery() : Promise.resolve();
                const entry = databases.get(db);
                if (entry && entry.recovery && entry.recovery.current() && nativeWriteRecoveryState(db).recovering) return entry.recovery.recovery;
                if (entry) entry.recovery = null;
                const recovery = nativeRecovery(entry, db);
                return recovery ? recovery.recovery : Promise.resolve();
            };
            if (prop === 'getAuth') return (app) => { const auth = target.getAuth(app); const entry = entryFor(app); if (entry) entry.auth = auth; return auth; };
            if (prop === 'getDatabase') return (app) => { const db = target.getDatabase(app); const entry = entryFor(app); databases.set(db, entry); if (entry) entry.db = db; return db; };
            if (prop === 'ref') return (db, path) => {
                const ref = target.ref(db, path);
                refs.set(ref, { entry: databases.get(db) || entryFor(db && db.app), db, path: String(path || '').replace(/^\/+/, '') });
                return ref;
            };
            if (prop === 'onValue') return (ref, cb, errCb) => {
                const meta = refs.get(ref) || { entry: null, path: String(ref) };
                return listen(meta.entry, meta.path, cb, (deliver, current, cancel) => target.onValue(ref, (snapshot) => {
                    if (meta.entry && meta.path === '.info/connected' && current()) {
                        const connected = snapshot.val() === true;
                        if (meta.entry.transportConnected !== connected) meta.entry.transportEpoch = (meta.entry.transportEpoch || 0) + 1;
                        meta.entry.transportConnected = connected;
                    }
                    deliver(snapshot);
                },
                    (e) => { if (!current()) return; cancel(); if (errCb) errCb(e); else console.error(e); }), !meta.path.startsWith('.info/'));
            };
            if (prop === 'off') return (ref) => {
                const meta = refs.get(ref);
                if (meta) for (const row of [...streams]) if (row.entry === meta.entry && row.path === meta.path) stop(row);
                return target.off(ref);
            };
            if (prop === 'onAuthStateChanged') return (auth, cb) => listen(entryFor(auth.app), '@auth', cb,
                (deliver) => target.onAuthStateChanged(auth, (user) => {
                    if (user !== auth.currentUser) return;
                    const entry = entryFor(auth.app);
                    deliver(user);
                    if (user && entry && entry.db) nativeRecovery(entry, entry.db);
                }), false);
            if (prop === 'get') return async (ref) => {
                const current = capture(refs.get(ref)?.entry);
                if (!current()) throw ended();
                const result = await target.get(ref);
                if (!current()) throw ended();
                return result;
            };
            if (prop === 'runTransaction') return (ref, updater, options) => {
                const meta = refs.get(ref);
                const current = capture(refs.get(ref)?.entry);
                if (!current() || meta?.entry?.auth && !meta.entry.auth.currentUser
                    || meta?.entry?.auth === firebaseState.auth && !connectionFlowSnapshot().canWrite) return Promise.reject(ended());
                const guarded = Object.assign((value) => { if (!current()) throw ended(); return updater(value); }, updater);
                const recovery = nativeRecovery(meta?.entry, meta?.db);
                if (recovery) return recovery.mutate('runTransaction', ref, guarded, options);
                return target.runTransaction(ref, guarded, options);
            };
            if (prop === 'set' || prop === 'update') return (ref, value) => {
                const meta = refs.get(ref);
                const current = capture(meta?.entry);
                if (!current() || meta?.entry?.auth && !meta.entry.auth.currentUser
                    || meta?.entry?.auth === firebaseState.auth && !connectionFlowSnapshot().canWrite) return Promise.reject(ended());
                const recovery = nativeRecovery(meta?.entry, meta?.db);
                if (recovery) return recovery.mutate(prop, ref, value);
                return target[prop](ref, value);
            };
            if (prop === 'signOut' || prop === 'signInWithEmailAndPassword') return (auth, ...args) => {
                const entry = entryFor(auth.app); if (entry) entry.epoch++;
                return target[prop](auth, ...args);
            };
            if (prop === 'deleteApp') return (app) => {
                const entry = entryFor(app); if (entry) { entry.closed = true; entry.epoch++; }
                for (const row of [...streams]) if (row.entry === entry) stop(row);
                return target.deleteApp(app);
            };
            return target[prop];
        }
    });
}
