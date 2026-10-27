import { firebaseState } from './state';
import { appLocalStore, safeStoreGet, safeStoreSet } from './storage';

export function shopScope() {
    try {
        const raw = safeStoreGet(appLocalStore, 'zoew_firebase_config');
        if (!raw) return '';
        const found = /databaseURL"?'?\s*:\s*["']([^"']+)["']/.exec(raw);
        if (found) return found[1];
        const supabase = /supabaseUrl"?'?\s*:\s*["']([^"']+)["']/.exec(raw);
        if (!supabase || firebaseState.isInitializingFirebase) return '';
        const activeUrl = firebaseState.auth && firebaseState.auth.app && firebaseState.auth.app.options && firebaseState.auth.app.options.supabaseUrl;
        if (activeUrl && String(activeUrl).replace(/\/+$/, '') !== supabase[1].replace(/\/+$/, '')) return '';
        const tenant = firebaseState.fb && typeof firebaseState.fb.tenantScope === 'function' ? firebaseState.fb.tenantScope(firebaseState.auth) : '';
        return tenant ? supabase[1] + '#' + tenant : '';
    } catch (e) {
        return '';
    }
}

export function liveShopScope() {
    const stored = shopScope();
    try {
        const liveDb: any = firebaseState.db;
        const liveAuth: any = firebaseState.auth;
        const live = (liveDb && liveDb.app && liveDb.app.options) || (liveAuth && liveAuth.app && liveAuth.app.options);
        if (!live || typeof live !== 'object') return stored;
        const raw = safeStoreGet(appLocalStore, 'zoew_firebase_config') || '';
        const found = /databaseURL"?'?\s*:\s*["']([^"']+)["']/.exec(raw);
        const key = (url) => String(url || '').trim().replace(/\/+$/, '').toLowerCase();
        if (typeof live.databaseURL === 'string' && live.databaseURL) return found && key(found[1]) === key(live.databaseURL) ? stored : live.databaseURL;
        if (typeof live.supabaseUrl === 'string' && live.supabaseUrl) {
            if (stored && !found) return stored;
            const tenant = firebaseState.fb && typeof firebaseState.fb.tenantScope === 'function' ? firebaseState.fb.tenantScope(firebaseState.auth) : '';
            return tenant ? live.supabaseUrl + '#' + tenant : '';
        }
    } catch (e) {
        return stored;
    }
    return stored;
}

export function shopScopePending() {
    try {
        const raw = safeStoreGet(appLocalStore, 'zoew_firebase_config');
        if (shopScope()) {
            const found = raw ? /databaseURL"?'?\s*:\s*["']([^"']+)["']/.exec(raw) : null;
            const liveDb: any = firebaseState.db;
            const liveAuth: any = firebaseState.auth;
            const live = (liveDb && liveDb.app && liveDb.app.options) || (liveAuth && liveAuth.app && liveAuth.app.options);
            if (!found || !live || typeof live !== 'object') return false;
            const key = (url) => String(url || '').trim().replace(/\/+$/, '').toLowerCase();
            return key(live.databaseURL) !== key(found[1]);
        }
        return !!raw && /supabaseUrl"?'?\s*:/.test(raw);
    } catch (e) {
        return false;
    }
}

export function sameShop(a, b) {
    const key = (scope) => String(scope || '').trim().replace(/\/+(#|$)/, '$1').toLowerCase();
    const left = key(a);
    return !!left && left === key(b);
}

export function shopOwnsSetting(setting, storeKey) {
    if (!setting || typeof setting !== 'object') return false;
    const here = shopScope();
    if (typeof setting.shop === 'string' && setting.shop) return sameShop(setting.shop, here);
    if (here) {
        setting.shop = here;
        safeStoreSet(appLocalStore, storeKey, JSON.stringify(setting));
    }
    return true;
}
