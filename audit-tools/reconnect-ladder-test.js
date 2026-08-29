// ថ្នាក់កំហុស៖ **វដ្តភ្ជាប់ឡើងវិញដែលកាត់ផ្តាច់ handshake ដែលកំពុងដំណើរការ។**
//
// `forceDatabaseReconnect()` ធ្វើ `goOffline()` + `goOnline()` ដើម្បី **reset
// backoff ខាងក្នុងរបស់ Firebase SDK** — នោះជាហេតុផលតែមួយគត់ដែលវាមាន។ ប៉ុន្តែ
// `goOffline()` ក៏ **កាត់ផ្តាច់ការតភ្ជាប់ដែលកំពុងដំណើរការ** ដែរ។
//
// ពេល boot នោះ `.info/connected` បាញ់ `false` ភ្លាម ➜ watchdog ចាប់កាលវិភាគ ➜
// បើ handshake ដំបូងយឺតជាងជំហានដំបូង (៥ វិ.) នោះវដ្តនោះ **សម្លាប់ handshake
// ដែលជិតរួច** ហើយចាប់ផ្តើមឡើងវិញ។ មុនការភ្ជាប់ជោគជ័យលើកដំបូង backoff របស់
// SDK នៅតូច ➜ **គ្មានអ្វីត្រូវ reset** ➜ ការចំណាយសុទ្ធសាធ។
//
// ⚠️ តេស្តនេះរត់កូដពិតចេញពី `app.js` ធៀបនឹង **គំរូ** នៃ connection របស់ RTDB
// (backoff min ១ វិ., ×1.3, max ៣០ វិ. — តម្លៃដែល firebase-js-sdk ប្រកាស)។
// វាមិនវាស់បណ្តាញពិតទេ — វាវាស់ **តក្កវិជ្ជានៃ ladder** ធៀបនឹងគំរូនោះ។
// ការអះអាងសំខាន់មិនមែនជាលេខ ms ដាច់ខាតទេ គឺជា **ការប្រៀបធៀបផ្ទាល់**៖
// កូដដែល ship រួច មិនត្រូវយឺតជាង ladder ចាស់ក្នុងសេណារីយ៉ូណាមួយឡើយ។
const fs = require('fs'), path = require('path'), vm = require('vm');

const root = path.resolve(__dirname, '..');
const appRoot = process.env.LADDER_APP_DIR ? path.resolve(process.env.LADDER_APP_DIR) : root;
const SRC = fs.readFileSync(path.join(appRoot, 'ZoeW', 'app.js'), 'utf8');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function sliceFn(name) {
    const start = SRC.indexOf('function ' + name + '(');
    if (start === -1) return null;
    let depth = 0, i = SRC.indexOf('{', start), started = false;
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') { depth++; started = true; }
        else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return SRC.slice(start, i);
}
function sliceConst(name) {
    const m = new RegExp('^\\s*const ' + name + ' = [^;]+;', 'm').exec(SRC);
    return m ? m[0].trim() : null;
}
function sliceConnectedCallback() {
    const start = SRC.indexOf('fb.onValue(dbRefConnected, (snap) => {');
    if (start === -1) return null;
    const bodyStart = SRC.indexOf('{', SRC.indexOf('(snap) =>', start));
    let depth = 0, i = bodyStart, started = false;
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') { depth++; started = true; }
        else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return 'function onConnectedSnapshot(snap) ' + SRC.slice(bodyStart, i);
}

const FNS = ['clearReconnectWatchdog', 'canCycleDatabaseConnection', 'forceDatabaseReconnect',
    'scheduleReconnectWatchdog', 'nudgeDatabaseConnection'];
const missing = FNS.filter((n) => !sliceFn(n));
if (missing.length) {
    console.log('  FAIL   រកមុខងារមិនឃើញក្នុង app.js: ' + missing.join(', '));
    console.log('\nសរុប: 0 ok, 1 FAIL');
    process.exit(1);
}
const connectedCb = sliceConnectedCallback();
if (!connectedCb) {
    console.log('  FAIL   រក callback របស់ .info/connected មិនឃើញ');
    console.log('\nសរុប: 0 ok, 1 FAIL');
    process.exit(1);
}

// ── គំរូនៃ connection របស់ Firebase RTDB ─────────────────────────────
const SDK_MIN_DELAY = 1000, SDK_MULT = 1.3, SDK_MAX_DELAY = 30000;

function run({ handshakeMs, networkUpAt, connectedFromStart, ladder, budgetMs }) {
    const clock = { now: 0, seq: 0, timers: [] };
    const setTimeoutFake = (fn, ms) => {
        const t = { fn, at: clock.now + (ms || 0), id: ++clock.seq };
        clock.timers.push(t); return t.id;
    };
    const clearTimeoutFake = (id) => { const t = clock.timers.find((x) => x.id === id); if (t) t.cleared = true; };

    const sim = { forcedOffline: false, attemptTimerId: null, backoff: SDK_MIN_DELAY,
        connected: false, everConnected: false, connectedAt: null, started: 0, aborted: 0 };
    const log = { goOffline: 0, goOnline: 0 };
    const networkUp = () => clock.now >= networkUpAt;

    function cancelAttempt() {
        if (sim.attemptTimerId !== null) { clearTimeoutFake(sim.attemptTimerId); sim.attemptTimerId = null; sim.aborted++; }
    }
    function scheduleAttempt(delay) {
        if (sim.forcedOffline) return;
        sim.attemptTimerId = setTimeoutFake(() => { sim.attemptTimerId = null; startHandshake(); }, delay);
    }
    function startHandshake() {
        if (sim.forcedOffline) return;
        sim.started++;
        sim.attemptTimerId = setTimeoutFake(() => {
            sim.attemptTimerId = null;
            if (networkUp()) {
                sim.connected = true; sim.everConnected = true;
                if (sim.connectedAt === null) sim.connectedAt = clock.now;
                sim.backoff = SDK_MIN_DELAY;
                ctx.onConnectedSnapshot({ val: () => true });
            } else {
                sim.backoff = Math.min(SDK_MAX_DELAY, sim.backoff * SDK_MULT);
                scheduleAttempt(sim.backoff);
            }
        }, networkUp() ? handshakeMs : 1000);
    }

    const fb = {
        goOffline: () => {
            log.goOffline++; sim.forcedOffline = true; cancelAttempt();
            if (sim.connected) { sim.connected = false; ctx.onConnectedSnapshot({ val: () => false }); }
        },
        goOnline: () => {
            log.goOnline++;
            if (sim.forcedOffline) { sim.forcedOffline = false; sim.backoff = SDK_MIN_DELAY; startHandshake(); }
        }
    };

    const ctx = {
        console, Set, Math, Date: { now: () => clock.now },
        setTimeout: setTimeoutFake, clearTimeout: clearTimeoutFake,
        navigator: { get onLine() { return networkUp(); } },
        window: {}, document: { getElementById: () => null },
        fb, db: {}, isDatabaseConnected: !!connectedFromStart, dbListenersFailed: false,
        retryFailedDbListenersNow: () => {}, renderConnectionStatus: () => {}, showToast: () => {},
        flushPendingHistoryPatches: () => {}
    };
    vm.createContext(ctx);

    let code = [sliceConst('RECONNECT_FORCE_MIN_GAP_MS'), sliceConst('RECONNECT_WATCHDOG_STEPS_MS')].join('\n') +
        '\n' + FNS.map(sliceFn).join('\n\n') + '\n' + connectedCb + '\n' +
        // ពិដានល្បឿនរបស់ `forceDatabaseReconnect` ឥឡូវឆ្លងកាត់ `elapsedSince()` (2.20.7)
        (sliceFn('elapsedSince') || 'function elapsedSince(mark) { return Date.now() - mark; }') + '\n' +
        // callback របស់ `.info/connected` ឥឡូវរលត់ទង់ស្តារ `.info/*` (កំណែ 2.19.3)។
        // តេស្តនេះវាស់ **ជណ្តើរភ្ជាប់ឡើងវិញ** ដូច្នេះ stub គ្រប់គ្រាន់។
        'const clearInfoListenerRecovery = () => {};\n' +
        'const noteInfoListenerAlive = () => {};\n' +
        'const infoListenerFailedPaths = new Set();\n' +
        "const INFO_LISTENER_KEY_CONNECTED = 'connected';\n" +
        "const INFO_LISTENER_KEY_OFFSET = 'serverTimeOffset';\n" +
        'let reconnectWatchdogTimer = null;\nlet reconnectWatchdogAttempt = 0;\nlet lastForcedReconnectAt = 0;\n' +
        'let hasEverConnectedToDatabase = ' + (connectedFromStart ? 'true' : 'false') + ';\n' +
        'let networkJustReturned = false;\n' +
        'this.onConnectedSnapshot = onConnectedSnapshot;\nthis.__nudge = nudgeDatabaseConnection;\n' +
        'this.__markConnected = () => { hasEverConnectedToDatabase = true; };\n' +
        'this.__markNetworkBack = () => { networkJustReturned = true; };\n';

    // ladder ចាស់ (មុន 2.12.1) ៖ វដ្តគ្មានលក្ខខណ្ឌ — ប្រើសម្រាប់ប្រៀបធៀបតែប៉ុណ្ណោះ
    if (ladder === 'old') {
        code = code.replace("if (canCycleDatabaseConnection() && typeof fb.goOffline === 'function') {",
                            "if (typeof fb.goOffline === 'function') {");
    }
    vm.runInContext(code, ctx);

    startHandshake();
    ctx.onConnectedSnapshot({ val: () => false });
    if (networkUpAt > 0) setTimeoutFake(() => { ctx.__markNetworkBack(); ctx.__nudge(); }, networkUpAt);

    const step = 50;
    for (let t = 0; t < budgetMs && sim.connectedAt === null; t += step) {
        const target = clock.now + step;
        for (;;) {
            const due = clock.timers.filter((x) => !x.cleared && !x.done && x.at <= target)
                .sort((a, b) => a.at - b.at || a.id - b.id)[0];
            if (!due) break;
            clock.now = due.at; due.done = true; due.fn();
            if (sim.everConnected) ctx.__markConnected();
        }
        clock.now = target;
    }
    return { connectedAt: sim.connectedAt, aborted: sim.aborted, goOffline: log.goOffline };
}

const SCENARIOS = [
    { name: 'handshake ០,៥ វិ.',                    handshakeMs: 500,   networkUpAt: 0, continuous: true },
    { name: 'handshake ៤ វិ. (3G)',                  handshakeMs: 4000,  networkUpAt: 0, continuous: true },
    { name: 'handshake ៨ វិ. (2G)',                  handshakeMs: 8000,  networkUpAt: 0, continuous: true, mustBeat: true },
    { name: 'handshake ១៥ វិ. (2G អាក្រក់)',         handshakeMs: 15000, networkUpAt: 0, continuous: true, mustBeat: true },
    { name: 'handshake ២៥ វិ. (អាក្រក់ខ្លាំង)',      handshakeMs: 25000, networkUpAt: 0, continuous: true, mustBeat: true },
    { name: 'boot ក្រៅបណ្តាញ ➜ WiFi ២០ វិ.',         handshakeMs: 2000,  networkUpAt: 20000, needsCycle: true },
    { name: 'boot ក្រៅបណ្តាញ ➜ WiFi ៦០ វិ.',         handshakeMs: 2000,  networkUpAt: 60000, needsCycle: true },
    { name: 'boot ក្រៅបណ្តាញ ➜ WiFi ៦០ វិ. + hs ៨ វិ.', handshakeMs: 8000, networkUpAt: 60000, needsCycle: true },
    { name: 'ធ្លាប់ភ្ជាប់ ➜ ដាច់ ➜ ត្រឡប់មក ៦០ វិ.', handshakeMs: 2000,  networkUpAt: 60000, connectedFromStart: true, needsCycle: true }
];

console.log('\n=== ពេលដល់ស្ថានភាព «ភ្ជាប់» (គំរូ RTDB) ===');
const pad = (x, n) => { let o = String(x); while (o.length < n) o += ' '; return o; };
console.log(pad('សេណារីយ៉ូ', 46) + pad('ladder ចាស់', 16) + pad('ដែល ship រួច', 16) + 'ភាពខុសគ្នា');
console.log('-'.repeat(94));

const results = [];
for (const sc of SCENARIOS) {
    const oldR = run({ ...sc, ladder: 'old', budgetMs: 240000 });
    const newR = run({ ...sc, ladder: 'shipped', budgetMs: 240000 });
    results.push({ sc, oldR, newR });
    const f = (r) => (r.connectedAt === null ? 'មិនភ្ជាប់' : Math.round(r.connectedAt) + ' (ab=' + r.aborted + ')');
    const d = (oldR.connectedAt !== null && newR.connectedAt !== null)
        ? (newR.connectedAt - oldR.connectedAt >= 0 ? '+' : '') + Math.round(newR.connectedAt - oldR.connectedAt) + ' ms' : '—';
    console.log(pad(sc.name, 46) + pad(f(oldR), 16) + pad(f(newR), 16) + d);
}

console.log('\n=== ការអះអាង ===');
// ១. គ្មានការថយក្រោយក្នុងសេណារីយ៉ូណាមួយឡើយ — នេះជាការអះអាងសំខាន់បំផុត
results.forEach(({ sc, oldR, newR }) => {
    ok('មិនយឺតជាង ladder ចាស់ ៖ ' + sc.name,
        newR.connectedAt !== null && oldR.connectedAt !== null && newR.connectedAt <= oldR.connectedAt,
        { old: oldR.connectedAt, shipped: newR.connectedAt });
});
// ២. handshake យឺត + បណ្តាញឡើងជាប់ ➜ ត្រូវលឿនជាងពិតប្រាកដ ហើយគ្មានការកាត់ផ្តាច់
results.filter((r) => r.sc.mustBeat).forEach(({ sc, oldR, newR }) => {
    ok('**លឿនជាងច្បាស់លាស់** ៖ ' + sc.name + ' (' + Math.round(oldR.connectedAt - newR.connectedAt) + ' ms)',
        newR.connectedAt < oldR.connectedAt, { old: oldR.connectedAt, shipped: newR.connectedAt });
});
results.filter((r) => r.sc.continuous).forEach(({ sc, newR }) => {
    ok('បណ្តាញឡើងជាប់ ➜ **គ្មាន handshake ណាត្រូវកាត់ផ្តាច់** ៖ ' + sc.name,
        newR.aborted === 0, newR.aborted);
});
// ៣. ពេលបណ្តាញត្រឡប់មក វដ្តត្រូវ **នៅតែប្រើ** (នេះជាហេតុផលដែលវាមាន)
results.filter((r) => r.sc.needsCycle).forEach(({ sc, newR }) => {
    ok('បណ្តាញត្រឡប់មក ➜ វដ្ត reset backoff **នៅតែប្រើ** ៖ ' + sc.name,
        newR.goOffline >= 1, newR.goOffline);
});

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
