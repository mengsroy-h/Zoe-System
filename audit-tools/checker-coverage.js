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
const { execFile, execFileSync } = require('child_process');

const TOOLS = path.resolve(__dirname);
const RUNALL = path.join(TOOLS, 'run-all.sh');
const CHECKER_DIRS = [TOOLS, path.join(TOOLS, 'emu'), path.join(TOOLS, '..', 'zto-import')];
const EXTERNAL_CHECKERS = [{ f: '../zto-import/test.js', env: 'ZTO_IMPORT_APP_DIR' }];

// ឯកសារដែលមិនមែនជា checker — ពួកវាជាឧបករណ៍កែកូដ
// ⛔ រាល់ធាតុត្រូវមានហេតុផលសរសេរជាប់ — កុំបន្ថែមដើម្បីឲ្យបៃតង
//   trimws · strip-comments ៖ ឧបករណ៍សម្អាតកូដ មិនអះអាងអ្វី
//   checker-coverage      ៖ ខ្លួនវាផ្ទាល់
//   redact-dump           ៖ ឧបករណ៍សម្អាតទិន្នន័យ — **មិនអាន `app.js` សោះ**
//                           ➜ `*_APP_DIR` គ្មានន័យសម្រាប់វា (អ្នកយាមរបស់វា
//                           ជា `money-reality-test` ដែលបញ្ជាក់ថាលទ្ធផល
//                           មុន/ក្រោយសម្អាត ដូចគ្នាបេះបិទ)
//   money-reality-check · registry-orphan-list ៖ CLI ដែលត្រូវការ dump ពិត។
//       usage exit 2 មិនមែនភស្តុតាង checker ទេ — ត្រូវមាន fixture checker ខាងក្រោម។
// ⛔ `idtoken-fixture.js` ជា **ម៉ូឌុលរួម** មិនមែន checker ៖ វាគ្មានការអះអាង
// ផ្ទាល់ខ្លួន ➜ ការទាមទារ `*_APP_DIR` លើវាគ្មានន័យ។ អ្នកយាមរបស់វាគឺ checker
// ទាំង ២ ដែល require វា (ចុះក្នុង `repository-file-coverage.json`) — ដូច
// `emu/ns.js` ដែលត្រូវរំលងក្នុងការស្កេន `emu/` ដដែល។ `react-view.js` ក៏ជាម៉ូឌុលរួមដូចគ្នា ៖ ស្រទាប់ React
// (ឃ្លាំង · helper DOM/ប្រអប់) ពីទិដ្ឋភាព `app.js` សម្រាប់ checker ដែលស្រង់ function ចូល `vm`។
// `money-core.js` ជា **ទិន្នន័យ** (កូដលុយពិតដែលផលិតពី src របស់ ZoeW React សម្រាប់ `money-reality-check.js` លើ repo
// ដែលគ្មាន build) មិនមែន checker ៖ អ្នកយាមរបស់វាគឺ `money-reality-test` (ភាពស្រស់ + ការវាស់ដូច app.js)។
// `ts-comments.js` ជា **ម៉ូឌុលរួម** របស់ `comments.js` (អ្នកយាម · មាន `COMMENTS_APP_DIR`) និង `strip-comments.js` ៖ គ្មានការអះអាង
// ផ្ទាល់ខ្លួន ➜ អ្នកយាមរបស់វាគឺ `repository-contract-test` (TSX ពិត · ករណី ASI ត្រូវបោះបង់)។
// `rules-shape.js` ជា **ម៉ូឌុលរួម** ៖ ដេរីវេ node ដែលរំពឹង object ពី rules ពិត ➜ អ្នកយាមរបស់វាគឺ `rules-duplicate-keys` (ស្តាទិច)
// · `emu/crud-rules-flow` · `emu/license-seat-rules-test` (ការវាស់ពីរជំហានលើ emulator)។
// `supabase-pg.js` · `supabase-fake-server.js` ជា **harness រួម** (Postgres ពិត · ម៉ាស៊ីនមេ Supabase ក្លែង) ៖ «ម៉ូឌុលនេះមិនអះអាងអ្វីទេ» ➜
// អ្នកយាមរបស់វាគឺ checker ដែល require វា (`supabase-rls` · `supabase-datastore` · `keygen-supabase-admin` · `emu/supabase-*` ៖ មាន `*_APP_DIR`)។
// `money-multidevice-core.js` ជា **harness រួម** (អថេរលុយលើ server · PAGE_OPS) ៖ មិនអះអាងអ្វីទេ ➜ អ្នកយាមរបស់វាគឺ checker ដែល require វា
// (`emu/money-multidevice-emu-test` · `supabase-money-multishop-test` ៖ មាន `*_APP_DIR`)។
// `audit-module-ast.js` ជា helper គ្មាន assertion ផ្ទាល់៖ អ្នកយាម `audit-module-ast.test.ts` និង AST checkers ដែលប្រើវា។
const NOT_CHECKERS = new Set(['trimws.js', 'strip-comments.js', 'checker-coverage.js',
    'owned-rtdb-command.js', 'redact-dump.js', 'money-reality-check.js', 'registry-orphan-list.js',
    'idtoken-fixture.js', 'react-view.js', 'audit-module-ast.js', 'money-core.js', 'ts-comments.js', 'rules-shape.js',
    'supabase-pg.js', 'supabase-fake-server.js', 'money-multidevice-core.js', 'money-cookie-blob.js']);
const CLI_GUARDS = new Map([
    ['owned-rtdb-command.js', 'runall-runner-test.js'],
    ['money-reality-check.js', 'money-reality-test.js'],
    ['redact-dump.js', 'money-reality-test.js'],
    ['registry-orphan-list.js', 'registry-orphan-list-test.js']
]);

// checker ដែលរត់ browser ពិត — ការ probe ថតទទេនៅតែធ្វើ តែឲ្យពេលវែងជាង
const SLOW = new Set([
    'gesture-test.js', 'ui-flow-test.js', 'layout-check.js', 'scan-engine-test.js',
    'panel-motion-test.js', 'boot-animation-test.js', 'csp-enforced-test.js',
    'fluid-type-focus-test.js', 'modal-keyboard-test.js', 'modal-keyboard-device-test.js', 'toast-truth-test.js', 'revenue-fuzz-test.js',
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
function runnableNames(source) {
    const text = source.replace(/^\s*#.*$/gm, '');
    const names = new Set();
    for (const m of text.matchAll(/for t in ([\s\S]*?); do([\s\S]*?)\bdone\b/g)) {
        if (!/^\s*run\s+"\$t"\s+node\s+"audit-tools\/\$t\.js"/m.test(m[2])) continue;
        for (const name of m[1].split(/\s+/)) {
            if (/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name)) names.add(name);
        }
    }
    for (const m of text.matchAll(/^\s*(?:run\s+"[^"]*"\s+|(?:[A-Z0-9_]+="[^"]*"\s+)*)(?:runall_owned\s+)?node\s+audit-tools\/([A-Za-z0-9._/-]+)\.js(?=\s|$)/gm)) names.add(m[1]);
    return names;
}
const baselineAt = runall.search(/if \[ -n "\$BASE" \]/);
const mainSection = baselineAt === -1 ? runall : runall.slice(0, baselineAt);
const baselineSection = baselineAt === -1 ? '' : runall.slice(baselineAt);
const runNames = runnableNames(mainSection);
function externalWiringFailures(normal, baseline) {
    const active = (source) => source.replace(/^\s*#.*$/gm, '');
    const failures = [];
    if (!/^\s*run\s+"[^"]*"\s+node\s+zto-import\/test\.js(?=\s|$)/m.test(active(normal))) failures.push('zto-import/test.js (normal)');
    if (!/^\s*ZTO_IMPORT_APP_DIR="\$BASE\/zto-import"\s+node\s+zto-import\/test\.js(?=\s|$)/m.test(active(baseline))) failures.push('zto-import/test.js (baseline)');
    return failures;
}
function wiringFailures(entries, normal, baseline) {
    const names = runnableNames(normal);
    const activeBaseline = baseline.replace(/^\s*#.*$/gm, '');
    const failures = [];
    for (const [file, env] of entries) {
        const name = file.replace(/\.js$/, '');
        const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!names.has(name)) failures.push(file + ' (normal)');
        if (!new RegExp('^\\s*' + env + '="\\$BASE"\\s+(?:runall_owned\\s+)?node\\s+audit-tools/' + escaped + '(?=\\s|$)', 'm').test(activeBaseline)) failures.push(file + ' (baseline)');
    }
    return failures;
}

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

console.log('\n=== ២. រាល់ checker ត្រូវរត់ធម្មតា និងមាន baseline override ===');
const notWired = wiringFailures(envOf, mainSection, baselineSection).concat(externalWiringFailures(mainSection, baselineSection));
if (notWired.length) bad('checker ដែលខ្វះការភ្ជាប់ក្នុង run-all.sh',
    notWired.join(', '));
else ok('រាល់ checker រត់ក្នុងផ្នែកធម្មតា និង baseline ដោយ override របស់ខ្លួន');
{
    const entries = new Map([['fixture-test.js', 'FIXTURE_APP_DIR']]);
    const normal = 'run "fixture" node audit-tools/fixture-test.js';
    const baseline = 'FIXTURE_APP_DIR="$BASE" node audit-tools/fixture-test.js';
    const cases = [
        ['ការភ្ជាប់ពេញលេញត្រូវឆ្លង', normal, baseline, 0],
        ['owned BASE wrapper ត្រឹមត្រូវត្រូវឆ្លង', normal, baseline.replace(' node ', ' runall_owned node '), 0],
        ['owned BASE មិនជំនួស normal', '', baseline.replace(' node ', ' runall_owned node '), 1],
        ['owned BASE comment មិនមែនការរត់', normal, '# ' + baseline.replace(' node ', ' runall_owned node '), 1],
        ['owned BASE foreign override មិនត្រូវរាប់', normal, baseline.replace('FIXTURE_APP_DIR', 'FOREIGN_APP_DIR').replace(' node ', ' runall_owned node '), 1],
        ['wrapper ផ្សេងមិនអាចជំនួស owned API', normal, baseline.replace(' node ', ' foreign_wrapper node '), 1],
        ['owned wrapper ស្ទួនមិនមែន command ពិត', normal, baseline.replace(' node ', ' runall_owned runall_owned node '), 1],
        ['checker ដែលភ្លេចភ្ជាប់ត្រូវធ្លាក់', '', '', 2],
        ['baseline តែមួយមិនជំនួសការរត់ធម្មតា', '', baseline, 1],
        ['comment មិនអាចជំនួសការរត់ពិត', '# ' + normal, '# ' + baseline, 2],
        ['override របស់ checker ផ្សេងមិនត្រូវរាប់', normal, baseline.replace('fixture-test.js', 'other-test.js'), 1],
        ['ឯកសារបម្រុង .js.bak មិនមែន checker ពិត', normal + '.bak', baseline + '.bak', 2],
        ['ឯកសារបិទ .js-disabled មិនមែន checker ពិត', normal + '-disabled', baseline + '-disabled', 2],
        ['រង្វិលជុំ runner ត្រឹមត្រូវត្រូវឆ្លង', 'for t in fixture-test; do\nrun "$t" node "audit-tools/$t.js"\ndone', baseline, 0],
        ['ការរាយឈ្មោះក្នុងរង្វិលជុំដែលមិនរត់មិនត្រូវរាប់', 'for t in fixture-test; do\ntrue\ndone', baseline, 1]
    ];
    for (const [label, main, base, expected] of cases) {
        const actual = wiringFailures(entries, main, base);
        if (actual.length === expected) ok(label); else bad(label, actual);
    }
}
const missingCliGuards = [...CLI_GUARDS].filter(([file, guard]) =>
    !fs.existsSync(path.join(TOOLS, file)) || !checkers.includes(guard) || !runNames.has(guard.replace(/\.js$/, '')));
if (missingCliGuards.length) bad('CLI ត្រូវមាន fixture checker ដែលរត់ក្នុង suite', missingCliGuards);
else ok('CLI ដែលទាមទារ dump ត្រូវបានយាមដោយ fixture checker ពិត មិនរាប់ usage exit ជាភស្តុតាង');
{
    const normal = 'run "zto-import/test.js" node zto-import/test.js';
    const baseline = 'ZTO_IMPORT_APP_DIR="$BASE/zto-import" node zto-import/test.js';
    const cases = [[normal, baseline, 0], ['', baseline, 1], [normal, '', 1],
        ['# ' + normal, '# ' + baseline, 2], ['echo ' + normal, baseline, 1],
        [normal + '.bak', baseline + '.bak', 2], [normal, baseline.replace('$BASE/zto-import', '$BASE'), 1]];
    const mismatches = cases.filter(([main, base, count]) => externalWiringFailures(main, base).length !== count);
    if (mismatches.length) bad('ការភ្ជាប់ checker ខាងក្រៅត្រូវវាស់ការរត់ពិត និង baseline ត្រឹមត្រូវ', mismatches);
    else ok('ការភ្ជាប់ checker ខាងក្រៅ៖ ករណីត្រឹមត្រូវ និងការបំបែក ៧ ករណីត្រូវបានស្គាល់');
    const missing = EXTERNAL_CHECKERS.filter(({ f, env }) => {
        try { return !fs.readFileSync(path.join(TOOLS, f), 'utf8').includes('process.env.' + env); }
        catch (_) { return true; }
    });
    if (missing.length) bad('checker ខាងក្រៅត្រូវមានឯកសារ និង override ដែលប្រើបាន', missing);
    else ok('checker ខាងក្រៅមានឯកសារ និង override សម្រាប់ការរត់លើថតទទេ');
}

function workflowRunsAll(source) {
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^(\s*)(-\s+)?run:\s*(.*?)\s*$/);
        if (!match) continue;
        let script = match[3];
        if (/^[|>][+-]?(?:\s*#.*)?$/.test(script)) {
            const indent = match[1].length + (match[2] || '').length;
            const body = [];
            for (let j = i + 1; j < lines.length; j++) {
                if (!lines[j].trim()) { body.push(''); continue; }
                if (lines[j].match(/^\s*/)[0].length <= indent) break;
                body.push(lines[j].trim());
            }
            script = body.join(script[0] === '>' ? ' ' : '\n');
        }
        if (/^[ \t]*bash[ \t]+audit-tools\/run-all\.sh[ \t]*(?:#.*)?$/m.test(script)) return true;
    }
    return false;
}

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
        // ជាន់អប្បបរមា — CI ដែលមិនរត់អ្វីសោះ មិនត្រូវបៃតងស្ងាត់ៗ ៖ `bash audit-tools/run-all.sh` (បញ្ជីពេញ · ផ្នែកនៃ matrix
        // ផ្ទៀងដោយ runall-runner-test) ឬ checker ផ្ទាល់ >= ៣
        const ciRunsAll = workflowRunsAll(ciText);
        if (!ciRunsAll && ciCheckers.size < 3) {
            bad('ជាន់អប្បបរមា៖ CI រត់ run-all.sh ឬ checker >= ៣', 'រកឃើញ ' + ciCheckers.size);
        } else {
            ok('ជាន់អប្បបរមា៖ CI រត់ ' + (ciRunsAll ? 'run-all.sh' : '') + (ciCheckers.size ? ' + checker ' + ciCheckers.size : ''));
        }
        // ⛔ ពិនិត្យតែ **ផ្នែករត់ធម្មតា** — ផ្នែក baseline (`if [ -n "$BASE" ]`)
        // រត់តែពេលមាន argument ដូច្នេះការលេចត្រឹមទីនោះ **មិនធានាថា checker
        // នោះរត់ក្នុងការហៅធម្មតាទេ** ➜ ចន្លោះនៅដដែល។
        // ⛔ ត្រូវអាន **ទាំង ២ ទម្រង់** ដូច `runNames` ខាងលើ — រង្វិលជុំ
        // `for t in …; do` និងបន្ទាត់ `node audit-tools/x.js` ដាច់ដោយឡែក។
        // ការអានតែទម្រង់ទី ២ ធ្វើឲ្យ checker ភាគច្រើន (ដែលហៅតាមរង្វិលជុំ)
        // ត្រូវរាយខុសថា «រត់តែក្នុង CI»។
        const mainNames = runNames;
        const ciOnly = [...ciCheckers].filter((name) => {
            if (/run-all\.sh/.test(name)) return false;
            return !mainNames.has(name);
        });
        if (ciOnly.length) bad('⛔ checker ' + ciOnly.length + ' រត់តែក្នុង CI ➜ ការខូចមិនលេចនៅមូលដ្ឋាន',
            ciOnly.join(', '));
        else ok('រាល់ checker ដែល CI រត់ ត្រូវបានហៅក្នុង run-all.sh ដែរ');
    }
}
{
    const cases = [
        ['run មួយបន្ទាត់', '  run: bash audit-tools/run-all.sh', true],
        ['run literal block', '  run: |\n    export RUNALL_ONLY=""\n    bash audit-tools/run-all.sh', true],
        ['step run shorthand', '  - run: bash audit-tools/run-all.sh', true],
        ['comment មិនមែន run', '  # run: bash audit-tools/run-all.sh', false],
        ['block comment មិនមែន command', '  run: |\n    # bash audit-tools/run-all.sh', false],
        ['echo មិនមែន command', '  run: |\n    echo bash audit-tools/run-all.sh', false],
        ['env មិនមែន run block', '  run: echo ready\n  env:\n    SCRIPT: bash audit-tools/run-all.sh', false],
        ['run block បន្ទាប់ដាច់', '  run: |\n    echo ready\n  name: |\n    bash audit-tools/run-all.sh', false],
        ['script បម្រុងមិនមែន runner', '  run: bash audit-tools/run-all.sh.bak', false],
        ['folded block មិនបំបែក command', '  run: >\n    echo ready\n    bash audit-tools/run-all.sh', false],
        ['literal block chomping', '  run: |-\n    bash audit-tools/run-all.sh # suite', true],
        ['គ្មាន command', '  run: |\n    true', false]
    ];
    for (const [label, source, expected] of cases) {
        const actual = workflowRunsAll(source);
        if (actual === expected) ok('CI parser៖ ' + label); else bad('CI parser៖ ' + label, { expected, actual });
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
const EMPTY_PROBE_CONCURRENCY = 12;

function probeCheckerOnEmpty(f, env, empty) {
    return new Promise((resolve) => {
        execFile(process.execPath, [path.join(TOOLS, f)], {
            env: Object.assign({}, process.env, { [env]: empty }),
            encoding: 'utf8',
            timeout: SLOW.has(f) ? 180000 : 90000,
            maxBuffer: 4 * 1024 * 1024
        }, (error, stdout, stderr) => {
            const output = String(stdout || '') + '\n' + String(stderr || '');
            resolve({ f, green: !error && !/(^|\n)\s*SKIP\b/.test(output) });
        });
    });
}

(async () => {
const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-empty-'));
const greenOnEmpty = [];
let probed = 0;
const jobs = checkers.map((f) => ({ f, env: envOf.get(f) })).filter((job) => job.env).concat(EXTERNAL_CHECKERS);
probed = jobs.length;
let nextJob = 0;
await Promise.all(Array.from({ length: Math.min(EMPTY_PROBE_CONCURRENCY, jobs.length) }, async () => {
    for (;;) {
        const index = nextJob++;
        if (index >= jobs.length) return;
        const job = jobs[index];
        const result = await probeCheckerOnEmpty(job.f, job.env, empty);
        if (result.green) greenOnEmpty.push(result.f);
    }
}));
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
        for (const dir of CHECKER_DIRS) {
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
        // ⛔ `exit-code-integrity` រត់ checker ពុលស្របគ្នា ក្រោម `timeout` (ម្ចាស់ក្រុម process របស់ខ្លួន) ➜ SIGKILL
        // របស់វាបន្សល់កូនកំព្រារហូតដល់ពិដាន ៦០ វិ. (វាស់បាន ៖ money-guardian ពុល + អ្នកយាមកូន ៤ ជាន់ដំណាក់កាលបន្ទាប់
        // របស់ run-all) ➜ សម្លាប់ក្រុម process ដែល cmdline មានស្រមោល `.tmp-poison-<pid កូន>-` តាម **PID ជាក់លាក់**
        // (មិនមែន `pkill -f` ៖ លំនាំនោះផ្គូផ្គង shell ខ្លួនឯង)។ Linux តែប៉ុណ្ណោះ (`/proc`) · ផ្សេង ➜ ពិដាន ៦០ វិ. នៅដដែល។
        const orphanTag = '.tmp-poison-' + child.pid + '-';
        let reaped = 0;
        let procs = [];
        try { procs = fs.readdirSync('/proc').filter((n) => /^\d+$/.test(n)); } catch (e) {}
        for (const pid of procs) {
            let cmd = '';
            try { cmd = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8'); } catch (e) { continue; }
            if (cmd.indexOf(orphanTag) === -1) continue;
            try { process.kill(-Number(pid), 'SIGKILL'); reaped++; }
            catch (e) { try { process.kill(Number(pid), 'SIGKILL'); reaped++; } catch (e2) {} }
        }
        if (reaped) console.log('    (សម្លាប់ checker ពុលកំព្រា ' + reaped + ' process ក្រោយ SIGKILL)');
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
    for (const dir of CHECKER_DIRS) {
        let names = [];
        try { names = fs.readdirSync(dir); } catch (e) { continue; }
        for (const n of names) {
            if (!n.startsWith('.tmp-poison-')) continue;
            try { fs.unlinkSync(path.join(dir, n)); } catch (e) {}
        }
    }
}

console.log('\n=== ៦. checker មិនត្រូវចែករំលែកធនធានថេរ (port · RTDB namespace) ===');
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
    const blank = text => text.replace(/[^\r\n]/g, ' ');
    const tokens = require('acorn').tokenizer(src, { ecmaVersion: 'latest', sourceType: 'module' });
    let out = '', end = 0;
    for (const token of tokens) {
        out += blank(src.slice(end, token.start));
        const raw = src.slice(token.start, token.end), type = token.type.label;
        out += type === 'regexp' || type === 'template' || type === 'string' && token.value !== '127.0.0.1' ? blank(raw) : raw;
        end = token.end;
    }
    out += blank(src.slice(end));
    return out;
}

function staticVmPrograms(source, commonJS) {
    const parser = require('acorn');
    let tree;
    try { tree = parser.parse(source, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: !!commonJS }); }
    catch (_) { tree = parser.parse(source, { ecmaVersion: 'latest', sourceType: 'module' }); }
    const owners = new WeakMap(), calls = [];
    const frame = (parent, functionScope = false) => ({ parent, functionScope, bindings: new Map() });
    const bind = (scope, name, value = null) => scope.bindings.set(name, scope.bindings.has(name) ? null : value);
    const names = (pattern, scope) => {
        if (!pattern) return;
        if (pattern.type === 'Identifier') bind(scope, pattern.name);
        else if (pattern.type === 'RestElement') names(pattern.argument, scope);
        else if (pattern.type === 'AssignmentPattern') names(pattern.left, scope);
        else if (pattern.type === 'ArrayPattern') pattern.elements.forEach(part => names(part, scope));
        else if (pattern.type === 'ObjectPattern') pattern.properties.forEach(part => names(part.type === 'Property' ? part.value : part.argument, scope));
    };
    const visit = (node, parent) => {
        if (!node || typeof node !== 'object') return;
        let scope = parent;
        const functionNode = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type);
        if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') if (node.id) bind(parent, node.id.name);
        if (['Program', 'BlockStatement', 'CatchClause', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'SwitchStatement'].includes(node.type) || functionNode) scope = frame(parent, functionNode || node.type === 'Program');
        owners.set(node, scope);
        if (functionNode) { if (node.id) bind(scope, node.id.name); node.params.forEach(param => names(param, scope)); }
        if (node.type === 'CatchClause') names(node.param, scope);
        if (node.type === 'VariableDeclaration') for (const declaration of node.declarations) {
            let target = scope;
            if (node.kind === 'var') while (target.parent && !target.functionScope) target = target.parent;
            if (declaration.id.type === 'Identifier') bind(target, declaration.id.name, node.kind === 'const' ? { init: declaration.init, scope } : null);
            else names(declaration.id, target);
        }
        if (node.type === 'ImportDeclaration') node.specifiers.forEach(specifier => bind(scope, specifier.local.name));
        if (node.type === 'CallExpression') calls.push(node);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(part => part?.type && visit(part, scope));
            else if (value?.type) visit(value, scope);
        }
    };
    visit(tree, frame(null));
    const lookup = (scope, name) => { for (; scope; scope = scope.parent) if (scope.bindings.has(name)) return { value: scope.bindings.get(name) }; return null; };
    const methods = new Set(['runInNewContext', 'runInContext', 'runInThisContext']);
    const resolve = (node, scope, seen = new Set()) => {
        if (!node) return null;
        if (node.type === 'Literal' && typeof node.value === 'string') return { text: node.value };
        if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return { text: node.quasis[0].value.cooked };
        if (node.type === 'Identifier') {
            const binding = lookup(scope, node.name)?.value;
            if (!binding || seen.has(binding)) return null;
            return resolve(binding.init, binding.scope, new Set([...seen, binding]));
        }
        if (node.type === 'BinaryExpression' && node.operator === '+') {
            const a = resolve(node.left, scope, seen), b = resolve(node.right, scope, seen);
            return typeof a?.text === 'string' && typeof b?.text === 'string' ? { text: a.text + b.text } : null;
        }
        if (node.type === 'CallExpression' && node.callee.name === 'require' && !lookup(scope, 'require')
            && node.arguments.length === 1 && ['vm', 'node:vm'].includes(node.arguments[0]?.value)) return { vm: true };
        if (node.type === 'MemberExpression' && !node.computed && methods.has(node.property.name) && resolve(node.object, scope, seen)?.vm) return { method: node.property.name };
        return null;
    };
    const programs = []; let unresolved = 0;
    for (const call of calls) if (resolve(call.callee, owners.get(call))?.method) {
        const value = resolve(call.arguments[0], owners.get(call));
        if (typeof value?.text === 'string') programs.push(value.text); else unresolved++;
    }
    return { programs, unresolved };
}

function ownedPortProbeRanges(file, source) {
    if (path.resolve(file) !== path.resolve(TOOLS, 'owned-rtdb-command.js')) return [];
    try {
        const parser = require('acorn'), ast = parser.parse(source, { ecmaVersion: 'latest' });
        const top = ast.body, functions = top.filter(node => node.type === 'FunctionDeclaration');
        const declarations = top.filter(node => node.type === 'VariableDeclaration' && node.kind === 'const').flatMap(node => node.declarations);
        const exports = top.find(node => node.type === 'ExpressionStatement' && node.expression.type === 'AssignmentExpression'
            && node.expression.left.type === 'MemberExpression' && node.expression.left.object.name === 'module' && node.expression.left.property.name === 'exports')?.expression.right;
        const factoryName = exports?.properties?.find(node => node.key.name === 'productionAdapters')?.value.name;
        const factory = functions.find(node => node.id.name === factoryName);
        const adapters = factory?.body.body.find(node => node.type === 'ReturnStatement')?.argument;
        const probeName = adapters?.properties?.find(node => node.key.name === 'portFree')?.value.name;
        const probe = functions.find(node => node.id.name === probeName);
        if (!probe?.async || probe.generator || probe.params.length || probe.body.body.length !== 3) return [];
        const [creation, listenWait, closeWait] = probe.body.body;
        const created = creation.declarations?.[0], server = created?.id.name, init = created?.init;
        const callback = init?.arguments?.[0], socket = callback?.params?.[0]?.name, netName = init?.callee?.object?.name;
        const listenPromise = listenWait.expression?.argument, listenAction = listenPromise?.arguments?.[0];
        const listen = listenAction?.body?.body?.[1]?.expression, portName = listen?.arguments?.[0]?.name;
        const closePromise = closeWait.expression?.argument, closeAction = closePromise?.arguments?.[0];
        const close = closeAction?.body, error = close?.arguments?.[0]?.params?.[0]?.name;
        const netBindings = declarations.filter(node => node.init?.type === 'CallExpression' && node.init.callee.name === 'require' && node.init.arguments[0]?.value === 'net');
        if (netBindings.length !== 1 || netBindings[0].id.name !== netName
            || declarations.find(node => node.id.name === portName)?.init?.value !== 9000) return [];
        const all = []; const visit = node => { if (!node || typeof node !== 'object') return; if (node.type) all.push(node);
            for (const value of Object.values(node)) { if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value); } }; visit(ast);
        if (all.filter(node => node.type === 'Identifier' && node.name === netName).length !== 2
            || all.some(node => (node.type === 'VariableDeclarator' || node.type === 'FunctionDeclaration') && node.id?.name === 'Promise')) return [];
        const names = new Map();
        for (const [actual, canonical] of [[probeName, 'probe'], [server, 'server'], [socket, 'socket'], [netName, 'net'], [portName, 'PORT'],
            [listenAction?.params?.[0]?.name, 'resolve'], [listenAction?.params?.[1]?.name, 'reject'],
            [closeAction?.params?.[0]?.name, 'resolve'], [closeAction?.params?.[1]?.name, 'reject'], [error, 'error']]) {
            if (!actual || names.has(actual) && names.get(actual) !== canonical) return [];
            names.set(actual, canonical);
        }
        const canonical = node => {
            if (Array.isArray(node)) return node.map(canonical);
            if (!node || typeof node !== 'object') return node;
            const out = {};
            for (const [key, value] of Object.entries(node)) {
                if (['start', 'end', 'loc', 'raw'].includes(key)) continue;
                out[key] = node.type === 'Identifier' && key === 'name' ? names.get(value) || value : canonical(value);
            }
            return out;
        };
        const identifier = name => ({ type: 'Identifier', name });
        const literal = value => ({ type: 'Literal', value });
        const member = (object, property) => ({ type: 'MemberExpression', object: identifier(object), property: identifier(property), computed: false, optional: false });
        const call = (callee, args) => ({ type: 'CallExpression', callee, arguments: args, optional: false });
        const statement = expression => ({ type: 'ExpressionStatement', expression });
        const body = statements => ({ type: 'BlockStatement', body: statements });
        const arrow = (params, value) => ({ type: 'ArrowFunctionExpression', id: null, expression: value.type !== 'BlockStatement', generator: false, async: false, params: params.map(identifier), body: value });
        const awaitedPromise = value => statement({ type: 'AwaitExpression', argument: { type: 'NewExpression', callee: identifier('Promise'), arguments: [arrow(['resolve', 'reject'], value)] } });
        const expected = {
            type: 'FunctionDeclaration', id: identifier('probe'), expression: false, generator: false, async: true, params: [], body: body([
                { type: 'VariableDeclaration', declarations: [{ type: 'VariableDeclarator', id: identifier('server'), init: call(member('net', 'createServer'), [arrow(['socket'], call(member('socket', 'destroy'), []))]) }], kind: 'const' },
                awaitedPromise(body([
                    statement(call(member('server', 'once'), [literal('error'), identifier('reject')])),
                    statement(call(member('server', 'listen'), [identifier('PORT'), literal('127.0.0.1'), identifier('resolve')]))
                ])),
                awaitedPromise(call(member('server', 'close'), [arrow(['error'], {
                    type: 'ConditionalExpression', test: identifier('error'), consequent: call(identifier('reject'), [identifier('error')]), alternate: call(identifier('resolve'), [])
                })]))
            ])
        };
        if (JSON.stringify(canonical(probe)) !== JSON.stringify(canonical(expected))) return [];
        return [{ start: listen.start, end: listen.end }];
    } catch (_) { return []; }
}


function listenSourceAudit(file, source) {
    const probes = ownedPortProbeRanges(file, source);
    let masked = source;
    for (const probe of probes.slice().sort((a, b) => b.start - a.start)) masked = masked.slice(0, probe.start)
        + masked.slice(probe.start, probe.end).replace(/[^\n]/g, ' ') + masked.slice(probe.end);
    const queue = [{ source: masked, label: '', commonJS: true }], seen = new Set(), offenders = [];
    let listenCalls = probes.length, unresolved = 0, programNumber = 0;
    for (const input of queue) {
        if (seen.has(input.source)) continue;
        seen.add(input.source);
        const generated = staticVmPrograms(input.source, input.commonJS);
        unresolved += generated.unresolved;
        for (const program of generated.programs) queue.push({ source: program, label: ':vm-' + (++programNumber), commonJS: false });
        const code = stripLiterals(input.source), pattern = /\.listen\s*\(([^)]*?)(?:,\s*(?:\(\)|function)[^)]*)?\)/g;
        let match;
        while ((match = pattern.exec(code)) !== null) {
            listenCalls++;
            const args = match[1], first = args.split(',')[0].trim();
            if (first !== '0' || !/['"]127\.0\.0\.1['"]/.test(args)) {
                const line = code.slice(0, match.index).split('\n').length;
                offenders.push(path.basename(file) + input.label + ':' + line + '  ' + match[0].trim().slice(0, 60));
            }
        }
    }
    return { listenCalls, offenders, unresolved };
}

{
    const files = [];
    for (const dir of CHECKER_DIRS) {
        let names = [];
        try { names = fs.readdirSync(dir); } catch (e) { continue; }
        for (const n of names) {
            if (!n.endsWith('.js') || n.startsWith('.tmp-poison-')) continue;
            files.push(path.join(dir, n));
        }
    }
    let listenCalls = 0, unresolved = 0;
    const offenders = [];
    for (const file of files) {
        try {
            const result = listenSourceAudit(file, fs.readFileSync(file, 'utf8'));
            listenCalls += result.listenCalls;
            unresolved += result.unresolved;
            offenders.push(...result.offenders);
        } catch (error) { bad('listener scan ត្រូវ parse source បាន មិនមែនរំលងស្ងាត់', path.basename(file) + ': ' + error.message); }
    }
    // ⛔ ថតទទេ ឬ scanner ដែលឈប់ផ្គូផ្គង មិនត្រូវបៃតងស្ងាត់ៗ។
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
        ok('រាល់ការហៅ `.listen(` ដែលស្កេនបាន ជា random loopback server ឬ awaited owned-port availability probe');
    }
    if (unresolved) console.log('         កំណត់ scope៖ dynamic VM program ' + unresolved + ' មិនអាច resolve ជា literal/static program; មិនអះអាងថាបានស្កេនវា។');
}

{
    const ownerFile = path.join(TOOLS, 'owned-rtdb-command.js'), ownerSource = fs.readFileSync(ownerFile, 'utf8');
    const cases = [
        ['owned preflight ត្រូវបិទ listener មុន resolve', ownerFile, ownerSource, 1],
        ['filename មួយឯងមិនផ្តល់ exception', ownerFile, "const server=require('net').createServer();server.listen(9000,'127.0.0.1');", 0],
        ['helper copy នៅឯកសារផ្សេងមិនបាន exception', ownerFile + '.other.js', ownerSource, 0],
        ['wildcard interface មិនមែន ownership probe', ownerFile, ownerSource.replace("server.listen(PORT, '127.0.0.1'", "server.listen(PORT, '0.0.0.0'"), 0],
        ['close មិន await មិនបាន exception', ownerFile, ownerSource.replace('await new Promise((resolve, reject) => server.close', 'new Promise((resolve, reject) => server.close'), 0],
        ['listener អាច escape មិនបាន exception', ownerFile, ownerSource.replace('const server = net.createServer(socket => socket.destroy());', 'const server = net.createServer(socket => socket.destroy()); return server;'), 0],
        ['connection មិន destroy មិនបាន exception', ownerFile, ownerSource.replace('net.createServer(socket => socket.destroy())', 'net.createServer()'), 0]
    ];
    for (const [label, file, source, expected] of cases) {
        const found = ownedPortProbeRanges(file, source).length;
        if (found === expected) ok(label); else bad(label, { expected, found });
    }
}

{
    const checkerFile = path.join(TOOLS, 'checker-coverage.js'), checkerSource = fs.readFileSync(checkerFile, 'utf8');
    const unsafe = "require('http').createServer().listen(9000,'127.0.0.1');";
    const cases = [
        ['whole checker source មិនចាត់ AST model ជា server', checkerSource, 0, 0],
        ['unsafe server បន្ថែមនៅចុង whole source ត្រូវចាប់', checkerSource + '\n' + unsafe, 1, 0],
        ['VM fixture program បន្ថែមនៅចុង source ត្រូវចាប់', checkerSource + '\nconst vm=require("vm");const program=' + JSON.stringify(unsafe) + ';vm.runInNewContext(program);', 1, 0],
        ['ordinary model/message string មិនមែន executable source', 'const message=' + JSON.stringify(unsafe) + ';', 0, 0],
        ['CommonJS checker អនុញ្ញាត top-level return ដូច Node wrapper', 'if (!process.env.CHECKER_FIXTURE) return;', 0, 0],
        ['safe VM loopback program ត្រូវឆ្លង', 'require("node:vm").runInNewContext("require(\\\"http\\\").createServer().listen(0,\\\"127.0.0.1\\\");");', 0, 0],
        ['static VM method alias និង string concatenation ត្រូវស្កេន', 'const vm=require("vm"),run=vm.runInThisContext;run("require(\\\"http\\\").createServer()"+".listen(9000,\\\"127.0.0.1\\\");");', 1, 0],
        ['loop-local shadow មិនលុប outer VM binding', 'const vm=require("vm");for(let vm of []){}vm.runInThisContext(' + JSON.stringify(unsafe) + ');', 1, 0],
        ['scope ដាច់ដោយឡែកមិនយក outer program ជំនួស parameter', 'const program=' + JSON.stringify(unsafe) + ';function check(program){require("vm").runInContext(program,{});}', 0, 1],
        ['dynamic VM program ត្រូវរាយថាមិនបាន resolve', 'require("vm").runInNewContext(programFromCaller);', 0, 1]
    ];
    for (const [label, source, expected, unresolved] of cases) {
        try {
            const result = listenSourceAudit(checkerFile, source);
            if (result.offenders.length === expected && result.unresolved === unresolved) ok(label);
            else bad(label, { expected, unresolved, result });
        } catch (error) { bad(label, error.message); }
    }
    let refused = false;
    try { listenSourceAudit(checkerFile, 'const incomplete ='); } catch (_) { refused = true; }
    if (refused) ok('source parse មិនបានត្រូវធ្លាក់ មិនមែនរំលង'); else bad('source parse មិនបានត្រូវធ្លាក់ មិនមែនរំលង');
    let vmRefused = false;
    try { listenSourceAudit(checkerFile, 'require("vm").runInNewContext("return;");'); } catch (_) { vmRefused = true; }
    if (vmRefused) ok('VM script មិនអាចយក CommonJS top-level return មកប្រើ'); else bad('VM script មិនអាចយក CommonJS top-level return មកប្រើ');
}

// ⛔ ច្បាប់ដដែល **នៅកម្រិត RTDB namespace**។ checker `emu/*` ចែក emulator
// តែមួយ (127.0.0.1:9000) ➜ namespace ថេរ ធ្វើឲ្យការរត់ ២ ស្របគ្នាសរសេរចូល
// node ដដែល។ វាកើតឡើងពិត (2026-09-04) ៖ `emu/ledger-revert` រាយ
// `❌ ធ្លាក់ 5 (ok 7)` លើ tree ដែល **មិនប៉ះកូដ ledger សោះ** ព្រោះ suite ២
// រត់ជាន់គ្នា។ វាស់មុនកែ ៖ ledger-revert ×2 ➜ ធ្លាក់ ១ និង ៣;
// restore-deadlock ×2 ➜ ធ្លាក់ ៣ និង ២។
// ⛔ ការធ្លាក់ក្លែងក្លាយគ្រោះថ្នាក់ជាងវាមើលទៅ ៖ វាបង្រៀនឲ្យជុំក្រោយចាត់ទុក
// ការធ្លាក់របស់ `emu/*` ជា «flake» — ខណៈ checker ទាំងនោះជា **ground truth
// នៃលុយ** (rules ពិត លើ RTDB ពិត)។
{
    const EMU = path.join(TOOLS, 'emu');
    let names = [];
    try { names = fs.readdirSync(EMU); } catch (e) {}

    const nsAssigns = [];
    const literalNs = [];
    for (const n of names) {
        if (!n.endsWith('.js') || n === 'ns.js' || n.startsWith('.tmp-poison-')) continue;
        let src = '';
        try { src = fs.readFileSync(path.join(EMU, n), 'utf8'); } catch (e) { continue; }
        const re = /const\s+NS\s*=\s*([^;]+);/g;
        let m;
        while ((m = re.exec(src)) !== null) {
            nsAssigns.push(n);
            if (!/emuNamespace\s*\(/.test(m[1])) literalNs.push(n + '  ' + m[1].trim().slice(0, 60));
        }
    }
    const MIN_NS = 3;
    if (nsAssigns.length < MIN_NS) {
        bad('ជាន់អប្បបរមា៖ រកឃើញ `const NS =` ក្នុង emu/ >= ' + MIN_NS, nsAssigns.length);
    } else {
        ok('ជាន់អប្បបរមា៖ ស្កេន namespace របស់ emu/ ' + nsAssigns.length + ' កន្លែង');
    }
    if (literalNs.length) {
        bad('⛔ checker emu/ ' + literalNs.length + ' ប្រើ namespace ថេរ — ត្រូវឆ្លងកាត់ `emuNamespace()`',
            literalNs.join('\n         '));
    } else {
        ok('រាល់ checker emu/ យក namespace ពី `emuNamespace()` (តែមួយក្នុងមួយការរត់)');
    }

    let sh = '';
    try { sh = fs.readFileSync(path.join(EMU, 'rules.sh'), 'utf8'); } catch (e) {}
    const shNs = (sh.match(/^NS=.*$/m) || [''])[0];
    if (shNs && /\$\$|urandom|RANDOM/.test(shNs)) {
        ok('⛔ emu/rules.sh ក៏មាន namespace តែមួយក្នុងមួយការរត់ដែរ');
    } else {
        bad('⛔ emu/rules.sh ប្រើ namespace ថេរ', shNs || '(រក NS= មិនឃើញ)');
    }

    // ⛔ ការអះអាង **ឥរិយាបថ** ៖ ការស្កេនស្តាទិចខាងលើចាក់សោត្រឹម *ឈ្មោះ*។
    // បើថ្ងៃណា `emuNamespace()` ត្រឡប់តម្លៃថេរវិញ ការស្កេននោះនៅតែបៃតង។
    let emuNs = null;
    try { ({ emuNamespace: emuNs } = require(path.join(EMU, 'ns.js'))); } catch (e) {}
    if (typeof emuNs !== 'function') {
        bad('⛔ emu/ns.js ត្រូវ export `emuNamespace()`', String(emuNs));
    } else {
        const a = emuNs('demo-zoe-probe');
        const b = emuNs('demo-zoe-probe');
        if (a !== b) ok('⛔ `emuNamespace()` ត្រឡប់តម្លៃ *ខុសគ្នា* រាល់ការហៅ');
        else bad('⛔ `emuNamespace()` ត្រឡប់តម្លៃដដែល ➜ ការរត់ ២ ស្របគ្នានៅតែប៉ះគ្នា', a);
        if (a.startsWith('demo-zoe-probe-') && /^[a-z0-9-]+$/.test(a)) {
            ok('namespace រក្សាបុព្វបទដែលអានបាន និងតួអក្សរសុវត្ថិភាព');
        } else {
            bad('namespace មិនរក្សាបុព្វបទ ឬមានតួអក្សរមិនសុវត្ថិភាព', a);
        }
        let threw = false;
        try { emuNs('Bad NS!'); } catch (e) { threw = true; }
        if (threw) ok('⛔ slug មិនត្រឹមត្រូវត្រូវបោះ មិនមែនសាង namespace ខូច');
        else bad('⛔ slug មិនត្រឹមត្រូវត្រូវបានទទួលយក ➜ namespace ខូចស្ងាត់ៗ');
    }
}

console.log('\n=== ៦ខ. ការអះអាងត្រូវ *អាចធ្លាក់បាន* — `ok()` មិនត្រូវលេបលក្ខខណ្ឌ ===');
// ⛔⛔ 🔴 **កើតឡើងពិត ២ ដង** ៖ checker ខ្លះកំណត់ `ok` ជា `(label) => { pass++ }`
// ដែលទទួល **តែស្លាក**។ ការហៅវាជា `ok(label, condition)` ធ្វើឲ្យលក្ខខណ្ឌ
// **ត្រូវបោះចោលស្ងាត់ៗ** ➜ ការអះអាងនោះ **មិនអាចធ្លាក់បានទេ** ➜ បៃតងក្លែងក្លាយ
// ដែលមើលទៅដូចការការពារពិត។
//   · `html-sink-escaping.js:261` — ជាន់អប្បបរមារបស់ការស្កេន «HTML តាមការ
//     តភ្ជាប់ខ្សែអក្សរ» ងាប់ ➜ បើ scanner នោះឈប់ផ្គូផ្គង គ្មានអ្វីនិយាយទេ។
//   · ការបន្ថែមផ្នែក ៦ ខាងលើ (2026-09-04) ធ្លាក់ចូលអន្ទាក់ដដែល ៤ កន្លែង —
//     ចាប់បានដោយ mutation testing មុន commit។
// ⛔ ការរាប់អាគុយម៉ង់ត្រូវធ្វើដោយ **parser ពិត** មិនមែនការស្កេនអក្សរ ៖
// ជំនាន់ដំបូងរបស់ការត្រួតពិនិត្យនេះប្រើ `stripLiterals()` ➜ វារាយ
// `zto-cookie-sync-test.js:182` ខុស ព្រោះ **regex literal** ដែលផ្ទុក `'` និង
// `,` (`/-File', scriptPath, .../`) មិនត្រូវបានស្គាល់ ➜ សញ្ញាក្លែងក្លាយ។
// ⛔ acorn បាត់ ➜ **ធ្លាក់** មិនមែនស្ងាត់ ៖ «វាស់មិនបាន» ≠ «ត្រឹមត្រូវ»។
{
    let acornMod = null;
    try { acornMod = require('acorn'); } catch (e) {}
    if (!acornMod) {
        bad('⛔ ការត្រួតពិនិត្យនេះត្រូវការ acorn — វាស់មិនបាន ≠ ត្រឹមត្រូវ', 'npm i acorn');
    } else {
        const walk = (node, fn) => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) { for (const n of node) walk(n, fn); return; }
            if (node.type) fn(node);
            for (const k of Object.keys(node)) {
                if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
                walk(node[k], fn);
            }
        };
        const files = [];
        for (const dir of CHECKER_DIRS) {
            let names = [];
            try { names = fs.readdirSync(dir); } catch (e) { continue; }
            for (const n of names) {
                if (!n.endsWith('.js') || n.startsWith('.tmp-poison-')) continue;
                files.push(path.join(dir, n));
            }
        }
        let defs = 0, calls = 0;
        const offenders = [];
        for (const f of files) {
            let src = '';
            try { src = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
            let ast = null;
            for (const sourceType of ['script', 'module']) {
                try { ast = acornMod.parse(src, { ecmaVersion: 2022, sourceType }); break; } catch (e) {}
            }
            if (!ast) continue;
            const arities = [];
            walk(ast, (nd) => {
                if (nd.type === 'FunctionDeclaration' && nd.id && nd.id.name === 'ok') arities.push(nd.params.length);
                if (nd.type === 'VariableDeclarator' && nd.id && nd.id.name === 'ok' && nd.init
                    && (nd.init.type === 'ArrowFunctionExpression' || nd.init.type === 'FunctionExpression')) {
                    arities.push(nd.init.params.length);
                }
            });
            if (!arities.length) continue;
            defs++;
            const arity = Math.max.apply(null, arities);
            walk(ast, (nd) => {
                if (nd.type !== 'CallExpression') return;
                if (!nd.callee || nd.callee.type !== 'Identifier' || nd.callee.name !== 'ok') return;
                calls++;
                if (nd.arguments.length > arity) {
                    offenders.push(path.basename(f) + ':' + src.slice(0, nd.start).split('\n').length
                        + '  ok() ទទួល ' + arity + ' តែហៅដោយ ' + nd.arguments.length);
                }
            });
        }
        const MIN_OK_DEFS = 40;
        if (defs < MIN_OK_DEFS) {
            bad('ជាន់អប្បបរមា៖ រកឃើញនិយមន័យ `ok()` >= ' + MIN_OK_DEFS, defs);
        } else {
            ok('ជាន់អប្បបរមា៖ ស្កេននិយមន័យ `ok()` ' + defs + ' · ការហៅ ' + calls);
        }
        if (offenders.length) {
            bad('⛔ ការអះអាង ' + offenders.length + ' បញ្ជូនលក្ខខណ្ឌទៅ `ok()` ដែលមិនអានវា ➜ ធ្លាក់មិនបាន',
                offenders.join('\n         '));
        } else {
            ok('គ្មានការហៅ `ok()` ណាបញ្ជូនអាគុយម៉ង់លើសពីអ្វីដែលនិយមន័យអាន');
        }
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
    for (const dir of CHECKER_DIRS) {
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

// ⛔ ផ្នែក ៨ ៖ `pageerror` របស់ Playwright ចាប់តែ **ការបោះ synchronous**។
// កូដ App នេះស្ទើរតែទាំងអស់ជា `async`/`.then()` ➜ **ការបដិសេធ promise
// ដែលគ្មានអ្នកចាប់** (unhandledrejection) គឺ **មើលមិនឃើញ** សម្រាប់ checker
// ទាំងអស់។ នោះមានន័យថាផ្លូវដែលស្លាប់កណ្តាលទី (spinner ជាប់ · សោមិនដោះ ·
// ស្ថានភាពចាស់) អាចរអិលកាត់ ខណៈ checker រាយ «គ្មានកំហុស runtime»។
//
// ដូច្នេះរាល់ checker browser ដែលអះអាងលើ `pageerror` ត្រូវដំឡើង
// **អ្នកបម្លែង** តាម `addInitScript` ដែលបង្វែរ `unhandledrejection`
// ទៅជាការបោះ ➜ ការអះអាងដដែលគ្របទាំង ២ ថ្នាក់។
//
// ⛔ ហើយវាត្រូវឈរ **មុន** `page.goto` ដំបូង — `addInitScript` ក្រោយ
// ការ navigate មិនអនុវត្តលើទំព័រដែលកំពុងបើកទេ ➜ **ការការពារដែលងាប់**។
console.log('\n=== ៨. checker ដែលមើល pageerror ត្រូវមើល unhandledrejection ដែរ ===');
{
    const dir = __dirname;
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { names = []; }
    const missing = [];
    const lateInstall = [];
    let watched = 0;
    for (const n of names) {
        if (!n.endsWith('.js') || n.startsWith('.tmp-poison-')) continue;
        let raw = '';
        try { raw = fs.readFileSync(path.join(dir, n), 'utf8'); } catch (e) { continue; }
        if (raw.indexOf("page.on('pageerror'") === -1 && raw.indexOf('page.on("pageerror"') === -1) continue;
        watched++;
        const at = raw.indexOf('unhandledrejection');
        if (at === -1) { missing.push(n); continue; }
        // ⛔ ច្បាប់ត្រឹមត្រូវគឺ «មាន `.goto()` **ក្រោយ** ការដំឡើង» មិនមែន
        // «ការដំឡើងមកមុន `.goto()` ដំបូង» ទេ — checker ខ្លះបើកទំព័រកម្តៅ
        // សំបកជាមុន រួចទើបចាប់ផ្តើមវាស់លើ navigate បន្ទាប់។ ការប្រៀបធៀប
        // នឹង `.goto()` ដំបូងផ្តល់ false positive ២ (វាស់បានក្នុងជុំនេះ)។
        if (raw.indexOf('.goto', at) === -1) lateInstall.push(n);
    }
    const MIN_WATCHERS = 10;
    if (watched < MIN_WATCHERS) bad('ជាន់អប្បបរមា៖ checker ដែលមើល pageerror >= ' + MIN_WATCHERS, watched);
    else ok('ជាន់អប្បបរមា៖ checker ដែលមើល pageerror មាន ' + watched);
    if (missing.length) bad('⛔ checker ' + missing.length + ' មើល pageerror តែមិនមើល unhandledrejection', missing.join(', '));
    else ok('រាល់ checker ដែលមើល pageerror ក៏មើល unhandledrejection ដែរ');
    if (lateInstall.length) bad('⛔ អ្នកបម្លែងដំឡើង **ក្រោយ** page.goto ➜ ការការពារដែលងាប់', lateInstall.join(', '));
    else ok('អ្នកបម្លែងដំឡើងមុន page.goto គ្រប់កន្លែង');
}

// ⛔ សញ្ញា SKIP ត្រូវនៅ **ដើមបន្ទាត់** ៖ ចៅក្រម `run-all.sh` ស្គាល់តែ `^\s*SKIP` ➜ «— SKIP» កណ្តាលបន្ទាត់
// ធ្វើឲ្យ checker ដែលរំលងផ្នែក browser ចេញជា PASS ពេញ សូម្បីក្រោម STRICT (វាស់បាន ៖ toast-truth 48 · csp-lazy-resource 17)។
// បន្ទាត់ពន្យល់ ២ ខាងក្រោមមិនមែនការរំលង (ពាក្យ SKIP ក្នុងប្រយោគពន្យល់)។
{
    const EXPLAINS = new Set(['exit-code-integrity.js', 'version-bump-scope.js']);
    const midLine = [];
    let skipLogs = 0;
    for (const f of fs.readdirSync(TOOLS)) {
        if (!f.endsWith('.js') || f.indexOf('.tmp-poison-') === 0 || EXPLAINS.has(f)) continue;
        const raw = fs.readFileSync(path.join(TOOLS, f), 'utf8');
        const re = /console\.log\(\s*(['"`])((?:\\n)*)([^'"`\n]*?)\1/g;
        let m;
        while ((m = re.exec(raw))) {
            if (!/\bSKIP\b/.test(m[3])) continue;
            skipLogs++;
            if (!/^\s*SKIP\b/.test(m[3])) midLine.push(f);
        }
    }
    if (skipLogs < 10) bad('ជាន់អប្បបរមា៖ សញ្ញា SKIP ក្នុង checker >= 10', skipLogs);
    else ok('ជាន់អប្បបរមា៖ សញ្ញា SKIP ក្នុង checker មាន ' + skipLogs);
    if (midLine.length) bad('⛔ checker បោះពុម្ព SKIP កណ្តាលបន្ទាត់ ➜ run-all រាប់ជា PASS ពេញ', [...new Set(midLine)].join(', '));
    else ok('រាល់សញ្ញា SKIP នៅដើមបន្ទាត់ (ចៅក្រម run-all ស្គាល់)');
}

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exitCode = fail ? 1 : 0;
})().catch((error) => {
    console.error('  FAIL   checker-coverage គាំង ➜ ' + (error && error.stack ? error.stack : error));
    process.exitCode = 1;
});
