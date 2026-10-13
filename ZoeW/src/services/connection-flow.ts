import { firebaseState } from '../core/state';
import { dbListenerPendingPaths } from '../core/text';
import { createNativeWriteRecovery, nativeWriteRecoveryState } from './native-write-recovery';
import { appLocalStore, safeStoreGet } from '../core/storage';

const connectionLeases = new Set<any>();
let stopConnectionLeaseObserver: (() => void) | null = null;

export function captureConnectionOperation() {
    const leaseAuth = firebaseState.auth; const leaseDb = firebaseState.db; const sdk = firebaseState.fb;
    const epoch = firebaseState.authGeneration; const uid = leaseAuth && leaseAuth.currentUser && leaseAuth.currentUser.uid;
    const tenant = (leaseAuth && leaseAuth._account && leaseAuth._account.tenant_id) || '';
    const config = safeStoreGet(appLocalStore, 'zoew_firebase_config');
    const current = () => leaseAuth === firebaseState.auth && leaseDb === firebaseState.db && sdk === firebaseState.fb
        && epoch === firebaseState.authGeneration && uid === (leaseAuth && leaseAuth.currentUser && leaseAuth.currentUser.uid)
        && (tenant === '' || tenant === ((leaseAuth && leaseAuth._account && leaseAuth._account.tenant_id) || ''))
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
    else if (nativeWriteRecoveryState(firebaseState.db).recovering || nativeWriteRecoveryState(firebaseState.db).deferred || nativeWriteRecoveryState(firebaseState.db).external) phase = 'recovering';
    else if (firebaseState.db && typeof firebaseState.db.recoveryState === 'function' && firebaseState.db.recoveryState().blocked) phase = 'blocked';
    else if (typeof navigator !== 'undefined' && navigator.onLine === false) phase = 'offline';
    else if (!firebaseState.isDatabaseConnected || firebaseState.dbListenersFailed) phase = 'recovering';
    else if (!firebaseState.isDatabaseInitialized || dbListenerPendingPaths.size) phase = 'syncing';
    else phase = 'ready';
    return { phase, epoch: firebaseState.authGeneration, pendingViews: dbListenerPendingPaths.size,
        pendingWrites: (nativeWriteRecoveryState(firebaseState.db).pending || 0)
            + (firebaseState.db && typeof firebaseState.db.recoveryState === 'function' ? firebaseState.db.recoveryState().pending || 0 : 0),
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
        let ownerScope = apps.get(app);
        if (!ownerScope) { ownerScope = { app, auth: null, epoch: 0, closed: false }; apps.set(app, ownerScope); }
        return ownerScope;
    };
    const ended = () => Object.assign(new Error('Connection session changed'), { code: 'CONNECTION_SCOPE_CHANGED', noRetry: true, txOutcome: 'not-applied' });
    const scopeOf = (ownerScope) => {
        const ownerAuth = ownerScope && ownerScope.auth;
        return ownerAuth && ownerAuth._account && ownerAuth._account.tenant_id || '';
    };
    const capture = (ownerScope, bound = true) => {
        const ownerAuth = ownerScope && ownerScope.auth;
        const uid = ownerAuth && ownerAuth.currentUser && ownerAuth.currentUser.uid;
        const epoch = ownerScope && ownerScope.epoch;
        const tenant = scopeOf(ownerScope);
        const appEpoch = ownerAuth && ownerAuth === firebaseState.auth ? firebaseState.authGeneration : null;
        const config = appEpoch !== null ? safeStoreGet(appLocalStore, 'zoew_firebase_config') : null;
        return () => !ownerScope || (!ownerScope.closed && (!bound || (ownerScope.epoch === epoch && (tenant === '' || scopeOf(ownerScope) === tenant)
            && (ownerScope.auth && ownerScope.auth.currentUser && ownerScope.auth.currentUser.uid) === uid
            && (appEpoch === null || firebaseState.auth === ownerAuth && firebaseState.authGeneration === appEpoch
                && config === safeStoreGet(appLocalStore, 'zoew_firebase_config')))));
    };
    const stop = (row) => {
        if (!row.active) return;
        row.active = false;
        streams.delete(row);
        if (typeof row.off === 'function') { try { row.off(); } catch (e) {} }
    };
    const nativeRecovery = (ownerScope, ownedDb) => {
        if (sdk.__supabase || !ownerScope || !ownerScope.auth || ownerScope.auth !== firebaseState.auth || ownedDb !== firebaseState.db || !ownerScope.auth.currentUser) return null;
        const uid = ownerScope.auth.currentUser.uid;
        if (!ownerScope.recovery || ownerScope.recovery.uid !== uid || !ownerScope.recovery.current()) ownerScope.recovery = createNativeWriteRecovery(sdk, ownerScope.auth, ownedDb, capture(ownerScope), () => report(), captureConnectionOperation);
        return ownerScope.recovery;
    };
    const listen = (ownerScope, path, callback, start, bound = true) => {
        for (const row of [...streams]) if (row.ownerScope === ownerScope && row.path === path && row.callback === callback) stop(row);
        const row: any = { ownerScope, path, callback, active: true, off: null };
        const current = capture(ownerScope, bound);
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
                const ownerScope = refs.get(ref)?.ownerScope;
                return ownerScope && typeof ownerScope.transportConnected === 'boolean' ? ownerScope.transportEpoch || 0 : null;
            };
            if (prop === 'retryWriteRecovery') return (db) => {
                if (target.__supabase) return typeof db.retryWriteRecovery === 'function' ? db.retryWriteRecovery() : Promise.resolve();
                const recovery = nativeRecovery(databases.get(db), db);
                return recovery ? recovery.retry() : Promise.resolve();
            };
            if (prop === 'getAuth') return (app) => { const auth = target.getAuth(app); const ownerScope = entryFor(app); if (ownerScope) ownerScope.auth = auth; return auth; };
            if (prop === 'getDatabase') return (app) => { const db = target.getDatabase(app); const ownerScope = entryFor(app); databases.set(db, ownerScope); if (ownerScope) ownerScope.db = db; return db; };
            if (prop === 'ref') return (db, path) => {
                const ref = target.ref(db, path);
                refs.set(ref, { ownerScope: databases.get(db) || entryFor(db && db.app), db, path: String(path || '').replace(/^\/+/, '') });
                return ref;
            };
            if (prop === 'onValue') return (ref, cb, errCb) => {
                const meta = refs.get(ref) || { ownerScope: null, path: String(ref) };
                return listen(meta.ownerScope, meta.path, cb, (deliver, current, cancel) => target.onValue(ref, (snapshot) => {
                    if (meta.ownerScope && meta.path === '.info/connected' && current()) {
                        const connected = snapshot.val() === true;
                        if (meta.ownerScope.transportConnected !== connected) meta.ownerScope.transportEpoch = (meta.ownerScope.transportEpoch || 0) + 1;
                        meta.ownerScope.transportConnected = connected;
                    }
                    deliver(snapshot);
                },
                    (e) => { if (!current()) return; cancel(); if (errCb) errCb(e); else console.error(e); }), !meta.path.startsWith('.info/'));
            };
            if (prop === 'off') return (ref) => {
                const meta = refs.get(ref);
                if (meta) for (const row of [...streams]) if (row.ownerScope === meta.ownerScope && row.path === meta.path) stop(row);
                return target.off(ref);
            };
            if (prop === 'onAuthStateChanged') return (auth, cb) => listen(entryFor(auth.app), '@auth', cb,
                (deliver) => target.onAuthStateChanged(auth, (user) => {
                    if (user !== auth.currentUser) return;
                    const ownerScope = entryFor(auth.app);
                    deliver(user);
                    if (user && ownerScope && ownerScope.db) nativeRecovery(ownerScope, ownerScope.db);
                }), false);
            if (prop === 'get') return async (ref) => {
                const current = capture(refs.get(ref)?.ownerScope);
                if (!current()) throw ended();
                const result = await target.get(ref);
                if (!current()) throw ended();
                return result;
            };
            if (prop === 'runTransaction') return (ref, updater, options) => {
                const meta = refs.get(ref);
                const current = capture(refs.get(ref)?.ownerScope);
                if (!current() || meta?.ownerScope?.auth && !meta.ownerScope.auth.currentUser
                    || meta?.ownerScope?.auth === firebaseState.auth && !connectionFlowSnapshot().canWrite) return Promise.reject(ended());
                const guarded = Object.assign((value) => { if (!current()) throw ended(); return updater(value); }, updater);
                const recovery = nativeRecovery(meta?.ownerScope, meta?.db);
                if (recovery) return recovery.mutate('runTransaction', ref, guarded, options, meta.path);
                return target.runTransaction(ref, guarded, options);
            };
            if (prop === 'set' || prop === 'update') return (ref, value) => {
                const meta = refs.get(ref);
                const current = capture(meta?.ownerScope);
                if (!current() || meta?.ownerScope?.auth && !meta.ownerScope.auth.currentUser
                    || meta?.ownerScope?.auth === firebaseState.auth && !connectionFlowSnapshot().canWrite) return Promise.reject(ended());
                const recovery = nativeRecovery(meta?.ownerScope, meta?.db);
                if (recovery) return recovery.mutate(prop, ref, value, undefined, meta.path);
                return target[prop](ref, value);
            };
            if (prop === 'signOut' || prop === 'signInWithEmailAndPassword') return (auth, ...args) => {
                const ownerScope = entryFor(auth.app); if (ownerScope) ownerScope.epoch++;
                return target[prop](auth, ...args);
            };
            if (prop === 'deleteApp') return (app) => {
                const ownerScope = entryFor(app); if (ownerScope) { ownerScope.closed = true; ownerScope.epoch++; }
                for (const row of [...streams]) if (row.ownerScope === ownerScope) stop(row);
                return target.deleteApp(app);
            };
            return target[prop];
        }
    });
}
