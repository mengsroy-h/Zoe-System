// ⛔ ថ្នាក់កំហុស ៖ **ស្ថានភាពការតភ្ជាប់ដែលនិយាយមិនពិត លើ *លំដាប់ចៃដន្យ***។
//
// `connection-recovery-test` មានសេណារីយ៉ូ **សរសេរដោយដៃ** ១២៧ ➜ វាវាស់តែ
// លំដាប់ដែលអ្នកសរសេរគិតដល់។ នេះជាជាន់ដដែលនឹង «ជាន់ទី ៥ ៖ លំដាប់ចៃដន្យ»
// ក្នុងផ្លូវលុយ ៖ រាល់ជុំសរសេរសេណារីយ៉ូល្អជាងមុនបន្តិច ➜ រកឃើញកំហុសមួយទៀត
// ក្នុងកូដដដែល។ ⛔ ការវាស់ត្រូវធ្វើ **ក្រោយរាល់ប្រតិបត្តិការ** មិនមែនត្រឹម
// ចុងលំដាប់ (ការវាស់នៅចុងធ្វើឲ្យប្រតិបត្តិការក្រោយៗ **លុបភស្តុតាង**)។
//
// អថេររក្សា (invariant) ដែលឯកសារនេះចាក់សោ ៖
//   ១. ទង់សរុប `dbListenersFailed` និងសំណុំតាមកូនសោ **មិនត្រូវនិយាយផ្ទុយគ្នា**
//   ២. `emptyViewMessage()` មិនត្រូវរាយ «គ្មានទិន្នន័យ» ខណៈកូនសោណាមួយមិនស្រស់
//   ៣. ⛔ ការរស់ឡើងវិញរបស់ listener **A មិនត្រូវលុបស្ថានភាពងាប់របស់ B**
//      (ថ្នាក់ «បងប្អូនប្រកាសជំនួសវាថាជាសះស្បើយ»)
//   ៤. ⛔ សារ «ទិន្នន័យភ្ជាប់មកវិញហើយ» ត្រូវចេញ **តែពេលគ្រប់កូនសោស្រស់**
//      — សារជោគជ័យខណៈតារាងនៅចាស់ ជាការកុហកដល់អ្នកប្រើ
//
// ⛔ កូនសោត្រូវ **ដេរីវេពី `DB_LISTENER_KEYS` ពិត** — បញ្ជីរឹងជាកាលបរិច្ឆេទ
// ផុតកំណត់ ៖ listener ថ្មីនឹងរអិលកាត់ស្ងាត់ៗ។
'use strict';

process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.CONNFUZZ_APP_DIR ? path.resolve(process.env.CONNFUZZ_APP_DIR) : path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'ZoeW/app.js');

const RUNS = Number(process.env.CONNFUZZ_RUNS || 240);
const RUN0 = Number(process.env.CONNFUZZ_RUN0 || 0);
const OPS = Number(process.env.CONNFUZZ_OPS || 24);

let pass = 0, fail = 0;
const failures = [];
function ok(label, cond, detail) {
    if (cond) { pass++; return; }
    fail++;
    if (failures.length < 12) failures.push(label + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
}

if (!fs.existsSync(FILE)) {
    console.log('  ❌ រកមិនឃើញ ' + FILE);
    console.log('\n0 ok, 1 FAIL');
    process.exitCode = 1;
    return;
}
const SRC = fs.readFileSync(FILE, 'utf8');

const missing = [];
function sliceFn(name) {
    let start = SRC.indexOf('function ' + name + '(');
    if (start === -1) { missing.push(name); return 'function ' + name + '() { return undefined; }'; }
    if (SRC.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = SRC.indexOf('{', start), started = false;
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') { depth++; started = true; }
        else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return SRC.slice(start, i);
}

const KEYS_DECL = (SRC.match(/const DB_LISTENER_KEYS = \[[^\]]*\];/) || [])[0];
if (!KEYS_DECL) missing.push('DB_LISTENER_KEYS');
const KEYS = KEYS_DECL ? vm.runInNewContext(KEYS_DECL + '\nDB_LISTENER_KEYS') : ['history'];

const FNS = ['dbListenerViewIsStale', 'anyDbListenerViewIsStale', 'emptyViewMessage',
    'noteDbListenerAlive', 'handleDbListenerError', 'dbListenerResyncIsProgressing'];

function makeWorld() {
    const log = { toasts: [], captures: [] };
    const sandbox = {
        console: { error: () => {}, log: () => {} },
        Date, Math, Array, Object, JSON, Set, Map, Number, String, Boolean,
        setTimeout: () => 0, clearTimeout: () => {},
        window: {},
        navigator: { onLine: true },
        __log: log
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(`
        var dbListenerPendingPaths = new Set();
        var dbListenerFailedPaths = new Set();
        var dbListenerReportedFailures = new Set();
        var dbListenersFailed = false;
        var dbListenerOutageNoticeShown = false;
        var dbListenerProgressAt = 0;
        var dbListenerPendingSeen = 0;
        const VIEW_NOT_MEASURABLE_NOTICE = '⏳ មិនអាចវាស់បាន';
        const DB_LISTENER_PROGRESS_GRACE_MS = 20000;
        function elapsedSince(mark) { return mark ? Date.now() - mark : Infinity; }
        function flushPendingRegistryReleases() {}
        function refreshLiveToasts() {}
        function renderConnectionStatus() {}
        function clearDbListenerRecovery() {}
        function scheduleDbListenerRecovery() {}
        function showToast(m) { __log.toasts.push(m); }
    `, ctx);
    vm.runInContext(FNS.map(sliceFn).join('\n\n'), ctx);
    return { ctx, log };
}

// អ្នកសរសេរតែមួយនៃ «listener ភ្ជាប់ថ្មី» — ត្រាប់តាមអ្វីដែល
// `initDatabaseListeners()` ធ្វើពិត (សម្អាតសំណុំ ២ រួចដាក់ pending គ្រប់កូនសោ)។
function attachAll(ctx) {
    vm.runInContext(`
        dbListenerPendingPaths.clear();
        dbListenerFailedPaths.clear();
        DB_LISTENER_KEYS_FUZZ.forEach((k) => dbListenerPendingPaths.add(k));
        dbListenerPendingSeen = dbListenerPendingPaths.size;
        dbListenerProgressAt = 0;
    `, ctx);
}

function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function snapshot(ctx) {
    return vm.runInContext(`({
        pending: Array.from(dbListenerPendingPaths),
        failed: Array.from(dbListenerFailedPaths),
        failedFlag: dbListenersFailed
    })`, ctx);
}

console.log('=== connection-state-fuzz — ស្ថានភាពការតភ្ជាប់លើលំដាប់ចៃដន្យ ===');
missing.forEach((n) => ok('ត្រូវមាន `' + n + '` ក្នុងកូដ ship', false, 'អវត្តមាន'));
ok('⛔ ជាន់អប្បបរមា ៖ កូនសោ listener យ៉ាងតិច ៥ (ដេរីវេពីកូដ ship)', KEYS.length >= 5, KEYS);

let steps = 0;
let sawRecoveryToast = 0;
let sawPartialAlive = 0;
let sawSiblingProbe = 0;

for (let run = RUN0; run < RUN0 + RUNS; run++) {
    const rand = rng(run * 2654435761 + 12345);
    const w = makeWorld();
    vm.runInContext('var DB_LISTENER_KEYS_FUZZ = ' + JSON.stringify(KEYS) + ';', w.ctx);
    attachAll(w.ctx);

    for (let op = 0; op < OPS; op++) {
        const key = KEYS[Math.floor(rand() * KEYS.length)];
        const before = snapshot(w.ctx);
        const toastsBefore = w.log.toasts.length;
        const pick = rand();

        if (pick < 0.40) {
            vm.runInContext("noteDbListenerAlive(" + JSON.stringify(key) + ")", w.ctx);
        } else if (pick < 0.75) {
            vm.runInContext("handleDbListenerError(new Error('x'), " + JSON.stringify(key) + ")", w.ctx);
        } else if (pick < 0.85) {
            // listener ទាំងអស់ភ្ជាប់ឡើងវិញ (ជណ្តើរស្តារ)
            attachAll(w.ctx);
        } else if (pick < 0.95) {
            // ⛔ «ទិន្នន័យមកដល់គ្រប់កូនសោ» ៖ បើគ្មានជំហាននេះ ស្ថានភាព
            //    «គ្រប់កូនសោស្រស់» កម្រកើតឡើងពេក ➜ ការអះអាងអំពីសារ
            //    «ភ្ជាប់មកវិញ» ក្លាយជាពិតដោយសំណាង មិនមែនដោយការវាស់។
            const order = KEYS.slice().sort(() => rand() - 0.5);
            for (const k of order) {
                vm.runInContext("noteDbListenerAlive(" + JSON.stringify(k) + ")", w.ctx);
                const mid = snapshot(w.ctx);
                const midToasts = w.log.toasts.slice(toastsBefore).filter((t) => t.indexOf('ភ្ជាប់មកវិញ') !== -1);
                ok('⛔ សារ «ភ្ជាប់មកវិញ» ចេញមុនកូនសោទាំងអស់ស្រស់',
                    midToasts.length === 0 || (mid.pending.length === 0 && mid.failed.length === 0), mid);
            }
        } else {
            // ⛔ ការហៅដែល **គ្មានកូនសោ** ៖ វាមិនត្រូវធ្វើឲ្យកូនសោណាមួយ
            //    មើលទៅស្រស់ឡើងវិញទេ (ការការពារដែលងាប់ = គ្មានការការពារ)។
            vm.runInContext("handleDbListenerError(new Error('x'), '')", w.ctx);
        }

        const after = snapshot(w.ctx);
        steps++;

        // ១. ទង់សរុប ↔ សំណុំតាមកូនសោ មិនត្រូវផ្ទុយគ្នា
        ok('⛔ មានកូនសោងាប់ តែទង់សរុបថាល្អ', !(after.failed.length > 0 && after.failedFlag === false),
            { key: key, after: after });

        // ២. សារ «គ្មានទិន្នន័យ» ត្រូវឈប់ ខណៈកូនសោមិនស្រស់
        for (const k of KEYS) {
            const stale = after.pending.indexOf(k) !== -1 || after.failed.indexOf(k) !== -1;
            const msg = vm.runInContext("emptyViewMessage([" + JSON.stringify(k) + "], 'គ្មានទិន្នន័យ')", w.ctx);
            ok('⛔ អេក្រង់អះអាង «គ្មានទិន្នន័យ» ខណៈវាស់មិនបាន',
                stale ? msg !== 'គ្មានទិន្នន័យ' : msg === 'គ្មានទិន្នន័យ', { key: k, stale: stale, msg: msg });
        }

        // ៣. ការរស់ឡើងវិញរបស់កូនសោមួយ មិនត្រូវលុបស្ថានភាពរបស់បងប្អូន
        if (pick < 0.40) {
            const others = KEYS.filter((k) => k !== key);
            const lostFailed = others.filter((k) => before.failed.indexOf(k) !== -1 && after.failed.indexOf(k) === -1);
            const lostPending = others.filter((k) => before.pending.indexOf(k) !== -1 && after.pending.indexOf(k) === -1);
            if (others.some((k) => before.failed.indexOf(k) !== -1)) sawSiblingProbe++;
            ok('⛔ បងប្អូនប្រកាសជំនួស listener ដែលនៅងាប់', lostFailed.length === 0 && lostPending.length === 0,
                { alive: key, lostFailed: lostFailed, lostPending: lostPending });
        }

        // ៤. សារ «ភ្ជាប់មកវិញ» ត្រូវចេញតែពេលគ្រប់កូនសោស្រស់
        const newToasts = w.log.toasts.slice(toastsBefore);
        const recovery = newToasts.filter((t) => t.indexOf('ភ្ជាប់មកវិញ') !== -1);
        if (recovery.length) {
            sawRecoveryToast++;
            ok('⛔ សារ «ភ្ជាប់មកវិញ» ខណៈកូនសោខ្លះនៅមិនស្រស់',
                after.pending.length === 0 && after.failed.length === 0, after);
        }
        if (after.pending.length + after.failed.length > 0 && after.pending.length + after.failed.length < KEYS.length) {
            sawPartialAlive++;
        }
    }
}

// ⛔ ជាន់អប្បបរមា ៖ បើសេណារីយ៉ូមិនដែលឈានដល់ស្ថានភាពគួរឲ្យចាប់អារម្មណ៍
//    នោះការអះអាងខាងលើ **ពិតដោយស្វ័យប្រវត្តិ** ➜ អ្នកយាមបៃតងក្លែងក្លាយ។
const minSteps = RUNS * OPS;
ok('ជាន់អប្បបរមា ៖ រត់គ្រប់ជំហាន', steps === minSteps, { steps: steps, want: minSteps });
ok('⛔ ជាន់អប្បបរមា ៖ ឈានដល់ស្ថានភាព «ខ្លះស្រស់ ខ្លះអត់» យ៉ាងតិច RUNS ដង',
    sawPartialAlive >= RUNS, sawPartialAlive);
ok('⛔ ជាន់អប្បបរមា ៖ ការរស់ឡើងវិញខណៈបងប្អូននៅងាប់ ត្រូវកើតឡើងពិត',
    sawSiblingProbe >= RUNS, sawSiblingProbe);
ok('⛔ ជាន់អប្បបរមា ៖ សារ «ភ្ជាប់មកវិញ» ត្រូវកើតឡើងយ៉ាងតិច ១ ដង (បើអត់ ការអះអាង ៤ គ្មានន័យ)',
    sawRecoveryToast >= 1, sawRecoveryToast);

console.log('  ជំហានសរុប ' + steps + ' · សារភ្ជាប់មកវិញ ' + sawRecoveryToast
    + ' · ស្ថានភាពចម្រុះ ' + sawPartialAlive + ' · probe បងប្អូន ' + sawSiblingProbe);
failures.forEach((f) => console.log('  ❌ ' + f));
console.log('');
if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' / ok ' + pass); process.exitCode = 1; }
else if (!pass) { console.log('❌ គ្មានការអះអាងណារត់សោះ'); process.exitCode = 1; }
else { console.log('✅ ជោគជ័យ ' + pass); process.exitCode = 0; }
