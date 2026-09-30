/**
 * ⛔ Backend Supabase ក្នុង ZoeW ៖ Config · Setup Link · Modal ចូល/ចុះឈ្មោះ/ប្តូរពាក្យសម្ងាត់ · ការរំលង Activation Key · scope journal។
 * ⛔ Config ត្រូវ **fail closed** លើ Secret key (sb_secret_… · JWT service_role) — key នោះរំលង RLS ទាំងស្រុង ➜ ហាង ១ អានទិន្នន័យហាងទាំងអស់។
 * ⛔ Firebase mode ត្រូវនៅដដែល ៖ Modal ចូល (type=email · គ្មានតំណចុះឈ្មោះ) · License ឆ្លង ZoeLicense ដដែល · journal scope = databaseURL។
 * ⛔ ការចុះឈ្មោះ ៖ អ្វីដែលផ្ញើទៅ Edge Function ត្រូវជាទម្រង់ដែល `account-core.ts` ទទួល (invite · username តូច · password) ·
 *    ជោគជ័យ ➜ ចូលប្រព័ន្ធដោយ username ដដែលភ្លាម · បដិសេធ ➜ សារតាមកូដ (មិនចូល)។
 * ⛔ adapter ខ្លួនវា (semantics RTDB · បណ្តាញដាច់ · increment មិនស្ទួន) វាស់ដោយ `audit-tools/emu/supabase-adapter-parity-test.js`។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { decodeSetupPayload, firebaseConfigErrorMessage, normalizeFirebaseConfig } from '../src/features/config';
import { ACCOUNT_REPLY_TEXT, backToLoginForm, clearPendingInvite, openRegisterForm, openResetPasswordForm, rememberSetupInvite, submitRegisterForm, submitResetPasswordForm } from '../src/features/account';
import { ensureAppActivated } from '../src/features/license';
import { cleanupJournalScope } from '../src/domain/cleanup';
import { supabaseKeyIsSecret } from '../src/services/supabase-config';
import { LoginModal } from '../src/app/components/modals/LoginModal';
import { fieldValue, setFieldValue } from '../src/app/refs';
import { byId, mount, step, unmount } from './native/react-harness';

const GOOD = { supabaseUrl: 'https://abcd1234.supabase.co/', supabaseKey: 'sb_publishable_' + 'k'.repeat(24) };

function jwt(claims: object) {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(claims) + '.sig';
}

function errCode(fn: () => unknown): string {
    try { fn(); } catch (e: any) { return e.message; }
    return 'no-throw';
}

describe('Config Supabase', () => {
    it('ទទួល Config Supabase ត្រឹមត្រូវ ➜ URL គ្មាន / ចុង · វាលក្រៅបញ្ជីរាយជា extras', () => {
        const out = normalizeFirebaseConfig(JSON.stringify(Object.assign({ projectRef: 'x' }, GOOD)));
        expect(out.config).toEqual({ supabaseUrl: 'https://abcd1234.supabase.co', supabaseKey: GOOD.supabaseKey });
        expect(out.extras).toEqual(['projectRef']);
    });
    it('⛔ Secret key (sb_secret_ · JWT service_role) ➜ បដិសេធ + សារប្រាប់ឲ្យ Rotate', () => {
        const secret = Object.assign({}, GOOD, { supabaseKey: 'sb_secret_' + 'z'.repeat(30) });
        expect(errCode(() => normalizeFirebaseConfig(JSON.stringify(secret)))).toBe('SB_SECRET_KEY');
        const service = Object.assign({}, GOOD, { supabaseKey: jwt({ role: 'service_role', iss: 'supabase' }) });
        expect(errCode(() => normalizeFirebaseConfig(JSON.stringify(service)))).toBe('SB_SECRET_KEY');
        expect(firebaseConfigErrorMessage(new Error('SB_SECRET_KEY'))).toMatch(/Rotate/);
        expect(supabaseKeyIsSecret(jwt({ role: 'anon' }))).toBe(false);
    });
    it('URL ត្រូវជា https (ឬ http តែ localhost) គ្មាន path/query · loginDomain ត្រូវបញ្ចប់ដោយ .invalid', () => {
        for (const bad of ['http://abcd.supabase.co', 'https://abcd.supabase.co/rest/v1', 'https://abcd.supabase.co?x=1', 'ftp://abcd.supabase.co', 'not a url']) {
            expect(errCode(() => normalizeFirebaseConfig(JSON.stringify(Object.assign({}, GOOD, { supabaseUrl: bad }))))).toBe('SB_BAD_URL');
        }
        expect(normalizeFirebaseConfig(JSON.stringify(Object.assign({}, GOOD, { supabaseUrl: 'http://127.0.0.1:54321' }))).config.supabaseUrl).toBe('http://127.0.0.1:54321');
        expect(errCode(() => normalizeFirebaseConfig(JSON.stringify(Object.assign({}, GOOD, { loginDomain: 'zoew.com' }))))).toBe('SB_BAD_DOMAIN');
        expect(normalizeFirebaseConfig(JSON.stringify(Object.assign({}, GOOD, { loginDomain: 'Shop.ZoeW.invalid' }))).config.loginDomain).toBe('shop.zoew.invalid');
        const missing: any = (() => { try { normalizeFirebaseConfig(JSON.stringify({ supabaseUrl: GOOD.supabaseUrl })); } catch (e) { return e; } })();
        expect(missing.missing).toEqual(['supabaseKey']);
        expect(firebaseConfigErrorMessage(missing)).toMatch(/supabaseKey/);
    });
    it('ទិសផ្ទុយ ៖ Config Firebase នៅដូចមុន', () => {
        const out = normalizeFirebaseConfig('const firebaseConfig = { apiKey: "A", databaseURL: "https://x.firebaseio.com", projectId: "p" };');
        expect(out.config).toEqual({ apiKey: 'A', databaseURL: 'https://x.firebaseio.com', projectId: 'p' });
    });
    it('Setup Link ៖ ទទួល Config Supabase (+ invite) · បដិសេធពាក់កណ្តាល', () => {
        const enc = (o: object) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
        expect(decodeSetupPayload(enc(Object.assign({ invite: 'ABCD' }, GOOD))).invite).toBe('ABCD');
        expect(() => decodeSetupPayload(enc({ supabaseUrl: GOOD.supabaseUrl }))).toThrow();
        expect(() => decodeSetupPayload(enc({ apiKey: 'A' }))).toThrow();
    });
});

function fakeSupabaseFb() {
    const calls: any[] = [];
    const fb: any = {
        __supabase: true,
        browserLocalPersistence: { type: 'LOCAL' },
        browserSessionPersistence: { type: 'SESSION' },
        registerReply: { status: 200, body: { ok: true, code: 'registered' } },
        resetReply: { status: 200, body: { ok: true, code: 'password-reset' } },
        registerAccount: vi.fn(async (_app: any, body: any) => { calls.push(['register', body]); return fb.registerReply; }),
        resetPassword: vi.fn(async (_app: any, body: any) => { calls.push(['reset', body]); return fb.resetReply; }),
        setPersistence: vi.fn(async () => { calls.push(['persist']); }),
        signInWithEmailAndPassword: vi.fn(async (_auth: any, email: string, password: string) => { calls.push(['signIn', email, password]); return { user: null }; }),
        tenantScope: (auth: any) => (auth && auth._tenant) || ''
    };
    return { fb, calls };
}

async function settle() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
}

describe('Modal ចូល/ចុះឈ្មោះ/ប្តូរពាក្យសម្ងាត់', () => {
    let alerts: string[];
    beforeEach(() => {
        alerts = [];
        vi.stubGlobal('alert', (m: string) => { alerts.push(String(m)); });
        clearPendingInvite();
    });
    afterEach(() => {
        unmount();
        vi.unstubAllGlobals();
        step(() => { viewState.backendKind = 'firebase'; viewState.loginMode = 'login'; viewState.loginBusy = false; });
        firebaseState.fb = null;
        firebaseState.auth = null;
    });

    it('ទិសផ្ទុយ ៖ Firebase mode ➜ type=email · គ្មានតំណចុះឈ្មោះ', () => {
        mount(<LoginModal />);
        expect(byId('loginEmailInput').getAttribute('type')).toBe('email');
        expect(document.querySelector('.login-alt-links')).toBeNull();
        step(() => { viewState.loginMode = 'register'; });
        expect(document.getElementById('registerInviteInput')).toBeNull();
    });

    it('Supabase ៖ ចុះឈ្មោះ ➜ ផ្ញើ invite + username តូច ➜ ចូលប្រព័ន្ធដោយ username ដដែលភ្លាម', async () => {
        const { fb, calls } = fakeSupabaseFb();
        firebaseState.fb = fb;
        firebaseState.auth = { app: { name: 'x' }, currentUser: null };
        mount(<LoginModal />);
        step(() => { viewState.backendKind = 'supabase'; });
        expect(byId('loginEmailInput').getAttribute('type')).toBe('text');
        expect(document.querySelectorAll('.login-alt-btn').length).toBe(2);
        rememberSetupInvite('abcd-efgh-jkmn-pqrs-tvwx');
        step(() => { openRegisterForm(); });
        expect(fieldValue('registerInviteInput')).toBe('abcd-efgh-jkmn-pqrs-tvwx');
        setFieldValue('registerUsernameInput', ' Sok.Dara ');
        setFieldValue('registerPasswordInput', 'pass1234');
        setFieldValue('registerPasswordConfirmInput', 'pass1234');
        await submitRegisterForm();
        await settle();
        expect(calls[0]).toEqual(['register', { invite: 'abcd-efgh-jkmn-pqrs-tvwx', username: 'sok.dara', password: 'pass1234' }]);
        expect(calls.find((c) => c[0] === 'signIn')).toEqual(['signIn', 'sok.dara', 'pass1234']);
        expect(alerts).toEqual([]);
        expect(viewState.loginMode).toBe('login');
    });

    it('Supabase ៖ ការបដិសេធ ➜ សារតាមកូដ · មិនចូល · ពាក្យសម្ងាត់មិនដូចគ្នា ➜ មិនផ្ញើ', async () => {
        const { fb, calls } = fakeSupabaseFb();
        fb.registerReply = { status: 403, body: { ok: false, code: 'invite-invalid' } };
        firebaseState.fb = fb;
        firebaseState.auth = { app: {}, currentUser: null };
        mount(<LoginModal />);
        step(() => { viewState.backendKind = 'supabase'; openRegisterForm(); });
        setFieldValue('registerInviteInput', 'X');
        setFieldValue('registerUsernameInput', 'dara');
        setFieldValue('registerPasswordInput', 'pass1234');
        setFieldValue('registerPasswordConfirmInput', 'pass12345');
        await submitRegisterForm();
        expect(calls.length).toBe(0);
        expect(alerts[0]).toMatch(/មិនដូចគ្នា/);
        setFieldValue('registerPasswordConfirmInput', 'pass1234');
        await submitRegisterForm();
        await settle();
        expect(calls.map((c) => c[0])).toEqual(['register']);
        expect(alerts[1]).toContain(ACCOUNT_REPLY_TEXT['invite-invalid']);
        fb.registerAccount.mockImplementationOnce(async () => { throw new Error('Failed to fetch'); });
        await submitRegisterForm();
        expect(alerts[2]).toContain(ACCOUNT_REPLY_TEXT.network);
        expect(calls.some((c) => c[0] === 'signIn')).toBe(false);
    });

    it('Supabase ៖ ប្តូរពាក្យសម្ងាត់ ➜ ផ្ញើ username + resetCode ➜ ត្រឡប់ទៅ Modal ចូល ជាមួយ username', async () => {
        const { fb, calls } = fakeSupabaseFb();
        firebaseState.fb = fb;
        firebaseState.auth = { app: {}, currentUser: null };
        mount(<LoginModal />);
        step(() => { viewState.backendKind = 'supabase'; });
        setFieldValue('loginEmailInput', 'Dara');
        step(() => { openResetPasswordForm(); });
        expect(fieldValue('resetUsernameInput')).toBe('dara');
        setFieldValue('resetCodeInput', 'CODE-1');
        setFieldValue('resetPasswordInput', 'newpass99');
        setFieldValue('resetPasswordConfirmInput', 'newpass99');
        await submitResetPasswordForm();
        await settle();
        expect(calls[0]).toEqual(['reset', { username: 'dara', resetCode: 'CODE-1', password: 'newpass99' }]);
        expect(viewState.loginMode).toBe('login');
        step(() => {});
        expect(fieldValue('loginEmailInput')).toBe('dara');
        step(() => { openResetPasswordForm(); backToLoginForm(); });
        expect(viewState.loginMode).toBe('login');
    });
});

describe('License · journal scope', () => {
    afterEach(() => {
        viewState.backendKind = 'firebase';
        firebaseState.fb = null;
        firebaseState.auth = null;
        localStorage.clear();
    });
    it('Supabase ➜ ស្ថានភាពហាង (server) ជំនួស Activation Key ➜ មិនហៅ ZoeLicense', async () => {
        const getStatus = vi.fn(async () => ({ state: 'none' }));
        (window as any).ZoeLicense = { getStatus };
        viewState.backendKind = 'supabase';
        expect(await ensureAppActivated()).toBe(true);
        expect(getStatus).not.toHaveBeenCalled();
    });
    it('journal scope ៖ Firebase = databaseURL · Supabase = URL + tenant (ហាង ២ លើឧបករណ៍ដដែលមិនលាយគ្នា) · មិនស្គាល់ tenant ➜ ទទេ', () => {
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'A', databaseURL: 'https://x.firebaseio.com' }));
        expect(cleanupJournalScope()).toBe('https://x.firebaseio.com');
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: 'https://abcd.supabase.co', supabaseKey: 'sb_publishable_x' }));
        const { fb } = fakeSupabaseFb();
        firebaseState.fb = fb;
        firebaseState.auth = { _tenant: 'tenant-a' };
        expect(cleanupJournalScope()).toBe('https://abcd.supabase.co#tenant-a');
        firebaseState.auth = { _tenant: 'tenant-b' };
        expect(cleanupJournalScope()).toBe('https://abcd.supabase.co#tenant-b');
        firebaseState.auth = {};
        expect(cleanupJournalScope()).toBe('');
    });
});
