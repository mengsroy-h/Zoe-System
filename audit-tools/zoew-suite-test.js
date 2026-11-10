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
const os = require('os');
const cp = require('child_process');

const ROOT = path.resolve(process.env.ZOEWSUITE_APP_DIR || path.join(__dirname, '..'));
const APP = path.join(ROOT, 'ZoeW');
const STEP_TIMEOUT_MS = Number(process.env.ZOEWSUITE_STEP_TIMEOUT_MS || 240000);

// ⛔ លំដាប់ ៖ ឧបករណ៍លឿន និងឋិតិវន្តមុន ➜ ការធ្លាក់មូលដ្ឋាន (type) បង្ហាញមុនការរត់ browser
const STEPS = ['typecheck', 'lint', 'slot:check', 'purity:check', 'test', 'doc:check', 'android:check',
    'build:only', 'notice:check', 'sw:check', 'smoke', 'native:check', 'rules:check'];
const TEST_WORKERS = process.env.ZOEWSUITE_TEST_WORKERS || 'auto';
// ក្រុម build/browser រក្សាពិដានដាច់ពី Vitest។ ផ្នែក test បួនប្រើ shard ដាច់គ្នា;
// គ្មាន --part នៅរត់ជំហានទាំង១៣ដូចធម្មតា។ ទាំង test និង checker រក្សាពិដានដដែល។
const PART_GROUPS = [
    ['typecheck', 'lint', 'slot:check', 'purity:check', 'test', 'doc:check', 'android:check'],
    ['build:only', 'notice:check', 'sw:check', 'smoke', 'native:check', 'rules:check'],
    ['test'],
    ['test'],
    ['test']
];
const TEST_PARTS = PART_GROUPS.map((steps, index) => steps.includes('test') ? index + 1 : 0).filter(Boolean);
function resolveTestWorkers() {
    if (!/^(?:auto|[1-8])$/.test(TEST_WORKERS)) throw new Error('ZOEWSUITE_TEST_WORKERS ត្រូវជា auto ឬ 1–8');
    if (TEST_WORKERS !== 'auto') return Number(TEST_WORKERS);
    let available = os.availableParallelism();
    if (!Number.isSafeInteger(available) || available < 1) throw new Error('ចំនួន CPU មិនត្រឹមត្រូវ');
    if (process.platform === 'linux') {
        const read = (file) => {
            try { return fs.readFileSync(file, 'utf8').trim(); }
            catch (error) { if (error.code === 'ENOENT') return null; throw error; }
        };
        const v2 = read('/sys/fs/cgroup/cpu.max');
        let quota, period;
        if (v2 !== null) {
            const fields = v2.split(/\s+/);
            if (fields.length !== 2) throw new Error('CPU quota មិនត្រឹមត្រូវ');
            quota = fields[0]; period = Number(fields[1]);
            if (!Number.isFinite(period) || period <= 0 || quota === '-1') throw new Error('CPU quota មិនត្រឹមត្រូវ');
        } else {
            quota = read('/sys/fs/cgroup/cpu/cpu.cfs_quota_us');
            period = Number(read('/sys/fs/cgroup/cpu/cpu.cfs_period_us'));
        }
        if (quota !== null && quota !== 'max' && quota !== '-1') {
            if (!Number.isFinite(Number(quota)) || Number(quota) <= 0 || !Number.isFinite(period) || period <= 0)
                throw new Error('CPU quota មិនត្រឹមត្រូវ');
            available = Math.min(available, Math.max(1, Math.floor(Number(quota) / period)));
        }
    }
    return Math.min(8, available);
}

const PART = (() => {
    const arg = process.argv.slice(2).find((a) => a.startsWith('--part'));
    if (!arg) return { k: 1, n: 1 };
    const m = /^--part=(\d+)\/(\d+)$/.exec(arg);
    if (!m || +m[2] !== PART_GROUPS.length || +m[1] < 1 || +m[1] > +m[2]) return null;
    return { k: +m[1], n: +m[2] };
})();
const MY_STEPS = !PART ? [] : PART.n === 1 ? STEPS : PART_GROUPS[PART.k - 1];

let pass = 0, fail = 0, skippedTests = 0;
function ok(label) { pass++; console.log('  ok    ' + label); }
function bad(label, detail) {
    fail++;
    console.log('  FAIL  ' + label + (detail ? '\n' + String(detail).split('\n').map((l) => '        ' + l).join('\n') : ''));
}

let testWorkers;
try { testWorkers = resolveTestWorkers(); } catch (error) { bad('CPU budget មិនត្រឹមត្រូវ', error.message); }
if (!PART) bad('⛔ --part ត្រូវជា k/' + PART_GROUPS.length, process.argv.slice(2).join(' '));
{
    const flat = [].concat(...PART_GROUPS);
    const sameSet = flat.length === STEPS.length + TEST_PARTS.length - 1 && STEPS.every((s) => flat.filter(value => value === s).length === (s === 'test' ? TEST_PARTS.length : 1));
    const inOrder = PART_GROUPS.every((g) => g.every((s, i) => i === 0 || STEPS.indexOf(g[i - 1]) < STEPS.indexOf(s)));
    if (sameSet && inOrder) ok('⛔ ក្រុម --part គ្របជំហានទាំងអស់ ហើយ test បែងជា shard ដាច់គ្នា (' + PART_GROUPS.map((g) => g.length).join(' + ') + ' ការរត់ · scripts ' + STEPS.length + ')');
    else bad('⛔ ក្រុម --part គ្របជំហានទាំងអស់ ហើយ test បែងជា shard ដាច់គ្នា', JSON.stringify(PART_GROUPS));
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
    const lines = String(text || '').replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter((l) => l.trim());
    const failedFiles = [...new Set(lines.map((line) => {
        const clean = line.replace(/\x1b\[[0-9;]*m/g, '');
        const match = /^\s*(?:FAIL\s+(\S+\.[cm]?[jt]sx?)(?=\s|$)|❯\s+(\S+\.[cm]?[jt]sx?)\s+\([^)]*\bfailed\b)/.exec(clean);
        return match && (match[1] || match[2]);
    }).filter(Boolean))];
    const files = failedFiles.length ? ['ឯកសារតេស្តដែលធ្លាក់ទាំងអស់៖', ...failedFiles.map((file) => '  - ' + file)] : [];
    const errors = lines.map((line, i) => /\b(?:\w*Error|error):|\b(?:Expected|Received|Caused by):/.test(line) ? i : -1).filter((i) => i >= 0);
    const flagged = lines.map((line, i) => /❌|FAIL|💥|^\s+\[(?!Function\b)[^\]]+\]\s|ចុច ៖/.test(line) ? i : -1).filter((i) => i >= 0);
    const context = new Set();
    for (const i of errors.concat(flagged)) {
        for (let j = Math.max(0, i - 1); j < Math.min(lines.length, i + 7) && context.size < 80; j++) {
            if (!/^\s*\[Function\b/.test(lines[j])) context.add(j);
        }
    }
    const selected = [...context].sort((a, b) => a - b).filter((i) => i < lines.length - n).map((i) => lines[i]);
    const last = lines.slice(-n).filter((line) => !/^\s*\[Function\b/.test(line));
    return files.concat(selected, selected.length ? ['…'] : [], last).map((line) => line.length > 1000 ? line.slice(0, 1000) + '…' : line).join('\n');
}

function preserveFailure(step, result, reportFile) {
    try {
        const root = path.join(APP, 'dist-audit', 'zoew-suite-failures');
        fs.mkdirSync(root, { recursive: true });
        const dir = fs.mkdtempSync(path.join(root, 'part-' + PART.k + '-of-' + PART.n + '-' + step.replace(/:/g, '-') + '-'));
        fs.writeFileSync(path.join(dir, 'stdout.log'), result.stdout || '');
        fs.writeFileSync(path.join(dir, 'stderr.log'), result.stderr || '');
        if (reportFile && fs.existsSync(reportFile)) fs.copyFileSync(reportFile, path.join(dir, 'vitest.json'));
        console.log('  ភស្តុតាងពេលធ្លាក់៖ ' + dir);
        return true;
    } catch (error) {
        console.log('  រក្សាភស្តុតាងពេលធ្លាក់មិនបាន៖ ' + error.message + (reportFile ? '\n  report ដើម៖ ' + reportFile : ''));
        return false;
    }
}

function vitestReport(file, started) {
    const report = JSON.parse(fs.readFileSync(file, 'utf8'));
    const fields = ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests'];
    if (!report || report.success !== true || fields.some((key) => !Number.isSafeInteger(report[key]) || report[key] < 0)
        || !Number.isFinite(report.startTime) || report.startTime < started || report.startTime > Date.now()
        || report.numTotalTests === 0 || report.numFailedTests !== 0 || !Array.isArray(report.testResults)
        || report.testResults.length === 0) throw new Error('Vitest report ទទេ ខូច ចាស់ ឬមានតេស្តធ្លាក់');
    const results = report.testResults.flatMap((suite) => {
        if (!Array.isArray(suite.assertionResults)) throw new Error('Vitest assertionResults មិនត្រឹមត្រូវ');
        return suite.assertionResults;
    });
    const count = (status) => results.filter((result) => result.status === status).length;
    if (results.length !== report.numTotalTests || count('passed') !== report.numPassedTests
        || count('skipped') !== report.numPendingTests || count('todo') !== report.numTodoTests
        || report.numTotalTests !== report.numPassedTests + report.numPendingTests + report.numTodoTests)
        throw new Error('Vitest ចំនួន report មិនស្មើ assertions ដែលបានរាយ');
    return report;
}

// ក្រុមដំណើរការនេះជាកម្មសិទ្ធិរបស់ជំហានតែមួយ។ កុំសម្លាប់តាមឈ្មោះ ឬ PID ដែលរកពីខាងក្រៅ។
function runStep(command, args, options) {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            resolve({ status: null, stdout: '', stderr: '', error: new Error('ជំហាននេះត្រូវការ POSIX process group សម្រាប់សម្អាតកូន') });
            return;
        }
        const child = cp.spawn(command, args, { cwd: options.cwd, env: options.env,
            detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '', error = null, settled = false;
        let aborted = false, cleanupFailed = false, outputBytes = 0;
        let deadline, cleanupDeadline;
        const stop = () => {
            if (!child.pid) return;
            if (!settled && !cleanupDeadline) cleanupDeadline = setTimeout(() => {
                cleanupFailed = true;
                error = Object.assign(new Error('បញ្ជាក់ការសម្អាតកូនមិនបាន'), { code: 'ECLEANUP' });
                child.stdout.destroy(); child.stderr.destroy(); child.unref();
                finish(null, null);
            }, 1000);
            try {
                process.kill(-child.pid, 'SIGKILL');
            } catch (cause) { if (cause.code !== 'ESRCH') { cleanupFailed = true; error = Object.assign(new Error('សម្អាតក្រុមមិនបាន៖ ' + cause.message), { code: 'ECLEANUP' }); } }
        };
        const interrupted = (signal) => {
            aborted = true;
            error = Object.assign(new Error('ជំហានត្រូវបានបញ្ឈប់៖ ' + signal), { code: signal });
            stop();
        };
        const term = () => interrupted('SIGTERM'), int = () => interrupted('SIGINT');
        const finish = async (status, signal) => {
            if (settled) return;
            settled = true;
            clearTimeout(deadline);
            clearTimeout(cleanupDeadline);
            stop();
            if (child.pid && process.platform === 'linux') {
                const until = Date.now() + 1000;
                let running = true;
                while (running && Date.now() < until) {
                    try {
                        running = fs.readdirSync('/proc').filter(name => /^\d+$/.test(name)).some(name => {
                            try {
                                const stat = fs.readFileSync('/proc/' + name + '/stat', 'utf8');
                                const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
                                return Number(fields[2]) === child.pid && !['Z', 'X'].includes(fields[0]);
                            } catch (cause) { if (cause.code === 'ENOENT' || cause.code === 'ESRCH') return false; throw cause; }
                        });
                    } catch (cause) {
                        cleanupFailed = true;
                        error = Object.assign(new Error('ពិនិត្យក្រុមមិនបាន៖ ' + cause.message), { code: 'ECLEANUP' });
                        break;
                    }
                    if (running) await new Promise(done => setTimeout(done, 10));
                }
                if (running) { cleanupFailed = true; error = Object.assign(new Error('ក្រុមកូននៅរស់ក្រោយសម្អាត'), { code: 'ECLEANUP' }); }
            }
            process.removeListener('SIGTERM', term);
            process.removeListener('SIGINT', int);
            resolve({ status, signal, stdout, stderr, error, aborted, cleanupFailed });
        };
        process.on('SIGTERM', term);
        process.on('SIGINT', int);
        deadline = setTimeout(() => {
            error = Object.assign(new Error('ជំហានលើសពិដាន'), { code: 'ETIMEDOUT' });
            stop();
        }, options.timeout);
        const collect = (stream, chunk) => {
            if (settled) return;
            const bytes = Buffer.from(chunk);
            const remaining = Math.max(0, options.maxBuffer - outputBytes);
            const retained = bytes.subarray(0, remaining);
            outputBytes += retained.length;
            let text = retained.toString();
            while (Buffer.byteLength(text) > retained.length) text = text.slice(0, -1);
            if (stream === 'stdout') stdout += text;
            else stderr += text;
            if (bytes.length > remaining) {
                if (!error) error = Object.assign(new Error('លទ្ធផលលើសព្រំដែន'), { code: 'ENOBUFS' });
                stop();
            }
        };
        child.stdout.setEncoding?.('utf8');
        child.stderr.setEncoding?.('utf8');
        child.stdout.on('data', chunk => collect('stdout', chunk));
        child.stderr.on('data', chunk => collect('stderr', chunk));
        child.on('error', cause => { error = cause; finish(null, null); });
        // exit មកមុន close៖ កូនដែលនៅកាន់ pipe មិនអាចពន្យារការសម្អាតបាន។
        child.on('exit', () => { if (!settled) { clearTimeout(deadline); stop(); } });
        child.on('close', finish);
    });
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

async function main() {
if (isReactSource && hasModules && !missing.length && !fail) {
    for (const step of MY_STEPS) {
        const failuresBefore = fail;
        const started = Date.now();
        const args = ['run', '-s', step];
        const reportDir = step === 'test' ? fs.mkdtempSync(path.join(os.tmpdir(), 'zoew-suite-report-')) : null;
        const reportFile = reportDir && path.join(reportDir, 'vitest.json');
        if (step === 'test') {
            const testArgs = ['--reporter=default', '--reporter=json', '--outputFile.json=' + reportFile];
            testArgs.push('--maxWorkers=' + testWorkers);
            if (PART.n > 1) testArgs.push('--shard=' + (TEST_PARTS.indexOf(PART.k) + 1) + '/' + TEST_PARTS.length);
            if (testArgs.length) args.push('--', ...testArgs);
        }
        const r = await runStep('npm', args, {
            cwd: APP,
            encoding: 'utf8',
            timeout: STEP_TIMEOUT_MS,
            killSignal: 'SIGKILL',
            maxBuffer: 64 * 1024 * 1024,
            env: Object.assign({}, process.env, { FORCE_COLOR: '0', NO_COLOR: '1' })
        });
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        if (r.error && r.error.code === 'ETIMEDOUT') bad('npm run ' + step + ' (ព្យួរ លើស ' + STEP_TIMEOUT_MS / 1000 + 's)', 'stdout៖\n' + tail(r.stdout, 20) + '\nstderr៖\n' + tail(r.stderr, 10));
        else if (r.error || r.status !== 0) bad('npm run ' + step + ' (exit ' + r.status + ')', failureDetail((r.error ? r.error.message + '\n' : '') + String(r.stdout || '') + '\n' + String(r.stderr || ''), 10));
        else if (step === 'test') {
            try {
                const report = vitestReport(reportFile, started);
                if (report.numPassedTests > 0) ok('npm run test · ' + secs + 's · ' + report.numPassedTests + '/' + report.numTotalTests + ' assertions');
                if (report.numPendingTests + report.numTodoTests > 0) {
                    skippedTests += report.numPendingTests + report.numTodoTests;
                    console.log('SKIP Vitest ៖ skipped ' + report.numPendingTests + ' · todo ' + report.numTodoTests);
                }
            } catch (error) { bad('npm run test ៖ គ្មានភស្តុតាង report ពេញលេញ', error.message); }
        } else ok('npm run ' + step + ' · ' + secs + 's');
        const retained = fail > failuresBefore ? preserveFailure(step, r, reportFile) : true;
        if (reportDir && retained) fs.rmSync(reportDir, { recursive: true, force: true });
        if (r.aborted || r.cleanupFailed) break;
    }
}

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'
    : skippedTests ? 'PARTIAL PASS (' + pass + '; SKIP ' + skippedTests + ')' : '✅ ជោគជ័យ ' + pass));
process.exitCode = fail ? 1 : 0;

}
main();
