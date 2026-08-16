(function () {
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

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then((reg) => {
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') reg.update().catch(() => {});
                });
                window.addEventListener('focus', () => reg.update().catch(() => {}));
            }).catch(() => {});
        });
        let swReloadedOnce = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (swReloadedOnce) return;
            // A Signing Key pasted into memory has nowhere else it's saved -- silently
            // reloading out from under an admin mid-session would just discard it
            // (see loadSigningKey below), reproducing the exact "have to paste it in
            // again" pain this update-checking change is otherwise meant to reduce.
            // Defer the reload until nothing would be lost by it.
            if (typeof signingPrivateKeyJwk !== 'undefined' && signingPrivateKeyJwk) {
                if (typeof showToast === 'function') {
                    showToast('🔄 មានកំណែថ្មី — សូម Refresh ដោយខ្លួនឯងពេលងាយ (ដើម្បីកុំបាត់ Signing Key ដែលកំពុង Load)');
                }
                return;
            }
            swReloadedOnce = true;
            window.location.reload();
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
            if (typeof fb.deleteApp === 'function') {
                await Promise.all(existingApps.map(a => fb.deleteApp(a).catch(() => {})));
            }
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

        setupAuthListener();
        return true;
    } catch (e) {
        console.error("Invalid Saved Config", e);
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

// Derives a session-only AES-GCM key from the Security PIN, used purely to encrypt the
// Signing Private Key at rest in sessionStorage when the admin opts in via the "remember"
// checkbox -- a different salt from hashPin()'s PBKDF2 above so the two derived values
// can never collide even though they share the same source PIN. Never itself persisted;
// re-derived fresh every time the PIN is entered (deterministic, so it always matches).
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
        // Wrong PIN (decrypt/auth failure) or corrupted blob -- drop it rather than keep
        // failing silently on every future reload; admin can re-load and re-remember it.
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
    openModalHelper('configModal');
}

function saveFirebaseConfig() {
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

    try {
        if (!fb || !auth) { fb = await waitForFirebaseSDK(); }
        await fb.setPersistence(auth, rememberCb && rememberCb.checked ? fb.browserLocalPersistence : fb.browserSessionPersistence);
        await fb.signInWithEmailAndPassword(auth, email, password);
        if (rememberCb && rememberCb.checked) localStorage.setItem('remembered_email', email);
        else localStorage.removeItem('remembered_email');
        if (passIn) passIn.value = '';
    } catch (e) {
        alert("ចូលប្រព័ន្ធមិនបានទេ! សូមពិនិត្យអ៊ីមែល/ពាក្យសម្ងាត់ម្តងទៀត។");
    }
}

async function verifyAdminRoleThenProceed(user) {
    try {
        const roleSnap = await fb.get(fb.ref(db, `user_roles/${user.uid}`));
        const role = roleSnap.val();
        if (role !== 'admin') {
            await fb.signOut(auth).catch(() => {});
            showLoginModalWithPrefill();
            showToast("⛔ គណនីនេះគ្មានសិទ្ធិចូល ZoeKeyGen ទេ! តម្រូវឲ្យជា Admin ប៉ុណ្ណោះ។");
            return;
        }
    } catch (e) {
        console.error("Role verification failed:", e);
        showToast("⚠️ មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិបានទេ!");
        return;
    }

    closeModal('loginModal');
    document.getElementById('appContainer').style.display = 'flex';
    showToast("ចូលប្រព័ន្ធជោគជ័យ!");
    refreshKeyList();
}

function setupAuthListener() {
    if (!auth) return;
    if (authUnsubscribe) { try { authUnsubscribe(); } catch (e) {} authUnsubscribe = null; }
    authUnsubscribe = fb.onAuthStateChanged(auth, (user) => {
        if (user) {
            verifyAdminRoleThenProceed(user);
        } else {
            showLoginModalWithPrefill();
        }
    });
}

function logoutApp() {
    if (!fb || !auth) return;
    fb.signOut(auth).then(() => {
        localStorage.removeItem('remembered_email');
        document.getElementById('appContainer').style.display = 'none';
        showLoginModalWithPrefill();
    });
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
        await window.ZoeLicense.signNewKey(jwk, { appCode: 'ADM', days: 1, note: '' });
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
    if (genBtn) { genBtn.disabled = true; genBtn.textContent = 'កំពុងបង្កើត...'; }

    try {
        const { keyString, payload } = await window.ZoeLicense.signNewKey(signingPrivateKeyJwk, {
            appCode: appSelect, days: days, note: note
        });

        const targetPaths = appSelect === 'ALL' ? ['ADM', 'ZOW', 'SCN'] : [appSelect];
        const record = {
            issuedAt: Date.now(),
            expiresAt: Date.now() + Math.round(days * 86400000),
            revoked: false,
            scope: appSelect,
            note: note || '',
            createdBy: auth.currentUser.email || auth.currentUser.uid
        };

        await Promise.all(targetPaths.map((p) => fb.set(fb.ref(db, `license_keys/${p}/${payload.id}`), record)));

        lastGeneratedKey = keyString;
        document.getElementById('genResultKey').textContent = keyString;
        document.getElementById('genResultBox').classList.remove('hidden');
        document.getElementById('genNoteInput').value = '';
        showToast('Key ត្រូវបានបង្កើត និងកត់ត្រាទុករួចរាល់!');
        refreshKeyList();
    } catch (e) {
        console.error(e);
        alert('មិនអាចបង្កើត Key បានទេ! សូមពិនិត្យការភ្ជាប់ Firebase និងសិទ្ធិគណនី។');
    } finally {
        isGeneratingKey = false;
        if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🔐 Generate Key'; }
    }
}

function copyGeneratedKey() {
    if (!lastGeneratedKey) return;
    navigator.clipboard?.writeText(lastGeneratedKey).then(() => showToast('បានចម្លង Key!')).catch(() => {});
}

let keyListCache = [];
const APP_LABELS = { ADM: 'ZoeAdmin', ZOW: 'ZoeW', SCN: 'Zscan', ALL: 'ទាំង ៣' };

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function refreshKeyList() {
    const tbody = document.getElementById('keyListBody');
    if (!tbody || !db) return;
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">កំពុងផ្ទុក...</td></tr>';
    try {
        const snap = await fb.get(fb.ref(db, 'license_keys'));
        const data = snap.exists() ? snap.val() : {};
        const seen = {};
        const rows = [];
        ['ADM', 'ZOW', 'SCN'].forEach((appCode) => {
            const bucket = data[appCode] || {};
            Object.keys(bucket).forEach((id) => {
                if (seen[id]) return;
                seen[id] = true;
                const rec = bucket[id] || {};
                const scope = rec.scope || appCode;
                const paths = scope === 'ALL' ? ['ADM', 'ZOW', 'SCN'] : [scope];
                rows.push(Object.assign({ id: id, scope: scope, paths: paths }, rec));
            });
        });
        rows.sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0));
        keyListCache = rows;
        renderKeyList();
    } catch (e) {
        console.error(e);
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
    const now = Date.now();
    tbody.innerHTML = keyListCache.map((row) => {
        let statusHtml;
        if (row.revoked) statusHtml = '<span class="badge badge-revoked">Revoked</span>';
        else if (row.expiresAt && now > row.expiresAt) statusHtml = '<span class="badge badge-expired">ផុតកំណត់</span>';
        else statusHtml = '<span class="badge badge-active">Active</span>';

        const expStr = row.expiresAt ? new Date(row.expiresAt).toLocaleDateString('km-KH') : '-';

        return `<tr>
            <td><span class="badge badge-scope">${escapeHtml(APP_LABELS[row.scope] || row.scope)}</span></td>
            <td>${escapeHtml(row.id)}</td>
            <td class="note-cell">${escapeHtml(row.note || '-')}</td>
            <td>${expStr}</td>
            <td>${statusHtml}</td>
            <td>
                <div class="btn-row">
                    <button class="btn-mini" onclick="toggleRevokeKey('${row.id}')">${row.revoked ? '✅ សង្គ្រោះ' : '⛔ Revoke'}</button>
                    <button class="btn-mini" onclick="openExtendModal('${row.id}')">⏳ បន្ថែម</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function toggleRevokeKey(id) {
    const row = keyListCache.find((r) => r.id === id);
    if (!row) return;
    const newRevoked = !row.revoked;
    if (!confirm(newRevoked ? 'តើអ្នកចង់ Revoke Key នេះមែនទេ? អ្នកប្រើប្រាស់នឹងលែងចូល App បានក្នុងពេលឆាប់ៗ។' : 'សង្គ្រោះ Key នេះមកវិញ?')) return;
    try {
        await Promise.all(row.paths.map((p) => fb.update(fb.ref(db, `license_keys/${p}/${id}`), { revoked: newRevoked })));
        showToast(newRevoked ? 'Key ត្រូវបាន Revoke!' : 'Key ត្រូវបានសង្គ្រោះមកវិញ!');
        refreshKeyList();
    } catch (e) {
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
    const newExpiresAt = Date.now() + Math.round(days * 86400000);
    try {
        await Promise.all(row.paths.map((p) => fb.update(fb.ref(db, `license_keys/${p}/${extendTargetId}`), { expiresAt: newExpiresAt })));
        showToast('បានបន្ថែមសុពលភាពរួចរាល់!');
        closeModal('extendModal');
        refreshKeyList();
    } catch (e) {
        alert('មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ!');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    updateSigningKeyBadge();

    // If a Signing Key was remembered (opted in via the checkbox) before this reload --
    // whether from a manual refresh, an OS backgrounding the app and later restoring it,
    // or our own SW-update reload -- prompt for the PIN to unlock it instead of leaving
    // the admin to paste the whole private key in again from their password manager.
    if (sessionStorage.getItem(SIGNING_KEY_SESSION_STORAGE_KEY)) {
        requestPinBeforeConfig(tryRestoreSigningKeyFromSession, 'បញ្ចូល PIN ដើម្បីស្ដារ Signing Key ដែលបានចងចាំពីមុន');
    }

    document.querySelectorAll('.modal').forEach((modal) => {
        modal.addEventListener('mousedown', (e) => {
            if (e.target === modal && modal.dataset.nodismiss !== 'true') {
                modal.classList.remove('active');
            }
        });
    });
});
