    const APP_VERSION = '2.25.8';

    const appLocalStore = (function () { try { return window.localStorage; } catch (e) { return null; } })();
    const appSessionStore = (function () { try { return window.sessionStorage; } catch (e) { return null; } })();

    const ACTION_ALLOWLIST = [
        "applySheetImportHeaderRow",
        "cancelLocationChange",
        "cancelPermanentDelete",
        "cancelPinEntryFlow",
        "cancelPinSetupFlow",
        "cancelRestoreItem",
        "closeCameraManually",
        "closeConfigQrScanner",
        "closeEditBarcodeModal",
        "closeModal",
        "closeRecentlyDeletedModal",
        "closeSheetImportModal",
        "closeSideDrawer",
        "confirmLocationChange",
        "confirmPhone",
        "debouncedSearchByPhone",
        "decodeImageFile",
        "dismissPhoneModal",
        "drawerAppLockFlow",
        "drawerBiometricFlow",
        "drawerConfigFlow",
        "drawerCustomerTableFlow",
        "drawerLockerSettingsFlow",
        "drawerLoginFlow",
        "drawerLookupApiFlow",
        "drawerSheetImportFlow",
        "editSheetImportConfig",
        "executePermanentDelete",
        "executeRestoreItem",
        "exportDataAsCsvForSheets",
        "exportDataAsExcel",
        "exportDataAsPDF",
        "fetchCustomerDataTableRows",
        "filterCustomerDataTable",
        "filterDataByCustomDate",
        "filterDataByDate",
        "filterRecentlyDeleted",
        "forgetAppLockPin",
        "handleCallAction",
        "handleSheetImportFileInput",
        "loadSheetImportSelectedSheet",
        "logoutApp",
        "moreMenuClearHistory",
        "moreMenuDelete",
        "moreMenuEditPhone",
        "moreMenuExchangeRate",
        "moreMenuExport",
        "moreMenuManualAdjust",
        "moreMenuRecentlyDeleted",
        "moreMenuResetPickup",
        "moreMenuViewList",
        "openCallMarkModal",
        "openConfigQrScanner",
        "openDailyStatsModal",
        "openEditBarcodePriceModal",
        "openEditModal",
        "openLockerPicker",
        "openMonthlyStatsModal",
        "openSideDrawer",
        "openViewListModal",
        "pickSheetImportFile",
        "promptPermanentDelete",
        "promptRestoreDeletedItem",
        "removeSingleBarcode",
        "renderEntryList",
        "renderLockerList",
        "renderSheetImportPreview",
        "requestCameraPermission",
        "resetSheetImportFileSelection",
        "runAppLockBiometric",
        "runBiometricUnlock",
        "runSheetImport",
        "runSheetImportClear",
        "saveEditedBarcodePrice",
        "saveEditedPhone",
        "saveExchangeRate",
        "saveFirebaseConfig",
        "saveLockerSettings",
        "saveLookupApiConfig",
        "saveNewSecurityPin",
        "saveSheetImportConfig",
        "searchByPhone",
        "selectCustomLocker",
        "setCallMark",
        "setEntryScanMode",
        "submitActivationKey",
        "submitAppLockForm",
        "submitLoginForm",
        "submitManualAdjustment",
        "submitManualBarcode",
        "switchAppPage",
        "testLookupApiConfig",
        "toggleCloseStatus",
        "toggleHeaderMoreDropdown",
        "toggleIndividualBarcodeClose",
        "toggleMoreDropdown",
        "toggleTorch",
        "toggleTrashGroup",
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
    function submitLoginForm(event) {
        if (event) event.preventDefault();
        loginWithFirebase();
    }

    function drawerConfigFlow() {
        drawerAction(function () { requestPinBeforeConfig(null, 'config'); });
    }

    function drawerLockerSettingsFlow() {
        drawerAction(function () { requestPinBeforeConfig(openLockerSettingsModal, 'locker'); });
    }

    function drawerLookupApiFlow() {
        drawerAction(function () { requestPinBeforeConfig(openLookupApiConfigModal, 'lookupApi'); });
    }

    function drawerCustomerTableFlow() {
        drawerAction(openCustomerDataTableModal);
    }

    function drawerLoginFlow() {
        drawerAction(showLoginModalWithPrefill);
    }

    function drawerBiometricFlow() {
        drawerAction(toggleBiometricUnlock);
    }

    function renderAppVersionLabels() {
        document.querySelectorAll('[data-app-version]').forEach((el) => {
            el.textContent = 'កំណែប្រព័ន្ធ: ' + APP_VERSION;
        });
    }

    renderAppVersionLabels();

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => { window.scrollTo(0, 0); });
    }

    setupActionDelegation();

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

    let firebaseConfig = null;
    let fb = null;
    let auth = null;
    let db = null;
    let dbRefHistory = null;
    let dbRefDeleted = null;
    let dbRefDailyRevenue = null;
    let dbRefMonthlyRevenue = null;
    let dbRefDailyPickup = null;
    let dbRefExchangeRate = null;
    let dbRefConnected = null;
    let dbRefServerTimeOffset = null;
    let authUnsubscribe = null;
    let authRecoveryTimeout = null;
    let authGeneration = 0;
    let sessionExpiryCheck = 'pending';
    let isDatabaseConnected = false;
    let hasEverConnectedToDatabase = false;
    let networkJustReturned = false;

    let exchangeRateRiel = parseFloat(safeStoreGet(appLocalStore, 'zoew_exchange_rate')) || 4100;

    let codeReader = null;
    let liveScanCodeReader = null;
    let scanConfirmCode = '';
    let scanConfirmCount = 0;
    let scanConfirmAt = 0;
    let scanVideoResumeTimer = null;
    let currentStream = null;
    let isCameraScanning = false;
    let isCameraStarting = false;
    let cameraRequestId = 0;
    let pendingLoadedMetadataHandler = null;
    let nativeLoopActive = false;
    let zxingLoopActive = false;
    let liveScanWidthIndex = -1;
    let liveScanCostEma = 0;
    let lastDecodedVideoTime = -1;
    let staleFrameStreak = 0;
    let freshFrameGateUsable = true;
    let perfSamplePending = false;
    let displayHz = 60;
    let displayHzMeasured = false;
    let autoLoginAttempted = false;
    let currentVideoTrack = null;
    let torchOn = false;

    let scanHistory = [];
    let deletedItems = [];
    let isInitializingFirebase = false;
    let dailyRevenueData = {};
    let monthlyRevenueData = {};
    let dailyPickupData = {};
    let pickupResetInFlight = false;
    const PICKUP_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
    let currentFilterMode = 'today';
    let customFilterDate = '';
    let pendingBarcode = "";
    let lastScannedCode = "";
    let lastScanTime = 0;
    let editingItemId = null;
    let markingItemId = null;

    let activeEditingBarcode = null;
    let activeParentItemId = null;
    let pendingRestoreId = null;
    const pendingHistoryPatches = new Map();
    const HISTORY_PATCH_RETRY_MAX = 5;
    const HISTORY_PATCH_QUEUE_MAX = 50;
    let historyPatchFlushInFlight = false;
    const pendingRegistryReleases = new Map();
    const REGISTRY_RELEASE_RETRY_MAX = 6;
    const REGISTRY_RELEASE_QUEUE_MAX = 500;
    let registryReleaseFlushInFlight = false;

    let serverTimeOffsetMs = 0;
    function getServerNow() {
        return Date.now() + serverTimeOffsetMs;
    }

    let serverClockTrusted = false;

    function serverClockOffsetIsFromServer(offsetMs) {
        return offsetMs !== 0 || isDatabaseConnected || hasEverConnectedToDatabase;
    }

    function cleanupClockIsTrustworthy() {
        return serverClockTrusted && isDatabaseConnected;
    }

    let nativeDetector = null;
    let isModalOpen = false;
    let phoneModalDismissPromptOpen = false;
    let searchTimer = null;
    let isDatabaseInitialized = false;
    let dbListenersFailed = false;
    let dbListenerRecoveryTimer = null;
    let dbListenerRecoveryAttempt = 0;
    let lastDbListenerAttemptAt = 0;
    let dbListenerOutageNoticeShown = false;
    const DB_LISTENER_KEYS = ['exchangeRate', 'dailyRevenue', 'monthlyRevenue', 'dailyPickup', 'history', 'deleted'];
    const DB_LISTENER_KEY_DELETED = 'deleted';
    const DB_LISTENER_KEY_HISTORY = 'history';
    const dbListenerPendingPaths = new Set();
    const dbListenerFailedPaths = new Set();
    let dbListenerPendingSeen = 0;
    let dbListenerProgressAt = 0;
    let dbListenerGeneration = 0;
    let pickupLedgerRepairDone = false;
    let pickupLedgerRepairRunning = false;
    let infoListenersFailed = false;
    let infoListenerRecoveryTimer = null;
    let infoListenerRecoveryAttempt = 0;
    let infoListenerGeneration = 0;
    let reconnectWatchdogTimer = null;
    let reconnectWatchdogAttempt = 0;
    let lastForcedReconnectAt = 0;
    let globalAudioCtx = null;

    let lastEnteredLocker = safeStoreGet(appLocalStore, 'last_entered_locker') || "";

    function sanitizePhoneNumber(phoneStr) {
        if (!phoneStr) return '';
        let trimmed = String(phoneStr).trim();
        trimmed = trimmed.replace(/^(\+?855-?)/, '0');
        return trimmed;
    }

    function normalizeStoredPhone(phoneStr) {
        if (!phoneStr) return '';
        return String(phoneStr).split(/[\/,]/).map(normalizeOneStoredPhone).filter(Boolean).join('/');
    }

    function normalizeOneStoredPhone(part) {
        let trimmed = String(part).trim();
        trimmed = trimmed.replace(/^[='"\s-]+/, '');
        if (/^\+?855/.test(trimmed)) {
            trimmed = trimmed.replace(/^\+?855[\s-]*/, '');
        }
        if (/^\d/.test(trimmed) && trimmed.charAt(0) !== '0') {
            trimmed = '0' + trimmed;
        }
        return trimmed;
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

    function openModalHelper(modalId) {
        isModalOpen = true;
        showAppChrome();
        hidePhoneSuggestions();
        document.body.style.overflow = 'hidden';
        const modalEl = document.getElementById(modalId);
        if(modalEl) modalEl.style.display = 'flex';
    }

    function resumeScanVideo() {
        if (!currentStream || !isCameraScanning) return;
        const videoElement = document.getElementById('video');
        if (!videoElement) return;
        try {
            const playing = videoElement.play();
            if (playing && typeof playing.catch === 'function') playing.catch(() => {});
        } catch (e) {}
    }

    function onScanVideoPause() {
        if (!currentStream || !isCameraScanning) return;
        if (scanVideoResumeTimer) return;
        scanVideoResumeTimer = setTimeout(() => {
            scanVideoResumeTimer = null;
            const videoElement = document.getElementById('video');
            if (!videoElement || !videoElement.paused) return;
            resumeScanVideo();
        }, 150);
    }

    function closeModal(modalId) {
        const modalEl = document.getElementById(modalId);
        if(modalEl) modalEl.style.display = 'none';
        if (modalId === 'phoneModal') clearLookupStatus();
        document.body.style.overflow = '';
        pendingBarcode = "";
        editingItemId = null;
        markingItemId = null;
        isModalOpen = Array.from(document.querySelectorAll('.modal')).some(m => m.style.display === 'flex');
        if (!isModalOpen) {
            safeFocusScanner();
            resumeScanVideo();
        }
    }

    function dismissPhoneModal() {
        if (phoneModalDismissPromptOpen) return;
        const modalEl = document.getElementById('phoneModal');
        if (!modalEl || modalEl.style.display !== 'flex') return;
        phoneModalDismissPromptOpen = true;
        setTimeout(() => { phoneModalDismissPromptOpen = false; }, 0);
        const confirmed = confirm("តើអ្នកពិតជាចង់បោះបង់កញ្ចប់នេះមែនទេ? ព័ត៌មានដែលបានវាយបញ្ចូល (លេខទូរស័ព្ទ, Locker, COD, DOD) នឹងបាត់ ហើយកញ្ចប់នេះនឹងមិនត្រូវបានរក្សាទុកទេ។");
        resumeScanVideo();
        if (!confirmed) return;
        closeModal('phoneModal');
    }

    function cleanupResources() {
        stopCurrentStream();
        if (codeReader && typeof codeReader.reset === 'function') {
            try {
                codeReader.reset();
            } catch(e) {}
        }
        if (globalAudioCtx && globalAudioCtx.state !== 'closed') {
            try {
                globalAudioCtx.close();
            } catch(e) {}
            globalAudioCtx = null;
        }
    }
    window.addEventListener('beforeunload', cleanupResources);

    function preconnectToOrigin(rawUrl) {
        try {
            if (!rawUrl) return;
            const parsed = new URL(rawUrl);
            if (!/^https?:$/.test(parsed.protocol)) return;
            const origin = parsed.origin;
            const already = Array.from(document.querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"]'))
                .some(l => l.href.replace(/\/$/, '') === origin);
            if (already) return;
            const preconnect = document.createElement('link');
            preconnect.rel = 'preconnect';
            preconnect.href = origin;
            preconnect.crossOrigin = 'anonymous';
            document.head.appendChild(preconnect);
        } catch (e) {}
    }

    function preconnectToLookupHost() {
        const cfg = getLookupApiConfig();
        if (!cfg || !cfg.enabled || !cfg.url) return;
        preconnectToOrigin(cfg.url);
    }

    function preconnectToDatabaseHost(cfg) {
        try {
            if (!cfg || !cfg.databaseURL) return;
            const dbOrigin = new URL(cfg.databaseURL).origin;
            const already = Array.from(document.querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"]'))
                .some(l => l.href.replace(/\/$/, '') === dbOrigin);
            if (already) return;
            const preconnect = document.createElement('link');
            preconnect.rel = 'preconnect';
            preconnect.href = dbOrigin;
            preconnect.crossOrigin = 'anonymous';
            document.head.appendChild(preconnect);
        } catch (e) {}
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

    function debounce(fn, ms) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    const debouncedRenderAfterHistorySync = debounce(() => {
        runAutomaticCleanupRules();
        refreshCurrentHistoryView();
        updateRecentPhonesList();
        refreshEntryPagePanels();
    }, 120);

    function withTimeout(promise, ms, timeoutMsg) {
        const timeoutErr = new Error(timeoutMsg || 'Timed out');
        let timer;
        return Promise.race([
            promise.finally(() => clearTimeout(timer)),
            new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutErr), ms); })
        ]);
    }

    const DB_OP_TIMEOUT_MS = 15000;

    function dbOp(promise, timeoutMsg) {
        return withTimeout(promise, DB_OP_TIMEOUT_MS, timeoutMsg || 'Database operation stalled');
    }

    function dbOpStalled(error) {
        return !!(error && /stalled/i.test(String(error.message || error)));
    }

    function armLateCommit(promise, onCommitted, onFailed, label) {
        if (!promise || typeof promise.then !== 'function') return false;
        promise.then((result) => {
            if (result && result.committed) return onCommitted(result);
            return onFailed ? onFailed(null, result) : undefined;
        }, (error) => (onFailed ? onFailed(error, null) : undefined)).catch((error) => {
            console.error('Late commit follow-up failed for', label, error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: 'armLateCommit ' + (label || '') });
        });
        return true;
    }

    function armLateWrite(promise, onDone, onFailed, label) {
        if (!promise || typeof promise.then !== 'function') return false;
        promise.then(() => (onDone ? onDone() : undefined), (error) => (onFailed ? onFailed(error) : undefined))
            .catch((error) => {
                console.error('Late write follow-up failed for', label, error);
                if (window.ZoeErrors) ZoeErrors.capture(error, { context: 'armLateWrite ' + (label || '') });
            });
        return true;
    }

    function notifyIfSlow(promise, ms, message) {
        if (!promise || typeof promise.then !== 'function') return promise;
        let timer = setTimeout(() => {
            timer = null;
            showToast(message);
        }, ms);
        const stop = () => {
            if (timer === null) return;
            clearTimeout(timer);
            timer = null;
        };
        promise.then(stop, stop);
        return promise;
    }

    function viewListModalShowing(itemId) {
        const modalEl = document.getElementById('viewListModal');
        return !!(modalEl && modalEl.style && modalEl.style.display === 'flex' && activeParentItemId === itemId);
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

    function retryAsync(fn, attempts, delayMs) {
        return fn().catch((err) => {
            if (attempts <= 1 || (err && err.noRetry)) throw err;
            return new Promise((resolve) => setTimeout(resolve, delayMs)).then(() => retryAsync(fn, attempts - 1, delayMs * 2));
        });
    }

    function lookupResponseError(status, body, retryable) {
        const error = new Error('HTTP ' + status);
        error.lookupCode = body && body.code ? String(body.code) : '';
        error.lookupReason = safeLookupReason(body && body.reason);
        if (!retryable) error.noRetry = true;
        return error;
    }

    function markLookupTimeoutNoRetry(error) {
        if (error && error.message === 'Auto lookup timed out') error.noRetry = true;
        throw error;
    }

    function lookupFailureCooldownMs(kind) {
        return kind === 'transient' ? AUTO_LOOKUP_TRANSIENT_COOLDOWN_MS : AUTO_LOOKUP_FAIL_COOLDOWN_MS;
    }

    function lookupFailureIsDefinitive(error) {
        const code = String(error && error.lookupCode || '');
        if (code === 'ZTO_AUTH_EXPIRED' || code === 'ZTO_AUTH_NOT_CONFIGURED'
            || code === 'ZTO_CONFIG_INVALID' || code === 'ZTO_PROXY_NOT_CONFIGURED') return true;
        return /^HTTP (401|403)$/.test(error && error.message || '');
    }

    function retryTransientLookupResponse(out) {
        const status = Number(out && out.res && out.res.status);
        const code = String(out && out.body && out.body.code || '');
        if (code === 'ZTO_AUTH_NOT_CONFIGURED' || code === 'ZTO_CONFIG_INVALID'
            || code === 'ZTO_PROXY_NOT_CONFIGURED') return out;
        if (code === 'ZTO_TIMEOUT') {
            throw lookupResponseError(status, out && out.body, false);
        }
        if (status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599)) {
            throw lookupResponseError(status, out && out.body, true);
        }
        return out;
    }

    function linkIsFrugal() {
        const link = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!link) return false;
        if (link.saveData === true) return true;
        const type = String(link.effectiveType || '');
        return type === 'slow-2g' || type === '2g';
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

    const RECONNECT_FORCE_MIN_GAP_MS = 3000;
    const RECONNECT_WATCHDOG_STEPS_MS = [5000, 10000, 20000, 40000, 60000];
    const LISTENER_RECOVERY_STEPS_MS = [2000, 5000, 10000, 20000, 30000];
    const INFO_LISTENER_RECOVERY_STEPS_MS = [2000, 5000, 10000, 20000, 30000];
    const INFO_LISTENER_KEY_CONNECTED = 'connected';
    const INFO_LISTENER_KEY_OFFSET = 'serverTimeOffset';
    const infoListenerFailedPaths = new Set();
    const CONNECTING_GRACE_ATTEMPTS = 3;
    const DB_LISTENER_RETRY_MIN_GAP_MS = 3000;
    const DB_LISTENER_PROGRESS_GRACE_MS = 20000;

    function connectionLooksOnline() {
        return isDatabaseConnected && navigator.onLine !== false && !dbListenersFailed;
    }

    function connectionIsSettlingIn() {
        if (isDatabaseConnected || navigator.onLine === false) return false;
        if (firebaseSdkUnavailable) return false;
        return reconnectWatchdogAttempt < CONNECTING_GRACE_ATTEMPTS;
    }

    function renderConnectionStatus() {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('firebaseStatusText');
        const online = connectionLooksOnline();
        const reconnecting = !online && isDatabaseConnected && dbListenersFailed && navigator.onLine !== false;
        const settling = !online && !reconnecting && connectionIsSettlingIn();
        if (statusDot) {
            statusDot.classList.toggle('offline', !online);
            statusDot.classList.toggle('connecting', reconnecting || settling);
        }
        if (statusText) {
            statusText.classList.toggle('is-online', online);
            statusText.classList.toggle('is-connecting', !online && (reconnecting || settling));
            statusText.classList.toggle('is-offline', !online && !reconnecting && !settling);
            statusText.innerText = online
                ? "ភ្ជាប់ Server រួចរាល់"
                : (reconnecting
                    ? "កំពុងភ្ជាប់ឡើងវិញ..."
                    : (settling ? "កំពុងភ្ជាប់..." : "ក្រៅបណ្ដាញ"));
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
            retryFailedDbListenersNow();
            if (window.ZoeLicense && typeof ZoeLicense.syncServerTime === 'function') {
                ZoeLicense.syncServerTime().catch(() => {});
            }
        });
        window.addEventListener('offline', () => {
            clearReconnectWatchdog();
            renderConnectionStatus();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            renderConnectionStatus();
            retryFirebaseSdkNow();
            nudgeDatabaseConnection();
            retryFailedDbListenersNow();
        });
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
            if (isDatabaseConnected) {
                hasEverConnectedToDatabase = true;
                clearReconnectWatchdog();
                retryFailedDbListenersNow();
                flushPendingHistoryPatches();
                flushPendingRegistryReleases();
            } else if (navigator.onLine !== false) {
                scheduleReconnectWatchdog();
            }
            renderConnectionStatus();
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
            serverClockTrusted = true;
            if (window.ZoeLicense) window.ZoeLicense.setServerTimeOffset(val);
        }, (err) => {
            if (listenerGeneration !== infoListenerGeneration) return;
            handleInfoListenerError(err, INFO_LISTENER_KEY_OFFSET);
        });

        return true;
    }

    async function initFirebase() {
        const savedConfig = safeStoreGet(appLocalStore, 'zoew_firebase_config');
        if (!savedConfig) {
            checkPinAndOpenConfig(true);
            return false;
        }

        if (isInitializingFirebase) return false;
        isInitializingFirebase = true;

        try {
            firebaseConfig = JSON.parse(savedConfig);
            preconnectToDatabaseHost(firebaseConfig);
            fb = await waitForFirebaseSDK();
            firebaseSdkUnavailable = false;
            sdkUnavailableNoticeShown = false;
            resetFirebaseSdkRetryHealth();

            const existingApps = fb.getApps();
            if (existingApps.length) {
                detachDatabaseListeners();
                detachInfoListeners();
                isDatabaseInitialized = false;
                isDatabaseConnected = false;
                hasEverConnectedToDatabase = false;
                networkJustReturned = false;
                resetDbListenerHealthState();
                renderConnectionStatus();
                scanHistory = [];
                deletedItems = [];
                dailyRevenueData = {};
                monthlyRevenueData = {};
                dailyPickupData = {};
                lockerBarcodeIndex = {};
                if (typeof fb.deleteApp === 'function') {
                    await Promise.all(existingApps.map(a => fb.deleteApp(a).catch(() => {})));
                }
            }

            const firebaseApp = fb.getApps().length ? fb.getApps()[0] : fb.initializeApp(firebaseConfig);
            auth = fb.getAuth(firebaseApp);
            db = fb.getDatabase(firebaseApp);

            try {
                fb.goOnline(db);
            } catch(e) {}

            dbRefHistory = fb.ref(db, 'zoew_scan_history_cod_dod');
            dbRefDeleted = fb.ref(db, 'zoew_recently_deleted_cod_dod');
            dbRefDailyRevenue = fb.ref(db, 'zoew_daily_revenue_cod_dod');
            dbRefMonthlyRevenue = fb.ref(db, 'zoew_monthly_revenue_cod_dod');
            dbRefDailyPickup = fb.ref(db, 'zoew_daily_pickup_cod_dod');
            dbRefExchangeRate = fb.ref(db, 'zoew_settings/exchange_rate');
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
            checkPinAndOpenConfig(true);
            return false;
        } finally {
            isInitializingFirebase = false;
            let currentConfig = savedConfig;
            try { currentConfig = appLocalStore.getItem('zoew_firebase_config'); } catch (e) {}
            if (currentConfig !== savedConfig) initFirebase();
        }
    }

    async function hashPinLegacy(pin) {
        const enc = new TextEncoder().encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function hashPin(pin) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: enc.encode('zoeadmin_pin_verify_v2'), iterations: 150000, hash: 'SHA-256' },
            keyMaterial,
            256
        );
        return 'pbkdf2:' + Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function verifyStoredPin(enteredPin, savedHash) {
        if (!savedHash) return false;
        if (savedHash.startsWith('pbkdf2:')) return (await hashPin(enteredPin)) === savedHash;
        return (await hashPinLegacy(enteredPin)) === savedHash;
    }

    let lookupSecretKey = null;

    async function deriveLookupSecretKey(pin) {
        try {
            const enc = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
            return await crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt: enc.encode('zoeadmin_lookup_api_secret_v1'), iterations: 150000, hash: 'SHA-256' },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
        } catch (e) {
            return null;
        }
    }

    async function encryptLookupSecret(plainText) {
        if (!lookupSecretKey || !plainText) return null;
        try {
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, lookupSecretKey, new TextEncoder().encode(plainText));
            return { iv: Array.from(iv), data: Array.from(new Uint8Array(cipherBuf)) };
        } catch (e) {
            return null;
        }
    }

    async function decryptLookupSecret(encObj) {
        if (!lookupSecretKey || !encObj || !Array.isArray(encObj.data) || !Array.isArray(encObj.iv)) return '';
        try {
            const iv = new Uint8Array(encObj.iv);
            const data = new Uint8Array(encObj.data);
            const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, lookupSecretKey, data);
            return new TextDecoder().decode(plainBuf);
        } catch (e) {
            return '';
        }
    }

    let pinTargetAction = null;

    const PIN_PROMPT_MESSAGES = {
        config: {
            verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បី Config ឬ Reconfig',
            setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការ Config ឬ Reconfig លើកក្រោយ'
        },
        lookupApi: {
            verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីកំណត់ API ស្វែងរកអតិថិជន',
            setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការកំណត់ API ស្វែងរកអតិថិជន លើកក្រោយ'
        },
        locker: {
            verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីកំណត់ទូ Locker',
            setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការកំណត់ទូ Locker លើកក្រោយ'
        },
        manualAdjust: {
            verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីកែទឹកប្រាក់ ឬចំនួនកញ្ចប់',
            setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការកែទឹកប្រាក់ ឬចំនួនកញ្ចប់ លើកក្រោយ'
        },
        resetPickup: {
            verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បី Reset ចំនួនអតិថិជន និងកញ្ចប់យករួច',
            setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការ Reset ចំនួនអតិថិជន និងកញ្ចប់យករួច លើកក្រោយ'
        },
        clearHistory: {
            verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីលុបទិន្នន័យទាំងអស់',
            setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការលុបទិន្នន័យទាំងអស់ លើកក្រោយ'
        },
        appLock: {
            verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីបើកការចាក់សោពេលបើក App',
            setup: 'សូមកំណត់លេខកូដ PIN ដែលនឹងប្រើដោះសោ App រាល់ពេលបើក'
        },
        sheetImport: {
            verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីនាំចូល Excel ទៅ Google Sheet',
            setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការនាំចូល Excel ទៅ Google Sheet លើកក្រោយ'
        },
        setupLink: {
            verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីអនុវត្ត Setup Link ចូល Config',
            setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការអនុវត្ត Setup Link លើកក្រោយ'
        },
        biometric: {
            verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីបើកការចូលដោយក្រយៅដៃ ឬមុខ',
            setup: 'សូមកំណត់លេខកូដ PIN សិន មុននឹងបើកការចូលដោយក្រយៅដៃ ឬមុខ'
        }
    };

    function applyPinPromptText(promptKey) {
        const texts = PIN_PROMPT_MESSAGES[promptKey] || PIN_PROMPT_MESSAGES.config;
        const verifyDesc = document.getElementById('pinModalDesc');
        if (verifyDesc) verifyDesc.textContent = texts.verify;
        const setupDesc = document.getElementById('pinSetupModalDesc');
        if (setupDesc) setupDesc.textContent = texts.setup;
    }

    function requestPinBeforeConfig(targetAction, promptKey) {
        pinTargetAction = targetAction || openConfigModal;
        applyPinPromptText(promptKey);
        let savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');
        if (!savedPin) {
            openModalHelper('pinSetupModal');
        } else {
            const pinIn = document.getElementById('securityPinInput');
            if(pinIn) pinIn.value = '';
            openModalHelper('pinModal');
            refreshBiometricUi();
            if (isBiometricEnabled()) runBiometricUnlock();
        }
    }

    async function saveNewSecurityPin() {
        const newPinIn = document.getElementById('newSecurityPinInput');
        let pinVal = newPinIn ? newPinIn.value.trim() : '';
        if (!pinVal) {
            alert("សូមបញ្ចូលលេខ PIN ឱ្យបានត្រឹមត្រូវ!");
            return;
        }
        if (pinVal.length < 6) {
            alert("Security PIN ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ ដើម្បីសុវត្ថិភាព!");
            return;
        }
        try {
            appLocalStore.setItem('zoew_security_pin_hash', await hashPin(pinVal));
            lookupSecretKey = await deriveLookupSecretKey(pinVal);
            await migrateLookupSecretIfNeeded();
        } catch (e) {
            alert("មិនអាចកំណត់ PIN បានទេ! សូមប្រើ HTTPS ហើយសាកល្បងម្តងទៀត។");
            return;
        } finally {
            if (newPinIn) newPinIn.value = '';
        }
        closeModal('pinSetupModal');
        clearBiometricRecord();
        refreshBiometricUi();
        markAppUnlockedForSession();
        refreshAppLockUi();
        showToast("បានកំណត់ Security PIN រួចរាល់!");
        (pinTargetAction || openConfigModal)(pinVal);
    }

    let isVerifyingPin = false;

    async function verifySecurityPin() {
        if (isVerifyingPin) return;

        const pinIn = document.getElementById('securityPinInput');
        let enteredPin = pinIn ? pinIn.value.trim() : '';
        if (pinIn) pinIn.value = '';
        let savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');

        const lockoutUntil = parseInt(safeStoreGet(appLocalStore, 'zoew_pin_lockout_until') || '0');
        if (lockoutUntil && Date.now() < lockoutUntil) {
            const secondsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
            alert(`បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ${secondsLeft} វិនាទី មុននឹងសាកល្បងម្តងទៀត។`);
            return;
        }

        isVerifyingPin = true;
        try {
            if (savedPin && (await verifyStoredPin(enteredPin, savedPin))) {
                await completePinUnlock(enteredPin);
            } else {
                let failCount = (parseInt(appLocalStore.getItem('zoew_pin_fail_count') || '0') || 0) + 1;
                if (failCount >= 5) {
                    appLocalStore.setItem('zoew_pin_lockout_until', (Date.now() + 60000).toString());
                    appLocalStore.setItem('zoew_pin_fail_count', '0');
                    alert("បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ១ នាទី មុននឹងសាកល្បងម្តងទៀត។");
                } else {
                    appLocalStore.setItem('zoew_pin_fail_count', failCount.toString());
                    alert("លេខ PIN មិនត្រឹមត្រូវទេ!");
                }
            }
        } catch (e) {
            alert("មិនអាចផ្ទៀងផ្ទាត់ PIN បានទេ! សូមប្រើ HTTPS ហើយសាកល្បងម្តងទៀត។");
        } finally {
            isVerifyingPin = false;
        }
    }

    async function completePinUnlock(pin) {
        const savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');
        if (savedPin && !savedPin.startsWith('pbkdf2:')) {
            safeStoreSet(appLocalStore, 'zoew_security_pin_hash', await hashPin(pin));
        }
        safeStoreRemove(appLocalStore, 'zoew_pin_fail_count');
        safeStoreRemove(appLocalStore, 'zoew_pin_lockout_until');
        lookupSecretKey = await deriveLookupSecretKey(pin);
        await migrateLookupSecretIfNeeded();
        closeModal('pinModal');
        (pinTargetAction || openConfigModal)(pin);
    }

    const BIOMETRIC_STORAGE_KEY = 'zoew_biometric_unlock_v1';
    const BIOMETRIC_PRF_SALT = 'zoew-biometric-pin-wrap-v1';

    let biometricUnlockInFlight = false;

    function bytesToB64(buf) {
        const bytes = new Uint8Array(buf);
        let out = '';
        for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
        return btoa(out);
    }

    function b64ToBytes(b64) {
        const raw = atob(b64);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        return bytes;
    }

    function readBiometricRecord() {
        try {
            const raw = appLocalStore.getItem(BIOMETRIC_STORAGE_KEY);
            if (!raw) return null;
            const rec = JSON.parse(raw);
            if (!rec || typeof rec.credentialId !== 'string' || !rec.credentialId) return null;
            if (rec.mode !== 'prf' && rec.mode !== 'device') return null;
            if (!rec.wrapped || typeof rec.wrapped.iv !== 'string' || typeof rec.wrapped.data !== 'string') return null;
            if (rec.mode === 'device' && typeof rec.wrapKey !== 'string') return null;
            return rec;
        } catch (e) {
            return null;
        }
    }

    function writeBiometricRecord(rec) {
        try {
            appLocalStore.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(rec));
            return true;
        } catch (e) {
            return false;
        }
    }

    function clearBiometricRecord() {
        try {
            appLocalStore.removeItem(BIOMETRIC_STORAGE_KEY);
        } catch (e) {
            return;
        }
    }

    function isBiometricEnabled() {
        return !!readBiometricRecord();
    }

    async function biometricPlatformAvailable() {
        try {
            if (!window.isSecureContext) return false;
            if (!window.PublicKeyCredential || !navigator.credentials) return false;
            if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
            return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch (e) {
            return false;
        }
    }

    async function wrapPinWithRawKey(pin, rawKey) {
        const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(pin));
        return { iv: bytesToB64(iv), data: bytesToB64(cipher) };
    }

    async function unwrapPinWithRawKey(wrapped, rawKey) {
        try {
            const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
            const plain = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: b64ToBytes(wrapped.iv) },
                key,
                b64ToBytes(wrapped.data)
            );
            return new TextDecoder().decode(plain);
        } catch (e) {
            return '';
        }
    }

    async function biometricPrfBytes(credentialId) {
        try {
            const assertion = await navigator.credentials.get({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    rpId: window.location.hostname,
                    allowCredentials: [{ type: 'public-key', id: b64ToBytes(credentialId), transports: ['internal'] }],
                    userVerification: 'required',
                    timeout: 60000,
                    extensions: { prf: { eval: { first: new TextEncoder().encode(BIOMETRIC_PRF_SALT) } } }
                }
            });
            const results = assertion && assertion.getClientExtensionResults();
            const first = results && results.prf && results.prf.results && results.prf.results.first;
            return first ? new Uint8Array(first) : null;
        } catch (e) {
            return null;
        }
    }

    async function enrollBiometricRecord(pin) {
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                rp: { name: 'ZoeW', id: window.location.hostname },
                user: {
                    id: crypto.getRandomValues(new Uint8Array(16)),
                    name: 'zoew-device',
                    displayName: 'ZoeW'
                },
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                    residentKey: 'discouraged',
                    requireResidentKey: false
                },
                timeout: 60000,
                attestation: 'none',
                extensions: { prf: { eval: { first: new TextEncoder().encode(BIOMETRIC_PRF_SALT) } } }
            }
        });
        if (!credential) return null;
        const credentialId = bytesToB64(credential.rawId);
        let ext = {};
        try {
            ext = credential.getClientExtensionResults() || {};
        } catch (e) {
            ext = {};
        }
        if (ext.prf && ext.prf.enabled) {
            const rawKey = await biometricPrfBytes(credentialId);
            if (rawKey) return { mode: 'prf', credentialId, wrapped: await wrapPinWithRawKey(pin, rawKey) };
        }
        const deviceKey = crypto.getRandomValues(new Uint8Array(32));
        return {
            mode: 'device',
            credentialId,
            wrapKey: bytesToB64(deviceKey),
            wrapped: await wrapPinWithRawKey(pin, deviceKey)
        };
    }

    async function biometricUnlockPin() {
        noteAppLockExcuse();
        const rec = readBiometricRecord();
        if (!rec) return '';
        if (rec.mode === 'prf') {
            const rawKey = await biometricPrfBytes(rec.credentialId);
            if (!rawKey) return '';
            return await unwrapPinWithRawKey(rec.wrapped, rawKey);
        }
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                rpId: window.location.hostname,
                allowCredentials: [{ type: 'public-key', id: b64ToBytes(rec.credentialId), transports: ['internal'] }],
                userVerification: 'required',
                timeout: 60000
            }
        });
        if (!assertion) return '';
        return await unwrapPinWithRawKey(rec.wrapped, b64ToBytes(rec.wrapKey));
    }

    function setBiometricLabel(btn, busy) {
        if (!btn) return;
        const label = typeof btn.querySelector === 'function' ? btn.querySelector('.bio-label') : null;
        if (label) label.textContent = busy ? 'កំពុងស្កេន...' : 'ស្កេនក្រយៅដៃ ឬមុខ';
        else btn.textContent = busy ? 'កំពុងស្កេន...' : '🫆 ស្កេនក្រយៅដៃ ឬមុខ';
    }

    function setBiometricBusy(busy) {
        const btn = document.getElementById('pinBiometricBtn');
        if (!btn) return;
        btn.disabled = !!busy;
        setBiometricLabel(btn, busy);
    }

    function refreshBiometricUi() {
        const enabled = isBiometricEnabled();
        const state = document.getElementById('biometricToggleState');
        if (state) state.textContent = enabled ? 'បើក' : 'បិទ';
        const toggle = document.getElementById('biometricToggleBtn');
        if (toggle) toggle.classList.toggle('is-on', enabled);
        const pinBtn = document.getElementById('pinBiometricBtn');
        if (pinBtn) pinBtn.style.display = enabled ? '' : 'none';
    }

    async function runBiometricUnlock() {
        if (biometricUnlockInFlight || isVerifyingPin) return false;
        if (!isBiometricEnabled()) return false;
        const lockoutUntil = parseInt(safeStoreGet(appLocalStore, 'zoew_pin_lockout_until') || '0');
        if (lockoutUntil && Date.now() < lockoutUntil) {
            const secondsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
            showToast(`បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ${secondsLeft} វិនាទី។`);
            return false;
        }
        biometricUnlockInFlight = true;
        setBiometricBusy(true);
        try {
            const pin = await biometricUnlockPin();
            if (!pin) return false;
            const savedPin = appLocalStore.getItem('zoew_security_pin_hash');
            if (!savedPin || !(await verifyStoredPin(pin, savedPin))) {
                clearBiometricRecord();
                refreshBiometricUi();
                showToast('⚠️ ការចងក្រយៅដៃ/មុខលែងត្រូវនឹង PIN បច្ចុប្បន្នទេ! សូមបើកវាឡើងវិញក្នុងម៉ឺនុយការកំណត់។');
                return false;
            }
            await completePinUnlock(pin);
            return true;
        } catch (e) {
            return false;
        } finally {
            biometricUnlockInFlight = false;
            setBiometricBusy(false);
        }
    }

    async function startBiometricEnrollment(verifiedPin) {
        noteAppLockExcuse();
        if (biometricUnlockInFlight) return;
        if (!verifiedPin) {
            alert('មិនអាចបើកបានទេ! សូមវាយលេខកូដ PIN ម្តងទៀត។');
            return;
        }
        if (!(await biometricPlatformAvailable())) {
            alert('ឧបករណ៍នេះមិនគាំទ្រការស្កេនក្រយៅដៃ ឬមុខទេ។ ត្រូវការ iPhone/iPad (Safari) ឬ Android (Chrome) ដែលបានបើក Face ID / Touch ID / ក្រយៅដៃរួច ហើយបើកគេហទំព័រតាម HTTPS។');
            return;
        }
        biometricUnlockInFlight = true;
        try {
            const rec = await enrollBiometricRecord(verifiedPin);
            if (!rec) {
                showToast('❌ មិនអាចចងក្រយៅដៃ ឬមុខបានទេ!');
                return;
            }
            if (!writeBiometricRecord(rec)) {
                showToast('❌ អង្គចងចាំឧបករណ៍ពេញ! មិនអាចរក្សាទុកបានទេ។');
                return;
            }
            refreshBiometricUi();
            showToast(rec.mode === 'prf'
                ? '✅ បើករួច! លើកក្រោយស្កេនក្រយៅដៃ ឬមុខ ជំនួសការវាយ PIN។'
                : '✅ បើករួច! លើកក្រោយស្កេនក្រយៅដៃ ឬមុខ ជំនួសការវាយ PIN។ (ឧបករណ៍នេះមិនគាំទ្រការចាក់សោដោយជីវមាត្រពេញលេញទេ — PIN ត្រូវរក្សាទុកក្នុងឧបករណ៍)');
        } catch (e) {
            showToast('❌ បានបោះបង់ ឬមិនអាចចងក្រយៅដៃ ឬមុខបានទេ!');
        } finally {
            biometricUnlockInFlight = false;
        }
    }

    function toggleBiometricUnlock() {
        if (isBiometricEnabled()) {
            if (!confirm('បិទការចូលដោយក្រយៅដៃ ឬមុខ? អ្នកនឹងត្រូវវាយលេខកូដ PIN ដូចមុនវិញ។')) return;
            clearBiometricRecord();
            refreshBiometricUi();
            showToast('បានបិទការចូលដោយក្រយៅដៃ ឬមុខ។');
            return;
        }
        requestPinBeforeConfig(startBiometricEnrollment, 'biometric');
    }

    async function initBiometricUi() {
        refreshBiometricUi();
        const supported = await biometricPlatformAvailable();
        const toggle = document.getElementById('biometricToggleBtn');
        if (toggle) toggle.classList.toggle('is-unsupported', !supported);
        const state = document.getElementById('biometricToggleState');
        if (state && !supported && !isBiometricEnabled()) state.textContent = 'មិនគាំទ្រ';
    }


    const APP_LOCK_SESSION_KEY = 'zoew_app_unlocked';
    const APP_LOCK_MAX_FAILS = 5;
    const APP_LOCK_LOCKOUT_MS = 60000;
    const APP_LOCK_EXCUSE_WINDOW_MS = 60000;
    const APP_LOCK_EXCUSE_SELECTOR = 'a[href^="tel:"], a[href^="mailto:"], a[download], a[target="_blank"], input[type="file"]';

    let appIsLocked = false;
    let appLockBusy = false;
    let appLockExcuseAt = 0;
    let appLockVeiled = false;

    function appLockPinIsSet() {
        try {
            return !!appLocalStore.getItem('zoew_security_pin_hash');
        } catch (e) {
            return false;
        }
    }

    function appLockUnlockedThisSession() {
        try {
            return appSessionStore.getItem(APP_LOCK_SESSION_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function markAppUnlockedForSession() {
        safeStoreSet(appSessionStore, APP_LOCK_SESSION_KEY, '1');
    }

    function clearAppUnlockedForSession() {
        safeStoreRemove(appSessionStore, APP_LOCK_SESSION_KEY);
    }

    function appLockShouldArm() {
        return appLockPinIsSet() && !appLockUnlockedThisSession();
    }

    function noteAppLockExcuse() {
        appLockExcuseAt = Date.now();
    }

    function appLockClickIsExcusable(target) {
        if (!target || typeof target.closest !== 'function') return false;
        if (target.closest(APP_LOCK_EXCUSE_SELECTOR)) return true;
        const label = target.closest('label[for]');
        if (!label) return false;
        const bound = document.getElementById(label.htmlFor);
        return !!bound && bound.tagName === 'INPUT' && bound.type === 'file';
    }

    function noteAppLockAway() {
        const excused = elapsedSince(appLockExcuseAt) < APP_LOCK_EXCUSE_WINDOW_MS;
        appLockExcuseAt = 0;
        if (appIsLocked || excused || !appLockPinIsSet()) return;
        appLockVeiled = true;
        showAppLockScreen(true);
    }

    function relockAppAfterAway() {
        if (!appLockVeiled) return;
        appLockVeiled = false;
        showAppLockScreen();
        if (isBiometricEnabled()) runAppLockBiometric(true);
    }

    function setupAppLockAwayGuard() {
        document.addEventListener('click', (e) => {
            if (appLockClickIsExcusable(e.target)) noteAppLockExcuse();
        }, true);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) noteAppLockAway();
            else relockAppAfterAway();
        });
    }

    function setAppLockMsg(text) {
        const host = document.getElementById('appLockMsg');
        if (host) host.textContent = text || '';
    }

    function setAppLockBusy(busy) {
        appLockBusy = !!busy;
        const submit = document.getElementById('appLockSubmitBtn');
        if (submit) submit.disabled = !!busy;
        const bio = document.getElementById('appLockBiometricBtn');
        if (bio) {
            bio.disabled = !!busy;
            setBiometricLabel(bio, busy);
        }
    }

    function refreshAppLockUi() {
        const state = document.getElementById('appLockToggleState');
        if (state) state.textContent = appLockPinIsSet() ? 'បើក' : 'ត្រូវកំណត់ PIN';
        const toggle = document.getElementById('appLockToggleBtn');
        if (toggle) toggle.classList.toggle('is-on', appLockPinIsSet());
        const bio = document.getElementById('appLockBiometricBtn');
        if (bio) bio.classList.toggle('hidden', !isBiometricEnabled());
    }

    function showAppLockScreen(keepSessionFlag) {
        appIsLocked = true;
        if (keepSessionFlag !== true) clearAppUnlockedForSession();
        document.body.classList.add('app-locked');
        const screen = document.getElementById('appLockScreen');
        if (screen) {
            screen.classList.add('is-open');
            screen.setAttribute('aria-hidden', 'false');
        }
        setAppLockMsg('');
        setAppLockBusy(false);
        refreshAppLockUi();
        const input = document.getElementById('appLockPinInput');
        if (input) input.value = '';
        const active = document.activeElement;
        if (active && active !== input && typeof active.blur === 'function') {
            try { active.blur(); } catch (e) { setAppLockMsg(''); }
        }
        if (input) {
            try { input.focus(); } catch (e) { setAppLockMsg(''); }
        }
    }

    function hideAppLockScreen() {
        appIsLocked = false;
        appLockVeiled = false;
        document.body.classList.remove('app-locked');
        const screen = document.getElementById('appLockScreen');
        if (screen) {
            screen.classList.remove('is-open');
            screen.setAttribute('aria-hidden', 'true');
        }
        const input = document.getElementById('appLockPinInput');
        if (input) input.value = '';
        setAppLockMsg('');
        setAppLockBusy(false);
    }

    function appLockLockoutSecondsLeft() {
        const until = parseInt(safeStoreGet(appLocalStore, 'zoew_pin_lockout_until') || '0');
        if (!until || Date.now() >= until) return 0;
        return Math.ceil((until - Date.now()) / 1000);
    }

    function registerAppLockFailure() {
        const fails = (parseInt(safeStoreGet(appLocalStore, 'zoew_pin_fail_count') || '0') || 0) + 1;
        if (fails >= APP_LOCK_MAX_FAILS) {
            safeStoreSet(appLocalStore, 'zoew_pin_lockout_until', String(Date.now() + APP_LOCK_LOCKOUT_MS));
            safeStoreSet(appLocalStore, 'zoew_pin_fail_count', '0');
            return 0;
        }
        safeStoreSet(appLocalStore, 'zoew_pin_fail_count', String(fails));
        return APP_LOCK_MAX_FAILS - fails;
    }

    async function completeAppUnlock(pin) {
        const savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');
        if (savedPin && !savedPin.startsWith('pbkdf2:')) {
            safeStoreSet(appLocalStore, 'zoew_security_pin_hash', await hashPin(pin));
        }
        lookupSecretKey = await deriveLookupSecretKey(pin);
        await migrateLookupSecretIfNeeded();
        safeStoreRemove(appLocalStore, 'zoew_pin_fail_count');
        safeStoreRemove(appLocalStore, 'zoew_pin_lockout_until');
        markAppUnlockedForSession();
        hideAppLockScreen();
        safeFocusScanner();
    }

    async function verifyAppLockPin() {
        if (appLockBusy) return false;
        const input = document.getElementById('appLockPinInput');
        const entered = input ? input.value.trim() : '';
        if (input) input.value = '';
        const waitLeft = appLockLockoutSecondsLeft();
        if (waitLeft > 0) {
            setAppLockMsg('បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ' + waitLeft + ' វិនាទី។');
            return false;
        }
        if (!entered) {
            setAppLockMsg('សូមវាយលេខកូដ PIN');
            return false;
        }
        setAppLockBusy(true);
        try {
            const savedPin = appLocalStore.getItem('zoew_security_pin_hash');
            if (savedPin && (await verifyStoredPin(entered, savedPin))) {
                await completeAppUnlock(entered);
                return true;
            }
            const left = registerAppLockFailure();
            setAppLockMsg(left > 0
                ? 'លេខ PIN មិនត្រឹមត្រូវទេ! សល់ ' + left + ' ដងទៀត។'
                : 'បញ្ចូល PIN ខុសច្រើនដងពេក! ត្រូវរង់ចាំ ១ នាទី។');
            return false;
        } catch (e) {
            setAppLockMsg('ផ្ទៀងផ្ទាត់ PIN មិនបានទេ! សូមប្រើ HTTPS រួចសាកល្បងម្តងទៀត។');
            return false;
        } finally {
            setAppLockBusy(false);
        }
    }

    function submitAppLockForm(event) {
        if (event) event.preventDefault();
        verifyAppLockPin();
    }

    async function runAppLockBiometric(silent) {
        if (appLockBusy || biometricUnlockInFlight) return false;
        if (!isBiometricEnabled()) return false;
        const waitLeft = appLockLockoutSecondsLeft();
        if (waitLeft > 0) {
            setAppLockMsg('បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ' + waitLeft + ' វិនាទី។');
            return false;
        }
        biometricUnlockInFlight = true;
        setAppLockBusy(true);
        try {
            const pin = await biometricUnlockPin();
            if (!pin) {
                if (silent !== true) setAppLockMsg('ស្កេនមិនបានទេ — សូមវាយលេខកូដ PIN ជំនួស។');
                return false;
            }
            const savedPin = appLocalStore.getItem('zoew_security_pin_hash');
            if (!savedPin || !(await verifyStoredPin(pin, savedPin))) {
                clearBiometricRecord();
                refreshBiometricUi();
                refreshAppLockUi();
                setAppLockMsg('ការចងក្រយៅដៃ/មុខលែងត្រូវនឹង PIN បច្ចុប្បន្នទេ! សូមវាយ PIN ជំនួស។');
                return false;
            }
            await completeAppUnlock(pin);
            return true;
        } catch (e) {
            if (silent !== true) setAppLockMsg('ស្កេនមិនបានទេ — សូមវាយលេខកូដ PIN ជំនួស។');
            return false;
        } finally {
            biometricUnlockInFlight = false;
            setAppLockBusy(false);
        }
    }

    function forgetAppLockPin() {
        if (!confirm('លុប Security PIN នៃឧបករណ៍នេះ រួចចាកចេញពីប្រព័ន្ធ?\n\n· ទិន្នន័យអាជីវកម្មមិនរងផលទេ\n· អ្នកនឹងត្រូវចូលប្រព័ន្ធដោយអ៊ីមែល និងពាក្យសម្ងាត់ម្តងទៀត\n· ការតភ្ជាប់ដែលអ៊ិនគ្រីបដោយ PIN ចាស់ ត្រូវកំណត់ថ្មី')) return;
        safeStoreRemove(appLocalStore, 'zoew_security_pin_hash');
        safeStoreRemove(appLocalStore, 'zoew_pin_fail_count');
        safeStoreRemove(appLocalStore, 'zoew_pin_lockout_until');
        clearBiometricRecord();
        clearAppUnlockedForSession();
        clearRememberedSession(false);
        hideAppLockScreen();
        refreshBiometricUi();
        refreshAppLockUi();
        const finish = () => {
            showLoginModalWithPrefill();
            reannounceOrShowToast('⚠️ បានលុប PIN និងចាកចេញពីប្រព័ន្ធ — សូមចូលប្រព័ន្ធម្ដងទៀត');
        };
        if (auth) fb.signOut(auth).then(finish, finish);
        else finish();
    }

    function drawerAppLockFlow() {
        drawerAction(function () {
            if (appLockPinIsSet()) {
                showToast('🔒 ការចាក់សោពេលបើក App កំពុងដំណើរការ។ ដើម្បីប្តូរលេខកូដ សូមប្រើ «ភ្លេច PIN?» នៅលើអេក្រង់ចាក់សោ។');
                return;
            }
            requestPinBeforeConfig(armAppLockAfterPinSetup, 'appLock');
        });
    }

    function armAppLockAfterPinSetup() {
        markAppUnlockedForSession();
        refreshAppLockUi();
        showToast('✅ បានបើកការចាក់សោ! លើកក្រោយបើក App ត្រូវវាយ PIN ឬស្កេនក្រយៅដៃ/មុខ។');
    }

    function initAppLock() {
        refreshAppLockUi();
        setupAppLockAwayGuard();
        if (!appLockShouldArm()) {
            markAppUnlockedForSession();
            return;
        }
        showAppLockScreen();
        if (isBiometricEnabled()) runAppLockBiometric(true);
    }

    initAppLock();

    function checkPinAndOpenConfig(isFirstTime = false) {
        if (isPinFlowPending()) return;
        pinTargetAction = null;
        applyPinPromptText('config');
        let savedPin = safeStoreGet(appLocalStore, 'zoew_security_pin_hash');
        if (!savedPin) {
            openModalHelper('pinSetupModal');
        } else {
            requestPinBeforeConfig(null, 'config');
        }
    }

    function openConfigModal() {
        const savedConfig = safeStoreGet(appLocalStore, 'zoew_firebase_config');
        if (savedConfig) {
            const cfgInput = document.getElementById('firebaseConfigInput');
            if(cfgInput) cfgInput.value = savedConfig;
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
        let depth = 0;
        let quote = '';
        for (let i = start; i < source.length; i++) {
            const ch = source[i];
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

    function saveFirebaseConfig() {
        const cfgInput = document.getElementById('firebaseConfigInput');
        if(!cfgInput) return;
        const raw = cfgInput.value.trim();
        const dsnInput = document.getElementById('sentryDsnInput');
        const dsnEntered = dsnInput ? dsnInput.value.trim() : '';
        if (dsnInput && window.ZoeErrors) {
            ZoeErrors.setDsn(dsnInput.value);
            const sentryInit = ZoeErrors.init('zoew');
            if (dsnEntered && sentryInit && typeof sentryInit.then === 'function') {
                const warnSentry = () => showToast("⚠️ មិនអាចភ្ជាប់ Sentry បានទេ! សូមពិនិត្យ DSN ឬការតភ្ជាប់អ៊ីនធឺណិត");
                sentryInit.then((sentryOk) => { if (!sentryOk) warnSentry(); }, warnSentry);
            }
        }
        if (!raw) {
            alert("សូមបញ្ចូល Firebase Config!");
            return;
        }
        let normalized;
        try {
            normalized = normalizeFirebaseConfig(raw);
        } catch (e) {
            alert(firebaseConfigErrorMessage(e));
            return;
        }
        cfgInput.value = JSON.stringify(normalized.config, null, 2);
        if (!safeStoreSet(appLocalStore, 'zoew_firebase_config', JSON.stringify(normalized.config))) {
            alert("រក្សាទុក Config មិនបានទេ! សូមពិនិត្យទំហំផ្ទុករបស់ browser។");
            return;
        }
        if (normalized.extras.length) {
            showToast("រំលងវាលដែលមិនមែនរបស់ Firebase៖ " + normalized.extras.join(', '));
        }
        closeModal('configModal');
        initFirebase();
        showLiveToast('config');
    }

    function decodeSetupPayload(setupParam) {
        const json = decodeURIComponent(escape(atob(setupParam)));
        const parsed = JSON.parse(json);
        if (!parsed.apiKey || !parsed.databaseURL) throw new Error('missing apiKey/databaseURL');
        return parsed;
    }

    function applySetupLinkFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const setupParam = params.get('setup');
        if (!setupParam) return;

        history.replaceState(null, '', window.location.pathname + window.location.hash);

        let parsed;
        try {
            parsed = decodeSetupPayload(setupParam);
        } catch (e) {
            showToast("❌ Setup Link មិនត្រឹមត្រូវទេ!");
            return;
        }

        requestPinBeforeConfig(() => {
            openConfigModal();
            const cfgInput = document.getElementById('firebaseConfigInput');
            if (cfgInput) cfgInput.value = JSON.stringify(parsed, null, 2);
            showToast('✅ Setup Link បានបំពេញ Config ដោយស្វ័យប្រវត្តិ! សូមពិនិត្យ ហើយចុច "រក្សាទុក និងភ្ជាប់"');
        }, 'setupLink');
    }

    function cancelPinSetupFlow() {
        cancelPendingLookupUnlock();
        pinTargetAction = null;
        closeModal('pinSetupModal');
    }

    function cancelPinEntryFlow() {
        cancelPendingLookupUnlock();
        pinTargetAction = null;
        closeModal('pinModal');
    }

    function isPinFlowPending() {
        const pinEl = document.getElementById('pinModal');
        const setupEl = document.getElementById('pinSetupModal');
        return !!((pinEl && pinEl.style.display === 'flex') || (setupEl && setupEl.style.display === 'flex'));
    }

    let configQrReader = null;
    let configQrStream = null;
    let configQrScanActive = false;

    function isInAppBrowser() {
        return /FBAN|FBAV|Instagram|Messenger|MicroMessenger|Line\//i.test(navigator.userAgent);
    }

    function describeCameraError(err) {
        const name = err && err.name;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return '🚫 កាមេរ៉ាត្រូវបានបិទសិទ្ធិ! សូមអនុញ្ញាតកាមេរ៉ាក្នុង Browser Settings រួចសាកល្បងម្តងទៀត';
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return '🚫 រកមិនឃើញកាមេរ៉ានៅលើឧបករណ៍នេះទេ';
        if (name === 'NotReadableError' || name === 'TrackStartError') return '🚫 កាមេរ៉ាកំពុងប្រើដោយកម្មវិធីផ្សេង — សូមបិទកម្មវិធីនោះសិន';
        if (name === 'OverconstrainedError') return '🚫 កាមេរ៉ារបស់ឧបករណ៍នេះមិនគាំទ្រការកំណត់ដែលត្រូវការទេ';
        if (name === 'SecurityError') return '🚫 ត្រូវបើកតាម HTTPS ទើបប្រើកាមេរ៉ាបាន';
        return '❌ មិនអាចបើក Camera បានទេ! សូមអនុញ្ញាត Camera Permission';
    }

    function closeConfigQrScanner() {
        configQrScanActive = false;
        if (configQrStream) {
            try { configQrStream.getTracks().forEach((t) => t.stop()); } catch (e) {}
            configQrStream = null;
        }
        const video = document.getElementById('configQrVideo');
        if (video) { try { video.pause(); } catch (e) {} video.srcObject = null; }
        configQrReader = null;
        closeModal('configQrScanModal');
    }

    async function openConfigQrScanner() {
        if (configQrScanActive) return;
        if (isCameraScanning || isCameraStarting) {
            showToast("សូមបិទកាមេរ៉ាស្កេនបាកូដសិន មុននឹងស្កេន QR Setup Link");
            return;
        }
        if (!scanEngineReady()) {
            showToast("❌ Camera Scanner មិនទាន់ផ្ទុករួចទេ! សូមរង់ចាំបន្តិចទៀត");
            return;
        }
        if (isInAppBrowser()) {
            showToast('⚠️ សូមបើកតាម Browser ធម្មតា (Chrome/Safari) ដើម្បីប្រើកាមេរ៉ា — ក្នុង App ដូចជា Facebook/Messenger កាមេរ៉ាអាចប្រើមិនបាន');
        }
        openModalHelper('configQrScanModal');
        configQrScanActive = true;
        try {
            configQrReader = buildReaderOptions(false, CONFIG_QR_FORMAT_NAMES);
            configQrStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }, audio: false
            });
            const video = document.getElementById('configQrVideo');
            if (!video) throw new Error('configQrVideo missing');
            video.srcObject = configQrStream;
            video.setAttribute('playsinline', 'true');
            await video.play();
            runConfigQrLoop(video);
        } catch (e) {
            console.error('Config QR scanner error:', e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'openConfigQrScanner' });
            showToast(describeCameraError(e));
            closeConfigQrScanner();
        }
    }

    function runConfigQrLoop(videoElement) {
        let busy = false;
        let canvas = null;
        let ctx = null;
        const loop = () => {
            if (!configQrScanActive) return;
            if (!busy && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0) {
                if (!canvas) {
                    canvas = document.createElement('canvas');
                    ctx = canvas.getContext('2d', { willReadFrequently: true });
                }
                const width = Math.min(CONFIG_QR_SCAN_WIDTH, videoElement.videoWidth);
                const height = Math.round(videoElement.videoHeight * (width / videoElement.videoWidth));
                if (canvas.width !== width) canvas.width = width;
                if (canvas.height !== height) canvas.height = height;
                ctx.drawImage(videoElement, 0, 0, width, height);
                busy = true;
                decodeBarcodeFromCanvasManual(configQrReader, canvas).then((text) => {
                    busy = false;
                    if (text && configQrScanActive) handleConfigQrResult(text);
                }, () => { busy = false; });
            }
            if (configQrScanActive) scheduleScanFrame(videoElement, loop);
        };
        scheduleScanFrame(videoElement, loop);
    }

    function handleConfigQrResult(text) {
        if (!configQrScanActive) return;
        let setupParam = null;
        try {
            setupParam = new URL(text).searchParams.get('setup');
        } catch (e) {
            setupParam = null;
        }
        if (!setupParam) {
            showToast("❌ QR នេះមិនមែនជា Setup Link ត្រឹមត្រូវទេ!");
            return;
        }

        let parsed;
        try {
            parsed = decodeSetupPayload(setupParam);
        } catch (e) {
            showToast("❌ QR Setup Link មិនត្រឹមត្រូវទេ!");
            return;
        }

        closeConfigQrScanner();
        const cfgInput = document.getElementById('firebaseConfigInput');
        if (cfgInput) cfgInput.value = JSON.stringify(parsed, null, 2);
        showToast('✅ បានស្កេន QR ជោគជ័យ! សូមពិនិត្យ ហើយចុច "រក្សាទុក និងភ្ជាប់"');
    }

    function getLookupApiConfig() {
        try {
            const raw = appLocalStore.getItem('zoew_lookup_api_config');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    async function migrateLookupSecretIfNeeded() {
        const cfg = getLookupApiConfig();
        if (!cfg || !cfg.headerValue || cfg.headerValueEnc || !lookupSecretKey) return false;
        const encrypted = await encryptLookupSecret(cfg.headerValue);
        if (!encrypted) return false;
        const migrated = Object.assign({}, cfg, { headerValueEnc: encrypted });
        delete migrated.headerValue;
        return safeStoreSet(appLocalStore, 'zoew_lookup_api_config', JSON.stringify(migrated));
    }

    function openLookupApiConfigModal() {
        const cfg = getLookupApiConfig() || {};
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

        const enabledCb = document.getElementById('lookupApiEnabledCheckbox');
        if (enabledCb) enabledCb.checked = !!cfg.enabled;

        const autoSubmitCb = document.getElementById('lookupApiAutoSubmitCheckbox');
        if (autoSubmitCb) autoSubmitCb.checked = !!cfg.autoSubmit;

        const fastModeCb = document.getElementById('lookupApiFastModeCheckbox');
        if (fastModeCb) fastModeCb.checked = !!cfg.fastMode;

        setVal('lookupApiUrlInput', cfg.url);
        setVal('lookupApiHeaderNameInput', cfg.headerName);
        const headerValueIn = document.getElementById('lookupApiHeaderValueInput');
        if (headerValueIn) {
            headerValueIn.value = '';
            headerValueIn.placeholder = (cfg.headerValueEnc || cfg.headerValue) ? '•••••••• (មានរួច — ទុកទទេប្រសិនបើមិនចង់ប្តូរ)' : 'ឧ. Bearer xxxxx ឬ Secret Key';
        }
        setVal('lookupApiPhoneFieldInput', cfg.phoneField || 'phone');
        setVal('lookupApiCodFieldInput', cfg.codField || 'cod');
        setVal('lookupApiDodFieldInput', cfg.dodField || 'dod');

        openModalHelper('lookupApiConfigModal');
    }

    async function saveLookupApiConfig() {
        const enabledCb = document.getElementById('lookupApiEnabledCheckbox');
        const autoSubmitCb = document.getElementById('lookupApiAutoSubmitCheckbox');
        const fastModeCb = document.getElementById('lookupApiFastModeCheckbox');
        const urlIn = document.getElementById('lookupApiUrlInput');
        const headerNameIn = document.getElementById('lookupApiHeaderNameInput');
        const headerValueIn = document.getElementById('lookupApiHeaderValueInput');
        const phoneFieldIn = document.getElementById('lookupApiPhoneFieldInput');
        const codFieldIn = document.getElementById('lookupApiCodFieldInput');
        const dodFieldIn = document.getElementById('lookupApiDodFieldInput');

        let url = urlIn ? urlIn.value.trim() : '';
        let enabled = enabledCb ? enabledCb.checked : false;

        if (enabled && (!url || !url.includes('{barcode}'))) {
            alert("URL ត្រូវតែមាន {barcode} ជាកន្លែងដាក់លេខបាកូដ! (ឧ. https://example.com/api?code={barcode})");
            return;
        }

        const existingCfg = getLookupApiConfig() || {};
        const headerValueRaw = headerValueIn ? headerValueIn.value.trim() : '';
        let headerValueEnc = existingCfg.headerValueEnc || null;
        let legacyHeaderValue = existingCfg.headerValue || '';

        if (headerValueRaw) {
            if (!lookupSecretKey) {
                alert("សម័យ PIN បានផុតកំណត់! សូមបិទ Config នេះ ហើយបើកម្តងទៀតដើម្បីបញ្ចូល PIN សាជាថ្មី មុននឹងផ្លាស់ប្តូរ Secret។");
                return;
            }
            const encryptedHeaderValue = await encryptLookupSecret(headerValueRaw);
            if (!encryptedHeaderValue) {
                alert("មិនអាចអ៊ិនគ្រីប Secret បានទេ! សូមសាកល្បងម្តងទៀត។ ការផ្លាស់ប្តូរមិនទាន់ត្រូវបានរក្សាទុកទេ។");
                return;
            }
            headerValueEnc = encryptedHeaderValue;
            legacyHeaderValue = '';
        } else if (!headerValueEnc && legacyHeaderValue && lookupSecretKey) {
            const migratedHeaderValue = await encryptLookupSecret(legacyHeaderValue);
            if (migratedHeaderValue) {
                headerValueEnc = migratedHeaderValue;
                legacyHeaderValue = '';
            }
        }

        const cfg = {
            enabled: enabled,
            autoSubmit: autoSubmitCb ? autoSubmitCb.checked : false,
            fastMode: fastModeCb ? fastModeCb.checked : false,
            url: url,
            headerName: headerNameIn ? headerNameIn.value.trim() : '',
            headerValueEnc: headerValueEnc,
            phoneField: (phoneFieldIn && phoneFieldIn.value.trim()) || 'phone',
            codField: (codFieldIn && codFieldIn.value.trim()) || 'cod',
            dodField: (dodFieldIn && dodFieldIn.value.trim()) || 'dod'
        };
        if (legacyHeaderValue) cfg.headerValue = legacyHeaderValue;

        if (!safeStoreSet(appLocalStore, 'zoew_lookup_api_config', JSON.stringify(cfg))) {
            alert("មិនអាចរក្សាទុក Config បានទេ! ទំហំផ្ទុករបស់ browser ពេញ ឬត្រូវបានបិទ (ឧ. Private Mode)។");
            return;
        }
        clearCustomerDataTableCache();
        if (headerValueIn) headerValueIn.value = '';
        closeModal('lookupApiConfigModal');
        prefetchCustomerDataTableRowsIfConfigured();
        showToast(enabled ? "បានបើក API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ!" : "បានរក្សាទុក Config (មិនទាន់បើកដំណើរការ)!");
    }

    async function testLookupApiConfig(btnEl) {
        const urlIn = document.getElementById('lookupApiUrlInput');
        const headerNameIn = document.getElementById('lookupApiHeaderNameInput');
        const headerValueIn = document.getElementById('lookupApiHeaderValueInput');

        let url = urlIn ? urlIn.value.trim() : '';
        if (!url || !url.includes('{barcode}')) {
            alert("សូមបញ្ចូល URL ដែលមាន {barcode} ជាមុនសិន!");
            return;
        }

        let testBarcode = prompt("បញ្ចូលលេខ Barcode សាកល្បង (សម្រាប់សាកល្បង API មុននឹងរក្សាទុក):", "");
        if (!testBarcode || !testBarcode.trim()) return;

        const testUrl = url.replace('{barcode}', encodeURIComponent(testBarcode.trim()));
        const headers = {};
        const hName = headerNameIn ? headerNameIn.value.trim() : '';
        const existingCfg = getLookupApiConfig() || {};
        const typedValue = headerValueIn ? headerValueIn.value.trim() : '';
        const hValue = typedValue || (existingCfg.headerValueEnc ? await decryptLookupSecret(existingCfg.headerValueEnc) : (existingCfg.headerValue || ''));
        if (hName && hValue) headers[hName] = hValue;

        const testIsZto = lookupApiIsZto({ url: url });
        const testTimeoutMs = testIsZto ? ZTO_TEST_TIMEOUT_MS : LOOKUP_TEST_TIMEOUT_MS;
        showToast(testIsZto ? "កំពុងសាកល្បង ZTO..." : "កំពុងសាកល្បង API...");
        if (btnEl) btnEl.disabled = true;
        const progressTimers = testIsZto ? [
            setTimeout(() => showToast("⏳ នៅរង់ចាំ ZTO ឆ្លើយតប...", 'warn'), 6000)
        ] : [];
        try {
            const out = await fetchWithTimeout(testUrl, { headers }, testTimeoutMs, 'Test API timed out', (r) => r.text());
            alert("ស្ថានភាព HTTP៖ " + out.res.status + "\n\nលទ្ធផល JSON (ប្រើដើម្បីដឹងឈ្មោះ Field)៖\n" + String(out.body).substring(0, 1500));
        } catch (e) {
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'testLookupApiConfig' });
            const timedOut = e && e.message === 'Test API timed out';
            const slowNote = testIsZto
                ? "អស់ពេល (Timeout) — ZTO ឆ្លើយតបយឺត ឬ Cookie ផុតកំណត់។ សូមសាកល្បងម្តងទៀត; បើនៅតែយឺត សូមយក Cookie ថ្មីពី Argus"
                : "អស់ពេល (Timeout) — Google Apps Script ដំបូងអាចយឺត (cold start), សូមសាកល្បងម្តងទៀត ឬពិនិត្យ URL/ការតភ្ជាប់អ៊ីនធឺណិត";
            alert("❌ បរាជ័យក្នុងការភ្ជាប់៖ " + (timedOut ? slowNote : e.message));
        } finally {
            progressTimers.forEach((timer) => clearTimeout(timer));
            if (btnEl) btnEl.disabled = false;
        }
    }


    const SHEET_IMPORT_STORE_KEY = 'zoew_sheet_import_config';
    const SHEET_IMPORT_SECRET_SALT = 'zoew_sheet_import_secret_v1';
    const SHEET_IMPORT_TIMEOUT_MS = 30000;
    const SHEET_IMPORT_MAX_ROWS = 20000;
    const SHEET_IMPORT_PREVIEW_ROWS = 8;
    const SHEET_IMPORT_HEADER_SCAN_ROWS = 12;
    const SHEET_IMPORT_FIELD_SELECT_IDS = { barcode: 'siMapBarcode', dod: 'siMapDod', cod: 'siMapCod', phone: 'siMapPhone' };
    const SHEET_IMPORT_MSG_CLASSES = { ok: 'si-msg si-msg-ok', warn: 'si-msg si-msg-warn', bad: 'si-msg si-msg-bad' };
    const SHEET_IMPORT_CHIP_CLASSES = { ok: 'si-chip si-chip-ok', warn: 'si-chip si-chip-warn', bad: 'si-chip si-chip-bad' };

    let sheetImportKey = null;
    let sheetImportUrl = '';
    let sheetImportPassword = '';
    let sheetImportWorkbook = null;
    let sheetImportSheetRows = [];
    let sheetImportHeaders = [];
    let sheetImportSignature = '';
    let sheetImportBusy = false;

    async function deriveSheetImportKey(pin) {
        try {
            const enc = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
            return await crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt: enc.encode(SHEET_IMPORT_SECRET_SALT), iterations: 150000, hash: 'SHA-256' },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
        } catch (e) {
            return null;
        }
    }

    async function encryptSheetImportSecret(plainText) {
        if (!sheetImportKey || !plainText) return null;
        try {
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sheetImportKey, new TextEncoder().encode(plainText));
            return { iv: Array.from(iv), data: Array.from(new Uint8Array(cipherBuf)) };
        } catch (e) {
            return null;
        }
    }

    async function decryptSheetImportSecret(encObj) {
        if (!sheetImportKey || !encObj || !Array.isArray(encObj.iv) || !Array.isArray(encObj.data)) return '';
        try {
            const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(encObj.iv) }, sheetImportKey, new Uint8Array(encObj.data));
            return new TextDecoder().decode(plainBuf);
        } catch (e) {
            return '';
        }
    }

    function readSheetImportStoredConfig() {
        try {
            const raw = appLocalStore.getItem(SHEET_IMPORT_STORE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && parsed.u && parsed.p ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    function maskSheetImportUrl(url) {
        try {
            const parsed = new URL(url);
            const parts = parsed.pathname.split('/').filter(Boolean);
            const id = parts.length >= 3 ? parts[2] : '';
            const shortId = id.length > 10 ? id.slice(0, 6) + '…' + id.slice(-4) : id;
            return parsed.host + '/…/' + shortId + '/exec';
        } catch (e) {
            return 'URL មិនត្រឹមត្រូវ';
        }
    }

    function setSheetImportMsg(hostId, text, kind) {
        const host = document.getElementById(hostId);
        if (!host) return;
        host.textContent = '';
        if (!text) return;
        const box = document.createElement('div');
        box.className = SHEET_IMPORT_MSG_CLASSES[kind] || SHEET_IMPORT_MSG_CLASSES.warn;
        box.textContent = text;
        host.appendChild(box);
    }

    function showSheetImportPart(id, on) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !on);
    }

    function sheetImportIsBinaryWorkbook(bytes) {
        if (!bytes || bytes.length < 8) return false;
        if (bytes[0] === 0x50 && bytes[1] === 0x4b) return true;
        if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return true;
        return false;
    }

    function sheetImportReadOptions(bytes) {
        const options = { type: 'array' };
        if (!sheetImportIsBinaryWorkbook(bytes)) options.raw = true;
        return options;
    }

    function sheetImportCellToText(value) {
        if (value === null || value === undefined) return '';
        if (value instanceof Date) return '';
        if (typeof value === 'number') return isFinite(value) ? String(value) : '';
        return String(value).trim();
    }

    function sheetImportToMoney(value) {
        if (value === null || value === undefined || value === '') return 0;
        const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
        if (!isFinite(n)) return 0;
        return Math.round(n * 100) / 100;
    }

    function sheetImportColumnLetter(index) {
        let letter = '';
        let n = index;
        while (n >= 0) {
            letter = String.fromCharCode(65 + (n % 26)) + letter;
            n = Math.floor(n / 26) - 1;
        }
        return letter;
    }

    function clearSheetImportSession() {
        sheetImportKey = null;
        sheetImportUrl = '';
        sheetImportPassword = '';
        sheetImportWorkbook = null;
        sheetImportSheetRows = [];
        sheetImportHeaders = [];
        sheetImportSignature = '';
        sheetImportBusy = false;
        ['siApiUrlInput', 'siApiPasswordInput', 'siFileInput'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        ['siConfigSummary', 'siChips', 'siPreviewBody', 'siSheetSel', 'siStatusFoot'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = '';
        });
        Object.keys(SHEET_IMPORT_FIELD_SELECT_IDS).forEach((field) => {
            const sel = document.getElementById(SHEET_IMPORT_FIELD_SELECT_IDS[field]);
            if (sel) sel.textContent = '';
        });
        ['siConfigMsg', 'siFileMsg', 'siMapMsg', 'siActionMsg', 'siClearMsg'].forEach((id) => setSheetImportMsg(id, ''));
        ['siConfigSummary', 'siConfigEditRow', 'siFileCard', 'siMapCard', 'siActionCard', 'siClearCard', 'siPreviewWrap'].forEach((id) => showSheetImportPart(id, false));
        showSheetImportPart('siConfigForm', true);
    }

    function closeSheetImportModal() {
        clearSheetImportSession();
        closeModal('sheetImportModal');
    }

    function drawerSheetImportFlow() {
        drawerAction(function () { requestPinBeforeConfig(openSheetImportModal, 'sheetImport'); });
    }

    async function openSheetImportModal(pin) {
        clearSheetImportSession();
        openModalHelper('sheetImportModal');
        sheetImportKey = await deriveSheetImportKey(pin);
        if (!sheetImportKey) {
            setSheetImportMsg('siConfigMsg', 'បង្កើតកូនសោអ៊ិនគ្រីបមិនបានទេ! សូមប្រើ HTTPS រួចសាកល្បងម្តងទៀត។', 'bad');
            return;
        }
        const stored = readSheetImportStoredConfig();
        if (!stored) return;
        const url = await decryptSheetImportSecret(stored.u);
        const password = await decryptSheetImportSecret(stored.p);
        if (!url || !password) {
            setSheetImportMsg('siConfigMsg', 'ស្រាយការតភ្ជាប់មិនបានទេ — ប្រហែល Security PIN ត្រូវបានប្តូរ។ សូមកំណត់ការតភ្ជាប់ម្តងទៀត។', 'bad');
            return;
        }
        sheetImportUrl = url;
        sheetImportPassword = password;
        showSheetImportConfigSummary();
        await refreshSheetImportStatus();
    }

    function showSheetImportConfigSummary() {
        showSheetImportPart('siConfigForm', false);
        showSheetImportPart('siConfigSummary', true);
        showSheetImportPart('siConfigEditRow', true);
        showSheetImportPart('siFileCard', true);
        showSheetImportPart('siClearCard', true);
        const summary = document.getElementById('siConfigSummary');
        if (!summary) return;
        summary.textContent = '';
        const line = document.createElement('div');
        line.className = 'si-summary-line';
        line.textContent = '🔗 ' + maskSheetImportUrl(sheetImportUrl);
        const note = document.createElement('div');
        note.className = 'si-summary-note';
        note.textContent = 'URL និងពាក្យសម្ងាត់ត្រូវអ៊ិនគ្រីបដោយកូនសោដែលបង្កើតពី Security PIN';
        summary.appendChild(line);
        summary.appendChild(note);
    }

    function editSheetImportConfig() {
        setSheetImportMsg('siConfigMsg', '');
        showSheetImportPart('siConfigForm', true);
        showSheetImportPart('siConfigSummary', false);
        showSheetImportPart('siConfigEditRow', false);
        showSheetImportPart('siFileCard', false);
        showSheetImportPart('siClearCard', false);
        showSheetImportPart('siMapCard', false);
        showSheetImportPart('siActionCard', false);
    }

    async function callSheetImportApi(action, extra, url, password) {
        const target = url || sheetImportUrl;
        const secret = password === undefined ? sheetImportPassword : password;
        if (!target) throw new Error('មិនទាន់កំណត់ URL ទេ');
        if (navigator.onLine === false) throw new Error('ឧបករណ៍ក្រៅបណ្ដាញ — សូមភ្ជាប់អ៊ីនធឺណិតជាមុនសិន');
        const payload = Object.assign({ action: action, password: secret }, extra || {});
        const out = await fetchWithTimeout(target, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        }, SHEET_IMPORT_TIMEOUT_MS, 'សំណើអស់ពេល — សូមពិនិត្យបណ្តាញ', (r) => r.text());
        if (!out.res.ok) throw new Error('ម៉ាស៊ីនបម្រើឆ្លើយ ' + out.res.status);
        let parsed;
        try {
            parsed = JSON.parse(out.body);
        } catch (e) {
            throw new Error('ចម្លើយមិនមែនជា JSON — សូមពិនិត្យថា Deploy ជា Web app ហើយ «Who has access» ជា Anyone');
        }
        if (!parsed.ok) throw new Error(parsed.error || 'សំណើបរាជ័យ');
        return parsed.data;
    }

    function setSheetImportFoot(text) {
        const foot = document.getElementById('siStatusFoot');
        if (foot) foot.textContent = text;
    }

    function sheetImportStatusText(spreadsheetName, sheetName, rowCount) {
        const head = spreadsheetName ? 'គោលដៅ៖ ' + spreadsheetName + ' ➜ tab «' + sheetName + '»' : 'គោលដៅ៖ tab «' + sheetName + '»';
        return head + ' · មាន ' + rowCount + ' ជួរដេក';
    }

    async function refreshSheetImportStatus() {
        try {
            const status = await callSheetImportApi('status', {});
            setSheetImportFoot(sheetImportStatusText(status.spreadsheetName, status.sheetName, status.rowCount));
            return status;
        } catch (e) {
            setSheetImportMsg('siConfigMsg', e.message, 'bad');
            return null;
        }
    }

    async function saveSheetImportConfig() {
        if (sheetImportBusy) return;
        const urlIn = document.getElementById('siApiUrlInput');
        const passIn = document.getElementById('siApiPasswordInput');
        const url = urlIn ? urlIn.value.trim() : '';
        const password = passIn ? passIn.value.trim() : '';
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(url)) {
            setSheetImportMsg('siConfigMsg', 'URL ត្រូវជា Web app URL របស់ Apps Script ដែលបញ្ចប់ដោយ /exec', 'bad');
            return;
        }
        if (!password) {
            setSheetImportMsg('siConfigMsg', 'សូមបញ្ចូលពាក្យសម្ងាត់នាំចូល', 'bad');
            return;
        }
        if (!sheetImportKey) {
            setSheetImportMsg('siConfigMsg', 'សម័យ PIN បានផុតកំណត់! សូមបិទប្រអប់នេះ ហើយបើកម្តងទៀតដើម្បីវាយ PIN សាជាថ្មី។', 'bad');
            return;
        }
        sheetImportBusy = true;
        const saveBtn = document.getElementById('siConfigSaveBtn');
        if (saveBtn) saveBtn.disabled = true;
        setSheetImportMsg('siConfigMsg', 'កំពុងសាកល្បងការតភ្ជាប់...', 'warn');
        try {
            const status = await callSheetImportApi('status', {}, url, password);
            const stored = { v: 1, u: await encryptSheetImportSecret(url), p: await encryptSheetImportSecret(password) };
            if (!stored.u || !stored.p || !safeStoreSet(appLocalStore, SHEET_IMPORT_STORE_KEY, JSON.stringify(stored))) {
                setSheetImportMsg('siConfigMsg', 'រក្សាទុកមិនបានទេ — សូមពិនិត្យទំហំផ្ទុករបស់ browser', 'bad');
                return;
            }
            sheetImportUrl = url;
            sheetImportPassword = password;
            if (urlIn) urlIn.value = '';
            if (passIn) passIn.value = '';
            setSheetImportMsg('siConfigMsg', '');
            showSheetImportConfigSummary();
            setSheetImportFoot(sheetImportStatusText(status.spreadsheetName, status.sheetName, status.rowCount));
            showToast('✅ ការតភ្ជាប់ត្រឹមត្រូវ!');
        } catch (e) {
            setSheetImportMsg('siConfigMsg', e.message, 'bad');
        } finally {
            if (saveBtn) saveBtn.disabled = false;
            sheetImportBusy = false;
        }
    }

    function pickSheetImportFile() {
        const input = document.getElementById('siFileInput');
        if (input) input.click();
    }

    function handleSheetImportFileInput(inputEl) {
        const file = inputEl && inputEl.files ? inputEl.files[0] : null;
        handleSheetImportFile(file);
    }

    function readSheetImportFileBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => resolve(evt.target.result);
            reader.onerror = () => reject(new Error('អានឯកសារមិនបានទេ'));
            reader.readAsArrayBuffer(file);
        });
    }

    function sheetImportLibFailureMessage(e) {
        if (e && e.code === 'SCRIPT_LOAD_TIMEOUT') {
            return 'ផ្ទុកឯកសារអាន Excel យូរពេក (បណ្តាញឆ្លើយមិនចេញ) — សូមសាកម្តងទៀត';
        }
        if (e && e.code === 'SCRIPT_LOAD_FAILED') {
            return navigator.onLine === false
                ? 'ឧបករណ៍ក្រៅបណ្ដាញ ហើយឯកសារអាន Excel មិនទាន់ចូល cache ទេ'
                : 'ផ្ទុកឯកសារអាន Excel មិនបានទេ — សូម Refresh ទំព័រម្តង';
        }
        return e && e.message ? e.message : String(e);
    }

    async function handleSheetImportFile(file) {
        if (!file) return;
        setSheetImportMsg('siFileMsg', 'កំពុងអានឯកសារ...', 'warn');
        let buffer;
        try {
            await loadScriptOnce('xlsx');
            buffer = await readSheetImportFileBuffer(file);
        } catch (e) {
            setSheetImportMsg('siFileMsg', 'អានឯកសារមិនបានទេ៖ ' + sheetImportLibFailureMessage(e), 'bad');
            return;
        }
        try {
            const sheetImportBytes = new Uint8Array(buffer);
            sheetImportWorkbook = XLSX.read(sheetImportBytes, sheetImportReadOptions(sheetImportBytes));
            const names = sheetImportWorkbook.SheetNames || [];
            if (!names.length) throw new Error('ឯកសារនេះគ្មាន tab ទេ');
            const sel = document.getElementById('siSheetSel');
            if (sel) {
                sel.textContent = '';
                names.forEach((name) => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name;
                    sel.appendChild(opt);
                });
            }
            setSheetImportMsg('siFileMsg', 'អាន «' + file.name + '» រួចរាល់', 'ok');
            showSheetImportPart('siMapCard', true);
            showSheetImportPart('siActionCard', true);
            await loadSheetImportSelectedSheet();
        } catch (e) {
            setSheetImportMsg('siFileMsg', 'អានឯកសារមិនបានទេ៖ ' + (e && e.message ? e.message : e), 'bad');
        }
    }

    async function loadSheetImportSelectedSheet() {
        if (!sheetImportWorkbook) return;
        const sel = document.getElementById('siSheetSel');
        const ws = sheetImportWorkbook.Sheets[sel ? sel.value : ''];
        if (!ws) return;
        sheetImportSheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: false });
        let headerIndex = 0;
        for (let i = 0; i < Math.min(sheetImportSheetRows.length, SHEET_IMPORT_HEADER_SCAN_ROWS); i++) {
            const filled = (sheetImportSheetRows[i] || []).filter((v) => sheetImportCellToText(v) !== '');
            if (filled.length >= 2) {
                headerIndex = i;
                break;
            }
        }
        const headerIn = document.getElementById('siHeaderRowInput');
        if (headerIn) headerIn.value = String(headerIndex + 1);
        await applySheetImportHeaderRow();
    }

    function sheetImportHeaderRowNumber() {
        const headerIn = document.getElementById('siHeaderRowInput');
        const parsed = parseInt(headerIn ? headerIn.value : '1', 10);
        return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }

    async function applySheetImportHeaderRow() {
        const index = sheetImportHeaderRowNumber() - 1;
        sheetImportHeaders = (sheetImportSheetRows[index] || []).map(sheetImportCellToText);
        if (!sheetImportHeaders.length) {
            setSheetImportMsg('siMapMsg', 'ជួរដេកនេះទទេ — សូមប្តូរលេខជួរដេក header', 'bad');
            return;
        }
        fillSheetImportMappingSelects();
        setSheetImportMsg('siMapMsg', 'កំពុងរកការផ្គូផ្គង...', 'warn');
        try {
            const prepared = await callSheetImportApi('prepare', { headers: sheetImportHeaders });
            sheetImportSignature = prepared.signature;
            applySheetImportMapping(prepared.mapping);
            if (prepared.source === 'saved') {
                const modeSel = document.getElementById('siModeSel');
                if (prepared.mode && modeSel) modeSel.value = prepared.mode;
                setSheetImportMsg('siMapMsg', '✅ ប្រើការផ្គូផ្គងដែលរក្សាទុកពីលើកមុន', 'ok');
            } else if (prepared.source === 'auto') {
                setSheetImportMsg('siMapMsg', '✅ រកឃើញ Column ដោយស្វ័យប្រវត្តិ', 'ok');
            } else {
                setSheetImportMsg('siMapMsg', 'រកមិនឃើញ Column ដោយស្វ័យប្រវត្តិទេ — សូមជ្រើសដោយដៃ', 'warn');
            }
        } catch (e) {
            setSheetImportMsg('siMapMsg', e.message, 'bad');
        }
        renderSheetImportPreview();
    }

    function fillSheetImportMappingSelects() {
        Object.keys(SHEET_IMPORT_FIELD_SELECT_IDS).forEach((field) => {
            const sel = document.getElementById(SHEET_IMPORT_FIELD_SELECT_IDS[field]);
            if (!sel) return;
            const previous = sel.value;
            sel.textContent = '';
            const none = document.createElement('option');
            none.value = '-1';
            none.textContent = '— មិនប្រើ —';
            sel.appendChild(none);
            sheetImportHeaders.forEach((header, idx) => {
                const opt = document.createElement('option');
                opt.value = String(idx);
                opt.textContent = sheetImportColumnLetter(idx) + ' · ' + (header || '(ទទេ)');
                sel.appendChild(opt);
            });
            if (previous) sel.value = previous;
        });
    }

    function applySheetImportMapping(mapping) {
        Object.keys(SHEET_IMPORT_FIELD_SELECT_IDS).forEach((field) => {
            const sel = document.getElementById(SHEET_IMPORT_FIELD_SELECT_IDS[field]);
            if (!sel) return;
            const value = mapping && typeof mapping[field] === 'number' ? mapping[field] : -1;
            sel.value = String(value);
        });
    }

    function currentSheetImportMapping() {
        const mapping = {};
        Object.keys(SHEET_IMPORT_FIELD_SELECT_IDS).forEach((field) => {
            const sel = document.getElementById(SHEET_IMPORT_FIELD_SELECT_IDS[field]);
            const parsed = parseInt(sel ? sel.value : '-1', 10);
            mapping[field] = isNaN(parsed) ? -1 : parsed;
        });
        return mapping;
    }

    function sheetImportMappedRows() {
        const mapping = currentSheetImportMapping();
        const start = sheetImportHeaderRowNumber();
        const out = [];
        for (let i = start; i < sheetImportSheetRows.length; i++) {
            const row = sheetImportSheetRows[i] || [];
            out.push([
                mapping.barcode >= 0 ? sheetImportCellToText(row[mapping.barcode]) : '',
                mapping.dod >= 0 ? sheetImportToMoney(row[mapping.dod]) : 0,
                mapping.cod >= 0 ? sheetImportToMoney(row[mapping.cod]) : 0,
                mapping.phone >= 0 ? sheetImportCellToText(row[mapping.phone]) : ''
            ]);
        }
        return out;
    }

    function addSheetImportChip(host, text, kind) {
        const chip = document.createElement('span');
        chip.className = SHEET_IMPORT_CHIP_CLASSES[kind] || 'si-chip';
        chip.textContent = text;
        host.appendChild(chip);
    }

    function renderSheetImportPreview() {
        const chips = document.getElementById('siChips');
        const body = document.getElementById('siPreviewBody');
        const importBtn = document.getElementById('siImportBtn');
        if (!chips || !body) return;
        const rows = sheetImportMappedRows();
        const usable = rows.filter((r) => r[0] !== '');
        const seen = Object.create(null);
        let duplicates = 0;
        usable.forEach((r) => {
            const key = r[0].toUpperCase();
            if (seen[key]) duplicates++;
            seen[key] = true;
        });
        chips.textContent = '';
        addSheetImportChip(chips, 'ជួរដេកក្នុងឯកសារ ' + rows.length, '');
        addSheetImportChip(chips, 'មាន Barcode ' + usable.length, usable.length ? 'ok' : 'bad');
        if (rows.length - usable.length > 0) addSheetImportChip(chips, 'រំលង ' + (rows.length - usable.length), 'warn');
        if (duplicates) addSheetImportChip(chips, 'ស្ទួនក្នុងឯកសារ ' + duplicates, 'warn');
        body.textContent = '';
        usable.slice(0, SHEET_IMPORT_PREVIEW_ROWS).forEach((r) => {
            const tr = document.createElement('tr');
            [r[0], r[1].toFixed(2), r[2].toFixed(2), r[3]].forEach((value, idx) => {
                const td = document.createElement('td');
                if (idx === 1 || idx === 2) td.className = 'si-num';
                td.textContent = value;
                tr.appendChild(td);
            });
            body.appendChild(tr);
        });
        showSheetImportPart('siPreviewWrap', usable.length > 0);
        if (importBtn) importBtn.disabled = usable.length === 0;
    }

    async function runSheetImport() {
        if (sheetImportBusy) return;
        const rows = sheetImportMappedRows().filter((r) => r[0] !== '');
        if (!rows.length) {
            setSheetImportMsg('siActionMsg', 'គ្មានជួរដេកត្រូវនាំចូលទេ', 'bad');
            return;
        }
        if (rows.length > SHEET_IMPORT_MAX_ROWS) {
            setSheetImportMsg('siActionMsg', 'ឯកសារនេះមាន ' + rows.length + ' ជួរដេក ច្រើនជាងកម្រិត ' + SHEET_IMPORT_MAX_ROWS, 'bad');
            return;
        }
        const modeSel = document.getElementById('siModeSel');
        const mode = modeSel ? modeSel.value : 'replace';
        if (mode === 'replace' && !confirm('ជួរដេកទាំងអស់ក្នុង Sheet នឹងត្រូវលុប រួចជំនួសដោយ ' + rows.length + ' ជួរដេកពីឯកសារនេះ។ តើបន្តទេ?')) return;
        sheetImportBusy = true;
        const importBtn = document.getElementById('siImportBtn');
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.textContent = 'កំពុងនាំចូល...';
        }
        setSheetImportMsg('siActionMsg', '');
        try {
            const result = await callSheetImportApi('import', {
                payload: { rows: rows, mode: mode, mapping: currentSheetImportMapping(), signature: sheetImportSignature }
            });
            const parts = ['✅ រួចរាល់ — បន្ថែម ' + result.added, 'កែ ' + result.updated, 'ដដែល ' + result.unchanged];
            if (result.skippedNoBarcode) parts.push('រំលង ' + result.skippedNoBarcode);
            if (result.duplicatesInFile) parts.push('ស្ទួនក្នុងឯកសារ ' + result.duplicatesInFile);
            parts.push('សរុបក្នុង Sheet ' + result.rowsAfter + ' ជួរដេក');
            setSheetImportMsg('siActionMsg', parts.join(' · '), 'ok');
            setSheetImportFoot(sheetImportStatusText('', result.sheetName, result.rowsAfter));
            if (!seedCustomerTableFromImport(rows, mode, result.rowsAfter)) clearCustomerDataTableCache();
            scheduleCustomerTableSoonRefresh(true);
            showToast('✅ នាំចូលរួចរាល់ — ' + result.rowsAfter + ' ជួរដេកក្នុង Sheet');
        } catch (e) {
            setSheetImportMsg('siActionMsg', e.message, 'bad');
            showToast('❌ នាំចូលមិនបានទេ! ' + e.message);
        } finally {
            if (importBtn) {
                importBtn.disabled = false;
                importBtn.textContent = 'នាំចូលទៅ Sheet';
            }
            sheetImportBusy = false;
        }
    }

    async function runSheetImportClear() {
        if (sheetImportBusy) return;
        if (!confirm('ជួរដេកទាំងអស់ក្នុង tab គោលដៅនឹងត្រូវលុប ដោយទុកតែជួរ header។ សកម្មភាពនេះមិនអាចដកវិញបានទេ។ តើបន្តទេ?')) return;
        sheetImportBusy = true;
        const clearBtn = document.getElementById('siClearBtn');
        if (clearBtn) {
            clearBtn.disabled = true;
            clearBtn.textContent = 'កំពុងសម្អាត...';
        }
        setSheetImportMsg('siClearMsg', '');
        try {
            const result = await callSheetImportApi('clear', { confirm: 'CLEAR' });
            setSheetImportMsg('siClearMsg', '✅ សម្អាតរួចរាល់ — លុប ' + result.removed + ' ជួរដេក', 'ok');
            setSheetImportFoot(sheetImportStatusText('', result.sheetName, result.rowsAfter));
            clearCustomerDataTableCache();
            scheduleCustomerTableSoonRefresh(true);
            showToast('✅ សម្អាតរួចរាល់ — លុប ' + result.removed + ' ជួរដេក');
        } catch (e) {
            setSheetImportMsg('siClearMsg', e.message, 'bad');
            showToast('❌ សម្អាតមិនបានទេ! ' + e.message);
        } finally {
            if (clearBtn) {
                clearBtn.disabled = false;
                clearBtn.textContent = 'សម្អាតទិន្នន័យក្នុង Sheet';
            }
            sheetImportBusy = false;
        }
    }

    function resetSheetImportFileSelection() {
        sheetImportWorkbook = null;
        sheetImportSheetRows = [];
        sheetImportHeaders = [];
        sheetImportSignature = '';
        const fileIn = document.getElementById('siFileInput');
        if (fileIn) fileIn.value = '';
        const chips = document.getElementById('siChips');
        if (chips) chips.textContent = '';
        showSheetImportPart('siMapCard', false);
        showSheetImportPart('siActionCard', false);
        showSheetImportPart('siPreviewWrap', false);
        ['siFileMsg', 'siMapMsg', 'siActionMsg'].forEach((id) => setSheetImportMsg(id, ''));
    }

    function setupSheetImportDropZone() {
        const drop = document.getElementById('siDrop');
        if (!drop) return;
        ['dragenter', 'dragover'].forEach((name) => {
            drop.addEventListener(name, (evt) => {
                evt.preventDefault();
                drop.classList.add('si-drop-hot');
            });
        });
        ['dragleave', 'drop'].forEach((name) => {
            drop.addEventListener(name, (evt) => {
                evt.preventDefault();
                drop.classList.remove('si-drop-hot');
            });
        });
        drop.addEventListener('drop', (evt) => {
            if (evt.dataTransfer && evt.dataTransfer.files && evt.dataTransfer.files.length) {
                handleSheetImportFile(evt.dataTransfer.files[0]);
            }
        });
    }

    let customerDataTableRows = null;
    let customerDataTableFetchedAt = 0;
    let customerDataTableFetchPromise = null;
    let customerDataTableSessionGeneration = 0;
    let customerDataTableLastFailedAt = 0;
    const CUSTOMER_TABLE_CACHE_MS = 5 * 60 * 1000;
    const CUSTOMER_TABLE_FAIL_COOLDOWN_MS = 60 * 1000;
    const CUSTOMER_TABLE_RETRY_STEPS_MS = [65 * 1000, 2 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];
    const CUSTOMER_TABLE_RETRY_BUSY_MS = 20 * 1000;
    const CUSTOMER_TABLE_SOON_MS = 1200;
    const CUSTOMER_TABLE_SOON_BUSY_MS = 3000;
    const CUSTOMER_TABLE_SOON_MAX_WAIT_MS = 90 * 1000;
    const ZTO_WARMUP_COOLDOWN_MS = 4 * 60 * 1000;
    let customerTableRetryTimer = null;
    let customerTableFailStreak = 0;
    let customerTableSoonTimer = null;
    let customerTableSoonArmedAt = 0;
    let customerTableIsPartial = false;
    let ztoWarmupAt = 0;
    let ztoWarmupInFlight = false;

    function customerTablePrefetchAllowed() {
        if (!auth || !auth.currentUser) return false;
        if (navigator.onLine === false) return false;
        if (linkIsFrugal()) return false;
        if (isModalOpen) return false;
        if (autoLookupInFlight.size > 0) return false;
        return true;
    }

    function clearCustomerTableRetry() {
        if (customerTableRetryTimer) {
            clearTimeout(customerTableRetryTimer);
            customerTableRetryTimer = null;
        }
        customerTableFailStreak = 0;
    }

    function scheduleCustomerTableRetry() {
        if (customerTableRetryTimer) return;
        const idx = Math.min(customerTableFailStreak, CUSTOMER_TABLE_RETRY_STEPS_MS.length - 1);
        customerTableFailStreak++;
        customerTableRetryTimer = setTimeout(runCustomerTableRetry, CUSTOMER_TABLE_RETRY_STEPS_MS[idx]);
    }

    function runCustomerTableRetry() {
        customerTableRetryTimer = null;
        if (!customerTablePrefetchAllowed()) {
            customerTableRetryTimer = setTimeout(runCustomerTableRetry, CUSTOMER_TABLE_RETRY_BUSY_MS);
            return;
        }
        const cfg = getLookupApiConfig();
        if (!lookupApiSupportsList(cfg)) {
            clearCustomerTableRetry();
            return;
        }
        fetchCustomerDataTableRows(true);
    }

    function customerTableNeedsRefresh() {
        if (!Array.isArray(customerDataTableRows)) return true;
        if (customerTableIsPartial) return true;
        return elapsedSince(customerDataTableFetchedAt) >= CUSTOMER_TABLE_CACHE_MS;
    }

    function clearCustomerTableSoonRefresh() {
        if (customerTableSoonTimer) {
            clearTimeout(customerTableSoonTimer);
            customerTableSoonTimer = null;
        }
        customerTableSoonArmedAt = 0;
    }

    function scheduleCustomerTableSoonRefresh(force) {
        const cfg = getLookupApiConfig();
        if (!lookupApiSupportsList(cfg)) {
            clearCustomerTableSoonRefresh();
            return;
        }
        if (customerTableSoonTimer) return;
        if (!force && !customerTableNeedsRefresh()) return;
        customerTableSoonArmedAt = Date.now();
        customerTableSoonTimer = setTimeout(runCustomerTableSoonRefresh, CUSTOMER_TABLE_SOON_MS);
    }

    function runCustomerTableSoonRefresh() {
        customerTableSoonTimer = null;
        if (elapsedSince(customerTableSoonArmedAt) >= CUSTOMER_TABLE_SOON_MAX_WAIT_MS) {
            customerTableSoonArmedAt = 0;
            return;
        }
        if (!customerTablePrefetchAllowed()) {
            customerTableSoonTimer = setTimeout(runCustomerTableSoonRefresh, CUSTOMER_TABLE_SOON_BUSY_MS);
            return;
        }
        customerTableSoonArmedAt = 0;
        if (elapsedSince(customerDataTableLastFailedAt) < CUSTOMER_TABLE_FAIL_COOLDOWN_MS) return;
        const cfg = getLookupApiConfig();
        if (lookupApiSupportsList(cfg)) fetchCustomerDataTableRows(true, true);
    }

    function safeLookupReason(raw) {
        const text = String(raw === null || raw === undefined ? '' : raw).trim();
        return /^[A-Za-z0-9_.:@-]{1,80}$/.test(text) ? text : '';
    }

    function lookupApiIsZto(cfg) {
        if (!cfg || !cfg.url) return false;
        return /(?:^|\/)\.netlify\/functions\/zto-order-detail\/?(?:[?#]|$)/i.test(String(cfg.url).trim());
    }

    function warmZtoLookupProxyIfConfigured(cfg) {
        if (!cfg || !cfg.enabled || !lookupApiIsZto(cfg) || ztoWarmupInFlight || elapsedSince(ztoWarmupAt) < ZTO_WARMUP_COOLDOWN_MS) return false;
        const raw = String(cfg.url).trim();
        const marker = '/.netlify/functions/zto-order-detail';
        const markerAt = raw.toLowerCase().indexOf(marker);
        const target = markerAt === -1 ? marker : raw.slice(0, markerAt) + marker;
        ztoWarmupAt = Date.now();
        ztoWarmupInFlight = true;
        fetchWithTimeout(target, { method: 'OPTIONS', cache: 'no-store', credentials: 'same-origin' }, 3000, 'ZTO warmup timed out')
            .catch(() => {})
            .finally(() => { ztoWarmupInFlight = false; });
        return true;
    }

    function warmZtoLookupProxyNow() {
        try {
            const cfg = getLookupApiConfig();
            if (!cfg || !cfg.enabled || !customerTablePrefetchAllowed()) return false;
            return warmZtoLookupProxyIfConfigured(cfg);
        } catch (e) {
            return false;
        }
    }

    function lookupApiSupportsList(cfg) {
        return !!(cfg && cfg.url && !lookupApiIsZto(cfg));
    }

    function buildCustomerListApiUrl(cfg, wantFresh) {
        if (!lookupApiSupportsList(cfg)) return null;
        let url = cfg.url.trim();
        if (/[?&][^=&]*=\{barcode\}/.test(url)) {
            url = url.replace(/([?&])[^=&]*=\{barcode\}/, '$1list=1');
        } else if (/[?&]code=/.test(url)) {
            url = url.replace(/([?&])code=[^&]*/, '$1list=1');
        } else {
            url = url.replace('{barcode}', '');
            url += (url.indexOf('?') !== -1 ? '&' : '?') + 'list=1';
        }
        if (wantFresh) url += (url.indexOf('?') !== -1 ? '&' : '?') + 'fresh=1';
        return url;
    }

    function openCustomerDataTableModal() {
        const cfg = getLookupApiConfig();
        if (!cfg || !cfg.url) {
            alert("សូមកំណត់ Config API ស្វែងរកអតិថិជនជាមុនសិន (⋯ ➜ 🔌 API ស្វែងរកអតិថិជន) មុននឹងបើកតារាងនេះ។");
            return;
        }
        if (!lookupApiSupportsList(cfg)) {
            alert("ZTO Lookup មិនមានតារាងទិន្នន័យទាំងមូលទេ។ សូមស្កេន Barcode ដើម្បីស្វែងរកផ្ទាល់ពី ZTO។");
            return;
        }
        const searchInput = document.getElementById('customerDataTableSearchInput');
        if (searchInput) searchInput.value = '';
        openModalHelper('customerDataTableModal');
        fetchCustomerDataTableRows(false);
    }

    async function fetchCustomerDataTableRows(force, wantFresh) {
        const cfg = getLookupApiConfig();
        const statusEl = document.getElementById('customerDataTableStatus');
        if (!lookupApiSupportsList(cfg)) return;

        const isFresh = customerDataTableRows && (elapsedSince(customerDataTableFetchedAt) < CUSTOMER_TABLE_CACHE_MS);
        if (!force && isFresh) {
            renderCustomerDataTableStatus(customerDataTableRows);
            filterCustomerDataTable();
            return;
        }

        if (customerDataTableFetchPromise) {
            if (statusEl) statusEl.textContent = "កំពុងទាញយកទិន្នន័យ...";
            return customerDataTableFetchPromise;
        }

        if (!force && elapsedSince(customerDataTableLastFailedAt) < CUSTOMER_TABLE_FAIL_COOLDOWN_MS) {
            return;
        }

        const listUrl = buildCustomerListApiUrl(cfg, wantFresh);
        if (!listUrl) return;

        if (statusEl) statusEl.textContent = "កំពុងទាញយកទិន្នន័យ...";

        const myGeneration = customerDataTableSessionGeneration;
        customerDataTableFetchPromise = (async () => {
            try {
                const headers = {};
                if (cfg.headerName && cfg.headerValueEnc) {
                    const decrypted = await decryptLookupSecret(cfg.headerValueEnc);
                    if (decrypted) headers[cfg.headerName] = decrypted;
                } else if (cfg.headerName && cfg.headerValue) {
                    headers[cfg.headerName] = cfg.headerValue;
                }
                const out = await retryAsync(
                    () => fetchWithTimeout(listUrl, { headers }, 20000, 'Customer table fetch timed out',
                        (r) => (r.ok ? r.json() : null)).then(retryTransientLookupResponse),
                    2, 2000
                );
                if (!out.res.ok) throw new Error('HTTP ' + out.res.status);
                const data = out.body;
                if (data && data.error) throw new Error(data.error);
                if (myGeneration !== customerDataTableSessionGeneration) return;
                const rows = Array.isArray(data && data.rows) ? data.rows : [];
                customerDataTableRows = rows;
                customerDataTableFetchedAt = Date.now();
                customerDataTableLastFailedAt = 0;
                customerTableIsPartial = false;
                clearCustomerTableRetry();
                clearCustomerTableSoonRefresh();
                renderCustomerDataTableStatus(rows);
                filterCustomerDataTable();
            } catch (e) {
                if (myGeneration !== customerDataTableSessionGeneration) return;
                customerDataTableLastFailedAt = Date.now();
                scheduleCustomerTableRetry();
                if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'fetchCustomerDataTableRows' });
                const curStatusEl = document.getElementById('customerDataTableStatus');
                if (curStatusEl) curStatusEl.textContent = "❌ ទាញយកទិន្នន័យបរាជ័យ៖ " + (e && e.message === 'Customer table fetch timed out' ? "អស់ពេល (Timeout)" : (e && e.message ? e.message : ''));
                if (customerDataTableRows) filterCustomerDataTable();
            } finally {
                if (myGeneration === customerDataTableSessionGeneration) customerDataTableFetchPromise = null;
            }
        })();

        return customerDataTableFetchPromise;
    }

    function renderCustomerDataTableStatus(rows) {
        const statusEl = document.getElementById('customerDataTableStatus');
        if (!statusEl) return;
        const ts = customerDataTableFetchedAt ? getFormattedClockTime(customerDataTableFetchedAt) : '';
        statusEl.textContent = rows.length + ' ជួរដេក' + (ts ? (' — ទាញយកចុងក្រោយ ' + ts) : '');
    }

    function filterCustomerDataTable() {
        const body = document.getElementById('customerDataTableBody');
        if (!body) return;
        const rows = customerDataTableRows || [];
        const searchInput = document.getElementById('customerDataTableSearchInput');
        const q = (searchInput ? searchInput.value.trim().toLowerCase() : '');

        const filtered = q ? rows.filter((r) =>
            String(r.barcode || '').toLowerCase().indexOf(q) !== -1 ||
            String(r.phone || '').toLowerCase().indexOf(q) !== -1 ||
            String(r.cod || '').indexOf(q) !== -1 ||
            String(r.dod || '').indexOf(q) !== -1
        ) : rows;

        if (filtered.length === 0) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:16px;">' + (rows.length === 0 ? 'មិនទាន់មានទិន្នន័យ' : 'រកមិនឃើញ') + '</td></tr>';
            return;
        }

        const maxRender = 500;
        const toRender = filtered.slice(0, maxRender);
        let html = toRender.map((r) =>
            '<tr><td>' + sanitizeInput(r.barcode) + '</td><td>' + Number(r.dod || 0).toFixed(2) +
            '</td><td>' + Number(r.cod || 0).toFixed(2) + '</td><td>' + sanitizeInput(r.phone) + '</td></tr>'
        ).join('');
        if (filtered.length > maxRender) {
            html += '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:8px;">... និងមាន ' + (filtered.length - maxRender) + ' ជួរដេកទៀត (សូមស្វែងរកឲ្យតូចជាងនេះ)</td></tr>';
        }
        body.innerHTML = html;
    }

    function clearCustomerDataTableCache() {
        clearCustomerTableRetry();
        clearCustomerTableSoonRefresh();
        customerTableIsPartial = false;
        customerDataTableSessionGeneration++;
        customerDataTableRows = null;
        customerDataTableFetchedAt = 0;
        customerDataTableFetchPromise = null;
        customerDataTableLastFailedAt = 0;
        autoLookupFailureAt.clear();
        autoLookupInFlight.clear();
        clearAutoLookupQueueRetries();
        lookupFastCache.clear();
        const body = document.getElementById('customerDataTableBody');
        if (body) body.innerHTML = '';
        const statusEl = document.getElementById('customerDataTableStatus');
        if (statusEl) statusEl.textContent = '';
    }

    function findCustomerDataTableRow(barcode) {
        if (!customerDataTableRows || !barcode) return null;
        const target = String(barcode).trim().toUpperCase();
        for (let i = 0; i < customerDataTableRows.length; i++) {
            const r = customerDataTableRows[i];
            if (String(r.barcode || '').trim().toUpperCase() === target) return r;
        }
        return null;
    }

    function normalizeImportedCustomerRows(rows) {
        const out = [];
        const seen = Object.create(null);
        const list = Array.isArray(rows) ? rows : [];
        for (let i = 0; i < list.length; i++) {
            const row = list[i] || [];
            const barcode = sheetImportCellToText(row[0]);
            if (!barcode) continue;
            const record = {
                barcode: barcode,
                dod: sheetImportToMoney(row[1]),
                cod: sheetImportToMoney(row[2]),
                phone: sheetImportCellToText(row[3])
            };
            const key = barcode.toUpperCase();
            if (seen[key] !== undefined) out[seen[key]] = record;
            else {
                seen[key] = out.length;
                out.push(record);
            }
        }
        return out;
    }

    function seedCustomerTableFromImport(rows, mode, rowsAfter) {
        const records = normalizeImportedCustomerRows(rows);
        if (!records.length) return false;
        const base = (mode === 'replace' || !Array.isArray(customerDataTableRows)) ? [] : customerDataTableRows;
        const merged = [];
        const index = Object.create(null);
        for (let i = 0; i < base.length; i++) {
            const row = base[i];
            const key = String((row && row.barcode) || '').trim().toUpperCase();
            if (!key || index[key] !== undefined) continue;
            index[key] = merged.length;
            merged.push({ barcode: row.barcode, dod: Number(row.dod) || 0, cod: Number(row.cod) || 0, phone: row.phone || '' });
        }
        for (let j = 0; j < records.length; j++) {
            const record = records[j];
            const key = record.barcode.toUpperCase();
            if (index[key] !== undefined) {
                if (mode !== 'newOnly') merged[index[key]] = record;
            } else {
                index[key] = merged.length;
                merged.push(record);
            }
        }
        customerDataTableSessionGeneration++;
        customerDataTableFetchPromise = null;
        customerDataTableRows = merged;
        customerDataTableFetchedAt = Date.now();
        customerDataTableLastFailedAt = 0;
        autoLookupFailureAt.clear();
        customerTableIsPartial = merged.length !== Number(rowsAfter);
        clearCustomerTableRetry();
        renderCustomerDataTableStatus(merged);
        filterCustomerDataTable();
        return true;
    }

    function rememberCustomerTableRow(barcode, phone, cod, dod) {
        if (!Array.isArray(customerDataTableRows)) return;
        const key = String(barcode || '').trim().toUpperCase();
        if (!key) return;
        const hasPhone = phone !== null && phone !== undefined && String(phone) !== '';
        const hasCod = cod !== null && cod !== undefined && !isNaN(parseFloat(cod));
        const hasDod = dod !== null && dod !== undefined && !isNaN(parseFloat(dod));
        if (!hasPhone && !hasCod && !hasDod) return;
        const row = {
            barcode: String(barcode),
            dod: hasDod ? parseFloat(dod) : 0,
            cod: hasCod ? parseFloat(cod) : 0,
            phone: hasPhone ? String(phone) : ''
        };
        for (let i = 0; i < customerDataTableRows.length; i++) {
            const current = customerDataTableRows[i];
            if (String((current && current.barcode) || '').trim().toUpperCase() === key) {
                customerDataTableRows[i] = row;
                return;
            }
        }
        customerDataTableRows.push(row);
    }

    function prefetchCustomerDataTableRowsIfConfigured() {
        const cfg = getLookupApiConfig();
        if (!cfg || !cfg.enabled || !cfg.url) {
            clearCustomerTableRetry();
            clearCustomerTableSoonRefresh();
            return;
        }
        preconnectToLookupHost();
        if (!lookupApiSupportsList(cfg)) {
            clearCustomerTableRetry();
            clearCustomerTableSoonRefresh();
            if (customerTablePrefetchAllowed()) warmZtoLookupProxyIfConfigured(cfg);
            return;
        }
        if (!customerTablePrefetchAllowed()) {
            scheduleCustomerTableSoonRefresh();
            return;
        }
        fetchCustomerDataTableRows(false);
    }

    function getNestedField(obj, path) {
        if (!obj || !path) return null;
        return path.split('.').reduce((acc, key) => (acc !== null && acc !== undefined && acc[key] !== undefined) ? acc[key] : null, obj);
    }

    let lookupLockedNoticeShown = false;
    let pendingLookupUnlockBarcode = '';
    let pendingLookupUnlockResolve = null;
    const AUTO_LOOKUP_FAIL_COOLDOWN_MS = 30 * 1000;
    const AUTO_LOOKUP_TRANSIENT_COOLDOWN_MS = 6 * 1000;
    const AUTO_LOOKUP_FAILURE_MAX = 100;
    const LOOKUP_FOCUS_GRACE_MS = 250;
    const LOOKUP_MANUAL_FALLBACK_MS = 1800;
    const AUTO_LOOKUP_MAX_IN_FLIGHT = 2;
    const AUTO_LOOKUP_QUEUE_RETRY_MS = 400;
    const AUTO_LOOKUP_QUEUE_MAX_WAIT_MS = 20000;
    const AUTO_LOOKUP_TIMEOUT_MS = 16000;
    const ZTO_AUTO_LOOKUP_TIMEOUT_MS = 13000;
    const LOOKUP_TEST_TIMEOUT_MS = 20000;
    const ZTO_TEST_TIMEOUT_MS = 11000;
    const LOOKUP_FAST_CACHE_TTL_MS = 10 * 60 * 1000;
    const LOOKUP_FAST_CACHE_MAX = 300;
    const autoLookupInFlight = new Map();
    const autoLookupFailureAt = new Map();
    const autoLookupQueueRetries = new Map();
    const lookupFastCache = new Map();

    function clearAutoLookupQueueRetries() {
        autoLookupQueueRetries.forEach((queued) => {
            if (queued && queued.timer) clearTimeout(queued.timer);
        });
        autoLookupQueueRetries.clear();
    }

    function dropAutoLookupQueueEntry(key) {
        const queued = autoLookupQueueRetries.get(key);
        if (!queued) return;
        if (queued.timer) clearTimeout(queued.timer);
        autoLookupQueueRetries.delete(key);
    }

    function scheduleAutoLookupQueueRetry(barcode) {
        const key = String(barcode || '').trim().toUpperCase();
        if (!key) return false;
        const existing = autoLookupQueueRetries.get(key);
        const waiting = !!(existing && (existing.timer || existing.pending));
        const armedAt = (waiting && existing.armedAt) || Date.now();
        if (waiting && elapsedSince(armedAt) >= AUTO_LOOKUP_QUEUE_MAX_WAIT_MS) {
            dropAutoLookupQueueEntry(key);
            return false;
        }
        if (existing && existing.timer) return true;
        const timer = setTimeout(() => {
            const queued = autoLookupQueueRetries.get(key);
            if (queued) { queued.timer = null; queued.pending = true; }
            if (pendingBarcode !== barcode || !isModalOpen) {
                dropAutoLookupQueueEntry(key);
                return;
            }
            if (elapsedSince(armedAt) >= AUTO_LOOKUP_QUEUE_MAX_WAIT_MS) {
                dropAutoLookupQueueEntry(key);
                setLookupStatus(barcode, 'warn', '⏳ Lookup រវល់យូរពេក — សូមស្កេនម្ដងទៀត');
                return;
            }
            attemptAutoLookup(barcode);
        }, AUTO_LOOKUP_QUEUE_RETRY_MS);
        autoLookupQueueRetries.set(key, { timer, armedAt });
        return true;
    }

    function pumpAutoLookupQueue() {
        if (!autoLookupQueueRetries.size) return;
        if (autoLookupInFlight.size >= AUTO_LOOKUP_MAX_IN_FLIGHT) return;
        if (!isModalOpen || !pendingBarcode) return;
        const key = String(pendingBarcode).trim().toUpperCase();
        if (!autoLookupQueueRetries.has(key)) return;
        const barcode = pendingBarcode;
        dropAutoLookupQueueEntry(key);
        attemptAutoLookup(barcode);
    }

    function clearLookupStatus() {
        const el = document.getElementById('lookupStatus');
        if (!el) return;
        el.className = 'lookup-status';
        el.textContent = '';
        el.hidden = true;
    }

    function setLookupStatus(barcode, kind, text) {
        const el = document.getElementById('lookupStatus');
        if (!el || (barcode && (pendingBarcode !== barcode || !isModalOpen))) return false;
        const classes = {
            loading: 'lookup-status-loading',
            success: 'lookup-status-success',
            warn: 'lookup-status-warn',
            error: 'lookup-status-error',
            offline: 'lookup-status-offline',
            cache: 'lookup-status-cache'
        };
        el.className = 'lookup-status ' + (classes[kind] || classes.warn);
        el.textContent = String(text || '');
        el.hidden = !text;
        return true;
    }

    function getFastLookupRow(barcode, cfg) {
        if (!cfg.fastMode) return null;
        const key = String(barcode || '').trim().toUpperCase();
        const entry = lookupFastCache.get(key);
        if (!entry) return null;
        if (elapsedSince(entry.storedAt) >= LOOKUP_FAST_CACHE_TTL_MS) {
            lookupFastCache.delete(key);
            return null;
        }
        lookupFastCache.delete(key);
        lookupFastCache.set(key, entry);
        return entry.row;
    }

    function setFastLookupRow(barcode, phone, cod, dod, cfg) {
        if (!cfg.fastMode) return;
        const key = String(barcode || '').trim().toUpperCase();
        if (!key) return;
        lookupFastCache.delete(key);
        lookupFastCache.set(key, {
            storedAt: Date.now(),
            row: { phone: phone, cod: cod, dod: dod }
        });
        while (lookupFastCache.size > LOOKUP_FAST_CACHE_MAX) {
            lookupFastCache.delete(lookupFastCache.keys().next().value);
        }
    }

    function applyLookupFillToModal(barcode, phoneVal, codVal, dodVal, cfg) {
        if (pendingBarcode !== barcode || !isModalOpen) return false;

        let filledAny = false;
        let phoneWasAutoFilled = false;

        const phoneEl = document.getElementById('modalPhoneInput');
        if (phoneVal && phoneEl && !phoneEl.value) {
            phoneEl.value = normalizeStoredPhone(phoneVal);
            filledAny = true;
            phoneWasAutoFilled = true;
        }

        const codEl = document.getElementById('modalCodInput');
        if (codVal !== null && codVal !== undefined && !isNaN(parseFloat(codVal)) && codEl && !codEl.value) {
            codEl.value = parseFloat(codVal);
            filledAny = true;
        }

        const dodEl = document.getElementById('modalDodInput');
        if (dodVal !== null && dodVal !== undefined && !isNaN(parseFloat(dodVal)) && dodEl && !dodEl.value) {
            dodEl.value = parseFloat(dodVal);
            filledAny = true;
        }

        if (cfg.autoSubmit && phoneWasAutoFilled && pendingBarcode === barcode && isModalOpen) {
            showToast("✅ បានរកឃើញអតិថិជន — កំពុងរក្សាទុកស្វ័យប្រវត្តិ...");
            confirmPhone(false);
        } else if (filledAny) {
            showToast("✅ បានទាញយកទិន្នន័យអតិថិជនស្វ័យប្រវត្តិ!");
        }
        return filledAny;
    }

    function retryPendingLookupAfterUnlock() {
        const barcode = pendingLookupUnlockBarcode;
        const resolve = pendingLookupUnlockResolve;
        pendingLookupUnlockBarcode = '';
        pendingLookupUnlockResolve = null;
        lookupLockedNoticeShown = false;
        if (!barcode || pendingBarcode !== barcode) {
            if (resolve) resolve();
            return;
        }
        Promise.resolve(attemptAutoLookup(barcode)).then(resolve, resolve);
    }

    function cancelPendingLookupUnlock() {
        const resolve = pendingLookupUnlockResolve;
        pendingLookupUnlockBarcode = '';
        pendingLookupUnlockResolve = null;
        lookupLockedNoticeShown = false;
        if (resolve) resolve();
    }

    function armLookupFocus(phoneInput, barcode, lookupPromise) {
        let focused = false;
        let fallbackTimer = null;
        let waitingForPin = false;
        const focusIfEmpty = () => {
            if (focused || isPinFlowPending()) return;
            if (!isModalOpen || pendingBarcode !== barcode) return;
            if (!phoneInput || phoneInput.value) return;
            focused = true;
            phoneInput.focus();
        };
        const runFallback = () => {
            fallbackTimer = null;
            if (focused) return;
            if (isPinFlowPending()) {
                waitingForPin = true;
                fallbackTimer = setTimeout(runFallback, LOOKUP_FOCUS_GRACE_MS);
                return;
            }
            if (waitingForPin) {
                waitingForPin = false;
                fallbackTimer = setTimeout(runFallback, LOOKUP_MANUAL_FALLBACK_MS);
                return;
            }
            focusIfEmpty();
        };
        fallbackTimer = setTimeout(runFallback, isPinFlowPending() ? LOOKUP_FOCUS_GRACE_MS : LOOKUP_MANUAL_FALLBACK_MS);
        return Promise.resolve(lookupPromise).finally(() => {
            if (fallbackTimer !== null) clearTimeout(fallbackTimer);
            setTimeout(focusIfEmpty, LOOKUP_FOCUS_GRACE_MS);
        });
    }

    async function attemptAutoLookup(barcode) {
        const lookupKey = String(barcode || '').trim().toUpperCase();
        const cfg = getLookupApiConfig();
        if (!cfg || !cfg.enabled || !cfg.url) { dropAutoLookupQueueEntry(lookupKey); return; }
        const isZtoLookup = lookupApiIsZto(cfg);
        const lookupSource = isZtoLookup ? 'ZTO' : 'API';

        const fastCachedRow = getFastLookupRow(barcode, cfg);
        if (fastCachedRow) {
            dropAutoLookupQueueEntry(lookupKey);
            setLookupStatus(barcode, 'cache', '⚡ រកឃើញភ្លាមពី cache ក្នុងឧបករណ៍');
            applyLookupFillToModal(barcode, fastCachedRow.phone, fastCachedRow.cod, fastCachedRow.dod, cfg);
            return;
        }

        const cachedRow = findCustomerDataTableRow(barcode);
        if (cachedRow) {
            dropAutoLookupQueueEntry(lookupKey);
            setLookupStatus(barcode, 'cache', '⚡ រកឃើញភ្លាមពីតារាងអតិថិជន');
            applyLookupFillToModal(barcode, cachedRow.phone, cachedRow.cod, cachedRow.dod, cfg);
            return;
        }

        scheduleCustomerTableSoonRefresh();

        if (cfg.headerName && cfg.headerValueEnc && !lookupSecretKey) {
            dropAutoLookupQueueEntry(lookupKey);
            setLookupStatus(barcode, 'warn', '🔒 សូមវាយ PIN ដើម្បីដោះសោ ' + lookupSource + ' Lookup');
            if (pendingLookupUnlockResolve) pendingLookupUnlockResolve();
            pendingLookupUnlockBarcode = String(barcode || '');
            return new Promise((resolve) => {
                pendingLookupUnlockResolve = resolve;
                if (!lookupLockedNoticeShown) {
                    lookupLockedNoticeShown = true;
                    showToast("🔒 សូមវាយ PIN ម្តង ដើម្បីដោះសោការស្វែងរកអតិថិជន");
                }
                if (!isPinFlowPending()) requestPinBeforeConfig(retryPendingLookupAfterUnlock, 'lookupApi');
            });
        }

        if (navigator.onLine === false) {
            dropAutoLookupQueueEntry(lookupKey);
            setLookupStatus(barcode, 'offline', '📴 ក្រៅបណ្ដាញ — សូមភ្ជាប់បណ្ដាញ ហើយស្កេនម្ដងទៀត');
            return;
        }

        const failureRecord = autoLookupFailureAt.get(lookupKey);
        const failedAt = (failureRecord && typeof failureRecord === 'object' ? failureRecord.at : failureRecord) || 0;
        const failureCooldownMs = (failureRecord && typeof failureRecord === 'object' && failureRecord.ms)
            || AUTO_LOOKUP_FAIL_COOLDOWN_MS;
        const failedElapsed = elapsedSince(failedAt);
        if (failedElapsed < failureCooldownMs) {
            dropAutoLookupQueueEntry(lookupKey);
            const waitSeconds = Math.max(1, Math.ceil((failureCooldownMs - failedElapsed) / 1000));
            setLookupStatus(barcode, 'warn', '⏳ ' + lookupSource + ' ទើបខកខាន — សូមស្កេនម្ដងទៀតក្រោយ ' + waitSeconds + ' វិ.');
            return;
        }

        if (autoLookupInFlight.has(lookupKey)) {
            dropAutoLookupQueueEntry(lookupKey);
            setLookupStatus(barcode, 'loading', '🔎 កំពុងស្វែងរកពី ' + lookupSource + '...');
            return;
        }
        if (autoLookupInFlight.size >= AUTO_LOOKUP_MAX_IN_FLIGHT) {
            if (scheduleAutoLookupQueueRetry(barcode)) {
                setLookupStatus(barcode, 'loading', '🔎 កំពុងរង់ចាំជួរ ' + lookupSource + '...');
            } else {
                setLookupStatus(barcode, 'warn', '⏳ Lookup រវល់យូរពេក — សូមស្កេនម្ដងទៀត');
            }
            return;
        }
        const lookupRunToken = {};
        autoLookupInFlight.set(lookupKey, lookupRunToken);
        dropAutoLookupQueueEntry(lookupKey);

        const myGeneration = customerDataTableSessionGeneration;
        const startedAt = Date.now();
        setLookupStatus(barcode, 'loading', isZtoLookup ? '🔎 កំពុងស្វែងរកពី ZTO...' : '🔎 កំពុងស្វែងរកព័ត៌មានអតិថិជន...');
        try {
            const targetUrl = cfg.url.replace('{barcode}', encodeURIComponent(barcode));
            const headers = {};
            if (cfg.headerName && cfg.headerValueEnc) {
                const decrypted = await decryptLookupSecret(cfg.headerValueEnc);
                if (decrypted) headers[cfg.headerName] = decrypted;
            } else if (cfg.headerName && cfg.headerValue) {
                headers[cfg.headerName] = cfg.headerValue;
            }

            const out = await retryAsync(
                () => fetchWithTimeout(targetUrl, { headers }, isZtoLookup ? ZTO_AUTO_LOOKUP_TIMEOUT_MS : AUTO_LOOKUP_TIMEOUT_MS, 'Auto lookup timed out',
                    (r) => r.json().catch(() => null))
                    .catch(markLookupTimeoutNoRetry)
                    .then(retryTransientLookupResponse),
                2, isZtoLookup ? 350 : 1500
            );
            const data = out.body;
            if (!out.res.ok) throw lookupResponseError(out.res.status, data, false);
            if (myGeneration !== customerDataTableSessionGeneration) return;
            if (data && data.error) throw new Error('Lookup rejected');

            const phoneVal = getNestedField(data, cfg.phoneField);
            const codVal = getNestedField(data, cfg.codField);
            const dodVal = getNestedField(data, cfg.dodField);
            const hasPhone = phoneVal !== null && phoneVal !== undefined && String(phoneVal) !== '';
            const hasCod = codVal !== null && codVal !== undefined && !isNaN(parseFloat(codVal));
            const hasDod = dodVal !== null && dodVal !== undefined && !isNaN(parseFloat(dodVal));
            const found = !!(data && (data.success === true || data.found === true)) || hasPhone || hasCod || hasDod;
            autoLookupFailureAt.delete(lookupKey);
            if (!found) {
                setLookupStatus(barcode, 'warn', '⚠️ ' + lookupSource + ' មិនឃើញទិន្នន័យសម្រាប់ Barcode នេះ');
                return;
            }
            const elapsedSeconds = Math.max(0.1, elapsedSince(startedAt) / 1000).toFixed(1);
            setLookupStatus(barcode, 'success', '✅ រកឃើញពី ' + (isZtoLookup ? 'ZTO' : 'API') + ' (' + elapsedSeconds + ' វិ.)');
            setFastLookupRow(barcode, phoneVal, codVal, dodVal, cfg);
            rememberCustomerTableRow(barcode, phoneVal, codVal, dodVal);
            applyLookupFillToModal(barcode, phoneVal, codVal, dodVal, cfg);
        } catch (e) {
            if (myGeneration !== customerDataTableSessionGeneration) return;
            autoLookupFailureAt.delete(lookupKey);
            autoLookupFailureAt.set(lookupKey, {
                at: Date.now(),
                ms: lookupFailureCooldownMs(lookupFailureIsDefinitive(e) ? 'definitive' : 'transient')
            });
            while (autoLookupFailureAt.size > AUTO_LOOKUP_FAILURE_MAX) {
                autoLookupFailureAt.delete(autoLookupFailureAt.keys().next().value);
            }
            if (navigator.onLine === false) {
                setLookupStatus(barcode, 'offline', '📴 បណ្ដាញបានដាច់ — សូមភ្ជាប់ ហើយស្កេនម្ដងទៀត');
            } else if (e && e.message === 'Auto lookup timed out') {
                setLookupStatus(barcode, 'error', '⏱️ ' + lookupSource + ' ឆ្លើយតបយឺតពេក — សូមស្កេនម្ដងទៀត');
            } else if (e && e.lookupCode === 'ZTO_AUTH_EXPIRED') {
                setLookupStatus(barcode, 'error', '🔒 Cookie ZTO ផុតកំណត់ — សូមចូល Argus យក Cookie ថ្មី ដាក់ក្នុង Netlify');
            } else if (e && e.lookupCode === 'ZTO_AUTH_NOT_CONFIGURED') {
                setLookupStatus(barcode, 'error', '🔒 Netlify មិនទាន់មាន Cookie ឬ Token សម្រាប់ ZTO');
            } else if (e && (e.lookupCode === 'ZTO_CONFIG_INVALID' || e.lookupCode === 'ZTO_PROXY_NOT_CONFIGURED')) {
                setLookupStatus(barcode, 'error', '⚙️ Config ZTO នៅ Netlify មិនត្រឹមត្រូវ'
                    + (e.lookupReason ? ' — ជាប់ត្រង់ ' + e.lookupReason : ''));
            } else if (e && e.lookupCode === 'ZTO_RATE_LIMITED') {
                setLookupStatus(barcode, 'error', '🚦 ZTO កំណត់ល្បឿន — សូមរង់ចាំបន្តិច ហើយស្កេនម្ដងទៀត');
            } else if (e && e.lookupCode === 'ZTO_TIMEOUT') {
                setLookupStatus(barcode, 'error', '⏱️ ZTO ឆ្លើយតបយឺតពេក — សូមស្កេនម្ដងទៀត');
            } else if (e && e.lookupCode === 'ZTO_UPSTREAM_UNAVAILABLE') {
                setLookupStatus(barcode, 'error', '📡 ZTO ឆ្លើយមិនចេញ — សូមស្កេនម្ដងទៀត');
            } else if (e && /^HTTP (401|403)$/.test(e.message || '')) {
                setLookupStatus(barcode, 'error', '🔒 ' + lookupSource + ' Secret មិនត្រឹមត្រូវ ឬផុតកំណត់');
            } else {
                setLookupStatus(barcode, 'error', '⚠️ មិនអាចភ្ជាប់ ' + lookupSource + ' បាន — សូមស្កេនម្ដងទៀត');
            }
            console.error("Lookup API error:", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Lookup API error:" });
        } finally {
            if (autoLookupInFlight.get(lookupKey) === lookupRunToken) {
                autoLookupInFlight.delete(lookupKey);
            }
            pumpAutoLookupQueue();
        }
    }

    function openExchangeRateModal() {
        const rateInput = document.getElementById('exchangeRateInput');
        if(rateInput) rateInput.value = exchangeRateRiel;
        openModalHelper('exchangeRateModal');
    }

    function saveExchangeRate() {
        const rateInput = document.getElementById('exchangeRateInput');
        let val = rateInput ? (parseFloat(rateInput.value) || 4100) : 4100;
        if (val <= 0) val = 4100;

        exchangeRateRiel = val;
        safeStoreSet(appLocalStore, 'zoew_exchange_rate', val);

        if (dbRefExchangeRate) {
            fb.set(dbRefExchangeRate, val).catch(() => {
                showToast("⚠️ បរាជ័យក្នុងការ Save អត្រាប្រាក់ទៅ Firebase!");
            });
        }

        closeModal('exchangeRateModal');
        showToast(`បានរក្សាទុកអត្រាប្រាក់ 1$ = ${val.toLocaleString()} ៛`);
        refreshCurrentHistoryView();
    }

    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const ABANDON_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    const EXPIRED_TRASH_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
    const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
    const TRASH_WRITE_SLOW_NOTICE_MS = 15000;
    let sessionExpiryCheckInFlight = false;

    function clearRememberedSession(keepEmail) {
        safeStoreRemove(appLocalStore, 'zoew_login_time');
        if (!keepEmail) safeStoreRemove(appLocalStore, 'remembered_email');
    }

    async function isFirebaseSessionExpired(user) {
        try {
            const tokenResult = await withTimeout(fb.getIdTokenResult(user), DB_OP_TIMEOUT_MS, 'Session check stalled');
            const authTimeMs = new Date(tokenResult.authTime).getTime();
            if (isNaN(authTimeMs)) return false;
            return (getServerNow() - authTimeMs) > FOUR_HOURS_MS;
        } catch (e) {
            return false;
        }
    }

    const SESSION_EXPIRED_TOAST = '⏱️ ផុតកំណត់ ៤ ម៉ោងហើយ! សូមវាយពាក្យសម្ងាត់ និងចុចចូលប្រព័ន្ធម្ដងទៀត។';
    const SESSION_SIGNED_OUT_TOAST = '⚠️ បានចាកចេញពីប្រព័ន្ធ — សូមចូលប្រព័ន្ធម្ដងទៀត';

    function forceExpireSession() {
        sessionExpiryCheck = 'expired';
        refreshLiveToasts();
        const finish = () => {
            clearRememberedSession(true);
            showLoginModalWithPrefill();
            reannounceOrShowToast(SESSION_EXPIRED_TOAST);
        };
        fb.signOut(auth).then(finish, finish);
    }

    function runSessionExpiryCheck() {
        if (sessionExpiryCheckInFlight || sessionExpiryCheck === 'pending' || sessionExpiryCheck === 'expired') return Promise.resolve(false);
        if (!auth || !auth.currentUser) return Promise.resolve(false);
        sessionExpiryCheckInFlight = true;
        const user = auth.currentUser;
        return isFirebaseSessionExpired(user).then((expired) => {
            if (expired && auth && auth.currentUser === user) forceExpireSession();
            return expired;
        }, () => false).finally(() => {
            sessionExpiryCheckInFlight = false;
        });
    }

    function clearSensitiveModalFields() {
        hidePhoneSuggestions();
        setPhoneSearchPulledUp(false);
        restoreAfterPdfExport();
        if (!isPinFlowPending()) pinTargetAction = null;
        pendingRestoreId = null;
        pendingPermanentDeleteId = null;
        pendingHistoryPatches.clear();
        historyPatchFlushInFlight = false;
        pendingRegistryReleases.clear();
        registryReleaseFlushInFlight = false;
        appLockExcuseAt = 0;
        appLockVeiled = false;
        deletedSearchQuery = '';
        expandedTrashGroups.clear();
        activeParentItemId = null;
        lookupSecretKey = null;
        cancelPendingLookupUnlock();
        clearLookupStatus();
        clearSheetImportSession();
        pendingLockerCode = null;
        lockerBarcodeIndex = {};
        recentPhonesSignature = null;
        resetScanConfirm();
        endPanelGlideSnapPause();
        showAppChrome();
        const fieldsToBlank = [
            'securityPinInput', 'newSecurityPinInput', 'loginPasswordInput', 'activationKeyInput',
            'listModalPhoneText', 'barcodeListContainer', 'callMarkPhoneText',
            'editBcPcText', 'editBcCodInput', 'editBcDodInput', 'editPhoneInput',
            'searchPhoneInput', 'hwScannerInput', 'customerDataTableSearchInput',
            'modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput',
            'manualDateInput', 'manualCodChangeInput', 'manualDodChangeInput', 'manualCountChangeInput',
            'editModalBarcodeText', 'lookupApiHeaderValueInput',
            'modalBarcodeText', 'pdfExportPrintArea', 'phoneSuggestBox',
            'deletedTableBody', 'deletedSearchInput', 'trashSummaryBox',
            'dailyStatsContainer', 'monthlyStatsContainer',
            'menuContentContainer', 'lockerListTableBody', 'lockerListSearchInput',
            'locationWarningText', 'customLockerInput',
            'entryListTableBody', 'entryListSearchInput', 'entryListCount',
            'siApiUrlInput', 'siApiPasswordInput', 'siFileInput', 'siHeaderRowInput', 'siModeSel',
            'siConfigSummary', 'siConfigMsg', 'siFileMsg', 'siMapMsg', 'siActionMsg', 'siClearMsg',
            'siStatusFoot', 'siChips', 'siPreviewBody', 'siSheetSel',
            'siMapBarcode', 'siMapDod', 'siMapCod', 'siMapPhone',
            'appLockPinInput', 'appLockMsg'
        ];
        fieldsToBlank.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            if ('value' in el) el.value = '';
            else el.textContent = '';
        });
        const lockerListFilter = document.getElementById('lockerListFilter');
        if (lockerListFilter) lockerListFilter.innerHTML = '<option value="">ទីតាំងទាំងអស់</option>';
    }

    function showLoginModalWithPrefill() {
        clearSensitiveModalFields();
        refreshLiveToasts();
        closeConfigQrScanner();
        document.querySelectorAll('.modal').forEach((m) => {
            if (m.id !== 'loginModal') closeModal(m.id);
        });
        openModalHelper('loginModal');
        const savedEmail = safeStoreGet(appLocalStore, 'remembered_email');
        const emailInput = document.getElementById('loginEmailInput');
        const rememberCb = document.getElementById('rememberMeCheckbox');
        if (savedEmail && emailInput) {
            emailInput.value = savedEmail;
            if (rememberCb) rememberCb.checked = true;
        }
    }

    const LICENSE_APP_CODE = 'ADM';
    const LICENSE_RECHECK_INTERVAL_MS = 15 * 60 * 1000;
    let licenseRecheckInFlight = false;

    function licenseFailureMessage(reason) {
        switch (reason) {
            case 'app-mismatch': return 'Key នេះមិនមែនសម្រាប់ ZoeW ទេ!';
            case 'expired':
            case 'expired-server': return 'Key នេះបានផុតកំណត់ហើយ!';
            case 'revoked': return 'Key នេះត្រូវបានដកហូតសិទ្ធិ (Revoked)!';
            case 'not-found': return 'Key នេះមិនមានក្នុងប្រព័ន្ធទេ!';
            case 'signature': return 'Key មិនត្រឹមត្រូវទេ (Signature Invalid)!';
            case 'network':
            case 'not-configured':
            case 'clock-unverified': return 'ភ្ជាប់ Server មិនបានទេ! សូមបើកអ៊ីនធឺណិត រួចសាកម្តងទៀត។';
            case 'verify-unavailable': return 'ផ្ទៀងផ្ទាត់ Key មិនបានទេ! សូមបិទបើក App ម្តងទៀត។';
            default: return 'Key មិនត្រឹមត្រូវទេ! សូមពិនិត្យម្តងទៀត។';
        }
    }

    async function ensureAppActivated() {
        const status = await ZoeLicense.getStatus(LICENSE_APP_CODE);
        if (status.state === 'active') {
            closeModal('activationModal');
            return true;
        }
        const msgEl = document.getElementById('activationModalMsg');
        if (msgEl) {
            msgEl.textContent = (status.state === 'offline-grace-exceeded')
                ? 'Key នេះនៅមានសុពលភាព ប៉ុន្តែត្រូវការភ្ជាប់អ៊ីនធឺណិតម្តងទៀត ដើម្បីផ្ទៀងផ្ទាត់។'
                : (status.reason ? licenseFailureMessage(status.reason) : 'សូមបញ្ចូល Activation Key សម្រាប់ ZoeW ដើម្បីបន្ត។');
        }
        openModalHelper('activationModal');
        const keyInput = document.getElementById('activationKeyInput');
        if (keyInput) keyInput.focus();
        return false;
    }

    function runPeriodicLicenseCheck() {
        if (licenseRecheckInFlight || !auth || !auth.currentUser || !isDatabaseInitialized || isModalOpen) return Promise.resolve(false);
        licenseRecheckInFlight = true;
        return withTimeout(ensureAppActivated(), 20000, 'Periodic activation check timed out').then((result) => result, (error) => {
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: 'periodic ensureAppActivated' });
            return false;
        }).finally(() => {
            licenseRecheckInFlight = false;
        });
    }

    async function submitActivationKey() {
        const btn = document.getElementById('activationSubmitBtn');
        if (btn && btn.disabled) return;
        const originalBtnText = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'កំពុងផ្ទៀងផ្ទាត់...'; }
        try {
            const input = document.getElementById('activationKeyInput');
            const keyStr = input ? input.value.trim() : '';
            if (!keyStr) { showToast('សូមបញ្ចូល Activation Key!'); return; }
            const result = await withTimeout(ZoeLicense.activate(keyStr, LICENSE_APP_CODE), 30000, 'Activation timed out');
            if (!result.valid) {
                if (input) input.value = '';
                showToast(licenseFailureMessage(result.reason));
                return;
            }
            if (input) input.value = '';
            const activated = await withTimeout(ensureAppActivated(), 20000, 'Activation timed out');
            if (activated) {
                showToast("✅ Active ជោគជ័យ!");
                updateAuthButton(true);
                if (!isDatabaseInitialized && !initDatabaseListeners()) {
                    showToast('⚠️ មិនអាចភ្ជាប់ទិន្នន័យបានទេ! សូម Refresh ទំព័រ។');
                }
                safeFocusScanner();
            } else {
                showToast("⚠️ Key ត្រូវបានផ្ទៀងផ្ទាត់ក្នុងគ្រឿង ប៉ុន្តែប្រព័ន្ធច្រានចោល — សូមមើលសារនៅក្នុងប្រអប់ខាងលើ");
            }
        } catch (e) {
            console.error('submitActivationKey failed:', e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'submitActivationKey' });
            showToast('❌ កំហុសមិនរំពឹងទុក: ' + (e && e.message ? e.message : String(e)));
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = originalBtnText; }
        }
    }

    async function proceedAfterLogin(user, myAuthGeneration) {
        let activated;
        try {
            activated = await withTimeout(ensureAppActivated(), 20000, 'Activation check timed out');
        } catch (e) {
            if (myAuthGeneration !== authGeneration) return;
            console.error("Activation check failed:", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Activation check after login" });
            showToast("⚠️ មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិប្រើប្រាស់បានទេ! សូមសាកល្បងចូលម្តងទៀត។");
            return;
        }
        if (myAuthGeneration !== authGeneration) return;
        if (!activated) {
            closeModal('loginModal');
            return;
        }

        closeModal('loginModal');
        const wasAlreadySignedIn = isDatabaseInitialized;
        updateAuthButton(true);

        sessionExpiryCheck = 'pending';
        const settleSessionExpiryCheck = (expired) => {
            if (myAuthGeneration !== authGeneration) return;
            sessionExpiryCheck = expired ? 'expired' : 'live';
            if (expired) forceExpireSession();
            else refreshLiveToasts();
        };
        isFirebaseSessionExpired(user).then(settleSessionExpiryCheck, () => settleSessionExpiryCheck(false));

        if (!isDatabaseInitialized && !initDatabaseListeners()) {
            showToast('⚠️ មិនអាចភ្ជាប់ទិន្នន័យបានទេ! សូម Refresh ទំព័រ។');
        }
        if (!wasAlreadySignedIn) showLiveToast('signin');
        prefetchCustomerDataTableRowsIfConfigured();
        safeFocusScanner();
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

        if (authUnsubscribe) {
            try { authUnsubscribe(); } catch (e) {}
            authUnsubscribe = null;
        }
        if (authRecoveryTimeout) {
            clearTimeout(authRecoveryTimeout);
            authRecoveryTimeout = null;
        }

        authRecoveryTimeout = setTimeout(() => { attemptAuthStorageRecovery(); }, 8000);

        authUnsubscribe = fb.onAuthStateChanged(auth, (user) => {
            clearTimeout(authRecoveryTimeout);
            authRecoveryTimeout = null;
            authGeneration++;
            const myAuthGeneration = authGeneration;
            if (user) {
                autoLoginAttempted = false;
                proceedAfterLogin(user, myAuthGeneration);
            } else {
                resetClearHistoryOperationState();
                resetDbListenerHealthState();
                detachDatabaseListeners();
                isDatabaseInitialized = false;
                scanHistory = [];
                deletedItems = [];
                dailyRevenueData = {};
                monthlyRevenueData = {};
                dailyPickupData = {};
                lockerBarcodeIndex = {};
                clearCustomerDataTableCache();
                applyCurrentFilter();
                renderRecentlyDeleted();
                updateRecentPhonesList();
                updateAuthButton(false);

                showLoginModalWithPrefill();
            }
        });
    }

    function loginWithFirebase() {
        if (!auth) {
            alert("សូមកំណត់រចនាសម្ព័ន្ធ FirebaseConfig ជាមុនសិន!");
            checkPinAndOpenConfig();
            return;
        }
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn && loginBtn.disabled) return;

        const emailInput = document.getElementById('loginEmailInput');
        const passInput = document.getElementById('loginPasswordInput');
        const rememberCb = document.getElementById('rememberMeCheckbox');

        const email = emailInput ? emailInput.value.trim() : '';
        const password = passInput ? passInput.value : '';
        const rememberMe = rememberCb ? rememberCb.checked : false;

        if (!email || !password) {
            alert("សូមបញ្ចូល អ៊ីមែល និង ពាក្យសម្ងាត់!");
            return;
        }

        if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'កំពុងចូល...'; }

        const generationAtLogin = authGeneration;

        fb.setPersistence(auth, rememberMe ? fb.browserLocalPersistence : fb.browserSessionPersistence)
            .then(() => {
                return fb.signInWithEmailAndPassword(auth, email, password);
            })
            .then((userCredential) => {
                autoLoginAttempted = false;

                if (rememberMe) {
                    safeStoreSet(appLocalStore, 'remembered_email', email);
                } else {
                    safeStoreRemove(appLocalStore, 'remembered_email');
                }

                if (authGeneration === generationAtLogin && userCredential && userCredential.user) {
                    authGeneration++;
                    proceedAfterLogin(userCredential.user, authGeneration);
                }
            })
            .catch((error) => {
                alert("ការចូលប្រព័ន្ធមិនជោគជ័យ៖ " + error.message);
            })
            .finally(() => {
                if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'ចូលប្រព័ន្ធ'; }
                if (passInput) passInput.value = '';
            });
    }

    function updateAuthButton(isLoggedIn) {
        const btn = document.getElementById('navAuthBtn');
        if (!btn) return;
        const ico = btn.querySelector('.ico');
        const label = btn.querySelector('.drawer-auth-label');
        if (isLoggedIn) {
            if (ico) ico.textContent = '🚪';
            if (label) label.textContent = 'ចាកចេញ';
            btn.onclick = () => drawerAction(logoutApp);
        } else {
            if (ico) ico.textContent = '🔑';
            if (label) label.textContent = 'ចូល';
            btn.onclick = () => drawerAction(showLoginModalWithPrefill);
        }
    }

    function logoutApp() {
        clearAppUnlockedForSession();
        if (auth) {
            fb.signOut(auth).then(() => {
                resetClearHistoryOperationState();
                clearRememberedSession(false);
                showLoginModalWithPrefill();
                showToast("បានចាកចេញពីប្រព័ន្ធ!");
            }).catch(() => {
                resetClearHistoryOperationState();
                clearRememberedSession(false);
                showLoginModalWithPrefill();
                showToast("⚠️ បានចាកចេញលើឧបករណ៍នេះ — តែមិនអាចប្រាប់ Server បានទេ");
            });
        }
    }

    function detachDatabaseListeners() {
        dbListenerGeneration++;
        if (!fb) return;
        [dbRefDailyRevenue, dbRefMonthlyRevenue, dbRefDailyPickup, dbRefHistory, dbRefDeleted, dbRefExchangeRate]
            .forEach((ref) => { if (ref) { try { fb.off(ref); } catch (e) {} } });
    }

    function clearDbListenerRecovery() {
        if (dbListenerRecoveryTimer) {
            clearTimeout(dbListenerRecoveryTimer);
            dbListenerRecoveryTimer = null;
        }
        dbListenerRecoveryAttempt = 0;
    }

    function dbListenerViewIsStale(pathKey) {
        return dbListenerPendingPaths.has(pathKey) || dbListenerFailedPaths.has(pathKey);
    }

    function noteDbListenerAlive(pathKey) {
        const wasPending = dbListenerPendingPaths.delete(pathKey);
        dbListenerFailedPaths.delete(pathKey);
        if (wasPending) {
            dbListenerProgressAt = Date.now();
            dbListenerPendingSeen = dbListenerPendingPaths.size;
        }
        if (wasPending && !dbListenerPendingPaths.size) refreshLiveToasts();
        if (!dbListenersFailed || dbListenerPendingPaths.size || dbListenerFailedPaths.size) return;
        dbListenersFailed = false;
        dbListenerOutageNoticeShown = false;
        clearDbListenerRecovery();
        renderConnectionStatus();
        showToast('✅ ទិន្នន័យភ្ជាប់មកវិញហើយ — តារាងទាន់សម័យវិញហើយ');
    }

    function dbListenerResyncIsProgressing() {
        if (!dbListenerPendingPaths.size) return false;
        return elapsedSince(dbListenerProgressAt) < DB_LISTENER_PROGRESS_GRACE_MS;
    }

    function attemptDbListenerRecovery() {
        dbListenerRecoveryTimer = null;
        if (!dbListenersFailed) return;
        if (!db || !fb || !auth || !auth.currentUser) { scheduleDbListenerRecovery(); return; }
        if (navigator.onLine === false) { scheduleDbListenerRecovery(); return; }
        if (dbListenerResyncIsProgressing()) { scheduleDbListenerRecovery(); return; }
        const sinceLastAttempt = elapsedSince(lastDbListenerAttemptAt);
        if (sinceLastAttempt < DB_LISTENER_RETRY_MIN_GAP_MS) {
            dbListenerRecoveryTimer = setTimeout(attemptDbListenerRecovery, DB_LISTENER_RETRY_MIN_GAP_MS - sinceLastAttempt);
            return;
        }
        lastDbListenerAttemptAt = Date.now();
        initDatabaseListeners();
        scheduleDbListenerRecovery();
    }

    function scheduleDbListenerRecovery() {
        if (dbListenerRecoveryTimer || !dbListenersFailed) return;
        const step = LISTENER_RECOVERY_STEPS_MS[Math.min(dbListenerRecoveryAttempt, LISTENER_RECOVERY_STEPS_MS.length - 1)];
        dbListenerRecoveryAttempt++;
        dbListenerRecoveryTimer = setTimeout(attemptDbListenerRecovery, step);
    }

    function resetDbListenerHealthState() {
        sdkUnavailableNoticeShown = false;
        pickupLedgerRepairDone = false;
        pickupLedgerRepairRunning = false;
        clearInfoListenerRecovery();
        dbListenersFailed = false;
        dbListenerOutageNoticeShown = false;
        dbListenerPendingPaths.clear();
        dbListenerFailedPaths.clear();
        dbListenerPendingSeen = 0;
        dbListenerProgressAt = 0;
        lastDbListenerAttemptAt = 0;
        clearDbListenerRecovery();
        clearReconnectWatchdog();
    }

    function retryFailedDbListenersNow() {
        if (!dbListenersFailed) return;
        clearDbListenerRecovery();
        attemptDbListenerRecovery();
    }

    function handleDbListenerError(err, pathKey) {
        console.error('Firebase listener error:', err);
        if (window.ZoeErrors) ZoeErrors.capture(err, { context: 'Firebase listener error' });
        if (pathKey) dbListenerFailedPaths.add(pathKey);
        dbListenersFailed = true;
        renderConnectionStatus();
        if (!dbListenerOutageNoticeShown) {
            dbListenerOutageNoticeShown = true;
            showToast('⚠️ ដាចការទាញយកទិន្នន័យពី Server — តារាងអាចមិនទាន់សម័យ។ កំពុងព្យាយាមភ្ជាប់ឡើងវិញ...');
        }
        scheduleDbListenerRecovery();
    }

    function initDatabaseListeners() {
        if (!db || !fb) return false;

        detachDatabaseListeners();
        const listenerGeneration = ++dbListenerGeneration;
        dbListenerPendingPaths.clear();
        dbListenerFailedPaths.clear();
        DB_LISTENER_KEYS.forEach((key) => dbListenerPendingPaths.add(key));
        dbListenerPendingSeen = dbListenerPendingPaths.size;
        dbListenerProgressAt = 0;

        if (dbRefExchangeRate) {
            fb.onValue(dbRefExchangeRate, (snapshot) => {
                if (listenerGeneration !== dbListenerGeneration) return;
                noteDbListenerAlive('exchangeRate');
                const val = snapshot.val();
                if (val && !isNaN(val)) {
                    exchangeRateRiel = parseFloat(val);
                    try { appLocalStore.setItem('zoew_exchange_rate', exchangeRateRiel); } catch (e) {}
                    debouncedRenderAfterHistorySync();
                }
            }, (err) => {
                if (listenerGeneration !== dbListenerGeneration) return;
                handleDbListenerError(err, 'exchangeRate');
            });
        }

        if (dbRefDailyRevenue) {
            fb.onValue(dbRefDailyRevenue, (snapshot) => {
                if (listenerGeneration !== dbListenerGeneration) return;
                noteDbListenerAlive('dailyRevenue');
                dailyRevenueData = snapshot.val() || {};
                debouncedRenderAfterHistorySync();
            }, (err) => {
                if (listenerGeneration !== dbListenerGeneration) return;
                handleDbListenerError(err, 'dailyRevenue');
            });
        }

        if (dbRefMonthlyRevenue) {
            fb.onValue(dbRefMonthlyRevenue, (snapshot) => {
                if (listenerGeneration !== dbListenerGeneration) return;
                noteDbListenerAlive('monthlyRevenue');
                monthlyRevenueData = snapshot.val() || {};
            }, (err) => {
                if (listenerGeneration !== dbListenerGeneration) return;
                handleDbListenerError(err, 'monthlyRevenue');
            });
        }

        if (dbRefDailyPickup) {
            fb.onValue(dbRefDailyPickup, (snapshot) => {
                if (listenerGeneration !== dbListenerGeneration) return;
                noteDbListenerAlive('dailyPickup');
                dailyPickupData = snapshot.val() || {};
                debouncedRenderAfterHistorySync();
            }, (err) => {
                if (listenerGeneration !== dbListenerGeneration) return;
                handleDbListenerError(err, 'dailyPickup');
            });
        }

        if (dbRefHistory) {
        fb.onValue(dbRefHistory, (snapshot) => {
            if (listenerGeneration !== dbListenerGeneration) return;
            noteDbListenerAlive('history');
            const data = snapshot.val();
            if (!data) scanHistory = [];
            else if (Array.isArray(data)) scanHistory = data.filter(item => item !== null);
            else scanHistory = Object.keys(data).map(key => { const v = data[key]; if (v && !v.id) v.id = key; return v; });

            scanHistory.forEach(item => {
                if(!item.id) item.id = generateUniqueId();
                if (!item.createdAt) {
                    item.createdAt = parseTimestampFromId(item.id) || getServerNow();
                }

                if (item.cod === undefined) {
                    item.cod = item.price !== undefined ? parseFloat(item.price) || 0 : 0;
                } else {
                    item.cod = parseFloat(item.cod) || 0;
                }

                if (item.dod === undefined) {
                    item.dod = 0;
                } else {
                    item.dod = parseFloat(item.dod) || 0;
                }

                item.price = Math.round((item.cod + item.dod) * 100) / 100;

                if (Array.isArray(item.barcodes) || (item.barcodes && typeof item.barcodes === 'object')) {
                    normalizeBarcodesOf(item);
                    if (item.barcodes.length) item.count = item.barcodes.length;
                }

                if (item.barcodes && Array.isArray(item.barcodes)) {
                    item.barcodes.forEach(b => {
                        if (!b || typeof b !== 'object') return;
                        b.cod = parseFloat(b.cod) || 0;
                        b.dod = parseFloat(b.dod) || 0;
                        if (b.isDeducted === undefined) b.isDeducted = false;
                        if (b.isFromDeletion === undefined) b.isFromDeletion = false;
                    });
                }
            });

            debouncedRenderAfterHistorySync();
        }, (err) => {
            if (listenerGeneration !== dbListenerGeneration) return;
            handleDbListenerError(err, DB_LISTENER_KEY_HISTORY);
        });
        }

        if (dbRefDeleted) {
        fb.onValue(dbRefDeleted, (snapshot) => {
            if (listenerGeneration !== dbListenerGeneration) return;
            noteDbListenerAlive('deleted');
            const data = snapshot.val();
            if (!data) deletedItems = [];
            else if (Array.isArray(data)) deletedItems = data.filter(item => item !== null);
            else deletedItems = Object.keys(data).map(key => { const v = data[key]; if (v && !v.id) v.id = key; return v; });

            deletedItems.forEach(item => {
                if(!item.id) item.id = generateUniqueId();
                if (!item.createdAt) {
                    item.createdAt = parseTimestampFromId(item.id) || getServerNow();
                }
                normalizeBarcodesOf(item);
            });
            runAutomaticDeletedCleanup();
        }, (err) => {
            if (listenerGeneration !== dbListenerGeneration) return;
            handleDbListenerError(err, DB_LISTENER_KEY_DELETED);
        });
        }

        isDatabaseInitialized = true;
        return true;
    }

    let recentPhonesSignature = null;

    function updateRecentPhonesList() {
        const datalist = document.getElementById('recentPhonesList');
        if (!datalist) return;

        const entries = collectPhoneSuggestions('', RECENT_PHONES_MAX);
        const signature = entries.map(entry => entry.phone).join('\u0001');
        if (recentPhonesSignature !== null && signature === recentPhonesSignature) return;
        recentPhonesSignature = signature;

        datalist.innerHTML = '';
        entries.forEach(entry => {
            const option = document.createElement('option');
            option.value = entry.phone;
            datalist.appendChild(option);
        });
    }

    const cleanupInFlight = new Set();
    const staleRestoreMarkerSweeps = new Set();
    let deletedCleanupInFlight = false;

    function trashRetentionMs(item) {
        return item && item.trashReason === 'expired' ? EXPIRED_TRASH_RETENTION_MS : TRASH_RETENTION_MS;
    }

    function clearStaleRestoreMarkers(item) {
        if (!db || !fb || !item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) return;
        if (staleRestoreMarkerSweeps.has(item.id)) return;
        if (dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return;
        const sourceId = item.restoreClaimId;
        if (typeof sourceId === 'string' && activeRestoreClaims.has(sourceId)) return;
        const source = (typeof sourceId === 'string')
            ? deletedItems.find((entry) => entry && entry.id === sourceId)
            : null;
        if (source && isActiveRestoreClaim(source.restoreClaim)) return;
        staleRestoreMarkerSweeps.add(item.id);
        const release = () => { staleRestoreMarkerSweeps.delete(item.id); };
        dbOp(fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${item.id}`), (currentItem) => {
            if (!currentItem) return currentItem;
            if (!itemHasRestoreMarkers(currentItem)) return;
            delete currentItem.restoreClaimId;
            delete currentItem.restoreClaimToken;
            return currentItem;
        })).then(release, (error) => {
            release();
            if (dbOpStalled(error)) return;
            console.error('Failed to clear stale restore markers for', item.id, error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: 'clearStaleRestoreMarkers', itemId: item.id });
        });
    }

    function runAutomaticCleanupRules() {
        if (!cleanupClockIsTrustworthy()) return;
        const currentTime = getServerNow();

        scanHistory.forEach(item => {
            if (!item.id) return;
            if (item.clearClaim) return;
            if (itemHasRestoreMarkers(item)) {
                clearStaleRestoreMarkers(item);
                return;
            }
            let itemTimestamp = item.createdAt || parseTimestampFromId(item.id) || currentTime;

            if (!item.isClosed && (currentTime - itemTimestamp > ABANDON_AGE_MS)) {
                claimAndCleanupItem(item.id, 'abandon');
                return;
            }

            if (item.isClosed && item.closedAt && (currentTime - item.closedAt > TWO_HOURS_MS)) {
                claimAndCleanupItem(item.id, 'close');
                return;
            }

            if (Array.isArray(item.barcodes) && item.barcodes.some(b => b && b.isClosed && (typeof b.closedAt !== 'number' || barcodeCloseIsRipe(b, currentTime)))) {
                claimAndCleanupItem(item.id, 'close');
            }
        });
    }

    async function restoreClaimedItemToScanHistory(id, claimedWhole, claimedPartial) {
        const itemRef = fb.ref(db, `zoew_scan_history_cod_dod/${id}`);
        let clearClaimBlocked = false;
        return retryAsync(() => fb.runTransaction(itemRef, (currentItem) => {
            clearClaimBlocked = false;
            if (currentItem && currentItem.clearClaim) {
                clearClaimBlocked = true;
                return;
            }
            normalizeBarcodesOf(currentItem);
            if (claimedWhole) {
                if (currentItem) return currentItem;
                const updated = cloneRestoreItem(claimedWhole);
                delete updated.restoreClaim;
                delete updated.restoreClaimId;
                delete updated.restoreClaimToken;
                return updated;
            }
            const reclaimed = barcodeEntriesOf(claimedPartial.barcodes).map(({ barcode }) => { const { isDeducted, ...rest } = barcode; return rest; });
            const base = currentItem || { ...claimedPartial, barcodes: [] };
            if (!currentItem) {
                delete base.restoreClaim;
                delete base.restoreClaimId;
                delete base.restoreClaimToken;
            }
            const existingCodes = new Set((base.barcodes || []).map(b => b.code));
            const merged = [...(base.barcodes || []), ...reclaimed.filter(b => !existingCodes.has(b.code))];
            const updated = { ...base, barcodes: merged };
            updated.count = merged.length;
            updated.cod = Math.round(merged.reduce((s, b) => s + (parseFloat(b.cod) || 0), 0) * 100) / 100;
            updated.dod = Math.round(merged.reduce((s, b) => s + (parseFloat(b.dod) || 0), 0) * 100) / 100;
            updated.price = Math.round((updated.cod + updated.dod) * 100) / 100;
            updated.barcode = merged[0] ? merged[0].code : updated.barcode;
            updated.isClosed = merged.length > 0 && merged.every(b => b.isClosed);
            if (updated.isClosed) {
                if (!updated.closedAt) updated.closedAt = getServerNow();
            } else {
                delete updated.closedAt;
            }
            return updated;
        }), 3, 1500).then((result) => {
            if (clearClaimBlocked || !result || !result.committed) throw new Error('CLEAR_HISTORY_IN_PROGRESS');
            return result;
        });
    }

    async function claimAndCleanupItem(id, reason) {
        if (!db || !id || !/^[a-zA-Z0-9_-]+$/.test(id) || cleanupInFlight.has(id)) return;
        cleanupInFlight.add(id);

        let claimedWhole = null;
        let claimedPartial = null;
        let updatedRemainder = null;
        const cleanupUpdater = (currentItem) => {
            claimedWhole = null;
            claimedPartial = null;
            updatedRemainder = null;
            if (!currentItem) return currentItem;
            if (currentItem.clearClaim) return currentItem;
            if (itemHasRestoreMarkers(currentItem)) return;
            normalizeBarcodesOf(currentItem);
            const ts = currentItem.createdAt || parseTimestampFromId(id) || getServerNow();

            if (reason === 'abandon') {
                if (currentItem.isClosed || (getServerNow() - ts) <= ABANDON_AGE_MS) return currentItem;

                if (currentItem.barcodes && Array.isArray(currentItem.barcodes) && currentItem.barcodes.length) {
                    const staleOpen = currentItem.barcodes.filter(b => !b.isClosed);
                    const stillActive = currentItem.barcodes.filter(b => b.isClosed);
                    if (staleOpen.length === 0) return currentItem;

                    if (stillActive.length === 0) {
                        claimedWhole = currentItem;
                        return null;
                    }

                    claimedPartial = { ...currentItem, barcodes: staleOpen };
                    const updated = { ...currentItem, barcodes: stillActive };
                    updated.count = stillActive.length;
                    updated.cod = Math.round(stillActive.reduce((s, b) => s + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                    updated.dod = Math.round(stillActive.reduce((s, b) => s + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                    updated.price = Math.round((updated.cod + updated.dod) * 100) / 100;
                    updated.barcode = stillActive[0].code;
                    updated.isClosed = true;
                    if (!updated.closedAt) updated.closedAt = getServerNow();
                    updatedRemainder = updated;
                    return updated;
                }

                claimedWhole = currentItem;
                return null;
            } else {
                if (currentItem.barcodes && Array.isArray(currentItem.barcodes) && currentItem.barcodes.length) {
                    const stamped = normalizeBarcodeCloseStamps(currentItem, getServerNow());
                    const ripeClosed = currentItem.barcodes.filter(b => barcodeCloseIsRipe(b, getServerNow()));
                    if (ripeClosed.length === 0) return stamped ? currentItem : undefined;

                    const keptBarcodes = currentItem.barcodes.filter(b => !barcodeCloseIsRipe(b, getServerNow()));
                    if (keptBarcodes.length === 0) {
                        claimedWhole = currentItem;
                        return null;
                    }

                    claimedPartial = { ...currentItem, barcodes: ripeClosed };
                    const updated = { ...currentItem, barcodes: keptBarcodes };
                    updated.count = keptBarcodes.length;
                    updated.cod = Math.round(keptBarcodes.reduce((s, b) => s + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                    updated.dod = Math.round(keptBarcodes.reduce((s, b) => s + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                    updated.price = Math.round((updated.cod + updated.dod) * 100) / 100;
                    updated.barcode = keptBarcodes[0].code;
                    updated.isClosed = keptBarcodes.every(b => b.isClosed);
                    if (updated.isClosed) {
                        if (!updated.closedAt) updated.closedAt = getServerNow();
                    } else {
                        delete updated.closedAt;
                    }
                    updatedRemainder = updated;
                    return updated;
                }

                if (!currentItem.isClosed || !currentItem.closedAt || (getServerNow() - currentItem.closedAt) <= TWO_HOURS_MS) return currentItem;
                claimedWhole = currentItem;
                return null;
            }
        };
        const finishCleanup = async (result) => {
            if (!result.committed || (!claimedWhole && !claimedPartial)) return;

            let trashItem;
            let revenueDeducted = false;
            let revenueScanDate = null;
            let revenueCod = 0, revenueDod = 0, revenueCount = 0;
            if (claimedPartial) {
                const partialIsPickup = reason !== 'abandon';
                trashItem = { ...claimedPartial, id: generateUniqueId() };
                trashItem.barcodes = trashItem.barcodes.map(b => partialIsPickup ? ({ ...b, isFromDeletion: true }) : ({ ...b, isDeducted: true, isFromDeletion: false }));
                trashItem.count = trashItem.barcodes.length;
                trashItem.cod = Math.round(trashItem.barcodes.reduce((s, b) => s + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                trashItem.dod = Math.round(trashItem.barcodes.reduce((s, b) => s + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                trashItem.price = Math.round((trashItem.cod + trashItem.dod) * 100) / 100;
                trashItem.barcode = trashItem.barcodes[0].code;
                trashItem.deletedAt = getServerNow();
                if (partialIsPickup) {
                    trashItem.isClosed = true;
                    trashItem.closedAt = trashItem.barcodes.reduce((latest, b) => Math.max(latest, parseFloat(b.closedAt) || 0), 0) || getServerNow();
                    trashItem.isFromDeletion = true;
                    trashItem.trashReason = 'pickup';
                } else {
                    trashItem.isClosed = false;
                    delete trashItem.closedAt;
                    trashItem.isFromDeletion = false;
                    trashItem.trashReason = 'expired';
                    revenueScanDate = trashItem.scanDate || getFormattedDate();
                    revenueCod = trashItem.cod;
                    revenueDod = trashItem.dod;
                    revenueCount = trashItem.count;
                    addRevenueToDailyAndMonthlyRecord(revenueScanDate, -revenueCod, -revenueDod, -revenueCount);
                    revenueDeducted = true;
                }
            } else {
                trashItem = { ...claimedWhole, id };
                trashItem.deletedAt = getServerNow();

                if (reason === 'abandon') {
                    trashItem.isFromDeletion = false;
                    trashItem.trashReason = 'expired';
                    if (trashItem.barcodes && Array.isArray(trashItem.barcodes)) {
                        trashItem.barcodes = trashItem.barcodes.map(b => ({ ...b, isDeducted: true, isFromDeletion: false }));
                    }
                    revenueScanDate = trashItem.scanDate || getFormattedDate();
                    revenueCod = parseFloat(trashItem.cod) || 0;
                    revenueDod = parseFloat(trashItem.dod) || 0;
                    revenueCount = trashItem.barcodes && Array.isArray(trashItem.barcodes) ? trashItem.barcodes.length : (parseFloat(trashItem.count) || 1);
                    addRevenueToDailyAndMonthlyRecord(revenueScanDate, -revenueCod, -revenueDod, -revenueCount);
                    revenueDeducted = true;
                } else {
                    trashItem.isFromDeletion = true;
                    trashItem.trashReason = 'pickup';
                    if (trashItem.barcodes && Array.isArray(trashItem.barcodes)) {
                        trashItem.barcodes = trashItem.barcodes.map(b => ({ ...b, isFromDeletion: true }));
                    }
                }
            }

            stripHistoryOnlyMarkers(trashItem);

            deletedItems.unshift(trashItem);
            await notifyIfSlow(retryAsync(() => saveSingleDeletedItemToFirebase(trashItem), 4, 1500),
                TRASH_WRITE_SLOW_NOTICE_MS,
                "⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងរក្សាទុកការសម្អាតស្វ័យប្រវត្តិ… សូមកុំបិទ App។").catch(async (trashErr) => {
                if (revenueDeducted) {
                    addRevenueToDailyAndMonthlyRecord(revenueScanDate, revenueCod, revenueDod, revenueCount);
                }
                const staleIdx = deletedItems.findIndex(i => i.id === trashItem.id);
                if (staleIdx !== -1) deletedItems.splice(staleIdx, 1);
                console.error('Trash write permanently failed for automatic cleanup of', id, trashErr);
                if (window.ZoeErrors) ZoeErrors.capture(trashErr, { context: 'claimAndCleanupItem trash write failed after retries', itemId: id, reason });

                try {
                    const restoreResult = await restoreClaimedItemToScanHistory(id, claimedWhole, claimedPartial);
                    const restoredItem = (restoreResult && restoreResult.snapshot) ? restoreResult.snapshot.val() : null;
                } catch (restoreErr) {
                    console.error('Failed to restore item to scan history after trash write failure for', id, restoreErr);
                    if (window.ZoeErrors) ZoeErrors.capture(restoreErr, { context: 'claimAndCleanupItem restore-after-trash-failure also failed', itemId: id, reason });
                    showToast('⚠️ បញ្ហាធ្ងន់ធ្ងរ៖ ទិន្នន័យកញ្ចប់ ' + id + ' អាចនឹងបាត់! សូមប្រាប់ Admin ត្រួតពិនិត្យភ្លាមៗ');
                }
            });
        };
        try {
            const cleanupTx = fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${id}`), cleanupUpdater);
            let result;
            try {
                result = await dbOp(cleanupTx);
            } catch (txError) {
                if (dbOpStalled(txError)) {
                    armLateCommit(cleanupTx, finishCleanup, null, 'claimAndCleanupItem ' + reason);
                    return;
                }
                throw txError;
            }
            await finishCleanup(result);
        } catch (e) {
            console.error('Automatic cleanup transaction failed for', id, e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'Automatic cleanup transaction failed for' });
        } finally {
            cleanupInFlight.delete(id);
        }
    }

    async function runAutomaticDeletedCleanup() {
        if (deletedCleanupInFlight) return;
        if (!cleanupClockIsTrustworthy()) return;
        const currentTime = getServerNow();
        const candidates = [];

        deletedItems.forEach(item => {
            if (!item || !item.id) return;
            const deletedTime = item.deletedAt || currentTime;
            if (currentTime - deletedTime <= trashRetentionMs(item)) return;
            let staleClaim = false;
            if (item.restoreClaim) {
                if (isActiveRestoreClaim(item.restoreClaim)) return;
                if (activeRestoreClaims.has(item.id)) return;
                staleClaim = true;
            }
            candidates.push({ id: item.id, barcodes: collectItemBarcodes(item), staleClaim });
        });

        if (!candidates.length) return;

        deletedCleanupInFlight = true;
        try {
            const purgeable = [];
            for (const candidate of candidates) {
                if (candidate.staleClaim) {
                    try {
                        await releaseStaleRestoreClaimForPurge(candidate.id);
                    } catch (claimError) {
                        console.error('Failed to release stale restore claim before purge for', candidate.id, claimError);
                        if (window.ZoeErrors) ZoeErrors.capture(claimError, { context: 'runAutomaticDeletedCleanup stale claim release', itemId: candidate.id });
                        continue;
                    }
                }
                purgeable.push(candidate);
            }
            if (!purgeable.length) return;

            const applyPurged = (list) => {
                if (!list || !list.length) return Promise.resolve();
                const purgedSet = new Set(list.map((c) => c.id));
                deletedItems = deletedItems.filter(item => !purgedSet.has(item.id));
                let purgedBarcodes = [];
                list.forEach((candidate) => { purgedBarcodes = purgedBarcodes.concat(candidate.barcodes); });
                return releaseBarcodesInRegistry(purgedBarcodes);
            };

            let purged = purgeable;
            const batchWrite = purgeDeletedItemsQuietly(purgeable.map((c) => c.id));
            try {
                await dbOp(batchWrite);
            } catch (batchError) {
                if (dbOpStalled(batchError)) {
                    armLateWrite(batchWrite, () => applyPurged(purgeable), null, 'purgeDeletedItems batch');
                    return;
                }
                purged = [];
                let lastError = batchError;
                let stalled = false;
                for (const candidate of purgeable) {
                    const singleWrite = purgeDeletedItemsQuietly([candidate.id]);
                    try {
                        await dbOp(singleWrite);
                        purged.push(candidate);
                    } catch (singleError) {
                        lastError = singleError;
                        if (dbOpStalled(singleError)) {
                            armLateWrite(singleWrite, () => applyPurged([candidate]), null, 'purgeDeletedItems single');
                            stalled = true;
                            break;
                        }
                    }
                }
                if (!purged.length) {
                    if (!stalled) {
                        console.error('Error purging deleted items: ', lastError);
                        if (window.ZoeErrors) ZoeErrors.capture(lastError, { context: 'Error purging deleted items: ' });
                        showToast("⚠️ បរាជ័យក្នុងការលុបធុងសំរាមចាស់ចេញពី Firebase!");
                    }
                    return;
                }
            }

            await applyPurged(purged);
        } catch (e) {
            console.error('Automatic trash purge failed', e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'runAutomaticDeletedCleanup' });
        } finally {
            deletedCleanupInFlight = false;
        }
    }

    function runScheduledCleanup() {
        if (!db || !isDatabaseInitialized || dbListenersFailed) return;
        runAutomaticCleanupRules();
        runAutomaticDeletedCleanup();
        repairPickupLedgerOnce();
    }

    function parseTimestampFromId(idStr) {
        if (!idStr) return null;
        let parts = idStr.split('_');
        if (parts.length >= 2 && !isNaN(parts[1])) {
            return Number(parts[1]);
        }
        return null;
    }

    function generateUniqueId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function barcodeEntriesOf(value) {
        if (Array.isArray(value)) {
            const out = [];
            value.forEach((b, i) => { if (b !== null && b !== undefined) out.push({ barcode: b, index: i }); });
            return out;
        }
        if (value && typeof value === 'object') {
            return Object.keys(value)
                .filter((k) => /^\d+$/.test(k))
                .sort((a, b) => Number(a) - Number(b))
                .map((k) => ({ barcode: value[k], index: Number(k) }))
                .filter((e) => e.barcode !== null && e.barcode !== undefined);
        }
        return [];
    }

    function normalizeBarcodesOf(item) {
        if (!item || typeof item !== 'object') return item;
        if (item.barcodes === null || item.barcodes === undefined) return item;
        const list = barcodeEntriesOf(item.barcodes)
            .filter((e) => e.barcode && typeof e.barcode === 'object')
            .map((e) => ({ ...e.barcode }));
        if (!list.length && !Array.isArray(item.barcodes)) {
            delete item.barcodes;
            return item;
        }
        item.barcodes = list;
        return item;
    }

    function stripHistoryOnlyMarkers(item) {
        if (!item || typeof item !== 'object') return item;
        delete item.clearClaim;
        delete item.restoreClaim;
        delete item.restoreClaimId;
        delete item.restoreClaimToken;
        return item;
    }

    function itemHasRestoreMarkers(item) {
        return !!(item && (item.restoreClaimId !== undefined || item.restoreClaimToken !== undefined));
    }

    function dropStaleRestoreMarkers(currentItem) {
        if (!itemHasRestoreMarkers(currentItem)) return false;
        if (dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return false;
        const sourceId = currentItem.restoreClaimId;
        if (typeof sourceId === 'string' && activeRestoreClaims.has(sourceId)) return false;
        const source = (typeof sourceId === 'string')
            ? deletedItems.find((entry) => entry && entry.id === sourceId)
            : null;
        if (source && isActiveRestoreClaim(source.restoreClaim)) return false;
        delete currentItem.restoreClaimId;
        delete currentItem.restoreClaimToken;
        return true;
    }

    function applyBarcodeCloseState(barcode, closed, at) {
        if (!barcode || typeof barcode !== 'object') return barcode;
        barcode.isClosed = !!closed;
        if (closed) barcode.closedAt = at;
        else delete barcode.closedAt;
        return barcode;
    }

    function barcodeCloseIsRipe(barcode, now) {
        return !!(barcode && barcode.isClosed && typeof barcode.closedAt === 'number' && (now - barcode.closedAt) > TWO_HOURS_MS);
    }

    function normalizeBarcodeCloseStamps(item, now) {
        if (!item || !Array.isArray(item.barcodes)) return false;
        let changed = false;
        item.barcodes.forEach((b) => {
            if (!b || typeof b !== 'object') return;
            if (b.isClosed) {
                if (typeof b.closedAt !== 'number') {
                    b.closedAt = (typeof item.closedAt === 'number') ? item.closedAt : now;
                    changed = true;
                }
            } else if (b.closedAt !== undefined) {
                delete b.closedAt;
                changed = true;
            }
        });
        return changed;
    }

    function sanitizeInput(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    const TOAST_LIFETIME_MS = 3000;
    const TOAST_LIVE_LIMIT_MS = 20000;
    const TOAST_CLASSES = { info: 'toast-info', success: 'toast-success', warn: 'toast-warn', error: 'toast-error' };
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

    function reannounceOrShowToast(msg) {
        const container = document.getElementById('toastContainer');
        const items = container && typeof container.querySelectorAll === 'function'
            ? container.querySelectorAll('.toast')
            : [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].textContent !== msg) continue;
            items[i].classList.add('show');
            armToastDismiss(items[i], TOAST_LIFETIME_MS);
            return items[i];
        }
        return showToast(msg);
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
        if (key === 'signin' && (sessionExpiryCheck === 'expired' || !auth || !auth.currentUser)) {
            return sessionExpiryCheck === 'expired'
                ? { msg: SESSION_EXPIRED_TOAST, kind: 'warn', settled: true }
                : { msg: SESSION_SIGNED_OUT_TOAST, kind: 'warn', settled: true };
        }
        if (navigator.onLine === false) {
            return key === 'signin'
                ? { msg: '⚠️ ចូលប្រព័ន្ធរួច តែឧបករណ៍ក្រៅបណ្ដាញ — លេខដែលអ្នកឃើញមិនទាន់សម័យ', kind: 'warn', settled: false }
                : { msg: '⚠️ រក្សាទុក Config រួច តែឧបករណ៍ក្រៅបណ្ដាញ — មិនទាន់ភ្ជាប់ Server ទេ', kind: 'warn', settled: false };
        }
        if (!isDatabaseConnected) {
            return { msg: '🔄 កំពុងតភ្ជាប់ទៅ Server...', kind: 'info', settled: false };
        }
        if (key === 'config') {
            return { msg: '✅ ភ្ជាប់ Server រួចរាល់!', kind: 'success', settled: true };
        }
        if (dbListenersFailed) {
            return { msg: '⚠️ ចូលប្រព័ន្ធរួច តែការទាញទិន្នន័យដាច់ — កំពុងព្យាយាមឡើងវិញ', kind: 'warn', settled: false };
        }
        if (dbListenerPendingPaths.size) {
            return { msg: '🔄 ចូលប្រព័ន្ធរួច — កំពុងទាញទិន្នន័យ...', kind: 'info', settled: false };
        }
        if (sessionExpiryCheck === 'pending') {
            return { msg: '🔄 ចូលប្រព័ន្ធរួច — កំពុងផ្ទៀងផ្ទាត់វគ្គ...', kind: 'info', settled: false };
        }
        return { msg: '✅ ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យទាន់សម័យ', kind: 'success', settled: true };
    }

    const APP_TIME_ZONE = 'Asia/Phnom_Penh';
    const APP_TIME_ZONE_OFFSET_MINUTES = 420;

    function appZoneParts(ms) {
        const at = typeof ms === 'number' ? ms : Number(ms);
        try {
            const parts = {};
            new Intl.DateTimeFormat('en-GB', {
                timeZone: APP_TIME_ZONE, hour12: false,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }).formatToParts(at).forEach((p) => { if (p.type !== 'literal') parts[p.type] = p.value; });
            if (parts.year && parts.month && parts.day) {
                if (parts.hour === '24') parts.hour = '00';
                return parts;
            }
        } catch (e) {}
        const shifted = new Date(at + APP_TIME_ZONE_OFFSET_MINUTES * 60000);
        return {
            year: String(shifted.getUTCFullYear()),
            month: String(shifted.getUTCMonth() + 1).padStart(2, '0'),
            day: String(shifted.getUTCDate()).padStart(2, '0'),
            hour: String(shifted.getUTCHours()).padStart(2, '0'),
            minute: String(shifted.getUTCMinutes()).padStart(2, '0'),
            second: String(shifted.getUTCSeconds()).padStart(2, '0')
        };
    }

    function getZoneDateKey(ms, dayOffset) {
        const parts = appZoneParts(ms);
        const base = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
        const shifted = new Date(base + (dayOffset || 0) * 86400000);
        return shifted.getUTCFullYear() + '-'
            + String(shifted.getUTCMonth() + 1).padStart(2, '0') + '-'
            + String(shifted.getUTCDate()).padStart(2, '0');
    }

    function getFormattedClockTime(ms) {
        const parts = appZoneParts(ms);
        return parts.hour + ':' + parts.minute + ':' + parts.second;
    }

    function formatScanStamp(raw) {
        const text = String(raw === undefined || raw === null ? '' : raw).trim();
        if (!text) return '';
        const parts = text.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*\((\d{4}-\d{2}-\d{2})\)$/);
        if (!parts) return text;
        return parts[2] + ' ' + parts[1];
    }

    function getFormattedDate(d = new Date(getServerNow())) {
        return getZoneDateKey(d instanceof Date ? d.getTime() : Number(d), 0);
    }

    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    function safeFocusScanner() {
        if (appIsLocked) return;
        if (!isModalOpen && !isMobileDevice()) {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
                return;
            }
            const hwInput = document.getElementById('hwScannerInput');
            if (hwInput) {
                hwInput.focus();
            }
        }
    }

    window.addEventListener('load', function () {
        if (window.ZoeErrors) ZoeErrors.init('zoew');
        if (window.ZoeLicense) window.ZoeLicense.syncServerTime().catch(() => {});
        applySetupLinkFromUrl();
        initFirebase();
        prefetchCustomerDataTableRowsIfConfigured();

        setInterval(() => {
            prefetchCustomerDataTableRowsIfConfigured();
        }, CUSTOMER_TABLE_CACHE_MS);

        setInterval(runSessionExpiryCheck, 60000);

        setInterval(runPeriodicLicenseCheck, LICENSE_RECHECK_INTERVAL_MS);

        setInterval(sweepRecallHighlights, 60000);
        setInterval(runScheduledCleanup, 60000);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            sweepRecallHighlights();
            runScheduledCleanup();
        });

        (function waitForZXingThenInitScanEngine(deadline) {
            deadline = deadline || (Date.now() + 15000);
            if (scanEngineReady()) { initScanEngine(); return; }
            if (Date.now() >= deadline) {
                showToast('⚠️ មិនអាចផ្ទុកម៉ាស៊ីនស្កេន Barcode បានទេ! កាមេរ៉ាអាចនឹងប្រើការមិនកើត សូម Refresh ទំព័រ ឬប្រើម៉ាស៊ីនស្កេន/វាយបញ្ចូលដោយដៃ');
                return;
            }
            setTimeout(() => waitForZXingThenInitScanEngine(deadline), 300);
        })();

        if ('BarcodeDetector' in window) {
            try {
                nativeDetector = new BarcodeDetector({ formats: NATIVE_SCAN_FORMAT_NAMES });
            } catch (e) {
                nativeDetector = null;
            }
        }

        setupHardwareScanner();
        setupConnectionRecovery();
        switchAppPage('data');
        initBiometricUi();
        setupSwipeGestures();
        setupChromeAutoHide();
        setupAdaptivePerformance();
        setupIOSPullToRefresh();
        setupVisibilityHandling();
        updateRecentPhonesList();
        setupPhoneSuggestions();
        setupSheetImportDropZone();

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.more-btn') && !e.target.closest('.header-more-btn') && !e.target.closest('#globalMoreMenu')) {
                closeGlobalMoreMenu();
            }
            safeFocusScanner();
        });

        window.addEventListener('scroll', closeGlobalMoreMenu, true);
        window.addEventListener('resize', closeGlobalMoreMenu);

        document.addEventListener('click', (e) => {
            if (e.target && e.target.classList && e.target.classList.contains('modal') && e.target.style.display === 'flex') {
                dismissModal(e.target);
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const openModals = Array.from(document.querySelectorAll('.modal')).filter(m => m.style.display === 'flex');
            const openModalEl = topmostModal(openModals);
            if (openModalEl) { dismissModal(openModalEl); return; }
            if (isSideDrawerOpen()) closeSideDrawer();
        });

        revealAppAfterBoot();
    });

    function topmostModal(openModals) {
        let top = null;
        let topZ = -Infinity;
        openModals.forEach((m) => {
            const parsed = parseInt(window.getComputedStyle(m).zIndex, 10);
            const z = isNaN(parsed) ? 0 : parsed;
            if (z >= topZ) { topZ = z; top = m; }
        });
        return top;
    }

    function dismissModal(modalEl) {
        if (!modalEl || modalEl.hasAttribute('data-nodismiss')) return;
        const fnName = modalEl.getAttribute('data-close');
        if (fnName && typeof window[fnName] === 'function') {
            window[fnName]();
        } else {
            closeModal(modalEl.id);
        }
    }

    function ledgerNumber(value) {
        const n = parseFloat(value);
        return isFinite(n) ? n : 0;
    }

    function ledgerAppliedDelta(before, after) {
        return {
            cod: Math.round((ledgerNumber(after.codDollar) - ledgerNumber(before.codDollar)) * 100) / 100,
            dod: Math.round((ledgerNumber(after.dodDollar) - ledgerNumber(before.dodDollar)) * 100) / 100,
            count: ledgerNumber(after.totalCount) - ledgerNumber(before.totalCount)
        };
    }

    function addRevenueToDailyAndMonthlyRecord(scanDateStr, codToAdd, dodToAdd, countToAdd) {
        if (!scanDateStr) scanDateStr = getFormattedDate();

        if (!dailyRevenueData[scanDateStr]) {
            dailyRevenueData[scanDateStr] = { codDollar: 0, dodDollar: 0, totalCount: 0 };
        }

        const beforeDaily = { ...dailyRevenueData[scanDateStr] };

        dailyRevenueData[scanDateStr].codDollar = Math.round(((parseFloat(dailyRevenueData[scanDateStr].codDollar) || 0) + (parseFloat(codToAdd) || 0)) * 100) / 100;
        dailyRevenueData[scanDateStr].dodDollar = Math.round(((parseFloat(dailyRevenueData[scanDateStr].dodDollar) || 0) + (parseFloat(dodToAdd) || 0)) * 100) / 100;
        dailyRevenueData[scanDateStr].totalCount = (parseFloat(dailyRevenueData[scanDateStr].totalCount) || 0) + (parseFloat(countToAdd) || 0);

        if (dailyRevenueData[scanDateStr].codDollar < 0) dailyRevenueData[scanDateStr].codDollar = 0;
        if (dailyRevenueData[scanDateStr].dodDollar < 0) dailyRevenueData[scanDateStr].dodDollar = 0;
        if (dailyRevenueData[scanDateStr].totalCount < 0) dailyRevenueData[scanDateStr].totalCount = 0;

        commitDailyRevenueDelta(scanDateStr, codToAdd, dodToAdd, countToAdd,
            ledgerAppliedDelta(beforeDaily, dailyRevenueData[scanDateStr]));

        let ymKey = scanDateStr.substring(0, 7);
        if (!monthlyRevenueData[ymKey]) {
            monthlyRevenueData[ymKey] = { codDollar: 0, dodDollar: 0, totalCount: 0 };
        }

        const beforeMonthly = { ...monthlyRevenueData[ymKey] };

        monthlyRevenueData[ymKey].codDollar = Math.round(((parseFloat(monthlyRevenueData[ymKey].codDollar) || 0) + (parseFloat(codToAdd) || 0)) * 100) / 100;
        monthlyRevenueData[ymKey].dodDollar = Math.round(((parseFloat(monthlyRevenueData[ymKey].dodDollar) || 0) + (parseFloat(dodToAdd) || 0)) * 100) / 100;
        monthlyRevenueData[ymKey].totalCount = (parseFloat(monthlyRevenueData[ymKey].totalCount) || 0) + (parseFloat(countToAdd) || 0);

        if (monthlyRevenueData[ymKey].codDollar < 0) monthlyRevenueData[ymKey].codDollar = 0;
        if (monthlyRevenueData[ymKey].dodDollar < 0) monthlyRevenueData[ymKey].dodDollar = 0;
        if (monthlyRevenueData[ymKey].totalCount < 0) monthlyRevenueData[ymKey].totalCount = 0;

        commitMonthlyRevenueDelta(ymKey, codToAdd, dodToAdd, countToAdd,
            ledgerAppliedDelta(beforeMonthly, monthlyRevenueData[ymKey]));
    }

    function commitDailyRevenueDelta(scanDateStr, codToAdd, dodToAdd, countToAdd, appliedDelta) {
        if (!dbRefDailyRevenue) return;
        const applied = appliedDelta || { cod: ledgerNumber(codToAdd), dod: ledgerNumber(dodToAdd), count: ledgerNumber(countToAdd) };
        const recordRef = dailyRevenueData[scanDateStr];
        const dateRef = fb.ref(db, `zoew_daily_revenue_cod_dod/${scanDateStr}`);
        fb.runTransaction(dateRef, (current) => {
            let codDollar = Math.round(((parseFloat(current && current.codDollar) || 0) + (parseFloat(codToAdd) || 0)) * 100) / 100;
            let dodDollar = Math.round(((parseFloat(current && current.dodDollar) || 0) + (parseFloat(dodToAdd) || 0)) * 100) / 100;
            let totalCount = (parseFloat(current && current.totalCount) || 0) + (parseFloat(countToAdd) || 0);
            if (codDollar < 0 || dodDollar < 0 || totalCount < 0) {
                if (window.ZoeErrors) ZoeErrors.capture(new Error('Daily revenue underflow clamped to 0'), { context: scanDateStr, codDollar, dodDollar, totalCount });
            }
            if (codDollar < 0) codDollar = 0;
            if (dodDollar < 0) dodDollar = 0;
            if (totalCount < 0) totalCount = 0;
            return { codDollar, dodDollar, totalCount };
        }).catch(() => {
            if (recordRef && dailyRevenueData[scanDateStr] === recordRef) {
                recordRef.codDollar = Math.round((ledgerNumber(recordRef.codDollar) - applied.cod) * 100) / 100;
                recordRef.dodDollar = Math.round((ledgerNumber(recordRef.dodDollar) - applied.dod) * 100) / 100;
                recordRef.totalCount = ledgerNumber(recordRef.totalCount) - applied.count;
                if (recordRef.codDollar < 0) recordRef.codDollar = 0;
                if (recordRef.dodDollar < 0) recordRef.dodDollar = 0;
                if (recordRef.totalCount < 0) recordRef.totalCount = 0;
                refreshCurrentHistoryView();
            }
            showToast("⚠️ បរាជ័យក្នុងការ Save Daily Revenue!");
        });
    }

    function commitMonthlyRevenueDelta(ymKey, codToAdd, dodToAdd, countToAdd, appliedDelta) {
        if (!dbRefMonthlyRevenue) return;
        const applied = appliedDelta || { cod: ledgerNumber(codToAdd), dod: ledgerNumber(dodToAdd), count: ledgerNumber(countToAdd) };
        const recordRef = monthlyRevenueData[ymKey];
        fb.runTransaction(dbRefMonthlyRevenue, (current) => {
            const months = (current && typeof current === 'object') ? current : {};
            const existing = months[ymKey] || {};
            let codDollar = Math.round(((parseFloat(existing.codDollar) || 0) + (parseFloat(codToAdd) || 0)) * 100) / 100;
            let dodDollar = Math.round(((parseFloat(existing.dodDollar) || 0) + (parseFloat(dodToAdd) || 0)) * 100) / 100;
            let totalCount = (parseFloat(existing.totalCount) || 0) + (parseFloat(countToAdd) || 0);
            if (codDollar < 0 || dodDollar < 0 || totalCount < 0) {
                if (window.ZoeErrors) ZoeErrors.capture(new Error('Monthly revenue underflow clamped to 0'), { context: ymKey, codDollar, dodDollar, totalCount });
            }
            if (codDollar < 0) codDollar = 0;
            if (dodDollar < 0) dodDollar = 0;
            if (totalCount < 0) totalCount = 0;
            months[ymKey] = { codDollar, dodDollar, totalCount };

            const latestThreeMonths = {};
            Object.keys(months).sort().reverse().slice(0, 3).forEach((key) => {
                latestThreeMonths[key] = months[key];
            });
            return latestThreeMonths;
        }).catch(() => {
            if (recordRef && monthlyRevenueData[ymKey] === recordRef) {
                recordRef.codDollar = Math.round((ledgerNumber(recordRef.codDollar) - applied.cod) * 100) / 100;
                recordRef.dodDollar = Math.round((ledgerNumber(recordRef.dodDollar) - applied.dod) * 100) / 100;
                recordRef.totalCount = ledgerNumber(recordRef.totalCount) - applied.count;
                if (recordRef.codDollar < 0) recordRef.codDollar = 0;
                if (recordRef.dodDollar < 0) recordRef.dodDollar = 0;
                if (recordRef.totalCount < 0) recordRef.totalCount = 0;
            }
            showToast("⚠️ បរាជ័យក្នុងការ Save Monthly Revenue!");
        });
    }

    function getPickupPhoneKey(item) {
        const rawPhone = item && item.phone;
        if (!rawPhone || rawPhone === "គ្មានលេខ") return '__item_' + (item && item.id);
        const safePhone = String(rawPhone).replace(/[^a-zA-Z0-9_-]/g, '_');
        return safePhone || ('__item_' + (item && item.id));
    }

    function closedBarcodeCount(item) {
        if (!item) return 0;
        if (item.barcodes && Array.isArray(item.barcodes)) {
            return item.barcodes.filter(b => b && b.isClosed).length;
        }
        return item.isClosed ? (parseFloat(item.count) || 1) : 0;
    }

    function countPickedUpCustomers(record) {
        return record && record.pickedUpPhones ? Object.keys(record.pickedUpPhones).length : 0;
    }

    function planPickupLedgerRepair(ledger, historyItems, trashItems) {
        const plans = [];
        if (!ledger) return plans;
        const byDate = {};
        const collect = (list) => {
            (list || []).forEach((item) => {
                if (!item || !item.scanDate) return;
                const closed = closedBarcodeCount(item);
                if (!closed) return;
                const key = getPickupPhoneKey(item);
                const bucket = byDate[item.scanDate] || (byDate[item.scanDate] = { phones: {}, total: 0 });
                bucket.phones[key] = (bucket.phones[key] || 0) + closed;
                bucket.total += closed;
            });
        };
        collect(historyItems);
        collect(trashItems);

        Object.keys(ledger).forEach((date) => {
            const record = ledger[date];
            if (!record || typeof record !== 'object') return;
            const recordedPackages = parseFloat(record.packagesPickedUp) || 0;
            const bucket = byDate[date] || { phones: {}, total: 0 };
            if (bucket.total !== recordedPackages) return;
            const current = record.pickedUpPhones || {};
            const nextKeys = Object.keys(bucket.phones);
            const sameSize = nextKeys.length === Object.keys(current).length;
            const sameValues = nextKeys.every((k) => (parseFloat(current[k]) || 0) === bucket.phones[k]);
            if (sameSize && sameValues) return;
            plans.push({ date: date, pickedUpPhones: bucket.phones });
        });
        return plans;
    }

    async function repairPickupLedgerOnce() {
        if (pickupLedgerRepairDone || pickupLedgerRepairRunning) return;
        if (!db || !fb || !auth || !auth.currentUser) return;
        if (dbListenerPendingPaths.size || dbListenersFailed) return;
        pickupLedgerRepairRunning = true;
        try {
            const plans = planPickupLedgerRepair(dailyPickupData, scanHistory, deletedItems);
            for (const plan of plans) {
                if (!/^[0-9-]+$/.test(plan.date)) continue;
                const dayRef = fb.ref(db, `zoew_daily_pickup_cod_dod/${plan.date}`);
                await dbOp(fb.runTransaction(dayRef, (record) => {
                    if (!record) return record;
                    const recorded = parseFloat(record.packagesPickedUp) || 0;
                    const nextSum = Object.keys(plan.pickedUpPhones)
                        .reduce((sum, k) => sum + plan.pickedUpPhones[k], 0);
                    if (nextSum !== recorded) return record;
                    record.pickedUpPhones = Object.keys(plan.pickedUpPhones).length
                        ? { ...plan.pickedUpPhones }
                        : null;
                    return record;
                })).catch(() => {});
            }
            pickupLedgerRepairDone = true;
        } catch (e) {
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'repairPickupLedgerOnce' });
        } finally {
            pickupLedgerRepairRunning = false;
        }
    }

    function addPickupToDailyRecord(scanDateStr, phoneKey, customerRefDelta, packagesToAdd) {
        if (!scanDateStr) scanDateStr = getFormattedDate();

        if (!dailyPickupData[scanDateStr]) {
            dailyPickupData[scanDateStr] = { packagesPickedUp: 0, pickedUpPhones: {} };
        }
        const record = dailyPickupData[scanDateStr];
        if (!record.pickedUpPhones) record.pickedUpPhones = {};

        const beforePackages = ledgerNumber(record.packagesPickedUp);
        const beforeRefCount = phoneKey ? ledgerNumber(record.pickedUpPhones[phoneKey]) : 0;

        record.packagesPickedUp = beforePackages + ledgerNumber(packagesToAdd);
        if (record.packagesPickedUp < 0) record.packagesPickedUp = 0;

        if (phoneKey && customerRefDelta) {
            const refCount = beforeRefCount + customerRefDelta;
            if (refCount <= 0) delete record.pickedUpPhones[phoneKey];
            else record.pickedUpPhones[phoneKey] = refCount;
        }

        const applied = {
            packages: record.packagesPickedUp - beforePackages,
            customer: phoneKey ? (ledgerNumber(record.pickedUpPhones[phoneKey]) - beforeRefCount) : 0
        };

        commitDailyPickupDelta(scanDateStr, phoneKey, customerRefDelta, packagesToAdd, applied);
    }

    function requestPinBeforeResetPickup() {
        requestPinBeforeConfig(resetPickupStats, 'resetPickup');
    }

    async function resetPickupStats() {
        if (pickupResetInFlight) return;
        const filterLabel = getCurrentFilterLabel();
        const targetDates = getPickupResetTargetDates();
        if (!targetDates.length) {
            showToast(`⚠️ គ្មានទិន្នន័យ «យករួច» ក្នុងតម្រង «${filterLabel}» ដើម្បី Reset ទេ។`);
            return;
        }
        const currentCustomers = targetDates.reduce((sum, d) => sum + countPickedUpCustomers(dailyPickupData[d]), 0);
        const currentPackages = targetDates.reduce((sum, d) => sum + (parseFloat((dailyPickupData[d] || {}).packagesPickedUp) || 0), 0);
        if (!currentCustomers && !currentPackages) {
            showToast(`⚠️ តម្រង «${filterLabel}» មានចំនួនយករួច 0 រួចជាស្រេច — គ្មានអ្វីត្រូវ Reset ទេ។`);
            return;
        }
        const scopeNote = currentFilterMode === 'all'
            ? `ទិន្នន័យ ${targetDates.length} ថ្ងៃ`
            : `ថ្ងៃផ្សេងមិនប៉ះពាល់ទេ`;
        if (!confirm(`តើអ្នកពិតជាចង់ Reset ចំនួនអតិថិជនយក (${currentCustomers}) និងចំនួនកញ្ចប់យក (${currentPackages}) ក្នុងតម្រង «${filterLabel}» ទៅ 0 មែនទេ?\n\n· ${scopeNote}\n· ទឹកប្រាក់ COD/DOD និងបញ្ជីកញ្ចប់ មិនប្តូរទេ`)) return;
        if (!dbRefDailyPickup || !db || !fb) {
            showToast("⚠️ មិនអាច Reset បានទេ! សូមពិនិត្យការតភ្ជាប់ Firebase ហើយសាកល្បងម្តងទៀត។");
            return;
        }

        pickupResetInFlight = true;
        let doneCount = 0;
        let failedCount = 0;
        let stalled = false;
        try {
            for (const dateKey of targetDates) {
                try {
                    await dbOp(fb.runTransaction(fb.ref(db, `zoew_daily_pickup_cod_dod/${dateKey}`), () => ({ packagesPickedUp: 0 })));
                    dailyPickupData[dateKey] = { packagesPickedUp: 0, pickedUpPhones: {} };
                    doneCount++;
                } catch (e) {
                    failedCount++;
                    if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'resetPickupStats', date: dateKey });
                    if (dbOpStalled(e)) { stalled = true; break; }
                }
            }
        } finally {
            pickupResetInFlight = false;
        }

        refreshCurrentHistoryView();
        if (stalled) {
            showToast(doneCount
                ? `⚠️ បណ្តាញឆ្លើយមិនចេញ — Reset បានតែ ${doneCount} ថ្ងៃ។ សូមពិនិត្យអ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។`
                : "⚠️ បណ្តាញឆ្លើយមិនចេញ — Reset មិនបានទេ។ សូមពិនិត្យអ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។");
        } else if (failedCount && !doneCount) {
            showToast("❌ Reset បរាជ័យទាំងស្រុង! សូមពិនិត្យការតភ្ជាប់ ហើយសាកល្បងម្តងទៀត។");
        } else if (failedCount) {
            showToast(`⚠️ Reset បានតែ ${doneCount} ថ្ងៃ — ${failedCount} ថ្ងៃបរាជ័យ។ សូមសាកល្បងម្តងទៀត។`);
        } else {
            showToast(`✅ Reset ចំនួនអតិថិជន និងកញ្ចប់យករួច ក្នុងតម្រង «${filterLabel}» ជោគជ័យ!`);
        }
    }

    function commitDailyPickupDelta(scanDateStr, phoneKey, customerRefDelta, packagesToAdd, appliedDelta) {
        if (!dbRefDailyPickup) return;
        const applied = appliedDelta || { packages: ledgerNumber(packagesToAdd), customer: ledgerNumber(customerRefDelta) };
        const recordRef = dailyPickupData[scanDateStr];
        const dateRef = fb.ref(db, `zoew_daily_pickup_cod_dod/${scanDateStr}`);
        fb.runTransaction(dateRef, (current) => {
            const record = (current && typeof current === 'object') ? current : {};
            const pickedUpPhones = (record.pickedUpPhones && typeof record.pickedUpPhones === 'object') ? { ...record.pickedUpPhones } : {};
            let packagesPickedUp = (parseFloat(record.packagesPickedUp) || 0) + (parseFloat(packagesToAdd) || 0);
            if (packagesPickedUp < 0) {
                if (window.ZoeErrors) ZoeErrors.capture(new Error('Daily pickup underflow clamped to 0'), { context: scanDateStr, packagesPickedUp });
                packagesPickedUp = 0;
            }
            if (phoneKey && customerRefDelta) {
                const refCount = (parseFloat(pickedUpPhones[phoneKey]) || 0) + customerRefDelta;
                if (refCount <= 0) delete pickedUpPhones[phoneKey];
                else pickedUpPhones[phoneKey] = refCount;
            }
            return { packagesPickedUp, pickedUpPhones };
        }).catch(() => {
            if (recordRef && dailyPickupData[scanDateStr] === recordRef) {
                recordRef.packagesPickedUp = ledgerNumber(recordRef.packagesPickedUp) - applied.packages;
                if (recordRef.packagesPickedUp < 0) recordRef.packagesPickedUp = 0;
                if (phoneKey && applied.customer) {
                    if (!recordRef.pickedUpPhones) recordRef.pickedUpPhones = {};
                    const refCount = ledgerNumber(recordRef.pickedUpPhones[phoneKey]) - applied.customer;
                    if (refCount <= 0) delete recordRef.pickedUpPhones[phoneKey];
                    else recordRef.pickedUpPhones[phoneKey] = refCount;
                }
                refreshCurrentHistoryView();
            }
            showToast("⚠️ បរាជ័យក្នុងការ Save Daily Pickup!");
        });
    }

    function isMonthKeyRetained(ymKey) {
        const keys = new Set(Object.keys(monthlyRevenueData));
        keys.add(ymKey);
        const latestThreeKeys = Array.from(keys).sort().reverse().slice(0, 3);
        return latestThreeKeys.includes(ymKey);
    }

    function openManualAdjustModal() {
        const manualDateInput = document.getElementById('manualDateInput');
        if(manualDateInput) manualDateInput.value = getFormattedDate();
        const codChangeIn = document.getElementById('manualCodChangeInput');
        if(codChangeIn) codChangeIn.value = '';
        const dodChangeIn = document.getElementById('manualDodChangeInput');
        if(dodChangeIn) dodChangeIn.value = '';
        const countChangeIn = document.getElementById('manualCountChangeInput');
        if(countChangeIn) countChangeIn.value = '';
        const submitBtn = document.getElementById('manualAdjustSubmitBtn');
        if(submitBtn) submitBtn.disabled = false;
        openModalHelper('manualAdjustModal');
    }

    function submitManualAdjustment() {
        const submitBtn = document.getElementById('manualAdjustSubmitBtn');
        if (submitBtn && submitBtn.disabled) return;

        const dateInputEl = document.getElementById('manualDateInput');
        const codChangeEl = document.getElementById('manualCodChangeInput');
        const dodChangeEl = document.getElementById('manualDodChangeInput');
        const countChangeEl = document.getElementById('manualCountChangeInput');

        let dateVal = sanitizeInput(dateInputEl ? dateInputEl.value.trim() : '');
        let codChange = codChangeEl ? (parseFloat(codChangeEl.value) || 0) : 0;
        let dodChange = dodChangeEl ? (parseFloat(dodChangeEl.value) || 0) : 0;
        let countChange = countChangeEl ? (parseInt(countChangeEl.value) || 0) : 0;

        const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
        if (!dateVal || !dateRegex.test(dateVal)) {
            alert("សូមបញ្ចូលកាលបរិច្ឆេទឱ្យបានត្រឹមត្រូវតាមទម្រង់ YYYY-MM-DD (ឧ. 2026-06-05)!");
            return;
        }
        const [adjYear, adjMonth, adjDay] = dateVal.split('-').map(Number);
        const adjParsedDate = new Date(adjYear, adjMonth - 1, adjDay);
        if (adjParsedDate.getFullYear() !== adjYear || adjParsedDate.getMonth() !== adjMonth - 1 || adjParsedDate.getDate() !== adjDay) {
            alert("កាលបរិច្ឆេទមិនត្រឹមត្រូវទេ! សូមពិនិត្យខែ/ថ្ងៃម្តងទៀត (ឧ. ខែកុម្ភៈគ្មានថ្ងៃទី 30 ទេ)។");
            return;
        }

        const adjYmKey = dateVal.substring(0, 7);
        if (!isMonthKeyRetained(adjYmKey)) {
            if (!confirm("⚠️ ខែនេះលើសពីរយៈពេលរក្សាទុក ៣ខែ ការកែប្រែនឹងមិនត្រូវបានរក្សាទុកទេ! (ប្រព័ន្ធរក្សាទុកតែ ៣ ខែចុងក្រោយប៉ុណ្ណោះ) តើអ្នកចង់បន្តទេ?")) {
                return;
            }
        }

        if (submitBtn) submitBtn.disabled = true;
        addRevenueToDailyAndMonthlyRecord(dateVal, codChange, dodChange, countChange);

        closeModal('manualAdjustModal');
        showToast("កែប្រែស្ថិតិ COD, DOD និងកញ្ចប់ដោយដៃបានជោគជ័យ!");
        refreshCurrentHistoryView();
    }

    function openDailyStatsModal() {
        const container = document.getElementById('dailyStatsContainer');
        if(!container) return;
        container.innerHTML = '';

        let sortedKeys = Object.keys(dailyRevenueData).sort().reverse();

        if (sortedKeys.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: #888; padding: 12px;">គ្មានទិន្នន័យប្រចាំថ្ងៃទេ</p>`;
        } else {
            sortedKeys.forEach(dateStr => {
                let data = dailyRevenueData[dateStr] || {};
                let cod = parseFloat(data.codDollar) || 0;
                let dod = parseFloat(data.dodDollar) || 0;
                let totalD = Math.round((cod + dod) * 100) / 100;
                let riel = Math.round(totalD * exchangeRateRiel);
                let count = parseFloat(data.totalCount) || 0;

                let div = document.createElement('div');
                div.className = 'stat-card-item';
                div.innerHTML = `
                    <div class="m-title">📅 ថ្ងៃទី៖ ${sanitizeInput(dateStr)}</div>
                    <div class="m-details">
                        <span>កញ្ចប់សរុប៖ <strong>${count}</strong></span>
                        <span>COD: <strong style="color:var(--accent-blue);">$${cod.toFixed(2)}</strong> | DOD: <strong style="color:var(--accent-purple);">$${dod.toFixed(2)}</strong></span>
                    </div>
                    <div style="font-size: calc(10 * var(--fs-unit)); color: var(--text-muted); text-align: right; margin-top: 3px;">
                        សរុប៖ <strong style="color:var(--primary);">$${totalD.toFixed(2)}</strong> (${riel.toLocaleString()} ៛)
                    </div>
                `;
                container.appendChild(div);
            });
        }

        openModalHelper('dailyStatsModal');
    }

    function openMonthlyStatsModal() {
        const container = document.getElementById('monthlyStatsContainer');
        if(!container) return;
        container.innerHTML = '';

        let sortedKeys = Object.keys(monthlyRevenueData).sort().reverse();

        if (sortedKeys.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: #888; padding: 12px;">គ្មានទិន្នន័យចំណូលប្រចាំខែទេ</p>`;
        } else {
            sortedKeys.forEach(ym => {
                let data = monthlyRevenueData[ym] || {};
                let cod = parseFloat(data.codDollar) || 0;
                let dod = parseFloat(data.dodDollar) || 0;
                let totalD = Math.round((cod + dod) * 100) / 100;
                let riel = Math.round(totalD * exchangeRateRiel);
                let count = parseFloat(data.totalCount) || 0;

                let div = document.createElement('div');
                div.className = 'stat-card-item';
                div.innerHTML = `
                    <div class="m-title">📅 ខែ៖ ${sanitizeInput(ym)}</div>
                    <div class="m-details">
                        <span>កញ្ចប់សរុប៖ <strong>${count}</strong></span>
                        <span>COD: <strong style="color:var(--accent-blue);">$${cod.toFixed(2)}</strong> | DOD: <strong style="color:var(--accent-purple);">$${dod.toFixed(2)}</strong></span>
                    </div>
                    <div style="font-size: calc(10 * var(--fs-unit)); color: var(--text-muted); text-align: right; margin-top: 3px;">
                        សរុប៖ <strong style="color:var(--primary);">$${totalD.toFixed(2)}</strong> (${riel.toLocaleString()} ៛)
                    </div>
                `;
                container.appendChild(div);
            });
        }

        openModalHelper('monthlyStatsModal');
    }

    let currentAppPage = 'data';

    function switchAppPage(page) {
        const target = page === 'entry' ? 'entry' : 'data';
        currentAppPage = target;
        const dataPage = document.getElementById('pageData');
        const entryPage = document.getElementById('pageEntry');
        const dataTab = document.getElementById('pageTabData');
        const entryTab = document.getElementById('pageTabEntry');
        if (dataPage) dataPage.classList.toggle('active', target === 'data');
        if (entryPage) entryPage.classList.toggle('active', target === 'entry');
        if (dataTab) dataTab.classList.toggle('active', target === 'data');
        if (entryTab) entryTab.classList.toggle('active', target === 'entry');

        hidePhoneSuggestions();
        setPhoneSearchPulledUp(false);
        showAppChrome();
        syncHistoryExpandedLock();
        const pages = document.getElementById('appPages');
        if (pages) pages.scrollTop = 0;

        if (target === 'entry') {
            setEntryScanMode(entryScanMode);
            warmZtoLookupProxyNow();
        } else {
            const cameraWasLive = isCameraScanning || isCameraStarting;
            stopCurrentStream();
            if (cameraWasLive) showCameraClosedBox();
            closeConfigQrScanner();
        }
    }

    function openSideDrawer() {
        const drawer = document.getElementById('sideDrawer');
        const backdrop = document.getElementById('drawerBackdrop');
        if (!drawer || !backdrop) return;
        showAppChrome();
        hidePhoneSuggestions();
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
        backdrop.classList.add('open');
    }

    function closeSideDrawer() {
        const drawer = document.getElementById('sideDrawer');
        const backdrop = document.getElementById('drawerBackdrop');
        if (!drawer || !backdrop) return;
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        backdrop.classList.remove('open');
    }

    function isSideDrawerOpen() {
        const drawer = document.getElementById('sideDrawer');
        return !!(drawer && drawer.classList.contains('open'));
    }

    function drawerAction(fn) {
        closeSideDrawer();
        if (typeof fn === 'function') fn();
    }

    function activePanelSections() {
        const entryPage = document.getElementById('pageEntry');
        if (entryPage && entryPage.classList.contains('active')) {
            return {
                side: document.getElementById('entrySideSection'),
                main: document.getElementById('entryMainSection'),
                scroller: entryScrollerInView()
            };
        }
        const dataPage = document.getElementById('pageData');
        if (dataPage && dataPage.classList.contains('active')) {
            return {
                side: document.getElementById('dataSideSection'),
                main: document.getElementById('dataMainSection'),
                scroller: document.getElementById('tableResponsive')
            };
        }
        return { side: null, main: null, scroller: null };
    }

    function entryScrollerInView() {
        const lockerPanel = document.getElementById('lockerPanel');
        const lockerVisible = !!lockerPanel && !lockerPanel.classList.contains('hidden');
        return document.getElementById(lockerVisible ? 'lockerTableResponsive' : 'entryTableResponsive');
    }

    function usesIOSPanelHandoff() {
        return window.navigator && window.navigator.standalone === true &&
            window.CSS && typeof window.CSS.supports === 'function' &&
            window.CSS.supports('-webkit-touch-callout', 'none');
    }

    function syncHistoryExpandedLock() {
        const pages = document.getElementById('appPages');
        if (!pages) return;
        const side = activePanelSections().side;
        const expanded = !!side && side.classList.contains('collapsed');
        const wasExpanded = pages.classList.contains('history-expanded');
        const iosUnlock = wasExpanded && !expanded && usesIOSPanelHandoff();
        if (expanded || iosUnlock) pages.scrollTop = 0;
        pages.classList.toggle('history-expanded', expanded);
        if (expanded || iosUnlock) {
            pages.scrollTop = 0;
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => {
                    if (pages.classList.contains('history-expanded') !== expanded) return;
                    pages.scrollTop = 0;
                    if (iosUnlock) {
                        requestAnimationFrame(() => {
                            if (!pages.classList.contains('history-expanded')) pages.scrollTop = 0;
                        });
                    }
                });
            }
        }
    }

    const PANEL_GLIDE_MS = 220;
    const PANEL_GLIDE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const PANEL_GLIDE_SNAP_GRACE_MS = 260;

    function panelMotionAllowed() {
        if (window.innerWidth >= 992) return false;
        if (typeof window.matchMedia !== 'function') return true;
        return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    let panelGlideTokens = 0;
    let panelGlideRelease = null;

    function beginPanelGlideSnapPause() {
        const pages = document.getElementById('appPages');
        if (!pages) return () => {};
        panelGlideTokens++;
        pages.classList.add('panel-gliding');
        if (panelGlideRelease !== null) clearTimeout(panelGlideRelease);
        panelGlideRelease = setTimeout(endPanelGlideSnapPause, PANEL_GLIDE_MS + PANEL_GLIDE_SNAP_GRACE_MS);
        let done = false;
        return () => {
            if (done) return;
            done = true;
            panelGlideTokens--;
            if (panelGlideTokens <= 0) endPanelGlideSnapPause();
        };
    }

    function endPanelGlideSnapPause() {
        panelGlideTokens = 0;
        if (panelGlideRelease !== null) {
            clearTimeout(panelGlideRelease);
            panelGlideRelease = null;
        }
        const pages = document.getElementById('appPages');
        if (pages) pages.classList.remove('panel-gliding');
    }

    function panelGlideFrom(el, beforeTop) {
        if (!el || typeof el.animate !== 'function' || !isFinite(beforeTop)) return;
        if (!panelMotionAllowed()) return;
        const delta = beforeTop - el.getBoundingClientRect().top;
        if (!isFinite(delta) || Math.abs(delta) < 2) return;
        const release = beginPanelGlideSnapPause();
        try {
            const anim = el.animate([
                { transform: 'translate3d(0,' + delta + 'px,0)' },
                { transform: 'translate3d(0,0,0)' }
            ], { duration: PANEL_GLIDE_MS, easing: PANEL_GLIDE_EASING });
            if (anim && anim.finished && typeof anim.finished.then === 'function') anim.finished.then(release, release);
            else if (anim) anim.onfinish = release;
        } catch (e) {
            release();
        }
    }

    function setupSwipeGestures() {
        bindPanelSwipe({
            sideId: 'dataSideSection',
            mainId: 'dataMainSection',
            handleId: 'dragHandle',
            scroller: () => document.getElementById('tableResponsive'),
            blockCollapse: phoneSearchIsActive
        });
        bindPanelSwipe({
            sideId: 'entrySideSection',
            mainId: 'entryMainSection',
            handleId: 'entryDragHandle',
            scroller: entryScrollerInView,
            blockCollapse: () => false
        });
        syncHistoryExpandedLock();
    }

    function phoneSearchIsActive() {
        const box = document.getElementById('phoneSuggestBox');
        if (box && box.classList.contains('show')) return true;
        const input = document.getElementById('searchPhoneInput');
        return !!(input && document.activeElement === input && input.value.trim());
    }

    const iosTouchArbiter = { id: null, phase: 'idle', blockPanel: false };

    function beginIOSTouch(touch) {
        iosTouchArbiter.id = touch.identifier;
        iosTouchArbiter.phase = 'possible';
        iosTouchArbiter.blockPanel = false;
    }

    function blockPanelForIOSTouch(phase) {
        iosTouchArbiter.phase = phase;
        iosTouchArbiter.blockPanel = true;
    }

    function resetIOSTouchArbiter() {
        iosTouchArbiter.id = null;
        iosTouchArbiter.phase = 'idle';
        iosTouchArbiter.blockPanel = false;
    }

    function panelBlockedForTouch(identifier) {
        if (iosTouchArbiter.phase === 'refreshing') return true;
        return iosTouchArbiter.id === identifier && iosTouchArbiter.blockPanel;
    }

    function panelMayYieldToPTR(identifier) {
        return iosTouchArbiter.id === identifier &&
            (iosTouchArbiter.phase === 'tracking' || iosTouchArbiter.phase === 'held' || iosTouchArbiter.phase === 'ptr');
    }

    function touchByIdentifier(list, identifier) {
        if (!list || identifier === null) return null;
        for (let i = 0; i < list.length; i++) {
            if (list[i].identifier === identifier) return list[i];
        }
        return null;
    }

    function bindPanelSwipe(config) {
        const sidebar = document.getElementById(config.sideId);
        const mainSection = document.getElementById(config.mainId);
        if (!sidebar || !mainSection) return;
        const iosPanelHandoff = usesIOSPanelHandoff();

        let startY = 0;
        let startX = 0;
        let isDragging = false;
        let pendingAction = '';
        let mainTouchId = null;
        let scrollerStartY = 0;
        let scrollerStartX = 0;
        let scrollerPendingExpand = false;
        let scrollerTouchId = null;
        let scrollerLastDiffY = 0;
        let scrollerLastDiffX = 0;

        function scrollTopOf() {
            const el = config.scroller();
            return el ? el.scrollTop : 0;
        }

        function scrollerAtTop() {
            return scrollTopOf() <= (iosPanelHandoff ? 1 : 0);
        }

        function applyPanelAction(action) {
            if (!action) return;
            const beforeTop = mainSection.getBoundingClientRect().top;
            if (action === 'collapse') sidebar.classList.add('collapsed');
            else if (action === 'expand') sidebar.classList.remove('collapsed');
            else if (action === 'search') setPhoneSearchPulledUp(false);
            syncHistoryExpandedLock();
            panelGlideFrom(mainSection, beforeTop);
        }

        function actionForMainDiff(diffY, diffX) {
            if (Math.abs(diffY) < Math.abs(diffX) * 1.6) return '';
            if (diffY < -30 && !sidebar.classList.contains('collapsed') && !config.blockCollapse()) return 'collapse';
            if (diffY > 30 && scrollerAtTop() && sidebar.classList.contains('collapsed')) return 'expand';
            if (diffY > 30 && scrollerAtTop() && sidebar.classList.contains('search-focus')) return 'search';
            return '';
        }

        function finishMainSwipe(e, apply) {
            const endedTouchId = mainTouchId;
            const endedTouch = endedTouchId !== null && e.touches.length === 0 ?
                touchByIdentifier(e.changedTouches, endedTouchId) : null;
            const finalDiffY = endedTouch ? endedTouch.clientY - startY : 0;
            const finalDiffX = endedTouch ? endedTouch.clientX - startX : 0;
            if (endedTouch && finalDiffY >= 56 && panelMayYieldToPTR(endedTouchId)) blockPanelForIOSTouch('ptr');
            pendingAction = endedTouch ? actionForMainDiff(finalDiffY, finalDiffX) : '';
            isDragging = false;
            mainTouchId = null;
            const action = pendingAction;
            pendingAction = '';
            if (apply && endedTouch && !panelBlockedForTouch(endedTouchId)) applyPanelAction(action);
        }

        const scrollerTouchStart = (e) => {
            scrollerPendingExpand = false;
            scrollerTouchId = null;
            scrollerLastDiffY = 0;
            scrollerLastDiffX = 0;
            if (e.touches.length !== 1) return;
            scrollerTouchId = e.touches[0].identifier;
            scrollerStartY = e.touches[0].clientY;
            scrollerStartX = e.touches[0].clientX;
        };
        const scrollerTouchMove = (e) => {
            if (e.touches.length !== 1 || window.innerWidth >= 992) {
                scrollerPendingExpand = false;
                scrollerTouchId = null;
                scrollerLastDiffY = 0;
                scrollerLastDiffX = 0;
                return;
            }
            const touch = touchByIdentifier(e.touches, scrollerTouchId);
            if (!touch) {
                scrollerPendingExpand = false;
                scrollerTouchId = null;
                scrollerLastDiffY = 0;
                scrollerLastDiffX = 0;
                return;
            }
            const diffY = touch.clientY - scrollerStartY;
            const diffX = touch.clientX - scrollerStartX;
            scrollerLastDiffY = diffY;
            scrollerLastDiffX = diffX;
            const downward = diffY > 0 && Math.abs(diffY) >= Math.abs(diffX) * 1.6;
            const reachedTop = scrollerAtTop();
            if (iosPanelHandoff && reachedTop && diffY >= 8 && downward &&
                sidebar.classList.contains('collapsed') && e.cancelable) {
                e.preventDefault();
            }
            if (!downward) scrollerPendingExpand = false;
            else if (reachedTop && diffY > 30 && sidebar.classList.contains('collapsed')) scrollerPendingExpand = true;
        };
        const scrollerScroll = () => {
            const downward = scrollerLastDiffY > 30 &&
                Math.abs(scrollerLastDiffY) >= Math.abs(scrollerLastDiffX) * 1.6;
            if (scrollerTouchId !== null && downward && scrollerAtTop() &&
                sidebar.classList.contains('collapsed')) scrollerPendingExpand = true;
        };
        const finishScrollerSwipe = (e, apply) => {
            const endedTouchId = scrollerTouchId;
            const endedTouch = endedTouchId !== null && e.touches.length === 0 ?
                touchByIdentifier(e.changedTouches, endedTouchId) : null;
            const finalDiffY = endedTouch ? endedTouch.clientY - scrollerStartY : 0;
            const finalDiffX = endedTouch ? endedTouch.clientX - scrollerStartX : 0;
            if (endedTouch && finalDiffY >= 56 && panelMayYieldToPTR(endedTouchId)) blockPanelForIOSTouch('ptr');
            const finalDownward = !!endedTouch && finalDiffY > 30 &&
                Math.abs(finalDiffY) >= Math.abs(finalDiffX) * 1.6;
            const shouldExpand = finalDownward && sidebar.classList.contains('collapsed') &&
                (iosPanelHandoff ? (scrollerPendingExpand || scrollerAtTop()) : scrollerAtTop());
            scrollerPendingExpand = false;
            scrollerTouchId = null;
            scrollerLastDiffY = 0;
            scrollerLastDiffX = 0;
            if (apply && shouldExpand && !panelBlockedForTouch(endedTouchId)) applyPanelAction('expand');
        };
        [document.getElementById('tableResponsive'), document.getElementById('entryTableResponsive'),
         document.getElementById('lockerTableResponsive')].forEach((el) => {
            if (!el || !mainSection.contains(el)) return;
            el.addEventListener('touchstart', scrollerTouchStart, { passive: true });
            el.addEventListener('touchmove', scrollerTouchMove, { passive: !iosPanelHandoff });
            if (iosPanelHandoff) el.addEventListener('scroll', scrollerScroll, { passive: true });
            el.addEventListener('touchend', (e) => finishScrollerSwipe(e, true), { passive: true });
            el.addEventListener('touchcancel', (e) => finishScrollerSwipe(e, false), { passive: true });
        });

        mainSection.addEventListener('touchstart', (e) => {
            pendingAction = '';
            mainTouchId = null;
            if (window.innerWidth >= 992 || e.touches.length !== 1) { isDragging = false; return; }
            mainTouchId = e.touches[0].identifier;
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
            isDragging = true;
        }, { passive: true });

        mainSection.addEventListener('touchmove', (e) => {
            if (window.innerWidth >= 992 || e.touches.length !== 1) {
                isDragging = false;
                pendingAction = '';
                mainTouchId = null;
                return;
            }
            if (!isDragging) return;
            const touch = touchByIdentifier(e.touches, mainTouchId);
            if (!touch) { isDragging = false; pendingAction = ''; mainTouchId = null; return; }
            pendingAction = actionForMainDiff(touch.clientY - startY, touch.clientX - startX);
        }, { passive: true });

        mainSection.addEventListener('touchend', (e) => finishMainSwipe(e, true));
        mainSection.addEventListener('touchcancel', (e) => finishMainSwipe(e, false));

        const dragHandle = document.getElementById(config.handleId);
        if (dragHandle) {
            dragHandle.addEventListener('click', () => {
                if (!sidebar.classList.contains('collapsed')) hidePhoneSuggestions();
                setPhoneSearchPulledUp(false);
                const beforeTop = mainSection.getBoundingClientRect().top;
                sidebar.classList.toggle('collapsed');
                syncHistoryExpandedLock();
                panelGlideFrom(mainSection, beforeTop);
            });
        }
    }

    let chromeHidden = false;
    function appChromeElements() {
        return {
            navbar: document.querySelector('.app-navbar'),
            tabbar: document.getElementById('pageTabBar')
        };
    }

    function measureAppChromeSize() {
        const { navbar, tabbar } = appChromeElements();
        if (navbar) {
            const topHeight = navbar.offsetHeight;
            if (topHeight > 0) document.documentElement.style.setProperty('--chrome-top', topHeight + 'px');
        }
        if (tabbar) {
            const pageHeight = document.body.getBoundingClientRect().height;
            const pageExtension = Math.max(0, Math.round(pageHeight - window.innerHeight));
            const bottomHeight = Math.round(tabbar.offsetHeight + pageExtension);
            document.documentElement.style.setProperty('--tabbar-height', Math.round(tabbar.offsetHeight) + 'px');
            document.documentElement.style.setProperty('--page-extension', pageExtension + 'px');
            if (bottomHeight > 0) document.documentElement.style.setProperty('--chrome-bottom', bottomHeight + 'px');
        }
    }

    function showAppChrome() {
        if (chromeHidden) {
            chromeHidden = false;
            document.body.classList.remove('chrome-hidden');
        }
    }

    function hideAppChrome() {
        if (chromeHidden) return;
        if (window.innerWidth >= 992) return;
        if (isModalOpen || isSideDrawerOpen()) return;
        chromeHidden = true;
        document.body.classList.add('chrome-hidden');
    }

    function scrollerOf(target) {
        let node = (target && target.nodeType === 1) ? target : null;
        while (node) {
            if (node.scrollHeight - node.clientHeight > 1) {
                const overflowY = window.getComputedStyle(node).overflowY;
                if (overflowY === 'auto' || overflowY === 'scroll') return node;
            }
            node = node.parentElement;
        }
        return null;
    }

    function setupChromeAutoHide() {
        const pages = document.getElementById('appPages');
        const { navbar, tabbar } = appChromeElements();
        if (!pages || !navbar || !tabbar) return;

        const TOP_ZONE = 56;
        const HIDE_AFTER = 36;
        const SHOW_AFTER = 48;
        const BOTTOM_ZONE = 24;
        const MAX_STEP = 120;

        let activeScroller = null;
        let lastScrollTop = 0;
        let travel = 0;
        let pendingScroller = null;
        let scrollFrame = null;

        const processScroll = () => {
            scrollFrame = null;
            const el = pendingScroller;
            pendingScroller = null;
            if (window.innerWidth >= 992) { showAppChrome(); return; }
            if (isModalOpen || isSideDrawerOpen()) { showAppChrome(); return; }
            if (!el || typeof el.scrollTop !== 'number') return;
            if (el !== activeScroller) {
                activeScroller = el;
                lastScrollTop = el.scrollTop;
                travel = 0;
                return;
            }
            const top = el.scrollTop;
            const delta = top - lastScrollTop;
            lastScrollTop = top;
            if (!delta) return;
            if (top <= TOP_ZONE) { travel = 0; showAppChrome(); return; }
            const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, delta));
            if (step > 0 && el.scrollHeight - top - el.clientHeight <= BOTTOM_ZONE) { travel = 0; return; }
            if ((step > 0) !== (travel > 0)) travel = 0;
            travel += step;
            if (travel > HIDE_AFTER) { travel = 0; hideAppChrome(); }
            else if (travel < -SHOW_AFTER) { travel = 0; showAppChrome(); }
        };

        const onScroll = (event) => {
            pendingScroller = (event.target && event.target.nodeType === 1) ? event.target : pages;
            if (scrollFrame !== null) return;
            scrollFrame = requestAnimationFrame(processScroll);
        };

        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        window.addEventListener('resize', () => {
            measureAppChromeSize();
            if (window.innerWidth >= 992) showAppChrome();
        });
        if (window.visualViewport) window.visualViewport.addEventListener('resize', measureAppChromeSize);
        if (window.ResizeObserver) {
            const chromeSizeObserver = new ResizeObserver(measureAppChromeSize);
            chromeSizeObserver.observe(navbar);
            chromeSizeObserver.observe(tabbar);
        }
        measureAppChromeSize();
        setTimeout(measureAppChromeSize, 300);
    }

    const DISPLAY_HZ_MIN = 10;
    const DISPLAY_HZ_MAX = 120;
    const DISPLAY_HZ_SAMPLES = 24;
    const PERF_SAMPLE_FRAMES = 90;
    const PERF_LONG_FRAME_FACTOR = 1.6;
    const PERF_LONG_FRAME_FLOOR_MS = 12;
    const PERF_LITE_RATIO = 0.34;
    const PERF_FIRST_SAMPLE_DELAY_MS = 1500;
    const PERF_SECOND_SAMPLE_DELAY_MS = 8000;

    function displayFrameBudgetMs() {
        return 1000 / displayHz;
    }

    function longFrameThresholdMs() {
        return Math.max(PERF_LONG_FRAME_FLOOR_MS, Math.round(displayFrameBudgetMs() * PERF_LONG_FRAME_FACTOR));
    }

    function clampDisplayHz(hz) {
        if (!isFinite(hz) || hz <= 0) return DISPLAY_HZ_MIN;
        return Math.max(DISPLAY_HZ_MIN, Math.min(DISPLAY_HZ_MAX, Math.round(hz)));
    }

    function measureDisplayHz(done) {
        const gaps = [];
        let last = 0;
        function tick(timestamp) {
            if (last && timestamp > last) gaps.push(timestamp - last);
            last = timestamp;
            if (gaps.length < DISPLAY_HZ_SAMPLES) { requestAnimationFrame(tick); return; }
            gaps.sort((a, b) => a - b);
            displayHz = clampDisplayHz(1000 / gaps[gaps.length >> 1]);
            displayHzMeasured = true;
            done(displayHz);
        }
        requestAnimationFrame(tick);
    }

    function sampleFramePace(done) {
        const longFrameMs = longFrameThresholdMs();
        let frames = 0;
        let longFrames = 0;
        let last = 0;
        function tick(timestamp) {
            if (last) {
                if (timestamp - last > longFrameMs) longFrames++;
                frames++;
            }
            last = timestamp;
            if (frames < PERF_SAMPLE_FRAMES) { requestAnimationFrame(tick); return; }
            done(longFrames / frames);
        }
        requestAnimationFrame(tick);
    }

    function setupAdaptivePerformance() {
        if (perfSamplePending) return;
        perfSamplePending = true;
        setTimeout(() => {
            measureDisplayHz(() => {
                sampleFramePace((firstRatio) => {
                    if (firstRatio < PERF_LITE_RATIO) { perfSamplePending = false; return; }
                    setTimeout(() => {
                        measureDisplayHz(() => {
                            sampleFramePace((secondRatio) => {
                                perfSamplePending = false;
                                if (secondRatio >= PERF_LITE_RATIO) document.body.classList.add('perf-lite');
                            });
                        });
                    }, PERF_SECOND_SAMPLE_DELAY_MS);
                });
            });
        }, PERF_FIRST_SAMPLE_DELAY_MS);
    }

    function setupIOSPullToRefresh() {
        if (window.navigator.standalone !== true) return;

        const pages = document.getElementById('appPages');
        if (!pages) return;

        const indicator = document.createElement('div');
        indicator.className = 'ptr-indicator';
        indicator.innerHTML = '<div class="ptr-spinner"></div>';
        indicator.setAttribute('aria-hidden', 'true');
        document.body.appendChild(indicator);

        const AXIS_SLOP = 22;
        const ENGAGE_AT = 56;
        const AXIS_RATIO = 1.6;
        const INDICATOR_AT = 18;
        const TRIGGER_AT = 96;
        const MAX_TRAVEL = 140;
        const REST_Y = -46;
        const RELOAD_KEY = 'zoew_ptr_reload_pending';
        const RESTORATION_KEY = 'zoew_ptr_scroll_restoration';

        let startY = 0;
        let startX = 0;
        let touchId = null;
        let tracking = false;
        let engaged = false;
        let travel = 0;
        let refreshing = false;
        let startScroller = null;
        let startActiveScroller = null;
        let restoreTimers = [];
        let restoreFrames = [];
        let settlingScroll = false;
        let reloadWatchdog = null;
        let pullMoveListening = false;
        let scrollerMemoTarget = null;
        let scrollerMemoValue = null;

        function scrollerForPull(target) {
            if (target === scrollerMemoTarget) return scrollerMemoValue;
            scrollerMemoTarget = target;
            scrollerMemoValue = scrollerOf(target);
            return scrollerMemoValue;
        }

        function resetScrollerMemo() {
            scrollerMemoTarget = null;
            scrollerMemoValue = null;
        }

        function dampen(raw) {
            return MAX_TRAVEL * (1 - Math.exp(-raw / 135));
        }

        function paint(distance) {
            const progress = Math.min(1, distance / TRIGGER_AT);
            const visible = Math.max(0, Math.min(1, (distance - INDICATOR_AT) / (TRIGGER_AT - INDICATOR_AT)));
            indicator.style.transform = 'translateY(' + (REST_Y + distance) + 'px) rotate(' + Math.round(progress * 270) + 'deg)';
            indicator.style.opacity = String(visible);
            indicator.classList.toggle('ready', progress >= 1);
        }

        function park(resetArbiter) {
            resetScrollerMemo();
            touchId = null;
            tracking = false;
            engaged = false;
            travel = 0;
            startScroller = null;
            startActiveScroller = null;
            indicator.classList.add('snapping');
            indicator.classList.remove('ready');
            indicator.classList.remove('spinning');
            indicator.style.opacity = '0';
            indicator.style.transform = 'translateY(' + REST_Y + 'px)';
            if (resetArbiter !== false) resetIOSTouchArbiter();
        }

        function atStartTop(value) {
            return Number.isFinite(value) && value <= 1;
        }

        function atPullTop(value) {
            return Number.isFinite(value) && value <= 1;
        }

        function pullTargetBlocked(target) {
            if (appIsLocked || isModalOpen || refreshing) return true;
            if (isSideDrawerOpen()) return true;
            if (!target || !target.closest) return false;
            if (target.closest('input, textarea, select, [contenteditable="true"], .app-navbar, .page-tabbar')) return true;
            const action = target.closest('button, a');
            return !!(action && !action.closest('.table-responsive'));
        }

        function pullRefreshDisabledByPanelState() {
            const side = activePanelSections().side;
            return pages.classList.contains('history-expanded') || !!(side &&
                (side.classList.contains('collapsed') || side.classList.contains('search-focus')));
        }

        function capturePullContext(target) {
            if (isModalOpen || refreshing || pullRefreshDisabledByPanelState() || pullTargetBlocked(target)) return null;
            const root = document.scrollingElement || document.documentElement;
            if (!atStartTop(root ? root.scrollTop : 0) || !atStartTop(window.scrollY || 0)) return null;
            if (!atStartTop(document.body.scrollTop || 0) || !atStartTop(pages.scrollTop)) return null;
            const scroller = scrollerForPull(target);
            if (scroller && !atStartTop(scroller.scrollTop)) return null;
            const activeScroller = activePanelSections().scroller;
            if (activeScroller && activeScroller.offsetParent !== null && !atStartTop(activeScroller.scrollTop)) return null;
            return { scroller: scroller, activeScroller: activeScroller };
        }

        function pullContextStillValid(target) {
            if (isModalOpen || refreshing || pullRefreshDisabledByPanelState() || pullTargetBlocked(target)) return false;
            if (scrollerForPull(target) !== startScroller) return false;
            if (activePanelSections().scroller !== startActiveScroller) return false;
            const root = document.scrollingElement || document.documentElement;
            if (!atPullTop(root ? root.scrollTop : 0) || !atPullTop(window.scrollY || 0)) return false;
            if (!atPullTop(document.body.scrollTop || 0) || !atPullTop(pages.scrollTop)) return false;
            if (startScroller && !atPullTop(startScroller.scrollTop)) return false;
            if (startActiveScroller && startActiveScroller.offsetParent !== null && !atPullTop(startActiveScroller.scrollTop)) return false;
            return true;
        }

        function attachPullMoveListener() {
            if (pullMoveListening) return;
            document.addEventListener('touchmove', onPullTouchMove, { passive: false });
            pullMoveListening = true;
        }

        function detachPullMoveListener() {
            if (!pullMoveListening) return;
            document.removeEventListener('touchmove', onPullTouchMove);
            pullMoveListening = false;
        }

        function syncPullMoveListener() {
            if (pullRefreshDisabledByPanelState()) detachPullMoveListener();
            else attachPullMoveListener();
        }

        function markReload() {
            try { appSessionStore.setItem(RELOAD_KEY, '1'); } catch (e) {}
        }

        function hasReloadMarker() {
            try {
                return appSessionStore.getItem(RELOAD_KEY) === '1';
            } catch (e) {
                return false;
            }
        }

        function clearReloadMarker() {
            try { appSessionStore.removeItem(RELOAD_KEY); } catch (e) {}
        }

        function rememberScrollRestoration() {
            if (!('scrollRestoration' in history)) return;
            try {
                if (appSessionStore.getItem(RESTORATION_KEY) === null) {
                    appSessionStore.setItem(RESTORATION_KEY, history.scrollRestoration);
                }
            } catch (e) {}
            history.scrollRestoration = 'manual';
        }

        function restoreScrollRestoration() {
            let mode = 'auto';
            try {
                const saved = appSessionStore.getItem(RESTORATION_KEY);
                if (saved === 'manual') mode = 'manual';
                appSessionStore.removeItem(RESTORATION_KEY);
            } catch (e) {}
            if ('scrollRestoration' in history) history.scrollRestoration = mode;
        }

        function resetScrollPosition() {
            const root = document.scrollingElement || document.documentElement;
            if (root) root.scrollTop = 0;
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            pages.scrollTop = 0;
            const activeScroller = activePanelSections().scroller;
            if (activeScroller) activeScroller.scrollTop = 0;
            window.scrollTo(0, 0);
            showAppChrome();
        }

        function settleScrollPosition() {
            cancelScrollSettling(false);
            settlingScroll = true;
            resetScrollPosition();
            const firstFrame = requestAnimationFrame(() => {
                resetScrollPosition();
                const secondFrame = requestAnimationFrame(resetScrollPosition);
                restoreFrames.push(secondFrame);
            });
            restoreFrames.push(firstFrame);
            [80, 260, 620].forEach((delay, index) => {
                const timer = setTimeout(() => {
                    resetScrollPosition();
                    if (index === 2) {
                        settlingScroll = false;
                        restoreTimers = [];
                        restoreFrames = [];
                        clearReloadMarker();
                        restoreScrollRestoration();
                    }
                }, delay);
                restoreTimers.push(timer);
            });
        }

        function cancelScrollSettling(clearMarker) {
            restoreTimers.forEach(clearTimeout);
            restoreFrames.forEach(cancelAnimationFrame);
            restoreTimers = [];
            restoreFrames = [];
            settlingScroll = false;
            if (clearMarker !== false) {
                clearReloadMarker();
                restoreScrollRestoration();
            }
        }

        const restoringAfterPull = hasReloadMarker();
        if (restoringAfterPull) {
            if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
            settleScrollPosition();
            window.addEventListener('pageshow', () => {
                if (settlingScroll) settleScrollPosition();
            }, { once: true });
        }

        document.addEventListener('touchstart', (e) => {
            resetScrollerMemo();
            touchId = null;
            tracking = false;
            engaged = false;
            travel = 0;
            startScroller = null;
            startActiveScroller = null;
            if (refreshing) return;
            if (e.touches.length !== 1) {
                if (iosTouchArbiter.id !== null) blockPanelForIOSTouch('cancelled');
                park(false);
                return;
            }
            const touch = e.touches[0];
            beginIOSTouch(touch);
            touchId = touch.identifier;
            startY = touch.clientY;
            startX = touch.clientX;
            const context = capturePullContext(e.target);
            if (!context) return;
            startScroller = context.scroller;
            startActiveScroller = context.activeScroller;
            tracking = true;
            iosTouchArbiter.phase = 'tracking';
            indicator.classList.remove('snapping');
        }, { passive: true });

        function onPullTouchMove(e) {
            if (refreshing) return;
            if (e.touches.length !== 1) {
                if (iosTouchArbiter.id !== null) blockPanelForIOSTouch('cancelled');
                park(false);
                return;
            }
            if (touchId === null) return;
            const touch = touchByIdentifier(e.touches, touchId);
            if (!touch) { blockPanelForIOSTouch('cancelled'); park(false); return; }
            const deltaY = touch.clientY - startY;
            const deltaX = touch.clientX - startX;

            if (!tracking) {
                if (settlingScroll && (Math.abs(deltaY) >= AXIS_SLOP || Math.abs(deltaX) >= AXIS_SLOP)) cancelScrollSettling();
                return;
            }

            if (!engaged) {
                if (Math.abs(deltaY) < AXIS_SLOP && Math.abs(deltaX) < AXIS_SLOP) return;
                if (settlingScroll) cancelScrollSettling();
                if (deltaY <= 0 || deltaY < Math.abs(deltaX) * AXIS_RATIO) {
                    park();
                    return;
                }
                if (!e.cancelable || !pullContextStillValid(e.target)) { park(); return; }
                e.preventDefault();
                if (!e.defaultPrevented) { park(); return; }
                engaged = true;
                iosTouchArbiter.phase = 'held';
            }

            if (deltaY <= 0 || Math.abs(deltaX) > deltaY * 0.85 || !e.cancelable || !pullContextStillValid(e.target)) {
                park(iosTouchArbiter.blockPanel ? false : true);
                return;
            }
            e.preventDefault();
            if (!e.defaultPrevented) { park(); return; }
            if (deltaY >= ENGAGE_AT && !iosTouchArbiter.blockPanel) blockPanelForIOSTouch('ptr');
            const raw = deltaY - ENGAGE_AT;
            travel = raw > 0 ? dampen(raw) : 0;
            paint(travel);
        }

        document.addEventListener('touchend', (e) => {
            const endedTouchId = touchId;
            if (endedTouchId === null) {
                if (e.touches.length === 0) resetIOSTouchArbiter();
                return;
            }
            if (e.touches.length !== 0) {
                blockPanelForIOSTouch('cancelled');
                park(false);
                return;
            }
            const endedTouch = touchByIdentifier(e.changedTouches, endedTouchId);
            if (!endedTouch) { park(); return; }
            if (!tracking && !engaged) { park(); return; }
            const finalDeltaY = endedTouch.clientY - startY;
            const finalDeltaX = endedTouch.clientX - startX;
            const finalAxisValid = engaged ? Math.abs(finalDeltaX) <= finalDeltaY * 0.85 :
                finalDeltaY >= Math.abs(finalDeltaX) * AXIS_RATIO;
            if (finalDeltaY < AXIS_SLOP || !finalAxisValid ||
                !pullContextStillValid(e.target)) { park(); return; }
            if (finalDeltaY >= ENGAGE_AT && !iosTouchArbiter.blockPanel) blockPanelForIOSTouch('ptr');
            const finalRaw = finalDeltaY - ENGAGE_AT;
            travel = finalRaw > 0 ? dampen(finalRaw) : 0;
            paint(travel);
            tracking = false;
            engaged = false;
            if (travel >= TRIGGER_AT) {
                refreshing = true;
                blockPanelForIOSTouch('refreshing');
                touchId = null;
                startScroller = null;
                startActiveScroller = null;
                rememberScrollRestoration();
                markReload();
                resetScrollPosition();
                indicator.classList.add('snapping');
                indicator.classList.add('spinning');
                indicator.style.opacity = '1';
                indicator.style.transform = 'translateY(' + (REST_Y + TRIGGER_AT) + 'px)';
                setTimeout(() => window.location.reload(), 300);
                reloadWatchdog = setTimeout(() => {
                    refreshing = false;
                    reloadWatchdog = null;
                    clearReloadMarker();
                    restoreScrollRestoration();
                    park();
                }, 5000);
                return;
            }
            park();
        }, { passive: true });

        document.addEventListener('touchcancel', (e) => {
            if (refreshing) return;
            blockPanelForIOSTouch('cancelled');
            park(e.touches.length === 0);
        }, { passive: true });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && !refreshing) park();
        });

        document.addEventListener('click', (e) => {
            if (!refreshing) return;
            e.preventDefault();
            e.stopImmediatePropagation();
        }, true);

        window.addEventListener('beforeunload', () => {
            if (!refreshing || reloadWatchdog === null) return;
            clearTimeout(reloadWatchdog);
            reloadWatchdog = null;
        });

        const pullAvailabilityObserver = new MutationObserver(syncPullMoveListener);
        [pages, document.getElementById('dataSideSection'), document.getElementById('entrySideSection'),
         document.getElementById('pageData'), document.getElementById('pageEntry')].forEach((el) => {
            if (el) pullAvailabilityObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
        });

        park();
        syncPullMoveListener();
        indicator.classList.remove('snapping');
    }

    function closeGlobalMoreMenu() {
        const menu = document.getElementById('globalMoreMenu');
        if (menu) menu.classList.remove('show');
    }

    function moreMenuExport() { openExportDataModal(); closeGlobalMoreMenu(); }

    function moreMenuManualAdjust() { requestPinBeforeConfig(openManualAdjustModal, 'manualAdjust'); closeGlobalMoreMenu(); }

    function moreMenuExchangeRate() { openExchangeRateModal(); closeGlobalMoreMenu(); }

    function moreMenuRecentlyDeleted() { openRecentlyDeletedModal(); closeGlobalMoreMenu(); }

    function moreMenuResetPickup() { requestPinBeforeResetPickup(); closeGlobalMoreMenu(); }

    function moreMenuClearHistory() { requestPinBeforeClearHistory(); closeGlobalMoreMenu(); }

    function moreMenuViewList(id) { openViewListModal(id); closeGlobalMoreMenu(); }

    function moreMenuEditPhone(id) { openEditModal(id); closeGlobalMoreMenu(); }

    function moreMenuDelete(id) { deleteSingleItem(id); closeGlobalMoreMenu(); }

    function toggleHeaderMoreDropdown(btn, event) {
        if (event) event.stopPropagation();
        const rect = btn.getBoundingClientRect();
        const menu = document.getElementById('globalMoreMenu');
        const container = document.getElementById('menuContentContainer');
        if(!menu || !container) return;

        container.innerHTML = `
            <button data-act="moreMenuExport">📤 Export Data</button>
            <button data-act="moreMenuManualAdjust">✏️ កែទឹកប្រាក់/កញ្ចប់</button>
            <button data-act="moreMenuExchangeRate">💱 អត្រាប្រាក់ (${exchangeRateRiel}៛)</button>
            <button data-act="moreMenuRecentlyDeleted">🗑️ ធុងសំរាម</button>
            <button data-act="moreMenuResetPickup">♻️ Reset ចំនួនយករួច (${sanitizeInput(getCurrentFilterLabel())})</button>
            <button class="delete-opt" data-act="moreMenuClearHistory">❌ លុបទាំងអស់</button>
        `;

        menu.classList.add('show');
        positionMenuSafely(menu, rect);
    }

    function toggleMoreDropdown(btn, event, id) {
        if (event) event.stopPropagation();
        const rect = btn.getBoundingClientRect();
        const menu = document.getElementById('globalMoreMenu');
        const container = document.getElementById('menuContentContainer');
        if(!menu || !container) return;

        const item = scanHistory.find(i => i.id === id);
        let editMoneyHtml = '';
        if (item && item.barcodes && item.barcodes.length > 0) {
            editMoneyHtml = `<button data-act="moreMenuViewList" data-a1="${sanitizeInput(id)}">💵 កែ/ដកកញ្ចប់អីវ៉ាន់</button>`;
        }

        container.innerHTML = `
            ${editMoneyHtml}
            <button data-act="moreMenuEditPhone" data-a1="${sanitizeInput(id)}">✏️ កែលេខទូរស័ព្ទ</button>
            <button class="delete-opt" data-act="moreMenuDelete" data-a1="${sanitizeInput(id)}">🗑️ លុប</button>
        `;

        menu.classList.add('show');
        positionMenuSafely(menu, rect);
    }

    function positionMenuSafely(menu, rect) {
        menu.style.top = '0px';
        menu.style.left = '0px';
        const menuHeight = menu.offsetHeight;
        const menuWidth = menu.offsetWidth;
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;

        let topPos = rect.bottom + 4;
        if (topPos + menuHeight > windowHeight - 10) {
            topPos = rect.top - menuHeight - 4;
        }
        if (topPos < 10) topPos = 10;

        let leftPos = rect.right - menuWidth;
        if (leftPos < 10) leftPos = 10;
        if (leftPos + menuWidth > windowWidth - 10) {
            leftPos = windowWidth - menuWidth - 10;
        }
        if (leftPos < 10) leftPos = 10;

        menu.style.top = topPos + 'px';
        menu.style.left = leftPos + 'px';
    }

    function filterDataByDate(mode) {
        currentFilterMode = mode;
        customFilterDate = '';
        const customDateInput = document.getElementById('customDateInput');
        if(customDateInput) customDateInput.value = '';

        document.querySelectorAll('.date-filter-btn').forEach(btn => btn.classList.remove('active'));
        if (mode === 'today') {
            const el = document.getElementById('btnFilterToday');
            if(el) el.classList.add('active');
        }
        if (mode === 'yesterday') {
            const el = document.getElementById('btnFilterYesterday');
            if(el) el.classList.add('active');
        }
        if (mode === 'dayBefore') {
            const el = document.getElementById('btnFilterDayBefore');
            if(el) el.classList.add('active');
        }
        if (mode === 'all') {
            const el = document.getElementById('btnFilterAll');
            if(el) el.classList.add('active');
        }

        applyCurrentFilter();
    }

    function filterDataByCustomDate() {
        const customDateInput = document.getElementById('customDateInput');
        const val = customDateInput ? customDateInput.value : '';
        if (!val) return;

        currentFilterMode = 'custom';
        customFilterDate = val;
        document.querySelectorAll('.date-filter-btn').forEach(btn => btn.classList.remove('active'));

        applyCurrentFilter();
    }

    function getFilteredDataByDate() {
        const now = getServerNow();
        const todayStr = getZoneDateKey(now, 0);
        const yesterdayStr = getZoneDateKey(now, -1);
        const dayBeforeStr = getZoneDateKey(now, -2);

        if (currentFilterMode === 'today') {
            return scanHistory.filter(item => item.scanDate === todayStr);
        } else if (currentFilterMode === 'yesterday') {
            return scanHistory.filter(item => item.scanDate === yesterdayStr);
        } else if (currentFilterMode === 'dayBefore') {
            return scanHistory.filter(item => item.scanDate === dayBeforeStr);
        } else if (currentFilterMode === 'custom') {
            return scanHistory.filter(item => item.scanDate === customFilterDate);
        } else {
            return scanHistory;
        }
    }

    const EXPORT_LIBS = {
        xlsx: { url: './vendor/xlsx.full.min.js' }
    };
    const loadedScriptPromises = {};

    function exportFailureMessage(e) {
        if (e && e.code === 'SCRIPT_LOAD_TIMEOUT') {
            return "❌ Export Excel បរាជ័យ! ផ្ទុកឯកសារ Excel យូរពេក (បណ្តាញឆ្លើយមិនចេញ) — សូមសាកម្តងទៀត";
        }
        if (e && e.code === 'SCRIPT_LOAD_FAILED') {
            return navigator.onLine === false
                ? "❌ Export Excel បរាជ័យ! ឧបករណ៍ក្រៅបណ្ដាញ ហើយឯកសារ Excel មិនទាន់ចូល cache ទេ"
                : "❌ Export Excel បរាជ័យ! ផ្ទុកឯកសារ Excel មិនបានទេ — សូម Refresh ទំព័រម្តង";
        }
        const detail = e && e.message ? e.message : String(e);
        return "❌ Export Excel បរាជ័យ! " + detail;
    }

    function loadScriptOnce(key) {
        if (loadedScriptPromises[key]) return loadedScriptPromises[key];
        const lib = EXPORT_LIBS[key];
        const SCRIPT_LOAD_TIMEOUT_MS = 25000;
        const pending = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            let settled = false;
            let timer = null;
            const stop = () => {
                if (timer === null) return;
                clearTimeout(timer);
                timer = null;
            };
            const failWith = (code, message) => {
                if (settled) return;
                settled = true;
                stop();
                if (loadedScriptPromises[key] === pending) delete loadedScriptPromises[key];
                const err = new Error(message);
                err.code = code;
                reject(err);
            };
            script.src = lib.url;
            if (lib.integrity) {
                script.integrity = lib.integrity;
                script.crossOrigin = 'anonymous';
            }
            script.onload = () => {
                if (settled) return;
                settled = true;
                stop();
                resolve();
            };
            script.onerror = () => failWith('SCRIPT_LOAD_FAILED', 'Failed to load ' + lib.url);
            timer = setTimeout(() => failWith('SCRIPT_LOAD_TIMEOUT', 'Script load timed out: ' + lib.url), SCRIPT_LOAD_TIMEOUT_MS);
            document.head.appendChild(script);
        });
        loadedScriptPromises[key] = pending;
        return pending;
    }

    function getFilterTargetDateKey() {
        const now = getServerNow();
        if (currentFilterMode === 'today') return getZoneDateKey(now, 0);
        if (currentFilterMode === 'yesterday') return getZoneDateKey(now, -1);
        if (currentFilterMode === 'dayBefore') return getZoneDateKey(now, -2);
        if (currentFilterMode === 'custom') return customFilterDate;
        return "";
    }

    function getPickupResetTargetDates() {
        if (currentFilterMode === 'all') {
            return Object.keys(dailyPickupData).filter((d) => PICKUP_DATE_KEY_PATTERN.test(d)).sort();
        }
        const key = getFilterTargetDateKey();
        return PICKUP_DATE_KEY_PATTERN.test(key) ? [key] : [];
    }

    function getCurrentFilterLabel() {
        if (currentFilterMode === 'yesterday') return "ម្សិលមិញ";
        if (currentFilterMode === 'dayBefore') return "ម្សិលម្ងៃ";
        if (currentFilterMode === 'custom') return customFilterDate || "ថ្ងៃផ្សេង";
        if (currentFilterMode === 'all') return "ទាំងអស់";
        return "ថ្ងៃនេះ";
    }

    function getExportFilenameBase() {
        const label = (currentFilterMode === 'custom' ? customFilterDate : currentFilterMode) || 'data';
        return `ZoeW_${label}_${getFormattedDate()}`.replace(/[^a-zA-Z0-9_\-]/g, '');
    }

    function buildExportRows() {
        const filteredData = getFilteredDataByDate();
        const rows = [];
        let rowNum = 0;
        filteredData.forEach(item => {
            const barcodes = (item.barcodes && Array.isArray(item.barcodes) && item.barcodes.length)
                ? item.barcodes
                : [{ code: item.barcode, cod: item.cod, dod: item.dod, locker: item.locker, isClosed: item.isClosed, time: item.time }];
            barcodes.forEach(b => {
                rowNum++;
                const cod = parseFloat(b.cod) || 0;
                const dod = parseFloat(b.dod) || 0;
                rows.push({
                    no: rowNum,
                    phone: item.phone === "គ្មានលេខ" ? "" : String(item.phone || ''),
                    barcode: String(b.code || ''),
                    locker: b.locker || 'N/A',
                    cod: cod,
                    dod: dod,
                    total: Math.round((cod + dod) * 100) / 100,
                    status: b.isClosed ? 'យកហើយ' : 'នៅសល់',
                    scanDate: item.scanDate || '',
                    time: b.time || item.time || ''
                });
            });
        });
        return rows;
    }

    const EXPORT_HEADERS = ['ល.រ', 'លេខទូរស័ព្ទ', 'Barcode', 'ទីតាំង Locker', 'COD ($)', 'DOD ($)', 'សរុប ($)', 'ស្ថានភាព', 'ថ្ងៃស្កេន', 'ម៉ោង'];
    const EXPORT_TEXT_COLUMN_INDEXES = [1, 2];

    function forceExportTextCells(ws, rowCount) {
        for (let r = 1; r <= rowCount; r++) {
            EXPORT_TEXT_COLUMN_INDEXES.forEach(c => {
                const cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
                if (!cell) return;
                cell.t = 's';
                cell.v = String(cell.v === undefined || cell.v === null ? '' : cell.v);
                cell.z = '@';
                delete cell.w;
                delete cell.f;
            });
        }
    }

    function openExportDataModal() {
        const lbl = document.getElementById('exportFilterLabel');
        if (lbl) lbl.innerText = getCurrentFilterLabel();
        openModalHelper('exportDataModal');
    }

    async function exportDataAsExcel() {
        const rows = buildExportRows();
        if (!rows.length) { showToast("⚠️ គ្មានទិន្នន័យសម្រាប់ Export ទេ!"); return; }
        closeModal('exportDataModal');
        showToast("កំពុងរៀបចំ Excel...");
        try {
            await loadScriptOnce('xlsx');
            const aoa = [EXPORT_HEADERS, ...rows.map(r => [r.no, r.phone, r.barcode, r.locker, r.cod, r.dod, r.total, r.status, r.scanDate, r.time])];
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            forceExportTextCells(ws, rows.length);
            ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'ប្រវត្តិ');
            XLSX.writeFile(wb, getExportFilenameBase() + '.xlsx', { bookSST: true });
            showToast("✅ បាន Export ជា Excel ជោគជ័យ!");
        } catch (e) {
            console.error("Excel export failed:", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Excel export failed:" });
            showToast(exportFailureMessage(e));
        }
    }

    let pdfExportOriginalTitle = null;

    function restoreAfterPdfExport() {
        if (pdfExportOriginalTitle !== null) {
            document.title = pdfExportOriginalTitle;
            pdfExportOriginalTitle = null;
        }
        const area = document.getElementById('pdfExportPrintArea');
        if (area) area.innerHTML = '';
    }

    function exportDataAsPDF() {
        const rows = buildExportRows();
        if (!rows.length) { showToast("⚠️ គ្មានទិន្នន័យសម្រាប់ Export ទេ!"); return; }
        closeModal('exportDataModal');

        const printArea = document.getElementById('pdfExportPrintArea');
        if (!printArea) { showToast("❌ Export PDF បរាជ័យ!"); return; }

        const totalCod = Math.round(rows.reduce((sum, r) => sum + r.cod, 0) * 100) / 100;
        const totalDod = Math.round(rows.reduce((sum, r) => sum + r.dod, 0) * 100) / 100;
        const totalAll = Math.round((totalCod + totalDod) * 100) / 100;

        const bodyRows = rows.map(r => `<tr>
            <td>${r.no}</td>
            <td>${sanitizeInput(r.phone)}</td>
            <td>${sanitizeInput(r.barcode)}</td>
            <td>${sanitizeInput(r.locker)}</td>
            <td>${r.cod.toFixed(2)}</td>
            <td>${r.dod.toFixed(2)}</td>
            <td>${r.total.toFixed(2)}</td>
            <td>${sanitizeInput(r.status)}</td>
            <td>${sanitizeInput(r.scanDate)}</td>
            <td>${sanitizeInput(r.time)}</td>
        </tr>`).join('');

        printArea.innerHTML = `
            <h2>ZoeW — របាយការណ៍ប្រវត្តិកញ្ចប់ (${sanitizeInput(getCurrentFilterLabel())})</h2>
            <table>
                <thead><tr>${EXPORT_HEADERS.map(h => `<th>${sanitizeInput(h)}</th>`).join('')}</tr></thead>
                <tbody>
                    ${bodyRows}
                    <tr class="export-total-row">
                        <td colspan="4">សរុប (${rows.length} កញ្ចប់)</td>
                        <td>${totalCod.toFixed(2)}</td>
                        <td>${totalDod.toFixed(2)}</td>
                        <td>${totalAll.toFixed(2)}</td>
                        <td colspan="3"></td>
                    </tr>
                </tbody>
            </table>
            <p class="export-footer">នាំចេញនៅ ${sanitizeInput(getZoneDateKey(getServerNow(), 0) + ' ' + getFormattedClockTime(getServerNow()))}</p>
        `;

        if (pdfExportOriginalTitle === null) pdfExportOriginalTitle = document.title;
        document.title = getExportFilenameBase();
        window.addEventListener('afterprint', restoreAfterPdfExport);
        noteAppLockExcuse();
        window.print();
    }

    function exportDataAsCsvForSheets() {
        const rows = buildExportRows();
        if (!rows.length) { showToast("⚠️ គ្មានទិន្នន័យសម្រាប់ Export ទេ!"); return; }
        closeModal('exportDataModal');

        const csvEscape = (val) => {
            let s = String(val === undefined || val === null ? '' : val);
            if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
            return s;
        };
        const sheetsText = (val) => {
            const s = String(val === undefined || val === null ? '' : val);
            return s === '' ? '' : '="' + s.replace(/"/g, '""') + '"';
        };
        const csvSafeText = (val) => {
            const s = String(val === undefined || val === null ? '' : val);
            return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
        };
        const lines = [EXPORT_HEADERS.map(csvEscape).join(',')];
        rows.forEach(r => {
            lines.push([r.no, sheetsText(r.phone), sheetsText(r.barcode), csvSafeText(r.locker), r.cod.toFixed(2), r.dod.toFixed(2), r.total.toFixed(2), csvSafeText(r.status), r.scanDate, r.time].map(csvEscape).join(','));
        });

        const csvContent = '\uFEFF' + lines.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getExportFilenameBase() + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast("✅ បាន Export ជា CSV ជោគជ័យ! បើក Google Sheets ➜ File ➜ Import ដើម្បីនាំចូល");
    }

    function applyCurrentFilter() {
        let titleText = "ថ្ងៃនេះ";
        if (currentFilterMode === 'yesterday') titleText = "ម្សិលមិញ";
        if (currentFilterMode === 'dayBefore') titleText = "ម្សិលម្ងៃ";
        if (currentFilterMode === 'custom') titleText = customFilterDate;
        if (currentFilterMode === 'all') titleText = "ទាំងអស់";

        let filteredData = getFilteredDataByDate();

        const selectedFilterTitle = document.getElementById('selectedFilterTitle');
        if(selectedFilterTitle) selectedFilterTitle.innerText = titleText;
        renderHistory(filteredData);
        updateDailyScheduleStats(filteredData);
    }

    function updateDailyScheduleStats(filteredList, isSearchScoped = false) {
        let selectedAllPackages = 0;
        let selectedClosedCount = 0;
        let selectedPackagesPickedUpCount = 0;
        let codTotal = 0;
        let dodTotal = 0;

        const targetDateKey = getFilterTargetDateKey();

        if (!isSearchScoped && targetDateKey && dailyRevenueData[targetDateKey]) {
            selectedAllPackages = parseFloat(dailyRevenueData[targetDateKey].totalCount) || 0;
        } else if (!isSearchScoped && currentFilterMode === 'all') {
            selectedAllPackages = Object.values(dailyRevenueData).reduce((sum, d) => sum + (parseFloat(d.totalCount) || 0), 0);
        } else {
            selectedAllPackages = filteredList.reduce((sum, item) => {
                if (item.barcodes && Array.isArray(item.barcodes)) {
                    return sum + item.barcodes.length;
                }
                return sum + (parseFloat(item.count) || 1);
            }, 0);
        }

        if (!isSearchScoped && targetDateKey && dailyPickupData[targetDateKey]) {
            selectedClosedCount = countPickedUpCustomers(dailyPickupData[targetDateKey]);
            selectedPackagesPickedUpCount = parseFloat(dailyPickupData[targetDateKey].packagesPickedUp) || 0;
        } else if (!isSearchScoped && currentFilterMode === 'all') {
            selectedClosedCount = Object.values(dailyPickupData).reduce((sum, d) => sum + countPickedUpCustomers(d), 0);
            selectedPackagesPickedUpCount = Object.values(dailyPickupData).reduce((sum, d) => sum + (parseFloat(d.packagesPickedUp) || 0), 0);
        } else {
            selectedClosedCount = new Set(filteredList.filter(item => item.isClosed).map(item => getPickupPhoneKey(item))).size;
            selectedPackagesPickedUpCount = filteredList.reduce((sum, item) => {
                if (!item.isClosed) return sum;
                if (item.barcodes && Array.isArray(item.barcodes)) {
                    return sum + item.barcodes.length;
                }
                return sum + (parseFloat(item.count) || 1);
            }, 0);
        }

        codTotal = filteredList.reduce((sum, item) => {
            if (item.barcodes && Array.isArray(item.barcodes)) {
                return sum + item.barcodes.filter(b => !b.isClosed).reduce((bSum, b) => bSum + (parseFloat(b.cod) || 0), 0);
            }
            return sum + (!item.isClosed ? (parseFloat(item.cod) || 0) : 0);
        }, 0);

        dodTotal = filteredList.reduce((sum, item) => {
            if (item.barcodes && Array.isArray(item.barcodes)) {
                return sum + item.barcodes.filter(b => !b.isClosed).reduce((bSum, b) => bSum + (parseFloat(b.dod) || 0), 0);
            }
            return sum + (!item.isClosed ? (parseFloat(item.dod) || 0) : 0);
        }, 0);

        codTotal = Math.round(codTotal * 100) / 100;
        dodTotal = Math.round(dodTotal * 100) / 100;

        let combinedTotalDollar = Math.round((codTotal + dodTotal) * 100) / 100;
        let codRiel = Math.round(codTotal * exchangeRateRiel);
        let dodRiel = Math.round(dodTotal * exchangeRateRiel);
        let totalRiel = Math.round(combinedTotalDollar * exchangeRateRiel);

        let filteredRemainingCount = filteredList.reduce((sum, item) => {
            if (item.barcodes && Array.isArray(item.barcodes)) {
                return sum + item.barcodes.filter(b => !b.isClosed).length;
            }
            return sum + (!item.isClosed ? (parseFloat(item.count) || 1) : 0);
        }, 0);

        const safeSetText = (id, text) => {
            const el = document.getElementById(id);
            if(el) el.innerText = text;
        };

        safeSetText('grandTotalCount', filteredRemainingCount);
        safeSetText('todayTotalCount', selectedAllPackages);
        safeSetText('todayClosedCount', selectedClosedCount);
        safeSetText('todayPackagesPickedUpCount', selectedPackagesPickedUpCount);

        safeSetText('summaryCodDollar', `$${codTotal.toFixed(2)}`);
        safeSetText('summaryCodRiel', `${codRiel.toLocaleString()} ៛`);
        safeSetText('summaryDodDollar', `$${dodTotal.toFixed(2)}`);
        safeSetText('summaryDodRiel', `${dodRiel.toLocaleString()} ៛`);
        safeSetText('summaryTotalDollar', `$${combinedTotalDollar.toFixed(2)}`);
        safeSetText('summaryTotalRiel', `${totalRiel.toLocaleString()} ៛`);
    }

    function setupHardwareScanner() {
        const hwInput = document.getElementById('hwScannerInput');

        document.addEventListener('click', (e) => {
            if (!isModalOpen && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A' && !isMobileDevice()) {
                if (hwInput) hwInput.focus();
            }
        });

        if (hwInput) {
            hwInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submitManualBarcode();
                }
            });
        }
    }

    function submitManualBarcode() {
        if (isModalOpen) return;
        const hwInput = document.getElementById('hwScannerInput');
        if(!hwInput) return;
        let scannedCode = hwInput.value.trim();
        if (scannedCode) {
            hwInput.value = '';
            triggerScanAction(scannedCode);
        }
    }

    function stopCurrentStream() {
        cameraRequestId++;
        isCameraScanning = false;
        nativeLoopActive = false;
        zxingLoopActive = false;
        if (pendingLoadedMetadataHandler) {
            const pendingVideoEl = document.getElementById('video');
            if (pendingVideoEl) pendingVideoEl.removeEventListener('loadedmetadata', pendingLoadedMetadataHandler);
            pendingLoadedMetadataHandler = null;
        }
        if (currentStream) {
            currentStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            currentStream = null;
        }
        currentVideoTrack = null;
        torchOn = false;
        const overlay = document.getElementById('videoControlsOverlay');
        if (overlay) overlay.style.display = 'none';
        if (scanVideoResumeTimer) {
            clearTimeout(scanVideoResumeTimer);
            scanVideoResumeTimer = null;
        }
        resetScanConfirm();
        resetLiveScanQuality();
        const videoElement = document.getElementById('video');
        if (videoElement) {
            videoElement.removeEventListener('pause', onScanVideoPause);
            videoElement.pause();
            videoElement.srcObject = null;
        }
        if (codeReader && typeof codeReader.reset === 'function') {
            try {
                codeReader.reset();
            } catch(e) {}
        }
    }

    function showCameraClosedBox() {
        const permBox = document.getElementById('permission-box');
        const vidContainer = document.getElementById('video-container');
        if (vidContainer) vidContainer.style.display = 'none';
        if (!permBox) return;
        const msgEl = permBox.querySelector('p');
        const btnEl = permBox.querySelector('button');
        if (msgEl) msgEl.textContent = '📷 កាមេរ៉ាបានបិទ';
        if (btnEl) btnEl.textContent = '🔓 បើកកាមេរ៉ាម្តងទៀត';
        permBox.style.display = 'block';
    }

    function closeCameraManually() {
        stopCurrentStream();
        showCameraClosedBox();
    }

    function setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && configQrScanActive) closeConfigQrScanner();
            if (document.hidden && isCameraScanning) {
                stopCurrentStream();
                showCameraClosedBox();
            }
        });
    }

    function requestCameraPermission() {
        noteAppLockExcuse();
        if (isCameraStarting) return;
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            showToast('⚠️ កម្មវិធីរុករកនេះមិនអនុញ្ញាតឲ្យប្រើកាមេរ៉ាទេ — សូមបើកតាម HTTPS ឬប្រើម៉ាស៊ីនស្កេន/វាយបញ្ចូលដោយដៃ');
            showCameraClosedBox();
            return;
        }
        warmZtoLookupProxyNow();
        isCameraStarting = true;

        stopCurrentStream();
        const requestId = cameraRequestId;

        const constraints = {
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            }
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                if (requestId !== cameraRequestId) {
                    stream.getTracks().forEach(track => track.stop());
                    isCameraStarting = false;
                    return;
                }

                currentStream = stream;
                isCameraScanning = true;
                isCameraStarting = false;

                const permBox = document.getElementById('permission-box');
                const vidContainer = document.getElementById('video-container');
                if(permBox) permBox.style.display = 'none';
                if(vidContainer) vidContainer.style.display = 'block';

                const videoElement = document.getElementById('video');
                if(!videoElement) return;

                videoElement.setAttribute('playsinline', 'true');
                videoElement.setAttribute('webkit-playsinline', 'true');
                videoElement.muted = true;
                videoElement.srcObject = stream;

                setupTrackCapabilities(stream);

                const beginScanning = () => {
                    if (!currentStream) return;
                    videoElement.addEventListener('pause', onScanVideoPause);
                    videoElement.play().catch(() => {});
                    if (nativeDetector) {
                        startFastNativeScan(videoElement);
                    } else if (liveScanCodeReader) {
                        startZxingVideoScan(videoElement);
                    }
                };

                if (videoElement.readyState >= 1) {
                    beginScanning();
                } else {
                    pendingLoadedMetadataHandler = () => {
                        pendingLoadedMetadataHandler = null;
                        beginScanning();
                    };
                    videoElement.addEventListener('loadedmetadata', pendingLoadedMetadataHandler, { once: true });
                }
            })
            .catch(err => {
                isCameraStarting = false;
                if (requestId !== cameraRequestId) return;
                let msg = "មិនអាចបើកកាមេរ៉ាបានទេ៖ សូមពិនិត្យមើលសិទ្ធិកាមេរ៉ា ឬ HTTPS ។";
                if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                    msg = "កាមេរ៉ាត្រូវបានបិទសិទ្ធិ! សូមចូលទៅ Settings > Safari (ឬកម្មវិធីនេះ) ហើយអនុញ្ញាតកាមេរ៉ា រួចព្យាយាមម្តងទៀត។";
                } else if (err && err.name === 'NotFoundError') {
                    msg = "រកមិនឃើញកាមេរ៉ានៅលើឧបករណ៍នេះទេ។";
                } else if (err && err.name === 'NotReadableError') {
                    msg = "កាមេរ៉ាកំពុងប្រើដោយកម្មវិធីផ្សេង។ សូមបិទកម្មវិធីផ្សេងហើយសាកល្បងម្តងទៀត។";
                }
                alert(msg + "\n\n💡 ប្រសិនបើអ្នកកំពុងបើកតាម Facebook / Messenger / TikTok in-app browser សូមចុចបើកជា Safari ឬ Chrome ដោយផ្ទាល់។");
            });
    }

    function setupTrackCapabilities(stream) {
        currentVideoTrack = stream.getVideoTracks()[0] || null;
        torchOn = false;

        const overlay = document.getElementById('videoControlsOverlay');
        const zoomWrap = document.getElementById('zoomSliderWrap');
        const zoomSlider = document.getElementById('zoomSlider');
        const torchBtn = document.getElementById('torchToggleBtn');
        if (zoomWrap) zoomWrap.style.display = 'none';
        if (torchBtn) { torchBtn.style.display = 'none'; torchBtn.classList.remove('active'); }
        if (overlay) overlay.style.display = 'none';

        if (!currentVideoTrack || typeof currentVideoTrack.getCapabilities !== 'function') return;

        let caps = null;
        try { caps = currentVideoTrack.getCapabilities(); } catch (e) {}
        if (!caps) return;

        if (caps.focusMode && caps.focusMode.includes('continuous')) {
            currentVideoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
        }

        if (caps.zoom && zoomWrap && zoomSlider && caps.zoom.max > caps.zoom.min) {
            zoomSlider.min = caps.zoom.min;
            zoomSlider.max = caps.zoom.max;
            zoomSlider.step = caps.zoom.step || 0.1;
            let settings = {};
            try { settings = currentVideoTrack.getSettings(); } catch (e) {}
            zoomSlider.value = settings.zoom || caps.zoom.min;
            zoomSlider.oninput = () => {
                if (!currentVideoTrack) return;
                currentVideoTrack.applyConstraints({ advanced: [{ zoom: parseFloat(zoomSlider.value) }] }).catch(() => {});
            };
            zoomWrap.style.display = 'flex';
        }

        if (caps.torch && torchBtn) {
            torchBtn.style.display = 'flex';
        }

        if (overlay && (zoomWrap.style.display === 'flex' || torchBtn.style.display === 'flex')) {
            overlay.style.display = 'flex';
        }
    }

    function toggleTorch() {
        if (!currentVideoTrack) return;
        const nextState = !torchOn;
        currentVideoTrack.applyConstraints({ advanced: [{ torch: nextState }] })
            .then(() => {
                torchOn = nextState;
                const torchBtn = document.getElementById('torchToggleBtn');
                if (torchBtn) torchBtn.classList.toggle('active', torchOn);
            })
            .catch(() => {});
    }

    function getCoverCropRect(videoElement, container) {
        const vw = videoElement.videoWidth, vh = videoElement.videoHeight;
        const cw = container ? container.clientWidth : 0, ch = container ? container.clientHeight : 0;
        if (!vw || !vh || !cw || !ch) return { sx: 0, sy: 0, sWidth: vw, sHeight: vh };
        const videoRatio = vw / vh;
        const containerRatio = cw / ch;
        let sWidth, sHeight;
        if (videoRatio > containerRatio) {
            sHeight = vh;
            sWidth = Math.round(vh * containerRatio);
        } else {
            sWidth = vw;
            sHeight = Math.round(vw / containerRatio);
        }
        return { sx: Math.round((vw - sWidth) / 2), sy: Math.round((vh - sHeight) / 2), sWidth, sHeight };
    }

    function startFastNativeScan(videoElement) {
        nativeLoopActive = true;
        const container = document.getElementById('video-container');
        let lastCheck = 0;
        let nextDelay = LIVE_SCAN_MIN_INTERVAL_MS;
        async function renderLoop(timestamp) {
            if (!currentStream || !isCameraScanning || !nativeLoopActive) return;
            if (timestamp - lastCheck > nextDelay) {
                if (!isModalOpen && videoElement && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0 && takeFreshVideoFrame(videoElement)) {
                    lastCheck = timestamp;
                    const startedAt = (window.performance && performance.now) ? performance.now() : Date.now();
                    try {
                        const crop = getCoverCropRect(videoElement, container);
                        const bitmap = await createImageBitmap(videoElement, crop.sx, crop.sy, crop.sWidth, crop.sHeight);
                        try {
                            const barcodes = await nativeDetector.detect(bitmap);
                            const confirmed = barcodes && barcodes.length > 0 ? confirmLiveScan(barcodes[0].rawValue) : '';
                            if (confirmed && !isModalOpen && currentStream && isCameraScanning && nativeLoopActive) {
                                processScannedCode(confirmed);
                            }
                        } finally {
                            bitmap.close();
                        }
                    } catch (e) {
                    } finally {
                        const now = (window.performance && performance.now) ? performance.now() : Date.now();
                        nextDelay = Math.min(LIVE_SCAN_MAX_INTERVAL_MS, Math.max(LIVE_SCAN_MIN_INTERVAL_MS, Math.round((now - startedAt) * LIVE_SCAN_BACKOFF)));
                    }
                }
            }
            if (currentStream && isCameraScanning && nativeLoopActive) {
                scheduleScanFrame(videoElement, renderLoop);
            }
        }
        scheduleScanFrame(videoElement, renderLoop);
    }

    let ownCaptureCanvas = null;
    let ownCaptureCtx = null;
    const SCAN_FORMAT_NAMES = ['Code128'];
    const CONFIG_QR_FORMAT_NAMES = ['QRCode'];
    const CONFIG_QR_SCAN_WIDTH = 640;
    const NATIVE_SCAN_FORMAT_NAMES = ['code_128'];
    const LIVE_SCAN_WIDTH_STEPS = [640, 800, 1024, 1280];
    const LIVE_SCAN_MAX_DIM = 1280;
    const LIVE_SCAN_MAX_BAND_PX = 240;
    const LIVE_SCAN_MAX_FPS = 120;
    const LIVE_SCAN_MIN_FPS = 10;
    const LIVE_SCAN_MIN_INTERVAL_MS = Math.round(1000 / LIVE_SCAN_MAX_FPS);
    const LIVE_SCAN_MAX_INTERVAL_MS = Math.round(1000 / LIVE_SCAN_MIN_FPS);
    const LIVE_SCAN_BACKOFF = 1.6;
    const LIVE_SCAN_SLOW_MS = 22;
    const LIVE_SCAN_FAST_MS = 9;
    const FRESH_FRAME_GIVE_UP = 20;
    const SCAN_CONFIRM_REPEATS = 2;
    const SCAN_CONFIRM_WINDOW_MS = 1500;

    function liveScanTargetWidth() {
        if (liveScanWidthIndex < 0) liveScanWidthIndex = LIVE_SCAN_WIDTH_STEPS.length - 1;
        return Math.min(LIVE_SCAN_MAX_DIM, LIVE_SCAN_WIDTH_STEPS[liveScanWidthIndex]);
    }

    function noteLiveScanCost(ms) {
        if (!isFinite(ms) || ms < 0) return;
        liveScanCostEma = liveScanCostEma ? (liveScanCostEma * 0.7 + ms * 0.3) : ms;
        if (liveScanCostEma > LIVE_SCAN_SLOW_MS && liveScanWidthIndex > 0) {
            liveScanWidthIndex--;
            liveScanCostEma = 0;
        } else if (liveScanCostEma < LIVE_SCAN_FAST_MS && liveScanWidthIndex < LIVE_SCAN_WIDTH_STEPS.length - 1) {
            liveScanWidthIndex++;
            liveScanCostEma = 0;
        }
    }

    function resetLiveScanQuality() {
        liveScanWidthIndex = LIVE_SCAN_WIDTH_STEPS.length - 1;
        liveScanCostEma = 0;
        lastDecodedVideoTime = -1;
        staleFrameStreak = 0;
        freshFrameGateUsable = true;
    }

    function liveScanFrameSize(crop) {
        const targetWidth = Math.max(1, Math.min(crop.sWidth, liveScanTargetWidth()));
        const scale = targetWidth / (crop.sWidth || 1);
        const targetHeight = Math.max(1, Math.min(Math.round(crop.sHeight * scale), LIVE_SCAN_MAX_BAND_PX));
        return { width: Math.round(targetWidth), height: targetHeight };
    }

    function takeFreshVideoFrame(videoElement) {
        if (!videoElement) return false;
        if (!freshFrameGateUsable) return true;
        const stamp = videoElement.currentTime;
        if (stamp !== lastDecodedVideoTime) {
            lastDecodedVideoTime = stamp;
            staleFrameStreak = 0;
            return true;
        }
        staleFrameStreak++;
        if (staleFrameStreak >= FRESH_FRAME_GIVE_UP) {
            freshFrameGateUsable = false;
            staleFrameStreak = 0;
            return true;
        }
        return false;
    }

    function scheduleScanFrame(videoElement, fn) {
        if (videoElement && typeof videoElement.requestVideoFrameCallback === 'function') {
            try {
                videoElement.requestVideoFrameCallback((now) => fn(now));
                return;
            } catch (e) {}
        }
        requestAnimationFrame(fn);
    }

    function scanEngineReady() {
        return typeof ZXingWASM !== 'undefined' && typeof ZXingWASM.readBarcodes === 'function';
    }

    function buildReaderOptions(tryHarder, formats) {
        return {
            formats: formats || SCAN_FORMAT_NAMES,
            tryHarder: !!tryHarder,
            tryRotate: !!tryHarder,
            tryInvert: !!tryHarder,
            tryDownscale: !!tryHarder,
            maxNumberOfSymbols: 1
        };
    }

    function initScanEngine() {
        if (!scanEngineReady()) return;
        try {
            ZXingWASM.prepareZXingModule({
                overrides: {
                    locateFile: (file, prefix) => (file.endsWith('.wasm') ? './vendor/' + file : prefix + file)
                },
                fireImmediately: true
            });
            codeReader = buildReaderOptions(true);
            liveScanCodeReader = buildReaderOptions(false);
        } catch (e) {
            console.error("Scan engine initialization error: ", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Scan engine initialization error: " });
        }
    }

    function resetScanConfirm() {
        scanConfirmCode = '';
        scanConfirmCount = 0;
        scanConfirmAt = 0;
    }

    function confirmLiveScan(code) {
        const text = String(code || '').trim();
        if (!text) return '';
        const now = Date.now();
        if (text !== scanConfirmCode || elapsedSince(scanConfirmAt) > SCAN_CONFIRM_WINDOW_MS) {
            scanConfirmCode = text;
            scanConfirmCount = 1;
            scanConfirmAt = now;
            return '';
        }
        scanConfirmAt = now;
        scanConfirmCount++;
        if (scanConfirmCount < SCAN_CONFIRM_REPEATS) return '';
        resetScanConfirm();
        return text;
    }

    function decodeBarcodeFromCanvasManual(options, canvas) {
        if (!scanEngineReady() || !options) return Promise.resolve('');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return Promise.resolve('');
        let imageData;
        try {
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
            return Promise.resolve('');
        }
        return ZXingWASM.readBarcodes(imageData, options).then(readResultText, () => '');
    }

    function readResultText(results) {
        if (!results || !results.length) return '';
        const first = results[0];
        if (!first || first.isValid === false) return '';
        return String(first.text || '');
    }

    function decodeLiveFrame(canvas) {
        if (!liveScanCodeReader) return Promise.resolve('');
        return decodeBarcodeFromCanvasManual(liveScanCodeReader, canvas);
    }

    function startZxingVideoScan(videoElement) {
        zxingLoopActive = true;
        const container = document.getElementById('video-container');

        if (!ownCaptureCanvas) {
            ownCaptureCanvas = document.createElement('canvas');
            ownCaptureCtx = ownCaptureCanvas.getContext('2d', { willReadFrequently: true });
        }

        let lastCheck = 0;
        let nextDelay = LIVE_SCAN_MIN_INTERVAL_MS;
        let liveDecodeBusy = false;
        function loop(timestamp) {
            if (!currentStream || !isCameraScanning || !zxingLoopActive) return;
            if (timestamp - lastCheck > nextDelay) {
                if (!liveDecodeBusy && !isModalOpen && videoElement && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0 && takeFreshVideoFrame(videoElement)) {
                    lastCheck = timestamp;
                    const startedAt = (window.performance && performance.now) ? performance.now() : Date.now();
                    const settleDecode = () => {
                        liveDecodeBusy = false;
                        const now = (window.performance && performance.now) ? performance.now() : Date.now();
                        const spent = now - startedAt;
                        noteLiveScanCost(spent);
                        nextDelay = Math.min(LIVE_SCAN_MAX_INTERVAL_MS, Math.max(LIVE_SCAN_MIN_INTERVAL_MS, Math.round(spent * LIVE_SCAN_BACKOFF)));
                    };

                    try {
                        const crop = getCoverCropRect(videoElement, container);
                        const size = liveScanFrameSize(crop);
                        if (ownCaptureCanvas.width !== size.width) ownCaptureCanvas.width = size.width;
                        if (ownCaptureCanvas.height !== size.height) ownCaptureCanvas.height = size.height;
                        ownCaptureCtx.drawImage(videoElement, crop.sx, crop.sy, crop.sWidth, crop.sHeight, 0, 0, size.width, size.height);

                        liveDecodeBusy = true;
                        decodeLiveFrame(ownCaptureCanvas).then((text) => {
                            settleDecode();
                            const confirmed = confirmLiveScan(text);
                            if (confirmed && !isModalOpen) {
                                processScannedCode(confirmed);
                            }
                        }, settleDecode);
                    } catch (e) {
                        settleDecode();
                    }
                }
            }
            if (currentStream && isCameraScanning && zxingLoopActive) {
                scheduleScanFrame(videoElement, loop);
            }
        }
        scheduleScanFrame(videoElement, loop);
    }

    function processScannedCode(code) {
        if (isModalOpen || !code) return;
        let currentTime = Date.now();
        if (code !== lastScannedCode || elapsedSince(lastScanTime) > 2500) {
            lastScannedCode = code;
            lastScanTime = currentTime;
            triggerScanAction(code);
        }
    }

    function debouncedSearchByPhone() {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            searchByPhone();
        }, 300);
    }

    let lastRecallSignature = '';
    let pendingHistoryViewRefresh = null;

    function scheduleHistoryViewRefresh() {
        if (pendingHistoryViewRefresh) return;
        pendingHistoryViewRefresh = setTimeout(() => {
            pendingHistoryViewRefresh = null;
            refreshCurrentHistoryView();
        }, 0);
    }

    function refreshCurrentHistoryView() {
        const phoneInput = document.getElementById('searchPhoneInput');
        if (phoneInput && sanitizePhoneNumber(phoneInput.value)) searchByPhone();
        else applyCurrentFilter();
    }

    function sweepRecallHighlights() {
        if (!scanHistory || !scanHistory.length) return;
        const now = getServerNow();
        let signature = '';
        scanHistory.forEach((item) => {
            if ((item.callMark === 'no-answer' || item.callMark === 'no-connect') && item.callMarkTime && (now - item.callMarkTime) >= FOUR_HOURS_MS) {
                signature += item.id + ',';
            }
        });
        if (signature === lastRecallSignature) return;
        lastRecallSignature = signature;
        refreshCurrentHistoryView();
    }

    const PHONE_SUGGEST_MAX = 12;
    const RECENT_PHONES_MAX = 300;
    let phoneSuggestItems = [];
    let phoneSuggestActiveIndex = -1;
    let phoneSuggestHideTimer = null;

    function normalizePhoneDigits(value) {
        return String(value === null || value === undefined ? '' : value).replace(/[^0-9]/g, '');
    }

    function collectPhoneSuggestions(rawQuery, limit) {
        const queryDigits = normalizePhoneDigits(rawQuery);
        const byPhone = new Map();
        scanHistory.forEach((item) => {
            if (!item || !item.phone || item.phone === "គ្មានលេខ") return;
            const digits = normalizePhoneDigits(item.phone);
            if (!digits) return;
            if (queryDigits && digits.indexOf(queryDigits) === -1) return;
            const stamp = item.createdAt || parseTimestampFromId(item.id) || 0;
            const packages = (item.barcodes && item.barcodes.length) ? item.barcodes.length : 1;
            const found = byPhone.get(item.phone);
            if (found) {
                found.packages += packages;
                if (stamp > found.stamp) found.stamp = stamp;
            } else {
                byPhone.set(item.phone, { phone: item.phone, digits: digits, packages: packages, stamp: stamp });
            }
        });
        const rankOf = (digits) => {
            if (!queryDigits) return 1;
            if (digits.endsWith(queryDigits)) return 0;
            if (digits.startsWith(queryDigits)) return 1;
            return 2;
        };
        return Array.from(byPhone.values()).sort((a, b) => {
            const rankA = rankOf(a.digits);
            const rankB = rankOf(b.digits);
            if (rankA !== rankB) return rankA - rankB;
            return b.stamp - a.stamp;
        }).slice(0, limit || PHONE_SUGGEST_MAX);
    }

    function renderPhoneSuggestions(matches) {
        const box = document.getElementById('phoneSuggestBox');
        if (!box) return;
        box.textContent = '';
        phoneSuggestItems = matches;
        phoneSuggestActiveIndex = -1;
        matches.forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'phone-suggest-item';
            row.setAttribute('data-index', String(index));
            const number = document.createElement('span');
            number.className = 'phone-suggest-number';
            number.textContent = entry.phone;
            const meta = document.createElement('span');
            meta.className = 'phone-suggest-meta';
            meta.textContent = entry.packages + ' កញ្ចប់';
            row.appendChild(number);
            row.appendChild(meta);
            box.appendChild(row);
        });
    }

    function cssPx(value) {
        return (Math.round(value * 1000) / 1000) + 'px';
    }

    function positionPhoneSuggestBox() {
        const phoneInput = document.getElementById('searchPhoneInput');
        const box = document.getElementById('phoneSuggestBox');
        if (!phoneInput || !box || !box.classList.contains('show')) return;
        const rect = phoneInput.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight || (rect.width === 0 && rect.height === 0)) {
            hidePhoneSuggestions();
            return;
        }
        const width = cssPx(rect.width);
        if (box.style.width !== width) box.style.width = width;
        const left = cssPx(rect.left);
        if (box.style.left !== left) box.style.left = left;
        const boxHeight = box.offsetHeight;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = (spaceBelow < boxHeight + 12 && rect.top > boxHeight + 12) ?
            cssPx(rect.top - boxHeight - 4) : cssPx(rect.bottom + 4);
        if (box.style.top !== top) box.style.top = top;
    }

    function showPhoneSuggestions() {
        const phoneInput = document.getElementById('searchPhoneInput');
        const box = document.getElementById('phoneSuggestBox');
        if (!phoneInput || !box) return;
        if (phoneSuggestHideTimer) { clearTimeout(phoneSuggestHideTimer); phoneSuggestHideTimer = null; }
        if (document.activeElement !== phoneInput) return;
        const matches = collectPhoneSuggestions(phoneInput.value);
        if (!matches.length) {
            hidePhoneSuggestions();
            return;
        }
        renderPhoneSuggestions(matches);
        box.classList.add('show');
        positionPhoneSuggestBox();
    }

    function hidePhoneSuggestions() {
        if (phoneSuggestHideTimer) { clearTimeout(phoneSuggestHideTimer); phoneSuggestHideTimer = null; }
        phoneSuggestItems = [];
        phoneSuggestActiveIndex = -1;
        const box = document.getElementById('phoneSuggestBox');
        if (!box) return;
        box.classList.remove('show');
        box.textContent = '';
    }

    function setPhoneSuggestActive(index) {
        const box = document.getElementById('phoneSuggestBox');
        if (!box) return;
        const rows = box.querySelectorAll('.phone-suggest-item');
        if (!rows.length) return;
        let target = index;
        if (target < 0) target = rows.length - 1;
        if (target >= rows.length) target = 0;
        phoneSuggestActiveIndex = target;
        rows.forEach((row, i) => {
            if (i === target) row.classList.add('active');
            else row.classList.remove('active');
        });
        rows[target].scrollIntoView({ block: 'nearest' });
    }

    function applyPhoneSuggestion(phone) {
        const phoneInput = document.getElementById('searchPhoneInput');
        if (!phoneInput) return;
        phoneInput.value = phone;
        hidePhoneSuggestions();
        searchByPhone();
    }


    function setPhoneSearchPulledUp(on) {
        const sidebar = document.getElementById('dataSideSection');
        if (!sidebar) return;
        if (on && window.innerWidth >= 992) return;
        const already = sidebar.classList.contains('search-focus');
        if (already === !!on) return;
        sidebar.classList.toggle('search-focus', !!on);
        if (on) { showAppChrome(); sidebar.classList.remove('collapsed'); }
        syncHistoryExpandedLock();
        positionPhoneSuggestBox();
        setTimeout(positionPhoneSuggestBox, 180);
        setTimeout(positionPhoneSuggestBox, 340);
    }

    function setupPhoneSuggestions() {
        const phoneInput = document.getElementById('searchPhoneInput');
        const box = document.getElementById('phoneSuggestBox');
        if (!phoneInput || !box) return;
        phoneInput.addEventListener('input', showPhoneSuggestions);
        phoneInput.addEventListener('focus', () => {
            setPhoneSearchPulledUp(true);
            showPhoneSuggestions();
        });
        phoneInput.addEventListener('blur', () => {
            if (phoneSuggestHideTimer) clearTimeout(phoneSuggestHideTimer);
            phoneSuggestHideTimer = setTimeout(() => {
                hidePhoneSuggestions();
                if (!phoneInput.value.trim()) setPhoneSearchPulledUp(false);
            }, 150);
        });
        phoneInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hidePhoneSuggestions();
                return;
            }
            if (e.key === 'Enter') {
                if (phoneSuggestActiveIndex >= 0 && phoneSuggestItems[phoneSuggestActiveIndex]) {
                    e.preventDefault();
                    applyPhoneSuggestion(phoneSuggestItems[phoneSuggestActiveIndex].phone);
                } else {
                    hidePhoneSuggestions();
                    searchByPhone();
                }
                return;
            }
            if (!phoneSuggestItems.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setPhoneSuggestActive(phoneSuggestActiveIndex + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setPhoneSuggestActive(phoneSuggestActiveIndex - 1);
            }
        });
        box.addEventListener('mousedown', (e) => { e.preventDefault(); });
        box.addEventListener('click', (e) => {
            const row = e.target && e.target.closest ? e.target.closest('.phone-suggest-item') : null;
            if (!row) return;
            const index = parseInt(row.getAttribute('data-index'), 10);
            if (isNaN(index) || !phoneSuggestItems[index]) return;
            applyPhoneSuggestion(phoneSuggestItems[index].phone);
        });
        let positionFrame = null;
        const schedulePositionPhoneSuggestBox = () => {
            if (positionFrame !== null) return;
            positionFrame = requestAnimationFrame(() => {
                positionFrame = null;
                positionPhoneSuggestBox();
            });
        };
        window.addEventListener('scroll', schedulePositionPhoneSuggestBox, { capture: true, passive: true });
        window.addEventListener('resize', schedulePositionPhoneSuggestBox);
    }

    function searchByPhone() {
        const phoneInput = document.getElementById('searchPhoneInput');
        let phoneQuery = sanitizePhoneNumber(phoneInput ? phoneInput.value : '');
        if (!phoneQuery) {
            applyCurrentFilter();
            return;
        }
        const queryDigits = normalizePhoneDigits(phoneQuery);
        let searched = scanHistory.filter(item => {
            if (!item.phone) return false;
            if (!queryDigits) return item.phone.includes(phoneQuery);
            return normalizePhoneDigits(item.phone).indexOf(queryDigits) !== -1;
        });
        renderHistory(searched);
        updateDailyScheduleStats(searched, true);
    }

    function decodeImageFile(e) {
        if (!e.target.files || e.target.files.length === 0) return;
        const f = e.target.files[0];
        e.target.value = '';
        const reader = new FileReader();
        reader.onload = function(evt) {
            decodeBarcodeFromImageDataUrl(evt.target.result);
        };
        reader.onerror = function() {
            showToast("មិនអាចអានរូបភាពនេះបានទេ។ សូមសាកល្បងរូបភាពផ្សេង។");
        };
        reader.readAsDataURL(f);
    }
    function decodeBarcodeFromImageDataUrl(originalDataUrl) {
        if (!codeReader) return;
        const img = new Image();
        img.onload = async function () {
            const maxDim = 1600;
            const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
            const baseW = Math.round(img.naturalWidth * scale);
            const baseH = Math.round(img.naturalHeight * scale);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            for (const deg of [0, 90, 270, 180]) {
                try {
                    const swap = deg === 90 || deg === 270;
                    canvas.width = swap ? baseH : baseW;
                    canvas.height = swap ? baseW : baseH;
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.translate(canvas.width / 2, canvas.height / 2);
                    ctx.rotate(deg * Math.PI / 180);
                    ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    const text = await decodeBarcodeFromCanvasManual(codeReader, canvas);
                    if (text) {
                        triggerScanAction(text);
                        return;
                    }
                } catch (err) {
                }
            }
            showToast("រកមិនឃើញ Barcode ក្នុងរូបភាពនេះទេ។ សូមសាកល្បងថតរូបឲ្យច្បាស់ ត្រង់ៗ និងជិត Barcode ជាងនេះ ឬប្រើកាមេរ៉ាស្កេនផ្ទាល់។");
        };
        img.onerror = function () {
            showToast("រកមិនឃើញ Barcode ក្នុងរូបភាពនេះទេ។");
        };
        img.src = originalDataUrl;
    }

    function isBarcodeAlreadyUsed(code) {
        const normalized = String(code || '').trim().toUpperCase();
        if (!normalized) return false;
        const matchesCode = (item) => {
            if (item.barcodes && Array.isArray(item.barcodes) && item.barcodes.some(b => String(b.code || '').trim().toUpperCase() === normalized)) return true;
            return !!(item.barcode && String(item.barcode).trim().toUpperCase() === normalized);
        };
        return scanHistory.some(matchesCode) || deletedItems.some(matchesCode);
    }

    function barcodeRegistryKey(code) {
        const normalized = String(code || '').trim().toUpperCase();
        return normalized.replace(/[.#$\[\]\/\x00-\x1F\x7F]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
    }

    async function claimBarcodeInRegistry(code) {
        const key = barcodeRegistryKey(code);
        if (!db || !fb || !key) return 'unknown';
        try {
            const result = await fb.runTransaction(fb.ref(db, `zoew_barcode_registry/${key}`), (current) => {
                if (current === null) return true;
                return;
            });
            return result.committed ? 'claimed' : 'taken';
        } catch (e) {
            return 'unknown';
        }
    }

    function collectItemBarcodes(item) {
        if (!item) return [];
        if (item.barcodes && Array.isArray(item.barcodes) && item.barcodes.length) {
            return item.barcodes.map(b => b && b.code).filter(Boolean);
        }
        return item.barcode ? [item.barcode] : [];
    }

    function queueRegistryReleaseRetry(keys, attempts) {
        keys.forEach((key) => {
            const existing = pendingRegistryReleases.get(key);
            const nextAttempts = Math.max(attempts, existing ? existing.attempts : 0);
            if (nextAttempts >= REGISTRY_RELEASE_RETRY_MAX) return;
            if (!existing && pendingRegistryReleases.size >= REGISTRY_RELEASE_QUEUE_MAX) return;
            pendingRegistryReleases.set(key, { attempts: nextAttempts });
        });
    }

    function releaseRegistryKeys(keys) {
        if (!db || !fb || !keys.length) return Promise.resolve(true);
        const updates = {};
        keys.forEach((key) => { updates[key] = null; });
        return dbOp(fb.update(fb.ref(db, 'zoew_barcode_registry'), updates)).then(() => true, () => false);
    }

    function releaseBarcodesInRegistry(codes) {
        if (!db || !fb || !codes || !codes.length) return Promise.resolve();
        const keys = [];
        codes.forEach((code) => {
            const key = barcodeRegistryKey(code);
            if (key && keys.indexOf(key) === -1) keys.push(key);
        });
        if (!keys.length) return Promise.resolve();
        return retryAsync(() => releaseRegistryKeys(keys).then((done) => {
            if (!done) throw new Error('REGISTRY_RELEASE_FAILED');
            return true;
        }), 3, 1200).then(() => {
            keys.forEach((key) => pendingRegistryReleases.delete(key));
        }, () => {
            queueRegistryReleaseRetry(keys, 1);
        });
    }

    function registryKeyIsOwned(key) {
        const owns = (item) => collectItemBarcodes(item).some((code) => barcodeRegistryKey(code) === key);
        return scanHistory.some(owns) || deletedItems.some(owns);
    }

    function registryReleaseVerdict(key) {
        if (dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY) || dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)) return 'defer';
        return registryKeyIsOwned(key) ? 'owned' : 'release';
    }

    function flushPendingRegistryReleases() {
        if (registryReleaseFlushInFlight) return;
        if (!pendingRegistryReleases.size) return;
        if (!db || !fb) return;
        const entries = Array.from(pendingRegistryReleases.entries());
        pendingRegistryReleases.clear();
        const releasable = [];
        entries.forEach((pair) => {
            const verdict = registryReleaseVerdict(pair[0]);
            if (verdict === 'release') releasable.push(pair);
            else if (verdict === 'defer') pendingRegistryReleases.set(pair[0], { attempts: pair[1].attempts });
        });
        if (!releasable.length) return;
        registryReleaseFlushInFlight = true;
        const keys = releasable.map((pair) => pair[0]);
        releaseRegistryKeys(keys).then((done) => {
            if (!done) releasable.forEach((pair) => queueRegistryReleaseRetry([pair[0]], pair[1].attempts + 1));
        }, () => {
            releasable.forEach((pair) => queueRegistryReleaseRetry([pair[0]], pair[1].attempts + 1));
        }).then(() => { registryReleaseFlushInFlight = false; });
    }

    const LOCKER_PREFIX_KEY = 'zoe_locker_prefix';
    const LOCKER_COUNT_KEY = 'zoe_locker_count';
    const ACTIVE_LOCKER_KEY = 'zoe_active_locker';
    const ENTRY_SCAN_MODE_KEY = 'zoe_entry_scan_mode';
    const ENTRY_LIST_MAX_ROWS = 200;
    const LOCKER_LIST_MAX_ROWS = 200;
    const DELETED_LIST_MAX_ROWS = 200;
    const TRASH_CODES_PREVIEW = 2;

    let deletedSearchQuery = '';
    const expandedTrashGroups = new Set();

    let activeLocker = safeStoreGet(appLocalStore, ACTIVE_LOCKER_KEY) || '';
    let entryScanMode = safeStoreGet(appLocalStore, ENTRY_SCAN_MODE_KEY) === 'locker' ? 'locker' : 'parcel';
    let lockerBarcodeIndex = {};
    let pendingLockerCode = null;
    let lockerAssignGeneration = 0;

    function lockerCodeKey(code) {
        return String(code === null || code === undefined ? '' : code).trim().toUpperCase();
    }

    function getLockerPrefix() {
        return safeStoreGet(appLocalStore, LOCKER_PREFIX_KEY) || 'ទូ';
    }

    function getLockerCount() {
        return parseInt(safeStoreGet(appLocalStore, LOCKER_COUNT_KEY) || '24') || 24;
    }

    function isValidLockerName(value) {
        const locker = String(value || '').trim();
        return locker.length > 0 && locker.length <= 64 && locker.toUpperCase() !== 'N/A';
    }

    function buildLockerBarcodeIndex() {
        const idx = {};
        scanHistory.forEach((item) => {
            if (!item || !item.id) return;
            if (Array.isArray(item.barcodes) && item.barcodes.length) {
                item.barcodes.forEach((b, i) => {
                    if (!b || typeof b !== 'object') return;
                    const key = lockerCodeKey(b.code);
                    if (key) idx[key] = { itemId: item.id, barcodeIdx: i, item };
                });
                return;
            }
            const legacyKey = lockerCodeKey(item.barcode);
            if (legacyKey) idx[legacyKey] = { itemId: item.id, barcodeIdx: null, item };
        });
        lockerBarcodeIndex = idx;
    }

    function getEntryCurrentLocker(entry) {
        if (!entry) return null;
        const { barcodeIdx, item } = entry;
        if (barcodeIdx !== null) {
            const barcode = Array.isArray(item.barcodes) ? item.barcodes[barcodeIdx] : null;
            return (barcode && barcode.locker) || null;
        }
        return item.locker || null;
    }

    function isEntryBarcodeClosed(entry) {
        if (!entry) return false;
        const { barcodeIdx, item } = entry;
        if (barcodeIdx !== null) {
            const barcode = Array.isArray(item.barcodes) ? item.barcodes[barcodeIdx] : null;
            return !!(barcode && barcode.isClosed);
        }
        return !!item.isClosed;
    }

    function findLockerOccupant(locker, excludeCode, excludeItemId) {
        for (const code in lockerBarcodeIndex) {
            if (code === excludeCode) continue;
            const entry = lockerBarcodeIndex[code];
            if (excludeItemId && entry.itemId === excludeItemId) continue;
            if (isEntryBarcodeClosed(entry)) continue;
            if (getEntryCurrentLocker(entry) === locker) return { code, entry };
        }
        return null;
    }

    function lockerSuccessFeedback() {
        playBeep();
        if (navigator.vibrate) navigator.vibrate(150);
    }

    function lockerErrorFeedback() {
        if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
    }

    function openLockerSettingsModal() {
        const prefixInput = document.getElementById('lockerPrefixInput');
        const countInput = document.getElementById('lockerCountInput');
        if (prefixInput) prefixInput.value = getLockerPrefix();
        if (countInput) countInput.value = getLockerCount();
        openModalHelper('lockerSettingsModal');
    }

    function saveLockerSettings() {
        const prefixInput = document.getElementById('lockerPrefixInput');
        const countInput = document.getElementById('lockerCountInput');
        const prefix = (prefixInput ? prefixInput.value.trim() : '') || 'ទូ';
        const count = Math.min(200, Math.max(1, parseInt(countInput ? countInput.value : '', 10) || 24));
        safeStoreSet(appLocalStore, LOCKER_PREFIX_KEY, prefix);
        safeStoreSet(appLocalStore, LOCKER_COUNT_KEY, String(count));
        closeModal('lockerSettingsModal');
        renderLockerGrid();
        showToast('✅ បានរក្សាទុកការកំណត់ទូ');
    }

    function renderLockerGrid() {
        const grid = document.getElementById('lockerGrid');
        if (!grid) return;
        const prefix = getLockerPrefix();
        const count = getLockerCount();
        const frag = document.createDocumentFragment();
        for (let i = 1; i <= count; i++) {
            const val = `${prefix}${i}`;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'locker-cell' + (val === activeLocker ? ' current' : '');
            btn.textContent = val;
            btn.addEventListener('click', () => chooseLocker(val));
            frag.appendChild(btn);
        }
        grid.innerHTML = '';
        grid.appendChild(frag);
    }

    function openLockerPicker() {
        if (!isValidLockerName(activeLocker)) {
            activeLocker = '';
            safeStoreRemove(appLocalStore, ACTIVE_LOCKER_KEY);
        }
        renderLockerGrid();
        openModalHelper('lockerPickerModal');
    }

    function chooseLocker(val) {
        const locker = String(val || '').trim();
        if (!isValidLockerName(locker)) {
            showToast('⚠️ ទីតាំង Locker មិនត្រឹមត្រូវទេ។ សូមជ្រើសរើសទីតាំងពិតប្រាកដ។');
            return;
        }
        activeLocker = locker;
        safeStoreSet(appLocalStore, ACTIVE_LOCKER_KEY, locker);
        closeModal('lockerPickerModal');
        updateActiveLockerLabel();
        showToast(`📍 ទីតាំងបច្ចុប្បន្ន៖ ${locker}`);
        safeFocusScanner();
    }

    function selectCustomLocker() {
        const input = document.getElementById('customLockerInput');
        if (!input) return;
        const val = input.value.trim();
        if (!isValidLockerName(val)) {
            showToast('សូមបញ្ចូលទីតាំងពិតប្រាកដ (មិនអាចជា N/A និងមិនលើស 64 តួអក្សរ)!');
            return;
        }
        input.value = '';
        chooseLocker(val);
    }

    function updateActiveLockerLabel() {
        const label = document.getElementById('activeLockerLabel');
        if (label) label.innerText = activeLocker || '-';
    }

    function setEntryScanMode(mode) {
        entryScanMode = mode === 'locker' ? 'locker' : 'parcel';
        safeStoreSet(appLocalStore, ENTRY_SCAN_MODE_KEY, entryScanMode);
        const parcelBtn = document.getElementById('modeParcelBtn');
        const lockerBtn = document.getElementById('modeLockerBtn');
        if (parcelBtn) parcelBtn.classList.toggle('active', entryScanMode === 'parcel');
        if (lockerBtn) lockerBtn.classList.toggle('active', entryScanMode === 'locker');
        const lockerPanel = document.getElementById('lockerPanel');
        if (lockerPanel) lockerPanel.classList.toggle('hidden', entryScanMode !== 'locker');
        const parcelPanel = document.getElementById('parcelPanel');
        if (parcelPanel) parcelPanel.classList.toggle('hidden', entryScanMode !== 'parcel');
        if (entryScanMode === 'parcel') renderEntryList();
        const hwInput = document.getElementById('hwScannerInput');
        if (hwInput) hwInput.placeholder = entryScanMode === 'locker' ? 'ស្កេន Barcode ដើម្បីកំណត់ទីតាំង...' : 'ស្កេន Barcode...';
        if (entryScanMode === 'locker') {
            buildLockerBarcodeIndex();
            renderLockerList();
            updateActiveLockerLabel();
            if (!isValidLockerName(activeLocker)) openLockerPicker();
        }
        safeFocusScanner();
    }

    function handleLockerScan(code) {
        const key = lockerCodeKey(code);
        if (!key) return;
        if (!isValidLockerName(activeLocker)) {
            lockerErrorFeedback();
            showToast('⚠️ សូមជ្រើសរើសទីតាំង Locker សិន!');
            openLockerPicker();
            return;
        }
        const entry = lockerBarcodeIndex[key];
        if (!entry) {
            lockerErrorFeedback();
            showToast(`❌ រកមិនឃើញ Barcode "${key}" ក្នុងប្រព័ន្ធ! សូមបញ្ចូលកញ្ចប់នេះជាមុនសិន។`);
            safeFocusScanner();
            return;
        }
        const currentLocker = getEntryCurrentLocker(entry);
        const hasLocker = !!(currentLocker && currentLocker !== 'N/A');

        if (hasLocker && currentLocker === activeLocker) {
            lockerSuccessFeedback();
            showToast(`✅ កញ្ចប់នេះស្ថិតនៅ ${activeLocker} រួចហើយ`);
            safeFocusScanner();
            return;
        }

        if (hasLocker) {
            lockerErrorFeedback();
            pendingLockerCode = key;
            const phoneRaw = entry.item.phone ? sanitizePhoneNumber(entry.item.phone) : '';
            const who = phoneRaw ? ` (${phoneRaw})` : '';
            let msg = `កញ្ចប់ "${key}"${who} កំពុងស្ថិតនៅទីតាំង ${currentLocker} ។ តើអ្នកចង់ផ្លាស់ទីកញ្ចប់នេះទៅ ${activeLocker} មែនទេ?`;
            const occupant = findLockerOccupant(activeLocker, key, entry.itemId);
            if (occupant) {
                const occPhoneRaw = occupant.entry.item.phone ? sanitizePhoneNumber(occupant.entry.item.phone) : '';
                const occWho = occPhoneRaw ? ` (${occPhoneRaw})` : '';
                msg += ` (ចំណាំ៖ ទីតាំង ${activeLocker} មានកញ្ចប់ "${occupant.code}"${occWho} ស្ថិតនៅរួចហើយ)`;
            }
            const warnText = document.getElementById('locationWarningText');
            if (warnText) warnText.innerText = msg;
            openModalHelper('locationWarningModal');
            return;
        }

        assignLockerToEntry(key);
    }

    function cancelLocationChange() {
        pendingLockerCode = null;
        closeModal('locationWarningModal');
        safeFocusScanner();
    }

    function confirmLocationChange() {
        const code = pendingLockerCode;
        pendingLockerCode = null;
        closeModal('locationWarningModal');
        if (code) assignLockerToEntry(code);
    }

    async function assignLockerToEntry(code) {
        const key = lockerCodeKey(code);
        const entry = lockerBarcodeIndex[key];
        if (!entry) {
            lockerErrorFeedback();
            showToast(`❌ Barcode "${key}" លែងមានក្នុងប្រព័ន្ធទៀតហើយ! សូមស្កេនម្តងទៀត`);
            return;
        }
        const targetLocker = activeLocker;
        if (!isValidLockerName(targetLocker)) {
            lockerErrorFeedback();
            showToast('⚠️ សូមជ្រើសរើសទីតាំង Locker ពិតប្រាកដសិន។');
            openLockerPicker();
            return;
        }
        if (!db || !fb) {
            lockerErrorFeedback();
            showToast('⚠️ មិនទាន់ភ្ជាប់ Firebase ទេ! សូមសាកល្បងម្តងទៀត។');
            return;
        }
        const itemId = entry.itemId;
        if (!/^[a-zA-Z0-9_-]+$/.test(String(itemId || ''))) {
            lockerErrorFeedback();
            showToast('⚠️ លេខសម្គាល់កញ្ចប់មិនត្រឹមត្រូវទេ!');
            return;
        }

        const ts = getServerNow();
        const updatedBy = (auth && auth.currentUser && (auth.currentUser.email || auth.currentUser.uid)) || '';
        const previousLocker = getEntryCurrentLocker(entry);
        const phoneRaw = entry.item.phone ? sanitizePhoneNumber(entry.item.phone) : '';
        const who = phoneRaw ? ` (${phoneRaw})` : '';
        const successMsg = (previousLocker && previousLocker !== 'N/A' && previousLocker !== targetLocker)
            ? `✅ ផ្លាស់ទីកញ្ចប់${who} ពី ${previousLocker} ➜ ${targetLocker}`
            : `✅ បានកំណត់ទីតាំង ${targetLocker}${who}`;

        const myGeneration = ++lockerAssignGeneration;
        let applied = false;
        let reported = false;

        const applyLockerTo = (item) => {
            const entries = barcodeEntriesOf(item.barcodes).filter((e) => e.barcode && typeof e.barcode === 'object');
            if (entries.length) {
                const match = entries.find((e) => lockerCodeKey(e.barcode.code) === key);
                if (!match) return item;
                normalizeBarcodesOf(item);
                const target = item.barcodes.find((b) => lockerCodeKey(b.code) === key);
                if (!target) return item;
                target.locker = targetLocker;
                target.lockerUpdatedAt = ts;
                if (updatedBy) target.lockerUpdatedBy = updatedBy;
                applied = true;
                return item;
            }
            if (lockerCodeKey(item.barcode) !== key) return item;
            item.locker = targetLocker;
            item.lockerUpdatedAt = ts;
            if (updatedBy) item.lockerUpdatedBy = updatedBy;
            applied = true;
            return item;
        };

        const patchLocalEntry = () => {
            const liveEntry = lockerBarcodeIndex[key];
            if (!liveEntry || liveEntry.itemId !== itemId) return;
            if (liveEntry.barcodeIdx !== null) {
                const barcode = Array.isArray(liveEntry.item.barcodes) ? liveEntry.item.barcodes[liveEntry.barcodeIdx] : null;
                if (!barcode) return;
                barcode.locker = targetLocker;
                barcode.lockerUpdatedAt = ts;
                if (updatedBy) barcode.lockerUpdatedBy = updatedBy;
                return;
            }
            liveEntry.item.locker = targetLocker;
            liveEntry.item.lockerUpdatedAt = ts;
            if (updatedBy) liveEntry.item.lockerUpdatedBy = updatedBy;
        };

        const reportResult = (result, late) => {
            if (reported) return;
            reported = true;
            if (!result || !result.committed || !applied) {
                lockerErrorFeedback();
                showToast('⚠️ កញ្ចប់នេះបានផ្លាស់ប្តូរពីឧបករណ៍ផ្សេងរួចហើយ។ សូមស្កេនម្តងទៀត។');
                return;
            }
            patchLocalEntry();
            renderLockerList();
            refreshCurrentHistoryView();
            if (myGeneration === lockerAssignGeneration) lockerSuccessFeedback();
            showToast(late ? `✅ ទីតាំង ${targetLocker} បានចុះយឺត ប៉ុន្តែជោគជ័យ! មិនបាច់ស្កេនម្តងទៀតទេ។` : successMsg);
            safeFocusScanner();
        };

        const reportFailure = (err) => {
            if (reported) return;
            reported = true;
            console.error('Locker assignment failed: ', err);
            if (window.ZoeErrors) ZoeErrors.capture(err, { context: 'assignLockerToEntry' });
            lockerErrorFeedback();
            showToast('❌ មានបញ្ហា! មិនអាចរក្សាទុកទីតាំងបានទេ សូមព្យាយាមម្តងទៀត');
        };

        const writePromise = fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${itemId}`), (currentItem) => {
            applied = false;
            if (!currentItem || typeof currentItem !== 'object') return currentItem;
            return applyLockerTo({ ...currentItem });
        });

        try {
            const result = await withTimeout(writePromise, 12000, 'Save timed out');
            reportResult(result, false);
        } catch (err) {
            if (err && err.message === 'Save timed out') {
                writePromise.then((result) => reportResult(result, true), reportFailure);
                showToast('⏳ កំពុងរក្សាទុកទីតាំង… សូមកុំស្កេន Barcode នេះម្ដងទៀត។');
                return;
            }
            reportFailure(err);
        }
    }

    function entryPageIsVisible() {
        const page = document.getElementById('pageEntry');
        return !!(page && page.classList.contains('active'));
    }

    function refreshEntryPagePanels() {
        if (currentAppPage !== 'entry' || !entryPageIsVisible()) return;
        if (entryScanMode === 'locker') {
            buildLockerBarcodeIndex();
            renderLockerList();
            return;
        }
        renderEntryList();
    }

    function renderEntryList() {
        const tbody = document.getElementById('entryListTableBody');
        const emptyState = document.getElementById('entryListEmptyState');
        const countEl = document.getElementById('entryListCount');
        if (!tbody) return;

        const searchInput = document.getElementById('entryListSearchInput');
        const search = (searchInput ? searchInput.value : '').trim().toLowerCase();
        const searchDigits = normalizePhoneDigits(search);
        const todayStr = getFormattedDate(new Date(getServerNow()));

        let rows = scanHistory.filter((it) => it && it.scanDate === todayStr);
        if (search) {
            rows = rows.filter((it) => {
                const phone = sanitizePhoneNumber(it.phone || '');
                if (searchDigits && normalizePhoneDigits(phone).indexOf(searchDigits) !== -1) return true;
                const codes = Array.isArray(it.barcodes) && it.barcodes.length
                    ? it.barcodes.map((b) => String((b && b.code) || ''))
                    : [String(it.barcode || '')];
                return codes.some((c) => c.toLowerCase().includes(search));
            });
        }
        rows = rows.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (countEl) countEl.innerText = String(rows.length);

        if (!rows.length) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        if (emptyState) emptyState.classList.add('hidden');

        let html = '';
        rows.slice(0, ENTRY_LIST_MAX_ROWS).forEach((it, i) => {
            const phoneRaw = sanitizePhoneNumber(it.phone || '');
            const phoneCell = phoneRaw
                ? `<span class="phone-cell">${sanitizeInput(phoneRaw)}</span>`
                : '<span class="phone-empty">គ្មានលេខ</span>';
            const codes = Array.isArray(it.barcodes) && it.barcodes.length
                ? it.barcodes.map((b) => String((b && b.code) || ''))
                : [String(it.barcode || '')];
            const shown = codes.filter(Boolean);
            const codeText = shown.length > 1
                ? `${sanitizeInput(shown[0])} +${shown.length - 1}`
                : sanitizeInput(shown[0] || '-');
            const total = Math.round(((parseFloat(it.cod) || 0) + (parseFloat(it.dod) || 0)) * 100) / 100;
            html += `<tr>
                <td style="text-align:center;font-weight:700;color:var(--text-muted);">${i + 1}</td>
                <td>${phoneCell}<div class="scan-time-tag">${sanitizeInput(it.time || '')}</div></td>
                <td><span class="barcode-tag">${codeText}</span></td>
                <td style="text-align:right;font-weight:700;">$${total.toFixed(2)}</td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }

    function getItemLockerSummary(item) {
        const lockers = [];
        if (Array.isArray(item.barcodes) && item.barcodes.length) {
            item.barcodes.forEach((b) => {
                if (b && b.locker && b.locker !== 'N/A' && lockers.indexOf(b.locker) === -1) lockers.push(b.locker);
            });
        } else if (item.locker && item.locker !== 'N/A') {
            lockers.push(item.locker);
        }
        return lockers;
    }

    function getItemLatestLockerTs(item) {
        let ts = 0;
        if (Array.isArray(item.barcodes)) item.barcodes.forEach((b) => { if (b && b.lockerUpdatedAt) ts = Math.max(ts, parseFloat(b.lockerUpdatedAt) || 0); });
        if (item.lockerUpdatedAt) ts = Math.max(ts, parseFloat(item.lockerUpdatedAt) || 0);
        if (ts) return ts;
        const created = parseFloat(item.createdAt);
        if (isFinite(created)) return created;
        return parseTimestampFromId(item.id) || 0;
    }

    function renderLockerList() {
        const tbody = document.getElementById('lockerListTableBody');
        const filterSelect = document.getElementById('lockerListFilter');
        const emptyState = document.getElementById('lockerListEmptyState');
        if (!tbody || !filterSelect) return;

        const searchInput = document.getElementById('lockerListSearchInput');
        const search = (searchInput ? searchInput.value : '').trim().toLowerCase();

        const allLockers = new Set();
        let assigned = [];
        scanHistory.forEach((it) => {
            if (!it) return;
            const lockers = getItemLockerSummary(it);
            if (!lockers.length) return;
            lockers.forEach((l) => allLockers.add(l));
            assigned.push({ item: it, lockers: lockers, ts: getItemLatestLockerTs(it) });
        });

        const prevVal = filterSelect.value;
        let optHtml = '<option value="">ទីតាំងទាំងអស់</option>';
        Array.from(allLockers).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach((l) => {
            optHtml += `<option value="${sanitizeInput(l)}">${sanitizeInput(l)}</option>`;
        });
        if (filterSelect.innerHTML !== optHtml) {
            filterSelect.innerHTML = optHtml;
            filterSelect.value = prevVal;
        }
        const lockerFilter = filterSelect.value;

        const searchDigits = normalizePhoneDigits(search);
        if (search) {
            assigned = assigned.filter((row) => {
                const phone = sanitizePhoneNumber(row.item.phone || '');
                if (!searchDigits) return phone.toLowerCase().includes(search);
                return normalizePhoneDigits(phone).indexOf(searchDigits) !== -1;
            });
        }
        if (lockerFilter) assigned = assigned.filter((row) => row.lockers.indexOf(lockerFilter) !== -1);

        assigned.sort((a, b) => b.ts - a.ts);

        if (!assigned.length) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        if (emptyState) emptyState.classList.add('hidden');

        let html = '';
        assigned.slice(0, LOCKER_LIST_MAX_ROWS).forEach((row, i) => {
            const phoneRaw = sanitizePhoneNumber(row.item.phone || '');
            const phoneCell = phoneRaw
                ? `<span class="phone-cell">${sanitizeInput(phoneRaw)}</span>`
                : '<span class="phone-empty">គ្មានលេខ</span>';
            const lockers = row.lockers;
            const lockerText = lockers.length > 1
                ? `${sanitizeInput(lockers.join(', '))} (${lockers.length} កន្លែង)`
                : sanitizeInput(lockers[0] || '');
            html += `<tr>
                <td style="text-align:center;font-weight:700;color:var(--text-muted);">${i + 1}</td>
                <td>${phoneCell}</td>
                <td><span class="locker-badge">${lockerText}</span></td>
            </tr>`;
        });
        if (assigned.length > LOCKER_LIST_MAX_ROWS) {
            html += `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:8px;">... និងមាន ${assigned.length - LOCKER_LIST_MAX_ROWS} ជួរដេកទៀត (សូមស្វែងរក ឬច្រោះតាមទីតាំង)</td></tr>`;
        }
        tbody.innerHTML = html;
    }

    function triggerScanAction(barcode) {
        if (isModalOpen) return;

        let cleanBarcode = String(barcode || '').trim();
        if (!cleanBarcode) return;

        if (entryScanMode === 'locker') {
            handleLockerScan(cleanBarcode);
            return;
        }

        if (isBarcodeAlreadyUsed(cleanBarcode)) {
            showToast(`⚠️ លេខ Barcode នេះ (${cleanBarcode}) មានក្នុងប្រព័ន្ធរួចហើយ!`);
            if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
            safeFocusScanner();
            return;
        }

        playBeep();
        if (navigator.vibrate) navigator.vibrate(150);

        pendingBarcode = cleanBarcode;
        const modalBcText = document.getElementById('modalBarcodeText');
        if(modalBcText) modalBcText.innerText = cleanBarcode;

        const modalPhoneInput = document.getElementById('modalPhoneInput');
        if(modalPhoneInput) modalPhoneInput.value = "";

        const modalLockerInput = document.getElementById('modalLockerInput');
        if(modalLockerInput) modalLockerInput.value = lastEnteredLocker;

        const modalCodInput = document.getElementById('modalCodInput');
        if(modalCodInput) modalCodInput.value = "";
        const modalDodInput = document.getElementById('modalDodInput');
        if(modalDodInput) modalDodInput.value = "";

        clearLookupStatus();
        openModalHelper('phoneModal');
        const lookupPromise = attemptAutoLookup(cleanBarcode);

        const lookupCfg = getLookupApiConfig();
        if (!lookupCfg || !lookupCfg.enabled) {
            setTimeout(() => {
                if(modalPhoneInput) modalPhoneInput.focus();
            }, 150);
        } else {
            armLookupFocus(modalPhoneInput, cleanBarcode, lookupPromise);
        }
    }

    function dropOptimisticBarcode(code) {
        if (!code) return;
        for (let i = scanHistory.length - 1; i >= 0; i--) {
            const item = scanHistory[i];
            if (!item || !Array.isArray(item.barcodes)) continue;
            const at = item.barcodes.findIndex((b) => b && b.code === code);
            if (at === -1) continue;
            item.barcodes.splice(at, 1);
            if (!item.barcodes.length) { scanHistory.splice(i, 1); return; }
            item.count = item.barcodes.length;
            item.cod = Math.round(item.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
            item.dod = Math.round(item.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
            item.price = Math.round((item.cod + item.dod) * 100) / 100;
            return;
        }
    }

    async function confirmPhone(isSkip = false) {
        const phoneEl = document.getElementById('modalPhoneInput');
        const lockerEl = document.getElementById('modalLockerInput');
        const codEl = document.getElementById('modalCodInput');
        const dodEl = document.getElementById('modalDodInput');

        let phone = isSkip ? "គ្មានលេខ" : normalizeStoredPhone(phoneEl ? phoneEl.value : '');
        let rawLocker = lockerEl ? lockerEl.value.trim() : '';
        let locker = rawLocker;
        let cod = codEl ? (parseFloat(codEl.value) || 0) : 0;
        let dod = dodEl ? (parseFloat(dodEl.value) || 0) : 0;

        if (isNaN(cod) || cod < 0) cod = 0;
        if (isNaN(dod) || dod < 0) dod = 0;

        if (isSkip || !phone) {
            phone = "គ្មានលេខ";
        }
        if (!locker) {
            locker = "N/A";
        } else {
            lastEnteredLocker = rawLocker;
            safeStoreSet(appLocalStore, 'last_entered_locker', rawLocker);
        }

        const barcodeToSave = pendingBarcode;
        if (!barcodeToSave) {
            closeModal('phoneModal');
            showToast(`⚠️ សូមស្កេនម្ដងទៀត។`);
            return;
        }

        if (isBarcodeAlreadyUsed(barcodeToSave)) {
            closeModal('phoneModal');
            showToast(`⚠️ លេខ Barcode នេះ (${barcodeToSave}) ត្រូវបានបញ្ចូលរួចហើយ! (ប្រហែលមកពី device ផ្សេង) សូមស្កេនម្ដងទៀត។`);
            if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
            safeFocusScanner();
            return;
        }

        const skipBtn = document.getElementById('phoneModalSkipBtn');
        const confirmBtn = document.getElementById('phoneModalConfirmBtn');
        const cancelBtn = document.getElementById('phoneModalCancelBtn');
        const closeXBtn = document.getElementById('phoneModalCloseX');
        if (skipBtn) skipBtn.disabled = true;
        if (confirmBtn) confirmBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;
        if (closeXBtn) closeXBtn.disabled = true;

        try {
            const claimPromise = claimBarcodeInRegistry(barcodeToSave);
            let claim;
            try {
                claim = await withTimeout(claimPromise, 15000, 'Barcode claim timed out');
            } catch (claimError) {
                claimPromise.then((lateClaim) => {
                    if (lateClaim === 'claimed') releaseBarcodesInRegistry([barcodeToSave]);
                }, () => {});
                throw claimError;
            }
            if (claim === 'taken') {
                closeModal('phoneModal');
                showToast(`⚠️ លេខ Barcode នេះ (${barcodeToSave}) ត្រូវបានបញ្ចូលរួចហើយ! (ប្រហែលមកពី device ផ្សេង) សូមស្កេនម្ដងទៀត។`);
                if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
                safeFocusScanner();
                return;
            }

            if (claim !== 'claimed') {
                closeModal('phoneModal');
                showToast(`⚠️ មិនអាចផ្ទៀងផ្ទាត់ថា (${barcodeToSave}) ស្ទួនឬអត់ទេ (ទិន្នន័យមិនទាន់មកដល់) — សូមរង់ចាំបន្តិច ហើយស្កេនម្ដងទៀត។`);
                if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
                safeFocusScanner();
                return;
            }

            const rollbackFailedSave = () => {
                if (claim === 'claimed') releaseBarcodesInRegistry([barcodeToSave]);
                dropOptimisticBarcode(barcodeToSave);
                refreshCurrentHistoryView();
            };

            const savePromise = addOrUpdateEntry(barcodeToSave, phone, cod, dod, locker);
            try {
                await withTimeout(savePromise, 15000, 'Save timed out');
            } catch (saveError) {
                if (saveError && saveError.message === 'Save timed out') {
                    savePromise.then(() => {
                        showToast(`✅ (${barcodeToSave}) រក្សាទុកបានជោគជ័យ!`);
                        refreshCurrentHistoryView();
                    }, (lateErr) => {
                        rollbackFailedSave();
                        showToast(`⚠️ រក្សាទុក (${barcodeToSave}) បរាជ័យ! សូមស្កេនម្ដងទៀត។`);
                        if (window.ZoeErrors) ZoeErrors.capture(lateErr, { context: 'savePhoneAndSave late write' });
                    });
                    closeModal('phoneModal');
                    showToast(`⏳ កំពុងរក្សាទុក (${barcodeToSave})… សូមកុំស្កេនម្ដងទៀត។`);
                    safeFocusScanner();
                    return;
                }
                rollbackFailedSave();
                throw saveError;
            }

            closeModal('phoneModal');
            showToast("រក្សាទុកបានជោគជ័យ!");
        } catch (e) {
            showToast(`⚠️ រក្សាទុកបរាជ័យ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងស្កេន (${barcodeToSave}) ម្ដងទៀត។`);
        } finally {
            if (skipBtn) skipBtn.disabled = false;
            if (confirmBtn) confirmBtn.disabled = false;
            if (cancelBtn) cancelBtn.disabled = false;
            if (closeXBtn) closeXBtn.disabled = false;
        }
    }

    function addOrUpdateEntry(barcode, phone, cod, dod, locker = "N/A") {
        let savePromise;
        const now = new Date(getServerNow());
        const dateString = getFormattedDate(now);
        const currentTimeMillis = now.getTime();

        const timeFormatted = getFormattedClockTime(currentTimeMillis);
        const timeString = `${timeFormatted} (${dateString})`;

        let existingIndex = -1;
        if (phone !== "គ្មានលេខ") {
            existingIndex = scanHistory.findIndex(item => item.phone === phone && item.scanDate === dateString && !item.isClosed);
        }

        addRevenueToDailyAndMonthlyRecord(dateString, cod, dod, 1);
        const revertRevenueOnSaveFailure = (err) => {
            addRevenueToDailyAndMonthlyRecord(dateString, -cod, -dod, -1);
            throw err;
        };

        if (existingIndex !== -1) {
            let item = scanHistory[existingIndex];
            const itemSnapshot = { ...item, barcodes: Array.isArray(item.barcodes) ? item.barcodes.map(b => ({ ...b })) : item.barcodes };
            let mergeAddedBarcode = false;

            const mergeScannedBarcodeInto = (target) => {
                mergeAddedBarcode = false;
                normalizeBarcodesOf(target);
                if (!target.barcodes || !Array.isArray(target.barcodes)) {
                    let oldCod = parseFloat(target.cod !== undefined ? target.cod : target.price) || 0;
                    let oldDod = parseFloat(target.dod) || 0;
                    let oldCode = target.barcode || barcode;
                    let oldTime = target.time || timeString;
                    let oldIsClosed = target.isClosed || false;
                    let oldLocker = target.locker || "N/A";
                    target.barcodes = [{ code: oldCode, time: oldTime, cod: oldCod, dod: oldDod, locker: oldLocker, isClosed: oldIsClosed, isDeducted: false, isFromDeletion: false, createdAt: target.createdAt || currentTimeMillis }];
                }

                if (!target.barcodes.some(b => b && b.code === barcode)) {
                    mergeAddedBarcode = true;
                    target.barcodes.push({
                        code: barcode,
                        time: timeString,
                        cod: cod,
                        dod: dod,
                        locker: locker,
                        isClosed: false,
                        isDeducted: false,
                        isFromDeletion: false,
                        createdAt: currentTimeMillis
                    });
                }

                target.count = target.barcodes.length;
                target.cod = Math.round(target.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                target.dod = Math.round(target.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                target.price = Math.round((target.cod + target.dod) * 100) / 100;
                target.barcode = barcode;
                target.time = timeString;
                target.scanDate = dateString;
                target.isClosed = false;
                delete target.closedAt;
                target.isCalled = false;
                return target;
            };

            mergeScannedBarcodeInto(item);

            scanHistory.splice(existingIndex, 1);
            scanHistory.push(item);
            savePromise = mergeBarcodeIntoHistoryItem(item.id, mergeScannedBarcodeInto, item)
                .then((committedItem) => {
                    if (!mergeAddedBarcode) {
                        addRevenueToDailyAndMonthlyRecord(dateString, -cod, -dod, -1);
                        showToast(`⚠️ លេខ Barcode នេះ (${barcode}) មានក្នុងប្រព័ន្ធរួចហើយ!`);
                    }
                }, (err) => {
                    const revertIndex = scanHistory.findIndex(i => i.id === itemSnapshot.id);
                    if (revertIndex !== -1) scanHistory[revertIndex] = itemSnapshot;
                    refreshCurrentHistoryView();
                    return revertRevenueOnSaveFailure(err);
                });
        } else {
            let newItem = {
                id: generateUniqueId(),
                createdAt: currentTimeMillis,
                phone: phone,
                cod: cod,
                dod: dod,
                price: Math.round((cod + dod) * 100) / 100,
                count: 1,
                barcode: barcode,
                barcodes: [{ code: barcode, time: timeString, cod: cod, dod: dod, locker: locker, isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: currentTimeMillis }],
                time: timeString,
                scanDate: dateString,
                isClosed: false,
                isCalled: false
            };

            scanHistory.push(newItem);
            savePromise = saveSingleHistoryItemToFirebase(newItem).catch(revertRevenueOnSaveFailure);
        }

        updateRecentPhonesList();
        return savePromise;
    }

    function openViewListModal(id) {
        activeParentItemId = id;
        const item = scanHistory.find(i => i.id === id);
        if (!item) return;

        const listModalPhoneText = document.getElementById('listModalPhoneText');
        if(listModalPhoneText) listModalPhoneText.innerText = item.phone;
        const container = document.getElementById('barcodeListContainer');
        if(!container) return;
        container.innerHTML = '';

        if (!item.barcodes || !Array.isArray(item.barcodes)) {
            let cVal = parseFloat(item.cod !== undefined ? item.cod : item.price) || 0;
            let dVal = parseFloat(item.dod) || 0;
            let lVal = item.locker || "N/A";
            item.barcodes = [{ code: item.barcode, time: item.time, cod: cVal, dod: dVal, locker: lVal, isClosed: item.isClosed || false, isDeducted: false, isFromDeletion: false, createdAt: item.createdAt || getServerNow() }];
        }

        item.barcodes.forEach((b, idx) => {
            const div = document.createElement('div');
            div.className = 'barcode-list-item';
            let itemCod = parseFloat(b.cod) || 0;
            let itemDod = parseFloat(b.dod) || 0;
            let itemLocker = b.locker || "N/A";
            let totalSub = Math.round((itemCod + itemDod) * 100) / 100;
            let isBcClosed = b.isClosed || false;
            let closeBtnClass = isBcClosed ? 'btn-toggle-bc-close closed' : 'btn-toggle-bc-close';
            let closeBtnText = isBcClosed ? 'យកហើយ' : '✅ យក';

            let bcTimeDisplay = b.time ? `<div class="bc-time-line">${sanitizeInput(formatScanStamp(b.time))}</div>` : '';

            let bcHasCod = itemCod > 0;
            let bcHasDod = itemDod > 0;
            let bcCodRiel = Math.round(itemCod * exchangeRateRiel);
            let bcDodRiel = Math.round(itemDod * exchangeRateRiel);
            let bcMoneyHtml = '';
            if (bcHasCod && bcHasDod) {
                bcMoneyHtml = `
                    <div class="bc-money-line">COD: <strong style="color:var(--accent-blue);">$${itemCod.toFixed(2)}</strong> (${bcCodRiel.toLocaleString()} ៛)</div>
                    <div class="bc-money-line">DOD: <strong style="color:var(--accent-purple);">$${itemDod.toFixed(2)}</strong> (${bcDodRiel.toLocaleString()} ៛)</div>
                    <div class="bc-sum-line">សរុប: <strong>$${totalSub.toFixed(2)}</strong> (${(bcCodRiel + bcDodRiel).toLocaleString()} ៛)</div>
                `;
            } else if (bcHasDod) {
                bcMoneyHtml = `<div class="bc-money-line">DOD: <strong style="color:var(--accent-purple);">$${itemDod.toFixed(2)}</strong> (${bcDodRiel.toLocaleString()} ៛)</div>`;
            } else {
                bcMoneyHtml = `<div class="bc-money-line">COD: <strong style="color:var(--accent-blue);">$${itemCod.toFixed(2)}</strong> (${bcCodRiel.toLocaleString()} ៛)</div>`;
            }

            div.innerHTML = `
                <div style="flex: 1; min-width: 0;">
                    <div class="bc-head-line"><strong>${idx + 1}.</strong> <span class="barcode-tag">🏷️ ${sanitizeInput(b.code)}</span> <span class="locker-badge">ទីតាំង: ${sanitizeInput(itemLocker)}</span></div>
                    ${bcTimeDisplay}
                    ${bcMoneyHtml}
                </div>
                <div class="barcode-actions-group">
                    <button class="${closeBtnClass}" data-act="toggleIndividualBarcodeClose" data-a1="${sanitizeInput(item.id)}" data-a2="${sanitizeInput(b.code)}">${closeBtnText}</button>
                    <button class="btn-edit-item-price" data-act="openEditBarcodePriceModal" data-a1="${sanitizeInput(item.id)}" data-a2="${sanitizeInput(b.code)}">✏️ កែ</button>
                    <button class="btn-delete-bc" data-act="removeSingleBarcode" data-a1="${sanitizeInput(item.id)}" data-a2="${sanitizeInput(b.code)}">🗑️ ដក</button>
                </div>
            `;
            container.appendChild(div);
        });

        openModalHelper('viewListModal');
    }

    async function removeSingleBarcode(itemId, barcodeCode) {
        const item = scanHistory.find(i => i.id === itemId);
        if (!item || !item.barcodes) return;

        const bcIndex = item.barcodes.findIndex(b => b.code === barcodeCode);
        if (bcIndex === -1) return;

        if (!confirm(`តើអ្នកពិតជាចង់ដកកញ្ចប់អីវ៉ាន់ (${barcodeCode}) នេះចេញពីការគ្រប់គ្រងមែនទេ? (ចំណាំ៖ មិនមែនលុបអចិន្ត្រៃយ៍ទេ អាចស្តារវិញបាន)`)) return;

        if (!itemId || !/^[a-zA-Z0-9_-]+$/.test(itemId)) {
            const idErr = new Error('Unsafe id during removeSingleBarcode');
            console.error(idErr.message, itemId);
            if (window.ZoeErrors) ZoeErrors.capture(idErr, { context: 'removeSingleBarcode' });
            showToast("⚠️ ដកកញ្ចប់មិនបានជោគជ័យ! (ID មិនត្រឹមត្រូវ)");
            return;
        }

        let claimedParent = null;
        let claimedBarcode = null;
        let claimedWhole = null;
        const removeUpdater = (currentItem) => {
            claimedParent = null;
            claimedBarcode = null;
            claimedWhole = null;
            if (!currentItem) return currentItem;
            if (currentItem.clearClaim) return currentItem;
            dropStaleRestoreMarkers(currentItem);
            normalizeBarcodesOf(currentItem);
            if (!Array.isArray(currentItem.barcodes)) return currentItem;
            const idx = currentItem.barcodes.findIndex(b => b && b.code === barcodeCode);
            if (idx === -1) return currentItem;
            claimedParent = currentItem;
            claimedBarcode = currentItem.barcodes[idx];
            const kept = currentItem.barcodes.filter((b, i) => i !== idx);
            if (kept.length === 0) {
                claimedWhole = currentItem;
                return null;
            }
            const updated = { ...currentItem, barcodes: kept };
            updated.count = kept.length;
            updated.cod = Math.round(kept.reduce((s, b) => s + (parseFloat(b.cod) || 0), 0) * 100) / 100;
            updated.dod = Math.round(kept.reduce((s, b) => s + (parseFloat(b.dod) || 0), 0) * 100) / 100;
            updated.price = Math.round((updated.cod + updated.dod) * 100) / 100;
            updated.barcode = kept[0].code;
            updated.isClosed = kept.every(b => b.isClosed);
            if (updated.isClosed) {
                if (!updated.closedAt) updated.closedAt = getServerNow();
            } else {
                delete updated.closedAt;
            }
            return updated;
        };
        const finishRemoval = async (result, late) => {
            if (!claimedBarcode) {
                refreshCurrentHistoryView();
                showToast("⚠️ កញ្ចប់នេះលែងមានក្នុងប្រព័ន្ធទៀតហើយ! គ្មានអ្វីត្រូវដកទេ។");
                return;
            }

            const committedItem = result.snapshot ? result.snapshot.val() : null;
            const localIdx = scanHistory.findIndex(i => i.id === itemId);
            if (claimedWhole) {
                if (localIdx !== -1) scanHistory.splice(localIdx, 1);
                if (!late || viewListModalShowing(itemId)) closeModal('viewListModal');
            } else if (localIdx !== -1 && committedItem) {
                scanHistory[localIdx] = { ...committedItem, id: itemId };
            }

            let deductedCod = 0;
            let deductedDod = 0;
            let deductionApplied = false;
            const revenueScanDate = claimedParent.scanDate || getFormattedDate();
            if (!claimedBarcode.isDeducted) {
                deductedCod = parseFloat(claimedBarcode.cod) || 0;
                deductedDod = parseFloat(claimedBarcode.dod) || 0;
                addRevenueToDailyAndMonthlyRecord(revenueScanDate, -deductedCod, -deductedDod, -1);
                deductionApplied = true;
            }

            const removedBc = { ...claimedBarcode, isDeducted: true, isFromDeletion: false };
            const itemToTrash = stripHistoryOnlyMarkers({ ...claimedParent, barcodes: [removedBc], count: 1 });
            itemToTrash.id = generateUniqueId();
            itemToTrash.deletedAt = getServerNow();
            itemToTrash.isFromDeletion = false;
            itemToTrash.trashReason = 'remove';
            itemToTrash.cod = parseFloat(removedBc.cod) || 0;
            itemToTrash.dod = parseFloat(removedBc.dod) || 0;
            itemToTrash.price = Math.round((itemToTrash.cod + itemToTrash.dod) * 100) / 100;
            itemToTrash.barcode = removedBc.code;
            itemToTrash.locker = removedBc.locker || "N/A";
            itemToTrash.time = removedBc.time || claimedParent.time;
            itemToTrash.isClosed = removedBc.isClosed || false;
            if (itemToTrash.isClosed) {
                itemToTrash.closedAt = claimedParent.closedAt || getServerNow();
            } else {
                delete itemToTrash.closedAt;
            }

            deletedItems.unshift(itemToTrash);
            if (!claimedWhole && (!late || viewListModalShowing(itemId))) openViewListModal(itemId);
            refreshCurrentHistoryView();

            let trashSaved = false;
            await notifyIfSlow(retryAsync(() => saveSingleDeletedItemToFirebase(itemToTrash), 4, 1500),
                TRASH_WRITE_SLOW_NOTICE_MS,
                `⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងរក្សាទុកការដក (${barcodeCode})… សូមកុំបិទ App។`).then(() => {
                trashSaved = true;
            }).catch(async (trashErr) => {
                if (deductionApplied) {
                    addRevenueToDailyAndMonthlyRecord(revenueScanDate, deductedCod, deductedDod, 1);
                }
                const staleIdx = deletedItems.findIndex(i => i.id === itemToTrash.id);
                if (staleIdx !== -1) deletedItems.splice(staleIdx, 1);
                console.error('Trash write permanently failed for removeSingleBarcode of', itemId, trashErr);
                if (window.ZoeErrors) ZoeErrors.capture(trashErr, { context: 'removeSingleBarcode trash write failed after retries', itemId });
                let restoredItem = null;
                let restoreOk = false;
                try {
                    const restoreResult = await restoreClaimedItemToScanHistory(itemId, claimedWhole, claimedWhole ? null : { ...claimedParent, barcodes: [claimedBarcode] });
                    restoredItem = (restoreResult && restoreResult.snapshot) ? restoreResult.snapshot.val() : null;
                    restoreOk = true;
                } catch (restoreErr) {
                    console.error('Failed to restore barcode to scan history after trash write failure for', itemId, restoreErr);
                    if (window.ZoeErrors) ZoeErrors.capture(restoreErr, { context: 'removeSingleBarcode restore-after-trash-failure also failed', itemId });
                    showToast('⚠️ បញ្ហាធ្ងន់ធ្ងរ៖ ទិន្នន័យកញ្ចប់ ' + barcodeCode + ' អាចនឹងបាត់! សូមប្រាប់ Admin ត្រួតពិនិត្យភ្លាមៗ');
                }
                if (restoreOk) {
                    refreshCurrentHistoryView();
                    showToast("⚠️ ដកកញ្ចប់មិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
                }
            });
            if (trashSaved) {
                showToast(late
                    ? `✅ បណ្តាញត្រឡប់មកវិញ — បានដកកញ្ចប់ (${barcodeCode}) និងកាត់ប្រាក់ចេញពីស្ថិតិរួចរាល់!`
                    : "បានដកកញ្ចប់អីវ៉ាន់ និងកាត់ប្រាក់ចេញពីស្ថិតិរួចរាល់!");
            }
        };
        try {
            const removeTx = fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${itemId}`), removeUpdater);
            let result;
            try {
                result = await dbOp(removeTx);
            } catch (txError) {
                if (dbOpStalled(txError)) {
                    armLateCommit(removeTx, (late) => finishRemoval(late, true), (lateErr) => {
                        refreshCurrentHistoryView();
                        showToast(`⚠️ ដកកញ្ចប់ (${barcodeCode}) មិនបានជោគជ័យ! សូមសាកល្បងម្តងទៀត។`);
                        if (lateErr && window.ZoeErrors) ZoeErrors.capture(lateErr, { context: 'removeSingleBarcode late transaction failed', itemId });
                    }, 'removeSingleBarcode');
                    showToast(`⏳ បណ្តាញឆ្លើយមិនចេញ — ការដក (${barcodeCode}) នឹងបញ្ចប់ដោយស្វ័យប្រវត្តិពេលបណ្តាញត្រឡប់មកវិញ។ សូមកុំដកម្ដងទៀត។`);
                    return;
                }
                throw txError;
            }
            if (!result || !result.committed) throw new Error('Remove barcode transaction was not committed');
            await finishRemoval(result, false);
        } catch (e) {
            console.error("Error removing single barcode: ", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Error removing single barcode: " });
            refreshCurrentHistoryView();
            showToast("⚠️ ដកកញ្ចប់មិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
        }
    }

    async function toggleIndividualBarcodeClose(itemId, barcodeCode) {
        const item = scanHistory.find(i => i.id === itemId);
        if (!item || !item.barcodes) return;

        let targetB = item.barcodes.find(b => b.code === barcodeCode);
        if (!targetB) return;
        const actionText = targetB.isClosed ? "បើក" : "បិទ";
        const desiredClosed = !targetB.isClosed;
        if (!confirm(`តើអ្នកប្រាកដជាចង់${actionText}ស្ថានភាពកញ្ចប់អីវ៉ាន់ (${targetB.code}) នេះមែនទេ?`)) return;

        const freshItem = scanHistory.find(i => i.id === itemId);
        const freshB = freshItem && freshItem.barcodes ? freshItem.barcodes.find(b => b.code === barcodeCode) : null;
        const previousState = freshItem && freshB
            ? { isClosed: freshB.isClosed, barcodeClosedAt: freshB.closedAt, itemIsClosed: freshItem.isClosed, itemClosedAt: freshItem.closedAt, itemCallMark: freshItem.callMark, itemCallMarkTime: freshItem.callMarkTime }
            : null;
        let pickupCustomerDelta = 0;
        let pickupPackageDelta = 0;
        let pickupPhoneKey = null;
        let serverApplied = false;
        let serverPackageDelta = 0;
        let serverCustomerDelta = 0;
        const revertPickupDeltaAfterNoOp = () => {
            if (pickupCustomerDelta === 0 && pickupPackageDelta === 0) return;
            const pickupScanDate = (freshItem && freshItem.scanDate) || getFormattedDate();
            addPickupToDailyRecord(pickupScanDate, pickupPhoneKey, -pickupCustomerDelta, -pickupPackageDelta);
            pickupCustomerDelta = 0;
            pickupPackageDelta = 0;
            showToast("⚠️ ទិន្នន័យនេះលែងមានក្នុងប្រព័ន្ធ! ស្ថិតិត្រូវបានកែតម្រូវវិញ។");
        };
        const reconcilePickupDeltaWithServer = () => {
            const customerDiff = serverCustomerDelta - pickupCustomerDelta;
            const packageDiff = serverPackageDelta - pickupPackageDelta;
            if (customerDiff === 0 && packageDiff === 0) return;
            const pickupScanDate = (freshItem && freshItem.scanDate) || getFormattedDate();
            addPickupToDailyRecord(pickupScanDate, pickupPhoneKey, customerDiff, packageDiff);
            pickupCustomerDelta = serverCustomerDelta;
            pickupPackageDelta = serverPackageDelta;
        };
        if (freshItem && freshB) {
            applyBarcodeCloseState(freshB, desiredClosed, getServerNow());
            const allClosedLocal = freshItem.barcodes.every(b => b.isClosed);
            freshItem.isClosed = allClosedLocal;
            if (allClosedLocal) freshItem.closedAt = getServerNow(); else delete freshItem.closedAt;
            if (desiredClosed) {
                delete freshItem.callMark;
                delete freshItem.callMarkTime;
            }

            const pickupScanDate = freshItem.scanDate || getFormattedDate();
            pickupPhoneKey = getPickupPhoneKey(freshItem);
            pickupPackageDelta = (!!previousState.isClosed === desiredClosed) ? 0 : (desiredClosed ? 1 : -1);
            pickupCustomerDelta = pickupPackageDelta;
            addPickupToDailyRecord(pickupScanDate, pickupPhoneKey, pickupCustomerDelta, pickupPackageDelta);

            openViewListModal(itemId);
            refreshCurrentHistoryView();
        }
        showToast(`បាន${actionText}ស្ថានភាព Barcode រួចរាល់!`);

        if (!db || !/^[a-zA-Z0-9_-]+$/.test(itemId)) return;

        const revertBarcodeCloseLocally = () => {
            if (previousState) {
                const revertItem = scanHistory.find(i => i.id === itemId);
                const revertB = revertItem && revertItem.barcodes ? revertItem.barcodes.find(b => b.code === barcodeCode) : null;
                if (revertItem && revertB) {
                    revertB.isClosed = previousState.isClosed;
                    if (previousState.barcodeClosedAt !== undefined) revertB.closedAt = previousState.barcodeClosedAt;
                    else delete revertB.closedAt;
                    revertItem.isClosed = previousState.itemIsClosed;
                    if (previousState.itemClosedAt !== undefined) revertItem.closedAt = previousState.itemClosedAt;
                    else delete revertItem.closedAt;
                    if (previousState.itemCallMark !== undefined) revertItem.callMark = previousState.itemCallMark;
                    else delete revertItem.callMark;
                    if (previousState.itemCallMarkTime !== undefined) revertItem.callMarkTime = previousState.itemCallMarkTime;
                    else delete revertItem.callMarkTime;
                    if (viewListModalShowing(itemId)) openViewListModal(itemId);
                    refreshCurrentHistoryView();
                }
            }
            if (pickupCustomerDelta !== 0 || pickupPackageDelta !== 0) {
                const pickupScanDate = (freshItem && freshItem.scanDate) || getFormattedDate();
                addPickupToDailyRecord(pickupScanDate, pickupPhoneKey, -pickupCustomerDelta, -pickupPackageDelta);
                pickupCustomerDelta = 0;
                pickupPackageDelta = 0;
            }
        };
        const settleBarcodeClose = (barcodeCloseResult) => {
            if (!serverApplied || !(barcodeCloseResult && barcodeCloseResult.committed)) {
                revertPickupDeltaAfterNoOp();
            } else {
                reconcilePickupDeltaWithServer();
            }
        };
        let closeTx = null;
        try {
            closeTx = fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${itemId}`), (currentItem) => {
                serverApplied = false;
                serverPackageDelta = 0;
                serverCustomerDelta = 0;
                if (!currentItem) return currentItem;
                if (currentItem.clearClaim) return;
                dropStaleRestoreMarkers(currentItem);
                normalizeBarcodesOf(currentItem);
                if (!currentItem.barcodes || !Array.isArray(currentItem.barcodes)) {
                    currentItem.barcodes = [{
                        code: currentItem.barcode,
                        time: currentItem.time,
                        cod: parseFloat(currentItem.cod !== undefined ? currentItem.cod : currentItem.price) || 0,
                        dod: parseFloat(currentItem.dod) || 0,
                        locker: currentItem.locker || "N/A",
                        isClosed: currentItem.isClosed || false,
                        isDeducted: false,
                        isFromDeletion: false,
                        createdAt: currentItem.createdAt || getServerNow()
                    }];
                }
                const b = currentItem.barcodes.find(bc => bc.code === barcodeCode);
                if (!b) return currentItem;
                serverPackageDelta = (!!b.isClosed === desiredClosed) ? 0 : (desiredClosed ? 1 : -1);
                serverCustomerDelta = serverPackageDelta;
                applyBarcodeCloseState(b, desiredClosed, getServerNow());
                const allClosed = currentItem.barcodes.every(bc => bc.isClosed);
                currentItem.isClosed = allClosed;
                if (allClosed) currentItem.closedAt = getServerNow();
                else delete currentItem.closedAt;
                if (desiredClosed) {
                    delete currentItem.callMark;
                    delete currentItem.callMarkTime;
                }
                serverApplied = true;
                return currentItem;
            });
            settleBarcodeClose(await dbOp(closeTx));
        } catch (error) {
            if (dbOpStalled(error) && armLateCommit(closeTx, settleBarcodeClose, (lateErr, lateResult) => {
                if (lateResult && !lateResult.committed) { revertPickupDeltaAfterNoOp(); return; }
                revertBarcodeCloseLocally();
                showToast(`⚠️ បរាជ័យក្នុងការ Save ស្ថានភាព (${barcodeCode}) ទៅ Firebase! ស្ថានភាពត្រូវបានត្រឡប់ដើមវិញ។`);
                if (lateErr && window.ZoeErrors) ZoeErrors.capture(lateErr, { context: 'toggleIndividualBarcodeClose late transaction failed' });
            }, 'toggleIndividualBarcodeClose')) {
                showToast(`⏳ បណ្តាញឆ្លើយមិនចេញ — ស្ថានភាព (${barcodeCode}) នឹងធ្វើបច្ចុប្បន្នភាពពេលបណ្តាញត្រឡប់មកវិញ។`);
                return;
            }
            console.error("Error toggling barcode close: ", error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error toggling barcode close: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! កំពុងត្រឡប់ស្ថានភាពដើមវិញ...");
            revertBarcodeCloseLocally();
        }
    }

    function openEditBarcodePriceModal(itemId, code) {
        activeParentItemId = itemId;
        activeEditingBarcode = code;

        const item = scanHistory.find(i => i.id === itemId);
        if (!item) return;

        let barcodeList = item.barcodes || [{ code: item.barcode, cod: item.cod || 0, dod: item.dod || 0, isDeducted: false }];
        let targetB = barcodeList.find(b => b.code === code);
        let currentCod = targetB ? (parseFloat(targetB.cod) || 0) : 0;
        let currentDod = targetB ? (parseFloat(targetB.dod) || 0) : 0;

        const editBcPcText = document.getElementById('editBcPcText');
        if(editBcPcText) editBcPcText.innerText = code;
        const editBcCodInput = document.getElementById('editBcCodInput');
        if(editBcCodInput) editBcCodInput.value = currentCod;
        const editBcDodInput = document.getElementById('editBcDodInput');
        if(editBcDodInput) editBcDodInput.value = currentDod;

        const viewListModal = document.getElementById('viewListModal');
        if(viewListModal) viewListModal.style.display = 'none';
        openModalHelper('editBarcodePriceModal');
    }

    function closeEditBarcodeModal() {
        closeModal('editBarcodePriceModal');
        if (activeParentItemId) {
            openViewListModal(activeParentItemId);
        }
    }

    function saveEditedBarcodePrice() {
        const editBcCodInput = document.getElementById('editBcCodInput');
        const editBcDodInput = document.getElementById('editBcDodInput');

        let newCod = editBcCodInput ? (parseFloat(editBcCodInput.value) || 0) : 0;
        let newDod = editBcDodInput ? (parseFloat(editBcDodInput.value) || 0) : 0;
        if (isNaN(newCod) || newCod < 0) newCod = 0;
        if (isNaN(newDod) || newDod < 0) newDod = 0;

        const item = scanHistory.find(i => i.id === activeParentItemId);
        if (item) {
            if (!item.barcodes || !Array.isArray(item.barcodes)) {
                item.barcodes = [{ code: item.barcode, time: item.time, cod: parseFloat(item.cod) || 0, dod: parseFloat(item.dod) || 0, locker: item.locker || "N/A", isClosed: item.isClosed || false, isDeducted: false, isFromDeletion: false, createdAt: item.createdAt || getServerNow() }];
            }

            let targetB = item.barcodes.find(b => b.code === activeEditingBarcode);
            if (targetB) {
                let oldCod = parseFloat(targetB.cod) || 0;
                let oldDod = parseFloat(targetB.dod) || 0;

                let codDiff = Math.round((newCod - oldCod) * 100) / 100;
                let dodDiff = Math.round((newDod - oldDod) * 100) / 100;

                const editedItemId = item.id;
                const editedBarcodeCode = activeEditingBarcode;
                let serverOldCod = null;
                let serverOldDod = null;
                let serverApplied = false;

                const applyEditedPriceTo = (target) => {
                    serverApplied = false;
                    serverOldCod = null;
                    serverOldDod = null;
                    normalizeBarcodesOf(target);
                    if (!target.barcodes || !Array.isArray(target.barcodes)) {
                        target.barcodes = [{
                            code: target.barcode,
                            time: target.time,
                            cod: parseFloat(target.cod !== undefined ? target.cod : target.price) || 0,
                            dod: parseFloat(target.dod) || 0,
                            locker: target.locker || "N/A",
                            isClosed: target.isClosed || false,
                            isDeducted: false,
                            isFromDeletion: false,
                            createdAt: target.createdAt || getServerNow()
                        }];
                    }
                    const b = target.barcodes.find(bc => bc && bc.code === editedBarcodeCode);
                    if (!b) return target;
                    serverOldCod = parseFloat(b.cod) || 0;
                    serverOldDod = parseFloat(b.dod) || 0;
                    b.cod = newCod;
                    b.dod = newDod;
                    target.cod = Math.round(target.barcodes.reduce((sum, bc) => sum + (parseFloat(bc.cod) || 0), 0) * 100) / 100;
                    target.dod = Math.round(target.barcodes.reduce((sum, bc) => sum + (parseFloat(bc.dod) || 0), 0) * 100) / 100;
                    target.price = Math.round((target.cod + target.dod) * 100) / 100;
                    serverApplied = true;
                    return target;
                };

                applyEditedPriceTo(item);

                const revenueScanDate = item.scanDate || getFormattedDate();
                const revenueApplied = (codDiff !== 0 || dodDiff !== 0);
                if (revenueApplied) {
                    addRevenueToDailyAndMonthlyRecord(revenueScanDate, codDiff, dodDiff, 0);
                }

                serverApplied = false;
                if (!db || !fb || !/^[a-zA-Z0-9_-]+$/.test(String(editedItemId || ''))) {
                    if (revenueApplied) {
                        addRevenueToDailyAndMonthlyRecord(revenueScanDate, -codDiff, -dodDiff, 0);
                    }
                    targetB.cod = oldCod;
                    targetB.dod = oldDod;
                    item.cod = Math.round(item.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                    item.dod = Math.round(item.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                    item.price = Math.round((item.cod + item.dod) * 100) / 100;
                    refreshCurrentHistoryView();
                    closeModal('editBarcodePriceModal');
                    openViewListModal(item.id);
                    showToast("⚠️ មិនទាន់ភ្ជាប់ Firebase ទេ! ការកែទឹកប្រាក់មិនត្រូវបានរក្សាទុកទេ។");
                    return;
                }
                const revertEditedPriceLocally = () => {
                    const staleItem = scanHistory.find(i => i.id === editedItemId);
                    const staleB = staleItem && Array.isArray(staleItem.barcodes)
                        ? staleItem.barcodes.find(b => b.code === editedBarcodeCode)
                        : null;
                    if (!staleB) return;
                    staleB.cod = oldCod;
                    staleB.dod = oldDod;
                    staleItem.cod = Math.round(staleItem.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                    staleItem.dod = Math.round(staleItem.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                    staleItem.price = Math.round((staleItem.cod + staleItem.dod) * 100) / 100;
                    refreshCurrentHistoryView();
                };
                const undoEditedPriceRevenue = () => {
                    if (!revenueApplied) return;
                    addRevenueToDailyAndMonthlyRecord(revenueScanDate, -codDiff, -dodDiff, 0);
                };
                const settleEditedPrice = (result) => {
                    const committed = !!(result && result.committed);
                    if (!committed || !serverApplied) {
                        undoEditedPriceRevenue();
                        revertEditedPriceLocally();
                        showToast(committed
                            ? "⚠️ កញ្ចប់នេះលែងមានក្នុងប្រព័ន្ធទៀតហើយ! ទឹកប្រាក់មិនត្រូវបានកែទេ។"
                            : "⚠️ កែប្រែទឹកប្រាក់មិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
                        return;
                    }
                    const actualCodDiff = Math.round((newCod - serverOldCod) * 100) / 100;
                    const actualDodDiff = Math.round((newDod - serverOldDod) * 100) / 100;
                    const correctionCod = Math.round((actualCodDiff - (revenueApplied ? codDiff : 0)) * 100) / 100;
                    const correctionDod = Math.round((actualDodDiff - (revenueApplied ? dodDiff : 0)) * 100) / 100;
                    if (correctionCod !== 0 || correctionDod !== 0) {
                        addRevenueToDailyAndMonthlyRecord(revenueScanDate, correctionCod, correctionDod, 0);
                    }
                    showToast("បានកែប្រែទឹកប្រាក់តាមកញ្ចប់ជោគជ័យ!");
                };
                const failEditedPrice = (err) => {
                    undoEditedPriceRevenue();
                    revertEditedPriceLocally();
                    refreshCurrentHistoryView();
                    const viewListEl = document.getElementById('viewListModal');
                    if (viewListEl && viewListEl.style.display === 'flex') openViewListModal(editedItemId);
                    showToast("⚠️ កែប្រែទឹកប្រាក់មិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
                    if (err && window.ZoeErrors) ZoeErrors.capture(err, { context: 'saveEditedBarcodePrice transaction failed' });
                };
                const priceTx = fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${editedItemId}`), (currentItem) => {
                    serverApplied = false;
                    if (!currentItem) return currentItem;
                    if (currentItem.clearClaim) return;
                    return applyEditedPriceTo(currentItem);
                });
                dbOp(priceTx).then(settleEditedPrice, (error) => {
                    if (dbOpStalled(error) && armLateCommit(priceTx, settleEditedPrice, (lateErr, lateResult) => {
                        if (lateResult) { settleEditedPrice(lateResult); return; }
                        failEditedPrice(lateErr);
                    }, 'saveEditedBarcodePrice')) {
                        showToast("⏳ បណ្តាញឆ្លើយមិនចេញ — ការកែទឹកប្រាក់នឹងបញ្ចប់ដោយស្វ័យប្រវត្តិពេលបណ្តាញត្រឡប់មកវិញ។ សូមកុំកែម្ដងទៀត។");
                        return;
                    }
                    failEditedPrice(error);
                }).catch((postErr) => {
                    console.error('saveEditedBarcodePrice post-transaction handler failed: ', postErr);
                    if (window.ZoeErrors) ZoeErrors.capture(postErr, { context: 'saveEditedBarcodePrice post-transaction handler' });
                });
                refreshCurrentHistoryView();
            }

            closeModal('editBarcodePriceModal');
            openViewListModal(item.id);
        } else {
            closeModal('editBarcodePriceModal');
        }
    }

    function handleCallAction(id) {
        noteAppLockExcuse();
        const item = scanHistory.find(i => i.id === id);
        if (item) {
            const patchFields = { isCalled: true };
            const previousFields = { isCalled: item.isCalled };
            if (item.callMark === 'no-answer' || item.callMark === 'no-connect') {
                previousFields.callMarkTime = item.callMarkTime;
                item.callMarkTime = getServerNow();
                patchFields.callMarkTime = item.callMarkTime;
            }
            item.isCalled = true;
            patchHistoryItemFields(item, patchFields, previousFields, null, { retryOnDisconnect: true });
            scheduleHistoryViewRefresh();
        }
    }

    function openCallMarkModal(id) {
        markingItemId = id;
        const item = scanHistory.find(i => i.id === id);
        if (!item) return;

        const callMarkPhoneText = document.getElementById('callMarkPhoneText');
        if (callMarkPhoneText) callMarkPhoneText.innerText = item.phone;

        openModalHelper('callMarkModal');
    }

    function setCallMark(mark) {
        const item = scanHistory.find(i => i.id === markingItemId);
        if (item) {
            const prevCallMark = item.callMark;
            const prevCallMarkTime = item.callMarkTime;
            if (mark) {
                item.callMark = mark;
                item.callMarkTime = getServerNow();
                patchHistoryItemFields(item, { callMark: mark, callMarkTime: item.callMarkTime }, { callMark: prevCallMark, callMarkTime: prevCallMarkTime }, null, { retryOnDisconnect: true });
            } else {
                delete item.callMark;
                delete item.callMarkTime;
                patchHistoryItemFields(item, { callMark: null, callMarkTime: null }, { callMark: prevCallMark, callMarkTime: prevCallMarkTime }, null, { retryOnDisconnect: true });
            }
            refreshCurrentHistoryView();
            showToast(mark ? "បានសម្គាល់រួចរាល់!" : "បានសម្អាតការសម្គាល់!");
        }
        closeModal('callMarkModal');
    }

    function openEditModal(id) {
        editingItemId = id;
        const item = scanHistory.find(i => i.id === id);
        if(!item) return;

        const editModalBarcodeText = document.getElementById('editModalBarcodeText');
        if(editModalBarcodeText) editModalBarcodeText.innerText = item.barcode;
        const editPhoneInput = document.getElementById('editPhoneInput');
        if(editPhoneInput) editPhoneInput.value = item.phone === "គ្មានលេខ" ? "" : item.phone;

        openModalHelper('editPhoneModal');

        setTimeout(() => {
            if(editPhoneInput) editPhoneInput.focus();
        }, 150);
    }

    function saveEditedPhone() {
        const editPhoneInput = document.getElementById('editPhoneInput');
        let newPhone = normalizeStoredPhone(editPhoneInput ? editPhoneInput.value : '');
        if (!newPhone) {
            newPhone = "គ្មានលេខ";
        }

        const item = scanHistory.find(i => i.id === editingItemId);
        if (item) {
            const prevPhone = item.phone;
            const patchFields = { phone: newPhone };
            const previousFields = { phone: prevPhone };
            if (newPhone !== prevPhone && item.callMark === 'wrong-number') {
                previousFields.callMark = item.callMark;
                previousFields.callMarkTime = item.callMarkTime;
                previousFields.isCalled = item.isCalled;
                delete item.callMark;
                delete item.callMarkTime;
                item.isCalled = false;
                patchFields.callMark = null;
                patchFields.callMarkTime = null;
                patchFields.isCalled = false;
            }
            const prevPickupKey = getPickupPhoneKey(item);
            item.phone = newPhone;
            const nextPickupKey = getPickupPhoneKey(item);
            const pickupDate = item.scanDate || getFormattedDate();
            let pickupRefMoved = false;
            let movedPickupRefs = closedBarcodeCount(item);
            if (movedPickupRefs > 0 && prevPickupKey !== nextPickupKey) {
                addPickupToDailyRecord(pickupDate, prevPickupKey, -movedPickupRefs, 0);
                addPickupToDailyRecord(pickupDate, nextPickupKey, movedPickupRefs, 0);
                pickupRefMoved = true;
            }
            const revertPickupRefMove = () => {
                if (!pickupRefMoved) return;
                pickupRefMoved = false;
                addPickupToDailyRecord(pickupDate, nextPickupKey, -movedPickupRefs, 0);
                addPickupToDailyRecord(pickupDate, prevPickupKey, movedPickupRefs, 0);
            };
            let serverWasClosed = null;
            let serverPickupRefs = 0;
            const reconcilePickupRefWithServer = () => {
                if (serverWasClosed === null || prevPickupKey === nextPickupKey) return;
                if (serverPickupRefs > 0 && !pickupRefMoved) {
                    movedPickupRefs = serverPickupRefs;
                    addPickupToDailyRecord(pickupDate, prevPickupKey, -movedPickupRefs, 0);
                    addPickupToDailyRecord(pickupDate, nextPickupKey, movedPickupRefs, 0);
                    pickupRefMoved = true;
                } else if (serverPickupRefs <= 0 && pickupRefMoved) {
                    revertPickupRefMove();
                }
            };
            patchHistoryItemFields(item, patchFields, previousFields, (serverItem) => {
                serverWasClosed = !!serverItem.isClosed;
                serverPickupRefs = closedBarcodeCount(serverItem);
            }).then((saved) => {
                if (saved) {
                    reconcilePickupRefWithServer();
                } else {
                    revertPickupRefMove();
                }
            }, revertPickupRefMove).catch((postErr) => {
                console.error('saveEditedPhone post-patch handler failed: ', postErr);
                if (window.ZoeErrors) ZoeErrors.capture(postErr, { context: 'saveEditedPhone post-patch handler' });
            });
            updateRecentPhonesList();
            const searchInput = document.getElementById('searchPhoneInput');
            if (searchInput) searchInput.value = '';
            applyCurrentFilter();
            showToast("កែប្រែលេខទូរស័ព្ទរួចរាល់!");
        }

        closeModal('editPhoneModal');
    }

    async function toggleCloseStatus(id) {
        const item = scanHistory.find(i => i.id === id);
        if (!item) return;
        const actionText = item.isClosed ? "បើក" : "បិទ";
        const desiredClosed = !item.isClosed;
        if (!confirm(`តើអ្នកប្រាកដជាចង់${actionText}បញ្ជីនេះមែនទេ?`)) return;

        const freshItem = scanHistory.find(i => i.id === id);
        const previousState = freshItem
            ? { isClosed: freshItem.isClosed, closedAt: freshItem.closedAt, callMark: freshItem.callMark, callMarkTime: freshItem.callMarkTime, barcodeStates: freshItem.barcodes ? freshItem.barcodes.map(b => b.isClosed) : null, barcodeCloseStamps: freshItem.barcodes ? freshItem.barcodes.map(b => b.closedAt) : null }
            : null;
        let pickupCustomerDelta = 0;
        let pickupPackageDelta = 0;
        let pickupPhoneKey = null;
        let serverApplied = false;
        let serverPackageDelta = 0;
        let serverCustomerDelta = 0;
        const revertPickupDeltaAfterNoOp = () => {
            if (pickupCustomerDelta === 0 && pickupPackageDelta === 0) return;
            const pickupScanDate = (freshItem && freshItem.scanDate) || getFormattedDate();
            addPickupToDailyRecord(pickupScanDate, pickupPhoneKey, -pickupCustomerDelta, -pickupPackageDelta);
            pickupCustomerDelta = 0;
            pickupPackageDelta = 0;
            showToast("⚠️ ទិន្នន័យនេះលែងមានក្នុងប្រព័ន្ធ! ស្ថិតិត្រូវបានកែតម្រូវវិញ។");
        };
        const reconcilePickupDeltaWithServer = () => {
            const customerDiff = serverCustomerDelta - pickupCustomerDelta;
            const packageDiff = serverPackageDelta - pickupPackageDelta;
            if (customerDiff === 0 && packageDiff === 0) return;
            const pickupScanDate = (freshItem && freshItem.scanDate) || getFormattedDate();
            addPickupToDailyRecord(pickupScanDate, pickupPhoneKey, customerDiff, packageDiff);
            pickupCustomerDelta = serverCustomerDelta;
            pickupPackageDelta = serverPackageDelta;
        };
        if (freshItem) {
            freshItem.isClosed = desiredClosed;
            if (desiredClosed) {
                freshItem.closedAt = getServerNow();
                delete freshItem.callMark;
                delete freshItem.callMarkTime;
                if (freshItem.barcodes && Array.isArray(freshItem.barcodes)) freshItem.barcodes.forEach(b => applyBarcodeCloseState(b, true, getServerNow()));
            } else {
                delete freshItem.closedAt;
                if (freshItem.barcodes && Array.isArray(freshItem.barcodes)) freshItem.barcodes.forEach(b => applyBarcodeCloseState(b, false));
            }

            const pickupScanDate = freshItem.scanDate || getFormattedDate();
            pickupPhoneKey = getPickupPhoneKey(freshItem);
            const alreadyInDesiredState = !!previousState.isClosed === desiredClosed;
            if (previousState.barcodeStates) {
                previousState.barcodeStates.forEach((wasClosed) => {
                    if (desiredClosed && !wasClosed) pickupPackageDelta += 1;
                    else if (!desiredClosed && wasClosed) pickupPackageDelta -= 1;
                });
            } else if (!alreadyInDesiredState) {
                const pickupPackages = parseFloat(freshItem.count) || 1;
                pickupPackageDelta = desiredClosed ? pickupPackages : -pickupPackages;
            }
            pickupCustomerDelta = pickupPackageDelta;
            addPickupToDailyRecord(pickupScanDate, pickupPhoneKey, pickupCustomerDelta, pickupPackageDelta);

            refreshCurrentHistoryView();
        }
        showToast(`បាន${actionText}បញ្ជីជោគជ័យ!`);

        if (!db || !/^[a-zA-Z0-9_-]+$/.test(id)) return;

        const revertCloseLocally = () => {
            if (previousState) {
                const revertItem = scanHistory.find(i => i.id === id);
                if (revertItem) {
                    revertItem.isClosed = previousState.isClosed;
                    if (previousState.closedAt !== undefined) revertItem.closedAt = previousState.closedAt;
                    else delete revertItem.closedAt;
                    if (previousState.callMark !== undefined) revertItem.callMark = previousState.callMark;
                    else delete revertItem.callMark;
                    if (previousState.callMarkTime !== undefined) revertItem.callMarkTime = previousState.callMarkTime;
                    else delete revertItem.callMarkTime;
                    if (previousState.barcodeStates && revertItem.barcodes && Array.isArray(revertItem.barcodes)) {
                        revertItem.barcodes.forEach((b, i) => {
                            if (previousState.barcodeStates[i] === undefined) return;
                            b.isClosed = previousState.barcodeStates[i];
                            const stamp = previousState.barcodeCloseStamps ? previousState.barcodeCloseStamps[i] : undefined;
                            if (stamp !== undefined) b.closedAt = stamp;
                            else delete b.closedAt;
                        });
                    }
                    refreshCurrentHistoryView();
                }
            }
            if (pickupCustomerDelta !== 0 || pickupPackageDelta !== 0) {
                const pickupScanDate = (freshItem && freshItem.scanDate) || getFormattedDate();
                addPickupToDailyRecord(pickupScanDate, pickupPhoneKey, -pickupCustomerDelta, -pickupPackageDelta);
                pickupCustomerDelta = 0;
                pickupPackageDelta = 0;
            }
        };
        const settleClose = (closeResult) => {
            if (!serverApplied || !(closeResult && closeResult.committed)) {
                revertPickupDeltaAfterNoOp();
            } else {
                reconcilePickupDeltaWithServer();
            }
        };
        let closeTx = null;
        try {
            closeTx = fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${id}`), (currentItem) => {
                serverApplied = false;
                serverPackageDelta = 0;
                serverCustomerDelta = 0;
                if (!currentItem) return currentItem;
                if (currentItem.clearClaim) return;
                dropStaleRestoreMarkers(currentItem);
                normalizeBarcodesOf(currentItem);
                const serverBarcodes = (currentItem.barcodes && Array.isArray(currentItem.barcodes)) ? currentItem.barcodes : null;
                if (serverBarcodes) {
                    serverBarcodes.forEach((b) => {
                        if (desiredClosed && !b.isClosed) serverPackageDelta += 1;
                        else if (!desiredClosed && b.isClosed) serverPackageDelta -= 1;
                    });
                } else if (!!currentItem.isClosed !== desiredClosed) {
                    const serverPackages = parseFloat(currentItem.count) || 1;
                    serverPackageDelta = desiredClosed ? serverPackages : -serverPackages;
                }
                serverCustomerDelta = serverPackageDelta;
                currentItem.isClosed = desiredClosed;
                if (desiredClosed) {
                    currentItem.closedAt = getServerNow();
                    delete currentItem.callMark;
                    delete currentItem.callMarkTime;
                    if (serverBarcodes) serverBarcodes.forEach(b => applyBarcodeCloseState(b, true, getServerNow()));
                } else {
                    delete currentItem.closedAt;
                    if (serverBarcodes) serverBarcodes.forEach(b => applyBarcodeCloseState(b, false));
                }
                serverApplied = true;
                return currentItem;
            });
            settleClose(await dbOp(closeTx));
        } catch (error) {
            if (dbOpStalled(error) && armLateCommit(closeTx, settleClose, (lateErr, lateResult) => {
                if (lateResult && !lateResult.committed) { revertPickupDeltaAfterNoOp(); return; }
                revertCloseLocally();
                showToast("⚠️ បរាជ័យក្នុងការ Save ស្ថានភាពបញ្ជីទៅ Firebase! ស្ថានភាពត្រូវបានត្រឡប់ដើមវិញ។");
                if (lateErr && window.ZoeErrors) ZoeErrors.capture(lateErr, { context: 'toggleCloseStatus late transaction failed' });
            }, 'toggleCloseStatus')) {
                showToast("⏳ បណ្តាញឆ្លើយមិនចេញ — ស្ថានភាពបញ្ជីនឹងធ្វើបច្ចុប្បន្នភាពពេលបណ្តាញត្រឡប់មកវិញ។");
                return;
            }
            console.error("Error toggling close status: ", error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error toggling close status: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! កំពុងត្រឡប់ស្ថានភាពដើមវិញ...");
            revertCloseLocally();
        }
    }

    async function deleteSingleItem(id) {
        const index = scanHistory.findIndex(i => i.id === id);
        if (index === -1) return;

        if (!confirm(`តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?`)) return;

        if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
            const idErr = new Error('Unsafe id during deleteSingleItem');
            console.error(idErr.message, id);
            if (window.ZoeErrors) ZoeErrors.capture(idErr, { context: 'deleteSingleItem' });
            showToast("⚠️ លុបមិនបានជោគជ័យ! (ID មិនត្រឹមត្រូវ)");
            return;
        }

        let claimedWhole = null;
        let clearClaimBlocked = false;
        const deleteUpdater = (currentItem) => {
            claimedWhole = null;
            clearClaimBlocked = false;
            if (!currentItem) return currentItem;
            if (currentItem.clearClaim) {
                clearClaimBlocked = true;
                return currentItem;
            }
            normalizeBarcodesOf(currentItem);
            claimedWhole = currentItem;
            return null;
        };
        const finishDelete = async (result, late) => {
            if (!claimedWhole) {
                if (!clearClaimBlocked) {
                    const staleIdx = scanHistory.findIndex(i => i.id === id);
                    if (staleIdx !== -1) scanHistory.splice(staleIdx, 1);
                }
                refreshCurrentHistoryView();
                updateRecentPhonesList();
                showToast(clearClaimBlocked ? "⚠️ ធាតុនេះកំពុងត្រូវបានលុបជាក្រុមដោយសុវត្ថិភាព។ សូមរង់ចាំបន្តិច។" : "⚠️ ទិន្នន័យនេះត្រូវបានលុបដោយឧបករណ៍ផ្សេងរួចហើយ!");
                return;
            }

            const localIdx = scanHistory.findIndex(i => i.id === id);
            if (localIdx !== -1) scanHistory.splice(localIdx, 1);

            const removed = stripHistoryOnlyMarkers({ ...claimedWhole, id });
            removed.deletedAt = getServerNow();
            removed.isFromDeletion = true;
            removed.trashReason = 'delete';
            if (Array.isArray(removed.barcodes)) {
                removed.barcodes = removed.barcodes.map(b => ({ ...b, isFromDeletion: true }));
            }

            deletedItems.unshift(removed);
            refreshCurrentHistoryView();
            updateRecentPhonesList();

            let trashSaved = false;
            await notifyIfSlow(retryAsync(() => saveSingleDeletedItemToFirebase(removed), 4, 1500),
                TRASH_WRITE_SLOW_NOTICE_MS,
                "⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងរក្សាទុកការលុប… សូមកុំបិទ App។").then(() => {
                trashSaved = true;
            }).catch(async (trashErr) => {
                const staleIdx = deletedItems.findIndex(i => i.id === removed.id);
                if (staleIdx !== -1) deletedItems.splice(staleIdx, 1);
                console.error('Trash write permanently failed for deleteSingleItem of', id, trashErr);
                if (window.ZoeErrors) ZoeErrors.capture(trashErr, { context: 'deleteSingleItem trash write failed after retries', itemId: id });
                let restoredItem = null;
                let restoreOk = false;
                try {
                    const restoreResult = await restoreClaimedItemToScanHistory(id, claimedWhole, null);
                    restoredItem = (restoreResult && restoreResult.snapshot) ? restoreResult.snapshot.val() : null;
                    restoreOk = true;
                } catch (restoreErr) {
                    console.error('Failed to restore item to scan history after trash write failure for', id, restoreErr);
                    if (window.ZoeErrors) ZoeErrors.capture(restoreErr, { context: 'deleteSingleItem restore-after-trash-failure also failed', itemId: id });
                    showToast('⚠️ បញ្ហាធ្ងន់ធ្ងរ៖ ទិន្នន័យ ' + id + ' អាចនឹងបាត់! សូមប្រាប់ Admin ត្រួតពិនិត្យភ្លាមៗ');
                }
                if (restoreOk) {
                    refreshCurrentHistoryView();
                    updateRecentPhonesList();
                    showToast("⚠️ លុបមិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
                }
            });
            if (trashSaved) {
                showToast(late ? "✅ បណ្តាញត្រឡប់មកវិញ — បានលុបទៅធុងសំរាមបណ្តោះអាសន្ន!" : "បានលុបទៅធុងសំរាមបណ្តោះអាសន្ន!");
            }
        };
        try {
            const deleteTx = fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${id}`), deleteUpdater);
            let result;
            try {
                result = await dbOp(deleteTx);
            } catch (txError) {
                if (dbOpStalled(txError)) {
                    armLateCommit(deleteTx, (late) => finishDelete(late, true), (lateErr) => {
                        refreshCurrentHistoryView();
                        updateRecentPhonesList();
                        showToast("⚠️ លុបមិនបានជោគជ័យ! សូមសាកល្បងម្តងទៀត។");
                        if (lateErr && window.ZoeErrors) ZoeErrors.capture(lateErr, { context: 'deleteSingleItem late transaction failed', itemId: id });
                    }, 'deleteSingleItem');
                    showToast("⏳ បណ្តាញឆ្លើយមិនចេញ — ការលុបនឹងបញ្ចប់ដោយស្វ័យប្រវត្តិពេលបណ្តាញត្រឡប់មកវិញ។ សូមកុំលុបម្ដងទៀត។");
                    return;
                }
                throw txError;
            }
            if (!result || !result.committed) throw new Error('Delete item transaction was not committed');
            await finishDelete(result, false);
        } catch (e) {
            console.error("Error deleting single item: ", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Error deleting single item: " });
            refreshCurrentHistoryView();
            updateRecentPhonesList();
            showToast("⚠️ លុបមិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
        }
    }

    const TRASH_REASON_META = {
        remove: { label: 'ដក', cls: 'trash-tag-remove', deducted: true },
        expired: { label: 'ផុតកំណត់', cls: 'trash-tag-expired', deducted: true },
        pickup: { label: 'យករួច', cls: 'trash-tag-pickup', deducted: false },
        delete: { label: 'លុប', cls: 'trash-tag-delete', deducted: false }
    };

    function trashReasonOf(item) {
        if (!item) return 'delete';
        if (typeof item.trashReason === 'string' && TRASH_REASON_META[item.trashReason]) return item.trashReason;
        if (item.isFromDeletion) return item.isClosed ? 'pickup' : 'delete';
        return 'remove';
    }

    function trashItemTotals(item) {
        const entries = barcodeEntriesOf(item && item.barcodes);
        if (entries.length) {
            let cod = 0;
            let dod = 0;
            entries.forEach(({ barcode }) => {
                cod += parseFloat(barcode && barcode.cod) || 0;
                dod += parseFloat(barcode && barcode.dod) || 0;
            });
            return { cod: Math.round(cod * 100) / 100, dod: Math.round(dod * 100) / 100, count: entries.length };
        }
        const cod = parseFloat(item && item.cod) || 0;
        const dod = parseFloat(item && item.dod) || 0;
        const count = parseFloat(item && item.count) || 1;
        return { cod: Math.round(cod * 100) / 100, dod: Math.round(dod * 100) / 100, count: count };
    }

    function trashItemCodes(item) {
        const codes = [];
        barcodeEntriesOf(item && item.barcodes).forEach(({ barcode }) => {
            const code = barcode && barcode.code;
            if (code && codes.indexOf(code) === -1) codes.push(code);
        });
        if (!codes.length && item && item.barcode) codes.push(item.barcode);
        return codes;
    }

    function trashGroupKeyOf(item, reason) {
        return [reason, item.phone || '', item.scanDate || '', item.time || '']
            .map((part) => String(part).length + ':' + part).join('');
    }

    function buildTrashGroups(items) {
        const groups = [];
        const byKey = new Map();
        (Array.isArray(items) ? items : []).forEach((item) => {
            if (!item || !item.id) return;
            const reason = trashReasonOf(item);
            const key = trashGroupKeyOf(item, reason);
            let group = byKey.get(key);
            if (!group) {
                group = {
                    key: key, reason: reason, phone: item.phone || 'គ្មានលេខ',
                    scanDate: item.scanDate || '', time: item.time || '',
                    items: [], codes: [], cod: 0, dod: 0, count: 0, total: 0, deletedAt: 0
                };
                byKey.set(key, group);
                groups.push(group);
            }
            const totals = trashItemTotals(item);
            group.items.push(item);
            group.cod += totals.cod;
            group.dod += totals.dod;
            group.count += totals.count;
            trashItemCodes(item).forEach((code) => { if (group.codes.indexOf(code) === -1) group.codes.push(code); });
            const deletedAt = parseFloat(item.deletedAt) || 0;
            if (deletedAt > group.deletedAt) group.deletedAt = deletedAt;
        });
        groups.forEach((group) => {
            group.cod = Math.round(group.cod * 100) / 100;
            group.dod = Math.round(group.dod * 100) / 100;
            group.total = Math.round((group.cod + group.dod) * 100) / 100;
        });
        return groups;
    }

    function trashGroupMatchesQuery(group, query) {
        if (!query) return true;
        if (String(group.phone).toLowerCase().indexOf(query) !== -1) return true;
        return group.codes.some((code) => String(code).toLowerCase().indexOf(query) !== -1);
    }

    function filterRecentlyDeleted() {
        const input = document.getElementById('deletedSearchInput');
        deletedSearchQuery = input ? input.value : '';
        renderRecentlyDeleted();
    }

    function toggleTrashGroup(key) {
        if (!key) return;
        if (expandedTrashGroups.has(key)) expandedTrashGroups.delete(key);
        else expandedTrashGroups.add(key);
        renderRecentlyDeleted();
    }

    function closeRecentlyDeletedModal() {
        deletedSearchQuery = '';
        expandedTrashGroups.clear();
        const input = document.getElementById('deletedSearchInput');
        if (input) input.value = '';
        closeModal('recentlyDeletedModal');
    }

    function openRecentlyDeletedModal() {
        const input = document.getElementById('deletedSearchInput');
        if (input) input.value = deletedSearchQuery;
        renderRecentlyDeleted();
        openModalHelper('recentlyDeletedModal');
    }

    function trashSummaryCardHtml(cls, head, note, bucket) {
        const riel = Math.round(bucket.total * exchangeRateRiel);
        return `<div class="trash-sum-card ${cls}">
                    <div class="trash-sum-head">${head}</div>
                    <div class="trash-sum-note">${note}</div>
                    <div class="trash-sum-money">$${bucket.total.toFixed(2)}</div>
                    <div class="trash-sum-riel">${riel.toLocaleString()} ៛</div>
                    <div class="trash-sum-count">📦 ${bucket.count} កញ្ចប់</div>
                </div>`;
    }

    function renderTrashSummary(groups, query) {
        const box = document.getElementById('trashSummaryBox');
        if (!box) return;
        const deducted = { total: 0, count: 0 };
        const kept = { total: 0, count: 0 };
        groups.forEach((group) => {
            const meta = TRASH_REASON_META[group.reason] || TRASH_REASON_META.delete;
            const bucket = meta.deducted ? deducted : kept;
            bucket.total += group.total;
            bucket.count += group.count;
        });
        deducted.total = Math.round(deducted.total * 100) / 100;
        kept.total = Math.round(kept.total * 100) / 100;
        const grandTotal = Math.round((deducted.total + kept.total) * 100) / 100;
        const grandCount = deducted.count + kept.count;
        const scopeNote = query ? 'លទ្ធផលស្វែងរក' : 'ធុងសំរាមទាំងមូល';
        box.innerHTML = `
            <div class="trash-sum-grid">
                ${trashSummaryCardHtml('trash-sum-deducted', '➖ ដក + ផុតកំណត់', 'ដកចេញពីស្ថិតិរួចហើយ', deducted)}
                ${trashSummaryCardHtml('trash-sum-kept', '✅ យករួច + លុប', 'មិនប៉ះស្ថិតិចំណូល', kept)}
            </div>
            <div class="trash-sum-total">
                <span>${scopeNote}</span>
                <strong>សរុប $${grandTotal.toFixed(2)} · 📦 ${grandCount} កញ្ចប់ · ${groups.length} ជួរ</strong>
            </div>
        `;
    }

    function trashActionButtonsHtml(id) {
        return `<div class="trash-row-actions">
                    <button class="btn-sm trash-restore-btn" data-act="promptRestoreDeletedItem" data-a1="${sanitizeInput(id)}" title="ស្តារមកវិញ">🔄</button>
                    <button class="btn-sm trash-purge-btn" data-act="promptPermanentDelete" data-a1="${sanitizeInput(id)}" title="លុបជាអចិន្ត្រៃយ៍">✖️</button>
                </div>`;
    }

    function trashGroupRowHtml(group) {
        const meta = TRASH_REASON_META[group.reason] || TRASH_REASON_META.delete;
        const expanded = expandedTrashGroups.has(group.key);
        const codeTags = group.codes.slice(0, TRASH_CODES_PREVIEW)
            .map((code) => `<span class="barcode-tag">${sanitizeInput(code)}</span>`).join(' ');
        const moreCodes = group.codes.length > TRASH_CODES_PREVIEW
            ? `<span class="trash-more-codes">+${group.codes.length - TRASH_CODES_PREVIEW}</span>` : '';
        const whenText = [group.scanDate, group.time].filter(Boolean).join(' ') || 'មិនស្គាល់ពេល';
        const riel = Math.round(group.total * exchangeRateRiel);
        const actions = group.items.length === 1
            ? trashActionButtonsHtml(group.items[0].id)
            : `<button class="btn-sm trash-expand-btn" data-act="toggleTrashGroup" data-a1="${sanitizeInput(group.key)}" title="បង្ហាញធាតុនីមួយៗ">${expanded ? '▲' : '▼'} ${group.items.length}</button>`;

        let html = `<tr class="trash-group-row">
                <td>
                    <div class="trash-cust">
                        <strong>${sanitizeInput(group.phone)}</strong>
                        <span class="trash-tag ${meta.cls}">${meta.label}</span>
                    </div>
                    <div class="trash-when">🕒 ${sanitizeInput(whenText)}</div>
                    <div class="trash-codes">${codeTags}${moreCodes}</div>
                </td>
                <td>
                    <div><span class="count-badge">📦 ${group.count}</span></div>
                    <div class="trash-money">$${group.total.toFixed(2)}</div>
                    <div class="trash-riel">${riel.toLocaleString()} ៛</div>
                </td>
                <td style="text-align: center;">${actions}</td>
            </tr>`;

        if (expanded && group.items.length > 1) {
            group.items.forEach((item) => {
                const totals = trashItemTotals(item);
                const itemTotal = Math.round((totals.cod + totals.dod) * 100) / 100;
                const codes = trashItemCodes(item);
                const codeHtml = codes.length
                    ? codes.map((code) => `<span class="barcode-tag">${sanitizeInput(code)}</span>`).join(' ')
                    : '<span class="trash-more-codes">គ្មាន Barcode</span>';
                html += `<tr class="trash-sub-row">
                        <td>${codeHtml}</td>
                        <td><span class="count-badge">📦 ${totals.count}</span> <span class="trash-money">$${itemTotal.toFixed(2)}</span></td>
                        <td style="text-align: center;">${trashActionButtonsHtml(item.id)}</td>
                    </tr>`;
            });
        }
        return html;
    }

    function renderRecentlyDeleted() {
        const tbody = document.getElementById('deletedTableBody');
        if (!tbody) return;

        const query = String(deletedSearchQuery || '').trim().toLowerCase();
        const allGroups = buildTrashGroups(deletedItems);
        const groups = query ? allGroups.filter((group) => trashGroupMatchesQuery(group, query)) : allGroups;
        renderTrashSummary(groups, query);

        const liveKeys = new Set(allGroups.map((group) => group.key));
        Array.from(expandedTrashGroups).forEach((key) => { if (!liveKeys.has(key)) expandedTrashGroups.delete(key); });

        if (groups.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #888; padding: 14px;">${query ? 'រកមិនឃើញលេខ ឬ Barcode នេះក្នុងធុងសំរាមទេ' : 'គ្មានទិន្នន័យដែលបានលុបទេ'}</td></tr>`;
            return;
        }

        let html = '';
        groups.slice(0, DELETED_LIST_MAX_ROWS).forEach((group) => { html += trashGroupRowHtml(group); });
        if (groups.length > DELETED_LIST_MAX_ROWS) {
            html += `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:8px;">... និងមាន ${groups.length - DELETED_LIST_MAX_ROWS} ជួរទៀត (ផុតកំណត់ ៨ថ្ងៃ៖ ២ ថ្ងៃ · ប្រភេទផ្សេង៖ ៣០ ថ្ងៃ)</td></tr>`;
        }
        tbody.innerHTML = html;
    }

    function promptRestoreDeletedItem(id) {
        pendingRestoreId = id;
        const recentlyModal = document.getElementById('recentlyDeletedModal');
        if(recentlyModal) recentlyModal.style.display = 'none';
        openModalHelper('restoreWarningModal');
    }

    function cancelRestoreItem() {
        pendingRestoreId = null;
        closeModal('restoreWarningModal');
        openRecentlyDeletedModal();
    }

    const RESTORE_CLAIM_LEASE_MS = 2 * 60 * 1000;
    const activeRestoreClaims = new Map();

    function cloneRestoreItem(item) {
        if (!item || typeof item !== 'object') return null;
        const cloned = { ...item, barcodes: Array.isArray(item.barcodes) ? item.barcodes.map(b => b && typeof b === 'object' ? { ...b } : b) : item.barcodes };
        normalizeBarcodesOf(cloned);
        return cloned;
    }

    function isRestoreMergeTarget(target, itemToRestore) {
        return !!(target && !target.clearClaim && itemToRestore && itemToRestore.phone !== "គ្មានលេខ" && target.phone === itemToRestore.phone && Array.isArray(target.barcodes) && Array.isArray(itemToRestore.barcodes) && target.scanDate === itemToRestore.scanDate && !target.isClosed);
    }

    async function findRestoreTargetId(itemToRestore) {
        if (!itemToRestore || !itemToRestore.id || !dbRefHistory || !fb) return itemToRestore && itemToRestore.id;
        try {
            const historySnap = await dbOp(fb.get(dbRefHistory));
            const history = historySnap && historySnap.val();
            if (!history || typeof history !== 'object') return itemToRestore.id;
            const matchingId = Object.keys(history).find((id) => {
                const candidate = cloneRestoreItem(history[id]);
                return candidate && isRestoreMergeTarget(candidate, itemToRestore);
            });
            return matchingId || itemToRestore.id;
        } catch (e) {
            return itemToRestore.id;
        }
    }

    function isActiveRestoreClaim(claim) {
        const claimedAt = claim && parseFloat(claim.claimedAt);
        const now = getServerNow();
        return !!(claim && typeof claim.token === 'string' && claim.token && isFinite(claimedAt) && claimedAt <= now && (now - claimedAt) < RESTORE_CLAIM_LEASE_MS);
    }

    function generateRestoreClaimToken() {
        return 'restore_' + generateUniqueId() + '_' + Math.random().toString(36).slice(2);
    }

    async function claimDeletedItemForRestore(id, token, targetId) {
        let claimedItem = null;
        let replacedClaim = null;
        let claimStatus = 'ALREADY_RESTORED';
        const trashRef = fb.ref(db, `zoew_recently_deleted_cod_dod/${id}`);
        const result = await dbOp(fb.runTransaction(trashRef, (currentItem) => {
            claimedItem = null;
            replacedClaim = null;
            claimStatus = 'ALREADY_RESTORED';
            if (!currentItem || typeof currentItem !== 'object') return;
            const existingClaim = currentItem.restoreClaim;
            if (existingClaim && existingClaim.token !== token && isActiveRestoreClaim(existingClaim)) {
                claimStatus = 'RESTORE_IN_PROGRESS';
                return;
            }
            if (existingClaim && existingClaim.token !== token) {
                replacedClaim = { token: existingClaim.token, targetId: existingClaim.targetId };
            }
            claimedItem = cloneRestoreItem(currentItem);
            delete claimedItem.restoreClaim;
            delete claimedItem.restoreClaimId;
            delete claimedItem.restoreClaimToken;
            if (!claimedItem.id) claimedItem.id = id;
            currentItem.restoreClaim = { token, claimedAt: getServerNow(), targetId };
            claimStatus = 'CLAIMED';
            return currentItem;
        }));
        if (!result || !result.committed || !claimedItem) throw new Error(claimStatus);
        return { item: claimedItem, replacedClaim };
    }

    async function bindRestoreClaimTarget(id, token, targetId) {
        let bound = false;
        const result = await dbOp(fb.runTransaction(fb.ref(db, `zoew_recently_deleted_cod_dod/${id}`), (currentItem) => {
            bound = false;
            if (!currentItem || !currentItem.restoreClaim || currentItem.restoreClaim.token !== token) return;
            currentItem.restoreClaim = { token, claimedAt: getServerNow(), targetId };
            bound = true;
            return currentItem;
        }));
        if (!bound || !result || !result.committed) throw new Error('RESTORE_CLAIM_LOST');
    }

    async function clearRestoreHistoryMarker(targetId, sourceId, token) {
        if (!targetId || !sourceId || !token) return;
        await dbOp(fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${targetId}`), (currentItem) => {
            if (!currentItem || currentItem.restoreClaimId !== sourceId || currentItem.restoreClaimToken !== token) return;
            delete currentItem.restoreClaimId;
            delete currentItem.restoreClaimToken;
            return currentItem;
        }));
    }

    async function clearRestoreFinalization(sourceId, token) {
        if (!sourceId || !token) return;
        await dbOp(fb.runTransaction(fb.ref(db, `zoew_restore_finalizations/${sourceId}`), (currentFinalization) => {
            if (!currentFinalization || currentFinalization.token !== token) return;
            return null;
        }));
    }

    async function applyClaimedRestoreToHistory(targetId, sourceId, token, itemToRestore, applyRestoreMergeInto) {
        let targetChanged = false;
        let committedItem = null;
        const result = await dbOp(fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${targetId}`), (currentItem) => {
            targetChanged = false;
            committedItem = null;
            if (currentItem) normalizeBarcodesOf(currentItem);
            if (currentItem && currentItem.clearClaim) {
                targetChanged = true;
                return;
            }
            if (targetId !== itemToRestore.id && !isRestoreMergeTarget(currentItem, itemToRestore)) {
                targetChanged = true;
                return;
            }
            const target = currentItem ? applyRestoreMergeInto(currentItem) : cloneRestoreItem(itemToRestore);
            if (!target) return;
            target.id = targetId;
            target.restoreClaimId = sourceId;
            target.restoreClaimToken = token;
            committedItem = target;
            return target;
        }));
        if (targetChanged) return { targetChanged: true, item: null };
        if (!result || !result.committed || !committedItem) throw new Error('RESTORE_HISTORY_WRITE_FAILED');
        const snapshotItem = result.snapshot ? cloneRestoreItem(result.snapshot.val()) : committedItem;
        return { targetChanged: false, item: snapshotItem };
    }

    function appendRestoreRevenueIncrements(updates, deltas) {
        const daily = {};
        const monthly = {};
        deltas.forEach((delta) => {
            const scanDate = delta.scanDate || getFormattedDate();
            const month = scanDate.substring(0, 7);
            if (!daily[scanDate]) daily[scanDate] = { cod: 0, dod: 0, count: 0 };
            if (!monthly[month]) monthly[month] = { cod: 0, dod: 0, count: 0 };
            daily[scanDate].cod += parseFloat(delta.cod) || 0;
            daily[scanDate].dod += parseFloat(delta.dod) || 0;
            daily[scanDate].count += parseFloat(delta.count) || 0;
            monthly[month].cod += parseFloat(delta.cod) || 0;
            monthly[month].dod += parseFloat(delta.dod) || 0;
            monthly[month].count += parseFloat(delta.count) || 0;
        });
        const append = (path, amount) => {
            if (amount) updates[path] = fb.increment(amount);
        };
        Object.keys(daily).forEach((scanDate) => {
            const delta = daily[scanDate];
            append(`zoew_daily_revenue_cod_dod/${scanDate}/codDollar`, delta.cod);
            append(`zoew_daily_revenue_cod_dod/${scanDate}/dodDollar`, delta.dod);
            append(`zoew_daily_revenue_cod_dod/${scanDate}/totalCount`, delta.count);
        });
        Object.keys(monthly).forEach((month) => {
            const delta = monthly[month];
            append(`zoew_monthly_revenue_cod_dod/${month}/codDollar`, delta.cod);
            append(`zoew_monthly_revenue_cod_dod/${month}/dodDollar`, delta.dod);
            append(`zoew_monthly_revenue_cod_dod/${month}/totalCount`, delta.count);
        });
    }

    async function finalizeClaimedRestore(sourceId, token, targetId, revenueDeltas) {
        const updates = {
            [`zoew_restore_finalizations/${sourceId}`]: { token, targetId, finalizedAt: getServerNow() },
            [`zoew_recently_deleted_cod_dod/${sourceId}`]: null,
            [`zoew_scan_history_cod_dod/${targetId}/restoreClaimId`]: null,
            [`zoew_scan_history_cod_dod/${targetId}/restoreClaimToken`]: null
        };
        appendRestoreRevenueIncrements(updates, revenueDeltas);
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await dbOp(fb.update(fb.ref(db), updates));
                return;
            } catch (error) {
                lastError = error;
                let trashSnapshot;
                try {
                    trashSnapshot = await dbOp(fb.get(fb.ref(db, `zoew_recently_deleted_cod_dod/${sourceId}`)));
                } catch (readError) {
                    throw error;
                }
                if (!trashSnapshot.exists()) return;
                const currentTrash = trashSnapshot.val();
                const currentClaim = currentTrash && currentTrash.restoreClaim;
                if (!currentClaim || currentClaim.token !== token || currentClaim.targetId !== targetId) throw new Error('RESTORE_CLAIM_LOST');
                if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
            }
        }
        throw lastError || new Error('RESTORE_FINAL_WRITE_FAILED');
    }

    async function executeRestoreItem() {
        const restoredId = pendingRestoreId;
        if (!restoredId || !db || !fb || !dbRefDeleted) return;
        closeModal('restoreWarningModal');
        pendingRestoreId = null;
        try {
            const safeIdPattern = /^[a-zA-Z0-9_-]+$/;
            if (!safeIdPattern.test(restoredId)) {
                throw new Error('Unsafe id during restore');
            }
            const existingClaim = activeRestoreClaims.get(restoredId);
            const token = existingClaim ? existingClaim.token : generateRestoreClaimToken();
            let targetId = existingClaim ? existingClaim.targetId : null;
            if (!targetId) {
                const previewSnap = await dbOp(fb.get(fb.ref(db, `zoew_recently_deleted_cod_dod/${restoredId}`)));
                if (!previewSnap.exists()) throw new Error('ALREADY_RESTORED');
                const previewItem = cloneRestoreItem(previewSnap.val());
                if (!previewItem) throw new Error('ALREADY_RESTORED');
                targetId = await findRestoreTargetId(previewItem);
            }
            const claimed = await claimDeletedItemForRestore(restoredId, token, targetId);
            activeRestoreClaims.set(restoredId, { token, targetId });
            if (claimed.replacedClaim && claimed.replacedClaim.targetId) {
                await clearRestoreHistoryMarker(claimed.replacedClaim.targetId, restoredId, claimed.replacedClaim.token).catch(() => {});
            }

            let itemToRestore = claimed.item;
            const restoredWasRemoved = itemToRestore.isFromDeletion === false;
            delete itemToRestore.deletedAt;
            delete itemToRestore.isFromDeletion;
            delete itemToRestore.trashReason;
            delete itemToRestore.restoreClaim;
            delete itemToRestore.restoreClaimId;
            delete itemToRestore.restoreClaimToken;
            if (itemToRestore.isClosed) {
                itemToRestore.closedAt = getServerNow();
            } else {
                itemToRestore.createdAt = getServerNow();
            }

            const appliedRevenueDeltas = [];
            const revenueScanDate = itemToRestore.scanDate || getFormattedDate();
            if (itemToRestore.barcodes && Array.isArray(itemToRestore.barcodes)) {
                itemToRestore.barcodes.forEach((restoredBc) => {
                    if (restoredBc.isDeducted) {
                        const targetCod = parseFloat(restoredBc.cod) || 0;
                        const targetDod = parseFloat(restoredBc.dod) || 0;
                        appliedRevenueDeltas.push({ scanDate: revenueScanDate, cod: targetCod, dod: targetDod, count: 1 });
                        restoredBc.isDeducted = false;
                    }
                    restoredBc.isFromDeletion = false;
                    if (restoredBc.isClosed) restoredBc.closedAt = getServerNow();
                    else delete restoredBc.closedAt;
                });
            } else if (restoredWasRemoved) {
                const legacyCod = parseFloat(itemToRestore.cod) || 0;
                const legacyDod = parseFloat(itemToRestore.dod) || 0;
                const legacyCount = parseFloat(itemToRestore.count) || 1;
                appliedRevenueDeltas.push({ scanDate: revenueScanDate, cod: legacyCod, dod: legacyDod, count: legacyCount });
            }

            const applyRestoreMergeInto = (target) => {
                if (!target.barcodes || !Array.isArray(target.barcodes)) target.barcodes = [];
                if (itemToRestore.barcodes && Array.isArray(itemToRestore.barcodes)) {
                    itemToRestore.barcodes.forEach(restoredBc => {
                        if (!target.barcodes.some(b => b && b.code === restoredBc.code)) target.barcodes.push({ ...restoredBc });
                    });
                }
                target.count = target.barcodes.length;
                target.cod = Math.round(target.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                target.dod = Math.round(target.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                target.price = Math.round((target.cod + target.dod) * 100) / 100;
                target.isClosed = target.barcodes.length > 0 && target.barcodes.every(b => b.isClosed);
                if (target.isClosed) {
                    target.closedAt = getServerNow();
                } else {
                    delete target.closedAt;
                }
                if (itemToRestore.callMarkTime && (!target.callMarkTime || itemToRestore.callMarkTime > target.callMarkTime)) {
                    target.isCalled = itemToRestore.isCalled;
                    if (itemToRestore.callMark) target.callMark = itemToRestore.callMark;
                    else delete target.callMark;
                    target.callMarkTime = itemToRestore.callMarkTime;
                }
                return target;
            };

            let prepared = await applyClaimedRestoreToHistory(targetId, restoredId, token, itemToRestore, applyRestoreMergeInto);
            if (prepared.targetChanged && targetId !== itemToRestore.id) {
                targetId = itemToRestore.id;
                await bindRestoreClaimTarget(restoredId, token, targetId);
                activeRestoreClaims.set(restoredId, { token, targetId });
                prepared = await applyClaimedRestoreToHistory(targetId, restoredId, token, itemToRestore, applyRestoreMergeInto);
            }
            if (prepared.targetChanged || !prepared.item) throw new Error('RESTORE_TARGET_CHANGED');
            await finalizeClaimedRestore(restoredId, token, targetId, appliedRevenueDeltas);
            activeRestoreClaims.delete(restoredId);
            await clearRestoreFinalization(restoredId, token).catch(() => {});
            const finalSnap = await dbOp(fb.get(fb.ref(db, `zoew_scan_history_cod_dod/${targetId}`)));
            const resultingLiveItem = finalSnap.exists() ? cloneRestoreItem(finalSnap.val()) : prepared.item;
            openRecentlyDeletedModal();
            refreshCurrentHistoryView();
            updateRecentPhonesList();
            showToast("បានស្តារទិន្នន័យមកទីតាំងដើមវិញដោយសុវត្ថិភាព!");
        } catch (error) {
            const alreadyRestored = !!(error && (error.message === 'ALREADY_RESTORED' || error.message === 'RESTORE_CLAIM_LOST'));
            if (error && error.message === 'RESTORE_CLAIM_LOST') activeRestoreClaims.delete(restoredId);
            if (!alreadyRestored) {
                console.error("Restore failed: ", restoredId, error);
                if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Restore failed: " });
            }
            try {
                const [histSnap, delSnap] = await dbOp(Promise.all([fb.get(dbRefHistory), fb.get(dbRefDeleted)]));
                const histData = histSnap.val();
                scanHistory = histData ? Object.keys(histData).map(k => { const v = histData[k]; if (v && !v.id) v.id = k; return normalizeBarcodesOf(v); }).filter(Boolean) : [];
                const delData = delSnap.val();
                deletedItems = delData ? Object.keys(delData).map(k => { const v = delData[k]; if (v && !v.id) v.id = k; return normalizeBarcodesOf(v); }).filter(Boolean) : [];
            } catch (resyncError) {
                console.error("Resync after failed restore also failed: ", resyncError);
                if (window.ZoeErrors) ZoeErrors.capture(resyncError, { context: "Resync after failed restore also failed: " });
            }
            if (alreadyRestored) {
                alert("⚠️ ទិន្នន័យនេះត្រូវបានស្តារ ឬលុបចោលរួចហើយពី device ផ្សេង! ស្ថានភាពត្រូវបានធ្វើបច្ចុប្បន្នភាពវិញ។");
            } else {
                alert("❌ ស្តារទិន្នន័យបរាជ័យ! ទិន្នន័យនៅរក្សាទុកដោយសុវត្ថិភាព ហើយអាចសាកល្បងម្តងទៀតបាន។\n\nមូលហេតុ: " + (error && error.message ? error.message : error));
            }
            openRecentlyDeletedModal();
            refreshCurrentHistoryView();
        }
    }

    let pendingPermanentDeleteId = null;

    function promptPermanentDelete(id) {
        pendingPermanentDeleteId = id;
        const recentlyModal = document.getElementById('recentlyDeletedModal');
        if (recentlyModal) recentlyModal.style.display = 'none';
        openModalHelper('permanentDeleteWarningModal');
    }

    function cancelPermanentDelete() {
        pendingPermanentDeleteId = null;
        closeModal('permanentDeleteWarningModal');
        openRecentlyDeletedModal();
    }

    async function releaseStaleRestoreClaimForPurge(id) {
        if (!db || !fb || !id || !/^[a-zA-Z0-9_-]+$/.test(id)) return;
        await dbOp(fb.runTransaction(fb.ref(db, `zoew_recently_deleted_cod_dod/${id}`), (currentItem) => {
            if (!currentItem || !currentItem.restoreClaim) return;
            if (isActiveRestoreClaim(currentItem.restoreClaim)) return;
            delete currentItem.restoreClaim;
            return currentItem;
        }));
    }

    async function executePermanentDelete() {
        const id = pendingPermanentDeleteId;
        pendingPermanentDeleteId = null;
        closeModal('permanentDeleteWarningModal');
        if (!id) { openRecentlyDeletedModal(); return; }

        const index = deletedItems.findIndex(i => i.id === id);
        if (index === -1) { openRecentlyDeletedModal(); return; }

        const purgedItem = deletedItems.splice(index, 1)[0];
        renderRecentlyDeleted();
        openRecentlyDeletedModal();

        try {
            await releaseStaleRestoreClaimForPurge(id);
            await notifyIfSlow(deleteSingleDeletedItemFromFirebase(id), TRASH_WRITE_SLOW_NOTICE_MS,
                "⏳ បណ្តាញឆ្លើយមិនចេញ — កំពុងលុបជាអចិន្ត្រៃយ៍… សូមកុំបិទ App។");
            releaseBarcodesInRegistry(collectItemBarcodes(purgedItem));
        } catch (e) {
            if (!deletedItems.some((i) => i && i.id === id)) {
                deletedItems.splice(Math.min(index, deletedItems.length), 0, purgedItem);
            }
            renderRecentlyDeleted();
            showToast("⚠️ លុបជាអចិន្ត្រៃយ៍មិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
        }
    }

    function mergeBarcodeIntoHistoryItem(id, mergeFn, fallbackItem) {
        if (!db || !fb || !id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
            const err = new Error('Refusing to merge barcode into history item with missing/unsafe id');
            console.error(err.message, id);
            if (window.ZoeErrors) ZoeErrors.capture(err, { context: 'mergeBarcodeIntoHistoryItem' });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! (ID មិនត្រឹមត្រូវ)");
            return Promise.reject(err);
        }
        return fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${id}`), (currentItem) => {
            if (currentItem && currentItem.clearClaim) return;
            if (!currentItem) return fallbackItem;
            dropStaleRestoreMarkers(currentItem);
            return mergeFn(currentItem);
        }).then((result) => {
            if (!result || !result.committed) {
                throw new Error('Barcode merge transaction was not committed');
            }
            const committed = result.snapshot ? result.snapshot.val() : null;
            if (committed && !committed.id) committed.id = id;
            return committed;
        }).catch((error) => {
            console.error("Error merging barcode into history item: ", error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error merging barcode into history item: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!");
            throw error;
        });
    }

    function saveSingleHistoryItemToFirebase(item) {
        if (!dbRefHistory) return Promise.resolve();
        if (!item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) {
            const err = new Error('Refusing to save history item with missing/unsafe id');
            console.error(err.message, item && item.id);
            if (window.ZoeErrors) ZoeErrors.capture(err, { context: 'saveSingleHistoryItemToFirebase' });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! (ID មិនត្រឹមត្រូវ)");
            return Promise.reject(err);
        }
        return fb.update(dbRefHistory, { [item.id]: item }).catch((error) => {
            console.error("Error saving history item: ", error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error saving history item: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!");
            throw error;
        });
    }

    function historyPatchErrorIsDisconnect(error) {
        if (!error) return false;
        const text = String((error && (error.message || error.code)) || error);
        return /disconnect/i.test(text);
    }

    function queueHistoryPatchRetry(itemId, fields, previousFields) {
        if (!itemId || !fields) return false;
        const existing = pendingHistoryPatches.get(itemId);
        if (existing) {
            if (existing.attempts >= HISTORY_PATCH_RETRY_MAX) return false;
            Object.assign(existing.fields, fields);
            return true;
        }
        if (pendingHistoryPatches.size >= HISTORY_PATCH_QUEUE_MAX) return false;
        pendingHistoryPatches.set(itemId, {
            fields: Object.assign({}, fields),
            previousFields: previousFields ? Object.assign({}, previousFields) : null,
            attempts: 0
        });
        return true;
    }

    function flushPendingHistoryPatches() {
        if (historyPatchFlushInFlight) return;
        if (!pendingHistoryPatches.size) return;
        if (!dbRefHistory || !db || !fb) return;
        const entries = Array.from(pendingHistoryPatches.entries());
        pendingHistoryPatches.clear();
        historyPatchFlushInFlight = true;
        let settled = 0;
        const done = () => {
            settled++;
            if (settled < entries.length) return;
            historyPatchFlushInFlight = false;
            scheduleHistoryViewRefresh();
        };
        const noteAttempt = (itemId, attempts) => {
            const requeued = pendingHistoryPatches.get(itemId);
            if (requeued) requeued.attempts = attempts;
        };
        entries.forEach((pair) => {
            const itemId = pair[0];
            const entry = pair[1];
            const attempts = entry.attempts + 1;
            const target = scanHistory.find(i => i.id === itemId) || { id: itemId };
            let started = null;
            try {
                started = patchHistoryItemFields(target, entry.fields, entry.previousFields, null,
                    { retryOnDisconnect: attempts < HISTORY_PATCH_RETRY_MAX });
            } catch (e) {
                if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'flushPendingHistoryPatches' });
                if (attempts < HISTORY_PATCH_RETRY_MAX) {
                    queueHistoryPatchRetry(itemId, entry.fields, entry.previousFields);
                    noteAttempt(itemId, attempts);
                }
                done();
                return;
            }
            Promise.resolve(started).then((saved) => {
                if (!saved) noteAttempt(itemId, attempts);
                done();
            }, done);
        });
    }

    function patchHistoryItemFields(item, fields, previousFields, onServerItem, opts) {
        if (!dbRefHistory || !db || !fb) return Promise.resolve(false);
        if (!item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) {
            const err = new Error('Refusing to patch history item with missing/unsafe id');
            console.error(err.message, item && item.id);
            if (window.ZoeErrors) ZoeErrors.capture(err, { context: 'patchHistoryItemFields' });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! (ID មិនត្រឹមត្រូវ)");
            return Promise.resolve(false);
        }
        const revertLocalFields = () => {
            if (!previousFields) return;
            const revertItem = scanHistory.find(i => i.id === item.id);
            if (!revertItem) return;
            Object.keys(previousFields).forEach((key) => {
                if (previousFields[key] === undefined) delete revertItem[key];
                else revertItem[key] = previousFields[key];
            });
            refreshCurrentHistoryView();
        };
        let serverItemExisted = false;
        return dbOp(fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${item.id}`), (currentItem) => {
            serverItemExisted = false;
            if (!currentItem) return currentItem;
            normalizeBarcodesOf(currentItem);
            if (currentItem.clearClaim) return;
            if (onServerItem) onServerItem(currentItem);
            Object.keys(fields).forEach((key) => {
                if (fields[key] === null) delete currentItem[key];
                else currentItem[key] = fields[key];
            });
            serverItemExisted = true;
            return currentItem;
        })).then((result) => {
            if (!serverItemExisted || !(result && result.committed)) {
                revertLocalFields();
                showToast("⚠️ ទិន្នន័យនេះលែងមានក្នុងប្រព័ន្ធ! ការកែប្រែមិនត្រូវបានរក្សាទុកទេ។");
                return false;
            }
            const committedItem = result.snapshot ? normalizeBarcodesOf(result.snapshot.val()) : null;
            if (committedItem && !committedItem.id) committedItem.id = item.id;
            return committedItem || true;
        }, (error) => {
            if (opts && opts.retryOnDisconnect && historyPatchErrorIsDisconnect(error)
                && queueHistoryPatchRetry(item.id, fields, previousFields)) {
                return false;
            }
            console.error("Error patching history item: ", error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error patching history item: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! កំពុងត្រឡប់ស្ថានភាពដើមវិញ...");
            revertLocalFields();
            return false;
        });
    }

    function saveSingleDeletedItemToFirebase(item) {
        if (!dbRefDeleted) return Promise.resolve();
        if (!item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) {
            const err = new Error('Refusing to save deleted item with missing/unsafe id');
            console.error(err.message, item && item.id);
            if (window.ZoeErrors) ZoeErrors.capture(err, { context: 'saveSingleDeletedItemToFirebase' });
            showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase! (ID មិនត្រឹមត្រូវ)");
            return Promise.reject(err);
        }
        return fb.update(dbRefDeleted, { [item.id]: item }).catch((error) => {
            console.error("Error saving deleted item: ", error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error saving deleted item: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase!");
            throw error;
        });
    }

    function deleteSingleDeletedItemFromFirebase(id) {
        if (!dbRefDeleted) return Promise.resolve();
        if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
            const err = new Error('Refusing to delete deleted item with missing/unsafe id');
            console.error(err.message, id);
            if (window.ZoeErrors) ZoeErrors.capture(err, { context: 'deleteSingleDeletedItemFromFirebase' });
            showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase! (ID មិនត្រឹមត្រូវ)");
            return Promise.reject(err);
        }
        return fb.update(dbRefDeleted, { [id]: null }).catch((error) => {
            console.error("Error deleting deleted item: ", error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error deleting deleted item: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase!");
            throw error;
        });
    }

    function purgeDeletedItemsQuietly(ids) {
        if (!dbRefDeleted || !ids || !ids.length) return Promise.resolve();
        const updates = {};
        ids.forEach(id => {
            if (id && /^[a-zA-Z0-9_-]+$/.test(id)) updates[id] = null;
        });
        if (!Object.keys(updates).length) return Promise.resolve();
        return fb.update(dbRefDeleted, updates);
    }

    function playBeep() {
        try {
            if (!globalAudioCtx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    globalAudioCtx = new AudioContextClass();
                }
            }
            if (!globalAudioCtx) return;

            if (globalAudioCtx.state === 'suspended') {
                globalAudioCtx.resume().then(() => {
                    executeBeepSound(globalAudioCtx);
                }).catch(() => {});
            } else if (globalAudioCtx.state === 'running') {
                executeBeepSound(globalAudioCtx);
            }
        } catch (e) {}
    }

    function executeBeepSound(audioCtx) {
        try {
            if (audioCtx.state === 'closed') return;
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.15);
        } catch (e) {}
    }

    function buildHistoryRowHtml(item, rowNum, isOld, needsRecall) {
            let phoneDisplay = item.phone === "គ្មានលេខ" ? `<span style="color:#ef4444; font-style:italic;">គ្មានលេខ</span>` : `<span class="phone-clickable" data-act="openCallMarkModal" data-a1="${sanitizeInput(item.id)}" title="ចុចដើម្បីសម្គាល់ការខល">${sanitizeInput(item.phone)}</span>`;

            let rowNumClass = '';
            let rowNumLabel = '';
            if (item.callMark === 'no-answer') { rowNumClass = 'row-num-no-answer'; rowNumLabel = 'ខល អត់លើក'; }
            else if (item.callMark === 'no-connect') { rowNumClass = 'row-num-no-connect'; rowNumLabel = 'ខល អត់ចូល'; }
            else if (item.callMark === 'wrong-number') { rowNumClass = 'row-num-wrong-number'; rowNumLabel = 'ខុសលេខ'; }

            let lockerLoc = "N/A";
            if (item.barcodes && Array.isArray(item.barcodes) && item.barcodes.length > 0) {
                let allLockers = item.barcodes.map(b => b.locker || "N/A").filter(l => l && l !== "N/A");
                let uniqueLockers = [...new Set(allLockers)];

                if (uniqueLockers.length > 1) {
                    lockerLoc = `${uniqueLockers.join(', ')} (${uniqueLockers.length} កន្លែង)`;
                } else if (uniqueLockers.length === 1) {
                    lockerLoc = uniqueLockers[0];
                } else {
                    lockerLoc = item.locker || "N/A";
                }
            } else {
                lockerLoc = item.locker || "N/A";
            }

            let callAction = '';
            if (item.phone !== "គ្មានលេខ") {
                if (item.callMark === 'wrong-number') {
                    callAction = `<button class="btn-sm fix-phone-btn btn-primary-action" data-act="openEditModal" data-a1="${sanitizeInput(item.id)}" title="លេខខុស — សូមកែលេខថ្មី">✏️ កែលេខ</button>`;
                } else if (item.isCalled && !needsRecall) {
                    callAction = `<a href="tel:${sanitizeInput(item.phone)}" data-act="handleCallAction" data-a1="${sanitizeInput(item.id)}" class="btn-sm called-btn btn-primary-action">✔️ ខល</a>`;
                } else {
                    let recallClass = needsRecall ? ' call-btn-recall' : '';
                    callAction = `<a href="tel:${sanitizeInput(item.phone)}" data-act="handleCallAction" data-a1="${sanitizeInput(item.id)}" class="btn-sm call-btn btn-primary-action${recallClass}" title="${needsRecall ? 'សូមខលម្ដងទៀត' : ''}">📞 ខល</a>`;
                }
            }

            let closeBtnText = item.isClosed ? "❌ បើក" : "✅ បិទ";
            let closeAction = `<button class="btn-sm close-btn btn-primary-action" data-act="toggleCloseStatus" data-a1="${sanitizeInput(item.id)}">${closeBtnText}</button>`;

            let moreDropdown = `
                <div class="more-dropdown row-more-corner">
                    <button class="more-btn" data-act="toggleMoreDropdown" data-self="1" data-evt="1" data-a1="${sanitizeInput(item.id)}" title="ជម្រើសបន្ថែម">⋮</button>
                </div>
            `;

            let ageBadge = isOld
                ? `<span style="background:#fef3c7; color:#b45309; padding:2px 5px; border-radius:4px; font-size:calc(9 * var(--fs-unit)); font-weight:600;">ចាស់</span>`
                : `<span style="background:var(--success-light); color:var(--success); padding:2px 5px; border-radius:4px; font-size:calc(9 * var(--fs-unit)); font-weight:600;">ថ្មី</span>`;

            let statusBadge = item.isClosed ? `<span class="closed-badge">យកហើយ</span>` : ageBadge;
            let calledBadge = item.isCalled ? `<span class="called-badge">ខល</span>` : "";
            let scanTimeDisplay = item.time ? `<span class="scan-time-tag">${sanitizeInput(formatScanStamp(item.time))}</span>` : "";

            let totalPackageCount = item.barcodes && Array.isArray(item.barcodes) ? item.barcodes.length : (parseFloat(item.count) || 1);
            let viewListBtn = `<button class="btn-view-list" data-act="openViewListModal" data-a1="${sanitizeInput(item.id)}">📦 បញ្ជី (${totalPackageCount})</button>`;

            let activeCod = 0;
            let activeDod = 0;
            let activeCount = parseFloat(item.count) || 1;

            if (item.barcodes && Array.isArray(item.barcodes)) {
                activeCod = item.barcodes.filter(b => !b.isClosed).reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0);
                activeDod = item.barcodes.filter(b => !b.isClosed).reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0);
                activeCount = item.barcodes.filter(b => !b.isClosed).length;
            } else {
                activeCod = !item.isClosed ? (parseFloat(item.cod) || 0) : 0;
                activeDod = !item.isClosed ? (parseFloat(item.dod) || 0) : 0;
                activeCount = !item.isClosed ? (parseFloat(item.count) || 1) : 0;
            }

            activeCod = Math.round(activeCod * 100) / 100;
            activeDod = Math.round(activeDod * 100) / 100;

            let priceDisplayHtml = '';
            let hasCod = activeCod > 0;
            let hasDod = activeDod > 0;

            if (hasCod && hasDod) {
                let codRiel = Math.round(activeCod * exchangeRateRiel);
                let dodRiel = Math.round(activeDod * exchangeRateRiel);
                let bothTotal = Math.round((activeCod + activeDod) * 100) / 100;
                let bothRiel = codRiel + dodRiel;
                priceDisplayHtml = `
                    <div style="font-size: calc(10 * var(--fs-unit));">COD: <strong style="color:var(--accent-blue);">$${activeCod.toFixed(2)}</strong> (${codRiel.toLocaleString()} ៛)</div>
                    <div style="font-size: calc(10 * var(--fs-unit)); margin-top:2px;">DOD: <strong style="color:var(--accent-purple);">$${activeDod.toFixed(2)}</strong> (${dodRiel.toLocaleString()} ៛)</div>
                    <div class="price-sum-line">សរុប: <strong>$${bothTotal.toFixed(2)}</strong> (${bothRiel.toLocaleString()} ៛)</div>
                `;
            } else if (hasCod) {
                let codRiel = Math.round(activeCod * exchangeRateRiel);
                priceDisplayHtml = `
                    <div style="font-size: calc(10.5 * var(--fs-unit));">COD: <strong style="color:var(--accent-blue);">$${activeCod.toFixed(2)}</strong></div>
                    <div style="font-size: calc(9.5 * var(--fs-unit)); color: var(--text-muted);">${codRiel.toLocaleString()} ៛</div>
                `;
            } else if (hasDod) {
                let dodRiel = Math.round(activeDod * exchangeRateRiel);
                priceDisplayHtml = `
                    <div style="font-size: calc(10.5 * var(--fs-unit));">DOD: <strong style="color:var(--accent-purple);">$${activeDod.toFixed(2)}</strong></div>
                    <div style="font-size: calc(9.5 * var(--fs-unit)); color: var(--text-muted);">${dodRiel.toLocaleString()} ៛</div>
                `;
            } else {
                priceDisplayHtml = `
                    <div style="font-size: calc(10.5 * var(--fs-unit)); color: var(--text-muted);">0.00 $ (0 ៛)</div>
                `;
            }

            const html = `
                <td style="text-align: center;">${rowNumClass ? `<span class="row-num-mark ${rowNumClass}" title="${rowNumLabel}">${rowNum}</span>` : rowNum}</td>
                <td>
                    <div class="customer-info-stack">
                        <div class="cust-badge-line">
                            ${calledBadge}${statusBadge}
                        </div>
                        <div class="phone-title">
                            ${phoneDisplay}
                        </div>
                        <div>
                            ${viewListBtn}
                        </div>
                        ${scanTimeDisplay}
                    </div>
                </td>
                <td class="col-price">
                    <div class="price-stack">
                        <span class="locker-badge">ទីតាំង: ${sanitizeInput(lockerLoc)}</span>
                        <div class="price-figures">${priceDisplayHtml}</div>
                        <span class="count-badge">កញ្ចប់សរុប: ${activeCount}</span>
                    </div>
                </td>
                <td class="action-cell">
                    ${moreDropdown}
                    <div class="action-group">
                        ${callAction}${closeAction}
                    </div>
                </td>
            `;
            return { isClosedRow: !!item.isClosed, html: html };
    }

    function renderHistory(dataToRender = scanHistory) {
        const tbody = document.getElementById('historyTableBody');
        const countSpan = document.getElementById('count');
        if (!tbody || !countSpan) return;
        countSpan.innerText = dataToRender.length;

        if (dataToRender.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #888; padding: 16px;">📦 គ្មានទិន្នន័យបង្ហាញទេ</td></tr>`;
            return;
        }

        if (tbody.children.length && !tbody.children[0].dataset.id) {
            tbody.innerHTML = '';
        }

        const existingRows = new Map();
        Array.from(tbody.children).forEach((tr) => {
            if (tr.dataset.id) existingRows.set(tr.dataset.id, tr);
        });

        const currentTime = getServerNow();
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
        const seenIds = new Set();
        let prevNode = null;

        for (let i = dataToRender.length - 1; i >= 0; i--) {
            const item = dataToRender[i];
            const rowNum = i + 1;
            seenIds.add(item.id);

            const itemAgeTime = item.createdAt || parseTimestampFromId(item.id) || currentTime;
            const isOld = (currentTime - itemAgeTime) > twentyFourHoursMs;
            const needsRecall = (item.callMark === 'no-answer' || item.callMark === 'no-connect') &&
                item.callMarkTime && (currentTime - item.callMarkTime) >= FOUR_HOURS_MS;

            const signature = JSON.stringify(item) + '|' + rowNum + '|' + exchangeRateRiel + '|' + isOld + '|' + needsRecall;

            let tr = existingRows.get(item.id);
            if (!tr) {
                tr = document.createElement('tr');
                tr.dataset.id = item.id;
            }
            if (tr.dataset.sig !== signature) {
                const built = buildHistoryRowHtml(item, rowNum, isOld, needsRecall);
                tr.className = built.isClosedRow ? 'closed-row' : '';
                tr.innerHTML = built.html;
                tr.dataset.sig = signature;
            }

            if (prevNode === null) {
                if (tbody.firstChild !== tr) tbody.insertBefore(tr, tbody.firstChild);
            } else if (prevNode.nextSibling !== tr) {
                tbody.insertBefore(tr, prevNode.nextSibling);
            }
            prevNode = tr;
        }

        existingRows.forEach((tr, id) => {
            if (!seenIds.has(id)) tr.remove();
        });
    }

    const CLEAR_HISTORY_CLAIM_LEASE_MS = 2 * 60 * 1000;
    const activeClearHistoryClaims = new Map();
    let clearHistoryInFlight = false;

    function resetClearHistoryOperationState() {
        clearHistoryInFlight = false;
        pickupResetInFlight = false;
        activeRestoreClaims.clear();
        activeClearHistoryClaims.clear();
    }

    function isActiveClearHistoryClaim(claim) {
        const claimedAt = claim && parseFloat(claim.claimedAt);
        const now = getServerNow();
        return !!(claim && typeof claim.token === 'string' && claim.token && isFinite(claimedAt) && claimedAt <= now && (now - claimedAt) < CLEAR_HISTORY_CLAIM_LEASE_MS);
    }

    function generateClearHistoryClaimToken() {
        return 'clear_' + generateUniqueId() + '_' + Math.random().toString(36).slice(2);
    }

    function buildClearHistoryTrashItem(item, id) {
        const trashItem = cloneRestoreItem(item);
        if (!trashItem) return null;
        trashItem.id = id;
        stripHistoryOnlyMarkers(trashItem);
        trashItem.deletedAt = getServerNow();
        trashItem.isFromDeletion = true;
        trashItem.trashReason = 'delete';
        if (Array.isArray(trashItem.barcodes)) {
            trashItem.barcodes = trashItem.barcodes.map((barcode) => ({ ...barcode, isFromDeletion: true }));
        }
        return trashItem;
    }

    async function claimHistoryItemForClear(id, token) {
        let claimedItem = null;
        let status = 'CLEAR_HISTORY_MISSING';
        const itemRef = fb.ref(db, `zoew_scan_history_cod_dod/${id}`);
        const result = await dbOp(fb.runTransaction(itemRef, (currentItem) => {
            claimedItem = null;
            status = 'CLEAR_HISTORY_MISSING';
            if (!currentItem || typeof currentItem !== 'object') return;
            if (currentItem.restoreClaimId || currentItem.restoreClaimToken) {
                status = 'RESTORE_IN_PROGRESS';
                return;
            }
            const existingClaim = currentItem.clearClaim;
            if (existingClaim && existingClaim.token !== token && isActiveClearHistoryClaim(existingClaim)) {
                status = 'CLEAR_HISTORY_IN_PROGRESS';
                return;
            }
            claimedItem = cloneRestoreItem(currentItem);
            if (!claimedItem) return;
            delete claimedItem.clearClaim;
            currentItem.clearClaim = { token, claimedAt: getServerNow() };
            status = 'CLEAR_HISTORY_CLAIMED';
            return currentItem;
        }));
        if (!result || !result.committed || !claimedItem) throw new Error(status);
        return claimedItem;
    }

    async function clearClearHistoryFinalization(id, token) {
        await dbOp(fb.runTransaction(fb.ref(db, `zoew_clear_history_finalizations/${id}`), (currentFinalization) => {
            if (!currentFinalization || currentFinalization.token !== token) return;
            return null;
        }));
    }

    async function finalizeClaimedHistoryClear(id, token, trashItem) {
        const updates = {
            [`zoew_clear_history_finalizations/${id}`]: { token, finalizedAt: getServerNow() },
            [`zoew_recently_deleted_cod_dod/${id}`]: trashItem,
            [`zoew_scan_history_cod_dod/${id}`]: null
        };
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await dbOp(fb.update(fb.ref(db), updates));
                return;
            } catch (error) {
                lastError = error;
                let historySnapshot;
                let trashSnapshot;
                let finalizationSnapshot;
                try {
                    [historySnapshot, trashSnapshot, finalizationSnapshot] = await dbOp(Promise.all([
                        fb.get(fb.ref(db, `zoew_scan_history_cod_dod/${id}`)),
                        fb.get(fb.ref(db, `zoew_recently_deleted_cod_dod/${id}`)),
                        fb.get(fb.ref(db, `zoew_clear_history_finalizations/${id}`))
                    ]));
                } catch (readError) {
                    throw error;
                }
                const finalization = finalizationSnapshot.exists() ? finalizationSnapshot.val() : null;
                if (!historySnapshot.exists() && trashSnapshot.exists() && finalization && finalization.token === token) return;
                const currentHistory = historySnapshot.exists() ? historySnapshot.val() : null;
                if (!currentHistory || !currentHistory.clearClaim || currentHistory.clearClaim.token !== token) {
                    throw new Error('CLEAR_HISTORY_CLAIM_LOST');
                }
                if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
            }
        }
        throw lastError || new Error('CLEAR_HISTORY_FINAL_WRITE_FAILED');
    }

    function requestPinBeforeClearHistory() {
        requestPinBeforeConfig(clearHistory, 'clearHistory');
    }

    async function clearHistory() {
        if (clearHistoryInFlight) return;
        const filterLabel = getCurrentFilterLabel();
        const clearedIds = getFilteredDataByDate().map(item => item.id).filter(Boolean);
        if (clearedIds.length === 0) {
            showToast(`⚠️ គ្មានទិន្នន័យក្នុងតម្រង «${filterLabel}» ដើម្បីលុបទេ។`);
            return;
        }
        if (!confirm(`តើអ្នកពិតជាចង់លុបទិន្នន័យក្នុងតម្រង «${filterLabel}» ចំនួន ${clearedIds.length} ធាតុមែនទេ? (ទិន្នន័យថ្ងៃផ្សេងមិនប៉ះពាល់ទេ)`)) return;
        const safeIdPattern = /^[a-zA-Z0-9_-]+$/;
        if (!dbRefHistory || !dbRefDeleted || !db || !fb || clearedIds.some(id => !safeIdPattern.test(id))) {
            showToast("⚠️ មិនអាចលុបប្រវត្តិបានទេ! សូមពិនិត្យការតភ្ជាប់ Firebase ហើយសាកល្បងម្តងទៀត។");
            return;
        }

        clearHistoryInFlight = true;
        let clearedCount = 0;
        let blockedCount = 0;
        let failedCount = 0;
        let stalled = false;
        try {
            for (const id of clearedIds) {
                const previous = activeClearHistoryClaims.get(id);
                const token = previous || generateClearHistoryClaimToken();
                try {
                    const claimedItem = await claimHistoryItemForClear(id, token);
                    activeClearHistoryClaims.set(id, token);
                    const trashItem = buildClearHistoryTrashItem(claimedItem, id);
                    if (!trashItem) throw new Error('CLEAR_HISTORY_SOURCE_INVALID');
                    await finalizeClaimedHistoryClear(id, token, trashItem);
                    activeClearHistoryClaims.delete(id);
                    await clearClearHistoryFinalization(id, token).catch(() => {});
                    clearedCount++;
                } catch (error) {
                    const code = error && error.message;
                    if (code === 'CLEAR_HISTORY_MISSING' || code === 'CLEAR_HISTORY_IN_PROGRESS' || code === 'RESTORE_IN_PROGRESS' || code === 'CLEAR_HISTORY_CLAIM_LOST') {
                        blockedCount++;
                    } else {
                        failedCount++;
                        console.error('Error clearing history item:', id, error);
                        if (window.ZoeErrors) ZoeErrors.capture(error, { context: 'Error clearing history item', itemId: id });
                        if (dbOpStalled(error)) { stalled = true; break; }
                    }
                }
            }
            refreshCurrentHistoryView();
            updateRecentPhonesList();
            if (stalled) {
                showToast(clearedCount
                    ? `⚠️ បណ្តាញឆ្លើយមិនចេញ — លុបបានតែ ${clearedCount} ធាតុ។ សូមពិនិត្យអ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។`
                    : "⚠️ បណ្តាញឆ្លើយមិនចេញ — លុបមិនបានទេ។ ទិន្នន័យនៅរក្សាទុកដោយសុវត្ថិភាព។");
            } else if (clearedCount && !blockedCount && !failedCount) {
                showToast(`បានលុបទិន្នន័យក្នុងតម្រង «${filterLabel}» ចំនួន ${clearedCount} ធាតុ!`);
            } else if (clearedCount) {
                showToast(`⚠️ បានលុប ${clearedCount} ធាតុ។ ធាតុខ្លះកំពុងត្រូវបានកែពីឧបករណ៍ផ្សេង ឬអាចសាកល្បងម្ដងទៀតបាន។`);
            } else if (blockedCount) {
                showToast("⚠️ ធាតុខ្លះត្រូវបានកែ ឬស្តារពីឧបករណ៍ផ្សេង។ សូមរង់ចាំបន្តិច ហើយសាកល្បងម្ដងទៀត។");
            } else {
                showToast(`⚠️ លុបទិន្នន័យក្នុងតម្រង «${filterLabel}» មិនបានជោគជ័យ! ទិន្នន័យនៅរក្សាទុកដោយសុវត្ថិភាព ហើយអាចសាកល្បងម្តងទៀតបាន។`);
            }
        } finally {
            clearHistoryInFlight = false;
        }
    }
