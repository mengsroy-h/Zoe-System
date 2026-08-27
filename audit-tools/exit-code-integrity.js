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
    // ថយក្រោយ ៖ បង្កើនអថេររាប់ការធ្លាក់ដែល `process.exit(<ident>...)` យោងដល់
    const exits = [...src.matchAll(/process\.exit\(([^)]*)\)/g)];
    for (let i = exits.length - 1; i >= 0; i--) {
        const expr = exits[i][1];
        if (/^\s*\d+\s*$/.test(expr)) continue;
        const id = (expr.match(/\b([A-Za-z_$][\w$]*)\b/) || [])[1];
        if (!id) continue;
        const decl = new RegExp('((?:let|var|const)[^;\\n]*?\\b' + id + '\\s*=\\s*[^;,\\n]*)([;,])');
        if (decl.test(src)) return src.replace(decl, '$1$2 ' + id + '++;');
    }
    return null;
}

const BUDGET_MS = parseInt(process.env.EXITCODE_TIMEOUT_MS || '60000', 10);
const runnable = checkers.filter((rel) => {
    const src = fs.readFileSync(path.join(TOOLS, rel), 'utf8');
    return !/playwright-core/.test(src);       // browser checkers ៖ ថ្លៃពេក សម្រាប់ការពុល
});

// ⛔ ឧបករណ៍នេះកែឯកសារ checker **នៅនឹងកន្លែង** មួយៗ រួចស្តារវិញ។ បើវាត្រូវ
// សម្លាប់កណ្តាលផ្លូវ (`timeout` របស់ `run-all.sh` ផ្ញើ SIGTERM មុន SIGKILL
// ១០ វិនាទី) នោះឯកសារនោះនឹងនៅ **ពុល** ក្នុង repo ➜ ការ commit បន្ទាប់
// នឹងបញ្ចូល checker ដែលបាក់។ ដូច្នេះការស្តារត្រូវធានាដោយ ៣ ផ្លូវ៖
// `finally` · `process.on('exit')` · និង handler របស់ signal។
const originals = new Map();
function restoreAll() {
    for (const [file, src] of originals) {
        try { fs.writeFileSync(file, src); } catch (e) {}
    }
    originals.clear();
}
process.on('exit', restoreAll);
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) => {
    process.on(sig, () => { restoreAll(); process.exit(1); });
});

let poisoned = 0, unpoisonable = [], fakeGreen = [];
try {
    for (const rel of runnable) {
        const file = path.join(TOOLS, rel);
        const src = fs.readFileSync(file, 'utf8');
        const bad = poisonSource(src);
        if (!bad) { unpoisonable.push(rel); continue; }
        originals.set(file, src);
        fs.writeFileSync(file, bad);
        let rc = 0;
        try {
            cp.execFileSync(process.execPath, [file], {
                cwd: ROOT, timeout: BUDGET_MS, stdio: 'ignore',
                env: Object.assign({}, process.env, { EXITCODE_CHILD: '1' })
            });
        } catch (e) { rc = (e.status === undefined || e.status === null) ? 'timeout/crash' : e.status; }
        fs.writeFileSync(file, src);
        originals.delete(file);
        poisoned++;
        if (rc === 0) fakeGreen.push(rel);
    }
} finally {
    restoreAll();
}

const MIN_POISONED = 25;
ok('ជាន់អប្បបរមា៖ ពុល checker ដែលមិនប្រើ browser >= ' + MIN_POISONED + ' (ពុលបាន ' + poisoned + ')',
    poisoned >= MIN_POISONED, { poisoned, unpoisonable });
ok('គ្មាន checker ណាចេញ exit 0 ខណៈការអះអាងទាំងអស់ធ្លាក់',
    fakeGreen.length === 0, fakeGreen);

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
