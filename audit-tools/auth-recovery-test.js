const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function sliceFns(file, names) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
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
    { file: 'ZoeAdmin/app.js', label: 'ZoeAdmin', verify: 'verifyAdminRoleThenProceed', login: 'loginWithFirebase', role: 'admin' },
    { file: 'ZoeW/app.js', label: 'ZoeW', verify: 'verifyWorkerRoleThenProceed', login: 'loginWithFirebase', role: 'worker' }
];

function buildContext(app) {
    const clock = { now: 0, seq: 0, timers: [] };
    const log = { toasts: [], signOuts: 0, gets: [], loginModalShown: 0, dbInit: 0, alerts: [] };

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
    function restorePersistedUser(user) {
        auth.currentUser = user;
        auth.lastNotifiedUid = user ? user.uid : null;
    }

    const fb = {
        onAuthStateChanged(a, cb) { a.listeners.push(cb); cb(a.currentUser); return () => {}; },
        signInWithEmailAndPassword(a, email) {
            a.currentUser = { uid: 'uid-' + email, email };
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
        off() {}, onValue() {}, getIdTokenResult() { return Promise.resolve({ authTime: new Date().toISOString() }); }
    };

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
        Promise, Error, JSON, Date, String, Number, Object, Array, isNaN, parseFloat,
        document: doc,
        window: {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        alert: (m) => log.alerts.push(m),
        fb, auth, db: {},
        __log: log, __clock: clock, __els: els,
        __restorePersistedUser: restorePersistedUser
    };
    const ctx = vm.createContext(sandbox);

    const preamble = `
        var authGeneration = 0;
        var pendingRoleRecheck = false;
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
        function initDatabaseListeners() { __log.dbInit++; }
        function safeFocusScanner() {}
        function clearCustomerDataTableCache() {}
        function applyCurrentFilter() {}
        function renderRecentlyDeleted() {}
        function updateRecentPhonesList() {}
        function attemptAuthStorageRecovery() { __log.storageRecovery = true; }
        function isFirebaseSessionExpired() { return Promise.resolve(false); }
        function forceExpireSession() {}
        function ensureAppActivated() { return Promise.resolve(activationAllowed); }
        function checkPinAndOpenConfig() {}
    `;
    vm.runInContext(preamble, ctx);
    vm.runInContext(sliceFns(app.file, ['withTimeout', 'retryPendingRoleCheck', app.verify, 'setupAuthListener', app.login]), ctx);
    return { ctx, clock, log, auth, fb, els };
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

    // ---- Scenario 3: a genuine error must still fail closed ----
    console.log('-- ៣. កំហុសពិតប្រាកដ (permission_denied) នៅតែត្រូវបណ្ដេញចេញ --');
    h = buildContext(app);
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    h.log.gets[0].reject(new Error('permission_denied'));
    await drain();
    ok('signOut នៅតែកើតឡើង', h.log.signOuts === 1, h.log.signOuts);
    ok('មិនដាក់ទង់ព្យាយាមឡើងវិញទេ', h.ctx.pendingRoleRecheck === false, h.ctx.pendingRoleRecheck);

    // ---- Scenario 4: wrong role must still be rejected ----
    console.log('-- ៤. គណនីគ្មានសិទ្ធិ នៅតែត្រូវបដិសេធ --');
    h = buildContext(app);
    h.ctx.__restorePersistedUser({ uid: 'uid-a@x.com', email: 'a@x.com' });
    vm.runInContext('setupAuthListener();', h.ctx);
    await drain();
    h.log.gets[0].resolve({ val: () => 'scanner-only-nonsense' });
    await drain();
    ok('signOut ពេល role មិនត្រូវ', h.log.signOuts === 1, h.log.signOuts);
    ok('មិនបានបើក listener ទិន្នន័យទេ', h.log.dbInit === 0, h.log.dbInit);
}

(async () => {
    for (const app of APPS) await run(app);
    console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + '  pass=' + pass + ' fail=' + fail);
    process.exit(fail === 0 ? 0 : 1);
})();
