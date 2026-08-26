// ⛔ **meta-checker៖ តើ checker ខ្លួនវាពិតជាមើលកូដមែនទេ?**
//
// 🔴 នេះជាឧបករណ៍ដែលឆ្លើយសំណួររបស់អ្នកប្រើ៖ «ហេតុអ្វី audit លើកណាក៏ជួប
// កំហុសមិនចេះចប់?»។ មូលហេតុមិនមែនថាកូដ App អាក្រក់ទេ — មូលហេតុគឺថា
// **checker ខ្លួនវាបៃតងក្លែងក្លាយ** ដូច្នេះកំហុសរអិលកាត់ជុំមួយទៅជុំមួយ។
//
// ថ្នាក់បៃតងក្លែងក្លាយដែលឯកសារនេះបិទ៖
//
// ១. **ការអះអាងអវត្តមានលើ input ទទេ។** «គ្មានលំនាំអាក្រក់ទេ» ពិតដោយ
//    ស្វ័យប្រវត្តិពេលគ្មានឯកសារ។ ការប្តូរឈ្មោះឯកសារ · ការផ្លាស់កូដទៅ
//    ឯកសារថ្មី · ឬការ refactor ដែលដក function ចេញ ➜ checker បៃតង
//    **ខណៈវាមិនបានពិនិត្យអ្វីសោះ**។ វាស់បានក្នុងជុំនេះ៖ checker **៦**
//    រាយការណ៍ជោគជ័យលើថតទទេ (`animation-cost` · `compensation-order` ·
//    `css-media-override` · `stale-write` · `storage-guard` · `comments`)
//    ហើយ `scan-engine-test` ចេញជា SKIP (exit 0)។
//
// ២. **checker ដែលមិនអាចចង្អុលទៅ tree ផ្សេងបាន។** `CLAUDE.md` ចែងថា
//    រាល់តេស្តថ្មីត្រូវរត់លើ `git archive origin/main` ដើម្បីបញ្ជាក់ថា
//    វាមិនទទេ — តែ **១៧ checker គ្មាន `*_APP_DIR` សោះ** ហើយ **១៥ ទៀត**
//    មានវា តែមិនត្រូវបានហៅក្នុងផ្នែក baseline របស់ `run-all.sh`។ សរុប
//    **៣២/៨១ (៤០%)** មិនអាចផ្ទៀងផ្ទាត់បានទេ។
//
// ៣. **ការបញ្ឈប់ខ្លួនភ្លាមពេលរកឈ្មោះ function មិនឃើញ។** checker ដែល
//    `process.exit(1)` ដោយ «រកមុខងារមិនឃើញ» **បិទបាំងការអះអាងឥរិយាបថ
//    ទាំងអស់ខាងក្រោមវា** ➜ លើ tree មុនកែ អ្នកឃើញកំហុសតែ ១ ជំនួសឲ្យ
//    ការធ្លាក់ពិតដែលបង្ហាញ *អ្វី* ខូច។ ត្រូវ stub ជំនួស។
//
// របៀបធ្វើការ៖ ឯកសារនេះ **រត់ checker នីមួយៗពិត** ដោយចង្អុល `*_APP_DIR`
// ទៅថតទទេ។ checker ណាដែលនៅតែចេញ exit 0 គឺ **មិនអាចធ្លាក់បានទេ** ➜ ធ្លាក់។
// នេះជាការវាស់ឥរិយាបថ មិនមែន grep — វាមិនអាចត្រូវបញ្ឆោតដោយ comment ទេ។
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const TOOLS = path.resolve(__dirname);
const RUNALL = path.join(TOOLS, 'run-all.sh');

// ឯកសារដែលមិនមែនជា checker — ពួកវាជាឧបករណ៍កែកូដ
const NOT_CHECKERS = new Set(['trimws.js', 'strip-comments.js', 'checker-coverage.js']);

// checker ដែលរត់ browser ពិត — ការ probe ថតទទេនៅតែធ្វើ តែឲ្យពេលវែងជាង
const SLOW = new Set([
    'gesture-test.js', 'ui-flow-test.js', 'layout-check.js', 'scan-engine-test.js',
    'panel-motion-test.js', 'boot-animation-test.js', 'csp-enforced-test.js',
    'fluid-type-focus-test.js', 'toast-truth-test.js', 'revenue-fuzz-test.js',
    'perf-check.js', 'duplicate-scan-test.js', 'sw-shell-latency-test.js'
]);

let pass = 0, fail = 0;
function ok(label) { pass++; console.log('   ok    ' + label); }
function bad(label, detail) {
    fail++;
    console.log('  FAIL   ' + label + (detail !== undefined ? '\n         '
        + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
}

const runall = fs.readFileSync(RUNALL, 'utf8');

// ឈ្មោះ checker ដែល `run-all.sh` រត់ — ទាំងក្នុងរង្វិលជុំ `for t in …`
// និងទាំងជាបន្ទាត់ `run "…" node audit-tools/x.js` ដាច់ដោយឡែក
const runNames = new Set();
for (const m of runall.matchAll(/for t in ([\s\S]*?); do/g)) {
    m[1].split(/\s+/).filter(Boolean).forEach((n) => runNames.add(n.replace(/\\$/, '')));
}
for (const m of runall.matchAll(/audit-tools\/([A-Za-z0-9._-]+)\.js/g)) runNames.add(m[1]);

const checkers = fs.readdirSync(TOOLS)
    .filter((f) => f.endsWith('.js') && !NOT_CHECKERS.has(f))
    .sort();

console.log('=== ១. រាល់ checker ត្រូវអាចចង្អុលទៅ tree ផ្សេងបាន (`*_APP_DIR`) ===');
const envOf = new Map();
const missingEnv = [];
for (const f of checkers) {
    const src = fs.readFileSync(path.join(TOOLS, f), 'utf8');
    const m = src.match(/process\.env\.([A-Z0-9_]+_APP_DIR)/);
    if (m) envOf.set(f, m[1]);
    else missingEnv.push(f);
}
if (missingEnv.length) bad('checker ' + missingEnv.length + ' គ្មាន `*_APP_DIR` ➜ បញ្ជាក់មិនបានថាវាមិនទទេ',
    missingEnv.join(', '));
else ok('checker ទាំង ' + checkers.length + ' មាន `*_APP_DIR` override');

console.log('\n=== ២. រាល់ override ត្រូវត្រូវបានហៅក្នុងផ្នែក baseline របស់ run-all.sh ===');
const notWired = [];
for (const [f, env] of envOf) {
    if (!runNames.has(f.replace(/\.js$/, ''))) continue;
    if (!new RegExp(env + '="\\$BASE"').test(runall)) notWired.push(f + ' (' + env + ')');
}
if (notWired.length) bad('checker ' + notWired.length + ' មិនត្រូវបានហៅក្នុងផ្នែក baseline',
    notWired.join(', '));
else ok('រាល់ checker ក្នុង run-all ត្រូវបានហៅក្នុងផ្នែក baseline ដែរ');

console.log('\n=== ៣. checker មិនត្រូវបញ្ឈប់ខ្លួនពេលរកឈ្មោះ function មិនឃើញ ===');
// ការបញ្ឈប់បែបនោះបិទបាំងការអះអាងឥរិយាបថទាំងអស់ខាងក្រោម ➜ tree មុនកែ
// បង្ហាញកំហុសតែ ១ ជំនួសឲ្យការធ្លាក់ពិតដែលប្រាប់ថា *អ្វី* ខូច។
const HARD_EXIT = /មិនមានក្នុង app\.js[\s\S]{0,200}?process\.exit\(1\)/;
const hardExit = checkers.filter((f) => HARD_EXIT.test(fs.readFileSync(path.join(TOOLS, f), 'utf8')));
if (hardExit.length) bad('checker ' + hardExit.length + ' បញ្ឈប់ខ្លួនពេលរក function មិនឃើញ — ត្រូវ stub ជំនួស',
    hardExit.join(', '));
else ok('គ្មាន checker ណាបិទបាំងការអះអាងឥរិយាបថដោយការបញ្ឈប់មុនពេលទេ');

console.log('\n=== ៤. ថតទទេ ➜ គ្មាន checker ណាមួយអាចជោគជ័យបានទេ ===');
console.log('    (ការវាស់ឥរិយាបថពិត — រត់ checker នីមួយៗលើថតទទេ)');
const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-empty-'));
const greenOnEmpty = [];
let probed = 0;
for (const f of checkers) {
    const env = envOf.get(f);
    if (!env) continue;
    probed++;
    let code = 1;
    try {
        execFileSync(process.execPath, [path.join(TOOLS, f)], {
            env: Object.assign({}, process.env, { [env]: empty }),
            stdio: 'ignore',
            timeout: SLOW.has(f) ? 180000 : 90000
        });
        code = 0;
    } catch (e) {
        // ការធ្លាក់ · ការគាំង · timeout — សុទ្ធតែ «មិនបៃតង» ដែលជាអ្វីដែលត្រូវការ
        code = typeof e.status === 'number' ? e.status : 1;
    }
    if (code === 0) greenOnEmpty.push(f);
}
try { fs.rmSync(empty, { recursive: true, force: true }); } catch (e) {}

if (greenOnEmpty.length) {
    bad('checker ' + greenOnEmpty.length + '/' + probed + ' ជោគជ័យលើថតទទេ — ពួកវាមិនអាចធ្លាក់បានទេ',
        greenOnEmpty.join(', ')
        + '\n         ដំណោះស្រាយ៖ បន្ថែម **ជាន់អប្បបរមា** — អះអាងថា checker ពិតជាបានឃើញ'
        + '\n         ឯកសារ/ការប្រកាស/ការហៅ ក្នុងចំនួនអប្បបរមាមួយ មុននឹងអះអាងថា «ស្អាត»។');
} else {
    ok('checker ទាំង ' + probed + ' ធ្លាក់លើថតទទេ (រាល់ការអះអាងអវត្តមានមានជាន់អប្បបរមា)');
}

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
