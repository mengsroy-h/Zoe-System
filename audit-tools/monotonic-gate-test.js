// ⛔ ថ្នាក់កំហុស៖ **ពិដានល្បឿន (rate limiter) ដែលសន្មតថានាឡិកាឧបករណ៍ដើរទៅមុខ**។
//
// រាល់ការស្តារបណ្តាញរបស់ App សរសេរជាទម្រង់ `Date.now() - lastXAt < GAP` ➜
// បើអ្នកប្រើ **បង្វិលនាឡិកាទូរស័ព្ទថយក្រោយ** (ឬ RTC ខូចរួច boot ទៅអតីតកាល)
// នោះ `now - last` ក្លាយជា **អវិជ្ជមាន** ➜ តូចជាង GAP **ជានិច្ច** ➜
// ច្រកទ្វារនោះ **បិទជាអចិន្ត្រៃយ៍** សម្រាប់វគ្គទាំងមូល៖
//
//   forceDatabaseReconnect()      ➜ App **លែងព្យាយាមភ្ជាប់ឡើងវិញ**
//   attemptDbListenerRecovery()   ➜ តារាងជាប់ «កំពុងភ្ជាប់ឡើងវិញ...» រហូត
//   dbListenerResyncIsProgressing ➜ `now - progressAt` អវិជ្ជមាន ➜ «កំពុងរីកចម្រើន»
//                                    ជានិច្ច ➜ ជណ្តើរស្តារ **មិនដែល attach ឡើងវិញ**
//   attemptAutoLookup()           ➜ cooldown មិនចេះផុត ➜ ការបំពេញលេខស្វ័យប្រវត្តិងាប់
//   throttledSwUpdate()           ➜ លែងពិនិត្យកំណែថ្មី
//
// ហើយទម្រង់ `setTimeout(fn, GAP - since)` ក្លាយជា `setTimeout(fn, ១ ឆ្នាំ)` ➜
// browser coerce ទៅ int32 ➜ **បាញ់ភ្លាមៗជារង្វិលជុំក្តៅ** (ស៊ីថ្ម)។
//
// នេះមិនមែនករណីទ្រឹស្តីទេ ៖ បញ្ជីផ្ទៀងផ្ទាត់របស់កំណែ 2.20.6 ក្នុង `CLAUDE.md`
// **ណែនាំអ្នកប្រើឲ្យប្តូរថ្ងៃទូរស័ព្ទថយក្រោយដោយផ្ទាល់** ដើម្បីសាក License។
//
// ⚠️ `clock-hygiene.js` **មិនចាប់ថ្នាក់នេះទេ** — ផ្ទុយទៅវិញវា *អនុញ្ញាត*
// ឲ្យ function ទាំងនេះប្រើនាឡិកាឆៅ (ព្រោះវាមិនមែនជាការសម្រេច retention/revenue)។
// វាពិនិត្យថា «តើវាប្រើនាឡិកាណា» ចំណែកឯកសារនេះពិនិត្យថា
// «តើវាសន្មតអ្វីអំពីនាឡិកានោះ» — សំណួរ ២ ផ្សេងគ្នា។
//
// ច្បាប់ ៖ រាល់ការវាស់ **រយៈពេលកន្លងផុត** ត្រូវឆ្លងកាត់ `elapsedSince(mark)`
// ដែល fail-open (`Infinity`) ពេលនាឡិកាថយក្រោយ។ ⛔ ការប្រៀបធៀប **ថ្ងៃឈប់**
// (`Date.now() < deadline` ដូច PIN lockout) មិនស្ថិតក្នុងច្បាប់នេះទេ —
// ការថយក្រោយធ្វើឲ្យ lockout **យូរជាង** ដែលជាទិសសុវត្ថិភាព។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let acorn;
try { acorn = require('acorn'); } catch (e) {
    console.log('SKIP — ត្រូវការ acorn (npm i acorn)');
    process.exit(0);
}

const ROOT = process.env.MONOGATE_APP_DIR
    ? path.resolve(process.env.MONOGATE_APP_DIR)
    : path.resolve(__dirname, '..');

const FILES = [
    'ZoeW/app.js',
    'ZoeKeyGen/app.js',
    'ZoeImport/app.js',
    'ZoeW/license-verify.js'
];

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function walk(node, cb, parent) {
    if (!node || typeof node.type !== 'string') return;
    cb(node, parent);
    for (const key of Object.keys(node)) {
        if (key === 'start' || key === 'end' || key === 'loc') continue;
        const value = node[key];
        if (Array.isArray(value)) value.forEach((c) => { if (c && typeof c.type === 'string') walk(c, cb, node); });
        else if (value && typeof value.type === 'string') walk(value, cb, node);
    }
}

function isRawClock(node) {
    if (!node) return false;
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed
        && node.callee.object.type === 'Identifier' && node.callee.object.name === 'Date'
        && node.callee.property.name === 'now') return true;
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed
        && node.callee.property.name === 'getTime'
        && node.callee.object.type === 'NewExpression'
        && node.callee.object.callee.type === 'Identifier'
        && node.callee.object.callee.name === 'Date'
        && node.callee.object.arguments.length === 0) return true;
    return node.type === 'NewExpression' && node.callee.type === 'Identifier'
        && node.callee.name === 'Date' && node.arguments.length === 0;
}

// ── ១. ស្តាទិច ៖ គ្មានការដកនាឡិកាឆៅ ក្រៅ `elapsedSince()` ─────────────────
//    រួមទាំងទម្រង់ `const now = Date.now(); … now - mark` (dataflow ១ ជាន់
//    ក្នុង function តែមួយ) — ព្រោះនោះជាទម្រង់ដែលកូដពិតធ្លាប់ប្រើ។
console.log('\n=== រយៈពេលកន្លងផុត ត្រូវឆ្លងកាត់ elapsedSince() ===');

const offenders = [];
let filesScanned = 0;
let helperFiles = 0;
let callSites = 0;

const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

// ដើរតាម **វិសាលភាព function** ៖ អថេរដែលចាប់នាឡិកាឆៅទុកមានន័យតែក្នុង
// វិសាលភាពរបស់វា។ បើគិតជា file-global នោះ parameter ឈ្មោះ `now` របស់
// `barcodeCloseIsRipe(b, now)` នឹងត្រូវច្រឡំជានាឡិកាឆៅ ➜ false positive។
function scanScope(node, body, inherited, params, onSub) {
    const local = new Set(inherited);
    params.forEach((name) => local.delete(name));
    const nested = [];

    function inner(n, parent) {
        if (!n || typeof n.type !== 'string') return;
        if (n !== node && FN_TYPES.has(n.type)) { nested.push(n); return; }
        if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && isRawClock(n.init)) local.add(n.id.name);
        if (n.type === 'AssignmentExpression' && n.operator === '=' && n.left.type === 'Identifier' && isRawClock(n.right)) local.add(n.left.name);
        for (const key of Object.keys(n)) {
            if (key === 'start' || key === 'end' || key === 'loc') continue;
            const value = n[key];
            if (Array.isArray(value)) value.forEach((c) => { if (c && typeof c.type === 'string') inner(c, n); });
            else if (value && typeof value.type === 'string') inner(value, n);
        }
    }
    inner(node, null);

    function subs(n) {
        if (!n || typeof n.type !== 'string') return;
        if (n !== node && FN_TYPES.has(n.type)) return;
        if (n.type === 'BinaryExpression' && n.operator === '-') onSub(n, local);
        for (const key of Object.keys(n)) {
            if (key === 'start' || key === 'end' || key === 'loc') continue;
            const value = n[key];
            if (Array.isArray(value)) value.forEach((c) => { if (c && typeof c.type === 'string') subs(c); });
            else if (value && typeof value.type === 'string') subs(value);
        }
    }
    subs(node);

    nested.forEach((fn) => {
        const names = fn.params.map((prm) => (prm.type === 'Identifier' ? prm.name : null)).filter(Boolean);
        scanScope(fn, fn.body, local, names, onSub);
    });
}

for (const rel of FILES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    filesScanned++;
    const code = fs.readFileSync(file, 'utf8');
    const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true, sourceType: 'script' });

    let helperRange = null;
    walk(ast, (n) => {
        if (n.type === 'FunctionDeclaration' && n.id && n.id.name === 'elapsedSince') helperRange = [n.start, n.end];
        if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'elapsedSince') callSites++;
    });
    if (helperRange) helperFiles++;

    scanScope(ast, ast, new Set(), [], (n, clockVars) => {
        if (helperRange && n.start >= helperRange[0] && n.end <= helperRange[1]) return;
        const leftIsClock = isRawClock(n.left)
            || (n.left.type === 'Identifier' && clockVars.has(n.left.name));
        if (!leftIsClock) return;
        // ការដកតម្លៃ **ថេរ** (`Date.now() - 60000`) ជាការគណនាថ្ងៃឈប់ មិនមែនរយៈពេលកន្លងផុត
        if (n.right.type === 'Literal') return;
        offenders.push(rel + ':' + n.loc.start.line + '  ' + code.slice(n.start, n.end).replace(/\s+/g, ' ').slice(0, 70));
    });
}

ok('ជាន់អប្បបរមា ៖ ស្កេនឯកសារ App យ៉ាងតិច ៣ (រកឃើញ ' + filesScanned + ')', filesScanned >= 3);
ok('ជាន់អប្បបរមា ៖ `elapsedSince()` មានក្នុង App យ៉ាងតិច ៣ (រកឃើញ ' + helperFiles + ')', helperFiles >= 3);
ok('ជាន់អប្បបរមា ៖ រកឃើញកន្លែងហៅ `elapsedSince()` យ៉ាងតិច ១០ (រកឃើញ ' + callSites + ')', callSites >= 10);
ok('គ្មានការដកនាឡិកាឆៅក្រៅ `elapsedSince()`', offenders.length === 0, offenders.slice(0, 8));

// ── ២. ឥរិយាបថ ៖ រត់ `elapsedSince()` ពិត ─────────────────────────────────
console.log('\n=== elapsedSince() ៖ ថយក្រោយ ➜ fail-open · ទៅមុខ ➜ នៅតែទប់ ===');

function sliceBalanced(src, from) {
    let depth = 0;
    for (let i = from; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) return src.slice(from, i + 1); }
    }
    return null;
}
function extractFn(src, name) {
    const re = new RegExp('\\n(\\s*)(async\\s+)?function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    const head = src.indexOf('function ' + name, m.index);
    const brace = src.indexOf('{', src.indexOf('(', head));
    const body = sliceBalanced(src, brace);
    return body ? (m[2] ? 'async ' : '') + src.slice(head, brace) + body : null;
}
function extractConst(src, name) {
    const re = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);');
    const m = re.exec(src);
    return m ? 'const ' + name + ' = ' + m[1] + ';' : null;
}

const APP = path.join(ROOT, 'ZoeW', 'app.js');
const src = fs.existsSync(APP) ? fs.readFileSync(APP, 'utf8').replace(/\r\n?/g, '\n') : '';

// ⛔ បើ tree មិនទាន់មាន helper ➜ stub ដែល **រក្សាឥរិយាបថចាស់** ដើម្បីឲ្យ
//    ការអះអាងធ្លាក់ដោយ *ហេតុផលរបស់វា* មិនមែនដោយ ReferenceError ដែលបិទបាំង
//    ការអះអាងខាងក្រោម (មេរៀន checker-coverage ចំណុច ៣)។
const HELPER = extractFn(src, 'elapsedSince')
    || 'function elapsedSince(mark) { return Date.now() - mark; }';

const NEEDED = ['forceDatabaseReconnect', 'dbListenerResyncIsProgressing', 'retryFirebaseSdkNow'];
const foundFns = NEEDED.filter((n) => !!extractFn(src, n));
ok('ជាន់អប្បបរមា ៖ រកឃើញច្រកទ្វារដែលត្រូវវាស់ ' + NEEDED.length,
    foundFns.length === NEEDED.length, { missing: NEEDED.filter((n) => foundFns.indexOf(n) === -1) });

function buildWorld(startNow) {
    let deviceNow = startNow;
    const RealDate = Date;
    function FakeDate(...args) {
        if (!(this instanceof FakeDate)) return new RealDate(...args).toString();
        return args.length ? new RealDate(...args) : new RealDate(deviceNow);
    }
    FakeDate.now = () => deviceNow;
    FakeDate.prototype = RealDate.prototype;

    const log = { goOnline: 0, goOffline: 0, timers: [], recovered: 0, attached: 0 };
    const ctx = {
        console, Math, Set, Map, Number, String, Boolean, Object, Array, JSON, Infinity,
        Date: FakeDate,
        navigator: { onLine: true },
        setTimeout: (fn, ms) => { log.timers.push(ms); return log.timers.length; },
        clearTimeout: () => {},
        __log: log
    };
    vm.createContext(ctx);

    const code = [
        extractConst(src, 'RECONNECT_FORCE_MIN_GAP_MS'),
        extractConst(src, 'DB_LISTENER_RETRY_MIN_GAP_MS'),
        extractConst(src, 'DB_LISTENER_PROGRESS_GRACE_MS'),
        extractConst(src, 'FIREBASE_SDK_RETRY_MIN_GAP_MS'),
        'let lastForcedReconnectAt = 0, lastDbListenerAttemptAt = 0, dbListenerProgressAt = 0;',
        'let lastFirebaseSdkAttemptAt = 0;',
        'let firebaseSdkUnavailable = true, isDatabaseInitialized = false, isInitializingFirebase = false;',
        'let firebaseSdkRetryTimer = null;',
        'let hasEverConnectedToDatabase = true, networkJustReturned = false;',
        'const dbListenerPendingPaths = new Set(["history"]);',
        'let db = {};',
        'const fb = { goOnline() { __log.goOnline++; }, goOffline() { __log.goOffline++; } };',
        'function canCycleDatabaseConnection() { return hasEverConnectedToDatabase || networkJustReturned; }',
        'function clearFirebaseSdkRetry() { firebaseSdkRetryTimer = null; }',
        'function recoverFirebaseSdk() { __log.recovered++; }',
        HELPER,
        // ⛔ បាត់ function ➜ **stub** មិនមែនបញ្ឈប់ ៖ ការបញ្ឈប់បិទបាំងការអះអាង
        //    ឥរិយាបថទាំងអស់ខាងក្រោម (មេរៀន checker-coverage ចំណុច ៣)។
        extractFn(src, 'forceDatabaseReconnect') || 'function forceDatabaseReconnect() { return false; }',
        extractFn(src, 'dbListenerResyncIsProgressing') || 'function dbListenerResyncIsProgressing() { return true; }',
        extractFn(src, 'retryFirebaseSdkNow') || 'function retryFirebaseSdkNow() {}',
        'globalThis.__setNow = (ms) => { __setDeviceNow(ms); };',
        'globalThis.__api = { forceDatabaseReconnect, dbListenerResyncIsProgressing, retryFirebaseSdkNow };',
        'globalThis.__state = () => ({ lastForcedReconnectAt, dbListenerProgressAt, lastFirebaseSdkAttemptAt });',
        'globalThis.__mark = (name, ms) => { if (name === "progress") dbListenerProgressAt = ms; if (name === "sdk") lastFirebaseSdkAttemptAt = ms; };'
    ].filter(Boolean).join('\n\n');

    ctx.__setDeviceNow = (ms) => { deviceNow = ms; };
    new vm.Script(code).runInContext(ctx);
    return { ctx, log, setNow: (ms) => { deviceNow = ms; } };
}

const T0 = 1780000000000;
const HOUR = 60 * 60 * 1000;

// ២ក. forceDatabaseReconnect ៖ ថយក្រោយមិនត្រូវបិទការភ្ជាប់ឡើងវិញ
{
    const w = buildWorld(T0);
    const first = w.ctx.__api.forceDatabaseReconnect();
    const second = w.ctx.__api.forceDatabaseReconnect();
    ok('forceDatabaseReconnect ៖ ការហៅដំបូងដំណើរការ', first === true, first);
    ok('⛔ ទិសផ្ទុយ ៖ ការហៅភ្លាមៗត្រូវ **នៅតែទប់** (ពិដានមិនត្រូវបាត់)', second === false, second);

    w.setNow(T0 - HOUR);
    const third = w.ctx.__api.forceDatabaseReconnect();
    ok('⛔ នាឡិកាថយក្រោយ ១ ម៉ោង ➜ ការភ្ជាប់ឡើងវិញ **មិនត្រូវជាប់សោ**', third === true, third);

    w.setNow(T0 - HOUR + 10 * 60 * 1000);
    const fourth = w.ctx.__api.forceDatabaseReconnect();
    ok('   ក្រោយថយក្រោយ ➜ ពិដានចាប់ផ្តើមរាប់ពីម៉ោងថ្មី (នៅតែទប់ការហៅជាប់ៗ)',
        fourth === true, fourth);
    ok('   ការហៅភ្លាមបន្ទាប់ត្រូវទប់វិញ', w.ctx.__api.forceDatabaseReconnect() === false);
}

// ២ខ. dbListenerResyncIsProgressing ៖ ថយក្រោយមិនត្រូវក្លាយជា «រីកចម្រើនរហូត»
{
    const w = buildWorld(T0);
    ok('dbListenerResyncIsProgressing ៖ គ្មានវឌ្ឍនភាពទេ ➜ false', w.ctx.__api.dbListenerResyncIsProgressing() === false);
    w.ctx.__mark('progress', T0);
    w.setNow(T0 + 1000);
    ok('⛔ ទិសផ្ទុយ ៖ វឌ្ឍនភាពទើបកើត ➜ ត្រូវ **រង់ចាំ** (true)',
        w.ctx.__api.dbListenerResyncIsProgressing() === true);
    w.setNow(T0 - HOUR);
    ok('⛔ នាឡិកាថយក្រោយ ➜ **មិនត្រូវ** អះអាងថាកំពុងរីកចម្រើន (ជណ្តើរត្រូវ attach ឡើងវិញបាន)',
        w.ctx.__api.dbListenerResyncIsProgressing() === false);
}

// ២គ. retryFirebaseSdkNow ៖ ថយក្រោយមិនត្រូវបង្កើត timer យក្ស (int32 overflow)
{
    const w = buildWorld(T0);
    w.ctx.__mark('sdk', T0);
    w.setNow(T0 + 100);
    w.ctx.__api.retryFirebaseSdkNow();
    ok('⛔ ទិសផ្ទុយ ៖ ការហៅភ្លាមក្រោយព្យាយាម ➜ ត្រូវពន្យារ (មិនហៅ recover ភ្លាម)',
        w.log.recovered === 0 && w.log.timers.length === 1, { rec: w.log.recovered, timers: w.log.timers });

    const w2 = buildWorld(T0);
    w2.ctx.__mark('sdk', T0);
    w2.setNow(T0 - 365 * 24 * HOUR);
    w2.ctx.__api.retryFirebaseSdkNow();
    const maxTimer = w2.log.timers.length ? Math.max.apply(null, w2.log.timers) : 0;
    ok('⛔ នាឡិកាថយក្រោយ ១ ឆ្នាំ ➜ ត្រូវព្យាយាមភ្លាម (មិនរង់ចាំ)', w2.log.recovered === 1,
        { rec: w2.log.recovered, timers: w2.log.timers });
    ok('⛔ នាឡិកាថយក្រោយ ➜ គ្មាន timer លើសពិដាន int32 (2147483647ms)',
        maxTimer <= 2147483647, maxTimer);
}

console.log('\n' + (fail === 0 ? '✅ ជោគជ័យទាំងអស់ (' + pass + ')' : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
process.exit(fail === 0 ? 0 : 1);
