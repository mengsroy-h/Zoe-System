import { commitNow } from '../app/flush';
import { fieldValue, focusField, setFieldValue } from '../app/refs';
import { firebaseState } from '../core/state';
import { viewState } from '../core/view-state';
import { performLogin } from './auth';
import { showToast } from '../ui/toast';

export const ACCOUNT_USERNAME_RE = /^[a-z0-9_.]{3,32}$/;

export const ACCOUNT_PASSWORD_MIN = 8;

export const ACCOUNT_REPLY_TEXT = {
    'invite-invalid': 'កូដអញ្ជើញមិនត្រឹមត្រូវ ប្រើរួច ឬផុតកំណត់ — សូមសុំកូដថ្មីពីអ្នកលក់',
    'username-invalid': 'ឈ្មោះគណនីត្រូវមាន ៣–៣២ តួ ៖ អក្សរ a–z លេខ 0–9 សញ្ញា . ឬ _ (គ្មានដកឃ្លា)',
    'password-short': 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួ',
    'password-long': 'ពាក្យសម្ងាត់វែងពេក (អតិបរមា ៧២ byte)',
    'password-weak': 'ពាក្យសម្ងាត់ខ្សោយពេក — សូមលាយអក្សរ និងលេខ',
    'username-taken': 'ឈ្មោះគណនីនេះមានគេប្រើរួច — សូមជ្រើសឈ្មោះផ្សេង',
    'reset-code-invalid': 'កូដប្តូរពាក្យសម្ងាត់មិនត្រឹមត្រូវ ប្រើរួច ឬផុតកំណត់ — សូមសុំកូដថ្មីពីអ្នកលក់',
    'registration-unknown': 'មិនដឹងថាការចុះឈ្មោះបានសម្រេចឬអត់ — សូមសាកចូលប្រព័ន្ធដោយឈ្មោះ និងពាក្យសម្ងាត់ដដែល មុនចុះឈ្មោះម្តងទៀត',
    'registration-incomplete': 'ការចុះឈ្មោះមិនពេញលេញ — សូមទាក់ទងអ្នកលក់',
    'account-invalid': 'គណនីនេះមិនត្រឹមត្រូវ — សូមទាក់ទងអ្នកលក់',
    'origin-denied': 'Server មិនទាន់អនុញ្ញាតឲ្យ App នេះចុះឈ្មោះទេ — សូមប្រាប់អ្នកលក់ (ZOE_ALLOWED_ORIGINS)',
    'server-unconfigured': 'Server មិនទាន់កំណត់រួច — សូមប្រាប់អ្នកលក់',
    'network': 'ភ្ជាប់ Server មិនបានទេ — សូមពិនិត្យអ៊ីនធឺណិត ហើយសាកម្តងទៀត',
    'busy': 'Server រវល់ ឬមិនទាន់ឆ្លើយ — សូមសាកម្តងទៀតបន្តិចទៀត'
};

const BUSY_CODES = ['db-unavailable', 'auth-unavailable', 'internal', 'rate-limited'];

let pendingInvite = '';

export function rememberSetupInvite(code) {
    pendingInvite = typeof code === 'string' ? code.trim().slice(0, 64) : '';
}

export function clearPendingInvite() {
    pendingInvite = '';
}

export function hasPendingInvite() {
    return !!pendingInvite;
}

export function accountReplyText(code) {
    if (Object.prototype.hasOwnProperty.call(ACCOUNT_REPLY_TEXT, code)) return ACCOUNT_REPLY_TEXT[code];
    if (BUSY_CODES.indexOf(code) !== -1) return ACCOUNT_REPLY_TEXT.busy;
    return 'មិនបានសម្រេច (' + (code || 'unknown') + ')';
}

export function normalizeAccountUsername(raw) {
    const text = String(raw === null || raw === undefined ? '' : raw).trim().toLowerCase();
    return ACCOUNT_USERNAME_RE.test(text) ? text : '';
}

function accountApp() {
    const fb = firebaseState.fb;
    if (!fb || !fb.__supabase || !firebaseState.auth || !firebaseState.auth.app) return null;
    return firebaseState.auth.app;
}

function passwordProblem(password, confirm) {
    if (Array.from(password).length < ACCOUNT_PASSWORD_MIN) return ACCOUNT_REPLY_TEXT['password-short'];
    if (new TextEncoder().encode(password).length > 72) return ACCOUNT_REPLY_TEXT['password-long'];
    if (password !== confirm) return 'ពាក្យសម្ងាត់ទាំង ២ មិនដូចគ្នា';
    return '';
}

async function callAccountFunction(kind, body) {
    const app = accountApp();
    if (!app) return { ok: false, code: 'server-unconfigured' };
    try {
        const res = kind === 'register' ? await firebaseState.fb.registerAccount(app, body) : await firebaseState.fb.resetPassword(app, body);
        const out = res && res.body && typeof res.body === 'object' ? res.body : {};
        return { ok: out.ok === true, code: typeof out.code === 'string' ? out.code : (res && res.status === 429 ? 'rate-limited' : 'bad-response') };
    } catch (e) {
        return { ok: false, code: 'network' };
    }
}

export function openRegisterForm() {
    if (!accountApp()) return;
    viewState.loginMode = 'register';
    commitNow();
    if (pendingInvite) setFieldValue('registerInviteInput', pendingInvite);
    focusField(pendingInvite ? 'registerUsernameInput' : 'registerInviteInput');
}

export function openResetPasswordForm() {
    if (!accountApp()) return;
    const typed = fieldValue('loginEmailInput');
    viewState.loginMode = 'reset';
    commitNow();
    const username = normalizeAccountUsername(typed);
    if (username) setFieldValue('resetUsernameInput', username);
    focusField(username ? 'resetCodeInput' : 'resetUsernameInput');
}

export function backToLoginForm() {
    viewState.loginMode = 'login';
    commitNow();
}

export async function submitRegisterForm(event?) {
    if (event) event.preventDefault();
    if (viewState.loginBusy) return;
    const invite = fieldValue('registerInviteInput').trim();
    const username = normalizeAccountUsername(fieldValue('registerUsernameInput'));
    const password = fieldValue('registerPasswordInput');
    const confirm = fieldValue('registerPasswordConfirmInput');
    if (!invite) { alert('សូមបញ្ចូលកូដអញ្ជើញពីអ្នកលក់!'); return; }
    if (!username) { alert(ACCOUNT_REPLY_TEXT['username-invalid']); return; }
    const problem = passwordProblem(password, confirm);
    if (problem) { alert(problem); return; }
    viewState.loginBusy = true;
    const generation = firebaseState.authGeneration;
    let reply;
    try {
        reply = await callAccountFunction('register', { invite, username, password });
    } finally {
        viewState.loginBusy = false;
    }
    if (generation !== firebaseState.authGeneration) return;
    if (!reply.ok) {
        alert('ការចុះឈ្មោះមិនជោគជ័យ៖ ' + accountReplyText(reply.code));
        return;
    }
    clearPendingInvite();
    setFieldValue('registerPasswordInput', '');
    setFieldValue('registerPasswordConfirmInput', '');
    setFieldValue('registerInviteInput', '');
    viewState.loginMode = 'login';
    commitNow();
    showToast('✅ ចុះឈ្មោះជោគជ័យ! កំពុងចូលប្រព័ន្ធ...');
    performLogin(username, password, true);
}

export async function submitResetPasswordForm(event?) {
    if (event) event.preventDefault();
    if (viewState.loginBusy) return;
    const username = normalizeAccountUsername(fieldValue('resetUsernameInput'));
    const resetCode = fieldValue('resetCodeInput').trim();
    const password = fieldValue('resetPasswordInput');
    const confirm = fieldValue('resetPasswordConfirmInput');
    if (!username) { alert(ACCOUNT_REPLY_TEXT['username-invalid']); return; }
    if (!resetCode) { alert('សូមបញ្ចូលកូដប្តូរពាក្យសម្ងាត់ពីអ្នកលក់!'); return; }
    const problem = passwordProblem(password, confirm);
    if (problem) { alert(problem); return; }
    viewState.loginBusy = true;
    let reply;
    try {
        reply = await callAccountFunction('reset', { username, resetCode, password });
    } finally {
        viewState.loginBusy = false;
    }
    if (!reply.ok) {
        alert('ប្តូរពាក្យសម្ងាត់មិនបាន៖ ' + accountReplyText(reply.code));
        return;
    }
    setFieldValue('resetCodeInput', '');
    setFieldValue('resetPasswordInput', '');
    setFieldValue('resetPasswordConfirmInput', '');
    viewState.loginMode = 'login';
    commitNow();
    setFieldValue('loginEmailInput', username);
    showToast(reply.code === 'password-reset-incomplete'
        ? '✅ បានប្តូរពាក្យសម្ងាត់ — ឧបករណ៍ចាស់ខ្លះអាចនៅចូលបានរហូតដល់វាចាកចេញ'
        : '✅ បានប្តូរពាក្យសម្ងាត់! សូមចូលប្រព័ន្ធដោយពាក្យសម្ងាត់ថ្មី');
    focusField('loginPasswordInput');
}
