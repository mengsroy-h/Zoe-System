import { fieldChecked, fieldValue, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { dataState, firebaseState, uiState } from '../core/state';
import { appSessionStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { AUTH_STUCK_RECOVERY_FLAG } from '../core/storage-keys';
import { clearPendingInvite } from './account';
import { clearAppUnlockedForSession } from './app-lock';
import { resetClearHistoryOperationState } from './clear-history';
import { checkPinAndOpenConfig } from './config';
import { clearCustomerDataTableCache } from './customer-table';
import { proceedAfterLogin } from './license';
import { applyCurrentFilter } from './monthly-report';
import { forgetRememberedLogin, loginBackendScope, rememberLogin } from './login-memory';
import { clearRememberedSession, showLoginModalWithPrefill } from './session';
import { renderRecentlyDeleted } from './trash';
import { detachDatabaseListeners, resetDbListenerHealthState, updateRecentPhonesList } from '../services/db-listeners';
import { showToast } from '../ui/toast';

export async function attemptAuthStorageRecovery() {
    if (safeStoreGet(appSessionStore, AUTH_STUCK_RECOVERY_FLAG)) {
        showLoginModalWithPrefill();
        return;
    }
    safeStoreSet(appSessionStore, AUTH_STUCK_RECOVERY_FLAG, '1');
    try {
        if ('indexedDB' in window && typeof indexedDB.databases === 'function') {
            const dbs = await indexedDB.databases();
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
    window.location.reload();
}

export function setupAuthListener() {
    if (!firebaseState.auth) return;

    if (firebaseState.authUnsubscribe) {
        try { firebaseState.authUnsubscribe(); } catch (e) {}
        firebaseState.authUnsubscribe = null;
    }
    if (firebaseState.authRecoveryTimeout) {
        clearTimeout(firebaseState.authRecoveryTimeout);
        firebaseState.authRecoveryTimeout = null;
    }

    firebaseState.authRecoveryTimeout = setTimeout(() => { attemptAuthStorageRecovery(); }, 8000);

    firebaseState.authUnsubscribe = firebaseState.fb.onAuthStateChanged(firebaseState.auth, (user) => {
        clearTimeout(firebaseState.authRecoveryTimeout);
        firebaseState.authRecoveryTimeout = null;
        firebaseState.authGeneration++;
        const myAuthGeneration = firebaseState.authGeneration;
        if (user) {
            firebaseState.autoLoginAttempted = false;
            proceedAfterLogin(user, myAuthGeneration);
        } else {
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
            updateAuthButton(false);

            showLoginModalWithPrefill();
        }
    });
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

    if (!email || !password) {
        alert(viewState.backendKind === 'supabase' ? "សូមបញ្ចូល ឈ្មោះគណនី និង ពាក្យសម្ងាត់!" : "សូមបញ្ចូល អ៊ីមែល និង ពាក្យសម្ងាត់!");
        return;
    }

    performLogin(email, password, rememberMe);
}

export function performLogin(email, password, rememberMe) {
    if (!firebaseState.auth || viewState.loginBusy) return;
    viewState.loginBusy = true;

    const generationAtLogin = firebaseState.authGeneration;
    const scopeAtLogin = loginBackendScope();

    firebaseState.fb.setPersistence(firebaseState.auth, rememberMe ? firebaseState.fb.browserLocalPersistence : firebaseState.fb.browserSessionPersistence)
        .then(() => {
            return firebaseState.fb.signInWithEmailAndPassword(firebaseState.auth, email, password);
        })
        .then((userCredential) => {
            firebaseState.autoLoginAttempted = false;

            if (rememberMe) {
                rememberLogin(email, scopeAtLogin);
            } else {
                forgetRememberedLogin();
            }
            clearPendingInvite();

            if (firebaseState.authGeneration === generationAtLogin && userCredential && userCredential.user) {
                firebaseState.authGeneration++;
                proceedAfterLogin(userCredential.user, firebaseState.authGeneration);
            }
        })
        .catch((error) => {
            alert("ការចូលប្រព័ន្ធមិនជោគជ័យ៖ " + error.message);
        })
        .finally(() => {
            viewState.loginBusy = false;
            setFieldValue('loginPasswordInput', '');
        });
}

export function updateAuthButton(isLoggedIn) {
    firebaseState.authButtonIsLoggedIn = !!isLoggedIn;
}

export function logoutApp() {
    clearAppUnlockedForSession();
    if (firebaseState.auth) {
        firebaseState.fb.signOut(firebaseState.auth).then(() => {
            resetClearHistoryOperationState();
            clearRememberedSession(false);
            showLoginModalWithPrefill();
            showToast("✅ បានចាកចេញពីប្រព័ន្ធ!");
        }).catch(() => {
            resetClearHistoryOperationState();
            clearRememberedSession(false);
            showLoginModalWithPrefill();
            showToast("⚠️ មិនអាចបញ្ជាក់ថាបានចាកចេញពី Firebase ទេ — បានសម្អាតការចងចាំក្នុង App ប៉ុណ្ណោះ។ សូមពិនិត្យបណ្ដាញ ហើយសាកម្តងទៀត។");
        });
    }
}
