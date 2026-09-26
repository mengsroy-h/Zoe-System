const APP_VERSION = '2.20.5';

const appLocalStore = (function () { try { return window.localStorage; } catch (e) { return null; } })();
const appSessionStore = (function () { try { return window.sessionStorage; } catch (e) { return null; } })();

let authButtonIsLoggedIn = false;

const ACTION_ALLOWLIST = [
    "blockFormSubmit",
    "clearSigningKey",
    "closeModal",
    "confirmExtendKey",
    "copyGeneratedKey",
    "copySetupLink",
    "copyTextarea",
    "dismissKeypairModal",
    "doLogin",
    "generateLicenseKey",
    "generateNewKeypair",
    "generateSetupLink",
    "loadSigningKey",
    "migrateLegacyLicenseKeyMetadata",
    "navAuthFlow",
    "openConfigFlow",
    "refreshKeyList",
    "saveFirebaseConfig",
    "saveNewSecurityPin",
    "verifySecurityPin"
];
function readActionArgs(el, event) {
    const raw = el.getAttribute('data-args');
    let args = [];
    if (raw) {
        try { args = JSON.parse(raw); } catch (e) { args = []; }
        if (!Array.isArray(args)) args = [args];
    } else {
        const a1 = el.getAttribute('data-a1');
        const a2 = el.getAttribute('data-a2');
        if (a1 !== null) args.push(a1);
        if (a2 !== null) args.push(a2);
    }
    if (el.getAttribute('data-evt')) args.unshift(event);
    if (el.getAttribute('data-self')) args.unshift(el);
    return args;
}

function runElementAction(el, event) {
    const name = el.getAttribute('data-act');
    if (!name || ACTION_ALLOWLIST.indexOf(name) === -1) return;
    const fn = window[name];
    if (typeof fn !== 'function') return;
    fn.apply(null, readActionArgs(el, event));
}

function setupActionDelegation() {
    ['click', 'change', 'input', 'submit'].forEach((type) => {
        document.addEventListener(type, (event) => {
            const el = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
            if (!el) return;
            const want = el.getAttribute('data-on') || 'click';
            if (want !== type) return;
            runElementAction(el, event);
        });
    });
}
function blockFormSubmit(event) {
    if (event) event.preventDefault();
}

const LICENSE_APP_CODE = 'ZOE';

function renderAppVersionLabels() {
    document.querySelectorAll('[data-app-version]').forEach((el) => {
        el.textContent = 'កំណែប្រព័ន្ធ: ' + APP_VERSION;
    });
}

renderAppVersionLabels();

function elapsedSince(mark) {
    if (!mark) return Infinity;
    const delta = Date.now() - mark;
    return delta >= 0 ? delta : Infinity;
}

const BOOT_SPLASH_MIN_MS = 380;
const BOOT_REVEAL_CLEANUP_MS = 760;
const bootSplashStartedAt = Date.now();

function hideBootSplash() {
    const splash = document.getElementById('bootSplash');
    if (!splash || splash.classList.contains('boot-splash-out')) return;
    splash.classList.add('boot-splash-out');
    document.body.classList.add('boot-reveal');
    setTimeout(() => {
        splash.classList.add('boot-splash-gone');
        document.body.classList.remove('boot-reveal');
    }, BOOT_REVEAL_CLEANUP_MS);
}

function revealAppAfterBoot() {
    const wait = Math.max(0, BOOT_SPLASH_MIN_MS - elapsedSince(bootSplashStartedAt));
    setTimeout(() => {
        requestAnimationFrame(() => requestAnimationFrame(hideBootSplash));
    }, wait);
}

(function () {

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => { window.scrollTo(0, 0); });
    }

    function kickUserOut() {
        window.location.replace("about:blank");
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let devToolsHitCount = 0;

    document.addEventListener('keydown', function (e) {
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
            (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
        ) {
            e.preventDefault();
            e.stopPropagation();
            kickUserOut();
            return false;
        }
    }, true);

    document.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        return false;
    }, true);

    const baseWidthGap = window.outerWidth - window.innerWidth;
    const baseHeightGap = window.outerHeight - window.innerHeight;

    function checkDevTools() {
        if (isMobile) return;
        const widthGrew = (window.outerWidth - window.innerWidth) - baseWidthGap > 160;
        const heightGrew = (window.outerHeight - window.innerHeight) - baseHeightGap > 160;
        if (widthGrew !== heightGrew) {
            devToolsHitCount++;
            if (devToolsHitCount >= 2) kickUserOut();
        } else {
            devToolsHitCount = 0;
        }
    }
    setInterval(checkDevTools, 1000);

    function showUpdateAvailableBanner() {
        if (document.getElementById('zoeUpdateBanner')) return;
        const banner = document.createElement('div');
        banner.id = 'zoeUpdateBanner';
        banner.className = 'app-update-banner';
        const label = document.createElement('span');
        label.textContent = '🔄 មានកំណែថ្មីរបស់កម្មវិធី — សូម Refresh នៅពេលងាយស្រួល';
        const refreshBtn = document.createElement('button');
        refreshBtn.type = 'button';
        refreshBtn.className = 'app-update-refresh';
        refreshBtn.textContent = 'Refresh ឥឡូវនេះ';
        refreshBtn.addEventListener('click', () => window.location.reload());
        const dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.className = 'app-update-dismiss';
        dismissBtn.textContent = '✕';
        dismissBtn.setAttribute('aria-label', 'បិទ');
        dismissBtn.addEventListener('click', () => banner.remove());
        banner.appendChild(label);
        banner.appendChild(refreshBtn);
        banner.appendChild(dismissBtn);
        document.body.appendChild(banner);
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then((reg) => {
                const SW_UPDATE_MIN_GAP_MS = 15 * 60 * 1000;
                let lastSwUpdateAt = Date.now();
                const throttledSwUpdate = () => {
                    if (navigator.onLine === false) return;
                    if (elapsedSince(lastSwUpdateAt) < SW_UPDATE_MIN_GAP_MS) return;
                    lastSwUpdateAt = Date.now();
                    reg.update().catch(() => {});
                };
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') throttledSwUpdate();
                });
                window.addEventListener('focus', throttledSwUpdate);
                window.addEventListener('online', throttledSwUpdate);

                setInterval(throttledSwUpdate, 30 * 60 * 1000);
            }).catch(() => {});

            const hadControllerAtLoad = !!navigator.serviceWorker.controller;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (hadControllerAtLoad) showUpdateAvailableBanner();
            });
        });
    }
})();

let firebaseConfig = null;
let fb = null;
let auth = null;
let db = null;
let authUnsubscribe = null;
let authGeneration = 0;
let sensitiveSessionGeneration = 0;
let pendingRoleRecheck = false;
let isDatabaseConnected = false;
let hasEverConnectedToDatabase = false;
let networkJustReturned = false;
let reconnectWatchdogTimer = null;
let reconnectWatchdogAttempt = 0;
let lastForcedReconnectAt = 0;
let lastRoleRestOutcome = '';
const ROLE_CHECK_CONNECT_WAIT_MS = 45000;
const SLOW_NETWORK_NOTICE_MS = 4000;
let isInitializingFirebase = false;
let dbRefConnected = null;
let dbRefServerTimeOffset = null;
let infoListenerGeneration = 0;
let serverTimeOffsetMs = 0;
let serverTimeSynced = false;
let serverTimeSyncWaiters = [];

function serverClockOffsetIsFromServer(offsetMs) {
    return offsetMs !== 0 || isDatabaseConnected || hasEverConnectedToDatabase;
}

const RECONNECT_FORCE_MIN_GAP_MS = 3000;
const RECONNECT_WATCHDOG_STEPS_MS = [5000, 10000, 20000, 40000, 60000];
const INFO_LISTENER_RECOVERY_STEPS_MS = [2000, 5000, 10000, 20000, 30000];
const INFO_LISTENER_KEY_CONNECTED = 'connected';
const INFO_LISTENER_KEY_OFFSET = 'serverTimeOffset';
const infoListenerFailedPaths = new Set();
const CONNECTING_GRACE_ATTEMPTS = 3;

function connectionLooksOnline() {
    return isDatabaseConnected && navigator.onLine !== false;
}

function connectionIsSettlingIn() {
    if (isDatabaseConnected || navigator.onLine === false) return false;
    if (firebaseSdkUnavailable) return false;
    return reconnectWatchdogAttempt < CONNECTING_GRACE_ATTEMPTS;
}

const FIREBASE_SDK_RETRY_STEPS_MS = [5000, 10000, 20000, 30000, 60000];
const FIREBASE_SDK_RETRY_MIN_GAP_MS = 3000;
const FIREBASE_SDK_RELOAD_KEY = 'zoe_firebase_sdk_reload_count';
const FIREBASE_SDK_RELOAD_MAX = 3;
const FIREBASE_SDK_RELOAD_MIN_GAP_MS = 20000;
let firebaseSdkRetryTimer = null;
let firebaseSdkRetryAttempt = 0;
let lastFirebaseSdkAttemptAt = 0;
let lastFirebaseSdkReloadAt = 0;
let infoListenersFailed = false;
let infoListenerRecoveryTimer = null;
let infoListenerRecoveryAttempt = 0;
let lateFirebaseSdkListenerArmed = false;
let firebaseSdkUnavailable = false;
let sdkUnavailableNoticeShown = false;

function clearFirebaseSdkRetry() {
    if (firebaseSdkRetryTimer) {
        clearTimeout(firebaseSdkRetryTimer);
        firebaseSdkRetryTimer = null;
    }
    firebaseSdkRetryAttempt = 0;
}

function resetFirebaseSdkRetryHealth() {
    clearFirebaseSdkRetry();
    lastFirebaseSdkAttemptAt = 0;
    lastFirebaseSdkReloadAt = 0;
    safeStoreRemove(appSessionStore, FIREBASE_SDK_RELOAD_KEY);
}

function anyModalIsOpen() {
    const modals = document.querySelectorAll('.modal');
    for (let i = 0; i < modals.length; i++) {
        const el = modals[i];
        if (el.classList && el.classList.contains('active')) return true;
        if (el.style && el.style.display === 'flex') return true;
    }
    return false;
}

function firebaseSdkReloadCount() {
    try {
        const raw = appSessionStore.getItem(FIREBASE_SDK_RELOAD_KEY);
        return parseInt(raw, 10) || 0;
    } catch (e) {
        return FIREBASE_SDK_RELOAD_MAX;
    }
}

function reloadForFirebaseSdk() {
    if (!firebaseSdkUnavailable) return false;
    if (typeof window.firebaseSDK !== 'undefined' && window.firebaseSDK) return false;
    if (navigator.onLine === false) return false;
    if (anyModalIsOpen()) return false;
    const used = firebaseSdkReloadCount();
    if (used >= FIREBASE_SDK_RELOAD_MAX) return false;
    if (elapsedSince(lastFirebaseSdkReloadAt) < FIREBASE_SDK_RELOAD_MIN_GAP_MS) return false;
    lastFirebaseSdkReloadAt = Date.now();
    safeStoreSet(appSessionStore, FIREBASE_SDK_RELOAD_KEY, String(used + 1));
    window.location.reload();
    return true;
}

function armLateFirebaseSdkListener() {
    if (lateFirebaseSdkListenerArmed) return;
    lateFirebaseSdkListenerArmed = true;
    window.addEventListener('firebasesdkready', () => {
        lateFirebaseSdkListenerArmed = false;
        if (isDatabaseInitialized || isInitializingFirebase) return;
        clearFirebaseSdkRetry();
        initFirebase();
    }, { once: true });
}

function recoverFirebaseSdk() {
    if (!firebaseSdkUnavailable) { clearFirebaseSdkRetry(); return; }
    if (reloadForFirebaseSdk()) return;
    initFirebase();
}

function scheduleFirebaseSdkRetry() {
    if (firebaseSdkRetryTimer || isDatabaseInitialized) return;
    const step = FIREBASE_SDK_RETRY_STEPS_MS[Math.min(firebaseSdkRetryAttempt, FIREBASE_SDK_RETRY_STEPS_MS.length - 1)];
    firebaseSdkRetryAttempt++;
    firebaseSdkRetryTimer = setTimeout(() => {
        firebaseSdkRetryTimer = null;
        if (isDatabaseInitialized) { clearFirebaseSdkRetry(); return; }
        lastFirebaseSdkAttemptAt = Date.now();
        recoverFirebaseSdk();
    }, step);
}

function retryFirebaseSdkNow() {
    if (!firebaseSdkUnavailable || isDatabaseInitialized || isInitializingFirebase) return;
    if (navigator.onLine === false) return;
    const sinceLastAttempt = elapsedSince(lastFirebaseSdkAttemptAt);
    if (sinceLastAttempt < FIREBASE_SDK_RETRY_MIN_GAP_MS) {
        if (!firebaseSdkRetryTimer) {
            firebaseSdkRetryTimer = setTimeout(() => {
                firebaseSdkRetryTimer = null;
                retryFirebaseSdkNow();
            }, FIREBASE_SDK_RETRY_MIN_GAP_MS - sinceLastAttempt);
        }
        return;
    }
    clearFirebaseSdkRetry();
    lastFirebaseSdkAttemptAt = Date.now();
    recoverFirebaseSdk();
}

function renderConnectionStatus() {
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('firebaseStatusText');
    const online = connectionLooksOnline();
    const settling = !online && connectionIsSettlingIn();
    if (dot) {
        dot.classList.toggle('online', online);
        dot.classList.toggle('connecting', settling);
    }
    if (txt) {
        txt.classList.toggle('is-online', online);
        txt.classList.toggle('is-connecting', !online && settling);
        txt.classList.toggle('is-offline', !online && !settling);
        txt.textContent = online ? 'ភ្ជាប់បណ្ដាញ' : (settling ? 'កំពុងភ្ជាប់...' : 'ក្រៅបណ្ដាញ');
    }
    refreshLiveToasts();
}

function clearReconnectWatchdog() {
    if (reconnectWatchdogTimer) {
        clearTimeout(reconnectWatchdogTimer);
        reconnectWatchdogTimer = null;
    }
    reconnectWatchdogAttempt = 0;
}

function canCycleDatabaseConnection() {
    return hasEverConnectedToDatabase || networkJustReturned;
}

function forceDatabaseReconnect() {
    if (!fb || !db || typeof fb.goOnline !== 'function') return false;
    if (elapsedSince(lastForcedReconnectAt) < RECONNECT_FORCE_MIN_GAP_MS) return false;
    lastForcedReconnectAt = Date.now();
    try {
        if (canCycleDatabaseConnection() && typeof fb.goOffline === 'function') {
            networkJustReturned = false;
            fb.goOffline(db);
        }
    } catch (e) {}
    try { fb.goOnline(db); } catch (e) { return false; }
    return true;
}

function scheduleReconnectWatchdog() {
    if (reconnectWatchdogTimer) return;
    if (!fb || !db) return;
    const step = RECONNECT_WATCHDOG_STEPS_MS[Math.min(reconnectWatchdogAttempt, RECONNECT_WATCHDOG_STEPS_MS.length - 1)];
    reconnectWatchdogTimer = setTimeout(() => {
        reconnectWatchdogTimer = null;
        if (isDatabaseConnected || navigator.onLine === false) { clearReconnectWatchdog(); return; }
        reconnectWatchdogAttempt++;
        renderConnectionStatus();
        forceDatabaseReconnect();
        scheduleReconnectWatchdog();
    }, step);
}

function nudgeDatabaseConnection() {
    if (!fb || !db || typeof fb.goOnline !== 'function') return;
    if (isDatabaseConnected) { try { fb.goOnline(db); } catch (e) {} return; }
    if (navigator.onLine === false) return;
    forceDatabaseReconnect();
    scheduleReconnectWatchdog();
}

function setupConnectionRecovery() {
    window.addEventListener('online', () => {
        networkJustReturned = true;
        renderConnectionStatus();
        retryFirebaseSdkNow();
        nudgeDatabaseConnection();
        retryPendingRoleCheck();
        if (window.ZoeLicense && typeof ZoeLicense.syncServerTime === 'function') {
            ZoeLicense.syncServerTime().catch(() => {});
        }
    });
    window.addEventListener('offline', () => {
        clearReconnectWatchdog();
        renderConnectionStatus();
    });
}

function getServerNow() {
    return Date.now() + serverTimeOffsetMs;
}

function waitForServerTimeSync(timeoutMs) {
    if (serverTimeSynced) return Promise.resolve(true);
    return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(result);
        };
        const timer = setTimeout(() => finish(serverTimeSynced), timeoutMs);
        serverTimeSyncWaiters.push(() => finish(true));

        if (window.ZoeLicense) {
            window.ZoeLicense.syncServerTime().then((ok) => {
                if (settled || serverTimeSynced || !ok) return;
                const offset = window.ZoeLicense.getServerTimeOffset();
                if (typeof offset === 'number') {
                    serverTimeOffsetMs = offset;
                    serverTimeSynced = true;
                    finish(true);
                }
            }).catch(() => {});
        }
    });
}

const TOAST_LIFETIME_MS = 3000;
const TOAST_LIVE_LIMIT_MS = 20000;
const TOAST_CLASSES = { info: 'toast-info', success: 'toast-success', warn: 'toast-warn', error: 'toast-error' };
const SESSION_SIGNED_OUT_TOAST = '⚠️ បានចាកចេញពីប្រព័ន្ធ — សូមចូលប្រព័ន្ធម្ដងទៀត';
const TOAST_KIND_MARKS = [
    ['error', ['❌', '⛔', '🚫']],
    ['warn', ['⚠️', '⏱️']],
    ['success', ['✅', '🎉', '🔓']]
];

function toastKindOf(msg) {
    const text = String(msg === null || msg === undefined ? '' : msg).trim();
    for (let i = 0; i < TOAST_KIND_MARKS.length; i++) {
        const marks = TOAST_KIND_MARKS[i][1];
        for (let j = 0; j < marks.length; j++) {
            if (text.indexOf(marks[j]) === 0) return TOAST_KIND_MARKS[i][0];
        }
    }
    return 'info';
}

function paintToast(el, msg, kind) {
    const resolved = TOAST_CLASSES[kind] ? kind : toastKindOf(msg);
    Object.keys(TOAST_CLASSES).forEach((name) => el.classList.toggle(TOAST_CLASSES[name], name === resolved));
    el.textContent = msg;
}

function armToastDismiss(el, delay) {
    if (el.dismissTimer) clearTimeout(el.dismissTimer);
    el.dismissTimer = setTimeout(() => {
        el.dismissTimer = null;
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, delay);
}

function dropOldestToast(container) {
    const children = container.children;
    let victim = null;
    for (let i = 0; i < children.length; i++) {
        if (children[i].dataset && children[i].dataset.liveToast !== undefined) continue;
        victim = children[i];
        break;
    }
    if (!victim) victim = container.firstChild;
    if (!victim) return;
    if (victim.dismissTimer) { clearTimeout(victim.dismissTimer); victim.dismissTimer = null; }
    container.removeChild(victim);
}

function showToast(msg, kind) {
    const container = document.getElementById('toastContainer');
    if (!container) return null;
    while (container.children.length >= 4) dropOldestToast(container);
    const toast = document.createElement('div');
    toast.className = 'toast';
    paintToast(toast, msg, kind);
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    armToastDismiss(toast, TOAST_LIFETIME_MS);
    return toast;
}

function settleLiveToast(el) {
    delete el.dataset.liveToast;
    armToastDismiss(el, TOAST_LIFETIME_MS);
}

function showLiveToast(key) {
    const state = liveToastState(key);
    if (!state) return null;
    const toast = showToast(state.msg, state.kind);
    if (!toast || state.settled) return toast;
    toast.dataset.liveToast = key;
    armToastDismiss(toast, TOAST_LIVE_LIMIT_MS);
    return toast;
}

function refreshLiveToasts() {
    const container = document.getElementById('toastContainer');
    if (!container || typeof container.querySelectorAll !== 'function') return;
    const live = container.querySelectorAll('[data-live-toast]');
    for (let i = 0; i < live.length; i++) {
        const el = live[i];
        const state = liveToastState(el.dataset.liveToast);
        if (!state) { settleLiveToast(el); continue; }
        paintToast(el, state.msg, state.kind);
        if (state.settled) settleLiveToast(el);
    }
}

function liveToastState(key) {
    if (key !== 'signin' && key !== 'config') return null;
    if (key === 'signin' && (!isSignedInUiActive || !auth || !auth.currentUser)) {
        return { msg: SESSION_SIGNED_OUT_TOAST, kind: 'warn', settled: true };
    }
    if (navigator.onLine === false) {
        return key === 'signin'
            ? { msg: '⚠️ ចូលប្រព័ន្ធរួច តែឧបករណ៍ក្រៅបណ្ដាញ — បញ្ជី Key មិនទាន់សម័យ', kind: 'warn', settled: false }
            : { msg: '⚠️ រក្សាទុក Config រួច តែឧបករណ៍ក្រៅបណ្ដាញ — មិនទាន់ភ្ជាប់ Server ទេ', kind: 'warn', settled: false };
    }
    if (!connectionLooksOnline()) {
        return { msg: '🔄 កំពុងតភ្ជាប់ទៅ Server...', kind: 'info', settled: false };
    }
    return key === 'signin'
        ? { msg: '✅ ចូលប្រព័ន្ធជោគជ័យ — ភ្ជាប់ Server រួចរាល់', kind: 'success', settled: true }
        : { msg: '✅ ភ្ជាប់ Server រួចរាល់!', kind: 'success', settled: true };
}

function invalidateSensitiveSession() {
    sensitiveSessionGeneration++;
}

function captureSensitiveSession(requireAuthorizedUi) {
    const user = auth && auth.currentUser ? auth.currentUser : null;
    if (requireAuthorizedUi && (!user || !isSignedInUiActive)) return null;
    return { sensitiveSessionGeneration, authGeneration, user };
}

function isSensitiveSessionCurrent(token, requireAuthorizedUi) {
    if (!token || token.sensitiveSessionGeneration !== sensitiveSessionGeneration) return false;
    if (!requireAuthorizedUi) return true;
    return !!(auth && auth.currentUser === token.user && authGeneration === token.authGeneration && isSignedInUiActive);
}

function clearPinInputValues() {
    const pinIn = document.getElementById('securityPinInput');
    if (pinIn) pinIn.value = '';
    const newPinIn = document.getElementById('newSecurityPinInput');
    if (newPinIn) newPinIn.value = '';
}

function clearKeypairOutputs() {
    keypairPrivateCopied = false;
    const privateOut = document.getElementById('newPrivateKeyOutput');
    if (privateOut) privateOut.value = '';
    const publicOut = document.getElementById('newPublicKeyOutput');
    if (publicOut) publicOut.value = '';
}

function safeStoreGet(store, key) {
    try { return store ? store.getItem(key) : null; } catch (e) { return null; }
}

function safeStoreSet(store, key, value) {
    try { return store ? (store.setItem(key, String(value)), true) : false; } catch (e) { return false; }
}

function safeStoreRemove(store, key) {
    try { return store ? (store.removeItem(key), true) : false; } catch (e) { return false; }
}

function openModalHelper(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
    if (id === 'pinModal' || id === 'pinSetupModal') {
        invalidateSensitiveSession();
        clearPinInputValues();
        pinTargetAction = null;
    }
    if (id === 'keypairModal') {
        clearKeypairOutputs();
    }
}

function withTimeout(promise, ms, timeoutMsg) {
    const timeoutErr = new Error(timeoutMsg || 'Timed out');
    let timer;
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutErr), ms); })
    ]);
}

function retryAsync(fn, attempts, delayMs) {
    return fn().catch((err) => {
        if (attempts <= 1 || (err && err.noRetry)) throw err;
        return new Promise((resolve) => setTimeout(resolve, delayMs)).then(() => retryAsync(fn, attempts - 1, delayMs * 2));
    });
}

function waitForFirebaseSDK(timeoutMs = 15000) {
    if (window.firebaseSDK) return Promise.resolve(window.firebaseSDK);
    return new Promise((resolve, reject) => {
        const notReadyErr = new Error('Firebase SDK failed to load (network/CDN issue)');
        notReadyErr.code = 'SDK_UNAVAILABLE';
        let timer = null;
        const onReady = () => {
            clearTimeout(timer);
            resolve(window.firebaseSDK);
        };
        window.addEventListener('firebasesdkready', onReady, { once: true });
        timer = setTimeout(() => {
            window.removeEventListener('firebasesdkready', onReady);
            if (window.firebaseSDK) resolve(window.firebaseSDK);
            else reject(notReadyErr);
        }, timeoutMs);
    });
}

async function enforceSessionOnlyAuthPersistence() {
    if (!fb || !auth || typeof fb.setPersistence !== 'function' || !fb.browserSessionPersistence) {
        throw new Error('Firebase session persistence unavailable');
    }
    await fb.setPersistence(auth, fb.browserSessionPersistence);
}

function scheduleInfoListenerRecovery() {
    if (infoListenerRecoveryTimer) return;
    const step = INFO_LISTENER_RECOVERY_STEPS_MS[Math.min(infoListenerRecoveryAttempt, INFO_LISTENER_RECOVERY_STEPS_MS.length - 1)];
    infoListenerRecoveryAttempt++;
    infoListenerRecoveryTimer = setTimeout(() => {
        infoListenerRecoveryTimer = null;
        if (!infoListenersFailed) return;
        if (!db || !fb) { scheduleInfoListenerRecovery(); return; }
        attachInfoListeners();
        scheduleInfoListenerRecovery();
    }, step);
}

function clearInfoListenerRecovery() {
    if (infoListenerRecoveryTimer) {
        clearTimeout(infoListenerRecoveryTimer);
        infoListenerRecoveryTimer = null;
    }
    infoListenerRecoveryAttempt = 0;
    infoListenersFailed = false;
    infoListenerFailedPaths.clear();
}

function noteInfoListenerAlive(pathKey) {
    if (pathKey) infoListenerFailedPaths.delete(pathKey);
    if (infoListenerFailedPaths.size) return;
    clearInfoListenerRecovery();
}

function handleInfoListenerError(err, pathKey) {
    if (pathKey) infoListenerFailedPaths.add(pathKey);
    infoListenersFailed = true;
    if (!pathKey || pathKey === INFO_LISTENER_KEY_CONNECTED) isDatabaseConnected = false;
    renderConnectionStatus();
    if (navigator.onLine !== false) scheduleReconnectWatchdog();
    scheduleInfoListenerRecovery();
}

function detachInfoListeners() {
    infoListenerGeneration++;
    if (!fb) return;
    if (dbRefConnected) { try { fb.off(dbRefConnected); } catch (e) {} }
    if (dbRefServerTimeOffset) { try { fb.off(dbRefServerTimeOffset); } catch (e) {} }
}

function attachInfoListeners() {
    detachInfoListeners();
    if (!db || !fb || !dbRefConnected || !dbRefServerTimeOffset) return false;
    const listenerGeneration = ++infoListenerGeneration;
    infoListenerFailedPaths.clear();
    infoListenerFailedPaths.add(INFO_LISTENER_KEY_CONNECTED);
    infoListenerFailedPaths.add(INFO_LISTENER_KEY_OFFSET);

    fb.onValue(dbRefConnected, (snap) => {
        if (listenerGeneration !== infoListenerGeneration) return;
        noteInfoListenerAlive(INFO_LISTENER_KEY_CONNECTED);
        isDatabaseConnected = snap.val() === true;
        if (isDatabaseConnected) hasEverConnectedToDatabase = true;
        if (isDatabaseConnected) clearReconnectWatchdog();
        else if (navigator.onLine !== false) scheduleReconnectWatchdog();
        renderConnectionStatus();
        if (isDatabaseConnected) retryPendingRoleCheck();
    }, (err) => {
        if (listenerGeneration !== infoListenerGeneration) return;
        handleInfoListenerError(err, INFO_LISTENER_KEY_CONNECTED);
    });

    fb.onValue(dbRefServerTimeOffset, (snap) => {
        if (listenerGeneration !== infoListenerGeneration) return;
        noteInfoListenerAlive(INFO_LISTENER_KEY_OFFSET);
        const val = snap.val();
        if (typeof val !== 'number') return;
        serverTimeOffsetMs = val;
        if (!serverClockOffsetIsFromServer(val)) return;
        serverTimeSynced = true;
        if (window.ZoeLicense) window.ZoeLicense.setServerTimeOffset(val);
        serverTimeSyncWaiters.splice(0).forEach((fn) => fn());
    }, (err) => {
        if (listenerGeneration !== infoListenerGeneration) return;
        handleInfoListenerError(err, INFO_LISTENER_KEY_OFFSET);
    });

    return true;
}

async function initFirebase() {
    const savedConfig = safeStoreGet(appLocalStore, 'zoew_firebase_config');
    if (!savedConfig) {
        checkPinAndOpenConfig();
        return false;
    }
    if (isInitializingFirebase) return false;
    isInitializingFirebase = true;
    invalidateSensitiveSession();

    try {
        firebaseConfig = JSON.parse(savedConfig);
        fb = await waitForFirebaseSDK();
        firebaseSdkUnavailable = false;
        sdkUnavailableNoticeShown = false;
        resetFirebaseSdkRetryHealth();

        const existingApps = fb.getApps();
        if (existingApps.length) {
            detachInfoListeners();
            if (typeof fb.deleteApp === 'function') {
                await Promise.all(existingApps.map(a => fb.deleteApp(a).catch(() => {})));
            }
            serverTimeSynced = false;
            serverTimeOffsetMs = 0;
            isDatabaseConnected = false;
            hasEverConnectedToDatabase = false;
            networkJustReturned = false;
        }

        const firebaseApp = fb.getApps().length ? fb.getApps()[0] : fb.initializeApp(firebaseConfig);
        auth = fb.getAuth(firebaseApp);
        await enforceSessionOnlyAuthPersistence();
        db = fb.getDatabase(firebaseApp);
        try { fb.goOnline(db); } catch (e) {}

        dbRefConnected = fb.ref(db, '.info/connected');
        dbRefServerTimeOffset = fb.ref(db, '.info/serverTimeOffset');
        attachInfoListeners();

        setupAuthListener();
        return true;
    } catch (e) {
        if (e && e.code === 'SDK_UNAVAILABLE') {
            firebaseSdkUnavailable = true;
            armLateFirebaseSdkListener();
            renderConnectionStatus();
            if (!sdkUnavailableNoticeShown) {
                sdkUnavailableNoticeShown = true;
                showToast('⚠️ ភ្ជាប់ Server មិនបានទេ — សូមពិនិត្យបណ្តាញ។ កំពុងព្យាយាមម្តងទៀត...');
            }
            scheduleFirebaseSdkRetry();
            return false;
        }
        console.error("Invalid Saved Config", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Invalid Saved Config" });
        checkPinAndOpenConfig();
        return false;
    } finally {
        isInitializingFirebase = false;
        let currentConfig = savedConfig;
        try { currentConfig = appLocalStore.getItem('zoew_firebase_config'); } catch (e) {}
        if (currentConfig !== savedConfig) initFirebase();
    }
}

async function hashPin(pin) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode('zoekeygen_pin_verify_v1'), iterations: 150000, hash: 'SHA-256' },
        keyMaterial,
        256
    );
    return 'pbkdf2:' + Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyStoredPin(enteredPin, savedHash) {
    if (!savedHash) return false;
    return (await hashPin(enteredPin)) === savedHash;
}

let pinTargetAction = null;

function requestPinBeforeConfig(targetAction, message) {
    pinTargetAction = targetAction || openConfigModal;
    clearPinInputValues();
    const savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');
    if (!savedPin) {
        openModalHelper('pinSetupModal');
    } else {
        const msgEl = document.getElementById('pinModalMsg');
        if (msgEl) msgEl.textContent = message || 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បី Config ឬ Reconfig';
        openModalHelper('pinModal');
    }
}

let signingKeySessionKey = null;

async function deriveSigningKeySessionKey(pin) {
    try {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
        return await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: enc.encode('zoekeygen_signing_key_at_rest_v1'), iterations: 150000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    } catch (e) {
        return null;
    }
}

const SIGNING_KEY_SESSION_STORAGE_KEY = 'zoekeygen_signing_key_enc';

async function persistSigningKeyForSession() {
    const operation = captureSensitiveSession(true);
    const privateKeyJwk = signingPrivateKeyJwk;
    const sessionKey = signingKeySessionKey;
    if (!operation || !privateKeyJwk) return;
    const rememberCb = document.getElementById('rememberSigningKeyCheckbox');
    if (!sessionKey) {
        if (rememberCb) rememberCb.checked = false;
        showToast('⚠️ មិនអាចចងចាំ Signing Key បានទេ (បង្កើតសោពី PIN មិនបាន) — សូម Load Key ម្តងទៀតពេលត្រូវការ');
        return;
    }
    try {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipherBuf = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv }, sessionKey, new TextEncoder().encode(JSON.stringify(privateKeyJwk))
        );
        if (!isSensitiveSessionCurrent(operation, true) || signingPrivateKeyJwk !== privateKeyJwk || signingKeySessionKey !== sessionKey) return;
        appSessionStore.setItem(SIGNING_KEY_SESSION_STORAGE_KEY, JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(cipherBuf)) }));
        showToast('🔒 Signing Key ត្រូវបានចងចាំសម្រាប់ Session នេះ (Encrypted ដោយ PIN)');
    } catch (e) {
        if (!isSensitiveSessionCurrent(operation, true) || signingPrivateKeyJwk !== privateKeyJwk || signingKeySessionKey !== sessionKey) return;
        if (rememberCb) rememberCb.checked = false;
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'persistSigningKeyForSession' });
        showToast('⚠️ មិនអាចចងចាំ Signing Key សម្រាប់ Session នេះបានទេ — សូម Load Key ម្តងទៀតពេលត្រូវការ');
    }
}

async function tryRestoreSigningKeyFromSession() {
    const operation = captureSensitiveSession(true);
    const sessionKey = signingKeySessionKey;
    if (!operation || signingPrivateKeyJwk || !sessionKey) return;
    const raw = safeStoreGet(appSessionStore, SIGNING_KEY_SESSION_STORAGE_KEY);
    if (!raw) return;
    try {
        const encObj = JSON.parse(raw);
        const plainBuf = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(encObj.iv) }, sessionKey, new Uint8Array(encObj.data)
        );
        const restoredKeyJwk = JSON.parse(new TextDecoder().decode(plainBuf));
        await validateSigningKeyAgainstShippedPublicKey(restoredKeyJwk);
        if (!isSensitiveSessionCurrent(operation, true) || signingKeySessionKey !== sessionKey) return;
        signingPrivateKeyJwk = restoredKeyJwk;
        updateSigningKeyBadge();
        const cb = document.getElementById('rememberSigningKeyCheckbox');
        if (cb) cb.checked = true;
        showToast('🔓 Signing Key ត្រូវបានស្ដារមកវិញ!');
    } catch (e) {
        if (!isSensitiveSessionCurrent(operation, true) || signingKeySessionKey !== sessionKey) return;
        safeStoreRemove(appSessionStore, SIGNING_KEY_SESSION_STORAGE_KEY);
        const cb = document.getElementById('rememberSigningKeyCheckbox');
        if (cb) cb.checked = false;
        showToast('⚠️ មិនអាចដោះសោ Signing Key ដែលបានចងចាំបានទេ — សូម Load Key ម្តងទៀត');
    }
}

async function saveNewSecurityPin() {
    const newPinIn = document.getElementById('newSecurityPinInput');
    const pinVal = newPinIn ? newPinIn.value.trim() : '';
    if (!pinVal || pinVal.length < 6) {
        if (newPinIn) newPinIn.value = '';
        alert("Security PIN ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ ដើម្បីសុវត្ថិភាព!");
        return;
    }
    const pinGeneration = sensitiveSessionGeneration;
    const targetAction = pinTargetAction || openConfigModal;
    try {
        const pinHash = await hashPin(pinVal);
        if (pinGeneration !== sensitiveSessionGeneration) return;
        const derivedKey = await deriveSigningKeySessionKey(pinVal);
        if (pinGeneration !== sensitiveSessionGeneration) return;
        appLocalStore.setItem('zoew_security_pin_hash', pinHash);
        signingKeySessionKey = derivedKey;
    } catch (e) {
        if (pinGeneration !== sensitiveSessionGeneration) return;
        alert("មិនអាចកំណត់ PIN បានទេ! សូមប្រើ HTTPS ហើយសាកល្បងម្តងទៀត។");
        return;
    } finally {
        if (newPinIn) newPinIn.value = '';
    }
    closeModal('pinSetupModal');
    showToast("✅ បានកំណត់ Security PIN រួចរាល់!");
    targetAction();
}

let isVerifyingPin = false;

async function verifySecurityPin() {
    if (isVerifyingPin) return;
    const pinIn = document.getElementById('securityPinInput');
    const enteredPin = pinIn ? pinIn.value.trim() : '';
    if (pinIn) pinIn.value = '';
    const savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');

    const lockoutUntil = parseInt(safeStoreGet(appLocalStore, 'zoew_pin_lockout_until') || '0');
    if (lockoutUntil && Date.now() < lockoutUntil) {
        const secondsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
        alert(`បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ${secondsLeft} វិនាទី។`);
        return;
    }

    const pinGeneration = sensitiveSessionGeneration;
    isVerifyingPin = true;
    try {
        if (savedPin && (await verifyStoredPin(enteredPin, savedPin))) {
            if (pinGeneration !== sensitiveSessionGeneration) return;
            appLocalStore.removeItem('zoew_pin_fail_count');
            appLocalStore.removeItem('zoew_pin_lockout_until');
            const derivedKey = await deriveSigningKeySessionKey(enteredPin);
            if (pinGeneration !== sensitiveSessionGeneration) return;
            signingKeySessionKey = derivedKey;
            const targetAction = pinTargetAction || openConfigModal;
            closeModal('pinModal');
            targetAction();
        } else {
            if (pinGeneration !== sensitiveSessionGeneration) return;
            const failCount = (parseInt(appLocalStore.getItem('zoew_pin_fail_count') || '0') || 0) + 1;
            if (failCount >= 5) {
                appLocalStore.setItem('zoew_pin_lockout_until', (Date.now() + 60000).toString());
                appLocalStore.setItem('zoew_pin_fail_count', '0');
                alert("បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ១ នាទី។");
            } else {
                appLocalStore.setItem('zoew_pin_fail_count', failCount.toString());
                alert("លេខ PIN មិនត្រឹមត្រូវទេ!");
            }
        }
    } catch (e) {
        if (pinGeneration !== sensitiveSessionGeneration) return;
        alert("មិនអាចផ្ទៀងផ្ទាត់ PIN បានទេ!");
    } finally {
        isVerifyingPin = false;
    }
}

function isPinFlowPending() {
    const pinModal = document.getElementById('pinModal');
    const pinSetupModal = document.getElementById('pinSetupModal');
    return !!((pinModal && pinModal.classList.contains('active')) || (pinSetupModal && pinSetupModal.classList.contains('active')));
}

function requestSessionSigningKeyRestoreIfEligible() {
    if (!isSignedInUiActive || !auth || !auth.currentUser || signingPrivateKeyJwk) return;
    if (!safeStoreGet(appSessionStore, SIGNING_KEY_SESSION_STORAGE_KEY) || isPinFlowPending()) return;
    requestPinBeforeConfig(tryRestoreSigningKeyFromSession, 'បញ្ចូល PIN ដើម្បីស្ដារ Signing Key ដែលបានចងចាំពីមុន');
}

function checkPinAndOpenConfig() {
    const savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');
    pinTargetAction = openConfigModal;
    if (!savedPin) openModalHelper('pinSetupModal');
    else requestPinBeforeConfig(openConfigModal);
}

function openConfigFlow() {
    requestPinBeforeConfig(openConfigModal);
}

function openConfigModal() {
    const savedConfig = safeStoreGet(appLocalStore, 'zoew_firebase_config');
    if (savedConfig) {
        const cfgInput = document.getElementById('firebaseConfigInput');
        if (cfgInput) cfgInput.value = savedConfig;
    }
    const dsnInput = document.getElementById('sentryDsnInput');
    if (dsnInput && window.ZoeErrors) dsnInput.value = ZoeErrors.getDsn();
    openModalHelper('configModal');
}

const FIREBASE_CONFIG_KEYS = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];

function stripJsCommentsOutsideStrings(source) {
    let out = '';
    let quote = '';
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        const next = source[i + 1];
        if (quote) {
            out += ch;
            if (ch === '\\') {
                if (next !== undefined) out += next;
                i += 2;
                continue;
            }
            if (ch === quote) quote = '';
            i++;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            quote = ch;
            out += ch;
            i++;
            continue;
        }
        if (ch === '/' && next === '/') {
            while (i < source.length && source[i] !== '\n') i++;
            continue;
        }
        if (ch === '/' && next === '*') {
            i += 2;
            while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

function matchingBraceIndex(source, start) {
    const text = typeof source === 'string' ? source : '';
    let from = Math.floor(Number(start));
    if (!Number.isFinite(from) || from < 0) from = 0;
    let depth = 0;
    let quote = '';
    for (let i = from; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            if (ch === '\\') {
                i++;
                continue;
            }
            if (ch === quote) quote = '';
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            quote = ch;
            continue;
        }
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function extractFirebaseConfigObject(source) {
    const marker = /firebaseConfig\s*=\s*\{/.exec(source);
    if (marker) {
        const open = source.indexOf('{', marker.index);
        const close = matchingBraceIndex(source, open);
        if (close !== -1) return source.slice(open, close + 1);
    }
    let from = source.indexOf('{');
    while (from !== -1) {
        const close = matchingBraceIndex(source, from);
        if (close !== -1) {
            const text = source.slice(from, close + 1);
            if (text.indexOf('apiKey') !== -1) return text;
        }
        from = source.indexOf('{', from + 1);
    }
    return '';
}

function firebaseObjectTextToJson(text) {
    let out = '';
    let quote = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            if (ch === '\\') {
                out += ch + (text[i + 1] === undefined ? '' : text[i + 1]);
                i++;
                continue;
            }
            if (ch === quote) {
                out += '"';
                quote = '';
                continue;
            }
            if (ch === '"') {
                out += '\\"';
                continue;
            }
            out += ch;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            out += '"';
            continue;
        }
        out += ch;
    }
    return out
        .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":')
        .replace(/,(\s*[}\]])/g, '$1');
}

function normalizeFirebaseConfig(raw) {
    const text = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!text) throw new Error('EMPTY');
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch (strictErr) {
        const objectText = extractFirebaseConfigObject(stripJsCommentsOutsideStrings(text));
        if (!objectText) throw new Error('NO_OBJECT');
        try {
            parsed = JSON.parse(firebaseObjectTextToJson(objectText));
        } catch (looseErr) {
            throw new Error('BAD_SYNTAX');
        }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('NO_OBJECT');
    const config = {};
    const extras = [];
    Object.keys(parsed).forEach((key) => {
        const value = parsed[key];
        if (FIREBASE_CONFIG_KEYS.indexOf(key) === -1) {
            extras.push(key);
            return;
        }
        if (value === null || value === undefined || value === '') return;
        config[key] = String(value);
    });
    const missing = [];
    if (!config.apiKey) missing.push('apiKey');
    if (!config.databaseURL) missing.push('databaseURL');
    if (missing.length) {
        const err = new Error('MISSING');
        err.missing = missing;
        throw err;
    }
    return { config: config, extras: extras };
}

function firebaseConfigErrorMessage(err) {
    const code = err && err.message ? err.message : '';
    const missing = err && err.missing ? err.missing : [];
    if (code === 'EMPTY') return 'សូមបញ្ចូល Firebase Config!';
    if (code === 'NO_OBJECT') return 'រកមិនឃើញ Firebase Config ក្នុងអត្ថបទដែលបានបិទភ្ជាប់ទេ។ សូម copy ទាំងស្រុងពី Firebase Console ➜ Project settings ➜ Your apps។';
    if (code === 'BAD_SYNTAX') return 'អានទម្រង់ Config មិនកើតទេ។ សូម copy ពី Firebase Console ម្តងទៀត ដោយកុំកែអ្វីសោះ។';
    if (code === 'MISSING' && missing.indexOf('databaseURL') !== -1) return 'Config នេះគ្មាន databaseURL ទេ។ Firebase មិនដាក់វាក្នុង snippet ទេ បើមិនទាន់បង្កើត Realtime Database — សូមបើក Firebase Console ➜ Realtime Database ➜ Create Database រួច copy Config ម្តងទៀត។';
    if (code === 'MISSING') return 'Config ត្រូវមាន apiKey និង databaseURL!';
    return 'Firebase Config មិនត្រឹមត្រូវទេ!';
}

function readNormalizedFirebaseConfig(cfgInput) {
    const raw = cfgInput.value.trim();
    if (!raw) { alert('សូមបញ្ចូល Firebase Config!'); return null; }
    let normalized;
    try {
        normalized = normalizeFirebaseConfig(raw);
    } catch (e) {
        alert(firebaseConfigErrorMessage(e));
        return null;
    }
    cfgInput.value = JSON.stringify(normalized.config, null, 2);
    return normalized;
}

function saveFirebaseConfig() {
    const dsnInput = document.getElementById('sentryDsnInput');
    if (dsnInput && window.ZoeErrors) {
        ZoeErrors.setDsn(dsnInput.value);
        ZoeErrors.init('zoekeygen');
    }
    const cfgInput = document.getElementById('firebaseConfigInput');
    if (!cfgInput) return;
    const normalized = readNormalizedFirebaseConfig(cfgInput);
    if (!normalized) return;
    const parsed = normalized.config;
    if (!safeStoreSet(appLocalStore, 'zoew_firebase_config', JSON.stringify(parsed))) {
        alert("រក្សាទុក Config មិនបានទេ! សូមពិនិត្យទំហំផ្ទុករបស់ browser។");
        return;
    }
    if (normalized.extras.length) showToast("ℹ️ រំលងវាលដែលមិនមែនរបស់ Firebase៖ " + normalized.extras.join(', '));
    closeModal('configModal');
    initFirebase();
    showLiveToast('config');
}

function showLoginModalWithPrefill() {
    invalidateSensitiveSession();
    const losingUncopiedKeypair = hasUncopiedKeypair();
    keypairPrivateCopied = false;
    isGeneratingKey = false;
    const genBtn = document.getElementById('genGenerateBtn');
    if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🔐 Generate Key'; }
    if (!isPinFlowPending()) pinTargetAction = null;
    document.getElementById('appContainer').classList.add('hidden');
    isSignedInUiActive = false;
    refreshLiveToasts();
    keyListSessionGeneration++;
    keyListCache = [];
    const keyListBody = document.getElementById('keyListBody');
    if (keyListBody) keyListBody.innerHTML = '';
    document.querySelectorAll('.modal').forEach((m) => {
        if (m.id !== 'loginModal') closeModal(m.id);
    });

    clearGeneratedKeyResult();

    lastGeneratedSetupLink = '';
    const setupLinkConfigInput = document.getElementById('setupLinkConfigInput');
    if (setupLinkConfigInput) setupLinkConfigInput.value = '';
    const setupLinkResultText = document.getElementById('setupLinkResultText');
    if (setupLinkResultText) setupLinkResultText.textContent = '';
    const setupLinkResultBox = document.getElementById('setupLinkResultBox');
    if (setupLinkResultBox) setupLinkResultBox.classList.add('hidden');
    const setupLinkQrContainer = document.getElementById('setupLinkQrContainer');
    if (setupLinkQrContainer) setupLinkQrContainer.innerHTML = '';

    clearSigningKey(true);
    openModalHelper('loginModal');
    if (losingUncopiedKeypair) {
        alert('⚠️ Keypair ថ្មីដែលអ្នកទើបបង្កើត ត្រូវបានលុបចោល ព្រោះអ្នកបានចាកចេញពីប្រព័ន្ធ ហើយអ្នកមិនទាន់បានចម្លង Private Key ទុកទេ។ នេះជាការការពារ (Private Key មិនត្រូវនៅសល់លើឧបករណ៍បន្ទាប់ពី Logout)។ សូមចូលម្តងទៀត ហើយបង្កើត Keypair ថ្មី — កុំភ្លេចចម្លងវាភ្លាមៗ។');
    }
    ['securityPinInput', 'newSecurityPinInput'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const savedEmail = safeStoreGet(appLocalStore, 'remembered_email');
    const emailInput = document.getElementById('loginEmailInput');
    const passwordInput = document.getElementById('loginPasswordInput');
    const rememberCb = document.getElementById('rememberMeCheckbox');
    if (emailInput) emailInput.value = savedEmail || '';
    if (passwordInput) passwordInput.value = '';
    if (rememberCb) rememberCb.checked = !!savedEmail;
}

async function doLogin() {
    const emailIn = document.getElementById('loginEmailInput');
    const passIn = document.getElementById('loginPasswordInput');
    const rememberCb = document.getElementById('rememberMeCheckbox');
    const email = emailIn ? emailIn.value.trim() : '';
    const password = passIn ? passIn.value : '';
    if (!email || !password) { alert("សូមបញ្ចូលអ៊ីមែល និងពាក្យសម្ងាត់!"); return; }

    const loginBtn = document.getElementById('loginBtn');
    const originalBtnText = loginBtn ? loginBtn.textContent : '';
    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'កំពុងចូល...'; }
    try {
        if (!fb || !auth) { fb = await waitForFirebaseSDK(); }
        const generationAtLogin = authGeneration;
        await enforceSessionOnlyAuthPersistence();
        const cred = await withTimeout(fb.signInWithEmailAndPassword(auth, email, password), 15000, 'Login timed out');
        if (rememberCb && rememberCb.checked) appLocalStore.setItem('remembered_email', email);
        else appLocalStore.removeItem('remembered_email');
        if (authGeneration === generationAtLogin && cred && cred.user) {
            authGeneration++;
            verifyAdminRoleThenProceed(cred.user, authGeneration);
        }
    } catch (e) {
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'doLogin' });
        alert(e && e.message === 'Login timed out'
            ? "អស់ពេល (Timeout)! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។"
            : "ចូលប្រព័ន្ធមិនបានទេ! សូមពិនិត្យអ៊ីមែល/ពាក្យសម្ងាត់ម្តងទៀត។");
    } finally {
        if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = originalBtnText; }
        if (passIn) passIn.value = '';
    }
}

function readDatabaseUrlFromConfig() {
    try {
        const raw = appLocalStore.getItem('zoew_firebase_config');
        if (!raw) return '';
        const cfg = JSON.parse(raw);
        const url = cfg && cfg.databaseURL ? String(cfg.databaseURL) : '';
        return url.replace(/\/+$/, '');
    } catch (e) {
        return '';
    }
}

function fetchWithTimeout(url, options, ms, timeoutMsg, readBody) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const opts = Object.assign({}, options || {});
    const sourceSignal = opts.signal || null;
    if (controller) opts.signal = controller.signal;
    const timeoutErr = new Error(timeoutMsg || 'Timed out');
    let settled = false;
    let timer = null;
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
            if (sourceSignal && typeof sourceSignal.removeEventListener === 'function') {
                sourceSignal.removeEventListener('abort', abortFromSource);
            }
        };
        const abortFromSource = () => {
            if (settled) return;
            settled = true;
            if (controller) { try { controller.abort(); } catch (e) {} }
            cleanup();
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
        };
        if (sourceSignal && typeof sourceSignal.addEventListener === 'function') {
            if (sourceSignal.aborted) {
                abortFromSource();
                return;
            }
            sourceSignal.addEventListener('abort', abortFromSource, { once: true });
        }
        timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            if (controller) { try { controller.abort(); } catch (e) {} }
            cleanup();
            reject(timeoutErr);
        }, ms);
        fetch(url, opts).then((res) => {
            if (settled) return null;
            if (!readBody) return { res: res, body: undefined };
            return Promise.resolve(readBody(res)).then((body) => ({ res: res, body: body }));
        }, (err) => {
            if (settled) return null;
            settled = true;
            cleanup();
            reject(err);
            return null;
        }).then((out) => {
            if (settled || !out) return;
            settled = true;
            cleanup();
            resolve(out);
        }, (err) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(err);
        });
    });
}

function isFirebaseDatabaseHost(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        return host.endsWith('.firebaseio.com') || host.endsWith('.firebasedatabase.app');
    } catch (e) {
        return false;
    }
}

async function readUserRoleViaRest(user) {
    const base = readDatabaseUrlFromConfig();
    if (base && !isFirebaseDatabaseHost(base)) {
        lastRoleRestOutcome = 'blocked: non-firebase databaseURL';
        throw new Error('REST role check unavailable');
    }
    if (!base || !user || !user.uid || typeof user.getIdToken !== 'function' || typeof fetch !== 'function') {
        lastRoleRestOutcome = 'unavailable';
        throw new Error('REST role check unavailable');
    }
    let out;
    try {
        const token = await user.getIdToken();
        out = await fetchWithTimeout(
            base + '/user_roles/' + encodeURIComponent(user.uid) + '.json?auth=' + encodeURIComponent(token),
            { cache: 'no-store' }, ROLE_CHECK_CONNECT_WAIT_MS, 'REST role check timed out',
            (r) => (r.ok ? r.json() : null));
    } catch (e) {
        lastRoleRestOutcome = 'blocked: ' + ((e && e.message) || 'unknown');
        throw e;
    }
    if (!out.res.ok) {
        lastRoleRestOutcome = 'http ' + out.res.status;
        throw new Error('REST role check failed: ' + out.res.status);
    }
    lastRoleRestOutcome = 'ok';
    return out.body;
}

function readUserRole(user) {
    const sdkRead = window.firebaseSDK.get(window.firebaseSDK.ref(db, `user_roles/${user.uid}`)).then((snap) => snap.val());
    if (isDatabaseConnected) {
        lastRoleRestOutcome = 'not needed';
        return withTimeout(sdkRead, 15000, 'Role check timed out');
    }
    const timeoutErr = new Error('Role check timed out');
    const restRead = readUserRoleViaRest(user);
    return new Promise((resolve, reject) => {
        let settled = false;
        let outstanding = 2;
        let sdkError = null;
        let restError = null;
        let timer = null;
        let slowNoticeTimer = setTimeout(() => {
            slowNoticeTimer = null;
            if (!settled) showToast("⚠️ បណ្ដាញយឺត! កំពុងភ្ជាប់ Server... សូមរង់ចាំបន្តិច");
        }, SLOW_NETWORK_NOTICE_MS);
        const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            if (slowNoticeTimer) clearTimeout(slowNoticeTimer);
            fn(value);
        };
        const onFailure = () => {
            outstanding--;
            if (outstanding === 0) finish(reject, sdkError || restError || timeoutErr);
        };
        timer = setTimeout(() => finish(reject, timeoutErr), ROLE_CHECK_CONNECT_WAIT_MS);
        sdkRead.then((value) => finish(resolve, value), (err) => { sdkError = err; onFailure(); });
        restRead.then((value) => finish(resolve, value), (err) => { restError = err; onFailure(); });
    });
}

function retryPendingRoleCheck() {
    if (!pendingRoleRecheck) return;
    if (!auth || !auth.currentUser) return;
    authGeneration++;
    verifyAdminRoleThenProceed(auth.currentUser, authGeneration);
}

async function verifyAdminRoleThenProceed(user, myAuthGeneration) {
    pendingRoleRecheck = false;
    try {
        const role = await readUserRole(user);
        if (myAuthGeneration !== authGeneration) return;
        if (role !== 'admin') {
            await fb.signOut(auth).catch(() => {});
            showToast("⛔ គណនីនេះគ្មានសិទ្ធិចូល ZoeKeyGen ទេ! តម្រូវឲ្យជា Admin ប៉ុណ្ណោះ។");
            return;
        }
    } catch (e) {
        if (myAuthGeneration !== authGeneration) return;
        console.error("Role verification failed:", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Role verification failed:", connected: isDatabaseConnected, restRoleRead: lastRoleRestOutcome });
        if (e && e.message === 'Role check timed out') {
            pendingRoleRecheck = true;
            showLoginModalWithPrefill();
            showToast("⚠️ ការតភ្ជាប់អ៊ីនធឺណិតយឺត! មិនទាន់ផ្ទៀងផ្ទាត់សិទ្ធិបានទេ — ប្រព័ន្ធនឹងព្យាយាមម្ដងទៀតដោយស្វ័យប្រវត្តិ។");
            return;
        }
        await fb.signOut(auth).catch(() => {});
        showToast("⚠️ មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិបានទេ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងចូលម្តងទៀត។");
        return;
    }

    closeModal('loginModal');
    document.getElementById('appContainer').classList.remove('hidden');
    updateAuthButton(true);
    const wasAlreadySignedIn = isSignedInUiActive;
    isSignedInUiActive = true;
    if (!wasAlreadySignedIn) showLiveToast('signin');
    requestSessionSigningKeyRestoreIfEligible();
    refreshKeyList();
}

const AUTH_STUCK_RECOVERY_FLAG = 'zoe_auth_recovery_attempted';

async function attemptAuthStorageRecovery() {
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
                .map((d) => new Promise((resolve) => {
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

function setupAuthListener() {
    if (!auth) return;
    if (authUnsubscribe) { try { authUnsubscribe(); } catch (e) {} authUnsubscribe = null; }

    const initialAuthTimeout = setTimeout(() => { attemptAuthStorageRecovery(); }, 8000);
    authUnsubscribe = fb.onAuthStateChanged(auth, (user) => {
        clearTimeout(initialAuthTimeout);
        authGeneration++;
        const myAuthGeneration = authGeneration;
        if (user) {
            verifyAdminRoleThenProceed(user, myAuthGeneration);
        } else {
            pendingRoleRecheck = false;
            updateAuthButton(false);
            showLoginModalWithPrefill();
        }
    });
}

function logoutApp() {
    if (hasUncopiedKeypair() && !confirm('អ្នកមិនទាន់ចម្លង Private Key នៃ Keypair ថ្មីទេ! ការចាកចេញនឹងលុបវាជារៀងរហូត។ ចាកចេញមែនទេ?')) return;
    authGeneration++;
    pendingRoleRecheck = false;
    updateAuthButton(false);
    showLoginModalWithPrefill();
    if (!fb || !auth) return;
    fb.signOut(auth).catch(() => {
        showToast('⚠️ មិនអាចចាកចេញពី Firebase បានភ្លាមៗទេ។ សូម Refresh ហើយចូលម្ដងទៀត។');
    });
}

function navAuthFlow() {
    if (authButtonIsLoggedIn) logoutApp();
    else showLoginModalWithPrefill();
}

function updateAuthButton(isLoggedIn) {
    authButtonIsLoggedIn = !!isLoggedIn;
    const btn = document.getElementById('navAuthBtn');
    if (!btn) return;
    btn.textContent = authButtonIsLoggedIn ? '🚪 ចាកចេញ' : '🔑 ចូល';
}

let signingPrivateKeyJwk = null;

function updateSigningKeyBadge() {
    const badge = document.getElementById('signingKeyStatusBadge');
    if (!badge) return;
    if (signingPrivateKeyJwk) {
        badge.textContent = 'Loaded ✓';
        badge.style.background = 'var(--success-light)';
        badge.style.color = '#067a55';
    } else {
        badge.textContent = 'មិនទាន់ Load';
        badge.style.background = 'var(--danger-light)';
        badge.style.color = '#a3123a';
    }
}

async function validateSigningKeyAgainstShippedPublicKey(jwk) {
    if (!jwk || !jwk.d || jwk.kty !== 'EC' || jwk.crv !== 'P-256') throw new Error('invalid key shape');
    const { keyString } = await window.ZoeLicense.signNewKey(jwk, { appCode: LICENSE_APP_CODE, days: 1, note: '' });
    const verifyResult = await window.ZoeLicense.verifyKeyString(keyString, LICENSE_APP_CODE);
    if (!verifyResult.valid) throw new Error('private key does not pair with the shipped public key');
}

async function loadSigningKey() {
    const input = document.getElementById('privateKeyInput');
    const raw = input ? input.value.trim() : '';
    if (!raw) { alert('សូមបិទភ្ជាប់ Private Key JWK សិន!'); return; }
    const operation = captureSensitiveSession(true);
    if (!operation) { alert('សូមចូលប្រព័ន្ធជាមុនសិន!'); return; }
    try {
        const jwk = JSON.parse(raw);
        await validateSigningKeyAgainstShippedPublicKey(jwk);
        if (!isSensitiveSessionCurrent(operation, true)) return;
        signingPrivateKeyJwk = jwk;
        if (input) input.value = '';
        updateSigningKeyBadge();
        showToast('✅ Signing Key ត្រូវបាន Load ដោយជោគជ័យ!');

        const rememberCb = document.getElementById('rememberSigningKeyCheckbox');
        if (rememberCb && rememberCb.checked) {
            if (signingKeySessionKey) {
                await persistSigningKeyForSession();
            } else {
                requestPinBeforeConfig(persistSigningKeyForSession, 'បញ្ចូល PIN ដើម្បីចងចាំ Signing Key នេះសម្រាប់ Session នេះ');
            }
        }
    } catch (e) {
        if (!isSensitiveSessionCurrent(operation, true)) return;
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'loadSigningKey' });
        alert(e && e.message === 'private key does not pair with the shipped public key'
            ? 'Private Key នេះមិនផ្គូផ្គងនឹង Public Key ដែលមានក្នុង license-verify.js ទេ! Key ដែលចេញដោយវានឹងផ្ទៀងផ្ទាត់មិនកើតនៅគ្រប់ App។ សូមប្រើ Private Key ដែលត្រូវគ្នា ឬដាក់ Public Key ថ្មីទៅក្នុង App ទាំងអស់សិន។'
            : 'Private Key មិនត្រឹមត្រូវទេ! សូមពិនិត្យ JSON JWK (ECDSA P-256) ម្តងទៀត។');
    }
}

function clearSigningKey(silent) {
    invalidateSensitiveSession();
    signingPrivateKeyJwk = null;
    signingKeySessionKey = null;
    const input = document.getElementById('privateKeyInput');
    if (input) input.value = '';
    safeStoreRemove(appSessionStore, SIGNING_KEY_SESSION_STORAGE_KEY);
    const rememberCb = document.getElementById('rememberSigningKeyCheckbox');
    if (rememberCb) rememberCb.checked = false;
    isGeneratingKey = false;
    const genBtn = document.getElementById('genGenerateBtn');
    if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🔐 Generate Key'; }
    updateSigningKeyBadge();
    if (!silent) showToast('✅ បានសម្អាត Signing Key ចេញពីសតិ');
}

let keypairPrivateCopied = false;

function hasUncopiedKeypair() {
    if (keypairPrivateCopied) return false;
    const modal = document.getElementById('keypairModal');
    if (!modal || !modal.classList.contains('active')) return false;
    const out = document.getElementById('newPrivateKeyOutput');
    return !!(out && out.value);
}

function dismissKeypairModal() {
    if (hasUncopiedKeypair() && !confirm('អ្នកមិនទាន់ចម្លង Private Key ទុកនៅឡើយទេ! បើបិទប្រអប់នេះ វានឹងបាត់បង់ជារៀងរហូត ហើយអ្នកត្រូវបង្កើត Keypair ថ្មីម្តងទៀត។ បិទមែនទេ?')) return;
    closeModal('keypairModal');
}

async function generateNewKeypair() {
    const operation = captureSensitiveSession(true);
    if (!operation) { alert('សូមចូលប្រព័ន្ធជាមុនសិន!'); return; }
    if (!confirm('ការបង្កើត Keypair ថ្មីនឹងធ្វើឲ្យ Key ចាស់ៗប្រើលែងកើត លុះត្រាតែអ្នកយក Public Key ថ្មីទៅដាក់ជំនួសក្នុង license-verify.js របស់គ្រប់ App ។ បន្តទេ?')) return;
    try {
        const { publicKeyJwk, privateKeyJwk } = await window.ZoeLicense.generateKeyPair();
        if (!isSensitiveSessionCurrent(operation, true)) return;
        keypairPrivateCopied = false;
        document.getElementById('newPrivateKeyOutput').value = JSON.stringify(privateKeyJwk);
        document.getElementById('newPublicKeyOutput').value = JSON.stringify(publicKeyJwk);
        openModalHelper('keypairModal');
    } catch (e) {
        if (!isSensitiveSessionCurrent(operation, true)) return;
        alert('មិនអាចបង្កើត Keypair បានទេ!');
    }
}

async function copySensitiveText(text, isValueCurrent, onCopied) {
    if (!text) return;
    const operation = captureSensitiveSession(true);
    if (!operation) return;
    const isCurrent = () => isSensitiveSessionCurrent(operation, true) && isValueCurrent();
    let copied = false;
    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            copied = true;
        }
    } catch (e) {}
    if (!isCurrent()) return;
    if (!copied) {
        let textarea = null;
        try {
            textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', 'true');
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            copied = document.execCommand('copy') === true;
        } catch (e) {}
        finally {
            if (textarea) { textarea.value = ''; textarea.remove(); }
        }
    }
    if (!isCurrent()) return;
    if (copied) onCopied();
    else showToast('⚠️ មិនអាចចម្លងដោយស្វ័យប្រវត្តិបានទេ។ សូមចម្លងអត្ថបទដោយដៃ។');
}

function copyTextarea(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const text = el.value;
    return copySensitiveText(text, () => document.getElementById(id) === el && el.value === text, () => {
        if (id === 'newPrivateKeyOutput') keypairPrivateCopied = true;
        showToast('✅ បានចម្លង!');
    });
}

let lastGeneratedKey = '';

function clearGeneratedKeyResult() {
    lastGeneratedKey = '';
    const genResultKey = document.getElementById('genResultKey');
    if (genResultKey) genResultKey.textContent = '';
    const genResultBox = document.getElementById('genResultBox');
    if (genResultBox) genResultBox.classList.add('hidden');
}

let isGeneratingKey = false;

async function generateLicenseKey() {
    if (isGeneratingKey) return;
    const operation = captureSensitiveSession(true);
    const privateKeyJwk = signingPrivateKeyJwk;
    if (!privateKeyJwk) { alert('សូម Load Signing Key សិន (មើលប្រអប់ខាងលើ)!'); return; }
    if (!db || !operation) { alert('សូមចូលប្រព័ន្ធ និងភ្ជាប់ Firebase សិន!'); return; }

    const appSelect = LICENSE_APP_CODE;
    const days = parseFloat(document.getElementById('genDaysInput').value) || 0;
    const devicesInput = document.getElementById('genDevicesInput');
    const maxDevices = seatLimitOf(devicesInput ? devicesInput.value : 1);
    const note = document.getElementById('genNoteInput').value.trim();

    if (days <= 0) { alert('សុពលភាពត្រូវធំជាង 0 ថ្ងៃ!'); return; }

    const genBtn = document.getElementById('genGenerateBtn');
    isGeneratingKey = true;
    if (genBtn) { genBtn.disabled = true; genBtn.textContent = 'កំពុងផ្ទៀងផ្ទាត់ម៉ោង Server...'; }

    const myGeneration = keyListSessionGeneration;
    try {
        const timeSynced = await waitForServerTimeSync(15000);
        if (!isSensitiveSessionCurrent(operation, true) || signingPrivateKeyJwk !== privateKeyJwk) return;
        if (!timeSynced) {
            alert('មិនអាចផ្ទៀងផ្ទាត់ម៉ោង Server បានទេ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត (ដើម្បីកុំឲ្យថ្ងៃចេញ/ផុតកំណត់របស់ Key ខុសពីម៉ោងម៉ាស៊ីនរបស់អ្នក)។');
            return;
        }
        if (genBtn) genBtn.textContent = 'កំពុងបង្កើត...';

        const { keyString, payload } = await window.ZoeLicense.signNewKey(privateKeyJwk, {
            appCode: appSelect, days: days, note: note
        });
        if (!isSensitiveSessionCurrent(operation, true) || signingPrivateKeyJwk !== privateKeyJwk) return;

        const targetPaths = [appSelect];
        const publicRecord = {
            expiresAt: getServerNow() + Math.round(days * 86400000),
            revoked: false,
            maxDevices: maxDevices
        };
        const metaRecord = {
            issuedAt: getServerNow(),
            scope: appSelect,
            note: note || '',
            createdBy: operation.user.email || operation.user.uid
        };

        let generateAlreadyTimedOut = false;
        const writePromise = Promise.allSettled(targetPaths.map((p) => retryAsync(() => fb.update(fb.ref(db), {
            [`license_keys/${p}/${payload.id}`]: publicRecord,
            [`license_keys_meta/${p}/${payload.id}`]: metaRecord
        }), 3, 1000)));
        writePromise.then((bgResults) => {
            if (!generateAlreadyTimedOut) return;
            if (myGeneration !== keyListSessionGeneration || !isSensitiveSessionCurrent(operation, true) || signingPrivateKeyJwk !== privateKeyJwk) return;
            const bgSucceededPaths = targetPaths.filter((p, i) => bgResults[i].status !== 'rejected');
            if (bgSucceededPaths.length > 0) {
                showToast(`⏱️ Key ${payload.id} ដែលអស់ពេលមុន ត្រូវបានបង្កើតជោគជ័យទីបំផុតសម្រាប់: ${bgSucceededPaths.join(', ')} — សូមកុំបង្កើត Key ត្រួតគ្នា, ពិនិត្យ Key List ជាមុនសិន!`);
                refreshKeyList();
            }
        });

        let results;
        try {
            results = await withTimeout(writePromise, 25000, 'Generate key timed out');
        } catch (timeoutErr) {
            if (timeoutErr && timeoutErr.message === 'Generate key timed out') generateAlreadyTimedOut = true;
            throw timeoutErr;
        }
        if (!isSensitiveSessionCurrent(operation, true) || signingPrivateKeyJwk !== privateKeyJwk) return;
        const failedPaths = targetPaths.filter((p, i) => results[i].status === 'rejected');
        const succeededPaths = targetPaths.filter((p) => !failedPaths.includes(p));

        if (succeededPaths.length === 0) {
            throw (results.find((r) => r.status === 'rejected') || {}).reason || new Error('Generate key failed');
        }

        let appPathsTagFailed = false;
        if (failedPaths.length > 0) {
            const tagResults = await Promise.allSettled(succeededPaths.map((p) => retryAsync(() => fb.update(fb.ref(db, `license_keys_meta/${p}/${payload.id}`), { appPaths: succeededPaths }), 3, 1000)));
            if (!isSensitiveSessionCurrent(operation, true) || signingPrivateKeyJwk !== privateKeyJwk) return;
            appPathsTagFailed = tagResults.some((r) => r.status === 'rejected');
            if (appPathsTagFailed) {
                const tagErr = (tagResults.find((r) => r.status === 'rejected') || {}).reason || new Error('appPaths tagging failed');
                console.error('Failed to tag appPaths after partial key generation', tagErr);
                if (window.ZoeErrors) ZoeErrors.capture(tagErr, { context: 'generateLicenseKey appPaths tagging failed after retries', keyId: payload.id, succeededPaths, failedPaths });
            }
        }

        if (!isSensitiveSessionCurrent(operation, true) || signingPrivateKeyJwk !== privateKeyJwk) return;
        lastGeneratedKey = keyString;
        document.getElementById('genResultKey').textContent = keyString;
        document.getElementById('genResultBox').classList.remove('hidden');
        document.getElementById('genNoteInput').value = '';

        if (failedPaths.length === 0) {
            showToast('✅ Key ត្រូវបានបង្កើត និងកត់ត្រាទុករួចរាល់!');
        } else {
            const extraWarning = appPathsTagFailed
                ? '\n\n⚠️ បន្ថែមទៀត Key List នៅក្នុង App នេះប្រហែលជាមិនបង្ហាញត្រឹមត្រូវថា Key នេះ Active នៅ App ណាខ្លះទេ — សូមពិនិត្យផ្ទាល់នៅ Firebase Console (path license_keys) មុននឹង Revoke ឬបន្ថែមសុពលភាព Key នេះ។'
                : '';
            alert(`⚠️ ជោគជ័យមិនពេញលេញ! Key នេះកត់ត្រាទុកសម្រាប់តែ App: ${succeededPaths.join(', ')}\nបរាជ័យសម្រាប់: ${failedPaths.join(', ')} — Key នេះនឹងមិនអាចប្រើប្រាស់នៅ App ដែលបរាជ័យទេ លុះត្រាតែបង្កើត Key ថ្មីដាច់ដោយឡែកសម្រាប់ App នោះ។${extraWarning}`);
        }
        refreshKeyList();
    } catch (e) {
        if (!isSensitiveSessionCurrent(operation, true) || signingPrivateKeyJwk !== privateKeyJwk) return;
        console.error(e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'generateLicenseKey' });
        alert(e && e.message === 'Generate key timed out'
            ? 'អស់ពេល (Timeout)! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។'
            : 'មិនអាចបង្កើត Key បានទេ! សូមពិនិត្យការភ្ជាប់ Firebase និងសិទ្ធិគណនី។');
    } finally {
        if (!isSensitiveSessionCurrent(operation, true)) return;
        isGeneratingKey = false;
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🔐 Generate Key'; }
    }
}

function copyGeneratedKey() {
    const text = lastGeneratedKey;
    return copySensitiveText(text, () => lastGeneratedKey === text, () => showToast('✅ បានចម្លង Key!'));
}

const SETUP_LINK_URL_KEY = 'zoekeygen_setup_url_ZOE';
const SETUP_LINK_DSN_KEY = 'zoekeygen_setup_dsn_ZOE';
let lastGeneratedSetupLink = '';

function setupLinkDsnIsValid(dsn) {
    if (typeof dsn !== 'string' || !dsn) return false;
    let parsed;
    try { parsed = new URL(dsn); } catch (e) { return false; }
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'sentry.io' || host.endsWith('.sentry.io');
}

function buildSetupPayload(config, dsn) {
    const payload = Object.assign({}, config);
    delete payload.dsn;
    if (setupLinkDsnIsValid(dsn)) payload.dsn = dsn;
    return payload;
}

function restoreSetupLinkBaseUrl() {
    const urlInput = document.getElementById('setupLinkUrlInput');
    if (urlInput) urlInput.value = safeStoreGet(appLocalStore, SETUP_LINK_URL_KEY) || '';
    const dsnInput = document.getElementById('setupLinkDsnInput');
    if (dsnInput) {
        const remembered = safeStoreGet(appLocalStore, SETUP_LINK_DSN_KEY) || '';
        dsnInput.value = remembered || (window.ZoeErrors ? ZoeErrors.getDsn() : '');
    }
}

function generateSetupLink() {
    const urlInput = document.getElementById('setupLinkUrlInput');
    const cfgInput = document.getElementById('setupLinkConfigInput');
    const resultBox = document.getElementById('setupLinkResultBox');
    const resultText = document.getElementById('setupLinkResultText');
    if (!urlInput || !cfgInput) return;

    const baseUrl = urlInput.value.trim().replace(/\/+$/, '');
    if (!/^https:\/\/.+/.test(baseUrl)) { alert('សូមបញ្ចូល Base URL ត្រឹមត្រូវ (ចាប់ផ្តើមដោយ https://)!'); return; }

    const normalized = readNormalizedFirebaseConfig(cfgInput);
    if (!normalized) return;
    const parsed = normalized.config;
    if (normalized.extras.length) showToast('ℹ️ រំលងវាលដែលមិនមែនរបស់ Firebase៖ ' + normalized.extras.join(', '));

    const dsnInput = document.getElementById('setupLinkDsnInput');
    const dsn = dsnInput ? dsnInput.value.trim() : '';
    if (dsn && !setupLinkDsnIsValid(dsn)) {
        alert('Sentry DSN មិនត្រឹមត្រូវទេ! វាត្រូវជា https://…sentry.io/… ឬទុកឲ្យទទេ។');
        return;
    }

    safeStoreSet(appLocalStore, SETUP_LINK_URL_KEY, baseUrl);
    safeStoreSet(appLocalStore, SETUP_LINK_DSN_KEY, dsn);

    let b64;
    try {
        b64 = btoa(unescape(encodeURIComponent(JSON.stringify(buildSetupPayload(parsed, dsn)))));
    } catch (e) {
        alert('មិនអាចបង្កើត Link បានទេ! សូមពិនិត្យ Config JSON');
        return;
    }

    lastGeneratedSetupLink = baseUrl + '/?setup=' + encodeURIComponent(b64);
    if (resultText) resultText.textContent = lastGeneratedSetupLink;
    if (resultBox) resultBox.classList.remove('hidden');

    const qrContainer = document.getElementById('setupLinkQrContainer');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        try {
            if (window.qrcode) {
                const qr = qrcode(0, 'M');
                qr.addData(lastGeneratedSetupLink);
                qr.make();
                qrContainer.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 8 });
            }
        } catch (e) {
            qrContainer.innerHTML = '';
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'generateSetupLink QR render' });
        }
    }
}

function copySetupLink() {
    const text = lastGeneratedSetupLink;
    return copySensitiveText(text, () => lastGeneratedSetupLink === text, () => showToast('✅ បានចម្លង Link!'));
}

let isSignedInUiActive = false;
let keyListCache = [];
let seatReadFailed = false;
let keyListSessionGeneration = 0;
const APP_LABELS = { ZOE: 'ZoeW', ALL: 'ទាំងអស់' };
const LICENSE_SEAT_SLOT_NAMES = ['d1', 'd2', 'd3', 'd4', 'd5'];
const LICENSE_SEAT_MAX = LICENSE_SEAT_SLOT_NAMES.length;
function seatLimitOf(value) {
    const n = Math.floor(Number(value));
    if (!isFinite(n) || n < 1) return 1;
    return n > LICENSE_SEAT_MAX ? LICENSE_SEAT_MAX : n;
}
function seatDevicesOf(node, limit) {
    const out = [];
    if (!node || typeof node !== 'object') return out;
    LICENSE_SEAT_SLOT_NAMES.slice(0, seatLimitOf(limit)).forEach((slot) => {
        const rec = node[slot];
        if (rec && typeof rec === 'object' && typeof rec.device === 'string' && rec.device) {
            out.push({ slot: slot, device: rec.device, at: typeof rec.at === 'number' ? rec.at : 0 });
        }
    });
    return out;
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function refreshKeyList() {
    const tbody = document.getElementById('keyListBody');
    if (!tbody || !db) return;
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">កំពុងផ្ទុក...</td></tr>';
    const myGeneration = keyListSessionGeneration;
    try {
        const [publicResult, metaResult, seatResult] = await withTimeout(Promise.allSettled([
            fb.get(fb.ref(db, 'license_keys')),
            fb.get(fb.ref(db, 'license_keys_meta')),
            fb.get(fb.ref(db, 'license_seats'))
        ]), 15000, 'Refresh timed out');
        if (myGeneration !== keyListSessionGeneration) return;
        if (publicResult.status === 'rejected') throw publicResult.reason;
        const publicSnap = publicResult.value;
        const publicData = publicSnap.exists() ? publicSnap.val() : {};
        if (metaResult.status === 'rejected') {
            console.error(metaResult.reason);
            if (window.ZoeErrors) ZoeErrors.capture(metaResult.reason, { context: 'refreshKeyList metaSnap' });
        }
        const metaData = (metaResult.status === 'fulfilled' && metaResult.value.exists()) ? metaResult.value.val() : {};
        seatReadFailed = seatResult.status === 'rejected';
        if (seatReadFailed) console.error(seatResult.reason);
        const seatData = (seatResult.status === 'fulfilled' && seatResult.value.exists()) ? seatResult.value.val() : {};

        const byId = Object.create(null);
        [LICENSE_APP_CODE].forEach((appCode) => {
            const bucket = publicData[appCode] || {};
            Object.keys(bucket).forEach((id) => {
                if (!byId[id]) byId[id] = { id: id, existsIn: [], perApp: {} };
                byId[id].existsIn.push(appCode);
                byId[id].perApp[appCode] = bucket[id] || {};
            });
        });

        const rows = Object.keys(byId).map((id) => {
            const entry = byId[id];
            const metaAppCode = entry.existsIn.find((appCode) => metaData[appCode] && metaData[appCode][id]) || entry.existsIn[0];
            const meta = (metaData[metaAppCode] && metaData[metaAppCode][id]) || {};
            const paths = entry.existsIn.slice().sort();
            const legacyMeta = {};
            paths.forEach((p) => {
                const rec = entry.perApp[p] || {};
                ['issuedAt', 'scope', 'note', 'createdBy', 'appPaths'].forEach((f) => {
                    if (rec[f] !== undefined) legacyMeta[f] = rec[f];
                });
            });
            const scope = meta.scope || legacyMeta.scope || (paths.length > 1 ? 'ALL' : paths[0]);
            const revokedFlags = paths.map((p) => !!entry.perApp[p].revoked);
            const expiryValues = paths.map((p) => entry.perApp[p].expiresAt);
            const revoked = revokedFlags.every((v) => v);
            let expiresAt;
            expiryValues.forEach((v) => {
                if (typeof v !== 'number') return;
                if (expiresAt === undefined || v < expiresAt) expiresAt = v;
            });
            const inconsistent = revokedFlags.some((v) => v !== revokedFlags[0])
                || expiryValues.some((v) => v !== expiryValues[0]);
            let seatNode = null;
            paths.forEach((p) => { if (!seatNode && seatData[p] && seatData[p][id]) seatNode = seatData[p][id]; });
            let maxDevices = 1;
            paths.forEach((p) => {
                const raw = entry.perApp[p] && entry.perApp[p].maxDevices;
                if (typeof raw === 'number' && raw >= 1) maxDevices = seatLimitOf(raw);
            });
            return Object.assign({ id: id }, legacyMeta, meta, {
                scope: scope, paths: paths, perApp: entry.perApp,
                inconsistent: inconsistent, revoked: revoked, expiresAt: expiresAt,
                maxDevices: maxDevices, seatDevices: seatDevicesOf(seatNode, maxDevices)
            });
        });

        rows.sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0));
        keyListCache = rows;
        renderKeyList();
    } catch (e) {
        if (myGeneration !== keyListSessionGeneration) return;
        console.error(e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'refreshKeyList' });
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6">មិនអាចផ្ទុកទិន្នន័យបានទេ</td></tr>';
    }
}

function renderKeyList() {
    const tbody = document.getElementById('keyListBody');
    if (!tbody) return;
    if (!keyListCache.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6">មិនទាន់មាន Key</td></tr>';
        return;
    }
    const now = getServerNow();
    tbody.innerHTML = keyListCache.map((row) => {
        let statusHtml;
        if (row.revoked) statusHtml = '<span class="badge badge-revoked">Revoked</span>';
        else if (row.expiresAt && now > row.expiresAt) statusHtml = '<span class="badge badge-expired">ផុតកំណត់</span>';
        else statusHtml = '<span class="badge badge-active">Active</span>';

        const expStr = row.expiresAt ? new Date(row.expiresAt).toLocaleDateString('km-KH') : '-';

        let seatHtml;
        if (seatReadFailed) {
            seatHtml = `<span class="badge badge-scope" title="${escapeHtml('អាន license_seats មិនបានទេ — សូមប្រាកដថា Firebase Rules ថ្មីត្រូវបាន Publish រួច')}">⚠️ ពិនិត្យមិនបាន</span>`;
        } else if (row.seatDevices.length > 0) {
            const boundText = row.seatDevices.map((d) => d.device.slice(0, 6) + '… ចងនៅ '
                + (d.at > 0 ? new Date(d.at).toLocaleDateString('km-KH') : '-')).join(' · ');
            seatHtml = `<span class="badge badge-active" title="${escapeHtml(boundText)}">📱 ${row.seatDevices.length}/${escapeHtml(String(row.maxDevices))}</span>`;
        } else {
            seatHtml = `<span class="badge badge-scope">📱 ទំនេរ (0/${escapeHtml(String(row.maxDevices))})</span>`;
        }

        if (row.inconsistent) {
            const perAppText = row.paths.map((p) => (APP_LABELS[p] || p) + ' = '
                + (row.perApp[p].revoked ? 'Revoked' : 'Active') + ', ផុតកំណត់ '
                + (row.perApp[p].expiresAt ? new Date(row.perApp[p].expiresAt).toLocaleDateString('km-KH') : '-')).join(' · ');
            statusHtml += ` <span class="badge badge-revoked" title="${escapeHtml('ស្ថានភាពមិនដូចគ្នារវាង App (ការធ្វើបច្ចុប្បន្នភាពមុនជោគជ័យមិនពេញលេញ)៖ ' + perAppText)}">⚠️ មិនត្រូវគ្នា</span>`;
        }

        const isPartialAll = false;
        const scopeLabel = escapeHtml(APP_LABELS[row.scope] || row.scope);
        const scopeHtml = isPartialAll
            ? `<span class="badge badge-scope" title="${escapeHtml('សកម្មតែលើ: ' + row.paths.map((p) => APP_LABELS[p] || p).join(', '))}">${scopeLabel} ⚠️</span>`
            : `<span class="badge badge-scope">${scopeLabel}</span>`;

        return `<tr>
            <td>${scopeHtml}</td>
            <td>${escapeHtml(row.id)}</td>
            <td class="note-cell">${escapeHtml(row.note || '-')}</td>
            <td>${expStr}</td>
            <td>${statusHtml} ${seatHtml}</td>
            <td>
                <div class="btn-row">
                    <button class="btn-mini" data-key-id="${escapeHtml(row.id)}" data-action="revoke">${row.revoked ? '✅ សង្គ្រោះ' : '⛔ Revoke'}</button>
                    <button class="btn-mini" data-key-id="${escapeHtml(row.id)}" data-action="extend">⏳ បន្ថែម</button>
                    <button class="btn-mini" data-key-id="${escapeHtml(row.id)}" data-action="devices">📱 ចំនួនឧបករណ៍</button>
                    <button class="btn-mini" data-key-id="${escapeHtml(row.id)}" data-action="release">🔓 ដោះឧបករណ៍</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function migrateLegacyLicenseKeyMetadata() {
    if (!db || !auth || !auth.currentUser) { alert('សូមចូលប្រព័ន្ធសិន!'); return; }
    if (!confirm('ដំណើរការនេះនឹងផ្លាស់ទី Note/Email/Scope/appPaths ចេញពី Key សាធារណៈ (license_keys) ទៅកន្លែងឯកជន (license_keys_meta)។\n\n⚠️ ត្រូវ Publish Firebase Rules ថ្មីជាមុនសិន (មើល README) មិនដូច្នេះទេ ដំណើរការនេះនឹងបរាជ័យ។\n\nបន្តទេ?')) return;

    try {
        const snap = await withTimeout(fb.get(fb.ref(db, 'license_keys')), 15000, 'Migration read timed out');
        const data = snap.exists() ? snap.val() : {};
        const updates = {};
        let migratedCount = 0;
        const META_FIELDS = ['issuedAt', 'scope', 'note', 'createdBy', 'appPaths'];

        [LICENSE_APP_CODE].forEach((appCode) => {
            const bucket = data[appCode] || {};
            Object.keys(bucket).forEach((id) => {
                const rec = bucket[id] || {};
                const hasLegacyFields = META_FIELDS.some((f) => rec[f] !== undefined);
                if (!hasLegacyFields) return;
                const meta = {};
                META_FIELDS.forEach((f) => {
                    if (rec[f] !== undefined) {
                        meta[f] = rec[f];
                        updates[`license_keys/${appCode}/${id}/${f}`] = null;
                    }
                });
                updates[`license_keys_meta/${appCode}/${id}`] = meta;
                migratedCount++;
            });
        });

        if (migratedCount === 0) {
            showToast('ℹ️ គ្មាន Key ចាស់ត្រូវការ Migrate ទេ — ស្អាតរួចហើយ!');
            return;
        }

        await withTimeout(retryAsync(() => fb.update(fb.ref(db), updates), 3, 1500), 30000, 'Migration write timed out');
        showToast(`✅ បាន Migrate Key ចំនួន ${migratedCount} ដោយជោគជ័យ!`);
        refreshKeyList();
    } catch (e) {
        console.error(e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'migrateLegacyLicenseKeyMetadata' });
        alert('Migrate មិនជោគជ័យទេ! សូមប្រាកដថា Firebase Rules ថ្មីត្រូវបាន Publish រួចហើយ រួចសាកល្បងម្តងទៀត។');
    }
}

async function toggleRevokeKey(id) {
    const operation = captureSensitiveSession(true);
    const operationDb = db;
    if (!operation || !operationDb) return;
    const row = keyListCache.find((r) => r.id === id);
    if (!row) return;
    const newRevoked = !row.revoked;
    if (!confirm(newRevoked ? 'តើអ្នកចង់ Revoke Key នេះមែនទេ? អ្នកប្រើប្រាស់នឹងលែងចូល App បានក្នុងពេលឆាប់ៗ។' : 'សង្គ្រោះ Key នេះមកវិញ?')) return;
    try {
        const results = await withTimeout(Promise.allSettled(row.paths.map((p) => fb.update(fb.ref(operationDb, `license_keys/${p}/${id}`), { revoked: newRevoked }))), 15000, 'Update timed out');
        if (!isSensitiveSessionCurrent(operation, true) || db !== operationDb) return;
        const failedPaths = row.paths.filter((p, i) => results[i].status === 'rejected');
        if (failedPaths.length === 0) {
            showToast(newRevoked ? '✅ Key ត្រូវបាន Revoke!' : '✅ Key ត្រូវបានសង្គ្រោះមកវិញ!');
        } else if (failedPaths.length < row.paths.length) {
            alert(`⚠️ ជោគជ័យមិនពេញលេញ! Key ត្រូវបាន${newRevoked ? ' Revoke' : 'សង្គ្រោះ'}សម្រាប់ App: ${row.paths.filter(p => !failedPaths.includes(p)).join(', ')}\nបរាជ័យសម្រាប់: ${failedPaths.join(', ')} — សូមសាកល្បងម្តងទៀត ព្រោះ Key នេះនៅតែអាចប្រើបានលើ App ដែលបរាជ័យ!`);
        } else {
            alert('មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ!');
        }
        refreshKeyList();
    } catch (e) {
        if (!isSensitiveSessionCurrent(operation, true) || db !== operationDb) return;
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'toggleRevokeKey' });
        alert('មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ!');
    }
}

async function setKeySeatLimit(id) {
    const operation = captureSensitiveSession(true);
    const operationDb = db;
    if (!operation || !operationDb) return;
    const row = keyListCache.find((r) => r.id === id);
    if (!row) return;
    const answer = prompt('Key នេះ Activate បានលើឧបករណ៍ប៉ុន្មាន? (១ ដល់ ' + LICENSE_SEAT_MAX + ')', String(row.maxDevices));
    if (answer === null) return;
    const next = Math.floor(Number(String(answer).trim()));
    if (!isFinite(next) || next < 1 || next > LICENSE_SEAT_MAX) {
        alert('សូមវាយលេខចន្លោះ ១ ដល់ ' + LICENSE_SEAT_MAX + '!');
        return;
    }
    if (next === row.maxDevices) return;
    if (next < row.seatDevices.length
        && !confirm('Key នេះចងនឹងឧបករណ៍ ' + row.seatDevices.length + ' រួចហើយ។\n\nការបន្ថយមក ' + next + ' ធ្វើឲ្យឧបករណ៍ដែលលើសលែងប្រើ Key នេះបាន។ បន្តទេ?')) return;
    try {
        await withTimeout(retryAsync(() => Promise.all(row.paths.map((p) => fb.update(fb.ref(operationDb, `license_keys/${p}/${id}`), { maxDevices: next }))), 3, 1000), 15000, 'Seat limit update timed out');
        if (!isSensitiveSessionCurrent(operation, true) || db !== operationDb) return;
        showToast('✅ Key នេះ Activate បានលើឧបករណ៍ ' + next + ' ហើយ!');
        refreshKeyList();
    } catch (e) {
        if (!isSensitiveSessionCurrent(operation, true) || db !== operationDb) return;
        console.error(e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'setKeySeatLimit' });
        alert('កំណត់ចំនួនឧបករណ៍មិនបានទេ! សូមប្រាកដថា Firebase Rules ថ្មីត្រូវបាន Publish រួច រួចសាកល្បងម្តងទៀត។');
    }
}

async function releaseKeySeat(id) {
    const operation = captureSensitiveSession(true);
    const operationDb = db;
    if (!operation || !operationDb) return;
    const row = keyListCache.find((r) => r.id === id);
    if (!row) return;
    if (seatReadFailed) {
        alert('អាន license_seats មិនបានទេ! សូម Publish Firebase Rules ថ្មីជាមុនសិន (មើល README) រួចសាកល្បងម្តងទៀត។');
        return;
    }
    if (row.seatDevices.length === 0) {
        alert('Key នេះមិនទាន់ចងនឹងឧបករណ៍ណាទេ — គ្មានអ្វីត្រូវដោះឡើយ។');
        return;
    }
    if (!confirm('ដោះឧបករណ៍ទាំង ' + row.seatDevices.length + ' ចេញពី Key នេះ?\n\nក្រោយដោះ ឧបករណ៍ចាស់នឹងលែងប្រើ Key នេះបាន ហើយឧបករណ៍ថ្មីរហូតដល់ ' + row.maxDevices + ' អាច Activate បាន។')) return;
    try {
        await withTimeout(retryAsync(() => Promise.all(row.paths.map((p) => fb.set(fb.ref(operationDb, `license_seats/${p}/${id}`), null))), 3, 1000), 15000, 'Release timed out');
        if (!isSensitiveSessionCurrent(operation, true) || db !== operationDb) return;
        showToast('✅ បានដោះឧបករណ៍! ឧបករណ៍ថ្មីអាច Activate បានឥឡូវ។');
        refreshKeyList();
    } catch (e) {
        if (!isSensitiveSessionCurrent(operation, true) || db !== operationDb) return;
        console.error(e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'releaseKeySeat' });
        alert('ដោះឧបករណ៍មិនបានទេ! សូមប្រាកដថា Firebase Rules ថ្មីត្រូវបាន Publish រួច រួចសាកល្បងម្តងទៀត។');
    }
}

let extendTargetId = null;

function openExtendModal(id) {
    extendTargetId = id;
    document.getElementById('extendDaysInput').value = 30;
    openModalHelper('extendModal');
}

async function confirmExtendKey() {
    const operation = captureSensitiveSession(true);
    const operationDb = db;
    if (!operation || !operationDb) return;
    const targetId = extendTargetId;
    const row = keyListCache.find((r) => r.id === targetId);
    if (!row) { closeModal('extendModal'); return; }
    const days = parseFloat(document.getElementById('extendDaysInput').value);
    if (isNaN(days) || days <= 0) { alert('សុពលភាពត្រូវធំជាង 0 ថ្ងៃ!'); return; }
    const timeSynced = await waitForServerTimeSync(15000);
    if (!isSensitiveSessionCurrent(operation, true) || db !== operationDb) return;
    if (!timeSynced) {
        alert('មិនអាចផ្ទៀងផ្ទាត់ម៉ោង Server បានទេ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។');
        return;
    }
    const newExpiresAt = getServerNow() + Math.round(days * 86400000);
    try {
        const results = await withTimeout(Promise.allSettled(row.paths.map((p) => fb.update(fb.ref(operationDb, `license_keys/${p}/${targetId}`), { expiresAt: newExpiresAt }))), 15000, 'Update timed out');
        if (!isSensitiveSessionCurrent(operation, true) || db !== operationDb) return;
        const failedPaths = row.paths.filter((p, i) => results[i].status === 'rejected');
        if (failedPaths.length === 0) {
            showToast('✅ បានបន្ថែមសុពលភាពរួចរាល់!');
        } else if (failedPaths.length < row.paths.length) {
            alert(`⚠️ ជោគជ័យមិនពេញលេញ! សូមសាកល្បងម្តងទៀតសម្រាប់ App: ${failedPaths.join(', ')}`);
        } else {
            alert('មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ!');
        }
        if (extendTargetId === targetId) closeModal('extendModal');
        refreshKeyList();
    } catch (e) {
        if (!isSensitiveSessionCurrent(operation, true) || db !== operationDb) return;
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'confirmExtendKey' });
        if (extendTargetId === targetId) closeModal('extendModal');
        alert('មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ!');
        refreshKeyList();
    }
}

function setupIOSPullToRefresh() {
    if (window.navigator.standalone !== true) return;

    const indicator = document.createElement('div');
    indicator.className = 'ptr-indicator';
    indicator.innerHTML = '<div class="ptr-spinner"></div>';
    document.body.appendChild(indicator);

    const threshold = 100;
    const maxPull = 160;
    let startY = 0;
    let lastPull = 0;
    let pulling = false;
    let refreshing = false;

    function atTop() {
        if (refreshing || isGeneratingKey || signingPrivateKeyJwk) return false;
        if (document.querySelector('.modal.active')) return false;
        return (document.scrollingElement || document.documentElement).scrollTop <= 0;
    }

    function reset() {
        pulling = false;
        lastPull = 0;
        indicator.classList.add('snapping');
        indicator.classList.remove('visible');
        indicator.style.transform = 'translateY(-50px)';
    }

    document.addEventListener('touchstart', (e) => {
        if (!atTop()) { pulling = false; return; }
        startY = e.touches[0].clientY;
        lastPull = 0;
        pulling = true;
        indicator.classList.remove('snapping');
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!pulling) return;
        if (!atTop()) { reset(); return; }
        const diffY = e.touches[0].clientY - startY;
        if (diffY <= 0) { reset(); return; }
        e.preventDefault();
        lastPull = Math.min(diffY, maxPull);
        indicator.classList.add('visible');
        indicator.style.transform = 'translateY(' + (lastPull - 50) + 'px)';
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (!pulling) return;
        pulling = false;
        if (lastPull >= threshold) {
            refreshing = true;
            indicator.classList.add('snapping');
            indicator.style.transform = 'translateY(16px)';
            setTimeout(() => window.location.reload(), 200);
        } else {
            reset();
        }
    }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.ZoeErrors) ZoeErrors.init('zoekeygen');
    if (window.ZoeLicense) window.ZoeLicense.syncServerTime().catch(() => {});
    initFirebase();
    updateSigningKeyBadge();
    restoreSetupLinkBaseUrl();
    setupIOSPullToRefresh();

    setupActionDelegation();
    setupConnectionRecovery();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) return;
        renderConnectionStatus();
        retryFirebaseSdkNow();
        nudgeDatabaseConnection();
        retryPendingRoleCheck();
    });

    requestSessionSigningKeyRestoreIfEligible();

    document.querySelectorAll('.modal').forEach((modal) => {
        modal.addEventListener('mousedown', (e) => {
            if (e.target !== modal || modal.dataset.nodismiss === 'true') return;
            const fnName = modal.getAttribute('data-close');
            if (fnName && typeof window[fnName] === 'function') window[fnName]();
            else closeModal(modal.id);
        });
    });

    const keyListBody = document.getElementById('keyListBody');
    if (keyListBody) {
        keyListBody.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-key-id]');
            if (!btn) return;
            const id = btn.dataset.keyId;
            if (btn.dataset.action === 'revoke') toggleRevokeKey(id);
            else if (btn.dataset.action === 'extend') openExtendModal(id);
            else if (btn.dataset.action === 'devices') setKeySeatLimit(id);
            else if (btn.dataset.action === 'release') releaseKeySeat(id);
        });
    }

    revealAppAfterBoot();
});
