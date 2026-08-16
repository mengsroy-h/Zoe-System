let app, auth, db, dbRefHistory, dbRefConnected;
let currentUserEmail = null;
let historyData = {};
let barcodeIndex = {};
let activeLocker = localStorage.getItem('zscan_active_locker') || '';
let currentTab = 'scan';
let pinTargetAction = null;
let pendingLocationCode = null;

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}
function sanitizePhoneNumber(phone) {
    if (!phone) return '';
    let trimmed = String(phone).trim();
    trimmed = trimmed.replace(/^(\+?855-?)/, '0');
    return trimmed;
}
function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.innerText = msg;
    toast.className = "show";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 2500);
}
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function dismissModal(modalEl) {
    if (!modalEl || modalEl.hasAttribute('data-nodismiss')) return;
    const fnName = modalEl.getAttribute('data-close');
    if (fnName && typeof window[fnName] === 'function') {
        window[fnName]();
    } else {
        closeModal(modalEl.id);
    }
}
function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
}
function playSuccessFeedback() { playBeep(); if (navigator.vibrate) navigator.vibrate(150); }
function playErrorFeedback() { if (navigator.vibrate) navigator.vibrate([100, 60, 100]); }

function waitForFirebaseSDK() {
    return new Promise((resolve, reject) => {
        if (window.firebaseSDK) return resolve();
        const timeout = setTimeout(() => reject(new Error('Firebase SDK timeout')), 15000);
        window.addEventListener('firebasesdkready', () => { clearTimeout(timeout); resolve(); }, { once: true });
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

function parseFirebaseConfigLenient(raw) {
    raw = (raw || '').trim();
    try { return JSON.parse(raw); } catch (e) {}
    let fixed = raw
        .replace(/'/g, '"')
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
    return JSON.parse(fixed);
}

function addPreconnect(origin) {
    if (!origin) return;
    try {
        const url = new URL(origin);
        if ([...document.querySelectorAll('link[rel=preconnect]')].some(l => l.href === url.origin + '/')) return;
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = url.origin;
        link.crossOrigin = '';
        document.head.appendChild(link);
    } catch (e) {}
}

async function initFirebase() {
    const raw = localStorage.getItem('zoew_firebase_config');
    if (!raw) { openConfigModal(); return; }
    let cfg;
    try { cfg = JSON.parse(raw); } catch (e) { openConfigModal(); return; }

    addPreconnect(cfg.databaseURL);
    if (cfg.authDomain) addPreconnect(`https://${cfg.authDomain}`);

    await waitForFirebaseSDK();
    const sdk = window.firebaseSDK;
    if (sdk.getApps().length) { app = sdk.getApps()[0]; } else { app = sdk.initializeApp(cfg); }
    auth = sdk.getAuth(app);
    db = sdk.getDatabase(app);
    try { sdk.goOnline(db); } catch (e) {}
    dbRefHistory = sdk.ref(db, 'zoew_scan_history_cod_dod');
    dbRefConnected = sdk.ref(db, '.info/connected');

    sdk.onValue(dbRefConnected, (snap) => {
        const online = snap.val() === true;
        document.getElementById('statusDot').classList.toggle('offline', !online);
        document.getElementById('firebaseStatusText').textContent = online ? 'ភ្ជាប់ Server រួចរាល់' : 'ក្រៅបណ្ដាញ';
    });

    sdk.onAuthStateChanged(auth, (user) => {
        document.getElementById('bootLoading').classList.add('hidden');
        if (user) {
            verifyRoleThenProceed(user);
        } else {
            currentUserEmail = null;
            detachDatabaseListeners();
            document.getElementById('lockerPickerScreen').classList.add('hidden');
            document.getElementById('appScreen').classList.add('hidden');
            document.getElementById('logoutBtn').style.display = 'none';
            closeModal('activationModal');
            openModal('loginModal');
            const remembered = localStorage.getItem('remembered_email');
            if (remembered) document.getElementById('loginEmailInput').value = remembered;
        }
    });

    setInterval(async () => {
        if (auth && auth.currentUser) {
            if (await isFirebaseSessionExpired(auth.currentUser)) forceExpireSession();
        }
    }, 60000);

    setInterval(() => {
        if (auth && auth.currentUser && listenersAttached && !isAnyModalOpen()) {
            ensureAppActivated().catch((e) => { if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'periodic ensureAppActivated' }); });
        }
    }, LICENSE_RECHECK_INTERVAL_MS);
}

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
async function isFirebaseSessionExpired(user) {
    try {
        const authTimeMs = new Date((await window.firebaseSDK.getIdTokenResult(user)).authTime).getTime();
        if (isNaN(authTimeMs)) return false;
        return (Date.now() - authTimeMs) > FOUR_HOURS_MS;
    } catch (e) {
        return false;
    }
}
function forceExpireSession() {
    const doneFn = () => showToast('ផុតកំណត់ ៤ ម៉ោងហើយ! សូមវាយពាក្យសម្ងាត់ និងចុចចូលប្រព័ន្ធម្ដងទៀត។');
    window.firebaseSDK.signOut(auth).then(doneFn).catch(doneFn);
}

const LICENSE_APP_CODE = 'SCN';
const LICENSE_RECHECK_INTERVAL_MS = 15 * 60 * 1000;

function licenseFailureMessage(reason) {
    switch (reason) {
        case 'app-mismatch': return 'Key នេះមិនមែនសម្រាប់ Zscan ទេ!';
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
            : 'សូមបញ្ចូល Activation Key សម្រាប់ Zscan ដើម្បីបន្ត។';
    }
    openModal('activationModal');
    const keyInput = document.getElementById('activationKeyInput');
    if (keyInput) keyInput.focus();
    return false;
}

async function submitActivationKey() {
    const input = document.getElementById('activationKeyInput');
    const keyStr = input ? input.value.trim() : '';
    if (!keyStr) { showToast('សូមបញ្ចូល Activation Key!'); return; }
    const result = await ZoeLicense.activate(keyStr, LICENSE_APP_CODE);
    if (!result.valid) {
        showToast(licenseFailureMessage(result.reason));
        return;
    }
    if (input) input.value = '';
    const activated = await ensureAppActivated();
    if (activated) {
        showToast('✅ Active ជោគជ័យ!');
        document.getElementById('logoutBtn').style.display = '';
        initDatabaseListeners();
        showLockerPicker(true);
    }
}

async function verifyRoleThenProceed(user) {
    let role;
    try {
        const roleSnap = await withTimeout(window.firebaseSDK.get(window.firebaseSDK.ref(db, `user_roles/${user.uid}`)), 15000, 'Role check timed out');
        role = roleSnap.val();
    } catch (e) {
        console.error('Role verification failed:', e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'Role verification failed:' });
        await window.firebaseSDK.signOut(auth).catch(() => {});
        currentUserEmail = null;
        openModal('loginModal');
        showToast('⚠️ មិនអាចផ្ទៀងផ្ទាត់សិទ្ធិចូលប្រព័ន្ធបានទេ! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងចូលម្តងទៀត។');
        return;
    }
    if (role !== 'admin' && role !== 'worker' && role !== 'scanner') {
        await window.firebaseSDK.signOut(auth).catch(() => {});
        currentUserEmail = null;
        openModal('loginModal');
        showToast('⛔ គណនីនេះគ្មានសិទ្ធិចូល Zscan ទេ!');
        return;
    }

    const activated = await ensureAppActivated();
    if (!activated) {
        closeModal('loginModal');
        return;
    }

    currentUserEmail = user.email || null;
    closeModal('loginModal');
    document.getElementById('logoutBtn').style.display = '';
    initDatabaseListeners();
    showLockerPicker(true);
    isFirebaseSessionExpired(user).then((expired) => {
        if (expired) forceExpireSession();
    });
}

let listenersAttached = false;
// Coalesces the list re-render triggered by Firebase onValue(dbRefHistory) so a burst of
// near-simultaneous writes (multiple scanners active at once) rebuilds the table once
// instead of once per event. buildBarcodeIndex() stays immediate since scan/save flows
// need it fresh on every event.
const debouncedRenderList = debounce(() => { if (currentTab === 'list') renderList(); }, 120);

function initDatabaseListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    const sdk = window.firebaseSDK;
    sdk.onValue(dbRefHistory, (snap) => {
        historyData = snap.val() || {};
        buildBarcodeIndex();
        debouncedRenderList();
    }, (err) => {
        console.error('Firebase history listener error:', err);
        if (window.ZoeErrors) ZoeErrors.capture(err, { context: 'Firebase history listener error:' });
        showToast('⚠️ បរាជ័យក្នុងការទាញយកទិន្នន័យ! សូមពិនិត្យការតភ្ជាប់ Firebase ឬសិទ្ធិចូលប្រើ');
    });
}
function detachDatabaseListeners() {
    if (!listenersAttached) return;
    listenersAttached = false;
    window.firebaseSDK.off(dbRefHistory);
    historyData = {};
    barcodeIndex = {};
}

function buildBarcodeIndex() {
    const idx = {};
    Object.keys(historyData).forEach((itemId) => {
        const item = historyData[itemId];
        if (!item) return;
        if (Array.isArray(item.barcodes) && item.barcodes.length) {
            item.barcodes.forEach((b, i) => {
                if (b && b.code) idx[b.code] = { itemId, barcodeIdx: i, item };
            });
        } else if (item.barcode) {
            idx[item.barcode] = { itemId, barcodeIdx: null, item };
        }
    });
    barcodeIndex = idx;
}

async function loginWithFirebase() {
    const email = document.getElementById('loginEmailInput').value.trim();
    const password = document.getElementById('loginPasswordInput').value;
    const remember = document.getElementById('rememberMeCheckbox').checked;
    const errBox = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    errBox.style.display = 'none';
    btn.disabled = true; btn.textContent = 'កំពុងចូល...';
    const sdk = window.firebaseSDK;
    try {
        await sdk.setPersistence(auth, remember ? sdk.browserLocalPersistence : sdk.browserSessionPersistence);
        await withTimeout(sdk.signInWithEmailAndPassword(auth, email, password), 15000, 'Login timed out');
        if (remember) localStorage.setItem('remembered_email', email); else localStorage.removeItem('remembered_email');
    } catch (e) {
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'loginWithFirebase' });
        errBox.textContent = e && e.message === 'Login timed out'
            ? 'អស់ពេល (Timeout)! សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។'
            : 'អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវទេ!';
        errBox.style.display = 'block';
    } finally {
        btn.disabled = false; btn.textContent = 'ចូលប្រព័ន្ធ';
    }
}
function logoutApp() {
    if (!confirm('ចាកចេញពីប្រព័ន្ធឬ?')) return;
    stopScanner();
    const doneFn = () => localStorage.removeItem('remembered_email');
    window.firebaseSDK.signOut(auth).then(doneFn).catch(doneFn);
}

async function hashPinLegacy(pin) {
    const enc = new TextEncoder().encode(pin);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hashPin(pin) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode('zscan_pin_verify_v2'), iterations: 150000, hash: 'SHA-256' },
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
function requestPinBeforeConfig(target) {
    pinTargetAction = target === 'locker' ? openLockerSettingsModal : openConfigModal;
    const savedPin = localStorage.getItem('zoew_security_pin_hash');
    if (!savedPin) { openModal('pinSetupModal'); return; }
    const lockoutUntil = parseInt(localStorage.getItem('zoew_pin_lockout_until') || '0');
    if (lockoutUntil && Date.now() < lockoutUntil) {
        const secs = Math.ceil((lockoutUntil - Date.now()) / 1000);
        showToast(`បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ${secs} វិនាទី។`);
        return;
    }
    document.getElementById('pinInput').value = '';
    openModal('pinModal');
}
async function saveNewSecurityPin() {
    const pin = document.getElementById('newPinInput').value;
    const confirmPin = document.getElementById('confirmPinInput').value;
    if (!pin || pin.length < 6) { showToast('PIN ត្រូវមានយ៉ាងតិច ៦ខ្ទង់!'); return; }
    if (pin !== confirmPin) { showToast('PIN ទាំងពីរមិនដូចគ្នាទេ!'); return; }
    localStorage.setItem('zoew_security_pin_hash', await hashPin(pin));
    closeModal('pinSetupModal');
    document.getElementById('newPinInput').value = '';
    document.getElementById('confirmPinInput').value = '';
    (pinTargetAction || openConfigModal)();
}
async function verifySecurityPin() {
    const lockoutUntil = parseInt(localStorage.getItem('zoew_pin_lockout_until') || '0');
    if (lockoutUntil && Date.now() < lockoutUntil) {
        const secs = Math.ceil((lockoutUntil - Date.now()) / 1000);
        closeModal('pinModal');
        showToast(`បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ${secs} វិនាទី។`);
        return;
    }
    const pinInputEl = document.getElementById('pinInput');
    const enteredPin = pinInputEl.value;
    pinInputEl.value = '';
    const savedPin = localStorage.getItem('zoew_security_pin_hash');
    if (savedPin && (await verifyStoredPin(enteredPin, savedPin))) {
        if (!savedPin.startsWith('pbkdf2:')) {
            localStorage.setItem('zoew_security_pin_hash', await hashPin(enteredPin));
        }
        localStorage.removeItem('zoew_pin_fail_count');
        localStorage.removeItem('zoew_pin_lockout_until');
        closeModal('pinModal');
        (pinTargetAction || openConfigModal)();
    } else {
        let failCount = (parseInt(localStorage.getItem('zoew_pin_fail_count') || '0') || 0) + 1;
        if (failCount >= 5) {
            localStorage.setItem('zoew_pin_lockout_until', (Date.now() + 60000).toString());
            localStorage.setItem('zoew_pin_fail_count', '0');
            showToast("បញ្ចូល PIN ខុសច្រើនដងពេក! សូមរង់ចាំ ១ នាទី មុននឹងសាកល្បងម្តងទៀត។");
        } else {
            localStorage.setItem('zoew_pin_fail_count', failCount.toString());
            showToast("លេខ PIN មិនត្រឹមត្រូវទេ!");
        }
    }
}

function openConfigModal() {
    const raw = localStorage.getItem('zoew_firebase_config') || '';
    document.getElementById('configInput').value = raw;
    const dsnInput = document.getElementById('sentryDsnInput');
    if (dsnInput && window.ZoeErrors) dsnInput.value = ZoeErrors.getDsn();
    openModal('configModal');
}
function saveFirebaseConfig() {
    const dsnInput = document.getElementById('sentryDsnInput');
    if (dsnInput && window.ZoeErrors) {
        ZoeErrors.setDsn(dsnInput.value);
        ZoeErrors.init('zscan');
    }
    const raw = document.getElementById('configInput').value;
    let cfg;
    try { cfg = parseFirebaseConfigLenient(raw); } catch (e) { showToast('Config មិនត្រឹមត្រូវទេ (JSON invalid)!'); return; }
    if (!cfg.apiKey || !cfg.databaseURL) { showToast('Config ត្រូវការយ៉ាងតិច apiKey និង databaseURL!'); return; }
    localStorage.setItem('zoew_firebase_config', JSON.stringify(cfg));
    closeModal('configModal');
    showToast('✅ Config ត្រូវបានរក្សាទុក! កំពុងផ្ទុកឡើងវិញ...');
    setTimeout(() => window.location.reload(), 900);
}

function getLockerPrefix() { return localStorage.getItem('zscan_locker_prefix') || 'ទូ'; }
function getLockerCount() { return parseInt(localStorage.getItem('zscan_locker_count') || '24') || 24; }
function openLockerSettingsModal() {
    document.getElementById('lockerPrefixInput').value = getLockerPrefix();
    document.getElementById('lockerCountInput').value = getLockerCount();
    openModal('lockerSettingsModal');
}
function saveLockerSettings() {
    const prefix = document.getElementById('lockerPrefixInput').value.trim() || 'ទូ';
    const count = Math.min(200, Math.max(1, parseInt(document.getElementById('lockerCountInput').value) || 24));
    localStorage.setItem('zscan_locker_prefix', prefix);
    localStorage.setItem('zscan_locker_count', String(count));
    closeModal('lockerSettingsModal');
    renderLockerGrid();
    showToast('✅ បានរក្សាទុកការកំណត់ទូ');
}

function showLockerPicker(skipIfActive) {
    stopScanner();
    if (skipIfActive && activeLocker) { showAppScreen(); return; }
    document.getElementById('appScreen').classList.add('hidden');
    document.getElementById('lockerPickerScreen').classList.remove('hidden');
    renderLockerGrid();
}
function renderLockerGrid() {
    const prefix = getLockerPrefix();
    const count = getLockerCount();
    const grid = document.getElementById('lockerGrid');
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= count; i++) {
        const val = `${prefix}${i}`;
        const btn = document.createElement('button');
        btn.className = 'locker-cell' + (val === activeLocker ? ' current' : '');
        btn.textContent = val;
        btn.addEventListener('click', () => chooseLocker(val));
        frag.appendChild(btn);
    }
    grid.innerHTML = '';
    grid.appendChild(frag);
}
function chooseLocker(val) {
    activeLocker = val;
    localStorage.setItem('zscan_active_locker', val);
    showAppScreen();
}
function selectCustomLocker() {
    const input = document.getElementById('customLockerInput');
    const val = input.value.trim();
    if (!val) { showToast('សូមបញ្ចូលទីតាំង!'); return; }
    input.value = '';
    chooseLocker(val);
}
function showAppScreen() {
    document.getElementById('lockerPickerScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    document.getElementById('activeLockerLabel').textContent = activeLocker || '-';
    switchTab(currentTab);
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('scanTab').classList.toggle('hidden', tab !== 'scan');
    document.getElementById('listTab').classList.toggle('hidden', tab !== 'list');
    document.getElementById('tabScanBtn').classList.toggle('active', tab === 'scan');
    document.getElementById('tabListBtn').classList.toggle('active', tab === 'list');
    if (tab === 'list') renderList();
    if (tab !== 'scan') stopScanner();
}

let currentStream = null;
let currentVideoTrack = null;
let torchOn = false;
let isCameraScanning = false;
let isCameraStarting = false;
let cameraRequestId = 0;
let pendingLoadedMetadataHandler = null;
let nativeDetector = null;
let nativeLoopActive = false;
let zxingLoopActive = false;
let liveScanCodeReader = null;
let imageDecodeCodeReader = null;
let ownCaptureCanvas = null;
let ownCaptureCtx = null;
let lastScannedCode = null;
let lastScanTime = 0;
let cameraStoppedByVisibility = false;
const SCAN_FORMATS_ZXING = ['CODE_128', 'CODE_39', 'CODE_93', 'CODABAR', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'ITF', 'RSS_14', 'RSS_EXPANDED'];
const SCAN_FORMATS_NATIVE = ['code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'];
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

function isAnyModalOpen() {
    return !!document.querySelector('.modal.open');
}

function initScanEngine() {
    try {
        const possibleFormats = SCAN_FORMATS_ZXING.map(name => ZXing.BarcodeFormat[name]).filter(f => f !== undefined);
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, possibleFormats);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        liveScanCodeReader = new ZXing.BrowserBarcodeReader(500, hints);
        const imageHints = new Map();
        imageHints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, possibleFormats);
        imageDecodeCodeReader = new ZXing.BrowserBarcodeReader(500, imageHints);
    } catch (e) {
        console.error('ZXing initialization error:', e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'ZXing initialization error:' });
    }
    if ('BarcodeDetector' in window) {
        try {
            nativeDetector = new BarcodeDetector({ formats: SCAN_FORMATS_NATIVE });
        } catch (e) { nativeDetector = null; }
    }
}

async function requestCameraPermission() {
    if (isCameraStarting) return;
    const inAppBrowser = /FBAN|FBAV|Instagram|Messenger|MicroMessenger|Line\//i.test(navigator.userAgent);
    if (inAppBrowser) {
        showToast('⚠️ សូមបើកតាម Browser ធម្មតា (Chrome/Safari) ដើម្បីប្រើកាមេរ៉ា — កម្មវិធីនេះមិនអាចប្រើកាមេរ៉ាក្នុង App ក្នុងកម្មវិធីផ្សេងបានទេ');
    }
    isCameraStarting = true;
    stopScanner();
    const requestId = ++cameraRequestId;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 24 } }
        });
        if (requestId !== cameraRequestId) {
            stream.getTracks().forEach(t => t.stop());
            isCameraStarting = false;
            return;
        }
        currentStream = stream;
        isCameraScanning = true;
        isCameraStarting = false;

        document.getElementById('permission-box').classList.add('hidden');
        document.getElementById('video-container').classList.remove('hidden');

        const video = document.getElementById('scanVideo');
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        video.srcObject = stream;

        setupTrackCapabilities(stream);

        const beginScanning = () => {
            if (!currentStream) return;
            video.play().catch(() => {});
            startDecoding(video);
        };
        if (video.readyState >= 1) {
            beginScanning();
        } else {
            pendingLoadedMetadataHandler = () => { pendingLoadedMetadataHandler = null; beginScanning(); };
            video.addEventListener('loadedmetadata', pendingLoadedMetadataHandler, { once: true });
        }
    } catch (err) {
        isCameraStarting = false;
        let msg = 'មិនអាចបើកកាមេរ៉ាបានទេ!';
        if (err && err.name === 'NotAllowedError') msg = '🚫 សូមអនុញ្ញាតការប្រើប្រាស់កាមេរ៉ាក្នុង Browser Settings';
        else if (err && err.name === 'NotFoundError') msg = '🚫 រកមិនឃើញកាមេរ៉ាទេ';
        else if (err && err.name === 'NotReadableError') msg = '🚫 កាមេរ៉ាកំពុងប្រើដោយកម្មវិធីផ្សេង';
        showToast(msg);
    }
}

function setupTrackCapabilities(stream) {
    currentVideoTrack = stream.getVideoTracks()[0] || null;
    torchOn = false;
    const overlay = document.getElementById('videoControlsOverlay');
    const zoomWrap = document.getElementById('zoomSliderWrap');
    const zoomSlider = document.getElementById('zoomSlider');
    const torchBtn = document.getElementById('torchToggleBtn');
    zoomWrap.classList.add('hidden');
    torchBtn.classList.add('hidden');
    torchBtn.classList.remove('active');
    overlay.classList.add('hidden');

    if (!currentVideoTrack || typeof currentVideoTrack.getCapabilities !== 'function') return;
    let caps = null;
    try { caps = currentVideoTrack.getCapabilities(); } catch (e) {}
    if (!caps) return;

    if (caps.focusMode && caps.focusMode.includes('continuous')) {
        currentVideoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    }
    if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        zoomSlider.min = caps.zoom.min;
        zoomSlider.max = caps.zoom.max;
        zoomSlider.step = caps.zoom.step || 0.1;
        let settings = {};
        try { settings = currentVideoTrack.getSettings(); } catch (e) {}
        zoomSlider.value = settings.zoom || caps.zoom.min;
        zoomWrap.classList.remove('hidden');
    }
    if (caps.torch) torchBtn.classList.remove('hidden');
    if (!zoomWrap.classList.contains('hidden') || !torchBtn.classList.contains('hidden')) overlay.classList.remove('hidden');
}

function toggleTorch() {
    if (!currentVideoTrack) return;
    const nextState = !torchOn;
    currentVideoTrack.applyConstraints({ advanced: [{ torch: nextState }] })
        .then(() => {
            torchOn = nextState;
            document.getElementById('torchToggleBtn').classList.toggle('active', torchOn);
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

function decodeBarcodeFromCanvasManual(reader, canvas) {
    const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
    const binarizer = new ZXing.HybridBinarizer(luminanceSource);
    const bitmap = new ZXing.BinaryBitmap(binarizer);
    const result = reader.decodeBitmap(bitmap);
    return result && (result.text || (typeof result.getText === 'function' ? result.getText() : ''));
}

function startFastNativeScan(videoElement) {
    nativeLoopActive = true;
    const container = document.getElementById('video-container');
    let lastCheck = 0;
    async function renderLoop(timestamp) {
        if (!currentStream || !isCameraScanning || !nativeLoopActive) return;
        if (timestamp - lastCheck > 250) {
            lastCheck = timestamp;
            if (!isAnyModalOpen() && videoElement && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0) {
                try {
                    const crop = getCoverCropRect(videoElement, container);
                    const bitmap = await createImageBitmap(videoElement, crop.sx, crop.sy, crop.sWidth, crop.sHeight);
                    try {
                        const codes = await nativeDetector.detect(bitmap);
                        if (codes && codes.length > 0 && !isAnyModalOpen() && currentStream && isCameraScanning && nativeLoopActive) {
                            processScannedCode(codes[0].rawValue);
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
            lastCheck = timestamp;
            if (!isAnyModalOpen() && videoElement && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0) {
                decoding = true;
                try {
                    const crop = getCoverCropRect(videoElement, container);
                    const maxDim = 800;
                    const scale = crop.sWidth > maxDim ? maxDim / crop.sWidth : 1;
                    ownCaptureCanvas.width = Math.round(crop.sWidth * scale);
                    ownCaptureCanvas.height = Math.round(crop.sHeight * scale);
                    ownCaptureCtx.drawImage(videoElement, crop.sx, crop.sy, crop.sWidth, crop.sHeight, 0, 0, ownCaptureCanvas.width, ownCaptureCanvas.height);
                    const text = decodeBarcodeFromCanvasManual(liveScanCodeReader, ownCaptureCanvas);
                    if (text && !isAnyModalOpen()) processScannedCode(text);
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

function startDecoding(video) {
    if (nativeDetector && isIOS) {
        startFastNativeScan(video);
        startZxingVideoScan(video);
    } else if (nativeDetector) {
        startFastNativeScan(video);
    } else if (liveScanCodeReader) {
        startZxingVideoScan(video);
    }
}

function processScannedCode(code) {
    code = (code || '').trim();
    if (isAnyModalOpen() || !code) return;
    const now = Date.now();
    if (code === lastScannedCode && (now - lastScanTime) < 2500) return;
    lastScannedCode = code;
    lastScanTime = now;
    handleScannedCode(code);
}

function stopScanner() {
    cameraRequestId++;
    isCameraScanning = false;
    nativeLoopActive = false;
    zxingLoopActive = false;
    if (pendingLoadedMetadataHandler) {
        const video = document.getElementById('scanVideo');
        if (video) video.removeEventListener('loadedmetadata', pendingLoadedMetadataHandler);
        pendingLoadedMetadataHandler = null;
    }
    if (currentStream) {
        currentStream.getTracks().forEach(t => { t.stop(); t.enabled = false; });
        currentStream = null;
    }
    currentVideoTrack = null;
    torchOn = false;
    const overlay = document.getElementById('videoControlsOverlay');
    if (overlay) overlay.classList.add('hidden');
    const vc = document.getElementById('video-container');
    const pb = document.getElementById('permission-box');
    if (vc) vc.classList.add('hidden');
    if (pb) pb.classList.remove('hidden');
}

function submitManualBarcode() {
    const input = document.getElementById('hwScannerInput');
    const code = input.value.trim();
    if (!code) return;
    input.value = '';
    handleScannedCode(code);
}

function handleImageUpload(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!imageDecodeCodeReader) { showToast('⚠️ Barcode reader មិនទាន់ត្រៀមរួចទេ សូមរង់ចាំបន្តិច'); return; }
    const reader = new FileReader();
    reader.onload = () => decodeBarcodeFromImageDataUrl(reader.result);
    reader.onerror = () => showToast('❌ មិនអាចអានរូបភាពនេះបានទេ');
    reader.readAsDataURL(file);
}

function decodeBarcodeFromImageDataUrl(dataUrl) {
    const img = new Image();
    img.onload = () => {
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
                const text = decodeBarcodeFromCanvasManual(imageDecodeCodeReader, canvas);
                if (text) { handleScannedCode(text); return; }
            } catch (e) {}
        }
        showToast('❌ រកមិនឃើញ Barcode ក្នុងរូបភាពនេះទេ');
    };
    img.onerror = () => showToast('❌ រកមិនឃើញ Barcode ក្នុងរូបភាពនេះទេ');
    img.src = dataUrl;
}

function getEntryCurrentLocker(entry) {
    const { barcodeIdx, item } = entry;
    if (barcodeIdx !== null) {
        return (item.barcodes[barcodeIdx] && item.barcodes[barcodeIdx].locker) || null;
    }
    return item.locker || null;
}

function handleScannedCode(code) {
    if (isAnyModalOpen()) return;
    if (!activeLocker) {
        playErrorFeedback();
        showToast('⚠️ សូមជ្រើសរើសទីតាំង Locker សិន!');
        return;
    }
    const entry = barcodeIndex[code];
    if (!entry) {
        playErrorFeedback();
        showToast(`❌ រកមិនឃើញ Barcode "${code}" ក្នុងប្រព័ន្ធ! សូមប្រាកដថាបានស្កេនចូលដោយ ZoeAdmin សិន។`);
        return;
    }
    const currentLocker = getEntryCurrentLocker(entry);
    if (currentLocker && currentLocker !== 'N/A' && currentLocker !== activeLocker) {
        playErrorFeedback();
        pendingLocationCode = code;
        const phoneRaw = entry.item.phone ? sanitizePhoneNumber(entry.item.phone) : '';
        const who = phoneRaw ? ` (${phoneRaw})` : '';
        document.getElementById('locationWarningText').innerText =
            `Barcode "${code}"${who} កំពុងស្ថិតនៅទីតាំង ${currentLocker} ។ តើអ្នកចង់ប្តូរទីតាំងទៅ ${activeLocker} ដែរឬទេ?`;
        openModal('locationWarningModal');
        return;
    }
    assignLockerToEntry(code);
}

function cancelLocationChange() {
    pendingLocationCode = null;
    closeModal('locationWarningModal');
}

function confirmLocationChange() {
    const code = pendingLocationCode;
    pendingLocationCode = null;
    closeModal('locationWarningModal');
    if (code) assignLockerToEntry(code);
}

async function assignLockerToEntry(code) {
    const entry = barcodeIndex[code];
    if (!entry) {
        playErrorFeedback();
        showToast(`❌ Barcode "${code}" លែងមានក្នុងប្រព័ន្ធទៀតហើយ! សូមស្កេនម្តងទៀត`);
        return;
    }
    const { itemId } = entry;
    const ts = Date.now();
    const previousLocker = getEntryCurrentLocker(entry);
    let phoneForToast = entry.item.phone || '';
    let matched = false;

    try {
        const itemRef = window.firebaseSDK.ref(db, `zoew_scan_history_cod_dod/${itemId}`);
        const result = await withTimeout(window.firebaseSDK.runTransaction(itemRef, (currentItem) => {
            matched = false;
            if (!currentItem) return currentItem;
            if (currentItem.barcodes && Array.isArray(currentItem.barcodes) && currentItem.barcodes.length) {
                const b = currentItem.barcodes.find(bc => bc && bc.code === code);
                if (!b) return currentItem;
                b.locker = activeLocker;
                b.lockerUpdatedAt = ts;
                if (currentItem.barcodes.length === 1) {
                    currentItem.locker = activeLocker;
                    currentItem.lockerUpdatedAt = ts;
                }
            } else if (currentItem.barcode === code) {
                currentItem.locker = activeLocker;
                currentItem.lockerUpdatedAt = ts;
            } else {
                return currentItem;
            }
            currentItem.lockerUpdatedBy = currentUserEmail || null;
            phoneForToast = currentItem.phone || '';
            matched = true;
            return currentItem;
        }), 12000, 'Save timed out');

        if (!result.committed || !matched) {
            playErrorFeedback();
            showToast(`❌ Barcode "${code}" លែងមានក្នុងប្រព័ន្ធទៀតហើយ! សូមស្កេនម្តងទៀត`);
            return;
        }

        playSuccessFeedback();
        const phoneRaw = phoneForToast ? sanitizePhoneNumber(phoneForToast) : '';
        const who = phoneRaw ? ` (${phoneRaw})` : '';
        if (previousLocker && previousLocker !== activeLocker && previousLocker !== 'N/A') {
            showToast(`✅ ប្តូរទីតាំង${who} ពី ${previousLocker} ➜ ${activeLocker}`);
        } else {
            showToast(`✅ បានកំណត់ទីតាំង ${activeLocker}${who}`);
        }
    } catch (err) {
        playErrorFeedback();
        showToast('❌ មានបញ្ហា! មិនអាចរក្សាទុកបានទេ សូមព្យាយាមម្តងទៀត');
        console.error(err);
        if (window.ZoeErrors) ZoeErrors.capture(err, { context: '' });
    }
}

function getItemLockerSummary(item) {
    const lockers = [];
    if (Array.isArray(item.barcodes) && item.barcodes.length) {
        item.barcodes.forEach(b => { if (b && b.locker && b.locker !== 'N/A' && lockers.indexOf(b.locker) === -1) lockers.push(b.locker); });
    } else if (item.locker && item.locker !== 'N/A') {
        lockers.push(item.locker);
    }
    return lockers;
}
function getItemLatestLockerTs(item) {
    let ts = 0;
    if (Array.isArray(item.barcodes)) item.barcodes.forEach(b => { if (b && b.lockerUpdatedAt) ts = Math.max(ts, b.lockerUpdatedAt); });
    if (item.lockerUpdatedAt) ts = Math.max(ts, item.lockerUpdatedAt);
    return ts || item.createdAt || item.time || 0;
}

function renderList() {
    const search = (document.getElementById('listSearchInput').value || '').trim().toLowerCase();
    const lockerFilter = document.getElementById('listLockerFilter').value;

    let assigned = Object.keys(historyData).map(id => ({ id, ...historyData[id] }))
        .filter(it => getItemLockerSummary(it).length > 0);

    const allLockers = new Set();
    assigned.forEach(it => getItemLockerSummary(it).forEach(l => allLockers.add(l)));
    const filterSelect = document.getElementById('listLockerFilter');
    const prevVal = filterSelect.value;
    let optHtml = '<option value="">ទីតាំងទាំងអស់</option>';
    Array.from(allLockers).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach(l => {
        optHtml += `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`;
    });
    if (filterSelect.innerHTML !== optHtml) { filterSelect.innerHTML = optHtml; filterSelect.value = prevVal; }

    if (search) assigned = assigned.filter(it => sanitizePhoneNumber(it.phone || '').toLowerCase().includes(search));
    if (lockerFilter) assigned = assigned.filter(it => getItemLockerSummary(it).includes(lockerFilter));

    assigned.sort((a, b) => getItemLatestLockerTs(a) - getItemLatestLockerTs(b));

    const tbody = document.getElementById('listTableBody');
    const emptyState = document.getElementById('listEmptyState');
    if (!assigned.length) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    let html = '';
    for (let i = assigned.length - 1; i >= 0; i--) {
        const it = assigned[i];
        const num = i + 1;
        const phoneRaw = sanitizePhoneNumber(it.phone || '');
        const phoneCell = phoneRaw ? `<span class="phone-cell">${escapeHtml(phoneRaw)}</span>` : `<span class="phone-empty">គ្មានលេខ</span>`;
        const lockers = getItemLockerSummary(it);
        const lockerText = lockers.length > 1 ? `${escapeHtml(lockers.join(', '))} (${lockers.length} កន្លែង)` : escapeHtml(lockers[0] || '');
        html += `<tr>
            <td style="text-align:center;font-weight:700;color:var(--text-muted);">${num}</td>
            <td>${phoneCell}</td>
            <td><span class="locker-badge">${lockerText}</span></td>
        </tr>`;
    }
    tbody.innerHTML = html;
}

function bindEventListeners() {
    document.getElementById('settingsBtn').addEventListener('click', () => requestPinBeforeConfig());
    document.getElementById('logoutBtn').addEventListener('click', logoutApp);

    document.getElementById('selectCustomLockerBtn').addEventListener('click', selectCustomLocker);
    document.getElementById('lockerSettingsLink').addEventListener('click', () => requestPinBeforeConfig('locker'));

    document.getElementById('changeLockerBtn').addEventListener('click', () => showLockerPicker());

    document.getElementById('tabScanBtn').addEventListener('click', () => switchTab('scan'));
    document.getElementById('tabListBtn').addEventListener('click', () => switchTab('list'));

    document.getElementById('openCameraBtn').addEventListener('click', requestCameraPermission);
    document.getElementById('scannerCloseBtn').addEventListener('click', stopScanner);
    document.getElementById('torchToggleBtn').addEventListener('click', toggleTorch);
    document.getElementById('zoomSlider').addEventListener('input', (e) => {
        if (!currentVideoTrack) return;
        currentVideoTrack.applyConstraints({ advanced: [{ zoom: parseFloat(e.target.value) }] }).catch(() => {});
    });
    document.getElementById('submitManualBtn').addEventListener('click', submitManualBarcode);
    document.getElementById('imageUploadInput').addEventListener('change', handleImageUpload);

    const hw = document.getElementById('hwScannerInput');
    hw.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitManualBarcode(); } });

    document.getElementById('listSearchInput').addEventListener('input', debounce(renderList, 150));
    document.getElementById('listLockerFilter').addEventListener('change', renderList);

    document.getElementById('loginForm').addEventListener('submit', (e) => { e.preventDefault(); loginWithFirebase(); });

    document.getElementById('pinSetupCancelBtn').addEventListener('click', () => closeModal('pinSetupModal'));
    document.getElementById('pinSetupSaveBtn').addEventListener('click', saveNewSecurityPin);

    document.getElementById('pinCancelBtn').addEventListener('click', () => closeModal('pinModal'));
    document.getElementById('pinConfirmBtn').addEventListener('click', verifySecurityPin);

    document.getElementById('configCancelBtn').addEventListener('click', () => closeModal('configModal'));
    document.getElementById('configSaveBtn').addEventListener('click', saveFirebaseConfig);

    document.getElementById('locationWarningCancelBtn').addEventListener('click', cancelLocationChange);
    document.getElementById('locationWarningConfirmBtn').addEventListener('click', confirmLocationChange);

    document.getElementById('lockerSettingsCancelBtn').addEventListener('click', () => closeModal('lockerSettingsModal'));
    document.getElementById('lockerSettingsSaveBtn').addEventListener('click', saveLockerSettings);

    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('modal') && e.target.classList.contains('open')) {
            dismissModal(e.target);
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const openModalEl = document.querySelector('.modal.open');
        if (openModalEl) dismissModal(openModalEl);
    });

    // The camera stays open (indicator light on, battery/GPU draining) whenever the tab is
    // just backgrounded/screen-locked mid-shift, since only the decode loop pauses while
    // hidden -- release the stream outright and re-request it on return, same as reopening
    // the scan tab manually.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            if (isCameraScanning && currentTab === 'scan') {
                cameraStoppedByVisibility = true;
                stopScanner();
            }
        } else if (cameraStoppedByVisibility) {
            cameraStoppedByVisibility = false;
            if (currentTab === 'scan' && !isAnyModalOpen()) requestCameraPermission();
        }
    });
}
bindEventListeners();

if (window.ZoeErrors) ZoeErrors.init('zscan');

initFirebase().catch(err => {
    document.getElementById('bootLoading').innerHTML = '⚠️ មិនអាចភ្ជាប់ Firebase SDK បានទេ សូម Refresh ទំព័រនេះម្តងទៀត';
    console.error(err);
    if (window.ZoeErrors) ZoeErrors.capture(err, { context: '' });
});
(function waitForZXingThenInitScanEngine() {
    if (typeof ZXing === 'undefined') { setTimeout(waitForZXingThenInitScanEngine, 300); return; }
    initScanEngine();
})();
window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') reg.update().catch(() => {});
            });
            window.addEventListener('focus', () => reg.update().catch(() => {}));
            // Belt-and-suspenders for a scanning shift where the app stays foregrounded
            // for hours without ever blurring/backgrounding -- visibilitychange/focus
            // would never fire, so also poll periodically.
            setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
        }).catch(() => {});
        let swReloadedOnce = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (swReloadedOnce) return;
            swReloadedOnce = true;
            window.location.reload();
        });
    }
});
