    (function () {
        function kickUserOut() {
            window.location.replace("about:blank");
        }

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        let devToolsHitCount = 0;
        let consoleTrapHitCount = 0;

        document.addEventListener('keydown', function (e) {
            if (
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c' || e.key === 'K' || e.key === 'k')) ||
                (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's')) ||
                (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c' || e.key === 'U' || e.key === 'u' || e.key === 'K' || e.key === 'k'))
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

        function checkDevTools() {
            if (isMobile) return;
            const widthThreshold = window.outerWidth - window.innerWidth > 160;
            const heightThreshold = window.outerHeight - window.innerHeight > 160;
            if (widthThreshold || heightThreshold) {
                devToolsHitCount++;
                if (devToolsHitCount >= 2) {
                    kickUserOut();
                }
            } else {
                devToolsHitCount = 0;
            }
        }

        function secureDebugger() {
            if (isMobile) return;
            function probe() {
                debugger;
            }
            function loop() {
                const startTime = performance.now();
                try {
                    probe();
                } catch(e) {}
                const endTime = performance.now();
                if (endTime - startTime > 1000) {
                    kickUserOut();
                }
            }
            setInterval(loop, 1000);
        }

        function checkConsoleTrap() {
            if (isMobile) return;
            let triggered = false;
            const bait = new Image();
            Object.defineProperty(bait, 'id', {
                get() {
                    triggered = true;
                    return '';
                }
            });
            console.log(bait);
            console.clear();
            if (triggered) {
                consoleTrapHitCount++;
                if (consoleTrapHitCount >= 2) {
                    kickUserOut();
                }
            } else {
                consoleTrapHitCount = 0;
            }
        }

        setInterval(checkDevTools, 1000);
        setInterval(checkConsoleTrap, 1000);
        secureDebugger();
    })();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(() => {});
        });
        let swReloadedOnce = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (swReloadedOnce) return;
            swReloadedOnce = true;
            window.location.reload();
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
    let dbRefExchangeRate = null;
    let dbRefConnected = null;
    let authUnsubscribe = null;

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
    let lastSyncedHistoryKeys = new Set();
    let lastSyncedDeletedKeys = new Set();
    let isInitializingFirebase = false;
    let dailyRevenueData = {};
    let monthlyRevenueData = {};
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

    let nativeDetector = null;
    let isModalOpen = false; 
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
            let timer = null;
            const onReady = () => {
                clearTimeout(timer);
                resolve(window.firebaseSDK);
            };
            window.addEventListener('firebasesdkready', onReady, { once: true });
            timer = setTimeout(() => {
                window.removeEventListener('firebasesdkready', onReady);
                if (window.firebaseSDK) resolve(window.firebaseSDK);
                else reject(new Error('Firebase SDK failed to load (network/CDN issue)'));
            }, timeoutMs);
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
                if (dbRefExchangeRate) { try { fb.off(dbRefExchangeRate); } catch (e) {} }
                if (dbRefConnected) { try { fb.off(dbRefConnected); } catch (e) {} }
                isDatabaseInitialized = false;
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
            dbRefExchangeRate = fb.ref(db, 'zoew_settings/exchange_rate');
            dbRefConnected = fb.ref(db, '.info/connected');

            // Wired up here (immediately once db exists) rather than inside
            // initDatabaseListeners(), which only runs after login + role-check +
            // license-check all resolve — those async round trips could take a few
            // seconds, during which the dot would otherwise sit on its default
            // "offline" HTML state and misreport connectivity that was fine the
            // whole time.
            fb.onValue(dbRefConnected, (snap) => {
                const statusDot = document.getElementById('statusDot');
                const statusText = document.getElementById('firebaseStatusText');
                const online = snap.val() === true;
                if (statusDot) statusDot.classList.toggle('offline', !online);
                if (statusText) statusText.innerText = online ? "ភ្ជាប់ Server រួចរាល់" : "ក្រៅបណ្ដាញ";
            });

            setupAuthListener();
            return true;
        } catch (e) {
            console.error("Invalid Saved Config", e);
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
        openModalHelper('configModal');
    }

    function saveFirebaseConfig() {
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

    async function testLookupApiConfig() {
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
        try {
            const res = await fetch(testUrl, { headers });
            const text = await res.text();
            alert("ស្ថានភាព HTTP៖ " + res.status + "\n\nលទ្ធផល JSON (ប្រើដើម្បីដឹងឈ្មោះ Field)៖\n" + text.substring(0, 1500));
        } catch (e) {
            alert("❌ បរាជ័យក្នុងការភ្ជាប់៖ " + e.message);
        }
    }

    function getNestedField(obj, path) {
        if (!obj || !path) return null;
        return path.split('.').reduce((acc, key) => (acc !== null && acc !== undefined && acc[key] !== undefined) ? acc[key] : null, obj);
    }

    let lookupLockedNoticeShown = false;

    async function attemptAutoLookup(barcode) {
        const cfg = getLookupApiConfig();
        if (!cfg || !cfg.enabled || !cfg.url) return;

        // The header secret is AES-GCM encrypted with a key derived from the Security PIN,
        // and that key only ever lives in memory for the current tab (never persisted) — it's
        // set when the PIN is entered via requestPinBeforeConfig(), not on ordinary
        // login/auto-login. So right after a fresh login (or a page refresh, which always
        // restarts with lookupSecretKey === null), a scan here would silently omit the auth
        // header, the request would most likely fail server-side, and admin would just see
        // "no auto-fill" with zero explanation. Surface it once instead of failing silently.
        if (cfg.headerName && cfg.headerValueEnc && !lookupSecretKey) {
            if (!lookupLockedNoticeShown) {
                lookupLockedNoticeShown = true;
                showToast("🔒 ស្វែងរកអតិថិជនស្វ័យប្រវត្តិត្រូវការ Config PIN — សូមបើក ⚙️ Config ១ដងដើម្បីដោះសោសម្រាប់វគ្គនេះ");
            }
            return;
        }

        try {
            const targetUrl = cfg.url.replace('{barcode}', encodeURIComponent(barcode));
            const headers = {};
            if (cfg.headerName && cfg.headerValueEnc) {
                const decrypted = await decryptLookupSecret(cfg.headerValueEnc);
                if (decrypted) headers[cfg.headerName] = decrypted;
            } else if (cfg.headerName && cfg.headerValue) {
                headers[cfg.headerName] = cfg.headerValue;
            }

            const res = await fetch(targetUrl, { headers });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();

            if (pendingBarcode !== barcode || !isModalOpen) return;

            let filledAny = false;

            const phoneVal = getNestedField(data, cfg.phoneField);
            const phoneEl = document.getElementById('modalPhoneInput');
            if (phoneVal && phoneEl && !phoneEl.value) {
                phoneEl.value = String(phoneVal).trim().replace(/^(\+?855-?)/, '0');
                filledAny = true;
            }

            const codVal = getNestedField(data, cfg.codField);
            const codEl = document.getElementById('modalCodInput');
            if (codVal !== null && codVal !== undefined && !isNaN(parseFloat(codVal)) && codEl && !codEl.value) {
                codEl.value = parseFloat(codVal);
                filledAny = true;
            }

            const dodVal = getNestedField(data, cfg.dodField);
            const dodEl = document.getElementById('modalDodInput');
            if (dodVal !== null && dodVal !== undefined && !isNaN(parseFloat(dodVal)) && dodEl && !dodEl.value) {
                dodEl.value = parseFloat(dodVal);
                filledAny = true;
            }

            if (filledAny) showToast("✅ បានទាញយកទិន្នន័យអតិថិជនស្វ័យប្រវត្តិ!");
        } catch (e) {
            console.error("Lookup API error:", e);
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
        applyCurrentFilter();
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
            return (Date.now() - authTimeMs) > FOUR_HOURS_MS;
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

    function showLoginModalWithPrefill() {
        closeModal('activationModal');
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
                : 'សូមបញ្ចូល Activation Key សម្រាប់ ZoeAdmin ដើម្បីបន្ត។';
        }
        openModalHelper('activationModal');
        const keyInput = document.getElementById('activationKeyInput');
        if (keyInput) keyInput.focus();
        return false;
    }

    async function submitActivationKey() {
        const input = document.getElementById('activationKeyInput');
        const keyStr = input ? input.value.trim() : '';
        if (!keyStr) { alert('សូមបញ្ចូល Activation Key!'); return; }
        const result = await ZoeLicense.activate(keyStr, LICENSE_APP_CODE);
        if (!result.valid) {
            alert(licenseFailureMessage(result.reason));
            return;
        }
        if (input) input.value = '';
        const activated = await ensureAppActivated();
        if (activated) {
            showToast("✅ Active ជោគជ័យ!");
            if (!isDatabaseInitialized) {
                initDatabaseListeners();
                isDatabaseInitialized = true;
            }
            safeFocusScanner();
        }
    }

    async function verifyAdminRoleThenProceed(user) {
        let role;
        try {
            const roleSnap = await fb.get(fb.ref(db, `user_roles/${user.uid}`));
            role = roleSnap.val();
        } catch (e) {
            // Fail CLOSED, not open: if we can't confirm the role, we must not assume
            // it's fine and fall through to granting access -- that's the exact hole
            // this check exists to close.
            console.error("Role verification failed:", e);
            await fb.signOut(auth).catch(() => {});
            clearRememberedSession(true);
            showLoginModalWithPrefill();
            showToast("⚠️ មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិចូលប្រព័ន្ធបានទេ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងចូលម្តងទៀត។");
            return;
        }
        if (role !== 'admin') {
            await fb.signOut(auth).catch(() => {});
            clearRememberedSession(true);
            showLoginModalWithPrefill();
            showToast("⛔ គណនីនេះគ្មានសិទ្ធិចូល ZoeAdmin ទេ! សូមប្រើ ZoeW ឬ Zscan ជំនួសវិញ។");
            return;
        }

        const activated = await ensureAppActivated();
        if (!activated) {
            closeModal('loginModal');
            return;
        }

        closeModal('loginModal');
        showToast("ចូលប្រព័ន្ធជោគជ័យ!");

        if (!isDatabaseInitialized) {
            initDatabaseListeners();
            isDatabaseInitialized = true;
        }
        safeFocusScanner();

        isFirebaseSessionExpired(user).then((expired) => {
            if (expired) forceExpireSession();
        });
    }

    function setupAuthListener() {
        if (!auth) return;

        if (authUnsubscribe) {
            try { authUnsubscribe(); } catch (e) {}
            authUnsubscribe = null;
        }

        authUnsubscribe = fb.onAuthStateChanged(auth, (user) => {
            if (user) {
                autoLoginAttempted = false;
                verifyAdminRoleThenProceed(user);
            } else {
                if (isDatabaseInitialized) {
                    if (dbRefDailyRevenue) fb.off(dbRefDailyRevenue);
                    if (dbRefMonthlyRevenue) fb.off(dbRefMonthlyRevenue);
                    if (dbRefHistory) fb.off(dbRefHistory);
                    if (dbRefDeleted) fb.off(dbRefDeleted);
                    if (dbRefExchangeRate) fb.off(dbRefExchangeRate);
                    if (dbRefConnected) fb.off(dbRefConnected);
                    isDatabaseInitialized = false;
                }

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
            })
            .catch((error) => {
                alert("ការចូលប្រព័ន្ធមិនជោគជ័យ៖ " + error.message);
            });
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

    function initDatabaseListeners() {
        if (!db) return;

        if (isDatabaseInitialized) {
            if (dbRefDailyRevenue) fb.off(dbRefDailyRevenue);
            if (dbRefMonthlyRevenue) fb.off(dbRefMonthlyRevenue);
            if (dbRefHistory) fb.off(dbRefHistory);
            if (dbRefDeleted) fb.off(dbRefDeleted);
            if (dbRefExchangeRate) fb.off(dbRefExchangeRate);
        }

        // dbRefConnected's listener is wired up in initFirebase() itself, immediately
        // once db exists, so the status dot reflects real connectivity from page load
        // instead of sitting on its default "offline" markup until login finishes.

        if (dbRefExchangeRate) {
            fb.onValue(dbRefExchangeRate, (snapshot) => {
                const val = snapshot.val();
                if (val && !isNaN(val)) {
                    exchangeRateRiel = parseFloat(val);
                    localStorage.setItem('zoew_exchange_rate', exchangeRateRiel);
                    applyCurrentFilter();
                }
            });
        }

        fb.onValue(dbRefDailyRevenue, (snapshot) => {
            dailyRevenueData = snapshot.val() || {};
            applyCurrentFilter();
        });

        fb.onValue(dbRefMonthlyRevenue, (snapshot) => {
            monthlyRevenueData = snapshot.val() || {};
        });

        fb.onValue(dbRefHistory, (snapshot) => {
            const data = snapshot.val();
            if (!data) scanHistory = [];
            else if (Array.isArray(data)) scanHistory = data.filter(item => item !== null);
            else scanHistory = Object.keys(data).map(key => { const v = data[key]; if (v && !v.id) v.id = key; return v; });

            scanHistory.forEach(item => { 
                if(!item.id) item.id = generateUniqueId();
                if (!item.createdAt) {
                    item.createdAt = parseTimestampFromId(item.id) || Date.now();
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

                if (item.barcodes && Array.isArray(item.barcodes)) {
                    item.barcodes.forEach(b => {
                        b.cod = parseFloat(b.cod) || 0;
                        b.dod = parseFloat(b.dod) || 0;
                        if (b.isDeducted === undefined) b.isDeducted = false;
                    });
                }
            });

            lastSyncedHistoryKeys = new Set(scanHistory.map(item => item.id).filter(Boolean));

            runAutomaticCleanupRules();
            applyCurrentFilter();
            updateRecentPhonesList();
        });

        fb.onValue(dbRefDeleted, (snapshot) => {
            const data = snapshot.val();
            if (!data) deletedItems = [];
            else if (Array.isArray(data)) deletedItems = data.filter(item => item !== null);
            else deletedItems = Object.keys(data).map(key => { const v = data[key]; if (v && !v.id) v.id = key; return v; });

            deletedItems.forEach(item => {
                if(!item.id) item.id = generateUniqueId();
                if (!item.createdAt) {
                    item.createdAt = parseTimestampFromId(item.id) || Date.now();
                }
            });
            lastSyncedDeletedKeys = new Set(deletedItems.map(item => item.id).filter(Boolean));
            runAutomaticDeletedCleanup();
        });

        isDatabaseInitialized = true;
    }

    function updateRecentPhonesList() {
        const datalist = document.getElementById('recentPhonesList');
        if (!datalist) return;
        
        let phonesSet = new Set();
        scanHistory.forEach(item => {
            if (item.phone && item.phone !== "គ្មានលេខ") {
                phonesSet.add(item.phone);
            }
        });

        datalist.innerHTML = '';
        Array.from(phonesSet).slice(0, 30).forEach(phone => {
            const option = document.createElement('option');
            option.value = phone;
            datalist.appendChild(option);
        });
    }

    const cleanupInFlight = new Set();

    function runAutomaticCleanupRules() {
        const currentTime = Date.now();

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

    async function claimAndCleanupItem(id, reason) {
        if (!db || !id || !/^[a-zA-Z0-9_-]+$/.test(id) || cleanupInFlight.has(id)) return;
        cleanupInFlight.add(id);

        let claimedWhole = null;
        let claimedPartial = null;
        try {
            const itemRef = fb.ref(db, `zoew_scan_history_cod_dod/${id}`);
            const result = await fb.runTransaction(itemRef, (currentItem) => {
                claimedWhole = null;
                claimedPartial = null;
                if (!currentItem) return currentItem;
                const ts = currentItem.createdAt || parseTimestampFromId(id) || Date.now();

                if (reason === 'abandon') {
                    if (currentItem.isClosed || (Date.now() - ts) <= EIGHT_DAYS_MS) return currentItem;

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
                        if (!updated.closedAt) updated.closedAt = Date.now();
                        return updated;
                    }

                    claimedWhole = currentItem;
                    return null;
                } else {
                    if (!currentItem.isClosed || !currentItem.closedAt || (Date.now() - currentItem.closedAt) <= TWO_HOURS_MS) return currentItem;
                    claimedWhole = currentItem;
                    return null;
                }
            });

            if (!result.committed || (!claimedWhole && !claimedPartial)) return;

            let trashItem;
            if (claimedPartial) {
                trashItem = { ...claimedPartial, id: generateUniqueId() };
                trashItem.barcodes = trashItem.barcodes.map(b => ({ ...b, isDeducted: true }));
                trashItem.count = trashItem.barcodes.length;
                trashItem.cod = Math.round(trashItem.barcodes.reduce((s, b) => s + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                trashItem.dod = Math.round(trashItem.barcodes.reduce((s, b) => s + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                trashItem.price = Math.round((trashItem.cod + trashItem.dod) * 100) / 100;
                trashItem.barcode = trashItem.barcodes[0].code;
                trashItem.isClosed = false;
                delete trashItem.closedAt;
                trashItem.deletedAt = Date.now();
                trashItem.isFromDeletion = false;
                addRevenueToDailyAndMonthlyRecord(trashItem.scanDate || getFormattedDate(), -trashItem.cod, -trashItem.dod, -trashItem.count);
            } else {
                trashItem = { ...claimedWhole, id };
                trashItem.deletedAt = Date.now();

                if (reason === 'abandon') {
                    trashItem.isFromDeletion = false;
                    if (trashItem.barcodes && Array.isArray(trashItem.barcodes)) {
                        trashItem.barcodes = trashItem.barcodes.map(b => ({ ...b, isDeducted: true }));
                    }
                    let targetCod = parseFloat(trashItem.cod) || 0;
                    let targetDod = parseFloat(trashItem.dod) || 0;
                    let targetCount = trashItem.barcodes && Array.isArray(trashItem.barcodes) ? trashItem.barcodes.length : (parseFloat(trashItem.count) || 1);
                    addRevenueToDailyAndMonthlyRecord(trashItem.scanDate || getFormattedDate(), -targetCod, -targetDod, -targetCount);
                } else {
                    trashItem.isFromDeletion = true;
                }
            }

            deletedItems.unshift(trashItem);
            saveSingleDeletedItemToFirebase(trashItem).catch(() => {});
        } catch (e) {
            console.error('Automatic cleanup transaction failed for', id, e);
        } finally {
            cleanupInFlight.delete(id);
        }
    }

    function runAutomaticDeletedCleanup() {
        const currentTime = Date.now();
        let tenDaysMs = 10 * 24 * 60 * 60 * 1000;
        let initialLen = deletedItems.length;
        let purgedBarcodes = [];

        deletedItems = deletedItems.filter(item => {
            let deletedTime = item.deletedAt || currentTime;
            const expired = (currentTime - deletedTime > tenDaysMs);
            if (expired) purgedBarcodes = purgedBarcodes.concat(collectItemBarcodes(item));
            return !expired;
        });

        if (deletedItems.length !== initialLen) {
            saveDeletedToFirebase();
            // Frees the barcode(s) up for reuse now that they're gone for good -- matches
            // isBarcodeAlreadyUsed()'s own rule that a barcode stays claimed as long as it's
            // in scanHistory OR deletedItems, not just scanHistory.
            releaseBarcodesInRegistry(purgedBarcodes);
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
        const toast = document.getElementById("toast");
        if(!toast) return;
        toast.innerText = msg;
        toast.className = "show";
        setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2500);
    }

    function getFormattedDate(d = new Date()) {
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
        initFirebase();

        setInterval(async () => {
            if (auth && auth.currentUser) {
                if (await isFirebaseSessionExpired(auth.currentUser)) {
                    forceExpireSession();
                }
            }
        }, 60000);

        // Revoking/expiring a key in ZoeKeyGen must not sit unnoticed for the rest of an
        // already-open session — ensureAppActivated() is otherwise only called at login, so a
        // device left running (common for a fixed scanning station) would keep working until
        // someone happens to reload it. Re-checking periodically closes that gap. Skipped
        // while any other modal is open (e.g. mid-scan phoneModal entry) so the full-screen
        // activationModal can't pop over it and bury in-progress, unsaved input; it just
        // tries again on the next tick instead.
        setInterval(() => {
            if (auth && auth.currentUser && isDatabaseInitialized && !isModalOpen) {
                ensureAppActivated();
            }
        }, LICENSE_RECHECK_INTERVAL_MS);

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
        }

        if ('BarcodeDetector' in window) {
            try {
                nativeDetector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'] });
            } catch (e) {
                nativeDetector = null;
            }
        }

        setupHardwareScanner();
        setupSwipeGestures();
        setupVisibilityHandling();
        updateRecentPhonesList();

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
            const openModalEl = Array.from(document.querySelectorAll('.modal')).find(m => m.style.display === 'flex');
            if (openModalEl) dismissModal(openModalEl);
        });
    });

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
        const dateRef = fb.ref(db, `zoew_daily_revenue_cod_dod/${scanDateStr}`);
        fb.runTransaction(dateRef, (current) => {
            let codDollar = Math.round(((parseFloat(current && current.codDollar) || 0) + (parseFloat(codToAdd) || 0)) * 100) / 100;
            let dodDollar = Math.round(((parseFloat(current && current.dodDollar) || 0) + (parseFloat(dodToAdd) || 0)) * 100) / 100;
            let totalCount = (parseFloat(current && current.totalCount) || 0) + (parseFloat(countToAdd) || 0);
            if (codDollar < 0) codDollar = 0;
            if (dodDollar < 0) dodDollar = 0;
            if (totalCount < 0) totalCount = 0;
            return { codDollar, dodDollar, totalCount };
        }).catch(() => {
            showToast("⚠️ បរាជ័យក្នុងការ Save Daily Revenue!");
        });
    }

    function commitMonthlyRevenueDelta(ymKey, codToAdd, dodToAdd, countToAdd) {
        if (!dbRefMonthlyRevenue) return;
        fb.runTransaction(dbRefMonthlyRevenue, (current) => {
            const months = (current && typeof current === 'object') ? current : {};
            const existing = months[ymKey] || {};
            let codDollar = Math.round(((parseFloat(existing.codDollar) || 0) + (parseFloat(codToAdd) || 0)) * 100) / 100;
            let dodDollar = Math.round(((parseFloat(existing.dodDollar) || 0) + (parseFloat(dodToAdd) || 0)) * 100) / 100;
            let totalCount = (parseFloat(existing.totalCount) || 0) + (parseFloat(countToAdd) || 0);
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
            showToast("⚠️ បរាជ័យក្នុងការ Save Monthly Revenue!");
        });
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
        openModalHelper('manualAdjustModal');
    }

    function submitManualAdjustment() {
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

        addRevenueToDailyAndMonthlyRecord(dateVal, codChange, dodChange, countChange);

        closeModal('manualAdjustModal');
        showToast("កែប្រែស្ថិតិ COD, DOD និងកញ្ចប់ដោយដៃបានជោគជ័យ!");
        applyCurrentFilter();
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
        if(!sidebar || !mainSection || !tableResponsive) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

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

            if (diffY < -30 && !sidebar.classList.contains('collapsed')) {
                sidebar.classList.add('collapsed');
                isDragging = false;
            }
            else if (diffY > 30 && scrollTop <= 0 && sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                isDragging = false;
            }
        }, { passive: true });

        mainSection.addEventListener('touchend', () => {
            isDragging = false;
        });

        const dragHandle = document.getElementById('dragHandle');
        if (dragHandle) {
            dragHandle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
            });
        }
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
            <button onclick="openExchangeRateModal(); document.getElementById('globalMoreMenu').classList.remove('show');">💱 អត្រាប្រាក់ (${exchangeRateRiel}៛)</button>
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
        const today = new Date();
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
        xlsx: { url: 'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js', integrity: 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw' },
        jspdf: { url: 'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js', integrity: 'sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/' },
        jspdfAutotable: { url: 'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js', integrity: 'sha384-fCAW/rDWORTbQXSiB7mOg0QtQ5c+r0f544y6XoKjuVva0nMBlCpNUjiFeG5iMdS3' }
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
                    phone: item.phone === "គ្មានលេខ" ? "" : (item.phone || ''),
                    barcode: b.code || '',
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
            ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'ប្រវត្តិ');
            XLSX.writeFile(wb, getExportFilenameBase() + '.xlsx');
            showToast("✅ បាន Export ជា Excel ជោគជ័យ!");
        } catch (e) {
            console.error("Excel export failed:", e);
            showToast("❌ Export Excel បរាជ័យ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត");
        }
    }

    async function exportDataAsPDF() {
        const rows = buildExportRows();
        if (!rows.length) { showToast("⚠️ គ្មានទិន្នន័យសម្រាប់ Export ទេ!"); return; }
        closeModal('exportDataModal');
        showToast("កំពុងរៀបចំ PDF...");
        try {
            await loadScriptOnce('jspdf');
            await loadScriptOnce('jspdfAutotable');
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape' });
            const head = [['No', 'Phone', 'Barcode', 'Locker', 'COD ($)', 'DOD ($)', 'Total ($)', 'Status', 'Date', 'Time']];
            const body = rows.map(r => [r.no, r.phone, r.barcode, r.locker, r.cod.toFixed(2), r.dod.toFixed(2), r.total.toFixed(2), r.status === 'យកហើយ' ? 'Closed' : 'Open', r.scanDate, r.time]);
            doc.setFontSize(12);
            doc.text('ZoeAdmin - Package History Export (' + getCurrentFilterLabel() + ')', 14, 12);
            doc.autoTable({ head: head, body: body, startY: 18, styles: { fontSize: 8 } });
            doc.save(getExportFilenameBase() + '.pdf');
            showToast("✅ បាន Export ជា PDF ជោគជ័យ!");
        } catch (e) {
            console.error("PDF export failed:", e);
            showToast("❌ Export PDF បរាជ័យ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត");
        }
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
        const lines = [EXPORT_HEADERS.map(csvEscape).join(',')];
        rows.forEach(r => {
            lines.push([r.no, r.phone, r.barcode, r.locker, r.cod.toFixed(2), r.dod.toFixed(2), r.total.toFixed(2), r.status, r.scanDate, r.time].map(csvEscape).join(','));
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
        let selectedClosedCount = filteredList.filter(item => item.isClosed).length;
        let codTotal = 0;
        let dodTotal = 0;

        let targetDateKey = "";
        const today = new Date();
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

                        const text = decodeBarcodeFromCanvasManual(liveScanCodeReader, ownCaptureCanvas);
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

    function searchByPhone() {
        const phoneInput = document.getElementById('searchPhoneInput');
        let phoneQuery = sanitizePhoneNumber(phoneInput ? phoneInput.value : '');
        if (!phoneQuery) {
            applyCurrentFilter();
            return;
        }
        let searched = getFilteredDataByDate().filter(item => item.phone && item.phone.includes(phoneQuery));
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

    // isBarcodeAlreadyUsed() above only checks the realtime-synced local cache -- it
    // cannot see a write another device made moments ago that hasn't synced down yet.
    // For two devices scanning the exact same physical barcode within that window, this
    // Firebase Transaction on a dedicated registry node is the actual atomic guard:
    // whichever device's transaction runs first against the server wins the claim, the
    // other is told the barcode is taken. Released again once the barcode's trash record
    // is permanently purged (see releaseBarcodesInRegistry), matching how
    // isBarcodeAlreadyUsed() itself treats "still in trash" as still claimed.
    function barcodeRegistryKey(code) {
        const normalized = String(code || '').trim().toUpperCase();
        // Firebase RTDB keys can't contain . # $ [ ] / or ASCII control characters --
        // percent-encode anything outside that set so an odd manually-typed barcode can
        // never produce an invalid or unintentionally-nested path.
        return normalized.replace(/[.#$\[\]\/\x00-\x1F\x7F]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
    }

    // Returns 'claimed' (we own it now), 'taken' (someone else already does), or
    // 'unknown' (couldn't reach Firebase to confirm either way -- caller falls back to
    // trusting the local isBarcodeAlreadyUsed() check rather than blocking scanning
    // entirely just because the network hiccuped, matching this app's usual degrade-
    // gracefully-offline behavior).
    async function claimBarcodeInRegistry(code) {
        const key = barcodeRegistryKey(code);
        if (!db || !fb || !key) return 'unknown';
        try {
            const result = await fb.runTransaction(fb.ref(db, `zoew_barcode_registry/${key}`), (current) => {
                if (current === null) return true;
                return; // undefined return aborts the transaction -- already claimed
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
        attemptAutoLookup(cleanBarcode);

        setTimeout(() => {
            if(modalPhoneInput) modalPhoneInput.focus();
        }, 150);
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
        const phoneModalEl = document.getElementById('phoneModal');
        if (skipBtn) skipBtn.disabled = true;
        if (confirmBtn) confirmBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;
        // Also blocks the global Escape/backdrop-click dismiss handlers (dismissModal())
        // for as long as the claim+save below is in flight, so the modal can't be yanked
        // away while its save is still happening in the background -- the disabled
        // buttons above only stop clicks on the buttons themselves.
        if (phoneModalEl) phoneModalEl.setAttribute('data-nodismiss', 'true');

        try {
            // Final, server-side-atomic guard against two devices saving the exact same
            // barcode within the same instant -- see claimBarcodeInRegistry's comment.
            const claim = await claimBarcodeInRegistry(barcodeToSave);
            if (claim === 'taken') {
                closeModal('phoneModal');
                showToast(`⚠️ លេខ Barcode នេះ (${barcodeToSave}) ត្រូវបានបញ្ចូលរួចហើយ! (ប្រហែលមកពី device ផ្សេង) សូមស្កេនម្ដងទៀត។`);
                if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
                safeFocusScanner();
                return;
            }

            try {
                await addOrUpdateEntry(barcodeToSave, phone, cod, dod, locker);
            } catch (saveError) {
                if (claim === 'claimed') releaseBarcodesInRegistry([barcodeToSave]);
                throw saveError;
            }

            closeModal('phoneModal');
            showToast("រក្សាទុកបានជោគជ័យ!");
        } catch (e) {
            // addOrUpdateEntry's own Firebase-save call already toasts its failure message.
        } finally {
            if (skipBtn) skipBtn.disabled = false;
            if (confirmBtn) confirmBtn.disabled = false;
            if (cancelBtn) cancelBtn.disabled = false;
            if (phoneModalEl) phoneModalEl.removeAttribute('data-nodismiss');
        }
    }

    function addOrUpdateEntry(barcode, phone, cod, dod, locker = "N/A") {
        let savePromise;
        const now = new Date();
        const dateString = getFormattedDate(now);
        const currentTimeMillis = now.getTime();
        
        const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const timeString = `${timeFormatted} (${dateString})`;

        let existingIndex = -1;
        if (phone !== "គ្មានលេខ") {
            existingIndex = scanHistory.findIndex(item => item.phone === phone && item.scanDate === dateString && !item.isClosed);
        }

        addRevenueToDailyAndMonthlyRecord(dateString, cod, dod, 1);

        if (existingIndex !== -1) {
            let item = scanHistory[existingIndex];

            if (!item.barcodes || !Array.isArray(item.barcodes)) {
                let oldCod = parseFloat(item.cod !== undefined ? item.cod : item.price) || 0;
                let oldDod = parseFloat(item.dod) || 0;
                let oldCode = item.barcode || barcode;
                let oldTime = item.time || timeString;
                let oldIsClosed = item.isClosed || false;
                let oldLocker = item.locker || "N/A";
                item.barcodes = [{ code: oldCode, time: oldTime, cod: oldCod, dod: oldDod, locker: oldLocker, isClosed: oldIsClosed, isDeducted: false, isFromDeletion: false, createdAt: item.createdAt || currentTimeMillis }];
            }

            item.barcodes.push({ 
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

            item.count = item.barcodes.length;
            item.cod = Math.round(item.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
            item.dod = Math.round(item.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
            item.price = Math.round((item.cod + item.dod) * 100) / 100;
            item.barcode = barcode;
            item.time = timeString;
            item.scanDate = dateString;
            item.isClosed = false;
            delete item.closedAt;
            item.isCalled = false;

            scanHistory.splice(existingIndex, 1);
            scanHistory.push(item);
            savePromise = saveSingleHistoryItemToFirebase(item);
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
            savePromise = saveSingleHistoryItemToFirebase(newItem);
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
            item.barcodes = [{ code: item.barcode, time: item.time, cod: cVal, dod: dVal, locker: lVal, isClosed: item.isClosed || false, isDeducted: false, isFromDeletion: false, createdAt: item.createdAt || Date.now() }];
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

    function removeSingleBarcode(itemId, barcodeCode) {
        const item = scanHistory.find(i => i.id === itemId);
        if (!item || !item.barcodes) return;

        const bcIndex = item.barcodes.findIndex(b => b.code === barcodeCode);
        if (bcIndex === -1) return;

        if (confirm(`តើអ្នកពិតជាចង់ដកកញ្ចប់អីវ៉ាន់ (${barcodeCode}) នេះចេញពីការគ្រប់គ្រងមែនទេ? (ចំណាំ៖ មិនមែនលុបអចិន្ត្រៃយ៍ទេ អាចស្តារវិញបាន)`)) {
            const removedBc = item.barcodes.splice(bcIndex, 1)[0];
            
            if (!removedBc.isDeducted) {
                const targetCod = parseFloat(removedBc.cod) || 0;
                const targetDod = parseFloat(removedBc.dod) || 0;

                addRevenueToDailyAndMonthlyRecord(item.scanDate || getFormattedDate(), -targetCod, -targetDod, -1);
                removedBc.isDeducted = true; 
            }
            
            removedBc.isFromDeletion = false;

            let itemToTrash = { ...item, barcodes: [removedBc], count: 1 };
            itemToTrash.id = generateUniqueId();
            itemToTrash.deletedAt = Date.now();
            itemToTrash.cod = parseFloat(removedBc.cod) || 0;
            itemToTrash.dod = parseFloat(removedBc.dod) || 0;
            itemToTrash.price = Math.round((itemToTrash.cod + itemToTrash.dod) * 100) / 100;
            itemToTrash.barcode = removedBc.code;
            itemToTrash.locker = removedBc.locker || "N/A";
            itemToTrash.time = removedBc.time || item.time;
            itemToTrash.isClosed = removedBc.isClosed || false;
            if (itemToTrash.isClosed) {
                itemToTrash.closedAt = item.closedAt || Date.now();
            } else {
                delete itemToTrash.closedAt;
            }
            deletedItems.unshift(itemToTrash);
            saveSingleDeletedItemToFirebase(itemToTrash);

            if (item.barcodes.length === 0) {
                const itemIndex = scanHistory.findIndex(i => i.id === itemId);
                if (itemIndex !== -1) {
                    scanHistory.splice(itemIndex, 1);
                }
                closeModal('viewListModal');
                deleteSingleHistoryItemFromFirebase(itemId);
            } else {
                item.count = item.barcodes.length;
                item.cod = Math.round(item.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
                item.dod = Math.round(item.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
                item.price = Math.round((item.cod + item.dod) * 100) / 100;
                item.barcode = item.barcodes[0].code;
                openViewListModal(itemId);
                saveSingleHistoryItemToFirebase(item);
            }

            applyCurrentFilter();
            showToast("បានដកកញ្ចប់អីវ៉ាន់ និងកាត់ប្រាក់ចេញពីស្ថិតិរួចរាល់!");
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
        if (freshItem && freshB) {
            freshB.isClosed = desiredClosed;
            const allClosedLocal = freshItem.barcodes.every(b => b.isClosed);
            freshItem.isClosed = allClosedLocal;
            if (allClosedLocal) freshItem.closedAt = Date.now(); else delete freshItem.closedAt;
            openViewListModal(itemId);
            applyCurrentFilter();
        }
        showToast(`បាន${actionText}ស្ថានភាព Barcode រួចរាល់!`);

        if (!db || !/^[a-zA-Z0-9_-]+$/.test(itemId)) return;

        try {
            const itemRef = fb.ref(db, `zoew_scan_history_cod_dod/${itemId}`);
            await fb.runTransaction(itemRef, (currentItem) => {
                if (!currentItem) return currentItem;
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
                        createdAt: currentItem.createdAt || Date.now()
                    }];
                }
                const b = currentItem.barcodes.find(bc => bc.code === barcodeCode);
                if (!b) return currentItem;
                b.isClosed = desiredClosed;
                const allClosed = currentItem.barcodes.every(bc => bc.isClosed);
                currentItem.isClosed = allClosed;
                if (allClosed) currentItem.closedAt = Date.now();
                else delete currentItem.closedAt;
                return currentItem;
            });
        } catch (error) {
            console.error("Error toggling barcode close: ", error);
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!");
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
                item.barcodes = [{ code: item.barcode, time: item.time, cod: parseFloat(item.cod) || 0, dod: parseFloat(item.dod) || 0, locker: item.locker || "N/A", isClosed: item.isClosed || false, isDeducted: false }];
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

                if (codDiff !== 0 || dodDiff !== 0) {
                    addRevenueToDailyAndMonthlyRecord(item.scanDate || getFormattedDate(), codDiff, dodDiff, 0);
                }

                saveSingleHistoryItemToFirebase(item);
                applyCurrentFilter();
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
            item.isCalled = true;
            patchHistoryItemFields(item, { isCalled: true });
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
            if (mark) {
                item.callMark = mark;
                item.callMarkTime = Date.now();
                patchHistoryItemFields(item, { callMark: mark, callMarkTime: item.callMarkTime });
            } else {
                delete item.callMark;
                delete item.callMarkTime;
                patchHistoryItemFields(item, { callMark: null, callMarkTime: null });
            }
            applyCurrentFilter();
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
            item.phone = newPhone;
            patchHistoryItemFields(item, { phone: newPhone });
            updateRecentPhonesList();
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
        if (freshItem) {
            freshItem.isClosed = desiredClosed;
            if (desiredClosed) {
                freshItem.closedAt = Date.now();
                if (freshItem.barcodes && Array.isArray(freshItem.barcodes)) freshItem.barcodes.forEach(b => b.isClosed = true);
            } else {
                delete freshItem.closedAt;
                if (freshItem.barcodes && Array.isArray(freshItem.barcodes)) freshItem.barcodes.forEach(b => b.isClosed = false);
            }
            applyCurrentFilter();
        }
        showToast(`បាន${actionText}បញ្ជីជោគជ័យ!`);

        if (!db || !/^[a-zA-Z0-9_-]+$/.test(id)) return;

        try {
            const itemRef = fb.ref(db, `zoew_scan_history_cod_dod/${id}`);
            await fb.runTransaction(itemRef, (currentItem) => {
                if (!currentItem) return currentItem;
                currentItem.isClosed = desiredClosed;
                if (desiredClosed) {
                    currentItem.closedAt = Date.now();
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
        } catch (error) {
            console.error("Error toggling close status: ", error);
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!");
        }
    }

    function deleteSingleItem(id) {
        const index = scanHistory.findIndex(i => i.id === id);
        if (index === -1) return;

        if (confirm(`តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?`)) {
            let removed = scanHistory.splice(index, 1)[0];
            removed.deletedAt = Date.now();
            removed.isFromDeletion = true;
            
            deletedItems.unshift(removed);

            deleteSingleHistoryItemFromFirebase(id);
            saveSingleDeletedItemToFirebase(removed);
            applyCurrentFilter();
            updateRecentPhonesList();
            showToast("បានលុបទៅធុងសំរាមបណ្តោះអាសន្ន!");
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
                        <button class="btn-sm" style="background:#ef4444; color:white; padding:4px 8px; min-height:26px;" onclick="permanentlyDeleteItem('${escapeForInlineJsAttr(item.id)}')">✖️</button>
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
        delete itemToRestore.deletedAt; 
        delete itemToRestore.isFromDeletion;
        if (itemToRestore.isClosed) {
            itemToRestore.closedAt = Date.now();
        }

        let existingItemIndex = scanHistory.findIndex(i => i.id === itemToRestore.id || (itemToRestore.phone !== "គ្មានលេខ" && i.phone === itemToRestore.phone && itemToRestore.barcodes && i.barcodes && i.scanDate === itemToRestore.scanDate));

        if (existingItemIndex !== -1) {
            let targetItem = scanHistory[existingItemIndex];
            if (!targetItem.barcodes) targetItem.barcodes = [];
            
            if (itemToRestore.barcodes && Array.isArray(itemToRestore.barcodes)) {
                itemToRestore.barcodes.forEach(restoredBc => {
                    if (restoredBc.isDeducted) {
                        const targetCod = parseFloat(restoredBc.cod) || 0;
                        const targetDod = parseFloat(restoredBc.dod) || 0;
                        addRevenueToDailyAndMonthlyRecord(targetItem.scanDate || getFormattedDate(), targetCod, targetDod, 1);
                        restoredBc.isDeducted = false;
                    }
                    targetItem.barcodes.push(restoredBc);
                });
            }

            targetItem.count = targetItem.barcodes.length;
            targetItem.cod = Math.round(targetItem.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
            targetItem.dod = Math.round(targetItem.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
            targetItem.price = Math.round((targetItem.cod + targetItem.dod) * 100) / 100;
            targetItem.isClosed = targetItem.barcodes.length > 0 && targetItem.barcodes.every(b => b.isClosed);
            if (targetItem.isClosed) {
                targetItem.closedAt = Date.now();
            } else {
                delete targetItem.closedAt;
            }
        } else {
            if (itemToRestore.barcodes && Array.isArray(itemToRestore.barcodes)) {
                itemToRestore.barcodes.forEach(restoredBc => {
                    if (restoredBc.isDeducted) {
                        const targetCod = parseFloat(restoredBc.cod) || 0;
                        const targetDod = parseFloat(restoredBc.dod) || 0;
                        addRevenueToDailyAndMonthlyRecord(itemToRestore.scanDate || getFormattedDate(), targetCod, targetDod, 1);
                        restoredBc.isDeducted = false;
                    }
                });
            }
            scanHistory.push(itemToRestore);
        }

        const restoredId = pendingRestoreId;
        closeModal('restoreWarningModal');
        pendingRestoreId = null;

        try {
            await Promise.all([saveHistoryToFirebase(), saveDeletedToFirebase()]);
            openRecentlyDeletedModal();
            applyCurrentFilter();
            updateRecentPhonesList();
            showToast("បានស្តារទិន្នន័យមកទីតាំងដើមវិញដោយសុវត្ថិភាព!");
        } catch (error) {
            console.error("Restore failed: ", restoredId, error);
            try {
                const [histSnap, delSnap] = await Promise.all([fb.get(dbRefHistory), fb.get(dbRefDeleted)]);
                const histData = histSnap.val();
                scanHistory = histData ? Object.keys(histData).map(k => histData[k]) : [];
                lastSyncedHistoryKeys = new Set(scanHistory.map(item => item.id).filter(Boolean));
                const delData = delSnap.val();
                deletedItems = delData ? Object.keys(delData).map(k => delData[k]) : [];
                lastSyncedDeletedKeys = new Set(deletedItems.map(item => item.id).filter(Boolean));
            } catch (resyncError) {
                console.error("Resync after failed restore also failed: ", resyncError);
            }
            alert("❌ ស្តារទិន្នន័យបរាជ័យ! មូលហេតុ: " + (error && error.message ? error.message : error) + "\n\nសូមថតរូបអេក្រង់នេះ ហើយផ្ញើសួរអ្នកបច្ចេកទេស។");
            openRecentlyDeletedModal();
            applyCurrentFilter();
        }
    }

    function permanentlyDeleteItem(id) {
        if (confirm("លុបជាអចិន្ត្រៃយ៍?")) {
            const index = deletedItems.findIndex(i => i.id === id);
            if(index !== -1) {
                const purgedItem = deletedItems.splice(index, 1)[0];
                deleteSingleDeletedItemFromFirebase(id);
                releaseBarcodesInRegistry(collectItemBarcodes(purgedItem));
                renderRecentlyDeleted();
            }
        }
    }

    function saveHistoryToFirebase() {
        if (!dbRefHistory) return Promise.resolve();
        const historyObj = {};
        const currentKeys = new Set();
        scanHistory.forEach(item => {
            if (item.id && /^[a-zA-Z0-9_-]+$/.test(item.id)) {
                historyObj[item.id] = item;
                currentKeys.add(item.id);
            } else if (item.id) {
                console.error('Skipping item with unsafe id: ', item.id);
            }
        });
        lastSyncedHistoryKeys.forEach(key => {
            if (!currentKeys.has(key)) historyObj[key] = null;
        });

        return fb.update(dbRefHistory, historyObj).then(() => {
            lastSyncedHistoryKeys = currentKeys;
        }).catch((error) => {
            console.error("Error saving history: ", error);
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!");
            throw error;
        });
    }

    function saveSingleHistoryItemToFirebase(item) {
        if (!dbRefHistory) return Promise.resolve();
        if (!item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) {
            return saveHistoryToFirebase();
        }
        lastSyncedHistoryKeys.add(item.id);
        return fb.update(dbRefHistory, { [item.id]: item }).catch((error) => {
            console.error("Error saving history item: ", error);
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!");
            throw error;
        });
    }

    function patchHistoryItemFields(item, fields) {
        if (!dbRefHistory) return Promise.resolve();
        if (!item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) {
            return saveHistoryToFirebase();
        }
        lastSyncedHistoryKeys.add(item.id);
        const updates = {};
        Object.keys(fields).forEach(key => {
            updates[`${item.id}/${key}`] = fields[key];
        });
        return fb.update(dbRefHistory, updates).catch((error) => {
            console.error("Error patching history item: ", error);
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!");
        });
    }

    function saveDeletedToFirebase() {
        if (!dbRefDeleted) return Promise.resolve();
        const deletedObj = {};
        const currentKeys = new Set();
        deletedItems.forEach(item => {
            if (item.id && /^[a-zA-Z0-9_-]+$/.test(item.id)) {
                deletedObj[item.id] = item;
                currentKeys.add(item.id);
            } else if (item.id) {
                console.error('Skipping item with unsafe id: ', item.id);
            }
        });
        lastSyncedDeletedKeys.forEach(key => {
            if (!currentKeys.has(key)) deletedObj[key] = null;
        });

        return fb.update(dbRefDeleted, deletedObj).then(() => {
            lastSyncedDeletedKeys = currentKeys;
        }).catch((error) => {
            console.error("Error saving deleted items: ", error);
            showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase!");
            throw error;
        });
    }

    function deleteSingleHistoryItemFromFirebase(id) {
        if (!dbRefHistory) return Promise.resolve();
        if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return saveHistoryToFirebase();
        return fb.update(dbRefHistory, { [id]: null }).then(() => {
            lastSyncedHistoryKeys.delete(id);
        }).catch((error) => {
            console.error("Error deleting history item: ", error);
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!");
            throw error;
        });
    }

    function saveSingleDeletedItemToFirebase(item) {
        if (!dbRefDeleted) return Promise.resolve();
        if (!item || !item.id || !/^[a-zA-Z0-9_-]+$/.test(item.id)) {
            return saveDeletedToFirebase();
        }
        return fb.update(dbRefDeleted, { [item.id]: item }).then(() => {
            lastSyncedDeletedKeys.add(item.id);
        }).catch((error) => {
            console.error("Error saving deleted item: ", error);
            showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase!");
            throw error;
        });
    }

    function deleteSingleDeletedItemFromFirebase(id) {
        if (!dbRefDeleted) return Promise.resolve();
        if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return saveDeletedToFirebase();
        return fb.update(dbRefDeleted, { [id]: null }).then(() => {
            lastSyncedDeletedKeys.delete(id);
        }).catch((error) => {
            console.error("Error deleting deleted item: ", error);
            showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase!");
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

    function renderHistory(dataToRender = scanHistory) {
        const tbody = document.getElementById('historyTableBody');
        const countSpan = document.getElementById('count');
        if(!tbody || !countSpan) return;
        tbody.innerHTML = '';
        countSpan.innerText = dataToRender.length;

        if (dataToRender.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #888; padding: 16px;">📦 គ្មានទិន្នន័យបង្ហាញទេ</td></tr>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        const currentTime = Date.now();
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;

        for (let i = dataToRender.length - 1; i >= 0; i--) {
            const item = dataToRender[i];
            const tr = document.createElement('tr');
            if (item.isClosed) {
                tr.classList.add('closed-row');
            }

            let phoneDisplay = item.phone === "គ្មានលេខ" ? `<span style="color:#ef4444; font-style:italic;">គ្មានលេខ</span>` : `<span class="phone-clickable" onclick="openCallMarkModal('${escapeForInlineJsAttr(item.id)}')" title="ចុចដើម្បីសម្គាល់ការខល">${sanitizeInput(item.phone)}</span>`;

            let rowNumClass = '';
            let rowNumLabel = '';
            if (item.callMark === 'no-answer') { rowNumClass = 'row-num-no-answer'; rowNumLabel = 'ខល អត់លើក'; }
            else if (item.callMark === 'no-connect') { rowNumClass = 'row-num-no-connect'; rowNumLabel = 'ខល អត់ចូល'; }
            else if (item.callMark === 'wrong-number') { rowNumClass = 'row-num-wrong-number'; rowNumLabel = 'ខុសលេខ'; }

            let needsRecall = (item.callMark === 'no-answer' || item.callMark === 'no-connect') &&
                item.callMarkTime && (currentTime - item.callMarkTime) >= FOUR_HOURS_MS;

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
                if (item.isCalled && !needsRecall) {
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
            
            let itemAgeTime = item.createdAt || parseTimestampFromId(item.id) || currentTime;
            let isOld = (currentTime - itemAgeTime) > twentyFourHoursMs;
            
            let ageBadge = isOld 
                ? `<span style="background:#fef3c7; color:#b45309; padding:2px 5px; border-radius:4px; font-size:9px; font-weight:600; margin-left:4px;">ចាស់</span>` 
                : `<span style="background:var(--success-light); color:var(--success); padding:2px 5px; border-radius:4px; font-size:9px; font-weight:600; margin-left:4px;">ថ្មី</span>`;

            let statusBadge = item.isClosed ? `<span class="closed-badge">យកហើយ</span>` : ageBadge;
            let calledBadge = item.isCalled ? `<span class="called-badge">ខល</span>` : "";
            let scanTimeDisplay = item.time ? `<span class="scan-time-tag">🕒 ${sanitizeInput(item.time)}</span>` : "";

            let viewListBtn = '';
            if (item.count > 1) {
                viewListBtn = `<button class="btn-view-list" onclick="openViewListModal('${escapeForInlineJsAttr(item.id)}')">📦 បញ្ជី (${item.count})</button>`;
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

            tr.innerHTML = `
                <td style="text-align: center;">${rowNumClass ? `<span class="row-num-mark ${rowNumClass}" title="${rowNumLabel}">${i + 1}</span>` : (i + 1)}</td>
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
            fragment.appendChild(tr);
        }
        tbody.appendChild(fragment);
    }

    function clearHistory() {
        if (confirm("តើអ្នកពិតជាចង់លុបប្រវត្តិទាំងអស់មែនទេ?")) {
            scanHistory.forEach(item => {
                item.deletedAt = Date.now();
                item.isFromDeletion = true;
                deletedItems.unshift(item);
            });
            scanHistory = [];
            saveHistoryToFirebase();
            saveDeletedToFirebase();
            applyCurrentFilter();
            updateRecentPhonesList();
            showToast("បានលុបប្រវត្តិទាំងអស់!");
        }
    }
