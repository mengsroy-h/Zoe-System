import { cancelLicenseInvitation, clearLicenseInvitationIntent } from './license-invitations';
import { fieldChecked, fieldValue, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { dataState, firebaseState, uiState } from '../core/state';
import { appLocalStore, appSessionStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { AUTH_STUCK_RECOVERY_FLAG } from '../core/storage-keys';
import { clearPendingInvite } from './account';
import { clearAppUnlockedForSession, hideAppLockScreen } from './app-lock';
import { resetClearHistoryOperationState } from './clear-history';
import { checkPinAndOpenConfig } from './config';
import { clearCustomerDataTableCache } from './customer-table';
import { proceedAfterLogin } from './license';
import { applyCurrentFilter } from './monthly-report';
import { forgetRememberedLogin, loginBackendScope, rememberLogin } from './login-memory';
import { forgetLoginPassword, rememberLoginPassword, rememberPasswordPrefIsOff, setRememberPasswordPref } from './password-memory';
import { LOCAL_LOGOUT_UNPERSISTED_TOAST, armSessionExpiryCheck, clearRememberedSession, clearSensitiveModalFields, showLoginModalWithPrefill } from './session';
import { renderRecentlyDeleted } from './trash';
import { detachDatabaseListeners, resetDbListenerHealthState, updateRecentPhonesList } from '../services/db-listeners';
import { showToast } from '../ui/toast';
import { documentIsHidden, onDocumentVisibilityChange } from '../platform/document-io';
import { DB_OP_TIMEOUT_MS, withTimeout } from '../services/network';
import { acceptLocalAuthSession, LOCAL_LOGOUT_INTENT_PREFIX, localLogoutIntent } from '../services/local-logout-intent';

const acceptedLogoutIntents = new WeakMap();
const initialAuthLogoutIntents = new WeakMap<object, any>();

export async function attemptAuthStorageRecovery(isCurrent = () => true) {
    if (!isCurrent()) return;
    if (safeStoreGet(appSessionStore, AUTH_STUCK_RECOVERY_FLAG)) {
        showLoginModalWithPrefill();
        return;
    }
    safeStoreSet(appSessionStore, AUTH_STUCK_RECOVERY_FLAG, '1');
    try {
        if ('indexedDB' in window && typeof indexedDB.databases === 'function') {
            const dbs = await indexedDB.databases();
            if (!isCurrent()) return;
            await Promise.all(dbs
                .filter((d) => d.name && /firebase/i.test(d.name))
                .map((d) => new Promise<void>((resolve) => {
                    const req = indexedDB.deleteDatabase(d.name);
                    req.onsuccess = () => resolve();
                    req.onerror = () => resolve();
                    req.onblocked = () => resolve();
                }))
            );
        }
    } catch (e) {}
    if (isCurrent()) window.location.reload();
}

function clearSignedInView() {
    resetClearHistoryOperationState();
    resetDbListenerHealthState();
    detachDatabaseListeners();
    firebaseState.isDatabaseInitialized = false;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = {};
    dataState.monthlyRevenueData = {};
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
    uiState.lockerBarcodeIndex = {};
    clearCustomerDataTableCache();
    applyCurrentFilter();
    renderRecentlyDeleted();
    updateRecentPhonesList();
}

export function setupAuthListener() {
    if (!firebaseState.auth) return;

    firebaseState.authLoginOperation = null;
    viewState.loginBusy = false;

    if (firebaseState.authUnsubscribe) {
        try { firebaseState.authUnsubscribe(); } catch (e) {}
        firebaseState.authUnsubscribe = null;
    }
    if (firebaseState.authRecoveryTimeout) {
        clearTimeout(firebaseState.authRecoveryTimeout);
        firebaseState.authRecoveryTimeout = null;
    }

    const listenerAuth = firebaseState.auth;
    const listenerFb = firebaseState.fb;
    const listenerScope = loginBackendScope();
    const listenerConfig = safeStoreGet(appLocalStore, 'zoew_firebase_config');
    let initialIntent = initialAuthLogoutIntents.get(listenerAuth);
    if (!initialIntent) {
        initialIntent = { scope: listenerScope, config: listenerConfig, captured: localLogoutIntent.capture(listenerScope) };
        initialAuthLogoutIntents.set(listenerAuth, initialIntent);
    }
    let active = true;
    let stopWaitingVisibility: (() => void) | null = null;
    const clearHiddenRecovery = () => {
        if (stopWaitingVisibility) stopWaitingVisibility();
        stopWaitingVisibility = null;
    };
    const isCurrent = () => active && firebaseState.auth === listenerAuth && firebaseState.fb === listenerFb && loginBackendScope() === listenerScope;
    const closeLocalSession = () => {
        if (listenerAuth.currentUser?.uid) localLogoutIntent.fence(listenerScope, listenerAuth.currentUser.uid);
        if (firebaseState.sessionExpiryCheck !== 'signed-out' || firebaseState.authLoginOperation) firebaseState.authGeneration++;
        firebaseState.sessionExpiryCheck = 'signed-out';
        firebaseState.authLoginOperation = null;
        viewState.loginBusy = false;
        clearAppUnlockedForSession();
        clearSignedInView();
        hideAppLockScreen();
        clearRememberedSession(false);
        showLoginModalWithPrefill();
    };
    const onLogoutStorage = (event) => {
        if (!isCurrent() || typeof event?.key !== 'string' || !event.key.startsWith(LOCAL_LOGOUT_INTENT_PREFIX)) return;
        if (event.storageArea && event.storageArea !== appLocalStore) return;
        const user = listenerAuth.currentUser;
        const accepted = acceptedLogoutIntents.get(listenerAuth);
        if (accepted?.user === user && accepted.scope === listenerScope && accepted.current()) return;
        if (user && localLogoutIntent.affects(listenerScope, user.uid, event.key)
            && (event.oldValue !== event.newValue || localLogoutIntent.blocked(listenerScope, user.uid))) closeLocalSession();
    };
    const recoverStuckAuth = () => {
        if (!isCurrent() || firebaseState.authRecoveryTimeout !== recoveryTimer) return;
        if (documentIsHidden()) {
            if (stopWaitingVisibility) return;
            stopWaitingVisibility = onDocumentVisibilityChange(() => {
                if (documentIsHidden()) return;
                clearHiddenRecovery();
                recoverStuckAuth();
            });
            return;
        }
        attemptAuthStorageRecovery(() => isCurrent() && firebaseState.authRecoveryTimeout === recoveryTimer);
    };
    const recoveryTimer = setTimeout(recoverStuckAuth, 8000);
    firebaseState.authRecoveryTimeout = recoveryTimer;

    let sessionUid = '';
    const unsubscribe = listenerFb.onAuthStateChanged(listenerAuth, (user) => {
        if (!isCurrent() || user !== listenerAuth.currentUser) return;
        clearHiddenRecovery();
        clearTimeout(firebaseState.authRecoveryTimeout);
        firebaseState.authRecoveryTimeout = null;
        if (user && firebaseState.authLoginOperation) return;
        const initialCapture = initialAuthLogoutIntents.get(listenerAuth) === initialIntent
            ? initialIntent.scope === listenerScope && initialIntent.config === safeStoreGet(appLocalStore, 'zoew_firebase_config') ? initialIntent.captured : null
            : undefined;
        if (user && !acceptLocalAuthSession(listenerAuth, listenerScope, user, false, initialCapture)) {
            closeLocalSession();
            return;
        }
        if (initialAuthLogoutIntents.get(listenerAuth) === initialIntent) initialAuthLogoutIntents.delete(listenerAuth);
        firebaseState.authGeneration++;
        const myAuthGeneration = firebaseState.authGeneration;
        if (user) {
            if (sessionUid && sessionUid !== user.uid) {
                clearSignedInView();
                clearSensitiveModalFields();
            }
            sessionUid = user.uid;
            firebaseState.autoLoginAttempted = false;
            armSessionExpiryCheck(user, myAuthGeneration);
            if (typeof listenerFb.resumeAcceptedSession === 'function') listenerFb.resumeAcceptedSession(listenerAuth);
            proceedAfterLogin(user, myAuthGeneration);
        } else {
            sessionUid = '';
            clearSignedInView();
            updateAuthButton(false);

            showLoginModalWithPrefill();
        }
    });
    window.addEventListener('storage', onLogoutStorage);
    firebaseState.authUnsubscribe = () => {
        active = false;
        window.removeEventListener('storage', onLogoutStorage);
        clearHiddenRecovery();
        clearTimeout(recoveryTimer);
        if (firebaseState.authRecoveryTimeout === recoveryTimer) firebaseState.authRecoveryTimeout = null;
        unsubscribe();
    };
}

export function loginWithFirebase() {
    if (!firebaseState.auth) {
        alert("សូមភ្ជាប់ប្រព័ន្ធជាមុនសិន ៖ ស្កេន QR ឬបើក Setup Link ពីអ្នកលក់!");
        checkPinAndOpenConfig();
        return;
    }
    if (viewState.loginBusy) return;

    const email = fieldValue('loginEmailInput').trim();
    const password = fieldValue('loginPasswordInput');
    const rememberMe = fieldChecked('rememberMeCheckbox');
    const rememberPassword = fieldChecked('rememberPasswordCheckbox');

    if (!email || !password) {
        alert(viewState.backendKind === 'supabase' ? "សូមបញ្ចូល ឈ្មោះគណនី និង ពាក្យសម្ងាត់!" : "សូមបញ្ចូល អ៊ីមែល និង ពាក្យសម្ងាត់!");
        return;
    }

    setRememberPasswordPref(rememberPassword);
    performLogin(email, password, rememberMe, rememberPassword);
}

export function performLogin(email, password, rememberMe, rememberPassword = !rememberPasswordPrefIsOff()) {
    if (!firebaseState.auth || viewState.loginBusy) return;
    if (!loginBackendIsReady()) {
        showToast('⚠️ ការភ្ជាប់ហាងមិនទាន់រួចរាល់ — សូមរង់ចាំ ឬ Refresh ទំព័រ។');
        return;
    }
    viewState.loginBusy = true;

    const generationAtLogin = firebaseState.authGeneration;
    const scopeAtLogin = loginBackendScope();
    const logoutIntentAtLogin = localLogoutIntent.capture(scopeAtLogin);
    if (!logoutIntentAtLogin.ready) {
        viewState.loginBusy = false;
        showToast('⚠️ មិនអាចផ្ទៀងផ្ទាត់វគ្គក្នុងឧបករណ៍នេះបានទេ — សូមអនុញ្ញាត Storage រួចចូលម្ដងទៀត។');
        return;
    }
    const loginAuth = firebaseState.auth;
    const loginFb = firebaseState.fb;
    const operation = {};
    firebaseState.authLoginOperation = operation;
    const isCurrent = () => firebaseState.authLoginOperation === operation && firebaseState.auth === loginAuth && firebaseState.fb === loginFb && loginBackendScope() === scopeAtLogin && loginBackendIsReady();

    return Promise.resolve().then(() => loginFb.setPersistence(loginAuth, rememberMe ? loginFb.browserLocalPersistence : loginFb.browserSessionPersistence))
        .then(() => {
            if (!isCurrent() || firebaseState.authGeneration !== generationAtLogin) return null;
            return loginFb.signInWithEmailAndPassword(loginAuth, email, password);
        })
        .then((userCredential) => {
            if (!isCurrent() || !userCredential || (firebaseState.authGeneration !== generationAtLogin && loginAuth.currentUser !== userCredential.user)) return;
            if (!localLogoutIntent.acknowledge(scopeAtLogin, userCredential.user.uid, logoutIntentAtLogin)
                || !acceptLocalAuthSession(loginAuth, scopeAtLogin, userCredential.user, true, logoutIntentAtLogin)) {
                localLogoutIntent.fence(scopeAtLogin, userCredential.user.uid);
                firebaseState.sessionExpiryCheck = 'signed-out';
                showLoginModalWithPrefill();
                throw new Error('វគ្គក្នុងឧបករណ៍នេះបានប្រែប្រួល — សូមចូលប្រព័ន្ធម្ដងទៀត។');
            }
            acceptedLogoutIntents.set(loginAuth, { user: userCredential.user, scope: scopeAtLogin,
                current: localLogoutIntent.witness(scopeAtLogin, userCredential.user.uid, logoutIntentAtLogin) });
            if (typeof loginFb.resumeAcceptedSession === 'function') loginFb.resumeAcceptedSession(loginAuth);
            firebaseState.autoLoginAttempted = false;

            if (rememberMe) {
                rememberLogin(email, scopeAtLogin);
            } else {
                forgetRememberedLogin();
            }
            if (rememberMe && rememberPassword) rememberLoginPassword(email, password, scopeAtLogin);
            else forgetLoginPassword();
            clearPendingInvite();

            if (firebaseState.authGeneration === generationAtLogin && userCredential && userCredential.user) {
                firebaseState.authGeneration++;
                armSessionExpiryCheck(userCredential.user, firebaseState.authGeneration);
                proceedAfterLogin(userCredential.user, firebaseState.authGeneration);
            }
        })
        .catch((error) => {
            if (!isCurrent()) return;
            alert("ការចូលប្រព័ន្ធមិនជោគជ័យ៖ " + error.message);
        })
        .finally(() => {
            if (firebaseState.authLoginOperation !== operation) return;
            firebaseState.authLoginOperation = null;
            viewState.loginBusy = false;
            if (firebaseState.auth === loginAuth && firebaseState.fb === loginFb && loginBackendScope() === scopeAtLogin) setFieldValue('loginPasswordInput', '');
        });
}

function loginBackendIsReady() {
    if (firebaseState.isInitializingFirebase || firebaseState.firebaseSdkUnavailable) return false;
    try {
        const scope = loginBackendScope();
        const options = firebaseState.auth && firebaseState.auth.app && firebaseState.auth.app.options;
        if (options && loginBackendScope(options) !== scope) return false;
        const saved = safeStoreGet(appLocalStore, 'zoew_firebase_config');
        return !saved || loginBackendScope(JSON.parse(saved)) === scope;
    } catch (e) {
        return false;
    }
}

export function updateAuthButton(isLoggedIn) {
    firebaseState.authButtonIsLoggedIn = !!isLoggedIn;
}

export function logoutApp() {
    cancelLicenseInvitation();
    clearLicenseInvitationIntent();
    const intentDurable = !firebaseState.auth?.currentUser?.uid || localLogoutIntent.note(loginBackendScope(), firebaseState.auth.currentUser.uid);
    const logoutGeneration = ++firebaseState.authGeneration;
    firebaseState.authLoginOperation = null;
    firebaseState.sessionExpiryCheck = 'signed-out';
    viewState.loginBusy = false;
    clearAppUnlockedForSession();
    clearSignedInView();
    hideAppLockScreen();
    if (firebaseState.auth) {
        const logoutAuth = firebaseState.auth;
        const logoutFb = firebaseState.fb;
        const scope = loginBackendScope();
        const user = logoutAuth.currentUser;
        const isCurrent = () => firebaseState.auth === logoutAuth && firebaseState.fb === logoutFb && loginBackendScope() === scope && (!logoutAuth.currentUser || logoutAuth.currentUser === user) && (firebaseState.authGeneration === logoutGeneration || !logoutAuth.currentUser) && !firebaseState.authLoginOperation;
        return withTimeout(Promise.resolve().then(() => isCurrent() ? logoutFb.signOut(logoutAuth) : undefined), DB_OP_TIMEOUT_MS, 'Sign out stalled').then(() => {
            if (!isCurrent()) return;
            resetClearHistoryOperationState();
            clearRememberedSession(false);
            showLoginModalWithPrefill();
            showToast("✅ បានចាកចេញពីប្រព័ន្ធ!");
        }).catch(() => {
            if (!isCurrent()) return;
            resetClearHistoryOperationState();
            clearRememberedSession(false);
            showLoginModalWithPrefill();
            showToast(intentDurable ? '⚠️ មិនអាចបញ្ជាក់ថាបានចាកចេញពីឧបករណ៍នេះទេ — វគ្គក្នុង App ត្រូវបានបិទ។ សូមចូលប្រព័ន្ធម្ដងទៀតដើម្បីបន្ត។' : LOCAL_LOGOUT_UNPERSISTED_TOAST);
        });
    }
}
