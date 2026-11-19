import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { ACCOUNT_REPLY_TEXT, submitRegisterForm, submitResetPasswordForm } from '../../../../ZoeW/src/features/account';
import { createSupabaseTransport } from '../../../../ZoeW/src/services/supabase-transport';
import { setPartialBackendFixtureValue } from './helpers/backend-fixture';

const fields = vi.hoisted(() => ({
    registerInviteInput: 'ABCDEFGHJKMNPQRSTVWX', registerUsernameInput: 'fixture',
    registerPasswordInput: 'testPassword123', registerPasswordConfirmInput: 'testPassword123',
    resetUsernameInput: 'fixture', resetCodeInput: 'ABCDEFGHJKMNPQRSTVWX',
    resetPasswordInput: 'testPassword123', resetPasswordConfirmInput: 'testPassword123'
}));
vi.mock('../../../../ZoeW/src/app/refs', () => ({
    fieldValue: (key: keyof typeof fields) => fields[key] || '', setFieldValue: vi.fn(), focusField: vi.fn()
}));
vi.mock('../../../../ZoeW/src/app/flush', () => ({ commitNow: vi.fn() }));
vi.mock('../../../../ZoeW/src/features/auth', () => ({ performLogin: vi.fn() }));
vi.mock('../../../../ZoeW/src/features/password-memory', () => ({ forgetLoginPassword: vi.fn(), syncRememberPasswordBox: vi.fn() }));
vi.mock('../../../../ZoeW/src/ui/toast', () => ({ showToast: vi.fn() }));

let transport: ReturnType<typeof createSupabaseTransport>;
const config = { supabaseUrl: 'https://audit-fixture.invalid', supabaseKey: 'sb_publishable_synthetic' };
beforeEach(() => {
    vi.stubGlobal('alert', vi.fn());
    firebaseState.authGeneration++;
    setPartialBackendFixtureValue(firebaseState, 'auth', { app: {}, currentUser: null });
    firebaseState.firebaseConfig = config;
    viewState.loginBusy = false;
    localStorage.clear();
    sessionStorage.clear();
});
afterEach(() => { transport?.close(); vi.unstubAllGlobals(); });

function attach(method: string, name: string, reply: () => unknown) {
    const fetch = vi.fn(async (url: string) => {
        expect(url).toBe(config.supabaseUrl + '/functions/v1/' + name);
        return reply();
    });
    transport = createSupabaseTransport(config, { fetch });
    setPartialBackendFixtureValue(firebaseState, 'fb', { __supabase: true, [method]: (_app, body) => transport.callFunction(name, body) });
    return fetch;
}

for (const [method, name, submit, unknownCode] of [
    ['registerAccount', 'register', submitRegisterForm, 'registration-unknown'],
    ['resetPassword', 'reset-password', submitResetPasswordForm, 'password-reset-unknown']
] as const) {
    for (const [label, reply] of [
        ['HTTP 200 · body read error', () => ({ status: 200, ok: true, text: () => Promise.reject(new TypeError('response stream closed')) })],
        ['HTTP 200 · truncated JSON', () => new Response('{"ok":tr', { status: 200 })],
        ['HTTP 504 · proxy HTML', () => new Response('<h1>Gateway timeout</h1>', { status: 504 })],
        ['Fetch rejected · no receipt', () => Promise.reject(new TypeError('Failed to fetch'))]
    ] as const) {
        it(name + ' ៖ មិនទាន់ដឹងលទ្ធផល · ' + label, async () => {
            const fetch = attach(method, name, reply);
            await submit();
            expect(fetch).toHaveBeenCalledOnce();
            expect(alert).toHaveBeenCalledExactlyOnceWith(ACCOUNT_REPLY_TEXT[unknownCode]);
        });
    }
    for (const [label, body] of [
        ['text/plain', 'Too many requests'], ['JSON', '{"code":"too_many_requests"}']
    ] as const) {
        it(name + ' ៖ ណែនាំឲ្យសាកពេលក្រោយ · HTTP 429 ' + label, async () => {
            const fetch = attach(method, name, () => new Response(body, { status: 429 }));
            await submit();
            expect(fetch).toHaveBeenCalledOnce();
            expect(vi.mocked(alert).mock.calls[0]?.[0]).toContain(ACCOUNT_REPLY_TEXT.busy);
        });
    }
    it(name + ' ៖ រក្សាសារបដិសេធដែលមានភស្តុតាង', async () => {
        const fetch = attach(method, name, () => new Response('{"ok":false,"code":"password-weak"}', { status: 400 }));
        await submit();
        expect(fetch).toHaveBeenCalledOnce();
        expect(vi.mocked(alert).mock.calls[0]?.[0]).toContain(ACCOUNT_REPLY_TEXT['password-weak']);
    });
}
