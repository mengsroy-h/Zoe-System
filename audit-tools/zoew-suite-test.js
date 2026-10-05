// ⛔ ថ្នាក់កំហុស ៖ **ផ្នែក React របស់ ZoeW ដែលគ្មានអ្នកយាមក្នុង `run-all.sh`**។
//
// checker ផ្សេងៗក្នុង `audit-tools/` វាស់ **build វាស់** (`ZoeW/dist-audit`) ដែលកើតពី `ZoeW/src/**`។
// តែ ZoeW React មានអ្នកយាមផ្ទាល់ខ្លួនដែលវាស់អ្វីដែល build វាស់មើលមិនឃើញ ៖ type (tsc) · lint ·
// តេស្ត vitest (`tests/**`) · ភាពបរិសុទ្ធ React · bridge native ក្លែង (Back · pause/resume ·
// PTR លើ Android) · Android (`android/**` ៖ កំណែ APK · appId · សិទ្ធិ · logo) · ច្បាប់សម្អាតលុយ ·
// parity ជាមួយ ZoeW ដើម · smoke/SW លើ build ផលិតកម្ម។ បើគ្មាន checker នេះ ឯកសារទាំងនោះ
// (tests · scripts · android · config) **គ្មាននរណារត់វាក្នុង CI** ➜ វាខូចស្ងាត់ៗ។
//
// ⛔ checker នេះរត់ **ប្រភព** (`ZoeW/package.json` + `node_modules`) មិនមែន build វាស់ ➜
//    `ZOEWSUITE_APP_DIR` ចង្អុលទៅ root ដែលមាន `ZoeW/src/main.tsx` ពិត។
// ⛔ ការខ្វះ `node_modules` ឬ ZoeW ដើម (`.original`) ជា **FAIL ដែលមានឈ្មោះ** មិនមែន SKIP ៖
//    «វាស់មិនបាន» មិនមែន «ត្រឹមត្រូវ»។
'use strict';
process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(process.env.ZOEWSUITE_APP_DIR || path.join(__dirname, '..'));
const APP = path.join(ROOT, 'ZoeW');
const STEP_TIMEOUT_MS = Number(process.env.ZOEWSUITE_STEP_TIMEOUT_MS || 240000);

// ⛔ លំដាប់ ៖ ឧបករណ៍លឿន និងឋិតិវន្តមុន ➜ ការធ្លាក់មូលដ្ឋាន (type) បង្ហាញមុនការរត់ browser
// ⛔ `--parity` (ការងារ run-all ដាច់ដោយឡែក ព្រោះពិដាន ៣០០ វិ./checker) ៖ parity DOM · layout · live · deep ធៀប ZoeW ដើម។
//    វាធ្លាប់នៅក្រៅ CI ➜ ក្រហម ៧៩/៧៩ · ១៨/១៨ · ៣/៣ តាំងពី 2.43.0 ដោយគ្មាននរណាដឹង (អ្នកយាមដែលគ្មាននរណារត់ = គ្មានអ្នកយាម)។
//    ⛔ build ចូល `dist-parity` ឯកជន (`ZOEW_PARITY_DIST`) និង ZoeW ដើមចូលថតឯកជន (`ORIGINAL_DIR`) ➜ មិនប្រណាំង `dist` ·
//    `.original` ជាមួយ zoew-suite ដែលរត់ស្របគ្នាក្នុង lane ផ្សេង
const PARITY = process.argv.includes('--parity');
const STEPS = PARITY ? ['build:parity', 'parity:dom', 'parity:live', 'parity:deep']
    : ['typecheck', 'lint', 'slot:check', 'purity:check', 'test', 'doc:check', 'android:check',
        'logic:check', 'parity', 'build:only', 'sw:check', 'smoke', 'native:check', 'rules:check'];
const STEP_ENV = {};
const TEST_WORKERS = process.env.ZOEWSUITE_TEST_WORKERS || 'auto';

let pass = 0, fail = 0;
function ok(label) { pass++; console.log('  ok    ' + label); }
function bad(label, detail) {
    fail++;
    console.log('  FAIL  ' + label + (detail ? '\n' + String(detail).split('\n').map((l) => '        ' + l).join('\n') : ''));
}

if (!/^(?:auto|[1-8])$/.test(TEST_WORKERS)) bad('តម្លៃ ZOEWSUITE_TEST_WORKERS ត្រូវជា auto ឬ 1–8', TEST_WORKERS);

function tail(text, n) {
    return String(text || '').split('\n').filter((l) => l.trim()).slice(-n).join('\n');
}
// ⛔ tail តែម្យ៉ាងលាក់ **ជំហានណា** ដែលធ្លាក់ ៖ parity:deep រាយលទ្ធផលតាមសេណារីយ៉ូ ហើយ tail ១០ បន្ទាត់ឃើញតែសេណារីយ៉ូចុងក្រោយ
//    (វាស់បាន ៖ `❌ ជំហានខុស 3` ក្នុង CI ពេញ ខណៈ tail បង្ហាញតែជំហាន ✅ របស់សេណារីយ៉ូ Google Sheet) ➜ ដាក់បន្ទាត់ ❌ · ភាពខុសគ្នា
//    · កំហុស ពីគ្រប់ទីកន្លែង មុន tail
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

// ZoeW ដើម (vanilla) ជាអ្នកសម្រេច parity/logic ➜ ទាញពី git បើអវត្តមាន
if (isReactSource && hasModules && PARITY) {
    const own = fs.mkdtempSync(path.join(require('os').tmpdir(), 'zoew-parity-original-'));
    const r = cp.spawnSync('bash', [path.join(APP, 'scripts', 'fetch-original.sh')], {
        cwd: APP, encoding: 'utf8', timeout: 60000, env: Object.assign({}, process.env, { ORIGINAL_DIR: own })
    });
    if (r.status !== 0) bad('ទាញ ZoeW ដើមពី git ចូលថតឯកជន សម្រាប់ parity', tail(r.stdout + r.stderr, 4));
    STEP_ENV.OLD_APP_DIR = path.join(own, 'ZoeW');
    STEP_ENV.ZOEW_PARITY_DIST = path.join(APP, 'dist-parity');
    process.on('exit', () => { try { fs.rmSync(own, { recursive: true, force: true }); } catch (e) {} });
} else if (isReactSource && hasModules && !fs.existsSync(path.join(APP, '.original', 'ZoeW', 'app.js'))) {
    const r = cp.spawnSync('bash', [path.join(APP, 'scripts', 'fetch-original.sh')], { cwd: APP, encoding: 'utf8', timeout: 60000 });
    if (r.status !== 0) bad('ទាញ ZoeW ដើមពី git (`npm run original:fetch`) សម្រាប់ parity/logic', tail(r.stdout + r.stderr, 4));
}

if (isReactSource && hasModules && !missing.length) {
    for (const step of STEPS) {
        const started = Date.now();
        const args = ['run', '-s', step];
        if (step === 'test' && /^[1-8]$/.test(TEST_WORKERS)) args.push('--', '--maxWorkers=' + TEST_WORKERS);
        const r = cp.spawnSync('npm', args, {
            cwd: APP,
            encoding: 'utf8',
            timeout: STEP_TIMEOUT_MS,
            killSignal: 'SIGKILL',
            maxBuffer: 64 * 1024 * 1024,
            env: Object.assign({}, process.env, { FORCE_COLOR: '0', NO_COLOR: '1' }, STEP_ENV)
        });
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        if (r.error && r.error.code === 'ETIMEDOUT') bad('npm run ' + step + ' (ព្យួរ លើស ' + STEP_TIMEOUT_MS / 1000 + 's)', tail(r.stdout + r.stderr, 6));
        else if (r.status !== 0) bad('npm run ' + step + ' (exit ' + r.status + ')', failureDetail(r.stdout + r.stderr, 10));
        else ok('npm run ' + step + ' · ' + secs + 's');
    }
}

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exitCode = fail ? 1 : 0;
