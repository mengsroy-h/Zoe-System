const fs = require('fs');
const path = require('path');
const cp = require('child_process');

let acorn;
try { acorn = require('acorn'); } catch (e) { console.log('SKIP — ត្រូវការ acorn (npm i acorn)'); process.exit(0); }

const ROOT = process.env.EXITCODE_APP_DIR || path.join(__dirname, '..');
const TOOLS = path.join(ROOT, 'audit-tools');
const RUNALL = path.join(TOOLS, 'run-all.sh');
const ZTO_IMPORT_TEST = '../zto-import/test.js';

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : '')); }
}

console.log('=== exit-code-integrity — ការធ្លាក់ត្រូវក្លាយជា exit code មិនសូន្យ ===');

const ASSERT_CALL = /\b(ok|bad|check|fails?|problem|report)\s*\(/;
const SKIP_LOG = /console\.log\([^)]*SKIP/;

function checkersFromRunAll() {
    if (!fs.existsSync(RUNALL)) return [];
    const sh = fs.readFileSync(RUNALL, 'utf8');
    const found = new Set();
    for (const m of sh.matchAll(/audit-tools\/([A-Za-z0-9_\-/]+\.js)/g)) found.add(m[1]);
    for (const m of sh.matchAll(/for\s+\w+\s+in\s+([^;]+);\s*do/g)) {
        for (const w of m[1].split(/\s+/)) if (/^[A-Za-z0-9_\-/]+$/.test(w) && fs.existsSync(path.join(TOOLS, w + '.js'))) found.add(w + '.js');
    }
    const normal = sh.replace(/^\s*#.*$/gm, '').split(/if \[ -n "\$BASE" \]/)[0];
    if (/^\s*run\s+"[^"]*"\s+node\s+zto-import\/test\.js(?=\s|$)/m.test(normal)) found.add(ZTO_IMPORT_TEST);
    return [...found].filter((f) => fs.existsSync(path.join(TOOLS, f)));
}

const checkers = checkersFromRunAll();
const MIN_CHECKERS = 40;
ok('zto-import/test.js ៖ រកឃើញការរត់ពិតក្នុងផ្នែកធម្មតា', checkers.includes(ZTO_IMPORT_TEST));
ok('ជាន់អប្បបរមា៖ រកឃើញ checker ក្នុង run-all.sh >= ' + MIN_CHECKERS + ' (ឃើញ ' + checkers.length + ')',
    checkers.length >= MIN_CHECKERS, { found: checkers.length });
if (checkers.length < MIN_CHECKERS) {
    console.log('\n❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')');
    process.exit(1);
}

function ancestorsOf(ast, target) {
    const stack = [], out = [];
    (function walk(n, parents) {
        if (!n || typeof n !== 'object') return;
        if (n === target) { out.push(...parents); return; }
        const next = n.type ? parents.concat([n]) : parents;
        for (const k in n) {
            if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
            const v = n[k];
            if (Array.isArray(v)) v.forEach((c) => walk(c, next));
            else if (v && typeof v === 'object' && v.type) walk(v, next);
        }
    })(ast, stack);
    return out;
}

function collect(ast, type) {
    const out = [];
    (function walk(n) {
        if (!n || typeof n !== 'object') return;
        if (n.type === type) out.push(n);
        for (const k in n) {
            if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
            const v = n[k];
            if (Array.isArray(v)) v.forEach(walk);
            else if (v && typeof v === 'object' && v.type) walk(v);
        }
    })(ast);
    return out;
}

const offenders = [];
let scannedStatic = 0;

for (const rel of checkers) {
    const file = path.join(TOOLS, rel);
    let src;
    try { src = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
    let ast;
    try { ast = acorn.parse(src, { ecmaVersion: 2022, locations: true }); } catch (e) { continue; }
    scannedStatic++;

    const ENV_FLAGS = [...src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*process\.env\b/g)].map((m) => m[1]);

    const firstAssert = (() => {
        const m = ASSERT_CALL.exec(src.replace(/^[\s\S]*?\n(?=(?:const|let|var|function|\/\/))/, (s) => s));
        return m ? src.indexOf(m[0]) : -1;
    })();

    for (const call of collect(ast, 'CallExpression')) {
        const c = call.callee;
        if (!(c && c.type === 'MemberExpression' && c.object && c.object.name === 'process'
              && c.property && c.property.name === 'exit')) continue;
        const arg = call.arguments[0];
        const isZero = !arg || (arg.type === 'Literal' && arg.value === 0);
        if (!isZero) continue;
        if (firstAssert === -1 || call.start < firstAssert) continue;

        // អនុញ្ញាត ៖ ផ្លូវ SKIP (បន្ទាត់ជិតៗនិយាយ SKIP) ឬការចេញដែលអាស្រ័យលើអថេររាប់ការធ្លាក់
        const line = src.slice(src.lastIndexOf('\n', call.start) + 1, src.indexOf('\n', call.start));
        if (SKIP_LOG.test(line)) continue;
        const near = src.slice(Math.max(0, call.start - 400), call.start);
        if (SKIP_LOG.test(near.slice(near.lastIndexOf('\n{') + 1))) continue;

        const guards = ancestorsOf(ast, call)
            .filter((a) => a.type === 'IfStatement' || a.type === 'ConditionalExpression')
            .map((a) => src.slice(a.test.start, a.test.end));
        // អាស្រ័យលើអថេររាប់ការធ្លាក់ ➜ ត្រឹមត្រូវ
        const guarded = guards.some((g) => /\b(fail|fails|failed|problem|problems|gap|gaps|offend|offenders|bad|error|errors|miss|missing|dirty)\w*\b/i.test(g));
        if (guarded) continue;
        // របៀប «របាយការណ៍តែប៉ុណ្ណោះ» ដែលបើកដោយ env flag ➜ ត្រឹមត្រូវ (បិទតាមលំនាំដើម)
        if (guards.some((g) => ENV_FLAGS.some((f) => new RegExp('\\b' + f + '\\b').test(g)))) continue;

        offenders.push(rel + ':' + call.loc.start.line + '  process.exit(0) ក្រោយការអះអាង — ការធ្លាក់មិនឡើងដល់ exit code');
    }
}

ok('ស្កេន checker ' + scannedStatic + ' ឯកសារ (AST)', scannedStatic >= MIN_CHECKERS, { scannedStatic });
ok('គ្មាន `process.exit(0)` ដែលឈរក្រោយការអះអាងដោយគ្មានច្រកទ្វារ',
    offenders.length === 0, offenders.slice(0, 10));

// ២ — ការវាស់ **ឥរិយាបថ**៖ ពុលការអះអាងទាំងអស់ ➜ checker ត្រូវចេញដោយ exit != 0
console.log('\n=== ការវាស់ឥរិយាបថ ៖ ការអះអាងធ្លាក់ ➜ exit != 0 ===');

const POISON = [
    [/function check\(name, condition, detail\) \{/, 'function check(name, condition, detail) { condition = false;'],
    [/function ok\(label, cond, detail\) \{/, 'function ok(label, cond, detail) { cond = false;'],
    [/function ok\(cond, label, got\) \{/, 'function ok(cond, label, got) { cond = false;'],
    [/function ok\(label, condition, detail\) \{/, 'function ok(label, condition, detail) { condition = false;'],
    [/function ok\(label, cond, got\) \{/, 'function ok(label, cond, got) { cond = false;'],
    [/const ok = \(n, c, d\) => results\.push\(\[n, !!c, d\]\);/, 'const ok = (n, c, d) => results.push([n, false, d]);']
];

function poisonSource(src) {
    for (const [re, rep] of POISON) if (re.test(src)) return src.replace(re, rep);
    // ថយក្រោយ ៖ បង្កើនអថេររាប់ការធ្លាក់ដែល `process.exit(<ident>...)` យោងដល់។
    // ⛔ ២ ច្បាប់ដែលធ្វើឲ្យការថយក្រោយនេះ **ស្មោះ**៖
    //   ១. កុំពុល `const` — `x++` លើ `const` បោះ TypeError ➜ exit != 0 ➜
    //      ការគាំង **មើលទៅដូចការធ្លាក់ត្រឹមត្រូវ** ➜ បៃតងក្លែងក្លាយថ្នាក់ថ្មី។
    //   ២. ជ្រើសឈ្មោះដែល **មើលទៅដូចអថេររាប់ការធ្លាក់** ជាមុន; បើគ្មាន
    //      នោះយើងពុលមិនបាន ➜ ត្រឡប់ `null` ហើយវារាយក្នុង `unpoisonable`
    //      (មើលឃើញ) ជំនួសការពុលអថេរខុសដោយស្ងាត់។
    const FAILISH = /^(fail|fails|failed|failures|problem|problems|gap|gaps|offend|offenders|bad|errors?|miss|missing|dirty|totalGaps)$/i;
    const exits = [...src.matchAll(/process\.exit\(([^)]*)\)/g)];
    const ids = [];
    for (let i = exits.length - 1; i >= 0; i--) {
        const expr = exits[i][1];
        if (/^\s*\d+\s*$/.test(expr)) continue;
        for (const m of expr.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) ids.push(m[1]);
    }
    const ordered = ids.filter((n) => FAILISH.test(n)).concat(ids.filter((n) => !FAILISH.test(n)));
    for (const id of ordered) {
        const decl = new RegExp('((?:let|var)[^;\\n]*?\\b' + id + '\\s*=\\s*[^;,\\n]*)([;,])');
        if (decl.test(src)) return src.replace(decl, '$1$2 ' + id + '++;');
    }
    return null;
}

const BUDGET_MS = parseInt(process.env.EXITCODE_TIMEOUT_MS || '60000', 10);
// ⛔ ការពុលរត់ **ស្របគ្នាតាមចំនួនកំណត់** មិនមែនម្តងមួយៗ។
// 🔴 វាស់បាន (2.42.8) ៖ checker កូន ១០៨ រត់ជាជួរ ➜ ២៨០ វិ. លើម៉ាស៊ីន ៤ CPU និង **៣៦៧ វិ.** លើម៉ាស៊ីនមួយទៀត ➜ លើសពិដាន
// ៣០០ វិ. របស់ `run-all.sh` ➜ «*** FAIL *** (ព្យួរ)» ខណៈគ្មាន checker ណាខូចសោះ។ ការរត់ស្របគ្នាក្នុងពិដាន
// (`EXITCODE_CONCURRENCY` · លំនាំដើម = ចំនួន CPU ក្នុងចន្លោះ ២–៨) ជាដំណោះស្រាយតាមរចនាសម្ព័ន្ធ ដូច probe ថតទទេរបស់
// `checker-coverage` ⛔ មិនមែនការបង្កើន `CHECKER_TIMEOUT` (នោះលាក់ checker ដែលព្យួរពិត)។
const CONCURRENCY = (() => {
    const asked = parseInt(process.env.EXITCODE_CONCURRENCY || '', 10);
    if (Number.isFinite(asked) && asked >= 1) return Math.min(asked, 16);
    let cpus = 2;
    try { cpus = require('os').cpus().length || 2; } catch (e) {}
    return Math.min(8, Math.max(2, cpus));
})();
// ⛔ `emu/*` ចែក RTDB emulator តែមួយ ➜ រត់ក្នុងផ្លូវតែមួយ (ម្តងមួយ) ស្របនឹងក្រុមផ្សេង។
const SERIAL_LANE = (rel) => rel.startsWith('emu/');
const OUT_CAP = 4 * 1024 * 1024;
// ⛔ ពិដានពេល settle **តាមរចនាសម្ព័ន្ធ** ៖ SIGKILL នៅពេលផុតថវិកា ហើយបើ `close` មិនមក (ចៅដែលកាន់ pipe) ឬការសម្លាប់
// ធ្លាក់ ➜ ឧបករណ៍កំណត់ម៉ោងទី ២ បញ្ចប់ការរង់ចាំ។ ដំណើរការឈប់ ➜ រង់ចាំ `close` តែ ២ វិ. ដើម្បីកុំឲ្យចៅដែលកាន់ stdout
// ពន្យារសាលក្រមដែលដឹងរួច។
const EXIT_TO_CLOSE_GRACE_MS = 2000;
const HARD_GRACE_MS = 5000;
const liveChildren = new Set();

function runPoisonedChild(file, budgetMs) {
    return new Promise((resolve) => {
        const t0 = Date.now();
        let out = '', settled = false, timedOut = false, exitCode = null, exitSignal = null, exited = false;
        let graceTimer = null;
        let child;
        const finish = (code, signal) => {
            if (settled) return;
            settled = true;
            clearTimeout(killTimer); clearTimeout(hardTimer); clearTimeout(graceTimer);
            if (child) liveChildren.delete(child);
            resolve({ code, signal, timedOut, out, ms: Date.now() - t0 });
        };
        const killTimer = setTimeout(() => {
            timedOut = true;
            try { child.kill('SIGKILL'); } catch (e) {}
        }, budgetMs);
        const hardTimer = setTimeout(() => finish(exited ? exitCode : null, exited ? exitSignal : 'SIGKILL'),
            budgetMs + HARD_GRACE_MS);
        try {
            child = cp.spawn(process.execPath, [file], {
                cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
                env: Object.assign({}, process.env, { EXITCODE_CHILD: '1' })
            });
        } catch (e) {
            out = String(e && e.message || e);
            finish(null, null);
            return;
        }
        liveChildren.add(child);
        const take = (chunk) => { if (out.length < OUT_CAP) out += chunk; };
        child.stdout.setEncoding('utf8'); child.stdout.on('data', take);
        child.stderr.setEncoding('utf8'); child.stderr.on('data', take);
        child.on('error', (e) => { out += '\n' + String(e && e.message || e); finish(null, null); });
        child.on('exit', (code, signal) => {
            exited = true; exitCode = code; exitSignal = signal;
            graceTimer = setTimeout(() => finish(code, signal), EXIT_TO_CLOSE_GRACE_MS);
        });
        child.on('close', (code, signal) => finish(exited ? exitCode : code, exited ? exitSignal : signal));
    });
}

// ⛔⛔ **timeout · crash ≠ «ការធ្លាក់ឡើងដល់ exit code»**។ 🔴 ជំនាន់មុនរាប់ `rc = 'timeout/crash'` ជា `rc !== 0` ➜
// «ត្រឹមត្រូវ» ➜ checker ដែល **ព្យួរ** ពេលការអះអាងធ្លាក់ (ដែលក្នុង `run-all.sh` ក្លាយជា FAIL (ព្យួរ) ឬ GitHub cancel
// job) ត្រូវរាយថាបៃតង។ ដូច្នេះសាលក្រមមាន ៤ ៖ `failed` (exit ≠ 0 ពិត ➜ ល្អ) · `skipped` · `fake-green` ·
// **`unverified`** (ផុតថវិកា · សម្លាប់ដោយ signal · បើកមិនកើត ➜ វាស់មិនបាន ➜ FAIL មិនមែនលើកលែង)។
function poisonVerdict(r) {
    if (!r || r.timedOut || typeof r.code !== 'number') return 'unverified';
    if (r.code !== 0) return 'failed';
    if (/^SKIP\b/m.test(String(r.out || ''))) return 'skipped';
    return 'fake-green';
}
{
    const cases = [
        [{ code: 1, signal: null, timedOut: false, out: '' }, 'failed'],
        [{ code: 2, signal: null, timedOut: false, out: 'SKIP x' }, 'failed'],
        [{ code: 0, signal: null, timedOut: false, out: 'SKIP — គ្មាន emulator' }, 'skipped'],
        [{ code: 0, signal: null, timedOut: false, out: '  FAIL  x' }, 'fake-green'],
        [{ code: null, signal: 'SIGKILL', timedOut: true, out: '' }, 'unverified'],
        [{ code: 1, signal: null, timedOut: true, out: '' }, 'unverified'],
        [{ code: null, signal: 'SIGSEGV', timedOut: false, out: '' }, 'unverified'],
        [{ code: null, signal: null, timedOut: false, out: 'spawn ENOENT' }, 'unverified'],
        [null, 'unverified']
    ];
    const wrong = cases.filter(([r, want]) => poisonVerdict(r) !== want).map(([r, want]) => ({ r, want, got: poisonVerdict(r) }));
    ok('សាលក្រមពុល ៖ timeout · signal · បើកមិនកើត ➜ unverified (មិនមែន «ធ្លាក់ត្រឹមត្រូវ»)', wrong.length === 0, wrong);
}

async function runPool(jobs, width, worker) {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(width, jobs.length) }, async () => {
        for (;;) {
            const index = next++;
            if (index >= jobs.length) return;
            await worker(jobs[index]);
        }
    }));
}

const runnable = checkers.filter((rel) => {
    const src = fs.readFileSync(path.join(TOOLS, rel), 'utf8');
    return !/playwright-core/.test(src);       // browser checkers ៖ ថ្លៃពេក សម្រាប់ការពុល
});

// ⛔⛔ **ឯកសារដើមរបស់ checker មិនត្រូវត្រូវសរសេរជាន់ឡើយ។**
//
// 🔴 ជំនាន់មុនរបស់ឯកសារនេះពុល checker **នៅនឹងកន្លែង** រួចស្តារវិញតាម ៣ ផ្លូវ
// (`finally` · `process.on('exit')` · handler របស់ signal)។ ការការពារនោះ
// **មិនអាចដំណើរការបានទេ** ៖ រង្វិលជុំពុលហៅ `execFileSync` ដែល **ទប់ event
// loop** ➜ handler របស់ SIGTERM ជា callback JS ដែល **រត់មិនបាន** ខណៈការហៅ
// នោះកំពុងទប់។ `run-all.sh` ប្រើ `timeout -k 10 300` ➜ SIGTERM (រត់មិនបាន)
// រួច **SIGKILL** ១០ វិនាទីក្រោយ ដែល **គ្មាន handler ណាចាប់បានសោះ**។
//
// វាស់បាន ៖ ការពុល ៥៣ checker × ពិដាន ៦០ វិ. ក្នុងមួយ ➜ គ្រាន់តែ checker
// **៤** ដែលឈានដល់ពិដាន ក៏លើស ៣០០ វិ. ដែរ (ការរត់ធម្មតា ៧២ វិ.)។ ផលនៃ
// ការសម្លាប់ ៖ `audit-tools/<checker>.js` នៅ **ពុល** ក្នុង working tree ➜
// `git commit -a` បន្ទាប់ ship checker ដែល `cond = false` ជាប់ជាប់ ➜
// **ឧបករណ៍ audit ខ្លួនវាបាក់ដោយស្ងាត់** — ជាថ្នាក់អាក្រក់ជាងបៃតងក្លែងក្លាយ។
//
// ការកែ ៖ ពុលចូល **ឯកសារស្រមោលក្បែរឯកសារដើម** (ថតដដែល ➜ `__dirname`,
// `require` ទាក់ទង និង `__filename` នៅដំណើរការដូចដើម) រួចលុបវាចោល។
// ឯកសារដើម **មិនដែលត្រូវបើកសរសេរសោះ** ➜ ការសម្លាប់នៅចំណុចណាក៏ដោយ
// (រួមទាំង SIGKILL) **មិនអាចធ្វើឲ្យ repo ខូចបានទេ**។ សំណល់ដែលនៅសល់ជា
// ឯកសារ `.tmp-poison-*` ដែលគ្មានគ្រោះថ្នាក់ ហើយត្រូវបោសចោលពេលចាប់ផ្តើម។
const POISON_PREFIX = '.tmp-poison-';
const POISON_DIRS = [TOOLS, path.join(TOOLS, 'emu'), path.join(ROOT, 'zto-import')];

function sweepPoisonLeftovers() {
    for (const dir of POISON_DIRS) {
        let names = [];
        try { names = fs.readdirSync(dir); } catch (e) { continue; }
        for (const n of names) {
            if (!n.startsWith(POISON_PREFIX)) continue;
            try { fs.unlinkSync(path.join(dir, n)); } catch (e) {}
        }
    }
}

const shadows = new Set();
function dropShadows() {
    for (const f of shadows) { try { fs.unlinkSync(f); } catch (e) {} }
    shadows.clear();
}
// ⛔ កូនដែលកំពុងរត់ត្រូវសម្លាប់ពេលឪពុកចេញ (SIGTERM ពី `timeout` ក៏ដោយ) — បើមិនដូច្នេះ កូនដែលពុលហើយព្យួរ
// ក្លាយជាកំព្រាស៊ី CPU ក្នុង checker បន្ទាប់ៗរបស់ `run-all.sh`។
function killLiveChildren() {
    for (const c of liveChildren) { try { c.kill('SIGKILL'); } catch (e) {} }
    liveChildren.clear();
}
process.on('exit', () => { killLiveChildren(); dropShadows(); });
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) => {
    process.on(sig, () => { killLiveChildren(); dropShadows(); process.exit(1); });
});
sweepPoisonLeftovers();

let poisoned = 0, unpoisonable = [], fakeGreen = [], skippedInPoison = [], unverified = [];
let ztoPoison = null;
const timings = [];

async function poisonOne(rel) {
    const file = path.join(TOOLS, rel);
    const src = fs.readFileSync(file, 'utf8');
    const bad = poisonSource(src);
    if (!bad) { unpoisonable.push(rel); return; }
    // ⛔ ស្រមោល **ក្បែរ** ឯកសារដើម — ថតដដែល ➜ `__dirname` ·
    // `require('./x')` · `__filename` នៅដំណើរការដូចដើម។
    const shadow = path.join(path.dirname(file), POISON_PREFIX + process.pid + '-' + path.basename(file));
    shadows.add(shadow);
    fs.writeFileSync(shadow, bad);
    let result;
    try {
        result = await runPoisonedChild(shadow, BUDGET_MS);
    } finally {
        try { fs.unlinkSync(shadow); } catch (e) {}
        shadows.delete(shadow);
    }
    poisoned++;
    timings.push([rel, result.ms]);
    const verdict = poisonVerdict(result);
    if (rel === ZTO_IMPORT_TEST) {
        const summary = /zto-import — (\d+) assertions passed, (\d+) failed/.exec(result.out);
        ztoPoison = { rc: result.code, verdict, passed: summary ? Number(summary[1]) : null,
            failed: summary ? Number(summary[2]) : null, unchanged: fs.readFileSync(file, 'utf8') === src };
    }
    if (verdict === 'failed') return;
    if (verdict === 'unverified') {
        unverified.push(rel + ' (' + (result.timedOut ? 'ផុតថវិកា ' + BUDGET_MS + 'ms' : 'signal=' + result.signal + ' code=' + result.code) + ')');
        return;
    }
    // ⛔ ការចេញ exit 0 **ខណៈ SKIP** មិនមែនជាបៃតងក្លែងក្លាយទេ — checker
    // នោះ **មិនបានអះអាងអ្វីសោះ** ហើយ `run-all.sh` រាយវាជា SKIPPED មិនមែន
    // PASS។ ការពុលមិនអាចវាស់អ្វីបានទេ ពេលគ្មានការអះអាងណារត់។
    // ឧ. `emu/*` ពេលគ្មាន RTDB emulator (CI ដាក់ `CRUD_FLOW_STRICT=1`
    // ដែលបង្វែរ SKIP នោះទៅជាការធ្លាក់រួចហើយ) និង checker browser ពេល
    // គ្មាន Chromium។ ⚠️ ការលើកលែងនេះត្រូវ **រាយឲ្យឃើញ** មិនស្ងាត់ —
    // បើវាធំពេក នោះការវាស់មិនគ្របអ្វីទេ (មេរៀន «SKIP ធំពេក»)។
    if (verdict === 'skipped') { skippedInPoison.push(rel); return; }
    fakeGreen.push(rel);
}

(async () => {
const startedAt = Date.now();
// ⛔ ឯកសារនេះក៏ស្ថិតក្នុង `run-all.sh` ដែរ ➜ វាពុល **ខ្លួនឯង** រួចរត់ជាកូន។ បើកូនពុល checker ទាំងអស់ម្តងទៀត នោះវាជា
// ការរត់ស្ទួនដែលមិនចប់ក្នុងថវិកា (វាស់បាន ៖ ជំនាន់មុនសម្លាប់វានៅ ៦០ វិ. រួចរាប់ «timeout» ជាការធ្លាក់ត្រឹមត្រូវ)។
// ក្នុងការរត់ជាកូន ការអះអាងទាំងអស់ធ្លាក់រួចហើយ ➜ ការរំលងមិនបាត់ការវាស់អ្វីទេ (ដូចផ្នែក ៥ របស់ `checker-coverage`)។
if (process.env.EXITCODE_CHILD) {
    console.log('   (រំលងការពុល — កំពុងរត់ជាកូនរបស់ exit-code-integrity)');
    runnable.length = 0;
}
try {
    const serial = runnable.filter(SERIAL_LANE);
    const parallel = runnable.filter((rel) => !SERIAL_LANE(rel));
    await Promise.all([
        runPool(parallel, serial.length ? Math.max(1, CONCURRENCY - 1) : CONCURRENCY, poisonOne),
        runPool(serial, 1, poisonOne)
    ]);
} finally {
    killLiveChildren();
    dropShadows();
    sweepPoisonLeftovers();
}
const slowest = timings.slice().sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([rel, ms]) => rel + ' ' + (ms / 1000).toFixed(1) + 's').join(' · ');
console.log('   (ពុល ' + timings.length + ' checker ក្នុង ' + ((Date.now() - startedAt) / 1000).toFixed(1)
    + ' វិ. · ស្របគ្នា ' + CONCURRENCY + ' · យឺតជាងគេ ៖ ' + slowest + ')');

const MIN_POISONED = 25;
ok('zto-import/test.js ៖ ពុលការអះអាងពិតយ៉ាងតិច ៦៩ ➜ exit 1 ហើយឯកសារដើមមិនប្រែ',
    ztoPoison && ztoPoison.rc === 1 && ztoPoison.passed === 0 && ztoPoison.failed >= 69 && ztoPoison.unchanged,
    ztoPoison);
ok('ជាន់អប្បបរមា៖ ពុល checker ដែលមិនប្រើ browser >= ' + MIN_POISONED + ' (ពុលបាន ' + poisoned + ')',
    poisoned >= MIN_POISONED, { poisoned, unpoisonable });
ok('គ្មាន checker ណាចេញ exit 0 ខណៈការអះអាងទាំងអស់ធ្លាក់',
    fakeGreen.length === 0, fakeGreen);
ok('⛔ គ្មាន checker ណាផុតថវិកា ឬស្លាប់ដោយ signal ខណៈពុល (timeout ≠ ការធ្លាក់ឡើងដល់ exit code)',
    unverified.length === 0, unverified);

// ⛔ ការលើកលែង SKIP ត្រូវនៅ **តូច**។ បើ checker ភាគច្រើន SKIP នោះការវាស់
// ឥរិយាបថនេះមិនគ្របអ្វីទេ ➜ បៃតងក្លែងក្លាយថ្នាក់ថ្មី (មេរៀន ៣គ)។
const verdicts = poisoned - skippedInPoison.length;
const MIN_VERDICTS = 20;
ok('ការពុលទទួលសាលក្រមពិត >= ' + MIN_VERDICTS + ' (SKIP មិនរាប់; SKIP=' + skippedInPoison.length + ')',
    verdicts >= MIN_VERDICTS, { verdicts: verdicts, skipped: skippedInPoison });
if (skippedInPoison.length) {
    console.log('   (SKIP ខណៈពុល — គ្មានការអះអាងណារត់ ➜ វាស់មិនបាន: ' + skippedInPoison.join(', ') + ')');
}
// ⛔ checker ដែល **ពុលមិនបាន** ត្រូវមើលឃើញដែរ — ការលាក់វាធ្វើឲ្យការគ្រប
// មើលទៅធំជាងការពិត (មេរៀន «SKIP ធំពេក ជាបៃតងក្លែងក្លាយដែលមើលទៅដូចភាព
// ស្មោះត្រង់»)។ ពួកវាការពារដោយការវាស់ AST ក្នុងជំហានទី ១ ជំនួសវិញ។
if (unpoisonable.length) {
    console.log('   (ពុលមិនបាន ' + unpoisonable.length + ' ➜ ការពារដោយជំហាន AST តែម្យ៉ាង: '
        + unpoisonable.slice(0, 8).join(', ') + (unpoisonable.length > 8 ? ' …' : '') + ')');
}

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
})();
