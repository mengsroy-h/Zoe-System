import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fields, login, forget, toast } = vi.hoisted(() => ({
    fields: {} as Record<string, string>, login: vi.fn(), forget: vi.fn(), toast: vi.fn()
}));
vi.mock('../src/app/refs', () => ({
    fieldValue: (key: string) => fields[key] || '',
    setFieldValue: (key: string, value: string) => { fields[key] = value; }, focusField: vi.fn()
}));
vi.mock('../src/app/flush', () => ({ commitNow: vi.fn() }));
vi.mock('../src/features/auth', () => ({ performLogin: login }));
vi.mock('../src/features/password-memory', () => ({ forgetLoginPassword: forget, syncRememberPasswordBox: vi.fn() }));
vi.mock('../src/ui/toast', () => ({ showToast: toast }));

import { firebaseState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { submitRegisterForm, submitResetPasswordForm } from '../src/features/account';

function deferred() {
    let resolve!: (value: any) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
    for (const key of Object.keys(fields)) delete fields[key];
    Object.assign(fields, {
        registerInviteInput: 'invalid-for-local-digest', registerUsernameInput: 'olduser',
        registerPasswordInput: 'password123', registerPasswordConfirmInput: 'password123',
        resetUsernameInput: 'olduser', resetCodeInput: 'old-code',
        resetPasswordInput: 'password123', resetPasswordConfirmInput: 'password123'
    });
    firebaseState.authGeneration++;
    firebaseState.firebaseConfig = { supabaseUrl: 'https://a.supabase.co' };
    firebaseState.auth = { app: {}, currentUser: null } as any;
    viewState.loginBusy = false;
});
afterEach(() => { vi.unstubAllGlobals(); });

for (const flow of [
    { name: 'ចុះឈ្មោះ', run: submitRegisterForm, method: 'registerAccount' },
    { name: 'ប្តូរពាក្យសម្ងាត់', run: submitResetPasswordForm, method: 'resetPassword' }
]) {
    describe(flow.name + ' ៖ ម្ចាស់សំណើ', () => {
        for (const outcome of ['success', 'failure', 'reject']) {
            for (const change of ['generation', 'auth', 'backend', 'scope']) {
                it('សំណើចាស់ ' + outcome + ' មិនប៉ះសម័យថ្មី ' + change, async () => {
                    const pending = deferred();
                    const request = vi.fn(() => pending.promise);
                    firebaseState.fb = { __supabase: true, [flow.method]: request } as any;
                    const work = flow.run();
                    expect(request).toHaveBeenCalledOnce();
                    expect(viewState.loginBusy).toBe(true);
                    if (change === 'generation') firebaseState.authGeneration++;
                    if (change === 'auth') firebaseState.auth = { app: {}, currentUser: null } as any;
                    if (change === 'backend') firebaseState.fb = { __supabase: true } as any;
                    if (change === 'scope') firebaseState.firebaseConfig = { supabaseUrl: 'https://b.supabase.co' };
                    viewState.loginMode = 'register';
                    fields.loginEmailInput = 'newuser';
                    fields.resetCodeInput = 'new-code';
                    const expectedFields = { ...fields };
                    if (outcome === 'reject') pending.reject(new Error('network'));
                    else pending.resolve({ body: { ok: outcome === 'success', code: 'account-invalid' } });
                    await work;
                    expect(viewState.loginBusy).toBe(true);
                    expect(viewState.loginMode).toBe('register');
                    expect(fields).toEqual(expectedFields);
                    expect(login).not.toHaveBeenCalled();
                    expect(forget).not.toHaveBeenCalled();
                    expect(toast).not.toHaveBeenCalled();
                    expect(alert).not.toHaveBeenCalled();
                });
            }
            it('សំណើបច្ចុប្បន្ន ' + outcome + ' បញ្ចប់ត្រឹមត្រូវ', async () => {
                const pending = deferred();
                firebaseState.fb = { __supabase: true, [flow.method]: () => pending.promise } as any;
                const work = flow.run();
                if (outcome === 'reject') pending.reject(new Error('network'));
                else pending.resolve({ body: { ok: outcome === 'success', code: 'account-invalid' } });
                await work;
                expect(viewState.loginBusy).toBe(false);
                if (outcome === 'success') {
                    expect(toast).toHaveBeenCalledOnce();
                    expect(flow.method === 'registerAccount' ? login : forget).toHaveBeenCalledOnce();
                } else expect(alert).toHaveBeenCalledOnce();
            });
        }
        it('សំណើទីមួយមិនដោះ busy របស់សំណើទីពីរ', async () => {
            const first = deferred(), second = deferred();
            const request = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
            firebaseState.fb = { __supabase: true, [flow.method]: request } as any;
            const workA = flow.run();
            viewState.loginBusy = false;
            const workB = flow.run();
            expect(request).toHaveBeenCalledTimes(2);
            first.resolve({ body: { ok: true } });
            await workA;
            expect(viewState.loginBusy).toBe(true);
            expect(toast).not.toHaveBeenCalled();
            second.resolve({ body: { ok: false, code: 'account-invalid' } });
            await workB;
            expect(viewState.loginBusy).toBe(false);
            expect(alert).toHaveBeenCalledOnce();
        });
    });
}

for (const ok of [true, false]) {
    it('ចុះឈ្មោះ ៖ ប្តូរសម័យពេលចងចាំកូដអញ្ជើញ ' + ok, async () => {
        fields.registerInviteInput = '23456789ABCDEFGHJKMN';
        const hashing = deferred();
        const digest = vi.fn(() => hashing.promise);
        vi.stubGlobal('crypto', { subtle: { digest } });
        firebaseState.fb = { __supabase: true, registerAccount: async () => ({ body: { ok, code: 'invite-invalid' } }) } as any;
        const work = submitRegisterForm();
        for (let i = 0; i < 6; i++) await Promise.resolve();
        expect(digest).toHaveBeenCalledOnce();
        firebaseState.authGeneration++;
        viewState.loginBusy = true;
        viewState.loginMode = 'reset';
        const expectedFields = { ...fields };
        hashing.resolve(new Uint8Array(32).buffer);
        await work;
        expect(viewState.loginBusy).toBe(true);
        expect(viewState.loginMode).toBe('reset');
        expect(fields).toEqual(expectedFields);
        expect(login).not.toHaveBeenCalled();
        expect(toast).not.toHaveBeenCalled();
        expect(alert).not.toHaveBeenCalled();
    });
}
