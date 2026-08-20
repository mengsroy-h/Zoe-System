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
    let pendingRoleRecheck = false;
    let isDatabaseConnected = false;
    let lastRoleRestOutcome = '';
    const ROLE_CHECK_CONNECT_WAIT_MS = 45000;
    const SLOW_NETWORK_NOTICE_MS = 4000;

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
        let trimmed = phoneStr.trim();
        trimmed = trimmed.replace(/^(\+?855-?)/, '0');
        return trimmed;
    }

    function openModalHelper(modalId) {
        isModalOpen = true;
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
                if (online) retryPendingRoleCheck();
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

    function requestPinBeforeConfig(targetAction) {
        pinTargetAction = targetAction || openConfigModal;
        let savedPin = localStorage.getItem('zoew_security_pin_hash');
        if (!savedPin) {
            openModalHelper('pinSetupModal');
        } else {
            const pinIn = document.getElementById('securityPinInput');
            if(pinIn) pinIn.value = '';
            openModalHelper('pinModal');
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
        showToast("បានកំណត់ Security PIN រួចរាល់!");
        (pinTargetAction || openConfigModal)();
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
                if (!savedPin.startsWith('pbkdf2:')) {
                    localStorage.setItem('zoew_security_pin_hash', await hashPin(enteredPin));
                }
                localStorage.removeItem('zoew_pin_fail_count');
                localStorage.removeItem('zoew_pin_lockout_until');
                lookupSecretKey = await deriveLookupSecretKey(enteredPin);
                closeModal('pinModal');
                (pinTargetAction || openConfigModal)();
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

    function checkPinAndOpenConfig(isFirstTime = false) {
        if (isPinFlowPending()) return;
        pinTargetAction = null;
        let savedPin = localStorage.getItem('zoew_security_pin_hash');
        if (!savedPin) {
            openModalHelper('pinSetupModal');
        } else {
            requestPinBeforeConfig();
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
            const sentryOk = await ZoeErrors.init('zoeadmin');
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
        });
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

        if (headerValueRaw) {
            if (!lookupSecretKey) {
                alert("សម័យ PIN បានផុតកំណត់! សូមបិទ Config នេះ ហើយបើកម្តងទៀតដើម្បីបញ្ចូល PIN សាជាថ្មី មុននឹងផ្លាស់ប្តូរ Secret។");
                return;
            }
            headerValueEnc = await encryptLookupSecret(headerValueRaw);
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

        localStorage.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
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
        if (/[?&]code=/.test(url)) {
            url = url.replace(/([?&])code=[^&]*/, '$1list=1');
        } else {
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
            phoneEl.value = String(phoneVal).trim().replace(/^(\+?855-?)/, '0');
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
        localStorage.setItem('zoew_exchange_rate', val);

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
        localStorage.removeItem('zoew_login_time');
        if (!keepEmail) localStorage.removeItem('remembered_email');
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
        const fieldsToBlank = [
            'listModalPhoneText', 'barcodeListContainer', 'callMarkPhoneText',
            'editBcPcText', 'editBcCodInput', 'editBcDodInput', 'editPhoneInput',
            'searchPhoneInput', 'hwScannerInput', 'customerDataTableSearchInput',
            'modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput',
            'manualDateInput', 'manualCodChangeInput', 'manualDodChangeInput', 'manualCountChangeInput',
            'editModalBarcodeText', 'lookupApiHeaderValueInput',
            'modalBarcodeText', 'pdfExportPrintArea', 'phoneSuggestBox'
        ];
        fieldsToBlank.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            if ('value' in el) el.value = '';
            else el.textContent = '';
        });
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
            case 'app-mismatch': return 'Key នេះមិនមែនសម្រាប់ ZoeAdmin ទេ!';
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
                : (status.reason ? licenseFailureMessage(status.reason) : 'សូមបញ្ចូល Activation Key សម្រាប់ ZoeAdmin ដើម្បីបន្ត។');
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

    function readDatabaseUrlFromConfig() {
        try {
            const raw = localStorage.getItem('zoew_firebase_config');
            if (!raw) return '';
            const cfg = JSON.parse(raw);
            const url = cfg && cfg.databaseURL ? String(cfg.databaseURL) : '';
            return url.replace(/\/+$/, '');
        } catch (e) {
            return '';
        }
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
        let res;
        try {
            const token = await user.getIdToken();
            res = await fetch(base + '/user_roles/' + encodeURIComponent(user.uid) + '.json?auth=' + encodeURIComponent(token), { cache: 'no-store' });
        } catch (e) {
            lastRoleRestOutcome = 'blocked: ' + ((e && e.message) || 'unknown');
            throw e;
        }
        if (!res.ok) {
            lastRoleRestOutcome = 'http ' + res.status;
            throw new Error('REST role check failed: ' + res.status);
        }
        const value = await res.json();
        lastRoleRestOutcome = 'ok';
        return value;
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
        let role;
        try {
            role = await readUserRole(user);
        } catch (e) {
            if (myAuthGeneration !== authGeneration) return;
            console.error("Role verification failed:", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Role verification failed:", connected: isDatabaseConnected, restRoleRead: lastRoleRestOutcome });
            if (e && e.message === 'Role check timed out') {
                pendingRoleRecheck = true;
                showLoginModalWithPrefill();
                showToast("⚠️ ការតភ្ជាប់អ៊ីនធឺណិតយឺត! មិនទាន់ផ្ទៀងផ្ទាត់សិទ្ធិចូលប្រព័ន្ធបានទេ — ប្រព័ន្ធនឹងព្យាយាមម្ដងទៀតដោយស្វ័យប្រវត្តិ។");
                return;
            }
            await fb.signOut(auth).catch(() => {});
            clearRememberedSession(true);
            showLoginModalWithPrefill();
            showToast("⚠️ មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិចូលប្រព័ន្ធបានទេ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងចូលម្តងទៀត។");
            return;
        }
        if (myAuthGeneration !== authGeneration) return;
        if (role !== 'admin') {
            await fb.signOut(auth).catch(() => {});
            clearRememberedSession(true);
            showLoginModalWithPrefill();
            showToast("⛔ គណនីនេះគ្មានសិទ្ធិចូល ZoeAdmin ទេ! សូមប្រើ ZoeW ឬ Zoescan ជំនួសវិញ។");
            return;
        }

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
        sessionStorage.setItem(AUTH_STUCK_RECOVERY_FLAG, '1');
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
                verifyAdminRoleThenProceed(user, myAuthGeneration);
            } else {
                pendingRoleRecheck = false;
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
                    localStorage.setItem('remembered_email', email);
                } else {
                    localStorage.removeItem('remembered_email');
                }

                if (authGeneration === generationAtLogin && userCredential && userCredential.user) {
                    authGeneration++;
                    verifyAdminRoleThenProceed(userCredential.user, authGeneration);
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
        if (isLoggedIn) {
            btn.textContent = '🚪 ចាកចេញ';
            btn.onclick = logoutApp;
        } else {
            btn.textContent = '🔑 ចូល';
            btn.onclick = showLoginModalWithPrefill;
        }
    }

    function logoutApp() {
        if (auth) {
            fb.signOut(auth).then(() => {
                clearRememberedSession(false);
                showLoginModalWithPrefill();
                showToast("បានចាកចេញពីប្រព័ន្ធ!");
            }).catch(() => {
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
                    item.barcodes = barcodeEntriesOf(item.barcodes).map(e => e.barcode);
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

    function updateRecentPhonesList() {
        const datalist = document.getElementById('recentPhonesList');
        if (!datalist) return;

        datalist.innerHTML = '';
        collectPhoneSuggestions('', RECENT_PHONES_MAX).forEach(entry => {
            const option = document.createElement('option');
            option.value = entry.phone;
            datalist.appendChild(option);
        });
    }

    const cleanupInFlight = new Set();

    function runAutomaticCleanupRules() {
        const currentTime = getServerNow();

        scanHistory.forEach(item => {
            if (!item.id) return;
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
        return retryAsync(() => fb.runTransaction(itemRef, (currentItem) => {
            normalizeBarcodesOf(currentItem);
            if (claimedWhole) {
                return currentItem || claimedWhole;
            }
            const reclaimed = barcodeEntriesOf(claimedPartial.barcodes).map(({ barcode }) => { const { isDeducted, ...rest } = barcode; return rest; });
            const base = currentItem || { ...claimedPartial, barcodes: [] };
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
        }), 3, 1500);
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

            if (claimedPartial && updatedRemainder) {
                syncScannerLookupEntry(id, updatedRemainder);
            } else {
                clearScannerLookupEntry(id);
            }

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
                    if (restoredItem) syncScannerLookupEntry(id, restoredItem);
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

    function runAutomaticDeletedCleanup() {
        const currentTime = getServerNow();
        let tenDaysMs = 10 * 24 * 60 * 60 * 1000;
        let purgedBarcodes = [];
        let purgedIds = [];

        deletedItems = deletedItems.filter(item => {
            let deletedTime = item.deletedAt || currentTime;
            const expired = (currentTime - deletedTime > tenDaysMs);
            if (expired) {
                purgedBarcodes = purgedBarcodes.concat(collectItemBarcodes(item));
                if (item.id) purgedIds.push(item.id);
            }
            return !expired;
        });

        if (purgedIds.length > 0) {
            deleteMultipleDeletedItemsFromFirebase(purgedIds)
                .then(() => releaseBarcodesInRegistry(purgedBarcodes))
                .catch(() => {});
        }
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
            .map((e) => e.barcode)
            .filter((b) => b && typeof b === 'object');
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
        if (window.ZoeErrors) ZoeErrors.init('zoeadmin');
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
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            sweepRecallHighlights();
            retryPendingRoleCheck();
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
        setupSwipeGestures();
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
            if (openModalEl) dismissModal(openModalEl);
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
                let data = dailyRevenueData[dateStr];
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
                let data = monthlyRevenueData[ym];
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

    function setupSwipeGestures() {
        const sidebar = document.getElementById('sidebarSection');
        const mainSection = document.getElementById('mainSection');
        const tableResponsive = document.getElementById('tableResponsive');
        const appContainer = document.getElementById('appContainer');
        if(!sidebar || !mainSection || !tableResponsive) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        function phoneSearchIsActive() {
            const box = document.getElementById('phoneSuggestBox');
            if (box && box.classList.contains('show')) return true;
            const input = document.getElementById('searchPhoneInput');
            return !!(input && document.activeElement === input && input.value.trim());
        }

        function syncPullToRefreshLock() {
            if (appContainer) {
                appContainer.classList.toggle('history-expanded', sidebar.classList.contains('collapsed'));
            }
        }

        tableResponsive.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        tableResponsive.addEventListener('touchmove', (e) => {
            currentY = e.touches[0].clientY;
            let diffY = currentY - startY;
            let scrollTop = tableResponsive.scrollTop;

            if (scrollTop === 0 && diffY > 30 && window.innerWidth < 992) {
                if (sidebar.classList.contains('collapsed')) {
                    sidebar.classList.remove('collapsed');
                    syncPullToRefreshLock();
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
            let diffY = currentY - startY;
            let scrollTop = tableResponsive.scrollTop;

            if (diffY < -30 && !sidebar.classList.contains('collapsed') && !phoneSearchIsActive()) {
                sidebar.classList.add('collapsed');
                syncPullToRefreshLock();
                isDragging = false;
            }
            else if (diffY > 30 && scrollTop <= 0 && sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                syncPullToRefreshLock();
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
                syncPullToRefreshLock();
            });
        }

        syncPullToRefreshLock();
    }

    function setupIOSPullToRefresh() {
        if (window.navigator.standalone !== true) return;

        const appContainer = document.getElementById('appContainer');
        const tableResponsive = document.getElementById('tableResponsive');
        if (!appContainer) return;

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
            if (isModalOpen || refreshing) return false;
            if (appContainer.classList.contains('history-expanded')) return false;
            if (appContainer.scrollTop > 0) return false;
            if (tableResponsive && tableResponsive.scrollTop > 0) return false;
            return true;
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

    function toggleHeaderMoreDropdown(event) {
        event.stopPropagation();
        const btn = event.currentTarget;
        const rect = btn.getBoundingClientRect();
        const menu = document.getElementById('globalMoreMenu');
        const container = document.getElementById('menuContentContainer');
        if(!menu || !container) return;

        container.innerHTML = `
            <button onclick="openExportDataModal(); document.getElementById('globalMoreMenu').classList.remove('show');">📤 Export Data</button>
            <button onclick="requestPinBeforeConfig(); document.getElementById('globalMoreMenu').classList.remove('show');">⚙️ Config / Reconfig</button>
            <button onclick="requestPinBeforeConfig(openLookupApiConfigModal); document.getElementById('globalMoreMenu').classList.remove('show');">🔌 API ស្វែងរកអតិថិជន</button>
            <button onclick="openCustomerDataTableModal(); document.getElementById('globalMoreMenu').classList.remove('show');">📊 តារាងអតិថិជន</button>
            <button onclick="openExchangeRateModal(); document.getElementById('globalMoreMenu').classList.remove('show');">💱 អត្រាប្រាក់ (${exchangeRateRiel}៛)</button>
            <button style="opacity:0.55; font-size:10.5px; border-top:1px dashed var(--border-color); margin-top:4px; padding-top:8px;" onclick="rebuildScannerLookupData(); document.getElementById('globalMoreMenu').classList.remove('show');">🔄 កំណត់ទិន្នន័យ Scanner Lookup ឡើងវិញ</button>
            <button class="delete-opt" onclick="clearHistory(); document.getElementById('globalMoreMenu').classList.remove('show');">❌ លុបទាំងអស់</button>
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
        return `ZoeAdmin_${label}_${getFormattedDate()}`.replace(/[^a-zA-Z0-9_\-]/g, '');
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
            <h2>ZoeAdmin — របាយការណ៍ប្រវត្តិកញ្ចប់ (${sanitizeInput(getCurrentFilterLabel())})</h2>
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

    function closeCameraManually() {
        stopCurrentStream();
        const permBox = document.getElementById('permission-box');
        const vidContainer = document.getElementById('video-container');
        if (vidContainer) vidContainer.style.display = 'none';
        if (permBox) {
            const msgEl = permBox.querySelector('p');
            const btnEl = permBox.querySelector('button');
            if (msgEl) msgEl.textContent = '📷 កាមេរ៉ាបានបិទ';
            if (btnEl) btnEl.textContent = '🔓 បើកកាមេរ៉ាម្តងទៀត';
            permBox.style.display = 'block';
        }
    }

    function setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && configQrScanActive) closeConfigQrScanner();
            if (document.hidden && isCameraScanning) {
                stopCurrentStream();
                const permBox = document.getElementById('permission-box');
                const vidContainer = document.getElementById('video-container');
                if (vidContainer) vidContainer.style.display = 'none';
                if (permBox) permBox.style.display = 'block';
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
        const sidebar = document.getElementById('sidebarSection');
        if (!sidebar) return;
        if (on && window.innerWidth >= 992) return;
        const already = sidebar.classList.contains('search-focus');
        if (already === !!on) return;
        sidebar.classList.toggle('search-focus', !!on);
        if (on) sidebar.classList.remove('collapsed');
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

    function buildScannerLookupPayload(item, omitClosedState) {
        const payload = {
            id: item.id,
            phone: item.phone || '',
            barcode: item.barcode || '',
            locker: item.locker || ''
        };
        if (!omitClosedState) payload.isClosed = !!item.isClosed;
        if (item.lockerUpdatedAt) payload.lockerUpdatedAt = item.lockerUpdatedAt;
        if (item.lockerUpdatedBy) payload.lockerUpdatedBy = item.lockerUpdatedBy;
        if (item.barcodes && Array.isArray(item.barcodes) && item.barcodes.length) {
            payload.barcodes = item.barcodes.map((b) => {
                if (!b) return omitClosedState ? { code: '', locker: '' } : { code: '', locker: '', isClosed: false };
                const bcEntry = { code: b.code || '', locker: b.locker || '' };
                if (!omitClosedState) bcEntry.isClosed = !!b.isClosed;
                if (b.lockerUpdatedAt) bcEntry.lockerUpdatedAt = b.lockerUpdatedAt;
                return bcEntry;
            });
        }
        return payload;
    }

    function syncScannerLookupEntry(itemId, item) {
        if (!db || !fb || !item || !itemId || !/^[a-zA-Z0-9_-]+$/.test(itemId)) return Promise.resolve();
        const entryRef = fb.ref(db, `zoew_scanner_lookup/${itemId}`);
        return fb.set(entryRef, buildScannerLookupPayload(item))
            .catch(() => fb.set(entryRef, buildScannerLookupPayload(item, true)))
            .catch((error) => {
                console.error('Error syncing scanner lookup entry:', error);
                if (window.ZoeErrors) ZoeErrors.capture(error, { context: 'Error syncing scanner lookup entry' });
            });
    }

    function clearScannerLookupEntry(itemId) {
        if (!db || !fb || !itemId || !/^[a-zA-Z0-9_-]+$/.test(itemId)) return Promise.resolve();
        return fb.set(fb.ref(db, `zoew_scanner_lookup/${itemId}`), null).catch((error) => {
            console.error('Error clearing scanner lookup entry:', error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: 'Error clearing scanner lookup entry' });
        });
    }

    function rebuildScannerLookupData() {
        if (!confirm("តើអ្នកពិតជាចង់កំណត់ទិន្នន័យ Scanner Lookup ឡើងវិញសម្រាប់ទិន្នន័យទាំងអស់មែនទេ? (ប្រើសម្រាប់ Sync ជាមួយ Zoescan តែម្តងគត់ មិនប៉ះពាល់ដល់ទិន្នន័យសំខាន់ទេ)")) return;
        let migratedCount = 0;
        scanHistory.forEach(item => {
            if (item && item.id) {
                syncScannerLookupEntry(item.id, item);
                migratedCount++;
            }
        });
        showToast(`✅ បាន Sync ទិន្នន័យ Scanner Lookup ចំនួន ${migratedCount} កំណត់ត្រាជោគជ័យ!`);
    }

    function triggerScanAction(barcode) {
        if (isModalOpen) return;

        let cleanBarcode = String(barcode || '').trim();
        if (!cleanBarcode) return;

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

        let phone = isSkip ? "គ្មានលេខ" : sanitizePhoneNumber(phoneEl ? phoneEl.value : '');
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
            localStorage.setItem('last_entered_locker', rawLocker);
        }

        const barcodeToSave = pendingBarcode;

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
            const claim = await withTimeout(claimBarcodeInRegistry(barcodeToSave), 15000, 'Barcode claim timed out');
            if (claim === 'taken') {
                closeModal('phoneModal');
                showToast(`⚠️ លេខ Barcode នេះ (${barcodeToSave}) ត្រូវបានបញ្ចូលរួចហើយ! (ប្រហែលមកពី device ផ្សេង) សូមស្កេនម្ដងទៀត។`);
                if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
                safeFocusScanner();
                return;
            }

            const historySnapshot = scanHistory.map(item => ({ ...item, barcodes: Array.isArray(item.barcodes) ? item.barcodes.map(b => ({ ...b })) : item.barcodes }));

            try {
                await withTimeout(addOrUpdateEntry(barcodeToSave, phone, cod, dod, locker), 15000, 'Save timed out');
            } catch (saveError) {
                if (claim === 'claimed') releaseBarcodesInRegistry([barcodeToSave]);
                scanHistory = historySnapshot;
                refreshCurrentHistoryView();
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

            const mergeScannedBarcodeInto = (target) => {
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
                .then((committedItem) => { syncScannerLookupEntry(item.id, committedItem || item); })
                .catch((err) => {
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
            savePromise = saveSingleHistoryItemToFirebase(newItem).catch(revertRevenueOnSaveFailure).then(() => { syncScannerLookupEntry(newItem.id, newItem); });
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

        const freshItem = scanHistory.find(i => i.id === itemId);
        if (!freshItem || !freshItem.barcodes) return;
        const freshBcIndex = freshItem.barcodes.findIndex(b => b.code === barcodeCode);
        if (freshBcIndex === -1) return;

        const historySnapshot = scanHistory.map(i => ({ ...i, barcodes: Array.isArray(i.barcodes) ? i.barcodes.map(b => ({ ...b })) : i.barcodes }));
        const deletedSnapshot = deletedItems.map(i => ({ ...i, barcodes: Array.isArray(i.barcodes) ? i.barcodes.map(b => ({ ...b })) : i.barcodes }));

        const removedBc = freshItem.barcodes.splice(freshBcIndex, 1)[0];

        let deductionApplied = false;
        let deductedCod = 0;
        let deductedDod = 0;
        const revenueScanDate = freshItem.scanDate || getFormattedDate();
        if (!removedBc.isDeducted) {
            deductedCod = parseFloat(removedBc.cod) || 0;
            deductedDod = parseFloat(removedBc.dod) || 0;

            addRevenueToDailyAndMonthlyRecord(revenueScanDate, -deductedCod, -deductedDod, -1);
            removedBc.isDeducted = true;
            deductionApplied = true;
        }

        removedBc.isFromDeletion = false;

        let itemToTrash = { ...freshItem, barcodes: [removedBc], count: 1 };
        itemToTrash.id = generateUniqueId();
        itemToTrash.deletedAt = getServerNow();
        itemToTrash.isFromDeletion = false;
        itemToTrash.cod = parseFloat(removedBc.cod) || 0;
        itemToTrash.dod = parseFloat(removedBc.dod) || 0;
        itemToTrash.price = Math.round((itemToTrash.cod + itemToTrash.dod) * 100) / 100;
        itemToTrash.barcode = removedBc.code;
        itemToTrash.locker = removedBc.locker || "N/A";
        itemToTrash.time = removedBc.time || freshItem.time;
        itemToTrash.isClosed = removedBc.isClosed || false;
        if (itemToTrash.isClosed) {
            itemToTrash.closedAt = freshItem.closedAt || getServerNow();
        } else {
            delete itemToTrash.closedAt;
        }
        deletedItems.unshift(itemToTrash);

        let wasFullyRemoved = false;
        if (freshItem.barcodes.length === 0) {
            const itemIndex = scanHistory.findIndex(i => i.id === itemId);
            if (itemIndex !== -1) {
                scanHistory.splice(itemIndex, 1);
            }
            closeModal('viewListModal');
            wasFullyRemoved = true;
        } else {
            freshItem.count = freshItem.barcodes.length;
            freshItem.cod = Math.round(freshItem.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
            freshItem.dod = Math.round(freshItem.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
            freshItem.price = Math.round((freshItem.cod + freshItem.dod) * 100) / 100;
            freshItem.barcode = freshItem.barcodes[0].code;
            freshItem.isClosed = freshItem.barcodes.length > 0 && freshItem.barcodes.every(b => b.isClosed);
            if (freshItem.isClosed) {
                if (!freshItem.closedAt) freshItem.closedAt = getServerNow();
            } else {
                delete freshItem.closedAt;
            }
            openViewListModal(itemId);
        }

        refreshCurrentHistoryView();

        try {
            const safeIdPattern = /^[a-zA-Z0-9_-]+$/;
            if (!itemId || !safeIdPattern.test(itemId) || !itemToTrash.id || !safeIdPattern.test(itemToTrash.id)) {
                throw new Error('Unsafe id during removeSingleBarcode');
            }
            await fb.update(fb.ref(db), {
                [`zoew_scan_history_cod_dod/${itemId}`]: wasFullyRemoved ? null : freshItem,
                [`zoew_recently_deleted_cod_dod/${itemToTrash.id}`]: itemToTrash
            });
            if (wasFullyRemoved) clearScannerLookupEntry(itemId);
            else syncScannerLookupEntry(itemId, freshItem);
            showToast("បានដកកញ្ចប់អីវ៉ាន់ និងកាត់ប្រាក់ចេញពីស្ថិតិរួចរាល់!");
        } catch (e) {
            console.error("Error removing single barcode: ", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Error removing single barcode: " });
            if (deductionApplied) {
                addRevenueToDailyAndMonthlyRecord(revenueScanDate, deductedCod, deductedDod, 1);
            }
            scanHistory = historySnapshot;
            deletedItems = deletedSnapshot;
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
                if (!currentItem) return currentItem;
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
                b.isClosed = desiredClosed;
                const allClosed = currentItem.barcodes.every(bc => bc.isClosed);
                currentItem.isClosed = allClosed;
                if (allClosed) currentItem.closedAt = getServerNow();
                else delete currentItem.closedAt;
                if (desiredClosed) {
                    delete currentItem.callMark;
                    delete currentItem.callMarkTime;
                }
                return currentItem;
            });
            const committedItem = (barcodeCloseResult && barcodeCloseResult.committed && barcodeCloseResult.snapshot) ? barcodeCloseResult.snapshot.val() : null;
            if (committedItem) {
                if (!committedItem.id) committedItem.id = itemId;
                syncScannerLookupEntry(itemId, committedItem);
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

                targetB.cod = newCod;
                targetB.dod = newDod;

                item.cod = Math.round(item.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                item.dod = Math.round(item.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                item.price = Math.round((item.cod + item.dod) * 100) / 100;

                const revenueScanDate = item.scanDate || getFormattedDate();
                const revenueApplied = (codDiff !== 0 || dodDiff !== 0);
                if (revenueApplied) {
                    addRevenueToDailyAndMonthlyRecord(revenueScanDate, codDiff, dodDiff, 0);
                }

                const editedItemId = item.id;
                const editedBarcodeCode = activeEditingBarcode;
                saveSingleHistoryItemToFirebase(item).catch(() => {
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
                });
                refreshCurrentHistoryView();
                showToast("បានកែប្រែទឹកប្រាក់តាមកញ្ចប់ជោគជ័យ!");
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
        let newPhone = sanitizePhoneNumber(editPhoneInput ? editPhoneInput.value : '');
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
            patchHistoryItemFields(item, patchFields, previousFields).then((saved) => {
                if (saved) syncScannerLookupEntry(item.id, item);
                else revertPickupRefMove();
            }).catch(revertPickupRefMove);
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
                if (!currentItem) return currentItem;
                normalizeBarcodesOf(currentItem);
                currentItem.isClosed = desiredClosed;
                if (desiredClosed) {
                    currentItem.closedAt = getServerNow();
                    delete currentItem.callMark;
                    delete currentItem.callMarkTime;
                    if (currentItem.barcodes && Array.isArray(currentItem.barcodes)) {
                        currentItem.barcodes.forEach(b => b.isClosed = true);
                    }
                } else {
                    delete currentItem.closedAt;
                    if (currentItem.barcodes && Array.isArray(currentItem.barcodes)) {
                        currentItem.barcodes.forEach(b => b.isClosed = false);
                    }
                }
                return currentItem;
            });
            const committedItem = (closeResult && closeResult.committed && closeResult.snapshot) ? closeResult.snapshot.val() : null;
            if (committedItem) {
                if (!committedItem.id) committedItem.id = id;
                syncScannerLookupEntry(id, committedItem);
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

        const historySnapshot = scanHistory.map(i => ({ ...i, barcodes: Array.isArray(i.barcodes) ? i.barcodes.map(b => ({ ...b })) : i.barcodes }));
        const deletedSnapshot = deletedItems.map(i => ({ ...i, barcodes: Array.isArray(i.barcodes) ? i.barcodes.map(b => ({ ...b })) : i.barcodes }));

        let removed = scanHistory.splice(index, 1)[0];
        removed.deletedAt = getServerNow();
        removed.isFromDeletion = true;
        if (removed.barcodes && Array.isArray(removed.barcodes)) {
            removed.barcodes = removed.barcodes.map(b => ({ ...b, isFromDeletion: true }));
        }

        deletedItems.unshift(removed);

        refreshCurrentHistoryView();
        updateRecentPhonesList();

        try {
            const safeIdPattern = /^[a-zA-Z0-9_-]+$/;
            if (!id || !safeIdPattern.test(id) || !removed.id || !safeIdPattern.test(removed.id)) {
                throw new Error('Unsafe id during deleteSingleItem');
            }
            await fb.update(fb.ref(db), {
                [`zoew_scan_history_cod_dod/${id}`]: null,
                [`zoew_recently_deleted_cod_dod/${removed.id}`]: removed
            });
            clearScannerLookupEntry(id);
            showToast("បានលុបទៅធុងសំរាមបណ្តោះអាសន្ន!");
        } catch (e) {
            console.error("Error deleting single item: ", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Error deleting single item: " });
            scanHistory = historySnapshot;
            deletedItems = deletedSnapshot;
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

        deletedItems.forEach((item) => {
            let deleteTypeLabel = item.isFromDeletion ? "លុបទាំងមូល" : "ដកកញ្ចប់";
            let displayCode = item.barcodes && item.barcodes.length > 0 ? item.barcodes[0].code : item.barcode;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${sanitizeInput(item.phone)}</strong><br><small style="color:var(--text-muted);">${deleteTypeLabel}</small></td>
                <td><span class="barcode-tag">${sanitizeInput(displayCode)}</span></td>
                <td style="text-align: center;">
                    <div style="display:flex; gap:4px; justify-content:center;">
                        <button class="btn-sm" style="background:#10b981; color:white; padding:4px 8px; min-height:26px;" onclick="promptRestoreDeletedItem('${escapeForInlineJsAttr(item.id)}')">🔄</button>
                        <button class="btn-sm" style="background:#ef4444; color:white; padding:4px 8px; min-height:26px;" onclick="promptPermanentDelete('${escapeForInlineJsAttr(item.id)}')">✖️</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
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

    async function executeRestoreItem() {
        if (!pendingRestoreId) return;
        const index = deletedItems.findIndex(i => i.id === pendingRestoreId);
        if(index === -1) {
            closeModal('restoreWarningModal');
            alert("⚠️ រកមិនឃើញទិន្នន័យនេះក្នុងធុងសំរាមទេ (វាអាចត្រូវបានស្តារ ឬលុបចោលរួចហើយពី device ផ្សេង)");
            pendingRestoreId = null;
            openRecentlyDeletedModal();
            return;
        }

        let itemToRestore = deletedItems.splice(index, 1)[0];
        const restoredWasRemoved = itemToRestore.isFromDeletion === false;
        delete itemToRestore.deletedAt;
        delete itemToRestore.isFromDeletion;
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
                    addRevenueToDailyAndMonthlyRecord(revenueScanDate, targetCod, targetDod, 1);
                    appliedRevenueDeltas.push({ scanDate: revenueScanDate, cod: targetCod, dod: targetDod, count: 1 });
                    restoredBc.isDeducted = false;
                }
                restoredBc.isFromDeletion = false;
            });
        } else if (restoredWasRemoved) {
            const legacyCod = parseFloat(itemToRestore.cod) || 0;
            const legacyDod = parseFloat(itemToRestore.dod) || 0;
            const legacyCount = parseFloat(itemToRestore.count) || 1;
            addRevenueToDailyAndMonthlyRecord(revenueScanDate, legacyCod, legacyDod, legacyCount);
            appliedRevenueDeltas.push({ scanDate: revenueScanDate, cod: legacyCod, dod: legacyDod, count: legacyCount });
        }

        let existingItemIndex = scanHistory.findIndex(i => i.id === itemToRestore.id || (itemToRestore.phone !== "គ្មានលេខ" && i.phone === itemToRestore.phone && itemToRestore.barcodes && i.barcodes && i.scanDate === itemToRestore.scanDate && !i.isClosed));

        let resultingLiveItem;
        if (existingItemIndex !== -1) {
            let targetItem = scanHistory[existingItemIndex];
            if (!targetItem.barcodes) targetItem.barcodes = [];

            if (itemToRestore.barcodes && Array.isArray(itemToRestore.barcodes)) {
                itemToRestore.barcodes.forEach(restoredBc => {
                    targetItem.barcodes.push(restoredBc);
                });
            }

            targetItem.count = targetItem.barcodes.length;
            targetItem.cod = Math.round(targetItem.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
            targetItem.dod = Math.round(targetItem.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
            targetItem.price = Math.round((targetItem.cod + targetItem.dod) * 100) / 100;
            targetItem.isClosed = targetItem.barcodes.length > 0 && targetItem.barcodes.every(b => b.isClosed);
            if (targetItem.isClosed) {
                targetItem.closedAt = getServerNow();
            } else {
                delete targetItem.closedAt;
            }

            if (itemToRestore.callMarkTime && (!targetItem.callMarkTime || itemToRestore.callMarkTime > targetItem.callMarkTime)) {
                targetItem.isCalled = itemToRestore.isCalled;
                if (itemToRestore.callMark) targetItem.callMark = itemToRestore.callMark;
                else delete targetItem.callMark;
                targetItem.callMarkTime = itemToRestore.callMarkTime;
            }

            resultingLiveItem = targetItem;
        } else {
            scanHistory.push(itemToRestore);
            resultingLiveItem = itemToRestore;
        }

        const restoredId = pendingRestoreId;
        closeModal('restoreWarningModal');
        pendingRestoreId = null;

        try {
            const safeIdPattern = /^[a-zA-Z0-9_-]+$/;
            if (!resultingLiveItem.id || !safeIdPattern.test(resultingLiveItem.id) || !itemToRestore.id || !safeIdPattern.test(itemToRestore.id)) {
                throw new Error('Unsafe id during restore');
            }
            await fb.update(fb.ref(db), {
                [`zoew_scan_history_cod_dod/${resultingLiveItem.id}`]: resultingLiveItem,
                [`zoew_recently_deleted_cod_dod/${itemToRestore.id}`]: null
            });
            syncScannerLookupEntry(resultingLiveItem.id, resultingLiveItem);
            openRecentlyDeletedModal();
            refreshCurrentHistoryView();
            updateRecentPhonesList();
            showToast("បានស្តារទិន្នន័យមកទីតាំងដើមវិញដោយសុវត្ថិភាព!");
        } catch (error) {
            appliedRevenueDeltas.forEach((d) => addRevenueToDailyAndMonthlyRecord(d.scanDate, -d.cod, -d.dod, -d.count));
            console.error("Restore failed: ", restoredId, error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Restore failed: " });
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
            alert("❌ ស្តារទិន្នន័យបរាជ័យ! មូលហេតុ: " + (error && error.message ? error.message : error) + "\n\nសូមថតរូបអេក្រង់នេះ ហើយផ្ញើសួរអ្នកបច្ចេកទេស។");
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

    function patchHistoryItemFields(item, fields, previousFields) {
        if (!dbRefHistory) return Promise.resolve(false);
        if (!item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) {
            const err = new Error('Refusing to patch history item with missing/unsafe id');
            console.error(err.message, item && item.id);
            if (window.ZoeErrors) ZoeErrors.capture(err, { context: 'patchHistoryItemFields' });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! (ID មិនត្រឹមត្រូវ)");
            return Promise.resolve(false);
        }
        const updates = {};
        Object.keys(fields).forEach(key => {
            updates[`${item.id}/${key}`] = fields[key];
        });
        return fb.update(dbRefHistory, updates).then(() => true).catch((error) => {
            console.error("Error patching history item: ", error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error patching history item: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! កំពុងត្រឡប់ស្ថានភាពដើមវិញ...");
            if (previousFields) {
                const revertItem = scanHistory.find(i => i.id === item.id);
                if (revertItem) {
                    Object.keys(previousFields).forEach((key) => {
                        if (previousFields[key] === undefined) delete revertItem[key];
                        else revertItem[key] = previousFields[key];
                    });
                    refreshCurrentHistoryView();
                }
            }
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

    async function clearHistory() {
        if (!confirm("តើអ្នកពិតជាចង់លុបប្រវត្តិទាំងអស់មែនទេ?")) return;

        const clearedIds = scanHistory.map(item => item.id).filter(Boolean);
        if (clearedIds.length === 0) return;

        const historySnapshot = scanHistory.map(i => ({ ...i, barcodes: Array.isArray(i.barcodes) ? i.barcodes.map(b => ({ ...b })) : i.barcodes }));
        const deletedSnapshot = deletedItems.map(i => ({ ...i, barcodes: Array.isArray(i.barcodes) ? i.barcodes.map(b => ({ ...b })) : i.barcodes }));

        const clearedItems = scanHistory.map(item => {
            item.deletedAt = getServerNow();
            item.isFromDeletion = true;
            if (item.barcodes && Array.isArray(item.barcodes)) {
                item.barcodes = item.barcodes.map(b => ({ ...b, isFromDeletion: true }));
            }
            return item;
        });
        clearedItems.forEach(item => deletedItems.unshift(item));
        scanHistory = [];
        refreshCurrentHistoryView();
        updateRecentPhonesList();

        try {
            const safeIdPattern = /^[a-zA-Z0-9_-]+$/;
            const updates = {};
            clearedItems.forEach(item => {
                if (!item.id || !safeIdPattern.test(item.id)) {
                    throw new Error('Unsafe id during clearHistory');
                }
                updates[`zoew_scan_history_cod_dod/${item.id}`] = null;
                updates[`zoew_recently_deleted_cod_dod/${item.id}`] = item;
            });
            await fb.update(fb.ref(db), updates);
            clearedIds.forEach(id => clearScannerLookupEntry(id));
            showToast("បានលុបប្រវត្តិទាំងអស់!");
        } catch (error) {
            console.error("Error clearing history: ", error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error clearing history: " });
            scanHistory = historySnapshot;
            deletedItems = deletedSnapshot;
            refreshCurrentHistoryView();
            updateRecentPhonesList();
            showToast("⚠️ លុបប្រវត្តិទាំងអស់មិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ សូមសាកល្បងម្តងទៀត។");
        }
    }
