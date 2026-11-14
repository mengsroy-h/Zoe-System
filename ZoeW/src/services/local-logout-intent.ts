import { appLocalStore, appSessionStore, safeStoreGet } from '../core/storage';

export const LOCAL_LOGOUT_INTENT_PREFIX = 'zoew_local_logout_v1:';

export function createLocalLogoutIntentStore(local, session) {
    const stores = [local, session];
    const memory = new Map();
    const identity = (scope, uid) => typeof scope === 'string' && scope.length > 0 && typeof uid === 'string' && uid.length > 0;
    const prefix = (scope) => LOCAL_LOGOUT_INTENT_PREFIX + JSON.stringify(scope) + ':';
    const keyFor = (scope, uid) => prefix(scope) + JSON.stringify(uid);
    const valid = (value) => typeof value === 'string' && value.length > 0 && value.length <= 128;
    const read = (store, key) => {
        try {
            if (!store) return { available: false, value: null };
            const value = store.getItem(key);
            return { available: value === null || typeof value === 'string', value };
        } catch (e) { return { available: false, value: null }; }
    };
    const write = (store, key, value) => {
        try {
            if (!store) return false;
            store.setItem(key, value);
            const check = read(store, key);
            return check.available && check.value === value;
        } catch (e) { return false; }
    };
    const blocked = (scope, uid) => {
        if (!identity(scope, uid)) return true;
        const key = keyFor(scope, uid);
        if (memory.has(key)) return true;
        return stores.some((store) => {
            const intent = read(store, key), acknowledged = read(store, key + ':ack');
            return !intent.available || !acknowledged.available
                || intent.value !== null && (!valid(intent.value) || acknowledged.value !== intent.value);
        });
    };
    const capture = (scope) => {
        const captured = { scope, ready: typeof scope === 'string' && scope.length > 0, stores: [], memory: new Map(), unacknowledged: new Set() };
        if (!captured.ready) return captured;
        for (const [key, value] of memory) if (key.startsWith(prefix(scope))) { captured.memory.set(key, value); captured.unacknowledged.add(key); }
        for (const store of stores) {
            const rows = new Map();
            captured.stores.push(rows);
            try {
                if (!store || !Number.isSafeInteger(store.length) || store.length < 0 || typeof store.key !== 'function') throw new Error('unavailable');
                if (!read(store, prefix(scope)).available) throw new Error('unavailable');
                for (let i = 0; i < store.length; i++) {
                    const key = store.key(i);
                    if (typeof key !== 'string' || !key.startsWith(prefix(scope)) || key.endsWith(':ack')) continue;
                    const current = read(store, key);
                    if (!current.available || current.value !== null && !valid(current.value)) throw new Error('unavailable');
                    if (current.value !== null) {
                        rows.set(key, current.value);
                        const acknowledged = read(store, key + ':ack');
                        if (!acknowledged.available || acknowledged.value !== current.value) captured.unacknowledged.add(key);
                    }
                }
            } catch (e) { captured.ready = false; }
        }
        return captured;
    };
    return {
        blocked,
        capture,
        fence(scope, uid) {
            if (identity(scope, uid)) {
                const key = keyFor(scope, uid);
                const current = stores.map((store) => read(store, key)).find((value) => value.available && valid(value.value));
                memory.set(key, current?.value || 'unpersisted');
            }
        },
        witness(scope, uid, captured = undefined, initial = false) {
            if (!identity(scope, uid) || typeof initial !== 'boolean') return () => false;
            if (captured !== undefined && (!captured?.ready || captured.scope !== scope || !Array.isArray(captured.stores)
                || captured.stores.length !== stores.length || captured.stores.some((rows) => typeof rows?.get !== 'function'))) return () => false;
            const key = keyFor(scope, uid), own = captured === undefined ? memory.get(key) : undefined;
            let before;
            try { before = captured === undefined ? stores.map((store) => read(store, key))
                : stores.map((_store, index) => ({ available: true, value: captured.stores[index].get(key) ?? null })); }
            catch (e) { return () => false; }
            let ended = blocked(scope, uid);
            try { if (initial && (typeof captured?.unacknowledged?.has !== 'function' || captured.unacknowledged.has(key))) ended = true; }
            catch (e) { return () => false; }
            return () => {
                if (ended) return false;
                ended = memory.get(key) !== own || stores.some((store, index) => {
                    const current = read(store, key);
                    return !current.available || !before[index].available || current.value !== before[index].value;
                }) || blocked(scope, uid);
                return !ended;
            };
        },
        affects(scope, uid, key) { return identity(scope, uid) && key === keyFor(scope, uid); },
        note(scope, uid) {
            if (!identity(scope, uid)) return false;
            let token;
            try { token = crypto.randomUUID(); }
            catch (e) { token = Date.now().toString(36) + ':' + Math.random().toString(36).slice(2); }
            const key = keyFor(scope, uid);
            memory.set(key, token);
            const durable = write(stores[0], key, token);
            write(stores[1], key, token);
            return durable;
        },
        acknowledge(scope, uid, captured) {
            if (!identity(scope, uid) || !captured?.ready || captured.scope !== scope) return false;
            const key = keyFor(scope, uid);
            const memoryToken = memory.get(key);
            if (memoryToken !== captured.memory.get(key)) return false;
            const tokens = [];
            for (let i = 0; i < stores.length; i++) {
                const current = read(stores[i], key);
                if (!current.available || current.value !== (captured.stores[i].get(key) ?? null)) return false;
                tokens.push(current.value);
            }
            for (let i = 0; i < stores.length; i++) if (tokens[i] !== null && !write(stores[i], key + ':ack', tokens[i])) return false;
            for (let i = 0; i < stores.length; i++) {
                const current = read(stores[i], key);
                if (!current.available || current.value !== tokens[i]) return false;
            }
            if (memory.get(key) === memoryToken) memory.delete(key);
            return !blocked(scope, uid);
        }
    };
}

export const localLogoutIntent = createLocalLogoutIntentStore(appLocalStore, appSessionStore);

const acceptedAuthSessions = new WeakMap<object, any>();

export function acceptLocalAuthSession(auth, scope, user, explicit = false, captured?) {
    if (!auth || typeof auth !== 'object' || auth.currentUser !== user || localLogoutIntent.blocked(scope, user?.uid)) return false;
    const previous = acceptedAuthSessions.get(auth);
    const config = safeStoreGet(appLocalStore, 'zoew_firebase_config');
    if (!explicit && previous?.scope === scope && previous.uid === user.uid) return previous.config === config && previous.current();
    const current = localLogoutIntent.witness(scope, user.uid, explicit ? captured ?? null : captured, !explicit && captured !== undefined);
    if (!current()) return false;
    acceptedAuthSessions.set(auth, { scope, uid: user.uid, config, current });
    return localAuthSessionCurrent(auth, scope, user);
}

export function localAuthSessionCurrent(auth, scope, user) {
    if (!auth || typeof auth !== 'object' || !user || auth.currentUser !== user) return false;
    const accepted = acceptedAuthSessions.get(auth);
    return !!accepted && accepted.scope === scope && accepted.uid === user.uid
        && accepted.config === safeStoreGet(appLocalStore, 'zoew_firebase_config') && accepted.current();
}
