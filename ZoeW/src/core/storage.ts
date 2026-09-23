export const appLocalStore = (function () { try { return window.localStorage; } catch (e) { return null; } })();

export const appSessionStore = (function () { try { return window.sessionStorage; } catch (e) { return null; } })();

export function safeStoreGet(store, key) {
    try { return store ? store.getItem(key) : null; } catch (e) { return null; }
}

export function safeStoreSet(store, key, value) {
    try { return store ? (store.setItem(key, String(value)), true) : false; } catch (e) { return false; }
}

export function safeStoreRemove(store, key) {
    try { return store ? (store.removeItem(key), true) : false; } catch (e) { return false; }
}
