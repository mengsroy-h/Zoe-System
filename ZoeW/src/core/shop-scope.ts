import { firebaseState } from './state';
import { appLocalStore, safeStoreGet, safeStoreSet } from './storage';

export function shopScope() {
    try {
        const raw = safeStoreGet(appLocalStore, 'zoew_firebase_config');
        if (!raw) return '';
        const found = /databaseURL"?'?\s*:\s*["']([^"']+)["']/.exec(raw);
        if (found) return found[1];
        const supabase = /supabaseUrl"?'?\s*:\s*["']([^"']+)["']/.exec(raw);
        if (!supabase) return '';
        const tenant = firebaseState.fb && typeof firebaseState.fb.tenantScope === 'function' ? firebaseState.fb.tenantScope(firebaseState.auth) : '';
        return tenant ? supabase[1] + '#' + tenant : '';
    } catch (e) {
        return '';
    }
}

export function shopScopePending() {
    if (shopScope()) return false;
    try {
        const raw = safeStoreGet(appLocalStore, 'zoew_firebase_config');
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
