import { fieldValue, setFieldChecked, setFieldValue } from '../app/refs';
import { modalIsOpen } from '../core/modals';
import { appLocalStore, safeStoreGet, safeStoreRemove, safeStoreSet } from '../core/storage';
import { REMEMBER_PASSWORD_PREF_KEY } from '../core/storage-keys';
import { viewState } from '../core/view-state';
import { lookupKeyDbRun } from '../services/crypto';
import { loginBackendScope } from './login-memory';

export const REMEMBERED_PASSWORD_ID = 'rememberedLoginPassword';

let memorySeq = 0;
let prefillSeq = 0;
let prefilledPassword = '';

function loginKey(login) {
    return String(login === null || login === undefined ? '' : login).trim().toLowerCase();
}

function bindingOf(scope, login) {
    return new TextEncoder().encode('zoew-login-password:' + scope + '|' + loginKey(login));
}

export function rememberPasswordPrefIsOff() {
    return safeStoreGet(appLocalStore, REMEMBER_PASSWORD_PREF_KEY) === '0';
}

export function setRememberPasswordPref(enabled) {
    return enabled
        ? safeStoreRemove(appLocalStore, REMEMBER_PASSWORD_PREF_KEY)
        : safeStoreSet(appLocalStore, REMEMBER_PASSWORD_PREF_KEY, '0');
}

export function forgetLoginPassword() {
    memorySeq++;
    prefillSeq++;
    prefilledPassword = '';
    try {
        return lookupKeyDbRun('readwrite', (store) => store.delete(REMEMBERED_PASSWORD_ID)).then((r) => r !== null, () => false);
    } catch (e) {
        return Promise.resolve(false);
    }
}

export async function rememberLoginPassword(login, password, scope) {
    const name = loginKey(login);
    if (!name || typeof password !== 'string' || !password || !scope) {
        await forgetLoginPassword();
        return false;
    }
    const mySeq = ++memorySeq;
    try {
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: bindingOf(scope, name) }, key, new TextEncoder().encode(password));
        const record = { key, iv: Array.from(iv), data: Array.from(new Uint8Array(data)) };
        const stored = await lookupKeyDbRun('readwrite', (store) => store.put(record, REMEMBERED_PASSWORD_ID));
        if (mySeq !== memorySeq) {
            await forgetLoginPassword();
            return false;
        }
        return stored !== null;
    } catch (e) {
        return false;
    }
}

export async function rememberedPasswordFor(login, scope) {
    const name = loginKey(login);
    if (!name || !scope) return '';
    try {
        const rec: any = await lookupKeyDbRun('readonly', (store) => store.get(REMEMBERED_PASSWORD_ID));
        if (!rec || typeof rec !== 'object' || !rec.key || typeof rec.key !== 'object' || rec.key.type !== 'secret' || !Array.isArray(rec.iv) || !Array.isArray(rec.data)) return '';
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(rec.iv), additionalData: bindingOf(scope, name) }, rec.key, new Uint8Array(rec.data));
        return new TextDecoder().decode(plain);
    } catch (e) {
        return '';
    }
}

export function syncRememberPasswordBox() {
    setFieldChecked('rememberPasswordCheckbox', !rememberPasswordPrefIsOff());
}

export function prefillRememberedPassword(login, scope) {
    const seq = ++prefillSeq;
    prefilledPassword = '';
    syncRememberPasswordBox();
    if (!loginKey(login) || !scope || rememberPasswordPrefIsOff()) return Promise.resolve(false);
    return rememberedPasswordFor(login, scope).then((password) => {
        if (!password || seq !== prefillSeq || rememberPasswordPrefIsOff()) return false;
        if (!modalIsOpen('loginModal') || viewState.loginMode !== 'login' || viewState.loginBusy) return false;
        if (fieldValue('loginPasswordInput') || loginKey(fieldValue('loginEmailInput')) !== loginKey(login) || loginBackendScope() !== scope) return false;
        setFieldValue('loginPasswordInput', password);
        prefilledPassword = password;
        return true;
    }, () => false);
}

export function toggleRememberPassword(el?) {
    const enabled = !!(el && el.checked);
    setRememberPasswordPref(enabled);
    if (enabled) return;
    const shown = prefilledPassword;
    forgetLoginPassword();
    if (shown && fieldValue('loginPasswordInput') === shown) setFieldValue('loginPasswordInput', '');
}
