// ⛔ ថ្នាក់កំហុស៖ **កូនសោដែលសួរ មិនដែលត្រូវបានដាក់ចូល `Set`** ➜ ការការពារ
// មួយមើលទៅដូចមាន តែវាជា `false` ជានិច្ច ➜ ការការពារនោះ **មិនដែលការពារអ្វី
// សោះ** ហើយគ្មាន checker ណាមួយឃើញ ព្រោះកូដនៅដដែល និង syntax ត្រឹមត្រូវ។
//
// 🔴 កំហុសពិតដែលរកឃើញក្នុងជុំនេះ (កំណែ 2.20.1)៖
//   `initDatabaseListeners()` ដាក់ **កូនសោខ្លី** ៦ ចូល `dbListenerPendingPaths`៖
//       'exchangeRate' · 'dailyRevenue' · 'monthlyRevenue' · 'dailyPickup' ·
//       'history' · 'deleted'
//   ប៉ុន្តែផ្លូវការពារ ២ កន្លែងសួរដោយ **ឈ្មោះ path ពេញ**៖
//       clearStaleRestoreMarkers()  ៖ dbListenerPendingPaths.has('zoew_recently_deleted_cod_dod')
//       dropStaleRestoreMarkers()   ៖ dbListenerPendingPaths.has('zoew_recently_deleted_cod_dod')
//   ➜ ការការពារទាំង ២ ជា `false` **ជានិច្ច**។
//
// ផលពិត៖ ចន្លោះពេលរវាង snapshot «history» មកដល់ និង snapshot «deleted»
// មកដល់ (លើតំណយឺត ឬធុងសំរាមធំ អាចយូរជាច្រើនវិនាទី) `deletedItems` នៅ `[]`។
// ក្នុងចន្លោះនោះ `runAutomaticCleanupRules()` (រត់ ១២០ms ក្រោយ snapshot
// history តាម `debouncedRenderAfterHistorySync` និងរាល់ ៦០ វិនាទី) ហៅ
// `clearStaleRestoreMarkers()` ➜ វារកមិនឃើញធាតុប្រភពក្នុងធុងសំរាម ➜ សន្និដ្ឋាន
// ថា marker «ងាប់» ➜ **លុប `restoreClaimId`/`restoreClaimToken` ចេញពីធាតុ
// ដែលឧបករណ៍ *ផ្សេង* កំពុងស្តារពិតៗ**។
// នោះជាថ្នាក់កំហុសផលិតកម្មដដែលនឹងកំណែ 2.17.3៖ `finalizeClaimedRestore`
// ត្រូវ rules បដិសេធ (`PERMISSION_DENIED`) ➜ ធាតុស្ទួននៅទាំង ២ node ➜
// «ដក» និង «លុប» លើវា **ស្លាប់ជារៀងរហូត**។
//
// ⚠️ `activeRestoreClaims` ការពារតែ claim របស់ **ឧបករណ៍នេះ** — ការការពារ
// ឆ្លងឧបករណ៍ពឹងលើការមើលឃើញ `deletedItems` ទាំងស្រុង ដែលជាអ្វីដែលការការពារ
// ដែលងាប់នេះគួរតែរង់ចាំ។
//
// ឧបករណ៍នេះពិនិត្យ **២ ទិស**៖
//   ១. ស្តាទិច ៖ រាល់ `<set>.has('<literal>')` ត្រូវប្រើកូនសោដែល `<set>.add(...)`
//      ពិតជាដាក់ចូលកន្លែងណាមួយក្នុងឯកសារ។ នេះជាថ្នាក់ទូទៅ មិនមែនត្រឹមករណីនេះ។
//   ២. ឥរិយាបថ ៖ រត់ `dropStaleRestoreMarkers()` **ពិត** ក្នុង `vm` ខណៈ
//      snapshot ធុងសំរាមមិនទាន់មកដល់ ហើយអះអាងថាវា **មិនប៉ះ** marker។
//      ការអះអាងទិសផ្ទុយក៏ត្រូវមានដែរ (marker ងាប់ពិត ➜ ត្រូវលុប) បើមិនដូច្នេះ
//      ការ «ការពារគ្រប់ពេល» នឹងបៃតងដោយខុស។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let acorn;
try { acorn = require('acorn'); } catch (e) {
    console.log('SKIP — ត្រូវការ acorn (npm i acorn)');
    process.exit(0);
}

const ROOT = process.env.PENDINGKEY_APP_DIR ? path.resolve(process.env.PENDINGKEY_APP_DIR) : path.resolve(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function walk(node, visit) {
    if (!node || typeof node.type !== 'string') return;
    visit(node);
    for (const key in node) {
        if (key === 'loc' || key === 'start' || key === 'end') continue;
        const value = node[key];
        if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
        else if (value && typeof value.type === 'string') walk(value, visit);
    }
}

// ── ១. ស្តាទិច ៖ កូនសោដែលសួរ ត្រូវជាកូនសោដែលដាក់ចូល ────────────────────
let scannedFiles = 0;
let hasCalls = 0;
const orphans = [];

APPS.forEach((app) => {
    const file = path.join(ROOT, app, 'app.js');
    if (!fs.existsSync(file)) return;
    scannedFiles++;
    const src = fs.readFileSync(file, 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 2022, locations: true });

    const added = {};
    const dynamic = new Set();
    const queried = [];
    const guardQueries = [];

    function noteAdd(owner, arg, resolveParams) {
        if (arg && arg.type === 'Literal' && typeof arg.value === 'string') {
            (added[owner] = added[owner] || new Set()).add(arg.value);
            return;
        }
        if (arg && arg.type === 'Identifier' && resolveParams && resolveParams.has(arg.name)) {
            const set = (added[owner] = added[owner] || new Set());
            resolveParams.get(arg.name).forEach((v) => set.add(v));
            return;
        }
        dynamic.add(owner);
    }

    // `const KEYS = ['a','b'];` — ដើម្បីដោះស្រាយ `KEYS.forEach(...)` ខាងក្រោម
    const constArrays = {};
    walk(ast, (node) => {
        if (node.type !== 'VariableDeclarator' || !node.id || node.id.type !== 'Identifier') return;
        const init = node.init;
        if (!init || init.type !== 'ArrayExpression' || !init.elements.length) return;
        const vals = init.elements
            .filter((el) => el && el.type === 'Literal' && typeof el.value === 'string')
            .map((el) => el.value);
        if (vals.length === init.elements.length) constArrays[node.id.name] = vals;
    });

    // `['a','b'].forEach((k) => set.add(k))` និង `KEYS.forEach((k) => set.add(k))`
    walk(ast, (node) => {
        if (node.type !== 'CallExpression') return;
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        if (callee.property.name !== 'forEach') return;
        let values = null;
        if (callee.object.type === 'ArrayExpression') {
            const els = callee.object.elements;
            const v = els.filter((el) => el && el.type === 'Literal' && typeof el.value === 'string').map((el) => el.value);
            if (v.length === els.length) values = v;
        } else if (callee.object.type === 'Identifier' && constArrays[callee.object.name]) {
            values = constArrays[callee.object.name];
        }
        if (!values || !values.length) return;
        const cb = node.arguments[0];
        if (!cb || (cb.type !== 'ArrowFunctionExpression' && cb.type !== 'FunctionExpression')) return;
        const params = new Map();
        if (cb.params[0] && cb.params[0].type === 'Identifier') params.set(cb.params[0].name, values);
        walk(cb.body, (inner) => {
            if (inner.type !== 'CallExpression') return;
            const c = inner.callee;
            if (c.type !== 'MemberExpression' || c.computed) return;
            if (c.property.name !== 'add' || c.object.type !== 'Identifier') return;
            noteAdd(c.object.name, inner.arguments[0], params);
            inner.__resolvedAdd = true;
        });
    });

    walk(ast, (node) => {
        if (node.type !== 'CallExpression') return;
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        const owner = callee.object.type === 'Identifier' ? callee.object.name : null;
        if (!owner) return;
        const method = callee.property.name;
        const arg = node.arguments[0];
        if (method === 'add' && !node.__resolvedAdd) { noteAdd(owner, arg, null); return; }
        if (method === 'has') {
            queried.push({
                owner,
                key: (arg && arg.type === 'Literal' && typeof arg.value === 'string') ? arg.value : null,
                line: node.loc.start.line
            });
        }
    });

    // ⛔ **ការសួរដែលរស់នៅក្រោយ helper ចែករំលែក** (កំណែ 2.20.8)។
    // ការកែត្រឹមត្រូវនៃថ្នាក់កំហុសនេះគឺការប្រមូលការសួរទៅក្នុង helper **តែមួយ**
    // (`dbListenerViewIsStale(key)`) ➜ កន្លែងហៅលែងជា `<set>.has(<literal>)`
    // ទៀតទេ។ ការរាប់តែទម្រង់ចាស់នឹងធ្វើឲ្យជាន់អប្បបរមាធ្លាក់ **ដោយសារការកែ**
    // ហើយបង្ខំឲ្យជុំក្រោយបន្ធូរវាចោល — នោះជាការធ្វើឲ្យការការពារងាប់។
    // ដូច្នេះ៖ រកឈ្មោះ function ណាដែល **តួរបស់វាសួរ `.has()` លើ Set ដែល
    // ស្គាល់កូនសោ** រួចរាប់ **កន្លែងហៅវា** ជាការសួរដែរ ហើយពិនិត្យកូនសោ
    // (ថេរ `const X = '…'`) ដូចគ្នា។
    const constStrings = {};
    walk(ast, (node) => {
        if (node.type !== 'VariableDeclarator' || !node.id || node.id.type !== 'Identifier') return;
        if (node.init && node.init.type === 'Literal' && typeof node.init.value === 'string') {
            constStrings[node.id.name] = node.init.value;
        }
    });
    const guardFns = new Set();
    walk(ast, (node) => {
        if (node.type !== 'FunctionDeclaration' || !node.id) return;
        let delegates = false;
        walk(node.body, (inner) => {
            if (inner.type !== 'CallExpression') return;
            const c = inner.callee;
            if (c.type !== 'MemberExpression' || c.computed) return;
            if (c.property.name !== 'has' || c.object.type !== 'Identifier') return;
            if (!added[c.object.name] || !added[c.object.name].size) return;
            delegates = true;
        });
        if (delegates) guardFns.add(node.id.name);
    });
    walk(ast, (node) => {
        if (node.type !== 'CallExpression') return;
        if (node.callee.type !== 'Identifier' || !guardFns.has(node.callee.name)) return;
        const arg = node.arguments[0];
        let key = null;
        if (arg && arg.type === 'Literal' && typeof arg.value === 'string') key = arg.value;
        else if (arg && arg.type === 'Identifier' && constStrings[arg.name] !== undefined) key = constStrings[arg.name];
        else return;                       // អាគុយម៉ង់ថាមវន្ត ➜ រំលង (កុំចោទខុស)
        guardQueries.push({ key, line: node.loc.start.line, via: node.callee.name });
    });

    queried.forEach((q) => {
        const known = added[q.owner];
        if (!known || !known.size) return;
        if (dynamic.has(q.owner)) return;
        hasCalls++;
        if (q.key === null) return;
        if (!known.has(q.key)) {
            orphans.push(app + '/app.js:' + q.line + '  ' + q.owner + ".has('" + q.key + "')  ⟶ កូនសោដែលដាក់ចូលពិត៖ "
                + JSON.stringify([...known]));
        }
    });

    // កូនសោដែលហៅតាម helper ត្រូវជាសមាជិកនៃ Set **ណាមួយ** ដែល helper នោះសួរ
    const allKnown = new Set();
    Object.keys(added).forEach((owner) => {
        if (dynamic.has(owner)) return;
        added[owner].forEach((k) => allKnown.add(k));
    });
    guardQueries.forEach((q) => {
        if (!allKnown.size) return;
        hasCalls++;
        if (!allKnown.has(q.key)) {
            orphans.push(app + '/app.js:' + q.line + '  ' + q.via + "('" + q.key + "')  ⟶ កូនសោដែលដាក់ចូលពិត៖ "
                + JSON.stringify([...allKnown]));
        }
    });
});

ok('ស្កេនឯកសារ App យ៉ាងតិច ១ (ជាន់អប្បបរមា — ថតទទេត្រូវធ្លាក់)', scannedFiles >= 1, scannedFiles);
// ជាន់អប្បបរមារាប់ការហៅ `.has()` **ទាំងអស់** លើ Set ដែលស្គាល់កូនសោ — មិនមែន
// តែទម្រង់ literal ទេ។ ហេតុផល៖ ការកែត្រឹមត្រូវនៃថ្នាក់កំហុសនេះគឺការប្តូរ
// literal ទៅជាថេរដែលចែករំលែក ➜ ជាន់អប្បបរមាដែលរាប់តែ literal នឹងធ្លាក់
// **ដោយសារការកែ** ហើយបង្ខំឲ្យជុំក្រោយបន្ធូរវាចោល។
ok('រកឃើញការសួរកូនសោ (`<set>.has(...)` ឬតាម helper) យ៉ាងតិច ២ កន្លែង (ជាន់អប្បបរមា)', hasCalls >= 2, hasCalls);
ok('គ្មានកូនសោកំព្រា — រាល់ `.has(k)` ប្រើកូនសោដែល `.add(k)` ដាក់ចូលពិត',
    orphans.length === 0, orphans);

// ── ២. ឥរិយាបថ ៖ រត់ `dropStaleRestoreMarkers()` ពិត ────────────────────
const APP = path.join(ROOT, 'ZoeW', 'app.js');
const SRC = fs.existsSync(APP) ? fs.readFileSync(APP, 'utf8') : '';

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

const PENDING_KEYS_RE = /const DB_LISTENER_KEYS = \[('[a-zA-Z]+'(?:\s*,\s*'[a-zA-Z]+')*)\];|\[('[a-zA-Z]+'(?:\s*,\s*'[a-zA-Z]+')*)\]\s*\n?\s*\.forEach\(\(key\) => dbListenerPendingPaths\.add\(key\)\)/;
const keysMatch = SRC.match(PENDING_KEYS_RE);
const pendingKeys = keysMatch ? (keysMatch[1] || keysMatch[2] || '').split(',').map((s) => s.trim().replace(/'/g, '')) : [];
ok('រកឃើញបញ្ជីកូនសោដែល initDatabaseListeners() ដាក់ចូល (ជាន់អប្បបរមា ៦)', pendingKeys.length >= 6, pendingKeys);

const deletedKeyMatch = SRC.match(/const DB_LISTENER_KEY_DELETED = '([^']+)';/);
const DELETED_KEY_IN_CODE = deletedKeyMatch ? deletedKeyMatch[1] : '__មិនបានប្រកាស__';
ok('រកឃើញការប្រកាស DB_LISTENER_KEY_DELETED ក្នុងកូដពិត', !!deletedKeyMatch, DELETED_KEY_IN_CODE);

// ------------------------------------------------------------------
// ⛔ ការពង្រីកច្បាប់ដដែល ៖ «កូនសោដែលសួរ ↔ កូនសោដែលដាក់ចូល» មិនគ្រាន់តែទាមទារ
// ថាកូនសោ *មាន* ក្នុង Set ទេ — វាទាមទារថា listener នីមួយៗរាយការណ៍ **កូនសោ
// របស់ខ្លួន**។ បើ callback របស់ listener មួយបញ្ជូនកូនសោ **របស់បងប្អូន** នោះ
// ៖ (១) ការងាប់របស់វាមិនដែលចុះក្នុង `dbListenerFailedPaths` ➜ រាល់ការការពារ
// ដែលសួរ `dbListenerViewIsStale(<កូនសោនោះ>)` **ងាប់ស្ងាត់ៗ**; (២) បងប្អូន
// ត្រូវប្រកាសជា «ងាប់» ឬ «សះស្បើយ» ជំនួសវា។ វាស់បាន ៖ mutation ដែលប្តូរ
// `handleDbListenerError(err, DB_LISTENER_KEY_DAILY_REVENUE)` ➜ `'exchangeRate'`
// **រស់រាន** លើ checker ១៥៨ ទាំងអស់មុនពេលបន្ថែមការអះអាងនេះ។
{
    const initFn = sliceFn('initDatabaseListeners') || '';
    const refsBlock = /listenerRefs\s*=\s*\{([\s\S]*?)\}/.exec(initFn);
    const refToKey = {};
    if (refsBlock) {
        refsBlock[1].split(',').forEach((pair) => {
            const m = /^\s*([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)\s*$/.exec(pair);
            if (m) refToKey[m[2]] = m[1];
        });
    }
    ok('រកឃើញផែនទី listenerRefs ➜ កូនសោ (យ៉ាងតិច ៦)',
        Object.keys(refToKey).length >= 6, refToKey);

    // ថេរកូនសោ ៖ `const DB_LISTENER_KEY_X = 'y';` ➜ ដោះស្រាយទៅតម្លៃពិត
    const constKeys = {};
    const constRe = /const\s+(DB_LISTENER_KEY_[A-Z_]+)\s*=\s*'([^']+)';/g;
    let cm;
    while ((cm = constRe.exec(SRC)) !== null) constKeys[cm[1]] = cm[2];
    const resolveKey = (raw) => {
        const t = String(raw).trim();
        const lit = /^'([^']*)'$/.exec(t) || /^"([^"]*)"$/.exec(t);
        if (lit) return lit[1];
        return Object.prototype.hasOwnProperty.call(constKeys, t) ? constKeys[t] : null;
    };

    // ចែកតួ initDatabaseListeners ជាប្លុកក្នុងមួយ listener តាម `fb.onValue(<ref>`
    const calls = [];
    const onValueRe = /fb\.onValue\(\s*([A-Za-z_$][\w$]*)\s*,/g;
    let om;
    while ((om = onValueRe.exec(initFn)) !== null) calls.push({ ref: om[1], at: om.index });
    calls.forEach((c, i) => { c.body = initFn.slice(c.at, i + 1 < calls.length ? calls[i + 1].at : initFn.length); });

    ok('⛔ ជាន់អប្បបរមា៖ រកឃើញ listener យ៉ាងតិច ៦ ក្នុង initDatabaseListeners()',
        calls.length >= 6, calls.length);

    const wrong = [];
    let checkedAlive = 0, checkedErr = 0;
    calls.forEach((c) => {
        const want = refToKey[c.ref];
        if (!want) return;
        const alive = /noteDbListenerAlive\(\s*([^)]*?)\s*\)/.exec(c.body);
        const err = /handleDbListenerError\(\s*err\s*,\s*([^)]*?)\s*\)/.exec(c.body);
        if (alive) {
            checkedAlive++;
            if (resolveKey(alive[1]) !== want) wrong.push(c.ref + ' ➜ noteDbListenerAlive(' + alive[1] + ') តែរំពឹង \'' + want + '\'');
        }
        if (err) {
            checkedErr++;
            if (resolveKey(err[1]) !== want) wrong.push(c.ref + ' ➜ handleDbListenerError(err, ' + err[1] + ') តែរំពឹង \'' + want + '\'');
        }
    });
    ok('⛔ ជាន់អប្បបរមា៖ វាស់ការហៅ noteDbListenerAlive យ៉ាងតិច ៦ និង handleDbListenerError យ៉ាងតិច ៦',
        checkedAlive >= 6 && checkedErr >= 6, 'alive=' + checkedAlive + ' err=' + checkedErr);
    ok('⛔ listener នីមួយៗត្រូវរាយការណ៍ **កូនសោរបស់ខ្លួន** (មិនមែនកូនសោបងប្អូន)',
        wrong.length === 0, wrong.join(' · '));

    // ⛔ ទិសផ្ទុយ ៖ កូនសោដែលរាយការណ៍ ត្រូវជាសមាជិកនៃ DB_LISTENER_KEYS ពិត
    const reported = [];
    calls.forEach((c) => {
        const err = /handleDbListenerError\(\s*err\s*,\s*([^)]*?)\s*\)/.exec(c.body);
        if (err) { const k = resolveKey(err[1]); if (k) reported.push(k); }
    });
    ok('⛔ ទិសផ្ទុយ៖ រាល់កូនសោដែល listener រាយការណ៍ ស្ថិតក្នុង DB_LISTENER_KEYS',
        reported.length >= 6 && reported.every((k) => pendingKeys.indexOf(k) !== -1),
        'រាយការណ៍=' + reported.join(',') + ' · បញ្ជី=' + pendingKeys.join(','));
}

const dropFn = sliceFn('dropStaleRestoreMarkers');
const hasMarkersFn = sliceFn('itemHasRestoreMarkers');
ok('រកឃើញ dropStaleRestoreMarkers និង itemHasRestoreMarkers', !!dropFn && !!hasMarkersFn);

async function runDrop(opts) {
    const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const operations = new Set();
    const reads = [];
    const transactions = [];
    let serverItem = clone(opts.item);
    const defer = (operation) => {
        const pending = new Promise((resolve, reject) => setTimeout(() => {
            try { resolve(operation()); } catch (error) { reject(error); }
        }, 0));
        operations.add(pending);
        pending.then(() => operations.delete(pending), () => operations.delete(pending));
        return pending;
    };
    const fb = {
        ref: (_, node) => ({ path: node }),
        get: (ref) => defer(() => {
            reads.push(ref.path);
            if (opts.sourceReadFails) throw new Error('SOURCE_READ_UNAVAILABLE');
            const sources = opts.serverItems || opts.deletedItems;
            const id = ref.path.split('/').pop();
            const source = sources.find((item) => item && item.id === id) || null;
            return { exists: () => source !== null, val: () => clone(source) };
        }),
        runTransaction: (ref, updater) => defer(() => {
            transactions.push(ref.path);
            if (ref.path !== 'zoew_scan_history_cod_dod/' + opts.item.id) throw new Error('WRONG_HISTORY_TRANSACTION_PATH');
            const result = updater(clone(serverItem));
            if (result !== undefined) serverItem = clone(result);
            return { committed: result !== undefined, snapshot: { val: () => clone(serverItem) } };
        })
    };
    const sandbox = {
        console: { error() {} }, Set, Map, Date, JSON, Object, Array, String, Number, Boolean,
        setTimeout, clearTimeout, db: {}, fb, window: {}, getServerNow: () => Date.now(),
        DB_OP_TIMEOUT_MS: 1000, RESTORE_CLAIM_LEASE_MS: 120000,
        staleRestoreMarkerSweeps: new Set(),
        dbListenerPendingPaths: new Set(opts.pending),
        // ⛔ ទិដ្ឋភាព `deleted` មិនគួរទុកចិត្ត = «មិនទាន់មកដល់» **ឬ**
        // «listener ងាប់» (កំណែ 2.20.8) ➜ sandbox ត្រូវមាន Set ទាំង ២។
        dbListenerFailedPaths: new Set(opts.failed || []), dbListenerReportedFailures: new Set(),
        deletedItems: opts.deletedItems,
        activeRestoreClaims: new Map((opts.activeClaims || []).map((id) => [id, {}]))
    };
    const ctx = vm.createContext(sandbox);
    // ⛔ កូនសោនេះត្រូវយកចេញពី **កូដពិត** — បើយកតម្លៃដោយដៃ នោះតេស្តនឹងបៃតង
    // ទោះ `app.js` សរសេរកូនសោខុសក៏ដោយ (នោះជាបញ្ហាដែលឯកសារនេះដេញតាម)។
    vm.runInContext('const DB_LISTENER_KEY_DELETED = ' + JSON.stringify(DELETED_KEY_IN_CODE) + ';', ctx);
    const dependencyNames = ['itemHasRestoreMarkers', 'dbListenerViewIsStale', 'clearStaleRestoreMarkers',
        'isActiveRestoreClaim', 'dbOp', 'dbOpStalled', 'withTimeout', 'dropStaleRestoreMarkers'];
    const dependencies = dependencyNames.map((name) => {
        const source = sliceFn(name);
        if (!source) throw new Error('Function ពិតបាត់៖ ' + name);
        return source;
    });
    vm.runInContext(dependencies.join('\n'), ctx);
    sandbox.__item = clone(opts.item);
    const dropped = vm.runInContext('dropStaleRestoreMarkers(__item)', ctx);
    for (let round = 0; round < 100; round++) {
        await Promise.allSettled(Array.from(operations));
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (!operations.size && !sandbox.staleRestoreMarkerSweeps.size) break;
    }
    if (operations.size || sandbox.staleRestoreMarkerSweeps.size) throw new Error('ការសម្អាត marker មិនចប់');
    return { dropped, item: dropped ? sandbox.__item : serverItem, localItem: sandbox.__item, serverItem, reads, transactions };
}

// កូនសោដែលកូដពិតដាក់ចូលសម្រាប់ node ធុងសំរាម
ok('⛔ កូនសោការការពារ ត្រូវជាសមាជិកនៃបញ្ជីដែលដាក់ចូល Set ពិត',
    pendingKeys.indexOf(DELETED_KEY_IN_CODE) !== -1,
    { guard: DELETED_KEY_IN_CODE, inserted: pendingKeys });
const TRASH_KEY = DELETED_KEY_IN_CODE;

async function runBehaviorChecks() {
// ២ក. snapshot ធុងសំរាមមិនទាន់មក ➜ **ត្រូវរង់ចាំ** មិនត្រូវលុប marker
{
    const r = await runDrop({
        pending: [TRASH_KEY],
        deletedItems: [],
        item: { id: 'id_1', restoreClaimId: 'trash_1', restoreClaimToken: 'tok_abc' }
    });
    ok('⛔ snapshot ធុងសំរាមមិនទាន់មក ➜ marker របស់ការស្តារឆ្លងឧបករណ៍ **មិនត្រូវលុប**',
        r.dropped === false && r.item.restoreClaimToken === 'tok_abc' && !r.reads.length && !r.transactions.length, r);
}

// ២ខ. snapshot មកគ្រប់ហើយ ហើយ claim នៅរស់ ➜ ក៏មិនត្រូវលុបដែរ
{
    const r = await runDrop({
        pending: [],
        deletedItems: [{ id: 'trash_1', restoreClaim: { token: 'tok_abc', claimedAt: Date.now() } }],
        item: { id: 'id_1', restoreClaimId: 'trash_1', restoreClaimToken: 'tok_abc' }
    });
    ok('claim នៅរស់ ➜ marker មិនត្រូវលុប', r.dropped === false && r.item.restoreClaimToken === 'tok_abc' && !r.transactions.length, r);
}

// ២គ. ទិសផ្ទុយ ៖ snapshot មកគ្រប់ ហើយប្រភពលែងមាន ➜ marker **ងាប់ពិត** ➜ ត្រូវលុប
//     បើអត់ការអះអាងនេះ ការ «រង់ចាំគ្រប់ពេល» នឹងបៃតងដោយខុស ហើយ marker ងាប់
//     នឹងជាប់ជារៀងរហូត (ថ្នាក់កំហុសផ្ទុយពីខាងលើ)។
{
    const r = await runDrop({
        pending: [],
        deletedItems: [],
        item: { id: 'id_1', restoreClaimId: 'trash_gone', restoreClaimToken: 'tok_old' }
    });
    ok('⛔ ទិសផ្ទុយ ៖ snapshot មកគ្រប់ + ប្រភពលែងមាន ➜ marker ងាប់ **ត្រូវលុប**',
        r.item.restoreClaimToken === undefined && r.item.restoreClaimId === undefined, r);
    ok('marker ងាប់ត្រូវកែតាម return synchronous ចាស់ ឬ transaction async ពិត',
        r.dropped === true || (r.reads[0] === 'zoew_recently_deleted_cod_dod/trash_gone' && r.transactions.length === 1 && !r.serverItem.restoreClaimToken), r);
}

// ២ឃ. path ផ្សេងនៅរង់ចាំ តែធុងសំរាមមកដល់ហើយ ➜ មិនត្រូវទប់ការសម្អាត marker ងាប់
{
    const otherKey = pendingKeys.find((k) => k !== TRASH_KEY) || 'history';
    const r = await runDrop({
        pending: [otherKey],
        deletedItems: [],
        item: { id: 'id_1', restoreClaimId: 'trash_gone', restoreClaimToken: 'tok_old' }
    });
    ok('path ផ្សេងរង់ចាំ តែធុងសំរាមមកដល់ ➜ marker ងាប់នៅតែត្រូវលុប',
        r.item.restoreClaimToken === undefined && r.item.restoreClaimId === undefined, r);
}

// ២ង. ⛔ **listener `deleted` ងាប់** ➜ ទិដ្ឋភាពកក ➜ marker មិនត្រូវលុប
//
// 🔴 នេះជាចន្លោះដែលកំណែ 2.20.8 បិទ។ កូនសោ `deleted` ត្រូវលុបចេញពី
// `dbListenerPendingPaths` តាំងពី snapshot **ដំបូង** ➜ ពេល listener នោះ
// ងាប់ **ក្រោយមក** នោះ pending នៅតែទទេ ➜ ច្រកទ្វារចាស់ **បើកចំហលើ
// `deletedItems` ដែលកក** ➜ marker របស់ឧបករណ៍ **ផ្សេង** ដែលកំពុងស្តារ
// ត្រូវលុប ➜ `permission_denied` ➜ «ដក»/«លុប» ស្លាប់ជារៀងរហូត។
{
    const r = await runDrop({
        pending: [],
        failed: [TRASH_KEY],
        deletedItems: [],
        item: { id: 'id_1', restoreClaimId: 'trash_1', restoreClaimToken: 'tok_abc' }
    });
    ok('⛔ listener `deleted` ងាប់ (pending ទទេ) ➜ marker **មិនត្រូវលុប**',
        r.dropped === false && r.item.restoreClaimId === 'trash_1' && !r.reads.length && !r.transactions.length, r);
}

// ⛔ ទិសផ្ទុយ ៖ គ្មាន pending ហើយក៏គ្មានការងាប់ ➜ marker ងាប់ត្រូវលុបដដែល
{
    const r = await runDrop({
        pending: [],
        failed: [],
        deletedItems: [],
        item: { id: 'id_1', restoreClaimId: 'trash_gone', restoreClaimToken: 'tok_old' }
    });
    ok('⛔ ទិសផ្ទុយ ៖ listener ទាំងអស់រស់ ➜ marker ងាប់នៅតែត្រូវលុប',
        r.item.restoreClaimToken === undefined && r.item.restoreClaimId === undefined, r);
}

{
    const r = await runDrop({ pending: [], deletedItems: [], activeClaims: ['trash_1'],
        item: { id: 'id_1', restoreClaimId: 'trash_1', restoreClaimToken: 'tok_abc' } });
    ok('claim របស់ឧបករណ៍នេះកំពុងស្តារ ➜ marker នៅគ្រប់',
        r.dropped === false && r.item.restoreClaimToken === 'tok_abc' && !r.transactions.length, r);
}
{
    const r = await runDrop({ pending: [], deletedItems: [],
        serverItems: [{ id: 'trash_1', restoreClaim: { token: 'tok_abc', claimedAt: Date.now() } }],
        item: { id: 'id_1', restoreClaimId: 'trash_1', restoreClaimToken: 'tok_abc' } });
    ok('snapshot ក្នុងម៉ាស៊ីនខ្វះប្រភព តែ server claim រស់ ➜ marker មិនត្រូវលុប',
        r.dropped === false && r.item.restoreClaimToken === 'tok_abc' && r.reads.length === 1 && !r.transactions.length, r);
}
{
    const r = await runDrop({ pending: [], deletedItems: [], sourceReadFails: true,
        item: { id: 'id_1', restoreClaimId: 'trash_1', restoreClaimToken: 'tok_abc' } });
    ok('អានប្រភព server បរាជ័យ ➜ marker ត្រូវរក្សា និងមិនចាប់ transaction',
        r.dropped === false && r.item.restoreClaimToken === 'tok_abc' && r.reads.length === 1 && !r.transactions.length, r);
}
}

runBehaviorChecks().then(() => {
console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
}, (error) => { console.error(error.stack || error); process.exit(1); });
