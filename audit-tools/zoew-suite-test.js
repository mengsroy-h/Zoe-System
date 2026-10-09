// ⛔ ថ្នាក់កំហុស ៖ **ផ្នែក React របស់ ZoeW ដែលគ្មានអ្នកយាមក្នុង `run-all.sh`**។
//
// checker ផ្សេងៗក្នុង `audit-tools/` វាស់ **build វាស់** (`ZoeW/dist-audit`) ដែលកើតពី `ZoeW/src/**`។
// តែ ZoeW React មានអ្នកយាមផ្ទាល់ខ្លួនដែលវាស់អ្វីដែល build វាស់មើលមិនឃើញ ៖ type (tsc) · lint ·
// តេស្ត vitest (`tests/**`) · ភាពបរិសុទ្ធ React · bridge native ក្លែង (Back · pause/resume ·
// PTR លើ Android) · Android (`android/**` ៖ កំណែ APK · appId · សិទ្ធិ · logo) · ច្បាប់សម្អាតលុយ ·
// សោតំបន់ហាម · smoke/SW លើ build ផលិតកម្ម។ បើគ្មាន checker នេះ ឯកសារទាំងនោះ
// (tests · scripts · android · config) **គ្មាននរណារត់វាក្នុង CI** ➜ វាខូចស្ងាត់ៗ។
//
// ⛔ checker នេះរត់ **ប្រភព** (`ZoeW/package.json` + `node_modules`) មិនមែន build វាស់ ➜
//    `ZOEWSUITE_APP_DIR` ចង្អុលទៅ root ដែលមាន `ZoeW/src/main.tsx` ពិត។
// ⛔ ការខ្វះ `node_modules` ជា **FAIL ដែលមានឈ្មោះ** មិនមែន SKIP ៖ «វាស់មិនបាន» មិនមែន «ត្រឹមត្រូវ»។
// ⛔ គ្មានជំហានណាត្រូវការប្រវត្តិ git (clone shallow រត់បាន) ៖ ការធៀប ZoeW vanilla ដកចេញ (D7) ➜ តំបន់ហាមចូលចាក់សោដោយ
//    `tests/forbidden-zone-lock.test.ts` (ជំហាន `test`)។
'use strict';
process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(process.env.ZOEWSUITE_APP_DIR || path.join(__dirname, '..'));
const APP = path.join(ROOT, 'ZoeW');
const STEP_TIMEOUT_MS = Number(process.env.ZOEWSUITE_STEP_TIMEOUT_MS || 240000);

// ⛔ លំដាប់ ៖ ឧបករណ៍លឿន និងឋិតិវន្តមុន ➜ ការធ្លាក់មូលដ្ឋាន (type) បង្ហាញមុនការរត់ browser
const STEPS = ['typecheck', 'lint', 'slot:check', 'purity:check', 'test', 'doc:check', 'android:check',
    'build:only', 'notice:check', 'sw:check', 'smoke', 'native:check', 'rules:check'];
const TEST_WORKERS = process.env.ZOEWSUITE_TEST_WORKERS || 'auto';
// ⛔ `--part=k/2` (ដូច `money-guardian-test`) ៖ ជំហាន ១៣ រត់តាមលំដាប់ ➜ run-all ពេញ (lane ស្របគ្នា) ចំណាយ > ៣០០ វិ. (2.50.49 ៖ «ព្យួរ — លើសពិដាន 300s»
//    ខណៈ native:check · rules:check មិនទាន់រត់) ⛔ មិនមែនបង្កើន CHECKER_TIMEOUT ទេ។ ក្រុមទី ២ កាន់គ្រប់ជំហានដែលប្រើ `dist` តាមលំដាប់ដើម
//    (build:only មុន smoke · sw · native · rules) ➜ ផ្នែកទាំង ២ រត់ស្របគ្នាបានដោយមិនប៉ះ `dist` គ្នា · គ្មាន `--part` ➜ ជំហានទាំងអស់ (baseline · contract)។
const PART_GROUPS = [
    ['typecheck', 'lint', 'slot:check', 'purity:check', 'test', 'doc:check', 'android:check'],
    ['build:only', 'notice:check', 'sw:check', 'smoke', 'native:check', 'rules:check']
];
const PART = (() => {
    const arg = process.argv.slice(2).find((a) => a.startsWith('--part'));
    if (!arg) return { k: 1, n: 1 };
    const m = /^--part=(\d+)\/(\d+)$/.exec(arg);
    if (!m || +m[2] !== PART_GROUPS.length || +m[1] < 1 || +m[1] > +m[2]) return null;
    return { k: +m[1], n: +m[2] };
})();
const MY_STEPS = !PART ? [] : PART.n === 1 ? STEPS : PART_GROUPS[PART.k - 1];

let pass = 0, fail = 0;
function ok(label) { pass++; console.log('  ok    ' + label); }
function bad(label, detail) {
    fail++;
    console.log('  FAIL  ' + label + (detail ? '\n' + String(detail).split('\n').map((l) => '        ' + l).join('\n') : ''));
}

if (!/^(?:auto|[1-8])$/.test(TEST_WORKERS)) bad('តម្លៃ ZOEWSUITE_TEST_WORKERS ត្រូវជា auto ឬ 1–8', TEST_WORKERS);
if (!PART) bad('⛔ --part ត្រូវជា k/' + PART_GROUPS.length, process.argv.slice(2).join(' '));
{
    const flat = [].concat(...PART_GROUPS);
    const sameSet = flat.length === STEPS.length && STEPS.every((s) => flat.indexOf(s) !== -1);
    const inOrder = PART_GROUPS.every((g) => g.every((s, i) => i === 0 || STEPS.indexOf(g[i - 1]) < STEPS.indexOf(s)));
    if (sameSet && inOrder) ok('⛔ ក្រុម --part គ្របជំហានទាំងអស់ម្តងគត់ ហើយរក្សាលំដាប់ដើម (' + PART_GROUPS.map((g) => g.length).join(' + ') + ' = ' + STEPS.length + ')');
    else bad('⛔ ក្រុម --part គ្របជំហានទាំងអស់ម្តងគត់ ហើយរក្សាលំដាប់ដើម', JSON.stringify(PART_GROUPS));
}
if (PART && PART.n > 1) {
    console.log('  ផ្នែក ' + PART.k + '/' + PART.n + ' ៖ ' + MY_STEPS.join(' · '));
    let runall = '';
    try { runall = fs.readFileSync(path.join(__dirname, 'run-all.sh'), 'utf8').replace(/^\s*#.*$/gm, ''); } catch (e) {}
    const listed = [];
    for (let k = 1; k <= PART.n; k++) {
        if (new RegExp('node\\s+audit-tools/zoew-suite-test\\.js\\s+--part=' + k + '/' + PART.n + '(?=\\s|$)', 'm').test(runall)) listed.push(k);
    }
    if (listed.length === PART.n) ok('⛔ run-all.sh រត់ផ្នែកទាំង ' + PART.n + ' (ផ្នែកដែលបាត់ = ជំហានដែលគ្មាននរណារត់)');
    else bad('⛔ run-all.sh រត់ផ្នែកទាំង ' + PART.n + ' (ផ្នែកដែលបាត់ = ជំហានដែលគ្មាននរណារត់)', 'ឃើញ ' + listed.join(','));
}

function tail(text, n) {
    return String(text || '').split('\n').filter((l) => l.trim()).slice(-n).join('\n');
}
// ⛔ tail តែម្យ៉ាងលាក់ **ជំហានណា** ដែលធ្លាក់ ៖ ឧបករណ៍ browser (`rules:check` · `native:check`) រាយលទ្ធផលតាមសេណារីយ៉ូ ហើយ
//    tail ១០ បន្ទាត់ឃើញតែសេណារីយ៉ូចុងក្រោយ ➜ ដាក់បន្ទាត់ ❌ · ភាពខុសគ្នា · កំហុស ពីគ្រប់ទីកន្លែង មុន tail
function failureDetail(text, n) {
    const lines = String(text || '').split('\n').filter((l) => l.trim());
    const flagged = lines.filter((l) => /❌|FAIL|💥|^\s+\[[^\]]+\]\s|ចុច ៖/.test(l)).slice(0, 40);
    const last = lines.slice(-n);
    return flagged.filter((l) => last.indexOf(l) === -1).concat(flagged.length ? ['…'] : [], last).join('\n');
}

const pkgFile = path.join(APP, 'package.json');
let pkg = null;
try { pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8')); } catch (e) { pkg = null; }
const isReactSource = !!pkg && fs.existsSync(path.join(APP, 'src', 'main.tsx'));
if (!isReactSource) bad('ជាន់អប្បបរមា ៖ រក ZoeW React ប្រភព (package.json + src/main.tsx) មិនឃើញ', ROOT);
else ok('ជាន់អប្បបរមា ៖ ZoeW React ប្រភព (' + APP + ')');

const scripts = (pkg && pkg.scripts) || {};
const missing = STEPS.filter((s) => typeof scripts[s] !== 'string');
if (isReactSource) {
    if (missing.length) bad('script ដែលត្រូវរត់មានក្នុង package.json', missing.join(' · '));
    else ok('script ដែលត្រូវរត់មានក្នុង package.json (' + STEPS.length + ')');
}

const hasModules = fs.existsSync(path.join(APP, 'node_modules', 'vite')) && fs.existsSync(path.join(APP, 'node_modules', 'typescript'));
if (isReactSource && !hasModules) bad('dependency របស់ ZoeW ត្រូវដំឡើង (npm ci --prefix ZoeW)', path.join(APP, 'node_modules'));

if (isReactSource && hasModules && !missing.length) {
    for (const step of MY_STEPS) {
        const started = Date.now();
        const args = ['run', '-s', step];
        if (step === 'test' && /^[1-8]$/.test(TEST_WORKERS)) args.push('--', '--maxWorkers=' + TEST_WORKERS);
        const r = cp.spawnSync('npm', args, {
            cwd: APP,
            encoding: 'utf8',
            timeout: STEP_TIMEOUT_MS,
            killSignal: 'SIGKILL',
            maxBuffer: 64 * 1024 * 1024,
            env: Object.assign({}, process.env, { FORCE_COLOR: '0', NO_COLOR: '1' })
        });
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        if (r.error && r.error.code === 'ETIMEDOUT') bad('npm run ' + step + ' (ព្យួរ លើស ' + STEP_TIMEOUT_MS / 1000 + 's)', tail(r.stdout + r.stderr, 6));
        else if (r.status !== 0) bad('npm run ' + step + ' (exit ' + r.status + ')', failureDetail(r.stdout + r.stderr, 10));
        else ok('npm run ' + step + ' · ' + secs + 's');
    }
}

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exitCode = fail ? 1 : 0;
