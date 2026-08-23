    const APP_VERSION = '2.2.1';

    function renderAppVersionLabels() {
        document.querySelectorAll('[data-app-version]').forEach((el) => {
            el.textContent = 'កំណែប្រព័ន្ធ: ' + APP_VERSION;
        });
    }

    renderAppVersionLabels();

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => { window.scrollTo(0, 0); });
    }

    const activationSubmitBtnEl = document.getElementById('activationSubmitBtn');
    if (activationSubmitBtnEl) activationSubmitBtnEl.addEventListener('click', submitActivationKey);

    const bindClickBackup = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    };
    bindClickBackup('activationLogoutBtn', logoutApp);
    bindClickBackup('pinConfirmBtn', verifySecurityPin);
    bindClickBackup('pinSetupSaveBtn', saveNewSecurityPin);
    bindClickBackup('configSaveBtn', saveFirebaseConfig);
    bindClickBackup('editPhoneSaveBtn', saveEditedPhone);
    bindClickBackup('restoreConfirmBtn', executeRestoreItem);
    bindClickBackup('permanentDeleteConfirmBtn', executePermanentDelete);
    bindClickBackup('phoneModalCancelBtn', () => closeModal('phoneModal'));
    bindClickBackup('phoneModalCloseX', dismissPhoneModal);

    function showUpdateAvailableBanner() {
        if (document.getElementById('zoeUpdateBanner')) return;
        const banner = document.createElement('div');
        banner.id = 'zoeUpdateBanner';
        banner.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#1f2937;color:#fff;padding:10px 14px;display:flex;align-items:center;justify-content:center;gap:12px;font-size:13px;box-shadow:0 -2px 8px rgba(0,0,0,0.2);flex-wrap:wrap;';
        const label = document.createElement('span');
        label.textContent = '🔄 មានកំណែថ្មីរបស់កម្មវិធី — សូម Refresh នៅពេលងាយស្រួល';
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = 'Refresh ឥឡូវនេះ';
        refreshBtn.style.cssText = 'background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:13px;cursor:pointer;';
        refreshBtn.addEventListener('click', () => window.location.reload());
        const dismissBtn = document.createElement('button');
        dismissBtn.textContent = '✕';
        dismissBtn.setAttribute('aria-label', 'បិទ');
        dismissBtn.style.cssText = 'background:transparent;color:#fff;border:none;font-size:16px;cursor:pointer;padding:0 4px;';
        dismissBtn.addEventListener('click', () => banner.remove());
        banner.appendChild(label);
        banner.appendChild(refreshBtn);
        banner.appendChild(dismissBtn);
        document.body.appendChild(banner);
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then((reg) => {
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') reg.update().catch(() => {});
                });
                window.addEventListener('focus', () => reg.update().catch(() => {}));
                setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
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
    let isDatabaseConnected = false;

    let exchangeRateRiel = parseFloat(localStorage.getItem('zoew_exchange_rate')) || 4100;

    let codeReader = null;
    let liveScanCodeReader = null;
    let currentStream = null;
    let isCameraScanning = false;
    let isCameraStarting = false;
    let cameraRequestId = 0;
    let pendingLoadedMetadataHandler = null;
    let nativeLoopActive = false;
    let zxingLoopActive = false;
    let autoLoginAttempted = false;
    let currentVideoTrack = null;
    let torchOn = false;

    let scanHistory = [];
    let deletedItems = [];
    let isInitializingFirebase = false;
    let dailyRevenueData = {};
    let monthlyRevenueData = {};
    let dailyPickupData = {};
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

    let serverTimeOffsetMs = 0;
    function getServerNow() {
        return Date.now() + serverTimeOffsetMs;
    }

    let nativeDetector = null;
    let isModalOpen = false;
    let phoneModalDismissPromptOpen = false;
    let searchTimer = null;
    let isDatabaseInitialized = false;
    let globalAudioCtx = null;

    let lastEnteredLocker = localStorage.getItem('last_entered_locker') || "";

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

    function safeStoreSet(store, key, value) {
        try { store.setItem(key, String(value)); return true; } catch (e) { return false; }
    }

    function safeStoreRemove(store, key) {
        try { store.removeItem(key); return true; } catch (e) { return false; }
    }

    function openModalHelper(modalId) {
        isModalOpen = true;
        showAppChrome();
        hidePhoneSuggestions();
        document.body.style.overflow = 'hidden';
        const modalEl = document.getElementById(modalId);
        if(modalEl) modalEl.style.display = 'flex';
    }

    function closeModal(modalId) {
        const modalEl = document.getElementById(modalId);
        if(modalEl) modalEl.style.display = 'none';
        document.body.style.overflow = '';
        pendingBarcode = "";
        editingItemId = null;
        markingItemId = null;
        isModalOpen = Array.from(document.querySelectorAll('.modal')).some(m => m.style.display === 'flex');
        if (!isModalOpen) safeFocusScanner();
    }

    function dismissPhoneModal() {
        if (phoneModalDismissPromptOpen) return;
        const modalEl = document.getElementById('phoneModal');
        if (!modalEl || modalEl.style.display !== 'flex') return;
        phoneModalDismissPromptOpen = true;
        setTimeout(() => { phoneModalDismissPromptOpen = false; }, 0);
        if (!confirm("តើអ្នកពិតជាចង់បោះបង់កញ្ចប់នេះមែនទេ? ព័ត៌មានដែលបានវាយបញ្ចូល (លេខទូរស័ព្ទ, Locker, COD, DOD) នឹងបាត់ ហើយកញ្ចប់នេះនឹងមិនត្រូវបានរក្សាទុកទេ។")) return;
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

    function retryAsync(fn, attempts, delayMs) {
        return fn().catch((err) => {
            if (attempts <= 1) throw err;
            return new Promise((resolve) => setTimeout(resolve, delayMs)).then(() => retryAsync(fn, attempts - 1, delayMs * 2));
        });
    }

    async function initFirebase() {
        const savedConfig = localStorage.getItem('zoew_firebase_config');
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

            const existingApps = fb.getApps();
            if (existingApps.length) {
                if (dbRefHistory) { try { fb.off(dbRefHistory); } catch (e) {} }
                if (dbRefDeleted) { try { fb.off(dbRefDeleted); } catch (e) {} }
                if (dbRefDailyRevenue) { try { fb.off(dbRefDailyRevenue); } catch (e) {} }
                if (dbRefMonthlyRevenue) { try { fb.off(dbRefMonthlyRevenue); } catch (e) {} }
                if (dbRefDailyPickup) { try { fb.off(dbRefDailyPickup); } catch (e) {} }
                if (dbRefExchangeRate) { try { fb.off(dbRefExchangeRate); } catch (e) {} }
                if (dbRefConnected) { try { fb.off(dbRefConnected); } catch (e) {} }
                if (dbRefServerTimeOffset) { try { fb.off(dbRefServerTimeOffset); } catch (e) {} }
                isDatabaseInitialized = false;
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

            fb.onValue(dbRefConnected, (snap) => {
                const statusDot = document.getElementById('statusDot');
                const statusText = document.getElementById('firebaseStatusText');
                const online = snap.val() === true;
                if (statusDot) statusDot.classList.toggle('offline', !online);
                if (statusText) statusText.innerText = online ? "ភ្ជាប់ Server រួចរាល់" : "ក្រៅបណ្ដាញ";
                isDatabaseConnected = online;
            });

            dbRefServerTimeOffset = fb.ref(db, '.info/serverTimeOffset');
            fb.onValue(dbRefServerTimeOffset, (snap) => {
                const val = snap.val();
                if (typeof val === 'number') serverTimeOffsetMs = val;
                if (window.ZoeLicense) window.ZoeLicense.setServerTimeOffset(serverTimeOffsetMs);
            });

            setupAuthListener();
            return true;
        } catch (e) {
            console.error("Invalid Saved Config", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Invalid Saved Config" });
            checkPinAndOpenConfig(true);
            return false;
        } finally {
            isInitializingFirebase = false;
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
        clearHistory: {
            verify: 'សូមវាយលេខកូដសុវត្ថិភាពដើម្បីលុបទិន្នន័យទាំងអស់',
            setup: 'សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការលុបទិន្នន័យទាំងអស់ លើកក្រោយ'
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
        let savedPin = localStorage.getItem('zoew_security_pin_hash');
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
            localStorage.setItem('zoew_security_pin_hash', await hashPin(pinVal));
            lookupSecretKey = await deriveLookupSecretKey(pinVal);
        } catch (e) {
            alert("មិនអាចកំណត់ PIN បានទេ! សូមប្រើ HTTPS ហើយសាកល្បងម្តងទៀត។");
            return;
        } finally {
            if (newPinIn) newPinIn.value = '';
        }
        closeModal('pinSetupModal');
        clearBiometricRecord();
        refreshBiometricUi();
        showToast("បានកំណត់ Security PIN រួចរាល់!");
        (pinTargetAction || openConfigModal)(pinVal);
    }

    let isVerifyingPin = false;

    async function verifySecurityPin() {
        if (isVerifyingPin) return;

        const pinIn = document.getElementById('securityPinInput');
        let enteredPin = pinIn ? pinIn.value.trim() : '';
        if (pinIn) pinIn.value = '';
        let savedPin = localStorage.getItem('zoew_security_pin_hash');

        const lockoutUntil = parseInt(localStorage.getItem('zoew_pin_lockout_until') || '0');
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
                let failCount = (parseInt(localStorage.getItem('zoew_pin_fail_count') || '0') || 0) + 1;
                if (failCount >= 5) {
                    localStorage.setItem('zoew_pin_lockout_until', (Date.now() + 60000).toString());
                    localStorage.setItem('zoew_pin_fail_count', '0');
                    alert("បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ១ នាទី មុននឹងសាកល្បងម្តងទៀត។");
                } else {
                    localStorage.setItem('zoew_pin_fail_count', failCount.toString());
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
        const savedPin = localStorage.getItem('zoew_security_pin_hash');
        if (savedPin && !savedPin.startsWith('pbkdf2:')) {
            safeStoreSet(localStorage, 'zoew_security_pin_hash', await hashPin(pin));
        }
        safeStoreRemove(localStorage, 'zoew_pin_fail_count');
        safeStoreRemove(localStorage, 'zoew_pin_lockout_until');
        lookupSecretKey = await deriveLookupSecretKey(pin);
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
            const raw = localStorage.getItem(BIOMETRIC_STORAGE_KEY);
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
            localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(rec));
            return true;
        } catch (e) {
            return false;
        }
    }

    function clearBiometricRecord() {
        try {
            localStorage.removeItem(BIOMETRIC_STORAGE_KEY);
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

    function setBiometricBusy(busy) {
        const btn = document.getElementById('pinBiometricBtn');
        if (!btn) return;
        btn.disabled = !!busy;
        btn.textContent = busy ? 'កំពុងស្កេន...' : '👆 ស្កេនក្រយៅដៃ ឬមុខ';
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
        const lockoutUntil = parseInt(localStorage.getItem('zoew_pin_lockout_until') || '0');
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
            const savedPin = localStorage.getItem('zoew_security_pin_hash');
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

    function checkPinAndOpenConfig(isFirstTime = false) {
        if (isPinFlowPending()) return;
        pinTargetAction = null;
        applyPinPromptText('config');
        let savedPin = localStorage.getItem('zoew_security_pin_hash');
        if (!savedPin) {
            openModalHelper('pinSetupModal');
        } else {
            requestPinBeforeConfig(null, 'config');
        }
    }

    function openConfigModal() {
        const savedConfig = localStorage.getItem('zoew_firebase_config');
        if (savedConfig) {
            const cfgInput = document.getElementById('firebaseConfigInput');
            if(cfgInput) cfgInput.value = savedConfig;
        }
        const dsnInput = document.getElementById('sentryDsnInput');
        if (dsnInput && window.ZoeErrors) dsnInput.value = ZoeErrors.getDsn();
        openModalHelper('configModal');
    }

    async function saveFirebaseConfig() {
        const dsnInput = document.getElementById('sentryDsnInput');
        const dsnEntered = dsnInput ? dsnInput.value.trim() : '';
        if (dsnInput && window.ZoeErrors) {
            ZoeErrors.setDsn(dsnInput.value);
            const sentryOk = await ZoeErrors.init('zoew');
            if (dsnEntered && !sentryOk) {
                showToast("⚠️ មិនអាចភ្ជាប់ Sentry បានទេ! សូមពិនិត្យ DSN ឬការតភ្ជាប់អ៊ីនធឺណិត");
            }
        }
        const cfgInput = document.getElementById('firebaseConfigInput');
        if(!cfgInput) return;
        const raw = cfgInput.value.trim();
        if (!raw) {
            alert("សូមបញ្ចូល Firebase Config!");
            return;
        }
        try {
            let parsed = null;
            try {
                parsed = JSON.parse(raw);
            } catch (strictErr) {
                const cleanStr = raw
                    .replace(/([{,]\s*)(['"]?)([a-zA-Z0-9_]+)\2(\s*):/g, '$1"$3"$4:')
                    .replace(/'/g, '"')
                    .replace(/,(\s*[}\]])/g, '$1');
                parsed = JSON.parse(cleanStr);
            }

            if (!parsed.apiKey || !parsed.databaseURL) {
                throw new Error("Missing apiKey or databaseURL");
            }

            localStorage.setItem('zoew_firebase_config', JSON.stringify(parsed));
            showToast("ភ្ជាប់ Config រួចរាល់! កំពុង Re-initialize...");
            closeModal('configModal');
            initFirebase();
        } catch (e) {
            alert("ការកំណត់រចនាសម្ព័ន្ធមិនត្រឹមត្រូវទេ! សូមពិនិត្យ Config JSON រួចសាកល្បងម្ដងទៀត។");
        }
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
        pinTargetAction = null;
        closeModal('pinSetupModal');
    }

    function cancelPinEntryFlow() {
        pinTargetAction = null;
        closeModal('pinModal');
    }

    function isPinFlowPending() {
        const pinEl = document.getElementById('pinModal');
        const setupEl = document.getElementById('pinSetupModal');
        return !!((pinEl && pinEl.style.display === 'flex') || (setupEl && setupEl.style.display === 'flex'));
    }

    let configQrReader = null;
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
        if (configQrReader) {
            try { configQrReader.reset(); } catch (e) {}
            configQrReader = null;
        }
        closeModal('configQrScanModal');
    }

    async function openConfigQrScanner() {
        if (configQrScanActive) return;
        if (isCameraScanning || isCameraStarting) {
            showToast("សូមបិទកាមេរ៉ាស្កេនបាកូដសិន មុននឹងស្កេន QR Setup Link");
            return;
        }
        if (typeof ZXing === 'undefined') {
            showToast("❌ Camera Scanner មិនទាន់ផ្ទុករួចទេ! សូមរង់ចាំបន្តិចទៀត");
            return;
        }
        if (isInAppBrowser()) {
            showToast('⚠️ សូមបើកតាម Browser ធម្មតា (Chrome/Safari) ដើម្បីប្រើកាមេរ៉ា — ក្នុង App ដូចជា Facebook/Messenger កាមេរ៉ាអាចប្រើមិនបាន');
        }
        openModalHelper('configQrScanModal');
        configQrScanActive = true;
        try {
            configQrReader = new ZXing.BrowserQRCodeReader(500);
            await configQrReader.decodeFromVideoDevice(null, 'configQrVideo', (result) => {
                if (!configQrScanActive || !result) return;
                handleConfigQrResult(result.getText());
            });
        } catch (e) {
            console.error('Config QR scanner error:', e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'openConfigQrScanner' });
            showToast(describeCameraError(e));
            closeConfigQrScanner();
        }
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
            const raw = localStorage.getItem('zoew_lookup_api_config');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function openLookupApiConfigModal() {
        const cfg = getLookupApiConfig() || {};
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

        const enabledCb = document.getElementById('lookupApiEnabledCheckbox');
        if (enabledCb) enabledCb.checked = !!cfg.enabled;

        const autoSubmitCb = document.getElementById('lookupApiAutoSubmitCheckbox');
        if (autoSubmitCb) autoSubmitCb.checked = !!cfg.autoSubmit;

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
            url: url,
            headerName: headerNameIn ? headerNameIn.value.trim() : '',
            headerValueEnc: headerValueEnc,
            phoneField: (phoneFieldIn && phoneFieldIn.value.trim()) || 'phone',
            codField: (codFieldIn && codFieldIn.value.trim()) || 'cod',
            dodField: (dodFieldIn && dodFieldIn.value.trim()) || 'dod'
        };
        if (legacyHeaderValue) cfg.headerValue = legacyHeaderValue;

        if (!safeStoreSet(localStorage, 'zoew_lookup_api_config', JSON.stringify(cfg))) {
            alert("មិនអាចរក្សាទុក Config បានទេ! ទំហំផ្ទុករបស់ browser ពេញ ឬត្រូវបានបិទ (ឧ. Private Mode)។");
            return;
        }
        if (headerValueIn) headerValueIn.value = '';
        closeModal('lookupApiConfigModal');
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

        showToast("កំពុងសាកល្បង API...");
        if (btnEl) btnEl.disabled = true;
        try {
            const res = await withTimeout(fetch(testUrl, { headers }), 20000, 'Test API timed out');
            const text = await res.text();
            alert("ស្ថានភាព HTTP៖ " + res.status + "\n\nលទ្ធផល JSON (ប្រើដើម្បីដឹងឈ្មោះ Field)៖\n" + text.substring(0, 1500));
        } catch (e) {
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'testLookupApiConfig' });
            alert("❌ បរាជ័យក្នុងការភ្ជាប់៖ " + (e && e.message === 'Test API timed out' ? "អស់ពេល (Timeout) — Google Apps Script ដំបូងអាចយឺត (cold start), សូមសាកល្បងម្តងទៀត ឬពិនិត្យ URL/ការតភ្ជាប់អ៊ីនធឺណិត" : e.message));
        } finally {
            if (btnEl) btnEl.disabled = false;
        }
    }

    let customerDataTableRows = null;
    let customerDataTableFetchedAt = 0;
    let customerDataTableFetchPromise = null;
    let customerDataTableSessionGeneration = 0;
    let customerDataTableLastFailedAt = 0;
    const CUSTOMER_TABLE_CACHE_MS = 15 * 60 * 1000;
    const CUSTOMER_TABLE_FAIL_COOLDOWN_MS = 60 * 1000;

    function buildCustomerListApiUrl(cfg) {
        if (!cfg || !cfg.url) return null;
        let url = cfg.url.trim();
        if (/[?&][^=&]*=\{barcode\}/.test(url)) {
            url = url.replace(/([?&])[^=&]*=\{barcode\}/, '$1list=1');
        } else if (/[?&]code=/.test(url)) {
            url = url.replace(/([?&])code=[^&]*/, '$1list=1');
        } else {
            url = url.replace('{barcode}', '');
            url += (url.indexOf('?') !== -1 ? '&' : '?') + 'list=1';
        }
        return url;
    }

    function openCustomerDataTableModal() {
        const cfg = getLookupApiConfig();
        if (!cfg || !cfg.url) {
            alert("សូមកំណត់ Config API ស្វែងរកអតិថិជនជាមុនសិន (⋯ ➜ 🔌 API ស្វែងរកអតិថិជន) មុននឹងបើកតារាងនេះ។");
            return;
        }
        const searchInput = document.getElementById('customerDataTableSearchInput');
        if (searchInput) searchInput.value = '';
        openModalHelper('customerDataTableModal');
        fetchCustomerDataTableRows(false);
    }

    async function fetchCustomerDataTableRows(force) {
        const cfg = getLookupApiConfig();
        const statusEl = document.getElementById('customerDataTableStatus');
        if (!cfg || !cfg.url) return;

        const isFresh = customerDataTableRows && (Date.now() - customerDataTableFetchedAt < CUSTOMER_TABLE_CACHE_MS);
        if (!force && isFresh) {
            renderCustomerDataTableStatus(customerDataTableRows);
            filterCustomerDataTable();
            return;
        }

        if (customerDataTableFetchPromise) {
            if (statusEl) statusEl.textContent = "កំពុងទាញយកទិន្នន័យ...";
            return customerDataTableFetchPromise;
        }

        if (!force && customerDataTableLastFailedAt && (Date.now() - customerDataTableLastFailedAt < CUSTOMER_TABLE_FAIL_COOLDOWN_MS)) {
            return;
        }

        const listUrl = buildCustomerListApiUrl(cfg);
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
                const res = await retryAsync(
                    () => withTimeout(fetch(listUrl, { headers }), 20000, 'Customer table fetch timed out'),
                    2, 2000
                );
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                if (data && data.error) throw new Error(data.error);
                if (myGeneration !== customerDataTableSessionGeneration) return;
                const rows = Array.isArray(data && data.rows) ? data.rows : [];
                customerDataTableRows = rows;
                customerDataTableFetchedAt = Date.now();
                customerDataTableLastFailedAt = 0;
                renderCustomerDataTableStatus(rows);
                filterCustomerDataTable();
            } catch (e) {
                if (myGeneration !== customerDataTableSessionGeneration) return;
                customerDataTableLastFailedAt = Date.now();
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
        const ts = customerDataTableFetchedAt ? new Date(customerDataTableFetchedAt).toLocaleTimeString('km-KH') : '';
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
        customerDataTableSessionGeneration++;
        customerDataTableRows = null;
        customerDataTableFetchedAt = 0;
        customerDataTableFetchPromise = null;
        customerDataTableLastFailedAt = 0;
        autoLookupLastFailedAt = 0;
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

    function prefetchCustomerDataTableRowsIfConfigured() {
        if (!auth || !auth.currentUser) return;
        const cfg = getLookupApiConfig();
        if (cfg && cfg.url) {
            fetchCustomerDataTableRows(false);
        }
    }

    function getNestedField(obj, path) {
        if (!obj || !path) return null;
        return path.split('.').reduce((acc, key) => (acc !== null && acc !== undefined && acc[key] !== undefined) ? acc[key] : null, obj);
    }

    let lookupLockedNoticeShown = false;
    let autoLookupLastFailedAt = 0;
    const AUTO_LOOKUP_FAIL_COOLDOWN_MS = 30 * 1000;

    function applyLookupFillToModal(barcode, phoneVal, codVal, dodVal, cfg) {
        if (pendingBarcode !== barcode || !isModalOpen) return;

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
    }

    async function attemptAutoLookup(barcode) {
        const cfg = getLookupApiConfig();
        if (!cfg || !cfg.enabled || !cfg.url) return;

        const cachedRow = findCustomerDataTableRow(barcode);
        if (cachedRow) {
            applyLookupFillToModal(barcode, cachedRow.phone, cachedRow.cod, cachedRow.dod, cfg);
            return;
        }

        if (cfg.headerName && cfg.headerValueEnc && !lookupSecretKey) {
            if (!lookupLockedNoticeShown) {
                lookupLockedNoticeShown = true;
                showToast("🔒 ស្វែងរកអតិថិជនស្វ័យប្រវត្តិត្រូវការ Config PIN — សូមបើក ⚙️ Config ១ដងដើម្បីដោះសោសម្រាប់វគ្គនេះ");
            }
            return;
        }

        if (autoLookupLastFailedAt && (Date.now() - autoLookupLastFailedAt < AUTO_LOOKUP_FAIL_COOLDOWN_MS)) {
            return;
        }

        const myGeneration = customerDataTableSessionGeneration;
        try {
            const targetUrl = cfg.url.replace('{barcode}', encodeURIComponent(barcode));
            const headers = {};
            if (cfg.headerName && cfg.headerValueEnc) {
                const decrypted = await decryptLookupSecret(cfg.headerValueEnc);
                if (decrypted) headers[cfg.headerName] = decrypted;
            } else if (cfg.headerName && cfg.headerValue) {
                headers[cfg.headerName] = cfg.headerValue;
            }

            const res = await retryAsync(
                () => withTimeout(fetch(targetUrl, { headers }), 15000, 'Auto lookup timed out'),
                2, 1500
            );
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (myGeneration !== customerDataTableSessionGeneration) return;

            const phoneVal = getNestedField(data, cfg.phoneField);
            const codVal = getNestedField(data, cfg.codField);
            const dodVal = getNestedField(data, cfg.dodField);
            autoLookupLastFailedAt = 0;
            applyLookupFillToModal(barcode, phoneVal, codVal, dodVal, cfg);
        } catch (e) {
            if (myGeneration !== customerDataTableSessionGeneration) return;
            autoLookupLastFailedAt = Date.now();
            console.error("Lookup API error:", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Lookup API error:" });
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
        safeStoreSet(localStorage, 'zoew_exchange_rate', val);

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
    const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

    function clearRememberedSession(keepEmail) {
        safeStoreRemove(localStorage, 'zoew_login_time');
        if (!keepEmail) safeStoreRemove(localStorage, 'remembered_email');
    }

    async function isFirebaseSessionExpired(user) {
        try {
            const tokenResult = await fb.getIdTokenResult(user);
            const authTimeMs = new Date(tokenResult.authTime).getTime();
            if (isNaN(authTimeMs)) return false;
            return (getServerNow() - authTimeMs) > FOUR_HOURS_MS;
        } catch (e) {
            return false;
        }
    }

    function forceExpireSession() {
        fb.signOut(auth).then(() => {
            clearRememberedSession(true);
            showLoginModalWithPrefill();
            showToast("ផុតកំណត់ ៤ ម៉ោងហើយ! សូមវាយពាក្យសម្ងាត់ និងចុចចូលប្រព័ន្ធម្ដងទៀត។");
        }).catch(() => {
            clearRememberedSession(true);
            showLoginModalWithPrefill();
            showToast("ផុតកំណត់ ៤ ម៉ោងហើយ! សូមវាយពាក្យសម្ងាត់ និងចុចចូលប្រព័ន្ធម្ដងទៀត។");
        });
    }

    function clearSensitiveModalFields() {
        hidePhoneSuggestions();
        setPhoneSearchPulledUp(false);
        restoreAfterPdfExport();
        if (!isPinFlowPending()) pinTargetAction = null;
        pendingRestoreId = null;
        pendingPermanentDeleteId = null;
        activeParentItemId = null;
        lookupSecretKey = null;
        pendingLockerCode = null;
        lockerBarcodeIndex = {};
        recentPhonesSignature = null;
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
            'deletedTableBody', 'dailyStatsContainer', 'monthlyStatsContainer',
            'menuContentContainer', 'lockerListTableBody', 'lockerListSearchInput',
            'locationWarningText', 'customLockerInput',
            'entryListTableBody', 'entryListSearchInput', 'entryListCount'
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
        closeConfigQrScanner();
        document.querySelectorAll('.modal').forEach((m) => {
            if (m.id !== 'loginModal') closeModal(m.id);
        });
        openModalHelper('loginModal');
        const savedEmail = localStorage.getItem('remembered_email');
        const emailInput = document.getElementById('loginEmailInput');
        const rememberCb = document.getElementById('rememberMeCheckbox');
        if (savedEmail && emailInput) {
            emailInput.value = savedEmail;
            if (rememberCb) rememberCb.checked = true;
        }
    }

    const LICENSE_APP_CODE = 'ADM';
    const LICENSE_RECHECK_INTERVAL_MS = 15 * 60 * 1000;

    function licenseFailureMessage(reason) {
        switch (reason) {
            case 'app-mismatch': return 'Key នេះមិនមែនសម្រាប់ ZoeW ទេ!';
            case 'expired':
            case 'expired-server': return 'Key នេះបានផុតកំណត់ហើយ!';
            case 'revoked': return 'Key នេះត្រូវបានដកហូតសិទ្ធិ (Revoked)!';
            case 'not-found': return 'Key នេះមិនមានក្នុងប្រព័ន្ធទេ!';
            case 'signature': return 'Key មិនត្រឹមត្រូវទេ (Signature Invalid)!';
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

    async function submitActivationKey() {
        const btn = document.getElementById('activationSubmitBtn');
        if (btn && btn.disabled) return;
        const originalBtnText = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'កំពុងផ្ទៀងផ្ទាត់...'; }
        try {
            const input = document.getElementById('activationKeyInput');
            const keyStr = input ? input.value.trim() : '';
            if (!keyStr) { showToast('សូមបញ្ចូល Activation Key!'); return; }
            const result = await withTimeout(ZoeLicense.activate(keyStr, LICENSE_APP_CODE), 20000, 'Activation timed out');
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
                if (!isDatabaseInitialized) {
                    initDatabaseListeners();
                    isDatabaseInitialized = true;
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
        if (!wasAlreadySignedIn) showToast("ចូលប្រព័ន្ធជោគជ័យ!");
        updateAuthButton(true);

        if (!isDatabaseInitialized) {
            initDatabaseListeners();
            isDatabaseInitialized = true;
        }
        prefetchCustomerDataTableRowsIfConfigured();
        safeFocusScanner();

        isFirebaseSessionExpired(user).then((expired) => {
            if (expired) forceExpireSession();
        });
    }

    const AUTH_STUCK_RECOVERY_FLAG = 'zoe_auth_recovery_attempted';

    async function attemptAuthStorageRecovery() {
        if (sessionStorage.getItem(AUTH_STUCK_RECOVERY_FLAG)) {
            showLoginModalWithPrefill();
            return;
        }
        safeStoreSet(sessionStorage, AUTH_STUCK_RECOVERY_FLAG, '1');
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
                if (isDatabaseInitialized) {
                    if (dbRefDailyRevenue) fb.off(dbRefDailyRevenue);
                    if (dbRefMonthlyRevenue) fb.off(dbRefMonthlyRevenue);
                    if (dbRefDailyPickup) fb.off(dbRefDailyPickup);
                    if (dbRefHistory) fb.off(dbRefHistory);
                    if (dbRefDeleted) fb.off(dbRefDeleted);
                    if (dbRefExchangeRate) fb.off(dbRefExchangeRate);
                    isDatabaseInitialized = false;
                }
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
                    safeStoreSet(localStorage, 'remembered_email', email);
                } else {
                    safeStoreRemove(localStorage, 'remembered_email');
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
                showToast("បានចាកចេញពីប្រព័ន្ធ!");
            });
        }
    }

    function handleDbListenerError(err) {
        console.error('Firebase listener error:', err);
        if (window.ZoeErrors) ZoeErrors.capture(err, { context: 'Firebase listener error' });
        showToast('⚠️ បរាជ័យក្នុងការទាញយកទិន្នន័យ! សូមពិនិត្យការតភ្ជាប់ Firebase ឬសិទ្ធិចូលប្រើ ហើយ Refresh ទំព័រ');
    }

    function initDatabaseListeners() {
        if (!db) return;

        if (isDatabaseInitialized) {
            if (dbRefDailyRevenue) fb.off(dbRefDailyRevenue);
            if (dbRefMonthlyRevenue) fb.off(dbRefMonthlyRevenue);
            if (dbRefDailyPickup) fb.off(dbRefDailyPickup);
            if (dbRefHistory) fb.off(dbRefHistory);
            if (dbRefDeleted) fb.off(dbRefDeleted);
            if (dbRefExchangeRate) fb.off(dbRefExchangeRate);
        }

        if (dbRefExchangeRate) {
            fb.onValue(dbRefExchangeRate, (snapshot) => {
                const val = snapshot.val();
                if (val && !isNaN(val)) {
                    exchangeRateRiel = parseFloat(val);
                    try { localStorage.setItem('zoew_exchange_rate', exchangeRateRiel); } catch (e) {}
                    debouncedRenderAfterHistorySync();
                }
            }, handleDbListenerError);
        }

        if (dbRefDailyRevenue) {
            fb.onValue(dbRefDailyRevenue, (snapshot) => {
                dailyRevenueData = snapshot.val() || {};
                debouncedRenderAfterHistorySync();
            }, handleDbListenerError);
        }

        if (dbRefMonthlyRevenue) {
            fb.onValue(dbRefMonthlyRevenue, (snapshot) => {
                monthlyRevenueData = snapshot.val() || {};
            }, handleDbListenerError);
        }

        if (dbRefDailyPickup) {
            fb.onValue(dbRefDailyPickup, (snapshot) => {
                dailyPickupData = snapshot.val() || {};
                debouncedRenderAfterHistorySync();
            }, handleDbListenerError);
        }

        if (dbRefHistory) {
        fb.onValue(dbRefHistory, (snapshot) => {
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
        }, handleDbListenerError);
        }

        if (dbRefDeleted) {
        fb.onValue(dbRefDeleted, (snapshot) => {
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
        }, handleDbListenerError);
        }

        isDatabaseInitialized = true;
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
    let deletedCleanupInFlight = false;

    function runAutomaticCleanupRules() {
        const currentTime = getServerNow();

        scanHistory.forEach(item => {
            if (!item.id) return;
            if (item.clearClaim) return;
            let itemTimestamp = item.createdAt || parseTimestampFromId(item.id) || currentTime;

            if (!item.isClosed && (currentTime - itemTimestamp > EIGHT_DAYS_MS)) {
                claimAndCleanupItem(item.id, 'abandon');
                return;
            }

            if (item.isClosed && item.closedAt && (currentTime - item.closedAt > TWO_HOURS_MS)) {
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
        try {
            const itemRef = fb.ref(db, `zoew_scan_history_cod_dod/${id}`);
            const result = await fb.runTransaction(itemRef, (currentItem) => {
                claimedWhole = null;
                claimedPartial = null;
                updatedRemainder = null;
                if (!currentItem) return currentItem;
                if (currentItem.clearClaim) return currentItem;
                normalizeBarcodesOf(currentItem);
                const ts = currentItem.createdAt || parseTimestampFromId(id) || getServerNow();

                if (reason === 'abandon') {
                    if (currentItem.isClosed || (getServerNow() - ts) <= EIGHT_DAYS_MS) return currentItem;

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
                    if (!currentItem.isClosed || !currentItem.closedAt || (getServerNow() - currentItem.closedAt) <= TWO_HOURS_MS) return currentItem;
                    claimedWhole = currentItem;
                    return null;
                }
            });

            if (!result.committed || (!claimedWhole && !claimedPartial)) return;

            let trashItem;
            let revenueDeducted = false;
            let revenueScanDate = null;
            let revenueCod = 0, revenueDod = 0, revenueCount = 0;
            if (claimedPartial) {
                trashItem = { ...claimedPartial, id: generateUniqueId() };
                trashItem.barcodes = trashItem.barcodes.map(b => ({ ...b, isDeducted: true, isFromDeletion: false }));
                trashItem.count = trashItem.barcodes.length;
                trashItem.cod = Math.round(trashItem.barcodes.reduce((s, b) => s + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                trashItem.dod = Math.round(trashItem.barcodes.reduce((s, b) => s + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                trashItem.price = Math.round((trashItem.cod + trashItem.dod) * 100) / 100;
                trashItem.barcode = trashItem.barcodes[0].code;
                trashItem.isClosed = false;
                delete trashItem.closedAt;
                trashItem.deletedAt = getServerNow();
                trashItem.isFromDeletion = false;
                revenueScanDate = trashItem.scanDate || getFormattedDate();
                revenueCod = trashItem.cod;
                revenueDod = trashItem.dod;
                revenueCount = trashItem.count;
                addRevenueToDailyAndMonthlyRecord(revenueScanDate, -revenueCod, -revenueDod, -revenueCount);
                revenueDeducted = true;
            } else {
                trashItem = { ...claimedWhole, id };
                trashItem.deletedAt = getServerNow();

                if (reason === 'abandon') {
                    trashItem.isFromDeletion = false;
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
                    if (trashItem.barcodes && Array.isArray(trashItem.barcodes)) {
                        trashItem.barcodes = trashItem.barcodes.map(b => ({ ...b, isFromDeletion: true }));
                    }
                }
            }

            deletedItems.unshift(trashItem);
            await retryAsync(() => saveSingleDeletedItemToFirebase(trashItem), 4, 1500).catch(async (trashErr) => {
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
        } catch (e) {
            console.error('Automatic cleanup transaction failed for', id, e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'Automatic cleanup transaction failed for' });
        } finally {
            cleanupInFlight.delete(id);
        }
    }

    async function runAutomaticDeletedCleanup() {
        if (deletedCleanupInFlight) return;
        const currentTime = getServerNow();
        let tenDaysMs = 10 * 24 * 60 * 60 * 1000;
        let purgedBarcodes = [];
        let purgedIds = [];

        deletedItems.forEach(item => {
            if (!item || item.restoreClaim) return;
            let deletedTime = item.deletedAt || currentTime;
            const expired = (currentTime - deletedTime > tenDaysMs);
            if (expired) {
                purgedBarcodes = purgedBarcodes.concat(collectItemBarcodes(item));
                if (item.id) purgedIds.push(item.id);
            }
        });

        if (purgedIds.length > 0) {
            deletedCleanupInFlight = true;
            try {
                await deleteMultipleDeletedItemsFromFirebase(purgedIds);
                const purgedSet = new Set(purgedIds);
                deletedItems = deletedItems.filter(item => !purgedSet.has(item.id));
                await releaseBarcodesInRegistry(purgedBarcodes);
            } catch (e) {
            } finally {
                deletedCleanupInFlight = false;
            }
        }
    }

    function runScheduledCleanup() {
        if (!db || !isDatabaseInitialized) return;
        runAutomaticCleanupRules();
        runAutomaticDeletedCleanup();
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

    function sanitizeInput(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeForInlineJsAttr(str) {
        if (str === undefined || str === null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029');
    }

    function showToast(msg) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        while (container.children.length >= 4) container.removeChild(container.firstChild);
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function getFormattedDate(d = new Date(getServerNow())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    function isIOSDevice() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function safeFocusScanner() {
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

        setInterval(async () => {
            if (auth && auth.currentUser) {
                if (await isFirebaseSessionExpired(auth.currentUser)) {
                    forceExpireSession();
                }
            }
        }, 60000);

        setInterval(() => {
            if (auth && auth.currentUser && isDatabaseInitialized && !isModalOpen) {
                ensureAppActivated().catch((e) => { if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'periodic ensureAppActivated' }); });
            }
        }, LICENSE_RECHECK_INTERVAL_MS);

        setInterval(sweepRecallHighlights, 60000);
        setInterval(runScheduledCleanup, 60000);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            sweepRecallHighlights();
            runScheduledCleanup();
        });

        (function waitForZXingThenInitScanEngine(deadline) {
            deadline = deadline || (Date.now() + 15000);
            if (typeof ZXing !== 'undefined') { initScanEngine(); return; }
            if (Date.now() >= deadline) {
                showToast('⚠️ មិនអាចផ្ទុកម៉ាស៊ីនស្កេន Barcode បានទេ! កាមេរ៉ាអាចនឹងប្រើការមិនកើត សូម Refresh ទំព័រ ឬប្រើម៉ាស៊ីនស្កេន/វាយបញ្ចូលដោយដៃ');
                return;
            }
            setTimeout(() => waitForZXingThenInitScanEngine(deadline), 300);
        })();

        if ('BarcodeDetector' in window) {
            try {
                nativeDetector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'] });
            } catch (e) {
                nativeDetector = null;
            }
        }

        setupHardwareScanner();
        switchAppPage('data');
        initBiometricUi();
        setupSwipeGestures();
        setupChromeAutoHide();
        setupIOSPullToRefresh();
        setupVisibilityHandling();
        updateRecentPhonesList();
        setupPhoneSuggestions();

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

    function closeGlobalMoreMenu() {
        const globalMenu = document.getElementById('globalMoreMenu');
        if (globalMenu) globalMenu.classList.remove('show');
    }

    function addRevenueToDailyAndMonthlyRecord(scanDateStr, codToAdd, dodToAdd, countToAdd) {
        if (!scanDateStr) scanDateStr = getFormattedDate();

        if (!dailyRevenueData[scanDateStr]) {
            dailyRevenueData[scanDateStr] = { codDollar: 0, dodDollar: 0, totalCount: 0 };
        }

        dailyRevenueData[scanDateStr].codDollar = Math.round(((parseFloat(dailyRevenueData[scanDateStr].codDollar) || 0) + (parseFloat(codToAdd) || 0)) * 100) / 100;
        dailyRevenueData[scanDateStr].dodDollar = Math.round(((parseFloat(dailyRevenueData[scanDateStr].dodDollar) || 0) + (parseFloat(dodToAdd) || 0)) * 100) / 100;
        dailyRevenueData[scanDateStr].totalCount = (parseFloat(dailyRevenueData[scanDateStr].totalCount) || 0) + (parseFloat(countToAdd) || 0);

        if (dailyRevenueData[scanDateStr].codDollar < 0) dailyRevenueData[scanDateStr].codDollar = 0;
        if (dailyRevenueData[scanDateStr].dodDollar < 0) dailyRevenueData[scanDateStr].dodDollar = 0;
        if (dailyRevenueData[scanDateStr].totalCount < 0) dailyRevenueData[scanDateStr].totalCount = 0;

        commitDailyRevenueDelta(scanDateStr, codToAdd, dodToAdd, countToAdd);

        let ymKey = scanDateStr.substring(0, 7);
        if (!monthlyRevenueData[ymKey]) {
            monthlyRevenueData[ymKey] = { codDollar: 0, dodDollar: 0, totalCount: 0 };
        }

        monthlyRevenueData[ymKey].codDollar = Math.round(((parseFloat(monthlyRevenueData[ymKey].codDollar) || 0) + (parseFloat(codToAdd) || 0)) * 100) / 100;
        monthlyRevenueData[ymKey].dodDollar = Math.round(((parseFloat(monthlyRevenueData[ymKey].dodDollar) || 0) + (parseFloat(dodToAdd) || 0)) * 100) / 100;
        monthlyRevenueData[ymKey].totalCount = (parseFloat(monthlyRevenueData[ymKey].totalCount) || 0) + (parseFloat(countToAdd) || 0);

        if (monthlyRevenueData[ymKey].codDollar < 0) monthlyRevenueData[ymKey].codDollar = 0;
        if (monthlyRevenueData[ymKey].dodDollar < 0) monthlyRevenueData[ymKey].dodDollar = 0;
        if (monthlyRevenueData[ymKey].totalCount < 0) monthlyRevenueData[ymKey].totalCount = 0;

        commitMonthlyRevenueDelta(ymKey, codToAdd, dodToAdd, countToAdd);
    }

    function commitDailyRevenueDelta(scanDateStr, codToAdd, dodToAdd, countToAdd) {
        if (!dbRefDailyRevenue) return;
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
                recordRef.codDollar = Math.round(((parseFloat(recordRef.codDollar) || 0) - (parseFloat(codToAdd) || 0)) * 100) / 100;
                recordRef.dodDollar = Math.round(((parseFloat(recordRef.dodDollar) || 0) - (parseFloat(dodToAdd) || 0)) * 100) / 100;
                recordRef.totalCount = (parseFloat(recordRef.totalCount) || 0) - (parseFloat(countToAdd) || 0);
                if (recordRef.codDollar < 0) recordRef.codDollar = 0;
                if (recordRef.dodDollar < 0) recordRef.dodDollar = 0;
                if (recordRef.totalCount < 0) recordRef.totalCount = 0;
                refreshCurrentHistoryView();
            }
            showToast("⚠️ បរាជ័យក្នុងការ Save Daily Revenue!");
        });
    }

    function commitMonthlyRevenueDelta(ymKey, codToAdd, dodToAdd, countToAdd) {
        if (!dbRefMonthlyRevenue) return;
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
                recordRef.codDollar = Math.round(((parseFloat(recordRef.codDollar) || 0) - (parseFloat(codToAdd) || 0)) * 100) / 100;
                recordRef.dodDollar = Math.round(((parseFloat(recordRef.dodDollar) || 0) - (parseFloat(dodToAdd) || 0)) * 100) / 100;
                recordRef.totalCount = (parseFloat(recordRef.totalCount) || 0) - (parseFloat(countToAdd) || 0);
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

    function countPickedUpCustomers(record) {
        return record && record.pickedUpPhones ? Object.keys(record.pickedUpPhones).length : 0;
    }

    function addPickupToDailyRecord(scanDateStr, phoneKey, customerRefDelta, packagesToAdd) {
        if (!scanDateStr) scanDateStr = getFormattedDate();

        if (!dailyPickupData[scanDateStr]) {
            dailyPickupData[scanDateStr] = { packagesPickedUp: 0, pickedUpPhones: {} };
        }
        const record = dailyPickupData[scanDateStr];
        if (!record.pickedUpPhones) record.pickedUpPhones = {};

        record.packagesPickedUp = (parseFloat(record.packagesPickedUp) || 0) + (parseFloat(packagesToAdd) || 0);
        if (record.packagesPickedUp < 0) record.packagesPickedUp = 0;

        if (phoneKey && customerRefDelta) {
            const refCount = (parseFloat(record.pickedUpPhones[phoneKey]) || 0) + customerRefDelta;
            if (refCount <= 0) delete record.pickedUpPhones[phoneKey];
            else record.pickedUpPhones[phoneKey] = refCount;
        }

        commitDailyPickupDelta(scanDateStr, phoneKey, customerRefDelta, packagesToAdd);
    }

    function commitDailyPickupDelta(scanDateStr, phoneKey, customerRefDelta, packagesToAdd) {
        if (!dbRefDailyPickup) return;
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
                recordRef.packagesPickedUp = (parseFloat(recordRef.packagesPickedUp) || 0) - (parseFloat(packagesToAdd) || 0);
                if (recordRef.packagesPickedUp < 0) recordRef.packagesPickedUp = 0;
                if (phoneKey && customerRefDelta) {
                    if (!recordRef.pickedUpPhones) recordRef.pickedUpPhones = {};
                    const refCount = (parseFloat(recordRef.pickedUpPhones[phoneKey]) || 0) - customerRefDelta;
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
                    <div style="font-size: 10px; color: var(--text-muted); text-align: right; margin-top: 3px;">
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
                    <div style="font-size: 10px; color: var(--text-muted); text-align: right; margin-top: 3px;">
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
        const pages = document.getElementById('appPages');
        if (pages) pages.scrollTop = 0;

        if (target === 'entry') {
            setEntryScanMode(entryScanMode);
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

    function syncHistoryExpandedLock() {
        const sidebar = document.getElementById('dataSideSection');
        const pages = document.getElementById('appPages');
        if (!sidebar || !pages) return;
        pages.classList.toggle('history-expanded', sidebar.classList.contains('collapsed'));
    }

    function setupSwipeGestures() {
        const sidebar = document.getElementById('dataSideSection');
        const mainSection = document.getElementById('dataMainSection');
        const tableResponsive = document.getElementById('tableResponsive');
        if (!sidebar || !mainSection || !tableResponsive) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        function phoneSearchIsActive() {
            const box = document.getElementById('phoneSuggestBox');
            if (box && box.classList.contains('show')) return true;
            const input = document.getElementById('searchPhoneInput');
            return !!(input && document.activeElement === input && input.value.trim());
        }

        tableResponsive.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        tableResponsive.addEventListener('touchmove', (e) => {
            currentY = e.touches[0].clientY;
            const diffY = currentY - startY;
            const scrollTop = tableResponsive.scrollTop;

            if (scrollTop === 0 && diffY > 30 && window.innerWidth < 992) {
                if (sidebar.classList.contains('collapsed')) {
                    sidebar.classList.remove('collapsed');
                    syncHistoryExpandedLock();
                }
            }
        }, { passive: true });

        mainSection.addEventListener('touchstart', (e) => {
            if (window.innerWidth >= 992) return;
            startY = e.touches[0].clientY;
            isDragging = true;
        }, { passive: true });

        mainSection.addEventListener('touchmove', (e) => {
            if (!isDragging || window.innerWidth >= 992) return;
            currentY = e.touches[0].clientY;
            const diffY = currentY - startY;
            const scrollTop = tableResponsive.scrollTop;

            if (diffY < -30 && !sidebar.classList.contains('collapsed') && !phoneSearchIsActive()) {
                sidebar.classList.add('collapsed');
                syncHistoryExpandedLock();
                isDragging = false;
            }
            else if (diffY > 30 && scrollTop <= 0 && sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                syncHistoryExpandedLock();
                isDragging = false;
            }
            else if (diffY > 30 && scrollTop <= 0 && sidebar.classList.contains('search-focus')) {
                setPhoneSearchPulledUp(false);
                isDragging = false;
            }
        }, { passive: true });

        mainSection.addEventListener('touchend', () => {
            isDragging = false;
        });

        const dragHandle = document.getElementById('dragHandle');
        if (dragHandle) {
            dragHandle.addEventListener('click', () => {
                if (!sidebar.classList.contains('collapsed')) hidePhoneSuggestions();
                setPhoneSearchPulledUp(false);
                sidebar.classList.toggle('collapsed');
                syncHistoryExpandedLock();
            });
        }

        syncHistoryExpandedLock();
    }

    let chromeHidden = false;

    function appChromeElements() {
        return {
            navbar: document.querySelector('.app-navbar'),
            tabbar: document.getElementById('pageTabBar')
        };
    }

    function measureChromeTop() {
        const { navbar } = appChromeElements();
        if (!navbar) return;
        const height = navbar.offsetHeight;
        if (height > 0) document.documentElement.style.setProperty('--chrome-top', height + 'px');
    }

    function showAppChrome() {
        if (!chromeHidden) return;
        chromeHidden = false;
        document.body.classList.remove('chrome-hidden');
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
        const HIDE_AFTER = 30;
        const SHOW_AFTER = 16;
        const BOTTOM_ZONE = 24;

        let activeScroller = null;
        let lastScrollTop = 0;
        let travel = 0;

        const onScroll = (event) => {
            if (window.innerWidth >= 992) { showAppChrome(); return; }
            if (isModalOpen || isSideDrawerOpen()) { showAppChrome(); return; }
            const el = (event.target && event.target.nodeType === 1) ? event.target : pages;
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
            if (el.scrollHeight - top - el.clientHeight <= BOTTOM_ZONE) { travel = 0; return; }
            if ((delta > 0) !== (travel > 0)) travel = 0;
            travel += delta;
            if (travel > HIDE_AFTER) { travel = 0; hideAppChrome(); }
            else if (travel < -SHOW_AFTER) { travel = 0; showAppChrome(); }
        };

        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        window.addEventListener('resize', () => {
            measureChromeTop();
            if (window.innerWidth >= 992) showAppChrome();
        });
        if (window.visualViewport) window.visualViewport.addEventListener('resize', measureChromeTop);
        measureChromeTop();
        setTimeout(measureChromeTop, 300);
    }

    function setupIOSPullToRefresh() {
        if (window.navigator.standalone !== true) return;

        const pages = document.getElementById('appPages');
        if (!pages) return;

        const indicator = document.createElement('div');
        indicator.className = 'ptr-indicator';
        indicator.innerHTML = '<div class="ptr-spinner"></div>';
        document.body.appendChild(indicator);

        const AXIS_SLOP = 18;
        const TRIGGER_AT = 84;
        const MAX_TRAVEL = 130;
        const REST_Y = -46;

        let startY = 0;
        let startX = 0;
        let tracking = false;
        let engaged = false;
        let travel = 0;
        let refreshing = false;

        function dampen(raw) {
            return MAX_TRAVEL * (1 - Math.exp(-raw / 150));
        }

        function paint(distance) {
            const progress = Math.min(1, distance / TRIGGER_AT);
            indicator.style.transform = 'translateY(' + (REST_Y + distance) + 'px) rotate(' + Math.round(progress * 270) + 'deg)';
            indicator.style.opacity = String(Math.min(1, distance / (TRIGGER_AT * 0.55)));
            indicator.classList.toggle('ready', progress >= 1);
        }

        function park() {
            tracking = false;
            engaged = false;
            travel = 0;
            indicator.classList.add('snapping');
            indicator.classList.remove('ready');
            indicator.classList.remove('spinning');
            indicator.style.opacity = '0';
            indicator.style.transform = 'translateY(' + REST_Y + 'px)';
        }

        function gestureMayPull(target) {
            if (isModalOpen || refreshing) return false;
            if (isSideDrawerOpen()) return false;
            if (pages.scrollTop > 0) return false;
            const scroller = scrollerOf(target);
            if (scroller && scroller.scrollTop > 0) return false;
            const historyScroller = document.getElementById('tableResponsive');
            if (historyScroller && historyScroller.offsetParent !== null && historyScroller.scrollTop > 0) return false;
            return true;
        }

        document.addEventListener('touchstart', (e) => {
            tracking = false;
            engaged = false;
            travel = 0;
            if (refreshing || e.touches.length !== 1) return;
            if (!gestureMayPull(e.target)) return;
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
            tracking = true;
            indicator.classList.remove('snapping');
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!tracking || refreshing) return;
            const deltaY = e.touches[0].clientY - startY;
            const deltaX = e.touches[0].clientX - startX;

            if (!engaged) {
                if (Math.abs(deltaY) < AXIS_SLOP && Math.abs(deltaX) < AXIS_SLOP) return;
                if (deltaY <= 0 || Math.abs(deltaY) < Math.abs(deltaX) * 1.4) { tracking = false; return; }
                if (!gestureMayPull(e.target)) { tracking = false; return; }
                engaged = true;
                startY = e.touches[0].clientY;
            }

            const raw = e.touches[0].clientY - startY;
            if (e.cancelable) e.preventDefault();
            travel = raw > 0 ? dampen(raw) : 0;
            paint(travel);
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (!tracking && !engaged) return;
            if (!engaged) { tracking = false; return; }
            tracking = false;
            engaged = false;
            if (travel >= TRIGGER_AT) {
                refreshing = true;
                indicator.classList.add('snapping');
                indicator.classList.add('spinning');
                indicator.style.opacity = '1';
                indicator.style.transform = 'translateY(' + (REST_Y + TRIGGER_AT) + 'px)';
                setTimeout(() => window.location.reload(), 260);
                return;
            }
            park();
        }, { passive: true });

        document.addEventListener('touchcancel', () => {
            if (refreshing) return;
            park();
        }, { passive: true });

        park();
        indicator.classList.remove('snapping');
    }

    function toggleHeaderMoreDropdown(event) {
        event.stopPropagation();
        const btn = event.currentTarget;
        const rect = btn.getBoundingClientRect();
        const menu = document.getElementById('globalMoreMenu');
        const container = document.getElementById('menuContentContainer');
        if(!menu || !container) return;

        container.innerHTML = `
            <button onclick="openExportDataModal(); document.getElementById('globalMoreMenu').classList.remove('show');">📤 Export Data</button>
            <button onclick="requestPinBeforeConfig(openManualAdjustModal, 'manualAdjust'); document.getElementById('globalMoreMenu').classList.remove('show');">✏️ កែទឹកប្រាក់/កញ្ចប់</button>
            <button onclick="openExchangeRateModal(); document.getElementById('globalMoreMenu').classList.remove('show');">💱 អត្រាប្រាក់ (${exchangeRateRiel}៛)</button>
            <button class="delete-opt" onclick="requestPinBeforeClearHistory(); document.getElementById('globalMoreMenu').classList.remove('show');">❌ លុបទាំងអស់</button>
        `;

        menu.classList.add('show');
        positionMenuSafely(menu, rect);
    }

    function toggleMoreDropdown(event, id) {
        event.stopPropagation();
        const btn = event.currentTarget;
        const rect = btn.getBoundingClientRect();
        const menu = document.getElementById('globalMoreMenu');
        const container = document.getElementById('menuContentContainer');
        if(!menu || !container) return;

        const item = scanHistory.find(i => i.id === id);
        let editMoneyHtml = '';
        if (item && item.barcodes && item.barcodes.length > 0) {
            editMoneyHtml = `<button onclick="openViewListModal('${escapeForInlineJsAttr(id)}'); document.getElementById('globalMoreMenu').classList.remove('show');">💵 កែ/ដកកញ្ចប់អីវ៉ាន់</button>`;
        }

        container.innerHTML = `
            ${editMoneyHtml}
            <button onclick="openEditModal('${escapeForInlineJsAttr(id)}'); document.getElementById('globalMoreMenu').classList.remove('show');">✏️ កែលេខទូរស័ព្ទ</button>
            <button class="delete-opt" onclick="deleteSingleItem('${escapeForInlineJsAttr(id)}'); document.getElementById('globalMoreMenu').classList.remove('show');">🗑️ លុប</button>
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
        const today = new Date(getServerNow());
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        const dayBefore = new Date(today); dayBefore.setDate(today.getDate() - 2);

        const todayStr = getFormattedDate(today);
        const yesterdayStr = getFormattedDate(yesterday);
        const dayBeforeStr = getFormattedDate(dayBefore);

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
        xlsx: { url: 'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js', integrity: 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw' }
    };
    const loadedScriptPromises = {};

    function loadScriptOnce(key) {
        if (loadedScriptPromises[key]) return loadedScriptPromises[key];
        const lib = EXPORT_LIBS[key];
        loadedScriptPromises[key] = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = lib.url;
            script.integrity = lib.integrity;
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve();
            script.onerror = () => { delete loadedScriptPromises[key]; reject(new Error('Failed to load ' + lib.url)); };
            document.head.appendChild(script);
        });
        return loadedScriptPromises[key];
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
            showToast("❌ Export Excel បរាជ័យ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត");
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
            <p class="export-footer">នាំចេញនៅ ${sanitizeInput(new Date(getServerNow()).toLocaleString('km-KH'))}</p>
        `;

        if (pdfExportOriginalTitle === null) pdfExportOriginalTitle = document.title;
        document.title = getExportFilenameBase();
        window.addEventListener('afterprint', restoreAfterPdfExport);
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
        const lines = [EXPORT_HEADERS.map(csvEscape).join(',')];
        rows.forEach(r => {
            lines.push([r.no, sheetsText(r.phone), sheetsText(r.barcode), r.locker, r.cod.toFixed(2), r.dod.toFixed(2), r.total.toFixed(2), r.status, r.scanDate, r.time].map(csvEscape).join(','));
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

        let targetDateKey = "";
        const today = new Date(getServerNow());
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        const dayBefore = new Date(today); dayBefore.setDate(today.getDate() - 2);

        if (currentFilterMode === 'today') targetDateKey = getFormattedDate(today);
        if (currentFilterMode === 'yesterday') targetDateKey = getFormattedDate(yesterday);
        if (currentFilterMode === 'dayBefore') targetDateKey = getFormattedDate(dayBefore);
        if (currentFilterMode === 'custom') targetDateKey = customFilterDate;

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
        const videoElement = document.getElementById('video');
        if (videoElement) {
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
        if (isCameraStarting) return;
        isCameraStarting = true;

        stopCurrentStream();
        const requestId = cameraRequestId;

        const constraints = {
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 24 }
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
                    videoElement.play().catch(() => {});
                    if (nativeDetector && isIOSDevice()) {
                        startFastNativeScan(videoElement);
                        startZxingVideoScan(videoElement);
                    } else if (nativeDetector) {
                        startFastNativeScan(videoElement);
                    } else if (codeReader) {
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
        async function renderLoop(timestamp) {
            if (!currentStream || !isCameraScanning || !nativeLoopActive) return;
            if (timestamp - lastCheck > 250) {
                lastCheck = timestamp;
                if (!isModalOpen && videoElement && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0) {
                    try {
                        const crop = getCoverCropRect(videoElement, container);
                        const bitmap = await createImageBitmap(videoElement, crop.sx, crop.sy, crop.sWidth, crop.sHeight);
                        try {
                            const barcodes = await nativeDetector.detect(bitmap);
                            if (barcodes && barcodes.length > 0 && !isModalOpen && currentStream && isCameraScanning && nativeLoopActive) {
                                processScannedCode(barcodes[0].rawValue);
                            }
                        } finally {
                            bitmap.close();
                        }
                    } catch (e) {}
                }
            }
            if (currentStream && isCameraScanning && nativeLoopActive) {
                requestAnimationFrame(renderLoop);
            }
        }
        requestAnimationFrame(renderLoop);
    }

    let ownCaptureCanvas = null;
    let ownCaptureCtx = null;
    function initScanEngine() {
        try {
            const oneDFormatNames = ['CODE_128', 'CODE_39', 'CODE_93', 'CODABAR', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'ITF', 'RSS_14', 'RSS_EXPANDED'];
            const possibleFormats = oneDFormatNames.map(name => ZXing.BarcodeFormat[name]).filter(f => f !== undefined);
            const hints = new Map();
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, possibleFormats);
            hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
            codeReader = new ZXing.BrowserBarcodeReader(500, hints);
            const liveHints = new Map();
            liveHints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, possibleFormats);
            liveScanCodeReader = new ZXing.BrowserBarcodeReader(500, liveHints);
        } catch (e) {
            console.error("ZXing Initialization error: ", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "ZXing Initialization error: " });
        }
    }

    function decodeBarcodeFromCanvasManual(reader, canvas) {
        const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
        const binarizer = new ZXing.HybridBinarizer(luminanceSource);
        const bitmap = new ZXing.BinaryBitmap(binarizer);
        const result = reader.decodeBitmap(bitmap);
        return result && (result.text || (typeof result.getText === 'function' ? result.getText() : ''));
    }

    function startZxingVideoScan(videoElement) {
        zxingLoopActive = true;
        const container = document.getElementById('video-container');

        if (!ownCaptureCanvas) {
            ownCaptureCanvas = document.createElement('canvas');
            ownCaptureCtx = ownCaptureCanvas.getContext('2d', { willReadFrequently: true });
        }

        let lastCheck = 0;
        let decoding = false;
        function loop(timestamp) {
            if (!currentStream || !isCameraScanning || !zxingLoopActive) return;
            if (!decoding && timestamp - lastCheck > 130) {
                if (!isModalOpen && videoElement && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0) {
                    lastCheck = timestamp;
                    decoding = true;

                    try {
                        const crop = getCoverCropRect(videoElement, container);
                        const maxDim = 800;
                        const scale = crop.sWidth > maxDim ? maxDim / crop.sWidth : 1;
                        ownCaptureCanvas.width = Math.round(crop.sWidth * scale);
                        ownCaptureCanvas.height = Math.round(crop.sHeight * scale);
                        ownCaptureCtx.drawImage(videoElement, crop.sx, crop.sy, crop.sWidth, crop.sHeight, 0, 0, ownCaptureCanvas.width, ownCaptureCanvas.height);

                        const text = liveScanCodeReader ? decodeBarcodeFromCanvasManual(liveScanCodeReader, ownCaptureCanvas) : '';
                        if (text && !isModalOpen) processScannedCode(text);
                    } catch (e) {
                    } finally {
                        decoding = false;
                    }
                }
            }
            if (currentStream && isCameraScanning && zxingLoopActive) {
                requestAnimationFrame(loop);
            }
        }
        requestAnimationFrame(loop);
    }

    function processScannedCode(code) {
        if (isModalOpen || !code) return;
        let currentTime = new Date().getTime();
        if (code !== lastScannedCode || (currentTime - lastScanTime > 2500)) {
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

    function positionPhoneSuggestBox() {
        const phoneInput = document.getElementById('searchPhoneInput');
        const box = document.getElementById('phoneSuggestBox');
        if (!phoneInput || !box || !box.classList.contains('show')) return;
        const rect = phoneInput.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight || (rect.width === 0 && rect.height === 0)) {
            hidePhoneSuggestions();
            return;
        }
        box.style.width = rect.width + 'px';
        box.style.left = rect.left + 'px';
        const boxHeight = box.offsetHeight;
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < boxHeight + 12 && rect.top > boxHeight + 12) {
            box.style.top = (rect.top - boxHeight - 4) + 'px';
        } else {
            box.style.top = (rect.bottom + 4) + 'px';
        }
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
        window.addEventListener('scroll', positionPhoneSuggestBox, { capture: true, passive: true });
        window.addEventListener('resize', positionPhoneSuggestBox);
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
        img.onload = function () {
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
                    ctx.translate(canvas.width / 2, canvas.height / 2);
                    ctx.rotate(deg * Math.PI / 180);
                    ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
                    const text = decodeBarcodeFromCanvasManual(codeReader, canvas);
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

    function releaseBarcodesInRegistry(codes) {
        if (!db || !fb || !codes || !codes.length) return Promise.resolve();
        const updates = {};
        codes.forEach((code) => {
            const key = barcodeRegistryKey(code);
            if (key) updates[key] = null;
        });
        if (!Object.keys(updates).length) return Promise.resolve();
        return fb.update(fb.ref(db, 'zoew_barcode_registry'), updates).catch(() => {});
    }

    const LOCKER_PREFIX_KEY = 'zoe_locker_prefix';
    const LOCKER_COUNT_KEY = 'zoe_locker_count';
    const ACTIVE_LOCKER_KEY = 'zoe_active_locker';
    const ENTRY_SCAN_MODE_KEY = 'zoe_entry_scan_mode';
    const ENTRY_LIST_MAX_ROWS = 200;
    const LOCKER_LIST_MAX_ROWS = 200;
    const DELETED_LIST_MAX_ROWS = 200;

    let activeLocker = localStorage.getItem(ACTIVE_LOCKER_KEY) || '';
    let entryScanMode = localStorage.getItem(ENTRY_SCAN_MODE_KEY) === 'locker' ? 'locker' : 'parcel';
    let lockerBarcodeIndex = {};
    let pendingLockerCode = null;
    let lockerAssignGeneration = 0;

    function lockerCodeKey(code) {
        return String(code === null || code === undefined ? '' : code).trim().toUpperCase();
    }

    function getLockerPrefix() {
        return localStorage.getItem(LOCKER_PREFIX_KEY) || 'ទូ';
    }

    function getLockerCount() {
        return parseInt(localStorage.getItem(LOCKER_COUNT_KEY) || '24') || 24;
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
        safeStoreSet(localStorage, LOCKER_PREFIX_KEY, prefix);
        safeStoreSet(localStorage, LOCKER_COUNT_KEY, String(count));
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
            safeStoreRemove(localStorage, ACTIVE_LOCKER_KEY);
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
        safeStoreSet(localStorage, ACTIVE_LOCKER_KEY, locker);
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
        safeStoreSet(localStorage, ENTRY_SCAN_MODE_KEY, entryScanMode);
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

        openModalHelper('phoneModal');
        const lookupPromise = attemptAutoLookup(cleanBarcode);

        const lookupCfg = getLookupApiConfig();
        if (!lookupCfg || !lookupCfg.enabled) {
            setTimeout(() => {
                if(modalPhoneInput) modalPhoneInput.focus();
            }, 150);
        } else {
            lookupPromise.finally(() => {
                if (isModalOpen && pendingBarcode === cleanBarcode && modalPhoneInput && !modalPhoneInput.value) {
                    modalPhoneInput.focus();
                }
            });
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
            safeStoreSet(localStorage, 'last_entered_locker', rawLocker);
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

            const historySnapshot = scanHistory.map(item => ({ ...item, barcodes: Array.isArray(item.barcodes) ? item.barcodes.map(b => ({ ...b })) : item.barcodes }));

            const rollbackFailedSave = () => {
                if (claim === 'claimed') releaseBarcodesInRegistry([barcodeToSave]);
                scanHistory = historySnapshot;
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
                    }, rollbackFailedSave);
                } else {
                    rollbackFailedSave();
                }
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

        const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
            let reopenedFromClosed = false;
            let reopenedScanDate = dateString;
            let reopenedPhoneKey = null;
            let mergeAddedBarcode = false;

            const mergeScannedBarcodeInto = (target) => {
                mergeAddedBarcode = false;
                reopenedFromClosed = target.isClosed === true;
                reopenedScanDate = target.scanDate || dateString;
                reopenedPhoneKey = getPickupPhoneKey(target);
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
                    if (reopenedFromClosed && reopenedPhoneKey) {
                        addPickupToDailyRecord(reopenedScanDate, reopenedPhoneKey, -1, 0);
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

            let bcTimeDisplay = b.time ? `<div style="font-size:9px; color:var(--text-muted); margin-top:2px;">🕒 ${sanitizeInput(b.time)}</div>` : '';

            div.innerHTML = `
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 11px;"><strong>${idx + 1}.</strong> <span class="barcode-tag">🏷️ ${sanitizeInput(b.code)}</span> <span class="locker-badge" style="margin-left:4px;">ទីតាំង: ${sanitizeInput(itemLocker)}</span></div>
                    ${bcTimeDisplay}
                    <div style="font-size:9.5px; color:var(--text-muted); margin-top:2px;">
                        COD: <strong style="color:var(--accent-blue);">$${itemCod.toFixed(2)}</strong> | DOD: <strong style="color:var(--accent-purple);">$${itemDod.toFixed(2)}</strong> (សរុប: $${totalSub.toFixed(2)})
                    </div>
                </div>
                <div class="barcode-actions-group">
                    <button class="${closeBtnClass}" onclick="toggleIndividualBarcodeClose('${escapeForInlineJsAttr(item.id)}', '${escapeForInlineJsAttr(b.code)}')">${closeBtnText}</button>
                    <button class="btn-edit-item-price" onclick="openEditBarcodePriceModal('${escapeForInlineJsAttr(item.id)}', '${escapeForInlineJsAttr(b.code)}')">✏️ កែ</button>
                    <button class="btn-delete-bc" onclick="removeSingleBarcode('${escapeForInlineJsAttr(item.id)}', '${escapeForInlineJsAttr(b.code)}')">🗑️ ដក</button>
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
        try {
            const result = await fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${itemId}`), (currentItem) => {
                claimedParent = null;
                claimedBarcode = null;
                claimedWhole = null;
                if (!currentItem) return currentItem;
                if (currentItem.clearClaim) return currentItem;
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
            });

            if (!result || !result.committed) throw new Error('Remove barcode transaction was not committed');

            if (!claimedBarcode) {
                refreshCurrentHistoryView();
                showToast("⚠️ កញ្ចប់នេះលែងមានក្នុងប្រព័ន្ធទៀតហើយ! គ្មានអ្វីត្រូវដកទេ។");
                return;
            }

            const committedItem = result.snapshot ? result.snapshot.val() : null;
            const localIdx = scanHistory.findIndex(i => i.id === itemId);
            if (claimedWhole) {
                if (localIdx !== -1) scanHistory.splice(localIdx, 1);
                closeModal('viewListModal');
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
            const itemToTrash = { ...claimedParent, barcodes: [removedBc], count: 1 };
            itemToTrash.id = generateUniqueId();
            itemToTrash.deletedAt = getServerNow();
            itemToTrash.isFromDeletion = false;
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
            if (!claimedWhole) openViewListModal(itemId);
            refreshCurrentHistoryView();

            let trashSaved = false;
            await retryAsync(() => saveSingleDeletedItemToFirebase(itemToTrash), 4, 1500).then(() => {
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
                showToast("បានដកកញ្ចប់អីវ៉ាន់ និងកាត់ប្រាក់ចេញពីស្ថិតិរួចរាល់!");
            }
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
            ? { isClosed: freshB.isClosed, itemIsClosed: freshItem.isClosed, itemClosedAt: freshItem.closedAt, itemCallMark: freshItem.callMark, itemCallMarkTime: freshItem.callMarkTime }
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
            freshB.isClosed = desiredClosed;
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
            if (!previousState.itemIsClosed && allClosedLocal) {
                pickupCustomerDelta = 1;
            } else if (previousState.itemIsClosed && !allClosedLocal) {
                pickupCustomerDelta = -1;
            }
            addPickupToDailyRecord(pickupScanDate, pickupPhoneKey, pickupCustomerDelta, pickupPackageDelta);

            openViewListModal(itemId);
            refreshCurrentHistoryView();
        }
        showToast(`បាន${actionText}ស្ថានភាព Barcode រួចរាល់!`);

        if (!db || !/^[a-zA-Z0-9_-]+$/.test(itemId)) return;

        try {
            const itemRef = fb.ref(db, `zoew_scan_history_cod_dod/${itemId}`);
            const barcodeCloseResult = await fb.runTransaction(itemRef, (currentItem) => {
                serverApplied = false;
                serverPackageDelta = 0;
                serverCustomerDelta = 0;
                if (!currentItem) return currentItem;
                if (currentItem.clearClaim) return;
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
                const wasItemClosed = !!currentItem.isClosed;
                serverPackageDelta = (!!b.isClosed === desiredClosed) ? 0 : (desiredClosed ? 1 : -1);
                b.isClosed = desiredClosed;
                const allClosed = currentItem.barcodes.every(bc => bc.isClosed);
                serverCustomerDelta = (!wasItemClosed && allClosed) ? 1 : ((wasItemClosed && !allClosed) ? -1 : 0);
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
            const committedItem = (barcodeCloseResult && barcodeCloseResult.committed && barcodeCloseResult.snapshot) ? barcodeCloseResult.snapshot.val() : null;
            if (!serverApplied || !(barcodeCloseResult && barcodeCloseResult.committed)) {
                revertPickupDeltaAfterNoOp();
            } else {
                reconcilePickupDeltaWithServer();
            }
        } catch (error) {
            console.error("Error toggling barcode close: ", error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error toggling barcode close: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! កំពុងត្រឡប់ស្ថានភាពដើមវិញ...");
            if (previousState) {
                const revertItem = scanHistory.find(i => i.id === itemId);
                const revertB = revertItem && revertItem.barcodes ? revertItem.barcodes.find(b => b.code === barcodeCode) : null;
                if (revertItem && revertB) {
                    revertB.isClosed = previousState.isClosed;
                    revertItem.isClosed = previousState.itemIsClosed;
                    if (previousState.itemClosedAt !== undefined) revertItem.closedAt = previousState.itemClosedAt;
                    else delete revertItem.closedAt;
                    if (previousState.itemCallMark !== undefined) revertItem.callMark = previousState.itemCallMark;
                    else delete revertItem.callMark;
                    if (previousState.itemCallMarkTime !== undefined) revertItem.callMarkTime = previousState.itemCallMarkTime;
                    else delete revertItem.callMarkTime;
                    openViewListModal(itemId);
                    refreshCurrentHistoryView();
                }
            }
            if (pickupCustomerDelta !== 0 || pickupPackageDelta !== 0) {
                const pickupScanDate = (freshItem && freshItem.scanDate) || getFormattedDate();
                addPickupToDailyRecord(pickupScanDate, pickupPhoneKey, -pickupCustomerDelta, -pickupPackageDelta);
            }
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
                fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${editedItemId}`), (currentItem) => {
                    serverApplied = false;
                    if (!currentItem) return currentItem;
                    if (currentItem.clearClaim) return;
                    return applyEditedPriceTo(currentItem);
                }).then((result) => {
                    if (!result || !result.committed) {
                        throw new Error('Barcode price transaction was not committed');
                    }
                    const committedItem = result.snapshot ? result.snapshot.val() : null;
                    if (committedItem && !committedItem.id) committedItem.id = editedItemId;
                    if (!serverApplied) {
                        if (revenueApplied) {
                            addRevenueToDailyAndMonthlyRecord(revenueScanDate, -codDiff, -dodDiff, 0);
                        }
                        const staleItem = scanHistory.find(i => i.id === editedItemId);
                        const staleB = staleItem && Array.isArray(staleItem.barcodes)
                            ? staleItem.barcodes.find(b => b.code === editedBarcodeCode)
                            : null;
                        if (staleB) {
                            staleB.cod = oldCod;
                            staleB.dod = oldDod;
                            staleItem.cod = Math.round(staleItem.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                            staleItem.dod = Math.round(staleItem.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                            staleItem.price = Math.round((staleItem.cod + staleItem.dod) * 100) / 100;
                            refreshCurrentHistoryView();
                        }
                        showToast("⚠️ កញ្ចប់នេះលែងមានក្នុងប្រព័ន្ធទៀតហើយ! ទឹកប្រាក់មិនត្រូវបានកែទេ។");
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
                }, () => {
                    if (revenueApplied) {
                        addRevenueToDailyAndMonthlyRecord(revenueScanDate, -codDiff, -dodDiff, 0);
                    }
                    const revertItem = scanHistory.find(i => i.id === editedItemId);
                    const revertB = revertItem && Array.isArray(revertItem.barcodes)
                        ? revertItem.barcodes.find(b => b.code === editedBarcodeCode)
                        : null;
                    if (revertB) {
                        revertB.cod = oldCod;
                        revertB.dod = oldDod;
                        revertItem.cod = Math.round(revertItem.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                        revertItem.dod = Math.round(revertItem.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                        revertItem.price = Math.round((revertItem.cod + revertItem.dod) * 100) / 100;
                    }
                    refreshCurrentHistoryView();
                    const viewListEl = document.getElementById('viewListModal');
                    if (viewListEl && viewListEl.style.display === 'flex') openViewListModal(editedItemId);
                    showToast("⚠️ កែប្រែទឹកប្រាក់មិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
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
            patchHistoryItemFields(item, patchFields, previousFields);
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
                patchHistoryItemFields(item, { callMark: mark, callMarkTime: item.callMarkTime }, { callMark: prevCallMark, callMarkTime: prevCallMarkTime });
            } else {
                delete item.callMark;
                delete item.callMarkTime;
                patchHistoryItemFields(item, { callMark: null, callMarkTime: null }, { callMark: prevCallMark, callMarkTime: prevCallMarkTime });
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
            if (item.isClosed && prevPickupKey !== nextPickupKey) {
                addPickupToDailyRecord(pickupDate, prevPickupKey, -1, 0);
                addPickupToDailyRecord(pickupDate, nextPickupKey, 1, 0);
                pickupRefMoved = true;
            }
            const revertPickupRefMove = () => {
                if (!pickupRefMoved) return;
                pickupRefMoved = false;
                addPickupToDailyRecord(pickupDate, nextPickupKey, -1, 0);
                addPickupToDailyRecord(pickupDate, prevPickupKey, 1, 0);
            };
            let serverWasClosed = null;
            const reconcilePickupRefWithServer = () => {
                if (serverWasClosed === null || prevPickupKey === nextPickupKey) return;
                if (serverWasClosed && !pickupRefMoved) {
                    addPickupToDailyRecord(pickupDate, prevPickupKey, -1, 0);
                    addPickupToDailyRecord(pickupDate, nextPickupKey, 1, 0);
                    pickupRefMoved = true;
                } else if (!serverWasClosed && pickupRefMoved) {
                    revertPickupRefMove();
                }
            };
            patchHistoryItemFields(item, patchFields, previousFields, (serverItem) => {
                serverWasClosed = !!serverItem.isClosed;
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
            ? { isClosed: freshItem.isClosed, closedAt: freshItem.closedAt, callMark: freshItem.callMark, callMarkTime: freshItem.callMarkTime, barcodeStates: freshItem.barcodes ? freshItem.barcodes.map(b => b.isClosed) : null }
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
                if (freshItem.barcodes && Array.isArray(freshItem.barcodes)) freshItem.barcodes.forEach(b => b.isClosed = true);
            } else {
                delete freshItem.closedAt;
                if (freshItem.barcodes && Array.isArray(freshItem.barcodes)) freshItem.barcodes.forEach(b => b.isClosed = false);
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
            pickupCustomerDelta = alreadyInDesiredState ? 0 : (desiredClosed ? 1 : -1);
            addPickupToDailyRecord(pickupScanDate, pickupPhoneKey, pickupCustomerDelta, pickupPackageDelta);

            refreshCurrentHistoryView();
        }
        showToast(`បាន${actionText}បញ្ជីជោគជ័យ!`);

        if (!db || !/^[a-zA-Z0-9_-]+$/.test(id)) return;

        try {
            const itemRef = fb.ref(db, `zoew_scan_history_cod_dod/${id}`);
            const closeResult = await fb.runTransaction(itemRef, (currentItem) => {
                serverApplied = false;
                serverPackageDelta = 0;
                serverCustomerDelta = 0;
                if (!currentItem) return currentItem;
                if (currentItem.clearClaim) return;
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
                serverCustomerDelta = (!!currentItem.isClosed === desiredClosed) ? 0 : (desiredClosed ? 1 : -1);
                currentItem.isClosed = desiredClosed;
                if (desiredClosed) {
                    currentItem.closedAt = getServerNow();
                    delete currentItem.callMark;
                    delete currentItem.callMarkTime;
                    if (serverBarcodes) serverBarcodes.forEach(b => b.isClosed = true);
                } else {
                    delete currentItem.closedAt;
                    if (serverBarcodes) serverBarcodes.forEach(b => b.isClosed = false);
                }
                serverApplied = true;
                return currentItem;
            });
            const committedItem = (closeResult && closeResult.committed && closeResult.snapshot) ? closeResult.snapshot.val() : null;
            if (!serverApplied || !(closeResult && closeResult.committed)) {
                revertPickupDeltaAfterNoOp();
            } else {
                reconcilePickupDeltaWithServer();
            }
        } catch (error) {
            console.error("Error toggling close status: ", error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error toggling close status: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! កំពុងត្រឡប់ស្ថានភាពដើមវិញ...");
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
                        revertItem.barcodes.forEach((b, i) => { if (previousState.barcodeStates[i] !== undefined) b.isClosed = previousState.barcodeStates[i]; });
                    }
                    refreshCurrentHistoryView();
                }
            }
            if (pickupCustomerDelta !== 0 || pickupPackageDelta !== 0) {
                const pickupScanDate = (freshItem && freshItem.scanDate) || getFormattedDate();
                addPickupToDailyRecord(pickupScanDate, pickupPhoneKey, -pickupCustomerDelta, -pickupPackageDelta);
            }
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
        try {
            const result = await fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${id}`), (currentItem) => {
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
            });

            if (!result || !result.committed) throw new Error('Delete item transaction was not committed');

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

            const removed = { ...claimedWhole, id };
            removed.deletedAt = getServerNow();
            removed.isFromDeletion = true;
            if (Array.isArray(removed.barcodes)) {
                removed.barcodes = removed.barcodes.map(b => ({ ...b, isFromDeletion: true }));
            }

            deletedItems.unshift(removed);
            refreshCurrentHistoryView();
            updateRecentPhonesList();

            let trashSaved = false;
            await retryAsync(() => saveSingleDeletedItemToFirebase(removed), 4, 1500).then(() => {
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
                showToast("បានលុបទៅធុងសំរាមបណ្តោះអាសន្ន!");
            }
        } catch (e) {
            console.error("Error deleting single item: ", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Error deleting single item: " });
            refreshCurrentHistoryView();
            updateRecentPhonesList();
            showToast("⚠️ លុបមិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
        }
    }

    function openRecentlyDeletedModal() {
        renderRecentlyDeleted();
        openModalHelper('recentlyDeletedModal');
    }

    function renderRecentlyDeleted() {
        const tbody = document.getElementById('deletedTableBody');
        if(!tbody) return;
        tbody.innerHTML = '';

        if (deletedItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #888; padding: 12px;">គ្មានទិន្នន័យដែលបានលុបទេ</td></tr>`;
            return;
        }

        let html = '';
        deletedItems.slice(0, DELETED_LIST_MAX_ROWS).forEach((item) => {
            let deleteTypeLabel = item.isFromDeletion ? "លុបទាំងមូល" : "ដកកញ្ចប់";
            let displayCode = item.barcodes && item.barcodes.length > 0 ? item.barcodes[0].code : item.barcode;
            html += `<tr>
                <td><strong>${sanitizeInput(item.phone)}</strong><br><small style="color:var(--text-muted);">${deleteTypeLabel}</small></td>
                <td><span class="barcode-tag">${sanitizeInput(displayCode)}</span></td>
                <td style="text-align: center;">
                    <div style="display:flex; gap:4px; justify-content:center;">
                        <button class="btn-sm" style="background:#10b981; color:white; padding:4px 8px; min-height:26px;" onclick="promptRestoreDeletedItem('${escapeForInlineJsAttr(item.id)}')">🔄</button>
                        <button class="btn-sm" style="background:#ef4444; color:white; padding:4px 8px; min-height:26px;" onclick="promptPermanentDelete('${escapeForInlineJsAttr(item.id)}')">✖️</button>
                    </div>
                </td>
            </tr>`;
        });
        if (deletedItems.length > DELETED_LIST_MAX_ROWS) {
            html += `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:8px;">... និងមាន ${deletedItems.length - DELETED_LIST_MAX_ROWS} ធាតុទៀត (ធាតុចាស់ជាង ១០ ថ្ងៃលុបចោលដោយស្វ័យប្រវត្តិ)</td></tr>`;
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
            const historySnap = await fb.get(dbRefHistory);
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
        const result = await fb.runTransaction(trashRef, (currentItem) => {
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
        });
        if (!result || !result.committed || !claimedItem) throw new Error(claimStatus);
        return { item: claimedItem, replacedClaim };
    }

    async function bindRestoreClaimTarget(id, token, targetId) {
        let bound = false;
        const result = await fb.runTransaction(fb.ref(db, `zoew_recently_deleted_cod_dod/${id}`), (currentItem) => {
            bound = false;
            if (!currentItem || !currentItem.restoreClaim || currentItem.restoreClaim.token !== token) return;
            currentItem.restoreClaim = { token, claimedAt: getServerNow(), targetId };
            bound = true;
            return currentItem;
        });
        if (!bound || !result || !result.committed) throw new Error('RESTORE_CLAIM_LOST');
    }

    async function clearRestoreHistoryMarker(targetId, sourceId, token) {
        if (!targetId || !sourceId || !token) return;
        await fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${targetId}`), (currentItem) => {
            if (!currentItem || currentItem.restoreClaimId !== sourceId || currentItem.restoreClaimToken !== token) return;
            delete currentItem.restoreClaimId;
            delete currentItem.restoreClaimToken;
            return currentItem;
        });
    }

    async function clearRestoreFinalization(sourceId, token) {
        if (!sourceId || !token) return;
        await fb.runTransaction(fb.ref(db, `zoew_restore_finalizations/${sourceId}`), (currentFinalization) => {
            if (!currentFinalization || currentFinalization.token !== token) return;
            return null;
        });
    }

    async function applyClaimedRestoreToHistory(targetId, sourceId, token, itemToRestore, applyRestoreMergeInto) {
        let targetChanged = false;
        let committedItem = null;
        const result = await fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${targetId}`), (currentItem) => {
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
        });
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
                await fb.update(fb.ref(db), updates);
                return;
            } catch (error) {
                lastError = error;
                let trashSnapshot;
                try {
                    trashSnapshot = await fb.get(fb.ref(db, `zoew_recently_deleted_cod_dod/${sourceId}`));
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
                const previewSnap = await fb.get(fb.ref(db, `zoew_recently_deleted_cod_dod/${restoredId}`));
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
            const finalSnap = await fb.get(fb.ref(db, `zoew_scan_history_cod_dod/${targetId}`));
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
                const [histSnap, delSnap] = await Promise.all([fb.get(dbRefHistory), fb.get(dbRefDeleted)]);
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

    async function executePermanentDelete() {
        const id = pendingPermanentDeleteId;
        pendingPermanentDeleteId = null;
        closeModal('permanentDeleteWarningModal');
        if (!id) { openRecentlyDeletedModal(); return; }

        const index = deletedItems.findIndex(i => i.id === id);
        if (index === -1) { openRecentlyDeletedModal(); return; }

        const deletedSnapshot = deletedItems.map(i => ({ ...i, barcodes: Array.isArray(i.barcodes) ? i.barcodes.map(b => ({ ...b })) : i.barcodes }));
        const purgedItem = deletedItems.splice(index, 1)[0];
        renderRecentlyDeleted();
        openRecentlyDeletedModal();

        try {
            await deleteSingleDeletedItemFromFirebase(id);
            releaseBarcodesInRegistry(collectItemBarcodes(purgedItem));
        } catch (e) {
            deletedItems = deletedSnapshot;
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

    function patchHistoryItemFields(item, fields, previousFields, onServerItem) {
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
        return fb.runTransaction(fb.ref(db, `zoew_scan_history_cod_dod/${item.id}`), (currentItem) => {
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
        }).then((result) => {
            if (!serverItemExisted || !(result && result.committed)) {
                revertLocalFields();
                showToast("⚠️ ទិន្នន័យនេះលែងមានក្នុងប្រព័ន្ធ! ការកែប្រែមិនត្រូវបានរក្សាទុកទេ។");
                return false;
            }
            const committedItem = result.snapshot ? normalizeBarcodesOf(result.snapshot.val()) : null;
            if (committedItem && !committedItem.id) committedItem.id = item.id;
            return committedItem || true;
        }, (error) => {
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

    function deleteMultipleDeletedItemsFromFirebase(ids) {
        if (!dbRefDeleted || !ids || !ids.length) return Promise.resolve();
        const updates = {};
        ids.forEach(id => {
            if (id && /^[a-zA-Z0-9_-]+$/.test(id)) updates[id] = null;
        });
        if (!Object.keys(updates).length) return Promise.resolve();
        return fb.update(dbRefDeleted, updates).catch((error) => {
            console.error("Error purging deleted items: ", error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error purging deleted items: " });
            showToast("⚠️ បរាជ័យក្នុងការលុបធុងសំរាមចាស់ចេញពី Firebase!");
            throw error;
        });
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
            let phoneDisplay = item.phone === "គ្មានលេខ" ? `<span style="color:#ef4444; font-style:italic;">គ្មានលេខ</span>` : `<span class="phone-clickable" onclick="openCallMarkModal('${escapeForInlineJsAttr(item.id)}')" title="ចុចដើម្បីសម្គាល់ការខល">${sanitizeInput(item.phone)}</span>`;

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
                    callAction = `<button class="btn-sm fix-phone-btn btn-primary-action" onclick="openEditModal('${escapeForInlineJsAttr(item.id)}')" title="លេខខុស — សូមកែលេខថ្មី">✏️ កែលេខ</button>`;
                } else if (item.isCalled && !needsRecall) {
                    callAction = `<a href="tel:${sanitizeInput(item.phone)}" onclick="handleCallAction('${escapeForInlineJsAttr(item.id)}')" class="btn-sm called-btn btn-primary-action">✔️ ខល</a>`;
                } else {
                    let recallClass = needsRecall ? ' call-btn-recall' : '';
                    callAction = `<a href="tel:${sanitizeInput(item.phone)}" onclick="handleCallAction('${escapeForInlineJsAttr(item.id)}')" class="btn-sm call-btn btn-primary-action${recallClass}" title="${needsRecall ? 'សូមខលម្ដងទៀត' : ''}">📞 ខល</a>`;
                }
            }

            let closeBtnText = item.isClosed ? "❌ បើក" : "✅ បិទ";
            let closeAction = `<button class="btn-sm close-btn btn-primary-action" onclick="toggleCloseStatus('${escapeForInlineJsAttr(item.id)}')">${closeBtnText}</button>`;

            let moreDropdown = `
                <div class="more-dropdown">
                    <button class="more-btn" onclick="toggleMoreDropdown(event, '${escapeForInlineJsAttr(item.id)}')">⋮</button>
                </div>
            `;

            let ageBadge = isOld
                ? `<span style="background:#fef3c7; color:#b45309; padding:2px 5px; border-radius:4px; font-size:9px; font-weight:600; margin-left:4px;">ចាស់</span>`
                : `<span style="background:var(--success-light); color:var(--success); padding:2px 5px; border-radius:4px; font-size:9px; font-weight:600; margin-left:4px;">ថ្មី</span>`;

            let statusBadge = item.isClosed ? `<span class="closed-badge">យកហើយ</span>` : ageBadge;
            let calledBadge = item.isCalled ? `<span class="called-badge">ខល</span>` : "";
            let scanTimeDisplay = item.time ? `<span class="scan-time-tag">🕒 ${sanitizeInput(item.time)}</span>` : "";

            let totalPackageCount = item.barcodes && Array.isArray(item.barcodes) ? item.barcodes.length : (parseFloat(item.count) || 1);
            let viewListBtn = '';
            if (totalPackageCount > 1) {
                viewListBtn = `<button class="btn-view-list" onclick="openViewListModal('${escapeForInlineJsAttr(item.id)}')">📦 បញ្ជី (${totalPackageCount})</button>`;
            } else {
                viewListBtn = `<button class="btn-view-list" onclick="openViewListModal('${escapeForInlineJsAttr(item.id)}')" style="background:#fef08a; color:#854d0e; border-color:#fde047;">💵 កែ/ដកកញ្ចប់</button>`;
            }

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
                priceDisplayHtml = `
                    <div style="font-size: 10px;">COD: <strong style="color:var(--accent-blue);">$${activeCod.toFixed(2)}</strong> (${codRiel.toLocaleString()} ៛)</div>
                    <div style="font-size: 10px; margin-top:2px;">DOD: <strong style="color:var(--accent-purple);">$${activeDod.toFixed(2)}</strong> (${dodRiel.toLocaleString()} ៛)</div>
                `;
            } else if (hasCod) {
                let codRiel = Math.round(activeCod * exchangeRateRiel);
                priceDisplayHtml = `
                    <div style="font-size: 10.5px;">COD: <strong style="color:var(--accent-blue);">$${activeCod.toFixed(2)}</strong></div>
                    <div style="font-size: 9.5px; color: var(--text-muted);">${codRiel.toLocaleString()} ៛</div>
                `;
            } else if (hasDod) {
                let dodRiel = Math.round(activeDod * exchangeRateRiel);
                priceDisplayHtml = `
                    <div style="font-size: 10.5px;">DOD: <strong style="color:var(--accent-purple);">$${activeDod.toFixed(2)}</strong></div>
                    <div style="font-size: 9.5px; color: var(--text-muted);">${dodRiel.toLocaleString()} ៛</div>
                `;
            } else {
                priceDisplayHtml = `
                    <div style="font-size: 10.5px; color: var(--text-muted);">0.00 $ (0 ៛)</div>
                `;
            }

            const html = `
                <td style="text-align: center;">${rowNumClass ? `<span class="row-num-mark ${rowNumClass}" title="${rowNumLabel}">${rowNum}</span>` : rowNum}</td>
                <td>
                    <div class="customer-info-stack">
                        <div class="phone-title">
                            📱 ${phoneDisplay} ${calledBadge}${statusBadge}
                        </div>
                        <div>
                            ${viewListBtn}
                        </div>
                        ${scanTimeDisplay}
                    </div>
                </td>
                <td style="text-align: left; padding-left: 6px;">
                    <div style="margin-bottom:3px;">
                        <span class="locker-badge">ទីតាំង: ${sanitizeInput(lockerLoc)}</span>
                    </div>
                    ${priceDisplayHtml}
                    <div style="margin-top:3px;">
                        <span class="count-badge">កញ្ចប់សរុប: ${activeCount}</span>
                    </div>
                </td>
                <td>
                    <div class="action-group">
                        ${callAction}
                        ${closeAction}${moreDropdown}
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
        delete trashItem.clearClaim;
        delete trashItem.restoreClaim;
        delete trashItem.restoreClaimId;
        delete trashItem.restoreClaimToken;
        trashItem.deletedAt = getServerNow();
        trashItem.isFromDeletion = true;
        if (Array.isArray(trashItem.barcodes)) {
            trashItem.barcodes = trashItem.barcodes.map((barcode) => ({ ...barcode, isFromDeletion: true }));
        }
        return trashItem;
    }

    async function claimHistoryItemForClear(id, token) {
        let claimedItem = null;
        let status = 'CLEAR_HISTORY_MISSING';
        const itemRef = fb.ref(db, `zoew_scan_history_cod_dod/${id}`);
        const result = await fb.runTransaction(itemRef, (currentItem) => {
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
        });
        if (!result || !result.committed || !claimedItem) throw new Error(status);
        return claimedItem;
    }

    async function clearClearHistoryFinalization(id, token) {
        await fb.runTransaction(fb.ref(db, `zoew_clear_history_finalizations/${id}`), (currentFinalization) => {
            if (!currentFinalization || currentFinalization.token !== token) return;
            return null;
        });
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
                await fb.update(fb.ref(db), updates);
                return;
            } catch (error) {
                lastError = error;
                let historySnapshot;
                let trashSnapshot;
                let finalizationSnapshot;
                try {
                    [historySnapshot, trashSnapshot, finalizationSnapshot] = await Promise.all([
                        fb.get(fb.ref(db, `zoew_scan_history_cod_dod/${id}`)),
                        fb.get(fb.ref(db, `zoew_recently_deleted_cod_dod/${id}`)),
                        fb.get(fb.ref(db, `zoew_clear_history_finalizations/${id}`))
                    ]);
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
                    }
                }
            }
            refreshCurrentHistoryView();
            updateRecentPhonesList();
            if (clearedCount && !blockedCount && !failedCount) {
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
