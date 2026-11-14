import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, securityState, uiState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { appLocalStore, appSessionStore } from '../../../../ZoeW/src/core/storage';
import { modalIsOpen, registerModalMeta, unregisterModalMeta } from '../../../../ZoeW/src/core/modals';
import { logoutApp, performLogin } from '../../../../ZoeW/src/features/auth';
import { forceExpireSession, runSessionExpiryCheck } from '../../../../ZoeW/src/features/session';
import { DB_OP_TIMEOUT_MS } from '../../../../ZoeW/src/services/network';
import { connectionFlowSnapshot, withConnectionOwnership } from '../../../../ZoeW/src/services/connection-flow';
import { acceptServerClockOffset, resetServerClock } from '../../../../ZoeW/src/core/clock';
import { sessionUserActionAllowed, sessionVerificationRequired } from '../../../../ZoeW/src/core/session-verification';
import * as licenseFlow from '../../../../ZoeW/src/features/license';
import { acceptLocalAuthSession, createLocalLogoutIntentStore, localLogoutIntent } from '../../../../ZoeW/src/services/local-logout-intent';

const turn = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
let fixtureUser = 0;

beforeEach(() => {
    vi.useFakeTimers();
    appLocalStore.clear();
    appSessionStore.clear();
    Object.assign(firebaseState, {
        auth: { currentUser: { uid: 'logout-a-' + (++fixtureUser) } }, db: {}, fb: {},
        firebaseConfig: { databaseURL: 'https://logout.invalid' },
        authGeneration: firebaseState.authGeneration + 1, authLoginOperation: null,
        sessionExpiryCheck: 'live'
    });
    expect(acceptLocalAuthSession(firebaseState.auth, 'fb:https://logout.invalid', firebaseState.auth.currentUser)).toBe(true);
    Object.assign(uiState, { modalDisplay: {}, modalStack: [], isModalOpen: false, toasts: [] });
    Object.assign(viewState, { loginBusy: false, backendKind: 'firebase' });
    registerModalMeta('loginModal', { noDismiss: true });
    securityState.lookupSecretKey = { owner: 'A' };
    securityState.appIsLocked = false;
    viewState.appLockOpen = false;
    appLocalStore.setItem('zoew_login_time', 'A-session');
});

afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers();
    vi.restoreAllMocks();
    appLocalStore.clear();
    appSessionStore.clear();
    unregisterModalMeta('loginModal');
});

describe('ចាកចេញមានពិដាន ដោយមិនអះអាងថា SDK បានបញ្ចប់', () => {
    for (const expiry of [false, true]) it((expiry ? 'expiry' : 'logout') + ' intent និង SDK ទាំងពីរបរាជ័យ មិនណែនាំ reload ឬអះអាងថាចប់', async () => {
        const note = vi.spyOn(localLogoutIntent, 'note').mockImplementation((scope, uid) => {
            localLogoutIntent.fence(scope, uid);
            return false;
        });
        firebaseState.fb = { signOut: async () => { throw new Error('synthetic SDK persistence refusal'); } };
        if (expiry) { forceExpireSession(); await turn(); } else await logoutApp();
        expect(note).toHaveBeenCalledOnce();
        expect(connectionFlowSnapshot().canWrite).toBe(false);
        expect(uiState.toasts.some(toast => toast.msg.includes('កុំបិទ ឬ Refresh'))).toBe(true);
        expect(uiState.toasts.some(toast => toast.msg === '✅ បានចាកចេញពីប្រព័ន្ធ!')).toBe(false);
    });

    it('tab ផ្សេងកត់ logout intent ទោះ SDK មិនផ្ញើ auth event ក៏បិទ write ថ្មីមុន effect', async () => {
        const app = {}, db = { app }, auth = { app, currentUser: { uid: 'cross-tab-unresolved' } };
        const set = vi.fn(async () => {});
        const sdk = withConnectionOwnership({ __supabase: true, getAuth: () => auth, getDatabase: () => db,
            ref: (_db, path) => ({ path }), set });
        sdk.getAuth(app); sdk.getDatabase(app);
        Object.assign(firebaseState, { auth, db, fb: sdk, isDatabaseInitialized: true, isDatabaseConnected: true, dbListenersFailed: false });
        expect(acceptLocalAuthSession(auth, 'fb:https://logout.invalid', auth.currentUser)).toBe(true);
        const reference = sdk.ref(db, 'synthetic-value'), generation = firebaseState.authGeneration;
        const otherTab = createLocalLogoutIntentStore(appLocalStore, appSessionStore);
        otherTab.note('fb:https://another.invalid', auth.currentUser.uid);
        otherTab.note('fb:https://logout.invalid', 'different-user');
        await sdk.set(reference, 'unrelated-logout-does-not-block');
        expect(set).toHaveBeenCalledTimes(1);
        otherTab.note('fb:https://logout.invalid', auth.currentUser.uid);
        expect(firebaseState.authGeneration).toBe(generation);
        expect(auth.currentUser.uid).toBe('cross-tab-unresolved');
        await expect(sdk.set(reference, 'same-user-logout-blocks')).rejects.toMatchObject({ code: 'CONNECTION_SCOPE_CHANGED' });
        expect(set).toHaveBeenCalledTimes(1);
    });

    for (const expiry of [false, true]) it((expiry ? 'expiry' : 'logout') + ' ខណៈ PIN veil បើក មិនលាក់ login ក្រោយ local session បិទ', async () => {
        firebaseState.fb = { signOut: () => new Promise<void>(() => {}) };
        securityState.appIsLocked = true;
        viewState.appLockOpen = true;
        if (expiry) forceExpireSession(); else void logoutApp();
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
        expect(connectionFlowSnapshot().canWrite).toBe(false);
        expect(viewState.appLockOpen).toBe(false);
        expect(securityState.appIsLocked).toBe(false);
        expect(modalIsOpen('loginModal')).toBe(true);
        expect(sessionUserActionAllowed('submitLoginForm')).toBe(true);
    });

    it('logout ដែល SDK ព្យួរ បិទផ្លូវសរសេរភ្លាម និងមិនត្រូវបើកឡើងវិញតាម clock/session retry', async () => {
        const getIdTokenResult = vi.fn(async () => ({ authTime: new Date().toISOString() }));
        firebaseState.fb = { signOut: () => new Promise<void>(() => {}), getIdTokenResult };
        Object.assign(firebaseState, { isDatabaseInitialized: true, isDatabaseConnected: true, dbListenersFailed: false });
        expect(connectionFlowSnapshot().canWrite).toBe(true);
        const pending = logoutApp();
        await turn();
        expect(connectionFlowSnapshot().canWrite).toBe(false);
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
        await pending;
        expect(connectionFlowSnapshot().canWrite).toBe(false);
        resetServerClock();
        expect(acceptServerClockOffset(0, Object.freeze({ source: 'nonce', generation: 1, monotonicMs: performance.now(),
            wallMs: Date.now(), epochMs: Date.now(), uncertaintyMs: 0 }), true)).toBe(true);
        await runSessionExpiryCheck();
        expect(getIdTokenResult).not.toHaveBeenCalled();
        expect(connectionFlowSnapshot().canWrite).toBe(false);
        expect(sessionVerificationRequired()).toBe(false);
        expect(sessionUserActionAllowed('submitLoginForm')).toBe(true);
        expect(sessionUserActionAllowed('triggerScanAction')).toBe(false);
        expect(sessionUserActionAllowed('executeRestoreItem')).toBe(false);
    });

    it('SDK user នៅសល់មិនអាចចាប់ផ្ដើមការសរសេរថ្មី ក្រោយ logout ជំនាន់ថ្មី', async () => {
        const app = {};
        const auth = { app, currentUser: { uid: 'unresolved-logout-user' } };
        const db = { app };
        const set = vi.fn(async () => {});
        const sdk = withConnectionOwnership({ __supabase: true, getAuth: () => auth, getDatabase: () => db,
            ref: (_db, path) => ({ path }), set, signOut: () => new Promise<void>(() => {}), off() {} });
        sdk.getAuth(app); sdk.getDatabase(app);
        Object.assign(firebaseState, { auth, db, fb: sdk, isDatabaseInitialized: true, isDatabaseConnected: true, dbListenersFailed: false });
        expect(acceptLocalAuthSession(auth, 'fb:https://logout.invalid', auth.currentUser)).toBe(true);
        const reference = sdk.ref(db, 'synthetic-value');
        await sdk.set(reference, 'before-logout');
        expect(set).toHaveBeenCalledTimes(1);
        const pending = logoutApp();
        await turn();
        await expect(sdk.set(reference, 'after-logout-start')).rejects.toMatchObject({ code: 'CONNECTION_SCOPE_CHANGED' });
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
        await pending;
        await expect(sdk.set(reference, 'after-logout-ceiling')).rejects.toMatchObject({ code: 'CONNECTION_SCOPE_CHANGED' });
        expect(set).toHaveBeenCalledTimes(1);
        expect(auth.currentUser.uid).toBe('unresolved-logout-user');
    });

    it('credentials ថ្មីដែល SDK បញ្ជាក់ អាចចូល និងដោះសោ local logout ដោយគ្មានការឆ្លើយ signOut ចាស់', async () => {
        vi.spyOn(licenseFlow, 'proceedAfterLogin').mockResolvedValue(false);
        firebaseState.fb = { signOut: () => new Promise<void>(() => {}),
            setPersistence: async () => {},
            signInWithEmailAndPassword: vi.fn(async () => {
                const user = { uid: 'relogin-b' };
                firebaseState.auth.currentUser = user;
                return { user };
            }),
            getIdTokenResult: async () => ({ authTime: new Date().toISOString() }) };
        const previousLogout = logoutApp();
        await turn();
        resetServerClock();
        expect(acceptServerClockOffset(0, Object.freeze({ source: 'nonce', generation: 1, monotonicMs: performance.now(),
            wallMs: Date.now(), epochMs: Date.now(), uncertaintyMs: 0 }), true)).toBe(true);
        expect(sessionUserActionAllowed('submitLoginForm')).toBe(true);
        await performLogin('synthetic@example.invalid', 'synthetic-password', false, false);
        await turn();
        expect(firebaseState.fb.signInWithEmailAndPassword).toHaveBeenCalledOnce();
        expect(firebaseState.auth.currentUser.uid).toBe('relogin-b');
        expect(firebaseState.sessionExpiryCheck).toBe('live');
        expect(connectionFlowSnapshot().canWrite).toBe(true);
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
        await previousLogout;
        expect(firebaseState.sessionExpiryCheck).toBe('live');
        expect(firebaseState.auth.currentUser.uid).toBe('relogin-b');
    });

    it('logout ព្យួរ ➜ បញ្ចប់ UI ក្នុងពិដាន និងសម្អាត secret ដែលកាន់ក្នុងសតិ', async () => {
        const user = firebaseState.auth.currentUser;
        firebaseState.fb = { signOut: vi.fn(() => new Promise<void>(() => {})) };
        let settled = false;
        void logoutApp().then(() => { settled = true; });
        await turn();
        expect(firebaseState.fb.signOut).toHaveBeenCalledOnce();
        expect(settled).toBe(false);
        expect(modalIsOpen('loginModal')).toBe(false);
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
        expect(settled).toBe(true);
        expect(modalIsOpen('loginModal')).toBe(true);
        expect(securityState.lookupSecretKey).toBeNull();
        expect(appLocalStore.getItem('zoew_login_time')).toBeNull();
        expect(firebaseState.auth.currentUser).toBe(user);
        expect(uiState.toasts.some(toast => toast.msg.includes('មិនអាចបញ្ជាក់'))).toBe(true);
        expect(uiState.toasts.some(toast => toast.msg === '✅ បានចាកចេញពីប្រព័ន្ធ!')).toBe(false);
    });

    for (const mode of ['hang', 'throw', 'absent'] as const) it('វគ្គផុតកំណត់ · signOut ' + mode + ' ➜ រក្សាសោ និងមិនទុក secret រង់ចាំគ្មានពិដាន', async () => {
        const user = firebaseState.auth.currentUser;
        firebaseState.fb = mode === 'absent' ? {} : { signOut: mode === 'throw'
            ? () => { throw new Error('synthetic persistence refusal'); }
            : () => new Promise<void>(() => {}) };
        expect(() => forceExpireSession()).not.toThrow();
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
        expect(firebaseState.sessionExpiryCheck).toBe('signed-out');
        expect(connectionFlowSnapshot().canWrite).toBe(false);
        expect(sessionVerificationRequired()).toBe(false);
        expect(sessionUserActionAllowed('submitLoginForm')).toBe(true);
        expect(sessionUserActionAllowed('triggerScanAction')).toBe(false);
        expect(firebaseState.auth.currentUser).toBe(user);
        expect(securityState.lookupSecretKey).toBeNull();
        expect(appLocalStore.getItem('zoew_login_time')).toBeNull();
        expect(modalIsOpen('loginModal')).toBe(true);
    });

    for (const expiry of [false, true]) it((expiry ? 'expire' : 'logout') + ' A កំពុងព្យួរ ➜ មិនសម្អាតវគ្គ B ពេលផុតពិដាន', async () => {
        firebaseState.fb = { signOut: () => new Promise<void>(() => {}) };
        if (expiry) forceExpireSession(); else void logoutApp();
        await turn();
        firebaseState.auth = { currentUser: { uid: 'logout-b' } };
        firebaseState.authGeneration++;
        securityState.lookupSecretKey = { owner: 'B' };
        const secret = securityState.lookupSecretKey;
        appLocalStore.setItem('zoew_login_time', 'B-session');
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
        expect(securityState.lookupSecretKey).toBe(secret);
        expect(appLocalStore.getItem('zoew_login_time')).toBe('B-session');
        expect(modalIsOpen('loginModal')).toBe(false);
    });

    for (const expiry of [false, true]) it((expiry ? 'expire' : 'logout') + ' A មិនទាន់ចាប់ផ្ដើម SDK ➜ មិនអាចចាកចេញវគ្គ B លើ auth object ដដែល', async () => {
        const signOut = vi.fn(async () => { firebaseState.auth.currentUser = null; });
        firebaseState.fb = { signOut };
        if (expiry) forceExpireSession(); else void logoutApp();
        firebaseState.auth.currentUser = { uid: 'logout-b' };
        firebaseState.authGeneration++;
        await turn();
        expect(signOut).not.toHaveBeenCalled();
        expect(firebaseState.auth.currentUser.uid).toBe('logout-b');
    });
});
