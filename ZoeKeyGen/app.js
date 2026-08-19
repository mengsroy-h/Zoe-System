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

    function checkDevTools() {
        if (isMobile) return;
        const widthThreshold = window.outerWidth - window.innerWidth > 160;
        const heightThreshold = window.outerHeight - window.innerHeight > 160;
        if (widthThreshold || heightThreshold) {
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
})();

let firebaseConfig = null;
let fb = null;
let auth = null;
let db = null;
let authUnsubscribe = null;
let isInitializingFirebase = false;
let dbRefConnected = null;
let dbRefServerTimeOffset = null;
let serverTimeOffsetMs = 0;
let serverTimeSynced = false;
let serverTimeSyncWaiters = [];

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

function showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
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

function openModalHelper(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
    if (id === 'keypairModal') {
        const out = document.getElementById('newPrivateKeyOutput');
        if (out) out.value = '';
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
        if (attempts <= 1) throw err;
        return new Promise((resolve) => setTimeout(resolve, delayMs)).then(() => retryAsync(fn, attempts - 1, delayMs * 2));
    });
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

async function initFirebase() {
    const savedConfig = localStorage.getItem('zoew_firebase_config');
    if (!savedConfig) {
        checkPinAndOpenConfig();
        return false;
    }
    if (isInitializingFirebase) return false;
    isInitializingFirebase = true;

    try {
        firebaseConfig = JSON.parse(savedConfig);
        fb = await waitForFirebaseSDK();

        const existingApps = fb.getApps();
        if (existingApps.length) {
            if (dbRefConnected) { try { fb.off(dbRefConnected); } catch (e) {} }
            if (dbRefServerTimeOffset) { try { fb.off(dbRefServerTimeOffset); } catch (e) {} }
            if (typeof fb.deleteApp === 'function') {
                await Promise.all(existingApps.map(a => fb.deleteApp(a).catch(() => {})));
            }
            serverTimeSynced = false;
            serverTimeOffsetMs = 0;
        }

        const firebaseApp = fb.getApps().length ? fb.getApps()[0] : fb.initializeApp(firebaseConfig);
        auth = fb.getAuth(firebaseApp);
        db = fb.getDatabase(firebaseApp);
        try { fb.goOnline(db); } catch (e) {}

        dbRefConnected = fb.ref(db, '.info/connected');
        fb.onValue(dbRefConnected, (snap) => {
            const dot = document.getElementById('statusDot');
            const txt = document.getElementById('firebaseStatusText');
            const online = snap.val() === true;
            if (dot) dot.classList.toggle('online', online);
            if (txt) txt.textContent = online ? 'ភ្ជាប់បណ្ដាញ' : 'ក្រៅបណ្ដាញ';
        });

        dbRefServerTimeOffset = fb.ref(db, '.info/serverTimeOffset');
        fb.onValue(dbRefServerTimeOffset, (snap) => {
            const val = snap.val();
            if (typeof val === 'number') serverTimeOffsetMs = val;
            serverTimeSynced = true;
            if (window.ZoeLicense) window.ZoeLicense.setServerTimeOffset(serverTimeOffsetMs);
            serverTimeSyncWaiters.splice(0).forEach((fn) => fn());
        });

        setupAuthListener();
        return true;
    } catch (e) {
        console.error("Invalid Saved Config", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Invalid Saved Config" });
        checkPinAndOpenConfig();
        return false;
    } finally {
        isInitializingFirebase = false;
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
    const savedPin = localStorage.getItem('zoew_security_pin_hash');
    if (!savedPin) {
        openModalHelper('pinSetupModal');
    } else {
        const pinIn = document.getElementById('securityPinInput');
        if (pinIn) pinIn.value = '';
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
    if (!signingKeySessionKey || !signingPrivateKeyJwk) return;
    try {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipherBuf = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv }, signingKeySessionKey, new TextEncoder().encode(JSON.stringify(signingPrivateKeyJwk))
        );
        sessionStorage.setItem(SIGNING_KEY_SESSION_STORAGE_KEY, JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(cipherBuf)) }));
        showToast('🔒 Signing Key ត្រូវបានចងចាំសម្រាប់ Session នេះ (Encrypted ដោយ PIN)');
    } catch (e) {}
}

async function tryRestoreSigningKeyFromSession() {
    if (signingPrivateKeyJwk || !signingKeySessionKey) return;
    const raw = sessionStorage.getItem(SIGNING_KEY_SESSION_STORAGE_KEY);
    if (!raw) return;
    try {
        const encObj = JSON.parse(raw);
        const plainBuf = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(encObj.iv) }, signingKeySessionKey, new Uint8Array(encObj.data)
        );
        signingPrivateKeyJwk = JSON.parse(new TextDecoder().decode(plainBuf));
        updateSigningKeyBadge();
        const cb = document.getElementById('rememberSigningKeyCheckbox');
        if (cb) cb.checked = true;
        showToast('🔓 Signing Key ត្រូវបានស្ដារមកវិញ!');
    } catch (e) {

        sessionStorage.removeItem(SIGNING_KEY_SESSION_STORAGE_KEY);
        showToast('⚠️ មិនអាចដោះសោ Signing Key ដែលបានចងចាំបានទេ — សូម Load Key ម្តងទៀត');
    }
}

async function saveNewSecurityPin() {
    const newPinIn = document.getElementById('newSecurityPinInput');
    const pinVal = newPinIn ? newPinIn.value.trim() : '';
    if (!pinVal || pinVal.length < 6) {
        alert("Security PIN ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ ដើម្បីសុវត្ថិភាព!");
        return;
    }
    try {
        localStorage.setItem('zoew_security_pin_hash', await hashPin(pinVal));
        signingKeySessionKey = await deriveSigningKeySessionKey(pinVal);
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
    const enteredPin = pinIn ? pinIn.value.trim() : '';
    if (pinIn) pinIn.value = '';
    const savedPin = localStorage.getItem('zoew_security_pin_hash');

    const lockoutUntil = parseInt(localStorage.getItem('zoew_pin_lockout_until') || '0');
    if (lockoutUntil && Date.now() < lockoutUntil) {
        const secondsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
        alert(`បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ${secondsLeft} វិនាទី។`);
        return;
    }

    isVerifyingPin = true;
    try {
        if (savedPin && (await verifyStoredPin(enteredPin, savedPin))) {
            localStorage.removeItem('zoew_pin_fail_count');
            localStorage.removeItem('zoew_pin_lockout_until');
            signingKeySessionKey = await deriveSigningKeySessionKey(enteredPin);
            closeModal('pinModal');
            (pinTargetAction || openConfigModal)();
        } else {
            const failCount = (parseInt(localStorage.getItem('zoew_pin_fail_count') || '0') || 0) + 1;
            if (failCount >= 5) {
                localStorage.setItem('zoew_pin_lockout_until', (Date.now() + 60000).toString());
                localStorage.setItem('zoew_pin_fail_count', '0');
                alert("បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ១ នាទី។");
            } else {
                localStorage.setItem('zoew_pin_fail_count', failCount.toString());
                alert("លេខ PIN មិនត្រឹមត្រូវទេ!");
            }
        }
    } catch (e) {
        alert("មិនអាចផ្ទៀងផ្ទាត់ PIN បានទេ!");
    } finally {
        isVerifyingPin = false;
    }
}

function checkPinAndOpenConfig() {
    const savedPin = localStorage.getItem('zoew_security_pin_hash');
    if (!savedPin) openModalHelper('pinSetupModal');
    else requestPinBeforeConfig(openConfigModal);
}

function openConfigFlow() {
    requestPinBeforeConfig(openConfigModal);
}

function openConfigModal() {
    const savedConfig = localStorage.getItem('zoew_firebase_config');
    if (savedConfig) {
        const cfgInput = document.getElementById('firebaseConfigInput');
        if (cfgInput) cfgInput.value = savedConfig;
    }
    const dsnInput = document.getElementById('sentryDsnInput');
    if (dsnInput && window.ZoeErrors) dsnInput.value = ZoeErrors.getDsn();
    openModalHelper('configModal');
}

function saveFirebaseConfig() {
    const dsnInput = document.getElementById('sentryDsnInput');
    if (dsnInput && window.ZoeErrors) {
        ZoeErrors.setDsn(dsnInput.value);
        ZoeErrors.init('zoekeygen');
    }
    const cfgInput = document.getElementById('firebaseConfigInput');
    if (!cfgInput) return;
    const raw = cfgInput.value.trim();
    if (!raw) { alert("សូមបញ្ចូល Firebase Config!"); return; }
    try {
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (strictErr) {
            const cleanStr = raw
                .replace(/([{,]\s*)(['"]?)([a-zA-Z0-9_]+)\2(\s*):/g, '$1"$3"$4:')
                .replace(/'/g, '"')
                .replace(/,(\s*[}\]])/g, '$1');
            parsed = JSON.parse(cleanStr);
        }
        if (!parsed.apiKey || !parsed.databaseURL) throw new Error("Missing apiKey or databaseURL");

        localStorage.setItem('zoew_firebase_config', JSON.stringify(parsed));
        showToast("ភ្ជាប់ Config រួចរាល់! កំពុង Re-initialize...");
        closeModal('configModal');
        initFirebase();
    } catch (e) {
        alert("ការកំណត់រចនាសម្ព័ន្ធមិនត្រឹមត្រូវទេ!");
    }
}

function showLoginModalWithPrefill() {
    document.getElementById('appContainer').style.display = 'none';
    keyListSessionGeneration++;
    keyListCache = [];
    const keyListBody = document.getElementById('keyListBody');
    if (keyListBody) keyListBody.innerHTML = '';
    document.querySelectorAll('.modal').forEach((m) => {
        if (m.id !== 'loginModal') closeModal(m.id);
    });

    lastGeneratedKey = '';
    const genResultKey = document.getElementById('genResultKey');
    if (genResultKey) genResultKey.textContent = '';
    const genResultBox = document.getElementById('genResultBox');
    if (genResultBox) genResultBox.classList.add('hidden');

    lastGeneratedSetupLink = '';
    const setupLinkConfigInput = document.getElementById('setupLinkConfigInput');
    if (setupLinkConfigInput) setupLinkConfigInput.value = '';
    const setupLinkResultText = document.getElementById('setupLinkResultText');
    if (setupLinkResultText) setupLinkResultText.textContent = '';
    const setupLinkResultBox = document.getElementById('setupLinkResultBox');
    if (setupLinkResultBox) setupLinkResultBox.classList.add('hidden');

    clearSigningKey();
    openModalHelper('loginModal');
    const savedEmail = localStorage.getItem('remembered_email');
    const emailInput = document.getElementById('loginEmailInput');
    const rememberCb = document.getElementById('rememberMeCheckbox');
    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
        if (rememberCb) rememberCb.checked = true;
    }
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
        await fb.setPersistence(auth, rememberCb && rememberCb.checked ? fb.browserLocalPersistence : fb.browserSessionPersistence);
        await withTimeout(fb.signInWithEmailAndPassword(auth, email, password), 15000, 'Login timed out');
        if (rememberCb && rememberCb.checked) localStorage.setItem('remembered_email', email);
        else localStorage.removeItem('remembered_email');
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

async function verifyAdminRoleThenProceed(user) {
    try {
        const roleSnap = await withTimeout(fb.get(fb.ref(db, `user_roles/${user.uid}`)), 15000, 'Role check timed out');
        const role = roleSnap.val();
        if (role !== 'admin') {
            await fb.signOut(auth).catch(() => {});
            showToast("⛔ គណនីនេះគ្មានសិទ្ធិចូល ZoeKeyGen ទេ! តម្រូវឲ្យជា Admin ប៉ុណ្ណោះ។");
            return;
        }
    } catch (e) {
        console.error("Role verification failed:", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Role verification failed:" });
        await fb.signOut(auth).catch(() => {});
        showToast("⚠️ មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិបានទេ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងចូលម្តងទៀត។");
        return;
    }

    closeModal('loginModal');
    document.getElementById('appContainer').style.display = 'flex';
    updateAuthButton(true);
    showToast("ចូលប្រព័ន្ធជោគជ័យ!");
    refreshKeyList();
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
    if (authUnsubscribe) { try { authUnsubscribe(); } catch (e) {} authUnsubscribe = null; }

    const initialAuthTimeout = setTimeout(() => { attemptAuthStorageRecovery(); }, 8000);
    authUnsubscribe = fb.onAuthStateChanged(auth, (user) => {
        clearTimeout(initialAuthTimeout);
        if (user) {
            verifyAdminRoleThenProceed(user);
        } else {
            updateAuthButton(false);
            showLoginModalWithPrefill();
        }
    });
}

function logoutApp() {
    if (!fb || !auth) return;
    fb.signOut(auth).then(() => {
        localStorage.removeItem('remembered_email');
        document.getElementById('appContainer').style.display = 'none';
        updateAuthButton(false);
        showLoginModalWithPrefill();
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

async function loadSigningKey() {
    const input = document.getElementById('privateKeyInput');
    const raw = input.value.trim();
    if (!raw) { alert('សូមបិទភ្ជាប់ Private Key JWK សិន!'); return; }
    try {
        const jwk = JSON.parse(raw);
        if (!jwk.d || jwk.kty !== 'EC' || jwk.crv !== 'P-256') throw new Error('invalid key shape');
        const { keyString } = await window.ZoeLicense.signNewKey(jwk, { appCode: 'ADM', days: 1, note: '' });
        const verifyResult = await window.ZoeLicense.verifyKeyString(keyString, 'ADM');
        if (!verifyResult.valid) throw new Error('private key does not pair with the shipped public key');
        signingPrivateKeyJwk = jwk;
        input.value = '';
        updateSigningKeyBadge();
        showToast('Signing Key ត្រូវបាន Load ដោយជោគជ័យ!');

        const rememberCb = document.getElementById('rememberSigningKeyCheckbox');
        if (rememberCb && rememberCb.checked) {
            if (signingKeySessionKey) {
                await persistSigningKeyForSession();
            } else {
                requestPinBeforeConfig(persistSigningKeyForSession, 'បញ្ចូល PIN ដើម្បីចងចាំ Signing Key នេះសម្រាប់ Session នេះ');
            }
        }
    } catch (e) {
        alert('Private Key មិនត្រឹមត្រូវទេ! សូមពិនិត្យ JSON JWK (ECDSA P-256) ម្តងទៀត។');
    }
}

function clearSigningKey() {
    signingPrivateKeyJwk = null;
    document.getElementById('privateKeyInput').value = '';
    sessionStorage.removeItem(SIGNING_KEY_SESSION_STORAGE_KEY);
    const rememberCb = document.getElementById('rememberSigningKeyCheckbox');
    if (rememberCb) rememberCb.checked = false;
    updateSigningKeyBadge();
    showToast('បានសម្អាត Signing Key ចេញពីសតិ');
}

async function generateNewKeypair() {
    if (!confirm('ការបង្កើត Keypair ថ្មីនឹងធ្វើឲ្យ Key ចាស់ៗប្រើលែងកើត លុះត្រាតែអ្នកយក Public Key ថ្មីទៅដាក់ជំនួសក្នុង license-verify.js របស់គ្រប់ App ។ បន្តទេ?')) return;
    try {
        const { publicKeyJwk, privateKeyJwk } = await window.ZoeLicense.generateKeyPair();
        document.getElementById('newPrivateKeyOutput').value = JSON.stringify(privateKeyJwk);
        document.getElementById('newPublicKeyOutput').value = JSON.stringify(publicKeyJwk);
        openModalHelper('keypairModal');
    } catch (e) {
        alert('មិនអាចបង្កើត Keypair បានទេ!');
    }
}

function copyTextarea(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.removeAttribute('readonly');
    el.select();
    el.setAttribute('readonly', 'true');
    navigator.clipboard?.writeText(el.value).then(() => showToast('បានចម្លង!')).catch(() => {
        try { document.execCommand('copy'); showToast('បានចម្លង!'); } catch (e) {}
    });
}

let lastGeneratedKey = '';

let isGeneratingKey = false;

async function generateLicenseKey() {
    if (isGeneratingKey) return;
    if (!signingPrivateKeyJwk) { alert('សូម Load Signing Key សិន (មើលប្រអប់ខាងលើ)!'); return; }
    if (!db || !auth || !auth.currentUser) { alert('សូមចូលប្រព័ន្ធ និងភ្ជាប់ Firebase សិន!'); return; }

    const appSelect = document.getElementById('genAppSelect').value;
    const days = parseFloat(document.getElementById('genDaysInput').value) || 0;
    const note = document.getElementById('genNoteInput').value.trim();

    if (days <= 0) { alert('សុពលភាពត្រូវធំជាង 0 ថ្ងៃ!'); return; }

    const genBtn = document.getElementById('genGenerateBtn');
    isGeneratingKey = true;
    if (genBtn) { genBtn.disabled = true; genBtn.textContent = 'កំពុងផ្ទៀងផ្ទាត់ម៉ោង Server...'; }

    const timeSynced = await waitForServerTimeSync(15000);
    if (!timeSynced) {
        isGeneratingKey = false;
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🔐 Generate Key'; }
        alert('មិនអាចផ្ទៀងផ្ទាត់ម៉ោង Server បានទេ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត (ដើម្បីកុំឲ្យថ្ងៃចេញ/ផុតកំណត់របស់ Key ខុសពីម៉ោងម៉ាស៊ីនរបស់អ្នក)។');
        return;
    }
    if (genBtn) { genBtn.textContent = 'កំពុងបង្កើត...'; }

    const myGeneration = keyListSessionGeneration;
    try {
        const { keyString, payload } = await window.ZoeLicense.signNewKey(signingPrivateKeyJwk, {
            appCode: appSelect, days: days, note: note
        });

        const targetPaths = appSelect === 'ALL' ? ['ADM', 'ZOW', 'SCN'] : [appSelect];
        const publicRecord = {
            expiresAt: getServerNow() + Math.round(days * 86400000),
            revoked: false
        };
        const metaRecord = {
            issuedAt: getServerNow(),
            scope: appSelect,
            note: note || '',
            createdBy: auth.currentUser.email || auth.currentUser.uid
        };

        let generateAlreadyTimedOut = false;
        const writePromise = Promise.allSettled(targetPaths.map((p) => retryAsync(() => fb.update(fb.ref(db), {
            [`license_keys/${p}/${payload.id}`]: publicRecord,
            [`license_keys_meta/${p}/${payload.id}`]: metaRecord
        }), 3, 1000)));
        writePromise.then((bgResults) => {
            if (!generateAlreadyTimedOut) return;
            if (myGeneration !== keyListSessionGeneration) return;
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
        const failedPaths = targetPaths.filter((p, i) => results[i].status === 'rejected');
        const succeededPaths = targetPaths.filter((p) => !failedPaths.includes(p));

        if (succeededPaths.length === 0) {
            throw (results.find((r) => r.status === 'rejected') || {}).reason || new Error('Generate key failed');
        }

        let appPathsTagFailed = false;
        if (failedPaths.length > 0) {
            const tagResults = await Promise.allSettled(succeededPaths.map((p) => retryAsync(() => fb.update(fb.ref(db, `license_keys_meta/${p}/${payload.id}`), { appPaths: succeededPaths }), 3, 1000)));
            appPathsTagFailed = tagResults.some((r) => r.status === 'rejected');
            if (appPathsTagFailed) {
                const tagErr = (tagResults.find((r) => r.status === 'rejected') || {}).reason || new Error('appPaths tagging failed');
                console.error('Failed to tag appPaths after partial key generation', tagErr);
                if (window.ZoeErrors) ZoeErrors.capture(tagErr, { context: 'generateLicenseKey appPaths tagging failed after retries', keyId: payload.id, succeededPaths, failedPaths });
            }
        }

        lastGeneratedKey = keyString;
        document.getElementById('genResultKey').textContent = keyString;
        document.getElementById('genResultBox').classList.remove('hidden');
        document.getElementById('genNoteInput').value = '';

        if (failedPaths.length === 0) {
            showToast('Key ត្រូវបានបង្កើត និងកត់ត្រាទុករួចរាល់!');
        } else {
            const extraWarning = appPathsTagFailed
                ? '\n\n⚠️ បន្ថែមទៀត Key List នៅក្នុង App នេះប្រហែលជាមិនបង្ហាញត្រឹមត្រូវថា Key នេះ Active នៅ App ណាខ្លះទេ — សូមពិនិត្យផ្ទាល់នៅ Firebase Console (path license_keys) មុននឹង Revoke ឬបន្ថែមសុពលភាព Key នេះ។'
                : '';
            alert(`⚠️ ជោគជ័យមិនពេញលេញ! Key នេះកត់ត្រាទុកសម្រាប់តែ App: ${succeededPaths.join(', ')}\nបរាជ័យសម្រាប់: ${failedPaths.join(', ')} — Key នេះនឹងមិនអាចប្រើប្រាស់នៅ App ដែលបរាជ័យទេ លុះត្រាតែបង្កើត Key ថ្មីដាច់ដោយឡែកសម្រាប់ App នោះ។${extraWarning}`);
        }
        refreshKeyList();
    } catch (e) {
        console.error(e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'generateLicenseKey' });
        alert(e && e.message === 'Generate key timed out'
            ? 'អស់ពេល (Timeout)! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។'
            : 'មិនអាចបង្កើត Key បានទេ! សូមពិនិត្យការភ្ជាប់ Firebase និងសិទ្ធិគណនី។');
    } finally {
        isGeneratingKey = false;
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🔐 Generate Key'; }
    }
}

function copyGeneratedKey() {
    if (!lastGeneratedKey) return;
    navigator.clipboard?.writeText(lastGeneratedKey).then(() => showToast('បានចម្លង Key!')).catch(() => {});
}

const SETUP_LINK_URL_KEYS = { ADM: 'zoekeygen_setup_url_ADM', ZOW: 'zoekeygen_setup_url_ZOW', SCN: 'zoekeygen_setup_url_SCN' };
let lastGeneratedSetupLink = '';

function onSetupLinkAppChange() {
    const sel = document.getElementById('setupLinkAppSelect');
    const urlInput = document.getElementById('setupLinkUrlInput');
    if (!sel || !urlInput) return;
    const storageKey = SETUP_LINK_URL_KEYS[sel.value];
    urlInput.value = storageKey ? (localStorage.getItem(storageKey) || '') : '';
}

function generateSetupLink() {
    const sel = document.getElementById('setupLinkAppSelect');
    const urlInput = document.getElementById('setupLinkUrlInput');
    const cfgInput = document.getElementById('setupLinkConfigInput');
    const resultBox = document.getElementById('setupLinkResultBox');
    const resultText = document.getElementById('setupLinkResultText');
    if (!sel || !urlInput || !cfgInput) return;

    const appCode = sel.value;
    if (!appCode) { alert('សូមជ្រើសរើសកម្មវិធីគោលដៅ!'); return; }

    const baseUrl = urlInput.value.trim().replace(/\/+$/, '');
    if (!/^https:\/\/.+/.test(baseUrl)) { alert('សូមបញ្ចូល Base URL ត្រឹមត្រូវ (ចាប់ផ្តើមដោយ https://)!'); return; }

    const raw = cfgInput.value.trim();
    if (!raw) { alert('សូមបញ្ចូល Firebase Config!'); return; }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        alert('Firebase Config JSON មិនត្រឹមត្រូវទេ!');
        return;
    }
    if (!parsed.apiKey || !parsed.databaseURL) {
        alert('Firebase Config ត្រូវមាន apiKey និង databaseURL!');
        return;
    }

    const storageKey = SETUP_LINK_URL_KEYS[appCode];
    if (storageKey) localStorage.setItem(storageKey, baseUrl);

    let b64;
    try {
        b64 = btoa(unescape(encodeURIComponent(JSON.stringify(parsed))));
    } catch (e) {
        alert('មិនអាចបង្កើត Link បានទេ! សូមពិនិត្យ Config JSON');
        return;
    }

    lastGeneratedSetupLink = baseUrl + '/?setup=' + encodeURIComponent(b64);
    if (resultText) resultText.textContent = lastGeneratedSetupLink;
    if (resultBox) resultBox.classList.remove('hidden');
}

function copySetupLink() {
    if (!lastGeneratedSetupLink) return;
    navigator.clipboard?.writeText(lastGeneratedSetupLink).then(() => showToast('បានចម្លង Link!')).catch(() => {});
}

let keyListCache = [];
let keyListSessionGeneration = 0;
const APP_LABELS = { ADM: 'ZoeAdmin', ZOW: 'ZoeW', SCN: 'Zoescan', ALL: 'ទាំង ៣' };

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function refreshKeyList() {
    const tbody = document.getElementById('keyListBody');
    if (!tbody || !db) return;
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">កំពុងផ្ទុក...</td></tr>';
    const myGeneration = keyListSessionGeneration;
    try {
        const [publicSnap, metaSnap] = await withTimeout(Promise.all([
            fb.get(fb.ref(db, 'license_keys')),
            fb.get(fb.ref(db, 'license_keys_meta'))
        ]), 15000, 'Refresh timed out');
        if (myGeneration !== keyListSessionGeneration) return;
        const publicData = publicSnap.exists() ? publicSnap.val() : {};
        const metaData = metaSnap.exists() ? metaSnap.val() : {};

        const byId = {};
        ['ADM', 'ZOW', 'SCN'].forEach((appCode) => {
            const bucket = publicData[appCode] || {};
            Object.keys(bucket).forEach((id) => {
                if (!byId[id]) byId[id] = { id: id, existsIn: [], record: {} };
                byId[id].existsIn.push(appCode);
                Object.assign(byId[id].record, bucket[id]);
            });
        });

        const rows = Object.keys(byId).map((id) => {
            const entry = byId[id];
            const metaAppCode = entry.existsIn.find((appCode) => metaData[appCode] && metaData[appCode][id]) || entry.existsIn[0];
            const meta = (metaData[metaAppCode] && metaData[metaAppCode][id]) || {};
            const paths = entry.existsIn.slice().sort();
            const scope = meta.scope || (paths.length > 1 ? 'ALL' : paths[0]);
            return Object.assign({ id: id, scope: scope, paths: paths }, entry.record, meta);
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

        const isPartialAll = row.scope === 'ALL' && Array.isArray(row.paths) && row.paths.length > 0 && row.paths.length < 3;
        const scopeLabel = escapeHtml(APP_LABELS[row.scope] || row.scope);
        const scopeHtml = isPartialAll
            ? `<span class="badge badge-scope" title="${escapeHtml('សកម្មតែលើ: ' + row.paths.map((p) => APP_LABELS[p] || p).join(', '))}">${scopeLabel} ⚠️</span>`
            : `<span class="badge badge-scope">${scopeLabel}</span>`;

        return `<tr>
            <td>${scopeHtml}</td>
            <td>${escapeHtml(row.id)}</td>
            <td class="note-cell">${escapeHtml(row.note || '-')}</td>
            <td>${expStr}</td>
            <td>${statusHtml}</td>
            <td>
                <div class="btn-row">
                    <button class="btn-mini" data-key-id="${escapeHtml(row.id)}" data-action="revoke">${row.revoked ? '✅ សង្គ្រោះ' : '⛔ Revoke'}</button>
                    <button class="btn-mini" data-key-id="${escapeHtml(row.id)}" data-action="extend">⏳ បន្ថែម</button>
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

        ['ADM', 'ZOW', 'SCN'].forEach((appCode) => {
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
            showToast('គ្មាន Key ចាស់ត្រូវការ Migrate ទេ — ស្អាតរួចហើយ!');
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
    const row = keyListCache.find((r) => r.id === id);
    if (!row) return;
    const newRevoked = !row.revoked;
    if (!confirm(newRevoked ? 'តើអ្នកចង់ Revoke Key នេះមែនទេ? អ្នកប្រើប្រាស់នឹងលែងចូល App បានក្នុងពេលឆាប់ៗ។' : 'សង្គ្រោះ Key នេះមកវិញ?')) return;
    try {
        const results = await withTimeout(Promise.allSettled(row.paths.map((p) => fb.update(fb.ref(db, `license_keys/${p}/${id}`), { revoked: newRevoked }))), 15000, 'Update timed out');
        const failedPaths = row.paths.filter((p, i) => results[i].status === 'rejected');
        if (failedPaths.length === 0) {
            showToast(newRevoked ? 'Key ត្រូវបាន Revoke!' : 'Key ត្រូវបានសង្គ្រោះមកវិញ!');
        } else if (failedPaths.length < row.paths.length) {
            alert(`⚠️ ជោគជ័យមិនពេញលេញ! Key ត្រូវបាន${newRevoked ? ' Revoke' : 'សង្គ្រោះ'}សម្រាប់ App: ${row.paths.filter(p => !failedPaths.includes(p)).join(', ')}\nបរាជ័យសម្រាប់: ${failedPaths.join(', ')} — សូមសាកល្បងម្តងទៀត ព្រោះ Key នេះនៅតែអាចប្រើបានលើ App ដែលបរាជ័យ!`);
        } else {
            alert('មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ!');
        }
        refreshKeyList();
    } catch (e) {
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'toggleRevokeKey' });
        alert('មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ!');
    }
}

let extendTargetId = null;

function openExtendModal(id) {
    extendTargetId = id;
    document.getElementById('extendDaysInput').value = 30;
    openModalHelper('extendModal');
}

async function confirmExtendKey() {
    const row = keyListCache.find((r) => r.id === extendTargetId);
    if (!row) { closeModal('extendModal'); return; }
    const days = parseFloat(document.getElementById('extendDaysInput').value);
    if (isNaN(days) || days <= 0) { alert('សុពលភាពត្រូវធំជាង 0 ថ្ងៃ!'); return; }
    const timeSynced = await waitForServerTimeSync(15000);
    if (!timeSynced) {
        alert('មិនអាចផ្ទៀងផ្ទាត់ម៉ោង Server បានទេ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។');
        return;
    }
    const newExpiresAt = getServerNow() + Math.round(days * 86400000);
    try {
        const results = await withTimeout(Promise.allSettled(row.paths.map((p) => fb.update(fb.ref(db, `license_keys/${p}/${extendTargetId}`), { expiresAt: newExpiresAt }))), 15000, 'Update timed out');
        const failedPaths = row.paths.filter((p, i) => results[i].status === 'rejected');
        if (failedPaths.length === 0) {
            showToast('បានបន្ថែមសុពលភាពរួចរាល់!');
        } else if (failedPaths.length < row.paths.length) {
            alert(`⚠️ ជោគជ័យមិនពេញលេញ! សូមសាកល្បងម្តងទៀតសម្រាប់ App: ${failedPaths.join(', ')}`);
        } else {
            alert('មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ!');
        }
        closeModal('extendModal');
        refreshKeyList();
    } catch (e) {
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'confirmExtendKey' });
        alert('មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ!');
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
    setupIOSPullToRefresh();

    if (sessionStorage.getItem(SIGNING_KEY_SESSION_STORAGE_KEY)) {
        requestPinBeforeConfig(tryRestoreSigningKeyFromSession, 'បញ្ចូល PIN ដើម្បីស្ដារ Signing Key ដែលបានចងចាំពីមុន');
    }

    document.querySelectorAll('.modal').forEach((modal) => {
        modal.addEventListener('mousedown', (e) => {
            if (e.target === modal && modal.dataset.nodismiss !== 'true') {
                closeModal(modal.id);
            }
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
        });
    }
});
