const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appRoot = process.env.CONNRECOVERY_APP_DIR ? path.resolve(process.env.CONNRECOVERY_APP_DIR) : root;

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

const SRC = fs.readFileSync(path.join(appRoot, 'ZoeW', 'app.js'), 'utf8');

function sliceFn(name) {
    let start = SRC.indexOf('function ' + name + '(');
    if (start === -1) return null;
    if (SRC.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = SRC.indexOf('{', start), started = false;
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') { depth++; started = true; }
        else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return SRC.slice(start, i);
}

function sliceConst(name) {
    const re = new RegExp('^\\s*const ' + name + ' = [^;]+;', 'm');
    const m = SRC.match(re);
    return m ? m[0] : null;
}

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
            showToast: (m) => state.toasts.push(m)
        };
        core.ZoeErrors = core.window.ZoeErrors;
        vm.createContext(core);
        const extras = [
            'renderConnectionStatus', 'scheduleDbListenerRecovery', 'clearDbListenerRecovery',
            'attemptDbListenerRecovery', 'noteDbListenerAlive', 'initDatabaseListeners'
        ].map(sliceFn).filter(Boolean).join('\n\n');
        const src = 'let dbListenersFailed = false;\n' +
            'let dbListenerRecoveryTimer = null;\n' +
            'let dbListenerRecoveryAttempt = 0;\n' +
            'let dbListenerOutageNoticeShown = false;\n' +
            'const dbListenerPendingPaths = new Set();\n' +
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
    'connectionLooksOnline', 'connectionIsSettlingIn', 'renderConnectionStatus', 'nudgeDatabaseConnection',
    'forceDatabaseReconnect', 'canCycleDatabaseConnection', 'scheduleReconnectWatchdog', 'clearReconnectWatchdog',
    'handleDbListenerError', 'scheduleDbListenerRecovery', 'attemptDbListenerRecovery',
    'retryFailedDbListenersNow', 'clearDbListenerRecovery', 'noteDbListenerAlive',
    'detachDatabaseListeners', 'resetDbListenerHealthState', 'initDatabaseListeners',
    'runScheduledCleanup'
];

const missing = REQUIRED_FNS.filter((n) => !sliceFn(n));
if (missing.length) {
    console.log('  FAIL   មុខងារស្តារការតភ្ជាប់មិនមានក្នុង app.js: ' + missing.join(', '));
    console.log('\nសរុប: 0 ok, 1 FAIL');
    process.exit(1);
}

const REQUIRED_CONSTS = ['RECONNECT_FORCE_MIN_GAP_MS', 'RECONNECT_WATCHDOG_STEPS_MS', 'LISTENER_RECOVERY_STEPS_MS',
    'DB_LISTENER_RETRY_MIN_GAP_MS', 'CONNECTING_GRACE_ATTEMPTS'];
const missingConsts = REQUIRED_CONSTS.filter((n) => !sliceConst(n));
if (missingConsts.length) {
    console.log('  FAIL   ថេរមិនមាន: ' + missingConsts.join(', '));
    console.log('\nសរុប: 0 ok, 1 FAIL');
    process.exit(1);
}

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
    const fb = {
        off: (ref) => { log.off.push(ref && ref.__path); },
        onValue: (ref, cb, errCb) => {
            const p = ref && ref.__path;
            log.attached.push(p);
            listenerCallbacks[p] = { cb, errCb };
        },
        goOffline: () => { log.goOffline++; },
        goOnline: () => { log.goOnline++; }
    };

    const refs = {};
    ['history', 'deleted', 'dailyRevenue', 'monthlyRevenue', 'dailyPickup', 'exchangeRate']
        .forEach((k) => { refs[k] = { __path: k }; });

    const statusDot = { classes: {}, classList: { toggle: (c, on) => { statusDot.classes[c] = !!on; } } };
    const statusText = { innerText: '' };

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
        document: {
            getElementById: (id) => (id === 'statusDot' ? statusDot : (id === 'firebaseStatusText' ? statusText : null))
        },
        fb,
        db: {},
        auth: { currentUser: { uid: 'u1' } },
        isDatabaseConnected: true,
        isDatabaseInitialized: false,
        dbRefHistory: refs.history,
        dbRefDeleted: refs.deleted,
        dbRefDailyRevenue: refs.dailyRevenue,
        dbRefMonthlyRevenue: refs.monthlyRevenue,
        dbRefDailyPickup: refs.dailyPickup,
        dbRefExchangeRate: refs.exchangeRate,
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
        runAutomaticCleanupRules: () => { log.cleanupRuns++; },
        ZoeErrors: { capture: (e) => log.captures.push(e) }
    };
    ctx.window.ZoeErrors = ctx.ZoeErrors;
    vm.createContext(ctx);

    const code = REQUIRED_CONSTS.map(sliceConst).join('\n') + '\n' +
        REQUIRED_FNS.map(sliceFn).join('\n\n') + '\n' +
        'let dbListenersFailed = false;\n' +
        'let dbListenerRecoveryTimer = null;\n' +
        'let dbListenerRecoveryAttempt = 0;\n' +
        'let lastDbListenerAttemptAt = 0;\n' +
        'let dbListenerOutageNoticeShown = false;\n' +
        'let reconnectWatchdogTimer = null;\n' +
        'let reconnectWatchdogAttempt = 0;\n' +
        'let lastForcedReconnectAt = 0;\n' +
        // ស្ថានភាពដែលកំណត់ថាតើវដ្ត goOffline()+goOnline() មានតម្លៃឬអត់៖
        // វា **កាត់ផ្តាច់ handshake ដែលកំពុងដំណើរការ** ដូច្នេះវាមានតម្លៃតែពេល
        // SDK ទំនងជាកំពុងអង្គុយក្នុងបង្អួច backoff ប៉ុណ្ណោះ។ scenario ភាគច្រើន
        // ក្នុងឯកសារនេះជា «ធ្លាប់ភ្ជាប់រួច ➜ ដាច់» ដូច្នេះវាចាប់ផ្តើមជា true។
        'let hasEverConnectedToDatabase = true;\n' +
        'let networkJustReturned = false;\n' +
        'const dbListenerPendingPaths = new Set();\n' +
        'this.__probe = () => ({ dbListenersFailed, dbListenerRecoveryTimer, reconnectWatchdogTimer, ' +
        'reconnectWatchdogAttempt, lastDbListenerAttemptAt, pending: Array.from(dbListenerPendingPaths) });\n' +
        'this.__setConnHistory = (ever, back) => { hasEverConnectedToDatabase = ever; networkJustReturned = back; };\n' +
        'this.__connHistory = () => ({ hasEverConnectedToDatabase, networkJustReturned });\n' +
        'this.__api = { connectionLooksOnline, renderConnectionStatus, nudgeDatabaseConnection, ' +
        'handleDbListenerError, initDatabaseListeners, noteDbListenerAlive, retryFailedDbListenersNow, ' +
        'resetDbListenerHealthState, runScheduledCleanup, clearReconnectWatchdog };\n';

    vm.runInContext(code, ctx);
    return { ctx, log, clock, advance, listenerCallbacks, statusDot, statusText, api: ctx.__api, probe: ctx.__probe,
        setConnHistory: ctx.__setConnHistory, connHistory: ctx.__connHistory };
}

// ── ១. ការតភ្ជាប់ធម្មតា ─────────────────────────────────────────────
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    ok('ភ្ជាប់ listener ទាំង ៦', t.log.attached.length === 6, t.log.attached);
    ok('detach មុនភ្ជាប់ (គ្មាន listener ស្ទួន)', t.log.off.length === 6, t.log.off);
    ok('ស្ថានភាព = online ពេលធម្មតា', t.api.connectionLooksOnline() === true);
    t.api.renderConnectionStatus();
    ok('អត្ថបទ = ភ្ជាប់ Server រួចរាល់', t.statusText.innerText.indexOf('រួចរាល់') !== -1, t.statusText.innerText);
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
    ['history', 'deleted', 'dailyRevenue', 'monthlyRevenue', 'dailyPickup', 'exchangeRate']
        .forEach((p) => t.listenerCallbacks[p].errCb(new Error('permission_denied')));
    const outage = t.log.toasts.filter((m) => m.indexOf('ដាចការទាញយកទិន្នន័យ') !== -1);
    ok('សារដាច់ការតភ្ជាប់បង្ហាញតែ ១ ដង (មិនមែន ៦)', outage.length === 1, t.log.toasts);
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
    ok('ស្តារ listener ឡើងវិញដោយស្វ័យប្រវត្តិ', t.log.attached.length === attachedBefore + 6, t.log.attached.length);
    ok('detach មុនស្តារ (គ្មាន listener ស្ទួន)', t.log.off.length === 12, t.log.off.length);
    ok('ទង់នៅតែបរាជ័យរហូតដល់ snapshot មកដល់', t.probe().dbListenersFailed === true);
    ok('path ទាំង ៦ នៅរង់ចាំ', t.probe().pending.length === 6, t.probe().pending);
}

// ── ៥. ទង់រលត់តែពេល path ទាំងអស់ដឹងខ្លួន ─────────────────────────────
{
    const t = buildContext();
    t.api.initDatabaseListeners();
    t.listenerCallbacks.history.errCb(new Error('permission_denied'));
    t.advance(3000);

    const snap = (v) => ({ val: () => v });
    ['exchangeRate', 'dailyRevenue', 'monthlyRevenue', 'dailyPickup', 'history']
        .forEach((p) => t.listenerCallbacks[p].cb(snap(null)));
    ok('ទង់នៅតែបរាជ័យ ខណៈ path មួយនៅស្ងាត់', t.probe().dbListenersFailed === true, t.probe().pending);

    t.listenerCallbacks.deleted.cb(snap(null));
    ok('ទង់រលត់ពេល path ទាំង ៦ ដឹងខ្លួន', t.probe().dbListenersFailed === false);
    ok('connectionLooksOnline ត្រឡប់មក true', t.api.connectionLooksOnline() === true);
    const back = t.log.toasts.filter((m) => m.indexOf('ភ្ជាប់មកវិញ') !== -1);
    ok('សារជូនដំណឹងថាភ្ជាប់មកវិញ ១ ដង', back.length === 1, t.log.toasts);
    ok('កាលវិភាគស្តារត្រូវលុប', t.probe().dbListenerRecoveryTimer === null);
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
    ok('ស្តារភ្លាមពេលបណ្តាញត្រឡប់មក', t.log.attached.length === before + 6, t.log.attached.length);
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
    const burst = (t.log.attached.length - base) / 6;
    ok('ព្រឹត្តិការណ៍ខាងក្រៅ ១០ ដងក្នុង ១ វិ. ➜ យ៉ាងច្រើន ១ ជុំភ្ជាប់ឡើងវិញ',
        burst <= 1, burst);

    const t2 = buildContext();
    t2.api.initDatabaseListeners();
    t2.listenerCallbacks.history.errCb(new Error('permission_denied'));
    const b2 = t2.log.attached.length;
    for (let i = 0; i < 30; i++) { t2.advance(2000); t2.api.retryFailedDbListenersNow(); }
    const sustained = (t2.log.attached.length - b2) / 6;
    ok('ព្រឹត្តិការណ៍រៀងរាល់ ២ វិ. អស់ ៦០ វិ. ➜ មិនលើស ២១ ជុំ (មុនកែ ៦០)',
        sustained <= 21, sustained);

    // ជណ្តើរធម្មតា (គ្មានព្រឹត្តិការណ៍ខាងក្រៅ) មិនត្រូវយឺតជាងមុនទេ
    const t3 = buildContext();
    t3.api.initDatabaseListeners();
    t3.listenerCallbacks.history.errCb(new Error('permission_denied'));
    const b3 = t3.log.attached.length;
    t3.advance(60000);
    ok('ជណ្តើរ backoff ធម្មតានៅដដែល (៤ ជុំក្នុង ៦០ វិ.)',
        (t3.log.attached.length - b3) / 6 === 4, (t3.log.attached.length - b3) / 6);

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
        t4.log.attached.length === b4 + 6, t4.log.attached.length - b4);

    // ក្រោយចាកចេញ ត្រូវភ្លេចពេលព្យាយាមចុងក្រោយ
    t4.api.resetDbListenerHealthState();
    ok('ចាកចេញ ➜ ពេលព្យាយាមចុងក្រោយត្រូវ reset',
        t4.probe().lastDbListenerAttemptAt === 0, t4.probe().lastDbListenerAttemptAt);
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

console.log('\nសរុប: ' + pass + ' ok, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
