const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { reactRuntime, renderedElement } = require('./react-view');

const root = path.resolve(__dirname, '..');
const appRoot = process.env.CONNRECOVERY_APP_DIR ? path.resolve(process.env.CONNRECOVERY_APP_DIR) : root;

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

const SRC = fs.readFileSync(path.join(appRoot, 'ZoeW', 'app.js'), 'utf8');

// handler `visibilitychange` ហៅ `callee()` ក្នុងចម្ងាយ ៤០០ តួ។ ⛔ ZoeW (React) ចុះឈ្មោះតាមច្រកចេញ
// `onDocumentVisibilityChange()` (`platform/document-io.ts`) ➜ ទទួលវា **តែពេល** តួរបស់វាពិតជាចង
// `visibilitychange` (ដេរីវេពីកូដ មិនមែនជឿឈ្មោះ)
function visibilityCalls(src, callee) {
    const helper = /function onDocumentVisibilityChange\([^)]*\)\s*\{[^}]*addEventListener\('visibilitychange'/.test(src);
    const head = helper ? '(visibilitychange|onDocumentVisibilityChange\\()' : 'visibilitychange';
    return new RegExp(head + '[\\s\\S]{0,400}?' + callee + '\\(\\)').test(src);
}

function sliceFnFrom(source, name) {
    let start = source.indexOf('function ' + name + '(');
    if (start === -1) return null;
    if (source.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = source.indexOf('{', start), started = false;
    for (; i < source.length; i++) {
        if (source[i] === '{') { depth++; started = true; }
        else if (source[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return source.slice(start, i);
}

function sliceFn(name) {
    return sliceFnFrom(SRC, name);
}

function sliceConst(name) {
    const re = new RegExp('^\\s*const ' + name + ' = [^;]+;', 'm');
    const m = SRC.match(re);
    return m ? m[0] : null;
}

// tree ដែលគ្មានអ្នកទប់វឌ្ឍនភាព ត្រូវទទួលឥរិយាបថចាស់ (attach ឡើងវិញរាល់ជុំ)
// ដូច្នេះការអះអាងឥរិយាបថខាងក្រោមធ្លាក់ដោយហេតុផលរបស់វាផ្ទាល់ មិនមែនដោយ
// «រកឈ្មោះ function មិនឃើញ» ដែលបិទបាំងអ្វីៗទាំងអស់ទេ។
const RESYNC_GUARD = sliceFn('dbListenerResyncIsProgressing') ||
    'function dbListenerResyncIsProgressing() { return false; }';

// ⛔ `elapsedSince()` ជាមូលដ្ឋាននៃរាល់ពិដានល្បឿន (កំណែ 2.20.7) ➜ sandbox
// ត្រូវផ្ទុក **helper ពិត** ដើម្បីវាស់ឥរិយាបថពិត។ tree ដែលមិនទាន់មានវា
// ទទួល stub ដែលរក្សាឥរិយាបថចាស់ (ដក ត្រង់ៗ) ➜ ការអះអាងធ្លាក់ដោយ
// ហេតុផលរបស់វា មិនមែនដោយ ReferenceError។
const ELAPSED_HELPER = sliceFn('elapsedSince') ||
    'function elapsedSince(mark) { return Date.now() - mark; }';

// ── ០. ការអះអាងឥរិយាបថស្នូល — រត់បានលើ tree មុនកែផងដែរ ─────────────
// listener ដែល Firebase បោះបង់ (permission_denied ជាដើម) **មិនត្រូវត្រឡប់មក
// វិញដោយខ្លួនឯងទេ**។ បើ App នៅអះអាងថា «ភ្ជាប់ Server រួចរាល់» ក្រោយពេលនោះ
// នោះអ្នកប្រើមើលឃើញតារាងកកមួយ ដោយគិតថាវាទាន់សម័យ។
{
    const errFn = sliceFn('handleDbListenerError');
    const onlineFn = sliceFn('connectionLooksOnline');
    if (!errFn || !onlineFn) {
        ok('រកឃើញ handleDbListenerError និង connectionLooksOnline', false);
    } else {
        const state = { failedFlag: false, toasts: [] };
        const core = {
            console: Object.assign({}, console, { error: () => {} }),
            Date, Set, Math, setTimeout: () => 1, clearTimeout: () => {},
            navigator: { onLine: true },
            window: { ZoeErrors: { capture: () => {} } },
            document: { getElementById: () => null },
            isDatabaseConnected: true,
            queueMicrotask,
            showToast: (m) => state.toasts.push(m)
        };
        core.ZoeErrors = core.window.ZoeErrors;
        vm.createContext(core);
        // ⛔ ZoeW ជា React ៖ ស្លាកស្ថានភាពការតភ្ជាប់ជា `viewState` ដែល JSX គូរ ➜ ឃ្លាំងពិតចូល sandbox
        vm.runInContext(reactRuntime(SRC, { context: core }), core);
        // ⛔ កំណែ 2.22.5 ៖ កូដ ship ចូលប្រើ storage តាម shim `appLocalStore` /
        // `appSessionStore` បូក `safeStoreGet()` ថ្មី។ sandbox ត្រូវផ្តល់ពួកវា
        // បើមិនដូច្នេះ function ដែលស្រង់ចូល vm បោះ ReferenceError។
        // ⚠️ ការចាក់ប្រើ `typeof … === 'undefined'` ➜ កូដពិតដែលស្រង់ចូលក្រោយ
        // **ឈ្នះ** shim នេះជានិច្ច។
        vm.runInContext('if (typeof appLocalStore === \'undefined\') globalThis.appLocalStore = (typeof localStorage !== \'undefined\' ? localStorage : null); if (typeof appSessionStore === \'undefined\') globalThis.appSessionStore = (typeof sessionStorage !== \'undefined\' ? sessionStorage : null); if (typeof safeStoreGet !== \'function\') globalThis.safeStoreGet = function (s, k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } }; if (typeof safeStoreSet !== \'function\') globalThis.safeStoreSet = function (s, k, v) { try { return s ? (s.setItem(k, String(v)), true) : false; } catch (e) { return false; } }; if (typeof safeStoreRemove !== \'function\') globalThis.safeStoreRemove = function (s, k) { try { return s ? (s.removeItem(k), true) : false; } catch (e) { return false; } };', core);
        // ⛔ កំណែ 2.22.5 ៖ កូដ ship ចូលប្រើ storage តាម shim `appLocalStore` /
        // `appSessionStore` (អាន `window.localStorage` ក្នុង `try` តែម្តង ព្រោះ
        // **getter ខ្លួនវាបោះ** ពេល browser បិទ site data)។ sandbox ត្រូវផ្តល់
        // alias ទាំង ២ បើមិនដូច្នេះ function ដែលស្រង់ចូល vm បោះ ReferenceError។
        if (core.appLocalStore === undefined) core.appLocalStore = core.localStorage || null;
        if (core.appSessionStore === undefined) core.appSessionStore = core.sessionStorage || null;
        const extras = [
            'renderConnectionStatus', 'refreshLiveToasts', 'scheduleDbListenerRecovery', 'clearDbListenerRecovery',
            'attemptDbListenerRecovery', 'noteDbListenerAlive', 'initDatabaseListeners',
            'rawSnapshotToItemList'
        ].map(sliceFn).filter(Boolean).join('\n\n') + '\n\n' + RESYNC_GUARD + '\n\n' + ELAPSED_HELPER;
        const src = 'let dbListenersFailed = false;\n' +
            'let dbListenerRecoveryTimer = null;\n' +
            'let dbListenerRecoveryAttempt = 0;\n' +
            'let dbListenerOutageNoticeShown = false;\n' +
            'const dbListenerPendingPaths = new Set();\n' +
            'const dbListenerFailedPaths = new Set();\n' +
            'const dbListenerReportedFailures = new Set();\n' +
        'let infoListenersFailed = false;\n' +
        'let infoListenerRecoveryTimer = null;\n' +
        'let infoListenerRecoveryAttempt = 0;\n' +
        'const infoListenerFailedPaths = new Set();\n' +
        "const INFO_LISTENER_KEY_CONNECTED = 'connected';\n" +
        "const INFO_LISTENER_KEY_OFFSET = 'serverTimeOffset';\n" +
        'let dbRefConnected = null, dbRefServerTimeOffset = null;\n' +
        'let serverTimeOffsetMs = 0;\n' +
        'const retryPendingRoleCheck = () => {};\n' +
        'const flushPendingHistoryPatches = () => {};\n' +
        'const flushPendingRegistryReleases = () => {};\n' +
        'const pendingRegistryReleases = new Map();\n' +
        'let registryReleaseFlushInFlight = false;\n' +
        'const serverClockOffsetIsFromServer = () => true;\n' +
        'let serverClockTrusted = false;\n' +
            'let dbListenerPendingSeen = 0;\n' +
            'const LISTENER_RECOVERY_STEPS_MS = [2000];\n' +
            'let db = null, fb = null, auth = null;\n' +
            errFn + '\n\n' + onlineFn + '\n\n' + extras + '\n' +
            'this.__err = handleDbListenerError; this.__online = connectionLooksOnline;';
        try {
            vm.runInContext(src, core);
            core.__err(new Error('permission_denied'));
            ok('ក្រោយ listener ត្រូវបោះបង់ ៖ App មិនត្រូវអះអាងថាភ្ជាប់ Server រួចរាល់',
                core.__online() === false, core.__online());
        } catch (e) {
            ok('ការអះអាងឥរិយាបថស្នូលរត់បាន', false, String(e && e.message));
        }
    }
}

const REQUIRED_FNS = [
    'connectionLooksOnline', 'connectionIsSettlingIn', 'renderConnectionStatus', 'refreshLiveToasts',
    'nudgeDatabaseConnection',
    'forceDatabaseReconnect', 'canCycleDatabaseConnection', 'scheduleReconnectWatchdog', 'clearReconnectWatchdog',
    'handleDbListenerError', 'scheduleDbListenerRecovery', 'attemptDbListenerRecovery',
    'retryFailedDbListenersNow', 'clearDbListenerRecovery', 'noteDbListenerAlive',
    'detachDatabaseListeners', 'detachInfoListeners', 'resetDbListenerHealthState', 'initDatabaseListeners',
    'rawSnapshotToItemList',
    'runScheduledCleanup',
    'attachInfoListeners', 'scheduleInfoListenerRecovery', 'clearInfoListenerRecovery',
    'handleInfoListenerError', 'noteInfoListenerAlive'
];

// ⛔ **កុំបញ្ឈប់ខ្លួនត្រង់នេះ។** ការ `process.exit(1)` ដោយ «រកមុខងារមិនឃើញ»
// **បិទបាំងការអះអាងឥរិយាបថទាំង ១០០ ខាងក្រោម** ➜ លើ tree មុនកែ អ្នកឃើញ
// កំហុសតែ ១ បន្ទាត់ ជំនួសឲ្យការធ្លាក់ពិតដែលប្រាប់ថា *អ្វី* ខូច។ (ជុំ 2.19.3
// ជួបវាដោយផ្ទាល់៖ ការបន្ថែម `dbListenerResyncIsProgressing` ចូល REQUIRED_FNS
// ធ្វើឲ្យ tree មុនកែបង្ហាញ «0 ok, 1 FAIL» ជំនួស ១១ ការធ្លាក់ដែលមានន័យ។)
// ជំនួសវិញ៖ រាយវាជាការធ្លាក់ រួច **stub** វា ដើម្បីឲ្យការអះអាងឥរិយាបថ
// នៅតែរត់ ហើយធ្លាក់ដោយហេតុផលរបស់វាផ្ទាល់។ `checker-coverage.js` ចាក់សោនេះ។
const missing = REQUIRED_FNS.filter((n) => !sliceFn(n));
missing.forEach((n) => ok('មុខងារស្តារការតភ្ជាប់ `' + n + '` មានក្នុង app.js', false));
const FN_STUBS = missing.map((n) => 'function ' + n + '() {}').join('\n');

const REAL_LISTENER_KEYS = (function () {
    const m = SRC.match(/const\s+DB_LISTENER_KEYS\s*=\s*\[([^\]]*)\]/);
    if (!m) return [];
    return m[1].split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
})();
const REAL_LISTENER_KEY_CONSTS = (function () {
    const out = [];
    const re = /const\s+(DB_LISTENER_KEY_[A-Z_]+)\s*=\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(SRC))) out.push('const ' + m[1] + " = '" + m[2] + "';");
    return out.join('\n');
})();

const REAL_LISTENER_REF_NAMES = (function () {
    const out = [];
    const re = /let\s+(dbRef[A-Za-z0-9_]+)\s*=\s*null/g;
    let m;
    while ((m = re.exec(SRC))) if (out.indexOf(m[1]) === -1) out.push(m[1]);
    return out;
})();

const REQUIRED_CONSTS = ['RECONNECT_FORCE_MIN_GAP_MS', 'RECONNECT_WATCHDOG_STEPS_MS', 'LISTENER_RECOVERY_STEPS_MS',
    'DB_LISTENER_RETRY_MIN_GAP_MS', 'DB_LISTENER_PROGRESS_GRACE_MS', 'CONNECTING_GRACE_ATTEMPTS', 'INFO_LISTENER_RECOVERY_STEPS_MS'];
const missingConsts = REQUIRED_CONSTS.filter((n) => !sliceConst(n));
missingConsts.forEach((n) => ok('ថេរ `' + n + '` មានក្នុង app.js', false));
const CONST_STUBS = missingConsts
    .map((n) => 'const ' + n + ' = ' + (/_STEPS_MS$/.test(n) ? '[1000]' : (/_GRACE_MS$/.test(n) ? '0' : '1')) + ';')
    .join('\n');

function buildContext() {
    const clock = { now: 1000, seq: 0, timers: [] };
    const log = { toasts: [], goOffline: 0, goOnline: 0, off: [], attached: [], captures: [], cleanupRuns: 0 };

    const setTimeoutFake = (fn, ms) => {
        const t = { fn, at: clock.now + (ms || 0), id: ++clock.seq, cleared: false };
        clock.timers.push(t);
        return t.id;
    };
    const clearTimeoutFake = (id) => {
        const t = clock.timers.find((x) => x.id === id);
        if (t) t.cleared = true;
    };
    const advance = (ms) => {
        const target = clock.now + ms;
        for (;;) {
            const due = clock.timers
                .filter((t) => !t.cleared && !t.done && t.at <= target)
                .sort((a, b) => a.at - b.at || a.id - b.id)[0];
            if (!due) break;
            clock.now = due.at;
            due.done = true;
            due.fn();
        }
        clock.now = target;
    };

    const listenerCallbacks = {};
    const listenerHistory = {};
    const fb = {
        off: (ref) => { log.off.push(ref && ref.__path); },
        onValue: (ref, cb, errCb) => {
            const p = ref && ref.__path;
            log.attached.push(p);
            listenerCallbacks[p] = { cb, errCb };
            if (!listenerHistory[p]) listenerHistory[p] = [];
            listenerHistory[p].push({ cb, errCb });
        },
        goOffline: () => { log.goOffline++; },
        goOnline: () => { log.goOnline++; }
    };

    const refs = {};
    REAL_LISTENER_KEYS.forEach((k) => { refs[k] = { __path: k }; });


    const quietConsole = Object.assign({}, console, { error: () => {} });
    const ctx = {
        console: quietConsole,
        Date: { now: () => clock.now },
        Set,
        Math,
        setTimeout: setTimeoutFake,
        clearTimeout: clearTimeoutFake,
        navigator: { onLine: true },
        window: {},
        document: { getElementById: () => null },
        queueMicrotask,
        fb,
        db: {},
        auth: { currentUser: { uid: 'u1' } },
        isDatabaseConnected: true,
        isDatabaseInitialized: false,
        dbRefHistory: refs.history,
        dbRefDeleted: refs.deleted,
        showToast: (m) => log.toasts.push(m),
        scanHistory: [],
        deletedItems: [],
        dailyRevenueData: {},
        monthlyRevenueData: {},
        dailyPickupData: {},
        exchangeRateRiel: 4100,
        localStorage: { setItem: () => {}, getItem: () => null },
        generateUniqueId: () => 'id_1',
        parseTimestampFromId: () => 1,
        getServerNow: () => clock.now,
        normalizeBarcodesOf: () => {},
        debouncedRenderAfterHistorySync: () => {},
        runAutomaticDeletedCleanup: () => {},
        runAutomaticCollectedCleanup: () => {},
        repairPickupLedgerOnce: () => {},
        runAutomaticCleanupRules: () => { log.cleanupRuns++; },
        ZoeErrors: { capture: (e) => log.captures.push(e) }
    };
    REAL_LISTENER_REF_NAMES.forEach((name) => {
        const key = name.slice(5, 6).toLowerCase() + name.slice(6);
        if (!refs[key]) refs[key] = { __path: key };
        ctx[name] = refs[key];
    });
    REAL_LISTENER_KEYS.forEach((k) => {
        const dataName = k + 'Data';
        if (ctx[dataName] === undefined) ctx[dataName] = {};
    });
    ctx.window.ZoeErrors = ctx.ZoeErrors;
    vm.createContext(ctx);
    // ⛔ ZoeW ជា React ៖ `renderConnectionStatus()` សរសេរ `viewState.connectionStatus`/`connectionText` ហើយ
    //    `AppNavbar.tsx` គូរ `#statusDot`/`#firebaseStatusText` ➜ ឃ្លាំងពិតចូល sandbox · ធាតុទាំង ២ គូរ JSX ពិត
    vm.runInContext(reactRuntime(SRC, { exclude: REQUIRED_FNS, context: ctx }), ctx);
    const NAVBAR = 'src/app/components/AppNavbar.tsx';
    const statusDot = renderedElement(appRoot, ctx, NAVBAR, 'AppNavbar', 'statusDot');
    const statusText = renderedElement(appRoot, ctx, NAVBAR, 'AppNavbar', 'firebaseStatusText');
    vm.runInContext('if (typeof appLocalStore === \'undefined\') globalThis.appLocalStore = (typeof localStorage !== \'undefined\' ? localStorage : null); if (typeof appSessionStore === \'undefined\') globalThis.appSessionStore = (typeof sessionStorage !== \'undefined\' ? sessionStorage : null); if (typeof safeStoreGet !== \'function\') globalThis.safeStoreGet = function (s, k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } }; if (typeof safeStoreSet !== \'function\') globalThis.safeStoreSet = function (s, k, v) { try { return s ? (s.setItem(k, String(v)), true) : false; } catch (e) { return false; } }; if (typeof safeStoreRemove !== \'function\') globalThis.safeStoreRemove = function (s, k) { try { return s ? (s.removeItem(k), true) : false; } catch (e) { return false; } };', ctx);
    if (ctx.appLocalStore === undefined) ctx.appLocalStore = ctx.localStorage || null;
    if (ctx.appSessionStore === undefined) ctx.appSessionStore = ctx.sessionStorage || null;

    const code = 'let dbListenerPendingSeen = 0;\nlet dbListenerProgressAt = 0;\n' + CONST_STUBS + '\n'
        + REQUIRED_CONSTS.map(sliceConst).filter(Boolean).join('\n') + '\n' +
        REQUIRED_FNS.map(sliceFn).filter(Boolean).join('\n\n') + '\n' + FN_STUBS + '\n' + RESYNC_GUARD + '\n' + ELAPSED_HELPER + '\n' +
        'const DB_LISTENER_KEYS = ' + JSON.stringify(REAL_LISTENER_KEYS) + ';\n' +
        REAL_LISTENER_KEY_CONSTS + '\n' +
        'let dbListenersFailed = false;\n' +
        'let dbListenerGeneration = 0;\n' +
        'let dbListenerRecoveryTimer = null;\n' +
        'let dbListenerRecoveryAttempt = 0;\n' +
        'let lastDbListenerAttemptAt = 0;\n' +
        'let dbListenerOutageNoticeShown = false;\n' +
        'let reconnectWatchdogTimer = null;\n' +
        'let reconnectWatchdogAttempt = 0;\n' +
        'let lastForcedReconnectAt = 0;\n' +
        // SDK មិនមក (ក្រៅបណ្តាញពេល boot) ➜ ស្ថានភាពត្រូវសរសេរ «ក្រៅបណ្ដាញ»
        // ដោយស្មោះ មិនមែនជាប់ «កំពុងភ្ជាប់...» ជារៀងរហូតទេ។ scenario
        // ក្នុងឯកសារនេះសុទ្ធតែផ្ទុក SDK បានរួច ➜ ចាប់ផ្តើមជា false។
        'let firebaseSdkUnavailable = false;\n' +
        // ស្ថានភាពដែលកំណត់ថាតើវដ្ត goOffline()+goOnline() មានតម្លៃឬអត់៖
        // វា **កាត់ផ្តាច់ handshake ដែលកំពុងដំណើរការ** ដូច្នេះវាមានតម្លៃតែពេល
        // SDK ទំនងជាកំពុងអង្គុយក្នុងបង្អួច backoff ប៉ុណ្ណោះ។ scenario ភាគច្រើន
        // ក្នុងឯកសារនេះជា «ធ្លាប់ភ្ជាប់រួច ➜ ដាច់» ដូច្នេះវាចាប់ផ្តើមជា true។
        'let hasEverConnectedToDatabase = true;\n' +
        'let networkJustReturned = false;\n' +
        'const dbListenerPendingPaths = new Set();\n' +
        'const dbListenerFailedPaths = new Set();\n' +
        'const dbListenerReportedFailures = new Set();\n' +
        'let infoListenersFailed = false;\n' +
        'let infoListenerGeneration = 0;\n' +
        'let infoListenerRecoveryTimer = null;\n' +
        'let infoListenerRecoveryAttempt = 0;\n' +
        'const infoListenerFailedPaths = new Set();\n' +
        "const INFO_LISTENER_KEY_CONNECTED = 'connected';\n" +
        "const INFO_LISTENER_KEY_OFFSET = 'serverTimeOffset';\n" +
        'let dbRefConnected = null, dbRefServerTimeOffset = null;\n' +
        'let serverTimeOffsetMs = 0;\n' +
        'const retryPendingRoleCheck = () => {};\n' +
        'const flushPendingHistoryPatches = () => {};\n' +
        'const flushPendingRegistryReleases = () => {};\n' +
        'const pendingRegistryReleases = new Map();\n' +
        'let registryReleaseFlushInFlight = false;\n' +
        'const serverClockOffsetIsFromServer = () => true;\n' +
        'let serverClockTrusted = false;\n' +
        'this.__probe = () => ({ dbListenersFailed, dbListenerRecoveryTimer, reconnectWatchdogTimer, ' +
        'reconnectWatchdogAttempt, lastDbListenerAttemptAt, pending: Array.from(dbListenerPendingPaths), ' +
        'failed: Array.from(dbListenerFailedPaths) });\n' +
        'this.__setConnHistory = (ever, back) => { hasEverConnectedToDatabase = ever; networkJustReturned = back; };\n' +
        'this.__connHistory = () => ({ hasEverConnectedToDatabase, networkJustReturned });\n' +
        'this.__setInfoRefs = (a, b) => { dbRefConnected = a; dbRefServerTimeOffset = b; };\n' +
        'this.__infoProbe = () => ({ infoListenersFailed, infoListenerRecoveryTimer, ' +
        'isDatabaseConnected, serverTimeOffsetMs });\n' +
        'this.__api = { connectionLooksOnline, renderConnectionStatus, nudgeDatabaseConnection, ' +
        'handleDbListenerError, initDatabaseListeners, noteDbListenerAlive, retryFailedDbListenersNow, ' +
        'resetDbListenerHealthState, runScheduledCleanup, clearReconnectWatchdog, ' +
        'attachInfoListeners, handleInfoListenerError, clearInfoListenerRecovery };\n';

    vm.runInContext(code, ctx);
    return { ctx, log, clock, advance, listenerCallbacks, listenerHistory, statusDot, statusText, api: ctx.__api, probe: ctx.__probe,
        setConnHistory: ctx.__setConnHistory, connHistory: ctx.__connHistory,
        setInfoRefs: ctx.__setInfoRefs, infoProbe: ctx.__infoProbe };
}

// ── ១. ការតភ្ជាប់ធម្មតា ─────────────────────────────────────────────
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    ok('ភ្ជាប់ listener គ្រប់ (ចំនួនដេរីវេពី DB_LISTENER_KEYS)',
        REAL_LISTENER_KEYS.length >= 6 && t.log.attached.length === REAL_LISTENER_KEYS.length, t.log.attached);
    ok('detach មុនភ្ជាប់ (គ្មាន listener ស្ទួន)',
        t.log.off.length === REAL_LISTENER_KEYS.length, t.log.off);
    ok('ស្ថានភាព = online ពេលធម្មតា', t.api.connectionLooksOnline() === true);
    t.api.renderConnectionStatus();
    ok('អត្ថបទ = ភ្ជាប់ Server រួចរាល់', t.statusText.innerText.indexOf('រួចរាល់') !== -1, t.statusText.innerText);
}

{
    const t = buildContext();
    const snap = (v) => ({ val: () => v });
    t.api.initDatabaseListeners();
    const staleHistory = t.listenerHistory.history[0].cb;
    t.api.initDatabaseListeners();
    t.listenerCallbacks.history.cb(snap([{ id: 'fresh', cod: 1, dod: 0 }]));
    staleHistory(snap([{ id: 'stale', cod: 9, dod: 0 }]));
    ok('⛔ callback របស់ listener ចាស់មិនត្រូវសរសេរជាន់ snapshot ថ្មី',
        t.ctx.scanHistory.length === 1 && t.ctx.scanHistory[0].id === 'fresh', t.ctx.scanHistory);

    // ⛔ **ច្បាប់នេះជារបស់ listener *ទាំងអស់* មិនមែនត្រឹម `history`។**
    // ជំនាន់មុននៃប្លុកនេះវាស់តែ `history` ➜ ការដកច្រកទ្វារជំនាន់
    // (`listenerGeneration !== dbListenerGeneration`) ចេញពី listener **ណាមួយ
    // ផ្សេង** រស់រានលើ checker ទាំងអស់។ វាស់បាន ៖ ការដកវាចេញពី `deleted`
    // **រស់រាន** សំណុំពេញ (១៧៥ ពេញលេញ · SKIP ០)។ នេះជាថ្នាក់ «អ្នកយាមដែល
    // វាស់សាខា ១ ខណៈច្បាប់គ្រប់សាខា» ➜ ការអះអាងត្រូវ **ដេរីវេពី
    // `DB_LISTENER_KEYS` ពិត** មិនមែនចម្លងជាប្លុកទី ២។
    //
    // អ្វីដែលច្រកទ្វារនោះការពារ ៖ `fb.off()` រុំក្នុង `try/catch` ➜ វាអាចធ្លាក់
    // (SDK ត្រូវលុប · ref មិនត្រឹមត្រូវ) ហើយ snapshot ដែលកំពុងហោះក៏មកដល់
    // **ក្រោយ** ការប្តូរ database/auth ដែរ ➜ callback ចាស់នឹង (១) សរសេរ
    // ទិន្នន័យ **Project ចាស់** ចូលសតិ និង (២) ហៅ `noteDbListenerAlive()`
    // ➜ **ប្រកាសថាទិដ្ឋភាពស្រស់** ខណៈ listener ថ្មីមិនទាន់មកដល់ ➜ អេក្រង់
    // «គ្មានទិន្នន័យ» ក្លាយជាការពិត និងការសម្អាតបំផ្លាញរត់លើទិដ្ឋភាពចាស់។
    REAL_LISTENER_KEYS.forEach((key) => {
        const tk = buildContext();
        tk.api.initDatabaseListeners();
        const staleCb = tk.listenerHistory[key][0].cb;
        tk.api.initDatabaseListeners();
        let threw = null;
        try { staleCb(snap(null)); } catch (e) { threw = String(e && e.message); }
        ok('⛔ callback ចាស់របស់ `' + key + '` មិនត្រូវប្រកាសថាទិដ្ឋភាពស្រស់',
            !threw && tk.probe().pending.indexOf(key) !== -1,
            { key: key, threw: threw, pending: tk.probe().pending });
        // ⛔ ទិសផ្ទុយ ៖ បើ callback **ថ្មី** ក៏មិនដកកូនសោចេញពី pending ដែរ
        // នោះការអះអាងខាងលើពិតដោយស្វ័យប្រវត្តិ (វាស់អ្វីក៏មិនដឹង)។
        tk.listenerCallbacks[key].cb(snap(null));
        ok('⛔ ទិសផ្ទុយ ៖ callback ថ្មីរបស់ `' + key + '` ត្រូវប្រកាសថាស្រស់',
            tk.probe().pending.indexOf(key) === -1, { key: key, pending: tk.probe().pending });
    });

    // ⛔ ទិន្នន័យអតិថិជនរស់នៅ **២** listener (`history` និង `deleted`) ➜
    // ការសរសេរជាន់ត្រូវវាស់ **ទាំង ២** មិនមែនត្រឹមមួយ។
    {
        const td = buildContext();
        td.api.initDatabaseListeners();
        const staleDeleted = td.listenerHistory.deleted[0].cb;
        td.api.initDatabaseListeners();
        td.listenerCallbacks.deleted.cb(snap([{ id: 'fresh-del', cod: 1, dod: 0 }]));
        staleDeleted(snap([{ id: 'stale-del', cod: 9, dod: 0 }]));
        ok('⛔ callback `deleted` ចាស់មិនត្រូវសរសេរជាន់ snapshot ថ្មី',
            td.ctx.deletedItems.length === 1 && td.ctx.deletedItems[0].id === 'fresh-del',
            td.ctx.deletedItems);
    }

    t.setInfoRefs({ __path: 'info/connected' }, { __path: 'info/offset' });
    t.api.attachInfoListeners();
    const staleConnected = t.listenerHistory['info/connected'][0].cb;
    t.api.attachInfoListeners();
    t.listenerCallbacks['info/connected'].cb(snap(true));
    staleConnected(snap(false));
    ok('⛔ callback `.info/connected` ចាស់មិនត្រូវបង្ហាញ Offline ក្លែងក្លាយ',
        t.infoProbe().isDatabaseConnected === true, t.infoProbe());
}

// ── ២. listener ត្រូវ cancel ➜ មិនត្រូវអះអាងថាភ្ជាប់ ─────────────────
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    t.listenerCallbacks.history.errCb(new Error('permission_denied'));

    ok('ទង់បរាជ័យត្រូវលើក', t.probe().dbListenersFailed === true);
    ok('connectionLooksOnline ក្លាយជា false ទោះ .info/connected នៅ true',
        t.api.connectionLooksOnline() === false);
    t.api.renderConnectionStatus();
    ok('ចំណុចស្ថានភាពប្តូរជា offline', t.statusDot.classes.offline === true);
    ok('អត្ថបទប្រាប់ថាកំពុងភ្ជាប់ឡើងវិញ', t.statusText.innerText.indexOf('ភ្ជាប់ឡើងវិញ') !== -1, t.statusText.innerText);
    ok('កំហុសត្រូវផ្ញើទៅ Sentry', t.log.captures.length === 1);
    ok('មានកាលវិភាគស្តារ', t.probe().dbListenerRecoveryTimer !== null);
}

// ── ៣. listener បរាជ័យច្រើន ➜ សារតែមួយ ──────────────────────────────
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    REAL_LISTENER_KEYS
        .forEach((p) => t.listenerCallbacks[p].errCb(new Error('permission_denied')));
    const outage = t.log.toasts.filter((m) => m.indexOf('ដាចការទាញយកទិន្នន័យ') !== -1);
    ok('សារដាច់ការតភ្ជាប់បង្ហាញតែ ១ ដង (មិនមែន ៦)', outage.length === 1, t.log.toasts);
}

// ── ៣ខ. ⛔ Sentry ៖ listener ដែលត្រូវបដិសេធជាប់ៗ មិនត្រូវផ្ញើ event រាល់ជុំស្តារ ─────
//    វាស់បានលើ Sentry ផលិតកម្ម (JAVASCRIPT-REACT-2) ៖ `permission_denied` លើ listener ទាំង ៧ ➜ ជណ្តើរស្តារ
//    ចាក់ listener ឡើងវិញ (២ · ៥ · ១០ · ២០ · ៣០ វិ.) ➜ **៧ event រាល់ជុំ** (៦៣ event ក្នុង ២ នាទី · ~៨៤០/ម៉ោង/ឧបករណ៍)
//    ➜ កូតា Sentry អស់ ➜ ការជូនដំណឹង `zone: 'money'` ពិតបាត់។ ច្បាប់ ៖ **១ event ក្នុងមួយ path ក្នុងមួយការដាច់**
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    const fireAll = () => REAL_LISTENER_KEYS.forEach((p) => t.listenerCallbacks[p].errCb(new Error('permission_denied')));
    fireAll();
    const first = t.log.captures.length;
    ok('លក្ខខណ្ឌចាំបាច់ ៖ ការដាច់ដំបូងរាយការណ៍ ១ ក្នុងមួយ path', first === REAL_LISTENER_KEYS.length, first);
    let attachRounds = 0;
    [3000, 6000, 11000, 21000, 31000, 31000].forEach((ms) => {
        const before = t.log.attached.length;
        t.advance(ms);
        if (t.log.attached.length > before) { attachRounds++; fireAll(); }
    });
    ok('លក្ខខណ្ឌចាំបាច់ ៖ ជណ្តើរស្តារពិតជាចាក់ listener ឡើងវិញច្រើនជុំ', attachRounds >= 4, attachRounds);
    ok('⛔ ការបដិសេធជាប់ៗ មិនផ្ញើ Sentry រាល់ជុំស្តារ (១ ក្នុងមួយ path ក្នុងមួយការដាច់)',
        t.log.captures.length === REAL_LISTENER_KEYS.length, { captures: t.log.captures.length, rounds: attachRounds, paths: REAL_LISTENER_KEYS.length });
    t.advance(31000);
    const snap = (v) => ({ val: () => v });
    REAL_LISTENER_KEYS.forEach((p) => t.listenerCallbacks[p].cb(snap(null)));
    ok('លក្ខខណ្ឌចាំបាច់ ៖ ស្តារបាន', t.probe().dbListenersFailed === false, t.probe());
    const beforeNew = t.log.captures.length;
    t.listenerCallbacks.history.errCb(new Error('permission_denied'));
    ok('⛔ ទិសផ្ទុយ ៖ ការដាច់ **ថ្មី** ក្រោយស្តាររួច ត្រូវរាយការណ៍ម្តងទៀត', t.log.captures.length === beforeNew + 1, t.log.captures.length - beforeNew);
}

// ── ៤. ការស្តារឡើងវិញដោយស្វ័យប្រវត្តិ ────────────────────────────────
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    const attachedBefore = t.log.attached.length;
    t.listenerCallbacks.history.errCb(new Error('permission_denied'));

    t.advance(1000);
    ok('មិនទាន់ស្តារមុនដល់ពេល', t.log.attached.length === attachedBefore, t.log.attached.length);

    t.advance(2000);
    ok('ស្តារ listener ឡើងវិញដោយស្វ័យប្រវត្តិ', t.log.attached.length === attachedBefore + REAL_LISTENER_KEYS.length, t.log.attached.length);
    ok('detach មុនស្តារ (គ្មាន listener ស្ទួន)', t.log.off.length === REAL_LISTENER_KEYS.length * 2, t.log.off.length);
    ok('ទង់នៅតែបរាជ័យរហូតដល់ snapshot មកដល់', t.probe().dbListenersFailed === true);
    ok('path ទាំងអស់នៅរង់ចាំ (ចំនួនដេរីវេ)',
        t.probe().pending.length === REAL_LISTENER_KEYS.length, t.probe().pending);
}

// ── ៥. ទង់រលត់តែពេល path ទាំងអស់ដឹងខ្លួន ─────────────────────────────
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    t.listenerCallbacks.history.errCb(new Error('permission_denied'));
    t.advance(3000);

    const snap = (v) => ({ val: () => v });
    REAL_LISTENER_KEYS.filter((p) => p !== 'deleted')
        .forEach((p) => t.listenerCallbacks[p].cb(snap(null)));
    ok('ទង់នៅតែបរាជ័យ ខណៈ path មួយនៅស្ងាត់', t.probe().dbListenersFailed === true, t.probe().pending);

    t.listenerCallbacks.deleted.cb(snap(null));
    ok('ទង់រលត់ពេល path ទាំង ៦ ដឹងខ្លួន', t.probe().dbListenersFailed === false);
    ok('connectionLooksOnline ត្រឡប់មក true', t.api.connectionLooksOnline() === true);
    const back = t.log.toasts.filter((m) => m.indexOf('ភ្ជាប់មកវិញ') !== -1);
    ok('សារជូនដំណឹងថាភ្ជាប់មកវិញ ១ ដង', back.length === 1, t.log.toasts);
    ok('កាលវិភាគស្តារត្រូវលុប', t.probe().dbListenerRecoveryTimer === null);
}

// ── ៥ខ. ⛔ listener ដែលងាប់ **តែឯង** មិនត្រូវត្រូវប្រកាសថាជាសះស្បើយ
//        ដោយ snapshot របស់ **បងប្អូន** ─────────────────────────────────
//
// 🔴 ចន្លោះពិត។ scenario ៤ និង ៥ ខាងលើបាញ់ `errCb` **ភ្លាមក្រោយ
// `initDatabaseListeners()`** ➜ path ទាំង ៦ នៅ **pending** ➜ ល័ក្ខខ័ណ្ឌ
// `dbListenerPendingPaths.size` ក្នុង `noteDbListenerAlive()` ការពារទង់ជាប់
// ដោយចៃដន្យ។ ស្ថានភាពពិតរបស់អ្នកប្រើគឺ **ផ្ទុយពីនោះ**៖ App ដំណើរការមួយ
// សន្ទុះ ➜ path ទាំង ៦ **មកដល់គ្រប់** (pending ទទេ) ➜ **ក្រោយមក** path
// មួយទើបងាប់ (`permission_denied` លើ node តែមួយ · rules ប្តូរ · listener
// ត្រូវ server cancel)។
//
// ក្នុងស្ថានភាពនោះ snapshot បន្ទាប់ពី path **ណាមួយផ្សេង** (ប្រវត្តិប្តូរ
// រាល់ការស្កេន) ធ្វើឲ្យ `noteDbListenerAlive()` ឃើញ `pending.size === 0`
// ➜ លុបទង់បរាជ័យ · លុបកាលវិភាគស្តារ · បោះ toast «ភ្ជាប់មកវិញហើយ» ➜
// **listener ដែលងាប់មិនដែលត្រូវ attach ឡើងវិញទេ ពេញវគ្គ**។
//
// ផលដែលវាស់បាន ៖ ចំណុចស្ថានភាព **បៃតង** ខណៈទិន្នន័យកក។ ហើយបើ path
// ដែលងាប់ជា `deleted` នោះវាធ្ងន់ជាង៖ `deletedItems` នៅកក ខណៈច្រកទ្វារ
// `dbListenerPendingPaths.has('deleted')` ក្នុង `clearStaleRestoreMarkers()`
// និង `dropStaleRestoreMarkers()` **បើកចំហ** (កូនសោនោះលែង pending) ➜
// marker របស់ឧបករណ៍ *ផ្សេង* ដែលកំពុងស្តារត្រូវលុប ➜ `permission_denied`
// ➜ «ដក»/«លុប» ស្លាប់ជារៀងរហូត (ថ្នាក់ដដែលនឹង 2.20.1 និង 2.17.3)។
//
// ⛔ មេរៀនអំពីឧបករណ៍ ៖ សំណួរមិនមែនត្រឹម «checker អះអាងអ្វី» ទេ — ត្រូវសួរ
// **«វាដាក់ប្រព័ន្ធក្នុង *ស្ថានភាព* ណា មុនអះអាង?»**។ ការអះអាងត្រឹមត្រូវ
// ក្នុងស្ថានភាពដែលកំហុសមិនអាចកើត គឺជាបៃតងក្លែងក្លាយ។
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    const snap = (v) => ({ val: () => v });

    // ១. App ដំណើរការធម្មតា ៖ path ទាំង ៦ មកដល់គ្រប់ ➜ pending ទទេ
    REAL_LISTENER_KEYS
        .forEach((p) => t.listenerCallbacks[p].cb(snap(null)));
    ok('រៀបចំ ៖ path ទាំង ៦ មកដល់គ្រប់ ➜ គ្មាន pending',
        t.probe().pending.length === 0 && t.probe().dbListenersFailed === false, t.probe());

    const attachedBefore = t.log.attached.length;

    // ២. **ក្រោយមក** path `deleted` ងាប់តែឯង
    t.listenerCallbacks.deleted.errCb(new Error('permission_denied'));
    ok('listener `deleted` ងាប់ ➜ ទង់បរាជ័យត្រូវលើក',
        t.probe().dbListenersFailed === true);

    // ៣. snapshot របស់ **បងប្អូន** មកដល់ (ប្រវត្តិប្តូររាល់ការស្កេន)
    t.listenerCallbacks.history.cb(snap(null));
    ok('⛔ snapshot របស់ path ផ្សេង **មិនត្រូវ** លុបទង់បរាជ័យ',
        t.probe().dbListenersFailed === true, t.probe());
    ok('⛔ ស្ថានភាពមិនត្រូវប្រកាសថាភ្ជាប់រួចរាល់',
        t.api.connectionLooksOnline() === false);
    const falseBack = t.log.toasts.filter((m) => m.indexOf('ភ្ជាប់មកវិញ') !== -1);
    ok('⛔ គ្មានសារ «ភ្ជាប់មកវិញហើយ» ក្លែងក្លាយ', falseBack.length === 0, t.log.toasts);
    ok('⛔ កាលវិភាគស្តារត្រូវនៅរស់', t.probe().dbListenerRecoveryTimer !== null);

    // ៤. ជណ្តើរស្តារត្រូវ attach ឡើងវិញពិត
    t.advance(3000);
    ok('⛔ listener ដែលងាប់ត្រូវ attach ឡើងវិញពិត',
        t.log.attached.length === attachedBefore + REAL_LISTENER_KEYS.length, t.log.attached.length);

    // ៥. ⛔ ទិសផ្ទុយ ៖ ក្រោយ attach ឡើងវិញ ការមកដល់គ្រប់ path ត្រូវ
    //    លុបទង់ដដែល — ការកែមិនត្រូវធ្វើឲ្យទង់ជាប់ជារៀងរហូត។
    REAL_LISTENER_KEYS
        .forEach((p) => t.listenerCallbacks[p].cb(snap(null)));
    ok('⛔ ទិសផ្ទុយ ៖ ការជាសះស្បើយពិត នៅតែលុបទង់បរាជ័យដដែល',
        t.probe().dbListenersFailed === false, t.probe());
    ok('⛔ ទិសផ្ទុយ ៖ សារ «ភ្ជាប់មកវិញហើយ» ចេញ ១ ដងក្រោយការជាសះស្បើយពិត',
        t.log.toasts.filter((m) => m.indexOf('ភ្ជាប់មកវិញ') !== -1).length === 1, t.log.toasts);
}

// ── ៥ខ២. ⛔ ទិសផ្ទុយ ៖ ច្រកទ្វារថ្មីមិនត្រូវ **ជាប់** ជារៀងរហូត ─────────
//
// ការតាមដានតាម path បិទរន្ធ «បៃតងក្លែងក្លាយ» — តែវាបើករន្ធផ្ទុយ៖ បើកូនសោ
// ដែលងាប់មិនត្រូវលុបចេញពេល path នោះ **ដឹងខ្លួនវិញ** នោះ App ជាប់
// «កំពុងភ្ជាប់ឡើងវិញ...» ជារៀងរហូត ហើយច្រកទ្វារ marker បិទជាប់ ➜
// ការសម្អាត marker ងាប់ក៏ស្លាប់ដែរ។ ការអះអាងត្រូវមាន **២ ខាង** ជានិច្ច។
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    const snap = (v) => ({ val: () => v });
    REAL_LISTENER_KEYS
        .forEach((p) => t.listenerCallbacks[p].cb(snap(null)));

    t.listenerCallbacks.deleted.errCb(new Error('permission_denied'));
    ok('រៀបចំ ៖ `deleted` ត្រូវកត់ថាងាប់', t.probe().failed.indexOf('deleted') !== -1, t.probe());

    // path ដដែលនោះដឹងខ្លួនវិញ (RTDB អាចបញ្ជូន snapshot មកវិញដោយខ្លួនឯង)
    t.listenerCallbacks.deleted.cb(snap(null));
    ok('⛔ path ដែលងាប់ដឹងខ្លួនវិញ ➜ កូនសោត្រូវលុបចេញ',
        t.probe().failed.length === 0, t.probe());
    ok('⛔ ទង់បរាជ័យត្រូវរលត់ (ច្រកទ្វារមិនជាប់ជារៀងរហូត)',
        t.probe().dbListenersFailed === false, t.probe());
    ok('⛔ ស្ថានភាពត្រឡប់មកបៃតងវិញ', t.api.connectionLooksOnline() === true);
}

// ── ៥គ. ច្រកទ្វារ «ទិដ្ឋភាព `deleted` មិនគួរទុកចិត្ត» ត្រូវរាប់ការងាប់ ──
//
// ច្រកទ្វារនៃ marker (2.20.1) សួរតែ `dbListenerPendingPaths.has('deleted')`។
// កូនសោនោះត្រូវ **លុបចេញ** ពេល snapshot ដំបូងមកដល់ ➜ listener ដែលងាប់
// **ក្រោយមក** មិនធ្វើឲ្យវាត្រឡប់មកវិញទេ ➜ ច្រកទ្វារបើកចំហលើទិន្នន័យកក។
// ⛔ ត្រូវមានមូលដ្ឋាន **តែមួយ** ដែលរាប់ទាំង «មិនទាន់មកដល់» និង «ងាប់»។
{
    const guardFn = sliceFn('dbListenerViewIsStale');
    ok('មានមូលដ្ឋានតែមួយ `dbListenerViewIsStale()` សម្រាប់ «ទិដ្ឋភាពមិនគួរទុកចិត្ត»',
        !!guardFn, guardFn);
    if (guardFn) {
        ok('`dbListenerViewIsStale()` រាប់ទាំង pending និង failed',
            /dbListenerPendingPaths\.has/.test(guardFn) && /dbListenerFailedPaths\.has/.test(guardFn), guardFn);
    }
    const marker = (sliceFn('clearStaleRestoreMarkers') || '') + '\n' + (sliceFn('dropStaleRestoreMarkers') || '');
    ok('ច្រកទ្វារ marker ទាំង ២ ប្រើមូលដ្ឋាននោះ',
        (marker.match(/dbListenerViewIsStale\(DB_LISTENER_KEY_DELETED\)/g) || []).length === 2, marker.slice(0, 300));
    // ⛔ ការសួរដោយផ្ទាល់ត្រូវរស់នៅ **ក្នុង helper តែមួយ** — គ្រប់កន្លែងផ្សេង
    // ត្រូវហៅ helper នោះ។ ការរាប់ត្រូវធ្វើ **ក្រៅតួ helper** ដើម្បីកុំឲ្យ
    // ការអះអាងក្លាយជាការលើកលែងដែលងាប់។
    const outsideHelper = guardFn ? SRC.split(guardFn).join('') : SRC;
    ok('⛔ គ្មានច្រកទ្វារណានៅសួរ `dbListenerPendingPaths.has()` ដោយផ្ទាល់ទៀតទេ',
        !/dbListenerPendingPaths\.has\(/.test(outsideHelper), 'នៅមានការសួរដោយផ្ទាល់');
}

// ── ៥ឃ. រាល់ `onValue` ត្រូវប្រាប់ **ថា path ណា** ដែលងាប់ ────────────
//
// `handleDbListenerError` ដែលបញ្ជូនទទេ មិនអាចដឹងថា path ណាងាប់ទេ ➜
// ការតាមដានតាម path ក្លាយជា **ការការពារដែលងាប់** (ថ្នាក់ដដែលនឹង 2.20.1)។
{
    const initFn = sliceFn('initDatabaseListeners') || '';
    const bare = (initFn.match(/,\s*handleDbListenerError\s*\)/g) || []).length;
    ok('⛔ គ្មាន `onValue(..., handleDbListenerError)` ទទេ (ត្រូវបញ្ជូនកូនសោ path)',
        bare === 0, bare);
    const keyed = (initFn.match(/handleDbListenerError\(\s*\w+\s*,/g) || []).length;
    ok('រាល់ listener បញ្ជូនកូនសោ path ចូល handleDbListenerError (ចំនួនដេរីវេពី DB_LISTENER_KEYS)',
        REAL_LISTENER_KEYS.length >= 6 && keyed === REAL_LISTENER_KEYS.length,
        keyed + '/' + REAL_LISTENER_KEYS.length);
}

// ── ៦. ការសម្អាតស្វ័យប្រវត្តិមិនត្រូវរត់លើទិន្នន័យកក ─────────────────
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    t.ctx.isDatabaseInitialized = true;
    t.api.runScheduledCleanup();
    ok('សម្អាតរត់ពេលទិន្នន័យស្រស់', t.log.cleanupRuns === 1, t.log.cleanupRuns);

    t.listenerCallbacks.history.errCb(new Error('permission_denied'));
    t.api.runScheduledCleanup();
    ok('សម្អាតមិនរត់លើ snapshot ដែលកក', t.log.cleanupRuns === 1, t.log.cleanupRuns);
}

// ── ៧. ការស្តារឡើងវិញភ្លាមពេលបណ្តាញត្រឡប់មក ─────────────────────────
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    t.listenerCallbacks.history.errCb(new Error('permission_denied'));
    const before = t.log.attached.length;

    t.ctx.navigator.onLine = false;
    t.api.retryFailedDbListenersNow();
    t.advance(60000);
    ok('មិនព្យាយាមស្តារខណៈគ្មានបណ្តាញ', t.log.attached.length === before, t.log.attached.length);

    t.ctx.navigator.onLine = true;
    t.api.retryFailedDbListenersNow();
    ok('ស្តារភ្លាមពេលបណ្តាញត្រឡប់មក', t.log.attached.length === before + REAL_LISTENER_KEYS.length, t.log.attached.length);
}

// ── ៨. ចាកចេញ ➜ សម្អាតស្ថានភាព ─────────────────────────────────────
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    t.listenerCallbacks.history.errCb(new Error('permission_denied'));
    t.api.resetDbListenerHealthState();
    const p = t.probe();
    ok('ទង់បរាជ័យត្រូវសម្អាតពេលចាកចេញ', p.dbListenersFailed === false);
    ok('timer ស្តារត្រូវលុប', p.dbListenerRecoveryTimer === null);
    ok('timer watchdog ត្រូវលុប', p.reconnectWatchdogTimer === null);
    ok('បញ្ជី path រង់ចាំត្រូវសម្អាត', p.pending.length === 0, p.pending);
}

// ── ៩. ការភ្ជាប់ឡើងវិញ — reset backoff របស់ Firebase ────────────────
{
    const t = buildContext();
    t.ctx.isDatabaseConnected = true;
    t.api.nudgeDatabaseConnection();
    ok('ពេលភ្ជាប់ស្រាប់ ៖ goOnline ធម្មតា គ្មាន goOffline',
        t.log.goOnline === 1 && t.log.goOffline === 0, [t.log.goOnline, t.log.goOffline]);

    t.ctx.isDatabaseConnected = false;
    t.api.nudgeDatabaseConnection();
    ok('ពេលដាច់ ៖ goOffline+goOnline ដើម្បី reset backoff',
        t.log.goOffline === 1 && t.log.goOnline === 2, [t.log.goOffline, t.log.goOnline]);

    t.api.nudgeDatabaseConnection();
    ok('មិន reset ជាន់គ្នាក្នុងចន្លោះខ្លី', t.log.goOffline === 1, t.log.goOffline);

    t.ctx.navigator.onLine = false;
    t.advance(20000);
    const offBefore = t.log.goOffline;
    t.api.nudgeDatabaseConnection();
    ok('មិនប៉ុនប៉ងភ្ជាប់ខណៈគ្មានបណ្តាញ', t.log.goOffline === offBefore, t.log.goOffline);
}

// ── ១០. watchdog ៖ ព្យាយាមម្តងទៀត ហើយឈប់ពេលភ្ជាប់បាន ────────────
{
    const t = buildContext();
    t.ctx.isDatabaseConnected = false;
    t.api.nudgeDatabaseConnection();
    const first = t.log.goOffline;
    ok('ការភ្ជាប់លើកទី ១ ត្រូវធ្វើភ្លាម', first === 1, first);

    t.advance(5001);
    ok('watchdog ព្យាយាមម្តងទៀតក្រោយ ៥ វិនាទី', t.log.goOffline === 2, t.log.goOffline);

    t.advance(10001);
    ok('watchdog ពន្យារពេលកាន់តែយូរ (backoff)', t.log.goOffline === 3, t.log.goOffline);

    t.ctx.isDatabaseConnected = true;
    t.api.clearReconnectWatchdog();
    const settled = t.log.goOffline;
    t.advance(120000);
    ok('watchdog ឈប់ពេលភ្ជាប់បាន', t.log.goOffline === settled, t.log.goOffline);
}

// ── ១០ខ. វដ្ត goOffline()+goOnline() មិនត្រូវកាត់ផ្តាច់ handshake ដំបូង ──
// វាស់រួច (audit-tools/reconnect-ladder-test.js)៖ ពេល handshake ដំបូងយឺតជាង
// ជំហានដំបូងរបស់ watchdog (៥ វិ.) ការ force-cycle **កាត់ផ្តាច់វា** ហើយចាប់
// ផ្តើមឡើងវិញ ➜ បាត់ ៥–៣៥ វិនាទីលើបណ្តាញ 2G។ មុនការភ្ជាប់ជោគជ័យលើកដំបូង
// backoff ខាងក្នុងរបស់ SDK នៅតូច ដូច្នេះការ reset វា **គ្មានអ្វីទទួលបានទេ**។
// តែពេលបណ្តាញទើបត្រឡប់មកវិញ SDK ទំនងជាកំពុងអង្គុយក្នុងបង្អួច backoff ដែល
// រីកធំ ➜ វដ្តនោះ **មានតម្លៃពិត** ➜ ត្រូវអនុញ្ញាត។
{
    const t = buildContext();
    t.setConnHistory(false, false);
    t.ctx.isDatabaseConnected = false;
    t.api.nudgeDatabaseConnection();
    ok('មិនទាន់ដែលភ្ជាប់ + បណ្តាញឡើងជាប់ ៖ **មិនកាត់ផ្តាច់ handshake**',
        t.log.goOffline === 0 && t.log.goOnline === 1, [t.log.goOffline, t.log.goOnline]);

    t.advance(5001);
    ok('watchdog ក៏មិនកាត់ផ្តាច់វាដែរ', t.log.goOffline === 0, t.log.goOffline);
    t.advance(30000);
    ok('ទោះជុំក្រោយៗក៏មិនកាត់ផ្តាច់ដែរ', t.log.goOffline === 0, t.log.goOffline);
}
{
    const t = buildContext();
    t.setConnHistory(false, true);
    t.ctx.isDatabaseConnected = false;
    t.api.nudgeDatabaseConnection();
    ok('បណ្តាញទើបត្រឡប់មក ៖ **វដ្តត្រូវអនុញ្ញាត** (reset backoff ដែលរីកធំ)',
        t.log.goOffline === 1 && t.log.goOnline === 1, [t.log.goOffline, t.log.goOnline]);
    ok('ទង់ «បណ្តាញទើបមក» ត្រូវប្រើតែម្តង', t.connHistory().networkJustReturned === false);

    t.advance(5001);
    ok('ជុំបន្ទាប់លែងកាត់ផ្តាច់ handshake ថ្មីទៀត', t.log.goOffline === 1, t.log.goOffline);
}
{
    const t = buildContext();
    t.setConnHistory(true, false);
    t.ctx.isDatabaseConnected = false;
    t.api.nudgeDatabaseConnection();
    ok('ធ្លាប់ភ្ជាប់រួច ➜ ដាច់ ៖ វដ្តនៅដំណើរការដដែល (ឥរិយាបថចាស់)',
        t.log.goOffline === 1 && t.log.goOnline === 1, [t.log.goOffline, t.log.goOnline]);
}
{
    const t = buildContext();
    t.setConnHistory(false, false);
    ok('canCycleDatabaseConnection ៖ មិនដែលភ្ជាប់ + បណ្តាញមិនទើបមក ➜ false',
        t.ctx.canCycleDatabaseConnection() === false);
    t.setConnHistory(true, false);
    ok('canCycleDatabaseConnection ៖ ធ្លាប់ភ្ជាប់ ➜ true', t.ctx.canCycleDatabaseConnection() === true);
    t.setConnHistory(false, true);
    ok('canCycleDatabaseConnection ៖ បណ្តាញទើបមក ➜ true', t.ctx.canCycleDatabaseConnection() === true);
}

// ── ១០គ. ទាំង ២ App ត្រូវផ្តល់សញ្ញាទាំង ២ ─────────────────────────
{
    const zw = fs.readFileSync(path.join(appRoot, 'ZoeW', 'app.js'), 'utf8');
    const kg = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen', 'app.js'), 'utf8');
    [['ZoeW', zw], ['ZoeKeyGen', kg]].forEach(([name, src]) => {
        ok(name + ' ៖ កត់ត្រាការភ្ជាប់ជោគជ័យលើកដំបូង',
            /hasEverConnectedToDatabase = true;/.test(src));
        ok(name + ' ៖ ព្រឹត្តិការណ៍ `online` លើកទង់ «បណ្តាញទើបមក»',
            /addEventListener\('online', \(\) => \{\s*\n\s*networkJustReturned = true;/.test(src));
        ok(name + ' ៖ ស្ថានភាពនោះត្រូវ reset ពេលសាង Firebase app ថ្មី',
            /hasEverConnectedToDatabase = false;[\s\S]{0,80}networkJustReturned = false;/.test(src));
    });
}

// ── ១០ខ. ការស្តារ listener ត្រូវមានពិដានល្បឿន ─────────────────────────
// ថ្នាក់កំហុស៖ `retryFailedDbListenersNow()` ត្រូវហៅពី **ព្រឹត្តិការណ៍ខាងក្រៅ**
// ៣ កន្លែង — `online`, `visibilitychange` និង `.info/connected` ➜ true។ មុនកែ
// វា `clearDbListenerRecovery()` (reset ជណ្តើរ backoff មកសូន្យ) រួច
// `attemptDbListenerRecovery()` **ភ្លាមៗ គ្មានពិដាន**។ ដូច្នេះពេលបណ្តាញរញ្ជួយ
// ឬអ្នកប្រើប្តូរ App ចេញចូល នោះរាល់ព្រឹត្តិការណ៍បង្កើត **ការភ្ជាប់ listener
// ទាំង ៦ ឡើងវិញ** — ដែលនីមួយៗជាការទាញ node ពេញពី RTDB។
//
// វាស់បានលើកូដមុនកែ (គំរូដដែលនេះ)៖
//   ជណ្តើរតែឯង ៦០ វិ.                    ➜  ៤ ជុំ   (ត្រឹមត្រូវ៖ 2/5/10/20/30 វិ.)
//   មានព្រឹត្តិការណ៍ខាងក្រៅរៀងរាល់ ២ វិ. ៦០ វិ.  ➜  ៦០ ជុំ = **៣៦០ onValue**
//   ព្រឹត្តិការណ៍ ១០ ដងក្នុង ១ វិនាទី              ➜  ១០ ជុំ = **៦០ onValue**
// នេះជាថ្នាក់កំហុស «សំណើកកកុញ ➜ ពេញកូតា connection» ដដែល តែនៅលើផ្លូវ listener។
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    t.listenerCallbacks.history.errCb(new Error('permission_denied'));
    const base = t.log.attached.length;

    for (let i = 0; i < 10; i++) { t.advance(100); t.api.retryFailedDbListenersNow(); }
    const burst = (t.log.attached.length - base) / REAL_LISTENER_KEYS.length;
    ok('ព្រឹត្តិការណ៍ខាងក្រៅ ១០ ដងក្នុង ១ វិ. ➜ យ៉ាងច្រើន ១ ជុំភ្ជាប់ឡើងវិញ',
        burst <= 1, burst);

    const t2 = buildContext();
    t2.api.initDatabaseListeners();
    t2.listenerCallbacks.history.errCb(new Error('permission_denied'));
    const b2 = t2.log.attached.length;
    for (let i = 0; i < 30; i++) { t2.advance(2000); t2.api.retryFailedDbListenersNow(); }
    const sustained = (t2.log.attached.length - b2) / REAL_LISTENER_KEYS.length;
    ok('ព្រឹត្តិការណ៍រៀងរាល់ ២ វិ. អស់ ៦០ វិ. ➜ មិនលើស ២១ ជុំ (មុនកែ ៦០)',
        sustained <= 21, sustained);

    // ជណ្តើរធម្មតា (គ្មានព្រឹត្តិការណ៍ខាងក្រៅ) មិនត្រូវយឺតជាងមុនទេ
    const t3 = buildContext();
    t3.api.initDatabaseListeners();
    t3.listenerCallbacks.history.errCb(new Error('permission_denied'));
    const b3 = t3.log.attached.length;
    t3.advance(60000);
    ok('ជណ្តើរ backoff ធម្មតានៅដដែល (៤ ជុំក្នុង ៦០ វិ.)',
        (t3.log.attached.length - b3) / REAL_LISTENER_KEYS.length === 4, (t3.log.attached.length - b3) / REAL_LISTENER_KEYS.length);

    // ការស្តារនៅតែកើតឡើងពិត — ពិដានពន្យារវា មិនមែនលុបវាទេ
    const t4 = buildContext();
    t4.api.initDatabaseListeners();
    t4.listenerCallbacks.history.errCb(new Error('permission_denied'));
    const b4 = t4.log.attached.length;
    t4.ctx.navigator.onLine = false;
    t4.api.retryFailedDbListenersNow();
    t4.advance(30000);
    ok('គ្មានបណ្តាញ ➜ មិនព្យាយាម', t4.log.attached.length === b4, t4.log.attached.length - b4);
    t4.ctx.navigator.onLine = true;
    t4.api.retryFailedDbListenersNow();
    ok('បណ្តាញត្រឡប់មក ➜ ស្តារភ្លាម (ពិដានមិនទប់ការព្យាយាមលើកដំបូង)',
        t4.log.attached.length === b4 + REAL_LISTENER_KEYS.length, t4.log.attached.length - b4);

    // ក្រោយចាកចេញ ត្រូវភ្លេចពេលព្យាយាមចុងក្រោយ
    t4.api.resetDbListenerHealthState();
    ok('ចាកចេញ ➜ ពេលព្យាយាមចុងក្រោយត្រូវ reset',
        t4.probe().lastDbListenerAttemptAt === 0, t4.probe().lastDbListenerAttemptAt);
}

// ── ១០ខ១ខ. ជណ្តើរស្តារ **មិនត្រូវកាត់ផ្តាច់ការ resync ដែលកំពុងដំណើរការ** ──
// 🔴 ថ្នាក់កំហុស៖ `attemptDbListenerRecovery()` ហៅ `initDatabaseListeners()`
// ដែល **detach រួច attach ទាំង ៦ path ឡើងវិញ** — ការនោះបោះបង់ snapshot ដែល
// កំពុងទាញចុះមក។ លើតំណយឺត (2G ឬប្រវត្តិធំ) ការទាញលើកដំបូងអាចយូរជាងជំហាន
// ជណ្តើរ (2/5/10/20/30 វិ. ➜ ពិដាន ៣០ វិ.) ➜ រាល់ ៣០ វិនាទីវាចាប់ផ្តើមសាជាថ្មី
// ➜ **`dbListenerPendingPaths` មិនដែលអស់** ➜ តារាងកកជារៀងរហូត ខណៈស្ថានភាព
// សរសេរ «កំពុងភ្ជាប់ឡើងវិញ...»។ នេះជាថ្នាក់ «App ជាប់» ដដែល តែនៅលើផ្លូវ
// ដែលពិដានល្បឿន 2.14.0 មិនបានគ្រប (វាទប់តែព្រឹត្តិការណ៍ **ខាងក្រៅ**
// មិនមែនជណ្តើរខ្លួនឯងទេ)។
//
// ការកែ៖ `dbListenerResyncIsProgressing()` — ខណៈចំនួន path ដែលនៅសល់
// **កំពុងតូចទៅៗ** ជណ្តើរត្រូវរង់ចាំ មិនត្រូវ attach ឡើងវិញ។ បើវាឈប់តូច
// (ជាប់មែន) នោះជុំបន្ទាប់ attach ឡើងវិញដូចមុន ➜ ការស្តារនៅតែកើតឡើងពិត។
{
    const PATHS = REAL_LISTENER_KEYS;
    const t = buildContext();
    t.api.initDatabaseListeners();
    t.listenerCallbacks.history.errCb(new Error('permission_denied'));
    const base = t.log.attached.length;

    // តំណយឺត៖ path មួយឆ្លើយរៀងរាល់ ១២ វិនាទី — យឺតជាងជំហានជណ្តើរដើម
    PATHS.forEach((p) => {
        t.advance(12000);
        const cbs = t.listenerCallbacks[p];
        if (cbs && cbs.cb) cbs.cb({ val: () => null });
    });

    const rounds = (t.log.attached.length - base) / REAL_LISTENER_KEYS.length;
    ok('resync យឺត ➜ ជណ្តើរមិនកាត់ផ្តាច់វា (យ៉ាងច្រើន ៣ ជុំ attach ឡើងវិញ)',
        rounds <= 3, rounds);
    ok('⛔ resync យឺតត្រូវ **ចប់បាន** — មិនមែនចាប់ផ្តើមសាជាថ្មីរហូត',
        t.probe().dbListenersFailed === false && t.probe().pending.length === 0,
        JSON.stringify(t.probe().pending) + ' failed=' + t.probe().dbListenersFailed);

    // ការឈប់ដំណើរការពិត (គ្មាន path ណាឆ្លើយ) នៅតែត្រូវ attach ឡើងវិញដដែល —
    // ការកែនេះជាការ **ពន្យារ** មិនមែនការ **លុប** ការស្តារទេ។
    const t2 = buildContext();
    t2.api.initDatabaseListeners();
    t2.listenerCallbacks.history.errCb(new Error('permission_denied'));
    const b2 = t2.log.attached.length;
    t2.advance(60000);
    ok('គ្មានវឌ្ឍនភាពសោះ ➜ ជណ្តើរនៅ attach ឡើងវិញដដែល (៤ ជុំក្នុង ៦០ វិ.)',
        (t2.log.attached.length - b2) / REAL_LISTENER_KEYS.length === 4, (t2.log.attached.length - b2) / REAL_LISTENER_KEYS.length);

    // វឌ្ឍនភាពមួយផ្នែករួចជាប់ ➜ ជុំបន្ទាប់ត្រូវ attach ឡើងវិញ (ស្តារដោយខ្លួនឯង)
    const t3 = buildContext();
    t3.api.initDatabaseListeners();
    t3.listenerCallbacks.history.errCb(new Error('permission_denied'));
    t3.advance(2000);
    const b3 = t3.log.attached.length;
    t3.listenerCallbacks.exchangeRate.cb({ val: () => null });
    t3.advance(5000);
    const afterProgress = t3.log.attached.length;
    t3.advance(60000);
    ok('វឌ្ឍនភាពជាប់ ➜ ជុំបន្ទាប់ attach ឡើងវិញ (ការពន្យារមិនក្លាយជាការឈប់)',
        afterProgress === b3 && t3.log.attached.length > b3,
        'skip=' + (afterProgress === b3) + ' later=' + (t3.log.attached.length - b3) / REAL_LISTENER_KEYS.length);

    t3.api.resetDbListenerHealthState();
    ok('ចាកចេញ ➜ ការតាមដានវឌ្ឍនភាពត្រូវ reset',
        /dbListenerPendingSeen = 0;/.test(sliceFn('resetDbListenerHealthState') || ''));
}

// ── ១០ខ១ខ២. ⛔ អ្នកតាមដានវឌ្ឍនភាព **មិនត្រូវលេបភស្តុតាងរបស់ខ្លួន** ─────
// 🔴 កំហុសពិត (កំណែ 2.20.1)៖ `dbListenerResyncIsProgressing()` ធ្លាប់សរសេរ
// ជាន់ `dbListenerPendingSeen` **ខាងក្នុងការសួរ** ➜ ភស្តុតាងនៃវឌ្ឍនភាព
// ក្លាយជា **ប្រើបានតែម្តង**៖
//     ការសួរទី ១ ➜ true  (seen 6 ➜ 3)
//     ការសួរទី ២ ➜ false (3 >= 3)  ⟵ ខណៈ resync ដដែលនៅដំណើរការ
//
// នោះមិនមែនជាករណីទ្រឹស្តីទេ។ `setupConnectionRecovery()` ចុះឈ្មោះ
// `retryFailedDbListenersNow()` លើ **ព្រឹត្តិការណ៍ ២** — `online` និង
// `visibilitychange` — ហើយការដោះសោទូរស័ព្ទដែល WiFi ទើបត្រឡប់មកវិញ បាញ់
// **ទាំង ២ ក្នុង tick ដដែល**។ ការសួរទី ២ ឃើញ «គ្មានវឌ្ឍនភាព» ➜ ធ្លាក់ទៅ
// ការពិនិត្យ `DB_LISTENER_RETRY_MIN_GAP_MS` ➜ ក្នុងការ resync យឺត (ដែល
// `lastDbListenerAttemptAt` ចាស់ជាង ៣ វិ. ស្រាប់) វា **attach ឡើងវិញ** ➜
// បោះបង់ snapshot ដែលកំពុងទាញចុះមក។ នេះជាថ្នាក់កំហុស 2.19.4 ដដែលបេះបិទ
// ដែលវិលមកតាមទ្វារផ្សេង។
//
// ការកែ៖ កត់ត្រាវឌ្ឍនភាព **នៅកន្លែងដែលវាកើតឡើងពិត** (`noteDbListenerAlive`)
// ជាត្រាពេលវេលា ➜ ការសួរក្លាយជា idempotent។
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    t.listenerCallbacks.history.errCb(new Error('permission_denied'));

    // ជុំជណ្តើរទី ១ រត់ (attach ឡើងវិញ) ➜ `lastDbListenerAttemptAt` ត្រូវកំណត់
    t.advance(2000);
    // រួចរង់ចាំរហូតដល់ការព្យាយាមចុងក្រោយ **ចាស់ជាង** ពិដាន ៣ វិ. ដោយមិនឲ្យ
    // ជំហានជណ្តើរបន្ទាប់ (៥ វិ.) បាញ់ — បើមិនដូច្នេះ ពិដានល្បឿននឹងលាក់
    // ថ្នាក់កំហុសនេះ ហើយតេស្តបៃតងក្លែងក្លាយលើ tree មុនកែ។
    t.advance(4000);
    // resync កំពុងដើរ ៖ ៣ path ក្នុងចំណោម ៦ មកដល់ហើយ
    ['exchangeRate', 'dailyRevenue', 'monthlyRevenue'].forEach((p) => {
        t.listenerCallbacks[p].cb({ val: () => null });
    });
    const before = t.log.attached.length;

    // ការដោះសោទូរស័ព្ទ ៖ `online` រួច `visibilitychange` ក្នុង tick ដដែល
    t.api.retryFailedDbListenersNow();
    const afterFirst = t.log.attached.length;
    t.api.retryFailedDbListenersNow();
    const afterSecond = t.log.attached.length;

    ok('ព្រឹត្តិការណ៍ទី ១ (online) ➜ រង់ចាំ resync ដែលកំពុងដើរ',
        afterFirst === before, afterFirst - before);
    ok('⛔ ព្រឹត្តិការណ៍ទី ២ (visibilitychange) ក្នុង tick ដដែល ➜ ក៏ត្រូវរង់ចាំដែរ',
        afterSecond === before, afterSecond - before);

    // ការសួរច្រើនដងជាប់ៗគ្នា (ឧ. `.info/connected` បាញ់ផង) ក៏មិនត្រូវលេបវាដែរ
    for (let i = 0; i < 8; i++) t.api.retryFailedDbListenersNow();
    ok('⛔ ការសួរ ១០ ដងជាប់ៗគ្នា ➜ នៅតែរង់ចាំ (ភស្តុតាងមិនត្រូវលេប)',
        t.log.attached.length === before, t.log.attached.length - before);

    // resync ដដែលត្រូវ **ចប់បាន** — ការកែនេះជាការរង់ចាំ មិនមែនការទប់ទេ
    REAL_LISTENER_KEYS.filter((p) => p !== 'exchangeRate' && p !== 'dailyRevenue' && p !== 'monthlyRevenue')
        .forEach((p) => { t.listenerCallbacks[p].cb({ val: () => null }); });
    ok('resync ចប់ ➜ ទង់បរាជ័យរលត់',
        t.probe().dbListenersFailed === false && t.probe().pending.length === 0,
        JSON.stringify(t.probe().pending));

    // ⛔ ទិសផ្ទុយ ៖ ការរង់ចាំត្រូវ **ផុតកំណត់** បើ resync ស្លាប់ពិត
    const t2 = buildContext();
    t2.api.initDatabaseListeners();
    t2.listenerCallbacks.history.errCb(new Error('permission_denied'));
    t2.advance(1000);
    t2.listenerCallbacks.exchangeRate.cb({ val: () => null });
    const b2 = t2.log.attached.length;
    t2.advance(120000);
    ok('⛔ resync ស្លាប់ពិត ➜ ការរង់ចាំផុតកំណត់ ហើយជណ្តើរ attach ឡើងវិញ',
        t2.log.attached.length > b2, (t2.log.attached.length - b2) / REAL_LISTENER_KEYS.length);
}

// ── ១០ខ១គ. listener `.info/*` ដែលត្រូវបោះបង់ ក៏ត្រូវមានផ្លូវស្តារដែរ ────
// 🔴 ចន្លោះពិត៖ កំណែ 2.11.6 បានឲ្យ listener ទិន្នន័យទាំង ៦ នូវ
// `handleDbListenerError()` + ជណ្តើរស្តារ — តែ `.info/connected` និង
// `.info/serverTimeOffset` **ត្រូវបានទុកចោល**។ callback កំហុសរបស់
// `.info/connected` គ្រាន់តែសរសេរ UI រួច **មិនភ្ជាប់ខ្លួនវាឡើងវិញទេ**
// ចំណែក `.info/serverTimeOffset` **គ្មាន callback កំហុសសោះ**។
//
// ព្រោះ Firebase **ដក listener ចេញ** ពេល errCb បាញ់ នោះផលគឺ៖
//   · `isDatabaseConnected` កក `false` **ជារៀងរហូត** ➜ ស្លាកកុហកថា
//     «ក្រៅបណ្ដាញ» ខណៈ socket ដើរធម្មតា (ថ្នាក់ 2.19.0 ដដែល)
//   · watchdog វដ្ត `goOffline()`+`goOnline()` រៀងរាល់ ៦០ វិនាទី **អស់ថ្ម**
//   · `serverTimeOffsetMs` កក ➜ `getServerNow()` ឃ្លាត ➜ ការសម្រេច
//     retention ២ម៉ោង/៨ថ្ងៃ/៣០ថ្ងៃ ដើរលើនាឡិកាខុស
// ហើយគ្មានអ្វីស្តារវាបានទេ ក្រៅពី **ការ Refresh ដោយដៃ**។
{
    const t = buildContext();
    const infoRefs = { __path: 'info/connected' };
    ok('មាន attachInfoListeners (ផ្លូវភ្ជាប់ `.info/*` តែមួយ)',
        !!sliceFn('attachInfoListeners'));
    // ⛔ តាំងពី 2.23.1 callback កំហុសត្រូវបញ្ជូន **កូនសោ path** ជានិច្ច
    // (ច្បាប់ 2.20.8) ➜ លំនាំគឺ `(err) => handleInfoListenerError(err, KEY)`
    // មិនមែនឈ្មោះទទេទេ។ ការអះអាងត្រូវទាមទារកូនសោ ជំនួសការទាមទារឈ្មោះទទេ។
    ok('`.info/connected` មាន callback កំហុសដែលកេះការស្តារ (ជាមួយកូនសោ path)',
        /handleInfoListenerError/.test(SRC)
        && /fb\.onValue\(dbRefConnected[\s\S]{0,900}?handleInfoListenerError\(err, INFO_LISTENER_KEY_CONNECTED\)/.test(SRC));
    ok('⛔ `.info/serverTimeOffset` ក៏ត្រូវមាន callback កំហុសដែរ (ជាមួយកូនសោ path)',
        /fb\.onValue\(dbRefServerTimeOffset[\s\S]{0,700}?handleInfoListenerError\(err, INFO_LISTENER_KEY_OFFSET\)/.test(SRC));
    ok('ការស្តារនោះមានជណ្តើរ backoff មិនមែនរង្វិលជុំតឹង',
        /INFO_LISTENER_RECOVERY_STEPS_MS/.test(SRC)
        && /function scheduleInfoListenerRecovery\(/.test(SRC));
    ok('ការភ្ជាប់ឡើងវិញ detach ជាមុន (គ្មាន listener ស្ទួន)',
        /function attachInfoListeners\(\)[\s\S]{0,120}?detachInfoListeners\(\)/.test(SRC)
        && /function detachInfoListeners\(\)[\s\S]{0,300}?fb\.off\(dbRefConnected\)[\s\S]{0,200}?fb\.off\(dbRefServerTimeOffset\)/.test(SRC));
    // ⛔ តាំងពី 2.23.1 ការរលត់ធ្វើតាម `noteInfoListenerAlive(<key>)` ដែល
    // **រលត់តែពេលគ្មាន path ណានៅងាប់** — ការហៅ `clearInfoListenerRecovery()`
    // ដោយផ្ទាល់ក្នុង callback ជោគជ័យ ជា **បងប្អូនប្រកាសជំនួស** (ថ្នាក់ 2.20.8)។
    ok('snapshot ដែលមកដល់ ➜ ទង់ស្តារត្រូវរលត់ (តាមកូនសោ path)',
        /noteInfoListenerAlive\(INFO_LISTENER_KEY_CONNECTED\);[\s\S]{0,120}?isDatabaseConnected = snap\.val\(\) === true;/.test(SRC));
    ok('⛔ ការរលត់ត្រូវពិនិត្យថាគ្មាន path ណានៅងាប់',
        /function noteInfoListenerAlive\([\s\S]{0,300}?infoListenerFailedPaths\.size[\s\S]{0,80}?clearInfoListenerRecovery\(\)/.test(SRC),
        'បើរលត់ដោយមិនពិនិត្យ Set នោះ listener ដែលងាប់តែឯង មិនដែល attach ឡើងវិញ');
    ok('⛔ reattach ត្រូវរង់ចាំ snapshot `.info/*` ទាំង ២ មុនប្រកាសថាស្តាររួច',
        /function attachInfoListeners\(\)[\s\S]{0,700}?infoListenerFailedPaths\.add\(INFO_LISTENER_KEY_CONNECTED\)[\s\S]{0,160}?infoListenerFailedPaths\.add\(INFO_LISTENER_KEY_OFFSET\)/.test(SRC),
        'Set ទទេក្រោយ reattach ➜ connected មកមុនអាចលុប recovery ខណៈ serverTimeOffset នៅងាប់');
    ok('ចាកចេញ ➜ ការស្តារ `.info/*` ត្រូវ reset',
        /function resetDbListenerHealthState\(\)[\s\S]{0,200}?clearInfoListenerRecovery\(\);/.test(SRC));

    // ⛔ ថ្នាក់ដដែលរស់នៅ App ផ្សេង — មេរៀន 2.12.1
    const KG3 = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen', 'app.js'), 'utf8');
    // ⛔ ថ្នាក់ 2.20.8 ត្រូវអនុវត្តលើ App **ទាំង ២** — `shared-fns.js` ទាមទារ
    // ថា `handleInfoListenerError` និង `clearInfoListenerRecovery` ជា
    // **ការអនុវត្តតែមួយ** ដូច្នេះការកែម្ខាងតែម្នាក់ឯងនឹងធ្លាក់នៅទីនោះ។
    ok('ZoeKeyGen ៖ `.info/*` ក៏មានផ្លូវស្តារដដែល (ជាមួយកូនសោ path)',
        /function attachInfoListeners\(/.test(KG3)
        && /fb\.onValue\(dbRefServerTimeOffset[\s\S]{0,700}?handleInfoListenerError\(err, INFO_LISTENER_KEY_OFFSET\)/.test(KG3));
    ok('⛔ ZoeKeyGen ៖ ការរលត់ក៏ត្រូវពិនិត្យ Set ដែរ',
        /function noteInfoListenerAlive\([\s\S]{0,300}?infoListenerFailedPaths\.size/.test(KG3),
        'ZoeKeyGen ៖ `serverTimeSynced` ជាច្រកទ្វារនៃការចេញ Key ➜ offset ដែលកក ធ្ងន់ជាង');
    ok('⛔ ZoeKeyGen ៖ reattach ក៏ត្រូវរង់ចាំ snapshot `.info/*` ទាំង ២',
        /function attachInfoListeners\(\)[\s\S]{0,700}?infoListenerFailedPaths\.add\(INFO_LISTENER_KEY_CONNECTED\)[\s\S]{0,160}?infoListenerFailedPaths\.add\(INFO_LISTENER_KEY_OFFSET\)/.test(KG3),
        'connected មកមុនមិនមែនភស្តុតាងថា serverTimeOffset ស្តាររួចទេ');
    void t; void infoRefs;
}

{
    const kg = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen', 'app.js'), 'utf8');
    ok('ZoeKeyGen ៖ មាន generation fence សម្រាប់ callback `.info/*` ចាស់',
        /let infoListenerGeneration = 0;/.test(kg));
    const history = { connected: [], offset: [] };
    const refs = { connected: { path: 'connected' }, offset: { path: 'offset' } };
    const ctx = {
        console: { error: () => {} }, Set, Math,
        navigator: { onLine: true }, window: {},
        setTimeout: () => 1, clearTimeout: () => {},
        db: {}, dbRefConnected: refs.connected, dbRefServerTimeOffset: refs.offset,
        renderConnectionStatus: () => {}, scheduleReconnectWatchdog: () => {},
        clearReconnectWatchdog: () => {}, retryPendingRoleCheck: () => {},
        serverClockOffsetIsFromServer: () => true,
        fb: {
            off: () => {},
            onValue: (ref, cb, errCb) => history[ref.path].push({ cb, errCb })
        }
    };
    vm.createContext(ctx);
    const code =
        'let infoListenersFailed = true;\n' +
        'let infoListenerGeneration = 0;\n' +
        'let infoListenerRecoveryTimer = 1;\n' +
        'let infoListenerRecoveryAttempt = 2;\n' +
        'const infoListenerFailedPaths = new Set();\n' +
        "const INFO_LISTENER_KEY_CONNECTED = 'connected';\n" +
        "const INFO_LISTENER_KEY_OFFSET = 'serverTimeOffset';\n" +
        'let isDatabaseConnected = false, hasEverConnectedToDatabase = false;\n' +
        'let serverTimeOffsetMs = 0, serverTimeSynced = false;\n' +
        'const serverTimeSyncWaiters = [];\n' +
        sliceFnFrom(kg, 'clearInfoListenerRecovery') + '\n' +
        sliceFnFrom(kg, 'noteInfoListenerAlive') + '\n' +
        sliceFnFrom(kg, 'detachInfoListeners') + '\n' +
        sliceFnFrom(kg, 'attachInfoListeners') + '\n' +
        'this.__probe = () => ({ failed: infoListenersFailed, timer: infoListenerRecoveryTimer, pending: Array.from(infoListenerFailedPaths), connected: isDatabaseConnected, offset: serverTimeOffsetMs, synced: serverTimeSynced });\n';
    try {
        vm.runInContext(code, ctx);
        vm.runInContext('attachInfoListeners()', ctx);
        const staleConnected = history.connected[0].cb;
        const staleOffset = history.offset[0].cb;
        vm.runInContext('attachInfoListeners()', ctx);
        staleConnected({ val: () => true });
        staleOffset({ val: () => 9999 });
        const staleProbe = ctx.__probe();
        ok('⛔ ZoeKeyGen ៖ callback ចាស់មិនត្រូវលុប pending របស់ generation ថ្មី',
            staleProbe.failed === true && staleProbe.timer === 1 && staleProbe.pending.length === 2,
            staleProbe);
        ok('⛔ ZoeKeyGen ៖ callback ចាស់មិនត្រូវទុកចិត្ត offset ឬបង្ហាញ connected ក្លែងក្លាយ',
            staleProbe.connected === false && staleProbe.offset === 0 && staleProbe.synced === false,
            staleProbe);
        history.connected[1].cb({ val: () => true });
        history.offset[1].cb({ val: () => 1234 });
        const freshProbe = ctx.__probe();
        ok('ZoeKeyGen ៖ callback generation ថ្មីទាំង ២ ទើបអាចប្រកាសថាស្តាររួច',
            freshProbe.failed === false && freshProbe.pending.length === 0 && freshProbe.connected === true && freshProbe.offset === 1234 && freshProbe.synced === true,
            freshProbe);
    } catch (e) {
        ok('ZoeKeyGen stale-callback scenario រត់បាន', false, e && e.message);
    }
}

{
    const t = buildContext();
    const snap = (value) => ({ val: () => value });
    t.setInfoRefs({ __path: 'info/connected' }, { __path: 'info/offset' });
    t.api.attachInfoListeners();
    t.listenerCallbacks['info/connected'].cb(snap(true));
    t.listenerCallbacks['info/offset'].cb(snap(1234));
    t.listenerCallbacks['info/offset'].errCb(new Error('permission_denied'));
    t.advance(2000);
    t.listenerCallbacks['info/connected'].cb(snap(true));
    ok('⛔ reattach ក្រោយ offset ងាប់ ៖ connected មកតែម្នាក់ឯង មិនត្រូវរលត់ទង់ recovery',
        t.infoProbe().infoListenersFailed === true, t.infoProbe());
    ok('⛔ reattach ក្រោយ offset ងាប់ ៖ កាលវិភាគត្រូវនៅរស់រហូតដល់ offset មកដល់',
        t.infoProbe().infoListenerRecoveryTimer !== null, t.infoProbe());
    t.listenerCallbacks['info/offset'].cb(snap(5678));
    ok('offset ពិតប្រាកដមកដល់ក្រោយ reattach ➜ ទង់ recovery រលត់',
        t.infoProbe().infoListenersFailed === false && t.infoProbe().infoListenerRecoveryTimer === null,
        t.infoProbe());
}

// ── ១០ខ២. ការផ្ទុក SDK ឡើងវិញ ក៏ត្រូវមានពិដានល្បឿនដែរ ─────────────────
// ថ្នាក់កំហុស **ដដែលនឹង ១០ខ** តែនៅលើផ្លូវផ្សេង — ដូច្នេះការកែ 2.14.0 (ដែល
// ប៉ះតែ listener) **មិនបានគ្របវាទេ**។ `retryFirebaseSdkNow()` ត្រូវហៅពី
// `online` និង `visibilitychange`; មុនកែវា `clearFirebaseSdkRetry()` ដែល
// **reset ជណ្តើរ 5/10/20/30/60 វិ. មកសូន្យ** រួច `initFirebase()` ភ្លាមៗ
// គ្មានពិដាន។ ដូច្នេះនៅតំបន់សេវាអន់ (SDK ផ្ទុកមិនចូល) ការប្តូរ App ចេញចូល
// ធ្វើឲ្យជណ្តើរ **មិនដែលឡើងផុត ៥ វិនាទី** ➜ ស៊ីថ្ម និងបណ្តាញជារៀងរហូត។
//
// វាស់បានលើកូដមុនកែ (គំរូដដែលនេះ)៖ `online` បាញ់ ១០ ដងក្នុង ១ វិ. ➜
// `initFirebase()` **១០ ដង**។ ក្រោយកែ ➜ **១ ដង**។
{
    function buildSdkRetry(appSrc) {
        const pick = (name) => {
            const m = new RegExp('\\n(\\s*)(async\\s+)?function ' + name + '\\s*\\(').exec(appSrc);
            if (!m) return null;
            const head = appSrc.indexOf('function ' + name, m.index);
            let depth = 0, i = appSrc.indexOf('{', appSrc.indexOf('(', head)), started = false;
            for (; i < appSrc.length; i++) {
                if (appSrc[i] === '{') { depth++; started = true; }
                else if (appSrc[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
            }
            return (m[2] ? 'async ' : '') + appSrc.slice(head, i);
        };
        const konst = (name) => {
            const m = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);').exec(appSrc);
            return m ? 'const ' + name + ' = ' + m[1] + ';' : null;
        };
        let clock = 0;
        const timers = [];
        const calls = [];
        const reloads = [];
        const store = {};
        const ctx = vm.createContext({
            console, Math,
            Date: { now: () => clock },
            setTimeout: (fn, ms) => { const t = { at: clock + ms, fn, dead: false }; timers.push(t); return t; },
            clearTimeout: (t) => { if (t) t.dead = true; },
            navigator: { onLine: true },
            // ⛔ ការផ្ទុក module ដែលធ្លាក់ **មិនអាចព្យាយាមឡើងវិញក្នុងទំព័រដដែលបានទេ**
            // (module map របស់ browser cache ការបរាជ័យរហូតដល់ចាកចេញពីទំព័រ) ➜
            // ផ្លូវស្តារពិតគឺការផ្ទុកទំព័រឡើងវិញ។ stub នេះរាប់វា។
            window: { location: { reload: () => reloads.push(clock) } },
            // ⛔ ZoeW ជា React ៖ ស្ថានភាពប្រអប់ = `style.display` របស់ធាតុ (`modalIsOpen()` ក្នុងទិដ្ឋភាព) ➜ `__openModal`
            document: { querySelectorAll: () => [], getElementById: (id) => (id === ctx.__openModal ? { style: { display: 'flex' } } : null) },
            queueMicrotask,
            __openModal: null,
            sessionStorage: {
                getItem: (k) => (k in store ? store[k] : null),
                setItem: (k, v) => { store[k] = String(v); },
                removeItem: (k) => { delete store[k]; }
            },
            initFirebase: () => { calls.push(clock); return Promise.resolve(false); },
            firebaseSdkUnavailable: true, isDatabaseInitialized: false, isInitializingFirebase: false
        });
        // ⛔ កំណែ 2.22.5 ៖ `reloadForFirebaseSdk()` ចូលប្រើ storage តាម shim
        // `appSessionStore` ជំនួស `sessionStorage` ដោយផ្ទាល់ (getter បោះពេល
        // browser បិទ site data) ➜ sandbox ត្រូវផ្តល់ alias នោះ។
        ctx.appSessionStore = ctx.sessionStorage;
        ctx.appLocalStore = ctx.localStorage || null;
        // ⛔ ZoeW (React) តែប៉ុណ្ណោះ ៖ ZoeKeyGen នៅជា vanilla (គ្មានឃ្លាំង)
        if (/\bfunction createStore\(/.test(appSrc)) vm.runInContext(reactRuntime(appSrc, { context: ctx }), ctx);
        new vm.Script([
            konst('FIREBASE_SDK_RETRY_STEPS_MS'),
            konst('FIREBASE_SDK_RETRY_MIN_GAP_MS') || '',
            'let firebaseSdkRetryTimer = null;', 'let firebaseSdkRetryAttempt = 0;',
            /lastFirebaseSdkAttemptAt/.test(appSrc) ? 'let lastFirebaseSdkAttemptAt = 0;' : '',
            konst('FIREBASE_SDK_RELOAD_KEY') || '',
            konst('FIREBASE_SDK_RELOAD_MAX') || '',
            konst('FIREBASE_SDK_RELOAD_MIN_GAP_MS') || '',
            /lastFirebaseSdkReloadAt/.test(appSrc) ? 'let lastFirebaseSdkReloadAt = 0;' : '',
            pick('safeStoreSet') || '', pick('safeStoreRemove') || '', pick('safeStoreGet') || '',
            pick('anyModalIsOpen') || '', pick('firebaseSdkReloadCount') || '',
            pick('reloadForFirebaseSdk') || '', pick('recoverFirebaseSdk') || '',
            // ពិដានល្បឿនឥឡូវឆ្លងកាត់ `elapsedSince()` (2.20.7) — ត្រូវផ្ទុក helper ពិត
            pick('elapsedSince') || 'function elapsedSince(mark) { return Date.now() - mark; }',
            pick('clearFirebaseSdkRetry'), pick('resetFirebaseSdkRetryHealth') || '',
            pick('scheduleFirebaseSdkRetry'), pick('retryFirebaseSdkNow'),
            'globalThis.api = { retryFirebaseSdkNow, scheduleFirebaseSdkRetry, resetFirebaseSdkRetryHealth };'
        ].filter(Boolean).join('\n\n')).runInContext(ctx);
        return {
            calls, ctx, reloads,
            advance(ms) {
                const end = clock + ms;
                for (;;) {
                    const due = timers.filter((t) => !t.dead && t.at <= end).sort((a, b) => a.at - b.at)[0];
                    if (!due) break;
                    clock = due.at; due.dead = true; due.fn();
                }
                clock = end;
            }
        };
    }

    // ចំនួន «ការព្យាយាមស្តារ» = initFirebase() + ការផ្ទុកទំព័រឡើងវិញ។ ចាប់ពី
    // ជុំ deep audit នេះ ផ្លូវស្តារពិតគឺការផ្ទុកទំព័រឡើងវិញ (មើលផ្នែក ១០ខ៣)
    // ដូច្នេះការរាប់តែ `initFirebase()` នឹងរាយការណ៍ខុស។
    const tries = (b) => b.calls.length + b.reloads.length;

    // ព្រឹត្តិការណ៍ `online` ១០ ដងក្នុង ១ វិនាទី
    const b1 = buildSdkRetry(SRC);
    for (let i = 0; i < 10; i++) { b1.advance(100); b1.ctx.api.retryFirebaseSdkNow(); }
    ok('online បាញ់ ១០ ដងក្នុង ១ វិ. ➜ យ៉ាងច្រើន ១ ការផ្ទុក SDK ឡើងវិញ (មុនកែ ១០)',
        tries(b1) <= 1, tries(b1));

    // ការព្យាយាមលើកដំបូងមិនត្រូវទប់ — «បណ្តាញត្រឡប់មក ➜ ព្យាយាមភ្លាម»
    const b2 = buildSdkRetry(SRC);
    b2.ctx.api.retryFirebaseSdkNow();
    ok('បណ្តាញត្រឡប់មក ➜ ព្យាយាមភ្លាម (ពិដានមិនទប់ការព្យាយាមលើកដំបូង)',
        tries(b2) === 1, tries(b2));

    // ការប្តូរ App រាល់ ១០ វិនាទី **មិនត្រូវ** ត្រូវទប់ (១០ វិ. > ពិដាន ៣ វិ.)
    const b3 = buildSdkRetry(SRC);
    for (let i = 0; i < 6; i++) { b3.advance(10000); b3.ctx.api.retryFirebaseSdkNow(); }
    ok('ការប្តូរ App រាល់ ១០ វិ. នៅតែព្យាយាមបានគ្រប់ដង (ពិដានមិនតឹងពេក)',
        tries(b3) === 6, tries(b3));

    // គ្មានបណ្តាញ ➜ មិនព្យាយាម
    const b4 = buildSdkRetry(SRC);
    b4.ctx.navigator.onLine = false;
    b4.ctx.api.retryFirebaseSdkNow();
    ok('គ្មានបណ្តាញ ➜ មិនផ្ទុក SDK ឡើងវិញ', tries(b4) === 0, tries(b4));

    // ── ១០ខ៣. ការស្តារ SDK ត្រូវ **ស្តារបានពិត** ────────────────────────
    // 🔴 ចន្លោះដែលរស់រានពីជុំ 2.18.0៖ ជណ្តើរ 5/10/20/30/60 វិ. ហៅ
    // `initFirebase()` ➜ `waitForFirebaseSDK()` ➜ រង់ចាំព្រឹត្តិការណ៍
    // `firebasesdkready` ដែល **មិនអាចមកដល់បានទៀតទេ**។ វាស់ក្នុង Chromium ពិត
    // (មើល sw-cache-failure-test.js សម្រាប់ទម្រង់ដដែល)៖ ពេល static import
    // របស់ module ធ្លាក់ម្តង នោះ **module map របស់ browser cache ការបរាជ័យនោះ
    // ពេញអាយុទំព័រ** — ការ import URL ដដែលឡើងវិញ ធ្លាក់ភ្លាមដោយមិនចេញបណ្តាញ
    // ហើយសូម្បីតែការបន្ថែម query ទៅ URL កម្រិតលើ ក៏មិនជួយដែរ ព្រោះ
    // dependency ខាងក្នុងនៅជា URL ដដែល។ មានតែ **ការផ្ទុកទំព័រឡើងវិញ**
    // (ឬ graph ថ្មីទាំងស្រុង) ទេដែលស្តារបាន។
    //
    // ដូច្នេះមុនកែ ជណ្តើរនោះ **គ្មានប្រសិទ្ធភាពទាំងស្រុង**៖ រាល់ជុំចំណាយ timer
    // ១៥ វិ. រួចធ្លាក់ដដែល ខណៈអ្នកប្រើឃើញ «ក្រៅបណ្ដាញ» លើបណ្តាញដែលដើរធម្មតា។
    {
        const r1 = buildSdkRetry(SRC);
        r1.ctx.api.retryFirebaseSdkNow();
        ok('SDK ផ្ទុកមិនចូល ➜ ការស្តារជាការផ្ទុកទំព័រឡើងវិញ មិនមែន initFirebase() ដែលមិនអាចជោគជ័យ',
            r1.reloads.length === 1 && r1.calls.length === 0,
            'reload=' + r1.reloads.length + ' initFirebase=' + r1.calls.length);

        // ⛔ ការផ្ទុកឡើងវិញត្រូវមានពិដាន — បើអត់ បណ្តាញដែលទប់ gstatic ជាប់
        // នឹងធ្វើឲ្យ App ផ្ទុកឡើងវិញជារង្វិលជុំមិនចេះចប់។
        const r2 = buildSdkRetry(SRC);
        for (let i = 0; i < 12; i++) { r2.advance(30000); r2.ctx.api.retryFirebaseSdkNow(); }
        ok('⛔ ការផ្ទុកទំព័រឡើងវិញមានពិដានក្នុងមួយវគ្គ (គ្មានរង្វិលជុំផ្ទុកមិនចេះចប់)',
            r2.reloads.length <= 3, r2.reloads.length);
        ok('ក្រោយអស់ពិដាន ការស្តារត្រឡប់ទៅជណ្តើរចាស់ជំនួស ការឈប់ស្ងាត់',
            r2.calls.length > 0, r2.calls.length);

        // ⛔ កុំបំផ្លាញអ្វីដែលអ្នកប្រើកំពុងវាយ (PIN · Config)
        const r3 = buildSdkRetry(SRC);
        r3.ctx.__openModal = 'configModal';
        r3.ctx.api.retryFirebaseSdkNow();
        ok('⛔ មានប្រអប់បើកនៅ ➜ មិនផ្ទុកទំព័រឡើងវិញ (កុំលុបអ្វីដែលអ្នកប្រើកំពុងវាយ)',
            r3.reloads.length === 0, r3.reloads.length);

        // SDK មកដល់យឺត (>15 វិ.) ➜ `window.firebaseSDK` មានហើយ ➜ initFirebase()
        // ធ្វើការបានពិត ➜ **មិនត្រូវផ្ទុកទំព័រឡើងវិញ**។
        const r4 = buildSdkRetry(SRC);
        r4.ctx.window.firebaseSDK = { ref: () => {} };
        r4.ctx.api.retryFirebaseSdkNow();
        ok('SDK មកដល់យឺត ➜ ប្រើវាភ្លាម មិនផ្ទុកទំព័រឡើងវិញ',
            r4.reloads.length === 0 && r4.calls.length === 1,
            'reload=' + r4.reloads.length + ' initFirebase=' + r4.calls.length);

        // ⛔ timer ជណ្តើរដែលនៅសល់ មិនត្រូវរុះរើ SDK ដែលកំពុងដំណើរការឡើងវិញ។
        // ការប្រណាំង៖ SDK មកដល់នៅវិនាទីទី ១៩ ➜ `armLateFirebaseSdkListener()`
        // ហៅ `initFirebase()` ➜ ជោគជ័យ។ ប៉ុន្តែ timer ជណ្តើរនៅតែបាញ់នៅ
        // វិនាទីទី ២០ ➜ មុនកែវាហៅ `initFirebase()` ម្តងទៀត ➜ `deleteApp()` +
        // ភ្ជាប់ listener ឡើងវិញ **ខណៈ App កំពុងដំណើរការធម្មតា**។
        const r6 = buildSdkRetry(SRC);
        r6.ctx.api.scheduleFirebaseSdkRetry();
        r6.ctx.firebaseSdkUnavailable = false;
        r6.ctx.window.firebaseSDK = { ref: () => {} };
        r6.advance(60000);
        ok('⛔ SDK ដំណើរការវិញ ➜ timer ជណ្តើរដែលនៅសល់ មិនរុះរើវាឡើងវិញ',
            r6.calls.length === 0 && r6.reloads.length === 0,
            'initFirebase=' + r6.calls.length + ' reload=' + r6.reloads.length);

        // ការភ្ជាប់ជោគជ័យត្រូវសងពិដានមកវិញ
        const r5 = buildSdkRetry(SRC);
        r5.ctx.api.retryFirebaseSdkNow();
        r5.ctx.api.resetFirebaseSdkRetryHealth();
        r5.advance(60000);
        r5.ctx.api.retryFirebaseSdkNow();
        ok('ភ្ជាប់ជោគជ័យ ➜ ពិដានផ្ទុកឡើងវិញត្រូវសងមកវិញសម្រាប់ការដាច់លើកក្រោយ',
            r5.reloads.length === 2, r5.reloads.length);
    }

    // ── ១០ខ៤. ព្រឹត្តិការណ៍ដែលដាស់ការស្តារ SDK ត្រូវដូចគ្នាទាំង ២ App ────
    // 🔴 ចន្លោះពិត៖ ZoeW ហៅ `retryFirebaseSdkNow()` ពី **ទាំង** `online`
    // និង `visibilitychange` ចំណែក ZoeKeyGen ហៅតែពី `online` ប៉ុណ្ណោះ។
    // `shared-fns.js` មើលមិនឃើញ ព្រោះ handler ទាំងនោះមិនមែនជា
    // FunctionDeclaration ដែលមានឈ្មោះដូចគ្នាទេ — ZoeW ដាក់វាក្នុង
    // `setupConnectionRecovery()` (ដែលនៅក្នុង EXPECTED_DIVERGENT) ចំណែក
    // ZoeKeyGen ដាក់វាត្រង់ៗក្នុង `DOMContentLoaded`។ ដូច្នេះត្រូវអះអាង
    // **ព្រឹត្តិការណ៍** ដោយផ្ទាល់ មិនមែនអះអាង function។
    {
        const KG2 = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen', 'app.js'), 'utf8');
        [['ZoeW', SRC], ['ZoeKeyGen', KG2]].forEach(([name, src]) => {
            ok(name + ' ៖ `online` ដាស់ការស្តារ SDK',
                /addEventListener\('online'[\s\S]{0,400}?retryFirebaseSdkNow\(\)/.test(src));
            ok(name + ' ៖ ត្រឡប់មក foreground ក៏ដាស់ការស្តារ SDK ដែរ', visibilityCalls(src, 'retryFirebaseSdkNow'));
            ok(name + ' ៖ SDK ដែលមកដល់យឺត ត្រូវមានអ្នកទទួល (មិនរង់ចាំជណ្តើរ ១៥ វិ.)',
                /function armLateFirebaseSdkListener\(/.test(src) &&
                /firebaseSdkUnavailable = true;\s*\n\s*armLateFirebaseSdkListener\(\);/.test(src));
        });
    }

    ok('ពិដាន SDK តូចជាងជំហានដំបូងនៃជណ្តើរ (បើអត់ ជណ្តើរត្រូវលេបដោយពិដាន)',
        /FIREBASE_SDK_RETRY_MIN_GAP_MS/.test(SRC) &&
        Number((/const FIREBASE_SDK_RETRY_MIN_GAP_MS = (\d+);/.exec(SRC) || [])[1]) <
        Number((/const FIREBASE_SDK_RETRY_STEPS_MS = \[(\d+)/.exec(SRC) || [])[1]));

    ok('⛔ ការ reset ជណ្តើរ មិនត្រូវ reset ពិដានល្បឿន (បើ reset ➜ ពិដានស្លាប់)',
        !/function clearFirebaseSdkRetry\(\)[\s\S]{0,220}lastFirebaseSdkAttemptAt = 0/.test(SRC));

    // ⚠️ មេរៀន 2.12.1៖ ថ្នាក់កំហុសដដែលរស់នៅ App ផ្សេង។ ZoeKeyGen មានផ្លូវ
    // `retryFirebaseSdkNow()` ដដែលបេះបិទ ➜ checker ត្រូវស្កេនវាដែរ។
    const KG = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen', 'app.js'), 'utf8');
    const kgBurst = buildSdkRetry(KG);
    for (let i = 0; i < 10; i++) { kgBurst.advance(100); kgBurst.ctx.api.retryFirebaseSdkNow(); }
    ok('ZoeKeyGen ៖ online បាញ់ ១០ ដងក្នុង ១ វិ. ➜ យ៉ាងច្រើន ១ ការផ្ទុក SDK ឡើងវិញ',
        tries(kgBurst) <= 1, tries(kgBurst));
    const kgFirst = buildSdkRetry(KG);
    kgFirst.ctx.api.retryFirebaseSdkNow();
    ok('ZoeKeyGen ៖ ការព្យាយាមលើកដំបូងមិនត្រូវទប់',
        tries(kgFirst) === 1, tries(kgFirst));
    ok('ZoeKeyGen ៖ ការស្តារ SDK ក៏ជាការផ្ទុកទំព័រឡើងវិញដែរ (ថ្នាក់ដដែល App ផ្សេង)',
        kgFirst.reloads.length === 1, kgFirst.reloads.length);
    ok('ZoeKeyGen ៖ ការ reset ជណ្តើរ មិនត្រូវ reset ពិដានល្បឿន',
        !/function clearFirebaseSdkRetry\(\)[\s\S]{0,220}lastFirebaseSdkAttemptAt = 0/.test(KG));
}

// ── ១០គ. ស្ថានភាព «កំពុងភ្ជាប់» — កុំកុហកអ្នកប្រើថាក្រៅបណ្តាញ ────────
// ថ្នាក់កំហុស៖ **បង្ហាញស្ថានភាពខុស។** មុនកែ ស្ថានភាពមានតែ ២៖ ភ្ជាប់រួច ឬ
// «ក្រៅបណ្ដាញ»។ ព្រោះ `.info/connected` បាញ់ `false` ភ្លាមៗពេល boot ហើយ
// handshake របស់ RTDB ត្រូវការពេលខ្លះជាច្រើនវិនាទីលើ 2G/3G នោះ **រាល់ការ
// បើក App** និង **រាល់ការភ្ជាប់ឡើងវិញ** បង្ហាញចំណុចក្រហម «ក្រៅបណ្ដាញ»
// ខណៈឧបករណ៍មានបណ្តាញ ហើយ App កំពុងភ្ជាប់ធម្មតា។ អ្នកប្រើឃើញសារភ័យ
// ដោយឥតហេតុផល ហើយអាចឈប់ស្កេនទាំងដែលមិនចាំបាច់។
//
// ស្ថានភាពត្រឹមត្រូវមាន ៤៖
//   ភ្ជាប់រួច · កំពុងភ្ជាប់ (handshake ថ្មី) · កំពុងភ្ជាប់ឡើងវិញ (listener ធ្លាក់) · ក្រៅបណ្ដាញ
{
    const t = buildContext();
    // boot ៖ បណ្តាញមាន តែ handshake មិនទាន់ចប់
    t.ctx.isDatabaseConnected = false;
    t.api.renderConnectionStatus();
    ok('boot ដែល handshake មិនទាន់ចប់ ➜ «កំពុងភ្ជាប់» មិនមែន «ក្រៅបណ្ដាញ»',
        t.statusText.innerText.indexOf('កំពុងភ្ជាប់') !== -1 &&
        t.statusText.innerText.indexOf('ក្រៅបណ្ដាញ') === -1, t.statusText.innerText);
    ok('ចំណុចស្ថានភាពមាន class connecting', t.statusDot.classes.connecting === true, t.statusDot.classes);

    // គ្មានបណ្តាញពិត ➜ ត្រូវនិយាយថាក្រៅបណ្ដាញ
    t.ctx.navigator.onLine = false;
    t.api.renderConnectionStatus();
    ok('គ្មានបណ្តាញពិត ➜ «ក្រៅបណ្ដាញ»',
        t.statusText.innerText.indexOf('ក្រៅបណ្ដាញ') !== -1, t.statusText.innerText);
    ok('ចំណុចលែងជា connecting ពេលក្រៅបណ្តាញ', !t.statusDot.classes.connecting, t.statusDot.classes);

    // ព្យាយាមច្រើនដងហើយនៅតែមិនបាន ➜ ត្រូវទទួលស្គាល់ថាក្រៅបណ្ដាញ
    t.ctx.navigator.onLine = true;
    t.api.renderConnectionStatus();
    ok('នៅដើមដំបូងនៅតែ «កំពុងភ្ជាប់»', t.statusText.innerText.indexOf('កំពុងភ្ជាប់') !== -1, t.statusText.innerText);
    t.api.nudgeDatabaseConnection();
    t.advance(120000);
    ok('ព្យាយាមអស់ ២ នាទីនៅតែមិនបាន ➜ ទទួលស្គាល់ថា «ក្រៅបណ្ដាញ»',
        t.statusText.innerText.indexOf('ក្រៅបណ្ដាញ') !== -1, t.statusText.innerText);

    // ភ្ជាប់បាន ➜ ត្រឡប់ទៅស្ថានភាពធម្មតា ហើយ class ត្រូវសម្អាត
    t.ctx.isDatabaseConnected = true;
    t.api.clearReconnectWatchdog();
    t.api.renderConnectionStatus();
    ok('ភ្ជាប់បាន ➜ «ភ្ជាប់ Server រួចរាល់»', t.statusText.innerText.indexOf('រួចរាល់') !== -1, t.statusText.innerText);
    ok('class connecting ត្រូវដកចេញ', !t.statusDot.classes.connecting, t.statusDot.classes);

    // listener ធ្លាក់ ➜ សារ «កំពុងភ្ជាប់ឡើងវិញ» នៅដដែល (មិនត្រូវច្រឡំនឹង «កំពុងភ្ជាប់»)
    const t2 = buildContext();
    t2.api.initDatabaseListeners();
    t2.listenerCallbacks.history.errCb(new Error('permission_denied'));
    t2.api.renderConnectionStatus();
    ok('listener ធ្លាក់ ➜ «កំពុងភ្ជាប់ឡើងវិញ»',
        t2.statusText.innerText.indexOf('ភ្ជាប់ឡើងវិញ') !== -1, t2.statusText.innerText);
}

// ── ១១. ZoeKeyGen ក៏ត្រូវមានយន្តការភ្ជាប់ឡើងវិញដដែល ─────────────────
{
    const kg = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen', 'app.js'), 'utf8');
    ok('ZoeKeyGen មាន forceDatabaseReconnect', /function forceDatabaseReconnect\(/.test(kg));
    ok('ZoeKeyGen មាន watchdog ភ្ជាប់ឡើងវិញ', /function scheduleReconnectWatchdog\(/.test(kg));
    ok('ZoeKeyGen មាន setupConnectionRecovery', /function setupConnectionRecovery\(/.test(kg));
    ok('ZoeKeyGen ហៅ setupConnectionRecovery ពេល boot', /\n\s*setupConnectionRecovery\(\);/.test(kg));
    ok('ZoeKeyGen រាប់បញ្ចូល navigator.onLine ក្នុងស្ថានភាពការតភ្ជាប់',
        /function connectionLooksOnline\(\)[\s\S]{0,160}navigator\.onLine !== false/.test(kg));
    ok('ZoeKeyGen មានកន្លែងសរសេរស្ថានភាព UI តែមួយ',
        (kg.match(/firebaseStatusText'\)/g) || []).length === 1,
        (kg.match(/firebaseStatusText'\)/g) || []).length);
    ok('ZoeKeyGen ដាស់ការតភ្ជាប់ពេលត្រឡប់មក foreground',
        /visibilitychange[\s\S]{0,220}nudgeDatabaseConnection\(\)/.test(kg));
}

// ── ១៣. ការត្រឡប់មក foreground ត្រូវដាស់ **listener** ដែលធ្លាក់ ផងដែរ ────
// 🔴 ចន្លោះពិត (វាស់បានដោយ mutation ក្នុងជុំ 2.20.3)៖ ការដក
// `retryFailedDbListenersNow()` ចេញពី handler `visibilitychange` របស់ ZoeW
// **ឆ្លងកាត់ checker ទាំង ៩៩ ដោយបៃតងទាំងអស់**។ ការអះអាងដែលមានស្រាប់
// ពិនិត្យតែ `retryFirebaseSdkNow()` និង `nudgeDatabaseConnection()` ប៉ុណ្ណោះ។
//
// ⛔ ហេតុអ្វីវាសំខាន់៖ លើទូរស័ព្ទ បណ្តាញដែលត្រឡប់មកវិញ **ជាញឹកញាប់មិនបាញ់
// `online`** សោះ (`navigator.onLine` នៅ `true` ពេញការដាច់) ➜ ការដោះសោ
// អេក្រង់ជា **សញ្ញាស្តារដ៏សំខាន់បំផុត**។ បើ handler នោះមិនហៅ
// `retryFailedDbListenersNow()` ទេ នោះតារាងជាប់ «កំពុងភ្ជាប់ឡើងវិញ...»
// រហូតដល់ជំហានជណ្តើរបន្ទាប់ (យ៉ាងយូរ ៣០ វិ.)។ នេះជាសេណារីយ៉ូផ្ទៀងផ្ទាត់
// ទី ១ របស់កំណែ 2.20.1 ក្នុង CLAUDE.md ដោយផ្ទាល់។
{
    ok('⛔ ZoeW ៖ `visibilitychange` ដាស់ **listener** ដែលធ្លាក់ (មិនត្រឹមតែ SDK)',
        visibilityCalls(SRC, 'retryFailedDbListenersNow'),
        'handler `visibilitychange` មិនហៅ retryFailedDbListenersNow() ➜ ការដោះសោទូរស័ព្ទ '
        + 'ខណៈ WiFi ត្រឡប់មកវិញ មិនស្តារតារាងទេ');
    ok('⛔ ZoeW ៖ `online` ក៏ដាស់ listener ដែលធ្លាក់ដែរ',
        /addEventListener\('online'[\s\S]{0,400}?retryFailedDbListenersNow\(\)/.test(SRC));
    ok('សញ្ញាស្តារទាំង ២ ត្រូវមានគ្រប់ (online **និង** visibilitychange)',
        (SRC.match(/retryFailedDbListenersNow\(\);/g) || []).length >= 3,
        'រំពឹងយ៉ាងតិច ៣ កន្លែងហៅ ៖ .info/connected + online + visibilitychange');
}

// ── ១៤. ភស្តុតាងវឌ្ឍនភាពត្រូវ reset ពេល attach ជុំថ្មី ────────────────
// ⛔ CLAUDE.md ចែងច្បាស់៖ «`dbListenerProgressAt` ត្រូវ reset ជា `0` ក្នុង
// `initDatabaseListeners()` (វឌ្ឍនភាពរបស់ជុំមុន មិនមែនភស្តុតាងអំពីជុំថ្មី)»។
// ជុំ 2.20.3 វាស់ឃើញថាការដកបន្ទាត់នោះចេញ **ឆ្លងកាត់ checker ទាំង ៩៩** —
// ច្បាប់នោះរស់នៅតែក្នុងឯកសារ គ្មានឧបករណ៍ចាក់សោទេ។
//
// ផលបើភ្លេច៖ ត្រាពេលវេលារបស់ជុំមុនធ្វើឲ្យ `dbListenerResyncIsProgressing()`
// ត្រឡប់ `true` រហូតដល់ ២០ វិនាទី **ខណៈជុំថ្មីមិនទាន់ទទួលអ្វីសោះ** ➜
// ជណ្តើរស្តាររង់ចាំដោយផ្អែកលើភស្តុតាងក្លែងក្លាយ។
{
    const init = /function initDatabaseListeners\(\)[\s\S]*?if \(dbRefExchangeRate\)/.exec(SRC);
    const initHead = init ? init[0] : '';
    ok('ស្រង់ក្បាល initDatabaseListeners() បាន', !!initHead);
    ok('⛔ `initDatabaseListeners()` reset `dbListenerProgressAt = 0`',
        /dbListenerProgressAt\s*=\s*0\s*;/.test(initHead),
        'ភស្តុតាងវឌ្ឍនភាពរបស់ជុំមុនរស់រានចូលជុំថ្មី ➜ ជណ្តើររង់ចាំដោយឥតហេតុផល');
    ok('⛔ `resetDbListenerHealthState()` ក៏ reset `dbListenerProgressAt` ដែរ',
        /function resetDbListenerHealthState\(\)[\s\S]*?dbListenerProgressAt\s*=\s*0\s*;/.test(SRC));
    ok('`dbListenerProgressAt` ត្រូវសរសេរនៅ **កន្លែងដែលវឌ្ឍនភាពកើតឡើង** (noteDbListenerAlive)',
        /function noteDbListenerAlive\([\s\S]*?dbListenerProgressAt = Date\.now\(\);/.test(SRC));
}

// ── ១៥. Config ថ្មីដែលមកដល់ **កណ្តាលការផ្ទុក SDK** មិនត្រូវបាត់ ────────
// ⛔ `initFirebase()` អាន `zoew_firebase_config` **មុន** `await
// waitForFirebaseSDK()` (ពិដាន ១៥ វិ.) ហើយច្រានការហៅដដែលៗចេញដោយ
// `if (isInitializingFirebase) return false;`។ ដូច្នេះការ Reconfig ខណៈ SDK
// កំពុងមកយឺត ៖
//   • `saveFirebaseConfig()` សរសេរ config ថ្មីចូល localStorage
//   • វាហៅ `initFirebase()` ➜ **ត្រឡប់ភ្លាមដោយមិនធ្វើអ្វី**
//   • ការហៅដែលកំពុងដំណើរការបញ្ចប់ដោយប្រើ config **ចាស់** ដែលវាចាប់ទុកមុន await
//   ➜ អ្នកប្រើឃើញ «✅ ភ្ជាប់ Server រួចរាល់!» ខណៈ App នៅភ្ជាប់ទៅ Project ចាស់
//     រហូតដល់ Refresh ដោយដៃ។
//
// ការអះអាងជា **២ ខាង** ៖ config ដែល **មិនប្រែ** មិនត្រូវបង្កជុំទី ២ ឡើយ
// (បើអត់ ការហៅឡើងវិញនោះនឹងក្លាយជារង្វិលជុំដែលស៊ីបណ្តាញ)។
{
    const initSrc = sliceFn('initFirebase');
    ok('ស្រង់ initFirebase() បាន', !!initSrc);

    function runInit(changeConfigMidFlight, withExistingApp) {
        const store = { zoew_firebase_config: JSON.stringify({ apiKey: 'A', databaseURL: 'https://old.example' }) };
        const log = { inits: [], toasts: [] };
        let releaseSdk = null;
        const ctx = {
            console, Promise, JSON, Object, Array, Error, Set, Map, Date,
            setTimeout, clearTimeout, isNaN, String, Number,
            navigator: { onLine: true },
            localStorage: {
                getItem: (k) => (k in store ? store[k] : null),
                setItem: (k, v) => { store[k] = v; },
                removeItem: (k) => { delete store[k]; }
            },
            document: { getElementById: () => null, querySelectorAll: () => [] },
            __log: log,
            __store: store,
            __releaseSdk: (fn) => { releaseSdk = fn; },
            __existingApp: !!withExistingApp
        };
        ctx.window = ctx;
        vm.createContext(ctx);
        vm.runInContext('if (typeof appLocalStore === \'undefined\') globalThis.appLocalStore = (typeof localStorage !== \'undefined\' ? localStorage : null); if (typeof appSessionStore === \'undefined\') globalThis.appSessionStore = (typeof sessionStorage !== \'undefined\' ? sessionStorage : null); if (typeof safeStoreGet !== \'function\') globalThis.safeStoreGet = function (s, k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } }; if (typeof safeStoreSet !== \'function\') globalThis.safeStoreSet = function (s, k, v) { try { return s ? (s.setItem(k, String(v)), true) : false; } catch (e) { return false; } }; if (typeof safeStoreRemove !== \'function\') globalThis.safeStoreRemove = function (s, k) { try { return s ? (s.removeItem(k), true) : false; } catch (e) { return false; } };', ctx);
        if (ctx.appLocalStore === undefined) ctx.appLocalStore = ctx.localStorage || null;
        if (ctx.appSessionStore === undefined) ctx.appSessionStore = ctx.sessionStorage || null;
        vm.runInContext([
            'let firebaseConfig = null, fb = null, auth = null, db = null;',
            'let dbRefHistory = null, dbRefDeleted = null, dbRefDailyRevenue = null, dbRefMonthlyRevenue = null;',
            'let dbRefDailyPickup = null, dbRefDailyCollected = null, dbRefExchangeRate = null, dbRefConnected = null, dbRefServerTimeOffset = null;',
            'let isDatabaseInitialized = false, isDatabaseConnected = false, isInitializingFirebase = false;',
            'let hasEverConnectedToDatabase = false, networkJustReturned = false;',
            'let authGeneration = 0, historyPatchFlushInFlight = true;',
            'const pendingHistoryPatches = new Map([["OLD_BUSINESS_BARCODE", { fields: { isCalled: true } }]]);',
            'let firebaseSdkUnavailable = false, sdkUnavailableNoticeShown = false;',
            'let scanHistory = [], deletedItems = [], dailyRevenueData = {}, monthlyRevenueData = {};',
            'let dailyPickupData = {}, lockerBarcodeIndex = {};',
            'let dailyCollectedData = { "2026-09-12": { OLD_BUSINESS_BARCODE: { c: 9, d: 2 } } };',
            'const FAKE_SDK = { getApps: () => __existingApp ? [{}] : [], initializeApp: (c) => ({ cfg: c }), deleteApp: () => { __log.retryAtDelete = __retryState(); __existingApp = false; return Promise.resolve(); },',
            '  getAuth: () => ({}), getDatabase: () => ({}), goOnline() {}, goOffline() {}, off() {}, ref: () => ({}),',
            '  onAuthStateChanged: (a, callback) => { __log.authCallback = callback; return () => {}; } };',
            'let __sdkGate = null;',
            'function waitForFirebaseSDK() { return new Promise((res) => { __sdkGate = () => res(FAKE_SDK); __releaseSdk(__sdkGate); }); }',
            'function preconnectToDatabaseHost() {}',
            'function resetFirebaseSdkRetryHealth() {}',
            'function resetDbListenerHealthState() {}',
            'function renderConnectionStatus() {}',
            'function attachInfoListeners() { return true; }',
            'function detachDatabaseListeners() { __log.detachedData = (__log.detachedData || 0) + 1; }',
            'function detachInfoListeners() {}',
            'function setupAuthListener() {}',
            'function armLateFirebaseSdkListener() {}',
            'function scheduleFirebaseSdkRetry() {}',
            'function checkPinAndOpenConfig() {}',
            'function showToast(m) { __log.toasts.push(m); }',
            sliceFn('withTransactionOutcomeResolution') || 'function withTransactionOutcomeResolution(sdk) { return sdk; }',
            initSrc.replace('firebaseConfig = JSON.parse(savedConfig);',
                'firebaseConfig = JSON.parse(savedConfig); __log.inits.push(firebaseConfig.databaseURL);'),
            'globalThis.__start = () => initFirebase();',
            'globalThis.__collected = () => dailyCollectedData;',
            'globalThis.__retryState = () => ({ generation: authGeneration, queued: pendingHistoryPatches.size, busy: historyPatchFlushInFlight });'
        ].join('\n'), ctx);

        ctx.__start();
        if (changeConfigMidFlight) {
            store.zoew_firebase_config = JSON.stringify({ apiKey: 'B', databaseURL: 'https://new.example' });
        }
        if (releaseSdk) releaseSdk();
        return { log, ctx, release: () => { if (releaseSdk) releaseSdk(); } };
    }

    (async () => {
        const changed = runInit(true);
        for (let i = 0; i < 8; i++) { await Promise.resolve(); changed.release(); }
        ok('⛔ Config ថ្មីដែលរក្សាទុកកណ្តាលការផ្ទុក SDK ➜ ត្រូវយកមកប្រើ មិនត្រូវបាត់',
            changed.log.inits.indexOf('https://new.example') !== -1, changed.log.inits);

        const same = runInit(false);
        for (let i = 0; i < 8; i++) { await Promise.resolve(); same.release(); }
        ok('⛔ ទិសផ្ទុយ ៖ config មិនប្រែ ➜ មិនត្រូវ init ឡើងវិញ (គ្មានរង្វិលជុំ)',
            same.log.inits.length === 1, same.log.inits);

        // ── ១៥ខ. ⛔ ច្បាប់ដដែលអនុវត្តលើ **ZoeKeyGen** ដែរ ─────────────────
        // `saveFirebaseConfig()` របស់ App ទាំង ២ សរសេរ `zoew_firebase_config`
        // រួចហៅ `initFirebase()` **បេះបិទ** ➜ ដូច្នេះការ Reconfig កណ្តាល
        // ការផ្ទុក SDK ជាលំដាប់ដែលមានក្នុង App ទាំង ២។ មុនជុំនេះ ផ្នែក ១៥
        // ស្រង់តែ `SRC` (ZoeW) ➜ ZoeKeyGen គ្មានអ្នកយាមសោះ ហើយវា **ធ្លាក់ពិត**៖
        // config ថ្មីត្រូវបោះចោលស្ងាត់ៗ ➜ ឧបករណ៍អ្នកលក់នៅសរសេរ Activation Key
        // ចូល **License Project ចាស់** ខណៈអ្នកប្រើឃើញ «រក្សាទុករួចរាល់»។
        // ⛔ បញ្ជីមិនរឹង ៖ តួ `initFirebase` ស្រង់ចេញពី app.js **ពិត** របស់
        // App នីមួយៗ ➜ ការប្តូរឈ្មោះ ឬការដកការពារចេញ ធ្វើឲ្យវាធ្លាក់។
        {
            const KGINIT = fs.readFileSync(path.join(appRoot, 'ZoeKeyGen', 'app.js'), 'utf8');
            const kgInitSrc = sliceFnFrom(KGINIT, 'initFirebase');
            ok('ស្រង់ initFirebase() របស់ ZoeKeyGen បាន', !!kgInitSrc);

            function runKeygenInit(changeConfigMidFlight) {
                const store = { zoew_firebase_config: JSON.stringify({ apiKey: 'A', databaseURL: 'https://old.example' }) };
                const log = { inits: [] };
                let releaseSdk = null;
                const ctx = {
                    console, Promise, JSON, Object, Array, Error, Set, Map, Date,
                    setTimeout, clearTimeout, isNaN, String, Number,
                    navigator: { onLine: true },
                    localStorage: {
                        getItem: (k) => (k in store ? store[k] : null),
                        setItem: (k, v) => { store[k] = v; },
                        removeItem: (k) => { delete store[k]; }
                    },
                    document: { getElementById: () => null, querySelectorAll: () => [] },
                    __log: log,
                    __releaseSdk: (fn) => { releaseSdk = fn; }
                };
                ctx.window = ctx;
                vm.createContext(ctx);
                vm.runInContext([
                    'const appLocalStore = localStorage;',
                    'function safeStoreGet(s, k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } }',
                    'let firebaseConfig = null, fb = null, auth = null, db = null;',
                    'let dbRefConnected = null, dbRefServerTimeOffset = null;',
                    'let isDatabaseConnected = false, isInitializingFirebase = false;',
                    'let hasEverConnectedToDatabase = false, networkJustReturned = false;',
                    'let serverTimeSynced = false, serverTimeOffsetMs = 0;',
                    'let firebaseSdkUnavailable = false, sdkUnavailableNoticeShown = false;',
                    'const FAKE_SDK = { getApps: () => [], initializeApp: (c) => ({ cfg: c }), deleteApp: () => Promise.resolve(),',
                    '  getAuth: () => ({}), getDatabase: () => ({}), goOnline() {}, goOffline() {}, off() {}, ref: () => ({}),',
                    '  onAuthStateChanged: (a, cb) => (() => {}) };',
                    'function waitForFirebaseSDK() { return new Promise((res) => { __releaseSdk(() => res(FAKE_SDK)); }); }',
                    'function invalidateSensitiveSession() {}',
                    'function resetFirebaseSdkRetryHealth() {}',
                    'function detachInfoListeners() {}',
                    'function enforceSessionOnlyAuthPersistence() { return Promise.resolve(); }',
                    'function attachInfoListeners() { return true; }',
                    'function setupAuthListener() {}',
                    'function armLateFirebaseSdkListener() {}',
                    'function scheduleFirebaseSdkRetry() {}',
                    'function checkPinAndOpenConfig() {}',
                    'function renderConnectionStatus() {}',
                    'function showToast(m) {}',
                    (kgInitSrc || 'async function initFirebase() { return false; }')
                        .replace('firebaseConfig = JSON.parse(savedConfig);',
                            'firebaseConfig = JSON.parse(savedConfig); __log.inits.push(firebaseConfig.databaseURL);'),
                    'globalThis.__start = () => initFirebase();'
                ].join('\n'), ctx);
                ctx.__start();
                if (changeConfigMidFlight) {
                    store.zoew_firebase_config = JSON.stringify({ apiKey: 'B', databaseURL: 'https://new.example' });
                }
                // ការរត់ឡើងវិញដំឡើងច្រកថ្មី ➜ ត្រូវដោះម្តងទៀត
                const release = () => { if (releaseSdk) { const r = releaseSdk; releaseSdk = null; r(); } };
                release();
                return { log, release };
            }

            const kgChanged = runKeygenInit(true);
            for (let i = 0; i < 8; i++) { await Promise.resolve(); kgChanged.release(); }
            // ⛔ ជាន់អប្បបរមា ៖ បើជុំដំបូងមិនដែលរត់ សេណារីយ៉ូទទេ ➜ ការអះអាង
            // ខាងក្រោមនឹងបៃតងដោយចៃដន្យ។
            ok('⛔ ជាន់អប្បបរមា៖ ZoeKeyGen initFirebase ឈានដល់ការអាន config ពិត',
                kgChanged.log.inits.length >= 1, kgChanged.log.inits);
            ok('⛔ ZoeKeyGen ៖ Config ថ្មីដែលរក្សាទុកកណ្តាលការផ្ទុក SDK ➜ ត្រូវយកមកប្រើ មិនត្រូវបាត់',
                kgChanged.log.inits.indexOf('https://new.example') !== -1, kgChanged.log.inits);

            const kgSame = runKeygenInit(false);
            for (let i = 0; i < 8; i++) { await Promise.resolve(); kgSame.release(); }
            ok('⛔ ទិសផ្ទុយ ZoeKeyGen ៖ config មិនប្រែ ➜ មិនត្រូវ init ឡើងវិញ (គ្មានរង្វិលជុំ)',
                kgSame.log.inits.length === 1, kgSame.log.inits);
        }

        const reconfigured = runInit(false, true);
        for (let i = 0; i < 8; i++) { await Promise.resolve(); reconfigured.release(); }
        ok('Reconfig ៖ បានចូលផ្លូវដោះ Firebase App ចាស់ពិត', reconfigured.log.detachedData === 1 && !reconfigured.ctx.__existingApp);
        ok('Reconfig ៖ ចំណូលប្រចាំថ្ងៃរបស់អាជីវកម្មចាស់មិននៅសល់ក្នុងសតិពេលរង់ចាំ listener ថ្មី',
            Object.keys(reconfigured.ctx.__collected()).length === 0, reconfigured.ctx.__collected());
        ok('Reconfig ៖ បោះបង់បំណងកែចាស់ និងដោះជួររង់ចាំមុនលុប Firebase App ចាស់',
            reconfigured.log.retryAtDelete && reconfigured.log.retryAtDelete.queued === 0 && reconfigured.log.retryAtDelete.busy === false,
            reconfigured.log.retryAtDelete);
        ok('Reconfig ៖ callback ដែលចេញដំណើរមុន teardown ត្រូវផុតសុពលភាពមុនរង់ចាំ deleteApp',
            reconfigured.log.retryAtDelete && reconfigured.log.retryAtDelete.generation > 0, reconfigured.log.retryAtDelete);

        const signedOut = runInit(false);
        for (let i = 0; i < 8; i++) { await Promise.resolve(); signedOut.release(); }
        vm.runInContext([
            'let authUnsubscribe = null, authRecoveryTimeout = null, autoLoginAttempted = false;',
            'function attemptAuthStorageRecovery() {}',
            'function resetClearHistoryOperationState() {}',
            'function clearCustomerDataTableCache() {}',
            'function applyCurrentFilter() {}',
            'function renderRecentlyDeleted() {}',
            'function updateRecentPhonesList() {}',
            'function updateAuthButton(value) { __log.authButton = value; }',
            'function showLoginModalWithPrefill() {}',
            sliceFn('setupAuthListener') || 'function setupAuthListener() {}',
            'setupAuthListener();'
        ].join('\n'), signedOut.ctx);
        signedOut.log.authCallback(null);
        ok('ចាកចេញ ៖ បានដោះ listener និងប្តូរស្ថានភាព auth ពិត',
            signedOut.log.detachedData === 1 && signedOut.log.authButton === false);
        ok('ចាកចេញ ៖ ចំណូលប្រចាំថ្ងៃមិនអាចនៅក្នុងសតិឆ្លងទៅ session បន្ទាប់',
            Object.keys(signedOut.ctx.__collected()).length === 0, signedOut.ctx.__collected());

        // ── listener `.info/*` ដែលងាប់ **តែឯង** ─────────────────────────
        // ⛔ ថ្នាក់ដដែលនឹង 2.20.8 (បងប្អូនប្រកាសជាសះស្បើយជំនួស) — តែ
        // ច្បាប់នោះត្រូវអនុវត្តលើ listener ទិន្នន័យ **៦** ប៉ុណ្ណោះ; listener
        // `.info/*` **២** នៅតែបញ្ជូន `handleInfoListenerError` **ទទេ**
        // (គ្មានកូនសោ path) ➜ ការតាមដានក្លាយជា **ការការពារដែលងាប់**។
        //
        // លំដាប់ដែលវាស់បាន ៖ `.info/serverTimeOffset` ងាប់តែឯង ➜ ការស្តារ
        // តាំងម៉ោង ២ វិ.; តែ `.info/connected` បាញ់ក្នុងចន្លោះនោះ (តំណញ័រ)
        // ➜ `clearInfoListenerRecovery()` **លុបកាលវិភាគចោល** ➜ listener
        // ដែលងាប់ **មិនដែល attach ឡើងវិញពេញវគ្គ** ➜ `serverTimeOffsetMs`
        // កក ➜ `getServerNow()` រំកិលតាមនាឡិកាឧបករណ៍ស្ងាត់ៗ។
        {
            const t = buildContext();
            const cRef = { __path: 'info/connected' };
            const oRef = { __path: 'info/offset' };
            t.setInfoRefs(cRef, oRef);
            t.api.attachInfoListeners();
            ok('ភ្ជាប់ listener `.info/*` ទាំង ២',
                !!(t.listenerCallbacks['info/connected'] && t.listenerCallbacks['info/offset']));

            // handshake ធម្មតា
            t.listenerCallbacks['info/connected'].cb({ val: () => true });
            t.listenerCallbacks['info/offset'].cb({ val: () => 1234 });
            ok('handshake ➜ offset ត្រូវបានទទួល', t.infoProbe().serverTimeOffsetMs === 1234,
                t.infoProbe());

            // `.info/serverTimeOffset` ងាប់ **តែឯង**
            t.listenerCallbacks['info/offset'].errCb(new Error('permission_denied'), 'serverTimeOffset');
            ok('offset ងាប់ ➜ ទង់បរាជ័យត្រូវឡើង', t.infoProbe().infoListenersFailed === true);
            ok('offset ងាប់ ➜ ការស្តារត្រូវតាំងម៉ោង',
                t.infoProbe().infoListenerRecoveryTimer !== null, t.infoProbe());

            // ⛔ បងប្អូន (`.info/connected`) បាញ់ក្នុងចន្លោះ — មិនត្រូវប្រកាសជំនួស
            t.listenerCallbacks['info/connected'].cb({ val: () => true });
            ok('⛔ បងប្អូនបាញ់ ➜ ការស្តាររបស់ offset ដែលងាប់ **មិនត្រូវលុប**',
                t.infoProbe().infoListenerRecoveryTimer !== null,
                'កាលវិភាគត្រូវលុប ➜ listener ដែលងាប់មិនដែល attach ឡើងវិញពេញវគ្គ');
            ok('⛔ បងប្អូនបាញ់ ➜ ទង់បរាជ័យ **មិនត្រូវរលត់**',
                t.infoProbe().infoListenersFailed === true, t.infoProbe());

            // ការស្តារពិត ➜ ទង់ត្រូវរលត់ (ទិសផ្ទុយ)
            t.listenerCallbacks['info/offset'].cb({ val: () => 5678 });
            ok('⛔ ទិសផ្ទុយ ៖ offset ដឹងខ្លួនវិញ ➜ ទង់រលត់',
                t.infoProbe().infoListenersFailed === false, t.infoProbe());
            ok('⛔ ទិសផ្ទុយ ៖ offset ដឹងខ្លួនវិញ ➜ កាលវិភាគស្តារត្រូវលុប',
                t.infoProbe().infoListenerRecoveryTimer === null, t.infoProbe());
            ok('⛔ ទិសផ្ទុយ ៖ offset ថ្មីត្រូវទទួលយក',
                t.infoProbe().serverTimeOffsetMs === 5678, t.infoProbe());
        }

        // ការងាប់របស់ `.info/connected` ៖ ស្ថានភាពការតភ្ជាប់ត្រូវក្លាយជាមិនស្គាល់
        {
            const t = buildContext();
            t.setInfoRefs({ __path: 'info/connected' }, { __path: 'info/offset' });
            t.api.attachInfoListeners();
            t.listenerCallbacks['info/connected'].cb({ val: () => true });
            t.listenerCallbacks['info/offset'].cb({ val: () => 1 });
            t.listenerCallbacks['info/connected'].errCb(new Error('cancelled'), 'connected');
            ok('`.info/connected` ងាប់ ➜ លែងអះអាងថាភ្ជាប់',
                t.infoProbe().isDatabaseConnected === false, t.infoProbe());
        }

        // ⛔ ការងាប់របស់ offset **តែម្នាក់ឯង** មិនត្រូវកុហកថាដាច់បណ្តាញ
        {
            const t = buildContext();
            t.setInfoRefs({ __path: 'info/connected' }, { __path: 'info/offset' });
            t.api.attachInfoListeners();
            t.listenerCallbacks['info/connected'].cb({ val: () => true });
            t.listenerCallbacks['info/offset'].cb({ val: () => 1 });
            t.listenerCallbacks['info/offset'].errCb(new Error('cancelled'), 'serverTimeOffset');
            ok('⛔ offset ងាប់តែឯង ➜ **មិនត្រូវ** ប្រកាសថាដាច់បណ្តាញ',
                t.infoProbe().isDatabaseConnected === true,
                'ការភ្ជាប់ពិតនៅរស់ ➜ ការសរសេរ false បង្ហាញស្ថានភាពខុស និងកេះ watchdog ឥតប្រយោជន៍');
        }

        // ស្តាទិច ៖ error callback ត្រូវបញ្ជូន **កូនសោ path** ជានិច្ច (2.20.8)
        {
            const bare = /,\s*handleInfoListenerError\s*\)/.test(SRC);
            ok('⛔ `handleInfoListenerError` មិនត្រូវបញ្ជូនទទេជា error callback',
                !bare, 'គ្មានកូនសោ path ➜ ការតាមដានក្លាយជាការការពារដែលងាប់ (ច្បាប់ 2.20.8)');
        }

        console.log('\nសរុប: ' + pass + ' ok, ' + fail + ' FAIL');
        process.exit(fail ? 1 : 0);
    })();
}
