const fs = require('fs');
const path = require('path');
const cp = require('child_process');

let acorn;
try { acorn = require('acorn'); } catch (e) { console.log('SKIP — ត្រូវការ acorn (npm i acorn)'); process.exit(0); }

const ROOT = process.env.EXITCODE_APP_DIR || path.join(__dirname, '..');
const TOOLS = path.join(ROOT, 'audit-tools');
const RUNALL = path.join(TOOLS, 'run-all.sh');

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
    return [...found].filter((f) => fs.existsSync(path.join(TOOLS, f)));
}

const checkers = checkersFromRunAll();
const MIN_CHECKERS = 40;
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
const POISON_DIRS = [TOOLS, path.join(TOOLS, 'emu')];

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
process.on('exit', dropShadows);
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) => {
    process.on(sig, () => { dropShadows(); process.exit(1); });
});
sweepPoisonLeftovers();

let poisoned = 0, unpoisonable = [], fakeGreen = [], skippedInPoison = [];
try {
    for (const rel of runnable) {
        const file = path.join(TOOLS, rel);
        const src = fs.readFileSync(file, 'utf8');
        const bad = poisonSource(src);
        if (!bad) { unpoisonable.push(rel); continue; }
        // ⛔ ស្រមោល **ក្បែរ** ឯកសារដើម — ថតដដែល ➜ `__dirname` ·
        // `require('./x')` · `__filename` នៅដំណើរការដូចដើម។
        const shadow = path.join(path.dirname(file), POISON_PREFIX + process.pid + '-' + path.basename(file));
        shadows.add(shadow);
        fs.writeFileSync(shadow, bad);
        let rc = 0, out = '';
        try {
            out = String(cp.execFileSync(process.execPath, [shadow], {
                cwd: ROOT, timeout: BUDGET_MS, stdio: ['ignore', 'pipe', 'pipe'],
                env: Object.assign({}, process.env, { EXITCODE_CHILD: '1' })
            }) || '');
        } catch (e) {
            rc = (e.status === undefined || e.status === null) ? 'timeout/crash' : e.status;
            out = String((e.stdout || '') + (e.stderr || ''));
        }
        try { fs.unlinkSync(shadow); } catch (e) {}
        shadows.delete(shadow);
        poisoned++;
        if (rc !== 0) continue;
        // ⛔ ការចេញ exit 0 **ខណៈ SKIP** មិនមែនជាបៃតងក្លែងក្លាយទេ — checker
        // នោះ **មិនបានអះអាងអ្វីសោះ** ហើយ `run-all.sh` រាយវាជា SKIPPED មិនមែន
        // PASS។ ការពុលមិនអាចវាស់អ្វីបានទេ ពេលគ្មានការអះអាងណារត់។
        // ឧ. `emu/*` ពេលគ្មាន RTDB emulator (CI ដាក់ `CRUD_FLOW_STRICT=1`
        // ដែលបង្វែរ SKIP នោះទៅជាការធ្លាក់រួចហើយ) និង checker browser ពេល
        // គ្មាន Chromium។ ⚠️ ការលើកលែងនេះត្រូវ **រាយឲ្យឃើញ** មិនស្ងាត់ —
        // បើវាធំពេក នោះការវាស់មិនគ្របអ្វីទេ (មេរៀន «SKIP ធំពេក»)។
        if (/^SKIP\b/m.test(out)) { skippedInPoison.push(rel); continue; }
        fakeGreen.push(rel);
    }
} finally {
    dropShadows();
    sweepPoisonLeftovers();
}

const MIN_POISONED = 25;
ok('ជាន់អប្បបរមា៖ ពុល checker ដែលមិនប្រើ browser >= ' + MIN_POISONED + ' (ពុលបាន ' + poisoned + ')',
    poisoned >= MIN_POISONED, { poisoned, unpoisonable });
ok('គ្មាន checker ណាចេញ exit 0 ខណៈការអះអាងទាំងអស់ធ្លាក់',
    fakeGreen.length === 0, fakeGreen);

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
