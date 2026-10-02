import { firebaseState } from '../core/state';
import { appLocalStore, safeStoreGet, safeStoreRemove, safeStoreSet } from '../core/storage';

export const REMEMBERED_LOGIN_KEY = 'remembered_email';

export const REMEMBERED_LOGIN_SCOPE_KEY = 'remembered_email_scope';

export function loginBackendScope(cfg?) {
    const config = cfg === undefined ? firebaseState.firebaseConfig : cfg;
    if (!config || typeof config !== 'object') return '';
    if (typeof config.supabaseUrl === 'string' && config.supabaseUrl) return 'sb:' + config.supabaseUrl.trim().replace(/\/+$/, '').toLowerCase();
    const where = typeof config.databaseURL === 'string' && config.databaseURL ? config.databaseURL : (typeof config.projectId === 'string' ? config.projectId : '');
    return where ? 'fb:' + where.trim().replace(/\/+$/, '').toLowerCase() : '';
}

export function rememberedLoginKind(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return '';
    return text.indexOf('@') !== -1 && !/\.invalid$/.test(text) ? 'fb' : 'sb';
}

export function rememberedLoginFor(scope?) {
    const where = scope === undefined ? loginBackendScope() : scope;
    if (!where) return '';
    const value = safeStoreGet(appLocalStore, REMEMBERED_LOGIN_KEY);
    if (!value) return '';
    const owner = safeStoreGet(appLocalStore, REMEMBERED_LOGIN_SCOPE_KEY);
    if (owner) return owner === where ? value : '';
    return rememberedLoginKind(value) === where.slice(0, 2) ? value : '';
}

export function rememberLogin(value, scope?) {
    const where = scope === undefined ? loginBackendScope() : scope;
    const text = String(value || '').trim();
    if (!text || !where) {
        forgetRememberedLogin();
        return false;
    }
    const stored = safeStoreSet(appLocalStore, REMEMBERED_LOGIN_KEY, text);
    const scoped = safeStoreSet(appLocalStore, REMEMBERED_LOGIN_SCOPE_KEY, where);
    return stored && scoped;
}

export function forgetRememberedLogin() {
    safeStoreRemove(appLocalStore, REMEMBERED_LOGIN_KEY);
    safeStoreRemove(appLocalStore, REMEMBERED_LOGIN_SCOPE_KEY);
}
