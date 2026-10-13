import { openModalIds } from '../core/modals';
import { firebaseState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { appSessionStore, safeStoreRemove, safeStoreSet } from '../core/storage';
import { FIREBASE_SDK_RELOAD_KEY } from '../core/storage-keys';
import { initFirebase } from './firebase-init';
import { fetchWithTimeout } from './network';

export const FIREBASE_SDK_RETRY_STEPS_MS = [5000, 10000, 20000, 30000, 60000];

export const FIREBASE_SDK_RETRY_MIN_GAP_MS = 3000;

export const FIREBASE_SDK_RELOAD_MAX = 3;

export const FIREBASE_SDK_RELOAD_MIN_GAP_MS = 20000;

export const FIREBASE_SDK_PROBE_URL = 'https://www.gstatic.com/generate_204';

export const FIREBASE_SDK_PROBE_TIMEOUT_MS = 8000;

export const FIREBASE_SDK_REFRESH_TEXT = '⚠️ ភ្ជាប់ Server មិនបានទេ — សូមពិនិត្យបណ្តាញ រួច Refresh ទំព័រ';

export function clearFirebaseSdkRetry() {
    if (firebaseState.firebaseSdkRetryTimer) {
        clearTimeout(firebaseState.firebaseSdkRetryTimer);
        firebaseState.firebaseSdkRetryTimer = null;
    }
    firebaseState.firebaseSdkRetryAttempt = 0;
}

export function resetFirebaseSdkRetryHealth() {
    clearFirebaseSdkRetry();
    firebaseState.lastFirebaseSdkAttemptAt = 0;
    firebaseState.lastFirebaseSdkReloadAt = 0;
    safeStoreRemove(appSessionStore, FIREBASE_SDK_RELOAD_KEY);
}

export function anyModalIsOpen() {
    return openModalIds().length > 0;
}

export function firebaseSdkReloadCount() {
    try {
        const raw = appSessionStore.getItem(FIREBASE_SDK_RELOAD_KEY);
        return parseInt(raw, 10) || 0;
    } catch (e) {
        return FIREBASE_SDK_RELOAD_MAX;
    }
}

export function probeFirebaseSdkHost() {
    try {
        return fetchWithTimeout(FIREBASE_SDK_PROBE_URL, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', credentials: 'omit' },
            FIREBASE_SDK_PROBE_TIMEOUT_MS, 'Firebase SDK probe timed out').then(() => true, () => false);
    } catch (e) {
        return Promise.resolve(false);
    }
}

export function firebaseSdkReloadAllowed() {
    if (!firebaseState.firebaseSdkUnavailable) return false;
    if (typeof window.firebaseSDK !== 'undefined' && window.firebaseSDK) return false;
    if ((navigator.onLine as boolean) === false) return false;
    if (anyModalIsOpen()) return false;
    if (firebaseSdkReloadCount() >= FIREBASE_SDK_RELOAD_MAX) return false;
    return elapsedSince(firebaseState.lastFirebaseSdkReloadAt) >= FIREBASE_SDK_RELOAD_MIN_GAP_MS;
}

export function firebaseSdkNeedsRefresh() {
    if (!firebaseState.firebaseSdkUnavailable) return false;
    if (typeof window.firebaseSDK !== 'undefined' && window.firebaseSDK) return false;
    return firebaseSdkReloadCount() >= FIREBASE_SDK_RELOAD_MAX;
}

export function reloadForFirebaseSdk() {
    if (!firebaseSdkReloadAllowed()) return false;
    if (firebaseState.firebaseSdkProbeInFlight) return true;
    firebaseState.firebaseSdkProbeInFlight = true;
    probeFirebaseSdkHost().then((reachable) => {
        firebaseState.firebaseSdkProbeInFlight = false;
        if (reachable && firebaseSdkReloadAllowed()) {
            firebaseState.lastFirebaseSdkReloadAt = Date.now();
            safeStoreSet(appSessionStore, FIREBASE_SDK_RELOAD_KEY, String(firebaseSdkReloadCount() + 1));
            window.location.reload();
            return;
        }
        if (firebaseState.firebaseSdkUnavailable) scheduleFirebaseSdkRetry();
    });
    return true;
}

export function armLateFirebaseSdkListener() {
    if (firebaseState.lateFirebaseSdkListenerArmed) return;
    firebaseState.lateFirebaseSdkListenerArmed = true;
    window.addEventListener('firebasesdkready', () => {
        firebaseState.lateFirebaseSdkListenerArmed = false;
        if (firebaseState.isDatabaseInitialized || firebaseState.isInitializingFirebase) return;
        clearFirebaseSdkRetry();
        initFirebase();
    }, { once: true });
}

export function recoverFirebaseSdk() {
    if (!firebaseState.firebaseSdkUnavailable) { clearFirebaseSdkRetry(); return; }
    if (reloadForFirebaseSdk()) return;
    initFirebase();
}

export function scheduleFirebaseSdkRetry() {
    if (firebaseState.firebaseSdkRetryTimer || firebaseState.isDatabaseInitialized) return;
    if (firebaseSdkNeedsRefresh()) return;
    const step = FIREBASE_SDK_RETRY_STEPS_MS[Math.min(firebaseState.firebaseSdkRetryAttempt, FIREBASE_SDK_RETRY_STEPS_MS.length - 1)];
    firebaseState.firebaseSdkRetryAttempt++;
    firebaseState.firebaseSdkRetryTimer = setTimeout(() => {
        firebaseState.firebaseSdkRetryTimer = null;
        if (firebaseState.isDatabaseInitialized) { clearFirebaseSdkRetry(); return; }
        firebaseState.lastFirebaseSdkAttemptAt = Date.now();
        recoverFirebaseSdk();
    }, step);
}

export function retryFirebaseSdkNow() {
    if (!firebaseState.firebaseSdkUnavailable || firebaseState.isDatabaseInitialized || firebaseState.isInitializingFirebase) return;
    if ((navigator.onLine as boolean) === false) return;
    if (firebaseSdkNeedsRefresh()) return;
    const sinceLastAttempt = elapsedSince(firebaseState.lastFirebaseSdkAttemptAt);
    if (sinceLastAttempt < FIREBASE_SDK_RETRY_MIN_GAP_MS) {
        if (!firebaseState.firebaseSdkRetryTimer) {
            firebaseState.firebaseSdkRetryTimer = setTimeout(() => {
                firebaseState.firebaseSdkRetryTimer = null;
                retryFirebaseSdkNow();
            }, FIREBASE_SDK_RETRY_MIN_GAP_MS - sinceLastAttempt);
        }
        return;
    }
    clearFirebaseSdkRetry();
    firebaseState.lastFirebaseSdkAttemptAt = Date.now();
    recoverFirebaseSdk();
}
