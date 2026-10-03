/**
 * ⛔ Config ➜ ចូលប្រព័ន្ធ ➜ ចុះឈ្មោះ «ឆ្លាតវៃ» (សំណើម្ចាស់គម្រោង) ៖
 *    (១) Setup Link ដែលមានកូដអញ្ជើញ **ប្រើរួច/ផុត** (Reconfig លើឧបករណ៍ដដែល ឬ QR ដដែលលើទូរស័ព្ទទី ២) ➜ ប្រអប់ **ចូលប្រព័ន្ធ** មិនមែនចុះឈ្មោះ ៖
 *        ការចងចាំក្នុងឧបករណ៍ (hash កូដ · តាម Project) ឬសាលក្រម server (`register` + `check: true` ➜ មិនបង្កើតគណនី មិនស៊ីកូដ)។
 *        កូដនៅប្រើបាន ➜ ចុះឈ្មោះ · server មិនស្គាល់ `check` (Function ចាស់) ➜ ចុះឈ្មោះ (ដូចមុន) · មិនដឹង + ឧបករណ៍ធ្លាប់ចូល Project នេះ ➜ ចូលប្រព័ន្ធ។
 *        ⛔ មិនប្តូរទម្រង់ពីក្រោមអ្នកប្រើ (វាយពាក្យសម្ងាត់រួច · ចូលរួច · Config ប្តូរ) · កូដរបស់ Project ផ្សេង ➜ បោះចោល · កូដដើមមិនចូល storage។
 *    (២) ការចងចាំគណនីចងនឹង **backend + Project** ៖ អ៊ីមែល Firebase មិនបំពេញលើ Supabase (និងផ្ទុយមកវិញ) · ធាតុចាស់គ្មាន scope ➜ សម្រេចតាមទម្រង់។
 *    (៣) session Supabase ក្នុង storage ចងនឹង URL Project ➜ Project ផ្សេងមិនស្តារ session របស់ Project ចាស់។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { fieldValue, setFieldValue } from '../src/app/refs';
import { LoginModal } from '../src/app/components/modals/LoginModal';
import {
    INVITE_UNVERIFIED_TOAST, INVITE_USED_TOAST, USED_INVITES_KEY, clearPendingInvite, hasPendingInvite, inviteKnownUsed,
    noteInviteUsed, readUsedInvites, rememberSetupInvite, routePendingInvite, submitRegisterForm
} from '../src/features/account';
import { REMEMBERED_LOGIN_KEY, REMEMBERED_LOGIN_SCOPE_KEY, loginBackendScope, rememberLogin, rememberedLoginFor } from '../src/features/login-memory';
import { clearRememberedSession, showLoginModalWithPrefill } from '../src/features/session';
import { performLogin } from '../src/features/auth';
import { SB_ACCOUNT_STORAGE_KEY, SB_AUTH_OWNER_KEY, SB_AUTH_STORAGE_KEY, claimSessionStorageFor, createModeStorage } from '../src/services/supabase-transport';
import { mount, step, unmount } from './native/react-harness';
import { settleAsync, trackCryptoSubtle } from './async-settle';

const SB_URL = 'https://abcd1234.supabase.co';
const SB = { supabaseUrl: SB_URL, supabaseKey: 'sb_publishable_' + 'k'.repeat(24) };
const FB = { apiKey: 'A', databaseURL: 'https://shop-a.firebaseio.com', projectId: 'p' };
const INVITE = 'abcd-efgh-jkmn-pqrs-tvwx';
const toastTexts = () => uiState.toasts.map((t: any) => t.msg);

function fakeSupabaseFb(checkCode: string | (() => Promise<any>)) {
    const calls: any[] = [];
    const fb: any = {
        __supabase: true,
        browserLocalPersistence: { type: 'LOCAL' },
        browserSessionPersistence: { type: 'SESSION' },
        registerAccount: vi.fn(async (_app: any, body: any) => {
            calls.push(['register', body]);
            if (body.check === true) {
                if (typeof checkCode === 'function') return checkCode();
                return { status: checkCode === 'invite-usable' ? 200 : 403, body: { ok: checkCode === 'invite-usable', code: checkCode } };
            }
            return { status: 200, body: { ok: true, code: 'registered' } };
        }),
        setPersistence: vi.fn(async () => {}),
        signInWithEmailAndPassword: vi.fn(async (_a: any, email: string) => { calls.push(['signIn', email]); return { user: null }; })
    };
    return { fb, calls };
}

trackCryptoSubtle();

async function settle() {
    await settleAsync(4);
}

function useBackend(kind: 'supabase' | 'firebase', fb?: any) {
    firebaseState.firebaseConfig = kind === 'supabase' ? Object.assign({}, SB) : Object.assign({}, FB);
    firebaseState.fb = fb || null;
    firebaseState.auth = { app: { name: 'x' }, currentUser: null } as any;
    step(() => { viewState.backendKind = kind; });
}

beforeEach(() => {
    if (appLocalStore) appLocalStore.clear();
    clearPendingInvite();
    uiState.toasts = [];
    mount(<LoginModal />);
});

afterEach(() => {
    unmount();
    step(() => { viewState.backendKind = 'firebase'; viewState.loginMode = 'login'; viewState.loginBusy = false; });
    firebaseState.fb = null;
    firebaseState.auth = null;
    firebaseState.firebaseConfig = null;
    clearPendingInvite();
});

describe('កូដអញ្ជើញ ➜ ចូលប្រព័ន្ធ ឬ ចុះឈ្មោះ', () => {
    it('server ៖ កូដប្រើរួច/ផុត ➜ ប្រអប់ចូលប្រព័ន្ធ (មិនមែនចុះឈ្មោះ) · កត់ hash ក្នុងឧបករណ៍ · ⛔ មិនបង្កើតគណនី', async () => {
        const { fb, calls } = fakeSupabaseFb('invite-invalid');
        useBackend('supabase', fb);
        rememberSetupInvite(INVITE, SB_URL + '/');
        step(() => { showLoginModalWithPrefill(); });
        await settle();
        expect(viewState.loginMode).toBe('login');
        expect(calls).toEqual([['register', { invite: INVITE, check: true }]]);
        expect(hasPendingInvite()).toBe(false);
        expect(toastTexts()).toContain(INVITE_USED_TOAST);
        expect(await inviteKnownUsed(INVITE, SB_URL)).toBe(true);
        expect(String(appLocalStore.getItem(USED_INVITES_KEY))).not.toContain('ABCD');
    });

    it('ការចងចាំក្នុងឧបករណ៍ ៖ កូដដែលចុះឈ្មោះរួចលើឧបករណ៍នេះ ➜ ចូលប្រព័ន្ធភ្លាម (មិនសួរ server · ដើរក្រៅបណ្តាញ)', async () => {
        const { fb, calls } = fakeSupabaseFb('invite-usable');
        useBackend('supabase', fb);
        await noteInviteUsed(INVITE.toUpperCase().replace(/-/g, ' '), SB_URL);
        rememberSetupInvite(INVITE, SB_URL);
        step(() => { showLoginModalWithPrefill(); });
        await settle();
        expect(viewState.loginMode).toBe('login');
        expect(calls).toEqual([]);
        expect(toastTexts()).toContain(INVITE_USED_TOAST);
    });

    it('ទិសផ្ទុយ ៖ កូដនៅប្រើបាន ➜ ចុះឈ្មោះ (បំពេញកូដស្រាប់)', async () => {
        const { fb } = fakeSupabaseFb('invite-usable');
        useBackend('supabase', fb);
        rememberSetupInvite(INVITE, SB_URL);
        step(() => { showLoginModalWithPrefill(); });
        await settle();
        expect(viewState.loginMode).toBe('register');
        expect(fieldValue('registerInviteInput')).toBe(INVITE);
        expect(toastTexts()).not.toContain(INVITE_USED_TOAST);
    });

    it('Function ចាស់ (មិនស្គាល់ check ➜ username-invalid) · ឧបករណ៍ថ្មី ➜ ចុះឈ្មោះ (ឥរិយាបថដើម)', async () => {
        const { fb } = fakeSupabaseFb('username-invalid');
        useBackend('supabase', fb);
        rememberSetupInvite(INVITE, SB_URL);
        step(() => { showLoginModalWithPrefill(); });
        await settle();
        expect(viewState.loginMode).toBe('register');
    });

    it('server មិនដឹង + ឧបករណ៍ធ្លាប់ចូល Project នេះ ➜ នៅប្រអប់ចូលប្រព័ន្ធ + សារណែនាំ (កូដនៅចាំសម្រាប់ប៊ូតុងចុះឈ្មោះ)', async () => {
        const { fb } = fakeSupabaseFb(async () => { throw new Error('Failed to fetch'); });
        useBackend('supabase', fb);
        rememberLogin('dara', loginBackendScope());
        rememberSetupInvite(INVITE, SB_URL);
        step(() => { showLoginModalWithPrefill(); });
        await settle();
        expect(viewState.loginMode).toBe('login');
        expect(fieldValue('loginEmailInput')).toBe('dara');
        expect(toastTexts()).toContain(INVITE_UNVERIFIED_TOAST);
        expect(hasPendingInvite()).toBe(true);
    });

    it('⛔ មិនប្តូរទម្រង់ពីក្រោមអ្នកប្រើ ៖ វាយពាក្យសម្ងាត់រួច ➜ នៅប្រអប់ចូលប្រព័ន្ធ', async () => {
        let release: (v: any) => void = () => {};
        const { fb } = fakeSupabaseFb(() => new Promise((r) => { release = r; }));
        useBackend('supabase', fb);
        rememberSetupInvite(INVITE, SB_URL);
        step(() => { showLoginModalWithPrefill(); });
        await settle();
        setFieldValue('loginPasswordInput', 'typing123');
        release({ status: 200, body: { ok: true, code: 'invite-usable' } });
        await settle();
        expect(viewState.loginMode).toBe('login');
        expect(hasPendingInvite()).toBe(true);
    });

    it('⛔ ចូលប្រព័ន្ធរួចខណៈកំពុងពិនិត្យ ➜ មិនបើកចុះឈ្មោះ · ចូលជោគជ័យ ➜ បោះកូដចោល', async () => {
        let release: (v: any) => void = () => {};
        const { fb } = fakeSupabaseFb(() => new Promise((r) => { release = r; }));
        useBackend('supabase', fb);
        rememberSetupInvite(INVITE, SB_URL);
        step(() => { showLoginModalWithPrefill(); });
        await settle();
        (firebaseState.auth as any).currentUser = { uid: 'u1' };
        firebaseState.authGeneration++;
        release({ status: 200, body: { ok: true, code: 'invite-usable' } });
        await settle();
        expect(viewState.loginMode).toBe('login');
        (firebaseState.auth as any).currentUser = null;
        performLogin('dara', 'pass1234', true);
        await settle();
        expect(hasPendingInvite()).toBe(false);
    });

    it('⛔ កូដរបស់ Project ផ្សេង (Config ប្តូរ) ➜ បោះចោល មិនសួរ server', async () => {
        const { fb, calls } = fakeSupabaseFb('invite-usable');
        useBackend('supabase', fb);
        rememberSetupInvite(INVITE, 'https://other9999.supabase.co');
        expect(await routePendingInvite()).toBe('other-project');
        expect(calls).toEqual([]);
        expect(hasPendingInvite()).toBe(false);
    });

    it('ចុះឈ្មោះជោគជ័យ ➜ កូដចុះក្នុងឧបករណ៍ ➜ Reconfig ដោយ Link ដដែល ➜ ចូលប្រព័ន្ធ (មិនសួរ server)', async () => {
        const { fb, calls } = fakeSupabaseFb('invite-usable');
        useBackend('supabase', fb);
        rememberSetupInvite(INVITE, SB_URL);
        step(() => { showLoginModalWithPrefill(); });
        await settle();
        expect(viewState.loginMode).toBe('register');
        setFieldValue('registerUsernameInput', 'dara');
        setFieldValue('registerPasswordInput', 'pass1234');
        setFieldValue('registerPasswordConfirmInput', 'pass1234');
        await submitRegisterForm();
        await settle();
        expect(readUsedInvites().length).toBe(1);
        calls.length = 0;
        rememberSetupInvite(INVITE, SB_URL);
        step(() => { showLoginModalWithPrefill(); });
        await settle();
        expect(viewState.loginMode).toBe('login');
        expect(calls.filter((c) => c[1] && c[1].check)).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ Firebase ➜ មិនសួរកូដអញ្ជើញ', async () => {
        const { fb, calls } = fakeSupabaseFb('invite-usable');
        useBackend('firebase', fb);
        rememberSetupInvite(INVITE, SB_URL);
        expect(await routePendingInvite()).toBe('none');
        expect(calls).toEqual([]);
    });
});

describe('ការចងចាំគណនីតាម backend + Project', () => {
    it('អ៊ីមែល Firebase មិនបំពេញលើ Supabase · ត្រឡប់ទៅ Firebase ➜ បំពេញវិញ', () => {
        useBackend('firebase');
        rememberLogin('owner@zoew881859.com');
        expect(rememberedLoginFor()).toBe('owner@zoew881859.com');
        useBackend('supabase');
        expect(rememberedLoginFor()).toBe('');
        step(() => { showLoginModalWithPrefill(); });
        expect(fieldValue('loginEmailInput')).toBe('');
        useBackend('firebase');
        step(() => { showLoginModalWithPrefill(); });
        expect(fieldValue('loginEmailInput')).toBe('owner@zoew881859.com');
    });

    it('Project Firebase ផ្សេង ➜ មិនបំពេញអ៊ីមែលរបស់ Project ចាស់', () => {
        useBackend('firebase');
        rememberLogin('owner@zoew881859.com');
        firebaseState.firebaseConfig = Object.assign({}, FB, { databaseURL: 'https://shop-b.firebaseio.com' });
        expect(rememberedLoginFor()).toBe('');
    });

    it('ធាតុចាស់ (គ្មាន scope) ➜ សម្រេចតាមទម្រង់ ៖ អ៊ីមែល ➜ Firebase · ឈ្មោះគណនី ➜ Supabase', () => {
        appLocalStore.setItem(REMEMBERED_LOGIN_KEY, 'owner@zoew1.com');
        useBackend('firebase');
        expect(rememberedLoginFor()).toBe('owner@zoew1.com');
        useBackend('supabase');
        expect(rememberedLoginFor()).toBe('');
        appLocalStore.setItem(REMEMBERED_LOGIN_KEY, 'dara');
        expect(rememberedLoginFor()).toBe('dara');
        useBackend('firebase');
        expect(rememberedLoginFor()).toBe('');
    });

    it('ចាកចេញ (មិនរក្សាគណនី) ➜ លុបទាំងតម្លៃ ទាំង scope', () => {
        useBackend('supabase');
        rememberLogin('dara');
        expect(appLocalStore.getItem(REMEMBERED_LOGIN_SCOPE_KEY)).toBe('sb:' + SB_URL);
        clearRememberedSession(false);
        expect(appLocalStore.getItem(REMEMBERED_LOGIN_KEY)).toBe(null);
        expect(appLocalStore.getItem(REMEMBERED_LOGIN_SCOPE_KEY)).toBe(null);
    });
});

describe('session Supabase ក្នុង storage ចងនឹង Project', () => {
    function stores() {
        const mk = () => { const m = new Map<string, string>(); return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)); }, removeItem: (k: string) => { m.delete(k); }, m }; };
        const local = mk();
        const session = mk();
        return { local, session, storage: createModeStorage(local, session) };
    }
    it('Project ផ្សេង ➜ លុប session + ព័ត៌មានហាងរបស់ Project ចាស់ មុនផ្ទុក', () => {
        const s = stores();
        s.local.setItem(SB_AUTH_OWNER_KEY, 'https://old0000.supabase.co');
        s.local.setItem(SB_AUTH_STORAGE_KEY, '{"access_token":"old"}');
        s.local.setItem(SB_AUTH_STORAGE_KEY + '-user', '{}');
        s.local.setItem(SB_ACCOUNT_STORAGE_KEY, '{"uid":"u"}');
        expect(claimSessionStorageFor(s.storage, SB_URL)).toBe(false);
        expect(s.storage.getItem(SB_AUTH_STORAGE_KEY)).toBe(null);
        expect(s.storage.getItem(SB_AUTH_STORAGE_KEY + '-user')).toBe(null);
        expect(s.storage.getItem(SB_ACCOUNT_STORAGE_KEY)).toBe(null);
        expect(s.storage.getItem(SB_AUTH_OWNER_KEY)).toBe(SB_URL);
    });
    it('ទិសផ្ទុយ ៖ Project ដដែល ឬធាតុចាស់គ្មានម្ចាស់ ➜ រក្សា session (មិនបង្ខំចូលប្រព័ន្ធម្តងទៀត)', () => {
        const s = stores();
        s.local.setItem(SB_AUTH_STORAGE_KEY, '{"access_token":"keep"}');
        expect(claimSessionStorageFor(s.storage, SB_URL)).toBe(true);
        expect(s.storage.getItem(SB_AUTH_STORAGE_KEY)).toBe('{"access_token":"keep"}');
        expect(s.storage.getItem(SB_AUTH_OWNER_KEY)).toBe(SB_URL);
        expect(claimSessionStorageFor(s.storage, SB_URL)).toBe(true);
        expect(s.storage.getItem(SB_AUTH_STORAGE_KEY)).toBe('{"access_token":"keep"}');
    });
});
