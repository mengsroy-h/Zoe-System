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
const APPS = ['ZoeW', 'ZoeKeyGen', 'ZoeImport'];

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
});

ok('ស្កេនឯកសារ App យ៉ាងតិច ១ (ជាន់អប្បបរមា — ថតទទេត្រូវធ្លាក់)', scannedFiles >= 1, scannedFiles);
// ជាន់អប្បបរមារាប់ការហៅ `.has()` **ទាំងអស់** លើ Set ដែលស្គាល់កូនសោ — មិនមែន
// តែទម្រង់ literal ទេ។ ហេតុផល៖ ការកែត្រឹមត្រូវនៃថ្នាក់កំហុសនេះគឺការប្តូរ
// literal ទៅជាថេរដែលចែករំលែក ➜ ជាន់អប្បបរមាដែលរាប់តែ literal នឹងធ្លាក់
// **ដោយសារការកែ** ហើយបង្ខំឲ្យជុំក្រោយបន្ធូរវាចោល។
ok('រកឃើញការសួរ `<set>.has(...)` យ៉ាងតិច ២ កន្លែង (ជាន់អប្បបរមា)', hasCalls >= 2, hasCalls);
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
ok('រកឃើញបញ្ជីកូនសោដែល initDatabaseListeners() ដាក់ចូល', pendingKeys.length === 6, pendingKeys);

const deletedKeyMatch = SRC.match(/const DB_LISTENER_KEY_DELETED = '([^']+)';/);
const DELETED_KEY_IN_CODE = deletedKeyMatch ? deletedKeyMatch[1] : '__មិនបានប្រកាស__';
ok('រកឃើញការប្រកាស DB_LISTENER_KEY_DELETED ក្នុងកូដពិត', !!deletedKeyMatch, DELETED_KEY_IN_CODE);

const dropFn = sliceFn('dropStaleRestoreMarkers');
const hasMarkersFn = sliceFn('itemHasRestoreMarkers');
ok('រកឃើញ dropStaleRestoreMarkers និង itemHasRestoreMarkers', !!dropFn && !!hasMarkersFn);

function runDrop(opts) {
    const sandbox = {
        console, Set, Date, JSON, Object, Array, String, Number, Boolean,
        dbListenerPendingPaths: new Set(opts.pending),
        deletedItems: opts.deletedItems,
        activeRestoreClaims: new Set(opts.activeClaims || []),
        isActiveRestoreClaim: (claim) => !!(claim && claim.token && (Date.now() - claim.at) < 120000)
    };
    const ctx = vm.createContext(sandbox);
    // ⛔ កូនសោនេះត្រូវយកចេញពី **កូដពិត** — បើយកតម្លៃដោយដៃ នោះតេស្តនឹងបៃតង
    // ទោះ `app.js` សរសេរកូនសោខុសក៏ដោយ (នោះជាបញ្ហាដែលឯកសារនេះដេញតាម)។
    vm.runInContext('const DB_LISTENER_KEY_DELETED = ' + JSON.stringify(DELETED_KEY_IN_CODE) + ';', ctx);
    vm.runInContext(hasMarkersFn || 'function itemHasRestoreMarkers(i){return !!(i&&(i.restoreClaimId!==undefined||i.restoreClaimToken!==undefined));}', ctx);
    vm.runInContext(dropFn || 'function dropStaleRestoreMarkers(){ return false; }', ctx);
    sandbox.__item = opts.item;
    const dropped = vm.runInContext('dropStaleRestoreMarkers(__item)', ctx);
    return { dropped, item: sandbox.__item };
}

// កូនសោដែលកូដពិតដាក់ចូលសម្រាប់ node ធុងសំរាម
ok('⛔ កូនសោការការពារ ត្រូវជាសមាជិកនៃបញ្ជីដែលដាក់ចូល Set ពិត',
    pendingKeys.indexOf(DELETED_KEY_IN_CODE) !== -1,
    { guard: DELETED_KEY_IN_CODE, inserted: pendingKeys });
const TRASH_KEY = DELETED_KEY_IN_CODE;

// ២ក. snapshot ធុងសំរាមមិនទាន់មក ➜ **ត្រូវរង់ចាំ** មិនត្រូវលុប marker
{
    const r = runDrop({
        pending: [TRASH_KEY],
        deletedItems: [],
        item: { id: 'id_1', restoreClaimId: 'trash_1', restoreClaimToken: 'tok_abc' }
    });
    ok('⛔ snapshot ធុងសំរាមមិនទាន់មក ➜ marker របស់ការស្តារឆ្លងឧបករណ៍ **មិនត្រូវលុប**',
        r.dropped === false && r.item.restoreClaimToken === 'tok_abc', r.item);
}

// ២ខ. snapshot មកគ្រប់ហើយ ហើយ claim នៅរស់ ➜ ក៏មិនត្រូវលុបដែរ
{
    const r = runDrop({
        pending: [],
        deletedItems: [{ id: 'trash_1', restoreClaim: { token: 'tok_abc', at: Date.now() } }],
        item: { id: 'id_1', restoreClaimId: 'trash_1', restoreClaimToken: 'tok_abc' }
    });
    ok('claim នៅរស់ ➜ marker មិនត្រូវលុប', r.dropped === false && r.item.restoreClaimToken === 'tok_abc', r.item);
}

// ២គ. ទិសផ្ទុយ ៖ snapshot មកគ្រប់ ហើយប្រភពលែងមាន ➜ marker **ងាប់ពិត** ➜ ត្រូវលុប
//     បើអត់ការអះអាងនេះ ការ «រង់ចាំគ្រប់ពេល» នឹងបៃតងដោយខុស ហើយ marker ងាប់
//     នឹងជាប់ជារៀងរហូត (ថ្នាក់កំហុសផ្ទុយពីខាងលើ)។
{
    const r = runDrop({
        pending: [],
        deletedItems: [],
        item: { id: 'id_1', restoreClaimId: 'trash_gone', restoreClaimToken: 'tok_old' }
    });
    ok('⛔ ទិសផ្ទុយ ៖ snapshot មកគ្រប់ + ប្រភពលែងមាន ➜ marker ងាប់ **ត្រូវលុប**',
        r.dropped === true && r.item.restoreClaimToken === undefined, r.item);
}

// ២ឃ. path ផ្សេងនៅរង់ចាំ តែធុងសំរាមមកដល់ហើយ ➜ មិនត្រូវទប់ការសម្អាត marker ងាប់
{
    const otherKey = pendingKeys.find((k) => k !== TRASH_KEY) || 'history';
    const r = runDrop({
        pending: [otherKey],
        deletedItems: [],
        item: { id: 'id_1', restoreClaimId: 'trash_gone', restoreClaimToken: 'tok_old' }
    });
    ok('path ផ្សេងរង់ចាំ តែធុងសំរាមមកដល់ ➜ marker ងាប់នៅតែត្រូវលុប',
        r.dropped === true, r.item);
}

console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
