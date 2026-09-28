// ⛔⛔ **checker ដែលព្យួរ មិនមែនជាការធ្លាក់ទេ — វាជាការបាត់ CI ទាំងមូល។**
//
// 🔴 កំហុសពិត វាស់បាន ២ ដងលើ GitHub Actions៖
//
//   | run | បន្ទាត់ចុងក្រោយ | បន្ទាប់ |
//   |---|---|---|
//   | `main` a465af9 (2026-08-26) | `offline-shell … PASS (19)` @ 13:53:14 | cancel @ 14:18:04 |
//   | PR #96 (2026-08-27)         | `offline-shell … PASS (19)` @ 01:56:07 | cancel @ 02:19:24 |
//
// ទាំង ២ ដងឈប់ត្រង់កន្លែងតែមួយ — `sw-install-integrity-test.js` — ហើយ
// GitHub សម្លាប់ job នៅនាទីទី ៣០ ដោយបន្សល់ log ដែល **គ្មានឈ្មោះ checker
// ដែលខូចសោះ**។ អ្នកអភិវឌ្ឍន៍ឃើញត្រឹម «The operation was canceled»។
//
// មូលហេតុឫសគល់ (បង្កើតឡើងវិញបានសម្រេច)៖ ជុំទី ១ របស់តេស្តនោះមានសំណាញ់
// `setTimeout(res, 8000)` ➜ វាចាកចេញខណៈ SW នៅ `'installing'` ➜ ជុំទី ២ ហៅ
// `await navigator.serviceWorker.ready` ដែល **គ្មានពិដាន** ➜ រង់ចាំ SW ដែល
// នឹងមិនដែល activate។ `page.evaluate()` របស់ Playwright ក៏គ្មាន timeout ដែរ
// ➜ ការរង់ចាំមិនចេះចប់។ វាបៃតង ~៩១% នៃពេល ➜ ជា **ការប្រណាំង** ដែល
// បរិស្ថានលឿនមិនដែលបង្ហាញ។
//
// ⛔ ការកែតែឯកសារនោះមិនគ្រប់គ្រាន់ទេ — checker ៣១ បើក browser ហើយរាល់
// `await` ដែលគ្មានពិដានជាកន្លែងដែលថ្នាក់នេះនឹងវិលមកវិញ។ ដូច្នេះឯកសារនេះ
// ចាក់សោ **ព្រំដែនតាមរចនាសម្ព័ន្ធ** ជំនួសការទុកចិត្តលើការប្រុងប្រយ័ត្ន។
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = process.env.HANGGUARD_APP_DIR || path.join(__dirname, '..');
const TOOLS = path.join(ROOT, 'audit-tools');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

const NOT_CHECKERS = new Set(['run-all.sh', 'trimws.js', 'strip-comments.js']);
let files = [];
try {
    files = fs.readdirSync(TOOLS).filter((f) => f.endsWith('.js') && !NOT_CHECKERS.has(f)).sort();
} catch (e) { files = []; }
const srcOf = new Map();
for (const f of files) {
    try { srcOf.set(f, fs.readFileSync(path.join(TOOLS, f), 'utf8')); } catch (e) {}
}

// ═══ ១. ជាន់អប្បបរមា — ឯកសារនេះត្រូវពិតជាបានឃើញ checker ═══
// បើគ្មានជាន់នេះ ការអះអាង «គ្មានលំនាំអាក្រក់» ខាងក្រោម **ពិតដោយស្វ័យប្រវត្តិ
// លើថតទទេ** ➜ បៃតងក្លែងក្លាយ (មេរៀន `checker-coverage.js`)។
const browserCheckers = [...srcOf.entries()].filter(([, s]) => /chromium\.launch\(/.test(s));
ok('ជាន់អប្បបរមា៖ ឃើញ checker ដែលបើក browser >= 25 (ឃើញ ' + browserCheckers.length + ')',
    browserCheckers.length >= 25);

// ═══ ២. `run-all.sh` ត្រូវដាក់ពិដានពេលវេលាលើ checker គ្រប់មួយ ═══
let runall = '';
try { runall = fs.readFileSync(path.join(TOOLS, 'run-all.sh'), 'utf8'); } catch (e) {}
ok('`run-all.sh` រុំរាល់ checker ក្នុង `timeout`',
    /timeout -k \d+ "\$CHECKER_TIMEOUT"/.test(runall),
    'រកមិនឃើញការហៅ timeout ក្នុង run()');
ok('`run-all.sh` រាយការណ៍ការផុតកំណត់ជា FAIL ដែលមានឈ្មោះ (exit 124/137)',
    /rc" -eq 124/.test(runall) && /ព្យួរ/.test(runall),
    'ការផុតកំណត់ត្រូវបែកចេញពី FAIL ធម្មតា ដើម្បីឲ្យអ្នកអានដឹងថាវាព្យួរ');

// checker-coverage ត្រូវ probe checker ជាង ១០០។ បើរត់ `execFileSync` ជាជួរ
// checker browser នីមួយៗអាចចំណាយរាប់វិនាទី ➜ meta-checker ខ្លួនឯងលើសពិដាន
// ៣០០ វិនាទី ទោះ checker ទាំងអស់ត្រឹមត្រូវ។ នេះកើតឡើងពិតក្នុង baseline
// 2.30.9 (2026-09-08)។ ចាក់សោថាវាប្រើ bounded parallelism មិនមែនជួរតែមួយ។
const coverageSrc = srcOf.get('checker-coverage.js') || '';
const emptyProbeAt = coverageSrc.indexOf('=== ៤.');
const emptyProbeEnd = coverageSrc.indexOf('=== ៥.', emptyProbeAt + 1);
const emptyProbeSrc = emptyProbeAt >= 0 && emptyProbeEnd > emptyProbeAt
    ? coverageSrc.slice(emptyProbeAt, emptyProbeEnd)
    : '';
ok('`checker-coverage` probe ថតទទេដោយ bounded parallelism (មិនព្យួរ CI > 300s)',
    /EMPTY_PROBE_CONCURRENCY/.test(emptyProbeSrc)
        && /Promise\.all\s*\(/.test(emptyProbeSrc)
        && /execFile\s*\(/.test(emptyProbeSrc)
        && !/execFileSync\s*\(/.test(emptyProbeSrc),
    'ផ្នែក probe ថតទទេនៅតែរត់ checker ជាជួរ');

// ═══ ３. គ្មាន `navigator.serviceWorker.ready` ដែល await ដោយគ្មានពិដាន ═══
// នេះជា **ការព្យួរពិត** ដែលធ្វើឲ្យ CI ដួល ២ ដង។
const bareReady = [];
for (const [f, s] of srcOf) {
    if (/await navigator\.serviceWorker\.ready\s*;/.test(s)) bareReady.push(f);
    if (/await [A-Za-z.]*\.evaluate\(\s*\(\)\s*=>\s*navigator\.serviceWorker\.ready(?!\s*,)/.test(s)) bareReady.push(f + ' (evaluate)');
}
ok('គ្មាន `serviceWorker.ready` ដែលរង់ចាំដោយគ្មានពិដាន',
    bareReady.length === 0, bareReady.join(', '));

// ═══ ４. `server.close(cb)` ដែល await ត្រូវបង្ខំបិទ socket keep-alive ═══
// Node ហៅ callback តែពេលគ្រប់ការតភ្ជាប់បិទអស់។ Chromium រក្សា keep-alive
// ➜ ការរង់ចាំនោះអាចមិនចេះចប់ ដូចថ្នាក់ទី ３ ដដែល។
const unclosed = [];
for (const [f, s] of srcOf) {
    if (!/await new Promise\(\s*\(\s*r\s*\)\s*=>\s*\{?[^}]*server\.close\(/.test(s)) continue;
    if (!/closeAllConnections/.test(s)) unclosed.push(f);
}
ok('រាល់ `await server.close()` មាន `closeAllConnections()` ជាមួយ',
    unclosed.length === 0, unclosed.join(', '));

// ═══ ５. ⛔ ការវាស់ **ឥរិយាបថ** — checker ដែលព្យួរ ត្រូវក្លាយជា FAIL ═══
// grep អាចត្រូវបញ្ឆោតដោយ comment ឬឈ្មោះ។ ការរត់ម៉ាស៊ីនរត់ពិតលើ script ដែល
// ព្យួរដោយចេតនា មិនអាចត្រូវបញ្ឆោតបានទេ។
// ⛔ ម៉ាស៊ីនរត់រស់ចន្លោះ `#@runner-begin` / `#@runner-end` (lane ស្របគ្នា ៖ `run` ចុះបញ្ជី ·
// `runall_drain` រត់) ➜ ស្រង់ប្លុកទាំងមូល។ tree ចាស់ (`run()` រត់ភ្លាម) ➜ ស្រង់តែ `run()` ដូចមុន
// ➜ ឯកសារនេះនៅវាស់ baseline បាន។ ⛔ រត់ជាមួយ checker **បៃតង** ១ ទៀតស្របគ្នា ៖ ការព្យួរមួយ
// មិនត្រូវលេបលទ្ធផលរបស់ checker ដទៃ ហើយ **env ត្រូវស្អាត** (RUNALL_STATE ទទេ) ➜ harness
// មិនសរសេរចូល state ពិតរបស់ run-all ដែលកំពុងហៅឯកសារនេះ។
let behaviour = { ran: false, out: '', ms: 0 };
const blockAt = runall.search(/^#@runner-begin$/m);
const blockEnd = runall.search(/^#@runner-end$/m);
let body = '';
if (blockAt !== -1 && blockEnd > blockAt) body = runall.slice(blockAt, blockEnd) + '\n';
else if (/^run\(\) \{/m.test(runall)) {
    const runFn = runall.slice(runall.search(/^run\(\) \{/m));
    body = runFn.slice(0, runFn.indexOf('\n}\n') + 3);
}
if (body) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-hang-'));
    const hangJs = path.join(tmp, 'hangy.js');
    const greenJs = path.join(tmp, 'green.js');
    const harness = path.join(tmp, 'harness.sh');
    fs.writeFileSync(hangJs, "console.log('   ok    ចាប់ផ្តើម');\nsetInterval(() => {}, 1 << 30);\n");
    fs.writeFileSync(greenJs, "console.log('   ok    បៃតង');\n");
    fs.writeFileSync(harness,
        'pass=0; fail=0; skip=0; partial=0\n' +
        // ⛔ បង្ខំពិដានតូចត្រង់នេះ — កុំទទួលតម្លៃពីបរិស្ថាន បើមិនដូច្នេះ
        // ការវាស់នេះរង់ចាំ ៣០០ វិនាទីពិត ហើយធ្លាក់ដោយហេតុផលមិនពាក់ព័ន្ធ។
        'CHECKER_TIMEOUT=5\n' +
        'if command -v timeout >/dev/null 2>&1; then HAS_TIMEOUT=1; else HAS_TIMEOUT=0; fi\n' +
        body +
        '\nrun "សាកល្បង" node ' + JSON.stringify(hangJs) +
        '\nrun "បៃតង" node ' + JSON.stringify(greenJs) +
        '\nif declare -F runall_drain >/dev/null; then runall_drain; fi' +
        '\necho "FAILCOUNT=$fail PASSCOUNT=$pass"\n');
    const env = Object.assign({}, process.env, { RUNALL_JOBS: '2', RUNALL_STATE: '' });
    delete env.RUNALL_ONLY; delete env.RUNALL_RESUME; delete env.RUNALL_TREE_HASH;
    const t0 = Date.now();
    try {
        behaviour.out = execFileSync('bash', [harness], { encoding: 'utf8', timeout: 60000, env });
        behaviour.ran = true;
    } catch (e) { behaviour.out = String((e && e.stdout) || e); }
    behaviour.ms = Date.now() - t0;
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
}
ok('⛔ ឥរិយាបថ៖ checker ដែលព្យួរ ➜ FAIL ដែលមានឈ្មោះ (មិនមែនការព្យួរ)',
    behaviour.ran && /សាកល្បង[^\n]*FAIL[^\n]*ព្យួរ/.test(behaviour.out) && /FAILCOUNT=1 /.test(behaviour.out),
    behaviour.out.trim().slice(0, 300));
ok('⛔ ឥរិយាបថ៖ ការព្យួរមិនលេបលទ្ធផលរបស់ checker ដទៃ (បៃតង ➜ PASS)',
    behaviour.ran && /បៃតង[^\n]*PASS/.test(behaviour.out) && /PASSCOUNT=1\b/.test(behaviour.out),
    behaviour.out.trim().slice(0, 300));
ok('⛔ ឥរិយាបថ៖ ការផុតកំណត់ត្រូវគោរព `CHECKER_TIMEOUT` (ចប់ក្នុង < 60s)',
    behaviour.ran && behaviour.ms < 60000, 'ms=' + behaviour.ms);

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
