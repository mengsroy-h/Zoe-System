/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ ប្រអប់ចូលប្រព័ន្ធគ្រប់កន្លែង (ឈ្មោះគណនី · អ៊ីមែល · ពាក្យសម្ងាត់) ត្រូវឲ្យ Google Password Manager និង iOS Passwords
 *    ស្គាល់ ៖ ពាក្យសម្ងាត់នីមួយៗ (`current-password` · `new-password`) នៅក្នុង `<form>` ដែលមានប៊ូតុង submit · មុនវាក្នុង form ដដែលមានប្រអប់
 *    `autocomplete="username"` · ប្រអប់ទាំងនោះមាន `name` (Safari/iOS ប្រើ name ពេល autocomplete ខ្វះ ឬមិនច្បាស់) · ការបញ្ជាក់ពាក្យសម្ងាត់ = `new-password`។
 *    វាស់លើ `LoginModal` ពិតក្នុងរបៀបទាំង ៣ (ចូល · ចុះឈ្មោះ · ប្តូរពាក្យសម្ងាត់) និង backend ទាំង ២។
 * ⛔ ទិសផ្ទុយ ៖ កូដអញ្ជើញមិនមែនជាឈ្មោះគណនី (`autocomplete="off"` ➜ password manager មិនរក្សាវាជា username)។
 */
import { afterEach, describe, expect, it } from 'vitest';
import { uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { LoginModal } from '../src/app/components/modals/LoginModal';
import { mount, step, unmount } from './native/react-harness';

afterEach(() => { unmount(); document.body.innerHTML = ''; });

function render(backend: 'firebase' | 'supabase', mode: 'login' | 'register' | 'reset') {
    step(() => {
        uiState.modalDisplay = { loginModal: 'flex' } as any;
        viewState.backendKind = backend as any;
        viewState.loginMode = mode as any;
        viewState.loginBusy = false;
    });
    mount(<LoginModal />);
}

function credentialProblems() {
    const out: string[] = [];
    const pw = Array.from(document.querySelectorAll('#loginModal input[type="password"]')) as HTMLInputElement[];
    if (!pw.length) out.push('គ្មានប្រអប់ពាក្យសម្ងាត់');
    for (const p of pw) {
        const ac = p.getAttribute('autocomplete') || '';
        if (ac !== 'current-password' && ac !== 'new-password') out.push(p.id + ' autocomplete=' + ac);
        if (!p.getAttribute('name')) out.push(p.id + ' គ្មាន name');
        const form = p.closest('form');
        if (!form) { out.push(p.id + ' មិននៅក្នុង form'); continue; }
        if (!form.querySelector('button[type="submit"]')) out.push(p.id + ' form គ្មានប៊ូតុង submit');
        const fields = Array.from(form.querySelectorAll('input')) as HTMLInputElement[];
        const user = fields.slice(0, fields.indexOf(p)).find((f) => f.getAttribute('autocomplete') === 'username');
        if (!user) out.push(p.id + ' គ្មានប្រអប់ username មុនវា');
        else if (!user.getAttribute('name')) out.push(user.id + ' គ្មាន name');
    }
    return out;
}

describe('ប្រអប់ចូលប្រព័ន្ធ ↔ Google Password Manager · iOS Passwords', () => {
    it('ជាន់អប្បបរមា ៖ របៀបទាំង ៣ គូរប្រអប់ពាក្យសម្ងាត់ពិត', () => {
        render('supabase', 'login');
        expect(document.querySelectorAll('#loginModal input[type="password"]').length).toBe(1);
        unmount();
        render('supabase', 'register');
        expect(document.querySelectorAll('#loginModal input[type="password"]').length).toBe(2);
        unmount();
        render('supabase', 'reset');
        expect(document.querySelectorAll('#loginModal input[type="password"]').length).toBe(2);
    });

    for (const [backend, mode] of [['firebase', 'login'], ['supabase', 'login'], ['supabase', 'register'], ['supabase', 'reset']] as const) {
        it('⛔ ' + backend + ' · ' + mode + ' ៖ ពាក្យសម្ងាត់ក្នុង form + username មុនវា + name + autocomplete ត្រឹមត្រូវ', () => {
            render(backend, mode);
            expect(credentialProblems()).toEqual([]);
        });
    }

    it('⛔ ចូលប្រព័ន្ធ ៖ username = name="username" · ពាក្យសម្ងាត់ = current-password · ចុះឈ្មោះ/ប្តូរ ៖ ថ្មី + បញ្ជាក់ = new-password', () => {
        render('supabase', 'login');
        expect(document.getElementById('loginEmailInput')!.getAttribute('name')).toBe('username');
        expect(document.getElementById('loginPasswordInput')!.getAttribute('autocomplete')).toBe('current-password');
        unmount();
        render('supabase', 'register');
        expect(document.getElementById('registerPasswordInput')!.getAttribute('autocomplete')).toBe('new-password');
        expect(document.getElementById('registerPasswordConfirmInput')!.getAttribute('autocomplete')).toBe('new-password');
    });

    it('ទិសផ្ទុយ ៖ កូដអញ្ជើញមិនមែនជា username (autocomplete="off") · កូដប្តូរពាក្យសម្ងាត់ = one-time-code', () => {
        render('supabase', 'register');
        expect(document.getElementById('registerInviteInput')!.getAttribute('autocomplete')).toBe('off');
        unmount();
        render('supabase', 'reset');
        expect(document.getElementById('resetCodeInput')!.getAttribute('autocomplete')).toBe('one-time-code');
    });
});
