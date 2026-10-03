import { commitNow } from '../app/flush';
import { fieldValue, focusField, setFieldValue } from '../app/refs';
import { modalIsOpen } from '../core/modals';
import { firebaseState } from '../core/state';
import { viewState } from '../core/view-state';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { performLogin } from './auth';
import { rememberedLoginFor } from './login-memory';
import { forgetLoginPassword, syncRememberPasswordBox } from './password-memory';
import { showToast } from '../ui/toast';

export const ACCOUNT_USERNAME_RE = /^[a-z0-9_.]{3,32}$/;

export const ACCOUNT_PASSWORD_MIN = 8;

export const ACCOUNT_REPLY_TEXT = {
    'invite-invalid': 'កូដអញ្ជើញមិនត្រឹមត្រូវ ប្រើរួច ឬផុតកំណត់ — សូមសុំកូដថ្មីពីអ្នកលក់',
    'username-invalid': 'ឈ្មោះគណនីត្រូវមាន ៣–៣២ តួ ៖ អក្សរ a–z លេខ 0–9 សញ្ញា . ឬ _ (គ្មានដកឃ្លា)',
    'password-short': 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួ',
    'password-long': 'ពាក្យសម្ងាត់វែងពេក (អតិបរមា ៧២ byte)',
    'password-weak': 'ពាក្យសម្ងាត់នេះខ្សោយពេក ឬធ្លាប់លេចធ្លាយលើអ៊ីនធឺណិត — សូមជ្រើសពាក្យសម្ងាត់ផ្សេង (លាយអក្សរ និងលេខ)',
    'username-taken': 'ឈ្មោះគណនីនេះមានគេប្រើរួច — សូមជ្រើសឈ្មោះផ្សេង',
    'reset-code-invalid': 'កូដប្តូរពាក្យសម្ងាត់មិនត្រឹមត្រូវ ប្រើរួច ឬផុតកំណត់ — សូមសុំកូដថ្មីពីអ្នកលក់',
    'password-reset-unknown': 'មិនទាន់ដឹងលទ្ធផលនៃការប្តូរពាក្យសម្ងាត់ — សូមសាកចូលដោយពាក្យសម្ងាត់ថ្មីជាមុន។ បើចូលមិនបាន សូមទាក់ទងអ្នកលក់ដើម្បីសុំកូដថ្មី',
    'registration-unknown': 'មិនដឹងថាការចុះឈ្មោះបានសម្រេចឬអត់ — សូមសាកចូលប្រព័ន្ធដោយឈ្មោះ និងពាក្យសម្ងាត់ដដែល មុនចុះឈ្មោះម្តងទៀត',
    'registration-incomplete': 'ការចុះឈ្មោះមិនពេញលេញ — សូមទាក់ទងអ្នកលក់',
    'account-invalid': 'គណនីនេះមិនត្រឹមត្រូវ — សូមទាក់ទងអ្នកលក់',
    'origin-denied': 'Server មិនទាន់អនុញ្ញាតឲ្យ App នេះចុះឈ្មោះទេ — សូមប្រាប់អ្នកលក់ (ZOE_ALLOWED_ORIGINS)',
    'server-unconfigured': 'Server មិនទាន់កំណត់រួច — សូមប្រាប់អ្នកលក់',
    'network': 'ភ្ជាប់ Server មិនបានទេ — សូមពិនិត្យអ៊ីនធឺណិត ហើយសាកម្តងទៀត',
    'busy': 'Server រវល់ ឬមិនទាន់ឆ្លើយ — សូមសាកម្តងទៀតបន្តិចទៀត'
};

const BUSY_CODES = ['db-unavailable', 'auth-unavailable', 'internal', 'rate-limited'];

export const USED_INVITES_KEY = 'zoew_used_invites_v1';

export const USED_INVITES_MAX = 30;

export const INVITE_USED_TOAST = 'ℹ️ កូដអញ្ជើញក្នុង Setup Link នេះប្រើរួច ឬផុតកំណត់ — សូមចូលប្រព័ន្ធដោយឈ្មោះគណនីរបស់ហាង (ហាងថ្មី ៖ សុំកូដថ្មីពីអ្នកលក់)';

export const INVITE_UNVERIFIED_TOAST = 'ℹ️ មានកូដអញ្ជើញក្នុង Setup Link — បើហាងមិនទាន់មានគណនី សូមចុច «📝 ចុះឈ្មោះដោយកូដអញ្ជើញ»';

let pendingInvite = '';
let pendingInviteScope = '';
let inviteRouteSeq = 0;

export function inviteScopeOf(url) {
    return typeof url === 'string' && url ? url.trim().replace(/\/+$/, '') : '';
}

export function rememberSetupInvite(code, scope?) {
    pendingInvite = typeof code === 'string' ? code.trim().slice(0, 64) : '';
    pendingInviteScope = pendingInvite ? inviteScopeOf(scope) : '';
    inviteRouteSeq++;
}

export function clearPendingInvite() {
    pendingInvite = '';
    pendingInviteScope = '';
    inviteRouteSeq++;
}

export function hasPendingInvite() {
    return !!pendingInvite;
}

export function normalizeInviteText(raw) {
    if (typeof raw !== 'string' || raw.length > 64) return '';
    const cleaned = raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
    return /^[0-9A-HJKMNP-TV-Z]{20}$/.test(cleaned) ? cleaned : '';
}

export function currentSupabaseScope() {
    const cfg = firebaseState.firebaseConfig;
    return cfg && typeof cfg.supabaseUrl === 'string' ? inviteScopeOf(cfg.supabaseUrl) : '';
}

export async function inviteFingerprint(code, scope) {
    const normalized = normalizeInviteText(code);
    const where = inviteScopeOf(scope);
    if (!normalized || !where) return '';
    try {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('zoew-used-invite:' + where + '|' + normalized));
        return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    } catch (e) {
        return '';
    }
}

export function readUsedInvites() {
    const raw = safeStoreGet(appLocalStore, USED_INVITES_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && /^[0-9a-f]{32}$/.test(x)).slice(0, USED_INVITES_MAX) : [];
    } catch (e) {
        return [];
    }
}

export async function noteInviteUsed(code, scope) {
    const fp = await inviteFingerprint(code, scope);
    if (!fp) return false;
    const list = [fp].concat(readUsedInvites().filter((x) => x !== fp)).slice(0, USED_INVITES_MAX);
    return safeStoreSet(appLocalStore, USED_INVITES_KEY, JSON.stringify(list));
}

export async function inviteKnownUsed(code, scope) {
    const fp = await inviteFingerprint(code, scope);
    return !!fp && readUsedInvites().indexOf(fp) !== -1;
}

export async function checkInviteWithServer(invite) {
    const app = accountApp();
    if (!app) return 'unknown';
    try {
        const res = await firebaseState.fb.registerAccount(app, { invite, check: true });
        const code = res && res.body && typeof res.body.code === 'string' ? res.body.code : '';
        if (code === 'invite-usable') return 'usable';
        if (code === 'invite-invalid') return 'used';
        return 'unknown';
    } catch (e) {
        return 'unknown';
    }
}

export async function routePendingInvite() {
    if (viewState.backendKind !== 'supabase' || !pendingInvite) return 'none';
    const invite = pendingInvite;
    const scope = currentSupabaseScope();
    if (pendingInviteScope && scope && pendingInviteScope !== scope) {
        clearPendingInvite();
        return 'other-project';
    }
    const seq = ++inviteRouteSeq;
    const generation = firebaseState.authGeneration;
    const stillDeciding = () => seq === inviteRouteSeq && pendingInvite === invite && generation === firebaseState.authGeneration
        && !(firebaseState.auth && firebaseState.auth.currentUser) && modalIsOpen('loginModal') && viewState.loginMode === 'login'
        && !viewState.loginBusy && !fieldValue('loginPasswordInput');
    if (await inviteKnownUsed(invite, scope)) {
        if (seq !== inviteRouteSeq || pendingInvite !== invite) return 'stale';
        clearPendingInvite();
        showToast(INVITE_USED_TOAST);
        return 'used';
    }
    if (!stillDeciding()) return 'stale';
    const verdict = await checkInviteWithServer(invite);
    if (seq !== inviteRouteSeq || pendingInvite !== invite) return 'stale';
    if (verdict === 'used') {
        await noteInviteUsed(invite, scope);
        if (pendingInvite !== invite) return 'stale';
        clearPendingInvite();
        if (modalIsOpen('loginModal') && viewState.loginMode === 'login') showToast(INVITE_USED_TOAST);
        return 'used';
    }
    if (!stillDeciding()) return 'stale';
    if (verdict === 'unknown' && rememberedLoginFor()) {
        showToast(INVITE_UNVERIFIED_TOAST);
        return 'login';
    }
    openRegisterForm();
    return 'register';
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
    if (!firebaseState.fb || !firebaseState.fb.__supabase || !firebaseState.auth || !firebaseState.auth.app) return null;
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
    syncRememberPasswordBox();
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
        if (reply.code === 'invite-invalid') {
            await noteInviteUsed(invite, currentSupabaseScope());
            if (normalizeInviteText(pendingInvite) === normalizeInviteText(invite)) clearPendingInvite();
        }
        alert('ការចុះឈ្មោះមិនជោគជ័យ៖ ' + accountReplyText(reply.code));
        return;
    }
    await noteInviteUsed(invite, currentSupabaseScope());
    if (generation !== firebaseState.authGeneration) return;
    clearPendingInvite();
    setFieldValue('registerPasswordInput', '');
    setFieldValue('registerPasswordConfirmInput', '');
    setFieldValue('registerInviteInput', '');
    viewState.loginMode = 'login';
    commitNow();
    syncRememberPasswordBox();
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
        alert((reply.code === 'password-reset-unknown' ? '' : 'ប្តូរពាក្យសម្ងាត់មិនបាន៖ ') + accountReplyText(reply.code));
        return;
    }
    forgetLoginPassword();
    setFieldValue('resetCodeInput', '');
    setFieldValue('resetPasswordInput', '');
    setFieldValue('resetPasswordConfirmInput', '');
    viewState.loginMode = 'login';
    commitNow();
    syncRememberPasswordBox();
    setFieldValue('loginEmailInput', username);
    showToast(reply.code === 'password-reset-incomplete'
        ? '✅ បានប្តូរពាក្យសម្ងាត់ — ឧបករណ៍ចាស់ខ្លះអាចនៅចូលបានរហូតដល់វាចាកចេញ'
        : '✅ បានប្តូរពាក្យសម្ងាត់! សូមចូលប្រព័ន្ធដោយពាក្យសម្ងាត់ថ្មី');
    focusField('loginPasswordInput');
}
