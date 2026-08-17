    // Mobile: pasting a long value (e.g. an activation key) then dismissing the on-screen keyboard
    // resizes the visual viewport, and position:fixed elements (every .modal here) can be left with
    // stale hit-testing afterward on some Android/iOS browser versions -- the modal visibly repaints
    // in the right place, but taps on it don't register at all (not even the CSS :active flash) until
    // something forces a layout recalc. Forcing one on every keyboard show/hide keeps modal buttons
    // tappable right after the keyboard closes, which is exactly when a user taps "Submit" post-paste.
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => { window.scrollTo(0, 0); });
    }

    // Belt-and-suspenders alongside the inline onclick= already on this button in the HTML: a
    // screen recording from a real device (Zoescan, same activation-modal pattern) showed the
    // native tap-highlight ripple landing squarely on this button on repeated taps, yet
    // submitActivationKey() never visibly ran -- consistent with the inline onclick= attribute
    // simply not firing on that device/browser combination, a known-enough mobile WebView/Chrome
    // quirk that addEventListener is not susceptible to. Guarded by the btn.disabled check inside
    // submitActivationKey() itself so this can't double-fire alongside the inline handler.
    const activationSubmitBtnEl = document.getElementById('activationSubmitBtn');
    if (activationSubmitBtnEl) activationSubmitBtnEl.addEventListener('click', submitActivationKey);

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then((reg) => {
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') reg.update().catch(() => {});
                });
                window.addEventListener('focus', () => reg.update().catch(() => {}));
                setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
            }).catch(() => {});
        });
        let swReloadedOnce = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (swReloadedOnce) return;
            swReloadedOnce = true;
            const reloadWhenIdle = () => {
                if (isModalOpen) {
                    setTimeout(reloadWhenIdle, 3000);
                } else {
                    sessionStorage.setItem('zoew_sw_updated', '1');
                    window.location.reload();
                }
            };
            reloadWhenIdle();
        });
    }

    let firebaseConfig = null;
    let fb = null;
    let auth = null;
    let db = null;
    let isInitializingFirebase = false;
    let dbRefHistory = null;
    let dbRefDeleted = null;
    let dbRefDailyRevenue = null;
    let dbRefMonthlyRevenue = null;
    let dbRefExchangeRate = null;
    let dbRefConnected = null;

    let exchangeRateRiel = parseFloat(localStorage.getItem('zoew_exchange_rate')) || 4100;

    let autoLoginAttempted = false;

    let scanHistory = [];
    let deletedItems = [];
    let lastSyncedHistoryKeys = new Set();
    let lastSyncedDeletedKeys = new Set();
    let dailyRevenueData = {};
    let monthlyRevenueData = {};
    let currentFilterMode = 'today';
    let customFilterDate = '';
    let editingItemId = null;
    let markingItemId = null;

    let pendingRestoreId = null;

    let isModalOpen = false;
    let searchTimer = null;
    let isDatabaseInitialized = false;
    let authUnsubscribe = null;
    let authRecoveryTimeout = null;
    let authGeneration = 0;

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
        editingItemId = null;
        markingItemId = null;
        isModalOpen = Array.from(document.querySelectorAll('.modal')).some(m => m.style.display === 'flex');
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

    function withTimeout(promise, ms, timeoutMsg) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMsg || 'Timed out')), ms))
        ]);
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
        applyCurrentFilter();
        updateRecentPhonesList();
    }, 120);

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
                scanHistory = [];
                deletedItems = [];
                dailyRevenueData = {};
                monthlyRevenueData = {};
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
            { name: 'PBKDF2', salt: enc.encode('zoew_pin_verify_v2'), iterations: 150000, hash: 'SHA-256' },
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

    function requestPinBeforeConfig() {
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
        } catch (e) {
            alert("មិនអាចកំណត់ PIN បានទេ! សូមប្រើ HTTPS ហើយសាកល្បងម្តងទៀត។");
            return;
        } finally {
            if (newPinIn) newPinIn.value = '';
        }
        closeModal('pinSetupModal');
        showToast("បានកំណត់ Security PIN រួចរាល់!");
        openConfigModal();
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
                closeModal('pinModal');
                openConfigModal();
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
        requestPinBeforeConfig();
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

    const LICENSE_APP_CODE = 'ZOW';
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
        // Whatever happens inside this function must always end in visible feedback -- this
        // exact flow has repeatedly hit "tapped Activate, nothing happened" bugs in Zoescan (an
        // unbounded fetch hang, alert() silently failing in an installed-PWA context, a missing
        // else branch after a valid-locally-but-server-rejected key), each fixed individually.
        // This top-level try/catch/finally is the backstop: if any *other*, not-yet-found
        // exception is thrown anywhere in this call chain, it now surfaces as a visible toast
        // with the real error message instead of vanishing as a silent unhandled rejection, and
        // the button is guaranteed to be re-enabled either way. alert() also replaced with
        // showToast() here for the same reason Zoescan's was. Every individual await already
        // has its own timeout, but as a second backstop against a hang in a spot that doesn't
        // (e.g. a corrupted IndexedDB making an internal SDK call never settle), the two
        // awaited calls below are also wrapped in an outer 20s withTimeout() each.
        if (btn) { btn.disabled = true; btn.textContent = 'កំពុងផ្ទៀងផ្ទាត់...'; }
        try {
            const input = document.getElementById('activationKeyInput');
            const keyStr = input ? input.value.trim() : '';
            if (!keyStr) { showToast('សូមបញ្ចូល Activation Key!'); return; }
            const result = await withTimeout(ZoeLicense.activate(keyStr, LICENSE_APP_CODE), 20000, 'Activation timed out');
            if (!result.valid) {
                showToast(licenseFailureMessage(result.reason));
                return;
            }
            if (input) input.value = '';
            const activated = await withTimeout(ensureAppActivated(), 20000, 'Activation timed out');
            if (activated) {
                showToast("✅ Active ជោគជ័យ!");
                if (!isDatabaseInitialized) {
                    initDatabaseListeners();
                    isDatabaseInitialized = true;
                }
            } else {
                // Key was valid locally (signature/app/expiry all checked out in activate()
                // above) but the server-side check inside ensureAppActivated() just rejected it
                // (revoked / not found / server-expired) -- without this, nothing here ever told
                // the user that, so the modal would silently reset to its original text.
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

    async function verifyWorkerRoleThenProceed(user, myAuthGeneration) {
        let role;
        try {
            const roleSnap = await withTimeout(fb.get(fb.ref(db, `user_roles/${user.uid}`)), 15000, 'Role check timed out');
            role = roleSnap.val();
        } catch (e) {
            if (myAuthGeneration !== authGeneration) return;
            console.error("Role verification failed:", e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Role verification failed:" });
            await fb.signOut(auth).catch(() => {});
            clearRememberedSession(true);
            showLoginModalWithPrefill();
            showToast("⚠️ មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិចូលប្រព័ន្ធបានទេ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងចូលម្តងទៀត។");
            return;
        }
        if (myAuthGeneration !== authGeneration) return;
        if (role !== 'admin' && role !== 'worker') {
            await fb.signOut(auth).catch(() => {});
            clearRememberedSession(true);
            showLoginModalWithPrefill();
            showToast("⛔ គណនីនេះគ្មានសិទ្ធិចូល ZoeW ទេ! សូមប្រើកម្មវិធីត្រឹមត្រូវសម្រាប់គណនីនេះ។");
            return;
        }

        let activated;
        try {
            // Same hang risk as submitActivationKey() -- this runs right after every
            // successful login/resume, so a hang here (not just a thrown error) is exactly
            // what would leave a returning worker stuck on a blank screen with the login
            // modal already closed-in-spirit but nothing else shown either.
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
        showToast("ចូលប្រព័ន្ធជោគជ័យ!");
        updateAuthButton(true);

        if (!isDatabaseInitialized) {
            initDatabaseListeners();
            isDatabaseInitialized = true;
        }

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
                verifyWorkerRoleThenProceed(user, myAuthGeneration);
            } else {
                if (isDatabaseInitialized) {
                    if (dbRefDailyRevenue) fb.off(dbRefDailyRevenue);
                    if (dbRefMonthlyRevenue) fb.off(dbRefMonthlyRevenue);
                    if (dbRefHistory) fb.off(dbRefHistory);
                    if (dbRefDeleted) fb.off(dbRefDeleted);
                    if (dbRefExchangeRate) fb.off(dbRefExchangeRate);
                    isDatabaseInitialized = false;
                }
                scanHistory = [];
                deletedItems = [];
                dailyRevenueData = {};
                monthlyRevenueData = {};
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
            })
            .finally(() => {
                if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'ចូលប្រព័ន្ធ'; }
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
            if (dbRefHistory) fb.off(dbRefHistory);
            if (dbRefDeleted) fb.off(dbRefDeleted);
            if (dbRefExchangeRate) fb.off(dbRefExchangeRate);
        }

        if (dbRefExchangeRate) {
            fb.onValue(dbRefExchangeRate, (snapshot) => {
                const val = snapshot.val();
                if (val && !isNaN(val)) {
                    exchangeRateRiel = parseFloat(val);
                    localStorage.setItem('zoew_exchange_rate', exchangeRateRiel);
                    applyCurrentFilter();
                }
            }, handleDbListenerError);
        }

        fb.onValue(dbRefDailyRevenue, (snapshot) => {
            dailyRevenueData = snapshot.val() || {};
            applyCurrentFilter();
        }, handleDbListenerError);

        fb.onValue(dbRefMonthlyRevenue, (snapshot) => {
            monthlyRevenueData = snapshot.val() || {};
        }, handleDbListenerError);

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

            debouncedRenderAfterHistorySync();
        }, handleDbListenerError);

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
        }, handleDbListenerError);

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
        let claimedUpdatedRemainder = null;
        try {
            const itemRef = fb.ref(db, `zoew_scan_history_cod_dod/${id}`);
            const result = await fb.runTransaction(itemRef, (currentItem) => {
                claimedWhole = null;
                claimedPartial = null;
                claimedUpdatedRemainder = null;
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
                        claimedUpdatedRemainder = updated;
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

            if (claimedPartial) {
                syncScannerLookupEntry(id, claimedUpdatedRemainder);
            } else {
                clearScannerLookupEntry(id);
            }
        } catch (e) {
            console.error('Automatic cleanup transaction failed for', id, e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'Automatic cleanup transaction failed for' });
        } finally {
            cleanupInFlight.delete(id);
        }
    }

    function barcodeRegistryKey(code) {
        const normalized = String(code || '').trim().toUpperCase();
        return normalized.replace(/[.#$\[\]\/\x00-\x1F\x7F]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
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

    function buildScannerLookupPayload(item) {
        const payload = {
            id: item.id,
            phone: item.phone || '',
            barcode: item.barcode || '',
            locker: item.locker || ''
        };
        if (item.lockerUpdatedAt) payload.lockerUpdatedAt = item.lockerUpdatedAt;
        if (item.lockerUpdatedBy) payload.lockerUpdatedBy = item.lockerUpdatedBy;
        if (item.barcodes && Array.isArray(item.barcodes) && item.barcodes.length) {
            const barcodesObj = {};
            item.barcodes.forEach((b, idx) => {
                if (!b) return;
                const entry = { code: b.code || '', locker: b.locker || '' };
                if (b.lockerUpdatedAt) entry.lockerUpdatedAt = b.lockerUpdatedAt;
                barcodesObj[idx] = entry;
            });
            payload.barcodes = barcodesObj;
        }
        return payload;
    }

    function syncScannerLookupEntry(itemId, item) {
        if (!db || !fb || !item || !itemId || !/^[a-zA-Z0-9_-]+$/.test(itemId)) return Promise.resolve();
        return fb.set(fb.ref(db, `zoew_scanner_lookup/${itemId}`), buildScannerLookupPayload(item)).catch((error) => {
            console.error('Error syncing scanner lookup entry: ', error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: 'Error syncing scanner lookup entry: ' });
        });
    }

    function clearScannerLookupEntry(itemId) {
        if (!db || !fb || !itemId || !/^[a-zA-Z0-9_-]+$/.test(itemId)) return Promise.resolve();
        return fb.set(fb.ref(db, `zoew_scanner_lookup/${itemId}`), null).catch((error) => {
            console.error('Error clearing scanner lookup entry: ', error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: 'Error clearing scanner lookup entry: ' });
        });
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
            saveDeletedToFirebase().catch(() => {});
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
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2500);
    }

    function getFormattedDate(d = new Date()) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    window.addEventListener('load', function () {
        if (sessionStorage.getItem('zoew_sw_updated')) {
            sessionStorage.removeItem('zoew_sw_updated');
            showToast("កម្មវិធីត្រូវបានធ្វើបច្ចុប្បន្នភាព ✅");
        }

        if (window.ZoeErrors) ZoeErrors.init('zoew');
        initFirebase();

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

        setupSwipeGestures();
        updateRecentPhonesList();

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.more-btn') && !e.target.closest('.header-more-btn') && !e.target.closest('#globalMoreMenu')) {
                closeGlobalMoreMenu();
            }
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
            if (codDollar < 0 || dodDollar < 0 || totalCount < 0) {
                if (window.ZoeErrors) ZoeErrors.capture(new Error('Daily revenue underflow clamped to 0'), { context: scanDateStr, codDollar, dodDollar, totalCount });
            }
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
            showToast("⚠️ បរាជ័យក្នុងការ Save Monthly Revenue!");
        });
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
            <button onclick="requestPinBeforeConfig(); document.getElementById('globalMoreMenu').classList.remove('show');">⚙️ Config / Reconfig</button>
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

        container.innerHTML = `
            <button onclick="openEditModal('${escapeForInlineJsAttr(id)}'); document.getElementById('globalMoreMenu').classList.remove('show');">✏️ កែលេខទូរស័ព្ទ</button>
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

    function openViewListModal(id) {
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
                    <button class="${closeBtnClass}" data-item-id="${sanitizeInput(item.id)}" data-code="${sanitizeInput(b.code)}" onclick="toggleIndividualBarcodeClose(this.dataset.itemId, this.dataset.code)">${closeBtnText}</button>
                </div>
            `;
            container.appendChild(div);
        });

        openModalHelper('viewListModal');
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
            ? { isClosed: freshB.isClosed, itemIsClosed: freshItem.isClosed, itemClosedAt: freshItem.closedAt }
            : null;
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
                    openViewListModal(itemId);
                    applyCurrentFilter();
                }
            }
        }
    }

    function handleCallAction(id) {
        const item = scanHistory.find(i => i.id === id);
        if (item) {
            const wasCalled = item.isCalled;
            item.isCalled = true;
            patchHistoryItemFields(item, { isCalled: true }, { isCalled: wasCalled });
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
                item.callMarkTime = Date.now();
                patchHistoryItemFields(item, { callMark: mark, callMarkTime: item.callMarkTime }, { callMark: prevCallMark, callMarkTime: prevCallMarkTime });
            } else {
                delete item.callMark;
                delete item.callMarkTime;
                patchHistoryItemFields(item, { callMark: null, callMarkTime: null }, { callMark: prevCallMark, callMarkTime: prevCallMarkTime });
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
            const prevPhone = item.phone;
            item.phone = newPhone;
            patchHistoryItemFields(item, { phone: newPhone }, { phone: prevPhone }).then(() => syncScannerLookupEntry(item.id, item));
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
        const previousState = freshItem
            ? { isClosed: freshItem.isClosed, closedAt: freshItem.closedAt, barcodeStates: freshItem.barcodes ? freshItem.barcodes.map(b => b.isClosed) : null }
            : null;
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
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error toggling close status: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! កំពុងត្រឡប់ស្ថានភាពដើមវិញ...");
            if (previousState) {
                const revertItem = scanHistory.find(i => i.id === id);
                if (revertItem) {
                    revertItem.isClosed = previousState.isClosed;
                    if (previousState.closedAt !== undefined) revertItem.closedAt = previousState.closedAt;
                    else delete revertItem.closedAt;
                    if (previousState.barcodeStates && revertItem.barcodes && Array.isArray(revertItem.barcodes)) {
                        revertItem.barcodes.forEach((b, i) => { if (previousState.barcodeStates[i] !== undefined) b.isClosed = previousState.barcodeStates[i]; });
                    }
                    applyCurrentFilter();
                }
            }
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
        delete itemToRestore.deletedAt;
        delete itemToRestore.isFromDeletion;
        if (itemToRestore.isClosed) {
            itemToRestore.closedAt = Date.now();
        } else {
            itemToRestore.createdAt = Date.now();
        }

        if (itemToRestore.barcodes && Array.isArray(itemToRestore.barcodes)) {
            // Matches ZoeAdmin's executeRestoreItem() exactly: credit straight off the barcode's
            // own isDeducted flag, no server-side dedup transaction. itemToRestore is a stable
            // snapshot spliced out of deletedItems before any await, so it can't be re-read as
            // "still deducted" by a second concurrent restore of the same trash entry -- and once
            // this function's own deleteSingleDeletedItemFromFirebase() call below removes the
            // entry from Firebase, a second restore attempt on it fails the deletedItems lookup
            // above instead of reaching this point. The transaction this replaced kept the barcode
            // marked isDeducted:true (skipping the credit) whenever it aborted for any reason
            // (e.g. the trash write from the 8-day auto-abandon path racing an early restore) --
            // exactly "removed correctly subtracts, but restore doesn't add it back".
            itemToRestore.barcodes.forEach((restoredBc) => {
                if (!restoredBc.isDeducted) return;
                const targetCod = parseFloat(restoredBc.cod) || 0;
                const targetDod = parseFloat(restoredBc.dod) || 0;
                addRevenueToDailyAndMonthlyRecord(itemToRestore.scanDate || getFormattedDate(), targetCod, targetDod, 1);
                restoredBc.isDeducted = false;
            });
        }

        let existingItemIndex = scanHistory.findIndex(i => i.id === itemToRestore.id || (itemToRestore.phone !== "គ្មានលេខ" && i.phone === itemToRestore.phone && itemToRestore.barcodes && i.barcodes && i.scanDate === itemToRestore.scanDate));

        let restoredResultItem;
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
                targetItem.closedAt = Date.now();
            } else {
                delete targetItem.closedAt;
            }
            restoredResultItem = targetItem;
        } else {
            scanHistory.push(itemToRestore);
            restoredResultItem = itemToRestore;
        }

        const restoredId = pendingRestoreId;
        closeModal('restoreWarningModal');
        pendingRestoreId = null;

        try {
            // Must be a targeted single-key delete (not the whole-list saveDeletedToFirebase(),
            // which diffs against the in-memory deletedItems array) -- the live onValue(dbRefDeleted)
            // listener can refresh that array from the server mid-flight (this function awaits a
            // revenue-credit transaction first), re-adding the item we just spliced out locally
            // before the diff-based save ever runs. That left the item permanently stuck in the
            // trash while still being re-pushed into history on every restore attempt, since the
            // history-side push already happened from the untouched local itemToRestore snapshot.
            await Promise.all([saveHistoryToFirebase(), deleteSingleDeletedItemFromFirebase(itemToRestore.id)]);
            syncScannerLookupEntry(restoredResultItem.id, restoredResultItem);
            openRecentlyDeletedModal();
            applyCurrentFilter();
            updateRecentPhonesList();
            showToast("បានស្តារទិន្នន័យមកទីតាំងដើមវិញដោយសុវត្ថិភាព!");
        } catch (error) {
            console.error("Restore failed: ", restoredId, error);
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Restore failed: " });
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
                if (window.ZoeErrors) ZoeErrors.capture(resyncError, { context: "Resync after failed restore also failed: " });
            }
            alert("❌ ស្តារទិន្នន័យបរាជ័យ! មូលហេតុ: " + (error && error.message ? error.message : error) + "\n\nសូមថតរូបអេក្រង់នេះ ហើយផ្ញើសួរអ្នកបច្ចេកទេស។");
            openRecentlyDeletedModal();
            applyCurrentFilter();
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
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error saving history: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase!");
            throw error;
        });
    }

    function patchHistoryItemFields(item, fields, previousFields) {
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
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error patching history item: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! កំពុងត្រឡប់ស្ថានភាពដើមវិញ...");
            if (previousFields) {
                const revertItem = scanHistory.find(i => i.id === item.id);
                if (revertItem) {
                    Object.keys(previousFields).forEach((key) => {
                        if (previousFields[key] === undefined) delete revertItem[key];
                        else revertItem[key] = previousFields[key];
                    });
                    applyCurrentFilter();
                }
            }
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
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error saving deleted items: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase!");
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
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error saving deleted item: " });
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
            if (window.ZoeErrors) ZoeErrors.capture(error, { context: "Error deleting deleted item: " });
            showToast("⚠️ បរាជ័យក្នុងការ Save ធុងសំរាមទៅ Firebase!");
            throw error;
        });
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

            let totalPackageCount = item.barcodes && Array.isArray(item.barcodes) ? item.barcodes.length : (parseFloat(item.count) || 1);
            let viewListBtn = `<button class="btn-view-list" onclick="openViewListModal('${escapeForInlineJsAttr(item.id)}')">📦 មើលកញ្ចប់ (${totalPackageCount})</button>`;

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

