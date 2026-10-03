/**
 * ⛔ «ចងចាំពាក្យសម្ងាត់» (សំណើម្ចាស់គម្រោង) ៖ checkbox ក្នុងប្រអប់ចូល · លំនាំដើមធីក · ដកធីក ➜ លុបភ្លាម
 *    (១) រក្សាតែក្រោយចូលជោគជ័យ · ជាអក្សរកូដ AES-GCM ដោយ key មិនអាចនាំចេញ (IndexedDB) ➜ អក្សរធម្មតាមិនចូល storage ណាមួយ
 *    (២) ផុត ៤ ម៉ោង ➜ ប្រអប់ចូលបំពេញពាក្យសម្ងាត់ ⛔ មិនចូលដោយខ្លួនឯង (អ្នកប្រើនៅចុច «ចូលប្រព័ន្ធ»)
 *    (៣) ចងនឹង backend + Project + ឈ្មោះគណនី · ចាកចេញ / ប្តូរពាក្យសម្ងាត់ / ដក «ចងចាំគណនី» ➜ លុប
 *    (៤) មិនសរសេរជាន់អ្វីដែលអ្នកប្រើវាយ · លុបខណៈកំពុងរក្សា ➜ គ្មានអ្វីរស់វិញ · គ្មាន IndexedDB ➜ ចូលបានធម្មតា
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore, appSessionStore } from '../src/core/storage';
import { REMEMBER_PASSWORD_PREF_KEY } from '../src/core/storage-keys';
import { fieldChecked, fieldValue, setFieldChecked, setFieldValue } from '../src/app/refs';
import { LoginModal } from '../src/app/components/modals/LoginModal';
import { loginWithFirebase } from '../src/features/auth';
import { submitResetPasswordForm } from '../src/features/account';
import { loginBackendScope } from '../src/features/login-memory';
import {
    REMEMBERED_PASSWORD_ID, forgetLoginPassword, rememberLoginPassword, rememberedPasswordFor
} from '../src/features/password-memory';
import { clearRememberedSession, showLoginModalWithPrefill } from '../src/features/session';
import { byId, mount, step, unmount } from './native/react-harness';

const FB = { apiKey: 'A', databaseURL: 'https://shop-a.firebaseio.com', projectId: 'p' };
const FB_OTHER = { apiKey: 'A', databaseURL: 'https://shop-b.firebaseio.com', projectId: 'q' };
const SB = { supabaseUrl: 'https://abcd1234.supabase.co', supabaseKey: 'sb_publishable_' + 'k'.repeat(24) };
const SECRET = 'Kh-secret-9271';

type Rec = Record<string, unknown>;
let idbRows: Map<string, unknown>;
let idbOff = false;

function fakeIndexedDb() {
    const later = (fn: () => void) => setTimeout(fn, 0);
    const request = (run: () => unknown) => {
        const req: any = {};
        later(() => {
            try {
                req.result = run();
                if (req.onsuccess) req.onsuccess();
            } catch (e) {
                if (req.onerror) req.onerror(e);
            }
        });
        return req;
    };
    const stores = new Set<string>();
    const db: any = {
        objectStoreNames: { contains: (n: string) => stores.has(n) },
        createObjectStore: (n: string) => { stores.add(n); },
        close: () => {},
        transaction: () => {
            const tx: any = {};
            tx.objectStore = () => ({
                put: (value: unknown, key: string) => request(() => { idbRows.set(key, value); return key; }),
                get: (key: string) => request(() => idbRows.get(key)),
                delete: (key: string) => request(() => { idbRows.delete(key); return undefined; })
            });
            return tx;
        }
    };
    return {
        open: () => {
            const req: any = {};
            later(() => {
                if (idbOff) { if (req.onerror) req.onerror(); return; }
                req.result = db;
                if (!stores.size && req.onupgradeneeded) req.onupgradeneeded();
                if (req.onsuccess) req.onsuccess();
            });
            return req;
        }
    };
}

function fakeFb(outcome: 'ok' | 'reject' = 'ok') {
    const signIns: string[][] = [];
    const fb: any = {
        browserLocalPersistence: { type: 'LOCAL' },
        browserSessionPersistence: { type: 'SESSION' },
        setPersistence: vi.fn(async () => {}),
        signInWithEmailAndPassword: vi.fn(async (_a: unknown, email: string, password: string) => {
            signIns.push([email, password]);
            if (outcome === 'reject') throw new Error('auth/invalid-credential');
            return { user: null };
        })
    };
    return { fb, signIns };
}

async function settle() {
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 8; j++) await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));
    }
    step(() => {});
}

function useBackend(cfg: Rec, fb: any, kind: 'firebase' | 'supabase' = 'firebase') {
    firebaseState.firebaseConfig = Object.assign({}, cfg);
    firebaseState.fb = fb;
    firebaseState.auth = { app: { name: 'x' }, currentUser: null } as any;
    step(() => { viewState.backendKind = kind; });
}

async function submitLogin(email: string, password: string, opts: { rememberMe?: boolean; rememberPassword?: boolean } = {}) {
    setFieldValue('loginEmailInput', email);
    setFieldValue('loginPasswordInput', password);
    setFieldChecked('rememberMeCheckbox', opts.rememberMe !== false);
    if (opts.rememberPassword !== undefined) setFieldChecked('rememberPasswordCheckbox', opts.rememberPassword);
    step(() => { loginWithFirebase(); });
    await settle();
}

function storageDump() {
    const out: string[] = [];
    for (const store of [appLocalStore, appSessionStore]) {
        if (!store) continue;
        for (let i = 0; i < store.length; i++) {
            const k = store.key(i) as string;
            out.push(k + '=' + store.getItem(k));
        }
    }
    return out.join('\n');
}

async function reopenAfterExpiry() {
    clearRememberedSession(true);
    step(() => { showLoginModalWithPrefill(); });
    await settle();
}

beforeEach(() => {
    if (appLocalStore) appLocalStore.clear();
    if (appSessionStore) appSessionStore.clear();
    idbRows = new Map();
    idbOff = false;
    Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => fakeIndexedDb() });
    uiState.toasts = [];
    mount(<LoginModal />);
    step(() => { showLoginModalWithPrefill(); });
});

afterEach(async () => {
    await forgetLoginPassword();
    unmount();
    step(() => { viewState.backendKind = 'firebase'; viewState.loginMode = 'login'; viewState.loginBusy = false; });
    firebaseState.fb = null;
    firebaseState.auth = null;
    firebaseState.firebaseConfig = null;
});

describe('ចងចាំពាក្យសម្ងាត់', () => {
    it('ឧបករណ៍ថ្មី ៖ checkbox នៅក្នុងប្រអប់ចូល ហើយធីករួច (អ្នកប្រើដកធីកបាន)', async () => {
        useBackend(FB, fakeFb().fb);
        step(() => { showLoginModalWithPrefill(); });
        await settle();
        const box = byId('rememberPasswordCheckbox') as HTMLInputElement;
        expect(box.type).toBe('checkbox');
        expect(box.checked).toBe(true);
        expect(box.closest('label')!.textContent).toContain('ចងចាំពាក្យសម្ងាត់');
    });

    it('ចូលជោគជ័យ ➜ រក្សាជាអក្សរកូដ (key មិនអាចនាំចេញ) · អក្សរធម្មតាមិនចូល localStorage/sessionStorage/IndexedDB', async () => {
        const { fb } = fakeFb();
        useBackend(FB, fb);
        await submitLogin('dara@shop.com', SECRET);
        const rec: any = idbRows.get(REMEMBERED_PASSWORD_ID);
        expect(rec).toBeTruthy();
        expect(rec.key.type).toBe('secret');
        expect(rec.key.extractable).toBe(false);
        expect(Object.keys(rec).sort()).toEqual(['data', 'iv', 'key']);
        expect(JSON.stringify(rec, (k, v) => (k === 'key' ? undefined : v))).not.toContain(SECRET);
        expect(new TextDecoder().decode(new Uint8Array(rec.data))).not.toContain(SECRET);
        expect(storageDump()).not.toContain(SECRET);
        expect(await rememberedPasswordFor('dara@shop.com', loginBackendScope())).toBe(SECRET);
    });

    it('ផុត ៤ ម៉ោង ➜ បំពេញឈ្មោះ + ពាក្យសម្ងាត់ · ⛔ មិនចូលដោយខ្លួនឯង', async () => {
        const { fb, signIns } = fakeFb();
        useBackend(FB, fb);
        await submitLogin('dara@shop.com', SECRET);
        expect(signIns.length).toBe(1);
        await reopenAfterExpiry();
        expect(fieldValue('loginEmailInput')).toBe('dara@shop.com');
        expect(fieldValue('loginPasswordInput')).toBe(SECRET);
        expect(fieldChecked('rememberPasswordCheckbox')).toBe(true);
        expect(signIns.length).toBe(1);
    });

    it('ដកធីក ➜ លុបពាក្យសម្ងាត់ភ្លាម · សម្អាតវាលដែលបំពេញ · ចងចាំជម្រើស · បើកវិញ ➜ មិនបំពេញ', async () => {
        const { fb } = fakeFb();
        useBackend(FB, fb);
        await submitLogin('dara@shop.com', SECRET);
        await reopenAfterExpiry();
        expect(fieldValue('loginPasswordInput')).toBe(SECRET);
        step(() => { byId('rememberPasswordCheckbox').click(); });
        await settle();
        expect(fieldChecked('rememberPasswordCheckbox')).toBe(false);
        expect(idbRows.has(REMEMBERED_PASSWORD_ID)).toBe(false);
        expect(fieldValue('loginPasswordInput')).toBe('');
        expect(appLocalStore!.getItem(REMEMBER_PASSWORD_PREF_KEY)).toBe('0');
        await reopenAfterExpiry();
        expect(fieldValue('loginPasswordInput')).toBe('');
        expect(fieldChecked('rememberPasswordCheckbox')).toBe(false);
        await submitLogin('dara@shop.com', SECRET);
        expect(idbRows.has(REMEMBERED_PASSWORD_ID)).toBe(false);
    });

    it('ធីកវិញ ➜ ចូលលើកក្រោយរក្សាម្តងទៀត', async () => {
        const { fb } = fakeFb();
        useBackend(FB, fb);
        appLocalStore!.setItem(REMEMBER_PASSWORD_PREF_KEY, '0');
        step(() => { showLoginModalWithPrefill(); });
        await settle();
        expect(fieldChecked('rememberPasswordCheckbox')).toBe(false);
        step(() => { byId('rememberPasswordCheckbox').click(); });
        expect(appLocalStore!.getItem(REMEMBER_PASSWORD_PREF_KEY)).toBe(null);
        await submitLogin('dara@shop.com', SECRET);
        expect(idbRows.has(REMEMBERED_PASSWORD_ID)).toBe(true);
    });

    it('ចាកចេញ (clearRememberedSession false) ➜ លុប · បើកប្រអប់ចូលវិញ ➜ ទទេ', async () => {
        const { fb } = fakeFb();
        useBackend(FB, fb);
        await submitLogin('dara@shop.com', SECRET);
        clearRememberedSession(false);
        step(() => { showLoginModalWithPrefill(); });
        await settle();
        expect(idbRows.has(REMEMBERED_PASSWORD_ID)).toBe(false);
        expect(fieldValue('loginPasswordInput')).toBe('');
    });

    it('ដក «ចងចាំគណនី» ➜ មិនរក្សាពាក្យសម្ងាត់ (និងលុបចាស់)', async () => {
        const { fb } = fakeFb();
        useBackend(FB, fb);
        await submitLogin('dara@shop.com', SECRET);
        await submitLogin('dara@shop.com', SECRET, { rememberMe: false, rememberPassword: true });
        expect(idbRows.has(REMEMBERED_PASSWORD_ID)).toBe(false);
    });

    it('ចូលមិនជោគជ័យ ➜ មិនរក្សាពាក្យសម្ងាត់ដែលខុស', async () => {
        const { fb } = fakeFb('reject');
        useBackend(FB, fb);
        const alerts: string[] = [];
        vi.stubGlobal('alert', (m: string) => { alerts.push(String(m)); });
        await submitLogin('dara@shop.com', 'wrong-pass-1');
        expect(alerts.length).toBe(1);
        expect(idbRows.has(REMEMBERED_PASSWORD_ID)).toBe(false);
    });

    it('ចងនឹង Project + ឈ្មោះគណនី ៖ Project ផ្សេង · ឈ្មោះផ្សេង ➜ មិនបំពេញ · កូដចម្លងទៅ scope ផ្សេងបកមិនចេញ', async () => {
        const { fb } = fakeFb();
        useBackend(FB, fb);
        await submitLogin('dara@shop.com', SECRET);
        const scopeA = loginBackendScope();
        expect(await rememberedPasswordFor('other@shop.com', scopeA)).toBe('');
        expect(await rememberedPasswordFor('DARA@shop.com ', scopeA)).toBe(SECRET);
        useBackend(FB_OTHER, fb);
        expect(await rememberedPasswordFor('dara@shop.com', loginBackendScope())).toBe('');
        await reopenAfterExpiry();
        expect(fieldValue('loginPasswordInput')).toBe('');
    });

    it('⛔ មិនសរសេរជាន់អ្វីដែលអ្នកប្រើវាយ មុនពេលបកកូដចប់', async () => {
        const { fb } = fakeFb();
        useBackend(FB, fb);
        await submitLogin('dara@shop.com', SECRET);
        clearRememberedSession(true);
        step(() => { showLoginModalWithPrefill(); });
        setFieldValue('loginPasswordInput', 'typed-by-user');
        await settle();
        expect(fieldValue('loginPasswordInput')).toBe('typed-by-user');
    });

    it('⛔ លុបខណៈកំពុងរក្សា ➜ គ្មានពាក្យសម្ងាត់រស់វិញ', async () => {
        useBackend(FB, fakeFb().fb);
        const scope = loginBackendScope();
        const saving = rememberLoginPassword('dara@shop.com', SECRET, scope);
        const forgetting = forgetLoginPassword();
        await Promise.all([saving, forgetting]);
        await settle();
        expect(idbRows.has(REMEMBERED_PASSWORD_ID)).toBe(false);
        expect(await rememberedPasswordFor('dara@shop.com', scope)).toBe('');
    });

    it('Supabase ៖ ប្តូរពាក្យសម្ងាត់ដោយកូដពីអ្នកលក់ជោគជ័យ ➜ លុបពាក្យសម្ងាត់ចាស់', async () => {
        const fb: any = Object.assign(fakeFb().fb, {
            __supabase: true,
            resetPassword: vi.fn(async () => ({ status: 200, body: { ok: true, code: 'password-reset' } }))
        });
        useBackend(SB, fb, 'supabase');
        await submitLogin('dara', SECRET);
        expect(idbRows.has(REMEMBERED_PASSWORD_ID)).toBe(true);
        step(() => { viewState.loginMode = 'reset'; });
        setFieldValue('resetUsernameInput', 'dara');
        setFieldValue('resetCodeInput', 'ABCD-EFGH-JKMN-PQRS-TVWX');
        setFieldValue('resetPasswordInput', 'new-secret-55');
        setFieldValue('resetPasswordConfirmInput', 'new-secret-55');
        await submitResetPasswordForm();
        await settle();
        expect(idbRows.has(REMEMBERED_PASSWORD_ID)).toBe(false);
        expect(fieldChecked('rememberPasswordCheckbox')).toBe(true);
    });

    it('គ្មាន IndexedDB (private mode) ➜ ចូលបានធម្មតា · មិនបំពេញ · មិនបោះ', async () => {
        idbOff = true;
        const { fb, signIns } = fakeFb();
        useBackend(FB, fb);
        await submitLogin('dara@shop.com', SECRET);
        expect(signIns.length).toBe(1);
        await reopenAfterExpiry();
        expect(fieldValue('loginPasswordInput')).toBe('');
        expect(storageDump()).not.toContain(SECRET);
    });
});
