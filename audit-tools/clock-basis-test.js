// ⛔ **អ្នកយាមនៃ *មូលដ្ឋាននាឡិកា* — ត្រាដែលវាស់ ត្រូវស្ថិតលើនាឡិកាដដែល។**
//
// 🔴 ហេតុអ្វីវាមាន (វាស់បាន 2026-09-10) ៖ `elapsedSince(mark)` គណនា
// **`Date.now() - mark`** — នាឡិកា **ឧបករណ៍**។ ត្រាដែលបោះដោយ
// **`getServerNow()`** គឺ `Date.now() + serverTimeOffsetMs` — នាឡិកា **server**។
// លាយ ២ មូលដ្ឋាននេះ ➜ `elapsedSince()` ត្រឡប់ **`Date.now() − Date.now() − offset`
// = `−offset`** ➜ អវិជ្ជមាន ➜ ច្បាប់ fail-open របស់វាបម្លែងទៅ **`Infinity`**។
//
// ផលពិត ៖ **ពិដានល្បឿនរលាយបាត់ទាំងស្រុង** ពេញរយៈពេលនៃ offset។ ឧបករណ៍
// ដែលនាឡិកា **យឺតជាង** server ៥ នាទី (ធម្មតាលើទូរស័ព្ទថោក និងក្រោយថ្មរលត់)
// ➜ `ztoStatusLastSweepAt` ➜ ច្រកទ្វារ ២ (`scheduleZtoStatusSweep` និង
// `runZtoStatusSweep`) **បើកចំហ ៥៧៩ វិនាទី ក្នុង ៦០០ វិនាទីដំបូង** ➜
// `renderHistory` ហៅ `scheduleZtoStatusSweep()` រាល់ការគូរ ➜ **១០ ការហៅ
// upstream រាល់ ១,៥ វិនាទី គ្មានទីបញ្ចប់** (ថ្នាក់ដដែលនឹង 2.31.9 តែធ្ងន់ជាង
// ១៣ ដង) ហើយ **ជណ្តើរ backoff (`ZTO_STATUS_FAIL_BACKOFF_MS`) ក៏ស្លាប់ដែរ** ៖
// វាត្រូវបានគណនា តែគ្មាននរណាអនុវត្តវា។
//
// ⛔ ថ្នាក់នេះ **checker ១៦៤ ទាំងអស់មើលមិនឃើញ** ៖ `clock-hygiene.js` សួរថា
// «តើ function នេះប៉ះ `Date.now()` ឆៅទេ?» — វា **មិនសួរបញ្ច្រាស** ថា «ត្រា
// ដែលវាស់ដោយនាឡិកាឧបករណ៍ ត្រូវបានបោះដោយនាឡិកាឧបករណ៍ដែរឬទេ?»។ ការប្រើ
// `getServerNow()` **មើលទៅដូចត្រឹមត្រូវជាង** ➜ នេះជាអន្ទាក់ដែលមើលទៅស្អាត។
//
// ច្បាប់ ៖ រាល់អថេរដែលឆ្លងកាត់ `elapsedSince()` ត្រូវបោះដោយ **`Date.now()`**។
// ត្រាដែលត្រូវការនាឡិកា server (retention · លុយ) **មិនត្រូវវាស់ដោយ
// `elapsedSince()`** ទេ — ពួកវាប្រៀបធៀបនឹង `getServerNow()` ដោយផ្ទាល់។

let acorn;
try { acorn = require('acorn'); } catch (e) {
    console.log('SKIP — ត្រូវការ acorn (npm i acorn)');
    process.exit(0);
}
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLOCKBASIS_APP_DIR || path.join(__dirname, '..');
const FILES = ['ZoeW/app.js', 'ZoeKeyGen/app.js'];

let pass = 0, fail = 0;
function ok(n) { console.log('  ok    ' + n); pass++; }
function bad(n, d) { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; }
function check(c, n, d) { c ? ok(n) : bad(n, d); }

// ត្រាដែលអនុញ្ញាតឲ្យបោះដោយ `getServerNow()` ទោះឆ្លងកាត់ `elapsedSince()` —
// ⛔ **រាល់ធាតុត្រូវមានហេតុផលពិត** ហើយបញ្ជីនេះត្រូវគ្មានធាតុងាប់។
const SERVER_BASIS_OK = {};

let scannedFiles = 0;
let totalMarks = 0;

for (const rel of FILES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    scannedFiles++;
    const code = fs.readFileSync(file, 'utf8');
    let ast;
    try { ast = acorn.parse(code, { ecmaVersion: 2022, locations: true }); }
    catch (e) { bad(rel + ': parse បរាជ័យ — ' + e.message); continue; }

    const serverStamped = new Map();   // name -> [lines]
    const dateStamped = new Set();
    const measured = new Map();        // name -> [lines]

    const isCall = (n, name) => n && n.type === 'CallExpression'
        && n.callee.type === 'Identifier' && n.callee.name === name;
    const isDateNow = (n) => n && n.type === 'CallExpression'
        && n.callee.type === 'MemberExpression'
        && n.callee.object.type === 'Identifier' && n.callee.object.name === 'Date'
        && n.callee.property.type === 'Identifier' && n.callee.property.name === 'now';

    (function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(walk); return; }

        // ការបោះត្រា ៖ `x = getServerNow()` ឬ `x = Date.now()` (រួម declarator)
        const record = (targetName, valueNode, line) => {
            if (!targetName || !valueNode) return;
            if (isCall(valueNode, 'getServerNow')) {
                if (!serverStamped.has(targetName)) serverStamped.set(targetName, []);
                serverStamped.get(targetName).push(line);
            } else if (isDateNow(valueNode)) {
                dateStamped.add(targetName);
            }
        };
        if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') {
            record(node.left.name, node.right, node.loc.start.line);
        }
        if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
            record(node.id.name, node.init, node.loc.start.line);
        }

        // ការវាស់ ៖ `elapsedSince(x)` ដែល x ជាឈ្មោះធម្មតា
        if (isCall(node, 'elapsedSince') && node.arguments[0]
            && node.arguments[0].type === 'Identifier') {
            const n = node.arguments[0].name;
            if (!measured.has(n)) measured.set(n, []);
            measured.get(n).push(node.loc.start.line);
        }

        for (const k of Object.keys(node)) {
            if (k === 'loc' || k === 'start' || k === 'end') continue;
            const v = node[k];
            if (Array.isArray(v)) v.forEach(walk);
            else if (v && typeof v.type === 'string') walk(v);
        }
    })(ast);

    const offenders = [];
    for (const [name, lines] of measured) {
        if (!serverStamped.has(name)) continue;
        if (Object.prototype.hasOwnProperty.call(SERVER_BASIS_OK, name)) continue;
        offenders.push(rel + ': `' + name + '` បោះដោយ `getServerNow()` (បន្ទាត់ '
            + serverStamped.get(name).join(', ') + ') តែវាស់ដោយ `elapsedSince()` (បន្ទាត់ '
            + lines.join(', ') + ') ➜ `elapsedSince` ត្រឡប់ Infinity ➜ ពិដានល្បឿនរលាយ');
        totalMarks++;
    }

    check(offenders.length === 0,
        rel + ': រាល់ត្រាដែលវាស់ដោយ `elapsedSince()` បោះដោយ `Date.now()`',
        offenders.join('\n        '));

    // ជាន់អប្បបរមា ៖ ការស្កេនត្រូវពិតជាបានឃើញត្រា មិនមែនស្កេនអ្វីទទេ
    check(measured.size >= 5,
        rel + ': ការស្កេនឃើញត្រាដែលវាស់យ៉ាងតិច ៥ (ជាន់អប្បបរមា)',
        'ឃើញត្រឹម ' + measured.size + ' ➜ ការស្កេនប្រហែលរអិលចេញពីគោលដៅ');
    check(dateStamped.size >= 5,
        rel + ': ការស្កេនឃើញត្រា `Date.now()` យ៉ាងតិច ៥ (ជាន់អប្បបរមា)',
        'ឃើញត្រឹម ' + dateStamped.size);

    // ⛔ ទិសផ្ទុយ ៖ `elapsedSince` ត្រូវពិតជាឈរលើ `Date.now()` — បើថ្ងៃណា
    // វាប្តូរទៅ `getServerNow()` នោះច្បាប់ខាងលើត្រូវបញ្ច្រាសទាំងស្រុង។
    const m = /function elapsedSince\s*\([^)]*\)\s*\{[\s\S]{0,200}?\}/.exec(code);
    check(!!m && /Date\.now\(\)\s*-/.test(m[0]) && !/getServerNow\(\)/.test(m[0]),
        rel + ': `elapsedSince()` នៅតែឈរលើ `Date.now()` (មូលដ្ឋាននៃច្បាប់នេះ)',
        m ? m[0].slice(0, 160) : 'រក elapsedSince() មិនឃើញ');
}


// ============================================================================
// ផ្នែក ២ — ត្រាដែលរស់នៅជា **property** (ការស្កេន Identifier តែម្យ៉ាងខ្វះ)
// ============================================================================
//
// 🔴 ហេតុអ្វីវាត្រូវពង្រីក (វាស់បាន 2026-09-10) ៖ ការស្កេនផ្នែក ១ ទទួលតែ
// `elapsedSince(<Identifier>)` និងត្រាដែលបោះជា `x = getServerNow()`។ ត្រាពិត
// ២ រអិលកាត់វា ៖
//
//   `{ at: getServerNow() }`      ➜ `Property` មិនមែន Assignment ➜ មិនចុះជា serverStamped
//   `elapsedSince(parseFloat(item.deletedAt))` ➜ `CallExpression` មិនមែន Identifier
//
// ⛔ **មេរៀន** ៖ ការស្កេនតាម *រូបរាងវេយ្យាករណ៍តែមួយ* ខកខានពាក់កណ្តាល — ថ្នាក់
// ដដែលនឹង `code-duplication-test` (detector អក្សរចាប់បាន ៥/១១)។
//
// ច្បាប់ ៖ property ដែលឆ្លងកាត់ `elapsedSince()` ត្រូវបោះដោយ **`Date.now()`**។
// ⛔ ហើយឈ្មោះ property តែមួយ **មិនត្រូវផ្ទុកមូលដ្ឋាន ២** — នោះមានន័យថា
// អ្នកអានមិនអាចដឹងថាតម្លៃមកពីនាឡិកាណា ដោយមើលកន្លែងវាស់ទេ។

const propBasis = new Map();      // prop -> { server: [line], device: [line] }
const measuredProps = new Map();  // prop -> [line]

function noteBasis(prop, kind, line) {
    if (!prop) return;
    if (!propBasis.has(prop)) propBasis.set(prop, { server: [], device: [] });
    propBasis.get(prop)[kind].push(line);
}

for (const rel of FILES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    const code = fs.readFileSync(file, 'utf8');
    let ast;
    try { ast = acorn.parse(code, { ecmaVersion: 2022, locations: true }); } catch (e) { continue; }

    const isCall = (n, name) => n && n.type === 'CallExpression'
        && n.callee.type === 'Identifier' && n.callee.name === name;
    const isDateNow = (n) => n && n.type === 'CallExpression'
        && n.callee.type === 'MemberExpression'
        && n.callee.object.type === 'Identifier' && n.callee.object.name === 'Date'
        && n.callee.property.type === 'Identifier' && n.callee.property.name === 'now';

    // ឈ្មោះ property ទាំងអស់ដែលលេចក្នុងកន្សោមមួយ (មិនរាប់ computed)
    const propsIn = (node) => {
        const out = [];
        (function w(n) {
            if (!n || typeof n !== 'object') return;
            if (Array.isArray(n)) return n.forEach(w);
            if (n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier') out.push(n.property.name);
            for (const k of Object.keys(n)) {
                if (k === 'loc' || k === 'start' || k === 'end') continue;
                const v = n[k];
                if (Array.isArray(v)) v.forEach(w); else if (v && typeof v.type === 'string') w(v);
            }
        })(node);
        return out;
    };

    // ⛔ scope តាម function ៖ ឈ្មោះ `at` ក្នុង function មួយ មិនមែនឈ្មោះ `at`
    // របស់ function មួយទៀត ➜ ការភ្ជាប់ឆ្លង scope នឹងបង្កើតរបាយការណ៍ក្លែងក្លាយ។
    (function walk(node, scope) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach((n) => walk(n, scope));

        const isFn = node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression'
            || node.type === 'ArrowFunctionExpression';
        const here = isFn ? new Map(scope) : scope;

        // ការបោះត្រាជា property ៖ `{ P: getServerNow() }` និង `x.P = getServerNow()`
        if (node.type === 'Property' && !node.computed && node.key
            && (node.key.name || node.key.value) !== undefined) {
            const k = node.key.name || String(node.key.value);
            if (isCall(node.value, 'getServerNow')) noteBasis(k, 'server', node.loc.start.line);
            else if (isDateNow(node.value)) noteBasis(k, 'device', node.loc.start.line);
        }
        if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression'
            && !node.left.computed && node.left.property.type === 'Identifier') {
            const k = node.left.property.name;
            if (isCall(node.right, 'getServerNow')) noteBasis(k, 'server', node.loc.start.line);
            else if (isDateNow(node.right)) noteBasis(k, 'device', node.loc.start.line);
        }

        // លំហូរ ១ ជាន់ ៖ `const v = <កន្សោមដែលមាន .P>` ➜ v ចង់សំដៅ P
        if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
            const ps = propsIn(node.init);
            if (ps.length) here.set(node.id.name, ps);
        }

        // ការវាស់ ៖ property ដែលលេចក្នុងអាគុយម៉ង់ ឬតាមរយៈអថេរក្នុង scope
        if (isCall(node, 'elapsedSince') && node.arguments[0]) {
            const arg = node.arguments[0];
            let hits = propsIn(arg);
            if (!hits.length && arg.type === 'Identifier' && here.has(arg.name)) hits = here.get(arg.name);
            for (const pn of hits) {
                if (!measuredProps.has(pn)) measuredProps.set(pn, []);
                measuredProps.get(pn).push(rel + ':' + node.loc.start.line);
            }
        }

        for (const k of Object.keys(node)) {
            if (k === 'loc' || k === 'start' || k === 'end') continue;
            const v = node[k];
            if (Array.isArray(v)) v.forEach((n) => walk(n, here));
            else if (v && typeof v.type === 'string') walk(v, here);
        }
    })(ast, new Map());
}

const propOffenders = [];
let deviceOnlyMeasured = 0;
for (const [prop, sites] of measuredProps) {
    const b = propBasis.get(prop);
    if (!b) continue;
    if (b.server.length && b.device.length) {
        propOffenders.push('`.' + prop + '` ផ្ទុក **មូលដ្ឋាន ២** ៖ getServerNow() បន្ទាត់ '
            + b.server.join(', ') + ' · Date.now() បន្ទាត់ ' + b.device.join(', ')
            + ' ➜ វាស់ដោយ elapsedSince() នៅ ' + sites.join(', ')
            + ' ➜ កន្លែងវាស់មិនអាចដឹងថាតម្លៃមកពីនាឡិកាណា');
    } else if (b.server.length) {
        propOffenders.push('`.' + prop + '` បោះដោយ `getServerNow()` (បន្ទាត់ ' + b.server.join(', ')
            + ') តែវាស់ដោយ `elapsedSince()` នៅ ' + sites.join(', ')
            + ' ➜ elapsedSince ត្រឡប់ Infinity ➜ ការសម្រេចរលាយ');
    } else {
        deviceOnlyMeasured++;
    }
}

check(propOffenders.length === 0,
    '⛔ ត្រាដែលរស់នៅជា property ហើយវាស់ដោយ `elapsedSince()` ឈរលើ `Date.now()`',
    propOffenders.join('\n        '));

// ជាន់អប្បបរមា ៖ ការស្កេន property ត្រូវពិតជាបានឃើញអ្វីមួយ
check(propBasis.size >= 5, 'ជាន់អប្បបរមា ៖ ឃើញ property ដែលបោះដោយនាឡិកា យ៉ាងតិច ៥',
    'ឃើញ ' + propBasis.size);
check(measuredProps.size >= 2, 'ជាន់អប្បបរមា ៖ ឃើញ property ដែលវាស់ យ៉ាងតិច ២',
    'ឃើញ ' + measuredProps.size);
// ⛔ ទិសផ្ទុយ ៖ ច្បាប់នេះត្រូវ **អនុញ្ញាត** លំនាំត្រឹមត្រូវ — បើវាបដិសេធ
// គ្រប់ property នោះវាជាទោស មិនមែនការការពារ។
check(deviceOnlyMeasured >= 1,
    '⛔ ទិសផ្ទុយ ៖ property ដែលបោះដោយ `Date.now()` ហើយវាស់ដោយ `elapsedSince()` ត្រូវ**ឆ្លងកាត់**',
    'រកមិនឃើញលំនាំត្រឹមត្រូវសោះ ➜ ការស្កេនប្រហែលរអិលចេញពីគោលដៅ');

check(scannedFiles >= 2, 'ស្កេនឯកសារ App ទាំង ២ (ជាន់អប្បបរមា)', 'ស្កេនបាន ' + scannedFiles);

const dead = Object.keys(SERVER_BASIS_OK);
check(dead.length === 0 || totalMarks > 0,
    'បញ្ជីអនុញ្ញាតគ្មានធាតុងាប់ (សិទ្ធិតូចបំផុត)', dead.join(', '));

console.log('\n' + (fail ? 'FAIL ' + fail : 'PASS') + '  (' + pass + ')');
process.exit(fail ? 1 : 0);
