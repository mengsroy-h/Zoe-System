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

// ⛔ ឯកសារស្រមោលរបស់ `exit-code-integrity.js` (`.tmp-poison-*`) មិនមែនជា
// checker ទេ — បើវាត្រូវរាប់ នោះការរត់ស្របគ្នា ២ នឹងរាយការធ្លាក់ក្លែងក្លាយ។
const checkers = fs.readdirSync(TOOLS)
    .filter((f) => f.endsWith('.js') && !NOT_CHECKERS.has(f) && !f.startsWith('.tmp-poison-'))
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

console.log('\n=== ២ខ. CI មិនត្រូវរត់ checker ដែល `run-all.sh` មិនរត់ ===');
// ⛔ ថ្នាក់កំហុស៖ **checker ដែលរស់តែក្នុង CI**។ `run-all.sh` ជាការត្រួតពិនិត្យ
// ដែលអ្នកអភិវឌ្ឍន៍រត់មុន push — បើ CI រត់អ្វីមួយបន្ថែម នោះការប្តូរដែលធ្វើឲ្យ
// checker នោះខូច **បង្ហាញជាបៃតងនៅមូលដ្ឋាន រួចក្រហមនៅ CI ក្រោយ push**។
//
// 🔴 កើតឡើងពិតក្នុងកំណែ 2.20.1៖ `emu/crud-rules-flow.js` រត់តែក្នុង CI ➜
// ការបន្ថែមថេរថ្មីក្នុង `app.js` ធ្វើឲ្យ sandbox របស់វាបោះ `ReferenceError`
// ➜ `33 ok, 10 fail` នៅ CI ខណៈ `run-all.sh` នៅមូលដ្ឋាន **បៃតងទាំង ៩៥**។
//
// ការជួសជុលមិនមែនត្រឹមតែការកែ sandbox នោះទេ — វាជាការធានាថា **អ្វីដែល CI
// រត់ ត្រូវរត់នៅមូលដ្ឋានដែរ** (គ្មាន emulator ➜ SKIP ស្អាត; CI ដាក់
// `CRUD_FLOW_STRICT=1` ដែលធ្វើឲ្យ SKIP នោះក្លាយជាការធ្លាក់)។
{
    const wf = path.join(TOOLS, '..', '.github', 'workflows', 'audit.yml');
    if (!fs.existsSync(wf)) {
        bad('រកឃើញ .github/workflows/audit.yml', 'គ្មានឯកសារ ➜ បញ្ជាក់មិនបានថា CI និងមូលដ្ឋានស៊ីគ្នា');
    } else {
        const ciText = fs.readFileSync(wf, 'utf8');
        const ciCheckers = new Set();
        for (const m of ciText.matchAll(/node\s+audit-tools\/([A-Za-z0-9._\/-]+)\.js/g)) ciCheckers.add(m[1]);
        // ជាន់អប្បបរមា — CI ដែលមិនរត់អ្វីសោះ មិនត្រូវបៃតងស្ងាត់ៗ
        if (ciCheckers.size < 3) {
            bad('ជាន់អប្បបរមា៖ CI រត់ checker >= ៣', 'រកឃើញ ' + ciCheckers.size);
        } else {
            ok('ជាន់អប្បបរមា៖ CI រត់ checker ' + ciCheckers.size);
        }
        // ⛔ ពិនិត្យតែ **ផ្នែករត់ធម្មតា** — ផ្នែក baseline (`if [ -n "$BASE" ]`)
        // រត់តែពេលមាន argument ដូច្នេះការលេចត្រឹមទីនោះ **មិនធានាថា checker
        // នោះរត់ក្នុងការហៅធម្មតាទេ** ➜ ចន្លោះនៅដដែល។
        const baselineAt = runall.search(/if \[ -n "\$BASE" \]/);
        const mainSection = baselineAt === -1 ? runall : runall.slice(0, baselineAt);
        // ⛔ ត្រូវអាន **ទាំង ២ ទម្រង់** ដូច `runNames` ខាងលើ — រង្វិលជុំ
        // `for t in …; do` និងបន្ទាត់ `node audit-tools/x.js` ដាច់ដោយឡែក។
        // ការអានតែទម្រង់ទី ២ ធ្វើឲ្យ checker ភាគច្រើន (ដែលហៅតាមរង្វិលជុំ)
        // ត្រូវរាយខុសថា «រត់តែក្នុង CI»។
        const mainNames = new Set();
        for (const m of mainSection.matchAll(/for t in ([\s\S]*?); do/g)) {
            m[1].split(/\s+/).filter(Boolean).forEach((n) => mainNames.add(n.replace(/\\$/, '')));
        }
        for (const m of mainSection.matchAll(/audit-tools\/([A-Za-z0-9._\/-]+)\.js/g)) mainNames.add(m[1]);
        const ciOnly = [...ciCheckers].filter((name) => {
            if (/run-all\.sh/.test(name)) return false;
            return !mainNames.has(name);
        });
        if (ciOnly.length) bad('⛔ checker ' + ciOnly.length + ' រត់តែក្នុង CI ➜ ការខូចមិនលេចនៅមូលដ្ឋាន',
            ciOnly.join(', '));
        else ok('រាល់ checker ដែល CI រត់ ត្រូវបានហៅក្នុង run-all.sh ដែរ');
    }
}

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

console.log('\n=== ៥. ការសម្លាប់ `exit-code-integrity.js` មិនត្រូវធ្វើឲ្យ checker ខូច ===');
// ⛔ 🔴 ថ្នាក់អាក្រក់ជាងបៃតងក្លែងក្លាយ ៖ **ឧបករណ៍ audit ដែលខូចដោយស្ងាត់**។
// `exit-code-integrity.js` ពុលការអះអាងរបស់ checker នីមួយៗ ដើម្បីវាស់ថា
// ការធ្លាក់ឡើងដល់ exit code។ ជំនាន់មុនរបស់វាពុល **ឯកសារដើម** រួចពឹងលើ
// handler របស់ signal ដើម្បីស្តារ — តែរង្វិលជុំនោះហៅ `execFileSync` ដែល
// **ទប់ event loop** ➜ handler រត់មិនបាន ➜ `timeout -k 10` របស់
// `run-all.sh` បញ្ចប់ដោយ **SIGKILL** ➜ checker នៅពុលក្នុង working tree ➜
// `git commit -a` បន្ទាប់ ship checker ដែលបាក់។
//
// ការវាស់នេះជា **ឥរិយាបថ** មិនមែន grep ៖ ថត hash ➜ បើកដំណើរការ ➜
// **SIGKILL** កណ្តាលផ្លូវ ➜ hash ត្រូវនៅដដែលបេះបិទ។
if (process.env.EXITCODE_CHILD) {
    // ⛔ `exit-code-integrity.js` ពុល **ឯកសារនេះ** រួចរត់វា ដើម្បីវាស់ថា
    // ការធ្លាក់ឡើងដល់ exit code។ បើផ្នែកនេះបើកដំណើរការ
    // `exit-code-integrity.js` វិញ នោះកើតជា **រង្វិលជុំទៅវិញទៅមក**
    // (checker-coverage ➜ exit-code-integrity ➜ checker-coverage ➜ …) ➜
    // ដំណើរការស្ទួន · ពេលវេលាហួសពិដាន · និងឯកសារស្រមោលបន្សល់។
    // ក្នុងការរត់ជាកូន ការអះអាងទាំងអស់ត្រូវពុលឲ្យធ្លាក់ស្រាប់ ➜ ការរំលង
    // ត្រង់នេះមិនបាត់បង់ការវាស់អ្វីទេ។
    console.log('    (រំលង — កំពុងរត់ជាកូនរបស់ exit-code-integrity)');
} else {
    const crypto = require('crypto');
    const { spawn, execFileSync: runSync } = require('child_process');
    const snapshot = () => {
        const out = new Map();
        for (const dir of [TOOLS, path.join(TOOLS, 'emu')]) {
            let names = [];
            try { names = fs.readdirSync(dir); } catch (e) { continue; }
            for (const n of names) {
                // ⛔ ឯកសារស្រមោលជាវត្ថុបណ្តោះអាសន្នដោយការរចនា — ការរាប់វា
                // ធ្វើឲ្យការបោសសំណល់របស់ការរត់មុន មើលទៅដូច «SIGKILL កែឯកសារ»
                // ➜ ការធ្លាក់ក្លែងក្លាយ (វាស់បានក្នុងជុំនេះ)។
                if (!n.endsWith('.js') || n.startsWith('.tmp-poison-')) continue;
                const f = path.join(dir, n);
                try { out.set(f, crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex')); } catch (e) {}
            }
        }
        return out;
    };
    const before = snapshot();
    // ជាន់អប្បបរមា ៖ ថតទទេ ➜ ការវាស់នេះមិនអះអាងអ្វីទេ
    if (before.size < 40) {
        bad('ជាន់អប្បបរមា៖ ថត hash checker >= ៤០', before.size);
    } else {
        const child = spawn(process.execPath, [path.join(TOOLS, 'exit-code-integrity.js')],
            { stdio: 'ignore', env: Object.assign({}, process.env, { EXITCODE_TIMEOUT_MS: '60000' }) });
        let killed = false;
        try {
            runSync(process.execPath, ['-e', 'setTimeout(()=>{},2500)'], { stdio: 'ignore' });
            process.kill(child.pid, 'SIGKILL');
            killed = true;
        } catch (e) {}
        try { runSync(process.execPath, ['-e', 'setTimeout(()=>{},700)'], { stdio: 'ignore' }); } catch (e) {}
        const after = snapshot();
        const changed = [];
        for (const [f, h] of before) if (after.get(f) !== h) changed.push(path.basename(f));
        const strays = [...after.keys()].filter((f) => !before.has(f) && !path.basename(f).startsWith('.tmp-poison-'));
        ok('បានសម្លាប់ `exit-code-integrity.js` កណ្តាលផ្លូវ (SIGKILL)');
        if (!killed) bad('សម្លាប់មិនបាន ➜ ការវាស់នេះមិនអះអាងអ្វីទេ');
        if (changed.length) bad('⛔ SIGKILL បន្សល់ checker ' + changed.length + ' ដែលត្រូវកែ — ការពុលត្រូវធ្វើលើឯកសារស្រមោល',
            changed.join(', '));
        else ok('⛔ SIGKILL មិនប៉ះឯកសារ checker ណាមួយសោះ (' + before.size + ' ឯកសារ)');
        if (strays.length) bad('⛔ បន្សល់ឯកសារ .js ដែលមិនស្គាល់', strays.join(', '));
        else ok('គ្មានឯកសារ .js ចម្លែកបន្សល់');
    }
    // បោសសំណល់ `.tmp-poison-*` របស់ដំណើរការដែលត្រូវសម្លាប់
    for (const dir of [TOOLS, path.join(TOOLS, 'emu')]) {
        let names = [];
        try { names = fs.readdirSync(dir); } catch (e) { continue; }
        for (const n of names) {
            if (!n.startsWith('.tmp-poison-')) continue;
            try { fs.unlinkSync(path.join(dir, n)); } catch (e) {}
        }
    }
}

console.log('\n=== ៦. checker ត្រូវ bind port ចៃដន្យ លើ 127.0.0.1 ប៉ុណ្ណោះ ===');
// ⛔ ច្បាប់នេះរស់នៅក្នុង `CLAUDE.md` តាំងពីយូរ **ដោយគ្មានឧបករណ៍ចាក់សោ** —
// ហើយវាត្រូវបានរំលោភពិត ៖ checker **៥** ប្រើ port ថេរ រហូតដល់កំណែ 2.20.7
// (វាស់ដោយផ្ទាល់ខណៈធ្វើ mutation testing ស្របគ្នា ៖ `layout-check` និង
// `fluid-type-focus-test` ដែល **គ្មានទាក់ទងនឹង mutation សោះ** បង្ហាញ FAIL
// ➜ សញ្ញាក្លែងក្លាយ) ហើយ **២ ទៀតរអិលកាត់ជុំនោះ** (`csp-lazy-resource-test`
// 8620 · `toast-truth-test` 8560)។ នោះជាភស្តុតាងផ្ទាល់នៃច្បាប់ទី ១៣៖
// **អ្វីដែលគ្មានឧបករណ៍ចាក់សោ នឹងវិលមកវិញ។**
//
// ថ្នាក់កំហុស ២ ដែលវាបិទ៖
//   ១. **សញ្ញាក្លែងក្លាយ** — ការរត់ ២ ស្របគ្នា ➜ `EADDRINUSE` ➜ FAIL ដែល
//      មើលទៅដូចកំហុសកូដ ➜ ជុំក្រោយដេញតាមកំហុសដែលមិនមាន។
//   ២. **ការលាតត្រដាង** — `listen(port)` ទទេ bind `0.0.0.0` ➜ ថត App
//      (រួមទាំង config និង Setup Link ក្នុងតេស្ត) បើកចំហលើគ្រប់ interface។
// ⛔ ត្រូវស្កេន **កូដ** មិនមែនអត្ថបទ — checker ខ្លះមានខ្សែអក្សរសារដែលផ្ទុក
// លំនាំដែលយើងដេញតាម (`exit-code-integrity.js` រក្សាតារាង POISON ជាខ្សែអក្សរ)
// ➜ ការស្កេនឆៅរាយការណ៍ពួកវាខុស។ ដូច្នេះលុប comment និងខ្សែអក្សរចេញជាមុន
// ជំនួសការសរសេរបញ្ជីលើកលែង ដែលនឹងក្លាយជាការការពារដែលងាប់។
function stripLiterals(src) {
        let out = '', i = 0;
        while (i < src.length) {
            const c = src[i], n = src[i + 1];
            if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
            if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
            if (c === '"' || c === "'" || c === '`') {
                const q = c; i++;
                let body = '';
                while (i < src.length && src[i] !== q) {
                    if (src[i] === '\\') { body += src[i]; i++; }
                    if (i < src.length) { body += src[i]; i++; }
                }
                i++;
                // ⛔ រក្សាតែអាសយដ្ឋាន loopback — វាជាអ្វីដែលការអះអាងត្រូវអាន។
                // អ្វីៗផ្សេងក្លាយជាខ្សែអក្សរទទេ ➜ សារដែលផ្ទុក `.listen(`
                // លែងផ្គូផ្គងខ្លួនឯង។
                out += (body === '127.0.0.1') ? "'127.0.0.1'" : "''";
                continue;
            }
            out += c; i++;
        }
    return out;
}

{
    const LISTEN = /\.listen\s*\(([^)]*?)(?:,\s*(?:\(\)|function)[^)]*)?\)/g;
    const files = [];
    for (const dir of [TOOLS, path.join(TOOLS, 'emu')]) {
        let names = [];
        try { names = fs.readdirSync(dir); } catch (e) { continue; }
        for (const n of names) {
            if (!n.endsWith('.js') || n.startsWith('.tmp-poison-')) continue;
            files.push(path.join(dir, n));
        }
    }
    let listenCalls = 0;
    const offenders = [];
    for (const f of files) {
        let src = '';
        try { src = stripLiterals(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
        LISTEN.lastIndex = 0;
        let m;
        while ((m = LISTEN.exec(src)) !== null) {
            const args = m[1];
            listenCalls++;
            const first = args.split(',')[0].trim();
            const hasLoopback = /['"]127\.0\.0\.1['"]/.test(args);
            if (first !== '0' || !hasLoopback) {
                const line = src.slice(0, m.index).split('\n').length;
                offenders.push(path.basename(f) + ':' + line + '  ' + m[0].trim().slice(0, 60));
            }
        }
    }
    // ⛔ ជាន់អប្បបរមា — ថតទទេ ឬ regex ដែលឈប់ផ្គូផ្គង **មិនត្រូវបៃតងស្ងាត់ៗ**
    const MIN_LISTEN = 10;
    if (listenCalls < MIN_LISTEN) {
        bad('ជាន់អប្បបរមា៖ រកឃើញការហៅ `.listen(` >= ' + MIN_LISTEN, listenCalls);
    } else {
        ok('ជាន់អប្បបរមា៖ ស្កេនការហៅ `.listen(` ' + listenCalls + ' កន្លែង');
    }
    if (offenders.length) {
        bad('⛔ checker ' + offenders.length + ' bind port ថេរ ឬ 0.0.0.0 — ត្រូវជា `listen(0, \'127.0.0.1\')`',
            offenders.join('\n         '));
    } else {
        ok('រាល់ការហៅ `.listen(` ប្រើ port ចៃដន្យ លើ 127.0.0.1');
    }
}

console.log('\n=== ៧. គ្មាន checker ណានៅផ្ទុកសំណល់នៃការពុល ===');
// ⛔⛔ 🔴 **កើតឡើងពិតក្នុងជុំ 2.20.8។** ជំនាន់ចាស់របស់
// `exit-code-integrity.js` ពុលការអះអាង **នៅនឹងកន្លែង** រួចពឹងលើ handler
// របស់ signal ដើម្បីស្តារ — ការការពារនោះដំណើរការមិនបាន (មើលផ្នែក ៥) ➜
// ការរត់ដែលត្រូវសម្លាប់បន្សល់សំណល់។ **ឯកសារនេះខ្លួនឯង** ត្រូវរកឃើញថា
// មាន `fail++` ចាក់បន្ថែម **១៤ ដង** ក្នុង working tree ➜ វារាយការណ៍
// «ធ្លាក់ 14» ខណៈការអះអាងទាំងអស់បោះ `ok` — **ការធ្លាក់ដែលគ្មានឈ្មោះ**។
//
// ការកែឫសគល់គឺឯកសារស្រមោល (ផ្នែក ៥)។ ផ្នែកនេះជា **សំណាញ់ទី ២** ៖ បើ
// សំណល់ណាមួយវិលមកវិញ (checkout ចាស់ · ការថយក្រោយនាពេលអនាគត) វាត្រូវ
// លេចជាការធ្លាក់ **ដែលមានឈ្មោះ** ជំនួសលេខអាថ៌កំបាំង។
{
    const POISON_SIGNS = [
        [/function\s+ok\s*\([^)]*\)\s*\{\s*(?:cond|condition)\s*=\s*false\s*;/,
            'ok() ត្រូវបង្ខំឲ្យធ្លាក់ (`cond = false`)'],
        [/results\s*\.\s*push\s*\(\s*\[\s*\w+\s*,\s*false\s*,/,
            'អ្នកប្រមូលលទ្ធផលត្រូវបង្ខំឲ្យធ្លាក់'],
        [/(?:let|var)[^;\n]*\b(fail|fails|failed|failures|problem|problems|gap|gaps|offend|offenders|bad|error|errors|miss|missing|dirty|totalGaps)\s*=\s*[^;,\n]*[;,]\s*\1\s*\+\+\s*;/,
            'អថេររាប់ការធ្លាក់ត្រូវចាក់ `++` បន្ថែមភ្លាមក្រោយការប្រកាស']
    ];
    let scanned = 0;
    const poisoned = [];
    for (const dir of [TOOLS, path.join(TOOLS, 'emu')]) {
        let names = [];
        try { names = fs.readdirSync(dir); } catch (e) { continue; }
        for (const n of names) {
            if (!n.endsWith('.js') || n.startsWith('.tmp-poison-')) continue;
            let code = '';
            try { code = stripLiterals(fs.readFileSync(path.join(dir, n), 'utf8')); } catch (e) { continue; }
            scanned++;
            for (const [re, why] of POISON_SIGNS) {
                if (re.test(code)) { poisoned.push(n + ' — ' + why); break; }
            }
        }
    }
    const MIN_SCANNED = 40;
    if (scanned < MIN_SCANNED) bad('ជាន់អប្បបរមា៖ ស្កេន checker >= ' + MIN_SCANNED, scanned);
    else ok('ជាន់អប្បបរមា៖ ស្កេន checker ' + scanned + ' ឯកសាររកសំណល់នៃការពុល');
    if (poisoned.length) {
        bad('⛔ checker ' + poisoned.length + ' នៅផ្ទុកសំណល់នៃការពុល — ការអះអាងរបស់ពួកវាបាក់',
            poisoned.join('\n         '));
    } else {
        ok('គ្មាន checker ណានៅផ្ទុកសំណល់នៃការពុលទេ');
    }
}

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
