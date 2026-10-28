import { fieldChecked, fieldValue, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { dataState, firebaseState, uiState } from '../core/state';
import { appLocalStore, appSessionStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { AUTH_STUCK_RECOVERY_FLAG } from '../core/storage-keys';
import { clearPendingInvite } from './account';
import { clearAppUnlockedForSession } from './app-lock';
import { resetClearHistoryOperationState } from './clear-history';
import { checkPinAndOpenConfig } from './config';
import { clearCustomerDataTableCache } from './customer-table';
import { proceedAfterLogin } from './license';
import { applyCurrentFilter } from './monthly-report';
import { forgetRememberedLogin, loginBackendScope, rememberLogin } from './login-memory';
import { forgetLoginPassword, rememberLoginPassword, rememberPasswordPrefIsOff, setRememberPasswordPref } from './password-memory';
import { clearRememberedSession, clearSensitiveModalFields, showLoginModalWithPrefill } from './session';
import { renderRecentlyDeleted } from './trash';
import { detachDatabaseListeners, resetDbListenerHealthState, updateRecentPhonesList } from '../services/db-listeners';
import { showToast } from '../ui/toast';
import { documentIsHidden, onDocumentVisibilityChange } from '../platform/document-io';

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
    let active = true;
    const isCurrent = () => active && firebaseState.auth === listenerAuth && firebaseState.fb === listenerFb && loginBackendScope() === listenerScope;
    const recoverStuckAuth = () => {
        if (!isCurrent() || firebaseState.authRecoveryTimeout !== recoveryTimer) return;
        if (documentIsHidden()) {
            const stopWaiting = onDocumentVisibilityChange(() => {
                if (documentIsHidden()) return;
                stopWaiting();
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
        clearTimeout(firebaseState.authRecoveryTimeout);
        firebaseState.authRecoveryTimeout = null;
        firebaseState.authGeneration++;
        const myAuthGeneration = firebaseState.authGeneration;
        if (user) {
            if (sessionUid && sessionUid !== user.uid) {
                clearSignedInView();
                clearSensitiveModalFields();
            }
            sessionUid = user.uid;
            firebaseState.autoLoginAttempted = false;
            proceedAfterLogin(user, myAuthGeneration);
        } else {
            sessionUid = '';
            clearSignedInView();
            updateAuthButton(false);

            showLoginModalWithPrefill();
        }
    });
    firebaseState.authUnsubscribe = () => {
        active = false;
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
    const logoutGeneration = ++firebaseState.authGeneration;
    firebaseState.authLoginOperation = null;
    viewState.loginBusy = false;
    clearAppUnlockedForSession();
    if (firebaseState.auth) {
        const logoutAuth = firebaseState.auth;
        const logoutFb = firebaseState.fb;
        const scope = loginBackendScope();
        const user = logoutAuth.currentUser;
        const isCurrent = () => firebaseState.auth === logoutAuth && firebaseState.fb === logoutFb && loginBackendScope() === scope && (!logoutAuth.currentUser || logoutAuth.currentUser === user) && (firebaseState.authGeneration === logoutGeneration || !logoutAuth.currentUser) && !firebaseState.authLoginOperation;
        return Promise.resolve().then(() => logoutFb.signOut(logoutAuth)).then(() => {
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
            showToast("⚠️ មិនអាចបញ្ជាក់ថាបានចាកចេញពីឧបករណ៍នេះទេ — បានសម្អាតការចងចាំក្នុង App ប៉ុណ្ណោះ។ សូម Refresh ហើយសាកចាកចេញម្តងទៀត។");
        });
    }
}
