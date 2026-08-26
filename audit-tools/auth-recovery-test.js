const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appRoot = process.env.AUTH_APP_DIR ? path.resolve(process.env.AUTH_APP_DIR) : root;

function sliceFns(file, names) {
    const src = fs.readFileSync(path.join(appRoot, file), 'utf8');
    return names.map((name) => {
        let start = src.indexOf('function ' + name + '(');
        if (start === -1) throw new Error('not found: ' + name + ' in ' + file);
        if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
        let depth = 0, i = src.indexOf('{', start), started = false;
        for (; i < src.length; i++) {
            if (src[i] === '{') { depth++; started = true; }
            else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
        }
        return src.slice(start, i);
    }).join('\n\n');
}

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

const APPS = [
    { file: 'ZoeKeyGen/app.js', label: 'ZoeKeyGen', verify: 'verifyAdminRoleThenProceed', login: 'doLogin', role: 'admin', boot: 'setupAuthListener' }
];

function buildContext(app) {
    const clock = { now: 0, seq: 0, timers: [] };
    const log = { toasts: [], signOuts: 0, gets: [], loginModalShown: 0, dbInit: 0, alerts: [], rest: [] };
    let configJson = '{"apiKey":"k","databaseURL":"https://demo-default-rtdb.firebaseio.com/"}';

    function fakeFetch(url, opts) {
        const entry = { url, opts, resolve: null, reject: null };
        entry.promise = new Promise((res, rej) => { entry.resolve = res; entry.reject = rej; });
        entry.respond = (body, status) => entry.resolve({
            ok: (status || 200) < 400,
            status: status || 200,
            json: () => Promise.resolve(body)
        });
        log.rest.push(entry);
        return entry.promise;
    }

    const fakeSetTimeout = (fn, ms) => {
        const t = { fn, at: clock.now + (ms || 0), id: ++clock.seq, cleared: false };
        clock.timers.push(t);
        return t.id;
    };
    const fakeClearTimeout = (id) => {
        const t = clock.timers.find((x) => x.id === id);
        if (t) t.cleared = true;
    };

    // Mirrors AuthImpl.notifyAuthListeners in @firebase/auth@1.13.4 (the version
    // inside firebase@12.17.1, which these apps load from gstatic):
    //   const currentUid = this.currentUser?.uid ?? null;
    //   if (this.lastNotifiedUid !== currentUid) { ...authStateSubscription.next(...) }
    const auth = { currentUser: null, lastNotifiedUid: undefined, listeners: [] };
    function notifyAuthListeners() {
        const currentUid = auth.currentUser ? auth.currentUser.uid : null;
        if (auth.lastNotifiedUid !== currentUid) {
            auth.lastNotifiedUid = currentUid;
            auth.listeners.slice().forEach((cb) => cb(auth.currentUser));
        }
    }
    function makeUser(email) {
        return { uid: 'uid-' + email, email, getIdToken: () => Promise.resolve('id-token-' + email) };
    }
    function restorePersistedUser(user) {
        if (user && !user.getIdToken) user.getIdToken = () => Promise.resolve('id-token-' + user.email);
        auth.currentUser = user;
        auth.lastNotifiedUid = user ? user.uid : null;
    }

    const fb = {
        onAuthStateChanged(a, cb) { a.listeners.push(cb); cb(a.currentUser); return () => {}; },
        signInWithEmailAndPassword(a, email) {
            a.currentUser = makeUser(email);
            notifyAuthListeners();
            return Promise.resolve({ user: a.currentUser });
        },
        setPersistence() { return Promise.resolve(); },
        signOut(a) { log.signOuts++; a.currentUser = null; notifyAuthListeners(); return Promise.resolve(); },
        browserLocalPersistence: 1, browserSessionPersistence: 2,
        ref(db, p) { return { path: p }; },
        get(ref) {
            const entry = { path: ref.path, resolve: null, reject: null };
            entry.promise = new Promise((res, rej) => { entry.resolve = res; entry.reject = rej; });
            log.gets.push(entry);
            return entry.promise;
        },
        off() {},
        onValue(ref, cb) {
            if (!ref || ref.path !== '.info/connected') return () => {};
            conn.listeners.push(cb);
            cb({ val: () => conn.value });
            return () => {
                const i = conn.listeners.indexOf(cb);
                if (i >= 0) conn.listeners.splice(i, 1);
            };
        },
        getIdTokenResult() { return Promise.resolve({ authTime: new Date().toISOString() }); }
    };
    const conn = { value: false, listeners: [] };
    // Mirrors what each app's .info/connected handler in initFirebase does
    // (asserted against the real source in run() below).
    function setConnected(value) {
        conn.value = value;
        vm.runInContext('isDatabaseConnected = ' + (value ? 'true' : 'false') + ';', ctx);
        conn.listeners.slice().forEach((cb) => cb({ val: () => value }));
        if (value) vm.runInContext('retryPendingRoleCheck();', ctx);
    }

    const els = {};
    const doc = {
        getElementById(id) {
            if (!els[id]) els[id] = { id, value: '', textContent: '', innerText: '', disabled: false, style: {}, checked: false, classList: { toggle() {}, add() {}, remove() {} }, focus() {} };
            return els[id];
        },
        querySelectorAll() { return []; },
        body: { style: {} }
    };

    const sandbox = {
        console,
        setTimeout: fakeSetTimeout,
        clearTimeout: fakeClearTimeout,
        Promise, Error, JSON, Date, String, Number, Object, Array, isNaN, parseFloat, URL,
        document: doc,
        localStorage: {
            getItem: (k) => (k === 'zoew_firebase_config' ? configJson : null),
            setItem() {}, removeItem() {}
        },
        fetch: fakeFetch,
        navigator: { onLine: true },
        encodeURIComponent,
        alert: (m) => log.alerts.push(m),
        fb, auth, db: {},
        window: { firebaseSDK: fb },
        __log: log, __clock: clock, __els: els,
        __restorePersistedUser: restorePersistedUser
    };
    const ctx = vm.createContext(sandbox);

    const preamble = `
        var authGeneration = 0;
        var pendingRoleRecheck = false;
        var lastRoleRestOutcome = '';
        var isDatabaseConnected = true;
        var ROLE_CHECK_CONNECT_WAIT_MS = 45000;
        var SLOW_NETWORK_NOTICE_MS = 4000;
        var isSignedInUiActive = false;
        var authUnsubscribe = null;
        var authRecoveryTimeout = null;
        var autoLoginAttempted = false;
        var isDatabaseInitialized = false;
        var isModalOpen = false;
        var scanHistory = [], deletedItems = [];
        var dailyRevenueData = {}, monthlyRevenueData = {}, dailyPickupData = {};
        var dbRefDailyRevenue = null, dbRefMonthlyRevenue = null, dbRefDailyPickup = null;
        var dbRefHistory = null, dbRefDeleted = null, dbRefExchangeRate = null;
        var activationAllowed = true;
        function showToast(m) { __log.toasts.push(m); }
        function closeModal(id) { if (id === 'loginModal') __log.loginModalClosed = (__log.loginModalClosed || 0) + 1; }
        function openModalHelper() {}
        function showLoginModalWithPrefill() { __log.loginModalShown++; }
        function clearRememberedSession() {}
        function updateAuthButton(v) { __log.authButton = v; }
        function initDatabaseListeners() { if (listenersAttached) return; listenersAttached = true; __log.dbInit++; }
        function refreshKeyList() { __log.dbInit++; }
        function showLockerPicker() {}
        function detachDatabaseListeners() {}
        function renderList() {}
        function stopScanner() {}
        function closeConfigQrScanner() {}
        function openModal(id) { if (id === 'loginModal') __log.loginModalShown++; }
        function updateSigningKeyBadge() {}
        function requestSessionSigningKeyRestoreIfEligible() {}
        function enforceSessionOnlyAuthPersistence() { return Promise.resolve(); }
        function waitForFirebaseSDK() { return Promise.resolve(fb); }
        var currentUserEmail = null;
        var cameraStoppedByVisibility = false;
        var pendingLocationCode = null;
        var listenersAttached = false;
        var loginGeneration = 0;
        function safeFocusScanner() {}
        function prefetchCustomerDataTableRowsIfConfigured() {}
        function clearCustomerDataTableCache() {}
        function applyCurrentFilter() {}
        function renderRecentlyDeleted() {}
        function updateRecentPhonesList() {}
        function attemptAuthStorageRecovery() { __log.storageRecovery = true; }
        function isFirebaseSessionExpired() { return Promise.resolve(false); }
        function forceExpireSession() {}
        function resetClearHistoryOperationState() {}
        function ensureAppActivated() { return Promise.resolve(activationAllowed); }
        function checkPinAndOpenConfig() {}
    `;
    vm.runInContext(preamble, ctx);
    const wanted = ['withTimeout', 'readDatabaseUrlFromConfig', 'readUserRoleViaRest', 'readUserRole',
        'connectionLooksOnline', 'liveToastState', 'showLiveToast',
        'retryPendingRoleCheck', app.verify, app.login];
    const appSrc = fs.readFileSync(path.join(appRoot, app.file), 'utf8');
    if (appSrc.indexOf('function isFirebaseDatabaseHost(') !== -1) {
        wanted.splice(2, 0, 'isFirebaseDatabaseHost');
    }
    // ចាប់ពីកំណែ 2.12.1 `readUserRoleViaRest()` ឆ្លងកាត់ `fetchWithTimeout()`
    // ដែល **បោះបង់សំណើពិត** ជំនួស `fetch()` ឆៅ (មើល network-timeout-test.js)។
    // ត្រូវដក helper នោះចេញមកជាមួយ បើមិនដូច្នេះការហៅ REST throw
    // `fetchWithTimeout is not defined` ហើយ scenario REST ទាំងអស់ធ្លាក់។
    if (appSrc.indexOf('function fetchWithTimeout(') !== -1) {
        wanted.unshift('fetchWithTimeout');
    }
    if (app.boot === 'setupAuthListener') wanted.push('setupAuthListener');
    vm.runInContext(sliceFns(app.file, wanted), ctx);
    if (app.boot === 'inline') {
        vm.runInContext('function setupAuthListener() {' +
            ' fb.onAuthStateChanged(auth, function (user) {' +
            '   authGeneration++;' +
            '   var myAuthGeneration = authGeneration;' +
            '   if (user) { ' + app.verify + '(user, myAuthGeneration); }' +
            '   else { pendingRoleRecheck = false; }' +
            ' }); }', ctx);
    }
    return { ctx, clock, log, auth, fb, els, setConnected, setConfig: (v) => { configJson = v; } };
}

function respondRest(h, index, body, status) {
    const entry = h.log.rest[index];
    if (!entry) { ok('មានសំណើ REST ទី ' + (index + 1) + ' ដើម្បីឆ្លើយតប', false, h.log.rest.length); return false; }
    entry.respond(body, status);
    return true;
}

const flush = () => new Promise((r) => setImmediate(r));
async function drain(n) { for (let i = 0; i < (n || 6); i++) await flush(); }

async function advance(h, ms) {
    h.clock.now += ms;
    const due = h.clock.timers.filter((t) => !t.cleared && t.at <= h.clock.now).sort((a, b) => a.at - b.at);
    for (const t of due) { t.cleared = true; t.fn(); await drain(); }
    await drain();
}

async function run(app) {
    console.log('\n===== ' + app.label + ' =====');

    // ---- Scenario 1: reopen the app on a slow network, then log in again ----
    console.log('-- ១. បើក App ឡើងវិញ ពេលបណ្ដាញយឺត រួចចូលប្រព័ន្ធម្ដងទៀត --');
    let h = buildContext(app);
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    let fires = 0;
    h.auth.listeners.push(() => { fires++; });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    ok('ការស្ដារ session ចាប់ផ្ដើមការត្រួតពិនិត្យ role', h.log.gets.length === 1, h.log.gets.length);

    h.els.loginEmailInput = h.ctx.document.getElementById('loginEmailInput');
    h.ctx.document.getElementById('loginEmailInput').value = 'a@x.com';
    h.ctx.document.getElementById('loginPasswordInput').value = 'pw';
    const firesBefore = fires;
    vm.runInContext(app.login + '();', h.ctx);
    await drain();
    ok('onAuthStateChanged មិនបាញ់ទេ ពេលចូលដោយគណនីដដែល (ឥរិយាបថ Firebase SDK)',
        fires === firesBefore, fires - firesBefore);
    ok('ប៉ុន្តែ App ចាប់ផ្ដើមការត្រួតពិនិត្យ role ថ្មីដោយខ្លួនឯង', h.log.gets.length === 2, h.log.gets.length);

    h.log.gets[1].resolve({ val: () => app.role });
    await drain();
    ok('ចូលប្រព័ន្ធជោគជ័យ', h.log.dbInit === 1 && h.log.authButton === true, { dbInit: h.log.dbInit, btn: h.log.authButton });
    ok('មិនស្នើ REST ទេ ពេលភ្ជាប់រួចហើយ', h.log.rest.length === 0, h.log.rest.length);

    const signOutsBefore = h.log.signOuts;
    await advance(h, 20000);
    ok('ការត្រួតពិនិត្យចាស់ដែលអស់ពេល មិនបណ្ដេញអ្នកប្រើចេញទេ',
        h.log.signOuts === signOutsBefore, h.log.signOuts);

    // ---- Scenario 2: role check times out, then the connection comes back ----
    console.log('-- ២. ការត្រួតពិនិត្យ role អស់ពេល រួចបណ្ដាញត្រឡប់មកវិញ --');
    h = buildContext(app);
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    await advance(h, 15000);
    ok('មិន signOut ពេលអស់ពេលដោយសារបណ្ដាញ', h.log.signOuts === 0, h.log.signOuts);
    ok('បង្ហាញប្រអប់ចូលប្រព័ន្ធវិញ', h.log.loginModalShown >= 1, h.log.loginModalShown);
    ok('សារប្រាប់ថានឹងព្យាយាមម្ដងទៀត',
        h.log.toasts.some((t) => t.indexOf('ស្វ័យប្រវត្តិ') !== -1), h.log.toasts);
    ok('បានដាក់ទង់រង់ចាំត្រួតពិនិត្យឡើងវិញ', h.ctx.pendingRoleRecheck === true, h.ctx.pendingRoleRecheck);
    ok('អ្នកប្រើនៅតែមាន session (មិនត្រូវបានបណ្ដេញចេញ)', h.auth.currentUser !== null);

    const getsBeforeReconnect = h.log.gets.length;
    vm.runInContext('retryPendingRoleCheck();', h.ctx);
    await drain();
    ok('ភ្ជាប់បណ្ដាញឡើងវិញ → ត្រួតពិនិត្យ role ម្ដងទៀតដោយស្វ័យប្រវត្តិ',
        h.log.gets.length === getsBeforeReconnect + 1, h.log.gets.length);

    h.log.gets[h.log.gets.length - 1].resolve({ val: () => app.role });
    await drain();
    ok('ស្ដារឡើងវិញដោយស្វ័យប្រវត្តិ ដោយមិនបាច់វាយពាក្យសម្ងាត់',
        h.log.dbInit === 1 && h.ctx.pendingRoleRecheck === false, { dbInit: h.log.dbInit, pending: h.ctx.pendingRoleRecheck });

    vm.runInContext('retryPendingRoleCheck();', h.ctx);
    await drain();
    ok('មិនត្រួតពិនិត្យឡើងវិញទេ ពេលគ្មានទង់រង់ចាំ (គ្មាន loop)',
        h.log.gets.length === getsBeforeReconnect + 1, h.log.gets.length);

    // ---- Scenario 4b: a databaseURL that is not a Firebase RTDB host never receives the ID token ----
    console.log('-- ៤ខ. databaseURL មិនមែន Firebase ➜ មិនផ្ញើ ID token ទៅទីនោះ --');
    h = buildContext(app);
    vm.runInContext('isDatabaseConnected = false;', h.ctx);
    h.setConfig('{"apiKey":"k","databaseURL":"https://evil.googleusercontent.com"}');
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    ok('មិនស្នើ REST ទៅ host ក្រៅ Firebase សោះ', h.log.rest.length === 0, h.log.rest);
    ok('កត់ត្រាមូលហេតុទៅ Sentry', h.ctx.lastRoleRestOutcome === 'blocked: non-firebase databaseURL', h.ctx.lastRoleRestOutcome);
    h.setConnected(true);
    h.log.gets[0].resolve({ val: () => app.role });
    await drain();
    ok('socket ឡើងវិញ ➜ នៅតែចូលបានធម្មតា', h.log.dbInit === 1 && h.log.signOuts === 0,
        { dbInit: h.log.dbInit, signOuts: h.log.signOuts });

    // ---- Scenario 5: the socket is not up and no REST fallback is reachable ----
    console.log('-- ៥. RTDB មិនទាន់ភ្ជាប់ ហើយគ្មានផ្លូវ REST — មិនត្រូវប្រណាំងនឹង timer --');
    h = buildContext(app);
    vm.runInContext('isDatabaseConnected = false;', h.ctx);
    h.setConfig(null);
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    ok('មិនប្រាប់ថាបណ្ដាញយឺតភ្លាមៗ', h.log.toasts.every((t) => t.indexOf('កំពុងភ្ជាប់') === -1), h.log.toasts);
    ok('គ្មាន databaseURL ➜ មិនស្នើ REST', h.log.rest.length === 0, h.log.rest.length);
    ok('កត់ត្រាថាផ្លូវ REST ប្រើមិនបាន', h.ctx.lastRoleRestOutcome === 'unavailable', h.ctx.lastRoleRestOutcome);

    await advance(h, 20000);
    ok('នៅតែរង់ចាំ មិនអស់ពេលនៅ 20 វិនាទី (WebSocket មាន 30 វិនាទី)',
        h.log.signOuts === 0 && h.ctx.pendingRoleRecheck === false && h.log.loginModalShown === 0,
        { signOuts: h.log.signOuts, pending: h.ctx.pendingRoleRecheck, modal: h.log.loginModalShown });

    h.setConnected(true);
    h.log.gets[0].resolve({ val: () => app.role });
    await drain();
    ok('ភ្ជាប់បាន ➜ ចូលបានដោយស្វ័យប្រវត្តិ ដោយគ្មានកំហុសបង្ហាញសោះ',
        h.log.dbInit === 1 && h.log.signOuts === 0, { dbInit: h.log.dbInit, signOuts: h.log.signOuts });

    console.log('-- ៦. បើភ្ជាប់មិនបានសោះ សំណាញ់សុវត្ថិភាពចាស់នៅដដែល --');
    h = buildContext(app);
    vm.runInContext('isDatabaseConnected = false;', h.ctx);
    h.setConfig(null);
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    await advance(h, 45000);
    ok('អស់ថវិការង់ចាំ ➜ មិន signOut ដាក់ទង់ព្យាយាមឡើងវិញ',
        h.log.signOuts === 0 && h.ctx.pendingRoleRecheck === true,
        { signOuts: h.log.signOuts, pending: h.ctx.pendingRoleRecheck });

    // ---- Scenario 7: the socket is dead but plain HTTPS still works (2026-08-20 #4) ----
    console.log('-- ៧. Socket ស្លាប់ តែ HTTPS ដើរ ➜ អាន role តាម REST --');
    h = buildContext(app);
    vm.runInContext('isDatabaseConnected = false;', h.ctx);
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    ok('ចាប់ផ្ដើមអាន SDK ភ្លាម ដោយមិនរង់ចាំ socket', h.log.gets.length === 1, h.log.gets.length);
    ok('ហើយស្នើ REST ស្របគ្នា', h.log.rest.length === 1, h.log.rest.length);
    ok('URL REST ចង្អុលទៅ user_roles របស់អ្នកប្រើ ជាមួយ token',
        h.log.rest.length === 1 &&
        h.log.rest[0].url === 'https://demo-default-rtdb.firebaseio.com/user_roles/uid-a%40x.com.json?auth=id-token-a%40x.com',
        h.log.rest.length ? h.log.rest[0].url : null);

    respondRest(h, 0, app.role);
    await drain();
    ok('ចូលបានតាម REST ទោះ socket មិនឡើង', h.log.dbInit === 1 && h.log.signOuts === 0,
        { dbInit: h.log.dbInit, signOuts: h.log.signOuts });
    ok('កត់ត្រាថា REST ជាអ្នកឆ្លើយ', h.ctx.lastRoleRestOutcome === 'ok', h.ctx.lastRoleRestOutcome);

    await advance(h, 60000);
    ok('SDK get ដែលនៅព្យួរ មិនបង្កើត timeout ក្រោយចូលបានហើយ',
        h.log.signOuts === 0 && h.ctx.pendingRoleRecheck === false && h.log.dbInit === 1,
        { signOuts: h.log.signOuts, pending: h.ctx.pendingRoleRecheck, dbInit: h.log.dbInit });

    // ---- Scenario 8: REST is reachable but refused — must not shortcut the wait ----
    console.log('-- ៨. REST ត្រូវបានបដិសេធ (401) ➜ នៅតែរង់ចាំ socket --');
    h = buildContext(app);
    vm.runInContext('isDatabaseConnected = false;', h.ctx);
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    respondRest(h, 0, null, 401);
    await drain();
    ok('401 មិនបណ្ដេញអ្នកប្រើចេញភ្លាមទេ',
        h.log.signOuts === 0 && h.log.loginModalShown === 0,
        { signOuts: h.log.signOuts, modal: h.log.loginModalShown });
    ok('កត់ត្រាលេខកូដ HTTP សម្រាប់ Sentry', h.ctx.lastRoleRestOutcome === 'http 401', h.ctx.lastRoleRestOutcome);

    h.setConnected(true);
    h.log.gets[0].resolve({ val: () => app.role });
    await drain();
    ok('socket ត្រឡប់មកវិញ ➜ ចូលបាន', h.log.dbInit === 1 && h.log.signOuts === 0,
        { dbInit: h.log.dbInit, signOuts: h.log.signOuts });

    // ---- Scenario 9: REST must not be able to bypass the role gate ----
    console.log('-- ៩. REST មិនអាចរំលងការត្រួតពិនិត្យ role បានទេ --');
    h = buildContext(app);
    vm.runInContext('isDatabaseConnected = false;', h.ctx);
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    respondRest(h, 0, 'nonsense-role');
    await drain();
    ok('role ខុសពី REST ➜ signOut ដដែល', h.log.signOuts === 1, h.log.signOuts);
    ok('មិនបានបើក listener ទិន្នន័យទេ', h.log.dbInit === 0, h.log.dbInit);

    // ---- Scenario 10: the slow-network notice must not fire on a normal launch ----
    console.log('-- ១០. សារ "បណ្ដាញយឺត" មិនត្រូវលោតពេលបើក App ធម្មតា --');
    h = buildContext(app);
    vm.runInContext('isDatabaseConnected = false;', h.ctx);
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    ok('មិនលោតសារភ្លាមៗ', h.log.toasts.every((t) => t.indexOf('កំពុងភ្ជាប់') === -1), h.log.toasts);

    await advance(h, 1000);
    respondRest(h, 0, app.role);
    await drain();
    ok('ភ្ជាប់បានក្នុង ១ វិនាទី ➜ គ្មានសារ "បណ្ដាញយឺត" សោះ',
        h.log.toasts.every((t) => t.indexOf('កំពុងភ្ជាប់') === -1), h.log.toasts);
    ok('ហើយចូលបានធម្មតា', h.log.dbInit === 1, h.log.dbInit);

    await advance(h, 10000);
    ok('សារមិនលោតយឺតក្រោយចូលរួចហើយ',
        h.log.toasts.every((t) => t.indexOf('កំពុងភ្ជាប់') === -1), h.log.toasts);

    console.log('-- ១១. តែបើយឺតពិត ➜ ត្រូវប្រាប់អ្នកប្រើ --');
    h = buildContext(app);
    vm.runInContext('isDatabaseConnected = false;', h.ctx);
    h.setConfig(null);
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    await advance(h, 3000);
    ok('នៅ ៣ វិនាទី នៅមិនទាន់លោត', h.log.toasts.every((t) => t.indexOf('កំពុងភ្ជាប់') === -1), h.log.toasts);
    await advance(h, 2000);
    ok('នៅ ៥ វិនាទី ទើបប្រាប់អ្នកប្រើ', h.log.toasts.some((t) => t.indexOf('កំពុងភ្ជាប់') !== -1), h.log.toasts);

    // ---- Scenario 12: the sign-in announcement must not repeat ----
    console.log('-- ១២. សារ "ចូលប្រព័ន្ធជោគជ័យ" មិនត្រូវចេញពីរដង --');
    h = buildContext(app);
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    h.log.gets[0].resolve({ val: () => app.role });
    await drain();
    const successAfterFirst = h.log.toasts.filter((t) => t.indexOf('ជោគជ័យ') !== -1).length;

    vm.runInContext('authGeneration++; ' + app.verify + '(auth.currentUser, authGeneration);', h.ctx);
    await drain();
    h.log.gets[h.log.gets.length - 1].resolve({ val: () => app.role });
    await drain();
    const successAfterSecond = h.log.toasts.filter((t) => t.indexOf('ជោគជ័យ') !== -1).length;
    ok('ប្រកាសចូលប្រព័ន្ធម្ដង', successAfterFirst === 1, successAfterFirst);
    ok('ការត្រួតពិនិត្យ role ជាថ្មី មិនប្រកាសចូលប្រព័ន្ធម្ដងទៀត',
        successAfterSecond === successAfterFirst, { first: successAfterFirst, second: successAfterSecond });
    if (app.label === 'ZoeKeyGen') {
        // ZoeKeyGen refetches its key list on every verify on purpose.
        ok('ZoeKeyGen ទាញបញ្ជី Key ឡើងវិញ (ចេតនា)', h.log.dbInit === 2, h.log.dbInit);
    } else {
        ok('ហើយមិនបើក listener ស្ទួនទេ', h.log.dbInit === 1, h.log.dbInit);
    }
}

(async () => {
    for (const app of APPS) await run(app);
    console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + '  pass=' + pass + ' fail=' + fail);
    process.exit(fail === 0 ? 0 : 1);
})();
